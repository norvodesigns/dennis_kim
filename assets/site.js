/* ============================================================
   Dennis Kim — site behaviour
   Vanilla, dependency-free. Degrades gracefully.
   ============================================================ */
(function () {
  'use strict';

  var root = document.documentElement;
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

  /* ---------- 3. scroll reveals ---------- */
  var revealables = [].slice.call(document.querySelectorAll('[data-rv], .lines, .img-rv'));

  if (!('IntersectionObserver' in window) || reduce.matches) {
    revealables.forEach(function (el) { el.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -11% 0px', threshold: 0.06 });

    revealables.forEach(function (el) {
      // stagger siblings that opt in
      var group = el.closest('[data-stagger]');
      if (group && !el.style.getPropertyValue('--d')) {
        var kids = [].slice.call(group.querySelectorAll('[data-rv], .lines, .img-rv'));
        var i = kids.indexOf(el);
        if (i > -1) el.style.setProperty('--d', (i * 0.085).toFixed(3) + 's');
      }
      io.observe(el);
    });

    // anything already above the fold on load reveals immediately
    requestAnimationFrame(function () {
      revealables.forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.top < window.innerHeight * 0.92 && r.bottom > 0) el.classList.add('in');
      });
    });
  }

  /* ---------- 4. nav: stuck + dark-over-hero ---------- */
  var nav = document.querySelector('.site-nav');
  var hero = document.querySelector('[data-hero]');

  if (nav) {
    var navH = nav.offsetHeight;
    var ticking = false;

    function syncNav() {
      ticking = false;
      var y = window.scrollY || window.pageYOffset;

      if (hero) {
        var over = hero.getBoundingClientRect().bottom > navH * 0.62;
        nav.classList.toggle('on-dark', over);
        nav.classList.toggle('is-stuck', !over && y > 8);
      } else {
        nav.classList.toggle('is-stuck', y > 8);
      }
    }
    function onScroll() {
      if (!ticking) { ticking = true; requestAnimationFrame(syncNav); }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () { navH = nav.offsetHeight; syncNav(); });
    syncNav();
  }

  /* ---------- 5. mobile drawer ---------- */
  var burger = document.querySelector('.burger');
  if (burger && nav) {
    var drawer = nav.querySelector('.nav__drawer');

    function setOpen(open) {
      nav.classList.toggle('is-open', open);
      body.classList.toggle('nav-open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (drawer) drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
    }
    burger.addEventListener('click', function () {
      setOpen(!nav.classList.contains('is-open'));
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        setOpen(false);
        burger.focus();
      }
    });
    // close if we resize up into desktop
    window.addEventListener('resize', function () {
      if (window.innerWidth >= 900 && nav.classList.contains('is-open')) setOpen(false);
    });
    setOpen(false);
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
