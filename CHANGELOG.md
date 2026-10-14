# Changelog

All notable changes to SEO God Mode are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.2.0] - 2026-10-14

### Added

- **CrUX History API**: `cwv.mjs --history [--weeks 40]` shows the weekly CrUX p75 (LCP, INP, CLS, TTFB) for the origin and each URL, the values 4 and 12 weeks earlier, and the last week a metric crossed its "good" threshold, so a regression has a date to set against the change log and `drop`. `weekly` adds the origin trend line; `doctor` checks the API. Needs the Chrome UX Report API enabled on the key (`CRUX_API_KEY`, or the PageSpeed key).
- **Search Console sitemaps**: `doctor` and `index` show which sitemaps Google knows, when it last read them, their errors and warnings, and flag a configured sitemap that is not submitted or has not been read for 14+ days. Same service account, read-only.

## [1.1.3] - 2026-10-14

### Fixed

- `drop --start A --end B` compared against a reference window shifted by the default 7 days, overlapping the current one (a 28-day window overlapped by 21 days), so every change was wrong. Windows now carry their real length everywhere (`period()`), `--vs weeks:N` is validated (`weeks:x` crashed, `weeks:0` compared a period with itself), and a shift shorter than the window stops with an explanation instead of overlapping.
- `keywords.mjs` exited outside a project although its config is optional (the `try/catch` around `loadConfig` could never catch an exit).
- `suggest.mjs`: one network error ended the run and lost the results; a 429 looked like "0 suggestions". Failed probes are now counted and reported. Grouping matched the seed case-sensitively, so a capitalised seed put every suggestion in "other".
- `cwv`/`weekly`: when PageSpeed falls back to origin-level field data, the result says so instead of showing it as the URL's.
- A missing `sitemap` in the config gives a clear message in `audit`, `internal-links`, `twins`, `prune`, `index-status` and `ship-gate --published`; bad `--filter`, `--start` after `--end` and missing arguments print a usage line instead of a stack trace.

### Changed

- The ship gate's rules, the prune classification (including the 600-word deletion veto) and the twins similarity live in `lib.mjs` as pure functions, unit-tested in CI with date windows and the CTR curve.

## [1.1.2] - 2026-10-14

### Fixed

- `ship-gate` could pass a page it should block: a `--before`/`--after` URL that is not a 200 was compared as an empty page (now exit 2), and in `--dist` a live page that timed out or returned a 5xx was treated as a new page (now blocking; only 404/410 count as new). `--published` compares the canonical's host too, and `--before` from a file takes the page URL from the canonical so internal links are counted right.
- The 1.1.1 Git Bash fix rewrote real file paths under any folder named `git` (`--out C:/Users/me/git/repo/r.md` became `/repo/r.md`). Only the actual Git install root (from `EXEPATH`, or `Program Files/Git`) is stripped now.
- Repeated `--filter` options reached `gsc.mjs` as the last one only; `--k=v` cut values containing `=` (`--filter=page=/x`).
- Domain-property host filtering matched `notexample.com` for `example.com` (`contains`); it is now an exact-host regex. Same for setup's property and GA4 stream detection, `twins` and `geo prospects`.
- `doctor` stopped at the first missing key or token error; every source is checked now.
- Google, PageSpeed and DataForSEO calls retry on 429/5xx with a timeout, and an HTML error page no longer crashes with a JSON parse error. A broken child sitemap is skipped with a warning instead of stopping the run.
- `index-status` cached API errors (quota) for the day and only saved at the end; errors are retried on the next run and progress is saved as it goes.
- `indexnow` exited 0 on a rejected batch, sent off-host URLs (the API rejects the whole batch), and crashed on `--from-sitemap` without a sitemap.
- Re-running `setup.mjs` ignored `--gsc`, `--ga4`, `--sitemap`, `--brand` and `--sa` when a value was already saved.
- `prune` and `internal-links` matched URLs character for character, so a trailing-slash difference between the sitemap, links and Search Console showed false zero-traffic pages and false orphans. Pages with no impression and no `lastmod` were "too young" forever; they are now flagged for a check.
- `audit` flagged relative canonicals and hreflang links as pointing elsewhere.
- `serp-mix` counted every `.co.uk` (and similar) result as yours.
- `robots.txt`: `Disallow: /*` was not seen as blocking the root, and several groups for the same crawler were not merged.
- `repoint` and `twins` split accented words ("réseau" → "re seau").
- Invalid `brand` or `classes` regexes in the config crash with a clear message; `rankmap` reads quoted CSV fields and reports empty files; one bad line in the GEO log no longer breaks `geo report`; `weekly` no longer slows down quadratically on large query sets; `quick-wins` describes the CTR curve it actually used.

### Changed

- CI unit checks cover argument parsing, robots.txt matching, host and URL matching, and run the ship gate end to end on fixtures. The zero-dependency check also catches single-quoted, multi-line and dynamic imports.
- Docs: the command syntax is `/seo-god-mode:seo <command>`, `setup` is in the command table, and the scheduled monthly run says what it can and cannot do unattended.

## [1.1.1] - 2026-10-14

### Fixed

- Git Bash on Windows rewrote URL-path arguments before Node saw them (`--paths /learn/` became `C:/Program Files/Git/learn/`, `/a/` became `A:/`), so `ship-gate --dist --paths` silently checked zero pages. Arguments are now restored in `lib.mjs` for every script.
- `ship-gate --dist` exits 2 when it checked no page or when a `--paths` entry matches no built page, instead of looking like a pass. Paths are normalised (`/a`, `a/` and `/a/` are the same).

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

[Unreleased]: https://github.com/Siin0pe/seo-god-mode/compare/v1.1.1...HEAD
[1.1.1]: https://github.com/Siin0pe/seo-god-mode/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/Siin0pe/seo-god-mode/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Siin0pe/seo-god-mode/releases/tag/v1.0.0
