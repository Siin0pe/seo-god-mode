# Procedures

Table of contents: [pattern](#pattern) · [brief](#brief) · [ship](#ship) · [prune decisions](#prune-decisions) · [multilingual](#multilingual) · [outreach](#outreach) · [geo monthly](#geo-monthly) · [local](#local)

---

## pattern

Goal: a list of keywords that bring business, grouped into repeatable page patterns, ordered by what this site can win now.

1. **Seeds.** From the owner (what they sell, to whom, against whom) and from Search Console: `gsc.mjs --dims query --class generic --days 90 --sort impressions --limit 100`. Queries Google already shows the site for are the cheapest signal of fit.
2. **Expand.** `suggest.mjs "<seed>"` for each seed (free, shows the shapes people type). With DataForSEO: `keywords.mjs ideas "<seed>"`, `keywords.mjs ranked <competitor-domain>`, `keywords.mjs gap <you> <competitor>`.
3. **Volumes.** Only from `keywords.mjs volume`, Google Ads Keyword Planner (owner exports it) or Search Console impressions. If none is available, rank by intent and SERP weakness and write "volume unknown" in the column. Never fill a blank volume cell with a plausible number.
4. **Intent from the SERP, not from the words.** `keywords.mjs serp "<kw>"` or a logged-out browser. Definitions, blogs, a definition box → informational. Product, service, category, comparison pages, prices → commercial. Start with commercial ("card in hand"): alternatives, comparisons, "[service] [city]", "[tool] for [use]", "without [constraint]".
5. **Group into patterns.** Same intent, same page type, one word changes ("[A] vs [B]", "[service] [city]", "[competitor] alternative"). A pattern is dozens of pages from one template; you stop picking topics and pick the next row.
6. **Winnability.** For each pattern, look at the top 5: are they big brands with thousands of referring domains, or thin affiliate pages and forums? Can this site, at its current authority, beat them? On a young site go narrow and specific (the suburb, the long-tail comparison) before the head term.
7. **Output.** A table: pattern, example keywords, volume (with source) or "unknown", intent, SERP difficulty reading, page type, priority. Then the next 5 pages to build, in order. Save to the tracker or `.seo/`.

For software, the usual order of page types by intent and ease: alternatives → comparisons → integrations → constraint pages ("without X", "free", "open source", only if true) → pricing → use cases → problems → features you genuinely lead on. Skip "for [company size]" variants unless each says something different.

---

## brief

One page, one primary keyword. The brief is what the writer (you, later) follows, and what the owner approves.

1. **Ownership check.** `gsc.mjs --dims page,query --filter "query~<kw regex>" --days 90`. If a page already gets clicks for it → brief an improvement of that page, not a new page. If a page gets impressions but few clicks → it is somewhere in the top 20: improve it. Nothing → new page.
2. **Secondary keywords.** Take the page ranking first for the keyword and list the other queries that same URL ranks top 5 for (`keywords.mjs ranked <url>` with DataForSEO, otherwise read its title/H2s and use Search Console data from your own similar pages). That set is what Google treats as one page: target all of it with one URL.
3. **SERP read.** Top 3 to 5 results: page type, length, structure, what questions they answer and in which order, freshness, media, interactive elements, schema. The reader's questions, in the order the SERP answers them, become your outline.
4. **The original element.** Write down the one thing this page will have that the others don't: a working tool, your own measurements, a dated table, real photos, a calculator, a quiz that routes the reader. If you can't name one, say so and recommend not publishing yet.
5. **On-page.** Title (the strongest on-page element: lead with the primary keyword, cover a second pattern if it fits, ≤ 60 characters), meta description (sells the click; it barely affects ranking), one H1, H2s from the SERP questions, the primary keyword naturally in the first 100 words, FAQ only if the questions are real, structured data that matches what is visible on the page.
6. **Links.** At least 5 contextual internal links to the new page from related pages (run `internal-links.mjs` after publishing to pick sources), and links out from the page to the hub and siblings.
7. **Standards.** Re-read `.seo/standards.md` and apply it. Output: the brief as a short document, plus the list of pages that will receive links.

---

## ship

Publishing is where agents do damage silently. This is the gate.

1. **Build on the site's template**, never invent a layout. If the project has a content schema or quality checks, satisfy them.
2. **Run the gate.** For a single page: `ship-gate.mjs --before <live url> --after <preview url or built file>`. For a whole build: `ship-gate.mjs --dist <build dir>` (compares every built page with the live one). Exit 1 = something blocking (a form, table, video, FAQ, JSON-LD type disappeared, canonical/robots/hreflang changed, word count fell >30%): stop and show the owner. Exit 3 = warnings (title changed, H2 removed, links dropped): mention them in the PR or message.
3. **Read the diff yourself** for the one original element of the page: is it still there and still working?
4. **Owner approval** for anything live (see Rules of engagement).
5. **After publish:** `ship-gate.mjs --published <url>` (200, indexable, self-canonical, listed in the live sitemap: the sitemap silently stops listing new pages the day an agent publishes outside the CMS), `index-status.mjs --only <path>` and request indexing in the Search Console UI if it is important, IndexNow ping if configured (`indexnow.mjs <url>`), internal links from 5 related pages, a line in `.seo/log.md` with a review date 4 to 8 weeks out.

When duplicating a page into a pattern (city, competitor, product), every variant needs something only that variant can say (local facts, prices, examples, its own data). If the variants differ only by the swapped word, stop: that is a doorway pattern. Measure it: `twins.mjs --pattern "^/<pattern-dir>/"` flags pages sharing 80%+ of their text with a sibling (exit 1) and 60%+ as thin variants. Build page one by hand, take the hour, then duplicate slowly: every weakness multiplies with the pattern.

---

## prune decisions

`prune.mjs` classifies; you recommend; the owner decides.

- Leave alone anything younger than ~90 days of impressions.
- Zero clicks and negligible impressions over 90 days → merge into the closest page that serves the same intent (and 301), or rewrite if the topic matters to the business, or noindex if it must exist for users (legal, account pages).
- Substantial pages (600+ words) are never proposed for deletion by the script; propose improvement or merge.
- Order: cut first (no point optimising a page you will remove), repoint second (`repoint.mjs`: pages with proven demand for a different query), restructure last (hubs per topic, siblings linked to each other).

Repointing a page: rewrite the H1, the title, the meta description and the first 100 words around the query Google already gives it, and check that the body genuinely answers that query. Swapping the H1 while the body answers something else makes the page worse.

---

## multilingual

- Subdirectories on a generic TLD (`/fr/`, `/ja/`), never a ccTLD for a second market.
- `html lang`, reciprocal hreflang including a self-reference and `x-default`, a language switcher that goes to the equivalent URL (not the home page). `audit.mjs` checks reciprocity.
- Translation is adaptation: local query phrasing (check autocomplete in that language with `suggest.mjs --hl xx --gl yy`), local examples, local units and dates. Machine translation without a native read is a business decision for the owner, never a default.
- Pick markets from data: `gsc.mjs --dims country --days 90` and `--dims query --country xxx` show where the site already gets impressions at weak positions.

---

## outreach

You build lists and drafts; the owner (or their tooling) sends. Never send.

Free first, paid last:
1. **Unlinked mentions**: search the brand name in quotes, minus the site's own domain; list pages that mention without linking. Draft a short, friendly request.
2. **Broken links to dead competitors or resources** in the niche: pages linking to a dead page that yours can replace.
3. **Pages already ranking where you want to be** (`keywords.mjs serp`): ask for a link from a page that genuinely complements yours.
4. **Lists you are missing from**: listicles ranking top 20, updated in the last 12 months, that already include a competitor. These also feed AI answers.
5. **Competitors' linkers** (`keywords.mjs backlinks <competitor>`): sites linking to 3 of your competitors already accept the category.
6. **Citable assets**: your own data, a free tool, a dated benchmark. Nobody can copy your numbers.

Output: one table (site, page, why it fits, contact page URL, draft message). Never invent an email address: point to the contact page or leave it blank.

7. **Your own lists, then swaps.** Publish honest listicles of your category (competitors included, never yourself first). Once they rank, others want in: a swap between businesses that belong together is editorial; the test is "would I list them if they offered nothing?". Fifty reciprocal links across a ring of sites is a footprint (link spam policy).
8. **Places you post, not pitch:** YouTube, Reddit, Medium, LinkedIn articles rank on domains you don't own (`serp-mix.mjs` shows which ones rank on your queries). One strong review profile (Trustpilot for SaaS and e-commerce, Google Business Profile for local) beats three weak ones. Events bring press links (to the home page: useful, but they don't push a specific page). Bylines depend on one editor and stop when they leave.

**Sending is the owner's job.** If they run outreach: a separate sending domain, never the main one, warmed up for about 3 weeks; one email and two follow-ups; about 5 a day, every day, rather than bursts. You can triage replies and draft answers for approval. Most deals die because a yes waited a week.

**Paid last.** Read `references/policies.md` (link spam) first: a compliant paid link carries `rel="sponsored"`, which removes the ranking credit you paid for. If the owner buys anyway, five checks per placement: (1) the site's traffic curve rises over 12 months, (2) its traffic is real and on topic (top pages and keywords near yours), (3) the linking page itself gets visits, not just the domain, (4) the home page is not a wall of "featured articles" across unrelated categories, (5) a very low price means the slot was sold a hundred times.

**Profile shape.** Google reads the shape, not the count. Compare with the SERP: if the top 3 have 2 to 4 referring domains each, twenty new links in a month announces you. Anomalies that make a profile look built: 100% exact-match anchors from outside (real people link with the brand, the URL, "here"), one TLD only, 100% WordPress sites, zero nofollow. With DataForSEO, `keywords.mjs backlinks <domain>` gives the referring domains to check against these. Expect a large share of links (often more than half over a few years) to disappear on their own: price any campaign against what will still exist next year.

---

## geo monthly

First week of the month:
1. `geo.mjs queries` (fan-out set from the config's money keywords and competitors) and `geo.mjs prospects` if DataForSEO is configured.
2. The owner (or you, with a logged-out browser if available) runs 10 real buyer prompts in ChatGPT, Perplexity, Gemini, Google AI Mode. Log each: `geo.mjs log --engine chatgpt --prompt "..." --cited yes|no --sources url1,url2`.
3. `geo.mjs report`: cited share per engine per month, and which domains the engines cite. Those domains are the outreach list.
4. Check every third-party ranking that lists the site still does, and refresh your own rankings with the new year in the title.
5. Once a quarter: `serp-mix.mjs` on the money queries (open slots, subreddits, videos, lists without you).
6. `index-status.mjs`: monthly index coverage.

Unattended (scheduled run): do steps 1, 3 and 6, then write step 2 as a to-do for the owner in `.seo/reports/` (the 10 prompts to run, and the `geo.mjs log` line to record each). Never log a citation nobody checked.

**Reddit and forums, done right.** (1) Write 10 prompts the way a buyer types them at 11pm, not keywords. (2) Run them logged out. (3) Read the sources, not the answer: the threads cited are the targets; if a competitor is in three and you are in none, that is the whole problem. (4) Ask the model which sub-questions it would search first and check their sources too: less contested threads. (5) The owner comments as themselves: who they are in the first line, a real answer including when their product is the wrong choice; one thread every 2 or 3 days; an account warmed up first (some karma, a few days of genuine comments, each subreddit's rules read). Pick subreddits Google already ranks on the site's best keywords (`serp-mix.mjs`), not the biggest ones.

**Ranking swaps.** Being ranked on someone else's site is worth more than ten rankings on yours. Swap with businesses that genuinely belong in each other's lists, refresh yearly, and never rank yourself first on your own site: models have learned to discount it (it can still win classic Google, so test before rewriting a page that brings clients). The ladder beyond swaps: small blogs that publish rankings, guest posts on businesses in the niche, digital PR on niche online media, then a byline on a domain the models trust. A cheap placement is reportedly cited about as long as an expensive media mention: both rotate out within months.

API answers differ from what logged-out users see; a handful of honest manual checks beats a dashboard built on API calls.

---

## local

For businesses that serve a place. The map pack (Google Business Profile) matters more than the website: the three map listings sit above the organic results, and fourth place is invisible. Google ranks them on proximity (fixed), relevance (categories, services, content) and authority (links, reviews).

1. **Measure first.** A rank-map export (a 13x13 grid is common) from the local rank tracker the owner uses, then `rankmap.mjs yours.csv --vs leader1.csv,leader2.csv`: top-3% (share of points in positions 1-3; position 4 is worth zero), strongest and weakest direction, the cheap wins in positions 4-6, and where you stand against the leader. When the Business Profile is connected (`doctor` shows it), add `gbp.mjs performance` (Search vs Maps impressions and the actions that follow: calls, website clicks, directions, against the previous 28 days), `gbp.mjs keywords` (the searches that showed the profile: terms missing from the categories, services and site pages are the gaps to fill in steps 2-4) and `gbp.mjs reviews` (rating, star mix, unanswered reviews to draft replies for). Not connected: say so and work from the rank map; never guess these numbers.
2. **The 30-minute profile audit** (the owner edits the profile; you prepare everything):
   - Categories: up to 10 allowed; aim for 2 to 4 at least, each true. Choose only from Google's real category list pasted by the owner (or read from competitors' profiles): models invent plausible categories that do not exist. If nothing fits, say so.
   - Services: 20 minimum, 30 to 40 in a competitive city, each under the category it belongs to.
   - Description at the full 750 characters, 20+ real photos, every attribute that is true, one post a week.
   - Reviews: ask customers to mention what was done and where ("fixed our water heater the same day in Austin"): the text counts, not only the stars.
3. **The page the profile links to** (often the home page), seven checks: title = primary category + city; H1 = primary category + city; a Maps embed of the profile; secondary categories as H2s; a widget with the Google reviews; the address and the phone character for character as on the profile. Most local home pages are titled "Home": free ground.
4. **The Core 30.** The site mirrors the profile: one home page, one page per category ("drain cleaning Houston"), one per service ("water heater replacement Houston"), about 30 pages for 3-4 categories and 25-30 services. Each level links down from inside a paragraph. Write them in order of real search volume (DataForSEO or Keyword Planner), highest first.
5. **Let the number pick the next page.** 30 days after launch, re-run the rank map for you and the 3-4 businesses that dominate. Below 25% of the leader's top-3%: Google doesn't believe you're the expert yet, build topical pages answering customers' questions. At 50% or more: push outward with pages about the places in your yellow zones (neighbourhoods, landmarks Maps already names), each written about the place itself (housing, common problems, the route the team drives), never a name swap (`twins.mjs` checks).
The owner edits the Business Profile; you prepare the content.
