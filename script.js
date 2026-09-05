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
      function openLb() {
        var src = trigger.getAttribute('data-lightbox');
        var cap = trigger.getAttribute('data-caption') || '';
        lbImg.src = src;
        lbImg.alt = cap;
        lbCap.textContent = cap;
        lightbox.classList.add('open');
      }
      trigger.addEventListener('click', openLb);
      // Les déclencheurs ne sont pas des <button> : on rétablit
      // l'ouverture au clavier pour ceux qui portent un tabindex.
      trigger.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault();
          openLb();
        }
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

    // --- Liste des thèmes : visible uniquement pour un anniversaire ---
    var evenementSelect = document.getElementById('type-evenement');
    var themeAnnivRow = document.getElementById('theme-anniversaire-row');
    var themeAnnivSelect = document.getElementById('theme-anniversaire');

    function updateThemeAnniversaire() {
      if (!themeAnnivRow || !evenementSelect) return;
      var isAnniversaire = evenementSelect.value === 'Anniversaire';
      themeAnnivRow.hidden = !isAnniversaire;
      if (!isAnniversaire && themeAnnivSelect) themeAnnivSelect.value = '';
    }

    if (evenementSelect) evenementSelect.addEventListener('change', updateThemeAnniversaire);
    updateThemeAnniversaire();

    // --- Pré-remplissage depuis une catégorie ou un thème
    //     (?formule=biscuits&evenement=...&theme=...) ---
    (function prefillFromCategory() {
      var params = new URLSearchParams(window.location.search);
      var formuleParam = params.get('formule');
      var evenementParam = params.get('evenement');
      var themeParam = params.get('theme');
      var quantiteParam = params.get('quantite');
      if (!formuleParam && !evenementParam && !themeParam && !quantiteParam) return;

      /* La formule arrive soit sous le mot-cl\u00e9 \u00ab biscuits \u00bb, soit sous le
         nom d'une micro-sc\u00e9nographie (\u00ab Mini Signature \u00bb). Dans les deux
         cas on cherche l'option qui commence par ce nom, plut\u00f4t que de
         recopier ici des libell\u00e9s qui portent aussi un prix : le jour o\u00f9
         un tarif change, la liste reste seule \u00e0 modifier. */
      var formuleRetenue = null;
      if (formuleParam && formuleSelect) {
        var vise = formuleParam === 'biscuits'
          ? 'Biscuits personnalis\u00e9s (sans mise en sc\u00e8ne)'
          : formuleParam;
        Array.prototype.forEach.call(formuleSelect.options, function (o) {
          if (formuleRetenue) return;
          if (o.value === vise || o.value.indexOf(vise + ' \u2014 ') === 0) {
            formuleSelect.value = o.value;
            formuleRetenue = o.value;
          }
        });
        updateCascade();
      }

      // L'\u00e9v\u00e9nement n'est repris que s'il existe r\u00e9ellement dans la liste.
      var evenementRetenu = null;
      if (evenementParam && evenementSelect) {
        var valeurs = Array.prototype.map.call(evenementSelect.options, function (o) { return o.value; });
        if (valeurs.indexOf(evenementParam) !== -1) {
          evenementSelect.value = evenementParam;
          evenementRetenu = evenementParam;
          updateThemeAnniversaire();
        }
      }

      /* Un th\u00e8me d'anniversaire va dans sa liste d\u00e9roulante. Les autres
         th\u00e8mes ouvrent le message : le champ \u00ab Th\u00e8me / couleurs \u00bb a \u00e9t\u00e9
         retir\u00e9 du formulaire, et un th\u00e8me perdu vaudrait moins qu'un
         message d\u00e9j\u00e0 amorc\u00e9. */
      var themeRetenu = null;
      if (themeParam) {
        var placeDansListe = false;
        if (themeAnnivSelect && themeAnnivRow && !themeAnnivRow.hidden) {
          var themes = Array.prototype.map.call(themeAnnivSelect.options, function (o) { return o.value; });
          if (themes.indexOf(themeParam) !== -1) {
            themeAnnivSelect.value = themeParam;
            placeDansListe = true;
          }
        }
        if (!placeDansListe) {
          var messageField = document.getElementById('message');
          if (messageField && !messageField.value) {
            messageField.value = 'Th\u00e8me souhait\u00e9 : ' + themeParam + '.\n';
          }
        }
        themeRetenu = themeParam;
      }

      var quantiteField = document.getElementById('quantite');
      if (quantiteParam && quantiteField) quantiteField.value = quantiteParam;

      var note = document.getElementById('prefill-note');
      if (note && (evenementRetenu || themeRetenu || formuleRetenue)) {
        var morceaux = [];
        if (formuleRetenue) morceaux.push('Formule s\u00e9lectionn\u00e9e : ' + formuleRetenue.split(' \u2014 ')[0]);
        if (evenementRetenu) morceaux.push(evenementRetenu);
        if (themeRetenu) morceaux.push('th\u00e8me ' + themeRetenu);
        note.textContent = morceaux.join(' \u2014 ') +
          '. Votre demande a \u00e9t\u00e9 pr\u00e9-remplie ci-dessous, vous pouvez la modifier avant l\u2019envoi.';
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

    /* --- Envoi de la demande de devis ---
       La demande part vers une fonction Netlify qui l'envoie par e-mail.
       Rien n'est annoncé comme envoyé avant que le serveur l'ait confirmé :
       un « merci » affiché sur une demande perdue serait pire que
       l'absence de formulaire. */
    var succes = document.querySelector('.form-success');
    var echec = document.querySelector('.form-erreur');
    var bouton = form.querySelector('button[type=submit]');
    var libelleBouton = bouton ? bouton.textContent : '';
    var ouvertureFormulaire = Date.now();
    var MAX_IMAGE = 3 * 1024 * 1024;

    function afficherEchec(texte, html) {
      if (!echec) return;
      if (html) echec.innerHTML = texte; else echec.textContent = texte;
      echec.classList.add('show');
      echec.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    /* Les champs du formulaire, tels quels. La fonction serveur ne
       retient que ceux qu'elle attend : inutile de trier ici. */
    function releverChamps() {
      var donnees = {};
      Array.prototype.forEach.call(form.elements, function (champ) {
        if (!champ.name || champ.type === 'file' || champ.type === 'submit') return;
        if (champ.closest('[hidden]')) return;   // un champ masqué n'a pas été rempli
        var v = (champ.value || '').trim();
        if (v) donnees[champ.name] = v;
      });
      return donnees;
    }

    /* L'image d'inspiration voyage en base64 avec la demande. */
    function lireImage() {
      var champ = document.getElementById('inspiration');
      var fichier = champ && champ.files && champ.files[0];
      if (!fichier) return Promise.resolve(null);
      if (fichier.size > MAX_IMAGE) {
        return Promise.reject(new Error('image_trop_lourde'));
      }
      return new Promise(function (resoudre) {
        var lecteur = new FileReader();
        lecteur.onload = function () {
          var brut = String(lecteur.result);
          resoudre({ nom: fichier.name, type: fichier.type, contenu: brut.slice(brut.indexOf(',') + 1) });
        };
        lecteur.onerror = function () { resoudre(null); };
        lecteur.readAsDataURL(fichier);
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (succes) succes.classList.remove('show');
      if (echec) echec.classList.remove('show');

      var manquants = [];
      [['prenom', 'Prénom'], ['nom', 'Nom'], ['email', 'E-mail'], ['message', 'Votre message']]
        .forEach(function (paire) {
          var champ = document.getElementById(paire[0]);
          if (champ && !champ.value.trim()) manquants.push(paire[1]);
        });
      var evenement = document.getElementById('type-evenement');
      if (evenement && !evenement.value) manquants.push("Type d'événement");
      var courriel = document.getElementById('email');
      if (courriel && courriel.value.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(courriel.value.trim())) {
        manquants.push('une adresse e-mail valide');
      }
      if (manquants.length) {
        afficherEchec('Merci de renseigner : ' + manquants.join(', ') + '.');
        return;
      }

      if (bouton) { bouton.disabled = true; bouton.textContent = 'Envoi en cours…'; }

      lireImage().then(function (fichier) {
        return fetch('/.netlify/functions/envoyer-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'devis',
            donnees: releverChamps(),
            fichier: fichier,
            piege: (form.elements['site-web'] || {}).value || '',
            dureeSaisie: Date.now() - ouvertureFormulaire
          })
        });
      }).then(function (r) {
        // Une réponse illisible (page 404 d'un hébergeur sans fonctions,
        // par exemple) ne doit pas être annoncée comme un succès.
        return r.text().then(function (txt) {
          var data = {};
          try { data = JSON.parse(txt); } catch (err) { data = { erreur: 'smtp_non_configure' }; }
          return { ok: r.ok, statut: r.status, data: data };
        });
      }).then(function (res) {
        if (bouton) { bouton.disabled = false; bouton.textContent = libelleBouton; }

        if (res.ok && res.data.ok) {
          if (succes) {
            succes.classList.add('show');
            succes.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          form.reset();
          ouvertureFormulaire = Date.now();
          updateCascade();
          updateThemeAnniversaire();
          return;
        }

        if (res.statut === 503 || res.statut === 404 || res.data.erreur === 'smtp_non_configure') {
          afficherEchec('L’envoi automatique n’est pas encore activé. Écrivez-moi directement à ' +
            '<a href="mailto:info@jolie-creation.com">info@jolie-creation.com</a> ou ' +
            '<a href="https://api.whatsapp.com/send/?phone=41783127545&amp;text&amp;type=phone_number&amp;app_absent=0" target="_blank" rel="noopener">sur WhatsApp</a>.', true);
        } else {
          afficherEchec(res.data.message || 'Votre demande n’a pas pu être envoyée. Merci de réessayer.');
        }
      }).catch(function (err) {
        if (bouton) { bouton.disabled = false; bouton.textContent = libelleBouton; }
        if (err && err.message === 'image_trop_lourde') {
          afficherEchec('Votre image dépasse 3 Mo. Choisissez-en une plus légère, ou envoyez-la-moi séparément.');
          return;
        }
        afficherEchec('Connexion impossible. Vérifiez votre connexion et réessayez, ou écrivez-moi à ' +
          '<a href="mailto:info@jolie-creation.com">info@jolie-creation.com</a>.', true);
      });
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
      { selector: '.folio-item', max: 6, step: 45 },
      { selector: '.home-gallery-strip .scallop-frame', max: 5, step: 70 },
      { selector: '.timeline li', max: 5, step: 90 }
    ];
    var mediaSelectors = ['.hero-media', '.univers-media', '.about-photo', '.home-gallery-strip .scallop-frame'];
    // Arrivée depuis la gauche, légèrement décalée pour passer après le
    // reste du hero (qui, lui, monte).
    var leftSelectors = ['.hero-question'];
    var soloSelectors = [
      '.hero-copy', '.section-head', '.page-intro > .wrap', '.cta-final',
      '.univers-layout > div:not(.univers-media)', '.contact-info-card', 'form.devis-form',
      '.about-top', '.about-bottom', '.objectif-box', '.bottom-band'
    ].concat(leftSelectors);

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
      var leftSelectorList = leftSelectors.join(',');
      revealTargets.forEach(function (delay, el) {
        el.classList.add('reveal-init');
        if (el.matches(mediaSelectorList)) el.classList.add('reveal-media');
        if (el.matches(leftSelectorList)) {
          el.classList.add('reveal-left');
          if (!delay) delay = 220;
        }
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
