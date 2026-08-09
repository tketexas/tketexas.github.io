/* ============================================================
   TKE Texas — Live officer info from Google Sheets
   Fetches a small JSON payload from the Apps Script Web App and
   swaps in the name / phone / Instagram / photo on the Contact
   and Rush pages.

   SITE-WIDE + CACHED: this file is meant to be included on EVERY
   page, not just Contact and Rush. Pages without matching elements
   (index, history, donate, alumni, privacy) get no visible effect -
   applyContact()/applyRush() below are no-ops there - but they DO
   still warm the cache (both the JSON data in localStorage, and the
   two photos in the browser's own image cache) in the background, so
   that by the time a visitor actually reaches Contact or Rush, that
   page can paint instantly from cache instead of waiting on a fresh
   network round-trip.

   Strategy is "stale-while-revalidate": cached data (if any) is
   applied to the page immediately, then a fresh copy is fetched in
   the background and applied again once it arrives (and re-cached),
   so pages never wait on the network. Once the cache is fresher than
   CACHE_TTL_MS, that background refresh is skipped entirely on
   subsequent loads until it goes stale again.

   LOADING NOTE: this file is meant to be included WITHOUT the
   `defer` attribute, placed early in <head> (see setup notes) - that
   lets the cache read + fetch below fire immediately as the browser
   reaches this tag, in parallel with the rest of the page loading,
   instead of waiting for the whole page to finish parsing first. The
   actual DOM writes are still safely postponed until the page is
   ready, via the ready() helper below.
   ============================================================ */
(function () {
  // TODO: paste the /exec URL you get after deploying the Apps Script
  // Web App (see AppsScript-Code.gs setup notes).
  var ENDPOINT = 'https://script.google.com/macros/s/AKfycbxGfurcdj2zHqoUkbKqJUK6Q8GEEfWVKnbIiWdYDTHszalBrJTXfpzXPyOPoMxyKUkI/exec';

  var CACHE_KEY = 'tke_sheet_content_cache_v1';
  // How long a cached copy is trusted before a background refresh is
  // worth bothering with. Officer info/photos change rarely, so this
  // can comfortably be raised further if you want to cut down on Apps
  // Script calls even more; lower it if you want changes to show up
  // faster after editing the sheet.
  var CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

  function readCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.data || typeof parsed.ts !== 'number') return null;
      return parsed;
    } catch (e) {
      // Corrupt JSON, or localStorage unavailable (e.g. disabled by the
      // browser/user) - just behave as if there's no cache.
      return null;
    }
  }

  function writeCache(data) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ data: data, ts: Date.now() }));
    } catch (e) {
      // Storage full or unavailable - caching is a nice-to-have on top
      // of the live fetch, never something to fail loudly over.
    }
  }

  // Warm the browser's own HTTP cache for both photos, even on pages
  // that have nothing to display right now - creating an Image() and
  // setting its src starts the download immediately without needing
  // to be inserted into the document, so by the time someone actually
  // lands on Contact or Rush, the image bytes (not just the JSON URL)
  // are already sitting in cache.
  function prefetchImages(data) {
    if (!data) return;
    if (data.contact && data.contact.image) { new Image().src = data.contact.image; }
    if (data.rush && data.rush.image) { new Image().src = data.rush.image; }
  }

  function fetchFresh() {
    return fetch(ENDPOINT, { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('Sheet content request failed: ' + res.status);
        return res.json();
      })
      .catch(function (err) {
        // Fail quietly - the page keeps whatever static/cached content
        // it already has, so a Sheets outage never breaks the page.
        console.error('Sheet content fetch failed:', err);
        return null;
      });
  }

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  function setName(el, name) {
    if (!el || !name) return;
    el.textContent = name;
  }

  function applyContact(data) {
    if (!data) return;

    setName(document.getElementById('ised9w'), data.name);

    var phoneLink = document.getElementById('iudsit');
    if (phoneLink) {
      if (data.phone) {
        phoneLink.textContent = data.phone;
        phoneLink.setAttribute('title', data.phone);
      }
      if (data.phoneLink) {
        phoneLink.setAttribute('href', data.phoneLink);
      }
    }

    var photo = document.getElementById('i2xget');
    if (photo && data.image) {
      photo.style.backgroundImage = "url('" + data.image + "')";
    }
  }

  function applyRush(data) {
    if (!data) return;

    var name = document.getElementById('ik2cwb');
    if (name && data.name) {
      // Original markup is "Name<br/>" - rebuild it that way rather than
      // clobbering the trailing line break with a plain text write.
      name.textContent = '';
      name.appendChild(document.createTextNode(data.name));
      name.appendChild(document.createElement('br'));
    }

    // Independent name field for the hero paragraph ("Contact our Rush
    // Chair, <name here>, or Fill out the Form Bellow:") - intentionally
    // separate from the officer card's name above, sourced from its own
    // sheet cell (Rush!J4) rather than reusing Rush!C4.
    setName(document.getElementById('irushofficername'), data.heroName);

    var phoneLink = document.getElementById('i3k75l');
    if (phoneLink) {
      if (data.phone) {
        phoneLink.textContent = data.phone;
        phoneLink.setAttribute('title', data.phone);
      }
      if (data.phoneLink) {
        phoneLink.setAttribute('href', data.phoneLink);
      }
    }

    var igLink = document.getElementById('izsax5');
    if (igLink) {
      if (data.instagramHandle) {
        igLink.textContent = data.instagramHandle;
      }
      if (data.instagramLink) {
        igLink.setAttribute('href', data.instagramLink);
      }
    }

    var photo = document.getElementById('iqj90y');
    if (photo && data.image) {
      photo.style.backgroundImage = "url('" + data.image + "')";
    }
  }

  function applyAll(data) {
    if (!data) return;
    // Each apply function checks for its own elements, so calling both
    // here is a harmless no-op on whichever page doesn't have that
    // content (which, on most pages, is both of them).
    applyContact(data.contact);
    applyRush(data.rush);
  }

  // ---------------- Main flow ----------------

  var cached = readCache();
  var cachedData = cached ? cached.data : null;
  var cacheAge = cached ? (Date.now() - cached.ts) : Infinity;
  var needsRefresh = !cached || cacheAge > CACHE_TTL_MS;

  // Start warming the image cache immediately - doesn't need the DOM.
  if (cachedData) {
    prefetchImages(cachedData);
  }

  // Kick off a background refresh immediately too, if the cache is
  // missing or stale. Runs in parallel with everything else on the page.
  var freshDataPromise = needsRefresh ? fetchFresh() : null;
  if (freshDataPromise) {
    freshDataPromise.then(function (freshData) {
      if (!freshData) return;
      writeCache(freshData);
      prefetchImages(freshData);
    });
  }

  ready(function () {
    // Paint instantly from cache first, if there is any - zero network
    // wait, regardless of which page this is or how slow the Apps
    // Script round-trip would otherwise be.
    if (cachedData) {
      applyAll(cachedData);
    }
    // Then update again in place once/if a fresh copy arrives, so the
    // page silently self-corrects if anything changed since the cache
    // was last written.
    if (freshDataPromise) {
      freshDataPromise.then(function (freshData) {
        if (freshData) applyAll(freshData);
      });
    }
  });
})();
