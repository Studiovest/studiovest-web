/* E-postagent: logg over e-post agenten har lest, og prosjektene den har laget (api/agentlog.php). */
(function () {
  'use strict';
  var SV = window.SV, esc = SV.esc, ic = SV.icon;
  var API = location.pathname.replace(/\/portal(\/.*)?$/, '') + '/api/';
  var data = null, loading = false, err = '';
  var TONE = { opprettet: ['Prosjekt laget', 'ok'], sjekk: ['Sjekk bestillingen', 'bad'], 'ikke bestilling': ['Ikke en bestilling', 'mute'], oppdatert: ['Prosjekt oppdatert', 'ok'], feil: ['Feil', 'bad'], venter: ['Venter (dagsgrense)', 'sand'], leser: ['Leser …', 'sand'] };
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
    fetch(API + 'agentlog.php', { credentials: 'same-origin', cache: 'no-store' }).then(function (r) { return r.json(); })
      .then(function (j) { data = j; loading = false; if (/^#\/agent/.test(location.hash)) SV.render(); })
      .catch(function () { loading = false; err = 'Fikk ikke kontakt med serveren.'; SV.render(); });
  }
  function when(iso) { if (!iso) return '–'; var d = new Date(iso); return SV.fdate(iso.slice(0, 10)) + ' kl. ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  SV.route('/agent', 'studio', function () {
    load();
    var head = SV.head({ eyebrow: 'Leser innboksen hvert 15. minutt', a: 'E-postagent', b: 'bestillinger fra meglere',
      lead: 'Agenten leser ny e-post, finner bestillinger og lager prosjektet i Bolig. Er noe uklart, får prosjektet merket «Sjekk bestillingen».',
      actions: SV.live && data && data.on ? '<button class="btn btn-dark btn-s" data-act="agRun">' + ic('mail') + 'Sjekk innboksen nå</button>' : '' });
    if (err) return head + '<p class="empty">' + esc(err) + '</p>';
    if (!data) return head + '<p class="empty">Laster …</p>';
    if (!data.on) return head + '<div class="card pad"><h3 class="h3">Agenten er ikke slått på</h3><p class="small" style="margin-top:8px">Legg linjen <code>ANTHROPIC_API_KEY=…</code> i GitHub-hemmeligheten STUDIOVEST_CONFIG. Den starter av seg selv ved neste publisering.</p></div>';
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
    return head + (data.demo ? '<p class="small muted" style="margin:-6px 0 14px">Eksempeldata. På studiovest.no vises de ekte e-postene agenten har lest.</p>' : '') + kpi + tbl;
  }, { title: 'E-postagent' });
  SV.on('agRun', function (el) {
    el.disabled = true; SV.toast('Sjekker innboksen …');
    fetch(API + 'agentlog.php', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ a: 'run' }) })
      .then(function (r) { return r.json(); }).then(function (j) { SV.toast(j.info || j.error || 'Ferdig'); if (/opprettet|sjekk/.test(j.info || '')) setTimeout(function () { location.reload(); }, 1200); else load(true); })
      .catch(function () { SV.toast('Fikk ikke kontakt med serveren', 'warn'); el.disabled = false; });
  });
  SV.on('agRetry', function (el) {
    el.disabled = true;
    fetch(API + 'agentlog.php', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ a: 'retry', id: +el.getAttribute('data-id') }) })
      .then(function (r) { return r.json(); }).then(function (j) { SV.toast(j.info || j.error || 'Ferdig'); if (/opprettet|sjekk/.test(j.info || '')) setTimeout(function () { location.reload(); }, 1200); else load(true); })
      .catch(function () { SV.toast('Fikk ikke kontakt med serveren', 'warn'); el.disabled = false; });
  });
})();
