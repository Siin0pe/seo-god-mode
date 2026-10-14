---
description: Connect SEO God Mode to this site in one go (Search Console, GA4, sitemap, brand, market), then show where it stands
argument-hint: "[https://your-site.com]"
---

Set up SEO God Mode for the site in this project. Reply in the user's language. Keep it short and friendly: the user should feel this took two minutes.

Site given by the user: `$ARGUMENTS`

## 1. Find the site

If `$ARGUMENTS` is empty, look for it yourself before asking: an existing `.seo/config.json`, the `site`/`url`/`homepage` field of the framework config or `package.json`, a `CNAME` file, the canonical URL in the built HTML. Ask only if nothing gives a canonical origin (`https://…`).

## 2. Run the setup

From the project root:

```
node "${CLAUDE_PLUGIN_ROOT}/skills/seo/scripts/setup.mjs" --site <origin>
```

It finds the Google service account key, picks the Search Console and GA4 properties that cover the site, the sitemap and the main market, writes `.seo/` and runs `doctor`. Re-running it is safe: it only fills empty fields.

## 3. Unblock what it could not do

Exit code 3 means something is left under "To do". Walk the user through each item, one at a time, with the exact links the script printed:

- **No service account key**: the user creates it in Google Cloud (it is their credential: never ask them to paste the key into the chat, only the file path). Then re-run with `--sa <path>`.
- **Search Console or GA4 not shared**: give them the service account email to add (Search Console: Restricted; GA4: Viewer). Then re-run.

Anything optional (DataForSEO, PageSpeed key, Bing, IndexNow, crawler visits through Cloudflare or log files, Google Business Profile) is mentioned once at the end, not pushed: the script lists it under "Optional, when you want it" with the exact step for this site's host.

## 4. Fill what only a human knows

Using the "Top queries" table the script printed (and the site's own pages), propose, in one message, values for:

- `brand`: a regex of the brand and its typos seen in the queries (e.g. `acme|akme|acmee`);
- `brandName`: the display name;
- `classes`: one or two query families worth tracking apart (e.g. `{"pricing": "price|cost|cheap"}`);
- `money`: 3 to 10 keywords that bring business, not just traffic;
- `competitors`: the sites that show up on those keywords;
- `keyEvents`: the GA4 events that mean a conversion, if GA4 is connected.

Write them into `.seo/config.json` once the user agrees (or adjusts). Do not invent search volumes: without DataForSEO, say volumes are unknown.

## 5. First look

Run `doctor`, then the "where are we" sequence from the `seo` skill (index → audit → quick-wins → links → cwv) and finish with a short verdict plus at most 3 actions. End with the commands they will use most: `/seo-god-mode:seo weekly`, `drop`, `quick-wins`, `index`, and offer to put the Monday review on autopilot with `/seo-god-mode:schedule`.
