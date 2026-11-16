'use strict';
// Kameradrivere. Alle leverer nye bilder som filer i innkommende-mappen; Session tar resten.
//  folder    – virker med alle kamera: produsentens gratis tether-program (Sony Imaging Edge /
//              Remote, Canon EOS Utility, Nikon NX Tether) eller et minnekort-/wifi-overføring
//              lagrer i innkommende-mappen. Ingen kamerakode i det hele tatt.
//  gphoto2   – direkte via USB-kabelen med libgphoto2 (åpen kildekode, Linux/macOS).
//              Kameraets egen utløser brukes; bildene lastes rett ned.
//  simulator – for test uten kamera.
const fs = require('fs');
const path = require('path');
const { spawn, execFile } = require('child_process');
const { PHOTO_EXT } = require('./session');

// Venter til filen er ferdig skrevet (samme størrelse to ganger på rad) før den tas inn.
function watchFolder(dir, onFile) {
  const seen = new Map(); let stopped = false;
  async function tick() {
    if (stopped) return;
    let names = [];
    try { names = await fs.promises.readdir(dir); } catch (e) { names = []; }
    for (const n of names) {
      if (!PHOTO_EXT.test(n) || n.startsWith('.')) continue;
      const f = path.join(dir, n);
      let st; try { st = await fs.promises.stat(f); } catch (e) { continue; }
      const prev = seen.get(f);
      if (prev && prev.size === st.size && prev.mtime === st.mtimeMs && st.size > 0) {
        seen.delete(f);
        try { await onFile(f); } catch (e) { console.error('Kunne ikke ta inn', n, e.message); }
      } else seen.set(f, { size: st.size, mtime: st.mtimeMs });
    }
    setTimeout(tick, 350);
  }
  tick();
  return { stop() { stopped = true; } };
}

function folderDriver(cfg, onFile) {
  const w = watchFolder(cfg.incomingDir, onFile);
  return { name: 'folder', label: 'Mappe: ' + cfg.incomingDir, canTrigger: false, stop: () => w.stop(), status: async () => ({ connected: true, camera: 'Kamera via produsentens tether-program' }) };
}

function gphoto2Driver(cfg, onFile) {
  const w = watchFolder(cfg.incomingDir, onFile);
  const bin = cfg.gphoto2 || 'gphoto2';
  let proc = null, camera = null, restarting = null;
  function start() {
    proc = spawn(bin, ['--capture-tethered', '--keep-raw', '--force-overwrite', '--filename', path.join(cfg.incomingDir, '%f.%C')], { stdio: ['ignore', 'pipe', 'pipe'] });
    proc.stderr.on('data', d => { const s = String(d); if (/no camera found|could not claim/i.test(s)) camera = null; });
    proc.on('exit', () => { proc = null; if (!restarting) restarting = setTimeout(() => { restarting = null; start(); }, 3000); });
    proc.on('error', () => { proc = null; });
  }
  start();
  return {
    name: 'gphoto2', label: 'USB-kabel (libgphoto2)', canTrigger: false,
    stop() { if (restarting) clearTimeout(restarting); restarting = true; if (proc) proc.kill(); w.stop(); },
    status: () => new Promise(res => execFile(bin, ['--auto-detect'], { timeout: 4000 }, (err, out) => {
      if (err) return res({ connected: false, camera: 'gphoto2 mangler eller kamera ikke funnet' });
      const line = String(out).split('\n').slice(2).find(l => l.trim()); camera = line ? line.split(/\s{2,}/)[0] : null;
      res({ connected: !!camera && !!proc, camera: camera || 'Ingen kamera tilkoblet' });
    }))
  };
}

function simulatorDriver(cfg, onFile) {
  const w = watchFolder(cfg.incomingDir, onFile);
  const src = cfg.simSource || path.join(__dirname, '..', '..', 'portal', 'img', 'kids');
  let n = 0;
  return {
    name: 'simulator', label: 'Simulert kamera', canTrigger: true,
    stop: () => w.stop(),
    status: async () => ({ connected: true, camera: 'Simulert kamera' }),
    async trigger() {
      const files = fs.readdirSync(src).filter(f => /\.jpe?g$/i.test(f));
      const pick = files[n % files.length]; n++;
      const name = 'DSC' + String(5000 + n).padStart(5, '0') + '.JPG';
      const tmp = path.join(cfg.incomingDir, '.' + name);
      await fs.promises.copyFile(path.join(src, pick), tmp);
      await fs.promises.rename(tmp, path.join(cfg.incomingDir, name));
      return name;
    }
  };
}

function create(name, cfg, onFile) {
  if (name === 'gphoto2') return gphoto2Driver(cfg, onFile);
  if (name === 'simulator') return simulatorDriver(cfg, onFile);
  return folderDriver(cfg, onFile);
}

module.exports = { create, watchFolder };
