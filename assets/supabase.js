/* LaunchVault account sync (Supabase). Loaded ONLY when LV_AUTH is on and someone is signed in with Clerk (auth.js starts it).
   Public values only: the project URL and the PUBLISHABLE key. Never put the service-role/secret key in client code.
   Rules: pages never depend on this to render; signed-out = localStorage only; first sign-in merges local progress up;
   under 13 never writes anything (and isn't stored in the first place). */
window.LVSync = (() => {
  const URL = "https://azriqynpnbltvxucwmpo.supabase.co";
  const KEY = "sb_publishable_HuWp3C44Bd6dLqGW3DiaxA_qCSpDZZa";
  const LIB = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.js";
  const AGE = {"13 to 15": "13-15", "16 to 17": "16-17", "18 to 20": "18-20", "21 or older": "21+"};
  const ls = {get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }};
  let sb = null;
  const loadLib = () => new Promise((res, rej) => { if (window.supabase) return res(); const s = document.createElement("script"); s.src = LIB; s.crossOrigin = "anonymous"; s.integrity = "sha384-TcHRA3zBbn+Lexh5n+Oil4guNPOS3rjNDpGRAN46u/s/mB2IZ50ceC6TYDU2yvgK"; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  const push = async clerk => {
    const age = ls.get("lv-age"); if (age === "Under 13") return;            // never write anything for under 13
    const email = clerk.user.primaryEmailAddress && clerk.user.primaryEmailAddress.emailAddress;
    await sb.from("profiles").upsert({email, age_range: AGE[age] || null, email_prefs: ls.get("lv-prefs") || {new_story: true}});
    const D = JSON.parse(document.getElementById("lvapp").textContent);
    const rows = D.checklists.map(c => { const t = ls.get(c.key) || []; const r = ls.get("lv-read-" + c.slug) || {};
      const sv = ls.get("lv-saved") || [], si = ls.get("lv-saved-items") || [], ck = ls.get("lv-check-" + c.slug) || {};
      return {story_slug: c.slug, ticks: t.map((v, i) => v ? i + 1 : 0).filter(Boolean), read_pct: Math.min(100, Math.round(r.pct || 0)),
        seen_phases: (ls.get("lv-seen-" + c.slug) || []).filter(Number.isInteger), saved: sv.includes(c.slug),
        saved_items: si.filter(k => k.startsWith(c.slug + ":")).map(k => +k.split(":")[1]), check_best: ck.n ? ck.best : null, check_last: ck.n ? ck.last : null, check_n: ck.n || null, done_how: (ls.get("lv-done-" + c.slug) || {}).how || null, done_at: (ls.get("lv-done-" + c.slug) || {}).t ? new Date(ls.get("lv-done-" + c.slug).t).toISOString() : null}; });
    if (rows.length) await sb.from("progress").upsert(rows);
    const q = ls.get("lv-quiz-app"); if (q) await sb.from("quiz_results").upsert({answers: q, path: ls.get("lv-path-done") || []});
  };
  const pull = async () => {
    const {data} = await sb.from("progress").select("story_slug,ticks,read_pct,seen_phases,saved,saved_items,check_best,check_last,check_n,done_how,done_at"); if (!data) return;
    const sv = new Set(ls.get("lv-saved") || []), si = new Set(ls.get("lv-saved-items") || []);
    data.forEach(r => { if (r.saved) sv.add(r.story_slug); (r.saved_items || []).forEach(i => si.add(r.story_slug + ":" + i));
      const seen = new Set([...(ls.get("lv-seen-" + r.story_slug) || []), ...(r.seen_phases || [])]); if (seen.size) ls.set("lv-seen-" + r.story_slug, [...seen].sort((a, b) => a - b));
      const ck = ls.get("lv-check-" + r.story_slug); if (r.check_n && (!ck || (ck.best || 0) < r.check_best)) ls.set("lv-check-" + r.story_slug, {best: r.check_best, last: r.check_last, n: r.check_n, t: Date.now()});
      if (r.done_how && !ls.get("lv-done-" + r.story_slug)) ls.set("lv-done-" + r.story_slug, {how: r.done_how, t: Date.parse(r.done_at) || Date.now()}); });
    ls.set("lv-saved", [...sv]); ls.set("lv-saved-items", [...si]);
    const D = JSON.parse(document.getElementById("lvapp").textContent);
    data.forEach(r => { const c = D.checklists.find(x => x.slug === r.story_slug); if (!c) return;
      const local = ls.get(c.key) || []; const merged = c.items.map((_, i) => !!local[i] || r.ticks.includes(i + 1)); ls.set(c.key, merged);   // merge, never lose a tick
      const rd = ls.get("lv-read-" + c.slug) || {}; if ((r.read_pct || 0) > (rd.pct || 0)) ls.set("lv-read-" + c.slug, {...rd, pct: r.read_pct}); });
  };
  // paid plan (written only by the stripe-webhook Edge Function): app.js listens for "lv:plan" and unlocks Pro like the judge pass
  const plan = async () => { if (!sb) return;
    const {data, error} = await sb.from("plans").select("plan,billing,status").maybeSingle(); if (error) return;
    ls.set("lv-plan", data ? {...data, t: Date.now()} : null); dispatchEvent(new CustomEvent("lv:plan", {detail: data})); };
  const start = async clerk => {
    if (!clerk || !clerk.user) return;
    try {
      await loadLib();
      sb = window.supabase.createClient(URL, KEY, {accessToken: async () => (await clerk.session.getToken()) || null});
      plan().catch(() => {});
      await pull(); dispatchEvent(new Event("storage"));   // repaint with what came from the account (no push loop)
      await push(clerk);
      addEventListener("lv:changed", () => { clearTimeout(start.t); start.t = setTimeout(() => push(clerk).catch(() => {}), 800); });
      // Account -> Delete your data: also erase everything stored on the server for this account (delete_my_data RPC)
      addEventListener("lv:delete-account", e => { const done = e.detail && e.detail.done; clearTimeout(start.t);   // never let a queued sync re-upload deleted data
        sb.rpc("delete_my_data").then(({error}) => done && done(error ? "server" : null), () => done && done("server")); });
    } catch (e) { /* offline or not set up yet: local progress keeps working */ }
  };
  // community chat (assets/community.js) gets its own client with the same Clerk token; same under-13 rule applies (the age gate already blocked them)
  const make = async clerk => { await loadLib(); return window.supabase.createClient(URL, KEY, {accessToken: async () => (await clerk.session.getToken()) || null}); };
  return {start, make, plan};
})();
