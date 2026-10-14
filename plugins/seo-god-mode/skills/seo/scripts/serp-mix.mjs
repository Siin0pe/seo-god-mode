// Occupy the SERP. Your domain gets one or two listings on a money query; your brand can take more through
// videos, Reddit and forum threads, LinkedIn/Medium posts and other people's lists. For each query this reads the
// live first page (DataForSEO) and ranks queries by how many of those "non-website" slots exist, then lists:
//   - the subreddits and threads Google already ranks on your keywords (where to answer, as yourself),
//   - the videos ranking (title formats that work),
//   - the third-party lists ranking that don't mention you (placements to earn).
// Usage: node serp-mix.mjs ["query" ...] [--top 10] [--depth 10] [--fresh]
//   Without queries: config "money" keywords + the top non-brand Search Console queries (--top, by impressions).
//   Results are cached per query and day in .seo/cache (re-runs the same day cost nothing; --fresh to refetch).
import fs from "node:fs";
import { parseArgs, loadConfig, dataforseo, gsc, gscObjects, period, queryClass, cachePath, today, regDomainOf, table, short, emit } from "./lib.mjs";

const args = parseArgs();
const cfg = loadConfig(args);
const location_code = Number(args.location || cfg.market?.location || 2840);
const language_code = args.lang || cfg.market?.language || "en";
const host = new URL(cfg.site).host.replace(/^www\./, "");
const regDomain = regDomainOf(host);

let queries = args._.length ? args._ : [...(cfg.money || [])];
if (!args._.length) {
  const win = period(args, 28);
  const rows = gscObjects(await gsc(cfg, { startDate: win.start, endDate: win.end, dimensions: ["query"] }), ["query"]).filter((r) => queryClass(cfg, r.query) !== "brand").sort((a, b) => b.impressions - a.impressions);
  queries.push(...rows.slice(0, Number(args.top || 10)).map((r) => r.query));
}
queries = [...new Set(queries.map((q) => q.trim().toLowerCase()))].filter(Boolean);
if (!queries.length) { console.error('No queries: pass them as arguments or fill "money" in .seo/config.json.'); process.exit(1); }

const PLATFORMS = { reddit: /(^|\.)reddit\.com$/, youtube: /(^|\.)youtube\.com$|youtu\.be$/, tiktok: /tiktok\.com$/, linkedin: /linkedin\.com$/, medium: /medium\.com$/, x: /(^|\.)(x|twitter)\.com$/, quora: /quora\.com$/, facebook: /facebook\.com$/, instagram: /instagram\.com$/, github: /github\.com$/, review: /(trustpilot|g2|capterra|producthunt|trustradius|getapp)\.com$/ };
const platformOf = (domain = "") => Object.keys(PLATFORMS).find((k) => PLATFORMS[k].test(domain.replace(/^www\./, ""))) || "";
const isList = (title = "") => /\b(best|top \d+|top|alternatives?|vs\.?|versus|compared|comparison|review)\b/i.test(title);
const domainOf = (u) => { try { return new URL(u).host.replace(/^www\./, ""); } catch { return ""; } };

let cost = 0;
async function serp(q) {
  const file = cachePath(cfg, `serp-${today()}-${location_code}-${language_code}-${q.replace(/[^\p{L}\p{N}]+/gu, "_").slice(0, 80)}.json`);
  if (!args.fresh && fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  const r = await dataforseo("serp/google/organic/live/advanced", [{ keyword: q, location_code, language_code, depth: Number(args.depth || 10) }]);
  cost += Number(r.cost || 0);
  const items = r.result[0]?.items || [];
  fs.writeFileSync(file, JSON.stringify(items));
  return items;
}

const perQuery = [], threads = [], videos = [], lists = [];
for (const q of queries) {
  const items = await serp(q);
  const slot = { query: q, yours: [], aiOverview: false, video: 0, forum: 0, social: 0, lists: 0 };
  for (const it of items) {
    if (it.type === "ai_overview") slot.aiOverview = true;
    // Blocks that hold several results (video carousel, short videos, discussions and forums, perspectives).
    const subs = Array.isArray(it.items) ? it.items.filter((s) => s && s.url) : [];
    if (/video/.test(it.type)) { slot.video += 1; for (const s of subs) videos.push({ query: q, title: s.title, url: s.url, source: s.source || domainOf(s.url) }); }
    if (/discussions|forums|perspectives/.test(it.type)) { slot.forum += 1; for (const s of subs) threads.push({ query: q, title: s.title, url: s.url, domain: domainOf(s.url) }); }
    if (it.type !== "organic") continue;
    const d = (it.domain || domainOf(it.url)).replace(/^www\./, "");
    if (d === host || d.endsWith("." + regDomain) || d === regDomain) { slot.yours.push(it.rank_group); continue; }
    const p = platformOf(d);
    if (p === "reddit" || p === "quora") { slot.forum += 1; threads.push({ query: q, title: it.title, url: it.url, domain: d }); }
    else if (p === "youtube" || p === "tiktok") { slot.video += 1; videos.push({ query: q, title: it.title, url: it.url, source: d }); }
    else if (p) slot.social += 1;
    else if (isList(it.title)) { slot.lists += 1; lists.push({ query: q, rank: it.rank_group, title: it.title, url: it.url, domain: d }); }
  }
  slot.open = slot.video + slot.forum + slot.social + slot.lists;
  perQuery.push(slot);
}
perQuery.sort((a, b) => b.open - a.open);

const subreddits = new Map();
for (const t of threads) { const m = t.url.match(/reddit\.com\/r\/([^/]+)/i); if (m) { const k = "r/" + m[1]; const v = subreddits.get(k) || { queries: new Set(), urls: [] }; v.queries.add(t.query); v.urls.push(t.url); subreddits.set(k, v); } }

let md = `## SERP mix — ${queries.length} queries (loc ${location_code}, ${language_code})${cost ? `, cost $${cost.toFixed(4)}` : ", from today's cache"}\n\nOn a money query your domain gets one or two listings at most. "Open slots" are results you can occupy without ranking your own site: videos, Reddit/forum threads, posts on platforms (LinkedIn, Medium, X, review sites) and third-party lists. Prioritise queries by open slots, not only by volume.\n\n`;
md += table(["query", "your position(s)", "AI Overview", "video", "forums", "platforms", "lists", "open slots"], perQuery.map((s) => [s.query, s.yours.join(", ") || "—", s.aiOverview ? "yes" : "", s.video, s.forum, s.social, s.lists, s.open]));
md += `\n\n### Subreddits Google ranks on your queries\n\nAnswer there as yourself: say who you are in the first line, answer properly including where your product is the wrong choice, one thread every 2-3 days, account warmed up first. Check the engine your buyers use before investing (Reddit's share of AI citations varies a lot by engine and month, see references/geo.md).\n\n`;
md += subreddits.size ? table(["subreddit", "queries", "threads"], [...subreddits].sort((a, b) => b[1].queries.size - a[1].queries.size).map(([k, v]) => [k, [...v.queries].join("; "), v.urls.slice(0, 3).join(" ")])) : "_No Reddit thread on these first pages._";
const otherThreads = threads.filter((t) => !/reddit\.com/i.test(t.url));
if (otherThreads.length) md += "\n\nOther forums and discussions:\n\n" + table(["query", "thread", "url"], otherThreads.slice(0, 20).map((t) => [t.query, t.title || t.domain, t.url]));
md += `\n\n### Videos ranking\n\nOne video per money keyword is indexed twice (YouTube and Google). Review-query title shape that ranks: "{Tool} Review {Year}: Features, Pricing & Alternatives". The description is what Google indexes: 200+ words, the query answered in the first two lines. Cut 3 Shorts per video for 3 different queries, and reuse them on TikTok with captions written the way people search there.\n\n`;
md += videos.length ? table(["query", "title", "source", "url"], videos.slice(0, 25).map((v) => [v.query, v.title, v.source, v.url])) : "_No video results on these first pages._";
md += `\n\n### Third-party lists ranking without you\n\nThe pages AI assistants read when someone asks for a recommendation. Ask to be added (commands.md#outreach): prefer lists updated in the last 12 months that already include a competitor. Your own LinkedIn or X post whose first line is the exact query can also rank.\n\n`;
md += lists.length ? table(["query", "rank", "domain", "title", "url"], lists.slice(0, 30).map((l) => [l.query, l.rank, l.domain, l.title, l.url])) : "_None found._";
emit(args, md, { queries: perQuery, subreddits: Object.fromEntries([...subreddits].map(([k, v]) => [k, { queries: [...v.queries], urls: v.urls }])), threads, videos, lists, cost });
