// GEO (AI search visibility) helpers. No API reproduces what a logged-out user sees in ChatGPT, so citation
// checks stay manual and get logged here; this script builds the query set and keeps the history honest.
// Subcommands:
//   queries                       fan-out query set from config "money" keywords: best/top + year + market,
//                                 "<brand> review", "<competitor> alternative", comparisons
//   prospects [--top 10]          (DataForSEO) for each fan-out query, the listicles/pages ranking top 10:
//                                 the pages AI assistants are likely to read, i.e. the placements to earn
//   log --engine chatgpt --prompt "..." --cited yes|no [--sources url,url] [--note "..."]
//   report                        cited share per engine and per month from .seo/geo-log.jsonl
import fs from "node:fs";
import path from "node:path";
import { parseArgs, loadConfig, dataforseo, dataforseoAuth, table, today, emit } from "./lib.mjs";

const args = parseArgs();
const cfg = loadConfig(args);
const [cmd] = args._;
const logFile = path.join(cfg._dir, "geo-log.jsonl");
const year = new Date().getFullYear();
const money = cfg.money || cfg.targets || [];
const brand = cfg.brandName || "";
const comps = cfg.competitors || [];

function fanout() {
  const qs = new Set();
  for (const k of money) { qs.add(`best ${k} ${year}`); qs.add(`best ${k}`); qs.add(`top ${k}`); if (cfg.marketName) qs.add(`best ${k} ${cfg.marketName}`); }
  if (brand) { qs.add(`${brand} review`); qs.add(`is ${brand} safe`); qs.add(`${brand} alternative`); }
  for (const c of comps) { qs.add(`${c} alternative`); qs.add(`${c} alternatives ${year}`); if (brand) qs.add(`${brand} vs ${c}`); }
  return [...qs];
}
if (cmd === "queries") {
  const qs = fanout();
  emit(args, `## Fan-out query set (${qs.length})\n\nAssistants rewrite a conversation into 2-5 short search queries; these shapes recur ("best X year", "X review", "alternative to X"). Check which pages rank for them: those are what the model reads. Translate to each market's language too.\n\n${qs.map((q) => `- ${q}`).join("\n")}`, qs);
} else if (cmd === "prospects") {
  if (!dataforseoAuth()) { console.log("DataForSEO not configured: run the queries by hand (logged-out Google, incognito) and note the listicles in the top 10."); process.exit(2); }
  const qs = fanout().slice(0, Number(args.max || 15));
  const rows = [];
  let cost = 0;
  for (const q of qs) {
    const r = await dataforseo("serp/google/organic/live/advanced", [{ keyword: q, location_code: Number(cfg.market?.location || 2840), language_code: cfg.market?.language || "en", depth: Number(args.top || 10) }]);
    cost += r.cost;
    for (const i of (r.result[0]?.items || []).filter((x) => x.type === "organic")) rows.push([q, i.rank_absolute, i.domain, i.title, i.url, (cfg.hostFilter && i.url.includes(cfg.hostFilter)) ? "YOU" : comps.some((c) => i.domain.includes(c)) ? "competitor" : ""]);
  }
  emit(args, `## GEO prospects — pages ranking for fan-out queries (cost $${cost.toFixed(4)})\n\nListicles and comparisons by third parties are the placements to earn (ask to be added when the list is recent, ranks, and already includes a competitor). Your own pages ranking here are what keeps you citable.\n\n` + table(["query", "rank", "domain", "title", "url", "who"], rows), rows);
} else if (cmd === "log") {
  const e = { date: today(), engine: args.engine, prompt: args.prompt, cited: String(args.cited).startsWith("y"), sources: args.sources ? String(args.sources).split(",") : [], note: args.note || "" };
  if (!e.engine || !e.prompt) throw new Error("need --engine and --prompt");
  fs.appendFileSync(logFile, JSON.stringify(e) + "\n");
  console.log("logged to " + logFile);
} else if (cmd === "report") {
  const rows = fs.existsSync(logFile) ? fs.readFileSync(logFile, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
  const g = new Map();
  for (const r of rows) { const k = `${r.date.slice(0, 7)} ${r.engine}`; const v = g.get(k) || { n: 0, c: 0 }; v.n++; v.c += r.cited ? 1 : 0; g.set(k, v); }
  const src = new Map();
  for (const r of rows) for (const s of r.sources) { try { const d = new URL(s).host; src.set(d, (src.get(d) || 0) + 1); } catch {} }
  emit(args, `## GEO citation log (${rows.length} manual checks)\n\n` + table(["month engine", "checks", "cited", "share"], [...g].sort().map(([k, v]) => [k, v.n, v.c, `${Math.round((100 * v.c) / v.n)}%`])) + "\n\n### Domains the engines cited\n\n" + table(["domain", "times"], [...src].sort((a, b) => b[1] - a[1]).slice(0, 25)), { rows });
} else {
  console.log("usage: geo.mjs queries | prospects | log --engine --prompt --cited | report");
  process.exit(1);
}
