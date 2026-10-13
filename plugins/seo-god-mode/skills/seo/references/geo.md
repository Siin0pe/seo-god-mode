# GEO: being cited by AI assistants

Last reviewed 2026-10. This field moves monthly; treat every figure as indicative and dated. Prefer the site's own measurements (manual checks logged with `geo.mjs log`, GA4 channel "AI Assistant", referrals from chatgpt.com, perplexity.ai, gemini.google.com) over industry averages.

## What is reasonably established

- **No SEO, no GEO.** When an assistant searches, it reads pages that rank in web search. Pages that are not indexed or rank nowhere are rarely cited. GEO comes after the pages exist and rank.
- **Assistants answer many prompts without searching.** Ahrefs (2026) reported ChatGPT answers about 6 in 7 prompts without a web search; those answers come from training data that lags the web by a year or more. New brands get in through search-backed answers.
- **Query fan-out.** When it searches, the assistant rewrites the conversation into a few short search queries. They converge on shapes such as "best [category] [year]", "[brand] review", "[competitor] alternative", comparisons, sometimes `site:` queries on authority domains, and often in English as well as the user's language. So GEO starts as a keyword list built from money keywords.
- **Being on the pages that get read beats being big.** Third-party listicles, comparisons, review sites, Reddit threads and Wikipedia-like references are disproportionately cited. A ranking on someone else's site carries more weight than one on your own; self-ranked "best X" lists with yourself first are increasingly discounted by models.
- **Sources rotate.** A given prompt draws on a pool of sources that reshuffles over weeks. Refreshing dated content (with the year in the title) and staying in recent third-party lists matters.

## What is disputed (do not present as fact)

- **Bing vs Google.** One widely repeated claim (Seer Interactive, SearchGPT) says ~87% of ChatGPT citations matched Bing's top results; replications found far lower overlap (AI+Automation: ~27%; Grow & Convert: only ~40% of cited sources appeared anywhere in the top 10 pages of Google or Bing). AirOps (548k retrieved pages) found ~56% of cited pages ranked in Google's top 20 for a related query. Retrieval and citation selection appear to be separate steps. Practical answer: rank in both, and use IndexNow for Bing.
- **Reddit's share.** Varies by engine and month: high on Perplexity, low on Gemini, and in some French ChatGPT datasets it fell from ~30% to ~5% within months in 2026. Check the engine your buyers use before investing a quarter in it.
- **Citation rate of retrieved pages.** Studies report that only a small share of retrieved pages get cited (figures between ~3% and ~15%).

Sources: ahrefs.com/blog/query-fan-out-chatgpt · airops.com/report/influence-of-retrieval-fanout-and-google-serps-in-chatgpt · growandconvert.com/ai/fan-out-query-serp-study · aiplusautomation.com/blog/chatgpt-optimization-complete-guide · promptwatch.com/blog/how-chatgpt-searches-the-web

## Levers, in order

1. The pages exist, are indexed, crawlable by retrieval bots (`audit.mjs` reports the robots.txt AI policy: blocking OAI-SearchBot, ChatGPT-User, PerplexityBot, Claude-SearchBot prevents live citation; blocking training bots like GPTBot does not).
2. Facts about the business are current and in plain text on its own pages (prices, features, locations, dates).
3. Rank for the fan-out shapes ("best X year", "X review", "X alternative") with honest pages.
4. Be listed in third-party rankings and comparisons that rank for those shapes (outreach; ranking swaps between businesses that genuinely belong together; refresh yearly).
5. Answer in the communities the engines read (Reddit, forums, YouTube), as yourself, with disclosure, including where you are the wrong choice.
6. Measure monthly by hand, logged out, and keep the log.

## Not levers

llms.txt files, "AI-ready" markup, prompt-injection text on pages (also a trust and policy risk), and buying expensive single media mentions for citation alone (cheap placements reportedly get cited about as often, and both rotate out).
