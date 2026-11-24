"""Legal pages of the new site: /new/legal/{privacy,terms,cookies,accessibility,community}/ (+ /new/legal/ -> privacy).

Picked up by `python build_new.py` (register(B)). Run `python build_new_legal.py` to print the text audit:
source word count, built word count and every block the quiz clean-up changed or removed.

The legal TEXT is read from the live sources (src/privacy.body.html ...) and only restyled. Allowed changes, nothing else:
  1. quiz mentions removed exactly the way the Paper builder's pages.py clean() does it,
  2. launchvault-site.vercel.app -> launchvault.ca,
  3. internal links point at the /new/ pages.
Layout, sizes and colours are ported from the Paper builder pages.py legal() / legal_bar().
"""
import html, os, re

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "src")
# (tab name, url slug, source file, accent, icon path) -- pages.py DOCS + LACC
DOCS = [("Privacy", "privacy", "privacy", "#2F6BFF", "M12 3l7 3v6c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6z"),
        ("Terms", "terms", "terms", "#8B6CFF", "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6"),
        ("Cookies", "cookies", "legal-cookies", "#FF5FA2", "M12 3a9 9 0 1 0 9 9 3 3 0 0 1-3-3 3 3 0 0 1-3-3 3 3 0 0 1-3-3zM9 10h.01M15 15h.01M10 16h.01"),
        ("Accessibility", "accessibility", "legal-accessibility", "#00C27A", "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7.5h.01M8 10l4 1 4-1M12 11v3l-2 4M12 14l2 4"),
        ("Community rules", "community", "legal-community", "#2EC4D6",
         "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20c.8-3 3.2-4.5 6-4.5s5.2 1.5 6 4.5M16 5.5a3 3 0 0 1 0 5.5M17.5 15.5c1.8.5 3 1.9 3.5 4.5")]
BASE = "/"
QUIZ = [("ticks, progress and quiz answers", "ticks and progress"), ("progress and quiz answers", "progress"), (", quiz answers", ""), (" and quiz answers", ""),
        ("quiz answers and path", "path"), ("quiz answers and ticks", "ticks"), ("quiz answers, ", "")]
CONTACT_IDS = ("contact", "feedback", "appeals")   # the section "Contact us" jumps to, first one the page has
MONO_FONT = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@500;600&display=swap">\n'


def clean(s):
    """pages.py clean(), but keeping the markup (links, bold, code)."""
    s = re.sub(r"\s+", " ", s).strip().replace("launchvault-site.vercel.app", "launchvault.ca")
    for a, b in QUIZ:
        s = s.replace(a, b)
    if "quiz" in s.lower():   # no quiz anywhere: drop any sentence that still mentions it
        s = " ".join(x for x in re.split(r"(?<=[.!?])\s+", s) if "quiz" not in x.lower())
    return s.strip()


def paper_clean(s):
    """Verbatim copy of pages.py clean() (the approved design's text), used only to cross-check clean()."""
    s = re.sub(r"<b>(.*?)</b>", r'<b style="color:#fff;font-weight:600">\1</b>', s, flags=re.S)
    s = re.sub(r"<a [^>]*>(.*?)</a>", lambda m: f'<span style="color:#FF4D1F;font-weight:500">{m.group(1)}</span>', s, flags=re.S)
    s = re.sub(r"<(?!/?(b|span)\b)[^>]+>", "", s)
    s = re.sub(r"\s+", " ", s).strip().replace("launchvault-site.vercel.app", "launchvault.ca")
    for a, b in QUIZ:
        s = s.replace(a, b)
    if "quiz" in s.lower():
        s = " ".join(x for x in re.split(r"(?<=[.!?])\s+", s) if "quiz" not in x.lower())
    return s.strip()


def text(s):
    return html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", s))).strip()


def words(s):
    return len(text(s).split())


def href(h):
    if h.startswith(("#", "http")):
        return h
    if h == "/":
        return BASE
    if h == "/#sources":            # "how we check numbers": the new site answers that in this post (same target as the footer link)
        return BASE + "blog/what-verified-means/"
    if h.startswith(("/legal/", "/app/")):
        return BASE + h[1:]
    raise ValueError(f"legal link with no /new/ equivalent: {h}")


def links(s):
    def fix(m):
        attrs = re.sub(r'\s*class="[^"]*"', "", m.group(1))
        return "<a " + re.sub(r'href="([^"]*)"', lambda h: f'href="{href(h.group(1))}"', attrs).strip() + ">"
    return re.sub(r"<a\s+([^>]*)>", fix, s)


def balanced(s):
    return all(len(re.findall(f"<{t}[ >]", s)) == s.count(f"</{t}>") for t in ("a", "b", "code", "span"))


def parse(fname):
    """-> dict(title, meta, draft, summ[], intro[], sections[(id, title, blocks)], audit). A block is ("p", html) | ("ul", [html]) | ("table", head[], rows[[html]])."""
    s = open(os.path.join(SRC, fname + ".body.html"), encoding="utf-8").read()
    audit = dict(src=0, out=0, changed=[])

    def c(raw):
        out = clean(raw)
        assert text(out) == text(paper_clean(raw)), f"{fname}: clean() differs from the Paper builder on: {raw[:80]}"
        assert balanced(out), f"{fname}: unbalanced markup after clean-up: {out[:120]}"
        audit["src"] += words(raw)
        audit["out"] += words(out)
        if text(out) != text(re.sub(r"\s+", " ", raw).replace("launchvault-site.vercel.app", "launchvault.ca")):
            audit["changed"].append((text(raw), text(out)))
        return links(out)

    title = text(re.search(r"<h1[^>]*>(.*?)</h1>", s, re.S).group(1))
    meta = text(re.search(r'class="pmeta"[^>]*>(.*?)</p>', s, re.S).group(1))
    draft = c(re.search(r'class="draft"[^>]*><span>(.*?)</span></p>', s, re.S).group(1))
    prose = s[s.index('class="prose"'):s.index("<script")]
    prose = prose[prose.index(">") + 1:]
    summ = re.search(r'<div class="lsum">(.*?)</div>', prose, re.S)
    summ_title, summ_items = "", []
    if summ:
        summ_title = text(re.search(r"<b>(.*?)</b>", summ.group(1), re.S).group(1))
        summ_items = [x for x in (c(li) for li in re.findall(r"<li>(.*?)</li>", summ.group(1), re.S)) if x]
        audit["src"] += words(summ_title)
        audit["out"] += words(summ_title)
        prose = prose.replace(summ.group(0), "")
    blocks = lambda x: words(re.sub(r"</(li|p|h2|td|th|ul|b)>(?=<)", " ", x))   # closing tags that butt against the next tag still end a word
    total = blocks(prose) + (blocks(summ.group(0)) if summ else 0) + words(re.search(r'class="draft"[^>]*>(.*?)</p>', s, re.S).group(1))
    intro, sections, cur = [], [], None
    for m in re.finditer(r'<h2[^>]*id="([^"]+)"[^>]*>(.*?)</h2>|<p[^>]*>(.*?)</p>|<ul[^>]*>(.*?)</ul>|<table[^>]*>(.*?)</table>', prose, re.S):
        hid, h, p, ul, table = m.groups()
        if h is not None:
            cur = []
            sections.append((hid, c(h), cur))
            continue
        dest = intro if cur is None else cur
        if p is not None:
            x = c(p)
            if x:
                dest.append(("p", x))
        elif ul is not None:
            lis = [x for x in (c(li) for li in re.findall(r"<li[^>]*>(.*?)</li>", ul, re.S)) if x]
            if lis:
                dest.append(("ul", lis))
        else:
            head = [text(x) for x in re.findall(r"<th[^>]*>(.*?)</th>", table, re.S)]
            audit["src"] += sum(len(x.split()) for x in head)
            audit["out"] += sum(len(x.split()) for x in head)
            rows = []
            for tr in re.findall(r"<tr>(.*?)</tr>", table, re.S):
                tds = re.findall(r"<td[^>]*>(.*?)</td>", tr, re.S)
                if not tds:
                    continue
                before = audit["out"]
                cells = [c(td) for td in tds]
                if all(cells):
                    rows.append(cells)
                else:              # a storage key that only exists for the quiz: the whole row goes, like a quiz list item
                    audit["out"] = before
            dest.append(("table", head, rows))
    assert audit["src"] == total, f"{fname}: {total - audit['src']} source words were not picked up by the parser"
    return dict(title=title, meta=meta, draft=draft, summ_title=summ_title, summ=summ_items, intro=intro, sections=sections, audit=audit)


# ---------------- markup ----------------
def rgb(hx):
    return f"{int(hx[1:3], 16)},{int(hx[3:5], 16)},{int(hx[5:7], 16)}"


def icon(path, s=16, cls=""):
    return (f'<svg{" class=" + chr(34) + cls + chr(34) if cls else ""} width="{s}" height="{s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
            f'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="{path}"/></svg>')


PDF = ('<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
       '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>')
TICK = ('<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
        '<path d="M5 12.5l4.5 4.5L19 7.5"/></svg>')
CHEV = '<svg class="lg-chev" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M3 4.5l3 3 3-3"/></svg>'
LINK = ('<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
        '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2"/></svg>')


def tabs(k=None):
    return "".join(f'<a class="lg-tab" href="{BASE}legal/{slug}/" style="--c:{col};--c-rgb:{rgb(col)}"{" aria-current=" + chr(34) + "page" + chr(34) if i == k else ""}>{icon(path)}{name}</a>'
                   for i, (name, slug, _, col, path) in enumerate(DOCS))


def block(b):
    if b[0] == "p":
        return f"<p>{b[1]}</p>"
    if b[0] == "ul":
        return "<ul>" + "".join(f"<li>{x}</li>" for x in b[1]) + "</ul>"
    _, head, rows = b
    th = "".join(f'<th scope="col">{html.escape(h)}</th>' for h in head)
    tr = "".join("<tr>" + "".join(f'<td data-label="{html.escape(head[i])}">{x}</td>' for i, x in enumerate(r)) + "</tr>" for r in rows)
    return f'<div class="lg-table lg-glass"><table><thead><tr>{th}</tr></thead><tbody>{tr}</tbody></table></div>'


def page(k):
    name, slug, fname, col, path = DOCS[k]
    d = parse(fname)
    secs = d["sections"]
    chars = sum(len(text(block(b))) for _, _, bl in secs for b in bl) + sum(len(text(t)) for _, t, _ in secs)
    mins = max(2, round(chars / 1100))
    contact = next(i for i in CONTACT_IDS if any(s[0] == i for s in secs))
    updated = d["meta"].replace("Draft · ", "")
    bar = (f'<nav class="lg-bar" aria-label="Legal pages"><div class="wrap lg-bar-in"><span class="lg-bar-l">Legal<span> pages</span></span>'
           f'<div class="lg-tabs">{tabs(k)}</div><button class="lg-pdf lg-pdf-bar" type="button" data-lg-print>{PDF}Download PDF</button></div></nav>')
    head = (f'<header class="wrap lg-head"><nav class="lg-crumbs" aria-label="Breadcrumb"><a href="{BASE}">Home</a><span aria-hidden="true">/</span><span>Legal</span>'
            f'<span aria-hidden="true">/</span><span aria-current="page">{name}</span></nav>'
            f'<div class="lg-title"><span class="lg-tile">{icon(path, 28)}</span><h1>{d["title"]}</h1></div>'
            f'<p class="lg-meta"><span class="lg-draft">Draft</span><span>{updated} · {mins} min read</span></p>'
            f'<p class="lg-note lg-glass"><span class="lg-dot" aria-hidden="true"></span><span>{d["draft"]}</span></p></header>')
    rows = "".join(f'<li><a href="#{i}"><span class="lg-n" aria-hidden="true">{n:02d}</span><span>{t}</span></a></li>' for n, (i, t, _) in enumerate(secs, 1))
    toc = (f'<aside class="lg-side"><nav class="lg-toc lg-glass" aria-label="On this page">'
           f'<h2 class="lg-toc-h"><button type="button" aria-expanded="true" aria-controls="lg-toc-c"><span class="lg-toc-t">On this page</span>'
           f'<span class="lg-toc-n"><span class="lg-toc-k">{len(secs)}<span> sections</span></span>{CHEV}</span></button></h2>'
           f'<div class="lg-toc-c" id="lg-toc-c"><div class="lg-toc-in"><ol class="lg-toc-l"><li class="lg-ind" aria-hidden="true"></li>{rows}</ol>'
           f'<div class="lg-prog"><div class="lg-prog-l"><span id="lg-prog-l">Read so far</span><span class="lg-prog-v">0%</span></div>'
           f'<div class="lg-prog-t" role="progressbar" aria-labelledby="lg-prog-l" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span></span></div></div></div></div></nav>'
           f'<p class="lg-ask"><b>Questions about this page?</b><a class="link" href="#{contact}">Contact us</a></p></aside>')
    art = ""
    if d["summ"]:
        art += (f'<section class="lg-short lg-glass" aria-labelledby="lg-short-t"><h2 id="lg-short-t">{icon(path, 18)}{d["summ_title"]}</h2><ul>'
                + "".join(f"<li>{TICK}<span>{x}</span></li>" for x in d["summ"]) + "</ul></section>")
    art += "".join(block(b) for b in d["intro"])
    for n, (i, t, bl) in enumerate(secs, 1):
        art += (f'<section class="lg-sec" id="{i}" aria-labelledby="{i}-t" data-reveal><h2 id="{i}-t" tabindex="-1"><span class="lg-n" aria-hidden="true">{n:02d}</span><span>{t}</span>'
                f'<a class="lg-anchor" href="#{i}" aria-label="Copy link to this section: {html.escape(text(t), quote=True)}">{LINK}</a></h2>'
                + "".join(block(b) for b in bl) + "</section>")
    end = (f'<div class="lg-end"><p class="lg-ask"><b>Questions about this page?</b><a class="link" href="#{contact}">Contact us</a></p>'
           f'<button class="lg-pdf" type="button" data-lg-print>{PDF}Download PDF</button></div>')
    body = (f'<div class="lg" style="--acc:{col};--acc-rgb:{rgb(col)}" data-legal>{bar}{head}'
            f'<div class="wrap lg-body">{toc}<article class="lg-art">{art}{end}</article></div></div>')
    return body, d


def index():
    """/new/legal/ has no page of its own: it sends you to the privacy policy (and lists all five for anyone with refresh off)."""
    return (f'<div class="lg" style="--acc:#2F6BFF;--acc-rgb:47,107,255"><header class="wrap lg-head lg-index"><h1>Legal</h1>'
            f'<p class="lg-meta"><span>Opening the privacy policy. All five pages:</span></p><div class="lg-tabs">{tabs()}</div></header></div>')


def register(B):
    kw = dict(css=["/assets/new/legal.css"], js=["/assets/new/legal.js"], end_cta=False, bg_dim=0.75, head=MONO_FONT)
    for k, (name, slug, *_) in enumerate(DOCS):
        body, d = page(k)
        B.add_page(path=f"legal/{slug}/", body=body, title=f'{d["title"]} · LaunchVault',
                   description=text(d["draft"]) if not d["summ"] else text(" ".join(d["summ"][:2])), **kw)
    B.add_page(path="legal/", body=index(), title="Legal · LaunchVault", description="Privacy, terms, cookies, accessibility and community rules.",
               **{**kw, "head": MONO_FONT + f'<meta http-equiv="refresh" content="0;url={BASE}legal/privacy/">\n'})


if __name__ == "__main__":   # text audit
    for k, (name, slug, fname, *_) in enumerate(DOCS):
        a = parse(fname)["audit"]
        print(f'\n{name}: source {a["src"]} words -> built {a["out"]} words ({a["src"] - a["out"]} removed), {len(a["changed"])} block(s) changed')
        for before, after in a["changed"]:
            print("  -", before, "\n    ->", after or "(removed)")
