"""404.html in the Vault look (same words as the app's not-found page). Picked up by build_new.py; written to the site root."""
import os

BODY = """<section class="sec nf404">
  <div class="wrap">
    <p class="nf404-n" aria-hidden="true">404</p>
    <h1 class="h1">This page isn't here. <em class="hl">We checked.</em></h1>
    <p class="lead">The link might be old, or the page hasn't been written yet.</p>
    <div class="nf404-b">{{cta}}<a class="btn btn-glass" href="/">Go to the homepage</a><a class="btn btn-glass" href="/blog/">Open the blog</a></div>
  </div>
</section>
<style>
.nf404{padding-top:clamp(120px,22vh,220px);min-height:72vh}
.nf404 .wrap{display:flex;flex-direction:column;align-items:flex-start;gap:16px}
.nf404-n{font:700 14px/1 var(--fd);color:var(--muted);padding:8px 12px;border-radius:999px;background:rgba(255,255,255,.06);box-shadow:inset 0 0 0 1px rgba(255,255,255,.1)}
.nf404-b{display:flex;flex-wrap:wrap;gap:10px;margin-top:12px}
</style>"""


def register(B):
    page = B.render(body=BODY, title="Page not found · LaunchVault", description="This page isn't here.", path="404.html", end_cta=False)
    open(os.path.join(B.ROOT, "404.html"), "w", encoding="utf-8", newline="\n").write(page)
