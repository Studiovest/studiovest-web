/* Plantegning som data: rom, vegger og kontorstil. Plantegningsagenten foreslår endringer ut fra endringsønskene,
   og ingenting publiseres før Studiovest har godkjent. I demoen tolkes ønskene med enkle regler; i ekte drift gjør Claude det. */
(function () {
  'use strict';
  var SV = window.SV, D = SV.data, esc = SV.esc, ic = SV.icon;

  // ---------- modell: én tegning per etasje (scene i planscene.js) ----------
  var FLOORS = { k: { name: 'Kjeller' }, f1: { name: '1. etasje' }, f2: { name: '2. etasje' } };
  // romliste i 400 × 300-flaten (brukes av markeringene og demo-agenten)
  function roomsOf(sc) {
    var fit = SV.planFit(sc);
    return sc.rooms.map(function (r) { var xs = r.polygon.map(function (p) { return p[0]; }), ys = r.polygon.map(function (p) { return p[1]; }), x0 = Math.min.apply(0, xs), y0 = Math.min.apply(0, ys);
      return { id: r.id, name: r.label, area: r.area || null, x: fit.ox + x0 * fit.s, y: fit.oy + y0 * fit.s, w: (Math.max.apply(0, xs) - x0) * fit.s, h: (Math.max.apply(0, ys) - y0) * fit.s }; });
  }
  // etasjer per bolig: fra prosjektet, ellers ut fra boligtype
  SV.planFloors = function (j) {
    var live = j && SV.planLiveData(j), ids = live && Object.keys(live.scenes || {}).length ? Object.keys(live.scenes).sort(function (a, b) { return ['k', 'f1', 'f2', 'f3', 'l'].indexOf(a) - ['k', 'f1', 'f2', 'f3', 'l'].indexOf(b); }) :
      (j && j.floors) || (!j ? ['f1'] : /Enebolig|Gårdsbruk/.test(j.type) ? ['k', 'f1', 'f2'] : /Rekkehus|Fritidsbolig/.test(j.type) ? ['f1', 'f2'] : ['f1']);
    return ids.map(function (id) { return { id: id, name: FLOORS[id] ? FLOORS[id].name : (live && live.scenes[id] ? live.scenes[id].scene.floor_title : id) }; });
  };
  SV.planFloorName = function (f) { return FLOORS[f] ? FLOORS[f].name : f; };
  function ver(id) { var v = SV.state.planVer = SV.state.planVer || {}; return v[id]; }
  // scenen som gjelder: fra serveren (ekte drift) eller demoscenen
  SV.planScene = function (j, f) { var live = j && SV.planLiveData(j), sc = live && live.scenes && live.scenes[f || 'f1']; return sc ? sc.scene : SV.demoScene(f || 'f1', j ? j.office : 'kmh'); };
  SV.planModel = function (j, f) {
    var v = j && ver(j.id), rooms = roomsOf(SV.planScene(j, f)).map(function (r) { return Object.assign({}, r, v && v.rooms[r.id]); });
    return { rooms: rooms, v: v ? v.n : 1 };
  };

  // ---------- kontorstiler ----------
  SV.planStyle = function (office) { var k = SV.planStyleKey(office); return Object.assign({ key: k }, SV.planStyles[k]); };
  // SV.planSvg(j) tegner gjeldende versjon i kontorets stil. Uten jobb: standard.
  SV.planSvg = function (j, opts) {
    opts = opts || {};
    var f = opts.floor || 'f1', sc = opts.scene || SV.planScene(j, f), rooms = opts.rooms || (opts.scene ? null : SV.planModel(j, f).rooms), names = {}, areas = {};
    if (opts.style) sc = Object.assign({}, sc, { office: opts.style.key || SV.planStyleKey(opts.style) });
    (rooms || []).forEach(function (r) { names[r.id] = r.name; if (r.area) areas[r.id] = r.area; });
    return SV.sceneSvg(sc, { names: names, areas: areas, hl: opts.hl, diff: opts.diff, removed: opts.removed, title: opts.title });
  };

  // ---------- agenten (demo: regler; ekte: Claude) ----------
  var KINDS = [['walk-in', 'Walk-in'], ['garderobe', 'Garderobe'], ['vaskerom', 'Vaskerom'], ['soverom', 'Soverom'], ['kjøkken', 'Kjøkken'], ['kontor', 'Kontor'], ['entré', 'Entré'], ['gang', 'Gang'], ['stue', 'Stue'], ['bod', 'Bod'], ['bad', 'Bad'], ['wc', 'WC'], ['sov', 'Soverom']];
  function kindsIn(t) { var low = ' ' + t.toLowerCase() + ' ', out = []; KINDS.forEach(function (k) { var i = low.search(new RegExp('[^a-zæøå]' + k[0] + '(?:et|en|a|ene|ets)?[^a-zæøå]')); if (i > -1 && out.every(function (o) { return o.name !== k[1]; })) out.push({ name: k[1], i: i }); }); return out.sort(function (a, b) { return a.i - b.i; }); }
  function roomAt(rooms, x, y) { return rooms.filter(function (r) { return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; })[0]; }
  var FLOOR_WORDS = { k: /kjeller|underetasje/i, f1: /1\.?\s*(etasje|etg)|første etasje|hovedetasje/i, f2: /2\.?\s*(etasje|etg)|andre etasje|loft/i };
  SV.planAgent = function (j) {
    var src = SV.reviewPlanSrc(j) || { floors: {}, planNote: '' }, floors = SV.planFloors(j).map(function (f) { return f.id; });
    var M = {}; floors.forEach(function (f) { var before = SV.planModel(j, f).rooms; M[f] = { before: before, after: before.map(function (x) { return Object.assign({}, x); }) }; });
    var changes = [], manual = [], items = [];
    floors.forEach(function (f) {
      var m = src.floors[f]; if (!m) return; var fn = SV.planFloorName(f);
      m.pins.filter(function (p) { return p.t; }).forEach(function (p, k) { items.push({ f: f, t: p.t, x: p.x, y: p.y, src: fn + ', punkt ' + (k + 1) }); });
      m.texts.filter(function (p) { return p.t; }).forEach(function (p) { items.push({ f: f, t: p.t, x: p.x, y: p.y, src: fn + ', tekst' }); });
      if (m.strokes.length) manual.push(fn + ': tegning (' + m.strokes.length + ' strek' + (m.strokes.length > 1 ? 'er' : '') + '), se tegningen og vurder selv');
    });
    (src.planNote || '').split(/\n|\.\s+(?=[A-ZÆØÅ])/).filter(function (x) { return x.trim(); }).forEach(function (t) {
      // kommentar uten punkt: finn etasjen ut fra teksten, ellers den eneste/første som har rommet
      var f = floors.filter(function (id) { return FLOOR_WORDS[id] && FLOOR_WORDS[id].test(t); })[0];
      items.push({ f: f || null, t: t.trim(), src: 'Kommentar' });
    });
    items.forEach(function (it) {
      var ks = kindsIn(it.t), num = /(\d+(?:[.,]\d+)?)\s*(?:m2|m²|kvm)/i.exec(it.t), f = it.f, room = null, done = false;
      if (f && it.x != null) room = roomAt(M[f].after, it.x, it.y);
      if (!room && ks.length) {
        var want = ks[ks.length > 1 ? 1 : 0].name.toLowerCase(), alt = ks[0].name.toLowerCase();
        (f ? [f] : floors).some(function (fid) { room = M[fid].after.filter(function (x) { return x.name.toLowerCase() === want; })[0] || M[fid].after.filter(function (x) { return x.name.toLowerCase() === alt; })[0]; if (room) f = fid; return !!room; });
      }
      var fn = f ? SV.planFloorName(f) + ': ' : '';
      if (room && ks.length && (it.x != null || /ikke|skal være|er egentlig|feil/i.test(it.t))) {
        var to = ks[0].name;
        if (to.toLowerCase() !== room.name.toLowerCase()) { changes.push({ f: f, id: room.id, what: fn + 'romnavn', from: room.name, to: to, src: it.src + ': «' + it.t + '»' }); room.name = to; done = true; }
      }
      if (room && num) { var a = Math.round(parseFloat(num[1].replace(',', '.'))); if (a !== room.area) { changes.push({ f: f, id: room.id, what: fn + 'areal ' + room.name.toLowerCase(), from: (room.area || '–') + ' m²', to: a + ' m²', src: it.src + ': «' + it.t + '»' }); room.area = a; done = true; } }
      if (!done) manual.push(it.src + ': «' + it.t + '»');
    });
    return { floors: M, changes: changes, manual: manual, t: SV.fdate(D.iso(D.base)) };
  };

  SV.agentCard = function (j) {
    var p = (SV.state.agent || {})[j.id]; if (!p || !p.floors) return '';
    var s = SV.planStyle(j.office), touched = SV.planFloors(j).filter(function (f) { return p.changes.some(function (c) { return c.f === f.id; }); });
    var cmp = touched.map(function (f) {
      var hl = p.changes.filter(function (c) { return c.f === f.id; }).map(function (c) { return c.id; });
      return (touched.length > 1 || SV.planFloors(j).length > 1 ? '<p class="eyebrow" style="margin:12px 0 6px">' + esc(f.name) + '</p>' : '') + '<div class="ag-cmp"><figure><figcaption>Nå</figcaption><div class="ag-plan">' + SV.planSvg(j, { floor: f.id, rooms: p.floors[f.id].before }) + '</div></figure><figure><figcaption>Forslag</figcaption><div class="ag-plan">' + SV.planSvg(j, { floor: f.id, rooms: p.floors[f.id].after, hl: hl }) + '</div></figure></div>';
    }).join('');
    return '<div class="card pad ag"><div class="row between" style="gap:10px;flex-wrap:wrap;margin-bottom:12px"><div><p class="eyebrow">' + ic('bolt') + 'Plantegningsagent · forslag ' + esc(p.t) + '</p><h3 class="h3">Venter på din godkjenning</h3><p class="small muted" style="margin-top:2px">Stil: ' + esc(s.name) + ' (' + esc(SV.find(D.offices, j.office).name) + ')' + (touched.length ? ' · endrer ' + touched.map(function (f) { return f.name; }).join(' og ') : '') + '. Ingenting er synlig for megler før du godkjenner.</p></div>' +
      '<div class="row"><button class="btn btn-ghost btn-s" data-act="agReject" data-id="' + j.id + '">Avvis</button><button class="btn btn-acc btn-s" data-act="agOk" data-id="' + j.id + '"' + (p.changes.length ? '' : ' disabled') + '>' + ic('check') + 'Godkjenn og publiser</button></div></div>' + cmp +
      (p.changes.length ? '<ul class="ag-list">' + p.changes.map(function (c) { return '<li>' + ic('check') + '<span><b>' + esc(c.what.charAt(0).toUpperCase() + c.what.slice(1)) + ':</b> ' + esc(c.from) + ' → <b>' + esc(c.to) + '</b><small>' + esc(c.src) + '</small></span></li>'; }).join('') + '</ul>' : '<p class="small muted">Fant ingen endringer agenten kan gjøre selv.</p>') +
      (p.manual.length ? '<p class="eyebrow" style="margin:14px 0 6px">Må gjøres av deg</p><ul class="ag-list man">' + p.manual.map(function (m) { return '<li>' + ic('edit') + '<span>' + esc(m) + '</span></li>'; }).join('') + '</ul>' : '') + '</div>';
  };
  SV.runAgent = function (j) { var a = SV.state.agent = SV.state.agent || {}; a[j.id] = SV.planAgent(j); return a[j.id]; };
  SV.on('agRun', function (el) { var j = SV.find(SV.jobs(), el.getAttribute('data-id')), p = SV.runAgent(j); SV.save(); SV.render(); SV.toast('Agenten har laget et forslag: ' + p.changes.length + ' endringer, ' + p.manual.length + ' til deg'); });
  SV.on('agOk', function (el) {
    var j = SV.find(SV.jobs(), el.getAttribute('data-id')), p = SV.state.agent[j.id], v = SV.state.planVer = SV.state.planVer || {}, cur = v[j.id] || { n: 1, rooms: {} };
    Object.keys(p.floors).forEach(function (f) { p.floors[f].after.forEach(function (r) { cur.rooms[r.id] = { name: r.name, area: r.area }; }); }); cur.n++; v[j.id] = cur;
    var st = SV.state.agentStats = SV.state.agentStats || { ok: 0, rejected: 0 }; st.ok++;
    delete SV.state.agent[j.id];
    var q = SV.reviewOpenPlanReq(j); if (q) q.planVer = cur.n;
    SV.state.mailLog.unshift({ id: j.id, t: SV.fdate(D.iso(D.base)), to: j.broker, mail: 'megler', subj: 'Ny versjon av plantegningen: ' + j.addr, k: 'plan' });
    SV.save(); SV.render(); SV.toast('Plantegning versjon ' + cur.n + ' er publisert · megler får e-post');
  });
  SV.on('agReject', function (el) { var st = SV.state.agentStats = SV.state.agentStats || { ok: 0, rejected: 0 }; st.rejected++; delete SV.state.agent[el.getAttribute('data-id')]; SV.save(); SV.render(); SV.toast('Forslaget er avvist'); });

  // ---------- ekte drift: plantegningsagenten på serveren (api/planagent.php) ----------
  var API = location.pathname.replace(/\/portal(\/.*)?$/, '') + '/api/', LIVE = {}, BUSY = {};
  SV.planLiveData = function (j) {
    if (!SV.live || !j) return null;
    if (!LIVE[j.id] && !BUSY[j.id]) { BUSY[j.id] = 1; SV.planReload(j.id); }
    return LIVE[j.id] || null;
  };
  SV.planReload = function (id) {
    return fetch(API + 'planagent.php?job=' + encodeURIComponent(id), { credentials: 'same-origin', cache: 'no-store' }).then(function (r) { return r.json(); })
      .then(function (d) { LIVE[id] = d; BUSY[id] = 0; SV.render(); }).catch(function () { BUSY[id] = 0; });
  };
  function post(body) { return fetch(API + 'planagent.php', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(function (r) { return r.json(); }); }
  // gjør markeringene om til tekst agenten forstår: rom, posisjon i cm og kommentaren
  function requestText(j, f, m, note) {
    var sc = SV.planScene(j, f), lines = [];
    (m ? m.pins.concat(m.texts) : []).filter(function (p) { return p.t; }).forEach(function (p, k) {
      var cm = SV.planToCm(sc, p.x, p.y), r = SV.planRoomAt(sc, cm);
      lines.push('Markering ' + (k + 1) + ' ved x=' + cm[0] + ', y=' + cm[1] + ' cm' + (r ? ' (i rommet ' + r.label + ', ' + r.id + ')' : '') + ': «' + p.t + '»');
    });
    if (m && m.strokes.length) lines.push('(Personen har også tegnet ' + m.strokes.length + ' strek(er) på plantegningen. Dem kan du ikke se; si fra om det trengs.)');
    if (note) lines.push('Kommentar til hele plantegningen: «' + note + '»');
    return lines.join('\n');
  }
  function runLive(j) {
    var src = SV.reviewPlanSrc(j) || { floors: {}, planNote: '' }, live = LIVE[j.id], who = (SV.find(SV.data.team, j.by) || {}).name || j.broker || 'megler', n = 0;
    SV.planFloors(j).forEach(function (fl) {
      var m = src.floors[fl.id], one = SV.planFloors(j).length === 1 || (m && (m.pins.length || m.texts.length));
      var txt = requestText(j, fl.id, m, one || !Object.keys(src.floors).length ? src.planNote : '');
      if (!txt.trim() || !(live && live.scenes && live.scenes[fl.id])) return;
      n++; post({ a: 'run', job: j.id, floor: fl.id, text: txt, from: j.broker + ' (megler)' }).then(function (r) { if (!r.ok) SV.toast(r.error || 'Agenten feilet', 'warn'); SV.planReload(j.id); });
    });
    SV.toast(n ? 'Plantegningsagenten jobber med ' + n + ' etasje' + (n > 1 ? 'r' : '') + ' …' : 'Plantegningen er ikke lagt inn i portalen ennå. Agenten kan ikke kjøre.', n ? '' : 'warn');
    return { changes: [], manual: [] };
  }
  var demoRun = SV.runAgent;
  SV.runAgent = function (j) { return SV.live ? runLive(j) : demoRun(j); };
  var demoCard = SV.agentCard;
  SV.agentCard = function (j) { return SV.live ? SV.planLiveCard(j) : demoCard(j); };
  var TONE = { 'kjører': ['Jobber …', 'sand'], venter: ['Fortsetter snart', 'sand'], 'spørsmål': ['Spør om noe', 'bad'], 'til godkjenning': ['Venter på godkjenning', 'bad'], godkjent: ['Publisert', 'ok'], avvist: ['Avvist', 'mute'], svar: ['Ingen endring', 'mute'], feil: ['Feil', 'bad'] };
  SV.planLiveCard = function (j) {
    var d = SV.planLiveData(j); if (!d) return '<p class="small muted">Laster plantegningsagenten …</p>';
    var rows = (d.sessions || []).slice(0, 6), miss = SV.planFloors(j).filter(function (f) { return !(d.scenes || {})[f.id]; });
    var imp = miss.length ? '<div class="card pad" style="margin-bottom:12px"><p class="small"><b>Plantegningen er ikke lagt inn for ' + miss.map(function (f) { return esc(f.name); }).join(', ') + '.</b> Agenten trenger tegningen som scene (JSON).</p><div class="row" style="margin-top:8px;gap:6px;flex-wrap:wrap">' +
      miss.map(function (f) { return '<button class="btn btn-ghost btn-s" data-act="paImport" data-job="' + j.id + '" data-floor="' + f.id + '">Last opp ' + esc(f.name) + '</button>'; }).join('') + '</div></div>' : '';
    return imp + rows.map(function (r) {
      var t = TONE[r.status] || [r.status, 'mute'], cmp = '';
      if (r.status === 'til godkjenning' && r.draft && d.scenes[r.floor]) {
        var before = d.scenes[r.floor].scene, ids = (before.fixtures || []).map(function (x) { return x.id; }), after = r.draft;
        var added = (after.fixtures || []).filter(function (x) { return ids.indexOf(x.id) < 0 || JSON.stringify(x) !== JSON.stringify(before.fixtures.filter(function (y) { return y.id === x.id; })[0]); }).map(function (x) { return x.id; });
        var gone = (before.fixtures || []).filter(function (x) { return !(after.fixtures || []).some(function (y) { return y.id === x.id; }); });
        var hl = (after.rooms || []).filter(function (x) { var b = before.rooms.filter(function (y) { return y.id === x.id; })[0]; return !b || b.label !== x.label || b.surface !== x.surface; }).map(function (x) { return x.id; });
        cmp = '<div class="ag-cmp"><figure><figcaption>Nå</figcaption><div class="ag-plan">' + SV.sceneSvg(before, { removed: gone }) + '</div></figure><figure><figcaption>Forslag</figcaption><div class="ag-plan">' + SV.sceneSvg(after, { hl: hl, diff: added }) + '</div></figure></div>';
      }
      return '<div class="card pad ag" style="margin-bottom:12px"><div class="row between" style="gap:10px;flex-wrap:wrap;margin-bottom:10px"><div><p class="eyebrow">' + ic('bolt') + 'Plantegningsagent · ' + esc(SV.planFloorName(r.floor)) + ' · ' + esc(SV.fdate(r.created_at.slice(0, 10))) + '</p>' +
        '<p class="small" style="white-space:pre-line;margin-top:4px">' + esc(r.request) + '</p></div>' + SV.chip(t[0], t[1]) + '</div>' + cmp +
        (r.summary ? '<p class="small" style="margin-top:10px"><b>Agenten:</b> ' + esc(r.summary) + '</p>' : '') + (r.info ? '<p class="small muted">' + esc(r.info) + '</p>' : '') +
        (r.status === 'spørsmål' ? '<p class="small" style="margin-top:10px"><b>Spørsmål:</b> ' + esc(r.question) + '</p><div class="row" style="margin-top:8px;flex-wrap:nowrap"><input class="inp" id="paq' + r.id + '" placeholder="Svar"><button class="btn btn-dark btn-s" data-act="paAnswer" data-id="' + r.id + '" data-job="' + j.id + '">Send svar</button></div>' : '') +
        (r.status === 'til godkjenning' ? '<div class="row" style="margin-top:12px;justify-content:flex-end"><button class="btn btn-ghost btn-s" data-act="paReject" data-id="' + r.id + '" data-job="' + j.id + '">Avvis</button><button class="btn btn-acc btn-s" data-act="paOk" data-id="' + r.id + '" data-job="' + j.id + '">' + ic('check') + 'Godkjenn og publiser</button></div>' : '') +
        '<p class="hint" style="margin-top:8px">Kostnad: ' + (r.usd || 0).toFixed(3) + ' $</p></div>';
    }).join('');
  };
  function act(a, extra) { return function (el) { el.disabled = true; var body = Object.assign({ a: a, id: +el.getAttribute('data-id') }, extra ? extra(el) : {}), job = el.getAttribute('data-job');
    post(body).then(function (r) { SV.toast(r.ok ? (a === 'approve' ? 'Publisert som versjon ' + r.version : a === 'reject' ? 'Forslaget er avvist' : 'Svar sendt') : r.error || 'Feil', r.ok ? '' : 'warn'); SV.planReload(job); }); }; }
  SV.on('paOk', act('approve'));
  SV.on('paReject', act('reject'));
  SV.on('paAnswer', act('answer', function (el) { var i = document.getElementById('paq' + el.getAttribute('data-id')); return { text: i ? i.value : '' }; }));
  // legge inn plantegning (scene-JSON) for en etasje
  SV.on('paImport', function (el) {
    var job = el.getAttribute('data-job'), floor = el.getAttribute('data-floor'), inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = function () { var fr = new FileReader(); fr.onload = function () { var sc; try { sc = JSON.parse(fr.result); } catch (e) { SV.toast('Ikke gyldig JSON', 'warn'); return; }
      post({ a: 'save', job: job, floor: floor, scene: sc }).then(function (r) { SV.toast(r.ok ? 'Plantegningen er lagt inn (versjon ' + r.version + ')' : r.error, r.ok ? '' : 'warn'); SV.planReload(job); }); }; fr.readAsText(inp.files[0]); };
    inp.click();
  });

  // ---------- innstillinger: stiler og agent ----------
  SV.planSettings = function () {
    var ag = SV.state.agentCfg = SV.state.agentCfg || { approve: true, run: 'ved nytt ønske' }, st = SV.state.agentStats || { ok: 0, rejected: 0 };
    var cards = Object.keys(SV.planStyles).map(function (k) {
      var s = SV.planStyles[k], sw = function (c, l) { return '<span class="ps-sw"><i style="background:' + c + '"></i>' + l + '</span>'; };
      return '<div class="card pad"><p class="eyebrow">' + esc(s.name) + '</p><div class="ag-plan" style="margin:10px 0 12px">' + SV.sceneSvg(SV.demoScene('f1', k), { title: true }) + '</div>' +
        '<div class="ps-row">' + sw(s.wall, 'Vegger') + sw(s.room, 'Rom') + sw(s.wet, 'Våtrom') + sw(s.outdoor, 'Ute') + '</div><p class="small muted" style="margin-top:8px">Romnavn: ' + esc(s.font.split(',')[0].replace(/"/g, '')) + ' · Tittel: ' + esc(s.title.split(',')[0].replace(/"/g, '')) + (s.bug ? ' · Gul strek fra Cubicasa fjernes alltid' : '') + '</p></div>';
    }).join('');
    return '<div class="card pad ag" style="margin-bottom:18px"><div class="row between" style="gap:14px;flex-wrap:wrap"><div><p class="eyebrow">' + ic('bolt') + 'Plantegningsagent</p><h3 class="h3">Leser endringsønsker og lager forslag</h3><p class="small muted" style="margin-top:4px;max-width:620px">Når megler, kunde eller fotograf ber om endringer på plantegningen, endrer agenten tegningen (rom, dører, vinduer og inventar) og tegner den i kontorets husstil. Den kan stille ett spørsmål om noe er uklart, og den nekter endringer som ville gitt et feil bilde av boligen. Ingenting publiseres før du godkjenner.</p></div>' +
      '<dl class="kv small" style="min-width:220px"><dt>Kjører</dt><dd>Ved nytt endringsønske</dd><dt>Godkjenning</dt><dd><label class="opt nobox" style="padding:0"><input type="checkbox" data-change="agApprove"' + (ag.approve ? ' checked' : '') + '><b>Alltid krev min godkjenning</b></label></dd><dt>Så langt</dt><dd>' + st.ok + ' godkjent · ' + st.rejected + ' avvist</dd></dl></div></div>' +
      '<div class="g2">' + cards + '</div><p class="hint">Husstilen er fast per meglerkontor og kan ikke endres av agenten. Rammen (logoer, tittel og ansvarsfraskrivelse) følger kontorets mal.</p>';
  };
  SV.on('agApprove', function (el) { SV.state.agentCfg.approve = el.checked; SV.save(); SV.toast(el.checked ? 'Du godkjenner alle forslag før de publiseres' : 'Agenten publiserer selv · du får varsel', el.checked ? '' : 'warn'); });

  // ---------- ferdige plantegninger (Cubicasa-PDF → kontorets mal), api/floorjobs.php ----------
  var FP = {}, FPB = {};
  function fpLoad(id) { if (FPB[id]) return; FPB[id] = 1; fetch(API + 'floorjobs.php?job=' + encodeURIComponent(id), { credentials: 'same-origin', cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) { FP[id] = d; FPB[id] = 0; SV.render(); }).catch(function () { FPB[id] = 0; }); }
  var FPT = { venter: ['Venter på agenten', 'sand'], 'kjører': ['Lager plantegninger …', 'sand'], levert: ['Levert', 'ok'], sjekk: ['Må sjekkes', 'bad'], feil: ['Feil', 'bad'] };
  SV.fpCard = function (j) {
    var form = '<form id="fpF" class="fp-form"><label class="fld"><span>Cubicasa-PDF (uten mål)</span><input class="inp" type="file" name="pdf" accept="application/pdf"' + (SV.live ? '' : ' disabled') + '></label>' +
      '<label class="fld"><span>Første etasje, eller alle etasjene med komma</span><input class="inp" name="first" list="fpFloors" value="' + (/Leilighet/i.test(j.type || '') ? 'Leilighet' : /Enebolig|Gårdsbruk/.test(j.type || '') ? 'Kjeller' : '1.etasje') + '"><datalist id="fpFloors"><option>Kjeller<option>1.etasje<option>Leilighet<option>1.etasje, 2.etasje, Loft</datalist></label>' +
      '<label class="fld"><span>Merknad til agenten <span class="muted">(valgfritt)</span></span><input class="inp" name="notes" placeholder="F.eks. bruk PDF-en med mål"></label>' +
      '<button class="btn btn-dark btn-s" data-act="fpSend" data-id="' + esc(j.id) + '"' + (SV.live ? '' : ' disabled') + '>Lag plantegninger</button></form>';
    var list = '';
    if (SV.live) {
      var d = FP[j.id]; if (!d) fpLoad(j.id);
      list = !d ? '<p class="small muted">Laster …</p>' : (d.jobs || []).map(function (r) {
        var t = FPT[r.status] || [r.status, 'mute'], files = r.files || [];
        return '<div class="fp-job"><div class="row between" style="gap:8px"><span class="small">' + esc(SV.fdate(r.created_at.slice(0, 10))) + ' · første etasje: ' + esc(r.first_floor) + '</span>' + SV.chip(t[0], t[1]) + '</div>' +
          (r.summary ? '<p class="small" style="margin-top:6px">' + esc(r.summary) + '</p>' : '') + (r.reason ? '<p class="small" style="margin-top:6px;color:var(--bad)">' + esc(r.reason) + '</p>' : '') +
          (files.length ? '<div class="fp-files">' + files.map(function (f) { var u = API + 'floorjobs.php?a=file&id=' + r.id + '&name=' + encodeURIComponent(f.name); return '<a href="' + u + '" target="_blank" rel="noopener"><img src="' + u + '" alt="' + esc(f.floor || f.name) + '" loading="lazy"><span>' + esc(f.floor || f.name) + '</span></a>'; }).join('') + '</div><p class="small"><a href="' + API + 'floorjobs.php?a=file&id=' + r.id + '&name=' + encodeURIComponent(files[0].name) + '&dl=1">Last ned</a>' + (files.length > 1 ? ' (klikk på hver etasje for de andre)' : '') + '</p>' : '') +
          (r.status === 'sjekk' || r.status === 'feil' ? '<button class="link small" data-act="fpRetry" data-id="' + r.id + '" data-job="' + esc(j.id) + '">Kjør på nytt</button>' : '') +
          '<p class="hint">Kostnad: ' + (r.usd || 0).toFixed(3) + ' $</p></div>';
      }).join('');
    }
    return '<div class="card"><div class="card-h"><h3>Plantegninger</h3></div><div class="card-b" style="padding-top:0"><p class="small muted" style="margin-bottom:10px">Agenten lager ferdige plantegninger i ' + esc((SV.find(SV.data.offices, j.office) || {}).name || 'kontorets') + ' sin mal, sjekker dem og legger dem her. Den starter innen 15 minutter etter opplasting.' + (SV.live ? '' : ' Fungerer på studiovest.no.') + '</p>' + form + list + '</div></div>';
  };
  SV.on('fpSend', function (el, ev) {
    if (ev) ev.preventDefault(); var f = document.getElementById('fpF'), id = el.getAttribute('data-id');
    if (!f.pdf.files.length) { SV.toast('Velg Cubicasa-PDF-en', 'warn'); return; }
    var fd = new FormData(f); fd.append('job', id); el.disabled = true; el.textContent = 'Laster opp …';
    fetch(API + 'floorjobs.php', { method: 'POST', credentials: 'same-origin', body: fd }).then(function (r) { return r.json(); })
      .then(function (r) { SV.toast(r.ok ? 'Lagt i kø. Agenten starter innen 15 minutter.' : r.error, r.ok ? '' : 'warn'); FPB[id] = 0; FP[id] = null; fpLoad(id); })
      .catch(function () { SV.toast('Opplastingen feilet', 'warn'); el.disabled = false; });
  });
  SV.on('fpRetry', function (el) { var job = el.getAttribute('data-job'); post0({ a: 'retry', id: +el.getAttribute('data-id') }).then(function () { FP[job] = null; fpLoad(job); SV.toast('Lagt i kø igjen'); }); });
  function post0(b) { return fetch(API + 'floorjobs.php', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then(function (r) { return r.json(); }); }
})();
