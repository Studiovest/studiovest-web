/* Bedrift: prosjekter, timebank, tilbud + bedriftsportalen (galleri, film, mediebank, timebank, dokumenter). */
(function () {
  'use strict';
  var SV = window.SV, D = SV.data, esc = SV.esc, ic = SV.icon;
  function co(id) { return SV.find(D.companies, id); }
  function proj(id) { return SV.find(D.bizProjects, id); }

  // ---------- Studio: Bedrift ----------
  SV.route('/bedrift', 'studio', function () {
    var act = D.bizProjects.filter(function (p) { return p.stage !== 'Levert'; });
    var pipe = '<div class="g3" style="grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;margin-bottom:22px">' + D.bizStages.map(function (s) { var n = D.bizProjects.filter(function (p) { return p.stage === s; }); return '<div class="card stat" style="padding:14px"><p class="k">' + s + '</p><p class="v" style="font-size:30px">' + n.length + '</p><p class="s">' + SV.kr(n.reduce(function (a, p) { return a + p.value; }, 0)) + '</p></div>'; }).join('') + '</div>';
    var list = '<div class="card tbl-w"><table class="tbl"><thead><tr><th>Prosjekt</th><th class="hide-s">Type</th><th>Steg</th><th class="hide-s">Opptak</th><th class="hide-s">Frist</th><th class="r">Verdi</th></tr></thead><tbody>' +
      D.bizProjects.map(function (p) { var c = co(p.company); return '<tr class="click" data-act="go" data-href="#/bedrift/' + p.id + '"><td><div class="row" style="flex-wrap:nowrap"><span class="thumb">' + SV.pic(p.cover) + '</span><span><b>' + esc(p.title) + '</b><small>' + esc(c.name) + (c.source !== 'Direkte' ? ' · ' + esc(c.source) : '') + '</small></span></div></td><td class="hide-s">' + esc(p.kind) + '</td><td>' + SV.chip(p.stage) + '</td><td class="hide-s">' + (p.date ? SV.fdate(p.date) : '–') + '</td><td class="hide-s">' + (p.due ? SV.fdate(p.due) : '–') + '</td><td class="r num">' + (p.value ? SV.kr(p.value) : '<span class="muted">Timebank</span>') + '</td></tr>'; }).join('') + '</tbody></table></div>';
    var bank = '<div class="g3">' + D.companies.filter(function (c) { return c.bank; }).map(function (c) { var b = c.bank, left = b.hours + b.rollover - b.used; return '<div class="card pad"><p class="eyebrow">' + esc(b.plan) + ' · ' + b.hours + ' t/mnd</p><h3 class="h3" style="font-size:17px">' + esc(c.name) + '</h3><div class="row" style="margin:18px 0 8px;flex-wrap:nowrap"><div class="ring" style="--p:' + Math.round(b.used / (b.hours + b.rollover) * 100) + '"><span>' + String(left).replace('.', ',') + '</span></div><div class="small"><p><b>' + String(left).replace('.', ',') + ' timer igjen</b> i november</p><p class="muted">' + String(b.used).replace('.', ',') + ' brukt · ' + b.rollover + ' overført fra oktober</p></div></div>' +
      D.bankLog.filter(function (l) { return l.company === c.id; }).map(function (l) { return '<div class="li" style="padding:8px 0"><span class="li-t small"><b>' + esc(l.what) + '</b><small>' + SV.fdate(l.date) + '</small></span><span class="li-r small num">' + String(l.h).replace('.', ',') + ' t</span></div>'; }).join('') + '</div>'; }).join('') + '</div>' +
      '<p class="hint" style="margin-top:12px">Regel for ubrukte timer (demo): inntil 50 % av månedens timer overføres én måned. Endres i timebank-avtalen.</p>';
    var offers = '<div class="card tbl-w"><table class="tbl"><thead><tr><th>Tilbud</th><th>Kunde</th><th>Status</th><th class="r">Beløp</th></tr></thead><tbody>' +
      [['T-2026-088', 'Partnerportretter og kontor', 'lad', 'Sendt', 'Åpnet 3 ganger, sist i går', 14500], ['T-2026-087', 'Verksted og folk i arbeid', 'hmv', 'Signert', 'Signert digitalt', 18900], ['T-2026-085', 'Vintersesong: rom, mat og fjord', 'rfh', 'Signert', 'Signert digitalt', 42000], ['T-2026-089', 'Julebord-film', 'rfh', 'Utkast', 'Frist fredag', 12900]].map(function (o) { return '<tr><td class="num">' + o[0] + '<small>' + esc(o[1]) + '</small></td><td>' + esc(co(o[2]).name) + '</td><td>' + SV.chip(o[3], o[3] === 'Signert' ? 'ok' : o[3] === 'Sendt' ? 'sand' : 'mute') + '<small>' + o[4] + '</small></td><td class="r num">' + SV.kr(o[5]) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      '<div class="callout" style="margin-top:14px">' + ic('sign') + '<span>Tilbud med pakker (Basis, Standard, Komplett) og elektronisk signering. Når kunden signerer, opprettes prosjektet med brief, opptaksliste og fakturaplan.</span></div>';
    return SV.head({ eyebrow: SV.dot('bedrift') + 'Bedrift · ' + act.length + ' aktive prosjekter', a: 'Bedrift', b: 'prosjekter', lead: 'Fra forespørsel til levert: tilbud, brief, opptaksliste med samtykke fra ansatte, gjennomgang av film og en mediebank kunden alltid har tilgang til.', actions: '<a class="btn btn-ghost btn-s" href="#/kunde/bedrift">' + ic('eye') + 'Se bedriftsportalen</a><button class="btn btn-acc btn-s" data-act="dummy">' + ic('plus') + 'Nytt prosjekt</button>' }) +
      pipe + SV.tabs('bz', [['p', 'Prosjekter', D.bizProjects.length], ['t', 'Timebank', 3], ['o', 'Tilbud og avtaler', 4]], 'p') + SV.panels('bz', { p: list, t: bank, o: offers }, 'p');
  }, { title: 'Bedrift' });

  SV.route('/bedrift/:id', 'studio', function (p) {
    var x = proj(p.id); if (!x) return '<p class="empty">Fant ikke prosjektet.</p>'; var c = co(x.company);
    var i = D.bizStages.indexOf(x.stage);
    var st = '<ol class="steps">' + D.bizStages.map(function (s, k) { return '<li class="' + (k < i ? 'done' : k === i ? (s === 'Levert' ? 'done' : 'now') : '') + '"><span>' + s + '</span></li>'; }).join('') + '</ol>';
    var brief = '<div class="g21"><div class="stack"><div class="card pad"><p class="eyebrow">Brief</p><p style="font-size:16px">' + esc(x.brief) + '</p><dl class="kv" style="margin-top:16px"><dt>Målgruppe</dt><dd>' + esc(x.audience) + '</dd><dt>Leveranser</dt><dd>' + (x.deliver.length ? x.deliver.map(esc).join('<br>') : '–') + '</dd></dl></div>' +
      (x.shots.length ? '<div class="card"><div class="card-h"><h3>Opptaksliste</h3><span class="small muted">' + x.shots.filter(function (s) { return s[1]; }).length + ' av ' + x.shots.length + '</span></div><div class="card-b"><ul class="check">' + x.shots.map(function (s, k) { return '<li class="' + (s[1] ? 'done' : '') + '"><input type="checkbox" id="sh' + k + '"' + (s[1] ? ' checked' : '') + ' data-change="shot"><label for="sh' + k + '"><span>' + esc(s[0]) + '</span></label></li>'; }).join('') + '</ul></div></div>' : '') + '</div>' +
      '<div class="stack"><div class="card pad"><dl class="kv"><dt>Kunde</dt><dd>' + esc(c.name) + '</dd><dt>Kontakt</dt><dd>' + esc(c.contact) + '<br><span class="small muted">' + esc(c.title) + '</span></dd><dt>Kilde</dt><dd>' + esc(c.source) + '</dd><dt>Opptak</dt><dd>' + (x.date ? SV.fdate(x.date, true) : 'Ikke satt') + '</dd><dt>Frist</dt><dd>' + (x.due ? SV.fdate(x.due) : '–') + '</dd><dt>Verdi</dt><dd>' + (x.value ? SV.kr(x.value) : 'Timebank') + '</dd></dl></div>' +
      (x.people.length ? '<div class="card"><div class="card-h"><h3>Personer og samtykke</h3></div><div class="card-b">' + x.people.map(function (pp) { return '<div class="li">' + SV.avatar(pp[0]) + '<span class="li-t"><b>' + esc(pp[0]) + '</b><small>' + esc(pp[1]) + '</small></span>' + SV.chip(pp[0] === 'Kjell Ask' && SV.state.consentKjell ? 'Signert' : pp[2]) + '</div>'; }).join('') + '<div class="row" style="margin-top:12px"><button class="btn btn-ghost btn-xs" data-act="remind">' + ic('mail') + 'Send påminnelse</button><a class="btn btn-ghost btn-xs" href="#/samtykke">' + ic('eye') + 'Siden den ansatte får</a></div><p class="hint">Samtykke til bilde og film, med valg for nettside, SoMe, annonser og rekruttering. Kan trekkes tilbake i portalen.</p></div></div>' : '') + '</div></div>';
    var rev = x.id === 'P-341' ? '<div class="callout">' + ic('chat') + '<span>Versjon 2 er til gjennomgang hos kunden. ' + D.videoComments.filter(function (v) { return !v.done; }).length + ' åpne kommentarer. <a href="#/kunde/bedrift/film">Åpne gjennomgangen</a></span></div>' : '<p class="empty">Ingen filmversjoner ennå.</p>';
    var t = SV.state.timer, running = t && t.p === x.id, logged = (SV.state.bankAdd || []).filter(function (l) { return l.p === x.id; });
    var timer = c.bank || x.kind === 'Timebank' ? '<div class="timer" style="margin-bottom:18px">' + ic('clock') + '<div><span class="small" style="opacity:.7">Timebank ' + esc(c.name) + '</span><br><b id="tmr">' + (running ? fmtT(Date.now() - t.start) : '0:00:00') + '</b></div>' + (logged.length ? '<span class="small" style="opacity:.7">Ført: ' + logged.map(function (l) { return String(l.h).replace('.', ',') + ' t'; }).join(', ') + '</span>' : '') + '<button class="btn ' + (running ? 'btn-acc' : 'btn-ghost') + ' btn-s" style="margin-left:auto" data-act="timer" data-id="' + x.id + '">' + (running ? 'Stopp og før' : 'Start tid') + '</button></div>' : '';
    if (running) SV.after(function () { clearInterval(SV._tmr); SV._tmr = setInterval(function () { var e = document.getElementById('tmr'); if (!e) { clearInterval(SV._tmr); return; } e.textContent = fmtT(Date.now() - SV.state.timer.start); }, 1000); });
    return '<p class="small" style="margin-bottom:14px"><a href="#/bedrift" class="muted">← Bedrift</a></p>' + SV.head({ eyebrow: SV.dot('bedrift') + x.id + ' · ' + esc(c.name) + ' · ' + SV.chip(x.stage), a: x.title, actions: '<a class="btn btn-ghost btn-s" href="#/kunde/bedrift">' + ic('eye') + 'Kundens visning</a>' }) + timer +
      '<div class="card pad" style="margin-bottom:22px">' + st + '</div>' + SV.tabs('pj', [['b', 'Brief og opptak'], ['g', 'Gjennomgang']], 'b') + SV.panels('pj', { b: brief, g: rev }, 'b');
  }, { title: 'Prosjekt' });
  function fmtT(ms) { var s = Math.floor(ms / 1000); return Math.floor(s / 3600) + ':' + String(Math.floor(s / 60) % 60).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
  SV.on('timer', function (el) {
    var id = el.getAttribute('data-id'), t = SV.state.timer;
    if (t && t.p === id) { var h = Math.max(0.5, Math.round((Date.now() - t.start) / 36e5 * 2) / 2); SV.state.bankAdd = (SV.state.bankAdd || []).concat([{ p: id, h: h }]); SV.state.timer = null; SV.save(); SV.render(); SV.toast(String(h).replace('.', ',') + ' t ført i timebanken (rundet til nærmeste halvtime) · kunden ser det'); }
    else { SV.state.timer = { p: id, start: Date.now() }; SV.save(); SV.render(); SV.toast('Tiden går'); }
  });
  SV.on('shot', function (el) { el.closest('li').classList.toggle('done', el.checked); });
  SV.on('remind', function () { SV.toast('Påminnelse sendt til Kjell Ask'); });

  // ---------- Bedriftsportalen ----------
  SV.clientCfg.bedrift = { org: 'Vestkraft Energi AS', user: 'Marte Haugland', userRole: 'Kommunikasjonsansvarlig', home: '#/kunde/bedrift',
    tabs: [['#/kunde/bedrift', 'Oversikt'], ['#/kunde/bedrift/film', 'Film'], ['#/kunde/bedrift/galleri', 'Utvalg'], ['#/kunde/bedrift/mediebank', 'Mediebank'], ['#/kunde/bedrift/timebank', 'Timebank'], ['#/kunde/bedrift/innhold', 'Innhold'], ['#/kunde/bedrift/dokumenter', 'Dokumenter'], ['#/kunde/bedrift/profil', 'Profil og brukere']] };
  var VK = 'vke';

  SV.route('/kunde/bedrift', 'bedrift', function () {
    var c = co(VK), b = c.bank, left = b.hours + b.rollover - b.used, nFav = Object.keys(SV.state.favs).filter(function (k) { return SV.state.favs[k]; }).length;
    var open = D.videoComments.filter(function (v) { return !v.done; }).length;
    var full = '<div class="hero-c" style="margin-bottom:22px">' + SV.topo() + '<div><p class="eyebrow" style="color:var(--sand)">Velkommen til bedriftsportalen</p><h1><span class="serif">God dag, Marte</span></h1><p>Alt Studiovest har laget for Vestkraft er samlet her: film til gjennomgang, bilder å velge fra, mediebanken og timebanken.</p></div><div><button class="btn btn-acc" data-act="request">' + ic('plus') + 'Ny forespørsel</button></div></div>';
    var compact = '<div class="greet"><div><h1>God dag, Marte</h1><div class="kpis" style="margin-top:8px"><span><b>3</b> ting venter på deg</span><span><b>' + String(left).replace('.', ',') + ' t</b> igjen i timebanken</span></div></div><button class="btn btn-dark btn-s" data-act="request">' + ic('plus') + 'Ny forespørsel</button></div>';
    return SV.intro('bedrift', full, compact) +
      '<div><div class="sec-h"><h2>Venter på deg</h2></div><div class="g3">' +
        todo('#/kunde/bedrift/film', 'video', 'Rekrutteringsfilm, versjon 2', open + ' åpne kommentarer · godkjenn eller be om endringer') +
        todo('#/kunde/bedrift/galleri', 'heart', 'Velg 15 stillbilder fra opptaket', nFav + ' av 15 valgt') +
        todo('#/kunde/bedrift/innhold', 'mega', 'LinkedIn-teaser til godkjenning', 'Planlagt ' + SV.fdate(D.D(1))) + '</div></div>' +
      '<div class="g2 sec"><div class="card"><div class="card-h"><h3>Prosjekter</h3></div><div class="card-b">' + D.bizProjects.filter(function (p) { return p.company === VK; }).map(function (p) { return '<div class="li"><span class="thumb">' + SV.pic(p.cover) + '</span><span class="li-t"><b>' + esc(p.title) + '</b><small>' + esc(p.kind) + (p.due ? ' · frist ' + SV.fdate(p.due) : '') + '</small></span>' + SV.chip(p.stage) + '</div>'; }).join('') + '</div></div>' +
      '<div class="card"><div class="card-h"><h3>Neste opptak</h3></div><div class="card-b"><div class="li"><span class="time" style="width:auto">' + SV.parse(D.W(6)).getDate() + '.</span><span class="li-t"><b>Timebank: portretter av nyansatte</b><small>' + SV.fdate(D.W(6), true) + ' kl. 10:00 · hovedkontoret, Husnes · 2 timer</small></span></div><p class="hint">Personene får samtykkeskjema på e-post to dager før.</p><button class="btn btn-ghost btn-xs" style="margin-top:10px" data-act="go" data-href="#/kunde/bedrift/timebank">Bestill flere timer</button></div></div></div>';
  }, { title: 'Bedriftsportal' });
  function todo(h, icn, t, s) { return '<a class="card pad" href="' + h + '" style="text-decoration:none"><span class="qi a-bedrift">' + ic(icn) + '</span><b style="display:block;margin-top:14px">' + t + '</b><small class="muted">' + s + '</small></a>'; }

  // filmgjennomgang
  var LEN = 92;
  SV.route('/kunde/bedrift/film', 'bedrift', function () {
    var cm = D.videoComments.concat(SV.state.comments).sort(function (a, b) { return a.t - b.t; });
    var appr = SV.state.approved['P-341'];
    SV.after(function () { vpT = 0; vpDraw(); });
    return SV.head({ eyebrow: 'Rekrutteringsfilm «Bli med på laget» · ' + SV.chip(appr ? 'Godkjent' : 'Til gjennomgang', appr ? 'ok' : 'sand'), a: 'Gjennomgang', b: 'versjon 2', lead: 'Spill av, stopp der du vil kommentere og skriv. Kommentaren lander på riktig sekund, så vi vet nøyaktig hva du mener.' }) +
      '<div class="g21"><div><div class="vp" id="vp">' + SV.pic(D.img.sveiser, '50% 40%') + '<button class="vp-play" data-act="vpPlay" aria-label="Spill av">' + ic('play') + '</button><div class="vp-ctrl"><div class="vp-track" id="vpTrack" data-act="vpSeek"><i id="vpBar"></i>' + cm.map(function (c) { return '<button class="vp-mk' + (c.done ? ' done' : '') + '" style="left:' + (c.t / LEN * 100) + '%" data-act="vpJump" data-t="' + c.t + '" aria-label="Kommentar ved ' + fmt(c.t) + '"></button>'; }).join('') + '</div><div class="vp-time"><span id="vpCur">0:00</span><span>' + fmt(LEN) + '</span></div></div></div>' +
        '<div class="row" style="margin-top:12px;flex-wrap:nowrap"><button class="btn btn-ghost" data-act="annoToggle">Tegn på bildet</button><input class="inp" id="cmIn" placeholder="Kommentar ved 0:00 …"><button class="btn btn-dark" data-act="cmAdd">Legg til</button></div>' +
        '<div class="row" style="margin-top:14px"><select class="sel" style="width:auto"><option>Versjon 2 (i dag)</option><option>Versjon 1 (' + SV.fdate(D.W(-3)) + ')</option></select><span class="small muted">Formater: 16:9 hovedfilm · 3 × 9:16 med teksting</span></div></div>' +
      '<div class="card"><div class="card-h"><h3>Kommentarer</h3><span class="small muted">' + cm.filter(function (c) { return !c.done; }).length + ' åpne</span></div><div class="card-b" id="cmList">' +
        cm.map(function (c) { return '<div class="cm' + (c.done ? ' done' : '') + '"><button class="cm-t" data-act="vpJump" data-t="' + c.t + '">' + fmt(c.t) + '</button><div><p>' + esc(c.text) + '</p><small>' + esc(c.who) + (c.done ? ' · løst i v2' : '') + '</small></div></div>'; }).join('') + '</div>' +
        '<div class="card-b" style="border-top:1px solid var(--line2)"><button class="btn ' + (appr ? 'btn-ghost' : 'btn-acc') + '" style="width:100%" data-act="approve" data-id="P-341">' + ic('check') + (appr ? 'Godkjent ' : 'Godkjenn versjon 2') + '</button><p class="hint" style="text-align:center">Når du godkjenner, lager vi endelige filer og legger dem i mediebanken.</p></div></div></div>';
  }, { title: 'Film' });
  function fmt(s) { s = Math.round(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  var vpT = 0, vpTimer = null;
  function vpDraw() { var b = document.getElementById('vpBar'); if (!b) { clearInterval(vpTimer); vpTimer = null; return; } b.style.width = (vpT / LEN * 100) + '%'; document.getElementById('vpCur').textContent = fmt(vpT); var i = document.getElementById('cmIn'); if (i) i.placeholder = 'Kommentar ved ' + fmt(vpT) + ' …'; }
  SV.on('vpPlay', function (el) {
    if (vpTimer) { clearInterval(vpTimer); vpTimer = null; el.innerHTML = ic('play'); return; }
    el.innerHTML = ic('pause'); vpTimer = setInterval(function () { vpT += 0.5; if (vpT >= LEN) { vpT = LEN; clearInterval(vpTimer); vpTimer = null; } vpDraw(); }, 120);
  });
  SV.on('vpSeek', function (el, ev) { if (ev.target.closest('.vp-mk')) return; var r = el.getBoundingClientRect(); vpT = Math.max(0, Math.min(LEN, (ev.clientX - r.left) / r.width * LEN)); vpDraw(); });
  SV.on('vpJump', function (el, ev) { ev.stopPropagation(); vpT = +el.getAttribute('data-t'); vpDraw(); });
  SV.on('cmAdd', function () { var i = document.getElementById('cmIn'); if (!i.value.trim()) { i.focus(); return; } SV.state.comments.push({ t: Math.round(vpT), who: 'Marte Haugland', text: i.value.trim() + (drawn ? ' ✎ (med tegning)' : ''), done: false }); drawn = false; SV.save(); var keep = vpT; SV.render(); vpT = keep; vpDraw(); SV.toast('Kommentar lagt til ved ' + fmt(keep) + ' · Studiovest er varslet'); });
  SV.on('approve', function (el) { var id = el.getAttribute('data-id'); SV.state.approved[id] = true; SV.save(); SV.render(); SV.toast('Godkjent · endelige filer kommer i mediebanken'); });

  // utvalg (proofing)
  var STILLS = [];
  (function () { var s = [D.img.sveiser, D.img.skip, D.img.bygg, D.img.kontor, D.img.portrett, D.img.kai], pos = ['50% 50%', '30% 40%', '70% 50%', '50% 70%', '20% 30%', '80% 60%']; for (var i = 0; i < 24; i++) STILLS.push({ id: 'st' + i, src: s[i % s.length], pos: pos[(i * 5) % pos.length] }); })();
  SV.route('/kunde/bedrift/galleri', 'bedrift', function (p) {
    var only = p.vis === 'favoritter', favs = SV.state.favs, n = STILLS.filter(function (s) { return favs[s.id]; }).length;
    var list = STILLS.filter(function (s) { return !only || favs[s.id]; });
    return SV.head({ eyebrow: 'Stillbilder fra filmopptaket · 24 bilder', a: 'Velg', b: 'favoritter', lead: 'Avtalen inkluderer 15 ferdig redigerte bilder. Trykk på hjertet for å velge, og send utvalget når du er fornøyd.' }) +
      '<div class="row between" style="margin-bottom:14px"><div class="filters" style="margin:0"><a class="fbtn' + (only ? '' : ' on') + '" href="#/kunde/bedrift/galleri">Alle</a><a class="fbtn' + (only ? ' on' : '') + '" href="#/kunde/bedrift/galleri/favoritter">' + ic('heart') + 'Favoritter <b id="favN">' + n + '</b></a></div><p class="small"><b id="favN2">' + n + '</b> av 15 valgt</p></div>' +
      '<div class="gal big">' + (list.length ? list.map(function (s, i) { return '<figure class="gi' + (favs[s.id] ? ' on' : '') + '">' + SV.pic(s.src, s.pos) + '<span class="wm">Studiovest</span><span class="gi-n">' + String(STILLS.indexOf(s) + 1).padStart(2, '0') + '</span><button type="button" class="gi-sel gi-heart' + (favs[s.id] ? ' on' : '') + '" data-act="fav" data-id="' + s.id + '" aria-pressed="' + !!favs[s.id] + '" aria-label="Favoritt ' + (i + 1) + '">' + ic('heart') + '</button></figure>'; }).join('') : '<p class="empty">Ingen favoritter ennå.</p>') + '</div>' +
      '<div class="cartbar"><span class="small">Utvalg</span><b><span id="favN3">' + n + '</span> / 15</b><span class="small" style="opacity:.7">Ekstra bilder: 350 kr per bilde</span><button class="btn btn-acc" style="margin-left:auto" data-act="sendSel">Send utvalget</button></div>';
  }, { title: 'Utvalg' });
  SV.route('/kunde/bedrift/galleri/:vis', 'bedrift', function (p) { return SV.routes.filter(function (r) { return r.pattern === '/kunde/bedrift/galleri'; })[0].fn(p); }, { title: 'Utvalg' });
  SV.on('fav', function (el) {
    var id = el.getAttribute('data-id'); SV.state.favs[id] = !SV.state.favs[id]; SV.save();
    el.classList.toggle('on', SV.state.favs[id]); el.closest('.gi').classList.toggle('on', SV.state.favs[id]); el.setAttribute('aria-pressed', SV.state.favs[id]);
    var n = STILLS.filter(function (s) { return SV.state.favs[s.id]; }).length; ['favN', 'favN2', 'favN3'].forEach(function (k) { var e = document.getElementById(k); if (e) e.textContent = n; });
    if (n === 16) SV.toast('Over 15: ekstra bilder koster 350 kr', 'warn');
  });
  SV.on('sendSel', function () { var n = STILLS.filter(function (s) { return SV.state.favs[s.id]; }).length; if (!n) { SV.toast('Velg minst ett bilde', 'warn'); return; } SV.toast(n + ' bilder sendt til redigering · klare innen 3 virkedager'); });

  // mediebank
  var BANK = [
    ['Portretter', D.img.portrett, 'Ola Brekke, avdelingsleder', 'Signert', '50% 30%'], ['Portretter', D.img.portrett, 'Nora Fet, elektriker', 'Signert', '40% 30%'], ['Portretter', D.img.portrett, 'Tidligere ansatt', 'Sluttet', '60% 30%'], ['Portretter', D.img.portrett, 'Emil Sandvik, lærling', 'Signert', '50% 25%'],
    ['Anlegg', D.img.bygg, 'Damanlegget, drone', '', '50% 50%'], ['Anlegg', D.img.skip, 'Servicebåt i fjorden', '', '30% 50%'], ['Anlegg', D.img.sveiser, 'Verkstedet', '', '50% 50%'], ['Anlegg', D.img.kai, 'Kaianlegg', '', '60% 50%'],
    ['Kontor', D.img.kontor, 'Kontorlandskap, Husnes', '', '50% 50%'], ['Kontor', D.img.kontor, 'Møterom', '', '20% 50%'], ['Film', D.img.sveiser, 'Rekrutteringsfilm v1 (utgått)', '', '50% 40%'], ['Film', D.img.bygg, 'Drone, B-roll 4K', '', '50% 50%'],
    ['Logo', '', 'Vestkraft logo, hvit og blå', '', '']
  ];
  SV.route('/kunde/bedrift/mediebank', 'bedrift', function (p) {
    var f = p.tag || 'Alle', tags = ['Alle', 'Portretter', 'Anlegg', 'Kontor', 'Film', 'Logo'];
    var list = BANK.filter(function (b) { return f === 'Alle' || b[0] === f; });
    return SV.head({ eyebrow: '126 filer · oppdatert ' + SV.fdate(D.W(-1)), a: 'Mediebank', lead: 'Alt vi har levert til dere, alltid tilgjengelig. Søk, filtrer og last ned i riktig format. Portretter av ansatte som har sluttet skjules automatisk.' }) +
      '<div class="row between" style="margin-bottom:14px"><div class="filters" style="margin:0">' + tags.map(function (t) { return '<a class="fbtn' + (t === f ? ' on' : '') + '" href="#/kunde/bedrift/mediebank' + (t === 'Alle' ? '' : '/' + encodeURIComponent(t)) + '">' + t + '</a>'; }).join('') + '</div><label class="search" style="max-width:280px;height:36px">' + ic('search') + '<input placeholder="Søk i mediebanken" aria-label="Søk i mediebanken" data-input="bankSearch"></label></div>' +
      '<div class="gal" id="bankGal">' + list.map(function (b) {
        var gone = b[3] === 'Sluttet';
        return '<figure class="gi" data-q="' + esc((b[0] + ' ' + b[2]).toLowerCase()) + '" style="' + (gone ? 'opacity:.5' : '') + '">' + (b[1] ? SV.pic(b[1], b[4]) : '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#1e3a5f;color:#fff;font-weight:900;font-size:22px;letter-spacing:.02em">VESTKRAFT</div>') +
          '<span class="gi-n">' + esc(b[2]) + '</span>' + (gone ? '<span class="gi-tag">' + SV.chip('Skjult · sluttet', 'bad') + '</span>' : b[0] === 'Portretter' ? '<span class="gi-tag">' + SV.chip('Samtykke', 'ok') + '</span>' : b[2].indexOf('utgått') > -1 ? '<span class="gi-tag">' + SV.chip('Erstattet', 'mute') + '</span>' : '') +
          (gone ? '' : '<button type="button" class="gi-sel" data-act="dlOne" aria-label="Last ned">' + ic('down') + '</button>') + '</figure>';
      }).join('') + '</div>' +
      '<div class="callout sage sec">' + ic('shield') + '<span><b>Bruksrett:</b> Fri bruk i egne kanaler (nettside, SoMe, trykk, rekruttering). Annonser i betalte kanaler er inkludert. Videresalg og bruk for andre firma krever avtale.</span></div>';
  }, { title: 'Mediebank' });
  SV.route('/kunde/bedrift/mediebank/:tag', 'bedrift', function (p) { return SV.routes.filter(function (r) { return r.pattern === '/kunde/bedrift/mediebank'; })[0].fn(p); }, { title: 'Mediebank' });
  SV.on('bankSearch', function (el) { var q = el.value.toLowerCase(); document.querySelectorAll('#bankGal .gi').forEach(function (g) { g.hidden = q && g.getAttribute('data-q').indexOf(q) < 0; }); });
  SV.on('dlOne', function () { SV.modal('<p class="eyebrow">Last ned</p><h2 class="h2"><span class="serif">Velg</span> <span class="bold">størrelse</span></h2><div class="stack" style="margin-top:14px">' + [['Original', 'Full oppløsning, JPG'], ['Nettside', '2400 px, optimalisert'], ['LinkedIn og Facebook', '1200 × 1200'], ['Instagram', '1080 × 1350 (4:5)'], ['Presse', 'Full oppløsning + bildetekst og kreditering']].map(function (x, i) { return '<label class="opt radio"><input type="radio" name="sz"' + (i === 1 ? ' checked' : '') + '><b>' + x[0] + '</b><small>' + x[1] + '</small></label>'; }).join('') + '</div><div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn btn-acc" data-act="dlGo">' + ic('down') + 'Last ned</button></div>'); });

  // timebank (kunde)
  SV.route('/kunde/bedrift/timebank', 'bedrift', function () {
    var b = co(VK).bank, tot = b.hours + b.rollover, left = tot - b.used;
    return SV.head({ eyebrow: 'Timebank ' + b.plan + ' · ' + b.hours + ' timer i måneden', a: 'Timebank' }) +
      '<div class="g12"><div class="card dark pad">' + SV.topo() + '<div class="row" style="flex-wrap:nowrap;gap:20px"><div class="ring" style="--p:' + Math.round(b.used / tot * 100) + ';width:130px;height:130px"><span style="width:100px;height:100px;font-size:30px">' + String(left).replace('.', ',') + '</span></div><div><p class="bignum" style="font-size:40px">' + String(left).replace('.', ',') + ' t</p><p class="muted">igjen i november</p></div></div>' +
        '<dl class="kv" style="margin-top:22px;color:var(--light)"><dt class="muted">Månedens timer</dt><dd>' + b.hours + '</dd><dt class="muted">Overført</dt><dd>' + b.rollover + '</dd><dt class="muted">Brukt</dt><dd>' + String(b.used).replace('.', ',') + '</dd><dt class="muted">Fornyes</dt><dd>1. desember</dd></dl></div>' +
      '<div class="card pad"><h3 class="h3" style="margin-bottom:14px">Bestill timer</h3><div class="g2"><label class="fld"><span>Hva skjer?</span><input class="inp" placeholder="F.eks. åpning av ny trafostasjon"></label><label class="fld"><span>Når</span><input class="inp" type="date" value="' + D.W(8) + '"></label><label class="fld"><span>Hvor</span><input class="inp" placeholder="Sted"></label><label class="fld"><span>Ca. timer</span><select class="sel"><option>1</option><option selected>2</option><option>3</option><option>Hel dag (7,5)</option></select></label></div><label class="fld"><span>Hva trenger dere?</span><div class="row"><label class="tag"><input type="checkbox" checked> Foto</label><label class="tag"><input type="checkbox"> Video</label><label class="tag"><input type="checkbox"> Drone</label><label class="tag"><input type="checkbox" checked> SoMe-klipp</label></div></label><button class="btn btn-dark" data-act="bankBook">Send forespørsel</button></div></div>' +
      '<div class="sec card"><div class="card-h"><h3>Brukt</h3></div><div class="card-b">' + D.bankLog.filter(function (l) { return l.company === VK; }).map(function (l) { return '<div class="li"><span class="li-t"><b>' + esc(l.what) + '</b><small>' + SV.fdate(l.date, true) + '</small></span><span class="li-r num"><b>' + String(l.h).replace('.', ',') + ' t</b></span></div>'; }).join('') + '</div></div>';
  }, { title: 'Timebank' });
  SV.on('bankBook', function () { SV.toast('Forespørsel sendt · Studiovest bekrefter tid i løpet av dagen'); });

  SV.route('/kunde/bedrift/dokumenter', 'bedrift', function () {
    var docs = [['sign', 'Timebank-avtale Medium', 'Signert ' + SV.fdate(D.D(-120)), 'Signert'], ['sign', 'Tilbud: Rekrutteringsfilm', 'Signert ' + SV.fdate(D.D(-40)), 'Signert'], ['shield', 'Samtykker fra ansatte', '46 signert · 1 venter', 'Venter'], ['file', 'Databehandleravtale', 'Signert ' + SV.fdate(D.D(-120)), 'Signert'], ['wallet', 'Faktura 26-1191 · ansattportretter', 'Forfalt ' + SV.fdate(D.D(-6)), 'Forfalt'], ['wallet', 'Faktura 26-1140 · timebank oktober', 'Betalt', 'Betalt']];
    return SV.head({ a: 'Dokumenter', lead: 'Avtaler, samtykker og fakturaer samlet.' }) + '<div class="card"><div class="card-b">' + docs.map(function (d) { return '<div class="li">' + ic(d[0]) + '<span class="li-t"><b>' + d[1] + '</b><small>' + d[2] + '</small></span>' + SV.chip(d[3]) + '<button class="ib" data-act="dummy" aria-label="Last ned">' + ic('down') + '</button></div>'; }).join('') + '</div></div>';
  }, { title: 'Dokumenter' });

  SV.on('request', function () {
    SV.modal('<h2 class="h2"><span class="serif">Ny forespørsel</span></h2><p class="small muted">Beskriv kort hva dere trenger. Vi svarer med forslag og pris innen én virkedag.</p><div style="margin-top:14px"><p class="small" style="font-weight:700;margin-bottom:8px">Hva gjelder det?</p><div class="opts" style="grid-template-columns:repeat(2,1fr)">' +
      [['Portretter', 'Nye ansatte, ledergruppe'], ['Foto av anlegg eller kontor', 'Nettside, rapporter'], ['Film', 'Rekruttering, reklame, dokumentasjon'], ['Innhold til SoMe', 'Bruker timebanken']].map(function (x, i) { return '<label class="opt"><input type="checkbox"' + (i === 0 ? ' checked' : '') + '><b>' + x[0] + '</b><small>' + x[1] + '</small></label>'; }).join('') + '</div>' +
      '<div class="g2" style="margin-top:12px"><label class="fld"><span>Når</span><input class="inp" type="date" value="' + D.W(10) + '"></label><label class="fld"><span>Hvor</span><input class="inp" value="Hovedkontoret, Husnes"></label></div><label class="fld"><span>Beskrivelse</span><textarea class="txt" placeholder="F.eks. 3 nyansatte, samme stil som sist"></textarea></label><label class="fld"><span>Vedlegg (valgfritt)</span><span class="drop" style="padding:16px">' + ic('upload') + '<span class="small">Eksempler, logo, manus</span></span></label></div><div class="row" style="justify-content:flex-end"><button class="btn btn-dark" data-act="requestSend">Send</button></div>', { wide: true });
  });
  SV.on('requestSend', function () { SV.close(); SV.toast('Forespørselen er sendt · svar innen én virkedag'); });

  var USERS = [['Marte Haugland', 'marte@vestkraft.example', 'Administrator', 'Alt'], ['Ola Brekke', 'ola@vestkraft.example', 'Godkjenner', 'Film, utvalg, innhold'], ['Ingvild Rønning', 'hr@vestkraft.example', 'HR', 'Portretter, samtykker'], ['Kristian Moe', 'kristian@vestkraft.example', 'Leser', 'Mediebank']];
  SV.route('/kunde/bedrift/profil', 'bedrift', function () {
    var users = USERS.concat((SV.state.bizUsers || []).map(function (e) { return [e.split('@')[0], e, 'Leser', 'Mediebank']; }));
    return SV.head({ a: 'Profil og brukere', lead: 'Profilen brukes i film, grafikk og innlegg vi lager. Brukerne bestemmer hvem som ser hva.' }) +
      '<div class="g2"><div class="card"><div class="card-h"><h3>Profil</h3><button class="link small" data-act="dummy">Last opp profilmanual</button></div><div class="card-b">' +
        '<p class="small" style="font-weight:700;margin-bottom:8px">Logo</p><div class="row"><div style="width:150px;height:64px;border-radius:10px;background:#1e3a5f;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900">VESTKRAFT</div><div style="width:150px;height:64px;border-radius:10px;background:#fff;color:#1e3a5f;display:flex;align-items:center;justify-content:center;font-weight:900;box-shadow:inset 0 0 0 1px var(--line)">VESTKRAFT</div></div>' +
        '<p class="small" style="font-weight:700;margin:16px 0 8px">Farger</p><div class="row">' + [['#1E3A5F', 'Fjordblå'], ['#F2B705', 'Strøm'], ['#E8EEF2', 'Lys'], ['#222222', 'Tekst']].map(function (c) { return '<span style="text-align:center"><span class="swatch" style="background:' + c[0] + ';display:block;width:56px;height:40px"></span><span class="tiny muted">' + c[1] + '<br>' + c[0] + '</span></span>'; }).join('') + '</div>' +
        '<dl class="kv small" style="margin-top:16px"><dt>Skrift</dt><dd>Inter (titler fete)</dd><dt>Tone</dt><dd>Jordnær, stolt, ikke reklamete</dd><dt>Musikk i film</dt><dd>Rolig, akustisk. Ikke stockmusikk med vokal.</dd><dt>Unngå</dt><dd>Bilder uten hjelm og verneutstyr på anlegg</dd></dl></div></div>' +
      '<div class="card"><div class="card-h"><h3>Brukere</h3><span class="small muted">' + users.length + '</span></div><div class="card-b">' + users.map(function (u) { return '<div class="li">' + SV.avatar(u[0]) + '<span class="li-t"><b>' + esc(u[0]) + '</b><small>' + esc(u[1]) + ' · ser: ' + esc(u[3]) + '</small></span><select class="sel" style="width:auto;min-height:34px;padding:4px 8px" aria-label="Rolle for ' + esc(u[0]) + '"' + (u[2] === 'Administrator' ? ' disabled' : '') + '>' + ['Administrator', 'Godkjenner', 'HR', 'Leser'].map(function (r) { return '<option' + (r === u[2] ? ' selected' : '') + '>' + r + '</option>'; }).join('') + '</select></div>'; }).join('') +
        '<div class="row" style="margin-top:12px;flex-wrap:nowrap"><input class="inp" id="invIn" placeholder="E-post til kollega" type="email"><button class="btn btn-dark" data-act="invite">Inviter</button></div><p class="hint">Godkjenner kan godkjenne film og innlegg. HR ser portretter og samtykker. Leser kan bare laste ned.</p></div></div></div>';
  }, { title: 'Profil og brukere' });
  SV.on('invite', function () { var v = document.getElementById('invIn').value.trim(); if (v.indexOf('@') < 0) { SV.toast('Skriv en e-postadresse', 'warn'); return; } SV.state.bizUsers = (SV.state.bizUsers || []).concat([v]); SV.save(); SV.render(); SV.toast('Invitasjon sendt til ' + v); });

  // ---------- tegn på bildet i filmgjennomgang ----------
  var drawn = false;
  SV.on('annoToggle', function (el) {
    var vp = document.getElementById('vp'), on = !vp.classList.contains('drawing'); vp.classList.toggle('drawing', on); el.textContent = on ? 'Ferdig å tegne' : 'Tegn på bildet';
    if (vp.querySelector('.anno')) return;
    var c = document.createElement('canvas'); c.className = 'anno'; vp.appendChild(c);
    var r = vp.getBoundingClientRect(); c.width = r.width * 2; c.height = r.height * 2; var x = c.getContext('2d'); x.lineWidth = 6; x.lineCap = 'round'; x.strokeStyle = '#E2533A'; var d = false;
    function pt(e) { var b = c.getBoundingClientRect(); return [(e.clientX - b.left) * 2, (e.clientY - b.top) * 2]; }
    c.addEventListener('pointerdown', function (e) { d = true; drawn = true; var p = pt(e); x.beginPath(); x.moveTo(p[0], p[1]); c.setPointerCapture(e.pointerId); });
    c.addEventListener('pointermove', function (e) { if (!d) return; var p = pt(e); x.lineTo(p[0], p[1]); x.stroke(); });
    c.addEventListener('pointerup', function () { d = false; });
  });
})();
