#!/usr/bin/env python3
"""Écrit les collections dans les deux pages qui les mentionnent.

    python3 outils-collections.py

Une seule source, catalogue.js, et deux destinations aux rôles nets :

**mes-realisations.html** reçoit toutes les collections — grande photo,
nom, présentation, vues secondaires, nombre de modèles et bouton de
sélection. Les prix ne s'y affichent pas : ils apparaissent dans la
modale, au moment de choisir. C'est une galerie, pas une liste de tarifs.

**biscuits-personnalises.html** est la boutique : les collections du
moment y sont mises en avant en grandes cartes, puis toutes les autres
collections dans une grille, chacune avec son prix de départ « Dès X CHF »
(ou « Sur devis »). Ni modèle ni composition : le détail vit sur la page
de la collection, cette page ne fait qu'y mener.

Le script ne touche qu'aux zones délimitées par des repères. Il est
idempotent : le relancer deux fois donne le même résultat.
"""
import html
import json
import pathlib
import re
import subprocess
import urllib.parse

RACINE = pathlib.Path(__file__).resolve().parent
GALERIE_PAGE = RACINE / 'mes-realisations.html'
VITRINE = RACINE / 'biscuits-personnalises.html'
SITE = 'https://jolie-creation.com/'

LECTURE = """
const C = require('./catalogue.js');
console.log(JSON.stringify(C.COLLECTIONS.map((c) => ({
  id: c.id, nom: c.nom, occasion: c.occasion, description: c.description,
  alt: c.alt, image: c.image, saison: !!c.saison,
  packagesSeuls: !!c.packagesSeuls,
  galerie: (c.galerie || []).map((v) => ({ image: v.image, alt: v.alt })),
  produits: c.produits.map((p) => ({
    prix: p.prix,
    perso: (p.champs || []).map((ch) => ch.libelle),
    option: !!p.option
  })),
  packagesResume: c.packagesResume || '',
  packages: (c.packages || []).map((pk) => ({
    id: pk.id, nom: pk.nom, prix: pk.prix, prixTexte: C.formater(pk.prix),
    biscuits: pk.biscuits, resume: pk.resume || '', complet: !!pk.complet,
    horsSuisse: !!pk.horsSuisse,
    detail: pk.detail.map((d) => ({ qte: d.qte, nom: d.nom }))
  }))
}))));
"""


def collections():
    sortie = subprocess.run(['node', '-e', LECTURE], cwd=RACINE,
                            capture_output=True, text=True, check=True).stdout
    return json.loads(sortie)


def e(s):
    return html.escape(s, quote=True)


def chf(centimes):
    francs = centimes / 100
    return (str(int(francs)) if centimes % 100 == 0 else f'{francs:.2f}') + ' CHF'


def galerie(c, marge):
    if not c['galerie']:
        return ''
    vues = '\n'.join(
        f'{marge}  <figure><img src="{v["image"]}" alt="{e(v["alt"])}" '
        f'loading="lazy" decoding="async" width="399" height="600"></figure>'
        for v in c['galerie'])
    return (f'\n{marge}<div class="collection-galerie" role="group" '
            f'aria-label="Autres vues de la collection {e(c["nom"])}">\n'
            f'{vues}\n{marge}</div>')


def modeles(c, marge):
    """Combien de modèles, et rien de plus. Les prix s'affichent dans la
    modale, au moment de choisir : une liste de tarifs sous chaque
    collection transformait la galerie en catalogue e-commerce."""
    if c['packagesSeuls']:
        # Une collection du moment se commande en assortiments. Annoncer
        # ses modèles « à l'unité » promettrait un parcours qui n'existe
        # plus : on annonce les packages, qui eux existent.
        n = len(c['packages'])
        return (f'{marge}<ul class="collection-faits">\n'
                f'{marge}  <li>{n} package{"s" if n > 1 else ""} au choix, '
                f'composé{"s" if n > 1 else ""} d’avance</li>\n'
                f'{marge}  <li>Sans minimum de commande</li>\n'
                f'{marge}</ul>')
    if not c['produits']:
        # Pas de prix annoncé veut dire sur devis : la collection se
        # compose avec la cliente, elle ne se commande pas au panier.
        return (f'{marge}<ul class="collection-faits">\n'
                f'{marge}  <li>Sur devis, composé avec vous</li>\n'
                f'{marge}  <li>Formes, couleurs et quantité sur mesure</li>\n'
                f'{marge}</ul>')
    n = len(c['produits'])
    faits = [f'{n} modèle{"s" if n > 1 else ""} au choix, à commander à l’unité']
    perso = [p for p in c['produits'] if p['perso']]
    if perso:
        champs = sorted({x.lower() for p in perso for x in p['perso']})
        faits.append('Personnalisable&nbsp;: ' + ', '.join(champs))
    if any(p['option'] for p in c['produits']):
        faits.append('Personnalisation disponible en option')
    return (f'{marge}<ul class="collection-faits">\n'
            + '\n'.join(f'{marge}  <li>{t}</li>' for t in faits)
            + f'\n{marge}</ul>')


def action(c, marge):
    # Une collection du moment n'a pas de bouton ici : son cartouche de
    # packages, juste en dessous, porte la seule façon de la commander.
    if c['packagesSeuls']:
        return ''
    if c['produits']:
        return (f'{marge}<button type="button" class="btn btn-primary btn-small" '
                f'data-collection="{c["id"]}">Choisir mes biscuits</button>')
    lien = ('contact.html?formule=biscuits&theme='
            + urllib.parse.quote('Collection ' + c['nom']))
    return (f'{marge}<a class="btn btn-primary btn-small" href="{e(lien)}">'
            f'Demander un devis</a>')


def reperes(c):
    """La ligne de petits repères posée au-dessus du nom : l'occasion, et la
    pastille de saison quand il y en a une.

    L'occasion ne s'écrit que lorsqu'elle apprend quelque chose. Pour
    « Automne » ou « Saint-Valentin », elle répète mot pour mot le titre
    juste en dessous : deux fois le même mot, en deux tailles, ne fait pas
    une hiérarchie."""
    # La pastille passe en tête : elle est ainsi toujours à l'aplomb du
    # titre, que la collection porte une occasion ou non. Elle reste utile
    # même sous le titre de sa section : un lien direct (#automne) ou un
    # partage amène le visiteur sur le bloc seul, sans l'en-tête.
    marques = []
    if c['saison']:
        marques.append('<span class="collection-saison-pastille">Collection du moment</span>')
    if c['occasion'] != c['nom']:
        marques.append(f'<span class="collection-occasion">{e(c["occasion"])}</span>')
    if not marques:
        return ''
    return '\n          <p class="collection-meta">' + ''.join(marques) + '</p>'


def packages(c, marge):
    """Le cartouche qui mène aux packages d'une collection de saison.

    Deux lignes et un bouton, rien de plus : le choix se fait dans la
    modale, où les trois assortiments ont la place de se montrer. Trois
    cartes dépliées dans la page en faisaient une affiche, au milieu d'un
    portfolio.

    Une collection sans package n'écrit rien : le tableau vide est un état
    valable, pas un manque à combler."""
    if not c.get('packages'):
        return ''
    return (f'\n{marge}<div class="packages-invite">\n'
            f'{marge}  <div>\n'
            f'{marge}    <h4>Collection {e(c["nom"])}</h4>\n'
            f'{marge}    <p>{e(c["packagesResume"])}</p>\n'
            f'{marge}  </div>\n'
            f'{marge}  <button type="button" class="btn btn-primary btn-small" '
            f'data-packages="{e(c["id"])}">Découvrir les packages</button>\n'
            f'{marge}</div>')


def corps(c):
    """Les repères et le bouton, sans ligne vide quand il n'y a pas de
    bouton : une collection du moment n'en a plus."""
    return '\n'.join(x for x in (modeles(c, '          '),
                                 action(c, '          ')) if x)


def bloc(c, premier=False):
    """Une collection dans la galerie : photo, texte, vues, modèles, bouton.

    La toute première photo de la page est celle que le visiteur voit
    d'emblée : la différer retarderait l'affichage au lieu de l'accélérer.
    """
    charge = ('loading="eager" fetchpriority="high"' if premier
              else 'loading="lazy" fetchpriority="auto"')
    return f'''      <article class="collection-bloc" id="{c['id']}" aria-labelledby="t-{c['id']}">
        <div class="collection-photo">
          <img src="{c['image']}" alt="{e(c['alt'])}" {charge} decoding="async" data-photo-collection>
          <span class="collection-photo-repli" aria-hidden="true">{e(c['nom'])}</span>
        </div>
        <div class="collection-corps">{reperes(c)}
          <h3 id="t-{c['id']}">{e(c['nom'])}</h3>
          <p class="collection-texte">{e(c['description'])}</p>
{corps(c)}
        </div>{packages(c, '        ')}{galerie(c, '        ')}
      </article>'''


def prix_depart(c):
    """« Dès X CHF », au prix le plus bas réellement payable — jamais un
    prix inventé. Une collection du moment ne se vend qu'en packages :
    c'est leur prix plancher qui compte, pas celui, non vendable à
    l'unité, de ses modèles. Sans aucun prix arrêté, c'est un devis."""
    prix = ([pk['prix'] for pk in c['packages']] if c['packagesSeuls']
            else [p['prix'] for p in c['produits']])
    return f'Dès {chf(min(prix))}' if prix else 'Sur devis'


# Le filtre de la boutique classe chaque collection par occasion. La
# liste de gauche est celle, exacte, que porte chaque collection dans
# catalogue.js — une occasion qui n'y figure pas ne doit pas être
# inventée ici. « Mariage » reste un bouton du filtre sans aucune
# collection derrière : voir script.js pour l'état vide qu'il affiche.
GROUPES_OCCASION = {
    'Anniversaire': 'Anniversaire',
    'Anniversaire adulte': 'Anniversaire',
    'Anniversaire enfant': 'Anniversaire',
    'Premier anniversaire': 'Anniversaire',
    'Annonce de grossesse': 'Naissance',
    'Gender reveal': 'Naissance',
    'Baptême': 'Baptême',
    'Noël': 'Fêtes',
    'Pâques': 'Fêtes',
    'Saint-Valentin': 'Fêtes',
    'Fête des mères': 'Fêtes',
    'Fin d’année scolaire': 'Fêtes',
    'EVJF': 'Fêtes',
    'Entreprise': 'Entreprise'
}


def categorie_filtre(c):
    """La catégorie de filtre d'une collection, ou None si son occasion
    n'entre dans aucune des catégories proposées : elle reste alors
    visible sous « Toutes », simplement sans étiquette de filtre."""
    return GROUPES_OCCASION.get(c['occasion'])


def carte_saison(c, premier=False):
    """Une collection du moment, mise en avant sur la boutique : grande
    photo, nom, prix de départ, et un lien — jamais un choix de biscuit
    ici, la sélection se fait dans la modale des packages, comme
    partout ailleurs sur le site."""
    charge = ('loading="eager" fetchpriority="high"' if premier
              else 'loading="lazy" fetchpriority="auto"')
    return f'''        <a class="boutique-vedette" href="mes-realisations.html#{c['id']}">
          <span class="boutique-vedette-photo">
            <img src="{c['image']}" alt="{e(c['alt'])}" {charge} decoding="async" width="1000" height="1000">
          </span>
          <span class="boutique-vedette-corps">
            <span class="saison-occasion">Collection du moment</span>
            <span class="boutique-vedette-nom">{e(c['nom'])}</span>
            <span class="boutique-vedette-prix">{prix_depart(c)}</span>
            <span class="btn btn-primary btn-small">Découvrir</span>
          </span>
        </a>'''


def carte_boutique(c):
    """Une collection dans la grille « Toutes les collections » : image,
    nom, prix de départ, lien — rien de plus, le détail vit sur la page
    de la collection.

    Le lien pointe aujourd'hui vers la galerie existante : les pages
    /collections/<slug> n'existent pas encore, et il ne s'agit pas d'en
    fabriquer une fausse pour le principe. Le jour où elles existeront,
    seul ce lien change."""
    cat = categorie_filtre(c)
    attribut_cat = f' data-cat="{e(cat)}"' if cat else ''
    return f'''        <a class="gallery-item saison-carte" href="mes-realisations.html#{c['id']}"{attribut_cat}>
          <span class="saison-photo">
            <img src="{c['image']}" alt="{e(c['alt'])}" loading="lazy" decoding="async" width="600" height="600">
          </span>
          <span class="saison-corps">
            <span class="saison-occasion">{e(c['occasion'])}</span>
            <span class="saison-nom">{e(c['nom'])}</span>
            <span class="saison-prix">{prix_depart(c)}</span>
            <span class="saison-voir">Voir la collection</span>
          </span>
        </a>'''


def produit_structure(c):
    """La collection en donnees structurees.

    Une collection tarifee est un Product : elle a des modeles, des prix,
    et un panier. Une collection sur devis n'en est pas un — annoncer un
    Product sans prix revient a promettre a Google un produit qu'il ne
    peut pas afficher, et il le refuse. On la declare alors pour ce
    qu'elle est : une creation montree en portfolio.
    """
    # Ce qui se vend réellement : les packages pour une collection du
    # moment, les modèles pour les autres. Annoncer à Google un prix
    # plancher de 4 CHF sur une collection qui ne se vend plus qu'en
    # assortiments à 32.90 serait une fausse promesse.
    vendus = ([x['prix'] for x in c['packages']] if c['packagesSeuls']
              else [x['prix'] for x in c['produits']])
    p = {'@type': 'Product' if vendus else 'CreativeWork',
         'name': 'Biscuits personnalisés — collection ' + c['nom'],
         'description': c['description'],
         'url': SITE + 'mes-realisations.html#' + c['id'],
         'image': SITE + c['image']}
    if vendus:
        p['brand'] = {'@type': 'Brand', 'name': 'Jolie Création'}
        p['offers'] = {'@type': 'AggregateOffer', 'priceCurrency': 'CHF',
                       'lowPrice': f'{min(vendus) / 100:.2f}',
                       'highPrice': f'{max(vendus) / 100:.2f}',
                       'offerCount': len(vendus),
                       'availability': 'https://schema.org/InStock'}
    else:
        # Pas de prix public : l'auteur remplace la marque vendeuse.
        p['creator'] = {'@id': 'https://jolie-creation.com/#entreprise'}
    return p


def donnees_structurees(cols):
    return {
        '@context': 'https://schema.org', '@type': 'ItemList',
        'name': 'Collections de biscuits personnalisés — Jolie Création',
        'description': 'Toutes les collections de biscuits personnalisés décorés à '
                       'la main dans le canton de Fribourg, en Suisse.',
        'numberOfItems': len(cols),
        'itemListElement': [{'@type': 'ListItem', 'position': i + 1,
                             'item': produit_structure(c)} for i, c in enumerate(cols)]
    }


def remplacer(page, texte, nom, contenu):
    debut, fin = f'<!-- {nom} -->', f'<!-- /{nom} -->'
    motif = re.compile(re.escape(debut) + r'.*?' + re.escape(fin), re.DOTALL)
    if not motif.search(texte):
        raise SystemExit(f'Repère « {nom} » introuvable dans {page.name}.')
    return motif.sub(lambda _: debut + '\n' + contenu + '\n' + fin, texte, count=1)


def main():
    cols = collections()
    saison = [c for c in cols if c['saison']]

    t = GALERIE_PAGE.read_text(encoding='utf-8')
    t = remplacer(GALERIE_PAGE, t, 'collections:saison',
                  '\n\n'.join(bloc(c, i == 0) for i, c in enumerate(saison)))
    t = remplacer(GALERIE_PAGE, t, 'collections:toutes',
                  '\n\n'.join(bloc(c) for c in cols if not c['saison']))
    t = remplacer(GALERIE_PAGE, t, 'collections:jsonld',
                  '<script type="application/ld+json">\n'
                  + json.dumps(donnees_structurees(cols), ensure_ascii=False, indent=2)
                  + '\n</script>')
    GALERIE_PAGE.write_text(t, encoding='utf-8')

    # La grille « Toutes les collections » de la boutique ne reprend pas
    # les collections du moment : elles sont déjà mises en avant juste
    # au-dessus, et les dupliquer sur la même page n'apprendrait rien
    # de plus au visiteur.
    autres = [c for c in cols if not c['saison']]

    v = VITRINE.read_text(encoding='utf-8')
    v = remplacer(VITRINE, v, 'saison:apercu',
                  '\n\n'.join(carte_saison(c, i == 0) for i, c in enumerate(saison)))
    v = remplacer(VITRINE, v, 'boutique:grille',
                  '\n'.join(carte_boutique(c) for c in autres))
    VITRINE.write_text(v, encoding='utf-8')

    modeles_total = sum(len(c['produits']) for c in cols)
    print(f'{len(saison)} collection(s) du moment en tête de galerie, '
          f'{len(cols) - len(saison)} à la suite — sans doublon.')
    print(f'{len(cols)} collections et {modeles_total} modèles écrits dans '
          f'{GALERIE_PAGE.name}')
    print(f'{len(saison)} collection(s) du moment mises en avant, '
          f'{len(autres)} dans la grille de {VITRINE.name}')

    attendues = [c['image'] for c in cols] + [v['image'] for c in cols for v in c['galerie']]
    manquantes = [i for i in attendues if not (RACINE / i).exists()]
    if manquantes:
        print(f'\n{len(manquantes)} photo(s) manquante(s) :')
        for i in manquantes:
            print('  ' + i)

    sans_prix = [c['nom'] for c in cols if not c['produits']]
    if sans_prix:
        print('\nCollection(s) sans modèle tarifé : ' + ', '.join(sans_prix))


if __name__ == '__main__':
    main()
