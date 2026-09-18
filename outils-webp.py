# -*- coding: utf-8 -*-
"""Sert en WebP les photos encore servies en JPEG.

    python3 outils-webp.py

Le script ne redimensionne rien : il convertit a dimensions egales, donc
les attributs width et height des pages restent exacts et aucun bloc ne
bouge au chargement. Les originaux JPEG sont conserves, ce sont eux qui
font foi ; seul le fichier servi change.

Un .webp deja present a cote de l'original appartient a
outils-photos.py : le script le reutilise tel quel et aligne les
attributs width/height de la page sur ses vraies dimensions.

Relancer le script deux fois donne le meme resultat.
"""
import pathlib
import re

from PIL import Image

RACINE = pathlib.Path(__file__).resolve().parent
QUALITE = 80
SERVI = re.compile(r'src="([^"]+\.(?:jpg|jpeg))"')


def pages():
    return sorted(RACINE.glob('*.html'))


def originaux():
    """Les JPEG reellement servis par une page, sans doublon."""
    vus = {}
    for page in pages():
        for chemin in SERVI.findall(page.read_text(encoding='utf-8')):
            vus.setdefault(chemin, []).append(page.name)
    return vus


def convertir(relatif):
    """Rend (chemin webp relatif, largeur, hauteur)."""
    source = RACINE / relatif
    cible = source.with_suffix('.webp')
    if not cible.exists():
        with Image.open(source) as im:
            im.convert('RGB').save(cible, 'WEBP', quality=QUALITE, method=6)
    with Image.open(cible) as im:
        l, h = im.size
    return str(cible.relative_to(RACINE)).replace('\\', '/'), l, h


def redimensions(balise, largeur, hauteur):
    """Aligne width/height de la balise sur les dimensions reelles."""
    for nom, valeur in (('width', largeur), ('height', hauteur)):
        if re.search(r'\s%s="\d+"' % nom, balise):
            balise = re.sub(r'(\s%s=")\d+(")' % nom, r'\g<1>%d\g<2>' % valeur, balise)
    return balise


def main():
    servis = originaux()
    if not servis:
        print('  Aucune photo JPEG servie : rien a faire.')
        return
    table = {}
    for relatif in sorted(servis):
        webp, l, h = convertir(relatif)
        table[relatif] = (webp, l, h)
        avant = (RACINE / relatif).stat().st_size
        apres = (RACINE / webp).stat().st_size
        print(f'  {relatif:62} {avant // 1024:4} ko -> {apres // 1024:4} ko  {l}x{h}')

    for page in pages():
        t = page.read_text(encoding='utf-8')
        avant = t

        def remplace(m):
            balise = m.group(0)
            relatif = SERVI.search(balise).group(1)
            webp, l, h = table[relatif]
            balise = balise.replace(relatif, webp)
            return redimensions(balise, l, h)

        t = re.sub(r'<img[^>]*' + SERVI.pattern + r'[^>]*>', remplace, t)
        if t != avant:
            page.write_text(t, encoding='utf-8')
            print(f'  {page.name} mis a jour')


if __name__ == '__main__':
    main()
