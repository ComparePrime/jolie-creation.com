#!/usr/bin/env python3
"""Régénère les cartes de collection de biscuits-personnalises.html.

La page ne recopie aucune donnée : les cartes, le sommaire et les données
structurées sont produits depuis catalogue.js. Ajouter une collection au
catalogue puis relancer ce script suffit — il n'y a jamais de prix à
retaper dans le HTML.

    python3 outils-collections.py

Le script ne touche qu'aux quatre zones délimitées par des repères dans
la page (vedettes, liste, index, jsonld). Tout le reste du fichier est
laissé intact. Il est idempotent : le relancer deux fois donne le même
résultat.

Deux blocs de cartes, décidés par le seul drapeau « saison » du
catalogue : les collections du moment en haut de page, avec une
présentation plus large, les autres ensuite. Retirer le drapeau fait
redescendre une collection sans rien changer d'autre.
"""
import html
import json
import pathlib
import re
import subprocess
import urllib.parse

RACINE = pathlib.Path(__file__).resolve().parent
PAGE = RACINE / 'biscuits-personnalises.html'
SITE = 'https://jolie-creation.com/'

LECTURE = """
const C = require('./catalogue.js');
console.log(JSON.stringify(C.COLLECTIONS.map((c) => ({
  id: c.id, nom: c.nom, occasion: c.occasion, description: c.description,
  alt: c.alt, image: c.image, saison: !!c.saison,
  galerie: (c.galerie || []).map((v) => ({ image: v.image, alt: v.alt })),
  min: c.produits.length ? Math.min(...c.produits.map((p) => p.prix)) : null,
  max: c.produits.length ? Math.max(...c.produits.map((p) => p.prix)) : null,
  n: c.produits.length,
  perso: c.produits.some((p) => p.champs.length || p.option)
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
    texte = str(int(francs)) if centimes % 100 == 0 else f'{francs:.2f}'
    return texte + ' CHF'


def faits(c, marge):
    """Ce qu'on peut annoncer sans rien inventer. Une collection dont les
    modèles ne sont pas encore tarifés annonce qu'ils arrivent, et rien
    de plus : un prix supposé serait un prix faux."""
    lignes = []
    if c['n']:
        fourchette = (chf(c['min']) if c['min'] == c['max']
                      else f"de {chf(c['min'])} à {chf(c['max'])}")
        lignes.append(f"{c['n']} modèle{'s' if c['n'] > 1 else ''} au choix, "
                      f"{fourchette} l’unité")
        if c['perso']:
            lignes.append('Modèles personnalisables au prénom, à l’âge ou '
                          'au texte de votre choix')
    else:
        lignes.append('Modèles et tarifs en cours de préparation')
        lignes.append('Écrivez-moi pour réserver vos biscuits de saison')
    return '\n'.join(f'{marge}<li>{t}</li>' for t in lignes)


def action(c, marge):
    """Le bouton n'existe que si la collection a quelque chose à vendre.
    Une modale vide serait une impasse ; le devis, lui, aboutit."""
    if c['n']:
        return (f'{marge}<button type="button" class="btn btn-primary btn-small" '
                f'data-collection="{c["id"]}">Choisir mes biscuits</button>')
    lien = ('contact.html?formule=biscuits&theme='
            + urllib.parse.quote('Collection ' + c['nom']))
    return (f'{marge}<a class="btn btn-primary btn-small" href="{e(lien)}">'
            f'Demander la collection {e(c["nom"])}</a>')


def galerie(c, marge):
    """La galerie est posée sous les deux colonnes, pas dans la colonne de
    texte : elle y gagne toute la largeur de la carte, et la photo de
    gauche cesse d'être étirée par sa hauteur."""
    if not c['galerie']:
        return ''
    vues = '\n'.join(
        f'{marge}  <figure><img src="{v["image"]}" alt="{e(v["alt"])}" '
        f'loading="lazy" decoding="async" width="399" height="600"></figure>'
        for v in c['galerie'])
    return (f'\n{marge}<div class="collection-galerie" role="group" '
            f'aria-label="Autres vues de la collection {e(c["nom"])}">\n'
            f'{vues}\n{marge}</div>')


def carte(c):
    """Une seule carte pour les vingt et une collections : la grande photo,
    le texte, puis les autres vues de l'assortiment. Les collections du
    moment n'en changent pas la forme — elles y ajoutent une pastille et
    remontent dans leur propre section."""
    if c['saison']:
        classe, occasion = ' collection-vedette', (
            '<span class="collection-occasion collection-saison">'
            'Collection du moment</span>')
    else:
        classe, occasion = '', (
            f'<span class="collection-occasion">{e(c["occasion"])}</span>')
    return f'''      <section class="collection-carte{classe}" id="{c['id']}" aria-labelledby="t-{c['id']}">
        <div class="collection-photo">
          <img src="{c['image']}" alt="{e(c['alt'])}" loading="lazy" decoding="async" data-photo-collection>
          <span class="collection-photo-repli" aria-hidden="true">{e(c['nom'])}</span>
        </div>
        <div class="collection-corps">
          {occasion}
          <h3 id="t-{c['id']}">Collection {e(c['nom'])}</h3>
          <p class="collection-texte">{e(c['description'])}</p>
          <ul class="collection-faits">
{faits(c, '            ')}
          </ul>
{action(c, '          ')}
        </div>{galerie(c, '        ')}
      </section>'''


def produit(c):
    """Un Product par collection. Pas d'offre tant qu'aucun prix n'est
    arrêté : une AggregateOffer inventée est un prix faux, et Google la
    confronte à la page."""
    p = {'@type': 'Product',
         'name': 'Biscuits personnalisés — collection ' + c['nom'],
         'description': c['description'],
         'url': SITE + 'biscuits-personnalises.html#' + c['id'],
         'image': SITE + c['image'],
         'brand': {'@type': 'Brand', 'name': 'Jolie Création'}}
    if c['n']:
        p['offers'] = {'@type': 'AggregateOffer', 'priceCurrency': 'CHF',
                       'lowPrice': f"{c['min'] / 100:.2f}",
                       'highPrice': f"{c['max'] / 100:.2f}",
                       'offerCount': c['n'],
                       'availability': 'https://schema.org/InStock'}
    return p


def donnees_structurees(cols):
    """Un ItemList : c'est la structure réelle de la page, pas une
    déclaration de circonstance."""
    return {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        'name': 'Collections de biscuits personnalisés — Jolie Création',
        'description': 'Collections de biscuits personnalisés décorés à la main '
                       'dans le canton de Fribourg, en Suisse.',
        'numberOfItems': len(cols),
        'itemListElement': [
            {'@type': 'ListItem', 'position': i + 1, 'item': produit(c)}
            for i, c in enumerate(cols)]
    }


def remplacer(texte, nom, contenu):
    debut, fin = f'<!-- {nom} -->', f'<!-- /{nom} -->'
    motif = re.compile(re.escape(debut) + r'.*?' + re.escape(fin), re.DOTALL)
    if not motif.search(texte):
        raise SystemExit(f'Repère « {nom} » introuvable dans {PAGE.name}.')
    return motif.sub(lambda _: debut + '\n' + contenu + '\n' + fin, texte, count=1)


def main():
    cols = collections()
    vedettes = [c for c in cols if c['saison']]
    autres = [c for c in cols if not c['saison']]
    t = PAGE.read_text(encoding='utf-8')

    t = remplacer(t, 'collections:vedettes', '\n\n'.join(carte(c) for c in vedettes))
    t = remplacer(t, 'collections:liste', '\n\n'.join(carte(c) for c in autres))
    t = remplacer(t, 'collections:index', '\n'.join(
        f'        <li><a href="#{c["id"]}">{e(c["nom"])}</a>'
        + (' <span class="index-saison">du moment</span>' if c['saison'] else '')
        + '</li>' for c in cols))
    t = remplacer(t, 'collections:jsonld',
                  '<script type="application/ld+json">\n' +
                  json.dumps(donnees_structurees(cols), ensure_ascii=False, indent=2) +
                  '\n</script>')

    PAGE.write_text(t, encoding='utf-8')
    modeles = sum(c['n'] for c in cols)
    print(f'{len(cols)} collections ({len(vedettes)} du moment, {len(autres)} '
          f'permanentes), {modeles} modèles écrits dans {PAGE.name}')

    attendues = [c['image'] for c in cols] + [v['image'] for c in cols for v in c['galerie']]
    manquantes = [i for i in attendues if not (RACINE / i).exists()]
    if manquantes:
        print(f'\n{len(manquantes)} photo(s) encore attendue(s) :')
        for i in manquantes:
            print('  ' + i)
        print('En attendant, ces cartes affichent le nom de la collection.')

    sans_prix = [c['nom'] for c in cols if not c['n']]
    if sans_prix:
        print('\nCollection(s) sans modèle tarifé, affichée(s) mais pas '
              'achetable(s) : ' + ', '.join(sans_prix))


if __name__ == '__main__':
    main()
