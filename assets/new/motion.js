/* LaunchVault /new/ — the one shared motion system. No dependencies. Load with <script defer>.
   Everything here is driven by markup (classes / data attributes); see src/new/README.md.
   Public API: LV.init(root) re-scans injected markup, LV.toast(msg, {type, ms}), LV.reduced. */
(function () {
  'use strict';
  var d = document, html = d.documentElement, w = window;
  var mqReduce = w.matchMedia('(prefers-reduced-motion: reduce)');
  var reduced = mqReduce.matches;
  var fine = w.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var $$ = function (s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); };
  var EASE = 'cubic-bezier(.22,1,.36,1)';
  var ARROW_NE = '<svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 7.5l5-5M3.5 2.5h4v4"/></svg>';

  /* ---------- scroll reveals: [data-reveal] [data-reveal=words] [data-stagger] [data-count] [data-draw] .pin ---------- */
  var io = 'IntersectionObserver' in w ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); enter(e.target); } });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }) : null;

  function enter(el) {
    if (el._lvCount) runCount(el);
    if (el._lvDraw) el._lvDraw.forEach(function (p) { p.style.strokeDashoffset = 0; });
    if (el.classList.contains('pin')) return runPin(el);
    el.classList.add('in');
    if (el.hasAttribute('data-stagger')) setTimeout(function () { el.classList.add('done'); }, 80 * el.children.length + 900);
  }

  function splitWords(el) {
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    var i = 0;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = d.createDocumentFragment();
          n.data.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) return frag.appendChild(d.createTextNode(' '));
            var s = d.createElement('span');
            s.className = 'w'; s.style.setProperty('--i', i++); s.setAttribute('aria-hidden', 'true'); s.textContent = part;
            frag.appendChild(s);
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1 && n.tagName !== 'SVG') walk(n);
      });
    })(el);
  }

  function prepCount(el) {
    var full = el.textContent, m = full.match(/\d[\d,]*(\.\d+)?/);
    if (!m) return;
    var dec = m[1] ? m[1].length - 1 : 0;
    el._lvCount = { full: full, num: m[0], to: parseFloat(m[0].replace(/,/g, '')), dec: dec };
    el.setAttribute('aria-label', full);
    el.textContent = full.replace(m[0], fmt(0, dec));
  }
  function fmt(v, dec) { return v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }); }
  function runCount(el) {
    var c = el._lvCount, t0 = performance.now(), dur = 1200;
    (function tick(now) {
      var p = Math.min(1, (now - t0) / dur), e = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      el.textContent = c.full.replace(c.num, fmt(c.to * e, c.dec));
      if (p < 1) requestAnimationFrame(tick); else el.textContent = c.full;
    })(t0);
  }

  function prepDraw(el) {
    var sel = 'path,polyline,line';
    var list = (el.matches(sel) ? [el] : $$(sel, el)).filter(function (p) {
      return p.getTotalLength && (p === el || p.getAttribute('fill') === 'none' || p.tagName === 'line');
    });
    list.forEach(function (p) {
      var len = Math.ceil(p.getTotalLength()) + 1;
      p.style.strokeDasharray = len; p.style.strokeDashoffset = len;
      p.getBoundingClientRect(); p.classList.add('lv-d');
    });
    el._lvDraw = list;
  }

  /* comment pins: logo pops, text types with a caret (28ms a letter), then the link lights up */
  function prepPin(el) {
    var t = el.querySelector('.pin-t'), b = t && t.querySelector('b');
    if (!b) return;
    var label = t.textContent.replace(/\s+/g, ' ').trim();
    el.setAttribute('aria-label', label + ' (opens in a new tab)');
    if (!el.title) el.title = 'Open ' + b.textContent.trim() + ' in a new tab';
    el._lvPin = { t: t, b: b, pre: t.firstChild && t.firstChild.nodeType === 3 ? t.firstChild.data : '', dom: b.textContent,
      post: b.nextSibling && b.nextSibling.nodeType === 3 ? b.nextSibling.data : '' };   /* optional words after the domain ("… rules") */
    b.insertAdjacentHTML('beforeend', ARROW_NE);
  }
  /* a coloured cursor glides to the pin's corner and clicks; the bubble pops out of the click, the words type, the logo pops in last */
  var CUR = '<svg viewBox="0 0 20 22" width="20" height="22"><path d="M4 3.2 C4 2.2 5.1 1.6 6 2.2 L17.2 9.9 C18.1 10.5 17.8 11.9 16.7 12.1 L11.6 13 L9.2 17.6 C8.7 18.6 7.2 18.4 7 17.3 Z"/></svg>';
  var CUR_COL = ['#FF4D1F', '#00C27A', '#7B5CFF', '#FF5FA2'], pinN = 0, pinAt = 0;
  function runPin(el) {
    var p = el._lvPin;
    if (!p || reduced) return el.classList.add('in');
    var now = performance.now(), wait = Math.max(0, pinAt - now);   /* pins that show up together take turns */
    pinAt = now + wait + 420;
    setTimeout(function () { placePin(el, p); }, wait);
  }
  function placePin(el, p) {
    var host = el.offsetParent || d.body, c = el.dataset.c || 'bl';
    var cur = d.createElement('span');
    cur.className = 'lv-cur pin-cur'; cur.setAttribute('aria-hidden', 'true'); cur.innerHTML = '<i></i>' + CUR;
    cur.style.setProperty('--c', CUR_COL[pinN++ % CUR_COL.length]);
    cur.style.left = el.offsetLeft + (c[1] === 'r' ? el.offsetWidth : 0) + 'px';
    cur.style.top = el.offsetTop + (c[0] === 'b' ? el.offsetHeight : 0) + 'px';
    var r = el.getBoundingClientRect();                              /* comes in from the middle of the page, so it never widens it */
    cur.style.setProperty('--fx', ((c[1] === 'r' ? r.right : r.left) > w.innerWidth / 2 ? -110 : 110) + 'px');
    host.appendChild(cur);
    cur.getBoundingClientRect(); cur.classList.add('go');
    setTimeout(function () {
      var txt = d.createTextNode(''), dom = d.createTextNode(''), post = d.createTextNode(''), arrow = p.b.querySelector('svg');
      var caret = d.createElement('span'); caret.className = 'pin-caret';
      p.t.textContent = ''; p.b.textContent = '';
      p.t.appendChild(txt); p.t.appendChild(p.b); p.b.appendChild(dom); p.t.appendChild(post); p.t.appendChild(caret);
      cur.classList.add('click');
      el.classList.add('in', 'pop', 'typing');
      var i = 0, all = p.pre.length + p.dom.length + p.post.length;
      setTimeout(function () {
        var iv = setInterval(function () {
          i++;
          txt.data = p.pre.slice(0, i);
          dom.data = p.dom.slice(0, Math.max(0, i - p.pre.length));
          post.data = p.post.slice(0, Math.max(0, i - p.pre.length - p.dom.length));
          if (i >= all) {
            clearInterval(iv); caret.remove();
            if (arrow) p.b.appendChild(arrow);
            el.classList.remove('typing', 'pop'); el.classList.add('lit');
            cur.classList.add('out');
            setTimeout(function () { cur.remove(); }, 600);
          }
        }, 24);
      }, 260);
    }, 540);
  }

  /* ---------- tabs / segmented with a sliding indicator: [data-tabs] > .seg-i ---------- */
  function prepTabs(el) {
    var items = $$('.seg-i', el);
    if (!items.length || el._lvTabs) return;
    el._lvTabs = 1;
    var ind = d.createElement('span');
    ind.className = 'seg-ind no-anim'; ind.setAttribute('aria-hidden', 'true');
    el.insertBefore(ind, el.firstChild); el.classList.add('has-ind');
    var isSel = function (i) { return i.matches('[aria-selected=true],[aria-current],[aria-pressed=true]'); };
    var place = function () {
      var s = items.filter(isSel)[0];
      if (!s) { ind.style.width = 0; return; }
      ind.style.width = s.offsetWidth + 'px'; ind.style.height = s.offsetHeight + 'px';
      ind.style.transform = 'translate(' + s.offsetLeft + 'px,' + s.offsetTop + 'px)';
    };
    var select = function (it, focus) {
      items.forEach(function (i) {
        var on = i === it;
        if (i.getAttribute('role') === 'tab') {
          i.setAttribute('aria-selected', on); i.tabIndex = on ? 0 : -1;
          var panel = d.getElementById(i.getAttribute('aria-controls') || '');
          if (panel) panel.hidden = !on;
        } else i.setAttribute('aria-pressed', on);
      });
      place();
      if (focus) it.focus();
      el.dispatchEvent(new CustomEvent('lv:change', { bubbles: true, detail: { value: it.dataset.value || it.textContent.trim(), item: it } }));
    };
    items.forEach(function (it, n) {
      if (it.tagName === 'A') return;                       /* links navigate; the indicator just marks aria-current */
      if (it.getAttribute('role') === 'tab') it.tabIndex = isSel(it) ? 0 : -1;
      it.addEventListener('click', function () { select(it); });
      it.addEventListener('keydown', function (e) {
        var k = { ArrowRight: 1, ArrowLeft: -1, Home: -n, End: items.length - 1 - n }[e.key];
        if (k === undefined) return;
        e.preventDefault(); select(items[(n + k + items.length) % items.length], true);
      });
    });
    place();
    requestAnimationFrame(function () { requestAnimationFrame(function () { ind.classList.remove('no-anim'); }); });
    w.addEventListener('resize', function () { ind.classList.add('no-anim'); place(); requestAnimationFrame(function () { ind.classList.remove('no-anim'); }); });
    if (d.fonts && d.fonts.ready) d.fonts.ready.then(place);
  }

  /* ---------- accordion: <details class="acc" data-acc="group"><summary>…</summary><div class="acc-body"><div>…</div></div></details> ---------- */
  function prepAcc(det) {
    var sum = det.querySelector('summary'), body = det.querySelector('.acc-body');
    if (!sum || !body || det._lvAcc) return;
    det._lvAcc = { anim: null, closing: false };
    sum.addEventListener('click', function (e) { e.preventDefault(); setAcc(det, !det.open || det._lvAcc.closing); });
    if (fine && det.closest('[data-acc-hover]')) det.addEventListener('mouseenter', function () { setAcc(det, true); });
  }
  function setAcc(det, open) {
    var st = det._lvAcc, body = det.querySelector('.acc-body');
    if (open === (det.open && !st.closing)) return;
    if (open && det.dataset.acc) $$('details[data-acc="' + det.dataset.acc + '"]').forEach(function (o) { if (o !== det && o._lvAcc) setAcc(o, false); });
    if (reduced || !body.animate) { det.open = open; return; }
    var from = det.open ? body.offsetHeight : 0;
    if (st.anim) st.anim.cancel();
    if (open) det.open = true;
    st.closing = !open;
    st.anim = body.animate({ height: [from + 'px', (open ? body.scrollHeight : 0) + 'px'] }, { duration: 320, easing: EASE });
    st.anim.onfinish = function () { if (!open) det.open = false; st.closing = false; st.anim = null; };
  }

  /* ---------- toast ---------- */
  var toasts;
  function toast(msg, o) {
    o = o || {};
    if (!toasts) { toasts = d.createElement('div'); toasts.className = 'toasts'; toasts.setAttribute('role', 'status'); toasts.setAttribute('aria-live', 'polite'); d.body.appendChild(toasts); }
    var t = d.createElement('div');
    t.className = 'toast' + (o.type ? ' toast-' + o.type : ''); t.textContent = msg;
    toasts.appendChild(t);
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 260); }, o.ms || 3200);
    return t;
  }

  /* ---------- init (safe to call again on injected markup) ---------- */
  function init(root) {
    root = root || d;
    $$('[data-tabs]', root).forEach(prepTabs);
    $$('details[data-acc]', root).forEach(prepAcc);
    $$('.pin', root).forEach(function (el) { if (!el._lvPin) prepPin(el); });
    var els = $$('[data-reveal],[data-stagger],[data-count],[data-draw],.pin', root).filter(function (el) { return !el._lvSeen; });
    els.forEach(function (el) {
      el._lvSeen = 1;
      if (el.hasAttribute('data-stagger')) Array.prototype.forEach.call(el.children, function (c, i) { c.style.setProperty('--i', i); });
      if (reduced || !io) return el.classList.add('in');
      if (el.getAttribute('data-reveal') === 'words') splitWords(el);
      if (el.hasAttribute('data-count')) prepCount(el);
      if (el.hasAttribute('data-draw')) prepDraw(el);
      io.observe(el);
    });
  }

  /* ---------- nav: full bar -> pill on scroll -> card (hover on fine pointers, click/tap everywhere, Esc closes) ---------- */
  function nav() {
    var el = d.querySelector('.nav'); if (!el) return;
    var shell = el.querySelector('.nav-shell'), btn = el.querySelector('.nav-menu'), card = el.querySelector('.nav-card');
    var narrow = w.matchMedia('(max-width:1099px)'), open = false, scrolled = false, openY = 0, timer;
    function sync() {
      if (open && !scrolled && !narrow.matches) open = false;
      el.classList.toggle('is-pill', scrolled || open);
      el.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', open);
      btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    }
    function set(v) { clearTimeout(timer); if (v === open) return; open = v; openY = w.scrollY; sync(); }
    function onScroll() {
      scrolled = w.scrollY > 40;
      if (open && Math.abs(w.scrollY - openY) > 80) open = false;
      sync();
    }
    btn.addEventListener('click', function () { set(!open); });
    if (fine) {
      shell.addEventListener('mouseenter', function () { clearTimeout(timer); if (el.classList.contains('is-pill')) set(true); });
      shell.addEventListener('mouseleave', function () { timer = setTimeout(function () { set(false); }, 220); });
    }
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && open) { var had = shell.contains(d.activeElement); set(false); if (had) btn.focus(); } });
    d.addEventListener('pointerdown', function (e) { if (open && !shell.contains(e.target)) set(false); });
    shell.addEventListener('focusout', function (e) { if (open && e.relatedTarget && !shell.contains(e.relatedTarget)) set(false); });
    card.addEventListener('click', function (e) { if (e.target.closest('a')) set(false); });
    w.addEventListener('scroll', onScroll, { passive: true });
    narrow.addEventListener('change', sync);
    onScroll();
  }

  /* ---------- custom cursor + magnetic buttons (fine pointers, motion allowed) ---------- */
  function cursor() {
    var dot = d.createElement('div'), ring = d.createElement('div'), lab = d.createElement('span');
    dot.className = 'cur'; ring.className = 'cur-ring'; ring.appendChild(lab);
    dot.setAttribute('aria-hidden', 'true'); ring.setAttribute('aria-hidden', 'true');
    d.body.appendChild(ring); d.body.appendChild(dot);
    var x = 0, y = 0, rx = 0, ry = 0, raf = 0, seen = false;
    function loop() {
      rx += (x - rx) * 0.2; ry += (y - ry) * 0.2;
      ring.style.transform = 'translate(' + rx.toFixed(1) + 'px,' + ry.toFixed(1) + 'px)';
      raf = Math.abs(x - rx) + Math.abs(y - ry) > 0.3 ? requestAnimationFrame(loop) : 0;   /* idles when settled */
    }
    d.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      x = e.clientX; y = e.clientY;
      if (!seen) { seen = true; rx = x; ry = y; }
      html.classList.add('cur-on');
      dot.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      if (!raf) raf = requestAnimationFrame(loop);
    }, { passive: true });
    d.addEventListener('pointerover', function (e) {
      var t = e.target.closest ? e.target : null; if (!t) return;
      var lb = t.closest('[data-cursor]'), field = t.closest('input,textarea,select');
      var hit = !field && t.closest('a,button,summary,label,[role=tab],[data-cursor]');
      var text = lb && lb.dataset.cursor;
      lab.textContent = text || '';
      ring.classList.toggle('is-label', !!text);
      dot.classList.toggle('is-label', !!text);
      ring.classList.toggle('is-hover', !!hit && !text);
    }, { passive: true });
    html.addEventListener('mouseleave', function () { html.classList.remove('cur-on'); });
    d.addEventListener('pointerdown', function () { ring.classList.add('is-down'); });
    d.addEventListener('pointerup', function () { ring.classList.remove('is-down'); });

    d.addEventListener('pointermove', function (e) {
      var b = e.target.closest && e.target.closest('.btn-primary,[data-magnetic]');
      if (magnet && magnet !== b) { magnet.style.setProperty('--mx', '0px'); magnet.style.setProperty('--my', '0px'); }
      magnet = b && !b.disabled ? b : null;
      if (!magnet) return;
      var r = magnet.getBoundingClientRect();
      magnet.style.setProperty('--mx', ((e.clientX - r.left - r.width / 2) * 0.16).toFixed(1) + 'px');
      magnet.style.setProperty('--my', ((e.clientY - r.top - r.height / 2) * 0.24).toFixed(1) + 'px');
    }, { passive: true });
  }
  var magnet = null;

  /* ---------- background: one soft band of dots winding down the whole page (port of bgpage.make2) ----------
     Fixed canvas; dots are pre-rendered into 512px tiles (cached, 5 max) so a frame is 2-3 drawImage calls.
     <body data-bg="off"> disables it, data-bg-dim=".75" dims it (legal pages). */
  function background() {
    var body = d.body;
    if (body.dataset.bg === 'off') return;
    var dim = parseFloat(body.dataset.bgDim) || 1;
    var cv = d.createElement('canvas'); cv.className = 'bg'; cv.setAttribute('aria-hidden', 'true');
    body.insertBefore(cv, body.firstChild);
    var ctx = cv.getContext('2d'), TILE = 512, PAR = 0.7;   /* band scrolls at 70% of the page: a slow parallax drift */
    var STOPS = [[123, 92, 255], [255, 77, 31], [255, 95, 162], [123, 92, 255]];
    var W, VH, dpr, band, hero, segs, tiles, lastY = -1, lastT = 0, raf = 0;

    function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
    function build() {
      W = w.innerWidth; VH = w.innerHeight; dpr = Math.min(w.devicePixelRatio || 1, 1.5);
      cv.width = Math.round(W * dpr); cv.height = Math.round(VH * dpr);
      band = Math.min(190, Math.round(W * 0.32)); hero = W >= 600 ? 700 : 560;
      var P, step;
      if (W >= 1200) { P = [[W + 80, 160], [W * .78, 480], [W * .45, 760], [W * .16, 1080]]; step = 1400; }
      else if (W >= 600) { P = [[W + 60, 420], [W * .7, 820], [W * .3, 1220], [W * .12, 1560]]; step = 1200; }
      else { P = [[W + 40, 180], [W * .6, 560], [W * .14, 1000]]; step = 1000; }
      for (var yy = P[P.length - 1][1], right = true; yy < 60000; right = !right) { yy += step; P.push([W * (right ? .86 : .14), yy]); }
      P.unshift(P[0]); P.push(P[P.length - 1]);
      var C = [], K = 24;
      for (var i = 1; i < P.length - 2; i++) for (var k = 0; k < K; k++) {
        var t = k / K, t2 = t * t, t3 = t2 * t, o = [];
        for (var a = 0; a < 2; a++) o[a] = .5 * (2 * P[i][a] + (-P[i - 1][a] + P[i + 1][a]) * t + (2 * P[i - 1][a] - 5 * P[i][a] + 4 * P[i + 1][a] - P[i + 2][a]) * t2 + (-P[i - 1][a] + 3 * P[i][a] - 3 * P[i + 1][a] + P[i + 2][a]) * t3);
        C.push(o);
      }
      segs = []; var s = 0;
      for (i = 0; i < C.length - 1; i++) {
        var dx = C[i + 1][0] - C[i][0], dy = C[i + 1][1] - C[i][1], len = Math.hypot(dx, dy) || 1e-6;
        segs.push({ x: C[i][0], y: C[i][1], dx: dx, dy: dy, len: len, s: s, y0: Math.min(C[i][1], C[i + 1][1]) - band * 1.2, y1: Math.max(C[i][1], C[i + 1][1]) + band * 1.2 });
        s += len;
      }
      tiles = new Map(); lastY = -1;
    }
    function colour(s) {
      var t = (s / 2000) % 3, i = t | 0, f = t - i, a = STOPS[i], b = STOPS[i + 1];
      return [a[0] + (b[0] - a[0]) * f | 0, a[1] + (b[1] - a[1]) * f | 0, a[2] + (b[2] - a[2]) * f | 0];
    }
    function tile(n) {
      var c = tiles.get(n);
      if (c) { tiles.delete(n); tiles.set(n, c); return c; }
      c = d.createElement('canvas'); c.width = cv.width; c.height = Math.round(TILE * dpr);
      var g = c.getContext('2d'), top = n * TILE, bot = top + TILE, dens = (W < 600 ? .09 : .11) * band;
      g.setTransform(dpr, 0, 0, dpr, 0, -top * dpr);
      g.globalCompositeOperation = 'lighter';
      segs.forEach(function (sg, idx) {             /* soft glow along the band */
        if (idx % 3 || sg.y1 < top - band || sg.y0 > bot + band) return;
        var col = colour(sg.s), R = band * 1.25, gr = g.createRadialGradient(sg.x, sg.y, 0, sg.x, sg.y, R);
        var a = (sg.y < hero ? .075 : .05) * dim;
        gr.addColorStop(0, 'rgba(' + col + ',' + a + ')'); gr.addColorStop(1, 'rgba(' + col + ',0)');
        g.fillStyle = gr; g.fillRect(sg.x - R, sg.y - R, 2 * R, 2 * R);
      });
      g.globalCompositeOperation = 'source-over';
      segs.forEach(function (sg, idx) {             /* the dots: seeded per segment, so tiles meet without a seam */
        if (sg.y1 < top || sg.y0 > bot) return;
        var r = rng(idx * 7919 + 7), n_ = Math.round(sg.len * dens), nx = -sg.dy / sg.len, ny = sg.dx / sg.len, col = colour(sg.s);
        for (var j = 0; j < n_; j++) {
          var f = r(), off = Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(6.2832 * r()) * band / 3, u = r();
          var px = sg.x + sg.dx * f + nx * off, py = sg.y + sg.dy * f + ny * off;
          if (py < top - 2 || py > bot) continue;
          var a = Math.pow(Math.max(0, 1 - Math.abs(off) / band), 1.5) * (.25 + .75 * u);
          a *= (.58 + .42 * Math.pow(Math.min(1, Math.max(0, (hero + 260 - py) / 620)), 1.6)) * dim;
          g.fillStyle = 'rgba(' + col + ',' + a.toFixed(2) + ')';
          g.fillRect(px | 0, py | 0, 2, 2);
        }
      });
      tiles.set(n, c);
      if (tiles.size > 5) tiles.delete(tiles.keys().next().value);
      return c;
    }
    /* the pointer: the band leans away from it, and a soft lens under it magnifies and brightens the dots */
    var mx = 0, my = 0, ex = 0, ey = 0, has = false, LENS = 170, lens, lg;
    function tilesTo(g, sx, sy) {
      for (var n = Math.max(0, Math.floor(sy / TILE)); n * TILE < sy + VH; n++) g.drawImage(tile(n), Math.round(sx * dpr), Math.round((n * TILE - sy) * dpr));
    }
    function draw(now) {
      var sy = w.scrollY * (reduced ? 1 : PAR), sx = 0;
      if (!reduced) { sx = Math.cos(now / 9000) * 10; sy += Math.sin(now / 7000) * 12 + 12; }
      if (has) { ex += (mx - ex) * 0.14; ey += (my - ey) * 0.14; sx += (ex / W - 0.5) * -28; sy += (ey / VH - 0.5) * -20 + 10; }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      tilesTo(ctx, sx, sy);
      if (!has) return;
      var S = Math.round(LENS * 2 * dpr), Z = 1.22;
      if (!lens || lens.width !== S) { lens = d.createElement('canvas'); lens.width = lens.height = S; lg = lens.getContext('2d'); }
      lg.setTransform(1, 0, 0, 1, 0, 0); lg.globalCompositeOperation = 'source-over'; lg.clearRect(0, 0, S, S);
      lg.setTransform(Z, 0, 0, Z, S / 2 - ex * dpr * Z, S / 2 - ey * dpr * Z);     /* the same picture, 22% bigger around the pointer */
      tilesTo(lg, sx, sy);
      lg.setTransform(1, 0, 0, 1, 0, 0); lg.globalCompositeOperation = 'destination-in';
      var m = lg.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
      m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(.45, 'rgba(0,0,0,.8)'); m.addColorStop(1, 'rgba(0,0,0,0)');
      lg.fillStyle = m; lg.fillRect(0, 0, S, S);
      ctx.globalCompositeOperation = 'lighter';
      var x0 = Math.round(ex * dpr - S / 2), y0 = Math.round(ey * dpr - S / 2);
      ctx.drawImage(lens, x0, y0); ctx.drawImage(lens, x0, y0);
      var gl = ctx.createRadialGradient(ex * dpr, ey * dpr, 0, ex * dpr, ey * dpr, S / 2);
      gl.addColorStop(0, 'rgba(255,77,31,' + (0.07 * dim) + ')'); gl.addColorStop(1, 'rgba(255,77,31,0)');
      ctx.fillStyle = gl; ctx.fillRect(x0, y0, S, S);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (fine) {
      d.addEventListener('pointermove', function (e) {
        if (e.pointerType !== 'mouse' || reduced) return;
        mx = e.clientX; my = e.clientY;
        if (!has) { has = true; ex = mx; ey = my; }
        kick();
      }, { passive: true });
      html.addEventListener('mouseleave', function () { has = false; lastY = -1; });
    }
    function frame(now) {
      raf = 0;
      if (w.scrollY !== lastY || now - lastT > 40 || (has && Math.abs(mx - ex) + Math.abs(my - ey) > 0.5)) { lastY = w.scrollY; lastT = now; draw(now); }
      if (!reduced && !d.hidden) raf = requestAnimationFrame(frame);     /* pauses in background tabs */
    }
    function kick() { if (!raf && !d.hidden) raf = requestAnimationFrame(frame); }
    build(); kick();
    w.addEventListener('scroll', kick, { passive: true });
    d.addEventListener('visibilitychange', kick);
    var rt;
    w.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () {
        if (w.innerWidth !== W) build(); else { VH = w.innerHeight; cv.height = Math.round(VH * dpr); lastY = -1; }
        kick();
      }, 120);
    });
    mqReduce.addEventListener('change', function (e) { reduced = e.matches; lastY = -1; kick(); });
  }

  var started = false;
  function start() {
    if (started) return; started = true;
    nav(); init(); background();
    if (fine && !reduced) cursor();
  }
  w.LV = { init: init, toast: toast, reduced: reduced };
  /* starts at DOMContentLoaded, so a page's own deferred script (listed in meta "js") runs first and can prepare its markup */
  if (d.readyState === 'complete') start(); else { d.addEventListener('DOMContentLoaded', start); w.addEventListener('load', start); }
})();
