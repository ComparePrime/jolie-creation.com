#!/usr/bin/env python3
"""Convertit les photos de collection en WebP, au format attendu par le site.

Déposer les photos dans images/collections/ sous le nom de la collection
(magie-noel.jpg, magie-noel.png…), puis lancer :

    python3 outils-photos.py

Chaque fichier est réduit à 800 px sur son plus grand côté et réenregistré
en WebP à côté de l'original. La page en charge vingt d'un coup : les
originaux de l'appareil photo pèsent ensemble plusieurs mégaoctets, les
WebP moins d'un.

Le script ne touche pas aux originaux et ne réécrit pas un WebP déjà à
jour : le relancer deux fois donne le même résultat.
"""
import pathlib
import sys

from PIL import Image

DOSSIER = pathlib.Path(__file__).resolve().parent / 'images' / 'collections'
COTE = 800
QUALITE = 78
SOURCES = {'.png', '.jpg', '.jpeg', '.tif', '.tiff', '.bmp'}


def convertir(source, cible):
    image = Image.open(source)
    image.thumbnail((COTE, COTE), Image.LANCZOS)
    if image.mode not in ('RGB', 'RGBA'):
        image = image.convert('RGB')
    image.save(cible, 'WEBP', quality=QUALITE, method=6)


def main():
    if not DOSSIER.is_dir():
        raise SystemExit(f'Dossier introuvable : {DOSSIER}')

    faits, ignores = [], 0
    for source in sorted(DOSSIER.iterdir()):
        if source.suffix.lower() not in SOURCES:
            continue
        cible = source.with_suffix('.webp')
        if cible.exists() and cible.stat().st_mtime >= source.stat().st_mtime:
            ignores += 1
            continue
        convertir(source, cible)
        faits.append((source.name, cible.stat().st_size))

    for nom, taille in faits:
        print(f'{nom:32} → {taille / 1024:6.0f} ko')
    print(f'{len(faits)} photo(s) converties, {ignores} déjà à jour.')

    total = sum(f.stat().st_size for f in DOSSIER.glob('*.webp'))
    print(f'{len(list(DOSSIER.glob("*.webp")))} WebP, {total / 1024:.0f} ko au total.')
    if total > 1_500_000:
        print('Attention : la page charge tout cela d’un coup.', file=sys.stderr)


if __name__ == '__main__':
    main()
