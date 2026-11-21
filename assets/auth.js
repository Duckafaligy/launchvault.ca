/* LaunchVault sign-in through Clerk (ClerkJS in the browser; the site is static).
   ONE place for the key and the wall:
     LV_CLERK_PK  the Clerk PUBLISHABLE key (pk_...). Public by design. Never put a secret key (sk_...) anywhere in this repo.
     LV_AUTH      false = accounts are off for now (no sign-in UI, no third-party requests). true = use Clerk (+ Supabase sync).
     LV_GATE      false = the app opens without signing in (current choice). true = signed-out visitors go to /welcome/.
   While LV_CLERK_PK is empty the site runs in PREVIEW mode: sign-in buttons go straight to /app/ and a preview bar shows. */
const LV_CLERK_PK = "pk_test_ZGFzaGluZy1zcGlkZXItNDg2LmNsZXJrLmFjY291bnRzLmRldiQ";   // development instance (dashing-spider-486)
const LV_AUTH = true;    // login ON (Clerk prebuilt sign-in on /welcome/). Stories stay readable without an account (LV_GATE false)
const LV_GATE = true;    // 2026-11-21: the app is for account holders only; hackathon judges type a judge code on /welcome/ (judge view)
const LV_GUEST_KEY = "SPARK2026";   // same value as JCODE in app.js; stored as lv-judge. ponytail: client-side key, swap for a server check if it must stay secret
// judges only: the code is typed on /welcome/ (no URL shortcut), then stored as lv-judge
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
      .then(async () => { clerk = window.Clerk; await clerk.load({ui: {ClerkUI: window.__internal_ClerkUICtor}}); return clerk; });
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
  const callback = async () => {
    if (!live) { location.replace("/app/"); return; }
    const c = await load();
    await c.handleRedirectCallback({signInForceRedirectUrl: "/app/", signUpForceRedirectUrl: "/app/start/", signInUrl: "/welcome/", signUpUrl: "/welcome/#signup"});
  };
  const signOut = async () => { if (!live) return; try { localStorage.removeItem("lv-plan"); } catch {} const c = await load(); await c.signOut({redirectUrl: "/welcome/"}); };
  // app pages: show who is signed in (email only); only redirect when the wall is on
  const app = async () => {
    const bar = document.getElementById("prevbar"), guest = lvGuest(), wall = LV_GATE && live && !guest;
    // hide the page until Clerk says who this is, so signed-out visitors never see a flash of the app before the redirect
    if (wall) document.documentElement.style.visibility = "hidden";
    const paint = () => {
      const e = email(); if (!bar) return;
      bar.innerHTML = !LV_AUTH ? "Preview: accounts open soon. Your progress stays on this device."
        : e ? `Signed in as <b>${e.replace(/</g, "")}</b> <button type="button" id="soBtn">Sign out</button>`
        : guest ? `<b>Judge view.</b> You're in with a judge code, so nothing is saved to an account. <button type="button" id="gxBtn">Exit judge view</button>`
            : `Your progress is saved on this device. <a href="/welcome/">Sign in</a> to keep it everywhere.`;
      const so = document.getElementById("soBtn"); if (so) so.addEventListener("click", signOut);
      const gx = document.getElementById("gxBtn");
      if (gx) gx.addEventListener("click", () => { try { localStorage.removeItem("lv-judge"); } catch {} location.href = "/welcome/#signin"; });
      document.querySelectorAll("[data-auth-email]").forEach(n => { n.textContent = e || "Not signed in"; });
      document.querySelectorAll("[data-auth-out]").forEach(n => { n.hidden = !e; });
    };
    paint();
    document.querySelectorAll("[data-auth-only]").forEach(n => { n.hidden = !LV_AUTH; });
    document.querySelectorAll("[data-noauth-only]").forEach(n => { n.hidden = LV_AUTH; });
    const ageQ = () => { if (window.LVGate && !LVGate.ok && LVGate.start) LVGate.start(); };   // age question only after the wall
    if (!live) { ageQ(); return; }
    try { await load(); paint();
      if (clerk.user && window.LVGate && LVGate.ok) { const sc = document.createElement("script"); sc.src = "/assets/supabase.js"; sc.onload = () => window.LVSync && LVSync.start(clerk); document.head.appendChild(sc); }
      if (wall && !clerk.user) { location.replace("/welcome/?next=" + encodeURIComponent(location.pathname + location.search) + "#signin"); return; }
      document.documentElement.style.visibility = ""; ageQ(); } catch (e) { document.documentElement.style.visibility = ""; ageQ(); /* Clerk didn't load: fail open, keep the preview face */ }
  };
  return {on: LV_AUTH, live, gate: LV_GATE, load, enabled, signInWith, callback, signOut, app, email};
})();
