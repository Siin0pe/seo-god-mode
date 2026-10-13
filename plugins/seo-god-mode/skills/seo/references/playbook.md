# Playbook: the order of work

The order matters more than any single tactic: each step only works if the previous one exists.

1. **Measure** (connect Search Console, GA4, CWV; baseline the weekly report).
2. **Fix what exists** (technical audit, indexing, cut / repoint / regroup).
3. **Pick the money** (commercial keywords and patterns the site can win).
4. **Build pages better than the top 3** (one reference page per pattern by hand, then a template and a process file, then a steady cadence).
5. **Earn authority** (free links first, paid last, never unqualified paid).
6. **Get named by others** (GEO: third-party lists, communities, fan-out queries), from month three.
7. **Run it every week**, never faster than the data can show.

## 1. Measure

Without Search Console you are guessing. Baseline: clicks and impressions by query class (brand / product family / generic), top pages, countries, devices; index coverage; CWV field data. Write down the date of every change from now on (`.seo/log.md`).

Scoreboard: clicks on business queries and conversions, not DR/DA or total impressions. Third-party authority scores are estimates; Search Console is the referee.

## 2. Fix what exists (fastest traffic)

- Technical blockers first: `audit.mjs` critical items, `index-status.mjs` (sitemap URLs not indexed, canonical conflicts).
- **Cut**: pages with zero clicks and negligible impressions over 90 days, older than 90 days → merge/redirect or rewrite (owner decides).
- **Repoint**: pages that get impressions for a different query than they target → rewrite H1, title, meta, first 100 words around Google's query, and make the body answer it.
- **Regroup**: hubs per topic, siblings linked to each other, every page reachable from the home page within a few clicks, 5+ contextual in-links to anything that matters.
- **Striking distance**: `quick-wins.mjs` (positions 4-20 with impressions): improve content depth for the query, title, internal links with the query as anchor.

## 3. Pick the money

- Commercial intent first ("card in hand"): alternatives, comparisons, "[service] [city]", "[product type] [attribute]", "[tool] for [use case]". Low volume is fine when every searcher is buying.
- Read intent from the SERP, not from the words.
- Patterns over single keywords: one template, dozens of rows.
- Winnable SERPs: thin pages, forums and small sites in the top 5 = winnable; big brands with deep link profiles = later. Go narrow first on a young site.
- A brand-new domain publishing hundreds of programmatic pages with no brand searches and no links looks like every generated site: it may never rank. Earn a little trust first (Part 5) and keep cadence modest.

## 4. Build pages that deserve to rank

- One keyword, one page; check ownership in Search Console before creating anything.
- Secondary keywords = what the #1 result also ranks top 5 for.
- Answer the searcher's questions in the order the SERP answers them; then add the original element (tool, data, table, media, quiz). No original element, no page.
- Title is the strongest on-page signal; meta description sells the click.
- Structured data matching what is visible; one H1; images with dimensions and alt text.
- Template + process file: rebuild one good page as the template; write the site's process as a short file read before every page (template, 5 internal links, hreflang pair, schema, sitemap, indexing request). The project's `.seo/standards.md` is that file.
- Gate every publish (`ship-gate.mjs`); duplicating a page into a pattern is exactly when the one original element silently disappears.
- Cadence: steady (1-4 pages a week), never bursts; ≤ 1 page/day on a new site. A person reads every page before it goes live.
- Multilingual: subdirectories on a generic TLD, correct hreflang and lang, a real translation per market (see commands.md#multilingual).

## 5. Earn authority

Every authority score is an estimate. A perfect page on a weak domain still ranks 40th; new domains get little trust for roughly six months.
Tiers, cheapest and safest first:
1. Claim what you already earned: unlinked mentions, links pointing to dead pages you can replace.
2. Ask for links nobody sells: sites ranking where you want to be, lists you are missing from (recent, ranking, already listing a competitor), sites linking to several competitors.
3. Trade value: your own rankings and listicles (honest, competitors included) once they rank; a few swaps between businesses that belong together.
4. Be citable: your own data, free tools, a dated benchmark; posts on platforms that rank (YouTube, Reddit, LinkedIn articles, Medium); one strong review profile; events and press.
5. Paid last: qualified `rel="sponsored"` by policy, which means no ranking credit; if bought anyway, judge the page's real traffic, not the domain score.
Profile shape matters: natural anchors (brand, URL, "here") from outside, mixed TLDs, some nofollow. Match the SERP: if the top 3 have a handful of links each, don't build twenty in a month. Expect a large share of links to disappear over a year.

## 6. Get named (GEO)

See `geo.md`. In short: assistants search the web with short fan-out queries ("best X year", "X review", "X alternative") and cite pages that rank for them, especially third-party lists and communities. Be on those pages; keep your own facts current; measure by hand monthly.

**Occupy the SERP.** On a money query your domain gets one or two listings at most, and no amount of SEO buys a third. Your brand can take more: one video per keyword (YouTube ranks inside Google; title shape for reviews: "{Tool} Review {Year}: Features, Pricing & Alternatives"; a 200+ word description answering the query in its first two lines), three Shorts per video for three queries (reused on TikTok with captions written for TikTok search), a LinkedIn or X post whose first line is the exact query, a disclosed comment in the thread you will never outrank, a place in other people's lists. `serp-mix.mjs` ranks queries by how many of these open slots the first page already shows: prioritise those. Social networks: the niche picks them (software: X, YouTube, GitHub, Reddit; B2B services: LinkedIn; consumer: Instagram, TikTok), three or four at most. Wikipedia: never ask; build enough presence that someone else decides you belong. A video that reads as an ad fails: someone searching a competitor's name wants a verdict, including where the competitor wins.

## 7. The loop

- **Monday (≈10 minutes when healthy):** `weekly.mjs`, read it, 3 actions max. Do not touch pages changed in the last 60 days.
- **First Monday of the month:** GEO check (`geo.mjs`), index coverage, prune review, CWV.
- **Waits:** a dip after a change is normal, give it up to two months. Before buying links, give a good page three months. A new domain: six months before generic traffic feels like it works, then new pages start ranking quickly on arrival: that is the moment to raise cadence.
- **Agent rules:** written before the first task (allow / approve / block, see SKILL.md) and grown from every rejection in `.seo/standards.md`.

## Local businesses

The map pack decides; see commands.md#local. Relevance (categories, services, content) and authority (links, reviews) are the levers; proximity is not.
