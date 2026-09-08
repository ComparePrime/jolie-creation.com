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

- **Photos des collections.** Les vingt cartes attendent un fichier
  `images/collections/<id>.png`. Tant qu'il manque, la carte affiche un
  cadre sobre au nom de la collection : rien ne casse, mais la page
  gagnera beaucoup à être illustrée.
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
aucun recadrage. Le script est idempotent : le relancer deux fois donne
le même résultat.

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

Puis déposer l'image dans `images/collections/ma-collection.png` et
régénérer les cartes de la page :

```bash
python3 outils-collections.py
```

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

---

## Développement local

```bash
npx http-server -p 8080 -s      # le site, sans les fonctions
npm test                        # tests de la fonction de paiement
```

Pour tester le paiement de bout en bout en local, il faut la CLI Netlify
(`netlify dev`) et un fichier `.env` contenant `STRIPE_SECRET_KEY`. Ce
fichier est ignoré par git.
