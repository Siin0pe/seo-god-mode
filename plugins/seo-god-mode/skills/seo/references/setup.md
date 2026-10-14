# Setup

## Config: `.seo/config.json` (project root, safe to commit: it holds no secrets)

| field | meaning |
|---|---|
| `site` | canonical origin, e.g. `https://example.com` |
| `gscProperty` | `sc-domain:example.com` (domain property) or `https://example.com/` (URL prefix) |
| `hostFilter` | restricts a domain property to one host (default: the site's host). `--host other.example.com` or `--host all` override per run |
| `ga4Property`, `ga4Hostname` | numeric GA4 property id; hostname filter when one GA4 stream serves several sites |
| `sitemap` | sitemap or sitemap index URL |
| `brand` | regex of brand spellings, including typos (`"acme\|acmee\|akme"`): separates brand demand from SEO wins |
| `brandName` | display name, used in GEO fan-out queries |
| `classes` | extra query classes, `{"product": "widget\|gadget"}` |
| `targets` | queries tracked by name in the weekly report |
| `money` | money keywords (seed GEO fan-out and pattern work) |
| `competitors` | competitor names or domains |
| `priorityPaths` | paths requested first for indexing, in order (`["/", "/pricing/"]`) |
| `cwvUrls` | URLs for Core Web Vitals checks |
| `keyEvents` | GA4 event names that mean business (signup, purchase, tool_run) |
| `market` | DataForSEO defaults `{"location": 2840, "language": "en"}` (2826 UK, 2250 FR, 2276 DE, 2784 AE, 2392 JP, 2364 IR) |
| `credentials.serviceAccountKey` | path to the Google service account JSON key (a path, never the key itself) |
| `indexNowKey` | IndexNow key (public by design: it is served at the site root) |
| `tracker` | where findings go, e.g. `{"type": "linear", "team": "ABC", "ritualIssue": "ABC-12"}`; null → `.seo/log.md` |

`setup.mjs --site <url>` discovers what it can (Search Console property, GA4 property, sitemap, brand) and writes the config, `standards.md`, `log.md` and a `.gitignore` for `cache/`. Re-running it only fills empty fields.

## Google (Search Console, URL Inspection, GA4): service account

1. Google Cloud console → a project → enable **Google Search Console API**, **Google Analytics Data API**, **PageSpeed Insights API**.
2. IAM → Service accounts → create one → Keys → add JSON key. Store it outside the repo (e.g. `~/.config/google-sa-<site>.json`). The owner creates it; never paste a key into chat.
3. Search Console → Settings → Users and permissions → add the service account email (Full or Restricted is enough for reading).
4. GA4 → Admin → Property access management → add the service account email as **Viewer**.
5. Point `SEO_SA_KEY` (or `credentials.serviceAccountKey`) to the file. `doctor.mjs` confirms each grant.

Quotas: Search Analytics is generous (row pagination at 25,000); URL Inspection 2,000 calls/day and 600/minute per property (shared by every tool using that property); the UI "Request indexing" is about 10/day and has no API (the Indexing API is officially only for JobPosting and livestream pages; don't use it for ordinary pages).

## PageSpeed / CrUX

Works without a key but is rate-limited. Create an API key restricted to the PageSpeed Insights API and set `PAGESPEED_API_KEY`. Field data only exists for URLs and origins with enough Chrome traffic.

**CrUX History** (`cwv.mjs --history`, the trend line in `weekly`): up to 40 weekly p75 points per URL and origin, so a regression has a date. Enable the **Chrome UX Report API** (https://console.cloud.google.com/apis/library/chromeuxreport.googleapis.com) on the same project and allow it on the key, or create a separate key and set `CRUX_API_KEY`. Free, 150 queries/minute per project.

**Sitemaps in Search Console**: `doctor` and `index` read which sitemaps Google knows, when it last downloaded them and their errors, through the same service account (no extra setup).

## DataForSEO (optional, recommended for keyword work)

Pay-as-you-go API that supplies what Search Console can't: volumes, keyword ideas and difficulty, live SERPs (with AI Overview and other features), competitors' ranked keywords, domain gaps, backlinks (separate subscription). Minimum deposit around $50; a live SERP costs fractions of a cent. Set `DATAFORSEO_LOGIN` and `DATAFORSEO_PASSWORD` (API credentials, not the account password) in the environment, not in the config. There is also an official DataForSEO MCP server if you prefer tools over scripts.

## Bing and IndexNow (optional)

- Bing Webmaster Tools: verify the site (it can import from Search Console). Its API key (`BING_WMT_API_KEY`) gives Bing query data, which matters because some assistants retrieve through Bing.
- IndexNow: generate a 32-hex key, serve it as `/<key>.txt` at the site root (a shipped file: owner approval), set `INDEXNOW_KEY`; then `indexnow.mjs <urls>` after each publish. Not used by Google.

## Crawler visits (optional): Cloudflare or log files

`crawlers.mjs` shows which search and AI crawlers actually fetch the site, what they fetch and the status they get.

`setup.mjs` detects the host from the home page and says what applies:

- **Site behind Cloudflare** (orange cloud): create an API token (https://dash.cloudflare.com/profile/api-tokens → Custom token) with **Account → Account Analytics → Read** and **Zone → Zone → Read**, limited to the site's zone, set `CLOUDFLARE_API_TOKEN`, and re-run setup: it finds the zone and writes `"cloudflare": {"zoneId": "…"}`. (Without Zone Read, pass `--cf-zone <id>` from the zone's Overview page.) 30 days of history on every plan; crawlers are identified by user agent (verified-bot detection needs Bot Management).
- **Anywhere else** (Vercel, a VPS, any host): log files. `setup.mjs --logs <file or folder>` saves the location in the config and `crawlers.mjs` reads every log file in it (`.log`, `.ndjson`, `.json`, `.gz`); `--file` overrides it for one run. Formats: Vercel Log Drain JSON/NDJSON (`proxy.path`, `proxy.userAgent`, `proxy.statusCode`), generic JSON logs (`userAgent`, `path`, `status`, `timestamp`), and the combined access-log format (nginx, Apache). On Vercel, full request logs only exist through a Log Drain (Pro or Enterprise) to storage you can read; the runtime-logs API keeps at most a day and has no user agent.

## Optional MCP servers

The scripts cover the core. MCPs are interchangeable sources when present:
- **ChatSEO MCP** (`claude mcp add --transport http chatseo https://api.chatseo.app/mcp`, paid Pro plan): a conversational agent over the user's Search Console plus DataForSEO data. Useful as a second opinion or when DataForSEO is not set up; its answers are model output, so verify numbers against Search Console.
- **DataForSEO MCP** (official, `github.com/dataforseo/mcp-server-typescript`): the same data as `keywords.mjs`, as tools.
- **Google Analytics MCP**, **PageSpeed MCP**, Search Console MCPs: fine substitutes for the matching scripts.
- **Browser automation** (e.g. Claude in Chrome): needed for the Search Console UI "Request indexing" and for logged-out SERP / AI-answer checks. Indexing requests are fine; anything that submits forms on third-party sites or creates accounts is the owner's job.
