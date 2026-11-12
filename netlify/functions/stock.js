/* ============================================================
   Stock réel, en lecture publique ; vente d'un retrait
   ------------------------------------------------------------
   GET  /api/stock  : combien de coffrets restent, et si l'offre est
                      terminée. Données réelles, relues à chaque appel :
                      jamais une valeur figée dans la page.
   POST /api/stock  {action:'verifier'} : mêmes contrôles, sans rien
                      retenir — appelé avant d'enregistrer une commande.
   POST /api/stock  : une commande à retirer (réglée sur place) qui
                      contient un article limité. Elle ne passe pas par
                      SumUp ; la commande enregistrée compte donc tout de
                      suite. Mêmes refus que le paiement en ligne :
                      date limite, personnalisation, stock.
   ============================================================ */
const Catalogue = require('../../catalogue.js');
const Stock = require('../stock.js');

const entetes = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const reponse = (code, corps) => ({ statusCode: code, headers: entetes, body: JSON.stringify(corps) });
const FORMAT_REFERENCE = /^JC-\d{8}-[A-Z0-9]{6}$/;

function magasin(event) { return exports.stockageDeTest || Stock.storeNetlify(event); }

exports.handler = async (event) => {
  const maintenant = Date.now();

  if (event.httpMethod === 'GET') {
    try {
      const etat = await Stock.lireEtat(magasin(event));
      const vue = Stock.vuePublique(etat);
      const coffret = vue['magie-noel-pack-coffret'] || null;
      const art = Catalogue.article('magie-noel-pack-coffret');
      return reponse(200, {
        maintenant,
        coffret: coffret && { stock: coffret.stock, restant: coffret.restant },
        offreTerminee: Catalogue.offreTerminee(art, maintenant)
      });
    } catch (e) {
      // Pas de chiffre inventé : la page retombe sur « quantités limitées ».
      console.error('Stock illisible', e && e.message);
      return reponse(503, { erreur: 'stock_indisponible' });
    }
  }

  if (event.httpMethod !== 'POST') return reponse(405, { erreur: 'methode' });

  let charge;
  try { charge = JSON.parse(event.body || '{}'); } catch (e) { return reponse(400, { erreur: 'json' }); }
  const lignes = Array.isArray(charge.lignes) ? charge.lignes.slice(0, 120) : [];
  if (!lignes.length || !lignes.every((l) => Catalogue.article(l && l.id))) {
    return reponse(400, { erreur: 'article_inconnu', message: 'Un article du panier n’existe plus.' });
  }
  const verifier = charge.action === 'verifier';
  if (!verifier && (typeof charge.reference !== 'string' || !FORMAT_REFERENCE.test(charge.reference))) {
    return reponse(400, { erreur: 'reference', message: 'Référence de commande invalide.' });
  }
  const expirees = Catalogue.lignesOffreTerminee(lignes, maintenant);
  if (expirees.length) {
    return reponse(410, { erreur: 'offre_terminee', message: 'L’offre Magie de Noël est terminée.' });
  }
  const sansPerso = Catalogue.personnalisationManquante(lignes);
  if (sansPerso.length) {
    return reponse(400, { erreur: 'personnalisation_manquante',
      message: 'Précisez la personnalisation de : ' + sansPerso.map((a) => a.nom).join(', ') + '.' });
  }
  if (!Object.keys(Stock.consommationLimitee(lignes)).length) return reponse(200, { ok: true });
  try {
    if (verifier) {
      // Contrôle sans rien retenir : avant d'enregistrer une commande.
      const manque = Catalogue.depassementsStock(lignes, Stock.dejaPris(await Stock.lireEtat(magasin(event))));
      if (manque.length) throw new Stock.StockInsuffisant(manque);
      return reponse(200, { ok: true });
    }
    await Stock.vendre(magasin(event), charge.reference, lignes);
    return reponse(200, { ok: true });
  } catch (e) {
    if (e instanceof Stock.StockInsuffisant) {
      return reponse(409, { erreur: 'stock_insuffisant',
        message: 'Plus assez de stock pour : ' + e.articles.map((a) => a.nom).join(', ') + '.' });
    }
    console.error('Stock indisponible', e && e.message);
    return reponse(503, { erreur: 'stock_indisponible', message: 'Le stock n’a pas pu être vérifié. Réessayez dans un instant.' });
  }
};
