# LaunchVault shared components

Owner: the homepage coder (`assets/site.css`, `assets/site.js`, `src/_mock.css`, `src/_extra.css`, `build.py`).
Inner pages add their own styles in `assets/pages.css`, which loads after site.css on every page.
Status: **done**. Everything below is live in site.css and site.js.

## Emphasis (replaces the grey "muted second clause")
```html
<h2>Every number has a source. <em class="em">And a date.</em></h2>
```
- `.em` is true italic (Schibsted Grotesk italic) in brand blue. On `.dk` sections it is light blue (#93B4FF) automatically.
- Accent variants, one job each, use rarely: `.em.v` emerald (Verified), `.em.x` coral (Sources differ), `.em.s` sky (live), `.em.t` teal (2nd series), `.em.p` violet ("about you", quiz only).
- Legacy `<span class="mute">` renders exactly like `.em`, so old markup is already fixed. Prefer `<em class="em">` in new markup.
- Never use grey for emphasis.

## Buttons and links
```html
<a class="btn btn-p btn-lg" href="/signup/">Get the free breakdown</a>              <!-- solid: darkens + lifts 1px, magnetic -->
<a class="btn btn-s btn-lg" href="/breakdowns/">Check out our breakdowns <span class="arr" aria-hidden="true">→</span></a>  <!-- outline: fills brand blue, white text -->
<a class="tlink" href="/how-we-check/">How we check numbers <span class="arr" aria-hidden="true">→</span></a>             <!-- text link: fills brand blue on hover -->
```
- Any `span[aria-hidden]` arrow inside `.btn` or `.tlink` slides right 4px on hover (`.arr` is the explicit name).
- On `.dk` sections `.btn-s` is a dark outline that still fills blue on hover.
- Sizes: `.btn-lg` (48px), default (44px), `.btn-sm` (32px, only inside product pictures).

## Scroll reveal and stagger (automatic)
- Every direct child of `main section .wrap` rises 12px and fades in once, when it scrolls into view.
- Put `data-stagger` on a grid/list container to reveal its children one after another (60ms apart).
- Opt out with `data-noreveal` on the element.
- All motion is off under `prefers-reduced-motion`.

## Count-up numbers
```html
<span class="kv" data-count>$430,896</span>
```
- Counts from 0 to the number already in the text on first view, keeping `$`, commas, `~`, `K`/`M`, decimals and any suffix. `.kpi .kv` count automatically.

## Tabs and segmented controls (one look everywhere)
```html
<div class="seg" role="group" aria-label="Billing">
  <button type="button" aria-pressed="true" data-b="m">Monthly</button>
  <button type="button" aria-pressed="false" data-b="y">Yearly <small>Save up to 20%</small></button>
</div>
```
- A white indicator slides under the pressed/selected button (inserted by JS). Works with `aria-pressed` or `aria-selected`.
- Filters use the same look: `<div class="filters" role="group">` of `<button class="chip" data-f="saas" aria-pressed="false">`. The filter targets the NEXT sibling element: any child with `data-cat="saas ai"` is hidden/shown, and an `.empty` child shows when nothing matches. `?f=saas` preselects when the container has `data-url="1"` (build.py adds it on /breakdowns/).
- Tab panels: `<div data-tabs>` holding `<button role="tab" aria-controls="p1" aria-selected="true">` buttons, and panels `<div role="tabpanel" id="p1">` anywhere on the page. Non-selected panels get `hidden`; the new one fades in.

## FAQ accordion (single-open, animated)
```html
<div class="acc">
  <details><summary>Where do the numbers come from?</summary><p>Answer…</p></details>
  <details><summary>…</summary><p>…</p></details>
</div>
```
- Opening one closes the open one in the same `.acc`. Height animates; the chevron rotates. Keyboard works (it is a real `<details>`).
- `.faq details` (the old markup) gets the same behaviour.

## Status labels (unchanged)
`<span class="lb v">Verified</span>` · `.lb.c` Claimed · `.lb.x` Sources differ · `.lb.l` Live.

## Cards: hover states
- `.post` (blog card): background shifts to the alt tint, lifts 2px, title turns blue.
- `.bcard` (story card, see below), `.scell` (source card), `.ncard`, `.mcard`, `.plan`: border darkens + lift. Rows `.sl-row`, `.fr` tint on hover.

## Fragments cut from the homepage (build.py)
These placeholders in page bodies are filled from `src/index.body.html`, so they change when the homepage changes:
- `{{STORIES}}` story cards + filters (used on /breakdowns/). Now a card grid (`.bgrid` of `.bcard`), see below.
- `{{SOURCES}}` source cards (used on /how-we-check/). **Yes: the cards carry the richer content** (what we take, the label it gives, an example number with its date, limits), 12 source cards (TrustMRR, Stripe, GitHub, Wayback, DEV, Mixergy, Starter Story, Superframeworks, Hacker News, Product Hunt, Founder posts, Company blogs) plus a footer line for Google Trends and YouTube, expanding in place. No popovers. Fine to keep using `{{SOURCES}}`.
- `{{PLANS}}` 3-tier pricing + comparison (used on /pricing/).
- `{{FAQ}}` FAQ (used on /pricing/).
- `{{POSTS}}` blog cards (used on /blog/ and the posts).

## Source card (expands in place)
```html
<div class="sgrid" data-stagger>
  <button class="scell" type="button" aria-expanded="false" style="--h:#635BFF">
    <span class="lg"><svg aria-hidden="true"><use href="#i-stripe"/></svg>Stripe</span>   <!-- or <span class="wmk">TrustMRR</span> for text wordmarks -->
    <span class="sd">One-line description.</span>
    <span class="gv"><span class="lb v">Verified</span>through TrustMRR</span>
    <span class="more"><span class="more-in">
      <span class="mr"><b>What we take</b>…</span>
      <span class="mr ex"><b>Example</b><span class="exn">$186,713/mo</span>Postiz · Sep 2026 <span class="lb c">Claimed</span></span>
      <span class="mr"><b>Limits</b>…</span>
    </span></span><span class="pl" aria-hidden="true"></span>
  </button>
</div>
```
- Opens on hover (mouse), focus (keyboard) or tap (touch, toggles). The card's own height animates; nothing floats. `--h` is the logo's brand colour on hover/open.
- Class names used by the homepage that you should avoid reusing: `.logogrid`, `.lgo`, `.bgrid`, `.bcard`, `.vsx`, `.bars`, `.lstrip`, `.tpanel`.

## Footer
The ¹²³ footnotes block is gone. Please remove any `<sup>1</sup>`-style footnote marks from your pages.

## Build safety
build.py now reads every input before writing and writes through a temp file, so a missing input can no longer leave `site.css` empty. It also asserts site.css is > 20 KB.

## Tap targets
`.crumbs a`, `main .tlink`, `.bk-toc a`, `.ltoc a` are 44px tall in site.css at every width (you can drop the copies in pages.css).

## Pricing (3 tiers) and plan links
`{{PLANS}}` = billing `.seg` + `.plans.p3` (Free, Pro highlighted dark, Builder with a `<!-- TIER NAME TBC -->` comment) + parent box + "What's in each plan" table + honest comparison.
Buttons go to `/signup/`, `/signup/?plan=pro`, `/signup/?plan=builder`. site.js un-hides `#plannote` for `plan=pro|builder|full` and writes "Pro"/"Builder" into a `.pname` span inside it if you add one.

## Site structure (2026-11-17 scope change)
Pages: `/`, `/blog/` + posts (incl. `/blog/postiz/` from `src/post-postiz.body.html`), `/legal/privacy/`, `/legal/terms/`, `/welcome/` (`src/welcome.body.html`), `404.html`.
Removed (folders deleted by build.py, redirected in vercel.json): /breakdowns/, /breakdowns/postiz/ → /blog/postiz/, /how-we-check/ → /#sources, /pricing/ → /#pricing, /signin/ and /signup/ → /welcome/.
Homepage order (2026-11-18 condense): hero, `#sources` (logo band; each tile wipes its detail in), `#check` (dark race chart),
`#stories` (feature card + cards; `#quiz` opens from "Find stories like you" and reorders the cards), `#pricing` (plan table behind
"Compare plans"), `#inside` (dark; tab 4 holds the old "first four moves"), `#blog`, `#faq`. `#moves-sec` and `#sourced` are gone.
Section CSS for the condensed layout lives in `assets/design.css` (linked last). Nav tabs: Stories, How we check, Pricing, FAQ, Blog; the homepage highlights the tab for the section in view (`aria-current="location"`).
Sign in → `/welcome/`; sign-up CTAs → `/welcome/#signup` (plans add `?plan=pro|builder`). Fragments left in build.py: `{{POSTS}}`, `{{PLANS}}`, `{{FAQ}}`.
