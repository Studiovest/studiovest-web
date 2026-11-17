/* Gjennomgang etter levering, felles for megler og kunde:
   kommentar per bilde, skrive og tegne på plantegningen, sende endringsønsker, se svar fra Studiovest.
   Hver person har sitt eget utkast til det sendes. Sendte ønsker og svar ser både megler, kunde og studio. */
(function () {
  'use strict';
  var SV = window.SV, D = SV.data, esc = SV.esc, ic = SV.icon;
  function R(id) {
    var all = SV.state.review = SV.state.review || {}, r = all[id] = all[id] || {};
    r.drafts = r.drafts || {}; r.requests = r.requests || [];
    return r;
  }
  function dr(id, by) { var d = R(id).drafts, x = d[by] = d[by] || {}; x.notes = x.notes || {}; x.floors = x.floors || {}; x.planNote = x.planNote || ''; return x; }
  // markeringer per etasje
  function fm(x, f) { var m = x.floors[f] = x.floors[f] || {}; m.pins = m.pins || []; m.texts = m.texts || []; m.strokes = m.strokes || []; return m; }
  function marks(m) { return m.pins.filter(function (p) { return p.t; }).length + m.texts.filter(function (p) { return p.t; }).length + (m.strokes.length ? 1 : 0); }
  var floorSel = {};
  function curFloor(j) { var fs = SV.planFloors(j), f = floorSel[j.id]; return fs.some(function (x) { return x.id === f; }) ? f : (fs.filter(function (x) { return x.id === 'f1'; })[0] || fs[0]).id; }
  SV.review = R;
  function job(id) { return SV.find(SV.jobs(), id); }
  function today() { return D.iso(D.base); }
  function noteCount(x) { return Object.keys(x.notes).reduce(function (a, k) { return a + x.notes[k].length; }, 0); }
  function planCount(x) { return Object.keys(x.floors).reduce(function (a, f) { return a + marks(fm(x, f)); }, 0) + (x.planNote ? 1 : 0); }
  function count(x) { return noteCount(x) + planCount(x); }
  function open(j) { return R(j.id).requests.filter(function (q) { return q.status !== 'rettet'; }); }
  SV.reviewCount = function (j) { return open(j).reduce(function (a, q) { return a + q.items.length; }, 0); };
  // plantegningsønsker agenten skal jobbe med: siste åpne forespørsel med plantegning
  SV.reviewPlanSrc = function (j) { var q = open(j).filter(function (x) { return x.plan; }).pop(); return q ? q.plan : null; };
  SV.reviewOpenPlanReq = function (j) { return open(j).filter(function (x) { return x.plan; }).pop() || null; };
  var mode = 'pin';
  function keep() { var y = window.scrollY; SV.render(); window.scrollTo(0, y); }
  function role(by) { return /\(megler\)/.test(by) ? 'megler' : /\(kunde\)/.test(by) ? 'kunde' : 'studio'; }

  // ---------- bilder ----------
  SV.reviewGallery = function (j, by) {
    var x = dr(j.id, by), ph = SV.boligPhotos(j), sent = {};
    R(j.id).requests.forEach(function (q) { q.items.forEach(function (it) { if (it.i != null) sent[it.i] = (sent[it.i] || 0) + 1; }); });
    return '<div class="row between" style="margin-bottom:10px"><p class="small muted">' + ph.length + ' bilder · trykk på et bilde for å skrive en kommentar</p></div><div class="gal big">' +
      ph.map(function (p, n) {
        var mine = (x.notes[p.i] || []).length, c = mine + (sent[p.i] || 0);
        return '<figure class="gi rv-gi" data-act="rvPhoto" data-id="' + j.id + '" data-i="' + p.i + '" data-n="' + (n + 1) + '" data-by="' + esc(by) + '" tabindex="0" role="button" aria-label="Kommenter bilde ' + (n + 1) + ', ' + esc(p.name) + '">' + SV.pic(p.src, p.pos) +
          '<span class="gi-n">' + String(n + 1).padStart(2, '0') + ' ' + esc(p.name) + '</span>' + (p.ill ? '<span class="gi-tag">' + SV.chip('Illustrasjon', 'brown') + '</span>' : '') +
          (c ? '<span class="rv-badge' + (mine ? ' draft' : '') + '">' + ic('chat') + c + '</span>' : '<span class="rv-add">' + ic('chat') + 'Kommenter</span>') + '</figure>';
      }).join('') + '</div>';
  };
  SV.on('rvPhoto', function (el) {
    var j = job(el.getAttribute('data-id')), i = +el.getAttribute('data-i'), by = el.getAttribute('data-by'), p = SV.boligPhotos(j).filter(function (q) { return q.i === i; })[0], mine = dr(j.id, by).notes[i] || [];
    var earlier = []; R(j.id).requests.forEach(function (q) { q.items.forEach(function (it) { if (it.i === i) earlier.push({ t: it.t, by: q.by, st: q.status }); }); });
    SV.modal('<figure style="margin:0"><img src="' + p.src + '" alt="" style="width:100%;border-radius:10px;max-height:56vh;object-fit:cover;object-position:' + p.pos + '"></figure>' +
      '<div class="row between" style="margin:12px 0 6px"><b>' + el.getAttribute('data-n') + '. ' + esc(p.name) + '</b><span class="small muted">Foto: Studiovest</span></div>' +
      (earlier.length ? '<ul class="rv-notes">' + earlier.map(function (n) { return '<li><span>' + esc(n.t) + '<small>' + esc(n.by) + ' · ' + (n.st === 'rettet' ? 'rettet' : 'sendt') + '</small></span></li>'; }).join('') + '</ul>' : '') +
      (mine.length ? '<ul class="rv-notes" style="margin-top:8px">' + mine.map(function (n, k) { return '<li class="draft"><span>' + esc(n.t) + '<small>Ikke sendt ennå</small></span><button class="link small" data-act="rvDel" data-id="' + j.id + '" data-i="' + i + '" data-k="' + k + '" data-by="' + esc(by) + '">Fjern</button></li>'; }).join('') + '</ul>' : '') +
      '<label class="fld" style="margin-top:8px"><span>Hva bør endres?</span><textarea class="txt" id="rvTxt" rows="3" placeholder="F.eks. fjern ledningen over benken, eller rett opp skjeve linjer"></textarea></label>' +
      '<div class="row" style="justify-content:flex-end"><button class="btn btn-dark" data-act="rvSave" data-id="' + j.id + '" data-i="' + i + '" data-by="' + esc(by) + '">' + ic('chat') + 'Lagre kommentar</button></div>', { wide: true, after: function () { var t = document.getElementById('rvTxt'); if (t) t.focus(); } });
  });
  SV.on('rvSave', function (el) {
    var t = document.getElementById('rvTxt').value.trim(); if (!t) { SV.toast('Skriv hva som bør endres', 'warn'); return; }
    var x = dr(el.getAttribute('data-id'), el.getAttribute('data-by')), i = el.getAttribute('data-i');
    (x.notes[i] = x.notes[i] || []).push({ t: t, d: today() }); SV.save(); SV.close(); keep(); SV.toast('Kommentar lagret · trykk «Send endringer» når du er ferdig');
  });
  SV.on('rvDel', function (el) { var x = dr(el.getAttribute('data-id'), el.getAttribute('data-by')); x.notes[el.getAttribute('data-i')].splice(+el.getAttribute('data-k'), 1); SV.save(); SV.close(); keep(); });

  // ---------- plantegning ----------
  function overlay(m) {
    return '<svg class="rv-ov" viewBox="0 0 400 300" preserveAspectRatio="none" aria-hidden="true">' +
      m.strokes.map(function (s) { return '<polyline points="' + s.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') + '"/>'; }).join('') +
      m.texts.map(function (p) { return p.t ? '<text class="rv-t" x="' + p.x.toFixed(1) + '" y="' + p.y.toFixed(1) + '">' + esc(p.t) + '</text>' : '<circle class="rv-tc" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="3"/>'; }).join('') +
      m.pins.map(function (p, k) { return '<g transform="translate(' + p.x.toFixed(1) + ',' + p.y.toFixed(1) + ')"><circle r="10"/><text y="4">' + (k + 1) + '</text></g>'; }).join('') + '</svg>';
  }
  function markupList(m) {
    return (m.pins.length ? '<ol class="rv-pins">' + m.pins.map(function (p, k) { return '<li><span class="rv-num">' + (k + 1) + '</span><span>' + (esc(p.t) || '<span class="muted">Uten tekst</span>') + '</span></li>'; }).join('') + '</ol>' : '') +
      (m.texts.length ? '<ul class="rv-pins">' + m.texts.map(function (p) { return '<li><span class="rv-num rv-numt">T</span><span>' + (esc(p.t) || '<span class="muted">Tom</span>') + '</span></li>'; }).join('') + '</ul>' : '');
  }
  // plantegning med markeringer, én per etasje som har noe (brukes i tråden og hos studio)
  SV.planMarked = function (j, plan, small) {
    var fs = SV.planFloors(j).filter(function (f) { return plan.floors[f.id]; }), many = SV.planFloors(j).length > 1;
    return '<div class="rv-floors' + (fs.length > 1 ? ' two' : '') + '">' + fs.map(function (f) { var m = fm(plan, f.id); return '<div>' + (many ? '<p class="rv-fname">' + esc(f.name) + '</p>' : '') + '<div class="rv-canvas' + (small ? ' sm' : '') + '">' + SV.planSvg(j, { floor: f.id }) + overlay(m) + '</div>' + markupList(m) + '</div>'; }).join('') + '</div>' +
      (plan.planNote ? '<p class="small" style="margin-top:10px"><b>Kommentar:</b> ' + esc(plan.planNote) + '</p>' : '');
  };
  SV.reviewPlan = function (j, by, edit) {
    var fs = SV.planFloors(j), many = fs.length > 1;
    if (!edit) return '<div class="card pad rv-plan"><h3 class="h3" style="margin-bottom:10px">Plantegning' + (many ? ' · ' + fs.length + ' etasjer' : '') + '</h3><div class="rv-floors' + (many ? ' two' : '') + '">' + fs.map(function (f) { return '<div>' + (many ? '<p class="rv-fname">' + esc(f.name) + '</p>' : '') + '<div class="rv-canvas">' + SV.planSvg(j, { floor: f.id }) + '</div></div>'; }).join('') + '</div></div>';
    var x = dr(j.id, by), f = curFloor(j), m = fm(x, f), a = ' data-id="' + j.id + '" data-by="' + esc(by) + '" data-f="' + f + '"';
    var tabs = many ? '<div class="rv-ftabs" role="tablist" aria-label="Etasjer">' + fs.map(function (fl) { var n = marks(fm(x, fl.id)); return '<button type="button" role="tab" aria-selected="' + (fl.id === f) + '" class="rv-ftab' + (fl.id === f ? ' on' : '') + '" data-act="rvFloor" data-id="' + j.id + '" data-f="' + fl.id + '">' + esc(fl.name) + (n ? '<span class="rv-fn">' + n + '</span>' : '') + '</button>'; }).join('') + '</div>' : '';
    var tools = '<div class="rv-tools" role="toolbar" aria-label="Verktøy for plantegning"><button type="button" class="fbtn' + (mode === 'pin' ? ' on' : '') + '" data-act="rvMode" data-m="pin">' + ic('chat') + 'Punkt</button><button type="button" class="fbtn' + (mode === 'text' ? ' on' : '') + '" data-act="rvMode" data-m="text"><b style="font-size:14px;line-height:1">T</b>Tekst</button><button type="button" class="fbtn' + (mode === 'pen' ? ' on' : '') + '" data-act="rvMode" data-m="pen">' + ic('edit') + 'Tegn</button><button type="button" class="fbtn" data-act="rvUndo"' + a + '>Angre</button>' + (m.pins.length || m.strokes.length || m.texts.length ? '<button type="button" class="fbtn" data-act="rvClear"' + a + '>Tøm</button>' : '') + '</div>';
    return '<div class="card pad rv-plan"><div class="row between" style="margin-bottom:10px;gap:10px;flex-wrap:wrap"><div><h3 class="h3">Plantegning' + (many ? ' · ' + fs.length + ' etasjer' : '') + '</h3><p class="small muted" style="margin-top:2px">' + (mode === 'pin' ? 'Punkt: trykk der noe er feil, og skriv hva som skal endres.' : mode === 'text' ? 'Tekst: trykk og skriv rett på tegningen, uten punkt.' : 'Tegn: bruk musen eller fingeren for å vise hva du mener.') + (many ? ' Velg etasje først.' : '') + '</p></div></div>' + tabs + '<div style="margin-bottom:10px">' + tools + '</div>' +
      '<div class="rv-canvas edit m-' + mode + '" id="rvCanvas"' + a + '>' + SV.planSvg(j, { floor: f }) + overlay(m) + '</div>' +
      (m.pins.length ? '<ol class="rv-pins">' + m.pins.map(function (p, k) { return '<li><span class="rv-num">' + (k + 1) + '</span><input class="inp" value="' + esc(p.t) + '" placeholder="Hva er feil her? F.eks. «Dette er bod, ikke soverom»" data-input="rvPin"' + a + ' data-k="' + k + '" aria-label="Kommentar ' + (k + 1) + '"><button type="button" class="link small" data-act="rvPinDel"' + a + ' data-k="' + k + '">Fjern</button></li>'; }).join('') + '</ol>' : '') +
      (m.texts.length ? '<ul class="rv-pins">' + m.texts.map(function (p, k) { return '<li><span class="rv-num rv-numt">T</span><input class="inp" value="' + esc(p.t) + '" placeholder="Skriv teksten som skal stå på tegningen" data-input="rvText"' + a + ' data-k="' + k + '" aria-label="Tekst ' + (k + 1) + '"><button type="button" class="link small" data-act="rvTextDel"' + a + ' data-k="' + k + '">Fjern</button></li>'; }).join('') + '</ul>' : '') +
      '<label class="fld" style="margin-top:12px"><span>Kommentar til plantegningen <span class="muted">(uten å markere noe' + (many ? ', skriv gjerne hvilken etasje' : '') + ')</span></span><textarea class="txt" rows="2" placeholder="F.eks. Kjøkkenet er 14 m², ikke 12. Boden under trappen mangler." data-input="rvNote"' + a + '>' + esc(x.planNote) + '</textarea></label></div>';
  };
  function X(el) { return dr(el.getAttribute('data-id'), el.getAttribute('data-by')); }
  function M(el) { return fm(X(el), el.getAttribute('data-f')); }
  // oppdater «Send endringer» og etasjetellere mens man skriver, uten å tegne siden på nytt
  function live(el) {
    var x = X(el), n = count(x), b = document.querySelector('[data-act=rvSend][data-by="' + el.getAttribute('data-by').replace(/"/g, '\\"') + '"]');
    if (b) { b.disabled = !n; b.lastChild.textContent = 'Send endringer' + (n ? ' (' + n + ')' : ''); }
    var t = document.querySelector('.rv-ftab.on'); if (t) { var k = marks(M(el)), c = t.querySelector('.rv-fn'); if (k && !c) { c = document.createElement('span'); c.className = 'rv-fn'; t.appendChild(c); } if (c) { if (k) c.textContent = k; else c.remove(); } }
  }
  SV.on('rvFloor', function (el) { floorSel[el.getAttribute('data-id')] = el.getAttribute('data-f'); keep(); });
  SV.on('rvMode', function (el) { mode = el.getAttribute('data-m'); keep(); });
  SV.on('rvUndo', function (el) { var x = M(el); if (mode === 'pen' && x.strokes.length) x.strokes.pop(); else if (mode === 'text' && x.texts.length) x.texts.pop(); else if (x.pins.length) x.pins.pop(); else x.strokes.pop(); SV.save(); keep(); });
  SV.on('rvClear', function (el) { var x = M(el); x.pins = []; x.strokes = []; x.texts = []; SV.save(); keep(); });
  SV.on('rvPin', function (el) { M(el).pins[+el.getAttribute('data-k')].t = el.value; SV.save(); live(el); });
  SV.on('rvText', function (el) { M(el).texts[+el.getAttribute('data-k')].t = el.value; SV.save(); live(el); var t = document.querySelectorAll('#rvCanvas .rv-t, #rvCanvas .rv-tc')[+el.getAttribute('data-k')]; if (t && t.tagName === 'text' && el.value) t.textContent = el.value; });
  SV.on('rvTextDel', function (el) { M(el).texts.splice(+el.getAttribute('data-k'), 1); SV.save(); keep(); });
  SV.on('rvNote', function (el) { X(el).planNote = el.value; SV.save(); live(el); });
  SV.on('rvPinDel', function (el) { M(el).pins.splice(+el.getAttribute('data-k'), 1); SV.save(); keep(); });
  // tegning og punkter (pointer events: mus, finger, penn)
  function pt(c, e) { var b = c.getBoundingClientRect(); return [Math.max(0, Math.min(400, (e.clientX - b.left) / b.width * 400)), Math.max(0, Math.min(300, (e.clientY - b.top) / b.height * 300))]; }
  function focusLast(sel) { setTimeout(function () { var ins = document.querySelectorAll(sel); if (ins.length) ins[ins.length - 1].focus({ preventScroll: true }); }, 60); }
  var drawing = null;
  document.addEventListener('pointerdown', function (e) {
    var c = e.target.closest && e.target.closest('#rvCanvas'); if (!c) return;
    var x = M(c), p = pt(c, e);
    if (mode === 'text') { x.texts.push({ x: p[0], y: p[1], t: '' }); SV.save(); keep(); focusLast('[data-input=rvText]'); return; }
    if (mode === 'pin') { x.pins.push({ x: p[0], y: p[1], t: '' }); SV.save(); keep(); focusLast('[data-input=rvPin]'); return; }
    e.preventDefault(); c.setPointerCapture && c.setPointerCapture(e.pointerId);
    var svg = c.querySelector('.rv-ov'), pl = document.createElementNS('http://www.w3.org/2000/svg', 'polyline'); svg.appendChild(pl);
    drawing = { c: c, x: x, s: [p], el: pl };
  });
  document.addEventListener('pointermove', function (e) {
    if (!drawing) return; var p = pt(drawing.c, e), l = drawing.s[drawing.s.length - 1];
    if (Math.abs(p[0] - l[0]) + Math.abs(p[1] - l[1]) < 1.5) return;
    drawing.s.push(p); drawing.el.setAttribute('points', drawing.s.map(function (q) { return q[0].toFixed(1) + ',' + q[1].toFixed(1); }).join(' '));
  });
  document.addEventListener('pointerup', function () {
    if (!drawing) return; var d = drawing; drawing = null;
    if (d.s.length > 1) { d.x.strokes.push(d.s); SV.save(); keep(); }
  });

  // ---------- send og godkjenn ----------
  SV.reviewBox = function (j, by) {
    var n = count(dr(j.id, by)), op = open(j).length;
    return '<div class="card pad appr"><div style="flex:1;min-width:260px"><h3 class="h3">Se gjennom og godkjenn</h3><p class="small muted" style="margin-top:4px">Ser du feil, ting som burde vært ryddet bort, eller noe annet som bør endres? Skriv en kommentar på bildet det gjelder. Er plantegningen feil, kan du skrive og tegne rett på den. Ser alt bra ut, godkjenner du oppdraget.</p>' +
      (op ? '<p class="small" style="margin-top:8px">' + ic('clock') + ' ' + op + ' endringsønske' + (op > 1 ? 'r' : '') + ' er sendt og venter på Studiovest.</p>' : '') + '</div>' +
      '<div class="row"><button class="btn btn-ghost btn-s" data-act="rvSend" data-id="' + j.id + '" data-by="' + esc(by) + '"' + (n ? '' : ' disabled') + '>' + ic('mail') + 'Send endringer' + (n ? ' (' + n + ')' : '') + '</button><button class="btn btn-acc" data-act="crmApprove" data-id="' + j.id + '" data-by="' + esc(by) + '">' + ic('check') + 'Godkjenn oppdraget</button></div></div>';
  };
  SV.on('rvSend', function (el) {
    var j = job(el.getAttribute('data-id')), by = el.getAttribute('data-by'), x = dr(j.id, by), ph = SV.boligPhotos(j), r = R(j.id), items = [];
    Object.keys(x.notes).forEach(function (i) { var p = ph.filter(function (q) { return q.i === +i; })[0]; x.notes[i].forEach(function (n) { items.push({ i: +i, name: p.name, t: n.t }); }); });
    var hasPlan = planCount(x) > 0;
    var pf = {}; Object.keys(x.floors).forEach(function (f) { var m = fm(x, f); if (m.pins.length || m.texts.length || m.strokes.length) pf[f] = m; });
    if (hasPlan) items.push({ plan: true, t: 'Plantegning' + (Object.keys(pf).length ? ' (' + Object.keys(pf).map(SV.planFloorName).join(', ') + ')' : '') });
    var q = { id: 'q' + (r.requests.length + 1), by: by, role: role(by), d: today(), items: items, plan: hasPlan ? { floors: pf, planNote: x.planNote } : null, status: 'sendt' };
    r.requests.push(q); delete r.drafts[by];
    var S = SV.state; S.mailLog = S.mailLog || [];
    S.mailLog.unshift({ id: j.id, t: SV.fdate(today()), to: 'Deg', mail: 'varsel i portalen', subj: 'Endringsønske (' + items.length + '): ' + j.addr + ' fra ' + by, k: 'endring' });
    if (q.role === 'kunde') S.mailLog.unshift({ id: j.id, t: SV.fdate(today()), to: j.broker, mail: 'megler', subj: j.seller + ' har sendt endringsønsker: ' + j.addr, k: 'endring' });
    // plantegningsagenten starter av seg selv når det er ønsker på plantegningen
    if (hasPlan) SV.runAgent(j);
    SV.save(); keep(); SV.toast('Sendt til Studiovest · ' + (q.role === 'kunde' ? 'megler ser det også' : 'kunden ser det også'));
  });

  // ---------- tråd: synlig for megler, kunde og studio ----------
  SV.reviewThread = function (j, viewer) {
    var qs = R(j.id).requests; if (!qs.length) return '';
    return '<div class="sec"><div class="sec-h"><h2>Endringsønsker og svar</h2><span class="small muted">Megler og kunde ser det samme</span></div><div class="stack">' +
      qs.slice().reverse().map(function (q) { return qCard(j, q, viewer); }).join('') + '</div></div>';
  };
  function qCard(j, q, viewer) {
    var ph = SV.boligPhotos(j), studio = viewer === 'studio';
    var items = q.items.filter(function (it) { return !it.plan; }).map(function (it) { var p = ph.filter(function (x) { return x.i === it.i; })[0]; return '<li><span class="rv-th">' + SV.pic(p.src, p.pos) + '</span><span><b>' + esc(it.name) + '</b><br>' + esc(it.t) + '</span></li>'; }).join('');
    var head = '<div class="row between" style="gap:10px;margin-bottom:10px"><span>' + SV.avatar(q.by.replace(/ \(.+\)$/, '')) + ' <b>' + esc(q.by) + '</b> <span class="small muted">· ' + SV.fdate(q.d) + '</span></span>' + SV.chip(q.status === 'rettet' ? 'Rettet' : 'Sendt', q.status === 'rettet' ? 'ok' : 'sand') + '</div>';
    var plan = q.plan ? '<div style="margin-top:12px"><p class="eyebrow" style="margin-bottom:6px">Plantegning</p>' + SV.planMarked(j, q.plan, true) + '</div>' : '';
    var agent = studio && q.plan && q.status !== 'rettet' ? '<div style="margin-top:14px">' + ((SV.state.agent || {})[j.id] ? SV.agentCard(j) : q.planVer ? '<p class="small">' + ic('check') + ' Plantegning versjon ' + q.planVer + ' er publisert.</p>' : '<button class="btn btn-ghost btn-s" data-act="agRun" data-id="' + j.id + '">' + ic('bolt') + 'La agenten lage forslag</button>') + '</div>' : '';
    var ans = q.answer ? '<div class="rv-ans"><b>Studiovest</b> <span class="small muted">· ' + SV.fdate(q.ad) + '</span><p>' + esc(q.answer) + '</p></div>' : '';
    var form = studio && q.status !== 'rettet' ? '<div style="margin-top:14px"><label class="fld"><span>Svar til ' + (q.role === 'kunde' ? 'kunde og megler' : 'megler og kunde') + '</span><textarea class="txt" rows="2" id="ans-' + q.id + '" placeholder="F.eks. Ledningen er fjernet og soverommet er endret til bod.">' + esc(q.draft || (q.planVer ? 'Plantegningen er oppdatert (versjon ' + q.planVer + ').' : '')) + '</textarea></label><div class="row" style="justify-content:flex-end"><button class="btn btn-dark btn-s" data-act="rvDone" data-id="' + j.id + '" data-q="' + q.id + '">' + ic('check') + 'Rettet · send svar</button></div></div>' : '';
    return '<div class="card pad rv-q' + (q.status === 'rettet' ? ' done' : '') + '">' + head + (items ? '<ul class="rv-list">' + items + '</ul>' : '') + plan + agent + ans + form + '</div>';
  }
  SV.reviewStudio = function (j) {
    var qs = R(j.id).requests; if (!qs.length) return '';
    var op = open(j).length;
    return '<div class="sec"><div class="sec-h"><h2>Endringsønsker</h2><span class="small muted">' + (op ? op + ' venter på deg' : 'Alt er rettet') + ' · megler og kunde ser svarene</span></div><div class="stack">' + qs.slice().reverse().map(function (q) { return qCard(j, q, 'studio'); }).join('') + '</div></div>';
  };
  SV.on('rvDone', function (el) {
    var j = job(el.getAttribute('data-id')), q = R(j.id).requests.filter(function (x) { return x.id === el.getAttribute('data-q'); })[0], t = document.getElementById('ans-' + q.id).value.trim();
    if (!t) { SV.toast('Skriv et kort svar', 'warn'); return; }
    q.status = 'rettet'; q.answer = t; q.ad = today();
    var S = SV.state;
    [[j.broker, 'megler'], [j.seller, j.email || 'kunde']].forEach(function (p) { S.mailLog.unshift({ id: j.id, t: SV.fdate(today()), to: p[0], mail: p[1], subj: 'Endringene er gjort: ' + j.addr, k: 'rettet' }); });
    SV.save(); keep(); SV.toast('Svar sendt · megler og kunde får e-post');
  });
})();
