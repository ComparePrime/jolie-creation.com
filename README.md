# jolie-creation.com

Site vitrine et boutique en ligne de Jolie Création : biscuits personnalisés
décorés à la main et micro-scénographies événementielles.

Site statique, sans étape de compilation. Les pages sont du HTML servi tel
quel ; seul le paiement passe par deux fonctions serverless.

---

## Activer le paiement en ligne

Le parcours panier → paiement → confirmation est déjà en place et testé.
Il ne manque qu'une chose : **la clé secrète Stripe**. Tant qu'elle n'est
pas renseignée, la page de paiement affiche un message honnête et propose
de finaliser la commande par WhatsApp ou par e-mail. Aucun faux paiement
n'est simulé.

### 1. Récupérer la clé

Dans le tableau de bord Stripe : **Développeurs → Clés API → Clé secrète**.
Elle commence par `sk_live_` en production, `sk_test_` pour les essais.

### 2. La renseigner dans Netlify

**Site settings → Environment variables → Add a variable**

| Nom                 | Valeur        |
| ------------------- | ------------- |
| `STRIPE_SECRET_KEY` | `sk_live_...` |

Puis redéployer le site pour que les fonctions voient la variable.

> Cette clé ne doit jamais être écrite dans un fichier du dépôt, ni dans une
> page HTML, ni dans un fichier JavaScript. Elle permet de débiter des
> cartes : une clé publiée est une clé compromise, à révoquer immédiatement
> depuis le tableau de bord Stripe.

### 3. Activer les moyens de paiement

**Réglages → Paiements → Moyens de paiement** : activer au minimum les
cartes et **TWINT**. Apple Pay et Google Pay s'activent au même endroit et
apparaissent automatiquement sur les appareils compatibles.

Le code ne fige volontairement aucune liste de moyens de paiement : Stripe
propose ceux qui sont activés sur le compte. Un moyen activé plus tard
apparaît donc sans modification du site.

### 4. Vérifier avec une carte de test

Avec une clé `sk_test_`, passer une commande et payer avec le numéro
`4242 4242 4242 4242`, une date future et n'importe quel CVC. La commande
doit apparaître dans le tableau de bord Stripe, et la page de confirmation
afficher le montant réellement payé.

---

## Ce qui reste à faire avant l'ouverture de la boutique

- **Conditions générales de vente.** Une boutique en ligne suisse doit les
  publier et y renvoyer depuis le tunnel de commande. Elles n'existent pas
  encore sur le site.
- **Frais de livraison.** Ils ne sont pas facturés en ligne : le site
  indique qu'ils sont confirmés séparément selon la destination.

---

## Structure

| Fichier / dossier                              | Rôle                                                        |
| ---------------------------------------------- | ----------------------------------------------------------- |
| `catalogue.js`                                 | Prix et articles achetables. Source unique, navigateur + serveur. |
| `boutique.js`                                  | Panier (localStorage), boutons d'ajout, formulaire de détails. |
| `panier.html`                                  | Récapitulatif, quantités, totaux.                            |
| `paiement.html`                                | Coordonnées client, puis redirection vers Stripe Checkout.   |
| `commande-confirmee.html`                      | Relit l'état réel du paiement auprès de Stripe.              |
| `netlify/functions/create-checkout-session.js` | Crée la session de paiement. Seul endroit où vit la clé.     |
| `netlify/functions/get-order.js`               | Relit une commande payée.                                    |
| `tests/catalogue.test.js`                      | Tests de la fonction de paiement (`npm test`).               |
| `outils-galerie.py`                            | Recompose la galerie de « Mes réalisations » en rangées.     |
| `images/fond-rayures.png`                      | Les rayures du fond, seules.                                 |
| `images/filigrane-logo.webp`                   | Le médaillon du logo, en filigrane par-dessus les rayures.   |

### Deux principes du code de paiement

**Les prix ne viennent jamais du navigateur.** La page envoie des
identifiants d'articles et des quantités ; la fonction serveur relit les
montants dans `catalogue.js`. Un panier trafiqué dans la console ne peut pas
faire baisser la somme débitée.

**Les tarifs en fourchette ne sont pas arrondis d'office.** Les biscuits
standard (5 à 6 CHF) et grands (7 à 8 CHF) sont portés au panier mais exclus
du paiement en ligne : leur montant dépend de la personnalisation et est
confirmé avant la préparation. Le panier affiche donc deux totaux.

**Les biscuits supplémentaires n'existent pas seuls.** Ils se choisissent
dans la fenêtre qui s'ouvre à l'ajout d'un package, et voyagent attachés à
sa ligne de panier (`ligne.supplements`). Le minimum de 12 biscuits est donc
garanti par la structure des données, pas par une règle vérifiée après coup ;
la fonction serveur refuse quand même un supplément qui arriverait isolé.

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

## Modifier le catalogue

Tout se passe dans `catalogue.js`. Ajouter un package revient à ajouter une
entrée au tableau `ARTICLES`, puis à poser un bouton dans la page :

```html
<button type="button" class="btn btn-primary" data-ajout-panier="pack-nouveau">
  Ajouter au panier
</button>
```

Les montants sont **en centimes** : `7250` pour 72.50 CHF. Manipuler des
francs en virgule flottante finit toujours par produire un `72.49999999`.

---

## Développement local

```bash
npx http-server -p 8080 -s      # le site, sans les fonctions
npm test                        # tests de la fonction de paiement
```

Pour tester le paiement de bout en bout en local, il faut la CLI Netlify
(`netlify dev`) et un fichier `.env` contenant `STRIPE_SECRET_KEY`. Ce
fichier est ignoré par git.
