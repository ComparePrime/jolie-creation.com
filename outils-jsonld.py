# -*- coding: utf-8 -*-
"""Pose le socle de donnees structurees sur les pages indexables."""
import json, pathlib

SITE = 'https://jolie-creation.com'

# Identite de l'entreprise. Rien n'est invente : l'adresse postale
# n'existe pas encore dans le projet, seuls la region et le pays sont
# declares. Le jour ou la rue est connue, elle s'ajoute ici.
SOCLE = {
    "@type": ["Organization", "LocalBusiness"],
    "@id": SITE + "/#entreprise",
    "name": "Jolie Création",
    "url": SITE + "/",
    "image": SITE + "/images/site/logo.png",
    "logo": SITE + "/images/site/logo.png",
    "description": "Biscuits personnalisés décorés à la main et micro-scénographies "
                   "événementielles, créés dans le canton de Fribourg.",
    "email": "info@jolie-creation.com",
    "telephone": "+41783127545",
    "address": {
        "@type": "PostalAddress",
        "addressRegion": "Fribourg",
        "addressCountry": "CH"
    },
    "areaServed": [
        {"@type": "AdministrativeArea", "name": "Canton de Fribourg"},
        {"@type": "Country", "name": "Suisse"}
    ],
    "currenciesAccepted": "CHF",
    "founder": {"@id": SITE + "/a-propos.html#julie"},
    "sameAs": [
        "https://www.instagram.com/_jolie.creation_/",
        "https://www.facebook.com/profile.php?id=100064819849220"
    ]
}

SITEWEB = {
    "@type": "WebSite",
    "@id": SITE + "/#site",
    "url": SITE + "/",
    "name": "Jolie Création",
    "inLanguage": "fr-CH",
    "publisher": {"@id": SITE + "/#entreprise"}
}

JULIE = {
    "@type": "Person",
    "@id": SITE + "/a-propos.html#julie",
    "name": "Julie",
    "jobTitle": "Artisane biscuitière et créatrice de micro-scénographies",
    "worksFor": {"@id": SITE + "/#entreprise"},
    "url": SITE + "/a-propos.html"
}

# page -> titre du fil d'Ariane.
#   None  : accueil, pas de fil.
#   False : la page porte deja son propre fil d'Ariane, on ne le double pas.
PAGES = {
    'index.html': None,
    'biscuits-personnalises.html': 'Biscuits personnalisés',
    'micro-scenographies.html': 'Micro-scénographies',
    'a-propos.html': 'À propos',
    'contact.html': 'Demander un devis',
    'mentions-legales.html': 'Mentions légales',
    'confidentialite.html': 'Confidentialité',
    'mes-realisations.html': False,
}

DEBUT = '<!-- socle:jsonld -->'
FIN = '<!-- /socle:jsonld -->'


def fil(page, titre):
    return {
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Accueil", "item": SITE + "/"},
            {"@type": "ListItem", "position": 2, "name": titre, "item": SITE + "/" + page}
        ]
    }


def bloc(page, titre):
    graphe = [dict(SOCLE), dict(SITEWEB)]
    if page == 'a-propos.html':
        graphe.append(dict(JULIE))
    if titre:
        graphe.append(fil(page, titre))
    donnees = {"@context": "https://schema.org", "@graph": graphe}
    return (DEBUT + '\n<script type="application/ld+json">\n'
            + json.dumps(donnees, ensure_ascii=False, indent=2)
            + '\n</script>\n' + FIN)


def main():
    racine = pathlib.Path(__file__).resolve().parent
    for page, titre in PAGES.items():
        f = racine / page
        t = f.read_text(encoding='utf-8')
        nouveau = bloc(page, titre)
        if DEBUT in t:
            i, j = t.index(DEBUT), t.index(FIN) + len(FIN)
            t = t[:i] + nouveau + t[j:]
        else:
            ancre = '</head>'
            assert t.count(ancre) == 1, page
            t = t.replace(ancre, nouveau + '\n' + ancre)
        f.write_text(t, encoding='utf-8')
        noeuds = [n['@type'] for n in json.loads(
            nouveau[nouveau.index('{'):nouveau.rindex('}') + 1])['@graph']]
        print(f'  {page:30} ' + ', '.join(
            x if isinstance(x, str) else '+'.join(x) for x in noeuds))


if __name__ == '__main__':
    main()
