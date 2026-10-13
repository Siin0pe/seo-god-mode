// Core Web Vitals: CrUX field data (p75, the thing Google uses) plus a Lighthouse lab run, via PageSpeed Insights.
// Usage: node cwv.mjs [url ...] [--strategy mobile|desktop] [--json]   (defaults: config "cwvUrls" or the home page)
import { parseArgs, loadConfig, pagespeed, table, emit } from "./lib.mjs";

const args = parseArgs();
const cfg = loadConfig(args);
const urls = args._.length ? args._ : cfg.cwvUrls?.length ? cfg.cwvUrls : [cfg.site + "/"];
const res = [];
for (const u of urls) res.push(await pagespeed(cfg, u, args.strategy || "mobile"));
const ok = (v, good, poor) => (v == null ? "—" : v <= good ? `${v} ✓` : v <= poor ? `${v} ~` : `${v} ✗`);
const md = `## Core Web Vitals (${args.strategy || "mobile"}) — thresholds: LCP ≤2500 ms, INP ≤200 ms, CLS ≤0.1\n\nField = CrUX p75 over 28 days (needs enough Chrome traffic; "NO_FIELD_DATA" is normal for small or new sites). Lab = one Lighthouse run, noisy, use it to find causes not to judge.\n\n` +
  table(["url", "field (url / origin)", "LCP", "INP", "CLS", "TTFB", "lab score", "lab LCP", "lab CLS"], res.map((r) => (r.error ? [r.url, r.error, "", "", "", "", "", "", ""] : [r.url, `${r.field} / ${r.origin}`, ok(r.lcpMs, 2500, 4000), ok(r.inpMs, 200, 500), ok(r.cls, 0.1, 0.25), r.ttfbMs ?? "—", r.labScore, r.labLcpMs, r.labCls?.toFixed(3)])));
emit(args, md, res);
