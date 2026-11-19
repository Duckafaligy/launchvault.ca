# Publishing a story

One story = one file: `design/data/stories/<slug>.json` (format: `design/data/stories/SCHEMA.md`).

```
python publish_story.py <slug>
```

That one command:
1. validates the file (required fields; every number, note, move, fact check and source has a label, a date and a source). Bad data stops it with a list of problems and nothing is published.
2. rebuilds everything from the JSON (`build_app.py`, which then runs `build.py`):
   - the app reader `/app/story/<slug>/` (Postiz also keeps `/app/postiz/`)
   - the public post `/blog/<slug>/`, with the same chart and labels and a CTA into the app
   - the Library entry, the homepage blog cards and the blog index (newest first)
   - the cover `assets/covers/<slug>.png` + `.webp` (rendered once, kept after that) and its og:image
3. upserts the story into Supabase `public.stories` when `SUPABASE_SERVICE_ROLE_KEY` is set in the environment (never put it in a file). Without it the upsert is skipped with a warning; the site still builds. Pages never need Supabase to render.

Companies in `design/data/stories.json` without a story file stay "Coming soon" automatically.

`python build_app.py` rebuilds everything without publishing anything new.

## What the build needs
- Python 3.10+ with Pillow (covers' WebP copy).
- Node + playwright-core + a Chromium for covers. Defaults are this PC's paths; elsewhere set `LV_PLAYWRIGHT` (path to playwright-core) and `LV_CHROME` (Chromium binary). A missing renderer stops the publish (no story ships without its cover).

## Accounts (built, switched OFF)
Everything is in `assets/auth.js`, in one place:
```
const LV_CLERK_PK = "";      // paste the Clerk publishable key (pk_...). Never a secret key.
const LV_AUTH = false;       // true = sign-in on (Clerk on /welcome/, account email + Sign out, Supabase sync)
const LV_GATE = false;       // true = signed-out visitors are sent to /welcome/
```
To turn it on:
1. Install Clerk on the Vercel project (Vercel Marketplace). In the Clerk dashboard turn on the methods you want: Google, GitHub, Apple, Discord, Email code. The /welcome/ page only shows buttons for methods that are switched on.
2. In Clerk, add these redirect URLs: `https://launchvault-site.vercel.app/welcome/callback/`, `https://launchvault-site.vercel.app/app/`, `https://launchvault-site.vercel.app/app/start/`.
3. Paste the `pk_...` key into `LV_CLERK_PK`, set `LV_AUTH = true`. Set `LV_GATE = true` only when the app should need an account.
4. Supabase: Authentication → Third-party auth → add Clerk with the Clerk domain (the Frontend API host, e.g. `xxxx.clerk.accounts.dev`). Then the app's `assets/supabase.js` syncs ticks, read %, quiz and profile (email, age range) for signed-in users, and merges this-device progress up on first sign-in. Under 13 never writes anything.
5. CSP (`vercel.json`) already allows `*.clerk.accounts.dev`, `clerk-telemetry.com`, `img.clerk.com`, Cloudflare Turnstile and the Supabase host. A Clerk production instance on a custom domain needs that domain (e.g. `clerk.yourdomain.com`) added to `script-src` and `connect-src`.
