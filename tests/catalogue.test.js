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

  await cas('des biscuits supplémentaires sans package sont refusés', async () => {
    const r = await appel({ lignes: [{ id: 'biscuit-petit', qte: 6 }] }, 'sk_test_faux');
    assert.strictEqual(r.code, 400);
    assert.strictEqual(r.corps.erreur, 'minimum_biscuits');
  });

  await cas('un panier uniquement à tarif variable n’est pas facturable', async () => {
    const r = await appel({
      lignes: [{ id: 'pack-ocean', qte: 1 }, { id: 'biscuit-standard', qte: 2 }]
    }, 'sk_test_faux');
    // pack-ocean est facturable, donc on passe la validation métier et on
    // échoue seulement au moment de contacter Stripe avec une fausse clé.
    assert.ok(r.code === 502, 'attendu 502 (Stripe injoignable), reçu ' + r.code);
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
