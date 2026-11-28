/* Story course pages (build_story.py): motion, the pinned numbers, the fit check, chapter ticks and the lesson quota.
   Quota rules (Supabase RPCs lesson_status / lesson_open / lesson_remind; the database is the judge, this only shows it):
   story homes are public; chapter 1 is free for any account; other chapters go through lesson_open; Pro and the judge pass read everything.
   The chapter text is not in the page: /api/lesson returns it after the same check (signed-out visitors get the header and the sign-up gate).
   A backend outage shows a retry message, never the text. */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const get = (k, d = null) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
  const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} dispatchEvent(new Event("lv:changed")); };
  const toast = m => window.LVToast && LVToast(m);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const zoom = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--z")) || 1;

  // old reader links (#ph3, #todo) land on the new routes
  { const m = /^#ph(\d+)$/.exec(location.hash);
    if ($("[data-story]") && m) location.replace(location.pathname + m[1] + "/");
    else if ($("[data-story]") && location.hash === "#todo") location.replace("/app/checklists/");
    else if ($("[data-story]") && location.hash === "#phases") { const d = $("#doors"); if (d) d.scrollIntoView(); } }

  // ---------- hero: staggered rise on load (not scroll-driven) ----------
  $$("[data-rise]").forEach((el, i) => {
    if (reduce || !el.animate) { el.style.opacity = 1; return; }
    el.style.animation = "none";
    el.animate([{opacity: 0, transform: "translateY(18px)"}, {opacity: 1, transform: "none"}], {duration: 900, delay: 80 + i * 110, easing: "cubic-bezier(.16,1,.3,1)", fill: "both"})
      .finished.then(() => { el.style.opacity = 1; }, () => {});
  });

  // ---------- reveal on scroll ----------
  const io = reduce || !("IntersectionObserver" in window) ? null : new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { io.unobserve(e.target); e.target.classList.add("in"); } }), {threshold: .12, rootMargin: "0px 0px -8% 0px"});
  const reveal = root => $$("[data-reveal]", root).forEach(el => io ? io.observe(el) : el.classList.add("in"));
  reveal(document);

  // ---------- The numbers: pinned while the stats count up and the line draws (scroll-driven, reversible) ----------
  const pin = $("[data-pin]");
  if (pin) {
    const inner = pin.firstElementChild, line = $("[data-line]", pin), end = $("[data-end]", pin);
    const counts = $$("[data-count]", pin).map(el => {   // same parse as the public site's count-up (motion.js prepCount)
      const full = el.textContent, m = full.match(/\d[\d,]*(\.\d+)?/); if (!m) return null;
      const dec = m[1] ? m[1].length - 1 : 0, to = parseFloat(m[0].replace(/,/g, ""));
      el.setAttribute("aria-label", full);
      return {el, full, num: m[0], to, dec, w: 0};
    }).filter(Boolean);
    const fmt = (v, dec) => v.toLocaleString("en-US", {minimumFractionDigits: dec, maximumFractionDigits: dec});
    const set = p => {
      counts.forEach(c => { c.el.textContent = p >= 1 ? c.full : c.full.replace(c.num, fmt(c.to * p, c.dec)); });
      if (line) { line.style.strokeDasharray = "1"; line.style.strokeDashoffset = String(1 - p); }
      if (end) end.style.opacity = p > .97 ? 1 : 0;
    };
    const ease = p => 1 - Math.pow(1 - p, 3);
    if (reduce) set(1);
    else {
      // numbers keep their final width while counting, so the row never jumps
      counts.forEach(c => { c.el.style.minWidth = c.el.getBoundingClientRect().width / zoom() + "px"; c.el.style.display = "inline-block"; });
      let extra = 0, pt = 0, pinned = false, played = false;
      const layout = () => {
        const z = zoom(), vh = innerHeight, h = inner.getBoundingClientRect().height, phone = innerWidth <= 720;
        pinned = h < vh - 24;   // a card taller than the screen is never pinned (phones keep scrolling freely)
        extra = pinned ? vh * (phone ? .22 : .6) : 0; pt = pinned ? Math.max(12, (vh - h) / 2) : 0;
        pin.classList.toggle("on", pinned);
        pin.style.height = pinned ? (h + extra) / z + "px" : "";
        inner.style.setProperty("--pt", pt / z + "px");
        tick();
      };
      const tick = () => {
        if (pinned) return set(ease(clamp((pt - pin.getBoundingClientRect().top) / extra, 0, 1)));
        if (played) return;
        const r = pin.getBoundingClientRect();
        if (r.top < innerHeight * .75) { played = true; const t0 = performance.now(); const f = t => { const p = clamp((t - t0) / 1400, 0, 1); set(ease(p)); if (p < 1) requestAnimationFrame(f); }; requestAnimationFrame(f); }
        else set(0);
      };
      let raf = 0; addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; tick(); }); }, {passive: true});
      addEventListener("resize", () => { clearTimeout(layout.t); layout.t = setTimeout(layout, 150); });
      set(0); (document.fonts ? document.fonts.ready : Promise.resolve()).then(layout);
    }
  }

  // ---------- Is it a good reference? ----------
  const fit = $("[data-fit]");
  if (fit) {
    const sum = $("[data-fsum]", fit), pinB = $("[data-pin-ref]", fit);
    const paint = () => { const a = $$("[data-fq]", fit).map(q => { const b = $('[aria-pressed="true"]', q); return b ? +b.dataset.yn : null; }).filter(x => x !== null);
      const no = a.filter(x => !x).length;
      sum.innerHTML = "So far: <b>" + (!a.length ? "answer the questions" : !no ? "looks like a good fit" : no === 1 ? "partly a fit" : "maybe not the closest match") + "</b>"; };
    fit.addEventListener("click", e => { const b = e.target.closest("[data-yn]"); if (!b) return;
      $$("[data-yn]", b.parentElement).forEach(x => x.setAttribute("aria-pressed", x === b && x.getAttribute("aria-pressed") !== "true")); paint(); });
    pinB.addEventListener("click", () => { const slug = pinB.dataset.pinRef, star = $(`.shero [data-star="${slug}"]`);
      if (star && star.getAttribute("aria-pressed") !== "true") star.click();
      setTimeout(() => toast("Pinned. It's in Saved when you plan your next step."), 30); pinB.textContent = "Pinned"; });
  }

  // ---------- Steal this: ticks (story checklist steps share the Checklists page's key) + Copy all ----------
  const steal = root => $$("[data-steal]", root).forEach(box => {
    const key = box.dataset.steal, rows = $$(".stk", box);
    const paint = () => { const v = get(key, []); rows.forEach(r => r.setAttribute("aria-checked", !!(Array.isArray(v) && v[+r.dataset.i]))); };
    box.addEventListener("click", e => { const r = e.target.closest(".stk");
      if (r) { const v = get(key, []), a = Array.isArray(v) ? v : [], i = +r.dataset.i; a[i] = !a[i]; for (let j = 0; j < a.length; j++) a[j] = !!a[j]; put(key, a); paint(); return; }
      if (e.target.closest("[data-copyall]")) { const t = rows.map(r => "- " + $(".stt", r).textContent).join("\n");
        (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast("Copied the checklist."), () => toast("Couldn't copy. Select the steps instead.")); } });
    paint(); addEventListener("storage", paint);
  });
  steal(document);

  // ---------- lesson page: the quota ----------
  const L = $("[data-lesson]");
  if (!L) return;
  const slug = L.dataset.slug, ch = +L.dataset.ch;
  const MON = "January February March April May June July August September October November December".split(" ");
  const nextReset = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString(); };
  const day = (iso, long) => { const d = new Date(iso || nextReset()); return (long ? MON[d.getMonth()] : MON[d.getMonth()].slice(0, 3)) + " " + d.getDate(); };
  const meter = $("[data-meter]"), mt = $("[data-metert]");
  const seen = () => { const v = get("lv-seen-" + slug, []); return Array.isArray(v) ? v : []; };
  const marks = (opened = []) => { const s = new Set([...seen(), ...opened]);
    $$(".lch").forEach(a => { const k = +a.dataset.ch; a.classList.toggle("ldone", k !== ch && s.has(k)); }); };
  marks();
  const nextHint = st => { const h = $("[data-nexthint]"), a = $("[data-next]"); if (!h || !a) return; const k = +a.dataset.next;
    const free = !st || st.limit == null || st.plan === "pro" || st.plan === "judge" || (st.opened || []).some(o => o.story === slug && +o.chapter === k);
    h.textContent = free ? "Next chapter" : "Next chapter · uses 1 free lesson"; };
  const paintMeter = st => {
    meter.hidden = false; const bars = $$(".lmb i", meter);
    if (st.limit == null) { bars.forEach(b => b.classList.add("on")); mt.innerHTML = `<b>${st.plan === "judge" ? "Judge view" : "Pro"}</b> · every lesson open`; return; }
    const left = Math.max(0, st.limit - st.used), on = Math.round(left / st.limit * bars.length);
    bars.forEach((b, i) => b.classList.toggle("on", i >= bars.length - on));
    mt.innerHTML = `<b>${left} of ${st.limit}</b> ${st.plan === "student" ? "student" : "free"} lessons left · resets ${day(st.resets_at)}`;
    put("lv-lessons", {plan: st.plan, used: st.used, limit: st.limit, resets_at: st.resets_at || nextReset()}); dispatchEvent(new Event("lv:lessons"));
  };
  const body = $("[data-lbody]"), retryBox = $("[data-retry]");
  let lastSt = null;
  const show = html => { L.dataset.state = "open"; body.innerHTML = html; body.hidden = false; $("[data-tease]").hidden = true; $("[data-gate]").hidden = true; retryBox.hidden = true;
    reveal(body); steal(body); nextHint(lastSt);
    const s = seen(); if (!s.includes(ch)) put("lv-seen-" + slug, [...s, ch].sort((a, b) => a - b));
    put("lv-last", {slug, ph: ch, t: Date.now()}); };
  const retry = () => { L.dataset.state = "retry"; body.hidden = true; $("[data-gate]").hidden = true; retryBox.hidden = false; };
  const gate = (kind, st = {}) => {
    L.dataset.state = kind === "out" ? "out" : "gate"; body.hidden = true; retryBox.hidden = true; const g = $("[data-gate]"); g.hidden = false;
    $("[data-teaset]").textContent = st.tease || ""; $("[data-tease]").hidden = kind === "out" || !st.tease;   // signed-out visitors see the header and the gate only
    const lim = st.limit || 5, when = day(st.resets_at, true), here = encodeURIComponent(location.pathname);
    const T = (sel, v, html) => { const el = $(sel, g); if (el) el[html ? "innerHTML" : "textContent"] = v; };
    if (kind === "out") {
      T("[data-gh]", "Sign up to start reading");
      T("[data-gs]", "Chapters are for members. A free account opens Chapter 1 of every story plus 5 more lessons a month, and students get 10.");
      $("[data-gpro]", g).href = "/sign-up/?next=" + here; T("[data-gpt]", "Create a free account"); T("[data-gpd]", "5 lessons a month, free"); T("[data-gpb]", "Sign up");
      $("[data-gstu]", g).href = "/sign-up/?next=" + encodeURIComponent("/app/account/#student");
      T("[data-gwt]", "Already have an account?"); const r = $("[data-remind]", g); r.textContent = "Sign in"; r.onclick = () => { location.href = "/sign-in/?next=" + here; };
    } else {
      const stu = st.plan === "student";
      T("[data-gh]", `You've read your ${lim} ${stu ? "student" : "free"} lessons this month`);
      T("[data-gs]", `Your next ${lim} open on <b>${when}</b>. You can still open every story's home page, its numbers and videos, and Chapter 1 of any story.`, true);
      $("[data-gstu]", g).hidden = stu;
      T("[data-gwt]", `Happy to wait? We'll email you on ${when} when your lessons reset.`);
      $("[data-remind]", g).onclick = async e => { const b = e.currentTarget; b.disabled = true;
        try { const sb = await client(); const {error} = await sb.rpc("lesson_remind"); if (error) throw error; b.textContent = "We'll remind you"; toast(`We'll email you on ${when}.`); }
        catch { b.disabled = false; toast("That didn't go through. Try again in a minute."); } };
    }
  };
  // the app's signed-in Supabase client (assets/supabase.js, Clerk token), same as Community
  let sbP = null;
  const client = () => sbP || (sbP = (async () => {
    const c = window.LVAuth && LVAuth.live ? await LVAuth.load() : null; if (!c || !c.user) throw new Error("signed out");
    for (let i = 0; i < 60 && !window.LVSync; i++) { if (!i && !$('script[src="/assets/supabase.js"]')) { const s = document.createElement("script"); s.src = "/assets/supabase.js"; document.head.appendChild(s); } await new Promise(r => setTimeout(r, 100)); }
    return LVSync.make(c); })());
  const one = d => Array.isArray(d) ? d[0] : d;
  const timeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
  const likelyIn = () => /(?:^|;\s*)__client_uat(?:_[^=]*)?=(?!0(?:;|$))\d+/.test(document.cookie);   // Clerk's own signed-in marker (same test as auth.js)
  const load = async () => {
    const judge = get("lv-judge") === "SPARK2026";
    let c = null;
    try { c = window.LVAuth && LVAuth.live ? await timeout(LVAuth.load(), 8000) : null; } catch { if (!judge) return likelyIn() ? retry() : gate("out"); }
    const user = !!(c && c.user);
    if (!user && !judge) return gate("out");
    const h = {}; if (judge) h["x-lv-judge"] = "SPARK2026";
    try { if (user) h.Authorization = "Bearer " + await timeout(c.session.getToken(), 8000); } catch { if (!judge) return retry(); }
    let r, d;
    try { r = await timeout(fetch(`/api/lesson?story=${encodeURIComponent(slug)}&ch=${ch}`, {headers: h, cache: "no-store", credentials: "same-origin"}), 12000); d = await r.json(); }
    catch { return retry(); }   // outage: a retry message, never the text (it only comes from the server now)
    if (r.status === 402) { gate("limit", d); paintMeter(d); return; }
    if (r.status === 401) return gate("out");
    if (!r.ok || typeof d.html !== "string") return retry();
    if (d.status && d.status.plan === "judge") paintMeter({plan: "judge", limit: null});
    show(d.html);
    if (!user) return;
    try { const sb = await timeout(client(), 8000), {data, error} = await timeout(sb.rpc("lesson_status"), 8000); if (error) throw error;
      const st = one(data); if (st) { lastSt = st; paintMeter(st); marks((st.opened || []).filter(o => o.story === slug).map(o => +o.chapter)); nextHint(st); } } catch {}
  };
  $("[data-retrybtn]").addEventListener("click", () => { L.dataset.state = "wait"; retryBox.hidden = true; load(); });
  load();
})();
