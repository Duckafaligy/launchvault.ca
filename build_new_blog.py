"""The blog under /blog/: the index, 10 company breakdowns and 3 guides, plus feed.xml, sitemap.xml and llms.txt.

    python build_new.py        picks this file up (register(B) below) and builds everything
    python build_new_blog.py   runs the self-check (titles, JSON-LD, links) without writing pages

Content is READ from the live sources and never invented here:
    data/stories/<slug>.json   company breakdowns (numbers, series, facts, phases, fact checks, wayback, checklist, sources)
    src/post-{chart,small,verified}.body.html   the three guides (their text is re-shelled, not rewritten)
A section whose data is missing is left out. Sentences this file writes itself only restate fields of the story (name, number, date, label)
or arithmetic on the monthly series.

Launch switch: set INDEXABLE = True to drop noindex from the blog pages (everything else, JSON-LD, canonical, feed, sitemap, llms.txt,
is already in place). Page styles/scripts: assets/new/blog.css, assets/new/blog.js. Images: assets/real/, assets/new/blog/.
"""
import datetime, glob, html, json, os, re
from urllib.parse import quote, urlparse

INDEXABLE = False                 # the one switch to flip at launch
FEATURED = "rezi"
ROOT = os.path.dirname(os.path.abspath(__file__))
IMG = "/assets/new/blog/"
REPORT_HREF = "legal/privacy/"    # "Report a mistake" target, relative to / (no public contact address exists yet)

# <= 60 characters each (checked at build). Only facts already in the post title.
SEO_TITLE = {
    "rezi": "Rezi: a Reddit template to $216K a month | LaunchVault",
    "boothie": "Boothie: $208K in five months on TikTok | LaunchVault",
    "stencil-ai": "Stencil AI: $16K to $63K a month in 2026 | LaunchVault",
    "postiz": "Postiz: under $15K a month, then $431K | LaunchVault",
    "dm-champ": "DM Champ: from $10K to $28K a month | LaunchVault",
    "gojiberry": "Gojiberry: a $0 waitlist to a $407K month | LaunchVault",
    "aeo-engine": "AEO Engine: an old agency's $204K month | LaunchVault",
    "mindset": "Mindset: $24K a month from a YouTube audience | LaunchVault",
    "upscale-b2b": "Upscale B2B: $3 inboxes to $99K a month | LaunchVault",
    "windmill-growth": "Windmill Growth: $500 a month to $118K | LaunchVault",
    "how-to-read-a-revenue-chart": "How to read a revenue chart | LaunchVault",
    "three-ways-to-start-small": "Three ways to start small | LaunchVault",
    "what-verified-means": "What 'Verified' means on LaunchVault",
}
CAPTURE = {"stencil-ai", "mindset", "upscale-b2b"}   # covers that are homepage captures, not the company's share image
GUIDES = [  # slug, source file key, photographer, alt text, one-line description (from build.py's page list)
    ("how-to-read-a-revenue-chart", "chart", "Isaac Smith", "A hand-drawn line chart on paper with a pen and a metal ruler on a wooden desk",
     "MRR, all-time revenue, and what a sudden jump on the line actually means."),
    ("three-ways-to-start-small", "small", "Ionela Mat", "A blank notebook and a pen next to a laptop on a desk",
     "A family member's problem, a service you can sell now, or a free version people can try. A real example of each."),
    ("what-verified-means", "verified", "Sasun Bughdaryan", "A magnifying glass lying on a dark surface",
     "Where our revenue numbers come from, why some are labelled Claimed, and why every number has a date."),
]
CHIP = {"Verified": "verified", "Live": "live", "Wayback": "wayback", "Claimed": "claimed", "Sources differ": "differ"}
LB = {"v": "Verified", "c": "Claimed", "x": "Sources differ", "l": "Live", "w": "Wayback", "n": "Couldn't verify"}
MON = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()
CHECK = '<svg viewBox="0 0 12 12" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 6.4l2.4 2.4 4.6-5.2"/></svg>'
CHEV = '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 4.5l3.5 3.5 3.5-3.5"/></svg>'
ICON = lambda p, cls="ic": f'<svg class="{cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="{p}"/></svg>'
I_LINK = "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"
I_X = "M4 4l16 16M20 4L4 20"
I_REDDIT = "M12 20a8 5 0 1 0 0-10 8 5 0 0 0 0 10zM15 6l2-3M9.5 14.5h.01M14.5 14.5h.01"
I_OK = "M5 12.5l4.5 4.5L19 7"

E = lambda s: html.escape(str(s), quote=True)
read = lambda *p: open(os.path.join(ROOT, *p), encoding="utf-8").read()
money = lambda v: f"${v:,.0f}"
host = lambda u: urlparse(u).netloc.replace("www.", "")
slugify = lambda s: re.sub(r"[^a-z0-9]+", "-", re.sub(r"<[^>]+>|&[a-z#0-9]+;", "", s).lower()).strip("-")
text = lambda s: html.unescape(re.sub(r"<[^>]+>", "", s)).strip()
dot = lambda s: s if s.rstrip()[-1:] in ".!?\"'”" else s.rstrip() + "."


def fdate(d):
    return f"{MON[d.month - 1]} {d.day} {d.year}"


def pdate(s):
    """'Nov 18 2026' -> date (None when the string is looser, like 'Sep 2024')."""
    m = re.fullmatch(r"([A-Z][a-z]{2}) (\d{1,2}) (\d{4})", s or "")
    return datetime.date(int(m[3]), MON.index(m[1]) + 1, int(m[2])) if m else None


def chip(label, sm=True):
    return f'<span class="chip{" chip-sm" if sm else ""} chip-{CHIP.get(label, "unverified")}">{E(label)}</span>'


def ext(href, inner, cls=""):
    return f'<a{f" class={cls!r}" if cls else ""} href="{E(href)}" target="_blank" rel="noopener">{inner}</a>'


def describe(s, n=155):
    """Meta description: whole sentences up to about n characters."""
    out = ""
    for part in re.split(r"(?<=[.!?])\s+", s.strip()):
        if out and len(out) + 1 + len(part) > n:
            break
        out = (out + " " + part).strip()
    if 90 <= len(out) <= n + 5:
        return out
    return s.strip()[:n - 1].rsplit(" ", 1)[0].rstrip(",;:(") + "…"   # a short opener or one long sentence: cut at a word instead


# ---------------------------------------------------------------- data

def load_story(path):
    d = json.load(open(path, encoding="utf-8"))
    slug, name, dom = d["slug"], d["name"], host(d["site"])
    pub = datetime.date.fromisoformat(d["published"])
    cap = slug in CAPTURE
    return dict(
        slug=slug, kind="breakdown", name=name, title=d["title"], lede=d["dek"], date=pub, read=d["read_min"], d=d,
        logo=d["logo"], cover=f"/assets/real/{slug}.jpg", cw=960, ch=540,
        alt=f"The {name} homepage" if cap else f"{name}'s share image from {dom}",
        credit=f"Image: {name} homepage capture, from {dom}." if cap else f"Image: {name}'s own share image, from {dom}.",
        desc=describe(d["dek"]), nsrc=len(d.get("sources", [])), read_on=d["numbers"][0]["date"],
        summary=f"{dot(d['what'])} {d['numbers'][0]['k']}: {d['numbers'][0]['v']} ({d['numbers'][0]['label']}, {d['numbers'][0]['date']}).")


def load_guide(slug, key, who, alt, desc):
    s = read("src", f"post-{key}.body.html")
    art = s[s.index('<div class="prose">'):s.index("</article>")]
    tk = re.search(r'<div class="tk">.*?<ul>(.*?)</ul></div>', art, re.S)
    body = art[tk.end():]
    box = re.search(r'<div class="srcbox">.*?</div>\s*</div></div>', body, re.S)
    meta = re.search(r"(\d+) min read</span><span>([A-Z][a-z]{2} \d+ \d{4})", s)
    tail = re.search(r'<a class="tl44" href="([^"]*)">(.*?)</a>', body[box.end():])
    return dict(
        slug=slug, kind="guide", name="Guide", title=text(re.search(r"<h1>(.*?)</h1>", s)[1]), lede=text(re.search(r'<p class="lede">(.*?)</p>', s)[1]),
        date=pdate(meta[2]), read=int(meta[1]), cover=f"{IMG}{slug}.jpg", cw=1200, ch=675, alt=alt, credit=f"Photo: {who} on Unsplash.",
        desc=desc, summary=desc, bullets=re.findall(r"<li>(.*?)</li>", tk[1], re.S), html=body[:box.start()], tail=tail and (tail[1], text(tail[2]).rstrip(" →")),
        srcs=re.findall(r'<div class="sl-row">.*?<b>(.*?)</b><span class="d">(.*?)</span><span class="lb (\w)">', box[0], re.S), nsrc=box[0].count("sl-row"))


def load():
    stories = sorted((load_story(f) for f in glob.glob(os.path.join(ROOT, "data", "stories", "*.json"))), key=lambda p: p["name"].lower())
    return stories + [load_guide(*g) for g in GUIDES]


# ---------------------------------------------------------------- shared pieces

def logo(p, big=False):
    if p["kind"] == "guide":
        return '<span class="lg lg-g" aria-hidden="true">G</span>'
    n = 22 if big else 14
    return f'<span class="lg{" lg-lg" if big else ""}"><img src="{p["logo"]}" alt="" width="{n}" height="{n}" loading="lazy" decoding="async"></span>'


def meta_row(p, when=True):
    v = chip("Verified") if p["kind"] == "breakdown" else ""
    t = f'<span class="when"><time datetime="{p["date"].isoformat()}">{fdate(p["date"])}</time> · {p["read"]} min read</span>' if when else ""
    return f'<div class="pmeta">{logo(p)}<b>{E(p["name"])}</b>{v}{t}</div>'


def cover(p, B, eager=False):
    load = 'fetchpriority="high" decoding="async"' if eager else 'loading="lazy" decoding="async"'
    return (f'<div class="cov" style="view-transition-name:cover-{p["slug"]}"><img src="{B.asset(p["cover"])}" alt="{E(p["alt"])}" '
            f'width="{p["cw"]}" height="{p["ch"]}" {load}></div>')


def card(p, B):
    return (f'<a class="card card-flush card-hover pcard" href="{B.BASE}blog/{p["slug"]}/" data-cursor="Read" data-kind="{p["kind"]}">{cover(p, B)}'
            f'<div class="pcard-b">{meta_row(p)}<div class="pcard-t"><h3 class="h5" style="view-transition-name:title-{p["slug"]}">{E(p["title"])}</h3>'
            f'<span class="link-arrow">Read{B.ARROW}</span></div></div></a>')


# ---------------------------------------------------------------- index

def index_body(posts, B):
    feat = next(p for p in posts if p["slug"] == FEATURED)
    rest = [p for p in posts if p is not feat]
    n = {k: sum(p["kind"] == k for p in posts) for k in ("breakdown", "guide")}
    pill = lambda v, l, c, on=False: f'<button class="seg-i" type="button" aria-pressed="{str(on).lower()}" data-value="{v}">{l} <span class="n">{c}</span></button>'
    short = feat["lede"]
    short = " ".join(re.split(r"(?<=[.!?])\s+", short)[:2])
    return f"""<section class="wrap blog-head">
<h1 class="blog-h1" data-reveal="words">The blog.</h1>
<p class="lead" data-reveal style="--d:.1s">One founder breakdown a week, plus short guides on reading the numbers. Every number wears a label and a dated source.</p>
<div class="seg" data-tabs data-filter role="group" aria-label="Filter posts">{pill("all", "All", len(posts), True)}{pill("breakdown", "Breakdowns", n["breakdown"])}{pill("guide", "Guides", n["guide"])}</div>
</section>
<section class="wrap blog-feat" data-kind="{feat["kind"]}" aria-label="Featured">
<a class="card card-hover feat" href="{B.BASE}blog/{feat["slug"]}/" data-cursor="Read" data-reveal>
<div class="feat-t">{meta_row(feat)}<h2 class="feat-h" style="view-transition-name:title-{feat["slug"]}">{E(feat["title"])}</h2>
<p class="feat-d">{E(short)}</p><span class="link-arrow">Read the breakdown{B.ARROW}</span></div>
{cover(feat, B, eager=True)}</a>
</section>
<section class="wrap blog-all">
<h2 class="h2" data-reveal="words">All posts</h2>
<div class="pgrid" data-stagger>{"".join(card(p, B) for p in rest)}</div>
</section>"""


# ---------------------------------------------------------------- chart

def series_points(d):
    """-> (points [[label, value, point label or '', month index]], regular?) from a story's series; alt points come back separately."""
    s = d.get("series") or {}
    raw = s.get("points") or []
    if not raw:
        return [], True, []
    if len(raw[0]) == 2:                                   # ["Dec 2025", 217472] every month, one label for the whole series
        return [[m, v, "", i] for i, (m, v) in enumerate(raw)], True, []
    mi = lambda ym: int(ym[:4]) * 12 + int(ym[5:7])        # ["2024-09", 700, "Claimed", "source"]: gaps between points
    nice = lambda ym: (s.get("point_dates") or {}).get(ym) or f"{MON[int(ym[5:7]) - 1]} {ym[:4]}"
    t0 = mi(raw[0][0])
    pts = [[nice(ym), v, lab, mi(ym) - t0] + [src] for ym, v, lab, src in raw]
    alt = [[nice(ym), v, lab, mi(ym) - t0] + [src] for ym, v, lab, src in s.get("alt") or []]
    return pts, False, alt


def trend(pts):
    """Last point against the peak (when it has fallen) or the first point. -> (percent, reference point)."""
    first, last, peak = pts[0], pts[-1], max(pts, key=lambda p: p[1])
    ref = peak if peak is not last and last[1] < peak[1] else first
    return (last[1] - ref[1]) / ref[1] * 100, ref


def geometry(pts, W=600, H=260, PAD=25.2):
    vs = [p[1] for p in pts]
    mn, mx, t0, t1 = min(vs), max(vs), pts[0][3], pts[-1][3]
    return [(W if t1 == t0 else (p[3] - t0) / (t1 - t0) * W, H / 2 if mx == mn else PAD + (mx - p[1]) / (mx - mn) * (H - 2 * PAD)) for p in pts]


def chart(p, n_fig=None, uid="c"):
    """The revenue line chart with its real table. Returns '' when the story has no series."""
    d, name = p["d"], p["name"]
    allp, regular, alt = series_points(d)
    if len(allp) < 2:
        return ""
    s = d["series"]
    src_name = next((x["name"].split(":")[0] for x in d.get("sources", []) if x["url"] == s.get("source")), None) or (host(s["source"]) if s.get("source", "").startswith("http") else s.get("source", ""))
    ranges = regular and len(allp) > 6
    pts = allp[-12:] if ranges else allp
    geo = geometry(pts)
    path = " ".join(f"{'L' if i else 'M'}{x:.1f} {y:.1f}" for i, (x, y) in enumerate(geo))
    pct, ref = trend(pts)
    big = money(pts[-1][1])
    sub = f"{'−' if pct < 0 else '+'}{abs(pct):.1f}% since {ref[0]}" if regular else f"{pts[-1][2]}, {pts[-1][0]}"
    seg = ""
    if ranges:
        b = lambda v, l, on=False: f'<button class="seg-i" type="button" aria-pressed="{str(on).lower()}" data-value="{v}">{l}</button>'
        seg = f'<div class="seg seg-sm" data-tabs role="group" aria-label="Time range">{b(6, "6M")}{b(12, "1Y", True)}{b(0, "All")}</div>'
    dots, legend = "", ""
    if not regular:                                         # every point wears its own label
        cls = lambda lab: CHIP.get(lab, "claimed")
        dots = "".join(f'<span class="pt pt-{cls(q[2])}" style="left:{x / 6:.2f}%;top:{y / 2.6:.2f}%;--x:{x / 600:.2f}"></span>' for q, (x, y) in zip(pts[:-1], geo[:-1]))
        vs = [q[1] for q in pts]
        for q in alt:
            x, y = q[3] / (pts[-1][3] - pts[0][3]) * 600, 25.2 + (max(vs) - q[1]) / (max(vs) - min(vs)) * 209.6
            dots += f'<span class="pt pt-{cls(q[2])}" style="left:{x / 6:.2f}%;top:{y / 2.6:.2f}%;--x:{x / 600:.2f}"></span>'
        labs = list(dict.fromkeys(q[2] for q in pts + alt))
        legend = '<div class="legend">' + "".join(f'<span><i class="dot{" dot-v" if l == "Verified" else ""}"{" style=background:var(--violet)" if l == "Sources differ" else ""}></i>{E(l)}</span>' for l in labs) + "</div>"
        t1 = pts[-1][3]
        ticks = [(0, pts[0][0]), (t1, pts[-1][0])]
        xl = '<div class="xl xl-abs" aria-hidden="true">' + "".join(f'<span style="left:{t / t1 * 100:.1f}%">{E(l)}</span>' for t, l in ticks) + "</div>"
    else:
        xl = '<div class="xl" aria-hidden="true">' + "".join(f"<span>{q[0].split(' ')[0]}</span>" for q in pts) + "</div>"
    end_cls = "pt-end" if regular or pts[-1][2] != "Verified" else "pt-end pt-verified"
    rows, heads = "", "<th scope=\"col\">Month</th><th scope=\"col\">Revenue</th><th scope=\"col\">Label</th>" + ("" if regular else '<th scope="col">Source</th>')
    for q in sorted(allp + alt, key=lambda q: q[3]):
        lab = q[2] or s["label"]
        rows += f'<tr><th scope="row">{E(q[0])}</th><td class="num">{money(q[1])}</td><td>{chip(lab)}</td>' + ("" if regular else f"<td>{E(q[4])}{' (second source)' if q in alt else ''}</td>") + "</tr>"
    what = s.get("what", "Revenue each month")
    span = f"{allp[0][0]} to {allp[-1][0]}"
    read_on = d["numbers"][0]["date"]
    cap = (f"Figure{f' {n_fig}' if n_fig else ''}. {E(name)} {E(what.lower())}, {span}. Source: {E(src_name)}"
           + (f", read {read_on}. Every month is labelled {s['label']}." if regular else ". Each point carries its own label; see the table."))
    data = json.dumps({"p": [q[:4] for q in pts] if not regular else [q[:4] for q in allp]}, separators=(",", ":"))
    return f"""<figure class="card chart" data-chart='{E(data)}'>
<div class="chart-h"><div><span class="chart-k">{E(what)}</span><b class="chart-v">{big}</b><span class="chart-d">{E(sub)}</span></div>{seg}</div>
<div class="plot" tabindex="0" role="img" aria-label="Line chart of {E(name)} {E(what.lower())}, {span}. Use the left and right arrow keys to read each month. The same numbers are in the table below.">
<svg viewBox="0 0 600 260" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="{uid}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".26"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
<line class="base" x1="0" y1="{geo[0][1]:.1f}" x2="600" y2="{geo[0][1]:.1f}"/><path class="area" d="{path} L600 260 L0 260 Z" fill="url(#{uid}g)"/><path class="line" d="{path}"/></svg>
{dots}<span class="{end_cls}" style="left:100%;top:{geo[-1][1] / 2.6:.2f}%"></span><span class="xh" hidden></span><span class="xd" hidden></span><div class="tip" aria-live="polite" hidden><span></span><b></b></div>
</div>
{xl}{legend}
<figcaption>{cap}</figcaption>
<details class="ctab" data-acc="tbl-{uid}"><summary><span>Show as table</span><span>{len(allp) + len(alt)} {"months" if regular else "points"}{CHEV}</span></summary><div class="acc-body"><div>
<table class="dtable"><caption class="sr-only">{E(name)}: {E(what.lower())}, {span}</caption><thead><tr>{heads}</tr></thead><tbody>{rows}</tbody></table></div></div></details>
</figure>"""


# ---------------------------------------------------------------- breakdown sections

def sec(sid, h2, sub, inner):
    subp = f"<p>{sub}</p>" if sub else ""
    return f'<section class="psec" id="{sid}"><div class="psec-h" data-reveal><h2 class="ph2">{h2}</h2>{subp}</div>{inner}</section>'


def src_tag(f, d):
    """chip + 'Source name · date' link for one fact."""
    if not f.get("label"):
        return ""
    nm = next((x["name"].split(":")[0] for x in d.get("sources", []) if x["url"] == f.get("source")), None) or (host(f["source"]) if f.get("source") else "")
    lab = " · ".join(x for x in (nm, f.get("date")) if x)
    link = ext(f["source"], E(lab), "src") if f.get("source", "").startswith("http") else f'<span class="src">{E(lab)}</span>'
    return f'<p class="fsrc">{chip(f["label"])}{link if lab else ""}</p>'


def find_num(d, start):
    return next((n for n in d["numbers"] if n["k"].startswith(start)), None)


def breakdown_parts(p, B):
    """-> (toc [(id, label)], main html, faq [(q, a)], dataset or None)."""
    d, name = p["d"], p["name"]
    N, F = E(name), d.get("facts", {})
    rev, mrr, allt = find_num(d, "Revenue in"), find_num(d, "MRR"), find_num(d, "Revenue, all-time")
    allp, regular, _ = series_points(d)
    known = lambda f: f and f.get("text") and not f["text"].lower().startswith("not public")
    toc, out, faq = [], [], []

    # 1 the short answer: restates the story's own fields
    bl = []
    if rev:
        bl.append(f"{N} collected <b>{E(rev['v'])} in {E(rev['k'][len('Revenue in '):])}</b> ({rev['label']}, read {rev['date']}).")
    elif mrr:
        bl.append(f"{N}'s MRR (monthly recurring revenue) was <b>{E(mrr['v'])}</b> on {mrr['date']} ({mrr['label']}).")
    if known(F.get("first_customers")):
        bl.append("First customers: " + E(dot(F["first_customers"]["text"])))
    if known(F.get("first_revenue")):
        bl.append("First money: " + E(dot(F["first_revenue"]["text"])))
    if regular and len(allp) > 1:
        pct, ref = trend(allp)
        bl.append(f"{E(d['series']['what'])}: <b>{money(allp[-1][1])} in {allp[-1][0]}</b>, {abs(pct):.0f}% {'less' if pct < 0 else 'more'} than {ref[0]} ({money(ref[1])}).")
    elif d.get("pattern"):
        bl.append("The pattern: " + E(dot(d["pattern"])))
    toc.append(("short-answer", "The short answer"))
    out.append(f'<section class="psec" id="short-answer"><div class="card sa" data-reveal><div class="sa-h"><h2>The short answer</h2><span>30-second read</span></div>'
               f'<ul>{"".join(f"<li>{b}</li>" for b in bl)}</ul></div></section>')

    # 2 key numbers
    cards = ""
    for n in d["numbers"]:
        link = ext(n["source"], E(n["date"]), "src") if n.get("source", "").startswith("http") else f'<span class="src">{E(n["date"])}</span>'
        cards += (f'<div class="card kn-c"><span class="kn-k">{E(n["k"])}</span><span class="kn-v{" long" if len(n["v"]) > 13 else ""}" data-count>{E(n["v"])}</span>'
                  f'<span class="kn-m">{chip(n["label"])}{link}</span></div>')
    toc.append(("key-numbers", "Key numbers"))
    out.append(sec("key-numbers", "Key numbers", f"Read {p['read_on']}. MRR (monthly recurring revenue) is what all current subscriptions add up to per month; revenue is the money actually collected."
                   + (" ARR (annual recurring revenue) is MRR times 12." if "ARR" in json.dumps(d) else ""), f'<div class="kn" data-stagger>{cards}</div>'))

    # 3 revenue each month
    ch = chart(p, uid=p["slug"].replace("-", ""))
    dataset = None
    if ch:
        if regular:
            pct, ref = trend(allp)
            peak_i = max(range(len(allp)), key=lambda i: allp[i][1])
            falling = peak_i < len(allp) - 2 and all(allp[i][1] > allp[i + 1][1] for i in range(peak_i, len(allp) - 1))
            lead = (f"Every month since {allp[peak_i][0]} has been lower than the one before. " if falling else "")
            para = (f"{lead}{N} collected <b>{money(allp[-1][1])}</b> in {allp[-1][0]}, about {abs(pct):.0f}% {'less' if pct < 0 else 'more'} than "
                    f"{ref[0]} ({money(ref[1])}). Every month on the line is labelled {d['series']['label']}.")
        else:
            labs = sorted({q[2] for q in allp})
            para = (f"The line runs from {money(allp[0][1])} in {allp[0][0]} to <b>{money(allp[-1][1])}</b> on {allp[-1][0]}. "
                    f"Not every point is checked: the points are labelled {', '.join(labs[:-1])} and {labs[-1]}, each with its source in the table."
                    + (f" {E(dot(d['series']['empty_note']))}" if d["series"].get("empty_note") else ""))
        toc.append(("revenue", "Revenue each month"))
        out.append(sec("revenue", f"How much does {N} make each month?", "", f'<p class="ptext">{para}</p>{ch}'))
        s = d["series"]
        ym = lambda q: f"{q[0].split(' ')[-1]}-{MON.index(q[0].split(' ')[0]) + 1:02d}"
        dataset = {"@type": "Dataset", "name": f"{name}: {s['what'].lower()}, {allp[0][0]} to {allp[-1][0]}",
                   "description": f"{s['what']} for {name} in US dollars, {allp[0][0]} to {allp[-1][0]}, as published in the LaunchVault breakdown. Label: {s['label']}."
                                  + ("" if regular else " Individual points carry their own labels and sources."),
                   "temporalCoverage": f"{ym(allp[0])}/{ym(allp[-1])}", "variableMeasured": f"{s['what']} (USD)", "isAccessibleForFree": True,
                   "creator": {"@type": "Organization", "name": "LaunchVault", "url": B.SITE + B.BASE}}
        if str(s.get("source", "")).startswith("http"):
            dataset["isBasedOn"] = s["source"]

    # 4 first customers
    rows = ""
    for key, lab in (("first_customers", "First customers came from"), ("first_revenue", "First money came from"), ("cost_to_start", "Cost to start"), ("team", "Team")):
        f = F.get(key)
        if f and f.get("text"):
            rows += f'<div><dt>{lab}</dt><dd>{E(dot(f["text"]))}{src_tag(f, d)}</dd></div>'
    if rows:
        toc.append(("first-customers", "How the first customers came"))
        out.append(sec("first-customers", f"How did {N} get its first customers?", "", f'<dl class="facts" data-reveal>{rows}</dl>'))

    # 5 phases
    items = ""
    for i, ph in enumerate(d.get("phases", []), 1):
        nums = ph.get("number") or []
        nums = [nums] if isinstance(nums, dict) else nums
        nh = "".join(f'<p class="ph-num">{E(n["v"])}{chip(n["label"])}' + (ext(n["source"], E(n.get("date", "source")), "src") if str(n.get("source", "")).startswith("http") else "") + "</p>"
                     for n in nums if n.get("v") and n.get("label"))
        les = f'<p class="lesson"><b>Lesson</b><span>{E(ph["lesson"])}</span></p>' if ph.get("lesson") else ""
        items += (f'<li class="ph"><span class="ph-n" aria-hidden="true">{i}</span><div class="ph-h"><h3>{E(ph["name"])}</h3><span>{E(ph.get("when", ""))}</span></div>'
                  f'<p>{E(ph["story"])}</p>{nh}{les}</li>')
    if items:
        toc.append(("story", "The story, phase by phase"))
        out.append(sec("story", "The story, phase by phase", "Each phase ends with one lesson you can use.",
                       f'<div class="phases-w"><span class="ph-fill" aria-hidden="true"></span><ol class="phases">{items}</ol></div>'))

    # 6 fact check
    fcs = d.get("fact_checks", [])
    if fcs:
        trs = ""
        for f in fcs:
            who = " · ".join(x for x in (f.get("who"), f.get("date")) if x)
            who = ext(f["source"], E(who), "src") if str(f.get("source", "")).startswith("http") and who else E(who)
            trs += f'<tr><th scope="row">{E(f["claim"])}<small>{who}</small></th><td>{E(f["found"])}</td><td>{chip(f["label"])}</td></tr>'
        checked = d.get("fact_checks_read") or p["read_on"]
        toc.append(("fact-check", "Fact check"))
        out.append(sec("fact-check", "Fact check", "Where the sources agree, and where they don't.",
                       f'<div class="card card-flush fc" data-reveal><div class="fc-h"><b>Fact check · {N}</b><span>Checked {checked} · {len(fcs)} claim{"s" if len(fcs) != 1 else ""}</span></div>'
                       f'<table><caption class="sr-only">Claims about {N}, what the sources show, and the label each one gets</caption>'
                       f'<thead class="sr-only"><tr><th scope="col">Claim</th><th scope="col">What we found</th><th scope="col">Label</th></tr></thead><tbody>{trs}</tbody></table>'
                       f'<p class="fc-f">If we get a number wrong, we fix it here and note the change.</p></div>'))

    # 7 then and now
    wb = d.get("wayback", [])
    if wb:
        cs = ""
        for x in wb:
            pr = x.get("prices")
            pr = ", ".join(pr) if isinstance(pr, list) else pr
            pr = "" if not pr else ("Pricing not on the homepage" if pr.lower().startswith("not on") else pr)
            cs += (f'<a class="card card-hover wb-c" href="{E(x["source"])}" target="_blank" rel="noopener"><div><time>{E(x["date"])}</time>{chip("Wayback")}</div>'
                   f'<q>{E(x["headline"])}</q>{f"<span>{E(pr)}</span>" if pr else ""}</a>')
        toc.append(("then-and-now", "Then and now"))
        out.append(sec("then-and-now", "Then and now", "What the homepage said, and when. Each card opens the archived page.", f'<div class="wb" data-stagger>{cs}</div>'))

    # 8 checklist
    cl = d.get("checklist", [])
    if cl:
        lis = "".join(f'<li><label class="ck"><input type="checkbox"><span class="ck-b">{CHECK}</span><span class="ck-t">{E(t)}</span></label></li>' for t in cl)
        toc.append(("what-you-could-do", "What you could do"))
        out.append(sec("what-you-could-do", "What you could do with this at 15 to 20", "The parts that cost little money and fit around school. Your ticks save on this device as you go.",
                       f'<div class="card cl" data-checks="lv-{p["slug"]}-checks" data-reveal><div class="cl-h"><b>Your checklist</b><span data-done aria-live="polite">0 of {len(cl)} done</span></div><ul>{lis}</ul></div>'))

    # 9 questions people ask: answers are the story's own fields, restated
    tag = lambda f: f" ({f['label']}{', ' + f['date'] if f.get('date') else ''})" if f.get("label") else ""
    parts = []
    if rev:
        parts.append(f"{name} collected {rev['v']} in {rev['k'][len('Revenue in '):]} ({rev['label']}).")
    if mrr:
        parts.append(f"Its MRR (monthly recurring revenue) was {mrr['v']} on {mrr['date']} ({mrr['label']}).")
    if allt:
        parts.append(f"All-time revenue is {allt['v']} ({allt['label']}, read {allt['date']}).")
    if parts:
        faq.append((f"How much money does {name} make?", " ".join(parts)))
    if known(F.get("first_customers")):
        faq.append((f"How did {name} get its first customers?", dot(F["first_customers"]["text"]) + tag(F["first_customers"])))
    if known(F.get("first_revenue")):
        faq.append((f"How did {name} first make money?", dot(F["first_revenue"]["text"]) + tag(F["first_revenue"])))
    fp = d.get("founder_photo") or {}
    if fp.get("name") and F.get("team", {}).get("text"):
        faq.append((f"Who founded {name}?", f"{fp['name']}. {dot(F['team']['text'])}"))
    if known(F.get("cost_to_start")):
        faq.append((f"How much did it cost to start {name}?", dot(F["cost_to_start"]["text"]) + tag(F["cost_to_start"])))
    if regular and len(allp) > 1:
        pct, ref = trend(allp)
        faq.append((f"Is {name}'s revenue going up or down?",
                    f"{'Down' if pct < 0 else 'Up'}. {name} collected {money(allp[-1][1])} in {allp[-1][0]}, about {abs(pct):.0f}% {'less' if pct < 0 else 'more'} than {ref[0]} ({money(ref[1])}). "
                    f"The monthly numbers are labelled {d['series']['label']}."))
    if faq:
        toc.append(("questions", "Questions people ask"))
        out.append(sec("questions", "Questions people ask", "", '<div class="faq">' + "".join(f'<div class="qa"><h3>{E(q)}</h3><p>{E(a)}</p></div>' for q, a in faq) + "</div>"))

    # 10 sources
    srcs = d.get("sources", [])
    if srcs:
        # a source with no url (Postiz has four) is plain text, like the guides' sources; it used to link to "None"
        lis = "".join(f'<li><div>{ext(x["url"], f"<span>{E(x["name"])}</span>{B.EXT}") if x.get("url") else f"<b>{E(x["name"])}</b>"}<p>{E(x["what"])}</p></div>'
                      f'<div class="srcs-m"><span>{E(x["date"])}</span>{chip(x["label"])}</div></li>' for x in srcs)
        toc.append(("sources", "Sources"))
        out.append(sec("sources", "Sources", "Each one with its date and its label.", f'<ul class="srcs">{lis}</ul>'
                       '<p class="fine">LaunchVault breakdowns are written from public sources. Every number is labelled: Verified (read from Stripe or a live source), '
                       'Claimed (said by the founder or an interviewer), or Sources differ. Nothing here is financial or investment advice.</p>'))
    return toc, "".join(out), faq, dataset


def glance(p, B):
    d = p["d"]
    rows = "".join(f'<div><dt>{E(re.sub(r"\s*\(.*?\)", "", n["k"]))}</dt><dd>{E(n["v"])}<i class="dot{" dot-v" if n["label"] == "Verified" else ""}" title="{E(n["label"])}"></i></dd></div>'
                   for n in d["numbers"][:4])
    fp = d.get("founder_photo") or {}
    if fp.get("name"):
        rows += f'<div><dt>Founder</dt><dd>{E(fp["name"])}</dd></div>'
    return (f'<div class="card glance"><div class="glance-h">{logo(p, big=True)}<div><b>{E(p["name"])}</b><span>{E(d["category"])}</span></div></div><dl>{rows}</dl>'
            f'<div class="legend"><span><i class="dot dot-v"></i>Verified</span><span><i class="dot"></i>Other labels</span></div>'
            f'<a class="btn btn-glass btn-md" href="{E(d["site"])}" target="_blank" rel="noopener">Visit {E(p["name"])}{B.EXT}</a></div>')


# ---------------------------------------------------------------- guide sections

def guide_parts(p, posts, B):
    h = p["html"]
    h = re.sub(r"<svg.*?</svg>", "", h, flags=re.S)
    h = re.sub(r'</div>\s*<div class="chartcard".*?<div class="prose"[^>]*>', "{{CHART}}", h, flags=re.S)
    h = re.sub(r'<span class="lb (\w)">.*?</span>', lambda m: chip(LB[m[1]]), h)
    h = re.sub(r' style="[^"]*"', "", h).replace('<b class="n">', '<b class="tnum">')
    h = h.replace('href="/blog/', f'href="{B.BASE}blog/').replace("Hover or tap the line, or a move in the list, to see", "Hover or tap the line to see")
    if "{{CHART}}" in h:
        h = h.replace("{{CHART}}", chart(next(x for x in posts if x["slug"] == "postiz"), uid="g"))
    assert "quiz" not in h.lower() and not re.search(r'href="/(?!new/)', h), f"{p['slug']}: unconverted link or quiz mention"
    bits = re.split(r"<h2>(.*?)</h2>", h, flags=re.S)
    toc = [("short-answer", "The short answer")]
    out = [f'<section class="psec" id="short-answer"><div class="card sa" data-reveal><div class="sa-h"><h2>The short answer</h2><span>30-second read</span></div>'
           f'<ul>{"".join(f"<li>{b}</li>" for b in p["bullets"])}</ul></div>' + (f'<div class="prose gprose">{bits[0]}</div>' if bits[0].strip() else "") + "</section>"]
    for title, inner in zip(bits[1::2], bits[2::2]):
        sid = slugify(title)
        toc.append((sid, text(title)))
        out.append(sec(sid, title, "", f'<div class="prose gprose">{inner}</div>'))
    lis = "".join(f'<li><div><b>{nm}</b><p>{what}</p></div><div class="srcs-m">{chip(LB[lb])}</div></li>' for nm, what, lb in p["srcs"])
    tail = ""
    if p["tail"] and not p["tail"][0].startswith("/#sources"):
        href = p["tail"][0].replace("/blog/", B.BASE + "blog/").replace("/#", B.BASE + "#")
        tail = f'<p><a class="link-arrow" href="{href}">{E(p["tail"][1])}{B.ARROW}</a></p>'
    toc.append(("sources", "Sources"))
    out.append(sec("sources", "Sources", "Each one with its label.", f'<ul class="srcs">{lis}</ul>{tail}'))
    return toc, "".join(out)


# ---------------------------------------------------------------- post page

def keep_reading(p, posts):
    co = [x for x in posts if x["kind"] == "breakdown"]
    gu = [x for x in posts if x["kind"] == "guide"]
    if p["kind"] == "guide":
        return [next(x for x in co if x["slug"] == FEATURED)] + [x for x in gu if x is not p]
    i = co.index(p)
    return [co[(i + 1) % len(co)], co[(i + 2) % len(co)], gu[i % len(gu)]]


def post_page(p, posts, B):
    url = f"{B.SITE}{B.BASE}blog/{p['slug']}/"
    is_b = p["kind"] == "breakdown"
    if is_b:
        toc, main, faq, dataset = breakdown_parts(p, B)
    else:
        (toc, main), faq, dataset = guide_parts(p, posts, B), [], None
    crumb = ("Breakdowns", "breakdowns", p["name"]) if is_b else ("Guides", "guides", p["title"])
    iso, day = p["date"].isoformat(), fdate(p["date"])
    by = (f'<span class="by-av">{B.LOGO}</span><b>LaunchVault</b><time datetime="{iso}">{day}</time><span aria-hidden="true">·</span><span>{p["read"]} min read</span>'
          f'<span aria-hidden="true">·</span><span>{p["nsrc"]} sources</span>' + (f'<span aria-hidden="true">·</span><span>Numbers read {p["read_on"]}</span>' if is_b else ""))
    st = quote(p["title"])
    share = (f'<button class="share-b" type="button" data-copy="{url}" aria-label="Copy link">{ICON(I_LINK)}{ICON(I_OK, "ok")}<span class="copied" aria-hidden="true">Copied</span></button>'
             f'<a class="share-b" href="https://x.com/intent/post?url={quote(url, safe="")}&amp;text={st}" target="_blank" rel="noopener" aria-label="Share on X">{ICON(I_X)}</a>'
             f'<a class="share-b" href="https://www.reddit.com/submit?url={quote(url, safe="")}&amp;title={st}" target="_blank" rel="noopener" aria-label="Share on Reddit">{ICON(I_REDDIT)}</a>')
    toc_h = "".join(f'<li><a href="#{i}"><i>{n:02d}</i>{E(l)}</a></li>' for n, (i, l) in enumerate(toc, 1))
    verify = f"{B.BASE}blog/what-verified-means/"
    numbers_read = f" · Numbers read {p['read_on']}" if is_b else ""
    author = (f'<div class="card author" data-reveal><div class="author-h"><span>{B.LOGO}</span><div><b>Written by LaunchVault</b><small>Published {day}{numbers_read}</small></div></div>'
              f'<p>We read every number from a live source where one exists, and label the rest. Each story ends with one step you can do this week.</p>'
              f'<div class="author-l">' + (f'<a class="link" href="{verify}">How we check numbers</a>' if p["slug"] != "what-verified-means" else "")
              + f'<a class="link" href="{B.BASE}{REPORT_HREF}">Report a mistake</a></div></div>')
    app = (f'<div class="card appcard"><h2 class="h5">Read it in the app</h2><p>{"The same breakdown with your checklist, your path and progress saved as you go." if is_b else "Every breakdown with its checklist, your path and progress saved as you go."}</p>'
           f'<a class="btn btn-primary btn-md" href="{B.CTA_HREF}">Open in the app{B.ARROW}</a></div>')
    body = f"""<div class="readbar" aria-hidden="true"><i></i></div>
<article class="post" data-slug="{p["slug"]}">
<header class="wrap post-head">
<nav class="crumbs" aria-label="Breadcrumb"><a href="{B.BASE}">Home</a><i aria-hidden="true">/</i><a href="{B.BASE}blog/">Blog</a><i aria-hidden="true">/</i><a href="{B.BASE}blog/#{crumb[1]}">{crumb[0]}</a><i aria-hidden="true">/</i><span aria-current="page">{E(crumb[2])}</span></nav>
<div class="pmeta">{logo(p)}<b>{"Breakdown" if is_b else "Guide"}</b>{chip("Verified") if is_b else ""}</div>
<h1 class="post-h1" style="view-transition-name:title-{p["slug"]}">{E(p["title"])}</h1>
<p class="post-lede">{E(p["lede"])}</p>
<div class="post-by"><div class="by">{by}</div><div class="share">{share}</div></div>
</header>
<figure class="wrap post-cover">{cover(p, B, eager=True)}<figcaption>{E(p["credit"])}</figcaption></figure>
<div class="wrap post-grid">
<details class="card toc" open><summary>On this page<span>{len(toc)} sections{CHEV}</span></summary><nav aria-label="On this page"><ol><li class="toc-ind" aria-hidden="true"></li>{toc_h}</ol></nav>
<div class="toc-f"><div><span>{p["read"]} min read</span><span data-pct>0% read</span></div><div class="toc-bar"><i></i></div></div></details>
<div class="post-main">{main}{author}</div>
<aside class="rail" aria-label="At a glance">{glance(p, B) if is_b else ""}{app}</aside>
</div>
</article>
<section class="wrap keep" aria-labelledby="keep-h">
<div class="keep-h"><h2 id="keep-h">Keep reading</h2><a class="link-arrow" href="{B.BASE}blog/">All posts{B.ARROW}</a></div>
<div class="pgrid" data-stagger>{"".join(card(x, B) for x in keep_reading(p, posts))}</div>
</section>"""

    og = f"{B.SITE}{IMG}og/{p['slug']}.jpg"
    org = {"@type": "Organization", "name": "LaunchVault", "url": B.SITE + B.BASE}
    article = {"@type": "Article", "headline": p["title"], "description": p["desc"], "image": [og, B.SITE + p["cover"]], "datePublished": iso, "dateModified": iso,
               "author": org, "publisher": {**org, "logo": {"@type": "ImageObject", "url": B.SITE + "/assets/icon-512.png"}}, "mainEntityOfPage": url,
               "articleSection": "Breakdowns" if is_b else "Guides", "inLanguage": "en-CA", "isAccessibleForFree": True}
    if is_b:
        d = p["d"]
        same = [v for k, v in (d.get("links") or {}).items() if isinstance(v, str) and v != d["site"]]
        article["about"] = {"@type": "Organization", "name": p["name"], "url": d["site"], **({"sameAs": same} if same else {})}
        article["citation"] = [x["url"] for x in d.get("sources", [])]
    crumbs = {"@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i, "name": n, **({"item": u} if u else {})} for i, (n, u) in enumerate(
            [("Home", B.SITE + B.BASE), ("Blog", B.SITE + B.BASE + "blog/"), (crumb[0], f"{B.SITE}{B.BASE}blog/#{crumb[1]}"), (crumb[2], None)], 1)]}
    graph = [article, crumbs]
    if faq:
        graph.append({"@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faq]})
    if dataset:
        graph.append({**dataset, "url": url + "#revenue"})
    ld = "".join('<script type="application/ld+json">' + json.dumps({"@context": "https://schema.org", **g}, ensure_ascii=False).replace("</", "<\\/") + "</script>\n" for g in graph)
    head = (f'<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n<meta property="og:image:alt" content="{E(p["alt"])}">\n'
            f'<meta property="article:published_time" content="{iso}">\n<meta property="article:modified_time" content="{iso}">\n'
            f'<meta property="article:section" content="{article["articleSection"]}">\n'
            f'<meta name="twitter:title" content="{E(SEO_TITLE[p["slug"]])}">\n<meta name="twitter:description" content="{E(p["desc"])}">\n<meta name="twitter:image" content="{og}">\n'
            f'<link rel="alternate" type="application/rss+xml" title="LaunchVault blog" href="{B.BASE}blog/feed.xml">\n{ld}')
    return body, head


# ---------------------------------------------------------------- files next to the pages

def og_images(posts):
    """1200x630 link-preview crops of each cover. Needs Pillow only when a cover is new or changed."""
    for p in posts:
        src, out = os.path.join(ROOT, p["cover"].lstrip("/")), os.path.join(ROOT, IMG.strip("/"), "og", p["slug"] + ".jpg")
        if os.path.exists(out) and os.path.getmtime(out) >= os.path.getmtime(src):
            continue
        from PIL import Image
        im = Image.open(src).convert("RGB")
        k = max(1200 / im.width, 630 / im.height)
        im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
        x, y = (im.width - 1200) // 2, (im.height - 630) // 2
        os.makedirs(os.path.dirname(out), exist_ok=True)
        im.crop((x, y, x + 1200, y + 630)).save(out, quality=84, optimize=True, progressive=True)


def write(B, rel, s):
    out = os.path.join(B.OUT, rel)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, "w", encoding="utf-8", newline="\n").write(s)


def extras(posts, B):
    base = B.SITE + B.BASE + "blog/"
    new = sorted(posts, key=lambda p: (p["date"], p["slug"]), reverse=True)
    rfc = lambda d: datetime.datetime(d.year, d.month, d.day, 12, tzinfo=datetime.timezone.utc).strftime("%a, %d %b %Y %H:%M:%S +0000")
    items = "".join(f"<item><title>{E(p['title'])}</title><link>{base}{p['slug']}/</link><guid isPermaLink=\"true\">{base}{p['slug']}/</guid><pubDate>{rfc(p['date'])}</pubDate>"
                    f"<category>{'Breakdowns' if p['kind'] == 'breakdown' else 'Guides'}</category><description>{E(p['desc'])}</description></item>\n" for p in new)
    write(B, "blog/feed.xml", f'<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>\n<title>LaunchVault blog</title>\n<link>{base}</link>\n'
          f'<atom:link href="{base}feed.xml" rel="self" type="application/rss+xml"/>\n<description>One founder breakdown a week, plus short guides on reading the numbers. Every number wears a label and a dated source.</description>\n'
          f"<language>en-ca</language>\n<lastBuildDate>{rfc(new[0]['date'])}</lastBuildDate>\n{items}</channel></rss>\n")
    urls = "".join(f"<url><loc>{B.SITE}{B.BASE}{u}</loc></url>\n" for u in ("", *(f"legal/{s}/" for s in ("privacy", "terms", "cookies", "accessibility", "community"))))   # this is the root sitemap now: home and legal too
    urls += f"<url><loc>{base}</loc><lastmod>{new[0]['date'].isoformat()}</lastmod></url>\n" + "".join(f"<url><loc>{base}{p['slug']}/</loc><lastmod>{p['date'].isoformat()}</lastmod></url>\n" for p in new)
    write(B, "sitemap.xml", f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{urls}</urlset>\n')
    line = lambda p: f"- [{p['title']}]({base}{p['slug']}/): {p['summary']}\n"
    write(B, "llms.txt", "# LaunchVault\n\n> Real founder stories, checked number by number. Every number carries a label (Verified, Claimed, Sources differ, Live, Wayback or Couldn't verify), "
          "a date and a link to its source. Written by LaunchVault. Not financial advice.\n\n"
          "## Breakdowns\n\n" + "".join(line(p) for p in posts if p["kind"] == "breakdown") + "\n## Guides\n\n" + "".join(line(p) for p in posts if p["kind"] == "guide")
          + f"\n## More\n\n- [Blog index]({base})\n- [RSS feed]({base}feed.xml)\n- [How we check numbers]({base}what-verified-means/)\n")


# ---------------------------------------------------------------- entry points

def register(B):
    posts = load()
    og_images(posts)
    robots = "index, follow, max-image-preview:large" if INDEXABLE else "noindex, nofollow"
    common = dict(active="Blog", css=["/assets/new/blog.css"], js=["/assets/new/blog.js"], robots=robots)
    feed = f'<link rel="alternate" type="application/rss+xml" title="LaunchVault blog" href="{B.BASE}blog/feed.xml">\n'
    B.add_page(path="blog/", body=index_body(posts, B), title="Blog: founder breakdowns and guides | LaunchVault",
               description="One founder breakdown a week, plus short guides on reading the numbers. Every number wears a label and a dated source.",
               og_image=f"{IMG}og/{FEATURED}.jpg", head=feed, **common)
    for p in posts:
        assert len(SEO_TITLE[p["slug"]]) <= 60, f"title tag too long: {p['slug']}"
        body, head = post_page(p, posts, B)
        B.add_page(path=f"blog/{p['slug']}/", body=body, title=SEO_TITLE[p["slug"]], description=p["desc"], og_image=f"{IMG}og/{p['slug']}.jpg",
                   og_type="article", head=head, **common)
    extras(posts, B)
    return posts


def check():
    """Self-check: every post builds, title/description lengths, one h1, h2 ids match the contents list, JSON-LD parses, FAQ markup matches the page."""
    import build_new as B
    posts = load()
    assert len(posts) == 13 and len({p["slug"] for p in posts}) == 13
    for p in posts:
        body, head = post_page(p, posts, B)
        assert len(SEO_TITLE[p["slug"]]) <= 60 and 50 <= len(p["desc"]) <= 165, (p["slug"], len(p["desc"]))
        assert body.count("<h1") == 1, p["slug"]
        ids = re.findall(r'<section class="psec" id="([^"]+)"', body)
        assert ids == re.findall(r'<li><a href="#([^"]+)">', body) and len(ids) == len(set(ids)), p["slug"]
        blocks = [json.loads(b.replace("<\\/", "</")) for b in re.findall(r'<script type="application/ld\+json">(.*?)</script>', head, re.S)]
        types = [b["@type"] for b in blocks]
        assert types[:2] == ["Article", "BreadcrumbList"], p["slug"]
        for b in blocks:
            if b["@type"] == "FAQPage":
                assert [html.unescape(q) for q in re.findall(r'<div class="qa"><h3>(.*?)</h3>', body)] == [q["name"] for q in b["mainEntity"]], p["slug"]
        assert "quiz" not in body.lower(), p["slug"]
        print(f"ok  {p['slug']:<30} {len(ids):>2} sections  {' '.join(types)}")
    print("all 13 posts pass")


if __name__ == "__main__":
    check()
