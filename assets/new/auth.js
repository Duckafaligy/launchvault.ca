/* LaunchVault / sign-in flow: /sign-in/, /sign-up/, /welcome/ and /welcome/callback/ (one template, src/auth.part.html).
   A custom form that drives ClerkJS directly (same production instance and loader as assets/auth.js):
     Google / GitHub / Apple / Discord   signIn.authenticateWithRedirect -> CALLBACK -> WELCOME
     email code (no passwords)           signIn / signUp create -> prepare -> attempt -> setActive
   After sign-in: the age question if this device has no answer yet ("lv-age" / "lv-age-block", the SAME keys and values as
   assets/gate.js, so the app's gate agrees), "You're in." for new accounts, then `next` (default /app/).
   Anything the custom form cannot finish (2-step accounts, extra sign-up fields) falls back to Clerk's own form in the card.
   LV_PK is the Clerk PUBLISHABLE key: public by design. Never put a secret key (sk_...) in this repo.
   Preview: on localhost / 127.0.0.1 only, ?demo=signin|signup|code|age|under13|welcome|wait shows a screen with a fake backend
   (code 000000 = wrong, 111111 = expired, anything else passes). */
(() => {
  "use strict";
  const root = document.querySelector("[data-auth]"); if (!root) return;
  const $ = (s, r = root) => r.querySelector(s), $$ = (s, r = root) => [...r.querySelectorAll(s)];
  const LV_PK = "pk_live_Y2xlcmsubGF1bmNodmF1bHQuY2Ek";
  const FAPI = atob(LV_PK.split("_")[2]).replace(/\$$/, "");
  const CLERK_UI = `https://${FAPI}/npm/@clerk/ui@1/dist/ui.browser.js`, CLERK_JS = `https://${FAPI}/npm/@clerk/clerk-js@6/dist/clerk.browser.js`;
  const SIGN_IN = "/sign-in/", SIGN_UP = "/sign-up/", WELCOME = "/welcome/", CALLBACK = "/welcome/callback/", APP = "/app/";
  const JUDGE = "SPARK2026";   // same value as assets/auth.js + gate.js. ponytail: client-side code, swap for a server check if it must stay secret
  const q = new URLSearchParams(location.search);
  const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const demo = local ? q.get("demo") || "" : "";
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const EASE = "cubic-bezier(.22,1,.36,1)";
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const mode = () => root.dataset.mode;

  /* ---------- where to go afterwards: only our own paths, never the sign-in pages ---------- */
  const safeNext = v => typeof v === "string" && /^\/[\w\-./?=&%#]*$/.test(v) && !/\/\/|\.\.|^\/(sign-in|sign-up|welcome)\b/.test(v) ? v : APP;
  if (local) [["/app/x/", "/app/x/"], ["/app/start/?a=1", "/app/start/?a=1"], ["/blog/rezi/", "/blog/rezi/"], ["//evil.com", APP], ["/app/../x", APP], ["https://evil.com/app/", APP],
    ["/app//evil.com", APP], ["/sign-in/", APP], ["/welcome/", APP], [null, APP]].forEach(([a, b]) => console.assert(safeNext(a) === b, "safeNext failed for", a));
  const ss = {get: k => { try { return sessionStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch {} }};
  const next = safeNext(q.get("next") || (/^(welcome|callback)$/.test(mode()) ? ss.get("lva-next") : "") || "");
  const nq = next === APP ? "" : "?next=" + encodeURIComponent(next), nq2 = nq.replace("?", "&");

  /* ---------- age gate storage: mirrors assets/gate.js exactly (JSON values, same keys, same 1-year block) ---------- */
  const RANGES = ["13 to 15", "16 to 17", "18 to 20", "21 or older"], KEY = "lv-age", BLOCK = "lv-age-block", YEAR = 365 * 864e5;
  const get = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
  const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return get(k) === v; } catch { return false; } };
  const cookie = secs => { document.cookie = `${BLOCK}=1; max-age=${Math.round(secs)}; path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`; };
  const wipe = () => [localStorage, sessionStorage].forEach(s => { try { Object.keys(s).filter(k => k.startsWith("lv-") && k !== BLOCK).forEach(k => s.removeItem(k)); } catch {} });
  const blocked = () => { const t = get(BLOCK); return (typeof t === "number" && t + YEAR > Date.now()) || /(?:^|; )lv-age-block=1/.test(document.cookie); };
  const ageOk = () => RANGES.includes(get(KEY));
  const persist = !demo;   // the preview never writes age answers or judge codes

  /* ---------- Clerk (same no-bundler setup as assets/auth.js: UI bundle, then clerk-js, both from our Frontend API) ---------- */
  let clerk = null, loading = null;
  const script = (src, attrs = {}) => new Promise((res, rej) => {
    const s = document.createElement("script"); s.src = src; s.async = true; s.crossOrigin = "anonymous";
    Object.entries(attrs).forEach(([k, v]) => s.setAttribute(k, v)); s.onload = res; s.onerror = () => { s.remove(); rej(new Error("could not load " + src)); }; document.head.appendChild(s);
  });
  const load = () => {
    if (!loading) loading = Promise.race([
      (async () => {
        if (!window.__internal_ClerkUICtor) await script(CLERK_UI);
        if (!window.Clerk) await script(CLERK_JS, {"data-clerk-publishable-key": LV_PK});
        const c = window.Clerk;
        await c.load({ui: {ClerkUI: window.__internal_ClerkUICtor}, signInUrl: SIGN_IN, signUpUrl: SIGN_UP, signInFallbackRedirectUrl: APP, signUpFallbackRedirectUrl: APP});
        return clerk = c;
      })(),
      wait(15000).then(() => { throw new Error("clerk timed out"); }),
    ]).catch(() => { loading = null; throw {lv: "load"}; });   // a later click (or "Try again") starts over
    return loading;
  };

  /* ---------- errors: say what went wrong and what to do ---------- */
  const errOf = e => (e && e.errors && e.errors[0]) || null;
  const codeOf = e => (errOf(e) || {}).code || (e && e.lv) || "";
  const LOAD_FAIL = "Sign-in could not load. Check your connection, then try again.";
  const OAUTH_FAIL = "That sign-in did not finish. Try again, or use an email code.";
  const explain = e => {
    const x = errOf(e), k = codeOf(e);
    if (k === "load") return LOAD_FAIL;
    if (!x && (navigator.onLine === false || e instanceof TypeError)) return "No connection. Check your internet and try again.";
    if (k === "too_many_requests" || (e && e.status === 429)) return e.retryAfter ? `Too many tries. Wait ${e.retryAfter} seconds, then try again.` : "Too many tries. Wait a minute, then try again.";
    return ({
      form_code_incorrect: "That code is not right. Check the email and try again.",
      verification_expired: "That code has expired. Send a new one.",
      verification_failed: "Too many wrong tries. Send a new code.",
      form_param_format_invalid: "That email address does not look right. Check it and try again.",
      form_identifier_invalid: "That email address does not look right. Check it and try again.",
      captcha_invalid: "The bot check did not pass. Turn off any ad blocker for this page, then try again.",
      captcha_unavailable: "The bot check could not load. Turn off any ad blocker for this page, then try again.",
      oauth_access_denied: "You cancelled that sign-in. Pick an option to try again.",
    })[k] || (x && (x.longMessage || x.message)) || "Something went wrong. Try again.";
  };
  // accounts paused: the one email allowed in, as a SHA-256 hash ("" = open to everyone). ponytail: browser-side; the hard lock is Clerk's allowlist
  const LV_ONLY = "1bed0365d329c0a66c71c85ac5fb79888c0ecb223196a7f795f08f43242e3221";
  const lvAllowed = async e => { if (!LV_ONLY) return true; try { const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(e || "").trim().toLowerCase()));
    return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, "0")).join("") === LV_ONLY; } catch { return false; } };
  const needsFullUI = e => (e && e.lv === "incomplete") || (e instanceof TypeError && /not a function|undefined|null/.test(e.message || ""));
  const say = (id, text, {info = false, field = null, retry = null} = {}) => {
    const m = $("#au-msg-" + id); m.textContent = ""; m.classList.toggle("is-info", info);
    if (field) text ? field.setAttribute("aria-invalid", "true") : field.removeAttribute("aria-invalid");
    if (!text) return;
    requestAnimationFrame(() => {   // emptied first, so the same message is announced (and slides in) again
      m.textContent = text;
      if (retry) { const b = document.createElement("button"); b.type = "button"; b.className = "link"; b.textContent = "Try again"; b.addEventListener("click", retry); m.append(" ", b); }
    });
  };

  /* ---------- the card: steps cross-slide and the height animates ---------- */
  const card = $(".au-card");
  const TITLES = {code: "Check your email", age: "How old are you?", under13: "For ages 13 and up", welcome: "You're in", wait: "Signing you in", clerk: "Sign in"};
  let step = root.dataset.step, hAnim = null;
  const setTitle = () => { document.title = (step === "form" ? (mode() === "signup" ? "Sign up" : "Sign in") : TITLES[step]) + " · LaunchVault"; };
  const morph = async (mutate, focus = true) => {
    const cur = $(`.au-step[data-step="${step}"]`), h0 = card.offsetHeight, move = !reduced && !!card.animate && !document.hidden;
    if (move) await cur.animate([{opacity: 1, transform: "none"}, {opacity: 0, transform: "translateX(-18px)"}], {duration: 130, easing: "ease-in"}).finished.catch(() => {});
    mutate(); step = root.dataset.step; setTitle();   // CSS shows the step that matches data-step and plays its slide-in
    if (move) { if (hAnim) hAnim.cancel(); hAnim = card.animate({height: [h0 + "px", card.offsetHeight + "px"]}, {duration: 460, easing: EASE}); }
    const h = focus && $(`.au-step[data-step="${step}"] h1`); if (h) h.focus({preventScroll: true});
    if (step === "age") placeHl();
  };
  const show = name => name === step ? Promise.resolve() : morph(() => { root.dataset.step = name; });
  const busy = (b, on) => { b.classList.toggle("is-loading", on); b.setAttribute("aria-busy", on); };
  const isBusy = b => b.classList.contains("is-loading") || b.classList.contains("is-done");
  const tick = b => { b.classList.remove("is-loading"); b.setAttribute("aria-busy", "false"); b.classList.add("is-done"); };

  /* ---------- the backend: Clerk, or a fake one for the localhost preview ---------- */
  let pending = null, fresh = false;   // fresh = this visit made a new account
  const real = {
    async send(address) {
      const c = await load(), up = mode() === "signup";
      const signIn = async () => {
        const si = await c.client.signIn.create({identifier: address});
        const f = (si.supportedFirstFactors || []).find(x => x.strategy === "email_code");
        if (!f) throw {lv: "incomplete"};
        await si.prepareFirstFactor({strategy: "email_code", emailAddressId: f.emailAddressId}); pending = {kind: "in", r: si, id: f.emailAddressId};
      };
      const signUp = async () => {
        const su = await c.client.signUp.create({emailAddress: address});
        await su.prepareEmailAddressVerification({strategy: "email_code"}); pending = {kind: "up", r: su};
      };
      try { await (up ? signUp() : signIn()); }
      catch (e) {   // sign in with a new address makes the account; sign up with a known one signs in (as on the live site)
        const k = codeOf(e);
        if (up && k === "form_identifier_exists") await signIn(); else if (!up && k === "form_identifier_not_found") await signUp(); else throw e;
      }
    },
    resend: () => pending.kind === "in" ? pending.r.prepareFirstFactor({strategy: "email_code", emailAddressId: pending.id}) : pending.r.prepareEmailAddressVerification({strategy: "email_code"}),
    async verify(code) {
      const r = pending.kind === "in" ? await pending.r.attemptFirstFactor({strategy: "email_code", code}) : await pending.r.attemptEmailAddressVerification({code});
      if (r.status !== "complete") throw {lv: "incomplete"};
      await clerk.setActive({session: r.createdSessionId});
      return pending.kind === "up";
    },
    async oauth(strategy) {
      const c = await load(); ss.set("lva-next", next);
      await c.client.signIn.authenticateWithRedirect({strategy, redirectUrl: location.origin + CALLBACK + nq, redirectUrlComplete: location.origin + WELCOME + nq});
    },
  };
  const fake = {
    send: () => wait(700), resend: () => wait(500),
    async verify(code) { await wait(800); if (code === "000000") throw {errors: [{code: "form_code_incorrect"}]}; if (code === "111111") throw {errors: [{code: "verification_expired"}]}; return mode() === "signup"; },
    async oauth() { await wait(700); fresh = mode() === "signup"; resetProvs(); afterAuth(); },
  };
  const api = demo ? fake : real;

  /* ---------- after sign-in: age question -> welcome (new accounts) -> the app ---------- */
  const leave = b => {
    if (demo) { if (window.LV) LV.toast("Preview: this would open " + next, {type: "ok"}); return; }
    if (b) { tick(b); setTimeout(() => location.assign(next), reduced ? 0 : 500); } else location.replace(next);
  };
  const afterAuth = () => {
    const tried = ss.get("lva-try"); if (tried && persist) put("lv-last-auth", tried);
    if (persist && blocked()) return show("under13");
    if (!ageOk() || demo) return show("age");
    return fresh ? show("welcome") : leave();
  };
  const closeDoor = () => {   // under 13: same as gate.js (clear everything, keep one marker for a year)
    if (persist) { wipe(); put(BLOCK, Date.now()); cookie(YEAR / 1000); }
    // an account made minutes ago is removed, so "we kept nothing" stays true (needs "users can delete their account" on in Clerk). Older accounts are left alone.
    try { const u = clerk && clerk.user; if (u && Date.now() - new Date(u.createdAt).getTime() < 30 * 60e3) Promise.resolve(u.delete()).catch(() => {}); } catch {}
    return show("under13");
  };

  /* ---------- Clerk's own form, only when the custom flow cannot finish (or ?ui=clerk) ---------- */
  const LOOK = {
    variables: {colorPrimary: "#2F6BFF", colorBackground: "#101016", colorForeground: "#FFFFFF", colorText: "#FFFFFF", colorMutedForeground: "rgba(255,255,255,.64)", colorTextSecondary: "rgba(255,255,255,.64)",
      colorInput: "#17171D", colorInputBackground: "#17171D", colorInputForeground: "#FFFFFF", colorInputText: "#FFFFFF", colorNeutral: "#FFFFFF", colorDanger: "#FF8A8A", borderRadius: "12px", fontFamily: "inherit", fontSize: "15px"},
    elements: {rootBox: {width: "100%"}, cardBox: {width: "100%", maxWidth: "100%", boxShadow: "none", border: "0", background: "transparent"}, card: {boxShadow: "none", background: "transparent", border: "0", padding: "0"},
      footer: {background: "transparent"}, formButtonPrimary: {minHeight: "48px", fontSize: "15px", fontWeight: "600"}, socialButtonsBlockButton: {minHeight: "48px"}, formFieldInput: {minHeight: "48px"}},
  };
  const clerkUI = async () => {
    try {
      const c = await load(), o = {routing: "hash", signInUrl: SIGN_IN, signUpUrl: SIGN_UP, signInForceRedirectUrl: WELCOME + nq, signUpForceRedirectUrl: WELCOME + "?new=1" + nq2, appearance: LOOK};
      await show("clerk");
      mode() === "signup" ? c.mountSignUp($("#au-clerk"), o) : c.mountSignIn($("#au-clerk"), o);
    } catch (e) { await show("form"); say("form", explain(e), {retry: connect}); }
  };

  /* ---------- sign in / sign up form ---------- */
  const form = $("#au-form"), email = $("#au-email"), goBtn = $(".au-btn", form), provs = $$(".au-prov");
  const resetProvs = () => provs.forEach(p => { p.disabled = false; p.classList.remove("is-loading"); p.removeAttribute("aria-busy"); });
  const tag = s => { const b = /^oauth_\w+$/.test(s || "") && $(`.au-prov[data-strategy="${s}"]`); if (b && !$(".au-tag", b)) b.insertAdjacentHTML("beforeend", '<span class="au-tag">Last used</span>'); };
  $(".au-provs").addEventListener("click", async e => {
    const b = e.target.closest(".au-prov"); if (!b || b.classList.contains("is-loading")) return;
    say("form", ""); provs.forEach(p => { p.disabled = p !== b; }); busy(b, true);
    try { ss.set("lva-try", b.dataset.strategy); await api.oauth(b.dataset.strategy); }   // the browser leaves for the provider here
    catch (err) { resetProvs(); say("form", explain(err)); }
  });
  addEventListener("pageshow", e => { if (e.persisted) resetProvs(); });   // back from the provider's page
  email.addEventListener("input", () => { if (email.hasAttribute("aria-invalid")) say("form", "", {field: email}); });
  form.addEventListener("submit", async e => {
    e.preventDefault(); if (isBusy(goBtn)) return;
    const address = email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) { say("form", "Enter your email address, like you@example.com.", {field: email}); email.focus(); return; }
    say("form", "", {field: email}); busy(goBtn, true);
    try { await api.send(address); ss.set("lva-try", "email_code"); $("#au-sent-to").textContent = address; resetCode(); await show("code"); countdown(); codeIn.focus({preventScroll: true}); }
    catch (err) {
      if (codeOf(err) === "session_exists") return afterAuth();
      if (needsFullUI(err)) return clerkUI();
      say("form", explain(err), {field: /^form_(param|identifier)/.test(codeOf(err)) ? email : null});
    } finally { busy(goBtn, false); }
  });
  /* Sign in <-> Sign up: same card, same page; only the address and the words change */
  const setMode = (m, push) => {
    if (m === mode()) return;
    if (push) history.pushState({}, "", (m === "signup" ? SIGN_UP : SIGN_IN) + location.search);
    morph(() => { root.dataset.mode = m; say("form", "", {field: email}); });
  };
  root.addEventListener("click", e => {
    const a = e.target.closest("[data-switch]"); if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button || !/^sign(in|up)$/.test(mode())) return;
    e.preventDefault(); setMode(a.dataset.switch, true);
  });
  addEventListener("popstate", () => { if (!/^sign(in|up)$/.test(mode())) return; if (step === "form") setMode(location.pathname.startsWith(SIGN_UP) ? "signup" : "signin", false); else location.reload(); });
  if (nq) { $$("[data-switch]").forEach(a => { a.href = a.getAttribute("href") + nq; }); $("#au-enter").href = next; }

  /* ---------- check your email: one real input under six boxes (paste, autofill and one-time-code all just work) ---------- */
  const codeForm = $("#au-code-form"), codeIn = $("#au-code"), boxWrap = $(".au-boxes"), boxes = $$("span", boxWrap), verifyBtn = $(".au-btn", codeForm);
  const paint = () => { const v = codeIn.value; boxes.forEach((b, i) => {
    const ch = v[i] || ""; if (ch && b.textContent !== ch) { b.classList.remove("is-new"); void b.offsetWidth; b.classList.add("is-new"); }
    b.textContent = ch; b.classList.toggle("is-cur", i === Math.min(v.length, 5)); }); };
  const setCode = v => { codeIn.value = v.replace(/\D/g, "").slice(0, 6); boxWrap.classList.remove("is-bad"); if ($("#au-msg-code").textContent) say("code", "", {field: codeIn}); paint(); if (codeIn.value.length === 6) verify(); };
  const resetCode = () => { codeIn.value = ""; codeIn.readOnly = false; boxWrap.classList.remove("is-bad", "is-ok"); verifyBtn.classList.remove("is-done", "is-loading"); say("code", "", {field: codeIn}); paint(); };
  codeIn.addEventListener("input", () => setCode(codeIn.value));
  codeIn.addEventListener("paste", e => { const t = (e.clipboardData || window.clipboardData).getData("text"); if (!t) return; e.preventDefault(); setCode(t); });   // "482 913" would be cut short by maxlength
  ["focus", "click", "keyup"].forEach(t => codeIn.addEventListener(t, () => { const n = codeIn.value.length; try { codeIn.setSelectionRange(n, n); } catch {} }));
  let verifying = false;
  const verify = async () => {
    const v = codeIn.value; if (verifying || isBusy(verifyBtn)) return;
    if (v.length < 6) { say("code", "Enter all 6 digits from the email.", {field: codeIn}); codeIn.focus(); return; }
    verifying = true; busy(verifyBtn, true); codeIn.readOnly = true;
    try {
      fresh = await api.verify(v);
      boxWrap.classList.add("is-ok"); tick(verifyBtn); clearInterval(timer);
      await wait(reduced ? 250 : 900); afterAuth();
    } catch (err) {
      busy(verifyBtn, false); codeIn.readOnly = false;
      if (codeOf(err) === "session_exists") return afterAuth();
      if (needsFullUI(err)) return clerkUI();
      if (errOf(err)) { codeIn.value = ""; paint(); void boxWrap.offsetWidth; boxWrap.classList.add("is-bad"); }   // a wrong code is cleared; a dropped connection keeps what was typed
      say("code", explain(err), {field: codeIn});
      if (/^verification_(expired|failed)$/.test(codeOf(err))) countdown(0);
      codeIn.focus({preventScroll: true});
    } finally { verifying = false; }
  };
  codeForm.addEventListener("submit", e => { e.preventDefault(); verify(); });
  let until = 0, timer = 0;
  const countTick = () => {
    const s = Math.max(0, Math.ceil((until - Date.now()) / 1000));
    $("#au-count").textContent = "0:" + String(s).padStart(2, "0"); $("#au-wait").hidden = !s; $("#au-again").hidden = !!s;
    if (!s) clearInterval(timer);
  };
  const countdown = (secs = 30) => { until = Date.now() + secs * 1000; clearInterval(timer); timer = setInterval(countTick, 250); countTick(); };
  $("#au-resend").addEventListener("click", async e => {
    const b = e.currentTarget; if (b.disabled) return; b.disabled = true;
    try { await api.resend(); resetCode(); countdown(); say("code", "A new code is on its way.", {info: true}); codeIn.focus({preventScroll: true}); }
    catch (err) { say("code", explain(err)); }
    finally { b.disabled = false; }
  });
  $("#au-change").addEventListener("click", async () => { clearInterval(timer); pending = null; await show("form"); email.focus({preventScroll: true}); email.select(); });

  /* ---------- age: three choice cards (a highlight slides to the picked one), then a compact birth-year picker.
     The stored value is worked out exactly as assets/gate.js does: from the birth year, by the YOUNGEST the person could be. ---------- */
  const rangeFor = (year, now = new Date().getFullYear()) => { const a = now - year - 1; return a < 13 ? null : a <= 15 ? RANGES[0] : a <= 17 ? RANGES[1] : a <= 20 ? RANGES[2] : RANGES[3]; };
  if (local) [[2026 - 13, null], [2026 - 14, RANGES[0]], [2026 - 17, RANGES[1]], [2026 - 18, RANGES[1]], [2026 - 19, RANGES[2]], [2026 - 22, RANGES[3]]]
    .forEach(([y, r]) => console.assert(rangeFor(y, 2026) === r, "rangeFor failed for", y));
  const ageForm = $("#au-age-form"), ageBtn = $(".au-btn", ageForm), hl = $(".au-age-hl"), yearF = $("#au-year-f"), year = $("#au-year");
  const band = () => new FormData(ageForm).get("age") || "";
  const fillYears = b => {   // only the years that fit the picked card: 13 to 17 = five years, 18 or older = the rest
    const now = new Date().getFullYear(), from = b === "teen" ? now - 14 : now - 19, to = b === "teen" ? now - 18 : now - 101;
    year.length = 1; for (let y = from; y >= to; y--) year.add(new Option(y, y));
    year.value = "";
  };
  const syncAge = () => { const b = band(); ageBtn.disabled = !b || (b !== "u13" && !year.value); year.classList.toggle("is-empty", !year.value); };
  function placeHl() {
    const r = $(".au-age input:checked"); syncAge(); if (!r) return;
    const l = r.closest(".au-age"), first = hl.style.opacity !== "1";
    if (first) hl.style.transition = "none";
    hl.style.height = l.offsetHeight + "px"; hl.style.transform = `translateY(${l.offsetTop}px)`; hl.style.opacity = "1";
    if (first) requestAnimationFrame(() => { hl.style.transition = ""; });
  }
  ageForm.addEventListener("change", e => {
    say("age", "");
    if (e.target.name === "age") { const b = band(); yearF.hidden = b === "u13"; if (b !== "u13") fillYears(b); }
    placeHl();
  });
  addEventListener("resize", () => { if (step === "age") placeHl(); });
  ageForm.addEventListener("submit", e => {
    e.preventDefault(); const b = band(); if (!b || isBusy(ageBtn) || ageBtn.disabled) return;
    const r = b === "u13" ? null : rangeFor(+year.value);
    if (!r) return closeDoor();
    if (persist && !put(KEY, r)) return say("age", "LaunchVault needs to save your age range on this device, and this browser is blocking storage. Turn off private browsing or allow site data, then try again.");
    return fresh ? show("welcome") : leave(ageBtn);
  });

  /* ---------- judge code (hackathon judges): same check and storage as the live sign-in page ---------- */
  const judge = $("#au-judge");
  $("#au-judge-form").addEventListener("submit", e => {
    e.preventDefault(); const v = judge.value.trim().toUpperCase();
    if (v !== JUDGE) { say("judge", "That code didn't work. Check it and try again.", {field: judge}); judge.focus(); return; }
    if (persist) put("lv-judge", v);
    demo ? leave() : location.assign(next);
  });
  judge.addEventListener("input", () => { if (judge.hasAttribute("aria-invalid")) say("judge", "", {field: judge}); });
  $(".au-judge").addEventListener("toggle", e => { if (e.target.open) judge.focus({preventScroll: true}); });

  /* ---------- start ---------- */
  const waitFail = () => {
    $("#au-h-wait").textContent = "That didn't load."; $("#au-wait-p").textContent = LOAD_FAIL;
    $("#au-wait-spin").hidden = true; $("#au-wait-act").hidden = false; document.title = "Sign-in could not load · LaunchVault";
  };
  $("#au-wait-retry").addEventListener("click", () => location.reload());
  const oauthProblem = c => {
    try { const a = c.client.signIn.firstFactorVerification, b = (c.client.signUp.verifications || {}).externalAccount, e = (a && a.error) || (b && b.error); return e ? explain({errors: [e]}) : OAUTH_FAIL; }
    catch { return OAUTH_FAIL; }
  };
  const prune = c => {   // hide any provider this Clerk instance has turned off, so no button is a dead end
    try { const us = c.__unstable__environment.userSettings, on = us.authenticatableSocialStrategies || us.socialProviderStrategies;
      if (on && on.length) provs.forEach(p => { p.hidden = !on.includes(p.dataset.strategy); }); } catch {}
  };
  async function connect() {   // sign-in / sign-up pages: find out who this is; the form is already usable while this runs
    try {
      const c = await load(); say("form", "");
      if (c.user) return afterAuth();
      prune(c);
      if (q.get("err") === "oauth") say("form", oauthProblem(c));
      if (q.get("ui") === "clerk") clerkUI();
    } catch { say("form", LOAD_FAIL, {retry: connect}); }
  }
  const preview = () => {
    const S = {signin: ["signin", "form"], signup: ["signup", "form"], code: ["signin", "code"], age: ["signup", "age"], under13: ["signup", "under13"], welcome: ["signup", "welcome"], wait: ["callback", "wait"]}[demo] || ["signin", "form"];
    root.dataset.mode = S[0]; root.dataset.step = step = S[1]; setTitle();
    if (demo === "signin") tag("oauth_google");
    if (demo === "signup") email.focus({preventScroll: true});
    if (demo === "code") { $("#au-sent-to").textContent = "you@example.com"; codeIn.value = "482"; paint(); countdown(24); codeIn.focus({preventScroll: true}); }
    if (demo === "age") { $$(".au-age input")[1].checked = true; yearF.hidden = false; fillYears("teen"); placeHl(); }
  };
  (async () => {
    paint(); setTitle();
    if (demo) return preview();
    if (blocked()) { root.dataset.step = step = "under13"; setTitle(); return; }   // nothing is sent to Clerk from a blocked device
    tag(get("lv-last-auth"));
    const m = mode();
    if (m === "callback") {
      try {
        const c = await load();
        await c.handleRedirectCallback({signInForceRedirectUrl: WELCOME + nq, signUpForceRedirectUrl: WELCOME + "?new=1" + nq2,
          signInUrl: SIGN_IN + "?err=oauth" + nq2, signUpUrl: SIGN_UP + "?err=oauth" + nq2, continueSignUpUrl: SIGN_UP + "?ui=clerk" + nq2});
      } catch (e) { if (clerk) location.replace(SIGN_IN + "?err=oauth" + nq2); else waitFail(); }
      return;
    }
    if (m === "welcome") {
      try { const c = await load(); if (!c.user) return location.replace(SIGN_IN + nq);
        const em = c.user.primaryEmailAddress ? c.user.primaryEmailAddress.emailAddress : "";
        if (!(await lvAllowed(em))) { await c.signOut({redirectUrl: SIGN_IN + "?closed=1"}); return; }
        fresh = q.get("new") === "1"; afterAuth(); }
      catch { waitFail(); }
      return;
    }
    await connect();
    if (LV_ONLY && !$("#au-msg-form").textContent) say("form", "Accounts are paused while we finish building. New sign-ups and sign-ins are closed for now.", {info: true});
  })();
})();
