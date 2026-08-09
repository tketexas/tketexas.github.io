// Downloads the current Contact and Rush officer photos from the same
// Google Sheet-backed endpoint sheet-content.js already uses, and
// overwrites the static fallback image files in the repo with them -
// so GitHub Pages serves an actually-current photo instantly on a cold
// first visit, with no JS/network round-trip needed, instead of the
// blank white placeholder.
//
// Run by the scheduled GitHub Actions workflow (see
// .github/workflows/update-officer-photos.yml) - not meant to be run
// manually, though it's safe to if you want to force an update early.

const fs = require('fs');
const path = require('path');

// Same public endpoint sheet-content.js already calls - no credentials
// needed, this is read-only public data.
const ENDPOINT = 'https://script.google.com/macros/s/AKfycbxGfurcdj2zHqoUkbKqJUK6Q8GEEfWVKnbIiWdYDTHszalBrJTXfpzXPyOPoMxyKUkI/exec';

// Reject anything smaller than this as probably a broken/error response
// rather than a real photo - guards against a transient failure
// overwriting a good existing file with garbage.
const MIN_VALID_IMAGE_BYTES = 2000;

const TARGETS = [
  { field: 'contact', filePath: path.join(__dirname, '..', '..', 'contact', 'assets', 'prytanis.jpg') },
  { field: 'rush', filePath: path.join(__dirname, '..', '..', 'rush', 'assets', 'rushchair.png') }
];

async function main() {
  console.log('Fetching officer info from:', ENDPOINT);
  const res = await fetch(ENDPOINT, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error('Officer info request failed: ' + res.status);
  }
  const data = await res.json();

  let anyUpdated = false;

  for (const target of TARGETS) {
    const imageUrl = data[target.field] && data[target.field].image;
    if (!imageUrl) {
      console.log('[' + target.field + '] No image URL in sheet data - skipping, leaving existing file as-is.');
      continue;
    }

    console.log('[' + target.field + '] Downloading:', imageUrl);
    let imgRes;
    try {
      imgRes = await fetch(imageUrl);
    } catch (err) {
      console.log('[' + target.field + '] Download failed (' + err.message + ') - skipping, leaving existing file as-is.');
      continue;
    }

    if (!imgRes.ok) {
      console.log('[' + target.field + '] Download returned HTTP ' + imgRes.status + ' - skipping, leaving existing file as-is.');
      continue;
    }

    const contentType = imgRes.headers.get('content-type') || '';
    if (contentType.indexOf('image/') !== 0) {
      console.log('[' + target.field + '] Response was not an image (content-type: ' + contentType + ') - skipping, leaving existing file as-is.');
      continue;
    }

    const buffer = Buffer.from(await imgRes.arrayBuffer());
    if (buffer.length < MIN_VALID_IMAGE_BYTES) {
      console.log('[' + target.field + '] Downloaded file suspiciously small (' + buffer.length + ' bytes) - skipping, leaving existing file as-is.');
      continue;
    }

    fs.mkdirSync(path.dirname(target.filePath), { recursive: true });
    fs.writeFileSync(target.filePath, buffer);
    console.log('[' + target.field + '] Wrote ' + buffer.length + ' bytes to ' + target.filePath);
    anyUpdated = true;
  }

  console.log(anyUpdated ? 'Done - at least one file was updated.' : 'Done - nothing needed updating.');
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
