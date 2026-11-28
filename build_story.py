"""Story pages for the app, from one story JSON (Paper "LaunchVault · Story course" > Story page designs, 1:1).

  /app/story/<slug>/       story home: hero, The numbers (pinned count-up + line), the two doors, Watch the business, Is it a good reference?, sources
  /app/story/<slug>/<n>/   chapter n (one entry of phases): the lesson page. Chapter 1 is always free; the rest go through the lesson quota (story.js)

Every section is built only from what the JSON has; a missing optional field drops its section (data/stories/SCHEMA.md lists the fields).
Called from build_newapp.py (pages(E, S, shell, cover, pi) -> story home html, [chapter html, ...]); behaviour lives in assets/newapp/story.js.
"""
import math, os, re
import build_app as B

esc, money, mlab = B.esc, B.money, B.mlab
ROOT = os.path.dirname(os.path.abspath(__file__))
LBC = B.LBC
ARW = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'
CHEV = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>'
BACK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>'
STAR = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg>'
PLAY = '<span class="play" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z" fill="currentColor"/></svg></span>'
CHK = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" pathLength="1"/></svg>'
CAP = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M2 9l10-5 10 5-10 5z M6 11v5c3 2 9 2 12 0v-5"/></svg>'
WEB = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/></svg>'


def lbt(l, dot=True):
    """A label as coloured text ("● Verified"), Paper's stat style."""
    return f'<span class="lbt {LBC.get(l, "n")}">{"● " if dot else ""}{esc(l)}</span>' if l else ""


def pill(l):
    return f'<span class="lpill {LBC.get(l, "n")}"><i></i>{esc(l)}</span>' if l else ""


def host(u):
    return re.sub(r"^https?://(www\.)?", "", u or "").rstrip("/")


def yt_thumb(v):
    t = v.get("thumb") or ""
    if t and os.path.exists(os.path.join(ROOT, t.lstrip("/"))): return t
    return f"https://i.ytimg.com/vi/{esc(v['id'])}/hqdefault.jpg"


def video_card(v, sub, big=False):
    return (f'<a class="vcard{" sbig" if big else ""}" href="https://www.youtube.com/watch?v={esc(v["id"])}" target="_blank" rel="noopener">'
            f'<span class="vth"><img src="{yt_thumb(v)}" alt="" width="480" height="270" loading="lazy" decoding="async">{PLAY if big else ""}</span>'
            f'<b>{esc(v.get("title", ""))}</b><small>{esc(sub)}</small></a>')


def vsub(v):
    if v.get("kind") == "own" and v.get("views"): return f'{v.get("channel", "")} on YouTube · {v["views"]} views'
    return " · ".join(x for x in (v.get("channel"), v.get("duration")) if x)


def read_min(p):
    words = len(" ".join([p.get("story", ""), p.get("dek", ""), p.get("lesson", "")]).split())
    return max(1, math.ceil(words / 200))


def first_month(t):
    m = re.search(r"\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.? (?:\d{1,2},? )?(\d{4})", t or "")
    return f"{m.group(2)}-{B.MONI[m.group(1)]:02d}" if m else None


# ------------------------------------------------------------------ story home
def numbers_chart(S):
    se = S["series"]; pts = se["points"]
    if len(pts) < 2: return ""
    mi = lambda t: int(t[:4]) * 12 + int(t[5:7]) - 1
    x0 = min([mi(pts[0][0])] + ([mi(se["start"])] if se.get("start") else [])); x1 = mi(pts[-1][0]); top = max(p[1] for p in pts) or 1
    X = lambda m: 40 + (m - x0) / max(1, x1 - x0) * 1122
    Y = lambda v: 260 - v / top * 230
    line = " ".join(f"{X(mi(p[0])):.1f},{Y(p[1]):.1f}" for p in pts)
    last = pts[-1]
    half = top / 2; hl = f"${half / 1e6:.2f}M" if half >= 1e6 else f"${round(half / 1e3)}K" if half >= 1e3 else money(round(half))
    label = esc(f'{S["name"]}: {se["what"].lower()}, ' + ", ".join(f"{mlab(p[0])} {money(p[1])}" for p in pts))
    svg = (f'<svg class="nch" viewBox="0 0 1200 270" preserveAspectRatio="none" role="img" aria-label="{label}">'
           '<line x1="40" y1="260" x2="1180" y2="260" class="g0"/><line x1="40" y1="145" x2="1180" y2="145" class="g1"/><line x1="40" y1="30" x2="1180" y2="30" class="g1"/>'
           f'<polyline points="{line}" class="nline" pathLength="1"/>'
           f'<circle cx="{X(mi(last[0])):.1f}" cy="{Y(last[1]):.1f}" r="5" class="end"/>'
           f'<text x="44" y="141" class="nglab">{esc(hl)}</text></svg>')
    # axis: where the chart starts, the chapters that start inside it, where it ends (Paper "Chart axis")
    axis = [mlab(se["start"]) + " · started" if se.get("start") else mlab(pts[0][0])]
    mids = [(fm, p["name"]) for p in S["phases"] for fm in [first_month(p.get("when"))] if fm and x0 < mi(fm) < x1]
    if len(mids) > 2: mids = [mids[0], mids[len(mids) // 2]] if len(mids) < 4 else [mids[len(mids) // 3], mids[2 * len(mids) // 3]]
    axis += [f"{mlab(fm)} · {nm}" for fm, nm in mids]
    axis.append(mlab(last[0]))
    ax = "".join(f'<span{" class=" + chr(34) + "nnow" + chr(34) if i == len(axis) - 1 else ""}>{esc(t)}</span>' for i, t in enumerate(axis))
    labs = [p[2] if len(p) > 2 else se.get("label", "") for p in pts]; cnt = {l: labs.count(l) for l in dict.fromkeys(labs) if l}
    srcl = src_link({"source": se.get("source", "")}) if str(se.get("source", "")).startswith("http") else f'<span class="slink">{esc(se.get("source", ""))}</span>'
    cap = (f'<p class="ncap">{esc(se["what"])}, {esc(mlab(pts[0][0]))} to {esc(mlab(last[0]))}. Source: {srcl}. Points: '
           + ", ".join(f'{lbt(l, dot=False)} {c}' for l, c in cnt.items()) + '. Each point\'s label and source are in the table.</p>')
    return f'<div class="nchw">{svg}</div><div class="nax" aria-hidden="true">{ax}</div>{cap}<div class="ntab">{B.chart_table(S)}</div>'


def src_link(x, cls="slink"):
    """Where a fact comes from: a link when the source is a URL, else the source's name (always shown)."""
    s = x.get("source") or x.get("url") or ""; nm = B.src_name(x).split(":")[0] or "Source"
    return f'<a class="{cls}" href="{esc(s)}" target="_blank" rel="noopener">{esc(nm)} ↗</a>' if s.startswith("http") else f'<span class="{cls}">{esc(nm)}</span>'


def home_body(S, cover, pi):
    B.set_srcmap(S); slug, name = S["slug"], S["name"]; n = len(S["phases"])
    h = S.get("hero") or {}; title = h.get("title") or S["title"]; tags = h.get("tags") or []
    fit = S.get("fit") or []; vids = S.get("videos") or []; soc = S.get("social") or {}
    hero = (f'<header class="shero"><div class="shl"><div class="shco"><span class="shlogo"><img src="{esc(S["logo"])}" alt="" width="56" height="56"></span>'
            f'<span><b>{esc(name)}</b><small>{esc(S["what"])}</small></span></div>'
            f'<h1 class="shh">{esc(title)}</h1>'
            + (f'<ul class="shtags">{"".join(f"<li>{esc(t)}</li>" for t in tags)}</ul>' if tags else "")
            + '</div><div class="sha">'
            + (f'<a class="bw" href="#fit">Use as a reference{ARW}</a>' if len(fit) == 3 else "")
            + f'<button class="sstar" type="button" data-star="{slug}" aria-pressed="false" aria-label="Save {esc(name)}">{STAR}<span class="sr">Save</span></button></div></header>')
    nums = S["numbers"][:5]
    srcs = []
    for x in nums:
        s = B.src_name(x).split(":")[0]
        if s and s not in srcs and x.get("label") != "Wayback": srcs.append(s)
    upd = (" and ".join([", ".join(srcs[:-1]), srcs[-1]]) if len(srcs) > 1 else srcs[0]) if srcs else ""
    when = B.latest_date(x["date"] for x in nums)
    stats = "".join(f'<div class="nst{" sbig" if i == 0 else ""}"><span class="nk">{esc(x.get("long") or x["k"])}</span><b>{esc(x["v"])}</b><span class="nsrc">{lbt(x["label"])} · {esc(x["date"])}<br>{src_link(x)}</span></div>' for i, x in enumerate(nums))
    numbers = (f'<section class="npin" id="chart"><div class="npin-in"><div class="ncard"><div class="nhd"><h2>The numbers</h2>'
               + (f'<span>Updated from {esc(upd)}{" · " + esc(when) if when else ""}</span>' if upd else "")
               + f'</div><div class="nstats">{stats}</div>{numbers_chart(S)}</div></div></section>')
    # door 1: the full story
    img = f"/assets/figures/{slug}-site.webp" if os.path.exists(os.path.join(ROOT, "assets", "figures", f"{slug}-site.webp")) else cover(slug)
    mv = S.get("moves") or []
    pick = [mv[round(i * (len(mv) - 1) / 2)] for i in range(3)] if len(mv) >= 3 else mv
    rows = "".join(f'<li><span>{esc(m.get("when", ""))}</span><b>{esc(m["text"])}</b>{lbt(m.get("label"), dot=False)}</li>' for m in pick)
    d1 = (f'<a class="door" href="/app/story/{slug}/1/">' + (f'<span class="dimg"><img src="{esc(img)}" alt="" width="960" height="540" loading="lazy" decoding="async"></span>' if img else "")
          + f'<span class="dtx"><span class="dk">{n} chapter{"s" if n != 1 else ""} · Chapter 1 is free</span><b class="dh">The full story</b><span class="dd">{esc(S["dek"])}</span>'
          + (f'<ul class="drows">{rows}</ul>' if rows else "") + f'<span class="dl">Start Chapter 1 →</span></span></a>')
    d2 = ""
    if soc.get("summary") or soc.get("system"):
        sysc = "".join(f'<li><b>{esc(x.get("when", ""))}</b><span>{esc(x.get("what", ""))}</span></li>' for x in soc.get("system") or [])
        acc = soc.get("accounts") or []
        chips = "".join(f'<a class="dchip" href="{esc(a["url"])}" target="_blank" rel="noopener">{esc(a["label"])}</a>' for a in acc if str(a.get("url", "")).startswith("https://"))
        has_own = any(v.get("kind") == "own" for v in vids)
        d2 = (f'<div class="door">' + (f'<div class="dsys"><span class="dsk">Their posting system</span><ul>{sysc}</ul>' + (f'<span class="dsn">{esc(soc["note"])}</span>' if soc.get("note") else "") + '</div>' if sysc else "")
              + '<div class="dtx">' + (f'<span class="dk">{" · ".join(esc(a["label"]) for a in acc)}</span>' if acc else "")
              + f'<h2 class="dh">Their social media story</h2>' + (f'<p class="dd">{esc(soc["summary"])}</p>' if soc.get("summary") else "")
              + (f'<div class="dchips">{chips}</div>' if chips else "") + (f'<a class="dl" href="#watch-own">See their social media story →</a>' if has_own else "") + '</div></div>')
    doors = f'<div class="doors{" one" if not d2 else ""}" id="doors">{d1}{d2}</div>'
    # Watch the business
    watch = ""
    if vids:
        iv = [v for v in vids if v.get("kind") != "own"]; own = [v for v in vids if v.get("kind") == "own"]
        grp = lambda t, L, id_: (f'<div class="wgrp"{f" id={chr(34)}{id_}{chr(34)}" if id_ else ""}><h3>{t}</h3><div class="wrow">' + "".join(video_card(v, vsub(v)) for v in L) + '</div></div>') if L else ""
        watch = (f'<section class="watch" id="watch"><div class="shd"><h2>Watch the business</h2><span>Interviews about {esc(name)}, and videos from {esc(name)} itself</span></div>'
                 + grp("Interviews and breakdowns", iv, "") + grp("From their own channels", own, "watch-own") + '</section>')
    fitsec = ""
    if len(fit) == 3:
        qs = "".join(f'<div class="fq" data-fq><span>{esc(q)}</span><div class="fyn" role="group" aria-label="{esc(q)}"><button type="button" data-yn="1" aria-pressed="false">Yes</button><button type="button" data-yn="0" aria-pressed="false">No</button></div></div>' for q in fit)
        fitsec = (f'<section class="fit" id="fit" data-fit="{slug}"><div class="fitl"><h2>Is {esc(name)} a good reference for your project?</h2>'
                  f'<p>Answer three quick questions. If it fits, pin {esc(name)} to your saved stories so it is there when you plan your next step.</p></div>'
                  f'<div class="fitr">{qs}<div class="fsum"><span data-fsum>So far: <b>answer the questions</b></span><button class="bw" type="button" data-pin-ref="{slug}">Pin to my project</button></div></div></section>')
    # sources and fact checks: every number above traces back here
    srow = lambda x: ((f'<a class="srw" href="{esc(x["url"])}" target="_blank" rel="noopener">' if x.get("url") else '<div class="srw">')
                      + f'<b>{esc(x["name"])}{" ↗" if x.get("url") else ""}</b><small>{esc(x.get("what", ""))}</small><span>{esc(x["date"])}</span>{lbt(x["label"])}' + ("</a>" if x.get("url") else "</div>"))
    fcs = "".join(f'<div class="sfc"><p><b>Said:</b> {esc(f["claim"])}</p><p><b>Found:</b> {esc(f["found"])}</p><small>{lbt(f["label"])} · {esc(f.get("who") or B.src_name(f))} · {esc(f["date"])}</small></div>' for f in S["fact_checks"])
    sources = (f'<section class="ssrc" id="sources"><div class="ssh"><h2>Sources</h2><span>Where every number on this page comes from: {len(S["sources"])} sources, each with its label and the date we read it</span></div>'
               f'<div class="ssb"><div class="srl">{"".join(srow(x) for x in S["sources"])}</div><h3 id="facts">Fact check</h3>{fcs}'
               f'<button type="button" class="stl" data-report="{esc(slug)}">Report a mistake</button></div></section>')
    return f'<div class="sty shome" data-story="{slug}">{hero}{numbers}{doors}{watch}{fitsec}{sources}</div>'


# ------------------------------------------------------------------ chapter (lesson) page
def chapter_body(S, i, cover, pi):
    B.set_srcmap(S); slug, name = S["slug"], S["name"]; P = S["phases"]; n = len(P); p = P[i]; k = i + 1
    base = f"/app/story/{slug}/"
    vids = {v["id"]: v for v in S.get("videos") or [] if v.get("id")}
    srcs = S["sources"]
    pnum = p.get("number") or []; pnum = [pnum] if isinstance(pnum, dict) else [x for x in pnum if isinstance(x, dict)]   # SCHEMA allows one object or a list
    ids = [j for j in (p.get("source_ids") or []) if isinstance(j, int) and 0 <= j < len(srcs)]
    if not ids:   # older stories: the sources the chapter's own numbers name
        for x in pnum:
            s = x.get("source") or ""
            j = next((j for j, so in enumerate(srcs) if s and (so.get("url") == s or so["name"] == s)), None)
            if j is not None and j not in ids: ids.append(j)
    csrc = [srcs[j] for j in ids]
    labels = [x.get("label") for x in pnum + (p.get("receipts") or []) + (p.get("results") or []) if x.get("label")]
    main_l = max(set(labels), key=labels.count) if labels else ""
    paras = [t for t in p["story"].split("\n\n") if t.strip()]
    refs = "".join(f'<a class="ref" href="#lsrc" aria-label="Source {m + 1}: {esc(s["name"])}">{m + 1}</a>' for m, s in enumerate(csrc))
    what = "".join(f'<p>{esc(t)}{(" " + refs) if refs and j == len(paras) - 1 else ""}</p>' for j, t in enumerate(paras))
    # The proof: receipts, else the chapter's own labelled notes as note cards
    rc = p.get("receipts") or [{"kind": "note", "text": x["v"], "caption": " · ".join(y for y in (B.src_name(x), x.get("date", "")) if y), "label": x.get("label"),
                                 "url": x.get("source") if str(x.get("source", "")).startswith("http") else ""} for x in pnum]
    def receipt(r):
        cap = f'<span class="rcp">{esc(r.get("caption", ""))}{" · " if r.get("caption") and r.get("label") else ""}{lbt(r.get("label"), dot=False)}</span>'
        if r.get("kind") != "note" and r.get("src"):
            inner = f'<span class="rimg"><img src="{esc(r["src"])}" alt="{esc(r.get("caption", ""))}" loading="lazy" decoding="async"></span>{cap}'
            cls = "rc img"
        else:
            plat = f'<i>{esc(r["platform"])}</i>' if r.get("platform") else ""
            inner = f'<span class="rnote">{plat}<b>{esc(r.get("text", ""))}</b></span>{cap}'; cls = "rc rnt"
        u = r.get("url") or ""
        return f'<a class="{cls}" href="{esc(u)}" target="_blank" rel="noopener">{inner}</a>' if u.startswith("http") else f'<div class="{cls}">{inner}</div>'
    proof = (f'<section class="lsec lproof"><div class="lsh"><h2>The proof</h2>{"<span>Click any receipt to open the original</span>" if any((r.get("url") or "").startswith("http") for r in rc) else ""}</div>'
             f'<div class="rcs">{"".join(receipt(r) for r in rc)}</div>') if rc else ""
    res = p.get("results") or []
    if res:
        proof = proof or '<section class="lsec lproof"><div class="lsh"><h2>The proof</h2></div>'
        proof += (f'<div class="lres"><span class="lrk">What happened next</span>' + "".join(f'<div><b>{esc(x["v"])}</b><small>{esc(" · ".join(y for y in (x.get("sub"), x.get("label"), x.get("date")) if y))}{"<br>" + src_link(x) if x.get("source") else ""}</small></div>' for x in res) + '</div>')
    if proof: proof += "</section>"
    why = f'<section class="lsec"><h2>Why it matters for you</h2><blockquote class="lq">{esc(p["lesson"])}</blockquote>' + "".join(f'<p class="lwhy">{esc(t)}</p>' for t in (p.get("why") or "").split("\n\n") if t.strip()) + '</section>'
    pv = [vids[v] for v in p.get("videos") or [] if v in vids]
    watch = (f'<section class="lsec"><h2>Watch it explained</h2><div class="lvids">{"".join(video_card(v, vsub(v), big=True) for v in pv)}</div></section>') if pv else ""
    st = p.get("steal") or {}
    items, key = (st.get("items") or [], f"lv-steal-{slug}-{k}") if st.get("items") else (None, f"lv-{slug}-checks")
    idx = None
    if items is None:   # fallback: the story checklist's own steps that come from this chapter (same ticks as the Checklists page)
        idx =[j for j, c in enumerate(S["checklist"]) if isinstance(c, dict) and c.get("from") == p["name"]]
        items = [S["checklist"][j]["text"] for j in idx]
    steal = ""
    if items:
        rows = "".join(f'<button class="stk" type="button" role="checkbox" aria-checked="false" data-i="{(idx[j] if idx else j)}"><span class="stbx">{CHK}</span><span class="stt">{esc(t)}</span></button>' for j, t in enumerate(items))
        steal = (f'<section class="steal" data-steal="{key}"><div class="sth"><div><b>{esc(st.get("title") or "Steal this: your steps from this chapter")}</b><span>Built from what they did. Tick it off as you go.</span></div>'
                 f'<button type="button" class="stl" data-copyall>Copy all</button></div><div class="sks">{rows}</div></section>')
    prev = (f'<a class="lprev" href="{base}{k - 1}/"><small>Previous</small><b>{esc(P[i - 1]["name"])}</b></a>' if k > 1
            else f'<a class="lprev" href="{base}"><small>Story home</small><b>{esc(name)}</b></a>')
    nxt = (f'<a class="lnext" href="{base}{k + 1}/" data-next="{k + 1}"><span><small data-nexthint>Next chapter</small><b>{esc(P[i + 1]["name"])}</b></span>{CHEV}</a>' if k < n
           else f'<a class="lnext" href="{base}"><span><small>You finished the story</small><b>Back to the story home</b></span>{CHEV}</a>')
    pnav = f'<nav class="lpn" aria-label="Chapters">{prev}{nxt}</nav>'
    # right rail
    nums = S["numbers"]; tm = [x for x in nums if "trustmrr" in (x.get("source") or "")] or nums[:1]
    big = tm[0]; small = tm[1:3]
    tsrc = big.get("source") or ""
    tcard = (f'<section class="rtm"><div class="rch"><b>{esc(B.src_name(big))}</b>{pill(big["label"])}</div><div class="rbig"><b>{esc(big["v"])}</b><small>{esc(big.get("long") or big["k"])} · {esc(big["date"])}</small></div>'
             + (f'<div class="rsm">{"".join(f"<div><b>{esc(x[chr(118)])}</b><small>{esc(x[chr(107)])}</small></div>" for x in small)}</div>' if small else "")
             + (f'<a class="rlink" href="{esc(tsrc)}" target="_blank" rel="noopener">{esc(host(tsrc))} ↗</a>' if tsrc.startswith("http") else "") + '</section>')
    L = S.get("links") or {}; gh_n = next((x for x in nums if "github" in (x.get("k") or "").lower()), None)
    web = []
    if L.get("github"): web.append(("github", "GitHub", re.sub(r"^https://github\.com/", "", L["github"]), L["github"], f'★ {gh_n["v"]}' if gh_n else "↗"))
    site = L.get("site") or S.get("site")
    if site: web.append(("site", "Website", host(site), site, "↗"))
    for kk in ("youtube", "x"):
        if L.get(kk): web.append((kk, B.SOCIAL[kk][0], "@" + host(L[kk]).split("/")[-1].lstrip("@"), L[kk], "↗"))
    rest = [B.SOCIAL[kk][0] for kk in B.SOCIAL if L.get(kk) and kk not in ("github", "youtube", "x")] + [o["name"] for o in L.get("other", [])]
    ico = lambda kk: WEB if kk == "site" else f'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{B.SOCIAL[kk][2]}</svg>'
    wrows = "".join(f'<a class="wr" href="{esc(u)}" target="_blank" rel="noopener"><span class="wi">{ico(kk)}</span><span class="wt"><b>{t}</b><small>{esc(sub)}</small></span><span class="wx">{esc(r)}</span></a>' for kk, t, sub, u, r in web)
    also = f'<p class="walso">Also on {esc(", ".join(rest[:-1]) + " and " + rest[-1] if len(rest) > 1 else rest[0])}</p>' if rest else ""
    around = f'<section class="raround"><h2>{esc(name)} around the web</h2>{wrows}{also}</section>' if wrows or also else ""
    slist = "".join(f'<li><span class="srn">{m + 1}</span><span><b>{esc(s["name"])}</b><small>{esc(s["date"])} · {esc(s["label"])}</small></span></li>' for m, s in enumerate(csrc))
    allsrc = f'<a class="rlink" href="{base}#sources">All {len(srcs)} sources and the fact check</a>'
    rsrc = f'<section class="rsrc" id="lsrc"><h2>Sources for this chapter</h2>' + (f'<ol>{slist}</ol>' if slist else "") + allsrc + '</section>'
    rail = f'<aside class="lref" aria-label="About {esc(name)}">{tcard}{around}{rsrc}</aside>'
    # phones: the rail folds into one card after the lesson (Paper Lesson · Phone)
    chips = "".join(f'<a class="dchip" href="{esc(u)}" target="_blank" rel="noopener">{t if kk != "github" or not gh_n else "GitHub ★ " + esc(gh_n["v"])}</a>' for kk, t, sub, u, r in web)
    mob = (f'<section class="lmob"><div class="lmh"><span><b>{esc(big["v"])} · {esc(big.get("long") or big["k"])}</b><small>{esc(B.src_name(big))} · {esc(big["date"])}</small></span>{pill(big["label"])}</div>'
           + (f'<div class="dchips">{chips}</div>' if chips else "")
           + f'<details class="lms"><summary><b>Sources for this chapter</b><span>{len(csrc)}</span></summary>' + (f'<ol>{slist}</ol>' if slist else "") + allsrc + '</details></section>')
    # left rail + phone/tablet chapter menu
    def chap(j, q):
        cur = j == i
        return (f'<a class="lch{" lcur" if cur else ""}" href="{base}{j + 1}/" data-ch="{j + 1}"{" aria-current=" + chr(34) + "page" + chr(34) if cur else ""}><span class="lcn">{j + 1:02d}</span>'
                f'<span class="lct"><b>{esc(q["name"])}{" <em>· Free</em>" if j == 0 else ""}</b><small>{esc(q["when"])}</small></span></a>')
    chl = "".join(chap(j, q) for j, q in enumerate(P))
    nck = len(S["checklist"])
    lrail = (f'<nav class="lrail" aria-label="Chapters"><b class="lrh">The {esc(name)} story</b>{chl}<div class="lrl"><a href="{base}#chart">The whole story in one chart</a>'
             f'<a href="/app/checklists/">Your checklist ({nck})</a></div></nav>')
    pm = read_min(p); kind = S.get("type_label") or S["category"]
    bar = (f'<div class="lsub"><a class="lbk" href="{base}" aria-label="Back to the {esc(name)} story home">{BACK}</a><span class="lblogo"><img src="{esc(S["logo"])}" alt="" width="28" height="28"></span>'
           f'<b class="lbn">{esc(name)}</b><span class="lbs">{esc(kind)} · {esc(S["pattern"])}</span>'
           f'<span class="lmeter" data-meter hidden><span class="lmb" aria-hidden="true">{"<i></i>" * 5}</span><span data-metert></span></span>'
           f'<span class="lsubc">Chapter {k} of {n} · {pm} min</span>'
           f'<details class="lchm"><summary>Chapters <span>{k}/{n}</span></summary><div class="lchmp">{chl}</div></details>'
           f'<button class="sstar ssm" type="button" data-star="{slug}" aria-pressed="false" aria-label="Save {esc(name)}">{STAR}<span class="sr">Save</span></button>'
           f'<span class="lprog" aria-hidden="true"><i style="width:{k / n * 100:.1f}%"></i></span></div>')
    head = (f'<header class="lhd"><span class="lck">Chapter {k} · {esc(p["when"])}</span><h1>{esc(p.get("title") or p["name"])}</h1>'
            + (f'<p class="ldek">{esc(p["dek"])}</p>' if p.get("dek") else "")
            + (f'<div class="llab">{pill(main_l)}<span>{"Sources are numbered on the right." if csrc else ""}</span></div>' if main_l else "") + '</header>')
    # the static page is a shell: the chapter's text never ships in public HTML. /api/lesson returns {html} (or {tease} when out of lessons) after the check
    tease = '<div class="ltease" data-tease hidden><h2>What happened</h2><p data-teaset></p></div>'
    retry = ('<div class="lretry" data-retry hidden><p>We couldn&#39;t load this chapter. Check your connection and try again.</p>'
             '<button type="button" class="bw" data-retrybtn>Try again</button></div>')
    gate = ('<section class="lgate" data-gate hidden><div class="lgh"><h2 data-gh>You\'ve read your free lessons this month</h2><p data-gs></p></div>'
            '<div class="lgopts"><a class="lgpro" href="/app/account/#plan" data-gpro><span><b data-gpt>Keep reading with Pro</b><small data-gpd>Every lesson in every story, and more assistant chats</small></span><span class="lgbtn" data-gpb>See Pro</span></a>'
            f'<a class="lgstu" href="/app/account/#student" data-gstu><span class="lgi">{CAP}</span><span><b>Student? Get 10 lessons a month, free</b><small>Verify a .edu email or a Canadian school, college or university email. Plus 50 chats a week.</small></span><span class="lgv">Verify email</span></a>'
            '<div class="lgw" data-gwait><span data-gwt>Happy to wait? We\'ll email you when your lessons reset.</span><button type="button" data-remind>Remind me</button></div></div></section>')
    content = f'<section class="lsec lwhat"><h2>What happened</h2>{what}</section>{proof}{why}{mob}{watch}{steal}{pnav}'
    shell_html = (f'<div class="sty les" data-lesson data-slug="{slug}" data-ch="{k}" data-n="{n}" data-state="wait">{bar}'
                  f'<div class="lgrid">{lrail}<article class="lart">{head}<div class="lbody" data-lbody aria-live="polite"></div>{tease}{retry}{gate}</article>{rail}</div></div>')
    return shell_html, content, (paras[0] if paras else "")


def pages(E, S, shell, cover, pi):
    """(story home html, [chapter shell html, ...], [{html, tease} per chapter for api/_lessons.js]) in the Vault shell."""
    name = S["name"]; base = f"/app/story/{S['slug']}/"; js = '\n<script src="/assets/newapp/story.js" defer></script>'
    home = shell(E, name, S["dek"], "story-" + S["slug"], home_body(S, cover, pi), crumbs=[("/app/library/", "Library"), ("", name)], scripts=js, og_slug=S["slug"])
    chs, private = [], []
    for i, p in enumerate(S["phases"]):
        body, content, tease = chapter_body(S, i, cover, pi)
        chs.append(shell(E, f'{p["name"]} · {name}', p.get("dek") or S["dek"], "story-" + S["slug"], body, crumbs=[(base, name), ("", p["name"])], scripts=js, og_slug=S["slug"]))
        private.append({"html": content, "tease": tease})
    return home, chs, private
