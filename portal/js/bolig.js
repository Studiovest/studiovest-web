/* Bolig: studio-tavle, oppdrag, tjenester, meglerkontor + meglerportalen. */
(function () {
  'use strict';
  var SV = window.SV, D = SV.data, esc = SV.esc, ic = SV.icon;

  SV.jobs = function () { return D.boligJobs.concat(SV.state.newJobs); };
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
    return out;
  }
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
      '<div class="kb-meta">' + when + '<span style="margin-left:auto">' + SV.avatar(SV.find(D.team, j.by).name, 'tiny') + '</span></div></div></a>';
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
  SV.on('stageNext', function (el) {
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
      (lic ? '<div class="callout sage">' + ic('shield') + '<span><b>Bildelisens:</b> ' + lic.text + ' Kreditering: «Foto: Studiovest».</span></div>' : '') + '</div></div>';
    var gal = '<div class="row between" style="margin-bottom:12px"><p class="small muted">' + ph.length + ' bilder · klikk for å velge omslag og rekkefølge</p><button class="btn btn-ghost btn-xs" data-act="dummy">' + ic('upload') + 'Last opp redigerte</button></div><div class="gal">' +
      ph.map(function (x) { return '<figure class="gi" data-act="lightbox" data-src="' + x.src + '" data-pos="' + x.pos + '" data-name="' + esc(x.name) + '">' + SV.pic(x.src, x.pos) + '<span class="gi-n">' + String(x.i + 1).padStart(2, '0') + ' ' + esc(x.name) + '</span>' + (x.i === 0 ? '<span class="gi-tag">' + SV.chip('Omslag', 'sand') + '</span>' : x.ill ? '<span class="gi-tag">' + SV.chip('Illustrasjon', 'brown') + '</span>' : '') + '</figure>'; }).join('') + '</div>';
    var lev = '<div class="g3">' + [['Finn og nett', 'Web-optimalisert, sRGB, liggende og stående', 'down'], ['Trykk', 'Full oppløsning for prospekt og skilt', 'file'], ['SoMe', '4:5 og 9:16, klar til Instagram og Facebook', 'grid'], ['Plantegning', 'PDF og PNG, 2D' + (j.services.indexOf('p3') > -1 ? ' + 3D' : ''), 'plan'], ['Video', j.services.indexOf('vi') > -1 || j.services.indexOf('re') > -1 ? 'MP4 liggende og stående' : 'Ikke bestilt', 'video'], ['Boligside', 'Egen side med bilder, video og plantegning', 'link']].map(function (x) { return '<div class="card pad"><p class="row">' + ic(x[2]) + '<b>' + x[0] + '</b></p><p class="small muted" style="margin-top:6px">' + x[1] + '</p></div>'; }).join('') + '</div>' +
      '<p class="hint" style="margin-top:12px">Alle formatene lages automatisk fra de redigerte filene når oppdraget settes til Levert.</p>';
    return '<p class="small" style="margin-bottom:14px"><a href="#/bolig" class="muted">' + '← Bolig</a></p>' +
      SV.head({ eyebrow: SV.dot('bolig') + esc(j.id) + ' · ' + esc(o.name) + ' · ' + SV.chip(st), a: j.addr, b: j.town,
        actions: (i < D.stages.length - 1 ? '<button class="btn btn-dark btn-s" data-act="stageNext" data-id="' + j.id + '">Flytt til ' + D.stages[i + 1] + ' ' + ic('chev') + '</button>' : '') + '<a class="btn btn-ghost btn-s" href="#/kunde/megler/' + j.id + '">' + ic('eye') + 'Slik ser megler det</a>' }) +
      '<div class="card pad" style="margin-bottom:22px">' + steps(j) + '</div>' +
      SV.tabs('job', [['o', 'Oversikt'], ['b', 'Bilder', ph.length], ['l', 'Leveranse']], 'o') + SV.panels('job', { o: ov, b: gal, l: lev }, 'o');
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

  // ---------- Meglerportalen ----------
  SV.clientCfg.megler = { org: 'Fjordmegling Stord', user: 'Kari Lunde', userRole: 'Eiendomsmegler', home: '#/kunde/megler', tabs: [['#/kunde/megler', 'Oppdrag'], ['#/kunde/megler/bestill', 'Bestill'], ['#/kunde/megler/priser', 'Priser'], ['#/kunde/megler/faktura', 'Fakturaer']] };
  function mine() { return SV.jobs().filter(function (j) { return j.office === 'fjm'; }); }

  SV.route('/kunde/megler', 'megler', function () {
    var js = mine(), act = js.filter(function (j) { return SV.stageOf(j) !== 'Levert'; }), done = js.filter(function (j) { return SV.stageOf(j) === 'Levert'; });
    var li = function (j) {
      var st = SV.stageOf(j);
      return '<a class="card" href="#/kunde/megler/' + j.id + '" style="display:grid;grid-template-columns:150px 1fr;text-decoration:none;overflow:hidden"><div style="background:var(--stone)">' + SV.pic(j.cover, '50% 60%', '', '') .replace('<img', '<img style="width:100%;height:100%;object-fit:cover"') + '</div><div class="pad"><div class="row between"><b style="font-size:17px">' + esc(j.addr) + ', ' + esc(j.town) + '</b>' + SV.chip(st) + '</div><p class="small muted" style="margin:4px 0 14px">' + esc(j.nr) + ' · ' + esc(j.broker) + ' · ' + SV.svcShort(j) + '</p>' + steps(j) +
        '<p class="small" style="margin-top:12px">' + (st === 'Bestilt' ? 'Vi avtaler tid med selger. ' + esc(j.seller.split(' ')[0]) + ' har fått SMS.' : st === 'Planlagt' ? ic('cal') + ' Fotografering ' + SV.fdate(j.date, true) + ' kl. ' + j.time : st === 'Levert' ? ic('check') + ' Klar til nedlasting' : 'Bildene redigeres · klare ' + (j.due ? SV.rel(j.due) : 'snart')) + '</p></div></a>';
    };
    return '<div class="hero-c">' + SV.topo() + '<div><p class="eyebrow" style="color:var(--sand)">Meglerportal</p><h1><span class="serif">Hei,</span> <span class="bold">Kari</span></h1><p>Her bestiller du foto, følger oppdragene og laster ned alt i riktig format. Selger får SMS og velger tid selv, så du slipper å koordinere.</p></div>' +
        '<div><div class="count"><div><b>' + act.length + '</b><span>Aktive</span></div><div><b>' + done.length + '</b><span>Levert</span></div><div><b>1</b><span>Neste dag</span></div></div><a class="btn btn-acc" style="margin-top:16px" href="#/kunde/megler/bestill">' + ic('plus') + 'Bestill fotografering</a></div></div>' +
      '<div class="sec"><div class="sec-h"><h2>Aktive oppdrag · hele kontoret</h2></div><div class="stack">' + act.map(li).join('') + '</div></div>' +
      '<div class="sec"><div class="sec-h"><h2>Levert</h2></div><div class="stack">' + done.map(li).join('') + '</div></div>';
  }, { title: 'Meglerportal' });

  // bestilling
  SV.route('/kunde/megler/bestill', 'megler', function () {
    var groups = {}; D.boligServices.filter(function (s) { return s.on; }).forEach(function (s) { (groups[s.group] = groups[s.group] || []).push(s); });
    var slots = []; for (var i = 1; i <= 4; i++) { var d = D.W(i); ['09:00', '12:30'].forEach(function (t, k) { if (!(i === 2 && k === 0)) slots.push([d, t]); }); }
    SV.after(orderCalc);
    return SV.head({ eyebrow: 'Fjordmegling Stord · kontorpris', a: 'Bestill', b: 'fotografering', lead: 'Tar under ett minutt. Vi kontakter selger og bekrefter tiden til deg.' }) +
      '<div class="wiz" aria-hidden="true"><span class="on"><i>1</i>Bolig</span><span><i>2</i>Tjenester</span><span><i>3</i>Tid</span><span><i>4</i>Selger og tilgang</span></div>' +
      '<form id="order" class="g21" onsubmit="return false"><div class="stack">' +
        '<div class="card pad"><h3 class="h3" style="margin-bottom:14px">1 · Boligen</h3><div class="g2"><label class="fld"><span>Adresse</span><input class="inp" name="addr" required value="Hamnegata 8" data-input="orderCalc"></label><label class="fld"><span>Sted</span><input class="inp" name="town" value="Leirvik"></label><label class="fld"><span>Oppdragsnummer</span><input class="inp" name="nr" value="1126-0436"><p class="hint">Hentes fra Vitec Next når integrasjonen er på plass.</p></label><label class="fld"><span>Boligtype</span><select class="sel" name="type"><option>Enebolig</option><option selected>Leilighet</option><option>Rekkehus</option><option>Fritidsbolig</option><option>Gårdsbruk</option><option>Næring</option></select></label></div></div>' +
        '<div class="card pad"><h3 class="h3" style="margin-bottom:14px">2 · Tjenester</h3>' + Object.keys(groups).map(function (g) { return '<p class="eyebrow" style="margin:14px 0 8px">' + g + '</p><div class="opts">' + groups[g].map(function (s) { return '<label class="opt' + (s.group === 'Foto' && s.id !== 'kv' ? ' radio' : '') + '"><input type="' + (s.group === 'Foto' && s.id !== 'kv' ? 'radio' : 'checkbox') + '" name="' + (s.group === 'Foto' && s.id !== 'kv' ? 'foto' : 's') + '" value="' + s.id + '"' + (s.id === 'f20' || s.id === 'p2' ? ' checked' : '') + ' data-change="orderCalc"><b>' + esc(s.name.replace(', per bilde', '')) + '</b><small>' + esc(s.desc) + '</small><span class="price">' + SV.kr(Math.round(s.price * 0.92)) + '</span></label>'; }).join('') + '</div>'; }).join('') + '</div>' +
        '<div class="card pad"><h3 class="h3" style="margin-bottom:6px">3 · Tid</h3><p class="small muted" style="margin-bottom:14px">Ledige luker de neste dagene. Velg «La selger velge», så får selger lenke på SMS.</p><div class="slots"><label class="opt radio"><input type="radio" name="slot" value="selger" checked data-change="orderCalc"><b>La selger velge</b><small>Anbefalt</small></label>' + slots.map(function (s) { return '<label class="opt radio"><input type="radio" name="slot" value="' + s[0] + ' ' + s[1] + '" data-change="orderCalc"><b>' + SV.fdate(s[0]) + '</b><small>kl. ' + s[1] + '</small></label>'; }).join('') + '</div></div>' +
        '<div class="card pad"><h3 class="h3" style="margin-bottom:14px">4 · Selger og tilgang</h3><div class="g2"><label class="fld"><span>Selgers navn</span><input class="inp" name="seller" value="Tone Kalvik"></label><label class="fld"><span>Mobil</span><input class="inp" name="phone" value="917 20 445" inputmode="tel"></label><label class="fld"><span>Tilgang</span><select class="sel" name="access"><option>Selger hjemme</option><option>Nøkkel hos megler</option><option>Nøkkelboks</option></select></label><label class="fld"><span>Notat til fotografen</span><input class="inp" name="note" placeholder="F.eks. katt i huset, parkering bak"></label></div>' +
          '<label class="opt" style="margin-top:4px"><input type="checkbox" checked><b>Send selger klargjøringsliste på SMS</b><small>«Slik gjør du boligen klar til fotografering»</small></label></div>' +
      '</div><aside><div class="card pad" style="position:sticky;top:60px"><p class="eyebrow">Oppsummering</p><div id="sum"></div><button class="btn btn-acc" style="width:100%;margin-top:16px" data-act="orderSend">' + ic('check') + 'Send bestilling</button><p class="hint" style="text-align:center">Du får bekreftelse på e-post med en gang.</p></div></aside></form>';
  }, { title: 'Bestill' });
  function orderVals() {
    var f = document.getElementById('order'); if (!f) return null;
    var sel = [].slice.call(f.querySelectorAll('input[name=foto]:checked,input[name=s]:checked')).map(function (x) { return x.value; });
    return { f: f, sel: sel, slot: (f.querySelector('input[name=slot]:checked') || {}).value };
  }
  function orderCalc() {
    var v = orderVals(); if (!v) return;
    var sum = 0, rows = v.sel.map(function (id) { var s = svc(id), p = Math.round(s.price * 0.92); sum += p; return '<div class="li" style="padding:8px 0"><span class="li-t small">' + esc(s.name.replace(', per bilde', '')) + '</span><span class="li-r num small">' + SV.kr(p) + '</span></div>'; }).join('');
    document.getElementById('sum').innerHTML = '<p style="font-weight:800;font-size:17px;margin:4px 0 8px">' + esc(v.f.addr.value || 'Ny bolig') + '</p>' + rows +
      '<div class="row between" style="margin-top:12px"><span>Sum eks. mva</span><b class="num" style="font-size:20px">' + SV.kr(sum) + '</b></div><p class="hint">' + (v.slot === 'selger' ? 'Selger velger tid' : 'Tid: ' + SV.fdate(v.slot.split(' ')[0]) + ' kl. ' + v.slot.split(' ')[1]) + ' · Faktura på samlefaktura til kontoret</p>';
  }
  SV.on('orderCalc', orderCalc);
  SV.on('orderSend', function () {
    var v = orderVals(); if (!v.f.addr.value.trim()) { SV.toast('Skriv inn adressen', 'warn'); v.f.addr.focus(); return; }
    if (!v.sel.length) { SV.toast('Velg minst én tjeneste', 'warn'); return; }
    var id = 'B-' + (2620 + SV.state.newJobs.length), f = v.f, slot = v.slot === 'selger' ? null : v.slot.split(' ');
    SV.state.newJobs.push({ id: id, addr: f.addr.value, town: f.town.value, office: 'fjm', broker: 'Kari Lunde', nr: f.nr.value, stage: slot ? 'Planlagt' : 'Bestilt', date: slot ? slot[0] : D.W(3), time: slot ? slot[1] : '10:00', services: v.sel, seller: f.seller.value, phone: f.phone.value, access: f.access.value, type: f.type.value, cover: D.img.stue, by: 'ak', wish: slot ? '' : 'Selger velger tid' });
    SV.save(); SV.go('#/kunde/megler/' + id); SV.toast('Bestilling sendt · bekreftelse på e-post, selger får SMS');
  });

  // oppdrag sett fra megler
  SV.route('/kunde/megler/:id', 'megler', function (p) {
    var j = job(p.id); if (!j) return '<p class="empty">Fant ikke oppdraget.</p>';
    var st = SV.stageOf(j), ph = photos(j), lic = license(j), done = st === 'Levert';
    var head = '<p class="small" style="margin-bottom:14px"><a href="#/kunde/megler" class="muted">← Alle oppdrag</a></p>' +
      SV.head({ eyebrow: esc(j.nr) + ' · ' + esc(j.broker) + ' · ' + SV.chip(st), a: j.addr, b: j.town, actions: done ? '<button class="btn btn-acc" data-act="dl" data-id="' + j.id + '">' + ic('down') + 'Last ned</button>' : '' }) + '<div class="card pad" style="margin-bottom:24px">' + steps(j) + '</div>';
    if (!done) {
      return head + '<div class="g2"><div class="card pad"><h3 class="h3">Status</h3><p style="margin-top:8px">' + (st === 'Bestilt' ? 'Vi har sendt SMS til ' + esc(j.seller) + ' med ledige tider. Du får beskjed så snart tiden er valgt.' : st === 'Planlagt' ? 'Fotografering ' + SV.fdate(j.date, true) + ' kl. ' + j.time + '. Selger har fått klargjøringsliste.' : 'Fotografert. Bildene redigeres og er klare ' + (j.due ? SV.rel(j.due) : 'neste virkedag') + '.') + '</p>' +
        '<dl class="kv" style="margin-top:16px"><dt>Selger</dt><dd>' + esc(j.seller) + '</dd><dt>Tilgang</dt><dd>' + esc(j.access) + '</dd><dt>Bestilt</dt><dd>' + SV.svcShort(j) + '</dd><dt>Pris</dt><dd>' + SV.kr(Math.round(total(j) * 0.92)) + ' eks. mva</dd></dl></div>' +
        '<div class="card pad"><h3 class="h3">Endre bestillingen</h3><p class="small muted" style="margin:6px 0 14px">Legg til tjenester fram til fotograferingen.</p><div class="opts">' + ['dr', 'kv', 're', 'p3'].filter(function (s) { return j.services.indexOf(s) < 0; }).map(function (s) { var v = svc(s); return '<label class="opt"><input type="checkbox" data-change="addSvc" data-id="' + j.id + '" value="' + s + '"><b>' + esc(v.name) + '</b><span class="price">' + SV.kr(Math.round(v.price * 0.92)) + '</span></label>'; }).join('') + '</div>' +
        '<button class="link small" style="margin-top:14px" data-act="dummy">Avlys eller flytt</button></div></div>';
    }
    var gal = '<div class="row between" style="margin-bottom:12px"><p class="small muted">' + ph.length + ' bilder · velg bilder for å laste ned et utvalg</p><button class="link small" data-act="selAll">Velg alle</button></div><div class="gal big" id="mgal">' +
      ph.map(function (x) { return '<figure class="gi" data-i="' + x.i + '">' + SV.pic(x.src, x.pos) + '<span class="gi-n">' + String(x.i + 1).padStart(2, '0') + ' ' + esc(x.name) + '</span>' + (x.ill ? '<span class="gi-tag">' + SV.chip('Illustrasjon', 'brown') + '</span>' : '') + '<button type="button" class="gi-sel" data-act="sel" aria-label="Velg bilde ' + (x.i + 1) + '">' + ic('check') + '</button></figure>'; }).join('') + '</div>';
    var extras = '<div class="g2 sec">' +
      (j.services.indexOf('vi') > -1 || j.services.indexOf('re') > -1 ? '<div class="card pad"><h3 class="h3" style="margin-bottom:12px">Video</h3><div class="vp">' + SV.pic(j.cover) + '<button class="vp-play" data-act="dummy" aria-label="Spill av">' + ic('play') + '</button></div><p class="small muted" style="margin-top:10px">Liggende 16:9 og stående 9:16 · MP4</p></div>' : '') +
      '<div class="card pad"><h3 class="h3" style="margin-bottom:12px">Boligside</h3><div class="web-prev"><div class="web-bar"><i></i><i></i><i></i><span>bolig.studiovest.no/' + esc(j.addr.toLowerCase().replace(/\s+/g, '-')) + '</span></div><div class="web-hero">' + SV.pic(j.cover) + '<div><b>' + esc(j.addr) + '</b><span class="small">' + esc(j.town) + ' · ' + esc(j.type) + '</span></div></div></div><p class="small muted" style="margin-top:10px">Egen side med bilder, video og plantegning, med eller uten meglers logo. Del lenken i annonsen eller på SoMe.</p></div>' +
      '<div class="card pad"><h3 class="h3" style="margin-bottom:12px">Plantegning</h3><div style="aspect-ratio:4/3;border-radius:10px;background:#fff;box-shadow:inset 0 0 0 1px var(--line);position:relative;overflow:hidden">' + planSvg() + '</div></div>' +
      '<div class="card pad"><h3 class="h3">Bruk av bildene</h3><p class="small" style="margin-top:8px">' + lic.text + '</p><p class="small" style="margin-top:8px">Krediter med <b>«Foto: Studiovest»</b>. Digitalt møblerte bilder er merket «Illustrasjon» og skal vises med den merkingen.</p><div class="row" style="margin-top:14px"><button class="btn btn-ghost btn-xs" data-act="fix">' + ic('edit') + 'Be om endring</button><button class="btn btn-ghost btn-xs" data-act="dummy">' + ic('plus') + 'Bestill digital møblering</button></div></div></div>';
    return head + gal + extras;
  }, { title: 'Oppdrag' });
  SV.on('addSvc', function (el) { if (el.checked) SV.toast(svc(el.value).name + ' lagt til · fotografen er varslet'); });
  SV.on('sel', function (el, ev) { ev.stopPropagation(); el.closest('.gi').classList.toggle('on'); var n = document.querySelectorAll('#mgal .gi.on').length; SV.toast(n ? n + ' bilder valgt' : 'Ingen valgt · alle lastes ned'); });
  SV.on('selAll', function () { var all = document.querySelectorAll('#mgal .gi'), on = document.querySelectorAll('#mgal .gi.on').length < all.length; all.forEach(function (g) { g.classList.toggle('on', on); }); });
  SV.on('dl', function () {
    var n = document.querySelectorAll('#mgal .gi.on').length || document.querySelectorAll('#mgal .gi').length;
    SV.modal('<p class="eyebrow">Last ned ' + n + ' bilder</p><h2 class="h2"><span class="serif">Velg</span> <span class="bold">format</span></h2><div class="stack" style="margin-top:16px">' +
      [['Finn og nett', 'Web-optimalisert, sRGB', true], ['Trykk', 'Full oppløsning for prospekt', false], ['SoMe 4:5', 'Instagram og Facebook-feed', false], ['SoMe 9:16', 'Stories og reels', false], ['Plantegning', 'PDF og PNG', true], ['Video', 'MP4', false]].map(function (x) { return '<label class="opt"><input type="checkbox"' + (x[2] ? ' checked' : '') + '><b>' + x[0] + '</b><small>' + x[1] + '</small></label>'; }).join('') +
      '</div><div class="row" style="justify-content:flex-end;margin-top:18px"><button class="btn btn-acc" data-act="dlGo">' + ic('down') + 'Last ned ZIP</button></div>');
  });
  SV.on('dlGo', function () { SV.close(); SV.toast('ZIP lages · lenken sendes også på e-post (demo)'); });
  SV.on('fix', function () {
    SV.modal('<p class="eyebrow">Be om endring</p><h2 class="h2"><span class="serif">Hva skal</span> <span class="bold">endres?</span></h2><label class="fld" style="margin-top:16px"><span>Bilde</span><select class="sel"><option>03 Kjøkken</option><option>05 Soverom</option><option>Alle</option></select></label><label class="fld"><span>Beskrivelse</span><textarea class="txt" placeholder="F.eks. fjern ledningen over benken"></textarea></label><div class="row" style="justify-content:flex-end"><button class="btn btn-dark" data-act="fixSend">Send</button></div>');
  });
  SV.on('fixSend', function () { SV.close(); SV.toast('Sendt til redigering · svar innen neste virkedag'); });
  function planSvg() {
    return '<svg viewBox="0 0 400 300" style="position:absolute;inset:0;width:100%;height:100%" fill="none" stroke="#161412" stroke-width="3"><rect x="30" y="30" width="340" height="240"/><path d="M200 30v120M30 150h230M260 150v120M260 210h110M120 150v120"/><path d="M200 70a30 30 0 0 1 30 30" stroke-width="1.5"/><g font-family="Hanken Grotesk,sans-serif" font-size="13" fill="#6E665D" stroke="none"><text x="80" y="95">STUE 28 m²</text><text x="250" y="95">KJØKKEN 12 m²</text><text x="45" y="215">SOV 11 m²</text><text x="150" y="215">SOV 9 m²</text><text x="290" y="185">BAD 6 m²</text><text x="285" y="245">GANG</text></g></svg>';
  }
  SV.planSvg = planSvg;

  SV.route('/kunde/megler/priser', 'megler', function () {
    return SV.head({ eyebrow: 'Kontorpris −8 % · Fjordmegling Stord', a: 'Priser', lead: 'Dine priser etter kontoravtalen, eks. mva.' }) +
      '<div class="card tbl-w"><table class="tbl"><thead><tr><th>Tjeneste</th><th class="r">Listepris</th><th class="r">Din pris</th></tr></thead><tbody>' + D.boligServices.filter(function (s) { return s.on; }).map(function (s) { return '<tr><td><b>' + esc(s.name) + '</b><small>' + esc(s.desc) + '</small></td><td class="r num muted">' + SV.kr(s.price) + '</td><td class="r num"><b>' + SV.kr(Math.round(s.price * 0.92)) + '</b></td></tr>'; }).join('') + '</tbody></table></div>';
  }, { title: 'Priser' });
  SV.route('/kunde/megler/faktura', 'megler', function () {
    return SV.head({ eyebrow: 'Samlefaktura til kontoret · EHF', a: 'Fakturaer' }) +
      '<div class="card tbl-w"><table class="tbl"><thead><tr><th>Nr.</th><th>Periode</th><th>Oppdrag</th><th>Status</th><th class="r">Beløp</th></tr></thead><tbody>' +
      [['26-1184', 'September', 11, 'Betalt', 48230], ['26-1122', 'August', 9, 'Betalt', 39870], ['–', 'Oktober (utkast)', 7, 'Utkast', 31150]].map(function (r) { return '<tr><td class="num">' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td><td>' + SV.chip(r[3]) + '</td><td class="r num"><b>' + SV.kr(r[4]) + '</b></td></tr>'; }).join('') + '</tbody></table></div>';
  }, { title: 'Fakturaer' });
})();
