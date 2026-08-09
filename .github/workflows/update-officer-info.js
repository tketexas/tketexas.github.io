// Bakes the current officer name/phone/Instagram info directly into
// contact/index.html and rush/index.html at build time, so those pages
// paint with correct, current content immediately - no flash while
// sheet-content.js's live JS fetch/cache completes. That live script
// still runs afterward as before, so anything that's changed in the
// Sheet more recently than this workflow's last run still gets picked
// up - this just shrinks how often that catch-up is ever visible, from
// "every single page load" down to "only if the Sheet changed within
// the last hour".
//
// Deliberately does NOT touch the officer photos (background-image
// style) - that's handled by the separate update-officer-photos.js
// workflow, since photos need actual file downloads rather than text
// edits.
//
// Run by the scheduled GitHub Actions workflow (see
// .github/workflows/update-officer-info.yml) - not meant to be run
// manually, though it's safe to if you want to force an update early.

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ENDPOINT = 'https://script.google.com/macros/s/PASTE_YOUR_DEPLOYMENT_ID_HERE/exec';

const PAGES = [
  { name: 'contact', filePath: path.join(__dirname, '..', '..', 'contact', 'index.html'), apply: applyContact },
  { name: 'rush', filePath: path.join(__dirname, '..', '..', 'rush', 'index.html'), apply: applyRush }
];

// ---- Field logic, intentionally mirroring sheet-content.js's
// applyContact()/applyRush() exactly, minus the image/ChapterBuilder
// parts (images: handled by the other workflow; ChapterBuilder: its
// live query-param behavior only makes sense while someone is actively
// typing, not something to bake into a static file). ----

function setName(el, name) {
  if (!el || !name) return;
  el.textContent = name;
}

function applyContact(document, data) {
  if (!data) return;

  setName(document.getElementById('ised9w'), data.name);

  const phoneLink = document.getElementById('iudsit');
  if (phoneLink) {
    if (data.phone) {
      phoneLink.textContent = data.phone;
      phoneLink.setAttribute('title', data.phone);
    }
    if (data.phoneLink) {
      phoneLink.setAttribute('href', data.phoneLink);
    }
  }
}

function applyRush(document, data) {
  if (!data) return;

  const name = document.getElementById('ik2cwb');
  if (name && data.name) {
    // Original markup is "Name<br/>" - rebuild it that way rather than
    // clobbering the trailing line break with a plain text write.
    name.textContent = '';
    name.appendChild(document.createTextNode(data.name));
    name.appendChild(document.createElement('br'));
  }

  setName(document.getElementById('irushofficername'), data.heroName);

  const phoneLink = document.getElementById('i3k75l');
  if (phoneLink) {
    if (data.phone) {
      phoneLink.textContent = data.phone;
      phoneLink.setAttribute('title', data.phone);
    }
    if (data.phoneLink) {
      phoneLink.setAttribute('href', data.phoneLink);
    }
  }

  const igLink = document.getElementById('izsax5');
  if (igLink) {
    if (data.instagramHandle) {
      igLink.textContent = data.instagramHandle;
    }
    if (data.instagramLink) {
      igLink.setAttribute('href', data.instagramLink);
    }
  }
}

// ---- Driver ----

async function main() {
  console.log('Fetching officer info from:', ENDPOINT);
  const res = await fetch(ENDPOINT, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error('Officer info request failed: ' + res.status);
  }
  const data = await res.json();

  let anyUpdated = false;

  for (const page of PAGES) {
    const pageData = data[page.name];
    if (!pageData) {
      console.log('[' + page.name + '] No data for this page in the sheet response - skipping.');
      continue;
    }

    const originalHtml = fs.readFileSync(page.filePath, 'utf8');
    const dom = new JSDOM(originalHtml);

    page.apply(dom.window.document, pageData);

    const updatedHtml = dom.serialize();

    if (updatedHtml === originalHtml) {
      console.log('[' + page.name + '] No change.');
      continue;
    }

    fs.writeFileSync(page.filePath, updatedHtml);
    console.log('[' + page.name + '] Updated ' + page.filePath);
    anyUpdated = true;
  }

  console.log(anyUpdated ? 'Done - at least one page was updated.' : 'Done - nothing needed updating.');
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
