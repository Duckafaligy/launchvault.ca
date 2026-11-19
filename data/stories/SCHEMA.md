# Story file format (one JSON file per story: `design/data/stories/<slug>.json`)

Each story is one file. The site generator turns it into:
- the app reader page at `/app/story/<slug>/`
- a public blog post at `/blog/<slug>/`
- a Library row and card
- the homepage and blog index entries

A scheduled job publishes a new story by adding one file here and pushing. Nothing else needs to change.

## Rules (non-negotiable)
- **Every fact needs a source.** Each one carries a `label` (Verified / Live / Wayback / Claimed / Sources differ / Couldn't verify / Estimate), a `date` and a `source` URL.
- **Never invent.** If something isn't public, write `"Not public"`, or leave the field out.
- **Revenue numbers** come from TrustMRR, with the label Verified and their sync date. Copy them exactly from `design/data/stories.json` when the company is listed there.
- **Founders' own words** are Claimed, with a link to the interview or post and its date.
- **No founder names, faces or ages** on the site. Write "the founder" or "the team".
- **Write for 15–20 year olds:** short sentences, no jargon (explain MRR once), no hype. Use "breakdown", never "debunk".
- **No Similarweb data.**

## Fields
```json
{
  "slug": "rezi",
  "name": "Rezi",
  "category": "AI tool | Mobile app | Service",
  "what": "One plain sentence: what it does and for whom.",
  "logo": "/assets/logos/rezi.png",
  "site": "https://www.rezi.ai",
  "published": "2026-11-19",
  "read_min": 8,
  "title": "Outcome + time + how, e.g. 'Rezi reached $234K MRR from a resume template posted on Reddit'",
  "dek": "One or two sentences that set up the story.",
  "pattern": "Give it away free, charge for the easy version | Start with a problem someone close to you has | Sell a service before you build an app | Ask for money early | Ride a wave | Build in public | other short pattern",
  "numbers": [
    {"k": "MRR", "v": "$234,707", "label": "Verified", "date": "Nov 18 2026", "source": "https://trustmrr.com/startup/rezi"}
  ],
  "series": {"what": "Revenue each month", "label": "Verified", "source": "https://trustmrr.com/startup/rezi",
             "points": [["Dec 2025", 200000]]},
  "facts": {
    "cost_to_start": {"text": "Not public", "label": null},
    "first_revenue": {"text": "...", "label": "Claimed", "date": "...", "source": "..."},
    "first_customers": {"text": "...", "label": "Claimed", "date": "...", "source": "..."},
    "team": {"text": "...", "label": "Verified", "date": "...", "source": "..."}
  },
  "phases": [
    {"name": "Short phase name", "when": "2015 to 2016",
     "story": "2–4 short sentences about what happened.",
     "number": {"v": "...", "label": "Claimed", "date": "...", "source": "..."},
     "lesson": "One sentence a teen can use."}
  ],
  "moves": [{"when": "2015", "text": "Posted a resume template on Reddit", "label": "Claimed", "source": "..."}],
  "fact_checks": [
    {"claim": "What someone said", "who": "Founder, Starter Story interview", "date": "...", "source": "...",
     "found": "What the verified numbers or archives show", "label": "Sources differ | Verified | Claimed | Couldn't verify"}
  ],
  "wayback": [{"date": "Jul 3 2024", "headline": "exact archived homepage headline", "sub": "...", "prices": "...", "source": "https://web.archive.org/web/..."}],
  "checklist": ["6 concrete things a 15–20 year old could do this week, drawn from this story"],
  "sources": [{"name": "TrustMRR: Rezi", "url": "...", "what": "MRR, revenue, monthly series", "date": "Nov 18 2026", "label": "Verified"}]
}
```
- Aim for 4–6 `phases`, 4–8 `moves`, 2–4 `fact_checks` and 6 `checklist` items.
- `wayback` is optional. Fill it in when real captures exist.

## links (optional)

```json
"links": {"site": "https://...", "x": "https://x.com/...", "linkedin": "https://www.linkedin.com/company/...", "youtube": "https://www.youtube.com/@...",
          "instagram": "...", "tiktok": "...", "github": "...", "producthunt": "https://www.producthunt.com/products/...", "discord": "https://discord.gg/...",
          "other": [{"name": "Reddit", "url": "https://..."}]}
```
- Only official company accounts that the company's own website links to (footer, header, or its Organization `sameAs` data). Never a founder's or employee's personal account, and never a single post or video.
- Every URL is https and must load (HTTP 200/3xx; a 403/429/999 bot wall from X, LinkedIn or Instagram is fine if the site links that exact URL).
- The build rejects a link that isn't https or isn't on the platform's own domain. Leave a platform out rather than guess.
- Shown as "Visit <name>" plus icon buttons in the app reader header and the blog post.
