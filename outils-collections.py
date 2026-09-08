#!/usr/bin/env python3
"""Régénère les cartes de collection de biscuits-personnalises.html.

La page ne recopie aucune donnée : les cartes, le sommaire et les données
structurées sont produits depuis catalogue.js. Ajouter une collection au
catalogue puis relancer ce script suffit — il n'y a jamais de prix à
retaper dans le HTML.

    python3 outils-collections.py

Le script ne touche qu'aux trois zones délimitées par des repères dans la
page (<!-- collections:liste -->, index, jsonld). Tout le reste du fichier
est laissé intact. Il est idempotent : le relancer deux fois donne le même
résultat.
"""
import html
import json
import pathlib
import re
import subprocess

RACINE = pathlib.Path(__file__).resolve().parent
PAGE = RACINE / 'biscuits-personnalises.html'
SITE = 'https://jolie-creation.com/'

LECTURE = """
const C = require('./catalogue.js');
console.log(JSON.stringify(C.COLLECTIONS.map((c) => ({
  id: c.id, nom: c.nom, occasion: c.occasion, description: c.description,
  alt: c.alt, image: c.image,
  min: Math.min(...c.produits.map((p) => p.prix)),
  max: Math.max(...c.produits.map((p) => p.prix)),
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


def carte(c):
    fourchette = chf(c['min']) if c['min'] == c['max'] else f"de {chf(c['min'])} à {chf(c['max'])}"
    perso = ('\n            <li>Modèles personnalisables au prénom, à l’âge ou '
             'au texte de votre choix</li>') if c['perso'] else ''
    return f'''      <section class="collection-carte" id="{c['id']}" aria-labelledby="t-{c['id']}">
        <div class="collection-photo">
          <img src="{c['image']}" alt="{e(c['alt'])}" loading="lazy" decoding="async" data-photo-collection>
          <span class="collection-photo-repli" aria-hidden="true">{e(c['nom'])}</span>
        </div>
        <div class="collection-corps">
          <span class="collection-occasion">{e(c['occasion'])}</span>
          <h2 id="t-{c['id']}">Collection {e(c['nom'])}</h2>
          <p class="collection-texte">{e(c['description'])}</p>
          <ul class="collection-faits">
            <li>{c['n']} modèle{'s' if c['n'] > 1 else ''} au choix, {fourchette} l’unité</li>{perso}
          </ul>
          <button type="button" class="btn btn-primary btn-small" data-collection="{c['id']}">Choisir mes biscuits</button>
        </div>
      </section>'''


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
            {'@type': 'ListItem', 'position': i + 1,
             'item': {'@type': 'Product',
                      'name': 'Biscuits personnalisés — collection ' + c['nom'],
                      'description': c['description'],
                      'url': SITE + 'biscuits-personnalises.html#' + c['id'],
                      'image': SITE + c['image'],
                      'brand': {'@type': 'Brand', 'name': 'Jolie Création'},
                      'offers': {'@type': 'AggregateOffer', 'priceCurrency': 'CHF',
                                 'lowPrice': f"{c['min'] / 100:.2f}",
                                 'highPrice': f"{c['max'] / 100:.2f}",
                                 'offerCount': c['n'],
                                 'availability': 'https://schema.org/InStock'}}}
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
    t = PAGE.read_text(encoding='utf-8')

    t = remplacer(t, 'collections:liste', '\n\n'.join(carte(c) for c in cols))
    t = remplacer(t, 'collections:index', '\n'.join(
        f'        <li><a href="#{c["id"]}">{e(c["nom"])}</a></li>' for c in cols))
    t = remplacer(t, 'collections:jsonld',
                  '<script type="application/ld+json">\n' +
                  json.dumps(donnees_structurees(cols), ensure_ascii=False, indent=2) +
                  '\n</script>')

    PAGE.write_text(t, encoding='utf-8')
    modeles = sum(c['n'] for c in cols)
    print(f'{len(cols)} collections, {modeles} modèles écrits dans {PAGE.name}')

    manquantes = [c['id'] for c in cols if not (RACINE / c['image']).exists()]
    if manquantes:
        print(f'\n{len(manquantes)} photo(s) encore attendue(s) dans images/collections/ :')
        for i in manquantes:
            print('  ' + i + '.webp')
        print('En attendant, ces cartes affichent le nom de la collection.')


if __name__ == '__main__':
    main()
