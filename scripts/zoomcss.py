# Idempotent rewrite (run after adding CSS: python scripts/zoomcss.py, then python build_app.py) of LaunchVault CSS for the auto zoom (html{zoom:var(--z)}):
#  1. viewport units -> calc(Nvh/var(--z,1)) so they still mean "of the window" under zoom
#  2. font sizes 12px..14.99px -> max(Npx,calc(12px/var(--z,1))) so small text never renders under 12px
import re, sys, glob, os
ROOT = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
files = [os.path.join(ROOT, "src", f) for f in ("_mock.css", "_extra.css", "_motion.css", "_hero.css")]
files += [f for f in glob.glob(os.path.join(ROOT, "assets", "*.css")) if not f.endswith("site.css")]
files += [f for f in glob.glob(os.path.join(ROOT, "src", "*.html")) if "_mock" not in f] + glob.glob(os.path.join(ROOT, "src", "app", "*.html")) + [os.path.join(ROOT, "build_app.py")]   # inline <style> and style=""
VU = re.compile(r"(?<![\w.#-])(\d*\.?\d+)(dvh|svh|lvh|vh|dvw|svw|lvw|vw|vmin|vmax)\b(?!/var\(--z)")
FS = re.compile(r"(font-size\s*:\s*)(\d*\.?\d+)px")
FONT = re.compile(r"((?<![\w-])font\s*:\s*)([^;}]*)")
FLOOR = lambda n: f"max({n}px,calc(12px/var(--z,1)))"
small = lambda n: 12 <= float(n) < 15
tot = {"vu": 0, "fs": 0}
def fs(m):
    if not small(m.group(2)): return m.group(0)
    tot["fs"] += 1; return m.group(1) + FLOOR(m.group(2))
def font(m):
    v = m.group(2)
    if "calc(12px/var(--z" in v: return m.group(0)
    s = re.search(r"(?<![/\w.(-])(\d*\.?\d+)px", v)
    if not s or not small(s.group(1)): return m.group(0)
    tot["fs"] += 1; return m.group(1) + v[:s.start()] + FLOOR(s.group(1)) + v[s.end():]
def vu(m):
    tot["vu"] += 1; return f"calc({m.group(1)}{m.group(2)}/var(--z,1))"
for f in files:
    t = open(f, encoding="utf-8").read()
    n = VU.sub(vu, t)   # the (?!/var) lookahead skips what is already wrapped
    n = FS.sub(fs, n); n = FONT.sub(font, n)
    if n != t: open(f, "w", encoding="utf-8", newline="").write(n); print("rewrote", os.path.relpath(f, ROOT))
print(tot)
