# Changelog

All notable changes to SEO God Mode are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.1.0] - 2026-10-13

### Added

- **`twins`**: doorway detector. Measures how much pages of one pattern share (5-word shingles of the main content), flags 80%+ as doorway risk (exit 1) and 60%+ as thin variants, and counts what each page says that no sibling says.
- **`serp-mix`** (DataForSEO): occupy the SERP. Ranks queries by open slots beyond your own site (videos, Reddit and forums, platforms, third-party lists), lists the subreddits Google ranks on your keywords, the videos ranking and the lists that don't mention you. Cached per query and day.
- **`rankmap`**: local SEO from a rank-map export. Top-3%, strongest and weakest direction, cheap wins in positions 4-6, gap to the leaders with the 25% / 50% decision rule.
- **`ship-gate --published`**: after deploy, checks the page answers 200, is indexable, self-canonical and listed in the live sitemap. `--dist` now also checks the built sitemap lists every new indexable page.
- **`/seo-god-mode:schedule`**: puts the Monday review and the monthly GEO check on the system scheduler (Task Scheduler or cron), after the owner's yes.
- Playbook: occupying the SERP (videos, Shorts, posts, threads, lists), the Reddit method, ranking swaps and the placement ladder, outreach cadence, the five checks before a paid link, backlink profile anomalies, link decay, and the full local system (profile numbers, the seven home page checks, the Core 30, the rank-map decision rule).
- Contributing guide, code of conduct, security policy, issue and PR templates, CI (syntax, `--help`, manifest versions, zero dependencies on Node 18 and 22).

## [1.0.0] - 2026-10-13

First public release.

### Added

- **`/seo-god-mode:setup`**: one-command onboarding. Finds the Google service account key, picks the Search Console and GA4 properties that cover the site, detects the sitemap, the brand and the main market, writes `.seo/` and runs `doctor`. Safe to re-run: only empty fields are filled.
- **`seo` skill** with 18 zero-dependency Node scripts (Node 18+), markdown or `--json` output:
  - `doctor`: connected sources, every host of a domain property.
  - `weekly`: Monday review with at most 3 ranked actions.
  - `drop`: traffic-change diagnosis split into demand, ranking and CTR, per segment, with like-for-like weekdays (`--vs weeks:N`, `--vs year`) and mix-effect detection.
  - `quick-wins`: striking-distance queries (positions 4-20), top-3 CTR gaps, cannibalisation.
  - `repoint`: pages ranking for a different query than the one they target.
  - `prune`: content inventory with a coded veto on deleting pages of 600+ words.
  - `audit`: technical issues by severity, hreflang, canonicals, AI-crawler policy in robots.txt.
  - `index`: indexing status through the URL Inspection API and today's request order.
  - `links`: orphans, weakly linked pages, link sources and anchors.
  - `gate`: before/after check of a page change; exit code 1 blocks a deploy.
  - `cwv`: Core Web Vitals, field (CrUX) and lab.
  - `keywords`: DataForSEO volumes, ideas, live SERPs, ranked keywords, gaps, backlinks.
  - `suggest`, `gsc`, `geo`, `bing`, `indexnow`.
- Playbooks for `pattern`, `brief`, `ship`, `outreach`, `local`, monthly GEO checks and multilingual sites.
- References: SEO playbook, Google spam policies with links, dated and disputed GEO research, data source setup.
- Guardrails: read-only by default, owner approval for anything that touches a live page, never deletes pages, buys, emails, submits forms, creates accounts or handles credentials.
- Per-project memory in `.seo/`: `standards.md` (grows from rejected proposals) and `log.md` (every change with its review date).

[Unreleased]: https://github.com/Siin0pe/seo-god-mode/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/Siin0pe/seo-god-mode/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Siin0pe/seo-god-mode/releases/tag/v1.0.0
