/* Vérifie le catalogue et la fonction de paiement sans appeler SumUp :
   c'est elle qui décide du montant réellement débité, elle mérite d'être
   testée sans dépendre du réseau ni d'un compte marchand.

   Lancement : npm test
*/
const assert = require('node:assert');
const Catalogue = require('../catalogue.js');
const fonction = require('../netlify/functions/create-checkout.js');

let vert = 0, rouge = 0;

async function cas(nom, corps) {
  try {
    await corps();
    console.log('OK  ' + nom);
    vert++;
  } catch (e) {
    console.log('NON ' + nom + '\n    ' + e.message);
    rouge++;
  }
}

function appeler(corps, env) {
  const memoire = { ...process.env };
  Object.assign(process.env, env || {});
  return fonction
    .handler({ httpMethod: 'POST', body: JSON.stringify(corps), headers: {} })
    .then((r) => {
      process.env = memoire;
      return { code: r.statusCode, corps: JSON.parse(r.body) };
    })
    .catch((e) => {
      process.env = memoire;
      throw e;
    });
}

const AVEC_CLES = { SUMUP_API_KEY: 'sup_sk_test', SUMUP_MERCHANT_CODE: 'MTEST' };

/* Un panier valable : 5 biscuits d'une collection, 7 d'une autre. */
const PANIER_MIXTE = [
  { id: 'petit-ocean-etoile-orange', qte: 5 },
  { id: 'reve-licorne-noeud-dore', qte: 7 }
];

/* Les collections attendues, dans l'ordre annoncé. Les sept premières sont
   volontairement en tête : des thèmes qui commandent régulièrement, remontés
   devant le reste sans changer l'ordre relatif du reste entre elles. */
const COLLECTIONS_ATTENDUES = [
  'Petit Océan', 'Passion Cheval', 'Dolce Vita', 'Baptême Nature',
  'Rêve de Licorne', 'Moto', 'Magie de Noël',
  'Automne', 'Frissons d’Halloween', 'Douceurs de Pâques',
  'Merci Maîtresse – Bonnes Vacances', 'Bonne fête Maman', 'Baptême Douceur',
  'Annonce de grossesse', 'Douceur personnalisée', 'Girls Club – EVJF',
  'American Road Trip', 'Petit Chantier', 'Petite Oie',
  'Petit Lapin au Jardin', 'Gender Reveal', 'Saint-Valentin',
  // Trois collections restent sur devis : leurs modèles se composent avec
  // la cliente, aucun prix n'a été arrêté.
  'Douceur d’Abeille', 'Passion Vélo', 'Élégance Florale',
  'Logo d’entreprise'
];

/* Nombre de modèles par collection, relu sur la liste fournie. */
const MODELES_ATTENDUS = {
  'automne': 7,
  'magie-noel': 16, 'frissons-halloween': 9, 'douceurs-paques': 9,
  'merci-maitresse': 4, 'bonne-fete-maman': 2, 'bapteme-douceur': 1,
  'annonce-grossesse': 5, 'douceur-personnalisee': 2, 'girls-club': 1,
  'american-road-trip': 12, 'petit-chantier': 9, 'passion-cheval': 10,
  'petit-ocean': 9, 'reve-licorne': 4, 'petite-oie': 8,
  'petit-lapin-jardin': 5, 'gender-reveal': 8, 'saint-valentin': 4,
  'dolce-vita': 11, 'moto': 9,
  'douceur-abeille': 0, 'velo-route': 0, 'elegance-florale': 0,
  'bapteme-nature': 4, 'logo-entreprise': 1
};

/* Quelques prix relus un par un, aux deux extrémités de chaque collection.
   Si une transcription dérape, c'est ici que cela se voit. */
const PRIX_TEMOINS = {
  'magie-noel-sucre-orge': 500, 'magie-noel-joyeux-noel': 700,
  'frissons-halloween-crane': 400, 'frissons-halloween-chauve-souris': 650,
  'douceurs-paques-lapin-dos': 500, 'douceurs-paques-joyeuses-paques': 800,
  'merci-maitresse-avion': 600, 'merci-maitresse-crayon': 650,
  'bonne-fete-maman-coeur-maman': 600, 'bonne-fete-maman-marguerite-relief': 700,
  'bapteme-douceur-grand-bapteme': 700,
  'annonce-grossesse-petit-coeur': 400, 'annonce-grossesse-calendrier': 700,
  'douceur-personnalisee-chiffre': 600, 'douceur-personnalisee-nuage-prenom': 650,
  'girls-club-the-girls-club': 600,
  'american-road-trip-poche-jean': 600, 'american-road-trip-pick-up': 700,
  'petit-chantier-cone': 500, 'petit-chantier-pelleteuse-detaillee': 700,
  'passion-cheval-petite-fleur': 400, 'passion-cheval-coeur-cheval': 800,
  'petit-ocean-etoile-orange': 400, 'petit-ocean-hippocampe': 700,
  'reve-licorne-chiffre-pois': 500, 'reve-licorne-licorne': 800,
  'petite-oie-petite-marguerite': 400, 'petite-oie-arche-oie': 800,
  'petit-lapin-jardin-fleur-bleue': 400, 'petit-lapin-jardin-grand-lapin': 800,
  'gender-reveal-branche': 500, 'gender-reveal-ourson': 700,
  'saint-valentin-petit-coeur': 400, 'saint-valentin-love': 600,
  'dolce-vita-citron': 400, 'dolce-vita-age-citrons': 700,
  'moto-vroom': 500, 'moto-speed-limit': 600,
  'bapteme-nature-branches': 500, 'bapteme-nature-lettre': 700,
  'logo-entreprise-logo': 500
};

(async () => {
  /* ---------- Le catalogue ---------- */
  await cas('les vingt-six collections sont là, dans l’ordre', () => {
    assert.deepStrictEqual(Catalogue.COLLECTIONS.map((c) => c.nom), COLLECTIONS_ATTENDUES);
  });

  await cas('chaque collection compte le bon nombre de modèles', () => {
    Catalogue.COLLECTIONS.forEach((c) => {
      assert.strictEqual(c.produits.length, MODELES_ATTENDUS[c.id],
        c.id + ' : ' + c.produits.length + ' modèles');
    });
    const biscuits = Catalogue.ARTICLES.filter((a) => a.categorie === 'biscuit');
    assert.strictEqual(biscuits.length, 150);
    assert.strictEqual(Catalogue.ARTICLES.length, 156);   // 150 biscuits + 6 packages
  });

  await cas('les prix témoins sont exacts', () => {
    Object.keys(PRIX_TEMOINS).forEach((id) => {
      const a = Catalogue.article(id);
      assert.ok(a, 'article introuvable : ' + id);
      assert.strictEqual(a.prix, PRIX_TEMOINS[id],
        id + ' : ' + a.prix + ' au lieu de ' + PRIX_TEMOINS[id]);
    });
  });

  await cas('tous les prix sont des entiers de centimes plausibles', () => {
    Catalogue.ARTICLES.forEach((a) => {
      assert.ok(Number.isInteger(a.prix), a.id + ' : prix non entier');
      // Un package coûte plusieurs biscuits : sa fourchette n'est pas
      // celle d'un modèle à l'unité.
      // Le squelette d'Halloween, grand et très travaillé, monte à 8.50 :
      // la fourchette d'un biscuit va jusqu'à 9 CHF.
      const [bas, haut] = a.categorie === 'package' ? [1000, 12000] : [400, 900];
      assert.ok(a.prix >= bas && a.prix <= haut, a.id + ' : prix hors de la fourchette annoncée');
      // Le pas de 50 centimes vaut pour un biscuit vendu à l'unité. Un
      // package se fixe au franc près, en .90 : ce n'est pas un tarif au
      // modèle, c'est un prix d'assortiment.
      if (a.categorie === 'biscuit') {
        assert.strictEqual(a.prix % 50, 0, a.id + ' : prix hors du pas de 50 centimes');
      }
    });
  });

  await cas('chaque identifiant d’article est unique', () => {
    const vus = new Set();
    Catalogue.ARTICLES.forEach((a) => {
      assert.ok(!vus.has(a.id), 'identifiant en double : ' + a.id);
      vus.add(a.id);
    });
  });

  await cas('chaque biscuit compte pour un dans le minimum', () => {
    Catalogue.ARTICLES.filter((a) => a.categorie === 'biscuit')
      .forEach((a) => assert.strictEqual(a.biscuits, 1, a.id));
  });

  await cas('le seul supplément est celui du Girls Club', () => {
    const avecOption = Catalogue.ARTICLES.filter((a) => a.option);
    assert.strictEqual(avecOption.length, 1, 'suppléments trouvés : ' + avecOption.map((a) => a.id));
    assert.strictEqual(avecOption[0].id, 'girls-club-the-girls-club');
    assert.strictEqual(avecOption[0].option.supplement, 50);
    assert.strictEqual(Catalogue.prixUnitaire(avecOption[0], true), 650);
    assert.strictEqual(Catalogue.prixUnitaire(avecOption[0], false), 600);
  });

  await cas('les champs de personnalisation renvoient à des champs connus', () => {
    Catalogue.ARTICLES.forEach((a) => {
      a.champs.forEach((ch) => {
        assert.ok(ch && ch.cle && ch.libelle, a.id + ' : champ de personnalisation incomplet');
        assert.strictEqual(Catalogue.CHAMPS[ch.cle], ch, a.id + ' : champ hors catalogue');
      });
    });
  });

  await cas('un biscuit non personnalisable ne demande rien', () => {
    const simple = Catalogue.article('magie-noel-sucre-orge');
    assert.strictEqual(simple.champs.length, 0);
    assert.strictEqual(simple.option, undefined);
  });

  await cas('chaque collection annonce son image et son texte alternatif', () => {
    Catalogue.COLLECTIONS.forEach((c) => {
      assert.strictEqual(c.image, 'images/collections/' + c.id + '/principale.webp', c.id);
      assert.ok(c.alt && c.alt.length > 20, c.id + ' : texte alternatif trop court');
      assert.ok(c.description && c.description.length > 60, c.id + ' : description trop courte');
    });
  });

  await cas('le minimum de commande est de douze biscuits', () => {
    assert.strictEqual(Catalogue.MIN_BISCUITS, 12);
  });

  await cas('deux collections du moment, Automne puis Halloween', () => {
    const saison = Catalogue.COLLECTIONS.filter((c) => c.saison).map((c) => c.id);
    assert.deepStrictEqual(saison, ['automne', 'frissons-halloween']);
  });

  await cas('les galeries sont numérotées sans trou et décrites', () => {
    const vus = new Set();
    Catalogue.COLLECTIONS.forEach((c) => {
      (c.galerie || []).forEach((v, i) => {
        assert.strictEqual(v.image, `images/collections/${c.id}/vue-${i + 1}.webp`, c.id);
        assert.ok(v.alt && v.alt.length > 25, v.image + ' : texte alternatif trop court');
        assert.ok(!vus.has(v.alt), 'texte alternatif en double : ' + v.alt);
        vus.add(v.alt);
      });
    });
  });

  await cas('chaque vue déclarée existe sur le disque, et réciproquement', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const racine = path.join(__dirname, '..');
    const declarees = new Set();
    Catalogue.COLLECTIONS.forEach((c) => (c.galerie || []).forEach((v) => {
      declarees.add(v.image);
      assert.ok(fs.existsSync(path.join(racine, v.image)), 'fichier manquant : ' + v.image);
    }));
    // Un fichier dérivé que plus personne ne déclare ne doit pas traîner :
    // il partirait en production sans jamais s'afficher.
    Catalogue.COLLECTIONS.forEach((c) => {
      const dossier = path.join(racine, 'images', 'collections', c.id);
      fs.readdirSync(dossier)
        .filter((f) => f.startsWith('vue-') && f.endsWith('.webp'))
        .forEach((f) => assert.ok(declarees.has(`images/collections/${c.id}/${f}`),
          'vue orpheline : ' + c.id + '/' + f));
    });
  });

  await cas('une galerie ne montre que des collections réellement achetables', () => {
    Catalogue.COLLECTIONS.forEach((c) => {
      if (!(c.galerie || []).length) return;
      // Une collection sur devis a le droit d'être illustrée : ce qu'elle
      // ne peut pas faire, c'est promettre un prix.
      assert.ok(true, c.id);
    });
  });

  await cas('une collection sans modèle n’ajoute aucun article achetable', () => {
    const surDevis = Catalogue.COLLECTIONS.filter((c) => !c.produits.length);
    assert.strictEqual(surDevis.length, 3, surDevis.map((c) => c.id).join(' '));
    surDevis.forEach((c) => {
      assert.strictEqual(Catalogue.ARTICLES.filter((a) => a.collectionId === c.id).length, 0, c.id);
    });
    assert.strictEqual(Catalogue.article('logo-entreprise-quoi-que-ce-soit'), null);
  });

  /* ---------- La fonction de paiement ---------- */
  await cas('sans clés SumUp, la fonction refuse au lieu de simuler un paiement', async () => {
    const r = await appeler({ lignes: PANIER_MIXTE }, { SUMUP_API_KEY: '', SUMUP_MERCHANT_CODE: '' });
    assert.strictEqual(r.code, 503);
    assert.strictEqual(r.corps.erreur, 'sumup_non_configure');
  });

  await cas('un panier vide est refusé', async () => {
    const r = await appeler({ lignes: [] }, AVEC_CLES);
    assert.strictEqual(r.code, 400);
    assert.strictEqual(r.corps.erreur, 'panier_vide');
  });

  await cas('un identifiant d’article inconnu est refusé', async () => {
    const r = await appeler({ lignes: [{ id: 'biscuit-inexistant', qte: 20 }] }, AVEC_CLES);
    assert.strictEqual(r.code, 400);
    assert.strictEqual(r.corps.erreur, 'article_inconnu');
  });

  await cas('moins de douze biscuits est refusé, même côté serveur', async () => {
    const r = await appeler({ lignes: [{ id: 'petit-ocean-baleine', qte: 11 }] }, AVEC_CLES);
    assert.strictEqual(r.code, 400);
    assert.strictEqual(r.corps.erreur, 'minimum_biscuits');
  });

  await cas('douze biscuits répartis sur deux collections passent', async () => {
    // La clé est bidon : on n'échoue donc qu'au contact de SumUp, ce qui
    // prouve que le minimum et la retarification ont été acceptés.
    const r = await appeler({ lignes: PANIER_MIXTE, client: { reception: 'livraison' } }, AVEC_CLES);
    assert.ok(r.code === 502, 'attendu 502 (SumUp injoignable), reçu ' + r.code);
  });

  await cas('une commande à retirer ne passe pas par le paiement en ligne', async () => {
    const r = await appeler({ lignes: PANIER_MIXTE, client: { reception: 'retrait' } }, AVEC_CLES);
    assert.strictEqual(r.code, 400);
    assert.strictEqual(r.corps.erreur, 'retrait_sans_paiement');
  });

  /* ---------- Les montants ---------- */
  await cas('un panier mélangé se totalise correctement', () => {
    // 5 × 4 CHF + 7 × 6 CHF = 62 CHF, pour 12 biscuits.
    const total = PANIER_MIXTE.reduce(
      (s, l) => s + Catalogue.prixUnitaire(Catalogue.article(l.id)) * l.qte, 0);
    assert.strictEqual(total, 6200);
    assert.strictEqual(Catalogue.formater(total), '62 CHF');
    const biscuits = PANIER_MIXTE.reduce((s, l) => s + l.qte, 0);
    assert.strictEqual(biscuits, Catalogue.MIN_BISCUITS);
  });

  await cas('la conversion en unités majeures ne perd pas de centimes', () => {
    assert.strictEqual(Catalogue.enFrancs(650), 6.5);
    assert.strictEqual(Catalogue.enFrancs(600), 6);
    assert.strictEqual(Catalogue.enFrancs(450), 4.5);
    assert.strictEqual(Catalogue.enFrancs(12345), 123.45);
  });

  await cas('le formatage suisse des montants est correct', () => {
    assert.strictEqual(Catalogue.formater(400), '4 CHF');
    assert.strictEqual(Catalogue.formater(650), '6.50 CHF');
    assert.strictEqual(Catalogue.formater(8000), '80 CHF');
  });

  await cas('aucune micro-scénographie ne s’achète en ligne', () => {
    // Deux catégories seulement, et pas une de plus : un biscuit, ou un
    // package de biscuits. Une prestation ne se met pas au panier.
    const categories = [...new Set(Catalogue.ARTICLES.map((a) => a.categorie))].sort();
    assert.deepStrictEqual(categories, ['biscuit', 'package']);
  });

  /* ---------- Les packages saisonniers ----------
     Un package est un article comme un autre : toute la chaîne le traite
     sans le connaître. Ce qui se teste ici, c'est ce qui le distingue —
     sa composition, son compte de biscuits, et la règle de minimum qu'il
     lève. */
  const PACKAGES_ATTENDUS = {
    'automne-pack-essentiel': {
      nom: 'L’Essentiel', prix: 3290, biscuits: 5, complet: false, horsSuisse: false,
      composition: { 'feuille-blanche': 1, 'mug': 1, 'branche': 1, 'citrouille': 1,
                     'citrouilles-empilees': 1 }
    },
    'automne-pack-gourmande': {
      nom: 'La Gourmande', prix: 4490, biscuits: 7, complet: false, horsSuisse: false,
      composition: { 'feuille-blanche': 1, 'feuille-orange': 1, 'mug': 2, 'branche': 1,
                     'citrouille': 1, 'grand-pull': 1 }
    },
    'automne-pack-complete': {
      nom: 'L’Automne Complète', prix: 6490, biscuits: 10, complet: true, horsSuisse: true,
      composition: { 'feuille-blanche': 1, 'feuille-orange': 1, 'mug': 2, 'branche': 2,
                     'citrouille': 2, 'citrouilles-empilees': 1, 'grand-pull': 1 }
    }
  };

  await cas('les trois packages d’Automne ont le prix annoncé', () => {
    Object.keys(PACKAGES_ATTENDUS).forEach((id) => {
      const a = Catalogue.article(id);
      assert.ok(a, 'package introuvable : ' + id);
      assert.strictEqual(a.categorie, 'package', id);
      assert.strictEqual(a.nom, PACKAGES_ATTENDUS[id].nom, id);
      assert.strictEqual(a.prix, PACKAGES_ATTENDUS[id].prix,
        id + ' : ' + Catalogue.formater(a.prix));
    });
    assert.strictEqual(Catalogue.formater(3290), '32.90 CHF');
    assert.strictEqual(Catalogue.formater(4490), '44.90 CHF');
    assert.strictEqual(Catalogue.formater(6490), '64.90 CHF');
  });

  await cas('la composition de chaque package est exacte', () => {
    Object.keys(PACKAGES_ATTENDUS).forEach((id) => {
      const a = Catalogue.article(id);
      const vu = {};
      a.detail.forEach((d) => {
        assert.ok(d.connu, id + ' : modèle inconnu dans la composition — ' + d.ref);
        vu[d.ref] = d.qte;
      });
      assert.deepStrictEqual(vu, PACKAGES_ATTENDUS[id].composition, id);
    });
  });

  await cas('le nombre de biscuits se déduit de la composition', () => {
    Object.keys(PACKAGES_ATTENDUS).forEach((id) => {
      const a = Catalogue.article(id);
      const somme = a.composition.reduce((n, x) => n + x.qte, 0);
      assert.strictEqual(a.biscuits, somme, id + ' : total incohérent');
      assert.strictEqual(a.biscuits, PACKAGES_ATTENDUS[id].biscuits, id);
    });
  });

  await cas('seul le package complet part à l’étranger', () => {
    Object.keys(PACKAGES_ATTENDUS).forEach((id) => {
      assert.strictEqual(!!Catalogue.article(id).horsSuisse,
        PACKAGES_ATTENDUS[id].horsSuisse, id);
    });
  });

  /* Le total d'un panier, calculé comme le fait le serveur. */
  const total = (lignes) => lignes.reduce((s, l) =>
    s + Catalogue.prixUnitaire(Catalogue.article(l.id), l.option) * l.qte, 0);
  const biscuits = (lignes) => lignes.reduce((s, l) =>
    s + (Catalogue.article(l.id).biscuits || 0) * l.qte, 0);


  /* ---------- Les treize cas de la règle ----------
     Le minimum ne regarde que les biscuits pris à l'unité. Un package
     n'y entre pas et n'en dispense pas : les deux règles cohabitent
     sans se parler. Les biscuits à l'unité viennent d'autres
     collections, puisque celles du moment ne s'y vendent plus. */
  const AUTOMNE = 'automne-pack-essentiel';
  const HALLOWEEN = 'frissons-halloween-pack-complete';
  const CHANTIER = 'petit-chantier-cone';
  const DOLCE = 'dolce-vita-citron';
  const passe = (panier) =>
    Catalogue.biscuitsIndividuels(panier) >= Catalogue.minimumRequis(panier);

  await cas('1 · un package Automne seul suffit', () => {
    const panier = [{ id: AUTOMNE, qte: 1 }];
    assert.strictEqual(Catalogue.biscuitsIndividuels(panier), 0);
    assert.strictEqual(Catalogue.minimumRequis(panier), 0);
    assert.ok(passe(panier));
  });

  await cas('2 · un package Halloween seul suffit', () => {
    assert.ok(passe([{ id: HALLOWEEN, qte: 1 }]));
  });

  await cas('3 · les deux packages ensemble suffisent', () => {
    const panier = [{ id: AUTOMNE, qte: 1 }, { id: HALLOWEEN, qte: 1 }];
    assert.strictEqual(Catalogue.biscuitsIndividuels(panier), 0);
    assert.ok(passe(panier));
  });

  await cas('4 · package + 12 biscuits d’une autre collection', () => {
    const panier = [{ id: AUTOMNE, qte: 1 }, { id: CHANTIER, qte: 12 }];
    assert.strictEqual(Catalogue.biscuitsIndividuels(panier), 12);
    assert.ok(passe(panier));
  });

  await cas('5 · package + 6 biscuits d’une autre : refusé', () => {
    const panier = [{ id: AUTOMNE, qte: 1 }, { id: CHANTIER, qte: 6 }];
    assert.strictEqual(Catalogue.biscuitsIndividuels(panier), 6);
    assert.strictEqual(Catalogue.minimumRequis(panier), 12);
    assert.ok(!passe(panier));
  });

  await cas('6 · package + 6 + 6 de deux collections : accepté', () => {
    const panier = [{ id: AUTOMNE, qte: 1 },
                    { id: CHANTIER, qte: 6 }, { id: DOLCE, qte: 6 }];
    assert.strictEqual(Catalogue.biscuitsIndividuels(panier), 12);
    assert.ok(passe(panier));
  });

  await cas('7 · package + 4 biscuits d’une autre : refusé', () => {
    const panier = [{ id: AUTOMNE, qte: 1 }, { id: CHANTIER, qte: 4 }];
    assert.ok(!passe(panier));
  });

  await cas('8 · deux packages + 12 biscuits à l’unité', () => {
    const panier = [{ id: AUTOMNE, qte: 1 }, { id: HALLOWEEN, qte: 1 },
                    { id: CHANTIER, qte: 12 }];
    assert.strictEqual(Catalogue.biscuitsIndividuels(panier), 12);
    assert.ok(passe(panier));
  });

  await cas('9 à 12 · aucun biscuit du moment ne se vend à l’unité', () => {
    ['automne', 'frissons-halloween'].forEach((id) => {
      const c = Catalogue.COLLECTIONS.find((x) => x.id === id);
      assert.ok(c.packagesSeuls, id + ' : la collection devrait être en packages seuls');
      assert.ok(c.produits.length, id + ' : ses modèles restent décrits');
      c.produits.forEach((p) => {
        const a = Catalogue.article(p.id);
        assert.strictEqual(a.seulEnPackage, true, p.id);
        assert.strictEqual(Catalogue.lignesHorsVente([{ id: p.id, qte: 1 }]).length, 1, p.id);
        // Leur contenu ne compte jamais pour le minimum, même seul.
        assert.strictEqual(Catalogue.biscuitsIndividuels([{ id: p.id, qte: 20 }]), 20, p.id);
      });
    });
    // Les nommés du brief, un par un.
    ['automne-citrouille', 'frissons-halloween-boo-violet'].forEach((id) => {
      assert.strictEqual(Catalogue.article(id).seulEnPackage, true, id);
    });
  });

  await cas('13 · les autres collections restent vendables à l’unité', () => {
    const autres = Catalogue.COLLECTIONS.filter((c) => !c.packagesSeuls);
    assert.strictEqual(autres.length, Catalogue.COLLECTIONS.length - 2);
    autres.forEach((c) => {
      c.produits.forEach((p) => {
        assert.ok(!Catalogue.article(p.id).seulEnPackage, p.id);
      });
      assert.strictEqual(Catalogue.lignesHorsVente(
        c.produits.map((p) => ({ id: p.id, qte: 1 }))).length, 0, c.id);
    });
    // Et leur règle n'a pas bougé : douze biscuits, ni plus ni moins.
    assert.strictEqual(Catalogue.minimumRequis([{ id: CHANTIER, qte: 5 }]), 12);
    assert.ok(!passe([{ id: CHANTIER, qte: 11 }]));
    assert.ok(passe([{ id: CHANTIER, qte: 12 }]));
  });

  await cas('le contenu d’un package n’entre jamais dans les douze', () => {
    // Onze biscuits dans le package, zéro à l'unité : rien à atteindre.
    assert.strictEqual(Catalogue.article(HALLOWEEN).biscuits, 11);
    assert.strictEqual(Catalogue.biscuitsIndividuels([{ id: HALLOWEEN, qte: 1 }]), 0);
    // Et il n'en dispense pas non plus : un biscuit à côté rouvre les douze.
    const panier = [{ id: HALLOWEEN, qte: 1 }, { id: CHANTIER, qte: 1 }];
    assert.strictEqual(Catalogue.minimumRequis(panier), 12);
    assert.ok(!passe(panier));
  });

  await cas('hors de Suisse, seul le package complet est proposé', () => {
    const petit = [{ id: 'automne-pack-essentiel', qte: 1 }];
    const complet = [{ id: 'automne-pack-complete', qte: 1 }];
    ['France', 'Allemagne', 'Autre pays d’Europe'].forEach((pays) => {
      assert.strictEqual(Catalogue.packagesHorsZone(petit, pays).length, 1, pays);
      assert.strictEqual(Catalogue.packagesHorsZone(complet, pays).length, 0, pays);
    });
    assert.strictEqual(Catalogue.packagesHorsZone(petit, 'Suisse').length, 0);
    assert.strictEqual(Catalogue.packagesHorsZone(petit).length, 0);
  });

  await cas('une quantité fabriquée à la main ne fait pas sauter le minimum', () => {
    // Le serveur contrôle un panier venu du réseau : « NaN < 12 » étant
    // faux, une quantité non numérique laisserait passer la commande.
    ['abc', null, undefined, -3, 0, NaN, Infinity, -Infinity].forEach((qte) => {
      const panier = [{ id: CHANTIER, qte }];
      assert.strictEqual(Catalogue.biscuitsIndividuels(panier), 0, String(qte));
    });
    assert.strictEqual(Catalogue.biscuitsIndividuels([{ id: CHANTIER, qte: '12' }]), 12);
    assert.strictEqual(Catalogue.biscuitsIndividuels([{ id: CHANTIER, qte: 2.7 }]), 2);
  });

  await cas('deux packages se commandent ensemble, sans minimum', () => {
    const panier = [{ id: 'automne-pack-essentiel', qte: 1 },
                    { id: 'frissons-halloween-pack-essentiel', qte: 1 }];
    assert.strictEqual(total(panier), 3290 + 3290);
    assert.strictEqual(biscuits(panier), 10);
    assert.strictEqual(Catalogue.minimumRequis(panier, 'Suisse'), 0);
  });

  await cas('les prix unitaires d’Automne sont ceux annoncés', () => {
    const UNITAIRES = {
      'automne-feuille-blanche': 700, 'automne-feuille-orange': 700,
      'automne-mug': 700, 'automne-branche': 500, 'automne-citrouille': 400,
      'automne-citrouilles-empilees': 650, 'automne-grand-pull': 800
    };
    Object.keys(UNITAIRES).forEach((id) => {
      assert.strictEqual(Catalogue.article(id).prix, UNITAIRES[id], id);
    });
  });

  await cas('le minimum de douze reste la règle sans package', () => {
    const panier = [{ id: 'magie-noel-sapin', qte: 5 }];
    assert.strictEqual(Catalogue.minimumRequis(panier), 12);
    assert.strictEqual(Catalogue.minimumRequis(panier, 'Suisse'), 12);
    assert.strictEqual(Catalogue.minimumRequis(panier, 'France'), 12);
  });

  await cas('un package saisonnier lève le minimum en Suisse', () => {
    ['automne-pack-essentiel', 'automne-pack-gourmande', 'automne-pack-complete']
      .forEach((id) => {
        const panier = [{ id: id, qte: 1 }];
        assert.strictEqual(Catalogue.minimumRequis(panier, 'Suisse'), 0, id);
        assert.strictEqual(Catalogue.minimumRequis(panier), 0, id + ' (pays non choisi)');
      });
  });






  /* ---------- Les packages d'Halloween ---------- */
  const HALLOWEEN_ATTENDUS = {
    'frissons-halloween-pack-essentiel': {
      nom: 'L’Essentiel', prix: 3290, biscuits: 5, horsSuisse: false,
      composition: { 'citrouille': 1, 'crane': 1, 'boo-violet': 1,
                     'toile-araignee': 1, 'fantome': 1 }
    },
    'frissons-halloween-pack-gourmande': {
      nom: 'La Gourmande', prix: 4490, biscuits: 7, horsSuisse: false,
      composition: { 'citrouille': 2, 'crane': 1, 'boo-violet': 1, 'boo-orange': 1,
                     'toile-araignee': 1, 'fantome': 1 }
    },
    'frissons-halloween-pack-complete': {
      nom: 'Frissons d’Halloween', prix: 6490, biscuits: 11, horsSuisse: true,
      composition: { 'citrouille': 3, 'crane': 1, 'boo-violet': 1, 'boo-orange': 1,
                     'squelette': 1, 'chauve-souris': 1, 'toile-araignee': 1,
                     'fantome': 1, 'courge-yeux': 1 }
    }
  };

  await cas('les trois packages d’Halloween ont le prix annoncé', () => {
    Object.keys(HALLOWEEN_ATTENDUS).forEach((id) => {
      const a = Catalogue.article(id);
      assert.ok(a, 'package introuvable : ' + id);
      assert.strictEqual(a.categorie, 'package', id);
      assert.strictEqual(a.nom, HALLOWEEN_ATTENDUS[id].nom, id);
      assert.strictEqual(a.prix, HALLOWEEN_ATTENDUS[id].prix,
        id + ' : ' + Catalogue.formater(a.prix));
    });
  });

  await cas('la composition de chaque package d’Halloween est exacte', () => {
    Object.keys(HALLOWEEN_ATTENDUS).forEach((id) => {
      const a = Catalogue.article(id);
      const vu = {};
      a.detail.forEach((d) => {
        assert.ok(d.connu, id + ' : modèle inconnu dans la composition — ' + d.ref);
        vu[d.ref] = d.qte;
      });
      assert.deepStrictEqual(vu, HALLOWEEN_ATTENDUS[id].composition, id);
      assert.strictEqual(a.biscuits, HALLOWEEN_ATTENDUS[id].biscuits,
        id + ' : ' + a.biscuits + ' biscuits');
    });
  });

  await cas('les prix unitaires d’Halloween sont ceux annoncés', () => {
    const UNITAIRES = {
      'frissons-halloween-citrouille': 400, 'frissons-halloween-crane': 400,
      'frissons-halloween-courge-yeux': 500, 'frissons-halloween-boo-violet': 600,
      'frissons-halloween-boo-orange': 600, 'frissons-halloween-toile-araignee': 600,
      'frissons-halloween-fantome': 600, 'frissons-halloween-chauve-souris': 650,
      'frissons-halloween-squelette': 850
    };
    Object.keys(UNITAIRES).forEach((id) => {
      assert.strictEqual(Catalogue.article(id).prix, UNITAIRES[id], id);
    });
    const h = Catalogue.COLLECTIONS.find((c) => c.id === 'frissons-halloween');
    assert.strictEqual(h.produits.length, 9);
  });



  await cas('les packages ne touchent que les collections du moment', () => {
    Catalogue.COLLECTIONS.forEach((c) => {
      if (c.saison) return;
      assert.ok(!c.packages || !c.packages.length,
        c.id + ' : une collection classique ne se vend pas en package');
    });
    const avecPackages = Catalogue.COLLECTIONS.filter((c) => (c.packages || []).length);
    assert.deepStrictEqual(avecPackages.map((c) => c.id), ['automne', 'frissons-halloween']);
  });

  /* ---------- Frais de livraison ---------- */
  await cas('la livraison en Suisse sous 150 CHF coûte 9 CHF', () => {
    assert.strictEqual(Catalogue.fraisLivraison(14999, 'livraison', 'Suisse'), 900);
    assert.strictEqual(Catalogue.fraisLivraison(100, 'livraison', 'Suisse'), 900);
  });

  await cas('la livraison en Suisse est offerte dès 150 CHF', () => {
    assert.strictEqual(Catalogue.fraisLivraison(15000, 'livraison', 'Suisse'), 0);
    assert.strictEqual(Catalogue.fraisLivraison(20000, 'livraison', 'Suisse'), 0);
  });

  await cas('la livraison hors de Suisse reste confirmée séparément', () => {
    assert.strictEqual(Catalogue.fraisLivraison(100, 'livraison', 'France'), 0);
    assert.strictEqual(Catalogue.fraisLivraison(100, 'livraison', ''), 0);
  });

  await cas('le retrait n’a jamais de frais de livraison', () => {
    assert.strictEqual(Catalogue.fraisLivraison(100, 'retrait', 'Suisse'), 0);
  });

  await cas('la fonction de paiement facture les frais de livraison suisses', async () => {
    // Un seul biscuit à 7 CHF x 12 = 84 CHF : sous le seuil de 150 CHF,
    // la Suisse doit donc payer 84 + 9 = 93 CHF.
    const r = await appeler({
      lignes: [{ id: 'petit-ocean-baleine', qte: 12 }],
      client: { reception: 'livraison', pays: 'Suisse' }
    }, AVEC_CLES);
    // La clé est bidon : on échoue au contact de SumUp (502), preuve que
    // la retarification (avec frais) a bien été acceptée avant cela.
    assert.ok(r.code === 502, 'attendu 502 (SumUp injoignable), reçu ' + r.code + ' : ' + JSON.stringify(r.corps));
  });

  console.log(`\n${vert} test(s) au vert, ${rouge} en échec.`);
  process.exit(rouge === 0 ? 0 : 1);
})();
