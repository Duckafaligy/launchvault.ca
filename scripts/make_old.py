"""One-off (root swap, 2026-11-24): freeze the pre-swap site under /old/ so it stays reachable for a look back.

    python scripts/make_old.py <git ref of the pre-swap main>

Copies the old home, blog, legal and app pages from that ref into old/, and the old scripts into assets/old/, with the
internal links pointed at /old/... . Sign-in is NOT copied: /sign-in/ and /sign-up/ at the root are the only auth pages,
so the old pages link there. The output is committed and never rebuilt; rollback of the swap itself is a git revert.
"""
import os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF = sys.argv[1]
PAGES = re.compile(r"^(index\.html|(blog|legal|app)/.*index\.html)$")
JS = re.compile(r"^assets/[\w-]+\.js$")
LINKS = re.compile(r"(?<![\w/.-])/(app/|blog/|legal/)")          # same guard as build_newapp._PATHS: not /assets/app.css, not https://host/app/


def relink(t):
    t = LINKS.sub(lambda m: "/old/" + m.group(1), t)
    return t.replace("/old/blog/feed.xml", "/blog/feed.xml")


def page(t):
    t = relink(t).replace('href="/"', 'href="/old/"').replace('href="/#', 'href="/old/#')
    return re.sub(r'src="/assets/([\w-]+\.js)"', r'src="/assets/old/\1"', t)


assert relink('href="/app/x/" /assets/app.css https://www.launchvault.ca/app/ "/blog/" /sign-in/?next=/app/a') == \
    'href="/old/app/x/" /assets/app.css https://www.launchvault.ca/app/ "/old/blog/" /sign-in/?next=/old/app/a'

files = subprocess.run(["git", "ls-tree", "-r", "--name-only", REF], capture_output=True, text=True, cwd=ROOT, check=True).stdout.split("\n")
n = 0
for f in files:
    out, fn = (os.path.join("old", f), page) if PAGES.match(f) else (os.path.join("assets", "old", os.path.basename(f)), relink) if JS.match(f) else (None, None)
    if not out:
        continue
    t = subprocess.run(["git", "show", f"{REF}:{f}"], capture_output=True, cwd=ROOT, check=True).stdout.decode("utf-8")
    assert 'content="noindex' in t or out.endswith(".js"), f + ": old pages must stay noindex"
    out = os.path.join(ROOT, out)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, "w", encoding="utf-8", newline="").write(fn(t))
    n += 1
print(f"old: {n} files -> old/ and assets/old/")
