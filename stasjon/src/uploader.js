'use strict';
// Opplasting til portalen med kø som tåler at nettet faller ut.
// Køen lagres på disk, så ingenting går tapt om PC-en slås av midt på dagen.
// Uten portalUrl kjøres «lokal» modus: filene kopieres til data/lastet-opp (for test).
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

class Uploader extends EventEmitter {
  constructor(cfg) {
    super();
    this.cfg = cfg;
    this.file = path.join(path.dirname(cfg.libraryDir), 'utboks.json');
    this.queue = fs.existsSync(this.file) ? JSON.parse(fs.readFileSync(this.file, 'utf8')) : [];
    this.done = 0; this.busy = false; this.offline = false;
    this.timer = setInterval(() => this.pump(), 1500);
    this.timer.unref && this.timer.unref();
  }
  persist() { fs.writeFileSync(this.file, JSON.stringify(this.queue, null, 1)); }
  enqueue(photo, meta) {
    this.queue.push({ file: photo.file, rel: photo.rel, meta, tries: 0, next: 0 });
    this.persist(); this.pump();
    this._photo = this._photo || new Map(); this._photo.set(photo.file, photo);
  }
  stats() { return { waiting: this.queue.length, done: this.done, offline: this.offline, mode: this.cfg.portalUrl ? 'portal' : 'lokal' }; }

  async send(item) {
    if (!this.cfg.portalUrl) {
      const dst = path.join(path.dirname(this.cfg.libraryDir), 'lastet-opp', item.rel);
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      await fs.promises.copyFile(item.file, dst);
      return;
    }
    const url = this.cfg.portalUrl.replace(/\/$/, '') + '/api/stasjon/bilder?' + new URLSearchParams({ kode: item.meta.code, nr: String(item.meta.seq), sha256: item.meta.sha256, stasjon: item.meta.station, fil: path.basename(item.rel) });
    const body = await fs.promises.readFile(item.file);
    const res = await fetch(url, { method: 'PUT', body, headers: { 'Content-Type': 'application/octet-stream', 'Authorization': 'Bearer ' + this.cfg.portalToken } });
    if (!res.ok) throw new Error('Portal svarte ' + res.status);
  }

  async pump() {
    if (this.busy || !this.queue.length) return;
    const item = this.queue[0];
    if (Date.now() < item.next) return;
    this.busy = true;
    try {
      await this.send(item);
      this.queue.shift(); this.done++; this.offline = false; this.persist();
      const p = this._photo && this._photo.get(item.file); if (p) p.upload = 'lastet opp';
      this.emit('uploaded', item);
    } catch (e) {
      item.tries++; item.next = Date.now() + Math.min(60000, 2000 * Math.pow(2, item.tries)); this.offline = true; this.persist();
      this.emit('failed', item, e);
    } finally { this.busy = false; }
    if (this.queue.length) setImmediate(() => this.pump());
  }
  stop() { clearInterval(this.timer); }
}

module.exports = { Uploader };
