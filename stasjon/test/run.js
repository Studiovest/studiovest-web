'use strict';
// Ende-til-ende-test uten kamera: simulert kamera, skann, bilder, samtykkestopp, usortert, RAW+JPG, opplasting.
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { start } = require('../src/server');
const naming = require('../src/naming');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svstasjon-'));
const d = n => path.join(tmp, n);
fs.mkdirSync(d('data'), { recursive: true });
fs.writeFileSync(d('data/roster.json'), JSON.stringify({ session: 'FJT2026', people: [
  { code: 'FJT-4B-7K2Q', name: 'Emma Haugland', group: '4B', consent: 'Ja' },
  { code: 'FJT-4B-9752', name: 'Ella Tveit', group: '4B', consent: 'Nei' },
  { code: 'FJT-1A-7K2Q', name: 'Nora Haugland', group: '1A', consent: 'Ja' }
] }));
const cfg = { station: 'Stasjon 1', port: 7499, driver: 'simulator', template: '{skole}/{klasse}/{kode}_{nr}', portalUrl: '',
  incomingDir: d('data/inn'), libraryDir: d('data/bibliotek'), backupDir: d('data/backup'), quarantineDir: d('data/karantene'), unsortedDir: d('data/usortert'), rosterFile: d('data/roster.json') };
const wait = ms => new Promise(r => setTimeout(r, ms));
const api = (p, b) => fetch('http://127.0.0.1:7499' + p, { method: b === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json' }, body: b === undefined ? undefined : JSON.stringify(b) }).then(r => r.json());
const ls = dir => fs.existsSync(dir) ? fs.readdirSync(dir, { recursive: true }).filter(f => fs.statSync(path.join(dir, f)).isFile()).sort() : [];
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('  ✓ ' + m); };

(async () => {
  // naming
  ok(naming.render('{skole}/{klasse}/{kode}_{nr}', { session: 'FJT2026', group: '4B', code: 'FJT-4B-7K2Q', seq: 1, ext: '.JPG' }) === 'FJT2026/4B/FJT-4B-7K2Q_0001.jpg', 'filnavnmal gir FJT2026/4B/FJT-4B-7K2Q_0001.jpg');
  ok(naming.render('{etternavn}_{fornavn}_{nr}', { name: 'Ola Brekke', seq: 3, ext: '.jpg' }) === 'Brekke_Ola_0003.jpg', 'portrettdag-mal gir Brekke_Ola_0003.jpg');
  ok(!naming.render('../../{kode}', { code: 'X', seq: 1, ext: '.jpg' }).includes('..'), 'malen kan ikke skrive utenfor biblioteket');

  const app = await start(cfg);
  try {
    // bilde uten skannet kode -> usortert
    await api('/api/shoot', null); await wait(1200);
    ok(ls(cfg.unsortedDir).length === 1, 'bilde uten skannet kode havner i «usortert»');

    // skann Emma, tre bilder
    const r = await api('/api/scan', { code: 'fjt-4b-7k2q' });
    ok(r.ok && r.person.name === 'Emma Haugland' && !r.blocked, 'skanning (små bokstaver) finner Emma');
    for (let i = 0; i < 3; i++) { await api('/api/shoot', null); await wait(150); }
    await wait(1500);
    const lib = ls(cfg.libraryDir);
    ok(lib.includes(path.join('FJT2026', '4B', 'FJT-4B-7K2Q_0001.jpg')) && lib.includes(path.join('FJT2026', '4B', 'FJT-4B-7K2Q_0003.jpg')), 'tre bilder navngitt _0001 til _0003 i FJT2026/4B');
    ok(lib.filter(f => f.endsWith('.xmp')).length === 3, 'XMP-sidefil med koden ved hvert bilde');
    ok(fs.readFileSync(path.join(cfg.libraryDir, 'FJT2026/4B/FJT-4B-7K2Q_0001.jpg.xmp'), 'utf8').includes('<dc:identifier>FJT-4B-7K2Q</dc:identifier>'), 'koden står i metadata (dc:identifier)');
    ok(ls(cfg.backupDir).filter(f => f.endsWith('.jpg')).length === 3, 'kopi av hvert bilde på backup-disken');
    await wait(3000);
    ok(ls(path.join(path.dirname(cfg.libraryDir), 'lastet-opp')).filter(f => f.endsWith('.jpg')).length === 3, 'alle tre er lastet opp (lokal testmodus)');

    // RAW + JPG fra samme utløsning får samme nummer
    fs.copyFileSync(path.join(cfg.libraryDir, 'FJT2026/4B/FJT-4B-7K2Q_0001.jpg'), path.join(cfg.incomingDir, 'DSC09999.ARW'));
    fs.copyFileSync(path.join(cfg.libraryDir, 'FJT2026/4B/FJT-4B-7K2Q_0001.jpg'), path.join(cfg.incomingDir, 'DSC09999.JPG'));
    await wait(1500);
    const lib2 = ls(cfg.libraryDir);
    ok(lib2.includes(path.join('FJT2026', '4B', 'FJT-4B-7K2Q_0004.arw')) && lib2.includes(path.join('FJT2026', '4B', 'FJT-4B-7K2Q_0004.jpg')), 'RAW og JPG fra samme bilde får samme nummer (_0004)');

    // ferdig -> neste
    const dn = await api('/api/done', null);
    ok(dn.ok && dn.next && dn.next.name === 'Nora Haugland', 'Ferdig hopper over barn uten samtykke og foreslår Nora');

    // samtykke nei -> karantene, ikke lastet opp
    const rb = await api('/api/scan', { code: 'FJT-4B-9752' });
    ok(rb.blocked === 'Foresatte har svart nei', 'Ella gir stopp: foresatte har svart nei');
    await api('/api/shoot', null); await wait(1200);
    ok(ls(cfg.quarantineDir).length === 1 && !ls(cfg.libraryDir).some(f => f.includes('9752')), 'bilde av Ella lagt i karantene, ikke i biblioteket');

    // ukjent kode
    const ru = await api('/api/scan', { code: 'XYZ' });
    ok(!ru.ok, 'ukjent kode avvises');

    const st = await api('/api/state');
    ok(st.people.find(p => p.code === 'FJT-4B-7K2Q').status === 'Ferdig' && st.uploads.waiting === 0, 'status: Emma ferdig, ingen i opplastingskø');
    ok(fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8').includes('/api/events'), 'stasjonsskjermen henter hendelser live');
  } finally { app.close(); }
  console.log(`\n${pass} tester bestått`);
  fs.rmSync(tmp, { recursive: true, force: true });
  process.exit(0);
})().catch(e => { console.error('FEIL:', e.message); process.exit(1); });
