"""Build the LaunchVault public site (dark "Vault" theme): home, blog, legal and the sign-in flow, at the root.

    python build_new.py          builds every page: src/new/*.body.html (+ .meta.json) and every page registered by a plugin

Page sources   src/new/<name>.body.html  +  src/new/<name>.meta.json
               meta keys: title, description, path ("" = /, "blog/" = /blog/), and optionally
               active (nav item: Stories | The problem | How it works | Pricing | Blog), css [urls], js [urls],
               end_cta (default true), bg ("off" to drop the particle band), bg_dim (e.g. 0.75), og_image, body_class, head (raw html)
Generated pages  put a file build_new_<something>.py next to this one with a function  register(B)  that calls
               B.add_page(path="blog/rezi/", body=html, title=..., description=..., active="Blog", ...)   (same keys as the meta file)
Tokens in a body  {{arrow}} button arrow svg, {{logo}} logo mark svg, {{cta}} the main CTA button, {{ext}} small "opens elsewhere" arrow
No dependencies. Output is plain HTML at the repo root. Every page is noindex for now.
"""
import glob, hashlib, html, importlib, json, os, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "src", "new")
OUT = ROOT
SITE = "https://www.launchvault.ca"
BASE = "/"   # public pages (home, blog, legal) live at the root since the 2026-11-24 swap
CTA = "Read a story for free"   # the main CTA text, everywhere
CTA_HREF = BASE + "sign-up/"
NAV = [("Stories", BASE + "#stories", "Ten founder stories, every number checked"),
       ("The problem", BASE + "#problem", "Why most success stories can't be trusted"),
       ("How it works", BASE + "#how", "Read it, do it, ask about it"),
       ("Pricing", BASE + "#pricing", "Free, Pro, Lifetime and Developer"),
       ("Blog", BASE + "blog/", "Breakdowns and guides")]
FOOT = [("Homepage", [(n, h) for n, h, _ in NAV[:4]]),
        ("Blog", [("All posts", BASE + "blog/"), ("Rezi breakdown", BASE + "blog/rezi/"), ("How we check numbers", BASE + "blog/what-verified-means/")]),
        ("Legal", [("Privacy", BASE + "legal/privacy/"), ("Terms", BASE + "legal/terms/"), ("Cookies", BASE + "legal/cookies/"),
                   ("Accessibility", BASE + "legal/accessibility/"), ("Community rules", BASE + "legal/community/")])]

LOGO = ('<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#2F6BFF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
        '<path pathLength="1" d="M19.99 14.91A8.5 8.5 0 1 1 10.52 3.63"/><path pathLength="1" d="M6.8 15.6l3.7-3.7 2.6 2.6 6.7-6.7"/><path pathLength="1" d="M16 7.8h3.8v3.8"/></svg>')
ARROW = ('<svg class="arrow" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
         '<path class="arrow-l" d="M1.5 7h6.8"/><path class="arrow-c" d="M4.5 3l4 4-4 4"/></svg>')
EXT = ('<svg viewBox="0 0 10 10" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
       '<path d="M2.5 7.5l5-5M3.5 2.5h4v4"/></svg>')
BURGER = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">'
          '<path class="b1" d="M4 7h16"/><path class="b2" d="M4 12h16"/><path class="b3" d="M4 17h16"/></svg>')


def cta(cls="", label=CTA, href=CTA_HREF):
    """The main call to action: blue pill with the hover arrow."""
    return f'<a class="{("btn btn-primary " + cls).strip()}" href="{href}">{label}{ARROW}</a>'


TOKENS = {"{{arrow}}": ARROW, "{{logo}}": LOGO, "{{ext}}": EXT, "{{cta}}": cta()}

_ver = {}


def asset(url):
    """Local asset url with a content hash, so a deploy never serves a stale file."""
    if not url.startswith("/") or url in _ver:
        return _ver.get(url, url)
    p = os.path.join(ROOT, url.lstrip("/").split("?")[0])
    _ver[url] = url + ("?v=" + hashlib.md5(open(p, "rb").read()).hexdigest()[:8] if os.path.exists(p) else "")
    return _ver[url]


def nav_html(active=None):
    cur = lambda n: ' aria-current="page"' if n == active else ""
    links = "".join(f'<a href="{h}"{cur(n)}>{n}</a>' for n, h, _ in NAV)
    tabs = "".join(f'<a class="nav-tab" href="{h}"{cur(n)}><b>{n}</b><span>{html.escape(s)}</span></a>' for n, h, s in NAV)
    return (f'<header class="nav" data-nav><div class="nav-shell"><div class="nav-bar">'
            f'<a class="nav-logo" href="{BASE}" aria-label="LaunchVault home">{LOGO}LaunchVault</a>'
            f'<nav class="nav-links" aria-label="Main">{links}</nav><span class="nav-sp"></span>'
            f'<a class="nav-login" href="{BASE}sign-in/">Log in</a>'
            f'<a class="btn btn-white nav-start" href="{CTA_HREF}">Start free</a>'
            f'<a class="btn btn-primary btn-sm nav-cta" href="{CTA_HREF}">{CTA}{ARROW}</a>'
            f'<a class="btn btn-primary btn-sm nav-cta-s" href="{CTA_HREF}">Start free</a>'
            f'<button class="nav-menu" type="button" aria-expanded="false" aria-controls="nav-card" aria-label="Open menu">{BURGER}</button></div>'
            f'<div class="nav-card" id="nav-card"><div class="nav-card-in"><nav class="nav-tabs" aria-label="Menu">{tabs}'
            f'<a class="nav-feat" href="{BASE}blog/rezi/"><img src="/assets/logos/rezi.png" alt="" width="40" height="40" loading="lazy" decoding="async">'
            f'<span><b>Rezi made $216,471 in October</b><small>It began as a free resume template on Reddit. Read the breakdown.</small></span>{ARROW}</a>'
            f'<div class="nav-more"><a href="{BASE}blog/">All ten stories</a><a href="{BASE}blog/what-verified-means/">How we check</a><a href="{BASE}#faq">Questions</a></div>'
            f'<div class="nav-foot"><a href="{BASE}sign-in/">Log in</a><span>Ages 13 and up</span></div></nav></div></div></div></header>')


def end_cta_html():
    return (f'<section class="sec endcta"><div class="wrap"><div class="endcta-in" data-reveal>'
            f'<h2 class="h-cta" data-reveal="words">Your first step takes 20 minutes.</h2>{cta()}</div></div></section>')


def footer_html():
    cols = "".join(f'<div class="foot-col"><h2>{h}</h2>' + "".join(f'<a href="{u}">{n}</a>' for n, u in items) + "</div>" for h, items in FOOT)
    return (f'<footer class="foot"><div class="wrap"><div class="foot-top"><div class="foot-brand">'
            f'<a class="nav-logo" href="{BASE}" aria-label="LaunchVault home">{LOGO}LaunchVault</a>'
            f'<p>Real founder stories, checked number by number, turned into steps you can do this week. For ages 13 and up. Not financial advice.</p></div>'
            f'<nav class="foot-cols" aria-label="Footer">{cols}</nav></div>'
            f'<div class="foot-end"><span>© 2026 LaunchVault</span><a href="{BASE}#credits">Design credits {EXT}</a></div></div></footer>')


HEAD_JS = ("(function(d){var h=d.documentElement;h.classList.add('js');try{if(!sessionStorage.getItem('lvIntro')&&!matchMedia('(prefers-reduced-motion:reduce)').matches)"
           "{sessionStorage.setItem('lvIntro','1');h.classList.add('intro-on')}}catch(e){}})(document)")
FONTS = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:ital,wght@1,600&display=swap"


def render(body, title, description, path="", active=None, css=(), js=(), end_cta=True, bg=None, bg_dim=None, og_image=None, body_class="", head="", robots="noindex, nofollow", og_type="website", chrome=True, **_):
    """Wrap a page body in the shared head, nav, closing CTA and footer. Returns the full HTML document.
    chrome=False is the full-bleed layout (sign-in): no nav, no closing CTA, no footer; the body brings its own top bar."""
    end_cta = end_cta and chrome
    for k, v in TOKENS.items():
        body = body.replace(k, v)
    url = SITE + BASE + path
    e = lambda s: html.escape(s, quote=True)
    og = og_image or "/assets/icon-512.png"
    og = og if og.startswith("http") else SITE + og
    links = "".join(f'<link rel="stylesheet" href="{asset(c)}">\n' for c in ["/assets/new/base.css", "/assets/new/chrome.css", "/assets/new/motion.css", *css])
    scripts = "".join(f'<script defer src="{asset(s)}"></script>\n' for s in ["/assets/new/motion.js", *js])
    battr = (f' class="{body_class}"' if body_class else "") + (f' data-bg="{bg}"' if bg else "") + (f' data-bg-dim="{bg_dim}"' if bg_dim else "")
    return f"""<!doctype html>
<html lang="en-CA">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{e(title)}</title>
<meta name="description" content="{e(description)}">
<meta name="robots" content="{robots}">
<link rel="canonical" href="{url}">
<meta name="theme-color" content="#07070A">
<meta name="color-scheme" content="dark">
<meta property="og:type" content="{og_type}">
<meta property="og:site_name" content="LaunchVault">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(description)}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{og}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/assets/new/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<script>{HEAD_JS}</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="{FONTS}">
{links}{scripts}{head}</head>
<body{battr}>
<a class="skip" href="#main">Skip to content</a>
<div class="intro" aria-hidden="true">{LOGO}</div>
{nav_html(active) if chrome else ""}
<main id="main">
{body}
{end_cta_html() if end_cta else ""}
</main>
{footer_html() if chrome else ""}
</body>
</html>
"""


PAGES = {}   # path -> kwargs for render()


def add_page(path, body, title, description, **kw):
    """Register a page. path is relative to / and ends with "/" ("" is the homepage)."""
    assert path == "" or (path.endswith("/") and not path.startswith("/")), f"bad path {path!r}: use '' or 'blog/rezi/'"
    PAGES[path] = dict(body=body, title=title, description=description, path=path, **kw)


def load_src():
    for f in sorted(glob.glob(os.path.join(SRC, "*.body.html"))):
        name = os.path.basename(f)[:-len(".body.html")]
        meta = json.load(open(os.path.join(SRC, name + ".meta.json"), encoding="utf-8"))
        add_page(body=open(f, encoding="utf-8").read(), **meta)


def load_plugins():
    sys.path.insert(0, ROOT)
    for f in sorted(glob.glob(os.path.join(ROOT, "build_new_*.py"))):
        importlib.import_module(os.path.basename(f)[:-3]).register(sys.modules[__name__])


def build():
    PAGES.clear()
    load_src()
    load_plugins()
    for path, kw in PAGES.items():
        out = os.path.join(OUT, path.replace("/", os.sep), "index.html")
        os.makedirs(os.path.dirname(out), exist_ok=True)
        open(out, "w", encoding="utf-8", newline="\n").write(render(**kw))
    print(f"built {len(PAGES)} page(s): " + ", ".join(BASE + p for p in PAGES))


if __name__ == "__main__":
    sys.modules.setdefault("build_new", sys.modules[__name__])   # so plugins that `import build_new` get this module, not a second copy
    build()
