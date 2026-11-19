"""Publish one story: validate it, rebuild everything, upsert it to Supabase, print a summary.

    python publish_story.py <slug>

Non-interactive (safe for a scheduled job). Exits non-zero and prints every problem when the story file is bad;
a story with any fact missing its label, date or source is never published.
Supabase: needs SUPABASE_SERVICE_ROLE_KEY in the environment (never in a file, never printed). Without it the upsert is
skipped with a warning and the site still builds. Supabase is never needed to render a page.
"""
import json, os, sys, urllib.request, urllib.error
ROOT = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, ROOT)
import build_app as B

SUPABASE_URL = "https://azriqynpnbltvxucwmpo.supabase.co"

def fail(msg):
    print("PUBLISH FAILED: " + msg, file=sys.stderr); sys.exit(1)

def upsert(S, legacy):
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not key:
        print("WARNING: SUPABASE_SERVICE_ROLE_KEY is not set, so the story was NOT upserted to Supabase. The site build is fine.")
        return False
    row = {"slug": S["slug"], "name": S["name"], "category": S["category"] if S["category"] in ("AI tool", "Mobile app", "Service", "Open source") else "Open source",
           "status": "ready", "published": S["published"], "summary": legacy or {}, "breakdown": S}
    req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/stories?on_conflict=slug", data=json.dumps(row).encode(), method="POST",
                                 headers={"apikey": key, "Authorization": "Bearer " + key, "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates,return=minimal"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r: return r.status in (200, 201, 204)
    except urllib.error.HTTPError as e:
        fail(f"Supabase upsert returned {e.code}: {e.read()[:300].decode('utf-8', 'replace')}")
    except Exception as e:
        fail(f"Supabase upsert failed: {e}")

def main():
    if len(sys.argv) != 2: fail("usage: python publish_story.py <slug>")
    slug = sys.argv[1]
    path = os.path.join(B.DATA, "stories", slug + ".json")
    if not os.path.exists(path): fail(f"no story file at design/data/stories/{slug}.json")
    try: S = B.normalize(json.load(open(path, encoding="utf-8")))
    except json.JSONDecodeError as e: fail(f"{slug}.json is not valid JSON: {e}")
    errs = B.validate(S, path)
    if errs: fail(f"{slug}.json has {len(errs)} problem(s):\n  - " + "\n  - ".join(errs))
    ready, E = B.main()   # rebuilds the app, the blog posts and covers, the cards, then the public site
    legacy = next((s for s in json.load(open(os.path.join(B.DATA, "stories.json"), encoding="utf-8"))["stories"] if s.get("slug") == slug), None)
    up = upsert(S, legacy)
    print(f"""PUBLISHED {S['name']} ({slug})
  app reader   /app/story/{slug}/
  blog post    /blog/{slug}/
  cover        /assets/covers/{slug}.png
  numbers      {len(S['numbers'])} · phases {len(S['phases'])} · moves {len(S['moves'])} · fact checks {len(S['fact_checks'])} · sources {len(S['sources'])}
  supabase     {'upserted' if up else 'skipped'}
  library      {len(E)} stories ({len(ready)} ready)""")

if __name__ == "__main__":
    main()
