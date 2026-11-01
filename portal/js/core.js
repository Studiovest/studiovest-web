/* Studiovest portal — kjerne: ruter, skall, hjelpefunksjoner, ikoner, modaler. */
(function () {
  'use strict';
  var D = window.SV_DATA;
  var SV = window.SV = { data: D, routes: [], acts: {}, afters: [] };
  SV.on = function (name, fn) { SV.acts[name] = fn; };

  // ---------- tilstand (demo; lagres i nettleseren hvis mulig) ----------
  var KEY = 'sv-portal-demo-1';
  SV.state = { stage: {}, newJobs: [], cart: [], paid: [], favs: {}, comments: [], autos: {}, consents: {}, approved: {}, postStatus: {}, retake: false, deleteReq: false, read: false };
  try { var saved = JSON.parse(localStorage.getItem(KEY) || 'null'); if (saved) Object.assign(SV.state, saved); } catch (e) {}
  SV.save = function () { try { localStorage.setItem(KEY, JSON.stringify(SV.state)); } catch (e) {} };
  SV.reset = function () { try { localStorage.removeItem(KEY); } catch (e) {} location.hash = '#/'; location.reload(); };

  // ---------- hjelpere ----------
  var esc = SV.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  SV.kr = function (n) { return Math.round(n).toLocaleString('nb-NO').replace(/ |,/g, ' ') + ' kr'; };
  SV.num = function (n) { return Math.round(n).toLocaleString('nb-NO').replace(/ |,/g, ' '); };
  var WD = ['søn.', 'man.', 'tir.', 'ons.', 'tor.', 'fre.', 'lør.'], WDL = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag'];
  var MO = ['jan.', 'feb.', 'mar.', 'apr.', 'mai', 'jun.', 'jul.', 'aug.', 'sep.', 'okt.', 'nov.', 'des.'];
  SV.parse = function (s) { if (!s) return null; var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); };
  SV.fdate = function (s, long) { var d = SV.parse(s); if (!d) return '–'; return (long ? WDL[d.getDay()] + ' ' : WD[d.getDay()] + ' ') + d.getDate() + '. ' + MO[d.getMonth()]; };
  SV.dayName = function (s) { var d = SV.parse(s); return d ? WDL[d.getDay()] : ''; };
  SV.diff = function (s) { var d = SV.parse(s); if (!d) return null; return Math.round((d - D.today) / 864e5); };
  SV.rel = function (s) {
    var n = SV.diff(s); if (n === null) return '–';
    if (n === 0) return 'i dag'; if (n === 1) return 'i morgen'; if (n === -1) return 'i går';
    return n > 0 ? 'om ' + n + ' dager' : 'for ' + (-n) + ' dager siden';
  };
  SV.find = function (arr, id, k) { k = k || 'id'; for (var i = 0; i < arr.length; i++) if (arr[i][k] === id) return arr[i]; return null; };
  SV.areaName = { bolig: 'Bolig', bedrift: 'Bedrift', skole: 'Skolefoto', mark: 'Markedsføring' };

  var TONE = {
    'Bestilt': 'sand', 'Planlagt': 'ink', 'Fotografert': 'sage', 'Redigering': 'brown', 'Levert': 'ok',
    'Betalt': 'ok', 'Sendt': 'ink', 'Forfalt': 'bad', 'Utkast': 'mute', 'Løpende': 'sage',
    'Ja': 'ok', 'Nei': 'bad', 'Kun gruppebilde': 'sand', 'Ikke svart': 'mute', 'Tatt': 'ok', 'Fravær': 'sand', 'Skal ikke': 'bad', 'Kun gruppe': 'sand',
    'Signert': 'ok', 'Venter': 'sand', 'Ikke sendt': 'mute',
    'Forespørsel': 'mute', 'Tilbud sendt': 'sand', 'Planlegging': 'ink', 'Produksjon': 'brown', 'Gjennomgang': 'sand',
    'Idé': 'mute', 'Til godkjenning': 'sand', 'Publisert': 'ok', 'Aktiv': 'ok',
    'Avtale': 'mute', 'Forberedelse': 'ink', 'Bestilling åpen': 'sand', 'Fotodag': 'brown',
    'Åpnet': 'ok', 'Levert ': 'ok', 'Klikket': 'ok'
  };
  SV.chip = function (t, tone) { return '<span class="chip chip-' + (tone || TONE[t] || 'mute') + '">' + esc(t) + '</span>'; };
  SV.dot = function (area) { return '<i class="adot a-' + area + '" aria-hidden="true"></i>'; };

  // ---------- ikoner (egne, tynne strek) ----------
  var I = {
    home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
    cal: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
    users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21c0-4 3-6 7-6s7 2 7 6M16 3.5a4 4 0 0 1 0 7.5M18 15c2.4.6 4 2.4 4 6',
    box: 'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10',
    bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
    mail: 'M3 5h18v14H3zM3 6l9 7 9-7',
    wallet: 'M3 6h15a3 3 0 0 1 3 3v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM3 6l12-3v3M16 13h2',
    house: 'M4 10l8-6 8 6v10H4zM10 20v-6h4v6',
    brief: 'M3 8h18v12H3zM8 8V5h8v3M3 13h18',
    school: 'M2 9l10-5 10 5-10 5zM6 11v5c3 2 9 2 12 0v-5M22 9v6',
    mega: 'M3 10v4l4 1 9 5V4L7 9zM7 9v6M19 9a3 3 0 0 1 0 6',
    info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 11v6M12 7.5v.5',
    search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5',
    bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4',
    plus: 'M12 5v14M5 12h14',
    down: 'M12 4v12M7 11l5 5 5-5M5 20h14',
    up: 'M12 20V8M7 13l5-5 5 5M5 4h14',
    check: 'M5 12l5 5 9-10',
    x: 'M6 6l12 12M18 6L6 18',
    heart: 'M12 20s-7-4.4-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.6-9 9-9 9z',
    play: 'M7 4l13 8-13 8z',
    pause: 'M7 4h4v16H7zM13 4h4v16h-4z',
    clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
    pin: 'M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
    cam: 'M3 8h4l2-3h6l2 3h4v12H3zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    drone: 'M5 5h4M15 5h4M7 5v3M17 5v3M7 8h10v3a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2zM10 13l-2 4M14 13l2 4',
    video: 'M3 6h12v12H3zM15 10l6-3v10l-6-3',
    plan: 'M3 3h18v18H3zM3 12h8V3M11 21v-5h10M15 12h6',
    lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
    chev: 'M9 6l6 6-6 6',
    back: 'M15 6l-6 6 6 6',
    qr: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM18 18h3v3h-3zM18 14h3M14 18v3',
    sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.6-1.6M18.4 5.6l1.4-1.4',
    wind: 'M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8',
    shield: 'M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z',
    trash: 'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14',
    edit: 'M4 20h4L20 8l-4-4L4 16zM14 6l4 4',
    upload: 'M12 16V4M7 9l5-5 5 5M5 20h14',
    link: 'M10 14a4 4 0 0 0 5.6 0l3-3a4 4 0 0 0-5.6-5.6L11.5 7M14 10a4 4 0 0 0-5.6 0l-3 3a4 4 0 0 0 5.6 5.6L12.5 17',
    menu: 'M4 7h16M4 12h16M4 17h16',
    chat: 'M4 4h16v12H8l-4 4z',
    star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
    folder: 'M3 6h6l2 2h10v11H3z',
    grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
    list: 'M8 6h13M8 12h13M8 18h13M3 6h1M3 12h1M3 18h1',
    route: 'M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6 15V9a4 4 0 0 1 4-4h6M18 9v6a4 4 0 0 1-4 4H8',
    eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    file: 'M6 2h9l5 5v15H6zM14 2v6h6',
    sign: 'M3 17c3 0 4-8 6-8s0 8 3 8 3-4 5-4 2 3 4 3M3 21h18',
    gift: 'M3 9h18v4H3zM5 13h14v8H5zM12 9v12M12 9c-2-4-6-4-6-1s4 1 6 1c2 0 6 2 6-1s-4-3-6 1'
  };
  SV.icon = function (n, cls) { return '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true"><path d="' + (I[n] || I.info) + '"/></svg>'; };
  SV.topo = function () { return '<svg class="topo" aria-hidden="true"><use href="#topo"/></svg>'; };
  SV.ap = function (c) { return '<svg class="ap ' + (c || '') + '" aria-hidden="true"><use href="#ap"/></svg>'; };
  SV.thumb = function (src) { var m = /photos\/([\w-]+)\.jpg$/.exec(src || ''); return m ? 'img/' + m[1] + '-720.jpg' : src; };
  SV.pic = function (src, pos, cls, alt) { return '<img src="' + SV.thumb(src) + '" alt="' + esc(alt || '') + '" loading="lazy" class="' + (cls || '') + '" style="object-position:' + (pos || '50% 50%') + '">'; };
  SV.avatar = function (name, cls) { var p = String(name).split(' '); var s = (p[0][0] || '') + (p.length > 1 ? p[p.length - 1][0] : ''); return '<span class="av ' + (cls || '') + '" aria-hidden="true">' + esc(s.toUpperCase()) + '</span>'; };
  SV.bar = function (v, max, area) { var pc = Math.max(0, Math.min(100, max ? v / max * 100 : 0)); return '<span class="bar"><i class="' + (area ? 'a-' + area : '') + '" style="width:' + pc.toFixed(1) + '%"></i></span>'; };

  SV.head = function (o) {
    return '<header class="ph">' +
      '<div class="ph-text">' + (o.eyebrow ? '<p class="eyebrow">' + o.eyebrow + '</p>' : '') +
      '<h1 class="ph-title"><span class="serif">' + esc(o.a) + '</span>' + (o.b ? ' <span class="bold">' + esc(o.b) + '</span>' : '') + '</h1>' +
      (o.lead ? '<p class="ph-lead">' + o.lead + '</p>' : '') + '</div>' +
      (o.actions ? '<div class="ph-act">' + o.actions + '</div>' : '') + '</header>';
  };
  SV.tabs = function (id, items, active) {
    return '<div class="tabs" role="tablist" data-tabs="' + id + '">' + items.map(function (t) {
      var k = t[0]; return '<button type="button" role="tab" class="tab' + (k === active ? ' on' : '') + '" data-act="tab" data-tab="' + k + '" aria-selected="' + (k === active) + '">' + t[1] + (t[2] != null ? ' <span class="tab-n">' + t[2] + '</span>' : '') + '</button>';
    }).join('') + '</div>';
  };
  SV.on('tab', function (el) {
    var wrap = el.closest('[data-tabs]'), id = wrap.getAttribute('data-tabs'), k = el.getAttribute('data-tab');
    wrap.querySelectorAll('.tab').forEach(function (b) { var on = b === el; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    document.querySelectorAll('[data-panels="' + id + '"] > [data-panel]').forEach(function (p) { p.hidden = p.getAttribute('data-panel') !== k; });
  });
  SV.panels = function (id, map, active) {
    return '<div data-panels="' + id + '">' + Object.keys(map).map(function (k) { return '<section data-panel="' + k + '"' + (k === active ? '' : ' hidden') + '>' + map[k] + '</section>'; }).join('') + '</div>';
  };

  // ---------- handlinger (delegert) ----------
  function on(name, fn) { SV.acts[name] = fn; }
  SV.on = on;
  // (SV.on brukt over før definisjon: registrer tab på nytt)
  document.addEventListener('click', function (ev) {
    var el = ev.target.closest('[data-act]'); if (!el) return;
    var fn = SV.acts[el.getAttribute('data-act')]; if (!fn) return;
    if (el.tagName === 'A' && el.getAttribute('href') === '#') ev.preventDefault();
    fn(el, ev);
  });
  document.addEventListener('change', function (ev) {
    var el = ev.target.closest('[data-change]'); if (!el) return;
    var fn = SV.acts[el.getAttribute('data-change')]; if (fn) fn(el, ev);
  });
  document.addEventListener('input', function (ev) {
    var el = ev.target.closest('[data-input]'); if (!el) return;
    var fn = SV.acts[el.getAttribute('data-input')]; if (fn) fn(el, ev);
  });
  SV.after = function (fn) { SV.afters.push(fn); };

  // ---------- lag: modal, skuff, toast ----------
  var layer = function () { return document.getElementById('layer'); };
  var lastFocus = null;
  SV.modal = function (html, o) {
    o = o || {}; lastFocus = document.activeElement;
    layer().innerHTML = '<div class="scrim" data-act="close"></div><div class="' + (o.drawer ? 'drawer' : 'modal') + (o.wide ? ' wide' : '') + '" role="dialog" aria-modal="true" tabindex="-1">' +
      '<button type="button" class="x-btn" data-act="close" aria-label="Lukk">' + SV.icon('x') + '</button>' + html + '</div>';
    document.body.classList.add('has-layer');
    var box = layer().querySelector('[role=dialog]'); requestAnimationFrame(function () { layer().classList.add('open'); box.focus(); });
    if (o.after) o.after(box);
  };
  SV.drawer = function (html, o) { o = o || {}; o.drawer = true; SV.modal(html, o); };
  SV.close = function () { layer().classList.remove('open'); document.body.classList.remove('has-layer'); setTimeout(function () { if (!layer().classList.contains('open')) layer().innerHTML = ''; }, 260); if (lastFocus && lastFocus.focus) lastFocus.focus(); };
  on('close', function () { SV.close(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && document.body.classList.contains('has-layer')) SV.close(); });
  var toastT;
  SV.toast = function (msg, kind) {
    var t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    SV._toastAt = Date.now(); t.className = 'toast ' + (kind || ''); t.innerHTML = SV.icon(kind === 'warn' ? 'info' : 'check') + '<span>' + msg + '</span>';
    requestAnimationFrame(function () { t.classList.add('show'); });
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('show'); }, 3200);
  };

  // ---------- ruter ----------
  SV.route = function (pattern, role, fn, meta) {
    var keys = [], re = new RegExp('^' + pattern.replace(/:(\w+)/g, function (_, k) { keys.push(k); return '([^/]+)'; }) + '/?$');
    SV.routes.push({ re: re, keys: keys, role: role, fn: fn, meta: meta || {}, pattern: pattern });
  };
  SV.go = function (h) { if (location.hash === h) render(); else location.hash = h; };
  on('go', function (el) { SV.go(el.getAttribute('data-href')); });

  var ROLES = [
    ['studio', 'Studio', '#/'], ['dag', 'Fotograf', '#/dag'], ['red', 'Redigering', '#/redigering'], '|',
    ['megler', 'Megler', '#/kunde/megler'], ['selger', 'Selger', '#/selger/B-2614'], '|',
    ['bedrift', 'Bedrift', '#/kunde/bedrift'], ['ansatt', 'Ansatt', '#/samtykke'], '|',
    ['skole', 'Skole', '#/kunde/skole'], ['foresatt', 'Foresatt', '#/kunde/foresatt']
  ];
  SV.ROLES = ROLES;

  var NAV = [
    { h: '' , items: [['#/', 'home', 'Oversikt']] },
    { h: 'Felt', items: [['#/bolig', 'house', 'Bolig', 'bolig'], ['#/bedrift', 'brief', 'Bedrift', 'bedrift'], ['#/skole', 'school', 'Skolefoto', 'skole'], ['#/marked', 'mega', 'Markedsføring', 'mark']] },
    { h: 'Drift', items: [['#/kalender', 'cal', 'Kalender'], ['#/kunder', 'users', 'Kunder'], ['#/lagring', 'box', 'Lagring'], ['#/automatisering', 'bolt', 'Automatisering'], ['#/epost', 'mail', 'E-post og varsler'], ['#/okonomi', 'wallet', 'Økonomi']] },
    { h: 'Om portalen', items: [['#/innsikt', 'info', 'Behov og innsikt']] }
  ];

  function demoBar(role) {
    return '<div class="demobar"><span class="db-l"><b>Demo</b><span class="db-hide"> · dummydata, ingen innlogging</span></span>' +
      '<nav class="db-roles" aria-label="Vis portalen som">' + '<span class="db-hide db-lbl">Vis som</span>' +
      ROLES.map(function (r) { if (r === '|') return '<i class="db-sep" aria-hidden="true"></i>'; return '<a href="' + r[2] + '" class="' + (r[0] === role ? 'on' : '') + '"' + (r[0] === role ? ' aria-current="page"' : '') + '>' + r[1] + '</a>'; }).join('') + '</nav>' +
      '<select class="db-sel" aria-label="Vis portalen som" data-change="roleSel">' + ROLES.filter(function (r) { return r !== '|'; }).map(function (r) { return '<option value="' + r[2] + '"' + (r[0] === role ? ' selected' : '') + '>' + r[1] + '</option>'; }).join('') + '</select>' +
      '<button type="button" class="db-reset" data-act="reset" title="Tilbakestill demoen">Nullstill</button></div>';
  }
  on('reset', function () { SV.reset(); });
  on('roleSel', function (el) { location.hash = el.value; });
  // velkomstboks bare første gang; deretter en rolig linje
  SV.intro = function (key, full, compact) {
    SV.state.seen = SV.state.seen || {};
    if (SV.state.seen[key]) return compact;
    SV.after(function () { SV.state.seen[key] = true; SV.save(); });
    return full;
  };

  function studioShell(inner, hash) {
    var navHtml = NAV.map(function (g) {
      return '<div class="nav-g">' + (g.h ? '<p class="nav-h">' + g.h + '</p>' : '') + g.items.map(function (it) {
        var active = it[0] === '#/' ? (hash === '#/' || hash === '') : (hash === it[0] || hash.indexOf(it[0] + '/') === 0);
        return '<a href="' + it[0] + '" class="nav-a' + (active ? ' on' : '') + '"' + (active ? ' aria-current="page"' : '') + '>' + SV.icon(it[1]) + '<span>' + it[2] + '</span>' + (it[3] ? '<i class="adot a-' + it[3] + '"></i>' : '') + '</a>';
      }).join('') + '</div>';
    }).join('');
    return demoBar('studio') +
      '<div class="shell">' +
      '<aside class="side" id="side">' + SV.topo() +
        '<a href="#/" class="side-logo" aria-label="Studiovest portal, oversikt"><span class="serif">STUDIO</span><span class="bold">VEST</span><span class="madi">portal</span></a>' +
        '<nav class="side-nav" aria-label="Hovedmeny">' + navHtml + '</nav>' +
        '<div class="side-foot">' + SV.avatar('Aleksander Koløy') + '<div><b>Aleksander</b><span>Daglig leder</span></div></div>' +
      '</aside>' +
      '<div class="main">' +
        '<div class="topbar">' +
          '<button type="button" class="ib side-btn" data-act="side" aria-label="Meny">' + SV.icon('menu') + '</button>' +
          '<label class="search">' + SV.icon('search') + '<input type="search" placeholder="Søk etter adresse, kunde, skole, elev…" data-input="search" aria-label="Søk"><div class="search-res" id="searchRes"></div></label>' +
          '<div class="tb-r">' +
            '<button type="button" class="ib bell' + (SV.state.read ? '' : ' unread') + '" data-act="bell" aria-label="Varsler">' + SV.icon('bell') + '</button>' +
            '<button type="button" class="btn btn-dark btn-s" data-act="quickNew">' + SV.icon('plus') + '<span>Ny</span></button>' +
          '</div>' +
        '</div>' +
        '<main class="page" id="page" tabindex="-1">' + inner + '</main>' +
      '</div></div>';
  }
  on('side', function () { document.body.classList.toggle('side-open'); });

  function clientShell(role, inner, hash, cfg) {
    if (cfg.bare) return demoBar(role) + '<div class="bare c-' + role + '"><main class="bpage" id="page" tabindex="-1">' + inner + '</main></div>';
    var tabs = cfg.tabs.map(function (t) {
      var active = hash === t[0] || (t[0] !== cfg.home && hash.indexOf(t[0] + '/') === 0) || (t[0] === cfg.home && hash === cfg.home);
      return '<a href="' + t[0] + '" class="ct' + (active ? ' on' : '') + '"' + (active ? ' aria-current="page"' : '') + '>' + t[1] + '</a>';
    }).join('');
    return demoBar(role) +
      '<div class="cshell c-' + role + '">' +
      '<header class="ctop">' +
        '<div class="ctop-row">' +
          '<a href="' + cfg.home + '" class="clogo"><span class="serif">STUDIO</span><span class="bold">VEST</span></a>' +
          '<span class="cx" aria-hidden="true">×</span>' +
          '<span class="corg">' + esc(cfg.org) + '</span>' +
          '<div class="cuser">' + SV.avatar(cfg.user) + '<div><b>' + esc(cfg.user) + '</b><span>' + esc(cfg.userRole) + '</span></div></div>' +
        '</div>' +
        (tabs ? '<nav class="ctabs" aria-label="Portal">' + tabs + '</nav>' : '') +
      '</header>' +
      '<main class="cpage" id="page" tabindex="-1">' + inner + '</main>' +
      '<footer class="cfoot"><span>Studiovest · Eidsvik, Halsnøy · kontakt@studiovest.no</span><span class="madi">med samme blikk</span></footer>' +
      '</div>';
  }
  SV.clientCfg = {};

  function render() {
    var hash = location.hash || '#/';
    if (hash === '#') hash = '#/';
    var path = hash.slice(1) || '/';
    var r = null, params = {};
    var ordered = SV.routes.filter(function (x) { return !x.keys.length; }).concat(SV.routes.filter(function (x) { return x.keys.length; }));
    for (var i = 0; i < ordered.length; i++) {
      var m = ordered[i].re.exec(path);
      if (m) { r = ordered[i]; r.keys.forEach(function (k, j) { params[k] = decodeURIComponent(m[j + 1]); }); break; }
    }
    if (!r) { r = SV.routes[0]; }
    SV.afters = [];
    var inner;
    try { inner = r.fn(params); } catch (e) { console.error(e); inner = '<div class="card pad"><h2>Noe gikk galt</h2><p>' + esc(e.message) + '</p></div>'; }
    var app = document.getElementById('app');
    app.innerHTML = r.role === 'studio' ? studioShell(inner, hash) : clientShell(r.role, inner, hash, SV.clientCfg[r.role]);
    document.body.className = 'role-' + r.role;
    document.title = (r.meta.title ? r.meta.title + ' · ' : '') + 'Studiovest Portal';
    SV.afters.forEach(function (f) { try { f(); } catch (e) { console.error(e); } });
    window.scrollTo(0, 0);
    if (SV._focus) { var p = document.getElementById('page'); if (p) p.focus({ preventScroll: true }); }
    SV._focus = true;
  }
  SV.render = render;

  // ---------- søk ----------
  on('search', function (el) {
    var q = el.value.trim().toLowerCase(), box = document.getElementById('searchRes');
    if (q.length < 2) { box.innerHTML = ''; box.classList.remove('open'); return; }
    var res = [];
    D.boligJobs.concat(SV.state.newJobs).forEach(function (j) { if ((j.addr + ' ' + j.town + ' ' + j.broker + ' ' + j.seller + ' ' + j.id).toLowerCase().indexOf(q) > -1) res.push(['#/bolig/' + j.id, 'bolig', j.addr + ', ' + j.town, j.broker]); });
    D.bizProjects.forEach(function (p) { var c = SV.find(D.companies, p.company); if ((p.title + ' ' + c.name).toLowerCase().indexOf(q) > -1) res.push(['#/bedrift/' + p.id, 'bedrift', p.title, c.name]); });
    D.schoolDays.forEach(function (s) {
      if (s.school.toLowerCase().indexOf(q) > -1) res.push(['#/skole/' + s.id, 'skole', s.school, s.phase]);
      s.classes.forEach(function (c) { c.pupils.forEach(function (p) { if (p.name.toLowerCase().indexOf(q) > -1) res.push(['#/skole/' + s.id + '/elever', 'skole', p.name, s.school + ' · ' + c.name]); }); });
    });
    D.companies.forEach(function (c) { if (c.name.toLowerCase().indexOf(q) > -1) res.push(['#/kunder', 'bedrift', c.name, 'Kunde']); });
    box.innerHTML = res.length ? res.slice(0, 8).map(function (r) { return '<a href="' + r[0] + '">' + SV.dot(r[1]) + '<span><b>' + esc(r[2]) + '</b><small>' + esc(r[3]) + '</small></span></a>'; }).join('') : '<p class="muted">Ingen treff for «' + esc(q) + '»</p>';
    box.classList.add('open');
  });
  document.addEventListener('click', function (e) { if (!e.target.closest('.search')) { var b = document.getElementById('searchRes'); if (b) b.classList.remove('open'); } });

  on('bell', function (el) {
    SV.state.read = true; SV.save(); el.classList.remove('unread');
    SV.drawer('<p class="eyebrow">Varsler</p><h2 class="h2"><span class="serif">Siste</span> <span class="bold">aktivitet</span></h2><ul class="feed">' +
      D.activity.map(function (a) { return '<li>' + SV.dot(a.area) + '<span>' + a.text + '</span><time>' + a.t + '</time></li>'; }).join('') + '</ul>');
  });
  on('quickNew', function () {
    SV.modal('<p class="eyebrow">Opprett</p><h2 class="h2"><span class="serif">Hva vil</span> <span class="bold">du lage?</span></h2><div class="quick">' +
      [['#/kunde/megler/bestill', 'house', 'bolig', 'Boligoppdrag', 'Samme skjema som megler bruker'],
       ['#/bedrift', 'brief', 'bedrift', 'Bedriftsprosjekt', 'Brief, opptaksliste og tilbud'],
       ['#/skole', 'school', 'skole', 'Fotodag', 'Skole eller barnehage'],
       ['#/marked', 'mega', 'mark', 'Innlegg', 'I innholdskalenderen']].map(function (q) {
        return '<a href="' + q[0] + '" class="quick-a" data-act="close">' + '<span class="qi a-' + q[2] + '">' + SV.icon(q[1]) + '</span><b>' + q[3] + '</b><small>' + q[4] + '</small></a>';
      }).join('') + '</div>');
  });

  // ---------- start ----------
  SV.start = function () {
    SV._focus = false;
    window.addEventListener('hashchange', function () { var tt = document.getElementById('toast'); if (tt && Date.now() - (SV._toastAt || 0) > 600) tt.classList.remove('show'); document.body.classList.remove('side-open'); SV.close(); render(); });
    render();
  };

  // Felles: enkel søylegraf (SVG)
  SV.bars = function (labels, series, h) {
    h = h || 160; var keys = Object.keys(series), n = labels.length, max = 0;
    for (var i = 0; i < n; i++) { var s = 0; keys.forEach(function (k) { s += series[k][i]; }); max = Math.max(max, s); }
    max = Math.ceil(max / 50) * 50 || 1;
    var w = 100 / n, out = '<div class="chart" style="--h:' + h + 'px"><div class="ch-grid">';
    [1, 0.5, 0].forEach(function (f) { out += '<span style="bottom:' + (f * 100) + '%"><em>' + Math.round(max * f) + '</em></span>'; });
    out += '</div><div class="ch-cols">';
    for (var j = 0; j < n; j++) {
      var tot = 0, stack = keys.map(function (k) { tot += series[k][j]; return '<i class="a-' + k + '" style="height:' + (series[k][j] / max * 100) + '%" title="' + SV.areaName[k] + ': ' + series[k][j] + ' 000 kr"></i>'; }).join('');
      out += '<div class="ch-col"><div class="ch-stack" aria-label="' + labels[j] + ': ' + tot + ' 000 kr">' + stack + '</div><span class="ch-l">' + labels[j] + '</span></div>';
    }
    return out + '</div></div>';
  };
})();
