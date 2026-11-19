"""Generate the hero demo window (a crop of the logged-in LaunchVault app) from real data.

Sources (nothing else): data/stories.json and src/post-postiz.body.html (Postiz lessons).
Rewrites the block between <div class="winfit" id="winfit"> and <p class="prov"> in src/index.body.html,
and embeds the company data as JSON (#lvdata) for the in-window views. Run, then `python build.py`.
    python src/_hero_gen.py
"""
import json, os, re, html
HERE = os.path.dirname(os.path.abspath(__file__)); SITE = os.path.dirname(HERE)
D = json.load(open(os.path.join(SITE, "data", "stories.json"), encoding="utf-8"))
ST = {s["company"]: s for s in D["stories"]}
PZ = ST["Postiz"]
POST = open(os.path.join(HERE, "post-postiz.body.html"), encoding="utf-8").read()
LESSONS = re.findall(r'class="lesson">([^<]+)</p>', POST)
assert len(LESSONS) == 6, "expected 6 Postiz lessons"
MON = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()
esc = html.escape
def money(v): return "${:,}".format(v)
def mlab(ym): y, m = ym.split("-"); return f"{MON[int(m) - 1]} {y}"
def dlab(d): y, m, dd = d.split("-"); return f"{MON[int(m) - 1]} {int(dd)} {y}"
def dshort(d): y, m, dd = d.split("-"); return f"{MON[int(m) - 1]} {int(dd)}"
LBC = {"Verified": "v", "Live": "l", "Wayback": "w", "Claimed": "c", "Sources differ": "x", "Couldn't verify": "n", "Estimate": "e"}
def lb(l): return f'<span class="lb {LBC[l]}">{esc(l)}</span>'
def headline(s):
    h = s["headline"]
    return (money(h["value"]), f' in {mlab(h["month"])}') if h["measure"] == "revenue in month" else (money(h["value"]), " MRR")
CAT = {"ai": "AI tool", "mobile": "Mobile app", "services": "Service"}
def spark_paths(months):
    ks = sorted(months); vs = [months[k] for k in ks]; top = max(vs) or 1; n = len(vs)
    pts = [(3 + i * 234 / max(1, n - 1), 58 - v / top * 48) for i, v in enumerate(vs)]
    ln = "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in pts)
    return ln + f" L{pts[-1][0]:.1f} 64 L{pts[0][0]:.1f} 64 Z", ln, ks
def spark(s, cls="spark"):
    ar, ln, ks = spark_paths(s["monthly"]["months"])
    lab = f'{s["company"]} revenue each month, {mlab(ks[0])} to {mlab(ks[-1])}: ' + ", ".join(money(s["monthly"]["months"][k]) for k in ks)
    return f'<svg class="{cls}" viewBox="0 0 240 64" preserveAspectRatio="none" role="img" aria-label="{esc(lab)}"><path class="ar" d="{ar}"/><path class="ln" d="{ln}"/></svg>'
# Postiz has no TrustMRR monthly series in the data; its shape is the breakdown chart's own points (founder posts + TrustMRR)
PZ_AR = "M3.0 60.9 L93.0 60.2 L102.0 59.4 L129.0 59.3 L165.0 58.4 L174.0 51.0 L192.0 46.3 L201.0 43.0 L219.0 37.8 L237.0 7.4 L237.0 64 L3.0 64 Z"
PZ_LN = "M3.0 60.9 L93.0 60.2 L102.0 59.4 L129.0 59.3 L165.0 58.4 L174.0 51.0 L192.0 46.3 L201.0 43.0 L219.0 37.8 L237.0 7.4"
PZ_SPARK = f'<svg class="spark" viewBox="0 0 240 64" preserveAspectRatio="none" aria-hidden="true"><path class="ar" d="{PZ_AR}"/><path class="ln" d="{PZ_LN}"/></svg>'
def logo(s, w):
    if s["company"] == "Postiz": return f'<img src="/assets/logos/postiz.svg" alt="" width="{w}" height="{round(w * 160 / 145)}">'
    return f'<img src="/{s["logo"].replace("site/", "")}" alt="" width="{w}" height="{w}" loading="lazy" decoding="async">'
SOON = [s for s in D["stories"] if s["status"] == "coming soon"]
# screen-reader table for the hero chart (same points as the Postiz story file)
_PZJ = json.load(open(os.path.join(SITE, "data", "stories", "postiz.json"), encoding="utf-8"))["series"]
PZ_TABLE = ('<table class="sr"><caption>Postiz monthly revenue</caption><tr><th>Month</th><th>Value</th><th>Label</th></tr>'
            + "".join(f'<tr><td>{(_PZJ.get("point_dates") or {}).get(p[0]) or mlab(p[0])}</td><td>{money(p[1])}</td><td>{p[2]}</td></tr>' for p in _PZJ["points"]) + "</table>")
# a company with a story file (data/stories/<slug>.json) has a breakdown now: the window shows it as Ready
import sys; sys.path.insert(0, SITE); from build_app import TODAY
_SD = os.path.join(SITE, "data", "stories")
READY = {os.path.splitext(f)[0] for f in os.listdir(_SD) if f.endswith(".json") and json.load(open(os.path.join(_SD, f), encoding="utf-8")).get("published", "") <= TODAY}
NSOON = len([s for s in SOON if s["slug"] not in READY]); NREADY = 1 + len([s for s in SOON if s["slug"] in READY])
st_txt = lambda s: "Ready" if s["slug"] in READY else ("Stale" if s.get("stale") else "Soon")
SIDE_SOON = [ST[n] for n in ("DM Champ", "Stencil AI", "Windmill Growth", "Gojiberry")]

# ---- data for the in-window views (JS reads #lvdata) ----
def fact(v):
    if isinstance(v, dict): return {"t": v["text"], "l": v.get("label"), "d": v.get("date")}
    return None
CO = {}
for s in SOON:
    hv, hu = headline(s); m = s.get("monthly", {}).get("months")
    know = []
    if s.get("stale"): know.append({"t": f'Last synced on TrustMRR {dlab(s["mrr"]["date"])}. No newer verified revenue.', "l": "Couldn't verify", "d": "read " + dlab(s["mrr"]["read_on"])})
    if s.get("mrr"): know.append({"t": f'MRR {money(s["mrr"]["value"])}', "l": s["mrr"]["label"], "d": dlab(s["mrr"]["date"])})
    if s.get("alltime"): know.append({"t": f'Revenue, all-time {money(s["alltime"]["value"])}', "l": s["alltime"]["label"], "d": dlab(s["alltime"]["date"])})
    if s.get("claim"): know.append({"t": f'Founder said {s["claim"]["text"]} ({s["claim"]["source"]})', "l": s["claim"]["label"], "d": mlab(s["claim"]["date"])})
    fc = fact(s.get("first_customers"))
    if fc: know.append({"t": "First customers: " + fc["t"], "l": fc["l"], "d": (dlab(fc["d"]) if fc["d"] and len(fc["d"]) == 10 else mlab(fc["d"]) if fc["d"] else "")})
    tm = fact(s.get("team"))
    if tm: know.append({"t": "Team: " + tm["t"], "l": tm["l"], "d": dlab(tm["d"]) if tm["d"] else ""})
    know.append({"t": "Revenue read by TrustMRR from " + s["payment_source"].replace(" (API key)", ""), "l": None, "d": ""})
    CO[s["slug"]] = {"name": s["company"], "cat": CAT.get(s["category"], ""), "what": s["what"], "num": hv, "unit": hu,
                     "sub": (f'MRR {money(s["mrr"]["value"])} · {dlab(s["mrr"]["date"])}' if s.get("mrr") else ""),
                     "logo": "/" + s["logo"].replace("site/", ""), "src": s["trustmrr_url"].replace("https://", ""),
                     "range": [mlab(min(m)), mlab(max(m))] if m else None, "stale": bool(s.get("stale")), "know": know}
DATA = {"co": CO, "lessons": LESSONS,
        "search": [["Postiz", "postiz", "", "Ready"]] + [[s["company"], "soon", s["slug"], CAT.get(s["category"], "")] for s in SOON]
                  + [["Checklists", "checklists", "", "Postiz"], ["My path", "path", "", "2 of 6"], ["Library", "breakdowns", "", f"{len(SOON) + 1} stories"]]}

def ic(d, w=16): return f'<svg width="{w}" height="{w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{d}</svg>'
HOME = ic('<path d="M4 11l8-7 8 7v9H4z"/>')
LIB = ic('<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>')
PATH = ic('<circle cx="6" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><path d="M8 6h7a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h7"/>')
CKS = ic('<path d="M10 6h10M10 12h10M10 18h10"/><path d="M4 6l1.2 1.2L7 5.2M4 12l1.2 1.2L7 11.2M4 18l1.2 1.2L7 17.2"/>')
SRCH = ic('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>', 14)
CHK = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'
CK = PZ["checklist"]

# sidebar
side_soon = "".join(f'<button class="si co" type="button" data-go="soon" data-co="{s["slug"]}"><i class="plg">{logo(s, 16)}</i>{esc(s["company"])}<span class="cnt">{st_txt(s)}</span></button>' for s in SIDE_SOON)
# Postiz KPIs
def kpi(k, v, f, src):
    return f'<button class="kpi" type="button" aria-pressed="false"><span class="k">{k}</span><span class="kv">{v}</span><span class="m">{lb(f["label"])}{dlab(f["date"])}</span><span class="ksrc" title="{esc(src)}">{esc(src)}</span></button>'
kpis = (kpi("MRR", money(PZ["headline"]["value"]), PZ["headline"], f'TrustMRR, from Stripe · {dlab(PZ["headline"]["date"])}')
        + kpi("Revenue, all-time", money(PZ["alltime"]["value"]), PZ["alltime"], f'TrustMRR, from Stripe · {dlab(PZ["alltime"]["date"])}')
        + kpi("Subscriptions", "{:,}".format(PZ["subscriptions"]["value"]), PZ["subscriptions"], f'TrustMRR, from Stripe · {dlab(PZ["subscriptions"]["date"])}')
        + kpi("GitHub stars", "{:,}".format(PZ["github_stars"]["value"]), PZ["github_stars"], f'GitHub, gitroomhq/postiz-app · {dlab(PZ["github_stars"]["date"])}'))
# phase band (phase names/dates from the data; each phase's lesson from the breakdown)
SPAN = [(-2, 0), (0, 8), (8, 17), (17, 25), (25, 32), (32, 34)]
SHORT = ["Before", "Building", "Open source", "Users who stay", "Turning point", "Scale"]
band = ""
for i, ph in enumerate(PZ["phases"]):
    full, when = [x.strip() for x in ph.split("·")]
    band += f'<button class="pseg{" on" if i == 4 else ""}" type="button" data-a="{SPAN[i][0]}" data-b="{SPAN[i][1]}" data-full="{esc(full)}" data-when="{esc(when)}" data-lesson="{esc(LESSONS[i])}" aria-label="{esc(full)}, {esc(when)}. Lesson: {esc(LESSONS[i])}">{SHORT[i]}</button>'

# Library rows: every story, with its real monthly series
def lrow(s):
    if s["company"] == "Postiz":
        return (f'<div class="lset" data-cat="ready"><button class="lrow vrow" type="button" data-go="postiz" data-st="ready"><span class="lc"><span class="lg">{logo(s, 18)}</span><b>Postiz</b></span>'
                f'<span class="ltp">Open source</span><span class="ltr">{PZ_SPARK}</span><span class="lnum"><b>{money(s["headline"]["value"])}</b> MRR · {dshort(s["headline"]["date"])}</span>{lb("Verified")}<span class="ls ok">Ready</span></button></div>')
    hv, hu = headline(s); trend = spark(s) if s.get("monthly") else '<span class="noser">No monthly series</span>'
    status = '<span class="ls ok">Ready</span>' if s["slug"] in READY else f'<span class="ls st">Stale · {dshort(s["mrr"]["date"])}</span>' if s.get("stale") else '<span class="ls">Coming soon</span>'
    return (f'<div class="lset" data-cat="{s["category"]}"><button class="lrow vrow" type="button" data-go="soon" data-co="{s["slug"]}" data-st="{s["category"]}"><span class="lc"><span class="lg">{logo(s, 18)}</span><b>{esc(s["company"])}</b></span>'
            f'<span class="ltp">{CAT[s["category"]]}</span><span class="ltr">{trend}</span><span class="lnum"><b>{hv}</b>{hu}</span>{lb(s["headline"]["label"])}{status}</button></div>')
TABS = D["tabs"]
lib_rows = lrow(PZ) + "".join(lrow(ST[next(s["company"] for s in SOON if s["slug"] == slug)]) for cat in ("ai", "mobile", "services") for slug in TABS[cat])
read_on = sorted({s["monthly"]["read_on"] for s in SOON if s.get("monthly")})
# Home: biggest months on the list (same month for a fair comparison)
octs = sorted([s for s in SOON if s["headline"]["measure"] == "revenue in month" and s["headline"]["month"] == "2026-10"], key=lambda s: -s["headline"]["value"])[:3]
top_rows = "".join(f'<button class="hsoon" type="button" data-go="soon" data-co="{s["slug"]}"><span class="lg">{logo(s, 20)}</span><b>{esc(s["company"])}</b><span class="hs-n"><b>{money(s["headline"]["value"])}</b> in Oct 2026</span>{lb("Verified")}</button>' for s in octs)
DM = ST["DM Champ"]; dmv, dmu = headline(DM)
# checklist + path
ck_rows = "".join(f'<button class="ck" type="button" aria-pressed="{"true" if i < 2 else "false"}"><span class="bx">{CHK}</span><span class="ct">{esc(c["text"])}</span><span class="cf">{esc(c["from"])}</span></button>' for i, c in enumerate(CK))
order = [(0, "done"), (1, "done"), (5, "now"), (3, ""), (2, "")]
steps = ""
for n, (i, st) in enumerate(order, 1):
    c = CK[i]; dot = CHK if st == "done" else str(n)
    txt = f"<b>{esc(c['text'])}</b>" if st == "now" else esc(c["text"])
    btn = '<button class="btn btn-p btn-sm pdone" type="button" aria-pressed="false">Mark step done</button>' if st == "now" else ""
    steps += f'<div class="pst{(" " + st) if st else ""}"><span class="pdot">{dot}</span><div><p>{txt}</p><span class="pmeta">Checklist item {i + 1} · {esc(c["from"])}</span>{btn}</div></div>'
GJ = ST["Gojiberry"]
src7 = [("trustmrr.png", "TrustMRR: Postiz", "MRR, all-time revenue, subscriptions, read from Stripe", dlab(PZ["headline"]["date"]), "Verified"),
        ("github.svg", "GitHub: gitroomhq/postiz-app", "{:,} stars".format(PZ["github_stars"]["value"]), dlab(PZ["github_stars"]["date"]), "Live"),
        ("internetarchive.png", "Wayback Machine: postiz.com", "Homepage Jul 2024, pricing Sep 2024", "archived", "Wayback"),
        ("devto.png", "The founder on Dev.to", "Open source, n8n, affiliates, revenue to $14K", "Nov 2025", "Claimed"),
        ("mixergy.png", "Mixergy interview", 'The OpenClaw turning point, "$45,000 per month"', "Mar 2026", "Claimed"),
        ("superframeworks.png", "Superframeworks case study", "Gitroom, the SEO spend, monthly revenue", "Jul 2026", "Claimed"),
        ("postiz.svg", "Postiz blog", "The X content system, a $186,713 Stripe chart", "Sep 2026", "Claimed")]
for lg_, *_ in src7: assert os.path.exists(os.path.join(SITE, "assets", "logos", lg_)), lg_
# the drawer's 7 sources are the breakdown's own source list
for _, n, *_ in src7: assert n.split(":")[0].split(" ")[0] in POST, n
src_rows = "".join(f'<li><img class="blogo" src="/assets/logos/{a}" alt="" width="20" height="20" loading="lazy" decoding="async"><span class="sr-t"><b>{esc(n)}</b><span>{esc(d)}</span></span><span class="sr-dt">{dt}</span>{lb(l)}</li>' for a, n, d, dt, l in src7)
sparks_tpl = "".join(f'<div data-co="{s["slug"]}">{spark(s)}</div>' for s in SOON if s.get("monthly"))

H = f'''    <div class="winfit" id="winfit">
    <div class="win" id="win">
      <div class="chrome"><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="url"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg><span id="wurl">/library/postiz</span></span><span class="sp"></span></div>
      <div class="app">
        <aside class="side" aria-label="Dashboard sidebar">
          <div class="ws"><svg width="20" height="20" aria-hidden="true"><use href="#i-lv"/></svg>LaunchVault</div>
          <button class="si" type="button" data-go="home">{HOME}Home</button>
          <button class="si" type="button" data-go="breakdowns">{LIB}Library<span class="cnt">{len(SOON) + 1}</span></button>
          <button class="si" type="button" data-go="path">{PATH}My path<span class="cnt">2/6</span></button>
          <button class="si" type="button" data-go="checklists">{CKS}Checklists<span class="cnt">1</span></button>
          <div class="grp">This week</div>
          <button class="si co on" type="button" data-go="postiz" aria-current="page"><i class="plg">{logo(PZ, 14)}</i>Postiz<span class="cnt rd" aria-hidden="true"><i></i></span></button>
          <div class="grp">{"New breakdowns" if all(x["slug"] in READY for x in SIDE_SOON) else "Coming soon"}</div>
          {side_soon}
          <button class="si more" type="button" data-go="breakdowns">{len(SOON) - len(SIDE_SOON)} more in the library</button>
          <div class="splan"><span>Free plan</span><a href="/#pricing">Upgrade</a></div>
        </aside>
        <div class="main" id="wmain">
          <div class="tbar">
            <span class="bc" id="wcrumb"><button class="crumb" type="button" data-go="breakdowns">Library</button><span aria-hidden="true">/</span><b id="wcur">Postiz</b></span>
            <label class="search">{SRCH}<input id="wsearch" type="text" placeholder="Search breakdowns" aria-label="Search breakdowns" autocomplete="off" spellcheck="false"><kbd>Ctrl K</kbd>
              <span class="sres" id="sres" role="listbox" aria-label="Search results" hidden></span></label>
            <span class="fplan"><b>Free</b> plan</span>
          </div>
          <div class="rprog" aria-hidden="true"><i></i></div>
          <div class="vwrap">
          <div class="view vpost" data-view="postiz">
            <div class="rhead"><span class="tile plg">{logo(PZ, 24)}</span>
              <div class="rh-t"><b>Postiz: almost two years under $15K a month, then $431K</b><span class="rh-m">Breakdown 01<i>·</i>7 sources<i>·</i>10 min<i>·</i>Last checked {dlab(PZ["headline"]["date"])}</span></div>
              <span class="acts"><button class="btn btn-s btn-sm" type="button" id="srcbtn" aria-expanded="false" aria-controls="sdrawer">Sources · 7</button><a class="btn btn-p btn-sm" href="/blog/postiz/">Open breakdown</a></span></div>
            <div class="kpis">{kpis}</div>
            <div class="body2">
              <div class="panel chartp">
                <div class="ch-h">
                  <div><div class="t2">Why the line moved</div><div class="big">{money(PZ["headline"]["value"])}<small>a month, up from about $700 in Sep 2024</small></div></div>
                  <div class="dtabs seg" role="tablist" aria-label="Chart range"><button type="button" role="tab" aria-selected="false" data-range="12">1Y</button><button type="button" role="tab" aria-selected="true" data-range="all">All</button></div>
                </div>
                <div class="legend"><span><i class="lg-l"></i>MRR</span><span><i class="lg-v"></i>Verified</span><span><i class="lg-c"></i>Claimed</span><span><i class="lg-x"></i>Sources differ</span><span><i class="lg-m">1</i>Founder's move</span></div>
                <div class="plot" id="plot"><svg id="chart" role="img" aria-label="Postiz monthly revenue, Sep 2024 to Nov 2026: under $15K for over a year, then rising to {money(PZ["headline"]["value"])} verified on {dlab(PZ["headline"]["date"])}."></svg>{PZ_TABLE}<div class="tip" id="tip" role="status"></div></div>
                <div class="pband" id="pband" role="group" aria-label="Phases on the same time axis">{band}<span class="ptip" id="ptip" role="status"></span></div>
              </div>
              <div class="panel moves"><div class="hd"><b>The founder's moves</b><span>8 moves</span></div><ol id="moves"></ol><button class="mvall" type="button" aria-expanded="false" aria-controls="moves">See all 8 moves</button></div>
            </div>
          </div>
          <div class="view vx" data-view="home" hidden>
            <div class="hcont"><span class="tile plg">{logo(PZ, 22)}</span>
              <span class="hc-t"><b>Continue reading: Postiz</b><span>Breakdown 01 · 10 min read · 8 moves · 6 phases</span><span class="hbar"><i></i></span></span>
              <button class="btn btn-p btn-sm hres" type="button" data-go="postiz">Resume <span aria-hidden="true">→</span></button></div>
            <div class="hgrid">
              <div class="hcol"><div class="hcard2"><div class="hc-h"><b>Being checked now</b><span>Numbers checked · story in progress</span></div>
                <button class="hnext" type="button" data-go="soon" data-co="{DM["slug"]}"><span class="lg big">{logo(DM, 36)}</span>
                  <span class="hn-t"><b>{esc(DM["company"])}</b><span class="hn-d">{esc(DM["what"])}</span>
                  <span class="hn-n"><b>{dmv}</b>{dmu} {lb(DM["headline"]["label"])}</span>
                  <span class="hn-s">MRR {money(DM["mrr"]["value"])} · {dlab(DM["mrr"]["date"])} · TrustMRR</span>
                  <span class="hn-s">{lb(DM["claim"]["label"])} "{esc(DM["claim"]["text"])}" · {esc(DM["claim"]["source"])} · {mlab(DM["claim"]["date"])}</span></span></button></div>
              <div class="hcard2 hfill"><div class="hc-h"><b>Biggest months on the list</b><span>October 2026 revenue</span></div>{top_rows}</div></div>
              <div class="hcol"><div class="hcard2"><div class="hc-h"><b>Open checklists</b><button class="hlink" type="button" data-go="checklists">All checklists</button></div>
                <button class="hck" type="button" data-go="checklists"><span class="plg sm">{logo(PZ, 16)}</span><span class="hk-t"><b>Postiz · What you could do at 15 to 20</b><span>Next: {esc(CK[2]["text"].split(". ")[0])}</span></span><span class="hk-b"><i style="width:33%"></i></span><span class="hk-n">2 of 6</span></button>
                <button class="hck" type="button" data-go="path"><span class="pi">{PATH}</span><span class="hk-t"><b>My path · from your checklist</b><span>Next: {esc(CK[5]["text"].split(". ")[0])}</span></span><span class="hk-b vi"><i style="width:33%"></i></span><span class="hk-n">2 of 6</span></button></div>
              <div class="hcard2 hfill hlesson"><div class="hc-h"><b>This week's lesson</b><span>Postiz · The turning point</span></div>
                <p class="hl-q">{esc(LESSONS[4])}</p>
                <button class="hlink hl-go" type="button" data-go="postiz">Read the phase <span aria-hidden="true">→</span></button></div></div>
            </div>
          </div>
          <div class="view vx" data-view="breakdowns" hidden>
            <div class="vtool"><div class="vfilt seg" role="group" aria-label="Filter stories"><button type="button" aria-pressed="true" data-vf="all">All {len(SOON) + 1}</button><button type="button" aria-pressed="false" data-vf="ai">AI tools</button><button type="button" aria-pressed="false" data-vf="mobile">Mobile apps</button><button type="button" aria-pressed="false" data-vf="services">Services</button></div>
              <span class="vnote">{NREADY} ready · {NSOON} coming soon</span></div>
            <div class="ltab" id="bdlist">
              <div class="lt-h" aria-hidden="true"><span>Company</span><span>Type</span><span>Trend</span><span>Latest number</span><span>Label</span><span>Status</span></div>
              <div class="lbody">{lib_rows}</div>
            </div>
            <p class="vfoot">Read from Stripe or RevenueCat by TrustMRR on {", ".join(dlab(d) for d in read_on)}. Gojiberry last synced {dlab(GJ["mrr"]["date"])}.</p>
          </div>
          <div class="view vx" data-view="checklists" hidden>
            <div class="ckh"><span class="plg sm">{logo(PZ, 18)}</span><b>Postiz</b><span>· What you could do at 15 to 20</span><button class="hlink" type="button" data-go="postiz">Open breakdown</button></div>
            <div class="ckcard">
              <div class="ckp"><b id="ckpn">2 of 6 · 33%</b><span class="ckbar"><i id="ckbar" style="width:33.3%"></i></span><span class="ckdev">On this device</span></div>
              <div class="wck" id="wck">{ck_rows}</div>
              <div class="ckf"><span>Ticks stay on this device. Pro saves them to your account.</span></div>
            </div>
            <button class="ckpath" type="button" data-go="path"><span class="pi">{PATH}</span><span class="hk-t"><b>My path · from your checklist</b><span>Steps 1 to 5 share ticks with this checklist</span></span><span class="hk-b vi"><i style="width:33%"></i></span><span class="hk-n">2 of 6</span></button>
            <button class="cksoon" type="button" data-go="breakdowns"><span class="cks-t">{"".join(f'<span class="lg">{logo(s, 18)}</span>' for s in SIDE_SOON)}</span><span>{NREADY - 1} more checklists in the app</span><em>Every breakdown ends with one</em></button>
          </div>
          <div class="view vx" data-view="path" hidden>
            <div class="pgrid">
              <div class="psteps"><div class="ps-h"><span class="plg sm">{logo(PZ, 14)}</span><b>From the Postiz breakdown</b><span>A tick here is a tick in the checklist</span></div>{steps}</div>
              <div class="pcol">
                <div class="phead2"><b>Your path · 2 of 6 · 33%</b><span>Six steps that fit around school and cost little. Each one comes from a breakdown.</span><span class="hk-b vi big"><i style="width:33%"></i></span></div>
                <div class="ponly"><div class="ps-h"><b>Path-only step</b><span>Not in a checklist</span></div>
                  <div class="pst"><span class="pdot">6</span><div><p>Ask for money early.</p><span class="pmeta">Pattern from Gojiberry · {esc(fact(GJ["first_customers"])["t"].split(". ")[0])} {lb(GJ["first_customers"]["label"])}</span></div></div></div>
                <div class="hcard2 pside"><div class="hc-h"><b>Stories behind these steps</b></div>
                  <button class="hlike" type="button" data-go="postiz"><span class="lg">{logo(PZ, 18)}</span><b>Postiz</b><span class="hl-n">Steps 1 to 5</span><span class="hl-s ok">Ready</span></button>
                  <button class="hlike" type="button" data-go="soon" data-co="{GJ["slug"]}"><span class="lg">{logo(GJ, 18)}</span><b>Gojiberry</b><span class="hl-n">Step 6</span><span class="hl-s{" ok" if GJ["slug"] in READY else ""}">{st_txt(GJ)}</span></button></div>
              </div>
            </div>
          </div>
          <div class="view vx vfillv" data-view="soon" hidden>
            <div class="soon-c"><span class="lg big" id="sotile"></span>
              <div class="so-b"><div class="so-h"><b id="soname"></b><span id="socat"></span></div>
                <p class="so-w" id="sowhat"></p>
                <p class="so-n"><b id="sonum"></b><small id="sounit"></small> <span class="lb v" id="solb">Verified</span><span class="so-s" id="sosub"></span></p></div>
              <div class="so-a"><button class="btn btn-s btn-sm" type="button" data-go="postiz">Back to Postiz</button><a class="btn btn-p btn-sm" href="/app/library/">Open the Library</a></div></div>
            <div class="so-row">
              <div class="so-chart"><div class="hc-h"><b>Revenue each month</b><span id="sorange"></span></div><div class="so-spk" id="sospark"></div><div class="so-ax"><span id="soax0"></span><span id="soax1"></span></div></div>
              <div class="so-know"><div class="hc-h"><b>What we know so far</b><span id="sosrc"></span></div><ul id="soknow"></ul></div>
            </div>
            <template id="so-sparks">{sparks_tpl}</template>
          </div>
          <div class="sdrawer" id="sdrawer" role="dialog" aria-label="Postiz sources" aria-hidden="true" inert>
            <div class="sd-h"><b>Sources</b><span>Every link checked {dlab(PZ["headline"]["date"])}</span><button class="sd-x" type="button" aria-label="Close sources"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
            <ol class="sd-l">{src_rows}</ol>
            <a class="sd-f" href="/blog/postiz/">Read them in the breakdown <span aria-hidden="true">→</span></a>
          </div>
          </div>
        </div>
      </div>
      <script type="application/json" id="lvdata">{json.dumps(DATA, ensure_ascii=False).replace("</", "<\\/")}</script>
    </div>
    </div>
'''
p = os.path.join(HERE, "index.body.html"); s = open(p, encoding="utf-8").read()
a = s.index('    <div class="winfit" id="winfit">'); b = s.index('    <p class="prov">')
open(p, "w", encoding="utf-8").write(s[:a] + H + s[b:])
for s_ in SOON: assert os.path.exists(os.path.join(SITE, s_["logo"].replace("site/", ""))), s_["logo"]
print("hero written:", len(SOON), "coming-soon stories,", len(LESSONS), "lessons")
