/* LaunchVault cookie consent. Public pages only (build.py adds it; the /old/app/ shell never loads it, the app has no tracking).
   One localStorage key, "lv-consent": {v, at, necessary, preferences, analytics}. Asks again after 12 months or when V changes.
   Analytics is always false: there are no analytics. If analytics is ever added, bump V so everyone is asked again.
   API for future scripts: LVConsent.allowed("necessary" | "preferences" | "analytics"), LVConsent.get(), LVConsent.open();
   a saved choice fires "lv:consent" on window. Any element with [data-consent-open] reopens the card (footer "Cookie settings").
   Styles: assets/consent.css. Policy: /old/legal/cookies/ (keep its key list in step with PREF_KEYS). */
window.LVConsent = (() => {
  const KEY = "lv-consent", V = 1, YEAR = 365 * 864e5;
  const PREF_KEYS = ["lv-lib", "lv-quiz", "lv-quiz-step"];   // remembered views and the homepage quiz: cleared while Preferences is off
  const read = () => { try { const c = JSON.parse(localStorage.getItem(KEY)); return c && c.v === V && Date.now() - c.at < YEAR ? c : null; } catch { return null; } };
  let choice = read(), box = null, panel = null, back = null, t = 0;
  const allowed = cat => cat === "necessary" || !!(choice && choice[cat]);
  const tidy = () => { if (!allowed("preferences")) PREF_KEYS.forEach(k => { try { localStorage.removeItem(k); } catch {} }); };
  addEventListener("pagehide", tidy);

  const sw = (id, on, locked) => `<button class="lvc-sw" type="button" role="switch" id="lvc-${id}" aria-checked="${on}"${locked ? " disabled" : ""} aria-describedby="lvc-${id}-d"><i aria-hidden="true"></i></button>`;
  const build = () => {
    box = document.createElement("section");
    box.className = "lvc"; box.hidden = true; box.tabIndex = -1;
    box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "false");
    box.setAttribute("aria-labelledby", "lvc-t"); box.setAttribute("aria-describedby", "lvc-d");
    box.innerHTML = `<h2 id="lvc-t">Cookies and storage</h2>
<p id="lvc-d">We store a few things on this device so the site works. <em>No ads, no tracking.</em> <a href="/old/legal/cookies/">Cookie policy</a></p>
<div class="lvc-panel" id="lvc-panel" hidden>
  <div class="lvc-row"><label for="lvc-nec">Necessary</label>${sw("nec", true, true)}<em id="lvc-nec-d">Your ticks, reading progress and this choice. Always on.</em></div>
  <div class="lvc-row"><label for="lvc-pref">Preferences</label>${sw("pref", allowed("preferences"), false)}<em id="lvc-pref-d">Remembers your homepage quiz and your Library view.</em></div>
  <div class="lvc-row"><label for="lvc-ana">Analytics</label>${sw("ana", false, true)}<em id="lvc-ana-d">Off. We don't run any analytics right now.</em></div>
</div>
<div class="lvc-btns">
  <button class="lvc-b lvc-p" type="button" data-c="all">Accept all</button>
  <button class="lvc-b" type="button" data-c="min">Only necessary</button>
  <button class="lvc-b lvc-l" type="button" data-c="choose" aria-expanded="false" aria-controls="lvc-panel">Choose</button>
</div>`;
    panel = box.querySelector("#lvc-panel");
    box.addEventListener("click", e => {
      const s = e.target.closest(".lvc-sw:not([disabled])");
      if (s) return s.setAttribute("aria-checked", s.getAttribute("aria-checked") !== "true");
      const b = e.target.closest("[data-c]"); if (!b) return;
      const c = b.dataset.c;
      if (c === "all") save(true);
      else if (c === "min") save(false);
      else if (c === "save") save(box.querySelector("#lvc-pref").getAttribute("aria-checked") === "true");
      else showPanel(true);
    });
    box.addEventListener("keydown", e => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      if (!panel.hidden) { showPanel(false); box.querySelector('[data-c="choose"]').focus(); } else close();
    });
    document.body.appendChild(box);
  };
  const showPanel = on => {
    panel.hidden = !on;
    const b = box.querySelector("[data-c=choose],[data-c=save]");
    b.dataset.c = on ? "save" : "choose"; b.textContent = on ? "Save choices" : "Choose";
    b.setAttribute("aria-expanded", on);
    if (on) box.querySelector("#lvc-pref").focus();
  };
  const open = () => {
    if (!box) build();
    clearTimeout(t);
    back = document.activeElement;
    box.querySelector("#lvc-pref").setAttribute("aria-checked", allowed("preferences"));
    showPanel(false);
    box.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => box.classList.add("on")));
    box.focus({preventScroll: true});
  };
  const close = () => {
    if (!box || box.hidden) return;
    box.classList.remove("on");
    t = setTimeout(() => { box.hidden = true; }, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 320);
    if (back && back.isConnected && back !== document.body) back.focus({preventScroll: true});
  };
  const save = prefs => {
    choice = {v: V, at: Date.now(), necessary: true, preferences: !!prefs, analytics: false};
    try { localStorage.setItem(KEY, JSON.stringify(choice)); } catch {}
    tidy();
    dispatchEvent(new CustomEvent("lv:consent", {detail: choice}));
    close();
  };

  document.addEventListener("click", e => { const a = e.target.closest("[data-consent-open]"); if (a) { e.preventDefault(); open(); } });
  const start = () => { if (!choice && !location.pathname.startsWith("/old/app/")) open(); };
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", start) : start();
  return {allowed, open, get: () => choice};
})();
