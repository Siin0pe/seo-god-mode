// Doorway detector: measures how much pages of the same pattern ("/plumber-austin/", "/plumber-dallas/") say the
// same thing. Pages where only the city or product name changes are what Google's spam policy calls doorways.
// For each page: its closest sibling, the text overlap with it (Jaccard on 5-word shingles of the main content)
// and how many words it says that no sibling says.
// Usage: node twins.mjs [--pattern "^/learn/"] [--urls url1,url2,...] [--threshold 0.8] [--warn 0.6] [--max 150]
//   Without --pattern or --urls, sitemap URLs are grouped by their first path segment.
// Exit code: 1 if any page is at or above --threshold (doorway risk), 3 if any is above --warn, else 0.
import { parseArgs, loadConfig, sitemapUrls, requireSitemap, fetchText, pool, onHost, contentWords, shingles, jaccard, table, short, emit } from "./lib.mjs";

const args = parseArgs();
const cfg = loadConfig(args);
const hi = Number(args.threshold || 0.8), lo = Number(args.warn || 0.6), max = Number(args.max || 150);

let urls = args.urls ? String(args.urls).split(",") : (await sitemapUrls(requireSitemap(cfg))).map((u) => u.loc).filter((u) => onHost(u, cfg.hostFilter));
const pathOf = (u) => { try { return new URL(u).pathname; } catch { return u; } };
if (args.pattern) { const re = new RegExp(args.pattern); urls = urls.filter((u) => re.test(pathOf(u))); }
// Group: explicit list or pattern = one group; otherwise by first path segment, ignoring the segment's own index page.
const groups = new Map();
for (const u of urls) {
  const segs = pathOf(u).split("/").filter(Boolean);
  if (!args.pattern && !args.urls && segs.length < 2) continue;
  const key = args.pattern || args.urls ? "selection" : "/" + segs[0] + "/";
  groups.set(key, [...(groups.get(key) || []), u]);
}
for (const [k, v] of groups) if (v.length < 2) groups.delete(k);
const all = [...groups.values()].flat().slice(0, max);
if (!all.length) { console.error("No group of 2+ pages to compare. Use --pattern or --urls."); process.exit(0); }

const pages = new Map();
await pool(all, 4, async (u) => { const r = await fetchText(u); if (r.status === 200) { const w = contentWords(r.text); pages.set(u, { words: w, sh: shingles(w) }); } });

const rows = [];
for (const [g, list] of groups) {
  const ps = list.filter((u) => pages.has(u));
  for (const u of ps) {
    const me = pages.get(u);
    let best = { sim: 0, with: "" };
    const others = new Set();
    for (const v of ps) { if (v === u) continue; const s = jaccard(me.sh, pages.get(v).sh); if (s > best.sim) best = { sim: s, with: v }; for (const x of pages.get(v).sh) others.add(x); }
    const unique = [...me.sh].filter((x) => !others.has(x)).length;
    // A run of new words yields about one new shingle per word: unique shingles ≈ unique words.
    rows.push({ group: g, url: u, words: me.words.length, closest: best.with, similarity: best.sim, uniqueWords: Math.min(unique, me.words.length) });
  }
}
rows.sort((a, b) => b.similarity - a.similarity);
const flag = (s) => (s >= hi ? "DOORWAY RISK" : s >= lo ? "thin variant" : "ok");
let md = `## Pattern twins — ${rows.length} pages in ${groups.size} group(s)\n\nSimilarity = share of 5-word sequences two pages have in common (main content only). At ≥${Math.round(hi * 100)}% a page is a find-and-replace of its sibling: add what only this variant can say (local facts, prices, examples, photos, testimonials) or merge the pages. "Unique words" ≈ how much the page says that no sibling says.\n\n`;
md += table(["page", "words", "closest sibling", "similarity", "unique words", "verdict"], rows.slice(0, Number(args.limit || 60)).map((r) => [short(r.url, cfg), r.words, short(r.closest, cfg), Math.round(r.similarity * 100) + "%", r.uniqueWords, flag(r.similarity)]));
const bad = rows.filter((r) => r.similarity >= hi).length, warn = rows.filter((r) => r.similarity >= lo && r.similarity < hi).length;
md += `\n\n${bad} page(s) at doorway risk, ${warn} thin variant(s).`;
emit(args, md, rows);
process.exitCode = bad ? 1 : warn ? 3 : 0;
