// Technical audit of every sitemap URL: HTTP status and redirects, indexability (robots meta, X-Robots-Tag,
// canonical), titles/descriptions (missing, duplicate, length), H1, hreflang reciprocity, html lang, JSON-LD
// validity, thin pages, images without alt, plus robots.txt and sitemap hygiene. Ranked by severity.
// Usage: node audit.mjs [--limit 500] [--json]
import { parseArgs, loadConfig, sitemapUrls, fetchText, signature, mainHtml, pool, table, short, emit, parseRobots, rootAllowed, CRAWLERS } from "./lib.mjs";

const args = parseArgs();
const cfg = loadConfig(args);
const issues = [];
const add = (sev, url, rule, detail = "") => issues.push({ sev, url, rule, detail });

const robots = await fetchText(cfg.site + "/robots.txt");
if (robots.status !== 200) add(2, "/robots.txt", "robots.txt missing", `HTTP ${robots.status}`);
else {
  const groups = parseRobots(robots.text);
  for (const b of CRAWLERS.search) if (!rootAllowed(groups, b)) add(1, "/robots.txt", `${b} blocked from the site root`);
  const blockedRetrieval = CRAWLERS.aiRetrieval.filter((b) => !rootAllowed(groups, b));
  if (blockedRetrieval.length) add(2, "/robots.txt", "AI search/retrieval crawlers blocked (site cannot be cited live)", blockedRetrieval.join(", "));
  const blockedTraining = CRAWLERS.aiTraining.filter((b) => !rootAllowed(groups, b));
  add(3, "/robots.txt", "AI crawler policy (info)", `training blocked: ${blockedTraining.join(", ") || "none"}; retrieval allowed: ${CRAWLERS.aiRetrieval.filter((b) => rootAllowed(groups, b)).join(", ") || "none"}`);
  if (!/^\s*sitemap:/im.test(robots.text)) add(3, "/robots.txt", "no Sitemap: line");
}
const entries = (await sitemapUrls(cfg.sitemap)).slice(0, Number(args.limit || 500));
const pages = await pool(entries, 5, async (e) => {
  const r = await fetchText(e.loc);
  return { url: e.loc, lastmod: e.lastmod, status: r.status, finalUrl: r.url, xRobots: r.headers?.["x-robots-tag"] || "", html: r.text, sig: r.status === 200 ? signature(r.text, e.loc) : null };
});
const titles = new Map(), descs = new Map();
const hreflangMap = new Map();
for (const p of pages) {
  if (p.status !== 200) { add(1, p.url, "sitemap URL not 200", `HTTP ${p.status}`); continue; }
  if (p.finalUrl && p.finalUrl !== p.url) add(1, p.url, "sitemap URL redirects", `→ ${p.finalUrl}`);
  const abs = (u) => { try { return new URL(u, p.url).href; } catch { return u; } };
  const s = p.sig;
  const noindex = /noindex/i.test(s.robots) || /noindex/i.test(p.xRobots);
  if (noindex) add(1, p.url, "noindex page in sitemap", s.robots || p.xRobots);
  if (!s.canonical) add(2, p.url, "no canonical");
  // A relative canonical ("/a/") is valid: resolve it before comparing.
  else if (abs(s.canonical) !== p.url) add(1, p.url, "canonical points elsewhere (non-canonical URL in sitemap)", s.canonical);
  if (!s.title) add(1, p.url, "missing title");
  else { titles.set(s.title, [...(titles.get(s.title) || []), p.url]); if (s.title.length > 65) add(3, p.url, "long title", `${s.title.length} chars`); if (s.title.length < 20) add(3, p.url, "short title", s.title); }
  if (!s.description) add(2, p.url, "missing meta description");
  else { descs.set(s.description, [...(descs.get(s.description) || []), p.url]); if (s.description.length > 165) add(3, p.url, "long meta description", `${s.description.length} chars`); }
  if (s.h1.length !== 1) add(2, p.url, `H1 count ${s.h1.length}`);
  if (!s.lang) add(2, p.url, "no html lang");
  if (s.jsonLd.includes("INVALID_JSON")) add(1, p.url, "JSON-LD does not parse");
  if (s.words < 250 && !noindex) add(3, p.url, "thin content", `${s.words} words in main content`);
  const imgs = [...mainHtml(p.html).matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  const noAlt = imgs.filter((t) => !/\balt\s*=/.test(t)).length;
  if (noAlt) add(3, p.url, "images without alt attribute", `${noAlt}/${imgs.length}`);
  if (/<img\b(?![^>]*\b(width|height)\s*=)[^>]*>/i.test(mainHtml(p.html))) add(3, p.url, "img without width/height (CLS risk)");
  if (s.hreflang.length) hreflangMap.set(p.url, s.hreflang.map((h) => abs(h.split("=").slice(1).join("="))));
}
for (const [t, us] of titles) if (us.length > 1) add(2, us[0], "duplicate title", `${us.length} pages: ${us.map((u) => short(u, cfg)).join(", ")} — "${t}"`);
for (const [, us] of descs) if (us.length > 1) add(3, us[0], "duplicate meta description", us.map((u) => short(u, cfg)).join(", "));
for (const [u, alts] of hreflangMap) {
  if (!alts.includes(u)) add(2, u, "hreflang set has no self-reference");
  for (const a of alts) if (a !== u && hreflangMap.has(a) && !hreflangMap.get(a).includes(u)) add(2, u, "hreflang not reciprocal", `${short(a, cfg)} does not point back`);
}
if (!entries.some((e) => e.lastmod)) add(3, cfg.sitemap, "sitemap has no lastmod", "Google uses lastmod when it is consistently accurate");
issues.sort((a, b) => a.sev - b.sev);
const label = { 1: "critical", 2: "important", 3: "minor" };
const counts = [1, 2, 3].map((s) => `${label[s]}: ${issues.filter((i) => i.sev === s).length}`).join(" · ");
const md = `## Technical audit — ${pages.length} sitemap URLs\n\n${counts}\n\nCritical = blocks indexing or sends contradictory signals. Fix by template when the same rule hits many pages.\n\n` + table(["severity", "page", "issue", "detail"], issues.map((i) => [label[i.sev], short(i.url, cfg), i.rule, i.detail]));
emit(args, md, issues);
