/* Enkle mobilsider for de som ikke har konto: selger, ansatt (samtykke) og foresatt før fotodag. */
(function () {
  'use strict';
  var SV = window.SV, D = SV.data, esc = SV.esc, ic = SV.icon;
  function brand(sub) { return '<p class="blogo"><span class="lg"><span class="serif">STUDIO</span><span class="bold">VEST</span></span><span>' + esc(sub) + '</span></p>'; }
  SV.brand = brand;

  // ---------- Selger: velg tid og gjør boligen klar ----------
  SV.clientCfg.selger = { bare: true };
  var PREP = [
    ['Overalt', ['Skru på alle lys, også lamper og lys under skap', 'Åpne gardiner og persienner', 'Fjern ledninger, ladere og fjernkontroller']],
    ['Kjøkken', ['Tomme benker, bortsett fra én ting som pynter', 'Ta bort håndklær, oppvaskmiddel og magneter på kjøleskapet']],
    ['Bad', ['Lukk toalettlokket', 'Fjern tannbørster, sjampo og skittentøy']],
    ['Soverom', ['Re opp sengene med lyst sengetøy', 'Rydd nattbord og stoler for klær']],
    ['Ute', ['Flytt biler fra innkjørselen', 'Sett frem utemøbler, legg bort leker og søppeldunker']]
  ];
  // Kundesiden: lenken kunden får på e-post når tiden er avtalt. Info, bestilling, klargjøring, og senere levering og kommentarer.
  SV.route('/selger/:id', 'selger', function (p) {
    var j = SV.find(SV.jobs(), p.id) || SV.jobs()[0], o = SV.find(D.offices, j.office), first = (j.seller.split('v/ ')[1] || j.seller).split(' ')[0];
    var i = SV.stIdx(j), done = (SV.state.prep || {})[j.id] || {}, dur = Math.round(SV.minutes(j) / 30) / 2, drone = j.services.indexOf('dr') > -1;
    var me = j.seller + ' (kunde)', ph = SV.boligPhotos(j), ap = SV.approval(j);
    var steps = ['Tid avtalt', 'Fotografert', 'Levert', 'Godkjent'], cur = Math.max(0, i - 2);
    var stepper = '<div class="kstep" aria-label="Status">' + steps.map(function (s, k) { return '<span class="' + (k < cur || (k === cur && i === 5) ? 'done' : k === cur ? 'now' : '') + '"><i></i>' + s + '</span>'; }).join('') + '</div>';
    var when = i >= 2 ? (SV.hasOut(j) ? '<p class="small muted" style="margin-bottom:2px">Hovedfotografering</p>' : '') + '<p style="font-size:22px;font-family:var(--serif);line-height:1.2">' + SV.fdate(j.date, true) + ' kl. ' + j.time + '</p>' + (SV.hasOut(j) ? '<p class="small muted" style="margin:10px 0 2px">Ekstra utefotografering</p><p style="font-size:18px;font-family:var(--serif);line-height:1.2">' + (j.date2 ? SV.outWhen(j) : 'Avtales med deg på SMS') + '</p><p class="small muted" style="margin-top:2px">Du trenger ikke være hjemme for utebildene.</p>' : '') + '<p class="small muted" style="margin-top:4px">Ca. ' + String(dur).replace('.', ',') + ' timer på stedet · ' + esc(j.access) + '</p><div class="row" style="margin-top:12px"><button class="btn btn-ghost btn-s" data-act="ics">' + ic('cal') + 'Legg i kalender</button><a class="btn btn-ghost btn-s" href="sms:91200000">' + ic('chat') + 'Endre tid på SMS</a></div>'
      : SV.postInfo(j) ? '<p style="font-size:20px;font-family:var(--serif);line-height:1.2">Fotograferingen er utsatt</p><p class="small muted" style="margin-top:4px">' + esc(SV.postInfo(j).reason) + (SV.postInfo(j).note ? ': ' + esc(SV.postInfo(j).note) : '') + '. Vi avtaler ny tid med deg på SMS.</p>' : '<p>Vi avtaler tid med deg på SMS.</p>';
    var info = '<div class="card pad" style="margin-top:16px"><p class="eyebrow">Fotografering</p>' + when + (SV.etaTxt(j) ? '<p class="small" style="margin-top:12px;padding-top:12px;border-top:1px solid var(--line2)">' + ic('cal') + ' <b>' + SV.etaTxt(j) + '</b></p>' : '') + '</div>' +
      '<div class="card" style="margin-top:12px"><div class="card-h"><h3>Dette er bestilt</h3><span class="small muted">av ' + esc(j.broker) + '</span></div><div class="card-b"><ul class="feed">' + j.services.map(function (id) { var v = SV.find(D.boligServices, id); return v ? '<li>' + ic('check') + '<span><b>' + esc(v.name.replace(', per bilde', '')) + '</b><br><span class="small muted">' + esc(v.desc) + '</span></span></li>' : ''; }).join('') + '</ul></div></div>' +
      '<div class="g2" style="margin-top:12px;gap:12px"><div class="who">' + SV.avatar('Aleksander Koløy') + '<div><b>Aleksander Koløy</b><br><span class="small muted">Fotograf · 912 00 000</span></div></div><div class="who">' + SV.avatar(j.broker) + '<div><b>' + esc(j.broker) + '</b><br><span class="small muted">Megler · ' + esc(o.name) + '</span></div></div></div>';
    var prep = '<div style="margin-top:24px"><h2 class="h2"><span class="serif">Slik gjør du boligen klar</span></h2><p class="small muted" style="margin-bottom:10px">Kryss av mens du går. Det tar ca. en time.</p>' +
      PREP.map(function (g, gi) { return '<div class="card" style="margin-bottom:10px"><div class="card-h"><h3>' + g[0] + '</h3></div><div class="card-b"><ul class="check">' + g[1].map(function (t, ti) { var k = gi + '-' + ti; return '<li class="' + (done[k] ? 'done' : '') + '"><input type="checkbox" id="pr' + k + '"' + (done[k] ? ' checked' : '') + ' data-change="prep" data-id="' + j.id + '" data-k="' + k + '"><label for="pr' + k + '"><span>' + esc(t) + '</span></label></li>'; }).join('') + '</ul></div></div>'; }).join('') +
      '<p class="hint">Du trenger ikke være hjemme hvis megler har nøkkel. Kjæledyr bør være ute eller i ett rom.</p></div>';
    var after = '<div class="card pad" style="margin-top:12px"><h3 class="h3">Etter fotograferingen</h3><p class="small muted" style="margin-top:4px">Bildene' + ' og plantegningen' + ' kommer her, på denne siden, ' + (SV.eta(j) ? SV.fdate(SV.eta(j).d, true) + (SV.eta(j).t ? ' kl. ' + SV.eta(j).t : '') : 'innen ' + (j.services.indexOf('ex') > -1 ? '24 timer' : '2 virkedager')) + '. Du får e-post når de er klare. Da kan du kommentere bildene og plantegningen, og ' + esc(j.broker.split(' ')[0]) + ' ser det samme.</p></div>';
    if (i >= 4) {
      return '<div class="kdel">' + brand('for ' + o.name) +
        '<div class="bhead"><h1>Hei ' + esc(first) + '! Bildene av ' + esc(j.addr) + ' er klare.</h1><p>' + (ap ? 'Oppdraget er godkjent. Takk!' : 'Se gjennom bildene og plantegningen. ' + esc(j.broker) + ' bruker dem i annonsen.') + '</p></div>' + stepper +
        (ap ? '<div class="card pad" style="margin-top:16px"><p class="eyebrow">Godkjent</p><p>' + SV.fdate(ap.d, true) + ' av ' + esc(ap.by) + '.</p></div>' : '<div style="margin-top:16px">' + SV.reviewBox(j, me) + '</div>') +
        SV.reviewThread(j, 'kunde') +
        '<div class="sec">' + (ap ? '<div class="gal big">' + ph.map(function (x) { return '<figure class="gi">' + SV.pic(x.src, x.pos) + '<span class="gi-n">' + esc(x.name) + '</span></figure>'; }).join('') + '</div>' : SV.reviewGallery(j, me)) + '</div>' +
        '<div class="sec">' + SV.reviewPlan(j, me, !ap) + '</div>' +
        '<details class="card pad sec"><summary><b>Om oppdraget</b></summary>' + info + '</details></div>';
    }
    return brand('for ' + o.name) +
      '<div class="bhead"><h1>Hei ' + esc(first) + '! Vi skal fotografere ' + esc(j.addr) + '.</h1><p>Her finner du tiden vi har avtalt, hva ' + esc(j.broker) + ' har bestilt, og hvordan du gjør boligen klar.</p></div>' + stepper +
      info +
      (drone ? '<div class="callout" style="margin-top:16px">' + ic('wind') + '<span>Dronebilder krever lite vind. Vi sjekker været dagen før og sender e-post hvis dronen må flyttes. Resten tas som avtalt.</span></div>' : '') +
      prep + after;
  }, { title: 'Fotografering' });
  SV.on('sellerPick', function (el) { var v = (document.querySelector('input[name=t]:checked') || {}).value; if (!v) return; SV.state.sellerTime = SV.state.sellerTime || {}; SV.state.sellerTime[el.getAttribute('data-id')] = v.split(' '); SV.save(); SV.setStage(SV.find(SV.jobs(), el.getAttribute('data-id')), 'Fotografering avtalt', { quiet: true }); SV.toast('Tiden er bekreftet · megler og fotograf er varslet'); });
  SV.on('sellerMove', function (el) { delete SV.state.sellerTime[el.getAttribute('data-id')]; SV.save(); SV.render(); });
  SV.on('ics', function () { SV.toast('Kalenderfil lastet ned'); });
  SV.on('prep', function (el) { SV.state.prep = SV.state.prep || {}; var id = el.getAttribute('data-id'); (SV.state.prep[id] = SV.state.prep[id] || {})[el.getAttribute('data-k')] = el.checked; SV.save(); el.closest('li').classList.toggle('done', el.checked); });

  // ---------- Ansatt: samtykke til bilde og film ----------
  SV.clientCfg.ansatt = { bare: true };
  var USES = [['web', 'Nettsiden til Vestkraft', true], ['intra', 'Intranett og interne presentasjoner', true], ['some', 'Sosiale medier (LinkedIn, Facebook, Instagram)', true], ['ads', 'Betalte annonser', false], ['rec', 'Rekrutteringsfilm og stillingsannonser', true], ['press', 'Presse og media', false]];
  SV.route('/samtykke', 'ansatt', function () {
    var st = SV.state.consentKjell;
    if (st && st.signed) {
      return brand('for Vestkraft Energi AS') + '<div class="bhead"><h1>Takk, Kjell.</h1><p>Samtykket er lagret ' + SV.fdate(st.date, true) + '. Du kan endre eller trekke det tilbake når som helst her, og vi fjerner bildene fra de kanalene du sier nei til.</p></div>' +
        '<div class="card pad" style="margin-top:18px"><h3 class="h3">Du har sagt ja til</h3><ul class="check" style="margin-top:8px">' + USES.map(function (u) { return '<li class="' + (st.uses[u[0]] ? '' : 'done') + '">' + ic(st.uses[u[0]] ? 'check' : 'x') + '<span>' + u[1] + '</span></li>'; }).join('') + '</ul></div>' +
        '<div class="row" style="margin-top:16px"><button class="btn btn-ghost" data-act="consentEdit">Endre</button><button class="btn btn-ghost" data-act="consentWithdraw">Trekk tilbake alt</button></div>';
    }
    return brand('for Vestkraft Energi AS') +
      '<div class="bhead"><h1>Kan vi bruke bilder og film av deg?</h1><p>Vestkraft lager en rekrutteringsfilm ' + SV.fdate(D.W(1), true) + ', og du er på listen. Velg selv hva bildene kan brukes til. Det tar ett minutt.</p></div>' +
      '<div class="who" style="margin-top:18px">' + SV.avatar('Kjell Ask') + '<div><b>Kjell Ask</b><br><span class="small muted">Fagarbeider · Vestkraft Energi AS</span></div></div>' +
      '<div style="margin-top:18px">' + USES.map(function (u) { return '<label class="choice cb"><input type="checkbox" name="use" value="' + u[0] + '"' + (u[2] ? ' checked' : '') + '><b>' + u[1] + '</b></label>'; }).join('') + '</div>' +
      '<div class="callout sage" style="margin:8px 0 16px">' + ic('shield') + '<span>Bildene lagres hos Studiovest i EU så lenge du jobber i Vestkraft. Slutter du, skjules portrettene automatisk. Du kan trekke samtykket tilbake når som helst.</span></div>' +
      '<button class="btn btn-dark bigbtn" data-act="consentSign">Lagre samtykke</button><p class="hint" style="text-align:center">Du kan også si nei til alt. <button class="link" data-act="consentNone">Jeg vil ikke være med</button></p>';
  }, { title: 'Samtykke' });
  SV.on('consentSign', function () { var u = {}; document.querySelectorAll('input[name=use]').forEach(function (x) { u[x.value] = x.checked; }); SV.state.consentKjell = { signed: true, date: D.iso(D.today), uses: u }; SV.save(); SV.render(); SV.toast('Samtykke lagret · Vestkraft og Studiovest ser det i opptakslisten'); });
  SV.on('consentNone', function () { var u = {}; USES.forEach(function (x) { u[x[0]] = false; }); SV.state.consentKjell = { signed: true, date: D.iso(D.today), uses: u }; SV.save(); SV.render(); SV.toast('Lagret · du blir ikke filmet eller fotografert'); });
  SV.on('consentEdit', function () { SV.state.consentKjell = null; SV.save(); SV.render(); });
  SV.on('consentWithdraw', function () { var u = {}; USES.forEach(function (x) { u[x[0]] = false; }); SV.state.consentKjell.uses = u; SV.save(); SV.render(); SV.toast('Samtykket er trukket tilbake · bildene fjernes innen 30 dager'); });

  // ---------- Foresatt før fotodag: samtykke og valg ----------
  SV.route('/kunde/foresatt/samtykke', 'foresatt', function () {
    var s = D.schoolDays[1], c = (SV.state.preConsent || null);
    if (c) {
      return '<div style="max-width:560px;margin:0 auto"><p class="eyebrow">Sjøbakken barnehage · fotodag ' + SV.fdate(s.date) + '</p>' +
        '<div class="bhead"><h1>Takk! Valgene for Selma er lagret.</h1><p>Fotografen ser valgene dine på fotodagen. Du får e-post når bildene er klare, ca. tre dager etter.</p></div>' +
        '<div class="card pad" style="margin-top:16px"><dl class="kv"><dt>Fotografering</dt><dd>' + esc(c.consent) + '</dd><dt>Søskenbilde</dt><dd>' + (c.sib ? 'Ja, med Johannes (Bjørnehiet)' : 'Nei') + '</dd><dt>Vennebilde</dt><dd>' + (c.friend ? 'Med ' + esc(c.friend) + ' · venter på svar fra deres foresatte' : 'Nei') + '</dd><dt>Bakgrunn</dt><dd>' + esc(c.bg) + '</dd></dl></div>' +
        SV.skx.preDone() + '<button class="btn btn-ghost" style="margin-top:14px" data-act="preEdit">Endre</button></div>';
    }
    return '<div style="max-width:560px;margin:0 auto"><p class="eyebrow">Sjøbakken barnehage · fotodag ' + SV.fdate(s.date) + '</p>' +
      '<div class="bhead"><h1>Fotodag for Selma ' + SV.fdate(s.date, true) + '</h1><p>Velg hva som gjelder for Selma. Ingen bilder tas uten ditt ja, og du kan endre til fotodagen.</p></div>' +
      '<form id="pre" onsubmit="return false" style="margin-top:18px"><h2 class="h2"><span class="serif">Fotografering</span></h2>' +
      [['Portrett og gruppebilde', 'Vanlig fotodag'], ['Bare gruppebilde', 'Ikke eget portrett'], ['Ikke fotografer Selma', 'Hun er ikke med på noen bilder']].map(function (x, i) { return '<label class="choice"><input type="radio" name="c" value="' + x[0] + '"' + (i === 0 ? ' checked' : '') + '><b>' + x[0] + '</b><small>' + x[1] + '</small></label>'; }).join('') +
      '<h2 class="h2" style="margin-top:20px"><span class="serif">Søsken</span></h2><label class="choice cb"><input type="checkbox" name="sib" checked><b>Søskenbilde med Johannes</b><small>Bjørnehiet · tas etter lunsj</small></label>' +
      '<h2 class="h2" style="margin-top:20px"><span class="serif">Vennebilde</span></h2><label class="fld"><span>Hvem vil Selma bli tatt bilde med? (valgfritt)</span><input class="inp" name="friend" placeholder="Navnet på vennen"></label><p class="hint" style="margin-top:-6px;margin-bottom:12px">Vennens foresatte får spørsmål og må også si ja.</p>' +
      '<h2 class="h2" style="margin-top:20px"><span class="serif">Bakgrunn på portrettet</span></h2><div class="row">' + [['Lys', '#EDE8E0'], ['Grå', '#9A958E'], ['Ute i naturen', '#6F7D5C']].map(function (b, i) { return '<label class="choice" style="flex:1;min-width:140px"><input type="radio" name="bg" value="' + b[0] + '"' + (i === 0 ? ' checked' : '') + '><span class="swatch" style="background:' + b[1] + ';display:block;margin-bottom:6px"></span><b>' + b[0] + '</b></label>'; }).join('') + '</div>' +
      SV.skx.presale() + '<button class="btn btn-dark bigbtn" style="margin-top:16px" data-act="preSave">Lagre valgene</button></form>' +
      '<p class="hint" style="text-align:center;margin-top:12px">Bildene vises bare for dere og barnehagen og slettes etter 24 måneder.</p></div>';
  }, { title: 'Fotodag' });
  SV.on('preSave', function () { var f = document.getElementById('pre'); SV.state.preConsent = { consent: f.querySelector('input[name=c]:checked').value, sib: f.sib.checked, friend: f.friend.value.trim(), bg: f.querySelector('input[name=bg]:checked').value }; SV.save(); SV.render(); SV.toast('Lagret · barnehagen og fotografen ser valgene'); });
  SV.on('preEdit', function () { SV.state.preConsent = null; SV.save(); SV.render(); });
})();
