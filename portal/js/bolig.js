/* Bolig: studio-tavle, oppdrag, tjenester, meglerkontor + meglerportalen. */
(function () {
  'use strict';
  var SV = window.SV, D = SV.data, esc = SV.esc, ic = SV.icon;

  SV.jobs = function () {
    var t = SV.state.sellerTime || {};
    return D.boligJobs.concat(SV.state.newJobs).map(function (j) { return t[j.id] ? Object.assign({}, j, { date: t[j.id][0], time: t[j.id][1], wish: '' }) : j; });
  };
  SV.stageOf = function (j) { return SV.state.stage[j.id] || j.stage; };
  function job(id) { return SV.find(SV.jobs(), id); }
  function office(id) { return SV.find(D.offices, id); }
  function svc(id) { return SV.find(D.boligServices, id); }
  function total(j) { return j.services.reduce(function (s, x) { var v = svc(x); return s + (v ? v.price : 0); }, 0); }
  var POS = ['50% 50%', '20% 50%', '80% 40%', '50% 80%', '35% 30%', '65% 60%', '10% 60%', '90% 50%'];
  function photos(j) {
    var srcs = j.type === 'Fritidsbolig' || j.type === 'Gårdsbruk' ? [D.img.hytte, D.img.stue, D.img.kjokken, D.img.loft, D.img.tomanns] : j.type === 'Leilighet' ? [D.img.stue, D.img.kjokken, D.img.loft, D.img.stue, D.img.tomanns] : [D.img.tomanns, D.img.stue, D.img.kjokken, D.img.loft, D.img.hytte];
    var n = j.services.indexOf('f40') > -1 ? 16 : j.services.indexOf('f30') > -1 ? 14 : 12, out = [];
    var NAMES = {}; NAMES[D.img.tomanns] = ['Fasade', 'Fasade mot hage', 'Inngangsparti']; NAMES[D.img.stue] = ['Stue', 'Stue mot vindu', 'Sittegruppe']; NAMES[D.img.kjokken] = ['Kjøkken', 'Kjøkkenøy', 'Spiseplass']; NAMES[D.img.loft] = ['Loftsstue', 'Loft', 'Soverom']; NAMES[D.img.hytte] = ['Eksteriør', 'Drone mot sjø', 'Drone oversikt'];
    var seen = {}, ill = 0;
    for (var i = 0; i < n; i++) {
      var src = srcs[i % srcs.length], k = seen[src] = (seen[src] || 0) + 1, isIll = j.services.indexOf('vm') > -1 && (src === D.img.loft || src === D.img.stue) && k === 2 && ill++ < 2;
      out.push({ i: i, src: src, pos: POS[(i * 3) % POS.length], name: NAMES[src][(k - 1) % 3], ill: isIll });
    }
    var ord = (SV.state.order || {})[j.id];
    if (ord) out = ord.map(function (i) { return out[i]; }).filter(Boolean).concat(out.filter(function (x) { return ord.indexOf(x.i) < 0; }));
    return out;
  }
  SV.boligPhotos = photos;
  function license(j) {
    if (!j.published) return null;
    var exp = D.iso(D.addDays(SV.parse(j.published), 365));
    return { exp: exp, sold: j.sold, text: j.sold ? 'Boligen er solgt ' + SV.fdate(j.sold) + '. Lisensen er avsluttet; bildene arkiveres.' : 'Gjelder til boligen er solgt, maks 12 mnd fra publisering (' + SV.fdate(exp) + ').' };
  }
  function steps(j) {
    var cur = D.stages.indexOf(SV.stageOf(j));
    return '<ol class="steps">' + D.stages.map(function (s, i) { return '<li class="' + (i < cur ? 'done' : i === cur ? (s === 'Levert' ? 'done' : 'now') : '') + '"><span>' + s + '</span></li>'; }).join('') + '</ol>';
  }
  SV.boligSteps = steps;
  function svcTags(j) { return '<div class="svc">' + j.services.map(function (s) { var v = svc(s); return '<span>' + esc(v ? v.name.replace(', per bilde', '').replace('Boligfoto, ', '').replace('Dronefoto, 8 bilder', 'Drone').replace('Boligvideo, 60–90 sek', 'Video').replace('SoMe-reel 9:16', 'Reel').replace('Plantegning ', 'Plan ').replace('Ekspress, levert innen 24 t', 'Ekspress').replace('Digital møblering', 'Møblering') : s) + '</span>'; }).join('') + '</div>'; }

  // ---------- Studio: Bolig ----------
  SV.route('/bolig', 'studio', function (p) {
    var f = p.kontor || 'alle', jobs = SV.jobs().filter(function (j) { return f === 'alle' || j.office === f; });
    var board = '<div class="kb" id="kb">' + D.stages.map(function (s) {
      var list = jobs.filter(function (j) { return SV.stageOf(j) === s; });
      return '<div class="kb-col" data-stage="' + s + '"><div class="kb-h">' + s + '<span>' + list.length + '</span></div>' + list.map(card).join('') + '</div>';
    }).join('') + '</div>';
    var svcs = '<div class="card tbl-w"><table class="tbl"><thead><tr><th>Tjeneste</th><th class="hide-s">Gruppe</th><th class="hide-s">Tid på stedet</th><th class="r">Pris</th><th class="r">Aktiv</th></tr></thead><tbody>' +
      D.boligServices.map(function (s) { return '<tr><td><b>' + esc(s.name) + '</b><small>' + esc(s.desc) + '</small></td><td class="hide-s">' + s.group + '</td><td class="hide-s">' + (s.min ? s.min + ' min' : '–') + '</td><td class="r num">' + SV.kr(s.price) + '</td><td class="r"><label class="sw"><input type="checkbox"' + (s.on ? ' checked' : '') + ' aria-label="' + esc(s.name) + '"><span></span></label></td></tr>'; }).join('') +
      '</tbody></table></div><p class="hint">Dummy-priser eks. mva. Tid på stedet brukes til å legge oppdrag i kalenderen. Kontoravtaler gir egne priser per kontor.</p>';
    var off = '<div class="g2">' + D.offices.map(function (o) { return '<div class="card pad"><p class="eyebrow">' + esc(o.town) + '</p><h3 class="h3" style="font-size:18px">' + esc(o.name) + '</h3><dl class="kv" style="margin-top:12px"><dt>Avtale</dt><dd>' + esc(o.agreement) + '</dd><dt>Faktura</dt><dd>' + esc(o.invoice) + '</dd><dt>Meglere</dt><dd>' + o.brokers.map(esc).join(', ') + '</dd><dt>I år</dt><dd>' + SV.kr(o.ytd) + '</dd></dl></div>'; }).join('') + '</div>';
    SV.after(dnd);
    var bd = SV.diff(D.iso(D.base)), due = jobs.filter(function (j) { return j.due && SV.diff(j.due) <= bd && SV.stageOf(j) !== 'Levert'; }).length;
    return SV.head({ eyebrow: SV.dot('bolig') + 'Bolig · ' + jobs.filter(function (j) { return SV.stageOf(j) !== 'Levert'; }).length + ' aktive · ' + due + ' med frist ' + (bd === 0 ? 'i dag' : SV.dayName(D.iso(D.base))), a: 'Bolig', b: 'oppdrag',
        lead: 'Megler bestiller i sin portal, selger velger tid på SMS, og bildene går til megler i riktige formater så snart de er ferdige. Dra kortene mellom stegene.',
        actions: '<a class="btn btn-ghost btn-s" href="#/kunde/megler">' + ic('eye') + 'Se meglerportalen</a><a class="btn btn-acc btn-s" href="#/kunde/megler/bestill">' + ic('plus') + 'Nytt oppdrag</a>' }) +
      SV.tabs('bo', [['t', 'Tavle'], ['s', 'Tjenester og priser', D.boligServices.length], ['k', 'Meglerkontor', D.offices.length]], 't') +
      SV.panels('bo', { t: '<div class="filters">' + [['alle', 'Alle kontor']].concat(D.offices.map(function (o) { return [o.id, o.name]; })).map(function (x) { return '<a class="fbtn' + (x[0] === f ? ' on' : '') + '" href="#/bolig' + (x[0] === 'alle' ? '' : '/kontor/' + x[0]) + '">' + esc(x[1]) + '</a>'; }).join('') + '</div>' + board, s: svcs, k: off }, 't');
  }, { title: 'Bolig' });
  SV.route('/bolig/kontor/:kontor', 'studio', function (p) { return SV.routes.filter(function (r) { return r.pattern === '/bolig'; })[0].fn(p); }, { title: 'Bolig' });

  function card(j) {
    var st = SV.stageOf(j), o = office(j.office);
    var when = st === 'Bestilt' ? '<span>Ønske: ' + esc(j.wish || '–') + '</span>' : st === 'Levert' ? '<span>Levert ' + SV.fdate(j.delivered || j.date) + '</span>' : (st === 'Planlagt' ? '<span>' + ic('cal') + SV.fdate(j.date) + ' ' + j.time + '</span>' : (j.due ? '<span class="' + (SV.diff(j.due) <= 0 ? 'due' : '') + '">' + ic('clock') + 'Frist ' + SV.rel(j.due) + '</span>' : ''));
    return '<a class="kb-card" draggable="true" data-id="' + j.id + '" href="#/bolig/' + j.id + '"><div class="kb-img">' + SV.pic(j.cover, '50% 60%') + '</div><div class="kb-b"><b>' + esc(j.addr) + '</b><small>' + esc(j.town) + ' · ' + esc(o.name) + '</small>' + svcTags(j) +
      '<div class="kb-meta">' + when + (st !== 'Levert' ? '<button type="button" class="kb-mv" data-act="stageNext" data-id="' + j.id + '" aria-label="Flytt ' + esc(j.addr) + ' til ' + D.stages[D.stages.indexOf(st) + 1] + '">' + D.stages[D.stages.indexOf(st) + 1] + ' →</button>' : '') + '</div></div></a>';
  }
  function dnd() {
    var kb = document.getElementById('kb'); if (!kb) return;
    var dragId = null;
    kb.addEventListener('dragstart', function (e) { var c = e.target.closest('.kb-card'); if (!c) return; dragId = c.getAttribute('data-id'); c.classList.add('drag'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', dragId); } catch (x) {} });
    kb.addEventListener('dragend', function (e) { var c = e.target.closest('.kb-card'); if (c) c.classList.remove('drag'); kb.querySelectorAll('.over').forEach(function (x) { x.classList.remove('over'); }); });
    kb.querySelectorAll('.kb-col').forEach(function (col) {
      col.addEventListener('dragover', function (e) { e.preventDefault(); col.classList.add('over'); });
      col.addEventListener('dragleave', function (e) { if (!col.contains(e.relatedTarget)) col.classList.remove('over'); });
      col.addEventListener('drop', function (e) {
        e.preventDefault(); col.classList.remove('over'); if (!dragId) return;
        var s = col.getAttribute('data-stage'), j = job(dragId); if (SV.stageOf(j) === s) return;
        SV.state.stage[dragId] = s; SV.save(); SV.render();
        SV.toast(stageMsg(j, s));
      });
    });
  }
  function stageMsg(j, s) {
    return s === 'Levert' ? 'Levert: e-post til ' + j.broker + ' og faktura laget automatisk' : s === 'Planlagt' ? 'Planlagt: SMS med tid og klargjøringsliste sendt til selger' : s === 'Redigering' ? 'Sendt til redigering' : j.addr + ' flyttet til ' + s;
  }
  SV.on('stageNext', function (el, ev) {
    if (ev) { ev.preventDefault(); ev.stopPropagation(); }
    var j = job(el.getAttribute('data-id')), i = D.stages.indexOf(SV.stageOf(j));
    if (i < D.stages.length - 1) { SV.state.stage[j.id] = D.stages[i + 1]; SV.save(); SV.render(); SV.toast(stageMsg(j, D.stages[i + 1])); }
  });

  // ---------- Studio: ett oppdrag ----------
  SV.route('/bolig/:id', 'studio', function (p) {
    var j = job(p.id); if (!j) return '<p class="empty">Fant ikke oppdraget.</p>';
    var o = office(j.office), st = SV.stageOf(j), ph = photos(j), lic = license(j), i = D.stages.indexOf(st);
    var ov = '<div class="g21"><div class="stack">' +
      '<div class="card"><div class="card-h"><h3>Bestilt</h3><span class="small muted">' + SV.kr(total(j)) + ' eks. mva</span></div><div class="card-b">' + j.services.map(function (s) { var v = svc(s); return '<div class="li"><span class="li-t"><b>' + esc(v.name) + '</b><small>' + esc(v.desc) + '</small></span><span class="li-r num">' + SV.kr(v.price) + '</span></div>'; }).join('') + '</div></div>' +
      '<div class="card"><div class="card-h"><h3>Tidslinje</h3></div><div class="card-b"><ul class="feed">' + timeline(j).map(function (t) { return '<li>' + SV.dot('bolig') + '<span>' + t[1] + '</span><time>' + t[0] + '</time></li>'; }).join('') + '</ul></div></div></div>' +
      '<div class="stack"><div class="card pad"><dl class="kv"><dt>Oppdragsnr.</dt><dd>' + esc(j.nr) + '</dd><dt>Megler</dt><dd>' + esc(j.broker) + '<br><span class="muted small">' + esc(o.name) + '</span></dd><dt>Selger</dt><dd>' + esc(j.seller) + '<br><span class="muted small">' + esc(j.phone) + '</span></dd><dt>Tilgang</dt><dd>' + esc(j.access) + '</dd><dt>Type</dt><dd>' + esc(j.type) + '</dd><dt>Fotograf</dt><dd>' + esc(SV.find(D.team, j.by).name) + '</dd>' + (j.date ? '<dt>Tid</dt><dd>' + SV.fdate(j.date) + ' kl. ' + j.time + '</dd>' : '') + '</dl></div>' +
      (j.services.indexOf('dr') > -1 ? '<div class="callout">' + ic('wind') + '<span><b>Drone:</b> ' + esc(j.weather || 'Værsjekk dagen før') + '. Over 8 m/s flyttes dronen til ny dag uten kostnad for megler.</span></div>' : '') +
      (lic ? '<div class="callout sage">' + ic('shield') + '<span><b>Bildelisens:</b> ' + lic.text + ' Kreditering: «Foto: Studiovest».</span></div>' : '') +
      cost(j) + (st === 'Levert' ? '<div class="card pad"><h3 class="h3">Omtale</h3><p class="small muted" style="margin:6px 0 12px">Sendes automatisk 7 dager etter levering, eller nå.</p><button class="btn btn-ghost btn-s" data-act="review">' + ic('star') + 'Be om omtale på Google</button></div>' : '') + '</div></div>';
    var gal = '<div class="row between" style="margin-bottom:12px"><p class="small muted">' + ph.length + ' bilder · klikk for å velge omslag og rekkefølge</p><button class="btn btn-ghost btn-xs" data-act="dummy">' + ic('upload') + 'Last opp redigerte</button></div><div class="gal">' +
      ph.map(function (x) { return '<figure class="gi" data-act="lightbox" data-src="' + x.src + '" data-pos="' + x.pos + '" data-name="' + esc(x.name) + '">' + SV.pic(x.src, x.pos) + '<span class="gi-n">' + String(x.i + 1).padStart(2, '0') + ' ' + esc(x.name) + '</span>' + (x.i === 0 ? '<span class="gi-tag">' + SV.chip('Omslag', 'sand') + '</span>' : x.ill ? '<span class="gi-tag">' + SV.chip('Illustrasjon', 'brown') + '</span>' : '') + '</figure>'; }).join('') + '</div>';
    var lev = '<div class="g3">' + [['Finn og nett', 'Web-optimalisert, sRGB, liggende og stående', 'down'], ['Trykk', 'Full oppløsning for prospekt og skilt', 'file'], ['SoMe', '4:5 og 9:16, klar til Instagram og Facebook', 'grid'], ['Plantegning', 'PDF og PNG, 2D' + (j.services.indexOf('p3') > -1 ? ' + 3D' : ''), 'plan'], ['Video', j.services.indexOf('vi') > -1 || j.services.indexOf('re') > -1 ? 'MP4 liggende og stående' : 'Ikke bestilt', 'video'], ['Boligside', 'Egen side med bilder, video og plantegning', 'link']].map(function (x) { return '<div class="card pad"><p class="row">' + ic(x[2]) + '<b>' + x[0] + '</b></p><p class="small muted" style="margin-top:6px">' + x[1] + '</p></div>'; }).join('') + '</div>' +
      '<p class="hint" style="margin-top:12px">Alle formatene lages automatisk fra de redigerte filene når oppdraget settes til Levert.</p>';
    return '<p class="small" style="margin-bottom:14px"><a href="#/bolig" class="muted">' + '← Bolig</a></p>' +
      SV.head({ eyebrow: SV.dot('bolig') + esc(j.id) + ' · ' + esc(o.name) + ' · ' + SV.chip(st), a: j.addr, b: j.town,
        actions: (i < D.stages.length - 1 ? '<button class="btn btn-dark btn-s" data-act="stageNext" data-id="' + j.id + '">Flytt til ' + D.stages[i + 1] + ' ' + ic('chev') + '</button>' : '') + '<a class="btn btn-ghost btn-s" href="#/kunde/megler/' + j.id + '">' + ic('eye') + 'Slik ser megler det</a>' }) +
      '<div class="card pad" style="margin-bottom:22px">' + steps(j) + '</div>' +
      SV.tabs('job', [['o', 'Oversikt'], ['r', 'Råfiler og utvalg', i >= 2 ? rawCount(j) : null], ['b', 'Redigerte', ph.length], ['l', 'Leveranse']], 'o') + SV.panels('job', { o: ov, r: i >= 2 ? rawView(j) : '<p class="empty">Råfilene kommer når boligen er fotografert.</p>', b: gal, l: lev }, 'o');
  }, { title: 'Oppdrag' });

  function timeline(j) {
    var st = D.stages.indexOf(SV.stageOf(j)), t = [['', 'Bestilt av <b>' + esc(j.broker) + '</b> i meglerportalen']];
    t.push(['', 'Bekreftelse sendt til megler · SMS med forslag til tid sendt til ' + esc(j.seller.split(' ')[0])]);
    if (st >= 1) t.push([SV.fdate(j.date), 'Tid avtalt: ' + j.time + ' · klargjøringsliste sendt til selger']);
    if (st >= 2) t.push([SV.fdate(j.date), 'Fotografert av ' + esc(SV.find(D.team, j.by).name) + ' · ' + (j.services.indexOf('f40') > -1 ? 212 : 148) + ' RAW-filer lastet opp']);
    if (st >= 3) t.push(['', 'Sendt til redigering · frist ' + (j.due ? SV.fdate(j.due) : 'neste virkedag')]);
    if (st >= 4) t.push([j.delivered ? SV.fdate(j.delivered) : 'i dag', 'Levert · e-post til megler · faktura laget']);
    return t.reverse();
  }

  SV.on('lightbox', function (el) {
    SV.modal('<figure style="margin:0"><img src="' + el.getAttribute('data-src') + '" alt="" style="width:100%;border-radius:10px;max-height:70vh;object-fit:cover;object-position:' + el.getAttribute('data-pos') + '"><figcaption class="row between" style="margin-top:12px"><b>' + esc(el.getAttribute('data-name')) + '</b><span class="small muted">Foto: Studiovest</span></figcaption></figure>', { wide: true });
  });


  // ---------- kostnad per oppdrag ----------
  var KM = { 'Leirvik': 78, 'Stord': 80, 'Husnes': 32, 'Halsnøy': 8, 'Haugesund': 140, 'Rosendal': 64, 'Bømlo': 118, 'Ølve': 52, 'Sveio': 130, 'Uskedalen': 44 };
  var FERRY = { 'Leirvik': 0, 'Stord': 0, 'Haugesund': 0, 'Bømlo': 0, 'Rosendal': 0 };
  function cost(j) {
    var km = (KM[j.town] || 40) * 2, kmKr = Math.round(km * 3.5), ferry = j.town === 'Ølve' || j.town === 'Rosendal' ? 186 : 0;
    var hrs = (SV.minutes(j) + (SV.travel[j.town] || 30) * 2) / 60 + 1.2, hrsKr = Math.round(hrs * 450), ed = 35 * (j.services.indexOf('f40') > -1 ? 40 : j.services.indexOf('f30') > -1 ? 30 : 20);
    var rev = Math.round(total(j) * (j.office === 'fjm' ? .92 : j.office === 'sue' ? .95 : 1)), costSum = kmKr + ferry + ed, margin = rev - costSum;
    return '<div class="card"><div class="card-h"><h3>Lønnsomhet</h3><span class="small muted">estimat</span></div><div class="card-b"><dl class="kv"><dt>Inntekt</dt><dd class="num">' + SV.kr(rev) + '</dd><dt>Kjøring</dt><dd class="num">' + km + ' km · ' + SV.kr(kmKr) + '</dd><dt>Ferje</dt><dd class="num">' + (ferry ? SV.kr(ferry) : '–') + '</dd><dt>Redigering</dt><dd class="num">' + SV.kr(ed) + '</dd><dt>Tid brukt</dt><dd class="num">' + hrs.toFixed(1).replace('.', ',') + ' t</dd><dt>Dekning</dt><dd class="num"><b>' + SV.kr(margin) + '</b> · ' + SV.kr(margin / hrs) + '/t</dd></dl><p class="hint">Km og ferje føres fra fotograf-appen. Satser kan endres.</p></div></div>';
  }
  SV.on('review', function (el) { el.outerHTML = SV.chip('Omtale bedt om', 'ok'); SV.toast('SMS med lenke til Google-omtale sendt til megler'); });

  // ---------- råfiler og utvalg ----------
  function rawCount(j) { return j.services.indexOf('f40') > -1 ? 64 : j.services.indexOf('f30') > -1 ? 48 : 36; }
  function rawView(j) {
    var n = rawCount(j), srcs = [D.img.stue, D.img.kjokken, D.img.loft, D.img.tomanns, D.img.hytte], pick = (SV.state.cull || {})[j.id], need = j.services.indexOf('f40') > -1 ? 40 : j.services.indexOf('f30') > -1 ? 30 : 20;
    if (!pick) { pick = []; for (var k = 0; k < n; k++) if (k % 8 !== 3 && k % 8 !== 6 && pick.length < need) pick.push(k); }
    return '<div class="row between" style="margin-bottom:12px"><p class="small"><b id="cullN">' + pick.length + '</b> av ' + n + ' valgt · pakken er ' + need + ' bilder · <span class="muted">klikk for å velge eller fjerne. Hver «bilde» er en HDR-serie.</span></p><div class="row"><button class="btn btn-ghost btn-s" data-act="cullAuto" data-id="' + j.id + '">Foreslå utvalg</button><button class="btn btn-dark btn-s" data-act="cullSend" data-id="' + j.id + '">' + ic('chev') + 'Send til redigering</button></div></div>' +
      '<div class="raw" id="raw" data-id="' + j.id + '">' + Array.apply(null, { length: n }).map(function (_, k) { return '<figure class="gi' + (pick.indexOf(k) > -1 ? ' on' : '') + '" data-act="cull" data-k="' + k + '">' + SV.pic(srcs[k % 5], POS[k % 8]) + '<span class="gi-n">' + String(k + 1).padStart(3, '0') + '</span></figure>'; }).join('') + '</div>';
  }
  SV.on('cull', function (el) {
    var raw = document.getElementById('raw'), id = raw.getAttribute('data-id'); el.classList.toggle('on');
    SV.state.cull = SV.state.cull || {}; SV.state.cull[id] = [].slice.call(raw.querySelectorAll('.gi.on')).map(function (g) { return +g.getAttribute('data-k'); }); SV.save();
    document.getElementById('cullN').textContent = SV.state.cull[id].length;
  });
  SV.on('cullAuto', function (el) { if (SV.state.cull) delete SV.state.cull[el.getAttribute('data-id')]; SV.save(); SV.render(); SV.toast('Utvalg foreslått: skarpeste serie per rom, uklare og doble fjernet'); });
  SV.on('cullSend', function (el) { var j = job(el.getAttribute('data-id')); SV.state.stage[j.id] = 'Redigering'; SV.save(); SV.render(); SV.toast('Utvalget er sendt til redigering · frist neste virkedag kl. 12'); });

  // ---------- Meglerportalen ----------
  SV.clientCfg.megler = { org: 'Fjordmegling Stord', user: 'Kari Lunde', userRole: 'Eiendomsmegler', home: '#/kunde/megler', tabs: [['#/kunde/megler', 'Oppdrag'], ['#/kunde/megler/bestill', 'Bestill'], ['#/kunde/megler/priser', 'Priser'], ['#/kunde/megler/faktura', 'Fakturaer'], ['#/kunde/megler/innstillinger', 'Innstillinger']] };
  function mine() { return SV.jobs().filter(function (j) { return j.office === 'fjm'; }); }
  var DISC = 0.92;
  function pkg() { return (SV.state.megler && SV.state.megler.pkg) || ['f30', 'dr', 'p2']; }
  function pkgName(list) { return list.map(function (s) { var v = svc(s); return v ? v.name.replace('Boligfoto, ', '').replace(', 8 bilder', '').replace(', per bilde', '') : s; }).join(' + '); }
  function pkgPrice(list) { return list.reduce(function (a, s) { return a + Math.round(svc(s).price * DISC); }, 0); }
  var ADDR = [['Hamnegata 8', 'Leirvik', 'Leilighet', '1126-0436'], ['Hamnegata 12', 'Leirvik', 'Enebolig', '1126-0437'], ['Hamnavegen 3', 'Husnes', 'Rekkehus', '1126-0438'], ['Heiane 14', 'Stord', 'Enebolig', '1126-0439'], ['Havnegata 2B', 'Sagvåg', 'Leilighet', '1126-0440']];

  function statusLine(j) {
    var st = SV.stageOf(j), lic = license(j);
    return st === 'Bestilt' ? [ic('clock'), 'Venter på at ' + esc(j.seller.split(' ')[0]) + ' velger tid'] : st === 'Planlagt' ? [ic('cal'), 'Fotografering ' + SV.fdate(j.date, true) + ' kl. ' + j.time] : st === 'Levert' ? [ic('check'), 'Levert ' + SV.fdate(j.delivered || j.date) + (lic && !lic.sold ? ' · lisens til ' + SV.fdate(lic.exp) : '')] : [ic('edit'), 'Redigeres · klare ' + (j.due ? SV.rel(j.due) : 'neste virkedag')];
  }
  function prog(j) { var cur = D.stages.indexOf(SV.stageOf(j)); return '<span class="prog5" aria-hidden="true">' + D.stages.map(function (_, i) { return '<i class="' + (i < cur || SV.stageOf(j) === 'Levert' ? 'on' : i === cur ? 'now' : '') + '"></i>'; }).join('') + '</span>'; }
  function jrow(j) {
    var st = SV.stageOf(j), sl = statusLine(j);
    return '<a class="jcard" href="#/kunde/megler/' + j.id + '"><span class="jimg">' + SV.pic(j.cover, '50% 60%') + '</span><span style="min-width:0"><b>' + esc(j.addr) + ', ' + esc(j.town) + '</b><small>' + esc(j.broker) + ' · ' + SV.svcShort(j) + '</small><span class="srow">' + sl[0] + sl[1] + '</span>' + prog(j) + '</span>' +
      '<span class="jr">' + (st === 'Levert' ? '<span class="btn btn-acc btn-s" data-act="finn" data-id="' + j.id + '">' + ic('down') + 'Last ned til Finn</span>' : SV.chip(st)) + '</span></a>';
  }

  SV.route('/kunde/megler', 'megler', function () {
    var js = mine(), act = js.filter(function (j) { return SV.stageOf(j) !== 'Levert'; }), done = js.filter(function (j) { return SV.stageOf(j) === 'Levert'; });
    var waiting = act.filter(function (j) { return SV.stageOf(j) === 'Bestilt'; }).length, ready = done.length;
    var full = '<div class="hero-c">' + SV.topo() + '<div><p class="eyebrow" style="color:var(--sand)">Velkommen til meglerportalen</p><h1><span class="serif">Hei, Kari</span></h1><p>Bestill foto på 30 sekunder, følg oppdragene og last ned rett til Finn. Selger får SMS og velger tid selv, så du slipper å koordinere.</p></div><div><a class="btn btn-acc" href="#/kunde/megler/bestill">' + ic('plus') + 'Bestill fotografering</a></div></div>';
    var compact = '<div class="greet"><div><h1>Hei, Kari</h1><div class="kpis" style="margin-top:8px"><span><b>' + act.length + '</b> pågår</span><span><b>' + waiting + '</b> venter på selger</span><span><b>' + ready + '</b> klare til nedlasting</span></div></div><a class="btn btn-ghost btn-s" href="#/kunde/megler/bestill">' + ic('plus') + 'Ny bestilling</a></div>';
    var p = pkg();
    var quick = '<form class="quickorder" onsubmit="return false"><span><b>Bestill som sist</b><br><span class="small muted">' + esc(pkgName(p)) + ' · ' + SV.kr(pkgPrice(p)) + ' eks. mva</span></span><span class="sugg" style="flex:1;min-width:220px"><input class="inp" id="qAddr" placeholder="Skriv adressen …" autocomplete="off" data-input="addrSugg" data-target="q" aria-label="Adresse"><span class="sugg-list" id="sugg-q"></span></span><input class="inp" id="qPhone" placeholder="Selgers mobil" inputmode="tel" style="max-width:170px;flex:0 1 170px" aria-label="Selgers mobil"><button class="btn btn-acc" data-act="quickOrder">Bestill</button></form>';
    return SV.intro('megler', full, compact) + quick +
      '<div class="sec"><div class="sec-h"><h2>Pågår · hele kontoret</h2></div><div class="card jlist">' + act.map(jrow).join('') + '</div></div>' +
      '<div class="sec"><div class="sec-h"><h2>Levert</h2></div><div class="card jlist">' + done.map(jrow).join('') + '</div></div>';
  }, { title: 'Meglerportal' });

  SV.on('addrSugg', function (el) {
    var q = el.value.trim().toLowerCase(), box = document.getElementById('sugg-' + el.getAttribute('data-target'));
    if (q.length < 2) { box.classList.remove('open'); return; }
    var hits = ADDR.filter(function (a) { return (a[0] + ' ' + a[1]).toLowerCase().indexOf(q) > -1; });
    box.innerHTML = hits.length ? hits.map(function (a) { return '<button type="button" data-act="addrPick" data-t="' + el.getAttribute('data-target') + '" data-a="' + esc(a.join('|')) + '"><b>' + esc(a[0]) + '</b> <small>' + esc(a[1]) + ' · ' + esc(a[2]) + ' · oppdrag ' + a[3] + '</small></button>'; }).join('') : '<p class="small muted" style="padding:8px">Ingen treff i Vitec. Skriv adressen fritt.</p>';
    box.classList.add('open');
  });
  SV.on('addrPick', function (el) {
    var a = el.getAttribute('data-a').split('|'), t = el.getAttribute('data-t');
    if (t === 'q') document.getElementById('qAddr').value = a[0] + ', ' + a[1];
    else { var f = document.getElementById('order'); f.addr.value = a[0]; f.town.value = a[1]; f.type.value = a[2]; f.nr.value = a[3]; orderCalc(); }
    el.parentNode.classList.remove('open');
  });
  function newJob(o) {
    var id = 'B-' + (2620 + SV.state.newJobs.length);
    SV.state.newJobs.push(Object.assign({ id: id, office: 'fjm', broker: 'Kari Lunde', stage: 'Bestilt', date: D.W(3), time: '10:00', cover: D.img.stue, by: 'ak', wish: 'Selger velger tid', access: 'Selger hjemme', type: 'Leilighet', seller: 'Selger', phone: '' }, o));
    SV.save(); return id;
  }
  SV.on('quickOrder', function () {
    var a = document.getElementById('qAddr').value.trim(), ph = document.getElementById('qPhone').value.trim();
    if (!a) { SV.toast('Skriv inn adressen', 'warn'); document.getElementById('qAddr').focus(); return; }
    var parts = a.split(','), id = newJob({ addr: parts[0].trim(), town: (parts[1] || 'Leirvik').trim(), nr: '1126-04' + (40 + SV.state.newJobs.length), services: pkg().slice(), phone: ph || '–', seller: 'Selger' });
    SV.go('#/kunde/megler/' + id); SV.toast('Bestilt · selger får SMS og velger tid selv');
  });

  // full bestilling
  SV.route('/kunde/megler/bestill', 'megler', function () {
    var groups = {}; D.boligServices.filter(function (s) { return s.on; }).forEach(function (s) { (groups[s.group] = groups[s.group] || []).push(s); });
    var slots = []; for (var i = 1; i <= 4; i++) { var d = D.W(i); ['09:00', '12:30'].forEach(function (t, k) { if (!(i === 2 && k === 0)) slots.push([d, t]); }); }
    var p = pkg();
    SV.after(orderCalc);
    return SV.head({ eyebrow: 'Fjordmegling Stord · kontorpris −8 %', a: 'Bestill fotografering', lead: 'Adressen hentes fra Vitec når du begynner å skrive. Standardpakken din er valgt på forhånd.' }) +
      '<form id="order" class="g21" onsubmit="return false"><div class="stack">' +
        '<div class="card pad"><h3 class="h3" style="margin-bottom:12px">Boligen</h3><div class="g2"><label class="fld sugg"><span>Adresse</span><input class="inp" name="addr" required autocomplete="off" placeholder="Begynn å skrive …" data-input="addrSugg" data-target="o"><span class="sugg-list" id="sugg-o"></span></label><label class="fld"><span>Sted</span><input class="inp" name="town"></label><label class="fld"><span>Oppdragsnummer</span><input class="inp" name="nr"></label><label class="fld"><span>Boligtype</span><select class="sel" name="type"><option>Enebolig</option><option selected>Leilighet</option><option>Rekkehus</option><option>Fritidsbolig</option><option>Gårdsbruk</option><option>Næring</option></select></label></div></div>' +
        '<div class="card pad"><div class="row between" style="margin-bottom:4px"><h3 class="h3">Tjenester</h3><button type="button" class="link small" data-act="usePkg">Bruk standardpakken</button></div>' + Object.keys(groups).map(function (g) { return '<p class="eyebrow" style="margin:14px 0 8px">' + g + '</p><div class="opts">' + groups[g].map(function (s) { var radio = s.group === 'Foto' && s.id !== 'kv'; return '<label class="opt' + (radio ? ' radio' : '') + '"><input type="' + (radio ? 'radio' : 'checkbox') + '" name="' + (radio ? 'foto' : 's') + '" value="' + s.id + '"' + (p.indexOf(s.id) > -1 ? ' checked' : '') + ' data-change="orderCalc"><b>' + esc(s.name.replace(', per bilde', '')) + '</b><small>' + esc(s.desc) + '</small><span class="price">' + SV.kr(Math.round(s.price * DISC)) + '</span></label>'; }).join('') + '</div>'; }).join('') + '</div>' +
        '<div class="card pad"><h3 class="h3" style="margin-bottom:6px">Tid</h3><p class="small muted" style="margin-bottom:12px">«La selger velge» er raskest: selger får SMS med ledige tider.</p><div class="slots"><label class="opt radio"><input type="radio" name="slot" value="selger" checked data-change="orderCalc"><b>La selger velge</b><small>Anbefalt</small></label>' + slots.map(function (s) { return '<label class="opt radio"><input type="radio" name="slot" value="' + s[0] + ' ' + s[1] + '" data-change="orderCalc"><b>' + SV.fdate(s[0]) + '</b><small>kl. ' + s[1] + '</small></label>'; }).join('') + '</div></div>' +
        '<div class="card pad"><h3 class="h3" style="margin-bottom:12px">Selger og tilgang</h3><div class="g2"><label class="fld"><span>Selgers navn</span><input class="inp" name="seller" placeholder="Navn"></label><label class="fld"><span>Mobil</span><input class="inp" name="phone" inputmode="tel" placeholder="8 siffer"></label><label class="fld"><span>Tilgang</span><select class="sel" name="access"><option>Selger hjemme</option><option>Nøkkel hos megler</option><option>Nøkkelboks</option></select></label><label class="fld"><span>Notat til fotografen</span><input class="inp" name="note" placeholder="F.eks. katt i huset, parkering bak"></label></div></div>' +
      '</div><aside><div class="card pad" style="position:sticky;top:60px"><h3 class="h3">Oppsummering</h3><div id="sum"></div><button class="btn btn-acc" style="width:100%;margin-top:16px" data-act="orderSend">' + ic('check') + 'Send bestilling</button><p class="hint" style="text-align:center">Bekreftelse på e-post med en gang.</p></div></aside></form>';
  }, { title: 'Bestill' });
  function orderVals() {
    var f = document.getElementById('order'); if (!f) return null;
    var sel = [].slice.call(f.querySelectorAll('input[name=foto]:checked,input[name=s]:checked')).map(function (x) { return x.value; });
    return { f: f, sel: sel, slot: (f.querySelector('input[name=slot]:checked') || {}).value };
  }
  function orderCalc() {
    var v = orderVals(); if (!v) return;
    var sum = 0, rows = v.sel.map(function (id) { var s = svc(id), p = Math.round(s.price * DISC); sum += p; return '<div class="li" style="padding:7px 0"><span class="li-t small">' + esc(s.name.replace(', per bilde', '')) + '</span><span class="li-r num small">' + SV.kr(p) + '</span></div>'; }).join('');
    document.getElementById('sum').innerHTML = '<p style="font-weight:700;margin:8px 0 4px">' + esc(v.f.addr.value || 'Ny bolig') + '</p>' + rows +
      '<div class="row between" style="margin-top:10px"><span>Eks. mva</span><b class="num" style="font-size:20px">' + SV.kr(sum) + '</b></div><div class="row between small muted"><span>Inkl. mva</span><span class="num">' + SV.kr(sum * 1.25) + '</span></div><p class="hint">' + (v.slot === 'selger' ? 'Selger velger tid' : 'Tid: ' + SV.fdate(v.slot.split(' ')[0]) + ' kl. ' + v.slot.split(' ')[1]) + ' · samlefaktura til kontoret</p>';
  }
  SV.on('orderCalc', orderCalc);
  SV.on('usePkg', function () { var p = pkg(); document.querySelectorAll('#order input[name=foto],#order input[name=s]').forEach(function (x) { x.checked = p.indexOf(x.value) > -1; }); orderCalc(); });
  SV.on('orderSend', function () {
    var v = orderVals(); if (!v.f.addr.value.trim()) { SV.toast('Skriv inn adressen', 'warn'); v.f.addr.focus(); return; }
    if (!v.sel.length) { SV.toast('Velg minst én tjeneste', 'warn'); return; }
    var f = v.f, slot = v.slot === 'selger' ? null : v.slot.split(' ');
    var id = newJob({ addr: f.addr.value, town: f.town.value || 'Leirvik', nr: f.nr.value || '–', stage: slot ? 'Planlagt' : 'Bestilt', date: slot ? slot[0] : D.W(3), time: slot ? slot[1] : '10:00', services: v.sel, seller: f.seller.value || 'Selger', phone: f.phone.value || '–', access: f.access.value, type: f.type.value, wish: slot ? '' : 'Selger velger tid' });
    SV.go('#/kunde/megler/' + id); SV.toast('Bestilling sendt · selger får SMS');
  });

  // oppdrag sett fra megler
  SV.route('/kunde/megler/:id', 'megler', function (p) {
    var j = job(p.id); if (!j) return '<p class="empty">Fant ikke oppdraget.</p>';
    var st = SV.stageOf(j), ph = photos(j), lic = license(j), done = st === 'Levert', sl = statusLine(j);
    var head = '<p class="small" style="margin-bottom:12px"><a href="#/kunde/megler" class="muted">← Alle oppdrag</a></p>' +
      SV.head({ eyebrow: esc(j.nr) + ' · ' + esc(j.broker), a: j.addr + ', ' + j.town,
        actions: '<button class="btn btn-ghost btn-s" data-act="share" data-id="' + j.id + '">' + ic('link') + 'Del</button>' + (done ? '<span class="split-btn"><button class="btn btn-acc" data-act="finn" data-id="' + j.id + '">' + ic('down') + 'Last ned til Finn</button><button class="btn btn-acc" data-act="dl" aria-label="Andre formater">' + ic('chev', 'rot90') + '</button></span>' : '') }) +
      '<div class="card pad" style="margin-bottom:22px;display:flex;align-items:center;gap:14px;flex-wrap:wrap"><span class="srow" style="margin:0;font-weight:650">' + sl[0] + sl[1] + '</span><span style="margin-left:auto">' + prog(j) + '</span></div>';
    if (!done) {
      return head + '<div class="g2"><div class="card pad"><h3 class="h3">Detaljer</h3><dl class="kv" style="margin-top:12px"><dt>Selger</dt><dd>' + esc(j.seller) + '</dd><dt>Tilgang</dt><dd>' + esc(j.access) + '</dd><dt>Bestilt</dt><dd>' + SV.svcShort(j) + '</dd><dt>Pris</dt><dd>' + SV.kr(Math.round(total(j) * DISC)) + ' eks. mva · ' + SV.kr(total(j) * DISC * 1.25) + ' inkl.</dd></dl>' +
        (st === 'Bestilt' ? '<a class="btn btn-ghost btn-s" style="margin-top:14px" href="#/selger/' + j.id + '">' + ic('eye') + 'Se siden selger får</a>' : '') + '</div>' +
        '<div class="card pad"><h3 class="h3">Legg til</h3><p class="small muted" style="margin:6px 0 12px">Fram til fotograferingen.</p><div class="opts">' + ['dr', 'kv', 're', 'p3'].filter(function (s) { return j.services.indexOf(s) < 0; }).map(function (s) { var v = svc(s); return '<label class="opt"><input type="checkbox" data-change="addSvc" value="' + s + '"><b>' + esc(v.name) + '</b><span class="price">' + SV.kr(Math.round(v.price * DISC)) + '</span></label>'; }).join('') + '</div>' +
        '<button class="link small" style="margin-top:14px" data-act="dummy">Avlys eller flytt</button></div></div>';
    }
    var gal = '<div class="row between" style="margin-bottom:10px"><p class="small muted">' + ph.length + ' bilder · dra for å endre rekkefølge, stjernen setter forsidebilde. Rekkefølgen følger med til Finn.</p><button class="link small" data-act="selAll">Velg alle</button></div><div class="gal big" id="mgal" data-id="' + j.id + '">' +
      ph.map(function (x, n) { return '<figure class="gi" draggable="true" data-i="' + x.i + '">' + SV.pic(x.src, x.pos) + '<span class="gi-n">' + String(n + 1).padStart(2, '0') + ' ' + esc(x.name) + '</span>' + (x.ill ? '<span class="gi-tag">' + SV.chip('Illustrasjon', 'brown') + '</span>' : n === 0 ? '<span class="gi-tag">' + SV.chip('Forsidebilde', 'sand') + '</span>' : '') + '<button type="button" class="gi-cover' + (n === 0 ? ' on' : '') + '" data-act="cover" aria-label="Sett som forsidebilde">' + ic('star') + '</button><button type="button" class="gi-sel" data-act="sel" aria-label="Velg bilde ' + (n + 1) + '">' + ic('check') + '</button></figure>'; }).join('') + '</div>';
    SV.after(galDnd);
    var extras = '<div class="g2 sec">' +
      (j.services.indexOf('vi') > -1 || j.services.indexOf('re') > -1 ? '<div class="card pad"><h3 class="h3" style="margin-bottom:12px">Video</h3><div class="vp">' + SV.pic(j.cover) + '<button class="vp-play" data-act="dummy" aria-label="Spill av">' + ic('play') + '</button></div><p class="small muted" style="margin-top:10px">Liggende 16:9 og stående 9:16 · MP4</p></div>' : '') +
      '<div class="card pad"><h3 class="h3" style="margin-bottom:12px">Boligside</h3><div class="web-prev"><div class="web-bar"><i></i><i></i><i></i><span>bolig.studiovest.no/' + esc(j.addr.toLowerCase().replace(/\s+/g, '-')) + '</span></div><div class="web-hero">' + SV.pic(j.cover) + '<div><b>' + esc(j.addr) + '</b><span class="small">' + esc(j.town) + ' · ' + esc(j.type) + '</span></div></div></div><p class="small muted" style="margin-top:10px">Egen side med bilder, video og plantegning. Del lenken i annonsen eller på SoMe.</p></div>' +
      '<div class="card pad"><h3 class="h3" style="margin-bottom:12px">Plantegning</h3><div style="aspect-ratio:4/3;border-radius:10px;background:#fff;box-shadow:inset 0 0 0 1px var(--line);position:relative;overflow:hidden">' + planSvg() + '</div></div>' +
      '<div class="card pad"><h3 class="h3">Bruk av bildene</h3><p class="small" style="margin-top:8px">' + lic.text + '</p><p class="small" style="margin-top:8px">Krediter med <b>«Foto: Studiovest»</b>. Bilder merket «Illustrasjon» skal vises med merkingen.</p><div class="row" style="margin-top:14px"><button class="btn btn-ghost btn-xs" data-act="fix">' + ic('edit') + 'Be om endring</button><button class="btn btn-ghost btn-xs" data-act="dummy">' + ic('plus') + 'Bestill digital møblering</button></div></div></div>';
    return head + gal + extras;
  }, { title: 'Oppdrag' });

  function galDnd() {
    var g = document.getElementById('mgal'); if (!g) return; var drag = null;
    g.addEventListener('dragstart', function (e) { drag = e.target.closest('.gi'); if (drag) drag.classList.add('dragging'); });
    g.addEventListener('dragend', function () { if (drag) drag.classList.remove('dragging'); g.querySelectorAll('.drop-before').forEach(function (x) { x.classList.remove('drop-before'); }); });
    g.addEventListener('dragover', function (e) { e.preventDefault(); var t = e.target.closest('.gi'); g.querySelectorAll('.drop-before').forEach(function (x) { x.classList.remove('drop-before'); }); if (t && t !== drag) t.classList.add('drop-before'); });
    g.addEventListener('drop', function (e) { e.preventDefault(); var t = e.target.closest('.gi'); if (!t || !drag || t === drag) return; g.insertBefore(drag, t); saveOrder(g); SV.render(); SV.toast('Rekkefølgen er lagret'); });
  }
  function saveOrder(g) { SV.state.order = SV.state.order || {}; SV.state.order[g.getAttribute('data-id')] = [].slice.call(g.querySelectorAll('.gi')).map(function (x) { return +x.getAttribute('data-i'); }); SV.save(); }
  SV.on('cover', function (el, ev) { ev.stopPropagation(); var g = document.getElementById('mgal'), f = el.closest('.gi'); g.insertBefore(f, g.firstChild); saveOrder(g); SV.render(); SV.toast('Forsidebilde satt'); });
  SV.on('addSvc', function (el) { if (el.checked) SV.toast(svc(el.value).name + ' lagt til · fotografen er varslet'); });
  SV.on('sel', function (el, ev) { ev.stopPropagation(); el.closest('.gi').classList.toggle('on'); var n = document.querySelectorAll('#mgal .gi.on').length; SV.toast(n ? n + ' bilder valgt' : 'Ingen valgt · alle lastes ned'); });
  SV.on('selAll', function () { var all = document.querySelectorAll('#mgal .gi'), on = document.querySelectorAll('#mgal .gi.on').length < all.length; all.forEach(function (g) { g.classList.toggle('on', on); }); });
  SV.on('finn', function (el, ev) { if (ev) { ev.preventDefault(); ev.stopPropagation(); } SV.toast('Finn-pakke lastes ned: bilder i valgt rekkefølge + plantegning'); });
  SV.on('dl', function () {
    var n = document.querySelectorAll('#mgal .gi.on').length || document.querySelectorAll('#mgal .gi').length;
    SV.modal('<p class="eyebrow">Last ned ' + n + ' bilder</p><h2 class="h2"><span class="serif">Andre formater</span></h2><div class="stack" style="margin-top:14px">' +
      [['Trykk', 'Full oppløsning for prospekt', true], ['SoMe 4:5', 'Instagram og Facebook-feed', false], ['SoMe 9:16', 'Stories og reels', false], ['Plantegning', 'PDF og PNG', false], ['Video', 'MP4', false]].map(function (x) { return '<label class="opt"><input type="checkbox"' + (x[2] ? ' checked' : '') + '><b>' + x[0] + '</b><small>' + x[1] + '</small></label>'; }).join('') +
      '</div><div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn btn-acc" data-act="dlGo">' + ic('down') + 'Last ned</button></div>');
  });
  SV.on('dlGo', function () { SV.close(); SV.toast('Filene lastes ned · lenken sendes også på e-post'); });
  SV.on('share', function (el) {
    var j = job(el.getAttribute('data-id')), url = 'portal.studiovest.no/d/' + j.id.toLowerCase() + '-7k2q';
    SV.modal('<h2 class="h2"><span class="serif">Del ' + esc(j.addr) + '</span></h2><p class="small muted">Mottakeren ser bare dette oppdraget, ikke resten av portalen.</p><div class="stack" style="margin-top:14px">' +
      [['Selger', 'Ser status og bildene når de er klare. Kan ikke laste ned trykkfiler.', true], ['Boligstylist', 'Ser tid og adresse, og kan legge inn notat til fotografen.', false], ['Kollega på kontoret', 'Full tilgang til nedlasting.', false]].map(function (x, i) { return '<label class="opt radio"><input type="radio" name="sh"' + (x[2] ? ' checked' : '') + '><b>' + x[0] + '</b><small>' + x[1] + '</small></label>'; }).join('') +
      '</div><div class="row" style="margin-top:14px;flex-wrap:nowrap"><input class="inp" readonly value="' + url + '" aria-label="Lenke"><button class="btn btn-dark" data-act="copyLink">Kopier</button></div><p class="hint">Eller send på SMS: skriv mobilnummer under.</p><div class="row" style="margin-top:8px;flex-wrap:nowrap"><input class="inp" placeholder="Mobilnummer" inputmode="tel"><button class="btn btn-ghost" data-act="copyLink">Send</button></div>');
  });
  SV.on('copyLink', function () { SV.close(); SV.toast('Lenken er delt'); });
  SV.on('fix', function () {
    SV.modal('<h2 class="h2"><span class="serif">Be om endring</span></h2><label class="fld" style="margin-top:14px"><span>Bilde</span><select class="sel"><option>03 Kjøkken</option><option>05 Soverom</option><option>Alle</option></select></label><label class="fld"><span>Hva skal endres?</span><textarea class="txt" placeholder="F.eks. fjern ledningen over benken"></textarea></label><div class="row" style="justify-content:flex-end"><button class="btn btn-dark" data-act="fixSend">Send</button></div>');
  });
  SV.on('fixSend', function () { SV.close(); SV.toast('Sendt til redigering · svar innen neste virkedag'); });
  function planSvg() {
    return '<svg viewBox="0 0 400 300" style="position:absolute;inset:0;width:100%;height:100%" fill="none" stroke="#161412" stroke-width="3"><rect x="30" y="30" width="340" height="240"/><path d="M200 30v120M30 150h230M260 150v120M260 210h110M120 150v120"/><path d="M200 70a30 30 0 0 1 30 30" stroke-width="1.5"/><g font-family="Hanken Grotesk,sans-serif" font-size="13" fill="#6E665D" stroke="none"><text x="80" y="95">STUE 28 m²</text><text x="250" y="95">KJØKKEN 12 m²</text><text x="45" y="215">SOV 11 m²</text><text x="150" y="215">SOV 9 m²</text><text x="290" y="185">BAD 6 m²</text><text x="285" y="245">GANG</text></g></svg>';
  }
  SV.planSvg = planSvg;

  SV.route('/kunde/megler/priser', 'megler', function () {
    return SV.head({ eyebrow: 'Kontorpris −8 % · Fjordmegling Stord', a: 'Priser', lead: 'Dine priser etter kontoravtalen.' }) +
      '<div class="card tbl-w"><table class="tbl"><thead><tr><th>Tjeneste</th><th class="r hide-s">Listepris</th><th class="r">Din pris eks. mva</th><th class="r hide-s">Inkl. mva</th></tr></thead><tbody>' + D.boligServices.filter(function (s) { return s.on; }).map(function (s) { var p = Math.round(s.price * DISC); return '<tr><td><b>' + esc(s.name) + '</b><small>' + esc(s.desc) + '</small></td><td class="r num muted hide-s">' + SV.kr(s.price) + '</td><td class="r num"><b>' + SV.kr(p) + '</b></td><td class="r num hide-s">' + SV.kr(p * 1.25) + '</td></tr>'; }).join('') + '</tbody></table></div>';
  }, { title: 'Priser' });
  SV.route('/kunde/megler/faktura', 'megler', function () {
    return SV.head({ eyebrow: 'Samlefaktura til kontoret · EHF', a: 'Fakturaer' }) +
      '<div class="card tbl-w"><table class="tbl"><thead><tr><th>Nr.</th><th>Periode</th><th>Oppdrag</th><th>Status</th><th class="r">Beløp</th></tr></thead><tbody>' +
      [['26-1184', 'September', 11, 'Betalt', 48230], ['26-1122', 'August', 9, 'Betalt', 39870], ['–', 'Oktober (utkast)', 7, 'Utkast', 31150]].map(function (r) { return '<tr><td class="num">' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td><td>' + SV.chip(r[3]) + '</td><td class="r num"><b>' + SV.kr(r[4]) + '</b></td></tr>'; }).join('') + '</tbody></table></div><p class="hint">Hver linje har oppdragsnummeret fra Vitec, så fakturaen kan fordeles på riktig oppdrag.</p>';
  }, { title: 'Fakturaer' });

  SV.route('/kunde/megler/innstillinger', 'megler', function () {
    var p = pkg(), n = (SV.state.megler && SV.state.megler.notif) || { sms_tid: true, sms_klar: true, mail_klar: true, push_klar: false, mail_uke: true };
    return SV.head({ a: 'Innstillinger', lead: 'Standardpakken brukes i «Bestill som sist». Velg hvordan du vil få beskjed.' }) +
      '<div class="g2"><div class="card pad"><h3 class="h3" style="margin-bottom:12px">Standardpakke</h3><div class="stack" id="pkgSet">' + D.boligServices.filter(function (s) { return s.on && s.id !== 'f20' && s.id !== 'f40'; }).concat([svc('f20'), svc('f40')]).map(function (s) { return '<label class="opt"><input type="checkbox" value="' + s.id + '"' + (p.indexOf(s.id) > -1 ? ' checked' : '') + ' data-change="pkgSave"><b>' + esc(s.name) + '</b><span class="price">' + SV.kr(Math.round(s.price * DISC)) + '</span></label>'; }).join('') + '</div></div>' +
      '<div class="card pad"><h3 class="h3" style="margin-bottom:12px">Varsler</h3><table class="tbl"><thead><tr><th>Når</th><th>SMS</th><th>E-post</th><th>Push</th></tr></thead><tbody>' +
        [['Selger har valgt tid', 'tid'], ['Bildene er klare', 'klar'], ['Lisens utløper snart', 'lis'], ['Ukesoversikt fredag', 'uke']].map(function (r) { return '<tr><td>' + r[0] + '</td>' + ['sms', 'mail', 'push'].map(function (c) { var k = c + '_' + r[1]; return '<td><label class="sw"><input type="checkbox" data-change="notif" data-k="' + k + '"' + (n[k] ? ' checked' : '') + ' aria-label="' + r[0] + ' ' + c + '"><span></span></label></td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table><p class="hint">Push krever at portalen er lagt til på hjemskjermen.</p></div></div>';
  }, { title: 'Innstillinger' });
  SV.on('pkgSave', function () { SV.state.megler = SV.state.megler || {}; SV.state.megler.pkg = [].slice.call(document.querySelectorAll('#pkgSet input:checked')).map(function (x) { return x.value; }); SV.save(); SV.toast('Standardpakken er lagret'); });
  SV.on('notif', function (el) { SV.state.megler = SV.state.megler || {}; var n = SV.state.megler.notif = SV.state.megler.notif || { sms_tid: true, sms_klar: true, mail_klar: true, mail_uke: true }; n[el.getAttribute('data-k')] = el.checked; SV.save(); SV.toast('Lagret'); });
})();
