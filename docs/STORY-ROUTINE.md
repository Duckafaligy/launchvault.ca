# Scheduled story routine

Two jobs for a scheduled Claude routine, working in the LaunchVault repo's `site/` folder. Paste the prompt for the job you want. The routine never publishes a new story by itself: the owner reviews every draft.

Format and rules: `docs/STORY-FORMAT.md`. Tools: `scripts/validate_story.py`, `scripts/refresh_numbers.py`.

---

## Job A: refresh numbers (daily)

```
You maintain LaunchVault's story data in site/data/stories/*.json. Today, refresh the Verified TrustMRR numbers.

1. cd site
2. python scripts/refresh_numbers.py
   Read the diff. It requests each TrustMRR page once. A story it "could not read reliably" (no JSON-LD, or no
   "Last updated" Stripe sync date) is left alone: list it in your report, do not guess its numbers.
3. If the diff looks sane (no value off by more than ~50% without a reason you can see on the page), run
   python scripts/refresh_numbers.py --write
4. For every "prose still quotes an old value" line: if the sentence states the CURRENT number (a headline, hero,
   title, a "today" result or move), replace the old number with the new one and its new date, exactly as written in
   numbers[]. If the sentence is a dated historical statement ("... on Nov 19 2026"), leave it. Never add new claims.
5. python scripts/validate_story.py all     (must print ok for every story)
6. Commit only the changed data/stories/*.json files on a branch named routine/numbers-YYYY-MM-DD, push the branch,
   and open a pull request titled "Refresh TrustMRR numbers YYYY-MM-DD" listing old -> new per story.
   Do not merge, do not push to main, do not run publish_story.py or any build script, do not deploy.
7. Report: stories updated, stories skipped and why, prose you changed.
```

## Job B: draft a new story (weekly, or when asked)

```
You write LaunchVault founder stories as JSON drafts for the owner to review. Follow site/docs/STORY-FORMAT.md exactly.

Pick: a company in site/data/stories.json with no site/data/stories/<slug>.json and no draft in
site/data/stories/drafts/, preferring the one with the highest Verified MRR. (Or the company the owner named.)

1. Research (sources first, writing second). Save notes in your scratch space, not in the repo.
   - TrustMRR: https://trustmrr.com/startup/<id> and its .md profile. MRR, all-time revenue, subscriptions,
     founded date, the monthly revenue series. Label Verified, date = the page's "Last updated" date.
   - The company site today (Live) and Wayback captures (https://web.archive.org/cdx/search/cdx?url=<domain>&output=json),
     one request at a time: first homepage headline, pricing then and now (label Wayback, date = capture date).
   - Founder interviews and posts: YouTube (python -m yt_dlp "ytsearch10:<company> founder" --flat-playlist --print
     "%(id)s|%(title)s|%(channel)s|%(duration_string)s"), transcripts (youtube-transcript-api), Starter Story,
     podcasts, the founder's own blog or X posts. Everything they say about themselves is Claimed, with its date.
   - When two sources disagree, keep both and write a fact_check labelled "Sources differ".
2. Write site/data/stories/drafts/<slug>.json with "status": "draft":
   all required fields, 4-6 phases (each with title, dek, story, lesson, source_ids; receipts/results/steal/videos
   only when you have the real thing), 4-8 moves, 2-4 fact_checks, 6 checklist items, every source in sources[],
   hero, videos (titles/durations checked with yt-dlp), social (only if you found how they post), fit (3 questions).
   Receipt images: only real captures you made of the real page (TrustMRR, star-history, Wayback, the live site),
   saved in site/assets/receipts/<slug>/. If you can't capture a page, leave that receipt out.
3. python scripts/validate_story.py <slug> --links
   Fix every FAIL. "unreachable, check again later" lines on web.archive.org are rate limits: wait and re-run once.
4. Do not move the file out of drafts/, do not set status ready, do not run publish_story.py or any build, do not
   push to main. Commit only the draft + its receipt images on a branch named routine/draft-<slug>, push it and open
   a pull request "Draft story: <Company>" for the owner.
5. Report: the slug, the headline number with its label and date, every Claimed / Sources differ / Couldn't verify
   item, and anything you could not find.

NEVER:
- invent or "tidy up" a quote, a number, a date, a video title or a screenshot. A quote is copied word for word from
  a source you opened, with that source and its date. If unsure, paraphrase and label it Claimed.
- name a founder in LaunchVault's own copy (title, dek, hero, story, lesson, why, steal, social, fit, moves,
  checklist). Write "the founder". The only exception is the credited founder_photo caption. No ages.
- leave a number without a label from the allowed set (Verified, Live, Wayback, Claimed, Sources differ,
  Couldn't verify, Estimate), a date and a source.
- use Similarweb data, stock or AI-generated images, or mock-ups as receipts.
- read or print .secrets/, env.txt or any .env* file, or put a key in a file.
- edit build_*.py, publish_story.py, assets/newapp/* or any page template.
```

## Owner checklist for a draft

1. Read the draft PR. Open every receipt and the TrustMRR page.
2. `python scripts/validate_story.py <slug> --links`
3. Move `data/stories/drafts/<slug>.json` to `data/stories/<slug>.json`, set `"status": "ready"` and `"published"` to the go-live day.
4. `python publish_story.py <slug>`
