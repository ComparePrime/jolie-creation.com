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
  let biscuitsPackage = 0;
  let aDesSup = false;

  for (const ligne of lignesRecues) {
    const article = Catalogue.article(ligne && ligne.id);
    if (!article) {
      return reponse(400, { erreur: 'article_inconnu', message: 'Un article du panier n’existe plus.' });
    }
    const qte = Math.min(MAX_QTE, Math.max(1, parseInt(ligne.qte, 10) || 0));
    if (article.categorie === 'package-biscuits') biscuitsPackage += (article.biscuits || 0) * qte;
    if (article.categorie === 'biscuit-sup') aDesSup = true;

    if (article.aConfirmer) {
      // Tarif en fourchette : facturé après confirmation, jamais arrondi ici.
      aConfirmer.push(`${qte} × ${article.court} (${Catalogue.formater(article.prixMin)} à ${Catalogue.formater(article.prixMax)})`);
      continue;
    }

    const description = [article.resume, resumeDetails(ligne.details)].filter(Boolean).join(' | ');
    lineItems.push({
      quantity: qte,
      price_data: {
        currency: Catalogue.DEVISE.toLowerCase(),
        unit_amount: article.prix,
        product_data: {
          name: article.nom + (article.aPartirDe ? ' (tarif de départ)' : ''),
          description: description.slice(0, 500) || undefined
        }
      }
    });
  }

  if (aDesSup && biscuitsPackage < Catalogue.MIN_BISCUITS) {
    return reponse(400, {
      erreur: 'minimum_biscuits',
      message: `La commande de biscuits démarre à ${Catalogue.MIN_BISCUITS} biscuits : ajoutez un package.`
    });
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
