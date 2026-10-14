// Crawler visits: how often search engines and AI crawlers actually fetch the site, what they fetch, and what
// they get back. robots.txt says who may crawl; this says who does. Sources:
//   - Cloudflare (sites behind the Cloudflare proxy): GraphQL Analytics, up to 30 days, every plan.
//     Needs CLOUDFLARE_API_TOKEN (Account Analytics: Read) and config "cloudflare": {"zoneId": "..."}.
//   - Log files (any host, e.g. a Vercel Log Drain export, nginx/Apache access logs, .gz accepted): --file, or
//     config "logs" (a file or folder, set by setup.mjs --logs).
// User agents can be spoofed: counts are requests claiming to be each crawler.
// Usage: node crawlers.mjs [--days 30] [--top 5] [--sitemap]                 (Cloudflare)
//        node crawlers.mjs --file logs.ndjson [--file access.log.gz ...] [--days N] [--sitemap]
//   --sitemap: also list sitemap pages Googlebot did not fetch in the window.
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import zlib from "node:zlib";
import { parseArgs, loadConfig, CRAWLER_UAS, crawlerOf, parseLogLine, cloudflareGraphql, fetchText, parseRobots, rootAllowed, sitemapUrls, requireSitemap, table, fmt, pct, emit, die } from "./lib.mjs";

const args = parseArgs();
const cfg = loadConfig(args);
// --file, else config "logs" (a file or a folder of log files).
const logDir = (p) => (fs.statSync(p).isDirectory() ? fs.readdirSync(p).filter((f) => /\.(log|ndjson|jsonl?|gz)$|\.log\.\d+$/i.test(f)).map((f) => path.join(p, f)) : [p]);
const files = args.file ? [].concat(args.file) : cfg.logs && fs.existsSync(cfg.logs) ? logDir(cfg.logs) : [];
if (cfg.logs && !args.file && !files.length) console.error(`config "logs": ${cfg.logs} not found or holds no log file.`);
const zoneId = cfg.cloudflare?.zoneId || process.env.CLOUDFLARE_ZONE_ID;
if (!files.length && !zoneId) die('No source: run setup.mjs (it finds the Cloudflare zone, or takes --logs <file or folder>), or pass --file <log>. See references/setup.md.', 2);
const days = Number(args.days || (files.length ? 0 : 30));
if (zoneId && !files.length && days > 30) die("Cloudflare keeps 30 days per query: use --days 30 or less.");
const until = new Date(), since = days ? new Date(until - days * 86400000) : null;

const stats = new Map(CRAWLER_UAS.map(([n, cat]) => [n, { name: n, cat, count: 0, s2: 0, s3: 0, s4: 0, s5: 0, paths: new Map(), last: null }]));
const add = (name, path, status, n = 1, time = null) => {
  const s = stats.get(name);
  s.count += n;
  const k = status >= 500 ? "s5" : status >= 400 ? "s4" : status >= 300 ? "s3" : "s2";
  s[k] += n;
  s.paths.set(path, (s.paths.get(path) || 0) + n);
  if (time && (!s.last || time > s.last)) s.last = time;
};

let source;
if (files.length) {
  source = `log files (${files.join(", ")})`;
  let lines = 0, parsed = 0;
  for (const f of files) {
    if (!fs.existsSync(f)) die(`No such file: ${f}`);
    let input = fs.createReadStream(f);
    if (f.endsWith(".gz")) input = input.pipe(zlib.createGunzip());
    for await (const line of readline.createInterface({ input, crlfDelay: Infinity })) {
      lines++;
      const r = parseLogLine(line);
      if (!r) continue;
      parsed++;
      if (since && r.time && r.time < since.toISOString()) continue;
      const name = crawlerOf(r.ua);
      if (name) add(name, r.path, r.status, 1, r.time);
    }
  }
  if (!parsed) die(`None of the ${lines} lines was recognised as a log entry (expected Vercel Log Drain JSON, JSON logs with userAgent/path/status, or the combined access-log format).`);
  if (parsed < lines) console.error(`${lines - parsed} of ${lines} lines not recognised, skipped.`);
} else {
  source = `Cloudflare zone ${zoneId}, last ${days} days`;
  const host = new URL(cfg.site).host;
  const q = (withStatus) => `query($zone: String!, $since: Time!, $until: Time!, $ua: String!, $host: String!) { viewer { zones(filter: { zoneTag: $zone }) {
    httpRequestsAdaptiveGroups(filter: { datetime_geq: $since, datetime_leq: $until, requestSource: "eyeball", userAgent_like: $ua, clientRequestHTTPHost: $host }, limit: 5000, orderBy: [count_DESC]) {
      count dimensions { clientRequestPath${withStatus ? " edgeResponseStatus" : ""} } } } } }`;
  let withStatus = true;
  for (const [name] of CRAWLER_UAS) {
    const vars = { zone: zoneId, since: since.toISOString(), until: until.toISOString(), ua: `%${name}%`, host };
    let data;
    try { data = await cloudflareGraphql(q(withStatus), vars); }
    catch (e) {
      // Status as a grouping dimension is not documented for every plan: fall back to paths only.
      if (!withStatus || !/edgeResponseStatus/.test(e.message)) throw e;
      withStatus = false;
      data = await cloudflareGraphql(q(false), vars);
    }
    for (const g of data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups || []) add(name, g.dimensions.clientRequestPath, g.dimensions.edgeResponseStatus ?? 200, g.count);
  }
  if (!withStatus) console.error("Cloudflare did not allow grouping by status on this zone: status columns count everything as 2xx.");
}

// Who robots.txt lets in, to set against who actually comes.
const robots = await fetchText(cfg.site + "/robots.txt");
const groups = robots.status === 200 ? parseRobots(robots.text) : [];
const rows = [...stats.values()];
const top = Number(args.top || 5);
const label = { search: "search", aiRetrieval: "AI search / answers", aiTraining: "AI training" };
const notes = [];
for (const s of rows) {
  const allowed = rootAllowed(groups, s.name);
  if (!allowed && s.count) notes.push(`${s.name} is disallowed in robots.txt but made ${fmt(s.count)} requests (ignores robots.txt, or a spoofed user agent).`);
  if (s.cat === "search" && s.count && (s.s4 + s.s5) / s.count > 0.1) notes.push(`${s.name}: ${pct((s.s4 + s.s5) / s.count)} of requests got a 4xx/5xx: check its top paths in the table.`);
}
const g = stats.get("Googlebot");
if (!g.count) notes.push("No Googlebot request in this window: check the source covers the whole site, or that Googlebot is not blocked upstream (firewall, bot protection).");
const retrieval = rows.filter((s) => s.cat === "aiRetrieval").reduce((n, s) => n + s.count, 0);
const training = rows.filter((s) => s.cat === "aiTraining").reduce((n, s) => n + s.count, 0);

let md = `## Crawler visits — ${source}\n\nRequests claiming each crawler's user agent. AI search / answers crawlers fetch pages to cite them live (ChatGPT search, Claude, Perplexity); training crawlers collect data. ${fmt(retrieval)} AI search requests, ${fmt(training)} AI training requests.\n\n`;
md += table(["crawler", "kind", "robots.txt", "requests", "2xx", "3xx", "4xx", "5xx", ...(files.length ? ["last seen"] : []), `top paths`], rows.filter((s) => s.count || s.cat !== "aiTraining").sort((a, b) => b.count - a.count).map((s) => [s.name, label[s.cat], rootAllowed(groups, s.name) ? "allowed" : "blocked", fmt(s.count), fmt(s.s2), fmt(s.s3), fmt(s.s4), fmt(s.s5), ...(files.length ? [s.last?.slice(0, 16).replace("T", " ") || "—"] : []), [...s.paths].sort((a, b) => b[1] - a[1]).slice(0, top).map(([p, n]) => `${p} (${n})`).join(", ")]));
if (notes.length) md += "\n\n" + notes.map((n) => "- " + n).join("\n");

let unseen = [];
if (args.sitemap) {
  const fetched = new Set([...g.paths.keys()].map((p) => p.replace(/\/+$/, "") || "/"));
  unseen = (await sitemapUrls(requireSitemap(cfg))).map((u) => { try { return new URL(u.loc).pathname; } catch { return u.loc; } }).filter((p) => !fetched.has(p.replace(/\/+$/, "") || "/"));
  md += `\n\n### Sitemap pages Googlebot did not fetch in this window (${unseen.length})\n\nNot fetched is not "not indexed" (Google recrawls stable pages rarely), but a new or changed page here is waiting: link it from crawled pages, and check index-status.mjs.\n\n` + (unseen.length ? unseen.slice(0, 50).map((p) => "- " + p).join("\n") + (unseen.length > 50 ? `\n- … ${unseen.length - 50} more` : "") : "_Every sitemap page was fetched._");
}
emit(args, md, { source, since: since?.toISOString() || null, crawlers: rows.map((s) => ({ ...s, paths: Object.fromEntries([...s.paths].sort((a, b) => b[1] - a[1]).slice(0, 50)) })), notes, unseen });
