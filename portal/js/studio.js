/* Studio: oversikt, kalender, kunder, lagring, automatisering, e-post og økonomi. */
(function () {
  'use strict';
  var SV = window.SV, D = SV.data, esc = SV.esc, ic = SV.icon;

  function minutes(job) { var m = 0; job.services.forEach(function (s) { var x = SV.find(D.boligServices, s); if (x) m += x.min; }); return Math.max(45, m); }
  SV.minutes = minutes;
  var travel = { 'Leirvik': 55, 'Stord': 55, 'Husnes': 25, 'Halsnøy': 12, 'Haugesund': 95, 'Rosendal': 50, 'Bømlo': 80, 'Ølve': 45, 'Sveio': 85, 'Uskedalen': 35, 'Høylandsbygd': 20 };
  SV.travel = travel;

  // ---------- Oversikt ----------
  SV.route('/', 'studio', function () {
    var b = D.iso(D.base), isToday = SV.diff(b) === 0;
    var h = new Date().getHours(), hi = h < 10 ? 'God morgen' : h < 17 ? 'God dag' : 'God kveld';
    var jobs = SV.jobs(), todays = jobs.filter(function (j) { return j.date === b; }).sort(function (a, c) { return a.time < c.time ? -1 : 1; });
    var dueToday = jobs.filter(function (j) { return j.due === b && SV.stageOf(j) !== 'Levert'; });
    var out = D.invoices.filter(function (i) { return i.status === 'Sendt' || i.status === 'Forfalt'; }).reduce(function (s, i) { return s + i.sum; }, 0);
    var fj = D.schoolDays[0], ord = 0, kr = 0, n = 0;
    fj.classes.forEach(function (c) { c.pupils.forEach(function (p) { n++; if (p.order) { ord++; kr += p.order; } }); });
    var wk = weekNo(D.base);

    var day = todays.map(function (j, i) {
      var t = travel[j.town] || 30;
      return (i === 0 ? '<p class="td-travel">' + ic('route') + 'Fra Eidsvik · ca. ' + t + ' min</p>' : '<p class="td-travel">' + ic('route') + 'Kjøring ca. ' + Math.round(t * 0.7) + ' min</p>') +
        '<a class="td-item" href="#/bolig/' + j.id + '"><span class="time">' + j.time + '</span><span class="li-t"><b>' + esc(j.addr) + ', ' + esc(j.town) + '</b><small>' + esc(j.type) + ' · ' + esc(j.broker) + ' · ' + svcShort(j) + '</small></span>' +
        '<span class="li-r">' + (j.services.indexOf('dr') > -1 ? '<span class="tag">' + ic('wind') + esc(j.weather || 'Sjekk vær') + '</span>' : '') + '</span></a>';
    }).join('');
    var sjb = D.schoolDays[1];

    var needs = [
      ['#/okonomi', 'bad', 'Faktura 26-1191 til Vestkraft er forfalt', '38 500 kr · forfalt for 6 dager siden'],
      ['#/bedrift/P-341', 'sand', '2 nye kommentarer på rekrutteringsfilmen', 'Marte og Ola venter på v3'],
      ['#/skole/S-fjt/personvern', 'sand', 'Slettebegjæring fra foresatt, 6A', 'Frist: 30 dager etter mottak'],
      ['#/bolig', 'ink', '3 bestillinger uten avtalt tid', 'Bømlo, Ølve og Sveio'],
      ['#/bedrift/P-341', 'mute', 'Samtykke mangler: Kjell Ask', 'Opptaksliste, rekrutteringsfilm']
    ].map(function (x) { return '<a class="li" href="' + x[0] + '"><i class="ndot n-' + x[1] + '"></i><span class="li-t"><b>' + x[2] + '</b><small>' + x[3] + '</small></span>' + ic('chev') + '</a>'; }).join('');

    var areas = [
      ['#/bolig', 'bolig', 'Bolig', jobs.filter(function (j) { return SV.stageOf(j) !== 'Levert'; }).length + ' aktive oppdrag', dueToday.length + ' med frist ' + (isToday ? 'i dag' : SV.dayName(b))],
      ['#/bedrift', 'bedrift', 'Bedrift', D.bizProjects.filter(function (p) { return p.stage !== 'Levert'; }).length + ' prosjekter', '1 film til gjennomgang'],
      ['#/skole', 'skole', 'Skolefoto', Math.round(ord / n * 100) + ' % har bestilt', 'Fjordtun stenger ' + SV.rel(fj.closes)],
      ['#/marked', 'mark', 'Markedsføring', D.posts.filter(function (p) { return p.status === 'Til godkjenning'; }).length + ' innlegg til godkjenning', '2 kampanjer aktive']
    ].map(function (a) { return '<a href="' + a[0] + '" class="card stat" style="text-decoration:none"><p class="k">' + SV.dot(a[1]) + a[2] + '</p><p class="v" style="font-size:22px;font-family:var(--sans);font-weight:800">' + a[3] + '</p><p class="s">' + a[4] + '</p></a>'; }).join('');

    return SV.head({ eyebrow: SV.fdate(b, true) + ' · uke ' + wk + (isToday ? '' : ' · neste arbeidsdag'), a: hi + ',', b: 'Aleksander',
        lead: todays.length + ' boligoppdrag ' + (isToday ? 'i dag' : 'på ' + SV.dayName(b)) + ', ' + dueToday.length + ' leveranser med frist, og skolefotoet på Fjordtun går godt.',
        actions: '<a class="btn btn-ghost btn-s" href="#/kalender">' + ic('cal') + 'Kalender</a><a class="btn btn-acc btn-s" href="#/kunde/megler/bestill">' + ic('plus') + 'Nytt oppdrag</a>' }) +
      '<div class="g4">' +
        stat('cam', 'Oppdrag ' + (isToday ? 'i dag' : SV.dayName(b)), todays.length, 'Første kl. ' + (todays[0] ? todays[0].time : '–')) +
        stat('clock', 'Leveres ' + (isToday ? 'i dag' : SV.dayName(b)), dueToday.length, dueToday.map(function (j) { return j.addr; }).join(', ') || 'Ingen frister') +
        stat('wallet', 'Utestående', SV.kr(out), '1 faktura forfalt') +
        stat('school', 'Skolebestillinger', ord, SV.kr(kr) + ' · Fjordtun skule', true) +
      '</div>' +
      '<div class="g21 sec">' +
        '<div class="card"><div class="card-h"><h3>Dagens løype</h3><a class="small muted" href="#/kalender">Hele uken</a></div><div class="card-b today">' + (day || '<p class="empty">Ingen oppdrag</p>') +
          '<p class="hint" style="margin-top:12px">Neste: Sjøbakken barnehage ' + SV.fdate(sjb.date) + ' · ' + sjb.classes.reduce(function (s, c) { return s + c.pupils.length; }, 0) + ' barn</p></div></div>' +
        '<div class="card dark">' + SV.topo() + '<div class="card-h" style="border-color:rgba(242,238,232,.08)"><h3>Trenger deg</h3><span class="chip chip-sand">5</span></div><div class="card-b needs">' + needs + '</div></div>' +
      '</div>' +
      '<div class="g21 sec">' +
        '<div class="card"><div class="card-h"><h3>Omsetning per felt</h3><span class="small muted">tusen kr, eks. mva</span></div><div class="card-b">' + SV.bars(D.revenue.months, { bolig: D.revenue.bolig, bedrift: D.revenue.bedrift, skole: D.revenue.skole, mark: D.revenue.mark }, 170) +
          '<div class="legend" style="margin-top:16px">' + ['bolig', 'bedrift', 'skole', 'mark'].map(function (k) { return '<span>' + SV.dot(k) + SV.areaName[k] + '</span>'; }).join('') + '</div></div></div>' +
        '<div class="card"><div class="card-h"><h3>Aktivitet</h3></div><div class="card-b"><ul class="feed">' + D.activity.map(function (a) { return '<li>' + SV.dot(a.area) + '<span>' + a.text + '</span><time>' + a.t + '</time></li>'; }).join('') + '</ul></div></div>' +
      '</div>' +
      '<div class="sec"><div class="sec-h"><h2>Feltene</h2></div><div class="g4">' + areas + '</div></div>';
  }, { title: 'Oversikt' });

  function stat(icn, k, v, s, dark) { return '<div class="card stat' + (dark ? ' dark' : '') + '">' + (dark ? SV.topo() : '') + '<p class="k">' + ic(icn) + k + '</p><p class="v">' + v + '</p><p class="s">' + esc(s) + '</p></div>'; }
  SV.stat = stat;
  function svcShort(j) { return j.services.map(function (s) { var x = SV.find(D.boligServices, s); return x ? x.name.replace(/, .*/, '').replace('Boligfoto', 'Foto').replace('Dronefoto', 'Drone') : s; }).join(' · '); }
  SV.svcShort = svcShort;
  function weekNo(d) { var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); var dn = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - dn); var y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - y) / 864e5 + 1) / 7); }
  SV.weekNo = weekNo;
  SV.on('dummy', function () { SV.toast('Dette kobles til ekte data ved lansering'); });

  // ---------- Kalender ----------
  SV.route('/kalender', 'studio', function () {
    var mon = new Date(D.base); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
    var days = []; for (var i = 0; i < 5; i++) days.push(D.iso(D.addDays(mon, i)));
    var START = 7, END = 18, PX = 52, evs = [];
    SV.jobs().forEach(function (j) { if (days.indexOf(j.date) > -1 && SV.stageOf(j) !== 'Bestilt') evs.push({ d: j.date, s: j.time, m: minutes(j), area: 'bolig', t: j.addr, sub: j.town + ' · ' + j.broker, href: '#/bolig/' + j.id }); });
    D.bizProjects.forEach(function (p) { if (days.indexOf(p.date) > -1) evs.push({ d: p.date, s: '09:00', m: 180, area: 'bedrift', t: p.title, sub: SV.find(D.companies, p.company).name, href: '#/bedrift/' + p.id }); });
    D.schoolDays.forEach(function (s) { if (days.indexOf(s.date) > -1) evs.push({ d: s.date, s: '08:15', m: 330, area: 'skole', t: 'Fotodag ' + s.school, sub: s.town, href: '#/skole/' + s.id }); });
    D.posts.forEach(function (p) { if (days.indexOf(p.d) > -1) evs.push({ d: p.d, s: '16:00', m: 40, area: 'mark', t: p.title, sub: D.channels[p.ch], href: '#/marked' }); });
    var grid = '<div class="wk-h"></div>' + days.map(function (d) { return '<div class="wk-h' + (SV.diff(d) === 0 ? ' today' : '') + '">' + SV.fdate(d).split(' ')[0] + '<b>' + SV.parse(d).getDate() + '</b></div>'; }).join('');
    var times = ''; for (var hh = START; hh < END; hh++) times += '<div class="wk-t">' + String(hh).padStart(2, '0') + ':00</div>';
    grid += '<div>' + times + '</div>';
    // kollisjon: enkel kolonnedeling
    grid += days.map(function (d) {
      var list = evs.filter(function (e) { return e.d === d; }).sort(function (a, b) { return a.s < b.s ? -1 : 1; });
      // legg overlappende hendelser i baner
      var lanes = [], groups = [], g = null, gEnd = -1;
      list.forEach(function (e) {
        var st = toMin(e.s), en = st + e.m;
        if (!g || st >= gEnd) { g = { items: [], lanes: [] }; groups.push(g); gEnd = -1; }
        var li = 0; while (g.lanes[li] != null && g.lanes[li] > st) li++;
        g.lanes[li] = en; e.lane = li; e.g = g; g.items.push(e); gEnd = Math.max(gEnd, en);
      });
      return '<div class="wk-c" style="height:' + ((END - START) * PX) + 'px">' + list.map(function (e) {
        var p = e.s.split(':'), top = ((+p[0] - START) * 60 + (+p[1])) / 60 * PX, hgt = Math.max(30, e.m / 60 * PX - 4), n = e.g.lanes.length, w = 100 / n;
        var style = 'top:' + top + 'px;height:' + hgt + 'px;left:calc(' + (e.lane * w) + '% + 3px);right:auto;width:calc(' + w + '% - 6px)';
        return '<button type="button" class="ev a-' + e.area + '" style="' + style + '" data-act="go" data-href="' + e.href + '" title="' + esc(e.t) + '"><b>' + esc(e.t) + '</b>' + e.s + ' · ' + esc(e.sub) + '</button>';
      }).join('') + '</div>';
    }).join('');
    var unplanned = SV.jobs().filter(function (j) { return SV.stageOf(j) === 'Bestilt'; });
    return SV.head({ eyebrow: 'Uke ' + weekNo(mon) + ' · ' + SV.fdate(days[0]) + ' – ' + SV.fdate(days[4]), a: 'Kalender', b: 'og løype',
        lead: 'Alle felt i samme uke. Varighet regnes ut fra tjenestene som er bestilt, og kjøretid fra Eidsvik legges inn mellom oppdragene.',
        actions: '<button class="btn btn-ghost btn-s" data-act="dummy">' + ic('link') + 'Synk med Google/Outlook</button>' }) +
      '<div class="legend" style="margin-bottom:14px">' + ['bolig', 'bedrift', 'skole', 'mark'].map(function (k) { return '<span>' + SV.dot(k) + SV.areaName[k] + '</span>'; }).join('') + '</div>' +
      '<div class="g21" style="grid-template-columns:minmax(0,3fr) minmax(260px,1fr)"><div class="card" style="overflow-x:auto;padding:6px 10px 14px"><div class="wk">' + grid + '</div></div>' +
      '<div class="stack"><div class="card"><div class="card-h"><h3>Uten tid</h3><span class="chip chip-sand">' + unplanned.length + '</span></div><div class="card-b">' +
        unplanned.map(function (j) { return '<a class="li" href="#/bolig/' + j.id + '"><span class="li-t"><b>' + esc(j.addr) + '</b><small>' + esc(j.town) + ' · ønske: ' + esc(j.wish || '–') + '</small></span>' + ic('chev') + '</a>'; }).join('') +
        '<p class="hint">Forslag til tid sendes selger på SMS automatisk. Selger kan velge blant ledige luker.</p></div></div>' +
        '<div class="card"><div class="card-h"><h3>Tilgjengelighet</h3></div><div class="card-b small"><ul class="check">' +
          D.team.slice(0, 2).map(function (t) { return '<li>' + SV.avatar(t.name) + '<span><b>' + esc(t.name) + '</b><br><span class="muted">' + esc(t.role) + '</span></span></li>'; }).join('') +
        '</ul><p class="hint">Bestillingsregler: maks 4 boligoppdrag per fotograf per dag, 30 min buffer, drone bare ved vind under 8 m/s.</p></div></div></div></div>';
  }, { title: 'Kalender' });
  function toMin(s) { var p = s.split(':'); return +p[0] * 60 + (+p[1]); }

  // ---------- Kunder ----------
  SV.route('/kunder', 'studio', function () {
    var mk = '<div class="card tbl-w"><table class="tbl"><thead><tr><th>Kontor</th><th>Meglere</th><th class="hide-s">Avtale</th><th class="hide-s">Fakturering</th><th class="r">I år</th></tr></thead><tbody>' +
      D.offices.map(function (o) { return '<tr class="click" data-act="office" data-id="' + o.id + '"><td><b>' + esc(o.name) + '</b><small>' + esc(o.town) + '</small></td><td>' + o.brokers.length + '</td><td class="hide-s">' + esc(o.agreement) + '</td><td class="hide-s">' + esc(o.invoice) + '</td><td class="r num">' + SV.kr(o.ytd) + '</td></tr>'; }).join('') + '</tbody></table></div>';
    var bz = '<div class="card tbl-w"><table class="tbl"><thead><tr><th>Bedrift</th><th>Kontakt</th><th class="hide-s">Kilde</th><th class="hide-s">Timebank</th><th class="r">I år</th></tr></thead><tbody>' +
      D.companies.map(function (c) { return '<tr class="click" data-act="go" data-href="#/bedrift"><td><b>' + esc(c.name) + '</b><small>' + esc(c.town) + '</small></td><td>' + esc(c.contact) + '<small>' + esc(c.title) + '</small></td><td class="hide-s">' + (c.source === 'Direkte' ? 'Direkte' : SV.chip(c.source, 'brown')) + '</td><td class="hide-s">' + (c.bank ? esc(c.bank.plan) + ' · ' + c.bank.hours + ' t/mnd' : '<span class="muted">–</span>') + '</td><td class="r num">' + SV.kr(c.ytd) + '</td></tr>'; }).join('') + '</tbody></table></div>';
    var sk = '<div class="card tbl-w"><table class="tbl"><thead><tr><th>Skole / barnehage</th><th>Kontakt</th><th class="hide-s">Databehandleravtale</th><th>Status</th></tr></thead><tbody>' +
      D.schoolDays.map(function (s) { return '<tr class="click" data-act="go" data-href="#/skole/' + s.id + '"><td><b>' + esc(s.school) + '</b><small>' + esc(s.kind) + ' · ' + esc(s.town) + '</small></td><td>' + esc(s.contact) + '</td><td class="hide-s">' + (s.dpa ? SV.chip('Signert') : SV.chip('Venter')) + '</td><td>' + SV.chip(s.phase) + '</td></tr>'; }).join('') + '</tbody></table></div>';
    return SV.head({ eyebrow: D.offices.length + ' meglerkontorer · ' + D.companies.length + ' bedrifter · ' + D.schoolDays.length + ' skoler og barnehager', a: 'Kunder', b: 'og avtaler', lead: 'Ett kunderegister for alle felt. Hver kunde får sin egen portal, tilpasset feltet.' }) +
      SV.tabs('kunder', [['m', 'Meglere', D.offices.length], ['b', 'Bedrifter', D.companies.length], ['s', 'Skoler og barnehager', D.schoolDays.length]], 'm') +
      SV.panels('kunder', { m: mk, b: bz, s: sk }, 'm');
  }, { title: 'Kunder' });
  SV.on('office', function (el) {
    var o = SV.find(D.offices, el.getAttribute('data-id')), jobs = SV.jobs().filter(function (j) { return j.office === o.id; });
    SV.drawer('<p class="eyebrow">' + SV.dot('bolig') + 'Meglerkontor</p><h2 class="h2"><span class="serif">' + esc(o.name) + '</span></h2>' +
      '<dl class="kv" style="margin:18px 0"><dt>Sted</dt><dd>' + esc(o.town) + '</dd><dt>Avtale</dt><dd>' + esc(o.agreement) + '</dd><dt>Fakturering</dt><dd>' + esc(o.invoice) + '</dd><dt>Omsetning i år</dt><dd>' + SV.kr(o.ytd) + '</dd></dl>' +
      '<div class="sec-h"><h2>Meglere</h2></div>' + o.brokers.map(function (b) { return '<div class="li">' + SV.avatar(b) + '<span class="li-t"><b>' + esc(b) + '</b><small>Egen innlogging til meglerportalen</small></span></div>'; }).join('') +
      '<div class="sec-h sec"><h2>Oppdrag</h2></div>' + jobs.map(function (j) { return '<a class="li" href="#/bolig/' + j.id + '"><span class="thumb">' + SV.pic(j.cover) + '</span><span class="li-t"><b>' + esc(j.addr) + '</b><small>' + esc(j.broker) + '</small></span>' + SV.chip(SV.stageOf(j)) + '</a>'; }).join(''));
  });

  // ---------- Lagring ----------
  SV.route('/lagring', 'studio', function () {
    var st = D.storage, used = st.areas.reduce(function (s, a) { return s + a.gb; }, 0);
    var tree = [['Bolig', 'bolig', ['2026', '2025', 'Maler og logoer']], ['Bedrift', 'bedrift', ['Vestkraft Energi AS', 'Rosendal Fjordhotell', 'Husnes Mek. Verksted', 'Halsnøy Tannklinikk']], ['Skolefoto', 'skole', ['Fjordtun skule 2026', 'Sjøbakken barnehage 2026', 'Høylandsbygd skule 2025']], ['Markedsføring', 'mark', ['Kampanjer', 'Innholdskalender']]];
    var files = [['B-2605 Loftsgata 5', '64 filer · 2,1 GB', 'Levert'], ['B-2604 Rosendalsvegen 118', '212 filer · 9,8 GB', 'Levert'], ['B-2608 Skeisvegen 9', '148 filer · 5,2 GB', 'Redigering'], ['B-2607 Fjellsætervegen 22', '171 filer · 6,4 GB', 'Redigering']];
    return SV.head({ eyebrow: 'Ett arkiv for alt', a: 'Lagring', b: 'og arkiv', lead: 'Alt materiale samlet, med regler for hvor lenge hver type lagres. Kundene får tilgang til sitt eget, aldri mer.', actions: '<button class="btn btn-acc btn-s" data-act="upload">' + ic('upload') + 'Last opp</button>' }) +
      '<div class="g21"><div class="card dark pad">' + SV.topo() + '<p class="eyebrow" style="color:rgba(242,238,232,.6)">Brukt av ' + SV.num(st.total) + ' GB</p><p class="bignum">' + (used / 1000).toFixed(2).replace('.', ',') + ' TB</p>' +
        '<div class="row" style="margin-top:18px;gap:2px;height:12px;border-radius:99px;overflow:hidden;flex-wrap:nowrap">' + st.areas.map(function (a) { return '<i class="a-' + a.key + '" style="display:block;height:12px;width:' + (a.gb / st.total * 100) + '%"></i>'; }).join('') + '<i style="display:block;height:12px;flex:1;background:rgba(242,238,232,.12)"></i></div>' +
        '<div class="g4" style="margin-top:20px;gap:12px">' + st.areas.map(function (a) { return '<div><p class="small">' + SV.dot(a.key) + ' ' + a.label + '</p><p style="font-weight:800;font-size:18px">' + SV.num(a.gb) + ' GB</p><p class="tiny muted">' + SV.num(a.files) + ' filer</p></div>'; }).join('') + '</div></div>' +
        '<div class="card"><div class="card-h"><h3>Slettes snart</h3></div><div class="card-b">' + st.upcoming.map(function (u) { return '<div class="li">' + SV.dot(u.area) + '<span class="li-t"><b>' + esc(u.what) + '</b><small>' + SV.fdate(u.when) + ' · ' + String(u.gb).replace('.', ',') + ' GB</small></span></div>'; }).join('') + '<p class="hint">Kunden varsles 30 dager før. Slettebekreftelse lagres i loggen.</p></div></div></div>' +
      '<div class="g12 sec"><div class="card"><div class="card-h"><h3>Mapper</h3></div><div class="card-b">' + tree.map(function (t) { return '<p class="small" style="font-weight:800;margin:6px 0">' + SV.dot(t[1]) + ' ' + t[0] + '</p>' + t[2].map(function (f) { return '<div class="li" style="padding:7px 0 7px 18px">' + ic('folder') + '<span class="li-t small">' + esc(f) + '</span></div>'; }).join(''); }).join('') + '</div></div>' +
        '<div class="card"><div class="card-h"><h3>Bolig / 2026</h3><span class="small muted">Sortert på siste endring</span></div><div class="card-b">' + files.map(function (f) { return '<div class="li">' + ic('folder') + '<span class="li-t"><b>' + esc(f[0]) + '</b><small>' + f[1] + ' · RAW, redigert, Finn, trykk, SoMe</small></span>' + SV.chip(f[2]) + '</div>'; }).join('') +
        '<div class="drop sec" data-act="upload" id="drop">' + ic('upload') + '<b>Slipp filer her</b><span class="small">RAW, JPG, MP4 og PDF. Store filer lastes opp i biter og fortsetter etter brudd.</span></div></div></div></div>' +
      '<div class="sec"><div class="sec-h"><h2>Lagringsregler</h2></div><div class="card tbl-w"><table class="tbl"><thead><tr><th>Felt</th><th>Regel</th><th class="r">Automatisk</th></tr></thead><tbody>' +
        st.areas.map(function (a) { return '<tr><td>' + SV.dot(a.key) + ' <b>' + a.label + '</b></td><td>' + esc(a.rule) + '</td><td class="r"><label class="sw"><input type="checkbox" checked aria-label="Automatisk sletting ' + a.label + '"><span></span></label></td></tr>'; }).join('') + '</tbody></table></div></div>';
  }, { title: 'Lagring' });
  SV.on('upload', function () {
    var d = document.getElementById('drop');
    if (!d) { SV.toast('Opplasting kommer med lagringstjenesten'); return; }
    d.innerHTML = ic('upload') + '<b>Laster opp 48 filer…</b><div class="prog"><span class="bar"><i id="pg" style="width:0"></i></span></div><span class="small" id="pgt">0 %</span>';
    var p = 0, t = setInterval(function () { p += 7 + Math.random() * 9; if (p >= 100) { p = 100; clearInterval(t); d.innerHTML = ic('check') + '<b>48 filer lastet opp</b><span class="small">Lagt i B-2608 Skeisvegen 9 / RAW. Redigering varslet.</span>'; SV.toast('48 filer lastet opp'); return; } var g = document.getElementById('pg'); if (g) { g.style.width = p + '%'; document.getElementById('pgt').textContent = Math.round(p) + ' %'; } }, 180);
  });

  // ---------- Automatisering ----------
  function autoOn(a) { return SV.state.autos[a.id] == null ? a.on : SV.state.autos[a.id]; }
  SV.route('/automatisering', 'studio', function (p) {
    var f = p.felt || 'alle';
    var list = D.automations.filter(function (a) { return f === 'alle' || a.area === f; });
    var on = D.automations.filter(autoOn).length, runs = D.automations.reduce(function (s, a) { return s + a.runs; }, 0);
    return SV.head({ eyebrow: on + ' av ' + D.automations.length + ' aktive · ' + runs + ' kjøringer siste 30 dager', a: 'Automatisering', lead: 'Når noe skjer, gjør portalen resten: e-post, SMS, faktura, påminnelser og sletting. Du skrur av og på, og endrer tekst og tidspunkt.', actions: '<button class="btn btn-acc btn-s" data-act="autoNew">' + ic('plus') + 'Ny regel</button>' }) +
      '<div class="filters">' + [['alle', 'Alle'], ['bolig', 'Bolig'], ['bedrift', 'Bedrift'], ['skole', 'Skolefoto'], ['mark', 'Markedsføring']].map(function (x) { return '<a class="fbtn' + (x[0] === f ? ' on' : '') + '" href="#/automatisering' + (x[0] === 'alle' ? '' : '/' + x[0]) + '">' + (x[0] !== 'alle' ? SV.dot(x[0]) : '') + x[1] + '</a>'; }).join('') + '</div>' +
      '<div class="g2">' + list.map(function (a) {
        var o = autoOn(a);
        return '<div class="card pad auto' + (o ? '' : ' off') + '" id="au-' + a.id + '"><div class="row between" style="flex-wrap:nowrap"><div><p class="eyebrow" style="margin-bottom:6px">' + SV.dot(a.area) + SV.areaName[a.area] + ' · ' + a.runs + ' kjøringer</p><h3 class="h3" style="font-size:17px">' + esc(a.name) + '</h3></div>' +
          '<label class="sw"><input type="checkbox" data-change="autoToggle" data-id="' + a.id + '"' + (o ? ' checked' : '') + ' aria-label="' + esc(a.name) + '"><span></span></label></div>' +
          '<div class="flow"><span class="fstep ftrig">' + ic('bolt') + esc(a.trigger) + '</span>' + a.steps.map(function (s) { return '<span class="arr">→</span><span class="fstep">' + esc(s) + '</span>'; }).join('') + '</div>' +
          '<button class="link small" style="margin-top:14px" data-act="autoOpen" data-id="' + a.id + '">Endre regel</button></div>';
      }).join('') + '</div>';
  }, { title: 'Automatisering' });
  SV.route('/automatisering/:felt', 'studio', function (p) { return SV.routes.filter(function (r) { return r.pattern === '/automatisering'; })[0].fn(p); }, { title: 'Automatisering' });
  SV.on('autoToggle', function (el) {
    var id = el.getAttribute('data-id'); SV.state.autos[id] = el.checked; SV.save();
    document.getElementById('au-' + id).classList.toggle('off', !el.checked);
    SV.toast(el.checked ? 'Regelen er slått på' : 'Regelen er slått av');
  });
  SV.on('autoOpen', function (el) {
    var a = SV.find(D.automations, el.getAttribute('data-id'));
    SV.modal('<p class="eyebrow">' + SV.dot(a.area) + SV.areaName[a.area] + '</p><h2 class="h2"><span class="serif">' + esc(a.name) + '</span></h2>' +
      '<div class="builder" style="margin-top:20px"><div class="bstep trig"><small>Når</small>' + esc(a.trigger) + '</div>' +
      a.steps.map(function (s, i) { return '<div class="bstep"><small>Steg ' + (i + 1) + (i === 0 ? ' · straks' : ' · etter forrige') + '</small><div class="row between">' + esc(s) + '<button class="btn btn-ghost btn-xs" data-act="dummy">' + ic('edit') + 'Endre</button></div></div>'; }).join('') +
      '<button class="btn btn-ghost btn-s" data-act="dummy">' + ic('plus') + 'Legg til steg</button></div>' +
      '<div class="callout" style="margin-top:18px">' + ic('info') + '<span>Hver kjøring logges med tidspunkt, mottaker og resultat, så du kan se nøyaktig hva kunden har fått.</span></div>' +
      '<div class="row" style="margin-top:18px;justify-content:flex-end"><button class="btn btn-ghost btn-s" data-act="close">Lukk</button><button class="btn btn-dark btn-s" data-act="saveAuto">Lagre</button></div>', { wide: false });
  });
  SV.on('saveAuto', function () { SV.close(); SV.toast('Regelen er lagret'); });
  SV.on('autoNew', function () {
    SV.modal('<p class="eyebrow">Ny regel</p><h2 class="h2"><span class="serif">Start fra</span> <span class="bold">en mal</span></h2><div class="stack" style="margin-top:16px">' +
      [['bolig', 'Be om omtale 7 dager etter levering'], ['bolig', 'Varsle megler når selger har valgt tid'], ['bedrift', 'Månedlig timebank-oppsummering'], ['skole', 'Ekstra påminnelse til søsken som ikke har bestilt'], ['mark', 'Ukentlig liste over innlegg til godkjenning']].map(function (t) {
        return '<button class="pp" data-act="saveAuto">' + SV.dot(t[0]) + '<span><b>' + t[1] + '</b><small>' + SV.areaName[t[0]] + '</small></span>' + ic('plus') + '</button>';
      }).join('') + '</div>');
  });

  // ---------- E-post og varsler ----------
  var sample = { 'megler.fornavn': 'Kari', 'adresse': 'Ølve terrasse 12', 'tjenester': 'boligfoto og SoMe-reel', 'selger.navn': 'Stine Nygård', 'selger.fornavn': 'Stine', 'lenke': 'portal.studiovest.no/o/B-2615', 'dato': 'torsdag 5. november', 'tid': '13:00', 'barn.fornavn': 'Emma', 'skole': 'Fjordtun skule', 'kode': 'FJT-4B-7K2Q', 'frist': 'fredag 13. november', 'kunde.fornavn': 'Marte', 'prosjekt': 'Rekrutteringsfilm', 'versjon': '2' };
  function fill(t) { return esc(t).replace(/\{\{([\w.]+)\}\}/g, function (_, k) { return '<mark>' + esc(sample[k] || k) + '</mark>'; }); }
  SV.route('/epost', 'studio', function () {
    var t = D.templates[0];
    var tpl = '<div class="g12"><div class="card"><div class="card-h"><h3>Maler</h3><span class="small muted">' + D.templates.length + '</span></div><div class="card-b" style="padding-top:4px">' +
      D.templates.map(function (x, i) { return '<button class="pp' + '" style="background:' + (i === 0 ? 'rgba(217,168,102,.16)' : '') + '" data-act="tplPick" data-id="' + x.id + '">' + SV.dot(x.area) + '<span><b>' + esc(x.name) + '</b><small>' + (x.subject === 'SMS' ? 'SMS' : 'E-post') + '</small></span></button>'; }).join('') + '</div></div>' +
      '<div class="card"><div class="card-h"><h3 id="tplName">' + esc(t.name) + '</h3><button class="btn btn-ghost btn-xs" data-act="testSend">' + ic('mail') + 'Send test til meg</button></div><div class="card-b"><div class="g2">' +
        '<div><label class="fld"><span>Emne</span><input class="inp" id="tplSubj" value="' + esc(t.subject) + '" data-input="tplLive"></label><label class="fld"><span>Tekst</span><textarea class="txt" id="tplBody" rows="10" style="min-height:240px" data-input="tplLive">' + esc(t.body) + '</textarea></label>' +
        '<p class="small" style="font-weight:750;margin-bottom:6px">Flettefelt</p><div class="tags">' + ['megler.fornavn', 'adresse', 'tjenester', 'selger.navn', 'dato', 'tid', 'lenke', 'barn.fornavn', 'kode', 'frist'].map(function (k) { return '<button type="button" data-act="tplTag" data-k="' + k + '">{{' + k + '}}</button>'; }).join('') + '</div></div>' +
        '<div><p class="small" style="font-weight:750;margin-bottom:6px">Slik ser kunden den</p><div class="mailprev" id="tplPrev"></div></div></div></div></div></div>';
    var log = '<div class="card tbl-w"><table class="tbl"><thead><tr><th>Tid</th><th>Til</th><th>Emne</th><th>Status</th></tr></thead><tbody>' + D.outbox.map(function (o) { return '<tr><td class="num">' + o.t + '</td><td>' + SV.dot(o.area) + ' ' + esc(o.to) + '</td><td>' + esc(o.subj) + '</td><td>' + SV.chip(o.st, /Åpnet|Klikket|Levert|svart|åpnet/.test(o.st) ? 'ok' : 'ink') + '</td></tr>'; }).join('') + '</tbody></table></div>';
    var set = '<div class="g2"><div class="card pad"><h3 class="h3">Avsender</h3><label class="fld" style="margin-top:12px"><span>Navn</span><input class="inp" value="Studiovest"></label><label class="fld"><span>E-post</span><input class="inp" value="kontakt@studiovest.no"></label><label class="fld"><span>SMS-avsender</span><input class="inp" value="Studiovest" maxlength="11"></label><p class="hint">Domenet må verifiseres (SPF og DKIM) hos one.com ved lansering, så e-posten ikke havner i søppelpost.</p></div>' +
      '<div class="card pad"><h3 class="h3">Kanaler per felt</h3><table class="tbl" style="margin-top:8px"><thead><tr><th>Felt</th><th>E-post</th><th>SMS</th></tr></thead><tbody>' + ['bolig', 'bedrift', 'skole', 'mark'].map(function (k) { return '<tr><td>' + SV.dot(k) + ' ' + SV.areaName[k] + '</td><td><label class="sw"><input type="checkbox" checked aria-label="E-post ' + k + '"><span></span></label></td><td><label class="sw"><input type="checkbox"' + (k === 'bolig' || k === 'skole' ? ' checked' : '') + ' aria-label="SMS ' + k + '"><span></span></label></td></tr>'; }).join('') + '</tbody></table></div></div>';
    SV.after(tplLive);
    return SV.head({ eyebrow: 'Sendt siste 30 dager: 1 284 e-poster · 316 SMS', a: 'E-post', b: 'og varsler', lead: 'Alle meldinger har samme Studiovest-uttrykk. Flettefeltene fylles inn automatisk fra oppdraget.' }) +
      SV.tabs('ep', [['m', 'Maler'], ['l', 'Utboks', D.outbox.length], ['s', 'Innstillinger']], 'm') + SV.panels('ep', { m: tpl, l: log, s: set }, 'm');
  }, { title: 'E-post og varsler' });
  function tplLive() {
    var s = document.getElementById('tplSubj'), b = document.getElementById('tplBody'), p = document.getElementById('tplPrev'); if (!s) return;
    var sms = s.value === 'SMS';
    p.innerHTML = sms ? '<div class="mp-b" style="background:#eae6df;border-radius:12px;margin:14px;max-width:85%">' + fill(b.value) + '</div><p class="mp-f">' + b.value.length + ' tegn · ' + Math.ceil(b.value.length / 153) + ' SMS</p>' :
      '<div class="mp-h"><span class="lg"><span class="serif">STUDIO</span><span class="bold">VEST</span></span><span class="small">' + fill(s.value) + '</span></div><div class="mp-b">' + fill(b.value) + '</div><span class="mp-btn">Åpne i portalen</span><div class="mp-f">Studiovest · Eidsvik, Halsnøy · kontakt@studiovest.no</div>';
  }
  SV.on('tplLive', tplLive);
  SV.on('tplPick', function (el) {
    var t = SV.find(D.templates, el.getAttribute('data-id'));
    document.querySelectorAll('[data-act=tplPick]').forEach(function (b) { b.style.background = b === el ? 'rgba(217,168,102,.16)' : ''; });
    document.getElementById('tplName').textContent = t.name; document.getElementById('tplSubj').value = t.subject; document.getElementById('tplBody').value = t.body; tplLive();
  });
  SV.on('tplTag', function (el) { var b = document.getElementById('tplBody'), k = '{{' + el.getAttribute('data-k') + '}}', s = b.selectionStart || b.value.length; b.value = b.value.slice(0, s) + k + b.value.slice(s); b.focus(); tplLive(); });
  SV.on('testSend', function () { SV.toast('Test sendt til aleksander@studiovest.no (demo)'); });

  // ---------- Økonomi ----------
  SV.route('/okonomi', 'studio', function () {
    var sum = function (f) { return D.invoices.filter(f).reduce(function (s, i) { return s + i.sum; }, 0); };
    var ytd = D.offices.reduce(function (s, o) { return s + o.ytd; }, 0) + D.companies.reduce(function (s, c) { return s + c.ytd; }, 0) + 61400 + 23838;
    return SV.head({ eyebrow: 'Hittil i år · eks. mva', a: 'Økonomi', lead: 'Fakturaer lages automatisk når noe leveres. Megler får samlefaktura eller faktura per oppdrag etter avtalen, bedrifter får EHF, foresatte betaler med Vipps.', actions: '<button class="btn btn-ghost btn-s" data-act="dummy">' + ic('down') + 'Eksporter til regnskap</button>' }) +
      '<div class="g4">' + stat('wallet', 'Fakturert i år', SV.kr(ytd), 'Alle felt') + stat('clock', 'Utestående', SV.kr(sum(function (i) { return i.status === 'Sendt'; })), '4 fakturaer') + stat('info', 'Forfalt', SV.kr(sum(function (i) { return i.status === 'Forfalt'; })), 'Purring sendes automatisk om 2 dager') + stat('school', 'Vipps, skolefoto', SV.kr(23838), 'Fjordtun, utbetales daglig', true) + '</div>' +
      '<div class="sec card tbl-w"><table class="tbl"><thead><tr><th>Nr.</th><th>Kunde</th><th class="hide-s">Dato</th><th class="hide-s">Forfall</th><th class="hide-s">Kanal</th><th>Status</th><th class="r">Beløp</th></tr></thead><tbody>' +
        D.invoices.map(function (i) { return '<tr><td class="num">' + i.nr + '</td><td>' + SV.dot(i.area) + ' <b>' + esc(i.to) + '</b></td><td class="hide-s">' + (i.date ? SV.fdate(i.date) : '–') + '</td><td class="hide-s">' + (i.due ? SV.fdate(i.due) : '–') + '</td><td class="hide-s">' + i.chan + '</td><td>' + SV.chip(i.status) + '</td><td class="r num"><b>' + SV.kr(i.sum) + '</b></td></tr>'; }).join('') + '</tbody></table></div>' +
      '<div class="g3 sec">' + [['Regnskap', 'Fiken eller Tripletex', 'Fakturaer og innbetalinger går rett over. Ingen dobbel føring.'], ['EHF', 'Til bedrifter og meglerkontor', 'Faktura rett inn i kundens regnskapssystem.'], ['Vipps', 'Skolefoto og småkunder', 'Betaling før nedlasting. Utbetales til konto.']].map(function (x) { return '<div class="card pad"><p class="eyebrow">' + x[0] + '</p><h3 class="h3">' + x[1] + '</h3><p class="small muted" style="margin-top:6px">' + x[2] + '</p><button class="btn btn-ghost btn-xs" style="margin-top:14px" data-act="dummy">Koble til</button></div>'; }).join('') + '</div>';
  }, { title: 'Økonomi' });
})();
