/* LaunchVault sign-in through Clerk (ClerkJS in the browser; the site is static).
   ONE place for the key and the wall:
     LV_CLERK_PK  the Clerk PUBLISHABLE key (pk_...). Public by design. Never put a secret key (sk_...) anywhere in this repo.
     LV_AUTH      false = accounts are off for now (no sign-in UI, no third-party requests). true = use Clerk (+ Supabase sync).
     LV_GATE      false = the app opens without signing in (current choice). true = signed-out visitors go to /sign-in/.
   While LV_CLERK_PK is empty the site runs in PREVIEW mode: sign-in buttons go straight to /app/ and a preview bar shows. */
const LV_CLERK_PK = "pk_live_Y2xlcmsubGF1bmNodmF1bHQuY2Ek";   // PRODUCTION instance (clerk.launchvault.ca), 2026-11-21. Dev was pk_test_ZGFzaGluZy1zcGlkZXItNDg2LmNsZXJrLmFjY291bnRzLmRldiQ
const LV_AUTH = true;    // login ON (Clerk prebuilt sign-in on /sign-in/ and /sign-up/). Stories stay readable without an account (LV_GATE false)
const LV_GATE = true;    // 2026-11-21: the app is for account holders only; hackathon judges type a judge code on /sign-in/ (judge view)
const LV_GUEST_KEY = "SPARK2026";   // same value as JCODE in app.js; stored as lv-judge. ponytail: client-side key, swap for a server check if it must stay secret
// judges only: the code is typed on /sign-in/ (no URL shortcut), then stored as lv-judge
const lvGuest = () => { try { return JSON.parse(localStorage.getItem("lv-judge") || "null") === LV_GUEST_KEY; } catch { return false; } };
// Clerk's recommended no-bundler setup: clerk-js v6 + its UI bundle, both served from this instance's Frontend API,
// so the two always match and Clerk never blocks the SDK as outdated. The host comes from the publishable key.
const LV_FAPI = LV_CLERK_PK ? atob(LV_CLERK_PK.split("_")[2]).replace(/\$$/, "") : "";
const LV_CLERK_JS = `https://${LV_FAPI}/npm/@clerk/clerk-js@6/dist/clerk.browser.js`;
const LV_CLERK_UI = `https://${LV_FAPI}/npm/@clerk/ui@1/dist/ui.browser.js`;

window.LVAuth = (() => {
  const live = LV_AUTH && !!LV_CLERK_PK;
  let clerk = null, loading = null;
  const script = (src, attrs = {}) => new Promise((res, rej) => {
    const s = document.createElement("script"); s.src = src; s.async = true; s.crossOrigin = "anonymous";
    Object.entries(attrs).forEach(([k, v]) => s.setAttribute(k, v)); s.onload = res; s.onerror = () => rej(new Error("could not load " + src)); document.head.appendChild(s);
  });
  const load = () => {
    if (!live) return Promise.resolve(null);
    if (!loading) loading = script(LV_CLERK_UI)
      .then(() => script(LV_CLERK_JS, {"data-clerk-publishable-key": LV_CLERK_PK}))
      .then(async () => { clerk = window.Clerk; await clerk.load({ui: {ClerkUI: window.__internal_ClerkUICtor},
      // tell Clerk where OUR pages are; without these it falls back to its hosted pages on *.accounts.dev
      signInUrl: "/sign-in", signUpUrl: "/sign-up", signInFallbackRedirectUrl: "/app/", signUpFallbackRedirectUrl: "/app/start/"}); return clerk; });
    return loading;
  };
  const email = () => clerk && clerk.user && clerk.user.primaryEmailAddress ? clerk.user.primaryEmailAddress.emailAddress : null;
  // which sign-in methods this Clerk instance actually has turned on (so no button appears that can't work)
  const enabled = () => {
    const out = new Set();
    try {
      const us = clerk.__unstable__environment.userSettings;
      (us.authenticatableSocialStrategies || us.socialProviderStrategies || []).forEach(s => out.add(s));
      const em = us.attributes && us.attributes.email_address;
      if (em && em.enabled && em.used_for_first_factor && (em.first_factors || em.verifications || []).includes("email_code")) out.add("email_code");
    } catch (e) { out.add("oauth_google"); }
    return out;
  };
  const CALLBACK = "/welcome/callback/";
  // every option goes through here; new users land on /app/start/, returning users on /app/
  const signInWith = async (strategy, opts = {}) => {
    if (!live) { location.href = opts.isNew ? "/app/start/" : "/app/"; return; }
    const c = await load();
    if (strategy.startsWith("oauth_"))
      return c.client.signIn.authenticateWithRedirect({strategy, redirectUrl: location.origin + CALLBACK, redirectUrlComplete: location.origin + "/app/"});
    if (strategy === "email_code") return emailCode(c, opts);
  };
  // email code: step 1 sends a code (sign in, or sign up if the address is new); step 2 checks it
  let pending = null;
  const emailCode = async (c, {address, code}) => {
    if (!code) {
      try {
        const si = await c.client.signIn.create({identifier: address});
        const f = si.supportedFirstFactors.find(x => x.strategy === "email_code");
        await si.prepareFirstFactor({strategy: "email_code", emailAddressId: f.emailAddressId});
        pending = {kind: "in", r: si};
      } catch (e) {
        if (!(e && e.errors && e.errors[0] && e.errors[0].code === "form_identifier_not_found")) throw e;
        const su = await c.client.signUp.create({emailAddress: address});
        await su.prepareEmailAddressVerification({strategy: "email_code"});
        pending = {kind: "up", r: su};
      }
      return "sent";
    }
    const r = pending.kind === "in" ? await pending.r.attemptFirstFactor({strategy: "email_code", code}) : await pending.r.attemptEmailAddressVerification({code});
    if (r.status === "complete") { await c.setActive({session: r.createdSessionId}); location.href = pending.kind === "up" ? "/app/start/" : "/app/"; }
    return r.status;
  };
  // accounts paused: the one email allowed in, as a SHA-256 hash ("" = open to everyone). ponytail: browser-side; the hard lock is Clerk's allowlist
  const LV_ONLY = "";
  const lvMails = u => (u && u.emailAddresses || []).filter(a => a.verification && a.verification.status === "verified").map(a => a.emailAddress);
  const lvAny = async u => { if (!LV_ONLY) return true; for (const e of lvMails(u)) if (await lvAllowed(e)) return true; return false; };   // any verified address on the account
  const lvAllowed = async e => { if (!LV_ONLY) return true; try { const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(e || "").trim().toLowerCase()));
    return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, "0")).join("") === LV_ONLY; } catch { return false; } };
  const callback = async () => {
    if (!live) { location.replace("/app/"); return; }
    const c = await load();
    await c.handleRedirectCallback({signInForceRedirectUrl: "/app/", signUpForceRedirectUrl: "/app/start/", signInUrl: "/sign-in", signUpUrl: "/sign-up"});
  };
  const signOut = async () => { if (!live) return; try { localStorage.removeItem("lv-plan"); } catch {} const c = await load(); await c.signOut({redirectUrl: "/sign-in/"}); };
  // app pages: show who is signed in (email only); only redirect when the wall is on
  const app = async () => {
    // story homes and chapter shells are public pages (no text inside a chapter shell; /api/lesson decides who reads it)
    const pub = /^\/app\/story\/[a-z0-9-]+\/(\d+\/)?$/.test(location.pathname);
    const bar = document.getElementById("prevbar"), guest = lvGuest(), wall = LV_GATE && live && !guest && !pub;
    // hide the page until Clerk says who this is, so signed-out visitors never see a flash of the app before the redirect
    // ...but only when this browser has no sign-in on record. Clerk keeps __client_uat on our domain (0 = signed out, a timestamp =
    // signed in); for members it's set, so pages show at once and page-to-page fades aren't blank while Clerk loads.
    // If Clerk then says nobody is signed in, the redirect below still runs.
    const likelyIn = /(?:^|;\s*)__client_uat(?:_[^=]*)?=(?!0(?:;|$))\d+/.test(document.cookie);
    if (wall && !likelyIn) document.documentElement.style.visibility = "hidden";
    const paint = () => {
      const e = email(); if (!bar) return;
      // signed-in members: paying plans get no bar at all; Free gets one calm upgrade line (sign out lives on the Account page)
      let paid = false; try { const p = JSON.parse(localStorage.getItem("lv-plan") || "null");
        paid = !!p && (p.plan === "pro" || p.plan === "builder") && (p.status === "active" || p.status === "trialing"); } catch {}
      bar.style.display = e && paid && !guest ? "none" : "";
      bar.innerHTML = !LV_AUTH ? "Preview: accounts open soon. Your progress stays on this device."
        : e ? `<span>You're on the <b>Free plan</b>. Upgrade to Pro for every lesson in every story.</span> <a href="/app/account/#plan">See plans</a>`
        : guest ? `<b>Judge view.</b> You're in with a judge code, so nothing is saved to an account. <button type="button" id="gxBtn">Exit judge view</button>`
            : `Your progress is saved on this device. <a href="/sign-in/">Sign in</a> to keep it everywhere.`;
      const so = document.getElementById("soBtn"); if (so) so.addEventListener("click", signOut);
      const gx = document.getElementById("gxBtn");
      if (gx) gx.addEventListener("click", () => { try { localStorage.removeItem("lv-judge"); } catch {} location.href = "/sign-in/"; });
      document.querySelectorAll("[data-auth-email]").forEach(n => { n.textContent = e || "Not signed in"; });
      document.querySelectorAll("[data-auth-out]").forEach(n => { n.hidden = !e; });
    };
    paint(); addEventListener("lv:plan", paint);   // repaint once the account's plan arrives from Supabase
    document.querySelectorAll("[data-auth-only]").forEach(n => { n.hidden = !LV_AUTH; });
    document.querySelectorAll("[data-noauth-only]").forEach(n => { n.hidden = LV_AUTH; });
    const ageQ = () => { if (pub && !(clerk && clerk.user)) return; if (window.LVGate && !LVGate.ok && LVGate.start) LVGate.start(); };   // public story pages: no birthday question for visitors without an account   // age question only after the wall
    if (!live) { ageQ(); return; }
    try { await load(); paint();
      if (clerk.user && !(await lvAny(clerk.user))) { try { localStorage.removeItem("lv-plan"); } catch {} await clerk.signOut({redirectUrl: "/sign-in/?closed=1"}); return; }
      if (clerk.user && window.LVGate && LVGate.ok) { const sc = document.createElement("script"); sc.src = "/assets/supabase.js"; sc.onload = () => window.LVSync && LVSync.start(clerk); document.head.appendChild(sc); }
      if (wall && !clerk.user) { location.replace("/sign-in/?next=" + encodeURIComponent(location.pathname + location.search + location.hash)); return; }
      document.documentElement.style.visibility = ""; ageQ(); } catch (e) { document.documentElement.style.visibility = ""; ageQ(); /* Clerk didn't load: fail open, keep the preview face */ }
  };
  return {on: LV_AUTH, live, gate: LV_GATE, locked: !!LV_ONLY, load, enabled, signInWith, callback, signOut, app, email};
})();
