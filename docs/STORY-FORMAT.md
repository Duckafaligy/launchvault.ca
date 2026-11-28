# Story format

One story = one JSON file. This is the only format doc (`data/stories/SCHEMA.md` points here).

| Where | What happens |
|---|---|
| `data/stories/<slug>.json` | A live story. The build turns it into the app course `/app/story/<slug>/`, the public post `/blog/<slug>/`, the Library card and the home/blog entries. Hidden until its `published` date. |
| `data/stories/drafts/<slug>.json` | A draft, `"status": "draft"`. Never built. The owner reviews it, moves it up one folder and runs `python publish_story.py <slug>`. |

Check a file: `python scripts/validate_story.py <slug>` (add `--links` to load every URL, `all` for every story).
Refresh TrustMRR numbers: `python scripts/refresh_numbers.py [slug] [--write]`.

## Rules (non-negotiable)

1. **Never invent.** No made-up facts, quotes, numbers, dates, screenshots or video titles. Not public = write `"Not public"` or leave the field out.
2. **Every number carries a label, a date and a source.** That covers `numbers`, `headline`, `series` points, phase `number`, `results`, `receipts`, `moves`, `fact_checks`, `facts`, `sources`, and `social` when its text has a number.
3. **Labels** (exact spelling, nothing else):
   | Label | Use it when |
   |---|---|
   | `Verified` | Read from the payment provider by a third party (TrustMRR). Copy the value and the TrustMRR "Last updated" date exactly. |
   | `Live` | Read today from a live page (GitHub stars, App Store rating, the company's site). |
   | `Wayback` | Read from an archived page on web.archive.org. Date = the capture date. |
   | `Claimed` | The founder or company said it (interview, post, homepage). Date = when they said it. |
   | `Sources differ` | Two sources disagree. Say which and show both. |
   | `Couldn't verify` | We looked and couldn't confirm it. Say what we found. |
   | `Estimate` | Our own arithmetic from labelled numbers. Show the inputs. |
4. **Our copy never names founders.** Write "the founder" / "the team" / "he"/"she" and never give ages. Third-party titles (videos, articles) are quoted as published, but trim a founder's name off the end when the design shows a shorter title. The only place a founder is named is the credited `founder_photo` caption. The validator flags the founder's name in our copy.
5. **Write for 15 to 20 year olds.** Short sentences, explain jargon once in brackets, no hype, "breakdown" never "debunk". No Similarweb data.

## How chapters work

**One phase = one chapter = one lesson.** `phases[0]` is Chapter 1 and is always free; each later chapter uses one of the reader's free lessons. Aim for 4 to 6 phases, in time order. The story home shows the chapter count, the first few `moves`, and links to Chapter 1.

A chapter page shows, top to bottom: `title` + `dek` + the main label chip, "What happened" (`story`, paragraphs split by a blank line `\n\n`), "The proof" (`receipts`), "What happened next" (`results`), "Why it matters for you" (`lesson` as the pull quote, then `why`), "Watch it explained" (`videos`), "Steal this" (`steal`), and the chapter's numbered sources (`source_ids`). Any part with no data is dropped, so fill only what you can back up.

## Fields

### Required (the build refuses the file without them)

| Field | Type | Notes |
|---|---|---|
| `slug` | string | lowercase, digits, dashes; must match the file name |
| `name` | string | company name |
| `category` | string | `AI tool`, `Mobile app`, `Service` or `Open source` |
| `what` | string | one plain sentence: what it does and for whom |
| `logo` | path | `/assets/logos/<file>`, must exist |
| `published` | `YYYY-MM-DD` | the story stays hidden until this day |
| `read_min` | number | minutes |
| `title` | string | outcome + time + how. Its number must match `numbers`. |
| `dek` | string | one or two sentences; explain MRR once |
| `pattern` | string | short pattern name, e.g. "Give it away free, charge for the easy version" |
| `numbers` | list | `{"k", "v", "label", "date", "source", "long"?, "note"?}`; first = the headline number |
| `series` | object | `{"what", "label", "source", "points": [["YYYY-MM", number, label?, source?], ...], "point_dates"?, "alt"?, "empty_note"?}`; at least 2 real points |
| `phases` | list | see below |
| `moves` | list | `{"at": "YYYY-MM", "when", "text", "detail"?, "label", "source"}`; 4 to 8 |
| `fact_checks` | list | `{"claim", "found", "label", "who", "date", "source"}`; 2 to 4 |
| `checklist` | list | 6 items `{"id", "text", "from"}` (or strings): things a teen could do this week |
| `sources` | list | `{"name", "url" or null, "what", "date", "label", "logo"?}`. Phase `source_ids` index into this list (0 = first). |

### Optional, older fields

`site`, `tab`, `type_label`, `title_em` (the part of the title to emphasise), `headline` (`{"k", "value", "label", "date", "source"}`), `facts` (`cost_to_start`, `first_revenue`, `first_customers` with a `short` of 60 characters or fewer condensed from its own `text`, `team`), `highlights`, `wayback` (`{"date", "headline", "sub", "prices", "label", "image", "source"}`, real captures only), `wayback_note`, `fact_checks_read`, `links`, `founder_photo`, `status` (`draft` or `ready`).

### Optional, story-course fields (the new design codes against these exact names)

**`hero`** `{"title": str, "tags": [str]}`: the story home headline and its chips. The title's number must match a labelled number (round down, e.g. $482,722 = "$482K").

**`videos`** list, top level. Each `{"id", "title", "channel", "duration", "kind", "views"?, "views_date"?, "thumb"?}`.
- `id`: the 11-character YouTube id. `kind`: `interview` (someone else's interview or breakdown) or `own` (the company's own channel).
- `title` / `channel` / `duration` exactly as YouTube shows them; check with `python -m yt_dlp --skip-download --print "%(title)s|%(duration_string)s|%(channel)s" <url>`.
- `views` needs `views_date`. `thumb`: `/assets/receipts/<slug>/yt-<id>.jpg` (YouTube's `hqdefault.jpg`, 480x360).

**`social`** `{"summary", "system": [{"when", "what"}], "note", "accounts": [{"label", "url"}], "label", "date", "source"}`: how they post. `accounts` are official company accounts the company's own site links to (https). Add `label`/`date`/`source` whenever `note` or `system` has a number.

**`fit`** `[str, str, str]`: exactly three yes/no questions ("Is this story a good reference for your project?"), each ending in `?`.

**Per phase** (in addition to the required `name`, `when`, `story`, `lesson` and the optional `number`, `moves`, `turn`):

| Field | Type | Notes |
|---|---|---|
| `title` | string | chapter headline, `<name>: <the point>` |
| `dek` | string | 1 to 2 sentences, written only from facts already in the file |
| `why` | string | optional paragraph after the lesson quote |
| `receipts` | list | `{"kind": "image" \| "note", "src", "caption", "label", "date", "url"?, "source"?, "text"?, "platform"?}`. `image` needs `src`; `note` needs `text` (a short paraphrase of a cited claim, never an invented quote). Each needs `label`, `date`, and `url` or `source`. |
| `results` | list | `{"v", "sub", "label", "date", "source"}`, e.g. `"★ 3K → 14K"`, `"GitHub stars, 3 months"` |
| `steal` | object | `{"title", "items": [str]}`: a short checklist built from what they did |
| `videos` | list | ids from the top-level `videos` |
| `source_ids` | list | indexes into `sources`, in footnote order (1, 2, 3 on the page) |

## Images and receipts

- Receipts live in `/assets/receipts/<slug>/`. Every `/assets/...` path in the file must exist (the validator checks).
- A receipt is a real capture: a screenshot of the actual page, a star-history chart, a TrustMRR page, a Wayback capture. Never a mock-up, never generated, never edited beyond cropping.
- PNG for screenshots, at most 1280 px wide, saved with `optimize=True` (lossless; keep text sharp). JPG for video thumbs.
- Name them for what they show: `trustmrr.png`, `stars.png`, `wayback-2024.png`, `<site>-now.png`, `yt-<id>.jpg`.
- `date` on an image receipt = the capture date (or the archive date for Wayback). The caption says what it is, not what to think.
- Founder photo: real, published, credited (see `founder_photo` below), `/assets/founders/<slug>.jpg`, square, at most 480 px, ~60 KB.

## `links` (optional)

```json
"links": {"site": "https://...", "x": "https://x.com/...", "linkedin": "https://www.linkedin.com/company/...", "youtube": "https://www.youtube.com/@...",
          "instagram": "...", "tiktok": "...", "github": "...", "producthunt": "https://www.producthunt.com/products/...", "discord": "https://discord.gg/...",
          "other": [{"name": "Reddit", "url": "https://..."}]}
```
Only official company accounts the company's own site links to. Every URL is https on the platform's own domain and loads (a 403/429/999 bot wall from X, LinkedIn, Instagram, TikTok, Reddit, Product Hunt or G2 is fine).

## `founder_photo` (optional)

```json
"founder_photo": {"src": "/assets/founders/rezi.jpg", "w": 400, "h": 400, "name": "...", "role": "founder of Rezi", "alt": "...",
                  "author": "Surname, I. [@handle]", "date": "n.d.", "title": "Profile photo", "publisher": "X",
                  "url": "https://x.com/...", "image_url": "https://pbs.twimg.com/...", "found_via": "https://trustmrr.com/founder/...",
                  "retrieved": "November 20, 2026", "license": "CC BY-SA 4.0 | Not openly licensed: ..."}
```
Preference: openly licensed (Wikimedia Commons) > the company's About page or press kit > the founder's own public profile image. Only when the source names that person. None found = leave it out; never a stock image. Builds the APA 7 caption "Figure 1. ...".

## Worked example: Postiz (`data/stories/postiz.json`)

The richest file; copy its shape. Abridged:

```json
{
  "slug": "postiz", "name": "Postiz", "category": "Open source",
  "title": "Postiz: almost two years under $15K a month, then $482K",
  "hero": {"title": "One developer gave his app away, then reached $482K a month",
           "tags": ["Give it away free, charge for the easy version", "Solo", "Open source"]},
  "numbers": [
    {"k": "MRR", "long": "Monthly recurring revenue", "v": "$482,722", "label": "Verified", "date": "Nov 27 2026", "source": "https://trustmrr.com/startup/postiz"},
    {"k": "GitHub stars", "v": "41,810", "label": "Live", "date": "Nov 17 2026", "source": "https://github.com/gitroomhq/postiz-app"}
  ],
  "series": {"what": "Monthly revenue", "label": "Claimed", "source": "...", "points": [["2024-09", 700, "Claimed", "Superframeworks case study"], ["2026-11", 482722, "Verified", "TrustMRR, read from Stripe"]],
             "point_dates": {"2026-11": "Nov 27 2026"}},
  "phases": [
    {"name": "Open source", "when": "Sep 2024 to 2025", "moves": [3],
     "title": "Open source: free gets attention, not revenue",
     "dek": "He gave the code away, ran launch weeks and climbed GitHub. Stars grew fast. The money took more than a year to follow.",
     "story": "In September 2024 he made Postiz open source ...\n\nThen he ran launch weeks ...\n\nReddit users kept asking for a Docker setup ...",
     "number": [{"v": "Revenue went from about $700 a month to $6.5K by July 2025 and $14K by November 2025.", "label": "Claimed", "date": "Nov 2025", "source": "The founder on Dev.to"}],
     "lesson": "Free gets attention, but attention is not revenue. ...",
     "why": "Stars proved people wanted it. They didn't prove people would pay. ...",
     "receipts": [
       {"kind": "image", "src": "/assets/receipts/postiz/stars.png", "caption": "GitHub star history · star-history.com", "label": "Live", "date": "Nov 27 2026", "url": "https://star-history.com/#gitroomhq/postiz-app&Date"},
       {"kind": "note", "src": "", "platform": "Reddit", "text": "Users asked for a Docker setup, so he built one.", "caption": "The founder on Dev.to", "label": "Claimed", "date": "Nov 2025", "source": "The founder on Dev.to"}],
     "results": [{"v": "★ 3K → 14K", "sub": "GitHub stars, 3 months", "label": "Claimed", "date": "Jul 2026", "source": "Superframeworks case study"}],
     "steal": {"title": "Steal this: his launch-week checklist", "items": ["Make the free version easy to install. He added Docker when Reddit asked.", "..."]},
     "videos": ["RPM4ImzcIFc", "Ul2LaZIPqMY"],
     "source_ids": [3, 5, 2]}
  ],
  "videos": [{"id": "RPM4ImzcIFc", "kind": "interview", "title": "How I Built It: $17K/Month Open Source SaaS", "channel": "Starter Story", "duration": "22:52", "thumb": "/assets/receipts/postiz/yt-RPM4ImzcIFc.jpg"}],
  "social": {"summary": "A weekly system on X: ...", "system": [{"when": "Mon", "what": "One useful video"}, {"when": "Tue–Sun", "what": "Clips of it"}, {"when": "Next week", "what": "Same idea, long article"}],
             "note": "Plus daily short videos through creators: about 1 in 30 takes off", "label": "Claimed", "date": "Sep 2026", "source": "Postiz blog",
             "accounts": [{"label": "@getpostiz on X", "url": "https://x.com/getpostiz"}]},
  "fit": ["Could you give a version away for free?", "Are you building mostly on your own?", "Can you keep going for a year if money stays flat?"]
}
```
