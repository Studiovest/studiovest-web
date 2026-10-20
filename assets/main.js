// Studiovest forside — konsept «Kontaktarket».
(function () {
  var V = '?v=__V__';
  var P = 'assets/photos/';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Hero: ord og bilde bytter i takt ---------- */
  var slides = [
    { word: 'hjemmet,',   img: 'bolig-stue.jpg',     alt: 'Stue med peis og store vinduer mot fjorden i kveldslys', cap: 'Boligfoto. Stue med fjordutsikt i blå time.' },
    { word: 'folka,',     img: 'bedrift-kontor.jpg', alt: 'Ansatt ved skrivebord i et lyst kontorlandskap',          cap: 'Bedrift. Hverdag i kontorlandskapet.' },
    { word: 'barna,',     img: 'skole-latter.jpg',   alt: 'Tre barn som ler utendørs',                                 cap: 'Barnehage. Utelek en gråværsdag.' },
    { word: 'bedriften,', img: 'bedrift-bygg.jpg',   alt: 'Kontorbygg ved sjøen i skumring',                           cap: 'Bedrift. Hovedkontor ved sjøen.' }
  ];
  slides.forEach(function (s) { var i = new Image(); i.src = P + s.img + V; });

  var swap = document.getElementById('swap');
  var plate = document.getElementById('plate');
  var cap = document.getElementById('plateCap');
  var count = document.getElementById('plateCount');
  var pauseBtn = document.getElementById('pause');
  var i = 0, timer = null, paused = reduce;

  function show(n) {
    var s = slides[n];
    swap.classList.add('out');
    setTimeout(function () { swap.textContent = s.word; swap.classList.remove('out'); }, 350);

    var img = new Image();
    img.src = P + s.img + V;
    img.alt = s.alt;
    img.width = 1168; img.height = 784;
    img.className = reduce ? '' : 'incoming';
    plate.appendChild(img);
    var done = function () {
      while (plate.children.length > 1) plate.removeChild(plate.firstChild);
      img.className = '';
    };
    if (reduce) done(); else img.addEventListener('animationend', done, { once: true });

    cap.textContent = s.cap;
    count.textContent = (n + 1) + ' av ' + slides.length;
  }
  function start() { stop(); timer = setInterval(function () { i = (i + 1) % slides.length; show(i); }, 4200); }
  function stop() { if (timer) clearInterval(timer); timer = null; }

  pauseBtn.addEventListener('click', function () {
    paused = !paused;
    pauseBtn.setAttribute('aria-pressed', String(paused));
    pauseBtn.textContent = paused ? 'Spill av' : 'Pause';
    if (paused) stop(); else start();
  });
  if (paused) { pauseBtn.setAttribute('aria-pressed', 'true'); pauseBtn.textContent = 'Spill av'; }
  else start();
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else if (!paused) start();
  });

  /* ---------- Kontaktark: fettstift-sirkel rundt valgt bilde ---------- */
  // Tre litt ulike håndtegnede sløyfer, så ingen to sirkler blir like.
  var loops = [
    'M 9 16 C 30 4, 72 3, 93 9 C 99 34, 98 70, 92 92 C 66 98, 30 98, 8 91 C 2 66, 1 36, 7 13 L 19 7',
    'M 12 8 C 40 2, 75 4, 94 12 C 99 40, 97 72, 90 94 C 62 99, 28 97, 6 88 C 1 60, 3 30, 10 10 L 24 6',
    'M 6 12 C 35 3, 70 2, 95 10 C 98 38, 99 68, 93 90 C 68 99, 32 99, 9 93 C 3 64, 2 34, 5 9 L 16 5'
  ];
  var n = 0;
  var strips = document.querySelectorAll('.strip');
  strips.forEach(function (strip) {
    var frames = strip.querySelectorAll('.frame');
    frames.forEach(function (f) {
      n++;
      f.setAttribute('data-n', (7 + Math.ceil(n / 2)) + (n % 2 ? '' : 'A'));
      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'mark');
      svg.setAttribute('viewBox', '0 0 100 100');
      svg.setAttribute('preserveAspectRatio', 'none');
      svg.setAttribute('aria-hidden', 'true');
      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', loops[n % loops.length]);
      path.setAttribute('pathLength', '1');
      svg.appendChild(path);
      f.appendChild(svg);

      f.addEventListener('click', function () {
        frames.forEach(function (o) { o.setAttribute('aria-pressed', 'false'); o.classList.remove('drawn'); });
        f.setAttribute('aria-pressed', 'true');
        void f.offsetWidth; // start tegningen på nytt
        f.classList.add('drawn');
      });
    });
  });

  // Sirklene tegnes første gang stripen kommer til syne.
  function drawIn(strip) {
    var sel = strip.querySelector('.frame[aria-pressed="true"]');
    if (sel) sel.classList.add('drawn');
  }
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { drawIn(e.target); io.unobserve(e.target); }
      });
    }, { threshold: 0.5 });
    strips.forEach(function (s) { io.observe(s); });
  } else {
    strips.forEach(drawIn);
  }
})();
