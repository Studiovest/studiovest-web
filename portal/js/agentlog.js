/* Agenter: oversikt over alle agentene (av/på, kostnad, kø, siste hendelser) fra api/agents.php,
   pluss e-postloggen (api/agentlog.php) og Cubicasa-ordrer uten prosjekt. */
(function () {
  'use strict';
  var SV = window.SV, esc = SV.esc, ic = SV.icon;
  var API = SV.apiBase;
  var data = null, loading = false, err = '';
  var TONE = { opprettet: ['Prosjekt laget', 'ok'], sjekk: ['Sjekk bestillingen', 'bad'], 'ikke bestilling': ['Ikke en bestilling', 'mute'], oppdatert: ['Prosjekt oppdatert', 'ok'], plantegning: ['Plantegningsendring', 'ok'], feil: ['Feil', 'bad'], venter: ['Venter (dagsgrense)', 'sand'], leser: ['Leser …', 'sand'] };
  var DEMO = { on: true, demo: true, month: { emails: 214, usd: 0.94 }, geo: { n: 31, ok: 27 }, last_run: null, rows: [
    { id: 4, received: '2026-11-26T10:30:00Z', from_name: 'Sigrid Tveit', from_addr: 'sigrid@fjordmegling.example', subject: 'Re: Bestilling: Flaten 23, Ølve', status: 'oppdatert', job_id: 'B-2620', data: { is_update: true, update_ref: 'Flaten 23', invoice_to: 'kunde' } },
    { id: 3, received: '2026-11-26T07:12:00Z', from_name: 'Sigrid Tveit', from_addr: 'sigrid@fjordmegling.example', subject: 'Bestilling: Flaten 23, Ølve', status: 'opprettet', job_id: 'B-2620', data: { addr: 'Flaten 23', town: 'Ølve', services: ['f30', 'kv'], seller: 'Kari Nes' } },
    { id: 2, received: '2026-11-25T14:40:00Z', from_name: 'Ola Berg', from_addr: 'ola@kystmegleren.example', subject: 'Nytt oppdrag', status: 'sjekk', job_id: 'B-2619', data: { addr: 'Strandvegen 4', town: 'Rosendal', services: [], missing: ['pakke'] } },
    { id: 1, received: '2026-11-25T09:02:00Z', from_name: 'Ingrid Hovland', from_addr: 'ingrid@haugalandmegling.example', subject: 'Re: Tilbud kontoravtale', status: 'ikke bestilling', job_id: null, data: null }
  ] };
  function load(force) {
    if (!SV.live) { data = DEMO; return; }
    if (loading || (data && !force)) return;
    loading = true; err = '';
    fetch(API + 'agentlog.php', { credentials: 'include', cache: 'no-store' }).then(function (r) { return r.json(); })
      .then(function (j) { data = j; loading = false; if (/^#\/agent/.test(location.hash)) SV.render(); })
      .catch(function () { loading = false; err = 'Fikk ikke kontakt med serveren.'; SV.render(); });
  }
  function when(iso) { if (!iso) return '–'; var d = new Date(iso); return SV.fdate(iso.slice(0, 10)) + ' kl. ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  function mailLog() {
    load();
    var head = '';
    if (err) return head + '<p class="empty">' + esc(err) + '</p>';
    if (!data) return head + '<p class="empty">Laster …</p>';
    if (!data.on) return head + '<div class="card pad"><h3 class="h3">Agenten er ikke slått på</h3><p class="small" style="margin-top:8px">Legg linjen <code>CLAUDE_KEY_EMAIL=…</code> i GitHub-hemmeligheten STUDIOVEST_CONFIG. Den starter av seg selv ved neste publisering.</p></div>';
    var rows = data.rows || [], open = rows.filter(function (r) { return r.status === 'sjekk' || r.status === 'feil'; }).length;
    var kpi = '<div class="g4"><div class="card stat"><p class="k">' + ic('mail') + 'Lest denne måneden</p><p class="v">' + (data.month ? data.month.emails : 0) + '</p><p class="s">e-poster i innboksen</p></div>' +
      '<div class="card stat"><p class="k">' + ic('check') + 'Prosjekter laget</p><p class="v">' + rows.filter(function (r) { return r.job_id && r.status !== 'oppdatert'; }).length + '</p><p class="s">siste 100 e-poster</p></div>' +
      '<div class="card stat"><p class="k">' + ic('clock') + 'Til sjekk</p><p class="v">' + open + '</p><p class="s">uklare eller feilet</p></div>' +
      '<div class="card stat"><p class="k">' + ic('wallet') + 'Kostnad denne måneden</p><p class="v">' + (data.month ? data.month.usd.toFixed(2) : '0.00') + ' $</p><p class="s">Claude API · adresseoppslag gratis' + (data.geo ? ' (' + data.geo.ok + ' av ' + data.geo.n + ' funnet)' : '') + (data.last_run ? ' · sist kjørt ' + when(data.last_run) : '') + '</p></div></div>';
    var tbl = '<div class="card tbl-w sec"><table class="tbl"><thead><tr><th>Mottatt</th><th>Fra</th><th>Emne</th><th>Resultat</th><th class="hide-s">Funnet</th><th></th></tr></thead><tbody>' +
      (rows.length ? rows.map(function (r) {
        var t = TONE[r.status] || [r.status, 'mute'], d = r.data || {};
        var found = d.is_update ? 'Endring på ' + esc(d.update_ref || '') + (d.invoice_to === 'kunde' || d.invoice_to === 'kontor' ? '<small>Faktura til ' + (d.invoice_to === 'kunde' ? 'kunden' : 'kontoret') + '</small>' : '') : d.addr ? esc(d.addr) + (d.town ? ', ' + esc(d.town) : '') + (d.services && d.services.length ? ' · ' + d.services.map(function (id) { var v = SV.find(SV.data.boligServices, id); return esc(v ? v.name.replace(/ \(.*\)$/, '') : id) + (d.qty && d.qty[id] ? ' × ' + d.qty[id] : ''); }).join(', ') : '') + (d.invoice_to === 'kunde' || d.invoice_to === 'kontor' ? '<small>Faktura til ' + (d.invoice_to === 'kunde' ? 'kunden' : 'kontoret') + '</small>' : '') + (d.missing && d.missing.length ? '<small style="color:var(--bad)">Mangler: ' + esc(d.missing.join(', ')) + '</small>' : '') : '<span class="muted">–</span>';
        return '<tr><td class="small">' + when(r.received) + '</td><td>' + esc(r.from_name || '') + '<small>' + esc(r.from_addr || '') + '</small></td><td>' + esc(r.subject || '(uten emne)') + (r.info ? '<small style="color:var(--bad)">' + esc(r.info) + '</small>' : '') + '</td>' +
          '<td>' + SV.chip(t[0], t[1]) + (r.job_id ? '<small><a href="#/bolig/' + esc(r.job_id) + '">Åpne ' + esc(r.job_id) + '</a></small>' : '') + '</td><td class="hide-s small">' + found + '</td>' +
          '<td class="r">' + (!data.demo && (r.status === 'feil' || r.status === 'ikke bestilling' || r.status === 'sjekk') ? '<button class="link small" data-act="agRetry" data-id="' + r.id + '">Les på nytt</button>' : '') + '</td></tr>';
      }).join('') : '<tr><td colspan="6" class="muted" style="padding:24px;text-align:center">Ingen bestillinger ennå. Vanlig e-post som ikke ligner bestillinger, vises ikke her.</td></tr>') + '</tbody></table></div>';
    return (data.demo ? '<p class="small muted" style="margin:-6px 0 14px">Eksempeldata. På studiovest.no vises de ekte e-postene agenten har lest.</p>' : '') + kpi + tbl;
  }

  // ---------- Agenter: oversikt ----------
  var AG = null, agBusy = false, agErr = '';
  var DEMO_AG = { demo: true, month: { usd: 1.86, budget: 50 }, last_cron: { at: new Date(Date.now() - 12 * 60000).toISOString(), info: '' }, schedule: 'hvert 30. minutt', agents: [
    { id: 'email', name: 'E-postagent', what: 'Leser innboksen, lager prosjekter fra bestillinger, oppdaterer endringer og sender plantegningsendringer videre. Flytter registrerte e-poster til «Registrerte bestillinger».', claude: true, key: true, key_name: 'CLAUDE_KEY_EMAIL', where: 'one.com', can_run: true, on: true, usd: 0.94,
      stats: [['E-poster lest', 214], ['Prosjekter laget', 31], ['Til sjekk', 2]], last: { at: new Date(Date.now() - 12 * 60000).toISOString(), info: 'opprettet B-2620: Bestilling: Flaten 23, Ølve', ok: true },
      recent: [{ at: '2026-11-26T10:30:00Z', text: 'Re: Bestilling: Flaten 23, Ølve · Sigrid Tveit', status: 'oppdatert', job: 'B-2620' }, { at: '2026-11-26T07:12:00Z', text: 'Bestilling: Flaten 23, Ølve · Sigrid Tveit', status: 'opprettet', job: 'B-2620' }, { at: '2026-11-25T14:40:00Z', text: 'Nytt oppdrag · Ola Berg', status: 'sjekk', job: 'B-2619' }] },
    { id: 'address', name: 'Adresseagent', what: 'Finner postnummer, kommune, gnr/bnr, bygningstype og leilighetsnummer hos Kartverket for nye prosjekter.', claude: false, key: true, where: 'one.com', can_run: true, on: true, usd: 0,
      stats: [['Slått opp', 31], ['Funnet', 27], ['Må velges', 3]], last: { at: new Date(Date.now() - 12 * 60000).toISOString(), info: '1 slått opp (1 funnet)', ok: true }, recent: [{ at: '2026-11-26T07:15:00Z', text: 'Flaten 23 Ølve', status: 'ok', job: 'B-2620' }] },
    { id: 'cubicasa', name: 'Cubicasa-henting', what: 'Ser etter ferdige Cubicasa-ordrer og kobler dem til prosjektet med samme adresse.', claude: false, key: true, key_name: 'CUBICASA_API_KEY', where: 'one.com', can_run: true, on: true, usd: 0,
      stats: [['Koblet', 18], ['Uten prosjekt', 1]], last: { at: new Date(Date.now() - 12 * 60000).toISOString(), info: '5 ferdige ordrer sjekket: 1 koblet', ok: true }, recent: [{ at: '2026-11-26T09:00:00Z', text: 'Flaten 23, 5463 Ølve, Norway', status: 'koblet', job: 'B-2620' }] },
    { id: 'floorplan', name: 'Plantegningsagent', what: 'Lager ferdige plantegninger i meglerkontorets mal fra Cubicasa, sjekker dem og legger dem på prosjektet.', claude: true, key: true, key_name: 'CLAUDE_KEY_FLOORPLAN', where: 'GitHub Actions', can_run: false, on: true, usd: 0.71,
      stats: [['Levert', 17], ['I kø', 1], ['Til sjekk', 1]], last: { at: new Date(Date.now() - 12 * 60000).toISOString(), info: 'jobb 18 ferdig', ok: true }, recent: [{ at: '2026-11-26T09:30:00Z', text: 'Nordvik – Kjeller og 1.Etasje levert.', status: 'levert', job: 'B-2620' }] },
    { id: 'floorplan_edit', name: 'Plantegningsredigering', what: 'Gjør endringer på plantegningen når megler, kunde eller fotograf ber om det (i portalen eller på e-post). Du godkjenner før noe publiseres.', claude: true, key: true, key_name: 'CLAUDE_KEY_FLOORPLAN_EDIT', where: 'one.com', can_run: true, on: true, usd: 0.21,
      stats: [['Forespørsler', 6], ['Til godkjenning', 1], ['Til sjekk', 0]], last: null, recent: [{ at: '2026-11-26T11:02:00Z', text: 'Fjern skapene på soverommet til venstre', status: 'til godkjenning', job: 'B-2605' }] }
  ] };
  var AGT = { opprettet: 'ok', oppdatert: 'ok', plantegning: 'ok', ok: 'ok', koblet: 'ok', levert: 'ok', godkjent: 'ok', sjekk: 'bad', feil: 'bad', 'spørsmål': 'bad', manuell: 'bad', 'til godkjenning': 'sand', velg: 'sand', flere: 'sand', umatchet: 'bad', venter: 'sand', 'kjører': 'sand', 'kjørerr': 'sand', ingen: 'mute', 'ikke bestilling': 'mute', avvist: 'mute', ignorert: 'mute', svar: 'mute' };
  var AGL = { ok: 'Funnet', velg: 'Må velges', ingen: 'Ikke funnet', koblet: 'Koblet', flere: 'Flere mulige', umatchet: 'Uten prosjekt', levert: 'Levert', sjekk: 'Til sjekk' };
  function agLoad(force) {
    if (!SV.live) { AG = DEMO_AG; return; }
    if (agBusy || (AG && !force)) return; agBusy = true; agErr = '';
    fetch(API + 'agents.php', { credentials: 'include', cache: 'no-store' }).then(function (r) { return r.json(); })
      .then(function (d) { AG = d.ok ? d : null; agErr = d.ok ? '' : d.error; agBusy = false; if (/^#\/agent/.test(location.hash)) SV.render(); })
      .catch(function () { agBusy = false; agErr = 'Fikk ikke kontakt med serveren.'; SV.render(); });
  }
  function ago(iso) { if (!iso) return 'aldri'; var m = Math.round((Date.now() - new Date(iso)) / 60000); return m < 1 ? 'nå nettopp' : m < 60 ? m + ' min siden' : m < 1440 ? Math.round(m / 60) + ' t siden' : when(iso); }
  function agCard(a) {
    var ready = a.key, state = !ready ? ['Mangler nøkkel', 'bad'] : a.on ? ['På', 'ok'] : ['Av', 'mute'];
    return '<div class="card pad ag-card' + (a.on && ready ? '' : ' off') + '"><div class="row between" style="gap:10px;align-items:flex-start"><div><p class="eyebrow">' + (a.claude ? ic('bolt') + 'Claude' : ic('check') + 'Uten Claude (gratis)') + ' · ' + esc(a.where) + '</p><h3 class="h3">' + esc(a.name) + '</h3></div>' +
      '<label class="sw" title="Slå av/på"><input type="checkbox" data-change="agToggle" data-id="' + a.id + '"' + (a.on ? ' checked' : '') + ' aria-label="' + esc(a.name) + ' på/av"><span></span></label></div>' +
      '<p class="small muted" style="margin:6px 0 12px">' + esc(a.what) + '</p>' +
      '<div class="ag-stats">' + a.stats.map(function (s) { return '<div><b>' + s[1] + '</b><span>' + esc(s[0]) + '</span></div>'; }).join('') + (a.claude ? '<div><b>' + (+a.usd || 0).toFixed(2) + ' $</b><span>Kostnad i mnd.</span></div>' : '') + '</div>' +
      '<dl class="kv small" style="margin-top:12px"><dt>Status</dt><dd>' + SV.chip(state[0], state[1]) + (!ready && a.key_name ? ' <span class="muted">Legg til <code>' + esc(a.key_name) + '</code></span>' : '') + '</dd>' +
      '<dt>Sist kjørt</dt><dd>' + (a.last ? ago(a.last.at) + (a.last.ok === false ? ' <span style="color:var(--bad)">feilet</span>' : '') + '<br><span class="muted">' + esc(a.last.info || '') + '</span>' : a.id === 'floorplan_edit' ? 'Starter når noen ber om endringer' : 'Ikke kjørt ennå') + '</dd>' +
      (a.changed && a.changed.by ? '<dt>Endret</dt><dd>' + (a.changed.on ? 'Slått på' : 'Slått av') + ' av ' + esc(a.changed.by) + ', ' + ago(a.changed.at) + '</dd>' : '') + '</dl>' +
      '<details class="ag-recent"><summary class="small">Siste hendelser (' + (a.recent || []).length + ')</summary>' + ((a.recent || []).length ? '<ul>' + a.recent.map(function (r) { return '<li><span class="small muted">' + when(r.at) + '</span> ' + SV.chip(AGL[r.status] || r.status, AGT[r.status] || 'mute') + ' <span class="small">' + esc(r.text || '') + '</span>' + (r.job ? ' <a class="small" href="#/bolig/' + esc(r.job) + '">' + esc(r.job) + '</a>' : '') + '</li>'; }).join('') + '</ul>' : '<p class="small muted">Ingenting ennå.</p>') + '</details>' +
      '<div class="row" style="margin-top:12px;gap:8px">' + (a.can_run ? '<button class="btn btn-ghost btn-s" data-act="agRunNow" data-id="' + a.id + '"' + (a.on && ready ? '' : ' disabled') + '>Kjør nå</button>' : '<span class="small muted">Kjører automatisk ' + esc(AG.schedule || 'hvert 30. minutt') + '</span>') + '</div></div>';
  }
  SV.route('/agenter', 'studio', function () {
    agLoad(); load();
    var head = SV.head({ eyebrow: 'Automatisk ' + ((AG && AG.schedule) || 'hvert 30. minutt'), a: 'Agenter', b: 'som jobber for deg', lead: 'Se hva agentene har gjort, hva de koster, og slå dem av og på. En agent som er av, gjør ingenting før du slår den på igjen.' });
    if (agErr) return head + '<p class="empty">' + esc(agErr) + '</p>';
    if (!AG) return head + '<p class="empty">Laster …</p>';
    var on = AG.agents.filter(function (a) { return a.on && a.key; }).length, chk = AG.agents.reduce(function (n, a) { return n + a.stats.filter(function (s) { return /sjekk|godkjenning|velges|Uten prosjekt/.test(s[0]); }).reduce(function (m, s) { return m + (+s[1] || 0); }, 0); }, 0);
    var pct = Math.min(100, Math.round(100 * AG.month.usd / (AG.month.budget || 50)));
    var kpi = '<div class="g4"><div class="card stat"><p class="k">' + ic('bolt') + 'Aktive agenter</p><p class="v">' + on + ' av ' + AG.agents.length + '</p><p class="s">' + (on < AG.agents.length ? 'Noen er av eller mangler nøkkel' : 'Alle kjører') + '</p></div>' +
      '<div class="card stat"><p class="k">' + ic('wallet') + 'Claude denne måneden</p><p class="v">' + AG.month.usd.toFixed(2) + ' $</p><div class="ag-bar"><i style="width:' + pct + '%' + (pct > 80 ? ';background:var(--bad)' : '') + '"></i></div><p class="s">av grensen ' + AG.month.budget + ' $ · estimat</p></div>' +
      '<div class="card stat"><p class="k">' + ic('clock') + 'Siste kjøring</p><p class="v" style="font-size:22px">' + (AG.last_cron ? ago(AG.last_cron.at) : 'aldri') + '</p><p class="s">Neste innen 30 min</p></div>' +
      '<div class="card stat"><p class="k">' + ic('check') + 'Venter på deg</p><p class="v">' + chk + '</p><p class="s">til sjekk, godkjenning eller valg</p></div></div>';
    var cards = '<div class="ag-grid sec">' + AG.agents.map(agCard).join('') + '</div>';
    var tabs = SV.tabs('agt', [['o', 'Oversikt'], ['e', 'E-postlogg'], ['c', 'Cubicasa']], 'o');
    var cc = SV.live ? ccCard() : '';
    return head + (AG.demo ? '<p class="small muted" style="margin:-6px 0 14px">Eksempeldata. På portal.studiovest.no vises de ekte tallene.</p>' : '') + kpi + tabs +
      SV.panels('agt', { o: cards, e: '<div class="sec">' + mailLog() + '</div>', c: '<div class="sec">' + (cc || '<p class="empty">Ingen Cubicasa-ordrer uten prosjekt.</p>') + '</div>' }, 'o');
  }, { title: 'Agenter' });
  SV.route('/agent', 'studio', function () { setTimeout(function () { location.replace('#/agenter'); }, 0); return ''; }, { title: 'Agenter' });
  SV.on('agToggle', function (el) {
    var id = el.getAttribute('data-id'), a = AG.agents.filter(function (x) { return x.id === id; })[0], v = el.checked;
    if (!SV.live) { a.on = v; SV.toast(a.name + (v ? ' er slått på' : ' er slått av') + ' (eksempel)'); SV.render(); return; }
    fetch(API + 'agents.php', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ a: 'toggle', id: id, on: v }) })
      .then(function (r) { return r.json(); }).then(function (r) { SV.toast(r.ok ? a.name + (v ? ' er slått på' : ' er slått av') : r.error, r.ok ? '' : 'warn'); agLoad(true); });
  });
  SV.on('agRunNow', function (el) {
    var id = el.getAttribute('data-id'); el.disabled = true; el.textContent = 'Kjører …';
    if (!SV.live) { setTimeout(function () { SV.toast('Kjørt (eksempel)'); SV.render(); }, 600); return; }
    fetch(API + 'agents.php', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ a: 'run', id: id }) })
      .then(function (r) { return r.json(); }).then(function (r) { SV.toast(r.ok ? r.info || 'Ferdig' : r.error, r.ok ? '' : 'warn'); agLoad(true); data = null; load(true); })
      .catch(function () { SV.toast('Fikk ikke kontakt med serveren', 'warn'); el.disabled = false; });
  });

  // Cubicasa-ordrer agenten ikke kunne koble sikkert til et prosjekt
  var CC = null, ccBusy = false;
  function ccCard() {
    if (!CC && !ccBusy) { ccBusy = true; fetch(API + 'floorjobs.php?a=unmatched', { credentials: 'include', cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) { CC = d; ccBusy = false; SV.render(); }).catch(function () { ccBusy = false; }); }
    if (!CC || !CC.on || !(CC.orders || []).length) return '';
    var jobs = SV.jobs().filter(function (j) { return j.addr; });
    return '<div class="card pad" style="margin-bottom:16px"><p class="eyebrow">' + ic('home') + 'Plantegninger fra Cubicasa</p><h3 class="h3">' + CC.orders.length + ' ordre' + (CC.orders.length > 1 ? 'r' : '') + ' uten sikkert prosjekt</h3><p class="small muted" style="margin:4px 0 10px">Adressen stemte ikke med ett prosjekt. Velg riktig prosjekt, så lager agenten plantegningene.</p>' +
      CC.orders.map(function (o) { var c = o.candidates || [];
        return '<div class="row between" style="gap:8px;flex-wrap:wrap;border-top:1px solid var(--line);padding:10px 0"><div><b>' + esc(o.address || o.order_id) + '</b><small>' + (c.length ? 'Mulige: ' + c.map(function (x) { return esc(x.addr) + (/allerede/.test(x.why) ? ' (har allerede en ordre)' : ''); }).join(', ') : 'Ingen prosjekter med denne adressen') + '</small></div>' +
          '<div class="row" style="gap:6px;flex-wrap:nowrap"><select class="sel sel-xs" id="cc-' + esc(o.order_id) + '" aria-label="Prosjekt"><option value="">Velg prosjekt</option>' + jobs.map(function (j) { return '<option value="' + esc(j.id) + '"' + (c[0] && c[0].job === j.id ? ' selected' : '') + '>' + esc(j.addr) + (j.town ? ', ' + esc(j.town) : '') + ' (' + esc(j.id) + ')</option>'; }).join('') + '</select>' +
          '<button class="btn btn-dark btn-s" data-act="ccLink" data-o="' + esc(o.order_id) + '">Koble</button><button class="link small" data-act="ccIgnore" data-o="' + esc(o.order_id) + '">Ignorer</button></div></div>'; }).join('') + '</div>';
  }
  function ccPost(b, msg) { return fetch(API + 'floorjobs.php', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then(function (r) { return r.json(); }).then(function (r) { SV.toast(r.ok ? msg : r.error, r.ok ? '' : 'warn'); CC = null; SV.render(); }); }
  SV.on('ccLink', function (el) { var o = el.getAttribute('data-o'), s = document.getElementById('cc-' + o); if (!s || !s.value) { SV.toast('Velg prosjekt', 'warn'); return; } ccPost({ a: 'link', order: o, job: s.value }, 'Koblet. Agenten lager plantegningene innen 30 minutter.'); });
  SV.on('ccIgnore', function (el) { ccPost({ a: 'ignore', order: el.getAttribute('data-o') }, 'Ordren er ignorert'); });
  SV.on('mailRun', function (el) {
    el.disabled = true; SV.toast('Sjekker innboksen …');
    fetch(API + 'agentlog.php', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ a: 'run' }) })
      .then(function (r) { return r.json(); }).then(function (j) { SV.toast(j.info || j.error || 'Ferdig'); if (/opprettet|sjekk/.test(j.info || '')) setTimeout(function () { location.reload(); }, 1200); else load(true); })
      .catch(function () { SV.toast('Fikk ikke kontakt med serveren', 'warn'); el.disabled = false; });
  });
  SV.on('agRetry', function (el) {
    el.disabled = true;
    fetch(API + 'agentlog.php', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ a: 'retry', id: +el.getAttribute('data-id') }) })
      .then(function (r) { return r.json(); }).then(function (j) { SV.toast(j.info || j.error || 'Ferdig'); if (/opprettet|sjekk/.test(j.info || '')) setTimeout(function () { location.reload(); }, 1200); else load(true); })
      .catch(function () { SV.toast('Fikk ikke kontakt med serveren', 'warn'); el.disabled = false; });
  });
})();
