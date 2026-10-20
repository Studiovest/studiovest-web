// Studiovest forside — konsept «Fremkalling», levende versjon.
(function () {
  var V = '?v=__V__';
  var P = 'assets/photos/';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var DUR = 5200;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var restart = function (el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };

  function photo(file, alt, cls) {
    var img = new Image();
    img.src = P + file + V;
    img.alt = alt || '';
    img.width = 1168; img.height = 784;
    if (cls && !reduce) img.className = cls;
    return img;
  }
  // Nytt bilde glir inn over det gamle; det gamle skyves ut og fjernes.
  function slideInto(box, img, dir) {
    var old = Array.prototype.slice.call(box.children);
    if (!reduce) old.forEach(function (o) { o.className = dir < 0 ? 'push-r' : 'push-l'; });
    box.appendChild(img);
    setTimeout(function () { old.forEach(function (o) { if (o.parentNode === box) box.removeChild(o); }); }, reduce ? 0 : 1200);
  }

  /* ---------- Del opp titler i ord eller bokstaver ---------- */
  $$('[data-split]').forEach(function (el) {
    var chars = el.getAttribute('data-split') === 'chars';
    // « / » i teksten betyr linjeskift.
    var words = el.textContent.trim().split(/[ \t\n]+/);
    var i = 0;
    el.setAttribute('aria-label', el.textContent.replace(/\s\/\s/g, ' ').trim());
    el.textContent = '';
    words.forEach(function (word, k) {
      if (word === '/') { el.appendChild(document.createElement('br')); return; }
      var holder = document.createElement('span');
      holder.setAttribute('aria-hidden', 'true');
      if (chars) {
        holder.style.whiteSpace = 'nowrap';
        holder.style.display = 'inline-block';
        word.split('').forEach(function (c) {
          var w = document.createElement('span'); w.className = 'w';
          var wi = document.createElement('span'); wi.className = 'wi'; wi.textContent = c; wi.style.setProperty('--i', i++);
          w.appendChild(wi); holder.appendChild(w);
        });
      } else {
        holder.className = 'w';
        var wi = document.createElement('span'); wi.className = 'wi'; wi.textContent = word; wi.style.setProperty('--i', i++);
        holder.appendChild(wi);
      }
      el.appendChild(holder);
      if (k < words.length - 1) el.appendChild(document.createTextNode(' '));
    });
  });

  /* ---------- Scroll-innganger ---------- */
  $$('[data-stagger]').forEach(function (g) {
    Array.prototype.forEach.call(g.children, function (c, i) { c.style.setProperty('--i', i); });
  });
  var revealEls = $$('[data-reveal],[data-stagger],[data-split]');
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  }

  /* ---------- Hero-slider ---------- */
  var slides = [
    { word: 'hjemmet,',   img: 'bolig-stue.jpg',     alt: 'Stue med peis og store vinduer mot fjorden i kveldslys', cap: 'Boligfoto. Stue med fjordutsikt i blå time.' },
    { word: 'folka,',     img: 'bedrift-kontor.jpg', alt: 'Ansatt ved skrivebord i et lyst kontorlandskap',          cap: 'Bedrift. Hverdag i kontorlandskapet.' },
    { word: 'barna,',     img: 'skole-latter.jpg',   alt: 'Tre barn som ler utendørs',                                 cap: 'Barnehage. Utelek en gråværsdag.' },
    { word: 'bedriften,', img: 'bedrift-bygg.jpg',   alt: 'Kontorbygg ved sjøen i skumring',                           cap: 'Bedrift. Hovedkontor ved sjøen.' }
  ];
  slides.forEach(function (s) { new Image().src = P + s.img + V; });

  var hero = $('#hero');
  var heroPhoto = $('#heroPhoto');
  var heroText = $('#heroText');
  var swap = $('#swap');
  var heroCap = $('#heroCap');
  var ticks = $$('#ticks button');
  var pauseBtn = $('#pause');
  var cur = 0, timer = null, paused = reduce;
  hero.style.setProperty('--dur', DUR + 'ms');

  function setTicks(n) {
    ticks.forEach(function (t, k) { t.removeAttribute('aria-current'); t.classList.toggle('done', k < n); });
    void ticks[n].offsetWidth;
    ticks[n].setAttribute('aria-current', 'true');
  }
  function show(n, dir) {
    if (n === cur) return;
    dir = dir || (n > cur ? 1 : -1);
    cur = n;
    var s = slides[n];
    if (reduce) { swap.textContent = s.word; }
    else {
      swap.classList.add('out');
      setTimeout(function () {
        swap.textContent = s.word;
        swap.classList.remove('out'); swap.classList.add('from');
        void swap.offsetWidth;
        swap.classList.remove('from');
      }, 480);
    }
    slideInto(heroPhoto, photo(s.img, s.alt, dir < 0 ? 'wipe-l' : 'wipe-r'), dir);
    heroCap.textContent = s.cap;
    restart(heroCap, 'cap-in');
    setTicks(n);
  }
  function next() { show((cur + 1) % slides.length, 1); }
  function prev() { show((cur - 1 + slides.length) % slides.length, -1); }
  function start() { stop(); timer = setInterval(next, DUR); }
  function stop() { if (timer) clearInterval(timer); timer = null; }
  function nudge(fn) { fn(); if (!paused) start(); }
  function setPaused(p) {
    paused = p;
    hero.classList.toggle('paused', p);
    pauseBtn.setAttribute('aria-pressed', String(p));
    pauseBtn.textContent = p ? 'Spill av' : 'Pause';
    if (p) stop(); else start();
  }
  ticks.forEach(function (t, k) { t.addEventListener('click', function () { nudge(function () { show(k); }); }); });
  $('#heroNext').addEventListener('click', function () { nudge(next); });
  $('#heroPrev').addEventListener('click', function () { nudge(prev); });
  heroPhoto.addEventListener('click', function () { nudge(next); });
  pauseBtn.addEventListener('click', function () { setPaused(!paused); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else if (!paused) start(); });
  // Sveip på mobil
  (function () {
    var x0 = null, y0 = null;
    hero.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    hero.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) nudge(dx < 0 ? next : prev);
      x0 = null;
    }, { passive: true });
  })();
  setPaused(paused);

  /* ---------- Kapitler med bildeviser ---------- */
  var fields = [
    [ ['bolig-stue.jpg', 'Stue med fjordutsikt i blå time'], ['bolig-kjokken.jpg', 'Kjøkken i eik med utsikt'], ['bolig-loft.jpg', 'Loftsstue med takvinduer'], ['bolig-tomannsbolig.jpg', 'Tomannsbolig i skumring'], ['bolig-hytte.jpg', 'Hytte på et nes, fra drone'] ],
    [ ['bedrift-portrett.jpg', 'Portrett av daglig leder'], ['bedrift-kontor.jpg', 'Hverdag i kontorlandskapet'], ['bedrift-bygg.jpg', 'Hovedkontor ved sjøen'] ],
    [ ['skole-lek.jpg', 'Barnehagebarn på tur i skogen'], ['skole-latter.jpg', 'Tre barn som ler utendørs'], ['skole-klasse.jpg', 'Klassebilde i skolegården'] ],
    [ ['maritim-sveiser.jpg', 'Sveiser i arbeid på verkstedet'], ['maritim-skip.jpg', 'Offshorefartøy i fjorden'], ['maritim-fiskebat.jpg', 'Fiskebåt ved kai'] ]
  ];
  var viewer = $('.viewer');
  var vMain = $('#viewerMain');
  var thumbs = $('#viewerThumbs');
  var vcap = $('#viewerCap');
  var chBody = $('.ch-body');
  var chBtns = $$('.ch-btn');
  var narrow = window.matchMedia('(max-width: 960px)');
  var field = 0, shot = 0;

  function showShot(f, k, dir, animate) {
    shot = k;
    var item = fields[f][k];
    var img = photo(item[0], item[1], animate ? (dir < 0 ? 'wipe-l' : 'wipe-r') : 'kb');
    if (item[0] === 'bedrift-portrett.jpg') img.style.objectPosition = '50% 25%';
    if (animate) slideInto(vMain, img, dir); else { vMain.innerHTML = ''; vMain.appendChild(img); }
    vcap.textContent = item[1] + '.';
    restart(vcap, 'cap-in');
    Array.prototype.forEach.call(thumbs.children, function (b, j) { b.setAttribute('aria-pressed', String(j === k)); });
  }
  function openField(f, animate) {
    var dir = f > field ? 1 : -1;
    field = f;
    chBtns.forEach(function (b, j) {
      var open = j === f;
      var panel = document.getElementById(b.getAttribute('aria-controls'));
      b.setAttribute('aria-expanded', String(open));
      panel.hidden = !open;
      b.closest('.ch-item').classList.toggle('is-open', open);
      if (open && animate) {
        $$('.ch-deliver li', panel).forEach(function (li, i) { li.style.setProperty('--i', i); });
        restart(panel, 'anim');
      }
    });
    thumbs.innerHTML = '';
    fields[f].forEach(function (item, k) {
      var t = document.createElement('button');
      t.type = 'button';
      t.style.setProperty('--i', k);
      t.setAttribute('aria-label', 'Vis bilde: ' + item[1]);
      var ti = new Image(); ti.src = P + item[0] + V; ti.alt = ''; ti.loading = 'lazy';
      t.appendChild(ti);
      t.addEventListener('click', function () { if (k !== shot) showShot(f, k, k > shot ? 1 : -1, true); });
      thumbs.appendChild(t);
    });
    placeViewer();
    showShot(f, 0, dir, animate);
  }
  function placeViewer() {
    var target = narrow.matches ? document.getElementById(chBtns[field].getAttribute('aria-controls')) : chBody;
    if (viewer.parentNode !== target) {
      if (narrow.matches) target.insertBefore(viewer, target.firstChild); else target.appendChild(viewer);
    }
  }
  chBtns.forEach(function (b, j) { b.addEventListener('click', function () { if (j !== field) openField(j, true); }); });
  vMain.addEventListener('click', function () { showShot(field, (shot + 1) % fields[field].length, 1, true); });
  if (narrow.addEventListener) narrow.addEventListener('change', placeViewer);
  openField(0, false);

  /* ---------- Utvalgt arbeid: horisontal slider ---------- */
  var work = [
    ['bolig-stue.jpg', 'Boligfoto', 'Stue i blå time'],
    ['maritim-sveiser.jpg', 'Industri', 'Sveiser på verkstedet'],
    ['bedrift-portrett.jpg', 'Bedrift', 'Portrett, daglig leder', 'tall'],
    ['bolig-hytte.jpg', 'Boligfoto', 'Hytte fra drone'],
    ['skole-lek.jpg', 'Barnehage', 'Tur i skogen'],
    ['maritim-fiskebat.jpg', 'Maritim', 'Fiskebåt ved kai'],
    ['bolig-kjokken.jpg', 'Boligfoto', 'Kjøkken i eik'],
    ['bedrift-bygg.jpg', 'Bedrift', 'Hovedkontor ved sjøen'],
    ['skole-klasse.jpg', 'Skole', 'Klassebilde'],
    ['bolig-tomannsbolig.jpg', 'Boligfoto', 'Tomannsbolig i skumring'],
    ['maritim-skip.jpg', 'Maritim', 'Offshorefartøy i fjorden'],
    ['bedrift-kontor.jpg', 'Bedrift', 'Kontorlandskap'],
    ['skole-latter.jpg', 'Barnehage', 'Utelek'],
    ['bolig-loft.jpg', 'Boligfoto', 'Loftsstue']
  ];
  var reel = $('#arbeid');
  var track = $('#reelTrack');
  var vp = $('#reelViewport');
  var reelBar = $('#reelBar');
  var reelNow = $('#reelNow');
  $('#reelTotal').textContent = work.length;
  work.forEach(function (w) {
    var li = document.createElement('li');
    li.className = 'reel-card' + (w[3] ? ' ' + w[3] : '');
    li.innerHTML = '<figure style="margin:0"><div class="reel-img"></div><figcaption class="reel-cap"><b></b><span></span></figcaption></figure>';
    var img = new Image(); img.src = P + w[0] + V; img.alt = w[1] + ': ' + w[2]; img.loading = 'lazy'; img.draggable = false;
    if (w[0] === 'bedrift-portrett.jpg') img.style.objectPosition = '50% 25%';
    $('.reel-img', li).appendChild(img);
    $('b', li).textContent = w[1];
    $('span', li).textContent = w[2];
    track.appendChild(li);
  });
  var cards = $$('.reel-card', track);
  var SPEED = 0.6; // hvor mye man scroller ned per piksel stripen flytter seg
  var pinned = false, reelTop = 0, reelDist = 0, reelIdx = 0, padL = 0;

  function measureReel() {
    pinned = !reduce && window.innerWidth > 760;
    padL = parseFloat(getComputedStyle(track).paddingLeft) || 0;
    reel.classList.toggle('native', !pinned);
    if (pinned) {
      track.style.transform = '';
      reelDist = Math.max(0, track.scrollWidth - window.innerWidth);
      reel.style.height = (reelDist * SPEED + window.innerHeight) + 'px';
      reelTop = reel.getBoundingClientRect().top + window.scrollY;
    } else {
      reel.style.height = '';
    }
  }
  function reelProgress() {
    if (pinned) return reelDist ? clamp((window.scrollY - reelTop) / (reelDist * SPEED), 0, 1) : 0;
    var max = vp.scrollWidth - vp.clientWidth;
    return max > 0 ? vp.scrollLeft / max : 0;
  }
  function updateReel() {
    var p = reelProgress();
    if (pinned) track.style.transform = 'translate3d(' + (-p * reelDist).toFixed(1) + 'px,0,0)';
    reelBar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    var vw = window.innerWidth, best = 0, bestD = Infinity;
    cards.forEach(function (c, i) {
      var r = c.getBoundingClientRect();
      if (r.left < vw * 0.92) c.classList.add('seen');
      var d = Math.abs(r.left - padL);
      if (d < bestD) { bestD = d; best = i; }
      if (!reduce && r.right > -200 && r.left < vw + 200) {
        var off = ((r.left + r.width / 2) - vw / 2) / vw;
        c.querySelector('img').style.transform = 'translate3d(' + (off * -8).toFixed(2) + '%,0,0)';
      }
    });
    reelIdx = best;
    reelNow.textContent = best + 1;
  }
  function goCard(i) {
    i = clamp(i, 0, cards.length - 1);
    var left = cards[i].offsetLeft - cards[0].offsetLeft;
    if (pinned) window.scrollTo({ top: reelTop + Math.min(left, reelDist) * SPEED, behavior: reduce ? 'auto' : 'smooth' });
    else vp.scrollTo({ left: left, behavior: reduce ? 'auto' : 'smooth' });
  }
  $('#reelNext').addEventListener('click', function () { goCard(reelIdx + 1); });
  $('#reelPrev').addEventListener('click', function () { goCard(reelIdx - 1); });
  vp.addEventListener('scroll', function () { if (!pinned) requestAnimationFrame(updateReel); }, { passive: true });
  // Dra med musen
  (function () {
    var down = false, lastX = 0, vel = 0, raf = null;
    vp.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse') return;
      down = true; lastX = e.clientX; vel = 0;
      vp.classList.add('dragging'); cursorPress(true);
      if (raf) cancelAnimationFrame(raf);
    });
    window.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - lastX; lastX = e.clientX; vel = dx;
      if (pinned) window.scrollBy(0, -dx * 1.4 * SPEED); else vp.scrollLeft -= dx * 1.4;
    });
    window.addEventListener('pointerup', function () {
      if (!down) return;
      down = false; vp.classList.remove('dragging'); cursorPress(false);
      var glide = function () {
        vel *= 0.92;
        if (Math.abs(vel) < 0.5) return;
        if (pinned) window.scrollBy(0, -vel * 1.4 * SPEED); else vp.scrollLeft -= vel * 1.4;
        raf = requestAnimationFrame(glide);
      };
      if (!reduce) raf = requestAnimationFrame(glide);
    });
  })();

  /* ---------- Scroll: parallakse, topp, fremdrift, manifest ---------- */
  var topBar = $('#top');
  var progress = $('#progress');
  var credo = $$('.credo-line');
  var parallax = $$('[data-parallax]');
  var lastY = window.scrollY, ticking = false;

  function onFrame() {
    ticking = false;
    var y = window.scrollY, vh = window.innerHeight;
    var docH = document.documentElement.scrollHeight - vh;
    progress.style.transform = 'scaleX(' + (docH > 0 ? y / docH : 0).toFixed(4) + ')';

    topBar.classList.toggle('solid', y > 40);
    if (y > lastY + 4 && y > 160) topBar.classList.add('hide');
    else if (y < lastY - 4) topBar.classList.remove('hide');
    lastY = y;

    if (!reduce && y < vh * 1.3) {
      heroPhoto.style.transform = 'translate3d(0,' + (y * 0.35).toFixed(1) + 'px,0)';
      heroText.style.transform = 'translate3d(0,' + (-y * 0.18).toFixed(1) + 'px,0)';
      heroText.style.opacity = clamp(1 - y / (vh * 0.75), 0, 1).toFixed(3);
    }
    if (!reduce) {
      credo.forEach(function (l) {
        var r = l.getBoundingClientRect();
        var d = Math.abs(r.top + r.height / 2 - vh * 0.55) / (vh * 0.45);
        l.style.setProperty('--lit', Math.max(0.16, Math.min(1, 1.15 - d)).toFixed(3));
      });
      parallax.forEach(function (img) {
        var r = img.parentNode.getBoundingClientRect();
        if (r.bottom < -100 || r.top > vh + 100) return;
        var k = parseFloat(img.getAttribute('data-parallax'));
        img.style.transform = 'translate3d(0,' + ((r.top + r.height / 2 - vh / 2) * -k).toFixed(1) + 'px,0)';
      });
    }
    updateReel();
  }
  function requestFrame() { if (!ticking) { ticking = true; requestAnimationFrame(onFrame); } }
  window.addEventListener('scroll', requestFrame, { passive: true });
  window.addEventListener('resize', function () { measureReel(); requestFrame(); });
  window.addEventListener('load', function () { measureReel(); requestFrame(); });

  /* ---------- Markør og magnetiske knapper ---------- */
  var cursor = $('#cursor'), cLabel = $('#cursorLabel');
  function cursorPress(on) { if (cursor) cursor.classList.toggle('press', on); }
  if (finePointer && !reduce) {
    var mx = -100, my = -100, cx = -100, cy = -100, moving = false;
    var loop = function () {
      cx += (mx - cx) * 0.2; cy += (my - cy) * 0.2;
      cursor.style.transform = 'translate3d(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px,0)';
      if (Math.abs(mx - cx) > 0.1 || Math.abs(my - cy) > 0.1) requestAnimationFrame(loop); else moving = false;
    };
    window.addEventListener('mousemove', function (e) {
      mx = e.clientX; my = e.clientY; cursor.classList.add('on');
      if (!moving) { moving = true; requestAnimationFrame(loop); }
    });
    document.addEventListener('mouseleave', function () { cursor.classList.remove('on'); });
    document.addEventListener('mouseover', function (e) {
      var t = e.target.closest('[data-cursor]');
      var ctl = e.target.closest('a,button');
      if (t && !ctl) { cLabel.textContent = t.getAttribute('data-cursor'); cursor.classList.add('big'); }
      else { cursor.classList.remove('big'); }
      cursor.classList.toggle('hover', !!ctl);
    });
    $$('.magnet').forEach(function (m) {
      m.addEventListener('mousemove', function (e) {
        var r = m.getBoundingClientRect();
        var dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        m.style.transform = 'translate(' + (dx * 0.25).toFixed(1) + 'px,' + (dy * 0.35).toFixed(1) + 'px)';
      });
      m.addEventListener('mouseleave', function () { m.style.transform = ''; });
    });
  }

  /* ---------- Start ---------- */
  measureReel();
  onFrame();
  requestAnimationFrame(function () { requestAnimationFrame(function () { document.body.classList.add('loaded'); }); });
})();
