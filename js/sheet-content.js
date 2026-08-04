/* ============================================================
   TKE Texas — Live officer info from Google Sheets
   Fetches a small JSON payload from the Apps Script Web App and
   swaps in the name / phone / Instagram / photo on the Contact
   and Rush pages.

   LOADING NOTE: this file is meant to be included WITHOUT the
   `defer` attribute, placed early in <head> (see setup notes) -
   that lets the fetch() below fire immediately as the browser
   reaches this tag, in parallel with the rest of the page loading,
   instead of waiting for the whole page to finish parsing first.
   The actual DOM writes are still safely postponed until the page
   is ready, via the ready() helper below.
   ============================================================ */
(function () {
  // TODO: paste the /exec URL you get after deploying the Apps Script
  // Web App (see AppsScript-Code.gs setup notes).
  var ENDPOINT = 'https://script.google.com/macros/s/AKfycbxGfurcdj2zHqoUkbKqJUK6Q8GEEfWVKnbIiWdYDTHszalBrJTXfpzXPyOPoMxyKUkI/exec';

  // Start the request the instant this script executes - don't wait on
  // anything else. This is the main lever for making the very first,
  // uncached load feel faster: the browser can be off fetching this
  // JSON (and then the image behind it) while it's still downloading
  // fonts, other CSS, etc.
  var dataPromise = fetch(ENDPOINT, { cache: 'no-store' })
    .then(function (res) {
      if (!res.ok) throw new Error('Sheet content request failed: ' + res.status);
      return res.json();
    })
    .catch(function (err) {
      // Fail quietly - the page keeps whatever static text/image was
      // already in the HTML, so a Sheets outage never breaks the page.
      console.error('Sheet content fetch failed:', err);
      return null;
    });

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

    // Same officer name, repeated inline in the hero paragraph
    // ("Contact our Rush Chair, <name here>, or Fill out the Form
    // Bellow:") - see the HTML snippet that wraps this in its own span.
    setName(document.getElementById('irushofficername'), data.name);

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

  ready(function () {
    dataPromise.then(function (data) {
      if (!data) return;
      // Each apply function checks for its own elements, so calling
      // both here is a harmless no-op on whichever page doesn't have
      // that content.
      applyContact(data.contact);
      applyRush(data.rush);
    });
  });
})();
