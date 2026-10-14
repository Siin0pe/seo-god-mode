// Core Web Vitals: CrUX field data (p75, the thing Google uses) plus a Lighthouse lab run, via PageSpeed Insights.
// With --history: the weekly CrUX p75 over the last N weeks (CrUX History API, max 40) for each URL and the
// origin, so a regression has a date: compare it with the change log and with drop.mjs.
// Usage: node cwv.mjs [url ...] [--strategy mobile|desktop] [--json]   (defaults: config "cwvUrls" or the home page)
//        node cwv.mjs --history [url ...] [--weeks 40] [--strategy mobile|desktop] [--json]
import { parseArgs, loadConfig, pagespeed, cruxHistory, cwvTrend, CWV_GOOD, table, emit } from "./lib.mjs";

const args = parseArgs();
const cfg = loadConfig(args);
// "--history <url>" reads the URL as the flag's value: keep it as a URL.
const given = [...(typeof args.history === "string" ? [args.history] : []), ...args._];
const urls = given.length ? given : cfg.cwvUrls?.length ? cfg.cwvUrls : [cfg.site + "/"];
const strategy = args.strategy || "mobile";

if (args.history) {
  const formFactor = strategy === "desktop" ? "DESKTOP" : "PHONE";
  const weeks = Math.min(40, Math.max(1, Number(args.weeks || 40)));
  const targets = [{ label: "origin", target: cfg.site, origin: true }, ...urls.map((u) => ({ label: u, target: u, origin: false }))];
  const res = [];
  for (const t of targets) res.push({ label: t.label, ...(await cruxHistory(cfg, t.target, { origin: t.origin, formFactor, weeks })) });
  const fmtV = (k, v) => (v == null ? "—" : k === "cls" ? v.toFixed(2) : Math.round(v) + " ms");
  const mark = (k, v) => (v == null ? "" : v <= CWV_GOOD[k] ? " ✓" : " ✗");
  const rows = [];
  for (const r of res) {
    if (r.error) { rows.push([r.label, r.error, "", "", "", ""]); continue; }
    const tr = cwvTrend(r);
    for (const k of ["lcp", "inp", "cls", "ttfb"]) {
      const t = tr[k];
      if (t.latest == null && t.w12 == null) continue;
      rows.push([r.label, k.toUpperCase(), fmtV(k, t.latest) + mark(k, t.latest), fmtV(k, t.w4), fmtV(k, t.w12), t.crossed ? `${t.crossed.to} in the week to ${t.crossed.week}` : ""]);
    }
  }
  const last = res.find((r) => r.weeks?.length)?.weeks.at(-1);
  const md = `## Core Web Vitals history (${strategy}, CrUX p75)${last ? ` — latest period ends ${last}` : ""}\n\nEach weekly point is the p75 of the 28 days before it, so a regression shows up over 4 weeks, not at once. "Good" = LCP ≤${CWV_GOOD.lcp} ms, INP ≤${CWV_GOOD.inp} ms, CLS ≤${CWV_GOOD.cls}, TTFB ≤${CWV_GOOD.ttfb} ms. URLs without enough Chrome traffic have no data: the origin row still applies to them.\n\n` +
    table(["target", "metric", "now", "4 weeks ago", "12 weeks ago", "last threshold crossing"], rows);
  emit(args, md, res);
} else {
  const res = [];
  for (const u of urls) res.push(await pagespeed(cfg, u, strategy));
  const ok = (v, good, poor) => (v == null ? "—" : v <= good ? `${v} ✓` : v <= poor ? `${v} ~` : `${v} ✗`);
  const md = `## Core Web Vitals (${strategy}) — thresholds: LCP ≤2500 ms, INP ≤200 ms, CLS ≤0.1\n\nField = CrUX p75 over 28 days (needs enough Chrome traffic; "NO_FIELD_DATA" is normal for small or new sites). Lab = one Lighthouse run, noisy, use it to find causes not to judge. For the trend over time: --history.\n\n` +
    table(["url", "field (url / origin)", "LCP", "INP", "CLS", "TTFB", "lab score", "lab LCP", "lab CLS"], res.map((r) => (r.error ? [r.url, r.error, "", "", "", "", "", "", ""] : [r.url, `${r.field} / ${r.origin}`, ok(r.lcpMs, 2500, 4000), ok(r.inpMs, 200, 500), ok(r.cls, 0.1, 0.25), r.ttfbMs ?? "—", r.labScore, r.labLcpMs, r.labCls?.toFixed(3)])));
  emit(args, md, res);
}
