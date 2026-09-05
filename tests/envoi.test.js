/* Vérifie la fonction d'envoi sans toucher au serveur SMTP : filtres
   anti-spam, tri des champs, échappement de l'HTML.

   Lancement : npm test
*/
const assert = require('node:assert');
const fonction = require('../netlify/functions/envoyer-message.js');

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
    .handler({ httpMethod: 'POST', body: JSON.stringify(corps), headers: { 'client-ip': '203.0.113.' + Math.floor(Math.random() * 250) } })
    .then((r) => {
      process.env = memoire;
      return { code: r.statusCode, corps: JSON.parse(r.body) };
    })
    .catch((e) => {
      process.env = memoire;
      throw e;
    });
}

const AVEC_SMTP = { SMTP_USER: 'info@jolie-creation.com', SMTP_PASSWORD: 'faux', SMTP_HOST: '127.0.0.1', SMTP_PORT: '1' };
const SANS_SMTP = { SMTP_USER: '', SMTP_PASSWORD: '' };

const DEVIS = {
  prenom: 'Camille', nom: 'Berset', email: 'camille@example.ch',
  'type-evenement': 'Anniversaire', formule: 'Mini Signature — dès 590 CHF',
  message: 'Un décor sur le thème licorne.'
};

(async () => {
  await cas('sans identifiants SMTP, la fonction refuse au lieu de faire semblant', async () => {
    const r = await appeler({ type: 'devis', donnees: DEVIS }, SANS_SMTP);
    assert.strictEqual(r.code, 503);
    assert.strictEqual(r.corps.erreur, 'smtp_non_configure');
  });

  await cas('le pot de miel rempli fait échouer l’envoi en silence', async () => {
    const r = await appeler({ type: 'devis', donnees: DEVIS, piege: 'http://spam' }, AVEC_SMTP);
    assert.strictEqual(r.code, 200);
    assert.strictEqual(r.corps.ok, true, 'le robot doit croire avoir réussi');
  });

  await cas('un formulaire rempli en moins de trois secondes est refusé', async () => {
    const r = await appeler({ type: 'devis', donnees: DEVIS, dureeSaisie: 900 }, AVEC_SMTP);
    assert.strictEqual(r.code, 429);
    assert.strictEqual(r.corps.erreur, 'trop_rapide');
  });

  await cas('un formulaire vide est refusé', async () => {
    const r = await appeler({ type: 'devis', donnees: {} }, AVEC_SMTP);
    assert.strictEqual(r.code, 400);
    assert.strictEqual(r.corps.erreur, 'vide');
  });

  await cas('les envois en rafale depuis la même adresse sont freinés', async () => {
    const memoire = { ...process.env };
    Object.assign(process.env, AVEC_SMTP);
    const entete = { httpMethod: 'POST', headers: { 'client-ip': '198.51.100.7' } };
    let dernier = null;
    for (let i = 0; i < 7; i++) {
      dernier = await fonction.handler({ ...entete, body: JSON.stringify({ type: 'devis', donnees: DEVIS }) });
    }
    process.env = memoire;
    assert.strictEqual(dernier.statusCode, 429);
    assert.strictEqual(JSON.parse(dernier.body).erreur, 'trop_de_demandes');
  });

  await cas('seuls les champs attendus entrent dans l’e-mail', () => {
    const lignes = fonction.construireCorps('devis', {
      prenom: 'Camille',
      message: 'Bonjour',
      'champ-inconnu': 'valeur injectée',
      'form-name': 'commande'
    });
    const cles = lignes.map(([l]) => l);
    assert.deepStrictEqual(cles, ['Prénom', 'Message']);
  });

  await cas('les champs vides ne laissent pas de ligne dans l’e-mail', () => {
    const lignes = fonction.construireCorps('devis', { prenom: 'Camille', nom: '', tel: '   ' });
    assert.strictEqual(lignes.length, 1);
  });

  await cas('l’ordre des champs est celui du catalogue de la fonction', () => {
    const lignes = fonction.construireCorps('devis', { message: 'z', prenom: 'a', email: 'b@c.ch' });
    assert.deepStrictEqual(lignes.map(([l]) => l), ['Prénom', 'E-mail', 'Message']);
  });

  await cas('une commande transporte sa référence et son adresse', () => {
    const lignes = fonction.construireCorps('commande', {
      reference: 'JC-20260905-AB12CD', reception: 'Livraison', total: '183 CHF',
      rue: 'Route du Village', numero: '14b', npa: '1564', ville: 'Fribourg', pays: 'Suisse'
    });
    const cles = lignes.map(([l]) => l);
    ['Référence', 'Réception', 'Total', 'Rue', 'Numéro', 'NPA / Code postal', 'Ville', 'Pays']
      .forEach((c) => assert.ok(cles.includes(c), 'champ manquant : ' + c));
  });

  await cas('le HTML saisi par un client est échappé, pas interprété', () => {
    const html = fonction.versHTML('devis', fonction.construireCorps('devis', {
      prenom: '<script>alert(1)</script>',
      message: 'Bonjour "Julie" & <b>merci</b>'
    }));
    assert.ok(!/<script>/.test(html), 'une balise script a survécu');
    assert.ok(html.includes('&lt;script&gt;'), 'la balise doit apparaître échappée');
    assert.ok(html.includes('&amp;'), 'l’esperluette doit être échappée');
  });

  await cas('le sujet est clair et nommé', () => {
    assert.strictEqual(fonction.SUJETS.devis, 'Nouvelle demande de devis — Jolie Création');
    assert.strictEqual(fonction.SUJETS.commande, 'Nouvelle commande — Jolie Création');
  });

  await cas('les informations reprises depuis une formule sont transmises', () => {
    // Un client venu de /micro-scenographies arrive avec sa formule
    // pré-remplie : elle doit se retrouver dans l'e-mail.
    const lignes = fonction.construireCorps('devis', {
      prenom: 'Camille', formule: 'Mini Signature — dès 590 CHF',
      'type-evenement': 'Anniversaire', 'theme-anniversaire': 'Licorne arc-en-ciel'
    });
    const dico = Object.fromEntries(lignes);
    assert.strictEqual(dico['Formule souhaitée'], 'Mini Signature — dès 590 CHF');
    assert.strictEqual(dico['Thème'], 'Licorne arc-en-ciel');
  });

  await cas('aucun identifiant SMTP n’est écrit dans le dépôt', () => {
    const fs = require('node:fs');
    const source = fs.readFileSync(require.resolve('../netlify/functions/envoyer-message.js'), 'utf8');
    // Les seules occurrences doivent être des lectures d'environnement.
    ['SMTP_USER', 'SMTP_PASSWORD', 'SMTP_HOST', 'SMTP_PORT'].forEach((nom) => {
      const occurrences = source.split(nom).length - 1;
      const viaEnv = source.split('process.env.' + nom).length - 1;
      assert.strictEqual(occurrences, viaEnv, nom + ' apparaît ailleurs que dans process.env');
    });
  });

  console.log(`\n${vert} test(s) au vert, ${rouge} en échec.`);
  process.exit(rouge === 0 ? 0 : 1);
})();
