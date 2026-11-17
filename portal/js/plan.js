/* Plantegning som data: rom, vegger og kontorstil. Plantegningsagenten foreslår endringer ut fra endringsønskene,
   og ingenting publiseres før Studiovest har godkjent. I demoen tolkes ønskene med enkle regler; i ekte drift gjør Claude det. */
(function () {
  'use strict';
  var SV = window.SV, D = SV.data, esc = SV.esc, ic = SV.icon;

  // ---------- modell ----------
  var BASE = {
    walls: '<rect x="30" y="30" width="340" height="240"/><path d="M200 30v120M30 150h230M260 150v120M260 210h110M120 150v120"/>',
    door: '<path d="M200 70a30 30 0 0 1 30 30"/>',
    rooms: [
      { id: 'r1', name: 'Stue', area: 28, x: 30, y: 30, w: 170, h: 120 },
      { id: 'r2', name: 'Kjøkken', area: 12, x: 200, y: 30, w: 170, h: 120 },
      { id: 'r3', name: 'Soverom', area: 11, x: 30, y: 150, w: 90, h: 120 },
      { id: 'r4', name: 'Soverom', area: 9, x: 120, y: 150, w: 140, h: 120 },
      { id: 'r5', name: 'Bad', area: 6, x: 260, y: 150, w: 110, h: 60 },
      { id: 'r6', name: 'Gang', area: null, x: 260, y: 210, w: 110, h: 60 }
    ]
  };
  function ver(id) { var v = SV.state.planVer = SV.state.planVer || {}; return v[id]; }
  SV.planModel = function (j) {
    var v = j && ver(j.id), rooms = BASE.rooms.map(function (r) { return Object.assign({}, r, v && v.rooms[r.id]); });
    return { rooms: rooms, v: v ? v.n : 1 };
  };

  // ---------- kontorstiler ----------
  var FILL = { soverom: '#E4E9EE', bad: '#DCEBEF', kjøkken: '#F2E6D3', stue: '#E6ECDF', gang: '#EFEBE5', bod: '#ECE7E0', vaskerom: '#DCEBEF', kontor: '#E8E3EE' };
  D.planStyles = {
    fjm: { name: 'Lys nordisk', wall: '#3A3530', ww: 4, label: '#3A3530', font: 'Hanken Grotesk', weight: 500, upper: false, area: true, fill: false, short: false, north: true },
    kmh: { name: 'Klassisk svart', wall: '#000000', ww: 7, label: '#000000', font: 'Hanken Grotesk', weight: 800, upper: true, area: true, fill: false, short: false, north: false },
    sue: { name: 'Farget per rom', wall: '#2D2A26', ww: 3, label: '#2D2A26', font: 'Hanken Grotesk', weight: 600, upper: false, area: true, fill: true, short: false, north: true },
    hbm: { name: 'Minimal med serif', wall: '#161412', ww: 2.5, label: '#161412', font: 'Gloock', weight: 400, upper: false, area: false, fill: false, short: false, north: false }
  };
  SV.planStyle = function (office) { return Object.assign({}, D.planStyles[office] || D.planStyles.fjm, (SV.state.planStyle || {})[office]); };
  function label(r, s) {
    var n = s.short && r.name.toLowerCase() === 'soverom' ? 'Sov' : r.name;
    return { n: s.upper ? n.toUpperCase() : n, a: s.area && r.area ? r.area + ' m²' : '' };
  }
  function draw(rooms, s, hl) {
    var fills = s.fill ? rooms.map(function (r) { return '<rect x="' + r.x + '" y="' + r.y + '" width="' + r.w + '" height="' + r.h + '" fill="' + (FILL[r.name.toLowerCase()] || '#F1EEE9') + '" stroke="none"/>'; }).join('') : '';
    var marks = (hl || []).map(function (id) { var r = rooms.filter(function (x) { return x.id === id; })[0]; return r ? '<rect x="' + (r.x + 4) + '" y="' + (r.y + 4) + '" width="' + (r.w - 8) + '" height="' + (r.h - 8) + '" rx="6" fill="rgba(217,168,102,.28)" stroke="#D9A866" stroke-width="2" stroke-dasharray="5 4"/>' : ''; }).join('');
    var labels = rooms.map(function (r) {
      var l = label(r, s), cx = r.x + r.w / 2, cy = r.y + r.h / 2, fs = Math.min(14, Math.max(10, r.w / 8));
      return '<text x="' + cx + '" y="' + (l.a ? cy - 2 : cy + 4) + '" font-size="' + fs + '" font-weight="' + s.weight + '">' + esc(l.n) + '</text>' + (l.a ? '<text x="' + cx + '" y="' + (cy + fs) + '" font-size="' + (fs - 2) + '" font-weight="400" opacity=".8">' + l.a + '</text>' : '');
    }).join('');
    var north = s.north ? '<g transform="translate(386 24)" stroke="none" fill="' + s.label + '"><path d="M0 -10 L5 6 L0 3 L-5 6Z"/><text y="18" font-size="8" text-anchor="middle">N</text></g>' : '';
    return '<svg viewBox="0 0 400 300" style="position:absolute;inset:0;width:100%;height:100%" fill="none">' + fills + marks +
      '<g stroke="' + s.wall + '" stroke-width="' + s.ww + '" stroke-linejoin="miter">' + BASE.walls + '</g><g stroke="' + s.wall + '" stroke-width="1.5">' + BASE.door + '</g>' +
      '<g font-family="' + s.font + ',sans-serif" fill="' + s.label + '" stroke="none" text-anchor="middle">' + labels + '</g>' + north + '</svg>';
  }
  // SV.planSvg(j) tegner gjeldende versjon i kontorets stil. Uten jobb: standard.
  SV.planSvg = function (j, opts) {
    opts = opts || {};
    var s = opts.style || SV.planStyle(j ? j.office : 'kmh'), rooms = opts.rooms || SV.planModel(j).rooms;
    return draw(rooms, s, opts.hl);
  };

  // ---------- agenten (demo: regler; ekte: Claude) ----------
  var KINDS = [['walk-in', 'Walk-in'], ['garderobe', 'Garderobe'], ['vaskerom', 'Vaskerom'], ['soverom', 'Soverom'], ['kjøkken', 'Kjøkken'], ['kontor', 'Kontor'], ['entré', 'Entré'], ['gang', 'Gang'], ['stue', 'Stue'], ['bod', 'Bod'], ['bad', 'Bad'], ['wc', 'WC'], ['sov', 'Soverom']];
  function kindsIn(t) { var low = ' ' + t.toLowerCase() + ' ', out = []; KINDS.forEach(function (k) { var i = low.search(new RegExp('[^a-zæøå]' + k[0] + '(?:et|en|a|ene|ets)?[^a-zæøå]')); if (i > -1 && out.every(function (o) { return o.name !== k[1]; })) out.push({ name: k[1], i: i }); }); return out.sort(function (a, b) { return a.i - b.i; }); }
  function roomAt(rooms, x, y) { return rooms.filter(function (r) { return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; })[0]; }
  SV.planAgent = function (j) {
    var r = SV.reviewPlanSrc(j) || { pins: [], texts: [], strokes: [], planNote: '' }, before = SV.planModel(j).rooms, rooms = before.map(function (x) { return Object.assign({}, x); });
    var changes = [], manual = [];
    var items = r.pins.filter(function (p) { return p.t; }).map(function (p, k) { return { t: p.t, x: p.x, y: p.y, src: 'Punkt ' + (k + 1) }; })
      .concat((r.texts || []).filter(function (p) { return p.t; }).map(function (p) { return { t: p.t, x: p.x, y: p.y, src: 'Tekst på tegningen' }; }))
      .concat(r.planNote ? r.planNote.split(/\n|\.\s/).filter(function (s) { return s.trim(); }).map(function (s) { return { t: s.trim(), src: 'Kommentar' }; }) : []);
    items.forEach(function (it) {
      var ks = kindsIn(it.t), num = /(\d+(?:[.,]\d+)?)\s*(?:m2|m²|kvm)/i.exec(it.t), room = it.x != null ? roomAt(rooms, it.x, it.y) : null, done = false;
      // «Kjøkkenet er 14 m²» uten punkt: finn rommet ut fra navnet
      if (!room && ks.length) room = rooms.filter(function (x) { return x.name.toLowerCase() === ks[ks.length > 1 ? 1 : 0].name.toLowerCase(); })[0] || rooms.filter(function (x) { return x.name.toLowerCase() === ks[0].name.toLowerCase(); })[0];
      if (room && ks.length && (it.x != null || /ikke|skal være|er egentlig|feil/i.test(it.t))) {
        var to = ks[0].name;
        if (to.toLowerCase() !== room.name.toLowerCase()) { changes.push({ id: room.id, what: 'Romnavn', from: room.name, to: to, src: it.src + ': «' + it.t + '»' }); room.name = to; done = true; }
      }
      if (room && num) { var a = Math.round(parseFloat(num[1].replace(',', '.'))); if (a !== room.area) { changes.push({ id: room.id, what: 'Areal ' + room.name, from: (room.area || '–') + ' m²', to: a + ' m²', src: it.src + ': «' + it.t + '»' }); room.area = a; done = true; } }
      if (!done) manual.push(it.src + ': «' + it.t + '»');
    });
    if (r.strokes.length) manual.push('Tegning (' + r.strokes.length + ' strek' + (r.strokes.length > 1 ? 'er' : '') + '): se tegningen og vurder selv');
    return { changes: changes, manual: manual, before: before, after: rooms, t: SV.fdate(D.iso(D.base)) };
  };

  SV.agentCard = function (j) {
    var p = (SV.state.agent || {})[j.id]; if (!p) return '';
    var s = SV.planStyle(j.office), hl = p.changes.map(function (c) { return c.id; });
    return '<div class="card pad ag"><div class="row between" style="gap:10px;flex-wrap:wrap;margin-bottom:12px"><div><p class="eyebrow">' + ic('bolt') + 'Plantegningsagent · forslag ' + esc(p.t) + '</p><h3 class="h3">Venter på din godkjenning</h3><p class="small muted" style="margin-top:2px">Stil: ' + esc(s.name) + ' (' + esc(SV.find(D.offices, j.office).name) + '). Ingenting er synlig for megler før du godkjenner.</p></div>' +
      '<div class="row"><button class="btn btn-ghost btn-s" data-act="agReject" data-id="' + j.id + '">Avvis</button><button class="btn btn-acc btn-s" data-act="agOk" data-id="' + j.id + '"' + (p.changes.length ? '' : ' disabled') + '>' + ic('check') + 'Godkjenn og publiser</button></div></div>' +
      '<div class="ag-cmp"><figure><figcaption>Nå</figcaption><div class="ag-plan">' + SV.planSvg(j, { rooms: p.before }) + '</div></figure><figure><figcaption>Forslag</figcaption><div class="ag-plan">' + SV.planSvg(j, { rooms: p.after, hl: hl }) + '</div></figure></div>' +
      (p.changes.length ? '<ul class="ag-list">' + p.changes.map(function (c) { return '<li>' + ic('check') + '<span><b>' + esc(c.what) + ':</b> ' + esc(c.from) + ' → <b>' + esc(c.to) + '</b><small>' + esc(c.src) + '</small></span></li>'; }).join('') + '</ul>' : '<p class="small muted">Fant ingen endringer agenten kan gjøre selv.</p>') +
      (p.manual.length ? '<p class="eyebrow" style="margin:14px 0 6px">Må gjøres av deg</p><ul class="ag-list man">' + p.manual.map(function (m) { return '<li>' + ic('edit') + '<span>' + esc(m) + '</span></li>'; }).join('') + '</ul>' : '') + '</div>';
  };
  SV.runAgent = function (j) { var a = SV.state.agent = SV.state.agent || {}; a[j.id] = SV.planAgent(j); return a[j.id]; };
  SV.on('agRun', function (el) { var j = SV.find(SV.jobs(), el.getAttribute('data-id')), p = SV.runAgent(j); SV.save(); SV.render(); SV.toast('Agenten har laget et forslag: ' + p.changes.length + ' endringer, ' + p.manual.length + ' til deg'); });
  SV.on('agOk', function (el) {
    var j = SV.find(SV.jobs(), el.getAttribute('data-id')), p = SV.state.agent[j.id], v = SV.state.planVer = SV.state.planVer || {}, cur = v[j.id] || { n: 1, rooms: {} };
    p.after.forEach(function (r) { cur.rooms[r.id] = { name: r.name, area: r.area }; }); cur.n++; v[j.id] = cur;
    var st = SV.state.agentStats = SV.state.agentStats || { ok: 0, rejected: 0 }; st.ok++;
    delete SV.state.agent[j.id];
    var q = SV.reviewOpenPlanReq(j); if (q) q.planVer = cur.n;
    SV.state.mailLog.unshift({ id: j.id, t: SV.fdate(D.iso(D.base)), to: j.broker, mail: 'megler', subj: 'Ny versjon av plantegningen: ' + j.addr, k: 'plan' });
    SV.save(); SV.render(); SV.toast('Plantegning versjon ' + cur.n + ' er publisert · megler får e-post');
  });
  SV.on('agReject', function (el) { var st = SV.state.agentStats = SV.state.agentStats || { ok: 0, rejected: 0 }; st.rejected++; delete SV.state.agent[el.getAttribute('data-id')]; SV.save(); SV.render(); SV.toast('Forslaget er avvist'); });

  // ---------- innstillinger: stiler og agent ----------
  SV.planSettings = function () {
    var ag = SV.state.agentCfg = SV.state.agentCfg || { approve: true, run: 'ved nytt ønske' }, st = SV.state.agentStats || { ok: 0, rejected: 0 };
    var cards = D.offices.map(function (o) {
      var s = SV.planStyle(o.id), f = function (k, lab) { return '<label class="opt nobox" style="padding:6px 0"><input type="checkbox" data-change="psSet" data-o="' + o.id + '" data-k="' + k + '"' + (s[k] ? ' checked' : '') + '><b>' + lab + '</b></label>'; };
      return '<div class="card pad"><p class="eyebrow">' + esc(o.name) + '</p><h3 class="h3" style="margin-bottom:10px">' + esc(s.name) + '</h3><div class="ag-plan" style="margin-bottom:12px">' + SV.planSvg(null, { style: s }) + '</div>' +
        '<div class="g2" style="gap:8px"><label class="fld"><span>Veggtykkelse</span><input class="inp" type="range" min="2" max="8" step=".5" value="' + s.ww + '" data-change="psSet" data-o="' + o.id + '" data-k="ww"></label><label class="fld"><span>Skrift</span><select class="sel" data-change="psSet" data-o="' + o.id + '" data-k="font"><option' + (s.font === 'Hanken Grotesk' ? ' selected' : '') + '>Hanken Grotesk</option><option' + (s.font === 'Gloock' ? ' selected' : '') + '>Gloock</option></select></label></div>' +
        '<div class="g2" style="gap:0 12px">' + f('upper', 'Store bokstaver') + f('area', 'Vis m²') + f('fill', 'Farge per rom') + f('north', 'Nordpil') + '</div></div>';
    }).join('');
    return '<div class="card pad ag" style="margin-bottom:18px"><div class="row between" style="gap:14px;flex-wrap:wrap"><div><p class="eyebrow">' + ic('bolt') + 'Plantegningsagent</p><h3 class="h3">Leser endringsønsker og lager forslag</h3><p class="small muted" style="margin-top:4px;max-width:620px">Når megler eller kunde sender endringer på plantegningen, lager agenten en ny versjon i kontorets stil. Den publiseres bare når du godkjenner. Bildekommentarer går alltid til deg.</p></div>' +
      '<dl class="kv small" style="min-width:220px"><dt>Kjører</dt><dd>Ved nytt endringsønske</dd><dt>Godkjenning</dt><dd><label class="opt nobox" style="padding:0"><input type="checkbox" data-change="agApprove"' + (ag.approve ? ' checked' : '') + '><b>Alltid krev min godkjenning</b></label></dd><dt>Så langt</dt><dd>' + st.ok + ' godkjent · ' + st.rejected + ' avvist</dd></dl></div></div>' +
      '<div class="g2">' + cards + '</div><p class="hint">Stilen følger meglerkontoret. Agenten får stilen og plantegningsfilen, og leverer i samme stil.</p>';
  };
  SV.on('psSet', function (el) {
    var o = el.getAttribute('data-o'), k = el.getAttribute('data-k'), all = SV.state.planStyle = SV.state.planStyle || {}, s = all[o] = all[o] || {};
    s[k] = el.type === 'checkbox' ? el.checked : el.type === 'range' ? parseFloat(el.value) : el.value; SV.save();
    var y = window.scrollY; SV.render(); window.scrollTo(0, y);
  });
  SV.on('agApprove', function (el) { SV.state.agentCfg.approve = el.checked; SV.save(); SV.toast(el.checked ? 'Du godkjenner alle forslag før de publiseres' : 'Agenten publiserer selv · du får varsel', el.checked ? '' : 'warn'); });
})();
