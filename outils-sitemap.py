# -*- coding: utf-8 -*-
"""Regenere sitemap.xml. Le lastmod vient de git, jamais d'une date inventee."""
import datetime, pathlib, subprocess

SITE = 'https://jolie-creation.com'

# fichier -> (adresse publique, priorite)
PAGES = [
    ('index.html', '/', '1.0'),
    ('biscuits-personnalises.html', '/biscuits-personnalises.html', '0.9'),
    ('micro-scenographies.html', '/micro-scenographies.html', '0.9'),
    ('mes-realisations.html', '/mes-realisations.html', '0.8'),
    ('contact.html', '/contact.html', '0.8'),
    ('a-propos.html', '/a-propos.html', '0.7'),
    ('mentions-legales.html', '/mentions-legales.html', '0.3'),
    ('confidentialite.html', '/confidentialite.html', '0.3'),
]


def git(*args):
    return subprocess.run(('git',) + args, capture_output=True, text=True,
                          cwd=pathlib.Path(__file__).resolve().parent).stdout.strip()


def date_reelle(fichier):
    """Date du dernier commit touchant le fichier. Si le fichier a des
    modifications non commitees, c'est aujourd'hui qu'il change."""
    if git('status', '--porcelain', '--', fichier):
        return datetime.date.today().isoformat()
    return git('log', '-1', '--format=%cs', '--', fichier) or None


def main():
    racine = pathlib.Path(__file__).resolve().parent
    lignes = ['<?xml version="1.0" encoding="UTF-8"?>',
              '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for fichier, adresse, priorite in PAGES:
        chemin = racine / fichier
        assert chemin.exists(), fichier
        assert 'noindex' not in chemin.read_text(encoding='utf-8'), fichier
        d = date_reelle(fichier)
        lignes.append('  <url><loc>' + SITE + adresse + '</loc>'
                      + (f'<lastmod>{d}</lastmod>' if d else '')
                      + f'<priority>{priorite}</priority></url>')
        print(f'  {adresse:32} {d or "(pas de date git)"}')
    lignes.append('</urlset>')
    (racine / 'sitemap.xml').write_text('\n'.join(lignes) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
