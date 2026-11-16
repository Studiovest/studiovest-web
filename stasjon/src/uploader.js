'use strict';
// Opplasting til portalen med kø som tåler at nettet faller ut.
// Køen lagres på disk, så ingenting går tapt om PC-en slås av midt på dagen.
//
// uploadMode:
//   «etterpå» (standard): ingenting lastes opp under fotograferingen. Alt ligger trygt på PC-en og SSD-en.
//       Opplastingen starter når du trykker «Last opp nå», eller av seg selv når PC-en er på et kjent wifi (syncWifi).
//   «med-en-gang»: lastes opp fortløpende når det er nett.
// JPG lastes opp før RAW, så galleriene i portalen fylles raskt.
// Uten portalUrl kjøres «lokal» modus: filene kopieres til data/lastet-opp (for test).
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const { currentSsid } = require('./wifi');

class Uploader extends EventEmitter {
  constructor(cfg) {
    super();
    this.cfg = cfg;
    this.mode = cfg.uploadMode === 'med-en-gang' ? 'med-en-gang' : 'etterpå';
    this.wifiList = (Array.isArray(cfg.syncWifi) ? cfg.syncWifi : String(cfg.syncWifi || '').split(',')).map(s => s.trim()).filter(Boolean);
    this.file = path.join(path.dirname(cfg.libraryDir), 'utboks.json');
    this.queue = fs.existsSync(this.file) ? JSON.parse(fs.readFileSync(this.file, 'utf8')) : [];
    this.done = 0; this.busy = false; this.offline = false; this.syncing = false; this.ssid = null; this.current = null;
    this.timer = setInterval(() => this.pump(), 1500);
    this.timer.unref && this.timer.unref();
    if (this.wifiList.length) {
      this.wifiTimer = setInterval(() => this.checkWifi(), 30000);
      this.wifiTimer.unref && this.wifiTimer.unref();
      this.checkWifi();
    }
  }
  persist() { fs.writeFileSync(this.file, JSON.stringify(this.queue, null, 1)); }
  enqueue(photo, meta) {
    if (this.queue.some(q => q.file === photo.file)) return;
    let size = 0; try { size = fs.statSync(photo.file).size; } catch (e) { /* tas med likevel */ }
    this.queue.push({ file: photo.file, rel: photo.rel, meta, size, tries: 0, next: 0 });
    this.persist(); this.pump();
  }
  remove(file) {
    const n = this.queue.length; this.queue = this.queue.filter(q => q.file !== file);
    if (this.queue.length !== n) this.persist();
  }
  active() { return this.mode === 'med-en-gang' || this.syncing; }
  start(why) { if (!this.syncing) { this.syncing = true; this.emit('sync', why || 'manuelt'); } this.pump(); }
  pause() { this.syncing = false; this.emit('sync', 'pause'); }
  async checkWifi() {
    this.ssid = await currentSsid();
    if (this.ssid && this.wifiList.includes(this.ssid) && this.queue.length && !this.syncing) this.start('wifi: ' + this.ssid);
  }
  stats() {
    return {
      waiting: this.queue.length, bytes: this.queue.reduce((a, q) => a + (q.size || 0), 0), done: this.done, offline: this.offline,
      mode: this.mode, syncing: this.syncing, active: this.active(), ssid: this.ssid, wifi: this.wifiList,
      target: this.cfg.portalUrl ? 'portal' : 'lokal'
    };
  }

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
    if (this.busy || !this.queue.length || !this.active()) return;
    const now = Date.now(), ready = this.queue.filter(q => now >= q.next);
    const item = ready.find(q => /\.jpe?g$/i.test(q.file)) || ready[0];
    if (!item) return;
    this.busy = true;
    try {
      await this.send(item);
      this.queue = this.queue.filter(q => q !== item); this.done++; this.offline = false; this.persist();
      this.emit('uploaded', item);
      if (!this.queue.length && this.syncing) { this.syncing = false; this.emit('sync', 'ferdig'); }
    } catch (e) {
      item.tries++; item.next = Date.now() + Math.min(60000, 2000 * Math.pow(2, item.tries)); this.offline = true; this.persist();
      this.emit('failed', item, e);
    } finally { this.busy = false; }
    if (this.queue.length && this.active()) setImmediate(() => this.pump());
  }
  stop() { clearInterval(this.timer); clearInterval(this.wifiTimer); }
}

module.exports = { Uploader };
