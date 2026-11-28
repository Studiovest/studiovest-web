/* Markeringer på bilder: punkt, pil og rektangel i valgfri stil, farge og størrelse.
   Lagres som en ny fil ved siden av originalen: 1.jpg → 1M.jpg, og vises i galleriet rett etter originalen.
   Markeringene lagres også som data, så de kan endres senere. Ekte drift: filen lastes opp til api/marks.php. */
(function () {
  'use strict';
  var SV = window.SV, esc = SV.esc, ic = SV.icon;
  var COLORS = [['#e53935', 'Rød'], ['#ffcc00', 'Gul'], ['#ff7a1a', 'Oransje'], ['#2e7cf6', 'Blå'], ['#2fa84f', 'Grønn'], ['#ffffff', 'Hvit'], ['#111111', 'Svart'], ['#8a5a3b', 'Studiovest-brun']];
  var STYLES = {
    pin: [['drop', 'Kartnål'], ['ring', 'Ring'], ['num', 'Nummer']],
    arrow: [['solid', 'Heltrukket'], ['dash', 'Stiplet'], ['block', 'Blokkpil']],
    rect: [['line', 'Linje'], ['dash', 'Stiplet'], ['fill', 'Fylt'], ['round', 'Avrundet']]
  };
  var TOOLS = [['select', 'Velg og flytt', 'pointer'], ['pin', 'Punkt', 'pin'], ['arrow', 'Pil', 'arrow'], ['rect', 'Rektangel', 'square']];

  // ---------- lagring ----------
  function marks(jobId) { var m = SV.state.marks = SV.state.marks || {}; return m[jobId] = m[jobId] || {}; }
  SV.markOf = function (jobId, i) { return (SV.state.marks || {})[jobId] && SV.state.marks[jobId][i] || null; };
  SV.markName = function (file) { return String(file || 'bilde.jpg').replace(/\.(jpe?g|png)$/i, '') + 'M.jpg'; };
  // legger markerte bilder inn i galleriet, rett etter originalen
  SV.withMarks = function (j, ph) {
    var m = (SV.state.marks || {})[j.id]; if (!m) return ph; var out = [];
    ph.forEach(function (x) { out.push(x); var k = m[x.i]; if (k && k.src) out.push({ i: 1000 + x.i, src: k.src, pos: '50% 50%', name: x.name, file: k.name, mark: { of: x.i }, ill: x.ill }); });
    return out;
  };

  // tegner siden på nytt uten å miste hvilken fane som var åpen
  function rerender() {
    var on = [].map.call(document.querySelectorAll('[data-tabs]'), function (w) { var t = w.querySelector('.tab.on'); return [w.getAttribute('data-tabs'), t && t.getAttribute('data-tab')]; });
    SV.render();
    on.forEach(function (x) { var b = x[1] && document.querySelector('[data-tabs="' + x[0] + '"] .tab[data-tab="' + x[1] + '"]'); if (b && !b.classList.contains('on')) SV.acts.tab(b); });
  }

  // ---------- tegning ----------
  function unit(W, H) { return Math.max(W, H) / 400; }
  function lineW(s, u) { return u * (0.6 + (s.size || 3) * 0.5); }
  function pinR(s, u) { return u * (4 + (s.size || 3) * 1.6); }
  function rrect(c, x, y, w, h, r) { r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function norm(s) { return s.t === 'rect' ? { x: Math.min(s.x, s.x + s.w), y: Math.min(s.y, s.y + s.h), w: Math.abs(s.w), h: Math.abs(s.h) } : s; }
  function drawShape(c, s, W, H) {
    var u = unit(W, H), lw = lineW(s, u), col = s.color || '#e53935', light = /^#f{3,6}$/i.test(col) || col === '#ffcc00';
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
    if (s.shadow !== false) { c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowBlur = lw * 1.6; c.shadowOffsetY = lw * 0.3; }
    c.strokeStyle = col; c.fillStyle = col; c.lineWidth = lw;
    if (s.t === 'pin') {
      var r = pinR(s, u);
      if (s.style === 'ring') { c.lineWidth = lw * 1.2; c.beginPath(); c.arc(s.x, s.y, r, 0, Math.PI * 2); c.stroke(); c.shadowColor = 'transparent'; c.beginPath(); c.arc(s.x, s.y, lw * 0.9, 0, Math.PI * 2); c.fill(); }
      else if (s.style === 'num') {
        c.beginPath(); c.arc(s.x, s.y, r, 0, Math.PI * 2); c.fill(); c.shadowColor = 'transparent'; c.lineWidth = r * 0.12; c.strokeStyle = light ? '#111' : '#fff'; c.stroke();
        c.fillStyle = light ? '#111' : '#fff'; c.font = '700 ' + Math.round(r * 1.15) + 'px Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(s.n || 1), s.x, s.y + r * 0.05);
      } else { // kartnål: spissen peker på punktet
        var cy = s.y - r * 1.55; c.beginPath(); c.arc(s.x, cy, r, Math.PI * 0.82, Math.PI * 0.18, false); c.lineTo(s.x, s.y); c.closePath(); c.fill();
        c.shadowColor = 'transparent'; c.lineWidth = r * 0.14; c.strokeStyle = light ? '#111' : '#fff'; c.stroke(); c.fillStyle = light ? '#111' : '#fff'; c.beginPath(); c.arc(s.x, cy, r * 0.38, 0, Math.PI * 2); c.fill();
      }
    } else if (s.t === 'arrow') {
      var dx = s.x2 - s.x1, dy = s.y2 - s.y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, hl = Math.min(L * 0.6, lw * 4.6), hw = hl * 0.62;
      if (s.style === 'block') {
        var sw = lw * 1.1, bx = s.x2 - ux * hl, by = s.y2 - uy * hl;
        c.beginPath(); c.moveTo(s.x1 - uy * sw, s.y1 + ux * sw); c.lineTo(bx - uy * sw, by + ux * sw); c.lineTo(bx - uy * hw * 1.15, by + ux * hw * 1.15); c.lineTo(s.x2, s.y2);
        c.lineTo(bx + uy * hw * 1.15, by - ux * hw * 1.15); c.lineTo(bx + uy * sw, by - ux * sw); c.lineTo(s.x1 + uy * sw, s.y1 - ux * sw); c.closePath(); c.fill();
      } else {
        if (s.style === 'dash') c.setLineDash([lw * 2.6, lw * 1.9]);
        c.beginPath(); c.moveTo(s.x1, s.y1); c.lineTo(s.x2 - ux * hl * 0.6, s.y2 - uy * hl * 0.6); c.stroke(); c.setLineDash([]);
        c.beginPath(); c.moveTo(s.x2, s.y2); c.lineTo(s.x2 - ux * hl - uy * hw, s.y2 - uy * hl + ux * hw); c.lineTo(s.x2 - ux * hl + uy * hw, s.y2 - uy * hl - ux * hw); c.closePath(); c.fill();
      }
    } else if (s.t === 'rect') {
      var n = norm(s);
      if (s.style === 'fill') { c.save(); c.shadowColor = 'transparent'; c.globalAlpha = 0.22; c.fillRect(n.x, n.y, n.w, n.h); c.restore(); }
      if (s.style === 'dash') c.setLineDash([lw * 2.6, lw * 1.9]);
      if (s.style === 'round') { rrect(c, n.x, n.y, n.w, n.h, lw * 4); c.stroke(); } else c.strokeRect(n.x, n.y, n.w, n.h);
    }
    c.restore();
  }
  SV.drawMarks = drawShape;

  // ---------- redigering ----------
  var E = null; // aktiv editor
  function hit(s, p, u) {
    var tol = u * 4;
    if (s.t === 'pin') { var r = pinR(s, u), cy = s.style === 'drop' ? s.y - r * 1.55 : s.y; return Math.hypot(p.x - s.x, p.y - cy) < r * 1.3 || Math.hypot(p.x - s.x, p.y - s.y) < tol * 2; }
    if (s.t === 'arrow') { var dx = s.x2 - s.x1, dy = s.y2 - s.y1, L2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((p.x - s.x1) * dx + (p.y - s.y1) * dy) / L2)); return Math.hypot(p.x - (s.x1 + t * dx), p.y - (s.y1 + t * dy)) < lineW(s, u) * 2 + tol; }
    var n = norm(s); return p.x > n.x - tol && p.x < n.x + n.w + tol && p.y > n.y - tol && p.y < n.y + n.h + tol;
  }
  function handles(s) {
    if (s.t === 'arrow') return [['a', s.x1, s.y1], ['b', s.x2, s.y2]];
    if (s.t === 'rect') { var n = norm(s); return [['nw', n.x, n.y], ['n', n.x + n.w / 2, n.y], ['ne', n.x + n.w, n.y], ['e', n.x + n.w, n.y + n.h / 2], ['se', n.x + n.w, n.y + n.h], ['s', n.x + n.w / 2, n.y + n.h], ['sw', n.x, n.y + n.h], ['w', n.x, n.y + n.h / 2]]; }
    return [];
  }
  function render() {
    if (!E) return; var c = E.ctx, s = E.scale, d = E.dpr;
    c.setTransform(d * s, 0, 0, d * s, 0, 0); c.clearRect(0, 0, E.W, E.H); c.drawImage(E.img, 0, 0, E.W, E.H);
    E.shapes.forEach(function (x) { drawShape(c, x, E.W, E.H); });
    var sel = E.shapes[E.sel]; if (!sel) return;
    var u = 1 / s, pad = 6 * u; c.save(); c.setLineDash([5 * u, 4 * u]); c.lineWidth = 1.5 * u; c.strokeStyle = '#fff'; c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 3 * u;
    if (sel.t === 'rect') { var n = norm(sel); c.strokeRect(n.x - pad, n.y - pad, n.w + 2 * pad, n.h + 2 * pad); }
    else if (sel.t === 'pin') { var r = pinR(sel, unit(E.W, E.H)), cy = sel.style === 'drop' ? sel.y - r * 1.55 : sel.y; c.strokeRect(sel.x - r - pad, cy - r - pad, 2 * r + 2 * pad, (sel.style === 'drop' ? r * 2.55 : 2 * r) + 2 * pad); }
    c.setLineDash([]); handles(sel).forEach(function (h) { c.fillStyle = '#fff'; c.strokeStyle = '#111'; c.lineWidth = 1.2 * u; c.beginPath(); c.arc(h[1], h[2], 6 * u, 0, Math.PI * 2); c.fill(); c.stroke(); });
    c.restore();
  }
  function fit() {
    if (!E) return; var box = E.wrap.getBoundingClientRect(), maxH = Math.max(260, window.innerHeight * 0.62);
    E.scale = Math.min(box.width / E.W, maxH / E.H); E.dpr = window.devicePixelRatio || 1;
    E.cv.style.width = Math.round(E.W * E.scale) + 'px'; E.cv.style.height = Math.round(E.H * E.scale) + 'px';
    E.cv.width = Math.round(E.W * E.scale * E.dpr); E.cv.height = Math.round(E.H * E.scale * E.dpr); render();
  }
  function pt(ev) { var r = E.cv.getBoundingClientRect(); return { x: (ev.clientX - r.left) / E.scale, y: (ev.clientY - r.top) / E.scale }; }
  function push() { E.undo.push(JSON.stringify(E.shapes)); if (E.undo.length > 60) E.undo.shift(); }
  function nextNum() { return E.shapes.filter(function (x) { return x.t === 'pin' && x.style === 'num'; }).length + 1; }
  function down(ev) {
    ev.preventDefault(); E.cv.setPointerCapture(ev.pointerId); var p = pt(ev), u = unit(E.W, E.H), hs = 9 / E.scale, sel = E.shapes[E.sel];
    if (sel) { var h = handles(sel).filter(function (h) { return Math.hypot(h[1] - p.x, h[2] - p.y) < hs * 1.6; })[0]; if (h) { push(); E.drag = { mode: 'handle', h: h[0], s: sel, n: norm(sel) }; return; } }
    if (E.tool === 'select' || (sel && hit(sel, p, u))) {
      var idx = -1; for (var k = E.shapes.length - 1; k >= 0; k--) if (hit(E.shapes[k], p, u)) { idx = k; break; }
      E.sel = idx; if (idx > -1) { push(); E.drag = { mode: 'move', s: E.shapes[idx], last: p }; syncUi(E.shapes[idx]); } render(); return;
    }
    push(); var st = { color: E.color, size: E.size, style: E.style[E.tool], shadow: E.shadow };
    var s = E.tool === 'pin' ? Object.assign({ t: 'pin', x: p.x, y: p.y }, st) : E.tool === 'arrow' ? Object.assign({ t: 'arrow', x1: p.x, y1: p.y, x2: p.x, y2: p.y }, st) : Object.assign({ t: 'rect', x: p.x, y: p.y, w: 0, h: 0 }, st);
    if (s.t === 'pin' && s.style === 'num') s.n = nextNum();
    E.shapes.push(s); E.sel = E.shapes.length - 1; E.drag = s.t === 'pin' ? { mode: 'move', s: s, last: p } : { mode: 'new', s: s }; render();
  }
  function move(ev) {
    if (!E || !E.drag) { if (E && E.tool === 'select') E.cv.style.cursor = E.shapes.some(function (s) { return hit(s, pt(ev), unit(E.W, E.H)); }) ? 'move' : 'default'; return; }
    var p = pt(ev), d = E.drag, s = d.s; p.x = Math.max(0, Math.min(E.W, p.x)); p.y = Math.max(0, Math.min(E.H, p.y));
    if (d.mode === 'new') { if (s.t === 'arrow') { s.x2 = p.x; s.y2 = p.y; } else { s.w = p.x - s.x; s.h = p.y - s.y; } }
    else if (d.mode === 'move') { var dx = p.x - d.last.x, dy = p.y - d.last.y; d.last = p; if (s.t === 'arrow') { s.x1 += dx; s.y1 += dy; s.x2 += dx; s.y2 += dy; } else { s.x += dx; s.y += dy; } }
    else if (d.mode === 'handle') {
      if (s.t === 'arrow') { if (d.h === 'a') { s.x1 = p.x; s.y1 = p.y; } else { s.x2 = p.x; s.y2 = p.y; } }
      else { var n = d.n, x0 = n.x, y0 = n.y, x1 = n.x + n.w, y1 = n.y + n.h;
        if (/w/.test(d.h)) x0 = p.x; if (/e/.test(d.h)) x1 = p.x; if (/n/.test(d.h)) y0 = p.y; if (/s/.test(d.h)) y1 = p.y;
        s.x = Math.min(x0, x1); s.y = Math.min(y0, y1); s.w = Math.abs(x1 - x0); s.h = Math.abs(y1 - y0); }
    }
    render();
  }
  function up() {
    if (!E || !E.drag) return; var s = E.drag.s, u = unit(E.W, E.H);
    if (E.drag.mode === 'new' && ((s.t === 'arrow' && Math.hypot(s.x2 - s.x1, s.y2 - s.y1) < u * 6) || (s.t === 'rect' && (Math.abs(s.w) < u * 4 || Math.abs(s.h) < u * 4)))) { // for lite: lag en standardstørrelse
      if (s.t === 'arrow') { s.x1 = s.x2 - u * 50; s.y1 = s.y2 + u * 30; } else { s.x -= u * 40; s.y -= u * 25; s.w = u * 80; s.h = u * 50; }
    }
    if (s.t === 'rect') { var n = norm(s); s.x = n.x; s.y = n.y; s.w = n.w; s.h = n.h; }
    E.drag = null; E.dirty = true; render(); count();
  }
  function count() { var el = document.getElementById('mkCount'); if (el) el.textContent = E.shapes.length ? E.shapes.length + ' markering' + (E.shapes.length > 1 ? 'er' : '') : 'Ingen markeringer ennå'; }
  function syncUi(s) {
    if (!s) return; E.color = s.color; E.size = s.size; E.shadow = s.shadow !== false; E.style[s.t] = s.style;
    var root = document.getElementById('mk'); if (!root) return;
    root.querySelectorAll('[data-act=mkColor]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-c') === s.color); });
    var sz = root.querySelector('#mkSize'); if (sz) sz.value = s.size; var sh = root.querySelector('#mkShadow'); if (sh) sh.checked = s.shadow !== false;
    styleBar(s.t);
  }
  function styleBar(t) {
    var el = document.getElementById('mkStyles'); if (!el) return; t = t === 'select' ? (E.shapes[E.sel] || {}).t || 'pin' : t;
    el.innerHTML = STYLES[t].map(function (x) { return '<button type="button" class="fbtn' + (E.style[t] === x[0] ? ' on' : '') + '" data-act="mkStyle" data-t="' + t + '" data-s="' + x[0] + '">' + x[1] + '</button>'; }).join('');
  }
  function applySel(f) { var s = E.shapes[E.sel]; if (s) { push(); f(s); E.dirty = true; render(); } }

  SV.on('mkTool', function (el) { E.tool = el.getAttribute('data-t'); document.querySelectorAll('[data-act=mkTool]').forEach(function (b) { b.classList.toggle('on', b === el); }); if (E.tool !== 'select') E.sel = -1; styleBar(E.tool); render(); E.cv.style.cursor = E.tool === 'select' ? 'default' : 'crosshair'; });
  SV.on('mkStyle', function (el) { var t = el.getAttribute('data-t'), v = el.getAttribute('data-s'); E.style[t] = v; styleBar(t); var s = E.shapes[E.sel]; if (s && s.t === t) applySel(function (s) { s.style = v; if (t === 'pin' && v === 'num' && !s.n) s.n = nextNum(); }); });
  SV.on('mkColor', function (el) { E.color = el.getAttribute('data-c'); document.querySelectorAll('[data-act=mkColor]').forEach(function (b) { b.classList.toggle('on', b === el); }); applySel(function (s) { s.color = E.color; }); });
  SV.on('mkColorPick', function (el) { E.color = el.value; document.querySelectorAll('[data-act=mkColor]').forEach(function (b) { b.classList.remove('on'); }); applySel(function (s) { s.color = E.color; }); });
  SV.on('mkSize', function (el) { E.size = +el.value; applySel(function (s) { s.size = E.size; }); });
  SV.on('mkShadow', function (el) { E.shadow = el.checked; applySel(function (s) { s.shadow = E.shadow; }); });
  SV.on('mkDel', function () { if (E.sel < 0) { SV.toast('Velg en markering først', 'warn'); return; } push(); E.shapes.splice(E.sel, 1); E.sel = -1; E.dirty = true; render(); count(); });
  SV.on('mkUndo', function () { if (!E.undo.length) return; E.shapes = JSON.parse(E.undo.pop()); E.sel = -1; render(); count(); });
  SV.on('mkClear', function () { if (!E.shapes.length) return; push(); E.shapes = []; E.sel = -1; render(); count(); });

  // Åpner editoren for bilde i (indeks i oppdraget). by = hvem som markerer.
  SV.markEditor = function (j, i, by) {
    var ph = SV.boligPhotos(j), x = ph.filter(function (p) { return p.i === i; })[0]; if (!x) return;
    var prev = SV.markOf(j.id, i), name = prev ? prev.name : SV.markName(x.file);
    var tools = '<div class="mk-tools" role="toolbar" aria-label="Verktøy">' + TOOLS.map(function (t, k) { return '<button type="button" class="fbtn' + (k === 1 ? ' on' : '') + '" data-act="mkTool" data-t="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>';
    var colors = '<div class="mk-colors">' + COLORS.map(function (c, k) { return '<button type="button" class="mk-c' + (k === 0 ? ' on' : '') + '" data-act="mkColor" data-c="' + c[0] + '" style="background:' + c[0] + '" title="' + c[1] + '" aria-label="' + c[1] + '"></button>'; }).join('') +
      '<label class="mk-c mk-cp" title="Egen farge"><input type="color" value="#e53935" data-input="mkColorPick" aria-label="Egen farge"></label></div>';
    SV.modal('<div id="mk" class="mk"><div class="row between" style="gap:10px;flex-wrap:wrap;margin-bottom:10px"><div><p class="eyebrow">Markering · lagres som <b>' + esc(name) + '</b></p><h3 class="h3">' + esc(x.name) + ' <span class="muted small">(' + esc(x.file || '') + ')</span></h3></div>' + tools + '</div>' +
      '<div class="mk-bar"><div id="mkStyles" class="mk-styles"></div>' + colors +
      '<label class="mk-size small">Størrelse <input id="mkSize" type="range" min="1" max="5" step="1" value="3" data-input="mkSize"></label>' +
      '<label class="small mk-sh"><input id="mkShadow" type="checkbox" checked data-change="mkShadow"> Skygge</label></div>' +
      '<div class="mk-wrap" id="mkWrap"><canvas id="mkCv" aria-label="Bildet med markeringer"></canvas><p class="mk-load small muted">Laster bildet …</p></div>' +
      '<div class="row between" style="margin-top:12px;gap:8px;flex-wrap:wrap"><div class="row" style="gap:6px"><button type="button" class="btn btn-ghost btn-xs" data-act="mkUndo">Angre</button><button type="button" class="btn btn-ghost btn-xs" data-act="mkDel">Slett valgt</button><button type="button" class="btn btn-ghost btn-xs" data-act="mkClear">Fjern alle</button><span class="small muted" id="mkCount"></span></div>' +
      '<div class="row" style="gap:6px">' + (prev ? '<button type="button" class="btn btn-ghost btn-s" data-act="mkRemove" data-id="' + esc(j.id) + '" data-i="' + i + '">Slett ' + esc(name) + '</button>' : '') + '<button type="button" class="btn btn-ghost btn-s" data-act="close">Avbryt</button><button type="button" class="btn btn-dark btn-s" data-act="mkSave" data-id="' + esc(j.id) + '" data-i="' + i + '" data-by="' + esc(by || '') + '">' + ic('check') + 'Lagre som ' + esc(name) + '</button></div></div>' +
      '<p class="hint" style="margin-top:8px">Klikk for et punkt, dra for pil eller rektangel. Med «Velg og flytt» kan du flytte, og dra i hjørnene for å endre størrelse. Delete sletter valgt markering.</p></div>', { wide: true, after: function () {
        var img = new Image(); img.crossOrigin = 'anonymous';
        E = { j: j, i: i, name: name, shapes: prev ? JSON.parse(JSON.stringify(prev.shapes || [])) : [], undo: [], sel: -1, tool: 'pin', color: '#e53935', size: 3, shadow: true, style: { pin: 'drop', arrow: 'solid', rect: 'line' }, img: img };
        E.cv = document.getElementById('mkCv'); E.ctx = E.cv.getContext('2d'); E.wrap = document.getElementById('mkWrap');
        img.onload = function () { E.W = img.naturalWidth; E.H = img.naturalHeight; var l = E.wrap.querySelector('.mk-load'); if (l) l.remove(); fit(); count(); styleBar('pin'); E.cv.style.cursor = 'crosshair'; };
        img.onerror = function () { E.wrap.innerHTML = '<p class="empty">Bildet kunne ikke lastes.</p>'; };
        img.src = x.src;
        E.cv.addEventListener('pointerdown', down); E.cv.addEventListener('pointermove', move); E.cv.addEventListener('pointerup', up); E.cv.addEventListener('pointercancel', up);
      } });
  };
  window.addEventListener('resize', function () { if (E && document.getElementById('mkCv')) fit(); });
  document.addEventListener('keydown', function (ev) {
    if (!E || !document.getElementById('mkCv') || /INPUT|TEXTAREA/.test((ev.target || {}).tagName)) return;
    if ((ev.key === 'Delete' || ev.key === 'Backspace') && E.sel > -1) { ev.preventDefault(); SV.acts.mkDel(); }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') { ev.preventDefault(); SV.acts.mkUndo(); }
  });

  // lager JPG i full oppløsning (demo: mindre, så det får plass i nettleseren)
  function exportJpg(maxSide) {
    var k = Math.min(1, maxSide / Math.max(E.W, E.H)), c = document.createElement('canvas'); c.width = Math.round(E.W * k); c.height = Math.round(E.H * k);
    var x = c.getContext('2d'); x.scale(k, k); x.drawImage(E.img, 0, 0, E.W, E.H); E.shapes.forEach(function (s) { drawShape(x, s, E.W, E.H); });
    return c;
  }
  SV.on('mkSave', function (el) {
    if (!E.shapes.length) { SV.toast('Legg til minst én markering', 'warn'); return; }
    var id = el.getAttribute('data-id'), i = +el.getAttribute('data-i'), by = el.getAttribute('data-by'), shapes = JSON.parse(JSON.stringify(E.shapes)), name = E.name;
    var rec = { name: name, shapes: shapes, by: by || (SV.me && SV.me.name) || 'Studiovest', at: new Date().toISOString(), w: E.W, h: E.H };
    el.disabled = true; el.textContent = 'Lagrer …';
    if (!SV.live) {
      try { rec.src = exportJpg(1400).toDataURL('image/jpeg', 0.84); marks(id)[i] = rec; SV.save(); }
      catch (e) { SV.toast('Fikk ikke lagret i nettleseren (for lite plass). I portalen lagres det på serveren.', 'warn'); el.disabled = false; return; }
      SV.close(); rerender(); SV.toast(name + ' er lagt i galleriet'); return;
    }
    exportJpg(6000).toBlob(function (blob) {
      var fd = new FormData(); fd.append('job', id); fd.append('of', String(i)); fd.append('name', name); fd.append('file', blob, name);
      fetch(SV.apiBase + 'marks.php', { method: 'POST', credentials: 'include', body: fd }).then(function (r) { return r.json(); }).then(function (r) {
        if (!r.ok) { SV.toast(r.error || 'Lagring feilet', 'warn'); el.disabled = false; return; }
        rec.src = SV.apiBase + r.url + '&v=' + Date.now(); marks(id)[i] = rec; SV.save(); SV.close(); rerender(); SV.toast(name + ' er lagt i galleriet');
      }).catch(function () { SV.toast('Fikk ikke kontakt med serveren', 'warn'); el.disabled = false; });
    }, 'image/jpeg', 0.92);
  });
  SV.on('mkRemove', function (el) {
    var id = el.getAttribute('data-id'), i = +el.getAttribute('data-i'), m = SV.markOf(id, i); if (!m) return;
    if (SV.live) fetch(SV.apiBase + 'marks.php', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ a: 'delete', job: id, name: m.name }) });
    delete marks(id)[i]; SV.save(); SV.close(); rerender(); SV.toast(m.name + ' er slettet. Originalen er urørt.');
  });
  SV.on('mkOpen', function (el) { var j = SV.find(SV.jobs(), el.getAttribute('data-id')); SV.close(); setTimeout(function () { SV.markEditor(j, +el.getAttribute('data-i'), el.getAttribute('data-by')); }, 280); });
  // knapp til visningene (lysboks og kommentarvindu)
  SV.markBtn = function (j, i, by) {
    if (i >= 1000) i -= 1000; var m = SV.markOf(j.id, i);
    return '<button type="button" class="btn btn-ghost btn-s" data-act="mkOpen" data-id="' + esc(j.id) + '" data-i="' + i + '" data-by="' + esc(by || '') + '">' + ic('pin') + (m ? 'Endre ' + esc(m.name) : 'Marker bildet') + '</button>';
  };
})();
