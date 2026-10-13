// Pre-publish regression gate. Compares the SEO signature of a page before and after a change and fails on
// silent losses: an interactive element, a table, a JSON-LD type or an FAQ disappearing, the canonical or robots
// changing, hreflang removed, a big word-count drop. This is the guard against "the agent rewrote the page and
// quietly dropped the one original thing on it".
// Usage:
//   node ship-gate.mjs --before <url|file.html> --after <url|file.html>
//   node ship-gate.mjs --dist <built-site-dir> [--base https://live.site] [--paths /a/,/b/]   (built output vs live)
//   node ship-gate.mjs --published <url,url>   after deploy: 200, indexable, self-canonical, listed in the live sitemap
// The sitemap check matters once an agent publishes outside a CMS: nothing warns you when the sitemap stops
// listing new pages, and Google quietly stops learning what exists.
// Exit code: 0 pass, 1 blocking regression (needs explicit owner approval), 3 warnings only.
import fs from "node:fs";
import path from "node:path";
import { parseArgs, loadConfig, fetchText, signature, sitemapUrls, table, emit } from "./lib.mjs";

const args = parseArgs();
const load = async (src, url) => (/^https?:/.test(src) ? (await fetchText(src)).text : fs.readFileSync(src, "utf8"));

function compare(a, b, label) {
  const block = [], warn = [];
  for (const [k, v] of Object.entries(a.elements)) if ((b.elements[k] ?? 0) < v) (["form", "input", "table", "video", "details", "canvas"].includes(k) ? block : warn).push(`${k}: ${v} → ${b.elements[k] ?? 0}`);
  const lostLd = a.jsonLd.filter((t) => !b.jsonLd.includes(t));
  if (lostLd.length) block.push(`JSON-LD types removed: ${[...new Set(lostLd)].join(", ")}`);
  if (b.jsonLd.includes("INVALID_JSON")) block.push("JSON-LD does not parse");
  if (a.canonical !== b.canonical) block.push(`canonical: ${a.canonical || "∅"} → ${b.canonical || "∅"}`);
  if (a.robots !== b.robots) block.push(`robots meta: "${a.robots}" → "${b.robots}"`);
  const lostHl = a.hreflang.filter((h) => !b.hreflang.includes(h));
  if (lostHl.length) block.push(`hreflang removed: ${lostHl.join(", ")}`);
  if (a.lang !== b.lang) block.push(`html lang: ${a.lang} → ${b.lang}`);
  if (b.h1.length !== 1) warn.push(`H1 count is ${b.h1.length}`);
  if (a.words && b.words < a.words * 0.7) block.push(`words: ${a.words} → ${b.words} (−${Math.round((1 - b.words / a.words) * 100)}%)`);
  else if (a.words && b.words < a.words * 0.9) warn.push(`words: ${a.words} → ${b.words}`);
  if (a.title !== b.title) warn.push(`title changed: "${a.title}" → "${b.title}" (needs approval if the page gets clicks)`);
  if (a.description !== b.description) warn.push("meta description changed");
  if (a.h1[0] !== b.h1[0]) warn.push(`H1: "${a.h1[0]}" → "${b.h1[0]}"`);
  const lostH2 = a.h2.filter((h) => !b.h2.includes(h));
  if (lostH2.length) warn.push(`H2 removed: ${lostH2.slice(0, 6).join(" | ")}`);
  if (b.internalLinks < a.internalLinks * 0.8) warn.push(`internal links: ${a.internalLinks} → ${b.internalLinks}`);
  const lostTargets = a.internalTargets.filter((t) => !b.internalTargets.includes(t));
  if (lostTargets.length) warn.push(`internal link targets dropped: ${lostTargets.slice(0, 5).join(", ")}`);
  if (!b.description) warn.push("no meta description");
  if (b.title.length > 65) warn.push(`title ${b.title.length} chars (may truncate)`);
  return { label, block, warn };
}

const pathOf = (u) => { try { return new URL(u).pathname; } catch { return u; } };
const noindex = (sig) => /noindex/i.test(sig.robots);
let results = [];
if (args.published) {
  const cfg = loadConfig(args);
  const listed = new Set((await sitemapUrls(cfg.sitemap)).map((u) => pathOf(u.loc)));
  for (const url of String(args.published).split(",")) {
    const r = await fetchText(url), block = [], warn = [];
    if (r.status !== 200) block.push(`HTTP ${r.status}`);
    else {
      const sig = signature(r.text, url);
      if (noindex(sig)) block.push("robots meta says noindex");
      if (!sig.canonical) warn.push("no canonical tag");
      else if (pathOf(sig.canonical) !== pathOf(r.url)) block.push(`canonical points elsewhere: ${sig.canonical}`);
      if (!listed.has(pathOf(url))) block.push(`not listed in the live sitemap (${cfg.sitemap})`);
      if (/noindex/i.test(r.headers["x-robots-tag"] || "")) block.push("X-Robots-Tag header says noindex");
    }
    results.push({ label: url, block, warn });
  }
} else if (args.dist) {
  const cfg = args.base ? { site: args.base.replace(/\/$/, "") } : loadConfig(args);
  const files = [];
  const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (f === "index.html") files.push(p); } };
  walk(args.dist);
  let pathsOnly = args.paths ? String(args.paths).split(",") : null;
  // Sitemaps produced by the build: every indexable page should be in one of them.
  const maps = fs.readdirSync(args.dist).filter((f) => /^sitemap.*\.xml$/i.test(f));
  const built = new Set(maps.flatMap((f) => [...fs.readFileSync(path.join(args.dist, f), "utf8").matchAll(/<loc>\s*([^<\s]+)/gi)].map((m) => m[1])).filter((u) => !/sitemap.*\.xml$/i.test(u)).map(pathOf));
  if (!maps.length) results.push({ label: "(build)", block: [], warn: ["no sitemap*.xml in the build output: check how the sitemap is generated"] });
  for (const f of files) {
    const rel = "/" + path.relative(args.dist, path.dirname(f)).split(path.sep).join("/");
    const urlPath = rel === "/" ? "/" : rel + "/";
    if (pathsOnly && !pathsOnly.includes(urlPath)) continue;
    const after = signature(fs.readFileSync(f, "utf8"), cfg.site + urlPath);
    const inMap = !maps.length || noindex(after) || built.has(urlPath);
    const live = await fetchText(cfg.site + urlPath);
    if (live.status !== 200) { results.push({ label: urlPath, block: inMap ? [] : ["new page missing from the built sitemap"], warn: [`new page (live ${live.status})`] }); continue; }
    const r = compare(signature(live.text, cfg.site + urlPath), after, urlPath);
    if (!inMap) r.warn.push("not in the built sitemap");
    results.push(r);
  }
} else {
  if (!args.before || !args.after) throw new Error("need --before and --after, or --dist");
  const url = args.url || (/^https?:/.test(args.before) ? args.before : "");
  results.push(compare(signature(await load(args.before), url), signature(await load(args.after), url), args.after));
}
const blocked = results.filter((r) => r.block.length), warned = results.filter((r) => !r.block.length && r.warn.length);
let md = `## Ship gate — ${results.length} page(s): ${blocked.length} blocked, ${warned.length} with warnings\n\n`;
if (blocked.length) md += "### Blocking (do not publish without explicit approval)\n\n" + table(["page", "regressions"], blocked.map((r) => [r.label, r.block.join("; ")])) + "\n\n";
if (warned.length || blocked.some((r) => r.warn.length)) md += "### Warnings\n\n" + table(["page", "warnings"], results.filter((r) => r.warn.length).map((r) => [r.label, r.warn.join("; ")])) + "\n";
if (!blocked.length && !warned.length) md += "No regression detected.\n";
if (args.published) md += "\nPages that pass are live, indexable and in the sitemap: request indexing for them (index-status.mjs gives today's order) and log the change in .seo/log.md.\n";
emit(args, md, results);
process.exitCode = blocked.length ? 1 : warned.length ? 3 : 0;
