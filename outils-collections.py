#!/usr/bin/env python3
"""Écrit les collections dans la boutique.

    python3 outils-collections.py

Une seule source, catalogue.js, une destination : **biscuits-
personnalises.html**, la boutique. Les collections du moment y sont
mises en avant en grandes cartes, puis toutes les autres collections
dans une grille, chacune avec son prix de départ « Dès X CHF » (ou
« Sur devis »). Ni modèle ni composition : le détail vit sur la page de
la collection, cette page ne fait qu'y mener.

mes-realisations.html ne reçoit plus rien de ce script : c'est un
portfolio à sélection éditoriale (une dizaine de réalisations choisies
à la main, avec avis), écrit directement dans son HTML plutôt que
généré mécaniquement pour les 26 collections.

Le script ne touche qu'aux zones délimitées par des repères. Il est
idempotent : le relancer deux fois donne le même résultat.
"""
import html
import json
import pathlib
import subprocess
import re

RACINE = pathlib.Path(__file__).resolve().parent
VITRINE = RACINE / 'biscuits-personnalises.html'

LECTURE = """
const C = require('./catalogue.js');
console.log(JSON.stringify(C.COLLECTIONS.map((c) => ({
  id: c.id, slug: c.slug, nom: c.nom, occasion: c.occasion, description: c.description,
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
    return f'''        <a class="boutique-vedette" href="collections/{c['slug']}">
          <span class="boutique-vedette-photo">
            <img src="{c['image']}" alt="{e(c['alt'])}" {charge} decoding="async" width="1000" height="1000">
          </span>
          <span class="boutique-vedette-corps">
            <span class="saison-occasion">Collection du moment</span>
            <span class="boutique-vedette-nom">{e(c['nom'])}</span>
            <span class="boutique-vedette-prix">{prix_depart(c)}</span>
            <span class="btn btn-primary btn-small">{'Voir les packages' if c['packagesSeuls'] else 'Découvrir'}</span>
          </span>
        </a>'''


def carte_boutique(c):
    """Une collection dans la grille « Toutes les collections » : image,
    nom, prix de départ, lien — rien de plus, le détail vit sur la page
    de la collection."""
    cat = categorie_filtre(c)
    attribut_cat = f' data-cat="{e(cat)}"' if cat else ''
    return f'''        <a class="gallery-item saison-carte" href="collections/{c['slug']}"{attribut_cat}>
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


def remplacer(page, texte, nom, contenu):
    debut, fin = f'<!-- {nom} -->', f'<!-- /{nom} -->'
    motif = re.compile(re.escape(debut) + r'.*?' + re.escape(fin), re.DOTALL)
    if not motif.search(texte):
        raise SystemExit(f'Repère « {nom} » introuvable dans {page.name}.')
    return motif.sub(lambda _: debut + '\n' + contenu + '\n' + fin, texte, count=1)


def main():
    cols = collections()
    saison = [c for c in cols if c['saison']]

    # La grille « Toutes les collections » de la boutique ne reprend pas
    # les collections du moment : elles sont déjà mises en avant juste
    # au-dessus, et les dupliquer sur la même page n'apprendrait rien
    # de plus au visiteur. Elle ne reprend pas non plus les collections
    # encore sur devis (aucun produit tarifé) : la boutique ne présente
    # que ce qui se commande réellement. Le critère est le même que
    # celui de prix_depart() plus haut, pour qu'une collection encore
    # sur devis n'apparaisse jamais dans la grille avec un faux prix.
    autres = [c for c in cols if not c['saison'] and c['produits']]

    v = VITRINE.read_text(encoding='utf-8')
    v = remplacer(VITRINE, v, 'saison:apercu',
                  '\n\n'.join(carte_saison(c, i == 0) for i, c in enumerate(saison)))
    v = remplacer(VITRINE, v, 'boutique:grille',
                  '\n'.join(carte_boutique(c) for c in autres))
    VITRINE.write_text(v, encoding='utf-8')

    print(f'{len(saison)} collection(s) du moment mises en avant, '
          f'{len(autres)} dans la grille de {VITRINE.name}')

    attendues = [c['image'] for c in cols] + [g['image'] for c in cols for g in c['galerie']]
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
