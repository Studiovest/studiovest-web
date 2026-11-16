'use strict';
// Forhåndsvisning uten eksterne pakker.
// JPG brukes som det er. RAW-filer (ARW, CR2, CR3, NEF, RAF, DNG …) har et innebygd JPG-bilde i full eller nesten
// full størrelse; vi finner det største og lagrer det i en hurtigbuffer, så RAW-only-fotografering også vises med en gang.
const fs = require('fs');
const path = require('path');

const JPG = /\.jpe?g$/i;

// Finn største sammenhengende JPG (FF D8 FF … FF D9) i bufferen.
function largestJpeg(buf) {
  let best = null, i = 0;
  while ((i = buf.indexOf(Buffer.from([0xff, 0xd8, 0xff]), i)) !== -1) {
    // gå gjennom JPG-segmentene til SOS, så let etter slutten (FF D9) i bildedataene
    let p = i + 2, ok = true;
    while (p + 4 <= buf.length) {
      if (buf[p] !== 0xff) { ok = false; break; }
      const m = buf[p + 1];
      if (m === 0xd8 || (m >= 0xd0 && m <= 0xd7) || m === 0x01 || m === 0xff) { p += (m === 0xff ? 1 : 2); continue; }
      const len = buf.readUInt16BE(p + 2);
      if (m === 0xda) { p += 2 + len; break; }
      p += 2 + len;
    }
    if (ok && p < buf.length) {
      // bildedata: FF etterfulgt av 00 eller RSTn hører til dataene; FF D9 = slutt
      const q = buf.indexOf(Buffer.from([0xff, 0xd9]), p);
      if (q !== -1) {
        const len = q + 2 - i;
        if (!best || len > best.len) best = { start: i, len };
      }
    }
    i += 3;
  }
  return best ? buf.subarray(best.start, best.start + best.len) : null;
}

// Returnerer sti til en JPG som kan vises for filen, eller null.
async function previewFor(file, cacheDir, rel) {
  if (JPG.test(file)) return file;
  const out = path.join(cacheDir, rel + '.jpg');
  if (fs.existsSync(out)) return out;
  const buf = await fs.promises.readFile(file);
  const jpg = largestJpeg(buf);
  if (!jpg || jpg.length < 20000) return null; // bare et lite miniatyrbilde: ikke godt nok til kontroll
  await fs.promises.mkdir(path.dirname(out), { recursive: true });
  await fs.promises.writeFile(out, jpg);
  return out;
}

module.exports = { previewFor, largestJpeg };
