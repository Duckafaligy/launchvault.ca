/* LaunchVault /new/legal/ — contents highlight + sliding bar, reading progress, section jumps with focus,
   phone "On this page" toggle, copy-link on headings, Download PDF (print). No dependencies; works with motion.js (LV.toast). */
(function () {
  'use strict';
  var d = document, w = window;
  function ready(fn) { d.readyState === 'loading' ? d.addEventListener('DOMContentLoaded', fn) : fn(); }
  ready(function () {
    var root = d.querySelector('[data-legal]');
    if (!root) return;
    var reduced = w.matchMedia('(prefers-reduced-motion:reduce)').matches;
    var narrow = w.matchMedia('(max-width:759px)');
    var bar = root.querySelector('.lg-bar'), art = root.querySelector('.lg-art');
    var toc = root.querySelector('.lg-toc'), btn = toc.querySelector('.lg-toc-h button'), list = toc.querySelector('.lg-toc-l'), ind = toc.querySelector('.lg-ind');
    var links = Array.prototype.slice.call(list.querySelectorAll('a'));
    var secs = links.map(function (a) { return d.getElementById(a.hash.slice(1)); });
    var fill = toc.querySelector('.lg-prog-t'), pct = toc.querySelector('.lg-prog-v');
    var cur = -1, lastPct = -1, ticking = false;

    /* ---- "On this page": a toggle on phones, always open from 760px ---- */
    function setOpen(v) { btn.setAttribute('aria-expanded', v); toc.classList.toggle('is-shut', !v); }
    function mode() {
      if (narrow.matches) { btn.disabled = false; setOpen(false); }
      else { setOpen(true); btn.disabled = true; }   /* nothing to toggle on wide screens: keep it out of the tab order */
      place();
    }
    btn.addEventListener('click', function () { setOpen(btn.getAttribute('aria-expanded') !== 'true'); place(); });

    /* ---- section in view + progress ---- */
    /* where a section heading lands: 84px on phones, 20px under the sticky tab bar on wider screens (legal.css --jump) */
    function jump() { return narrow.matches ? 84 : bar.getBoundingClientRect().bottom + 20; }
    function place() {
      var a = links[cur];
      if (!a) return;
      ind.style.transform = 'translateY(' + a.offsetTop + 'px)';
      ind.style.height = a.offsetHeight + 'px';
      ind.classList.add('on');
    }
    function update() {
      ticking = false;
      var line = jump() + 32, i = 0, k, vh = w.innerHeight;
      for (k = 0; k < secs.length; k++) if (secs[k].getBoundingClientRect().top <= line) i = k;
      if (w.innerHeight + w.scrollY >= d.documentElement.scrollHeight - 4) i = secs.length - 1;
      if (i !== cur) {
        cur = i;
        links.forEach(function (a, n) { n === i ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current'); });
        place();
        if (!narrow.matches && list.scrollHeight > list.clientHeight) list.scrollTop = links[i].offsetTop - list.clientHeight / 2;
      }
      /* real share of the article read: 0 when its top sits under the bars, 100 when its end reaches the bottom of the screen */
      var r = art.getBoundingClientRect(), span = r.height - (vh - jump());
      var p = span <= 0 ? 1 : Math.min(1, Math.max(0, (jump() - r.top) / span)), n = Math.round(p * 100);
      fill.style.setProperty('--p', p.toFixed(4));
      if (n !== lastPct) { lastPct = n; pct.textContent = n + '%'; fill.setAttribute('aria-valuenow', n); }
      if (bar) bar.classList.toggle('is-stuck', w.scrollY > 8);
    }
    function onScroll() { if (!ticking) { ticking = true; w.requestAnimationFrame(update); } }
    w.addEventListener('scroll', onScroll, { passive: true });
    w.addEventListener('resize', function () { cur = -1; onScroll(); });
    narrow.addEventListener ? narrow.addEventListener('change', mode) : narrow.addListener(mode);

    /* ---- jump to a section: scroll (CSS scroll-margin gives the offset), move focus to its heading, keep the URL in step ---- */
    function go(id, push) {
      var sec = d.getElementById(id);
      if (!sec || secs.indexOf(sec) < 0) return false;
      if (narrow.matches && btn.getAttribute('aria-expanded') === 'true') {   /* close the list first, without animating, so the target doesn't move mid-scroll */
        toc.classList.add('lg-now'); setOpen(false); toc.offsetHeight; toc.classList.remove('lg-now');
      }
      sec.style.transition = 'none'; sec.classList.add('in'); sec.offsetHeight; sec.style.transition = '';   /* never land on a section that hasn't faded in yet (and measure it where it will rest) */
      sec.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
      var h = sec.querySelector('h2');
      if (h) h.focus({ preventScroll: true });
      if (push && w.history.pushState) w.history.pushState(null, '', '#' + id);
      return true;
    }
    root.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
      if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var id = a.hash.slice(1);
      if (a.classList.contains('lg-anchor')) {   /* copy-link on a heading */
        var url = w.location.origin + w.location.pathname + '#' + id;
        if (!w.navigator.clipboard) return;      /* no clipboard: let the link work as a plain anchor */
        e.preventDefault();
        w.navigator.clipboard.writeText(url).then(function () {
          if (w.history.replaceState) w.history.replaceState(null, '', '#' + id);
          a.classList.add('is-copied');
          setTimeout(function () { a.classList.remove('is-copied'); }, 1600);
          if (w.LV && w.LV.toast) w.LV.toast('Link copied.', { type: 'ok' });
        }, function () { w.location.hash = id; });
        return;
      }
      if (go(id, true)) e.preventDefault();
    });
    w.addEventListener('popstate', function () { if (w.location.hash) go(w.location.hash.slice(1), false); });

    /* ---- Download PDF = the browser's print dialog (print styles in legal.css) ---- */
    root.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('[data-lg-print]')) w.print(); });

    mode();
    update();
    if (w.location.hash && d.getElementById(w.location.hash.slice(1))) setTimeout(function () { go(w.location.hash.slice(1), false); }, 60);
  });
})();
