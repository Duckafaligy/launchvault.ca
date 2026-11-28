/* LaunchVault homepage: two pinned "scroll to explore" sections ([data-scrollstory]), scale.com style.
   The section sticks while the scroll drives it (scroll position = progress), then lets go. Once something is shown it stays shown:
   each section keeps the furthest progress it reached. The pin space itself is CSS (html.js + motion allowed, see scrollstory.css),
   so it exists before first paint; this script only sets progress and loads the How-it-works media near its step. */
(function () {
  'use strict';
  var d = document, w = window, html = d.documentElement;
  var secs = [].slice.call(d.querySelectorAll('[data-scrollstory]'));
  if (!secs.length) return;
  /* the build-on-load layers (home.js data-build) would hide these parts until "built"; the scroll owns them here */
  secs.forEach(function (s) { [].forEach.call(s.querySelectorAll('[data-build]'), function (el) { el.removeAttribute('data-build'); }); });
  var mq = w.matchMedia('(prefers-reduced-motion: reduce)');
  var poster = function (img) { if (img && !img.src && img.dataset.src) img.src = img.dataset.src; };
  var posters = [].slice.call(d.querySelectorAll('.hw-post'));
  if (mq.matches || !('IntersectionObserver' in w)) { posters.forEach(poster); return; }   /* static layout: all four posters (they stay loading="lazy") */

  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var seg = function (m, a, b) { return clamp((m - a) / (b - a), 0, 1); };
  var out3 = function (t) { return 1 - Math.pow(1 - t, 3); };

  /* ---------- geometry: pin length = the CSS spacer; sticky top keeps content taller than the screen reachable ---------- */
  function navH() { return parseFloat(getComputedStyle(html).getPropertyValue('--nav-h')) || 60; }
  function layout(st) {
    var vh = w.innerHeight, nh = navH(), h = st.stick.offsetHeight;
    st.len = Math.max(1, st.spacer.offsetHeight);
    st.top = h <= vh - nh + 1 ? nh : Math.round(vh - h - 16);     /* taller than the screen: scroll to its bottom, then pin */
    st.el.style.setProperty('--ss-top', st.top + 'px');
  }
  function progress(st) { return (st.top - st.track.getBoundingClientRect().top) / st.len; }

  /* ---------- 1. the big number: count, sentence, card, line ---------- */
  function bignum(el) {
    var num = el.querySelector('.num'), cap = el.querySelector('.num-cap'), host = el.querySelector('.cp-host'), ch = el.querySelector('.bigch');
    var full = num.textContent.trim(), to = parseFloat(full.replace(/[^\d.]/g, '')), pre = full.match(/^[^\d]*/)[0];
    num.setAttribute('aria-hidden', 'true');
    num.insertAdjacentHTML('afterend', '<span class="sr-only">' + full + '</span>');
    var lines = cap.textContent.trim().match(/[^.]+\.(\s|$)/g) || [cap.textContent];
    cap.innerHTML = lines.map(function (s) { return '<span class="ss-l">' + s.trim() + '</span>'; }).join(' ');
    var ls = [].slice.call(cap.children), last = -1;
    return function (m) {
      if (m === last) return; last = m;
      var c = out3(seg(m, 0, 0.3));
      num.textContent = pre + Math.round(to * c).toLocaleString('en-US');
      ls.forEach(function (l, i) { l.style.opacity = out3(seg(m, 0.16 + i * 0.08, 0.28 + i * 0.08)).toFixed(3); });   /* inline, so the sentence keeps its natural wrap */
      var r = out3(seg(m, 0.32, 0.5));
      host.style.opacity = r.toFixed(3); host.style.transform = r < 1 ? 'translate3d(0,' + ((1 - r) * 64).toFixed(1) + 'px,0)' : '';
      var dr = seg(m, 0.42, 0.94);                 /* linear: the scroll is the easing */
      ch.style.setProperty('--ss-draw', dr.toFixed(4));
      el.classList.toggle('ss-drawing', dr < 1);
    };
  }

  /* ---------- 2. How it works: four steps, one phone; only the near step's poster + video load, only the current one plays ---------- */
  function how(el) {
    var items = [].slice.call(el.querySelectorAll('.hw-i')), bars = [].slice.call(el.querySelectorAll('.hw-bars i')), n = el.querySelector('.hw-n');
    var vids = items.map(function (it) { return it.querySelector('video'); }), posts = items.map(function (it) { return it.querySelector('.hw-post'); });
    var cur = 0, near = false;
    function load(i) {
      poster(posts[i]);
      var v = vids[i]; if (!v || v._ss) return;
      v._ss = 1;
      [].forEach.call(v.querySelectorAll('source[data-src]'), function (s) { s.src = s.dataset.src; });
      v.addEventListener('playing', function () { v.classList.add('is-on'); });
      v.load();
    }
    function play() {
      if (near) { load(cur); if (cur + 1 < vids.length) load(cur + 1); }     /* the current step, and warm up the next one only */
      vids.forEach(function (v, i) {
        if (i === cur && near && !d.hidden) { v.playbackRate = 1.35; var p = v.play(); if (p) p.catch(function () {}); }
        else if (!v.paused) v.pause();
      });
    }
    new IntersectionObserver(function (es) { near = es[0].isIntersecting; play(); }, { rootMargin: '50% 0px' }).observe(el);
    d.addEventListener('visibilitychange', play);
    return function (m, p) {
      var k = items.length, step = clamp(Math.floor(clamp(p, 0, 0.9999) * k), 0, k - 1);
      items.forEach(function (it, i) {
        it.style.setProperty('--fill', clamp(m * k - i, 0, 1).toFixed(3));     /* the blue bar fills with the scroll and never empties */
        it.classList.toggle('is-seen', m * k > i);
        it.classList.toggle('is-cur', i === step);
        it.querySelector('.ip').setAttribute('aria-hidden', i === step ? 'false' : 'true');
        if (i === step) it.querySelector('figcaption').setAttribute('aria-current', 'step'); else it.querySelector('figcaption').removeAttribute('aria-current');
        if (bars[i]) { bars[i].classList.toggle('is-cur', i === step); bars[i].classList.toggle('is-seen', m * k > i); }
      });
      if (step !== cur) { cur = step; if (n) n.textContent = 'Step ' + (step + 1) + ' of ' + k; play(); }
    };
  }

  var all = secs.map(function (el) {
    var st = { el: el, track: el.querySelector('.ss-track'), stick: el.querySelector('.ss-stick'), spacer: el.querySelector('.ss-spacer'), m: 0, len: 1, top: 0 };
    st.draw = el.dataset.scrollstory === 'how' ? how(el) : bignum(el);
    return st;
  });

  /* ---------- one rAF per scroll event (the page scrolls natively; the smooth anchor scroll fires real scroll events) ---------- */
  var queued = false;
  function frame() {
    queued = false;
    all.forEach(function (st) {
      var p = progress(st);
      st.m = Math.max(st.m, clamp(p, 0, 1));
      st.draw(st.m, p);
    });
  }
  function kick() { if (!queued) { queued = true; requestAnimationFrame(frame); } }
  function relayout() { all.forEach(layout); kick(); }
  w.addEventListener('scroll', kick, { passive: true });
  w.addEventListener('resize', relayout);
  if (d.fonts && d.fonts.ready) d.fonts.ready.then(relayout);
  w.addEventListener('load', relayout);
  relayout();
  frame();

  /* pins inside these sections: if the reveal system skips them, show them once the section has played */
  (function check() {
    var left = 0;
    all.forEach(function (st) {
      [].forEach.call(st.el.querySelectorAll('.pin:not(.in)'), function (p) {
        left++;
        if (st.m >= 1 && !p._ssT) p._ssT = setTimeout(function () { if (!p.classList.contains('typing')) p.classList.add('in'); }, 5000);
      });
    });
    if (left) setTimeout(check, 1000);
  })();

  /* reduced motion switched on mid-visit: the CSS drops the pin; show everything finished */
  if (mq.addEventListener) mq.addEventListener('change', function (e) {
    if (!e.matches) return;
    all.forEach(function (st) { st.m = 1; st.draw(1, 1); });
    [].forEach.call(d.querySelectorAll('[data-scrollstory] .ss-l,[data-scrollstory] .cp-host'), function (x) { x.style.opacity = ''; x.style.transform = ''; });
    posters.forEach(poster);
    vids().forEach(function (v) { v.pause(); });
  });
  function vids() { return [].slice.call(d.querySelectorAll('.hw-vid')); }
})();
