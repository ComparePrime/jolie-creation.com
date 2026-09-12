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
| `outils-galerie.py`                            | Recompose la galerie de « Mes réalisations » en rangées.     |
| `outils-collections.py`                        | Régénère les cartes de collection depuis `catalogue.js`.     |
| `outils-photos.py`                             | Dérive les vues de galerie du portfolio et convertit les photos en WebP. |
| `images/collections/<id>.webp`                 | La photo de chaque collection, une par carte.                |
| `images/collections/<id>-1.webp`…              | Les vues secondaires d'une collection, dérivées du portfolio. |
| `images/creations/`                            | Le portfolio : photos pleine taille de « Mes réalisations ». |
| `images/fond-rayures.png`                      | Les rayures du fond, seules.                                 |
| `images/filigrane-logo.webp`                   | Le médaillon du logo, en filigrane par-dessus les rayures.   |

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

## Modifier la galerie « Mes réalisations »

Les photos sont posées à plat dans les `<div class="folio-masonry">` de
`mes-realisations.html` : une balise `<figure class="folio-item">` par
photo. Après tout ajout ou retrait, relancer :

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

Puis déposer la photo dans `images/collections/`, sous le nom de la
collection (`ma-collection.jpg`), et lancer les deux outils :

```bash
python3 outils-photos.py        # la photo devient ma-collection.webp
python3 outils-collections.py   # la carte apparaît sur la page
```

La page charge toutes les photos d'un coup : c'est ce qui impose le WebP
réduit. Les vingt premiers originaux pesaient 5,7 Mo, les WebP 0,9 Mo,
pour une différence invisible à l'écran. Tant qu'une photo manque, sa
carte affiche un cadre sobre au nom de la collection : rien ne casse.

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

`"produits": []` est un état valable. La collection s'affiche, avec sa
photo et son texte, mais la carte remplace le bouton d'achat par un
renvoi vers le devis et annonce que les modèles sont en préparation. Les
données structurées omettent alors l'offre : une fourchette de prix
inventée serait un prix faux, et Google la confronte à la page.

Le jour où les modèles arrivent, il suffit de remplir le tableau.

### Les vues secondaires d'une collection

Chaque carte montre une grande photo, puis les autres vues du même
assortiment. Elles se déclarent ainsi :

```js
"galerie": [
  { "fichier": "ma-collection-1.webp", "alt": "…" },
  { "fichier": "ma-collection-2.webp", "alt": "…" }
]
```

Les fichiers viennent presque tous du portfolio : la table `GALERIES` en
tête d'`outils-photos.py` dit, pour chaque collection, quelles photos de
`images/creations/` montrent ce même assortiment. Le script les réduit à
520 px, les nomme `<id>-1.webp`, `<id>-2.webp`… et **écarte de lui-même
une vue identique à la grande photo** — une galerie qui répète l'image du
dessus n'apprend rien. Relancer ensuite `outils-collections.py`.

Une règle tient tout le reste : **une vue de galerie doit montrer les
modèles de la collection.** Les biscuits de baptême d'Elio, par exemple,
sont de vraies photos mais d'autres modèles que le seul biscuit de
« Baptême Douceur » : ils restent dans « Mes réalisations ». Illustrer
une collection avec un modèle qu'on ne peut pas commander revient à le
promettre.

Une collection sans galerie n'affiche que sa grande photo. C'est un état
normal, pas un manque à combler.

### Mettre une collection en avant

`"saison": true` fait remonter la collection dans « Les collections du
moment », en tête de page, et lui donne un liseré doré et une pastille.
La carte garde exactement la même forme que les vingt autres. Retirer le
drapeau la fait redescendre parmi les autres : rien d'autre à changer, et
elle reste achetable dans les deux cas.

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
