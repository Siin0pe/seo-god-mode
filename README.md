# SEO God Mode

**Your SEO team, inside Claude Code. It reads your real Google data, tells you what to do this week, and never makes up a number.**

[![Claude Code plugin](https://img.shields.io/badge/Claude%20Code-plugin-D97757)](https://docs.claude.com/en/docs/claude-code/plugins)
[![Node 18+](https://img.shields.io/badge/node-18%2B-339933)](https://nodejs.org)
[![Zero dependencies](https://img.shields.io/badge/dependencies-0-blue)](#how-it-works)
[![Release](https://img.shields.io/github/v/release/Siin0pe/seo-god-mode)](https://github.com/Siin0pe/seo-god-mode/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-lightgrey)](LICENSE)

Most "AI SEO" tools are a chatbot guessing search volumes from memory. SEO God Mode wires Claude straight into **Search Console, the URL Inspection API, GA4, PageSpeed/CrUX** and, if you want it, **DataForSEO**, then works like a senior SEO who has seen a few hundred traffic drops:

- "Why is traffic down?" → it splits the change into **demand, ranking and click-through**, per country, page and query family, and tells you whether to panic (usually: no, it's a school holiday).
- "What should I do this week?" → **3 ranked actions**, each with the data behind it and how you'll know it worked.
- "Ship this page" → a **gate** that blocks the deploy if your change silently dropped a FAQ, a form, a table, an hreflang or a canonical.

```
/plugin marketplace add Siin0pe/seo-god-mode
/plugin install seo-god-mode@seo-god-mode
/seo-god-mode:setup https://your-site.com
```

That's it. The last command finds your Search Console property, your GA4 property, your sitemap, your brand and your main market by itself, writes the config, checks every connection and gives you a first verdict.

---

## What you can ask

Talk normally ("why did clicks drop on Tuesday?", "get this page on Google", "what should we write next?") or call a command with `/seo-god-mode:seo <command>`.

| Command | What you get |
|---|---|
| `setup` | Everything connected in one go (`/seo-god-mode:setup`) |
| `doctor` | What's plugged in, what's missing, every host on your domain |
| `weekly` | The Monday review: what moved, why, and 3 actions max |
| `drop` | Traffic-drop diagnosis: demand vs rank vs CTR, per segment, like-for-like weekdays, mix-effect detection |
| `quick-wins` | Queries at positions 4-20 worth a push, top-3 results with a broken CTR, cannibalised queries |
| `repoint` | Pages Google ranks for a different query than the one you wrote them for |
| `index` | What's indexed, what isn't and why, and today's request order (the UI allows ~10 a day: use them well) |
| `audit` | Technical issues ranked by severity, hreflang, canonicals, robots.txt policy for AI crawlers |
| `links` | Orphan pages, pages with too few internal links, where to add links and with which anchor |
| `prune` | Content inventory: keep, improve or merge. It never deletes anything |
| `gate` | Before/after check of any page change, exit code 1 blocks the deploy |
| `cwv` | Core Web Vitals, field (CrUX) and lab |
| `keywords` | Volumes, ideas, live SERPs with AI Overviews, competitor keywords, gaps, backlinks (DataForSEO) |
| `suggest` | Free keyword patterns from Google Autocomplete |
| `geo` | Visibility in ChatGPT, Perplexity, Gemini and AI Overviews: fan-out queries, prospects, citation log |
| `brief` / `pattern` / `ship` / `outreach` / `local` | Step-by-step playbooks: one page per keyword, page patterns, safe publishing, link prospecting, local SEO |
| `gsc`, `bing`, `indexnow` | Raw Search Console cuts, Bing data, instant pings after publishing |

## A real case

A site's clicks fell **67% in a week** (3,361 → 1,101). The owner was ready to rewrite titles. `drop` showed:

- brand queries: **demand ↓**, position unchanged at 1.0, CTR unchanged at 95%;
- the whole loss came from **one country**;
- the average position "fell" from 2.4 to 5.4, but the **like-for-like position moved by +0.09**: a new country entering at deeper positions, not a ranking loss.

Verdict: mid-term school holidays in that country, nothing to touch, check again the week after they end. That's the job: knowing when *not* to act is half of SEO.

## Why it's different

**It doesn't invent numbers.** Every figure comes with its source and its date window. No DataForSEO connected? It says "volume unknown" instead of hallucinating 2,400/month.

**It knows the traps.** Search Console lags 3 days, the average position lies when the traffic mix changes, new domains need 3 to 6 months, a change needs 4 to 8 weeks before you judge it, top-3 with a low CTR is often an AI Overview and not your title. All of that is built into the scripts and the skill.

**It has guardrails in code, not just in prompts.**

| Allowed | Needs your yes | Never |
|---|---|---|
| Read every source, run every script, draft pages, open PRs | Publish or change a live page, titles on pages with clicks, redirects, robots.txt, canonical, hreflang, noindex | Delete a page (pages over 600 words are vetoed in code), buy links, send emails, submit forms, create accounts, touch credentials |

Every time you reject a proposal, the reason goes into `.seo/standards.md`. After a few weeks, that file *is* your editorial line, and Claude follows it.

## Data sources

| Source | What it unlocks | Cost |
|---|---|---|
| Google Search Console + URL Inspection | Clicks, impressions, positions, indexing | Free |
| GA4 | Sessions by channel, conversions | Free |
| PageSpeed Insights / CrUX | Core Web Vitals | Free (an API key lifts the rate limit) |
| Google Autocomplete | Keyword patterns | Free |
| DataForSEO *(optional)* | Search volumes, live SERPs, competitors, gaps, backlinks | Pay as you go, ~$50 minimum deposit, fractions of a cent per call |
| Bing Webmaster + IndexNow *(optional)* | Bing queries, instant indexing on Bing and friends | Free |

Google access goes through a **service account** you create (5 minutes, free). The setup command gives you the exact links and checks each grant. Keys stay on your machine; the config only stores a path to them and is safe to commit.

## How it works

```
plugins/seo-god-mode/
├── commands/setup.md          /seo-god-mode:setup
└── skills/seo/
    ├── SKILL.md               how Claude runs the job: commands, rules, judgment
    ├── scripts/               18 Node scripts, zero dependencies, markdown or --json output
    └── references/            playbook, Google spam policies with links, GEO research, setup
```

Per project, everything lives in `.seo/`: `config.json`, `standards.md` (your rules), `log.md` (every shipped change with its review date), `reports/` and `cache/`.

Scripts run on their own too: `node skills/seo/scripts/drop.mjs --vs weeks:4`, `--help` on any of them. Domain properties with several subdomains are handled (`--host blog.example.com` or `--host all`).

## Requirements

- [Claude Code](https://docs.claude.com/en/docs/claude-code)
- Node.js 18 or newer
- A site verified in Google Search Console

## Credits

The working method borrows from Nicholas Dulait's long-form guide on using Claude for SEO (keyword patterns, one page per query, an original element on every page, the publishing gate, the weekly loop) and from a lot of real Search Console sessions. Policy notes link to Google's own documentation.

## License

MIT
