"""Build the LaunchVault app (/app/) and every story page from data. No hand-editing of output.

Inputs (nothing else):
  data/stories/<slug>.json   one file per READY story (see SCHEMA.md); validated here
  data/stories.json                  the 13 companies' TrustMRR numbers; any company without a story file stays "Coming soon"
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
DATA = os.path.join(ROOT, "data")
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
I = {"saved": '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>', "home": '<path d="M4 11l8-7 8 7v9H4z"/>', "lib": '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
     "path": '<circle cx="6" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><path d="M8 6h7a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h7"/>',
     "ck": '<path d="M10 6h10M10 12h10M10 18h10"/><path d="M4 6l1.2 1.2L7 5.2M4 12l1.2 1.2L7 11.2M4 18l1.2 1.2L7 17.2"/>',
     "acct": '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
     "srch": '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>', "chev": '<path d="M9 6l6 6-6 6"/>', "back": '<path d="M15 6l-6 6 6 6"/>',
     "lock": '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>', "ext": '<path d="M7 17L17 7M9 7h8v8"/>', "dev": '<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/>',
     "chat": '<path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4.5 3.5V16H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/>',
     "ask": '<path d="M12 3.5l1.7 4.6 4.6 1.7-4.6 1.7L12 16.1l-1.7-4.6-4.6-1.7 4.6-1.7z"/><path d="M18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>', "user": '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.6-3.6 3.4-5.5 7-5.5s6.4 1.9 7 5.5"/>'}
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
    sh = ((S.get("facts") or {}).get("first_customers") or {}).get("short")
    if sh is not None and not (isinstance(sh, str) and 0 < len(sh) <= 60): err.append("facts.first_customers.short: a string of 60 characters or fewer")
    for i, w in enumerate(S.get("wayback") or []):
        if not w.get("source") or not w.get("date") or not w.get("headline"): err.append(f"wayback[{i}]: needs date, headline and source")
    if len(S["checklist"]) < 3: err.append("checklist: need at least 3 items")
    for i, s in enumerate(S["sources"]):
        if not s.get("name") or not s.get("date") or s.get("label") not in LABELS: err.append(f"sources[{i}]: needs name, date and a label")
    logo = S["logo"]
    if logo.startswith("/") and not os.path.exists(os.path.join(ROOT, logo.lstrip("/"))): err.append(f"logo file not found: {logo}")
    for w in S.get("wayback") or []:
        if w.get("image") and not os.path.exists(os.path.join(ROOT, w["image"].lstrip("/"))): err.append(f"wayback image not found: {w['image']}")
    err += ["links: " + b for b in links_ok(S)]
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
def _today():
    import datetime as dt
    try:
        from zoneinfo import ZoneInfo; return dt.datetime.now(ZoneInfo("America/Toronto")).date().isoformat()
    except Exception: return (dt.datetime.utcnow() - dt.timedelta(hours=5)).date().isoformat()
TODAY = os.environ.get("LV_TODAY") or _today()   # stories dated after today stay hidden until that day

def load_ready(strict=True):
    out = []
    for p in sorted(glob.glob(os.path.join(DATA, "stories", "*.json"))):
        S = normalize(json.load(open(p, encoding="utf-8"))); e = validate(S, p)
        if e:
            msg = f"{os.path.basename(p)}:\n  - " + "\n  - ".join(e)
            if strict: raise SystemExit("INVALID STORY " + msg)
            print("skipped (invalid) " + msg); continue
        if S["published"] > TODAY: print(f"scheduled {S['slug']} for {S['published']}"); continue
        out.append(S)
    hv = lambda S: (S.get("headline") or {}).get("value") or int(re.sub(r"[^0-9]", "", S["numbers"][0]["v"]) or 0)
    return sorted(out, key=lambda s: (s["published"], hv(s)), reverse=True)   # stale ones are moved after fresh ones of the same day in main()   # newest first; same day: biggest verified number first

# ============================================================ data model
def norm_soon(s):
    h = s["headline"]
    if h["measure"] == "revenue in month": hv, hu, hd = money(h["value"]), f' in {mlab(h["month"])}', dlab(s["monthly"]["read_on"]) if s.get("monthly") else ""
    else: hv, hu, hd = money(h["value"]), " MRR", dlab(h["date"])
    m = (s.get("monthly") or {}).get("months") or {}
    return {"slug": s["slug"], "name": s["company"], "tab": s["category"], "type": CAT1[s["category"]], "what": re.sub(r"\s*\([0-9a-f]{6}\)", "", s.get("what", "")),
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
    hm = "MRR" if hu == " MRR" else ("Revenue" + hu) if hu.startswith(" in ") else hu.lstrip(" ·")   # what the headline number is, in words
    hsrc = (legacy.get("trustmrr_url") if legacy and (sub or stale) else "") or h.get("source", S["numbers"][0].get("source", ""))
    fcu = (S.get("facts") or {}).get("first_customers") or {}; first = fcu.get("short") or ""
    return {"first": first, "firstl": (fcu.get("label") or "") if first and first.lower() != "not public" else "", "hm": hm, "hs": src_name({"source": hsrc}),
            "slug": S["slug"], "name": S["name"], "tab": tab, "type": S.get("type_label") or S["category"], "what": S["what"], "logo": S["logo"],
            "pattern": S["pattern"], "lessons": [p["lesson"] for p in S["phases"]], "hv": hv, "hu": hu, "hl": hl, "sub": sub,
            "hd": hd, "hsrc": hsrc, "status": "ready", "stale": stale,
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
GATE = '\n<script src="/assets/gate.js"></script>'   # the age gate: every /app/ page, in the head, before anything else runs (not deferred, on purpose)
def head(title, desc, extra="", og_slug="", gate=True):
    og = (NL + f'<meta property="og:title" content="{esc(title)}">' + NL + f'<meta property="og:description" content="{esc(desc)}">' + NL
          + f'<meta property="og:image" content="https://www.launchvault.ca/assets/covers/{og_slug or "postiz"}.png">')
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
{build.ZOOM}
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
<link rel="stylesheet" href="/assets/app.css">{extra}{GATE if gate else ""}
</head>
'''
def shell(E, title, desc, active, body, crumbs=None, wide=False, scripts="", og_slug=""):
    ready = [e for e in E if e["status"] == "ready"]; week = next((e for e in ready if not e["stale"]), ready[0])
    byslug = {e["slug"]: e for e in E}
    nav = [("home", "/app/", "Home", ""), ("lib", "/app/library/", "Library", ""), ("ask", "/app/assistant/", "Ask LaunchVault", ""), ("saved", "/app/saved/", "Saved", '<span class="cnt" data-cnt="saved"></span>'), ("chat", "/app/community/", "Community", ""), ("path", "/app/path/", "My path", '<span class="cnt" data-cnt="path"></span>'),
           ("ck", "/app/checklists/", "Checklists", '<span class="cnt" data-cnt="ck"></span>')]
    cur = lambda k: ' aria-current="page"' if k == active else ""
    side = "".join(f'<a class="si" href="{h}"{cur(k)}>{ic(I[k])}<span class="t">{t}</span>{c}</a>' for k, h, t, c in nav)
    soon = "".join(f'<a class="si co soon" href="{byslug[s]["href"]}"><img class="lgo" src="{byslug[s]["logo"]}" alt="" width="16" height="16" loading="lazy"><span class="t">{esc(byslug[s]["name"])}</span><span class="cnt">{"Stale" if byslug[s]["stale"] else "Soon"}</span></a>'
                   for s in [e["slug"] for e in E if e["status"] == "soon"][:4])
    wk = f'<a class="si week" href="{week["href"]}"{cur("story-" + week["slug"])}><img class="lgo" src="{week["logo"]}" alt="" width="16" height="16"><span class="t">{esc(week["name"])}</span><span class="cnt pc" data-pct="{week["slug"]}"></span></a>'
    tabs = "".join(f'<a href="{h}"{cur(k)}>{ic(I[k], 22)}<span>{t}</span></a>' for k, h, t, _ in nav if k != "ask")   # six tabs (Ask LaunchVault is the sparkle icon in the phone header); Account is the person icon in the header on phones
    ttl = (" ".join(f'<a href="{h}">{esc(t)}</a><span class="sep">/</span>' for h, t in crumbs[:-1]) + f'<span>{esc(crumbs[-1][1])}</span>') if crumbs else f"<span>{esc(title)}</span>"
    return (head(title + " · LaunchVault", desc, ('\n<link rel="stylesheet" href="/assets/chart.css">' if "chart.js" in scripts else "") + ('\n<link rel="stylesheet" href="/assets/community.css">' if "community.js" in scripts else "") + ('\n<link rel="stylesheet" href="/assets/assistant.css">' if "assistant.js" in scripts else ""), og_slug) + f'''<body{' class="has-back"' if crumbs else ""}>
<a class="skip" href="#main">Skip to content</a>
<div class="shell">
<aside class="side" aria-label="App">
  <a class="brand" href="/app/" aria-label="LaunchVault app home">{LV}<span>LaunchVault</span></a>
  <nav aria-label="Main">{side}</nav>
  <p class="sgrp">This week</p>{wk}
  
  <div class="foot"><div class="plan" data-state="free"><div class="pl-h"><span class="pl-ok" aria-hidden="true"><svg viewBox="0 0 16 16" width="12" height="12"><path d="M3.5 8.5l3 3 6-6.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span class="pl-n" data-plan>Free plan</span></div><p class="pl-v">Unlock every phase of every breakdown.</p><p class="pl-p">From $6.49/mo billed yearly</p><a href="/app/account/#plan" data-upg>Upgrade to Pro</a></div><a class="si" href="/app/account/"{cur("acct")}>{ic(I["acct"])}<span class="t">Account</span></a></div>
</aside>
<div class="main">
  <div class="prev" id="prevbar" role="status">Preview: accounts open soon. Your progress stays on this device.</div>
  <header class="top">
    {f'<a class="mback" href="{crumbs[0][0]}" aria-label="Back to {esc(crumbs[0][1])}">' + ic(I["back"], 22) + '</a>' if crumbs else ""}<a class="mlogo" href="/app/" aria-label="LaunchVault app home">{LV}</a>
    <div class="ttl">{ttl}</div>
    <button class="srch" type="button" data-cmd>{ic(I["srch"], 16)}<span>Search breakdowns</span><kbd>⌘K</kbd></button>
    <button class="ibtn" type="button" data-cmd aria-label="Search">{ic(I["srch"], 20)}</button><a class="ibtn macct" href="/app/assistant/" aria-label="Ask LaunchVault"{cur("ask")}>{ic(I["ask"], 20)}</a>
    <div class="avw"><button class="avb" type="button" data-avb aria-expanded="false" aria-controls="avm" aria-label="Account menu"><span class="av" data-av aria-hidden="true">{ic(I["user"], 20)}</span></button><div class="avm" id="avm" aria-label="Account" hidden></div></div>
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
<script src="/assets/app.js" defer></script>
<script src="/assets/profile.js" defer></script>{scripts}
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
def move_tags(S):
    """Each move against the chart's months: 'in', 'before' or '' (unknown / after). A bare year only counts as before when the whole year is."""
    se = S["series"]; mi = lambda t: int(t[:4]) * 12 + int(t[5:7]) - 1
    x0 = min([mi(se["points"][0][0])] + ([mi(se["start"])] if se.get("start") else [])); x1 = mi(se["points"][-1][0]); out = []
    for m in S["moves"]:
        if m.get("at"): x = mi(m["at"]); out.append("in" if x0 <= x <= x1 else "before" if x < x0 else ""); continue
        w = m.get("when", ""); ms = re.findall(r"\b(" + "|".join(MON) + r")[a-z]*\.? (?:\d{1,2},? )?(\d{4})", w); ys = re.findall(r"\b((?:19|20)\d{2})\b", w)
        latest = max(int(y) * 12 + MONI[mo] - 1 for mo, y in ms) if ms else (max(map(int, ys)) * 12 + 11 if ys else None)
        out.append("before" if latest is not None and latest < x0 else "")
    return out
def chart_intro(S):
    """Says truthfully where the founder's moves are: on the line, before it, or only in the list."""
    se = S["series"]; tags = move_tags(S) if S.get("moves") else []; n = len(tags); nin = tags.count("in"); bef = [i + 1 for i, t in enumerate(tags) if t == "before"]
    a, b = mlab(se["points"][0][0]), mlab(se["points"][-1][0])
    base = f'This chart shows {esc(se["what"].lower())}.'
    if not n: return base
    if nin == n: return base + " Numbered markers are the founder's moves; tap one to see what happened then."
    if len(bef) == n: return f"This chart covers {a} to {b}. The founder's {n} moves came earlier; they are listed below."
    def nums(L):
        if len(L) == 1: return f"Move {L[0]}"
        if len(L) > 2 and L == list(range(L[0], L[-1] + 1)): return f"Moves {L[0]} to {L[-1]}"
        return "Moves " + ", ".join(map(str, L[:-1])) + f" and {L[-1]}"
    out = [base + " Numbered markers are the founder's moves inside these months; tap one to see what happened then."] if nin else [f"This chart covers {a} to {b}."]
    if bef: out.append(f"{nums(bef)} happened before this chart starts ({a}), so {'they are' if len(bef) > 1 else 'it is'} listed below, not on the line.")
    rest = n - nin - len(bef)
    if rest: out.append(f"{rest} more {'fall' if rest > 1 else 'falls'} outside these months or {'have' if rest > 1 else 'has'} no exact month, so {'they are' if rest > 1 else 'it is'} in the list only.")
    return " ".join(out)
def chart_block(S, moves_list=True, band=True):
    mark_mrr(S)
    data = {"series": S["series"], "moves": [{**m, "w": w} for m, w in zip(S["moves"], move_tags(S))] if S["moves"] else []}
    for i, p in enumerate(S["phases"]):
        for n in p.get("moves", []):
            if p.get("turn") and 0 < n <= len(data["moves"]): data["moves"][n - 1] = {**data["moves"][n - 1], "turn": True}
    legend = '<span><i class="lv"></i>Verified</span><span><i class="lc"></i>Claimed</span>' + ('<span><i class="lx"></i>Sources differ</span>' if any((p[2] if len(p) > 2 else "") == "Sources differ" for p in S["series"]["points"] + S["series"].get("alt", [])) else "") + ('<span><i class="lm">1</i>Founder\'s move</span>' if S["moves"] else "")
    nb = move_tags(S).count("before") if S["moves"] else 0
    if nb: legend += f'<span><i class="lm bfk">← {nb}</i>{nb} move{"s" if nb > 1 else ""} before {mlab(min([S["series"]["points"][0][0]] + ([S["series"]["start"]] if S["series"].get("start") else [])))}</span>'
    last = S["series"]["points"][-1]; kd = S["series"].get("kind") or {}
    big = f'{kd[last[0]]}, {(S["series"].get("point_dates") or {}).get(last[0]) or mlab(last[0])}' if last[0] in kd else S["series"]["what"].lower()   # an MRR point is never called revenue
    ml = ""
    if moves_list and S["moves"]:
        ml = f'<div class="mvh"><b>All {len(S["moves"])} moves</b></div><ol class="moves">' + "".join(f'<li><button type="button" data-i="{i}" class="{"turn" if data["moves"][i].get("turn") else ""}"><span class="w">{esc(m["when"])}</span><span class="n">{i + 1}</span><span class="mt">{esc(m["text"])}</span></button></li>' for i, m in enumerate(S["moves"])) + "</ol>"
    bd = ""
    if band:
        bd = '<div class="pband" role="group" aria-label="Phases">' + "".join(f'<button type="button" data-ph="{i + 1}" aria-pressed="false" title="{esc(p["name"])}, {esc(p["when"])}">{esc(p.get("short") or p["name"])}</button>' for i, p in enumerate(S["phases"])) + "</div>"
    return (f'<div class="chartc lvchart"><div class="hd"><div><div class="big">{money(last[1])}<small>{esc(big)}</small></div>'
            f'<div class="legend">{legend}</div></div></div><div class="readout" aria-live="polite"></div>'
            f'<div class="plot"><svg role="img" aria-label="{esc(S["name"])}: {esc(S["series"]["what"].lower())}, ' + ", ".join(f"{mlab(p[0])} {money(p[1])}" for p in S["series"]["points"]) + f'"></svg></div><noscript><p class="cfail">The chart needs JavaScript. The numbers are in the table below.</p></noscript>'
            f'{bd}{ml}{chart_table(S)}<p class="cprov">{esc(S["series"].get("note") or "Each point carries its own label.")}</p>'
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
# official company links (story JSON "links"): validated to https + a known platform domain
SOCIAL = {"x": ("X", r"(x|twitter)\.com", '<path d="M4 4l16 16M20 4L4 20" stroke-width="2.2"/>'),
          "linkedin": ("LinkedIn", r"linkedin\.com", '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 10v7M8 7v.01M12 17v-4a2 2 0 0 1 4 0v4M12 10v7"/>'),
          "youtube": ("YouTube", r"youtube\.com", '<rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="M10 9.5l5 2.5-5 2.5z" fill="currentColor"/>'),
          "instagram": ("Instagram", r"instagram\.com", '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6" fill="currentColor"/>'),
          "tiktok": ("TikTok", r"tiktok\.com", '<path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5M14 3c.5 2.5 2.3 4.2 5 4.5"/>'),
          "github": ("GitHub", r"github\.com", '<path d="M9 19c-4 1.3-4-2-6-2.5M15 21v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12 12 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"/>'),
          "producthunt": ("Product Hunt", r"producthunt\.com", '<circle cx="12" cy="12" r="9"/><path d="M10 16V8h3a2.5 2.5 0 0 1 0 5h-3"/>'),
          "discord": ("Discord", r"discord\.(gg|com)", '<path d="M8 8.5a12 12 0 0 1 8 0M7 16c3 1.5 7 1.5 10 0M5.5 7.5C4 10 3.5 13 4 16c1.5 1.2 3 1.8 4.5 2l1-1.8M18.5 7.5C20 10 20.5 13 20 16c-1.5 1.2-3 1.8-4.5 2l-1-1.8"/><circle cx="9.5" cy="12.5" r="1" fill="currentColor"/><circle cx="14.5" cy="12.5" r="1" fill="currentColor"/>')}
def links_ok(S):
    L = S.get("links") or {}; bad = []
    for k, v in L.items():
        if k == "other": bad += [o["url"] for o in v if not str(o.get("url", "")).startswith("https://")]; continue
        if k == "site": ok = str(v).startswith("https://")
        else: ok = k in SOCIAL and re.match(r"https://(www\.)?" + SOCIAL[k][1] + r"/", str(v))
        if not ok: bad.append(f"{k}: {v}")
    return bad
def link_row(S, cls="srow"):
    L = S.get("links") or {}; site = L.get("site") or S.get("site")
    btn = f'<a class="btn btn-s visit" href="{esc(site)}" target="_blank" rel="noopener">Visit {esc(S["name"])} <span aria-hidden="true">↗</span></a>' if site else ""
    soc = "".join(f'<a class="soc" href="{esc(L[k])}" target="_blank" rel="noopener" aria-label="{esc(S["name"])} on {nm}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{d}</svg></a>'
                  for k, (nm, _, d) in SOCIAL.items() if L.get(k))
    soc += "".join(f'<a class="soc txt" href="{esc(o["url"])}" target="_blank" rel="noopener">{esc(o["name"])} ↗</a>' for o in L.get("other", []))
    return f'<div class="{cls}">{btn}{soc}</div>'

def first_block(S):
    """How the first customers came: four facts, each with its label, source and date. No label = Not public, no chip."""
    F = S.get("facts") or {}
    def row(t, k):
        f = F.get(k)
        if not isinstance(f, dict): return ""
        txt = f.get("text") or "Not public"
        more = '<button type="button" class="fcmore" data-fcmore aria-expanded="false">More</button>' if len(txt) > 165 else ""   # about 4 lines on a phone
        if not f.get("label"): return f'<div class="fcr"><dt>{t}</dt><dd><p class="fcv">{esc(txt)}</p></dd></div>'
        meta = esc(" · ".join(x for x in (src_name(f), f.get("date", "")) if x)); u = f.get("source") or f.get("url") or ""
        src = f'<a href="{esc(u)}" target="_blank" rel="noopener">{meta} <span aria-hidden="true">↗</span></a>' if u.startswith("http") else f"<span>{meta}</span>"
        return f'<div class="fcr"><dt>{t}</dt><dd><p class="fcv">{esc(txt)}</p>{more}<p class="fcsrc">{lb(f["label"])}{src}</p></dd></div>'
    rows = "".join(row(t, k) for t, k in (("First customers came from", "first_customers"), ("First money came from", "first_revenue"), ("Cost to start", "cost_to_start"), ("Team", "team")))
    return f'<div class="fcust"><h2>How the first customers came</h2><dl>{rows}</dl></div>' if rows else ""

# figures near the top of a story: the founder's photo (story JSON "founder_photo") and the live site capture, each with an APA 7 caption
def fig_founder(S, n):
    p = S.get("founder_photo")
    if not p: return ""
    pub = f' {esc(p["publisher"])}.' if p.get("publisher") else ""
    lic = f' Licensed under {esc(p["license"])}.' if p.get("license", "").startswith("CC") else ""
    return (f'<figure class="rfig rface" style="display:flex;gap:14px;align-items:center"><img src="{esc(p["src"])}" width="{p["w"]}" height="{p["h"]}" alt="{esc(p["alt"])}" loading="lazy" decoding="async" style="width:96px;height:96px;flex:none;border-radius:50%;object-fit:cover">'
            f'<figcaption class="rcap" style="margin-top:0;min-width:0;overflow-wrap:anywhere"><b>Figure {n}.</b> {esc(p["name"])}, {esc(p["role"])}. From {esc(p["author"])}. ({esc(p["date"])}). <em>{esc(p["title"])}</em> [Photograph].{pub} '
            f'Retrieved {esc(p["retrieved"])}, from <a href="{esc(p["url"])}" target="_blank" rel="noopener">{esc(p["url"])}</a>{lic}</figcaption></figure>')
def fig_site(S, n):
    site_url = (S.get("links") or {}).get("site") or S.get("site") or ""; slug = S["slug"]
    if not (site_url and os.path.exists(os.path.join(ROOT, "assets", "figures", f"{slug}-site.webp"))): return ""
    return (f'<figure class="rfig"><picture><source srcset="/assets/figures/{slug}-site.webp" type="image/webp">'
            f'<img src="/assets/figures/{slug}-site.png" width="800" height="450" loading="lazy" decoding="async" alt="{esc(S["name"])} live website homepage"></picture>'
            f'<figcaption class="rcap"><b>Figure {n}.</b> {esc(S["name"])}. (2026, November 20). <em>{esc(S["name"])} official product homepage</em> [Website screenshot]. {esc(S["name"])}. '
            f'<a href="{esc(site_url)}" target="_blank" rel="noopener">{esc(site_url)}</a></figcaption></figure>')
def top_figs(S):
    """Founder photo then site capture, numbered from 1. Returns (html, how many)."""
    a = fig_founder(S, 1); b = fig_site(S, 2 if a else 1)
    return a + b, bool(a) + bool(b)

JUDGE_FORM = ('<form class="jform" data-judge novalidate><label for="jc{i}">Have a hackathon judge code?</label><div class="jrow"><input id="jc{i}" name="code" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false">'
              '<button class="btn btn-s" type="submit">Unlock</button></div><p class="jerr" role="alert" hidden>That code didn&#39;t work.</p></form>')
def reader(E, S, gate=True):
    set_srcmap(S); slug = S["slug"]; n = len(S["phases"])
    me = next((e for e in E if e["slug"] == slug), {}); stale_chip = f'<span class="lb n">{esc(me["stale"])}</span>' if me.get("stale") else ""
    tmr = lambda x: "trustmrr" in (x.get("source") or "")
    # key numbers: TrustMRR ones carry no Verified chip (one line below says where they come from); anything else keeps its label
    nums = "".join(f'<div class="ktile"><span class="k">{esc(x["k"])}</span><span class="val">{esc(x["v"])}</span><span class="m">{"" if tmr(x) and x["label"] == "Verified" else lb(x["label"])}{esc(x["date"])}</span></div>' for x in S["numbers"][:3])
    synced = next((x["date"] for x in S["numbers"] if tmr(x)), "")
    intro = lambda t: f'<p class="sint">{t}</p>'
    sec = lambda id_, h, t, body, extra="": f'<section class="rsec rcard" id="{id_}"{extra}><div class="sh"><h2>{h}</h2></div>{intro(t)}{body}</section>'
    # "Check our work" panels: open on desktop, app.js folds them on phones
    panel = lambda id_, h, t, body: f'<details class="cow" id="{id_}" open><summary><span class="cwh"><b>{h}</b><span>{t}</span></span><span class="chev" aria-hidden="true"></span></summary><div class="cwb">{body}</div></details>'
    def phase(i, p):
        body = "".join(f"<p>{esc(t)}</p>" for t in p["story"].split("\n\n"))
        return (f'<details class="ph" id="ph{i + 1}" data-ph="{i + 1}" open><summary><span class="pn">{i + 1}</span><span class="phh"><b>{esc(p["name"])}</b><span class="when">{esc(p["when"])}</span></span><span class="chev" aria-hidden="true"></span></summary>'
                f'<div class="phb"><div class="body">{body}</div>{nbox(p.get("number") or [])}<p class="lesson"><b>Lesson:</b> {esc(p["lesson"])}</p></div></details>')
    phases_free = phase(0, S["phases"][0]); phases_rest = "".join(phase(i, p) for i, p in enumerate(S["phases"]) if i)
    kmoves = ""
    if S.get("highlights"):
        kmoves = sec("two", "Key moves", f"The {len(S['highlights'])} decisions that changed the line most, each with its source.", '<div class="hl2">' + "".join(
            f'<div class="hlc"><h3><i>{h["move"]}</i>{esc(h["title"])}</h3><p>{esc(h["text"])}</p>' + (f'<p class="q">{esc(h["quote"])}</p>' if h.get("quote") else "")
            + f'<span class="src">{lb(h["label"])}{esc(h.get("source", ""))}{(" · " + esc(h["date"])) if h.get("date") else ""}</span></div>' for h in S["highlights"]) + "</div>")
    tn = ""; fig_html, nfig = top_figs(S)
    if S.get("wayback"):
        wimgs = [w for w in S["wayback"] if w.get("image")]
        def snap(w):
            img = (f'<figure class="rfig" style="margin:12px 0"><picture><source srcset="{w["image"].replace(".png", ".webp")}" type="image/webp"><img src="{w["image"]}" alt="{esc(S["name"])} homepage, {esc(w["date"])}" width="800" height="450" loading="lazy" decoding="async"></picture>'
                   f'<figcaption class="rcap"><b>Figure {nfig + 1 + next(i for i, v in enumerate(wimgs) if v is w)}.</b> {esc(S["name"])}. ({esc(w["date"])}). <em>{esc(w["headline"])}</em> [Archived website screenshot]. Internet Archive Wayback Machine. <a href="{esc(w["source"])}" target="_blank" rel="noopener">{esc(w["source"])}</a></figcaption></figure>') if w.get("image") else ""
            link = "Open snapshot" if "archive.org" in w["source"] else "Open site"
            return (f'<li class="snap"><div class="sb"><b>{esc(w["date"])}</b>{lb(w.get("label", "Wayback"))}</div>'
                    f'{img}<p class="hl">"{esc(w["headline"])}"</p>' + (f'<p class="sp">{esc(w["sub"])}</p>' if w.get("sub") else "") + f'{prices(w.get("prices"))}<div class="ft"><span>{esc(w.get("prices_date", ""))}</span><a href="{esc(w["source"])}" target="_blank" rel="noopener">{link} ↗</a></div></li>')
        tn = panel("then", "Then and now", "What the company's homepage said at different times, from saved copies of the page.", '<ol class="tnow">' + "".join(snap(w) for w in S["wayback"]) + "</ol>")
    fc = panel("facts", "Fact checks", f'Claims people made about {esc(S["name"])}, and what the sources actually show. Checked {esc(S.get("fact_checks_read") or latest_date(x["date"] for x in S["sources"]))}.',
             '<div class="fcards">' + "".join(f'<div class="fcard"><div class="fh">{lb(f["label"])}<span class="src">{esc(f.get("who") or src_name(f))} · {esc(f["date"])}</span></div>'
                                            f'<p class="said"><span>What was said</span>{esc(f["claim"])}</p><p class="found"><span>What we found</span>{esc(f["found"])}</p></div>' for f in S["fact_checks"])
             + '</div><p class="fnote">If we get a number wrong, we fix it here and note the change.</p>')
    ckey = f"lv-{slug}-checks"
    cl = [c if isinstance(c, dict) else {"id": f"c{i + 1}", "text": c, "from": ""} for i, c in enumerate(S["checklist"])]
    ck = sec("todo", "Your checklist", '<span data-school="Small steps that copy what worked here, at low cost.">Small steps that copy what worked here, at low cost and around school.</span> Tick them as you go; star one to keep it in Saved.',
             f'<div class="ckl" data-store="{ckey}" data-slug="{slug}"><div class="ckh"><span class="ckp">0 of {len(cl)}</span><span class="bar"><i></i></span><span class="dev">{ic(I["dev"], 14)}On this device</span></div>'
             + "".join(f'<div class="ckw"><button class="ck" type="button" role="checkbox" aria-checked="false"><span class="bx">{CHK}</span><span class="ct">{esc(c["text"])}</span><span class="cf">{esc(c.get("from", ""))}</span></button><button class="ckstar" type="button" data-staritem="{slug}:{i}" aria-pressed="false" aria-label="Save this item">{ic(I["saved"], 16)}</button></div>' for i, c in enumerate(cl))
             + '<div class="ckf"><span>Ticks stay on this device.</span></div></div>')
    grp = {"Revenue data": [], "Interviews and posts": [], "Archives": []}
    for x in S["sources"]:
        u = (x.get("url") or "") + " " + x["name"]
        grp["Revenue data" if re.search(r"trustmrr|stripe|revenuecat", u, re.I) else "Archives" if re.search(r"archive\.org|wayback", u, re.I) else "Interviews and posts"].append(x)
    srow = lambda x: ((f'<a class="sr2" href="{esc(x["url"])}" target="_blank" rel="noopener">' if x.get("url") else '<div class="sr2">') + src_logo(x)
                      + f'<span><b>{esc(x["name"])}</b><small>{esc(x.get("what", ""))}</small></span><span class="dt">{esc(x["date"])}</span>{lb(x["label"])}'
                      + (f'<span class="ext">{ic(I["ext"], 14)}</span></a>' if x.get("url") else '<span class="ext"></span></div>'))
    src = panel("sources", "Sources", "Everywhere a number or quote in this breakdown comes from, with the date we read it.",
              "".join(f'<h3 class="sgh">{g}</h3><div class="srcl">' + "".join(srow(x) for x in L) + "</div>" for g, L in grp.items() if L)
              + f'<div class="rfoot"><span>Breakdowns by LaunchVault. Not financial advice.</span><span>Last checked {esc(S["numbers"][0]["date"])}</span></div>')
    # truthful gate: there is no checkout yet, so no button that looks like one
    also = "the lessons recap, Fact checks and Then and now" if tn else "the lessons recap and Fact checks"
    gate_html = (f'<div class="gate" id="gate"><h3>{ic(I["lock"], 18)}{f"Phases 2 to {n} are" if n > 2 else "Phase 2 is"} on Pro</h3><p>Pro is $7.99 a month. Payments open soon.</p>'
                 f'<p>Phase 1, the numbers, the checklist and the Sources stay free. Also on Pro: {also}.</p>'
                 '<div class="acts"><a class="btn btn-s" href="/app/account/#parent">Under 18? Send a parent link</a></div>'
                 + JUDGE_FORM.replace('{i}', 'g') + '</div>')
    teaser = f'<div class="gatewrap"><div class="fade" aria-hidden="true">{phase(1, S["phases"][1]).replace(" open>", ">")}</div>{gate_html}</div>' if n > 1 and gate else ""
    phs = sec("phases", "How it happened", f"The story in {n} steps, in order. Each one ends with a lesson you can use.", f'<div class="ptl">{phases_free}' + (teaser + f'<div id="locked" data-locked="1" hidden>{phases_rest}</div>' if gate else phases_rest) + "</div>")
    locked = lambda h: f'<div data-locked="1" hidden>{h}</div>' if gate and h else h
    done = f'<section class="rsec rcard" id="done"><div class="sh"><h2>Mark as read</h2></div><div class="donebox" id="donebox" data-donebox="{slug}"></div></section>'
    recap = sec("lessons", f"The whole story in {n} lesson{'s' if n != 1 else ''}", "Every phase's lesson in one place.",
                '<ol class="recap">' + "".join(f'<li><span class="rn">{i + 1}</span><div><p>{esc(p["lesson"])}</p><a href="#ph{i + 1}">Phase {i + 1}: {esc(p["name"])}</a></div></li>' for i, p in enumerate(S["phases"])) + "</ol>")
    proof = ('<section class="rsec rcard" id="proof"><div class="sh"><h2>Check our work</h2></div>' + intro("Where every claim and number comes from.") + locked(fc) + locked(tn) + src + "</section>")
    nav_items = [("overview", "Overview"), ("chart", "The numbers"), ("phases", "How it happened"), ("todo", "Checklist")] + [("done", "Mark as read"), ("proof", "Check our work")]
    rail = ('<aside class="rrail"><nav class="rtoc" aria-label="On this page"><h2>On this page</h2>' + "".join(f'<a href="#{k}" data-r="{k}"><span>{t}</span><i data-rdone="{k}" hidden>{CHK}</i></a>' for k, t in nav_items) + "</nav>"
            f'<div class="rnext"><h2>Your next step</h2><p data-cknext="{slug}"></p><a class="btn btn-p" href="#todo">Jump to the checklist</a></div></aside>')
    nav = (f'<nav class="snav" aria-label="Sections"><div class="snav-in">' + "".join(f'<a href="#{k}" data-r="{k}">{t}</a>' for k, t in nav_items)
           + f'</div><span class="snph">Phase <b data-curph>1</b> of {n}</span><div class="rprog"><i data-readbar2></i></div></nav>')
    title = S["title"]; em = S.get("title_em")
    t_html = esc(title[:-len(em.rstrip("."))]) + f'<em class="em">{esc(em.rstrip("."))}</em>' if em and title.endswith(em.rstrip(".")) else esc(title)
    over = (f'<section class="rsec rcard sumc" id="overview"><div class="rh"><span class="logo big"><img src="{S["logo"]}" alt="" width="44" height="44"></span><div class="rhm">'
            f'<p class="co"><b>{esc(S["name"])}</b><span class="tag">{esc(S.get("type_label") or S["category"])}</span>{stale_chip}</p><p class="what">{esc(S["what"])}</p><p class="what pat">Pattern: <b>{esc(S["pattern"])}</b></p></div>'
            f'<button type="button" class="star" data-star="{slug}" aria-pressed="false">{ic(I["saved"], 18)}<span>Save</span></button></div>'
            f'<h1>{t_html}</h1><p class="dek">{esc(S["dek"])}</p>{'<button type="button" class="fcmore" data-fcmore data-more="Read the rest" data-less="Show less" aria-expanded="false">Read the rest</button>' if len(S["dek"]) > 170 else ""}{fig_html}{link_row(S)}{first_block(S)}'
            f'<div class="ktiles">{nums}</div>' + (f'<p class="synced">Revenue numbers from TrustMRR, synced {esc(synced)}.{" MRR is what all current subscriptions add up to per month." if any(x["k"] == "MRR" for x in S["numbers"][:3]) else ""}</p>' if synced else "")
            + f'<div class="rmeta"><span>By LaunchVault</span><span>{len(S["sources"])} sources</span><span>{S["read_min"]} min read</span><button type="button" class="rpt" data-report="{esc(slug)}">Report a mistake</button></div></section>')
    from urllib.parse import quote
    talk = (f'<section class="rsec rcard" id="talk"><div class="sh"><h2>Talk about it</h2><span class="meta"># breakdowns</span></div>'
            f'<p class="sint">Share what you are trying from {esc(S["name"])}, or ask how others did. Your message starts with "About {esc(S["name"])}:".</p>'
            f'<a class="btn btn-p" href="/app/community/#breakdowns?about={quote(S["name"])}">Join the conversation</a></section>')
    art = (over + sec("chart", "The numbers", chart_intro(S), chart_block(S))
           + phs + kmoves + locked(recap) + ck + done + talk + proof)
    body = f'{nav}<div class="rd rd2" data-reader="{slug}" data-phases="{n}"><article>{art}</article>{rail}</div>'
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
                 + (f'<a class="tl srcx" href="{esc(u)}" target="_blank" rel="noopener" aria-label="Source">↗</a>' if u and u.startswith("http") else "") + "</div>" for t, l, d, u in know)
    ch = ""
    if e["series"] and len(e["series"]) > 1:
        S = {"name": e["name"], "series": {"what": "Revenue each month", "label": "Verified", "source": s.get("trustmrr_url"), "points": [[k, v, "Verified", "TrustMRR, read from Stripe"] for k, v in e["series"]]},
             "moves": [], "phases": []}
        ch = f'<section class="rsec" id="chart"><div class="sh"><h2>Revenue each month</h2><span class="meta">TrustMRR, read from Stripe · read {esc(e["hd"])}</span></div>{chart_block(S, moves_list=False, band=False)}</section>'
    body = (f'<div class="rd" style="grid-template-columns:minmax(0,1fr)"><article><div class="rh"><span class="logo big"><img src="{e["logo"]}" alt="" width="36" height="36"></span><div>'
            f'<h1>{esc(e["name"])}</h1><p class="dek">{esc(e["what"])}</p><div class="rmeta"><span>{esc(e["type"])}</span><span>Breakdown coming soon</span></div>'
            + (f'<a class="btn btn-s" style="margin-top:12px" href="{esc(s["trustmrr_url"])}" target="_blank" rel="noopener">TrustMRR page <span aria-hidden="true">↗</span></a>' if s.get("trustmrr_url") else "") + '</div></div>'
            f'<section class="rsec" style="margin-top:20px"><div class="nums5" style="grid-template-columns:repeat({len(tiles)},minmax(0,1fr))">{nums}</div></section>{ch}'
            f'<section class="rsec"><div class="sh"><h2>What we know so far</h2><span class="meta">Each fact with its label and date</span></div><div class="card">{kl}</div></section>'
            f'<section class="rsec"><div class="sh"><h2>Read a finished breakdown while you wait</h2><a class="tl" href="/app/library/">Open the Library</a></div>'
            f'<p class="sint">The full {esc(e["name"])} breakdown (phases, fact checks and a checklist) lands here when it is out. These are ready now.</p><div class="scards two" data-sooncards="{e["tab"]}"></div></section>'
            '</article></div>')
    return shell(E, e["name"], e["what"], "", body, crumbs=[("/app/library/", "Library"), ("", e["name"])], scripts='\n<script src="/assets/chart.js" defer></script>')

# ============================================================ home, library and the static pages
def pghead(h, s, attrs=""):
    """Every app page: one visible h1 and one line under it."""
    return f'<h1 class="pg-h"{attrs}>{h}</h1><p class="pg-s">{s}</p>'
def noscript_list(ready):
    return ('<noscript><style>.jsonly{display:none!important}</style><div class="nojs"><p>LaunchVault\'s app needs JavaScript. You can still read the stories on the public blog.</p>'
            + "".join(f'<a href="/blog/{e["slug"]}/">{esc(e["name"])}: {esc(e["title"])}</a>' for e in ready) + "</div></noscript>")
def home(E):
    ready = [e for e in E if e["status"] == "ready"]
    body = f'''<div class="pg home2">{pghead("Welcome back", f"{len(ready)} breakdowns ready. Your progress stays on this device.", " data-hh1").replace('<p class="pg-s">', '<p class="pg-s" data-hsum>')}
<div class="pathnote" id="pathnote" hidden><span><b>Your path is ready:</b> <span data-pathname></span>.</span><a class="tl" href="/app/path/">Open My path</a><button type="button" aria-label="Close" data-closenote>✕</button></div>
<div class="jsonly" data-hstats></div>
<div class="hgrid jsonly"><div class="hmain">
<section class="card hhero" data-hhero aria-label="Your next breakdown"></section>
<section class="card"><div class="ch"><h2>Open checklists</h2><a class="tl" href="/app/checklists/">All checklists</a></div><div data-homecl></div></section>
</div><div class="hrail">
<section class="card" data-hpath></section>
<section class="card hcomm"><div class="ch"><h2>Community</h2><a class="tl" href="/app/community/">Open Community</a></div><div class="cb"><p>Talk with other members in Chat, or browse Threads by topic.</p><ul class="chans"><li><a href="/app/community/">Open Chat</a></li><li><a href="/app/community/#threads">Browse threads</a></li></ul></div></section>
</div></div>
<section class="card hsec jsonly"><div class="ch"><h2 data-hrowt>Top breakdowns</h2><a class="tl" href="/app/library/">Browse all {len(ready)} breakdowns in Library</a></div><div class="scards" data-hcards></div></section>
{noscript_list(ready)}
{soon_list(E)}
</div>'''
    return shell(E, "Home", "Your LaunchVault home.", "home", body)

def saved(E):
    body = f'''<div class="pg">{pghead("Saved", "Stories and steps you starred.")}
<div data-savedempty></div>{noscript_list([e for e in E if e["status"] == "ready"])}
<section class="card hsec" data-savedsec hidden><div class="ch"><h2>Saved stories</h2><span class="meta" data-savedcount></span></div><div class="scards" data-savedcards></div></section>
<section class="card" data-savedsec2 hidden><div class="ch"><h2>Saved checklist steps</h2></div><div data-saveditems></div></section></div>'''
    return shell(E, "Saved", "Stories and checklist items you starred.", "saved", body)

def soon_list(E):
    soon = [e for e in E if e["status"] == "soon"]
    if not soon: return ""
    row = lambda e: (f'<a class="soonrow" href="{e["href"]}"><img src="{e["logo"]}" alt="" width="24" height="24" loading="lazy"><span class="nm">{esc(e["name"])}<small> · {esc(e["type"])}</small></span>'
                     f'<span class="nv"><b>{e["hv"]}</b>{"revenue" + esc(e["hu"]) if e["hu"].startswith(" in ") else esc(e["hu"].strip())}{lb(e["hl"])}{f"""<span class="lb n">Stale</span>""" if e["stale"] else ""}<span>TrustMRR · {esc(e["hd"])}</span></span></a>')
    return ('<section class="lsoon"><h2>Coming soon</h2><p>Real, verified numbers already. The breakdown is still being written.</p><div class="card">' + "".join(row(e) for e in soon) + "</div></section>")
def library(E):
    ready = [e for e in E if e["status"] == "ready"]
    body = f'''<div class="pg">
{pghead("Library", f"{len(ready)} breakdowns. Each ends with a checklist you can start this week.")}
<div class="lbar2 jsonly">
  <label class="lsearch">{ic(I["srch"], 16)}<input type="search" id="lq" placeholder="Search the library" aria-label="Search the library"></label>
  <div class="ltabs" role="group" aria-label="Type"><button type="button" data-tab="all" aria-pressed="true">All</button>{"".join(f'<button type="button" data-tab="{k}" aria-pressed="false">{v}</button>' for k, v in TABS.items())}</div>
  <button class="lfbtn" type="button" id="lfopen" aria-haspopup="dialog">Filters<span class="lfn" data-lfn hidden></span></button>
  <dialog class="lfs" id="lfs" aria-label="Filters">
    <h2 class="lfh">Filters</h2>
    <label class="lfl"><span>Pattern</span><select class="sel" id="lpat" aria-label="Pattern"><option value="">Any pattern</option></select></label>
    <div class="lfl"><span>Progress</span><div class="seg" role="group" aria-label="Progress"><button type="button" data-lp="" aria-pressed="true">Any</button><button type="button" data-lp="prog" aria-pressed="false">In progress</button><button type="button" data-lp="done" aria-pressed="false">Done</button><button type="button" data-lp="saved" aria-pressed="false">Saved</button></div></div>
    <label class="lfl"><span>Sort</span><select class="sel" id="lsort" aria-label="Sort"><option value="new">Newest</option><option value="mrr">Biggest MRR</option><option value="growth">Fastest growth</option><option value="read">Quickest read</option></select></label>
    <button class="btn btn-p lfgo" type="button" data-lfclose data-lfcount>Show {len(ready)} breakdowns</button>
  </dialog>
  <button class="lclear" type="button" id="lclear" hidden>Clear <span aria-hidden="true">×</span><span class="sr"> filters</span></button>
</div>
<p class="lcount jsonly" data-lcount>{len(ready)} breakdowns</p>
<div id="lout" class="scards"></div>
{soon_list(E)}
<p class="lfoot">Revenue read from Stripe by TrustMRR; each number keeps the date it was read. Fastest growth is the average monthly growth between the first and last point of each series.</p>
{noscript_list(ready)}
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
           "{{TN}}": tn, "{{FIGS}}": top_figs(S)[0], "{{FIRST}}": first_block(S), "{{LINKS}}": link_row(S, "srow post-links"), "{{CKS}}": cks, "{{NCK}}": str(len(cl)), "{{SRC}}": src, "{{APP}}": f"/app/story/{S['slug']}/"}
    for k, v in rep.items(): tpl = tpl.replace(k, v)
    if not S.get("highlights"):
        tpl = re.sub(r"<!--HL-->.*?<!--/HL-->", lambda m: '<section class="sec-alt" id="moves-two"><div class="wrap">', tpl, flags=re.S)
        tpl = tpl.replace('<a href="#moves-two">Two moves that mattered</a>', "")
    if not S.get("wayback"): tpl = tpl.replace('<a href="#then-now">Then and now</a>', "")
    return tpl

# ============================================================ blog cards (homepage block + blog index featured)
def card(S, feat=False):
    fcu = (S.get("facts") or {}).get("first_customers") or {}; sh = fcu.get("short") or ""
    pfc = f'<span class="pfc">First customers: {esc(sh)}{(" " + lb(fcu.get("label"))) if sh.lower() != "not public" else ""}</span>' if sh else ""
    alt = f'{esc(S["name"])} breakdown cover'
    pic = f'<picture><source srcset="/assets/covers/{S["slug"]}.webp" type="image/webp"><img src="/assets/covers/{S["slug"]}.png" width="1600" height="900" {"fetchpriority=" + chr(34) + "high" + chr(34) if feat else "loading=" + chr(34) + "lazy" + chr(34)} decoding="async" alt="{alt}"></picture>'
    if feat:
        return (f'<a class="post bfeat" href="/blog/{S["slug"]}/">\n        <div class="cv cover big">{pic}</div>\n        <div class="bd"><h3>{esc(S["title"])}</h3><p>{esc(S["dek"])}</p>{pfc}\n'
                f'          <span class="by"><i><svg width="11" height="11" style="stroke:#60A5FA" aria-hidden="true"><use href="#i-lv"/></svg></i>LaunchVault · {S["read_min"]} min read · {dlab(S["published"])}</span>\n'
                '          <span class="bgo">Read the breakdown <span aria-hidden="true">→</span></span></div></a>')
    return (f'<a class="post" href="/blog/{S["slug"]}/"><div class="cv cover">{pic}</div>\n        <div class="bd"><h3>{esc(S["title"])}</h3><p>{esc(S["dek"])}</p>{pfc}'
            f'<span class="by"><i><svg width="11" height="11" style="stroke:#60A5FA" aria-hidden="true"><use href="#i-lv"/></svg></i>LaunchVault · {S["read_min"]} min read</span></div></a>')
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
            art = art.replace("</div>\n      </article>", f'<a class="go" href="/blog/{S["slug"]}/">Read<span class="sr"> the {esc(name)} breakdown</span></a></div>' + NL + "      </article>", 1)
        return art
    sec2 = re.sub(r'<article class="bcard[^"]*" data-cat="[^"]*" data-story="([^"]+)">.*?</article>', one, sec, flags=re.S)
    if sec2 != sec: wr(p, s[:a] + sec2 + s[b:])

BASE = "https://www.launchvault.ca"   # the live domain (primary on Vercel; launchvault.ca and launchvault-site.vercel.app redirect here); same as the og:image links in build.py
def add_meta():
    """Every built page gets a canonical link, og:title/description/type/url and a Twitter card (build.py's head only has og:image).
    The 404 pages get no canonical or og:url. Runs after both builds; pages are rewritten on every build, so this never stacks."""
    pages = [os.path.join(ROOT, f) for f in ("index.html", "404.html")]
    for d in ("blog", "legal", "welcome", "sign-in", "sign-up", "app"):
        pages += [os.path.join(dp, f) for dp, _, fs in os.walk(os.path.join(ROOT, d)) for f in fs if f == "index.html"]
    for p in pages:
        t = rd(p)
        if "twitter:card" in t: continue
        rel = os.path.relpath(p, ROOT).replace(os.sep, "/"); url = BASE + "/" + rel[:-len("index.html")] if rel.endswith("index.html") else None
        if rel in ("404.html", "app/not-found/index.html", "welcome/callback/index.html"): url = None
        title = re.search(r"<title>(.*?)</title>", t, re.S).group(1); desc = re.search(r'<meta name="description" content="(.*?)">', t, re.S).group(1)
        m = []
        if 'property="og:title"' not in t: m += [f'<meta property="og:title" content="{title}">', f'<meta property="og:description" content="{desc}">']
        m += [f'<meta property="og:type" content="{"article" if rel.startswith("blog/") and rel.count("/") == 2 else "website"}">', '<meta property="og:site_name" content="LaunchVault">']
        if url: m += [f'<meta property="og:url" content="{url}">', f'<link rel="canonical" href="{url}">']
        m += ['<meta name="twitter:card" content="summary_large_image">']
        assert t.count('<meta name="robots" content="noindex">') == 1, rel + ": every page must stay noindex until launch"
        wr(p, t.replace('<meta name="robots" content="noindex">', '<meta name="robots" content="noindex">' + NL + NL.join(m), 1))

def write_sitemap():
    """Public pages and posts. The preview stays noindex (robots.txt Disallow + X-Robots-Tag); the sitemap is ready for launch."""
    urls = ["/"] + ["/" + out[:-len("index.html")] for out, *_ in build.PAGES if out.endswith("index.html") and out != "index.html"]
    body = "".join(f"  <url><loc>https://www.launchvault.ca{u}</loc></url>{NL}" for u in sorted(set(urls), key=lambda u: (u != "/", u)))
    wr(os.path.join(ROOT, "sitemap.xml"), '<?xml version="1.0" encoding="UTF-8"?>' + NL
       + "<!-- Preview build: robots.txt says Disallow and every page sends noindex, on purpose, until launch. This sitemap lists the public pages for then. -->" + NL
       + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + NL + body + "</urlset>" + NL)

# ============================================================ covers for new stories
def make_cover(S):
    png = os.path.join(ROOT, "assets", "covers", S["slug"] + ".png")
    if os.path.exists(png): return "kept"
    pts = S["series"]["points"]; vs = [p[1] for p in pts]
    # y axis always starts at $0 (same rule as the app charts): nice ticks from 0 to just over the high
    raw = max(vs) or 1; mag = 10 ** math.floor(math.log10(raw / 3))
    step = next(m * mag for m in (1, 2, 2.5, 5, 10) if raw / (m * mag) <= 4)
    lo = 0; hi = math.ceil(max(vs) / step) * step
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
# (question, answers, optional hint). Answer COUNT and ORDER must not change without updating QW below.
QUIZ = [
    ("How many hours a week could you spend on a project of your own?", ["Under 5 hours", "About 10 hours", "15 hours or more"]),
    ("How much money could you spend to get a project started?", ["$0", "Under $100", "Under $1,000"], "Think of a domain, a tool subscription or ads. $0 is a fine answer."),
    ("Do you know how to code, even a little?", ["Yes, I can code", "A little", "Not yet"]),
    ("What are you already good at, even a little?", ["Design, video or writing", "Talking to people", "Not sure yet, and that's fine"]),
    ("Who around you has a problem you could help fix?", ["Someone in my family", "A local shop or business", "People in an online group I'm in", "No one comes to mind yet"]),
    ("Which would you most enjoy doing?", ["Building an app people use", "Doing a job for real clients", "Testing an idea fast and changing it"]),
    ("Where do you and your friends spend time online?", ["Reddit or Discord", "TikTok or Instagram", "Not sure"]),
    ("When would you like to make your first sale?", ["This month", "By the end of this school term", "No rush"]),
]
# answer -> patterns it points to. Each key is a story's real pattern line (PAT); main() expands it to every ready story with that pattern,
# so a new story with a known pattern is matched without touching this table. Editorial mapping, not data.
PAT = {"FREE": "Give it away free, charge for the easy version", "CLOSE": "Start with a problem someone close to you has", "REBUILD": "Throw away the first version when nobody pays",
       "SERVICE": "Start with a small, cheap service, then sell the bigger one", "WORK": "Start with a problem you saw at work", "WAVE": "Ride a wave",
       "TOOLS": "Sell the tools to people already in the game", "AUD": "Build the audience first, then the app"}
QW = [[{"CLOSE": 2}, {"SERVICE": 1, "FREE": 1, "AUD": 1, "TOOLS": 1}, {"FREE": 2, "WORK": 1, "WAVE": 1}],
      [{"FREE": 2, "CLOSE": 2, "AUD": 2}, {"CLOSE": 2, "SERVICE": 1, "REBUILD": 1, "WAVE": 1}, {"SERVICE": 2, "WORK": 2, "TOOLS": 2}],
      [{"FREE": 2, "CLOSE": 1, "WAVE": 1}, {"CLOSE": 1, "REBUILD": 1, "WAVE": 1}, {"SERVICE": 2, "AUD": 2, "TOOLS": 1}],
      [{"SERVICE": 2, "FREE": 1, "AUD": 3}, {"SERVICE": 2, "REBUILD": 2, "TOOLS": 1}, {"CLOSE": 1, "REBUILD": 1, "WAVE": 1}],
      [{"CLOSE": 3}, {"SERVICE": 3}, {"FREE": 2, "WORK": 1, "TOOLS": 2, "AUD": 1}, {"REBUILD": 2, "FREE": 1, "WAVE": 2}],
      [{"FREE": 2, "CLOSE": 2, "WAVE": 1, "AUD": 1}, {"SERVICE": 3, "TOOLS": 1}, {"REBUILD": 2, "WORK": 2, "WAVE": 2}],
      [{"FREE": 2, "TOOLS": 1}, {"CLOSE": 1, "SERVICE": 1, "WAVE": 2, "AUD": 2}, {}],
      [{"REBUILD": 2, "SERVICE": 1, "TOOLS": 1}, {"WORK": 1, "CLOSE": 1, "WAVE": 1}, {"FREE": 2, "AUD": 2}]]
def quiz_weights(ready):
    """QW by pattern -> weights by story slug, for the ready stories. Warns when a story's pattern is not in PAT (it can't be matched until it is)."""
    by = {}
    for S in ready: by.setdefault(S["pattern"], []).append(S["slug"])
    for S in ready:
        if S["pattern"] not in PAT.values(): print(f"quiz: no mapping for the pattern of {S['slug']}: {S['pattern']!r}")
    return [[{s: v for k, v in a.items() for s in by.get(PAT[k], [])} for a in q] for q in QW]
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
    def phase_of(S, frm): return next(((i + 1, p["lesson"]) for i, p in enumerate(S["phases"]) if p["name"] == frm), (0, ""))
    steps = [{"id": c["id"], "text": c["text"], "from": c["from"], "n": int(c["id"][1:]), "task": TASKS.get(c["id"], ""), "ph": phase_of(pz, c["from"])[0], "why": phase_of(pz, c["from"])[1]} for c in [pz_ck[i] for i in (0, 1, 5, 3, 2)]]
    APPDATA = {
        "stories": [{k: e[k] for k in ("slug", "name", "title", "tab", "type", "what", "logo", "pattern", "lessons", "hv", "hu", "hl", "hd", "hm", "hs", "first", "firstl", "sub", "status", "stale", "href", "read", "published", "mrr", "growth")}
                    | {"spark": spark(e["series"]), "phases": len(e["S"]["phases"]), "nt": [[re.sub(r"\s*\(.*?\)", "", x["k"]), x["v"], x["date"]] for x in e["S"]["numbers"][:3]], "ns": len(e["S"]["sources"]), "nsd": latest_date(x["date"] for x in e["S"]["sources"]), "site": (e["S"].get("links") or {}).get("site") or e["S"].get("site", "")} for e in E if e["status"] == "ready"],
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
        "quiz": [{"q": t[0], "o": t[1], "w": w, **({"h": t[2]} if len(t) > 2 else {})} for t, w in zip(QUIZ, quiz_weights(ready))],
        "search_extra": [x for S in ready for x in (
                            [{"t": f"{S['name']} · phase {i + 1}: {ph['name']}", "k": " ".join([ph["name"], ph["story"], ph["lesson"]]), "h": f"/app/story/{S['slug']}/#ph{i + 1}", "g": "Phases"} for i, ph in enumerate(S["phases"])]
                            + [{"t": f"{S['name']} move {i + 1}: {m['text']} · {m['when']}", "h": f"/app/story/{S['slug']}/#chart", "g": "Moves"} for i, m in enumerate(S["moves"])]
                            + [{"t": f"{S['name']} · checklist: {(c['text'] if isinstance(c, dict) else c)[:70]}", "k": (c["text"] if isinstance(c, dict) else c), "h": f"/app/story/{S['slug']}/#todo", "g": "Checklists"} for c in S["checklist"]]
                            + [{"t": f"{S['name']} · fact check: {f['claim'][:70]}", "k": f["claim"] + " " + f["found"], "h": f"/app/story/{S['slug']}/#facts", "g": "Fact checks"} for f in S["fact_checks"]]
                            + [{"t": f"{S['name']} · key move: {h['title']}", "k": h["text"], "h": f"/app/story/{S['slug']}/#two", "g": "Moves"} for h in S.get("highlights", [])]
                            + [{"t": f"{S['name']} · {lbl}: {(f.get('text') or '')[:70]}", "k": f.get("text") or "", "h": f"/app/story/{S['slug']}/#overview", "g": "Facts"} for key, lbl in (("first_customers", "first customers"), ("first_revenue", "first money"), ("cost_to_start", "cost to start"), ("team", "team")) for f in [(S.get("facts") or {}).get(key)] if isinstance(f, dict) and f.get("text")]
                            + [{"t": f"{S['name']} · {so['name']}", "k": so["name"] + " " + so.get("what", ""), "h": f"/app/story/{S['slug']}/#sources", "g": "Sources"} for so in S["sources"]])],
    }
    out = lambda rel, t: wr(os.path.join(ROOT, "app", rel, "index.html") if rel else os.path.join(ROOT, "app", "index.html"), t)
    out("", home(E)); out("library", library(E)); out("saved", saved(E))
    for S in ready:
        # this week's breakdown (newest story whose data isn't stale) is free; every other story keeps the Pro gate after phase 1
        page = reader(E, S, gate=S["slug"] != WEEK)
        out(f"story/{S['slug']}", page)
    shutil.rmtree(os.path.join(ROOT, "app", "postiz"), ignore_errors=True)   # old alias: vercel.json redirects /app/postiz/ to /app/story/postiz/
    for e in E:
        if e["status"] == "soon": out(f"story/{e['slug']}", soon_page(E, e))
    out("path", static_page(E, "path", "My path", "Your path, built from your quiz answers.", "path"))
    out("checklists", static_page(E, "checklists", "Checklists", "Every checklist, ticked on this device.", "ck").replace("{{NCK}}", str(len(ready[0]["checklist"]))))
    out("community", shell(E, "Community", "Talk with other LaunchVault members.", "chat", rd(os.path.join(SRC, "app", "community.body.html")), scripts='\n<script src="/assets/community.js" defer></script>'))
    out("assistant", shell(E, "Ask LaunchVault", "Ask about your idea and get matched stories and a plan.", "ask", rd(os.path.join(SRC, "app", "assistant.body.html")), scripts='\n<script src="/assets/assistant.js" defer></script>'))
    out("account", static_page(E, "account", "Account", "Your account, plan, email and data.", "acct"))
    out("not-found", static_page(E, "notfound", "Not found", "This page isn't in the app.", ""))
    wr(os.path.join(ROOT, "app", "start", "index.html"), head("Welcome · LaunchVault", "Set up your LaunchVault path.") + "<body>\n" + rd(os.path.join(SRC, "app", "start.body.html"))
       + f'\n<script type="application/json" id="lvapp">{json.dumps(APPDATA, separators=(",", ":"))}</script>\n<script src="/assets/auth.js" defer></script>\n<script src="/assets/app.js" defer></script>\n</body>\n</html>\n')
    # Clerk OAuth lands here, then goes on to /app/ (returning) or /app/start/ (new). Unused while LV_AUTH is false.
    wr(os.path.join(ROOT, "welcome", "callback", "index.html"), head("Signing you in · LaunchVault", "Finishing sign-in.", gate=False) + '<body><main class="pg narrow" id="main"><p class="note" role="status">Signing you in…</p></main>' + NL + '<script src="/assets/auth.js"></script>' + NL + '<script>window.LVAuth && LVAuth.callback().catch(() => location.replace("/sign-in/"));</script>' + NL + '</body>' + NL + '</html>' + NL)
    # public side: generated blog posts (Postiz keeps its hand-made post; its generated twin goes to _gen for the parity check)
    for S in ready:
        post = blog_post(S, E)
        wr(os.path.join(SRC, f"post-{S['slug']}.body.html"), post)
        make_cover(S)
        if not any(p[0] == f"blog/{S['slug']}/index.html" for p in build.PAGES):
            build.PAGES.insert(2, (f"blog/{S['slug']}/index.html", f"post-{S['slug']}.body.html", f"{S['title']} · LaunchVault", S["dek"], "blog", False, False, ""))
    update_cards(ready, {e["slug"] for e in E if e["stale"]})
    update_story_cards(ready)
    build.WEEK = WEEK   # the public nav button and hero open this week's story
    build.main()
    write_sitemap()
    # the public posts load the shared chart renderer
    for S in ready:
        p = os.path.join(ROOT, "blog", S["slug"], "index.html"); t = rd(p)
        if "chart.js" not in t: wr(p, t.replace("</body>", '<script src="/assets/chart.js" defer></script>\n</body>').replace("</head>", '<link rel="stylesheet" href="/assets/chart.css">\n</head>'))
    add_meta()
    print(f"app: {len(E)} stories ({len(ready)} ready, {len(E) - len(ready)} coming soon)")
    return ready, E

if __name__ == "__main__":
    main()
