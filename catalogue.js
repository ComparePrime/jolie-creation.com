/* ============================================================
   JOLIE CRÉATION — catalogue des articles achetables
   ------------------------------------------------------------
   Source unique de vérité, partagée par le navigateur et par la
   fonction serveur qui crée la session de paiement SumUp.
   Le serveur retarife TOUJOURS depuis ce fichier : les montants
   envoyés par le navigateur ne sont jamais pris pour argent
   comptant, sinon n'importe qui pourrait payer 1 CHF.

   Les montants sont en centimes (entiers) : additionner des
   francs en virgule flottante finit toujours par produire un
   72.49999999 quelque part. La conversion en francs n'a lieu
   qu'au tout dernier moment, face à SumUp qui attend des unités
   majeures.

   Seuls les biscuits s'achètent en ligne. Les micro-scénographies
   passent par une demande de devis : elles ne figurent donc pas
   dans ce catalogue.
   ============================================================ */
(function (racine) {
  'use strict';

  /* ------------------------------------------------------------
     TARIFS PROVISOIRES DES COLLECTIONS DU MOMENT
     ------------------------------------------------------------
     Ces trois montants sont des valeurs d'attente, posées pour que
     le parcours d'achat soit complet et testable. Ils ne viennent
     pas de Julie et DOIVENT être remplacés avant l'ouverture de la
     boutique, sans quoi un client paierait un prix inventé.

     Les remplacer ici suffit : les six articles de collection en
     découlent, les cartes de la page les affichent, et le serveur
     les refacture depuis ces mêmes valeurs. Passer ensuite le
     drapeau à false pour éteindre l'avertissement des tests.
     ------------------------------------------------------------ */
  var PRIX_COLLECTIONS_PROVISOIRES = true;
  var PRIX_COLLECTION = { 12: 6900, 18: 9900, 24: 12900 };

  /* Une collection = trois formats du même thème. */
  function collection(cle, nom, resume) {
    return [12, 18, 24].map(function (n) {
      return {
        id: 'collection-' + cle + '-' + n,
        nom: 'Collection ' + nom + ' — ' + n + ' biscuits',
        court: nom + ' · ' + n + ' biscuits',
        categorie: 'package-biscuits',
        collection: nom,
        prix: PRIX_COLLECTION[n],
        provisoire: PRIX_COLLECTIONS_PROVISOIRES,
        biscuits: n,
        modale: 'package',
        page: 'biscuits-personnalises.html',
        resume: resume
      };
    });
  }

  var ARTICLES = [
    /* ---------- Collections du moment ----------
       Pour changer de collection au fil des saisons : remplacer la
       clé, le nom et la phrase ci-dessous, puis les mêmes valeurs
       dans les cartes de biscuits-personnalises.html. */
    ]
    .concat(collection('halloween', 'Halloween',
      'Biscuits décorés aux couleurs d’Halloween, à partager le soir du 31 octobre ou à glisser dans les sacs des enfants.'))
    .concat(collection('cocooning', 'Cocooning',
      'Biscuits doux à offrir ou à garder pour soi, pensés pour les soirées d’automne et d’hiver.'))
    .concat([

    /* ---------- Packages disponibles toute l'année (12 biscuits) ---------- */
    {
      id: 'pack-ocean',
      nom: 'Package biscuits — Océan',
      court: 'Océan',
      categorie: 'package-biscuits',
      prix: 6900,
      aPartirDe: false,
      biscuits: 12,
      modale: 'package',
      page: 'biscuits-personnalises.html',
      resume: '7 biscuits personnalisés décorés et 5 petits biscuits simples, soit 12 biscuits.',
      composition: ['7 biscuits personnalisés, avec plusieurs détails et décorations', '5 petits biscuits simples']
    },
    {
      id: 'pack-pierre-lapin',
      nom: 'Package biscuits — Pierre Lapin',
      court: 'Pierre Lapin',
      categorie: 'package-biscuits',
      prix: 7700,
      aPartirDe: true,
      biscuits: 12,
      modale: 'package',
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
      modale: 'package',
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
      modale: 'package',
      page: 'biscuits-personnalises.html',
      resume: 'Package de 12 biscuits sur le thème Licorne.'
    },

    /* ---------- Biscuits supplémentaires ----------
       Ils ne constituent jamais une commande à eux seuls : ils se
       choisissent au moment d'ajouter un package ou une collection
       au panier et voyagent avec. Le minimum de 12 biscuits est
       donc garanti par la structure, pas par une règle à vérifier
       après coup.

       Tarifs fixes : le total d'une commande est donc entièrement
       calculable et entièrement payable en ligne. */
    {
      id: 'biscuit-petit',
      nom: 'Petit biscuit supplémentaire',
      court: 'Petit biscuit',
      categorie: 'biscuit-sup',
      prix: 450,
      page: 'biscuits-personnalises.html',
      resume: 'Petit format avec décoration simple.'
    },
    {
      id: 'biscuit-standard',
      nom: 'Biscuit standard supplémentaire',
      court: 'Biscuit standard',
      categorie: 'biscuit-sup',
      prix: 550,
      page: 'biscuits-personnalises.html',
      resume: 'Format classique, décor plus détaillé.'
    },
    {
      id: 'biscuit-grand',
      nom: 'Grand biscuit supplémentaire',
      court: 'Grand biscuit',
      categorie: 'biscuit-sup',
      prix: 750,
      page: 'biscuits-personnalises.html',
      resume: 'Grand format, idéal pour les pièces principales ou les créations plus élaborées.'
    }
  ]);

  var PAR_ID = {};
  ARTICLES.forEach(function (a) { PAR_ID[a.id] = a; });

  /* Seul champ demandé avec un package : les cartes annoncent le prénom
     et l'âge personnalisables, encore faut-il pouvoir les indiquer. */
  var CHAMP_PACKAGE = {
    cle: 'personnalisation',
    libelle: 'Prénom, âge ou précisions',
    type: 'text',
    requis: false,
    exemple: 'Ex. Léo, 4 ans'
  };

  /* Biscuits proposés en complément, dans l'ordre d'affichage. */
  var SUPPLEMENTS = ['biscuit-petit', 'biscuit-standard', 'biscuit-grand'];

  var MIN_BISCUITS = 12;
  var DEVISE = 'CHF';

  /* ---------- Réception de la commande ----------
     Deux chemins, volontairement différents :
       - livraison : adresse complète, paiement en ligne obligatoire ;
       - retrait   : canton de Fribourg, paiement sur place. */
  var RETRAIT_LIEU = 'Canton de Fribourg';
  var PAYS_LIVRAISON = ['Suisse', 'France', 'Allemagne', 'Italie', 'Autriche', 'Autre pays d’Europe'];
  /* L'ordre compte : la page pose ces champs deux par deux. La rue prend
     toute la largeur, le reste s'apparie. */
  var CHAMPS_LIVRAISON = [
    { cle: 'rue', libelle: 'Rue', type: 'text', requis: true, largeur: 'large', auto: 'address-line1' },
    { cle: 'numero', libelle: 'Numéro', type: 'text', requis: true, auto: 'address-line2' },
    { cle: 'npa', libelle: 'NPA / Code postal', type: 'text', requis: true, auto: 'postal-code' },
    { cle: 'ville', libelle: 'Ville', type: 'text', requis: true, auto: 'address-level2' },
    { cle: 'pays', libelle: 'Pays', type: 'select', requis: true, auto: 'country-name', options: PAYS_LIVRAISON }
  ];

  function article(id) { return PAR_ID[id] || null; }

  /* 6900 -> « 69 CHF » ; 7250 -> « 72.50 CHF ». */
  function formater(centimes) {
    var francs = centimes / 100;
    var texte = (francs % 1 === 0) ? String(francs) : francs.toFixed(2);
    return texte + ' ' + DEVISE;
  }

  function formaterPrix(a) {
    return (a.aPartirDe ? 'Dès ' : '') + formater(a.prix);
  }

  /* SumUp attend des unités majeures : 7250 centimes -> 72.50 francs.
     La division se fait une seule fois, ici, au bord de l'API. */
  function enFrancs(centimes) { return Math.round(centimes) / 100; }

  var API = {
    ARTICLES: ARTICLES,
    CHAMP_PACKAGE: CHAMP_PACKAGE,
    CHAMPS_LIVRAISON: CHAMPS_LIVRAISON,
    PAYS_LIVRAISON: PAYS_LIVRAISON,
    RETRAIT_LIEU: RETRAIT_LIEU,
    SUPPLEMENTS: SUPPLEMENTS,
    MIN_BISCUITS: MIN_BISCUITS,
    DEVISE: DEVISE,
    PRIX_COLLECTIONS_PROVISOIRES: PRIX_COLLECTIONS_PROVISOIRES,
    article: article,
    formater: formater,
    formaterPrix: formaterPrix,
    enFrancs: enFrancs
  };

  if (typeof module === 'object' && module.exports) module.exports = API;
  else racine.JCCatalogue = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
