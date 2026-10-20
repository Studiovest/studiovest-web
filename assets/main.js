// Studiovest forside — konsept «Fremkalling».
(function () {
  var V = '?v=__V__';
  var P = 'assets/photos/';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DUR = 4800;

  function photo(file, alt, cls) {
    var img = new Image();
    img.src = P + file + V;
    img.alt = alt || '';
    img.width = 1168; img.height = 784;
    if (cls && !reduce) img.className = cls;
    return img;
  }
  // Legger nytt bilde oppå og fjerner det gamle når fremkallingen er ferdig.
  function swapInto(box, img) {
    box.appendChild(img);
    var clean = function () { while (box.children.length > 1) box.removeChild(box.firstChild); };
    if (reduce) clean(); else img.addEventListener('animationend', clean, { once: true });
  }

  /* ---------- Hero ---------- */
  var slides = [
    { word: 'hjemmet,',   img: 'bolig-stue.jpg',     alt: 'Stue med peis og store vinduer mot fjorden i kveldslys', cap: 'Boligfoto. Stue med fjordutsikt i blå time.' },
    { word: 'folka,',     img: 'bedrift-kontor.jpg', alt: 'Ansatt ved skrivebord i et lyst kontorlandskap',          cap: 'Bedrift. Hverdag i kontorlandskapet.' },
    { word: 'barna,',     img: 'skole-latter.jpg',   alt: 'Tre barn som ler utendørs',                                 cap: 'Barnehage. Utelek en gråværsdag.' },
    { word: 'bedriften,', img: 'bedrift-bygg.jpg',   alt: 'Kontorbygg ved sjøen i skumring',                           cap: 'Bedrift. Hovedkontor ved sjøen.' }
  ];
  slides.forEach(function (s) { new Image().src = P + s.img + V; });

  var hero = document.querySelector('.hero');
  var heroPhoto = document.getElementById('heroPhoto');
  var swap = document.getElementById('swap');
  var heroCap = document.getElementById('heroCap');
  var ticks = Array.prototype.slice.call(document.querySelectorAll('#ticks button'));
  var pauseBtn = document.getElementById('pause');
  var cur = 0, timer = null, paused = reduce;
  hero.style.setProperty('--dur', DUR + 'ms');

  function setTicks(n) {
    ticks.forEach(function (t, k) {
      t.removeAttribute('aria-current');
      t.classList.toggle('done', k < n);
    });
    var t = ticks[n];
    void t.offsetWidth; // start fremdriftslinjen på nytt
    t.setAttribute('aria-current', 'true');
  }
  function show(n) {
    cur = n;
    var s = slides[n];
    swap.classList.add('out');
    setTimeout(function () { swap.textContent = s.word; swap.classList.remove('out'); }, 400);
    swapInto(heroPhoto, photo(s.img, s.alt, 'develop'));
    heroCap.textContent = s.cap;
    setTicks(n);
  }
  function start() { stop(); timer = setInterval(function () { show((cur + 1) % slides.length); }, DUR); }
  function stop() { if (timer) clearInterval(timer); timer = null; }
  function setPaused(p) {
    paused = p;
    hero.classList.toggle('paused', p);
    pauseBtn.setAttribute('aria-pressed', String(p));
    pauseBtn.textContent = p ? 'Spill av' : 'Pause';
    if (p) stop(); else start();
  }
  ticks.forEach(function (t, k) {
    t.addEventListener('click', function () { show(k); if (!paused) start(); });
  });
  pauseBtn.addEventListener('click', function () { setPaused(!paused); });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else if (!paused) start();
  });
  setPaused(paused);

  /* ---------- Kapitler med bildeviser ---------- */
  var fields = [
    [ ['bolig-stue.jpg', 'Stue med fjordutsikt i blå time'], ['bolig-kjokken.jpg', 'Kjøkken i eik med utsikt'], ['bolig-loft.jpg', 'Loftsstue med takvinduer'], ['bolig-tomannsbolig.jpg', 'Tomannsbolig i skumring'], ['bolig-hytte.jpg', 'Hytte på et nes, fra drone'] ],
    [ ['bedrift-portrett.jpg', 'Portrett av daglig leder'], ['bedrift-kontor.jpg', 'Hverdag i kontorlandskapet'], ['bedrift-bygg.jpg', 'Hovedkontor ved sjøen'] ],
    [ ['skole-lek.jpg', 'Barnehagebarn på tur i skogen'], ['skole-latter.jpg', 'Tre barn som ler utendørs'], ['skole-klasse.jpg', 'Klassebilde i skolegården'] ],
    [ ['maritim-sveiser.jpg', 'Sveiser i arbeid på verkstedet'], ['maritim-skip.jpg', 'Offshorefartøy i fjorden'], ['maritim-fiskebat.jpg', 'Fiskebåt ved kai'] ]
  ];
  var viewer = document.querySelector('.viewer');
  var main = document.getElementById('viewerMain');
  var thumbs = document.getElementById('viewerThumbs');
  var vcap = document.getElementById('viewerCap');
  var body = document.querySelector('.ch-body');
  var btns = Array.prototype.slice.call(document.querySelectorAll('.ch-btn'));
  var narrow = window.matchMedia('(max-width: 960px)');
  var field = 0;

  function showPhoto(f, k, animate) {
    var item = fields[f][k];
    var img = photo(item[0], item[1], animate ? 'develop' : '');
    if (item[0] === 'bedrift-portrett.jpg') img.style.objectPosition = '50% 25%';
    swapInto(main, img);
    vcap.textContent = item[1] + '.';
    Array.prototype.forEach.call(thumbs.children, function (b, j) { b.setAttribute('aria-pressed', String(j === k)); });
  }
  function openField(f, animate) {
    field = f;
    btns.forEach(function (b, j) {
      var open = j === f;
      b.setAttribute('aria-expanded', String(open));
      document.getElementById(b.getAttribute('aria-controls')).hidden = !open;
      b.closest('.ch-item').classList.toggle('is-open', open);
    });
    thumbs.innerHTML = '';
    fields[f].forEach(function (item, k) {
      var t = document.createElement('button');
      t.type = 'button';
      t.setAttribute('aria-label', 'Vis bilde: ' + item[1]);
      var ti = new Image(); ti.src = P + item[0] + V; ti.alt = ''; ti.loading = 'lazy';
      t.appendChild(ti);
      t.addEventListener('click', function () { showPhoto(f, k, true); });
      thumbs.appendChild(t);
    });
    showPhoto(f, 0, animate);
    placeViewer();
  }
  // På mobil flyttes bildeviseren inn i kapitlet som er åpent.
  function placeViewer() {
    var target = narrow.matches ? document.getElementById(btns[field].getAttribute('aria-controls')) : body;
    if (viewer.parentNode !== target) {
      if (narrow.matches) target.insertBefore(viewer, target.firstChild); else target.appendChild(viewer);
    }
  }
  btns.forEach(function (b, j) { b.addEventListener('click', function () { if (j !== field) openField(j, true); }); });
  if (narrow.addEventListener) narrow.addEventListener('change', placeViewer);
  openField(0, false);

  /* ---------- Manifest: linjene lyses opp mens man leser ---------- */
  var lines = Array.prototype.slice.call(document.querySelectorAll('.credo-line'));
  if (!reduce && lines.length) {
    var ticking = false;
    var light = function () {
      ticking = false;
      var vh = window.innerHeight;
      lines.forEach(function (l) {
        var r = l.getBoundingClientRect();
        var mid = r.top + r.height / 2;
        // Fullt lys når linjen er i nedre del av midten av skjermen, svakt ellers.
        var d = Math.abs(mid - vh * 0.55) / (vh * 0.45);
        var lit = Math.max(0.16, Math.min(1, 1.15 - d));
        l.style.setProperty('--lit', lit.toFixed(3));
      });
    };
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(light); } }, { passive: true });
    window.addEventListener('resize', light);
    light();
  }
})();
