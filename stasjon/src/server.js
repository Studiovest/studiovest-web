'use strict';
// Studiovest Stasjon: lokal server + skjerm i nettleseren på stasjons-PC-en (http://localhost:7420).
const fs = require('fs');
const path = require('path');
const http = require('http');
const { Session } = require('./session');
const { Uploader } = require('./uploader');
const drivers = require('./drivers');

function loadConfig(argv) {
  const root = path.join(__dirname, '..');
  const file = fs.existsSync(path.join(root, 'config.json')) ? path.join(root, 'config.json') : path.join(root, 'config.example.json');
  const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const a of argv) { const m = /^--(\w+)=(.*)$/.exec(a); if (m) cfg[m[1]] = m[2]; }
  for (const k of ['incomingDir', 'libraryDir', 'backupDir', 'quarantineDir', 'unsortedDir', 'rosterFile', 'simSource']) if (cfg[k]) cfg[k] = path.resolve(root, cfg[k]);
  cfg.port = Number(cfg.port) || 7420;
  return cfg;
}

function start(cfg) {
  const uploader = new Uploader(cfg);
  const session = new Session(cfg, uploader);
  const driver = drivers.create(cfg.driver, cfg, f => session.ingest(f));
  const clients = new Set();
  function broadcast(obj) { const s = 'data: ' + JSON.stringify(obj) + '\n\n'; clients.forEach(r => r.write(s)); }
  session.on('event', e => broadcast(e));
  uploader.on('uploaded', item => { session.note('Lastet opp · ' + item.rel); broadcast({ type: 'state' }); });
  uploader.on('failed', (item, e) => { session.note('Venter på nett · ' + item.rel + ' (' + e.message + ')', 'warn'); });

  const pub = path.join(__dirname, '..', 'public');
  function json(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); }
  function body(req) { return new Promise(r => { let b = ''; req.on('data', d => { b += d; if (b.length > 1e5) req.destroy(); }); req.on('end', () => { try { r(JSON.parse(b || '{}')); } catch (e) { r({}); } }); }); }

  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://localhost');
    try {
      if (req.method === 'GET' && (u.pathname === '/' || u.pathname === '/index.html')) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return fs.createReadStream(path.join(pub, 'index.html')).pipe(res); }
      if (req.method === 'GET' && u.pathname === '/api/state') { const st = session.state(); st.camera = await driver.status(); st.driver = driver.label; st.canTrigger = driver.canTrigger; return json(res, 200, st); }
      if (req.method === 'GET' && u.pathname === '/api/events') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' }); res.write(': ok\n\n');
        clients.add(res); req.on('close', () => clients.delete(res)); return;
      }
      if (req.method === 'POST' && u.pathname === '/api/scan') { const b = await body(req); return json(res, 200, session.scan(b.code)); }
      if (req.method === 'POST' && u.pathname === '/api/done') return json(res, 200, session.done());
      if (req.method === 'POST' && u.pathname === '/api/absent') { const b = await body(req); return json(res, 200, session.absent(b.code)); }
      if (req.method === 'POST' && u.pathname === '/api/shoot') {
        if (!driver.canTrigger) return json(res, 400, { ok: false, error: 'Bruk utløseren på kameraet' });
        return json(res, 200, { ok: true, file: await driver.trigger() });
      }
      if (req.method === 'GET' && u.pathname === '/bilde') {
        const rel = u.searchParams.get('rel') || '', f = path.resolve(cfg.libraryDir, rel);
        if (!f.startsWith(cfg.libraryDir + path.sep) || !fs.existsSync(f) || !/\.jpe?g$/i.test(f)) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store' }); return fs.createReadStream(f).pipe(res);
      }
      res.writeHead(404); res.end();
    } catch (e) { json(res, 500, { ok: false, error: e.message }); }
  });
  return new Promise(r => server.listen(cfg.port, '127.0.0.1', () => r({ server, session, uploader, driver, close() { driver.stop(); uploader.stop(); clients.forEach(c => c.end()); server.close(); } })));
}

if (require.main === module) {
  const cfg = loadConfig(process.argv.slice(2));
  start(cfg).then(() => console.log(`Studiovest Stasjon kjører: http://localhost:${cfg.port}  (kamera: ${cfg.driver})`));
}

module.exports = { start, loadConfig };
