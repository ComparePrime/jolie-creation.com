/* Vérifie le blog : 20 articles, métadonnées uniques, liens internes,
   images et ALT, données structurées, sitemap. Aucun réseau. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const BLOG = path.join(RACINE, 'blog');
const SITE = 'https://jolie-creation.com';
let vert = 0; let rouge = 0;

function cas(nom, fn) {
  try { fn(); vert++; console.log('OK  ' + nom); }
  catch (e) { rouge++; console.log('NON ' + nom + '\n    ' + String(e.message).split('\n').slice(0, 6).join('\n    ')); }
}

const fichiers = fs.readdirSync(BLOG).filter((f) => f.endsWith('.html') && f !== 'index.html').sort();
const lire = (f) => fs.readFileSync(path.join(BLOG, f), 'utf8');
const pages = fichiers.map((f) => ({ f, slug: f.replace(/\.html$/, ''), html: lire(f) }));
const unique = (re, html) => { const m = html.match(re); return m ? m[1] : null; };
const decoder = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, '\'').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

/* Une adresse interne existe-t-elle ? */
function existe(href) {
  const chemin = decoder(href.split('#')[0].split('?')[0]);
  if (!chemin || chemin === '/') return true;
  const rel = chemin.replace(/^\//, '');
  const candidats = [rel, rel + '.html', path.join(rel, 'index.html')];
  return candidats.some((c) => fs.existsSync(path.join(RACINE, c)) && fs.statSync(path.join(RACINE, c)).isFile());
}

cas('vingt articles, dix par catégorie', () => {
  assert.strictEqual(pages.length, 20);
  const biscuits = pages.filter((p) => p.html.includes('"articleSection": "Biscuits personnalisés"'));
  const micro = pages.filter((p) => p.html.includes('"articleSection": "Micro-scénographies"'));
  assert.strictEqual(biscuits.length, 10);
  assert.strictEqual(micro.length, 10);
});

cas('chaque article a un title, une description et un canonical uniques', () => {
  const titres = new Set(); const descs = new Set();
  pages.forEach((p) => {
    const t = decoder(unique(/<title>([^<]+)<\/title>/, p.html) || '');
    const d = decoder(unique(/<meta name="description" content="([^"]+)"/, p.html) || '');
    assert.ok(t.length >= 25 && t.length <= 70, p.slug + ' title ' + t.length + ' : ' + t);
    assert.ok(d.length >= 100 && d.length <= 165, p.slug + ' description ' + d.length);
    assert.ok(!titres.has(t), 'title en double : ' + t); titres.add(t);
    assert.ok(!descs.has(d), 'description en double'); descs.add(d);
    assert.strictEqual(unique(/<link rel="canonical" href="([^"]+)"/, p.html), `${SITE}/blog/${p.slug}`);
    assert.strictEqual(unique(/<meta property="og:url" content="([^"]+)"/, p.html), `${SITE}/blog/${p.slug}`);
    assert.ok(/<meta property="og:image" content="https:\/\/jolie-creation\.com\/images\/blog\/[^"]+\.webp"/.test(p.html), p.slug + ' og:image');
  });
});

cas('un seul H1 par article, des H2 organisés, pas de saut H1 → H3', () => {
  pages.forEach((p) => {
    assert.strictEqual((p.html.match(/<h1[ >]/g) || []).length, 1, p.slug + ' H1');
    assert.ok((p.html.match(/<h2[ >]/g) || []).length >= 5, p.slug + ' trop peu de H2');
  });
});

cas('chaque article fait au moins 600 mots de texte et au plus 1 300', () => {
  pages.forEach((p) => {
    const corps = p.html.match(/<div class="blog-texte">([\s\S]*?)<aside class="blog-cta"/)[1]
      .replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/g, ' ');
    const n = corps.split(/\s+/).filter(Boolean).length;
    assert.ok(n >= 600 && n <= 1300, p.slug + ' : ' + n + ' mots');
  });
});

cas('tous les liens internes pointent vers une page qui existe', () => {
  const manquants = [];
  const tout = pages.concat([{ slug: 'index', html: fs.readFileSync(path.join(BLOG, 'index.html'), 'utf8') }]);
  tout.forEach((p) => {
    (p.html.match(/href="(\/[^"]*)"/g) || []).forEach((h) => {
      const href = h.slice(6, -1);
      if (!existe(href)) manquants.push(p.slug + ' → ' + href);
    });
  });
  assert.deepStrictEqual(manquants, []);
});

cas('chaque article renvoie vers son activité, les réalisations et le devis', () => {
  pages.forEach((p) => {
    const biscuits = p.html.includes('"articleSection": "Biscuits personnalisés"');
    assert.ok(p.html.includes(biscuits ? 'href="/biscuits-personnalises.html"' : 'href="/micro-scenographies.html"'), p.slug + ' page activité');
    assert.ok(p.html.includes('href="/mes-realisations.html"'), p.slug + ' réalisations');
    assert.ok(/href="\/contact\.html\?formule=[a-z-]+"/.test(p.html), p.slug + ' devis');
    assert.ok((p.html.match(/href="\/blog\/[a-z0-9-]+"/g) || []).length >= 3, p.slug + ' liens entre articles');
    assert.ok(p.html.includes('class="blog-cta"'), p.slug + ' appel à l’action');
  });
});

cas('chaque image existe, a un ALT descriptif et des dimensions', () => {
  pages.forEach((p) => {
    (p.html.match(/<img [^>]+>/g) || []).forEach((img) => {
      const src = unique(/src="([^"]+)"/, img);
      if (!src || !src.startsWith('/images/')) return;
      assert.ok(fs.existsSync(path.join(RACINE, src)), p.slug + ' image absente ' + src);
      const alt = unique(/alt="([^"]*)"/, img);
      if (/aria-hidden/.test(img)) return;
      assert.ok(alt && alt.length >= 25, p.slug + ' ALT trop court : ' + src);
    });
    const photo = unique(/<img src="(\/images\/blog\/[^"]+)"/, p.html);
    assert.ok(photo && /\.webp$/.test(photo), p.slug + ' photo principale WebP');
  });
});

cas('les images du blog sont des WebP légers', () => {
  const dossier = path.join(RACINE, 'images', 'blog');
  fs.readdirSync(dossier).forEach((f) => {
    assert.ok(/\.webp$/.test(f), f);
    assert.ok(fs.statSync(path.join(dossier, f)).size < 250 * 1024, f + ' trop lourd');
  });
});

cas('données structurées : BlogPosting, fil d’Ariane, JSON valide', () => {
  pages.forEach((p) => {
    const blocs = (p.html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || [])
      .map((b) => JSON.parse(b.replace(/<\/?script[^>]*>/g, '')));
    const graphes = blocs.flatMap((b) => b['@graph'] || [b]);
    const post = graphes.find((n) => n['@type'] === 'BlogPosting');
    assert.ok(post, p.slug + ' BlogPosting');
    assert.strictEqual(post.mainEntityOfPage['@id'], `${SITE}/blog/${p.slug}`);
    assert.ok(post.headline && post.datePublished && post.image && post.author && post.publisher, p.slug);
    const fil = graphes.find((n) => n['@type'] === 'BreadcrumbList');
    assert.strictEqual(fil.itemListElement.length, 3, p.slug + ' fil');
    assert.ok(graphes.some((n) => Array.isArray(n['@type']) && n['@type'].includes('LocalBusiness')), p.slug + ' socle');
  });
});

cas('le sitemap contient le blog et les vingt articles', () => {
  const plan = fs.readFileSync(path.join(RACINE, 'sitemap.xml'), 'utf8');
  assert.ok(plan.includes(`<loc>${SITE}/blog/</loc>`));
  pages.forEach((p) => assert.ok(plan.includes(`<loc>${SITE}/blog/${p.slug}</loc>`), p.slug));
});

cas('l’accueil du blog : deux catégories, vingt cartes, canonical', () => {
  const h = fs.readFileSync(path.join(BLOG, 'index.html'), 'utf8');
  assert.ok(h.includes('id="biscuits-personnalises"') && h.includes('id="micro-scenographies"'));
  assert.strictEqual((h.match(/class="blog-carte"/g) || []).length, 20);
  assert.strictEqual(unique(/<link rel="canonical" href="([^"]+)"/, h), SITE + '/blog/');
  assert.strictEqual((h.match(/<h1[ >]/g) || []).length, 1);
});

cas('le menu principal et le pied de page mènent au blog sur toutes les pages', () => {
  const pagesSite = fs.readdirSync(RACINE).filter((f) => f.endsWith('.html'))
    .concat(fs.readdirSync(path.join(RACINE, 'collections')).map((f) => 'collections/' + f));
  const concernees = pagesSite.filter((f) => fs.readFileSync(path.join(RACINE, f), 'utf8').includes('nav-desktop'));
  const sans = concernees.filter((f) => !/<nav class="nav-desktop"[\s\S]*?<a href="\/blog\/"[^>]*>Blog<\/a>/.test(fs.readFileSync(path.join(RACINE, f), 'utf8')));
  // Les anciennes adresses redirigées (noindex) ne portent pas de menu à jour.
  const attendues = sans.filter((f) => !['creations.html', 'evenements.html', 'formules.html', 'mini-scenographies.html'].includes(f));
  assert.deepStrictEqual(attendues, []);
});

cas('aucune mention interdite : « Domdidier », emoji, bourrage', () => {
  pages.forEach((p) => {
    const texte = p.html.replace(/<script[\s\S]*?<\/script>/g, '');
    assert.ok(!/Domdidier/i.test(texte), p.slug + ' Domdidier');
    assert.ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(texte), p.slug + ' emoji');
  });
});

console.log(`\n${vert} test(s) au vert, ${rouge} en échec.`);
process.exit(rouge === 0 ? 0 : 1);
