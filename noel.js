/* ============================================================
   Magie de Noël : compte à rebours et stock réel du coffret
   ------------------------------------------------------------
   Rien ici n'est une règle commerciale : ce script ne fait que
   MONTRER l'état réel. Le serveur (create-checkout, stock) refuse de
   lui-même une commande hors date ou hors stock ; masquer un bouton
   n'a jamais suffi, et ne suffit pas ici non plus.

   - Le décompte vise l'instant exact porté par data-fin (23 h 59 min
     59 s, heure suisse).
   - Le stock affiché est écrit dans la page à partir de catalogue.js
     (« stock »), que la pâtissière met à jour à la main : ce script ne
     le devine pas et n'interroge aucun service.
   ============================================================ */
(function () {
  'use strict';

  var decalage = 0;
  var termine = false;
  var epuise = !!(zoneStockInit() && zoneStockInit().classList.contains('est-epuise'));

  function zoneStockInit() { return document.querySelector('[data-noel-stock]'); }
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

  tic();
  setInterval(tic, 1000);
})();
