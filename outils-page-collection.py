#!/usr/bin/env python3
"""Génère une vraie page e-commerce pour CHAQUE collection du catalogue,
dans collections/.

    python3 outils-page-collection.py

**Ceci est le gabarit de référence** pour /collections/<slug> : hero,
présentation courte, produits ou packages selon le type de la collection,
puis les blocs déjà validés ailleurs sur le site (ingrédients, occasions,
avis, CTA). La liste des collections n'est jamais codée en dur ici : le
script parcourt C.COLLECTIONS au complet, donc aucune collection ne peut
être oubliée, et en ajouter une au catalogue suffit à lui donner sa page
au prochain lancement — jamais de copier-coller une page à la main.

Trois types, déduits des données, jamais déclarés à la main :

  TYPE A — classique      : des produits à l'unité, achetables.
  TYPE B — packagesSeuls  : des packages ; les produits internes
                             (seulEnPackage) ne sont jamais achetables
                             seuls, et n'ont donc pas de carte.
  TYPE C — sur devis      : ni produit ni package tarifé ; la page
                             renvoie vers la demande de devis.

Une page générée ici vit un niveau plus bas que les autres
(collections/<slug>.html) : tous les liens et fichiers partagés (styles,
scripts, images, autres pages) y sont donc écrits en chemin absolu
(/styles.css, /images/…), jamais relatifs — un chemin relatif du type
« styles.css » chercherait collections/styles.css, qui n'existe pas.

Le script ne touche à rien d'autre : ni au panier, ni au paiement, ni
aux autres pages. Après l'avoir lancé, relancer aussi outils-jsonld.py
pour poser le socle Organization/LocalBusiness/WebSite de chaque page
générée, et outils-sitemap.py pour les y ajouter.
"""
import html
import json
import pathlib
import subprocess
import urllib.parse

RACINE = pathlib.Path(__file__).resolve().parent
DOSSIER = RACINE / 'collections'
SITE = 'https://jolie-creation.com'

LECTURE = """
const C = require('./catalogue.js');
console.log(JSON.stringify(C.COLLECTIONS));
"""


def collections():
    """Toutes les collections du catalogue, dans leur ordre — jamais une
    liste maintenue à la main qui pourrait en oublier une."""
    sortie = subprocess.run(['node', '-e', LECTURE], cwd=RACINE,
                            capture_output=True, text=True, check=True).stdout
    return json.loads(sortie)


def type_collection(c):
    """A (classique), B (packages), ou C (sur devis) — déduit des
    données, jamais déclaré à la main. Une collection ne peut être
    B et vide de packages à la fois : packagesSeuls le garantit déjà
    côté catalogue.js."""
    if c.get('packagesSeuls'):
        return 'B'
    if c['produits']:
        return 'A'
    return 'C'


def e(s):
    return html.escape(s, quote=True)


def chf(centimes):
    francs = centimes / 100
    return (str(int(francs)) if centimes % 100 == 0 else f'{francs:.2f}') + ' CHF'


def prix_depart(c):
    """« Dès X CHF », au prix le plus bas réellement payable — jamais
    inventé. Une collection du moment se vend en packages : c'est leur
    prix plancher qui compte. Sans aucun prix, c'est un devis."""
    prix = ([pk['prix'] for pk in c.get('packages') or []] if c.get('packagesSeuls')
            else [p['prix'] for p in c['produits']])
    return f'Dès {chf(min(prix))}' if prix else 'Sur devis'


def faits_hero(c, type_):
    """Les repères courts du hero, un par type — jamais de texte qui
    promette une vente à l'unité sur une collection qui n'en fait pas,
    ni l'inverse."""
    if type_ == 'B':
        n = len(c['packages'])
        return [f'{n} package{"s" if n > 1 else ""} au choix, composé{"s" if n > 1 else ""} d’avance',
                'Sans minimum de commande']
    if type_ == 'C':
        return ['Sur devis, composé avec vous', 'Formes, couleurs et quantité sur mesure']
    n = len(c['produits'])
    return [f'{n} modèle{"s" if n > 1 else ""} au choix, à commander à l’unité']


# ------------------------------------------------------------------
# Chrome partagé (identique aux autres pages, en chemins absolus).
# ------------------------------------------------------------------
def entete_nav():
    return '''<header class="site-header">
  <div class="wrap">
    <a href="/index.html" class="brand">
      <img src="/images/site/logo.png" alt="Jolie Création — retour à l’accueil">
    </a>
    <nav class="nav-desktop" aria-label="Navigation principale">
      <ul>
        <li><a href="/index.html">Accueil</a></li>
        <li><a href="/biscuits-personnalises.html" aria-current="page">Biscuits personnalisés</a></li>
        <li><a href="/micro-scenographies.html">Micro-scénographies</a></li>
        <li><a href="/mes-realisations.html">Mes réalisations</a></li>
        <li><a href="/a-propos.html">À propos de moi</a></li>
      </ul>
    </nav>
    <div class="header-actions">
      <a href="/panier.html" class="header-cart" data-panier-lien aria-label="Mon panier, vide">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g class="ic-line"><path d="M4 6.4h2.1l2 10.2h9.6l1.9-7.4H7"/><circle cx="9.4" cy="19.6" r="1.2"/><circle cx="16.6" cy="19.6" r="1.2"/></g></svg>
        <span class="header-cart-count" data-panier-compteur hidden>0</span>
      </a>
      <a href="/contact.html" class="btn btn-primary btn-small">Demander un devis</a>
      <button class="burger" aria-label="Ouvrir le menu"><span></span><span></span><span></span></button>
    </div>
  </div>
</header>

<div class="mobile-nav" role="dialog" aria-modal="true" aria-label="Menu">
  <div class="mobile-nav-top">
    <img src="/images/site/logo.png" alt="" aria-hidden="true">
    <button class="mobile-nav-close" aria-label="Fermer le menu">&times;</button>
  </div>
  <ul>
    <li><a href="/index.html">Accueil</a></li>
    <li><a href="/biscuits-personnalises.html">Biscuits personnalisés</a></li>
    <li><a href="/micro-scenographies.html">Micro-scénographies</a></li>
    <li><a href="/mes-realisations.html">Mes réalisations</a></li>
    <li><a href="/a-propos.html">À propos de moi</a></li>
  </ul>
  <a href="/contact.html" class="btn btn-primary">Demander un devis</a>
</div>'''


def pied_page():
    return '''<footer class="site-footer">
  <div class="wrap">
    <div class="footer-grid">
      <div>
        <img src="/images/site/logo.png" alt="" aria-hidden="true">
        <p>Biscuits personnalisés &amp; décoration événementielle.</p>
        <div class="socials" style="margin-top:16px;">
          <a href="https://www.instagram.com/_jolie.creation_/" target="_blank" rel="noopener" aria-label="Instagram">Instagram</a>
          <a href="https://www.facebook.com/profile.php?id=100064819849220" target="_blank" rel="noopener" aria-label="Facebook">Facebook</a>
          <a href="https://api.whatsapp.com/send/?phone=41783127545&text&type=phone_number&app_absent=0" target="_blank" rel="noopener" aria-label="WhatsApp">WhatsApp</a>
        </div>
      </div>
      <div>
        <h4>Mes offres</h4>
        <ul>
          <li><a href="/biscuits-personnalises.html">Biscuits personnalisés</a></li>
          <li><a href="/micro-scenographies.html">Micro-scénographies</a></li>
          <li><a href="/mes-realisations.html">Mes réalisations</a></li>
        </ul>
      </div>
      <div>
        <h4>Biscuits personnalisés</h4>
        <ul>
          <li>Livraison Suisse &middot; France &middot; Europe</li>
          <li>Retrait possible dans le canton de Fribourg</li>
          <li><a href="/a-propos.html">À propos de moi</a></li>
          <li><a href="/mentions-legales.html">Mentions légales</a></li>
          <li><a href="/confidentialite.html">Confidentialité</a></li>
        </ul>
      </div>
      <div>
        <h4>Contact</h4>
        <ul>
          <li><a href="tel:+41783127545">+41 78 312 75 45</a></li>
          <li><a href="mailto:info@jolie-creation.com">info@jolie-creation.com</a></li>
          <li><a href="https://api.whatsapp.com/send/?phone=41783127545&text&type=phone_number&app_absent=0" target="_blank" rel="noopener">Discuter sur WhatsApp</a></li>
          <li>Suisse romande</li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <span>&copy; <span data-year></span> Jolie Création. Tous droits réservés.</span>
      <span><a href="/mentions-legales.html">Mentions légales</a> &middot; <a href="/confidentialite.html">Confidentialité</a></span>
    </div>
  </div>
</footer>
<a class="whatsapp-float" href="https://api.whatsapp.com/send/?phone=41783127545&text&type=phone_number&app_absent=0" target="_blank" rel="noopener" aria-label="Discuter sur WhatsApp">
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
</a>
<div class="lightbox">
  <button class="lightbox-close" aria-label="Fermer">&times;</button>
  <img alt="">
  <div class="lightbox-cap"></div>
</div>
<script src="/catalogue.js"></script>
<script src="/boutique.js"></script>
<script src="/script.js"></script>'''


# ------------------------------------------------------------------
# Blocs déjà validés ailleurs, repris tels quels (rien n'est réécrit).
# ------------------------------------------------------------------
def bloc_ingredients():
    return '''  <section id="ingredients" class="section-deep" aria-labelledby="ingredients-title">
    <div class="wrap">
      <div class="section-head center">
        <div class="ornament"><i></i></div>
        <span class="eyebrow" style="justify-content:center;">Transparence</span>
        <h2 id="ingredients-title">Ingrédients &amp; conservation</h2>
      </div>

      <div class="ingredients-grid">
        <div class="ingredient-bloc">
          <h3>Biscuit</h3>
          <p>Beurre, farine, sucre glace, œuf, sel de Guérande, extrait de vanille.</p>
        </div>
        <div class="ingredient-bloc">
          <h3>Glaçage</h3>
          <p>Sucre glace, poudre de blanc d’œuf (peut contenir des traces de lait et de fruits à coque), colorant alimentaire.</p>
        </div>
        <div class="ingredient-bloc">
          <h3>Conservation</h3>
          <ul>
            <li>À consommer dans les 6 semaines dans son sachet d’origine.</li>
            <li>À conserver dans un endroit sec, à l’abri de la lumière et de l’humidité.</li>
          </ul>
        </div>
      </div>

      <div class="conservation-alerte">
        <div class="ornament"><i></i></div>
        <p>Ne pas mettre au réfrigérateur.</p>
        <small>L’humidité ferait perdre au glaçage sa tenue et son éclat.</small>
      </div>
    </div>
  </section>'''


def bloc_chaque_occasion():
    return '''  <section id="realisations" aria-labelledby="realisations-title">
    <div class="wrap">
      <div class="galerie-invite">
        <div class="galerie-invite-texte">
          <span class="eyebrow">Mes réalisations</span>
          <h2 id="realisations-title">Des biscuits personnalisés pour chaque occasion</h2>
          <p>Au-delà des collections de saison, la galerie rassemble mes créations déjà réalisées, classées par occasion et par thème — océan, licorne, cheval, chantier, Italie, moto et bien d’autres.</p>
          <p>De quoi trouver l’idée de votre prochaine commande, ou <a href="/contact.html">m’en confier une toute nouvelle</a>.</p>
          <a href="/mes-realisations.html" class="btn btn-primary">Découvrir mes réalisations</a>
        </div>
        <div class="galerie-invite-photos">
          <div class="scallop-frame">
            <img src="/images/collections/passion-cheval/cheval-2.webp" alt="Biscuits décorés thème cheval, cœur au prénom calligraphié et fer à cheval doré" width="1063" height="1600" loading="lazy" decoding="async">
          </div>
          <div class="scallop-frame">
            <img src="/images/collections/annonce-grossesse/naissance-calendrier.webp" alt="Biscuit calendrier doré pour une annonce de naissance personnalisée" width="1196" height="1800" loading="lazy" decoding="async">
          </div>
          <div class="scallop-frame">
            <img src="/images/collections/petit-ocean/anniversaire-ocean-etagere.webp" alt="Biscuits personnalisés thème océan : baleine, tortue et étoiles de mer sur un présentoir" width="1665" height="1800" loading="lazy" decoding="async">
          </div>
        </div>
      </div>
    </div>
  </section>'''


def bloc_avis():
    temoignages = [
        ('Vanessa V.', 'Des biscuits magnifiques et délicieux, qui ont eu beaucoup de succès. Merci encore pour cette belle commande.'),
        ('Charlotte', "Une commande dans les teintes pastel, exactement comme je l'imaginais. Le résultat était parfait et mes invités ont adoré."),
        ('Peaux de Génie', 'Des biscuits qui reflètent parfaitement notre logo et nos origines. Chaque création était un joli souvenir, et une belle gourmandise.'),
        ('Marcolina', 'Une création formidable pour notre anniversaire. Des biscuits originaux et très beaux, qui ont rendu la soirée encore plus douce.'),
        ('Coralie', "Des biscuits aussi beaux que bons, qui ont fait leur effet à l'anniversaire. Tout le monde a adoré le concept."),
        ('Justine J.', 'De magnifiques biscuits pour le baptême de mon fils. Une création raffinée, un emballage très soigné, un résultat à la hauteur de nos attentes.'),
        ('Tatiana M.', "Les biscuits de l'anniversaire d'Elio ont eu beaucoup de succès. Aussi beaux que bons, et parfaitement dans le thème souhaité."),
        ('Lily W.', "Des biscuits très réussis, aussi bons que beaux. L'emballage était particulièrement soigné.")
    ]
    cartes = '\n\n'.join(f'''        <figure class="avis-carte">
          <figcaption>
            <span class="avis-mention">Avis client</span>
            <span class="avis-nom">{e(nom)}</span>
          </figcaption>
          <blockquote><p>{e(texte)}</p></blockquote>
        </figure>''' for nom, texte in temoignages)
    return f'''  <section aria-labelledby="avis-title">
    <div class="wrap">
      <div class="section-head center">
        <div class="ornament"><i></i></div>
        <h2 id="avis-title">Elles en parlent</h2>
        <p class="narrow">Quelques mots de celles et ceux qui ont choisi Jolie Création pour leurs moments précieux.</p>
      </div>

      <div class="avis-liste">
{cartes}
      </div>
    </div>
  </section>'''


# ------------------------------------------------------------------
# Ce qui est propre à chaque collection.
# ------------------------------------------------------------------
def fil_ariane(c):
    return (f'      <p class="breadcrumb"><a href="/index.html">Accueil</a> / '
            f'<a href="/biscuits-personnalises.html">Biscuits personnalisés</a> / {e(c["nom"])}</p>\n'
            f'      <a class="collection-retour" href="/biscuits-personnalises.html#collections">'
            f'&larr; Toutes les collections</a>')


def champ_html(champ, prefixe, attribut):
    cle = champ['cle']
    id_ = f'{prefixe}-{cle}'
    if champ['type'] == 'choix':
        options = ''.join(f'<option value="{e(o)}">{e(o)}</option>' for o in champ.get('options', []))
        saisie = f'<select id="{id_}" name="{cle}" {attribut}="{cle}">{options}</select>'
    else:
        exemple = f' placeholder="{e(champ["exemple"])}"' if champ.get('exemple') else ''
        maxlen = f' maxlength="{champ["max"]}"' if champ.get('max') else ''
        saisie = f'<input type="text" id="{id_}" name="{cle}"{exemple}{maxlen} {attribut}="{cle}">'
    return f'''            <div class="choix-champ">
              <label for="{id_}">{e(champ['libelle'])}</label>
              {saisie}
            </div>'''


def carte_produit(p):
    champs = p.get('champs') or []
    option = p.get('option')
    badge = '<span class="choix-badge">Personnalisable</span>' if (champs or option) else ''

    perso = ''
    if champs:
        blocs = '\n'.join(champ_html(ch, f'p-{p["id"]}', 'data-champ') for ch in champs)
        perso += f'''
          <div class="choix-perso">
            <div class="choix-champs">
{blocs}
            </div>
          </div>'''
    if option:
        blocs_option = '\n'.join(champ_html(ch, f'po-{p["id"]}', 'data-champ-option')
                                  for ch in (option.get('champs') or []))
        zone_option = (f'''
              <div class="choix-champs produit-option-champs" hidden>
{blocs_option}
              </div>''' if blocs_option else '')
        perso += f'''
          <div class="choix-perso">
            <label class="choix-option">
              <input type="checkbox" class="produit-option-case">
              <span>{e(option['libelle'])} (+ {chf(option['supplement'])})</span>
            </label>{zone_option}
          </div>'''

    return f'''        <article class="produit-carte" data-produit-carte="{e(p['id'])}">
          <div class="produit-photo">
            <img src="/{e(p['image'])}" alt="{e(p['nom'])}" loading="lazy" decoding="async" width="600" height="600">
          </div>
          <div class="produit-corps">
            <h3 class="produit-nom">{e(p['nom'])}{badge}</h3>
            <span class="produit-prix">{chf(p['prix'])}</span>{perso}
            <div class="choix-pas">
              <button type="button" data-role="moins" aria-label="Retirer un {e(p['nom'])}">&minus;</button>
              <input type="number" min="1" max="99" value="1" inputmode="numeric" aria-label="Nombre de {e(p['nom'])}">
              <button type="button" data-role="plus" aria-label="Ajouter un {e(p['nom'])}">+</button>
            </div>
            <button type="button" class="btn btn-primary produit-ajouter">Ajouter au panier</button>
          </div>
        </article>'''


def carte_package(pk, c):
    """Une offre de la collection : la modale des packages, déjà
    construite et testée, reste seule responsable de la sélection —
    cette carte ne fait qu'inviter à l'ouvrir, avec data-packages et
    ouvrirPackages(), sans rien dupliquer de leur logique. Sans photo
    propre à l'assortiment, c'est la photo de la collection qui illustre
    la carte, comme dans la modale elle-même."""
    composition = '\n'.join(
        f'              <li><span class="package-qte">{d["qte"]} ×</span> {e(d["nom"])}</li>'
        for d in pk['detail'])
    return f'''        <article class="produit-carte">
          <div class="produit-photo">
            <img src="/{e(c['image'])}" alt="{e(c['alt'])}" loading="lazy" decoding="async" width="600" height="600">
          </div>
          <div class="produit-corps">
            <h3 class="produit-nom">{e(pk['nom'])}</h3>
            <span class="produit-prix">{chf(pk['prix'])} &middot; {pk['biscuits']} biscuits</span>
            <ul class="package-option-composition">
{composition}
            </ul>
            <button type="button" class="btn btn-primary produit-ajouter" data-packages="{e(c['id'])}">Choisir ce package</button>
          </div>
        </article>'''


def section_produits(c, type_):
    """Le cœur de la page, différent selon le type — jamais un produit
    seulEnPackage affiché comme achetable, jamais un prix inventé pour
    une collection sur devis."""
    if type_ == 'A':
        cartes = '\n\n'.join(carte_produit(p) for p in c['produits'])
        return f'''  <section id="produits" aria-labelledby="produits-title">
    <div class="wrap">
      <div class="section-head center section-head-mince">
        <span class="eyebrow" style="justify-content:center;">La collection</span>
        <h2 id="produits-title">Les biscuits de la collection</h2>
        <p class="narrow">Choisissez vos modèles et vos quantités. Le minimum de 12 biscuits à l’unité porte sur l’ensemble du panier, toutes collections confondues : vous pouvez donc compléter avec d’autres collections.</p>
      </div>

      <div class="produit-grille">
{cartes}
      </div>

      <p class="tarifs-note">Livraison offerte dès 150 CHF en Suisse, 9 CHF en dessous. Retrait possible dans le canton de Fribourg.</p>
    </div>
  </section>'''

    if type_ == 'B':
        cartes = '\n\n'.join(carte_package(pk, c) for pk in c['packages'])
        intro = e(c.get('packagesResume') or '')
        return f'''  <section id="produits" aria-labelledby="produits-title">
    <div class="wrap">
      <div class="section-head center section-head-mince">
        <span class="eyebrow" style="justify-content:center;">La collection</span>
        <h2 id="produits-title">Les packages de la collection</h2>
        <p class="narrow">{intro} Chaque package est une offre complète, prête à offrir : sans minimum de commande, il se commande seul ou en le combinant avec d’autres collections.</p>
      </div>

      <div class="produit-grille">
{cartes}
      </div>

      <p class="tarifs-note">Livraison offerte dès 150 CHF en Suisse, 9 CHF en dessous. Retrait possible dans le canton de Fribourg.</p>
    </div>
  </section>'''

    # Type C : sur devis, rien à ajouter au panier.
    lien = 'contact.html?formule=biscuits&theme=' + urllib.parse.quote('Collection ' + c['nom'])
    return f'''  <section id="produits" aria-labelledby="produits-title">
    <div class="wrap">
      <div class="section-head center section-head-mince">
        <span class="eyebrow" style="justify-content:center;">Sur devis</span>
        <h2 id="produits-title">Composons cette collection ensemble</h2>
        <p class="narrow">Aucun modèle n’est encore fixé pour « {e(c['nom'])} » : formes, couleurs et quantité se décident avec vous.</p>
        <a href="/{e(lien)}" class="btn btn-primary">Demander un devis</a>
      </div>
    </div>
  </section>'''


def entite_principale(c, type_):
    """L'ItemList de la page : des packages pour le type B, des produits
    pour le type A, rien pour le type C — jamais un prix ou une offre
    annoncés là où le catalogue n'en a pas."""
    if type_ == 'B':
        items = [(pk['nom'], c['image'], pk['prix']) for pk in c['packages']]
        nom_liste = f'Packages de la collection {c["nom"]}'
    elif type_ == 'A':
        items = [(p['nom'], p['image'], p['prix']) for p in c['produits']]
        nom_liste = f'Biscuits de la collection {c["nom"]}'
    else:
        return None
    return {
        '@type': 'ItemList',
        'name': nom_liste,
        'numberOfItems': len(items),
        'itemListElement': [
            {'@type': 'ListItem', 'position': i + 1, 'item': {
                '@type': 'Product',
                'name': nom,
                'image': SITE + '/' + image,
                'offers': {
                    '@type': 'Offer', 'price': f'{prix / 100:.2f}',
                    'priceCurrency': 'CHF', 'availability': 'https://schema.org/InStock'
                }
            }} for i, (nom, image, prix) in enumerate(items)
        ]
    }


def page(c):
    type_ = type_collection(c)
    slug = c['slug']
    url = f'{SITE}/collections/{slug}'
    titre = f'{c["nom"]} — Biscuits personnalisés | Jolie Création'
    description = c['description']
    image_principale = f'/images/collections/{c["id"]}/principale.webp'
    prix = prix_depart(c)

    donnees_structurees = {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        'name': titre,
        'url': url,
        'description': description,
        'breadcrumb': {
            '@type': 'BreadcrumbList',
            'itemListElement': [
                {'@type': 'ListItem', 'position': 1, 'name': 'Accueil', 'item': SITE + '/'},
                {'@type': 'ListItem', 'position': 2, 'name': 'Biscuits personnalisés',
                 'item': SITE + '/biscuits-personnalises.html'},
                {'@type': 'ListItem', 'position': 3, 'name': c['nom'], 'item': url}
            ]
        }
    }
    mainEntity = entite_principale(c, type_)
    if mainEntity:
        donnees_structurees['mainEntity'] = mainEntity

    return f'''<!DOCTYPE html>
<html lang="fr-CH">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{e(titre)}</title>
<meta name="description" content="{e(description)}">
<link rel="canonical" href="{url}">
<meta property="og:type" content="website">
<meta property="og:title" content="{e(titre)}">
<meta property="og:description" content="{e(description)}">
<meta property="og:image" content="{SITE}{image_principale}">
<meta property="og:locale" content="fr_CH">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" href="/favicon.png">
<link rel="apple-touch-icon" href="/favicon.png">
<link rel="stylesheet" href="/styles.css">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Alex+Brush&family=Jost:wght@300;400;500;600&display=swap" rel="stylesheet">
<!-- socle:jsonld -->
<!-- /socle:jsonld -->
<script type="application/ld+json">
{json.dumps(donnees_structurees, ensure_ascii=False, indent=2)}
</script>
</head>
<body>
{entete_nav()}

<main>
  <div class="wrap">
{fil_ariane(c)}
  </div>

  <section aria-labelledby="collection-titre">
    <div class="wrap">
      <article class="collection-bloc" aria-labelledby="collection-titre">
        <div class="collection-photo">
          <img src="{image_principale}" alt="{e(c['alt'])}" loading="eager" fetchpriority="high" decoding="async" data-photo-collection>
          <span class="collection-photo-repli" aria-hidden="true">{e(c['nom'])}</span>
        </div>
        <div class="collection-corps">
          <p class="collection-meta"><span class="collection-occasion">{e(c['occasion'])}</span></p>
          <h1 id="collection-titre">{e(c['nom'])}</h1>
          <p class="collection-texte">{e(description)}</p>
          <ul class="collection-faits">
            {'' if type_ == 'C' else f'<li>{prix}</li>'}{''.join(f'<li>{e(f)}</li>' for f in faits_hero(c, type_))}
          </ul>
          <a href="#produits" class="btn btn-primary btn-small">{ {'A': 'Voir les biscuits', 'B': 'Voir les packages', 'C': 'Demander un devis'}[type_] }</a>
        </div>
      </article>
    </div>
  </section>

{section_produits(c, type_)}

{bloc_ingredients()}

{bloc_chaque_occasion()}

{bloc_avis()}

  <section>
    <div class="wrap">
      <div class="cta-final">
        <span class="eyebrow" style="color:var(--gold-light);">Envie de la collection {e(c['nom'])} ?</span>
        <h2>{ {'A': 'Composez vos biscuits', 'B': 'Choisissez votre package', 'C': 'Composons cette collection'}[type_] } <span class="script">{ {'A': 'dès maintenant', 'B': 'dès maintenant', 'C': 'ensemble'}[type_] }</span></h2>
        <p>{ {'A': 'Ajoutez vos modèles au panier ci-dessus, ou décrivez-moi votre projet si vous avez une envie particulière.',
               'B': 'Choisissez votre package ci-dessus, ou décrivez-moi votre projet si vous avez une envie particulière.',
               'C': 'Décrivez-moi votre projet : je reviens vers vous avec une proposition sur mesure.'}[type_] }</p>
        <div class="hero-actions">
          <a href="#produits" class="btn btn-primary">{ {'A': 'Voir les biscuits', 'B': 'Voir les packages', 'C': 'Voir la collection'}[type_] }</a>
          <a href="/contact.html?formule=biscuits" class="btn btn-ghost on-dark">Demander un devis</a>
        </div>
      </div>
    </div>
  </section>
</main>
{pied_page()}
</body>
</html>
'''


def main():
    DOSSIER.mkdir(exist_ok=True)
    cols = collections()
    slugs = [c['slug'] for c in cols]
    doublons = {s for s in slugs if slugs.count(s) > 1}
    if doublons:
        raise SystemExit(f'Slugs en double, à corriger dans catalogue.js : {doublons}')

    ecrites = set()
    for c in cols:
        type_ = type_collection(c)
        cible = DOSSIER / f'{c["slug"]}.html'
        cible.write_text(page(c), encoding='utf-8')
        ecrites.add(cible.name)
        if type_ == 'A':
            detail = f'{len(c["produits"])} produit(s)'
        elif type_ == 'B':
            detail = f'{len(c["packages"])} package(s)'
        else:
            detail = 'sur devis'
        print(f'{cible.relative_to(RACINE)} — type {type_} — {c["nom"]}, {detail}, {prix_depart(c)}')

    # Une page dont la collection a disparu du catalogue ne doit pas
    # rester en ligne, orpheline et non reliée depuis le reste du site.
    orphelines = [f for f in DOSSIER.glob('*.html') if f.name not in ecrites]
    for f in orphelines:
        print(f'  ATTENTION : {f.relative_to(RACINE)} ne correspond plus à aucune collection.', flush=True)


if __name__ == '__main__':
    main()
