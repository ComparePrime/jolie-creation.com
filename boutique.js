/* ============================================================
   JOLIE CRÉATION — panier
   ------------------------------------------------------------
   Chargé sur toutes les pages, après catalogue.js.
   Le panier vit dans localStorage : rien n'est envoyé au serveur
   avant le passage au paiement.
   ============================================================ */
(function () {
  'use strict';

  var CLE = 'jc-panier-v1';
  var Cat = window.JCCatalogue;
  if (!Cat) return;

  /* ---------- Stockage ----------
     localStorage lève en navigation privée sur certains navigateurs :
     tout passe par try/catch, le panier retombe alors sur la mémoire
     de la page plutôt que de casser le site. */
  var memoire = null;

  function lire() {
    if (memoire) return memoire;
    try {
      var brut = window.localStorage.getItem(CLE);
      var lignes = brut ? JSON.parse(brut) : [];
      return Array.isArray(lignes) ? lignes.filter(valide) : [];
    } catch (e) {
      return [];
    }
  }

  function valide(ligne) {
    return ligne && typeof ligne.id === 'string' && Cat.article(ligne.id) &&
      typeof ligne.qte === 'number' && ligne.qte > 0;
  }

  function ecrire(lignes) {
    memoire = lignes;
    try { window.localStorage.setItem(CLE, JSON.stringify(lignes)); } catch (e) { /* mémoire seule */ }
    memoire = null;
    majCompteurs();
    document.dispatchEvent(new CustomEvent('panier:maj'));
  }

  /* Deux micro-scénographies aux dates différentes sont deux lignes
     distinctes : la clé de ligne inclut donc les détails saisis. */
  function cleLigne(id, details) {
    var suffixe = '';
    if (details) {
      var cles = Object.keys(details).sort();
      suffixe = cles.map(function (k) { return k + '=' + details[k]; }).join('|');
    }
    return suffixe ? id + '::' + suffixe : id;
  }

  function ajouter(id, qte, details) {
    var a = Cat.article(id);
    if (!a) return null;
    qte = Math.max(1, parseInt(qte, 10) || 1);
    var lignes = lire();
    var cle = cleLigne(id, details);
    var existante = null;
    lignes.forEach(function (l) { if (l.cle === cle) existante = l; });
    if (existante) existante.qte += qte;
    else lignes.push({ cle: cle, id: id, qte: qte, details: details || null });
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
     Deux montants séparés : ce qui part chez Stripe, et ce qui reste
     à confirmer parce que son tarif est une fourchette. */
  function totaux() {
    var lignes = lire();
    var t = {
      lignes: lignes,
      nbArticles: 0,
      payable: 0,
      aConfirmerMin: 0,
      aConfirmerMax: 0,
      biscuitsPackage: 0,
      biscuitsSup: 0,
      aDesSup: false
    };
    lignes.forEach(function (l) {
      var a = Cat.article(l.id);
      t.nbArticles += l.qte;
      if (a.aConfirmer) {
        t.aConfirmerMin += a.prixMin * l.qte;
        t.aConfirmerMax += a.prixMax * l.qte;
      } else {
        t.payable += a.prix * l.qte;
      }
      if (a.categorie === 'package-biscuits') t.biscuitsPackage += (a.biscuits || 0) * l.qte;
      if (a.categorie === 'biscuit-sup') { t.biscuitsSup += l.qte; t.aDesSup = true; }
    });
    return t;
  }

  /* Règle métier : la commande de biscuits démarre à 12 pièces, donc
     des biscuits supplémentaires seuls ne constituent pas une commande. */
  function blocage() {
    var t = totaux();
    if (!t.lignes.length) return 'Votre panier est vide.';
    if (t.aDesSup && t.biscuitsPackage < Cat.MIN_BISCUITS) {
      return 'Les biscuits supplémentaires s’ajoutent à un package : la commande de biscuits démarre à ' +
        Cat.MIN_BISCUITS + ' biscuits. Ajoutez un package pour continuer.';
    }
    if (t.payable <= 0) {
      return 'Votre panier ne contient que des articles dont le tarif reste à confirmer. ' +
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

  /* ---------- Boutons « Ajouter au panier » ----------
     Un bouton portant data-ajout-panier="<id>" suffit ; s'il porte
     aussi data-details, un formulaire s'ouvre avant l'ajout. */
  function brancherBoutons() {
    document.querySelectorAll('[data-ajout-panier]').forEach(function (bouton) {
      if (bouton.dataset.branche) return;
      bouton.dataset.branche = '1';
      bouton.addEventListener('click', function (e) {
        e.preventDefault();
        var id = bouton.getAttribute('data-ajout-panier');
        var a = Cat.article(id);
        if (!a) return;
        if (a.details) { ouvrirFormulaireDetails(a); return; }
        var champQte = bouton.getAttribute('data-quantite-champ');
        var qte = 1;
        if (champQte) {
          var input = document.getElementById(champQte);
          qte = input ? parseInt(input.value, 10) || 1 : 1;
        }
        ajouter(id, qte);
        annoncer((qte > 1 ? qte + ' × ' : '') + a.court + ' ajouté au panier.');
      });
    });
  }

  /* ---------- Formulaire de détails (micro-scénographies) ---------- */
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
      '  <span class="eyebrow" data-modale-sur-titre>Votre événement</span>' +
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

  function ouvrirFormulaireDetails(a) {
    var d = construireDialogue();
    dernierDeclencheur = document.activeElement;
    d.querySelector('[data-modale-titre]').textContent = a.court;
    d.querySelector('[data-modale-intro]').textContent =
      'Ces informations accompagnent votre commande. Elles me permettent de préparer votre décor.';
    var form = d.querySelector('.details-form');
    form.innerHTML = '';

    Cat.CHAMPS_SCENOGRAPHIE.forEach(function (champ) {
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
      form.appendChild(bloc);
    });

    var erreur = document.createElement('p');
    erreur.className = 'details-erreur';
    erreur.hidden = true;
    form.appendChild(erreur);

    var rappel = document.createElement('p');
    rappel.className = 'details-rappel';
    rappel.textContent = a.aPartirDe
      ? 'Tarif de départ : ' + Cat.formater(a.prix) + '. Un éventuel complément lié à vos options vous est confirmé avant l’événement.'
      : Cat.formater(a.prix);
    form.appendChild(rappel);

    var valider = document.createElement('button');
    valider.type = 'submit';
    valider.className = 'btn btn-primary';
    valider.textContent = 'Ajouter au panier';
    form.appendChild(valider);

    form.onsubmit = function (e) {
      e.preventDefault();
      var details = {};
      var manquants = [];
      Cat.CHAMPS_SCENOGRAPHIE.forEach(function (champ) {
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
      ajouter(a.id, 1, details);
      fermerDialogue();
      annoncer(a.court + ' ajouté au panier.');
    };

    d.hidden = false;
    document.body.classList.add('modale-ouverte');
    var premier = form.querySelector('input, textarea');
    if (premier) premier.focus();
  }

  window.JCPanier = {
    lire: lire,
    ajouter: ajouter,
    definirQuantite: definirQuantite,
    retirer: retirer,
    vider: vider,
    totaux: totaux,
    blocage: blocage,
    majCompteurs: majCompteurs
  };

  document.addEventListener('DOMContentLoaded', function () {
    majCompteurs();
    brancherBoutons();
  });
})();
