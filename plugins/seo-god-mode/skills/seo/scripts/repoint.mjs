// Pages that Google ranks for a different query than the one they are written for. For each page: the query
// Google gives it the most impressions for, whether that query appears in the title / H1 / first 100 words,
// position and CTR, and which fix applies (striking distance → repoint; top-3 with low CTR → check the SERP first).
// Usage: node repoint.mjs [--days 90] [--min-impr 100] [--include-brand] [--limit 40] [--json]
import { parseArgs, loadConfig, gsc, gscObjects, period, queryClass, fetchText, signature, mainHtml, pool, table, fmt, pct, short, emit } from "./lib.mjs";

const args = parseArgs();
const cfg = loadConfig(args);
const win = period(args, 90);
const minImpr = Number(args["min-impr"] || 100);
const rows = gscObjects(await gsc(cfg, { startDate: win.start, endDate: win.end, dimensions: ["page", "query"] }), ["page", "query"]).filter((r) => args["include-brand"] || queryClass(cfg, r.query) !== "brand");
const byPage = new Map();
for (const r of rows) byPage.set(r.page, [...(byPage.get(r.page) || []), r]);
const pages = [...byPage.entries()].map(([page, qs]) => ({ page, qs: qs.sort((a, b) => b.impressions - a.impressions), impr: qs.reduce((s, q) => s + q.impressions, 0) })).filter((p) => p.impr >= minImpr).sort((a, b) => b.impr - a.impr).slice(0, Number(args.limit || 40));

const STOP = new Set("a an the of for to in on at by with and or is are what how why does do your you my vs".split(" "));
const toks = (s) => s.toLowerCase().replace(/(\p{L})[\s-]+(\d)/gu, "$1$2").normalize("NFKD").replace(/[^\p{L}\p{N} ]+/gu, " ").split(/\s+/).filter((t) => t && !STOP.has(t));
const coverage = (q, text) => { const t = new Set(toks(text)); const qt = toks(q); return qt.length ? qt.filter((x) => t.has(x)).length / qt.length : 1; };

const results = await pool(pages, 4, async (p) => {
  const { text: html, status } = await fetchText(p.page);
  const sig = status === 200 ? signature(html, p.page) : null;
  const first100 = sig ? mainHtml(html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().split(" ").slice(0, 100).join(" ") : "";
  const top = p.qs[0];
  const head = sig ? `${sig.title} ${sig.h1.join(" ")}` : "";
  const cov = { title: sig ? coverage(top.query, sig.title) : 0, h1: sig ? coverage(top.query, sig.h1.join(" ")) : 0, intro: sig ? coverage(top.query, first100) : 0 };
  const fix = top.position >= 8 && top.position <= 20 ? "striking distance: repoint H1, title, meta, first 100 words, and make the body answer it" : top.position < 3.5 && top.ctr < 0.05 ? "top 3 but low CTR: check the live SERP (AI Overview?) before rewriting" : top.position < 8 ? "close: tighten title + intro" : "deep: needs content/authority, not a repoint";
  return { page: p.page, status, title: sig?.title, h1: sig?.h1?.[0], top, others: p.qs.slice(1, 4), cov, mismatch: Math.max(cov.title, cov.h1) < 0.6, fix, impr: p.impr };
});
const mism = results.filter((r) => r.mismatch);
let md = `## Repoint candidates — ${win.start} → ${win.end}\n\nPages with ≥${minImpr} non-brand impressions whose top query is not covered by the title or H1 (token coverage < 60%). Coverage = share of the query's words present.\n\n`;
md += mism.length ? table(["page", "top query (impr, pos, ctr)", "title / H1 coverage", "in first 100 words", "current title", "next queries", "fix"], mism.map((r) => [short(r.page, cfg), `${r.top.query} (${fmt(r.top.impressions)}, ${r.top.position.toFixed(1)}, ${pct(r.top.ctr)})`, `${pct(r.cov.title, 0)} / ${pct(r.cov.h1, 0)}`, pct(r.cov.intro, 0), r.title || `HTTP ${r.status}`, r.others.map((o) => `${o.query} (${o.impressions})`).join("; "), r.fix])) : "_No mismatch: every checked page's top query is covered by its title or H1._";
md += `\n\nAligned pages checked: ${results.length - mism.length}. Before changing a title on a page that gets clicks, get approval and note the date: give it 4-8 weeks before judging, and never revert in a panic.`;
emit(args, md, { window: win, results });
