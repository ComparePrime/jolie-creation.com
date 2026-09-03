/* ============================================================
   Création de la session Stripe Checkout
   ------------------------------------------------------------
   La clé secrète Stripe n'existe QUE ici, côté serveur, lue dans
   la variable d'environnement STRIPE_SECRET_KEY. Elle n'est
   jamais envoyée au navigateur ni écrite dans le dépôt.

   Le navigateur n'envoie que des identifiants d'articles et des
   quantités. Les prix sont relus dans catalogue.js : un panier
   trafiqué ne peut donc pas faire baisser le montant payé.
   ============================================================ */
const Catalogue = require('../../catalogue.js');

const MAX_LIGNES = 30;
const MAX_QTE = 99;

const entetes = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store'
};

function reponse(code, corps) {
  return { statusCode: code, headers: entetes, body: JSON.stringify(corps) };
}

/** Tronque et nettoie une valeur saisie par le client avant de l'envoyer à Stripe. */
function texte(valeur, max) {
  if (typeof valeur !== 'string') return '';
  return valeur.replace(/\s+/g, ' ').trim().slice(0, max || 200);
}

/** Résume les détails d'une micro-scénographie en une ligne lisible sur la facture. */
function resumeDetails(details) {
  if (!details || typeof details !== 'object') return '';
  const libelles = {
    date: 'Date', lieu: 'Lieu', theme: 'Thème',
    options: 'Options', demandes: 'Demandes'
  };
  return Object.keys(libelles)
    .filter((cle) => texte(details[cle], 300))
    .map((cle) => `${libelles[cle]} : ${texte(details[cle], 300)}`)
    .join(' — ');
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return reponse(405, { erreur: 'methode', message: 'Méthode non autorisée.' });
  }

  const cle = process.env.STRIPE_SECRET_KEY;
  if (!cle) {
    // Pas de clé configurée : on le dit franchement plutôt que de
    // simuler un paiement qui n'aura jamais lieu.
    return reponse(503, {
      erreur: 'stripe_non_configure',
      message: 'Le paiement en ligne n’est pas encore activé sur ce site.'
    });
  }

  let charge;
  try {
    charge = JSON.parse(event.body || '{}');
  } catch (e) {
    return reponse(400, { erreur: 'json', message: 'Requête illisible.' });
  }

  const lignesRecues = Array.isArray(charge.lignes) ? charge.lignes.slice(0, MAX_LIGNES) : [];
  if (!lignesRecues.length) {
    return reponse(400, { erreur: 'panier_vide', message: 'Le panier est vide.' });
  }

  const lineItems = [];
  const aConfirmer = [];

  /* Ajoute un article au panier facturé, ou à la liste des montants
     laissés à confirmer si son tarif est une fourchette. */
  function porter(article, qte, description) {
    if (article.aConfirmer) {
      aConfirmer.push(`${qte} × ${article.court} (${Catalogue.formater(article.prixMin)} à ${Catalogue.formater(article.prixMax)})`);
      return;
    }
    lineItems.push({
      quantity: qte,
      price_data: {
        currency: Catalogue.DEVISE.toLowerCase(),
        unit_amount: article.prix,
        product_data: {
          name: article.nom + (article.aPartirDe ? ' (tarif de départ)' : ''),
          description: (description || '').slice(0, 500) || undefined
        }
      }
    });
  }

  for (const ligne of lignesRecues) {
    const article = Catalogue.article(ligne && ligne.id);
    if (!article) {
      return reponse(400, { erreur: 'article_inconnu', message: 'Un article du panier n’existe plus.' });
    }
    // Un biscuit supplémentaire ne se commande jamais seul : il n'arrive
    // qu'attaché au package qui le porte.
    if (article.categorie === 'biscuit-sup') {
      return reponse(400, {
        erreur: 'supplement_isole',
        message: `Les biscuits supplémentaires s’ajoutent à un package : la commande démarre à ${Catalogue.MIN_BISCUITS} biscuits.`
      });
    }
    const qte = Math.min(MAX_QTE, Math.max(1, parseInt(ligne.qte, 10) || 0));
    porter(article, qte, [article.resume, resumeDetails(ligne.details)].filter(Boolean).join(' | '));

    if (article.categorie !== 'package-biscuits') continue;
    const supplements = (ligne.supplements && typeof ligne.supplements === 'object') ? ligne.supplements : {};
    for (const idSup of Object.keys(supplements).slice(0, MAX_LIGNES)) {
      const sup = Catalogue.article(idSup);
      if (!sup || sup.categorie !== 'biscuit-sup') continue;
      const qteSup = Math.min(MAX_QTE, Math.max(0, parseInt(supplements[idSup], 10) || 0)) * qte;
      if (qteSup > 0) porter(sup, qteSup, 'Complément du package ' + article.court);
    }
  }

  if (!lineItems.length) {
    return reponse(400, {
      erreur: 'rien_a_facturer',
      message: 'Aucun article de ce panier ne peut être payé en ligne en l’état.'
    });
  }

  const client = charge.client || {};
  const origine = process.env.URL || process.env.DEPLOY_PRIME_URL ||
    (event.headers && event.headers.origin) || 'https://www.jolie-creation.com';

  const metadata = {
    reception: texte(client.reception, 40),
    pays: texte(client.pays, 60),
    telephone: texte(client.telephone, 40),
    message: texte(client.message, 480),
    a_confirmer: aConfirmer.join(' ; ').slice(0, 480)
  };
  // Les détails de scénographie voyagent aussi en métadonnées, une clé par
  // article, pour être lisibles dans le tableau de bord Stripe.
  lignesRecues.forEach((ligne, i) => {
    const resume = resumeDetails(ligne && ligne.details);
    if (resume) metadata['article_' + (i + 1)] = resume.slice(0, 480);
  });

  try {
    const stripe = require('stripe')(cle);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      // payment_method_types volontairement absent : Stripe propose alors
      // les moyens activés dans le tableau de bord (carte, TWINT,
      // Apple Pay, Google Pay). Les figer ici casserait le paiement
      // dès qu'un moyen n'est pas encore activé sur le compte.
      line_items: lineItems,
      locale: 'fr',
      customer_email: texte(client.email, 120) || undefined,
      billing_address_collection: 'required',
      phone_number_collection: { enabled: false },
      metadata,
      payment_intent_data: { metadata },
      success_url: `${origine}/commande-confirmee.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origine}/paiement.html?annule=1`
    });
    return reponse(200, { url: session.url });
  } catch (e) {
    console.error('Stripe checkout error', e && e.message);
    return reponse(502, {
      erreur: 'stripe',
      message: 'La session de paiement n’a pas pu être créée. Réessayez ou contactez-moi directement.'
    });
  }
};
