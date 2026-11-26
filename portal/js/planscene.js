/* Plantegning som scene (rom, vegger, åpninger, inventar, etiketter) og tegning i meglerkontorets husstil.
   Samme format som plantegningsagenten bruker på serveren (api/plan.php). Alle mål i cm. */
(function () {
  'use strict';
  var SV = window.SV, esc = SV.esc;

  // ---------- kontorstiler (fra plantegningsagentens stilreferanse) ----------
  var STYLES = {
    em_norge: { name: 'Eiendomsmegler Norge', wall: '#101010', room: '#f4f0ed', wet: '#e6f5ff', outdoor: '#eaeaea', line: '#101010', font: 'Arial, Helvetica, sans-serif', title: 'Almarai, Arial, sans-serif', bug: false },
    em1_sor: { name: 'EiendomsMegler 1 Sør', wall: '#101010', room: '#f4f0ed', wet: '#e6f5ff', outdoor: '#eaeaea', line: '#101010', font: 'Arial, Helvetica, sans-serif', title: 'Almarai, Arial, sans-serif', bug: false },
    aktiv_sunnhordland: { name: 'Aktiv Sunnhordland', wall: '#4b281e', room: '#fcf9f4', wet: '#e8f4fd', outdoor: '#eaeaea', line: '#4b281e', font: '"Playfair Display", Georgia, serif', title: '"Playfair Display", Georgia, serif', bug: true },
    nordvik: { name: 'Nordvik', wall: '#002d32', room: '#f9f3ed', wet: '#e8f4fd', outdoor: '#eaeaea', line: '#002d32', font: '"Libre Baskerville", Georgia, serif', title: '"Libre Baskerville", Georgia, serif', bug: true }
  };
  // portalens kontor → stil. Demokontorene viser hver sin stil.
  var OF = { emn: 'em_norge', em1: 'em1_sor', aksun: 'aktiv_sunnhordland', nvhar: 'nordvik', nvsun: 'nordvik', nvhau: 'nordvik', fjm: 'em_norge', kmh: 'em1_sor', sue: 'aktiv_sunnhordland', hbm: 'nordvik' };
  SV.planStyleKey = function (office) { return STYLES[office] ? office : OF[office] || 'em_norge'; };
  SV.planStyles = STYLES;
  SV.planDisclaimer = ['Tegningen er ikke målestokkholdig', 'Megler/selger tar ikke ansvar for evt. feil.', 'Plassering av møbler er kun tatt med for å illustrere muligheter.'];

  // ---------- demoscener ----------
  function R(id, label, x, y, w, h, area) { var wet = /^(Bad|WC|Vaskerom)$/.test(label); return { id: id, type: label.toLowerCase(), label: label, surface: wet ? 'wet' : 'room', area: area || null, polygon: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]] }; }
  function W(id, kind, a, b) { return { id: id, kind: kind, start: a, end: b }; }
  function ext(w, h) { return [W('w1', 'exterior', [0, 0], [w, 0]), W('w2', 'exterior', [w, 0], [w, h]), W('w3', 'exterior', [w, h], [0, h]), W('w4', 'exterior', [0, h], [0, 0])]; }
  function D(id, wall, off, w, into, extra) { return Object.assign({ id: id, wall_id: wall, type: 'door', offset: off, width: w, hinge: 'start', swing: 'in', opens_into: into }, extra || {}); }
  function O(id, wall, type, off, w) { return { id: id, wall_id: wall, type: type, offset: off, width: w }; }
  function F(id, type, room, x, y, w, h, rot) { return { id: id, type: type, room_id: room, x: x, y: y, w: w, h: h, rotation: rot || 0 }; }
  function labels(rooms, at) { return rooms.map(function (r) { var p = at[r.id] || [(r.polygon[0][0] + r.polygon[2][0]) / 2, (r.polygon[0][1] + r.polygon[2][1]) / 2]; return { id: 'l' + r.id, room_id: r.id, text: r.label, x: p[0], y: p[1] }; }); }
  var SCENES = {};
  (function () {
    var r = [R('r1', 'Stue', 0, 0, 510, 360, 28), R('r2', 'Kjøkken', 510, 0, 510, 360, 12), R('r3', 'Soverom', 0, 360, 270, 360, 11), R('r4', 'Soverom', 270, 360, 420, 360, 9), R('r6', 'Gang', 690, 360, 330, 180), R('r5', 'Bad', 690, 540, 330, 180, 6)];
    SCENES.f1 = { floor_title: '1.Etasje', rooms: r,
      walls: ext(1020, 720).concat([W('w5', 'interior', [510, 0], [510, 360]), W('w6', 'interior', [0, 360], [1020, 360]), W('w7', 'interior', [270, 360], [270, 720]), W('w8', 'interior', [690, 360], [690, 720]), W('w9', 'interior', [690, 540], [1020, 540])]),
      openings: [D('o1', 'w2', 400, 90, 'r6'), O('o2', 'w6', 'passage', 760, 200), D('o3', 'w8', 40, 80, 'r4'), D('o4', 'w9', 40, 80, 'r5'), D('o5', 'w6', 150, 80, 'r3', { hinge: 'end' }), O('o6', 'w5', 'passage', 100, 160),
        O('o7', 'w1', 'window', 150, 180), O('o8', 'w1', 'window', 700, 150), O('o9', 'w4', 'window', 120, 150), O('o10', 'w3', 'window', 570, 150), O('o11', 'w3', 'window', 90, 80)],
      fixtures: [F('f1', 'counter', 'r2', 780, 38.5, 360, 60), F('f2', 'sink', 'r2', 700, 36, 60, 45), F('f3', 'stove', 'r2', 860, 38.5, 60, 60), F('f4', 'fridge', 'r2', 981.5, 110, 60, 60), F('f5', 'counter', 'r2', 760, 230, 200, 90),
        F('f6', 'sofa', 'r1', 240, 290, 220, 90), F('f7', 'table', 'r1', 240, 170, 120, 70),
        F('f8', 'wardrobe', 'r3', 38.5, 420, 60, 100), F('f9', 'bed', 'r3', 175, 570, 140, 200),
        F('f10', 'wardrobe', 'r4', 340, 396, 120, 60), F('f11', 'bed', 'r4', 480, 600, 160, 200),
        F('f12', 'toilet', 'r5', 979, 600, 65, 40), F('f13', 'shower', 'r5', 966.5, 666.5, 90, 90), F('f14', 'sink', 'r5', 860, 568.5, 60, 45), F('f15', 'washer', 'r5', 726, 681.5, 60, 60)],
      labels: labels(r, { r1: [255, 90], r2: [900, 260], r3: [135, 450], r4: [560, 470], r6: [855, 470], r5: [830, 640] }) };
  })();
  (function () {
    var r = [R('kr1', 'Bod', 0, 0, 360, 360, 10), R('kr2', 'Vaskerom', 360, 0, 330, 360, 8), R('kr3', 'Teknisk rom', 690, 0, 330, 360, 7), R('kr4', 'Gang', 0, 360, 720, 360), R('kr5', 'Bod', 720, 360, 300, 360, 6)];
    SCENES.k = { floor_title: 'Kjeller', rooms: r,
      walls: ext(1020, 720).concat([W('w5', 'interior', [360, 0], [360, 360]), W('w6', 'interior', [690, 0], [690, 360]), W('w7', 'interior', [0, 360], [1020, 360]), W('w8', 'interior', [720, 360], [720, 720])]),
      openings: [D('o1', 'w7', 150, 80, 'kr1'), D('o2', 'w7', 480, 80, 'kr2'), D('o3', 'w6', 150, 80, 'kr3'), D('o4', 'w8', 150, 80, 'kr5'), O('o5', 'w1', 'window', 400, 100)],
      fixtures: [F('f1', 'stairs', 'kr4', 120, 540, 100, 250), F('f2', 'washer', 'kr2', 430, 38.5, 60, 60), F('f3', 'dryer', 'kr2', 495, 38.5, 60, 60), F('f4', 'sink', 'kr2', 620, 36, 60, 45)],
      labels: labels(r, {}) };
  })();
  (function () {
    var r = [R('f2r1', 'Soverom', 0, 0, 450, 390, 13), R('f2r2', 'Soverom', 450, 0, 570, 390, 15), R('f2r3', 'Bad', 0, 390, 330, 330, 7), R('f2r4', 'Gang', 330, 390, 270, 330), R('f2r5', 'Loftstue', 600, 390, 420, 330, 16)];
    SCENES.f2 = { floor_title: '2.Etasje', rooms: r,
      walls: ext(1020, 720).concat([W('w5', 'interior', [450, 0], [450, 390]), W('w6', 'interior', [0, 390], [1020, 390]), W('w7', 'interior', [330, 390], [330, 720]), W('w8', 'interior', [600, 390], [600, 720])]),
      openings: [D('o1', 'w6', 360, 80, 'f2r1', { hinge: 'end' }), D('o2', 'w6', 470, 80, 'f2r2'), D('o3', 'w7', 60, 80, 'f2r3'), O('o4', 'w8', 'passage', 100, 120), O('o5', 'w1', 'window', 150, 150), O('o6', 'w1', 'window', 650, 180), O('o7', 'w2', 'window', 480, 150)],
      fixtures: [F('f1', 'stairs', 'f2r4', 465, 620, 100, 180), F('f2', 'bed', 'f2r1', 220, 180, 160, 200), F('f3', 'bed', 'f2r2', 760, 180, 180, 200), F('f4', 'wardrobe', 'f2r2', 981.5, 280, 180, 60, 90), F('f5', 'bathtub', 'f2r3', 90, 610, 170, 75, 90), F('f6', 'toilet', 'f2r3', 290, 680, 40, 65), F('f7', 'sink', 'f2r3', 230, 418.5, 60, 45), F('f8', 'sofa', 'f2r5', 810, 660, 220, 90)],
      labels: labels(r, {}) };
  })();
  SV.demoScene = function (f, office) { var s = JSON.parse(JSON.stringify(SCENES[f] || SCENES.f1)); s.office = SV.planStyleKey(office); return s; };

  // ---------- geometri ----------
  function wgeo(w) { var a = w.start, b = w.end, dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1e-9; return { a: a, b: b, len: l, u: [dx / l, dy / l], n: [-dy / l, dx / l] }; }
  function wt(w) { return w.kind === 'exterior' ? 17 : w.kind === 'separator' ? 0 : 12; }
  function pip(p, poly) { var inn = false; for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) { var xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / ((yj - yi) || 1e-9) + xi) inn = !inn; } return inn; }
  function pts(a) { return a.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' '); }
  function band(g, o0, o1, t) { var u = g.u, n = g.n, p0 = [g.a[0] + u[0] * o0, g.a[1] + u[1] * o0], p1 = [g.a[0] + u[0] * o1, g.a[1] + u[1] * o1]; return [[p0[0] + n[0] * t, p0[1] + n[1] * t], [p1[0] + n[0] * t, p1[1] + n[1] * t], [p1[0] - n[0] * t, p1[1] - n[1] * t], [p0[0] - n[0] * t, p0[1] - n[1] * t]]; }
  function bbox(s) { var a = []; (s.walls || []).forEach(function (w) { a.push(w.start, w.end); }); (s.rooms || []).forEach(function (r) { a = a.concat(r.polygon); }); var xs = a.map(function (p) { return p[0]; }), ys = a.map(function (p) { return p[1]; }); return [Math.min.apply(0, xs), Math.min.apply(0, ys), Math.max.apply(0, xs), Math.max.apply(0, ys)]; }
  // Plassering i 400 × 300-flaten (samme flate som markeringene i gjennomgangen bruker).
  SV.planFit = function (s) { var b = bbox(s), sc = Math.min(340 / (b[2] - b[0] || 1), 240 / (b[3] - b[1] || 1)); return { s: sc, ox: 30 + (340 - (b[2] - b[0]) * sc) / 2 - b[0] * sc, oy: 30 + (240 - (b[3] - b[1]) * sc) / 2 - b[1] * sc }; };
  SV.planToCm = function (s, x, y) { var f = SV.planFit(s); return [Math.round((x - f.ox) / f.s), Math.round((y - f.oy) / f.s)]; };
  SV.planRoomAt = function (s, cm) { return (s.rooms || []).filter(function (r) { return pip(cm, r.polygon); })[0] || null; };

  // ---------- tegning ----------
  function fixture(f, c) {
    var w = f.w, h = f.h, x = -w / 2, y = -h / 2, lw = 1.1, base = '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="#fff" stroke="' + c + '" stroke-width="' + lw + '"/>', in2 = '';
    var t = f.type;
    if (t === 'sink') in2 = '<rect x="' + (x + 6) + '" y="' + (y + 6) + '" width="' + (w - 12) + '" height="' + (h - 12) + '" rx="8" fill="none" stroke="' + c + '" stroke-width="' + lw + '"/>';
    else if (t === 'stove' || t === 'cooktop') in2 = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(function (q) { return '<circle cx="' + q[0] * w / 4.5 + '" cy="' + q[1] * h / 4.5 + '" r="' + Math.min(w, h) / 7 + '" fill="none" stroke="' + c + '" stroke-width="' + lw + '"/>'; }).join('');
    else if (t === 'toilet') return '<rect x="' + (w / 2 - 18) + '" y="' + y + '" width="18" height="' + h + '" fill="#fff" stroke="' + c + '" stroke-width="' + lw + '"/><ellipse cx="' + (w / 2 - 18 - (w - 18) / 2) + '" cy="0" rx="' + (w - 18) / 2 + '" ry="' + h / 2.4 + '" fill="#fff" stroke="' + c + '" stroke-width="' + lw + '"/>';
    else if (t === 'shower') in2 = '<path d="M' + x + ' ' + y + 'L' + (-x) + ' ' + (-y) + 'M' + (-x) + ' ' + y + 'L' + x + ' ' + (-y) + '" stroke="' + c + '" stroke-width="' + lw * 0.7 + '"/>';
    else if (t === 'bathtub') in2 = '<rect x="' + (x + 7) + '" y="' + (y + 7) + '" width="' + (w - 14) + '" height="' + (h - 14) + '" rx="' + (h / 3) + '" fill="none" stroke="' + c + '" stroke-width="' + lw + '"/>';
    else if (t === 'bed') in2 = '<path d="M' + x + ' ' + (y + 45) + 'H' + (-x) + '" stroke="' + c + '" stroke-width="' + lw + '"/>' + (w > 120 ? '<rect x="' + (x + 10) + '" y="' + (y + 8) + '" width="' + (w / 2 - 15) + '" height="28" rx="6" fill="none" stroke="' + c + '" stroke-width="' + lw + '"/><rect x="5" y="' + (y + 8) + '" width="' + (w / 2 - 15) + '" height="28" rx="6" fill="none" stroke="' + c + '" stroke-width="' + lw + '"/>' : '<rect x="' + (x + 10) + '" y="' + (y + 8) + '" width="' + (w - 20) + '" height="28" rx="6" fill="none" stroke="' + c + '" stroke-width="' + lw + '"/>');
    else if (t === 'stairs') { var n = Math.max(3, Math.round(h / 25)); for (var i = 1; i < n; i++) in2 += '<path d="M' + x + ' ' + (y + i * h / n) + 'H' + (-x) + '" stroke="' + c + '" stroke-width="' + lw * 0.8 + '"/>'; }
    else if (t === 'wardrobe') in2 = '<path d="M' + x + ' ' + y + 'L' + (-x) + ' ' + (-y) + '" stroke="' + c + '" stroke-width="' + lw * 0.6 + '" stroke-dasharray="4 4"/>';
    else if (t === 'washer' || t === 'dryer') in2 = '<circle r="' + Math.min(w, h) / 3 + '" fill="none" stroke="' + c + '" stroke-width="' + lw + '"/>';
    else if (t === 'sofa') in2 = '<path d="M' + (x + 15) + ' ' + (-y) + 'V' + (y + 20) + 'H' + (-x - 15) + 'V' + (-y) + '" fill="none" stroke="' + c + '" stroke-width="' + lw + '"/>';
    else if (t === 'fireplace') in2 = '<path d="M' + (x + 8) + ' ' + (-y) + 'Q0 ' + (y + 6) + ' ' + (-x - 8) + ' ' + (-y) + '" fill="none" stroke="' + c + '" stroke-width="' + lw + '"/>';
    return base + in2;
  }
  // SV.sceneSvg(scene, { names: {roomId: navn}, areas: {roomId: m²}, hl: [roomId], diff: [fixtureId…], title: true })
  SV.sceneSvg = function (s, o) {
    o = o || {}; var st = STYLES[s.office] || STYLES.em_norge, f = SV.planFit(s), c = st.line, out = [];
    out.push('<g transform="translate(' + f.ox.toFixed(2) + ' ' + f.oy.toFixed(2) + ') scale(' + f.s.toFixed(5) + ')">');
    (s.rooms || []).forEach(function (r) { out.push('<polygon points="' + pts(r.polygon) + '" fill="' + (st[r.surface] || st.room) + '"/>'); });
    (o.hl || []).forEach(function (id) { var r = (s.rooms || []).filter(function (x) { return x.id === id; })[0]; if (r) out.push('<polygon points="' + pts(r.polygon) + '" fill="rgba(217,168,102,.30)" stroke="#D9A866" stroke-width="5" stroke-dasharray="14 10"/>'); });
    (s.walls || []).forEach(function (w) { var g = wgeo(w); if (wt(w)) out.push('<polygon points="' + pts(band(g, 0, g.len, wt(w) / 2)) + '" fill="' + st.wall + '"/>'); else out.push('<line x1="' + w.start[0] + '" y1="' + w.start[1] + '" x2="' + w.end[0] + '" y2="' + w.end[1] + '" stroke="#e8c34a" stroke-width="2.5"/>'); });
    // sørg for at veggene møtes i hjørnene
    (s.walls || []).forEach(function (w) { var t = wt(w); if (!t) return; [w.start, w.end].forEach(function (p) { out.push('<rect x="' + (p[0] - t / 2) + '" y="' + (p[1] - t / 2) + '" width="' + t + '" height="' + t + '" fill="' + st.wall + '"/>'); }); });
    (s.openings || []).forEach(function (op) {
      var w = (s.walls || []).filter(function (x) { return x.id === op.wall_id; })[0]; if (!w) return; var g = wgeo(w), t = wt(w) / 2, b = band(g, op.offset, op.offset + op.width, t + 0.4);
      if (op.type === 'passage') { var r = SV.planRoomAt(s, [(b[0][0] + b[2][0]) / 2 + g.n[0] * 30, (b[0][1] + b[2][1]) / 2 + g.n[1] * 30]); out.push('<polygon points="' + pts(b) + '" fill="' + (r ? st[r.surface] || st.room : st.room) + '"/>'); return; }
      out.push('<polygon points="' + pts(b) + '" fill="#fff" stroke="' + c + '" stroke-width="0.9"/>');
      if (op.type === 'window') {
        var m0 = [g.a[0] + g.u[0] * op.offset, g.a[1] + g.u[1] * op.offset], m1 = [m0[0] + g.u[0] * op.width, m0[1] + g.u[1] * op.width], ins = t;
        out.push('<line x1="' + (m0[0] + g.u[0] * ins) + '" y1="' + (m0[1] + g.u[1] * ins) + '" x2="' + (m1[0] - g.u[0] * ins) + '" y2="' + (m1[1] - g.u[1] * ins) + '" stroke="' + c + '" stroke-width="0.9"/>');
        [ins, op.width - ins].forEach(function (d) { var p = [m0[0] + g.u[0] * d, m0[1] + g.u[1] * d]; out.push('<line x1="' + (p[0] + g.n[0] * t) + '" y1="' + (p[1] + g.n[1] * t) + '" x2="' + (p[0] - g.n[0] * t) + '" y2="' + (p[1] - g.n[1] * t) + '" stroke="' + c + '" stroke-width="0.9"/>'); });
        return;
      }
      // dør: blad åpnet 15° inn i rommet, med bue tilbake til lukket stilling
      var p0 = [g.a[0] + g.u[0] * op.offset, g.a[1] + g.u[1] * op.offset], p1 = [p0[0] + g.u[0] * op.width, p0[1] + g.u[1] * op.width];
      var side = 1, room = (s.rooms || []).filter(function (x) { return x.id === op.opens_into; })[0];
      if (room) side = pip([(p0[0] + p1[0]) / 2 + g.n[0] * 25, (p0[1] + p1[1]) / 2 + g.n[1] * 25], room.polygon) ? 1 : -1;
      if (op.swing === 'out') side = -side;
      var hinge = op.hinge === 'end' ? p1 : p0, other = op.hinge === 'end' ? p0 : p1, al = [(other[0] - hinge[0]) / op.width, (other[1] - hinge[1]) / op.width], dn = [g.n[0] * side, g.n[1] * side];
      var h2 = [hinge[0] + dn[0] * t, hinge[1] + dn[1] * t], cl = [other[0] + dn[0] * t, other[1] + dn[1] * t], a = 15 * Math.PI / 180; // bladet er åpnet 15°
      var leaf = [h2[0] + (al[0] * Math.cos(a) + dn[0] * Math.sin(a)) * op.width, h2[1] + (al[1] * Math.cos(a) + dn[1] * Math.sin(a)) * op.width];
      var sweep = (al[0] * dn[1] - al[1] * dn[0]) > 0 ? 0 : 1;
      out.push('<line x1="' + h2[0] + '" y1="' + h2[1] + '" x2="' + leaf[0] + '" y2="' + leaf[1] + '" stroke="' + c + '" stroke-width="1.6"/><path d="M' + leaf[0] + ' ' + leaf[1] + 'A' + op.width + ' ' + op.width + ' 0 0 ' + sweep + ' ' + cl[0] + ' ' + cl[1] + '" fill="none" stroke="' + c + '" stroke-width="0.8"/>');
    });
    (s.fixtures || []).forEach(function (fx) { var mark = (o.diff || []).indexOf(fx.id) > -1; out.push('<g transform="translate(' + fx.x + ' ' + fx.y + ') rotate(' + (fx.rotation || 0) + ')">' + fixture(fx, c) + (mark ? '<rect x="' + (-fx.w / 2 - 6) + '" y="' + (-fx.h / 2 - 6) + '" width="' + (fx.w + 12) + '" height="' + (fx.h + 12) + '" fill="none" stroke="#D9A866" stroke-width="4" stroke-dasharray="10 8"/>' : '') + '</g>'); });
    (o.removed || []).forEach(function (fx) { out.push('<g transform="translate(' + fx.x + ' ' + fx.y + ') rotate(' + (fx.rotation || 0) + ')"><rect x="' + (-fx.w / 2) + '" y="' + (-fx.h / 2) + '" width="' + fx.w + '" height="' + fx.h + '" fill="none" stroke="#c0392b" stroke-width="3" stroke-dasharray="8 6"/></g>'); });
    var fs = 30;
    (s.labels || []).forEach(function (l) {
      var name = (o.names && o.names[l.room_id]) || l.text, ar = o.areas && o.areas[l.room_id];
      out.push('<text x="' + l.x + '" y="' + (ar ? l.y - 4 : l.y + fs * 0.35) + '" font-size="' + fs + '" text-anchor="middle" fill="' + c + '" font-family=\'' + st.font + '\'>' + esc(name) + '</text>' + (ar ? '<text x="' + l.x + '" y="' + (l.y + fs * 0.85) + '" font-size="' + fs * 0.75 + '" text-anchor="middle" fill="' + c + '" opacity=".75" font-family=\'' + st.font + '\'>' + ar + ' m²</text>' : ''));
    });
    out.push('</g>');
    if (o.title && s.floor_title) out.push('<text x="200" y="293" font-size="9" font-weight="700" text-anchor="middle" fill="' + c + '" font-family=\'' + st.title + '\'>' + esc(s.floor_title) + '</text>');
    return '<svg viewBox="0 0 400 300" style="position:absolute;inset:0;width:100%;height:100%" role="img" aria-label="Plantegning ' + esc(s.floor_title || '') + '">' + out.join('') + '</svg>';
  };
})();
