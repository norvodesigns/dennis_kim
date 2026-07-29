/* ============================================================
   Dennis Kim — site behaviour
   Vanilla, dependency-free. Degrades gracefully.
   ============================================================ */
(function () {
  'use strict';

  var body = document.body;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- 1. page enter ---------- */
  function ready() {
    body.classList.add('is-ready');
  }
  if (document.readyState === 'complete') {
    requestAnimationFrame(ready);
  } else {
    window.addEventListener('load', function () { requestAnimationFrame(ready); });
    // failsafe: never leave the veil up if load stalls
    setTimeout(ready, 1200);
  }

  // restoring from bfcache (back button) must clear the leaving state
  window.addEventListener('pageshow', function () {
    body.classList.remove('is-leaving', 'nav-open');
    body.classList.add('is-ready');
  });

  /* ---------- 2. page exit transition ----------
     A stuck ".is-leaving" would leave the visitor on a blank page, so the
     exit is watchdogged: if the navigation has not committed shortly after
     we asked for it, we restore the page. `pagehide` cancels the watchdog
     the moment the browser really is unloading us. */
  var EXIT_MS = 330;
  var restoreTimer = null;

  window.addEventListener('pagehide', function () { clearTimeout(restoreTimer); });

  function leaveTo(href) {
    body.classList.add('is-leaving');
    setTimeout(function () { location.href = href; }, EXIT_MS);
    clearTimeout(restoreTimer);
    restoreTimer = setTimeout(function () {
      body.classList.remove('is-leaving');
      body.classList.remove('nav-open');
    }, EXIT_MS + 1600);
  }

  document.addEventListener('click', function (e) {
    if (reduce.matches) return;
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    if (a.target && a.target !== '_self') return;
    if (a.hasAttribute('download')) return;

    var href = a.getAttribute('href');
    if (!href || href.charAt(0) === '#') return;
    if (/^(mailto:|tel:|javascript:)/i.test(href)) return;

    var url;
    try { url = new URL(a.href, location.href); } catch (err) { return; }
    if (url.origin !== location.origin) return;
    // same document? let the browser handle the hash
    if (url.pathname === location.pathname && url.search === location.search) return;

    e.preventDefault();
    leaveTo(a.href);
  });

  /* ---------- 3. scroll reveals ----------
     A [data-stagger] group is one musical phrase: it is observed as a single
     unit and its children are released together on their staggered delays.
     Observing each child separately instead would make every element wait
     for its own intersection while still carrying a delay meant to be
     relative to the group — which reads as a stutter rather than a phrase.
     Groups taller than the viewport fall back to per-element reveals, so a
     long list never animates most of its rows off-screen. */
  var RV = '[data-rv], [data-rv-scale], .lines, .img-rv, .mark';
  var revealables = [].slice.call(document.querySelectorAll(RV));

  if (!('IntersectionObserver' in window) || reduce.matches) {
    revealables.forEach(function (el) { el.classList.add('in'); });
  } else {
    var STEP = 0.05;      // stagger between siblings
    var MAX_D = 0.3;      // never hold the tail of a phrase longer than this
    var LEAD = 0.2;       // start a reveal this far (in viewports) below the fold

    var IMG_WAIT = 2200;   // never hold a curtain up longer than this

    /* An .img-rv wipes a curtain off the photograph. If the photograph has
       not decoded yet the curtain comes off an empty box and the picture
       pops in a beat later, which is the single most broken-looking moment
       on a slow connection. So the wipe waits for pixels — with a timeout so
       a stalled or failed image can never leave the curtain up. */
    function release(el) {
      if (el.classList.contains('img-rv')) {
        var img = el.querySelector('img');
        if (img && !img.complete) {
          var fired = false;
          var go = function () {
            if (fired) return;
            fired = true;
            el.classList.add('in');
          };
          img.addEventListener('load', go, { once: true });
          img.addEventListener('error', go, { once: true });
          setTimeout(go, IMG_WAIT);
          return;
        }
      }
      el.classList.add('in');
    }

    function releaseGroup(group) {
      var kids = [].slice.call(group.querySelectorAll(RV));
      kids.forEach(function (el, i) {
        if (!el.style.getPropertyValue('--d')) {
          el.style.setProperty('--d', Math.min(i * STEP, MAX_D).toFixed(3) + 's');
        }
        release(el);
      });
    }

    /* One queue, two triggers. Each entry fires exactly once, whichever
       trigger reaches it first. */
    var queue = [];
    function fire(entry) {
      if (entry.done) return;
      entry.done = true;
      io.unobserve(entry.el);
      if (entry.group) releaseGroup(entry.el); else release(entry.el);
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        for (var i = 0; i < queue.length; i++) {
          if (queue[i].el === e.target) { fire(queue[i]); break; }
        }
      });
      // start the reveal before the element reaches the fold, so the motion
      // is already under way by the time it is actually looked at
    }, { rootMargin: '0px 0px ' + Math.round(LEAD * 100) + '% 0px', threshold: 0 });

    // groups short enough to read as one phrase are released as a unit;
    // taller ones fall back to per-element so a long list never animates
    // most of its rows off-screen
    var phrased = [];
    [].slice.call(document.querySelectorAll('[data-stagger]')).forEach(function (g) {
      if (g.getBoundingClientRect().height <= window.innerHeight * 1.1) phrased.push(g);
    });
    function inPhrasedGroup(el) {
      for (var i = 0; i < phrased.length; i++) if (phrased[i].contains(el)) return true;
      return false;
    }

    phrased.forEach(function (g) { queue.push({ el: g, group: true, done: false }); });
    revealables.forEach(function (el) {
      if (inPhrasedGroup(el)) return;           // its group will release it
      var group = el.closest('[data-stagger]'); // tall group: keep delay ordering
      if (group && !el.style.getPropertyValue('--d')) {
        var kids = [].slice.call(group.querySelectorAll(RV));
        var i = kids.indexOf(el);
        if (i > -1) el.style.setProperty('--d', ((i % 4) * STEP).toFixed(3) + 's');
      }
      queue.push({ el: el, group: false, done: false });
    });
    queue.forEach(function (q) { io.observe(q.el); });

    /* Safety net.
       iOS throttles IntersectionObserver callbacks during momentum scrolling,
       so a fling outruns the observer and the reveal lands after the element
       is already in view — which reads as things snapping into existence
       rather than animating. This rAF pass is keyed off scroll instead, and
       whichever trigger gets there first wins. Reads are batched ahead of
       writes so the sweep never thrashes layout. */
    // photographs still waiting to be fetched, so they can be given a head
    // start well before their curtain is due to lift
    var lazyImgs = [].slice.call(document.querySelectorAll('.img-rv img[loading="lazy"]'));

    var sweeping = false;
    function sweep() {
      sweeping = false;
      var vh = window.innerHeight;

      // start fetching a good two viewports out, so that by the time the
      // curtain is due the pixels are usually already there
      if (lazyImgs.length) {
        var keep = [];
        for (var k = 0; k < lazyImgs.length; k++) {
          var im = lazyImgs[k];
          if (im.complete) continue;
          if (im.getBoundingClientRect().top < vh * 2.5) im.loading = 'eager';
          else keep.push(im);
        }
        lazyImgs = keep;
      }

      if (!queue.length) return;
      var line = vh * (1 + LEAD);
      var due = [], still = [];
      for (var i = 0; i < queue.length; i++) {
        var q = queue[i];
        if (q.done) continue;
        var r = q.el.getBoundingClientRect();
        if (r.top < line) due.push(q); else still.push(q);
      }
      for (var j = 0; j < due.length; j++) fire(due[j]);
      queue = still;
      if (!queue.length && !lazyImgs.length) window.removeEventListener('scroll', onScrollRv);
    }
    function onScrollRv() {
      if (!sweeping) { sweeping = true; requestAnimationFrame(sweep); }
    }
    window.addEventListener('scroll', onScrollRv, { passive: true });
    window.addEventListener('resize', onScrollRv, { passive: true });

    /* Hold the first sweep until the entry veil has begun to clear. Firing it
       at parse time means everything above the fold animates behind the veil
       and is simply present by the time the page is visible — which is what
       makes a first screenful look like it has no motion at all. */
    function firstSweep() { requestAnimationFrame(sweep); }
    if (document.readyState === 'complete') setTimeout(firstSweep, 220);
    else window.addEventListener('load', function () { setTimeout(firstSweep, 220); });
    setTimeout(firstSweep, 1500);   // failsafe; sweep is idempotent
  }

  /* ---------- 4. nav: stuck + dark-over-hero ---------- */
  var nav = document.querySelector('.site-nav');
  var hero = document.querySelector('[data-hero]');

  if (nav) {
    var navH = nav.offsetHeight;
    var ticking = false;
    // every ink field the bar can pass over: the hero, the dark bands, the footer
    var darkZones = [].slice.call(document.querySelectorAll('.hero, .band, .site-foot'));

    /* Measure --seam rather than re-deriving its clamp() in script, so the
       colour ramp can never drift out of step with the CSS one. */
    var seamProbe = document.createElement('div');
    seamProbe.style.cssText =
      'position:absolute;top:0;left:0;width:0;visibility:hidden;pointer-events:none;height:var(--seam)';
    document.body.appendChild(seamProbe);

    // the hero cuts straight to paper with no seam, so give the handover a
    // short synthetic ramp of its own rather than letting it snap
    var HERO_RAMP = 84;

    function smooth(t) {
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      return t * t * (3 - 2 * t);
    }

    /* How dark the backdrop is at viewport height `y`: 1 inside an ink
       field, easing to 0 across that field's seam. Sampled at one line, so
       this is a handful of reads per frame. */
    function darknessAt(y, seam) {
      var d = 0;
      for (var i = 0; i < darkZones.length; i++) {
        var el = darkZones[i];
        var r = el.getBoundingClientRect();
        if (!r.height) continue;
        var ramp = el.classList.contains('hero') ? HERO_RAMP : seam;
        var v;
        if (y >= r.top && y <= r.bottom) v = 1;
        else if (y < r.top) v = smooth(1 - (r.top - y) / ramp);
        else v = smooth(1 - (y - r.bottom) / ramp);
        if (v > d) d = v;
      }
      return d;
    }

    /* Swap when the backdrop's own luminance crosses halfway — the moment
       the outgoing and incoming colours have equal contrast — with a dead
       band either side so a scroll resting on the boundary cannot flicker. */
    var isDark = nav.classList.contains('on-dark');

    function syncNav() {
      ticking = false;
      var y = window.scrollY || window.pageYOffset;
      var nd = darknessAt(navH * 0.55, seamProbe.offsetHeight || 120);

      if (isDark && nd < 0.42) isDark = false;
      else if (!isDark && nd > 0.58) isDark = true;
      nav.classList.toggle('on-dark', isDark);

      /* The bar sits bare only at the very top, where it reads as part of
         the hero. The moment the page moves it takes a field, over the hero
         too — without one, the hero's own type scrolls underneath the
         wordmark and the two collide. */
      nav.classList.toggle('is-stuck', y > 8);
    }
    function onScroll() {
      if (!ticking) { ticking = true; requestAnimationFrame(syncNav); }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () { navH = nav.offsetHeight; syncNav(); });
    syncNav();
  }

  /* ---------- 5. mobile drawer ----------
     Opening and closing are both choreographed. The wordmark is FLIPped:
     the drawer's copy is measured against the header's, placed exactly on
     top of it, then released — so the mark appears to grow out of the bar
     and settle above the links. Closing runs the same move in reverse. */
  var burger = document.querySelector('.burger');
  if (burger && nav) {
    var drawer = nav.querySelector('.nav__drawer');
    var hdrMark = nav.querySelector('.wordmark');
    var drwMark = nav.querySelector('.drawer__mark');
    var closeTimer = null;
    // must match the closing choreography in site.css: the mark flies home in
    // 500ms, the backdrop clears at 720ms, and the header copy fades back in
    // across the handover at 460–680ms
    var CLOSE_MS = 740;

    /* The glyphs are what the eye tracks, so the move has to be measured from
       the text boxes — not the element boxes. The header wordmark carries
       16px of vertical padding for its hit area, so matching element boxes
       would land the drawer copy a padding's height too high and leave it to
       snap into place at the handover. A Range over the contents gives the
       real inked box on both sides. */
    function textRect(el) {
      var r = document.createRange();
      r.selectNodeContents(el);
      var rect = r.getBoundingClientRect();
      return (rect && rect.width) ? rect : el.getBoundingClientRect();
    }

    /* Both marks share family, weight and an em-based letter-spacing, so one
       uniform scale matches them. transform-origin is the element's top-left,
       which is not necessarily the text's top-left, so the translation is
       solved for explicitly rather than assumed. */
    function restingTransform() {
      if (!hdrMark || !drwMark) return '';
      drwMark.style.transition = 'none';
      drwMark.style.transform = 'none';

      var eb = drwMark.getBoundingClientRect();  // element box, the origin
      var b = textRect(drwMark);                 // its inked box
      var a = textRect(hdrMark);                 // where that box must land
      if (!b.width || !a.width) return '';

      var s = a.width / b.width;
      var dx = a.left - eb.left - s * (b.left - eb.left);
      var dy = a.top - eb.top - s * (b.top - eb.top);
      return 'translate(' + dx.toFixed(2) + 'px,' + dy.toFixed(2) + 'px) scale(' + s.toFixed(4) + ')';
    }

    /* Pin the mark at `t` with transitions OFF, force the browser to commit
       that as the starting style, and only then hand control back to the
       stylesheet. Restoring the transition before the commit would make the
       browser animate INTO the start pose and the move would collapse. */
    function commitThenRelease(t) {
      if (!drwMark) return;
      drwMark.style.transition = 'none';
      drwMark.style.transform = t;
      // eslint-disable-next-line no-unused-expressions
      drwMark.offsetWidth;
      drwMark.style.transition = '';
    }

    function open() {
      clearTimeout(closeTimer);
      nav.classList.remove('is-closing');

      var start = reduce.matches ? '' : restingTransform();
      commitThenRelease(start || 'none');

      nav.classList.add('is-open');
      body.classList.add('nav-open');
      burger.setAttribute('aria-expanded', 'true');
      if (drawer) drawer.setAttribute('aria-hidden', 'false');

      if (drwMark) {
        requestAnimationFrame(function () { drwMark.style.transform = 'none'; });
      }
    }

    function close() {
      // Restore document scrolling BEFORE measuring. Releasing `nav-open`
      // brings the scrollbar back, which narrows the viewport and shifts the
      // header; measuring first would aim the mark at a stale target.
      body.classList.remove('nav-open');

      var end = reduce.matches ? '' : restingTransform();
      // the mark is sitting at its resting pose; commit that, then release
      commitThenRelease('none');

      nav.classList.add('is-closing');
      nav.classList.remove('is-open');
      burger.setAttribute('aria-expanded', 'false');
      if (drawer) drawer.setAttribute('aria-hidden', 'true');

      if (drwMark && end) {
        requestAnimationFrame(function () { drwMark.style.transform = end; });
      }

      clearTimeout(closeTimer);
      closeTimer = setTimeout(function () {
        nav.classList.remove('is-closing');
        if (drwMark) {
          drwMark.style.transition = 'none';
          drwMark.style.transform = 'none';
          drwMark.offsetWidth;
          drwMark.style.transition = '';
        }
      }, CLOSE_MS);
    }

    function setOpen(want) { want ? open() : close(); }

    burger.addEventListener('click', function () {
      setOpen(!nav.classList.contains('is-open'));
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        close();
        burger.focus();
      }
    });
    // close if we resize up into desktop
    window.addEventListener('resize', function () {
      if (window.innerWidth >= 900 && nav.classList.contains('is-open')) close();
    });

    // initial state, without running the closing choreography on load
    nav.classList.remove('is-open', 'is-closing');
    body.classList.remove('nav-open');
    burger.setAttribute('aria-expanded', 'false');
    if (drawer) drawer.setAttribute('aria-hidden', 'true');
  }

  /* ---------- 6. hero parallax ----------
     The entrance scale lives on .hero__media (CSS transition); the drift
     lives on the <img> with no transition, so the two never fight. */
  var heroImg = document.querySelector('.hero__media img');
  if (heroImg && !reduce.matches) {
    var pTick = false;
    var parallaxOn = window.innerWidth > 860;

    function parallax() {
      pTick = false;
      if (!parallaxOn) return;
      var y = window.scrollY || window.pageYOffset;
      if (y > window.innerHeight * 1.25) return;
      heroImg.style.transform = 'translate3d(0,' + (y * 0.13).toFixed(2) + 'px,0)';
    }
    window.addEventListener('scroll', function () {
      if (!pTick) { pTick = true; requestAnimationFrame(parallax); }
    }, { passive: true });
    window.addEventListener('resize', function () {
      var next = window.innerWidth > 860;
      if (next === parallaxOn) return;
      parallaxOn = next;
      if (!parallaxOn) heroImg.style.transform = '';
      else parallax();
    });
  }

  /* ---------- 7. counters ---------- */
  var counters = [].slice.call(document.querySelectorAll('[data-count]'));
  if (counters.length) {
    if (reduce.matches || !('IntersectionObserver' in window)) {
      counters.forEach(function (el) { el.textContent = el.dataset.count; });
    } else {
      var cio = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var el = entry.target;
          cio.unobserve(el);
          var target = parseInt(el.dataset.count, 10);
          if (isNaN(target)) { el.textContent = el.dataset.count; return; }
          var dur = 1250, t0 = null;
          function step(ts) {
            if (t0 === null) t0 = ts;
            var p = Math.min((ts - t0) / dur, 1);
            var eased = 1 - Math.pow(1 - p, 4);
            el.textContent = Math.round(target * eased);
            if (p < 1) requestAnimationFrame(step);
            else el.textContent = target;
          }
          requestAnimationFrame(step);
        });
      }, { threshold: 0.5 });
      counters.forEach(function (el) { el.textContent = '0'; cio.observe(el); });
    }
  }

  /* ---------- 8. current year ---------- */
  var yrs = document.querySelectorAll('[data-year]');
  if (yrs.length) {
    var y = String(new Date().getFullYear());
    for (var i = 0; i < yrs.length; i++) yrs[i].textContent = y;
  }
})();
