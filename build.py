"""Build the LaunchVault static site.

Stamps the shared head, logo sprite, nav, blog strip and footer around each page body in src/,
and writes site.css from the round 10 mockup CSS (src/_mock.css) plus the page styles (src/_extra.css).
Run:  python build.py      (no dependencies; output is plain HTML next to this file)
"""
import os, re, shutil
ROOT = os.path.dirname(os.path.abspath(__file__))
# ready stories = story files; the footer count follows them
NREADY = len([f for f in os.listdir(os.path.join(ROOT, 'data', 'stories')) if f.endswith('.json')])
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
    ("legal/cookies/index.html", "legal-cookies.body.html", "Cookie policy (draft) · LaunchVault", "Every cookie and storage key LaunchVault uses, and why. Draft, not yet reviewed by a lawyer.", "", False, False, ""),
    ("legal/accessibility/index.html", "legal-accessibility.body.html", "Accessibility statement · LaunchVault", "How LaunchVault works for everyone, known gaps, and how to tell us about a problem.", "", False, False, ""),
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
    amts = re.findall(r'class="amt" data-m="(\$[\d.]+)"', pr)
    price = {"Free": "$0 forever", "Pro": amts[0] + "/mo", "Developer": amts[1] + "/mo"}
    p_pr = ('<div class="mlist">' + "".join(f'<a class="mrow" href="/#pricing" data-go="pricing"><span><b>{n}{ARR}</b><span>{d}</span></span><em>{price.get(n, "")}</em></a>' for n, d in plans)
            + '</div><p class="mnote">Payments open with accounts.</p>')
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

WEEK = ""   # slug of this week's story; build_app.py sets it before main(). Run alone, the buttons fall back to the Library.
def week_href(): return f"/app/story/{WEEK}/" if WEEK else "/app/library/"
def nav(active):
    cur = lambda k: ' aria-current="page"' if k == active else ""
    links = "".join(f'<a href="{h}"{cur(k)}>{t}</a>' for k, h, t in NAVLINKS)
    return f'''<a class="skip" href="#main">Skip to content</a>
<nav class="nav" id="nav" aria-label="Main">
  <a class="logo" href="/" aria-label="LaunchVault home">{LV}LaunchVault</a>
  <div class="links">{links}</div>
  <button class="mbtn" id="menubtn" type="button" aria-label="Menu" aria-expanded="false" aria-controls="mega"><span class="mic" aria-hidden="true"><i></i><i></i><i></i></span></button>
  <div class="right">
    <a class="btn btn-p cta" href="{week_href()}"><span class="long">Read your first success story</span><span class="short">Read a story</span></a>
  </div>
  {MEGA}
</nav>'''

# Footer: brand + tagline, four link columns, slim bottom bar. Nothing else (owner removed the logo strip and CTA).
# No social icons until real LaunchVault accounts exist. The label key lives in the "How we check" section (/#sources) and the FAQ.
FCOLS = [("Explore", [("/#stories", "Stories"), ("/#sources", "How we check"), ("/#check", "Verified vs Claimed"), ("/#inside", "Inside a breakdown"), ("/#pricing", "Pricing"), ("/#faq", "FAQ")]),
         ("Blog", [("/blog/", "All posts"), ("/blog/postiz/", "The Postiz breakdown"), ("/blog/what-verified-means/", "What Verified means"),
                   ("/blog/how-to-read-a-revenue-chart/", "Reading a revenue chart"), ("/blog/three-ways-to-start-small/", "Three ways to start small")]),
         ("Account", [("/welcome/", "Sign in"), ("/welcome/#signup", "Sign up")]),
         ("Legal", [("/legal/privacy/", "Privacy (draft)"), ("/legal/terms/", "Terms (draft)"), ("/legal/cookies/", "Cookies (draft)"), ("/legal/accessibility/", "Accessibility")])]
FCOLS_HTML = "".join(f'<nav class="fcol" aria-label="{h}"><h4>{h}</h4>' + "".join(f'<a href="{u}"><span>{t}</span></a>' for u, t in ls) + "</nav>" for h, ls in FCOLS)
def footer():
    return '''<footer class="foot">
  <div class="wrap">
    <div class="ftop">
      <div class="fbrand"><a class="logo" href="/">''' + LV + '''LaunchVault</a>
        <p class="tl">Real startup stories, checked and cut down to the part you can use.</p></div>
      ''' + FCOLS_HTML + '''
    </div>
    <div class="fbot"><span>© 2026 LaunchVault · Not financial advice</span><span class="lgl"><a href="/legal/privacy/">Privacy</a><a href="/legal/terms/">Terms</a><a href="/legal/cookies/" data-consent-open>Cookie settings</a><a href="/#top">Back to top <span aria-hidden="true">↑</span></a></span></div>
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
<link rel="icon" href="/assets/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#2563EB">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:ital,wght@0,400;0,500;0,600;0,700;1,500;1,600;1,700&family=Inter+Tight:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:ital,wght@0,400;0,500;0,600;0,700;1,500;1,600;1,700&family=Inter+Tight:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="/assets/site.css">
<link rel="stylesheet" href="/assets/pages.css">
<link rel="stylesheet" href="/assets/home.css">
<link rel="stylesheet" href="/assets/design.css">
<link rel="stylesheet" href="/assets/nav.css">
<link rel="stylesheet" href="/assets/consent.css">
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
        b = b.replace("{{WEEK_HREF}}", week_href()).replace("{{NREADY}}", str(NREADY))
        html = (HEAD.format(title=title, desc=desc, og=og(out)) + f'<body{" class=" + chr(34) + cls + chr(34) if cls else ""}>\n' + sprite + "\n" + nav(active)
                + '\n<main id="main">\n' + b + ("\n" + strip if bstrip else "") + "\n</main>\n"
                + footer() + '\n<script src="/assets/consent.js" defer></script>\n<script src="/assets/nav.js" defer></script>\n<script src="/assets/site.js" defer></script>\n<script src="/assets/home.js" defer></script>\n<script src="/assets/streak.js" defer></script>\n</body>\n</html>\n')
        path = os.path.join(ROOT, out); os.makedirs(os.path.dirname(path), exist_ok=True)
        write(path, html)
    print("built", len(PAGES), "pages")

if __name__ == "__main__":
    main()
