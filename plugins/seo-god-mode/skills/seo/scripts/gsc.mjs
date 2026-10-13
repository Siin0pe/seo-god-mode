// Generic Search Console query, with optional comparison to the previous period of equal length.
// Usage: node gsc.mjs --dims query,page [--days 28 | --start A --end B] [--compare] [--filter "query~regex" ...]
//        [--country fra] [--device MOBILE] [--class brand|generic|<name>] [--sort clicks|impressions|position|delta] [--limit 50] [--host <hostname>|all] [--json] [--out file]
// Rows with a date dimension are listed chronologically unless --sort is given.
// With a host filter on a domain property, totals are page-level (a query counts once per page shown), so they can exceed --host all totals.
// Filters: dim~regex (includingRegex), dim!~regex (excludingRegex), dim=value (equals), dim*=text (contains).
import { parseArgs, loadConfig, gsc, gscObjects, period, previousWindow, queryClass, table, fmt, pct, signed, delta, short, emit } from "./lib.mjs";

const args = parseArgs();
const cfg = loadConfig(args);
const dims = String(args.dims || "query").split(",");
const win = period(args, 28);
const filters = [].concat(args.filter || []).map((f) => {
  const m = f.match(/^(\w+)(!~|~|\*=|=)(.*)$/);
  if (!m) throw new Error("bad filter " + f);
  const op = { "~": "includingRegex", "!~": "excludingRegex", "*=": "contains", "=": "equals" }[m[2]];
  return { dimension: m[1], operator: op, expression: m[3] };
});
if (args.country) filters.push({ dimension: "country", operator: "equals", expression: args.country });
if (args.device) filters.push({ dimension: "device", operator: "equals", expression: args.device });
const body = (w) => ({ startDate: w.start, endDate: w.end, dimensions: dims, ...(filters.length ? { dimensionFilterGroups: [{ filters }] } : {}) });
const opts = { hostOnly: true };
let cur = gscObjects(await gsc(cfg, body(win), opts), dims);
let prev = [];
if (args.compare) prev = gscObjects(await gsc(cfg, body(previousWindow(win)), opts), dims);
const keyOf = (r) => dims.map((d) => r[d]).join("\u0001");
const prevMap = new Map(prev.map((r) => [keyOf(r), r]));
if (args.class && dims.includes("query")) { cur = cur.filter((r) => queryClass(cfg, r.query) === args.class); }
for (const r of cur) { const p = prevMap.get(keyOf(r)); r.prevClicks = p?.clicks ?? 0; r.prevImpressions = p?.impressions ?? 0; r.prevPosition = p?.position; r.clickDelta = r.clicks - r.prevClicks; }
if (args.compare) for (const p of prev) if (!cur.find((r) => keyOf(r) === keyOf(p)) && (!args.class || queryClass(cfg, p.query) === args.class)) cur.push({ ...p, prevClicks: p.clicks, prevImpressions: p.impressions, prevPosition: p.position, clicks: 0, impressions: 0, ctr: 0, position: null, clickDelta: -p.clicks, lost: true });
const sortKey = args.sort || (dims.includes("date") ? "date" : "clicks");
cur.sort((a, b) => (sortKey === "date" ? String(a.date).localeCompare(String(b.date)) : sortKey === "position" ? (a.position ?? 999) - (b.position ?? 999) : sortKey === "delta" ? Math.abs(b.clickDelta) - Math.abs(a.clickDelta) : (b[sortKey] ?? 0) - (a[sortKey] ?? 0)));
const limit = Number(args.limit || (dims.includes("date") ? 500 : 50));
const tot = cur.reduce((s, r) => ({ c: s.c + r.clicks, i: s.i + r.impressions, pc: s.pc + (r.prevClicks || 0), pi: s.pi + (r.prevImpressions || 0) }), { c: 0, i: 0, pc: 0, pi: 0 });
const head = [...dims, "clicks", "impr", "ctr", "pos", ...(args.compare ? ["Δclicks", "Δimpr", "pos prev"] : [])];
const rows = cur.slice(0, limit).map((r) => [...dims.map((d) => (d === "page" ? short(r[d], cfg) : r[d])), fmt(r.clicks), fmt(r.impressions), pct(r.ctr), r.position ? r.position.toFixed(1) : "—", ...(args.compare ? [signed(delta(r.clicks, r.prevClicks)), signed(delta(r.impressions, r.prevImpressions)), r.prevPosition ? r.prevPosition.toFixed(1) : "—"] : [])]);
const md = `## GSC ${dims.join(" × ")} — ${win.start} → ${win.end}${args.compare ? ` vs ${previousWindow(win).start} → ${previousWindow(win).end}` : ""}\n\nRows: ${cur.length} (showing ${Math.min(limit, cur.length)}). Totals of listed rows: ${fmt(tot.c)} clicks${args.compare ? ` (${signed(delta(tot.c, tot.pc))})` : ""}, ${fmt(tot.i)} impressions${args.compare ? ` (${signed(delta(tot.i, tot.pi))})` : ""}. Note: query-level rows omit anonymized queries, so they sum below property totals.\n\n${table(head, rows)}`;

if (!cur.length && win.end < new Date().toISOString().slice(0, 10)) console.error(`No rows in ${win.start} → ${win.end}. If the site (or host) is younger than this window, re-run with --end ${new Date().toISOString().slice(0, 10)} (fresh, partial data) or check --host.`);
emit(args, md, { window: win, rows: cur });
