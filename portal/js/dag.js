/* Fotograf: dagmodus på mobil. Redigering: egen visning for ekstern redigerer. */
(function () {
  'use strict';
  var SV = window.SV, D = SV.data, esc = SV.esc, ic = SV.icon;

  SV.clientCfg.dag = { bare: true };
  var SHOTS = { f20: ['Fasade', 'Stue (2 vinkler)', 'Kjøkken', 'Bad', 'Hovedsoverom', 'Utsikt'], f30: ['Fasade (2 vinkler)', 'Inngangsparti', 'Stue (3 vinkler)', 'Kjøkken (2)', 'Spiseplass', 'Bad', 'Soverom (alle)', 'Uteplass', 'Utsikt'], f40: ['Fasade (3 vinkler)', 'Tun og uthus', 'Stue (3)', 'Kjøkken (2)', 'Spiseplass', 'Bad (alle)', 'Soverom (alle)', 'Bod og teknisk', 'Uteområder', 'Utsikt'], dr: ['Drone: oversikt', 'Drone: mot sjø/utsikt', 'Drone: tomtegrenser'], kv: ['Kveldsbilde fasade (blå time)'], vi: ['Video: gjennomgang', 'Video: ute + drone'], re: ['Reel: 6–8 korte klipp, stående'], p2: ['Mål opp alle rom til plantegning'], p3: ['Notér møblering til 3D'] };
  function shots(j) { var a = []; j.services.forEach(function (s) { (SHOTS[s] || []).forEach(function (x) { a.push(x); }); }); return a; }

  SV.route('/dag', 'dag', function () {
    var b = D.iso(D.base), list = SV.jobs().filter(function (j) { return j.date === b && (SV.stageOf(j) === 'Planlagt' || SV.stageOf(j) === 'Fotografert'); }).sort(function (x, y) { return x.time < y.time ? -1 : 1; });
    var km = list.reduce(function (a, j) { return a + (SV.travel[j.town] || 30); }, 0), done = SV.state.shotDone || {};
    return SV.brand('Fotograf · ' + SV.fdate(b, true)) +
      '<div class="bhead"><h1>' + list.length + ' oppdrag ' + (SV.diff(b) === 0 ? 'i dag' : SV.dayName(b)) + '</h1><p>Første kl. ' + (list[0] ? list[0].time : '–') + ' · ca. ' + Math.round(km / 60 * 10) / 10 + ' t kjøring · ' + esc((list.filter(function (j) { return j.services.indexOf('dr') > -1; })[0] || {}).weather || 'ingen drone') + '</p></div>' +
      '<div style="margin-top:18px">' + list.map(function (j, n) {
        var st = SV.stageOf(j), sh = shots(j), dn = done[j.id] || {}, cnt = Object.keys(dn).filter(function (k) { return dn[k]; }).length;
        var maps = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(j.addr + ', ' + j.town);
        return '<details class="dayjob"' + (n === 0 ? ' open' : '') + '><summary><span class="time">' + j.time + '</span><span class="li-t"><b>' + esc(j.addr) + '</b><small>' + esc(j.town) + ' · ' + esc(j.type) + ' · ' + SV.svcShort(j) + '</small></span>' + (st === 'Fotografert' ? SV.chip('Ferdig') : '<span class="small muted">' + cnt + '/' + sh.length + '</span>') + '</summary><div class="djb">' +
          '<div class="acts"><a href="' + maps + '" target="_blank" rel="noopener">' + ic('route') + 'Naviger</a><a href="tel:' + esc(j.phone.replace(/\s/g, '')) + '">' + ic('chat') + 'Ring ' + esc(j.seller.split(' ')[0]) + '</a><button data-act="onWay" data-id="' + j.id + '">' + ic('mail') + 'På vei</button></div>' +
          '<dl class="kv small"><dt>Tilgang</dt><dd>' + esc(j.access) + '</dd><dt>Megler</dt><dd>' + esc(j.broker) + '</dd>' + (j.services.indexOf('dr') > -1 ? '<dt>Vær</dt><dd>' + esc(j.weather || 'Sjekk') + '</dd>' : '') + '<dt>Tid</dt><dd>ca. ' + Math.round(SV.minutes(j) / 6) / 10 + ' t</dd></dl>' +
          '<p class="small" style="font-weight:700;margin:14px 0 4px">Bildeliste</p><ul class="check">' + sh.map(function (t, k) { return '<li class="' + (dn[k] ? 'done' : '') + '"><input type="checkbox" id="s' + j.id + k + '"' + (dn[k] ? ' checked' : '') + ' data-change="shotTick" data-id="' + j.id + '" data-k="' + k + '"><label for="s' + j.id + k + '"><span>' + esc(t) + '</span></label></li>'; }).join('') + '</ul>' +
          '<div class="g2" style="margin-top:12px;gap:8px"><label class="fld"><span>Km tur/retur</span><input class="inp" inputmode="numeric" value="' + Math.round((SV.travel[j.town] || 30) * 1.3) + '"></label><label class="fld"><span>Ferje (kr)</span><input class="inp" inputmode="numeric" value="' + (j.town === 'Ølve' ? 186 : 0) + '"></label></div>' +
          (st === 'Fotografert' ? '<p class="small muted">Fotografert. Råfilene lastes opp når du er på wifi.</p>' : '<button class="btn btn-dark bigbtn" data-act="shotDone" data-id="' + j.id + '">' + ic('check') + 'Ferdig fotografert</button>') +
        '</div></details>';
      }).join('') + '</div>' +
      '<a class="btn btn-ghost bigbtn" href="#/skole/fotograf" style="margin-top:8px">' + ic('qr') + 'Skolefoto-modus</a>';
  }, { title: 'Dagen' });
  SV.on('shotTick', function (el) { SV.state.shotDone = SV.state.shotDone || {}; var id = el.getAttribute('data-id'); (SV.state.shotDone[id] = SV.state.shotDone[id] || {})[el.getAttribute('data-k')] = el.checked; SV.save(); el.closest('li').classList.toggle('done', el.checked); });
  SV.on('onWay', function (el) { var j = SV.find(SV.jobs(), el.getAttribute('data-id')); SV.toast('SMS til ' + j.seller.split(' ')[0] + ': «Fotografen er på vei, framme ca. om 20 min»'); });
  SV.on('shotDone', function (el) { var id = el.getAttribute('data-id'); SV.state.stage[id] = 'Fotografert'; SV.save(); SV.render(); SV.toast('Registrert · megler ser at boligen er fotografert'); });

  // ---------- Redigering (ekstern) ----------
  SV.clientCfg.red = { bare: true };
  SV.route('/redigering', 'red', function () {
    var list = SV.jobs().filter(function (j) { var s = SV.stageOf(j); return s === 'Redigering' || s === 'Fotografert'; });
    var up = SV.state.edUp || {};
    return '<div class="bpage wide" style="padding:0;max-width:none">' + SV.brand('Redigering · ekstern partner') +
      '<div class="bhead"><h1>' + list.length + ' oppdrag i køen</h1><p>Last ned utvalget, rediger etter Studiovests stil og last opp ferdige filer. Studiovest kontrollerer før levering til megler.</p></div>' +
      '<div class="card sec tbl-w"><table class="tbl"><thead><tr><th>Oppdrag</th><th class="hide-s">Frist</th><th class="hide-s">Utvalg</th><th class="hide-s">Notat fra fotograf</th><th class="r">Status</th></tr></thead><tbody>' +
      list.map(function (j) {
        var st = SV.stageOf(j), u = up[j.id];
        return '<tr><td><b>' + esc(j.addr) + '</b><small>Frist ' + (j.due ? SV.fdate(j.due) + ' kl. 12' : 'neste virkedag') + ' · ' + esc(j.town) + '</small></td><td class="hide-s" style="white-space:nowrap"><span class="' + (j.due && SV.diff(j.due) <= 0 ? 'due' : '') + '">' + (j.due ? SV.fdate(j.due) + ' kl. 12' : 'neste virkedag') + '</span></td><td class="hide-s num">' + (j.services.indexOf('f40') > -1 ? 40 : j.services.indexOf('f30') > -1 ? 30 : 20) + ' serier</td><td class="hide-s small">' + (j.services.indexOf('vm') > -1 ? 'Digital møblering på stue 2 og loft 2. Merk «Illustrasjon».' : j.services.indexOf('kv') > -1 ? 'Kveld: varm vinduslys, ikke overdriv himmel.' : 'Fjern ledning over kjøkkenbenk. Rette vertikaler.') + '</td>' +
          '<td class="r">' + (u ? SV.chip('Til kontroll', 'ok') : st === 'Fotografert' ? SV.chip('Venter på utvalg', 'mute') : '<div class="row" style="justify-content:flex-end;flex-wrap:nowrap"><button class="btn btn-ghost btn-xs" data-act="edDl">' + ic('down') + 'RAW</button><button class="btn btn-dark btn-xs" data-act="edUp" data-id="' + j.id + '">' + ic('upload') + 'Last opp</button></div>') + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="g2 sec"><div class="card pad"><h3 class="h3">Stilguide</h3><ul class="research new" style="margin-top:8px"><li>Naturlige farger, varm men ikke gul hvitbalanse.</li><li>Rette vertikaler i alle interiørbilder.</li><li>Vinduer: utsikt synlig, ikke utbrent.</li><li>Himmelbytte bare ved grå himmel, aldri ny utsikt.</li><li>Digital møblering alltid merket «Illustrasjon».</li></ul></div>' +
      '<div class="card pad"><h3 class="h3">Avtale</h3><dl class="kv" style="margin-top:10px"><dt>Pris</dt><dd>35 kr per bilde</dd><dt>Frist</dt><dd>Neste virkedag kl. 12</dd><dt>Ekspress</dt><dd>Samme dag, +50 %</dd><dt>Faktura</dt><dd>Månedlig, automatisk fra opplastinger</dd></dl></div></div></div>';
  }, { title: 'Redigering' });
  SV.on('edDl', function () { SV.toast('Utvalget lastes ned som ZIP (RAW + notater)'); });
  SV.on('edUp', function (el) { el.disabled = true; el.textContent = 'Laster opp …'; var id = el.getAttribute('data-id'); setTimeout(function () { SV.state.edUp = SV.state.edUp || {}; SV.state.edUp[id] = true; SV.save(); SV.render(); SV.toast('Lastet opp · Studiovest varslet for kontroll'); }, 900); });
})();
