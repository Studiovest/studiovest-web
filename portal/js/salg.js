/* Salg: kunde-CRM for alle felt (meglere, bedrifter, skoler, markedsføring).
 *
 * AGENT-KONTRAKT (stabil, versjon 1) – en senere e-post-/salgsagent bruker bare disse funksjonene:
 *   SV.sales.match({ email, domain, orgnr, name, phone })  → firma eller null (e-post på kontaktperson > domene > orgnr > telefon > navn)
 *   SV.sales.upsert({ name, seg, town, orgnr, web, domains[], people[{name, role, email, phone}], status, value, source, tags[] })
 *        → finner eksisterende (match) og fletter inn nye felt, ellers oppretter nytt. Returnerer firmaet.
 *   SV.sales.log(id, { ch, dir, out, text, d, by, src, ref })  → kontakt i historikken.
 *        ch: epost|telefon|mote|sms|linkedin|besok   dir: ut|inn   out: ingen|positiv|noytral|negativ|mote|tilbud
 *        ref: unik nøkkel (f.eks. Message-ID). Samme ref logges aldri to ganger, så agenten kan kjøre om igjen trygt.
 *        Status oppdateres automatisk ut fra utfallet (se autoStatus), og agentens endringer merkes «Agent».
 *   SV.sales.setStatus(id, status, { by, why })   status: ny|kontaktet|dialog|mote|tilbud|kunde|senere|nei
 *   SV.sales.setNext(id, { d: 'YYYY-MM-DD', what })  eller null for å fjerne neste steg
 *   SV.sales.due()  → [{ c, why, days }]  alt som bør følges opp nå (forfalt neste steg eller ingen svar etter N dager)
 * I den ekte portalen blir dette et REST-API med samme felt: GET/POST /api/salg, POST /api/salg/:id/logg osv.
 */
(function () {
  'use strict';
  var SV = window.SV, D = SV.data, esc = SV.esc, ic = SV.icon;

  var ST = [['ny', 'Ikke kontaktet', 'mute'], ['kontaktet', 'Kontaktet', 'sand'], ['dialog', 'I dialog', 'brown'], ['mote', 'Møte avtalt', 'sage'], ['tilbud', 'Tilbud sendt', 'ink'], ['kunde', 'Kunde', 'ok'], ['senere', 'Senere', 'mute'], ['nei', 'Ikke interessert', 'bad']];
  var LADDER = ['ny', 'kontaktet', 'dialog', 'mote', 'tilbud', 'kunde'];
  var OPEN = ['kontaktet', 'dialog', 'mote', 'tilbud'];
  var CH = [['epost', 'E-post', 'mail'], ['telefon', 'Telefon', 'chat'], ['mote', 'Møte', 'users'], ['sms', 'SMS', 'chat'], ['linkedin', 'LinkedIn', 'link'], ['besok', 'Besøk', 'pin']];
  var OUT = [['ingen', 'Ingen svar', 'mute'], ['positiv', 'Positiv', 'ok'], ['noytral', 'Nøytral', 'ink'], ['negativ', 'Negativ', 'bad'], ['mote', 'Møte booket', 'sage'], ['tilbud', 'Ber om tilbud', 'sand']];
  var SEG = [['bolig', 'Bolig'], ['bedrift', 'Bedrift'], ['skole', 'Skolefoto'], ['mark', 'Markedsføring']];
  var HEAT = [['', '–'], ['kald', 'Kald'], ['lunken', 'Lunken'], ['varm', 'Varm']];
  var SOURCES = ['Kald liste', 'Anbefaling', 'Nettsiden', 'Via Kviteberg', 'Messe / nettverk', 'Eksisterende kunde', 'Annet'];
  var FREE = ['gmail.com', 'hotmail.com', 'outlook.com', 'live.no', 'online.no', 'icloud.com', 'yahoo.com', 'epost.example'];
  function lab(arr, k) { var x = arr.filter(function (a) { return a[0] === k; })[0]; return x ? x[1] : k; }
  function stChip(s) { var x = ST.filter(function (a) { return a[0] === s; })[0] || ST[0]; return SV.chip(x[1], x[2]); }
  function outChip(o) { var x = OUT.filter(function (a) { return a[0] === o; })[0]; return x ? SV.chip(x[1], x[2]) : ''; }
  function chIc(c) { var x = CH.filter(function (a) { return a[0] === c; })[0]; return ic(x ? x[2] : 'chat'); }
  function rank(s) { var i = LADDER.indexOf(s); return i < 0 ? 0 : i; }
  function pad(n) { return String(n).padStart(2, '0'); }
  function now() { var d = new Date(); return D.iso(D.today) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function today() { return D.iso(D.today); }
  function plus(n) { return D.D(n); }
  function at(n, hm) { return D.D(-n) + 'T' + hm; }
  function ago(iso) { var n = -SV.diff(iso.slice(0, 10)); return n <= 0 ? 'i dag' : n === 1 ? 'i går' : n < 14 ? n + ' dager siden' : n < 60 ? Math.round(n / 7) + ' uker siden' : Math.round(n / 30) + ' mnd siden'; }
  function dueTxt(d) { var n = SV.diff(d); return n < 0 ? 'Forfalt ' + (-n) + ' d' : n === 0 ? 'I dag' : n === 1 ? 'I morgen' : SV.fdate(d); }
  function low(s) { return String(s || '').trim().toLowerCase(); }
  function norm(s) { return low(s).replace(/\b(as|asa|sa|da|ans)\b/g, '').replace(/[^a-zæøå0-9]/g, ''); }
  function domOf(e) { var d = low(e).split('@')[1] || ''; return FREE.indexOf(d) > -1 ? '' : d; }

  // ---------- data ----------
  function seed() {
    var cos = [], seq = 0;
    function add(o) { o.id = 'k' + (++seq); o.acts = (o.acts || []).map(function (a, i) { return Object.assign({ id: o.id + 'a' + i, by: 'Aleksander', src: 'manuell', type: 'kontakt' }, a); }); o.tags = o.tags || []; o.people = o.people || []; o.domains = o.domains || o.people.map(function (p) { return domOf(p.email); }).filter(function (d, i, a) { return d && a.indexOf(d) === i; }); o.created = o.created || D.D(-60); o.note = o.note || ''; o.heat = o.heat || ''; cos.push(o); return o; }
    D.offices.forEach(function (o, i) {
      var dom = o.id + '.example';
      add({ name: o.name, seg: 'bolig', town: o.town, status: 'kunde', value: o.ytd, source: 'Eksisterende kunde', ref: { office: o.id }, heat: 'varm', won: D.D(-300 + i * 40),
        people: o.brokers.map(function (b, k) { return { name: b, role: k ? 'Megler' : 'Fagansvarlig', email: b.toLowerCase().split(' ')[0].replace(/ø/g, 'o').replace(/æ/g, 'ae').replace(/å/g, 'a') + '@' + (o.id === 'fjm' ? 'fjordmegling.example' : o.id === 'kmh' ? 'kystmegleren.example' : dom), phone: '9' + (40 + i * 7 + k) + ' ' + (10 + k * 13) + ' ' + (200 + i * 31 + k) }; }),
        acts: [{ d: at(4 + i * 3, '10:15'), ch: 'telefon', dir: 'ut', out: 'positiv', text: 'Gikk gjennom høstens oppdrag. Fornøyd med leveringstid.' }] });
    });
    D.companies.forEach(function (c, i) {
      add({ name: c.name, seg: 'bedrift', town: c.town, status: 'kunde', value: c.ytd, source: c.source === 'Direkte' ? 'Anbefaling' : c.source, ref: { company: c.id }, heat: 'varm', won: D.D(-200 + i * 25),
        tags: c.bank ? ['Timebank ' + c.bank.plan] : [], people: [{ name: c.contact, role: c.title, email: c.email, phone: '4' + (11 + i) + ' 2' + i + ' 6' + (10 + i * 3) }],
        acts: [{ d: at(2 + i * 4, '13:40'), ch: 'epost', dir: 'inn', out: 'positiv', text: 'Takk for sist, ønsker nytt innhold til våren.' }] });
    });
    D.schoolDays.forEach(function (s) {
      add({ name: s.school, seg: 'skole', town: s.town, status: 'kunde', value: 18000, source: 'Eksisterende kunde', ref: { school: s.id }, won: D.D(-150), people: [{ name: s.contact.replace(/^(Rektor|Styrer) /, ''), role: (s.contact.match(/^(Rektor|Styrer)/) || ['Kontakt'])[0], email: '', phone: '' }] });
    });
    var P = [
      { name: 'Kvinnherad Eiendom', seg: 'bolig', town: 'Husnes', status: 'kontaktet', value: 160000, source: 'Kald liste', heat: 'lunken', people: [{ name: 'Ragnhild Sandvik', role: 'Daglig leder', email: 'ragnhild@kvinnheradeiendom.example', phone: '934 12 880' }],
        acts: [{ d: at(9, '09:12'), ch: 'epost', dir: 'ut', text: 'Sendte presentasjon og prisliste for boligfoto, med eksempler fra Husnes.' }] },
      { name: 'Bømlo Bolig & Næring', seg: 'bolig', town: 'Svortland', status: 'dialog', value: 120000, source: 'Anbefaling', heat: 'varm', people: [{ name: 'Torstein Lien', role: 'Megler', email: 'torstein@bomlobolig.example', phone: '415 66 120' }],
        acts: [{ d: at(12, '14:00'), ch: 'telefon', dir: 'ut', out: 'ingen', text: 'Ringte, ikke svar.' }, { d: at(10, '08:40'), ch: 'telefon', dir: 'ut', out: 'positiv', text: 'Interessert. Bruker en fotograf fra Bergen i dag, misfornøyd med leveringstid.' }, { d: at(3, '16:05'), ch: 'epost', dir: 'inn', out: 'positiv', text: 'Vil prøve oss på neste oppdrag i Bremnes.' }],
        next: { d: plus(1), what: 'Følg opp første oppdrag i Bremnes' } },
      { name: 'Haugaland Megling', seg: 'bolig', town: 'Haugesund', status: 'tilbud', value: 240000, source: 'Messe / nettverk', heat: 'lunken', people: [{ name: 'Ingrid Hovland', role: 'Kontorleder', email: 'ingrid@haugalandmegling.example', phone: '988 20 145' }],
        acts: [{ d: at(21, '11:00'), ch: 'mote', dir: 'ut', out: 'tilbud', text: 'Møte på kontoret. Ønsker kontoravtale med fast pris.' }, { d: at(14, '09:30'), ch: 'epost', dir: 'ut', text: 'Sendte tilbud på kontoravtale, 10 % rabatt over 8 oppdrag i måneden.' }],
        next: { d: plus(-2), what: 'Ring Ingrid om tilbudet' } },
      { name: 'Odda Eigedom', seg: 'bolig', town: 'Odda', status: 'ny', value: 80000, source: 'Kald liste', people: [{ name: 'Knut Bleie', role: 'Megler', email: 'knut@oddaeigedom.example', phone: '' }] },
      { name: 'Stord Eiendomsmegling', seg: 'bolig', town: 'Leirvik', status: 'nei', value: 0, source: 'Kald liste', people: [{ name: 'Henrik Vold', role: 'Daglig leder', email: 'henrik@stordem.example', phone: '' }],
        acts: [{ d: at(40, '10:00'), ch: 'epost', dir: 'ut', text: 'Presentasjon og prisliste.' }, { d: at(37, '12:20'), ch: 'epost', dir: 'inn', out: 'negativ', text: 'Har avtale med eget foto-team i kjeden. Ikke aktuelt nå.' }], next: { d: plus(140), what: 'Sjekk om kjedeavtalen er endret' } },
      { name: 'Sunnhordland Laks AS', seg: 'bedrift', town: 'Uskedalen', status: 'mote', value: 95000, source: 'Anbefaling', heat: 'varm', tags: ['Rekrutteringsfilm'], people: [{ name: 'Elin Rørvik', role: 'HR-leder', email: 'elin@sunnlaks.example', phone: '907 33 512' }, { name: 'Pål Hus', role: 'Daglig leder', email: 'pal@sunnlaks.example', phone: '' }],
        acts: [{ d: at(8, '10:30'), ch: 'telefon', dir: 'ut', out: 'mote', text: 'Trenger bilder og film til rekruttering før sommersesongen. Møte avtalt.' }], next: { d: plus(3), what: 'Møte på anlegget kl. 10' } },
      { name: 'Fjordbanken Kvinnherad', seg: 'bedrift', town: 'Rosendal', status: 'kontaktet', value: 60000, source: 'Kald liste', people: [{ name: 'Mona Skaar', role: 'Markedssjef', email: 'mona@fjordbanken.example', phone: '' }],
        acts: [{ d: at(5, '13:10'), ch: 'linkedin', dir: 'ut', text: 'Melding om portretter av rådgiverne og timebank.' }] },
      { name: 'Ølve Marina', seg: 'bedrift', town: 'Ølve', status: 'dialog', value: 30000, source: 'Nettsiden', heat: 'lunken', people: [{ name: 'Rune Ølve', role: 'Eier', email: 'rune@olvemarina.example', phone: '470 11 228' }],
        acts: [{ d: at(6, '19:02'), ch: 'epost', dir: 'inn', out: 'noytral', text: 'Spør hva drone og bilder til ny nettside koster. Vil vente til våren.' }], next: { d: plus(6), what: 'Send forslag med pakkepris' } },
      { name: 'Husnes Bygg & Anlegg', seg: 'bedrift', town: 'Husnes', status: 'ny', value: 45000, source: 'Kald liste', people: [{ name: '', role: '', email: 'post@husnesbygg.example', phone: '53 47 20 00' }] },
      { name: 'Halsnøy Kloster Kafé', seg: 'bedrift', town: 'Halsnøy', status: 'senere', value: 12000, source: 'Messe / nettverk', people: [{ name: 'Siv Tofte', role: 'Daglig leder', email: 'siv@klosterkafe.example', phone: '' }],
        acts: [{ d: at(30, '12:00'), ch: 'besok', dir: 'ut', out: 'noytral', text: 'Stengt for sesongen. Ta kontakt i mars før påske.' }], next: { d: plus(105), what: 'Ta kontakt før påskesesongen' } },
      { name: 'Vestland Havbruk', seg: 'bedrift', town: 'Bømlo', status: 'ny', value: 70000, source: 'Kald liste', people: [] },
      { name: 'Uskedal skule', seg: 'skole', town: 'Uskedalen', status: 'kontaktet', value: 16000, source: 'Kald liste', people: [{ name: 'Lars Bakke', role: 'Rektor', email: 'lars.bakke@uskedal.example', phone: '' }],
        acts: [{ d: at(11, '08:20'), ch: 'epost', dir: 'ut', text: 'Tilbud om skolefoto med nettbestilling og Vipps, ingen kostnad for skolen.' }] },
      { name: 'Husnes ungdomsskule', seg: 'skole', town: 'Husnes', status: 'tilbud', value: 22000, source: 'Anbefaling', heat: 'varm', people: [{ name: 'Gro Haldorsen', role: 'Rektor', email: 'gro@husnesus.example', phone: '' }],
        acts: [{ d: at(16, '10:00'), ch: 'mote', dir: 'ut', out: 'tilbud', text: 'Møte med rektor og FAU.' }, { d: at(9, '15:00'), ch: 'epost', dir: 'ut', text: 'Sendte tilbud og databehandleravtale.' }], next: { d: plus(0), what: 'Spør om FAU har behandlet tilbudet' } },
      { name: 'Gjermundshamn barnehage', seg: 'skole', town: 'Gjermundshamn', status: 'ny', value: 9000, source: 'Kald liste', people: [] },
      { name: 'Kvinnherad Næringsråd', seg: 'mark', town: 'Husnes', status: 'dialog', value: 50000, source: 'Messe / nettverk', heat: 'lunken', people: [{ name: 'Hanne Ask', role: 'Prosjektleder', email: 'hanne@kvinnheradnr.example', phone: '' }],
        acts: [{ d: at(18, '09:00'), ch: 'mote', dir: 'ut', out: 'positiv', text: 'Vil ha innhold til kampanjen «Bu i Kvinnherad».' }, { d: at(4, '11:30'), ch: 'epost', dir: 'ut', text: 'Sendte idéskisse og budsjett.' }] },
      { name: 'Opstad Gartneri', seg: 'mark', town: 'Valen', status: 'ny', value: 15000, source: 'Kald liste', people: [{ name: '', role: '', email: 'post@opstad.example', phone: '' }] }
    ];
    P.forEach(function (p) { if (p.status === 'nei' || p.status === 'senere') p.lost = true; add(p); });
    return { cos: cos, seq: seq + 1, cfg: { noReply: 7 }, ui: { view: 'liste', seg: '', st: '', q: '', sort: 'neste', due: false } };
  }
  function S() { var s = SV.state.sales; if (!s || !s.cos) s = SV.state.sales = seed(); return s; }
  function cos() { return S().cos; }
  function get(id) { return SV.find(cos(), id); }
  function contacts(c) { return c.acts.filter(function (a) { return a.type === 'kontakt'; }).sort(function (a, b) { return a.d < b.d ? -1 : 1; }); }
  function lastC(c) { var k = contacts(c); return k[k.length - 1] || null; }
  // venter på svar: siste kontakt var fra meg, uten utfall (eller «ingen svar»)
  function waiting(c) { var l = lastC(c); if (!l || l.dir !== 'ut' || (l.out && l.out !== 'ingen') || OPEN.indexOf(c.status) < 0) return 0; return Math.max(0, -SV.diff(l.d.slice(0, 10))); }
  function dueWhy(c) {
    if (c.next && c.next.d && SV.diff(c.next.d) <= 0) return { why: c.next.what || 'Neste steg', days: -SV.diff(c.next.d), kind: 'next' };
    var w = waiting(c); if (w >= S().cfg.noReply && !(c.next && SV.diff(c.next.d) > 0)) return { why: 'Ingen svar på ' + w + ' dager', days: w, kind: 'wait' };
    return null;
  }
  function due() { return cos().map(function (c) { var d = dueWhy(c); return d ? { c: c, why: d.why, days: d.days, kind: d.kind } : null; }).filter(Boolean).sort(function (a, b) { return b.days - a.days; }); }

  // ---------- endringer (samme vei for manuell bruk og agent) ----------
  function setStatus(c, to, o) {
    o = o || {}; if (!c || c.status === to) return;
    var from = c.status; c.status = to;
    if (to === 'kunde' && !c.won) c.won = today();
    if (to === 'nei' && c.next && SV.diff(c.next.d) < 60) c.next = null;
    if (to === 'senere' && !c.next) c.next = { d: plus(90), what: 'Ta kontakt igjen' };
    c.acts.push({ id: 'a' + (++S().seq), type: 'status', d: now(), from: from, to: to, by: o.by || 'Aleksander', src: o.src || 'manuell', text: o.why || '' });
  }
  function autoStatus(c, a) {
    var s = c.status, to = null;
    if (s === 'ny' && a.dir === 'ut') to = 'kontaktet';
    if (a.dir === 'inn' && (s === 'ny' || s === 'kontaktet' || s === 'senere') && a.out !== 'negativ') to = 'dialog';
    if ((a.out === 'positiv' || a.out === 'noytral' || a.out === 'tilbud') && rank(s) < rank('dialog') && s !== 'kunde') to = 'dialog';
    if (a.out === 'mote' && rank(s) < rank('mote')) to = 'mote';
    if (a.out === 'negativ' && s !== 'kunde') to = 'nei';
    if (to && to !== s) setStatus(c, to, { by: a.by, src: a.src, why: 'Automatisk etter ' + (lab(OUT, a.out) || (a.dir === 'inn' ? 'svar' : 'kontakt')).toLowerCase() });
  }
  function log(c, a) {
    if (!c) return null;
    if (a.ref && c.acts.some(function (x) { return x.ref === a.ref; })) return null;
    a = Object.assign({ id: 'a' + (++S().seq), type: 'kontakt', d: now(), by: 'Aleksander', src: 'manuell', dir: 'ut', ch: 'epost' }, a);
    c.acts.push(a); autoStatus(c, a);
    if (a.out === 'tilbud' && !c.next) c.next = { d: plus(2), what: 'Send tilbud' };
    if (a.out === 'mote' && !c.next) c.next = { d: plus(7), what: 'Møte' };
    return a;
  }
  function match(q) {
    q = q || {}; var list = cos(), e = low(q.email), dm = low(q.domain) || domOf(e), hit;
    if (e) hit = list.filter(function (c) { return c.people.some(function (p) { return low(p.email) === e; }); })[0];
    if (!hit && dm) hit = list.filter(function (c) { return c.domains.indexOf(dm) > -1 || low(c.web).indexOf(dm) > -1; })[0];
    if (!hit && q.orgnr) hit = list.filter(function (c) { return String(c.orgnr || '').replace(/\D/g, '') === String(q.orgnr).replace(/\D/g, ''); })[0];
    if (!hit && q.phone) { var ph = String(q.phone).replace(/\D/g, '').slice(-8); hit = list.filter(function (c) { return c.people.some(function (p) { return p.phone && p.phone.replace(/\D/g, '').slice(-8) === ph; }); })[0]; }
    if (!hit && q.name) hit = list.filter(function (c) { return norm(c.name) === norm(q.name); })[0];
    return hit || null;
  }
  function upsert(o) {
    var c = match({ email: (o.people || [])[0] && o.people[0].email, domain: (o.domains || [])[0], orgnr: o.orgnr, name: o.name });
    if (!c) {
      c = { id: 'k' + (++S().seq), name: o.name || ((o.people || [])[0] || {}).email || 'Ny kunde', seg: o.seg || 'bedrift', town: o.town || '', orgnr: o.orgnr || '', web: o.web || '', status: o.status || 'ny', value: +o.value || 0, source: o.source || '', heat: o.heat || '', tags: o.tags || [], people: [], domains: [], acts: [], note: o.note || '', created: today(), next: o.next || null };
      cos().unshift(c);
    } else ['name', 'seg', 'town', 'orgnr', 'web', 'source'].forEach(function (k) { if (o[k] && !c[k]) c[k] = o[k]; });
    (o.people || []).forEach(function (p) { if (!p.name && !p.email && !p.phone) return; var ex = c.people.filter(function (x) { return (p.email && low(x.email) === low(p.email)) || (p.name && low(x.name) === low(p.name)); })[0]; if (ex) Object.keys(p).forEach(function (k) { if (p[k] && !ex[k]) ex[k] = p[k]; }); else c.people.push({ name: p.name || '', role: p.role || '', email: p.email || '', phone: p.phone || '' }); });
    c.people.map(function (p) { return domOf(p.email); }).concat(o.domains || []).forEach(function (d) { d = low(d); if (d && c.domains.indexOf(d) < 0) c.domains.push(d); });
    (o.tags || []).forEach(function (t) { if (c.tags.indexOf(t) < 0) c.tags.push(t); });
    return c;
  }
  SV.sales = {
    version: 1, statuses: ST.map(function (s) { return s[0]; }), channels: CH.map(function (x) { return x[0]; }), outcomes: OUT.map(function (x) { return x[0]; }),
    list: function () { return cos(); }, get: get, match: match,
    upsert: function (o) { var c = upsert(o); SV.save(); return c; },
    log: function (id, a) { var r = log(typeof id === 'object' ? id : get(id), a); SV.save(); return r; },
    setStatus: function (id, s, o) { setStatus(get(id), s, o); SV.save(); },
    setNext: function (id, n) { var c = get(id); if (c) { c.next = n && n.d ? { d: n.d, what: n.what || '' } : null; SV.save(); } },
    due: due
  };
  SV.salesChip = stChip;
  SV.salesDue = function () { return due().length; };

  // ---------- liste / tavle ----------
  function U() { return S().ui; }
  function filtered() {
    var u = U(), q = low(u.q), list = cos().filter(function (c) {
      if (u.seg && c.seg !== u.seg) return false;
      if (u.st === 'apne') { if (OPEN.indexOf(c.status) < 0) return false; } else if (u.st && c.status !== u.st) return false;
      if (u.due && !dueWhy(c)) return false;
      if (q && (c.name + ' ' + c.town + ' ' + c.tags.join(' ') + ' ' + c.note + ' ' + c.people.map(function (p) { return p.name + ' ' + p.email + ' ' + p.phone; }).join(' ')).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    var key = {
      neste: function (c) { var d = dueWhy(c); return d ? 'a' + String(9999 - d.days).padStart(5, '0') : c.next ? 'b' + c.next.d : 'c' + (lastC(c) ? lastC(c).d : '0'); },
      siste: function (c) { var l = lastC(c); return l ? 'a' + (9e9 - +l.d.replace(/\D/g, '').slice(0, 12)) : 'z'; },
      navn: function (c) { return c.name.toLowerCase(); },
      verdi: function (c) { return String(1e9 - (c.value || 0)).padStart(12, '0'); },
      status: function (c) { return String(ST.map(function (s) { return s[0]; }).indexOf(c.status)) + c.name; }
    }[u.sort] || function (c) { return c.name; };
    return list.sort(function (a, b) { var x = key(a), y = key(b); return x < y ? -1 : x > y ? 1 : 0; });
  }
  function lastCell(c) {
    var l = lastC(c), w = waiting(c);
    if (!l) return '<span class="muted small">Ingen kontakt ennå</span>';
    return '<span class="sl-last">' + chIc(l.ch) + '<span>' + ago(l.d) + (l.dir === 'inn' ? ' · svar' : '') + '</span>' + (l.out ? outChip(l.out) : w ? SV.chip('Venter ' + w + ' d', w >= S().cfg.noReply ? 'bad' : 'sand') : '') + '</span>' + (l.text ? '<small class="sl-clip">' + esc(l.text) + '</small>' : '');
  }
  function nextCell(c) {
    var d = dueWhy(c);
    if (d && d.kind === 'wait') return '<span class="sl-due bad">' + ic('clock') + 'Følg opp</span><small>' + esc(d.why) + '</small>';
    if (!c.next) return '<span class="muted small sl-none">–</span>';
    var n = SV.diff(c.next.d); return '<span class="sl-due' + (n < 0 ? ' bad' : n === 0 ? ' now' : '') + '">' + ic('cal') + dueTxt(c.next.d) + '</span><small>' + esc(c.next.what || '') + '</small>';
  }
  function who(c) { var p = c.people[0]; return p ? esc(p.name || p.email || p.phone) + (p.role ? '<small>' + esc(p.role) + '</small>' : (p.name && p.email ? '<small>' + esc(p.email) + '</small>' : '')) : '<span class="muted small">Ingen kontaktperson</span>'; }
  function listHtml(list) {
    return '<div class="card tbl-w"><table class="tbl crm sl-tbl"><thead><tr><th>Firma</th><th class="hide-s">Kontakt</th><th>Status</th><th>Siste kontakt</th><th>Neste steg</th><th class="r hide-s">Verdi/år</th></tr></thead><tbody>' +
      list.map(function (c) {
        return '<tr class="click" data-act="go" data-href="#/salg/' + c.id + '"><td><a href="#/salg/' + c.id + '" class="sl-name">' + SV.dot(c.seg) + '<b>' + esc(c.name) + '</b>' + (c.heat === 'varm' ? '<i class="sl-heat" title="Varm">●</i>' : '') + '</a><small>' + esc(c.town || lab(SEG, c.seg)) + (c.tags.length ? ' · ' + c.tags.map(esc).join(', ') : '') + '</small></td>' +
          '<td class="hide-s">' + who(c) + '</td><td>' + stChip(c.status) + '</td><td>' + lastCell(c) + '</td><td>' + nextCell(c) + '</td><td class="r num hide-s">' + (c.value ? SV.kr(c.value) : '–') + '</td></tr>';
      }).join('') + '</tbody></table>' + (list.length ? '' : '<p class="empty" style="padding:30px;text-align:center">Ingen treff. Prøv et annet filter.</p>') + '</div>';
  }
  function boardHtml(list) {
    return '<div class="sl-board">' + ST.map(function (s) {
      var cs = list.filter(function (c) { return c.status === s[0]; }), sum = cs.reduce(function (t, c) { return t + (c.value || 0); }, 0);
      return '<section class="sl-col" data-st="' + s[0] + '"><header><b>' + s[1] + '</b><span>' + cs.length + (sum && s[0] !== 'nei' ? ' · ' + SV.kr(sum) : '') + '</span></header>' +
        cs.map(function (c) { var d = dueWhy(c), l = lastC(c); return '<a class="sl-card' + (d ? ' due' : '') + '" draggable="true" data-id="' + c.id + '" href="#/salg/' + c.id + '"><b>' + SV.dot(c.seg) + esc(c.name) + '</b><small>' + esc(c.people[0] ? c.people[0].name || c.people[0].email : c.town) + '</small>' + (l ? '<span class="sl-cm">' + chIc(l.ch) + ago(l.d) + (l.out ? ' · ' + lab(OUT, l.out) : '') + '</span>' : '') + (d ? '<span class="sl-due bad">' + ic('clock') + esc(d.why) + '</span>' : c.next ? '<span class="sl-due">' + ic('cal') + dueTxt(c.next.d) + '</span>' : '') + '</a>'; }).join('') +
        (cs.length ? '' : '<p class="sl-drop">Dra kort hit</p>') + '</section>';
    }).join('') + '</div>';
  }
  SV.route('/salg', 'studio', function () {
    var u = U(), all = cos(), list = filtered(), dl = due();
    var open = all.filter(function (c) { return OPEN.indexOf(c.status) > -1; }), pipe = open.reduce(function (t, c) { return t + (c.value || 0); }, 0);
    var yr = today().slice(0, 4), won = all.filter(function (c) { return c.status === 'kunde' && c.won && c.won.slice(0, 4) === yr; });
    var wait = all.filter(function (c) { return waiting(c) > 0; });
    var kpi = '<div class="g4 sl-kpi">' +
      '<button class="card stat' + (u.due ? ' on' : '') + '" data-act="slDue"><p class="k">' + ic('clock') + 'Følg opp nå</p><p class="v">' + dl.length + '</p><p class="s">' + (dl.length ? 'Forfalt eller uten svar' : 'Alt er fulgt opp') + '</p></button>' +
      '<button class="card stat" data-act="slSt" data-st="kontaktet"><p class="k">' + ic('mail') + 'Venter på svar</p><p class="v">' + wait.length + '</p><p class="s">Sendt, ikke besvart</p></button>' +
      '<button class="card stat" data-act="slSt" data-st="apne"><p class="k">' + ic('route') + 'Åpne muligheter</p><p class="v">' + open.length + '</p><p class="s">' + SV.kr(pipe) + ' per år</p></button>' +
      '<button class="card stat" data-act="slSt" data-st="kunde"><p class="k">' + ic('check') + 'Landet i ' + yr + '</p><p class="v">' + won.length + '</p><p class="s">' + all.filter(function (c) { return c.status === 'kunde'; }).length + ' kunder totalt</p></button></div>';
    var todo = dl.length ? '<div class="card sec sl-todo"><div class="card-h"><h3>Følg opp</h3><span class="small muted">Sortert etter hvor lenge det har ventet</span></div><div class="card-b">' + dl.slice(0, 6).map(function (x) {
      return '<div class="li"><a class="li-t" href="#/salg/' + x.c.id + '"><b>' + SV.dot(x.c.seg) + esc(x.c.name) + '</b><small>' + esc(x.why) + (x.kind === 'next' && x.days > 0 ? ' · forfalt ' + x.days + ' d' : '') + ' · ' + esc(lab(ST, x.c.status)) + '</small></a>' +
        '<span class="row" style="gap:6px;flex-wrap:nowrap">' + (x.c.people[0] && x.c.people[0].phone ? '<a class="btn btn-ghost btn-xs" href="tel:' + x.c.people[0].phone.replace(/\s/g, '') + '">' + ic('chat') + '<span class="hide-s">Ring</span></a>' : '') + '<button class="btn btn-ghost btn-xs" data-act="slLogM" data-id="' + x.c.id + '">' + ic('edit') + '<span class="hide-s">Logg</span></button><button class="btn btn-ghost btn-xs" data-act="slSnooze" data-id="' + x.c.id + '" title="Utsett 3 dager">+3 d</button></span></div>';
    }).join('') + (dl.length > 6 ? '<button class="link small" data-act="slDue" style="margin-top:8px">Vis alle ' + dl.length + '</button>' : '') + '</div></div>' : '';
    var strip = '<div class="sl-pipe" role="group" aria-label="Status">' + [['', 'Alle', all.length]].concat(ST.map(function (s) { return [s[0], s[1], all.filter(function (c) { return c.status === s[0]; }).length]; })).map(function (s) { return '<button class="' + (u.st === s[0] ? 'on' : '') + '" data-act="slSt" data-st="' + s[0] + '"><b>' + s[2] + '</b><span>' + s[1] + '</span></button>'; }).join('') + '</div>';
    var bar = '<div class="sl-bar"><label class="search sl-q">' + ic('search') + '<input id="slQ" placeholder="Søk firma, person, e-post, sted …" value="' + esc(u.q) + '" data-input="slQ" aria-label="Søk i salg"></label>' +
      '<div class="filters" style="margin:0">' + [['', 'Alle felt']].concat(SEG).map(function (s) { return '<button class="fbtn' + (u.seg === s[0] ? ' on' : '') + '" data-act="slSeg" data-seg="' + s[0] + '">' + (s[0] ? SV.dot(s[0]) : '') + s[1] + '</button>'; }).join('') + '</div>' +
      '<span class="sl-bar-r"><select class="sel sel-xs" data-change="slSort" aria-label="Sorter">' + [['neste', 'Mest presserende'], ['siste', 'Siste kontakt'], ['navn', 'Navn'], ['verdi', 'Verdi'], ['status', 'Status']].map(function (s) { return '<option value="' + s[0] + '"' + (u.sort === s[0] ? ' selected' : '') + '>' + s[1] + '</option>'; }).join('') + '</select>' +
      '<span class="seg-t"><button class="' + (u.view === 'liste' ? 'on' : '') + '" data-act="slView" data-v="liste" aria-label="Liste">' + ic('list') + '</button><button class="' + (u.view === 'tavle' ? 'on' : '') + '" data-act="slView" data-v="tavle" aria-label="Tavle">' + ic('grid') + '</button></span></span></div>' +
      (u.due || u.st || u.seg || u.q ? '<p class="small muted sl-active">Viser ' + list.length + ' av ' + all.length + (u.due ? ' · bare de som bør følges opp' : '') + ' <button class="link small" data-act="slClear">Nullstill filter</button></p>' : '');
    SV.after(function () { var q = document.getElementById('slQ'); if (q && ui.focusQ) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); ui.focusQ = false; } });
    return SV.head({ eyebrow: open.length + ' åpne muligheter · ' + all.filter(function (c) { return c.status === 'ny'; }).length + ' ikke kontaktet · ' + dl.length + ' til oppfølging', a: 'Salg', b: 'og kundeoppfølging', lead: 'Alle kunder og mulige kunder på ett sted: status, siste kontakt og neste steg. E-post til og fra kundene kobles på automatisk.',
      actions: '<button class="btn btn-ghost btn-s" data-act="slSettings" aria-label="Innstillinger">' + ic('lock') + '<span class="hide-s">Innstillinger</span></button><button class="btn btn-ghost btn-s" data-act="slImport">' + ic('upload') + '<span class="hide-s">Importer</span></button><button class="btn btn-ghost btn-s" data-act="slExport">' + ic('down') + '<span class="hide-s">Eksporter</span></button><button class="btn btn-acc btn-s" data-act="slNew">' + ic('plus') + 'Ny kunde</button>' }) +
      kpi + todo + '<div class="sec">' + strip + bar + (u.view === 'tavle' ? boardHtml(list) : listHtml(list)) + '</div>';
  }, { title: 'Salg' });

  var ui = { focusQ: false };
  SV.on('slQ', function (el) { U().q = el.value; ui.focusQ = true; SV.save(); SV.render(); });
  SV.on('slSeg', function (el) { U().seg = el.getAttribute('data-seg'); SV.save(); SV.render(); });
  SV.on('slSt', function (el) { var s = el.getAttribute('data-st'); U().st = U().st === s && s ? '' : s; U().due = false; SV.save(); SV.render(); });
  SV.on('slDue', function () { var u = U(); u.due = !u.due; if (u.due) { u.st = ''; u.sort = 'neste'; } SV.save(); SV.render(); });
  SV.on('slSort', function (el) { U().sort = el.value; SV.save(); SV.render(); });
  SV.on('slView', function (el) { U().view = el.getAttribute('data-v'); SV.save(); SV.render(); });
  SV.on('slClear', function () { Object.assign(U(), { seg: '', st: '', q: '', due: false }); SV.save(); SV.render(); });
  SV.on('slSnooze', function (el, ev) { if (ev) ev.preventDefault(); var c = get(el.getAttribute('data-id')); c.next = { d: plus(3), what: (c.next && c.next.what) || dueWhy(c) && dueWhy(c).why || 'Følg opp' }; SV.save(); SV.render(); SV.toast(c.name + ' · utsatt til ' + SV.fdate(c.next.d)); });

  // dra og slipp på tavla
  var dragId = null;
  document.addEventListener('dragstart', function (e) { var k = e.target.closest && e.target.closest('.sl-card'); if (!k) return; dragId = k.getAttribute('data-id'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', dragId); } catch (x) {} k.classList.add('drag'); });
  document.addEventListener('dragend', function () { dragId = null; document.querySelectorAll('.sl-col.over,.sl-card.drag').forEach(function (x) { x.classList.remove('over', 'drag'); }); });
  document.addEventListener('dragover', function (e) { var col = dragId && e.target.closest && e.target.closest('.sl-col'); if (!col) return; e.preventDefault(); document.querySelectorAll('.sl-col.over').forEach(function (x) { if (x !== col) x.classList.remove('over'); }); col.classList.add('over'); });
  document.addEventListener('drop', function (e) { var col = dragId && e.target.closest && e.target.closest('.sl-col'); if (!col) return; e.preventDefault(); var c = get(dragId), to = col.getAttribute('data-st'); dragId = null; if (c && c.status !== to) { setStatus(c, to); SV.save(); SV.toast(c.name + ' → ' + lab(ST, to)); } SV.render(); });

  // ---------- kundekort ----------
  SV.route('/salg/:id', 'studio', function (q) {
    var c = get(q.id); if (!c) return '<p class="empty">Fant ikke kunden. <a href="#/salg">Tilbake til salg</a></p>';
    var d = dueWhy(c), mails = SV.mailFind ? SV.mailFind(c.people.map(function (p) { return p.email; }).filter(Boolean), c.domains) : [];
    var p0 = c.people[0] || {};
    var head = '<a href="#/salg" class="sl-back">' + ic('back') + 'Salg</a>' +
      '<header class="ph sl-ph"><div class="ph-text"><p class="eyebrow">' + SV.dot(c.seg) + lab(SEG, c.seg) + (c.town ? ' · ' + esc(c.town) : '') + (c.source ? ' · ' + esc(c.source) : '') + '</p><h1 class="ph-title"><span class="serif">' + esc(c.name) + '</span></h1>' +
        '<div class="row sl-hrow"><select class="sel sel-xs sl-stsel st-' + c.status + '" data-change="slSetSt" data-id="' + c.id + '" aria-label="Status">' + ST.map(function (s) { return '<option value="' + s[0] + '"' + (s[0] === c.status ? ' selected' : '') + '>' + s[1] + '</option>'; }).join('') + '</select>' +
        '<select class="sel sel-xs" data-change="slHeat" data-id="' + c.id + '" aria-label="Temperatur">' + HEAT.map(function (h) { return '<option value="' + h[0] + '"' + (h[0] === c.heat ? ' selected' : '') + '>' + (h[0] ? h[1] : 'Temperatur …') + '</option>'; }).join('') + '</select>' +
        (c.tags.length ? c.tags.map(function (t) { return '<span class="chip chip-mute">' + esc(t) + '</span>'; }).join('') : '') + '</div></div>' +
      '<div class="ph-act">' + (p0.phone ? '<a class="btn btn-ghost btn-s" href="tel:' + p0.phone.replace(/\s/g, '') + '">' + ic('chat') + 'Ring</a>' : '') + (p0.email && SV.mailCompose ? '<button class="btn btn-ghost btn-s" data-act="slMail" data-id="' + c.id + '">' + ic('mail') + 'Send e-post</button>' : '') + '<button class="btn btn-ghost btn-s" data-act="slEdit" data-id="' + c.id + '">' + ic('edit') + 'Rediger</button></div></header>';
    var alert = d ? '<div class="sl-alert">' + ic('clock') + '<span><b>Følg opp:</b> ' + esc(d.why) + (d.kind === 'next' && d.days > 0 ? ' (forfalt ' + d.days + ' d)' : '') + '</span><button class="btn btn-ghost btn-xs" data-act="slSnooze" data-id="' + c.id + '">Utsett 3 dager</button></div>' : '';
    var people = '<div class="card"><div class="card-h"><h3>Kontaktpersoner</h3><button class="link small" data-act="slPerson" data-id="' + c.id + '">' + ic('plus') + 'Legg til</button></div><div class="card-b">' +
      (c.people.length ? c.people.map(function (p, i) { return '<div class="li sl-person">' + SV.avatar(p.name || p.email || '?') + '<span class="li-t"><b>' + esc(p.name || 'Uten navn') + '</b><small>' + esc(p.role || '') + '</small>' + (p.email ? '<a class="small" href="#" data-act="slMail" data-id="' + c.id + '" data-p="' + i + '">' + esc(p.email) + '</a>' : '') + (p.phone ? '<a class="small" href="tel:' + p.phone.replace(/\s/g, '') + '">' + esc(p.phone) + '</a>' : '') + '</span><button class="link tiny" data-act="slPerson" data-id="' + c.id + '" data-p="' + i + '">Endre</button></div>'; }).join('') : '<p class="small muted">Ingen kontaktperson ennå.</p>') + '</div></div>';
    var info = '<div class="card" style="margin-top:16px"><div class="card-h"><h3>Firma</h3></div><div class="card-b"><dl class="kv small">' +
      [['Orgnr', c.orgnr], ['Sted', c.town], ['Nettside', c.web ? '<a href="' + (/^https?:/.test(c.web) ? '' : 'https://') + esc(c.web) + '" target="_blank" rel="noopener">' + esc(c.web) + '</a>' : ''], ['E-postdomene', c.domains.join(', ')], ['Kilde', c.source], ['Verdi per år', c.value ? SV.kr(c.value) : ''], ['Kunde siden', c.won ? SV.fdate(c.won) : ''], ['Lagt inn', c.created ? SV.fdate(c.created) : '']]
        .map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + (r[1] ? (r[0] === 'Nettside' ? r[1] : esc(r[1])) : '<span class="muted">–</span>') + '</dd>'; }).join('') + '</dl></div></div>';
    var note = '<div class="card" style="margin-top:16px"><div class="card-h"><h3>Notat</h3><span class="tiny muted" id="slNoteS"></span></div><div class="card-b"><textarea class="txt" rows="5" data-input="slNote" data-id="' + c.id + '" placeholder="Hva vet du om kunden? Behov, budsjett, hvem som bestemmer …">' + esc(c.note) + '</textarea></div></div>';
    var next = '<div class="card"><div class="card-h"><h3>Neste steg</h3>' + (c.next ? '<button class="link small" data-act="slNextDone" data-id="' + c.id + '">' + ic('check') + 'Ferdig</button>' : '') + '</div><div class="card-b"><form class="sl-next" id="slNext" onsubmit="return false"><input class="inp" name="what" placeholder="F.eks. Ring om tilbudet" value="' + esc(c.next ? c.next.what : '') + '"><input class="inp" type="date" name="d" value="' + (c.next ? c.next.d : '') + '" aria-label="Dato"><button class="btn btn-dark btn-s" data-act="slNextSave" data-id="' + c.id + '">Lagre</button></form>' +
      '<div class="row sl-quick">' + [[1, 'I morgen'], [3, '+3 dager'], [7, '+1 uke'], [14, '+2 uker'], [30, '+1 mnd'], [90, '+3 mnd']].map(function (x) { return '<button class="fbtn" data-act="slNextQ" data-id="' + c.id + '" data-n="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div></div></div>';
    var form = '<div class="card" style="margin-top:16px"><div class="card-h"><h3>Logg kontakt</h3></div><div class="card-b"><form id="slLog" class="sl-log" onsubmit="return false">' + logFields() + '<div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn btn-acc btn-s" data-act="slLogSave" data-id="' + c.id + '">' + ic('check') + 'Lagre</button></div></form></div></div>';
    var items = c.acts.map(function (a) { return { d: a.d, a: a }; }).concat(mails.map(function (t) { var m = t.msgs.filter(function (x) { return !x.draft; }); m = m[m.length - 1] || t.msgs[0]; return { d: m.d, t: t, m: m }; }).filter(function (x) { return !c.acts.some(function (a) { return a.ref && a.ref.indexOf('mail:' + x.t.id + ':') === 0; }); }))
      .sort(function (x, y) { return x.d < y.d ? 1 : -1; });
    var tl = '<div class="card" style="margin-top:16px"><div class="card-h"><h3>Historikk</h3><span class="small muted">' + contacts(c).length + ' kontakter' + (mails.length ? ' · ' + mails.length + ' e-posttråder' : '') + '</span></div><div class="card-b"><ol class="sl-tl">' +
      (items.length ? items.map(function (x) {
        if (x.t) return '<li class="mail"><span class="sl-tl-i">' + ic('mail') + '</span><div><p><a href="#/post/innboks/' + x.t.id + '"><b>' + esc(x.t.subj || '(uten emne)') + '</b></a> ' + SV.chip('E-post', 'mute') + '</p><p class="small muted">' + SV.fdate(x.d.slice(0, 10)) + ' kl. ' + x.d.slice(11, 16) + ' · ' + esc(x.m.from[0]) + ' · ' + x.t.msgs.length + ' meldinger</p></div></li>';
        var a = x.a, agent = a.by === 'Agent' || a.src === 'agent';
        if (a.type === 'status') return '<li class="st"><span class="sl-tl-i">' + ic('route') + '</span><div><p>Status: ' + esc(lab(ST, a.from)) + ' → <b>' + esc(lab(ST, a.to)) + '</b>' + (agent ? ' <i class="sl-agent">Agent</i>' : '') + '</p><p class="small muted">' + SV.fdate(a.d.slice(0, 10)) + ' kl. ' + a.d.slice(11, 16) + (a.text ? ' · ' + esc(a.text) : '') + '</p></div></li>';
        return '<li><span class="sl-tl-i ' + (a.dir === 'inn' ? 'in' : '') + '">' + chIc(a.ch) + '</span><div><p><b>' + lab(CH, a.ch) + (a.dir === 'inn' ? ' fra kunden' : ' fra meg') + '</b> ' + (a.out ? outChip(a.out) : '') + (agent ? ' <i class="sl-agent">Agent</i>' : a.src === 'e-post' ? ' <i class="sl-agent">Fra e-post</i>' : '') + '</p>' + (a.text ? '<p class="small">' + esc(a.text) + '</p>' : '') + '<p class="tiny muted">' + SV.fdate(a.d.slice(0, 10)) + ' kl. ' + a.d.slice(11, 16) + ' · ' + ago(a.d) + (a.ref && a.ref.indexOf('mail:') === 0 ? ' · <a href="#/post/innboks/' + a.ref.split(':')[1] + '">Åpne e-post</a>' : '') + '</p></div><button class="link tiny sl-del" data-act="slActDel" data-id="' + c.id + '" data-a="' + a.id + '" aria-label="Slett">×</button></li>';
      }).join('') : '<li class="muted small">Ingen historikk ennå. Logg første kontakt over.</li>') + '</ol></div></div>';
    return head + alert + '<div class="g12 sl-grid"><div>' + people + info + note + '</div><div>' + next + form + tl + '</div></div>';
  }, { title: 'Kunde' });

  function logFields() {
    return '<div class="sl-chs" role="radiogroup" aria-label="Kanal">' + CH.map(function (x, i) { return '<label class="sl-pick"><input type="radio" name="ch" value="' + x[0] + '"' + (i === 0 ? ' checked' : '') + '><span>' + ic(x[2]) + x[1] + '</span></label>'; }).join('') + '</div>' +
      '<div class="sl-chs" role="radiogroup" aria-label="Retning"><label class="sl-pick"><input type="radio" name="dir" value="ut" checked><span>Jeg tok kontakt</span></label><label class="sl-pick"><input type="radio" name="dir" value="inn"><span>Kunden tok kontakt</span></label></div>' +
      '<div class="sl-chs" role="radiogroup" aria-label="Utfall"><span class="small muted">Utfall:</span>' + [['', 'Venter på svar']].concat(OUT).map(function (x, i) { return '<label class="sl-pick sm"><input type="radio" name="out" value="' + x[0] + '"' + (i === 0 ? ' checked' : '') + '><span>' + x[1] + '</span></label>'; }).join('') + '</div>' +
      '<textarea class="txt" name="text" rows="3" placeholder="Hva ble sagt? (valgfritt)" style="margin-top:8px"></textarea>' +
      '<div class="g2" style="gap:8px;margin-top:8px"><label class="fld"><span>Neste steg (valgfritt)</span><input class="inp" name="nwhat" placeholder="F.eks. Ring igjen"></label><label class="fld"><span>Dato</span><input class="inp" type="date" name="nd"></label></div>';
  }
  function readLog(f) { var v = function (n) { var x = f.querySelector('[name=' + n + ']:checked'); return x ? x.value : ''; }; return { ch: v('ch'), dir: v('dir'), out: v('out') || undefined, text: f.text.value.trim(), next: f.nd.value ? { d: f.nd.value, what: f.nwhat.value.trim() } : null }; }
  function saveLog(c, f) {
    var r = readLog(f), before = c.status; log(c, { ch: r.ch, dir: r.dir, out: r.out, text: r.text });
    if (r.next) c.next = r.next; else if (c.next && SV.diff(c.next.d) <= 0) c.next = null;
    SV.save(); SV.toast('Kontakt logget' + (c.status !== before ? ' · status: ' + lab(ST, c.status) : ''));
  }
  SV.on('slLogSave', function (el) { saveLog(get(el.getAttribute('data-id')), document.getElementById('slLog')); SV.render(); });
  SV.on('slLogM', function (el, ev) { if (ev) ev.preventDefault(); var c = get(el.getAttribute('data-id')); SV.modal('<p class="eyebrow">' + SV.dot(c.seg) + esc(c.name) + '</p><h2 class="h2"><span class="serif">Logg kontakt</span></h2><form id="slLogM" class="sl-log" onsubmit="return false" style="margin-top:14px">' + logFields() + '<div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn btn-acc" data-act="slLogMSave" data-id="' + c.id + '">Lagre</button></div></form>'); });
  SV.on('slLogMSave', function (el) { saveLog(get(el.getAttribute('data-id')), document.getElementById('slLogM')); SV.close(); SV.render(); });
  SV.on('slActDel', function (el) { var c = get(el.getAttribute('data-id')), id = el.getAttribute('data-a'); c.acts = c.acts.filter(function (a) { return a.id !== id; }); SV.save(); SV.render(); SV.toast('Slettet fra historikken'); });
  SV.on('slSetSt', function (el) { var c = get(el.getAttribute('data-id')); setStatus(c, el.value); SV.save(); SV.render(); SV.toast('Status: ' + lab(ST, el.value)); });
  SV.on('slHeat', function (el) { get(el.getAttribute('data-id')).heat = el.value; SV.save(); });
  var noteT = null;
  SV.on('slNote', function (el) { var c = get(el.getAttribute('data-id')); c.note = el.value; clearTimeout(noteT); noteT = setTimeout(function () { SV.save(); var s = document.getElementById('slNoteS'); if (s) s.textContent = 'Lagret'; }, 600); });
  SV.on('slNextSave', function (el) { var c = get(el.getAttribute('data-id')), f = document.getElementById('slNext'); if (!f.d.value) { SV.toast('Velg en dato', 'warn'); return; } c.next = { d: f.d.value, what: f.what.value.trim() }; SV.save(); SV.render(); SV.toast('Neste steg: ' + SV.fdate(c.next.d)); });
  SV.on('slNextQ', function (el) { var c = get(el.getAttribute('data-id')), f = document.getElementById('slNext'); c.next = { d: plus(+el.getAttribute('data-n')), what: (f && f.what.value.trim()) || (c.next && c.next.what) || 'Følg opp' }; SV.save(); SV.render(); SV.toast('Neste steg: ' + SV.fdate(c.next.d)); });
  SV.on('slNextDone', function (el) { var c = get(el.getAttribute('data-id')); c.acts.push({ id: 'a' + (++S().seq), type: 'kontakt', ch: 'telefon', dir: 'ut', d: now(), by: 'Aleksander', src: 'manuell', text: 'Utført: ' + (c.next.what || 'neste steg') }); c.next = null; SV.save(); SV.render(); SV.toast('Markert som utført'); });
  SV.on('slMail', function (el, ev) { if (ev) ev.preventDefault(); var c = get(el.getAttribute('data-id')), p = c.people[+(el.getAttribute('data-p') || 0)] || c.people.filter(function (x) { return x.email; })[0]; if (!p || !p.email) { SV.toast('Ingen e-postadresse', 'warn'); return; } SV.mailCompose([p.name || p.email, p.email], ''); });

  // ---------- ny / rediger / kontaktperson ----------
  function formHtml(c) {
    c = c || { seg: 'bedrift', status: 'ny', people: [{}], tags: [] }; var p = c.people[0] || {};
    var opt = function (arr, v) { return arr.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === v ? ' selected' : '') + '>' + x[1] + '</option>'; }).join(''); };
    return '<form id="slF" onsubmit="return false"><div class="g2" style="gap:10px">' +
      '<label class="fld"><span>Firma</span><input class="inp" name="name" value="' + esc(c.name || '') + '" placeholder="Firmanavn"></label>' +
      '<label class="fld"><span>Felt</span><select class="sel" name="seg">' + opt(SEG, c.seg) + '</select></label>' +
      (c.id ? '' : '<label class="fld"><span>Kontaktperson</span><input class="inp" name="pn" value="' + esc(p.name || '') + '"></label><label class="fld"><span>Rolle</span><input class="inp" name="pr" value="' + esc(p.role || '') + '" placeholder="F.eks. Daglig leder"></label>' +
        '<label class="fld"><span>E-post</span><input class="inp" type="email" name="pe" value="' + esc(p.email || '') + '"></label><label class="fld"><span>Telefon</span><input class="inp" name="pp" inputmode="tel" value="' + esc(p.phone || '') + '"></label>') +
      '<label class="fld"><span>Sted</span><input class="inp" name="town" value="' + esc(c.town || '') + '"></label>' +
      '<label class="fld"><span>Status</span><select class="sel" name="status">' + opt(ST, c.status) + '</select></label>' +
      '<label class="fld"><span>Nettside</span><input class="inp" name="web" value="' + esc(c.web || '') + '" placeholder="firma.no"></label>' +
      '<label class="fld"><span>Orgnr</span><input class="inp" name="orgnr" inputmode="numeric" value="' + esc(c.orgnr || '') + '"></label>' +
      '<label class="fld"><span>Antatt verdi per år (kr)</span><input class="inp" name="value" inputmode="numeric" value="' + (c.value || '') + '"></label>' +
      '<label class="fld"><span>Kilde</span><select class="sel" name="source"><option value="">–</option>' + SOURCES.map(function (s) { return '<option' + (s === c.source ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></label>' +
      '<label class="fld" style="grid-column:1/-1"><span>Stikkord (komma mellom)</span><input class="inp" name="tags" value="' + esc(c.tags.join(', ')) + '" placeholder="F.eks. Drone, Rekrutteringsfilm"></label>' +
      '</div><p class="hint">Ingen felt er påkrevd, men firma eller e-post gjør det lett å finne igjen.</p></form>';
  }
  function readForm(f) {
    var g = function (n) { return f[n] ? f[n].value.trim() : ''; };
    return { name: g('name'), seg: g('seg'), town: g('town'), status: g('status'), web: g('web').replace(/^https?:\/\//, '').replace(/\/$/, ''), orgnr: g('orgnr'), value: +g('value').replace(/\D/g, '') || 0, source: g('source'), tags: g('tags').split(',').map(function (t) { return t.trim(); }).filter(Boolean),
      people: f.pn ? [{ name: g('pn'), role: g('pr'), email: g('pe'), phone: g('pp') }] : [] };
  }
  SV.on('slNew', function () { SV.modal('<p class="eyebrow">Salg</p><h2 class="h2"><span class="serif">Ny kunde</span></h2><div style="margin-top:14px">' + formHtml() + '</div><div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn btn-acc" data-act="slCreate">Legg til</button></div>', { wide: true, after: function () { var i = document.querySelector('#slF [name=name]'); if (i) i.focus(); } }); });
  SV.on('slCreate', function () {
    var o = readForm(document.getElementById('slF'));
    if (!o.name && !o.people[0].email && !o.people[0].name) { SV.toast('Skriv minst firmanavn, person eller e-post', 'warn'); return; }
    if (!o.name) o.name = o.people[0].name || o.people[0].email;
    var ex = match({ email: o.people[0].email, name: o.name, orgnr: o.orgnr, domain: domOf(o.people[0].email) || (o.web ? o.web.split('/')[0].replace(/^www\./, '') : '') });
    if (ex && !confirm(ex.name + ' finnes allerede. Legge til likevel som ny kunde?')) { SV.close(); SV.go('#/salg/' + ex.id); return; }
    var st = o.status; o.status = 'ny';
    var c = { id: 'k' + (++S().seq), name: o.name, seg: o.seg, town: o.town, orgnr: o.orgnr, web: o.web, status: 'ny', value: o.value, source: o.source, heat: '', tags: o.tags, people: o.people.filter(function (p) { return p.name || p.email || p.phone; }), domains: [], acts: [], note: '', created: today(), next: null };
    c.domains = c.people.map(function (p) { return domOf(p.email); }).concat(o.web ? [o.web.split('/')[0].replace(/^www\./, '')] : []).filter(function (d, i, a) { return d && a.indexOf(d) === i; });
    cos().unshift(c); if (st !== 'ny') setStatus(c, st);
    SV.save(); SV.close(); SV.go('#/salg/' + c.id); SV.toast('Lagt til: ' + c.name);
  });
  SV.on('slEdit', function (el) { var c = get(el.getAttribute('data-id')); SV.modal('<p class="eyebrow">Salg</p><h2 class="h2"><span class="serif">Rediger ' + esc(c.name) + '</span></h2><div style="margin-top:14px">' + formHtml(c) + '</div><div class="row between" style="margin-top:14px"><button class="link small" data-act="slDel" data-id="' + c.id + '" style="color:var(--bad)">Slett kunden</button><button class="btn btn-acc" data-act="slUpdate" data-id="' + c.id + '">Lagre</button></div>', { wide: true }); });
  SV.on('slUpdate', function (el) {
    var c = get(el.getAttribute('data-id')), o = readForm(document.getElementById('slF')), st = o.status;
    ['name', 'seg', 'town', 'web', 'orgnr', 'value', 'source', 'tags'].forEach(function (k) { c[k] = o[k]; });
    if (o.web) { var dm = o.web.split('/')[0].replace(/^www\./, ''); if (c.domains.indexOf(dm) < 0) c.domains.push(dm); }
    setStatus(c, st); SV.save(); SV.close(); SV.render(); SV.toast('Lagret');
  });
  SV.on('slDel', function (el) { var c = get(el.getAttribute('data-id')); if (!confirm('Slette ' + c.name + ' og all historikk? Dette kan ikke angres.')) return; S().cos = cos().filter(function (x) { return x !== c; }); SV.save(); SV.close(); SV.go('#/salg'); SV.toast('Slettet'); });
  SV.on('slPerson', function (el) {
    var c = get(el.getAttribute('data-id')), i = el.getAttribute('data-p'), p = i != null ? c.people[+i] : {};
    SV.modal('<p class="eyebrow">' + esc(c.name) + '</p><h2 class="h2"><span class="serif">' + (i != null ? 'Endre kontaktperson' : 'Ny kontaktperson') + '</span></h2><form id="slP" onsubmit="return false"><div class="g2" style="gap:10px;margin-top:14px">' +
      '<label class="fld"><span>Navn</span><input class="inp" name="n" value="' + esc(p.name || '') + '"></label><label class="fld"><span>Rolle</span><input class="inp" name="r" value="' + esc(p.role || '') + '"></label><label class="fld"><span>E-post</span><input class="inp" type="email" name="e" value="' + esc(p.email || '') + '"></label><label class="fld"><span>Telefon</span><input class="inp" name="p" inputmode="tel" value="' + esc(p.phone || '') + '"></label></div></form>' +
      '<div class="row between" style="margin-top:14px">' + (i != null ? '<button class="link small" data-act="slPersonDel" data-id="' + c.id + '" data-p="' + i + '" style="color:var(--bad)">Fjern</button>' : '<span></span>') + '<button class="btn btn-acc" data-act="slPersonSave" data-id="' + c.id + '"' + (i != null ? ' data-p="' + i + '"' : '') + '>Lagre</button></div>');
  });
  SV.on('slPersonSave', function (el) {
    var c = get(el.getAttribute('data-id')), i = el.getAttribute('data-p'), f = document.getElementById('slP'), p = { name: f.n.value.trim(), role: f.r.value.trim(), email: f.e.value.trim(), phone: f.p.value.trim() };
    if (i != null) c.people[+i] = p; else c.people.push(p);
    var dm = domOf(p.email); if (dm && c.domains.indexOf(dm) < 0) c.domains.push(dm);
    SV.save(); SV.close(); SV.render();
  });
  SV.on('slPersonDel', function (el) { var c = get(el.getAttribute('data-id')); c.people.splice(+el.getAttribute('data-p'), 1); SV.save(); SV.close(); SV.render(); });

  // ---------- import / eksport / innstillinger ----------
  SV.on('slImport', function () {
    SV.modal('<p class="eyebrow">Salg</p><h2 class="h2"><span class="serif">Importer kunder</span></h2><p class="small muted" style="margin-top:8px">Lim inn fra Excel, Google Sheets eller en CSV-fil. Én kunde per linje, kolonner i denne rekkefølgen:</p><p class="small" style="margin-top:6px"><b>Firma · Kontaktperson · E-post · Telefon · Sted · Felt</b> (bolig, bedrift, skole eller marked)</p>' +
      '<textarea class="txt" id="slImp" rows="8" style="margin-top:10px;font-family:ui-monospace,monospace;font-size:12.5px" placeholder="Rosendal Bakeri;Kari Nes;kari@rosendalbakeri.no;915 55 123;Rosendal;bedrift"></textarea><p class="hint">Finnes kunden fra før (samme e-post, domene eller navn), fylles bare tomme felt inn. Ingenting overskrives.</p>' +
      '<div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn btn-acc" data-act="slImpGo">Importer</button></div>', { wide: true });
  });
  SV.on('slImpGo', function () {
    var rows = document.getElementById('slImp').value.split(/\r?\n/).map(function (l) { return l.split(/\t|;|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(function (x) { return x.trim().replace(/^"|"$/g, ''); }); }).filter(function (r) { return r.join('').trim(); });
    if (rows.length && /^firma|navn|company/i.test(rows[0][0])) rows.shift();
    var n = 0, m = 0;
    rows.forEach(function (r) { var seg = low(r[5]); seg = /bolig|megl/.test(seg) ? 'bolig' : /skol|barneh/.test(seg) ? 'skole' : /mark/.test(seg) ? 'mark' : 'bedrift'; var before = cos().length; upsert({ name: r[0], people: [{ name: r[1] || '', email: r[2] || '', phone: r[3] || '' }], town: r[4] || '', seg: seg, source: 'Kald liste' }); if (cos().length > before) n++; else m++; });
    SV.save(); SV.close(); SV.render(); SV.toast(n + ' nye' + (m ? ' · ' + m + ' fantes fra før' : ''));
  });
  SV.on('slExport', function () {
    var q = function (v) { v = String(v == null ? '' : v); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var rows = [['Firma', 'Felt', 'Status', 'Kontaktperson', 'Rolle', 'E-post', 'Telefon', 'Sted', 'Siste kontakt', 'Utfall', 'Neste steg', 'Dato', 'Verdi per år', 'Kilde', 'Stikkord']].concat(filtered().map(function (c) { var p = c.people[0] || {}, l = lastC(c); return [c.name, lab(SEG, c.seg), lab(ST, c.status), p.name, p.role, p.email, p.phone, c.town, l ? l.d.replace('T', ' ') : '', l && l.out ? lab(OUT, l.out) : '', c.next ? c.next.what : '', c.next ? c.next.d : '', c.value || '', c.source, c.tags.join(', ')]; }));
    var csv = '﻿' + rows.map(function (r) { return r.map(q).join(';'); }).join('\r\n'), a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = 'studiovest-salg-' + today() + '.csv'; a.click();
  });
  SV.on('slSettings', function () {
    var c = S().cfg;
    SV.modal('<p class="eyebrow">Salg</p><h2 class="h2"><span class="serif">Innstillinger</span></h2><form id="slSet" onsubmit="return false"><label class="fld" style="margin-top:14px"><span>Vis i «Følg opp» når kunden ikke har svart etter</span><span class="row" style="gap:8px;flex-wrap:nowrap"><input class="inp" type="number" min="1" max="60" name="nr" value="' + c.noReply + '" style="max-width:90px"> dager</span></label></form>' +
      '<div class="card pad" style="margin-top:14px"><h3 class="h3">Agent</h3><p class="small" style="margin-top:6px">Ikke koblet til ennå. Når agenten settes opp, leser den e-post og samtaler og oppdaterer listen her: logger kontakt, setter status (svar, ingen svar, positivt, negativt), og legger inn neste steg. Endringer fra agenten merkes «Agent» i historikken, og samme e-post logges aldri to ganger.</p></div>' +
      '<div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn btn-dark" data-act="slSetSave">Lagre</button></div>');
  });
  SV.on('slSetSave', function () { var v = +document.getElementById('slSet').nr.value; if (v > 0) S().cfg.noReply = v; SV.save(); SV.close(); SV.render(); SV.toast('Lagret'); });
})();
