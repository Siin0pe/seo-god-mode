// Market data through DataForSEO (optional, paid per request; every call prints its cost).
// Subcommands:
//   volume   "<kw1>" "<kw2>" ...            search volume, CPC, competition (Google Ads data)
//   ideas    "<seed>" [--limit 100]          related keywords with volume and difficulty (Labs)
//   serp     "<keyword>" [--depth 10]        live organic SERP: ranks, URLs, titles, SERP features (AI Overview…)
//   ranked   <domain> [--limit 100]          keywords a domain ranks for (competitor or your own)
//   gap      <yourdomain> <competitor>        keywords the competitor ranks top 20 for and you don't
//   backlinks <domain|url> [--limit 50]      referring domains (needs the Backlinks API subscription)
// Common options: --location 2840 (US; 2826 UK, 2250 FR, 2784 AE, 2364 IR, 2392 JP) --lang en --json --out file
// Defaults come from config "market": {"location": 2840, "language": "en"}.
import { parseArgs, loadConfig, dataforseo, table, fmt, emit } from "./lib.mjs";

const args = parseArgs();
const cfg = loadConfig(args, { optional: true });
const [cmd, ...rest] = args._;
const location_code = Number(args.location || cfg.market?.location || 2840);
const language_code = args.lang || cfg.market?.language || "en";
const limit = Number(args.limit || 100);
const kd = (x) => (x == null ? "—" : x);
let md = "", data;

if (cmd === "volume") {
  const { cost, result } = await dataforseo("keywords_data/google_ads/search_volume/live", [{ keywords: rest, location_code, language_code }]);
  data = result;
  md = `## Search volume (loc ${location_code}, ${language_code}) — cost $${cost}\n\n` + table(["keyword", "volume/mo", "cpc", "competition", "trend (last 3 months)"], result.sort((a, b) => (b.search_volume || 0) - (a.search_volume || 0)).map((r) => [r.keyword, fmt(r.search_volume), r.cpc ?? "—", r.competition ?? "—", (r.monthly_searches || []).slice(0, 3).map((m) => m.search_volume).join(" / ")]));
} else if (cmd === "ideas") {
  const { cost, result } = await dataforseo("dataforseo_labs/google/keyword_ideas/live", [{ keywords: rest, location_code, language_code, limit, include_serp_info: false }]);
  const items = result[0]?.items || [];
  data = items;
  md = `## Keyword ideas for ${rest.join(", ")} — cost $${cost}\n\n` + table(["keyword", "volume", "KD", "intent", "cpc"], items.map((i) => [i.keyword, fmt(i.keyword_info?.search_volume), kd(i.keyword_properties?.keyword_difficulty), i.search_intent_info?.main_intent || "—", i.keyword_info?.cpc ?? "—"]));
} else if (cmd === "serp") {
  const { cost, result } = await dataforseo("serp/google/organic/live/advanced", [{ keyword: rest.join(" "), location_code, language_code, depth: Number(args.depth || 10) }]);
  const items = result[0]?.items || [];
  data = items;
  const features = [...new Set(items.map((i) => i.type).filter((t) => t !== "organic"))];
  md = `## Live SERP "${rest.join(" ")}" (loc ${location_code}) — cost $${cost}\n\nSERP features present: ${features.join(", ") || "none"}. Read the result types: listicles/blogs = informational, product/service/category pages with prices = commercial.\n\n` + table(["rank", "type", "domain", "title", "url"], items.filter((i) => i.type === "organic").map((i) => [i.rank_absolute, i.type, i.domain, i.title, i.url]));
} else if (cmd === "ranked") {
  const { cost, result } = await dataforseo("dataforseo_labs/google/ranked_keywords/live", [{ target: rest[0], location_code, language_code, limit, order_by: ["keyword_data.keyword_info.search_volume,desc"] }]);
  const items = result[0]?.items || [];
  data = items;
  md = `## Keywords ranked by ${rest[0]} — cost $${cost}\n\n` + table(["keyword", "volume", "pos", "url"], items.map((i) => [i.keyword_data?.keyword, fmt(i.keyword_data?.keyword_info?.search_volume), i.ranked_serp_element?.serp_item?.rank_absolute, i.ranked_serp_element?.serp_item?.url]));
} else if (cmd === "gap") {
  const [mine, comp] = rest;
  const { cost, result } = await dataforseo("dataforseo_labs/google/domain_intersection/live", [{ target1: comp, target2: mine, location_code, language_code, intersections: false, limit, order_by: ["keyword_data.keyword_info.search_volume,desc"], filters: [["first_domain_serp_element.rank_absolute", "<=", 20]] }]);
  const items = result[0]?.items || [];
  data = items;
  md = `## Gap: ${comp} ranks top 20, ${mine} does not — cost $${cost}\n\n` + table(["keyword", "volume", "their pos", "their url"], items.map((i) => [i.keyword_data?.keyword, fmt(i.keyword_data?.keyword_info?.search_volume), i.first_domain_serp_element?.rank_absolute, i.first_domain_serp_element?.url]));
} else if (cmd === "backlinks") {
  const { cost, result } = await dataforseo("backlinks/referring_domains/live", [{ target: rest[0], limit, order_by: ["rank,desc"] }]);
  const items = result[0]?.items || [];
  data = items;
  md = `## Referring domains of ${rest[0]} — cost $${cost}\n\n` + table(["domain", "rank", "backlinks", "dofollow", "first seen"], items.map((i) => [i.domain, i.rank, i.backlinks, i.referring_links_attributes?.nofollow != null ? i.backlinks - i.referring_links_attributes.nofollow : "—", i.first_seen?.slice(0, 10)]));
} else {
  console.log("usage: keywords.mjs volume|ideas|serp|ranked|gap|backlinks ...  (see header)");
  process.exit(1);
}
emit(args, md, data);
