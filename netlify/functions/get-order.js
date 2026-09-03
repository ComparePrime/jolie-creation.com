/* ============================================================
   Relecture d'une commande après paiement
   ------------------------------------------------------------
   La page de confirmation ne se contente pas de croire qu'elle a
   été atteinte : elle demande à Stripe l'état réel de la session,
   et n'affiche « paiement confirmé » que si Stripe le dit.
   Seules des informations non sensibles sont renvoyées.
   ============================================================ */
const entetes = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store'
};

function reponse(code, corps) {
  return { statusCode: code, headers: entetes, body: JSON.stringify(corps) };
}

exports.handler = async (event) => {
  const id = (event.queryStringParameters || {}).session_id || '';
  if (!/^cs_[A-Za-z0-9_]+$/.test(id)) {
    return reponse(400, { erreur: 'session', message: 'Référence de commande invalide.' });
  }

  const cle = process.env.STRIPE_SECRET_KEY;
  if (!cle) {
    return reponse(503, { erreur: 'stripe_non_configure', message: 'Paiement en ligne non activé.' });
  }

  try {
    const stripe = require('stripe')(cle);
    const session = await stripe.checkout.sessions.retrieve(id, { expand: ['line_items'] });
    return reponse(200, {
      statut: session.payment_status,           // 'paid' | 'unpaid' | 'no_payment_required'
      total: session.amount_total,
      devise: (session.currency || 'chf').toUpperCase(),
      email: session.customer_details ? session.customer_details.email : null,
      reference: session.id.slice(-12).toUpperCase(),
      aConfirmer: (session.metadata && session.metadata.a_confirmer) || '',
      articles: (session.line_items ? session.line_items.data : []).map((l) => ({
        nom: l.description,
        qte: l.quantity,
        montant: l.amount_total
      }))
    });
  } catch (e) {
    console.error('Stripe retrieve error', e && e.message);
    return reponse(502, { erreur: 'stripe', message: 'Commande introuvable.' });
  }
};
