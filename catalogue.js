/* ============================================================
   JOLIE CRÉATION — catalogue des biscuits
   ------------------------------------------------------------
   Source unique de vérité, partagée par le navigateur et par la
   fonction serveur qui crée la session de paiement SumUp.
   Le serveur retarife TOUJOURS depuis ce fichier : les montants
   envoyés par le navigateur ne sont jamais pris pour argent
   comptant, sinon n'importe qui pourrait payer 1 CHF.

   Les montants sont en centimes (entiers) : additionner des
   francs en virgule flottante finit toujours par produire un
   6.49999999 quelque part. La conversion en francs n'a lieu
   qu'au tout dernier moment, face à SumUp qui attend des unités
   majeures.

   Chaque biscuit se commande à l'unité, à son propre prix — sauf
   ceux des collections du moment, qui ne se vendent qu'en
   assortiments composés d'avance. Le minimum de douze biscuits
   porte sur les biscuits pris à l'unité, toutes collections
   confondues ; les packages n'y entrent pas et n'en dispensent pas.

   Seuls les biscuits s'achètent en ligne. Les micro-scénographies
   passent par une demande de devis, elles ne figurent pas ici.
   ============================================================ */
(function (racine) {
  'use strict';

  /* ------------------------------------------------------------
     AJOUTER UNE COLLECTION
     ------------------------------------------------------------
     1. Ajouter un bloc à COLLECTIONS ci-dessous : id (sans accent
        ni espace), nom, occasion, description, alt de l'image, et
        la liste des produits.
     2. Chaque produit porte une « ref » unique dans sa collection ;
        son identifiant complet devient « <id collection>-<ref> ».
        Ne jamais renommer une ref déjà en ligne : c'est elle qui
        relie un panier enregistré à son article.
     3. Le prix est en centimes. « perso » liste les informations à
        demander au client, parmi les clés de CHAMPS.
     4. Déposer la photo dans images/collections/<id>/principale.webp.
        Un PNG ou un JPEG déposé à la place se convertit avec
        outils-photos.py. Si le fichier manque, la carte affiche
        un cadre sobre : rien ne casse.
     5. « galerie » liste les autres vues du même assortiment, sous la
        grande photo. Les fichiers se dérivent du portfolio par
        outils-photos.py, qui écarte de lui-même une vue identique à la
        photo de carte. Une collection sans galerie n'affiche que sa
        grande photo : c'est un état normal, pas un manque à combler.
     6. « saison: true » remonte la collection dans « Les collections
        du moment », en tête de page. À retirer quand la saison passe :
        la collection redescend alors parmi les autres, sans rien
        perdre.
     Le reste — page, modale, panier, paiement — suit tout seul.

     Une collection dont « produits » est vide s'affiche mais ne
     s'achète pas : la page annonce que les modèles arrivent et
     renvoie vers le devis. Rien à désactiver ailleurs.
     ------------------------------------------------------------ */

  /* Informations demandées lorsqu'un biscuit est personnalisable.
     Définies une fois, réutilisées partout. */
  var CHAMPS = {
    prenom:   { cle: 'prenom',   libelle: 'Prénom',            type: 'texte', exemple: 'Ex. Léa', max: 30 },
    age:      { cle: 'age',      libelle: 'Âge ou chiffre',    type: 'texte', exemple: 'Ex. 4',   max: 10 },
    texte:    { cle: 'texte',    libelle: 'Texte à inscrire',  type: 'texte', exemple: 'Ex. Merci Maîtresse', max: 40 },
    date:     { cle: 'date',     libelle: 'Date',              type: 'texte', exemple: 'Ex. 14 juin 2026', max: 30 },
    initiale: { cle: 'initiale', libelle: 'Initiale',          type: 'texte', exemple: 'Ex. L',   max: 4 },
    couleur:  { cle: 'couleur',  libelle: 'Coloris',           type: 'choix', options: ['Rose', 'Bleu'] }
  };

  var COLLECTIONS = [
    {
      "id": "automne",
      "nom": "Automne",
      "occasion": "Automne",
      "saison": true,
      "description": "Une collection aux teintes de saison : terracotta, orange brûlé, blanc cassé et éclats dorés. Feuilles d’érable nervurées, citrouilles, tasses fumantes et petits feuillages, tous décorés à la main au glaçage royal. Elle se commande en assortiment prêt à offrir.",
      "alt": "Assortiment de biscuits d’automne décorés à la main : feuilles d’érable, citrouilles et tasses sur un set en fibre naturelle",
      "galerie": [
        { "fichier": "vue-1.webp", "alt": "Feuilles d’érable en biscuit, l’une terracotta mouchetée d’or, l’autre blanche nervurée" },
        { "fichier": "vue-2.webp", "alt": "Biscuit tasse terracotta surmonté d’une citrouille, entouré de citrouilles orange et de feuillages" },
        { "fichier": "vue-3.webp", "alt": "Biscuit tasse d’automne au glaçage crème, citrouille et feuillage orange en premier plan" },
        { "fichier": "vue-4.webp", "alt": "Biscuit plaque effet tricot crème posé près d’une tasse terracotta et de feuillages d’automne" },
        { "fichier": "vue-5.webp", "alt": "Feuille d’érable blanche mouchetée d’or et feuillages orange sur un set tressé" },
        { "fichier": "vue-6.webp", "alt": "Biscuit tasse terracotta à la citrouille orange, vu de près, avec un feuillage d’automne" }
      ],
      "packagesResume": "Une sélection de biscuits aux couleurs douces et chaleureuses de la saison.",
      "packages": [
        { "ref": "essentiel", "nom": "L’Essentiel", "prix": 3290,
          "resume": "De quoi goûter à la collection : un de chaque, sans se décider.",
          "composition": [
            { "ref": "feuille-blanche", "qte": 1 },
            { "ref": "mug", "qte": 1 },
            { "ref": "branche", "qte": 1 },
            { "ref": "citrouille", "qte": 1 },
            { "ref": "citrouilles-empilees", "qte": 1 }
          ] },
        { "ref": "gourmande", "nom": "La Gourmande", "prix": 4490,
          "resume": "Les deux feuilles, deux mugs et le grand pull : de quoi garnir une table.",
          "composition": [
            { "ref": "feuille-blanche", "qte": 1 },
            { "ref": "feuille-orange", "qte": 1 },
            { "ref": "mug", "qte": 2 },
            { "ref": "branche", "qte": 1 },
            { "ref": "citrouille", "qte": 1 },
            { "ref": "grand-pull", "qte": 1 }
          ] },
        { "ref": "complete", "nom": "L’Automne Complète", "prix": 6490,
          "complet": true, "horsSuisse": true,
          "resume": "Toute la collection, dans ses deux coloris.",
          "composition": [
            { "ref": "feuille-blanche", "qte": 1 },
            { "ref": "feuille-orange", "qte": 1 },
            { "ref": "mug", "qte": 2 },
            { "ref": "branche", "qte": 2 },
            { "ref": "citrouille", "qte": 2 },
            { "ref": "citrouilles-empilees", "qte": 1 },
            { "ref": "grand-pull", "qte": 1 }
          ] }
      ],
      "produits": [
        { "ref": "feuille-blanche", "nom": "Grande feuille blanche", "prix": 700 },
        { "ref": "feuille-orange", "nom": "Grande feuille orange", "prix": 700 },
        { "ref": "mug", "nom": "Mug", "prix": 700 },
        { "ref": "branche", "nom": "Petite branche", "prix": 500 },
        { "ref": "citrouille", "nom": "Citrouille", "prix": 400 },
        { "ref": "citrouilles-empilees", "nom": "Citrouilles empilées", "prix": 650 },
        { "ref": "grand-pull", "nom": "Grand pull", "prix": 800 }
      ]
    },
    {
      "id": "magie-noel",
      "nom": "Magie de Noël",
      "occasion": "Noël",
      "description": "Une collection de biscuits aux couleurs chaleureuses et intemporelles de Noël : rouge profond, vert sapin, blanc et petites touches dorées. Entre chaussettes de Noël, sapins, boules scintillantes, flocons et Père Noël, chaque modèle est décoré à la main pour apporter une touche gourmande aux fêtes. Idéale pour offrir, décorer une table de Noël ou composer un joli coffret gourmand.",
      "alt": "Biscuits de Noël personnalisés décorés à la main : sapins, flocons et boules dorées",
      "produits": [
        { "ref": "sucre-orge", "nom": "Sucre d’orge rouge", "prix": 500 },
        { "ref": "flocon-blanc", "nom": "Flocon blanc simple", "prix": 500 },
        { "ref": "cadeau-feuillage", "nom": "Cadeau de Noël avec feuillage", "prix": 500 },
        { "ref": "chaussette", "nom": "Petite chaussette de Noël", "prix": 550 },
        { "ref": "moufle", "nom": "Moufle effet tricot", "prix": 550 },
        { "ref": "rond-rouge-flocon", "nom": "Biscuit rond rouge – flocon blanc", "prix": 550 },
        { "ref": "sapin", "nom": "Sapin de Noël décoré", "prix": 550 },
        { "ref": "couronne", "nom": "Couronne de Noël ronde", "prix": 600 },
        { "ref": "boule-rouge", "nom": "Boule de Noël rouge pailletée", "prix": 600 },
        { "ref": "rond-vert-flocon", "nom": "Biscuit rond vert – grand flocon", "prix": 600 },
        { "ref": "plaque-verte", "nom": "Plaque verte avec boules de Noël en relief", "prix": 600 },
        { "ref": "pain-epices", "nom": "Bonhomme pain d’épices", "prix": 650 },
        { "ref": "ho-ho-ho", "nom": "« Ho Ho Ho » en relief", "prix": 650 },
        { "ref": "boule-neige", "nom": "Boule à neige avec sapins", "prix": 650 },
        { "ref": "pere-noel", "nom": "Père Noël détaillé", "prix": 700 },
        { "ref": "joyeux-noel", "nom": "Grand biscuit « Joyeux Noël »", "prix": 700 }
      ]
    },
    {
      "id": "frissons-halloween",
      "nom": "Frissons d’Halloween",
      "occasion": "Halloween",
      "saison": true,
      "description": "Une collection à la fois effrayante et adorable pour célébrer Halloween. Entre citrouilles, petit fantôme, squelette, toile d’araignée et personnages rigolos, chaque biscuit est décoré à la main dans des teintes orange, violet, noir et blanc. Parfaite pour une fête d’Halloween, un goûter d’enfants ou une jolie box gourmande.",
      "alt": "Biscuits d’Halloween personnalisés : citrouilles, fantôme et toile d’araignée",
      "galerie": [
        { "fichier": "vue-1.webp", "alt": "Biscuit « Boo » violet à l’araignée, fantôme aux grands yeux et chauve-souris lilas sur fond de fleurs séchées" },
        { "fichier": "vue-2.webp", "alt": "Squelette détaillé, courge orange aux grands yeux, fantôme et chauve-souris violette décorés à la main" },
        { "fichier": "vue-3.webp", "alt": "Toile d’araignée, « Boo » violet et orange, crâne blanc et citrouille au glaçage royal" }
      ],
      "packagesResume": "Une sélection de biscuits d’Halloween, entre l’effrayant et l’adorable.",
      "packages": [
        { "ref": "essentiel", "nom": "L’Essentiel", "prix": 3290,
          "resume": "Les incontournables de la collection, un de chaque.",
          "composition": [
            { "ref": "citrouille", "qte": 1 },
            { "ref": "crane", "qte": 1 },
            { "ref": "boo-violet", "qte": 1 },
            { "ref": "toile-araignee", "qte": 1 },
            { "ref": "fantome", "qte": 1 }
          ] },
        { "ref": "gourmande", "nom": "La Gourmande", "prix": 4490,
          "resume": "Les deux « Boo », violet et orange, et de quoi garnir une table.",
          "composition": [
            { "ref": "citrouille", "qte": 2 },
            { "ref": "crane", "qte": 1 },
            { "ref": "boo-violet", "qte": 1 },
            { "ref": "boo-orange", "qte": 1 },
            { "ref": "toile-araignee", "qte": 1 },
            { "ref": "fantome", "qte": 1 }
          ] },
        { "ref": "complete", "nom": "Frissons d’Halloween", "prix": 6490,
          "complet": true, "horsSuisse": true,
          "resume": "Toute la collection, squelette et courge compris.",
          "composition": [
            { "ref": "citrouille", "qte": 3 },
            { "ref": "crane", "qte": 1 },
            { "ref": "boo-violet", "qte": 1 },
            { "ref": "boo-orange", "qte": 1 },
            { "ref": "squelette", "qte": 1 },
            { "ref": "chauve-souris", "qte": 1 },
            { "ref": "toile-araignee", "qte": 1 },
            { "ref": "fantome", "qte": 1 },
            { "ref": "courge-yeux", "qte": 1 }
          ] }
      ],
      "produits": [
        { "ref": "citrouille", "nom": "Citrouille", "prix": 400 },
        { "ref": "crane", "nom": "Crâne", "prix": 400 },
        { "ref": "courge-yeux", "nom": "Courge avec des yeux", "prix": 500 },
        { "ref": "boo-violet", "nom": "Boo violet", "prix": 600 },
        { "ref": "boo-orange", "nom": "Boo orange", "prix": 600 },
        { "ref": "toile-araignee", "nom": "Toile d’araignée", "prix": 600 },
        { "ref": "fantome", "nom": "Fantôme", "prix": 600 },
        { "ref": "chauve-souris", "nom": "Chauve-souris", "prix": 650 },
        { "ref": "squelette", "nom": "Squelette", "prix": 850 }
      ]
    },
    {
      "id": "douceurs-paques",
      "nom": "Douceurs de Pâques",
      "occasion": "Pâques",
      "description": "Une collection tendre et colorée pour célébrer Pâques et l’arrivée du printemps. Petits poussins personnalisés, lapin, œufs fleuris, marguerites et carotte se déclinent dans de jolies teintes pastel. Les biscuits peuvent être personnalisés avec un prénom ou un petit message, pour créer un assortiment unique à offrir ou à partager en famille.",
      "alt": "Biscuits de Pâques décorés à la main : lapin, œufs fleuris et marguerites pastel",
      "produits": [
        { "ref": "lapin-dos", "nom": "Petit lapin de dos", "prix": 500 },
        { "ref": "marguerite", "nom": "Marguerite simple", "prix": 500 },
        { "ref": "carotte", "nom": "Carotte", "prix": 500 },
        { "ref": "oeuf-fleuri", "nom": "Œuf fleuri", "prix": 550 },
        { "ref": "oeuf-marbre", "nom": "Œuf effet marbré multicolore", "prix": 550 },
        { "ref": "grande-marguerite", "nom": "Grande marguerite avec feuilles", "prix": 600 },
        { "ref": "poussin-prenom", "nom": "Poussin avec œuf personnalisé au prénom", "prix": 700, "perso": ["prenom"] },
        { "ref": "oreilles-lapin", "nom": "Oreilles de lapin avec œufs de Pâques", "prix": 700 },
        { "ref": "joyeuses-paques", "nom": "Grand biscuit festonné « Joyeuses Pâques »", "prix": 800 }
      ]
    },
    {
      "id": "merci-maitresse",
      "nom": "Merci Maîtresse – Bonnes Vacances",
      "occasion": "Fin d’année scolaire",
      "description": "Une collection colorée et pleine de bonne humeur pour remercier la maîtresse ou le maître en fin d’année scolaire. Crayons rigolos, petites feuilles de cahier, avions en papier et ardoises composent une jolie attention gourmande pour souhaiter de belles vacances. Les inscriptions peuvent être personnalisées : Merci Maîtresse, Merci Maître, prénom de l’enseignant ou de l’enfant.",
      "alt": "Biscuits personnalisés pour remercier la maîtresse en fin d’année scolaire",
      "produits": [
        { "ref": "avion", "nom": "Avion en papier « Bonnes vacances ! »", "prix": 600, "perso": ["texte"] },
        { "ref": "feuille-cahier", "nom": "Feuille de cahier « Merci Maîtresse »", "prix": 600, "perso": ["texte"] },
        { "ref": "ardoise", "nom": "Ardoise « Bonnes vacances » avec cadre effet bois", "prix": 650, "perso": ["texte"] },
        { "ref": "crayon", "nom": "Crayon personnage avec lunettes et détails en relief", "prix": 650 }
      ]
    },
    {
      "id": "bonne-fete-maman",
      "nom": "Bonne fête Maman",
      "occasion": "Fête des mères",
      "description": "Une collection douce et fleurie imaginée pour célébrer les mamans avec une petite attention gourmande. Des marguerites aux détails en relief accompagnées de jolis cœurs personnalisés, dans des tons blanc, rose et vert. Une collection idéale pour la Fête des Mères, qui peut également être personnalisée avec un prénom ou un petit message.",
      "alt": "Biscuits personnalisés pour la fête des mères : marguerites et cœurs en relief",
      "galerie": [
        { "fichier": "vue-1.webp", "alt": "Biscuit cœur « Bonne fête Maman » et grande marguerite blanche" },
        { "fichier": "vue-2.webp", "alt": "Biscuits marguerites et cœurs calligraphiés pour la fête des mères" }
      ],
      "produits": [
        { "ref": "coeur-maman", "nom": "Cœur « Bonne fête Maman » avec inscription personnalisée", "prix": 600, "perso": ["texte"] },
        { "ref": "marguerite-relief", "nom": "Grande marguerite avec feuilles et détails en relief", "prix": 700 }
      ]
    },
    {
      "id": "bapteme-douceur",
      "nom": "Baptême Douceur",
      "occasion": "Baptême",
      "description": "Une collection délicate et naturelle imaginée pour célébrer un baptême tout en élégance. Dans des tons blanc, vert sauge et doré, ce biscuit est personnalisé avec le prénom de l’enfant et la date du baptême, accompagné de feuillages en relief et d’un petit cœur doré. Il peut également être adapté aux couleurs choisies pour l’événement.",
      "alt": "Biscuits de baptême personnalisés au prénom, feuillages en relief et cœur doré",
      "produits": [
        { "ref": "grand-bapteme", "nom": "Grand biscuit personnalisé « Baptême », prénom et date, feuillages en relief et cœur doré", "prix": 700, "perso": ["prenom", "date"] }
      ]
    },
    {
      "id": "annonce-grossesse",
      "nom": "Annonce de grossesse",
      "occasion": "Annonce de grossesse",
      "description": "Une collection douce et élégante imaginée pour annoncer l’arrivée d’un bébé d’une façon originale et gourmande. Dans des tons ivoire, beige et doré, les biscuits peuvent être personnalisés avec le nom de famille, la date prévue de naissance ou un petit message. Une jolie attention pour annoncer une grossesse aux futurs grands-parents, à la famille ou aux proches.",
      "alt": "Biscuits d’annonce de grossesse personnalisés dans des tons ivoire et doré",
      "galerie": [
        { "fichier": "vue-1.webp", "alt": "Biscuit calendrier de décembre, date entourée d’un cœur doré" },
        { "fichier": "vue-2.webp", "alt": "Biscuit illustré d’un visage au trait et d’un petit cœur rouge" },
        { "fichier": "vue-3.webp", "alt": "Biscuits cœurs ivoire mouchetés d’or autour du biscuit calendrier" }
      ],
      "produits": [
        { "ref": "petit-coeur", "nom": "Petit cœur effet moucheté doré", "prix": 400 },
        { "ref": "coeur-moyen", "nom": "Cœur moyen effet moucheté doré", "prix": 500 },
        { "ref": "coeur-bebe", "nom": "Cœur « Bébé » ou texte personnalisé avec cœur doré", "prix": 600, "perso": ["texte"] },
        { "ref": "femme-enceinte", "nom": "Grand biscuit femme enceinte, illustration dessinée à la main", "prix": 700 },
        { "ref": "calendrier", "nom": "Calendrier personnalisé avec mois, année et date mise en évidence", "prix": 700, "perso": ["date"] }
      ]
    },
    {
      "id": "douceur-personnalisee",
      "nom": "Douceur personnalisée",
      "occasion": "Anniversaire",
      "description": "Une collection douce et élégante dans des tons rose poudré, blanc et doré, parfaite pour célébrer un anniversaire tout en délicatesse. Le biscuit prénom apporte une jolie touche personnalisée, tandis que le chiffre assorti permet d’adapter la collection à chaque âge. Les couleurs, le prénom et le chiffre peuvent être personnalisés.",
      "alt": "Biscuits d’anniversaire personnalisés au prénom, rose poudré et doré",
      "produits": [
        { "ref": "chiffre", "nom": "Grand chiffre personnalisé avec petits détails en relief", "prix": 600, "perso": ["age"] },
        { "ref": "nuage-prenom", "nom": "Biscuit nuage avec prénom personnalisé, petit nœud et finition dorée", "prix": 650, "perso": ["prenom"] }
      ]
    },
    {
      "id": "girls-club",
      "nom": "Girls Club – EVJF",
      "occasion": "EVJF",
      "description": "Une collection pétillante et féminine imaginée pour célébrer un enterrement de vie de jeune fille entre copines. Des biscuits personnalisés parfaits pour compléter une table, un brunch ou un petit cadeau souvenir pour chaque participante. Les couleurs et inscriptions peuvent être adaptées au thème de l’EVJF.",
      "alt": "Biscuits personnalisés pour un EVJF, inscription en relief et contour travaillé",
      "produits": [
        { "ref": "the-girls-club", "nom": "Biscuit « The Girls Club » avec inscription en relief et contour travaillé", "prix": 600, "option": { "supplement": 50, "libelle": "Personnaliser avec le prénom de la future mariée ou la date de l’EVJF", "perso": ["texte"] } }
      ]
    },
    {
      "id": "american-road-trip",
      "nom": "American Road Trip",
      "occasion": "Anniversaire",
      "description": "Une collection aux couleurs des États-Unis, inspirée de la mythique Route 66, de New York et de l’univers américain : pick-up vintage, football américain, cowboy et détails personnalisés. Une collection idéale pour un anniversaire ou une fête sur le thème USA, personnalisable avec le prénom et l’âge.",
      "alt": "Biscuits personnalisés sur le thème des États-Unis et de la Route 66",
      "produits": [
        { "ref": "poche-jean", "nom": "Poche de jean personnalisée avec prénom", "prix": 600, "perso": ["prenom"] },
        { "ref": "drapeau", "nom": "Drapeau américain en relief", "prix": 600 },
        { "ref": "route-66", "nom": "Écusson Route 66", "prix": 600 },
        { "ref": "burger", "nom": "Burger et frites en relief", "prix": 600 },
        { "ref": "etoile-cowboy", "nom": "Étoile avec chapeau de cowboy", "prix": 600 },
        { "ref": "i-love-ny", "nom": "« I love NY »", "prix": 600 },
        { "ref": "botte-cowboy", "nom": "Botte de cowboy USA", "prix": 600 },
        { "ref": "casque-football", "nom": "Casque de football américain", "prix": 600 },
        { "ref": "ballon-football", "nom": "Ballon de football américain", "prix": 600 },
        { "ref": "maillot", "nom": "Maillot personnalisé, prénom et âge", "prix": 650, "perso": ["prenom", "age"] },
        { "ref": "happy-birthday", "nom": "« Happy Birthday » personnalisé", "prix": 650, "perso": ["prenom"] },
        { "ref": "pick-up", "nom": "Pick-up américain vintage", "prix": 700 }
      ]
    },
    {
      "id": "petit-chantier",
      "nom": "Petit Chantier",
      "occasion": "Anniversaire enfant",
      "description": "Une collection pleine d’énergie pour les petits passionnés de chantier et de gros engins, dans les incontournables tons jaune, noir, gris et orange. Personnalisable avec le prénom et l’âge de l’enfant pour un anniversaire sur le thème de la construction.",
      "alt": "Biscuits d’anniversaire sur le thème du chantier : pelleteuse, grue et casque",
      "galerie": [
        { "fichier": "vue-1.webp", "alt": "Biscuit cône de chantier orange et plaque au prénom Mathéo" },
        { "fichier": "vue-2.webp", "alt": "Biscuit casque de chantier jaune décoré au glaçage royal" },
        { "fichier": "vue-3.webp", "alt": "Biscuit pelleteuse jaune et biscuit chiffre 1 rayé noir et jaune" },
        { "fichier": "vue-4.webp", "alt": "Biscuit camion benne jaune chargé de gravats en glaçage" },
        { "fichier": "vue-5.webp", "alt": "Biscuits de chantier assortis : plaque au prénom, cône et panneau d’anniversaire" },
        { "fichier": "vue-6.webp", "alt": "Biscuit grue jaune et chiffre 1 rayé, décorés à la main" },
        { "fichier": "vue-7.webp", "alt": "Plaque de chantier en biscuit, prénom Mathéo en lettres rouges" }
      ],
      "produits": [
        { "ref": "cone", "nom": "Cône de signalisation", "prix": 500 },
        { "ref": "barriere", "nom": "Barrière de chantier", "prix": 500 },
        { "ref": "casque", "nom": "Casque de chantier", "prix": 500 },
        { "ref": "chiffre-grue", "nom": "Chiffre personnalisé avec grue", "prix": 600, "perso": ["age"] },
        { "ref": "pelleteuse", "nom": "Pelleteuse", "prix": 700 },
        { "ref": "camion-benne", "nom": "Camion-benne avec gravier", "prix": 700 },
        { "ref": "panneau-anniversaire", "nom": "Panneau « Joyeux anniversaire » avec grue", "prix": 700 },
        { "ref": "rond-raye-prenom", "nom": "Grand biscuit rond rayé jaune et noir avec plaque prénom personnalisée", "prix": 700, "perso": ["prenom"] },
        { "ref": "pelleteuse-detaillee", "nom": "Pelleteuse détaillée avec gravier", "prix": 700 }
      ]
    },
    {
      "id": "passion-cheval",
      "nom": "Passion Cheval",
      "occasion": "Anniversaire enfant",
      "description": "Une collection tendre et élégante inspirée de l’univers équestre, dans des nuances de rose poudré, blanc, beige et brun. Personnalisable avec le prénom et l’âge de l’enfant, idéale pour les petits passionnés de chevaux.",
      "alt": "Biscuits décorés sur le thème du cheval : fer à cheval, bottes et tête de cheval",
      "galerie": [
        { "fichier": "vue-1.webp", "alt": "Biscuits tête de cheval, cœur au prénom Emily et marguerite en glaçage royal" },
        { "fichier": "vue-2.webp", "alt": "Biscuit cœur au prénom Emily et biscuit fer à cheval tacheté" },
        { "fichier": "vue-3.webp", "alt": "Biscuit selle d’équitation et marguerite blanche, finitions dorées" },
        { "fichier": "vue-4.webp", "alt": "Biscuit cœur vichy rose au prénom Emily, marguerite et tête de cheval" }
      ],
      "produits": [
        { "ref": "petite-fleur", "nom": "Petite fleur blanche et rose", "prix": 400 },
        { "ref": "coeur-vichy", "nom": "Cœur vichy rose avec prénom", "prix": 550, "perso": ["prenom"] },
        { "ref": "etoile-fer", "nom": "Étoile avec fer à cheval", "prix": 600 },
        { "ref": "etoile-chapeau", "nom": "Étoile avec chapeau de cowboy et nœud", "prix": 600 },
        { "ref": "bottes", "nom": "Biscuit rose avec bottes d’équitation", "prix": 600 },
        { "ref": "chiffre-taches", "nom": "Chiffre personnalisé effet taches de cheval", "prix": 600, "perso": ["age"] },
        { "ref": "chiffre-etoiles", "nom": "Chiffre personnalisé rose avec étoiles", "prix": 600, "perso": ["age"] },
        { "ref": "tete-cheval", "nom": "Tête de cheval sur biscuit festonné", "prix": 700 },
        { "ref": "coeur-cheval", "nom": "Grand biscuit cœur cheval avec prénom et âge", "prix": 800, "perso": ["prenom", "age"] },
        { "ref": "noeud-rose", "nom": "Nœud rose", "prix": 500 }
      ]
    },
    {
      "id": "petit-ocean",
      "nom": "Petit Océan",
      "occasion": "Anniversaire enfant",
      "description": "Une collection pleine de douceur inspirée des fonds marins, dans de jolies nuances de bleu, turquoise, corail et vert. Personnalisable avec le prénom et l’âge de l’enfant, parfaite pour un anniversaire sur le thème de la mer.",
      "alt": "Biscuits personnalisés thème océan : baleine, tortue marine et étoiles de mer",
      "galerie": [
        { "fichier": "vue-1.webp", "alt": "Biscuit nuage bleu au prénom Léo, entouré d’algues et d’étoiles de mer" },
        { "fichier": "vue-2.webp", "alt": "Biscuit chiffre 4 bleu décoré de bulles, d’algues vertes et d’une étoile de mer corail" },
        { "fichier": "vue-3.webp", "alt": "Biscuit baleine bleue posée sur une vague, décoré au glaçage royal" },
        { "fichier": "vue-4.webp", "alt": "Biscuits tortues de mer bleue et verte, décorés à la main" },
        { "fichier": "vue-5.webp", "alt": "Biscuit hippocampe bleu finement pointillé au glaçage" },
        { "fichier": "vue-6.webp", "alt": "Biscuit coquillage bleu pâle et biscuit corail orange sur le thème de la mer" }
      ],
      "produits": [
        { "ref": "etoile-orange", "nom": "Étoile de mer orange", "prix": 400 },
        { "ref": "etoile-bleue", "nom": "Étoile de mer bleue décorée", "prix": 400 },
        { "ref": "coquillage", "nom": "Coquillage bleu", "prix": 600 },
        { "ref": "corail", "nom": "Corail orange en relief", "prix": 600 },
        { "ref": "baleine", "nom": "Baleine détaillée", "prix": 700 },
        { "ref": "tortue", "nom": "Tortue marine détaillée", "prix": 700 },
        { "ref": "hippocampe", "nom": "Hippocampe détaillé", "prix": 700 },
        { "ref": "chiffre-corail", "nom": "Chiffre personnalisé avec corail et végétation", "prix": 650, "perso": ["age"] },
        { "ref": "prenom-etoile", "nom": "Prénom avec étoile et végétation marine", "prix": 650, "perso": ["prenom"] }
      ]
    },
    {
      "id": "reve-licorne",
      "nom": "Rêve de Licorne",
      "occasion": "Anniversaire enfant",
      "description": "Une collection féerique et délicate aux nuances de rose poudré, blanc et lilas, sublimée par de fines touches dorées. Personnalisable avec le prénom et l’âge de l’enfant pour un anniversaire tout en douceur.",
      "alt": "Biscuits décorés thème licorne, rose poudré, lilas et touches dorées",
      "galerie": [
        { "fichier": "vue-1.webp", "alt": "Biscuit licorne à la crinière lilas et à la corne dorée, sur assiette rose poudré" },
        { "fichier": "vue-2.webp", "alt": "Tête de licorne en glaçage blanc près d’un biscuit rose poudré à pois dorés" },
        { "fichier": "vue-3.webp", "alt": "Biscuits nuages au prénom Eileen calligraphié à l’or, posés près d’un biscuit nœud" },
        { "fichier": "vue-4.webp", "alt": "Biscuit licorne et biscuit nœud ruban doré sur fond rose poudré" },
        { "fichier": "vue-5.webp", "alt": "Biscuit nœud doré et licorne blanche à la crinière lilas" },
        { "fichier": "vue-6.webp", "alt": "Biscuit nuage au prénom Eileen, nœud rubané doré et licorne en arrière-plan" },
        { "fichier": "vue-7.webp", "alt": "Deux biscuits nuages au prénom Eileen, calligraphie dorée sur glaçage blanc" }
      ],
      "produits": [
        { "ref": "chiffre-pois", "nom": "Chiffre personnalisé rose à pois", "prix": 500, "perso": ["age"] },
        { "ref": "noeud-dore", "nom": "Grand nœud rose et doré", "prix": 600 },
        { "ref": "licorne", "nom": "Licorne avec crinière rose, violette et dorée", "prix": 800 },
        { "ref": "nuage-prenom", "nom": "Nuage avec prénom et petit nœud", "prix": 600, "perso": ["prenom"] }
      ]
    },
    {
      "id": "petite-oie",
      "nom": "Petite Oie",
      "occasion": "Premier anniversaire",
      "description": "Une collection douce et champêtre aux tons naturels, entièrement personnalisable pour un premier anniversaire, un anniversaire ou une baby shower.",
      "alt": "Biscuits personnalisés thème petite oie sur fond vichy, tons naturels",
      "produits": [
        { "ref": "ballons-etiquette", "nom": "Ballons avec étiquette au prénom", "prix": 600, "perso": ["prenom"] },
        { "ref": "rectangle-vichy", "nom": "Rectangle vichy avec prénom", "prix": 500, "perso": ["prenom"] },
        { "ref": "one", "nom": "Biscuit festonné « One »", "prix": 500 },
        { "ref": "oie-vichy", "nom": "Oie sur fond vichy avec fleurs", "prix": 700 },
        { "ref": "petite-marguerite", "nom": "Petite marguerite blanche", "prix": 400 },
        { "ref": "arche-oie", "nom": "Grand biscuit arche avec oie et ballons", "prix": 800 },
        { "ref": "chiffre-fleur", "nom": "Chiffre personnalisé avec fleur", "prix": 600, "perso": ["age"] },
        { "ref": "grande-marguerite", "nom": "Grande marguerite blanche", "prix": 500 }
      ]
    },
    {
      "id": "petit-lapin-jardin",
      "nom": "Petit Lapin au Jardin",
      "occasion": "Anniversaire enfant",
      "description": "Une collection douce et champêtre inspirée de l’univers du petit lapin et de son potager, dans de jolies nuances de bleu, beige, orange et vert tendre. Personnalisable avec l’initiale, le prénom ou l’âge de l’enfant, parfaite pour un anniversaire, un baptême ou une baby shower.",
      "alt": "Biscuits personnalisés thème petit lapin au jardin, tons bleu et vert tendre",
      "galerie": [
        { "fichier": "vue-1.webp", "alt": "Biscuit ovale à l’initiale G bleue, entouré de carottes et de marguerites" },
        { "fichier": "vue-2.webp", "alt": "Biscuit lapin en veste bleue, carotte et marguerite décorés à la main" }
      ],
      "produits": [
        { "ref": "fleur-bleue", "nom": "Petite fleur blanche et bleue", "prix": 400 },
        { "ref": "carotte", "nom": "Carotte", "prix": 500 },
        { "ref": "medaillon-initiale", "nom": "Médaillon festonné avec initiale et couronne végétale", "prix": 650, "perso": ["initiale"] },
        { "ref": "petit-lapin", "nom": "Petit lapin debout avec veste bleue", "prix": 700 },
        { "ref": "grand-lapin", "nom": "Grand lapin peint à la main avec veste bleue", "prix": 800 }
      ]
    },
    {
      "id": "gender-reveal",
      "nom": "Gender Reveal",
      "occasion": "Gender reveal",
      "description": "Une collection pleine de tendresse pour célébrer une gender reveal. Des petits oursons, montgolfières, empreintes et accessoires de bébé déclinés dans de doux tons rose poudré, bleu ciel, blanc et brun.",
      "alt": "Biscuits personnalisés pour une gender reveal, tons rose poudré et bleu ciel",
      "produits": [
        { "ref": "branche", "nom": "Branche feuillue", "prix": 500, "perso": ["couleur"] },
        { "ref": "guirlande", "nom": "Guirlande « Boy » ou « Girl »", "prix": 500, "perso": ["couleur"] },
        { "ref": "tenue-bebe", "nom": "Tenue de bébé", "prix": 600, "perso": ["couleur"] },
        { "ref": "montgolfiere", "nom": "Montgolfière avec petit ourson", "prix": 600, "perso": ["couleur"] },
        { "ref": "bavoir", "nom": "Bavoir avec petit ourson", "prix": 600, "perso": ["couleur"] },
        { "ref": "empreinte", "nom": "Empreinte de pied", "prix": 500, "perso": ["couleur"] },
        { "ref": "ourson", "nom": "Grand ourson avec nœud", "prix": 700, "perso": ["couleur"] },
        { "ref": "coeur-simple", "nom": "Cœur simple", "prix": 500, "perso": ["couleur"] }
      ]
    },
    {
      "id": "saint-valentin",
      "nom": "Saint-Valentin",
      "occasion": "Saint-Valentin",
      "description": "Une collection douce et romantique autour de l’amour, composée de cœurs aux différentes formes et dimensions, d’une enveloppe cachetée et d’un biscuit « Love ». Déclinée dans des tons blanc, rose et framboise, elle est parfaite pour la Saint-Valentin, une demande spéciale, un mariage ou simplement pour offrir un petit message d’amour.",
      "alt": "Biscuits de Saint-Valentin décorés à la main : cœurs, enveloppe et « Love »",
      "produits": [
        { "ref": "petit-coeur", "nom": "Petit cœur simple", "prix": 400 },
        { "ref": "coeur-moyen", "nom": "Cœur moyen simple", "prix": 500 },
        { "ref": "enveloppe", "nom": "Enveloppe blanche avec petit cœur en relief", "prix": 600 },
        { "ref": "love", "nom": "Écriture « Love » en relief", "prix": 600 }
      ]
    },
    {
      "id": "dolce-vita",
      "nom": "Dolce Vita",
      "occasion": "Anniversaire",
      "description": "Une collection lumineuse et raffinée inspirée de l’Italie et de la douceur de vivre méditerranéenne. Citrons, feuillages, faïences aux motifs bleus et petites touches personnalisées composent un univers frais et élégant, idéal pour un anniversaire adulte, une fête estivale ou une célébration sur le thème de l’Italie.",
      "alt": "Biscuits artisanaux thème Dolce Vita et Italie : citrons et faïences bleues",
      "produits": [
        { "ref": "citron", "nom": "Petit citron simple texturé", "prix": 400 },
        { "ref": "rond-citron", "nom": "Rond citron façon tranche", "prix": 500 },
        { "ref": "branche", "nom": "Petite branche et feuillage vert et blanc", "prix": 500 },
        { "ref": "carreau", "nom": "Petit carreau de faïence bleu et jaune", "prix": 500 },
        { "ref": "carreau-citron", "nom": "Carreau de faïence avec citron en relief", "prix": 550 },
        { "ref": "branche-citrons", "nom": "Branche avec citrons et feuillages en relief", "prix": 600 },
        { "ref": "aperol", "nom": "Biscuit « Aperol Spritz »", "prix": 650 },
        { "ref": "prenom", "nom": "Biscuit personnalisé avec prénom", "prix": 650, "perso": ["prenom"] },
        { "ref": "limoncello", "nom": "Biscuit « Limoncello » avec citrons en relief", "prix": 700 },
        { "ref": "buon-compleanno", "nom": "Grand biscuit « Buon compleanno » avec citrons et feuillages", "prix": 700 },
        { "ref": "age-citrons", "nom": "Grand biscuit âge avec citrons et fleurs", "prix": 700, "perso": ["age"] }
      ]
    },
    {
      "id": "moto",
      "nom": "Moto",
      "occasion": "Anniversaire",
      "description": "Une collection dynamique pour les passionnés de moto, de vitesse et d’aventure. Entre circuits, drapeaux à damier, casques et panneaux de voyage, chaque biscuit peut être personnalisé avec le prénom, l’âge et un petit message pour un anniversaire sur mesure.",
      "alt": "Biscuits d’anniversaire thème moto : casque, drapeau à damier et circuit",
      "galerie": [
        { "fichier": "vue-1.webp", "alt": "Biscuits moto, chiffre 60 et drapeau à damier sur glaçage blanc" },
        { "fichier": "vue-2.webp", "alt": "Biscuits au prénom Yannick, « Joyeux anniversaire » et « Vroom » orange" },
        { "fichier": "vue-3.webp", "alt": "Biscuits panneau « Speed limit 60 », moto et pancarte « Travel adventure »" },
        { "fichier": "vue-4.webp", "alt": "Biscuit chiffre 60 noir et biscuit route sinueuse verte" }
      ],
      "produits": [
        { "ref": "vroom", "nom": "Petit rond « Vroom ! »", "prix": 500 },
        { "ref": "rond-casque", "nom": "Petit rond avec casque de moto", "prix": 500 },
        { "ref": "damier", "nom": "Drapeaux à damier", "prix": 500 },
        { "ref": "silhouette", "nom": "Biscuit avec silhouette de moto", "prix": 550 },
        { "ref": "circuit", "nom": "Circuit vert « Vroom Vroom »", "prix": 600 },
        { "ref": "prenom-pneus", "nom": "Biscuit prénom avec traces de pneus", "prix": 600, "perso": ["prenom"] },
        { "ref": "rond-age", "nom": "Grand rond âge effet route", "prix": 600, "perso": ["age"] },
        { "ref": "travel", "nom": "Panneau « Travel / Adventure » avec détails en relief", "prix": 600 },
        { "ref": "speed-limit", "nom": "Panneau « Speed Limit »", "prix": 600 }
      ]
    },
    {
      "id": "douceur-abeille",
      "nom": "Douceur d’Abeille",
      "occasion": "Premier anniversaire",
      "description": "Un univers doux et champêtre pour un premier anniversaire : alvéoles dorées, marguerites blanches et petites abeilles, dans des tons miel, blanc et bleu ciel. Le prénom et le chiffre se calligraphient à la main. Sur devis, comme toutes mes créations sur mesure.",
      "alt": "Biscuits personnalisés thème abeille : alvéoles dorées, marguerites et prénom calligraphié",
      "galerie": [
        { "fichier": "vue-1.webp", "alt": "Biscuit « One » bleu ciel à l’abeille, posé près d’une grande marguerite blanche" }
      ],
      "produits": []
    },
    {
      "id": "velo-route",
      "nom": "Passion Vélo",
      "occasion": "Anniversaire adulte",
      "description": "Un vélo de route dessiné à la main, un âge et un prénom : de quoi marquer l’anniversaire d’un cycliste. Glaçage blanc, cadre rouge et noir, contours nets. Sur devis, adapté à la couleur du vélo et au nombre de biscuits.",
      "alt": "Biscuits d’anniversaire thème vélo de route : vélo dessiné à la main, âge et prénom",
      "galerie": [
        { "fichier": "vue-1.webp", "alt": "Biscuit festonné blanc au vélo de route rouge, avec l’âge et le prénom en dessous" },
        { "fichier": "vue-2.webp", "alt": "Commande de biscuits vélo emballés un par un, alignés avant la remise" },
        { "fichier": "vue-3.webp", "alt": "Les biscuits vélo en cours de décoration sur la grille, poche à douille noire posée à côté" }
      ],
      "produits": []
    },
    {
      "id": "elegance-florale",
      "nom": "Élégance Florale",
      "occasion": "Anniversaire adulte",
      "description": "Fleurs en relief, feuillages et calligraphie dorée dans un camaïeu de rose poudré, framboise et bordeaux. Une collection pour un anniversaire d’adulte tout en délicatesse, avec l’âge et l’initiale au centre. Sur devis.",
      "alt": "Biscuits d’anniversaire floraux : fleurs en relief, initiale et âge dans des tons rose et bordeaux",
      "galerie": [
        { "fichier": "vue-1.webp", "alt": "Biscuits fleurs bordeaux et cœur à l’initiale, sur fond rose poudré" },
        { "fichier": "vue-2.webp", "alt": "Grande fleur bordeaux en relief près du biscuit rond à l’âge calligraphié" }
      ],
      "produits": []
    },
    {
      "id": "bapteme-nature",
      "nom": "Baptême Nature",
      "occasion": "Baptême",
      "description": "Vert sauge, blanc et touches dorées : colombe, feuillages d’olivier et médaillon à l’initiale de l’enfant. Une collection de baptême plus végétale que « Baptême Douceur », à composer selon le prénom, la date et les couleurs de la cérémonie. Sur devis.",
      "alt": "Biscuits de baptême vert sauge : colombe, feuillages d’olivier et médaillon à l’initiale",
      "galerie": [
        { "fichier": "vue-1.webp", "alt": "Biscuits de baptême vert sauge : colombe, feuillage et médaillon à l’initiale E" },
        { "fichier": "vue-2.webp", "alt": "Médaillon de baptême à l’initiale E en relief, sur glaçage vert sauge" },
        { "fichier": "vue-3.webp", "alt": "Feuillages d’olivier en biscuit et colombe blanche, posés sur un set tressé" },
        { "fichier": "vue-4.webp", "alt": "Biscuit colombe blanche en relief sur médaillon vert sauge" }
      ],
      "produits": []
    },
    {
      "id": "logo-entreprise",
      "nom": "Logo d’entreprise",
      "occasion": "Entreprise",
      "description": "Votre logo reproduit à la main au glaçage royal, dans vos couleurs exactes. Pour un événement d’entreprise, un salon, un remerciement client ou une fin d’année. Quantité, forme et finition se décident ensemble : sur devis.",
      "alt": "Biscuits personnalisés au logo d’entreprise, reproduits à la main au glaçage royal",
      "galerie": [
        { "fichier": "vue-1.webp", "alt": "Biscuits ronds au logo Getaz Payerne, décorés d’un renne de fin d’année" },
        { "fichier": "vue-2.webp", "alt": "Série de biscuits au logo d’entreprise sur grille de refroidissement" },
        { "fichier": "vue-3.webp", "alt": "Biscuit au logo iAD Immobilier vu de près, relief et contours nets" },
        { "fichier": "vue-4.webp", "alt": "Commande d’entreprise alignée avant emballage, logos identiques un par un" },
        { "fichier": "vue-5.webp", "alt": "Plateau de biscuits au logo d’entreprise, prêts pour la remise au client" }
      ],
      "produits": []
    }
  ];

  /* ------------------------------------------------------------
     Mise à plat : chaque produit devient un article du catalogue,
     avec son identifiant complet et ses champs résolus. C'est cette
     liste que le serveur interroge pour retarifer une commande.
     ------------------------------------------------------------ */
  var ARTICLES = [];
  COLLECTIONS.forEach(function (c) {
    c.image = 'images/collections/' + c.id + '/principale.webp';
    (c.galerie || []).forEach(function (v) {
      v.image = 'images/collections/' + c.id + '/' + v.fichier;
    });

    /* Une collection du moment se vend en assortiments, et seulement
       ainsi : ses modèles restent décrits — les compositions les
       nomment, le récapitulatif de commande les affiche — mais on ne
       les commande pas un par un. Le drapeau se déduit des données, il
       ne se saisit pas : ajouter un tableau `packages` à une collection
       suffit à la faire basculer. */
    c.packagesSeuls = !!(c.packages && c.packages.length);

    c.produits.forEach(function (p) {
      p.id = c.id + '-' + p.ref;
      p.collectionId = c.id;
      p.collection = c.nom;
      p.categorie = 'biscuit';
      p.biscuits = 1;
      /* Connu du catalogue, absent de la vente à l'unité. */
      p.seulEnPackage = c.packagesSeuls;
      p.court = p.nom;
      p.champs = (p.perso || []).map(function (k) { return CHAMPS[k]; });
      if (p.option) p.option.champs = (p.option.perso || []).map(function (k) { return CHAMPS[k]; });
      ARTICLES.push(p);
    });

    /* Un package est un article comme un autre : un identifiant, un prix,
       un nombre de biscuits. Toute la chaîne — panier, retarification
       serveur, paiement — le traite donc sans rien connaître de lui.
       Seules deux choses le distinguent d'un biscuit : sa catégorie, et
       le fait qu'il compte pour plusieurs. */
    (c.packages || []).forEach(function (pk) {
      var parRef = {};
      c.produits.forEach(function (p) { parRef[p.ref] = p; });
      pk.id = c.id + '-pack-' + pk.ref;
      pk.collectionId = c.id;
      pk.collection = c.nom;
      pk.categorie = 'package';
      /* Le nombre de biscuits se compte, il ne se saisit pas : une
         composition modifiée ne peut pas mentir sur son total. */
      pk.biscuits = pk.composition.reduce(function (n, x) { return n + x.qte; }, 0);
      pk.detail = pk.composition.map(function (x) {
        var modele = parRef[x.ref];
        return { ref: x.ref, qte: x.qte, nom: modele ? modele.nom : x.ref, connu: !!modele };
      });
      pk.court = c.nom + ' — ' + pk.nom;
      pk.perso = [];
      pk.champs = [];
      ARTICLES.push(pk);
    });
  });

  var PAR_ID = {};
  ARTICLES.forEach(function (a) { PAR_ID[a.id] = a; });
  var PAR_COLLECTION = {};
  COLLECTIONS.forEach(function (c) { PAR_COLLECTION[c.id] = c; });

  /* Minimum de commande, en biscuits, sur le TOTAL du panier. */
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
  function collection(id) { return PAR_COLLECTION[id] || null; }

  /* Prix d'un biscuit, option de personnalisation comprise si elle est
     retenue. Une seule fonction, appelée des deux côtés : le navigateur
     et le serveur ne peuvent pas compter différemment. */
  function prixUnitaire(a, avecOption) {
    if (!a) return 0;
    return a.prix + (avecOption && a.option ? a.option.supplement : 0);
  }

  /* ---------- Le minimum de commande ----------
     Douze biscuits, et ces douze-là sont les biscuits commandés à
     l'unité. Un package est un assortiment composé d'avance, vendu tel
     quel : il ne compte pas dans les douze, et il n'en dispense pas non
     plus. Les deux règles cohabitent sans se parler.

       Package seul                      : rien à l'unité, rien à exiger.
       Package + 12 biscuits à l'unité   : les douze y sont.
       Package + 8 biscuits à l'unité    : il en manque quatre.
       Deux packages                     : toujours rien à l'unité.

     Les biscuits à l'unité peuvent venir de n'importe quelle collection
     qui en vend, et se cumulent : six d'une collection et six d'une
     autre font douze.

     Une seule fonction, appelée des deux côtés : le navigateur et le
     serveur ne peuvent pas compter différemment. */

  /* Combien de biscuits une ligne apporte : un package vaut sa
     composition, un modèle vaut un.

     La quantité est ramenée à un entier positif avant tout calcul. Cette
     fonction sert aussi à contrôler un panier reçu par le réseau, et un
     panier fabriqué à la main n'a aucune raison d'envoyer un nombre :
     sans cette précaution, une quantité non numérique donnerait NaN, et
     « NaN < minimum » étant faux, le minimum sauterait. */
  function biscuitsLigne(ligne) {
    var a = article(ligne && ligne.id);
    if (!a) return 0;
    var qte = Math.floor(Number(ligne.qte));
    if (!isFinite(qte) || qte <= 0) return 0;
    return (a.biscuits || 1) * qte;
  }

  /* Les biscuits commandés à l'unité. Seuls ceux-là comptent pour le
     minimum : le contenu d'un package n'en fait jamais partie. */
  function biscuitsIndividuels(lignes) {
    return (lignes || []).reduce(function (n, l) {
      var a = article(l && l.id);
      return a && a.categorie === 'package' ? n : n + biscuitsLigne(l);
    }, 0);
  }

  function minimumRequis(lignes) {
    return biscuitsIndividuels(lignes) ? MIN_BISCUITS : 0;
  }

  /* Les lignes qu'un panier ne devrait pas contenir : un modèle d'une
     collection vendue uniquement en packages. L'interface ne les propose
     plus, mais un panier gardé de la veille ou fabriqué à la main peut
     encore en porter. */
  function lignesHorsVente(lignes) {
    return (lignes || []).filter(function (l) {
      var a = article(l && l.id);
      return !!(a && a.seulEnPackage);
    });
  }

  /* Les packages que la destination choisie n'accepte pas. Seuls ceux
     marqués « horsSuisse » partent à l'étranger ; les autres ne sont
     proposés que pour une livraison en Suisse.

     Cette règle ne passe plus par le minimum. Elle y passait tant que le
     contenu d'un package comptait dans les douze : le refuser revenait
     alors à exiger douze biscuits. Maintenant que le minimum ne regarde
     que les biscuits pris à l'unité, un petit package seul n'aurait plus
     rien à atteindre, et partirait donc n'importe où. C'est désormais un
     refus à part entière, dit comme tel. */
  function packagesHorsZone(lignes, pays) {
    if (!pays || pays === 'Suisse') return [];
    return (lignes || []).filter(function (l) {
      var a = article(l && l.id);
      return a && a.categorie === 'package' && !a.horsSuisse;
    }).map(function (l) { return article(l.id); });
  }

  /* 600 -> « 6 CHF » ; 650 -> « 6.50 CHF ». */
  function formater(centimes) {
    var francs = centimes / 100;
    var texte = (francs % 1 === 0) ? String(francs) : francs.toFixed(2);
    return texte + ' ' + DEVISE;
  }

  /* SumUp attend des unités majeures : 650 centimes -> 6.50 francs.
     La division se fait une seule fois, ici, au bord de l'API. */
  function enFrancs(centimes) { return Math.round(centimes) / 100; }

  var API = {
    COLLECTIONS: COLLECTIONS,
    ARTICLES: ARTICLES,
    CHAMPS: CHAMPS,
    CHAMPS_LIVRAISON: CHAMPS_LIVRAISON,
    PAYS_LIVRAISON: PAYS_LIVRAISON,
    RETRAIT_LIEU: RETRAIT_LIEU,
    MIN_BISCUITS: MIN_BISCUITS,
    DEVISE: DEVISE,
    article: article,
    collection: collection,
    prixUnitaire: prixUnitaire,
    minimumRequis: minimumRequis,
    biscuitsLigne: biscuitsLigne,
    biscuitsIndividuels: biscuitsIndividuels,
    lignesHorsVente: lignesHorsVente,
    packagesHorsZone: packagesHorsZone,
    formater: formater,
    enFrancs: enFrancs
  };

  if (typeof module === 'object' && module.exports) module.exports = API;
  else racine.JCCatalogue = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
