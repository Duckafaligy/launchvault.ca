/* Ask LaunchVault (/app/assistant/): chat with the assistant Edge Function (db/supabase/functions/assistant).
   Signed-in members only; the Clerk session token goes in the Authorization header (same as the billing buttons).
   Replies stream as server-sent events. Reply text is escaped first, then a small markdown subset is applied
   (headings, lists, bold, code, links to this site or https only). */
(() => {
  if (!window.LVGate || !LVGate.ok) return;
  const FN = "https://azriqynpnbltvxucwmpo.supabase.co/functions/v1/assistant";
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
  const root = $("#as"); if (!root) return;
  let D = {stories: []}; try { D = JSON.parse($("#lvapp").textContent); } catch {}
  const BY = Object.fromEntries(D.stories.map(s => [s.slug, s]));
  const log = $("[data-aslog]"), empty = $("[data-asempty]"), form = $("[data-ascomp]"), input = $("#asIn"), send = $(".as-send", form);
  const side = $("#asSide"), drawerBtn = $("[data-asdrawer]"), list = $("[data-asconvs]"), sr = $("[data-assr]");
  let clerk = null, cid = null, busy = false, info = null;
  const judge = () => { try { return JSON.parse(localStorage.getItem("lv-judge")) === "SPARK2026"; } catch { return false; } };
  const token = async () => (clerk && clerk.session ? await clerk.session.getToken() : null);
  const api = async (path = "", opt = {}) => fetch(FN + path, {...opt, headers: {Authorization: "Bearer " + await token(), "Content-Type": "application/json", ...(opt.headers || {})}});

  // ---------- safe markdown subset ----------
  const link = (t, u) => { const url = u.replace(/&amp;/g, "&");
    if (/^\/(app|blog)\/[\w\-/#?=.&%]*$/.test(url)) return `<a href="${esc(url)}">${t}</a>`;
    if (/^https:\/\/[^\s"<>]+$/.test(url)) return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer nofollow">${t} <span aria-hidden="true">↗</span></a>`;
    return t; };
  const inline = s => s.replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => link(t, u));
  function md(text) {
    const out = []; let li = null, para = [];
    const flushP = () => { if (para.length) out.push(`<p>${inline(para.join(" "))}</p>`); para = []; };
    const flushL = () => { if (li) out.push(`<${li.t}>${li.items.map(x => `<li>${inline(x)}</li>`).join("")}</${li.t}>`); li = null; };
    for (const raw of esc(text).split("\n")) {
      const l = raw.trim(); let m;
      if (!l) { flushP(); flushL(); continue; }
      if ((m = l.match(/^#{1,4}\s+(.*)$/))) { flushP(); flushL(); out.push(`<h3>${inline(m[1])}</h3>`); continue; }
      if ((m = l.match(/^(?:[-*•]|\d+[.)])\s+(?:\[[ x]\]\s+)?(.*)$/))) { flushP(); const t = /^\d/.test(l) ? "ol" : "ul"; if (!li || li.t !== t) { flushL(); li = {t, items: []}; } li.items.push(m[1]); continue; }
      if (li && /^\s{2,}/.test(raw)) { li.items[li.items.length - 1] += " " + l; continue; }
      flushL(); para.push(l);
    }
    flushP(); flushL(); return out.join("");
  }

  // ---------- states ----------
  function state(s, h, p, btn) {
    root.dataset.state = s;
    const gate = $("[data-asgate]"); gate.hidden = s === "ready" || s === "loading";
    log.hidden = !gate.hidden;
    const demo = $("[data-asdemo]"); if (demo) demo.hidden = gate.hidden;   // locked: show an example of a real answer instead of an empty page   // the gate card takes the chat's place (no starter questions under a locked box, and nothing gets pushed down)
    if (h) { $("[data-asgateh]").textContent = h; $("[data-asgatep]").textContent = p; }
    const b = $("[data-asgatebtn]"); if (btn === false) b.hidden = true;
    input.disabled = send.disabled = s !== "ready"; form.hidden = s !== "ready" && s !== "loading";
    $$("[data-asstart]").forEach(x => { x.disabled = s !== "ready"; });
    side.hidden = drawerBtn.hidden = s !== "ready";
  }
  const usage = () => { const u = $("[data-asuse]"); if (!info) return; const left = Math.max(0, info.limit - info.used);
    u.textContent = `${left} of ${info.limit} messages left today. `; };

  // ---------- conversation list ----------
  const day = t => new Date(t).toLocaleDateString(undefined, {month: "short", day: "numeric"});
  function renderList() {
    list.innerHTML = info.conversations.length ? info.conversations.map(c => `<li${c.id === cid ? ' class="on"' : ""}><button class="as-c" type="button" data-asopen="${esc(c.id)}"${c.id === cid ? ' aria-current="true"' : ""}><span>${esc(c.title)}</span><small>${esc(day(c.updated_at))}</small></button>`
      + `<button class="as-del" type="button" data-asdel="${esc(c.id)}" aria-label="Delete chat: ${esc(c.title)}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/></svg></button></li>`).join("")
      : '<li class="as-none">No chats yet. Your first question starts one.</li>';
  }
  const drawer = open => { if (!matchMedia("(max-width:900px)").matches) return; root.classList.toggle("drawer", open); drawerBtn.setAttribute("aria-expanded", open); if (open) { const f = $("button", side); f && f.focus(); } };
  function newChat() { cid = null; log.innerHTML = ""; log.appendChild(empty); empty.hidden = false; renderList(); drawer(false); input.focus(); }
  async function openChat(id) {
    if (busy) return; cid = id; renderList(); drawer(false);
    log.innerHTML = '<p class="as-wait" role="status">Loading the chat…</p>';
    try { const r = await api("?id=" + encodeURIComponent(id)); const d = await r.json();
      if (!r.ok) throw 0;
      log.innerHTML = ""; d.messages.forEach(m => bubble(m.role, m.text, true));
      const last = d.messages.filter(m => m.role === "assistant").pop(); if (last) cards(log.lastElementChild, slugs(last.text));
      log.lastElementChild && log.lastElementChild.scrollIntoView({block: "start"});
    } catch { log.innerHTML = '<p class="as-err">That chat didn\'t load. Try again in a moment.</p>'; }
  }

  // ---------- messages ----------
  const slugs = t => [...new Set([...t.matchAll(/\/app\/story\/([a-z0-9-]+)\//g)].map(m => m[1]))].filter(s => BY[s]);
  function bubble(role, text, done) {
    empty.hidden = true; if (empty.parentNode === log && log.children.length > 1) empty.remove();
    const el = document.createElement("div"); el.className = "as-msg " + role;
    el.innerHTML = role === "user" ? `<p class="as-who sr">You said</p><div class="as-b">${esc(text).replace(/\n/g, "<br>")}</div>`
      : `<p class="as-who"><span class="as-dot" aria-hidden="true"></span>Ask LaunchVault</p><div class="as-b as-md">${done ? md(text) : ""}</div>`;
    log.appendChild(el); return el;
  }
  function cards(el, ss) {
    if (!el || !ss.length || !window.LVStoryCard) return;
    const box = document.createElement("div"); box.className = "scards as-cards";
    box.innerHTML = ss.slice(0, 3).map(s => window.LVStoryCard(BY[s])).join(""); el.appendChild(box);
  }
  const note = (el, t, cls = "as-err") => { const p = document.createElement("p"); p.className = cls; p.innerHTML = t; el.appendChild(p); };
  const ERR = {daily_limit: () => `You've used today's ${info ? info.limit : ""} messages. More tomorrow.${info && !info.paid ? ' Pro and Builder members get 100 a day: <a href="/app/account/#plan">see plans</a>.' : ""}`,
    busy: () => "Ask LaunchVault is busy right now. Your message wasn't counted. Try again in a minute.",
    conversation_full: () => 'This chat is full. <button class="tl" type="button" data-asnew>Start a new chat</button> to keep going; this one stays in your list.',
    message_too_long: () => "That message is over 4,000 characters. Shorten it and send again.",
    not_signed_in: () => 'Your sign-in ran out. <a href="/sign-in/?next=/app/assistant/">Sign in again</a> to keep chatting.',
    upstream: () => "Something went wrong and this message wasn't counted. Try sending it again."};

  async function ask(text) {
    if (busy || !text.trim()) return;
    busy = true; send.disabled = true; send.textContent = "Sending…";
    bubble("user", text); input.value = ""; input.style.height = "";
    const el = bubble("assistant", ""), body = $(".as-b", el);
    body.innerHTML = '<span class="as-typing">Thinking<i>.</i><i>.</i><i>.</i></span>';
    el.scrollIntoView({block: "nearest"});
    let acc = "", raf = 0, ended = null;
    const paint = () => { raf = 0; body.innerHTML = md(acc); };
    try {
      const r = await api("", {method: "POST", body: JSON.stringify({conversation_id: cid, message: text})});
      if (!r.ok || !r.body) {
        const d = await r.json().catch(() => ({}));
        if (d.error === "assistant_not_configured") { el.remove(); return soon(); }
        body.innerHTML = ""; note(el, (ERR[d.error] || ERR.upstream)());
        if (d.error === "daily_limit" && info) { info.used = info.limit; usage(); }
        return;
      }
      const rd = r.body.getReader(), dec = new TextDecoder(); let buf = "";
      for (;;) {
        const {value, done} = await rd.read(); if (done) break;
        buf += dec.decode(value, {stream: true});
        let i; while ((i = buf.indexOf("\n\n")) >= 0) {
          const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
          const ev = (chunk.match(/^event: (.*)$/m) || [])[1], data = JSON.parse((chunk.match(/^data: (.*)$/m) || [, "{}"])[1]);
          if (ev === "text") { acc += data.t; if (!raf) raf = requestAnimationFrame(paint); }
          else if (ev === "status" && !acc) body.innerHTML = '<span class="as-typing">Reading the website<i>.</i><i>.</i><i>.</i></span>';
          else if (ev === "done" || ev === "refusal" || ev === "error") ended = {ev, ...data};
        }
      }
      cancelAnimationFrame(raf); body.innerHTML = md(acc);
      if (!ended) throw 0;
      if (ended.ev === "refusal") { body.innerHTML = ""; note(el, "I can't help with that one. Ask me about your project or a story in the library instead.", "as-soft"); }
      else if (ended.ev === "error") { body.innerHTML = acc ? body.innerHTML : ""; note(el, (ERR[ended.error] || ERR.upstream)()); }
      else {
        if (ended.cut) note(el, "This reply was cut short. Ask me to continue.", "as-soft");
        cards(el, ended.stories || []);
        if (ended.remembered) note(el, 'Saved to your <a href="/app/account/#prefs">preferences</a>. You can remove it any time.', "as-soft");
        const isNew = !cid; cid = ended.conversation_id;
        if (info) { info.used = ended.used; info.limit = ended.limit; usage();
          const c = info.conversations.find(x => x.id === cid);
          if (c) { c.updated_at = new Date().toISOString(); info.conversations = [c, ...info.conversations.filter(x => x !== c)]; }
          else if (isNew) info.conversations.unshift({id: cid, title: text.trim().replace(/\s+/g, " ").slice(0, 60), updated_at: new Date().toISOString()});
          renderList(); }
        sr.textContent = "Reply ready.";
      }
    } catch { if (!acc) body.innerHTML = ""; note(el, ERR.upstream()); }
    finally { busy = false; send.textContent = "Send"; send.disabled = root.dataset.state !== "ready"; }
  }

  // ---------- events ----------
  form.addEventListener("submit", e => { e.preventDefault(); ask(input.value); });
  input.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); ask(input.value); } });
  input.addEventListener("input", () => { input.style.height = ""; input.style.height = Math.min(input.scrollHeight, 220) + "px"; });
  document.addEventListener("click", async e => {
    if (e.target === root && root.classList.contains("drawer")) return drawer(false);   // tap on the dimmed backdrop
    const st = e.target.closest("[data-asstart]"); if (st) { input.value = st.dataset.asstart; input.focus(); input.setSelectionRange(input.value.length, input.value.length); input.dispatchEvent(new Event("input")); return; }
    if (e.target.closest("[data-asnew]")) return newChat();
    const op = e.target.closest("[data-asopen]"); if (op) return openChat(op.dataset.asopen);
    if (e.target.closest("[data-asdrawer]")) return drawer(!root.classList.contains("drawer"));
    const del = e.target.closest("[data-asdel]");
    if (del && confirm("Delete this chat? This can't be undone.")) {
      const id = del.dataset.asdel, r = await api("?id=" + encodeURIComponent(id), {method: "DELETE"}).catch(() => null);
      if (!r || !r.ok) { sr.textContent = "That chat wasn't deleted. Try again."; return; }
      info.conversations = info.conversations.filter(c => c.id !== id); if (cid === id) newChat(); else renderList(); sr.textContent = "Chat deleted.";
    }
  });
  addEventListener("keydown", e => { if (e.key === "Escape" && root.classList.contains("drawer")) { drawer(false); drawerBtn.focus(); } });

  // ---------- start ----------
  const soon = () => state("soon", "Ask LaunchVault opens soon", "The assistant is built and is being switched on. Your stories, checklists and path all work in the meantime.", false);
  (async () => {
    const live = window.LVAuth && LVAuth.live;
    if (live) clerk = await LVAuth.load().catch(() => null);
    if (!clerk || !clerk.user || !clerk.session) {
      return state("gate", "Ask LaunchVault is for members", judge()
        ? "The judge pass unlocks the breakdowns in this browser. The assistant runs on our servers, so it needs a free account: that is how we keep it safe for teens and cap its cost."
        : "Sign in or create a free account to ask about your idea. Free accounts get 10 questions a day; Pro and Builder get 100.");
    }
    try {
      const r = await api(); const d = await r.json();
      if (!r.ok) throw 0;
      if (!d.configured) return soon();
      info = d; state("ready"); usage(); renderList();
    } catch { state("gate", "Ask LaunchVault didn't load", "We couldn't reach the assistant. Check your connection and reload the page.", false); }
  })();
})();
