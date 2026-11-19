/* E-post i portalen: innboks, tråder, svar/videresend, skriv ny, utkast, planlagt sending, angre, etiketter,
   søk med operatorer, hurtigtaster, regler, signatur og autosvar. Tråder kobles til boligprosjekter.
   Demo: alt ligger i nettleseren. I drift hentes e-post fra imap.one.com (993, SSL) og sendes via send.one.com (465, SSL)
   av en tjeneste på serveren, så passordet aldri ligger i nettleseren. */
(function () {
  'use strict';
  var SV = window.SV, D = SV.data, esc = SV.esc, ic = SV.icon;
  var ME = ['Studiovest', 'post@studiovest.no'];
  // Flere innbokser: hver konto er en egen one.com-adresse (IMAP/SMTP). Trådene har acct = konto-id.
  var COLORS = ['#a0764e', '#5f7a68', '#4f6380', '#8a4f5f', '#a08a3b', '#6b5f80'];
  function accts() { var m = M(); if (!m.accts || !m.accts.length) m.accts = [{ id: 'post', name: 'Studiovest', mail: ME[1], c: COLORS[0] }]; return m.accts; }
  function acct(id) { return accts().filter(function (a) { return a.id === id; })[0] || accts()[0]; }
  function A(id) { var a = acct(id); return [a.name, a.mail]; }
  function tAcct(t) { return t.acct && accts().some(function (a) { return a.id === t.acct; }) ? t.acct : accts()[0].id; }
  function curAcct() { var c = M().cur; return c && accts().some(function (a) { return a.id === c; }) ? c : null; }
  function inAcct(t) { var c = curAcct(); return !c || tAcct(t) === c; }
  function accDot(id, big) { var a = acct(id); return '<i class="mx-dot' + (big ? ' big' : '') + '" style="--c:' + a.c + '" aria-hidden="true"></i>'; }
  var LABELS = [['Bolig', 'bolig'], ['Bedrift', 'bedrift'], ['Skole', 'skole'], ['Faktura', 'mark'], ['Viktig', 'mark']];
  var VIEWS = [['innboks', 'Innboks', 'mail'], ['stjerne', 'Stjernemerket', 'star'], ['planlagt', 'Planlagt', 'clock'], ['sendt', 'Sendt', 'upload'], ['utkast', 'Utkast', 'edit'], ['arkiv', 'Arkiv', 'box'], ['spam', 'Søppelpost', 'shield'], ['papirkurv', 'Papirkurv', 'trash']];

  function at(dayOff, hm) { return D.W(dayOff) + 'T' + hm; }
  function p(t) { return t.split('\n\n').map(function (x) { return '<p>' + esc(x).replace(/\n/g, '<br>') + '</p>'; }).join(''); }
  function seed() {
    var T = [
      { id: 't1', subj: 'Bestilling: Fjellvegen 8', folder: 'inbox', labels: [], unread: true, msgs: [
        { from: ['Sigrid Tveit', 'sigrid.tveit@fjordmegling.example'], to: [ME], d: at(0, '07:52'), html: p('Hei!\n\nVi har fått inn en enebolig i Fjellvegen 8 i Stord, oppdragsnr 1126-0441. Kan dere ta Premium fotopakke med tomtefoto, og 3 bilder med virtuell møblering?\n\nSelger er Mona Rød, tlf 917 44 210, mona.rod@epost.example. Hun er hjemme etter kl. 15.\n\nVisning er planlagt 3. desember.\n\nMvh\nSigrid Tveit\nFjordmegling Stord'), att: [{ n: 'Salgsoppgave_utkast.pdf', kb: 812 }] }] },
      { id: 't2', subj: 'Spørsmål om fotograferingen på onsdag', folder: 'inbox', labels: ['Bolig'], job: 'B-2611', unread: true, msgs: [
        { from: ['Anne Hauge', 'per.hauge@epost.example'], to: [ME], d: at(0, '08:31'), html: p('Hei,\n\nSkal vi rydde bort alt på kjøkkenbenken, eller kan kaffemaskinen stå?\n\nOg trenger vi å være hjemme?\n\nHilsen Anne') }] },
      { id: 't3', subj: 'Re: Loftsgata 5 · plantegning', folder: 'inbox', labels: ['Bolig'], job: 'B-2605', unread: false, star: true, msgs: [
        { from: ME, to: [['Kari Lunde', 'kari.lunde@fjordmegling.example']], d: at(-2, '15:10'), html: p('Hei Kari,\n\nBildene og plantegningen ligger klare i portalen. Si fra om noe skal endres.\n\nMvh\nAleksander') },
        { from: ['Kari Lunde', 'kari.lunde@fjordmegling.example'], to: [ME], d: at(-1, '09:05'), html: p('Takk! Selger mener det minste soverommet i 2. etasje egentlig er et kontor. Kan dere endre det?\n\nKari') }] },
      { id: 't4', subj: 'Faktura 2026-118 fra CubiCasa', folder: 'inbox', labels: ['Faktura'], unread: false, msgs: [
        { from: ['CubiCasa Billing', 'billing@cubicasa.example'], to: [ME], d: at(-1, '06:00'), html: p('Your invoice for October is ready.\n\nAmount: 2 340 NOK\nDue: in 14 days'), att: [{ n: 'Invoice-2026-118.pdf', kb: 96 }] }] },
      { id: 't5', subj: 'Rekrutteringsfilm: tilbakemelding på v2', folder: 'inbox', labels: ['Bedrift'], unread: true, msgs: [
        { from: ['Marte Aasen', 'marte@vestkraft.example'], to: [ME], cc: [['Ola Brekke', 'ola@vestkraft.example']], d: at(-1, '16:44'), html: p('Hei Aleksander!\n\nVi er veldig fornøyde med v2. To små ting:\n\n1. Kan logoen komme litt tidligere?\n2. Musikken kan være litt lavere under intervjuet.\n\nMvh Marte') }] },
      { id: 't6', subj: 'Fotodag Fjordtun: spørsmål fra foresatt', folder: 'inbox', labels: ['Skole'], unread: false, msgs: [
        { from: ['Linn Haugland', 'linn.haugland@epost.example'], to: [ME], d: at(-2, '20:12'), html: p('Hei! Emma var syk på fotodagen. Kan hun bli med på omfotograferingen?\n\nHilsen Linn') },
        { from: ME, to: [['Linn Haugland', 'linn.haugland@epost.example']], d: at(-1, '08:15'), html: p('Hei Linn,\n\nJa, Emma står på listen til omfotograferingen. Du får tid på e-post.\n\nMvh\nStudiovest') }] },
      { id: 't7', subj: 'Bekreftelse: Valevåg sjøhus', folder: 'archive', labels: ['Bolig'], job: 'B-2616', unread: false, msgs: [
        { from: ['Eirik Sæther', 'eirik.saether@kystmegleren.example'], to: [ME], d: at(-3, '11:20'), html: p('Hei, bekrefter oppdraget på Valevåg sjøhus. Selger Hans Valen tar imot.\n\nEirik') }] },
      { id: 't8', subj: 'Du har vunnet et gavekort!', folder: 'spam', labels: [], unread: true, msgs: [
        { from: ['Premiesenteret', 'noreply@vinn-naa.example'], to: [ME], d: at(-1, '03:14'), html: p('Klikk her for å hente premien din.') }] }
    ];
    var AC = [{ id: 'post', name: 'Studiovest', mail: 'post@studiovest.no', c: COLORS[0] }, { id: 'aleks', name: 'Aleksander Koløy', mail: 'aleksander@studiovest.no', c: COLORS[1] }, { id: 'faktura', name: 'Studiovest faktura', mail: 'faktura@studiovest.no', c: COLORS[2] }];
    T.push({ id: 't9', subj: 'Portretter av nye ansatte i januar?', folder: 'inbox', labels: ['Bedrift'], unread: true, msgs: [
      { from: ['Geir Tofte', 'geir@husnesmek.example'], to: [ME], d: at(0, '06:58'), html: p('Hei Aleksander,\n\nVi får fire nye ansatte i januar. Kan du ta portretter av dem i samme stil som sist? Gjerne en formiddag i uke 3.\n\nMvh Geir') }] });
    T.push({ id: 't10', subj: 'Innbetaling mottatt: faktura 26-1198', folder: 'inbox', labels: ['Faktura'], unread: true, msgs: [
      { from: ['Sparebanken Vest', 'varsel@spv.example'], to: [ME], d: at(0, '05:30'), html: p('Det er registrert en innbetaling på 5 875 kr med KID 2611980 fra Fjordmegling Stord.') }] });
    var map = { t4: 'faktura', t10: 'faktura', t5: 'aleks', t9: 'aleks' };
    T.forEach(function (t) { t.acct = map[t.id] || 'post'; var me = AC.filter(function (a) { return a.id === t.acct; })[0], arr = [me.name, me.mail];
      t.msgs.forEach(function (m) { if (m.from === ME) m.from = arr; m.to = (m.to || []).map(function (x) { return x === ME ? arr : x; }); }); });
    return { threads: T, seq: 20, accts: AC, cur: null, sig: 'Mvh\nAleksander Koløy\nStudiovest · 912 00 000\nstudiovest.no', auto: { on: false, from: D.W(0), to: D.W(7), text: 'Takk for e-posten. Jeg er på oppdrag og svarer så snart jeg kan.' },
      rules: [{ has: 'cubicasa', label: 'Faktura', archive: false }, { has: 'noreply@vinn', spam: true }] };
  }
  function M() { if (!SV.state.mx || !SV.state.mx.threads) SV.state.mx = seed(); return SV.state.mx; }

  // ---------- hjelpere ----------
  function last(t) { return t.msgs[t.msgs.length - 1]; }
  function sentMsgs(t) { return t.msgs.filter(function (m) { return isMe(m.from[1]) && !m.draft && !m.sched; }); }
  function isMe(e) { return accts().some(function (a) { return a.mail === e; }); }
  function others(t) { var n = []; t.msgs.forEach(function (m) { if (!m.draft && !isMe(m.from[1]) && n.indexOf(m.from[0]) < 0) n.push(m.from[0]); }); if (!n.length) (last(t).to || []).forEach(function (x) { if (n.indexOf(x[0]) < 0) n.push(x[0]); }); return n; }
  function text(html) { var d = document.createElement('div'); d.innerHTML = String(html || '').replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>/gi, '$& '); return (d.textContent || '').replace(/\s+/g, ' ').trim(); }
  function when(iso) { if (!iso) return ''; var d = iso.slice(0, 10), t = iso.slice(11, 16), n = SV.diff(d); return n === 0 ? t : n === -1 ? 'i går' : n > -7 && n < 0 ? SV.fdate(d).split(' ')[0] : SV.fdate(d); }
  function full(iso) { return SV.fdate(iso.slice(0, 10), true) + ' kl. ' + iso.slice(11, 16); }
  function job(id) { return id ? SV.find(SV.jobs(), id) : null; }
  function nowIso() { var d = new Date(); return D.iso(D.base) + 'T' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  function contacts() {
    var c = [], seen = {}; function add(n, e) { if (e && !seen[e]) { seen[e] = 1; c.push([n, e]); } }
    var DOM = { fjm: 'fjordmegling.example', kmh: 'kystmegleren.example', sue: 'sunnhordland-eiendom.example', hbm: 'hardangerbolig.example' };
    D.offices.forEach(function (o) { o.brokers.forEach(function (b) { add(b, b.toLowerCase().replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a').replace(/[^a-z]+/g, '.') + '@' + DOM[o.id]); }); });
    SV.jobs().forEach(function (j) { add(j.seller, j.email); });
    M().threads.forEach(function (t) { t.msgs.forEach(function (m) { if (!isMe(m.from[1])) add(m.from[0], m.from[1]); }); });
    return c;
  }
  // koble til prosjekt ut fra adresse i emnet eller kundens e-post
  function guessJob(subj, emails) { var js = SV.jobs(); return (js.filter(function (j) { return subj && subj.toLowerCase().indexOf(j.addr.toLowerCase()) > -1; })[0] || js.filter(function (j) { return j.email && emails.indexOf(j.email) > -1; })[0] || {}).id || null; }

  // automatiske e-poster fra CRM-et vises i «Sendt»
  function autoThreads() {
    return (SV.state.mailLog || []).filter(function (m) { return /@/.test(m.mail); }).map(function (m, i) {
      return { id: 'auto' + i, auto: true, acct: 'post', subj: m.subj, folder: 'sent', labels: ['Bolig'], job: m.id, msgs: [{ from: A('post'), to: [[m.to, m.mail]], d: D.iso(D.base) + 'T' + ((m.t || '').split(' ').pop().match(/^\d\d:\d\d$/) ? m.t.split(' ').pop() : '08:00'), html: p('Automatisk e-post fra portalen.\n\nEmne: ' + m.subj) }] };
    });
  }
  function all() { return M().threads.concat(autoThreads()); }
  function inView(t, v) {
    if (v === 'innboks') return t.folder === 'inbox';
    if (v === 'stjerne') return t.star && t.folder !== 'trash';
    if (v === 'sendt') return t.folder !== 'trash' && t.folder !== 'spam' && sentMsgs(t).length > 0;
    if (v === 'utkast') return t.msgs.some(function (m) { return m.draft; }) && t.folder !== 'trash';
    if (v === 'planlagt') return t.msgs.some(function (m) { return m.sched; });
    if (v === 'arkiv') return t.folder === 'archive';
    if (v === 'spam') return t.folder === 'spam';
    if (v === 'papirkurv') return t.folder === 'trash';
    if (v.indexOf('etikett-') === 0) return t.labels.indexOf(v.slice(8)) > -1 && t.folder !== 'trash' && t.folder !== 'spam';
    if (v.indexOf('prosjekt-') === 0) return t.job === v.slice(9) && t.folder !== 'trash';
    return true;
  }
  // søk: fritekst + fra: til: har:vedlegg er:ulest er:stjerne etikett: prosjekt:
  function match(t, q) {
    if (!q) return true;
    return q.toLowerCase().split(/\s+/).every(function (w) {
      var k = w.split(':'), hay = (t.subj + ' ' + t.msgs.map(function (m) { return m.from.join(' ') + ' ' + (m.to || []).map(function (x) { return x.join(' '); }).join(' ') + ' ' + text(m.html); }).join(' ')).toLowerCase();
      if (k.length === 2 && k[1]) {
        if (k[0] === 'fra') return t.msgs.some(function (m) { return m.from.join(' ').toLowerCase().indexOf(k[1]) > -1; });
        if (k[0] === 'til') return t.msgs.some(function (m) { return (m.to || []).some(function (x) { return x.join(' ').toLowerCase().indexOf(k[1]) > -1; }); });
        if (k[0] === 'har' && k[1] === 'vedlegg') return t.msgs.some(function (m) { return (m.att || []).length; });
        if (k[0] === 'er' && k[1] === 'ulest') return t.unread;
        if (k[0] === 'er' && k[1] === 'stjerne') return t.star;
        if (k[0] === 'etikett') return t.labels.some(function (l) { return l.toLowerCase().indexOf(k[1]) === 0; });
        if (k[0] === 'prosjekt') return (t.job || '').toLowerCase().indexOf(k[1]) > -1 || ((job(t.job) || {}).addr || '').toLowerCase().indexOf(k[1]) > -1;
      }
      return hay.indexOf(w) > -1;
    });
  }
  // ---------- bestilling fra e-post ----------
  // Tolker en bestilling i fritekst til prosjektfelt. Samme felt som e-postagenten skal levere senere:
  // { addr, town, type, nr, office, broker, services[], qty{}, seller, email, phone, note, thread, src }
  var OFFDOM = { 'fjordmegling.example': 'fjm', 'kystmegleren.example': 'kmh', 'sunnhordland-eiendom.example': 'sue', 'hardangerbolig.example': 'hbm' };
  SV.parseOrder = function (subj, body, from) {
    var txt = subj + '\n' + body, low = txt.toLowerCase(), o = { services: [], qty: {} };
    var ad = /([A-ZÆØÅ][a-zæøå]+(?:[ -][A-ZÆØÅa-zæøå]+)*?(?:vegen|veien|gata|gaten|gate|veg|vei|brygge|terrasse|sjøhus|tunet|plassen|bakken|stien|lia|haugen)\s?\d+\s?[A-Za-z]?)\b/.exec(txt);
    if (ad) o.addr = ad[1].trim();
    var tws = body.match(/\bi [A-ZÆØÅ][a-zæøå]+\b/g) || [], tw = tws.map(function (x) { return x.slice(2); }).filter(function (x) { return !o.addr || o.addr.indexOf(x) < 0; })[0]; if (tw) o.town = tw;
    var dom = (from[1].split('@')[1] || '').toLowerCase(); if (OFFDOM[dom]) { o.office = OFFDOM[dom]; var off = SV.find(D.offices, o.office); if (off.brokers.indexOf(from[0]) > -1) o.broker = from[0]; }
    o.services.push(/premium/.test(low) ? 'f40' : /\bliten\b|20 bilder/.test(low) ? 'f20' : /standard|ubegrenset/.test(low) ? 'f30' : 'f30');
    if (/tomtefoto|tomt/.test(low)) o.services.push('to');
    if (/utefoto|ute ?fotografering/.test(low)) o.services.push('ut');
    var kv = /(\d+)\s*kveldsbilde/.exec(low); if (kv || /kveldsbilde/.test(low)) { o.services.push('kv'); o.qty.kv = kv ? +kv[1] : 1; }
    var vm = /(\d+)\s*(?:bilder? (?:med )?)?virtuell/.exec(low); if (vm || /virtuell møblering|virtuelt møblert/.test(low)) { o.services.push('vm'); o.qty.vm = vm ? +vm[1] : 1; }
    if (/ekspress|haster|innen 24/.test(low)) o.services.push('ex');
    var se = /[Ss]elger (?:er|:)\s*([A-ZÆØÅ][\wæøåÆØÅ]+(?: (?:og )?[A-ZÆØÅ][\wæøåÆØÅ]+){0,3})/.exec(body); if (se) o.seller = se[1];
    var ph = /(?:\+47\s?)?\b(\d{3}\s?\d{2}\s?\d{3}|\d{8})\b/.exec(body); if (ph) o.phone = ph[1];
    var em = (body.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) || []).map(function (e) { return e.replace(/\.+$/, ''); }).filter(function (e) { return e !== from[1] && !isMe(e); })[0]; if (em) o.email = em;
    var nr = /oppdrag(?:snr|snummer)?\.?\s*:?\s*([\w-]{4,})/i.exec(body); if (nr) o.nr = nr[1];
    var ty = /(enebolig|leilighet|rekkehus|fritidsbolig|hytte|gårdsbruk)/.exec(low); if (ty) o.type = ty[1] === 'hytte' ? 'Fritidsbolig' : ty[1].charAt(0).toUpperCase() + ty[1].slice(1);
    var vis = /[Vv]isning.{0,80}?(?=\.\s+[A-ZÆØÅ]|\.?\s*$)/.exec(body); if (vis) o.note = vis[0];
    return o;
  };
  SV.on('mxOrder', function (el) {
    var t = T(el.getAttribute('data-id')), m = t.msgs.filter(function (x) { return !isMe(x.from[1]) && !x.draft; })[0] || t.msgs[0];
    var o = SV.parseOrder(t.subj, text(m.html.replace(/<\/p>|<br>/g, '\n')), m.from);
    o.thread = t.id; o.src = 'Fylt ut fra e-post fra ' + m.from[0] + ' (' + full(m.d) + ')';
    SV.crmNew(o);
  });
  SV.mailLinkJob = function (tid, jid) { var t = T(tid); if (!t) return; t.job = jid; if (t.labels.indexOf('Bolig') < 0) t.labels.push('Bolig'); SV.save(); };
  SV.mailUnread = function () { return unreadIn(); };
  SV.mailForJob = function (id) { return all().filter(function (t) { return t.job === id && t.folder !== 'trash'; }); };

  // ---------- visning ----------
  var ui = { q: '', sel: {}, filter: '' };
  function list(v) {
    var ts = all().filter(function (t) { return inAcct(t) && inView(t, v) && match(t, ui.q); });
    if (ui.filter === 'ulest') ts = ts.filter(function (t) { return t.unread; });
    if (ui.filter === 'vedlegg') ts = ts.filter(function (t) { return t.msgs.some(function (m) { return (m.att || []).length; }); });
    if (ui.filter === 'prosjekt') ts = ts.filter(function (t) { return t.job; });
    return ts.sort(function (a, b) { return last(a).d < last(b).d ? 1 : -1; });
  }
  function count(v) { return M().threads.filter(function (t) { return inAcct(t) && inView(t, v) && (v === 'innboks' || v === 'spam' ? t.unread : true); }).length; }
  function unreadIn(id) { return M().threads.filter(function (t) { return t.folder === 'inbox' && t.unread && (!id || tAcct(t) === id); }).length; }
  function boxesHtml() {
    if (accts().length < 2) return '';
    var c = curAcct(), item = function (id, label, sub, n, k) { return '<button class="mx-box' + ((c || '') === id ? ' on' : '') + '" data-act="mxAcct" data-a="' + id + '" title="' + esc(sub) + ' · tast ' + k + '">' + (id ? accDot(id, true) : '<i class="mx-dot big all" aria-hidden="true"></i>') + '<span><b>' + esc(label) + '</b><small>' + esc(sub) + '</small></span>' + (n ? '<em>' + n + '</em>' : '') + '</button>'; };
    return '<div class="mx-boxes" role="group" aria-label="Innbokser">' + item('', 'Alle innbokser', accts().length + ' kontoer', unreadIn(), 0) + accts().map(function (a, i) { return item(a.id, a.name, a.mail, unreadIn(a.id), i + 1); }).join('') + '</div>';
  }
  function sideHtml(v) {
    return boxesHtml() + '<button class="btn btn-acc mx-new" data-act="mxNew">' + ic('edit') + 'Skriv ny</button>' +
      '<nav class="mx-folders" aria-label="Mapper">' + VIEWS.map(function (x) { var n = x[0] === 'innboks' || x[0] === 'utkast' || x[0] === 'planlagt' || x[0] === 'spam' ? count(x[0]) : 0; return '<a href="#/post/' + x[0] + '" class="' + (v === x[0] ? 'on' : '') + '">' + ic(x[2]) + '<span>' + x[1] + '</span>' + (n ? '<b>' + n + '</b>' : '') + '</a>'; }).join('') +
      '<p class="mx-h">Etiketter</p>' + LABELS.map(function (l) { return '<a href="#/post/etikett-' + l[0] + '" class="' + (v === 'etikett-' + l[0] ? 'on' : '') + '">' + SV.dot(l[1]) + '<span>' + l[0] + '</span></a>'; }).join('') + '</nav>' +
      '<div class="mx-acct"><button class="link small" data-act="mxSettings">' + ic('lock') + 'Kontoer og innstillinger</button><span class="tiny muted">' + accts().length + (accts().length === 1 ? ' konto' : ' kontoer') + ' · one.com</span></div>';
  }
  function rowHtml(t, v, open) {
    var lm = last(t), att = t.msgs.some(function (m) { return (m.att || []).length; }), dr = t.msgs.some(function (m) { return m.draft; }), sc = t.msgs.filter(function (m) { return m.sched; })[0];
    var who = v === 'sendt' || v === 'utkast' || v === 'planlagt' ? 'Til: ' + (lm.to || []).map(function (x) { return x[0]; }).join(', ') : others(t).join(', ') + (t.msgs.length > 1 ? ' <span class="muted">' + t.msgs.length + '</span>' : '');
    return '<div class="mx-row' + (t.unread ? ' unread' : '') + (open === t.id ? ' on' : '') + '" data-id="' + t.id + '">' +
      '<label class="mx-cb" aria-label="Velg"><input type="checkbox" data-change="mxSel" data-id="' + t.id + '"' + (ui.sel[t.id] ? ' checked' : '') + (t.auto ? ' disabled' : '') + '></label>' +
      '<button class="mx-star' + (t.star ? ' on' : '') + '" data-act="mxStar" data-id="' + t.id + '" aria-label="' + (t.star ? 'Fjern stjerne' : 'Stjernemerk') + '"' + (t.auto ? ' disabled' : '') + '>' + ic('star') + '</button>' +
      '<a class="mx-link" href="#/post/' + v + '/' + t.id + '"><span class="mx-who">' + (dr ? '<span class="mx-draft">Utkast</span> ' : '') + who + '</span>' +
      '<span class="mx-sub"><b>' + esc(t.subj || '(uten emne)') + '</b> <span class="muted">– ' + esc(text(lm.html).slice(0, 120)) + '</span></span>' +
      '<span class="mx-meta">' + (!curAcct() && accts().length > 1 ? '<i class="mx-lab acc" title="' + esc(acct(tAcct(t)).mail) + '">' + accDot(tAcct(t)) + esc(acct(tAcct(t)).mail.split('@')[0]) + '</i>' : '') + t.labels.map(function (l) { return '<i class="mx-lab">' + esc(l) + '</i>'; }).join('') + (t.job ? '<i class="mx-lab job">' + esc((job(t.job) || {}).addr || t.job) + '</i>' : '') + (t.auto ? '<i class="mx-lab">Automatisk</i>' : '') + '</span></a>' +
      '<span class="mx-date">' + (att ? ic('file') : '') + (sc ? '<span class="mx-sched">' + ic('clock') + when(sc.sched) + '</span>' : when(lm.d)) + '</span></div>';
  }
  function msgHtml(t, m, k, openAll) {
    var lastK = t.msgs.length - 1, open = openAll || k === lastK || ui.exp[t.id + ':' + k];
    var head = '<div class="mx-mh">' + SV.avatar(m.from[0]) + '<div class="mx-mw"><b>' + esc(m.from[0]) + '</b> <span class="small muted">&lt;' + esc(m.from[1]) + '&gt;</span>' +
      (open ? '<span class="small muted mx-to">til ' + (m.to || []).map(function (x) { return esc(x[0]); }).join(', ') + ((m.cc || []).length ? ' · kopi ' + m.cc.map(function (x) { return esc(x[0]); }).join(', ') : '') + '</span>' : '<span class="small muted mx-snip">' + esc(text(m.html).slice(0, 90)) + '</span>') + '</div>' +
      '<span class="small muted mx-md">' + (m.draft ? '<span class="mx-draft">Utkast</span>' : m.sched ? '<span class="mx-sched">' + ic('clock') + 'Sendes ' + full(m.sched) + '</span>' : full(m.d)) + '</span></div>';
    if (!open) return '<button class="mx-msg closed" data-act="mxExp" data-k="' + t.id + ':' + k + '">' + head + '</button>';
    var acts = t.auto ? '' : m.draft ? '<div class="row" style="margin-top:12px"><button class="btn btn-dark btn-s" data-act="mxEditDraft" data-id="' + t.id + '" data-k="' + k + '">' + ic('edit') + 'Fortsett utkast</button><button class="btn btn-ghost btn-s" data-act="mxDelDraft" data-id="' + t.id + '" data-k="' + k + '">Slett utkast</button></div>' :
      m.sched ? '<div class="row" style="margin-top:12px"><button class="btn btn-ghost btn-s" data-act="mxUnsched" data-id="' + t.id + '" data-k="' + k + '">Avbryt planlagt sending</button><button class="btn btn-dark btn-s" data-act="mxSendNow" data-id="' + t.id + '" data-k="' + k + '">Send nå</button></div>' :
      '<div class="mx-ma"><button class="btn btn-ghost btn-xs" data-act="mxReply" data-id="' + t.id + '" data-k="' + k + '" data-m="r">' + ic('back') + 'Svar</button><button class="btn btn-ghost btn-xs" data-act="mxReply" data-id="' + t.id + '" data-k="' + k + '" data-m="a">' + ic('users') + 'Svar alle</button><button class="btn btn-ghost btn-xs" data-act="mxReply" data-id="' + t.id + '" data-k="' + k + '" data-m="f">' + ic('chev') + 'Videresend</button></div>';
    return '<article class="mx-msg">' + head + '<div class="mx-body">' + m.html + '</div>' +
      ((m.att || []).length ? '<div class="mx-atts">' + m.att.map(function (a, ai) { return '<button class="mx-att" data-act="mxAtt" data-id="' + t.id + '" data-k="' + k + '" data-a="' + ai + '">' + ic('file') + '<span><b>' + esc(a.n) + '</b><small>' + (a.kb > 1024 ? (a.kb / 1024).toFixed(1).replace('.', ',') + ' MB' : a.kb + ' kB') + '</small></span></button>'; }).join('') + '</div>' : '') + acts + '</article>';
  }
  function readHtml(t, v) {
    var j = job(t.job), list0 = list(v), i = list0.indexOf(list0.filter(function (x) { return x.id === t.id; })[0]);
    var tools = '<div class="mx-tools"><a class="btn btn-ghost btn-xs mx-back" href="#/post/' + v + '">' + ic('back') + '<span>Tilbake</span></a>' +
      (t.auto ? '' : '<button class="btn btn-ghost btn-xs" data-act="mxMove" data-id="' + t.id + '" data-f="' + (t.folder === 'archive' ? 'inbox' : 'archive') + '" title="Arkiver (e)">' + ic('box') + (t.folder === 'archive' ? 'Til innboks' : 'Arkiver') + '</button>' +
        '<button class="btn btn-ghost btn-xs" data-act="mxMove" data-id="' + t.id + '" data-f="' + (t.folder === 'trash' ? 'inbox' : 'trash') + '" title="Slett (#)">' + ic('trash') + (t.folder === 'trash' ? 'Gjenopprett' : 'Slett') + '</button>' +
        '<button class="btn btn-ghost btn-xs" data-act="mxMove" data-id="' + t.id + '" data-f="' + (t.folder === 'spam' ? 'inbox' : 'spam') + '">' + ic('shield') + (t.folder === 'spam' ? 'Ikke søppel' : 'Søppel') + '</button>' +
        '<button class="btn btn-ghost btn-xs" data-act="mxUnread" data-id="' + t.id + '" title="Merk som ulest (U)">' + ic('mail') + 'Ulest</button>' +
        '<select class="sel sel-xs" data-change="mxLabel" data-id="' + t.id + '" aria-label="Etikett"><option value="">Etikett …</option>' + LABELS.map(function (l) { return '<option value="' + l[0] + '">' + (t.labels.indexOf(l[0]) > -1 ? '✓ ' : '') + l[0] + '</option>'; }).join('') + '</select>' +
        '<button class="btn btn-ghost btn-xs" data-act="mxPrint">Skriv ut</button>') +
      '<span class="mx-nav small muted">' + (i + 1) + ' av ' + list0.length + (i > 0 ? ' <a href="#/post/' + v + '/' + list0[i - 1].id + '" aria-label="Forrige (k)">‹</a>' : '') + (i < list0.length - 1 ? ' <a href="#/post/' + v + '/' + list0[i + 1].id + '" aria-label="Neste (j)">›</a>' : '') + '</span></div>';
    var jcard = j ? '<a class="mx-job" href="#/bolig/' + j.id + '">' + ic('house') + '<span><b>' + esc(j.addr) + ', ' + esc(j.town) + '</b><small>' + esc(j.broker) + ' · ' + (SV.stIdx(j) >= 2 && SV.stIdx(j) < 4 && j.date ? SV.fdate(j.date) + ' kl. ' + j.time + ' · ' : '') + '</small></span>' + SV.chip(SV.stageOf(j)) + '</a>' :
      (t.auto ? '' : '<div class="mx-job none"><button class="btn btn-acc btn-xs" data-act="mxOrder" data-id="' + t.id + '">' + ic('plus') + 'Lag prosjekt fra e-posten</button><span class="small muted">eller</span><select class="sel sel-xs" data-change="mxLink" data-id="' + t.id + '" aria-label="Koble til prosjekt"><option value="">Koble til …</option>' + SV.jobs().map(function (x) { return '<option value="' + x.id + '">' + esc(x.addr) + '</option>'; }).join('') + '</select></div>');
    var reply = t.auto || t.folder === 'trash' ? '' : (ui.reply && ui.reply.t === t.id ? composer(ui.reply, true) : '<button class="mx-qr" data-act="mxReply" data-id="' + t.id + '" data-k="' + (t.msgs.length - 1) + '" data-m="r">' + ic('back') + 'Svar til ' + esc(others(t)[0] || '') + ' …</button>');
    return tools + '<div class="mx-read-in"><h2 class="mx-subj">' + esc(t.subj || '(uten emne)') + ' ' + t.labels.map(function (l) { return '<i class="mx-lab">' + esc(l) + '<button data-act="mxUnlabel" data-id="' + t.id + '" data-l="' + esc(l) + '" aria-label="Fjern etikett ' + esc(l) + '">×</button></i>'; }).join('') + '</h2>' + jcard +
      '<div class="mx-msgs">' + t.msgs.map(function (m, k) { return msgHtml(t, m, k, ui.printAll); }).join('') + '</div>' + reply + '</div>';
  }

  // ---------- skrive ----------
  // c = { mode: 'ny'|'r'|'a'|'f', t (tråd-id), k (meldingsnr i utkast), to, cc, bcc, subj, html, att, showCc }
  function chips(name, arr) {
    return '<div class="mx-chips" data-field="' + name + '">' + arr.map(function (x, i) { return '<span class="mx-chip" title="' + esc(x[1]) + '">' + esc(x[0] || x[1]) + '<button type="button" data-act="mxChipDel" data-f="' + name + '" data-i="' + i + '" aria-label="Fjern ' + esc(x[0] || x[1]) + '">×</button></span>'; }).join('') +
      '<input class="mx-ci" list="mxContacts" data-field="' + name + '" data-input="mxChipIn" autocomplete="off" aria-label="' + ({ to: 'Til', cc: 'Kopi', bcc: 'Blindkopi' })[name] + '" placeholder="' + (arr.length ? '' : 'Navn eller e-post') + '"></div>';
  }
  function composer(c, inline) {
    var tb = '<div class="mx-tb" role="toolbar" aria-label="Formatering"><button type="button" data-act="mxFmt" data-c="bold" aria-label="Fet"><b>F</b></button><button type="button" data-act="mxFmt" data-c="italic" aria-label="Kursiv"><i>K</i></button><button type="button" data-act="mxFmt" data-c="underline" aria-label="Understrek"><u>U</u></button><button type="button" data-act="mxFmt" data-c="insertUnorderedList" aria-label="Punktliste">• Liste</button><button type="button" data-act="mxFmt" data-c="createLink" aria-label="Lenke">' + ic('link') + '</button>' +
      '<select class="sel sel-xs" data-change="mxTpl" aria-label="Sett inn mal"><option value="">Mal …</option>' + D.templates.filter(function (x) { return x.subject !== 'SMS'; }).map(function (x) { return '<option value="' + x.id + '">' + esc(x.name) + '</option>'; }).join('') + '</select>' +
      '<label class="mx-attach">' + ic('file') + 'Vedlegg<input type="file" multiple data-change="mxFiles" hidden></label></div>';
    return '<form class="mx-comp' + (inline ? ' inline' : '') + '" id="mxComp" onsubmit="return false">' +
      (inline ? '' : '<div class="mx-ch"><b>' + ({ ny: 'Ny e-post', r: 'Svar', a: 'Svar alle', f: 'Videresend' })[c.mode] + '</b><span><button type="button" data-act="mxMin" aria-label="Minimer">–</button><button type="button" data-act="mxClose" aria-label="Lukk og lagre utkast">×</button></span></div>') +
      (accts().length > 1 ? '<div class="mx-cf"><span>Fra</span><select class="mx-from" data-change="mxFrom" aria-label="Send fra">' + accts().map(function (a) { return '<option value="' + a.id + '"' + (a.id === (c.from || accts()[0].id) ? ' selected' : '') + '>' + esc(a.name) + ' &lt;' + esc(a.mail) + '&gt;</option>'; }).join('') + '</select></div>' : '') +
      '<div class="mx-cf"><span>Til</span>' + chips('to', c.to) + (c.showCc ? '' : '<button type="button" class="link small" data-act="mxCc">Kopi/Blindkopi</button>') + '</div>' +
      (c.showCc ? '<div class="mx-cf"><span>Kopi</span>' + chips('cc', c.cc) + '</div><div class="mx-cf"><span>Blindkopi</span>' + chips('bcc', c.bcc) + '</div>' : '') +
      '<div class="mx-cf"><span>Emne</span><input class="mx-si" name="subj" value="' + esc(c.subj) + '" data-input="mxSubj" aria-label="Emne"></div>' + tb +
      '<div class="mx-ed" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Melding" data-input="mxBody">' + c.html + '</div>' +
      (c.att.length ? '<div class="mx-atts">' + c.att.map(function (a, i) { return '<span class="mx-att">' + ic('file') + '<span><b>' + esc(a.n) + '</b><small>' + a.kb + ' kB</small></span><button type="button" data-act="mxAttDel" data-i="' + i + '" aria-label="Fjern vedlegg">×</button></span>'; }).join('') + '</div>' : '') +
      '<div class="mx-cbar"><div class="mx-send"><button type="button" class="btn btn-acc" data-act="mxSend">' + ic('upload') + 'Send</button><button type="button" class="btn btn-acc mx-later" data-act="mxLaterMenu" aria-label="Send senere">' + ic('clock') + '</button>' +
      (ui.laterOpen ? '<div class="mx-menu"><button type="button" data-act="mxLater" data-w="morgen">I morgen kl. 08:00</button><button type="button" data-act="mxLater" data-w="mandag">Mandag kl. 08:00</button><label>Velg tid <input class="inp" type="datetime-local" data-change="mxLaterPick"></label></div>' : '') + '</div>' +
      '<span class="small muted" id="mxSaved">' + (c.saved ? 'Utkast lagret' : '') + '</span><button type="button" class="link small" data-act="mxDiscard">Forkast</button></div></form>';
  }
  function quote(m) { return '<br><blockquote>' + full(m.d) + ' skrev ' + esc(m.from[0]) + ':<br>' + m.html + '</blockquote>'; }
  function sigHtml() { return '<p><br></p><p class="mx-sig">' + esc(M().sig).replace(/\n/g, '<br>') + '</p>'; }
  function startReply(t, k, mode) {
    var m = t.msgs[k], to = mode === 'f' ? [] : isMe(m.from[1]) ? (m.to || []).slice() : [m.from], cc = [];
    if (mode === 'a') { (m.to || []).concat(m.cc || []).forEach(function (x) { if (!isMe(x[1]) && !to.some(function (y) { return y[1] === x[1]; })) cc.push(x); }); }
    var subj = (mode === 'f' ? 'Vs: ' : 'Sv: ') + t.subj.replace(/^(re|sv|vs|fwd?):\s*/i, '');
    return { mode: mode, t: t.id, from: tAcct(t), to: to, cc: cc, bcc: [], showCc: cc.length > 0, subj: subj, html: sigHtml() + (mode === 'f' ? '<br>---------- Videresendt melding ----------<br>Fra: ' + esc(m.from[0]) + ' &lt;' + esc(m.from[1]) + '&gt;<br>Dato: ' + full(m.d) + '<br>Emne: ' + esc(t.subj) + '<br><br>' + m.html : quote(m)), att: mode === 'f' ? (m.att || []).slice() : [] };
  }

  // ---------- side ----------
  SV.route('/post', 'studio', function () { return page('innboks', null); }, { title: 'E-post' });
  SV.route('/post/:v', 'studio', function (q) { return page(q.v, null); }, { title: 'E-post' });
  SV.route('/post/:v/:id', 'studio', function (q) { return page(q.v, q.id); }, { title: 'E-post' });
  function page(v, id) {
    var t = id ? all().filter(function (x) { return x.id === id; })[0] : null;
    if (t && t.unread) { t.unread = false; SV.save(); }
    ui.exp = ui.exp || {}; ui.v = v; ui.open = t ? t.id : null;
    var ts = list(v), title = (VIEWS.filter(function (x) { return x[0] === v; })[0] || [v, v.replace(/^etikett-|^prosjekt-/, '')])[1];
    var nsel = Object.keys(ui.sel).filter(function (k) { return ui.sel[k]; }).length;
    var bar = '<div class="mx-lbar"><label class="mx-cb" aria-label="Velg alle"><input type="checkbox" data-change="mxSelAll"' + (nsel && nsel === ts.length ? ' checked' : '') + '></label>' +
      (nsel ? '<span class="small"><b>' + nsel + '</b> valgt</span><button class="btn btn-ghost btn-xs" data-act="mxBulk" data-f="archive">' + ic('box') + 'Arkiver</button><button class="btn btn-ghost btn-xs" data-act="mxBulk" data-f="trash">' + ic('trash') + 'Slett</button><button class="btn btn-ghost btn-xs" data-act="mxBulk" data-f="read">Lest</button><button class="btn btn-ghost btn-xs" data-act="mxBulk" data-f="unread">Ulest</button><button class="btn btn-ghost btn-xs" data-act="mxBulk" data-f="spam">Søppel</button>'
        : '<button class="btn btn-ghost btn-xs" data-act="mxFetch" title="Hent ny e-post">' + ic('down') + 'Hent</button>' + ['', 'ulest', 'vedlegg', 'prosjekt'].map(function (f) { return '<button class="fbtn' + (ui.filter === f ? ' on' : '') + '" data-act="mxFilter" data-f="' + f + '">' + ({ '': 'Alle', ulest: 'Ulest', vedlegg: 'Vedlegg', prosjekt: 'Prosjekt' })[f] + '</button>'; }).join('')) + '</div>';
    var ca = curAcct(), listH = '<div class="mx-list"><div class="mx-lh"><h2>' + esc(title) + (accts().length > 1 ? '<small class="mx-lh-a">' + (ca ? accDot(ca) + esc(acct(ca).mail) : 'Alle innbokser') + '</small>' : '') + '</h2><span class="small muted">' + ts.length + '</span></div>' + bar +
      (ts.length ? ts.map(function (x) { return rowHtml(x, v, ui.open); }).join('') : '<p class="empty" style="padding:40px 16px;text-align:center">' + (ui.q ? 'Ingen treff på «' + esc(ui.q) + '».' : 'Ingen e-post her.') + '</p>') + '</div>';
    var read = '<div class="mx-read">' + (t ? readHtml(t, v) : '<div class="mx-empty">' + ic('mail') + '<p>Velg en e-post</p><p class="small muted">Hurtigtaster: <span class="kbd">c</span> skriv ny · <span class="kbd">/</span> søk · <span class="kbd">j</span> <span class="kbd">k</span> neste/forrige · <span class="kbd">?</span> alle</p></div>') + '</div>';
    var comp = ui.comp ? '<div class="mx-dock' + (ui.comp.min ? ' min' : '') + '">' + (ui.comp.min ? '<button class="mx-ch" data-act="mxMin"><b>' + esc(ui.comp.subj || 'Ny e-post') + '</b><span>▴</span></button>' : composer(ui.comp)) + '</div>' : '';
    var dl = '<datalist id="mxContacts">' + contacts().map(function (c) { return '<option value="' + esc(c[1]) + '">' + esc(c[0]) + '</option>'; }).join('') + '</datalist>';
    SV.after(function () { var s = document.getElementById('mxQ'); if (s && ui.focusQ) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); ui.focusQ = false; } var r = document.querySelector('.mx-read'); if (r) r.scrollTop = 0; });
    return '<div class="mx' + (t ? ' has-open' : '') + '"><div class="mx-top"><h1 class="h2"><span class="serif">E-post</span></h1><label class="search mx-search">' + ic('search') + '<input id="mxQ" placeholder="Søk i e-post (f.eks. fra:kari har:vedlegg)" value="' + esc(ui.q) + '" data-input="mxQ" aria-label="Søk i e-post"></label><button class="btn btn-ghost btn-s" data-act="mxKeys" aria-label="Hurtigtaster">?</button></div>' +
      '<div class="mx-grid"><aside class="mx-side">' + sideHtml(v) + '</aside>' + listH + read + '</div></div>' + comp + dl + undoBar();
  }
  function keep() { var l = document.querySelector('.mx-list'), ls = l ? l.scrollTop : 0, r = document.querySelector('.mx-read'), rs = r ? r.scrollTop : 0, y = window.scrollY; SV.render(); window.scrollTo(0, y); var l2 = document.querySelector('.mx-list'), r2 = document.querySelector('.mx-read'); if (l2) l2.scrollTop = ls; if (r2) r2.scrollTop = rs; }
  function T(id) { return M().threads.filter(function (x) { return x.id === id; })[0]; }
  function newId() { return 't' + (++M().seq); }

  // ---------- handlinger ----------
  SV.on('mxQ', function (el) { ui.q = el.value.trim(); ui.focusQ = true; keep(); });
  SV.on('mxAcct', function (el) { M().cur = el.getAttribute('data-a') || null; ui.sel = {}; SV.save(); var v = ui.v || 'innboks'; if (ui.open) SV.go('#/post/' + v); else keep(); });
  SV.on('mxFilter', function (el) { ui.filter = el.getAttribute('data-f'); keep(); });
  SV.on('mxStar', function (el, ev) { if (ev) ev.preventDefault(); var t = T(el.getAttribute('data-id')); if (!t) return; t.star = !t.star; SV.save(); keep(); });
  SV.on('mxSel', function (el) { ui.sel[el.getAttribute('data-id')] = el.checked; keep(); });
  SV.on('mxSelAll', function (el) { ui.sel = {}; if (el.checked) list(ui.v).forEach(function (t) { if (!t.auto) ui.sel[t.id] = true; }); keep(); });
  function move(t, f) { if (f === 'read') t.unread = false; else if (f === 'unread') t.unread = true; else t.folder = f; }
  SV.on('mxBulk', function (el) {
    var f = el.getAttribute('data-f'), ids = Object.keys(ui.sel).filter(function (k) { return ui.sel[k]; });
    ids.forEach(function (id) { var t = T(id); if (t) move(t, f); }); ui.sel = {}; SV.save(); keep();
    SV.toast(ids.length + ' ' + ({ archive: 'arkivert', trash: 'slettet', read: 'merket som lest', unread: 'merket som ulest', spam: 'flyttet til søppelpost' })[f]);
  });
  SV.on('mxMove', function (el) {
    var t = T(el.getAttribute('data-id')), f = el.getAttribute('data-f'); if (!t) return; var was = t.folder; t.folder = f; SV.save();
    ui.undo = { msg: ({ archive: 'Arkivert', trash: 'Slettet', inbox: 'Flyttet til innboks', spam: 'Flyttet til søppelpost' })[f], fn: function () { t.folder = was; } };
    SV.go('#/post/' + ui.v); armUndo();
  });
  SV.on('mxUnread', function (el) { var t = T(el.getAttribute('data-id')); t.unread = true; SV.save(); SV.go('#/post/' + ui.v); });
  SV.on('mxLabel', function (el) { var t = T(el.getAttribute('data-id')), l = el.value; if (!l) return; var i = t.labels.indexOf(l); if (i > -1) t.labels.splice(i, 1); else t.labels.push(l); SV.save(); keep(); });
  SV.on('mxUnlabel', function (el) { var t = T(el.getAttribute('data-id')); t.labels.splice(t.labels.indexOf(el.getAttribute('data-l')), 1); SV.save(); keep(); });
  SV.on('mxLink', function (el) { var t = T(el.getAttribute('data-id')); t.job = el.value || null; if (t.job && t.labels.indexOf('Bolig') < 0) t.labels.push('Bolig'); SV.save(); keep(); SV.toast('Koblet til ' + (job(t.job) || {}).addr); });
  SV.on('mxExp', function (el) { ui.exp[el.getAttribute('data-k')] = true; keep(); });
  SV.on('mxAtt', function (el) {
    var t = all().filter(function (x) { return x.id === el.getAttribute('data-id'); })[0], a = t.msgs[+el.getAttribute('data-k')].att[+el.getAttribute('data-a')];
    if (a.url) { var l = document.createElement('a'); l.href = a.url; l.download = a.n; l.click(); return; }
    SV.modal('<p class="eyebrow">Vedlegg</p><h2 class="h2"><span class="serif">' + esc(a.n) + '</span></h2><div class="mx-prev">' + ic('file') + '<p class="small muted">Forhåndsvisning av PDF og bilder åpnes her i den ekte portalen.</p></div><div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn btn-dark" data-act="dummy">' + ic('down') + 'Last ned</button></div>');
  });
  SV.on('mxPrint', function () { ui.printAll = true; SV.render(); setTimeout(function () { window.print(); ui.printAll = false; }, 50); });
  SV.on('mxFetch', function () {
    var m = M(), id = newId(), t = { id: id, acct: 'post', subj: 'Nøkkel til Ølve terrasse 12', folder: 'inbox', labels: [], unread: true, msgs: [{ from: ['Stine Nygård', 'stine.nygard@epost.example'], to: [A('post')], d: nowIso(), html: p('Hei!\n\nNøkkelen ligger i nøkkelboksen ved inngangen, koden er sendt på SMS.\n\nStine') }] };
    t.job = guessJob(t.subj, ['stine.nygard@epost.example']); if (t.job) t.labels.push('Bolig');
    applyRules(t);
    if (m.threads.some(function (x) { return x.subj === t.subj; })) { SV.toast('Ingen ny e-post'); return; }
    m.threads.unshift(t); SV.save(); keep(); SV.toast('1 ny e-post' + (t.job ? ' · koblet til ' + job(t.job).addr : ''));
    if (m.auto.on) autoReply(t);
  });
  function applyRules(t) { M().rules.forEach(function (r) { var f = last(t).from.join(' ').toLowerCase(); if (r.has && f.indexOf(r.has.toLowerCase()) > -1) { if (r.label && t.labels.indexOf(r.label) < 0) t.labels.push(r.label); if (r.archive) t.folder = 'archive'; if (r.spam) t.folder = 'spam'; } }); }
  function autoReply(t) { var a = M().auto; t.msgs.push({ from: A(tAcct(t)), to: [last(t).from], d: nowIso(), html: p(a.text) }); SV.save(); }

  // skriv ny / svar
  SV.on('mxNew', function () { ui.comp = { mode: 'ny', from: curAcct() || accts()[0].id, to: [], cc: [], bcc: [], subj: '', html: sigHtml(), att: [] }; keep(); focusTo(); });
  SV.on('mxReply', function (el) { var t = all().filter(function (x) { return x.id === el.getAttribute('data-id'); })[0]; ui.reply = startReply(t, +el.getAttribute('data-k'), el.getAttribute('data-m')); keep(); setTimeout(function () { var e = document.querySelector('.mx-comp.inline .mx-ed'); if (e) { e.focus(); var r = document.createRange(); r.setStart(e, 0); r.collapse(true); var s = getSelection(); s.removeAllRanges(); s.addRange(r); e.scrollIntoView({ block: 'nearest' }); } }, 30); });
  function focusTo() { setTimeout(function () { var i = document.querySelector('.mx-dock .mx-ci'); if (i) i.focus(); }, 30); }
  function C() { return ui.reply || ui.comp; }
  function sync() { var c = C(), f = document.getElementById('mxComp'); if (!c || !f) return; c.subj = f.subj.value; var e = f.querySelector('.mx-ed'); if (e) c.html = e.innerHTML; }
  function parseAddr(v) { v = v.trim().replace(/[,;]$/, ''); if (!v) return null; var hit = contacts().filter(function (x) { return x[1].toLowerCase() === v.toLowerCase() || x[0].toLowerCase() === v.toLowerCase(); })[0]; if (hit) return hit; return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? [v.split('@')[0], v] : null; }
  SV.on('mxChipIn', function (el) {
    var v = el.value; if (!/[,;]$/.test(v) && !contacts().some(function (x) { return x[1] === v.trim(); })) return;
    var a = parseAddr(v); if (!a) return; sync(); C()[el.getAttribute('data-field')].push(a); var f = el.getAttribute('data-field'); keep();
    setTimeout(function () { var i = document.querySelector('#mxComp .mx-ci[data-field=' + f + ']'); if (i) i.focus(); }, 20);
  });
  document.addEventListener('keydown', function (e) {
    var el = e.target; if (!el.classList || !el.classList.contains('mx-ci')) return;
    if ((e.key === 'Enter' || e.key === 'Tab') && el.value.trim()) { var a = parseAddr(el.value); if (a) { e.preventDefault(); sync(); C()[el.getAttribute('data-field')].push(a); var f = el.getAttribute('data-field'); keep(); setTimeout(function () { var i = document.querySelector('#mxComp .mx-ci[data-field=' + f + ']'); if (i) i.focus(); }, 20); } else if (e.key === 'Enter') { e.preventDefault(); SV.toast('Ugyldig e-postadresse', 'warn'); } }
    if (e.key === 'Backspace' && !el.value) { var arr = C()[el.getAttribute('data-field')]; if (arr.length) { sync(); arr.pop(); var f2 = el.getAttribute('data-field'); keep(); setTimeout(function () { var i = document.querySelector('#mxComp .mx-ci[data-field=' + f2 + ']'); if (i) i.focus(); }, 20); } }
  });
  // første gang man klikker i meldingsfeltet: skriv over signaturen, ikke etter den
  function caretStart(ed) {
    if (ed.dataset.started) return; ed.dataset.started = '1';
    if (text(ed.innerHTML).replace(/\s/g, '') !== text(sigHtml()).replace(/\s/g, '') && !ed.querySelector('blockquote')) return;
    var first = ed.querySelector('p') || ed, r = document.createRange(); r.setStart(first, 0); r.collapse(true); var sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
  }
  document.addEventListener('click', function (e) { var ed = e.target.closest && e.target.closest('.mx-ed'); if (ed) caretStart(ed); });
  document.addEventListener('focusin', function (e) { var ed = e.target; if (ed.classList && ed.classList.contains('mx-ed')) setTimeout(function () { caretStart(ed); }, 0); });
  SV.on('mxChipDel', function (el) { sync(); C()[el.getAttribute('data-f')].splice(+el.getAttribute('data-i'), 1); keep(); });
  SV.on('mxCc', function () { sync(); C().showCc = true; keep(); });
  var saveT = null;
  function autosave() { clearTimeout(saveT); saveT = setTimeout(function () { sync(); var c = C(); if (!c) return; saveDraft(c); var s = document.getElementById('mxSaved'); if (s) s.textContent = 'Utkast lagret ' + nowIso().slice(11); }, 900); }
  SV.on('mxFrom', function (el) { sync(); var c = C(); if (c) { c.from = el.value; autosave(); } });
  SV.on('mxSubj', autosave); SV.on('mxBody', autosave);
  SV.on('mxFmt', function (el) { var c = el.getAttribute('data-c'); if (c === 'createLink') { var u = prompt('Lenke (https://…)'); if (!u || !/^https?:\/\//.test(u)) return; document.execCommand(c, false, u); } else document.execCommand(c, false, null); });
  SV.on('mxTpl', function (el) {
    var tp = SV.find(D.templates, el.value); if (!tp) return; var c = C(); sync(); var j = job(c.t ? (T(c.t) || {}).job : null);
    var map = { 'megler.fornavn': j ? j.broker.split(' ')[0] : '', adresse: j ? j.addr : '', 'selger.navn': j ? j.seller : '', 'selger.fornavn': j ? j.seller.split(' ')[0] : '', dato: j ? SV.fdate(j.date, true) : '', tid: j ? j.time : '', lenke: j ? 'portal.studiovest.no/o/' + j.id : '' };
    var body = tp.body.replace(/\{\{([\w.]+)\}\}/g, function (_, k) { return map[k] || '{{' + k + '}}'; });
    c.html = p(body) + c.html; if (!c.subj || c.mode === 'ny') c.subj = tp.subject.replace(/\{\{([\w.]+)\}\}/g, function (_, k) { return map[k] || ''; }); keep();
  });
  SV.on('mxFiles', function (el) { sync(); [].forEach.call(el.files, function (f) { C().att.push({ n: f.name, kb: Math.max(1, Math.round(f.size / 1024)), url: URL.createObjectURL(f) }); }); keep(); });
  SV.on('mxAttDel', function (el) { sync(); C().att.splice(+el.getAttribute('data-i'), 1); keep(); });
  SV.on('mxMin', function () { sync(); ui.comp.min = !ui.comp.min; keep(); });
  SV.on('mxClose', function () { sync(); if (ui.comp && (ui.comp.to.length || text(ui.comp.html).length > text(sigHtml()).length || ui.comp.subj)) { saveDraft(ui.comp); SV.toast('Lagret som utkast'); } ui.comp = null; keep(); });
  SV.on('mxDiscard', function () { var c = C(); if (c && c.draftOf) { var t = T(c.draftOf); if (t) { t.msgs.splice(c.k, 1); if (!t.msgs.length) M().threads.splice(M().threads.indexOf(t), 1); } } if (ui.reply) ui.reply = null; else ui.comp = null; SV.save(); keep(); SV.toast('Forkastet'); });
  function draftMsg(c, extra) { return Object.assign({ from: A(c.from), to: c.to.slice(), cc: c.cc.slice(), bcc: c.bcc.slice(), d: nowIso(), html: c.html, att: c.att.slice() }, extra || {}); }
  function saveDraft(c) {
    var m = M(), t;
    if (c.draftOf) { t = T(c.draftOf); if (t) { t.msgs[c.k] = draftMsg(c, { draft: true }); t.subj = c.mode === 'ny' ? c.subj : t.subj; } }
    else if (c.t) { t = T(c.t); if (!t) return; t.msgs.push(draftMsg(c, { draft: true })); c.draftOf = t.id; c.k = t.msgs.length - 1; }
    else { t = { id: newId(), acct: c.from, subj: c.subj, folder: 'inbox', labels: [], unread: false, msgs: [draftMsg(c, { draft: true })] }; t.folder = 'drafts'; m.threads.unshift(t); c.draftOf = t.id; c.k = 0; }
    c.saved = true; SV.save();
  }
  SV.on('mxEditDraft', function (el) {
    var t = T(el.getAttribute('data-id')), k = +el.getAttribute('data-k'), m = t.msgs[k];
    var c = { mode: t.msgs.length > 1 ? 'r' : 'ny', t: t.msgs.length > 1 ? t.id : null, draftOf: t.id, k: k, from: (accts().filter(function (a) { return a.mail === m.from[1]; })[0] || acct(tAcct(t))).id, to: m.to.slice(), cc: (m.cc || []).slice(), bcc: (m.bcc || []).slice(), showCc: (m.cc || []).length > 0, subj: t.subj, html: m.html, att: (m.att || []).slice() };
    if (c.t) ui.reply = Object.assign(c, { t: t.id }); else ui.comp = c; keep();
  });
  SV.on('mxDelDraft', function (el) { var t = T(el.getAttribute('data-id')); t.msgs.splice(+el.getAttribute('data-k'), 1); if (!t.msgs.length) { M().threads.splice(M().threads.indexOf(t), 1); SV.save(); SV.go('#/post/utkast'); return; } SV.save(); keep(); });

  // send (med angre i 6 sekunder) og send senere
  function deliver(c, sched) {
    var m = M(), msg = draftMsg(c, sched ? { sched: sched } : {}), t;
    if (c.draftOf) { t = T(c.draftOf); t.msgs[c.k] = msg; if (c.mode === 'ny') t.subj = c.subj; }
    else if (c.t) { t = T(c.t); t.msgs.push(msg); }
    else { t = { id: newId(), acct: c.from, subj: c.subj, folder: 'inbox', labels: [], unread: false, msgs: [msg] }; m.threads.unshift(t); }
    if (t.folder === 'drafts') t.folder = 'inbox';
    if (!t.job) { t.job = guessJob(t.subj, c.to.concat(c.cc).map(function (x) { return x[1]; })); if (t.job && t.labels.indexOf('Bolig') < 0) t.labels.push('Bolig'); }
    return { t: t, msg: msg };
  }
  function validate(c) { if (!c.to.length && !c.cc.length && !c.bcc.length) { var inp = document.querySelector('#mxComp .mx-ci[data-field=to]'), a = inp && parseAddr(inp.value); if (a) { c.to.push(a); return true; } SV.toast('Legg til minst én mottaker', 'warn'); return false; } if (!c.subj.trim() && !confirm('Sende uten emne?')) return false; return true; }
  SV.on('mxSend', function () {
    sync(); var c = C(); if (!validate(c)) return;
    var r = deliver(c), was = ui.reply ? 'reply' : 'comp';
    if (ui.reply) ui.reply = null; else ui.comp = null; SV.save();
    ui.undo = { msg: 'Sendt til ' + c.to.concat(c.cc).map(function (x) { return x[0]; }).join(', '), fn: function () { var i = r.t.msgs.indexOf(r.msg); r.msg.draft = true; if (i > -1) r.t.msgs[i] = r.msg; c.draftOf = r.t.id; c.k = i; c.saved = true; if (was === 'reply') ui.reply = c; else ui.comp = c; } };
    keep(); armUndo();
  });
  SV.on('mxLaterMenu', function () { sync(); ui.laterOpen = !ui.laterOpen; keep(); });
  function later(iso) { sync(); var c = C(); if (!validate(c)) return; ui.laterOpen = false; deliver(c, iso); if (ui.reply) ui.reply = null; else ui.comp = null; SV.save(); keep(); SV.toast('Planlagt · sendes ' + full(iso)); }
  SV.on('mxLater', function (el) { var w = el.getAttribute('data-w'), b = SV.parse(D.iso(D.base)), add = w === 'morgen' ? 1 : ((8 - b.getDay()) % 7 || 7); later(D.W(add) + 'T08:00'); });
  SV.on('mxLaterPick', function (el) { if (el.value) later(el.value.slice(0, 16)); });
  SV.on('mxUnsched', function (el) { var t = T(el.getAttribute('data-id')), m = t.msgs[+el.getAttribute('data-k')]; delete m.sched; m.draft = true; SV.save(); keep(); SV.toast('Flyttet til utkast'); });
  SV.on('mxSendNow', function (el) { var t = T(el.getAttribute('data-id')), m = t.msgs[+el.getAttribute('data-k')]; delete m.sched; m.d = nowIso(); SV.save(); keep(); SV.toast('Sendt'); });

  // angre-linje
  var undoTimer = null;
  function undoBar() { return ui.undo ? '<div class="mx-undo" role="status"><span>' + esc(ui.undo.msg) + '</span><button data-act="mxUndo">Angre</button></div>' : ''; }
  function armUndo() { clearTimeout(undoTimer); undoTimer = setTimeout(function () { ui.undo = null; var u = document.querySelector('.mx-undo'); if (u) u.remove(); }, 6000); }
  SV.on('mxUndo', function () { if (!ui.undo) return; ui.undo.fn(); ui.undo = null; SV.save(); keep(); SV.toast('Angret'); });

  // innstillinger: konto, signatur, autosvar, regler
  SV.on('mxSettings', function () {
    var m = M();
    SV.modal('<p class="eyebrow">E-post</p><h2 class="h2"><span class="serif">Konto og innstillinger</span></h2>' +
      '<div class="card pad" style="margin-top:14px"><h3 class="h3">Kontoer</h3><p class="small muted" style="margin:4px 0 10px">Alle bruker imap.one.com (port 993) og send.one.com (port 465), SSL/TLS. Passord lagres bare på serveren, aldri i nettleseren.</p>' +
        '<ul class="mx-alist">' + accts().map(function (a, i) { return '<li>' + accDot(a.id, true) + '<span><b>' + esc(a.name) + '</b><small>' + esc(a.mail) + '</small></span><span class="tiny muted">Tast ' + (i + 1) + '</span>' + (accts().length > 1 ? '<button type="button" class="link small" data-act="mxAcctDel" data-a="' + a.id + '">Fjern</button>' : '') + '</li>'; }).join('') + '</ul>' +
        '<div class="g3" style="gap:8px;margin-top:10px"><label class="fld"><span>Navn</span><input class="inp" id="mxAN" placeholder="f.eks. Studiovest bolig"></label><label class="fld"><span>E-postadresse</span><input class="inp" id="mxAM" type="email" placeholder="bolig@studiovest.no"></label><label class="fld"><span>Passord</span><input class="inp" id="mxAP" type="password" autocomplete="new-password" placeholder="Fra one.com"></label></div>' +
        '<div class="row" style="justify-content:flex-end"><button type="button" class="btn btn-ghost btn-s" data-act="mxAcctAdd">' + ic('plus') + 'Legg til konto</button></div></div>' +
      '<form id="mxSet" onsubmit="return false"><label class="fld" style="margin-top:14px"><span>Signatur</span><textarea class="txt" name="sig" rows="4">' + esc(m.sig) + '</textarea></label>' +
      '<div class="card pad" style="margin-top:6px"><label class="opt nobox" style="padding:0"><input type="checkbox" name="auto"' + (m.auto.on ? ' checked' : '') + '><b>Automatisk svar (fravær)</b></label><div class="g2" style="margin-top:8px"><label class="fld"><span>Fra</span><input class="inp" type="date" name="af" value="' + m.auto.from + '"></label><label class="fld"><span>Til</span><input class="inp" type="date" name="at" value="' + m.auto.to + '"></label></div><label class="fld"><span>Tekst</span><textarea class="txt" name="atext" rows="2">' + esc(m.auto.text) + '</textarea></label></div>' +
      '<div class="card pad" style="margin-top:12px"><h3 class="h3">Regler</h3><p class="small muted" style="margin:4px 0 8px">Brukes på ny e-post.</p><ul class="feed small">' + m.rules.map(function (r, i) { return '<li>' + ic('bolt') + '<span>Fra inneholder «' + esc(r.has) + '» → ' + (r.spam ? 'søppelpost' : (r.label ? 'etikett ' + esc(r.label) : '') + (r.archive ? ', arkiver' : '')) + '</span><button type="button" class="link small" data-act="mxRuleDel" data-i="' + i + '">Fjern</button></li>'; }).join('') + '</ul>' +
      '<div class="g3" style="gap:8px;margin-top:8px"><label class="fld"><span>Fra inneholder</span><input class="inp" name="rhas" placeholder="f.eks. cubicasa"></label><label class="fld"><span>Etikett</span><select class="sel" name="rlab"><option value="">–</option>' + LABELS.map(function (l) { return '<option>' + l[0] + '</option>'; }).join('') + '</select></label><label class="fld"><span>Og</span><select class="sel" name="ract"><option value="">bli i innboks</option><option value="archive">arkiver</option><option value="spam">søppelpost</option></select></label></div><button type="button" class="btn btn-ghost btn-xs" data-act="mxRuleAdd">' + ic('plus') + 'Legg til regel</button></div>' +
      '<div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn btn-dark" data-act="mxSetSave">Lagre</button></div></form>', { wide: true });
  });
  SV.on('mxAcctAdd', function () {
    var n = document.getElementById('mxAN').value.trim(), e = document.getElementById('mxAM').value.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) { SV.toast('Skriv en gyldig e-postadresse', 'warn'); return; }
    if (accts().some(function (a) { return a.mail === e; })) { SV.toast('Kontoen finnes allerede', 'warn'); return; }
    var m = M(), id = 'a' + (++m.seq); accts().push({ id: id, name: n || e.split('@')[0], mail: e, c: COLORS[accts().length % COLORS.length] });
    SV.save(); SV.close(); SV.act('mxSettings'); SV.toast('Konto lagt til: ' + e);
  });
  SV.on('mxAcctDel', function (el) {
    var id = el.getAttribute('data-a'), a = acct(id), n = M().threads.filter(function (t) { return tAcct(t) === id; }).length;
    if (!confirm('Fjerne ' + a.mail + ' fra portalen? ' + n + ' tråder skjules. E-posten blir liggende på one.com.')) return;
    var m = M(); m.accts = accts().filter(function (x) { return x.id !== id; }); m.threads = m.threads.filter(function (t) { return t.acct !== id; }); if (m.cur === id) m.cur = null;
    SV.save(); SV.close(); keep(); SV.act('mxSettings');
  });
  SV.on('mxRuleAdd', function () { var f = document.getElementById('mxSet'); if (!f.rhas.value.trim()) { SV.toast('Skriv hva avsenderen skal inneholde', 'warn'); return; } M().rules.push({ has: f.rhas.value.trim(), label: f.rlab.value, archive: f.ract.value === 'archive', spam: f.ract.value === 'spam' }); SV.save(); SV.close(); SV.act('mxSettings'); });
  SV.on('mxRuleDel', function (el) { M().rules.splice(+el.getAttribute('data-i'), 1); SV.save(); SV.close(); SV.act('mxSettings'); });
  SV.on('mxSetSave', function () { var f = document.getElementById('mxSet'), m = M(); m.sig = f.sig.value; m.auto = { on: f.auto.checked, from: f.af.value, to: f.at.value, text: f.atext.value }; SV.save(); SV.close(); keep(); SV.toast('Lagret'); });

  // hurtigtaster
  var KEYS = [['1–9', 'Bytt innboks'], ['0', 'Alle innbokser'], ['c', 'Skriv ny'], ['/', 'Søk'], ['j / k', 'Neste / forrige'], ['o eller Enter', 'Åpne'], ['u', 'Tilbake til listen'], ['r', 'Svar'], ['a', 'Svar alle'], ['f', 'Videresend'], ['e', 'Arkiver'], ['#', 'Slett'], ['s', 'Stjerne'], ['Shift + U', 'Merk som ulest'], ['Ctrl + Enter', 'Send']];
  SV.on('mxKeys', function () { SV.modal('<h2 class="h2"><span class="serif">Hurtigtaster</span></h2><dl class="kv" style="margin-top:14px">' + KEYS.map(function (k) { return '<dt><span class="kbd">' + esc(k[0]) + '</span></dt><dd>' + k[1] + '</dd>'; }).join('') + '</dl>'); });
  document.addEventListener('keydown', function (e) {
    if (location.hash.indexOf('#/post') !== 0) return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && document.getElementById('mxComp')) { e.preventDefault(); SV.act('mxSend'); return; }
    var tg = e.target; if (tg.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(tg.tagName) || e.ctrlKey || e.metaKey || e.altKey || document.querySelector('.modal')) return;
    var ts = list(ui.v), i = ts.map(function (t) { return t.id; }).indexOf(ui.open), t = ui.open ? all().filter(function (x) { return x.id === ui.open; })[0] : null;
    var go = function (x) { if (x) SV.go('#/post/' + ui.v + '/' + x.id); };
    if (/^[0-9]$/.test(e.key) && accts().length > 1) { var n = +e.key; if (n === 0 || accts()[n - 1]) { SV.act('mxAcct', { 'data-a': n ? accts()[n - 1].id : '' }); } return; }
    if (e.key === 'c') { e.preventDefault(); SV.act('mxNew'); }
    else if (e.key === '/') { e.preventDefault(); var q = document.getElementById('mxQ'); if (q) q.focus(); }
    else if (e.key === 'j') go(ts[Math.min(ts.length - 1, i + 1)] || ts[0]);
    else if (e.key === 'k') go(ts[Math.max(0, i - 1)]);
    else if ((e.key === 'o' || e.key === 'Enter') && !t) go(ts[0]);
    else if (e.key === 'u' && t) SV.go('#/post/' + ui.v);
    else if (e.key === 'U' && t && !t.auto) { t.unread = true; SV.save(); SV.go('#/post/' + ui.v); }
    else if (t && !t.auto && (e.key === 'r' || e.key === 'a' || e.key === 'f')) { e.preventDefault(); ui.reply = startReply(t, t.msgs.length - 1, e.key); keep(); }
    else if (t && !t.auto && e.key === 'e') SV.act('mxMove', { 'data-id': t.id, 'data-f': t.folder === 'archive' ? 'inbox' : 'archive' });
    else if (t && !t.auto && e.key === '#') SV.act('mxMove', { 'data-id': t.id, 'data-f': 'trash' });
    else if (t && !t.auto && e.key === 's') { t.star = !t.star; SV.save(); keep(); }
    else if (e.key === '?') SV.act('mxKeys');
  });
  // kjør en handling uten et element (hurtigtaster)
  SV.act = SV.act || function (name, attrs) { var el = document.createElement('button'); Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, attrs[k]); }); var fn = SV.acts[name]; if (fn) fn(el); };

  // planlagte e-poster «sendes» når tiden er passert (sjekkes når siden tegnes)
  setInterval(function () { var n = nowIso(), ch = false; (SV.state.mx || { threads: [] }).threads.forEach(function (t) { t.msgs.forEach(function (m) { if (m.sched && m.sched <= n) { m.d = m.sched; delete m.sched; ch = true; } }); }); if (ch) { SV.save(); if (location.hash.indexOf('#/post') === 0) keep(); } }, 30000);
})();
