"""Build the LaunchVault static site.

Stamps the shared head, logo sprite, nav, blog strip and footer around each page body in src/,
and writes site.css from the round 10 mockup CSS (src/_mock.css) plus the page styles (src/_extra.css).
Run:  python build.py      (no dependencies; output is plain HTML next to this file)
"""
import os, re, shutil
ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "src")
read = lambda n: open(os.path.join(SRC, n), encoding="utf-8").read()

# (output path, body file, <title>, description, active nav, blog strip above footer, (unused: footnotes removed), body class)
PAGES = [
    ("index.html", "index.body.html", "LaunchVault: how real apps got their first customers",
     "Real startup stories, broken down from public numbers. Every number is labelled, so you know what's checked.", "", False, False, ""),
    ("blog/index.html", "blog.body.html", "Blog · LaunchVault",
     "Short guides on reading the numbers, and what founders did first.", "blog", False, False, ""),
    ("blog/postiz/index.html", "post-postiz.body.html", "Postiz: almost two years under $15K a month, then $431K · LaunchVault",
     "How Postiz went from about $700 a month to $430,896 a month, with every number labelled and dated.", "blog", False, False, ""),
    ("blog/what-verified-means/index.html", "post-verified.body.html", "What 'Verified' means on LaunchVault",
     "Where our revenue numbers come from, why some are labelled Claimed, and why every number has a date.", "blog", False, False, ""),
    ("blog/how-to-read-a-revenue-chart/index.html", "post-chart.body.html", "How to read a revenue chart · LaunchVault",
     "MRR, all-time revenue, and what a sudden jump on the line actually means.", "blog", False, False, ""),
    ("blog/three-ways-to-start-small/index.html", "post-small.body.html", "Three ways to start small · LaunchVault",
     "A family member's problem, a service you can sell now, or a free version people can try. A real example of each.", "blog", False, False, ""),
    ("legal/privacy/index.html", "privacy.body.html", "Privacy policy (draft) · LaunchVault", "LaunchVault's privacy policy. Draft, not yet reviewed by a lawyer.", "", False, False, ""),
    ("legal/terms/index.html", "terms.body.html", "Terms of use (draft) · LaunchVault", "LaunchVault's terms of use. Draft, not yet reviewed by a lawyer.", "", False, False, ""),
    ("welcome/index.html", "welcome.body.html", "Welcome · LaunchVault", "Sign in or make a free LaunchVault account.", "welcome", False, False, ""),
    ("404.html", "404.body.html", "Page not found · LaunchVault", "This page isn't here.", "", False, False, ""),
]
# Pages that no longer exist (2026-11-17 scope: homepage + blog + legal + welcome). Their built folders are deleted on build;
# vercel.json redirects the old URLs.
REMOVED = ["breakdowns", "how-we-check", "pricing", "signin", "signup"]

LV = '<svg width="24" height="24" aria-hidden="true"><use href="#i-lv"/></svg>'
NAVLINKS = [("stories", "/#stories", "Stories"), ("check", "/#sources", "How we check"), ("pricing", "/#pricing", "Pricing"),
            ("faq", "/#faq", "FAQ"), ("blog", "/blog/", "Blog")]

# Mega menu: a sidebar of homepage sections (left) and a detail pane per item (right). Everything is read from the homepage
# markup (companies, prices, the 4 breakdown parts, FAQ, posts) so it never drifts; build fails loudly if that markup changes shape.
# Links are /#id (Blog: its pages); nav.js turns /#id clicks into an animated scroll (other pages: go home, then scroll on arrival).
ICONS = {"stories": "M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2zM4 19V5M8 7h6", "check": "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4",
         "race": "M3 3v18h18M7 15l4-4 3 3 5-6", "pricing": "M3 12V4h8l10 10-8 8zM7.5 7.5h.01", "inside": "M12 3l9 5-9 5-9-5zM3 13l9 5 9-5",
         "faq": "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.7M12 17h.01", "blog": "M6 3h9l4 4v14H6zM9 12h7M9 16h7"}
ICO = lambda k: f'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="{ICONS[k]}"/></svg>'
ARR = '<span class="ar" aria-hidden="true">→</span>'
MEGA = ""

def mega_html():
    home = read("index.body.html")
    sec = lambda i: home[home.index(f'id="{i}"'):home.index("</section>", home.index(f'id="{i}"'))]
    strip = lambda s: re.sub(r"<[^>]+>", "", s).strip()
    go = lambda h: f' data-go="{h[2:]}"' if h.startswith("/#") else ""
    # stories: the 3 tabs, first 3 companies of each, in homepage order
    st = sec("stories")
    tabs = re.findall(r'<button class="chip"[^>]*data-f="([^"]+)"[^>]*>([^<]+)</button>', st)
    cos = re.findall(r'<article class="bcard[^"]*" data-cat="([^"]+)" data-story="([^"]+)">\s*<div class="bc-top"><img class="blogo" src="([^"]+)"', st)
    p_st = ('<p class="mlede">Real founders, checked. Pick a kind of story:</p><div class="mgrps">' + "".join(
        f'<a class="mgrp" href="/#stories" data-go="stories" data-f="{f}"><b>{n}{ARR}</b><span class="mcos">'
        + "".join(f'<span><img src="{src}" alt="" width="20" height="20" loading="lazy">{c}</span>' for cat, c, src in [x for x in cos if f in x[0].split()][:3])
        + "</span></a>" for f, n in tabs) + "</div>")
    # how we check: the label set
    labels = [("v", "Verified"), ("l", "Live"), ("w", "Wayback"), ("c", "Claimed"), ("x", "Sources differ"), ("n", "Couldn't verify")]
    p_ck = ('<p class="mlede">Every number gets a source, a label and the date we read it.</p><div class="mchips">'
            + "".join(f'<span class="lb {k}">{t}</span>' for k, t in labels) + '</div><div class="mlinks">'
            + f'<a href="/#sources" data-go="sources">See every source{ARR}</a><a href="/#check" data-go="check">The race chart{ARR}</a></div>')
    # race chart (claim: ~$10K/mo, Starter Story, Mar 2026)
    logo = re.search(r'<div class="rc-co"><img src="([^"]+)"', sec("check")).group(1)
    p_rc = (f'<a class="mrow big" href="/#check" data-go="check"><img src="{logo}" alt="" width="36" height="36"><span><b>DM Champ{ARR}</b>'
            '<span>An interview said about $10K a month (Starter Story, Mar 2026). The chart puts that claim next to the verified line.</span></span></a>'
            '<div class="mchips"><span class="lb c">Claimed</span><span class="lb v">Verified</span></div>')
    # pricing
    pr = sec("pricing")
    plans = re.findall(r'<h3>([^<]+)</h3>.*?<p class="pd">([^<]+)</p>', pr, re.S)[:3]
    amts = re.findall(r'class="amt" data-m="(\$\d+)"', pr)
    price = {"Free": "$0 forever", "Pro": amts[0] + "/mo", "Builder": amts[1] + "/mo"}
    p_pr = ('<div class="mlist">' + "".join(f'<a class="mrow" href="/#pricing" data-go="pricing"><span><b>{n}{ARR}</b><span>{d}</span></span><em>{price.get(n, "")}</em></a>' for n, d in plans)
            + '</div><p class="mnote">Prices are placeholders until launch.</p>')
    # inside a breakdown: the 4 parts; a click selects that tab
    parts = re.findall(r'role="tab" id="(t-p\d)"[^>]*>\s*<span class="i">(\d+)</span>(.*?)</button>', sec("inside"), re.S)
    first = lambda html: strip(re.search(r">([^<>]+)<", ">" + html.strip() + "<").group(1)) if re.search(r">([^<>]+)<", ">" + html.strip() + "<") else ""
    p_in = '<p class="mlede">Ten minutes, four parts.</p><div class="mlist">' + "".join(
        f'<a class="mrow" href="/#inside" data-go="inside" data-t="{t}"><i class="mno">{i}</i><span><b>{first(rest)}{ARR}</b></span></a>' for t, i, rest in parts) + "</div>"
    # faq: top 4 questions; a click opens that one
    qs = re.findall(r"<summary>(.*?)</summary>", sec("faq"))[:4]
    p_fq = '<div class="mlist">' + "".join(f'<a class="mrow" href="/#faq" data-go="faq" data-q="{k}"><span><b>{q}{ARR}</b></span></a>' for k, q in enumerate(qs)) + "</div>"
    # blog: the 4 posts with small covers
    posts = re.findall(r'<a class="post" href="(/blog/([^/]+)/)">.*?<h3>([^<]+)</h3>', sec("blog"), re.S)[:4]
    p_bl = ('<div class="mposts">' + "".join(f'<a class="mpost" href="{h}"><img src="/assets/covers/{slug}.webp" alt="" width="112" height="63" loading="lazy"><b>{t}</b></a>' for h, slug, t in posts)
            + f'</div><div class="mlinks"><a href="/blog/">All posts{ARR}</a></div>')
    assert len(tabs) == 3 and len(plans) == 3 and len(amts) >= 2 and len(parts) == 4 and len(qs) == 4 and len(posts) == 4, "mega_html: homepage markup changed shape"
    items = [("stories", "Stories", "/#stories", p_st), ("check", "How we check", "/#sources", p_ck), ("race", "Race chart", "/#check", p_rc),
             ("pricing", "Pricing", "/#pricing", p_pr), ("inside", "Inside a breakdown", "/#inside", p_in), ("faq", "FAQ", "/#faq", p_fq), ("blog", "Blog", "/blog/", p_bl)]
    side = "".join(f'<a class="mi" role="tab" id="mi-{k}" aria-controls="mp-{k}" aria-selected="{str(n == 0).lower()}" tabindex="{0 if n == 0 else -1}" href="{h}"{go(h)} data-k="{k}">'
                   f'{ICO(k)}<span>{t}</span><span class="chev" aria-hidden="true">›</span></a>' for n, (k, t, h, _) in enumerate(items))
    panes = "".join(f'<div class="mp{" on" if n == 0 else ""}" role="tabpanel" id="mp-{k}" aria-labelledby="mi-{k}"><a class="mpt" href="{h}"{go(h)}>{t}{ARR}</a>{body}</div>'
                    for n, (k, t, h, body) in enumerate(items))
    return ('<div class="mega" id="mega" role="region" aria-label="Site menu"><div class="mgc">\n'
            '    <div class="mhead"><button class="mback" type="button" aria-label="Back to the menu" hidden><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></button>'
            '<b>Menu</b><button class="mx" type="button" aria-label="Close menu"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>\n'
            f'    <div class="mside" role="tablist" aria-orientation="vertical" aria-label="Sections"><span class="mhl" aria-hidden="true"></span>{side}</div>\n'
            f'    <div class="mpanes">{panes}</div>\n  </div></div>')

def nav(active):
    cur = lambda k: ' aria-current="page"' if k == active else ""
    links = "".join(f'<a href="{h}"{cur(k)}>{t}</a>' for k, h, t in NAVLINKS)
    return f'''<a class="skip" href="#main">Skip to content</a>
<nav class="nav" id="nav" aria-label="Main">
  <a class="logo" href="/" aria-label="LaunchVault home">{LV}LaunchVault</a>
  <div class="links">{links}</div>
  <button class="mbtn" id="menubtn" type="button" aria-label="Menu" aria-expanded="false" aria-controls="mega"><span class="mic" aria-hidden="true"><i></i><i></i><i></i></span></button>
  <div class="right">
    <a class="btn btn-p cta" href="/welcome/"><span class="long">Read your first success story</span><span class="short">Read a story</span></a>
  </div>
  {MEGA}
</nav>'''

# Simple Icons paths (CC0). Social accounts don't exist yet: icons render with a "Coming soon" tooltip, aria-disabled, no href.
SOCIAL = [
    ("Instagram", "M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077"),
    ("Facebook", "M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z"),
    ("TikTok", "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"),
]
SOCIAL_HTML = "".join(f'<a class="soc" role="link" tabindex="0" aria-disabled="true" aria-label="{n}, coming soon" data-tip="Coming soon"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="{d}"/></svg></a>' for n, d in SOCIAL)
FCOLS = [("Explore", [("/#stories", "Stories"), ("/#sources", "How we check"), ("/#pricing", "Pricing"), ("/#faq", "FAQ")]),
         ("From the blog", [("/blog/", "All posts"), ("/blog/postiz/", "The Postiz breakdown"), ("/blog/what-verified-means/", "What Verified means"),
                            ("/blog/how-to-read-a-revenue-chart/", "Reading a revenue chart"), ("/blog/three-ways-to-start-small/", "Three ways to start small")]),
         ("Account", [("/welcome/", "Sign in"), ("/welcome/#signup", "Sign up")]),
         ("Legal", [("/legal/privacy/", "Privacy (draft)"), ("/legal/terms/", "Terms (draft)")])]
FCOLS_HTML = "".join(f'<nav class="fcol" aria-label="{h}"><h4>{h}</h4>' + "".join(f'<a href="{u}"><span>{t}</span></a>' for u, t in ls) + "</nav>" for h, ls in FCOLS)
FOOTER = '''<footer class="foot">
  <div class="wrap">
    <div class="ftop">
      <div class="fbrand"><a class="logo" href="/">''' + LV + '''LaunchVault</a>
        <p class="tl">Real startup stories, checked and cut down to the part you can use.</p>
        <!-- SOCIAL URLS TBC: no accounts yet. When they exist, give each .soc an href, drop aria-disabled, role and data-tip. -->
        <div class="socs">''' + SOCIAL_HTML + '''</div></div>
      ''' + FCOLS_HTML + '''
    </div>
    <div class="fbot"><span>© 2026 LaunchVault · Not financial advice</span><span class="lgl"><a href="/legal/privacy/">Privacy</a><a href="/legal/terms/">Terms</a><a href="/#top">Back to top <span aria-hidden="true">↑</span></a></span>
      <span class="own">Logos belong to their owners and show where data was read, not a partnership.</span></div>
  </div>
</footer>'''

HEAD = '''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
{og}<meta name="robots" content="noindex">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:ital,wght@0,400;0,500;0,600;0,700;1,500;1,600;1,700&family=Inter+Tight:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="/assets/site.css">
<link rel="stylesheet" href="/assets/pages.css">
<link rel="stylesheet" href="/assets/home.css">
<link rel="stylesheet" href="/assets/design.css">
<link rel="stylesheet" href="/assets/nav.css">
</head>
'''

def blog_strip():
    home = read("index.body.html")
    i = home.index('<section id="blog">'); j = home.index("</section>", i) + len("</section>")
    return home[i:j]

def fragments():
    """Pieces shared between the homepage and other pages, cut from the homepage body so they never drift."""
    home = read("index.body.html")
    cut = lambda a, b: home[home.index(a):home.index(b, home.index(a))]
    return {
        "{{POSTS}}": cut('<div class="posts', '<!-- end posts -->'),
    }

def write(path, text):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f: f.write(text)
    os.replace(tmp, path)

def og(out):
    # ponytail: blog posts get their cover; every other page uses the Postiz cover
    slug = out.split("/")[1] if out.startswith("blog/") and out.count("/") == 2 else "postiz"
    return f'<meta property="og:image" content="https://launchvault-site.vercel.app/assets/covers/{slug}.png">' + chr(10)

def main():
    css = "/* LaunchVault site styles. Part 1: the round 10 homepage system (design/round10/final/mockup.html). Part 2: the other pages. Built by build.py. */\n"
    # read every input before opening the output, then write via a temp file, so a missing input can never leave site.css empty
    out_css = css + read("_mock.css") + read("_extra.css") + read("_motion.css") + read("_hero.css")
    assert len(out_css) > 20000, "site.css would be suspiciously small"
    write(os.path.join(ROOT, "assets", "site.css"), out_css)
    for d in REMOVED:
        full = os.path.join(ROOT, d)
        if os.path.isdir(full): shutil.rmtree(full)
    global MEGA; MEGA = mega_html()   # nav() is called per page; build the card once
    sprite, strip, frag = read("_sprite.html"), blog_strip(), fragments()
    if not os.path.exists(os.path.join(ROOT, "assets", "pages.css")): open(os.path.join(ROOT, "assets", "pages.css"), "w", encoding="utf-8").write("/* Inner-page styles (owned by the pages coder). Loaded after site.css. */\n")
    for out, body, title, desc, active, bstrip, fn, cls in PAGES:
        b = read(body)
        for k, v in frag.items(): b = b.replace(k, v)
        html = (HEAD.format(title=title, desc=desc, og=og(out)) + f'<body{" class=" + chr(34) + cls + chr(34) if cls else ""}>\n' + sprite + "\n" + nav(active)
                + '\n<main id="main">\n' + b + ("\n" + strip if bstrip else "") + "\n</main>\n"
                + FOOTER + '\n<script src="/assets/nav.js" defer></script>\n<script src="/assets/site.js" defer></script>\n<script src="/assets/home.js" defer></script>\n<script src="/assets/streak.js" defer></script>\n</body>\n</html>\n')
        path = os.path.join(ROOT, out); os.makedirs(os.path.dirname(path), exist_ok=True)
        write(path, html)
    print("built", len(PAGES), "pages")

if __name__ == "__main__":
    main()
