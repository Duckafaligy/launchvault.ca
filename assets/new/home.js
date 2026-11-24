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

  /* ---------- scroll-linked: phones drift at their own speeds, panels and the big number grow into place ----------
     Uses the separate translate / scale properties, so the reveal transforms keep working underneath. */
  if (!reduced && 'translate' in d.body.style) {
    var fx = [];
    [['.how-row .how-i:nth-child(odd)', 'par', 0.035], ['.how-row .how-i:nth-child(even)', 'par', -0.025], ['.post-f', 'par', 0.035], ['.closer-t', 'par', 0.06],
     ['.h-num', 'zoom', 0.74], ['.panel.cp,.panel.wl,.panel.src,.panel.lbls,.endcta-in,.bd', 'zoom', 0.93]].forEach(function (c) {
      $$(c[0]).forEach(function (el) { fx.push({ el: el, kind: c[1], k: c[2], on: false, dy: 0 }); });
    });
    var byEl = new Map(fx.map(function (f) { return [f.el, f]; }));
    watch(fx.map(function (f) { return f.el; }), function (el, on) { byEl.get(el).on = on; if (on) onScroll(); }, false, '120px');
    jobs.push(function () {
      var vh = w.innerHeight, wide = w.innerWidth >= 720;
      fx.forEach(function (f) {
        if (!f.on) return;
        var r = f.el.getBoundingClientRect(), c = r.top + r.height / 2 - f.dy;
        if (f.kind === 'par') {
          f.dy = wide ? clamp((c - vh / 2) * f.k, -60, 60) : 0;      /* phones swipe sideways on small screens: no drift there */
          f.el.style.translate = f.dy ? '0 ' + f.dy.toFixed(1) + 'px' : '';
        } else {
          var p = clamp((vh + f.el.offsetHeight * 0.3 - c) / (vh * 0.7), 0, 1), e = 1 - Math.pow(1 - p, 3);
          f.el.style.scale = e >= 1 ? '' : (f.k + (1 - f.k) * e).toFixed(4);
        }
      });
    });
    onScroll();
  }

  /* ---------- the highlight is dragged on by a cursor; glass cards catch the pointer's light ---------- */
  var hl = $('#credits .hl-box');
  if (hl && !reduced) hl.insertAdjacentHTML('beforeend', '<span class="lv-cur sel-cur" aria-hidden="true"><svg viewBox="0 0 20 22" width="20" height="22"><path d="M4 3.2 C4 2.2 5.1 1.6 6 2.2 L17.2 9.9 C18.1 10.5 17.8 11.9 16.7 12.1 L11.6 13 L9.2 17.6 C8.7 18.6 7.2 18.4 7 17.3 Z"/></svg></span>');
  if (fine) d.addEventListener('pointermove', function (e) {
    var c = e.target.closest && e.target.closest('.card,.panel');
    if (!c) return;
    var r = c.getBoundingClientRect();
    c.style.setProperty('--sx', (e.clientX - r.left).toFixed(0) + 'px'); c.style.setProperty('--sy', (e.clientY - r.top).toFixed(0) + 'px');
  }, { passive: true });

  /* ---------- the page is built in front of you (motion.js runs the jobs; this says which layer gets which) ----------
     type = heading typed in Arial then switched to the real font, write = paragraph typed, draw = box dragged out then the layer appears */
  if (!reduced) [
    ['write', '.hero-lead,.learned-b,.prob-b,.num-cap,.st-b,.price-b,.blog .sec-h .body'],
    ['draw', '.hero-cta .btn,.hero-ip,.hero-card,.panel.src,.panel.lbls,.panel.cp,.bd-c,.st-btn,.panel.wl,.plans>.pc,.posts>.post,.end-in .btn']
  ].forEach(function (b) { $$(b[1]).forEach(function (el) { if (!el.dataset.build) el.dataset.build = b[0]; }); });

  /* ---------- the top bar is designed on load: its frame is drawn, the logo is placed and typed, the links are typed bunched together
     and then spaced out, Log in is typed, the button is dragged out as a box, typed, rounded and filled ---------- */
  (function () {
    var bar = $('.nav-bar'), run = bar && !reduced && w.innerWidth >= 1100 && w.LV && LV.type, started = false;
    if (!run) return html.classList.add('nb-done');
    /* built the first time you are at the top: straight away on a normal load, or when you scroll up to it after loading further down */
    function arm() {
      if (started || w.scrollY >= 40) return;
      started = true; w.removeEventListener('scroll', arm);
      setTimeout(function () {
        if (w.scrollY < 40 && !$('.nav').classList.contains('is-pill')) return build();
        started = false; w.addEventListener('scroll', arm, { passive: true });
      }, performance.now() < 1500 ? 380 : 700);                        /* coming back from the pill: let the bar finish widening first */
    }
    w.addEventListener('scroll', arm, { passive: true });
    arm();
    function build() {
    var logo = $('.nav-logo', bar), box = $('.nav-links', bar), links = $$('a', box), login = $('.nav-login', bar), btn = $('.nav-start', bar);
    var ov = d.createElement('div'); ov.className = 'nb-ov'; ov.setAttribute('aria-hidden', 'true');
    ov.innerHTML = '<div class="lv-sel"><i></i><i></i><i></i><i></i><b></b></div><div class="lv-sel"><i></i><i></i><i></i><i></i></div><div class="lv-chip"></div>' +
      '<span class="lv-cur nb-cur"><svg viewBox="0 0 20 22" width="20" height="22"><path d="M4 3.2 C4 2.2 5.1 1.6 6 2.2 L17.2 9.9 C18.1 10.5 17.8 11.9 16.7 12.1 L11.6 13 L9.2 17.6 C8.7 18.6 7.2 18.4 7 17.3 Z"/></svg></span>';
    d.body.appendChild(ov);
    var frame = ov.children[0], rect = ov.children[1], chip = ov.children[2], cur = ov.children[3], timers = [], t = 0, dead = false;
    var R = function (el) { return el.getBoundingClientRect(); };
    function go(x, y, ms) { cur.style.transition = 'opacity .25s,transform ' + ms + 'ms cubic-bezier(.45,0,.2,1)'; cur.style.transform = 'translate(' + x.toFixed(0) + 'px,' + y.toFixed(0) + 'px)'; }
    function put(el, x, y, wd, h) { el.style.transform = 'translate(' + x.toFixed(0) + 'px,' + y.toFixed(0) + 'px)'; el.style.width = wd + 'px'; el.style.height = h + 'px'; }
    function type(el, per) { el.style.opacity = 1; LV.type(el, per); }
    function say(html_, el) {                                         /* the tool panel: always 10px under the layer it changes, cursor on its value */
      var r = R(el), x = r.left + r.width / 2 - 34, y = r.bottom + 10;
      chip.innerHTML = html_; chip.style.transform = 'translate(' + x.toFixed(0) + 'px,' + y.toFixed(0) + 'px)'; chip.classList.add('on');
      go(x + 62, y + 12, 300);
    }
    function step(wait, fn) { t += wait; timers.push(setTimeout(function () { if (!dead) fn(); }, t)); }
    function end() {
      if (dead) return; dead = true;
      timers.forEach(clearTimeout);
      [logo, login, btn, box].concat(links).forEach(function (el) { el.removeAttribute('style'); });
      btn.classList.remove('nb-ghost'); logo.classList.remove('nb-pop');
      html.classList.add('nb-done'); ov.remove();
      w.removeEventListener('scroll', bail);
    }
    function bail() { if (w.scrollY > 40) end(); }                    /* scrolled away mid-build: finish at once */
    w.addEventListener('scroll', bail, { passive: true });

    [logo, login, btn].concat(links).forEach(function (el) { el.style.animation = 'none'; el.style.opacity = 0; });
    var B = R(bar), L = R(logo), FY = B.top + 10, FH = B.height - 20;
    btn.classList.add('nb-ghost'); box.style.gap = '6px';             /* links are typed bunched together; spaced out afterwards */
    frame.lastChild.textContent = 'Navbar · ' + Math.round(B.width) + ' × ' + Math.round(FH);
    go(B.left - 30, B.bottom + 40, 0);
    step(120, function () { cur.style.opacity = 1; go(B.left, FY, 320); });
    step(340, function () {                                           /* draw the bar's frame, corner to corner */
      cur.classList.add('down');
      put(frame, B.left, FY, 0, 0); frame.getBoundingClientRect(); frame.classList.add('on');
      put(frame, B.left, FY, B.width, FH); go(B.right, FY + FH, 600);
    });
    step(640, function () { cur.classList.remove('down'); go(L.left - 6, L.bottom + 4, 380); });
    step(400, function () { logo.classList.add('nb-pop'); type(logo, 30); });
    step(430, function () { var r = R(links[0]); go(r.left - 8, r.bottom + 4, 340); });
    links.forEach(function (a, i) {
      step(i ? a.previousElementSibling.textContent.length * 20 + 190 : 360, function () { var r = R(a); go(r.left - 8, r.bottom + 4, 130); type(a, 20); });
    });
    step(links[links.length - 1].textContent.length * 20 + 280, function () { say('<span>Gap</span><b>6</b>', box); });
    step(400, function () { chip.lastChild.textContent = '32'; chip.classList.add('flip'); box.style.transition = 'gap .6s cubic-bezier(.22,1,.36,1)'; box.style.gap = ''; });
    step(620, function () { chip.classList.remove('on', 'flip'); var r = R(login); go(r.left + 2, r.bottom - 2, 340); });
    step(360, function () { type(login, 28); });
    step(380, function () { var r = R(btn); go(r.left, r.top, 300); });
    step(320, function () {                                           /* drag the button out as a box */
      var r = R(btn);
      cur.classList.add('down');
      put(rect, r.left, r.top, 0, 0); rect.getBoundingClientRect(); rect.classList.add('on');
      rect.style.transitionDuration = '.25s,.42s,.42s'; put(rect, r.left, r.top, r.width, r.height); go(r.right, r.bottom, 420);
    });
    step(460, function () {
      cur.classList.remove('down'); rect.classList.remove('on');
      btn.style.transition = 'background-color .45s,color .3s,box-shadow .45s,border-radius .5s cubic-bezier(.22,1,.36,1)';
      type(btn, 26);
    });
    step(460, function () { say('<span>Radius</span><b>6</b>', btn); });
    step(380, function () { chip.lastChild.textContent = '999'; chip.classList.add('flip'); btn.style.setProperty('border-radius', '999px', 'important'); });
    step(520, function () { chip.classList.remove('flip'); chip.innerHTML = '<span>Fill</span><u style="--k:#fff" class="sel"></u>'; btn.classList.remove('nb-ghost'); btn.style.removeProperty('border-radius'); });
    step(620, function () { chip.classList.remove('on'); frame.classList.remove('on'); cur.style.opacity = 0; go(B.right + 10, B.bottom + 50, 500); });
    step(520, end);
    }
  })();

  /* ---------- questions: the list keeps the height of its tallest answer, so opening one never moves the page below ---------- */
  var faq = $('#faq .pin-host');
  if (faq) {
    var faqFit = function () {
      var ds = $$('details.acc', faq), was = ds.map(function (x) { return x.open; });
      if (!ds.length) return;
      faq.style.minHeight = '';
      ds.forEach(function (x) { x.open = true; });
      var all = faq.offsetHeight, hs = ds.map(function (x) { return $('.acc-body', x).offsetHeight; });
      ds.forEach(function (x, i) { x.open = was[i]; });
      faq.style.minHeight = (all - hs.reduce(function (a, b) { return a + b; }, 0) + Math.max.apply(0, hs)) + 'px';
    };
    faqFit();
    w.addEventListener('resize', faqFit);
    if (d.fonts && d.fonts.ready) d.fonts.ready.then(faqFit);
  }

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

/* phone loops: play only while on screen; with reduced motion the poster stays and nothing plays */
(function () {
  var vids = [].slice.call(document.querySelectorAll('video.scr-loop'));
  if (!vids.length) return;
  var still = window.matchMedia('(prefers-reduced-motion: reduce)'), seen = new WeakSet();
  function set(v) {
    if (!still.matches && seen.has(v) && !document.hidden) { v.playbackRate = 1.35; var p = v.play(); if (p) p.catch(function () {}); }
    else if (!v.paused) v.pause();
  }
  function all() { vids.forEach(function (v) { if (still.matches) { v.removeAttribute('autoplay'); v.pause(); if (v.currentTime) v.load(); } set(v); }); }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) seen.add(e.target); else seen.delete(e.target); set(e.target); });
    }, { rootMargin: '200px' });
    vids.forEach(function (v) { io.observe(v); });
  } else vids.forEach(function (v) { seen.add(v); });
  all();
  if (still.addEventListener) still.addEventListener('change', all);
  document.addEventListener('visibilitychange', all);
})();
