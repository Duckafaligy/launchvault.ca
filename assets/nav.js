/* LaunchVault nav: the island shrinks on scroll and its tabs fold into a centred menu button.
   Mouse hover opens the mega card at once (leaving closes it); a click pins it until a click outside, Esc, or the button again.
   Card: a sidebar list (hover / focus / arrow keys pick an item, a highlight slides to it) and a detail pane that crossfades.
   Any /#id link scrolls there with animation (on other pages: go home, then scroll on arrival) and can pick a Stories tab,
   a breakdown part or open a FAQ question. Phones: a sheet, list first, tap an item for its detail, back button returns.
   Also: dark-section tint and the homepage scroll-spy. Styles: assets/nav.css. */
(() => {
  const nav = document.getElementById("nav"), mb = document.getElementById("menubtn"), mega = document.getElementById("mega");
  if (!nav || !mb || !mega) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches, phone = () => innerWidth <= 720;
  const items = [...mega.querySelectorAll(".mi")], hl = mega.querySelector(".mhl"), back = mega.querySelector(".mback"), title = mega.querySelector(".mhead b");
  const pane = it => document.getElementById(it.getAttribute("aria-controls"));
  let open = false, pinned = false, t = 0, sel = items[0];

  // ---------- open / close ----------
  const set = (o, pin = false) => {
    clearTimeout(t); open = o; pinned = o && pin;
    nav.classList.toggle("open", o); mb.setAttribute("aria-expanded", o);
    if (o) { const cur = items.find(i => i.hasAttribute("aria-current")); if (cur && !pinned) select(cur); place(); }
    else list();
  };
  const shut = focusBtn => { if (!open) return; set(false); if (focusBtn) mb.focus(); };
  const inside = el => el && (mb.contains(el) || mega.contains(el));

  // hover (mouse, card-sized screens only): open with no delay; a short grace on leave plus the CSS bridge stop flicker
  const mouse = e => e.pointerType === "mouse" && !phone();
  // The hover zone is the whole nav: the bar (button + the strip around it), the card and its bridge are all inside #nav,
  // so moving from the icon to any corner of the card never leaves it. Leaving closes after 150ms; coming back cancels.
  mb.addEventListener("pointerenter", e => { if (!mouse(e)) return; clearTimeout(t); if (!open) set(true); });
  nav.addEventListener("pointerenter", e => { if (mouse(e)) clearTimeout(t); });
  nav.addEventListener("pointerleave", e => { if (!mouse(e) || pinned || !open) return; clearTimeout(t); t = setTimeout(() => { if (!nav.matches(":hover")) shut(); }, 150); });
  // click / tap / Enter / Space: pin open, or unpin and close
  mb.addEventListener("click", e => {
    if (pinned) return shut();
    set(true, true);
    if (e.detail === 0) sel.focus();   // keyboard: focus goes to the selected item
  });
  mega.querySelector(".mx")?.addEventListener("click", () => shut(true));
  document.addEventListener("click", e => { if (open && e.isTrusted && !inside(e.target)) shut(); });   // isTrusted: the hero demo's scripted clicks must not close it
  addEventListener("keydown", e => { if (e.key === "Escape" && open) shut(true); });
  nav.addEventListener("focusout", e => { if (open && e.relatedTarget && !inside(e.relatedTarget)) shut(); });

  // ---------- sidebar: select an item, slide the highlight, crossfade the pane ----------
  const place = () => { if (hl && sel.offsetParent) hl.style.setProperty("--y", sel.offsetTop + "px"); };
  function select(it) {
    if (it === sel) return place();
    const was = pane(sel), now = pane(it);
    items.forEach(i => { const on = i === it; i.setAttribute("aria-selected", on); i.tabIndex = on ? 0 : -1; });
    was.classList.remove("on"); was.classList.add("was"); setTimeout(() => was.classList.remove("was"), 340);
    now.classList.remove("was"); now.classList.add("on");
    sel = it; place();
  }
  items.forEach((it, n) => {
    it.addEventListener("pointerenter", e => { if (mouse(e)) select(it); });
    it.addEventListener("focus", () => { if (!phone()) select(it); });
    it.addEventListener("keydown", e => {
      const k = {ArrowDown: n + 1, ArrowUp: n - 1, Home: 0, End: items.length - 1}[e.key];
      if (k === undefined) return; e.preventDefault();
      const to = items[(k + items.length) % items.length]; select(to); to.focus();
    });
  });
  // phone: an item opens its detail; the back button returns to the list
  const list = () => { nav.classList.remove("mdet"); if (back) back.hidden = true; if (title) title.textContent = "Menu"; };
  back?.addEventListener("click", () => { list(); sel.focus(); });

  // ---------- destinations: /#id scrolls with animation (and can pick a tab or open a question) ----------
  const run = a => {
    const target = document.getElementById(a.id); if (!target) return;
    let to = target;
    if (a.f) document.querySelector(`#stories .filters .chip[data-f="${a.f}"]`)?.click();
    if (a.t) document.getElementById(a.t)?.click();
    if (a.q != null) { const d = [...target.querySelectorAll("details")][a.q];
      if (d) { if (!d.classList.contains("is-open") && !d.open) d.querySelector("summary").click(); to = d; } }
    history.replaceState(null, "", "#" + a.id);
    const aim = () => to.scrollIntoView({behavior: reduce ? "auto" : "smooth", block: "start"});
    aim(); if (to !== target) setTimeout(aim, 420);   // the accordion closing the other question moves the target; re-aim once it settles
  };
  nav.addEventListener("click", e => {
    const a = e.target.closest("a"); if (!a || e.defaultPrevented) return;
    if (a.classList.contains("mi") && phone()) {   // phone list: open the detail instead of leaving
      e.preventDefault(); select(a); nav.classList.add("mdet"); back.hidden = false; title.textContent = a.textContent.replace("›", "").trim();
      mega.querySelector(".mgc").scrollTop = 0; back.focus(); return;
    }
    const h = a.getAttribute("href") || "";
    if (mega.contains(a)) shut();
    if (!h.startsWith("/#") || e.ctrlKey || e.metaKey || e.shiftKey || e.button) return;
    e.preventDefault();
    const go = {id: h.slice(2), f: a.dataset.f, t: a.dataset.t, q: a.dataset.q != null ? +a.dataset.q : null};
    if (location.pathname === "/") run(go);
    else { try { sessionStorage.setItem("lv-go", JSON.stringify(go)); } catch {} location.href = "/"; }
  });
  // arriving from another page: wait for layout, then scroll with animation
  if (location.pathname === "/") {
    let go = null; try { go = JSON.parse(sessionStorage.getItem("lv-go") || "null"); sessionStorage.removeItem("lv-go"); } catch {}
    if (go) { const fire = () => setTimeout(() => run(go), 80); document.readyState === "complete" ? fire() : addEventListener("load", fire, {once: true}); }
  }

  // ---------- scroll: shrink past 8px; tint dark over .dk sections and the footer ----------
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

  // ---------- homepage scroll-spy: mark the tab and the sidebar item for the section in view ----------
  if ("IntersectionObserver" in window && location.pathname === "/") {
    const tabs = [...nav.querySelectorAll('.links a[href^="/#"]')];
    const tabOf = {stories: "stories", inside: "stories", sources: "sources", check: "sources", pricing: "pricing", faq: "faq"};
    const itemOf = {stories: "stories", sources: "check", check: "race", pricing: "pricing", inside: "inside", blog: "blog", faq: "faq"};
    const mark = (a, on) => on ? a.setAttribute("aria-current", "location") : a.removeAttribute("aria-current");
    const vis = new Map();
    const paint = () => { let best = null, bh = 0; vis.forEach((h, id) => { if (h > bh) { bh = h; best = id; } });
      tabs.forEach(a => mark(a, best && tabOf[best] && a.getAttribute("href") === "/#" + tabOf[best]));
      items.forEach(i => mark(i, best && i.dataset.k === itemOf[best])); };
    const io = new IntersectionObserver(es => { es.forEach(e => vis.set(e.target.id, e.isIntersecting ? e.intersectionRect.height : 0)); paint(); },
      {threshold: [0, .1, .25, .5, .75, 1], rootMargin: "-80px 0px -35% 0px"});
    Object.keys(itemOf).forEach(id => { const el = document.getElementById(id); if (el) io.observe(el); });
  }
})();
