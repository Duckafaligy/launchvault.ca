"""Dark "Vault" copies of the app stylesheets (2026-11-23 dashboard redesign, Paper file "LaunchVault · App").

The light sources stay the single place to edit layout; this script maps every hard-coded colour to the dark palette
by WHAT it paints (text, surface, line or shadow), and writes assets/<name>-dark.css for /app/ only.
chart.css is shared with the public blog, which is still light, so the blog keeps the original.

Run after any change to app/community/assistant/chart.css:  python scripts/darken.py
"""
import re
from pathlib import Path

A = Path(__file__).resolve().parent.parent / "assets"
FILES = ["app", "community", "assistant", "chart"]

W = lambda a: f"rgba(255,255,255,{a})"
BLUE_T, BLUE_BG, BLUE_LINE = "#9DB8FF", "rgba(47,107,255,.14)", "rgba(47,107,255,.45)"
# hex -> (text, surface, line)
MAP = {
    # ink / greys
    "#0B1220": ("#FFFFFF", "#07070A", W(.16)), "#111827": ("#FFFFFF", "#07070A", W(.16)), "#1F2937": ("#FFFFFF", W(.1), W(.16)),
    "#374151": (W(.86), W(.1), W(.16)), "#334155": (W(.86), W(.1), W(.16)),
    "#4B5563": (W(.66), W(.08), W(.14)), "#475569": (W(.66), W(.08), W(.14)), "#64748B": (W(.6), W(.08), W(.14)), "#6B7280": (W(.6), W(.08), W(.14)),
    "#9CA3AF": (W(.5), W(.08), W(.16)), "#94A3B8": (W(.5), W(.08), W(.16)),
    "#CBD5E1": (W(.4), W(.1), W(.18)), "#D1D5DB": (W(.4), W(.1), W(.18)), "#D9DEE7": (W(.4), W(.08), W(.14)),
    "#E5E7EB": (W(.4), W(.06), W(.1)), "#E2E8F0": (W(.4), W(.06), W(.1)), "#E9EDF2": (W(.4), W(.06), W(.1)), "#E8ECF1": (W(.4), W(.06), W(.1)),
    "#EEF0F3": (W(.4), W(.07), W(.08)), "#EEF1F5": (W(.4), W(.06), W(.08)), "#F1F3F6": (W(.4), W(.05), W(.08)), "#F1F5F9": (W(.4), W(.05), W(.08)),
    "#EEF2F7": (W(.4), W(.05), W(.08)), "#F3F5F9": (W(.4), W(.05), W(.08)), "#F7F8FA": (W(.4), W(.04), W(.08)), "#F8FAFC": (W(.4), W(.04), W(.08)),
    "#FBFCFE": (W(.4), W(.04), W(.08)), "#FCFCFD": (W(.4), W(.04), W(.08)),
    "#FFFFFF": ("#FFFFFF", W(.05), W(.12)), "#FFF": ("#FFFFFF", W(.05), W(.12)), "#000000": ("#000000", "#000000", "rgba(0,0,0,.6)"), "#000": ("#000", "#000", "rgba(0,0,0,.6)"),
    # brand blue
    "#2563EB": (BLUE_T, "#1F45B5", BLUE_LINE), "#1D4ED8": (BLUE_T, "#2A55D0", BLUE_LINE), "#1E40AF": (BLUE_T, "#1A3B9C", BLUE_LINE), "#1E3A8A": (BLUE_T, BLUE_BG, BLUE_LINE),
    "#93B4FF": (BLUE_T, BLUE_BG, BLUE_LINE), "#BFD3FB": (BLUE_T, BLUE_BG, BLUE_LINE), "#BFD2FB": (BLUE_T, BLUE_BG, BLUE_LINE),
    "#DBEAFE": (BLUE_T, BLUE_BG, BLUE_LINE), "#DBE6FF": (BLUE_T, BLUE_BG, BLUE_LINE), "#E0EAFF": (BLUE_T, BLUE_BG, BLUE_LINE), "#E8EEFF": (BLUE_T, BLUE_BG, BLUE_LINE),
    "#EEF3FE": (BLUE_T, BLUE_BG, BLUE_LINE), "#EEF3FF": (BLUE_T, BLUE_BG, BLUE_LINE), "#EFF4FF": (BLUE_T, BLUE_BG, BLUE_LINE), "#F3F7FF": (BLUE_T, "rgba(47,107,255,.1)", BLUE_LINE),
    "#F4F8FF": (BLUE_T, "rgba(47,107,255,.1)", BLUE_LINE), "#F5F8FF": (BLUE_T, "rgba(47,107,255,.1)", BLUE_LINE), "#F7F9FF": (BLUE_T, "rgba(47,107,255,.08)", BLUE_LINE),
    "#0EA5E9": ("#7CD4FF", "rgba(14,165,233,.16)", "rgba(14,165,233,.45)"), "#075985": ("#7CD4FF", "rgba(14,165,233,.16)", "rgba(14,165,233,.45)"),
    # danger / pop
    "#E11D48": ("#FF8A8A", "#C8323F", "rgba(255,90,90,.5)"), "#BE123C": ("#FF8A8A", "rgba(255,90,90,.16)", "rgba(255,90,90,.45)"), "#9F1239": ("#FF8A8A", "rgba(255,90,90,.16)", "rgba(255,90,90,.45)"),
    "#FFF1F2": ("#FF8A8A", "rgba(255,90,90,.12)", "rgba(255,90,90,.35)"), "#FECDD3": ("#FF8A8A", "rgba(255,90,90,.12)", "rgba(255,90,90,.35)"),
    # ok / verified (mint)
    "#047857": ("#3BE0A0", "rgba(0,194,122,.16)", "rgba(0,194,122,.45)"), "#065F46": ("#3BE0A0", "rgba(0,194,122,.16)", "rgba(0,194,122,.45)"),
    "#15803D": ("#3BE0A0", "rgba(0,194,122,.16)", "rgba(0,194,122,.45)"), "#16A34A": ("#3BE0A0", "#00A86B", "rgba(0,194,122,.45)"),
    "#10B981": ("#00C27A", "#00C27A", "rgba(0,194,122,.45)"), "#F0FDF7": ("#3BE0A0", "rgba(0,194,122,.1)", "rgba(0,194,122,.35)"),
    "#DCFCE7": ("#3BE0A0", "rgba(0,194,122,.12)", "rgba(0,194,122,.35)"), "#DDF5EA": ("#3BE0A0", "rgba(0,194,122,.12)", "rgba(0,194,122,.35)"),
    # violet / orange / teal / pink
    "#7C3AED": ("#B9A6FF", "#7B5CFF", "rgba(139,108,255,.45)"), "#6D28D9": ("#B9A6FF", "rgba(139,108,255,.16)", "rgba(139,108,255,.45)"), "#5B21B6": ("#B9A6FF", "rgba(139,108,255,.16)", "rgba(139,108,255,.45)"),
    "#EDE9FE": ("#B9A6FF", "rgba(139,108,255,.14)", "rgba(139,108,255,.4)"), "#F1EEFF": ("#B9A6FF", "rgba(139,108,255,.12)", "rgba(139,108,255,.4)"),
    "#C2410C": ("#FF9B7A", "rgba(255,122,69,.16)", "rgba(255,122,69,.45)"), "#9A3412": ("#FF9B7A", "rgba(255,122,69,.16)", "rgba(255,122,69,.45)"),
    "#E5533D": ("#FF9B7A", "#E5533D", "rgba(255,122,69,.45)"), "#FFEDD5": ("#FF9B7A", "rgba(255,122,69,.14)", "rgba(255,122,69,.4)"),
    "#0F766E": ("#5EE3D1", "rgba(46,196,214,.16)", "rgba(46,196,214,.45)"), "#115E59": ("#5EE3D1", "rgba(46,196,214,.16)", "rgba(46,196,214,.45)"),
    "#D5F5F1": ("#5EE3D1", "rgba(46,196,214,.14)", "rgba(46,196,214,.4)"),
    "#A21CAF": ("#F08CFF", "rgba(217,70,239,.16)", "rgba(217,70,239,.45)"), "#D946EF": ("#F08CFF", "#D946EF", "rgba(217,70,239,.45)"),
    # more tints found on the first run
    "#99D5CF": ("#5EE3D1", "rgba(46,196,214,.14)", "rgba(46,196,214,.4)"), "#A9B6CB": (W(.5), W(.08), W(.16)),
    "#F5F7FF": (BLUE_T, "rgba(47,107,255,.1)", BLUE_LINE), "#C7D7FB": (BLUE_T, BLUE_BG, BLUE_LINE), "#C7D5FE": (BLUE_T, BLUE_BG, BLUE_LINE), "#C7D2FE": (BLUE_T, BLUE_BG, BLUE_LINE),
    "#DCE6FB": (BLUE_T, BLUE_BG, BLUE_LINE), "#DCE6FD": (BLUE_T, BLUE_BG, BLUE_LINE), "#E0E7FF": (BLUE_T, BLUE_BG, BLUE_LINE), "#93C5FD": (BLUE_T, BLUE_BG, BLUE_LINE),
    "#B91C1C": ("#FF8A8A", "rgba(255,90,90,.16)", "rgba(255,90,90,.45)"), "#FFE4E9": ("#FF8A8A", "rgba(255,90,90,.12)", "rgba(255,90,90,.35)"),
    "#FFF5F7": ("#FF8A8A", "rgba(255,90,90,.1)", "rgba(255,90,90,.35)"), "#FFF7F8": ("#FF8A8A", "rgba(255,90,90,.1)", "rgba(255,90,90,.35)"),
    "#059669": ("#3BE0A0", "#00A86B", "rgba(0,194,122,.45)"), "#166534": ("#3BE0A0", "rgba(0,194,122,.16)", "rgba(0,194,122,.45)"),
    "#86EFAC": ("#3BE0A0", "rgba(0,194,122,.2)", "rgba(0,194,122,.45)"), "#BBF7D0": ("#3BE0A0", "rgba(0,194,122,.14)", "rgba(0,194,122,.4)"),
    "#ECFDF5": ("#3BE0A0", "rgba(0,194,122,.1)", "rgba(0,194,122,.35)"), "#F0FDF4": ("#3BE0A0", "rgba(0,194,122,.1)", "rgba(0,194,122,.35)"),
    "#4C1D95": ("#B9A6FF", "rgba(139,108,255,.16)", "rgba(139,108,255,.45)"), "#F3E8FF": ("#B9A6FF", "rgba(139,108,255,.12)", "rgba(139,108,255,.4)"),
    "#FAF9FF": ("#B9A6FF", "rgba(139,108,255,.08)", "rgba(139,108,255,.35)"), "#FFF7ED": ("#FF9B7A", "rgba(255,122,69,.1)", "rgba(255,122,69,.35)"),
}
TEXT_PROPS = {"color", "fill", "stroke", "caret-color", "text-decoration-color", "-webkit-text-fill-color", "accent-color", "outline-color", "text-shadow"}
SURF_PROPS = {"background", "background-color", "background-image"}


def kind(prop):
    p = prop.lower()
    if p in TEXT_PROPS:
        return 0
    if p in SURF_PROPS:
        return 1
    return 2  # border*, box-shadow, outline


def rgba_dark(m, k):
    """Ink-tinted rgba (11,18,32 / 15,23,42 / 0,0,0) -> white tint on surfaces, deeper black in shadows; white glass -> dark glass."""
    r, g, b, a = [x.strip() for x in m.group(1).split(",")] + ["1"] * (4 - len(m.group(1).split(",")))
    a = float(a)
    ink = (r, g, b) in {("11", "18", "32"), ("15", "23", "42"), ("0", "0", "0")}
    if ink:
        if k == 1:
            return W(round(min(a * 1.6, .16), 3))
        if k == 0:
            return W(round(max(.5, 1 - a), 3))
        return f"rgba(0,0,0,{round(min(a * 3, .7), 3)})"
    if (r, g, b) == ("255", "255", "255") and a >= .9:
        return "rgba(12,12,17,.72)" if k == 1 else m.group(0)
    if (r, g, b) == ("37", "99", "235"):
        return f"rgba(47,107,255,{min(a * 1.4, .6):.2f})"
    return m.group(0)


HEX = re.compile(r"#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b")
RGBA = re.compile(r"rgba?\(([^)]*)\)")
DECL = re.compile(r"(?<![\w-])(-{0,2}[a-zA-Z][\w-]*)\s*:\s*([^;{}]+)")


def darken(css):
    def decl(m):
        prop, val = m.group(1), m.group(2)
        if prop.startswith("--") or ":" in prop:
            return m.group(0)  # custom properties are set in vault.css
        k = kind(prop)
        if k == 1:
            val = val.replace("var(--ink)", "var(--inkbg)")  # ink was the dark fill (avatars, toasts, tooltips); in the Vault ink is white text
        val = HEX.sub(lambda h: MAP.get(h.group(0).upper(), (h.group(0),) * 3)[k], val)
        val = RGBA.sub(lambda r: rgba_dark(r, k), val)
        return f"{prop}:{val}"
    return DECL.sub(decl, css)


def selftest():
    assert darken(".a{background:#fff;color:#fff}") == ".a{background:rgba(255,255,255,0.05);color:#FFFFFF}"
    assert darken(".b{border:1px solid #E5E7EB}") == ".b{border:1px solid rgba(255,255,255,0.1)}"
    assert darken(".c{color:#2563EB;background:#2563EB}") == ".c{color:#9DB8FF;background:#1F45B5}"
    assert darken(".d{box-shadow:0 4px 8px rgba(15,23,42,.1)}") == ".d{box-shadow:0 4px 8px rgba(0,0,0,0.3)}"
    assert darken(":root{--line:#E5E7EB}") == ":root{--line:#E5E7EB}"
    assert darken("a:hover{color:#374151}") == "a:hover{color:rgba(255,255,255,0.86)}"


if __name__ == "__main__":
    selftest()
    for f in FILES:
        src = (A / f"{f}.css").read_text(encoding="utf8")
        src = src.replace('"Schibsted Grotesk"', '"Inter"').replace('"Inter Tight"', '"Inter"')  # the Vault app is all Inter
        (A / f"{f}-dark.css").write_text(f"/* GENERATED by scripts/darken.py from {f}.css. Do not edit: edit {f}.css or vault.css. */\n" + darken(src), encoding="utf8")
        body = re.sub(r"--[\w-]+\s*:[^;}]+", "", re.sub(r"/\*.*?\*/", "", darken(src), flags=re.S))
        left = sorted({h.upper() for h in HEX.findall(body)} - {v.upper() for t in MAP.values() for v in t} - {"#FFFFFF", "#000000", "#000"})
        print(f, "ok", "unmapped:", left)
