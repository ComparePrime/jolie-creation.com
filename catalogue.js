/* ============================================================
   JOLIE CRÉATION — catalogue des prestations achetables
   ------------------------------------------------------------
   Source unique de vérité, partagée par le navigateur et par la
   fonction serveur qui crée la session de paiement Stripe.
   Le serveur retarife TOUJOURS depuis ce fichier : les montants
   envoyés par le navigateur ne sont jamais pris pour argent
   comptant, sinon n'importe qui pourrait payer 1 CHF.

   Les montants sont en centimes (entiers) : additionner des
   francs en virgule flottante finit toujours par produire un
   72.49999999 quelque part.
   ============================================================ */
(function (racine) {
  'use strict';

  var ARTICLES = [
    /* ---------- Micro-scénographies ---------- */
    {
      id: 'sceno-essentiel',
      nom: 'Micro-scénographie Mini Essentiel',
      court: 'Mini Essentiel',
      categorie: 'scenographie',
      prix: 39000,
      aPartirDe: true,
      details: true,
      page: 'mini-scenographies.html',
      resume: '1 backdrop, personnalisation, petite composition de ballons, 1 présentoir, 12 biscuits, installation et démontage.'
    },
    {
      id: 'sceno-signature',
      nom: 'Micro-scénographie Mini Signature',
      court: 'Mini Signature',
      categorie: 'scenographie',
      prix: 59000,
      aPartirDe: true,
      details: true,
      page: 'mini-scenographies.html',
      resume: '2 backdrops, 2 compositions de ballons, 2 présentoirs, éléments décoratifs, 18 biscuits, installation et démontage.'
    },
    {
      id: 'sceno-signature-plus',
      nom: 'Micro-scénographie Mini Signature Plus',
      court: 'Mini Signature Plus',
      categorie: 'scenographie',
      prix: 79000,
      aPartirDe: true,
      details: true,
      page: 'mini-scenographies.html',
      resume: '2 backdrops personnalisés, ballons plus fournis, 2 à 3 présentoirs, tapis, accessoires, 24 biscuits, installation et démontage.'
    },

    /* ---------- Packages de biscuits (12 biscuits minimum) ---------- */
    {
      id: 'pack-ocean',
      nom: 'Package biscuits — Thème Océan',
      court: 'Thème Océan',
      categorie: 'package-biscuits',
      prix: 6900,
      aPartirDe: false,
      biscuits: 12,
      page: 'biscuits-personnalises.html',
      resume: '7 biscuits personnalisés décorés et 5 petits biscuits simples, soit 12 biscuits.'
    },
    {
      id: 'pack-pierre-lapin',
      nom: 'Package biscuits — Pierre Lapin',
      court: 'Pierre Lapin',
      categorie: 'package-biscuits',
      prix: 7700,
      aPartirDe: true,
      biscuits: 12,
      page: 'biscuits-personnalises.html',
      resume: 'Package de 12 biscuits sur le thème Pierre Lapin.'
    },
    {
      id: 'pack-cheval',
      nom: 'Package biscuits — Cheval',
      court: 'Cheval',
      categorie: 'package-biscuits',
      prix: 7250,
      aPartirDe: true,
      biscuits: 12,
      page: 'biscuits-personnalises.html',
      resume: 'Package de 12 biscuits sur le thème Cheval.'
    },
    {
      id: 'pack-licorne',
      nom: 'Package biscuits — Licorne',
      court: 'Licorne',
      categorie: 'package-biscuits',
      prix: 7350,
      aPartirDe: true,
      biscuits: 12,
      page: 'biscuits-personnalises.html',
      resume: 'Package de 12 biscuits sur le thème Licorne.'
    },

    /* ---------- Biscuits supplémentaires ----------
       Les deux derniers ont un tarif en fourchette : leur montant
       exact dépend de la taille et du niveau de détail. Ils sont
       donc portés au panier mais exclus du paiement en ligne, et
       facturés après confirmation. Rien n'est arrondi d'office. */
    {
      id: 'biscuit-petit',
      nom: 'Petit biscuit supplémentaire',
      court: 'Petit biscuit',
      categorie: 'biscuit-sup',
      prix: 400,
      page: 'biscuits-personnalises.html',
      resume: 'Petit format avec décoration simple.'
    },
    {
      id: 'biscuit-standard',
      nom: 'Biscuit standard supplémentaire',
      court: 'Biscuit standard',
      categorie: 'biscuit-sup',
      prixMin: 500,
      prixMax: 600,
      aConfirmer: true,
      page: 'biscuits-personnalises.html',
      resume: 'Format classique. Le prix varie selon la taille et le niveau de détail.'
    },
    {
      id: 'biscuit-grand',
      nom: 'Grand biscuit supplémentaire',
      court: 'Grand biscuit',
      categorie: 'biscuit-sup',
      prixMin: 700,
      prixMax: 800,
      aConfirmer: true,
      page: 'biscuits-personnalises.html',
      resume: 'Grand format, idéal pour les pièces principales ou les créations plus élaborées.'
    }
  ];

  var PAR_ID = {};
  ARTICLES.forEach(function (a) { PAR_ID[a.id] = a; });

  /* Champs demandés avant l'ajout au panier d'une micro-scénographie.
     Ils accompagnent l'article jusque dans la commande Stripe. */
  var CHAMPS_SCENOGRAPHIE = [
    { cle: 'date', libelle: 'Date souhaitée', type: 'date', requis: true },
    { cle: 'lieu', libelle: "Lieu de l'événement", type: 'text', requis: true,
      exemple: 'Ex. salle communale, Domdidier' },
    { cle: 'theme', libelle: 'Thème / couleurs', type: 'text', requis: true,
      exemple: 'Ex. thème licorne, rose poudré et doré' },
    { cle: 'options', libelle: 'Options éventuelles', type: 'text', requis: false,
      exemple: 'Ex. présentoir supplémentaire, tapis' },
    { cle: 'demandes', libelle: 'Demandes particulières', type: 'zone', requis: false,
      exemple: 'Contraintes de lieu, horaires, allergies…' }
  ];

  var MIN_BISCUITS = 12;
  var DEVISE = 'CHF';

  function article(id) { return PAR_ID[id] || null; }

  /* 59000 -> « 590 CHF » ; 7250 -> « 72.50 CHF ». */
  function formater(centimes) {
    var francs = centimes / 100;
    var texte = (francs % 1 === 0) ? String(francs) : francs.toFixed(2);
    return texte + ' ' + DEVISE;
  }

  function formaterFourchette(a) {
    if (a.aConfirmer) return formater(a.prixMin) + ' à ' + formater(a.prixMax);
    return (a.aPartirDe ? 'Dès ' : '') + formater(a.prix);
  }

  var API = {
    ARTICLES: ARTICLES,
    CHAMPS_SCENOGRAPHIE: CHAMPS_SCENOGRAPHIE,
    MIN_BISCUITS: MIN_BISCUITS,
    DEVISE: DEVISE,
    article: article,
    formater: formater,
    formaterFourchette: formaterFourchette
  };

  if (typeof module === 'object' && module.exports) module.exports = API;
  else racine.JCCatalogue = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
