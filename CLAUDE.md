# Jolie Création

Site vitrine et boutique en ligne d'une artisane suisse : biscuits
personnalisés décorés à la main, et micro-scénographies événementielles.

HTML, CSS et JavaScript statiques, **sans étape de build**. Ce qui est
dans le dépôt est ce qui est servi. Le `README.md` détaille chaque
mécanisme ; ce fichier ne garde que ce qu'on ne peut pas deviner en
lisant le code.

## Commandes

```bash
npm test                 # 51 contrôles du catalogue + 13 de l'envoi d'e-mails
python3 outils-*.py      # régénèrent les zones balisées (voir plus bas)
```

`npm run test:navigateur` existe mais son dossier est vide : les suites
Playwright sont mises de côté, à verser plus tard.

## Les quatre règles qui ne se devinent pas

**`catalogue.js` est la source unique.** Le navigateur et les fonctions
serverless le lisent tous les deux — esbuild l'embarque dans le bundle
des fonctions. Ne jamais recalculer un prix, un nombre de biscuits ou un
minimum ailleurs : les deux côtés se contrediraient.

**Les montants sont des centimes entiers.** La conversion en francs a
lieu une seule fois, au bord de l'API SumUp, via `Catalogue.enFrancs()`.
Additionner des francs en virgule flottante finit toujours par produire
un `6.49999999`.

**Les zones balisées sont générées, jamais écrites à la main.** Entre
`<!-- nom -->` et `<!-- /nom -->`, tout est réécrit par un outil Python.
Une correction faite à la main y disparaît à la prochaine exécution.

| Repère | Outil |
| --- | --- |
| `collections:saison`, `collections:toutes`, `collections:jsonld`, `saison:apercu` | `outils-collections.py` |
| `socle:jsonld` | `outils-jsonld.py` |
| les rangées de `folio-masonry` | `outils-galerie.py` |

`outils-photos.py` dérive les vues et convertit en WebP,
`outils-webp.py` convertit les photos encore servies en JPEG,
`outils-sitemap.py` régénère `sitemap.xml`. Tous sont idempotents.

**Netlify publie la racine** (`publish = "."`). Tout fichier déposé à la
racine du dépôt part en ligne. Les identifiants SMTP et SumUp vivent
uniquement dans les variables d'environnement Netlify, jamais ici.

## Règles métier en vigueur

- **Minimum de commande : douze biscuits**, et ce sont les biscuits pris
  à l'unité, toutes collections confondues. Un package n'entre pas dans
  les douze et n'en dispense pas.
- **Une collection du moment ne se vend qu'en packages.** Le drapeau se
  déduit des données : une collection qui porte un tableau `packages`
  bascule, et ses modèles reçoivent `seulEnPackage`. Ils restent au
  catalogue pour les compositions, pas pour la vente.
- Les micro-scénographies passent par un devis, jamais par le panier.
- Sur téléphone, une réalisation montre quatre photos au plus : celle
  d'ouverture et trois vues.

## Contenu

- **Ne jamais afficher « Domdidier ».** Écrire « Canton de Fribourg »,
  et « Suisse » ou « Suisse romande » quand c'est pertinent.
- **Aucune donnée inventée dans le JSON-LD** : ni adresse, ni horaires,
  ni numéro IDE. L'adresse postale complète n'existe pas dans le projet,
  et le socle ne déclare donc que la région et le pays.
- Aucun emoji. Aucun bourrage de mots-clés.

## Travail

Développer sur la branche `claude/jolie-creation-homepage-ug6otx`, puis
pousser. Vérifier au navigateur en 1280 px **et** en 390 px : plusieurs
défauts réels ne se voient qu'à l'une des deux largeurs.

Un défaut connu, non corrigé : à 390 px, la modale de choix modèle par
modèle dépasse de 10 px et rogne le bas de son bouton.
