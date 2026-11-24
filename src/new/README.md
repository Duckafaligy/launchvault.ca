# LaunchVault `/new/` — the contract for page agents

The new public site lives under `/new/`. Dark "Vault" theme, approved in Paper. Static HTML, CSS and vanilla JS, built by `build_new.py`. No bundlers, no frameworks, nothing from npm in the browser.

See everything working: **`/new/styleguide/`** (source: `src/new/styleguide.body.html`). Copy markup from there.

## Files

| Path | What | Who edits |
|---|---|---|
| `build_new.py` | wraps page bodies in head + nav + closing CTA + footer, writes `new/<path>/index.html` | foundation only |
| `assets/new/base.css` | tokens, reset, type, layout, cards, buttons, chips, pills, fields, prose | foundation only |
| `assets/new/chrome.css` | nav (bar, pill, card) and footer | foundation only |
| `assets/new/motion.css` + `motion.js` | the one motion system | foundation only |
| `assets/new/favs/*.png` | favicons for comment pins (apple, discord, figma, github, google, linear.app, raycast, robinhood, scale, spacefs, stripe, typeform) | add more if needed |
| `src/new/<name>.body.html` + `<name>.meta.json` | your page | you |
| `assets/new/<yourpage>.css` / `.js` | your page-only styles and scripts (list them in the meta) | you |
| `build_new_<x>.py` | optional generator for many pages (blog posts) | you |
| `new/**` | build output. Never edit by hand | nobody |

Need a shared class changed or added? Ask the foundation owner; do not fork `base.css` or override its classes in your page CSS.

## Add a page

1. `src/new/blog.body.html` — only what goes inside `<main>`. No `<html>`, nav or footer.
2. `src/new/blog.meta.json`:

```json
{ "title": "Blog · LaunchVault", "description": "One founder breakdown a week.", "path": "blog/",
  "active": "Blog", "css": ["/assets/new/blog.css"], "js": ["/assets/new/blog.js"] }
```

3. `python build_new.py` → `new/blog/index.html`.

Meta keys: `title`, `description`, `path` (`""` = `/new/`, otherwise ends with `/`), and optional `active` (`Stories` | `The problem` | `How it works` | `Pricing` | `Blog`), `css`, `js`, `end_cta` (default `true`; `false` drops the closing panel), `bg` (`"off"` = no particle band), `bg_dim` (e.g. `0.75` on legal pages), `og_image` (site path or full URL), `body_class`, `head` (raw extra head HTML), `chrome` (`false` = full-bleed page with no nav, closing panel or footer; used by sign-in).

Tokens you can use in a body file: `{{cta}}` (the main button), `{{arrow}}` (button arrow svg), `{{logo}}` (logo mark), `{{ext}}` (small up-right arrow).

### Generated pages

Create `build_new_blog.py` next to `build_new.py`; `python build_new.py` picks it up:

```python
def register(B):                       # B is the build_new module
    for post in posts:
        B.add_page(path=f"blog/{post.slug}/", body=html, title=..., description=..., active="Blog", css=["/assets/new/post.css"])
```

Helpers on `B`: `add_page(path, body, title, description, **meta)`, `render(...)` (returns the HTML string), `cta(cls="", label=CTA, href=CTA_HREF)`, `asset(url)` (adds a content hash), constants `ARROW`, `LOGO`, `EXT`, `CTA`, `CTA_HREF`, `BASE`, `SITE`, `NAV`.

## Rules

- The main CTA text is exactly **Read a story for free** everywhere. Use `{{cta}}`.
- Buttons hug their text at every size, phones too. Never make one full width.
- No small all-caps eyebrow labels above titles. No yellow. No section numbers.
- One highlighted word per headline at most: `<em class="hl">you.</em>` (Playfair Display italic, cobalt).
- Orange (`--ember`) is for text links only. Blue is for buttons, the logo and picked states.
- Glass frost is `blur(5px) saturate(118%)`. Do not increase it.
- Privacy: no founder or owner name anywhere. The byline is "LaunchVault".
- The whole tree is `noindex` for now (the build adds it). Do not add sitemap entries.
- Charts are lines only.
- CSP: scripts and styles from this site only (inline allowed), fonts from Google Fonts, images from this site or `data:`. No third-party embeds.
- Homepage must provide the anchors the nav and footer link to: `#stories`, `#problem`, `#how`, `#pricing`, `#credits`.
- Routes the chrome links to: `/new/`, `/new/blog/`, `/new/blog/rezi/`, `/new/blog/what-verified-means/`, `/new/sign-in/`, `/new/sign-up/`, `/new/legal/{privacy,terms,cookies,accessibility,community}/`.

## Breakpoints

| Name | Width | Side margin `--mg` | Section gap `--sec` | Nav height |
|---|---|---|---|---|
| phone | `< 600px` | 24 | 72 | 60 |
| tablet | `600–1099px` | 56 | 96 | 68 |
| desktop | `>= 1100px` | fluid 56 → 120 (120 at 1440) | 132 | 72 |

Content is 1200 wide at most. Media queries: `@media (max-width:599px)`, `(max-width:1099px)`, `(min-width:600px)`, `(min-width:1100px)`. Test at 1440, 834 and 390.

## Tokens (`:root` in base.css)

`--bg #07070A` `--surf #0E0E13` `--night #0B0B0F` (dark ink on white) `--ink #fff` `--text` 78% `--muted` 64% `--faint` 56% `--line` 10% `--line2` 6% `--brand #2F6BFF` `--btn #1F45B5` `--btn2` `--brand3` `--word #4C7DFF` `--hl #9DB8FF` `--ember #FF4D1F` `--ember-t #C2330A` `--mint #00C27A` `--ok #3BE0A0` `--violet #7B5CFF` `--pink #FF5FA2` `--pop #FF8A8A` (errors) `--glass` `--glass-edge` `--frost` `--glass-btn` `--glass-btn-edge` `--fd` (Inter) `--fi` (Playfair italic) `--out` (the one ease) `--spring` `--mg` `--sec` `--nav-h` `--r 18px` `--r-lg 24px`.

## Classes (one example each)

**Layout**
- `.wrap` — centred content column with side margins: `<div class="wrap">…</div>`
- `.sec` / `.sec-top` — section bottom / top spacing: `<section class="sec" id="stories"><div class="wrap">…</div></section>`
- `.stack` — column with gap: `<div class="stack" style="--gap:20px">`
- `.row` (+ `.row-wrap`, `.between`) — row, centred: `<div class="row row-wrap">`
- `.center` — centre children and text: `<div class="stack center">`
- `.grid` — 3 / 2 / 1 columns: `<div class="grid" style="--cols:3" data-stagger>`
- `.hair-t` `.hair-b` `.hr` — hairlines: `<hr class="hr">`
- `.hide-m` `.only-m` `.only-d` — hide on phone / phone only / desktop only
- `.sr-only` — screen-reader-only text

**Type**
- `.h-hero` 40–80, `.h1` 36–64, `.h-cta` 32–48, `.h2` 28–40, `.h3` 20–24, `.h4` 18, `.h5` 16: `<h2 class="h2">Most founder stories are never checked.</h2>`
- `.h-num` — keynote number 64–160: `<p class="h-num" data-count>$216,471</p>`
- `.lead` 16/25, `.body` 15/24, `.small` 13/19, `.tiny` 12/17
- `.muted` `.faint` `.white` `.tnum`
- `.hl` — the italic cobalt word: `So can <em class="hl">you.</em>`
- `.hl-box` — tinted box behind a line: `<span class="hl-box">learned from someone.</span>`
- `.prose` — long text (blog, legal): `<div class="prose"><h2>…</h2><p>…</p></div>`

**Cards**
- `.card` — glass card, radius 18, padding 24: `<div class="card">…</div>`
- `.card-lg` (radius 24), `.card-flush` (no padding, clips: covers), `.card-solid` (darker, for over busy content), `.card-pick` (cobalt outline)
- `.card-hover` — lift 4px + glow on hover: `<a class="card card-hover" href="…" data-cursor="Read">`

**Buttons and links**
- `.btn .btn-primary` — the blue pill: `<a class="btn btn-primary" href="…">Get Pro{{arrow}}</a>`
- `.btn-glass` — secondary: `<a class="btn btn-glass btn-md" href="…">All posts</a>`
- `.btn-white` — white pill (nav "Start free")
- `.btn-md` (40px) `.btn-sm` (36px); default is 46px (48 on phones)
- `disabled` / `aria-disabled="true"`, `.is-loading` (spinner; also set `aria-busy="true"`)
- `.link` — ember text link, underline draws on hover: `<a class="link" href="…">Contact us</a>`
- `.link-arrow` — ember link with arrow: `<a class="link-arrow" href="…">Read the breakdown{{arrow}}</a>`

**Labels**
- `.chip` + `.chip-verified` | `.chip-live` | `.chip-wayback` | `.chip-claimed` | `.chip-differ` | `.chip-unverified`; `.chip-sm`: `<span class="chip chip-verified">Verified</span>`
- `.tag`, `.tag-brand` — plan tags: `<span class="tag tag-brand">Recommended</span>`

**Pills / tabs**
- `.seg` > `.seg-i` (+ `.seg-sm`), count in `<span class="n">`: see `data-tabs` below

**Forms**
- `.field` > `.field-l` + `.input` + `.field-msg`; states `.is-error`, `.is-ok` on `.field`:
  `<label class="field is-error"><span class="field-l">Email</span><input class="input" aria-invalid="true"><span class="field-msg">That email is missing its ending.</span></label>`
- `<textarea class="input">` works too.

**Accordion**
- `<details class="acc" data-acc="faq"><summary>Question</summary><div class="acc-body"><div>Answer</div></div></details>`

**Loading / feedback**
- `.skel` — shimmer block: `<span class="skel" style="width:40%"></span>`
- `LV.toast("Step saved.", {type: "ok"})` — `type`: `ok`, `error` or none; `ms` to change the 3.2s life.

**Closing panel** (added by the build): `.endcta` > `.endcta-in`.

## Data attributes (motion.js)

| Attribute | Does | Example |
|---|---|---|
| `data-reveal` | fade + rise 24px when scrolled in, once. `style="--d:.1s"` delays it | `<p data-reveal>` |
| `data-reveal="words"` | heading lights up word by word (keeps child tags like `.hl`) | `<h2 class="h2" data-reveal="words">` |
| `data-stagger` | children rise in 80ms apart | `<div class="grid" data-stagger>` |
| `data-count` | counts up to the number already in the text (1.2s, tabular) | `<span data-count>$216,471</span>` |
| `data-draw` | draws every `fill="none"` path / line inside (or the element itself) | `<svg data-draw>…</svg>` |
| `data-tabs` | sliding white indicator on a `.seg`; with `role="tab"` + `aria-controls` it also switches panels; arrow keys work; fires `lv:change` (`e.detail.value`, `e.detail.item`) | `<div class="seg" data-tabs role="tablist">` |
| `data-acc="group"` | on `<details class="acc">`: animated height, one open per group | above |
| `data-acc-hover` | on a wrapper: its accordions also open on hover (mouse only) | `<div data-acc-hover>` |
| `data-cursor="Read"` | the cursor ring shows this word over the element | `<a class="card" data-cursor="Read">` |
| `data-magnetic` | element leans toward the pointer (all `.btn-primary` already do) | `<a data-magnetic>` |
| `data-c="tl\|tr\|bl\|br"` | on `.pin`: which corner is sharp | below |

Tabs without panels: use `<button class="seg-i" aria-pressed="true">`. Tabs that are links: `<a class="seg-i" aria-current="page">`.

**Comment pins** (homepage design credits only):

```html
<a class="pin" data-c="bl" style="left:540px;top:396px" href="https://www.scale.com" target="_blank" rel="noopener">
  <img src="/assets/new/favs/scale.com.png" alt="" width="24" height="24"><span class="pin-t">Headline type from <b>scale.com</b></span></a>
```

`.pin` is `position:absolute`: put it in a `position:relative` parent and set `left/right/top/bottom` so the sharp corner overlaps the credited part by about 5px. Add `.pin-static` to keep it in the flow. The text must be "words, then `<b>domain</b>` last". The arrow and the typing are added by motion.js.

**JS API**: `LV.init(root)` after you inject markup (re-scans reveals, tabs, accordions, pins); `LV.toast(msg, opts)`; `LV.reduced`.

## Motion you get for free

Page-to-page view transitions (logo and nav stay put), the once-per-session intro, nav bar → pill → card, the particle band canvas, the custom cursor (mouse only), magnetic blue buttons, button press, link underline, focus rings. All of it turns instant under `prefers-reduced-motion`. Hidden-before-reveal states only apply when JS runs (`html.js`), so pages read fine without it.

If you add your own animation: use `var(--out)`, animate only `transform` / `opacity` where you can, start from a visible default, and wrap it in `@media (prefers-reduced-motion:no-preference)`.

Your page script (listed in meta `js`, loaded `defer`) runs **before** motion.js starts, so you can prepare markup first; use `DOMContentLoaded` or later if you need `LV` to have finished.

## Check before you hand off

`python build_new.py`, then `python -m http.server 5191 --bind 127.0.0.1` from the repo root and open `http://127.0.0.1:5191/new/<path>/` at 1440, 834 and 390: no sideways scroll, no console errors, keyboard reaches everything, reduced motion still shows everything.
