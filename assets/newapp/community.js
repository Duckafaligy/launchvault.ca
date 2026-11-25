/* LaunchVault community chat (/app/community/). Front end only: the database, filters and moderation are server side (db/supabase/migrations).
   Reads and writes go through the Supabase client with the Clerk token (assets/supabase.js make()). Nothing here invents messages, names or activity:
   signed out you see the channel names and blurred skeleton bars, never fake posts. Calm by design: no typing dots, read receipts, reactions or points.
   Two views: Chat = one live chat for everyone (the #general room's main log), Threads = every thread from every channel, grouped by topic
   (each channel that allows threads is a topic; #general's threads are "Other & questions", shown last).
   Routes: #chat  #threads  #threads?topic=<slug>  #t/<id>  #settings  (?about=Name on #chat prefills "About Name: ").
   Old links still work: #<slug>?about=X -> chat, #general -> chat, #<slug> or #<slug>/threads -> that topic, #<slug>/t/<id> -> the thread. */
(() => {
  "use strict";
  if (!window.LVGate || !LVGate.ok) return;   // the age gate runs first; nothing is stored or fetched before it passes
  const root = document.getElementById("cm"); if (!root) return;
  const $ = (s, r = root) => r.querySelector(s), $$ = (s, r = root) => [...r.querySelectorAll(s)];
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
  const pane = $("#cmPane");

  // ---------- copy for every server error code (chat:xxx) ----------
  const DEFAULT = "That didn't send. Try again in a moment.";
  const ERR = {
    slow_down: "Slow down a little. Try again in a few seconds.", slow_mode: "This channel is in slow mode. Try again in a moment.",
    filter_contact: "Contact details, chat-app links and outside @handles aren't allowed. To mention a member, pick their @username from the list.", filter_link: "Links aren't allowed in this message.",
    filter_link_unknown: "That site isn't on our list of known sites. Leave the link out, or try another.", filter_link_shortener: "Shortened links aren't allowed. Paste the full link.",
    filter_link_new_account: "New members can post links after a day.", filter_link_count: "Two links per message, max.", filter_link_blocked: "That site isn't allowed.",
    filter_link_scheme: "That link isn't allowed.", filter_link_ip: "That link isn't allowed.", filter_link_lookalike: "That link isn't allowed.",
    filter_term: "That message can't be sent. Please reword it.", link_slow_down: "You've shared a few links already. Try again later.",
    read_only: "Only moderators can post in this channel.", banned: "You can't post right now. You can still read everything.",
    name: "Choose a chat name first.", rules: "Agree to the Community Guidelines first.", vote_first: "Vote first, then reply.", thread_closed: "This thread is closed. You can still read it.",
    locked: "This channel is paused for now. You can still read it.", duplicate: "You already sent that. Try saying something new.", empty: "Write a message first.",
    no_thread: "That thread isn't there any more.", no_threads_here: "Threads aren't turned on in this channel.", thread_slow_down: "You've started a few threads already. Try again in an hour.",
    title_length: "The title needs 3 to 80 characters.", option_length: "Each option can be up to 30 characters.", option_duplicate: "Each option needs to be different.",
    option_count: "A poll needs 2 to 6 options.", title_filter: "That title can't be used. Please reword it.", option_filter: "One of the options can't be used. Please reword it.",
    name_shape: "Use letters, spaces, dots, dashes or apostrophes (2 to 30), starting with a letter.", name_reserved: "That name isn't available. Pick another.",
    name_filter: "Please pick a different name.", name_slow_down: "You've changed your name a few times today. Try again tomorrow.",
    login: "Log in to join the conversation.", age: "Set your age range first, then try again.", not_a_poll: "That poll isn't available.", bad_option: "That option isn't available."
  };
  const errCopy = e => {
    if (navigator.onLine === false) return "You're offline, so that didn't send. What you wrote is still here.";
    const k = ((String(e && (e.message || e.details) || "")).match(/chat:([a-z_]+)/) || [])[1]; if (!k) return DEFAULT;
    if (ERR[k]) return ERR[k];
    const base = Object.keys(ERR).find(x => k.startsWith(x + "_")); return base ? ERR[base] : DEFAULT;
  };
  const errKey = e => ((String(e && (e.message || e.details) || "")).match(/chat:([a-z_]+)/) || [])[1] || "";

  // ---------- topics: the channels from the database. #general holds the live chat, and its threads are "Other & questions" ----------
  const S = {signed: false, ready: false, me: null, sb: null, clerk: null, prof: null, mods: new Set(), isMod: false, cats: [], rooms: [], known: new Set(), skipEntry: false, ch: null, pp: new Map()};   // pp: user_id -> public profile (public_profiles view), null while loading
  const CHAT = "general";
  const NAMES = {welcome: "Rules", announcements: "Announcements", introductions: "Introductions", breakdowns: "Story breakdowns", "what-im-trying": "What I'm trying", "apps-and-saas": "Apps and SaaS", "online-stores": "Online stores",
    "local-shops-and-restaurants": "Local shops and restaurants", "services-and-freelancing": "Services and freelancing", wins: "Wins", "ask-for-help": "Ask for help", [CHAT]: "Other & questions"};
  const topicName = r => NAMES[r.slug] || r.title;
  const chatRoom = () => roomBy(CHAT) || {id: 0, slug: CHAT, title: CHAT, description: "", allow_threads: true, read_only: false, locked: false, pinned_message_id: null};
  // channels that allow threads, in channel-list order, with Other & questions last
  const topics = () => { const cp = id => (S.cats.find(c => c.id === id) || {position: 99}).position;
    return S.rooms.filter(r => r.allow_threads).sort((a, b) => (a.slug === CHAT) - (b.slug === CHAT) || cp(a.category_id) - cp(b.category_id) || a.position - b.position); };

  // ---------- small helpers ----------
  const I = {
    hash: "", back: '<path d="M15 6l-6 6 6 6"/>', chev: '<path d="M6 9l6 6 6-6"/>', chevr: '<path d="M9 6l6 6-6 6"/>', lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 21h4"/>', belloff: '<path d="M6 16V11a6 6 0 0 1 1-3.3M18 11v5l1.5 2H8"/><path d="M10 21h4M4 4l16 16"/>',
    eye: '<path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
    more: '<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>',
    reply: '<path d="M9 7L4 12l5 5"/><path d="M4 12h9a6 6 0 0 1 6 6v1"/>', flag: '<path d="M6 21V4M6 5h11l-2 4 2 4H6"/>', trash: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
    ban: '<circle cx="12" cy="12" r="8"/><path d="M6.5 6.5l11 11"/>', pin: '<path d="M9 4h6l-1 6 3 3H7l3-3zM12 13v7"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', plus: '<path d="M12 5v14M5 12h14"/>',
    gear: '<path d="M4 7h9M19 7h1M4 17h1M11 17h9"/><circle cx="16" cy="7" r="2.5"/><circle cx="8" cy="17" r="2.5"/>', check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    warn: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.5"/>', list: '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>', search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>', ext: '<path d="M7 17L17 7M9 7h8v8"/>', msg: '<path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4.5 3.5V16H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/>'
  };
  const ic = (k, w = 18) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[k]}</svg>`;
  const time = d => new Date(d).toLocaleTimeString("en-US", {hour: "numeric", minute: "2-digit"}).replace(/\s?(AM|PM)/, (_, a) => " " + a.toLowerCase());
  const MON = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
  const dayKey = d => { const x = new Date(d); return x.getFullYear() * 400 + x.getMonth() * 32 + x.getDate(); };
  const dayLabel = d => { const x = new Date(d), n = new Date(); if (dayKey(d) === dayKey(n)) return "Today"; const y = new Date(n); y.setDate(n.getDate() - 1); if (dayKey(d) === dayKey(y)) return "Yesterday"; return MON[x.getMonth()] + " " + x.getDate(); };
  const ago = d => { const s = Math.max(0, (Date.now() - new Date(d)) / 1000); return s < 60 ? "just now" : s < 3600 ? Math.floor(s / 60) + "m ago" : s < 86400 ? Math.floor(s / 3600) + "h ago" : Math.floor(s / 86400) + "d ago"; };
  const AV = [["#EDE9FE", "#5B21B6"], ["#E5E7EB", "#1F2937"], ["#DBEAFE", "#1E40AF"], ["#DCFCE7", "#166534"], ["#FCE7F3", "#9D174D"], ["#E0F2FE", "#075985"]];
  const AVURL = "https://azriqynpnbltvxucwmpo.supabase.co/storage/v1/object/public/avatars/";
  const avatar = (key, name) => { const pp = S.pp.get(key);
    if (pp && pp.avatar_path) return `<span class="cm-av" aria-hidden="true"><img src="${esc(AVURL + pp.avatar_path)}" alt="" width="40" height="40" loading="lazy"></span>`;
    let h = 0; for (const c of String(key || name)) h = (h * 31 + c.charCodeAt(0)) >>> 0; const [bg, fg] = AV[h % AV.length];
    return `<span class="cm-av" style="background:${bg};color:${fg}" aria-hidden="true">${esc((name || "?").trim().charAt(0).toUpperCase())}</span>`; };
  const snip = (t, n = 60) => { t = String(t || "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; };
  const roomBy = slug => S.rooms.find(r => r.slug === slug);
  const q = async p => { const {data, error} = await p; if (error) throw error; return data; };

  // toast (the page's own #toast element and styles)
  let tt; const toast = msg => { const el = document.getElementById("toast"); if (!el) return; clearTimeout(tt);
    el.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6EE7B7" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg><span>${esc(msg)}</span>`;
    el.classList.add("on"); tt = setTimeout(() => el.classList.remove("on"), 4200); };

  // dialogs: native <dialog>, so focus is trapped, Esc closes, and focus goes back to what opened it
  const dlg = (html, cls = "") => {
    const opener = document.activeElement, d = document.createElement("dialog"); d.className = "cm-dlg " + cls; d.innerHTML = html;
    document.body.appendChild(d);
    d.addEventListener("close", () => { d.remove(); if (opener && opener.isConnected && opener.focus) opener.focus(); });
    d.addEventListener("click", e => { if (e.target === d) d.close(); });   // click on the dim area
    $$("[data-x]", d).forEach(b => b.addEventListener("click", () => d.close()));
    d.showModal(); return d;
  };
  const confirmDlg = (title, text, label, onOk) => {
    const d = dlg(`<div class="cm-dc"><h2>${esc(title)}</h2><p>${esc(text)}</p><div class="cm-dr"><button class="btn btn-s" type="button" data-x>Cancel</button><button class="btn cm-danger" type="button" data-ok>${esc(label)}</button></div></div>`, "cm-small");
    $("[data-ok]", d).addEventListener("click", async () => { d.close(); await onOk(); });
  };

  // ---------- links in messages: always through the "You're leaving LaunchVault" popup ----------
  const hostOf = u => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.hostname.toLowerCase().replace(/^www\./, "") : null; } catch { return null; } };
  const isKnown = h => { const p = h.split("."); for (let i = 0; i < p.length - 1; i++) if (S.known.has(p.slice(i).join("."))) return true; return false; };
  const body = t => esc(t).replace(/https?:\/\/[^\s<>]+/g, m => { const tail = (m.match(/[.,;:!?)\]]+$/) || [""])[0]; const url = m.slice(0, m.length - tail.length).replace(/&amp;/g, "&");
    return hostOf(url) ? `<button type="button" class="cm-link" data-url="${esc(url)}">${esc(url)}</button>${tail}` : m; })
    // @mentions (the server only lets real usernames through); yours is marked
    .replace(/(^|[^a-z0-9_\/@.&;=-])@([a-z0-9_]{3,20})(?![a-z0-9_]|\.[a-z0-9])/gi, (_, pre, u) => `${pre}<span class="cm-at${S.prof && S.prof.username === u.toLowerCase() ? " me" : ""}">@${u}</span>`);
  const unTag = uid => { const p = S.pp.get(uid); return p && p.username ? `<span class="cm-un">@${esc(p.username)}</span>` : ""; };
  // public profiles (avatar, @username) of whoever posted, one query per batch; rows painted before it arrives are repainted
  const people = async arr => {
    const need = [...new Set(arr.map(m => m && m.user_id).filter(u => u && u !== "launchvault" && !S.pp.has(u)))]; if (!need.length || !S.sb) return;
    need.forEach(u => S.pp.set(u, null));
    try { (await q(S.sb.from("public_profiles").select("user_id,username,display_name,avatar_path").in("user_id", need))).forEach(p => S.pp.set(p.user_id, p)); }
    catch { need.forEach(u => S.pp.delete(u)); }
  };
  const leaving = (url, msgId) => {
    const host = hostOf(url); if (!host) return; const known = isKnown(host);
    const d = dlg(`<div class="cm-dc"><h2 class="cm-lh">${known ? "" : ic("warn", 22)}${known ? "You're leaving LaunchVault" : "We don't know this site"}</h2>
      <p>${known ? "You're about to open a site outside LaunchVault." : "This site isn't on our list of known sites. Take extra care before you open it."}</p>
      <p class="cm-url">${esc(url)}</p><p class="cm-lead">Links can lead to</p>
      <ul class="cm-ul"><li>${ic("warn", 16)}Scams and fake login pages</li><li>${ic("warn", 16)}Harmful downloads</li><li>${ic("warn", 16)}Strangers pretending to be someone else</li></ul>
      <p class="cm-nv">Never enter passwords, card numbers or personal details. LaunchVault hasn't checked this link.</p>
      <div class="cm-dr col"><button class="btn btn-p" type="button" data-x>Go back</button><button class="btn btn-s" type="button" data-go>${known ? "Open link" : "Open link anyway"}</button></div>
      ${msgId ? '<button type="button" class="cm-rl" data-rep>Report this link</button>' : ""}</div>`, "cm-small");
    $("[data-go]", d).addEventListener("click", () => { window.open(url, "_blank", "noopener,noreferrer"); d.close(); });
    const rep = $("[data-rep]", d); if (rep) rep.addEventListener("click", () => { d.close(); reportDlg(msgId); });
  };
  root.addEventListener("click", e => { const b = e.target.closest(".cm-link"); if (!b) return; e.preventDefault(); const m = b.closest("[data-id]"); leaving(b.dataset.url, m ? +m.dataset.id : 0); });

  // ---------- state: realtime, routing ----------
  let cur = {tok: 0, room: null, view: "", thread: null};
  const unsub = () => { if (S.ch && S.sb) { try { S.sb.removeChannel(S.ch); } catch {} } S.ch = null; };
  const parse = () => { const [p, qs] = location.hash.slice(1).split("?"); const parts = p.split("/").filter(Boolean), sp = new URLSearchParams(qs || ""), about = sp.get("about") || "";
    if (parts[0] === "settings") return {view: "settings"};
    if (parts[0] === "t" && /^\d+$/.test(parts[1] || "")) return {view: "thread", id: +parts[1]};
    if (parts[0] === "threads") return {view: "threads", topic: sp.get("topic") || ""};
    if (parts[0] === "chat" && parts[1]) return {view: "chat", about, slug: parts[1]};
    if (!parts[0] || parts[0] === "chat" || parts[0] === CHAT || about) return {view: "chat", about};
    // old per-channel links
    if (parts[1] === "t" && /^\d+$/.test(parts[2] || "")) return {view: "thread", id: +parts[2]};
    return {view: "threads", topic: parts[0]}; };

  // ---------- pane pieces ----------
  // one bar on top: a 2-way switch (Chat / Threads) and Settings; a thread or Settings gets a back link instead
  const header = (view, back = null) => `<header class="cm-h">${back ? `<a class="cm-back" href="${back[0]}">${ic("back", 20)}<span>${back[1]}</span></a><span class="cm-div"></span>` :
    `<nav class="cm-tabs" aria-label="Community"><a href="#chat"${view === "chat" ? ' aria-current="page"' : ""}>${ic("msg", 18)}Chat</a><a href="#threads"${view === "threads" ? ' aria-current="page"' : ""}>${ic("list", 18)}Threads</a></nav><span class="cm-div"></span>`}` +
    (S.signed ? (view === "settings" ? "" : `<a class="cm-gear" href="#settings" aria-label="Chat settings">${ic("gear", 20)}</a>`) : `<a class="btn btn-s" href="/sign-in/">Sign in</a>`) + `</header>`;
  const skeleton = (kind, room) => `<div class="cm-sk ${kind}" aria-hidden="true">${Array.from({length: kind === "cards" ? 6 : 7}, (_, i) => kind === "cards" ? `<div class="sk-card"><i class="b1"></i><i class="b2"></i><i class="b3"></i></div>` : `<div class="sk-row"><i class="sk-av"></i><span><i class="b1" style="width:${[34, 22, 40, 28, 36, 24, 30][i]}%"></i><i class="b2" style="width:${[78, 62, 88, 54, 70, 82, 60][i]}%"></i></span></div>`).join("")}</div>
    <div class="cm-join card"><h2>Log in to join the conversation</h2><p>Members read every ${kind === "cards" ? "thread" : "message"} and reply. Every story stays free to read without an account.</p><div class="cm-dr"><a class="btn btn-p" href="/sign-up/">Sign up</a><a class="btn btn-s" href="/sign-in/">Sign in</a></div></div>`;
  const setView = v => { root.dataset.v = v; };
  const busy = () => { pane.innerHTML = '<p class="cm-load" role="status">Loading…</p>'; };
  const failed = (retry) => { pane.innerHTML = `<div class="cm-empty"><p>We couldn't load this. Check your connection and try again.</p><button class="btn btn-s" type="button" id="cmRetry">Try again</button></div>`; $("#cmRetry").addEventListener("click", retry); };

  // ---------- messages ----------
  const msgBadges = m => (m.user_id === "launchvault" ? '<span class="cm-bd sys">LaunchVault</span>' : "") + (S.me && m.user_id === S.me.id ? '<span class="cm-bd you">You</span>' : "") + (S.mods.has(m.user_id) ? '<span class="cm-bd mod">Moderator</span>' : "");
  const optBadge = m => { const o = cur.opts && cur.opts.find(x => x.id === m.option_id); return o ? `<span class="cm-opt o${o.position}"><b>${"ABCDEF"[o.position - 1]}</b>${esc(o.label)}</span>` : ""; };
  const msgHTML = m => {
    if (m.gone) return `<article class="cm-m cm-gone" data-id="${m.id}"><span class="cm-av gone" aria-hidden="true">${ic("ban", 18)}</span><p class="gt"><em>${esc(m.gone)}</em></p><time datetime="${esc(m.created_at)}">${time(m.created_at)}</time></article>`;
    const p = m.reply_to && cur.msgs.get(m.reply_to), sys = m.user_id === "launchvault";
    const rp = m.reply_to ? (p ? `<button type="button" class="cm-rp" data-jump="${p.id}">${ic("reply", 14)}<b>Replying to ${esc(p.author_name)}</b><span>${esc(snip(p.body))}</span></button>` : `<p class="cm-rp off">${ic("reply", 14)}<b>Replying to a message</b></p>`) : "";
    return `<article class="cm-m${S.me && m.user_id === S.me.id ? " mine" : ""}${m.hidden ? " cm-hid" : ""}" data-id="${m.id}" id="m${m.id}">${avatar(m.user_id, m.author_name)}<div class="cm-mb">${rp}<p class="cm-mh"><b>${esc(m.author_name)}</b>${m.author_tag ? `<span class="tg">· ${esc(m.author_tag)}</span>` : ""}${unTag(m.user_id)}${msgBadges(m)}${optBadge(m)}${m.hidden ? `<span class="cm-bd del" title="Only moderators can see this">${({author: "Deleted by the author", moderator: "Removed by a moderator", reports: "Hidden after reports", ban: "Hidden, member banned", ai: "Hidden by the filter", link: "Hidden, bad link", media: "Hidden, media"})[m.hidden_reason] || "Deleted"}</span>` : ""}<time datetime="${esc(m.created_at)}">${time(m.created_at)}</time></p><p class="cm-tx">${body(m.body)}</p></div>${S.signed && !sys ? `<button type="button" class="cm-more" data-menu="${m.id}" aria-label="Options for the message from ${esc(m.author_name)}" aria-haspopup="dialog">${ic("more", 20)}</button>` : ""}</article>`;
  };
  const withDays = arr => { let last = -1; return arr.map(m => { const k = dayKey(m.created_at), sep = k !== last ? `<div class="cm-day"><span>${dayLabel(m.created_at)}</span></div>` : ""; last = k; return sep + msgHTML(m); }).join(""); };
  const nearBottom = el => el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  const addMsg = (m, logEl) => {
    if (cur.msgs.has(m.id)) return false; cur.msgs.set(m.id, m); const stick = nearBottom(logEl);
    const lastDay = [...logEl.querySelectorAll("time")].pop(); const sep = !lastDay || dayKey(lastDay.getAttribute("datetime")) !== dayKey(m.created_at) ? `<div class="cm-day"><span>${dayLabel(m.created_at)}</span></div>` : "";
    const e = logEl.querySelector(".cm-none"); if (e) e.remove();
    logEl.insertAdjacentHTML("beforeend", sep + msgHTML(m));
    if (!S.pp.has(m.user_id)) people([m]).then(() => { const r = $(`#m${m.id}`), x = cur.msgs.get(m.id); if (r && x) r.outerHTML = msgHTML(x); });   // a new face: repaint with their avatar
    if (stick || (S.me && m.user_id === S.me.id)) logEl.scrollTop = logEl.scrollHeight; return true;
  };
  const goneRow = (id, text) => { const old = cur.msgs.get(id); if (!old) return;
    if (cur.view === "chat" && !(S.isMod && old.body)) {   // in a channel a removed message just goes (no placeholder); "Seen by" moves to the message before it
      cur.msgs.delete(id); const row = $(`[data-id="${id}"]`), log = $("#cmLog"); if (row) row.remove();
      if (log) { log.querySelectorAll(".cm-day").forEach(dv => { const nx = dv.nextElementSibling; if (!nx || !nx.classList.contains("cm-m")) dv.remove(); }); const sn = $(".cm-seen", log); if (sn) sn.remove(); }
      return void paintSeen(); }
    const m = S.isMod && old.body ? {...old, hidden: true, hidden_reason: old.hidden_reason || (S.me && old.user_id === S.me.id ? "author" : "moderator")} : {...old, gone: text}; /* moderators keep the text, greyed out */ cur.msgs.set(id, m); const row = $(`[data-id="${id}"]`); if (row) row.outerHTML = msgHTML(m); };
  const fillParents = async arr => { await people(arr); const need = [...new Set(arr.map(m => m.reply_to).filter(id => id && !cur.msgs.has(id) && !arr.some(x => x.id === id)))]; if (!need.length) return;
    try { (await q(S.sb.from("chat_messages").select("*").in("id", need))).forEach(p => cur.msgs.set(p.id, p)); } catch {} };

  // message menu, report, delete, mod actions
  const menu = id => {
    const m = cur.msgs.get(id); if (!m) return; const mine = S.me && m.user_id === S.me.id, canReply = canPost();
    const items = [canReply && ["reply", "reply", "Reply"], !mine && ["flag", "report", "Report", "pop"], mine && ["trash", "delete", "Delete", "pop"],
      S.isMod && cur.room && !cur.thread && ["pin", "pin", cur.room.pinned_message_id === id ? "Unpin" : "Pin"], S.isMod && !mine && ["ban", "remove", "Remove", "pop"]].filter(Boolean);
    const d = dlg(`<div class="cm-sheet-in"><span class="cm-grab" aria-hidden="true"></span><p class="cm-st">Message from ${esc(m.author_name)}</p>${items.map(([i, a, l, c]) => `<button type="button" class="cm-mi ${c || ""}" data-a="${a}">${ic(i, 20)}<span>${l}</span></button>`).join("")}<button type="button" class="cm-mi" data-x>${ic("x", 20)}<span>Cancel</span></button></div>`, "cm-sheet");
    $$("[data-a]", d).forEach(b => b.addEventListener("click", async () => { const a = b.dataset.a; d.close();
      if (a === "reply") setReply(m);
      else if (a === "report") reportDlg(id);
      else if (a === "delete") confirmDlg("Delete this message?", "It disappears for everyone. You cannot undo this.", "Delete", async () => { try { await q(S.sb.rpc("chat_delete_message", {p_id: id})); goneRow(id, "This message was removed"); } catch (e) { toast(errCopy(e)); } });
      else if (a === "pin") { try { const un = cur.room.pinned_message_id === id; await q(S.sb.rpc("chat_pin", {p_room: cur.room.id, p_message: un ? null : id})); cur.room.pinned_message_id = un ? null : id; paintPin(); toast(un ? "Unpinned." : "Pinned."); } catch (e) { toast(errCopy(e)); } }
      else if (a === "remove") { try { await q(S.sb.rpc("chat_mod_remove", {p_message: id})); goneRow(id, "This message was removed"); } catch (e) { toast(errCopy(e)); } } }));
  };
  function reportDlg(id) {
    const m = cur.msgs.get(id) || {author_name: "", body: ""}; const R = [["mean", "Mean"], ["unsafe", "Unsafe"], ["spam", "Spam"], ["personal info", "Personal info"], ["other", "Other"]];
    const d = dlg(`<form class="cm-dc cm-rf" novalidate><span class="cm-grab" aria-hidden="true"></span><h2>Report this message</h2><p class="cm-quote"><b>${esc(m.author_name)}</b> ${esc(snip(m.body, 90))}</p>
      <fieldset><legend>What is wrong with it?</legend>${R.map(([v, l]) => `<label class="cm-rad"><input type="radio" name="reason" value="${v}"><span>${l}</span></label>`).join("")}</fieldset>
      <label class="cm-lbl" for="rnote">Add a note (optional)</label><textarea id="rnote" maxlength="300" rows="3" placeholder="Anything else we should know?"></textarea>
      <p class="cm-err" role="alert" hidden></p><div class="cm-dr"><button class="btn btn-s" type="button" data-x>Cancel</button><button class="btn cm-danger" type="submit">Send report</button></div><p class="cm-nv">Reports go to the LaunchVault team. One reason is needed. The note is optional.</p></form>`, "cm-sheet");
    const f = $("form", d), err = $(".cm-err", d);
    f.addEventListener("submit", async e => { e.preventDefault(); const reason = (new FormData(f)).get("reason"); if (!reason) { err.hidden = false; err.textContent = "Pick one reason."; return; }
      const btn = $('[type="submit"]', f); btn.disabled = true; const note = $("#rnote", d).value.trim();
      try { const {error} = await S.sb.from("chat_reports").insert({message_id: id, reason, note: note || null}); if (error && error.code !== "23505") throw error;   // 23505: already reported, same thanks
        d.close(); goneRow(id, "You reported this message. It's hidden from you while we look at it."); toast("Thanks. We'll look at it."); } catch (x) { btn.disabled = false; err.hidden = false; err.textContent = errCopy(x); } });
  }

  // ---------- composer ----------
  const canPost = () => S.signed && S.prof && S.prof.display_name && S.prof.chat_rules_at && cur.room && !cur.room.locked && !(cur.room.read_only && !S.isMod) && !cur.closed;
  const composerBlock = () => {
    if (cur.room.locked) return "This channel is paused for now. You can still read it.";
    if (cur.room.read_only && !S.isMod) return `Only moderators can post here. Say hi in <a href="#introductions">#introductions</a>.`;
    if (cur.closed) return "This thread is closed. You can still read it.";
    if (!S.prof || !S.prof.display_name || !S.prof.chat_rules_at) return `Choose a chat name and agree to the Community Guidelines to post. <button type="button" class="tl" data-entry>Get started</button>`;
    return "";
  };
  const composerHTML = (label, help) => { const b = composerBlock(); if (b) return `<div class="cm-comp"><p class="cm-block">${ic("lock", 18)}<span>${b}</span></p></div>`;
    return `<form class="cm-comp" novalidate><p class="cm-reply" hidden></p><div class="cm-box"><textarea rows="1" maxlength="800" placeholder="${esc(label)}" aria-label="${esc(label)}" enterkeyhint="send"></textarea><button class="btn btn-p" type="submit">Send</button></div>
      <p class="cm-hint"><span>${esc(help || "Type @ to mention someone. No contact details or chat-app links.")}</span><span class="cm-ct" aria-live="polite"></span></p><p class="cm-err" role="alert" hidden></p></form>`; };
  const setReply = m => { cur.replyTo = m; const r = $(".cm-reply"); if (!r) return; r.hidden = !m; r.innerHTML = m ? `${ic("reply", 16)}<span>Replying to ${esc(m.author_name)}</span><button type="button" class="cm-x" aria-label="Cancel reply">${ic("x", 16)}</button>` : "";
    const x = $(".cm-x", r); if (x) x.addEventListener("click", () => setReply(null)); const ta = $(".cm-comp textarea"); if (ta) ta.focus(); };
  // @mention autocomplete: typing "@" lists members seen in this view; more letters also ask profile_search (8 max)
  const mentions = (ta, f) => {
    const box = document.createElement("ul"); box.className = "cm-ac"; box.id = "cmAc" + cur.tok; box.setAttribute("role", "listbox"); box.setAttribute("aria-label", "Mention a member"); box.hidden = true;
    f.prepend(box); Object.entries({role: "combobox", "aria-autocomplete": "list", "aria-controls": box.id, "aria-expanded": "false"}).forEach(([k, v]) => ta.setAttribute(k, v));
    let list = [], idx = 0, tok = null, seq = 0, tm = 0;
    const token = () => { const s = ta.value.slice(0, ta.selectionStart), m = s.match(/(^|[^a-z0-9_\/@.])@([a-z0-9_]{0,20})$/i); return m ? {q: m[2].toLowerCase(), at: s.length - m[2].length - 1} : null; };
    const close = () => { box.hidden = true; list = []; ta.setAttribute("aria-expanded", "false"); ta.removeAttribute("aria-activedescendant"); };
    const show = () => { if (!list.length) return close();
      box.innerHTML = list.map((p, i) => `<li role="option" id="${box.id}-${i}" aria-selected="${i === idx}" data-i="${i}">${avatar(p.user_id, p.display_name || p.username)}<span><b>${esc(p.display_name || p.username)}</b><span>@${esc(p.username)}</span></span></li>`).join("");
      box.hidden = false; ta.setAttribute("aria-expanded", "true"); ta.setAttribute("aria-activedescendant", `${box.id}-${idx}`); };
    const local = s => [...S.pp.values()].filter(p => p && p.username && p.user_id !== S.me.id && p.username.startsWith(s)).sort((a, b) => a.username.localeCompare(b.username));
    const update = () => { tok = token(); clearTimeout(tm); if (!tok) return close(); const s = tok.q, my = ++seq;
      list = local(s).slice(0, 8); idx = 0; show(); if (!s) return;
      tm = setTimeout(async () => { try { const r = await q(S.sb.rpc("profile_search", {p_prefix: s})); if (my !== seq) return;
        r.forEach(p => { if (!S.pp.get(p.user_id)) S.pp.set(p.user_id, p); }); const seen = new Set();
        list = [...local(s), ...r.filter(p => p.user_id !== S.me.id)].filter(p => !seen.has(p.username) && seen.add(p.username)).slice(0, 8); idx = Math.min(idx, Math.max(0, list.length - 1)); show(); } catch {} }, 200); };
    const pick = i => { const p = list[i]; if (!p || !tok) return; const before = ta.value.slice(0, tok.at), after = ta.value.slice(ta.selectionStart).replace(/^\s/, ""), ins = "@" + p.username + " ";
      ta.value = before + ins + after; const c = before.length + ins.length; ta.setSelectionRange(c, c); close(); ta.dispatchEvent(new Event("input")); ta.focus(); };
    ta.addEventListener("input", update); ta.addEventListener("click", update); ta.addEventListener("blur", () => setTimeout(close, 150));
    ta.addEventListener("keydown", e => { if (box.hidden || e.isComposing) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); idx = (idx + (e.key === "ArrowDown" ? 1 : -1) + list.length) % list.length; show(); }
      else if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); e.stopImmediatePropagation(); pick(idx); }
      else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); } });
    box.addEventListener("mousedown", e => { const li = e.target.closest("[data-i]"); if (li) { e.preventDefault(); pick(+li.dataset.i); } });
  };
  const bindComposer = (logEl, extra = {}) => {
    const eb = $("[data-entry]"); if (eb) eb.addEventListener("click", () => entry());
    const f = $("form.cm-comp"); if (!f) return; const ta = $("textarea", f), ct = $(".cm-ct", f), err = $(".cm-err", f), btn = $('[type="submit"]', f);
    if (extra.about && !ta.value) { ta.value = "About " + extra.about + ": "; }
    const grow = () => { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 150) + "px"; const n = ta.value.length; ct.textContent = n >= 700 ? n + " / 800" : ""; ct.classList.toggle("max", n >= 780); };
    ta.addEventListener("input", grow); grow();
    mentions(ta, f);   // registers its keydown first, so Enter/Tab pick a name instead of sending while the list is open
    ta.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); f.requestSubmit(); } });
    f.addEventListener("submit", async e => { e.preventDefault(); const text = ta.value.trim(); if (!text || btn.disabled) return; btn.disabled = true; err.hidden = true;
      const row = {room_id: cur.room.id, body: text}; if (cur.thread) row.thread_id = cur.thread.id; if (cur.replyTo) row.reply_to = cur.replyTo.id;
      try { const m = await q(S.sb.from("chat_messages").insert(row).select().single()); ta.value = ""; grow(); setReply(null); await fillParents([m]); if (addMsg(m, logEl) && extra.onSent) extra.onSent(m); }
      catch (x) { err.hidden = false; err.textContent = errCopy(x); const k = errKey(x); if (k === "name" || k === "rules") entry(); }   // the draft stays in the box
      btn.disabled = false; ta.focus(); });
  };

  // ---------- chat view ----------
  const paintPin = async () => { const el = $("#cmPin"); if (!el) return; const id = cur.room.pinned_message_id; if (!id) { el.hidden = true; return; }
    let m = cur.msgs.get(id); if (!m) { try { m = await q(S.sb.from("chat_messages").select("*").eq("id", id).maybeSingle()); } catch {} } if (!m) { el.hidden = true; return; }
    el.hidden = false; el.innerHTML = `${ic("pin", 16)}<b>Pinned</b><span>${esc(m.author_name)}: ${esc(snip(m.body, 90))}</span>${ic("chevr", 16)}`; el.onclick = () => { const row = $(`#m${id}`); if (row) { row.scrollIntoView({block: "center", behavior: "smooth"}); row.classList.add("flash"); setTimeout(() => row.classList.remove("flash"), 1600); } }; };
  // the channel list: categories in order, channels inside them. Read-only ones (rules, announcements) carry a lock.
  const chanList = on => { const cats = S.cats.slice().sort((a, b) => a.position - b.position), seen = new Set();
    const li = r => { seen.add(r.id); return `<a href="#chat/${r.slug}"${r.id === on.id ? ' aria-current="page"' : ""}><i aria-hidden="true">${r.read_only ? ic("lock", 14) : "#"}</i><span>${esc(topicName(r))}</span>${r.id !== on.id && S.unread && S.unread.has(r.id) ? '<em class="cm-new" title="New messages"><span class="sr">New messages</span></em>' : ""}</a>`; };
    const by = id => S.rooms.filter(r => r.category_id === id).sort((a, b) => a.position - b.position);
    const out = cats.map(c => { const rs = by(c.id); return rs.length ? `<div class="cm-cg"><p>${esc(c.title || c.name || "")}</p>${rs.map(li).join("")}</div>` : ""; }).join("");
    const rest = S.rooms.filter(r => !seen.has(r.id));
    return `<nav class="cm-chans" aria-label="Channels">${out}${rest.length ? `<div class="cm-cg">${rest.map(li).join("")}</div>` : ""}</nav>`; };
  // unread dots: which channels have something newer than my last visit (asked on open, on switching channel, and when the tab comes back)
  const dotNav = () => { const nav = $(".cm-chans"); if (nav && cur.room && cur.view === "chat") nav.outerHTML = chanList(cur.room); };
  // live: a message landing in a channel you are not looking at lights its dot straight away
  const watchAll = () => { if (S.chAll || !S.sb || !S.sb.channel) return;
    S.chAll = S.sb.channel("lv-unread").on("postgres_changes", {event: "INSERT", schema: "public", table: "chat_messages"}, p => { const m = p.new;
      if (!m || (S.me && m.user_id === S.me.id) || (cur.view === "chat" && cur.room && cur.room.id === m.room_id && !document.hidden)) return;
      (S.unread || (S.unread = new Set())).add(Number(m.room_id)); dotNav(); }).subscribe(); };
  const loadUnread = async () => { watchAll(); if (!S.sb || !S.signed) return; let ids; try { ids = (await q(S.sb.rpc("chat_unread_rooms"))).map(Number); } catch { return; }
    if (cur.room && cur.view === "chat" && !document.hidden) ids = ids.filter(x => x !== cur.room.id);
    const was = [...(S.unread || [])].sort().join(), now = ids.slice().sort().join(); S.unread = new Set(ids); if (was !== now) dotNav(); };
  // ponytail: asked again every 10 s while the tab is visible, so a dot shows even if the live connection drops; cheap (one small query)
  setInterval(() => { if (!document.hidden && S.signed && cur.view === "chat") loadUnread(); }, 10000);
  // "Seen by": who has opened this channel since its latest message. Always the last line of the log.
  const paintSeen = async () => { const room = cur.room, tok = cur.tok, logEl = $("#cmLog"); if (!room || cur.view !== "chat" || !logEl || !S.sb) return;
    let rows; try { rows = await q(S.sb.rpc("chat_seen_by", {p_room: room.id})); } catch { return; }
    if (tok !== cur.tok) return; const old = $(".cm-seen", logEl), stick = nearBottom(logEl); if (old) old.remove(); if (!rows.length || !logEl.querySelector(".cm-m")) return;
    const names = rows.slice(0, 3).map(r => esc(r.display_name)), more = Number(rows[0].total) - names.length;
    logEl.insertAdjacentHTML("beforeend", `<p class="cm-seen" title="${esc(rows.map(r => r.display_name).join(", "))}${more > rows.length - 3 && Number(rows[0].total) > rows.length ? " and others" : ""}">${ic("eye", 14)}<span>Seen by ${names.join(", ")}${more > 0 ? ` and ${more} more` : ""}</span></p>`);
    if (stick) logEl.scrollTop = logEl.scrollHeight; };
  const markRead = () => { clearTimeout(markRead.t); markRead.t = setTimeout(() => { if (cur.room && cur.view === "chat" && !document.hidden) S.sb.rpc("chat_mark_read", {p_room: cur.room.id}).then(() => {}, () => {}); }, 600); };
  // ponytail: a 20 s poll while the channel is open and the tab is visible; switch to realtime on chat_room_reads if the chat gets busy
  setInterval(() => { if (!document.hidden && cur.view === "chat" && cur.room) paintSeen(); }, 20000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { markRead(); loadUnread(); } });
  const RULES = `<div class="cm-rulecard"><h2>Community Guidelines</h2><ul><li><b>Be kind.</b> Disagree with ideas, not people.</li><li><b>No personal info.</b> No school, address, phone number or socials, yours or anyone else's.</li><li><b>Stay on topic.</b> Building, stories and what you're trying.</li><li><b>No selling or spam.</b> Share what you made; don't pitch it.</li><li><b>Report, don't fight.</b> Use the menu on any message.</li></ul><p><a href="/legal/community/">Read the full guidelines</a></p></div>`;
  const showChat = async (about, slug) => {
    const room = (slug && roomBy(slug)) || chatRoom(), tok = ++cur.tok; cur = {tok, room, view: "chat", thread: null, msgs: new Map(), replyTo: null}; setView("chan");
    if (!S.signed) { pane.innerHTML = header("chat") + `<div class="cm-body">${skeleton("rows", room)}</div>`; return; }
    pane.classList.toggle("has-ch", S.rooms.length > 1);
    pane.innerHTML = header("chat") + (S.rooms.length > 1 ? chanList(room) : "") + `<div class="cm-chh"><b>${room.read_only ? ic("lock", 16) : "#"} ${esc(topicName(room))}</b><span>${esc(room.description || "")}</span></div><button type="button" class="cm-pin" id="cmPin" hidden></button><div class="cm-log" id="cmLog" role="log" aria-label="Chat messages" tabindex="0"><p class="cm-load" role="status">Loading messages…</p></div><div id="cmComp"></div>`;
    { const on = $(".cm-chans [aria-current]"), box = $(".cm-chans"); if (on && box && box.scrollWidth > box.clientWidth) box.scrollLeft = on.offsetLeft - 16; }   // phones: the strip shows the channel you are in
    let rows; try { rows = (await q(S.sb.from("chat_messages").select("*").eq("room_id", room.id).is("thread_id", null).order("created_at", {ascending: false}).limit(50))).reverse(); } catch { if (tok === cur.tok) { $("#cmLog").innerHTML = `<div class="cm-empty"><p>We couldn't load the messages.</p><button class="btn btn-s" type="button" id="cmRetry">Try again</button></div>`; $("#cmRetry").addEventListener("click", () => showChat(about, slug)); } return; }
    if (tok !== cur.tok) return;
    rows.forEach(m => cur.msgs.set(m.id, m)); await fillParents(rows); if (tok !== cur.tok) return;
    const logEl = $("#cmLog"); logEl.innerHTML = rows.length ? withDays(rows) : room.slug === "welcome" ? RULES : `<div class="cm-none cm-empty">${ic("msg", 28)}<p>${room.read_only ? "Nothing posted here yet." : "No messages yet. Say hi."}</p></div>`; logEl.scrollTop = logEl.scrollHeight;
    $("#cmComp").innerHTML = composerHTML(room.slug === CHAT ? "Message everyone" : "Message #" + topicName(room).toLowerCase()); bindComposer(logEl, {about}); paintPin();
    logEl.addEventListener("click", e => { const mb = e.target.closest("[data-menu]"); if (mb) return menu(+mb.dataset.menu); const j = e.target.closest("[data-jump]"); if (j) { const r = $(`#m${j.dataset.jump}`); if (r) { r.scrollIntoView({block: "center", behavior: "smooth"}); r.classList.add("flash"); setTimeout(() => r.classList.remove("flash"), 1600); } } });
    subscribe(room, m => { if (!m.thread_id) { const o = $(".cm-seen", logEl); if (o) o.remove(); addMsg(m, logEl); markRead(); setTimeout(paintSeen, 1500); } }, id => { goneRow(id, "This message was removed"); setTimeout(paintSeen, 800); });
    S.sb.rpc("chat_mark_read", {p_room: room.id}).then(() => {}, () => {});
    paintSeen(); loadUnread();
  };
  // room = null: every channel (the threads list)
  const subscribe = (room, onMsg, onGone) => { unsub(); const sb = S.sb; if (!sb || !sb.channel) return; const f = room ? {filter: "room_id=eq." + room.id} : {}, mine = () => room ? cur.room && cur.room.id === room.id : cur.view === "threads";
    S.ch = sb.channel("lv-room-" + (room ? room.id : "all")).on("postgres_changes", {event: "INSERT", schema: "public", table: "chat_messages", ...f}, p => { if (mine()) onMsg(p.new); })
      .on("postgres_changes", {event: "INSERT", schema: "public", table: "chat_removals", ...f}, p => { if (mine()) onGone(p.new.message_id); }).subscribe(); };

  // ---------- threads: every thread, grouped by topic, with a sticky topic filter and a title search ----------
  const isClosed = t => t.locked || t.hidden || t.archived_at || new Date(t.last_reply_at) < Date.now() - 7 * 864e5;
  const canStart = r => r.allow_threads && !r.locked && !(r.read_only && !S.isMod);
  const PER = 5;   // newest threads per section in the All view
  const showThreads = async (topic = "") => {
    const tok = ++cur.tok; cur = {tok, room: null, view: "threads", thread: null, msgs: new Map(), topic: roomBy(topic) ? topic : "", find: "", th: null}; setView("chan");
    if (!S.signed) { pane.innerHTML = header("threads") + `<div class="cm-body">${skeleton("cards")}</div>`; return; }
    pane.innerHTML = header("threads") + `<div class="cm-body cm-tl" id="cmTL"><div class="cm-tools"><label class="cm-find"><span class="sr">Search thread titles</span>${ic("search", 18)}<input type="search" id="cmFind" placeholder="Search thread titles" autocomplete="off" enterkeyhint="search"></label><button type="button" class="btn btn-p" id="cmNew">${ic("plus", 18)}Start a thread</button></div>
      <div class="cm-fbw"><div class="cm-fb" id="cmFB" role="group" aria-label="Topics"></div></div><div id="cmFeed" aria-live="polite"><p class="cm-load" role="status">Loading threads…</p></div></div>`;
    $("#cmNew").addEventListener("click", () => startDlg(roomBy(cur.topic)));
    $("#cmFind").addEventListener("input", e => { cur.find = e.target.value.trim().toLowerCase(); paintFeed(); });
    $("#cmFB").addEventListener("click", e => { const b = e.target.closest("[data-topic]"); if (b) pickTopic(b.dataset.topic); });
    $("#cmFeed").addEventListener("click", e => { const b = e.target.closest("[data-more]"); if (b) pickTopic(b.dataset.more); const n = e.target.closest("[data-new]"); if (n) startDlg(roomBy(n.dataset.new)); });
    if (!(await loadThreads(tok))) return;
    paintFeed();
    subscribe(null, m => { if (m.thread_id) { clearTimeout(cur.rt); const t = cur.tok; cur.rt = setTimeout(async () => { if (await loadThreads(t)) paintFeed(); }, 800); } }, () => {});
  };
  // ponytail: the 500 most active threads; add paging when the community outgrows that
  const loadThreads = async tok => {
    try { const th = await q(S.sb.from("chat_threads").select("id,room_id,title,kind,pinned,locked,archived_at,hidden,reply_count,last_reply_at,created_at").order("last_reply_at", {ascending: false}).limit(500));
      if (tok !== cur.tok) return false; cur.th = S.isMod ? th : th.filter(t => !t.archived_at); return true; }
    catch { if (tok === cur.tok) { $("#cmFeed").innerHTML = `<div class="cm-empty"><p>We couldn't load the threads.</p><button class="btn btn-s" type="button" id="cmRetry">Try again</button></div>`; $("#cmRetry").addEventListener("click", () => showThreads(cur.topic)); } return false; } };
  const pickTopic = slug => { cur.topic = slug; history.replaceState(null, "", slug ? `#threads?topic=${slug}` : "#threads"); paintFeed();
    const body = $("#cmTL"); if (body) body.scrollTo({top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"});   // a picked topic is the only section, so its top is the top
    const chip = $(`#cmFB [data-topic="${slug}"]`); if (chip) { chip.scrollIntoView({block: "nearest", inline: "center"}); chip.focus({preventScroll: true}); } };
  const row = t => { const r = S.rooms.find(x => x.id === t.room_id), closed = isClosed(t);
    return `<li><a class="cm-tr" href="#t/${t.id}"><span class="cm-tt"><b>${esc(t.title)}</b><span class="tg">${r ? esc(topicName(r)) : ""}${t.kind === "poll" ? " · Poll" : ""}${t.pinned ? " · Pinned" : ""}${t.locked ? " · Locked" : t.archived_at ? " · Archived" : closed ? " · Closed" : ""}</span></span>
      <span class="cm-tm"><span>${t.reply_count} ${t.reply_count === 1 ? "reply" : "replies"}</span><span class="tg">${ago(t.last_reply_at)}</span></span></a></li>`; };
  const paintFeed = () => {
    const all = cur.th || [], hit = all.filter(t => !cur.find || t.title.toLowerCase().includes(cur.find)), tps = topics();
    const by = id => hit.filter(t => t.room_id === id).sort((a, b) => (b.pinned - a.pinned) || (new Date(b.last_reply_at) - new Date(a.last_reply_at)));
    $("#cmFB").innerHTML = [["", "All", hit.length], ...tps.map(r => [r.slug, topicName(r), by(r.id).length])].map(([s, n, c]) =>
      `<button type="button" data-topic="${s}" aria-pressed="${cur.topic === s}">${esc(n)}<span class="ct">${c}</span></button>`).join("");
    const shown = cur.topic ? tps.filter(r => r.slug === cur.topic) : tps.filter(r => by(r.id).length);
    const sec = r => { const ts = by(r.id), cut = cur.topic || cur.find ? ts : ts.slice(0, PER);
      return `<section class="cm-ts" id="tp-${r.slug}" aria-labelledby="tph-${r.slug}"><div class="cm-tsh"><h2 id="tph-${r.slug}">${esc(topicName(r))}</h2><span class="tg">${ts.length} ${ts.length === 1 ? "thread" : "threads"}</span></div>` +
        (ts.length ? `<ul class="cm-tlist">${cut.map(row).join("")}</ul>${cut.length < ts.length ? `<button type="button" class="tl cm-more2" data-more="${r.slug}">Show all ${ts.length} in ${esc(topicName(r))}</button>` : ""}`
          : `<div class="cm-empty sm"><p>${cur.find ? "No thread titles here match your search." : `Nothing has been posted in ${esc(topicName(r))} yet.`}</p>${!cur.find && canStart(r) ? `<button type="button" class="btn btn-s" data-new="${r.slug}">Start a thread</button>` : ""}</div>`) + `</section>`; };
    $("#cmFeed").innerHTML = shown.length ? shown.map(sec).join("") : `<div class="cm-empty">${ic("msg", 28)}<p>${cur.find ? "No thread titles match your search." : "Nothing has been posted in Threads yet."}</p>${cur.find ? "" : `<button type="button" class="btn btn-p" data-new="">Start a thread</button>`}</div>`;
  };

  // start a thread: pick a topic (default Other & questions)
  const startDlg = (pre) => {
    const tops = topics().filter(canStart), def = pre && canStart(pre) ? pre : chatRoom();
    if (!tops.length) return toast("Threads aren't open right now.");
    const d = dlg(`<form class="cm-dc cm-sf" novalidate><h2>Start a thread</h2>
      <label class="cm-lbl" for="sttopic">Topic</label><select id="sttopic" name="topic">${tops.map(r => `<option value="${r.id}"${r.id === def.id ? " selected" : ""}>${esc(topicName(r))}</option>`).join("")}</select>
      <fieldset class="cm-types"><legend>Type</legend><label class="cm-ty"><input type="radio" name="kind" value="discussion" checked><span><b>Discussion</b><small>Open question, normal replies</small></span></label><label class="cm-ty"><input type="radio" name="kind" value="poll"><span><b>Poll</b><small>People vote, then explain why</small></span></label></fieldset>
      <label class="cm-lbl" for="stt">Question</label><input id="stt" name="title" maxlength="80" autocomplete="off"><p class="cm-nv">3 to 80 characters</p>
      <div id="stopts" hidden><p class="cm-lbl">Options</p><div id="stol"></div><button type="button" class="tl" id="stadd">${ic("plus", 16)} Add option</button><p class="cm-nv">2 to 6 options, up to 30 characters each. Options lock after the first vote.</p></div>
      <label class="cm-lbl" for="stb">First post</label><textarea id="stb" name="body" rows="3" maxlength="800"></textarea><p class="cm-nv">Up to 800 characters.</p>
      <p class="cm-err" role="alert" hidden></p><div class="cm-dr"><button class="btn btn-s" type="button" data-x>Cancel</button><button class="btn btn-p" type="submit">Start thread</button></div></form>`, "cm-modal");
    const f = $("form", d), ol = $("#stol", d), opts = $("#stopts", d), err = $(".cm-err", d);
    const addOpt = () => { const n = ol.children.length; if (n >= 6) return; ol.insertAdjacentHTML("beforeend", `<div class="cm-or"><span class="cm-opt o${n + 1}"><b>${"ABCDEF"[n]}</b></span><input maxlength="30" autocomplete="off" aria-label="Option ${"ABCDEF"[n]}"></div>`); $("#stadd", d).hidden = ol.children.length >= 6; };
    addOpt(); addOpt(); $("#stadd", d).addEventListener("click", () => { addOpt(); ol.lastElementChild.querySelector("input").focus(); });
    f.addEventListener("change", () => { opts.hidden = new FormData(f).get("kind") !== "poll"; });
    f.addEventListener("submit", async e => { e.preventDefault(); const fd = new FormData(f), kind = fd.get("kind"), title = fd.get("title").trim(), text = fd.get("body").trim(), options = kind === "poll" ? $$("input", ol).map(i => i.value.trim()).filter(Boolean) : null;
      const bad = title.length < 3 ? ERR.title_length : !text ? "Write the first post." : kind === "poll" && options.length < 2 ? ERR.option_count : ""; if (bad) { err.hidden = false; err.textContent = bad; return; }
      const btn = $('[type="submit"]', f); btn.disabled = true; err.hidden = true;
      try { const id = await q(S.sb.rpc("chat_start_thread", {p_room: +fd.get("topic"), p_title: title, p_body: text, p_kind: kind, p_options: options})); d.close(); location.hash = `#t/${id}`; }
      catch (x) { btn.disabled = false; err.hidden = false; err.textContent = errCopy(x); const k = errKey(x); if (k === "name" || k === "rules") { d.close(); entry(); } } });
    $("#stt", d).focus();
  };

  // ---------- thread view (discussion and poll) ----------
  const showThread = async id => {
    const tok = ++cur.tok; cur = {tok, room: null, view: "thread", thread: null, msgs: new Map(), replyTo: null, opts: null, filter: 0, vote: null, change: false}; setView("thread");
    if (!S.signed) { pane.innerHTML = header("threads") + `<div class="cm-body">${skeleton("rows")}</div>`; return; }
    busy();
    let t, ms, opts = [], counts = [], vote = null, room;
    try { t = await q(S.sb.from("chat_threads").select("*").eq("id", id).maybeSingle()); room = t && S.rooms.find(r => r.id === t.room_id); if (!room) t = null; cur.room = room || null;
      if (t) { ms = await q(S.sb.from("chat_messages").select("*").eq("thread_id", id).order("created_at", {ascending: true}).limit(500));
        if (t.kind === "poll") { counts = await q(S.sb.from("chat_poll_counts").select("*").eq("thread_id", id)); opts = counts.map(c => ({id: c.option_id, position: c.position, label: c.label})).sort((a, b) => a.position - b.position);
          const v = await q(S.sb.from("chat_thread_votes").select("option_id").eq("thread_id", id).eq("user_id", S.me.id).maybeSingle()); vote = v ? v.option_id : null; } } }
    catch { if (tok === cur.tok) failed(() => showThread(id)); return; }
    if (tok !== cur.tok) return;
    if (!t) { pane.innerHTML = header("thread", ["#threads", "Threads"]) + `<div class="cm-empty cm-body"><p>That thread isn't here any more.</p><a class="btn btn-s" href="#threads">Back to threads</a></div>`; return; }
    Object.assign(cur, {thread: t, opts, counts, vote, closed: !!isClosed(t)}); ms.forEach(m => cur.msgs.set(m.id, m)); await fillParents(ms); if (tok !== cur.tok) return;
    paintThread(); subscribe(room, m => { if (m.thread_id === id) { const l = $("#cmLog"); if (l && addMsg(m, l)) bump(); } }, gid => goneRow(gid, "This message was removed"));
  };
  const bump = () => { cur.thread.reply_count++; const c = $("#cmRc"); if (c) c.textContent = repl(cur.thread.reply_count); };
  const repl = n => n + (n === 1 ? " reply" : " replies");
  const modMenu = () => { const t = cur.thread; const items = [["pin", "pin", t.pinned ? "Unpin thread" : "Pin thread"], ["lock", "lock", t.locked ? "Unlock thread" : "Lock thread"], ["ban", "arch", t.archived_at ? "Reopen thread" : "Archive thread"]];
    const d = dlg(`<div class="cm-sheet-in"><span class="cm-grab" aria-hidden="true"></span><p class="cm-st">Moderator actions</p>${items.map(([i, a, l]) => `<button type="button" class="cm-mi" data-a="${a}">${ic(i, 20)}<span>${l}</span></button>`).join("")}<button type="button" class="cm-mi" data-x>${ic("x", 20)}<span>Cancel</span></button></div>`, "cm-sheet");
    $$("[data-a]", d).forEach(b => b.addEventListener("click", async () => { d.close(); const a = b.dataset.a;
      try { if (a === "pin") await q(S.sb.rpc("chat_pin_thread", {p_thread: t.id, p_pinned: !t.pinned})); if (a === "lock") await q(S.sb.rpc("chat_lock_thread", {p_thread: t.id, p_locked: !t.locked})); if (a === "arch") await q(S.sb.rpc("chat_archive_thread", {p_thread: t.id, p_archived: !t.archived_at}));
        const n = await q(S.sb.from("chat_threads").select("*").eq("id", t.id).maybeSingle()); if (n) { cur.thread = n; cur.closed = !!isClosed(n); paintThread(); } toast("Done."); } catch (e) { toast(errCopy(e)); } })); };
  const pollHTML = () => { const t = cur.thread, tot = cur.counts.reduce((a, c) => a + Number(c.votes), 0), po = [...cur.counts].sort((a, b) => a.position - b.position), picking = !cur.closed && (cur.vote == null || cur.change);
    return `<section class="cm-poll card" aria-label="Poll results"><div class="cm-bar big" aria-hidden="true">${tot ? po.filter(p => p.votes > 0).map(p => `<i class="o${p.position}" style="flex:${p.votes}"></i>`).join("") : '<i class="o0" style="flex:1"></i>'}</div>
      <ul>${po.map(p => { const pct = tot ? Math.round(p.votes / tot * 100) : 0, mine = cur.vote === p.option_id;
        return `<li><${picking ? `button type="button" data-vote="${p.option_id}"` : "div"} class="cm-po${mine ? " mine" : ""}"${picking ? ` aria-label="Vote for ${esc(p.label)}"` : ""}><span class="cm-opt o${p.position}"><b>${"ABCDEF"[p.position - 1]}</b></span><span class="lb">${esc(p.label)}</span><span class="rs">${mine ? `<span class="yv">${ic("check", 14)} Your vote</span>` : ""}<span>${pct}% · ${p.votes} ${Number(p.votes) === 1 ? "vote" : "votes"}</span></span><span class="tr" aria-hidden="true"><i class="o${p.position}" style="width:${pct}%"></i></span></${picking ? "button" : "div"}></li>`; }).join("")}</ul>
      <p class="cm-pf"><span>${tot} ${tot === 1 ? "vote" : "votes"}</span>${cur.closed ? "<span>Voting is closed.</span>" : cur.vote != null && !cur.change ? `<button type="button" class="tl" id="cmChange">Change my vote</button>` : cur.vote == null ? "<span>Pick one to vote.</span>" : `<button type="button" class="tl" id="cmChange">Keep my vote</button>`}</p></section>`; };
  const paintThread = () => {
    const room = cur.room, t = cur.thread, first = cur.msgs.get(t.first_message_id) || [...cur.msgs.values()][0]; const replies = [...cur.msgs.values()].filter(m => m !== first && !m.gone || (m.gone && m !== first));
    const shown = replies.filter(m => !cur.filter || m.option_id === cur.filter), me = S.me;
    const badges = `<span class="cm-kind ${t.kind}">${t.kind === "poll" ? "Poll" : "Discussion"}</span>${t.pinned ? `<span class="cm-kind">${ic("pin", 12)}Pinned</span>` : ""}${t.locked ? `<span class="cm-kind">${ic("lock", 12)}Locked</span>` : t.archived_at ? '<span class="cm-kind">Archived</span>' : cur.closed ? '<span class="cm-kind">Closed</span>' : ""}`;
    const filt = t.kind === "poll" ? `<div class="cm-seg cm-fl" role="group" aria-label="Show replies for">${[{id: 0, label: "All", position: 0}, ...cur.opts].map(o => `<button type="button" data-f="${o.id}" aria-pressed="${cur.filter === o.id}">${o.id ? `<span class="cm-opt o${o.position}"><b>${"ABCDEF"[o.position - 1]}</b></span>` : ""}${esc(o.label)}</button>`).join("")}</div>` : "";
    pane.innerHTML = header("thread", [`#threads?topic=${room.slug}`, "Threads"]) + `<div class="cm-tv"><div class="cm-tvh"><a class="cm-tb" href="#threads?topic=${room.slug}">${esc(topicName(room))}</a>${badges}${S.isMod ? `<button type="button" class="cm-more" id="cmTM" aria-label="Moderator actions for this thread" aria-haspopup="dialog">${ic("more", 20)}</button>` : ""}</div>
      <div class="cm-tvs"><h2>${esc(t.title)}</h2>${first ? `<div class="cm-first">${avatar(first.user_id, first.author_name)}<div><p class="cm-mh"><b>${esc(first.author_name)}</b>${first.author_tag ? `<span class="tg">· ${esc(first.author_tag)}</span>` : ""}${unTag(first.user_id)}${msgBadges(first)}<span class="tg">Started ${dayLabel(t.created_at).toLowerCase()}</span></p><p class="cm-tx">${body(first.body)}</p></div></div>` : ""}
      ${t.kind === "poll" ? pollHTML() : ""}<div class="cm-rh">${filt || '<span class="cm-div"></span>'}<span id="cmRc" class="tg">${repl(t.reply_count)}</span></div></div>
      <div class="cm-log" id="cmLog" role="log" aria-label="Replies" tabindex="0">${shown.length ? withDays(shown) : `<div class="cm-none cm-empty"><p>${cur.filter ? "No replies for this option yet." : "No replies yet."}</p></div>`}</div><div id="cmComp"></div></div>`;
    const logEl = $("#cmLog"), voted = t.kind !== "poll" || cur.vote != null;
    $("#cmComp").innerHTML = !voted && !cur.closed && canPostBase() ? `<div class="cm-comp"><p class="cm-block">${ic("lock", 18)}<span>Vote first, then tell us why.</span></p></div>` : composerHTML(t.kind === "poll" ? "Explain your vote" : "Reply to this thread", t.kind === "poll" ? "Vote, then explain. Keep it about the idea, not the person." : "");
    bindComposer(logEl, {onSent: bump});
    logEl.addEventListener("click", e => { const mb = e.target.closest("[data-menu]"); if (mb) return menu(+mb.dataset.menu); const j = e.target.closest("[data-jump]"); if (j) { const r = $(`#m${j.dataset.jump}`); if (r) { r.scrollIntoView({block: "center", behavior: "smooth"}); } } });
    $$("[data-f]").forEach(b => b.addEventListener("click", () => { cur.filter = +b.dataset.f; paintThread(); const n = $(`[data-f="${cur.filter}"]`); if (n) n.focus(); }));
    $$("[data-vote]").forEach(b => b.addEventListener("click", async () => { const o = +b.dataset.vote; if (o === cur.vote) { cur.change = false; return paintThread(); }
      try { await q(S.sb.rpc("chat_vote", {p_thread: t.id, p_option: o})); cur.vote = o; cur.change = false; cur.counts = await q(S.sb.from("chat_poll_counts").select("*").eq("thread_id", t.id)); paintThread(); toast("Vote saved. Now tell us why."); } catch (x) { toast(errCopy(x)); } }));
    const ch = $("#cmChange"); if (ch) ch.addEventListener("click", () => { cur.change = !cur.change; paintThread(); const n = $("#cmChange") || $("[data-vote]"); if (n) n.focus(); });
    const tm = $("#cmTM"); if (tm) tm.addEventListener("click", modMenu);
    logEl.scrollTop = logEl.scrollHeight;
  };
  const canPostBase = () => S.signed && S.prof && S.prof.display_name && S.prof.chat_rules_at && !cur.room.locked && !(cur.room.read_only && !S.isMod);

  // ---------- first entry: name, then rules (the age step is the age gate that already ran) ----------
  function entry(step = "name") {
    if (!S.signed) return; const u = S.clerk && S.clerk.user || {}; const guess = ((u.firstName || "").trim() + " " + (u.lastName || "").trim().charAt(0)).trim();
    const hasName = S.prof && S.prof.display_name;
    const frame = (n, inner) => `<div class="cm-ec"><div class="cm-ehd">${n === 2 ? '<button type="button" class="cm-eb" data-back>' + ic("back", 18) + " Back</button>" : '<button type="button" class="cm-eb" data-back>' + ic("back", 18) + " Back</button>"}<span>Step ${n} of 3</span></div>
      <ol class="cm-steps" aria-label="Steps"><li class="done">${ic("check", 14)}<span>Age</span></li><li class="${n === 2 ? "cur" : "done"}">${n === 2 ? "<b>2</b>" : ic("check", 14)}<span>Your name</span></li><li class="${n === 3 ? "cur" : ""}"><b>3</b><span>Guidelines</span></li></ol>${inner}</div>`;
    const d = dlg("", "cm-entry"), paint = s => { d.innerHTML = s === "name" ? frame(2, `<form novalidate><h2>Pick your name</h2><p class="cm-sub">Other members see this name with a 4-digit tag.</p><label class="cm-lbl" for="enm">Display name</label><input id="enm" maxlength="30" autocomplete="given-name" value="${esc(hasName || guess)}">
        <p class="cm-prev" id="eprev" aria-live="polite"></p><p class="cm-nv">First name and last initial is best. You can change it later in Settings.</p><p class="cm-err" role="alert" hidden></p><div class="cm-dr"><button class="btn btn-p wide" type="submit">Continue</button></div></form>`) :
        frame(3, `<form novalidate><h2>Community Guidelines</h2><p class="cm-sub">Five rules keep chat safe and useful.</p><ul class="cm-gl">${[["Be kind", "disagree with ideas, not people."], ["No personal info", "yours or anyone else's."], ["Keep it here", "no contact details or chat-app links."], ["No selling", "no ads, promo codes or asking for money."], ["Report, don't argue", "use the … menu on a message."]].map(([b, t]) => `<li>${ic("check", 16)}<span><b>${b}</b>: ${t}</span></li>`).join("")}</ul>
        <a class="cm-gll" href="/legal/community/" target="_blank" rel="noopener">Read the full Community Guidelines${ic("ext", 16)}<span class="sr"> (opens in a new tab)</span></a>
        <label class="cm-agree"><input type="checkbox" id="eag"><span>I agree to the <a href="/legal/community/" target="_blank" rel="noopener">Community Guidelines</a> and the <a href="/legal/terms/" target="_blank" rel="noopener">Terms</a></span></label><p class="cm-err" role="alert" hidden></p><div class="cm-dr col"><button class="btn btn-p" type="submit" disabled>I agree</button><button class="tl" type="button" data-x>Not now</button></div></form>`);
      $$("[data-x]", d).forEach(b => b.addEventListener("click", () => { S.skipEntry = true; d.close(); }));
      const back = $("[data-back]", d); back.addEventListener("click", () => { if (s === "rules") paint("name"); else { S.skipEntry = true; d.close(); } });
      const f = $("form", d), err = $(".cm-err", d), btn = $('[type="submit"]', f), fail = x => { btn.disabled = false; err.hidden = false; err.textContent = errCopy(x); };
      if (s === "name") { const inp = $("#enm", d), pv = $("#eprev", d), up = () => { const v = inp.value.trim(); pv.innerHTML = v ? `${avatar(v, v)}<span>Other members see this name<br><b>${esc(v)}</b> · and a 4-digit tag</span>` : ""; }; inp.addEventListener("input", up); up(); inp.focus();
        f.addEventListener("submit", async e => { e.preventDefault(); btn.disabled = true; err.hidden = true;
          try { await q(S.sb.rpc("chat_set_name", {p_name: inp.value})); S.prof = await loadProfile(); if (S.prof.chat_rules_at) { d.close(); refresh(); } else paint("rules"); } catch (x) { fail(x); } }); }
      else { const ag = $("#eag", d); ag.addEventListener("change", () => { btn.disabled = !ag.checked; }); ag.focus();
        f.addEventListener("submit", async e => { e.preventDefault(); if (!ag.checked) return; btn.disabled = true;
          try { await q(S.sb.rpc("chat_accept_rules")); S.prof = await loadProfile(); d.close(); toast("You're in. Say hi."); refresh(); } catch (x) { fail(x); } }); } };
    paint(step === "rules" || (hasName && !S.prof.chat_rules_at) ? "rules" : "name");
  }
  const refresh = () => route(true);

  // ---------- settings ----------
  const showSettings = () => {
    cur = {tok: ++cur.tok, room: null, view: "settings", thread: null, msgs: new Map()}; unsub(); setView("settings");
    if (!S.signed) { pane.innerHTML = header("settings", ["#chat", "Back to chat"]) + `<div class="cm-body"><div class="cm-empty"><p>Log in to change your chat settings.</p><a class="btn btn-p" href="/sign-in/">Sign in</a></div></div>`; return; }
    const p = S.prof || {};
    pane.innerHTML = header("settings", ["#chat", "Back to chat"]) + `<div class="cm-body cm-set"><h1 class="cm-sh">Chat settings</h1>
      <section class="card"><h2>Chat name</h2><form class="cm-sec" id="cmName" novalidate><label class="cm-lbl" for="snm">Display name</label><div class="cm-nr"><input id="snm" maxlength="30" value="${esc(p.display_name || "")}" autocomplete="off"><span class="tg">${p.name_tag ? "· " + esc(p.name_tag) : ""}</span></div>
        <p class="cm-nv">Others see this name with your 4-digit tag. You can change it 3 times a day.</p><p class="cm-err" role="alert" hidden></p><button class="btn btn-p" type="submit">Save name</button></form></section>
      <section class="card"><h2>Chat</h2><a class="cm-sr link" href="/app/account/#profile"><span><b>Public profile</b><small>Photo, @username and bio.</small></span>${ic("chevr", 18)}</a><button type="button" class="cm-sr link" id="cmRules"><span><b>Community Guidelines</b><small>Read what you agreed to.</small></span>${ic("chevr", 18)}</button></section>
      <section class="card"><h2>Account</h2><div class="cm-sr"><span><b>Plan</b><small>Free plan</small></span><a class="tl" href="/app/account/#plan">Upgrade</a></div><button type="button" class="cm-sr link" id="cmOut"><span><b>Sign out</b></span></button></section></div>`;
    const f = $("#cmName"), err = $(".cm-err", f); f.addEventListener("submit", async e => { e.preventDefault(); err.hidden = true;
      try { await q(S.sb.rpc("chat_set_name", {p_name: $("#snm").value})); S.prof = await loadProfile(); toast("Name saved."); showSettings(); } catch (x) { err.hidden = false; err.textContent = errCopy(x); } });
    $("#cmRules").addEventListener("click", () => dlg(`<div class="cm-dc"><h2>Community Guidelines</h2><ul class="cm-rules"><li><b>Be kind</b><span>Disagree with ideas, not people.</span></li><li><b>No personal info</b><span>No school, address, phone or socials. Yours or anyone else's.</span></li><li><b>Keep it here</b><span>No contact details, no chat-app or social profile links.</span></li><li><b>No selling</b><span>No ads, promo codes or asking for money.</span></li><li><b>Report, don't argue</b><span>Use the … menu on a message. We look at every report.</span></li></ul><a class="cm-gll" href="/legal/community/" target="_blank" rel="noopener">Read the full Community Guidelines${ic("ext", 16)}<span class="sr"> (opens in a new tab)</span></a><div class="cm-dr"><button class="btn btn-p" type="button" data-x>Close</button></div></div>`, "cm-small"));
    $("#cmOut").addEventListener("click", () => window.LVAuth && LVAuth.signOut());
  };

  // ---------- router ----------
  const route = () => {
    const r = parse();
    if (r.view === "settings") return showSettings();
    if (r.view === "threads") return showThreads(r.topic);
    if (r.view === "thread") return showThread(r.id);
    return showChat(r.about, r.slug);
  };
  const loadProfile = async () => q(S.sb.from("profiles").select("display_name,name_tag,username,chat_rules_at,age_range").eq("user_id", S.me.id).maybeSingle());
  const AGE = {"13 to 15": "13-15", "16 to 17": "16-17", "18 to 20": "18-20", "21 or older": "21+"};

  const startSigned = async clerk => {
    for (let i = 0; i < 60 && !window.LVSync; i++) { if (i === 0 && !document.querySelector('script[src="/assets/supabase.js"]')) { const s = document.createElement("script"); s.src = "/assets/supabase.js"; document.head.appendChild(s); } await new Promise(r => setTimeout(r, 100)); }
    S.clerk = clerk; S.me = {id: clerk.user.id}; S.sb = await LVSync.make(clerk);
    S.prof = await loadProfile();
    if (!S.prof) { let age = null; try { age = JSON.parse(localStorage.getItem("lv-age")); } catch {} const em = clerk.user.primaryEmailAddress && clerk.user.primaryEmailAddress.emailAddress;
      if (age === "Under 13" || !AGE[age]) throw new Error("no age"); await q(S.sb.from("profiles").upsert({email: em, age_range: AGE[age]})); S.prof = await loadProfile(); }
    const [cats, rooms, mods, known] = await Promise.all([q(S.sb.from("chat_room_categories").select("*")), q(S.sb.from("chat_rooms").select("*")), q(S.sb.from("chat_moderators").select("user_id,role")),
      q(S.sb.from("chat_known_domains").select("domain"))]);
    S.cats = cats; S.rooms = rooms; S.mods = new Set(mods.map(m => m.user_id)); S.isMod = S.mods.has(S.me.id); S.known = new Set(known.map(k => k.domain)); S.signed = true;
  };

  const fit = () => { const t = document.querySelector(".tabs"), tb = t && getComputedStyle(t).display !== "none" ? t.offsetHeight : 0; /* the phone tab bar is position:fixed, so offsetParent is null */ root.style.height = Math.max(420, (innerHeight - root.getBoundingClientRect().top) / (window.lvZ || 1) - tb) + "px"; };   // window px -> CSS px under the auto zoom
  const boot = async () => {
    fit(); addEventListener("resize", fit); addEventListener("load", fit); const pv = document.getElementById("prevbar"); if (pv && window.ResizeObserver) new ResizeObserver(fit).observe(pv);
    window.addEventListener("hashchange", () => route());
    let clerk = null; if (window.LVAuth && LVAuth.live) { try { clerk = await LVAuth.load(); } catch {} }
    if (clerk && clerk.user) { try { await startSigned(clerk); } catch (e) { S.signed = false; S.rooms = []; pane.innerHTML = `<div class="cm-empty"><p>We couldn't open the community right now. Check your connection and try again.</p><button class="btn btn-s" type="button" id="cmRetry">Try again</button></div>`; setView("chan"); $("#cmRetry").addEventListener("click", () => location.reload()); return; } }
    S.ready = true;
    route(); if (S.signed && !S.skipEntry && (!S.prof.display_name || !S.prof.chat_rules_at)) entry();
  };
  boot();
})();
