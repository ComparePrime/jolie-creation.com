/* ============================================================
   Envoi des demandes de devis et des commandes par e-mail
   ------------------------------------------------------------
   Formulaire -> cette fonction -> Nodemailer -> SMTP Infomaniak
   -> info@jolie-creation.com

   Les identifiants SMTP n'existent QUE ici, côté serveur, lus dans
   les variables d'environnement. Ils ne sont jamais envoyés au
   navigateur ni écrits dans le dépôt.

   Le navigateur envoie des champs libres : rien de ce qu'il envoie
   n'est repris tel quel. Chaque type de message a sa liste de
   champs attendus, avec son libellé ; tout le reste est ignoré, et
   ce qui passe est tronqué puis échappé avant d'entrer dans l'HTML
   de l'e-mail. Un champ inconnu ne peut donc pas s'y glisser.
   ============================================================ */
const nodemailer = require('nodemailer');

const DESTINATAIRE = 'info@jolie-creation.com';
const MAX_CHAMP = 2000;
const MAX_MESSAGE = 5000;
/* Netlify accepte 6 Mo de charge utile ; la pièce jointe voyage en
   base64, qui pèse un tiers de plus que le fichier d'origine. */
const MAX_PIECE_JOINTE = 3 * 1024 * 1024;

const entetes = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store'
};

function reponse(code, corps) {
  return { statusCode: code, headers: entetes, body: JSON.stringify(corps) };
}

/* ------------------------------------------------------------
   Champs attendus, par type de message.
   L'ordre est celui de l'e-mail reçu. Ajouter un champ au
   formulaire demande de l'ajouter ici, sans quoi il n'est pas
   transmis : c'est volontaire, une liste ouverte laisserait
   n'importe quoi entrer dans le courrier.
   ------------------------------------------------------------ */
const CHAMPS = {
  devis: [
    ['prenom', 'Prénom'],
    ['nom', 'Nom'],
    ['email', 'E-mail'],
    ['tel', 'Téléphone'],
    ['formule', 'Formule souhaitée'],
    ['type-evenement', "Type d'événement"],
    ['theme-anniversaire', 'Thème'],
    ['date-evenement', "Date de l'événement"],
    ['quantite', 'Quantité souhaitée'],
    ['reception-mode', 'Livraison ou retrait'],
    ['pays-livraison', 'Pays de livraison'],
    ['mondial-relay-manual', 'Point relais souhaité'],
    ['message', 'Message']
  ],
  commande: [
    ['reference', 'Référence'],
    ['reception', 'Réception'],
    ['paiement', 'Paiement'],
    ['total', 'Total'],
    ['articles', 'Articles'],
    ['prenom', 'Prénom'],
    ['nom', 'Nom'],
    ['email', 'E-mail'],
    ['telephone', 'Téléphone'],
    ['rue', 'Rue'],
    ['numero', 'Numéro'],
    ['npa', 'NPA / Code postal'],
    ['ville', 'Ville'],
    ['pays', 'Pays'],
    ['message', 'Précisions']
  ]
};

const SUJETS = {
  devis: 'Nouvelle demande de devis — Jolie Création',
  commande: 'Nouvelle commande — Jolie Création'
};

function texte(valeur, max) {
  if (typeof valeur !== 'string') return '';
  return valeur.replace(/\r\n/g, '\n').trim().slice(0, max || MAX_CHAMP);
}

function echapper(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ------------------------------------------------------------
   Anti-spam
   ------------------------------------------------------------
   Trois filtres simples, du plus fiable au moins fiable :

   1. Le pot de miel. Un champ invisible que seul un robot remplit.
      C'est le filtre qui attrape le plus, pour le moins de gêne.
   2. Le délai de saisie. Un formulaire soumis en moins de trois
      secondes n'a pas été rempli à la main.
   3. La limite par adresse IP. Elle vit en mémoire, donc dans un
      seul conteneur : deux envois peuvent tomber sur deux
      conteneurs différents et y échapper. C'est un garde-fou
      contre l'envoi en rafale, pas une protection sérieuse. Le
      jour où le spam devient un vrai problème, c'est un service
      dédié qu'il faudra brancher, pas ce compteur.
   ------------------------------------------------------------ */
const DELAI_MINIMUM_MS = 3000;
const FENETRE_MS = 10 * 60 * 1000;
const MAX_PAR_FENETRE = 5;
const memoire = new Map();

function tropDEnvois(ip) {
  if (!ip) return false;
  const maintenant = Date.now();
  const passages = (memoire.get(ip) || []).filter((t) => maintenant - t < FENETRE_MS);
  passages.push(maintenant);
  memoire.set(ip, passages);
  // La mémoire d'un conteneur tiède ne doit pas grossir indéfiniment.
  if (memoire.size > 500) {
    for (const [cle, valeurs] of memoire) {
      if (!valeurs.length || maintenant - valeurs[valeurs.length - 1] > FENETRE_MS) memoire.delete(cle);
    }
  }
  return passages.length > MAX_PAR_FENETRE;
}

/* ------------------------------------------------------------
   Corps du message
   ------------------------------------------------------------ */
function construireCorps(type, donnees) {
  const lignes = [];
  CHAMPS[type].forEach(([cle, libelle]) => {
    const v = texte(donnees[cle], cle === 'message' || cle === 'articles' ? MAX_MESSAGE : MAX_CHAMP);
    if (v) lignes.push([libelle, v]);
  });
  return lignes;
}

function versTexte(lignes) {
  return lignes.map(([l, v]) => l + ' : ' + v).join('\n');
}

function versHTML(type, lignes) {
  const rangs = lignes.map(([l, v]) => `
    <tr>
      <th style="text-align:left;vertical-align:top;padding:9px 16px 9px 0;color:#6B5A48;font-weight:500;white-space:nowrap;">${echapper(l)}</th>
      <td style="padding:9px 0;color:#3A2C1E;white-space:pre-wrap;">${echapper(v)}</td>
    </tr>`).join('');
  return `<!doctype html><html lang="fr"><body style="margin:0;padding:24px;background:#FCF1EB;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:640px;margin:0 auto;background:#FFFDF9;border:1px solid #EADFD5;border-radius:16px;padding:26px 28px;">
    <p style="margin:0 0 4px;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#A98545;">Jolie Création</p>
    <h1 style="margin:0 0 20px;font-size:21px;color:#3A2C1E;">${echapper(SUJETS[type])}</h1>
    <table style="width:100%;border-collapse:collapse;font-size:15px;line-height:1.55;">${rangs}</table>
  </div>
</body></html>`;
}

/* Pièce jointe éventuelle : une image d'inspiration, envoyée en base64
   par le navigateur. On refuse tout ce qui n'est pas une image. */
function pieceJointe(fichier) {
  if (!fichier || typeof fichier !== 'object') return null;
  const nom = texte(fichier.nom, 120).replace(/[^\w.\- ]+/g, '_');
  const contenu = typeof fichier.contenu === 'string' ? fichier.contenu : '';
  const type = texte(fichier.type, 80);
  if (!nom || !contenu || !/^image\/(jpeg|png|gif|webp|heic|heif)$/i.test(type)) return null;
  if (contenu.length > MAX_PIECE_JOINTE * 1.4) return null;
  return { filename: nom, content: Buffer.from(contenu, 'base64'), contentType: type };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return reponse(405, { erreur: 'methode', message: 'Méthode non autorisée.' });
  }

  let charge;
  try {
    charge = JSON.parse(event.body || '{}');
  } catch (e) {
    return reponse(400, { erreur: 'json', message: 'Requête illisible.' });
  }

  const type = charge.type === 'commande' ? 'commande' : 'devis';
  const donnees = (charge.donnees && typeof charge.donnees === 'object') ? charge.donnees : {};

  /* Pot de miel : on répond « envoyé » sans rien envoyer. Un robot qui
     reçoit une erreur réessaie ; un robot qui croit avoir réussi passe
     à autre chose. */
  if (texte(charge.piege, 200)) return reponse(200, { ok: true });

  const ouvertureMs = Number(charge.dureeSaisie);
  if (Number.isFinite(ouvertureMs) && ouvertureMs >= 0 && ouvertureMs < DELAI_MINIMUM_MS) {
    return reponse(429, {
      erreur: 'trop_rapide',
      message: 'Le formulaire a été envoyé trop vite. Réessayez dans quelques secondes.'
    });
  }

  const ip = (event.headers && (event.headers['x-nf-client-connection-ip'] || event.headers['client-ip'] ||
    (event.headers['x-forwarded-for'] || '').split(',')[0].trim())) || '';
  if (tropDEnvois(ip)) {
    return reponse(429, {
      erreur: 'trop_de_demandes',
      message: 'Trop de demandes envoyées coup sur coup. Réessayez dans quelques minutes, ou écrivez-moi directement.'
    });
  }

  const lignes = construireCorps(type, donnees);
  if (!lignes.length) {
    return reponse(400, { erreur: 'vide', message: 'Le formulaire est vide.' });
  }

  const utilisateur = process.env.SMTP_USER;
  const motDePasse = process.env.SMTP_PASSWORD;
  if (!utilisateur || !motDePasse) {
    // Pas de compte configuré : on le dit franchement plutôt que
    // d'afficher un « merci » pour un message que personne ne recevra.
    return reponse(503, {
      erreur: 'smtp_non_configure',
      message: 'L’envoi automatique n’est pas encore activé sur ce site.'
    });
  }

  const port = parseInt(process.env.SMTP_PORT, 10) || 465;
  const transporteur = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'mail.infomaniak.com',
    port: port,
    secure: port === 465,   // 465 chiffre d'emblée, 587 passe par STARTTLS
    auth: { user: utilisateur, pass: motDePasse }
  });

  const email = texte(donnees.email, 160);
  const nomClient = [texte(donnees.prenom, 60), texte(donnees.nom, 60)].filter(Boolean).join(' ');

  const message = {
    from: '"Jolie Création — site" <' + DESTINATAIRE + '>',
    to: DESTINATAIRE,
    subject: SUJETS[type] + (nomClient ? ' — ' + nomClient : ''),
    text: versTexte(lignes),
    html: versHTML(type, lignes)
  };
  // Répondre à l'e-mail répond au client, pas à soi-même.
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) message.replyTo = email;

  const jointe = pieceJointe(charge.fichier);
  if (jointe) message.attachments = [jointe];

  try {
    await transporteur.sendMail(message);
    return reponse(200, { ok: true });
  } catch (e) {
    console.error('SMTP error', e && e.message);
    return reponse(502, {
      erreur: 'smtp',
      message: 'Votre demande n’a pas pu être envoyée. Réessayez, ou écrivez-moi directement à ' + DESTINATAIRE + '.'
    });
  }
};

// Exportés pour les tests, qui vérifient la construction sans rien envoyer.
exports.construireCorps = construireCorps;
exports.versHTML = versHTML;
exports.echapper = echapper;
exports.CHAMPS = CHAMPS;
exports.SUJETS = SUJETS;
