/* LaunchVault /new/ homepage: the page-only motion, on top of the shared motion.js (reveals, pins, tabs, accordion, cursor, band).
   Everything here is optional: without it the page shows its finished state. Reduced motion: no loops, no tweens, no parallax. */
(function () {
  'use strict';
  var d = document, w = window, html = d.documentElement;
  var reduced = w.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = w.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var $ = function (s, r) { return (r || d).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  if (!('IntersectionObserver' in w)) return;
  html.classList.add('hjs');

  /* ---------- in-view helpers: once(els, fn) fires one time, live(els, fn(el, on)) follows on/off screen ---------- */
  function watch(els, fn, once, margin) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (once) { if (e.isIntersecting) { io.unobserve(e.target); fn(e.target); } } else fn(e.target, e.isIntersecting);
      });
    }, { threshold: once ? 0.2 : 0.05, rootMargin: margin || '0px' });
    els.forEach(function (el) { io.observe(el); });
  }
  watch($$('.ch,.how-row'), function (el) { el.classList.add('in'); }, true, '0px 0px -6% 0px');
  if (!reduced) watch($$('[data-demo]'), function (el, on) { el.classList.toggle('play', on); });

  /* one rAF-throttled scroll bus for the scrub heading and the hero parallax */
  var jobs = [], ticking = false;
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; jobs.forEach(function (j) { j(); }); }); } }
  w.addEventListener('scroll', onScroll, { passive: true });
  w.addEventListener('resize', onScroll);

  /* ---------- hero: fit one screen on short desktops (--hk), phone loop, parallax ---------- */
  var hero = $('.hero'), ip = $('.hero-ip'), card = $('.hero-card');
  function fit() {
    if (w.innerWidth >= 1100) hero.style.setProperty('--hk', clamp((w.innerHeight - 72) / 828, 0.72, 1).toFixed(3));
    else hero.style.removeProperty('--hk');
  }
  if (hero) { fit(); w.addEventListener('resize', fit); }

  if (ip && !reduced) {
    /* your week -> tap "Continue reading" -> the story opens, its line draws -> mark step done -> back, ticked */
    var seq = [[3, 1500], [4, 2300], [0, 900], [1, 450], [2, 3600]], k = 0, timer = 0, vis = false;
    var step = function () {
      timer = 0;
      if (!vis || d.hidden || !ip.offsetParent) return;
      ip.dataset.step = seq[k][0];
      timer = setTimeout(step, seq[k][1]);
      k = (k + 1) % seq.length;
    };
    var kick = function () { if (!timer) timer = setTimeout(step, ip.dataset.step ? 600 : 3600); };
    watch([ip], function (el, on) { vis = on; if (on) kick(); });
    d.addEventListener('visibilitychange', kick);

    var px = 0, py = 0, heroOn = true;
    var par = function () {
      if (!heroOn || !ip.offsetParent) return;
      var y = w.scrollY;
      ip.style.transform = 'translate3d(0,' + (-y * 0.07).toFixed(1) + 'px,0) rotateY(' + (px * 5).toFixed(2) + 'deg) rotateX(' + (-py * 4).toFixed(2) + 'deg)';
      if (w.innerWidth >= 720) card.style.transform = 'translate3d(' + (px * -8).toFixed(1) + 'px,' + (-y * 0.14 + py * -6).toFixed(1) + 'px,0)';
      else card.style.transform = '';
    };
    watch([hero], function (el, on) { heroOn = on; });
    jobs.push(par);
    if (fine) hero.addEventListener('pointermove', function (e) {
      px = e.clientX / w.innerWidth - 0.5; py = e.clientY / w.innerHeight - 0.5; onScroll();
    }, { passive: true });
  }

  /* ---------- closer: words light up with the scroll ---------- */
  var sc = $('[data-scrub]');
  if (sc && !reduced) {
    sc.setAttribute('aria-label', sc.textContent.replace(/\s+/g, ' ').trim());
    $$('span,em', sc).forEach(function (line) {
      line.innerHTML = line.textContent.trim().split(/\s+/).map(function (t) { return '<span class="w" aria-hidden="true">' + t + '</span>'; }).join(' ');
    });
    var words = $$('.w', sc), lit = 0, scOn = false;
    watch([sc], function (el, on) { scOn = on; if (on) scrub(); });
    var scrub = function () {
      if (!scOn) return;
      var r = sc.getBoundingClientRect(), vh = w.innerHeight;
      var n = Math.round(clamp((vh * 0.88 - r.top) / (vh * 0.42), 0, 1) * words.length);
      for (; lit < n; lit++) words[lit].classList.add('on');
      for (; lit > n; lit--) words[lit - 1].classList.remove('on');
    };
    jobs.push(scrub);
  }

  /* ---------- the big chart: crosshair scrub (mouse, touch, arrow keys), range pills morph the line ---------- */
  (function () {
    var el = $('.bigch'); if (!el) return;
    var all = JSON.parse(el.closest('[data-pts]').dataset.pts), N = 11;
    var line = $('.ch-l', el), area = $('.ch-a', el), base = $('.ch-b', el), dot = $('.ch-dot', el);
    var cx = $('.ch-x', el), cd = $('.ch-xd', el), tip = $('.ch-tip', el), tipL = tip.firstElementChild, tipV = tip.lastElementChild;
    var ax = $('.ch-ax'), d1 = $('.cp-d1'), d2 = $('.cp-d2'), f2 = $('.cp-f2');
    var cur, idx = 0, home = 0, W = 0, H = 0, left = 0, raf = 0;
    var money = function (v) { return '$' + Math.round(v).toLocaleString('en-US'); };

    function make(p) {                      /* same maths as the Paper builder: 12% of the range above and below */
      var v = p.map(function (q) { return q[1]; }), lo = Math.min.apply(0, v), hi = Math.max.apply(0, v), pad = (hi - lo) * 0.12 || 1;
      lo -= pad; hi += pad;
      var y = v.map(function (a) { return 100 - (a - lo) / (hi - lo) * 100; }), s = [];
      for (var i = 0; i < N; i++) { var t = i / (N - 1) * (y.length - 1), a = Math.floor(t), b = Math.min(y.length - 1, a + 1); s.push(y[a] + (y[b] - y[a]) * (t - a)); }
      return { p: p, v: v, y: y, s: s };    /* s = the line resampled to 11 points, so every range can morph into every other */
    }
    function paint(s) {
      var path = 'M' + s.map(function (yy, i) { return (i * 10) + ' ' + yy.toFixed(2); }).join(' L');
      line.setAttribute('d', path); area.setAttribute('d', path + ' L100 100 L0 100 Z');
      base.setAttribute('y1', s[0].toFixed(2)); base.setAttribute('y2', s[0].toFixed(2));
      dot.style.top = s[N - 1].toFixed(2) + '%';
    }
    function measure() { var r = el.getBoundingClientRect(); W = r.width; H = r.height; left = r.left; }
    function place(i) {
      idx = clamp(i, 0, cur.p.length - 1);
      var x = idx / (cur.p.length - 1) * W, y = cur.y[idx] / 100 * H;
      cx.style.transform = 'translateX(' + x.toFixed(1) + 'px)';
      cd.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
      tip.style.transform = 'translateX(' + clamp(x - 84, -10, W - 158).toFixed(1) + 'px)';
      tipL.textContent = cur.p[idx][0]; tipV.textContent = money(cur.v[idx]);
      el.setAttribute('aria-valuenow', idx); el.setAttribute('aria-valuemax', cur.p.length - 1);
      el.setAttribute('aria-valuetext', cur.p[idx][0] + ': ' + money(cur.v[idx]));
    }
    function set(n, animate) {
      var from = cur ? cur.s : null;
      cur = make(n ? all.slice(-n) : all);
      var v = cur.v, last = v.length - 1, peak = v.indexOf(Math.max.apply(0, v)), ref = peak === last ? 0 : peak, diff = v[last] - v[ref];
      home = peak;
      d1.textContent = (diff < 0 ? '▼ ' : '▲ ') + money(Math.abs(diff)) + ' (' + (diff < 0 ? '-' : '+') + Math.abs(diff / v[ref] * 100).toFixed(1) + '%)';
      d2.textContent = 'since ' + cur.p[ref][0] + (ref === peak ? ', the best month' : '');
      f2.textContent = cur.p.length === all.length ? 'The dotted line is where the year started.' : 'The dotted line is where this range started.';
      if (ax) ax.innerHTML = cur.p.map(function (q) { return '<span>' + q[0].slice(0, 3) + '</span>'; }).join('');
      cancelAnimationFrame(raf);
      if (!animate || reduced || !from) { paint(cur.s); place(home); return; }
      var to = cur.s, t0 = performance.now();
      place(home);
      (function tick(now) {
        var q = Math.min(1, (now - t0) / 560), e = 1 - Math.pow(1 - q, 4);
        paint(from.map(function (a, i) { return a + (to[i] - a) * e; }));
        if (q < 1) raf = requestAnimationFrame(tick);
      })(t0);
    }
    el.setAttribute('role', 'slider'); el.tabIndex = 0; el.setAttribute('aria-valuemin', 0);
    el.setAttribute('aria-label', 'Rezi revenue by month. Use the left and right arrow keys to move along the line.');
    measure(); set(0, false);
    if ('ResizeObserver' in w) new ResizeObserver(function () { measure(); place(idx); }).observe(el);
    watch([el], function () { setTimeout(function () { el.classList.add('live'); }, reduced ? 0 : 900); }, true);
    var seek = function (e) { place(Math.round((e.clientX - left) / W * (cur.p.length - 1))); };
    el.addEventListener('pointerenter', measure);
    el.addEventListener('pointerdown', function (e) { measure(); seek(e); });
    el.addEventListener('pointermove', seek);
    el.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') place(home); });
    el.addEventListener('keydown', function (e) {
      var s = { ArrowLeft: idx - 1, ArrowRight: idx + 1, Home: 0, End: cur.p.length - 1 }[e.key];
      if (s === undefined) return;
      e.preventDefault(); place(s);
    });
    var seg = $('.cp-seg');
    if (seg) seg.addEventListener('lv:change', function (e) { set(+e.detail.item.dataset.value, true); });
  })();

  /* ---------- pricing: monthly / yearly, the price rolls to its new value ---------- */
  var pseg = $('.price-seg');
  if (pseg) pseg.addEventListener('lv:change', function (e) {
    var key = e.detail.item.dataset.value === 'y' ? 'y' : 'm';
    $$('.pc-d[data-m]').forEach(function (p) { p.textContent = p.dataset[key]; });
    $$('.pc-n[data-m]').forEach(function (n) {
      var from = parseFloat(n.textContent.slice(1)), to = parseFloat(n.dataset[key]), t0 = performance.now();
      cancelAnimationFrame(n._raf);
      if (reduced) { n.textContent = '$' + to.toFixed(2); return; }
      (function tick(now) {
        var q = Math.min(1, (now - t0) / 480), v = from + (to - from) * (1 - Math.pow(1 - q, 4));
        n.textContent = '$' + (q < 1 ? v : to).toFixed(2);
        if (q < 1) n._raf = requestAnimationFrame(tick);
      })(t0);
    });
  });

  /* ---------- how it works on phones: the row swipes; dots follow, arrow keys work once it is focusable ---------- */
  var row = $('.how-row'), dots = $$('.how-dots i');
  if (row) {
    var items = $$('.how-i', row), busy = false;
    var sync = function () {
      busy = false;
      var scrollable = row.scrollWidth > row.clientWidth + 4;
      if (scrollable) row.tabIndex = 0; else row.removeAttribute('tabindex');
      if (!scrollable || items.length < 2) return;
      var pitch = items[1].offsetLeft - items[0].offsetLeft, n = clamp(Math.round(row.scrollLeft / pitch), 0, dots.length - 1);
      dots.forEach(function (o, i) { o.classList.toggle('on', i === n); });
    };
    row.addEventListener('scroll', function () { if (!busy) { busy = true; requestAnimationFrame(sync); } }, { passive: true });
    w.addEventListener('resize', sync);
    sync();
  }
})();
