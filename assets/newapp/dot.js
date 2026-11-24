/* LaunchVault assistant character ("Dot"): a small round glazed treat that sits on every app page.
   First version, no AI of its own yet: it can be dragged anywhere, watches the pointer, opens a small panel, points at things
   on the page, and hands a typed question to the Ask page. Flavour and on/off live in Settings > Preferences.
   Stored on this device: lv-dot ("off" hides it), lv-dot-flavour, lv-dot-pos ([x, y] as fractions of the window).
   ponytail: page tips are a fixed list per page; the agent network replaces them (docs/specs/2026-11-24-ask-character-and-agentic-web-design.md). */
(() => {
  "use strict";
  if (!window.LVGate || !LVGate.ok) return;                       // nothing before the age gate passes
  const d = document, w = window, $ = (s, r = d) => r.querySelector(s);
  const ls = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches, small = () => innerWidth <= 720;
  const z = () => parseFloat(getComputedStyle(d.documentElement).getPropertyValue("--z")) || 1;

  /* ---------- drawing: one body, five coatings ---------- */
  const FL = {
    honey:      { name: "Honey dip",        body: "#DE9440", feet: "#B9762A", glaze: "#F3C27A", cheek: "#F08A5A", top: "shine" },
    chocolate:  { name: "Chocolate glazed", body: "#96613F", feet: "#6A4129", glaze: "#5A3320", cheek: "#D97B58", top: "powder" },
    sprinkle:   { name: "Sprinkle",         body: "#DE9440", feet: "#B9762A", glaze: "#FFF3EA", cheek: "#F08A5A", top: "sprinkles" },
    strawberry: { name: "Strawberry",       body: "#DE9440", feet: "#B9762A", glaze: "#FF8FA8", cheek: "#F08A5A", top: "white" },
    old:        { name: "Old fashioned",    body: "#CF8A44", feet: "#A8692A", glaze: "",        cheek: "#F08A5A", top: "cracks" },
  };
  const L = (p, c, sw = 3.2) => `<path d="${p}" stroke="${c}" stroke-width="${sw}" stroke-linecap="round"/>`;
  const TOP = {
    shine: L("M23 31 Q29 21 40 18", "#fff") + '<circle cx="47" cy="17.5" r="1.9" fill="#fff"/>',
    powder: [[30, 27, 1.9], [40, 20, 1.5], [52, 24, 2.1], [63, 19, 1.5], [72, 29, 1.9], [45, 33, 1.4], [60, 35, 1.6], [22, 37, 1.4], [80, 39, 1.4]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff"/>`).join(""),
    sprinkles: L("M29 29 l5 3", "#00C27A") + L("M45 22 l6 -1", "#2F6BFF") + L("M62 26 l4 4", "#7B5CFF") + L("M73 36 l5 -2", "#FF4D1F") + L("M37 37 l4 -3", "#FF4D1F") + L("M54 34 l5 2", "#00C27A"),
    white: L("M23 31 Q29 21 40 18", "#fff") + L("M52 24 l5 2", "#fff", 3) + L("M66 30 l4 -3", "#fff", 3) + L("M40 34 l4 3", "#fff", 3) + L("M75 39 l4 1", "#fff", 3),
    cracks: L("M24 34 Q33 27 41 31", "#A8692A", 3) + L("M57 25 Q66 23 73 30", "#A8692A", 3) + L("M44 41 Q51 37 58 41", "#A8692A", 3),
  };
  const draw = (flavour, size = 64) => { const f = FL[flavour] || FL.honey;
    return `<svg width="${size}" height="${size}" viewBox="0 -3 100 100" fill="none" aria-hidden="true">
<ellipse cx="38" cy="90" rx="9" ry="5" fill="${f.feet}"/><ellipse cx="62" cy="90" rx="9" ry="5" fill="${f.feet}"/>
<path d="M50 13 C74 13 90 31 90 54 C90 76 74 89 50 89 C26 89 10 76 10 54 C10 31 26 13 50 13 Z" fill="${f.body}"/>
${f.glaze ? `<path d="M11 46 C13 27 29 13 50 13 C71 13 87 27 89 46 C85 51 80 51 76 46 C72 41 67 42 64 48 C61 54 55 54 52 48 C49 42 44 42 41 47 C38 53 32 54 28 48 C24 42 16 43 11 46 Z" fill="${f.glaze}"/>` : ""}${TOP[f.top]}
<g class="lvdot-eyes"><ellipse cx="38" cy="63" rx="5.5" ry="7" fill="#0B0B10"/><ellipse cx="62" cy="63" rx="5.5" ry="7" fill="#0B0B10"/><circle cx="40" cy="60.2" r="2.1" fill="#fff"/><circle cx="64" cy="60.2" r="2.1" fill="#fff"/></g>
<g class="lvdot-glad">${L("M31 65 Q38 56 45 65", "#0B0B10", 3.4)}${L("M55 65 Q62 56 69 65", "#0B0B10", 3.4)}</g>
<ellipse cx="26" cy="72" rx="5.5" ry="3.3" fill="${f.cheek}"/><ellipse cx="74" cy="72" rx="5.5" ry="3.3" fill="${f.cheek}"/>
${L("M46 72 Q50 76 54 72", "#0B0B10", 2.4)}</svg>`; };

  /* ---------- saved choices, and a draft the Settings save bar commits or throws away ---------- */
  const saved = () => ({ on: ls.get("lv-dot") !== "off", flavour: FL[ls.get("lv-dot-flavour")] ? ls.get("lv-dot-flavour") : "honey" });
  let draft = saved(), el = null, panel = null, btn = null;

  /* ---------- what it can point at, per page ---------- */
  const TIPS = {
    "p-home": [["What should I do next?", "[data-homecl]", "Your next step is right here."]],
    "p-lib": [["Which story is free this week?", ".feat", "This one. Every phase of it is open this week."]],
    "p-path": [["What's my next step?", ".rstep.open", "This is the one to do next."]],
    "p-story": [["What's my step for this phase?", "[data-rstepc]", "This is the step that goes with what you just read."]],
    "p-ck": [["Where do I start?", ".ckw", "Start with this one. Tick it when it's done."]],
    "p-chat": [["Where are the rules?", '.cm-chans a[href="#chat/welcome"]', "The Rules channel, here."]],
    "p-acct": [["Where do I change my email?", "[data-emchange]", "Here. It sends a code to your current email first."], ["Where are the plans?", "#plan", "All the plans are in this card."]],
    "p-ask": [],
  };
  const HELLO = { "p-home": "Hi. Ask me something, or let me show you what's next.", "p-lib": "Ten stories here. Want a hand picking one?", "p-path": "This is your path. I can point at your next step.", "p-story": "Reading? Ask me anything about this story.",
    "p-ck": "These are your checklists.", "p-chat": "This is where members talk.", "p-acct": "Settings. I can show you where things are.", "p-ask": "This is my full-size chat. Type below." };
  const page = () => [...d.body.classList].find(c => TIPS[c]) || "";

  function point(sel, text) {
    const t = $(sel);
    if (!t || !t.offsetParent) { say("I can't see that on this page right now."); return; }
    mood("pointing"); say(text);
    t.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    d.querySelectorAll(".lvdot-ring").forEach(n => n.classList.remove("lvdot-ring"));
    setTimeout(() => {
      if (!el) return;                                                // hidden or rebuilt in the meantime
      t.classList.add("lvdot-ring");
      const r = t.getBoundingClientRect(), k = z(), cur = $(".lvdot-cur") || d.body.appendChild(Object.assign(d.createElement("span"), { className: "lvdot-cur", innerHTML: '<svg viewBox="0 0 20 22" width="22" height="24"><path d="M4 3.2 C4 2.2 5.1 1.6 6 2.2 L17.2 9.9 C18.1 10.5 17.8 11.9 16.7 12.1 L11.9 13 L9.4 17.6 C8.9 18.6 7.4 18.4 7.2 17.3 Z" fill="#FF4D1F" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>' }));
      const b = el.getBoundingClientRect();
      cur.style.transition = "none"; cur.style.transform = `translate(${(b.left + b.width / 2) / k}px,${(b.top + b.height / 2) / k}px)`; cur.style.opacity = 1; void cur.offsetWidth;
      cur.style.transition = reduce ? "none" : "transform .7s cubic-bezier(.16,1,.3,1),opacity .3s";
      cur.style.transform = `translate(${(r.left + Math.min(r.width - 8, 24)) / k}px,${(r.top + Math.min(r.height - 8, 20)) / k}px)`;
      setTimeout(() => { t.classList.remove("lvdot-ring"); cur.style.opacity = 0; if (panel) mood(panel.hidden ? "idle" : "listening"); }, 5200);
    }, reduce ? 0 : 450);
  }
  const say = t => { $(".lvdot-say", panel).textContent = t; };
  const mood = m => { if (el) el.dataset.mood = m; };

  function open(on) {
    panel.hidden = !on; btn.setAttribute("aria-expanded", on); mood(on ? "listening" : "idle");
    if (!on) return;
    const pg = page(), tips = TIPS[pg] || [];
    say(HELLO[pg] || "Hi. Ask me anything.");
    $(".lvdot-tips", panel).innerHTML = tips.map((t, i) => `<button type="button" data-tip="${i}">${t[0]}</button>`).join("");
    place(); const inp = $("input", panel); if (inp && !small()) inp.focus({ preventScroll: true });
  }
  function place() {                                                  // the panel opens toward the middle of the window
    if (!el) return; const r = el.getBoundingClientRect();
    panel.dataset.x = r.left + r.width / 2 > innerWidth / 2 ? "l" : "r"; panel.dataset.y = r.top + r.height / 2 > innerHeight / 2 ? "u" : "d";
  }
  function setPos(fx, fy) { const k = z(), s = 68; el.style.left = Math.max(8, Math.min(innerWidth / k - s - 8, fx * innerWidth / k)) + "px"; el.style.top = Math.max(8, Math.min(innerHeight / k - s - 8, fy * innerHeight / k)) + "px"; el.style.right = el.style.bottom = "auto"; }

  function build() {
    if (el) el.remove();
    el = d.createElement("div"); el.className = "lvdot"; el.dataset.mood = "idle";
    el.innerHTML = `<button class="lvdot-b" type="button" aria-label="Open the assistant" aria-expanded="false" aria-controls="lvdotP">${draw(draft.flavour)}</button>
<div class="lvdot-p" id="lvdotP" role="dialog" aria-label="Assistant" hidden><p class="lvdot-say" role="status"></p><div class="lvdot-tips"></div>
<form><input type="text" maxlength="400" placeholder="Ask me anything" aria-label="Ask a question" enterkeyhint="send"><button type="submit" aria-label="Send to Ask"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button></form>
<a class="lvdot-set" href="/app/account/#prefs">Change flavour or hide me</a></div>`;
    d.body.appendChild(el); btn = $(".lvdot-b", el); panel = $(".lvdot-p", el);
    const pos = ls.get("lv-dot-pos"); if (Array.isArray(pos) && !small()) setPos(pos[0], pos[1]);

    /* drag (wide screens), or a plain tap */
    let sx = 0, sy = 0, ox = 0, oy = 0, drag = false, down = false;
    btn.addEventListener("pointerdown", e => { down = true; drag = false; sx = e.clientX; sy = e.clientY; const r = el.getBoundingClientRect(); ox = e.clientX - r.left; oy = e.clientY - r.top; try { btn.setPointerCapture(e.pointerId); } catch {} });
    btn.addEventListener("pointermove", e => { if (!down || small()) return;
      if (!drag && Math.hypot(e.clientX - sx, e.clientY - sy) < 6) return;
      drag = true; el.classList.add("drag"); if (!panel.hidden) open(false);
      setPos((e.clientX - ox) / innerWidth, (e.clientY - oy) / innerHeight); });
    const up = () => { if (!down) return; down = false; el.classList.remove("drag");
      if (drag) { const r = el.getBoundingClientRect(); ls.set("lv-dot-pos", [+(r.left / innerWidth).toFixed(4), +(r.top / innerHeight).toFixed(4)]); } };
    btn.addEventListener("pointerup", up); btn.addEventListener("pointercancel", up);
    btn.addEventListener("click", e => { if (drag) { e.preventDefault(); drag = false; return; } open(panel.hidden); });

    panel.addEventListener("click", e => { const t = e.target.closest("[data-tip]"); if (t) { const tip = (TIPS[page()] || [])[+t.dataset.tip]; if (tip) point(tip[1], tip[2]); } });
    $("form", panel).addEventListener("submit", e => { e.preventDefault(); const v = $("input", panel).value.trim(); if (!v) return;
      const a = $("#asIn");                                           // on the Ask page it goes straight into the box
      if (a && !a.disabled) { a.value = v; a.dispatchEvent(new Event("input")); a.focus(); open(false); return; }
      mood("thinking"); location.href = "/app/assistant/?q=" + encodeURIComponent(v); });
    d.addEventListener("keydown", e => { if (e.key === "Escape" && panel && !panel.hidden) { open(false); btn.focus(); } });
  }
  d.addEventListener("click", e => { if (panel && !panel.hidden && !e.target.closest(".lvdot")) open(false); });

  /* eyes follow the pointer a little (mouse only); a blink is CSS */
  if (!reduce && matchMedia("(hover:hover) and (pointer:fine)").matches) {
    let q = 0; addEventListener("pointermove", e => { if (!el || q) return; q = requestAnimationFrame(() => { q = 0; if (!el) return;
      const r = el.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2), n = Math.hypot(dx, dy) || 1, k = Math.min(1, n / 240);
      el.style.setProperty("--ex", (dx / n * 3.2 * k).toFixed(2) + "px"); el.style.setProperty("--ey", (dy / n * 2.6 * k).toFixed(2) + "px"); }); }, { passive: true });
  }
  addEventListener("resize", () => { if (!el) return; if (small()) { el.style.left = el.style.top = el.style.right = el.style.bottom = ""; } else { const p = ls.get("lv-dot-pos"); if (Array.isArray(p)) setPos(p[0], p[1]); } });

  const show = () => { if (draft.on) build(); else if (el) { el.remove(); el = panel = btn = null; } };

  /* ---------- Settings > Preferences: the switch and the flavour picker ---------- */
  function controls() {
    const sw = $("[data-doton]"), box = $("[data-dotfl]"); if (!sw || !box) return;
    const sync = () => { sw.setAttribute("aria-checked", draft.on); box.innerHTML = Object.keys(FL).map(k => `<button type="button" role="radio" aria-checked="${draft.flavour === k}" data-fl="${k}" title="${FL[k].name}">${draw(k, 44)}<span>${FL[k].name}</span></button>`).join(""); box.classList.toggle("off", !draft.on); };
    sw.addEventListener("click", () => { draft.on = !draft.on; sync(); show(); dispatchEvent(new Event("lv:dot-held")); });
    box.addEventListener("click", e => { const b = e.target.closest("[data-fl]"); if (!b) return; draft.flavour = b.dataset.fl; sync(); show(); dispatchEvent(new Event("lv:dot-held")); });
    sync(); api.sync = sync;
  }
  const api = w.LVDot = {
    dirty: () => { const s = saved(); return s.on !== draft.on || s.flavour !== draft.flavour; },
    commit: () => { ls.set("lv-dot", draft.on ? "on" : "off"); ls.set("lv-dot-flavour", draft.flavour); },
    revert: () => { draft = saved(); show(); if (api.sync) api.sync(); },
    point,
  };
  const start = () => { show(); controls(); };
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", start); else start();
})();
