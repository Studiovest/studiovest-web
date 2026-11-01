/* Markedsføring: innholdskalender, kampanjer, rapporter + kundens godkjenning. */
(function () {
  'use strict';
  var SV = window.SV, D = SV.data, esc = SV.esc, ic = SV.icon;
  var ST = ['Idé', 'Produksjon', 'Til godkjenning', 'Planlagt', 'Publisert'];
  function stOf(p, i) { return SV.state.postStatus[i] || p.status; }
  function co(id) { return SV.find(D.companies, id); }

  function month(posts) {
    var t = D.today, first = new Date(t.getFullYear(), t.getMonth(), 1), start = new Date(first); start.setDate(1 - ((first.getDay() + 6) % 7));
    var out = '<div class="mo">' + ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'].map(function (d) { return '<div class="mo-h">' + d + '</div>'; }).join('');
    for (var i = 0; i < 42; i++) {
      var d = D.addDays(start, i), iso = D.iso(d); if (i >= 35 && d.getMonth() !== t.getMonth()) break;
      out += '<div class="mo-d' + (d.getMonth() !== t.getMonth() ? ' out' : '') + (SV.diff(iso) === 0 ? ' today' : '') + '"><span class="mo-n">' + d.getDate() + '</span>' +
        posts.map(function (p, k) { return p.d === iso ? '<button class="post st-' + stOf(p, k).split(' ')[0] + '" data-act="post" data-i="' + k + '"><span class="ch">' + D.channels[p.ch] + '</span>' + SV.dot(p.company === 'vke' ? 'bedrift' : p.company === 'rfh' ? 'mark' : p.company === 'htk' ? 'skole' : 'bolig') + ' <b>' + esc(p.title) + '</b></button>' : ''; }).join('') + '</div>';
    }
    return out + '</div>';
  }
  var LEG = [['vke', 'bedrift'], ['rfh', 'mark'], ['htk', 'skole'], ['hmv', 'bolig']];

  SV.route('/marked', 'studio', function () {
    var cal = '<div class="legend" style="margin-bottom:12px">' + LEG.map(function (l) { return '<span>' + SV.dot(l[1]) + esc(co(l[0]).name) + '</span>'; }).join('') + '<span style="margin-left:auto">Ramme = venter på kunden</span></div><div class="card" style="overflow:hidden">' + month(D.posts) + '</div>';
    var camp = '<div class="g3">' + D.campaigns.map(function (c) {
      return '<div class="card pad"><div class="row between"><p class="eyebrow" style="margin:0">' + esc(co(c.company).name) + '</p>' + SV.chip(c.status) + '</div><h3 class="h3" style="font-size:19px;margin-top:8px">' + esc(c.name) + '</h3><p class="small muted">' + esc(c.period) + ' · mål: ' + esc(c.goal) + '</p>' +
        '<div style="margin:16px 0 6px" class="row between small"><span>Budsjett brukt</span><b class="num">' + SV.kr(c.spent) + ' / ' + SV.kr(c.budget) + '</b></div>' + SV.bar(c.spent, c.budget, 'mark') +
        '<div class="g3" style="margin-top:16px;gap:8px"><div><p class="tiny muted">Rekkevidde</p><b class="num">' + SV.num(c.reach) + '</b></div><div><p class="tiny muted">Klikk</p><b class="num">' + SV.num(c.clicks) + '</b></div><div><p class="tiny muted">Resultat</p><b class="small">' + esc(c.result) + '</b></div></div></div>';
    }).join('') + '</div>';
    var rep = '<div class="g21"><div class="card"><div class="card-h"><h3>Oktober · alle kunder</h3></div><div class="card-b">' + [['Rosendal Fjordhotell', 52300, 1904, '+38 %'], ['Vestkraft Energi AS', 18400, 612, '+12 %'], ['Halsnøy Tannklinikk', 4100, 96, '+5 %']].map(function (r) { return '<div class="li" style="display:grid;grid-template-columns:1fr 90px 70px 60px;gap:10px"><b>' + r[0] + '</b><span class="num small">' + SV.num(r[1]) + '</span><span class="num small">' + SV.num(r[2]) + '</span><span class="small" style="color:var(--ok);font-weight:750">' + r[3] + '</span></div>'; }).join('') + '<p class="hint">Rekkevidde · klikk · endring fra september. Hentes fra Meta og LinkedIn når kontoene kobles til.</p></div></div>' +
      '<div class="card pad"><h3 class="h3">Månedsrapport til kunden</h3><p class="small muted" style="margin:6px 0 14px">PDF med Studiovest-uttrykk: hva vi laget, hva det nådde, og forslag til neste måned.</p><div class="mailprev"><div class="mp-h"><span class="lg"><span class="serif">STUDIO</span><span class="bold">VEST</span></span><span class="small">Oktober</span></div><div class="mp-b" style="white-space:normal"><b>52 300</b> nådd · <b>1 904</b> klikk · <b>74</b> bookinger.<br>Beste innlegg: Høstmeny-karusell.</div></div><button class="btn btn-ghost btn-xs" style="margin-top:12px" data-act="dummy">Forhåndsvis PDF</button></div></div>';
    var wait = D.posts.filter(function (p, i) { return stOf(p, i) === 'Til godkjenning'; }).length;
    return SV.head({ eyebrow: SV.dot('mark') + 'Markedsføring · ' + wait + ' venter på godkjenning · ' + D.campaigns.filter(function (c) { return c.status === 'Aktiv'; }).length + ' aktive kampanjer', a: 'Markedsføring', lead: 'Vi lager innholdet, kunden godkjenner i sin portal, og portalen publiserer og rapporterer. Bildene hentes rett fra kundens mediebank.', actions: '<a class="btn btn-ghost btn-s" href="#/kunde/bedrift/innhold">' + ic('eye') + 'Kundens visning</a><button class="btn btn-acc btn-s" data-act="dummy">' + ic('plus') + 'Nytt innlegg</button>' }) +
      SV.tabs('mk', [['k', 'Innholdskalender', D.posts.length], ['c', 'Kampanjer', D.campaigns.length], ['r', 'Rapporter']], 'k') + SV.panels('mk', { k: cal, c: camp, r: rep }, 'k');
  }, { title: 'Markedsføring' });

  SV.on('post', function (el) {
    var i = +el.getAttribute('data-i'), p = D.posts[i], s = stOf(p, i);
    SV.drawer('<p class="eyebrow">' + D.channels[p.ch] + ' · ' + SV.fdate(p.d, true) + '</p><h2 class="h2"><span class="serif">' + esc(p.title) + '</span></h2><p class="small muted">' + esc(co(p.company).name) + '</p>' +
      '<div class="gi" style="margin:18px 0;aspect-ratio:4/5;max-width:300px;cursor:default">' + SV.pic(p.company === 'rfh' ? D.img.hytte : p.company === 'vke' ? D.img.sveiser : p.company === 'htk' ? D.img.kontor : D.img.bygg) + '</div>' +
      '<p class="small" style="font-weight:750;margin-bottom:8px">Status</p><div class="filters">' + ST.map(function (x) { return '<button class="fbtn' + (x === s ? ' on' : '') + '" data-act="postSt" data-i="' + i + '" data-s="' + x + '">' + x + '</button>'; }).join('') + '</div>' +
      (p.reach ? '<p class="small">Nådde <b>' + SV.num(p.reach) + '</b> personer</p>' : '<p class="hint">Når status settes til «Til godkjenning», får kunden e-post med forhåndsvisning.</p>'));
  });
  SV.on('postSt', function (el) { var i = +el.getAttribute('data-i'); SV.state.postStatus[i] = el.getAttribute('data-s'); SV.save(); SV.close(); SV.render(); SV.toast('Status: ' + el.getAttribute('data-s')); });

  // kundens innhold (Vestkraft)
  SV.route('/kunde/bedrift/innhold', 'bedrift', function () {
    var mine = D.posts.map(function (p, i) { return { p: p, i: i }; }).filter(function (x) { return x.p.company === 'vke'; });
    return SV.head({ eyebrow: 'Innholdsplan · LinkedIn, Instagram og nettside', a: 'Innhold', b: 'og kampanjer', lead: 'Se hva som kommer, og godkjenn innlegg før de publiseres. Ingenting går ut uten at dere har sagt ja.' }) +
      '<div class="g21"><div class="stack">' + mine.map(function (x) {
        var s = stOf(x.p, x.i), wait = s === 'Til godkjenning';
        return '<div class="card" style="display:grid;grid-template-columns:120px 1fr;overflow:hidden"><div style="background:var(--stone)">' + SV.pic(D.img.sveiser, (x.i * 17 % 100) + '% 50%').replace('<img', '<img style="width:100%;height:100%;object-fit:cover"') + '</div><div class="pad"><div class="row between"><p class="eyebrow" style="margin:0">' + D.channels[x.p.ch] + ' · ' + SV.fdate(x.p.d) + '</p>' + SV.chip(s) + '</div><b style="display:block;font-size:16px;margin-top:6px">' + esc(x.p.title) + '</b>' +
          (wait ? '<div class="row" style="margin-top:12px"><button class="btn btn-acc btn-xs" data-act="postOk" data-i="' + x.i + '">' + ic('check') + 'Godkjenn</button><button class="btn btn-ghost btn-xs" data-act="fixSend">Be om endring</button></div>' : x.p.reach ? '<p class="small muted" style="margin-top:6px">Nådde ' + SV.num(x.p.reach) + ' personer</p>' : '') + '</div></div>';
      }).join('') + '</div>' +
      '<div class="card pad"><p class="eyebrow">Kampanje</p><h3 class="h3" style="font-size:19px">Lærlinger 2027</h3><p class="small muted">Nov–jan · mål 40 søknader</p><p class="bignum" style="margin-top:16px">11</p><p class="small muted">søknader så langt</p><div style="margin-top:14px">' + SV.bar(11, 40, 'mark') + '</div><dl class="kv small" style="margin-top:16px"><dt>Rekkevidde</dt><dd>18 400</dd><dt>Klikk</dt><dd>612</dd><dt>Budsjett brukt</dt><dd>6 200 av 25 000 kr</dd></dl></div></div>';
  }, { title: 'Innhold' });
  SV.on('postOk', function (el) { SV.state.postStatus[+el.getAttribute('data-i')] = 'Planlagt'; SV.save(); SV.render(); SV.toast('Godkjent · publiseres som planlagt'); });
})();
