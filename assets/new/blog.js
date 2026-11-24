/* LaunchVault /new/blog/ — index filter + post behaviours. No dependencies; sits on top of assets/new/motion.js (LV).
   Markup comes from build_new_blog.py. Everything here is optional: the pages read fine without it. */
(function () {
  'use strict';
  var d = document, w = window;
  var reduced = w.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var EASE = 'cubic-bezier(.22,1,.36,1)';
  var $ = function (s, r) { return (r || d).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var money = function (v) { return '$' + Math.round(v).toLocaleString('en-US'); };
  var onScroll = [], ticking = false;
  function tick() { ticking = false; onScroll.forEach(function (f) { f(); }); }
  function kick() { if (!ticking) { ticking = true; requestAnimationFrame(tick); } }

  /* ---------- images: shimmer until loaded ---------- */
  $$('.cov img').forEach(function (img) {
    if (img.complete) return;
    var c = img.parentNode, done = function () { c.classList.remove('skel'); };
    c.classList.add('skel');
    img.addEventListener('load', done); img.addEventListener('error', done);
  });

  /* ---------- index: filter pills (FLIP), featured image parallax ---------- */
  function index() {
    var seg = $('[data-filter]');
    if (!seg) return;
    var items = $$('[data-kind]');
    function apply(kind, animate) {
      var first = animate && !reduced && items[0].animate ? items.map(function (c) { return c.hidden ? null : c.getBoundingClientRect(); }) : null;
      items.forEach(function (c) { c.hidden = kind !== 'all' && c.dataset.kind !== kind; });
      if (!first) return;
      items.forEach(function (c, i) {
        if (c.hidden) return;
        var a = first[i], b = c.getBoundingClientRect();
        if (!a) c.animate([{ opacity: 0, transform: 'scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 450, easing: EASE });
        else if (a.left !== b.left || a.top !== b.top) c.animate([{ transform: 'translate(' + (a.left - b.left) + 'px,' + (a.top - b.top) + 'px)' }, { transform: 'none' }], { duration: 600, easing: EASE });
      });
    }
    seg.addEventListener('lv:change', function (e) {
      var kind = e.detail.value;
      apply(kind, true);
      try { history.replaceState(null, '', kind === 'all' ? location.pathname : '#' + kind + 's'); } catch (err) {}
    });
    var want = $('.seg-i[data-value="' + location.hash.slice(1).replace(/s$/, '') + '"]', seg);   /* /new/blog/#guides, #breakdowns */
    if (want && want.dataset.value !== 'all') want.click();

    var img = $('.feat .cov img');
    if (img && !reduced) {
      onScroll.push(function () {
        var r = img.parentNode.getBoundingClientRect();
        if (r.bottom < 0 || r.top > w.innerHeight) return;
        img.style.transform = 'translateY(' + ((r.top + r.height / 2 - w.innerHeight / 2) / w.innerHeight * -22).toFixed(1) + 'px) scale(1.08)';
      });
    }
  }

  /* ---------- post: reading progress, contents list, phases line ---------- */
  function post() {
    var art = $('.post');
    if (!art) return;
    var bar = $('.readbar i'), tocBar = $('.toc-bar i'), pct = $('[data-pct]');
    var toc = $('.toc'), links = $$('.toc a'), ind = $('.toc-ind');
    var secs = links.map(function (a) { return d.getElementById(a.getAttribute('href').slice(1)); });
    var narrow = w.matchMedia('(max-width:1099px)'), active = -1;

    if (toc) {
      toc.classList.add('has-ind');
      var sync = function () { toc.open = !narrow.matches; place(); };
      narrow.addEventListener('change', sync);
      toc.addEventListener('toggle', function () { place(); });
      links.forEach(function (a) { a.addEventListener('click', function () { if (narrow.matches) toc.open = false; }); });
      toc.open = !narrow.matches;
    }
    function place() {
      var a = links[active];
      if (!ind || !a || !toc.open) { if (ind) ind.style.opacity = 0; return; }
      ind.style.opacity = 1; ind.style.height = a.offsetHeight + 'px'; ind.style.transform = 'translateY(' + a.offsetTop + 'px)';
    }
    function progress() {
      var r = art.getBoundingClientRect();
      var p = clamp(-r.top / Math.max(1, r.height - w.innerHeight * 0.6), 0, 1);
      if (bar) bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
      if (tocBar) tocBar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
      if (pct) pct.textContent = Math.round(p * 100) + '% read';
      var cur = 0;
      secs.forEach(function (s, i) { if (s && s.getBoundingClientRect().top < 160) cur = i; });
      if (cur !== active) {
        active = cur;
        links.forEach(function (a, i) { if (i === cur) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
        place();
      }
    }
    onScroll.push(progress);
    if (d.fonts && d.fonts.ready) d.fonts.ready.then(place);

    /* phases: the line draws down as you scroll, dots light up as it passes */
    var wrap = $('.phases-w'), fill = $('.ph-fill');
    if (wrap && fill && !reduced) {
      var phs = $$('.ph', wrap);
      onScroll.push(function () {
        var max = phs[phs.length - 1].offsetTop;
        var h = clamp(w.innerHeight * 0.62 - wrap.getBoundingClientRect().top - 24, 0, max);
        fill.style.height = max + 'px';
        fill.style.transform = 'scaleY(' + (max ? h / max : 0).toFixed(4) + ')';
        phs.forEach(function (li) { li.classList.toggle('on', li.offsetTop <= h + 1); });
      });
    }
  }

  /* ---------- post: checklist ticks, saved in localStorage under the app's key (lv-<slug>-checks = [true,false,…]) ---------- */
  function checklist() {
    var cl = $('[data-checks]');
    if (!cl) return;
    var key = cl.dataset.checks, boxes = $$('input', cl), out = $('[data-done]', cl), saved = [];
    var allowed = function () { try { var c = JSON.parse(localStorage.getItem('lv-consent')); return !c || c.preferences !== false; } catch (e) { return true; } };
    try { saved = JSON.parse(localStorage.getItem(key)) || []; } catch (e) {}
    function count() { if (out) out.textContent = boxes.filter(function (b) { return b.checked; }).length + ' of ' + boxes.length + ' done'; }
    boxes.forEach(function (b, i) {
      b.checked = !!saved[i];
      b.addEventListener('change', function () {
        if (allowed()) try { localStorage.setItem(key, JSON.stringify(boxes.map(function (x) { return x.checked; }))); } catch (e) {}
        count();
        if (w.LV && boxes.every(function (x) { return x.checked; })) LV.toast('All ' + boxes.length + ' done. Nice work.', { type: 'ok' });
      });
    });
    count();
  }

  /* ---------- post: copy link ---------- */
  function copy() {
    $$('[data-copy]').forEach(function (b) {
      var t;
      b.addEventListener('click', function () {
        var url = b.dataset.copy, ok = function () {
          b.classList.add('is-copied'); b.setAttribute('aria-label', 'Link copied');
          clearTimeout(t); t = setTimeout(function () { b.classList.remove('is-copied'); b.setAttribute('aria-label', 'Copy link'); }, 2200);
        };
        var fail = function () { if (w.LV) LV.toast('Could not copy. Copy the address from your browser bar instead.', { type: 'error' }); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(ok, fail); else fail();
      });
    });
  }

  /* ---------- post: revenue chart (the default view is already in the HTML; this adds crosshair, ranges, draw-in) ----------
     data-chart = {"p":[[label, value, pointLabel, t], …]}  t = month index, so gaps in a series keep their width. */
  function charts() {
    $$('[data-chart]').forEach(function (fig) {
      var all = JSON.parse(fig.dataset.chart).p, cur = all, geo;
      var plot = $('.plot', fig), svg = $('svg', plot), line = $('.line', svg), area = $('.area', svg), base = $('.base', svg);
      var end = $('.pt-end', plot), xh = $('.xh', plot), xd = $('.xd', plot), tip = $('.tip', plot), xl = $('.xl', fig);
      var big = $('.chart-v', fig), delta = $('.chart-d', fig), W = 600, H = 260, PAD = 25.2, at = -1;

      function layout(pts) {
        var vs = pts.map(function (p) { return p[1]; }), mn = Math.min.apply(0, vs), mx = Math.max.apply(0, vs);
        var t0 = pts[0][3], t1 = pts[pts.length - 1][3];
        return pts.map(function (p) {
          return { x: t1 === t0 ? W : (p[3] - t0) / (t1 - t0) * W, y: mx === mn ? H / 2 : PAD + (mx - p[1]) / (mx - mn) * (H - 2 * PAD), p: p };
        });
      }
      function render(pts) {
        cur = pts; geo = layout(pts); hide();
        var path = geo.map(function (g, i) { return (i ? 'L' : 'M') + g.x.toFixed(1) + ' ' + g.y.toFixed(1); }).join(' ');
        var last = geo[geo.length - 1], first = pts[0], peak = pts.reduce(function (a, b) { return b[1] > a[1] ? b : a; });
        line.setAttribute('d', path); area.setAttribute('d', path + ' L' + W + ' ' + H + ' L0 ' + H + ' Z');
        base.setAttribute('y1', geo[0].y.toFixed(1)); base.setAttribute('y2', geo[0].y.toFixed(1));
        end.style.left = '100%'; end.style.top = (last.y / H * 100).toFixed(2) + '%';
        var ref = peak !== last.p && last.p[1] < peak[1] ? peak : first, ch = (last.p[1] - ref[1]) / ref[1] * 100;
        big.textContent = money(last.p[1]);
        delta.textContent = (ch < 0 ? '−' : '+') + Math.abs(ch).toFixed(1) + '% since ' + ref[0];
        xl.innerHTML = '';
        pts.forEach(function (p) { var s = d.createElement('span'); s.textContent = p[0].split(' ')[0]; xl.appendChild(s); });
        if (!reduced) { plot.classList.remove('drawn'); void plot.offsetWidth; plot.classList.add('drawn'); }
      }
      function show(i) {
        if (i === at) return;
        at = i; var g = geo[i], r = plot.clientWidth, x = g.x / W * r;
        xh.hidden = xd.hidden = tip.hidden = false;
        xh.style.left = x + 'px'; xd.style.left = x + 'px'; xd.style.top = (g.y / H * 100) + '%';
        tip.firstChild.textContent = g.p[0] + (g.p[2] ? ' · ' + g.p[2] : '');
        tip.lastChild.textContent = money(g.p[1]);
        tip.style.left = clamp(x - 84, 0, Math.max(0, r - 168)) + 'px';
      }
      function hide() { at = -1; xh.hidden = xd.hidden = tip.hidden = true; }
      function nearest(clientX) {
        var r = plot.getBoundingClientRect(), x = (clientX - r.left) / r.width * W, best = 0;
        geo.forEach(function (g, i) { if (Math.abs(g.x - x) < Math.abs(geo[best].x - x)) best = i; });
        return best;
      }
      geo = layout(cur = initial());
      function initial() { var on = $('.seg-i[aria-pressed=true]', fig), n = on ? +on.dataset.value : 0; return n ? all.slice(-n) : all; }

      plot.addEventListener('pointermove', function (e) { show(nearest(e.clientX)); });
      plot.addEventListener('pointerdown', function (e) { show(nearest(e.clientX)); });
      plot.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') hide(); });
      plot.addEventListener('focus', function () { if (at < 0) show(geo.length - 1); });
      plot.addEventListener('blur', hide);
      plot.addEventListener('keydown', function (e) {
        var k = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
        if (e.key === 'Escape') return hide();
        if (!k) return;
        e.preventDefault(); show(clamp((at < 0 ? geo.length - 1 : at) + k, 0, geo.length - 1));
      });
      fig.addEventListener('lv:change', function (e) { var n = +e.detail.value; render(n ? all.slice(-n) : all); });

      if (reduced || !('IntersectionObserver' in w)) return plot.classList.add('drawn');
      var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); plot.classList.add('drawn'); } }, { threshold: 0.35 });
      io.observe(plot);
    });
  }

  function start() {
    index(); post(); checklist(); copy(); charts();
    if (onScroll.length) { w.addEventListener('scroll', kick, { passive: true }); w.addEventListener('resize', kick); tick(); }
  }
  /* registered after motion.js's own DOMContentLoaded handler, so LV has already set up tabs and reveals */
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start); else start();
})();
