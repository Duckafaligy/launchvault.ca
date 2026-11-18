/* LaunchVault nav: the island shrinks on scroll and its tabs fold into a centred menu button.
   Mouse hover opens the mega card at once (leaving closes it); a click pins it until a click outside, Esc, or the button again.
   Phones get the same content as a tap-to-open sheet. Also: dark-section tint and the homepage scroll-spy. Styles: assets/nav.css. */
(() => {
  const nav = document.getElementById("nav"), mb = document.getElementById("menubtn"), mega = document.getElementById("mega");
  if (!nav || !mb || !mega) return;
  let open = false, pinned = false, t = 0;
  const set = (o, pin = false) => {
    clearTimeout(t); open = o; pinned = o && pin;
    nav.classList.toggle("open", o); mb.setAttribute("aria-expanded", o);
  };
  const shut = (focusBtn) => { if (!open) return; set(false); if (focusBtn) mb.focus(); };
  const inside = el => el && (mb.contains(el) || mega.contains(el));

  // hover (mouse, card-sized screens only): open with no delay; a short grace on leave plus the CSS bridge stop flicker
  const mouse = e => e.pointerType === "mouse" && innerWidth > 720;
  [mb, mega].forEach(el => {
    el.addEventListener("pointerenter", e => { if (!mouse(e)) return; clearTimeout(t); if (!open) set(true); });
    el.addEventListener("pointerleave", e => { if (!mouse(e) || pinned) return; clearTimeout(t); t = setTimeout(() => { if (!mb.matches(":hover") && !mega.matches(":hover")) shut(); }, 120); });
  });
  // click / tap / Enter / Space: pin open, or unpin and close
  mb.addEventListener("click", e => {
    if (pinned) return shut();
    set(true, true);
    if (e.detail === 0) { const f = [...mega.querySelectorAll("a, button")].find(x => x.getClientRects().length); if (f) f.focus(); }  // keyboard: move focus in
  });
  mega.querySelector(".mx")?.addEventListener("click", () => shut(true));
  mega.addEventListener("click", e => { if (e.target.closest("a")) shut(); });
  document.addEventListener("click", e => { if (open && e.isTrusted && !inside(e.target)) shut(); });   // isTrusted: the hero demo's scripted clicks must not close it
  addEventListener("keydown", e => { if (e.key === "Escape" && open) shut(true); });
  nav.addEventListener("focusout", e => { if (open && e.relatedTarget && !inside(e.relatedTarget)) shut(); });

  // scroll: shrink past 8px; tint dark over .dk sections and the footer
  const darks = [...document.querySelectorAll(".dk, footer")];
  let raf = 0;
  const onScroll = () => { raf = 0;
    const small = scrollY > 8; nav.classList.toggle("small", small);
    if (!small && open && innerWidth > 1100) shut();   // the button is hidden at rest on wide screens
    const r = nav.getBoundingClientRect(), y = r.top + r.height / 2;
    nav.classList.toggle("ondk", darks.some(d => { const b = d.getBoundingClientRect(); return b.top <= y && b.bottom >= y; }));
  };
  const queue = () => { if (!raf) raf = requestAnimationFrame(onScroll); };
  addEventListener("scroll", queue, {passive: true}); addEventListener("resize", queue); onScroll();

  // homepage scroll-spy: highlight the tab and the "Jump to a section" row for the section in view (smooth scroll + offset are CSS)
  if ("IntersectionObserver" in window && location.pathname === "/") {
    const tabs = [...nav.querySelectorAll('.links a[href^="/#"], .mth[href^="/#"]')], jumps = [...mega.querySelectorAll("[data-sec]")];
    const map = {stories: "stories", inside: "stories", sources: "sources", check: "sources", pricing: "pricing", faq: "faq"};
    const mark = (a, on) => on ? a.setAttribute("aria-current", "location") : a.removeAttribute("aria-current");
    const vis = new Map();
    const paint = () => { let best = null, bh = 0; vis.forEach((h, id) => { if (h > bh) { bh = h; best = id; } });
      tabs.forEach(a => mark(a, best && map[best] && a.getAttribute("href") === "/#" + map[best]));
      jumps.forEach(a => mark(a, a.dataset.sec === best)); };
    const io = new IntersectionObserver(es => { es.forEach(e => vis.set(e.target.id, e.isIntersecting ? e.intersectionRect.height : 0)); paint(); },
      {threshold: [0, .1, .25, .5, .75, 1], rootMargin: "-80px 0px -35% 0px"});
    jumps.forEach(a => { const el = document.getElementById(a.dataset.sec); if (el) io.observe(el); });
  }
})();
