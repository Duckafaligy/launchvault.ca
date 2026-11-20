/* LaunchVault sign-in through Clerk (ClerkJS in the browser; the site is static).
   ONE place for the key and the wall:
     LV_CLERK_PK  the Clerk PUBLISHABLE key (pk_...). Public by design. Never put a secret key (sk_...) anywhere in this repo.
     LV_AUTH      false = accounts are off for now (no sign-in UI, no third-party requests). true = use Clerk (+ Supabase sync).
     LV_GATE      false = the app opens without signing in (current choice). true = signed-out visitors go to /welcome/.
   While LV_CLERK_PK is empty the site runs in PREVIEW mode: sign-in buttons go straight to /app/ and a preview bar shows. */
const LV_CLERK_PK = "pk_test_ZGFzaGluZy1zcGlkZXItNDg2LmNsZXJrLmFjY291bnRzLmRldiQ";   // development instance (dashing-spider-486)
const LV_AUTH = false;   // OFF until the Clerk dashboard is finished and /welcome/ uses Clerk's prebuilt sign-in (bot protection needs it)
const LV_GATE = false;
const LV_CLERK_JS = "https://cdn.jsdelivr.net/npm/@clerk/clerk-js@6.42.3/dist/clerk.browser.js";

window.LVAuth = (() => {
  const live = LV_AUTH && !!LV_CLERK_PK;
  let clerk = null, loading = null;
  const load = () => {
    if (!live) return Promise.resolve(null);
    if (loading) return loading;
    loading = new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = LV_CLERK_JS; s.async = true; s.crossOrigin = "anonymous";
      s.setAttribute("data-clerk-publishable-key", LV_CLERK_PK);
      s.onload = async () => { try { clerk = window.Clerk; await clerk.load(); res(clerk); } catch (e) { rej(e); } };
      s.onerror = rej; document.head.appendChild(s);
    });
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
  const signOut = async () => { if (!live) return; const c = await load(); await c.signOut({redirectUrl: "/welcome/"}); };
  // app pages: show who is signed in (email only); only redirect when the wall is on
  const app = async () => {
    const bar = document.getElementById("prevbar");
    const paint = () => {
      const e = email(); if (!bar) return;
      bar.innerHTML = !LV_AUTH ? "Preview: accounts open soon. Your progress stays on this device."
        : e ? `Signed in as <b>${e.replace(/</g, "")}</b> <button type="button" id="soBtn">Sign out</button>`
            : `Preview: sign-ups open soon. <a href="/welcome/">Sign in</a>`;
      const so = document.getElementById("soBtn"); if (so) so.addEventListener("click", signOut);
      document.querySelectorAll("[data-auth-email]").forEach(n => { n.textContent = e || "Not signed in (preview)"; });
      document.querySelectorAll("[data-auth-out]").forEach(n => { n.hidden = !e; });
    };
    paint();
    document.querySelectorAll("[data-auth-only]").forEach(n => { n.hidden = !LV_AUTH; });
    document.querySelectorAll("[data-noauth-only]").forEach(n => { n.hidden = LV_AUTH; });
    if (!live) return;
    try { await load(); paint();
      if (clerk.user) { const sc = document.createElement("script"); sc.src = "/assets/supabase.js"; sc.onload = () => window.LVSync && LVSync.start(clerk); document.head.appendChild(sc); } if (LV_GATE && !clerk.user) location.replace("/welcome/"); } catch (e) { /* keep the preview face */ }
  };
  return {on: LV_AUTH, live, gate: LV_GATE, load, enabled, signInWith, callback, signOut, app, email};
})();
