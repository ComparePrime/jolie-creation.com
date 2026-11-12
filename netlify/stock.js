/* ============================================================
   Stock réel des articles limités (le coffret Magie de Noël)
   ------------------------------------------------------------
   Le site est statique : rien ne retient d'une visite à l'autre le
   nombre de coffrets vendus. Cet état vit donc dans Netlify Blobs,
   un seul document, modifié par comparaison d'étiquette (onlyIfMatch)
   pour que deux paiements simultanés ne puissent pas se partager le
   dernier coffret.

   Les quantités de départ ne sont PAS ici : elles sont déclarées dans
   catalogue.js (« stock »). Ici ne vit que ce qui a été vendu et ce
   qui est en cours de paiement.

   Cycle d'une commande :
     reserver()  à la création du paiement : vérifie, puis retient ;
     confirmer() quand SumUp annonce PAID : la réservation devient
                 une vente (idempotent : rejouable sans double décompte) ;
     liberer()   si le paiement échoue ou expire.
   Une réservation orpheline (client parti sans payer) est relue auprès
   de SumUp (reconcilier) puis libérée : elle ne bloque pas un coffret
   indéfiniment, et un paiement réussi dont le client n'est jamais
   revenu est quand même compté.

   Une logique pure (sur un objet d'état) est séparée du stockage, pour
   se tester sans réseau.
   ============================================================ */
const Catalogue = require('../catalogue.js');

const NOM_STORE = 'stock-boutique';
const CLE = 'etat';
const RESERVATION_MAX_MS = 24 * 3600 * 1000;
const ESSAIS = 8;

class StockInsuffisant extends Error {
  constructor(articles) {
    super('stock_insuffisant');
    this.articles = articles;
  }
}

function etatVide() { return { vendu: {}, reservations: {}, confirmees: {} }; }

/* ---------- Logique pure ---------- */

/* Ne se retient que ce qui a un stock déclaré : un modèle sans stock
   communiqué reste illimité, sans rien à suivre. */
function consommationLimitee(lignes) {
  const conso = Catalogue.consommationStock(lignes);
  const limitee = {};
  Object.keys(conso).forEach((id) => {
    if (Catalogue.stockDeclare(id) !== null) limitee[id] = conso[id];
  });
  return limitee;
}

function dejaPris(etat, sauf) {
  const pris = Object.assign({}, etat.vendu);
  Object.keys(etat.reservations).forEach((ref) => {
    if (ref === sauf) return;
    const conso = etat.reservations[ref].conso || {};
    Object.keys(conso).forEach((id) => { pris[id] = (pris[id] || 0) + conso[id]; });
  });
  return pris;
}

function reserverDans(etat, ref, lignes, maintenant, checkout) {
  const manque = Catalogue.depassementsStock(lignes, dejaPris(etat, ref));
  if (manque.length) throw new StockInsuffisant(manque);
  const conso = consommationLimitee(lignes);
  if (Object.keys(conso).length) {
    etat.reservations[ref] = { conso, t: maintenant, checkout: checkout || null };
  }
  return etat;
}

function confirmerDans(etat, ref) {
  if (etat.confirmees[ref]) return etat;
  const r = etat.reservations[ref];
  // Une commande sans article limité n'a rien réservé : rien à noter.
  if (!r) return etat;
  Object.keys(r.conso).forEach((id) => { etat.vendu[id] = (etat.vendu[id] || 0) + r.conso[id]; });
  delete etat.reservations[ref];
  etat.confirmees[ref] = true;
  return etat;
}

/* Vente immédiate, sans paiement en ligne (retrait réglé sur place) :
   la commande enregistrée compte tout de suite. */
function vendreDans(etat, ref, lignes) {
  if (etat.confirmees[ref]) return etat;
  const manque = Catalogue.depassementsStock(lignes, dejaPris(etat, ref));
  if (manque.length) throw new StockInsuffisant(manque);
  const conso = consommationLimitee(lignes);
  Object.keys(conso).forEach((id) => { etat.vendu[id] = (etat.vendu[id] || 0) + conso[id]; });
  etat.confirmees[ref] = true;
  return etat;
}

function libererDans(etat, ref) {
  delete etat.reservations[ref];
  return etat;
}

/* Ce que la page a le droit de savoir : combien reste-t-il, jamais
   le détail des commandes. Uniquement les articles à stock déclaré. */
function vuePublique(etat) {
  const pris = dejaPris(etat);
  const vue = {};
  Catalogue.ARTICLES.forEach((a) => {
    if (a.categorie !== 'package') return;
    const dispo = Catalogue.packagesDisponibles(a.id, pris);
    if (dispo === null) return;
    vue[a.id] = { stock: Catalogue.stockDeclare(a.id), restant: dispo };
  });
  return vue;
}

/* ---------- Stockage ---------- */

function storeNetlify(event) {
  const blobs = require('@netlify/blobs');
  // Les fonctions « Lambda » reçoivent leur contexte Blobs de l'événement.
  if (event && blobs.connectLambda) blobs.connectLambda(event);
  const store = blobs.getStore({ name: NOM_STORE, consistency: 'strong' });
  return {
    async lire() {
      const r = await store.getWithMetadata(CLE, { type: 'json' });
      return r ? { etat: r.data, etag: r.etag } : { etat: null, etag: null };
    },
    async ecrire(etat, etag) {
      const r = await store.setJSON(CLE, etat, etag ? { onlyIfMatch: etag } : { onlyIfNew: true });
      return r.modified !== false;
    }
  };
}

/* Applique une modification avec relecture en cas de collision. */
async function modifier(stockage, fn) {
  for (let i = 0; i < ESSAIS; i++) {
    const { etat, etag } = await stockage.lire();
    const courant = etat ? Object.assign(etatVide(), etat) : etatVide();
    fn(courant);
    if (await stockage.ecrire(courant, etag)) return courant;
  }
  throw new Error('stock_conflit');
}

async function lireEtat(stockage) {
  const { etat } = await stockage.lire();
  return etat ? Object.assign(etatVide(), etat) : etatVide();
}

const reserver = (st, ref, lignes, maintenant, checkout) =>
  modifier(st, (e) => reserverDans(e, ref, lignes, maintenant, checkout));
const lierCheckout = (st, ref, checkout) =>
  modifier(st, (e) => { if (e.reservations[ref]) e.reservations[ref].checkout = checkout; });
const confirmer = (st, ref) => modifier(st, (e) => confirmerDans(e, ref));
const vendre = (st, ref, lignes) => modifier(st, (e) => vendreDans(e, ref, lignes));
const liberer = (st, ref) => modifier(st, (e) => libererDans(e, ref));

/* Relit auprès de SumUp les réservations en attente : payée → vendue ;
   échouée ou expirée → libérée ; trop ancienne → libérée.
   `statut(checkoutId)` renvoie 'PAID' | 'FAILED' | 'EXPIRED' | 'PENDING' | null. */
async function reconcilier(stockage, statut, maintenant) {
  const etat = await lireEtat(stockage);
  const refs = Object.keys(etat.reservations).slice(0, 25);
  for (const ref of refs) {
    const r = etat.reservations[ref];
    let s = null;
    if (r.checkout && statut) {
      try { s = await statut(r.checkout); } catch (e) { s = null; }
    }
    if (s === 'PAID') await confirmer(stockage, ref);
    else if (s === 'FAILED' || s === 'EXPIRED') await liberer(stockage, ref);
    else if (maintenant - r.t > RESERVATION_MAX_MS) await liberer(stockage, ref);
  }
}

module.exports = {
  StockInsuffisant, etatVide, reserverDans, confirmerDans, vendreDans, libererDans,
  vuePublique, dejaPris, consommationLimitee,
  storeNetlify, modifier, lireEtat, reserver, lierCheckout, confirmer, vendre, liberer, reconcilier
};
