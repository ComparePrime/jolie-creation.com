/* Vérifie la fonction serveur sans appeler SumUp : c'est elle qui décide
   du montant réellement débité, elle mérite d'être testée sans dépendre
   du réseau ni d'un compte marchand.

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

(async () => {
  await cas('sans clés SumUp, la fonction refuse au lieu de simuler un paiement', async () => {
    const r = await appeler({ lignes: [{ id: 'pack-ocean', qte: 1 }] },
      { SUMUP_API_KEY: '', SUMUP_MERCHANT_CODE: '' });
    assert.strictEqual(r.code, 503);
    assert.strictEqual(r.corps.erreur, 'sumup_non_configure');
  });

  await cas('un panier vide est refusé', async () => {
    const r = await appeler({ lignes: [] }, AVEC_CLES);
    assert.strictEqual(r.code, 400);
    assert.strictEqual(r.corps.erreur, 'panier_vide');
  });

  await cas('un identifiant d’article inconnu est refusé', async () => {
    const r = await appeler({ lignes: [{ id: 'pack-inexistant', qte: 1 }] }, AVEC_CLES);
    assert.strictEqual(r.code, 400);
    assert.strictEqual(r.corps.erreur, 'article_inconnu');
  });

  await cas('un biscuit supplémentaire envoyé seul est refusé', async () => {
    const r = await appeler({ lignes: [{ id: 'biscuit-grand', qte: 40 }] }, AVEC_CLES);
    assert.strictEqual(r.code, 400);
    assert.strictEqual(r.corps.erreur, 'supplement_isole');
  });

  await cas('une commande à retirer ne passe pas par le paiement en ligne', async () => {
    const r = await appeler({
      lignes: [{ id: 'pack-ocean', qte: 1 }],
      client: { reception: 'retrait' }
    }, AVEC_CLES);
    assert.strictEqual(r.code, 400);
    assert.strictEqual(r.corps.erreur, 'retrait_sans_paiement');
  });

  await cas('la validation métier passe avant l’appel réseau', async () => {
    // La clé est bidon : on n'échoue donc qu'au contact de SumUp, ce qui
    // prouve que tout le reste a été accepté.
    const r = await appeler({
      lignes: [{ id: 'pack-ocean', qte: 1, supplements: { 'biscuit-standard': 3 } }],
      client: { reception: 'livraison' }
    }, AVEC_CLES);
    assert.ok(r.code === 502, 'attendu 502 (SumUp injoignable), reçu ' + r.code);
  });

  await cas('chaque package et chaque collection expose une modale et des biscuits', () => {
    Catalogue.ARTICLES
      .filter((a) => a.categorie === 'package-biscuits')
      .forEach((a) => {
        assert.strictEqual(a.modale, 'package', a.id + ' : modale manquante');
        assert.ok(a.biscuits >= Catalogue.MIN_BISCUITS, a.id + ' : moins de 12 biscuits');
      });
  });

  await cas('chaque collection existe en 12, 18 et 24 biscuits', () => {
    const parCollection = {};
    Catalogue.ARTICLES.filter((a) => a.collection).forEach((a) => {
      (parCollection[a.collection] = parCollection[a.collection] || []).push(a.biscuits);
    });
    const noms = Object.keys(parCollection);
    assert.ok(noms.length >= 1, 'aucune collection au catalogue');
    noms.forEach((nom) => {
      assert.deepStrictEqual(parCollection[nom].sort((x, y) => x - y), [12, 18, 24],
        nom + ' : formats attendus 12/18/24');
    });
  });

  await cas('tous les tarifs sont fixes et entiers en centimes', () => {
    Catalogue.ARTICLES.forEach((a) => {
      assert.ok(Number.isInteger(a.prix) && a.prix > 0, a.id + ' : prix invalide');
      assert.strictEqual(a.prixMin, undefined, a.id + ' : fourchette résiduelle');
      assert.strictEqual(a.aConfirmer, undefined, a.id + ' : tarif encore à confirmer');
    });
  });

  await cas('les biscuits supplémentaires sont aux nouveaux tarifs', () => {
    const attendu = { 'biscuit-petit': 450, 'biscuit-standard': 550, 'biscuit-grand': 750 };
    Object.keys(attendu).forEach((id) => {
      assert.strictEqual(Catalogue.article(id).prix, attendu[id], id + ' : tarif inattendu');
    });
  });

  await cas('la conversion en unités majeures ne perd pas de centimes', () => {
    assert.strictEqual(Catalogue.enFrancs(7250), 72.5);
    assert.strictEqual(Catalogue.enFrancs(6900), 69);
    assert.strictEqual(Catalogue.enFrancs(450), 4.5);
    assert.strictEqual(Catalogue.enFrancs(12345), 123.45);
  });

  await cas('le formatage suisse des montants est correct', () => {
    assert.strictEqual(Catalogue.formater(39000), '390 CHF');
    assert.strictEqual(Catalogue.formater(7250), '72.50 CHF');
    assert.strictEqual(Catalogue.formater(450), '4.50 CHF');
  });

  await cas('aucune micro-scénographie ne s’achète en ligne', () => {
    const sceno = Catalogue.ARTICLES.filter((a) => a.categorie === 'scenographie');
    assert.strictEqual(sceno.length, 0, 'les scénographies passent par le devis');
  });

  await cas('chaque identifiant d’article est unique', () => {
    const vus = new Set();
    Catalogue.ARTICLES.forEach((a) => {
      assert.ok(!vus.has(a.id), 'identifiant en double : ' + a.id);
      vus.add(a.id);
    });
  });

  console.log(`\n${vert} test(s) au vert, ${rouge} en échec.`);

  // Les prix des collections sont encore des valeurs d'attente : le
  // rappeler à chaque exécution vaut mieux qu'un commentaire qu'on
  // finit par ne plus voir.
  if (Catalogue.PRIX_COLLECTIONS_PROVISOIRES) {
    console.log('\nRAPPEL : les tarifs des collections du moment sont provisoires.');
    console.log('Les remplacer dans catalogue.js (PRIX_COLLECTION) avant d’ouvrir la boutique.');
  }

  process.exit(rouge === 0 ? 0 : 1);
})();
