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

/* Les vingt collections attendues, dans l'ordre annoncé. */
const COLLECTIONS_ATTENDUES = [
  'Magie de Noël', 'Frissons d’Halloween', 'Douceurs de Pâques',
  'Merci Maîtresse – Bonnes Vacances', 'Bonne fête Maman', 'Baptême Douceur',
  'Annonce de grossesse', 'Douceur personnalisée', 'Girls Club – EVJF',
  'American Road Trip', 'Petit Chantier', 'Passion Cheval', 'Petit Océan',
  'Rêve de Licorne', 'Petite Oie', 'Petit Lapin au Jardin', 'Gender Reveal',
  'Saint-Valentin', 'Dolce Vita', 'Moto'
];

/* Nombre de modèles par collection, relu sur la liste fournie. */
const MODELES_ATTENDUS = {
  'magie-noel': 16, 'frissons-halloween': 8, 'douceurs-paques': 9,
  'merci-maitresse': 4, 'bonne-fete-maman': 2, 'bapteme-douceur': 1,
  'annonce-grossesse': 5, 'douceur-personnalisee': 2, 'girls-club': 1,
  'american-road-trip': 12, 'petit-chantier': 9, 'passion-cheval': 10,
  'petit-ocean': 9, 'reve-licorne': 4, 'petite-oie': 8,
  'petit-lapin-jardin': 5, 'gender-reveal': 8, 'saint-valentin': 4,
  'dolce-vita': 11, 'moto': 9
};

/* Quelques prix relus un par un, aux deux extrémités de chaque collection.
   Si une transcription dérape, c'est ici que cela se voit. */
const PRIX_TEMOINS = {
  'magie-noel-sucre-orge': 500, 'magie-noel-joyeux-noel': 700,
  'frissons-halloween-crane': 450, 'frissons-halloween-chauve-souris': 650,
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
  'moto-vroom': 500, 'moto-speed-limit': 600
};

(async () => {
  /* ---------- Le catalogue ---------- */
  await cas('les vingt collections sont là, dans l’ordre', () => {
    assert.deepStrictEqual(Catalogue.COLLECTIONS.map((c) => c.nom), COLLECTIONS_ATTENDUES);
  });

  await cas('chaque collection compte le bon nombre de modèles', () => {
    Catalogue.COLLECTIONS.forEach((c) => {
      assert.strictEqual(c.produits.length, MODELES_ATTENDUS[c.id],
        c.id + ' : ' + c.produits.length + ' modèles');
    });
    assert.strictEqual(Catalogue.ARTICLES.length, 137);
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
      assert.ok(a.prix >= 400 && a.prix <= 800, a.id + ' : prix hors de la fourchette annoncée');
      assert.strictEqual(a.prix % 50, 0, a.id + ' : prix hors du pas de 50 centimes');
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
    Catalogue.ARTICLES.forEach((a) => assert.strictEqual(a.biscuits, 1, a.id));
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
      assert.strictEqual(c.image, 'images/collections/' + c.id + '.webp', c.id);
      assert.ok(c.alt && c.alt.length > 20, c.id + ' : texte alternatif trop court');
      assert.ok(c.description && c.description.length > 60, c.id + ' : description trop courte');
    });
  });

  await cas('le minimum de commande est de douze biscuits', () => {
    assert.strictEqual(Catalogue.MIN_BISCUITS, 12);
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
    assert.strictEqual(Catalogue.ARTICLES.filter((a) => a.categorie !== 'biscuit').length, 0);
  });

  console.log(`\n${vert} test(s) au vert, ${rouge} en échec.`);
  process.exit(rouge === 0 ? 0 : 1);
})();
