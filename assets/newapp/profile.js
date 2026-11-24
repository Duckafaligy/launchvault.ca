/* LaunchVault account bubble (top bar, every /app/ page) + the Public profile editor (Account -> Profile).
   ONE public profile per member, in public.profiles: display_name + name_tag (chat_set_name), username, avatar_path, bio (profile_update).
   Reads/writes use the Supabase client with the Clerk token (supabase.js make()). Judge view and signed-out visitors make no requests.
   Avatars: re-encoded on the device to a 256 px square (no EXIF/location), uploaded to the public "avatars" bucket under <uid>/. */
(() => {
  "use strict";
  if (!window.LVGate || !LVGate.ok) return;   // nothing runs before the age gate passes
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
  const SB = "https://azriqynpnbltvxucwmpo.supabase.co";
  const avUrl = p => p ? `${SB}/storage/v1/object/public/avatars/${p.split("/").map(encodeURIComponent).join("/")}` : "";
  // same palette and hash as the chat avatars (community.js), so a member's colour matches everywhere
  const AV = [["#EDE9FE", "#5B21B6"], ["#E5E7EB", "#1F2937"], ["#DBEAFE", "#1E40AF"], ["#DCFCE7", "#166534"], ["#FCE7F3", "#9D174D"], ["#E0F2FE", "#075985"]];
  const tint = k => { let h = 0; for (const c of String(k)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return AV[h % AV.length]; };
  const initials = n => String(n).trim().split(/\s+/).slice(0, 2).map(w => w.charAt(0).toUpperCase()).join("");
  const PERSON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>';
  const CHECK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  // the inside of an .av circle: photo, initials on the member's tint, J for judge view, or a neutral person
  const fill = (el, p) => {
    el.classList.toggle("j", !!p.j); el.style.background = el.style.color = "";
    if (p.j) { el.textContent = "J"; return; }
    if (p.src || p.avatar_path) { el.innerHTML = `<img src="${esc(p.src || avUrl(p.avatar_path))}" alt="" width="36" height="36">`; return; }
    if (p.name) { const [bg, fg] = tint(p.id || p.name); el.style.background = bg; el.style.color = fg; el.textContent = initials(p.name); return; }
    el.innerHTML = PERSON;
  };
  const ls = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
  const paidName = () => { const p = ls("lv-plan"); return p && (p.plan === "pro" || p.plan === "builder") && (p.status === "active" || p.status === "trialing") ? (p.plan === "pro" ? "Pro" : p.billing === "lifetime" ? "Lifetime" : "Developer") : ""; };

  let clerk = null, sb = null, P = null;   // P = the member's own profile row
  const signed = () => !!(clerk && clerk.user);
  const judge = () => !signed() && ls("lv-judge") === "SPARK2026";   // same code as app.js JCODE
  const me = () => signed() ? {id: clerk.user.id, name: (P && P.display_name) || clerk.user.firstName || "", avatar_path: P && P.avatar_path} : judge() ? {j: true} : {};

  // ---------- the bubble + its menu ----------
  const btn = $("[data-avb]"), box = $("#avm");
  const menuHTML = () => {
    const s = signed(), j = judge(), paid = s ? paidName() : "";
    const nm = s ? (P && P.display_name) || "Set up your profile" : j ? "Judge view" : "Not signed in";
    const sub = s ? (P && P.username ? "@" + P.username : "No username yet") : j ? "In with a hackathon judge code" : "Your progress stays on this device";
    const plan = j ? `<div class="avp"><span>Every breakdown unlocked</span><span class="avok">${CHECK}Judge</span></div>`
      : !s ? "" : paid ? `<div class="avp"><span>${esc(paid)}</span><span class="avok">${CHECK}Active</span></div>`
      : `<div class="avp"><span>Free plan</span><a href="/app/account/#plan">Upgrade</a></div>`;
    return `<div class="avh"><span class="av" data-avm-av aria-hidden="true"></span><div class="avn"><b>${esc(nm)}</b><span>${esc(sub)}</span></div></div>${plan}
      <a class="avi" href="/app/account/#profile">Profile &amp; settings</a>${paid ? '<a class="avi" href="/app/account/#plan">Manage billing</a>' : ""}<hr>
      ${s ? '<button class="avi" type="button" data-so>Sign out</button>' : j ? '<button class="avi" type="button" data-gx>Exit judge view</button>' : '<a class="avi" href="/sign-in/">Sign in</a>'}`;
  };
  const items = () => $$("a,button", box);
  const paint = () => {
    // Vault shell: the sidebar profile row, the phone "You" header and the Home greeting follow the same profile
    { const m = me(), nm = signed() ? (P && P.display_name) || clerk.user.firstName || "" : "";
      $$("[data-av]").forEach(el => { if (!btn || !btn.contains(el)) fill(el, m); });
      $$("[data-me]").forEach(el => { el.textContent = nm || (judge() ? "Judge view" : signed() ? "Your account" : "Not signed in"); });
      $$("[data-hname]").forEach(el => { el.textContent = nm ? ", " + nm.split(/\s+/)[0] : ""; }); }
    if (btn) { fill($("[data-av]", btn), me()); btn.setAttribute("aria-label", signed() ? "Account menu" : judge() ? "Account menu, judge view" : "Account menu, not signed in"); }
    if (box && !box.hidden) { const f = document.activeElement && box.contains(document.activeElement) ? items().indexOf(document.activeElement) : -1;
      box.innerHTML = menuHTML(); fill($("[data-avm-av]", box), me()); if (f >= 0 && items()[f]) items()[f].focus(); }
  };
  const open = () => { box.hidden = false; btn.setAttribute("aria-expanded", "true"); paint(); (items()[0] || box).focus(); };
  const close = back => { if (!box || box.hidden) return; box.hidden = true; btn.setAttribute("aria-expanded", "false"); if (back) btn.focus(); };
  if (btn && box) {
    btn.addEventListener("click", () => box.hidden ? open() : close(true));
    btn.addEventListener("keydown", e => { if (e.key === "ArrowDown" && box.hidden) { e.preventDefault(); open(); } if (e.key === "Escape") close(true); });
    document.addEventListener("click", e => { if (!e.target.closest(".avw")) close(false); });
    box.addEventListener("keydown", e => {
      const L = items(), i = L.indexOf(document.activeElement);
      if (e.key === "Escape") { e.preventDefault(); close(true); }
      else if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); L[(i + (e.key === "ArrowDown" ? 1 : -1) + L.length) % L.length].focus(); }
      else if (e.key === "Tab" && ((!e.shiftKey && i === L.length - 1) || (e.shiftKey && i <= 0))) { e.preventDefault(); L[e.shiftKey ? L.length - 1 : 0].focus(); }   // light trap: Tab cycles inside
    });
    box.addEventListener("click", e => {
      if (e.target.closest("[data-so]") && window.LVAuth) { LVAuth.signOut(); return; }
      if (e.target.closest("[data-gx]")) { try { localStorage.removeItem("lv-judge"); } catch {} location.href = "/sign-in/"; return; }
      if (e.target.closest("a")) close(false);
    });
  }
  addEventListener("lv:plan", paint);
  addEventListener("storage", paint);
  paint();

  // ---------- account data ----------
  const q = async p => { const {data, error} = await p; if (error) throw error; return data; };
  const client = async c => {
    for (let i = 0; i < 60 && !window.LVSync; i++) { if (i === 0 && !$('script[src="/assets/supabase.js"]')) { const s = document.createElement("script"); s.src = "/assets/supabase.js"; document.head.appendChild(s); } await new Promise(r => setTimeout(r, 100)); }
    return LVSync.make(c);
  };
  const load = async () => { P = await q(sb.from("profiles").select("display_name,name_tag,username,avatar_path,bio").eq("user_id", clerk.user.id).maybeSingle()); paint(); return P; };

  // ---------- Account -> Profile: the Public profile card ----------
  const card = $("#pubprof");
  const ERR = {
    name_shape: "Display name: use 2 to 30 letters, spaces, dots, dashes or apostrophes, starting with a letter.", name_reserved: "That display name isn't available. Pick another.",
    name_filter: "Please pick a different display name.", name_slow_down: "You've changed your display name 3 times today. Try again tomorrow.",
    username_shape: "Username: use 3 to 20 letters, numbers or underscores.", username_reserved: "That username is reserved. Pick another.",
    username_filter: "Please pick a different username.", username_taken: "That username is taken. Try another.",
    bio_length: "Your bio can be up to 160 characters.", bio_filter: "Your bio can't include links, contact details or blocked words.",
    avatar_bad: "That photo didn't upload properly. Try again.", avatar_upload: "The photo didn't upload. Check your connection and try again.",
    age: "Finish the age step first, then try again.", login: "Sign in again to save."
  };
  const errCopy = x => { if (navigator.onLine === false) return "You're offline. Nothing was saved.";
    const k = ((String(x && (x.message || x.details) || "")).match(/chat:([a-z_]+)/) || [])[1] || "";
    return ERR[k] || ERR[Object.keys(ERR).find(b => k.startsWith(b + "_"))] || "Couldn't save. Try again in a minute."; };
  const UH = {"": "Letters, numbers and underscores, 3–20. People use it to @mention you.", available: "Available.", yours: "This is your username.", taken: "Taken. Try another.",
    username_shape: "Use 3 to 20 letters, numbers or underscores.", username_reserved: "That one is reserved. Pick another.", username_filter: "Please pick a different username.", checking: "Checking…"};

  const editor = () => {
    if (!card) return;
    const off = $("[data-pp-off]", card), f = $("[data-pp-form]", card);
    if (!signed()) { off.textContent = judge() ? "Public profiles are for members. Judge view has no account, so there's nothing to set up here." : "Sign in to set up your public profile."; return; }
    off.hidden = true; f.hidden = false;
    const name = $("#ppName", f), user = $("#ppUser", f), bio = $("#ppBio", f), file = $("#ppFile", f), uh = $("[data-pp-uh]", f), msg = $("[data-pp-msg]", f), save = $('[type="submit"]', f);
    const rm = $("[data-pp-rm]", f), avn = $("[data-pp-avn]", f), AVN = avn.textContent;
    let pending = null, preview = "", ustate = "", ut = 0, seq = 0;   // pending: null | "remove" | {blob, ext, type}
    const curAv = () => pending === "remove" ? {} : pending ? {src: preview} : {avatar_path: P && P.avatar_path};
    const say = (t, kind = "") => { msg.textContent = t; msg.className = "pp-msg " + kind; };
    const pv = () => {
      const nm = name.value.trim() || (P && P.display_name) || "", u = user.value.trim();
      fill($("[data-pp-av]", f), {id: clerk.user.id, name: nm, ...curAv()});
      rm.hidden = !(pending && pending !== "remove") && !(pending !== "remove" && P && P.avatar_path);
      $("[data-pp-pv]", f).innerHTML = `<span class="av" aria-hidden="true"></span><div><p class="pp-pvn"><b>${esc(nm || "Your name")}</b><span>· ${esc(P && P.name_tag && nm === P.display_name ? P.name_tag : "4-digit tag")}</span>${u ? `<span class="pp-pvu">@${esc(u)}</span>` : ""}</p>${bio.value.trim() ? `<p class="pp-pvb">${esc(bio.value.trim())}</p>` : ""}</div>`;
      fill($("[data-pp-pv] .av", f), {id: clerk.user.id, name: nm, ...curAv()});
      $("[data-pp-ct]", f).textContent = bio.value.length + " / 160";
    };
    const setUh = s => { ustate = s; uh.textContent = UH[s] || UH[""]; uh.className = s === "available" || s === "yours" ? "ok" : s && s !== "checking" ? "bad" : ""; };
    const check = () => { clearTimeout(ut); const v = user.value.trim(), my = ++seq;
      if (!v) return setUh(""); if (!/^[a-z0-9_]{3,20}$/.test(v)) return setUh("username_shape"); if (P && v === P.username) return setUh("yours");
      setUh("checking"); ut = setTimeout(async () => { try { const r = await q(sb.rpc("profile_username_available", {name: v})); if (my === seq) setUh(r); } catch { if (my === seq) setUh(""); } }, 350); };
    const fillForm = () => { name.value = (P && P.display_name) || ""; user.value = (P && P.username) || ""; bio.value = (P && P.bio) || ""; setUh(P && P.username ? "yours" : ""); pv(); };
    name.addEventListener("input", pv); bio.addEventListener("input", pv);
    user.addEventListener("input", () => { const v = user.value.toLowerCase().replace(/^@+/, "").replace(/[^a-z0-9_]/g, ""); if (v !== user.value) user.value = v; pv(); check(); });
    $("[data-pp-up]", f).addEventListener("click", () => file.click());
    rm.addEventListener("click", () => { pending = P && P.avatar_path ? "remove" : null; avn.textContent = P && P.avatar_path ? "Photo removed. Save to keep this change." : AVN; pv(); $("[data-pp-up]", f).focus(); });
    // square crop from the centre + resize to 256 px; WebP where the browser can encode it, JPEG otherwise
    file.addEventListener("change", async () => {
      const fl = file.files && file.files[0]; file.value = ""; if (!fl) return;
      if (!/^image\/(jpeg|png|webp)$/.test(fl.type)) { avn.textContent = "Use a JPG, PNG or WebP image."; return; }
      if (fl.size > 15 * 1024 * 1024) { avn.textContent = "That image is too big. Pick one under 15 MB."; return; }
      try {
        const img = await new Promise((res, rej) => { const i = new Image(), u = URL.createObjectURL(fl); i.onload = () => { URL.revokeObjectURL(u); res(i); }; i.onerror = () => { URL.revokeObjectURL(u); rej(); }; i.src = u; });
        const s = Math.min(img.naturalWidth, img.naturalHeight), cv = document.createElement("canvas"); cv.width = cv.height = 256;
        const g = cv.getContext("2d"); g.imageSmoothingQuality = "high"; g.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, 256, 256);
        const blob = (b => b && b.type === "image/webp" ? b : null)(await new Promise(r => cv.toBlob(r, "image/webp", 0.86))) || await new Promise(r => cv.toBlob(r, "image/jpeg", 0.88));
        if (!blob || blob.size > 2 * 1024 * 1024) throw 0;
        if (preview) URL.revokeObjectURL(preview);
        pending = {blob, type: blob.type, ext: blob.type === "image/webp" ? "webp" : "jpg"}; preview = URL.createObjectURL(blob);
        avn.textContent = "New photo ready. Save to use it."; pv();
      } catch { avn.textContent = "We couldn't read that image. Try another one."; }
    });
    // keep at most the current file in avatars/<uid>/ (the bucket allows 3), so a failed save never blocks the next one
    const tidy = async keep => { try { const L = await q(sb.storage.from("avatars").list(clerk.user.id)); const del = L.map(o => clerk.user.id + "/" + o.name).filter(p => p !== keep);
      if (del.length) await sb.storage.from("avatars").remove(del); } catch {} };
    f.addEventListener("submit", async e => {
      e.preventDefault(); if (save.disabled) return; save.disabled = true; say("Saving…");
      let nameSaved = false, uploaded = null;
      try {
        const nm = name.value.trim().replace(/\s+/g, " ");
        if (!nm && P && P.display_name) throw {message: "chat:name_shape"};
        if (nm && nm !== ((P && P.display_name) || "")) { await q(sb.rpc("chat_set_name", {p_name: nm})); nameSaved = true; }
        let path = (P && P.avatar_path) || null; const old = path;
        if (pending === "remove") path = null;
        else if (pending) { await tidy(old); uploaded = `${clerk.user.id}/${Date.now().toString(36)}.${pending.ext}`;
          const {error} = await sb.storage.from("avatars").upload(uploaded, pending.blob, {contentType: pending.type, cacheControl: "31536000", upsert: false});
          if (error) { uploaded = null; throw {message: "chat:avatar_upload"}; } path = uploaded; }
        await q(sb.rpc("profile_update", {p_username: user.value.trim() || null, p_bio: bio.value, p_avatar_path: path}));
        if (old && old !== path) sb.storage.from("avatars").remove([old]).catch(() => {});
        pending = null; avn.textContent = AVN; await load(); fillForm(); say("Saved. This is how others see you in Community.", "ok");
      } catch (x) {
        if (uploaded) sb.storage.from("avatars").remove([uploaded]).catch(() => {});
        if (nameSaved) { try { await load(); } catch {} }
        say(errCopy(x) + (nameSaved ? " Your new display name was saved." : " Nothing else changed."), "bad");
      }
      save.disabled = false;
    });
    // Account -> Delete your data: the avatar files go too (delete_my_data clears the profile row; files need the Storage API)
    addEventListener("lv:delete-account", () => { tidy(null); });
    fillForm();
  };

  const start = async () => {
    if (!window.LVAuth || !LVAuth.live) return editor();
    try { clerk = await LVAuth.load(); } catch { return editor(); }
    paint();
    if (!signed()) return editor();
    try { sb = await client(clerk); await load(); } catch { if (card) { $("[data-pp-off]", card).textContent = "We couldn't load your profile. Check your connection and refresh."; } return; }
    editor();
  };
  start();
})();
