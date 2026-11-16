/* Fotostasjon (tethering) for skolefoto og portrettdager i bedrift.
   Egen løsning: kamera i TetherPro-kabel (USB-C) til PC som kjører Studiovest Stasjon (mappen stasjon/
   i repoet). Stasjonen tar imot bildene fra kamera, navngir dem etter navnet som er valgt i listen, sjekker samtykke,
   tar kopi til SSD og laster opp til portalen. Denne siden viser hvordan det ser ut i portalen (simulert). */
(function () {
  'use strict';
  var SV = window.SV, D = SV.data, esc = SV.esc, ic = SV.icon;

  // Fotodager stasjonen kan brukes på. Listen, samtykkene og filnavnmalen følger prosjektet.
  var S = { proj: null, tpl: {}, cur: null, shots: {}, log: [], queue: 0, synced: 0, done: {}, absent: {}, picks: {}, sel: {}, rej: {}, syncing: false, cls: '' };
  function kidOf(name) { return /Oskar Sæbø/.test(name) ? 'oskar' : /Emma/.test(name) ? 'emma' : /Nora/.test(name) ? 'nora' : null; }
  function fromClasses(classes, max) {
    var out = [];
    classes.forEach(function (c) { (max ? c.pupils.slice(0, max) : c.pupils).forEach(function (p) { out.push({ id: p.code, name: p.name, group: c.name, consent: SV.state.consents[p.id] || p.consent, kid: kidOf(p.name) }); }); });
    return out;
  }
  function vestkraft() {
    return [['Ola Brekke', 'Avdelingsleder'], ['Emil Sandvik', 'Lærling'], ['Nora Fet', 'Elektriker'], ['Kjell Ask', 'Fagarbeider'], ['Ingvild Rønning', 'HR'], ['Kristian Moe', 'Driftsingeniør'], ['Sara Lid', 'Økonomi'], ['Per Åsen', 'Montør']].map(function (x, i) {
      var consent = x[0] === 'Kjell Ask' ? (SV.state.consentKjell ? 'Ja' : 'Ikke svart') : 'Ja';
      return { id: 'VKE-' + (101 + i), name: x[0], group: x[1], consent: consent, email: x[0].split(' ')[0].toLowerCase() + '@vestkraft.example', signup: i < 6 ? '09:' + String(i * 10).padStart(2, '0') : 'Drop-in' };
    });
  }
  function projects() {
    var fj = D.schoolDays[0], sj = D.schoolDays[1];
    var list = [
      { id: 'fjt-omfoto', kind: 'skole', title: 'Fjordtun skule · omfotografering', type: 'Skolefoto · fravær og nye bilder', place: fj.town, date: D.W(0), tag: 'FJT2026', tpl: '[Skole]/[Klasse]/[Kode]_[Nr]', next: 'Neste elev', subs: function () { return fromClasses([fj.classes[4], fj.classes[0]], 7); } },
      { id: 'sjb', kind: 'skole', title: 'Sjøbakken barnehage', type: 'Barnehagefoto · 4 avdelinger', place: sj.town, date: sj.date, tag: 'SJB2026', tpl: '[Skole]/[Klasse]/[Kode]_[Nr]', next: 'Neste barn', subs: function () { return fromClasses(sj.classes); } },
      { id: 'vke-portrett', kind: 'bedrift', title: 'Vestkraft Energi · portrettdag', type: 'Portrettdag bedrift', place: 'Husnes', date: D.W(6), tag: 'VKE', tpl: 'Vestkraft/[Etternavn]_[Fornavn]_[Nr]', next: 'Neste person', subs: vestkraft }
    ];
    D.schoolDays.slice(2).concat(SV.state.newDays || []).forEach(function (d) {
      list.push({ id: d.id, kind: 'skole', title: d.school, type: d.kind, place: d.town, date: d.date, tag: d.id.replace(/\W/g, '').toUpperCase(), tpl: '[Skole]/[Klasse]/[Kode]_[Nr]', next: 'Neste elev', day: d.id, subs: function () { return fromClasses(d.classes || []); } });
    });
    list.forEach(function (p) { if (S.tpl[p.id]) p.tpl = S.tpl[p.id]; });
    return list;
  }
  function P() { return SV.find(projects(), S.proj) || projects()[0]; }
  function subjects() { return P().subs(); }
  function daysTo(iso) { var d = SV.parse(iso); if (!d) return null; var t = new Date(); t.setHours(0, 0, 0, 0); d.setHours(0, 0, 0, 0); return Math.round((d - t) / 864e5); }
  function when(iso) { var n = daysTo(iso); return n === 0 ? 'I dag' : n === 1 ? 'I morgen' : n > 1 && n < 14 ? 'Om ' + n + ' dager' : n < 0 ? 'Var ' + SV.fdate(iso) : SV.fdate(iso, true); }

  // demobilder: Oskar Sæbø er allerede fotografert i omfotograferingen
  (function seed() {
    var id = 'FJT-4B-4871', base = 'FJT2026/4B/' + id + '_';
    S.shots[id] = [0, 1, 2, 3, 4, 5].map(function (i) { return { n: i + 1, i: i, f: base + String(i + 1).padStart(4, '0') + '.jpg', st: 'på PC + SSD' }; });
    S.picks[id] = 1; S.rej[id] = { 3: true }; S.queue = 5; S.cur = id; S.sel[id] = 1;
    S.log = [['09:14:52', 'Bilde 4 forkastet (uskarpt)'], ['09:14:40', 'Favoritt · bilde 2'], ['09:14:31', 'Nytt bilde · ' + base + '0006.jpg'], ['09:13:58', 'Valgt · Oskar Sæbø']];
  })();

  function fname(sub, n) {
    var p = sub.name.split(' '), fn = p[0], ln = p[p.length - 1];
    return P().tpl.replace('[Skole]', P().tag).replace('[Klasse]', sub.group).replace('[Kode]', sub.id).replace('[Etternavn]', ln).replace('[Fornavn]', fn).replace('[Nr]', String(n).padStart(4, '0')) + '.jpg';
  }
  function img(sub, i) {
    if (sub.kid === 'oskar') return 'img/kids/oskar-p' + (i % 6) + '.jpg';
    if (P().kind === 'skole') return 'img/kids/' + (sub.kid || (sub.group === '1A' ? 'nora' : 'emma')) + '-p' + (i % 4) + '.jpg';
    return SV.thumb(D.img.portrett);
  }
  function blocked(sub) { return sub.consent === 'Nei' || (P().kind === 'bedrift' && sub.consent !== 'Ja'); }
  function log(t) { var d = new Date(); S.log.unshift([String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ':' + String(d.getSeconds()).padStart(2, '0'), t]); S.log = S.log.slice(0, 9); }

  SV.route('/stasjon/:id', 'studio', function (params) {
    var pid = (params && params.id) || '';
    if (!SV.find(projects(), pid)) return chooser();
    if (S.proj !== pid) { if (S.proj) S.cur = null; S.proj = pid; S.cls = ''; }
    var all = subjects(), groups = all.map(function (x) { return x.group; }).filter(function (g, i, a) { return a.indexOf(g) === i; });
    var subs = P().kind === 'skole' && S.cls ? all.filter(function (x) { return x.group === S.cls; }) : all;
    var cur = S.cur && SV.find(all, S.cur), m = P(), shots = cur ? (S.shots[cur.id] || []) : [];
    var doneN = subs.filter(function (s) { return S.done[s.id]; }).length;
    var queue = '<div class="card st-q"><div class="card-b"><label class="search" style="max-width:none;margin-bottom:10px">' + ic('search') + '<input id="stSearch" placeholder="Søk etter navn" aria-label="Søk i listen" data-input="stFilter" autocomplete="off"></label>' + (P().kind === 'skole' && groups.length > 1 ? '<div class="filters" style="margin:0 0 10px;flex-wrap:wrap"><button class="fbtn' + (S.cls ? '' : ' on') + '" data-act="stCls" data-c="">Alle</button>' + groups.map(function (g) { return '<button class="fbtn' + (S.cls === g ? ' on' : '') + '" data-act="stCls" data-c="' + esc(g) + '">' + esc(g) + '</button>'; }).join('') + '</div>' : '') + '<p class="tiny muted" style="margin-bottom:8px">Klikk på navnet til den som sitter foran kamera. Klikk neste navn når du går videre, så blir forrige ferdig av seg selv.</p><div id="stList">' +
      subs.map(function (s) {
        var st = S.done[s.id] ? 'Ferdig' : S.absent[s.id] ? 'Fravær' : s.id === S.cur ? 'Pågår' : blocked(s) ? (s.consent === 'Nei' ? 'Skal ikke' : 'Mangler') : 'Venter';
        return '<button class="pp' + (blocked(s) ? ' flag' : '') + (s.id === S.cur ? ' on' : '') + '" data-act="stPick" data-id="' + s.id + '" data-q="' + esc((s.name + ' ' + s.id).toLowerCase()) + '">' + SV.avatar(s.name) + '<span><b>' + esc(s.name) + '</b><small>' + esc(s.group) + (s.signup ? ' · ' + s.signup : '') + ' · ' + esc(s.id) + '</small></span>' + SV.chip(st, st === 'Ferdig' ? 'ok' : st === 'Pågår' ? 'sand' : /Skal|Mangler/.test(st) ? 'bad' : 'mute') + '</button>';
      }).join('') + '</div></div></div>';
    var center;
    if (!cur) center = '<div class="card st-c"><div class="st-view st-empty">' + ic('users') + '<b>Klikk på et navn i listen</b><span>Bildene som tas etterpå får navn og kobles til riktig ' + (P().kind === 'skole' ? 'barn' : 'person') + ' til du klikker neste navn.</span></div></div>';
    else if (blocked(cur)) center = '<div class="card st-c"><div class="st-view st-block">' + ic('shield') + '<b>' + (cur.consent === 'Nei' ? 'Ikke fotografer ' : 'Samtykke mangler for ') + esc(cur.name) + '</b><span>' + (cur.consent === 'Nei' ? 'Foresatte har svart nei. Bilder som likevel tas, slettes ved opplasting.' : 'Be personen svare på samtykket på mobilen først. Lenke sendes på SMS.') + '</span><button class="btn btn-acc btn-s" data-act="stSkip">Hopp over</button></div></div>';
    else {
      // stort bilde: det du har valgt i rekka, ellers det siste (nye bilder vises med en gang)
      var k = S.sel[cur.id] == null ? shots.length - 1 : S.sel[cur.id], last = shots[k], rej = S.rej[cur.id] || {}, keep = shots.filter(function (s, j) { return !rej[j]; }).length;
      center = '<div class="card st-c"><div class="st-view' + (last && rej[k] ? ' st-rej' : '') + '">' + (last ? '<img src="' + img(cur, last.i) + '" alt="Bilde ' + (k + 1) + ' av ' + esc(cur.name) + '">' : '<div class="st-live">Klar · ta første bilde</div>') + '<span class="st-guide" aria-hidden="true"></span><span class="st-cap">' + esc(cur.name) + ' · ' + esc(cur.group) + (last ? ' · bilde ' + (k + 1) + ' av ' + shots.length : '') + '</span>' + (last && S.picks[cur.id] === k ? '<span class="st-fav">★ Favoritt</span>' : '') + (last && rej[k] ? '<span class="st-fav st-x">Forkastet</span>' : '') + (last ? '<span class="st-file">' + esc(last.f) + ' · ' + last.st + '</span>' : '') +
        (last ? '<button class="st-nav l" data-act="stNav" data-d="-1" aria-label="Forrige bilde"' + (k > 0 ? '' : ' hidden') + '>‹</button><button class="st-nav r" data-act="stNav" data-d="1" aria-label="Neste bilde"' + (k < shots.length - 1 ? '' : ' hidden') + '>›</button>' : '') + '</div>' +
        '<div class="card-b">' + (shots.length ? '<p class="small muted" style="margin-bottom:8px"><b style="color:var(--ink)">' + keep + '</b> bilder · ' + (S.picks[cur.id] != null ? '1 favoritt' : 'ingen favoritt ennå') + (shots.length > keep ? ' · ' + (shots.length - keep) + ' forkastet' : '') + '</p>' : '') + '<div class="st-strip">' + shots.map(function (s, j) { return '<button class="' + (j === k ? 'on' : '') + (S.picks[cur.id] === j ? ' fav' : '') + (rej[j] ? ' rej' : '') + '" data-act="stView" data-k="' + j + '" aria-label="Vis bilde ' + (j + 1) + '"><img src="' + img(cur, s.i) + '" alt=""><i>' + String(s.n).padStart(2, '0') + '</i></button>'; }).join('') + '</div>' +
        '<div class="row" style="margin-top:12px"><button class="btn btn-acc" data-act="stShoot">' + ic('cam') + 'Ta bilde <span class="kbd">Mellomrom</span></button><button class="btn btn-ghost btn-s" data-act="stFav"' + (last ? '' : ' disabled') + '>★ Favoritt <span class="kbd">F</span></button><button class="btn btn-ghost btn-s" data-act="stRej"' + (last ? '' : ' disabled') + '>✕ Forkast <span class="kbd">X</span></button><button class="btn btn-dark" data-act="stDone"' + (shots.length ? '' : ' disabled') + '>' + ic('check') + 'Ferdig, ' + m.next.toLowerCase() + ' <span class="kbd">Enter</span></button><button class="btn btn-ghost btn-s" data-act="stAbsent">Fravær</button></div>' +
        '<p class="hint">' + (P().kind === 'skole' ? '← → blar i bildene. Nye bilder vises stort med en gang. Fravær gir automatisk plass på omfotograferingen.' : '← → blar i bildene. Nye bilder vises stort med en gang. Galleriet sendes på e-post når bildene er lastet opp.') + '</p></div></div>';
    }
    var side = '<div class="stack"><div class="card"><div class="card-h"><h3>Utstyr</h3></div><div class="card-b small">' +
      [['cam', 'Kamera (Sony) · USB-C-kabel', 'Studiovest Stasjon · tilkoblet'], ['box', 'Kopi til SSD', 'Hver fil lagres to steder']].map(function (x) { return '<div class="li" style="padding:8px 0">' + ic(x[0]) + '<span class="li-t"><b>' + x[1] + '</b><small>' + x[2] + '</small></span><i class="ndot n-ok"></i></div>'; }).join('') + '</div></div>' +
      '<div class="card"><div class="card-h"><h3>Opplasting</h3><span class="small muted">etter fotograferingen</span></div><div class="card-b"><p style="font-size:22px;font-weight:800;letter-spacing:-.02em">' + (S.syncing ? 'Laster opp …' : S.queue ? S.queue + ' bilder · ' + (S.queue * 52 / 1000).toFixed(1).replace('.', ',') + ' GB' : 'Ingenting venter') + '</p><p class="small muted" style="margin:4px 0 12px">' + (S.queue ? 'Ligger trygt på PC-en og SSD-en. Lastes opp av seg selv når PC-en er på wifi «Studiovest» hjemme, eller trykk under.' : 'Bildene vises på stasjonen rett fra PC-en, så fotograferingen trenger ikke nett.') + '</p><button class="btn btn-dark btn-s" data-act="stSync"' + (S.queue && !S.syncing ? '' : ' disabled') + '>' + ic('upload') + 'Last opp nå</button></div></div>' +
      '<div class="card"><div class="card-h"><h3>Filnavn</h3></div><div class="card-b"><input class="inp" id="tplIn" value="' + esc(m.tpl) + '" data-input="stTpl" aria-label="Mal for filnavn" style="font-family:ui-monospace,Menlo,monospace;font-size:13px"><p class="tiny muted" style="margin-top:6px">Eksempel: <b id="tplEx">' + esc(cur ? fname(cur, 1) : fname(subs[0], 1)) + '</b></p><p class="hint">Personens ID lagres også i bildets metadata, så bildet finner riktig person selv om filen får nytt navn.</p></div></div>' +
      '<div class="card"><div class="card-h"><h3>Logg</h3><span class="small muted">' + doneN + ' av ' + subs.length + ' ferdig</span></div><div class="card-b"><ul class="feed small">' + (S.log.length ? S.log.map(function (l) { return '<li><span>' + l[1] + '</span><time>' + l[0] + '</time></li>'; }).join('') : '<li><span class="muted">Ingen hendelser ennå</span></li>') + '</ul></div></div></div>';
    return '<p class="small" style="margin-bottom:14px"><a href="#/stasjon" class="muted">← Alle fotodager</a></p>' + SV.head({ eyebrow: 'Stasjon 1 · ' + esc(when(m.date)) + ' · ' + esc(m.type), a: esc(m.title),  lead: 'Kamera i kabel til PC. Klikk på navnet, ta bildene, klikk neste navn. Navn, sortering, opplasting og samtykkekontroll skjer av seg selv.',
        actions: '<a class="btn btn-ghost btn-s" href="#/stasjon">' + ic('cal') + 'Bytt fotodag</a>' }) +
      '<div class="st-grid">' + queue + center + side + '</div>' +
      '<details class="card sec"><summary class="card-h" style="cursor:pointer"><h3>Slik settes stasjonen opp</h3><span class="small muted">utstyr og programmer</span></summary><div class="card-b research"><ul class="new">' +
        '<li><b>Kabel:</b> Tether Tools TetherPro Optima 10G, USB-C rett til vinkel (10 Gbit/s). Vinkelen går inn i kameraet, så kontakten ikke belastes. Velg lengde etter rommet; 4,6 m er vanlig for skolefoto. Bruk kabelsikring og batterieliminator på lange dager.</li>' +
        '<li><b>PC:</b> Bærbar med Studiovest Stasjon, vårt eget program. Det tar imot bildene fra kamera, gir dem navn etter personen som er valgt, legger personens ID i metadata (XMP), tar kopi til ekstern SSD og laster opp. Virker uten nett og laster opp når nettet er tilbake.</li>' +
        '<li><b>Kamera:</b> direkte via kabelen med libgphoto2 (åpen kildekode), eller via kameraprodusentens gratis tether-program som lagrer i en mappe stasjonen følger. Støtte for direkte styring og live view kan bygges med Sony Camera Remote SDK.</li>' +
        '<li><b>Liste:</b> klikk på navnet til den som står foran kamera. Klikk neste navn når du går videre, så blir forrige ferdig. Lang liste: skriv noen bokstaver i søket og trykk Enter. Ingen QR-kort eller skanner.</li>' +
        '<li><b>Uten nett på stedet:</b> bildene vises stort og i galleri rett fra PC-en mens du fotograferer, så det går like fort uansett dekning. Alt ligger på PC-en og SSD-en til dere er hjemme. Der starter opplastingen av seg selv på kjent wifi (eller med «Last opp nå»), JPG først og RAW etterpå. Forkastede bilder lastes ikke opp.</li>' +
        '<li><b>Kontroll:</b> klikk på det store bildet for 100 % og sjekk skarpheten i øynene. F = favoritt, X = forkast. Merkingen følger med til Lightroom og Capture One.</li>' +
        '<li><b>Samtykke:</b> klasseliste og samtykker hentes fra portalen før dagen. Barn med «nei» gir rød stopp, og bilder som likevel tas legges i karantene og lastes ikke opp.</li>' +
        '<li><b>Flere stasjoner:</b> én PC per stasjon. Portalen ser alle stasjonene live.</li></ul></div></details>';
  }, { title: 'Fotostasjon' });

  // Fotostasjon i menyen: velg fotodag først
  function chooser() {
    var list = projects().map(function (p) { return { p: p, n: daysTo(p.date) }; }).sort(function (a, b) { var x = a.n < 0 ? 1e4 - a.n : a.n, y = b.n < 0 ? 1e4 - b.n : b.n; return x - y; });
    var cards = list.map(function (o) {
      var p = o.p, subs = p.subs(), miss = subs.filter(function (x) { return x.consent !== 'Ja'; }).length, taken = subs.filter(function (x) { return S.done[x.id] || (S.shots[x.id] || []).length; }).length, active = taken > 0;
      var past = o.n < 0;
      return '<div class="card pad" style="display:flex;flex-direction:column;gap:12px' + (active ? ';box-shadow:inset 0 0 0 2px var(--sand)' : '') + (past ? ';opacity:.6' : '') + '"><div class="row between" style="margin:0"><span class="chip chip-' + (o.n === 0 ? 'sand' : past ? 'mute' : 'ok') + '">' + esc(when(p.date)) + '</span>' + (active ? '<span class="tiny muted">Pågår</span>' : '') + '</div>' +
        '<div><h3 class="h3">' + esc(p.title) + '</h3><p class="small muted">' + esc(p.type) + ' · ' + esc(p.place) + '</p></div>' +
        (subs.length ? '<dl class="kv small"><dt>' + (p.kind === 'skole' ? 'Barn' : 'Personer') + '</dt><dd>' + subs.length + '</dd><dt>Samtykke ikke ja</dt><dd>' + miss + '</dd><dt>Fotografert</dt><dd>' + taken + ' av ' + subs.length + '</dd></dl>' : '<p class="small muted">Ingen ' + (p.kind === 'skole' ? 'klasseliste' : 'deltakerliste') + ' ennå.</p>') +
        '<div style="margin-top:auto">' + (subs.length ? '<a class="btn ' + (active || o.n === 0 ? 'btn-acc' : 'btn-dark') + ' btn-s" href="#/stasjon/' + p.id + '">' + ic('cam') + (active ? 'Fortsett' : 'Start stasjonen') + '</a>' : (p.day ? '<a class="btn btn-ghost btn-s" href="#/skole/' + p.day + '">Importer liste</a>' : '')) + '</div></div>';
    }).join('');
    return SV.head({ eyebrow: 'Stasjon 1 · Drift', a: 'Fotostasjon', lead: 'Velg fotodagen du skal fotografere. Liste, samtykker og filnavn følger prosjektet. På stasjons-PC-en lastes alt ned før dagen, så det virker uten nett.' }) +
      '<div class="g3">' + cards + '</div>';
  }
  SV.route('/stasjon', 'studio', chooser, { title: 'Fotostasjon' });

  function rerender() { var y = window.scrollY; SV.render(); window.scrollTo(0, y); }
  SV.on('stCls', function (el) { S.cls = el.getAttribute('data-c'); rerender(); });
  SV.on('stPick', function (el) { start(el.getAttribute('data-id')); });
  function start(id) {
    var sub = SV.find(subjects(), id); if (!sub) { SV.toast('Fant ikke personen', 'warn'); return; }
    var prev = S.cur && S.cur !== id && SV.find(subjects(), S.cur);
    if (prev && (S.shots[prev.id] || []).length && !S.done[prev.id]) { S.done[prev.id] = true; log('Ferdig · ' + esc(prev.name) + ' (' + S.shots[prev.id].length + ' bilder)'); }
    S.cur = id; log('Valgt · ' + esc(sub.name)); if (blocked(sub)) log('<b>Stopp:</b> ' + (sub.consent === 'Nei' ? 'ikke samtykke' : 'samtykke mangler')); rerender();
  }
  SV.on('stFilter', function (el) { var q = el.value.trim().toLowerCase(); document.querySelectorAll('#stList .pp').forEach(function (b) { b.hidden = q && b.getAttribute('data-q').indexOf(q) < 0; }); });
  document.addEventListener('keydown', function (e) {
    if (location.hash.indexOf('#/stasjon/') !== 0) return;
    var t = e.target;
    if (t && t.id === 'stSearch' && e.key === 'Enter') { var v = t.value.trim(), hit = v && subjects().filter(function (s) { return s.name.toLowerCase().indexOf(v.toLowerCase()) > -1; })[0]; if (hit) start(hit.id); else SV.toast('Fant ingen med «' + v + '»', 'warn'); e.preventDefault(); return; }
    if (t && /INPUT|TEXTAREA|SELECT/.test(t.tagName)) return;
    if (e.key === ' ' && S.cur) { e.preventDefault(); shoot(); }
    if (e.key === 'Enter' && S.cur) { e.preventDefault(); done(); }
    if (e.key === 'ArrowLeft' && S.cur) { e.preventDefault(); nav(-1); }
    if (e.key === 'ArrowRight' && S.cur) { e.preventDefault(); nav(1); }
    if ((e.key === 'f' || e.key === 'F') && S.cur) fav();
    if ((e.key === 'x' || e.key === 'X') && S.cur) rej();
  });
  function shoot() {
    var sub = SV.find(subjects(), S.cur); if (!sub) return;
    if (blocked(sub)) { SV.toast('Denne personen skal ikke fotograferes', 'warn'); return; }
    var list = S.shots[sub.id] = S.shots[sub.id] || [], n = list.length + 1, ph = { n: n, i: n - 1, f: fname(sub, n), st: 'på PC + SSD' };
    list.push(ph); S.queue++; S.sel[sub.id] = null; log('Nytt bilde · ' + esc(ph.f)); rerender();
  }
  SV.on('stShoot', shoot);
  function done() {
    var subs = subjects(), sub = SV.find(subs, S.cur); if (!sub || !(S.shots[sub.id] || []).length) return;
    S.done[sub.id] = true; log(P().kind === 'skole' ? 'Ferdig · ' + esc(sub.name) + ' lagt i galleriet' : 'Ferdig · galleri sendt til ' + esc(sub.email));
    var next = subs.filter(function (s) { return !S.done[s.id] && !S.absent[s.id] && !blocked(s); })[0];
    S.cur = next ? next.id : null; rerender();
    SV.toast(P().kind === 'skole' ? sub.name + ' er ferdig · ' + (next ? 'neste: ' + next.name : 'alle er tatt') : 'Galleri sendt til ' + sub.name + ' · ' + (next ? 'neste: ' + next.name : 'alle er tatt'));
  }
  SV.on('stDone', done);
  SV.on('stAbsent', function () { var sub = SV.find(subjects(), S.cur); S.absent[sub.id] = true; log('Fravær · ' + esc(sub.name) + ' får plass på omfotografering'); S.cur = null; rerender(); });
  SV.on('stSkip', function () { S.cur = null; rerender(); });
  function viewed() { var l = S.shots[S.cur] || []; return S.sel[S.cur] == null ? l.length - 1 : S.sel[S.cur]; }
  function nav(d) { var l = S.shots[S.cur] || []; if (!l.length) return; var k = Math.max(0, Math.min(l.length - 1, viewed() + d)); S.sel[S.cur] = k === l.length - 1 ? null : k; rerender(); }
  function fav() { var k = viewed(); if (k < 0) return; S.picks[S.cur] = S.picks[S.cur] === k ? null : k; if (S.rej[S.cur]) S.rej[S.cur][k] = false; rerender(); }
  function rej() { var k = viewed(); if (k < 0) return; var r = S.rej[S.cur] = S.rej[S.cur] || {}; r[k] = !r[k]; if (r[k] && S.picks[S.cur] === k) S.picks[S.cur] = null; S.queue += r[k] ? -1 : 1; rerender(); }
  SV.on('stView', function (el) { var l = S.shots[S.cur] || [], k = +el.getAttribute('data-k'); S.sel[S.cur] = k === l.length - 1 ? null : k; rerender(); });
  SV.on('stNav', function (el) { nav(+el.getAttribute('data-d')); });
  SV.on('stFav', fav);
  SV.on('stRej', rej);
  SV.on('stSync', function () {
    S.syncing = true; log('Opplasting startet · ' + S.queue + ' bilder'); rerender();
    setTimeout(function () { var n = S.queue; S.queue = 0; S.syncing = false; Object.keys(S.shots).forEach(function (id) { S.shots[id].forEach(function (p, j) { if (!(S.rej[id] || {})[j]) p.st = 'lastet opp'; }); }); log('Alt lastet opp · ' + n + ' bilder'); if (location.hash.indexOf('#/stasjon/') === 0) rerender(); SV.toast(n + ' bilder lastet opp til portalen'); }, 1600);
  });
  SV.on('stTpl', function (el) { S.tpl[P().id] = el.value; var subs = subjects(), cur = (S.cur && SV.find(subs, S.cur)) || subs[0]; document.getElementById('tplEx').textContent = fname(cur, 1); });

  // ---------- Bedrift: portrettdag ----------
  SV.route('/bedrift/portrettdag', 'studio', function () {
    var subs = vestkraft();
    var sent = subs.filter(function (s, i) { return i < 5; });
    return '<p class="small" style="margin-bottom:14px"><a href="#/bedrift" class="muted">← Bedrift</a></p>' + SV.head({ eyebrow: SV.dot('bedrift') + 'Vestkraft Energi AS · ' + SV.fdate(D.W(6), true), a: 'Portrettdag', lead: 'Ansatte melder seg på en tid selv, blir tatt i kø med tethering, og får galleriet sitt på e-post med en gang. De velger selv hvilke bilder som skal retusjeres.', actions: '<a class="btn btn-acc btn-s" href="#/stasjon/vke-portrett">' + ic('cam') + 'Åpne fotostasjonen</a>' }) +
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
