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

### 3. Activer la réception des commandes

Les commandes arrivent par **Netlify Forms**, sous le nom `commande`.
Cette réception doit être activée une fois :

**Site configuration → Forms → Enable form detection**, puis redéployer.
Les notifications par e-mail se règlent au même endroit.

C'est indispensable pour les deux modes : SumUp ne transporte qu'un
montant, ni l'adresse de livraison ni le détail des articles n'y
voyagent. Sans cette activation, une commande peut être payée sans que
son adresse arrive jamais.

### 4. Vérifier

Passer une commande de bout en bout, dans les deux modes. Le retrait ne
déclenche aucun paiement : la commande doit apparaître dans Netlify
Forms. La livraison doit en plus apparaître dans le tableau de bord
SumUp, avec la même référence `JC-AAAAMMJJ-XXXXXX`.

---

## Ce qui reste à faire avant l'ouverture de la boutique

- **Tarifs des collections du moment.** Halloween et Cocooning sont
  vendues à des montants d'attente (69 / 99 / 129 CHF). Ils sont
  regroupés dans `catalogue.js`, constante `PRIX_COLLECTION`. À
  remplacer avant d'encaisser quoi que ce soit.
- **Conditions générales de vente.** Une boutique en ligne suisse doit
  les publier et y renvoyer depuis le tunnel de commande. Elles
  n'existent pas encore sur le site.
- **Frais de livraison.** Ils ne sont pas facturés en ligne : le site
  indique qu'ils sont confirmés séparément selon la destination.
- **Formulaire de devis.** Il affiche un message de succès mais
  n'envoie rien nulle part. Le brancher sur Netlify Forms, comme les
  commandes, demande une seule ligne d'attribut.

---

## Structure

| Fichier / dossier                              | Rôle                                                        |
| ---------------------------------------------- | ----------------------------------------------------------- |
| `catalogue.js`                                 | Prix et articles achetables. Source unique, navigateur + serveur. |
| `boutique.js`                                  | Panier (localStorage), boutons d'ajout, formulaire de détails. |
| `panier.html`                                  | Récapitulatif, quantités, totaux.                            |
| `paiement.html`                                | Livraison ou retrait, coordonnées, puis départ vers SumUp.   |
| `commande-confirmee.html`                      | Relit l'état réel du paiement auprès de SumUp.               |
| `netlify/functions/create-checkout.js`         | Crée la session de paiement. Seul endroit où vit la clé.     |
| `netlify/functions/get-order.js`               | Relit l'état d'un paiement.                                  |
| `tests/catalogue.test.js`                      | Tests de la fonction de paiement (`npm test`).               |
| `outils-galerie.py`                            | Recompose la galerie de « Mes réalisations » en rangées.     |
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
donc vers Netlify Forms *avant* le départ vers le paiement, sous la même
référence `JC-AAAAMMJJ-XXXXXX`. C'est elle qui fait le lien entre les deux
enregistrements.

**Les biscuits supplémentaires n'existent pas seuls.** Ils se choisissent
dans la fenêtre qui s'ouvre à l'ajout d'un package ou d'une collection, et voyagent attachés à
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
