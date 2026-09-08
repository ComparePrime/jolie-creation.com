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

   Chaque biscuit se commande à l'unité, à son propre prix. Le
   minimum de douze biscuits porte sur le TOTAL du panier, toutes
   collections confondues : il est donc vérifié au panier, pas ici.

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
     4. Déposer l'image dans images/collections/<id>.png. Si le
        fichier manque, la carte affiche un cadre sobre à la place :
        rien ne casse.
     Le reste — page, modale, panier, paiement — suit tout seul.
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
      "description": "Une collection à la fois effrayante et adorable pour célébrer Halloween. Entre citrouilles, petit fantôme, squelette, toile d’araignée et personnages rigolos, chaque biscuit est décoré à la main dans des teintes orange, violet, noir et blanc. Parfaite pour une fête d’Halloween, un goûter d’enfants ou une jolie box gourmande.",
      "alt": "Biscuits d’Halloween personnalisés : citrouilles, fantôme et toile d’araignée",
      "produits": [
        { "ref": "crane", "nom": "Petit crâne blanc", "prix": 450 },
        { "ref": "citrouille-pastel", "nom": "Citrouille pastel avec détails en relief", "prix": 450 },
        { "ref": "fantome", "nom": "Petit fantôme", "prix": 500 },
        { "ref": "citrouille-orange", "nom": "Citrouille orange personnage", "prix": 500 },
        { "ref": "boo", "nom": "« Boo »", "prix": 600 },
        { "ref": "squelette", "nom": "Squelette détaillé noir et blanc", "prix": 600 },
        { "ref": "toile-araignee", "nom": "Toile d’araignée avec araignée en relief", "prix": 600 },
        { "ref": "chauve-souris", "nom": "Chauve-souris violette", "prix": 650 }
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
    }
  ];

  /* ------------------------------------------------------------
     Mise à plat : chaque produit devient un article du catalogue,
     avec son identifiant complet et ses champs résolus. C'est cette
     liste que le serveur interroge pour retarifer une commande.
     ------------------------------------------------------------ */
  var ARTICLES = [];
  COLLECTIONS.forEach(function (c) {
    c.image = 'images/collections/' + c.id + '.png';
    c.produits.forEach(function (p) {
      p.id = c.id + '-' + p.ref;
      p.collectionId = c.id;
      p.collection = c.nom;
      p.categorie = 'biscuit';
      p.biscuits = 1;
      p.court = p.nom;
      p.champs = (p.perso || []).map(function (k) { return CHAMPS[k]; });
      if (p.option) p.option.champs = (p.option.perso || []).map(function (k) { return CHAMPS[k]; });
      ARTICLES.push(p);
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
    formater: formater,
    enFrancs: enFrancs
  };

  if (typeof module === 'object' && module.exports) module.exports = API;
  else racine.JCCatalogue = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
