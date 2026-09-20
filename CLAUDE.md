# Jolie Création

Site vitrine et boutique en ligne d'une artisane suisse : biscuits
personnalisés décorés à la main, et micro-scénographies événementielles.

**Site statique déployé sur Netlify, sans framework ni étape de build.**
HTML, CSS et JavaScript servis tels quels. Ce qui est dans le dépôt est
ce qui est en ligne.

## Méthode

**Avant de coder, chercher et comprendre l'existant.** Le code porte ses
raisons en commentaire : les lire évite de défaire une décision prise
pour un motif qu'on n'a pas encore rencontré.

**Modifier le strict nécessaire.** Une correction se limite à ce que la
demande exige. Le reste, même perfectible, ne bouge pas.

**Ne pas toucher aux règles métier sans demande explicite.** Prix,
compositions, minimum de commande, conditions de livraison : ce sont des
décisions commerciales, pas des détails d'implémentation.

**Ne pas ajouter de dépendance sans nécessité.** Le projet n'a qu'une
dépendance, `nodemailer`, et pas d'étape de build. Ce dénuement est un
choix : il se défend avant d'être entamé.

## Règles métier en vigueur

**Un package n'est pas un biscuit individuel.** Ce sont deux articles de
nature différente, et le code les distingue par leur `categorie`.

**Le minimum de douze ne porte que sur les biscuits pris à l'unité**,
toutes collections confondues. Le contenu d'un package n'entre jamais
dans le compte des douze, et n'en dispense pas davantage.

**Un package se commande seul.** Sans minimum, et sans rien d'autre au
panier. Deux packages ensemble aussi.

Un panier mêlant un package et des biscuits à l'unité est accepté dès
lors que les biscuits à l'unité atteignent douze à eux seuls.

Autres règles en place : une collection du moment ne se vend qu'en
packages ; les micro-scénographies passent par un devis, jamais par le
panier.

## Vérifier

**Après toute modification du panier ou du catalogue, lancer `npm test`**
(51 contrôles du catalogue, 13 de l'envoi d'e-mails).

**Préserver le fonctionnement sur mobile et sur ordinateur.** Vérifier en
1280 px **et** en 390 px : plusieurs défauts réels ne se voient qu'à
l'une des deux largeurs.

## Sécurité

**Aucun secret côté client.** Les identifiants SMTP et les clés SumUp
vivent uniquement dans les variables d'environnement Netlify. Ils ne
figurent ni dans le dépôt, ni dans un fichier servi, ni dans un
commentaire. Le paiement se crée dans une fonction serverless, jamais
depuis le navigateur.

Netlify publie la racine (`publish = "."`) : **tout fichier déposé à la
racine du dépôt part en ligne.**

## Repères du projet

Le `README.md` détaille chaque mécanisme. Voici seulement ce qui se paie
cher à redécouvrir.

**`catalogue.js` est la source unique.** Le navigateur et les fonctions
serverless le lisent tous les deux — esbuild l'embarque dans le bundle
des fonctions. Ne jamais recalculer un prix, un nombre de biscuits ou un
minimum ailleurs : les deux côtés finiraient par se contredire.

**Les montants sont des centimes entiers.** La conversion en francs a
lieu une seule fois, au bord de l'API SumUp, via `Catalogue.enFrancs()`.

**Les zones balisées sont générées, jamais écrites à la main.** Entre
`<!-- nom -->` et `<!-- /nom -->`, tout est réécrit par un outil Python ;
une correction faite à la main y disparaît à la prochaine exécution.

| Repère | Outil |
| --- | --- |
| `collections:saison`, `collections:toutes`, `collections:jsonld`, `saison:apercu` | `outils-collections.py` |
| `socle:jsonld` | `outils-jsonld.py` |
| les rangées de `folio-masonry` | `outils-galerie.py` |

`outils-photos.py` et `outils-webp.py` dérivent et convertissent les
photos, `outils-sitemap.py` régénère `sitemap.xml`. Tous sont
idempotents.

## Préserver le SEO en modifiant le HTML

Chaque page indexable porte un `title` et une `description` uniques, un
`canonical`, un seul `h1`, et un socle de données structurées. Une
modification du HTML les conserve.

**Une seule exception, à ne pas « corriger » :**
`google7d9b2945715a70db.html` est le fichier de vérification Google
Search Console. Il n'a ni titre, ni description, ni `h1`, ni canonical,
et doit rester tel quel — Google le lit à l'octet près.

- **Ne jamais afficher « Domdidier ».** Écrire « Canton de Fribourg », et
  « Suisse » ou « Suisse romande » quand c'est pertinent.
- **Aucune donnée inventée dans le JSON-LD** : ni adresse, ni horaires,
  ni numéro IDE. L'adresse postale complète n'existe pas dans le projet ;
  le socle ne déclare donc que la région et le pays.
- Aucun emoji, aucun bourrage de mots-clés.
- Les anciennes adresses gardent leurs redirections 301 et leur
  `noindex`.

## Travail

Développer sur la branche `claude/jolie-creation-homepage-ug6otx`, puis
pousser.

**Les modales entrent en fondu** — `translateY(10px)` vers zéro, en
trois cents millisecondes environ. Une mesure prise trop tôt trouve leur
pied dix pixels sous l'écran et conclut à un débordement qui n'existe
pas. Attendre qu'elles s'installent avant de mesurer quoi que ce soit.
La même prudence vaut pour les révélations au défilement.
