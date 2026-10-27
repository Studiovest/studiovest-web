// Studiovest — bevegelse. GSAP + ScrollTrigger for scroll-animasjoner, Lenis for myk scrolling.
(function () {
  var V = '?v=__V__';
  var P = 'assets/photos/';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var G = window.gsap, ST = window.ScrollTrigger;
  var motion = !reduce && !!G && !!ST;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var body = document.body;
  if (motion) G.registerPlugin(ST);

  /* ---------- Myk scrolling ---------- */
  var lenis = null;
  if (motion && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true });
    lenis.on('scroll', ST.update);
    G.ticker.add(function (t) { lenis.raf(t * 1000); });
    G.ticker.lagSmoothing(0);
  }
  function scrollToTarget(target) {
    if (lenis) lenis.scrollTo(target, { duration: 1.4 });
    else if (target === 0) window.scrollTo(0, 0);
    else target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href');
    var target = id === '#' ? 0 : document.querySelector(id);
    if (target === null) return;
    e.preventDefault();
    var wasOpen = menuOpen;
    closeMenu();
    setTimeout(function () { scrollToTarget(target); }, wasOpen ? 650 : 0);
  });

  /* ---------- Fargetema som glir mellom seksjonene ---------- */
  var THEMES = {
    light: { bg: '#F2EEE8', fg: '#161412', acc: '#8B5A3A', line: 'rgba(22,20,18,0.10)' },
    dark:  { bg: '#161412', fg: '#F2EEE8', acc: '#D9A866', line: 'rgba(242,238,232,0.07)' },
    stone: { bg: '#C9C1B6', fg: '#161412', acc: '#5E3B24', line: 'rgba(22,20,18,0.12)' }
  };
  var currentTheme = 'dark';
  function setTheme(name) {
    if (name === currentTheme) return;
    currentTheme = name;
    var t = THEMES[name];
    if (!motion) {
      body.style.setProperty('--bg', t.bg); body.style.setProperty('--fg', t.fg);
      body.style.setProperty('--acct', t.acc); body.style.setProperty('--line', t.line);
      return;
    }
    G.to(body, { '--bg': t.bg, '--fg': t.fg, '--acct': t.acc, '--line': t.line, duration: 0.9, ease: 'power2.out', overwrite: true });
  }
  var themed = $$('[data-theme]');
  if (motion) {
    themed.forEach(function (s) {
      ST.create({
        trigger: s, start: 'top 55%', end: 'bottom 55%',
        onEnter: function () { setTheme(s.dataset.theme); },
        onEnterBack: function () { setTheme(s.dataset.theme); }
      });
    });
  } else if ('IntersectionObserver' in window) {
    var tio = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) setTheme(e.target.dataset.theme); });
    }, { rootMargin: '-45% 0px -45% 0px' });
    themed.forEach(function (s) { tio.observe(s); });
  }

  /* ---------- Meny ---------- */
  var menu = $('#menu'), menuBtn = $('#menuBtn'), menuOpen = false, menuTl = null;
  var tiles = $$('.menu-tile'), links = $$('.menu-link');
  function buildMenuTl() {
    menuTl = G.timeline({ paused: true, defaults: { ease: 'expo.out' } })
      .fromTo(menu, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.9, ease: 'expo.inOut' })
      .fromTo(tiles, { yPercent: 40, opacity: 0, rotate: function (i) { return i % 2 ? 4 : -4; } },
        { yPercent: 0, opacity: 1, rotate: 0, duration: 1.1, stagger: 0.07 }, 0.35)
      .fromTo($$('.ml-text', menu), { yPercent: 115 }, { yPercent: 0, duration: 1, stagger: 0.06 }, 0.42)
      .fromTo([$('.menu-badge'), $('.menu-foot')], { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, stagger: 0.08 }, 0.7);
  }
  function openMenu() {
    if (menuOpen) return;
    menuOpen = true;
    menu.hidden = false;
    body.classList.add('menu-open');
    menuBtn.classList.add('open');
    menuBtn.setAttribute('aria-expanded', 'true');
    if (lenis) lenis.stop();
    if (motion) { if (!menuTl) buildMenuTl(); menuTl.timeScale(1).play(0); }
    setTimeout(function () { links[0].focus({ preventScroll: true }); }, motion ? 500 : 0);
  }
  function closeMenu() {
    if (!menuOpen) return;
    menuOpen = false;
    menuBtn.classList.remove('open');
    menuBtn.setAttribute('aria-expanded', 'false');
    if (lenis) lenis.start();
    body.classList.remove('menu-open');
    var done = function () { menu.hidden = true; tiles.forEach(function (t) { t.classList.remove('lit'); }); };
    if (motion && menuTl) { menuTl.timeScale(1.6).reverse(); menuTl.eventCallback('onReverseComplete', done); }
    else done();
    menuBtn.focus({ preventScroll: true });
  }
  menuBtn.addEventListener('click', function () { if (menuOpen) closeMenu(); else openMenu(); });
  document.addEventListener('keydown', function (e) {
    if (!menuOpen) return;
    if (e.key === 'Escape') closeMenu();
    if (e.key === 'Tab') { // hold fokus inne i menyen
      var f = [menuBtn].concat($$('a', menu));
      var i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  });
  function lightTile(key) { tiles.forEach(function (t) { t.classList.toggle('lit', t.dataset.key === key); }); }
  links.forEach(function (l) {
    l.addEventListener('mouseenter', function () { lightTile(l.dataset.key); });
    l.addEventListener('focus', function () { lightTile(l.dataset.key); });
  });
  $('.menu-nav').addEventListener('mouseleave', function () { lightTile(null); });
  if (motion) {
    menu.addEventListener('mousemove', function (e) {
      var nx = e.clientX / window.innerWidth - 0.5, ny = e.clientY / window.innerHeight - 0.5;
      tiles.forEach(function (t, i) {
        var depth = [18, 30, 26, 14][i];
        G.to(t, { x: nx * depth, y: ny * depth, duration: 1.2, ease: 'power3.out', overwrite: 'auto' });
      });
    });
  }

  /* ---------- Hero: tonet bakgrunn, plantegning rundt musen, bildebytte ---------- */
  var intro = $('#intro'), introBg = $('#introBg'), ibDark = $('#ibDark'), heroCenter = $('#heroCenter');
  var swap = $('#swap'), pauseBtn = $('#heroPause');
  var heroVisible = true, pointerActive = false;
  var M = { x: 0.5, y: 0.45 }, MT = { x: 0.5, y: 0.45 };
  var slides = [
    { img: 'bolig-stue.jpg',     word: 'hjemmet,' },
    { img: 'bedrift-kontor.jpg', word: 'folka,' },
    { img: 'skole-latter.jpg',   word: 'barna,' },
    { img: 'bedrift-bygg.jpg',   word: 'bedriften,' }
  ];
  intro.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse') return;
    MT.x = e.clientX / window.innerWidth; MT.y = e.clientY / window.innerHeight; pointerActive = true;
  });
  intro.addEventListener('pointerleave', function () { pointerActive = false; });
  function planTick() {
    if (!heroVisible) return;
    if (!pointerActive) { // uten mus: lyset vandrer rolig over plantegningen
      var t = performance.now() / 1000;
      MT.x = 0.5 + 0.3 * Math.sin(t * 0.32); MT.y = 0.46 + 0.22 * Math.sin(t * 0.47 + 1);
    }
    M.x += (MT.x - M.x) * 0.07; M.y += (MT.y - M.y) * 0.07;
    introBg.style.setProperty('--mx', (M.x * 100).toFixed(2) + '%');
    introBg.style.setProperty('--my', (M.y * 100).toFixed(2) + '%');
  }
  if (motion) {
    G.ticker.add(planTick);
    new IntersectionObserver(function (es) { heroVisible = es[0].isIntersecting; }).observe(introBg);
  }

  var cur = 0, heroTimer = null, heroPaused = reduce;
  function nextSlide() {
    cur = (cur + 1) % slides.length;
    var s = slides[cur];
    if (!motion) { swap.textContent = s.word; return; }
    G.to(swap, { yPercent: -115, duration: 0.45, ease: 'power3.in', onComplete: function () {
      swap.textContent = s.word;
      G.fromTo(swap, { yPercent: 115 }, { yPercent: 0, duration: 0.75, ease: 'power3.out' });
    } });
  }
  function startHero() { stopHero(); if (!heroPaused) heroTimer = setInterval(function () { if (heroVisible && !document.hidden) nextSlide(); }, 4600); }
  function stopHero() { if (heroTimer) clearInterval(heroTimer); heroTimer = null; }
  pauseBtn.addEventListener('click', function () {
    heroPaused = !heroPaused;
    pauseBtn.setAttribute('aria-pressed', String(heroPaused));
    pauseBtn.textContent = heroPaused ? 'Spill av' : 'Pause';
    if (heroPaused) stopHero(); else startHero();
  });
  if (reduce) { pauseBtn.setAttribute('aria-pressed', 'true'); pauseBtn.textContent = 'Spill av'; }

  function heroIntro() {
    startHero();
    if (!motion) return;
    G.timeline({ defaults: { ease: 'expo.out', duration: 1.4 } })
      .from(['.ib-color', '.ib-glow'], { opacity: 0, duration: 2.2, ease: 'power2.out' }, 0)
      .from('.hero-ap', { y: -30, rotate: -120, opacity: 0 }, 0.3)
      .from('.hero-script', { clipPath: 'inset(0% 100% 0% 0%)', duration: 1.6, ease: 'power2.inOut' }, 0.45)
      .from('.hl-in', { yPercent: 115, stagger: 0.14, duration: 1.5 }, 0.55)
      .from(['.hero-lead', '.hero-cta'], { y: 30, opacity: 0, stagger: 0.1 }, 0.95)
      .from('.hero-card', { x: -60, opacity: 0 }, 1.05)
      .from('.hero-pause', { x: 60, opacity: 0 }, 1.1)
      .from('.top > *', { y: -40, opacity: 0, stagger: 0.08, duration: 1 }, 0.4);
    // Når kortene kommer: bakgrunnen mørkner, hero-teksten trekker seg tilbake
    var st1 = { trigger: '.cards', start: 'top bottom', end: 'top 15%', scrub: true };
    G.to(ibDark, { opacity: 0.8, ease: 'none', scrollTrigger: st1 });
    G.to(heroCenter, { opacity: 0, scale: 0.93, y: -90, ease: 'none', scrollTrigger: { trigger: '.cards', start: 'top bottom', end: 'top 35%', scrub: true } });
    G.to(['.hero-card', '.hero-pause'], { opacity: 0, ease: 'none', scrollTrigger: { trigger: '.cards', start: 'top bottom', end: 'top 60%', scrub: true } });
  }

  /* ---------- Fire felt: kortene stiger opp i ulik fart ---------- */
  if (motion) {
    $$('.cardx').forEach(function (c, i) {
      var sp = parseFloat(c.dataset.speed);
      G.fromTo(c, { y: function () { return window.innerHeight * 0.5 * sp; }, rotate: i % 2 ? 3 : -3 },
        { y: function () { return -window.innerHeight * 0.18 * sp; }, rotate: 0, ease: 'none',
          scrollTrigger: { trigger: '.cards', start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true } });
    });
  }

  /* ---------- «Book en prat»: fargen fylles fra der musen kommer inn ---------- */
  $$('.pill').forEach(function (b) {
    b.addEventListener('mouseenter', function (e) {
      var r = b.getBoundingClientRect();
      b.style.setProperty('--fx', (e.clientX - r.left) + 'px');
      b.style.setProperty('--fy', (e.clientY - r.top) + 'px');
    });
    b.addEventListener('mouseleave', function (e) {
      var r = b.getBoundingClientRect();
      b.style.setProperty('--fx', (e.clientX - r.left) + 'px');
      b.style.setProperty('--fy', (e.clientY - r.top) + 'px');
    });
  });

  /* ---------- Laster ---------- */
  var loader = $('#loader');
  if (!motion) {
    if (loader) loader.remove();
    heroIntro();
  } else {
    var cnt = { v: 0 }, countEl = $('#loaderCount');
    var loaded = new Promise(function (res) {
      if (document.readyState === 'complete') res();
      else window.addEventListener('load', res);
      setTimeout(res, 3500);
    });
    var fonts = document.fonts ? document.fonts.ready : Promise.resolve();
    G.set('.loader-mark span', { yPercent: 110 });
    G.to('.loader-mark span', { yPercent: 0, stagger: 0.1, duration: 0.9, ease: 'expo.out', delay: 0.1 });
    var counting = G.to(cnt, { v: 90, duration: 1.4, ease: 'power2.out', onUpdate: function () { countEl.textContent = Math.round(cnt.v); } });
    Promise.all([loaded, fonts]).then(function () {
      counting.kill();
      G.timeline()
        .to(cnt, { v: 100, duration: 0.35, ease: 'power1.out', onUpdate: function () { countEl.textContent = Math.round(cnt.v); } })
        .to(['.loader-mark span', countEl], { yPercent: -110, opacity: 0, stagger: 0.06, duration: 0.55, ease: 'power3.in' })
        .to(loader, { clipPath: 'inset(0% 0% 100% 0%)', duration: 1, ease: 'expo.inOut' }, '-=0.15')
        .add(function () { heroIntro(); }, '-=0.6')
        .add(function () { loader.remove(); ST.refresh(); });
    });
  }

  if (!motion) {
    // Uten animasjon: vis alt som er satt opp for å tegnes inn
    $$('.mq-scribble path, .split-scribble path').forEach(function (p) { p.style.strokeDashoffset = 0; });
  }

  /* ---------- Titler: fet linje fra venstre, serif fra høyre ---------- */
  if (motion) {
    $$('h2').forEach(function (h) {
      var parts = $$(':scope > span', h);
      if (!parts.length) parts = $$(':scope > a > span', h);
      parts.forEach(function (p, i) {
        G.from(p, { xPercent: i % 2 ? 22 : -22, opacity: 0, duration: 1.3, ease: 'expo.out',
          scrollTrigger: { trigger: h, start: 'top 85%' } });
      });
    });
  }

  /* ---------- Gigantiske linjer ---------- */
  if (motion) {
    var mqTweens = $$('.mq-row').map(function (row) {
      var track = $('.mq-track', row);
      var dir = parseFloat(row.dataset.dir);
      var tw = dir < 0
        ? G.fromTo(track, { xPercent: 0 }, { xPercent: -50, duration: 26, ease: 'none', repeat: -1 })
        : G.fromTo(track, { xPercent: -50 }, { xPercent: 0, duration: 26, ease: 'none', repeat: -1 });
      tw.totalTime(tw.duration() * 500); // så den kan spilles baklengs uten å stoppe
      return tw;
    });
    var mqDir = 1;
    ST.create({
      trigger: '.marquee', start: 'top bottom', end: 'bottom top',
      onUpdate: function (self) {
        mqDir = self.direction;
        var boost = Math.min(Math.abs(self.getVelocity()) / 250, 5);
        mqTweens.forEach(function (t) {
          G.timeline({ overwrite: true })
            .to(t, { timeScale: mqDir * (1 + boost), duration: 0.2 })
            .to(t, { timeScale: mqDir, duration: 1.2, ease: 'power2.out' });
        });
      }
    });
    G.fromTo('.mq-photo', { y: 120, rotate: -5 }, { y: -120, rotate: 4, ease: 'none', scrollTrigger: { trigger: '.marquee', start: 'top bottom', end: 'bottom top', scrub: true } });
    G.fromTo('.mq-scribble path', { strokeDashoffset: 1.05 }, { strokeDashoffset: 0, ease: 'none', scrollTrigger: { trigger: '.marquee', start: 'top 65%', end: 'center 40%', scrub: 1 } });
  }

  /* ---------- Manifest: ord for ord ---------- */
  var st = $('#stText');
  if (st) {
    var label = st.textContent.replace(/\s+/g, ' ').trim();
    var frag = document.createDocumentFragment();
    Array.prototype.slice.call(st.childNodes).forEach(function (n) {
      var isEm = n.nodeType === 1;
      n.textContent.split(/(\s+)/).forEach(function (w) {
        if (!w) return;
        if (/^\s+$/.test(w)) { frag.appendChild(document.createTextNode(' ')); return; }
        var s = document.createElement('span');
        s.className = 'st-w' + (isEm ? ' is-em' : '');
        s.textContent = w;
        frag.appendChild(s);
      });
    });
    st.textContent = '';
    st.appendChild(frag);
    st.setAttribute('aria-label', label);
    $$('.st-w', st).forEach(function (w) { w.setAttribute('aria-hidden', 'true'); });
    if (motion) {
      G.fromTo($$('.st-w', st), { opacity: 0.12, y: 18 }, { opacity: 1, y: 0, stagger: 0.12, ease: 'none',
        scrollTrigger: { trigger: st, start: 'top 80%', end: 'bottom 50%', scrub: 0.6 } });
    }
  }

  /* ---------- Kollasj, Timebank-bilder: parallakse ---------- */
  if (motion) {
    var mm = G.matchMedia();
    mm.add('(min-width: 901px)', function () {
      $$('.collage [data-speed]').forEach(function (el) {
        var s = parseFloat(el.dataset.speed);
        var travel = (1 - s) * window.innerHeight * 0.9;
        G.fromTo(el, { y: -travel }, { y: travel, ease: 'none', scrollTrigger: { trigger: '.collage', start: 'top bottom', end: 'bottom top', scrub: true } });
      });
      $$('.bank [data-speed]').forEach(function (el) {
        var s = parseFloat(el.dataset.speed);
        var travel = (1 - s) * window.innerHeight * 0.7;
        G.fromTo(el, { y: -travel }, { y: travel, ease: 'none', scrollTrigger: { trigger: '.bank', start: 'top bottom', end: 'bottom top', scrub: true } });
      });
      // Foto / Film: bildene glir inn fra skjermkantene
      G.fromTo('.split-img-l', { xPercent: -110, rotate: -8 }, { xPercent: 0, rotate: -2, ease: 'none', scrollTrigger: { trigger: '.split', start: 'top bottom', end: 'center center', scrub: 1 } });
      G.fromTo('.split-img-r', { xPercent: 110, rotate: 8 }, { xPercent: 0, rotate: 2, ease: 'none', scrollTrigger: { trigger: '.split', start: 'top bottom', end: 'center center', scrub: 1 } });
    });
    // Bilder i kollasjen avdekkes nedenfra når de kommer inn
    $$('.collage figure img').forEach(function (img) {
      G.fromTo(img, { clipPath: 'inset(100% 0% 0% 0%)', scale: 1.12 }, { clipPath: 'inset(0% 0% 0% 0%)', scale: 1, duration: 1.4, ease: 'expo.out',
        scrollTrigger: { trigger: img.parentNode, start: 'top 92%' } });
    });
    $$('.collage blockquote').forEach(function (q) {
      G.from(q, { y: 60, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: q, start: 'top 90%' } });
    });
    // Foto / Film: kolonnene fra hver sin side, strekene tegnes
    $$('.split-col').forEach(function (c) {
      var dx = c.dataset.side === 'l' ? -90 : 90;
      G.from(c, { x: dx, opacity: 0, duration: 1.3, ease: 'expo.out', scrollTrigger: { trigger: '.split', start: 'top 60%' } });
      G.fromTo($('.split-scribble path', c), { strokeDashoffset: 1.05 }, { strokeDashoffset: 0, duration: 1.1, ease: 'power2.inOut', delay: 0.5,
        scrollTrigger: { trigger: '.split', start: 'top 55%' } });
    });
    // Fire kapitler: kortene stiger opp
    G.from('.field', { y: 140, opacity: 0, duration: 1.3, ease: 'expo.out', stagger: 0.12, scrollTrigger: { trigger: '.fields-grid', start: 'top 85%' } });
    G.from('.fields-cta > *', { y: 40, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.1, scrollTrigger: { trigger: '.fields-cta', start: 'top 90%' } });
    // Timebank: pakkene fra høyre, bildene skaleres inn
    G.from('.packs li', { x: 80, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.1, scrollTrigger: { trigger: '.packs', start: 'top 85%' } });
    G.from('.bf img', { scale: 1.3, duration: 1.6, ease: 'expo.out', stagger: 0.15, scrollTrigger: { trigger: '.bank-floats', start: 'top 80%' } });
    // Bunn: kortet løftes opp
    G.from('.foot-card', { y: 160, scale: 0.94, ease: 'none', scrollTrigger: { trigger: '.foot', start: 'top bottom', end: 'top 25%', scrub: 1 } });
    G.from('.foot-photo', { yPercent: 25, rotate: -4, ease: 'none', scrollTrigger: { trigger: '.foot', start: 'top bottom', end: 'center center', scrub: 1 } });
    G.from('.foot-col', { y: 40, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.12, scrollTrigger: { trigger: '.foot-cols', start: 'top 85%' } });
  }

  /* ---------- Fire kapitler: bildene bytter mens du holder over ---------- */
  $$('.field').forEach(function (f) {
    var list = f.dataset.photos.split(','), img = $('.field-img img', f), k = 0, iv = null;
    list.forEach(function (n) { new Image().src = P + n + '.jpg' + V; });
    function show(n) {
      img.style.opacity = 0;
      setTimeout(function () {
        img.src = P + list[n] + '.jpg' + V;
        img.classList.toggle('face', list[n] === 'bedrift-portrett');
        img.style.opacity = 1;
      }, 180);
    }
    function start() { if (reduce || iv) return; iv = setInterval(function () { k = (k + 1) % list.length; show(k); }, 900); }
    function stop() { clearInterval(iv); iv = null; if (k !== 0) { k = 0; show(0); } }
    f.addEventListener('mouseenter', start); f.addEventListener('mouseleave', stop);
    f.addEventListener('focus', start); f.addEventListener('blur', stop);
  });

  /* ---------- Vifte med kort ---------- */
  var fanPhotos = ['bolig-stue', 'skole-latter', 'bedrift-portrett', 'maritim-skip', 'bolig-kjokken', 'skole-lek', 'maritim-sveiser', 'bolig-hytte', 'bedrift-kontor', 'bolig-tomannsbolig', 'maritim-fiskebat'];
  var fanCards = $('#fanCards'), fanStage = $('#fanStage');
  var cards = fanPhotos.map(function (n) {
    var li = document.createElement('li');
    li.className = 'fan-card';
    li.setAttribute('aria-hidden', 'true');
    var im = new Image(); im.src = P + n + '.jpg' + V; im.alt = ''; im.loading = 'lazy'; im.draggable = false;
    if (n === 'bedrift-portrett') im.style.objectPosition = '50% 22%';
    li.appendChild(im);
    fanCards.appendChild(li);
    return li;
  });
  var N = cards.length, fan = { offset: 0, spread: motion ? 0 : 1, vel: motion ? 0.004 : 0 }, fanVisible = false, dragging = false;
  function fanLayout() {
    var step = 10 * fan.spread;
    cards.forEach(function (c, i) {
      var rel = ((i - fan.offset) % N + N) % N;
      if (rel > N / 2) rel -= N;
      var a = rel * step;
      var sc = 1 + Math.max(0, 1 - Math.abs(rel)) * 0.12;
      c.style.transform = 'rotate(' + a.toFixed(2) + 'deg) scale(' + sc.toFixed(3) + ')';
      c.style.zIndex = String(100 - Math.round(Math.abs(rel) * 4));
      c.style.opacity = Math.abs(rel) > N / 2 - 1 ? Math.max(0, N / 2 - Math.abs(rel)) : 1;
    });
  }
  fanLayout();
  if (motion) {
    G.ticker.add(function () {
      if (!fanVisible) return;
      if (!dragging) fan.offset += fan.vel;
      fanLayout();
    });
    ST.create({ trigger: fanStage, start: 'top bottom', end: 'bottom top',
      onToggle: function (self) { fanVisible = self.isActive; } });
    ST.create({ trigger: fanStage, start: 'top 75%', once: true,
      onEnter: function () { G.to(fan, { spread: 1, duration: 1.8, ease: 'expo.out' }); } });
    var lastX = 0;
    fanStage.addEventListener('pointerdown', function (e) { dragging = true; lastX = e.clientX; fanStage.classList.add('dragging'); fanStage.setPointerCapture(e.pointerId); });
    fanStage.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      fan.offset -= (e.clientX - lastX) / 180;
      lastX = e.clientX;
    });
    var endDrag = function () { dragging = false; fanStage.classList.remove('dragging'); };
    fanStage.addEventListener('pointerup', endDrag);
    fanStage.addEventListener('pointercancel', endDrag);
  }

  window.addEventListener('load', function () { if (motion) ST.refresh(); });
})();
