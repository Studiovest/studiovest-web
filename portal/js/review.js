/* Gjennomgang etter levering: kommentar per bilde, skrive og tegne på plantegningen, sende endringsønsker til Studiovest. */
(function () {
  'use strict';
  var SV = window.SV, esc = SV.esc, ic = SV.icon;
  function R(id) { var r = SV.state.review = SV.state.review || {}; r[id] = r[id] || { notes: {}, pins: [], strokes: [], sent: [] }; r[id].texts = r[id].texts || []; r[id].planNote = r[id].planNote || ''; return r[id]; }
  SV.review = R;
  function job(id) { return SV.find(SV.jobs(), id); }
  function noteCount(r) { return Object.keys(r.notes).reduce(function (a, k) { return a + r.notes[k].length; }, 0); }
  function planCount(r) { return r.pins.filter(function (p) { return p.t; }).length + (r.texts || []).filter(function (p) { return p.t; }).length + (r.strokes.length ? 1 : 0) + (r.planNote ? 1 : 0); }
  function openCount(r) { return noteCount(r) + planCount(r); }
  SV.reviewCount = function (j) { var r = (SV.state.review || {})[j.id]; return r ? openCount(r) : 0; };
  SV.planCount = function (j) { var r = (SV.state.review || {})[j.id]; return r ? planCount(r) : 0; };
  var mode = 'pin';

  // ---------- bilder ----------
  SV.reviewGallery = function (j, by) {
    var r = R(j.id), ph = SV.boligPhotos(j);
    return '<div class="row between" style="margin-bottom:10px"><p class="small muted">' + ph.length + ' bilder · trykk på et bilde for å skrive en kommentar</p></div><div class="gal big">' +
      ph.map(function (x, n) {
        var c = (r.notes[x.i] || []).length;
        return '<figure class="gi rv-gi" data-act="rvPhoto" data-id="' + j.id + '" data-i="' + x.i + '" data-n="' + (n + 1) + '" data-by="' + esc(by) + '" tabindex="0" role="button" aria-label="Kommenter bilde ' + (n + 1) + ', ' + esc(x.name) + '">' + SV.pic(x.src, x.pos) +
          '<span class="gi-n">' + String(n + 1).padStart(2, '0') + ' ' + esc(x.name) + '</span>' + (x.ill ? '<span class="gi-tag">' + SV.chip('Illustrasjon', 'brown') + '</span>' : '') +
          (c ? '<span class="rv-badge">' + ic('chat') + c + '</span>' : '<span class="rv-add">' + ic('chat') + 'Kommenter</span>') + '</figure>';
      }).join('') + '</div>';
  };
  SV.on('rvPhoto', function (el) {
    var j = job(el.getAttribute('data-id')), i = +el.getAttribute('data-i'), by = el.getAttribute('data-by'), x = SV.boligPhotos(j).filter(function (p) { return p.i === i; })[0], list = R(j.id).notes[i] || [];
    SV.modal('<figure style="margin:0"><img src="' + x.src + '" alt="" style="width:100%;border-radius:10px;max-height:56vh;object-fit:cover;object-position:' + x.pos + '"></figure>' +
      '<div class="row between" style="margin:12px 0 6px"><b>' + el.getAttribute('data-n') + '. ' + esc(x.name) + '</b><span class="small muted">Foto: Studiovest</span></div>' +
      (list.length ? '<ul class="rv-notes">' + list.map(function (n, k) { return '<li><span>' + esc(n.t) + '<small>' + esc(n.by) + '</small></span><button class="link small" data-act="rvDel" data-id="' + j.id + '" data-i="' + i + '" data-k="' + k + '">Fjern</button></li>'; }).join('') + '</ul>' : '') +
      '<label class="fld" style="margin-top:8px"><span>Hva bør endres?</span><textarea class="txt" id="rvTxt" rows="3" placeholder="F.eks. fjern ledningen over benken, eller rett opp skjeve linjer"></textarea></label>' +
      '<div class="row" style="justify-content:flex-end"><button class="btn btn-dark" data-act="rvSave" data-id="' + j.id + '" data-i="' + i + '" data-by="' + esc(by) + '">' + ic('chat') + 'Lagre kommentar</button></div>', { wide: true, after: function () { var t = document.getElementById('rvTxt'); if (t) t.focus(); } });
  });
  SV.on('rvSave', function (el) {
    var t = document.getElementById('rvTxt').value.trim(); if (!t) { SV.toast('Skriv hva som bør endres', 'warn'); return; }
    var r = R(el.getAttribute('data-id')), i = el.getAttribute('data-i');
    (r.notes[i] = r.notes[i] || []).push({ t: t, by: el.getAttribute('data-by'), d: SV.data.iso(SV.data.base) }); SV.save(); SV.close(); keep(); SV.toast('Kommentar lagret · send endringene når du er ferdig');
  });
  SV.on('rvDel', function (el) { var r = R(el.getAttribute('data-id')), l = r.notes[el.getAttribute('data-i')]; l.splice(+el.getAttribute('data-k'), 1); SV.save(); SV.close(); keep(); });
  function keep() { var y = window.scrollY; SV.render(); window.scrollTo(0, y); }

  // ---------- plantegning ----------
  function overlay(r, edit) {
    return '<svg class="rv-ov" viewBox="0 0 400 300" preserveAspectRatio="none" aria-hidden="true">' +
      r.strokes.map(function (s) { return '<polyline points="' + s.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') + '"/>'; }).join('') +
      (r.texts || []).map(function (p) { return p.t ? '<text class="rv-t" x="' + p.x.toFixed(1) + '" y="' + p.y.toFixed(1) + '">' + esc(p.t) + '</text>' : '<circle class="rv-tc" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="3"/>'; }).join('') +
      r.pins.map(function (p, k) { return '<g transform="translate(' + p.x.toFixed(1) + ',' + p.y.toFixed(1) + ')"><circle r="10"/><text y="4">' + (k + 1) + '</text></g>'; }).join('') + '</svg>';
  }
  SV.reviewPlan = function (j, by, edit) {
    var r = R(j.id);
    var tools = edit ? '<div class="rv-tools" role="toolbar" aria-label="Verktøy for plantegning"><button type="button" class="fbtn' + (mode === 'pin' ? ' on' : '') + '" data-act="rvMode" data-m="pin">' + ic('chat') + 'Skriv</button><button type="button" class="fbtn' + (mode === 'text' ? ' on' : '') + '" data-act="rvMode" data-m="text"><b style="font-size:14px;line-height:1">T</b>Tekst</button><button type="button" class="fbtn' + (mode === 'pen' ? ' on' : '') + '" data-act="rvMode" data-m="pen">' + ic('edit') + 'Tegn</button><button type="button" class="fbtn" data-act="rvUndo" data-id="' + j.id + '">Angre</button>' + (r.pins.length || r.strokes.length || r.texts.length ? '<button type="button" class="fbtn" data-act="rvClear" data-id="' + j.id + '">Tøm</button>' : '') + '</div>' : '';
    return '<div class="card pad rv-plan"><div class="row between" style="margin-bottom:10px;gap:10px;flex-wrap:wrap"><div><h3 class="h3">Plantegning</h3>' + (edit ? '<p class="small muted" style="margin-top:2px">' + (mode === 'pin' ? 'Punkt: trykk der noe er feil, og skriv hva som skal endres.' : mode === 'text' ? 'Tekst: trykk og skriv rett på tegningen, uten punkt.' : 'Tegn: bruk musen eller fingeren for å vise hva du mener.') + '</p>' : '') + '</div>' + tools + '</div>' +
      '<div class="rv-canvas' + (edit ? ' edit m-' + mode : '') + '" id="' + (edit ? 'rvCanvas' : '') + '" data-id="' + j.id + '" data-by="' + esc(by) + '">' + SV.planSvg(j) + overlay(r, edit) + '</div>' +
      (r.pins.length ? '<ol class="rv-pins">' + r.pins.map(function (p, k) { return '<li><span class="rv-num">' + (k + 1) + '</span>' + (edit ? '<input class="inp" value="' + esc(p.t) + '" placeholder="Hva er feil her? F.eks. «Dette er bod, ikke soverom»" data-input="rvPin" data-id="' + j.id + '" data-k="' + k + '" aria-label="Kommentar ' + (k + 1) + '"><button type="button" class="link small" data-act="rvPinDel" data-id="' + j.id + '" data-k="' + k + '">Fjern</button>' : '<span>' + (esc(p.t) || '<span class="muted">Uten tekst</span>') + '<small>' + esc(p.by || '') + '</small></span>') + '</li>'; }).join('') + '</ol>' : '') +
      (r.texts.length ? '<ul class="rv-pins">' + r.texts.map(function (p, k) { return '<li><span class="rv-num rv-numt">T</span>' + (edit ? '<input class="inp" value="' + esc(p.t) + '" placeholder="Skriv teksten som skal stå på tegningen" data-input="rvText" data-id="' + j.id + '" data-k="' + k + '" aria-label="Tekst ' + (k + 1) + '"><button type="button" class="link small" data-act="rvTextDel" data-id="' + j.id + '" data-k="' + k + '">Fjern</button>' : '<span>' + (esc(p.t) || '<span class="muted">Tom</span>') + '</span>') + '</li>'; }).join('') + '</ul>' : '') +
      (edit ? '<label class="fld" style="margin-top:12px"><span>Kommentar til plantegningen <span class="muted">(uten å markere noe)</span></span><textarea class="txt" rows="2" placeholder="F.eks. Kjøkkenet er 14 m², ikke 12. Boden under trappen mangler." data-input="rvNote" data-id="' + j.id + '">' + esc(r.planNote) + '</textarea></label>' : r.planNote ? '<p class="small" style="margin-top:12px"><b>Kommentar:</b> ' + esc(r.planNote) + '</p>' : '') + '</div>';
  };
  SV.on('rvMode', function (el) { mode = el.getAttribute('data-m'); keep(); });
  SV.on('rvUndo', function (el) { var r = R(el.getAttribute('data-id')); if (mode === 'pen' && r.strokes.length) r.strokes.pop(); else if (r.pins.length) r.pins.pop(); else r.strokes.pop(); SV.save(); keep(); });
  SV.on('rvClear', function (el) { var r = R(el.getAttribute('data-id')); r.pins = []; r.strokes = []; r.texts = []; SV.save(); keep(); });
  SV.on('rvPin', function (el) { R(el.getAttribute('data-id')).pins[+el.getAttribute('data-k')].t = el.value; SV.save(); });
  SV.on('rvText', function (el) { R(el.getAttribute('data-id')).texts[+el.getAttribute('data-k')].t = el.value; SV.save(); var t = document.querySelectorAll('#rvCanvas .rv-t, #rvCanvas .rv-tc')[+el.getAttribute('data-k')]; if (t && el.value) { if (t.tagName === 'text') t.textContent = el.value; } });
  SV.on('rvTextDel', function (el) { R(el.getAttribute('data-id')).texts.splice(+el.getAttribute('data-k'), 1); SV.save(); keep(); });
  SV.on('rvNote', function (el) { R(el.getAttribute('data-id')).planNote = el.value; SV.save(); });
  SV.on('rvPinDel', function (el) { R(el.getAttribute('data-id')).pins.splice(+el.getAttribute('data-k'), 1); SV.save(); keep(); });
  // tegning og nåler (pointer events: mus, finger, penn)
  function pt(c, e) { var b = c.getBoundingClientRect(); return [Math.max(0, Math.min(400, (e.clientX - b.left) / b.width * 400)), Math.max(0, Math.min(300, (e.clientY - b.top) / b.height * 300))]; }
  var drawing = null;
  document.addEventListener('pointerdown', function (e) {
    var c = e.target.closest && e.target.closest('#rvCanvas'); if (!c) return;
    var r = R(c.getAttribute('data-id')), p = pt(c, e);
    if (mode === 'text') {
      r.texts.push({ x: p[0], y: p[1], t: '', by: c.getAttribute('data-by') }); SV.save(); keep();
      setTimeout(function () { var ins = document.querySelectorAll('[data-input=rvText]'); if (ins.length) ins[ins.length - 1].focus({ preventScroll: true }); }, 60);
      return;
    }
    if (mode === 'pin') {
      r.pins.push({ x: p[0], y: p[1], t: '', by: c.getAttribute('data-by') }); SV.save(); keep();
      // fokus etter at klikket er ferdig, ellers tar klikket fokus tilbake
      setTimeout(function () { var ins = document.querySelectorAll('.rv-pins input'); if (ins.length) ins[ins.length - 1].focus({ preventScroll: true }); }, 60);
      return;
    }
    e.preventDefault(); c.setPointerCapture && c.setPointerCapture(e.pointerId);
    drawing = { c: c, r: r, s: [p], el: null };
    var svg = c.querySelector('.rv-ov'), pl = document.createElementNS('http://www.w3.org/2000/svg', 'polyline'); svg.appendChild(pl); drawing.el = pl;
  });
  document.addEventListener('pointermove', function (e) {
    if (!drawing) return; var p = pt(drawing.c, e), l = drawing.s[drawing.s.length - 1];
    if (Math.abs(p[0] - l[0]) + Math.abs(p[1] - l[1]) < 1.5) return;
    drawing.s.push(p); drawing.el.setAttribute('points', drawing.s.map(function (q) { return q[0].toFixed(1) + ',' + q[1].toFixed(1); }).join(' '));
  });
  document.addEventListener('pointerup', function () {
    if (!drawing) return; var d = drawing; drawing = null;
    if (d.s.length > 1) { d.r.strokes.push(d.s); SV.save(); keep(); }
  });

  // ---------- send og godkjenn ----------
  SV.reviewBox = function (j, by) {
    var r = R(j.id), n = openCount(r), last = r.sent[r.sent.length - 1];
    return '<div class="card pad appr"><div style="flex:1;min-width:260px"><h3 class="h3">Se gjennom og godkjenn</h3><p class="small muted" style="margin-top:4px">Ser du feil, ting som burde vært ryddet bort, eller noe annet som bør endres? Skriv en kommentar på bildet det gjelder. Er plantegningen feil, kan du skrive og tegne rett på den. Ser alt bra ut, godkjenner du oppdraget.</p>' +
      (last ? '<p class="small" style="margin-top:8px">' + ic('check') + ' Endringer sendt ' + SV.fdate(last.d) + '. Vi gir beskjed når de er rettet.</p>' : '') + '</div>' +
      '<div class="row"><button class="btn btn-ghost btn-s" data-act="rvSend" data-id="' + j.id + '" data-by="' + esc(by) + '"' + (n ? '' : ' disabled') + '>' + ic('mail') + 'Send endringer' + (n ? ' (' + n + ')' : '') + '</button><button class="btn btn-acc" data-act="crmApprove" data-id="' + j.id + '" data-by="' + esc(by) + '">' + ic('check') + 'Godkjenn oppdraget</button></div></div>';
  };
  SV.on('rvSend', function (el) {
    var j = job(el.getAttribute('data-id')), r = R(j.id), n = openCount(r), by = el.getAttribute('data-by');
    r.sent.push({ d: SV.data.iso(SV.data.base), by: by, n: n });
    var S = SV.state; S.mailLog = S.mailLog || [];
    S.mailLog.unshift({ id: j.id, t: SV.fdate(SV.data.iso(SV.data.base)), to: 'Deg', mail: 'varsel i portalen', subj: 'Endringsønske (' + n + '): ' + j.addr + ' fra ' + by, k: 'endring' });
    // plantegningsagenten starter av seg selv når det er ønsker på plantegningen
    if (planCount(r)) SV.runAgent(j);
    SV.save(); keep(); SV.toast('Sendt til Studiovest · du får beskjed når det er rettet');
  });

  // ---------- studio: endringsønsker på prosjektsiden ----------
  SV.reviewStudio = function (j) {
    var r = (SV.state.review || {})[j.id]; if (!r || !openCount(r)) return '';
    var ph = SV.boligPhotos(j), items = [];
    Object.keys(r.notes).forEach(function (i) { var x = ph.filter(function (p) { return p.i === +i; })[0]; r.notes[i].forEach(function (n) { items.push('<li><span class="rv-th">' + SV.pic(x.src, x.pos) + '</span><span><b>' + esc(x.name) + '</b><br>' + esc(n.t) + '<small>' + esc(n.by) + '</small></span></li>'); }); });
    var last = r.sent[r.sent.length - 1];
    return '<div class="card sec"><div class="card-h"><h3>Endringsønsker</h3><span class="small muted">' + (last ? 'Sendt ' + SV.fdate(last.d) + ' av ' + esc(last.by) : 'Ikke sendt ennå') + '</span></div><div class="card-b">' +
      (items.length ? '<ul class="rv-list">' + items.join('') + '</ul>' : '') +
      (planCount(r) ? '<div style="margin-top:14px">' + SV.reviewPlan(j, '', false) + '</div>' + ((SV.state.agent || {})[j.id] ? '<div style="margin-top:14px">' + SV.agentCard(j) + '</div>' : '<div class="row" style="margin-top:12px"><button class="btn btn-ghost btn-s" data-act="agRun" data-id="' + j.id + '">' + ic('bolt') + 'La agenten lage forslag</button></div>') : '') +
      '<div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn btn-dark btn-s" data-act="rvDone" data-id="' + j.id + '">' + ic('check') + 'Rettet · gi beskjed</button></div></div></div>';
  };
  SV.on('rvDone', function (el) {
    var j = job(el.getAttribute('data-id')); SV.state.review[j.id] = { notes: {}, pins: [], strokes: [], texts: [], planNote: '', sent: [] };
    var S = SV.state; S.mailLog.unshift({ id: j.id, t: SV.fdate(SV.data.iso(SV.data.base)), to: j.broker, mail: 'megler', subj: 'Endringene er gjort: ' + j.addr, k: 'rettet' });
    SV.save(); keep(); SV.toast('Megler får e-post om at endringene er gjort');
  });
})();
