"""Build the LaunchVault static site.

Stamps the shared head, logo sprite, nav, blog strip and footer around each page body in src/,
and writes site.css from the round 10 mockup CSS (src/_mock.css) plus the page styles (src/_extra.css).
Run:  python build.py      (no dependencies; output is plain HTML next to this file)
"""
import os, re
ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "src")
read = lambda n: open(os.path.join(SRC, n), encoding="utf-8").read()

# (output path, body file, <title>, description, active nav, blog strip above footer, footnotes in footer, body class)
PAGES = [
    ("index.html", "index.body.html", "LaunchVault: how real apps got their first customers",
     "Real startup stories, broken down from public numbers. Every number is labelled, so you know what's checked.", "", False, True, ""),
    ("breakdowns/index.html", "breakdowns.body.html", "Breakdowns · LaunchVault",
     "Real startup stories, checked: what it cost to start, where the first customers came from, and how big it is now.", "breakdowns", True, True, ""),
    ("breakdowns/postiz/index.html", "postiz.body.html", "Postiz: almost two years under $15K a month, then $431K · LaunchVault",
     "How Postiz went from about $700 a month to $430,896 a month, with every number labelled and dated.", "breakdowns", True, False, ""),
    ("how-we-check/index.html", "how-we-check.body.html", "How we check numbers · LaunchVault",
     "The four labels, every source we read, the corrections log, and a page for parents.", "check", True, False, ""),
    ("blog/index.html", "blog.body.html", "Blog · LaunchVault",
     "Short guides on reading the numbers, and what founders did first.", "blog", False, False, ""),
    ("blog/what-verified-means/index.html", "post-verified.body.html", "What 'Verified' means on LaunchVault",
     "Where our revenue numbers come from, why some are labelled Claimed, and why every number has a date.", "blog", False, False, ""),
    ("blog/how-to-read-a-revenue-chart/index.html", "post-chart.body.html", "How to read a revenue chart · LaunchVault",
     "MRR, all-time revenue, and what a sudden jump on the line actually means.", "blog", False, False, ""),
    ("blog/three-ways-to-start-small/index.html", "post-small.body.html", "Three ways to start small · LaunchVault",
     "A family member's problem, a service you can sell now, or a free version people can try. A real example of each.", "blog", False, False, ""),
    ("pricing/index.html", "pricing.body.html", "Pricing · LaunchVault",
     "Start free. Go Full when you want more. Under 18? A parent pays.", "pricing", True, False, ""),
    ("legal/privacy/index.html", "privacy.body.html", "Privacy policy (draft) · LaunchVault", "LaunchVault's privacy policy. Draft, not yet reviewed by a lawyer.", "", False, False, ""),
    ("legal/terms/index.html", "terms.body.html", "Terms of use (draft) · LaunchVault", "LaunchVault's terms of use. Draft, not yet reviewed by a lawyer.", "", False, False, ""),
    ("signin/index.html", "signin.body.html", "Sign in · LaunchVault", "Sign in to LaunchVault.", "", False, False, ""),
    ("signup/index.html", "signup.body.html", "Make your free account · LaunchVault", "Make a free LaunchVault account.", "", False, False, ""),
    ("404.html", "404.body.html", "Page not found · LaunchVault", "This page isn't here.", "", False, False, ""),
]

LV = '<svg width="24" height="24" aria-hidden="true"><use href="#i-lv"/></svg>'
NAVLINKS = [("breakdowns", "/breakdowns/", "Breakdowns"), ("check", "/how-we-check/", "How we check"), ("quiz", "/#quiz", "Quiz"),
            ("pricing", "/pricing/", "Pricing"), ("blog", "/blog/", "Blog")]

def nav(active):
    cur = lambda k: ' aria-current="page"' if k == active else ""
    links = "".join(f'<a href="{h}"{cur(k)}>{t}</a>' for k, h, t in NAVLINKS)
    mlinks = "".join(f'<a class="ml" href="{h}"{cur(k)}>{t}{" <small>about a minute</small>" if k == "quiz" else ""}</a>' for k, h, t in NAVLINKS)
    return f'''<a class="skip" href="#main">Skip to content</a>
<nav class="nav" id="nav" aria-label="Main">
  <a class="logo" href="/" aria-label="LaunchVault home">{LV}LaunchVault</a>
  <div class="links">{links}</div>
  <div class="right">
    <a class="btn btn-s signin" href="/signin/">Sign in</a>
    <a class="btn btn-p cta" href="/signup/"><span class="long">Get the weekly breakdown</span><span class="short">Get it free</span></a>
    <button class="btn btn-s menu" id="menubtn" type="button" aria-label="Menu" aria-expanded="false" aria-controls="menuc"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
  </div>
  <div class="menuc" id="menuc">
    {mlinks}
    <div class="acts"><a class="btn btn-s" href="/signin/">Sign in</a><a class="btn btn-p" href="/signup/">Get the weekly breakdown</a></div>
  </div>
</nav>'''

FOOTER = '''<footer>
  <div class="wrap">
    {fnotes}
    <div class="ftop">
      <div class="fbrand"><a class="logo" href="/">''' + LV + '''LaunchVault</a>
        <p class="tl">Real startup stories, checked and cut down to the part you can use.</p>
        <form class="nl pv"><input type="email" required placeholder="you@email.com" aria-label="Email for the weekly breakdown"><button class="btn btn-p" type="submit">Subscribe</button></form></div>
      <div class="fcol"><h4>Breakdowns</h4><a href="/breakdowns/">All breakdowns</a><a href="/breakdowns/postiz/">Postiz</a><a href="/breakdowns/?f=saas">SaaS</a><a href="/breakdowns/?f=ai">AI tools</a><a href="/breakdowns/?f=mobile">Mobile apps</a></div>
      <div class="fcol"><h4>Learn</h4><a href="/blog/">Blog</a><a href="/blog/how-to-read-a-revenue-chart/">Reading a revenue chart</a><a href="/blog/three-ways-to-start-small/">Three ways to start small</a><a href="/#quiz">Quiz</a><a href="/signup/">Weekly email</a></div>
      <div class="fcol"><h4>Trust</h4><a href="/how-we-check/">How we check numbers</a><a href="/how-we-check/#sources">Sources</a><a href="/how-we-check/#corrections">Corrections log</a><a href="/how-we-check/#parents">For parents</a></div>
      <div class="fcol"><h4>Company</h4><a href="/pricing/">Pricing</a><a href="/pricing/#faq">FAQ</a><a href="/signin/">Sign in</a><a href="/signup/">Create an account</a></div>
      <div class="fcol"><h4>Legal</h4><a href="/legal/privacy/">Privacy (draft)</a><a href="/legal/terms/">Terms (draft)</a></div>
    </div>
    <div class="fbot"><span>© 2026 LaunchVault · Not financial advice</span><span class="lgl"><a href="/legal/privacy/">Privacy</a><a href="/legal/terms/">Terms</a></span>
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
<meta name="robots" content="noindex">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400;500;600;700&family=Inter+Tight:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="/assets/site.css">
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
        "{{STORIES}}": cut('<article class="feat">', '<div class="libcta">'),
        "{{SOURCES}}": cut('<div class="sgrid" id="sgrid">', '<!-- end sources -->'),
        "{{PLANS}}": cut('<div class="bill">', '<!-- end pricing -->'),
        "{{FAQ}}": cut('<div class="faqg-in"', '<!-- end faq -->'),
        "{{POSTS}}": cut('<div class="posts">', '<!-- end posts -->'),
    }

def main():
    css = "/* LaunchVault site styles. Part 1: the round 10 homepage system (design/round10/final/mockup.html). Part 2: the other pages. Built by build.py. */\n"
    open(os.path.join(ROOT, "assets", "site.css"), "w", encoding="utf-8").write(css + read("_mock.css") + read("_extra.css"))
    sprite, fnotes, strip, frag = read("_sprite.html"), read("_fnotes.html"), blog_strip(), fragments()
    for out, body, title, desc, active, bstrip, fn, cls in PAGES:
        b = read(body)
        for k, v in frag.items(): b = b.replace(k, v)
        if out.startswith("breakdowns/index"): b = b.replace('<div class="filters"', '<div class="filters" data-url="1"')
        html = (HEAD.format(title=title, desc=desc) + f'<body{" class=" + chr(34) + cls + chr(34) if cls else ""}>\n' + sprite + "\n" + nav(active)
                + '\n<main id="main">\n' + b + ("\n" + strip if bstrip else "") + "\n</main>\n"
                + FOOTER.replace("{fnotes}", fnotes if fn else "") + '\n<script src="/assets/site.js" defer></script>\n</body>\n</html>\n')
        path = os.path.join(ROOT, out); os.makedirs(os.path.dirname(path), exist_ok=True)
        open(path, "w", encoding="utf-8").write(html)
    print("built", len(PAGES), "pages")

if __name__ == "__main__":
    main()
