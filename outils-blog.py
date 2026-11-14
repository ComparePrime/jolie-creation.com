#!/usr/bin/env python3
"""Génère le blog : l'accueil /blog/ et une page par article /blog/<slug>.

    python3 outils-blog.py

Ajouter un article = déposer UN fichier dans blog-sources/ (voir
blog-sources/LISEZ-MOI.md) puis relancer ce script, puis outils-jsonld.py
et outils-sitemap.py. Rien d'autre à toucher : l'accueil du blog, les
cartes, les articles liés, le sommaire, le fil d'Ariane, les données
structurées et les images dérivées se déduisent des sources.

Un article = un fichier « NN-slug.md » : quelques lignes « clé: valeur »
(titre, slug, catégorie, date, extrait, image, meta…), une ligne « --- »,
puis le texte en Markdown simplifié :

    ## Titre de section        ### Sous-titre
    paragraphe                 - liste        1. liste numérotée
    > Conseil mis en encadré   **gras**   *italique*
    [texte du lien](/chemin)   ![alt](images/…webp "légende")

Le script ne touche ni au panier, ni au paiement, ni aux pages
commerciales. Les images dérivées (WebP, 3:2) sont écrites dans
images/blog/ sous un nom descriptif ; les photos d'origine restent
intactes.
"""
import datetime
import html
import importlib.util
import json
import pathlib
import re
import subprocess
import unicodedata

RACINE = pathlib.Path(__file__).resolve().parent
SOURCES = RACINE / 'blog-sources'
SORTIE = RACINE / 'blog'
IMAGES = RACINE / 'images' / 'blog'
SITE = 'https://jolie-creation.com'

CATEGORIES = {
    'biscuits': {
        'nom': 'Biscuits personnalisés',
        'ancre': 'biscuits-personnalises',
        'intro': 'Occasions, prénoms, thèmes, fabrication : tout ce qu’il faut savoir '
                 'avant de commander des biscuits décorés à la main.',
        'page': '/biscuits-personnalises.html',
        'devis': '/contact.html?formule=biscuits',
        'cta_titre': 'Envie de biscuits personnalisés pour votre événement ?',
        'cta_texte': 'Parcourez les collections, choisissez vos modèles et ajoutez-les à votre panier, '
                     'ou racontez-moi votre projet si votre thème ne s’y trouve pas encore.',
        'cta_bouton': 'Découvrir les collections',
    },
    'micro': {
        'nom': 'Micro-scénographies',
        'ancre': 'micro-scenographies',
        'intro': 'Décors personnalisés, univers thématiques et mises en scène : '
                 'comment naît une micro-scénographie et comment bien la préparer.',
        'page': '/micro-scenographies.html',
        'devis': '/contact.html?formule=micro-scenographie',
        'cta_titre': 'Un décor pensé pour votre événement ?',
        'cta_texte': 'Découvrez les formules de micro-scénographie, ou décrivez-moi votre événement : '
                     'je reviens vers vous avec une proposition adaptée.',
        'cta_bouton': 'Découvrir les micro-scénographies',
    },
}


def charger_outil(nom):
    spec = importlib.util.spec_from_file_location(nom.replace('-', '_'), RACINE / (nom + '.py'))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


PAGE_COLLECTION = charger_outil('outils-page-collection')


def e(s):
    return html.escape(s, quote=True)


# ------------------------------------------------------------------
# Lecture des sources
# ------------------------------------------------------------------
CLES_OBLIGATOIRES = ['titre', 'slug', 'categorie', 'date', 'extrait', 'image', 'image_alt',
                     'meta_title', 'meta_description']


def lire_source(chemin):
    texte = chemin.read_text(encoding='utf-8')
    entete, sep, corps = texte.partition('\n---\n')
    assert sep, f'{chemin.name} : ligne « --- » manquante'
    meta = {}
    for ligne in entete.strip().splitlines():
        if not ligne.strip() or ligne.startswith('#'):
            continue
        cle, deux_points, valeur = ligne.partition(':')
        assert deux_points, f'{chemin.name} : ligne illisible « {ligne} »'
        meta[cle.strip()] = valeur.strip()
    manque = [k for k in CLES_OBLIGATOIRES if not meta.get(k)]
    assert not manque, f'{chemin.name} : clés manquantes {manque}'
    assert meta['categorie'] in CATEGORIES, f'{chemin.name} : catégorie inconnue'
    meta['ordre'] = int(meta.get('ordre', chemin.name.split('-')[0]))
    meta['lies'] = [x.strip() for x in meta.get('lies', '').split(',') if x.strip()]
    meta['corps'] = corps.strip()
    meta['fichier'] = chemin.name
    return meta


def articles():
    tous = [lire_source(f) for f in sorted(SOURCES.glob('[0-9]*.md'))]
    slugs = [a['slug'] for a in tous]
    assert len(slugs) == len(set(slugs)), 'slug en double'
    for a in tous:
        for l in a['lies']:
            assert l in slugs, f'{a["slug"]} : article lié inconnu « {l} »'
    return sorted(tous, key=lambda a: (a['categorie'] != 'biscuits', a['ordre']))


# ------------------------------------------------------------------
# Markdown simplifié -> HTML
# ------------------------------------------------------------------
def slugifier(texte):
    t = unicodedata.normalize('NFD', texte)
    t = ''.join(c for c in t if unicodedata.category(c) != 'Mn').lower()
    return re.sub(r'[^a-z0-9]+', '-', t).strip('-')


def dimensions(chemin):
    sortie = subprocess.run(['identify', '-format', '%w %h', str(chemin) + '[0]'],
                            capture_output=True, text=True).stdout.split()
    return (int(sortie[0]), int(sortie[1])) if len(sortie) == 2 else (None, None)


def inline(t):
    t = e(t)
    t = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', t)
    t = re.sub(r'(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])', r'<em>\1</em>', t)
    t = re.sub(r'\[([^\]]+)\]\(([^)\s]+)\)', r'<a href="\2">\1</a>', t)
    return t


def convertir(corps):
    """Renvoie (html, sommaire[(id, titre)])."""
    blocs = re.split(r'\n\s*\n', corps)
    sortie, sommaire = [], []
    for bloc in blocs:
        b = bloc.strip()
        if not b:
            continue
        if b.startswith('## '):
            titre = b[3:].strip()
            id_ = slugifier(titre)
            sommaire.append((id_, titre))
            sortie.append(f'<h2 id="{id_}">{inline(titre)}</h2>')
        elif b.startswith('### '):
            sortie.append(f'<h3>{inline(b[4:].strip())}</h3>')
        elif b.startswith('!['):
            m = re.match(r'!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)$', b)
            assert m, f'image illisible : {b}'
            alt, src, legende = m.group(1), m.group(2), m.group(3)
            assert alt, f'image sans alt : {src}'
            assert (RACINE / src).exists(), f'image absente : {src}'
            w, h = dimensions(RACINE / src)
            dim = f' width="{w}" height="{h}"' if w else ''
            cap = f'<figcaption>{inline(legende)}</figcaption>' if legende else ''
            sortie.append(f'<figure class="blog-figure"><img src="/{e(src)}" alt="{e(alt)}"{dim} '
                          f'loading="lazy" decoding="async">{cap}</figure>')
        elif b.startswith('> '):
            texte = ' '.join(l[2:] if l.startswith('> ') else l.lstrip('>') for l in b.splitlines())
            sortie.append(f'<aside class="blog-conseil"><p>{inline(texte)}</p></aside>')
        elif re.match(r'^- ', b):
            items = ''.join(f'<li>{inline(l[2:])}</li>' for l in b.splitlines() if l.startswith('- '))
            sortie.append(f'<ul>{items}</ul>')
        elif re.match(r'^\d+\. ', b):
            lignes = [re.sub(r'^\d+\. ', '', l) for l in b.splitlines() if re.match(r'^\d+\. ', l)]
            items = ''.join('<li>' + inline(l) + '</li>' for l in lignes)
            sortie.append('<ol>' + items + '</ol>')
        else:
            sortie.append(f'<p>{inline(" ".join(b.splitlines()))}</p>')
    return '\n'.join(sortie), sommaire


def mots(corps):
    texte = re.sub(r'[#>*\[\]()!_`-]', ' ', corps)
    return len(texte.split())


# ------------------------------------------------------------------
# Images dérivées : WebP 3:2, nom descriptif
# ------------------------------------------------------------------
def nom_image(a):
    return a.get('image_nom') or slugifier(a['slug'])


def deriver_image(a):
    """Écrit images/blog/<nom>.webp (1200 px max, 3:2) et <nom>-carte.webp
    (640 px). Ne réécrit rien qui existe déjà et soit plus récent que la
    photo d'origine."""
    source = RACINE / a['image']
    assert source.exists(), f'{a["slug"]} : photo absente {a["image"]}'
    IMAGES.mkdir(parents=True, exist_ok=True)
    nom = nom_image(a)
    gravite = a.get('image_cadrage', 'center')
    w, _ = dimensions(source)
    largeur = min(w, 1200)
    for suffixe, cible_w in (('', largeur), ('-carte', min(w, 640))):
        cible = IMAGES / f'{nom}{suffixe}.webp'
        if cible.exists() and cible.stat().st_mtime >= source.stat().st_mtime:
            continue
        h = round(cible_w * 2 / 3)
        subprocess.run(['convert', str(source), '-auto-orient', '-resize', f'{cible_w}x',
                        '-gravity', gravite, '-crop', f'{cible_w}x{h}+0+0', '+repage',
                        '-strip', '-quality', '78', str(cible)], check=True)


# ------------------------------------------------------------------
# Éléments de page
# ------------------------------------------------------------------
def date_fr(iso):
    mois = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août',
            'septembre', 'octobre', 'novembre', 'décembre']
    d = datetime.date.fromisoformat(iso)
    return f'{d.day} {mois[d.month - 1]} {d.year}'


def tete(titre, description, url, image_url, type_og, extra_json, image_alt=''):
    return f'''<!DOCTYPE html>
<html lang="fr-CH">
<head>
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=AW-11045179820"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){{dataLayer.push(arguments);}}
  gtag('js', new Date());

  gtag('config', 'AW-11045179820');
  gtag('config', 'G-99MJWZGMHT');
</script>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{e(titre)}</title>
<meta name="description" content="{e(description)}">
<link rel="canonical" href="{url}">
<meta property="og:type" content="{type_og}">
<meta property="og:title" content="{e(titre)}">
<meta property="og:description" content="{e(description)}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{image_url}">
<meta property="og:image:alt" content="{e(image_alt)}">
<meta property="og:locale" content="fr_CH">
<meta property="og:site_name" content="Jolie Création">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" href="/favicon.png">
<link rel="apple-touch-icon" href="/favicon.png">
<link rel="stylesheet" href="/styles.css">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Alex+Brush&family=Jost:wght@300;400;500;600&display=swap" rel="stylesheet">
<!-- socle:jsonld -->
<!-- /socle:jsonld -->
<script type="application/ld+json">
{json.dumps(extra_json, ensure_ascii=False, indent=2)}
</script>
</head>
<body>
'''


def nav_blog():
    nav = PAGE_COLLECTION.entete_nav()
    # Sur le blog, c'est « Blog » qui est la page courante.
    nav = nav.replace(' aria-current="page"', '')
    return nav.replace('<li><a href="/blog/">Blog</a></li>',
                       '<li><a href="/blog/" aria-current="page">Blog</a></li>', 1)


def carte(a, grande=False):
    cat = CATEGORIES[a['categorie']]
    img = f'/images/blog/{nom_image(a)}-carte.webp'
    classe = 'blog-carte blog-carte-grande' if grande else 'blog-carte'
    return f'''        <article class="{classe}">
          <a class="blog-carte-lien" href="/blog/{a['slug']}">
            <span class="blog-carte-photo"><img src="{img}" alt="{e(a['image_alt'])}" loading="lazy" decoding="async" width="640" height="427"></span>
            <span class="blog-carte-corps">
              <span class="blog-pastille">{e(cat['nom'])}</span>
              <h3 class="blog-carte-titre">{e(a['titre'])}</h3>
              <span class="blog-carte-extrait">{e(a['extrait'])}</span>
              <span class="blog-carte-lire">Lire l’article</span>
            </span>
          </a>
        </article>'''


def json_blog_posting(a, url, image_url, nb_mots):
    return {
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'BlogPosting',
                '@id': url + '#article',
                'headline': a['titre'],
                'description': a['meta_description'],
                'image': image_url,
                'datePublished': a['date'],
                'dateModified': a.get('modifie', a['date']),
                'inLanguage': 'fr-CH',
                'wordCount': nb_mots,
                'articleSection': CATEGORIES[a['categorie']]['nom'],
                'mainEntityOfPage': {'@type': 'WebPage', '@id': url},
                'author': {'@id': SITE + '/a-propos.html#julie'},
                'publisher': {'@id': SITE + '/#entreprise'}
            },
            {
                '@type': 'BreadcrumbList',
                'itemListElement': [
                    {'@type': 'ListItem', 'position': 1, 'name': 'Accueil', 'item': SITE + '/'},
                    {'@type': 'ListItem', 'position': 2, 'name': 'Blog', 'item': SITE + '/blog/'},
                    {'@type': 'ListItem', 'position': 3, 'name': a['titre'], 'item': url}
                ]
            }
        ]
    }


def page_article(a, tous):
    cat = CATEGORIES[a['categorie']]
    url = f'{SITE}/blog/{a["slug"]}'
    image_url = f'{SITE}/images/blog/{nom_image(a)}.webp'
    corps_html, sommaire = convertir(a['corps'])
    nb_mots = mots(a['corps'])
    minutes = max(1, round(nb_mots / 200))

    sommaire_html = ''
    if len(sommaire) >= 3:
        liens = ''.join(f'<li><a href="#{i}">{e(t)}</a></li>' for i, t in sommaire)
        sommaire_html = (f'<nav class="blog-sommaire" aria-label="Sommaire de l’article">'
                         f'<p class="blog-sommaire-titre">Dans cet article</p><ol>{liens}</ol></nav>')

    memes = [x for x in tous if x['categorie'] == a['categorie']]
    i = memes.index(a)
    prec = memes[i - 1] if i > 0 else None
    suiv = memes[i + 1] if i < len(memes) - 1 else None
    nav_art = ''
    if prec or suiv:
        p = (f'<a class="blog-nav-lien blog-nav-prec" href="/blog/{prec["slug"]}"><span>Article précédent</span>'
             f'{e(prec["titre"])}</a>') if prec else '<span></span>'
        s = (f'<a class="blog-nav-lien blog-nav-suiv" href="/blog/{suiv["slug"]}"><span>Article suivant</span>'
             f'{e(suiv["titre"])}</a>') if suiv else '<span></span>'
        nav_art = f'<nav class="blog-nav" aria-label="Navigation entre les articles">{p}{s}</nav>'

    lies = [x for x in tous if x['slug'] in a['lies']]
    bloc_lies = ''
    if lies:
        bloc_lies = f'''  <section class="blog-lies" aria-labelledby="lies-titre">
    <div class="wrap">
      <h2 id="lies-titre" class="blog-section-titre">À lire aussi</h2>
      <div class="blog-grille">
{chr(10).join(carte(x) for x in lies)}
      </div>
    </div>
  </section>
'''

    cta = f'''<aside class="blog-cta" aria-labelledby="cta-titre">
          <h2 id="cta-titre">{e(cat['cta_titre'])}</h2>
          <p>{e(cat['cta_texte'])}</p>
          <div class="blog-cta-actions">
            <a class="btn btn-primary" href="{cat['page']}">{e(cat['cta_bouton'])}</a>
            <a class="btn btn-ghost" href="{cat['devis']}">Demander un devis</a>
          </div>
        </aside>'''

    return (tete(a['meta_title'], a['meta_description'], url, image_url, 'article',
                 json_blog_posting(a, url, image_url, nb_mots), a['image_alt'])
            + f'''{nav_blog()}

<main class="blog">
  <div class="wrap">
    <p class="breadcrumb"><a href="/index.html">Accueil</a> / <a href="/blog/">Blog</a> / {e(a['titre'])}</p>
  </div>

  <article class="blog-article">
    <header class="blog-article-tete">
      <div class="wrap">
        <a class="blog-pastille" href="/blog/#{cat['ancre']}">{e(cat['nom'])}</a>
        <h1>{e(a['titre'])}</h1>
        <p class="blog-meta">Par Julie, Jolie Création &middot; <time datetime="{a['date']}">{date_fr(a['date'])}</time> &middot; {minutes} min de lecture</p>
      </div>
    </header>
    <div class="wrap blog-article-photo">
      <img src="/images/blog/{nom_image(a)}.webp" alt="{e(a['image_alt'])}" width="1200" height="800" loading="eager" fetchpriority="high" decoding="async">
    </div>
    <div class="wrap">
      <div class="blog-texte">
        {sommaire_html}
{corps_html}
        {cta}
        {nav_art}
      </div>
    </div>
  </article>

{bloc_lies}</main>
{PAGE_COLLECTION.pied_page()}
</body>
</html>
''')


def page_accueil(tous):
    url = SITE + '/blog/'
    titre = 'Blog : biscuits personnalisés et micro-scénographies | Jolie Création'
    description = ('Conseils, idées et coulisses : biscuits personnalisés décorés à la main et '
                   'micro-scénographies événementielles, en Suisse romande et dans le canton de Fribourg.')
    premier = tous[0]
    image_url = f'{SITE}/images/blog/{nom_image(premier)}.webp'
    donnees = {
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'Blog',
                '@id': url + '#blog',
                'name': 'Le blog Jolie Création',
                'url': url,
                'inLanguage': 'fr-CH',
                'description': description,
                'publisher': {'@id': SITE + '/#entreprise'},
                'blogPost': [{'@type': 'BlogPosting', 'headline': a['titre'],
                              'url': f'{SITE}/blog/{a["slug"]}', 'datePublished': a['date']} for a in tous]
            },
            {
                '@type': 'BreadcrumbList',
                'itemListElement': [
                    {'@type': 'ListItem', 'position': 1, 'name': 'Accueil', 'item': SITE + '/'},
                    {'@type': 'ListItem', 'position': 2, 'name': 'Blog', 'item': url}
                ]
            }
        ]
    }
    sections = []
    for cle, cat in CATEGORIES.items():
        arts = [a for a in tous if a['categorie'] == cle]
        sections.append(f'''  <section class="blog-categorie" id="{cat['ancre']}" aria-labelledby="{cat['ancre']}-titre">
    <div class="wrap">
      <div class="blog-categorie-tete">
        <span class="eyebrow">{len(arts)} articles</span>
        <h2 id="{cat['ancre']}-titre">{e(cat['nom'])}</h2>
        <p>{e(cat['intro'])}</p>
      </div>
      <div class="blog-grille">
{chr(10).join(carte(a) for a in arts)}
      </div>
      <p class="blog-categorie-lien"><a href="{cat['page']}">Voir {'les collections de biscuits personnalisés' if cle == 'biscuits' else 'les formules de micro-scénographie'}</a></p>
    </div>
  </section>''')

    return (tete(titre, description, url, image_url, 'website', donnees, premier['image_alt'])
            + f'''{nav_blog()}

<main class="blog">
  <div class="wrap">
    <p class="breadcrumb"><a href="/index.html">Accueil</a> / Blog</p>
  </div>

  <section class="blog-intro" aria-labelledby="blog-titre">
    <div class="wrap">
      <span class="eyebrow" style="justify-content:center;">Le blog</span>
      <h1 id="blog-titre">Conseils, idées et <span class="script">coulisses</span></h1>
      <p>Des biscuits décorés à la main et des micro-scénographies imaginées sur mesure : ici, je partage ce que je sais pour vous aider à préparer vos plus beaux moments, du choix du thème au jour J.</p>
      <ul class="blog-onglets" aria-label="Catégories">
        <li><a href="#biscuits-personnalises">Biscuits personnalisés</a></li>
        <li><a href="#micro-scenographies">Micro-scénographies</a></li>
      </ul>
    </div>
  </section>

{chr(10).join(sections)}

  <section>
    <div class="wrap">
      <div class="cta-final">
        <span class="eyebrow" style="color:var(--gold-light);">Un projet en tête ?</span>
        <h2>Parlons de votre <span class="script">événement</span></h2>
        <p>Biscuits personnalisés, micro-scénographie ou les deux : racontez-moi votre projet, je reviens vers vous avec une proposition adaptée.</p>
        <div class="hero-actions">
          <a href="/biscuits-personnalises.html" class="btn btn-primary">Voir les biscuits</a>
          <a href="/contact.html" class="btn btn-ghost on-dark">Demander un devis</a>
        </div>
      </div>
    </div>
  </section>
</main>
{PAGE_COLLECTION.pied_page()}
</body>
</html>
''')


def main():
    tous = articles()
    SORTIE.mkdir(exist_ok=True)
    attendus = {'index.html'}
    for a in tous:
        deriver_image(a)
        (SORTIE / f'{a["slug"]}.html').write_text(page_article(a, tous), encoding='utf-8')
        attendus.add(f'{a["slug"]}.html')
    (SORTIE / 'index.html').write_text(page_accueil(tous), encoding='utf-8')
    # Un article retiré des sources ne doit pas rester en ligne.
    for f in SORTIE.glob('*.html'):
        if f.name not in attendus:
            f.unlink()
            print('supprimé :', f.name)
    for a in tous:
        print(f'  {CATEGORIES[a["categorie"]]["nom"][:10]:10} {a["slug"]:62} {mots(a["corps"]):5} mots')
    print(f'{len(tous)} articles, accueil du blog.')


if __name__ == '__main__':
    main()
