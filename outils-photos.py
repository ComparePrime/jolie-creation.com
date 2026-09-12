#!/usr/bin/env python3
"""Prépare les photos des cartes de collection.

    python3 outils-photos.py

Le script fait deux choses, dans cet ordre.

**1. Il dérive les vues de galerie depuis images/creations/.** La table
GALERIES ci-dessous dit, pour chaque collection, quelles photos du
portfolio montrent ce même assortiment. Elles deviennent
images/collections/<id>-1.webp, -2.webp… Une photo identique à la photo
de carte est écartée automatiquement : une galerie qui répète la grande
image au-dessus n'apprend rien.

**2. Il convertit en WebP tout original déposé dans images/collections/.**
Déposer magie-noel.jpg dans ce dossier suffit à obtenir magie-noel.webp.

Deux tailles, selon le rôle de la photo :

  magie-noel.jpg   -> magie-noel.webp     800 px, la photo de la carte
  automne-1.jpg    -> automne-1.webp      520 px, une vue de galerie

Les vues de galerie s'affichent par trois ou par six dans une carte : à
plus de 520 px, on paierait des pixels que personne ne voit.

Le script ne touche pas aux originaux et ne réécrit pas un WebP déjà à
jour : le relancer deux fois donne le même résultat.

Une règle tient tout le reste : **une vue de galerie doit montrer les
modèles de la collection.** Les biscuits de baptême d'Elio, par exemple,
sont de vraies photos mais d'autres modèles que le seul biscuit de la
collection « Baptême Douceur » : ils restent dans « Mes réalisations » et
n'apparaissent pas ici. Illustrer une collection avec un modèle qu'on ne
peut pas commander revient à le promettre.
"""
import pathlib
import re
import sys

from PIL import Image

RACINE = pathlib.Path(__file__).resolve().parent
DOSSIER = RACINE / 'images' / 'collections'
PORTFOLIO = RACINE / 'images' / 'creations'
COTE_CARTE = 800
COTE_GALERIE = 520
QUALITE = 78
SOURCES = {'.png', '.jpg', '.jpeg', '.tif', '.tiff', '.bmp'}
# « automne-3 » est une vue de galerie ; « magie-noel » est une carte.
GALERIE = re.compile(r'-\d+$')

# Collections dont le portfolio garde d'autres vues du même assortiment.
# L'ordre compte : c'est celui de la galerie sur la page.
GALERIES = {
    'automne': ['automne-1.jpeg', 'automne-2.jpeg', 'automne-3.jpeg',
                'automne-4.jpeg', 'automne-5.jpeg', 'automne-6.jpeg',
                'automne-7.jpeg'],
    'petit-ocean': ['anniversaire-ocean-etagere.jpg', 'anniversaire-ocean-leo.jpg',
                    'anniversaire-ocean-chiffre4.jpg', 'anniversaire-ocean-baleine.jpg',
                    'anniversaire-ocean-tortue.jpg', 'anniversaire-ocean-hippocampe.jpg',
                    'anniversaire-ocean-coquillage.jpg'],
    'reve-licorne': ['anniversaire-licorne.jpg', 'licorne-1.jpeg', 'licorne-2.jpeg',
                     'licorne-3.jpeg', 'licorne-4.jpeg', 'licorne-5.jpeg',
                     'prenom-eileen-1.jpg', 'prenom-eileen-2.jpg'],
    'petit-chantier': [f'chantier-{i}.jpeg' for i in range(1, 8)],
    'passion-cheval': [f'cheval-{i}.jpeg' for i in range(1, 6)],
    'moto': [f'moto-{i}.jpeg' for i in range(1, 6)],
    'petit-lapin-jardin': [f'naissance-lapin-{i}.jpg' for i in range(1, 4)],
    'annonce-grossesse': ['naissance-calendrier.jpg', 'art-ligne-coeur.jpg',
                          'coeur-nature.jpg'],
    'bonne-fete-maman': [f'fete-maman-{i}.jpg' for i in range(1, 4)],
}


def empreinte(chemin):
    """Empreinte perceptuelle sommaire : 16×16 en niveaux de gris, chaque
    pixel comparé à la moyenne. Deux recadrages de la même photo la
    partagent, deux photos différentes non."""
    im = Image.open(chemin).convert('L').resize((16, 16), Image.LANCZOS)
    pixels = im.tobytes()
    moyenne = sum(pixels) / len(pixels)
    return [p > moyenne for p in pixels]


def memes(a, b, tolerance=12):
    return sum(1 for x, y in zip(a, b) if x != y) <= tolerance


def convertir(source, cible, cote):
    image = Image.open(source)
    image.thumbnail((cote, cote), Image.LANCZOS)
    if image.mode not in ('RGB', 'RGBA'):
        image = image.convert('RGB')
    image.save(cible, 'WEBP', quality=QUALITE, method=6)


def deriver():
    """Écrit <id>-1.webp… depuis le portfolio. Renvoie la liste écrite."""
    ecrits = []
    for cid, photos in GALERIES.items():
        carte = DOSSIER / f'{cid}.webp'
        reference = empreinte(carte) if carte.exists() else None
        rang = 0
        for nom in photos:
            source = PORTFOLIO / nom
            if not source.exists():
                print(f'  photo introuvable : images/creations/{nom}', file=sys.stderr)
                continue
            if reference and memes(reference, empreinte(source)):
                continue          # c'est déjà la grande photo de la carte
            rang += 1
            cible = DOSSIER / f'{cid}-{rang}.webp'
            convertir(source, cible, COTE_GALERIE)
            ecrits.append((cible.name, nom, cible.stat().st_size))
        # Une galerie raccourcie ne doit pas laisser traîner ses anciens fichiers.
        trop = DOSSIER / f'{cid}-{rang + 1}.webp'
        while trop.exists():
            trop.unlink()
            rang += 1
            trop = DOSSIER / f'{cid}-{rang + 1}.webp'
    return ecrits


def deposees():
    """Convertit les originaux déposés à la main dans images/collections/."""
    faits, ignores = [], 0
    for source in sorted(DOSSIER.iterdir()):
        if source.suffix.lower() not in SOURCES:
            continue
        cible = source.with_suffix('.webp')
        if cible.exists() and cible.stat().st_mtime >= source.stat().st_mtime:
            ignores += 1
            continue
        convertir(source, cible,
                  COTE_GALERIE if GALERIE.search(source.stem) else COTE_CARTE)
        faits.append((source.name, cible.stat().st_size))
    return faits, ignores


def main():
    if not DOSSIER.is_dir():
        raise SystemExit(f'Dossier introuvable : {DOSSIER}')

    ecrits = deriver()
    for cible, source, taille in ecrits:
        print(f'{cible:28} ← {source:30} {taille / 1024:5.0f} ko')
    print(f'{len(ecrits)} vue(s) de galerie dérivées du portfolio.')

    faits, ignores = deposees()
    for nom, taille in faits:
        print(f'{nom:28} → {taille / 1024:5.0f} ko')
    print(f'{len(faits)} photo(s) déposées converties, {ignores} déjà à jour.')

    tous = sorted(DOSSIER.glob('*.webp'))
    total = sum(f.stat().st_size for f in tous)
    print(f'\n{len(tous)} WebP, {total / 1024:.0f} ko au total.')
    if total > 2_500_000:
        print('Attention : la page charge tout cela d’un coup.', file=sys.stderr)


if __name__ == '__main__':
    main()
