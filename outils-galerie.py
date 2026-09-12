# -*- coding: utf-8 -*-
"""Compose la galerie de mes-realisations.html en rangées justifiées.

À relancer après tout ajout ou retrait de photo dans la galerie :
    python3 outils-galerie.py

La taille de rangée est déduite des rapports réels des photos : trois
portraits remplissent la largeur à belle hauteur, alors que trois
paysages donneraient des vignettes minuscules. La dernière rangée d'un
ensemble est bornée en largeur pour retomber à la hauteur des
précédentes, plutôt que de s'étirer ou de laisser un trou.
"""
import math
import os
import re

from PIL import Image

RACINE = os.path.dirname(os.path.abspath(__file__))
PAGE = os.path.join(RACINE, 'mes-realisations.html')

CONTENEUR = 1124.0   # 1180 px de conteneur moins les marges internes du .wrap
ECART = 20.0         # gap entre deux photos d'une rangée
H_CIBLE = 420.0      # hauteur de rangée visée


def hauteur(ratios):
    """Hauteur d'une rangée qui occupe toute la largeur disponible."""
    return (CONTENEUR - (len(ratios) - 1) * ECART) / sum(ratios)


def taille_rangee(ratios):
    """On ajoute des photos tant que cela rapproche de la hauteur visée."""
    m = 1
    while m < len(ratios):
        if abs(hauteur(ratios[:m + 1]) - H_CIBLE) >= abs(hauteur(ratios[:m]) - H_CIBLE):
            break
        m += 1
    return m


def reindenter(figure, base='            '):
    """Remet une figure à plat sur son indentation d'origine.

    Sans cela, le script n'est pas rejouable : il préfixait chaque ligne
    de deux espaces, qui s'ajoutaient à ceux du tour précédent. La page
    dérivait de deux espaces à chaque exécution."""
    lignes = figure.split('\n')
    suivantes = [l for l in lignes[1:] if l.strip()]
    creux = min((len(l) - len(l.lstrip()) for l in suivantes), default=0)
    sortie = [base + lignes[0].strip()]
    for l in lignes[1:]:
        sortie.append(base + l[creux:] if l.strip() else '')
    return '\n'.join(sortie)


def poser_ratio(m):
    bloc = m.group(0)
    src = re.search(r'<img src="([^"]+)"', bloc).group(1)
    largeur, haut = Image.open(os.path.join(RACINE, src)).size
    return re.sub(r'<figure class="folio-item"[^>]*>',
                  f'<figure class="folio-item" style="--r:{largeur / haut:.4f}">', bloc, count=1)


resume = []


def refaire(m):
    bloc = m.group(0)
    figures = re.findall(r'(?s)<figure class="folio-item".*?</figure>', bloc)
    if not figures:
        return bloc
    ratios = [float(re.search(r'--r:([\d.]+)', f).group(1)) for f in figures]

    par_rangee = taille_rangee(ratios)
    k = math.ceil(len(figures) / par_rangee)
    base, reste = divmod(len(figures), k)
    tailles = [base + (1 if i < reste else 0) for i in range(k)]

    rangees, i = [], 0
    for t in tailles:
        rangees.append((figures[i:i + t], ratios[i:i + t]))
        i += t

    hauteurs = [hauteur(rs) for _, rs in rangees[:-1]]
    plafond = sorted(hauteurs)[len(hauteurs) // 2] if hauteurs else H_CIBLE

    sortie, mesures = [], []
    for j, (figs, rs) in enumerate(rangees):
        h = hauteur(rs)
        style = ''
        if j == len(rangees) - 1 and h > plafond + 1:
            largeur = sum(rs) * plafond + (len(rs) - 1) * ECART
            style = f' style="max-width:{largeur / CONTENEUR * 100:.1f}%"'
            h = plafond
        mesures.append((len(figs), round(h)))
        sortie.append(f'            <div class="folio-rangee"{style}>\n' +
                      ''.join(reindenter(f) + '\n' for f in figs) +
                      '            </div>\n')
    resume.append(mesures)
    return (bloc[:bloc.index('<figure')].rstrip() + '\n' + ''.join(sortie) +
            '          ' + bloc[bloc.rindex('</div>'):])


def main():
    s = open(PAGE, encoding='utf-8').read()
    # on repart d'une galerie à plat pour pouvoir relancer le script
    s = s.replace('<div class="folio-rangee">', '').replace('</div>\n            </div>', '</div>')
    s = re.sub(r'\n\s*<div class="folio-rangee"[^>]*>', '', s)
    # Les lignes vides laissées par l'aplatissement se cumuleraient elles aussi.
    s = re.sub(r'\n[ \t]*\n(?=[ \t]*<figure class="folio-item")', '\n', s)
    s = re.sub(r'(?s)<figure class="folio-item"[^>]*>.*?</figure>', poser_ratio, s)
    s, n = re.subn(r'(?s)<div class="folio-masonry(?: folio-solo)?">.*?\n          </div>', refaire, s)
    s = s.replace('<div class="folio-masonry folio-solo">', '<div class="folio-masonry">')
    open(PAGE, 'w', encoding='utf-8').write(s)

    print(f'{n} ensembles, {s.count("folio-rangee")} rangées, {s.count("<figure")} photos')
    for m in resume:
        print('   ' + ' + '.join(f'{a} à {b}px' for a, b in m))


if __name__ == '__main__':
    main()
