"""Check story JSON files against docs/STORY-FORMAT.md.

    python scripts/validate_story.py <slug|path|all> [--links]
    python scripts/validate_story.py --selftest

Runs the build's own checks (build_app.validate: required fields, label + date + source on every
number, move, fact check and source) and then the story-course fields (hero, videos, social, fit,
per-phase title/dek/receipts/results/steal/videos/source_ids), local /assets/ paths, and that our own
copy never names the founder. --links also requests every URL (2xx/3xx = ok).
Drafts live in data/stories/drafts/<slug>.json (never built) and are found by slug too.
Exit code 0 = all good, 1 = problems (each one printed).
"""
import json, os, re, sys, glob, time, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, SITE)
STORIES = os.path.join(SITE, "data", "stories")
DRAFTS = os.path.join(STORIES, "drafts")
LABELS = ["Verified", "Live", "Wayback", "Claimed", "Sources differ", "Couldn't verify", "Estimate"]
YT_ID = re.compile(r"[A-Za-z0-9_-]{11}")
DURATION = re.compile(r"(\d{1,2}:)?\d{1,2}:\d{2}")
BOT_WALLS = ("x.com", "twitter.com", "linkedin.com", "instagram.com", "tiktok.com", "reddit.com", "producthunt.com", "g2.com")


def fact_errs(f, where):
    """A number-bearing item needs a label from the allowed set, a date and a source (or url)."""
    e = []
    if f.get("label") not in LABELS: e.append(f"{where}: label must be one of {LABELS} (got {f.get('label')!r})")
    if not f.get("date"): e.append(f"{where}: missing date")
    if not (f.get("source") or f.get("url")): e.append(f"{where}: missing source")
    return e


def has_digit(s): return isinstance(s, str) and bool(re.search(r"\d", s))


def walk_strings(o, path=""):
    if isinstance(o, dict):
        for k, v in o.items(): yield from walk_strings(v, f"{path}.{k}" if path else k)
    elif isinstance(o, list):
        for i, v in enumerate(o): yield from walk_strings(v, f"{path}[{i}]")
    elif isinstance(o, str): yield path, o


def our_copy(S):
    """Strings LaunchVault writes itself (third-party titles, source names and photo credits excluded)."""
    out = [("title", S.get("title")), ("dek", S.get("dek")), ("what", S.get("what")), ("pattern", S.get("pattern"))]
    out += [(f"hero.{p}", s) for p, s in walk_strings(S.get("hero") or {})]
    for i, ph in enumerate(S.get("phases") or []):
        for k in ("name", "title", "dek", "story", "lesson", "why"): out.append((f"phases[{i}].{k}", ph.get(k)))
        out += [(f"phases[{i}].steal.{p}", s) for p, s in walk_strings(ph.get("steal") or {})]
        out += [(f"phases[{i}].results[{j}].sub", r.get("sub")) for j, r in enumerate(ph.get("results") or [])]
        out += [(f"phases[{i}].receipts[{j}].caption", r.get("caption")) for j, r in enumerate(ph.get("receipts") or [])]
    for i, h in enumerate(S.get("highlights") or []): out += [(f"highlights[{i}].title", h.get("title")), (f"highlights[{i}].text", h.get("text"))]
    for i, m in enumerate(S.get("moves") or []): out += [(f"moves[{i}].text", m.get("text")), (f"moves[{i}].detail", m.get("detail"))]
    for i, c in enumerate(S.get("checklist") or []): out.append((f"checklist[{i}]", c.get("text") if isinstance(c, dict) else c))
    so = S.get("social") or {}
    out += [("social.summary", so.get("summary")), ("social.note", so.get("note"))] + [(f"social.system[{i}].what", x.get("what")) for i, x in enumerate(so.get("system") or [])]
    out += [(f"fit[{i}]", q) for i, q in enumerate(S.get("fit") or [])]
    return [(p, s) for p, s in out if isinstance(s, str)]


def extra(S, root=SITE):
    """Checks for the story-course fields. Returns a list of problems."""
    e = []
    if S.get("status") not in (None, "draft", "ready"): e.append("status must be draft or ready")
    h = S.get("headline")
    if h: e += fact_errs(h, "headline")
    if h and "value" in h and not isinstance(h["value"], (int, float)): e.append("headline.value must be a number (e.g. 28000), not text")
    if not isinstance(S.get("series", {}).get("alt", []), list): e.append("series.alt must be a list of second-source points; put chart descriptions in series.alt_text")
    hero = S.get("hero")
    if hero is not None:
        if not isinstance(hero.get("title"), str) or not hero["title"]: e.append("hero.title: a non-empty string")
        if not isinstance(hero.get("tags"), list) or not all(isinstance(t, str) and t for t in hero["tags"]): e.append("hero.tags: a list of strings")
    vids = S.get("videos") or []
    ids = set()
    for i, v in enumerate(vids):
        w = f"videos[{i}]"
        if not YT_ID.fullmatch(str(v.get("id", ""))): e.append(f"{w}.id: an 11-character YouTube id")
        ids.add(v.get("id"))
        for k in ("title", "channel", "duration"):
            if not v.get(k): e.append(f"{w}: missing {k}")
        if v.get("duration") and not DURATION.fullmatch(v["duration"]): e.append(f"{w}.duration: like 16:12 or 1:05:43")
        if v.get("kind") not in ("interview", "own"): e.append(f"{w}.kind: interview or own")
        if v.get("views") and not v.get("views_date"): e.append(f"{w}: views needs views_date")
    if len(ids) != len(vids): e.append("videos: duplicate id")
    so = S.get("social")
    if so is not None:
        if not so.get("summary"): e.append("social.summary: missing")
        for i, x in enumerate(so.get("system") or []):
            if not x.get("when") or not x.get("what"): e.append(f"social.system[{i}]: needs when and what")
        for i, a in enumerate(so.get("accounts") or []):
            if not a.get("label") or not str(a.get("url", "")).startswith("https://"): e.append(f"social.accounts[{i}]: needs label and an https url")
        if any(has_digit(s) for s in [so.get("note")] + [x.get("what") for x in so.get("system") or []]):
            e += fact_errs(so, "social (has a number)")
    fit = S.get("fit")
    if fit is not None and not (isinstance(fit, list) and len(fit) == 3 and all(isinstance(q, str) and q.strip().endswith("?") for q in fit)):
        e.append("fit: exactly three yes/no questions ending in '?'")
    nsrc = len(S.get("sources") or [])
    for i, ph in enumerate(S.get("phases") or []):
        w = f"phases[{i}]"
        for k in ("title", "dek", "why"):
            if k in ph and not (isinstance(ph[k], str) and ph[k]): e.append(f"{w}.{k}: a non-empty string")
        for j, r in enumerate(ph.get("receipts") or []):
            rw = f"{w}.receipts[{j}]"
            if r.get("kind") not in ("image", "note"): e.append(f"{rw}.kind: image or note")
            if r.get("kind") == "image" and not r.get("src"): e.append(f"{rw}: an image receipt needs src")
            if r.get("kind") == "note" and not r.get("text"): e.append(f"{rw}: a note receipt needs text")
            if not r.get("caption"): e.append(f"{rw}: missing caption")
            e += fact_errs(r, rw)
        for j, r in enumerate(ph.get("results") or []):
            if not r.get("v") or not r.get("sub"): e.append(f"{w}.results[{j}]: needs v and sub")
            e += fact_errs(r, f"{w}.results[{j}]")
        st = ph.get("steal")
        if st is not None and not (st.get("title") and isinstance(st.get("items"), list) and st["items"] and all(isinstance(x, str) and x for x in st["items"])):
            e.append(f"{w}.steal: needs title and a non-empty items list")
        for vid in ph.get("videos") or []:
            if vid not in ids: e.append(f"{w}.videos: {vid!r} is not in the story's videos")
        for sid in ph.get("source_ids") or []:
            if not (isinstance(sid, int) and 0 <= sid < nsrc): e.append(f"{w}.source_ids: {sid!r} is not an index into sources (0..{nsrc - 1})")
    for p, s in walk_strings(S):
        if s.startswith("/assets/") and not os.path.exists(os.path.join(root, s.lstrip("/").split("#")[0].split("?")[0])):
            e.append(f"{p}: file not found {s}")
    name = (S.get("founder_photo") or {}).get("name") or ""
    parts = [x for x in [name] + name.split()[1:] if len(x) > 2]   # full name and surname
    for p, s in our_copy(S):
        for n in parts:
            if re.search(r"\b" + re.escape(n) + r"\b", s): e.append(f"{p}: names the founder ({n}); write 'the founder'")
    return e


def urls(S):
    u = {s for _, s in walk_strings(S) if s.startswith(("http://", "https://")) and "paper.design" not in s}
    u |= {"https://www.youtube.com/watch?v=" + v["id"] for v in S.get("videos") or [] if v.get("id")}
    return sorted(u)


def check_url(u):
    for method in ("HEAD", "GET"):
        try:
            req = urllib.request.Request(u, method=method, headers={"User-Agent": "Mozilla/5.0 (LaunchVault link check)"})
            with urllib.request.urlopen(req, timeout=20) as r: return u, r.status
        except urllib.error.HTTPError as x:
            if method == "GET" or x.code not in (403, 405, 429, 501): return u, x.code
        except Exception as x:
            if method == "GET": return u, f"{type(x).__name__}: {x}"[:120]
    return u, "?"


def host(u): return re.sub(r"^https?://(www\.)?", "", u).split("/")[0].lower()


def check_host(us):
    """One host's URLs one after another, a second apart (web.archive.org refuses bursts)."""
    out = []
    for i, u in enumerate(us):
        if i: time.sleep(1)
        out.append(check_url(u))
    return out


def link_errs(S, warn):
    e, by = [], {}
    for u in urls(S): by.setdefault(host(u), []).append(u)
    with ThreadPoolExecutor(8) as ex:
        for res in ex.map(check_host, by.values()):
            for u, code in res:
                if isinstance(code, int) and 200 <= code < 400: continue
                if code in (403, 429, 999) and host(u).endswith(BOT_WALLS): continue   # bot wall, allowed by SCHEMA
                if isinstance(code, str) and ("refused" in code or "timed out" in code.lower()):
                    warn.append(f"unreachable, check again later: {u}"); continue        # rate limit / outage, not a dead link
                e.append(f"link {code}: {u}")
    return e


def find(arg):
    if arg == "all": return sorted(glob.glob(os.path.join(STORIES, "*.json")))
    if arg.endswith(".json") and os.path.exists(arg): return [arg]
    for d in (STORIES, DRAFTS):
        p = os.path.join(d, arg + ".json")
        if os.path.exists(p): return [p]
    raise SystemExit(f"no story file for {arg!r} in data/stories or data/stories/drafts")


def check(path, links=False, warn=None):
    import build_app as B
    try: S = B.normalize(json.load(open(path, encoding="utf-8")))
    except json.JSONDecodeError as x: return [f"not valid JSON: {x}"]
    e = B.validate(S, path) + extra(S)
    if os.path.dirname(os.path.abspath(path)) == os.path.abspath(DRAFTS) and S.get("status") != "draft": e.append('a file in drafts/ must have "status": "draft"')
    if links: e += link_errs(S, warn if warn is not None else [])
    return e


def selftest():
    assert fact_errs({"label": "Verified", "date": "Nov 27 2026", "source": "https://x"}, "n") == []
    assert len(fact_errs({"label": "Guess", "v": "$1"}, "n")) == 3                     # bad label, no date, no source
    good = {"videos": [{"id": "n7Obxh9-Rc8", "kind": "interview", "title": "t", "channel": "c", "duration": "16:12"}],
            "sources": [{"name": "s"}],
            "phases": [{"title": "T", "dek": "D", "videos": ["n7Obxh9-Rc8"], "source_ids": [0],
                        "results": [{"v": "$1", "sub": "a month", "label": "Claimed", "date": "2025", "source": "s"}],
                        "steal": {"title": "Steal", "items": ["do it"]},
                        "receipts": [{"kind": "note", "text": "x", "caption": "c", "label": "Claimed", "date": "2025", "source": "s"}]}],
            "fit": ["A?", "B?", "C?"], "hero": {"title": "t", "tags": ["a"]}}
    assert extra(good) == [], extra(good)
    bad = json.loads(json.dumps(good))
    bad["phases"][0]["videos"] = ["zzzzzzzzzzz"]; bad["phases"][0]["source_ids"] = [3]
    bad["phases"][0]["results"][0].pop("date"); bad["fit"] = ["A?", "B?"]
    bad["phases"][0]["receipts"][0] = {"kind": "image", "src": "/assets/nope.png", "caption": "c", "label": "Live", "date": "2026", "url": "https://x"}
    msgs = " | ".join(extra(bad))
    for frag in ("not in the story's videos", "not an index into sources", "missing date", "fit:", "file not found"):
        assert frag in msgs, (frag, msgs)
    named = {"founder_photo": {"name": "Ada Lovelace"}, "title": "Lovelace built it", "dek": "The founder built it"}
    assert any("names the founder" in m for m in extra(named))
    assert extra({"social": {"summary": "s", "note": "1 in 30 takes off"}})                  # number without label
    print("selftest ok")


def main(argv):
    if "--selftest" in argv: selftest(); return 0
    args = [a for a in argv if not a.startswith("--")]
    if len(args) != 1: print(__doc__); return 2
    bad = 0
    for p in find(args[0]):
        warn = []
        e = check(p, "--links" in argv, warn)
        name = os.path.relpath(p, STORIES)
        if e:
            bad += 1; print(f"FAIL {name} ({len(e)})"); [print("  - " + x) for x in e]
        else: print(f"ok   {name}")
        for w in warn: print("  ~ " + w)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
