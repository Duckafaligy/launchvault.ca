/* LaunchVault /new/ — the one shared motion system. No dependencies. Load with <script defer>.
   Everything here is driven by markup (classes / data attributes); see src/new/README.md.
   Public API: LV.init(root) re-scans injected markup, LV.toast(msg, {type, ms}), LV.reduced. */
(function () {
  'use strict';
  var d = document, html = d.documentElement, w = window;
  var mqReduce = w.matchMedia('(prefers-reduced-motion: reduce)');
  var reduced = mqReduce.matches;
  var calm = w.innerWidth < 1100;     /* tablet and phone: no build animation, no drifting background; desktop is where the motion lives */
  var fine = w.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var $$ = function (s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); };
  var EASE = 'cubic-bezier(.22,1,.36,1)';
  var ARROW_NE = '<svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 7.5l5-5M3.5 2.5h4v4"/></svg>';

  /* ---------- scroll reveals: [data-reveal] [data-reveal=words] [data-stagger] [data-count] [data-draw] .pin ---------- */
  var io = 'IntersectionObserver' in w ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); enter(e.target); } });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }) : null;

  function enter(el) {
    if (el._lvParked) { el._lvParked = 0; return queue(el); }
    if (el._lvCount) runCount(el);
    if (el._lvDraw) el._lvDraw.forEach(function (p) { p.style.strokeDashoffset = 0; });
    if (el.classList.contains('pin')) return runPin(el);
    if (el._lvT === el) queue(el);                         /* a heading that gets typed */
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
    var T = pinTarget(el), act = el.dataset.act || 'move';
    if (!T || act === 'none' || reduced || calm || !io || !el.offsetParent) return;          /* a pin hidden at this width never plays, so its layer is left alone */
    el._lvT = T; el._lvAct = act;
    if (act === 'type') T.classList.add('lv-untyped', 'lv-arial');
    else if (act === 'color') T.classList.add('lv-grey');
    else if (el.dataset.nudge !== '0') {
      var r = T.getBoundingClientRect();
      el._lvOff = [r.left + r.width / 2 > w.innerWidth / 2 ? -10 : 10, 9];
      T.style.translate = el._lvOff[0] + 'px ' + el._lvOff[1] + 'px';
    }
  }

  /* The page is built in front of you, like a design file being worked on. A coloured cursor does one job per item, then (for a comment
     pin) clicks beside it: the bubble pops out of the click, the words type, the logo pops in last. The jobs:
       type   the heading is typed in Arial, then switched to the real font       (data-act="type" on a pin, or data-build="type" on a heading)
       color  the layer starts grey; the cursor picks its colour
       move   the layer is selected (outline, handles, name tag) and dragged the last few pixels into place
       none   just the comment
     One job starts at a time, and only once its spot has stopped moving (counting numbers, reveals, scroll zooms). */
  var CUR = '<svg viewBox="0 0 20 22" width="20" height="22"><path d="M4 3.2 C4 2.2 5.1 1.6 6 2.2 L17.2 9.9 C18.1 10.5 17.8 11.9 16.7 12.1 L11.6 13 L9.2 17.6 C8.7 18.6 7.2 18.4 7 17.3 Z"/></svg>';
  var CUR_COL = ['#FF4D1F', '#00C27A', '#7B5CFF', '#FF5FA2'], pinN = 0, pinQ = [], pinBusy = false, layer;
  function pinTarget(el) { var q = el.dataset.for; try { return q ? d.querySelector(q) : null; } catch (e) { return null; } }
  function ready(el) {                                     /* put the layer in its finished state, no show */
    var T = el._lvT;
    if (T) { T.style.translate = ''; T.classList.remove('lv-untyped', 'lv-arial', 'lv-grey', 'lv-undrawn'); }
  }
  var pinLive = 0, PIN_MAX = 3;                            /* how many cursors may work at once */
  function queue(el) { el._lvQ = performance.now(); pinQ.push(el); pinNext(); }
  function runPin(el) {
    if (!el._lvPin || reduced || calm) { ready(el); return el.classList.add('in'); }
    queue(el);
  }
  function pinNext() {
    while (pinLive < PIN_MAX && pinQ.length) {
      var i = 0;
      while (i < pinQ.length && pinQ[i]._lvT && pinQ[i]._lvT._lvBusy) i++;      /* never two cursors on one layer: that job waits its turn */
      if (i === pinQ.length) return;
      pinStart(pinQ.splice(i, 1)[0]);
    }
  }
  function pinStart(el) {
    var last = '', same = 0, tries = 0, v = el.getBoundingClientRect(), hidden = /type|write|draw/.test(el._lvAct || '');
    var stale = hidden && performance.now() - el._lvQ > 3200;                   /* nothing waits blank for long */
    if (!el.offsetParent || stale) {                       /* waited too long, or hidden at this width: it is just there */
      ready(el);
      if (el._lvPin) el.classList.add('in', 'lit');
      return;
    }
    if (park(el)) return;
    pinLive++;
    if (el._lvT) el._lvT._lvBusy = true;
    setTimeout(function settle() {                         /* wait until it holds still for about a third of a second */
      var r = el.getBoundingClientRect(), t = el._lvT ? el._lvT.getBoundingClientRect() : r;
      var key = [r.left, r.top + w.scrollY, r.width, t.left, t.top + w.scrollY, t.width, t.height].map(Math.round).join();
      same = key === last ? same + 1 : 0; last = key;
      if (same >= 3 || ++tries > 40) return play(el);
      setTimeout(settle, 110);
    }, (pinLive - 1) * 220);                               /* cursors that start together set off a beat apart */
  }
  function park(el) {                                      /* off screen when its turn came: it plays when it scrolls back into view */
    var v = el.getBoundingClientRect();
    if (v.bottom > -40 && v.top < w.innerHeight + 40) return false;
    if (el._lvPin && el._lvT) { ready(el); el._lvT._lvBusy = false; el._lvT = null; }   /* its layer is not left grey or out of place meanwhile: later it just comments */
    el._lvParked = 1; io.observe(el);
    return true;
  }
  function pinFree() { pinLive = Math.max(0, pinLive - 1); setTimeout(pinNext, 120 + Math.random() * 300); }
  function at(node, x, y, ms, ease) {
    node.style.transition = 'transform ' + ms + 'ms ' + (ease || EASE) + ',opacity .25s';
    node.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
  }
  function chars(T) {                                      /* every letter in its own hidden span, so typing never moves the layout */
    var out = [], wraps = [];
    (function walk(n) {
      Array.prototype.slice.call(n.childNodes).forEach(function (k) {
        if (k.nodeType === 3) {
          if (!k.data.trim()) return;
          var W = d.createElement('span');
          k.data.split('').forEach(function (ch) { var c = d.createElement('span'); c.textContent = ch; c.style.opacity = 0; W.appendChild(c); out.push(c); });
          n.replaceChild(W, k); wraps.push([W, k]);
        } else if (k.nodeType === 1 && k.tagName.toLowerCase() !== 'svg' && !k.classList.contains('lv-cur')) walk(k);
      });
    })(T);
    return { c: out, undo: function () { wraps.forEach(function (x) { if (x[0].parentNode) x[0].parentNode.replaceChild(x[1], x[0]); }); } };
  }
  function typeText(T, per, done) {                        /* per = ms a letter, or 0 for uneven hand typing */
    var ch = chars(T), n = 0, caret = d.createElement('i'); caret.className = 'lv-tcaret';
    (function tick() {
      var k = ch.c[n++];
      if (k) { k.style.opacity = ''; k.after(caret); return setTimeout(tick, per || (/\s/.test(k.textContent) ? 70 : 30 + Math.random() * 40)); }
      setTimeout(function () { caret.remove(); ch.undo(); if (done) done(); }, 160);
    })();
  }
  function play(el) {
    if (el._lvT) el._lvT._lvBusy = false;
    if (park(el)) return pinFree();
    if (el._lvT) el._lvT._lvBusy = true;      /* the page jumped away while it was getting ready */
    if (!layer) { layer = d.createElement('div'); layer.className = 'lv-layer'; layer.setAttribute('aria-hidden', 'true'); d.body.appendChild(layer); }
    var p = el._lvPin, T = el._lvT, act = el._lvAct, c = el.dataset.c || 'bl', col = CUR_COL[pinN++ % CUR_COL.length], sy = w.scrollY;
    var cur = d.createElement('span');
    cur.className = 'lv-cur pin-cur'; cur.innerHTML = '<i></i>' + CUR; cur.style.setProperty('--c', col);
    layer.appendChild(cur);
    function anchor() { var r = el.getBoundingClientRect(); return [c[1] === 'r' ? r.right : r.left, (c[0] === 'b' ? r.bottom : r.top) + w.scrollY]; }   /* the bubble's tail corner */
    var tr = T && T.getBoundingClientRect(), box = null, chip = null, alive = true;
    if (T && (!tr.width || !tr.height)) { ready(el); T = null; }
    var first = !T ? anchor() : act === 'draw' ? [tr.left, tr.top + sy] : act === 'type' || act === 'write' ? [tr.left - 4, tr.top + sy + Math.min(40, tr.height * 0.5)]
      : [tr.left + Math.min(46, tr.width * 0.25), tr.top + sy + Math.min(30, tr.height * 0.4)];
    var fromX = first[0] > w.innerWidth / 2 ? -120 : 120;        /* comes in from the middle of the page, so it never widens it */
    at(cur, first[0] + fromX, first[1] + 90, 0);
    cur.getBoundingClientRect(); cur.style.opacity = 1;
    at(cur, first[0], first[1], 560);
    function click() { cur.classList.remove('click'); cur.getBoundingClientRect(); cur.classList.add('click'); }
    function leave(x, y) {
      cur.style.opacity = 0; at(cur, x + fromX * 0.4, y + 40, 600, 'cubic-bezier(.5,0,.8,.5)');
      if (box) box.classList.remove('on');
      setTimeout(function () { alive = false; cur.remove(); if (box) box.remove(); }, 650);
    }
    function showChip(html) {                              /* the little tool panel that pops up under the cursor */
      chip = d.createElement('div'); chip.className = 'lv-chip'; chip.innerHTML = html;
      chip.style.transform = 'translate(' + (first[0] + 14).toFixed(0) + 'px,' + (first[1] + 26).toFixed(0) + 'px)';
      layer.appendChild(chip); chip.getBoundingClientRect(); chip.classList.add('on');
    }
    function hideChip() { var k = chip; chip = null; if (!k) return; k.classList.remove('on'); setTimeout(function () { k.remove(); }, 300); }
    function comment() {                                    /* on to where the comment goes; a layer with no pin is simply done */
      if (T) { T._lvBusy = false; }
      if (!p) { leave(first[0], first[1]); return pinFree(); }
      var P = anchor();
      at(cur, P[0], P[1], 520);
      setTimeout(function () { write(P); }, 560);
    }
    function write(P, placed) {
      if (placed ? el._lvWrote : el._lvDrag || el._lvWrote) return;      /* one comment is only ever written once */
      if (!placed && $$('.pin').indexOf(el) % 2 === 0) {                      /* every other comment is written a little off, then dragged to its spot */
        var pr = el.getBoundingClientRect(), dx = pr.left + pr.width / 2 > w.innerWidth / 2 ? -20 : 20, dy = 14;
        el._lvDrag = [dx, dy]; el.style.translate = dx + 'px ' + dy + 'px';
        at(cur, P[0] + dx, P[1] + dy, 220);
        return setTimeout(function () { write(P, 1); }, 250);
      }
      var txt = d.createTextNode(''), dom = d.createTextNode(''), post = d.createTextNode(''), arrow = p.b.querySelector('svg');
      var caret = d.createElement('span'); caret.className = 'pin-caret';
      p.t.textContent = ''; p.b.textContent = '';
      p.t.appendChild(txt); p.t.appendChild(p.b); p.b.appendChild(dom); p.t.appendChild(post); p.t.appendChild(caret);
      el._lvWrote = 1;
      click();
      el.classList.add('in', 'pop', 'typing');
      pinFree();                                            /* the next cursor may set off while this one types */
      var i = 0, all = p.pre.length + p.dom.length + p.post.length;
      setTimeout(function tick() {
        i++;
        txt.data = p.pre.slice(0, i);
        dom.data = p.dom.slice(0, Math.max(0, i - p.pre.length));
        post.data = p.post.slice(0, Math.max(0, i - p.pre.length - p.dom.length));
        if (i < all) return setTimeout(tick, 38 + Math.random() * 34);          /* typed by hand: uneven, about 55ms a letter */
        caret.remove();
        if (arrow) p.b.appendChild(arrow);
        el.classList.remove('typing', 'pop'); el.classList.add('lit');
        if (!el._lvDrag) return leave(P[0], P[1]);
        setTimeout(function () {                            /* grab the bubble by its corner and put it where it belongs */
          cur.classList.add('down');
          el.style.transition = 'translate 560ms ' + EASE; el.style.translate = '0 0';
          at(cur, P[0], P[1], 560);
          setTimeout(function () { el.style.transition = ''; el.style.translate = ''; cur.classList.remove('down'); leave(P[0], P[1]); }, 640);
        }, 260);
      }, 320);
    }
    var ACTS = {
      type: function () {
        T.classList.remove('lv-arial'); var h = T.offsetHeight, font = getComputedStyle(T).fontFamily.split(',')[0].replace(/["']/g, '').trim();
        T.classList.add('lv-arial'); T.style.height = h + 'px';             /* keeps its final height, so nothing below moves */
        click(); T.classList.remove('lv-untyped');
        typeText(T, 0, function () {
          /* the text toolbar, the way a design tool shows it: font, weight, size, fill. The font menu drops open and the cursor picks the real one */
          var hr = T.getBoundingClientRect(), cs = getComputedStyle(T), bx = hr.left, by = (hr.top > 130 ? hr.top - 46 : hr.bottom + 10) + w.scrollY;
          var bar = d.createElement('div'); bar.className = 'lv-bar';
          bar.innerHTML = '<span class="lv-bar-f"><b>Arial</b><svg viewBox="0 0 8 8" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 3l2.5 2.5L6.5 3"/></svg></span>' +
            '<span>' + (parseInt(cs.fontWeight, 10) >= 600 ? 'Bold' : 'Regular') + '</span><span>' + Math.round(parseFloat(cs.fontSize)) + '</span><span><u></u></span>' +
            '<div class="lv-menu"><i class="on hv">Arial</i><i>Georgia</i><i>' + font + '</i></div>';
          bar.style.transform = 'translate(' + bx.toFixed(0) + 'px,' + by.toFixed(0) + 'px)';
          layer.appendChild(bar); bar.getBoundingClientRect(); bar.classList.add('on');
          var items = bar.lastChild.children, hv = function (n) { for (var k = 0; k < 3; k++) items[k].classList.toggle('hv', k === n); };
          at(cur, bx + 54, by + 18, 320);
          setTimeout(function () { click(); bar.classList.add('menu'); bar.firstChild.classList.add('open'); }, 380);
          setTimeout(function () { at(cur, bx + 64, by + 42 + 2 * 28 + 14, 380, 'cubic-bezier(.45,0,.2,1)'); }, 640);
          setTimeout(function () { hv(1); }, 800);
          setTimeout(function () { hv(2); }, 960);
          setTimeout(function () {
            click(); T.classList.remove('lv-arial');
            items[0].classList.remove('on'); items[2].classList.add('on');
            bar.classList.remove('menu'); bar.firstChild.classList.remove('open'); bar.firstChild.firstChild.textContent = font;
          }, 1180);
          setTimeout(function () { bar.classList.remove('on'); setTimeout(function () { bar.remove(); }, 300); T.style.height = ''; comment(); }, 1900);
        });
      },
      write: function () {                                  /* a paragraph: typed quickly, in its own font */
        click(); T.classList.remove('lv-untyped');
        typeText(T, Math.max(7, Math.min(34, 1300 / T.textContent.length)), comment);
      },
      draw: function () {                                   /* drag the layer's box out corner to corner; then the layer is there */
        var r = T.getBoundingClientRect(), x = r.left, y = r.top + w.scrollY;
        cur.classList.add('down');
        box = d.createElement('div'); box.className = 'lv-sel draw'; box.style.setProperty('--c', col);
        box.innerHTML = '<i></i><i></i><i></i><i></i><b>' + Math.round(r.width) + ' × ' + Math.round(r.height) + '</b>';
        box.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)'; box.style.width = box.style.height = '0px';
        layer.appendChild(box); box.getBoundingClientRect(); box.classList.add('on');
        box.style.width = r.width.toFixed(1) + 'px'; box.style.height = r.height.toFixed(1) + 'px';
        at(cur, x + r.width, y + r.height, 520, 'cubic-bezier(.45,0,.2,1)');
        first = [x + r.width, y + r.height];
        setTimeout(function () {
          cur.classList.remove('down');
          T.style.transition = 'opacity .5s ' + EASE; T.classList.remove('lv-undrawn');
          setTimeout(function () { T.style.transition = ''; }, 550);
        }, 560);
        setTimeout(comment, 980);
      },
      color: function () {
        click();
        showChip('<u style="--k:#8A8A93" class="sel"></u><u style="--k:#FF4D1F"></u><u style="--k:#00C27A"></u><u style="--k:#2F6BFF"></u>');
        var pick = chip.lastChild;
        setTimeout(function () {                            /* over to the swatch itself */
          var k = pick.getBoundingClientRect();
          at(cur, k.left + k.width / 2, k.top + k.height / 2 + w.scrollY, 380, 'cubic-bezier(.45,0,.2,1)');
        }, 380);
        setTimeout(function () {
          click();
          if (chip) { chip.firstChild.classList.remove('sel'); pick.classList.add('sel'); }
          T.style.transition = 'filter .7s ' + EASE; T.classList.remove('lv-grey');
          setTimeout(function () { T.style.transition = ''; }, 750);
        }, 860);
        setTimeout(function () { hideChip(); comment(); }, 1600);
      },
      move: function () {
        click();
        box = d.createElement('div'); box.className = 'lv-sel'; box.style.setProperty('--c', col);
        box.innerHTML = '<i></i><i></i><i></i><i></i>' + (el.dataset.layer ? '<b>' + el.dataset.layer + '</b>' : '');
        layer.appendChild(box);
        (function follow() {
          if (!alive) return;
          var r = T.getBoundingClientRect();
          box.style.transform = 'translate(' + r.left.toFixed(1) + 'px,' + (r.top + w.scrollY).toFixed(1) + 'px)';
          box.style.width = r.width.toFixed(1) + 'px'; box.style.height = r.height.toFixed(1) + 'px';
          requestAnimationFrame(follow);
        })();
        box.getBoundingClientRect(); box.classList.add('on');
        var off = el._lvOff;
        if (!off) return setTimeout(comment, 700);
        setTimeout(function () {                            /* drag it into place */
          cur.classList.add('down');
          T.style.transition = 'translate 620ms ' + EASE; T.style.translate = '0 0';
          at(cur, first[0] - off[0], first[1] - off[1], 620);
          setTimeout(function () { T.style.transition = ''; T.style.translate = ''; cur.classList.remove('down'); }, 660);
        }, 380);
        setTimeout(comment, 1200);
      }
    };
    setTimeout(T ? ACTS[act] || ACTS.move : function () { write(first); }, 600);
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
    if (!reduced && !calm && io) $$('[data-build]', root).forEach(function (el) {
      if (el._lvT) return;
      var act = el.dataset.build;
      el._lvT = el; el._lvAct = act;
      if (act === 'type') el.classList.add('lv-untyped', 'lv-arial');
      else if (act === 'write') el.classList.add('lv-untyped');
      else if (act === 'draw') el.classList.add('lv-undrawn');
      else if (act === 'color') el.classList.add('lv-grey');
    });
    var els = $$('[data-reveal],[data-stagger],[data-count],[data-draw],[data-build],.pin', root).filter(function (el) { return !el._lvSeen; });
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
      btn.addEventListener('mouseenter', function () { clearTimeout(timer); if (el.classList.contains('is-pill')) set(true); });   /* only the menu button opens it */
      shell.addEventListener('mouseenter', function () { clearTimeout(timer); });
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
      var g = c.getContext('2d'), top = n * TILE, bot = top + TILE, _ = 0;
      g.setTransform(dpr, 0, 0, dpr, 0, -top * dpr);
      g.globalCompositeOperation = 'lighter';
      segs.forEach(function (sg, idx) {             /* soft glow along the band */
        if (idx % 3 || sg.y1 < top - band || sg.y0 > bot + band) return;
        var col = colour(sg.s), R = band * 1.25, gr = g.createRadialGradient(sg.x, sg.y, 0, sg.x, sg.y, R);
        var a = (sg.y < hero ? .075 : .05) * dim;
        gr.addColorStop(0, 'rgba(' + col + ',' + a + ')'); gr.addColorStop(1, 'rgba(' + col + ',0)');
        g.fillStyle = gr; g.fillRect(sg.x - R, sg.y - R, 2 * R, 2 * R);
      });
      tiles.set(n, c);
      if (tiles.size > 5) tiles.delete(tiles.keys().next().value);
      return c;
    }
    /* The dots are live: each one rides a slow wave that travels down the band and wobbles on its own, all the time.
       The pointer pushes them apart (they close back in behind it) and the whole band leans a little away from it.
       ponytail: canvas 2D, about 20k dots a frame on a desktop viewport; move to WebGL points if a profile ever shows this. */
    var mx = 0, my = 0, ex = 0, ey = 0, has = false, LV = 5;
    function dotsOf(sg, idx) {
      var r = rng(idx * 7919 + 7), n_ = Math.round(sg.len * (W < 600 ? .09 : .11) * band), nx = -sg.dy / sg.len, ny = sg.dx / sg.len, B = [];
      for (var k = 0; k < LV; k++) B.push([]);
      for (var j = 0; j < n_; j++) {
        var f = r(), off = Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(6.2832 * r()) * band / 3, u = r();
        var px = sg.x + sg.dx * f + nx * off, py = sg.y + sg.dy * f + ny * off;
        var a = Math.pow(Math.max(0, 1 - Math.abs(off) / band), 1.5) * (.25 + .75 * u);
        a *= (.58 + .42 * Math.pow(Math.min(1, Math.max(0, (hero + 260 - py) / 620)), 1.6)) * dim;
        if (a < .03) continue;
        B[Math.min(LV - 1, a * LV | 0)].push(px, py, u * 6.2832);
      }
      var col = colour(sg.s);
      sg.nx = nx; sg.ny = ny;
      sg.f = B.map(function (_, k) { return 'rgba(' + col + ',' + ((k + .6) / LV).toFixed(2) + ')'; });
      return (sg.d = B.map(function (v) { return new Float32Array(v); }));
    }
    function draw(now) {
      var still = reduced || calm, sy = w.scrollY * (still ? 1 : PAR), sx = 0, t = still ? 0 : now / 1000;
      if (!still) { sx = Math.cos(now / 9000) * 10; sy += Math.sin(now / 7000) * 12 + 12; }
      if (has) { ex += (mx - ex) * 0.12; ey += (my - ey) * 0.12; sx += (ex / W - 0.5) * -24; sy += (ey / VH - 0.5) * -16 + 8; }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (var n = Math.max(0, Math.floor(sy / TILE)); n * TILE < sy + VH; n++) ctx.drawImage(tile(n), Math.round(sx * dpr), Math.round((n * TILE - sy) * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var R = 150, R2 = R * R, top = sy - band * 1.4, bot = sy + VH + band * 1.4, amp = still ? 0 : 1;
      for (var i = 0; i < segs.length; i++) {
        var sg = segs[i];
        if (sg.y1 < top || sg.y0 > bot) continue;
        var D = sg.d || dotsOf(sg, i), nx = sg.nx, ny = sg.ny;
        var wave = amp * Math.sin(sg.s / 150 - t * 0.9) * 13, slide = amp * Math.sin(sg.s / 420 + t * 0.35) * 9;   /* across the band, and along it */
        for (var k = 0; k < LV; k++) {
          var v = D[k], m = v.length;
          if (!m) continue;
          ctx.fillStyle = sg.f[k]; ctx.beginPath();
          for (var j = 0; j < m; j += 3) {
            var ph = v[j + 2], o = wave + amp * Math.sin(t * 1.3 + ph) * 3.5;
            var x = v[j] + sx + nx * o - ny * slide + amp * Math.cos(t * 0.8 + ph * 1.7) * 2.5, y = v[j + 1] - sy + ny * o + nx * slide;
            if (has) {
              var dx = x - ex, dy = y - ey, d2 = dx * dx + dy * dy;
              if (d2 < R2) { var dd = Math.sqrt(d2) || 1, q = 1 - dd / R; q = q * q * 54 / dd; x += dx * q; y += dy * q; }
            }
            ctx.rect(x, y, 2, 2);
          }
          ctx.fill();
        }
      }
    }
    function point(e) {                                    /* mouse, pen or finger */
      if (reduced || calm) return;
      mx = e.clientX; my = e.clientY;
      if (!has) { has = true; ex = mx; ey = my; }
    }
    d.addEventListener('pointermove', point, { passive: true });
    d.addEventListener('pointerdown', point, { passive: true });
    html.addEventListener('mouseleave', function () { has = false; });
    ['pointerup', 'pointercancel'].forEach(function (n) { d.addEventListener(n, function (e) { if (e.pointerType !== 'mouse') has = false; }, { passive: true }); });
    function frame(now) {
      raf = 0;
      if (reduced || calm ? w.scrollY !== lastY : now - lastT > 15) {     /* always moving, with or without a pointer */ lastY = w.scrollY; lastT = now; draw(now); }
      if (!reduced && !calm && !d.hidden) raf = requestAnimationFrame(frame);     /* pauses in background tabs */
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
  w.LV = { init: init, toast: toast, reduced: reduced, type: typeText };
  /* starts at DOMContentLoaded, so a page's own deferred script (listed in meta "js") runs first and can prepare its markup */
  if (d.readyState === 'complete') start(); else { d.addEventListener('DOMContentLoaded', start); w.addEventListener('load', start); }
})();
