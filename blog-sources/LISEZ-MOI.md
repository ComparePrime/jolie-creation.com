# Ajouter un article au blog

Un article = un fichier dans ce dossier, nommé `NN-slug.md` (NN = rang dans sa catégorie).

```
titre: Titre affiché en H1
slug: mot-cle-principal-de-l-url
categorie: biscuits            (ou : micro)
date: 2026-11-14
extrait: Deux phrases pour la carte du blog.
image: images/collections/…/photo-existante.webp
image_nom: nom-descriptif-du-fichier-derive
image_alt: Ce que montre réellement la photo
meta_title: 60 caractères maximum
meta_description: 155 caractères maximum
lies: slug-article-1, slug-article-2   (articles « à lire aussi »)
---
Texte en Markdown simplifié : ## titre, ### sous-titre, - liste,
1. liste numérotée, > encadré conseil, **gras**, [lien](/chemin),
![alt](images/…webp "légende")
```

Puis, depuis la racine du dépôt :

```
python3 outils-blog.py        # pages, accueil du blog, images WebP dérivées
python3 outils-jsonld.py      # socle de données structurées
python3 outils-sitemap.py     # sitemap.xml (les dates viennent de git)
npm test
```

Règles de la maison (voir CLAUDE.md) : jamais « Domdidier » (écrire « canton de
Fribourg »), pas d’emoji, aucune donnée inventée (réalisations, prix, adresses),
une photo qui existe déjà sur le site et qui illustre réellement le sujet.

## Plan SEO : qui cible quoi

Les pages commerciales gardent les requêtes d’achat (« biscuits personnalisés »,
« commander », « micro-scénographie devis »). Les articles ciblent l’information
et les longues traînes (idées, comment choisir, délai, fabrication), et renvoient
vers la page commerciale correspondante avec un lien descriptif.

| Article | Requête principale (intention informationnelle) | Page commerciale vers laquelle il renvoie |
| --- | --- | --- |
| idées par occasion | biscuits personnalisés occasions | /biscuits-personnalises.html |
| baptême | biscuits personnalisés baptême idées | /collections/bapteme-nature |
| anniversaire | choisir thème anniversaire biscuits | /biscuits-personnalises.html |
| mariage | biscuits personnalisés mariage cadeau invités | /contact.html (sur devis) |
| naissance, baby shower | biscuits baby shower, gender reveal | collections Annonce de grossesse, Gender Reveal |
| fabrication | glaçage royal fabrication biscuits | /a-propos.html |
| prénom | biscuits personnalisés prénom | collections personnalisables |
| table de fête | biscuits pour décorer une table | /biscuits-personnalises.html |
| délai | délai commande biscuits personnalisés | /biscuits-personnalises.html |
| artisanaux | biscuits artisanaux fait main | /biscuits-personnalises.html |
| micro-scénographie (concept) | qu’est-ce qu’une micro-scénographie | /micro-scenographies.html |
| anniversaire, enfant, baptême | micro-scénographie anniversaire / baptême | /micro-scenographies.html |
| thème, univers, détails, préparation | choisir thème, décoration harmonieuse | /micro-scenographies.html |
| photos, inspirations | micro-scénographie souvenirs, exemples | /mes-realisations.html |
