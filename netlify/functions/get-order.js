/* ============================================================
   Relecture d'un paiement après le retour de SumUp
   ------------------------------------------------------------
   La page de confirmation ne se contente pas de croire qu'elle a
   été atteinte : elle demande à SumUp l'état réel du paiement, et
   n'affiche « paiement confirmé » que si SumUp le dit.

   SumUp ne permet pas de retrouver un paiement par référence
   marchande : la recherche se fait par identifiant de checkout.
   La page passe donc l'identifiant renvoyé à la création, et la
   référence sert uniquement à vérifier qu'il s'agit bien de la
   commande que le navigateur a en mémoire.

   Seules des informations non sensibles sont renvoyées.
   ============================================================ */
const SUMUP = 'https://api.sumup.com/v0.1/checkouts/';

const entetes = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store'
};

function reponse(code, corps) {
  return { statusCode: code, headers: entetes, body: JSON.stringify(corps) };
}

exports.handler = async (event) => {
  const id = (event.queryStringParameters || {}).id || '';
  // Identifiant SumUp : un UUID. Filtré avant de partir dans une URL.
  if (!/^[A-Za-z0-9-]{8,64}$/.test(id)) {
    return reponse(400, { erreur: 'identifiant', message: 'Référence de commande invalide.' });
  }

  const cle = process.env.SUMUP_API_KEY;
  if (!cle) {
    return reponse(503, { erreur: 'sumup_non_configure', message: 'Paiement en ligne non activé.' });
  }

  try {
    const appel = await fetch(SUMUP + encodeURIComponent(id), {
      headers: { Authorization: 'Bearer ' + cle }
    });
    const brut = await appel.text();
    let c = {};
    try { c = JSON.parse(brut); } catch (e) { /* réponse illisible */ }

    if (!appel.ok || !c.status) {
      console.error('SumUp retrieve error', appel.status, brut.slice(0, 300));
      return reponse(502, { erreur: 'sumup', message: 'Commande introuvable.' });
    }

    return reponse(200, {
      // PENDING | PAID | FAILED | EXPIRED
      statut: c.status,
      paye: c.status === 'PAID',
      // SumUp compte en unités majeures, le site en centimes.
      total: Math.round((Number(c.amount) || 0) * 100),
      devise: (c.currency || 'CHF').toUpperCase(),
      reference: c.checkout_reference || ''
    });
  } catch (e) {
    console.error('SumUp retrieve exception', e && e.message);
    return reponse(502, { erreur: 'sumup', message: 'Commande introuvable.' });
  }
};
