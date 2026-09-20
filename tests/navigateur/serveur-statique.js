// Un serveur de fichiers minimal, le temps d'une vérification.
//
// Le site est statique : le servir ne demande ni dépendance ni
// configuration. Trente lignes ici valent mieux qu'un paquet de plus
// dans package.json, d'autant que les fonctions serverless ne sont pas
// sollicitées par les suites — elles ont leurs propres tests.
const http = require('http');
const fs = require('fs');
const path = require('path');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8'
};

function demarrer(racine, port) {
  const serveur = http.createServer((req, res) => {
    let rel = decodeURIComponent(req.url.split('?')[0]);
    if (rel.endsWith('/')) rel += 'index.html';
    // Un chemin ne sort pas de la racine, quoi qu'il demande.
    const fichier = path.join(racine, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
    if (!fichier.startsWith(racine)) { res.writeHead(403).end(); return; }
    fs.readFile(fichier, (err, corps) => {
      if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('404'); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(fichier).toLowerCase()] || 'application/octet-stream' });
      res.end(corps);
    });
  });
  return new Promise((resoudre, rejeter) => {
    serveur.on('error', rejeter);
    serveur.listen(port, '127.0.0.1', () => resoudre({
      port: serveur.address().port,
      arreter: () => new Promise((r) => serveur.close(r))
    }));
  });
}

module.exports = { demarrer };
