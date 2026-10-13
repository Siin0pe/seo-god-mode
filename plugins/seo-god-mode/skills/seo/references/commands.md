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
5. **After publish:** sitemap updated (check it contains the URL), `index-status.mjs --only <path>` and request indexing in the Search Console UI if it is important, IndexNow ping if configured (`indexnow.mjs <url>`), internal links from 5 related pages, a line in `.seo/log.md` with a review date 4 to 8 weeks out.

When duplicating a page into a pattern (city, competitor, product), every variant needs something only that variant can say (local facts, prices, examples, its own data). If the variants differ only by the swapped word, stop: that is a doorway pattern.

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

Output: one table (site, page, why it fits, contact page URL, draft message). Never invent an email address: point to the contact page or leave it blank. Before any paid placement, read `references/policies.md` (link spam).

---

## geo monthly

First week of the month:
1. `geo.mjs queries` (fan-out set from the config's money keywords and competitors) and `geo.mjs prospects` if DataForSEO is configured.
2. The owner (or you, with a logged-out browser if available) runs 10 real buyer prompts in ChatGPT, Perplexity, Gemini, Google AI Mode. Log each: `geo.mjs log --engine chatgpt --prompt "..." --cited yes|no --sources url1,url2`.
3. `geo.mjs report`: cited share per engine per month, and which domains the engines cite. Those domains are the outreach list.
4. Check every third-party ranking that lists the site still does.

API answers differ from what logged-out users see; a handful of honest manual checks beats a dashboard built on API calls.

---

## local

For businesses that serve a place. The map pack (Google Business Profile) matters more than the website.
1. Measure first: a rank-map (grid of positions across the area) from a local rank tracker the owner uses; compute the share of grid points in positions 1-3.
2. Profile: primary and secondary categories chosen only from Google's real category list (never from memory: it invents categories), 20+ services under the right categories, full description, photos, attributes, a weekly post. Reviews that name the service and the place.
3. The page the profile links to: title and H1 = primary category + city, the address and phone exactly as on the profile, a map embed, secondary categories as H2s.
4. One page per category and per service ("water heater repair Austin"), linked down from the home page inside paragraphs; then place pages only once the core ranks, each about the place itself.
The owner edits the Business Profile; you prepare the content.
