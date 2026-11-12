/* ============================================================
   Magie de Noël : compte à rebours et stock réel du coffret
   ------------------------------------------------------------
   Rien ici n'est une règle commerciale : ce script ne fait que
   MONTRER l'état réel. Le serveur (create-checkout, stock) refuse de
   lui-même une commande hors date ou hors stock ; masquer un bouton
   n'a jamais suffi, et ne suffit pas ici non plus.

   - Le décompte vise l'instant exact porté par data-fin (23 h 59 min
     59 s, heure suisse). Il se cale sur l'horloge du serveur quand elle
     est connue, pour ne pas dépendre d'une horloge d'ordinateur fausse.
   - Le stock affiché est celui renvoyé par /stock : les coffrets
     réellement vendus. S'il est injoignable, la page n'affiche aucun
     chiffre : « Quantités limitées », rien de plus.
   ============================================================ */
(function () {
  'use strict';

  var decalage = 0;            // heure du serveur - heure du navigateur
  var termine = false;
  var epuise = false;

  var compteurs = document.querySelectorAll('[data-noel-compteur]');
  var boutons = document.querySelectorAll('[data-noel-coffret]');
  var zoneStock = document.querySelector('[data-noel-stock]');

  function deux(n) { return (n < 10 ? '0' : '') + n; }

  function bloquerBoutons() {
    boutons.forEach(function (b) {
      if (epuise || termine) {
        b.disabled = true;
        b.setAttribute('aria-disabled', 'true');
        b.textContent = epuise && !termine ? 'Épuisé' : 'Offre terminée';
      }
    });
  }

  function tic() {
    compteurs.forEach(function (c) {
      var fin = Date.parse(c.getAttribute('data-fin'));
      var reste = fin - (Date.now() + decalage);
      var cases = c.querySelector('.noel-compteur-cases');
      var titre = c.querySelector('.noel-compteur-titre');
      var date = c.querySelector('.noel-compteur-date');
      if (!isFinite(fin)) return;
      if (reste <= 0) {
        termine = true;
        if (titre) titre.textContent = 'Offre terminée';
        if (date) date.hidden = true;
        if (cases) cases.hidden = true;
        c.classList.add('est-termine');
        return;
      }
      var s = Math.floor(reste / 1000);
      var v = {
        jours: Math.floor(s / 86400),
        heures: deux(Math.floor(s % 86400 / 3600)),
        minutes: deux(Math.floor(s % 3600 / 60)),
        secondes: deux(s % 60)
      };
      Object.keys(v).forEach(function (k) {
        var el = c.querySelector('[data-u="' + k + '"]');
        if (el) el.textContent = v[k];
      });
      if (cases) cases.hidden = false;
      if (date) date.hidden = true;
    });
    bloquerBoutons();
  }

  function afficherStock(coffret) {
    if (!zoneStock || !coffret) return;
    var n = coffret.restant;
    if (n <= 0) {
      epuise = true;
      zoneStock.textContent = 'Épuisé';
      zoneStock.classList.add('est-epuise');
    } else if (n === coffret.stock) {
      zoneStock.textContent = 'Seulement ' + n + ' coffrets disponibles';
    } else if (n <= 5) {
      zoneStock.textContent = 'Derniers coffrets disponibles : ' + n + ' restant' + (n > 1 ? 's' : '');
    } else {
      zoneStock.textContent = n + ' coffrets restants sur ' + coffret.stock;
    }
    bloquerBoutons();
  }

  fetch('/.netlify/functions/stock', { cache: 'no-store' }).then(function (r) {
    if (!r.ok) throw new Error('stock');
    return r.json();
  }).then(function (d) {
    if (typeof d.maintenant === 'number') decalage = d.maintenant - Date.now();
    if (d.offreTerminee) termine = true;
    afficherStock(d.coffret);
    tic();
  }).catch(function () { /* aucun chiffre inventé : texte statique conservé */ });

  tic();
  setInterval(tic, 1000);
})();
