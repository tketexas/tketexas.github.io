/* ============================================================
   TKE Texas — Live officer info from Google Sheets
   Fetches a small JSON payload from the Apps Script Web App and
   swaps in the name / phone / Instagram / photo on the Contact
   and Rush pages. Safe to include on every page: each block below
   checks the relevant element actually exists before touching it,
   so it's a no-op on pages that don't have that content.
   ============================================================ */
(function () {
  // TODO: paste the /exec URL you get after deploying the Apps Script
  // Web App (see AppsScript-Code.gs setup notes).
  var ENDPOINT = 'https://script.google.com/macros/s/AKfycbyU_LSSlpFxQhI90hNRw0hQTRZLEnFiLlSB8x2yfydctOdU6j7yZSSZfyI3nNzITQ/exec';

  function applyContact(data) {
    if (!data) return;

    var name = document.getElementById('ised9w');
    if (name && data.name) {
      name.textContent = data.name;
    }

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

  // Only bother fetching if this page actually has one of the target
  // elements - avoids a pointless network request on every other page.
  var isContactPage = !!document.getElementById('ised9w');
  var isRushPage = !!document.getElementById('ik2cwb');
  if (!isContactPage && !isRushPage) return;

  fetch(ENDPOINT)
    .then(function (res) {
      if (!res.ok) throw new Error('Sheet content request failed: ' + res.status);
      return res.json();
    })
    .then(function (data) {
      if (isContactPage) applyContact(data.contact);
      if (isRushPage) applyRush(data.rush);
    })
    .catch(function (err) {
      // Fail quietly - the page keeps whatever static text/image was
      // already in the HTML, so a Sheets outage never breaks the page.
      console.error('Sheet content fetch failed:', err);
    });
})();
