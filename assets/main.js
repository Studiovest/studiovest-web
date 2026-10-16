// Studiovest forside. Bilder legges i assets/photos/ med navnene under.
// Mangler et bilde, vises en beige ramme med beskrivelse i stedet.
(function () {
  var P = 'assets/photos/';
  var V = '?v=__V__'; // byttes ut med versjonsnummer ved publisering, så nye bilder vises med en gang

  var worlds = [
    { num: '01', name: 'BOLIG',   tint: '#D9C6B0', img: P + 'hero-bolig.jpg' + V,   label: 'lys stue med fjordutsikt, kveldslys',  exif: 'ƒ/8 · 1/60 · ISO 200 · HDR ×5' },
    { num: '02', name: 'MENNESKER', tint: '#ECE4D9', img: P + 'hero-bedrift.jpg' + V, label: 'ansatt i kontorlandskap',          exif: 'ƒ/2.8 · 1/250 · ISO 400 · 85 MM' },
    { num: '03', name: 'SKOLE',     tint: '#E4D5BF', img: P + 'hero-skole.jpg' + V,   label: 'barnehagebarn som ler, utendørs',  exif: 'ƒ/4 · 1/500 · ISO 320 · 50 MM' },
    { num: '04', name: 'BEDRIFT',   tint: '#CDB89F', img: P + 'hero-bedriftsbygg.jpg' + V, label: 'kontorbygg ved sjøen, skumring', exif: 'ƒ/11 · 1/125 · ISO 100 · 24 MM' }
  ];

  var chapters = [
    { title: 'Boligfoto', exif: 'ƒ/8 · HDR', tint: '#EDE3D6', img: P + 'kap-bolig.jpg' + V, photo: 'interiør, kjøkken i dagslys',
      desc: 'Bilder som får visningen fullbooket. Interiør, eksteriør, drone og plantegning i én bestilling — levert til megler neste virkedag.',
      items: ['Interiør og eksteriør', 'Dronefoto', 'Plantegning 2D/3D', 'Video og virtuell visning', 'Digital møblering'] },
    { title: 'Bedrift', exif: 'ƒ/2.8 · 85MM', tint: '#FFFFFF', img: P + 'kap-bedrift.jpg' + V, photo: 'ansatte i møterom, naturlig lys',
      desc: 'Portretter, lokaler og folk i arbeid — foto og video som viser hvem dere er, ikke et bildebyrås gjetning.',
      items: ['Ansattportretter', 'Kontor og lokaler', 'Foto og video i arbeid', 'Drone', 'Innhold til sosiale medier'] },
    { title: 'Skole og\nbarnehage', exif: 'ƒ/4 · 1/500', tint: '#E6D8C6', img: P + 'kap-skole.jpg' + V, photo: 'klassebilde i skolegården',
      desc: 'Rolig, trygg og effektiv fotodag. Individuelle bilder, gruppebilder og en enkel bestillingsløsning for foreldre.',
      items: ['Individuelle portretter', 'Klasse- og gruppebilder', 'Søskenbilder', 'Bestilling på nett'] },
    { title: 'Maritim og\nindustri', exif: 'ƒ/11 · DRONE', tint: '#F3ECE2', img: P + 'kap-maritim.jpg' + V, photo: 'mannskap på dekk under operasjon',
      desc: 'Vi kjenner livet om bord. Dokumentasjon, markedsføring og film fra dekk, verft og anlegg — sikkert og uten å stoppe driften.',
      items: ['Fartøy og verft', 'Operasjoner på dekk', 'Drone over anlegg', 'Bedriftsfilm', 'HMS-dokumentasjon'] }
  ];

  var reelLabels = ['tomannsbolig, skumring', 'daglig leder, portrett', 'trål ved kai', 'førsteklasse, klassebilde', 'loft med takvinduer',
                    'sveiser i arbeid', 'hytte fra drone', 'kontorlandskap', 'servicefartøy i sjø', 'barnehage, utelek'];
  var reelTints = ['#D9C6B0', '#ECE4D9', '#CDB89F', '#E4D5BF'];

  // Laster et bilde; kaller cb(true) hvis det finnes.
  var cache = {};
  function probe(src, cb) {
    if (src in cache) return cb(cache[src]);
    var im = new Image();
    im.onload = function () { cache[src] = true; cb(true); };
    im.onerror = function () { cache[src] = false; cb(false); };
    im.src = src;
  }
  function applyImg(el, src, fallbackTint) {
    el.style.backgroundColor = fallbackTint;
    probe(src, function (ok) {
      if (ok) { el.style.backgroundImage = 'url("' + src + '")'; el.classList.add('has-img'); }
    });
  }

  // Hero: roterende ord + søker
  var track = document.getElementById('wordTrack');
  var vf = document.getElementById('vfPhoto');
  var drift = vf.querySelector('.vf-drift');
  var w = 0;
  function showWorld(i) {
    var d = worlds[i];
    track.style.transform = 'translateY(-' + (i * 1.02) + 'em)';
    vf.style.backgroundColor = d.tint;
    document.getElementById('vfNum').textContent = 'KAP. ' + d.num + ' / 04';
    document.getElementById('vfName').textContent = d.name;
    document.getElementById('vfExif').textContent = d.exif;
    document.getElementById('vfLabel').textContent = '[FOTO: ' + d.label + ']';
    probe(d.img, function (ok) {
      if (i !== w) return;
      vf.classList.toggle('has-img', ok);
      drift.style.backgroundImage = ok ? 'url("' + d.img + '")' : 'none';
    });
  }
  worlds.forEach(function (d) { probe(d.img, function () {}); }); // forhåndslast
  showWorld(0);
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduce) setInterval(function () { w = (w + 1) % worlds.length; showWorld(w); }, 3200);

  // Kapitler
  var box = document.getElementById('chapters');
  chapters.forEach(function (c, i) {
    var b = document.createElement('button');
    b.className = 'chap' + (i === 0 ? ' open' : '');
    b.setAttribute('aria-expanded', i === 0 ? 'true' : 'false');
    b.innerHTML =
      '<div class="chap-top"><span class="mono chap-num">0' + (i + 1) + '</span><span class="mono chap-exif">' + c.exif + '</span></div>' +
      '<div class="chap-body"><div class="mono chap-photo">[FOTO: ' + c.photo + ']</div>' +
      '<p class="chap-desc">' + c.desc + '</p>' +
      '<div class="chips">' + c.items.map(function (t) { return '<span>' + t + '</span>'; }).join('') + '</div></div>' +
      '<div class="chap-foot"><span class="chap-title"></span><span class="chap-arrow" aria-hidden="true">→</span></div>';
    b.querySelector('.chap-title').textContent = c.title;
    applyImg(b, c.img, c.tint);
    b.addEventListener('click', function () {
      box.querySelectorAll('.chap').forEach(function (x) { x.classList.remove('open'); x.setAttribute('aria-expanded', 'false'); });
      b.classList.add('open'); b.setAttribute('aria-expanded', 'true');
    });
    box.appendChild(b);
  });

  // Bildestripe (dupliseres for sømløs loop)
  var reel = document.getElementById('reel');
  for (var k = 0; k < 20; k++) {
    var n = (k % 10) + 1;
    var card = document.createElement('div');
    card.className = 'reel-card';
    card.innerHTML = '<span>' + String(n).padStart(2, '0') + '</span><span>[FOTO: ' + reelLabels[n - 1] + ']</span>';
    applyImg(card, P + 'reel-' + String(n).padStart(2, '0') + '.jpg' + V, reelTints[k % 4]);
    reel.appendChild(card);
  }
})();
