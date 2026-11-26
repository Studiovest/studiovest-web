/* Bolig-CRM: startside med status, nye prosjekter, planlagt tid, e-postvarsler, godkjenning og (privat) faktura. */
(function () {
  'use strict';
  var SV = window.SV, D = SV.data, esc = SV.esc, ic = SV.icon, ST = D.stages;
  var S = SV.state;
  SV.onState(function () {
    S.mailLog = S.mailLog || [];
    S.inv = S.inv || (SV.live ? {} : { 'B-2604': { sent: true, d: D.W(-4) }, 'B-2601': { sent: true, d: D.W(-7) } });
    S.approvals = S.approvals || {};
    S.jobEdit = S.jobEdit || {};
    S.mailRules = S.mailRules || {};
    S.delivered = S.delivered || {};
    S.postponed = S.postponed || {};
  });

  // Utefotografering har egne statuser for oppdrag med «Ekstra utefotografering». De ligger mellom «Fotografering utført» og «Oppdrag levert».
  D.outStages = ['Utefotografering avtalt', 'Utefotografering utført'];
  // «Utsatt»: fotograferingen er utsatt og ny tid er ikke avtalt. Regnes som ikke planlagt (som «Kontaktet»).
  SV.stagesFor = function (j) { var L = ST.slice(0, 2).concat(['Utsatt'], ST.slice(2)); return j && SV.hasOut(j) ? L.slice(0, 5).concat(D.outStages, L.slice(5)) : L; };
  SV.stIdx = function (j) { var s = SV.stageOf(j); return D.outStages.indexOf(s) > -1 ? 3 : s === 'Utsatt' ? 1 : ST.indexOf(s); };
  SV.colOf = function (j) { var s = SV.stageOf(j); return D.outStages.indexOf(s) > -1 ? 'Fotografering utført' : s === 'Utsatt' ? 'Kontaktet' : s; };
  SV.postInfo = function (j) { return SV.stageOf(j) === 'Utsatt' ? S.postponed[j.id] || { reason: 'Utsatt' } : null; };
  function svc(id) { return SV.find(D.boligServices, id); }
  function office(id) { return SV.find(D.offices, id); }
  function total(j) { return SV.jobTotal ? SV.jobTotal(j) : SV.svcTotal(j); }
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
    { k: 'ute_utfort', stage: 'Utefotografering utført', to: 'megler', subj: function (j) { return 'Utebildene er tatt: ' + j.addr; }, body: 'Utefotograferingen er gjort. Alt leveres samlet.' },
    { k: 'levert_megler', stage: 'Oppdrag levert', to: 'megler', subj: function (j) { return 'Klart til gjennomgang: ' + j.addr; }, body: 'Bilder og plantegning er klare. Se gjennom og trykk «Godkjenn» i portalen.' },
    { k: 'levert_kunde', stage: 'Oppdrag levert', to: 'kunde', subj: function (j) { return 'Bildene av ' + j.addr + ' er klare'; }, body: 'Samme lenke som før: se bildene og plantegningen, kommenter, eller godkjenn.' },
    { k: 'levert_paminn', stage: 'Oppdrag levert', to: 'megler', subj: function (j) { return 'Påminnelse: godkjenn ' + j.addr; }, body: 'Sendes etter 3 dager hvis oppdraget ikke er godkjent.', later: 'etter 3 dager' },
    { k: 'godkjent_meg', stage: 'Godkjent', to: 'meg', subj: function (j) { return 'Godkjent: ' + j.addr; }, body: 'Varsel til deg når megler eller kunde godkjenner. Husk faktura.' },
    { k: 'godkjent_megler', stage: 'Godkjent', to: 'megler', subj: function (j) { return 'Takk! ' + j.addr + ' er godkjent'; }, body: 'Bekreftelse med lenke til nedlasting og bildelisens.' },
    { k: 'flytt', stage: '', to: 'begge', subj: function (j) { return 'Ny tid for fotografering: ' + j.addr; }, body: 'Sendes når du endrer en tid som allerede er avtalt.' },
    { k: 'utsatt', stage: 'Utsatt', to: 'begge', subj: function (j) { return 'Fotograferingen er utsatt: ' + j.addr; }, body: 'Med årsak. Vi tar kontakt for ny tid.' },
    { k: 'ute', stage: '', to: 'begge', subj: function (j) { return 'Utefotografering ' + SV.outWhen(j) + ': ' + j.addr; }, body: 'Sendes når tiden for ekstra utefotografering settes eller endres.' }
  ];
  SV.mailRules = RULES;
  function ruleOn(r) { return S.mailRules[r.k] == null ? !r.off : S.mailRules[r.k]; }
  function when(j) { return SV.fdate(j.date, true) + ' kl. ' + j.time + (j.date2 ? ', utefoto ' + SV.outWhen(j) : ''); }
  function recips(j, to) { return to === 'megler' ? [[j.broker, brokerMail(j)]] : to === 'kunde' ? (clientMail(j) ? [[j.seller, clientMail(j)]] : []) : to === 'begge' ? recips(j, 'megler').concat(recips(j, 'kunde')) : [['Deg', 'varsel i portalen']]; }
  // Meglerens egne valg under Innstillinger → Varsler
  var MEGLER_PREF = { avtalt_megler: 'tid', flytt: 'tid', ute: 'tid', utsatt: 'tid', levert_megler: 'klar', levert_paminn: 'klar', melding: 'melding' };
  function meglerWants(k) { var g = MEGLER_PREF[k], n = (S.megler && S.megler.notif) || {}; return !g || n['mail_' + g] !== false; }
  SV.meglerWants = meglerWants;
  function send(j, rules) {
    var sent = [];
    rules.forEach(function (r) {
      if (!ruleOn(r)) return;
      recips(j, r.to).forEach(function (p) {
        if (p[1] === brokerMail(j) && !meglerWants(r.k)) return;
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
      SV.stat('chat', 'Skal kontaktes', jobs.filter(function (j) { return SV.stageOf(j) === 'Opprettet' || (SV.postInfo(j) && SV.postInfo(j).follow && SV.diff(SV.postInfo(j).follow) <= 0); }).length, 'Opprettet, eller utsatt med oppfølging i dag') +
      SV.stat('cal', 'Fotograferinger', wk, 'Neste 7 dager') +
      SV.stat('eye', 'Venter på godkjenning', jobs.filter(function (j) { return SV.stageOf(j) === 'Oppdrag levert'; }).length, 'Megler eller kunde') +
      SV.stat('wallet', 'Ikke fakturert', jobs.filter(function (j) { return matches(j, 'ufakt'); }).length, 'Levert eller godkjent · bare du ser dette', true) + '</div>';
    var pills = '<div class="filters" style="flex-wrap:wrap">' + [['aktive', 'Aktive'], ['alle', 'Alle']].concat(SV.stagesFor({ services: ['ut'] }).map(function (s) { return [s, s]; })).concat([['ufakt', 'Ikke fakturert']]).map(function (x) {
      var n = jobs.filter(function (j) { return matches(j, x[0]); }).length;
      return '<button class="fbtn' + (x[0] === f ? ' on' : '') + '" data-act="crmF" data-f="' + esc(x[0]) + '">' + esc(x[1]) + ' <span class="muted">' + n + '</span></button>';
    }).join('') + '</div>';
    var rows = list.map(function (j) {
      var i = SV.stIdx(j), o = office(j.office), inv = S.inv[j.id] || {}, ap = SV.approval(j);
      var tm = i >= 2 ? '<button class="link small" data-act="crmTime" data-id="' + j.id + '" style="white-space:nowrap">' + SV.fdate(j.date) + ' kl. ' + j.time + '</button>' : '<button class="btn btn-ghost btn-xs" data-act="crmTime" data-id="' + j.id + '">' + ic('cal') + 'Sett tid</button>';
      var pi = SV.postInfo(j); if (pi) tm = '<button class="btn btn-ghost btn-xs" data-act="crmTime" data-id="' + j.id + '">' + ic('cal') + 'Ny tid</button><small>' + esc(pi.reason) + (pi.follow ? ' · følg opp ' + SV.fdate(pi.follow) : '') + '</small>';
      else if (i >= 2 && i < 3) tm += '<small><button class="link" data-act="crmPost" data-id="' + j.id + '">Utsett</button></small>';
      if (SV.hasOut(j)) tm += '<small>' + (j.date2 ? '<button class="link" data-act="crmTime" data-id="' + j.id + '" style="white-space:nowrap">Ute: ' + SV.fdate(j.date2) + ' kl. ' + j.time2 + '</button>' : 'Ute: <button class="link" data-act="crmTime" data-id="' + j.id + '">sett tid</button>') + '</small>';
      if (i < 4 && (SV.eta(j) || i >= 2)) tm += '<small><button class="link" data-act="crmEta" data-id="' + j.id + '" style="white-space:nowrap">' + (SV.eta(j) ? 'Levering: ' + SV.fdate(SV.eta(j).d) + (SV.eta(j).t ? ' kl. ' + SV.eta(j).t : '') : '+ forventet levering') + '</button></small>';
      return '<tr><td><a href="#/bolig/' + j.id + '"><b>' + esc(j.addr) + '</b></a>' + (SV.agentCheck(j) ? ' <button class="chip chip-bad ag-chk" data-act="agentSeen" data-id="' + j.id + '" title="Laget av e-postagenten. Mangler: ' + esc((j.agent.missing || []).join(', ') || 'usikker tolkning') + '. Trykk når du har sjekket.">Sjekk bestillingen</button>' : '') + '<small>' + esc(j.town) + ' · ' + esc(j.type) + ' · ' + esc(j.nr) + '</small></td>' +
        '<td class="hide-s">' + esc(j.broker) + '<small>' + esc(o ? o.name : '') + '</small></td>' +
        '<td class="hide-s">' + esc(j.seller) + '<small>' + (j.email ? esc(j.email) : '<button class="link" data-act="crmEdit" data-id="' + j.id + '">Legg til e-post</button>') + '</small></td>' +
        '<td class="hide-s small" style="max-width:180px">' + SV.svcShort(j) + '<small>' + SV.kr(total(j)) + '</small></td>' +
        '<td>' + tm + '</td>' +
        '<td><select class="sel crm-st crm-' + i + '" data-change="crmStage" data-id="' + j.id + '" aria-label="Status for ' + esc(j.addr) + '">' + SV.stagesFor(j).map(function (s) { return '<option' + (s === SV.stageOf(j) ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select>' + (ap ? '<small>av ' + esc(ap.by) + '</small>' : '') + (SV.reviewCount(j) ? '<small><a href="#/bolig/' + j.id + '" style="color:var(--brown);font-weight:700">' + SV.reviewCount(j) + (SV.reviewCount(j) === 1 ? ' endringsønske' : ' endringsønsker') + '</a></small>' : '') + '</td>' +
        '<td class="r"><label class="sw" title="Faktura sendt"><input type="checkbox" data-change="crmInv" data-id="' + j.id + '"' + (inv.sent ? ' checked' : '') + ' aria-label="Faktura sendt for ' + esc(j.addr) + '"><span></span></label><small>' + (SV.billTo(j) === 'kunde' ? 'Til kunde' : 'Til kontor') + (inv.sent && inv.d ? ' · ' + SV.fdate(inv.d) : '') + '</small></td></tr>';
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
    if (s === 'Utefotografering avtalt' && !j.date2) { el.value = SV.stageOf(j); S.pendOut = j.id; timeModal(j, true); return; }
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
      (SV.hasOut(j) ? '<p class="eyebrow" style="margin:14px 0 8px">Ekstra utefotografering · egen tid</p><div class="g2"><label class="fld"><span>Dato</span><input class="inp" type="date" name="d2" value="' + esc(j.date2 || '') + '"></label><label class="fld"><span>Klokkeslett</span><input class="inp" type="time" name="t2" step="900" value="' + esc(j.time2 || '') + '"></label></div><p class="small muted">Kan stå tom og settes senere, f.eks. når været er bra.</p>' : '') +
      '<label class="opt" style="margin-top:12px"><input type="checkbox" name="mail" checked><b>Send e-post til kunde og megler</b><small>' + (has ? 'Ny tid' : 'Tid, adresse og sjekkliste for å gjøre boligen klar') + '</small></label>' +
      '<div class="row" style="justify-content:' + (has ? 'space-between' : 'flex-end') + ';margin-top:16px">' + (has ? '<button type="button" class="btn btn-ghost" data-act="crmPost" data-id="' + j.id + '">' + ic('clock') + 'Utsett</button>' : '') + '<button class="btn btn-dark" data-act="crmTimeSave" data-id="' + j.id + '">' + ic('check') + 'Lagre tid</button></div></form>');
  }
  SV.timeModal = timeModal;
  // ---------- utsett ----------
  var REASONS = ['Selger er ikke klar', 'Boligen er ikke klar', 'Været', 'Sykdom', 'Megler ba om det', 'Annet'];
  function postModal(j) {
    var out = SV.hasOut(j) && j.date2;
    SV.modal('<p class="eyebrow">' + esc(j.addr) + ', ' + esc(j.town) + '</p><h2 class="h2"><span class="serif">Utsett fotografering</span></h2>' +
      '<form id="poF" onsubmit="return false" style="margin-top:14px">' +
      (out ? '<p class="eyebrow" style="margin:0 0 8px">Hva utsettes?</p><div class="opts" style="margin-bottom:12px"><label class="opt radio"><input type="radio" name="what" value="main" checked><b>Hovedfotografering</b><small>' + SV.fdate(j.date, true) + ' kl. ' + j.time + '</small></label><label class="opt radio"><input type="radio" name="what" value="out"><b>Utefotografering</b><small>' + SV.outWhen(j) + '</small></label></div>' : '') +
      '<label class="fld"><span>Årsak</span><select class="sel" name="reason">' + REASONS.map(function (r) { return '<option>' + r + '</option>'; }).join('') + '</select></label>' +
      '<label class="fld"><span>Notat <span class="muted">(valgfritt, vises for megler og kunde)</span></span><input class="inp" name="note" placeholder="F.eks. oppussing på badet blir ferdig om to uker"></label>' +
      '<p class="eyebrow" style="margin:14px 0 8px">Ny tid</p><div class="opts" style="margin-bottom:10px"><label class="opt radio"><input type="radio" name="when" value="later" checked data-change="poWhen"><b>Avtales senere</b><small>Status blir «Utsatt»</small></label><label class="opt radio"><input type="radio" name="when" value="now" data-change="poWhen"><b>Ny tid nå</b><small>Status står som avtalt</small></label></div>' +
      '<div id="poLater"><label class="fld"><span>Følg opp</span><input class="inp" type="date" name="follow" value="' + D.W(7) + '"></label><p class="small muted">Du får påminnelse den dagen om å avtale ny tid.</p></div>' +
      '<div id="poNow" hidden><div class="g2"><label class="fld"><span>Ny dato</span><input class="inp" type="date" name="d"></label><label class="fld"><span>Klokkeslett</span><input class="inp" type="time" name="t" step="900" value="' + esc(j.time) + '"></label></div></div>' +
      '<label class="opt" style="margin-top:12px"><input type="checkbox" name="mail" checked><b>Send e-post til kunde og megler</b><small>Med årsak og notat</small></label>' +
      '<div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn btn-dark" data-act="crmPostSave" data-id="' + j.id + '">' + ic('clock') + 'Utsett</button></div></form>');
  }
  SV.on('crmPost', function (el, ev) { if (ev) ev.preventDefault(); SV.close(); var j = SV.find(SV.jobs(), el.getAttribute('data-id')); setTimeout(function () { postModal(j); }, 0); });
  SV.on('poWhen', function () { var f = document.getElementById('poF'), now = f.when.value === 'now'; document.getElementById('poLater').hidden = now; document.getElementById('poNow').hidden = !now; });
  SV.on('crmPostSave', function (el) {
    var f = document.getElementById('poF'), j = SV.find(SV.jobs(), el.getAttribute('data-id')), out = f.what && f.what.value === 'out', now = f.when.value === 'now', mail = f.mail.checked;
    var reason = f.reason.value, note = f.note.value.trim();
    if (now && (!f.d.value || !f.t.value)) { SV.toast('Velg ny dato og klokkeslett', 'warn'); return; }
    var log = function (subj) { if (!mail) return []; var who = []; [[j.broker, 'megler'], [j.seller, j.email || '']].forEach(function (p) { if (!p[1] && p[0] === j.seller) return; S.mailLog.unshift({ id: j.id, t: now0(), to: p[0], mail: p[1] || 'megler', subj: subj, k: 'utsatt' }); who.push(p[0]); }); return who; };
    var who, tag = reason + (note ? ' · ' + note : '');
    S.outTime = S.outTime || {}; S.sellerTime = S.sellerTime || {};
    if (out) {
      S.outTime[j.id] = now ? [f.d.value, f.t.value] : null;
      who = log('Utefotograferingen er ' + (now ? 'flyttet til ' + SV.fdate(f.d.value, true) + ' kl. ' + f.t.value : 'utsatt') + ': ' + j.addr + ' (' + tag + ')');
      if (!now && SV.stageOf(j) === 'Utefotografering avtalt') S.stage[j.id] = 'Fotografering utført';
      SV.save(); SV.close(); SV.render(); SV.toast('Utefoto ' + (now ? 'flyttet' : 'utsatt') + (who.length ? ' · e-post til ' + who.join(' og ') : '')); return;
    }
    if (now) {
      S.sellerTime[j.id] = [f.d.value, f.t.value];
      who = log('Fotograferingen er flyttet til ' + SV.fdate(f.d.value, true) + ' kl. ' + f.t.value + ': ' + j.addr + ' (' + tag + ')');
      SV.save(); SV.close(); SV.render(); SV.toast('Flyttet til ' + SV.fdate(f.d.value) + ' kl. ' + f.t.value + (who.length ? ' · e-post til ' + who.join(' og ') : '')); return;
    }
    S.postponed[j.id] = { reason: reason, note: note, follow: f.follow.value, d: D.iso(D.base), from: j.date + ' ' + j.time };
    delete S.sellerTime[j.id];
    var keep = Object.assign({}, S.mailRules); if (!mail) S.mailRules.utsatt = false;
    SV.close(); SV.setStage(j, 'Utsatt'); S.mailRules = keep; SV.save();
  });
  function now0() { var d = new Date(); return SV.fdate(D.iso(D.base)) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  SV.on('crmTime', function (el, ev) { if (ev) ev.preventDefault(); timeModal(SV.find(SV.jobs(), el.getAttribute('data-id'))); });
  SV.on('crmTimeSave', function (el) {
    var f = document.getElementById('tmF'), j = SV.find(SV.jobs(), el.getAttribute('data-id'));
    if (!f.d.value || !f.t.value) { SV.toast('Velg dato og klokkeslett', 'warn'); return; }
    // utefotografering: egen tid, kan settes nå eller senere
    var outNew = null, outChanged = false;
    if (f.d2) {
      if (!!f.d2.value !== !!f.t2.value) { SV.toast('Velg både dato og klokkeslett for utefotografering, eller la begge stå tomme', 'warn'); return; }
      S.outTime = S.outTime || {};
      outNew = f.d2.value ? [f.d2.value, f.t2.value] : null;
      outChanged = (outNew ? outNew.join(' ') : '') !== (j.date2 ? j.date2 + ' ' + j.time2 : '');
      S.outTime[j.id] = outNew;
    }
    var had = SV.stIdx(j) >= 2, mail = f.mail.checked, rules = S.mailRules;
    if (S.postponed[j.id]) delete S.postponed[j.id];
    S.sellerTime = S.sellerTime || {}; S.sellerTime[j.id] = [f.d.value, f.t.value]; SV.close();
    var wantOut = S.pendOut === j.id; delete S.pendOut;
    if (had && outNew && (wantOut || SV.stageOf(j) === 'Fotografering utført')) { SV.close(); SV.setStage(SV.find(SV.jobs(), j.id), 'Utefotografering avtalt'); return; }
    if (!had) {
      if (!mail) { var keepR = Object.assign({}, rules); RULES.forEach(function (r) { if (r.stage === 'Fotografering avtalt') rules[r.k] = false; }); SV.setStage(j, 'Fotografering avtalt'); S.mailRules = keepR; SV.save(); }
      else SV.setStage(j, 'Fotografering avtalt');
    } else {
      var fresh = SV.find(SV.jobs(), j.id), mainChanged = f.d.value + ' ' + f.t.value !== j.date + ' ' + j.time;
      var who = mail ? send(fresh, RULES.filter(function (r) { return (r.k === 'flytt' && mainChanged) || (r.k === 'ute' && outChanged && outNew); })) : [];
      SV.save(); keep(); SV.toast((mainChanged ? 'Ny tid ' + SV.fdate(f.d.value) + ' kl. ' + f.t.value : outChanged && outNew ? 'Utefoto ' + SV.fdate(outNew[0]) + ' kl. ' + outNew[1] : 'Lagret') + (who.length ? ' · e-post til ' + who.filter(function (x, i, a) { return a.indexOf(x) === i; }).join(' og ') : ''));
    }
  });

  // ---------- nytt prosjekt ----------
  // pre: forhåndsutfylling, f.eks. fra en e-postbestilling (samme felt som e-postagenten skal levere senere)
  function projModal(pre) {
    var groups = {}; D.boligServices.filter(function (s) { return s.on; }).forEach(function (s) { (groups[s.group] = groups[s.group] || []).push(s); });
    SV.modal('<p class="eyebrow">' + SV.dot('bolig') + 'Bolig</p><h2 class="h2"><span class="serif">Nytt prosjekt</span></h2>' +
      '<form id="npF" onsubmit="return false" style="margin-top:14px"><div class="callout" id="npSrc" hidden></div><p class="small muted" style="margin-bottom:6px">Ingen felt er påkrevd. Fyll inn det du vet.</p>' +
      '<p class="eyebrow" style="margin:6px 0 8px">Boligen</p><div class="g2"><label class="fld"><span>Adresse</span><input class="inp" name="addr" required placeholder="Gate og nummer"></label><label class="fld"><span>Sted</span><input class="inp" name="town" placeholder="F.eks. Leirvik"></label>' +
      '<label class="fld"><span>Boligtype</span><select class="sel" name="type"><option>Enebolig</option><option>Leilighet</option><option>Rekkehus</option><option>Fritidsbolig</option><option>Gårdsbruk</option><option>Tomt</option></select></label><label class="fld"><span>Oppdragsnummer</span><input class="inp" name="nr" placeholder="Fra megler"></label></div>' +
      '<p class="eyebrow" style="margin:14px 0 8px">Megler</p><div class="g2"><label class="fld"><span>Meglerkontor</span><select class="sel" name="office" data-change="npOffice">' + D.offices.map(function (o) { return '<option value="' + o.id + '">' + esc(o.name) + '</option>'; }).join('') + '</select></label><label class="fld"><span>Megler</span><input class="inp" name="broker" list="npBroker" placeholder="Navn" value="' + esc(D.offices[0].brokers[0] || '') + '"><datalist id="npBroker">' + D.offices[0].brokers.map(function (b) { return '<option value="' + esc(b) + '">'; }).join('') + '</datalist></label></div>' +
      '<div id="npBill">' + SV.billPick('bill', SV.billDefault(D.offices[0].id), SV.billDefault(D.offices[0].id)) + '</div>' +
      '<p class="eyebrow" style="margin:14px 0 8px">Produkter</p>' + Object.keys(groups).map(function (g) { return '<p class="small muted" style="margin:8px 0 6px;font-weight:650">' + esc(g) + '</p><div class="opts" style="margin-bottom:8px">' + groups[g].map(function (s) { return SV.svcOpt(s, 's', s.id === 'f30' || s.id === 'p2', 1, 'npSum', false); }).join('') + '</div>'; }).join('') +
      '<p class="small" style="margin:4px 0 0">Sum inkl. mva: <b id="npSum" class="num"></b> </p>' +
      '<p class="eyebrow" style="margin:16px 0 8px">Kunde (selger)</p><div class="g2"><label class="fld"><span>Navn</span><input class="inp" name="seller" placeholder="Navn"></label><label class="fld"><span>E-post</span><input class="inp" type="email" name="email" placeholder="navn@epost.no" autocomplete="off"></label><label class="fld"><span>Mobil</span><input class="inp" name="phone" inputmode="tel" placeholder="8 siffer"></label><label class="fld"><span>Tilgang</span><select class="sel" name="access"><option>Selger hjemme</option><option>Nøkkel hos megler</option><option>Nøkkelboks</option></select></label></div>' +
      '<p class="eyebrow" style="margin:14px 0 8px">Fotografering <span class="muted" style="text-transform:none;letter-spacing:0;font-weight:500">(valgfritt, kan settes senere)</span></p><div class="g2"><label class="fld"><span>Dato</span><input class="inp" type="date" name="d"></label><label class="fld"><span>Klokkeslett</span><input class="inp" type="time" name="t" step="900"></label></div>' +
      '<div id="npOut" hidden><p class="eyebrow" style="margin:14px 0 8px">Ekstra utefotografering · egen tid <span class="muted" style="text-transform:none;letter-spacing:0;font-weight:500">(valgfritt)</span></p><div class="g2"><label class="fld"><span>Dato</span><input class="inp" type="date" name="d2"></label><label class="fld"><span>Klokkeslett</span><input class="inp" type="time" name="t2" step="900"></label></div></div>' +
      '<p class="eyebrow" style="margin:14px 0 8px">Kjøring</p><label class="opt"><input type="checkbox" name="drOn" data-change="npSum"><b>Kjøresats</b><small>' + SV.driveCfg().rate + ' kr/km' + (SV.driveCfg().rt ? ' tur-retur' : '') + ' fra ' + esc(SV.driveCfg().base.split(',')[0]) + '</small></label>' +
      '<div id="npDr" hidden style="margin-top:8px"><label class="fld"><span>Km én vei</span><input class="inp" name="drKm" inputmode="numeric" placeholder="F.eks. 64" style="max-width:140px" data-input="npSum"></label></div>' +
      '<label class="fld"><span>Notat</span><input class="inp" name="note" placeholder="F.eks. drone avhenger av vind"></label>' +
      '<div class="stack" style="margin-top:6px"><label class="opt"><input type="checkbox" name="mailB" checked><b>Send bekreftelse til megler</b><small>«Bestilling mottatt»</small></label><label class="opt"><input type="checkbox" name="mailK" checked><b>Send e-post til kunden når tiden er satt</b><small>Tid og sjekkliste</small></label></div>' +
      '<div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn btn-acc" data-act="npSave">' + ic('plus') + 'Opprett prosjekt</button></div></form>', { wide: true, after: function () { if (pre) npFill(pre); npSum(); } });
  }
  function npVals() { var f = document.getElementById('npF'), sel = [].slice.call(f.querySelectorAll('input[name=foto]:checked,input[name=s]:checked')).map(function (x) { return x.value; }); return { f: f, sel: sel, qty: SV.formQty(f, sel) }; }
  function npSum() { var v = npVals(), n = document.getElementById('npSum'), o = document.getElementById('npOut'); if (o) o.hidden = v.sel.indexOf('ut') < 0; var dr = SV.driveFor({ on: v.f.drOn && v.f.drOn.checked, km: v.f.drKm ? v.f.drKm.value.replace(/\D/g, '') : 0 }), dw = document.getElementById('npDr'); if (dw) dw.hidden = !(v.f.drOn && v.f.drOn.checked);
    if (n) n.textContent = SV.kr(v.sel.reduce(function (a, id) { return a + svc(id).price * (v.qty[id] || 1); }, 0) + dr.kr) + (dr.charged ? ' (inkl. kjøring ' + SV.kr(dr.kr) + ')' : ''); }
  SV.on('npSum', npSum);
  SV.on('npOffice', function (el) { var o = office(el.value); document.getElementById('npBroker').innerHTML = o.brokers.map(function (b) { return '<option value="' + esc(b) + '">'; }).join(''); var bi = el.form && el.form.broker; if (bi && o.brokers.indexOf(bi.value) < 0) bi.value = o.brokers[0] || ''; var bw = document.getElementById('npBill'); if (bw) bw.innerHTML = SV.billPick('bill', SV.billDefault(el.value), SV.billDefault(el.value)); });
  function npFill(pre) {
    var f = document.getElementById('npF'); if (!f) return;
    ['addr', 'town', 'type', 'nr', 'seller', 'email', 'phone', 'note'].forEach(function (k) { if (pre[k] && f[k]) f[k].value = pre[k]; });
    if (pre.office) { f.office.value = pre.office; SV.acts.npOffice(f.office); }
    if (pre.broker) f.broker.value = pre.broker;
    if (pre.billTo) { var br = f.querySelector('[name=bill][value=' + pre.billTo + ']'); if (br) br.checked = true; }
    if (pre.services) { [].forEach.call(f.querySelectorAll('input[name=foto],input[name=s]'), function (x) { x.checked = pre.services.indexOf(x.value) > -1; }); Object.keys(pre.qty || {}).forEach(function (k) { var q = f.querySelector('[name=q_' + k + ']'); if (q) q.value = pre.qty[k]; }); }
    var note = document.getElementById('npSrc'); if (note && pre.src) note.innerHTML = ic('mail') + '<span>' + esc(pre.src) + '. Sjekk feltene: alt kan endres, og ingenting er påkrevd.</span>';
    if (note && pre.src) note.hidden = false;
    S.npPre = pre;
  }
  SV.crmNew = function (pre) { S.npPre = null; projModal(pre); };
  SV.on('crmNew', function () { S.npPre = null; projModal(); });
  SV.on('npSave', function () {
    var v = npVals(), f = v.f;
    if (f.email.value && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.value.trim())) { SV.toast('Sjekk e-postadressen', 'warn'); f.email.focus(); return; }
    var timed = f.d.value && f.t.value, n = S.newJobs.length, id = 'B-' + (2620 + n);
    var bsel = f.querySelector('[name=bill]:checked'), j = { id: id, billTo: bsel ? bsel.value : SV.billDefault(f.office.value), addr: f.addr.value.trim() || 'Uten adresse', town: f.town.value.trim(), office: f.office.value, broker: f.broker.value, nr: f.nr.value.trim() || '–', stage: 'Opprettet', date: timed ? f.d.value : D.W(3), time: timed ? f.t.value : '10:00', services: v.sel, qty: v.qty, seller: f.seller.value.trim() || 'Kunde', email: f.email.value.trim(), phone: f.phone.value.trim() || '–', access: f.access.value, type: f.type.value, cover: [D.img.stue, D.img.kjokken, D.img.tomanns, D.img.loft][n % 4], by: 'ak', wish: f.note.value.trim(), created: today() };
    if (v.sel.indexOf('ut') > -1 && f.d2.value && f.t2.value) { j.date2 = f.d2.value; j.time2 = f.t2.value; }
    if (S.npPre && S.npPre.thread) { j.source = 'e-post'; j.mailThread = S.npPre.thread; }
    S.newJobs.push(j);
    if (f.drOn.checked) { var km = +f.drKm.value.replace(/\D/g, ''); SV.setDrive(id, { on: !!km, km: km }); if (!km) SV.toast('Kjøresats: skriv inn km på prosjektsiden', 'warn'); }
    var who = f.mailB.checked ? send(j, RULES.filter(function (r) { return r.k === 'opprettet_megler'; })) : [];
    if (j.mailThread && SV.mailLinkJob) SV.mailLinkJob(j.mailThread, j.id);
    S.npPre = null;
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
  SV.on('crmEta', function (el) {
    var j = SV.find(SV.jobs(), el.getAttribute('data-id')), e = SV.eta(j) || {}, base = j.date && SV.diff(j.date) >= 0 ? j.date : D.iso(D.today);
    var add = function (n) { var d = SV.parse(base); d.setDate(d.getDate() + n); while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1); return D.iso(d); };
    SV.modal('<p class="eyebrow">' + esc(j.addr) + '</p><h2 class="h2"><span class="serif">Forventet levering</span></h2><p class="small muted" style="margin-top:6px">Valgfritt. Vises for megler og kunde i portalen til bildene er levert.</p>' +
      '<form id="etaF" onsubmit="return false"><div class="g2" style="gap:10px;margin-top:14px"><label class="fld"><span>Dato</span><input class="inp" type="date" name="d" value="' + (e.d || '') + '"></label><label class="fld"><span>Klokkeslett (valgfritt)</span><input class="inp" type="time" name="t" value="' + (e.t || '') + '" step="900"></label></div>' +
      '<div class="row" style="gap:6px;margin-top:4px">' + [[1, 'Dagen etter'], [2, '2 virkedager'], [3, '3 virkedager']].map(function (x) { return '<button type="button" class="fbtn" data-act="etaQ" data-d="' + add(x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div></form>' +
      '<div class="row between" style="margin-top:16px">' + (SV.eta(j) ? '<button class="link small" data-act="etaSave" data-id="' + j.id + '" data-clear="1">Fjern</button>' : '<span></span>') + '<button class="btn btn-dark" data-act="etaSave" data-id="' + j.id + '">Lagre</button></div>');
  });
  SV.on('etaQ', function (el) { document.getElementById('etaF').d.value = el.getAttribute('data-d'); });
  SV.on('etaSave', function (el) {
    var id = el.getAttribute('data-id'), f = document.getElementById('etaF'); S.eta = S.eta || {};
    if (el.getAttribute('data-clear')) S.eta[id] = null; else { if (!f.d.value) { SV.toast('Velg en dato, eller trykk Fjern', 'warn'); return; } S.eta[id] = { d: f.d.value, t: f.t.value || '' }; }
    SV.save(); SV.close(); SV.render(); SV.toast(S.eta[id] ? 'Forventet levering: ' + SV.fdate(S.eta[id].d, true) + (S.eta[id].t ? ' kl. ' + S.eta[id].t : '') : 'Forventet levering fjernet');
  });
  SV.on('billSet', function (el) { var id = el.getAttribute('data-id'); S.billTo = S.billTo || {}; S.billTo[id] = el.value; SV.save(); SV.toast('Faktura til: ' + SV.billLabel(el.value)); SV.render(); });
  SV.agentCheck = function (j) { return !!(j.agent && j.agent.status === 'sjekk'); };
  SV.on('agentSeen', function (el, ev) { if (ev) ev.preventDefault(); var j = (S.newJobs || []).filter(function (x) { return x.id === el.getAttribute('data-id'); })[0]; if (!j || !j.agent) return; j.agent.status = 'ok'; SV.save(); SV.render(); SV.toast('Markert som sjekket'); });
  SV.crmCard = function (j) {
    var i = SV.stIdx(j), inv = S.inv[j.id] || {}, ap = SV.approval(j), log = S.mailLog.filter(function (m) { return m.id === j.id; });
    return '<div class="card"><div class="card-h"><h3>Status og kunde</h3>' + SV.chip(SV.stageOf(j)) + '</div><div class="card-b">' +
      '<label class="fld"><span>Status</span><select class="sel crm-st crm-' + i + '" data-change="crmStage" data-id="' + j.id + '">' + SV.stagesFor(j).map(function (s) { return '<option' + (s === SV.stageOf(j) ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></label>' +
      '<dl class="kv" style="margin-top:6px">' + (SV.postInfo(j) ? '<dt>Utsatt</dt><dd>' + esc(SV.postInfo(j).reason) + (SV.postInfo(j).note ? '<br><span class="small muted">' + esc(SV.postInfo(j).note) + '</span>' : '') + (SV.postInfo(j).follow ? '<br><span class="small muted">Følg opp ' + SV.fdate(SV.postInfo(j).follow) + '</span>' : '') + '</dd>' : '') + '<dt>Fotografering</dt><dd>' + (i >= 2 ? SV.fdate(j.date, true) + ' kl. ' + j.time + ' <button class="link small" data-act="crmTime" data-id="' + j.id + '">Endre</button>' + (i < 3 ? ' · <button class="link small" data-act="crmPost" data-id="' + j.id + '">Utsett</button>' : '') : '<button class="btn btn-ghost btn-xs" data-act="crmTime" data-id="' + j.id + '">' + ic('cal') + 'Avtal tid</button>') + '</dd>' +
      (SV.hasOut(j) ? '<dt>Utefoto</dt><dd>' + (j.date2 ? SV.outWhen(j) + ' <button class="link small" data-act="crmTime" data-id="' + j.id + '">Endre</button>' : '<button class="btn btn-ghost btn-xs" data-act="crmTime" data-id="' + j.id + '">' + ic('cal') + 'Sett tid</button>') + '</dd>' : '') +
      '<dt>Levering</dt><dd>' + (i >= 4 ? (j.delivered ? 'Levert ' + SV.fdate(j.delivered) : 'Levert') : SV.eta(j) ? SV.fdate(SV.eta(j).d, true) + (SV.eta(j).t ? ' kl. ' + SV.eta(j).t : '') + ' <button class="link small" data-act="crmEta" data-id="' + j.id + '">Endre</button>' : '<button class="btn btn-ghost btn-xs" data-act="crmEta" data-id="' + j.id + '">' + ic('cal') + 'Sett forventet levering</button>') + '</dd>' +
      (j.agent ? '<dt>Fra e-post</dt><dd>' + esc(j.agent.subject || '') + '<br><span class="small muted">' + esc(j.agent.from || '') + (j.agent.office ? ' · ' + esc(j.agent.office) : '') + '</span>' + (SV.agentCheck(j) ? '<br><span class="small" style="color:var(--bad)">Sjekk: ' + esc((j.agent.missing || []).join(', ') || 'usikker tolkning') + '</span> <button class="btn btn-ghost btn-xs" data-act="agentSeen" data-id="' + j.id + '">' + ic('check') + 'Sjekket</button>' : '') + '</dd>' : '') +
      SV.geoRow(j) +
      (j.agentLog && j.agentLog.length ? '<dt>Endret på e-post</dt><dd>' + j.agentLog.slice(-3).map(function (l) { return '<span class="small">' + SV.fdate(l.at.slice(0, 10)) + ': ' + esc((l.changes || []).join(', ') || 'ingen endring') + '</span><br><span class="small muted">' + esc(l.from || '') + '</span>'; }).join('<br>') + '</dd>' : '') +
      '<dt>Faktura til</dt><dd><select class="sel sel-xs" data-change="billSet" data-id="' + j.id + '" aria-label="Faktura til">' + ['kontor', 'kunde'].map(function (b) { return '<option value="' + b + '"' + (SV.billTo(j) === b ? ' selected' : '') + '>' + SV.billLabel(b) + (SV.billDefault(j.office) === b ? ' (standard)' : '') + '</option>'; }).join('') + '</select></dd>' +
      '<dt>Kunde</dt><dd>' + esc(j.seller) + '<br><span class="small muted">' + (j.email ? esc(j.email) : 'Ingen e-post') + ' · ' + esc(j.phone) + '</span> <button class="link small" data-act="crmEdit" data-id="' + j.id + '">Endre</button></dd>' +
      '<dt>Megler</dt><dd>' + esc(j.broker) + '<br><span class="small muted">' + esc(brokerMail(j)) + '</span></dd>' +
      '<dt>Godkjent</dt><dd>' + (ap ? SV.fdate(ap.d) + ' av ' + esc(ap.by) : i === 4 ? 'Venter på megler eller kunde <button class="btn btn-ghost btn-xs" style="margin-top:6px" data-act="crmApprove" data-id="' + j.id + '" data-by="Studiovest">' + ic('check') + 'Godkjenn selv</button>' : '–') + '</dd></dl>' +
      '<div class="callout" style="margin-top:12px">' + ic('lock') + '<span style="flex:1"><b>Faktura</b> · bare du ser dette<br><span class="small muted">' + (inv.sent ? 'Sendt ' + (inv.d ? SV.fdate(inv.d) : '') : 'Ikke sendt') + '</span></span><label class="sw"><input type="checkbox" data-change="crmInv" data-id="' + j.id + '"' + (inv.sent ? ' checked' : '') + ' aria-label="Faktura sendt"><span></span></label></div>' +
      '<p class="eyebrow" style="margin:16px 0 6px">E-post sendt</p>' + (log.length ? '<ul class="feed small">' + log.slice(0, 6).map(function (m) { return '<li>' + ic('mail') + '<span><b>' + esc(m.subj) + '</b><br><span class="muted">' + esc(m.to) + (m.later ? ' · planlagt ' + esc(m.later) : '') + '</span></span><time>' + esc(m.t) + '</time></li>'; }).join('') + '</ul>' : '<p class="small muted">Ingen ennå. E-post sendes når status endres.</p>') +
      '</div></div>';
  };

  // ---------- adresse (adresseagenten, Kartverket) ----------
  SV.geo = function (j) { return (S.geo || {})[j.id] || j.geo || null; };
  function geoTxt(g) { return esc(g.addr) + ', ' + esc(g.postnr) + ' ' + esc(g.poststed) + '<br><span class="small muted">' + esc(g.kommune) + (g.gnr ? ' · gnr. ' + g.gnr + ' bnr. ' + g.bnr : '') + '</span>'; }
  SV.geoRow = function (j) {
    var g = SV.geo(j);
    if (!g) return '<dt>Adresse</dt><dd><span class="small muted">Ikke slått opp</span> <button class="link small" data-act="geoFind" data-id="' + j.id + '">Finn postnr. og gnr/bnr</button></dd>';
    if (g.status === 'velg') return '<dt>Adresse</dt><dd><span class="small" style="color:var(--bad)">Flere treff – velg riktig:</span><div class="geo-opts">' + g.options.map(function (o, k) { return '<button class="geo-opt" data-act="geoPick" data-id="' + j.id + '" data-k="' + k + '">' + geoTxt(o) + '</button>'; }).join('') + '</div><button class="link small" data-act="geoClear" data-id="' + j.id + '">Ingen av disse</button></dd>';
    if (g.status === 'ingen') return '<dt>Adresse</dt><dd><span class="small muted">Fant ikke adressen hos Kartverket</span> <button class="link small" data-act="geoFind" data-id="' + j.id + '">Prøv igjen</button></dd>';
    var extra = (g.bygg ? '<br><span class="small">' + esc(g.bygg) + (g.byggSikker === false ? ' <span class="muted">(nærmeste bygning)</span>' : '') + '</span>' : g.bygg === undefined && SV.live ? '<br><span class="small muted">Bygningstype hentes …</span>' : '') +
      (g.units && g.units.length ? '<br><label class="small">Leilighet <select class="sel sel-xs" style="width:auto;display:inline-block;margin:4px 0 0 6px;padding-top:4px;padding-bottom:4px" data-change="geoUnit" data-id="' + j.id + '" aria-label="Leilighetsnummer"><option value="">Velg (' + g.units.length + ')</option>' + g.units.map(function (u) { return '<option' + (g.unit === u ? ' selected' : '') + '>' + esc(u) + '</option>'; }).join('') + '</select></label>' : '');
    return '<dt>Adresse</dt><dd>' + geoTxt(g) + extra + (g.lat ? ' <a class="small" target="_blank" rel="noopener" href="https://norgeskart.no/#!?zoom=17&lat=' + g.lat + '&lon=' + g.lon + '&project=norgeskart&layers=1002&markerLat=' + g.lat + '&markerLon=' + g.lon + '&sok=">Kart</a>' : '') + '</dd>';
  };
  function setGeo(id, g) {
    var nj = (S.newJobs || []).filter(function (x) { return x.id === id; })[0];
    if (nj) { nj.geo = g; if (g.status === 'ok') { if (!nj.town) nj.town = g.poststed; } } else { S.geo = S.geo || {}; S.geo[id] = g; }
    SV.save(); SV.render();
  }
  function pack(a) { var t = function (s) { return String(s || '').toLowerCase().replace(/(^|[\s-])\S/g, function (c) { return c.toUpperCase(); }); };
    return { id: String(a.adresseid || ''), addr: a.adressetekst, postnr: a.postnummer, poststed: t(a.poststed), kommune: t(a.kommunenavn), knr: a.kommunenummer, gnr: a.gardsnummer, bnr: a.bruksnummer, lat: a.representasjonspunkt && a.representasjonspunkt.lat, lon: a.representasjonspunkt && a.representasjonspunkt.lon }; }
  // hele arbeidsområdet: Bokn i sør, Bergen/Norheimsund i nord, Eidfjord i øst
  var AREAS = ['stord', 'fitjar', 'bømlo', 'kvinnherad', 'tysnes', 'sveio', 'haugesund', 'karmøy', 'tysvær', 'bokn', 'vindafjord', 'etne', 'ullensvang', 'kvam', 'eidfjord', 'ulvik', 'austevoll', 'bjørnafjorden', 'samnanger', 'bergen'];
  SV.on('geoFind', function (el) {
    var id = el.getAttribute('data-id'), j = SV.find(SV.jobs(), id); if (!j) return;
    el.disabled = true; el.textContent = 'Søker …';
    var o = SV.find(SV.data.offices, j.office), areas = (o && o.areas && o.areas.length ? o.areas : AREAS).map(function (a) { return a.toLowerCase(); }), town = (j.town || '').toLowerCase().trim();
    var norm = function (s) { return String(s || '').toLowerCase().replace(/[^a-z0-9æøå]/g, ''); };
    fetch('https://ws.geonorge.no/adresser/v1/sok?treffPerSide=200&utkoordsys=4258&sok=' + encodeURIComponent(j.addr)).then(function (r) { return r.json(); }).then(function (d) {
      var hits = (d.adresser || []).filter(function (a) { return norm(a.adressetekst).indexOf(norm(j.addr)) === 0; });
      var pick = town ? hits.filter(function (a) { return [a.poststed, a.kommunenavn].map(function (x) { return String(x).toLowerCase(); }).indexOf(town) > -1 || a.postnummer === town; }) : [];
      if (!pick.length) pick = hits.filter(function (a) { return areas.indexOf(String(a.kommunenavn).toLowerCase()) > -1; });
      if (!pick.length) pick = hits.filter(function (a) { return AREAS.indexOf(String(a.kommunenavn).toLowerCase()) > -1; });
      var ex = pick.filter(function (a) { return norm(a.adressetekst) === norm(j.addr); }); if (ex.length === 1) pick = ex;
      if (pick.length === 1) { setGeo(id, Object.assign(pack(pick[0]), { status: 'ok' })); SV.toast('Adresse funnet'); }
      else if (pick.length) { setGeo(id, { status: 'velg', options: pick.slice(0, 8).map(pack) }); SV.toast(pick.length + ' treff – velg riktig'); }
      else { setGeo(id, { status: 'ingen' }); SV.toast('Fant ikke adressen', 'warn'); }
    }).catch(function () { el.disabled = false; el.textContent = 'Finn postnr. og gnr/bnr'; SV.toast('Fikk ikke kontakt med Kartverket', 'warn'); });
  });
  SV.on('geoPick', function (el) { var id = el.getAttribute('data-id'), g = SV.geo(SV.find(SV.jobs(), id)), o = g && g.options[+el.getAttribute('data-k')]; if (o) { setGeo(id, Object.assign({}, o, { status: 'ok' })); SV.toast('Adresse valgt'); } });
  SV.on('geoUnit', function (el) { var id = el.getAttribute('data-id'), g = Object.assign({}, SV.geo(SV.find(SV.jobs(), id)), { unit: el.value }); setGeo(id, g); SV.toast(el.value ? 'Leilighet ' + el.value : 'Leilighet fjernet'); });
  SV.on('geoClear', function (el) { setGeo(el.getAttribute('data-id'), { status: 'ingen' }); });

  // ---------- e-postvarsler ----------
  SV.crmMails = function () {
    var rules = '<div class="card tbl-w"><table class="tbl"><thead><tr><th>Når status blir</th><th>Til</th><th>Emne</th><th class="r">På</th></tr></thead><tbody>' +
      RULES.map(function (r) { var ex = SV.jobs()[0]; return '<tr><td>' + (r.stage ? SV.chip(r.stage) : '<span class="small">Ny tid</span>') + (r.later ? '<small>' + esc(r.later) + '</small>' : '') + '</td><td>' + ({ megler: 'Megler', kunde: 'Kunde', meg: 'Deg (varsel)', begge: 'Megler og kunde' })[r.to] + '</td><td><b>' + esc(r.subj(ex)) + '</b><small>' + esc(r.body) + '</small></td><td class="r"><label class="sw"><input type="checkbox" data-change="crmRule" data-k="' + r.k + '"' + (ruleOn(r) ? ' checked' : '') + ' aria-label="' + esc(r.k) + '"><span></span></label></td></tr>'; }).join('') + '</tbody></table></div>';
    var log = '<div class="card tbl-w sec"><div class="card-h"><h3>Sendt</h3><span class="small muted">' + S.mailLog.length + '</span></div><table class="tbl"><thead><tr><th>Tid</th><th>Prosjekt</th><th>Til</th><th>Emne</th></tr></thead><tbody>' +
      (S.mailLog.length ? S.mailLog.slice(0, 40).map(function (m) { var j = SV.find(SV.jobs(), m.id); return '<tr><td class="small" style="white-space:nowrap">' + esc(m.t) + '</td><td><a href="#/bolig/' + m.id + '">' + esc(j ? j.addr : m.id) + '</a></td><td>' + esc(m.to) + '<small>' + esc(m.mail) + '</small></td><td>' + esc(m.subj) + (m.later ? '<small>Planlagt ' + esc(m.later) + '</small>' : '') + '</td></tr>'; }).join('') : '<tr><td colspan="4" class="muted" style="padding:24px;text-align:center">Ingen e-post ennå. Endre en status for å se hva som sendes.</td></tr>') + '</tbody></table></div>';
    return rules + '<p class="hint">Sendes fra Studiovest sin e-post hos one.com (SMTP: send.one.com). Svar fra megler eller kunde hentes fra innboksen (IMAP: imap.one.com) og vises under prosjektet.</p>' + log;
  };
  SV.on('crmRule', function (el) { S.mailRules[el.getAttribute('data-k')] = el.checked; SV.save(); SV.toast(el.checked ? 'Varselet er på' : 'Varselet er av'); });
})();
