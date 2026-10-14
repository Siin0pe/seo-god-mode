// Striking-distance opportunities: query × page pairs ranking 4-20 with real impressions, scored by the clicks
// they would gain at a reachable target position. Also flags CTR underperformers in the top 3 (title/snippet or
// AI Overview problem, not a ranking problem) and cannibalised queries.
// Usage: node quick-wins.mjs [--days 28] [--min-impr 50] [--target 3] [--include-brand] [--limit 30] [--json]
import { parseArgs, loadConfig, gsc, gscObjects, period, queryClass, ctrCurve, expectedCtr, DEFAULT_CTR, table, fmt, pct, short, emit } from "./lib.mjs";

const args = parseArgs();
const cfg = loadConfig(args);
const win = period(args, 28);
const minImpr = Number(args["min-impr"] || 50);
const target = Number(args.target || 3);
const rows = gscObjects(await gsc(cfg, { startDate: win.start, endDate: win.end, dimensions: ["query", "page"] }), ["query", "page"]);

if (!rows.length && win.end < new Date().toISOString().slice(0, 10)) console.error(`No rows in ${win.start} → ${win.end}. If the site (or host) is younger than this window, re-run with --end ${new Date().toISOString().slice(0, 10)} (fresh, partial data) or check --host.`);
const pool = rows.filter((r) => args["include-brand"] || queryClass(cfg, r.query) !== "brand");
const curve = ctrCurve(pool);
const ownPositions = curve.filter((v, p) => p && v !== DEFAULT_CTR[p]).length;

// Striking distance
const wins = pool.filter((r) => r.position >= 4 && r.position <= 20 && r.impressions >= minImpr).map((r) => {
  const reach = r.position <= 10 ? target : Math.max(target, 5); // page 2 → aim for top 5 first
  const gain = Math.max(0, r.impressions * expectedCtr(curve, reach) - r.clicks);
  return { ...r, cls: queryClass(cfg, r.query), reach, gain };
}).sort((a, b) => b.gain - a.gain);

// CTR underperformers in top 3: same rank, far fewer clicks than the curve says
const ctrGaps = pool.filter((r) => r.position < 3.5 && r.impressions >= minImpr * 2).map((r) => ({ ...r, expected: expectedCtr(curve, r.position), lost: r.impressions * expectedCtr(curve, r.position) - r.clicks })).filter((r) => r.ctr < r.expected * 0.5 && r.lost > 5).sort((a, b) => b.lost - a.lost);

// Cannibalisation: one query, several pages with meaningful impressions
const byQuery = new Map();
for (const r of pool) { if (r.impressions < 10) continue; byQuery.set(r.query, [...(byQuery.get(r.query) || []), r]); }
const cannibal = [...byQuery.entries()].filter(([, ps]) => ps.length > 1).map(([q, ps]) => ({ query: q, pages: ps.sort((a, b) => b.impressions - a.impressions), impressions: ps.reduce((s, p) => s + p.impressions, 0) })).sort((a, b) => b.impressions - a.impressions);

const limit = Number(args.limit || 30);
let md = `## Quick wins — ${win.start} → ${win.end}\n\nCTR curve: ${ownPositions ? `site's own non-brand curve on ${ownPositions} position(s) with ≥500 impressions, default benchmark elsewhere` : "default benchmark (no position has 500+ impressions yet)"}. Gains are estimates of extra clicks over the same period at the reach position. Brand queries ${args["include-brand"] ? "included" : "excluded"}.\n\n### Striking distance (positions 4-20, ≥${minImpr} impressions)\n\n`;
md += wins.length ? table(["query", "page", "class", "impr", "clicks", "ctr", "pos", "reach", "+clicks est."], wins.slice(0, limit).map((r) => [r.query, short(r.page, cfg), r.cls, fmt(r.impressions), fmt(r.clicks), pct(r.ctr), r.position.toFixed(1), r.reach, fmt(r.gain)])) : "_None. Either the site is new (few impressions yet) or nothing ranks 4-20 with enough volume._";
md += `\n\n### Top-3 positions with a CTR far below the curve\n\nTwo opposite causes: a weak title/snippet (fix the title), or an AI Overview / SERP feature answering above you (a title rewrite will not help, check the live SERP first).\n\n`;
md += ctrGaps.length ? table(["query", "page", "impr", "ctr", "expected", "pos", "clicks lost est."], ctrGaps.slice(0, 15).map((r) => [r.query, short(r.page, cfg), fmt(r.impressions), pct(r.ctr), pct(r.expected), r.position.toFixed(1), fmt(r.lost)])) : "_None._";
md += `\n\n### Cannibalisation (one query, several pages with impressions)\n\nDecide which page owns the query, then point the others at it (internal link with the query as anchor, or merge). Brand queries hitting several pages are usually fine.\n\n`;
md += cannibal.length ? table(["query", "impr", "pages (impr @ pos)"], cannibal.slice(0, 15).map((c) => [c.query, fmt(c.impressions), c.pages.map((p) => `${short(p.page, cfg)} (${p.impressions} @ ${p.position.toFixed(1)})`).join("; ")])) : "_None._";
emit(args, md, { window: win, wins: wins.slice(0, 200), ctrGaps, cannibal: cannibal.slice(0, 100) });
