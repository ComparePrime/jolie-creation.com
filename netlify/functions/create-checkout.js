/* ============================================================
   Création d'une session de paiement SumUp
   ------------------------------------------------------------
   La clé API SumUp n'existe QUE ici, côté serveur, lue dans la
   variable d'environnement SUMUP_API_KEY. Elle n'est jamais
   envoyée au navigateur ni écrite dans le dépôt.

   Le navigateur n'envoie que des identifiants d'articles et des
   quantités. Les prix sont relus dans catalogue.js : un panier
   trafiqué ne peut donc pas faire baisser le montant payé.

   Deux différences de fond avec l'ancienne intégration Stripe,
   qui expliquent la forme de ce fichier :

   1. SumUp facture UN montant, pas une liste d'articles. Le détail
      de la commande part donc dans « description », tronqué, et la
      page de confirmation le réaffiche depuis la copie gardée par
      le navigateur.
   2. SumUp attend des unités majeures (72.50), là où tout le reste
      du site compte en centimes (7250). La conversion a lieu une
      seule fois, ici, au bord de l'API.
   ============================================================ */
const Catalogue = require('../../catalogue.js');

const SUMUP = 'https://api.sumup.com/v0.1/checkouts';
const MAX_LIGNES = 30;
const MAX_QTE = 99;
const MAX_DESCRIPTION = 250;

const entetes = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store'
};

function reponse(code, corps) {
  return { statusCode: code, headers: entetes, body: JSON.stringify(corps) };
}

/** Tronque et nettoie une valeur saisie par le client. */
function texte(valeur, max) {
  if (typeof valeur !== 'string') return '';
  return valeur.replace(/\s+/g, ' ').trim().slice(0, max || 200);
}

/* Référence de commande, au format JC-AAAAMMJJ-XXXXXX.
   Elle est forgée par le navigateur, qui en a besoin AVANT de partir
   payer : c'est elle qui relie la commande enregistrée (adresse,
   articles) au paiement encaissé par SumUp. Une référence qui ne
   respecte pas le format est remplacée plutôt que refusée — elle ne
   sert qu'à rapprocher deux enregistrements, jamais à autoriser
   quoi que ce soit. */
const FORMAT_REFERENCE = /^JC-\d{8}-[A-Z0-9]{6}$/;

function reference(proposee) {
  if (typeof proposee === 'string' && FORMAT_REFERENCE.test(proposee)) return proposee;
  const jour = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const alea = Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, '0');
  return 'JC-' + jour + '-' + alea;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return reponse(405, { erreur: 'methode', message: 'Méthode non autorisée.' });
  }

  const cle = process.env.SUMUP_API_KEY;
  const marchand = process.env.SUMUP_MERCHANT_CODE;
  if (!cle || !marchand) {
    // Pas de compte configuré : on le dit franchement plutôt que de
    // simuler un paiement qui n'aura jamais lieu.
    return reponse(503, {
      erreur: 'sumup_non_configure',
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

  // Le retrait se paie sur place : il n'a rien à faire ici.
  if (charge.client && charge.client.reception === 'retrait') {
    return reponse(400, {
      erreur: 'retrait_sans_paiement',
      message: 'Une commande à retirer se règle sur place, sans paiement en ligne.'
    });
  }

  /* ---------- Retarification intégrale depuis le catalogue ---------- */
  let centimes = 0;
  let biscuits = 0;
  const libelles = [];

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
    centimes += article.prix * qte;
    biscuits += (article.biscuits || 0) * qte;
    libelles.push(qte + '× ' + article.court);

    const supplements = (ligne.supplements && typeof ligne.supplements === 'object') ? ligne.supplements : {};
    for (const idSup of Object.keys(supplements).slice(0, MAX_LIGNES)) {
      const sup = Catalogue.article(idSup);
      if (!sup || sup.categorie !== 'biscuit-sup') continue;
      const qteSup = Math.min(MAX_QTE, Math.max(0, parseInt(supplements[idSup], 10) || 0)) * qte;
      if (qteSup <= 0) continue;
      centimes += sup.prix * qteSup;
      biscuits += qteSup;
      libelles.push(qteSup + '× ' + sup.court);
    }
  }

  if (centimes <= 0) {
    return reponse(400, { erreur: 'rien_a_facturer', message: 'Aucun montant à payer pour ce panier.' });
  }

  const origine = process.env.URL || process.env.DEPLOY_PRIME_URL ||
    (event.headers && event.headers.origin) || 'https://jolie-creation.com';
  const ref = reference(charge.reference);

  const description = ('Jolie Création — ' + biscuits + ' biscuits · ' + libelles.join(', '))
    .slice(0, MAX_DESCRIPTION);

  try {
    const appel = await fetch(SUMUP, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + cle,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        checkout_reference: ref,
        amount: Catalogue.enFrancs(centimes),
        currency: Catalogue.DEVISE,
        merchant_code: marchand,
        description: description,
        // Page SumUp hébergée : aucune donnée bancaire ne touche ce site.
        hosted_checkout: { enabled: true },
        redirect_url: `${origine}/commande-confirmee.html?ref=${encodeURIComponent(ref)}`
      })
    });

    const brut = await appel.text();
    let data = {};
    try { data = JSON.parse(brut); } catch (e) { /* réponse illisible */ }

    if (!appel.ok || !data.hosted_checkout_url) {
      console.error('SumUp checkout error', appel.status, brut.slice(0, 400));
      return reponse(502, {
        erreur: 'sumup',
        message: 'La session de paiement n’a pas pu être créée. Réessayez ou contactez-moi directement.'
      });
    }

    return reponse(200, {
      url: data.hosted_checkout_url,
      id: data.id,
      reference: ref,
      // Renvoyé pour que le navigateur vérifie que son total correspond
      // bien à celui qui sera débité.
      montant: centimes
    });
  } catch (e) {
    console.error('SumUp checkout exception', e && e.message);
    return reponse(502, {
      erreur: 'sumup',
      message: 'La session de paiement n’a pas pu être créée. Réessayez ou contactez-moi directement.'
    });
  }
};

// Exporté pour les tests : ils appellent le handler sans passer par Netlify.
exports.texte = texte;
