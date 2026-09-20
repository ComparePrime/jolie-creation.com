// Lance les suites de vérification au navigateur.
//
//   npm run test:navigateur              toutes les suites, 1280 et 390 px
//   npm run test:navigateur -- panier    celles dont le nom contient « panier »
//   npm run test:navigateur -- --largeur 390
//
// Le serveur est monté ici, sur un port libre, et redescendu à la fin :
// une suite n'a jamais à savoir où le site est servi.
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { demarrer } = require('./serveur-statique.js');

const ICI = __dirname;
const RACINE = path.resolve(ICI, '..', '..');
const INTERNES = ['lancer.js', 'socle.js', 'serveur-statique.js'];

function suites(filtre) {
  return fs.readdirSync(ICI)
    .filter((f) => f.endsWith('.js') && !INTERNES.includes(f))
    .map((f) => f.replace(/\.js$/, ''))
    .filter((n) => !filtre.length || filtre.some((m) => n.includes(m)))
    .sort();
}

function lancer(suite, largeur, base) {
  return new Promise((resoudre) => {
    const enfant = spawn(process.execPath, [path.join(ICI, suite + '.js'), String(largeur)], {
      cwd: RACINE,
      env: Object.assign({}, process.env, { JC_BASE: base })
    });
    let sortie = '';
    enfant.stdout.on('data', (d) => { sortie += d; });
    enfant.stderr.on('data', (d) => { sortie += d; });
    enfant.on('close', (code) => {
      const bilan = (sortie.match(/^\d+ au vert.*$/m) || [])[0];
      resoudre({ suite, largeur, code, bilan, sortie });
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  let largeurs = [1280, 390];
  const i = args.indexOf('--largeur');
  if (i !== -1) { largeurs = [parseInt(args[i + 1], 10)]; args.splice(i, 2); }

  const liste = suites(args);
  if (!liste.length) {
    // Aucune suite posée ici : ce n'est pas une erreur tant que le
    // dossier attend les siennes. Un filtre qui ne trouve rien, si.
    if (args.length) { console.error('Aucune suite ne correspond à ' + args.join(' ')); process.exit(1); }
    console.log('Aucune suite dans tests/navigateur/ pour l’instant.');
    return;
  }

  const serveur = await demarrer(RACINE, 0);
  const base = 'http://127.0.0.1:' + serveur.port;
  console.log(`Site servi sur ${base} — ${liste.length} suite(s), ${largeurs.join(' et ')} px\n`);

  const echecs = [];
  for (const largeur of largeurs) {
    console.log(`--- ${largeur} px`);
    for (const suite of liste) {
      const r = await lancer(suite, largeur, base);
      const etat = r.bilan || (r.code === 0 ? 'terminée' : 'ÉCHEC — ' + r.sortie.trim().split('\n').pop());
      console.log(`  ${suite.padEnd(20)} ${etat}`);
      if (r.code !== 0) echecs.push(r);
    }
  }
  await serveur.arreter();

  if (!echecs.length) { console.log('\nTout est au vert.'); return; }
  console.log(`\n${echecs.length} suite(s) en échec :\n`);
  for (const r of echecs) {
    console.log(`=== ${r.suite} (${r.largeur}px)`);
    r.sortie.split('\n').filter((l) => l.startsWith('NON')).forEach((l) => console.log('  ' + l));
  }
  process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
