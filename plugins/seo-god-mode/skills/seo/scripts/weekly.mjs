// Weekly review data pack: last complete week (ending 3 days ago, when GSC data is final) vs the week before.
// Query classes, target queries, biggest movers, pages, countries, GA4 days/channels, index coverage from the
// latest inspect cache, CWV. Writes .seo/reports/<YYYY-Www>.md. The model writes the reading and max 3 actions.
// Usage: node weekly.mjs [--end YYYY-MM-DD] [--no-cwv] [--json]
import fs from "node:fs";
import path from "node:path";
import { parseArgs, loadConfig, gsc, gscObjects, ga4, pagespeed, period, previousWindow, queryClass, table, fmt, pct, signed, delta, short, emit } from "./lib.mjs";

const args = parseArgs();
const cfg = loadConfig(args);
const cur = period({ end: args.end, days: 7 });
const prev = previousWindow(cur);
const isoWeek = (s) => { const d = new Date(s + "T00:00:00Z"); const day = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - day + 3); const w1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4)); return `${d.getUTCFullYear()}-W${String(1 + Math.round(((d - w1) / 86400000 - 3 + ((w1.getUTCDay() + 6) % 7)) / 7)).padStart(2, "0")}`; };
const week = isoWeek(cur.end);
const q = async (w, dims) => gscObjects(await gsc(cfg, { startDate: w.start, endDate: w.end, dimensions: dims }), dims);
const [qc, qp, dc, dp, pc, pp, cc] = await Promise.all([q(cur, ["query"]), q(prev, ["query"]), q(cur, ["date"]), q(prev, ["date"]), q(cur, ["page"]), q(prev, ["page"]), q(cur, ["country"])]);
const sum = (rows) => rows.reduce((s, r) => ({ c: s.c + r.clicks, i: s.i + r.impressions }), { c: 0, i: 0 });
const T = sum(dc), P = sum(dp);
let md = `# SEO weekly ${week} — ${cur.start} → ${cur.end} (vs ${prev.start} → ${prev.end})\n\nHost ${cfg.hostFilter || "all hosts"}, property ${cfg.gscProperty}. Totals: **${fmt(T.c)} clicks (${signed(delta(T.c, P.c))})**, ${fmt(T.i)} impressions (${signed(delta(T.i, P.i))}), CTR ${pct(T.i ? T.c / T.i : 0)}.\n\n## By query class\n\n`;
const classes = [...new Set([...qc, ...qp].map((r) => queryClass(cfg, r.query)))];
md += table(["class", "clicks", "Δ", "impr", "Δ", "queries"], classes.map((k) => { const a = sum(qc.filter((r) => queryClass(cfg, r.query) === k)), b = sum(qp.filter((r) => queryClass(cfg, r.query) === k)); return [k, fmt(a.c), signed(delta(a.c, b.c)), fmt(a.i), signed(delta(a.i, b.i)), qc.filter((r) => queryClass(cfg, r.query) === k).length]; }));
if (cfg.targets?.length) {
  const m = new Map(qc.map((r) => [r.query, r])), n = new Map(qp.map((r) => [r.query, r]));
  md += "\n\n## Target queries\n\n" + table(["query", "clicks", "impr", "ctr", "pos", "pos prev"], cfg.targets.map((t) => { const a = m.get(t), b = n.get(t); return [t, a ? a.clicks : 0, a ? a.impressions : 0, a ? pct(a.ctr) : "—", a ? a.position.toFixed(1) : "—", b ? b.position.toFixed(1) : "—"]; }));
}
const pm = new Map(qp.map((r) => [r.query, r]));
const movers = [...qc.map((r) => ({ ...r, d: r.clicks - (pm.get(r.query)?.clicks || 0), pp: pm.get(r.query)?.position })), ...qp.filter((r) => !qc.find((x) => x.query === r.query)).map((r) => ({ ...r, clicks: 0, d: -r.clicks, pp: r.position, position: null }))].sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 15);
md += "\n\n## Biggest query movers (clicks)\n\n" + table(["query", "class", "clicks", "Δ", "pos prev → cur"], movers.map((r) => [r.query, queryClass(cfg, r.query), r.clicks, (r.d >= 0 ? "+" : "") + r.d, `${r.pp ? r.pp.toFixed(1) : "—"} → ${r.position ? r.position.toFixed(1) : "—"}`]));
const ppm = new Map(pp.map((r) => [r.page, r]));
md += "\n\n## Pages\n\n" + table(["page", "clicks", "Δ", "impr", "pos"], pc.sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions).slice(0, 20).map((r) => [short(r.page, cfg), r.clicks, signed(delta(r.clicks, ppm.get(r.page)?.clicks || 0)), r.impressions, r.position.toFixed(1)]));
const newPages = pc.filter((r) => !ppm.has(r.page));
if (newPages.length) md += `\n\nPages with impressions for the first time this week: ${newPages.map((r) => short(r.page, cfg)).join(", ")}.`;
md += "\n\n## Countries\n\n" + table(["country", "clicks", "impr", "pos"], cc.sort((a, b) => b.clicks - a.clicks).slice(0, 10).map((r) => [r.country.toUpperCase(), r.clicks, r.impressions, r.position.toFixed(1)]));
md += "\n\n## Daily clicks\n\n" + table(["date", "clicks", "impr", "pos"], dc.sort((a, b) => a.date.localeCompare(b.date)).map((r) => [r.date, r.clicks, r.impressions, r.position.toFixed(2)]));
if (cfg.ga4Property) {
  const days = await ga4(cfg, { dateRanges: [{ startDate: cur.start, endDate: cur.end }], dimensions: [{ name: "date" }], metrics: [{ name: "activeUsers" }, { name: "sessions" }, { name: "screenPageViews" }], orderBys: [{ dimension: { dimensionName: "date" } }] });
  const ch = await ga4(cfg, { dateRanges: [{ startDate: cur.start, endDate: cur.end }], dimensions: [{ name: "sessionDefaultChannelGroup" }], metrics: [{ name: "sessions" }] });
  md += `\n\n## GA4${cfg.ga4Hostname ? " (" + cfg.ga4Hostname + ")" : ""}\n\n` + table(["date", "users", "sessions", "views"], days.map((r) => [r[0], fmt(r[1]), fmt(r[2]), fmt(r[3])])) + "\n\n" + table(["channel", "sessions"], ch.sort((a, b) => b[1] - a[1]).map((r) => [r[0], fmt(r[1])]));
  if (cfg.keyEvents?.length) { const ev = await ga4(cfg, { dateRanges: [{ startDate: cur.start, endDate: cur.end }], dimensions: [{ name: "eventName" }], metrics: [{ name: "eventCount" }], dimensionFilter: { filter: { fieldName: "eventName", inListFilter: { values: cfg.keyEvents } } } }); md += "\n\nKey events: " + (ev.map((r) => `${r[0]} ${fmt(r[1])}`).join(", ") || "none"); }
}
const cacheDir = path.join(cfg._dir, "cache");
const inspect = fs.existsSync(cacheDir) ? fs.readdirSync(cacheDir).filter((f) => f.startsWith("inspect-")).sort().pop() : null;
if (inspect) { const c = Object.values(JSON.parse(fs.readFileSync(path.join(cacheDir, inspect), "utf8"))); md += `\n\n## Index coverage (${inspect.slice(8, 18)})\n\n${c.filter((r) => r.verdict === "PASS").length}/${c.length} sitemap URLs indexed. Re-run index-status.mjs if older than a week.`; }
if (!args["no-cwv"]) { md += "\n\n## Core Web Vitals (mobile, CrUX p75)\n\n"; const rows = []; for (const u of cfg.cwvUrls?.length ? cfg.cwvUrls : [cfg.site + "/"]) { const r = await pagespeed(cfg, u); rows.push(r.error ? [u, r.error, "", "", ""] : [u, r.field, r.lcpMs ?? "—", r.inpMs ?? "—", r.cls ?? "—"]); } md += table(["url", "field", "LCP", "INP", "CLS"], rows); }
md += "\n\n## Reading\n\n_(to write: what changed and why, checked against seasonality and the change log)_\n\n## Actions (max 3)\n\n1. \n2. \n3. \n";
const out = path.join(cfg._dir, "reports", `${week}${args.host ? "-" + args.host.replace(/[^\w.-]/g, "") : ""}.md`);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, md);
console.error("written " + out);
emit(args, md, { week, cur, prev });
