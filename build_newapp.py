"""Build the NEW LaunchVault dashboard under /new/app/ (Paper "LaunchVault · App" > Dashboard, 1:1). The live /app/ is not touched.

Reuses build_app.py for all data and page bodies (same story JSON, same APPDATA, same hooks), with three changes:
  1. its shell()/head() are swapped for the Vault shell below (floating glass sidebar, top bar, five phone tabs);
  2. everything it writes under app/ lands in new/app/ with /app/ and /sign-in/ links prefixed by /new; all its other
     outputs (blog posts, covers, sitemap, public build) are skipped;
  3. the dark base stylesheets are generated from the live light ones (scripts/darken.py) into assets/newapp/.
Hand-written for the new app: assets/newapp/vault.css, app.js, ui.js (+ path-prefixed forks of auth/profile/assistant/community.js).
Run:  python build_newapp.py
"""
import json, os, re, sys, types
ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ROOT); sys.path.insert(0, os.path.join(ROOT, "scripts"))
import build, build_app as B, darken

esc, NL, ic = B.esc, B.NL, B.ic
PRE = "/new"                                   # route prefix: the app lives at /new/app/, sign-in at /new/sign-in/
NA = "/assets/newapp"
_PATHS = re.compile(r"(?<![\w/.-])/(app/|sign-in|sign-up)")
def rewrite(t): return _PATHS.sub(lambda m: PRE + "/" + m.group(1), t)
assert rewrite('href="/app/x/" /assets/app.css https://www.launchvault.ca/app/ next=/app/a /new/app/ "/sign-in/"') == 'href="/new/app/x/" /assets/app.css https://www.launchvault.ca/app/ next=/new/app/a /new/app/ "/new/sign-in/"'

_Z = "v=Math.max(.8,Math.min(1,w/1440,innerHeight/860));"
assert _Z in build.ZOOM, "build.ZOOM changed: update the 90% display scale hook"
ZOOM = "<script>window.LV_BASEZ=.9</script>" + build.ZOOM.replace(_Z, _Z + "v*=window.LV_BASEZ||1;")
# sidebar full / slim: set before first paint, toggled by [data-sbtog] (default full on desktop, slim on tablet)
SIDEJS = ("<script>(function(){var d=document.documentElement,k='lv-side';"
          "function def(){return innerWidth>1100?'full':'min'}function get(){try{return localStorage.getItem(k)}catch(e){return null}}"
          "var cur=get()||def();function apply(){d.classList.toggle('sb-min',cur==='min');d.classList.toggle('sb-full',cur==='full');"
          "var b=document.querySelector('[data-sbtog]');if(b){var f=cur==='full';b.setAttribute('aria-expanded',f);b.setAttribute('aria-label',f?'Collapse sidebar':'Expand sidebar');b.title=f?'Collapse sidebar':'Expand sidebar'}}"
          "apply();document.addEventListener('DOMContentLoaded',apply);document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-sbtog]');"
          "if(!b)return;cur=cur==='full'?'min':'full';try{localStorage.setItem(k,cur)}catch(x){}d.classList.add('sb-anim');apply()})})();</script>")

# Paper icon set (dash3.py A.IC)
P = {"home": "M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z", "lib": "M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2zM4 21V5",
     "path": "M5 19c4 0 4-14 8-14s3 7 6 7M5 19a2 2 0 1 0 0 .01M19 12a2 2 0 1 0 0 .01", "ck": "M4 6l2 2 3-3M4 13l2 2 3-3M12 6h8M12 13h8M12 19h8",
     "ask": "M4 5h16v11H9l-5 4z", "user": "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1.5-4 5-5 8-5s6.5 1 8 5",
     "saved": "M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z",
     "chat": "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.8-3.5 3.4-5 6.5-5s5.7 1.5 6.5 5M16 4.3a3.5 3.5 0 0 1 0 6.4M18 15c2 .6 3.2 2.3 3.5 5",
     "bell": "M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0", "srch": "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5",
     "chev": "M9 6l6 6-6 6", "back": "M15 6l-6 6 6 6", "tog": ""}
def pi(k, w=19, sw=1.8): return f'<svg width="{w}" height="{w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="{P[k]}"/></svg>'
LV = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19.99 14.91A8.5 8.5 0 1 1 10.52 3.63"/><path d="M6.8 15.6l3.7-3.7 2.6 2.6 6.7-6.7"/><path d="M16 7.8h3.8v3.8"/></svg>'
TOG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16"/></svg>'
STAR = pi("saved", 17)
def cover(slug): return f"/assets/real/{slug}.jpg" if os.path.exists(os.path.join(ROOT, "assets", "real", slug + ".jpg")) else ""

def head(title, desc, extra="", og_slug="", gate=True):
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
{ZOOM}
{SIDEJS}
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<meta name="robots" content="noindex">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/assets/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#07070A">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="{NA}/app-dark.css">{extra}
<link rel="stylesheet" href="{NA}/vault.css">{B.GATE if gate else ""}
</head>
'''

def reader_hero(e):
    """Paper Story reader hero: image, company line, phase title, meta, clickable phase stepper. ui.js keeps it on the current phase."""
    S = e["S"]; n = len(S["phases"]); cv = cover(e["slug"])
    steps = "".join(f'<a href="#ph{i + 1}" data-rstep="{i + 1}"><i></i><span>{i + 1}. {esc(p.get("short") or p["name"])}</span></a>' for i, p in enumerate(S["phases"]))
    return (f'<header class="rhero" data-rhero>{f"""<div class="cv rhcv"><img src="{cv}" alt="" width="960" height="540" fetchpriority="high"></div>""" if cv else ""}'
            f'<div class="rhfl"><a class="circ" href="{PRE}/app/library/" aria-label="Back to Library">{pi("back", 18, 2.2)}</a>'
            f'<button class="circ" type="button" data-star="{e["slug"]}" aria-pressed="false" aria-label="Save this story">{STAR}<span class="sr">Save</span></button></div>'
            f'<div class="rht"><p class="rhm"><span class="tile"><img src="{S["logo"]}" alt="" width="16" height="16"></span><b>{esc(S["name"])} · {esc(e["type"])}</b>{B.lb(e["hl"])}</p>'
            f'<h1 class="rhh" data-rtitle>Phase 1: {esc(S["phases"][0]["name"])}</h1>'
            f'<p class="rhs">{S["read_min"]} min read · {len(S["sources"])} sources · numbers read {esc(e["hd"])}</p>'
            f'<nav class="stepper lab" aria-label="Phases" data-rsteps style="--n:{n}">{steps}</nav></div></header>')

def reader_extras(e, body):
    """Fact check card for the right rail (same lock as the full Fact checks panel) + the phase action bar."""
    S = e["S"]; locked = 'data-locked="1" hidden' in body or "data-locked=\"1\" hidden" in body
    rows = "".join(f'<li>{B.lb(f["label"])}<b>{esc(f["claim"])}</b><span>{esc(f.get("who") or B.src_name(f))} · {esc(f["date"])}</span></li>' for f in S["fact_checks"][:4])
    fc = (f'<section class="card rfc"{" data-locked=" + chr(34) + "1" + chr(34) + " hidden" if locked else ""}><div class="ch"><h2>Fact check</h2>'
          f'<button type="button" class="tl" data-report="{esc(e["slug"])}">Report a mistake</button></div><ul>{rows}</ul>'
          f'<a class="tl" href="#facts">All {len(S["fact_checks"])} fact checks</a></section>')
    bar = ('<div class="rbar" data-rbar><div class="rbar-in"><button class="btn btn-p" type="button" data-rdonebtn>Mark phase done'
           + '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 3l4 4-4 4"/></svg></button>'
           '<button class="btn btn-s" type="button" data-rnextbtn><span data-rnextl>Next</span></button></div></div>')
    return fc, bar

def shell(E, title, desc, active, body, crumbs=None, wide=False, scripts="", og_slug=""):
    ready = [e for e in E if e["status"] == "ready"]; week = next((e for e in ready if not e["stale"]), ready[0])
    A = PRE + "/app/"
    nav = [("home", A, "Home", ""), ("lib", A + "library/", "Library", f'<span class="cnt">{len(ready)}</span>'), ("ask", A + "assistant/", "Ask", '<span class="cnt" data-cnt="ask"></span>'),
           ("saved", A + "saved/", "Saved", '<span class="cnt" data-cnt="saved"></span>'), ("chat", A + "community/", "Community", ""),
           ("path", A + "path/", "My path", '<span class="cnt" data-cnt="path"></span>'), ("ck", A + "checklists/", "Checklists", '<span class="cnt" data-cnt="ck"></span>')]
    story = next((e for e in E if "story-" + e["slug"] == active), None) if active.startswith("story-") else None
    son = "lib" if (story or (crumbs and active == "")) else active
    cur = lambda k: ' aria-current="page"' if k == son else ""
    side = "".join(f'<a class="si" href="{h}"{cur(k)} title="{t}">{"<span class=\"sion\" aria-hidden=\"true\"></span>" if k == son else ""}{pi(k)}<span class="t">{t}</span>{c}</a>' for k, h, t, c in nav)
    ton = {"saved": "acct", "chat": "acct", "ck": "path"}.get(son, son)
    tabs = "".join(f'<a href="{h}"{" aria-current=\"page\"" if k == ton else ""}>{"<span class=\"tabon\" aria-hidden=\"true\"></span>" if k == ton else ""}{pi(i, 21)}<span>{t}</span></a>'
                   for k, i, h, t in [("home", "home", A, "Home"), ("lib", "lib", A + "library/", "Library"), ("path", "path", A + "path/", "Path"), ("ask", "ask", A + "assistant/", "Ask"), ("acct", "user", A + "account/", "You")])
    wcv = cover(week["slug"])
    cont = (f'<a class="sbc" href="{week["href"]}" data-sbcont>{f"""<span class="cv"><img src="{wcv}" alt="" width="376" height="212" loading="lazy"></span>""" if wcv else ""}'
            f'<span class="r"><b data-sbcn>This week: {esc(week["name"])}</b><small data-sbcp></small></span><span class="bar"><i data-sbcb></i></span></a>')
    css = "".join(f'\n<link rel="stylesheet" href="{NA}/{n}-dark.css">' for n in ("chart", "community", "assistant") if n + ".js" in scripts)
    hero = fc = rbar = ""
    if story and story["status"] == "ready":
        hero = reader_hero(story); fc, rbar = reader_extras(story, body)
        body = body.replace('<aside class="rrail">', '<aside class="rrail">' + fc, 1)
        body = body.replace("<h1>", '<h2 class="st">', 1).replace("</h1>", "</h2>", 1)   # the hero carries the page's h1
    cls = " ".join(x for x in ("nv", "has-back" if crumbs else "", "is-reader" if hero else "", "p-" + (active.split("-")[0] or "x")) if x)
    back = f'<a class="mback" href="{crumbs[0][0]}">{pi("back", 16, 2)}<span>{esc(crumbs[0][1])}</span></a>' if crumbs else ""
    scripts = scripts.replace("/assets/community.js", f"{NA}/community.js").replace("/assets/assistant.js", f"{NA}/assistant.js")
    return (head(title + " · LaunchVault", desc, css, og_slug) + f'''<body class="{cls}">
<a class="skip" href="#main">Skip to content</a>
<div class="shell">
<aside class="side" aria-label="App">
  <div class="sbh"><a class="brand" href="{A}" aria-label="LaunchVault app home">{LV}<span>LaunchVault</span></a><button class="sbtog" type="button" data-sbtog aria-expanded="true" aria-label="Collapse sidebar">{TOG}</button></div>
  <button class="srch sbs" type="button" data-cmd>{pi("srch", 16, 2)}<span>Search</span><kbd>⌘K</kbd></button>
  <nav aria-label="Main">{side}</nav>
  <div class="foot">{cont}
    <div class="plan" data-state="free"><div><b data-plan>Free plan</b><small data-plansub>1 of {len(ready)} stories open</small></div><a href="{A}account/#plan" data-upg>Get Pro</a></div>
    <a class="sbme" href="{A}account/"{' aria-current="page"' if active == "acct" else ""} title="Account and settings"><span class="av" data-av aria-hidden="true">{pi("user", 18)}</span><span class="t"><b data-me>Your account</b><small>Account and settings</small></span>{pi("chev", 14, 2)}</a>
  </div>
</aside>
<div class="main">
  <div class="prev" id="prevbar" role="status">&nbsp;</div>
  <header class="top">
    {back}<span class="sp"></span>
    <button class="srch" type="button" data-cmd>{pi("srch", 16, 2)}<span>Search stories, steps, answers</span><kbd>⌘K</kbd></button>
    <div class="avw bellw"><button class="rbtn" type="button" data-bell aria-expanded="false" aria-controls="bellm" aria-label="Recent activity">{pi("bell", 17, 1.9)}</button><div class="avm bellm" id="bellm" aria-label="Recent activity" hidden></div></div>
    <div class="avw"><button class="avb" type="button" data-avb aria-expanded="false" aria-controls="avm" aria-label="Account menu"><span class="av" data-av aria-hidden="true">{pi("user", 18)}</span></button><div class="avm" id="avm" aria-label="Account" hidden></div></div>
  </header>
  <main id="main">
{hero}{body}{rbar}
  </main>
</div>
</div>
<nav class="tabs" aria-label="App tabs">{tabs}</nav>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<script type="application/json" id="lvapp">{json.dumps(B.APPDATA, separators=(",", ":"))}</script>
<script type="application/json" id="lvcov">{json.dumps({e["slug"]: cover(e["slug"]) for e in E if cover(e["slug"])}, separators=(",", ":"))}</script>
<script src="{NA}/auth.js" defer></script>
<script src="{NA}/app.js" defer></script>
<script src="{NA}/profile.js" defer></script>{scripts}
<script src="{NA}/ui.js" defer></script>
</body>
</html>
''')

# ---- new page bodies (same hooks as build_app.py, Paper layout) ----
def home(E):
    ready = [e for e in E if e["status"] == "ready"]
    body = f'''<div class="pg home2"><h1 class="pg-h" data-hh1>Welcome back.</h1><p class="pg-s" data-hsum>{len(ready)} stories ready.</p>
<div class="pathnote" id="pathnote" hidden><span><b>Your path is ready:</b> <span data-pathname></span>.</span><a class="tl" href="/app/path/">Open My path</a><button type="button" aria-label="Close" data-closenote>✕</button></div>
<section class="card hhero jsonly sk" data-hhero aria-label="Your next story"></section>
<div class="h3 jsonly"><section class="card hstep sk" data-hstep></section><section class="card hask" data-hask></section><section class="card hpath sk" data-hpath></section></div>
<div class="hrail jsonly"><section class="card hcomm"><div class="ch"><h2>Community</h2><a class="tl" href="/app/community/">Open</a></div><p>Talk with other members in Chat, or browse Threads by topic. Calm on purpose: no likes, no read receipts.</p></section></div>
<div class="sech jsonly"><h2 data-hrowt>Read next</h2><a class="tl" href="/app/library/">All stories</a></div>
<div class="scards rn jsonly" data-hcards></div>
{B.noscript_list(ready)}
{B.soon_list(E)}
</div>'''
    return shell(E, "Home", "Your LaunchVault home.", "home", body)

def library(E):
    ready = [e for e in E if e["status"] == "ready"]; wk = next((e for e in ready if not e["stale"]), ready[0]); cv = cover(wk["slug"])
    feat = (f'<a class="card feat" href="{wk["href"]}">{f"""<span class="cv"><img src="{cv}" alt="" width="960" height="540"></span>""" if cv else ""}<span class="ft"><span class="fk">Free this week</span>'
            f'<span class="fh">{esc(wk["title"] if wk["title"].startswith(wk["name"]) else wk["name"] + ": " + wk["title"])}</span><span class="fp">Every phase is open to everyone this week. {"The other " + str(len(ready) - 1) + " open phase 1 free." if len(ready) > 1 else ""}</span>'
            f'<span class="btn btn-p">Read it free<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 3l4 4-4 4"/></svg></span></span></a>')
    body = f'''<div class="pg lib">
<h1 class="pg-h">Library</h1><p class="pg-s">{len(ready)} founder stories, every number sourced.</p>
<label class="lsearch jsonly">{pi("srch", 16, 2)}<input type="search" id="lq" placeholder="Search the library" aria-label="Search the library"></label>
{feat}
<div class="lbar2 jsonly">
  <div class="ltabs chips" role="group" aria-label="Type"><button type="button" data-tab="all" aria-pressed="true">All {len(ready)}</button>{"".join(f'<button type="button" data-tab="{k}" aria-pressed="false">{v}</button>' for k, v in B.TABS.items())}</div>
  <span class="sp"></span>
  <button class="lclear tl" type="button" id="lclear" hidden>Clear<span class="sr"> filters</span></button>
  <button class="lfbtn" type="button" id="lfopen" aria-haspopup="dialog">Filters<span class="lfn" data-lfn hidden></span></button>
  <label class="lsortw">Sort: <select id="lsort" aria-label="Sort"><option value="new">Newest</option><option value="mrr">Biggest MRR</option><option value="growth">Fastest growth</option><option value="read">Quickest read</option></select></label>
  <dialog class="lfs" id="lfs" aria-label="Filters">
    <h2 class="lfh">Filters</h2>
    <label class="lfl"><span>Pattern</span><select class="sel" id="lpat" aria-label="Pattern"><option value="">Any pattern</option></select></label>
    <div class="lfl"><span>Progress</span><div class="seg" role="group" aria-label="Progress"><button type="button" data-lp="" aria-pressed="true">Any</button><button type="button" data-lp="prog" aria-pressed="false">In progress</button><button type="button" data-lp="done" aria-pressed="false">Done</button><button type="button" data-lp="saved" aria-pressed="false">Saved</button></div></div>
    <button class="btn btn-p lfgo" type="button" data-lfclose data-lfcount>Show {len(ready)} stories</button>
  </dialog>
</div>
<p class="lcount sr" data-lcount role="status">{len(ready)} breakdowns</p>
<div id="lout" class="scards"></div>
{B.soon_list(E)}
<p class="lfoot">Revenue read from Stripe by TrustMRR; each number keeps the date it was read. Fastest growth is the average monthly growth between the first and last point of each series.</p>
{B.noscript_list(ready)}
</div>'''
    return shell(E, "Library", "Every LaunchVault story, with its numbers labelled and dated.", "lib", body)

def main():
    out_dir = os.path.join(ROOT, "new", "app"); app_dir = os.path.join(ROOT, "app") + os.sep
    A = os.path.join(ROOT, "assets"); N = os.path.join(A, "newapp"); os.makedirs(N, exist_ok=True)
    # 1. dark base stylesheets from the live light ones
    darken.selftest()
    for f in darken.FILES:
        src = B.rd(os.path.join(A, f + ".css")).replace('"Schibsted Grotesk"', '"Inter"').replace('"Inter Tight"', '"Inter"')
        B.wr(os.path.join(N, f + "-dark.css"), f"/* GENERATED by build_newapp.py (scripts/darken.py) from /assets/{f}.css. Do not edit: edit vault.css. */\n" + rewrite(darken.darken(src)))
    # 2. run build_app's page generation with the Vault shell; only its app/ pages are kept, redirected to new/app/
    real_wr, real_rd, n = B.wr, B.rd, [0]
    def wr(p, t):
        if not os.path.abspath(p).startswith(app_dir): return
        t = t.replace("<body>" + NL, '<body class="nv ob-page">' + NL, 1)   # the quiz page writes its own body tag
        for j in ("auth", "app"): t = t.replace(f'src="/assets/{j}.js"', f'src="{NA}/{j}.js"')   # the quiz page writes its own script tags
        n[0] += 1; real_wr(os.path.join(out_dir, os.path.relpath(p, app_dir)), rewrite(t))
    def rd(p):   # a page body in src/newapp/ wins over the live one in src/app/
        alt = os.path.join(ROOT, "src", "newapp", os.path.basename(p))
        t = real_rd(alt if os.path.dirname(p).endswith(os.path.join("src", "app")) and os.path.exists(alt) else p)
        if os.path.basename(p) == "account.body.html":   # phone "You" screen (Paper Settings · Phone): profile header + "Your things", above the live account sections
            a = '<p class="pg-s">Your profile, preferences, plan and data.</p>'; assert a in t, "account body changed"
            row = lambda k, cls, h, t_, c="": f'<a href="{h}"><span class="ico {cls}">{pi(k, 17)}</span><b>{t_}</b>{c}{pi("chev", 14, 2.2)}</a>'
            t = t.replace(a, a + '<div class="you"><span class="av" data-av aria-hidden="true">' + pi("user", 30) + '</span><b data-me>Your account</b><span data-auth-email></span>'
                          '<span class="youp"><span data-plan>Free plan</span><a href="/app/account/#plan" data-upg>Get Pro</a></span></div>'
                          '<h2 class="sech2 youh">Your things</h2><nav class="grp yout" aria-label="Your things">'
                          + row("saved", "e", "/app/saved/", "Saved", '<span class="cnt" data-cnt="saved"></span>') + row("chat", "v", "/app/community/", "Community")
                          + row("ck", "m", "/app/checklists/", "Checklists", '<span class="cnt" data-cnt="ck"></span>') + '</nav><h2 class="sech2 youh">Account</h2>', 1)
        return t
    norm_ready = B.norm_ready
    def nr(S, legacy): e = norm_ready(S, legacy); e["cover"] = cover(S["slug"]); return e
    noop = lambda *a, **k: None
    B.wr, B.rd, B.head, B.shell, B.home, B.library, B.norm_ready = wr, rd, head, shell, home, library, nr
    B.make_cover = B.update_cards = B.update_story_cards = B.write_sitemap = B.add_meta = build.main = noop
    B.shutil = types.SimpleNamespace(rmtree=noop)
    ready, E = B.main()
    print(f"newapp: {n[0]} pages -> new/app/")

if __name__ == "__main__":
    main()
