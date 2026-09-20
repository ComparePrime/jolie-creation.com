// Socle commun aux suites de vérification au navigateur.
//
// Les suites ne connaissent ni le chemin de Chromium ni l'adresse du
// serveur : ces deux-là changent d'une machine à l'autre, et c'est le
// seul endroit où ils sont décidés.
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const RACINE = path.resolve(__dirname, '..', '..');

// L'adresse du site à vérifier. Le lanceur la pose ; on peut aussi la
// donner à la main pour viser un autre serveur.
const BASE = (process.env.JC_BASE || 'http://127.0.0.1:8080').replace(/\/$/, '');

/* Chromium. Playwright sait normalement le trouver seul. Dans un
   environnement qui l'a installé ailleurs — une image de CI, un
   conteneur — JC_CHROME ou PLAYWRIGHT_BROWSERS_PATH l'indiquent, et on
   retombe sur la résolution par défaut si rien ne colle. */
function executable() {
  if (process.env.JC_CHROME) return process.env.JC_CHROME;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!base || !fs.existsSync(base)) return undefined;
  const candidats = fs.readdirSync(base)
    .filter((d) => d.startsWith('chromium-'))
    .sort()
    .reverse()
    .map((d) => path.join(base, d, 'chrome-linux', 'chrome'));
  return candidats.find((c) => fs.existsSync(c));
}

async function ouvrir(options) {
  const chemin = executable();
  return chromium.launch(Object.assign({}, options, chemin ? { executablePath: chemin } : {}));
}

/* La largeur passée en argument : 1280 par défaut, 390 pour le mobile. */
function largeur() { return parseInt(process.argv[2] || '1280', 10); }

/* Le catalogue, relu depuis le dépôt : les suites comparent ce que la
   page montre à ce que la source unique déclare. */
const Catalogue = require(path.join(RACINE, 'catalogue.js'));

/* Un compteur de contrôles, identique d'une suite à l'autre. */
function compteur() {
  let verts = 0, rouges = 0;
  const ok = (nom, condition, detail) => {
    if (condition) { verts++; console.log('OK  ' + nom + (detail ? '  — ' + detail : '')); }
    else { rouges++; console.log('NON ' + nom + (detail ? '  — ' + detail : '')); }
  };
  ok.bilan = (l) => {
    console.log(`\n${verts} au vert, ${rouges} en échec  (${l}px)`);
    return rouges;
  };
  return ok;
}

module.exports = { BASE, RACINE, ouvrir, largeur, Catalogue, compteur };
