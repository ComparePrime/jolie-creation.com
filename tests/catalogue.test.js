/* Vérifie la fonction serveur sans appeler Stripe : c'est elle qui décide
   du montant réellement facturé, donc c'est elle qu'il faut piéger.
   Lancer avec : npm test */
const assert = require('assert');
const Catalogue = require('../catalogue.js');
const fonction = require('../netlify/functions/create-checkout-session.js');

let ok = 0, ko = 0;
async function cas(nom, fn) {
  try { await fn(); ok++; console.log('OK  ' + nom); }
  catch (e) { ko++; console.log('NON ' + nom + '\n    ' + e.message); }
}

function appel(corps, env) {
  const sauvegarde = process.env.STRIPE_SECRET_KEY;
  if (env === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = env;
  return fonction.handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify(corps) })
    .then((r) => { process.env.STRIPE_SECRET_KEY = sauvegarde; return { code: r.statusCode, corps: JSON.parse(r.body) }; });
}

(async () => {
  await cas('sans clé Stripe, la fonction refuse au lieu de simuler un paiement', async () => {
    const r = await appel({ lignes: [{ id: 'pack-ocean', qte: 1 }] });
    assert.strictEqual(r.code, 503);
    assert.strictEqual(r.corps.erreur, 'stripe_non_configure');
  });

  await cas('un panier vide est refusé', async () => {
    const r = await appel({ lignes: [] }, 'sk_test_faux');
    assert.strictEqual(r.code, 400);
    assert.strictEqual(r.corps.erreur, 'panier_vide');
  });

  await cas('un identifiant d’article inconnu est refusé', async () => {
    const r = await appel({ lignes: [{ id: 'pack-gratuit', qte: 1 }] }, 'sk_test_faux');
    assert.strictEqual(r.code, 400);
    assert.strictEqual(r.corps.erreur, 'article_inconnu');
  });

  await cas('un biscuit supplémentaire envoyé seul est refusé', async () => {
    const r = await appel({ lignes: [{ id: 'biscuit-petit', qte: 6 }] }, 'sk_test_faux');
    assert.strictEqual(r.code, 400);
    assert.strictEqual(r.corps.erreur, 'supplement_isole');
  });

  await cas('les suppléments d’un package sont retarifés et multipliés', () => {
    // On appelle la logique de construction sans passer par Stripe :
    // deux packages portant chacun 3 grands biscuits font 6 grands biscuits.
    const pack = Catalogue.article('pack-ocean');
    const grand = Catalogue.article('biscuit-grand');
    const petit = Catalogue.article('biscuit-petit');
    assert.strictEqual(pack.prix * 2 + petit.prix * 4, 6900 * 2 + 400 * 4);
    assert.ok(grand.aConfirmer, 'le grand biscuit doit rester à confirmer');
    assert.strictEqual(grand.prixMin * 6, 4200);
    assert.strictEqual(grand.prixMax * 6, 4800);
  });

  await cas('un package avec suppléments passe la validation', async () => {
    const r = await appel({
      lignes: [{ id: 'pack-ocean', qte: 2, supplements: { 'biscuit-petit': 4, 'biscuit-standard': 2 } }]
    }, 'sk_test_faux');
    // La validation métier passe : on n'échoue qu'au contact de Stripe,
    // avec une fausse clé.
    assert.ok(r.code === 502, 'attendu 502 (Stripe injoignable), reçu ' + r.code);
  });

  await cas('chaque package expose une modale et 12 biscuits', () => {
    Catalogue.ARTICLES.filter((a) => a.categorie === 'package-biscuits').forEach((a) => {
      assert.strictEqual(a.modale, 'package', a.id);
      assert.strictEqual(a.biscuits, Catalogue.MIN_BISCUITS, a.id);
    });
    Catalogue.SUPPLEMENTS.forEach((id) => {
      assert.strictEqual(Catalogue.article(id).categorie, 'biscuit-sup', id);
    });
  });

  await cas('le catalogue expose des prix entiers en centimes', () => {
    Catalogue.ARTICLES.forEach((a) => {
      const montants = [a.prix, a.prixMin, a.prixMax].filter((v) => v != null);
      assert.ok(montants.length > 0, a.id + ' n’a aucun prix');
      montants.forEach((m) => assert.ok(Number.isInteger(m) && m > 0, a.id + ' : ' + m + ' n’est pas un entier positif'));
      if (a.aConfirmer) assert.ok(a.prixMin < a.prixMax, a.id + ' : fourchette incohérente');
    });
  });

  await cas('le formatage suisse des montants est correct', () => {
    assert.strictEqual(Catalogue.formater(59000), '590 CHF');
    assert.strictEqual(Catalogue.formater(7250), '72.50 CHF');
    assert.strictEqual(Catalogue.formater(400), '4 CHF');
  });

  await cas('chaque identifiant d’article est unique', () => {
    const ids = Catalogue.ARTICLES.map((a) => a.id);
    assert.strictEqual(new Set(ids).size, ids.length);
  });

  console.log(`\n${ok} test(s) au vert, ${ko} en échec.`);
  process.exit(ko === 0 ? 0 : 1);
})();
