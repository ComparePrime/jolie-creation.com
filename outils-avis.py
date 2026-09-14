#!/usr/bin/env python3
"""Recopie les avis clients de « Mes réalisations » vers la page Biscuits.

    python3 outils-avis.py

Les avis s'écrivent une seule fois, dans mes-realisations.html. Ce script
les recopie entre les repères <!-- avis:liste --> de
biscuits-personnalises.html. Modifier les avis du côté copié ne sert à
rien : le prochain passage du script les écraserait.

Deux pages, un seul texte : un avis corrigé d'un côté et pas de l'autre
serait pire que pas d'avis du tout.

Le script est idempotent : le relancer deux fois donne le même résultat.
"""
import pathlib
import re

RACINE = pathlib.Path(__file__).resolve().parent
SOURCE = RACINE / 'mes-realisations.html'
CIBLE = RACINE / 'biscuits-personnalises.html'
REPERE = 'avis:liste'


def bloc_avis(texte):
    """La <section> des avis, du premier caractère au </section> qui la
    referme. Repérée par son titre, pas par sa position."""
    debut = texte.index('  <section aria-labelledby="avis-title">')
    fin = texte.index('\n  </section>', debut) + len('\n  </section>')
    bloc = texte[debut:fin]
    if bloc.count('<section') != 1:
        raise SystemExit('Le bloc des avis contient une section imbriquée : '
                         'le repérage par </section> ne tient plus.')
    return bloc


def remplacer(texte, nom, contenu):
    debut, fin = f'<!-- {nom} -->', f'<!-- /{nom} -->'
    motif = re.compile(re.escape(debut) + r'.*?' + re.escape(fin), re.DOTALL)
    if not motif.search(texte):
        raise SystemExit(f'Repère « {nom} » introuvable dans {CIBLE.name}.')
    return motif.sub(lambda _: debut + '\n' + contenu + '\n' + fin, texte, count=1)


def main():
    bloc = bloc_avis(SOURCE.read_text(encoding='utf-8'))
    # Un id doit rester unique dans une page ; celui du titre est repris.
    copie = bloc.replace('avis-title', 'avis-biscuits-title')
    CIBLE.write_text(remplacer(CIBLE.read_text(encoding='utf-8'), REPERE, copie),
                     encoding='utf-8')
    nb = bloc.count('<figure class="avis-carte">')
    print(f'{nb} avis recopiés de {SOURCE.name} vers {CIBLE.name}')


if __name__ == '__main__':
    main()
