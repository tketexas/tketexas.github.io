/*!
 * TKE Texas — Cookie Consent & Preference Center
 * ------------------------------------------------
 * Self-contained, dependency-free consent manager.
 *
 * What it does:
 *   1. Shows a bottom bar on first visit with Accept All / Reject All / Customize.
 *   2. Stores the choice in localStorage (not a server, since this site is static).
 *   3. Gates the Google reCAPTCHA script on the Rush page behind "Functional"
 *      consent, so it never loads until the visitor has agreed to it.
 *   4. Leaves a permanent "Cookie Settings" link/button in the page footer
 *      so the choice can be changed at any time.
 *   5. Respects the browser's Global Privacy Control (GPC) signal if present.
 *
 * Adding a new category later (e.g. Analytics if Google Analytics is added):
 *   1. Add it to the CATEGORIES object below.
 *   2. Add a matching <div class="tke-cc-category"> block in buildModalBody().
 *   3. Gate the new script the same way initRecaptchaGate() gates reCAPTCHA,
 *      checking getConsent().analytics before injecting the <script> tag.
 */
(function () {
  'use strict';

  if (document.getElementById('tke-cc-root')) {
    return; // already initialized on this page
  }

  var STORAGE_KEY = 'tketexas_cookie_consent';
  var CONSENT_VERSION = 1; // bump this if the categories/policy change materially
  var PRIVACY_URL = '/privacy/';

  /* ----------------------------------------------------------------
   * Storage helpers
   * ---------------------------------------------------------------- */

  function readConsent() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== CONSENT_VERSION) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function writeConsent(functional, source) {
    var consent = {
      version: CONSENT_VERSION,
      necessary: true,
      functional: !!functional,
      timestamp: new Date().toISOString(),
      source: source || 'unknown'
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
    } catch (e) {
      /* localStorage unavailable (private browsing, storage disabled, etc).
         The site still works; the visitor will just be asked again next visit. */
    }
    try {
      document.dispatchEvent(new CustomEvent('tkeConsentChange', { detail: consent }));
    } catch (e) { /* older browsers without CustomEvent support: ignore */ }
    return consent;
  }

  function hasGPCSignal() {
    return navigator.globalPrivacyControl === true;
  }

  /* ----------------------------------------------------------------
   * DOM construction
   * ---------------------------------------------------------------- */

  var refs = {};

  function buildDOM() {
    var root = document.createElement('div');
    root.id = 'tke-cc-root';
    root.innerHTML =
      '<div id="tke-cc-banner" class="tke-cc-banner" role="region" aria-label="Cookie notice" hidden>' +
        '<div class="tke-cc-banner-inner">' +
          '<div class="tke-cc-banner-text">' +
            '<p class="tke-cc-banner-title">We value your privacy</p>' +
            '<p>This site uses necessary cookies/local storage to operate. With your permission, we\'d also like to use optional <strong>functional</strong> cookies (Google reCAPTCHA) to protect our Rush interest form from spam. See our <a class="tke-cc-link" href="' + PRIVACY_URL + '">Privacy &amp; Cookie Policy</a> for details.</p>' +
          '</div>' +
          '<div class="tke-cc-banner-actions">' +
            '<button type="button" class="tke-cc-btn tke-cc-btn-outline" data-tke-action="reject">Reject All</button>' +
            '<button type="button" class="tke-cc-btn tke-cc-btn-outline" data-tke-action="customize">Customize</button>' +
            '<button type="button" class="tke-cc-btn tke-cc-btn-solid" data-tke-action="accept">Accept All</button>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div id="tke-cc-overlay" class="tke-cc-overlay" hidden></div>' +
      '<div id="tke-cc-modal" class="tke-cc-modal" role="dialog" aria-modal="true" aria-labelledby="tke-cc-modal-title" tabindex="-1" hidden>' +
        '<div class="tke-cc-modal-inner">' +
          '<div class="tke-cc-modal-header">' +
            '<h2 id="tke-cc-modal-title">Cookie Preferences</h2>' +
            '<button type="button" class="tke-cc-close" id="tke-cc-modal-close" aria-label="Close cookie preferences">&times;</button>' +
          '</div>' +
          '<div class="tke-cc-modal-body">' +
            '<p class="tke-cc-modal-intro">Choose which optional cookies this site can use. Full details in our <a class="tke-cc-link" href="' + PRIVACY_URL + '">Privacy &amp; Cookie Policy</a>.</p>' +

            '<div class="tke-cc-category">' +
              '<div class="tke-cc-category-head">' +
                '<span class="tke-cc-category-name" id="tke-cc-necessary-label">Necessary</span>' +
                '<span class="tke-cc-toggle-locked" aria-hidden="true"><span class="tke-cc-toggle-label">Always On</span></span>' +
              '</div>' +
              '<p class="tke-cc-category-desc">Required for the site to work, like remembering this choice. Can&rsquo;t be turned off.</p>' +
            '</div>' +

            '<div class="tke-cc-category">' +
              '<div class="tke-cc-category-head">' +
                '<span class="tke-cc-category-name" id="tke-cc-functional-label">Functional</span>' +
                '<button type="button" role="switch" aria-checked="false" aria-labelledby="tke-cc-functional-label" id="tke-cc-functional-toggle" class="tke-cc-toggle"><span class="tke-cc-toggle-knob"></span></button>' +
              '</div>' +
              '<p class="tke-cc-category-desc">Loads Google reCAPTCHA on our Rush form to block spam. You can also enable it directly on the form if this is off.</p>' +
            '</div>' +
          '</div>' +
          '<div class="tke-cc-modal-footer">' +
            '<button type="button" class="tke-cc-btn tke-cc-btn-outline" data-tke-action="modal-reject">Reject All</button>' +
            '<button type="button" class="tke-cc-btn tke-cc-btn-solid" data-tke-action="modal-save">Save Preferences</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(root);

    refs.root = root;
    refs.banner = root.querySelector('#tke-cc-banner');
    refs.overlay = root.querySelector('#tke-cc-overlay');
    refs.modal = root.querySelector('#tke-cc-modal');
    refs.modalClose = root.querySelector('#tke-cc-modal-close');
    refs.functionalToggle = root.querySelector('#tke-cc-functional-toggle');

    root.addEventListener('click', handleRootClick);
    refs.functionalToggle.addEventListener('click', function () {
      var isOn = refs.functionalToggle.getAttribute('aria-checked') === 'true';
      refs.functionalToggle.setAttribute('aria-checked', isOn ? 'false' : 'true');
    });
    refs.modalClose.addEventListener('click', function () { closeModal(); });
    refs.overlay.addEventListener('click', function () { closeModal(); });
    document.addEventListener('keydown', handleGlobalKeydown);

    var footerBtn = document.getElementById('tke-footer-cookie-settings');
    if (footerBtn) {
      footerBtn.addEventListener('click', function () {
        openModal(footerBtn);
      });
    }
  }

  function handleRootClick(evt) {
    var target = evt.target.closest ? evt.target.closest('[data-tke-action]') : null;
    if (!target) return;
    var action = target.getAttribute('data-tke-action');
    switch (action) {
      case 'accept':
        applyDecision(true, 'banner-accept');
        break;
      case 'reject':
        applyDecision(false, 'banner-reject');
        break;
      case 'customize':
        openModal(target);
        break;
      case 'modal-reject':
        applyDecision(false, 'modal-reject');
        break;
      case 'modal-save':
        var isOn = refs.functionalToggle.getAttribute('aria-checked') === 'true';
        applyDecision(isOn, 'modal-save');
        break;
    }
  }

  function applyDecision(functional, source) {
    writeConsent(functional, source);
    closeModal();
    hideBanner();
    initRecaptchaGate();
  }

  /* ----------------------------------------------------------------
   * Banner show/hide
   * ---------------------------------------------------------------- */

  function showBanner() {
    refs.banner.hidden = false;
    var firstBtn = refs.banner.querySelector('[data-tke-action="reject"]');
    if (firstBtn) {
      // Move focus to the banner so screen reader / keyboard users notice it
      // immediately, without trapping focus (the rest of the page stays usable).
      try { firstBtn.focus({ preventScroll: true }); } catch (e) { firstBtn.focus(); }
    }
  }

  function hideBanner() {
    refs.banner.hidden = true;
  }

  /* ----------------------------------------------------------------
   * Modal (Customize / Preferences) — focus trap + ESC to close
   * ---------------------------------------------------------------- */

  var modalReturnFocusEl = null;

  function getFocusable(container) {
    var selector = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
    return Array.prototype.slice.call(container.querySelectorAll(selector)).filter(function (elm) {
      return elm.offsetParent !== null;
    });
  }

  function openModal(triggerEl) {
    modalReturnFocusEl = triggerEl || document.activeElement;

    var consent = readConsent();
    var functionalOn = !!(consent && consent.functional);
    refs.functionalToggle.setAttribute('aria-checked', functionalOn ? 'true' : 'false');

    refs.overlay.hidden = false;
    refs.modal.hidden = false;
    refs.banner.hidden = true;

    refs.modal.focus();
  }

  function closeModal() {
    if (refs.modal.hidden) return;
    refs.overlay.hidden = true;
    refs.modal.hidden = true;

    if (!readConsent()) {
      showBanner();
    }

    if (modalReturnFocusEl && document.body.contains(modalReturnFocusEl)) {
      try { modalReturnFocusEl.focus({ preventScroll: true }); } catch (e) { modalReturnFocusEl.focus(); }
    }
    modalReturnFocusEl = null;
  }

  function handleGlobalKeydown(evt) {
    if (refs.modal.hidden) return;

    if (evt.key === 'Escape' || evt.key === 'Esc') {
      closeModal();
      return;
    }

    if (evt.key === 'Tab') {
      var focusable = getFocusable(refs.modal);
      if (focusable.length === 0) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];

      if (evt.shiftKey && document.activeElement === first) {
        evt.preventDefault();
        last.focus();
      } else if (!evt.shiftKey && document.activeElement === last) {
        evt.preventDefault();
        first.focus();
      } else if (document.activeElement === refs.modal) {
        evt.preventDefault();
        first.focus();
      }
    }
  }

  /* ----------------------------------------------------------------
   * reCAPTCHA consent gate (Rush page)
   * Only runs anything if a .g-recaptcha element exists on the page.
   * ---------------------------------------------------------------- */

  function initRecaptchaGate() {
    var container = document.querySelector('.g-recaptcha');
    if (!container) return;

    var consent = readConsent();
    if (consent && consent.functional) {
      loadRecaptchaScript();
      var existingGate = document.getElementById('tke-cc-recaptcha-gate');
      if (existingGate) existingGate.parentNode.removeChild(existingGate);
      container.style.display = '';
      return;
    }

    if (document.getElementById('tke-cc-recaptcha-gate')) return;

    container.style.display = 'none';
    var gate = document.createElement('div');
    gate.id = 'tke-cc-recaptcha-gate';
    gate.className = 'tke-cc-recaptcha-gate';
    gate.innerHTML =
      '<p>This form uses Google reCAPTCHA to help block spam. Loading it requires enabling <strong>functional</strong> cookies.</p>' +
      '<button type="button" class="tke-cc-btn tke-cc-btn-solid" id="tke-cc-recaptcha-enable">Enable &amp; load reCAPTCHA</button>';
    container.parentNode.insertBefore(gate, container);

    document.getElementById('tke-cc-recaptcha-enable').addEventListener('click', function () {
      writeConsent(true, 'recaptcha-gate');
      gate.parentNode.removeChild(gate);
      container.style.display = '';
      loadRecaptchaScript();
      hideBanner();
      closeModal();
    });
  }

  function loadRecaptchaScript() {
    if (document.getElementById('tke-recaptcha-script')) return;
    var s = document.createElement('script');
    s.id = 'tke-recaptcha-script';
    s.src = 'https://www.google.com/recaptcha/api.js';
    s.async = true;
    s.defer = true;
    document.head.appendChild(s);
  }

  /* ----------------------------------------------------------------
   * Public API
   * ---------------------------------------------------------------- */

  window.TKECookieConsent = {
    open: function () { openModal(document.activeElement); },
    getConsent: readConsent,
    acceptAll: function () { applyDecision(true, 'api'); },
    rejectAll: function () { applyDecision(false, 'api'); }
  };

  /* ----------------------------------------------------------------
   * Init
   * ---------------------------------------------------------------- */

  function init() {
    if (document.getElementById('tke-cc-root')) return; // defensive: never build twice
    buildDOM();

    var consent = readConsent();

    if (!consent && hasGPCSignal()) {
      // Respect the browser-level opt-out signal: save a "necessary only"
      // choice quietly rather than interrupting with the full banner.
      consent = writeConsent(false, 'gpc-signal');
    }

    if (!consent) {
      showBanner();
    }

    initRecaptchaGate();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
