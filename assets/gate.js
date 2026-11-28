/* LaunchVault age gate. Loaded in the <head> of every /app/ page, before anything else runs (NOT deferred, on purpose).
   Rule: nobody under 13 uses the app. The public site and the blog stay open to everyone.
   - First entry: "When's your birthday?" The birthday is stored ("lv-dob", YYYY-MM-DD) with the age range worked out from it
     ("lv-age", the strings assets/supabase.js maps; chat and plan rules read the range). The age is exact, to the day.
   - Under 13: every "lv-" key is cleared and one flag is kept ("lv-age-block": localStorage + a 1-year cookie) so a different date can't be tried.
   - app.js does nothing until LVGate.ok is true, so nothing is written before the gate passes. */
window.LVGate = (() => {
  const RANGES = ["13 to 15", "16 to 17", "18 to 20", "21 or older"], KEY = "lv-age", BLOCK = "lv-age-block", YEAR = 365 * 864e5;
  const get = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
  const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return get(k) === v; } catch { return false; } };
  const cookie = secs => { document.cookie = `${BLOCK}=1; max-age=${Math.round(secs)}; path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`; };
  const hasCookie = () => /(?:^|; )lv-age-block=1/.test(document.cookie);
  const wipe = () => [localStorage, sessionStorage].forEach(s => { try { Object.keys(s).filter(k => k.startsWith("lv-") && k !== BLOCK).forEach(k => s.removeItem(k)); } catch {} });
  // exact age from a birthday -> the stored range, or null for under 13 (or a date that can't be real)
  const ageOf = (dob, now = new Date()) => { const [y, m, d] = String(dob).split("-").map(Number); let a = now.getFullYear() - y;
    if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) a--; return a; };
  const okDob = (v, now = new Date()) => { const m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(v || ""); if (!m) return false; const t = new Date(+m[1], +m[2] - 1, +m[3]);
    return t.getMonth() === +m[2] - 1 && t <= now && +m[1] >= now.getFullYear() - 110; };
  const rangeForDob = (dob, now = new Date()) => { if (!okDob(dob, now)) return null; const a = ageOf(dob, now); return a < 13 ? null : a <= 15 ? RANGES[0] : a <= 17 ? RANGES[1] : a <= 20 ? RANGES[2] : RANGES[3]; };
  const today = () => { const n = new Date(); return n.getFullYear() + "-" + String(n.getMonth() + 1).padStart(2, "0") + "-" + String(n.getDate()).padStart(2, "0"); };
  // older devices answered with a birth year only: youngest possible age -> range
  const rangeFor = (year, now = new Date().getFullYear()) => { const a = now - year - 1; return a < 13 ? null : a <= 15 ? RANGES[0] : a <= 17 ? RANGES[1] : a <= 20 ? RANGES[2] : RANGES[3]; };

  const t = get(BLOCK), left = typeof t === "number" ? t + YEAR - Date.now() : 0;
  if (t != null && left <= 0) { try { localStorage.removeItem(BLOCK); } catch {} }
  const blocked = left > 0 || hasCookie();
  if (blocked) { wipe(); if (left > 0) cookie(left / 1000); else put(BLOCK, Date.now()); }   // keep both copies of the flag in step
  const ok = !blocked && RANGES.includes(get(KEY));
  if (ok) return {ok, rangeFor, rangeForDob, today};
  // hackathon judges (judge code typed on /sign-in/) skip the question
  if (!blocked && get("lv-judge") === "SPARK2026") return {ok: true, rangeFor, rangeForDob, today};

  const root = document.documentElement;
  const pub = /^\/app\/story\/[a-z0-9-]+\/(\d+\/)?$/.test(location.pathname);   // public story pages stay visible until auth.js asks (signed-in accounts only)
  if (!pub) root.classList.add("gated");   // app.css hides the app while the gate is up
  const LOGO = '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="#2563EB" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M19.99 14.91A8.5 8.5 0 1 1 10.52 3.63"/><path d="M6.8 15.6l3.7-3.7 2.6 2.6 6.7-6.7"/><path d="M16 7.8h3.8v3.8"/></g></svg>';
  const CHECK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const el = document.createElement("div"); el.className = "agate";
  const frame = inner => { el.innerHTML = `<header class="agh"><a href="/" aria-label="LaunchVault home">${LOGO}<span>LaunchVault</span></a></header><main class="agm" id="main">${inner}</main>`; };
  const stop = () => {
    frame(`<section class="agc agb"><span class="agi" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20.5s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.7a4.3 4.3 0 0 1 7.5 2.8c0 5.6-7.5 10-7.5 10z"/></svg></span>
<h1 tabindex="-1">LaunchVault is for ages 13 and up</h1><p>We didn't save your answer or anything else about you. You can still read our public stories on the blog.</p>
<div class="aga"><a class="btn btn-p" href="/blog/">Read the blog</a></div></section>`);
    document.title = "For ages 13 and up · LaunchVault";
  };
  const ask = () => {
    frame(`<form class="agc" novalidate><h1 id="agq" tabindex="-1">When's your birthday?</h1><p>One question before you start. Your birthday stays private and is never shown to other members.</p>
<label class="agd"><span>Birthday</span><input type="date" name="dob" autocomplete="bday" max="${today()}" required></label><p class="age" role="alert" hidden></p>
<div class="aga"><button class="btn btn-p" type="submit" disabled>Continue</button></div></form>`);
    const f = el.querySelector("form"), inp = f.querySelector("input"), go = f.querySelector("button"), m = f.querySelector(".age");
    f.addEventListener("input", () => { go.disabled = !okDob(inp.value); m.hidden = true; });
    f.addEventListener("submit", e => { e.preventDefault();
      const v = inp.value; if (!okDob(v)) return;
      const r = rangeForDob(v);
      if (!r) { wipe(); put(BLOCK, Date.now()); cookie(YEAR / 1000); stop(); el.querySelector("h1").focus(); return; }
      if (put("lv-dob", v) && put(KEY, r)) return location.reload();   // the app starts clean, with the birthday and its range set
      m.hidden = false; m.textContent = "LaunchVault needs to save your birthday on this device, and this browser is blocking storage. Turn off private browsing or allow site data, then try again."; });
  };
  const mount = () => { blocked ? stop() : ask(); document.body.appendChild(el); };
  let started = false;
  const start = () => { if (started) return; started = true; root.classList.add("gated"); document.body ? mount() : document.addEventListener("DOMContentLoaded", mount); };
  // the sign-in wall comes first: auth.js calls LVGate.start() once Clerk confirms an account (or if accounts are off / Clerk fails).
  // A blocked device still sees the "13 and up" stop straight away.
  if (blocked) start();
  return {ok, rangeFor, rangeForDob, today, start};
})();
