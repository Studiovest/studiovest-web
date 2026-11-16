/* Fotostasjon (tethering) for skolefoto og portrettdager i bedrift.
   Egen løsning: kamera i TetherPro-kabel (USB-C) til PC som kjører Studiovest Stasjon (mappen stasjon/
   i repoet). Stasjonen tar imot bildene fra kamera, navngir dem etter skannet QR-kode, sjekker samtykke,
   tar kopi til SSD og laster opp til portalen. Denne siden viser hvordan det ser ut i portalen (simulert). */
(function () {
  'use strict';
  var SV = window.SV, D = SV.data, esc = SV.esc, ic = SV.icon;

  var MODES = {
    skole: { title: 'Fjordtun skule · omfotografering', tpl: '[Skole]/[Klasse]/[Kode]_[Nr]', next: 'Neste elev' },
    bedrift: { title: 'Vestkraft Energi · portrettdag', tpl: 'Vestkraft/[Etternavn]_[Fornavn]_[Nr]', next: 'Neste person' }
  };
  var S = { mode: 'skole', cur: null, shots: {}, log: [], queue: 0, synced: 0, done: {}, absent: {}, picks: {} };
  function subjects() {
    if (S.mode === 'skole') {
      var s = D.schoolDays[0], out = [];
      [s.classes[4], s.classes[0]].forEach(function (c) { c.pupils.slice(0, 7).forEach(function (p) { out.push({ id: p.code, name: p.name, group: c.name, consent: SV.state.consents[p.id] || p.consent, kid: /Emma/.test(p.name) ? 'emma' : /Nora/.test(p.name) ? 'nora' : null }); }); });
      return out;
    }
    return [['Ola Brekke', 'Avdelingsleder'], ['Emil Sandvik', 'Lærling'], ['Nora Fet', 'Elektriker'], ['Kjell Ask', 'Fagarbeider'], ['Ingvild Rønning', 'HR'], ['Kristian Moe', 'Driftsingeniør'], ['Sara Lid', 'Økonomi'], ['Per Åsen', 'Montør']].map(function (x, i) {
      var consent = x[0] === 'Kjell Ask' ? (SV.state.consentKjell ? 'Ja' : 'Ikke svart') : 'Ja';
      return { id: 'VKE-' + (101 + i), name: x[0], group: x[1], consent: consent, email: x[0].split(' ')[0].toLowerCase() + '@vestkraft.example', signup: i < 6 ? '09:' + String(i * 10).padStart(2, '0') : 'Drop-in' };
    });
  }
  function fname(sub, n) {
    var p = sub.name.split(' '), fn = p[0], ln = p[p.length - 1];
    return MODES[S.mode].tpl.replace('[Skole]', 'FJT2026').replace('[Klasse]', sub.group).replace('[Kode]', sub.id).replace('[Etternavn]', ln).replace('[Fornavn]', fn).replace('[Nr]', String(n).padStart(4, '0')) + '.jpg';
  }
  function img(sub, i) {
    if (S.mode === 'skole') return 'img/kids/' + (sub.kid || (sub.group === '1A' ? 'nora' : 'emma')) + '-p' + (i % 4) + '.jpg';
    return SV.thumb(D.img.portrett);
  }
  function blocked(sub) { return sub.consent === 'Nei' || (S.mode === 'bedrift' && sub.consent !== 'Ja'); }
  function log(t) { var d = new Date(); S.log.unshift([String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ':' + String(d.getSeconds()).padStart(2, '0'), t]); S.log = S.log.slice(0, 9); }

  SV.route('/stasjon', 'studio', function () {
    var subs = subjects(), cur = S.cur && SV.find(subs, S.cur), m = MODES[S.mode], shots = cur ? (S.shots[cur.id] || []) : [];
    var doneN = subs.filter(function (s) { return S.done[s.id]; }).length;
    var queue = '<div class="card st-q"><div class="card-b"><label class="search" style="max-width:none;margin-bottom:10px">' + ic('qr') + '<input id="scanIn" placeholder="Skann QR eller skriv navn" aria-label="Skann QR-kode eller søk" data-input="stFilter" autocomplete="off"></label><p class="tiny muted" style="margin-bottom:8px">USB-skanneren «skriver» koden og trykker Enter. Klikk på en person for å starte.</p><div id="stList">' +
      subs.map(function (s) {
        var st = S.done[s.id] ? 'Ferdig' : S.absent[s.id] ? 'Fravær' : s.id === S.cur ? 'Pågår' : blocked(s) ? (s.consent === 'Nei' ? 'Skal ikke' : 'Mangler') : 'Venter';
        return '<button class="pp' + (blocked(s) ? ' flag' : '') + (s.id === S.cur ? ' on' : '') + '" data-act="stPick" data-id="' + s.id + '" data-q="' + esc((s.name + ' ' + s.id).toLowerCase()) + '">' + SV.avatar(s.name) + '<span><b>' + esc(s.name) + '</b><small>' + esc(s.group) + (s.signup ? ' · ' + s.signup : '') + ' · ' + esc(s.id) + '</small></span>' + SV.chip(st, st === 'Ferdig' ? 'ok' : st === 'Pågår' ? 'sand' : /Skal|Mangler/.test(st) ? 'bad' : 'mute') + '</button>';
      }).join('') + '</div></div></div>';
    var center;
    if (!cur) center = '<div class="card st-c"><div class="st-view st-empty">' + ic('qr') + '<b>Skann QR-kortet</b><span>Filnavnet settes automatisk fra koden, og bildene kobles til riktig ' + (S.mode === 'skole' ? 'elev' : 'person') + '.</span></div></div>';
    else if (blocked(cur)) center = '<div class="card st-c"><div class="st-view st-block">' + ic('shield') + '<b>' + (cur.consent === 'Nei' ? 'Ikke fotografer ' : 'Samtykke mangler for ') + esc(cur.name) + '</b><span>' + (cur.consent === 'Nei' ? 'Foresatte har svart nei. Bilder som likevel tas, slettes ved opplasting.' : 'Be personen svare på samtykket på mobilen først. Lenke sendes på SMS.') + '</span><button class="btn btn-acc btn-s" data-act="stSkip">Hopp over</button></div></div>';
    else {
      var last = shots[shots.length - 1];
      center = '<div class="card st-c"><div class="st-view">' + (last ? '<img src="' + img(cur, last.i) + '" alt="Siste bilde av ' + esc(cur.name) + '">' : '<div class="st-live">LIVE VIEW</div>') + '<span class="st-guide" aria-hidden="true"></span><span class="st-cap">' + esc(cur.name) + ' · ' + esc(cur.group) + '</span>' + (last ? '<span class="st-file">' + esc(last.f) + ' · ' + last.st + '</span>' : '') + '</div>' +
        '<div class="card-b"><div class="st-strip">' + shots.map(function (s, k) { return '<button class="' + (S.picks[cur.id] === k ? 'on' : '') + '" data-act="stFav" data-k="' + k + '" aria-label="Velg ' + esc(s.f) + ' som favoritt"><img src="' + img(cur, s.i) + '" alt=""><i>' + String(s.n).padStart(2, '0') + '</i></button>'; }).join('') + '</div>' +
        '<div class="row" style="margin-top:12px"><button class="btn btn-acc" data-act="stShoot">' + ic('cam') + 'Ta bilde <span class="kbd">Mellomrom</span></button><button class="btn btn-dark" data-act="stDone"' + (shots.length ? '' : ' disabled') + '>' + ic('check') + 'Ferdig, ' + m.next.toLowerCase() + ' <span class="kbd">Enter</span></button><button class="btn btn-ghost btn-s" data-act="stAbsent">Fravær</button></div>' +
        '<p class="hint">' + (S.mode === 'skole' ? 'Ferdig: elevens bilder legges i galleriet til foresatte. Fravær gir automatisk plass på omfotograferingen.' : 'Ferdig: personen får galleriet sitt på e-post med en gang, og velger to bilder til retusj.') + '</p></div></div>';
    }
    var side = '<div class="stack"><div class="card"><div class="card-h"><h3>Utstyr</h3></div><div class="card-b small">' +
      [['cam', 'Kamera (Sony) · USB-C-kabel', 'Studiovest Stasjon · tilkoblet'], ['qr', 'QR-skanner (USB)', 'Klar'], ['upload', 'Opplasting', S.queue ? S.queue + ' i kø' : 'Alt er synket'], ['box', 'Kopi til SSD', 'Hver fil lagres to steder']].map(function (x) { return '<div class="li" style="padding:8px 0">' + ic(x[0]) + '<span class="li-t"><b>' + x[1] + '</b><small>' + x[2] + '</small></span><i class="ndot n-ok"></i></div>'; }).join('') + '</div></div>' +
      '<div class="card"><div class="card-h"><h3>Filnavn</h3></div><div class="card-b"><input class="inp" id="tplIn" value="' + esc(m.tpl) + '" data-input="stTpl" aria-label="Mal for filnavn" style="font-family:ui-monospace,Menlo,monospace;font-size:13px"><p class="tiny muted" style="margin-top:6px">Eksempel: <b id="tplEx">' + esc(cur ? fname(cur, 1) : fname(subs[0], 1)) + '</b></p><p class="hint">Koden lagres også i bildets metadata, så bildet finner riktig person selv om filen får nytt navn.</p></div></div>' +
      '<div class="card"><div class="card-h"><h3>Logg</h3><span class="small muted">' + doneN + ' av ' + subs.length + ' ferdig</span></div><div class="card-b"><ul class="feed small">' + (S.log.length ? S.log.map(function (l) { return '<li><span>' + l[1] + '</span><time>' + l[0] + '</time></li>'; }).join('') : '<li><span class="muted">Ingen hendelser ennå</span></li>') + '</ul></div></div></div>';
    SV.after(function () { var i = document.getElementById('scanIn'); if (i && !cur) i.focus({ preventScroll: true }); });
    return SV.head({ eyebrow: 'Stasjon 1 · ' + m.title, a: 'Fotostasjon', lead: 'Kamera i kabel til PC. Skann koden, ta bildene, trykk ferdig. Navn, sortering, opplasting og samtykkekontroll skjer av seg selv.',
        actions: '<div class="filters" style="margin:0"><button class="fbtn' + (S.mode === 'skole' ? ' on' : '') + '" data-act="stMode" data-m="skole">Skolefoto</button><button class="fbtn' + (S.mode === 'bedrift' ? ' on' : '') + '" data-act="stMode" data-m="bedrift">Portrettdag bedrift</button></div>' }) +
      '<div class="st-grid">' + queue + center + side + '</div>' +
      '<details class="card sec"><summary class="card-h" style="cursor:pointer"><h3>Slik settes stasjonen opp</h3><span class="small muted">utstyr og programmer</span></summary><div class="card-b research"><ul class="new">' +
        '<li><b>Kabel:</b> Tether Tools TetherPro Optima 10G, USB-C rett til vinkel (10 Gbit/s). Vinkelen går inn i kameraet, så kontakten ikke belastes. Velg lengde etter rommet; 4,6 m er vanlig for skolefoto. Bruk kabelsikring og batterieliminator på lange dager.</li>' +
        '<li><b>PC:</b> Bærbar med Studiovest Stasjon, vårt eget program. Det tar imot bildene fra kamera, gir dem navn etter koden, legger koden i metadata (XMP), tar kopi til ekstern SSD og laster opp. Virker uten nett og laster opp når nettet er tilbake.</li>' +
        '<li><b>Kamera:</b> direkte via kabelen med libgphoto2 (åpen kildekode), eller via kameraprodusentens gratis tether-program som lagrer i en mappe stasjonen følger. Støtte for direkte styring og live view kan bygges med Sony Camera Remote SDK.</li>' +
        '<li><b>QR:</b> USB-skanner til QR-kortene. Den skriver koden inn som et tastatur, så stasjonen vet hvem som står foran kamera.</li>' +
        '<li><b>Samtykke:</b> klasseliste og samtykker hentes fra portalen før dagen. Barn med «nei» gir rød stopp, og bilder som likevel tas legges i karantene og lastes ikke opp.</li>' +
        '<li><b>Flere stasjoner:</b> én PC per stasjon. Portalen ser alle stasjonene live.</li></ul></div></details>';
  }, { title: 'Fotostasjon' });

  function rerender() { var y = window.scrollY; SV.render(); window.scrollTo(0, y); }
  SV.on('stMode', function (el) { S.mode = el.getAttribute('data-m'); S.cur = null; rerender(); });
  SV.on('stPick', function (el) { start(el.getAttribute('data-id')); });
  function start(id) {
    var sub = SV.find(subjects(), id); if (!sub) { SV.toast('Fant ingen med koden ' + id, 'warn'); return; }
    S.cur = id; log('Skannet ' + esc(sub.id) + ' · ' + esc(sub.name)); if (blocked(sub)) log('<b>Stopp:</b> ' + (sub.consent === 'Nei' ? 'ikke samtykke' : 'samtykke mangler')); rerender();
  }
  SV.on('stFilter', function (el) { var q = el.value.trim().toLowerCase(); document.querySelectorAll('#stList .pp').forEach(function (b) { b.hidden = q && b.getAttribute('data-q').indexOf(q) < 0; }); });
  document.addEventListener('keydown', function (e) {
    if (location.hash !== '#/stasjon') return;
    var t = e.target;
    if (t && t.id === 'scanIn' && e.key === 'Enter') { var v = t.value.trim(), subs = subjects(), hit = SV.find(subs, v.toUpperCase()) || subs.filter(function (s) { return s.name.toLowerCase().indexOf(v.toLowerCase()) > -1; })[0]; if (hit) start(hit.id); else SV.toast('Fant ingen med «' + v + '»', 'warn'); e.preventDefault(); return; }
    if (t && /INPUT|TEXTAREA|SELECT/.test(t.tagName)) return;
    if (e.key === ' ' && S.cur) { e.preventDefault(); shoot(); }
    if (e.key === 'Enter' && S.cur) { e.preventDefault(); done(); }
  });
  function shoot() {
    var sub = SV.find(subjects(), S.cur); if (!sub) return;
    if (blocked(sub)) { SV.toast('Denne personen skal ikke fotograferes', 'warn'); return; }
    var list = S.shots[sub.id] = S.shots[sub.id] || [], n = list.length + 1, ph = { n: n, i: n - 1, f: fname(sub, n), st: 'lastes ned' };
    list.push(ph); S.queue++; log('Nytt bilde · ' + esc(ph.f)); rerender();
    setTimeout(function () { ph.st = 'lastet opp'; S.queue = Math.max(0, S.queue - 1); log('Lastet opp · ' + esc(ph.f)); if (location.hash === '#/stasjon') rerender(); }, 1100);
  }
  SV.on('stShoot', shoot);
  function done() {
    var subs = subjects(), sub = SV.find(subs, S.cur); if (!sub || !(S.shots[sub.id] || []).length) return;
    S.done[sub.id] = true; log(S.mode === 'skole' ? 'Ferdig · ' + esc(sub.name) + ' lagt i galleriet' : 'Ferdig · galleri sendt til ' + esc(sub.email));
    var next = subs.filter(function (s) { return !S.done[s.id] && !S.absent[s.id] && !blocked(s); })[0];
    S.cur = next ? next.id : null; rerender();
    SV.toast(S.mode === 'skole' ? sub.name + ' er ferdig · ' + (next ? 'neste: ' + next.name : 'alle er tatt') : 'Galleri sendt til ' + sub.name + ' · ' + (next ? 'neste: ' + next.name : 'alle er tatt'));
  }
  SV.on('stDone', done);
  SV.on('stAbsent', function () { var sub = SV.find(subjects(), S.cur); S.absent[sub.id] = true; log('Fravær · ' + esc(sub.name) + ' får plass på omfotografering'); S.cur = null; rerender(); });
  SV.on('stSkip', function () { S.cur = null; rerender(); });
  SV.on('stFav', function (el) { S.picks[S.cur] = +el.getAttribute('data-k'); rerender(); });
  SV.on('stTpl', function (el) { MODES[S.mode].tpl = el.value; var subs = subjects(), cur = (S.cur && SV.find(subs, S.cur)) || subs[0]; document.getElementById('tplEx').textContent = fname(cur, 1); });

  // ---------- Bedrift: portrettdag ----------
  SV.route('/bedrift/portrettdag', 'studio', function () {
    var subs = subjects.call(null), m = S.mode; S.mode = 'bedrift'; subs = subjects(); S.mode = m;
    var sent = subs.filter(function (s, i) { return i < 5; });
    return '<p class="small" style="margin-bottom:14px"><a href="#/bedrift" class="muted">← Bedrift</a></p>' + SV.head({ eyebrow: SV.dot('bedrift') + 'Vestkraft Energi AS · ' + SV.fdate(D.W(6), true), a: 'Portrettdag', lead: 'Ansatte melder seg på en tid selv, blir tatt i kø med tethering, og får galleriet sitt på e-post med en gang. De velger selv hvilke bilder som skal retusjeres.', actions: '<a class="btn btn-acc btn-s" href="#/stasjon">' + ic('cam') + 'Åpne fotostasjonen</a>' }) +
      '<div class="g4">' + SV.stat('users', 'Påmeldt', subs.length, '6 med tid · 2 drop-in') + SV.stat('mail', 'Galleri sendt', sent.length, 'under fotograferingen') + SV.stat('heart', 'Valgt til retusj', '7', '2 inkludert per person') + SV.stat('wallet', 'Ekstra retusj', SV.kr(1050), '3 bilder à 350 kr', true) + '</div>' +
      '<div class="g21 sec"><div class="card tbl-w"><table class="tbl"><thead><tr><th>Person</th><th>Tid</th><th class="hide-s">Samtykke</th><th>Galleri</th><th class="r">Retusj</th></tr></thead><tbody>' +
      subs.map(function (s, i) { return '<tr><td><b>' + esc(s.name) + '</b><small>' + esc(s.group) + '</small></td><td>' + s.signup + '</td><td class="hide-s">' + SV.chip(s.consent === 'Ja' ? 'Signert' : 'Venter') + '</td><td>' + (i < 5 ? SV.chip('Sendt', 'ok') : SV.chip('Ikke tatt', 'mute')) + '</td><td class="r small">' + (i < 3 ? '2 valgt' + (i === 1 ? ' + 3 ekstra' : '') : i < 5 ? '<span class="muted">venter</span>' : '–') + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      '<div class="stack"><div class="card pad"><h3 class="h3">Påmelding</h3><p class="small muted" style="margin:6px 0 12px">Del lenken med de ansatte. De velger tid og godtar samtykke i samme skjema.</p><div class="row" style="flex-wrap:nowrap"><input class="inp" readonly value="studiovest.no/p/vestkraft" aria-label="Påmeldingslenke"><button class="btn btn-dark" data-act="copyLink">Kopier</button></div><button class="btn btn-ghost btn-xs" style="margin-top:10px" data-act="csv">' + ic('upload') + 'Importer ansattliste</button></div>' +
      '<div class="card pad"><h3 class="h3">Regler</h3><dl class="kv small" style="margin-top:10px"><dt>Inkludert</dt><dd>2 retusjerte bilder per person</dd><dt>Ekstra</dt><dd>350 kr per bilde, faktureres bedriften</dd><dt>Frist for valg</dt><dd>5 dager</dd><dt>Levering</dt><dd>Retusjert innen 3 virkedager, rett i mediebanken</dd></dl></div>' +
      '<a class="btn btn-ghost" href="#/portrett">' + ic('eye') + 'Se galleriet en ansatt får</a></div></div>';
  }, { title: 'Portrettdag' });

  // galleri for den ansatte
  SV.route('/portrett', 'ansatt', function () {
    var picks = SV.state.headPicks || [], extra = Math.max(0, picks.length - 2), sent = SV.state.headSent;
    var pos = ['50% 20%', '45% 25%', '55% 22%', '50% 30%', '40% 20%', '60% 25%', '50% 15%', '48% 28%'];
    return SV.brand('for Vestkraft Energi AS') + '<div class="bhead"><h1>Portrettene dine, Ola</h1><p>Velg to bilder til retusj, de er inkludert. Vil du ha flere, koster de 350 kr per bilde og faktureres Vestkraft.</p></div>' +
      (sent ? '<div class="callout sage" style="margin-top:16px">' + ic('check') + '<span>Valget er sendt. Retusjerte bilder kommer i mediebanken innen 3 virkedager.</span></div>' : '') +
      '<div class="gal" style="margin-top:16px;grid-template-columns:repeat(2,1fr)">' + pos.map(function (p, i) { var on = picks.indexOf(i) > -1; return '<figure class="gi portrait' + (on ? ' on' : '') + '">' + SV.pic(D.img.portrett, p) + '<span class="gi-n">' + String(i + 1).padStart(2, '0') + '</span><button type="button" class="gi-sel gi-heart' + (on ? ' on' : '') + '" data-act="headPick" data-i="' + i + '" aria-pressed="' + on + '" aria-label="Velg bilde ' + (i + 1) + '">' + ic('heart') + '</button></figure>'; }).join('') + '</div>' +
      '<div class="cartbar"><span class="small">' + picks.length + ' valgt</span><b>' + (extra ? '+ ' + SV.kr(extra * 350) : 'Inkludert') + '</b><button class="btn btn-acc" style="margin-left:auto" data-act="headSend"' + (picks.length ? '' : ' disabled') + '>Send til retusj</button></div>' +
      '<p class="hint" style="margin-top:12px"><a href="#/samtykke">Samtykke og bruk av bildene</a></p>';
  }, { title: 'Portretter' });
  SV.on('headPick', function (el) { var i = +el.getAttribute('data-i'), p = SV.state.headPicks = SV.state.headPicks || []; var k = p.indexOf(i); if (k > -1) p.splice(k, 1); else p.push(i); SV.state.headSent = false; SV.save(); var y = window.scrollY; SV.render(); window.scrollTo(0, y); if (p.length === 3 && k < 0) SV.toast('Tredje bilde: 350 kr ekstra, faktureres Vestkraft'); });
  SV.on('headSend', function () { SV.state.headSent = true; SV.save(); SV.render(); SV.toast('Sendt til retusj'); });
})();
