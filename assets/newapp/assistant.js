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
    flushP(); flushL();
    // the "This week" part of a reply becomes the mint "Try this week" box (Paper Ask): the heading plus the blocks up to the next heading
    const i = out.findIndex(x => /^<h3>(try )?this week/i.test(x));
    if (i >= 0) { let j = out.findIndex((x, k) => k > i && x.startsWith("<h3>")); if (j < 0) j = out.length;
      let k = i + 1; while (k < j && !/^<(ol|ul)>/.test(out[k])) k++;   // any intro lines
      if (k < j) k++; else k = Math.min(j, i + 2);                      // then the list (or, with no list, just the first line)
      out.splice(i, k - i, `<div class="as-try"><b>Try this week</b>${out.slice(i + 1, k).join("")}</div>`); }
    return out.join("");
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
    u.textContent = `${left} left today`; u.title = `${left} of ${info.limit} messages left today`;
    const u2 = $("[data-asuse2]"); if (u2) u2.textContent = `${left} message${left === 1 ? "" : "s"} left today`;
    const c = document.querySelector('[data-cnt="ask"]'); if (c) c.textContent = `${left} left`; };

  // ---------- conversation list ----------
  const day = t => new Date(t).toLocaleDateString(undefined, {month: "short", day: "numeric"});
  function renderList() {
    list.innerHTML = info.conversations.length ? info.conversations.map(c => `<li${c.id === cid ? ' class="on"' : ""}><button class="as-c" type="button" data-asopen="${esc(c.id)}"${c.id === cid ? ' aria-current="true"' : ""}><span>${esc(c.title)}</span><small>${esc(day(c.updated_at))}</small></button>`
      + `<button class="as-del" type="button" data-asdel="${esc(c.id)}" aria-label="Delete chat: ${esc(c.title)}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/></svg></button></li>`).join("")
      : '<li class="as-none">No chats yet. Your first one starts the list.</li>';
  }
  const drawer = open => { if (!matchMedia("(max-width:900px)").matches) return; root.classList.toggle("drawer", open); drawerBtn.setAttribute("aria-expanded", open); if (open) { const f = $("button", side); f && f.focus(); } };
  function newChat() { cid = null; log.innerHTML = ""; log.appendChild(empty); empty.hidden = false; renderList(); drawer(false); input.focus(); }
  async function openChat(id) {
    if (busy) return; cid = id; renderList(); drawer(false);
    log.innerHTML = '<p class="as-wait" role="status">Loading the chat…</p>';
    try { const r = await api("?id=" + encodeURIComponent(id)); const d = await r.json();
      if (!r.ok) throw 0;
      log.innerHTML = ""; d.messages.forEach(m => bubble(m.role, m.text, true, m.files));
      const last = d.messages.filter(m => m.role === "assistant").pop(); if (last) cards([...log.querySelectorAll(".as-msg.assistant")].pop(), slugs(last.text));
      log.lastElementChild && log.lastElementChild.scrollIntoView({block: "start"});
    } catch { log.innerHTML = '<p class="as-err">That chat didn\'t load. Try again in a moment.</p>'; }
  }

  // ---------- messages ----------
  // stories a reply links to, with the phase when the link names one (/app/story/rezi/#ph2)
  const slugs = t => { const o = {}; for (const m of t.matchAll(/\/app\/story\/([a-z0-9-]+)\/(?:#ph(\d+))?/g)) if (BY[m[1]] && !o[m[1]]) o[m[1]] = m[2] ? m[1] + "#" + m[2] : m[1]; return Object.values(o); };
  let COV = {}; try { COV = JSON.parse($("#lvcov").textContent); } catch {}
  const PHN = {}; (D.search_extra || []).forEach(x => { const m = /^(.+?) · phase (\d+): (.+)$/.exec(x.t || ""); if (m) PHN[m[1] + "#" + m[2]] = m[3]; });
  const AV = ($(".as-demo .as-av") || {}).innerHTML || "";
  const FINE = '<p class="as-fine">Answers use only LaunchVault stories and your own website. Not financial advice.</p>';
  const src = ref => { const [slug, ph] = String(ref).split("#"), s = BY[slug]; if (!s) return "";
    const sub = ph ? `Phase ${ph}${PHN[s.name + "#" + ph] ? " · " + PHN[s.name + "#" + ph] : ""}` : s.pattern || s.type;
    return `<a class="as-src" href="${esc(s.href)}${ph ? "#ph" + ph : ""}">${COV[slug] ? `<span class="cv th"><img src="${esc(COV[slug])}" alt="" width="144" height="80" loading="lazy"></span>` : `<span class="cv th nocv"><img src="${esc(s.logo)}" alt="" width="24" height="24"></span>`}`
      + `<span class="m"><b>${esc(s.name)}</b><small>${esc(sub)}</small></span><span class="o">Open</span></a>`; };
  function bubble(role, text, done, names) {
    empty.hidden = true; if (empty.parentNode === log && log.children.length > 1) empty.remove();
    const el = document.createElement("div"); el.className = "as-msg " + role;
    const fl = names && names.length ? `<div class="as-att">${names.map(n => typeof n === "string" ? `<span>${esc(n)}</span>` : `<a href="${n.src}" target="_blank" rel="noopener" title="${esc(n.name)}"><img src="${n.src}" alt="${esc(n.name)}"></a>`).join("")}</div>` : "";
    el.innerHTML = role === "user" ? `<p class="as-who sr">You said</p><div class="as-b">${fl}${esc(text).replace(/\n/g, "<br>")}</div>`
      : `<p class="as-who sr">Ask LaunchVault said</p><span class="as-av" aria-hidden="true">${AV}</span><div class="as-b as-md">${done ? md(text) : ""}</div>`;
    log.appendChild(el); return el;
  }
  function cards(el, ss) {
    const b = el && $(".as-b", el); if (!b) return;
    const h = ss.slice(0, 3).map(src).join("");
    const box = document.createElement("div"); box.innerHTML = (h ? `<div class="as-srcs">${h}</div>` : "") + FINE;
    const tr = $(".as-try", b); [...box.children].forEach(c => c.classList.contains("as-srcs") && tr ? tr.before(c) : b.appendChild(c));
  }
  const note = (el, t, cls = "as-err") => { const p = document.createElement("p"); p.className = cls; p.innerHTML = t; el.appendChild(p); };
  const ERR = {daily_limit: () => `You've used today's ${info ? info.limit : ""} messages. More tomorrow.${info && !info.paid ? ' Pro and Builder members get 100 a day: <a href="/app/account/#plan">see plans</a>.' : ""}`,
    busy: () => "Ask LaunchVault is busy right now. Your message wasn't counted. Try again in a minute.",
    conversation_full: () => 'This chat is full. <button class="tl" type="button" data-asnew>Start a new chat</button> to keep going; this one stays in your list.',
    bad_attachments: () => "One of those files couldn't be read. Remove it and send again. Your message wasn't counted.",
    attachments_too_big: () => "Those files are too big together. Send fewer or smaller ones. Your message wasn't counted.",
    message_too_long: () => "That message is over 4,000 characters. Shorten it and send again.",
    not_signed_in: () => 'Your sign-in ran out. <a href="/sign-in/?next=/app/assistant/">Sign in again</a> to keep chatting.',
    upstream: () => "Something went wrong and this message wasn't counted. Try sending it again."};

  // ---------- attachments: images (shrunk here first), PDFs, text and code. The model can't hear audio or watch video. ----------
  const addBtn = $("[data-asadd]"), fileIn = $("#asFile"), chips = $("[data-asfiles]"); let files = [];
  const TEXTY = /\.(txt|md|csv|tsv|json|ya?ml|xml|html?|css|scss|js|mjs|cjs|jsx|ts|tsx|py|rb|php|java|kt|swift|go|rs|c|h|cpp|cs|sql|sh|ps1|toml|ini|vue|svelte|log)$/i;
  const b64 = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(blob); });
  async function take(f) {   // -> an attachment, or a sentence saying why not
    if (/^(audio|video)\//.test(f.type) || /\.(mp3|mp4|mov|wav|m4a|webm|avi|mkv)$/i.test(f.name)) return "Ask LaunchVault can't listen to audio or watch video yet. Add a screenshot or paste the transcript instead.";
    if (/^image\/(jpeg|png|webp|gif)$/.test(f.type)) {
      const img = await new Promise((res, rej) => { const i = new Image(), u = URL.createObjectURL(f); i.onload = () => { URL.revokeObjectURL(u); res(i); }; i.onerror = () => { URL.revokeObjectURL(u); rej(); }; i.src = u; });
      const k = Math.min(1, 1568 / Math.max(img.naturalWidth, img.naturalHeight)), cv = document.createElement("canvas"); cv.width = Math.round(img.naturalWidth * k); cv.height = Math.round(img.naturalHeight * k);
      const g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(img, 0, 0, cv.width, cv.height);
      const blob = await new Promise(r => cv.toBlob(r, "image/jpeg", 0.85));
      return {name: f.name, kind: "image", media_type: "image/jpeg", data: await b64(blob), src: URL.createObjectURL(blob), dim: cv.width + " × " + cv.height};
    }
    if (f.type === "application/pdf") return f.size > 2.5e6 ? `${f.name} is over 2.5 MB. Send a smaller PDF or the pages you need.` : {name: f.name, kind: "pdf", data: await b64(f), src: URL.createObjectURL(f), dim: Math.max(1, Math.round(f.size / 1024)) + " KB"};
    if (/^text\//.test(f.type) || f.type === "application/json" || TEXTY.test(f.name)) {
      const t = await f.text(); if (!t.trim() || t.includes("\u0000")) return `${f.name} isn't a text file we can read.`;
      return {name: f.name, kind: "text", text: t.slice(0, 20000), cut: t.length > 20000, dim: t.split("\n").length + " lines"};
    }
    return `${f.name} is a kind of file Ask LaunchVault can't read. Images, PDFs, text and code files work.`;
  }
  function drawFiles(msg = "") {
    chips.hidden = !files.length && !msg;
    chips.innerHTML = files.map((f, i) => `<span class="as-chip"><button type="button" class="as-see" data-assee="${i}" aria-label="Preview ${esc(f.name)}">${f.kind === "image" ? `<img src="${f.src}" alt="">` : `<i>${f.kind === "pdf" ? "PDF" : (f.name.split(".").pop() || "txt").slice(0, 4)}</i>`}<span><b>${esc(f.name)}</b><small>${esc(f.dim || "")}${f.cut ? " · first part only" : ""}</small></span></button><button type="button" class="as-rm" data-asrm="${i}" aria-label="Remove ${esc(f.name)}">×</button></span>`).join("") + (msg ? `<p role="alert">${esc(msg)}</p>` : "");
  }
  addBtn.addEventListener("click", () => fileIn.click());
  chips.addEventListener("click", e => { const b = e.target.closest("[data-asrm]"); if (b) { const f = files.splice(+b.dataset.asrm, 1)[0]; if (f && f.src) URL.revokeObjectURL(f.src); drawFiles(); input.focus(); return; }
    const v = e.target.closest("[data-assee]"); if (v) see(files[+v.dataset.assee]); });
  // look at what you attached before sending: the image as the assistant will get it, the text of a file, or the PDF in a new tab
  function see(f) {
    if (!f) return; if (f.kind === "pdf") { window.open(f.src, "_blank", "noopener"); return; }
    const d = document.createElement("dialog"); d.className = "rdlg as-pv"; d.setAttribute("aria-label", "Preview of " + f.name);
    d.innerHTML = `<form method="dialog"><div class="as-pvh"><b>${esc(f.name)}</b><small>${esc(f.dim || "")}${f.kind === "image" ? " · what the assistant will see" : f.cut ? " · first 20,000 characters" : ""}</small><button class="btn btn-s" value="x">Close</button></div>${f.kind === "image" ? `<img src="${f.src}" alt="${esc(f.name)}">` : `<pre>${esc(f.text)}</pre>`}</form>`;
    document.body.appendChild(d); d.addEventListener("close", () => d.remove()); d.addEventListener("click", e => { if (e.target === d) d.close(); }); d.showModal();
  }
  async function addFiles(list) {
    let msg = "", pasted = 0;
    for (let f of list) {
      if (files.length >= 4) { msg = "Up to 4 files a message."; break; }
      if (/^image\.(png|jpe?g)$/i.test(f.name)) f = new File([f], "Pasted image " + (files.filter(x => /^Pasted image/.test(x.name)).length + ++pasted) + "." + f.name.split(".").pop(), {type: f.type});   // a pasted screenshot arrives as "image.png"
      let a; try { a = await take(f); } catch { a = `${f.name} couldn't be opened.`; }
      if (typeof a === "string") { msg = a; continue; }
      if (files.concat(a).reduce((n, x) => n + (x.data || "").length, 0) > 3.9e6) { msg = `${f.name} makes this message too big. Send it on its own.`; continue; }
      files.push(a);
    }
    drawFiles(msg); input.focus();
  }
  // paste (Ctrl+V of a screenshot or a copied file) and drag-and-drop go the same way as the + button
  input.addEventListener("paste", e => { const fl = e.clipboardData && [...e.clipboardData.files]; if (!fl || !fl.length || addBtn.hidden) return; e.preventDefault(); addFiles(fl); });
  form.addEventListener("dragover", e => { if (addBtn.hidden || !e.dataTransfer || ![...e.dataTransfer.types].includes("Files")) return; e.preventDefault(); form.classList.add("drop"); });
  form.addEventListener("dragleave", e => { if (!form.contains(e.relatedTarget)) form.classList.remove("drop"); });
  form.addEventListener("drop", e => { form.classList.remove("drop"); if (addBtn.hidden || !e.dataTransfer || !e.dataTransfer.files.length) return; e.preventDefault(); addFiles([...e.dataTransfer.files]); });
  fileIn.addEventListener("change", async () => { const l = [...fileIn.files]; fileIn.value = ""; await addFiles(l); });

  async function ask(text) {
    if (busy || (!text.trim() && !files.length)) return;
    const mine = files, att = files.map(f => f.kind === "text" ? {name: f.name, kind: f.kind, text: f.text} : f.kind === "image" ? {name: f.name, kind: f.kind, media_type: f.media_type, data: f.data} : {name: f.name, kind: f.kind, data: f.data}); files = []; drawFiles();
    if (!text.trim()) text = "Take a look at what I attached.";
    busy = true; send.disabled = true; form.setAttribute("aria-busy", "true");
    bubble("user", text, false, mine.map(f => f.kind === "image" ? {name: f.name, src: f.src} : f.name)); input.value = ""; input.style.height = "";
    const el = bubble("assistant", ""), body = $(".as-b", el); el.classList.add("streaming");
    body.innerHTML = '<span class="as-typing">Thinking<i>.</i><i>.</i><i>.</i></span>';
    el.scrollIntoView({block: "nearest"});
    let acc = "", raf = 0, ended = null;
    const paint = () => { raf = 0; body.innerHTML = md(acc); };
    try {
      const r = await api("", {method: "POST", body: JSON.stringify(att.length ? {conversation_id: cid, message: text, attachments: att} : {conversation_id: cid, message: text})});
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
        { const mine = slugs(acc); cards(el, [...mine, ...(ended.stories || []).filter(s => BY[s] && !mine.some(x => x.split("#")[0] === s))]); }
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
    finally { el.classList.remove("streaming"); busy = false; form.removeAttribute("aria-busy"); send.disabled = root.dataset.state !== "ready"; }
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

  $$("[data-asdemosrc]").forEach(b => { b.innerHTML = b.dataset.asdemosrc.split(",").map(src).join(""); });
  // ---------- start ----------
  const soon = () => state("soon", "Ask LaunchVault opens soon", "The assistant is built and is being switched on. Your stories, checklists and path all work in the meantime.", false);
  (async () => {
    const live = window.LVAuth && LVAuth.live;
    if (live) clerk = await LVAuth.load().catch(() => null);
    if (!clerk || !clerk.user || !clerk.session) {
      return state("gate", "Ask LaunchVault is for members", judge()
        ? "The judge pass unlocks the breakdowns in this browser. The assistant runs on our servers, so it needs a free account: that is how we keep it safe for teens and cap its cost."
        : "Sign in or create a free account to ask about your idea. Free accounts get 10 messages a day; Pro and Builder get 100.");
    }
    try {
      const r = await api(); const d = await r.json();
      if (!r.ok) throw 0;
      if (!d.configured) return soon();
      info = d; state("ready"); usage(); renderList(); addBtn.hidden = !d.attach;   // the + shows only when the live function accepts files
      // "Reading yoursite.com": shown when the member has a verified website (the site Edge Function, same as Account > Your website)
      fetch(FN.replace(/assistant$/, "site"), {headers: {Authorization: "Bearer " + await token()}}).then(x => x.json()).then(x => { const p = $("[data-assite]");
        if (p && x.site && x.site.verified) { $("[data-assited]").textContent = x.site.domain; p.hidden = false; } }).catch(() => {});
    } catch { state("gate", "Ask LaunchVault didn't load", "We couldn't reach the assistant. Check your connection and reload the page.", false); }
  })();
})();
