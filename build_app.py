"""Build the LaunchVault app (/app/) and every story page from data. No hand-editing of output.

Inputs (nothing else):
  ../design/data/stories/<slug>.json   one file per READY story (see SCHEMA.md); validated here
  ../design/data/stories.json          the 13 companies' TrustMRR numbers; any company without a story file stays "Coming soon"
  src/app/*.body.html                  static app page bodies (tokens filled here)
Outputs:
  app/**/index.html                    Home, Library, readers (/app/story/<slug>/, /app/postiz/ alias), coming-soon pages, path, checklists, account, start, not-found
  src/post-<slug>.body.html            public blog posts for ready stories (Postiz keeps its hand-made post; a generated copy goes to _gen/ for the parity check)
  src/index.body.html (posts block), src/blog.body.html (featured)   blog cards, newest first
  assets/covers/<slug>.png|.webp       covers for new stories
Then runs build.py (public pages) with the generated blog posts added.
Run:  python build_app.py            (publish one story: python publish_story.py <slug>)
"""
import json, math, os, re, html, glob, sys, shutil, subprocess
ROOT = os.path.dirname(os.path.abspath(__file__)); SRC = os.path.join(ROOT, "src")
DATA = os.path.join(ROOT, "..", "design", "data")
sys.path.insert(0, ROOT)
import build  # public shell: HEAD, nav, footer, og, PAGES

esc = html.escape
NL = chr(10)
MON = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()
LABELS = ["Verified", "Live", "Wayback", "Claimed", "Sources differ", "Couldn't verify", "Estimate"]
LBC = {"Verified": "v", "Live": "l", "Wayback": "w", "Claimed": "c", "Sources differ": "x", "Couldn't verify": "n", "Estimate": "e"}
TABS = {"ai": "AI tools", "mobile": "Mobile apps", "services": "Services"}
CAT1 = {"ai": "AI tool", "mobile": "Mobile app", "services": "Service"}
def money(v): return "${:,}".format(v)
def mlab(ym): y, m = ym.split("-"); return f"{MON[int(m) - 1]} {y}"
def dlab(d): y, m, dd = d.split("-"); return f"{MON[int(m) - 1]} {int(dd)} {y}"
def lb(l): return f'<span class="lb {LBC[l]}">{esc(l)}</span>' if l else ""
def prices(v):
    """Wayback prices: a list renders as chips, a string as one line of text."""
    if not v: return ""
    if isinstance(v, list): return '<div class="pr">' + "".join(f"<span>{esc(x)}</span>" for x in v) + "</div>"
    return f'<p class="prt"><b>Pricing</b> {esc(v)}</p>'
def latest_date(ds):
    """Newest 'Nov 18 2026' / 'Jan 2026' style date in ds, as written."""
    best = None
    for d in ds:
        for m in re.finditer(r"\b(" + "|".join(MON) + r")[a-z]*\.?\s+(?:(\d{1,2}),?\s+)?(\d{4})", d or ""):
            k = (int(m.group(3)), MON.index(m.group(1)), int(m.group(2) or 0))
            if not best or k > best[0]: best = (k, m.group(0))
    return best[1] if best else ""
def fc_summary(fcs):
    order = ["Verified", "Sources differ", "Couldn't verify", "Claimed", "Estimate", "Live", "Wayback"]
    n = {l: sum(f["label"] == l for f in fcs) for l in order}
    used = [l for l in order if n[l]]
    bar = "".join(f'<i class="{LBC[l]}" style="--w:{n[l]}"></i>' for l in used)
    txt = " · ".join(f"{lb(l)} {n[l]}" for l in used)
    return (f'<div class="fcsum" id="fcsum"><div class="fcbar" aria-hidden="true">{bar}</div>' + NL
            + f'      <p><b>{len(fcs)}</b> claim{"s" if len(fcs) != 1 else ""} checked: {txt}</p></div>')
def rd(p): return open(p, encoding="utf-8").read()
def wr(p, t):
    os.makedirs(os.path.dirname(p), exist_ok=True); tmp = p + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f: f.write(t)
    os.replace(tmp, p)
def ic(d, w=18): return f'<svg width="{w}" height="{w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{d}</svg>'
I = {"home": '<path d="M4 11l8-7 8 7v9H4z"/>', "lib": '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
     "path": '<circle cx="6" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><path d="M8 6h7a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h7"/>',
     "ck": '<path d="M10 6h10M10 12h10M10 18h10"/><path d="M4 6l1.2 1.2L7 5.2M4 12l1.2 1.2L7 11.2M4 18l1.2 1.2L7 17.2"/>',
     "acct": '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
     "srch": '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>', "chev": '<path d="M9 6l6 6-6 6"/>', "back": '<path d="M15 6l-6 6 6 6"/>',
     "lock": '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>', "ext": '<path d="M7 17L17 7M9 7h8v8"/>', "dev": '<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/>'}
LV = '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M19.99 14.91A8.5 8.5 0 1 1 10.52 3.63"/><path d="M6.8 15.6l3.7-3.7 2.6 2.6 6.7-6.7"/><path d="M16 7.8h3.8v3.8"/></g></svg>'
CHK = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'

# ============================================================ validation (shared with publish_story.py)
REQ = ["slug", "name", "category", "what", "logo", "published", "read_min", "title", "dek", "pattern", "numbers", "series", "phases", "moves", "fact_checks", "checklist", "sources"]
def validate(S, path=""):
    err = []
    for k in REQ:
        if k not in S or S[k] in (None, "", []): err.append(f"missing {k}")
    if err: return err
    if not re.fullmatch(r"[a-z0-9-]+", S["slug"]): err.append("slug must be lowercase letters, digits and dashes")
    if path and os.path.basename(path) != S["slug"] + ".json": err.append(f"file name must be {S['slug']}.json")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", S["published"]): err.append("published must be YYYY-MM-DD")
    def fact(f, where, need_date=True):
        if not isinstance(f, dict): err.append(f"{where}: not an object"); return
        if f.get("label") not in LABELS: err.append(f"{where}: label must be one of {LABELS} (got {f.get('label')!r})")
        if need_date and not f.get("date"): err.append(f"{where}: missing date")
        if not (f.get("source") or f.get("url")): err.append(f"{where}: missing source")
    for i, n in enumerate(S["numbers"]):
        if not n.get("k") or not n.get("v"): err.append(f"numbers[{i}]: needs k and v")
        fact(n, f"numbers[{i}]")
    se = S["series"]
    if not isinstance(se.get("points"), list) or len(se["points"]) < 2: err.append("series.points: need at least 2 real points")
    else:
        for i, p in enumerate(se["points"]):
            if not (isinstance(p, list) and len(p) >= 2 and re.fullmatch(r"\d{4}-\d{2}", str(p[0])) and isinstance(p[1], (int, float))):
                err.append(f"series.points[{i}]: must be [\"YYYY-MM\", number, label?, source?]")
            elif len(p) > 2 and p[2] not in LABELS: err.append(f"series.points[{i}]: bad label {p[2]!r}")
        if not se.get("source"): err.append("series: missing source")
        if (se.get("label") or "") not in LABELS and not all(len(p) > 2 for p in se["points"]): err.append("series: missing label")
    for i, p in enumerate(S["phases"]):
        for k in ("name", "when", "story", "lesson"):
            if not p.get(k): err.append(f"phases[{i}]: missing {k}")
        nums = p.get("number") or []
        for j, n in enumerate(nums if isinstance(nums, list) else [nums]): fact(n, f"phases[{i}].number[{j}]")
    for i, m in enumerate(S["moves"]):
        if not m.get("text") or not m.get("when"): err.append(f"moves[{i}]: needs when and text")
        if m.get("at") and not re.fullmatch(r"\d{4}-\d{2}", m["at"]): err.append(f"moves[{i}].at must be YYYY-MM")
        fact(m, f"moves[{i}]", need_date=False)
    for i, f in enumerate(S["fact_checks"]):
        if not f.get("claim") or not f.get("found"): err.append(f"fact_checks[{i}]: needs claim and found")
        fact(f, f"fact_checks[{i}]")
    for k, f in (S.get("facts") or {}).items():
        if f and f.get("label"): fact(f, f"facts.{k}")
    for i, w in enumerate(S.get("wayback") or []):
        if not w.get("source") or not w.get("date") or not w.get("headline"): err.append(f"wayback[{i}]: needs date, headline and source")
    if len(S["checklist"]) < 3: err.append("checklist: need at least 3 items")
    for i, s in enumerate(S["sources"]):
        if not s.get("name") or not s.get("date") or s.get("label") not in LABELS: err.append(f"sources[{i}]: needs name, date and a label")
    logo = S["logo"]
    if logo.startswith("/") and not os.path.exists(os.path.join(ROOT, logo.lstrip("/"))): err.append(f"logo file not found: {logo}")
    for w in S.get("wayback") or []:
        if w.get("image") and not os.path.exists(os.path.join(ROOT, w["image"].lstrip("/"))): err.append(f"wayback image not found: {w['image']}")
    return err

MONI = {m: i + 1 for i, m in enumerate(MON)}
def ym(t):
    """'Dec 2025' / 'December 2025' / '2025-12' -> '2025-12'; None if it isn't a month."""
    t = str(t).strip()
    if re.fullmatch(r"\d{4}-\d{2}", t): return t
    m = re.fullmatch(r"([A-Za-z]{3})[a-z]*\.? (?:\d{1,2},? )?(\d{4})", t)
    return f"{m.group(2)}-{MONI[m.group(1).title()]:02d}" if m and m.group(1).title() in MONI else None
def normalize(S):
    """Accept the research files' natural forms (month names); never changes a value."""
    se = S.get("series") or {}
    for p in se.get("points") or []:
        if isinstance(p, list) and p and ym(p[0]): p[0] = ym(p[0])
    for p in se.get("alt") or []:
        if isinstance(p, list) and p and ym(p[0]): p[0] = ym(p[0])
    for m in S.get("moves") or []:
        if not m.get("at") and ym(m.get("when", "")): m["at"] = ym(m["when"])
    return S
def load_ready(strict=True):
    out = []
    for p in sorted(glob.glob(os.path.join(DATA, "stories", "*.json"))):
        S = normalize(json.load(open(p, encoding="utf-8"))); e = validate(S, p)
        if e:
            msg = f"{os.path.basename(p)}:\n  - " + "\n  - ".join(e)
            if strict: raise SystemExit("INVALID STORY " + msg)
            print("skipped (invalid) " + msg); continue
        out.append(S)
    hv = lambda S: (S.get("headline") or {}).get("value") or int(re.sub(r"[^0-9]", "", S["numbers"][0]["v"]) or 0)
    return sorted(out, key=lambda s: (s["published"], hv(s)), reverse=True)   # stale ones are moved after fresh ones of the same day in main()   # newest first; same day: biggest verified number first

# ============================================================ data model
def norm_soon(s):
    h = s["headline"]
    if h["measure"] == "revenue in month": hv, hu, hd = money(h["value"]), f' in {mlab(h["month"])}', dlab(s["monthly"]["read_on"]) if s.get("monthly") else ""
    else: hv, hu, hd = money(h["value"]), " MRR", dlab(h["date"])
    m = (s.get("monthly") or {}).get("months") or {}
    return {"slug": s["slug"], "name": s["company"], "tab": s["category"], "type": CAT1[s["category"]], "what": s.get("what", ""),
            "logo": "/" + s["logo"].replace("site/", ""), "pattern": PATTERN.get(s["company"], "Pattern not checked yet"), "lessons": [],
            "hv": hv, "hu": hu, "hl": h["label"], "hd": hd, "hsrc": s.get("trustmrr_url", ""), "status": "soon", "stale": f'Stale · last synced {dlab(s["mrr"]["date"])}' if s.get("stale") and s.get("mrr") else "",
            "href": f"/app/story/{s['slug']}/", "read": 0, "published": "", "mrr": (s.get("mrr") or {}).get("value", 0),
            "sub": f'MRR {money(s["mrr"]["value"])} · {dlab(s["mrr"]["date"])}' if s.get("mrr") else "",
            "series": [[k, m[k]] for k in sorted(m)], "raw": s}
# patterns for coming-soon companies come from the homepage story cards (one line each, already public)
PATTERN = {"Stencil AI": "Start with a problem someone close to you has", "Windmill Growth": "Sell a service before you build an app",
           "Gojiberry": "Ask for money early", "DM Champ": "Price for buyers, not testers"}
def norm_ready(S, legacy):
    h = S.get("headline") or {}
    hv = money(h["value"]) if "value" in h else S["numbers"][0]["v"]
    k0 = h.get("k") or S["numbers"][0]["k"]
    hu = " MRR" if k0 == "MRR" else (" in " + k0[len("Revenue in "):]) if k0.startswith("Revenue in ") else " · " + k0
    mrr = h.get("value", 0) if h.get("k") == "MRR" else ((legacy.get("mrr") or {}).get("value", 0) if legacy else 0)
    hl, hd = h.get("label", S["numbers"][0]["label"]), h.get("date", S["numbers"][0]["date"])
    sub = ""
    if legacy and legacy.get("headline", {}).get("measure") == "revenue in month":
        lh = legacy["headline"]; hv, hu, hl = money(lh["value"]), f' in {mlab(lh["month"])}', lh["label"]
        hd = dlab(legacy["monthly"]["read_on"]) if legacy.get("monthly") else hd
        if legacy.get("mrr"): sub = f'MRR {money(legacy["mrr"]["value"])} · {dlab(legacy["mrr"]["date"])}'
    stale = f'Stale · last synced {dlab(legacy["mrr"]["date"])}' if legacy and legacy.get("stale") and legacy.get("mrr") else ""
    if stale: hd = dlab(legacy["mrr"]["date"])   # a stale headline carries the last sync date everywhere (quiz, Library, reader)
    tab = S.get("tab") if "tab" in S else {"AI tool": "ai", "Mobile app": "mobile", "Service": "services"}.get(S["category"])
    return {"slug": S["slug"], "name": S["name"], "tab": tab, "type": S.get("type_label") or S["category"], "what": S["what"], "logo": S["logo"],
            "pattern": S["pattern"], "lessons": [p["lesson"] for p in S["phases"]], "hv": hv, "hu": hu, "hl": hl, "sub": sub,
            "hd": hd, "hsrc": h.get("source", S["numbers"][0].get("source", "")), "status": "ready", "stale": stale,
            "href": f"/app/story/{S['slug']}/", "read": S["read_min"], "published": S["published"],
            "mrr": mrr, "series": [[p[0], p[1]] for p in S["series"]["points"]], "title": S["title"], "S": S}
def growth(series):
    """Average monthly growth between the first and last real point (compound). None when it can't be computed."""
    if len(series) < 2 or series[0][1] <= 0: return None
    a, b = series[0], series[-1]
    y1, m1 = map(int, a[0].split("-")); y2, m2 = map(int, b[0].split("-")); n = (y2 - y1) * 12 + m2 - m1
    return round(((b[1] / a[1]) ** (1 / n) - 1) * 100, 1) if n > 0 else None

def spark(series, cls="spark", name=""):
    if len(series) < 2: return '<span class="noser">No monthly series</span>'
    vs = [v for _, v in series]; top = max(vs) or 1; n = len(vs)
    lab = esc(f"{name} revenue each month, {mlab(series[0][0])} to {mlab(series[-1][0])}: " + ", ".join(money(v) for v in vs)) if name else ""
    pts = [(2 + i * 236 / (n - 1), 34 - v / top * 30) for i, v in enumerate(vs)]
    ln = "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in pts)
    return f'<svg class="{cls}" viewBox="0 0 240 36" preserveAspectRatio="none" {f'role="img" aria-label="{lab}"' if lab else 'aria-hidden="true"'}><path class="ar" d="{ln} L{pts[-1][0]:.1f} 36 L2 36 Z"/><path class="ln" d="{ln}"/></svg>'

# ============================================================ shell
SIDE_SOON = ["dm-champ", "stencil-ai", "windmill-growth", "gojiberry"]
def head(title, desc, extra="", og_slug=""):
    og = (NL + f'<meta property="og:title" content="{esc(title)}">' + NL + f'<meta property="og:description" content="{esc(desc)}">' + NL
          + f'<meta property="og:image" content="https://launchvault-site.vercel.app/assets/covers/{og_slug}.png">') if og_slug else ""
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<meta name="robots" content="noindex">{og}
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/assets/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#2563EB">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:ital,wght@0,400;0,500;0,600;0,700;1,600;1,700&family=Inter+Tight:wght@400;500;600&display=swap">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:ital,wght@0,400;0,500;0,600;0,700;1,600;1,700&family=Inter+Tight:wght@400;500;600&display=swap">
<link rel="stylesheet" href="/assets/app.css">{extra}
</head>
'''
def shell(E, title, desc, active, body, crumbs=None, wide=False, scripts="", og_slug=""):
    ready = [e for e in E if e["status"] == "ready"]; week = next((e for e in ready if not e["stale"]), ready[0])
    byslug = {e["slug"]: e for e in E}
    nav = [("home", "/app/", "Home", ""), ("lib", "/app/library/", "Library", ""), ("path", "/app/path/", "My path", '<span class="cnt" data-cnt="path"></span>'),
           ("ck", "/app/checklists/", "Checklists", '<span class="cnt" data-cnt="ck"></span>')]
    cur = lambda k: ' aria-current="page"' if k == active else ""
    side = "".join(f'<a class="si" href="{h}"{cur(k)}>{ic(I[k])}<span class="t">{t}</span>{c}</a>' for k, h, t, c in nav)
    soon = "".join(f'<a class="si co soon" href="{byslug[s]["href"]}"><img class="lgo" src="{byslug[s]["logo"]}" alt="" width="16" height="16" loading="lazy"><span class="t">{esc(byslug[s]["name"])}</span><span class="cnt">{"Stale" if byslug[s]["stale"] else "Soon"}</span></a>'
                   for s in [e["slug"] for e in E if e["status"] == "soon"][:4])
    wk = f'<a class="si week" href="{week["href"]}"{cur("story-" + week["slug"])}><img class="lgo" src="{week["logo"]}" alt="" width="16" height="16"><span class="t">{esc(week["name"])}</span><span class="cnt pc" data-pct="{week["slug"]}"></span></a>'
    tabs = "".join(f'<a href="{h}"{cur(k)}>{ic(I[k], 22)}<span>{t}</span></a>' for k, h, t, _ in nav) + f'<a href="/app/account/"{cur("acct")}>{ic(I["acct"], 22)}<span>Account</span></a>'
    ttl = (" ".join(f'<a href="{h}">{esc(t)}</a><span class="sep">/</span>' for h, t in crumbs[:-1]) + f'<span>{esc(crumbs[-1][1])}</span>') if crumbs else f"<span>{esc(title)}</span>"
    return (head(title + " · LaunchVault", desc, '\n<link rel="stylesheet" href="/assets/chart.css">' if "chart.js" in scripts else "", og_slug) + f'''<body{' class="has-back"' if crumbs else ""}>
<a class="skip" href="#main">Skip to content</a>
<div class="shell">
<aside class="side" aria-label="App">
  <a class="brand" href="/app/" aria-label="LaunchVault app home">{LV}<span>LaunchVault</span></a>
  <nav aria-label="Main">{side}</nav>
  <p class="sgrp">This week</p>{wk}
  <div class="soonlist"><p class="sgrp">Coming soon</p>{soon}</div>
  <div class="foot"><div class="plan">Free plan <a href="/app/account/#plan">Upgrade</a></div><a class="si" href="/app/account/"{cur("acct")}>{ic(I["acct"])}<span class="t">Account</span></a></div>
</aside>
<div class="main">
  <div class="prev" id="prevbar" role="status">Preview: accounts open soon. Your progress stays on this device.</div>
  <header class="top">
    {f'<a class="mback" href="{crumbs[0][0]}" aria-label="Back to {esc(crumbs[0][1])}">' + ic(I["back"], 22) + '</a>' if crumbs else ""}<a class="mlogo" href="/app/" aria-label="LaunchVault app home">{LV}</a>
    <div class="ttl">{ttl}</div>
    <button class="srch" type="button" data-cmd>{ic(I["srch"], 16)}<span>Search breakdowns</span><kbd>⌘K</kbd></button>
    <a class="chip" href="/app/account/#plan">Free <small>plan</small></a>
    <button class="ibtn" type="button" data-cmd aria-label="Search">{ic(I["srch"], 20)}</button>
  </header>
  <main id="main">
{body}
  </main>
</div>
</div>
<nav class="tabs" aria-label="App tabs">{tabs}</nav>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<script type="application/json" id="lvapp">{json.dumps(APPDATA, separators=(",", ":"))}</script>
<script src="/assets/auth.js" defer></script>
<script src="/assets/app.js" defer></script>{scripts}
</body>
</html>
''')

# ============================================================ reader (one story JSON -> the app reader)
def nbox(nums):
    nums = nums if isinstance(nums, list) else [nums]
    return ('<div class="nbox">' + "".join(f'<div><span>{esc(n["v"])}</span><span class="s">{lb(n["label"])}{esc(src_name(n))} · {esc(n["date"])}</span></div>' for n in nums) + "</div>") if nums else ""
SRCMAP = {}
def src_name(f):
    s = f.get("source") or f.get("url") or ""
    if s.startswith("http") and s in SRCMAP: return SRCMAP[s]
    if s.startswith("http"):
        d = re.sub(r"^https?://(www\.)?", "", s).split("/")[0]
        return {"trustmrr.com": "TrustMRR", "github.com": "GitHub", "web.archive.org": "Wayback Machine"}.get(d, d)
    return s
def mark_mrr(S):
    """A series point that is really the MRR headline (not that month's revenue) gets kind 'MRR', so the chart and table say so."""
    mrr = {re.sub(r"[^0-9]", "", n["v"]) for n in S.get("numbers", []) if re.search(r"MRR|recurring", n.get("k", "") + n.get("long", ""), re.I)}
    if re.search(r"MRR|recurring", S["series"].get("what", ""), re.I): return
    kind = {p[0]: "MRR" for p in S["series"]["points"] if str(p[1]) in mrr}
    if kind: S["series"]["kind"] = kind
def chart_table(S):
    mark_mrr(S); kd = S["series"].get("kind") or {}
    dsrc = S["series"].get("source", "")
    rows = [(p[0], p[1], p[2] if len(p) > 2 else S["series"].get("label", ""), (p[3] if len(p) > 3 else "") or dsrc) for p in S["series"]["points"]]
    rows += [(p[0], p[1], p[2] if len(p) > 2 else "Sources differ", (p[3] if len(p) > 3 else "") + " (second source)") for p in S["series"].get("alt", [])]
    rows.sort(key=lambda r: r[0])
    pd = S["series"].get("point_dates") or {}
    return ('<details class="ctab"><summary>Show as table</summary><table><caption class="sr">' + esc(S["name"]) + ": " + esc(S["series"]["what"].lower()) + '</caption>'
            '<thead><tr><th scope="col">Month</th><th scope="col">Value</th><th scope="col">Label</th><th scope="col">Source</th></tr></thead><tbody>'
            + "".join(f'<tr><th scope="row">{esc(pd.get(m) or mlab(m))}{(" (" + kd[m] + ")") if m in kd else ""}</th><td>{money(v)}</td><td>{lb(l)}</td><td>{esc(src_name({"source": sr}) if sr else "")}</td></tr>' for m, v, l, sr in rows)
            + "</tbody></table></details>")
def chart_block(S, moves_list=True, band=True):
    mark_mrr(S)
    data = {"series": S["series"], "moves": [m for m in S["moves"]]}
    for i, p in enumerate(S["phases"]):
        for n in p.get("moves", []):
            if p.get("turn") and 0 < n <= len(data["moves"]): data["moves"][n - 1] = {**data["moves"][n - 1], "turn": True}
    legend = '<span><i class="lv"></i>Verified</span><span><i class="lc"></i>Claimed</span>' + ('<span><i class="lx"></i>Sources differ</span>' if any((p[2] if len(p) > 2 else "") == "Sources differ" for p in S["series"]["points"] + S["series"].get("alt", [])) else "") + ('<span><i class="lm">1</i>Founder\'s move</span>' if S["moves"] else "")
    last = S["series"]["points"][-1]
    ml = ""
    if moves_list and S["moves"]:
        ml = f'<div class="mvh"><b>All {len(S["moves"])} moves</b><span>Tap one to move the chart</span></div><ol class="moves">' + "".join(f'<li><button type="button" data-i="{i}" class="{"turn" if data["moves"][i].get("turn") else ""}"><span class="n">{i + 1}</span><span>{esc(m["text"])}</span><span class="w">{esc(m["when"])}</span></button></li>' for i, m in enumerate(S["moves"])) + "</ol>"
    bd = ""
    if band:
        bd = '<div class="pband" role="group" aria-label="Phases">' + "".join(f'<button type="button" data-ph="{i + 1}" aria-pressed="false" title="{esc(p["name"])}, {esc(p["when"])}">{esc(p.get("short") or p["name"])}</button>' for i, p in enumerate(S["phases"])) + "</div>"
    return (f'<div class="chartc lvchart"><div class="hd"><div><div class="big">{money(last[1])}<small>{esc(S["series"]["what"].lower())}</small></div>'
            f'<div class="legend">{legend}</div></div></div><div class="readout" aria-live="polite"></div>'
            f'<div class="plot"><svg role="img" aria-label="{esc(S["name"])}: {esc(S["series"]["what"].lower())}, ' + ", ".join(f"{mlab(p[0])} {money(p[1])}" for p in S["series"]["points"]) + f'"></svg></div>'
            f'{bd}{ml}{chart_table(S)}<p class="cprov">{esc(S["series"].get("note") or "Points carry their own labels. Hover or tap the line for the month, the value and where it came from.")}</p>'
            f'<script type="application/json" class="lvchart-data">{json.dumps(data, separators=(",", ":"))}</script></div>')

SRC_LOGO = [("trustmrr.com", "trustmrr.png"), ("stripe.com", "stripe.svg"), ("github.com", "github.svg"), ("web.archive.org", "internetarchive.png"), ("archive.org", "internetarchive.png"),
            ("starterstory.com", "starterstory.png"), ("mixergy.com", "mixergy.png"), ("dev.to", "devto.png"), ("news.ycombinator.com", "hackernews.svg"), ("ycombinator.com", "hackernews.svg"),
            ("producthunt.com", "producthunt.png"), ("reddit.com", "reddit.png"), ("youtube.com", "youtube.png"), ("youtu.be", "youtube.png"), ("x.com", "x.png"), ("twitter.com", "x.png"),
            ("indiehackers.com", "indiehackers.png"), ("superframeworks.com", "superframeworks.png"), ("apps.apple.com", "apple.svg"), ("itunes.apple.com", "apple.svg")]
SRC_NAME_LOGO = [("TrustMRR", "trustmrr.png"), ("Wayback", "internetarchive.png"), ("Dev.to", "devto.png"), ("DEV", "devto.png"), ("Mixergy", "mixergy.png"),
                 ("Superframeworks", "superframeworks.png"), ("Starter Story", "starterstory.png"), ("GitHub", "github.svg"), ("Hacker News", "hackernews.svg"), ("Product Hunt", "producthunt.png")]
LINK_ICON = '<span class="srcic" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg></span>'
def src_logo(s, cls="", w=20):
    u = (s.get("url") or "").lower(); dom = re.sub(r"^https?://(www\.)?", "", u).split("/")[0]
    f = next((lg for d, lg in SRC_LOGO if dom == d or dom.endswith("." + d)), None) if dom else None
    if not f and not u: f = next((lg for k, lg in SRC_NAME_LOGO if k.lower() in s["name"].lower()), None)
    return f'<img{cls} src="/assets/logos/{f}" alt="" width="{w}" height="{w}" loading="lazy" decoding="async">' if f else LINK_ICON
def set_srcmap(S):
    SRCMAP.clear(); SRCMAP.update({x["url"]: x["name"] for x in S["sources"] if x.get("url")})
def reader(E, S, gate=True):
    set_srcmap(S); slug = S["slug"]; n = len(S["phases"])
    me = next((e for e in E if e["slug"] == slug), {}); stale_chip = f'<span class="lb n">{esc(me["stale"])}</span>' if me.get("stale") else ""
    nums = "".join(f'<div><span class="k">{esc(x["k"])}</span><span class="val">{esc(x["v"])}</span><span class="m">{lb(x["label"])}{esc(x["date"])}</span></div>' for x in S["numbers"][:5])
    hl = ""
    if S.get("highlights"):
        hl = (f'<section class="rsec" id="two"><div class="sh"><h2>The {len(S["highlights"])} moves that mattered</h2></div><div class="hl2">' + "".join(
            f'<div class="hlc"><h3><i>{h["move"]}</i>{esc(h["title"])}</h3><p>{esc(h["text"])}</p>' + (f'<p class="q">{esc(h["quote"])}</p>' if h.get("quote") else "")
            + f'<span class="src">{lb(h["label"])}{esc(h.get("source", ""))}{(" · " + esc(h["date"])) if h.get("date") else ""}</span></div>' for h in S["highlights"]) + "</div></section>")
    def phase(i, p):
        mv = "".join(f'<i class="{"turn" if p.get("turn") else ""}">{k}</i>' for k in p.get("moves", []))
        body = "".join(f"<p>{esc(t)}</p>" for t in p["story"].split("\n\n"))
        return (f'<div class="ph" id="ph{i + 1}" data-ph="{i + 1}"><span class="pn">{i + 1}</span><div><div class="phh"><h3>{esc(p["name"])}</h3><span class="when">{esc(p["when"])}</span><span class="mvn">{mv}</span></div>'
                f'<div class="body">{body}</div>{nbox(p.get("number") or [])}<p class="lesson"><b>Lesson.</b> {esc(p["lesson"])}</p></div></div>')
    phases_free = phase(0, S["phases"][0])
    phases_rest = "".join(phase(i, p) for i, p in enumerate(S["phases"]) if i)
    tn = ""
    if S.get("wayback"):
        def snap(w):
            img = f'<picture><source srcset="{w["image"].replace(".png", ".webp")}" type="image/webp"><img src="{w["image"]}" alt="{esc(S["name"])} homepage, {esc(w["date"])}" width="800" height="450" loading="lazy" decoding="async"></picture>' if w.get("image") else ""
            pr = prices(w.get("prices"))
            link = "Open snapshot" if "archive.org" in w["source"] else "Open site"
            return (f'<div class="snap"><div class="sb"><img src="{S["logo"]}" alt="" width="16" height="16"><span>{esc(re.sub(r"^https?://(www\.)?", "", S.get("site", "")).strip("/"))} · {esc(w["date"])}</span>{lb(w.get("label", "Wayback"))}</div>'
                    f'{img}<p class="hl">"{esc(w["headline"])}"</p><p class="sp">{esc(w.get("sub", ""))}</p>{pr}<div class="ft"><span>{esc(w.get("prices_date", ""))}</span><a href="{esc(w["source"])}" target="_blank" rel="noopener">{link} ↗</a></div></div>')
        tn = f'<section class="rsec" id="then"><div class="sh"><h2>Then and now</h2><span class="meta">{esc(S.get("wayback_note", ""))}</span></div><div class="tnow">' + "".join(snap(w) for w in S["wayback"]) + "</div></section>"
    cnt = {}
    for f in S["fact_checks"]: cnt[f["label"]] = cnt.get(f["label"], 0) + 1
    fc = (f'<section class="rsec" id="facts"><div class="sh"><h2>Fact check</h2><span class="meta">{len(S["fact_checks"])} claims · Checked {esc(S.get("fact_checks_read") or latest_date(s["date"] for s in S["sources"]))} · '
          + " · ".join(f"{k} {v}" for k, v in cnt.items()) + '</span></div><div class="fct" role="table" aria-label="Fact check">'
          + '<div class="fr th" role="row"><span>Claim</span><span>What we found</span><span>Label</span></div>'
          + "".join(f'<div class="fr" role="row"><span class="c1">{esc(f["claim"])}</span><span>{esc(f["found"])}<span class="src">{esc(f.get("who") or src_name(f))} · {esc(f["date"])}</span></span><span>{lb(f["label"])}</span></div>' for f in S["fact_checks"])
          + '</div><p class="fnote">If we get a number wrong, we fix it here and note the change.</p></section>')
    ckey = f"lv-{slug}-checks"
    cl = [c if isinstance(c, dict) else {"id": f"c{i + 1}", "text": c, "from": ""} for i, c in enumerate(S["checklist"])]
    ck = (f'<section class="rsec" id="todo"><div class="sh"><h2>What you could do at 15 to 20</h2><span class="meta" data-school="Low cost">Low cost, fits around school</span></div>'
          f'<div class="ckl" data-store="{ckey}" data-slug="{slug}"><div class="ckh"><span class="ckp">0 of {len(cl)}</span><span class="bar"><i></i></span><span class="dev">{ic(I["dev"], 14)}On this device</span></div>'
          + "".join(f'<button class="ck" type="button" role="checkbox" aria-checked="false"><span class="bx">{CHK}</span><span class="ct">{esc(c["text"])}</span><span class="cf">{esc(c.get("from", ""))}</span></button>' for c in cl)
          + '<div class="ckf"><span>Ticks stay on this device. Pro saves them to your account.</span><a href="/app/account/#plan">See Pro</a></div></div></section>')
    src = (f'<section class="rsec" id="sources"><div class="sh"><h2>Sources</h2><span class="meta">Free for everyone</span></div><div class="srcl">'
           + "".join((f'<a class="sr2" href="{esc(s["url"])}" target="_blank" rel="noopener">' if s.get("url") else '<div class="sr2">')
                     + src_logo(s) + f'<span><b>{esc(s["name"])}</b><small>{esc(s.get("what", ""))}</small></span><span class="dt">{esc(s["date"])}</span>{lb(s["label"])}'
                     + (f'<span class="ext">{ic(I["ext"], 14)}</span></a>' if s.get("url") else '<span class="ext"></span></div>') for s in S["sources"])
           + f'</div><div class="rfoot"><span>Breakdowns by LaunchVault. Not financial advice.</span><span>Last checked {esc(S["numbers"][0]["date"])}</span></div></section>')
    gate_html = (f'<div class="gate" id="gate"><h3>{ic(I["lock"], 18)}The rest of this breakdown is on Pro</h3><p>Phase 1, the numbers, the chart and the Sources stay free.</p>'
                 f'<div class="lk"><small>Locked on Free</small>Phases 2 to {n} · Then and now · Fact check</div>'
                 '<div class="acts"><a class="btn btn-p" href="/app/account/#plan">Get Pro</a><a class="btn btn-s" href="/app/account/#parent">Under 18? Send a parent link</a></div>'
                 '<p class="fine">$5 a month · $4 billed yearly · placeholder. Cancel any time.</p></div>')
    rest = f'<div id="locked" data-locked="1" hidden>{phases_rest}{tn}{fc}</div>'
    teaser = f'<div class="gatewrap"><div class="fade" aria-hidden="true">{phase(1, S["phases"][1])}</div>{gate_html}</div>' if n > 1 else ""
    L = lambda h: "#gate" if gate and h != "#ph1" else h   # locked parts point at the Pro gate
    lk = lambda h: f' <span class="lkic" title="On Pro"><span class="sr">on Pro</span>{ic(I["lock"], 11)}</span>' if L(h) == "#gate" else ""
    rail_ph = "".join(f'<a class="sub" href="{L(f"#ph{i + 1}")}" data-r="ph{i + 1}">{i + 1} {esc(p.get("short") or p["name"])}{lk(f"#ph{i + 1}")}</a>' for i, p in enumerate(S["phases"]))
    rail = (f'<aside class="rail" aria-label="In this breakdown"><div><div class="rh2">In this breakdown<span data-readpct>0% read</span></div><div class="rbar"><i data-readbar></i></div>'
            f'<nav><a href="#numbers" data-r="numbers">Numbers</a><a href="#chart" data-r="chart">Why the line moved</a>' + ('<a href="#two" data-r="two">The 2 moves</a>' if hl else "")
            + f'<a href="#phases" data-r="phases">Phase by phase</a>{rail_ph}' + (f'<a href="{L("#then")}" data-r="then">Then and now{lk("#then")}</a>' if tn else "")
            + f'<a href="{L("#facts")}" data-r="facts">Fact check{lk("#facts")}</a><a href="#sources" data-r="sources">Sources</a><a href="#todo" data-r="todo">What you could do</a></nav></div>'
            f'<div class="rbox"><div class="rh2">Your checklist<span data-ckc="{slug}">0 of {len(cl)}</span></div><div class="bar" style="margin-top:8px"><i data-ckbar="{slug}"></i></div><p data-cknext="{slug}"></p></div></aside>')
    mph = (f'<div class="mph"><button class="phb" type="button" data-sheet="phsheet"><em>Phase <span data-curph>1</span></em> · <span data-curname>{esc(S["phases"][0]["name"])}</span> <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>'
           f'<button class="ckb" type="button" data-sheet="cksheet">Checklist <b data-ckc="{slug}">0/{len(cl)}</b></button></div>')
    sheets = (f'<div class="sheet" id="phsheet" role="dialog" aria-modal="true" aria-label="Phases" hidden><div class="grab"></div><h2>Phases</h2><div class="sbody phl">'
              + "".join(f'<button type="button" data-goph="{i + 1}"><span class="i">{i + 1}</span>{esc(p["name"])}<span class="r"></span></button>' for i, p in enumerate(S["phases"]))
              + '<div class="jumps">' + (f'<a class="btn btn-s sm" href="{L("#then")}" data-close>Then and now</a>' if tn else "") + f'<a class="btn btn-s sm" href="{L("#facts")}" data-close>Fact check</a><a class="btn btn-s sm" href="#sources" data-close>Sources</a></div></div></div>'
              f'<div class="sheet" id="cksheet" role="dialog" aria-modal="true" aria-label="Checklist" hidden><div class="grab"></div><h2>What you could do at 15 to 20</h2><div class="sbody" data-ckmirror="{slug}"></div></div>')
    title = S["title"]; em = S.get("title_em")
    t_html = esc(title[:-len(em.rstrip("."))]) + f'<em class="em">{esc(em.rstrip("."))}</em>' if em and title.endswith(em.rstrip(".")) else esc(title)
    art = (f'{mph}<div class="rh"><span class="logo big"><img src="{S["logo"]}" alt="" width="36" height="36"></span><div><h1>{t_html}</h1><p class="dek">{esc(S["dek"])}</p>'
           f'<div class="rmeta">{stale_chip}<span>By LaunchVault</span><span>{len(S["sources"])} sources</span><span>{S["read_min"]} min</span><span>Last checked {esc(S["numbers"][0]["date"])}</span><a href="mailto:?subject=LaunchVault%20report%3A%20{esc(slug)}">Report a mistake</a></div></div></div>'
           f'<section class="rsec" id="numbers" style="margin-top:20px"><div class="nums5">{nums}</div></section>'
           f'<section class="rsec" id="chart"><div class="sh"><h2>Why the line moved</h2><span class="meta">{esc(S["series"]["what"])}</span></div>{chart_block(S)}</section>'
           f'{hl}<section class="rsec" id="phases"><div class="sh"><h2>Phase by phase</h2><span class="meta">{n} phases · each ends with one lesson</span></div>{phases_free}{teaser if gate else ""}</section>'
           + (rest if gate else f'<div>{phases_rest}{tn}{fc}</div>') + f'{src}{ck}')
    body = f'<div class="rprog"><i data-readbar2></i></div><div class="rd" data-reader="{slug}" data-phases="{n}"><article>{art}</article>{rail}</div>{sheets}'
    return shell(E, S["name"], S["dek"], "story-" + slug, body, crumbs=[("/app/library/", "Library"), ("", S["name"])], scripts='\n<script src="/assets/chart.js" defer></script>', og_slug=slug)

# ============================================================ coming-soon story page
def soon_page(E, e):
    s = e["raw"]; tiles = []
    h = s["headline"]
    if h["measure"] == "revenue in month": tiles.append(("Revenue in " + mlab(h["month"]), money(h["value"]), h["label"], e["hd"]))
    if s.get("mrr"): tiles.append(("MRR", money(s["mrr"]["value"]), s["mrr"]["label"], dlab(s["mrr"]["date"])))
    if s.get("alltime"): tiles.append(("Revenue, all-time", money(s["alltime"]["value"]), s["alltime"]["label"], dlab(s["alltime"]["date"])))
    nums = "".join(f'<div><span class="k">{esc(k)}</span><span class="val">{v}</span><span class="m">{lb(l)}{esc(d)}</span></div>' for k, v, l, d in tiles)
    know = []
    if s.get("stale"): know.append((f'TrustMRR last synced {dlab(s["mrr"]["date"])}. No newer verified revenue.', "Couldn't verify", "read " + dlab(s["mrr"]["read_on"]), s.get("trustmrr_url")))
    if s.get("claim"): know.append((f'The founder said {s["claim"]["text"]} ({s["claim"]["source"]})', s["claim"]["label"], mlab(s["claim"]["date"]), None))
    for k, t in (("first_customers", "First customers: "), ("team", "Team: ")):
        f = s.get(k)
        if isinstance(f, dict): know.append((t + f["text"], f.get("label"), (dlab(f["date"]) if len(f.get("date", "")) == 10 else mlab(f["date"]) if f.get("date") else ""), f.get("source")))
    know.append(("Revenue read by TrustMRR from " + s["payment_source"].replace(" (API key)", ""), "Verified", e["hd"], s.get("trustmrr_url")))
    kl = "".join(f'<div class="row"><span style="flex:1;min-width:0;color:#0B1220">{esc(t)}</span>{lb(l)}<span class="meta">{esc(d)}</span>'
                 + (f'<a class="tl" href="{esc(u)}" target="_blank" rel="noopener" aria-label="Source">↗</a>' if u and u.startswith("http") else "") + "</div>" for t, l, d, u in know)
    ch = ""
    if e["series"] and len(e["series"]) > 1:
        S = {"name": e["name"], "series": {"what": "Revenue each month", "label": "Verified", "source": s.get("trustmrr_url"), "points": [[k, v, "Verified", "TrustMRR, read from Stripe"] for k, v in e["series"]]},
             "moves": [], "phases": []}
        ch = f'<section class="rsec" id="chart"><div class="sh"><h2>Revenue each month</h2><span class="meta">TrustMRR, read from Stripe · read {esc(e["hd"])}</span></div>{chart_block(S, moves_list=False, band=False)}</section>'
    body = (f'<div class="rd" style="grid-template-columns:minmax(0,1fr)"><article><div class="rh"><span class="logo big"><img src="{e["logo"]}" alt="" width="36" height="36"></span><div>'
            f'<h1>{esc(e["name"])}</h1><p class="dek">{esc(e["what"])}</p><div class="rmeta"><span>{esc(e["type"])}</span><span>Breakdown coming soon</span>'
            + (f'<a href="{esc(s["trustmrr_url"])}" target="_blank" rel="noopener">TrustMRR page ↗</a>' if s.get("trustmrr_url") else "") + '</div></div></div>'
            f'<section class="rsec" style="margin-top:20px"><div class="nums5" style="grid-template-columns:repeat({len(tiles)},minmax(0,1fr))">{nums}</div></section>{ch}'
            f'<section class="rsec"><div class="sh"><h2>What we know so far</h2><span class="meta">Each fact with its label and date</span></div><div class="card">{kl}</div></section>'
            f'<section class="rsec"><div class="note dash">The full breakdown (phases, fact check and a checklist) lands here when it is out. The weekly email tells you when.<a class="tl" style="margin-left:auto" href="/app/library/">Back to the Library</a></div></section>'
            '</article></div>')
    return shell(E, e["name"], e["what"], "", body, crumbs=[("/app/library/", "Library"), ("", e["name"])], scripts='\n<script src="/assets/chart.js" defer></script>')

# ============================================================ home, library and the static pages
def home(E):
    ready = [e for e in E if e["status"] == "ready"]; W = next((e for e in ready if not e["stale"]), ready[0]); S = W["S"]; byslug = {e["slug"]: e for e in E}
    stats = "".join(f'<div><span class="k">{esc(x["k"])}</span><span class="val">{esc(x["v"])}</span><span class="m">{lb(x["label"])}{esc(x["date"])}</span></div>' for x in S["numbers"][1:4]) \
        + f'<div><span class="k">Sources</span><span class="val">{len(S["sources"])}</span><span class="m">each dated</span></div>'
    tags = "".join(f'<span class="tag">{esc(t)}</span>' for t in dict.fromkeys([S.get("type_label") or S["category"], S["category"], f'{S["read_min"]} min']) if t)
    week = (f'<section class="card"><div class="ch"><h2>This week\'s breakdown</h2><span class="meta">Published {esc(dlab(S["published"]))}</span></div>'
            f'<a class="nb" href="{W["href"]}" style="align-items:flex-start"><span class="logo"><img src="{W["logo"]}" alt="" width="28" height="28"></span><span style="flex:1;min-width:0"><h3>{esc(S["title"])}</h3><p class="what">{esc(S["what"])}</p><span class="fchips" style="margin-top:10px">{tags}</span></span>'
            f'<span style="width:240px;flex:none" class="hide-m"><span class="nums" style="display:flex;justify-content:space-between;align-items:center"><b style="font:600 18px var(--fn);color:#0B1220">{W["hv"]}</b>{lb(W["hl"])}</span>{spark(W["series"])}<span class="meta">{esc(W["hd"])}</span></span></a>'
            f'<div class="stat">{stats}</div></section>')
    cont = (f'<section class="card" id="contcard" hidden><div class="cont"><span class="logo"><img src="{W["logo"]}" alt="" width="28" height="28"></span><div class="mid"><h2>Continue reading: {esc(W["name"])}</h2><span class="sub" data-contsub></span>'
            f'<div class="pr"><span class="bar"><i data-pctbar="{W["slug"]}"></i></span><span data-pct="{W["slug"]}"></span></div></div><a class="btn btn-p" href="{W["href"]}" data-resume>Resume <span class="arr" aria-hidden="true">→</span></a></div></section>')
    nx = byslug.get("dm-champ")
    nxt = ""
    if nx and nx["status"] == "soon":
        r = nx["raw"]
        nxt = (f'<section class="card"><div class="ch"><h2>Next breakdown</h2><span class="meta">Numbers checked, story in progress</span></div><a class="nb" href="{nx["href"]}"><span class="logo"><img src="{nx["logo"]}" alt="" width="28" height="28"></span><span style="flex:1;min-width:0"><h3>{esc(nx["name"])}</h3><p class="what">{esc(nx["what"])}</p>'
               f'<span class="nums"><span><b>{nx["hv"]}</b>{esc(nx["hu"].strip())}{lb(nx["hl"])}</span>' + (f'<span>MRR {money(r["mrr"]["value"])} · {dlab(r["mrr"]["date"])} · TrustMRR</span>' if r.get("mrr") else "")
               + (f'<span>{lb(r["claim"]["label"])}"{esc(r["claim"]["text"])}" · {esc(r["claim"]["source"])} · {mlab(r["claim"]["date"])}</span>' if r.get("claim") else "") + '</span></span></a>'
               '<div class="prog3"><span class="d"><i></i>Numbers checked</span><span class="c"><i></i>Story in progress</span><span class="t"><i></i>Fact check</span></div></section>')
    soonrows = "".join(f'<a class="soonrow" href="{e["href"]}"><span class="logo" style="width:28px;height:28px;border-radius:7px"><img src="{e["logo"]}" alt="" width="20" height="20" loading="lazy"></span><span class="nm">{esc(e["name"])} <small>· {esc(e["type"])}</small></span>'
                       f'<span class="nv"><b>{e["hv"]}</b>{esc(e["hu"].strip())}{lb(e["hl"])}</span><span class="src">TrustMRR · {esc(e["hd"])}</span></a>' for e in [e for e in E if e["status"] == "soon"])
    body = f'''<div class="pg"><h1 class="sr">Home</h1>
<div class="pathnote" id="pathnote" hidden><span><b>Your path is ready:</b> <span data-pathname></span>. Step 1 of 6 is below this week's breakdown.</span><a class="tl" href="/app/path/">Open My path</a><button type="button" aria-label="Close" data-closenote>✕</button></div>
<div class="grid2"><div>
{cont}
{week}
{nxt}
<section class="card"><div class="ch"><h2>Open checklists</h2><a class="tl" href="/app/checklists/">All checklists</a></div><div data-homecl></div></section>
<section class="card"><div class="ch"><h2>Coming soon</h2><span class="meta">Numbers read from TrustMRR. Breakdown not written yet.</span></div>{soonrows}</section>
</div><div>
<section class="card"><div class="ch"><h2>Your path</h2><a class="tl" href="/app/start/?quiz=1" data-pathcta>Take the quiz</a></div><div class="cb" data-homepath></div><div data-likeyou></div></section>
<section class="card"><div class="ch"><h2>Free plan</h2><a class="tl" href="/app/account/#plan">Compare plans</a></div><div class="cb"><p>This week's breakdown, all sources, and checklists on this device. Pro saves ticks and your path to your account.</p></div></section>
</div></div></div>'''
    return shell(E, "Home", "Your LaunchVault home.", "home", body)

def library(E):
    body = f'''<div class="pg">
<h1 class="sr">Library</h1>
<div class="lbar">
  <label class="lsearch">{ic(I["srch"], 16)}<input type="search" id="lq" placeholder="Search companies, patterns or lessons" aria-label="Search the library"></label>
  <div class="seg" role="group" aria-label="Grouping"><button type="button" data-grp="all" aria-pressed="true">All stories</button><button type="button" data-grp="pattern" aria-pressed="false">By pattern</button></div>
  <div class="seg view" role="group" aria-label="View"><button type="button" data-view="list" aria-pressed="true" aria-label="List">{ic('<path d="M4 6h16M4 12h16M4 18h16"/>', 16)}</button><button type="button" data-view="cards" aria-pressed="false" aria-label="Cards">{ic(I["lib"], 16)}</button></div>
</div>
<div class="fchips">
  <div class="seg" role="group" aria-label="Type"><button type="button" data-tab="all" aria-pressed="true">All</button>{"".join(f'<button type="button" data-tab="{k}" aria-pressed="false">{v}</button>' for k, v in TABS.items())}</div>
  <select class="sel" id="lpat" aria-label="Pattern"><option value="">Any pattern</option></select>
  <select class="sel" id="lstat" aria-label="Status"><option value="">Ready and coming soon</option><option value="ready">Ready</option><option value="soon">Coming soon</option></select>
  <select class="sel" id="lsort" aria-label="Sort"><option value="new">Newest</option><option value="mrr">Biggest MRR</option><option value="growth">Fastest growth</option></select>
  <span class="vdiv"></span>
  <button class="tgl" type="button" role="switch" aria-checked="false" id="lver"><span class="sw"></span>Verified only</button>
  <button class="tl clear" type="button" id="lclear">Clear filters</button>
</div>
<div id="lout"></div>
<div class="note dash" style="margin-top:12px"><b style="color:#0B1220">New every week</b><span>Numbers are checked before the story goes out. The weekly email tells you when.</span></div>
<p class="lfoot">Revenue read from Stripe by TrustMRR; each number keeps the date it was read. Fastest growth is the average monthly growth between the first and last point of each series. Coming-soon rows open when the breakdown is out.</p>
<noscript><div class="ltab">{"".join(f'<a class="lrow" href="{e["href"]}"><span class="co"><b>{esc(e["name"])}</b></span><span class="num"><b>{e["hv"]}</b>{esc(e["hu"])}</span></a>' for e in E)}</div></noscript>
</div>'''
    return shell(E, "Library", "Every LaunchVault story, with its numbers labelled and dated.", "lib", body)

def static_page(E, name, title, desc, active, crumbs=None):
    body = rd(os.path.join(SRC, "app", name + ".body.html"))
    return shell(E, title, desc, active, body, crumbs=crumbs)

# ============================================================ public blog post (same design as the Postiz post)
def blog_post(S, E):
    set_srcmap(S); tpl = rd(os.path.join(SRC, "app", "_post.tpl.html"))
    kpis = "".join(f'<div class="kpi"><span class="k">{esc(x.get("long") or x["k"])}</span><span class="kv">{esc(x["v"])}</span><span class="m">{lb(x["label"])}{esc(x["date"])}</span></div>' for x in S["numbers"][:5])
    bymove = any(p.get("moves") for p in S["phases"])
    def ph(i, p):
        notes = p.get("number") or []
        nt = "".join(f'<div class="note">{esc(n["v"])} {lb(n["label"])}</div>' for n in (notes if isinstance(notes, list) else [notes]))
        # stories keyed to chart moves (Postiz) show the move numbers; the rest number phases from 1
        ks = (", ".join(str(k) for k in p.get("moves") or []) or "0") if bymove else str(i + 1)
        return (f'<div class="phase"><div class="w"><span class="k{" turn" if p.get("turn") else ""}">{ks}</span><b>{esc(p["name"])}</b><span>{esc(p["when"])}</span></div><div>\n        '
                + "\n        ".join(f"<p>{esc(t)}</p>" for t in p["story"].split("\n\n")) + (f"\n        {nt}" if nt else "") + f'\n        <p class="lesson">{esc(p["lesson"])}</p></div></div>')
    hl = "".join(f'<div class="mcard"><span class="no">Move {h["move"]}</span><h3>{esc(h["title"])}</h3>\n        <p>{esc(h["text"])}</p>' + (f'\n        <p class="q">{esc(h["quote"])}</p>' if h.get("quote") else "")
                 + f'\n        <span class="meta">{lb(h["label"])} · {esc(h.get("source", ""))}{(", " + esc(h["date"])) if h.get("date") else ""}</span></div>' for h in S.get("highlights", []))
    fc = "".join(f'<div class="fr" role="row"><span class="c1">{esc(f["claim"])}</span><span>{esc(f["found"])}</span><span>{lb(f["label"])}</span></div>' for f in S["fact_checks"])
    cl = [c if isinstance(c, dict) else {"text": c} for c in S["checklist"]]
    cks = "".join(f'<button class="ck" type="button" aria-pressed="false"><span class="bx"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-6.5" pathLength="1"/></svg></span><span>{esc(c["text"])}</span></button>' for c in cl)
    src = "".join(f'<div class="sl-row"><span class="slogo">{src_logo(s, cls=" class=" + chr(34) + "blogo" + chr(34))}</span><span class="sn"><b>{esc(s["name"])}</b><span class="d">{esc(s.get("what", ""))}</span></span><span class="sd">{esc(s["date"])}</span>{lb(s["label"])}</div>' for s in S["sources"])
    tn = ""
    if S.get("wayback"):
        note = (S.get("wayback_note") or "What the homepage said, and when").rstrip(".")
        host = esc(re.sub(r"^https?://(www[.])?", "", S.get("site", "")).strip("/"))
        head_ = f'<section id="then-now"><div class="wrap"><div class="shead"><div><h2>Then and now. <em class="em">{esc(note)}.</em></h2></div></div>'
        if any(w.get("image") for w in S["wayback"]):   # screenshots: side-by-side cards (Postiz)
            tn = head_ + '<div class="tn">' + '<div class="arrow"></div>'.join(
                f'<div class="snap"><div class="sb"><span>{host} · {esc(w["date"])}{(" / " + esc(w["prices_date"])) if w.get("prices_date") else ""}</span>{lb(w.get("label", "Wayback"))}</div><div class="sc"><p class="hl">"{esc(w["headline"])}"</p><p class="sp">{esc(w.get("sub", ""))}</p>'
                + prices(w.get("prices")) + "</div></div>" for w in S["wayback"]) + "</div></div></section>"
        else:                                            # text only: a compact vertical timeline
            tn = head_ + '<ol class="wbtl">' + "".join(
                f'<li><div class="wd"><time>{esc(w["date"])}</time>{lb(w.get("label", "Wayback"))}<span class="wh">{host}</span></div>'
                f'<div class="wc"><p class="hl">"{esc(w["headline"])}"</p>' + (f'<p class="sp">{esc(w["sub"])}</p>' if w.get("sub") else "") + prices(w.get("prices")) + "</div></li>"
                for w in S["wayback"]) + "</ol></div></section>"
    title = S["title"]; em = (S.get("title_em") or "").rstrip(".")
    h1 = (esc(title[:-len(em)]) + f'<em class="em">{esc(em)}.</em>') if em and title.endswith(em) else esc(title)
    rep = {"{{SLUG}}": S["slug"], "{{H1}}": h1, "{{DEK}}": esc(S["dek"]), "{{LOGO}}": S["logo"], "{{NAME}}": esc(S["name"]), "{{READ}}": str(S["read_min"]), "{{NSRC}}": str(len(S["sources"])),
           "{{DATE}}": esc(S["numbers"][0]["date"]), "{{KPIS}}": kpis, "{{CHART}}": chart_block(S, moves_list=True, band=False), "{{HL}}": hl, "{{NHL}}": str(len(S.get("highlights", []))),
           "{{PHASES}}": "\n      ".join(ph(i, p) for i, p in enumerate(S["phases"])), "{{FC}}": fc, "{{NFC}}": str(len(S["fact_checks"])), "{{FCREAD}}": esc(S.get("fact_checks_read") or latest_date(s["date"] for s in S["sources"])), "{{FCSUM}}": fc_summary(S["fact_checks"]),
           "{{TN}}": tn, "{{CKS}}": cks, "{{NCK}}": str(len(cl)), "{{SRC}}": src, "{{APP}}": f"/app/story/{S['slug']}/"}
    for k, v in rep.items(): tpl = tpl.replace(k, v)
    if not S.get("highlights"):
        tpl = re.sub(r"<!--HL-->.*?<!--/HL-->", lambda m: '<section class="sec-alt" id="moves-two"><div class="wrap">', tpl, flags=re.S)
        tpl = tpl.replace('<a href="#moves-two">Two moves that mattered</a>', "")
    if not S.get("wayback"): tpl = tpl.replace('<a href="#then-now">Then and now</a>', "")
    return tpl

# ============================================================ blog cards (homepage block + blog index featured)
def card(S, feat=False):
    alt = f'{esc(S["name"])} breakdown cover'
    pic = f'<picture><source srcset="/assets/covers/{S["slug"]}.webp" type="image/webp"><img src="/assets/covers/{S["slug"]}.png" width="1600" height="900" {"fetchpriority=" + chr(34) + "high" + chr(34) if feat else "loading=" + chr(34) + "lazy" + chr(34)} decoding="async" alt="{alt}"></picture>'
    if feat:
        return (f'<a class="post bfeat" href="/blog/{S["slug"]}/">\n        <div class="cv cover big">{pic}</div>\n        <div class="bd"><span class="cat">Breakdowns</span><h3>{esc(S["title"])}</h3><p>{esc(S["dek"])}</p>\n'
                f'          <span class="by"><i><svg width="11" height="11" style="stroke:#60A5FA" aria-hidden="true"><use href="#i-lv"/></svg></i>LaunchVault · {S["read_min"]} min read · {dlab(S["published"])}</span>\n'
                '          <span class="bgo">Read the breakdown <span aria-hidden="true">→</span></span></div></a>')
    return (f'<a class="post" href="/blog/{S["slug"]}/"><div class="cv cover">{pic}</div>\n        <div class="bd"><span class="cat">Breakdowns</span><h3>{esc(S["title"])}</h3><p>{esc(S["dek"])}</p>'
            f'<span class="by"><i><svg width="11" height="11" style="stroke:#60A5FA" aria-hidden="true"><use href="#i-lv"/></svg></i>LaunchVault · {S["read_min"]} min read<span class="go" aria-hidden="true">→</span></span></div></a>')
def update_cards(ready, stale=()):
    p = os.path.join(SRC, "index.body.html"); s = rd(p)
    a = s.index('<div class="posts'); b = s.index('</div><!-- end posts -->', a)
    block = s[a:b]; head_ = block[:block.index(">") + 1]
    olds = re.findall(r'<a class="post" href="(/blog/[^"]+)">.*?</a>', block, re.S); oldb = re.findall(r'<a class="post" href="/blog/[^"]+">.*?</a>', block, re.S)
    slugs = {S["slug"] for S in ready}
    explainers = [h for h, href in zip(oldb, olds) if href.strip("/").split("/")[-1] not in slugs]
    tail = block[block.index('<script src="/assets/pages.js"'):] if '<script src="/assets/pages.js"' in block else ""
    new = head_ + "\n      " + "\n      ".join([card(S) for S in ready] + explainers) + ("\n      " + tail.strip() + "\n    " if tail else "\n    ")
    if new != block: wr(p, s[:a] + new + s[b:])
    p = os.path.join(SRC, "blog.body.html"); s = rd(p)
    a = s.index('<div class="blog-feat">'); b = s.index("{{POSTS}}", a)
    top = next((S for S in ready if S["slug"] not in stale), ready[0])
    feat = f'<div class="blog-feat">\n      {card(top, True)}\n    </div>\n    '
    s2 = s[:a] + feat + s[b:]
    s2 = re.sub(r"(\{\{POSTS\}\}\s*<script>document\.currentScript\.previousElementSibling\.querySelectorAll\('a\.post\[href=\")[^\"]+(\"\]'\))", r"\g<1>/blog/" + top["slug"] + r"/\2", s2)
    if s2 != s: wr(p, s2)

def update_story_cards(ready):
    """Homepage #stories: a company with a story file becomes a ready card (read time + a link to its post). Numbers are untouched."""
    p = os.path.join(SRC, "index.body.html"); s = rd(p)
    a = s.index('<section id="stories"'); b = s.index("</section>", a); sec = s[a:b]
    byname = {S["name"]: S for S in ready}
    def one(m):
        art, name = m.group(0), m.group(1); S = byname.get(name)
        if not S: return art
        art = art.replace('<article class="bcard soon"', '<article class="bcard live"', 1)
        art = re.sub(r"(<small>[^<·]*)· coming soon</small>", lambda k: f'{k.group(1)}· {S["read_min"]} min read</small>', art, count=1)
        if 'class="go"' not in art:
            art = art.replace("</div>\n      </article>", f'<a class="go" href="/blog/{S["slug"]}/">Read <span class="arr" aria-hidden="true">→</span><span class="sr"> the {esc(name)} breakdown</span></a></div>' + NL + "      </article>", 1)
        return art
    sec2 = re.sub(r'<article class="bcard[^"]*" data-cat="[^"]*" data-story="([^"]+)">.*?</article>', one, sec, flags=re.S)
    if sec2 != sec: wr(p, s[:a] + sec2 + s[b:])

def write_sitemap():
    """Public pages and posts. The preview stays noindex (robots.txt Disallow + X-Robots-Tag); the sitemap is ready for launch."""
    urls = ["/"] + ["/" + out[:-len("index.html")] for out, *_ in build.PAGES if out.endswith("index.html") and out != "index.html"]
    body = "".join(f"  <url><loc>https://launchvault-site.vercel.app{u}</loc></url>{NL}" for u in sorted(set(urls), key=lambda u: (u != "/", u)))
    wr(os.path.join(ROOT, "sitemap.xml"), '<?xml version="1.0" encoding="UTF-8"?>' + NL
       + "<!-- Preview build: robots.txt says Disallow and every page sends noindex, on purpose, until launch. This sitemap lists the public pages for then. -->" + NL
       + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + NL + body + "</urlset>" + NL)

# ============================================================ covers for new stories
def make_cover(S):
    png = os.path.join(ROOT, "assets", "covers", S["slug"] + ".png")
    if os.path.exists(png): return "kept"
    pts = S["series"]["points"]; vs = [p[1] for p in pts]
    # y axis scaled to the data: nice ticks from just under the low to just over the high
    raw = (max(vs) - min(vs)) or max(vs) or 1; mag = 10 ** math.floor(math.log10(raw / 3))
    step = next(m * mag for m in (1, 2, 2.5, 5, 10) if raw / (m * mag) <= 4)
    lo = math.floor(min(vs) / step) * step; hi = math.ceil(max(vs) / step) * step
    if hi == lo: hi = lo + step
    X0, X1, Y0, Y1 = 250, 1460, 760, 330   # plot box (y0 = baseline)
    sx = lambda i: X0 + i * (X1 - X0) / max(1, len(vs) - 1); sy = lambda v: Y0 - (v - lo) / (hi - lo) * (Y0 - Y1)
    line = "M" + " L".join(f"{sx(i):.0f} {sy(v):.0f}" for i, v in enumerate(vs))
    def kfmt(v): return f"${v / 1e6:,.1f}M" if v >= 1e6 else (f"${v / 1e3:,.0f}k" if v >= 1e3 else f"${v:,.0f}")
    def xl(t): return mlab(t) if re.fullmatch(r"\d{4}-\d{2}", str(t)) else str(t)
    ticks = [lo + k * step for k in range(int(round((hi - lo) / step)) + 1)]
    grid = "".join(f'<line x1="{X0}" x2="{X1}" y1="{sy(t):.0f}" y2="{sy(t):.0f}" stroke="{"#94A3B8" if t == lo else "#E5E9F0"}" stroke-width="2"/>'
                   f'<text x="{X0 - 22}" y="{sy(t) + 9:.0f}" text-anchor="end">{kfmt(t)}</text>' for t in ticks)
    xlab = (f'<text x="{X0}" y="{Y0 + 46}" text-anchor="start">{esc(xl(pts[0][0]))}</text><text x="{X1}" y="{Y0 + 46}" text-anchor="end">{esc(xl(pts[-1][0]))}</text>'
            f'<text x="{X0 + 18}" y="{Y1 - 26}" text-anchor="start" class="cap">{esc(S["series"].get("what", "Revenue each month"))}</text>')
    dot = f'<circle cx="{sx(len(vs) - 1):.0f}" cy="{sy(vs[-1]):.0f}" r="11" fill="#2563EB" stroke="#fff" stroke-width="5"/>'
    chart = (f'<svg width="1600" height="900"><style>text{{font:600 24px "Inter Tight";fill:#64748B}}.cap{{font:600 22px "Schibsted Grotesk";fill:#475569}}</style>{grid}{xlab}'
             f'<path d="{line} L{X1} {Y0} L{X0} {Y0} Z" fill="rgba(37,99,235,.07)"/><path d="{line}" fill="none" stroke="#2563EB" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"/>{dot}</svg>')
    num = S["numbers"][0]
    page = f'''<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@600;700&family=Inter+Tight:wght@600&display=block">
<style>*{{margin:0;box-sizing:border-box}}body{{width:1600px;height:900px;background:#F1F4F9;font-family:"Schibsted Grotesk";color:#0B1220;position:relative;overflow:hidden}}
.c{{position:absolute;inset:48px;background:#fff;border-radius:16px;box-shadow:0 0 0 1px rgba(11,18,32,.08),0 30px 60px -30px rgba(11,18,32,.3)}}
.t{{position:absolute;left:110px;top:100px;display:flex;align-items:center;gap:22px;font:700 54px/1 "Schibsted Grotesk";letter-spacing:-.02em}}.t img{{width:76px;height:76px;object-fit:contain;border-radius:16px}}
.n{{position:absolute;right:110px;top:92px;text-align:right}}.n b{{display:block;font:600 72px/1 "Inter Tight";letter-spacing:-.03em}}.n span{{display:inline-flex;align-items:center;gap:10px;margin-top:14px;font:600 24px "Schibsted Grotesk";color:#047857;background:rgba(16,185,129,.12);border-radius:10px;padding:6px 14px}}
.n small{{display:block;margin-top:10px;font:600 22px "Schibsted Grotesk";color:#64748B}}svg{{position:absolute;left:0;top:0}}</style></head><body><div class="c"></div>
<div class="t"><img src="{ROOT.replace(os.sep, "/")}/{S["logo"].lstrip("/")}">{esc(S["name"])}</div><div class="n"><b>{esc(num["v"])}</b><span>{esc(num["label"])}</span><small>{esc(num["k"])} · {esc(num["date"])}</small></div>
{chart}</body></html>'''
    tmpdir = os.path.join(ROOT, "_covers_tmp"); os.makedirs(tmpdir, exist_ok=True)
    hp = os.path.join(tmpdir, S["slug"] + ".html"); wr(hp, page)
    js = os.path.join(ROOT, "scripts", "cover.js")
    try:
        subprocess.run(["node", js, hp.replace(os.sep, "/"), png.replace(os.sep, "/")], check=True, timeout=120)
        from PIL import Image
        Image.open(png).convert("RGB").save(png.replace(".png", ".webp"), quality=86)
        return "made"
    except Exception as e:
        raise SystemExit(f"COVER FAILED for {S['slug']}: {e}. Set LV_PLAYWRIGHT / LV_CHROME (see PUBLISHING.md).")

# ============================================================ client data (search, library, path, quiz)
QUIZ = [
    ("How much time could you give this most weeks?", ["Under 5 h a week", "About 10 h a week", "15 h or more"]),
    ("How much money could you put in?", ["$0", "Under $100", "Under $1,000"]),
    ("Can you code, even a little?", ["Yes, I can code", "A little", "Not yet"]),
    ("What are you already good at, even a little?", ["Design, video or writing", "Talking to people", "Not sure yet, and that's fine"]),
    ("Who around you has a problem worth fixing?", ["Someone in my family", "A local shop or business", "People in an online group I'm in", "No one comes to mind yet"]),
    ("Which sounds most like fun?", ["Building an app people use", "Doing a job for real clients", "Testing an idea fast and changing it"]),
    ("Where do people your age hang out online?", ["Reddit or Discord", "TikTok or Instagram", "Not sure"]),
    ("How soon would you like a first sale?", ["This month", "This school term", "No rush"]),
]
# answer -> stories it points to (pattern matches, from each story's public pattern line)
QW = [[{"stencil-ai": 2}, {"windmill-growth": 1, "postiz": 1}, {"postiz": 2, "dm-champ": 1}],
      [{"postiz": 2, "stencil-ai": 2}, {"stencil-ai": 2, "windmill-growth": 1, "gojiberry": 1}, {"windmill-growth": 2, "dm-champ": 2}],
      [{"postiz": 2, "stencil-ai": 1}, {"stencil-ai": 1, "gojiberry": 1}, {"windmill-growth": 2}],
      [{"windmill-growth": 2, "postiz": 1}, {"windmill-growth": 2, "gojiberry": 2}, {"stencil-ai": 1, "gojiberry": 1}],
      [{"stencil-ai": 3}, {"windmill-growth": 3}, {"postiz": 2, "dm-champ": 1}, {"gojiberry": 2, "postiz": 1}],
      [{"postiz": 2, "stencil-ai": 2}, {"windmill-growth": 3}, {"gojiberry": 2, "dm-champ": 2}],
      [{"postiz": 2}, {"stencil-ai": 1, "windmill-growth": 1}, {}],
      [{"gojiberry": 2, "windmill-growth": 1}, {"dm-champ": 1, "stencil-ai": 1}, {"postiz": 2}]]
TASKS = {"c1": "Pick the one place and post your next small update there today.", "c2": "Write down the one thing you could give away free, and the easy paid version.",
         "c3": "List three tools growing fast right now that your idea could plug into.", "c4": "Find the five people who use your thing most and ask them one question each.",
         "c5": "Write one useful post yourself instead of paying for SEO.", "c6": "Pick one hour a week you can keep through exams and put it in your calendar."}
APPDATA = {}
WEEK = ""

def main():
    global APPDATA
    legacy = {s.get("slug") or s["company"].lower(): s for s in json.load(open(os.path.join(DATA, "stories.json"), encoding="utf-8"))["stories"]}
    ready = load_ready()
    assert ready, "no ready stories"
    ready.sort(key=lambda S: bool((legacy.get(S["slug"]) or {}).get("stale")))   # stable: within one publish date, stale data goes last
    ready.sort(key=lambda S: S["published"], reverse=True)
    rslugs = {S["slug"] for S in ready}
    tabs = json.load(open(os.path.join(DATA, "stories.json"), encoding="utf-8"))["tabs"]
    E = [norm_ready(S, legacy.get(S["slug"])) for S in ready] + [norm_soon(legacy[s]) for k in ("ai", "mobile", "services") for s in tabs[k] if s not in rslugs and s in legacy]
    for e in E: e["growth"] = growth(e["series"])
    global WEEK; WEEK = next((e["slug"] for e in E if e["status"] == "ready" and not e["stale"]), ready[0]["slug"])
    pz = next(S for S in ready if S["slug"] == "postiz")
    pz_ck = [c for c in pz["checklist"]]
    steps = [{"id": c["id"], "text": c["text"], "from": c["from"], "n": int(c["id"][1:]), "task": TASKS.get(c["id"], "")} for c in [pz_ck[i] for i in (0, 1, 5, 3, 2)]]
    APPDATA = {
        "stories": [{k: e[k] for k in ("slug", "name", "tab", "type", "what", "logo", "pattern", "lessons", "hv", "hu", "hl", "hd", "sub", "status", "stale", "href", "read", "published", "mrr", "growth")}
                    | {"spark": spark(e["series"], name=e["name"])} for e in E],
        "tabs": TABS,
        "checklists": [{"slug": S["slug"], "name": S["name"], "logo": S["logo"], "href": next(e["href"] for e in E if e["slug"] == S["slug"]), "key": f"lv-{S['slug']}-checks",
                        "items": [c if isinstance(c, dict) else {"text": c, "from": ""} for c in S["checklist"]], "phases": len(S["phases"]),
                        "phase_names": [p["name"] for p in S["phases"]]} for S in ready],
        # one path per story: the quiz's top match picks it (app.js pathFor); the next match adds the path-only step
        "paths": {S["slug"]: {"title": "Ship something small first" if S["slug"] == "postiz" else S["pattern"], "source": S["slug"], "name": S["name"],
                              "steps": steps if S["slug"] == "postiz" else [{"id": f"s{i + 1}", "text": c["text"] if isinstance(c, dict) else c, "from": (c.get("from") if isinstance(c, dict) else "") or S["name"] + " breakdown", "n": i + 1, "task": ""} for i, c in enumerate(S["checklist"][:5])],
                              "lead": {"id": "x1", "text": (S["checklist"][0]["text"] if isinstance(S["checklist"][0], dict) else S["checklist"][0]), "from": "Pattern from " + S["name"], "href": f"/app/story/{S['slug']}/"}} for S in ready},
        "path": {"title": "Ship something small first", "source": "postiz", "steps": steps,
                 "extra": {"id": "x1", "text": "Ask for money early: offer the easy paid version to your 5 most active users.", "from": "Pattern from Gojiberry", "href": "/app/story/gojiberry/" if "gojiberry" in rslugs else ""}},
        "quiz": [{"q": q, "o": o, "w": w} for (q, o), w in zip(QUIZ, QW)],
        "search_extra": [x for S in ready for x in (
                            [{"t": f"{S['name']} · phase {i + 1}: {ph['name']}", "k": " ".join([ph["name"], ph["story"], ph["lesson"]]), "h": f"/app/story/{S['slug']}/#ph{i + 1}", "g": "Phases"} for i, ph in enumerate(S["phases"])]
                            + [{"t": f"{S['name']} move {i + 1}: {m['text']} · {m['when']}", "h": f"/app/story/{S['slug']}/#chart", "g": "Moves"} for i, m in enumerate(S["moves"])]
                            + [{"t": f"{S['name']} · {so['name']}", "k": so["name"] + " " + so.get("what", ""), "h": f"/app/story/{S['slug']}/#sources", "g": "Sources"} for so in S["sources"]])],
    }
    out = lambda rel, t: wr(os.path.join(ROOT, "app", rel, "index.html") if rel else os.path.join(ROOT, "app", "index.html"), t)
    out("", home(E)); out("library", library(E))
    for S in ready:
        # this week's breakdown (newest story whose data isn't stale) is free; every other story keeps the Pro gate after phase 1
        page = reader(E, S, gate=S["slug"] != WEEK)
        out(f"story/{S['slug']}", page)
    shutil.rmtree(os.path.join(ROOT, "app", "postiz"), ignore_errors=True)   # old alias: vercel.json redirects /app/postiz/ to /app/story/postiz/
    for e in E:
        if e["status"] == "soon": out(f"story/{e['slug']}", soon_page(E, e))
    out("path", static_page(E, "path", "My path", "Your path, built from your quiz answers.", "path"))
    out("checklists", static_page(E, "checklists", "Checklists", "Every checklist, ticked on this device.", "ck"))
    out("account", static_page(E, "account", "Account", "Your account, plan, email and data.", "acct"))
    out("not-found", static_page(E, "notfound", "Not found", "This page isn't in the app.", ""))
    wr(os.path.join(ROOT, "app", "start", "index.html"), head("Welcome · LaunchVault", "Set up your LaunchVault path.") + "<body>\n" + rd(os.path.join(SRC, "app", "start.body.html"))
       + f'\n<script type="application/json" id="lvapp">{json.dumps(APPDATA, separators=(",", ":"))}</script>\n<script src="/assets/auth.js" defer></script>\n<script src="/assets/app.js" defer></script>\n</body>\n</html>\n')
    # Clerk OAuth lands here, then goes on to /app/ (returning) or /app/start/ (new). Unused while LV_AUTH is false.
    wr(os.path.join(ROOT, "welcome", "callback", "index.html"), head("Signing you in · LaunchVault", "Finishing sign-in.") + '<body><main class="pg narrow" id="main"><p class="note" role="status">Signing you in…</p></main>' + NL + '<script src="/assets/auth.js"></script>' + NL + '<script>window.LVAuth && LVAuth.callback().catch(() => location.replace("/welcome/"));</script>' + NL + '</body>' + NL + '</html>' + NL)
    # public side: generated blog posts (Postiz keeps its hand-made post; its generated twin goes to _gen for the parity check)
    for S in ready:
        post = blog_post(S, E)
        wr(os.path.join(SRC, f"post-{S['slug']}.body.html"), post)
        make_cover(S)
        if not any(p[0] == f"blog/{S['slug']}/index.html" for p in build.PAGES):
            build.PAGES.insert(2, (f"blog/{S['slug']}/index.html", f"post-{S['slug']}.body.html", f"{S['title']} · LaunchVault", S["dek"], "blog", False, False, ""))
    update_cards(ready, {e["slug"] for e in E if e["stale"]})
    update_story_cards(ready)
    build.main()
    write_sitemap()
    # the public posts load the shared chart renderer
    for S in ready:
        p = os.path.join(ROOT, "blog", S["slug"], "index.html"); t = rd(p)
        if "chart.js" not in t: wr(p, t.replace("</body>", '<script src="/assets/chart.js" defer></script>\n</body>').replace("</head>", '<link rel="stylesheet" href="/assets/chart.css">\n</head>'))
    print(f"app: {len(E)} stories ({len(ready)} ready, {len(E) - len(ready)} coming soon)")
    return ready, E

if __name__ == "__main__":
    main()
