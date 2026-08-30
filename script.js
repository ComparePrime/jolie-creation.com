// Jolie Création — comportements partagés
document.addEventListener('DOMContentLoaded', function () {

  // --- Menu mobile ---
  var burger = document.querySelector('.burger');
  var mobileNav = document.querySelector('.mobile-nav');
  var closeBtn = document.querySelector('.mobile-nav-close');
  if (burger && mobileNav) {
    burger.addEventListener('click', function () {
      mobileNav.classList.add('open');
      document.body.style.overflow = 'hidden';
    });
  }
  if (closeBtn && mobileNav) {
    closeBtn.addEventListener('click', function () {
      mobileNav.classList.remove('open');
      document.body.style.overflow = '';
    });
  }
  if (mobileNav) {
    mobileNav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        mobileNav.classList.remove('open');
        document.body.style.overflow = '';
      });
    });
  }

  // --- Filtres galerie ---
  var filterBtns = document.querySelectorAll('.filter-btn');
  var galleryItems = document.querySelectorAll('.gallery-item');
  if (filterBtns.length && galleryItems.length) {
    filterBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        filterBtns.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var cat = btn.getAttribute('data-filter');
        galleryItems.forEach(function (item) {
          var match = cat === 'all' || item.getAttribute('data-cat') === cat;
          item.style.display = match ? '' : 'none';
        });
      });
    });
  }

  // --- Lightbox ---
  var lightbox = document.querySelector('.lightbox');
  if (lightbox) {
    var lbImg = lightbox.querySelector('img');
    var lbCap = lightbox.querySelector('.lightbox-cap');
    var lbClose = lightbox.querySelector('.lightbox-close');
    document.querySelectorAll('[data-lightbox]').forEach(function (trigger) {
      trigger.addEventListener('click', function () {
        var src = trigger.getAttribute('data-lightbox');
        var cap = trigger.getAttribute('data-caption') || '';
        lbImg.src = src;
        lbImg.alt = cap;
        lbCap.textContent = cap;
        lightbox.classList.add('open');
      });
    });
    function closeLb() { lightbox.classList.remove('open'); lbImg.src = ''; }
    if (lbClose) lbClose.addEventListener('click', closeLb);
    lightbox.addEventListener('click', function (e) {
      if (e.target === lightbox) closeLb();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeLb();
    });
  }

  // --- Formulaire de devis : cascade Formule -> Livraison/Retrait -> Pays -> Mondial Relay ---
  var form = document.querySelector('.devis-form');
  if (form) {
    var formuleSelect = document.getElementById('formule');
    var receptionModeField = document.getElementById('reception-mode-field');
    var receptionModeSelect = document.getElementById('reception-mode');
    var paysRow = document.getElementById('pays-row');
    var paysSelect = document.getElementById('pays-livraison');
    var mondialRelayField = document.getElementById('mondial-relay-field');

    function isBiscuitsFormule() {
      return !!formuleSelect && formuleSelect.value === 'Biscuits personnalisés (sans mise en scène)';
    }

    function updateCascade() {
      var showReception = isBiscuitsFormule();
      if (receptionModeField) receptionModeField.hidden = !showReception;
      if (!showReception && receptionModeSelect) receptionModeSelect.value = '';

      var showPays = showReception && receptionModeSelect && receptionModeSelect.value === 'livraison';
      if (paysRow) paysRow.hidden = !showPays;
      if (!showPays && paysSelect) paysSelect.value = '';

      var showMondialRelay = showPays && paysSelect && paysSelect.value === 'france';
      if (mondialRelayField) mondialRelayField.hidden = !showMondialRelay;
      if (showMondialRelay) {
        initMondialRelayWidget();
      }
    }

    if (formuleSelect) formuleSelect.addEventListener('change', updateCascade);
    if (receptionModeSelect) receptionModeSelect.addEventListener('change', updateCascade);
    if (paysSelect) paysSelect.addEventListener('change', updateCascade);
    updateCascade();

    // --- Pré-remplissage depuis un package biscuits (?formule=biscuits&theme=...&quantite=...) ---
    (function prefillFromPackage() {
      var params = new URLSearchParams(window.location.search);
      var formuleParam = params.get('formule');
      var themeParam = params.get('theme');
      var quantiteParam = params.get('quantite');
      if (!formuleParam && !themeParam && !quantiteParam) return;

      if (formuleParam === 'biscuits' && formuleSelect) {
        formuleSelect.value = 'Biscuits personnalisés (sans mise en scène)';
        updateCascade();
      }
      var themeField = document.getElementById('theme');
      if (themeParam && themeField) themeField.value = themeParam;
      var quantiteField = document.getElementById('quantite');
      if (quantiteParam && quantiteField) quantiteField.value = quantiteParam;

      var note = document.getElementById('prefill-note');
      if (note && themeParam) {
        note.textContent = 'Vos informations pour le package « ' + themeParam + ' » ont été reprises ci-dessous. Vous pouvez les modifier avant l’envoi.';
        note.hidden = false;
      }
    })();

    // --- Mondial Relay : sélection du Point Relais / Locker (France) ---
    // Nécessite un compte professionnel Mondial Relay et son "ID Enseigne" (Brand ID).
    // Voir la note technique dans la documentation du projet pour la mise en service complète.
    var MONDIAL_RELAY_BRAND_ID = ''; // <-- à renseigner une fois le compte pro obtenu (ex. "CC12345")
    var mondialRelayWidgetLoaded = false;

    function initMondialRelayWidget() {
      var fallback = document.getElementById('mondial-relay-fallback');
      var widgetZone = document.getElementById('mondial-relay-widget-zone');
      if (!widgetZone) return;

      if (!MONDIAL_RELAY_BRAND_ID) {
        // Pas d'identifiants configurés : on affiche le message de repli, pas de fausse sélection.
        if (fallback) fallback.style.display = '';
        return;
      }

      if (mondialRelayWidgetLoaded || typeof window.jQuery === 'undefined') return;
      mondialRelayWidgetLoaded = true;
      if (fallback) fallback.style.display = 'none';

      window.jQuery('#mondial-relay-widget-zone').MR_ParcelShopPicker({
        Target: '#mondial-relay-id',
        TargetDisplay: '#mondial-relay-address',
        Brand: MONDIAL_RELAY_BRAND_ID,
        Country: 'FR',
        Responsive: true,
        ShowResultsOnMap: true,
        OnParcelShopSelected: function (data) {
          var addrField = document.getElementById('mondial-relay-address');
          if (addrField && data) {
            addrField.value = [data.Nom, data.Adresse1, data.CP, data.Ville].filter(Boolean).join(', ');
          }
        }
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var success = document.querySelector('.form-success');
      if (success) {
        success.classList.add('show');
        success.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      form.reset();
      updateCascade();
    });
  }

  // --- Année automatique dans le footer ---
  document.querySelectorAll('[data-year]').forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  // --- Animations au scroll (fade + léger déplacement) ---
  // Progressive enhancement : sans JS ou avec IntersectionObserver indisponible,
  // ou si l'utilisateur préfère moins d'animations, le contenu reste simplement visible
  // (la classe .reveal-init, seule à porter l'opacité 0, n'est ajoutée qu'ici).
  var prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!prefersReducedMotion && 'IntersectionObserver' in window) {
    var staggerGroups = [
      { selector: '.value-card', max: 5, step: 80 },
      { selector: '.formule-card', max: 4, step: 90 },
      { selector: '.testi-card', max: 4, step: 90 },
      { selector: '.event-card', max: 5, step: 70 },
      { selector: '.why-item', max: 4, step: 90 },
      { selector: '.gallery-item', max: 7, step: 55 },
      { selector: '.home-gallery-strip .scallop-frame', max: 5, step: 70 },
      { selector: '.timeline li', max: 5, step: 90 }
    ];
    var mediaSelectors = ['.hero-media', '.univers-media', '.about-photo', '.home-gallery-strip .scallop-frame'];
    var soloSelectors = [
      '.hero-copy', '.section-head', '.page-intro > .wrap', '.cta-final',
      '.univers-layout > div:not(.univers-media)', '.contact-info-card', 'form.devis-form',
      '.about-top', '.about-bottom', '.objectif-box', '.bottom-band'
    ];

    var revealTargets = new Map(); // element -> delayMs

    staggerGroups.forEach(function (group) {
      var byParent = new Map();
      document.querySelectorAll(group.selector).forEach(function (el) {
        var parent = el.parentElement;
        if (!byParent.has(parent)) byParent.set(parent, []);
        byParent.get(parent).push(el);
      });
      byParent.forEach(function (els) {
        els.forEach(function (el, i) {
          revealTargets.set(el, Math.min(i, group.max) * group.step);
        });
      });
    });

    soloSelectors.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) {
        if (!revealTargets.has(el)) revealTargets.set(el, 0);
      });
    });

    if (revealTargets.size) {
      var revealObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            revealObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.1, rootMargin: '0px 0px -10% 0px' });

      var mediaSelectorList = mediaSelectors.join(',');
      revealTargets.forEach(function (delay, el) {
        el.classList.add('reveal-init');
        if (el.matches(mediaSelectorList)) el.classList.add('reveal-media');
        if (delay) el.style.transitionDelay = delay + 'ms';
        revealObserver.observe(el);
      });

      // Filet de sécurité : rien ne doit rester invisible indéfiniment
      // (ex. élément masqué par un filtre au moment de l'observation).
      setTimeout(function () {
        document.querySelectorAll('.reveal-init:not(.in-view)').forEach(function (el) {
          el.classList.add('in-view');
        });
      }, 6000);
    }
  }
});
