"""Refresh the Verified TrustMRR numbers in story JSON files.

    python scripts/refresh_numbers.py [slug ...] [--write] [--drafts]

For every story with a https://trustmrr.com/startup/<id> source it fetches that public page ONCE and reads the
schema.org JSON-LD TrustMRR puts in it ("Current MRR", "Verified revenue, all time",
"Current customers/subscriptions") plus the page's "Last updated: <date>" line. Then it updates:
  - numbers[] items labelled Verified with a trustmrr source whose k starts with "MRR", "Revenue, all-time",
    or contains "ubscriptions" (value + date)
  - headline (when its k is MRR)
  - the latest series point, only for MRR-style series (last point Verified, from TrustMRR, dated in
    series.point_dates): same month = overwrite, a new month = add a point. Older points are kept.
Calendar-month numbers ("Revenue in Oct 2026") are NOT touched: the page has no calendar-month value.
Prints a diff. Without --write nothing is saved. It also lists prose that still quotes the old values so a
person (or the routine) can update the sentences by hand. If the page can't be parsed it says so and skips
that story rather than guess.
"""
import json, os, re, sys, glob, html, urllib.request

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STORIES = os.path.join(SITE, "data", "stories")
TM = re.compile(r"https://trustmrr\.com/startup/([a-z0-9-]+?)(?:\.md)?/?$")
MON = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()


def tm_id(src): m = TM.match(src or ""); return m.group(1) if m else None


def parse(page, tid):
    """-> {"mrr": int, "all_time": int, "subs": int, "date": "Nov 28 2026"}; raises ValueError if unsure.
    Reads only the startup's own Organization node: the page also lists other startups with their own MRR."""
    props, me = {}, f"https://trustmrr.com/startup/{tid}#organization"
    for block in re.findall(r'<script type="application/ld\+json"[^>]*>(.*?)</script>', page, re.S):
        try: data = json.loads(html.unescape(block))
        except ValueError: continue
        stack = [data]
        while stack:
            o = stack.pop()
            if isinstance(o, dict):
                if o.get("@id") == me and o.get("additionalProperty"):   # skip bare {"@id": ...} references
                    props = {p["name"]: p.get("value") for p in o.get("additionalProperty") or [] if isinstance(p, dict) and "name" in p}
                stack.extend(o.values())
            elif isinstance(o, list): stack.extend(o)
    need = {"mrr": "Current MRR", "all_time": "Verified revenue, all time", "subs": "Current customers/subscriptions"}
    miss = [v for v in need.values() if not isinstance(props.get(v), (int, float))]
    if miss: raise ValueError("JSON-LD is missing " + ", ".join(miss))
    m = re.search(r"Last updated:(?:\s|<!-- -->)*([A-Z][a-z]{2}) (\d{1,2}), (\d{4})", page)
    if not m: raise ValueError("the page shows no 'Last updated' Stripe sync date, so the numbers may be stale")
    out = {k: int(round(props[v])) for k, v in need.items()}
    out["date"] = f"{m.group(1)} {int(m.group(2))} {m.group(3)}"
    return out


def ym(date): mo, _, y = date.split(); return f"{y}-{MON.index(mo) + 1:02d}"


def money(n): return "${:,}".format(n)


def update(S, T, src):
    """Apply TrustMRR values T to story S in place. Returns [(old_fragment, new_fragment)] and a list of old value strings."""
    frags, olds = [], []
    def swap(obj, **kw):
        old = json.dumps(obj, ensure_ascii=False); obj.update(kw); new = json.dumps(obj, ensure_ascii=False)
        if old != new: frags.append((old, new))
    for n in S.get("numbers") or []:
        if n.get("label") != "Verified" or not tm_id(n.get("source")): continue
        k = n.get("k", "")
        val = money(T["mrr"]) if k.startswith("MRR") else money(T["all_time"]) if k.startswith("Revenue, all-time") else f'{T["subs"]:,}' if "ubscriptions" in k else None
        if val and (n["v"] != val or n.get("date") != T["date"]):
            olds.append(n["v"]); swap(n, v=val, date=T["date"])
    h = S.get("headline")
    if h and h.get("k") == "MRR" and tm_id(h.get("source")) and (h.get("value") != T["mrr"] or h.get("date") != T["date"]):
        swap(h, value=T["mrr"], date=T["date"])
    se = S.get("series") or {}
    pts, pd = se.get("points") or [], se.get("point_dates")
    if pts and pd is not None and len(pts[-1]) > 3 and pts[-1][2] == "Verified" and "TrustMRR" in str(pts[-1][3]):
        last, month = pts[-1], ym(T["date"])
        old_pd = json.dumps(pd, ensure_ascii=False)
        if last[0] == month and last[1] != T["mrr"]:
            o = json.dumps(last, ensure_ascii=False); last[1] = T["mrr"]; frags.append((o, json.dumps(last, ensure_ascii=False)))
        elif last[0] < month:
            new = [month, T["mrr"], "Verified", last[3]]; o = json.dumps(last, ensure_ascii=False)
            pts.append(new); frags.append((o, o + ",\n      " + json.dumps(new, ensure_ascii=False)))
        pd[month] = T["date"]
        if json.dumps(pd, ensure_ascii=False) != old_pd: frags.append((old_pd, json.dumps(pd, ensure_ascii=False)))
    return frags, olds


def save(path, text, S, frags):
    """Swap only the changed fragments so the file keeps its hand formatting; fall back to a full re-dump."""
    t = text
    for o, n in frags:
        if t.count(o) != 1: break
        t = t.replace(o, n)
    else:
        if json.loads(t) == S: open(path, "w", encoding="utf-8", newline="\n").write(t); return "patched"
    open(path, "w", encoding="utf-8", newline="\n").write(json.dumps(S, ensure_ascii=False, indent=2) + "\n")
    return "rewritten"


def fetch(tid):
    req = urllib.request.Request(f"https://trustmrr.com/startup/{tid}", headers={"User-Agent": "Mozilla/5.0 (LaunchVault numbers refresh; one request per story per day)"})
    with urllib.request.urlopen(req, timeout=30) as r: return r.read().decode("utf-8", "replace")


def main(argv):
    write = "--write" in argv
    slugs = [a for a in argv if not a.startswith("--")]
    paths = sorted(glob.glob(os.path.join(STORIES, "*.json")) + (glob.glob(os.path.join(STORIES, "drafts", "*.json")) if "--drafts" in argv else []))
    if slugs: paths = [p for p in paths if os.path.basename(p)[:-5] in slugs]
    failed = 0
    for p in paths:
        text = open(p, encoding="utf-8").read(); S = json.loads(text)
        ids = [tm_id(x.get("source")) for x in (S.get("numbers") or []) + [S.get("headline") or {}]]
        ids = [i for i in ids if i]
        if not ids: print(f"-- {S['slug']}: no TrustMRR source, skipped"); continue
        tid = max(set(ids), key=ids.count)
        try: T = parse(fetch(tid), tid)
        except Exception as e:
            failed += 1; print(f"!! {S['slug']}: could not read trustmrr.com/startup/{tid} reliably ({e}); nothing changed"); continue
        frags, olds = update(S, T, tid)
        if not frags: print(f"== {S['slug']}: up to date ({money(T['mrr'])} MRR, {T['date']})"); continue
        print(f"~~ {S['slug']} (trustmrr.com/startup/{tid}, last updated {T['date']})")
        for o, n in frags: print(f"   - {o}\n   + {n}")
        stale = [f"{k}: {v[:90]}" for k, v in walk(S) for o in olds
                 if re.search(r"(?<![\d,.])" + re.escape(o) + r"(?![\d,])", v) and not k.startswith(("numbers", "headline"))]
        for s in stale: print(f"   ! prose still quotes an old value, update by hand -> {s}")
        if write: print(f"   saved ({save(p, text, S, frags)})")
    if not write: print("(dry run: add --write to save)")
    return 1 if failed else 0


def walk(o, path=""):
    if isinstance(o, dict):
        for k, v in o.items(): yield from walk(v, f"{path}.{k}" if path else k)
    elif isinstance(o, list):
        for i, v in enumerate(o): yield from walk(v, f"{path}[{i}]")
    elif isinstance(o, str): yield path, o


def selftest():
    page = ('<script type="application/ld+json">{"@graph":[{"@type":"WebPage","mainEntity":{"@id":"https://trustmrr.com/startup/x#organization"}},{"@id":"https://trustmrr.com/startup/x#organization","additionalProperty":[{"@type":"PropertyValue","name":"Current MRR","value":483949.67},'
            '{"@type":"PropertyValue","name":"Verified revenue, all time","value":2155492},{"@type":"PropertyValue","name":"Current customers/subscriptions","value":14229}]},'
            '{"@type":"ItemList","itemListElement":[{"item":{"@id":"https://trustmrr.com/startup/other#organization","additionalProperty":[{"@type":"PropertyValue","name":"Current MRR","value":5}]}}]}]}</script>'
            '<span>Last updated:<!-- --> <!-- -->Nov 28, 2026, 02:22 AM</span>')
    T = parse(page, "x")                                                    # ignores the other startup's MRR
    assert T == {"mrr": 483950, "all_time": 2155492, "subs": 14229, "date": "Nov 28 2026"}, T
    try: parse(page.replace("Last updated", "Synced"), "x"); assert False, "should refuse a page with no sync date"
    except ValueError: pass
    try: parse("<html></html>", "x"); assert False, "should refuse an unparseable page"
    except ValueError: pass
    src = "https://trustmrr.com/startup/x"
    S = {"numbers": [{"k": "MRR", "v": "$1", "label": "Verified", "date": "Nov 1 2026", "source": src},
                     {"k": "Revenue in Oct 2026", "v": "$5", "label": "Verified", "date": "Nov 1 2026", "source": src}],
         "headline": {"k": "MRR", "value": 1, "label": "Verified", "date": "Nov 1 2026", "source": src},
         "series": {"points": [["2026-10", 1, "Verified", "TrustMRR"]], "point_dates": {"2026-10": "Oct 3 2026"}}}
    import tempfile
    text = json.dumps(S, ensure_ascii=False).replace("], ", "],\n ")              # hand-style layout
    frags, _ = update(S, T, "x")
    with tempfile.TemporaryDirectory() as d:
        f = os.path.join(d, "s.json")
        assert save(f, text, S, frags) == "patched" and json.load(open(f, encoding="utf-8")) == S
    assert S["numbers"][0]["v"] == "$483,950" and S["numbers"][0]["date"] == "Nov 28 2026"
    assert S["numbers"][1]["v"] == "$5"                                       # calendar-month number untouched
    assert S["headline"]["value"] == 483950
    assert S["series"]["points"] == [["2026-10", 1, "Verified", "TrustMRR"], ["2026-11", 483950, "Verified", "TrustMRR"]]
    print("selftest ok")


if __name__ == "__main__":
    if "--selftest" in sys.argv: selftest(); sys.exit(0)
    sys.exit(main(sys.argv[1:]))
