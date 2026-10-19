# -*- coding: utf-8 -*-
"""Régénère merchant-center-ch.xml : le flux produits pour Google
Merchant Center (marché suisse), au format RSS 2.0 avec l'espace de
noms g: (spécification officielle de Google Shopping).

    python3 outils-flux-marchand.py

Un fichier par marché cible — -ch pour la Suisse, -fr viendra pour la
France quand ses prix/frais de port seront décidés — jamais un seul
flux mélangeant deux devises ou deux politiques de livraison.

Source unique : Catalogue.ARTICLES, la même liste à plat que lit déjà
le serveur de paiement — jamais un prix ou un article recalculé ici.
Les biscuits seulEnPackage (composants internes d'un package, jamais
achetables seuls) et les collections encore sur devis (aucun prix
arrêté) n'y figurent pas : un flux marchand ne décrit que ce qui se
commande réellement, au prix affiché.

Idempotent : relancer le script donne le même fichier tant que le
catalogue n'a pas changé.
"""
import json
import pathlib
import subprocess
import xml.sax.saxutils as sax

RACINE = pathlib.Path(__file__).resolve().parent
SITE = 'https://jolie-creation.com'
SORTIE = RACINE / 'merchant-center-ch.xml'

LECTURE = """
const C = require('./catalogue.js');
const images = Object.fromEntries(C.COLLECTIONS.map((c) => [c.id, c.image]));
const slugs = Object.fromEntries(C.COLLECTIONS.map((c) => [c.id, c.slug || c.id]));
const descriptions = Object.fromEntries(C.COLLECTIONS.map((c) => [c.id, c.description]));
console.log(JSON.stringify(C.ARTICLES
  .filter((a) => !a.seulEnPackage)
  .map((a) => ({
    id: a.id,
    nom: a.nom,
    prix: a.prix,
    collection: a.collection,
    collectionId: a.collectionId,
    slug: slugs[a.collectionId],
    categorie: a.categorie,
    biscuits: a.biscuits,
    image: a.image || images[a.collectionId],
    description: descriptions[a.collectionId]
  }))));
"""


def articles():
    sortie = subprocess.run(['node', '-e', LECTURE], cwd=RACINE,
                            capture_output=True, text=True, check=True).stdout
    return json.loads(sortie)


def x(s):
    return sax.escape(s)


def prix_feed(centimes):
    """Google exige deux décimales et le code devise, toujours — jamais
    le format « 4 CHF » utilisé ailleurs sur le site pour l'affichage."""
    return f'{centimes / 100:.2f} CHF'


def titre(a):
    base = a['nom']
    if a['categorie'] == 'package':
        base += f" ({a['biscuits']} biscuits)"
    return f"{base} — {a['collection']}"


def item(a):
    lien = f"{SITE}/collections/{a['slug']}#{a['id']}"
    image = f"{SITE}/{a['image']}"
    return f'''    <item>
      <g:id>{x(a['id'])}</g:id>
      <title>{x(titre(a))}</title>
      <description>{x(a['description'])}</description>
      <link>{x(lien)}</link>
      <g:image_link>{x(image)}</g:image_link>
      <g:condition>new</g:condition>
      <g:availability>in stock</g:availability>
      <g:price>{prix_feed(a['prix'])}</g:price>
      <g:brand>Jolie Création</g:brand>
      <g:identifier_exists>no</g:identifier_exists>
      <g:google_product_category>Food, Beverages &amp; Tobacco &gt; Food Items &gt; Baked Goods &gt; Cookies</g:google_product_category>
      <g:product_type>Biscuits personnalisés &gt; {x(a['collection'])}</g:product_type>
    </item>'''


def main():
    tous = articles()

    ids = [a['id'] for a in tous]
    doublons = {i for i in ids if ids.count(i) > 1}
    assert not doublons, f'identifiants en double dans le flux : {doublons}'

    attendues = [RACINE / a['image'] for a in tous]
    manquantes = [str(p) for p in attendues if not p.exists()]
    assert not manquantes, f'image(s) introuvable(s) : {manquantes}'

    items = '\n'.join(item(a) for a in tous)
    sortie = f'''<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Jolie Création — Biscuits personnalisés</title>
    <link>{SITE}/biscuits-personnalises.html</link>
    <description>Biscuits personnalisés décorés à la main au glaçage royal, par collection.</description>
{items}
  </channel>
</rss>
'''
    SORTIE.write_text(sortie, encoding='utf-8')

    biscuits = sum(1 for a in tous if a['categorie'] == 'biscuit')
    packages = sum(1 for a in tous if a['categorie'] == 'package')
    print(f'{len(tous)} article(s) dans {SORTIE.name} ({biscuits} biscuits, {packages} packages)')


if __name__ == '__main__':
    main()
