# Changelog

All notable changes to SEO God Mode are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

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

[1.0.0]: https://github.com/Siin0pe/seo-god-mode/releases/tag/v1.0.0
