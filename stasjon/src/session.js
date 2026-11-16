'use strict';
// Kjernen i stasjonen: hvem står foran kamera, hva skjer med hver ny fil.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const EventEmitter = require('events');
const naming = require('./naming');
const { sidecar } = require('./xmp');

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
    this.lastRaw = {};
    ['incomingDir', 'libraryDir', 'backupDir', 'quarantineDir', 'unsortedDir'].forEach(k => ensureDir(cfg[k]));
    this.loadRoster();
  }

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

  scan(code) {
    const p = this.find(code);
    if (!p) { this.note(`Ukjent kode: ${code}`, 'warn'); return { ok: false, error: 'Ukjent kode' }; }
    this.current = p.code;
    if (this.status[p.code] !== 'Ferdig') this.status[p.code] = 'Pågår';
    const why = this.blockedReason(p);
    this.note(`Skannet ${p.code} · ${p.name}` + (why ? ` · STOPP: ${why}` : ''), why ? 'stop' : 'info');
    this.emit('event', { type: 'state' });
    return { ok: true, person: p, blocked: why };
  }

  done() {
    const p = this.find(this.current); if (!p) return { ok: false };
    this.status[p.code] = 'Ferdig'; this.current = null;
    this.note(`Ferdig · ${p.name} (${(this.photos[p.code] || []).length} bilder)`);
    const next = this.roster.find(x => !this.status[x.code] && !this.blockedReason(x));
    this.emit('event', { type: 'state' });
    return { ok: true, next: next || null };
  }

  absent(code) {
    const p = this.find(code || this.current); if (!p) return { ok: false };
    this.status[p.code] = 'Fravær'; if (this.current === p.code) this.current = null;
    this.note(`Fravær · ${p.name} får plass på omfotografering`);
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
      this.note(`Bilde uten skannet kode: ${original} lagt i «usortert»`, 'warn');
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

    const photo = { file: dst, rel: path.relative(this.cfg.libraryDir, dst), code: p.code, seq, sha256: hash, takenAt, upload: 'i kø' };
    (this.photos[p.code] = this.photos[p.code] || []).push(photo);
    this.note(`Nytt bilde · ${photo.rel}`);
    this.emit('event', { type: 'photo', photo });
    if (this.uploader) this.uploader.enqueue(photo, meta);
    return photo;
  }

  state() {
    return {
      station: this.cfg.station, session: this.session, template: this.cfg.template, current: this.current,
      people: this.roster.map(p => ({ ...p, status: this.status[p.code] || (this.blockedReason(p) ? 'Stopp' : 'Venter'), blocked: this.blockedReason(p), photos: (this.photos[p.code] || []).map(x => ({ rel: x.rel, seq: x.seq, upload: x.upload })) })),
      log: this.log.slice(0, 30),
      uploads: this.uploader ? this.uploader.stats() : null
    };
  }
}

module.exports = { Session, PHOTO_EXT };
