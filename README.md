# jolie-creation.com

Site vitrine et boutique en ligne de Jolie Création : biscuits personnalisés
décorés à la main et micro-scénographies événementielles.

Site statique, sans étape de compilation. Les pages sont du HTML servi tel
quel ; seul le paiement passe par deux fonctions serverless.

---

## Activer le paiement en ligne (SumUp)

Le parcours panier → livraison ou retrait → paiement → confirmation est
en place et testé. Il ne manque que **les identifiants SumUp**. Tant
qu'ils ne sont pas renseignés, la page affiche un message honnête et
propose de finaliser par WhatsApp, par e-mail ou en choisissant le
retrait. Aucun faux paiement n'est simulé.

### 1. Récupérer les deux valeurs

| Où                                                          | Quoi                                     |
| ----------------------------------------------------------- | ---------------------------------------- |
| [Tableau de bord SumUp → Clés API](https://me.sumup.com/settings/api-keys) | La clé API, qui commence par `sup_sk_` |
| Profil du compte SumUp                                       | Le code marchand (*merchant code*)       |

### 2. Les renseigner dans Netlify

**Site settings → Environment variables → Add a variable**

| Nom                   | Valeur       |
| --------------------- | ------------ |
| `SUMUP_API_KEY`       | `sup_sk_...` |
| `SUMUP_MERCHANT_CODE` | le code marchand |

Puis redéployer le site pour que les fonctions voient les variables.

> La clé API ne doit jamais être écrite dans un fichier du dépôt, ni dans
> une page HTML, ni dans un fichier JavaScript. Elle permet d'encaisser
> des paiements : une clé publiée est une clé compromise, à révoquer
> immédiatement depuis le tableau de bord SumUp.

### 3. Vérifier

Passer une commande de bout en bout, dans les deux modes. Le retrait ne
déclenche aucun paiement : la commande doit arriver par e-mail (voir la
section suivante). La livraison doit en plus apparaître dans le tableau
de bord SumUp, avec la même référence `JC-AAAAMMJJ-XXXXXX`.

---

## Recevoir les demandes de devis et les commandes

Tout arrive par e-mail à **info@jolie-creation.com**, par le même
chemin :

```
formulaire → netlify/functions/envoyer-message.js → Nodemailer
           → SMTP Infomaniak → info@jolie-creation.com
```

Un seul chemin pour les deux : les demandes de devis (page Contact,
qu'on y arrive depuis une formule de micro-scénographie, une collection
ou directement) et les commandes de la boutique. Netlify Forms n'est pas
utilisé.

### Les variables à renseigner

**Site settings → Environment variables**, jamais dans le dépôt :

| Nom             | Valeur                                        |
| --------------- | --------------------------------------------- |
| `SMTP_USER`     | `info@jolie-creation.com`                     |
| `SMTP_PASSWORD` | le mot de passe de cette boîte                |
| `SMTP_HOST`     | `mail.infomaniak.com` *(valeur par défaut)*   |
| `SMTP_PORT`     | `465` *(valeur par défaut, SSL)*              |

`SMTP_HOST` et `SMTP_PORT` peuvent être omis : la fonction retient ces
valeurs. `SMTP_USER` et `SMTP_PASSWORD` sont obligatoires. Le port 465
chiffre d'emblée ; le port 587 bascule automatiquement sur STARTTLS.

> Infomaniak refuse d'expédier au nom d'une adresse qui n'appartient pas
> au compte authentifié. `SMTP_USER` doit donc bien être la boîte
> `info@jolie-creation.com`, qui est aussi l'adresse d'expédition.

Tant que ces variables manquent, le formulaire ne dit pas « merci » : il
annonce que l'envoi n'est pas activé et propose l'e-mail et WhatsApp. Un
« merci » affiché sur une demande perdue serait pire que l'absence de
formulaire.

### Ce que contient l'e-mail

Tous les champs remplis, dans un ordre lisible, plus l'image
d'inspiration en pièce jointe si le client en a joint une (3 Mo au
plus). Le champ **Répondre à** porte l'adresse du client : répondre à
l'e-mail lui répond directement.

La liste des champs transmis vit dans `envoyer-message.js`, constante
`CHAMPS`. Ajouter un champ au formulaire demande de l'ajouter là aussi,
sans quoi il n'est pas transmis. C'est volontaire : une liste ouverte
laisserait n'importe quoi entrer dans le courrier.

### Anti-spam

Trois filtres, du plus fiable au moins fiable :

1. **Un pot de miel**, champ invisible que seul un robot remplit. La
   demande est alors jetée, mais le robot reçoit « envoyé » : celui qui
   croit avoir réussi ne réessaie pas.
2. **Un délai de saisie minimum** de trois secondes.
3. **Une limite de cinq envois par adresse IP** sur dix minutes. Elle
   vit en mémoire, donc dans un seul conteneur : deux envois peuvent
   tomber sur deux conteneurs différents et y échapper. C'est un
   garde-fou contre l'envoi en rafale, pas une protection sérieuse. Si
   le spam devient un vrai problème, c'est un service dédié qu'il
   faudra brancher.

---

## Ce qui reste à faire avant l'ouverture de la boutique

- **Les modèles et les prix de la collection Automne.** La collection est
  publiée, illustrée de ses sept photos et mise en avant, mais sa liste de
  biscuits n'a pas encore été fournie. Tant que `produits` est vide dans
  `catalogue.js`, la carte annonce que les modèles arrivent et renvoie
  vers le devis : aucun prix n'est supposé. Remplir le tableau suffit à
  faire apparaître le bouton, la modale et l'achat, sans toucher à
  quoi que ce soit d'autre.
- **Conditions générales de vente.** Une boutique en ligne suisse doit
  les publier et y renvoyer depuis le tunnel de commande. Elles
  n'existent pas encore sur le site.
- **Frais de livraison.** Ils ne sont pas facturés en ligne : le site
  indique qu'ils sont confirmés séparément selon la destination.

---

## Structure

| Fichier / dossier                              | Rôle                                                        |
| ---------------------------------------------- | ----------------------------------------------------------- |
| `catalogue.js`                                 | Prix et articles achetables. Source unique, navigateur + serveur. |
| `boutique.js`                                  | Panier (localStorage), modale de sélection, minimum de 12 biscuits. |
| `panier.html`                                  | Récapitulatif, quantités, totaux.                            |
| `paiement.html`                                | Livraison ou retrait, coordonnées, puis départ vers SumUp.   |
| `commande-confirmee.html`                      | Relit l'état réel du paiement auprès de SumUp.               |
| `netlify/functions/create-checkout.js`         | Crée la session de paiement. Seul endroit où vit la clé.     |
| `netlify/functions/get-order.js`               | Relit l'état d'un paiement.                                  |
| `netlify/functions/envoyer-message.js`         | Envoie devis et commandes par e-mail. Seul endroit où vivent les identifiants SMTP. |
| `tests/catalogue.test.js`                      | Tests de la fonction de paiement (`npm test`).               |
| `tests/envoi.test.js`                          | Tests de la fonction d'envoi (`npm test`).                   |
| `outils-galerie.py`                            | Recompose en rangées les photos d'une micro-scénographie et les numérote (`data-rang`). |
| `outils-collections.py`                        | Régénère le catalogue de « Mes réalisations » et l'aperçu de saison depuis `catalogue.js`. |
| `outils-photos.py`                             | Dérive les vues de galerie et les photos de carte, et convertit en WebP. |
| `outils-webp.py`                               | Sert en WebP les photos encore servies en JPEG, à dimensions égales. |
| `outils-jsonld.py`                             | Pose le socle de données structurées (Organization, WebSite, fil d'Ariane) sur les pages indexables. |
| `outils-sitemap.py`                            | Régénère `sitemap.xml`, avec un `lastmod` tiré de l'historique git. |
| `images/collections/<id>/principale.webp`      | La grande photo de chaque collection.                        |
| `images/collections/<id>/vue-1.webp`…          | Les vues secondaires, dérivées des photos pleine taille.     |
| `images/collections/<id>/*.jpg`                | Les photos pleine taille d'origine, rangées avec leur collection. |
| `images/micro-scenographies/<thème>/`          | Les photos d'une micro-scénographie installée, originaux et WebP de carte. |
| `images/site/atelier-*.jpg`                    | Les photos d'atelier, hors catalogue (avec `julie.jpeg`).    |
| `images/site/fond-rayures.png`                      | Les rayures du fond, seules.                                 |
| `images/site/filigrane-logo.webp`                   | Le médaillon du logo, en filigrane par-dessus les rayures.   |

### Trois principes du code de paiement

**Les prix ne viennent jamais du navigateur.** La page envoie des
identifiants d'articles et des quantités ; la fonction serveur relit les
montants dans `catalogue.js`. Un panier trafiqué dans la console ne peut pas
faire baisser la somme débitée.

**Les centimes ne deviennent des francs qu'au dernier moment.** Tout le
site compte en entiers (`7250`), SumUp attend des unités majeures
(`72.50`). La conversion a lieu une seule fois, dans `Catalogue.enFrancs`,
au bord de l'API. Additionner des francs en virgule flottante finit
toujours par produire un `72.49999999` quelque part.

**La commande et le paiement voyagent séparément.** SumUp ne transporte
qu'un montant : ni l'adresse, ni le détail des articles. La commande part
donc par e-mail *avant* le départ vers le paiement, sous la même
référence `JC-AAAAMMJJ-XXXXXX`. C'est elle qui fait le lien entre les deux
enregistrements. Si cet envoi échoue, le client n'est pas emmené vers le
paiement : encaisser une commande qui n'arriverait jamais serait pire que
de la refuser.

**Le minimum de douze biscuits porte sur le panier entier.** Chaque
biscuit se commande à l'unité, à son prix, et les collections se
mélangent librement : cinq Petit Océan et sept Rêve de Licorne font une
commande valable. La règle vit dans `JCPanier.blocage()`, le panier et la
page de paiement s'y réfèrent tous les deux, et la fonction serveur la
revérifie avant d'encaisser — c'est là que l'argent change de main.

---

## La photo d'une formule de micro-scénographie

Les trois cartes de `micro-scenographies.html` partagent le même cadre,
et chacune porte désormais sa photo :

```html
<div class="card-image">
  <img src="images/micro-scenographies/escargot/micro-sceno-escargot-decor.webp"
       alt="…" width="825" height="1100" loading="lazy" decoding="async">
</div>
```

Le cadre garde sa proportion de 4/5 à toutes les largeurs, donc le
cadrage est le même en une, deux ou trois colonnes.

**La carte sert un `.webp`, pas l'original.** Le cadre fait 341 px de
large : y télécharger un fichier de 1100 px coûterait trois fois la taille
utile. La table `FORMULES` en tête d'`outils-photos.py` liste les photos
concernées et écrit le `.webp` à côté de chacune :

```bash
python3 outils-photos.py
```

L'original ne bouge pas — la galerie de « Mes réalisations » et le partage
social continuent de s'en servir en pleine taille. Les trois cartes sont
ainsi passées de 754 ko à 235 ko, sans différence visible à l'écran.

**Chaque photo doit montrer ce que sa formule vend, et rien de plus.**
Les trois viennent du même événement, et c'est justement ce qui les rend
comparables : la Formule 1 montre le décor et ses présentoirs vides, la
Formule 2 les mêmes présentoirs garnis de biscuits, la Formule 3
l'ensemble avec le photobooth. Illustrer la Formule 1 avec une photo où
l'on voit des biscuits promettrait ce qu'elle ne comprend pas.

### Cadrer une photo sans la déformer

Les photos de l'atelier sont en portrait, les cadres des cartes sont plus
larges : il faut donc choisir ce qu'on garde. `object-fit: cover` s'en
charge sans jamais étirer l'image, et `object-position` décide de la
partie visible. Deux classes suffisent sur l'accueil :

| Classe            | Position          | Pour quoi                         |
| ----------------- | ----------------- | --------------------------------- |
| `cadrage-haut`    | `center 12%`      | Un décor dont le haut porte le sujet |
| `cadrage-tiers`   | `center 28%`      | Un présentoir, sujet au premier tiers |

Le pourcentage est le point de la photo qu'on veut voir au même point du
cadre : 0 % colle le haut de la photo au haut du cadre, 100 % le bas au
bas.

---

## Deux pages, deux rôles

**La séparation est la règle qui tient tout le reste.**

`biscuits-personnalises.html` **présente la prestation**. Ni modèle, ni
bloc de collection, ni prix de modèle. Huit sections :

1. **En-tête** — l'offre en une phrase, sans photo.
2. **Saison en cours** — un aperçu des collections `"saison": true` :
   photo, nom, lien vers la galerie. Rien d'autre.
3. **Comment sont créés mes biscuits ?** — les six étapes de l'atelier.
4. **Ingrédients & conservation** — composition, allergènes, durée.
5. **Combien coûte un biscuit ?** — trois ordres de grandeur par taille.
   Purement informatif : aucun bouton, aucun panier. Le tarif exact d'un
   modèle vit dans `catalogue.js` et s'affiche dans la modale, au moment
   de composer la commande. C'est la seule exception à « aucun prix sur
   cette page », et elle ne cite aucun modèle.
6. **Mes réalisations** — la passerelle vers la galerie.
7. **Elles en parlent** — les avis clients. Ils vivent ici et nulle part
   ailleurs.
8. **Appel final** — devis et WhatsApp.

`mes-realisations.html` **porte le catalogue entier**. Les vingt-six
collections y vivent, et elles seules : grande photo, nom, présentation,
vues secondaires, nombre de modèles et bouton d'action. Puis la
micro-scénographie installée.

**Le haut de page s'efface devant les créations.** Un surtitre, un titre
de trois mots, deux phrases, deux liens d'ancre : la première photo
arrive à 766 px du haut, contre 1355 px auparavant. Il n'y a plus de
sommaire de vingt-six pastilles avant la première création — vingt-six
noms alignés avant d'avoir rien vu se lisent comme un menu déroulant, pas
comme un portfolio. Les deux liens `#collections` et
`#micro-scenographies` suffisent à la navigation.

**Les collections du moment ouvrent la galerie, dans leur propre
section.** `#collections-du-moment` les présente, `#collections` porte
toutes les autres. Le drapeau `saison` de `catalogue.js` décide seul du
partage, et `outils-collections.py` retire de la liste générale celles
qu'il a mises en tête : une collection mise en avant puis répétée douze
blocs plus bas se lit comme deux collections.

**Toute photo de biscuit appartient à une collection.** Il n'y a plus de
galerie séparée : une photo qui n'illustrait aucune collection en a reçu
une. Deux endroits qui montrent les mêmes biscuits finissent toujours par
diverger, et le visiteur ne sait plus lequel fait foi.

**Une collection sans prix se commande sur devis.** Son bloc n'ouvre pas
la modale : il renvoie au formulaire de contact, thème pré-rempli. Six
collections sont dans ce cas. `outils-collections.py` choisit le bouton
d'après `produits` : une liste vide veut dire devis.

**Les prix ne s'affichent nulle part sur la page.** Ils apparaissent dans
la modale, au moment de choisir ses biscuits. Une liste de tarifs sous
chaque collection transformait la galerie en catalogue e-commerce ; c'est
un portfolio.

Les deux zones se régénèrent d'un même geste :

```bash
python3 outils-collections.py
```

Le script écrit les deux listes de « Mes réalisations » — les collections
du moment, puis toutes les autres — et l'aperçu de saison dans la
vitrine. Il ne peut pas écrire de prix du côté vitrine : c'est le
gabarit qui l'en empêche, pas la discipline.

### Les six étapes de l'atelier

Elles vivent en clair dans la page, dans `<ol class="atelier-etapes">`,
et chacune a désormais sa photo. Le jour où l'une d'elles perdrait la
sienne, la classe `atelier-etape-texte` la fait tenir en une rangée
compacte, numéro à gauche : un grand cadre vide vaudrait moins qu'une
rangée assumée.

Le jour où la photo existe, rendre à l'étape son cadre et retirer la
classe :

```html
<li class="atelier-etape">
  <div class="atelier-photo">
    <img src="images/collections/…/…" alt="…" width="…" height="…"
         loading="lazy" decoding="async" class="cadrage-tiers">
  </div>
  <div class="atelier-texte">…</div>
</li>
```

Ce sont de vraies photos de l'atelier, choisies parce qu'elles montrent
l'étape : la pâte dans la cuve du batteur, l'emporte-pièce dans la pâte
étalée, les biscuits nature qui refroidissent sur grille, la poche à
douille sur le plan de travail, un prénom calligraphié, une commande
emballée sachet par sachet.

Une photo d'atelier qui n'appartient à aucune collection se range dans
`images/site/`, sous le nom `atelier-<étape>.jpg`, avec le portrait de
Julie : elle montre le métier, pas un produit au catalogue. Les étapes 01,
02 et 03 en ont une. Les trois dernières montrent encore les biscuits
d'une collection, rangés avec elle : ce sont de vraies photos de
l'atelier, et elles servent aux deux endroits. Le jour où une photo de
l'étape elle-même existe, elle la remplace — une photo de l'étape vaut
toujours mieux qu'une image approchante.

---

## Modifier les photos d'une micro-scénographie

Les photos sont posées à plat dans le `<div class="folio-masonry">` de la
section « Micro-scénographies » de `mes-realisations.html` : une balise
`<figure class="folio-item">` par photo. Après tout ajout ou retrait,
relancer :

```bash
python3 outils-galerie.py
```

Le script relit les dimensions réelles des fichiers, regroupe les photos
en rangées et écrit le résultat dans la page. Chaque rangée occupe
exactement la largeur et toutes ses photos y ont la même hauteur, sans
aucun recadrage. Il est idempotent : le relancer deux fois donne le même
résultat.

Une section peut s'ouvrir sur une grande photo, comme celle des micro-
scénographies : un bloc `univers-layout` pour la photo principale et le
texte, puis un `folio-group` où chaque `folio-set` est une réalisation,
avec son titre, sa description et ses vues secondaires.

**Sur téléphone, une réalisation montre quatre photos au plus** : celle
d'ouverture et trois vues. Sept vues sur trois colonnes faisaient trois
rangées et une carte interminable ; trois en font une, pleine, et la
collection suivante arrive tout de suite. La règle vaut pour les vues
d'une collection (`.collection-galerie figure:nth-child(n+4)`) comme
pour les photos d'une réalisation (`.folio-item[data-rang]`), sous
700 px, et rien n'est retiré du dépôt ni de la page.

Les vues écartées ne sont pas seulement cachées : elles portent
`loading="lazy"`, et un élément en `display:none` n'entre jamais dans le
champ de vision — le navigateur ne les demande donc pas. Mesuré à
390 px, la page passe de 91 à 71 images et de 2836 à 2380 ko ; élargir
la fenêtre les révèle et les charge à ce moment-là.

Le numéro `data-rang` vient d'`outils-galerie.py`, parce qu'il compte à
travers les rangées — recomposées à chaque exécution — là où la CSS ne
sait compter que dans un seul parent.

---

## Les animations

**Un seul système, deux classes.** `script.js` pose `.reveal-init` sur les
éléments à animer et `.in-view` quand ils entrent dans l'écran ; `styles.css`
fait le reste. Aucune des deux n'est écrite dans le HTML : sans JavaScript,
sans `IntersectionObserver`, ou si le visiteur a demandé moins d'animations,
le contenu s'affiche simplement, d'emblée et en entier.

Deux propriétés sont animées, `opacity` et `transform`, et jamais rien
d'autre. Ce sont les deux que le navigateur compose sans repasser par la
mise en page : animer une hauteur ou une marge ferait recalculer la page à
chaque image. Le décalage de mise en page mesuré est de **0,0000 sur les
six pages**.

La courbe et la durée vivent dans deux variables, `--entree` et
`--entree-duree`. Les changer change tout le site d'un coup — c'est le
but.

### Trois façons de déclarer une entrée

Tout se règle dans trois tables en tête du bloc d'animation de
`script.js`. Ajouter une animation, c'est ajouter une ligne, jamais du
code.

| Table           | Pour quoi                                                |
| --------------- | -------------------------------------------------------- |
| `staggerGroups` | Des frères qui se posent l'un après l'autre : cartes, vues de galerie, étapes de l'atelier. `step` est l'écart, `max` le plafonne, `base` retarde toute la série. |
| `sequences`     | Une suite ordonnée **dans** un bloc : surtitre, titre, texte, boutons — ou grande photo puis informations. |
| `soloSelectors` | Un bloc qui se pose d'un seul tenant.                     |

`max` n'est pas un détail : sans lui, une galerie de trente vues finirait
d'apparaître trois secondes après la première. Sur une collection à six
vues, la cascade complète dure 475 ms.

### Ce que le système ne fait pas

**Une entrée ne se joue qu'une fois.** L'observateur cesse de surveiller
l'élément dès qu'il l'a révélé. Monter et descendre la page ne relance
rien — c'est vérifié par les tests, pas seulement par construction.

**Rien ne bouge en permanence.** Aucune animation en boucle, aucun
parallaxe, aucune rotation. Un site qui bouge encore une fois qu'on le
lit n'est plus un portfolio, c'est une démonstration.

**Les survols sont plafonnés à `scale(1.02)` et réservés aux vrais
pointeurs**, par `@media (hover: hover)`. Sur un écran tactile, `:hover`
se colle à l'élément après le tap et n'en repart plus.

Un filet de sécurité révèle au bout de six secondes tout ce qui serait
resté caché : une animation ratée ne doit jamais coûter du contenu.

---

## Le fond du site

Le fond est empilé en trois couches par `body::before`, dans `styles.css` :
le voile crème, puis le médaillon du logo, puis les rayures.

Le médaillon est un fichier séparé, et non une incrustation dans l'image de
fond. Les rayures sont cadrées en `cover` : sur un écran étroit, l'image est
mise à l'échelle sur la hauteur de la fenêtre et déborde largement sur les
côtés. Un médaillon incrusté y serait rogné. En couche à part, sa taille se
calcule sur la fenêtre — `min(50vh, 78vw, 620px)` — et il reste entier de
320 px à 1920 px de large.

Pour changer la discrétion du filigrane, agir sur l'opacité du voile crème
(`rgba(252, 241, 235, 0.9)`) : elle atténue le médaillon en même temps que
les rayures. Le texte garde un contraste d'au moins 5,2 pour 1 sur le point
le plus sombre du médaillon, au-dessus du seuil d'accessibilité AA.

---

## Ajouter une collection de biscuits

Tout se passe dans `catalogue.js`, tableau `COLLECTIONS`. Un bloc suffit :

```js
{
  "id": "ma-collection",
  "nom": "Ma collection",
  "occasion": "Anniversaire",
  "description": "Une phrase ou deux, lisibles et utiles au référencement.",
  "alt": "Biscuits personnalisés thème …",
  "produits": [
    { "ref": "petit-modele", "nom": "Petit modèle", "prix": 500 },
    { "ref": "prenom", "nom": "Biscuit prénom", "prix": 650, "perso": ["prenom"] }
  ]
}
```

Puis créer le dossier `images/collections/ma-collection/`, y déposer la
grande photo sous le nom `principale.jpg` — avec les photos pleine taille
de la collection, s'il y en a — et lancer les deux outils :

```bash
python3 outils-photos.py        # principale.jpg devient principale.webp
python3 outils-collections.py   # le bloc apparaît sur la page
```

Une collection dont la grande photo se choisit parmi ses photos pleine
taille, faute d'un cliché `principale` à part, se déclare dans la table
`PRINCIPALES` en tête d'`outils-photos.py` : le script s'occupe du reste.
Déposer un `principale.jpg` dispense d'y figurer — et **c'est la seule
façon de changer la photo d'une collection pour de bon**. Remplacer
`principale.webp` à la main ne tient pas : c'est un fichier dérivé, que
le prochain passage du script réécrit.

La page charge toutes les photos d'un coup : c'est ce qui impose le WebP
réduit. Les quatre-vingt-deux WebP du catalogue pèsent ensemble un peu plus
de 2 Mo, là où les originaux en font plusieurs dizaines, pour une
différence invisible à l'écran. `outils-photos.py` alerte au-delà de
2,5 Mo. Tant qu'une photo manque, son bloc affiche un cadre sobre au nom
de la collection : rien ne casse.

Trois règles à connaître :

- Les montants sont **en centimes** : `650` pour 6.50 CHF. Manipuler des
  francs en virgule flottante finit toujours par produire un `6.49999999`.
- La `ref` d'un produit ne se renomme jamais une fois en ligne :
  l'identifiant complet `<id collection>-<ref>` est ce qui relie un panier
  déjà enregistré à son article.
- `perso` ne liste que ce qui est réellement demandé au client, parmi les
  clés de `CHAMPS` (prénom, âge, texte, date, initiale, coloris). Un
  biscuit sans `perso` ne demande rien.

Le reste suit tout seul : la modale de sélection, le panier, le
récapitulatif de paiement, l'e-mail de commande et la retarification
serveur lisent tous la même structure.

### Une collection pas encore tarifée

`"produits": []` est un état valable. C'est même **la façon d'annoncer
un devis** : pas de prix publié veut dire composé avec la cliente. Le
bloc s'affiche avec sa photo et son texte, mais le bouton d'achat cède la
place à un renvoi vers le formulaire de contact, thème pré-rempli, et les
repères annoncent « Sur devis, composé avec vous ». Les données
structurées omettent alors l'offre : une fourchette de prix inventée
serait un prix faux, et Google la confronte à la page.

Six collections sont dans ce cas aujourd'hui. Le jour où les modèles et
leurs prix arrivent, il suffit de remplir le tableau : le bouton d'achat
revient de lui-même.

### Les vues secondaires d'une collection

Chaque carte montre une grande photo, puis les autres vues du même
assortiment. Elles se déclarent ainsi :

```js
"galerie": [
  { "fichier": "vue-1.webp", "alt": "…" },
  { "fichier": "vue-2.webp", "alt": "…" }
]
```

Les fichiers se dérivent des photos pleine taille rangées dans le dossier
de la collection : la table `GALERIES` en tête d'`outils-photos.py` dit,
pour chaque collection, lesquelles montrent ce même assortiment et dans
quel ordre. Le script les réduit à 520 px, les nomme `vue-1.webp`,
`vue-2.webp`… et **écarte de lui-même une vue identique à la grande
photo** — une galerie qui répète l'image du dessus n'apprend rien. Une
galerie raccourcie voit ses anciens fichiers supprimés. Relancer ensuite
`outils-collections.py`.

Une règle tient tout le reste : **une vue de galerie doit montrer les
modèles de la collection.** Une photo qui montre d'autres modèles que
ceux qu'on peut commander appartient à une autre collection — au besoin,
une nouvelle, sur devis. Illustrer une collection avec un modèle qu'on ne
peut pas commander revient à le promettre.

Une collection sans galerie n'affiche que sa grande photo. C'est un état
normal, pas un manque à combler.

### Les packages saisonniers

Une collection du moment se vend **uniquement** en assortiments composés
d'avance. Le drapeau ne se saisit pas : `c.packagesSeuls` vaut vrai dès
qu'une collection porte un tableau `packages`, et ses modèles reçoivent
alors `seulEnPackage`.

**Un package est une offre fermée.** Sa composition ne se modifie pas,
rien ne s'y ajoute, et on n'y choisit pas les modèles un par un.

**Ses modèles restent au catalogue, mais sortent de la vente.** Les
compositions les nomment, le récapitulatif de commande les affiche, leur
prix unitaire sert aux données internes — mais la page n'a plus de bouton
« Choisir mes biscuits », `ajouter()` les refuse, `valide()` les retire
d'un panier gardé de la veille, et le serveur rejette la commande qui en
porterait. Quatre portes, parce qu'un panier fabriqué à la main n'entre
par aucune des trois premières.

Ils se déclarent à côté de `produits` :

```js
"packagesResume": "Une sélection de biscuits aux couleurs…",
"packages": [
  { "ref": "complete", "nom": "L’Automne Complète", "prix": 6490,
    "complet": true, "horsSuisse": true,
    "resume": "Toute la collection, dans ses deux coloris.",
    "composition": [
      { "ref": "feuille-blanche", "qte": 1 },
      { "ref": "mug", "qte": 2 }
    ] }
]
```

**Deux collections en ont** : Automne et Frissons d'Halloween. Ajouter la
troisième ne demandera pas une ligne de code — un `packagesResume`, un
tableau `packages`, et les modèles que les compositions nomment.

**Sur la page, un cartouche ; le choix, dans une modale.** Le bloc de la
collection porte deux lignes et un bouton « Découvrir les packages ». Les
trois assortiments dépliés dans la page en faisaient une affiche, au
milieu d'un portfolio.

La modale réutilise **la coquille du choix à l'unité** — même ouverture,
même fermeture (croix, clic à côté, Échap), même verrou de défilement,
mêmes emplacements à remplir. Seul le contenu change. Deux modales qui se
ressemblent doivent partager leur mécanique, sinon l'une des deux finit
par diverger. La seule précaution : la modale des packages change le
libellé du bouton, donc celle des collections le remet.

Sous 700 px la boîte occupe tout l'écran : il n'y a pas d'extérieur où
cliquer, et c'est la croix qui sert.

**Un package est un article comme un autre.** Il reçoit un identifiant
(`automne-pack-complete`), un prix et un nombre de biscuits, puis entre
dans `ARTICLES`. Toute la chaîne — panier, retarification serveur,
paiement — le traite donc sans rien connaître de lui. Deux choses
seulement le distinguent d'un biscuit : sa `categorie`, et le fait qu'il
compte pour plusieurs.

**Le nombre de biscuits se compte, il ne se saisit pas.** `biscuits` est
la somme des quantités de la composition : une composition modifiée ne
peut pas mentir sur son total.

**`complet`** met la carte en avant — un filet doré, pas un bandeau.
**`horsSuisse`** autorise le package à dispenser du minimum depuis
l'étranger ; sans lui, il n'est proposé que pour une livraison en Suisse.

### Le minimum de commande, et ce qui en dispense

Douze biscuits, et ce sont **les biscuits pris à l'unité**. Un package
n'entre pas dans les douze, et n'en dispense pas non plus : les deux
règles cohabitent sans se parler.

`Catalogue.biscuitsIndividuels(lignes)` compte ce qui est soumis au
minimum ; `Catalogue.minimumRequis(lignes)` dit le seuil — douze dès
qu'il y a un biscuit à l'unité, zéro sinon. Les deux côtés les appellent,
le navigateur pour afficher, le serveur pour encaisser : ils ne peuvent
pas compter différemment.

| Panier                                          | À l'unité | Minimum | Passe |
| ----------------------------------------------- | --------- | ------- | ----- |
| Un package                                       | 0         | 0       | oui   |
| Deux packages                                    | 0         | 0       | oui   |
| Package + 12 biscuits d'une autre collection      | 12        | 12      | oui   |
| Package + 6 + 6 de deux collections               | 12        | 12      | oui   |
| Package + 8 biscuits d'une autre collection       | 8         | 12      | non   |
| 12 biscuits à l'unité, sans package               | 12        | 12      | oui   |
| 5 biscuits à l'unité, sans package                | 5         | 12      | non   |

Les biscuits à l'unité viennent de n'importe quelle collection qui en
vend, et se cumulent entre collections.

**La destination est une règle à part.** Seuls les packages marqués
`horsSuisse` partent à l'étranger. Cette règle passait autrefois par le
minimum — refuser un package revenait à exiger douze biscuits. Depuis que
le minimum ne regarde plus que l'unité, un petit package seul n'aurait
plus rien à atteindre : c'est devenu un refus à part entière,
`Catalogue.packagesHorsZone(lignes, pays)`, dit comme tel au client.

Tant que le pays n'est pas choisi, on raisonne comme en Suisse : le panier
ne doit pas bloquer sur une adresse que le client n'a pas encore saisie.

Sur la page de paiement, un pays qui empêche la commande **n'efface pas le
formulaire** — il affiche un avertissement et désactive le bouton. Masquer
la page enfermerait le client : le sélecteur de pays disparaîtrait avec
elle, et il n'aurait plus aucun moyen de revenir en arrière.

### Le drapeau « saison »

`"saison": true` fait trois choses, et seulement trois : la collection
apparaît en aperçu sur la page vitrine, elle passe dans la section
« Collections du moment » en tête de galerie — et disparaît d'autant de
la liste générale —, et elle porte une pastille « collection du moment ».
Retirer le drapeau la ramène simplement à son rang dans la liste
générale, achetable comme avant.

La pastille se pose en tête d'une rangée `.collection-meta`, juste
au-dessus du nom, suivie de l'occasion quand celle-ci apprend quelque
chose — pour « Automne » ou « Saint-Valentin », l'occasion répète le titre
et `outils-collections.py` ne l'écrit pas. Cette rangée est un conteneur
flex, et ce n'est pas un détail : dans la colonne flex du corps, la
pastille s'étirait sur toute la largeur et donnait une barre dorée de
573 px pour trois mots.

Les données structurées vivent sur « Mes réalisations », qui porte le
catalogue.

---

## Développement local

```bash
npx http-server -p 8080 -s      # le site, sans les fonctions
npm test                        # tests de la fonction de paiement
```

Pour tester le paiement et les e-mails de bout en bout en local, il faut
la CLI Netlify (`netlify dev`) et un fichier `.env` contenant
`SUMUP_API_KEY`, `SUMUP_MERCHANT_CODE`, `SMTP_USER` et `SMTP_PASSWORD`.
Ce fichier est ignoré par git et ne doit jamais y entrer.
