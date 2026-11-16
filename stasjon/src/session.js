'use strict';
// Kjernen i stasjonen: hvem står foran kamera, hva skjer med hver ny fil.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const EventEmitter = require('events');
const naming = require('./naming');
const { sidecar } = require('./xmp');
const { previewFor } = require('./preview');

const PHOTO_EXT = /\.(jpe?g|arw|cr2|cr3|nef|raf|dng|orf|rw2|heic|tiff?)$/i;
const BLOCK = { 'Nei': 'Foresatte har svart nei', 'Ikke svart': 'Samtykke mangler', 'Kun gruppebilde': 'Bare gruppebilde, ikke portrett' };

function sha256(file) {
  return new Promise((res, rej) => {
    const h = crypto.createHash('sha256');
    fs.createReadStream(file).on('data', d => h.update(d)).on('end', () => res(h.digest('hex'))).on('error', rej);
  });
}
function ensureDir(d) { fs.mkdirSync(d, { recursive: true }); }
// flytt som tåler ulike disker (rename feiler mellom disker)
async function move(src, dst) {
  ensureDir(path.dirname(dst));
  try { await fs.promises.rename(src, dst); }
  catch (e) { if (e.code !== 'EXDEV') throw e; await fs.promises.copyFile(src, dst); await fs.promises.unlink(src); }
}
function uniquePath(p) {
  if (!fs.existsSync(p)) return p;
  const ext = path.extname(p), base = p.slice(0, -ext.length);
  for (let i = 2; ; i++) { const c = `${base}-${i}${ext}`; if (!fs.existsSync(c)) return c; }
}

class Session extends EventEmitter {
  constructor(cfg, uploader) {
    super();
    this.cfg = cfg; this.uploader = uploader;
    this.roster = []; this.current = null; this.seq = {}; this.status = {}; this.photos = {}; this.log = [];
    this.lastRaw = {}; this.flags = {};
    ['incomingDir', 'libraryDir', 'backupDir', 'quarantineDir', 'unsortedDir'].forEach(k => ensureDir(cfg[k]));
    this.previewDir = cfg.previewDir || path.join(path.dirname(cfg.libraryDir), 'forhandsvisning');
    this.stateFile = path.join(path.dirname(cfg.libraryDir), 'okt.json');
    this.loadRoster();
    this.restore();
  }

  // Dagen lagres på disk, så galleriet og statusene er der etter omstart eller tomt batteri.
  persist() {
    const data = { current: this.current, status: this.status, seq: this.seq, lastRaw: this.lastRaw, flags: this.flags, photos: this.photos };
    try { fs.writeFileSync(this.stateFile + '.tmp', JSON.stringify(data)); fs.renameSync(this.stateFile + '.tmp', this.stateFile); } catch (e) { /* neste lagring prøver igjen */ }
  }
  restore() {
    if (!fs.existsSync(this.stateFile)) return;
    try {
      const d = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
      Object.assign(this, { current: d.current || null, status: d.status || {}, seq: d.seq || {}, lastRaw: d.lastRaw || {}, flags: d.flags || {}, photos: d.photos || {} });
      const n = Object.values(this.photos).reduce((a, l) => a + l.length, 0);
      if (n) this.note(`Fortsetter dagen: ${n} filer fra før`);
    } catch (e) { this.note('Kunne ikke lese lagret dag, starter tomt', 'warn'); }
  }
  shotCount(code) { return new Set((this.photos[code] || []).map(x => x.seq)).size; }

  loadRoster() {
    const f = this.cfg.rosterFile;
    if (!fs.existsSync(f)) { this.roster = []; this.session = 'OKT'; return; }
    const data = JSON.parse(fs.readFileSync(f, 'utf8'));
    this.session = data.session || 'OKT';
    this.roster = (data.people || []).map(p => ({ code: String(p.code).toUpperCase(), name: p.name, group: p.group || '', consent: p.consent || 'Ja' }));
    this.note(`Liste lastet: ${this.roster.length} personer i ${this.session}`);
  }

  find(code) {
    const c = String(code || '').trim().toUpperCase();
    return this.roster.find(p => p.code === c) || null;
  }
  blockedReason(p) { return p ? BLOCK[p.consent] || null : null; }

  note(text, level) {
    const e = { t: new Date().toISOString(), text, level: level || 'info' };
    this.log.unshift(e); this.log = this.log.slice(0, 200);
    this.emit('event', { type: 'log', entry: e });
  }

  // Fotografen klikker på navnet i listen. Klikk på neste navn = forrige er ferdig (hvis det er tatt bilder).
  select(code) {
    const p = this.find(code);
    if (!p) { this.note(`Fant ikke personen: ${code}`, 'warn'); return { ok: false, error: 'Fant ikke personen' }; }
    const prev = this.find(this.current);
    if (prev && prev.code !== p.code && (this.photos[prev.code] || []).length && this.status[prev.code] !== 'Ferdig') {
      this.status[prev.code] = 'Ferdig';
      this.note(`Ferdig · ${prev.name} (${this.shotCount(prev.code)} bilder)`);
    }
    this.current = p.code;
    if (this.status[p.code] !== 'Ferdig') this.status[p.code] = 'Pågår';
    const why = this.blockedReason(p);
    this.note(`Valgt · ${p.name}` + (why ? ` · STOPP: ${why}` : ''), why ? 'stop' : 'info');
    this.persist();
    this.emit('event', { type: 'state' });
    return { ok: true, person: p, blocked: why };
  }

  done() {
    const p = this.find(this.current); if (!p) return { ok: false };
    this.status[p.code] = 'Ferdig'; this.current = null;
    this.note(`Ferdig · ${p.name} (${this.shotCount(p.code)} bilder)`);
    // neste i listen som ikke er tatt og kan fotograferes, velges med en gang
    const next = this.roster.find(x => !this.status[x.code] && !this.blockedReason(x));
    if (next) { this.current = next.code; this.status[next.code] = 'Pågår'; this.note(`Valgt · ${next.name}`); }
    this.persist();
    this.emit('event', { type: 'state' });
    return { ok: true, next: next || null };
  }

  absent(code) {
    const p = this.find(code || this.current); if (!p) return { ok: false };
    this.status[p.code] = 'Fravær'; if (this.current === p.code) this.current = null;
    this.note(`Fravær · ${p.name} får plass på omfotografering`);
    this.persist();
    this.emit('event', { type: 'state' });
    return { ok: true };
  }

  // Kalles av kameradriveren for hver ny fil (bilde fra kamera via kabel, eller fil i innkommende-mappen)
  async ingest(file) {
    const ext = path.extname(file);
    if (!PHOTO_EXT.test(ext)) return null;
    const original = path.basename(file);
    const hash = await sha256(file);
    const takenAt = new Date().toISOString();
    const p = this.find(this.current);

    // RAW+JPG fra samme utløsning skal få samme nummer
    const stem = original.slice(0, -ext.length).toLowerCase();
    let seq;
    if (p) {
      const key = p.code + '|' + stem;
      if (this.lastRaw[key]) seq = this.lastRaw[key];
      else { seq = this.seq[p.code] = (this.seq[p.code] || 0) + 1; this.lastRaw[key] = seq; }
    }

    if (!p) {
      const dst = uniquePath(path.join(this.cfg.unsortedDir, original));
      await move(file, dst);
      this.note(`Bilde uten valgt person: ${original} lagt i «usortert»`, 'warn');
      this.emit('event', { type: 'photo', photo: { file: dst, unsorted: true } });
      return { unsorted: dst };
    }

    const why = this.blockedReason(p);
    if (why) {
      const dst = uniquePath(path.join(this.cfg.quarantineDir, p.code + '_' + original));
      await move(file, dst);
      this.note(`Stoppet: ${original} av ${p.name} (${why}). Lagt i karantene, lastes ikke opp.`, 'stop');
      this.emit('event', { type: 'photo', photo: { file: dst, quarantined: true, code: p.code } });
      return { quarantined: dst };
    }

    const rel = naming.render(this.cfg.template, { session: this.session, group: p.group, code: p.code, name: p.name, seq, ext, station: this.cfg.station });
    const dst = uniquePath(path.join(this.cfg.libraryDir, rel));
    await move(file, dst);
    const meta = { code: p.code, name: p.name, group: p.group, session: this.session, station: this.cfg.station, seq, original, sha256: hash, takenAt };
    fs.writeFileSync(dst.replace(/\.[^.]+$/, '') + ext.toLowerCase() + '.xmp', sidecar(meta));
    // kopi nummer to, til ekstern disk
    const bdst = path.join(this.cfg.backupDir, path.relative(this.cfg.libraryDir, dst));
    ensureDir(path.dirname(bdst)); await fs.promises.copyFile(dst, bdst);

    const photo = { file: dst, rel: path.relative(this.cfg.libraryDir, dst), code: p.code, seq, sha256: hash, takenAt, upload: 'venter', meta };
    // RAW: hent det innebygde JPG-bildet, så det kan vises med en gang
    if (!/\.jpe?g$/i.test(dst)) { try { photo.preview = !!(await previewFor(dst, this.previewDir, photo.rel)); } catch (e) { photo.preview = false; } }
    (this.photos[p.code] = this.photos[p.code] || []).push(photo);
    const fl = this.flags[p.code + '|' + seq];
    if (fl && fl.rejected) photo.upload = 'forkastet';
    this.note(`Nytt bilde · ${photo.rel}`);
    this.emit('event', { type: 'photo', photo });
    if (this.uploader && photo.upload !== 'forkastet') this.uploader.enqueue(photo, meta);
    this.persist();
    return photo;
  }

  uploaded(file) {
    for (const l of Object.values(this.photos)) for (const f of l) if (f.file === file) f.upload = 'lastet opp';
    this.persist();
  }

  // Favoritt eller forkast for ett bilde (alle filene fra samme utløsning, RAW + JPG).
  // Forkastede lastes ikke opp. Kan angres så lenge bildet ikke er lastet opp.
  mark(code, seq, change) {
    const p = this.find(code); seq = Number(seq);
    const files = (this.photos[p && p.code] || []).filter(x => x.seq === seq);
    if (!p || !files.length) return { ok: false, error: 'Fant ikke bildet' };
    const key = p.code + '|' + seq, fl = this.flags[key] = Object.assign({ fav: false, rejected: false }, this.flags[key]);
    if ('fav' in change) { fl.fav = !!change.fav; if (fl.fav) fl.rejected = false; }
    if ('rejected' in change) { fl.rejected = !!change.rejected; if (fl.rejected) fl.fav = false; }
    for (const f of files) {
      if (fl.rejected && f.upload !== 'lastet opp') { if (this.uploader) this.uploader.remove(f.file); f.upload = 'forkastet'; }
      else if (!fl.rejected && f.upload === 'forkastet') { f.upload = 'venter'; if (this.uploader) this.uploader.enqueue(f, f.meta); }
      const meta = Object.assign({}, f.meta, { rating: fl.rejected ? -1 : fl.fav ? 5 : null });
      try { fs.writeFileSync(f.file + '.xmp', sidecar(meta)); } catch (e) { /* xmp er ikke kritisk */ }
    }
    const already = fl.rejected && files.some(f => f.upload === 'lastet opp');
    this.note(`${p.name} bilde ${seq}: ${fl.rejected ? 'forkastet' : fl.fav ? 'favoritt' : 'vanlig'}` + (already ? ' (var allerede lastet opp)' : ''));
    this.persist();
    this.emit('event', { type: 'state' });
    return { ok: true, flags: fl };
  }

  // Ett bilde = én utløsning. RAW + JPG vises som ett bilde (JPG-en, eller forhåndsvisningen fra RAW).
  shots(code) {
    const by = new Map();
    for (const f of this.photos[code] || []) {
      const s = by.get(f.seq) || { seq: f.seq, files: [], view: null, takenAt: f.takenAt };
      s.files.push({ rel: f.rel, upload: f.upload });
      if (/\.jpe?g$/i.test(f.rel)) s.view = f.rel; else if (!s.view && f.preview) s.view = f.rel;
      by.set(f.seq, s);
    }
    return [...by.values()].sort((a, b) => a.seq - b.seq).map(s => {
      const fl = this.flags[code + '|' + s.seq] || {};
      const up = s.files.every(f => f.upload === 'lastet opp') ? 'lastet opp' : s.files.some(f => f.upload === 'forkastet') ? 'forkastet' : 'venter';
      return { ...s, fav: !!fl.fav, rejected: !!fl.rejected, upload: up };
    });
  }

  state() {
    return {
      station: this.cfg.station, session: this.session, template: this.cfg.template, current: this.current,
      people: this.roster.map(p => ({ ...p, status: this.status[p.code] || (this.blockedReason(p) ? 'Stopp' : 'Venter'), blocked: this.blockedReason(p), shots: this.shots(p.code) })),
      log: this.log.slice(0, 30),
      uploads: this.uploader ? this.uploader.stats() : null
    };
  }
}

module.exports = { Session, PHOTO_EXT };
