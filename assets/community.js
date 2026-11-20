/* LaunchVault community chat (/app/community/). Front end only: the database, filters and moderation are server side (db/supabase/migrations).
   Reads and writes go through the Supabase client with the Clerk token (assets/supabase.js make()). Nothing here invents messages, names or activity:
   signed out you see the channel names and blurred skeleton bars, never fake posts. Calm by design: no typing dots, read receipts, reactions or points.
   Routes are hashes on one page: #slug  #slug/threads  #slug/t/<id>  #settings  (#slug?about=Name prefills "About Name: "). */
(() => {
  "use strict";
  if (!window.LVGate || !LVGate.ok) return;   // the age gate runs first; nothing is stored or fetched before it passes
  const root = document.getElementById("cm"); if (!root) return;
  const $ = (s, r = root) => r.querySelector(s), $$ = (s, r = root) => [...r.querySelectorAll(s)];
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
  const wide = () => matchMedia("(min-width:721px)").matches;
  const list = $("#cmList"), pane = $("#cmPane");

  // ---------- copy for every server error code (chat:xxx) ----------
  const DEFAULT = "That didn't send. Try again in a moment.";
  const ERR = {
    slow_down: "Slow down a little. Try again in a few seconds.", slow_mode: "This channel is in slow mode. Try again in a moment.",
    filter_contact: "Contact details and chat-app links aren't allowed. Keep the conversation here.", filter_link: "Links aren't allowed in this message.",
    filter_link_unknown: "That site isn't on our list of known sites. Leave the link out, or try another.", filter_link_shortener: "Shortened links aren't allowed. Paste the full link.",
    filter_link_new_account: "New members can post links after a day.", filter_link_count: "Two links per message, max.", filter_link_blocked: "That site isn't allowed.",
    filter_link_scheme: "That link isn't allowed.", filter_link_ip: "That link isn't allowed.", filter_link_lookalike: "That link isn't allowed.",
    filter_term: "That message can't be sent. Please reword it.", link_slow_down: "You've shared a few links already. Try again later.",
    read_only: "Only moderators can post in this channel.", banned: "You can't post right now. You can still read everything.",
    name: "Choose a chat name first.", rules: "Read and agree to the chat rules first.", vote_first: "Vote first, then reply.", thread_closed: "This thread is closed. You can still read it.",
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

  // ---------- the channel list (the same for everyone). Signed out, the database needs a login, so the names come from this copy of the seed ----------
  const SEED = {cats: [["Start here", [["welcome", "Start here: the rules and how this place works.", 1], ["introductions", "Say hi: what you are into and what you want to build."]]],
    ["Stories", [["breakdowns", "Talk about any story breakdown."], ["what-im-trying", "The move you are copying from a story, and how it went."]]],
    ["Build", [["apps-and-saas", "Building an app or a tool people pay for."], ["online-stores", "Selling things online."], ["local-shops-and-restaurants", "Helping or starting a local business."], ["services-and-freelancing", "Doing work for clients."]]],
    ["Community", [["general", "Anything else."], ["wins", "First sale, first user, first anything."], ["ask-for-help", "Stuck? Ask here."]]]]};
  const S = {signed: false, ready: false, me: null, sb: null, clerk: null, prof: null, mods: new Set(), isMod: false, cats: [], rooms: [], unread: new Set(), muted: new Set(), known: new Set(), collapsed: new Set(), skipEntry: false, ch: null};
  const seedRooms = () => { S.cats = SEED.cats.map(([t], i) => ({id: i + 1, title: t, position: i + 1}));
    S.rooms = SEED.cats.flatMap(([, rs], ci) => rs.map(([slug, description, ro], i) => ({id: "s-" + slug, slug, title: slug, description, category_id: ci + 1, position: i, read_only: !!ro, allow_threads: !ro, locked: false, pinned_message_id: null}))); };
  seedRooms();

  // ---------- small helpers ----------
  const I = {
    hash: "", back: '<path d="M15 6l-6 6 6 6"/>', chev: '<path d="M6 9l6 6 6-6"/>', chevr: '<path d="M9 6l6 6-6 6"/>', lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 21h4"/>', belloff: '<path d="M6 16V11a6 6 0 0 1 1-3.3M18 11v5l1.5 2H8"/><path d="M10 21h4M4 4l16 16"/>',
    more: '<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>',
    reply: '<path d="M9 7L4 12l5 5"/><path d="M4 12h9a6 6 0 0 1 6 6v1"/>', flag: '<path d="M6 21V4M6 5h11l-2 4 2 4H6"/>', trash: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
    ban: '<circle cx="12" cy="12" r="8"/><path d="M6.5 6.5l11 11"/>', pin: '<path d="M9 4h6l-1 6 3 3H7l3-3zM12 13v7"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', plus: '<path d="M12 5v14M5 12h14"/>',
    gear: '<path d="M4 7h9M19 7h1M4 17h1M11 17h9"/><circle cx="16" cy="7" r="2.5"/><circle cx="8" cy="17" r="2.5"/>', check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    warn: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.5"/>', ext: '<path d="M7 17L17 7M9 7h8v8"/>', msg: '<path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4.5 3.5V16H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/>'
  };
  const ic = (k, w = 18) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[k]}</svg>`;
  const time = d => new Date(d).toLocaleTimeString("en-US", {hour: "numeric", minute: "2-digit"}).replace(/\s?(AM|PM)/, (_, a) => " " + a.toLowerCase());
  const MON = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
  const dayKey = d => { const x = new Date(d); return x.getFullYear() * 400 + x.getMonth() * 32 + x.getDate(); };
  const dayLabel = d => { const x = new Date(d), n = new Date(); if (dayKey(d) === dayKey(n)) return "Today"; const y = new Date(n); y.setDate(n.getDate() - 1); if (dayKey(d) === dayKey(y)) return "Yesterday"; return MON[x.getMonth()] + " " + x.getDate(); };
  const ago = d => { const s = Math.max(0, (Date.now() - new Date(d)) / 1000); return s < 60 ? "just now" : s < 3600 ? Math.floor(s / 60) + "m ago" : s < 86400 ? Math.floor(s / 3600) + "h ago" : Math.floor(s / 86400) + "d ago"; };
  const AV = [["#EDE9FE", "#5B21B6"], ["#E5E7EB", "#1F2937"], ["#DBEAFE", "#1E40AF"], ["#DCFCE7", "#166534"], ["#FCE7F3", "#9D174D"], ["#E0F2FE", "#075985"]];
  const avatar = (key, name) => { let h = 0; for (const c of String(key || name)) h = (h * 31 + c.charCodeAt(0)) >>> 0; const [bg, fg] = AV[h % AV.length];
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
    return hostOf(url) ? `<button type="button" class="cm-link" data-url="${esc(url)}">${esc(url)}</button>${tail}` : m; });
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
  const parse = () => { const [p, qs] = location.hash.slice(1).split("?"); const parts = p.split("/").filter(Boolean); const about = new URLSearchParams(qs || "").get("about") || "";
    if (parts[0] === "settings") return {view: "settings"};
    if (!parts[0]) return {view: "list"};
    return {slug: parts[0], view: parts[1] === "t" && /^\d+$/.test(parts[2] || "") ? "thread" : parts[1] === "threads" ? "threads" : "chat", id: +parts[2] || 0, about}; };

  // ---------- channel list ----------
  const dot = r => S.signed && S.unread.has(r.id) && !S.muted.has(r.id);
  const paintList = () => {
    const r = parse(), cats = [...S.cats].sort((a, b) => a.position - b.position);
    list.innerHTML = `<div class="cm-lh2"><h2>Channels</h2>${S.signed ? `<button type="button" class="tl" id="cmAllRead">Mark all as read</button><a class="cm-gear" href="#settings" aria-label="Settings">${ic("gear", 20)}</a>` : ""}</div>` +
      cats.map(c => { const open = !S.collapsed.has(c.id), rs = S.rooms.filter(x => x.category_id === c.id).sort((a, b) => a.position - b.position);
        return `<div class="cm-cat"><button type="button" class="cm-ch" aria-expanded="${open}" data-cat="${c.id}">${ic(open ? "chev" : "chevr", 14)}<span>${esc(c.title)}</span></button>` +
          (open ? rs.map(x => `<a class="cm-r${r.slug === x.slug ? " on" : ""}${dot(x) ? " unread" : ""}" href="#${x.slug}"${r.slug === x.slug ? ' aria-current="page"' : ""}><span class="hs">#</span><span class="nm">${esc(x.title)}</span>` +
            (S.muted.has(x.id) ? `<span class="ri" title="Muted">${ic("belloff", 16)}</span><span class="sr">Muted</span>` : "") + (x.read_only ? `<span class="ri" title="Only moderators post here">${ic("lock", 16)}</span><span class="sr">Read only</span>` : "") +
            (dot(x) ? '<i class="dt" role="img" aria-label="New messages"></i>' : "") + `<span class="ri ch">${ic("chevr", 16)}</span></a>`).join("") : "") + "</div>"; }).join("");
    $$("[data-cat]", list).forEach(b => b.addEventListener("click", () => { const id = +b.dataset.cat; S.collapsed.has(id) ? S.collapsed.delete(id) : S.collapsed.add(id); paintList(); const n = $(`[data-cat="${id}"]`, list); if (n) n.focus(); }));
    const ar = $("#cmAllRead", list); if (ar) ar.addEventListener("click", async () => { try { await q(S.sb.rpc("chat_mark_all_read")); S.unread.clear(); paintList(); toast("All channels marked as read."); } catch (e) { toast(errCopy(e)); } });
  };

  // ---------- pane pieces ----------
  const header = (room, view, extra = "", thread = false) => {
    const tabs = room.allow_threads ? `<div class="cm-tabs" role="tablist" aria-label="Channel view"><a role="tab" href="#${room.slug}" aria-selected="${view === "chat"}">Chat</a><a role="tab" href="#${room.slug}/threads" aria-selected="${view !== "chat"}">Threads</a></div>` : "";
    const mute = S.signed ? `<button type="button" class="cm-mute btn btn-s" id="cmMute" aria-pressed="${S.muted.has(room.id)}">${ic(S.muted.has(room.id) ? "belloff" : "bell", 18)}<span>${S.muted.has(room.id) ? "Unmute" : "Mute"}</span></button>` : `<a class="btn btn-s" href="/welcome/">Sign in</a>`;
    return `<header class="cm-h${thread ? " th" : ""}"><a class="cm-back" href="${thread ? "#" + room.slug + "/threads" : "#"}" aria-label="${thread ? "Back to threads" : "Back to channels"}">${ic("back", 22)}</a><a class="cm-t" href="#" aria-label="Channel ${esc(room.title)}. Open the channel list"><h1><span class="hs">#</span> ${esc(room.title)}</h1><p>${esc(room.description)}</p></a>${tabs}${mute}${extra}</header>`;
  };
  const bindHeader = room => { const m = $("#cmMute"); if (m) m.addEventListener("click", async () => { const on = S.muted.has(room.id);
    try { on ? await q(S.sb.from("chat_room_mutes").delete().eq("room_id", room.id)) : await q(S.sb.from("chat_room_mutes").insert({room_id: room.id}));
      on ? S.muted.delete(room.id) : S.muted.add(room.id); paintList(); m.setAttribute("aria-pressed", String(!on)); m.innerHTML = `${ic(on ? "bell" : "belloff", 18)}<span>${on ? "Mute" : "Unmute"}</span>`; toast(on ? "Unmuted. New messages light the dot again." : "Muted. No dot for new messages."); } catch (e) { toast(errCopy(e)); } }); };
  const skeleton = (kind, room) => `<div class="cm-sk ${kind}" aria-hidden="true">${Array.from({length: kind === "cards" ? 6 : 7}, (_, i) => kind === "cards" ? `<div class="sk-card"><i class="b1"></i><i class="b2"></i><i class="b3"></i></div>` : `<div class="sk-row"><i class="sk-av"></i><span><i class="b1" style="width:${[34, 22, 40, 28, 36, 24, 30][i]}%"></i><i class="b2" style="width:${[78, 62, 88, 54, 70, 82, 60][i]}%"></i></span></div>`).join("")}</div>
    <div class="cm-join card"><h2>Log in to join the conversation</h2><p>Members read every ${kind === "cards" ? "thread" : "message"} and reply. Every story stays free to read without an account.</p><div class="cm-dr"><a class="btn btn-p" href="/welcome/#signup">Sign up</a><a class="btn btn-s" href="/welcome/">Sign in</a></div></div>`;
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
    return `<article class="cm-m" data-id="${m.id}" id="m${m.id}">${avatar(m.user_id, m.author_name)}<div class="cm-mb">${rp}<p class="cm-mh"><b>${esc(m.author_name)}</b>${m.author_tag ? `<span class="tg">· ${esc(m.author_tag)}</span>` : ""}${msgBadges(m)}${optBadge(m)}<time datetime="${esc(m.created_at)}">${time(m.created_at)}</time></p><p class="cm-tx">${body(m.body)}</p></div>${S.signed && !sys ? `<button type="button" class="cm-more" data-menu="${m.id}" aria-label="Options for the message from ${esc(m.author_name)}" aria-haspopup="dialog">${ic("more", 20)}</button>` : ""}</article>`;
  };
  const withDays = arr => { let last = -1; return arr.map(m => { const k = dayKey(m.created_at), sep = k !== last ? `<div class="cm-day"><span>${dayLabel(m.created_at)}</span></div>` : ""; last = k; return sep + msgHTML(m); }).join(""); };
  const nearBottom = el => el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  const addMsg = (m, logEl) => {
    if (cur.msgs.has(m.id)) return false; cur.msgs.set(m.id, m); const stick = nearBottom(logEl);
    const lastDay = [...logEl.querySelectorAll("time")].pop(); const sep = !lastDay || dayKey(lastDay.getAttribute("datetime")) !== dayKey(m.created_at) ? `<div class="cm-day"><span>${dayLabel(m.created_at)}</span></div>` : "";
    const e = logEl.querySelector(".cm-none"); if (e) e.remove();
    logEl.insertAdjacentHTML("beforeend", sep + msgHTML(m)); if (stick || (S.me && m.user_id === S.me.id)) logEl.scrollTop = logEl.scrollHeight; return true;
  };
  const goneRow = (id, text) => { const old = cur.msgs.get(id); if (!old) return; const m = {...old, gone: text}; cur.msgs.set(id, m); const row = $(`[data-id="${id}"]`); if (row) row.outerHTML = msgHTML(m); };
  const fillParents = async arr => { const need = [...new Set(arr.map(m => m.reply_to).filter(id => id && !cur.msgs.has(id) && !arr.some(x => x.id === id)))]; if (!need.length) return;
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
    if (!S.prof || !S.prof.display_name || !S.prof.chat_rules_at) return `Choose a chat name and agree to the rules to post. <button type="button" class="tl" data-entry>Get started</button>`;
    return "";
  };
  const composerHTML = (label, help) => { const b = composerBlock(); if (b) return `<div class="cm-comp"><p class="cm-block">${ic("lock", 18)}<span>${b}</span></p></div>`;
    return `<form class="cm-comp" novalidate><p class="cm-reply" hidden></p><div class="cm-box"><textarea rows="1" maxlength="800" placeholder="${esc(label)}" aria-label="${esc(label)}" enterkeyhint="send"></textarea><button class="btn btn-p" type="submit">Send</button></div>
      <p class="cm-hint"><span>${esc(help || "No contact details or chat-app links.")}</span><span class="cm-ct" aria-live="polite"></span></p><p class="cm-err" role="alert" hidden></p></form>`; };
  const setReply = m => { cur.replyTo = m; const r = $(".cm-reply"); if (!r) return; r.hidden = !m; r.innerHTML = m ? `${ic("reply", 16)}<span>Replying to ${esc(m.author_name)}</span><button type="button" class="cm-x" aria-label="Cancel reply">${ic("x", 16)}</button>` : "";
    const x = $(".cm-x", r); if (x) x.addEventListener("click", () => setReply(null)); const ta = $(".cm-comp textarea"); if (ta) ta.focus(); };
  const bindComposer = (logEl, extra = {}) => {
    const eb = $("[data-entry]"); if (eb) eb.addEventListener("click", () => entry());
    const f = $("form.cm-comp"); if (!f) return; const ta = $("textarea", f), ct = $(".cm-ct", f), err = $(".cm-err", f), btn = $('[type="submit"]', f);
    if (extra.about && !ta.value) { ta.value = "About " + extra.about + ": "; }
    const grow = () => { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 150) + "px"; const n = ta.value.length; ct.textContent = n >= 700 ? n + " / 800" : ""; ct.classList.toggle("max", n >= 780); };
    ta.addEventListener("input", grow); grow();
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
  const showChat = async (room, about) => {
    const tok = ++cur.tok; cur = {tok, room, view: "chat", thread: null, msgs: new Map(), replyTo: null}; setView("chan");
    if (!S.signed) { pane.innerHTML = header(room, "chat") + `<div class="cm-body">${skeleton("rows", room)}</div>`; return; }
    pane.innerHTML = header(room, "chat") + `<button type="button" class="cm-pin" id="cmPin" hidden></button><div class="cm-log" id="cmLog" role="log" aria-label="Messages in #${esc(room.title)}" tabindex="0"><p class="cm-load" role="status">Loading messages…</p></div><div id="cmComp"></div>`; bindHeader(room);
    let rows; try { rows = (await q(S.sb.from("chat_messages").select("*").eq("room_id", room.id).is("thread_id", null).order("created_at", {ascending: false}).limit(50))).reverse(); } catch { if (tok === cur.tok) { $("#cmLog").innerHTML = `<div class="cm-empty"><p>We couldn't load the messages.</p><button class="btn btn-s" type="button" id="cmRetry">Try again</button></div>`; $("#cmRetry").addEventListener("click", () => showChat(room, about)); } return; }
    if (tok !== cur.tok) return;
    rows.forEach(m => cur.msgs.set(m.id, m)); await fillParents(rows); if (tok !== cur.tok) return;
    const logEl = $("#cmLog"); logEl.innerHTML = rows.length ? withDays(rows) : `<div class="cm-none cm-empty">${ic("msg", 28)}<p>No messages yet. Say hi.</p></div>`; logEl.scrollTop = logEl.scrollHeight;
    $("#cmComp").innerHTML = composerHTML("Message #" + room.title); bindComposer(logEl, {about}); paintPin();
    logEl.addEventListener("click", e => { const mb = e.target.closest("[data-menu]"); if (mb) return menu(+mb.dataset.menu); const j = e.target.closest("[data-jump]"); if (j) { const r = $(`#m${j.dataset.jump}`); if (r) { r.scrollIntoView({block: "center", behavior: "smooth"}); r.classList.add("flash"); setTimeout(() => r.classList.remove("flash"), 1600); } } });
    subscribe(room, m => { if (!m.thread_id) addMsg(m, logEl); }, id => goneRow(id, "This message was removed"));
    S.sb.rpc("chat_mark_read", {p_room: room.id}).then(() => { S.unread.delete(room.id); paintList(); }, () => {});
  };
  const subscribe = (room, onMsg, onGone) => { unsub(); const sb = S.sb; if (!sb || !sb.channel) return; const f = "room_id=eq." + room.id;
    S.ch = sb.channel("lv-room-" + room.id).on("postgres_changes", {event: "INSERT", schema: "public", table: "chat_messages", filter: f}, p => { if (cur.room && cur.room.id === room.id) onMsg(p.new); })
      .on("postgres_changes", {event: "INSERT", schema: "public", table: "chat_removals", filter: f}, p => { if (cur.room && cur.room.id === room.id) onGone(p.new.message_id); }).subscribe(); };

  // ---------- threads feed ----------
  const palette = ["#2563EB", "#047857", "#6D28D9", "#C2410C", "#0F766E", "#475569"];
  const isClosed = t => t.locked || t.hidden || t.archived_at || new Date(t.last_reply_at) < Date.now() - 7 * 864e5;
  const showThreads = async (room, order = cur.order || "active") => {
    const tok = ++cur.tok; cur = {tok, room, view: "threads", thread: null, msgs: new Map(), order}; setView("chan");
    if (!S.signed) { pane.innerHTML = header(room, "threads") + `<div class="cm-body">${skeleton("cards", room)}</div>`; return; }
    pane.innerHTML = header(room, "threads") + `<div class="cm-body"><div class="cm-tools"><div class="cm-seg" role="group" aria-label="Order"><button type="button" aria-pressed="${order === "active"}" data-o="active">Active</button><button type="button" aria-pressed="${order === "new"}" data-o="new">New</button></div>${room.allow_threads && !room.locked && !(room.read_only && !S.isMod) ? `<button type="button" class="btn btn-p" id="cmNew">Start a thread</button>` : ""}</div><div id="cmFeed"><p class="cm-load" role="status">Loading threads…</p></div></div>`; bindHeader(room);
    $$("[data-o]").forEach(b => b.addEventListener("click", () => showThreads(room, b.dataset.o)));
    const nb = $("#cmNew"); if (nb) nb.addEventListener("click", () => startDlg(room));
    let th, ms, pc;
    try { th = await q(S.sb.from("chat_threads").select("*").eq("room_id", room.id).order(order === "new" ? "created_at" : "last_reply_at", {ascending: false}).limit(40));   // ponytail: 40 newest; add paging if a channel outgrows it
      const ids = th.map(t => t.id); ms = ids.length ? await q(S.sb.from("chat_messages").select("id,thread_id,author_name,body,created_at").in("thread_id", ids).order("created_at", {ascending: true}).limit(1000)) : [];
      pc = ids.length ? await q(S.sb.from("chat_poll_counts").select("*").in("thread_id", ids)) : []; } catch { if (tok === cur.tok) { $("#cmFeed").innerHTML = `<div class="cm-empty"><p>We couldn't load the threads.</p><button class="btn btn-s" type="button" id="cmRetry">Try again</button></div>`; $("#cmRetry").addEventListener("click", () => showThreads(room, order)); } return; }
    if (tok !== cur.tok) return;
    if (!S.isMod) th = th.filter(t => !t.archived_at);
    if (order === "active") th.sort((a, b) => (b.pinned - a.pinned) || (new Date(b.last_reply_at) - new Date(a.last_reply_at)));
    const by = {}; ms.forEach(m => (by[m.thread_id] = by[m.thread_id] || []).push(m));
    $("#cmFeed").innerHTML = th.length ? `<div class="cm-cards">${th.map(t => card(t, by[t.id] || [], pc.filter(p => p.thread_id === t.id))).join("")}</div>` : `<div class="cm-empty">${ic("msg", 28)}<p>No threads yet. Start one.</p></div>`;
    subscribe(room, m => { if (m.thread_id && cur.view === "threads") { clearTimeout(cur.rt); cur.rt = setTimeout(() => showThreads(room, order), 600); } }, () => {});
  };
  const card = (t, ms, pc) => {
    const first = ms.find(m => m.id === t.first_message_id) || ms[0], last = ms.length > 1 ? ms[ms.length - 1] : null, closed = isClosed(t);
    const tot = pc.reduce((a, p) => a + Number(p.votes), 0), po = [...pc].sort((a, b) => a.position - b.position);
    const bar = t.kind === "poll" ? `<div class="cm-pm"><p class="cm-chips">${po.map(p => `<span class="cm-opt o${p.position}"><b>${"ABCDEF"[p.position - 1]}</b>${tot ? Math.round(p.votes / tot * 100) + "%" : "0%"}</span>`).join("")}</p><div class="cm-bar" aria-hidden="true">${tot ? po.filter(p => p.votes > 0).map(p => `<i class="o${p.position}" style="flex:${p.votes}"></i>`).join("") : '<i class="o0" style="flex:1"></i>'}</div></div>` : "";
    return `<a class="cm-card" href="#${cur.room.slug}/t/${t.id}"><span class="cm-badges"><span class="cm-kind ${t.kind}">${t.kind === "poll" ? "Poll" : "Discussion"}</span>${t.pinned ? `<span class="cm-kind">${ic("pin", 12)}Pinned</span>` : ""}${t.locked ? `<span class="cm-kind">${ic("lock", 12)}Locked</span>` : t.archived_at ? '<span class="cm-kind">Archived</span>' : closed ? '<span class="cm-kind">Closed</span>' : ""}</span>
      <h3>${esc(t.title)}</h3><p class="pv">${esc(first ? first.body : "")}</p>${bar}<p class="lr">${last ? `${ic("reply", 14)}<span><b>${esc(last.author_name)}:</b> ${esc(last.body)}</span>` : ""}</p>
      <span class="ft"><span><b>${esc(t.author_name)}</b>${t.author_tag ? ` <span class="tg">· ${esc(t.author_tag)}</span>` : ""} <span class="tg">${dayLabel(t.created_at)}</span></span><span class="tg">${t.reply_count} ${t.reply_count === 1 ? "reply" : "replies"} · last reply ${ago(t.last_reply_at)}</span></span></a>`;
  };

  // start a thread
  const startDlg = room => {
    const d = dlg(`<form class="cm-dc cm-sf" novalidate><h2>Start a thread</h2><p class="cm-sub">in # ${esc(room.title)}</p>
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
      try { const id = await q(S.sb.rpc("chat_start_thread", {p_room: room.id, p_title: title, p_body: text, p_kind: kind, p_options: options})); d.close(); location.hash = `#${room.slug}/t/${id}`; }
      catch (x) { btn.disabled = false; err.hidden = false; err.textContent = errCopy(x); const k = errKey(x); if (k === "name" || k === "rules") { d.close(); entry(); } } });
    $("#stt", d).focus();
  };

  // ---------- thread view (discussion and poll) ----------
  const showThread = async (room, id) => {
    const tok = ++cur.tok; cur = {tok, room, view: "thread", thread: null, msgs: new Map(), replyTo: null, opts: null, filter: 0, vote: null, change: false}; setView("thread");
    if (!S.signed) { pane.innerHTML = header(room, "threads") + `<div class="cm-body">${skeleton("rows", room)}</div>`; return; }
    busy();
    let t, ms, opts = [], counts = [], vote = null;
    try { t = await q(S.sb.from("chat_threads").select("*").eq("id", id).eq("room_id", room.id).maybeSingle());
      if (t) { ms = await q(S.sb.from("chat_messages").select("*").eq("thread_id", id).order("created_at", {ascending: true}).limit(500));
        if (t.kind === "poll") { counts = await q(S.sb.from("chat_poll_counts").select("*").eq("thread_id", id)); opts = counts.map(c => ({id: c.option_id, position: c.position, label: c.label})).sort((a, b) => a.position - b.position);
          const v = await q(S.sb.from("chat_thread_votes").select("option_id").eq("thread_id", id).eq("user_id", S.me.id).maybeSingle()); vote = v ? v.option_id : null; } } }
    catch { if (tok === cur.tok) failed(() => showThread(room, id)); return; }
    if (tok !== cur.tok) return;
    if (!t) { pane.innerHTML = header(room, "threads") + `<div class="cm-empty cm-body"><p>That thread isn't here any more.</p><a class="btn btn-s" href="#${room.slug}/threads">Back to threads</a></div>`; bindHeader(room); return; }
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
    pane.innerHTML = header(room, "threads", "", true) + `<div class="cm-tv"><div class="cm-tvh"><a class="cm-tb" href="#${room.slug}/threads">${ic("back", 18)}<span>Threads</span></a>${badges}${S.isMod ? `<button type="button" class="cm-more" id="cmTM" aria-label="Moderator actions for this thread" aria-haspopup="dialog">${ic("more", 20)}</button>` : ""}</div>
      <div class="cm-tvs"><h2>${esc(t.title)}</h2>${first ? `<div class="cm-first">${avatar(first.user_id, first.author_name)}<div><p class="cm-mh"><b>${esc(first.author_name)}</b>${first.author_tag ? `<span class="tg">· ${esc(first.author_tag)}</span>` : ""}${msgBadges(first)}<span class="tg">Started ${dayLabel(t.created_at).toLowerCase()}</span></p><p class="cm-tx">${body(first.body)}</p></div></div>` : ""}
      ${t.kind === "poll" ? pollHTML() : ""}<div class="cm-rh">${filt || '<span class="cm-div"></span>'}<span id="cmRc" class="tg">${repl(t.reply_count)}</span></div></div>
      <div class="cm-log" id="cmLog" role="log" aria-label="Replies" tabindex="0">${shown.length ? withDays(shown) : `<div class="cm-none cm-empty"><p>${cur.filter ? "No replies for this option yet." : "No replies yet."}</p></div>`}</div><div id="cmComp"></div></div>`;
    bindHeader(room);
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
      <ol class="cm-steps" aria-label="Steps"><li class="done">${ic("check", 14)}<span>Age</span></li><li class="${n === 2 ? "cur" : "done"}"><b>${n === 2 ? 2 : ""}</b>${n === 3 ? ic("check", 14) : ""}<span>Your name</span></li><li class="${n === 3 ? "cur" : ""}"><b>3</b><span>Rules</span></li></ol>${inner}</div>`;
    const d = dlg("", "cm-entry"), paint = s => { d.innerHTML = s === "name" ? frame(2, `<form novalidate><h2>Pick your name</h2><p class="cm-sub">Other members see this name with a 4-digit tag.</p><label class="cm-lbl" for="enm">Display name</label><input id="enm" maxlength="30" autocomplete="given-name" value="${esc(hasName || guess)}">
        <p class="cm-prev" id="eprev" aria-live="polite"></p><p class="cm-nv">First name and last initial is best. You can change it later in Settings.</p><p class="cm-err" role="alert" hidden></p><div class="cm-dr"><button class="btn btn-p wide" type="submit">Continue</button></div></form>`) :
        frame(3, `<form novalidate><h2>Five rules for chat</h2><ul class="cm-rules"><li><b>Be kind</b><span>Disagree with ideas, not people.</span></li><li><b>No personal info</b><span>No school, address, phone or socials. Yours or anyone else's.</span></li><li><b>Keep it here</b><span>No contact details, no chat-app or social profile links.</span></li><li><b>No selling</b><span>No ads, promo codes or asking for money.</span></li><li><b>Report, don't argue</b><span>Use the … menu on a message. We look at every report.</span></li></ul>
        <label class="cm-agree"><input type="checkbox" id="eag"><span>I have read the rules and I agree</span></label><p class="cm-err" role="alert" hidden></p><div class="cm-dr col"><button class="btn btn-p" type="submit" disabled>I agree</button><button class="tl" type="button" data-x>Not now</button></div></form>`);
      $$("[data-x]", d).forEach(b => b.addEventListener("click", () => { S.skipEntry = true; d.close(); }));
      const back = $("[data-back]", d); back.addEventListener("click", () => { if (s === "rules") paint("name"); else { S.skipEntry = true; d.close(); } });
      const f = $("form", d), err = $(".cm-err", d), btn = $('[type="submit"]', f), fail = x => { btn.disabled = false; err.hidden = false; err.textContent = errCopy(x); };
      if (s === "name") { const inp = $("#enm", d), pv = $("#eprev", d), up = () => { const v = inp.value.trim(); pv.innerHTML = v ? `${avatar(v, v)}<span>Other members see this name<br><b>${esc(v)}</b> · and a 4-digit tag</span>` : ""; }; inp.addEventListener("input", up); up(); inp.focus();
        f.addEventListener("submit", async e => { e.preventDefault(); btn.disabled = true; err.hidden = true;
          try { await q(S.sb.rpc("chat_set_name", {p_name: inp.value})); S.prof = await loadProfile(); paintList(); if (S.prof.chat_rules_at) { d.close(); refresh(); } else paint("rules"); } catch (x) { fail(x); } }); }
      else { const ag = $("#eag", d); ag.addEventListener("change", () => { btn.disabled = !ag.checked; }); ag.focus();
        f.addEventListener("submit", async e => { e.preventDefault(); if (!ag.checked) return; btn.disabled = true;
          try { await q(S.sb.rpc("chat_accept_rules")); S.prof = await loadProfile(); d.close(); toast("You're in. Say hi."); refresh(); } catch (x) { fail(x); } }); } };
    paint(step === "rules" || (hasName && !S.prof.chat_rules_at) ? "rules" : "name");
  }
  const refresh = () => route(true);

  // ---------- settings ----------
  const showSettings = () => {
    cur = {tok: ++cur.tok, room: null, view: "settings", thread: null, msgs: new Map()}; unsub(); setView("settings");
    if (!S.signed) { pane.innerHTML = `<header class="cm-h"><a class="cm-back" href="#" aria-label="Back">${ic("back", 22)}</a><div class="cm-t"><h1>Settings</h1></div></header><div class="cm-body"><div class="cm-empty"><p>Log in to change your chat settings.</p><a class="btn btn-p" href="/welcome/">Sign in</a></div></div>`; return; }
    const p = S.prof || {}, mutedNames = S.rooms.filter(r => S.muted.has(r.id)).map(r => "#" + r.title), all = S.rooms.length && S.rooms.every(r => S.muted.has(r.id));
    pane.innerHTML = `<header class="cm-h"><a class="cm-back" href="#" aria-label="Back to channels">${ic("back", 22)}</a><div class="cm-t"><h1>Settings</h1></div></header><div class="cm-body cm-set">
      <section class="card"><h2>Chat name</h2><form class="cm-sec" id="cmName" novalidate><label class="cm-lbl" for="snm">Display name</label><div class="cm-nr"><input id="snm" maxlength="30" value="${esc(p.display_name || "")}" autocomplete="off"><span class="tg">${p.name_tag ? "· " + esc(p.name_tag) : ""}</span></div>
        <p class="cm-nv">Others see this name with your 4-digit tag. You can change it 3 times a day.</p><p class="cm-err" role="alert" hidden></p><button class="btn btn-p" type="submit">Save name</button></form></section>
      <section class="card"><h2>Chat</h2><div class="cm-sr"><span><b>Mute all chat</b><small>No dot on Community, for any channel.</small></span><button type="button" class="tgl" role="switch" aria-checked="${!!all}" id="cmMuteAll" aria-label="Mute all chat"><span class="sw"></span></button></div>
        <div class="cm-sr"><span><b>Muted channels</b><small>${mutedNames.length ? esc(mutedNames.join(", ")) : "None"}</small></span></div>
        <button type="button" class="cm-sr link" id="cmRules"><span><b>Chat rules</b><small>Read what you agreed to.</small></span>${ic("chevr", 18)}</button></section>
      <section class="card"><h2>Account</h2><div class="cm-sr"><span><b>Plan</b><small>Free plan</small></span><a class="tl" href="/app/account/#plan">Upgrade</a></div><button type="button" class="cm-sr link" id="cmOut"><span><b>Sign out</b></span></button></section></div>`;
    const f = $("#cmName"), err = $(".cm-err", f); f.addEventListener("submit", async e => { e.preventDefault(); err.hidden = true;
      try { await q(S.sb.rpc("chat_set_name", {p_name: $("#snm").value})); S.prof = await loadProfile(); toast("Name saved."); showSettings(); } catch (x) { err.hidden = false; err.textContent = errCopy(x); } });
    $("#cmMuteAll").addEventListener("click", async e => { const on = e.currentTarget.getAttribute("aria-checked") === "true";
      try { if (on) { await q(S.sb.from("chat_room_mutes").delete().in("room_id", [...S.muted])); S.muted.clear(); } else { const add = S.rooms.filter(r => !S.muted.has(r.id)).map(r => ({room_id: r.id})); if (add.length) await q(S.sb.from("chat_room_mutes").insert(add)); S.rooms.forEach(r => S.muted.add(r.id)); }
        paintList(); showSettings(); } catch (x) { toast(errCopy(x)); } });
    $("#cmRules").addEventListener("click", () => dlg(`<div class="cm-dc"><h2>Chat rules</h2><ul class="cm-rules"><li><b>Be kind</b><span>Disagree with ideas, not people.</span></li><li><b>No personal info</b><span>No school, address, phone or socials. Yours or anyone else's.</span></li><li><b>Keep it here</b><span>No contact details, no chat-app or social profile links.</span></li><li><b>No selling</b><span>No ads, promo codes or asking for money.</span></li><li><b>Report, don't argue</b><span>Use the … menu on a message. We look at every report.</span></li></ul><div class="cm-dr"><button class="btn btn-p" type="button" data-x>Close</button></div></div>`, "cm-small"));
    $("#cmOut").addEventListener("click", () => window.LVAuth && LVAuth.signOut());
  };

  // ---------- router ----------
  const route = force => {
    const r = parse(); paintList();
    if (r.view === "list") { cur.tok++; cur.room = null; unsub(); setView("list"); pane.innerHTML = wide() ? "" : ""; return; }
    if (r.view === "settings") return showSettings();
    const room = roomBy(r.slug);
    if (!room) { setView("chan"); pane.innerHTML = `<header class="cm-h"><a class="cm-back" href="#" aria-label="Back to channels">${ic("back", 22)}</a><div class="cm-t"><h1>Channel not found</h1></div></header><div class="cm-empty cm-body"><p>That channel isn't here. Pick one from the list.</p></div>`; return; }
    if (r.view === "threads" && room.allow_threads) return showThreads(room);
    if (r.view === "thread" && room.allow_threads) return showThread(room, r.id);
    return showChat(room, r.about);
  };
  const loadProfile = async () => q(S.sb.from("profiles").select("display_name,name_tag,chat_rules_at,age_range").eq("user_id", S.me.id).maybeSingle());
  const AGE = {"13 to 15": "13-15", "16 to 17": "16-17", "18 to 20": "18-20", "21 or older": "21+"};

  const startSigned = async clerk => {
    for (let i = 0; i < 60 && !window.LVSync; i++) { if (i === 0 && !document.querySelector('script[src="/assets/supabase.js"]')) { const s = document.createElement("script"); s.src = "/assets/supabase.js"; document.head.appendChild(s); } await new Promise(r => setTimeout(r, 100)); }
    S.clerk = clerk; S.me = {id: clerk.user.id}; S.sb = await LVSync.make(clerk);
    S.prof = await loadProfile();
    if (!S.prof) { let age = null; try { age = JSON.parse(localStorage.getItem("lv-age")); } catch {} const em = clerk.user.primaryEmailAddress && clerk.user.primaryEmailAddress.emailAddress;
      if (age === "Under 13" || !AGE[age]) throw new Error("no age"); await q(S.sb.from("profiles").upsert({email: em, age_range: AGE[age]})); S.prof = await loadProfile(); }
    const [cats, rooms, mods, known, unread, mutes] = await Promise.all([q(S.sb.from("chat_room_categories").select("*")), q(S.sb.from("chat_rooms").select("*")), q(S.sb.from("chat_moderators").select("user_id,role")),
      q(S.sb.from("chat_known_domains").select("domain")), q(S.sb.rpc("chat_unread_rooms")), q(S.sb.from("chat_room_mutes").select("room_id"))]);
    S.cats = cats; S.rooms = rooms; S.mods = new Set(mods.map(m => m.user_id)); S.isMod = S.mods.has(S.me.id); S.known = new Set(known.map(k => k.domain));
    S.unread = new Set((unread || []).map(x => typeof x === "object" ? Object.values(x)[0] : x)); S.muted = new Set(mutes.map(m => m.room_id)); S.signed = true;
  };

  const fit = () => { const t = document.querySelector(".tabs"), tb = t && t.offsetParent ? t.offsetHeight : 0; root.style.height = Math.max(420, innerHeight - root.getBoundingClientRect().top - tb) + "px"; };
  const boot = async () => {
    fit(); addEventListener("resize", fit); addEventListener("load", fit); const pv = document.getElementById("prevbar"); if (pv && window.ResizeObserver) new ResizeObserver(fit).observe(pv);
    window.addEventListener("hashchange", () => route());
    let clerk = null; if (window.LVAuth && LVAuth.live) { try { clerk = await LVAuth.load(); } catch {} }
    if (clerk && clerk.user) { try { await startSigned(clerk); } catch (e) { S.signed = false; seedRooms(); pane.innerHTML = `<div class="cm-empty"><p>We couldn't open the community right now. Check your connection and try again.</p><button class="btn btn-s" type="button" id="cmRetry">Try again</button></div>`; paintList(); setView("chan"); $("#cmRetry").addEventListener("click", () => location.reload()); return; } }
    S.ready = true; if (!location.hash && wide()) location.replace("#" + (S.rooms.find(r => r.slug === "welcome") || S.rooms[0]).slug);
    route(); if (S.signed && !S.skipEntry && (!S.prof.display_name || !S.prof.chat_rules_at)) entry();
  };
  boot();
})();
