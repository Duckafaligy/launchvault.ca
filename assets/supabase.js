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
  const loadLib = () => new Promise((res, rej) => { if (window.supabase) return res(); const s = document.createElement("script"); s.src = LIB; s.crossOrigin = "anonymous"; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  const push = async clerk => {
    const age = ls.get("lv-age"); if (age === "Under 13") return;            // never write anything for under 13
    const email = clerk.user.primaryEmailAddress && clerk.user.primaryEmailAddress.emailAddress;
    await sb.from("profiles").upsert({email, age_range: AGE[age] || null, email_prefs: ls.get("lv-prefs") || {new_story: true}});
    const D = JSON.parse(document.getElementById("lvapp").textContent);
    const rows = D.checklists.map(c => { const t = ls.get(c.key) || []; const r = ls.get("lv-read-" + c.slug) || {};
      return {story_slug: c.slug, ticks: t.map((v, i) => v ? i + 1 : 0).filter(Boolean), read_pct: Math.min(100, Math.round(r.pct || 0))}; });
    if (rows.length) await sb.from("progress").upsert(rows);
    const q = ls.get("lv-quiz-app"); if (q) await sb.from("quiz_results").upsert({answers: q, path: ls.get("lv-path-done") || []});
  };
  const pull = async () => {
    const {data} = await sb.from("progress").select("story_slug,ticks,read_pct"); if (!data) return;
    const D = JSON.parse(document.getElementById("lvapp").textContent);
    data.forEach(r => { const c = D.checklists.find(x => x.slug === r.story_slug); if (!c) return;
      const local = ls.get(c.key) || []; const merged = c.items.map((_, i) => !!local[i] || r.ticks.includes(i + 1)); ls.set(c.key, merged);   // merge, never lose a tick
      const rd = ls.get("lv-read-" + c.slug) || {}; if ((r.read_pct || 0) > (rd.pct || 0)) ls.set("lv-read-" + c.slug, {...rd, pct: r.read_pct}); });
  };
  const start = async clerk => {
    if (!clerk || !clerk.user) return;
    try {
      await loadLib();
      sb = window.supabase.createClient(URL, KEY, {accessToken: async () => (await clerk.session.getToken()) || null});
      await pull(); await push(clerk);
      addEventListener("lv:changed", () => { clearTimeout(start.t); start.t = setTimeout(() => push(clerk).catch(() => {}), 800); });
    } catch (e) { /* offline or not set up yet: local progress keeps working */ }
  };
  return {start};
})();
