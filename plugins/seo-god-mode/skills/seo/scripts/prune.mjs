// Content inventory for pruning: every sitemap URL with its clicks / impressions over N days, age (first
// impression seen, or sitemap lastmod), word count and inbound internal links. Classifies into
// keep / improve / merge-or-redirect candidate / too young. It never deletes anything: deletion is an owner
// decision, and pages of 600+ words are never proposed for deletion by this script (veto in code, not prompt).
// Usage: node prune.mjs [--days 90] [--min-impr 50] [--young 90] [--json]
import { parseArgs, loadConfig, gsc, gscObjects, period, addDays, today, sitemapUrls, requireSitemap, fetchText, signature, pool, urlKey, pruneAction, table, fmt, short, emit } from "./lib.mjs";

const args = parseArgs();
const cfg = loadConfig(args);
const win = period(args, Number(args.days || 90));
const minImpr = Number(args["min-impr"] || 50);
const youngDays = Number(args.young || 90);
const urls = await sitemapUrls(requireSitemap(cfg));
// Matched on urlKey(): a trailing-slash or host-case difference between the sitemap and Search Console must not
// turn a page with traffic into a zero-traffic merge candidate.
const perf = new Map();
for (const r of gscObjects(await gsc(cfg, { startDate: win.start, endDate: win.end, dimensions: ["page"] }), ["page"])) {
  const k = urlKey(r.page), p = perf.get(k);
  perf.set(k, p ? { clicks: p.clicks + r.clicks, impressions: p.impressions + r.impressions, position: Math.min(p.position, r.position) } : r);
}
// First day with impressions over the last 16 months approximates age when the sitemap has no lastmod.
const first = new Map();
for (const r of gscObjects(await gsc(cfg, { startDate: addDays(today(), -480), endDate: win.end, dimensions: ["page", "date"] }), ["page", "date"])) { const k = urlKey(r.page); if (!first.has(k) || r.date < first.get(k)) first.set(k, r.date); }

const pages = await pool(urls, 5, async (u) => { const r = await fetchText(u.loc); return { url: u.loc, lastmod: u.lastmod, status: r.status, sig: r.status === 200 ? signature(r.text, u.loc) : null }; });
const inlinks = new Map();
for (const p of pages) for (const t of new Set((p.sig?.internalTargets || []).map(urlKey))) if (t !== urlKey(p.url)) inlinks.set(t, (inlinks.get(t) || 0) + 1);

const cutoff = addDays(today(), -youngDays);
const rows = pages.map((p) => {
  const g = perf.get(urlKey(p.url)) || { clicks: 0, impressions: 0, position: null };
  const seen = first.get(urlKey(p.url)) || p.lastmod?.slice(0, 10) || null;
  // No impression in 16 months and no lastmod: the age is unknown, not young. Flag it instead of skipping it forever.
  const young = !!seen && seen > cutoff;
  const words = p.sig?.words ?? 0;
  const noindex = /noindex/i.test(p.sig?.robots || "");
  const action = pruneAction({ status: p.status, noindex, young, seen, clicks: g.clicks, impressions: g.impressions, position: g.position, words, minImpr });
  return { url: p.url, clicks: g.clicks, impressions: g.impressions, position: g.position, firstSeen: seen, words, inlinks: inlinks.get(urlKey(p.url)) || 0, action };
});
const order = (a) => (a.startsWith("fix") ? 0 : a.startsWith("merge") ? 1 : a.startsWith("improve or") ? 2 : a.startsWith("check") ? 3 : a.startsWith("improve") ? 4 : a.startsWith("too") ? 5 : 6);
rows.sort((a, b) => order(a.action) - order(b.action) || a.impressions - b.impressions);
const counts = rows.reduce((m, r) => ((m[r.action.split(":")[0].split(" (")[0]] = (m[r.action.split(":")[0].split(" (")[0]] || 0) + 1), m), {});
let md = `## Content inventory — ${win.start} → ${win.end}\n\n${rows.length} sitemap URLs. ${Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join(" · ")}.\n\nOrder of work: fix sitemap errors, then decide merges (cut before you optimise), then repoint (\`repoint.mjs\`), then regroup into hubs. Never delete without the owner; prefer a 301 to the closest page that keeps the intent.\n\n`;
md += table(["page", "action", "clicks", "impr", "pos", "first seen", "words", "inlinks"], rows.map((r) => [short(r.url, cfg), r.action, fmt(r.clicks), fmt(r.impressions), r.position ? r.position.toFixed(1) : "—", r.firstSeen || "never", fmt(r.words), r.inlinks]));
emit(args, md, { window: win, rows });
