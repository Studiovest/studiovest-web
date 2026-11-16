/* Skolefoto, tillegg: maler for ny fotodag, booking med tidspunkter, forhåndssalg og fotograferingsavgift,
   ordrekontroll før trykk med lab-sporing, bakgrunner som oppgradering, gratis nedlastinger,
   flere fotostasjoner, galleristatus, «varsle meg» og klasselisteimport med kolonnekobling. */
(function () {
  'use strict';
  var SV = window.SV, D = SV.data, esc = SV.esc, ic = SV.icon;
  var X = SV.skx = {};
  function st() { return SV.state; }

  // ---------- maler for ny fotodag ----------
  var PRESETS = [
    { id: 'skole', name: 'Skole med klasseliste', icon: 'school', desc: 'Klasseliste fra skolen, samtykke, portrett og klassebilde.', time: 'Av', slot: 0, buffer: 0, cap: 0, fee: 0, presale: false, free: '1 portrett til skolens systemer', access: 'Privat galleri per barn med kode', roster: 'Importert klasseliste' },
    { id: 'bhg', name: 'Barnehage', icon: 'heart', desc: 'Avdelinger, samtykke, søsken- og vennebilder med samtykke fra begge familier.', time: 'Valgfritt for søsken og familie', slot: 10, buffer: 5, cap: 1, fee: 0, presale: true, free: 'Ingen', access: 'Privat galleri per barn med kode', roster: 'Importert liste fra barnehagen' },
    { id: 'idrett', name: 'Idrettslag og mediedag', icon: 'users', desc: 'Lagbilder og spillerportretter. Åpen påmelding per lag.', time: 'Påkrevd per lag', slot: 20, buffer: 5, cap: 1, fee: 0, presale: true, free: 'Lagbilde til klubben', access: 'Privat galleri per spiller', roster: 'Åpen påmelding' },
    { id: 'apen', name: 'Åpen fotodag', icon: 'cal', desc: 'Familier booker tid selv, f.eks. julefoto. Fotograferingsavgift trekkes fra kjøpet.', time: 'Påkrevd', slot: 15, buffer: 5, cap: 1, fee: 250, presale: true, free: 'Ingen', access: 'Privat galleri per booking', roster: 'Åpen påmelding' },
    { id: 'felles', name: 'Felles eventgalleri', icon: 'grid', desc: 'Ett galleri alle deltakere ser, f.eks. skoleavslutning eller jubileum.', time: 'Av', slot: 0, buffer: 0, cap: 0, fee: 0, presale: false, free: 'Ingen', access: 'Felles galleri med én kode', roster: 'Ingen liste' },
    { id: 'gratis', name: 'Gratis nedlasting', icon: 'down', desc: 'Arrangøren betaler, deltakerne laster ned gratis. Ingen salg.', time: 'Av', slot: 0, buffer: 0, cap: 0, fee: 0, presale: false, free: 'Alle bilder', access: 'Felles eller privat', roster: 'Valgfritt' }
  ];
  X.presets = PRESETS;
  SV.on('newDay', function () {
    SV.modal('<h2 class="h2"><span class="serif">Ny fotodag</span></h2><p class="small muted">Velg en mal. Alt kan endres etterpå.</p><div class="opts" style="margin-top:14px;grid-template-columns:repeat(2,minmax(0,1fr))">' +
      PRESETS.map(function (p, i) { return '<label class="opt radio"><input type="radio" name="preset" value="' + p.id + '"' + (i === 0 ? ' checked' : '') + ' data-change="presetPick"><b>' + p.name + '</b><small>' + p.desc + '</small></label>'; }).join('') +
      '</div><div id="presetForm" style="margin-top:16px"></div>', { wide: true, after: function () { presetForm('skole'); } });
  });
  SV.on('presetPick', function (el) { presetForm(el.value); });
  function presetForm(id) {
    var p = SV.find(PRESETS, id), box = document.getElementById('presetForm'); if (!box) return;
    box.innerHTML = '<div class="card pad"><div class="g3"><label class="fld"><span>Navn</span><input class="inp" id="ndName" value="' + (id === 'idrett' ? 'Husnes IL, mediedag' : id === 'apen' ? 'Julefoto i studio' : id === 'bhg' ? 'Ny barnehage' : 'Ny skole') + '"></label><label class="fld"><span>Dato</span><input class="inp" type="date" id="ndDate" value="' + D.W(15) + '"></label><label class="fld"><span>Sted</span><input class="inp" value="' + (id === 'apen' ? 'Studio, Eidsvik' : 'Gymsalen') + '"></label></div>' +
      '<div class="g3"><label class="fld"><span>Tidspunkt</span><select class="sel"><option' + (p.time === 'Av' ? ' selected' : '') + '>Av (ingen tidsvalg)</option><option' + (/Valgfritt/.test(p.time) ? ' selected' : '') + '>Valgfritt</option><option' + (/Påkrevd/.test(p.time) ? ' selected' : '') + '>Påkrevd</option></select></label><label class="fld"><span>Minutter per avtale</span><input class="inp" type="number" value="' + (p.slot || 10) + '"></label><label class="fld"><span>Buffer mellom avtaler</span><input class="inp" type="number" value="' + (p.buffer || 5) + '"></label></div>' +
      '<div class="g3"><label class="fld"><span>Fotograferingsavgift</span><input class="inp" value="' + (p.fee ? p.fee + ' kr, trekkes fra kjøpet' : 'Ingen') + '"></label><label class="fld"><span>Gratis nedlasting</span><select class="sel"><option>' + esc(p.free) + '</option><option>Ingen</option><option>1 bilde</option><option>5 bilder</option><option>Alle bilder</option></select></label><label class="fld"><span>Tilgang</span><select class="sel"><option>' + esc(p.access) + '</option><option>Privat galleri per barn med kode</option><option>Felles galleri med én kode</option></select></label></div>' +
      '<label class="opt" style="margin-bottom:8px"><input type="checkbox"' + (p.presale ? ' checked' : '') + '><b>Forhåndssalg</b><small>Familier kan kjøpe pakke før fotodagen, med 15 % rabatt.</small></label>' +
      '<label class="opt" style="margin-bottom:8px"><input type="checkbox" checked><b>Lunsj og pauser låst</b><small>11:30–12:15 er ikke mulig å booke.</small></label>' +
      '<p class="hint">Liste: ' + esc(p.roster) + '. Samtykke og sletting etter 24 mnd følger alltid med.</p>' +
      '<div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn btn-dark" data-act="newDayCreate" data-p="' + id + '">Opprett fotodag</button></div></div>';
  }
  SV.on('newDayCreate', function (el) {
    var p = SV.find(PRESETS, el.getAttribute('data-p')), name = document.getElementById('ndName').value || p.name, d = document.getElementById('ndDate').value || D.W(15);
    st().newDays = (st().newDays || []).concat([{ id: 'S-n' + ((st().newDays || []).length + 1), school: name, kind: p.name, town: p.id === 'apen' ? 'Eidsvik' : 'Kvinnherad', contact: '–', date: d, phase: 'Avtale', closes: '', classes: [], dpa: p.id === 'apen', retake: '', commission: p.id === 'skole' || p.id === 'bhg' ? 10 : 0, deleteAt: '24 mnd etter fotodag', preset: p.id }]);
    SV.save(); SV.close(); SV.render(); SV.toast(name + ' er opprettet med malen «' + p.name + '»');
  });
  X.setup = function (s) {
    var p = SV.find(PRESETS, s.preset || (s.friends ? 'bhg' : 'skole'));
    return '<div class="g2"><div class="card"><div class="card-h"><h3>Oppsett</h3><span class="small muted">Mal: ' + esc(p.name) + '</span></div><div class="card-b"><dl class="kv">' +
      '<dt>Liste</dt><dd>' + esc(p.roster) + '</dd><dt>Tidspunkt</dt><dd>' + esc(p.time) + '</dd>' + (p.slot ? '<dt>Avtaler</dt><dd>' + p.slot + ' min + ' + p.buffer + ' min buffer, ' + p.cap + ' per luke</dd>' : '') +
      '<dt>Pauser</dt><dd>Lunsj 11:30–12:15 låst</dd><dt>Fotograferingsavgift</dt><dd>' + (p.fee ? SV.kr(p.fee) + ', trekkes fra kjøpet' : 'Ingen') + '</dd><dt>Forhåndssalg</dt><dd>' + (p.presale ? 'På, 15 % rabatt' : 'Av') + '</dd><dt>Gratis nedlasting</dt><dd>' + esc(p.free) + '</dd><dt>Tilgang</dt><dd>' + esc(p.access) + '</dd><dt>Bakgrunner</dt><dd>3 gratis, 3 premium à 49 kr</dd></dl></div></div>' +
      '<div class="card"><div class="card-h"><h3>Lenker</h3></div><div class="card-b"><div class="li">' + ic('link') + '<span class="li-t"><b>Bookingside</b><small>studiovest.no/b/' + esc(s.id.toLowerCase()) + ' · samme lenke selv om du endrer oppsettet</small></span><a class="btn btn-ghost btn-xs" href="#/booking/' + s.id + '">Åpne</a></div>' +
        '<div class="li">' + ic('qr') + '<span class="li-t"><b>QR-kode til oppslag</b><small>For plakat i gangen eller ranselpost</small></span><button class="btn btn-ghost btn-xs" data-act="dummy">Last ned</button></div>' +
        '<div class="li">' + ic('mail') + '<span class="li-t"><b>«Bildene kommer snart»</b><small>Samler e-post og mobil før galleriet publiseres</small></span>' + SV.chip('På', 'ok') + '</div></div></div></div>';
  };

  // ---------- galleristatus ----------
  var GAL = { 'S-fjt': ['Publisert', 'ok', '4 poser + klassebilde per elev'], 'S-sjb': ['Ikke publisert', 'mute', '41 foresatte venter på varsel'], 'S-hkb': ['Arkivert', 'mute', 'Slettes automatisk etter 24 mnd'], 'S-lyu': ['–', 'mute', 'Ingen bilder ennå'] };
  X.gal = function (s) { var g = GAL[s.id] || ['Utkast', 'mute', 'Opprettet fra mal']; return '<p class="small" style="margin-top:12px">Galleri: ' + SV.chip(g[0], g[1]) + ' <span class="muted">' + g[2] + '</span></p>'; };

  // ---------- ordrekontroll før trykk ----------
  var QS = ['Til kontroll', 'Godkjent', 'Hos lab', 'Sendt'];
  function orders() {
    var out = [], s = D.schoolDays[0], i = 0;
    s.classes.forEach(function (c) { c.pupils.forEach(function (p) { if (p.order && i < 14) {
      var n = Math.round(p.order / 149), digitalOnly = i % 4 === 2;
      out.push({ id: 'O-' + (3100 + i), pupil: p.name, cls: c.name, sum: p.order + (i % 3 === 0 ? 49 : 0), items: digitalOnly ? 'Alle digitale' : n + ' trykk' + (i % 3 === 0 ? ' · bakgrunn Høstskog' : ''), digital: digitalOnly,
        flag: digitalOnly ? '' : i % 5 === 1 ? 'Beskjæring: sjekk hake' : i % 3 === 0 ? 'Bakgrunnsbytte: sjekk hårkanter' : i % 6 === 4 ? 'Mulig duplikat (søsken)' : '', pos: ['35% 32%', '80% 32%', '12% 40%', '60% 35%'][i % 4] });
      i++; } }); });
    return out;
  }
  function qStat(o) { return o.digital ? 'Levert digitalt' : (st().qStatus || {})[o.id] || 'Til kontroll'; }
  X.queueCount = function () { return orders().filter(function (o) { return qStat(o) === 'Til kontroll'; }).length; };
  X.queue = function () {
    var os = orders(), cnt = {}; os.forEach(function (o) { var k = qStat(o); cnt[k] = (cnt[k] || 0) + 1; });
    var notify = st().qNotify !== false;
    return '<div class="row between" style="margin-bottom:12px"><div class="kpis"><span><b>' + (cnt['Til kontroll'] || 0) + '</b> til kontroll</span><span><b>' + (cnt['Godkjent'] || 0) + '</b> godkjent</span><span><b>' + ((cnt['Hos lab'] || 0) + (cnt['Sendt'] || 0)) + '</b> hos lab eller sendt</span><span><b>' + (cnt['Levert digitalt'] || 0) + '</b> levert digitalt</span></div>' +
      '<div class="row"><button class="btn btn-ghost btn-s" data-act="qAll">' + ic('check') + 'Godkjenn alle uten merknad</button><button class="btn btn-dark btn-s" data-act="qLab"' + (cnt['Godkjent'] ? '' : ' disabled') + '>Send ' + (cnt['Godkjent'] || 0) + ' til lab</button></div></div>' +
      '<div class="card tbl-w"><table class="tbl"><thead><tr><th>Bestilling</th><th class="hide-s">Innhold</th><th>Kontroll</th><th>Status</th><th class="r"></th></tr></thead><tbody>' +
      os.map(function (o) { var s = qStat(o); return '<tr><td><div class="row" style="flex-wrap:nowrap"><span class="thumb" style="width:40px;height:50px"><img src="img/kids/' + (o.cls < '4' ? 'nora' : 'emma') + '-p' + (o.id.slice(-1) % 4) + '.jpg" alt=""></span><span><b>' + esc(o.pupil) + '</b><small>' + o.id + ' · ' + esc(o.cls) + ' · ' + SV.kr(o.sum) + '</small></span></div></td><td class="hide-s small">' + esc(o.items) + '</td><td class="small">' + (o.flag ? '<span style="color:#8a5a14;font-weight:650">' + ic('info', 'tiny-ic') + ' ' + esc(o.flag) + '</span>' : '<span class="muted">OK</span>') + '</td><td>' + SV.chip(s, s === 'Til kontroll' ? 'sand' : s === 'Godkjent' ? 'ink' : 'ok') + '</td><td class="r">' + (s === 'Til kontroll' ? '<button class="btn btn-ghost btn-xs" data-act="qOk" data-id="' + o.id + '">Godkjenn</button>' : '') + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      '<div class="row between sec" style="margin-top:14px"><label class="row small" style="gap:10px"><label class="sw"><input type="checkbox" data-change="qNotify"' + (notify ? ' checked' : '') + ' aria-label="Varsle foresatte"><span></span></label>Varsle foresatte når trykket er sendt fra lab</label><span class="small muted">Trykk samles i klassepakker til skolen. Digitale kjøp leveres straks og trenger ikke kontroll.</span></div>';
  };
  SV.on('qOk', function (el) { st().qStatus = st().qStatus || {}; st().qStatus[el.getAttribute('data-id')] = 'Godkjent'; SV.save(); SV.render(); SV.toast('Godkjent'); });
  SV.on('qAll', function () { st().qStatus = st().qStatus || {}; var n = 0; orders().forEach(function (o) { if (!o.flag && qStat(o) === 'Til kontroll') { st().qStatus[o.id] = 'Godkjent'; n++; } }); SV.save(); SV.render(); SV.toast(n + ' bestillinger godkjent · de med merknad venter på deg'); });
  SV.on('qLab', function () { st().qStatus = st().qStatus || {}; var n = 0; orders().forEach(function (o) { if (qStat(o) === 'Godkjent') { st().qStatus[o.id] = 'Hos lab'; n++; } }); SV.save(); SV.render(); SV.toast(n + ' bestillinger sendt til lab som trykkfiler sortert per klasse'); });
  SV.on('qNotify', function (el) { st().qNotify = el.checked; SV.save(); });

  // ---------- booking og forhåndssalg ----------
  var BOOKINGS = [
    { id: 'S-sjb', name: 'Søsken- og familiebilder · Sjøbakken barnehage', kind: 'Barnehage', when: D.W(3), booked: 14, cap: 18, fee: 0, presale: 11, presaleKr: 3740 },
    { id: 'B-hil', name: 'Husnes IL, mediedag', kind: 'Idrettslag og mediedag', when: D.W(9), booked: 9, cap: 14, fee: 0, presale: 6, presaleKr: 2490 },
    { id: 'B-jul', name: 'Julefoto i studio', kind: 'Åpen fotodag', when: D.W(18), booked: 22, cap: 36, fee: 250, presale: 9, presaleKr: 5310 }
  ];
  X.bookings = function () {
    return '<div class="g3">' + BOOKINGS.map(function (b) {
      return '<div class="card pad"><p class="eyebrow">' + esc(b.kind) + ' · ' + SV.fdate(b.when) + '</p><h3 class="h3" style="font-size:17px">' + esc(b.name) + '</h3><div style="margin:14px 0 6px" class="row between small"><span>Booket</span><b class="num">' + b.booked + ' / ' + b.cap + '</b></div>' + SV.bar(b.booked, b.cap, 'skole') +
        '<dl class="kv small" style="margin-top:14px"><dt>Fotograferingsavgift</dt><dd>' + (b.fee ? SV.kr(b.fee) + ' (trekkes fra kjøp)' : 'Ingen') + '</dd><dt>Forhåndssalg</dt><dd>' + b.presale + ' pakker · ' + SV.kr(b.presaleKr) + '</dd><dt>Ubetalt</dt><dd>' + (b.fee ? '2 venter på Vipps · <button class="link" data-act="unpaid">minn på</button>' : '–') + '</dd></dl>' +
        '<div class="row" style="margin-top:14px"><a class="btn btn-ghost btn-xs" href="#/booking/' + b.id + '">' + ic('eye') + 'Se bookingsiden</a><button class="btn btn-ghost btn-xs" data-act="dummy">' + ic('qr') + 'QR</button></div></div>';
    }).join('') + '</div>' +
      '<div class="callout sec" style="margin-top:16px">' + ic('info') + '<span>Bookingsiden har fast lenke. Familien får bekreftelse med tid og galleri-kode, og kan endre eller avbestille selv frem til dagen før. Forhåndssalg gir 15 % rabatt og bedre planlegging av trykk.</span></div>';
  };
  SV.on('unpaid', function () { SV.toast('Påminnelse sendt til 2 som ikke har betalt'); });

  function slots(seedOff) {
    var out = [], t = 9 * 60, k = 0;
    while (t < 15 * 60) {
      if (t >= 11 * 60 + 30 && t < 12 * 60 + 15) { out.push({ t: t, lunch: true }); t = 12 * 60 + 15; continue; }
      out.push({ t: t, full: (k * 7 + seedOff) % 5 < 2 }); t += 15; k++;
    }
    return out;
  }
  function hm(m) { return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }
  X.dayBooking = function (s) {
    var sl = slots(3), booked = sl.filter(function (x) { return x.full; }).length, free = sl.filter(function (x) { return !x.full && !x.lunch; }).length;
    return '<div class="g21"><div class="card"><div class="card-h"><h3>Luker ' + SV.fdate(s.date, true) + '</h3><span class="small muted">' + booked + ' booket · ' + free + ' ledige</span></div><div class="card-b"><div class="slots" style="grid-template-columns:repeat(auto-fill,minmax(110px,1fr))">' +
      sl.map(function (x) { return x.lunch ? '<div class="opt nobox" style="padding:12px;background:rgba(22,20,18,.05);cursor:default;grid-column:span 2"><b>' + ic('lock', 'tiny-ic') + ' Lunsj 11:30–12:15</b><small>Låst</small></div>' : '<div class="opt nobox" style="padding:12px;' + (x.full ? 'background:rgba(125,139,106,.15);' : '') + 'cursor:default"><b>' + hm(x.t) + '</b><small>' + (x.full ? 'Booket' : 'Ledig') + '</small></div>'; }).join('') + '</div></div></div>' +
      '<div class="stack"><div class="card pad"><h3 class="h3">Innstillinger</h3><dl class="kv small" style="margin-top:10px"><dt>Luke</dt><dd>10 min + 5 min buffer</dd><dt>Kapasitet</dt><dd>1 familie per luke</dd><dt>Tidsvalg</dt><dd>Valgfritt</dd><dt>Endre/avbestille</dt><dd>Til dagen før kl. 12</dd></dl><a class="btn btn-ghost btn-s" style="margin-top:12px" href="#/booking/' + s.id + '">' + ic('eye') + 'Se siden familiene får</a></div>' +
      '<div class="callout">' + ic('users') + '<span>De bookede står i stasjonens liste i tidsrekkefølge. Fotografen klikker på familien når de kommer, så havner bildene i riktig familiegalleri.</span></div></div></div>';
  };

  // ---------- offentlig bookingside ----------
  SV.clientCfg.booking = { bare: true };
  SV.route('/booking/:id', 'booking', function (p) {
    var b = SV.find(BOOKINGS, p.id) || BOOKINGS[0], my = (st().bookings || {})[b.id], sl = slots(3);
    if (my) {
      return SV.brand(b.kind) + '<div class="bhead"><h1>Du er booket!</h1><p>' + esc(b.name) + '</p></div>' +
        '<div class="card pad" style="margin-top:18px;text-align:center"><p style="font-family:var(--serif);font-size:26px">' + SV.fdate(b.when, true) + ' kl. ' + my.t + '</p><p class="small muted" style="margin:6px 0 14px">' + esc(my.who) + (my.pre ? ' · forhåndskjøpt: ' + esc(my.pre) : '') + '</p><p class="small" style="margin-top:10px">Si navnet ditt ved stasjonen. Galleri-kode: <b>' + esc('BK-' + my.t.replace(':', '') + '-7Q') + '</b></p></div>' +
        '<div class="row" style="margin-top:14px"><button class="btn btn-ghost" data-act="ics">' + ic('cal') + 'Legg i kalender</button><button class="btn btn-ghost" data-act="bkCancel" data-id="' + b.id + '">Endre eller avbestill</button></div>' +
        '<p class="hint" style="margin-top:12px">Du får SMS dagen før. Bildene er klare ca. tre dager etter, og du får beskjed.</p>';
    }
    var pkgs = [['Ingen nå', 0, 'Velg bilder etterpå'], ['Digital familiepakke', 424, 'Alle digitale bilder (spar 15 %)'], ['Digital + 2 trykk', 594, 'Alle digitale + 2 × 18×24 (spar 15 %)']];
    return SV.brand(b.kind) + '<div class="bhead"><h1>' + esc(b.name) + '</h1><p>' + SV.fdate(b.when, true) + '. Velg en tid som passer. Det tar ca. 10 minutter.</p></div>' +
      '<form id="bk" onsubmit="return false" style="margin-top:18px"><h2 class="h2"><span class="serif">Tid</span></h2><div class="slots" style="grid-template-columns:repeat(4,1fr)">' +
      sl.map(function (x, i) { return x.lunch ? '<div class="opt nobox" style="grid-column:1/-1;padding:10px 14px;background:rgba(22,20,18,.05);cursor:default"><b class="small">' + ic('lock', 'tiny-ic') + ' Lunsj 11:30–12:15</b></div>' : '<label class="opt radio" style="padding:12px 10px 12px 38px;' + (x.full ? 'opacity:.4;cursor:not-allowed' : '') + '"><input type="radio" name="t" value="' + hm(x.t) + '"' + (x.full ? ' disabled' : '') + '><b>' + hm(x.t) + '</b>' + (x.full ? '<small>Full</small>' : '') + '</label>'; }).join('') +
      '</div><label class="opt radio" style="margin-top:8px"><input type="radio" name="t" value="Uten tid"><b>Jeg trenger ikke fast tid</b><small>Kom når det passer mellom 09 og 15</small></label>' +
      '<h2 class="h2" style="margin-top:20px"><span class="serif">Hvem</span></h2><label class="fld"><span>Barn i barnehagen</span><select class="sel" name="who"><option>Selma Haugland (Revehiet)</option><option>Johannes Haugland (Bjørnehiet)</option><option>Barnet er ikke på listen</option></select></label><label class="fld"><span>Mobil for bekreftelse</span><input class="inp" name="ph" inputmode="tel" placeholder="8 siffer"></label>' +
      '<h2 class="h2" style="margin-top:20px"><span class="serif">Forhåndskjøp</span> <span class="small muted" style="font-family:var(--sans)">valgfritt</span></h2>' + pkgs.map(function (k, i) { return '<label class="choice"><input type="radio" name="pre" value="' + k[0] + '"' + (i === 0 ? ' checked' : '') + '><b>' + k[0] + (k[1] ? ' · ' + SV.kr(k[1]) : '') + '</b><small>' + k[2] + '</small></label>'; }).join('') +
      (b.fee ? '<p class="hint">Fotograferingsavgift ' + SV.kr(b.fee) + ' betales nå med Vipps og trekkes fra når du kjøper bilder.</p>' : '') +
      '<button class="btn btn-dark bigbtn" style="margin-top:12px" data-act="bkOk" data-id="' + b.id + '">Bekreft booking</button></form>';
  }, { title: 'Booking' });
  SV.on('bkOk', function (el) {
    var f = document.getElementById('bk'), t = f.querySelector('input[name=t]:checked');
    if (!t) { SV.toast('Velg en tid', 'warn'); return; }
    st().bookings = st().bookings || {}; var pre = f.querySelector('input[name=pre]:checked').value;
    st().bookings[el.getAttribute('data-id')] = { t: t.value === 'Uten tid' ? 'valgfri tid' : t.value, who: f.who.value, pre: pre === 'Ingen nå' ? '' : pre };
    SV.save(); SV.render(); SV.toast(pre === 'Ingen nå' ? 'Booket · bekreftelse på SMS' : 'Booket og betalt med Vipps · bekreftelse på SMS');
  });
  SV.on('bkCancel', function (el) { delete st().bookings[el.getAttribute('data-id')]; SV.save(); SV.render(); SV.toast('Bookingen er avbestilt · velg ny tid'); });
  function qrSvg(seed) { var h = 0; for (var i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0; var c = ''; for (var y = 0; y < 13; y++) for (var x = 0; x < 13; x++) { h = (h * 1103515245 + 12345) >>> 0; var corner = (x < 3 && y < 3) || (x > 9 && y < 3) || (x < 3 && y > 9); if (corner || (h >> 16) & 1) c += '<rect x="' + x + '" y="' + y + '" width="1" height="1"/>'; } return '<svg viewBox="-1 -1 15 15" width="150" height="150" style="margin:0 auto;display:block" fill="#161412">' + c + '</svg>'; }

  // ---------- bakgrunner ----------
  var BG = [
    { id: '', name: 'Original', css: 'transparent', premium: false },
    { id: 'gra', name: 'Lys grå', css: 'linear-gradient(160deg,#e9e7e3,#bdb9b2)', premium: false },
    { id: 'beige', name: 'Varm beige', css: 'linear-gradient(160deg,#efe2cf,#cdb393)', premium: false },
    { id: 'bg-fjord', name: 'Fjordblå', css: 'radial-gradient(circle at 30% 30%,#7aa1c2,#2c4c6b)', premium: true },
    { id: 'bg-skog', name: 'Høstskog', css: 'radial-gradient(circle at 70% 30%,#d9a866,#5c6b3a 70%)', premium: true },
    { id: 'bg-bok', name: 'Bokhylle', css: 'repeating-linear-gradient(90deg,#6b4a32 0 18px,#8b5a3a 18px 30px,#4a3324 30px 40px)', premium: true }
  ];
  X.backdrops = function () {
    var on = st().bgOn || {};
    return '<div class="g3">' + BG.map(function (b) { var act = on[b.name] !== false; return '<div class="card"><div style="aspect-ratio:4/5;border-radius:14px 14px 0 0;position:relative;overflow:hidden;background:' + (b.id ? b.css : 'var(--stone)') + '"><img class="cutimg" src="img/kids/emma-p0.' + (b.id ? 'webp' : 'jpg') + '" alt="Portrett med bakgrunn ' + b.name + '"></div><div class="card-b row between"><span><b>' + b.name + '</b><br><span class="small muted">' + (b.premium ? 'Premium · 49 kr' : 'Gratis') + '</span></span><label class="sw"><input type="checkbox"' + (act ? ' checked' : '') + ' data-change="bgOn" data-n="' + b.name + '" aria-label="' + b.name + '"><span></span></label></div></div>'; }).join('') + '</div>' +
      '<div class="callout sec" style="margin-top:16px">' + ic('info') + '<span>Foresatte ser forhåndsvisning på sitt eget barn før de kjøper. Barnet klippes ut og bakgrunnen erstattes helt. Alle bytter havner i ordrekontrollen så hårkanter kan sjekkes før lab. Inntekten er vår, uten gebyr per ordre.</span></div>';
  };
  SV.on('bgOn', function (el) { st().bgOn = st().bgOn || {}; st().bgOn[el.getAttribute('data-n')] = el.checked; SV.save(); SV.toast(el.getAttribute('data-n') + (el.checked ? ' er tilgjengelig' : ' er skjult for foresatte')); });

  // foresatt: velg bakgrunn
  function curBg(ph) { return ((st().bgSel || {})[ph.id]) || ''; }
  X.cutClass = function (ph) { return ph.cut && curBg(ph) ? ' vh' : ''; };
  X.preview = function (ph) { var b = SV.find(BG, curBg(ph)); return ph.cut && b && b.id ? '<span style="position:absolute;inset:0;background:' + b.css + '"></span><img class="cutimg" src="' + ph.cut + '" alt="' + esc(ph.label) + ' med bakgrunn ' + esc(b.name) + '">' : ''; };
  X.backdropPick = function (ph) {
    if (!ph.portrait) return '';
    var cur = curBg(ph), on = st().bgOn || {};
    return '<p class="small" style="font-weight:700;margin:4px 0 8px">Bakgrunn</p><div class="row" style="gap:8px;margin-bottom:14px">' + BG.filter(function (b) { return on[b.name] !== false; }).map(function (b) { return '<button type="button" data-act="bgSel" data-ph="' + ph.id + '" data-b="' + b.id + '" aria-pressed="' + (b.id === cur) + '" title="' + b.name + (b.premium ? ' · 49 kr' : '') + '" style="width:46px;height:46px;border-radius:10px;border:0;cursor:pointer;background:' + (b.id ? b.css : 'var(--stone)') + ';box-shadow:' + (b.id === cur ? '0 0 0 3px var(--ink)' : 'inset 0 0 0 1px var(--line)') + ';position:relative">' + (b.premium ? '<i style="position:absolute;right:-4px;top:-6px;background:var(--sand);border-radius:6px;font-size:10px;font-weight:800;font-style:normal;padding:1px 4px">49</i>' : '') + (b.id ? '' : '<span class="tiny" style="font-weight:700">Orig.</span>') + '</button>'; }).join('') + '</div>';
  };
  SV.on('bgSel', function (el) {
    var ph = el.getAttribute('data-ph'), b = el.getAttribute('data-b'); st().bgSel = st().bgSel || {}; st().bgSel[ph] = b;
    st().cart = st().cart.filter(function (c) { return !(c.photo === ph && /^bg-/.test(c.prod)); });
    if (/^bg-/.test(b)) st().cart.push({ photo: ph, prod: b, qty: 1 });
    SV.save(); var y = window.scrollY; SV.render(); window.scrollTo(0, y);
    var bb = SV.find(BG, b); SV.toast(bb.premium ? bb.name + ' lagt til · 49 kr' : 'Bakgrunn: ' + bb.name + ' (gratis)');
  });
  X.freeBanner = function (paid) { var got = st().freeDl; return '<div class="callout sage" style="margin-bottom:14px">' + ic('gift') + '<span style="flex:1"><b>Ett digitalt portrett av hvert barn er gratis</b>, betalt av skolen. ' + (got ? 'Lastet ned.' : '') + '</span>' + (got ? '' : '<button class="btn btn-dark btn-xs" data-act="freeDl">Last ned gratis</button>') + '</div>'; };
  SV.on('freeDl', function () { st().freeDl = true; SV.save(); var y = window.scrollY; SV.render(); window.scrollTo(0, y); SV.toast('Gratis portrett lastet ned for Emma og Nora'); });

  // foresatt før fotodag: forhåndssalg, familietime og varsle meg
  X.presale = function () {
    return '<h2 class="h2" style="margin-top:20px"><span class="serif">Forhåndskjøp</span> <span class="small muted" style="font-family:var(--sans)">valgfritt, 15 % rabatt</span></h2>' +
      [['', 'Vent til jeg har sett bildene', 'Du får beskjed når galleriet er klart.'], ['Alle digitale', 'Alle digitale bilder · 297 kr', 'Ordinær pris 349 kr'], ['Digital + trykk', 'Alle digitale + 2 trykk 18×24 · 550 kr', 'Ordinær pris 647 kr']].map(function (k, i) { return '<label class="choice"><input type="radio" name="pre" value="' + k[0] + '"' + (i === 0 ? ' checked' : '') + '><b>' + k[1] + '</b><small>' + k[2] + '</small></label>'; }).join('') +
      '<div class="callout" style="margin-top:8px">' + ic('cal') + '<span>Vil dere ha familiebilde med søsken eller foreldre? <a href="#/booking/S-sjb">Book en tid</a> etter lunsj samme dag.</span></div>' +
      '<label class="choice cb" style="margin-top:10px"><input type="checkbox" name="notify" checked><b>Varsle meg når bildene er klare</b><small>SMS til mobilen du er registrert med</small></label>';
  };
  X.preDone = function () { var c = st().preConsent || {}; return (c.pre ? '<div class="callout sage" style="margin-top:14px">' + ic('check') + '<span>Forhåndskjøpt: <b>' + esc(c.pre) + '</b>. Betalt med Vipps. Du velger bildene når galleriet åpner.</span></div>' : '') + (c.notify ? '<p class="hint">Du får SMS når bildene er klare.</p>' : ''); };
  SV.on('preSave', function () {
    var f = document.getElementById('pre');
    st().preConsent = { consent: f.querySelector('input[name=c]:checked').value, sib: f.sib.checked, friend: f.friend.value.trim(), bg: f.querySelector('input[name=bg]:checked').value, pre: (f.querySelector('input[name=pre]:checked') || {}).value || '', notify: f.notify && f.notify.checked };
    SV.save(); SV.render(); SV.toast(st().preConsent.pre ? 'Lagret og betalt med Vipps' : 'Lagret · barnehagen og fotografen ser valgene');
  });

  // ---------- flere fotostasjoner ----------
  X.station = function () { return 'Stasjon ' + (st().station || 1); };
  X.stations = function () {
    var me = st().station || 1;
    return '<div class="card"><div class="card-h"><h3>Stasjoner</h3><span class="small muted">samme fotodag, synkes live</span></div><div class="card-b">' +
      [[1, 'Aleksander', 'Maurtua', 9, 12], [2, 'Hanne', 'Ekornet', 6, 14]].map(function (x) { return '<div class="li"><span class="time" style="font-size:18px;width:40px">' + x[0] + '</span><span class="li-t"><b>' + x[1] + ' · ' + x[2] + '</b><small>' + x[3] + ' av ' + x[4] + ' fotografert · bilder navngis automatisk med kode og stasjon</small></span>' + (x[0] === me ? SV.chip('Denne', 'ok') : '<button class="btn btn-ghost btn-xs" data-act="station" data-n="' + x[0] + '">Bytt</button>') + '</div>'; }).join('') +
      '<p class="hint">Kameraet kan også kobles til PC med kabel (tethering) på stasjonen. Da vises bildet stort med en gang og lagres rett i riktig mappe.</p></div></div>';
  };
  SV.on('station', function (el) { st().station = +el.getAttribute('data-n'); SV.save(); SV.render(); });

  // ---------- klasseliste med kolonnekobling og gjenkjenning ved ny import ----------
  SV.on('csv', function () {
    var cols = [['Elevnavn', 'Navn'], ['Basisgruppe', 'Klasse'], ['Kontaktlærer', 'Lærer'], ['Foresatt 1 e-post', 'Foresatt e-post'], ['Foresatt 1 mobil', 'Foresatt mobil'], ['Elev-ID', 'Fast ID'], ['Fødselsnummer', 'Forkastes'], ['Adresse', 'Forkastes']];
    SV.modal('<h2 class="h2"><span class="serif">Importer klasseliste</span></h2><p class="small muted">Eksempel: eksport fra skolens adminsystem. Vi kobler kolonnene automatisk. Sjekk og juster.</p>' +
      '<table class="tbl" style="margin-top:12px"><thead><tr><th>Kolonne i filen</th><th>Brukes som</th></tr></thead><tbody>' + cols.map(function (c) { return '<tr><td>' + c[0] + '</td><td>' + (c[1] === 'Forkastes' ? SV.chip('Forkastes', 'bad') : '<select class="sel" style="min-height:34px;padding:4px 8px"><option>' + c[1] + '</option><option>Ikke bruk</option></select>') + '</td></tr>'; }).join('') + '</tbody></table>' +
      '<div class="callout sage" style="margin-top:14px">' + ic('check') + '<span>Gjenkjent med fast elev-ID: <b>168 uendret</b>, <b>3 nye</b>, <b>1 har sluttet</b> (bildene skjules), <b>2 har byttet klasse</b>. Samtykker og koder beholdes.</span></div>' +
      '<div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn btn-dark" data-act="csvOk">Importer</button></div>', { wide: true });
  });
  SV.on('csvOk', function () { SV.close(); SV.toast('Klasselisten er oppdatert · 3 nye foresatte får samtykkeskjema'); });
})();
