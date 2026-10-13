// Traffic change diagnosis: decomposes a click change between two periods into demand (impressions),
// ranking (position) and click-through (CTR), per segment, so you can tell "people search less" from
// "Google ranks us lower" from "the SERP changed". Compares like-for-like weekdays.
// Usage: node drop.mjs [--days 7] [--end YYYY-MM-DD] [--vs prev|year|weeks:N] [--by class,country,page,device] [--json]
//   --vs prev    : previous period of equal length (default)
//   --vs weeks:4 : same weekdays 4 weeks earlier (avoids holiday overlap with the previous week)
//   --vs year    : same weekdays 52 weeks earlier (seasonality check)
import { parseArgs, loadConfig, gsc, gscObjects, ga4, period, addDays, lastFinalDay, queryClass, table, fmt, pct, signed, delta, short, emit } from "./lib.mjs";

const args = parseArgs();
const cfg = loadConfig(args);
const cur = period(args, 7);
const vs = String(args.vs || "prev");
const shiftDays = vs === "year" ? 364 : vs.startsWith("weeks:") ? 7 * Number(vs.split(":")[1]) : cur.days % 7 === 0 ? cur.days : Math.ceil(cur.days / 7) * 7;
const ref = { start: addDays(cur.start, -shiftDays), end: addDays(cur.end, -shiftDays) };
const segs = String(args.by || "class,country,page,device").split(",");

async function load(w, dims) { return gscObjects(await gsc(cfg, { startDate: w.start, endDate: w.end, dimensions: dims }), dims); }
const agg = (rows) => { const c = rows.reduce((s, r) => s + r.clicks, 0), i = rows.reduce((s, r) => s + r.impressions, 0), pw = rows.reduce((s, r) => s + r.position * r.impressions, 0); return { clicks: c, impr: i, ctr: i ? c / i : 0, pos: i ? pw / i : 0 }; };

function verdict(a, b) {
  // a = current, b = reference
  if (!b.impr) return "new";
  const dImpr = delta(a.impr, b.impr), dPos = a.pos - b.pos, dCtr = b.ctr ? (a.ctr - b.ctr) / b.ctr : 0;
  const parts = [];
  if (Math.abs(dImpr) >= 0.2) parts.push(dImpr < 0 ? "demand ↓" : "demand ↑");
  if (Math.abs(dPos) >= 1) parts.push(dPos > 0 ? "rank ↓" : "rank ↑");
  if (Math.abs(dCtr) >= 0.2) parts.push(dCtr < 0 ? "CTR ↓" : "CTR ↑");
  return parts.join(", ") || "stable";
}

const totalsCur = agg(await load(cur, ["date"]));
const totalsRef = agg(await load(ref, ["date"]));
const fresh = cur.end > lastFinalDay();
let md = (fresh ? `> Partial data: the window ends after ${lastFinalDay()} (Search Console finalises ~3 days late). Recent days will still rise; read shares and positions, not absolute clicks.

` : "") + `## Change diagnosis — ${cur.start} → ${cur.end} vs ${ref.start} → ${ref.end} (${vs === "year" ? "same weekdays last year" : vs.startsWith("weeks") ? `same weekdays ${vs.split(":")[1]} week(s) earlier` : "previous period"})\n\n`;
md += table(["", "clicks", "impressions", "CTR", "avg pos"], [["current", fmt(totalsCur.clicks), fmt(totalsCur.impr), pct(totalsCur.ctr), totalsCur.pos.toFixed(2)], ["reference", fmt(totalsRef.clicks), fmt(totalsRef.impr), pct(totalsRef.ctr), totalsRef.pos.toFixed(2)], ["change", signed(delta(totalsCur.clicks, totalsRef.clicks)), signed(delta(totalsCur.impr, totalsRef.impr)), signed(delta(totalsCur.ctr, totalsRef.ctr)), (totalsCur.pos - totalsRef.pos).toFixed(2)]]);
// Mix-adjusted position change: per query×country, position change weighted by reference impressions.
// If the raw average moved but like-for-like rows did not, the "rank drop" is a mix effect.
const [mxA, mxB] = await Promise.all([load(cur, ["query", "country"]), load(ref, ["query", "country"])]);
const mb = new Map(mxB.map((r) => [r.query + "|" + r.country, r]));
let w = 0, s = 0;
for (const r of mxA) { const b = mb.get(r.query + "|" + r.country); if (!b) continue; w += b.impressions; s += (r.position - b.position) * b.impressions; }
const adj = w ? s / w : 0;
const rawPos = totalsCur.pos - totalsRef.pos;
const mix = Math.abs(rawPos) >= 1 && Math.abs(adj) < 0.5;
let overall = verdict(totalsCur, totalsRef);
if (mix) overall = overall.replace(/rank [↓↑],? ?/, "").replace(/^, |, $/g, "") + (overall.includes("rank") ? " (rank change is a mix effect)" : "");
md += `\n\nOverall: **${overall || "stable"}**. Like-for-like position change (same query × country in both periods, weighted by reference impressions): **${adj >= 0 ? "+" : ""}${adj.toFixed(2)}** vs raw ${rawPos >= 0 ? "+" : ""}${rawPos.toFixed(2)}.${mix ? " The raw average moved because the traffic mix changed (new countries, new queries or pages at deeper positions), not because existing rankings fell." : ""} Totals mix segments with opposite moves (one country on holiday, another growing): the per-segment tables below are the diagnosis, the totals are not.\n`;

const out = { cur, ref, totals: { cur: totalsCur, ref: totalsRef }, segments: {} };
for (const seg of segs) {
  const dim = seg === "class" ? "query" : seg;
  const [a, b] = await Promise.all([load(cur, [dim]), load(ref, [dim])]);
  const keyFn = seg === "class" ? (r) => queryClass(cfg, r.query) : (r) => r[dim];
  const group = (rows) => { const m = new Map(); for (const r of rows) { const k = keyFn(r); m.set(k, [...(m.get(k) || []), r]); } return m; };
  const ga = group(a), gb = group(b);
  const keys = [...new Set([...ga.keys(), ...gb.keys()])];
  const rows = keys.map((k) => { const x = agg(ga.get(k) || []), y = agg(gb.get(k) || []); return { k, x, y, dc: x.clicks - y.clicks }; }).sort((p, q) => Math.abs(q.dc) - Math.abs(p.dc)).slice(0, Number(args.limit || 10));
  out.segments[seg] = rows;
  md += `\n\n### By ${seg}${seg === "class" ? " (query class; anonymized queries excluded)" : ""}\n\n` + table([seg, "clicks", "Δ clicks", "impr Δ", "pos (ref → cur)", "CTR (ref → cur)", "reading"], rows.map((r) => [seg === "page" ? short(r.k, cfg) : r.k, fmt(r.x.clicks), (r.dc >= 0 ? "+" : "") + fmt(r.dc), signed(delta(r.x.impr, r.y.impr)), `${r.y.pos ? r.y.pos.toFixed(1) : "—"} → ${r.x.pos ? r.x.pos.toFixed(1) : "—"}`, `${pct(r.y.ctr)} → ${pct(r.x.ctr)}`, verdict(r.x, r.y)]));
}

if (cfg.ga4Property && !args["no-ga4"]) {
  const g = async (w) => ga4(cfg, { dateRanges: [{ startDate: w.start, endDate: w.end }], dimensions: [{ name: "sessionDefaultChannelGroup" }], metrics: [{ name: "sessions" }] });
  const [x, y] = await Promise.all([g(cur), g(ref)]);
  const ym = new Map(y.map((r) => [r[0], r[1]]));
  md += `\n### GA4 sessions by channel\n\nIf organic falls but direct/referral hold, it is search-side; if every channel falls together, it is audience-side (holiday, outage, tracking).\n\n` + table(["channel", "sessions", "ref", "change"], x.sort((p, q) => q[1] - p[1]).map((r) => [r[0], fmt(r[1]), fmt(ym.get(r[0]) || 0), signed(delta(r[1], ym.get(r[0]) || 0))]));
}
md += `\n\n**How to read it.** demand ↓ with stable rank and CTR = people search less (seasonality, holidays, news): check the calendar of the top country before touching anything. rank ↓ on specific pages = look at those pages (changes, competitors, indexing). CTR ↓ at stable rank = SERP changed (AI Overview, features) or the snippet got worse. Always re-run with \`--vs year\` or \`--vs weeks:4\` before calling a drop structural.`;
emit(args, md, out);
