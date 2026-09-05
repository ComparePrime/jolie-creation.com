/* ============================================================
   JOLIE CRÉATION — panier
   ------------------------------------------------------------
   Chargé sur toutes les pages, après catalogue.js.
   Le panier vit dans localStorage : rien n'est envoyé au serveur
   avant le passage au paiement.

   Un principe de structure : les biscuits supplémentaires ne sont
   jamais une ligne à eux seuls. Ils sont attachés à la ligne du
   package qui les porte, ce qui garantit le minimum de 12 biscuits
   sans avoir à le vérifier après coup.
   ============================================================ */
(function () {
  'use strict';

  var CLE = 'jc-panier-v2';
  var Cat = window.JCCatalogue;
  if (!Cat) return;

  /* ---------- Stockage ----------
     localStorage lève en navigation privée sur certains navigateurs :
     tout passe par try/catch, le panier retombe alors sur la mémoire
     de la page plutôt que de casser le site. */
  function lire() {
    try {
      var brut = window.localStorage.getItem(CLE);
      var lignes = brut ? JSON.parse(brut) : [];
      return Array.isArray(lignes) ? lignes.filter(valide) : [];
    } catch (e) {
      return [];
    }
  }

  function valide(ligne) {
    if (!ligne || typeof ligne.id !== 'string') return false;
    var a = Cat.article(ligne.id);
    if (!a || typeof ligne.qte !== 'number' || ligne.qte <= 0) return false;
    // Un supplément esseulé n'est pas une commande valable.
    return a.categorie !== 'biscuit-sup';
  }

  function ecrire(lignes) {
    try { window.localStorage.setItem(CLE, JSON.stringify(lignes)); } catch (e) { /* mémoire seule */ }
    majCompteurs();
    document.dispatchEvent(new CustomEvent('panier:maj'));
  }

  /* Deux articles aux détails ou aux suppléments différents forment deux
     lignes distinctes : la clé de ligne reprend donc tout ce qui les
     distingue. */
  function cleLigne(id, details, supplements) {
    var morceaux = [id];
    if (details) {
      Object.keys(details).sort().forEach(function (k) { morceaux.push(k + '=' + details[k]); });
    }
    if (supplements) {
      Object.keys(supplements).sort().forEach(function (k) {
        if (supplements[k] > 0) morceaux.push(k + '#' + supplements[k]);
      });
    }
    return morceaux.join('::');
  }

  function nettoyerSupplements(supplements) {
    var propre = null;
    Object.keys(supplements || {}).forEach(function (id) {
      var a = Cat.article(id);
      var q = parseInt(supplements[id], 10) || 0;
      if (!a || a.categorie !== 'biscuit-sup' || q <= 0) return;
      if (!propre) propre = {};
      propre[id] = Math.min(99, q);
    });
    return propre;
  }

  function ajouter(id, qte, details, supplements) {
    var a = Cat.article(id);
    if (!a || a.categorie === 'biscuit-sup') return null;
    qte = Math.max(1, parseInt(qte, 10) || 1);
    var sup = a.categorie === 'package-biscuits' ? nettoyerSupplements(supplements) : null;
    var lignes = lire();
    var cle = cleLigne(id, details, sup);
    var existante = null;
    lignes.forEach(function (l) { if (l.cle === cle) existante = l; });
    if (existante) existante.qte += qte;
    else lignes.push({ cle: cle, id: id, qte: qte, details: details || null, supplements: sup });
    ecrire(lignes);
    return a;
  }

  function definirQuantite(cle, qte) {
    qte = parseInt(qte, 10) || 0;
    var lignes = lire().filter(function (l) {
      if (l.cle !== cle) return true;
      l.qte = qte;
      return qte > 0;
    });
    ecrire(lignes);
  }

  function retirer(cle) { definirQuantite(cle, 0); }

  function vider() { ecrire([]); }

  /* ---------- Totaux ----------
     Tous les tarifs sont fixes : un seul montant, calculable en
     entier, payable en entier. */
  function totauxLigne(ligne) {
    var a = Cat.article(ligne.id);
    var r = { payable: a.prix * ligne.qte, biscuits: (a.biscuits || 0) * ligne.qte, supplements: [] };
    Object.keys(ligne.supplements || {}).forEach(function (id) {
      var s = Cat.article(id);
      if (!s) return;
      var q = ligne.supplements[id] * ligne.qte;
      r.payable += s.prix * q;
      r.biscuits += q;
      r.supplements.push({ article: s, qte: q, parUnite: ligne.supplements[id] });
    });
    return r;
  }

  function totaux() {
    var lignes = lire();
    var t = { lignes: lignes, nbArticles: 0, payable: 0, biscuits: 0 };
    lignes.forEach(function (l) {
      var r = totauxLigne(l);
      t.nbArticles += l.qte;
      t.payable += r.payable;
      t.biscuits += r.biscuits;
    });
    return t;
  }

  function blocage() {
    var t = totaux();
    if (!t.lignes.length) return 'Votre panier est vide.';
    if (t.payable <= 0) {
      return 'Votre panier ne contient aucun article facturable. ' +
        'Contactez-moi directement pour finaliser cette commande.';
    }
    return null;
  }

  /* ---------- Compteur du header ---------- */
  function majCompteurs() {
    var n = 0;
    lire().forEach(function (l) { n += l.qte; });
    document.querySelectorAll('[data-panier-compteur]').forEach(function (el) {
      el.textContent = String(n);
      el.hidden = n === 0;
    });
    document.querySelectorAll('[data-panier-lien]').forEach(function (el) {
      el.setAttribute('aria-label', n === 0 ? 'Mon panier, vide' : 'Mon panier, ' + n + ' article' + (n > 1 ? 's' : ''));
    });
  }

  /* ---------- Petit message de confirmation ---------- */
  var minuteur = null;
  function annoncer(texte) {
    var zone = document.querySelector('.panier-toast');
    if (!zone) {
      zone = document.createElement('div');
      zone.className = 'panier-toast';
      zone.setAttribute('role', 'status');
      zone.setAttribute('aria-live', 'polite');
      document.body.appendChild(zone);
    }
    zone.innerHTML = '';
    var p = document.createElement('span');
    p.textContent = texte;
    var lien = document.createElement('a');
    lien.href = 'panier.html';
    lien.textContent = 'Voir mon panier';
    zone.appendChild(p);
    zone.appendChild(lien);
    zone.classList.add('visible');
    if (minuteur) clearTimeout(minuteur);
    minuteur = setTimeout(function () { zone.classList.remove('visible'); }, 5000);
  }

  /* ---------- Prix affichés dans les pages ----------
     Les cartes portent le prix en dur pour rester lisibles sans
     JavaScript, mais c'est le catalogue qui tranche : une valeur
     oubliée dans le HTML serait corrigée ici plutôt que d'annoncer
     un montant que le panier ne pratique pas. */
  function majPrixAffiches() {
    document.querySelectorAll('[data-prix-article]').forEach(function (el) {
      var a = Cat.article(el.getAttribute('data-prix-article'));
      if (a) el.textContent = Cat.formaterPrix(a);
    });
  }

  /* ---------- Boutons « Ajouter au panier » ---------- */
  function brancherBoutons() {
    document.querySelectorAll('[data-ajout-panier]').forEach(function (bouton) {
      if (bouton.dataset.branche) return;
      bouton.dataset.branche = '1';
      bouton.addEventListener('click', function (e) {
        e.preventDefault();
        var a = Cat.article(bouton.getAttribute('data-ajout-panier'));
        if (!a) return;
        if (a.modale) { ouvrirModale(a); return; }
        ajouter(a.id, 1);
        annoncer(a.court + ' ajouté au panier.');
      });
    });
  }

  /* ---------- Modale d'ajout ----------
     Une seule variante depuis que les micro-scénographies passent par
     le devis : la personnalisation du package et les biscuits à y
     ajouter. Les collections du moment l'utilisent aussi, ce sont des
     packages comme les autres. */
  var dialogue = null;
  var dernierDeclencheur = null;

  function construireDialogue() {
    if (dialogue) return dialogue;
    dialogue = document.createElement('div');
    dialogue.className = 'details-modale';
    dialogue.setAttribute('role', 'dialog');
    dialogue.setAttribute('aria-modal', 'true');
    dialogue.hidden = true;
    dialogue.innerHTML =
      '<div class="details-modale-fond" data-fermer></div>' +
      '<div class="details-modale-boite" role="document">' +
      '  <button type="button" class="details-modale-fermer" data-fermer aria-label="Fermer">&times;</button>' +
      '  <span class="eyebrow" data-modale-sur-titre></span>' +
      '  <h2 data-modale-titre></h2>' +
      '  <p class="details-modale-intro" data-modale-intro></p>' +
      '  <form class="details-form" novalidate></form>' +
      '</div>';
    document.body.appendChild(dialogue);
    dialogue.addEventListener('click', function (e) {
      if (e.target.hasAttribute('data-fermer')) fermerDialogue();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !dialogue.hidden) fermerDialogue();
    });
    return dialogue;
  }

  function fermerDialogue() {
    if (!dialogue) return;
    dialogue.hidden = true;
    document.body.classList.remove('modale-ouverte');
    if (dernierDeclencheur) dernierDeclencheur.focus();
  }

  function champHTML(champ) {
    var bloc = document.createElement('div');
    bloc.className = 'field';
    var idChamp = 'detail-' + champ.cle;
    var label = document.createElement('label');
    label.setAttribute('for', idChamp);
    label.textContent = champ.libelle;
    if (champ.requis) {
      var etoile = document.createElement('span');
      etoile.className = 'req';
      etoile.textContent = ' *';
      label.appendChild(etoile);
    }
    var saisie = document.createElement(champ.type === 'zone' ? 'textarea' : 'input');
    if (champ.type !== 'zone') saisie.type = champ.type;
    saisie.id = idChamp;
    saisie.name = champ.cle;
    if (champ.exemple) saisie.placeholder = champ.exemple;
    if (champ.requis) saisie.required = true;
    if (champ.type === 'date') saisie.min = new Date().toISOString().slice(0, 10);
    bloc.appendChild(label);
    bloc.appendChild(saisie);
    return bloc;
  }

  function ouvrirModale(a) {
    var d = construireDialogue();
    dernierDeclencheur = document.activeElement;

    d.querySelector('[data-modale-sur-titre]').textContent = a.collection ? 'Votre collection' : 'Votre package';
    d.querySelector('[data-modale-titre]').textContent = a.court;
    d.querySelector('[data-modale-intro]').textContent = a.resume;

    var form = d.querySelector('.details-form');
    form.innerHTML = '';
    var champs = [Cat.CHAMP_PACKAGE];
    champs.forEach(function (champ) { form.appendChild(champHTML(champ)); });

    var saisiesSup = {};
    form.appendChild(blocSupplements(a, saisiesSup));

    var erreur = document.createElement('p');
    erreur.className = 'details-erreur';
    erreur.hidden = true;
    form.appendChild(erreur);

    var rappel = document.createElement('p');
    rappel.className = 'details-rappel';
    form.appendChild(rappel);

    var valider = document.createElement('button');
    valider.type = 'submit';
    valider.className = 'btn btn-primary';
    valider.textContent = 'Ajouter au panier';
    form.appendChild(valider);

    function majRappel() {
      var payable = a.prix, biscuits = a.biscuits || 0;
      Cat.SUPPLEMENTS.forEach(function (id) {
        var q = parseInt(saisiesSup[id].value, 10) || 0;
        biscuits += q;
        payable += Cat.article(id).prix * q;
      });
      rappel.innerHTML = '';
      var ligne = document.createElement('strong');
      ligne.textContent = (a.aPartirDe ? 'Dès ' : '') + Cat.formater(payable) + ' · ' + biscuits + ' biscuits';
      rappel.appendChild(ligne);
    }

    Object.keys(saisiesSup).forEach(function (id) {
      saisiesSup[id].addEventListener('input', majRappel);
    });
    majRappel();

    form.onsubmit = function (e) {
      e.preventDefault();
      var details = {};
      var manquants = [];
      champs.forEach(function (champ) {
        var saisie = form.elements[champ.cle];
        var v = (saisie.value || '').trim();
        if (champ.requis && !v) manquants.push(champ.libelle);
        if (v) details[champ.cle] = v;
      });
      if (manquants.length) {
        erreur.textContent = 'Merci de renseigner : ' + manquants.join(', ') + '.';
        erreur.hidden = false;
        return;
      }
      erreur.hidden = true;
      var supplements = {};
      Cat.SUPPLEMENTS.forEach(function (id) {
        var q = parseInt(saisiesSup[id].value, 10) || 0;
        if (q > 0) supplements[id] = q;
      });
      ajouter(a.id, 1, Object.keys(details).length ? details : null, supplements);
      fermerDialogue();
      annoncer(a.court + ' ajouté au panier.');
    };

    d.hidden = false;
    document.body.classList.add('modale-ouverte');
    var premier = form.querySelector('input, textarea');
    if (premier) premier.focus();
  }

  /* Les biscuits supplémentaires se choisissent ici, et nulle part
     ailleurs : c'est ce qui les lie au package. */
  function blocSupplements(a, saisies) {
    var bloc = document.createElement('fieldset');
    bloc.className = 'sup-modale';

    var legende = document.createElement('legend');
    legende.textContent = 'Ajouter des biscuits';
    bloc.appendChild(legende);

    var intro = document.createElement('p');
    intro.className = 'sup-modale-intro';
    intro.textContent = a.collection
      ? 'Cette collection contient déjà ' + (a.biscuits || Cat.MIN_BISCUITS) + ' biscuits. Vous pouvez la compléter à l’unité.'
      : 'Ce package contient déjà ' + (a.biscuits || Cat.MIN_BISCUITS) + ' biscuits. Vous pouvez le compléter à l’unité.';
    bloc.appendChild(intro);

    Cat.SUPPLEMENTS.forEach(function (id) {
      var s = Cat.article(id);
      var rang = document.createElement('div');
      rang.className = 'sup-rang';

      var texte = document.createElement('div');
      var nom = document.createElement('span');
      nom.className = 'sup-rang-nom';
      nom.textContent = s.court;
      var prix = document.createElement('span');
      prix.className = 'sup-rang-prix';
      prix.textContent = Cat.formater(s.prix) + ' pièce';
      texte.appendChild(nom);
      texte.appendChild(prix);

      var idChamp = 'sup-' + id;
      var label = document.createElement('label');
      label.className = 'sr-seulement';
      label.setAttribute('for', idChamp);
      label.textContent = 'Nombre de ' + s.court;
      var saisie = document.createElement('input');
      saisie.type = 'number';
      saisie.id = idChamp;
      saisie.min = '0';
      saisie.max = '99';
      saisie.value = '0';
      saisie.inputMode = 'numeric';
      saisies[id] = saisie;

      rang.appendChild(texte);
      rang.appendChild(label);
      rang.appendChild(saisie);
      bloc.appendChild(rang);
    });
    return bloc;
  }

  /* ---------- Commande en cours ----------
     SumUp ne connaît qu'un montant et un libellé : la page de
     confirmation ne peut donc pas lui redemander le détail de la
     commande. On en garde une copie au moment de partir payer, et
     c'est elle qui est affichée au retour. Le montant et l'état du
     paiement, eux, restent relus auprès de SumUp : la copie décrit
     la commande, elle ne prouve pas le paiement. */
  var CLE_COMMANDE = 'jc-commande-v1';

  function memoriserCommande(commande) {
    try { window.localStorage.setItem(CLE_COMMANDE, JSON.stringify(commande)); } catch (e) { /* mémoire seule */ }
  }

  function commandeMemorisee(reference) {
    try {
      var c = JSON.parse(window.localStorage.getItem(CLE_COMMANDE) || 'null');
      if (!c || (reference && c.reference !== reference)) return null;
      return c;
    } catch (e) {
      return null;
    }
  }

  function oublierCommande() {
    try { window.localStorage.removeItem(CLE_COMMANDE); } catch (e) { /* mémoire seule */ }
  }

  /* Photographie du panier, lisible telle quelle par la page de
     confirmation : elle n'a plus besoin du catalogue. */
  function resumeCommande() {
    var t = totaux();
    var lignes = [];
    t.lignes.forEach(function (l) {
      var a = Cat.article(l.id);
      var r = totauxLigne(l);
      lignes.push({ nom: a.court, qte: l.qte, montant: a.prix * l.qte });
      r.supplements.forEach(function (s) {
        lignes.push({ nom: s.article.court, qte: s.qte, montant: s.article.prix * s.qte, sous: true });
      });
    });
    return { lignes: lignes, total: t.payable, biscuits: t.biscuits, devise: Cat.DEVISE };
  }

  window.JCPanier = {
    lire: lire,
    ajouter: ajouter,
    definirQuantite: definirQuantite,
    retirer: retirer,
    vider: vider,
    totaux: totaux,
    totauxLigne: totauxLigne,
    blocage: blocage,
    majCompteurs: majCompteurs,
    memoriserCommande: memoriserCommande,
    commandeMemorisee: commandeMemorisee,
    oublierCommande: oublierCommande,
    resumeCommande: resumeCommande
  };

  document.addEventListener('DOMContentLoaded', function () {
    majCompteurs();
    majPrixAffiches();
    brancherBoutons();
  });
})();
