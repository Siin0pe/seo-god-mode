// Bing Webmaster Tools data (optional). Bing matters beyond Bing: some AI assistants retrieve through it.
// Usage: node bing.mjs queries|pages [--limit 50] [--json]      needs BING_WMT_API_KEY, site verified in Bing WMT
import { parseArgs, loadConfig, missing, table, fmt, emit } from "./lib.mjs";

const args = parseArgs();
const cfg = loadConfig(args);
const key = process.env.BING_WMT_API_KEY;
if (!key) missing("Bing Webmaster API key", "Bing Webmaster Tools → Settings → API access → generate a key, then set BING_WMT_API_KEY.");
const method = args._[0] === "pages" ? "GetPageStats" : "GetQueryStats";
const r = await fetch(`https://ssl.bing.com/webmaster/api.svc/json/${method}?siteUrl=${encodeURIComponent(cfg.site + "/")}&apikey=${key}`);
if (!r.ok) { console.error(`Bing API HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`); process.exit(1); }
const rows = (await r.json()).d || [];
// The API returns weekly rows per item; aggregate them.
const agg = new Map();
for (const x of rows) { const k = x.Query; const v = agg.get(k) || { k, clicks: 0, impr: 0, posW: 0 }; v.clicks += x.Clicks; v.impr += x.Impressions; v.posW += (x.AvgImpressionPosition || 0) * x.Impressions; agg.set(k, v); }
const list = [...agg.values()].sort((a, b) => b.clicks - a.clicks || b.impr - a.impr).slice(0, Number(args.limit || 50));
emit(args, `## Bing ${method === "GetPageStats" ? "pages" : "queries"} (all data the API returns, aggregated)\n\n` + table([method === "GetPageStats" ? "page" : "query", "clicks", "impr", "avg pos"], list.map((v) => [v.k, fmt(v.clicks), fmt(v.impr), v.impr ? (v.posW / v.impr).toFixed(1) : "—"])), list);
