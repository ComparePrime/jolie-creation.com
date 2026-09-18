#!/usr/bin/env python3
"""Écrit les collections dans les deux pages qui les mentionnent.

    python3 outils-collections.py

Une seule source, catalogue.js, et deux destinations aux rôles nets :

**mes-realisations.html** reçoit toutes les collections — grande photo,
nom, présentation, vues secondaires, nombre de modèles et bouton de
sélection. Les prix ne s'y affichent pas : ils apparaissent dans la
modale, au moment de choisir. C'est une galerie, pas une liste de tarifs.

**biscuits-personnalises.html** ne reçoit qu'un aperçu court des
collections de saison : photo, nom, une ligne, et un lien vers la galerie.
Ni modèle ni prix. Cette page présente la prestation, pas le catalogue.

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
{modeles(c, '          ')}
{action(c, '          ')}
        </div>{packages(c, '        ')}{galerie(c, '        ')}
      </article>'''


def apercu(c):
    """Une collection de saison sur la page vitrine : ni modèle, ni prix."""
    return f'''        <a class="saison-carte" href="mes-realisations.html#{c['id']}">
          <span class="saison-photo">
            <img src="{c['image']}" alt="{e(c['alt'])}" loading="lazy" decoding="async" width="800" height="800">
          </span>
          <span class="saison-corps">
            <span class="saison-occasion">{e(c['occasion'])}</span>
            <span class="saison-nom">{e(c['nom'])}</span>
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
    p = {'@type': 'Product' if c['produits'] else 'CreativeWork',
         'name': 'Biscuits personnalisés — collection ' + c['nom'],
         'description': c['description'],
         'url': SITE + 'mes-realisations.html#' + c['id'],
         'image': SITE + c['image']}
    if c['produits']:
        prix = [x['prix'] for x in c['produits']]
        p['brand'] = {'@type': 'Brand', 'name': 'Jolie Création'}
        p['offers'] = {'@type': 'AggregateOffer', 'priceCurrency': 'CHF',
                       'lowPrice': f'{min(prix) / 100:.2f}',
                       'highPrice': f'{max(prix) / 100:.2f}',
                       'offerCount': len(prix),
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

    v = VITRINE.read_text(encoding='utf-8')
    v = remplacer(VITRINE, v, 'saison:apercu', '\n'.join(apercu(c) for c in saison))
    VITRINE.write_text(v, encoding='utf-8')

    modeles_total = sum(len(c['produits']) for c in cols)
    print(f'{len(saison)} collection(s) du moment en tête de galerie, '
          f'{len(cols) - len(saison)} à la suite — sans doublon.')
    print(f'{len(cols)} collections et {modeles_total} modèles écrits dans '
          f'{GALERIE_PAGE.name}')
    print(f'{len(saison)} collection(s) de saison en aperçu dans {VITRINE.name} '
          f'— sans modèle ni prix')

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
