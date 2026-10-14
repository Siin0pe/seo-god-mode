// Index coverage of every sitemap URL through the URL Inspection API (2,000 calls/day/property), cached per
// day in .seo/cache/inspect-YYYY-MM-DD.json so re-runs cost nothing. Prints what is indexed, what is not and
// why, and a ranked list of URLs to request manually in the Search Console UI (~10/day quota there).
// Usage: node index-status.mjs [--limit 300] [--fresh] [--only /path-prefix] [--json]
import fs from "node:fs";
import { parseArgs, loadConfig, sitemapUrls, requireSitemap, gscSitemaps, sitemapIssues, inspectUrl, gsc, gscObjects, period, cachePath, today, pool, table, fmt, short, emit } from "./lib.mjs";

const args = parseArgs();
const cfg = loadConfig(args);
let urls = (await sitemapUrls(requireSitemap(cfg))).map((u) => u.loc);
if (args.only) urls = urls.filter((u) => u.includes(args.only));
urls = urls.slice(0, Number(args.limit || 300));
const file = cachePath(cfg, `inspect-${today()}.json`);
const cache = !args.fresh && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
// Errors (quota, transient) are retried on the next run instead of being cached for the day.
const todo = urls.filter((u) => !cache[u] || cache[u].error);
const save = () => fs.writeFileSync(file, JSON.stringify(Object.fromEntries(Object.entries(cache).filter(([, r]) => !r.error)), null, 2));
let done = 0;
await pool(todo, 3, async (u) => { cache[u] = await inspectUrl(cfg, u); if (++done % 25 === 0) save(); });
save();

const res = urls.map((u) => cache[u]);
const indexed = res.filter((r) => r.verdict === "PASS");
const notIdx = res.filter((r) => r.verdict !== "PASS");
// Priority for manual requests: configured priority pages first, then pages that already earn impressions
// (Google knows the demand), then "Discovered/Crawled - not indexed" before "unknown".
const impr = new Map(gscObjects(await gsc(cfg, { ...(() => { const w = period({}, 28); return { startDate: w.start, endDate: w.end }; })(), dimensions: ["page"] }), ["page"]).map((r) => [r.page, r.impressions]));
const prio = (r) => ((cfg.priorityPaths || []).includes(short(r.url, cfg)) ? 1000000 - (cfg.priorityPaths.indexOf(short(r.url, cfg))) : 0) + (impr.get(r.url) || 0) * 10 + (/discovered|crawled/i.test(r.coverage || "") ? 5 : 0);
// Legal and utility pages go last: they rarely bring search traffic and burn the ~10/day UI quota.
const LOW = new RegExp(cfg.lowPriorityPattern || "/(legal|legal-notice|privacy|terms|cookies?|imprint|impressum|contact|changelog|about)(/|$)", "i");
const prio2 = (r) => prio(r) - (LOW.test(short(r.url, cfg)) ? 2000000 : 0);
notIdx.sort((a, b) => prio2(b) - prio2(a));
const byCov = res.reduce((m, r) => ((m[r.coverage || r.error || "?"] = (m[r.coverage || r.error || "?"] || 0) + 1), m), {});
let md = `## Index coverage — ${today()}\n\n${indexed.length}/${res.length} indexed. ${Object.entries(byCov).map(([k, v]) => `${k}: ${v}`).join(" · ")}.\nAPI calls this run: ${todo.length} (cache: ${file}).\n\n### Not indexed, in request order\n\nRequest these in the Search Console UI (URL inspection → Request indexing), about 10 per day per property; stop at "Quota exceeded" and continue tomorrow. Do not request noindex pages or URLs whose canonical points elsewhere.\n\n`;
md += notIdx.length ? table(["#", "page", "coverage", "last crawl", "Google canonical ≠ declared", "impr 28d"], notIdx.map((r, i) => [i + 1, short(r.url, cfg), r.coverage || r.error, r.lastCrawl?.slice(0, 10) || "never", r.canonicalGoogle && r.canonicalUser && r.canonicalGoogle !== r.canonicalUser ? short(r.canonicalGoogle, cfg) : "", fmt(impr.get(r.url) || 0)])) : "_Everything in the sitemap is indexed._";
const canonIssues = indexed.filter((r) => r.canonicalGoogle && r.canonicalUser && r.canonicalGoogle !== r.canonicalUser);
if (canonIssues.length) md += `\n\n### Indexed under a different canonical than declared\n\n` + table(["page", "declared", "Google chose"], canonIssues.map((r) => [short(r.url, cfg), short(r.canonicalUser, cfg), short(r.canonicalGoogle, cfg)]));
// Google's side of the sitemaps: a sitemap Google stopped reading explains pages that never get discovered.
const sm = await gscSitemaps(cfg);
if (sm.error) md += `\n\n### Sitemaps in Search Console\n\nUnavailable: ${sm.error}`;
else {
  const issues = sitemapIssues(sm.sitemaps, cfg.sitemap);
  md += `\n\n### Sitemaps in Search Console\n\n` + (sm.sitemaps.length ? table(["sitemap", "last read by Google", "last submitted", "URLs submitted", "errors", "warnings"], sm.sitemaps.map((s) => [s.path, s.lastDownloaded?.slice(0, 10) || (s.pending ? "pending" : "never"), s.lastSubmitted?.slice(0, 10) || "—", fmt(s.submitted), s.errors, s.warnings])) : "_None submitted._") + (issues.length ? `\n\n${issues.map((i) => "- " + i).join("\n")}` : "");
}
emit(args, md, { date: today(), results: res, sitemaps: sm });
