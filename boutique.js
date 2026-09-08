/* ============================================================
   JOLIE CRÉATION — panier
   ------------------------------------------------------------
   Chargé sur toutes les pages, après catalogue.js.
   Le panier vit dans localStorage : rien n'est envoyé au serveur
   avant le passage au paiement.

   Un principe de structure : chaque biscuit se commande à
   l'unité, à son propre prix, et le panier peut mélanger
   librement les collections. Le minimum de douze biscuits porte
   donc sur le TOTAL du panier, jamais sur une collection prise
   isolément. C'est blocage() qui le fait respecter, et la
   fonction serveur le revérifie avant d'encaisser.
   ============================================================ */
(function () {
  'use strict';

  var CLE = 'jc-panier-v3';
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
    return !!a && typeof ligne.qte === 'number' && ligne.qte > 0;
  }

  function ecrire(lignes) {
    try { window.localStorage.setItem(CLE, JSON.stringify(lignes)); } catch (e) { /* mémoire seule */ }
    majCompteurs();
    document.dispatchEvent(new CustomEvent('panier:maj'));
  }

  /* Deux fois le même biscuit avec des personnalisations différentes
     forment deux lignes distinctes : la clé de ligne reprend donc tout
     ce qui les distingue. C'est ce qui permet de commander « Léa » et
     « Tom » sur le même modèle. */
  function cleLigne(id, details, option) {
    var morceaux = [id];
    if (option) morceaux.push('+option');
    if (details) {
      Object.keys(details).sort().forEach(function (k) {
        if (details[k]) morceaux.push(k + '=' + details[k]);
      });
    }
    return morceaux.join('::');
  }

  function ajouter(id, qte, details, option) {
    var a = Cat.article(id);
    if (!a) return null;
    qte = Math.max(1, parseInt(qte, 10) || 1);
    option = !!(option && a.option);
    var lignes = lire();
    var cle = cleLigne(id, details, option);
    var existante = null;
    lignes.forEach(function (l) { if (l.cle === cle) existante = l; });
    if (existante) existante.qte += qte;
    else lignes.push({ cle: cle, id: id, qte: qte, details: details || null, option: option });
    ecrire(lignes);
    return a;
  }

  /* Ajout groupé depuis la modale d'une collection : une seule
     écriture, un seul événement, un seul message. */
  function ajouterPlusieurs(choix) {
    var lignes = lire();
    var nb = 0;
    choix.forEach(function (c) {
      var a = Cat.article(c.id);
      if (!a || c.qte <= 0) return;
      var option = !!(c.option && a.option);
      var cle = cleLigne(c.id, c.details, option);
      var existante = null;
      lignes.forEach(function (l) { if (l.cle === cle) existante = l; });
      if (existante) existante.qte += c.qte;
      else lignes.push({ cle: cle, id: c.id, qte: c.qte, details: c.details || null, option: option });
      nb += c.qte;
    });
    if (nb) ecrire(lignes);
    return nb;
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
  function prixLigne(ligne) {
    return Cat.prixUnitaire(Cat.article(ligne.id), ligne.option);
  }

  function totauxLigne(ligne) {
    return { unitaire: prixLigne(ligne), payable: prixLigne(ligne) * ligne.qte, biscuits: ligne.qte };
  }

  function totaux() {
    var lignes = lire();
    var t = { lignes: lignes, nbArticles: 0, payable: 0, biscuits: 0 };
    lignes.forEach(function (l) {
      t.nbArticles += l.qte;
      t.payable += prixLigne(l) * l.qte;
      t.biscuits += l.qte;
    });
    t.manquants = Math.max(0, Cat.MIN_BISCUITS - t.biscuits);
    return t;
  }

  /* Le panier groupé par collection, pour l'affichage. */
  function parCollection() {
    var groupes = [];
    var index = {};
    lire().forEach(function (l) {
      var a = Cat.article(l.id);
      if (!index[a.collectionId]) {
        index[a.collectionId] = { id: a.collectionId, nom: a.collection, lignes: [], biscuits: 0, total: 0 };
        groupes.push(index[a.collectionId]);
      }
      var g = index[a.collectionId];
      g.lignes.push(l);
      g.biscuits += l.qte;
      g.total += prixLigne(l) * l.qte;
    });
    return groupes;
  }

  /* Ce qui empêche de passer à la commande, ou null si tout va bien. */
  function blocage() {
    var t = totaux();
    if (!t.lignes.length) return 'Votre panier est vide.';
    if (t.manquants > 0) {
      return 'Il vous reste ' + t.manquants + ' biscuit' + (t.manquants > 1 ? 's' : '') +
        ' pour atteindre le minimum de commande de ' + Cat.MIN_BISCUITS + ' biscuits.';
    }
    if (t.payable <= 0) return 'Votre panier ne contient aucun article facturable.';
    return null;
  }

  /* La même information, formulée positivement quand le compte y est. */
  function messageMinimum() {
    var t = totaux();
    if (!t.lignes.length) return '';
    if (t.manquants > 0) {
      return 'Il vous reste ' + t.manquants + ' biscuit' + (t.manquants > 1 ? 's' : '') +
        ' pour atteindre le minimum de commande de ' + Cat.MIN_BISCUITS + ' biscuits.';
    }
    return 'Minimum de ' + Cat.MIN_BISCUITS + ' biscuits atteint.';
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
      el.setAttribute('aria-label', n === 0 ? 'Mon panier, vide'
        : 'Mon panier, ' + n + ' biscuit' + (n > 1 ? 's' : ''));
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

  /* ---------- Photos de collection manquantes ----------
     Les images sont déposées au fur et à mesure. Tant qu'un fichier
     n'existe pas, on retire l'image plutôt que d'afficher l'icône
     de lien brisé : le cadre reste, sobre, et la carte tient. */
  function surveillerPhotos() {
    document.querySelectorAll('[data-photo-collection]').forEach(function (img) {
      function absente() {
        var cadre = img.closest('.collection-photo');
        if (cadre) cadre.classList.add('sans-photo');
        img.remove();
      }
      if (img.complete && img.naturalWidth === 0) absente();
      else img.addEventListener('error', absente);
    });
  }

  /* ============================================================
     MODALE DE SÉLECTION D'UNE COLLECTION
     ------------------------------------------------------------
     Le bouton d'une collection n'ajoute rien directement : il ouvre
     cette fenêtre, où le client compose son assortiment biscuit par
     biscuit. C'est ce qui permet de mélanger les modèles, et de
     mélanger ensuite les collections dans le panier.
     ============================================================ */
  var dialogue = null;
  var dernierDeclencheur = null;

  function construireDialogue() {
    if (dialogue) return dialogue;
    dialogue = document.createElement('div');
    dialogue.className = 'choix-modale';
    dialogue.setAttribute('role', 'dialog');
    dialogue.setAttribute('aria-modal', 'true');
    dialogue.setAttribute('aria-labelledby', 'choix-titre');
    dialogue.hidden = true;
    dialogue.innerHTML =
      '<div class="choix-fond" data-fermer></div>' +
      '<div class="choix-boite" role="document">' +
      '  <header class="choix-entete">' +
      '    <div>' +
      '      <span class="eyebrow" data-choix-sur-titre></span>' +
      '      <h2 id="choix-titre" data-choix-titre></h2>' +
      '    </div>' +
      '    <button type="button" class="choix-fermer" data-fermer aria-label="Fermer">&times;</button>' +
      '  </header>' +
      '  <p class="choix-intro" data-choix-intro></p>' +
      '  <div class="choix-liste" data-choix-liste></div>' +
      '  <footer class="choix-pied">' +
      '    <p class="choix-resume" data-choix-resume aria-live="polite"></p>' +
      '    <button type="button" class="btn btn-primary" data-choix-valider>Ajouter la sélection au panier</button>' +
      '  </footer>' +
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

  /* Un champ de personnalisation, texte libre ou choix fermé. */
  function champHTML(champ, prefixe) {
    var bloc = document.createElement('div');
    bloc.className = 'choix-champ';
    var id = prefixe + '-' + champ.cle;
    var label = document.createElement('label');
    label.setAttribute('for', id);
    label.textContent = champ.libelle;
    var saisie;
    if (champ.type === 'choix') {
      saisie = document.createElement('select');
      (champ.options || []).forEach(function (o) {
        var opt = document.createElement('option');
        opt.value = o;
        opt.textContent = o;
        saisie.appendChild(opt);
      });
    } else {
      saisie = document.createElement('input');
      saisie.type = 'text';
      if (champ.exemple) saisie.placeholder = champ.exemple;
      if (champ.max) saisie.maxLength = champ.max;
    }
    saisie.id = id;
    saisie.name = champ.cle;
    bloc.appendChild(label);
    bloc.appendChild(saisie);
    return { bloc: bloc, saisie: saisie, cle: champ.cle };
  }

  function ouvrirCollection(c) {
    var d = construireDialogue();
    dernierDeclencheur = document.activeElement;

    d.querySelector('[data-choix-sur-titre]').textContent = c.occasion;
    d.querySelector('[data-choix-titre]').textContent = c.nom;
    d.querySelector('[data-choix-intro]').textContent =
      'Choisissez vos biscuits à l’unité. Vous pouvez ensuite compléter avec d’autres collections : ' +
      'le minimum de ' + Cat.MIN_BISCUITS + ' biscuits porte sur l’ensemble du panier.';

    var liste = d.querySelector('[data-choix-liste]');
    liste.innerHTML = '';
    var etats = [];
    /* Résumé et bouton relevés avant la boucle : chaque modèle appelle
       majResume() dès sa création pour se mettre à zéro, et majResume a
       besoin des deux. */
    var resume = d.querySelector('[data-choix-resume]');
    var valider = d.querySelector('[data-choix-valider]');

    c.produits.forEach(function (p) {
      var etat = { produit: p, qte: 0, champs: [], option: null, champsOption: [] };
      var rang = document.createElement('div');
      rang.className = 'choix-rang';

      var texte = document.createElement('div');
      texte.className = 'choix-rang-texte';
      var nom = document.createElement('span');
      nom.className = 'choix-nom';
      nom.textContent = p.nom;
      texte.appendChild(nom);
      var prix = document.createElement('span');
      prix.className = 'choix-prix';
      prix.textContent = Cat.formater(p.prix);
      texte.appendChild(prix);
      if (p.champs.length || p.option) {
        var badge = document.createElement('span');
        badge.className = 'choix-badge';
        badge.textContent = 'Personnalisable';
        texte.appendChild(badge);
      }
      rang.appendChild(texte);

      /* Compteur : deux boutons et un champ, assez grands pour le pouce. */
      var pas = document.createElement('div');
      pas.className = 'choix-pas';
      var moins = document.createElement('button');
      moins.type = 'button';
      moins.textContent = '−';
      moins.setAttribute('aria-label', 'Retirer un ' + p.nom);
      var champ = document.createElement('input');
      champ.type = 'number';
      champ.min = '0';
      champ.max = '99';
      champ.value = '0';
      champ.inputMode = 'numeric';
      champ.setAttribute('aria-label', 'Nombre de ' + p.nom);
      var plus = document.createElement('button');
      plus.type = 'button';
      plus.textContent = '+';
      plus.setAttribute('aria-label', 'Ajouter un ' + p.nom);
      pas.appendChild(moins); pas.appendChild(champ); pas.appendChild(plus);
      rang.appendChild(pas);

      /* Personnalisation : n'apparaît que si le biscuit est retenu. */
      var perso = document.createElement('div');
      perso.className = 'choix-perso';
      perso.hidden = true;

      if (p.option) {
        var ligneOption = document.createElement('label');
        ligneOption.className = 'choix-option';
        var coche = document.createElement('input');
        coche.type = 'checkbox';
        var libelle = document.createElement('span');
        libelle.textContent = p.option.libelle + ' (+ ' + Cat.formater(p.option.supplement) + ')';
        ligneOption.appendChild(coche);
        ligneOption.appendChild(libelle);
        perso.appendChild(ligneOption);
        etat.option = coche;
      }

      var zoneChamps = document.createElement('div');
      zoneChamps.className = 'choix-champs';
      p.champs.forEach(function (ch) {
        var f = champHTML(ch, 'ch-' + p.id);
        zoneChamps.appendChild(f.bloc);
        etat.champs.push(f);
      });
      if (p.option) {
        var zoneOption = document.createElement('div');
        zoneOption.className = 'choix-champs';
        zoneOption.hidden = true;
        p.option.champs.forEach(function (ch) {
          var f = champHTML(ch, 'op-' + p.id);
          zoneOption.appendChild(f.bloc);
          etat.champsOption.push(f);
        });
        perso.appendChild(zoneOption);
        etat.option.addEventListener('change', function () {
          zoneOption.hidden = !etat.option.checked;
          majResume();
        });
      }
      perso.insertBefore(zoneChamps, perso.firstChild);

      if (p.champs.length > 1 || (p.champs.length && p.option)) {
        var aide = document.createElement('p');
        aide.className = 'choix-aide';
        aide.textContent = 'Pour plusieurs personnalisations différentes du même biscuit, ajoutez-le une première fois, puis revenez le choisir à nouveau.';
        perso.appendChild(aide);
      }

      if (p.champs.length || p.option) rang.appendChild(perso);

      function definir(n) {
        etat.qte = Math.min(99, Math.max(0, n));
        champ.value = String(etat.qte);
        moins.disabled = etat.qte === 0;
        rang.classList.toggle('retenu', etat.qte > 0);
        perso.hidden = etat.qte === 0;
        majResume();
      }
      moins.addEventListener('click', function () { definir(etat.qte - 1); });
      plus.addEventListener('click', function () { definir(etat.qte + 1); });
      champ.addEventListener('input', function () { definir(parseInt(champ.value, 10) || 0); });
      definir(0);

      liste.appendChild(rang);
      etats.push(etat);
    });

    function majResume() {
      var n = 0, total = 0;
      etats.forEach(function (e) {
        if (!e.qte) return;
        n += e.qte;
        total += Cat.prixUnitaire(e.produit, e.option && e.option.checked) * e.qte;
      });
      valider.disabled = n === 0;
      if (!n) {
        resume.textContent = 'Aucun biscuit sélectionné pour l’instant.';
        return;
      }
      var dejaAuPanier = totaux().biscuits;
      var apres = dejaAuPanier + n;
      var reste = Math.max(0, Cat.MIN_BISCUITS - apres);
      resume.textContent = n + ' biscuit' + (n > 1 ? 's' : '') + ' · ' + Cat.formater(total) +
        (reste > 0
          ? ' — il en manquera ' + reste + ' pour atteindre le minimum de ' + Cat.MIN_BISCUITS + '.'
          : ' — minimum de ' + Cat.MIN_BISCUITS + ' biscuits atteint.');
    }

    valider.onclick = function () {
      var choix = [];
      etats.forEach(function (e) {
        if (!e.qte) return;
        var details = {};
        e.champs.forEach(function (f) {
          var v = (f.saisie.value || '').trim();
          if (v) details[f.cle] = v;
        });
        var avecOption = !!(e.option && e.option.checked);
        if (avecOption) {
          e.champsOption.forEach(function (f) {
            var v = (f.saisie.value || '').trim();
            if (v) details[f.cle] = v;
          });
        }
        choix.push({ id: e.produit.id, qte: e.qte, option: avecOption,
                     details: Object.keys(details).length ? details : null });
      });
      var n = ajouterPlusieurs(choix);
      fermerDialogue();
      annoncer(n + ' biscuit' + (n > 1 ? 's' : '') + ' de la collection ' + c.nom + ' ajouté' + (n > 1 ? 's' : '') + ' au panier.');
    };

    majResume();
    d.hidden = false;
    document.body.classList.add('modale-ouverte');
    d.querySelector('.choix-boite').scrollTop = 0;
    d.querySelector('.choix-fermer').focus();
  }

  /* ---------- Boutons « Choisir mes biscuits » ---------- */
  function brancherBoutons() {
    document.querySelectorAll('[data-collection]').forEach(function (bouton) {
      if (bouton.dataset.branche) return;
      bouton.dataset.branche = '1';
      bouton.addEventListener('click', function (e) {
        e.preventDefault();
        var c = Cat.collection(bouton.getAttribute('data-collection'));
        if (c) ouvrirCollection(c);
      });
    });
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

  /* Détails de personnalisation d'une ligne, en une phrase lisible. */
  function resumeDetails(ligne) {
    var d = ligne.details || {};
    var bouts = Object.keys(Cat.CHAMPS)
      .filter(function (k) { return d[k]; })
      .map(function (k) { return Cat.CHAMPS[k].libelle + ' : ' + d[k]; });
    return bouts.join(' · ');
  }

  /* Photographie du panier, lisible telle quelle par la page de
     confirmation et par l'e-mail : elles n'ont plus besoin du catalogue. */
  function resumeCommande() {
    var t = totaux();
    var lignes = [];
    parCollection().forEach(function (g) {
      lignes.push({ nom: g.nom, entete: true });
      g.lignes.forEach(function (l) {
        var a = Cat.article(l.id);
        lignes.push({
          nom: a.nom + (l.option ? ' (personnalisé)' : ''),
          details: resumeDetails(l),
          qte: l.qte,
          unitaire: prixLigne(l),
          montant: prixLigne(l) * l.qte,
          sous: true
        });
      });
    });
    return { lignes: lignes, total: t.payable, biscuits: t.biscuits, devise: Cat.DEVISE };
  }

  window.JCPanier = {
    lire: lire,
    ajouter: ajouter,
    ajouterPlusieurs: ajouterPlusieurs,
    definirQuantite: definirQuantite,
    retirer: retirer,
    vider: vider,
    totaux: totaux,
    totauxLigne: totauxLigne,
    parCollection: parCollection,
    blocage: blocage,
    messageMinimum: messageMinimum,
    resumeDetails: resumeDetails,
    majCompteurs: majCompteurs,
    ouvrirCollection: ouvrirCollection,
    memoriserCommande: memoriserCommande,
    commandeMemorisee: commandeMemorisee,
    oublierCommande: oublierCommande,
    resumeCommande: resumeCommande
  };

  document.addEventListener('DOMContentLoaded', function () {
    majCompteurs();
    surveillerPhotos();
    brancherBoutons();
  });
})();
