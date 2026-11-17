/* Bolig-CRM: startside med status, nye prosjekter, planlagt tid, e-postvarsler, godkjenning og (privat) faktura. */
(function () {
  'use strict';
  var SV = window.SV, D = SV.data, esc = SV.esc, ic = SV.icon, ST = D.stages;
  var S = SV.state;
  S.mailLog = S.mailLog || [];
  S.inv = S.inv || { 'B-2604': { sent: true, d: D.W(-4) }, 'B-2601': { sent: true, d: D.W(-7) } };
  S.approvals = S.approvals || {};
  S.jobEdit = S.jobEdit || {};
  S.mailRules = S.mailRules || {};
  S.delivered = S.delivered || {};

  SV.stIdx = function (j) { return ST.indexOf(SV.stageOf(j)); };
  function svc(id) { return SV.find(D.boligServices, id); }
  function office(id) { return SV.find(D.offices, id); }
  function total(j) { return j.services.reduce(function (s, x) { var v = svc(x); return s + (v ? v.price : 0); }, 0); }
  function slug(s) { return s.toLowerCase().replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a').replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, ''); }
  var DOMAIN = { fjm: 'fjordmegling.example', kmh: 'kystmegleren.example', sue: 'sunnhordland-eiendom.example', hbm: 'hardangerbolig.example' };
  function brokerMail(j) { return slug(j.broker) + '@' + (DOMAIN[j.office] || 'megler.example'); }
  function clientMail(j) { return j.email || ''; }
  SV.approval = function (j) { return S.approvals[j.id] || (j.approved ? { d: j.approved, by: j.approvedBy } : null); };
  function today() { return D.iso(D.base); }
  function now() { var d = new Date(); return SV.fdate(today()) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }

  // ---------- e-postregler ----------
  // to: megler | kunde | meg (varsel i portalen)
  var RULES = [
    { k: 'opprettet_megler', stage: 'Opprettet', to: 'megler', subj: function (j) { return 'Bestilling mottatt: ' + j.addr; }, body: 'Vi har registrert oppdraget og kontakter kunden for å avtale tid.' },
    { k: 'kontaktet_megler', stage: 'Kontaktet', to: 'megler', subj: function (j) { return 'Kunden er kontaktet: ' + j.addr; }, body: 'Vi har snakket med kunden og avtaler tid for fotografering.', off: true },
    { k: 'avtalt_kunde', stage: 'Fotografering avtalt', to: 'kunde', subj: function (j) { return 'Fotografering ' + when(j) + ': ' + j.addr; }, body: 'Lenke til kundesiden: avtalt tid, hva som er bestilt og hvordan du gjør boligen klar. Bildene leveres på samme lenke. Sendes også når du legger inn e-post på et prosjekt som allerede har tid.' },
    { k: 'avtalt_megler', stage: 'Fotografering avtalt', to: 'megler', subj: function (j) { return 'Tid avtalt ' + when(j) + ': ' + j.addr; }, body: 'Tiden er avtalt med kunden.' },
    { k: 'paminn_kunde', stage: 'Fotografering avtalt', to: 'kunde', subj: function (j) { return 'Påminnelse i morgen: fotografering ' + j.addr; }, body: 'Sendes dagen før kl. 16, med sjekklisten på nytt.', later: 'dagen før' },
    { k: 'utfort_megler', stage: 'Fotografering utført', to: 'megler', subj: function (j) { return 'Fotografert: ' + j.addr; }, body: 'Boligen er fotografert. Bildene og plantegningen leveres innen avtalt frist.' },
    { k: 'levert_megler', stage: 'Oppdrag levert', to: 'megler', subj: function (j) { return 'Klart til gjennomgang: ' + j.addr; }, body: 'Bilder og plantegning er klare. Se gjennom og trykk «Godkjenn» i portalen.' },
    { k: 'levert_kunde', stage: 'Oppdrag levert', to: 'kunde', subj: function (j) { return 'Bildene av ' + j.addr + ' er klare'; }, body: 'Samme lenke som før: se bildene og plantegningen, kommenter, eller godkjenn.' },
    { k: 'levert_paminn', stage: 'Oppdrag levert', to: 'megler', subj: function (j) { return 'Påminnelse: godkjenn ' + j.addr; }, body: 'Sendes etter 3 dager hvis oppdraget ikke er godkjent.', later: 'etter 3 dager' },
    { k: 'godkjent_meg', stage: 'Godkjent', to: 'meg', subj: function (j) { return 'Godkjent: ' + j.addr; }, body: 'Varsel til deg når megler eller kunde godkjenner. Husk faktura.' },
    { k: 'godkjent_megler', stage: 'Godkjent', to: 'megler', subj: function (j) { return 'Takk! ' + j.addr + ' er godkjent'; }, body: 'Bekreftelse med lenke til nedlasting og bildelisens.' },
    { k: 'flytt', stage: '', to: 'begge', subj: function (j) { return 'Ny tid for fotografering: ' + j.addr; }, body: 'Sendes når du endrer en tid som allerede er avtalt.' }
  ];
  SV.mailRules = RULES;
  function ruleOn(r) { return S.mailRules[r.k] == null ? !r.off : S.mailRules[r.k]; }
  function when(j) { return SV.fdate(j.date, true) + ' kl. ' + j.time; }
  function recips(j, to) { return to === 'megler' ? [[j.broker, brokerMail(j)]] : to === 'kunde' ? (clientMail(j) ? [[j.seller, clientMail(j)]] : []) : to === 'begge' ? recips(j, 'megler').concat(recips(j, 'kunde')) : [['Deg', 'varsel i portalen']]; }
  function send(j, rules) {
    var sent = [];
    rules.forEach(function (r) {
      if (!ruleOn(r)) return;
      recips(j, r.to).forEach(function (p) {
        S.mailLog.unshift({ id: j.id, t: now(), to: p[0], mail: p[1], subj: r.subj(j), k: r.k, later: r.later || '' });
        if (!r.later && r.to !== 'meg') sent.push(p[0]);
      });
    });
    S.mailLog = S.mailLog.slice(0, 200);
    return sent;
  }
  SV.notify = function (j, stage) { return send(j, RULES.filter(function (r) { return r.stage === stage; })); };

  SV.setStage = function (j, s, o) {
    o = o || {}; if (!j || SV.stageOf(j) === s) return;
    S.stage[j.id] = s;
    if (s === 'Godkjent') S.approvals[j.id] = { d: today(), by: o.by || 'Studiovest' };
    else if (S.approvals[j.id]) delete S.approvals[j.id];
    if (s === 'Oppdrag levert' && !j.delivered) S.delivered[j.id] = today();
    var fresh = SV.find(SV.jobs(), j.id) || j, who = SV.notify(fresh, s);
    SV.save(); SV.render();
    if (!o.quiet) SV.toast(s + (who.length ? ' · e-post til ' + who.filter(function (x, i, a) { return a.indexOf(x) === i; }).join(' og ') : ''));
  };

  // ---------- startside ----------
  var q = '';
  function filt() { return S.crmF || 'aktive'; }
  function matches(j, f) {
    var i = SV.stIdx(j);
    if (f === 'aktive') return SV.stageOf(j) !== 'Godkjent';
    if (f === 'alle') return true;
    if (f === 'ufakt') return i >= 4 && !(S.inv[j.id] && S.inv[j.id].sent);
    return SV.stageOf(j) === f;
  }
  SV.crmDash = function (jobs) {
    var f = filt(), list = jobs.filter(function (j) { return matches(j, f); });
    if (q) list = list.filter(function (j) { return (j.addr + ' ' + j.town + ' ' + j.broker + ' ' + j.seller + ' ' + (j.email || '') + ' ' + j.nr).toLowerCase().indexOf(q) > -1; });
    list.sort(function (a, b) { var x = SV.stIdx(a), y = SV.stIdx(b); return x - y || (a.date + a.time < b.date + b.time ? -1 : 1); });
    var b = today(), wk = jobs.filter(function (j) { var d = SV.diff(j.date) - SV.diff(b); return SV.stageOf(j) === 'Fotografering avtalt' && d >= 0 && d < 7; }).length;
    var stats = '<div class="g4" style="margin-bottom:18px">' +
      SV.stat('chat', 'Skal kontaktes', jobs.filter(function (j) { return SV.stageOf(j) === 'Opprettet'; }).length, 'Status «Opprettet»') +
      SV.stat('cal', 'Fotograferinger', wk, 'Neste 7 dager') +
      SV.stat('eye', 'Venter på godkjenning', jobs.filter(function (j) { return SV.stageOf(j) === 'Oppdrag levert'; }).length, 'Megler eller kunde') +
      SV.stat('wallet', 'Ikke fakturert', jobs.filter(function (j) { return matches(j, 'ufakt'); }).length, 'Levert eller godkjent · bare du ser dette', true) + '</div>';
    var pills = '<div class="filters" style="flex-wrap:wrap">' + [['aktive', 'Aktive'], ['alle', 'Alle']].concat(ST.map(function (s) { return [s, s]; })).concat([['ufakt', 'Ikke fakturert']]).map(function (x) {
      var n = jobs.filter(function (j) { return matches(j, x[0]); }).length;
      return '<button class="fbtn' + (x[0] === f ? ' on' : '') + '" data-act="crmF" data-f="' + esc(x[0]) + '">' + esc(x[1]) + ' <span class="muted">' + n + '</span></button>';
    }).join('') + '</div>';
    var rows = list.map(function (j) {
      var i = SV.stIdx(j), o = office(j.office), inv = S.inv[j.id] || {}, ap = SV.approval(j);
      var tm = i >= 2 ? '<button class="link small" data-act="crmTime" data-id="' + j.id + '" style="white-space:nowrap">' + SV.fdate(j.date) + ' kl. ' + j.time + '</button>' : '<button class="btn btn-ghost btn-xs" data-act="crmTime" data-id="' + j.id + '">' + ic('cal') + 'Sett tid</button>';
      return '<tr><td><a href="#/bolig/' + j.id + '"><b>' + esc(j.addr) + '</b></a><small>' + esc(j.town) + ' · ' + esc(j.type) + ' · ' + esc(j.nr) + '</small></td>' +
        '<td class="hide-s">' + esc(j.broker) + '<small>' + esc(o ? o.name : '') + '</small></td>' +
        '<td class="hide-s">' + esc(j.seller) + '<small>' + (j.email ? esc(j.email) : '<button class="link" data-act="crmEdit" data-id="' + j.id + '">Legg til e-post</button>') + '</small></td>' +
        '<td class="hide-s small" style="max-width:180px">' + SV.svcShort(j) + '<small>' + SV.kr(total(j)) + '</small></td>' +
        '<td>' + tm + '</td>' +
        '<td><select class="sel crm-st crm-' + i + '" data-change="crmStage" data-id="' + j.id + '" aria-label="Status for ' + esc(j.addr) + '">' + ST.map(function (s) { return '<option' + (s === SV.stageOf(j) ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select>' + (ap ? '<small>av ' + esc(ap.by) + '</small>' : '') + (SV.reviewCount(j) ? '<small><a href="#/bolig/' + j.id + '" style="color:var(--brown);font-weight:700">' + SV.reviewCount(j) + (SV.reviewCount(j) === 1 ? ' endringsønske' : ' endringsønsker') + '</a></small>' : '') + '</td>' +
        '<td class="r"><label class="sw" title="Faktura sendt"><input type="checkbox" data-change="crmInv" data-id="' + j.id + '"' + (inv.sent ? ' checked' : '') + ' aria-label="Faktura sendt for ' + esc(j.addr) + '"><span></span></label>' + (inv.sent && inv.d ? '<small>' + SV.fdate(inv.d) + '</small>' : '') + '</td></tr>';
    }).join('');
    return stats + '<div class="row between" style="margin-bottom:10px;gap:10px;flex-wrap:wrap">' + pills + '<label class="search" style="flex:1 1 220px;max-width:320px;margin:0">' + ic('search') + '<input id="crmQ" placeholder="Søk adresse, megler, kunde" value="' + esc(q) + '" data-input="crmQ" aria-label="Søk i prosjekter"></label></div>' +
      '<div class="card tbl-w"><table class="tbl crm"><thead><tr><th>Prosjekt</th><th class="hide-s">Megler</th><th class="hide-s">Kunde</th><th class="hide-s">Produkter</th><th>Fotografering</th><th>Status</th><th class="r">Faktura <span title="Bare du ser dette">' + ic('lock') + '</span></th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="7" class="muted" style="padding:28px;text-align:center">Ingen prosjekter her.</td></tr>') + '</tbody></table></div>' +
      '<p class="hint">Endre status rett i listen. E-post sendes etter reglene under «E-postvarsler». Fakturakolonnen ser bare du, ikke megler eller kunde.</p>';
  };
  SV.on('crmF', function (el) { S.crmF = el.getAttribute('data-f'); SV.save(); keep(); });
  SV.on('crmQ', function (el) {
    q = el.value.trim().toLowerCase(); var pos = el.selectionStart; keep();
    var n = document.getElementById('crmQ'); if (n) { n.focus(); n.setSelectionRange(pos, pos); }
  });
  function keep() { var y = window.scrollY; SV.render(); window.scrollTo(0, y); }
  SV.on('crmStage', function (el) {
    var j = SV.find(SV.jobs(), el.getAttribute('data-id')), s = el.value;
    if (s === 'Fotografering avtalt' && SV.stIdx(j) < 2) { el.value = SV.stageOf(j); timeModal(j, true); return; }
    var y = window.scrollY; SV.setStage(j, s, { by: 'Studiovest' }); window.scrollTo(0, y);
  });
  SV.on('crmInv', function (el) {
    var id = el.getAttribute('data-id'); S.inv[id] = el.checked ? { sent: true, d: today() } : { sent: false }; SV.save(); keep();
    SV.toast(el.checked ? 'Markert som fakturert' : 'Markert som ikke fakturert');
  });

  // ---------- tid ----------
  function timeModal(j, toStage) {
    var has = SV.stIdx(j) >= 2;
    SV.modal('<p class="eyebrow">' + esc(j.addr) + ', ' + esc(j.town) + '</p><h2 class="h2"><span class="serif">' + (has ? 'Endre tid' : 'Avtal tid') + '</span></h2>' +
      '<form id="tmF" onsubmit="return false"><div class="g2" style="margin-top:14px"><label class="fld"><span>Dato</span><input class="inp" type="date" name="d" value="' + esc(has ? j.date : D.W(2)) + '" required></label><label class="fld"><span>Klokkeslett</span><input class="inp" type="time" name="t" step="900" value="' + esc(has ? j.time : '10:00') + '" required></label></div>' +
      '<p class="small muted">Ca. ' + String(Math.round(SV.minutes(j) / 30) / 2).replace('.', ',') + ' timer på stedet ut fra produktene. Kommer i kalenderen og i fotografens dagliste.</p>' +
      '<label class="opt" style="margin-top:12px"><input type="checkbox" name="mail" checked><b>Send e-post til kunde og megler</b><small>' + (has ? 'Ny tid' : 'Tid, adresse og sjekkliste for å gjøre boligen klar') + '</small></label>' +
      '<div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn btn-dark" data-act="crmTimeSave" data-id="' + j.id + '">' + ic('check') + 'Lagre tid</button></div></form>');
  }
  SV.timeModal = timeModal;
  SV.on('crmTime', function (el, ev) { if (ev) ev.preventDefault(); timeModal(SV.find(SV.jobs(), el.getAttribute('data-id'))); });
  SV.on('crmTimeSave', function (el) {
    var f = document.getElementById('tmF'), j = SV.find(SV.jobs(), el.getAttribute('data-id'));
    if (!f.d.value || !f.t.value) { SV.toast('Velg dato og klokkeslett', 'warn'); return; }
    var had = SV.stIdx(j) >= 2, mail = f.mail.checked, rules = S.mailRules;
    S.sellerTime = S.sellerTime || {}; S.sellerTime[j.id] = [f.d.value, f.t.value]; SV.close();
    if (!had) {
      if (!mail) { var keepR = Object.assign({}, rules); RULES.forEach(function (r) { if (r.stage === 'Fotografering avtalt') rules[r.k] = false; }); SV.setStage(j, 'Fotografering avtalt'); S.mailRules = keepR; SV.save(); }
      else SV.setStage(j, 'Fotografering avtalt');
    } else {
      var fresh = SV.find(SV.jobs(), j.id), who = mail ? send(fresh, RULES.filter(function (r) { return r.k === 'flytt'; })) : [];
      SV.save(); keep(); SV.toast('Ny tid ' + SV.fdate(f.d.value) + ' kl. ' + f.t.value + (who.length ? ' · e-post til ' + who.join(' og ') : ''));
    }
  });

  // ---------- nytt prosjekt ----------
  function projModal() {
    var groups = {}; D.boligServices.filter(function (s) { return s.on; }).forEach(function (s) { (groups[s.group] = groups[s.group] || []).push(s); });
    SV.modal('<p class="eyebrow">' + SV.dot('bolig') + 'Bolig</p><h2 class="h2"><span class="serif">Nytt prosjekt</span></h2>' +
      '<form id="npF" onsubmit="return false" style="margin-top:14px">' +
      '<p class="eyebrow" style="margin:6px 0 8px">Boligen</p><div class="g2"><label class="fld"><span>Adresse</span><input class="inp" name="addr" required placeholder="Gate og nummer"></label><label class="fld"><span>Sted</span><input class="inp" name="town" placeholder="F.eks. Leirvik"></label>' +
      '<label class="fld"><span>Boligtype</span><select class="sel" name="type"><option>Enebolig</option><option>Leilighet</option><option>Rekkehus</option><option>Fritidsbolig</option><option>Gårdsbruk</option><option>Tomt</option></select></label><label class="fld"><span>Oppdragsnummer</span><input class="inp" name="nr" placeholder="Fra megler"></label></div>' +
      '<p class="eyebrow" style="margin:14px 0 8px">Megler</p><div class="g2"><label class="fld"><span>Meglerkontor</span><select class="sel" name="office" data-change="npOffice">' + D.offices.map(function (o) { return '<option value="' + o.id + '">' + esc(o.name) + '</option>'; }).join('') + '</select></label><label class="fld"><span>Megler</span><select class="sel" name="broker" id="npBroker">' + D.offices[0].brokers.map(function (b) { return '<option>' + esc(b) + '</option>'; }).join('') + '</select></label></div>' +
      '<p class="eyebrow" style="margin:14px 0 8px">Produkter</p>' + Object.keys(groups).map(function (g) { return '<div class="opts" style="margin-bottom:8px">' + groups[g].map(function (s) { var radio = s.group === 'Foto' && s.id !== 'kv'; return '<label class="opt' + (radio ? ' radio' : '') + '"><input type="' + (radio ? 'radio' : 'checkbox') + '" name="' + (radio ? 'foto' : 's') + '" value="' + s.id + '"' + (s.id === 'f30' || s.id === 'p2' ? ' checked' : '') + ' data-change="npSum"><b>' + esc(s.name.replace(', per bilde', '')) + '</b><span class="price">' + SV.kr(s.price) + '</span></label>'; }).join('') + '</div>'; }).join('') +
      '<p class="small" style="margin:4px 0 0">Sum eks. mva: <b id="npSum" class="num"></b> <span class="muted">(listepris, kontoravtale trekkes på faktura)</span></p>' +
      '<p class="eyebrow" style="margin:16px 0 8px">Kunde (selger)</p><div class="g2"><label class="fld"><span>Navn</span><input class="inp" name="seller" placeholder="Navn"></label><label class="fld"><span>E-post</span><input class="inp" type="email" name="email" placeholder="navn@epost.no" autocomplete="off"></label><label class="fld"><span>Mobil</span><input class="inp" name="phone" inputmode="tel" placeholder="8 siffer"></label><label class="fld"><span>Tilgang</span><select class="sel" name="access"><option>Selger hjemme</option><option>Nøkkel hos megler</option><option>Nøkkelboks</option></select></label></div>' +
      '<p class="eyebrow" style="margin:14px 0 8px">Fotografering <span class="muted" style="text-transform:none;letter-spacing:0;font-weight:500">(valgfritt, kan settes senere)</span></p><div class="g2"><label class="fld"><span>Dato</span><input class="inp" type="date" name="d"></label><label class="fld"><span>Klokkeslett</span><input class="inp" type="time" name="t" step="900"></label></div>' +
      '<label class="fld"><span>Notat</span><input class="inp" name="note" placeholder="F.eks. drone avhenger av vind"></label>' +
      '<div class="stack" style="margin-top:6px"><label class="opt"><input type="checkbox" name="mailB" checked><b>Send bekreftelse til megler</b><small>«Bestilling mottatt»</small></label><label class="opt"><input type="checkbox" name="mailK" checked><b>Send e-post til kunden når tiden er satt</b><small>Tid og sjekkliste</small></label></div>' +
      '<div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn btn-acc" data-act="npSave">' + ic('plus') + 'Opprett prosjekt</button></div></form>', { wide: true, after: npSum });
  }
  function npVals() { var f = document.getElementById('npF'); return { f: f, sel: [].slice.call(f.querySelectorAll('input[name=foto]:checked,input[name=s]:checked')).map(function (x) { return x.value; }) }; }
  function npSum() { var v = npVals(), n = document.getElementById('npSum'); if (n) n.textContent = SV.kr(v.sel.reduce(function (a, id) { return a + svc(id).price; }, 0)); }
  SV.on('npSum', npSum);
  SV.on('npOffice', function (el) { var o = office(el.value); document.getElementById('npBroker').innerHTML = o.brokers.map(function (b) { return '<option>' + esc(b) + '</option>'; }).join(''); });
  SV.on('crmNew', function () { projModal(); });
  SV.on('npSave', function () {
    var v = npVals(), f = v.f;
    if (!f.addr.value.trim()) { SV.toast('Skriv inn adressen', 'warn'); f.addr.focus(); return; }
    if (!v.sel.length) { SV.toast('Velg minst ett produkt', 'warn'); return; }
    if (f.email.value && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.value.trim())) { SV.toast('Sjekk e-postadressen', 'warn'); f.email.focus(); return; }
    var timed = f.d.value && f.t.value, n = S.newJobs.length, id = 'B-' + (2620 + n);
    var j = { id: id, addr: f.addr.value.trim(), town: f.town.value.trim() || 'Leirvik', office: f.office.value, broker: f.broker.value, nr: f.nr.value.trim() || '–', stage: 'Opprettet', date: timed ? f.d.value : D.W(3), time: timed ? f.t.value : '10:00', services: v.sel, seller: f.seller.value.trim() || 'Kunde', email: f.email.value.trim(), phone: f.phone.value.trim() || '–', access: f.access.value, type: f.type.value, cover: [D.img.stue, D.img.kjokken, D.img.tomanns, D.img.loft][n % 4], by: 'ak', wish: f.note.value.trim(), created: today() };
    S.newJobs.push(j);
    var who = f.mailB.checked ? send(j, RULES.filter(function (r) { return r.k === 'opprettet_megler'; })) : [];
    SV.close();
    if (timed) {
      if (!f.mailK.checked) { var keepR = Object.assign({}, S.mailRules); S.mailRules.avtalt_kunde = false; SV.setStage(j, 'Fotografering avtalt'); S.mailRules = keepR; SV.save(); }
      else SV.setStage(j, 'Fotografering avtalt');
    } else { SV.save(); SV.render(); SV.toast('Prosjekt opprettet' + (who.length ? ' · bekreftelse til ' + who[0] : '')); }
  });

  // ---------- rediger kunde ----------
  SV.on('crmEdit', function (el, ev) {
    if (ev) ev.preventDefault();
    var j = SV.find(SV.jobs(), el.getAttribute('data-id'));
    SV.modal('<p class="eyebrow">' + esc(j.addr) + '</p><h2 class="h2"><span class="serif">Kunde</span></h2><form id="ceF" onsubmit="return false" style="margin-top:14px"><div class="g2"><label class="fld"><span>Navn</span><input class="inp" name="seller" value="' + esc(j.seller) + '"></label><label class="fld"><span>E-post</span><input class="inp" type="email" name="email" value="' + esc(j.email || '') + '"></label><label class="fld"><span>Mobil</span><input class="inp" name="phone" value="' + esc(j.phone) + '"></label></div><div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn btn-dark" data-act="crmEditSave" data-id="' + j.id + '">Lagre</button></div></form>');
  });
  SV.on('crmEditSave', function (el) {
    var f = document.getElementById('ceF'), id = el.getAttribute('data-id');
    if (f.email.value && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.value.trim())) { SV.toast('Sjekk e-postadressen', 'warn'); return; }
    var before = SV.find(SV.jobs(), id), had = before.email;
    S.jobEdit[id] = { seller: f.seller.value.trim(), email: f.email.value.trim(), phone: f.phone.value.trim() };
    var j = SV.find(SV.jobs(), id), who = [];
    // e-post lagt til på et prosjekt som allerede har tid: kunden får lenken med en gang
    if (j.email && j.email !== had && SV.stIdx(j) >= 2) who = send(j, RULES.filter(function (r) { return r.k === 'avtalt_kunde'; }));
    SV.save(); SV.close(); keep(); SV.toast(who.length ? 'Lenke til kundesiden er sendt til ' + j.email : 'Kunden er oppdatert');
  });

  // ---------- godkjenning ----------
  SV.on('crmApprove', function (el) {
    var j = SV.find(SV.jobs(), el.getAttribute('data-id')), by = el.getAttribute('data-by') || 'Studiovest';
    SV.setStage(j, 'Godkjent', { by: by, quiet: true });
    SV.toast(by === 'Studiovest' ? 'Godkjent av deg · megler får bekreftelse' : 'Takk! Oppdraget er godkjent');
  });

  // ---------- CRM-kort på prosjektsiden (bare studio) ----------
  SV.crmCard = function (j) {
    var i = SV.stIdx(j), inv = S.inv[j.id] || {}, ap = SV.approval(j), log = S.mailLog.filter(function (m) { return m.id === j.id; });
    return '<div class="card"><div class="card-h"><h3>Status og kunde</h3>' + SV.chip(SV.stageOf(j)) + '</div><div class="card-b">' +
      '<label class="fld"><span>Status</span><select class="sel crm-st crm-' + i + '" data-change="crmStage" data-id="' + j.id + '">' + ST.map(function (s) { return '<option' + (s === SV.stageOf(j) ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></label>' +
      '<dl class="kv" style="margin-top:6px"><dt>Fotografering</dt><dd>' + (i >= 2 ? SV.fdate(j.date, true) + ' kl. ' + j.time + ' <button class="link small" data-act="crmTime" data-id="' + j.id + '">Endre</button>' : '<button class="btn btn-ghost btn-xs" data-act="crmTime" data-id="' + j.id + '">' + ic('cal') + 'Avtal tid</button>') + '</dd>' +
      '<dt>Kunde</dt><dd>' + esc(j.seller) + '<br><span class="small muted">' + (j.email ? esc(j.email) : 'Ingen e-post') + ' · ' + esc(j.phone) + '</span> <button class="link small" data-act="crmEdit" data-id="' + j.id + '">Endre</button></dd>' +
      '<dt>Megler</dt><dd>' + esc(j.broker) + '<br><span class="small muted">' + esc(brokerMail(j)) + '</span></dd>' +
      '<dt>Godkjent</dt><dd>' + (ap ? SV.fdate(ap.d) + ' av ' + esc(ap.by) : i === 4 ? 'Venter på megler eller kunde <button class="btn btn-ghost btn-xs" style="margin-top:6px" data-act="crmApprove" data-id="' + j.id + '" data-by="Studiovest">' + ic('check') + 'Godkjenn selv</button>' : '–') + '</dd></dl>' +
      '<div class="callout" style="margin-top:12px">' + ic('lock') + '<span style="flex:1"><b>Faktura</b> · bare du ser dette<br><span class="small muted">' + (inv.sent ? 'Sendt ' + (inv.d ? SV.fdate(inv.d) : '') : 'Ikke sendt') + '</span></span><label class="sw"><input type="checkbox" data-change="crmInv" data-id="' + j.id + '"' + (inv.sent ? ' checked' : '') + ' aria-label="Faktura sendt"><span></span></label></div>' +
      '<p class="eyebrow" style="margin:16px 0 6px">E-post sendt</p>' + (log.length ? '<ul class="feed small">' + log.slice(0, 6).map(function (m) { return '<li>' + ic('mail') + '<span><b>' + esc(m.subj) + '</b><br><span class="muted">' + esc(m.to) + (m.later ? ' · planlagt ' + esc(m.later) : '') + '</span></span><time>' + esc(m.t) + '</time></li>'; }).join('') + '</ul>' : '<p class="small muted">Ingen ennå. E-post sendes når status endres.</p>') +
      '</div></div>';
  };

  // ---------- e-postvarsler ----------
  SV.crmMails = function () {
    var rules = '<div class="card tbl-w"><table class="tbl"><thead><tr><th>Når status blir</th><th>Til</th><th>Emne</th><th class="r">På</th></tr></thead><tbody>' +
      RULES.map(function (r) { var ex = SV.jobs()[0]; return '<tr><td>' + (r.stage ? SV.chip(r.stage) : '<span class="small">Ny tid</span>') + (r.later ? '<small>' + esc(r.later) + '</small>' : '') + '</td><td>' + ({ megler: 'Megler', kunde: 'Kunde', meg: 'Deg (varsel)', begge: 'Megler og kunde' })[r.to] + '</td><td><b>' + esc(r.subj(ex)) + '</b><small>' + esc(r.body) + '</small></td><td class="r"><label class="sw"><input type="checkbox" data-change="crmRule" data-k="' + r.k + '"' + (ruleOn(r) ? ' checked' : '') + ' aria-label="' + esc(r.k) + '"><span></span></label></td></tr>'; }).join('') + '</tbody></table></div>';
    var log = '<div class="card tbl-w sec"><div class="card-h"><h3>Sendt</h3><span class="small muted">' + S.mailLog.length + '</span></div><table class="tbl"><thead><tr><th>Tid</th><th>Prosjekt</th><th>Til</th><th>Emne</th></tr></thead><tbody>' +
      (S.mailLog.length ? S.mailLog.slice(0, 40).map(function (m) { var j = SV.find(SV.jobs(), m.id); return '<tr><td class="small" style="white-space:nowrap">' + esc(m.t) + '</td><td><a href="#/bolig/' + m.id + '">' + esc(j ? j.addr : m.id) + '</a></td><td>' + esc(m.to) + '<small>' + esc(m.mail) + '</small></td><td>' + esc(m.subj) + (m.later ? '<small>Planlagt ' + esc(m.later) + '</small>' : '') + '</td></tr>'; }).join('') : '<tr><td colspan="4" class="muted" style="padding:24px;text-align:center">Ingen e-post ennå. Endre en status for å se hva som sendes.</td></tr>') + '</tbody></table></div>';
    return rules + '<p class="hint">Avsender: post@studiovest.no. Svar fra megler eller kunde havner i innboksen din og under prosjektet.</p>' + log;
  };
  SV.on('crmRule', function (el) { S.mailRules[el.getAttribute('data-k')] = el.checked; SV.save(); SV.toast(el.checked ? 'Varselet er på' : 'Varselet er av'); });
})();
