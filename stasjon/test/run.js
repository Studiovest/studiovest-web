'use strict';
// Ende-til-ende-test uten kamera: simulert kamera, velg navn i listen, bilder, samtykkestopp, usortert, RAW+JPG, opplasting.
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { start } = require('../src/server');
const naming = require('../src/naming');
const { largestJpeg } = require('../src/preview');

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
    ok(ls(cfg.unsortedDir).length === 1, 'bilde uten valgt person havner i «usortert»');

    // skann Emma, tre bilder
    const r = await api('/api/select', { code: 'FJT-4B-7K2Q' });
    ok(r.ok && r.person.name === 'Emma Haugland' && !r.blocked, 'klikk på Emma i listen velger henne');
    for (let i = 0; i < 3; i++) { await api('/api/shoot', null); await wait(150); }
    await wait(1500);
    const lib = ls(cfg.libraryDir);
    ok(lib.includes(path.join('FJT2026', '4B', 'FJT-4B-7K2Q_0001.jpg')) && lib.includes(path.join('FJT2026', '4B', 'FJT-4B-7K2Q_0003.jpg')), 'tre bilder navngitt _0001 til _0003 i FJT2026/4B');
    ok(lib.filter(f => f.endsWith('.xmp')).length === 3, 'XMP-sidefil med koden ved hvert bilde');
    ok(fs.readFileSync(path.join(cfg.libraryDir, 'FJT2026/4B/FJT-4B-7K2Q_0001.jpg.xmp'), 'utf8').includes('<dc:identifier>FJT-4B-7K2Q</dc:identifier>'), 'koden står i metadata (dc:identifier)');
    ok(ls(cfg.backupDir).filter(f => f.endsWith('.jpg')).length === 3, 'kopi av hvert bilde på backup-disken');
    await wait(2000);
    const up0 = await api('/api/state');
    ok(ls(path.join(path.dirname(cfg.libraryDir), 'lastet-opp')).length === 0 && up0.uploads.waiting === 3 && up0.uploads.mode === 'etterpå', 'ingenting lastes opp under fotograferingen, 3 venter på PC-en');
    ok(up0.people.find(p => p.code === 'FJT-4B-7K2Q').shots.map(s => s.seq).join() === '1,2,3', 'galleriet viser Emmas tre bilder');

    // favoritt og forkast
    await api('/api/mark', { code: 'FJT-4B-7K2Q', seq: 2, fav: true });
    await api('/api/mark', { code: 'FJT-4B-7K2Q', seq: 3, rejected: true });
    const mk = (await api('/api/state')).people.find(p => p.code === 'FJT-4B-7K2Q').shots;
    ok(mk[1].fav && mk[2].rejected && (await api('/api/state')).uploads.waiting === 2, 'favoritt merkes, forkastet bilde tas ut av opplastingen');
    ok(fs.readFileSync(path.join(cfg.libraryDir, 'FJT2026/4B/FJT-4B-7K2Q_0002.jpg.xmp'), 'utf8').includes('<xmp:Rating>5</xmp:Rating>') && fs.readFileSync(path.join(cfg.libraryDir, 'FJT2026/4B/FJT-4B-7K2Q_0003.jpg.xmp'), 'utf8').includes('<xmp:Rating>-1</xmp:Rating>'), 'favoritt (5) og forkastet (-1) står i XMP for Lightroom/Capture One');

    // RAW-forhåndsvisning: innebygd JPG hentes ut av RAW-filen
    const jpgBuf = fs.readFileSync(path.join(cfg.libraryDir, 'FJT2026/4B/FJT-4B-7K2Q_0001.jpg'));
    const fakeRaw = Buffer.concat([Buffer.alloc(4096), jpgBuf, Buffer.alloc(2048)]);
    ok(Buffer.compare(largestJpeg(fakeRaw), jpgBuf) === 0, 'henter innebygd JPG ut av en RAW-fil');
    fs.writeFileSync(path.join(cfg.incomingDir, 'DSC07777.ARW'), fakeRaw); await wait(1500);
    const rawShot = (await api('/api/state')).people.find(p => p.code === 'FJT-4B-7K2Q').shots.find(s => s.files.some(f => f.rel.endsWith('.arw')));
    const pv = await fetch('http://127.0.0.1:7499/bilde?rel=' + encodeURIComponent(rawShot.view));
    ok(rawShot && rawShot.view && pv.ok && (await pv.arrayBuffer()).byteLength === jpgBuf.length, 'bilde tatt bare i RAW vises med en gang i galleriet');

    // RAW + JPG fra samme utløsning får samme nummer
    fs.copyFileSync(path.join(cfg.libraryDir, 'FJT2026/4B/FJT-4B-7K2Q_0001.jpg'), path.join(cfg.incomingDir, 'DSC09999.ARW'));
    fs.copyFileSync(path.join(cfg.libraryDir, 'FJT2026/4B/FJT-4B-7K2Q_0001.jpg'), path.join(cfg.incomingDir, 'DSC09999.JPG'));
    await wait(1500);
    const lib2 = ls(cfg.libraryDir);
    ok(lib2.includes(path.join('FJT2026', '4B', 'FJT-4B-7K2Q_0005.arw')) && lib2.includes(path.join('FJT2026', '4B', 'FJT-4B-7K2Q_0005.jpg')), 'RAW og JPG fra samme bilde får samme nummer (_0005)');
    ok((await api('/api/state')).people.find(p => p.code === 'FJT-4B-7K2Q').shots.length === 5, 'RAW + JPG vises som ett bilde i galleriet');

    // klikk på neste navn -> Emma blir ferdig av seg selv
    const rn = await api('/api/select', { code: 'FJT-1A-7K2Q' });
    let st0 = await api('/api/state');
    ok(rn.ok && st0.current === 'FJT-1A-7K2Q' && st0.people.find(p => p.code === 'FJT-4B-7K2Q').status === 'Ferdig', 'klikk på neste navn gjør Emma ferdig og velger Nora');
    await api('/api/shoot', null); await wait(1200);
    ok(ls(cfg.libraryDir).includes(path.join('FJT2026', '1A', 'FJT-1A-7K2Q_0001.jpg')), 'neste bilde havner hos Nora');

    // Ferdig-knappen: hopper over barn uten samtykke
    const dn = await api('/api/done', null);
    ok(dn.ok && !dn.next, 'Ferdig hopper over barn uten samtykke (ingen igjen)');

    // samtykke nei -> karantene, ikke lastet opp
    const rb = await api('/api/select', { code: 'FJT-4B-9752' });
    ok(rb.blocked === 'Foresatte har svart nei', 'Ella gir stopp: foresatte har svart nei');
    await api('/api/shoot', null); await wait(1200);
    ok(ls(cfg.quarantineDir).length === 1 && !ls(cfg.libraryDir).some(f => f.includes('9752')), 'bilde av Ella lagt i karantene, ikke i biblioteket');

    // ukjent kode
    const ru = await api('/api/select', { code: 'XYZ' });
    ok(!ru.ok, 'ukjent person avvises');

    // hjemme: last opp nå
    const before = (await api('/api/state')).uploads.waiting;
    await api('/api/sync', {}); await wait(4000);
    const st = await api('/api/state'), uploaded = ls(path.join(path.dirname(cfg.libraryDir), 'lastet-opp'));
    ok(before === 6 && st.uploads.waiting === 0 && uploaded.length === 6 && !uploaded.some(f => f.includes('_0003')), '«Last opp nå» laster opp alt unntatt forkastet bilde');
    ok(st.people.find(p => p.code === 'FJT-4B-7K2Q').status === 'Ferdig' && st.people.find(p => p.code === 'FJT-1A-7K2Q').status === 'Ferdig', 'status: Emma og Nora ferdig');
    ok(fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8').includes('/api/events'), 'stasjonsskjermen henter hendelser live');
  } finally { app.close(); }

  // omstart midt på dagen: galleri, favoritter og status er der fortsatt
  await wait(300);
  const app2 = await start(cfg);
  try {
    const st2 = await api('/api/state'), emma = st2.people.find(p => p.code === 'FJT-4B-7K2Q');
    ok(emma.status === 'Ferdig' && emma.shots.length === 5 && emma.shots[1].fav && emma.shots[2].rejected, 'etter omstart: galleri, favoritter og status er tatt vare på');
  } finally { app2.close(); }
  console.log(`\n${pass} tester bestått`);
  fs.rmSync(tmp, { recursive: true, force: true });
  process.exit(0);
})().catch(e => { console.error('FEIL:', e.message); process.exit(1); });
