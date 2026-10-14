// Google Business Profile data (optional): the map-pack side of local SEO, from Google's own APIs.
// Usage: node gbp.mjs locations                         accounts and locations you manage; marks the site's own
//        node gbp.mjs performance [--days 28] [--daily] impressions Search/Maps x mobile/desktop, calls, website
//                                                       clicks, directions, bookings vs the previous period
//        node gbp.mjs keywords [--months 3] [--limit 50] searches that showed the profile (monthly, "<N" = fewer than N)
//        node gbp.mjs reviews [--limit 50]              rating, star mix, share replied, latest reviews without a reply
//        --location locations/123 [--account accounts/456] override config "gbp" (one location per project)
// Needs Business Profile API access approved by Google, OAuth set up once with gbp-auth.mjs and GBP_OAUTH set.
// Performance data lags: the default window ends 3 days ago.
import { parseArgs, loadConfig, die, gbpToken, gbpFetch, gbpSeries, gbpTotals, gbpKeywordValue, gbpReviewStats, gbpDateParams, gbpMonths, period, previousWindow, addDays, today, table, fmt, pct, delta, signed, emit } from "./lib.mjs";

const args = parseArgs();
const cfg = loadConfig(args, { optional: true });
const cmd = args._[0];
if (!["locations", "performance", "keywords", "reviews"].includes(cmd)) die("Usage: node gbp.mjs locations|performance|keywords|reviews [--location locations/123] (see --help)");
await gbpToken(cfg); // fail fast with the setup steps
const AM = "https://mybusinessaccountmanagement.googleapis.com/v1", BI = "https://mybusinessbusinessinformation.googleapis.com/v1", PERF = "https://businessprofileperformance.googleapis.com/v1";
const opt = (v) => (v && v !== true ? String(v) : "");
const norm = (v, kind) => (v && !v.startsWith(kind + "/") ? `${kind}/${v}` : v);
const location = norm(opt(args.location) || cfg.gbp?.location || "", "locations");
const hostOf = (u) => { try { return new URL(u).host.toLowerCase().replace(/^www\./, ""); } catch { return ""; } };

async function pages(url, key, max = 20) {
  const all = [];
  let token = "";
  for (let i = 0; i < max; i++) {
    const j = await gbpFetch(cfg, url + (token ? `&pageToken=${encodeURIComponent(token)}` : ""));
    all.push(...(j[key] || []));
    if (!(token = j.nextPageToken)) break;
  }
  return all;
}
async function allLocations() {
  const accounts = await pages(`${AM}/accounts?pageSize=20`, "accounts");
  const rows = [];
  for (const a of accounts) for (const l of await pages(`${BI}/${a.name}/locations?readMask=name,title,storefrontAddress,websiteUri&pageSize=100`, "locations")) rows.push({ ...l, account: a.name, accountName: a.accountName });
  return { accounts, rows };
}
function needLocation() {
  if (!location) die('No location: set "gbp": {"account": "accounts/..", "location": "locations/.."} in .seo/config.json (ids from `node gbp.mjs locations`) or pass --location locations/123.');
  return location;
}

if (cmd === "locations") {
  const { accounts, rows } = await allLocations();
  const site = hostOf(cfg.site || "");
  for (const r of rows) r.match = !!site && hostOf(r.websiteUri || "") === site;
  const md = `## Business Profile locations (${rows.length} in ${accounts.length} account(s))\n\n` + (rows.length ? table(["", "title", "location", "account", "website", "city"], rows.map((r) => [r.match ? "★ site" : r.name === location ? "config" : "", r.title, r.name, `${r.account}${r.accountName ? ` (${r.accountName})` : ""}`, r.websiteUri || "—", r.storefrontAddress?.locality || "—"])) : "No location visible to this Google account (it must own or manage the profile).") +
    `\n\nSet the project's location in .seo/config.json: "gbp": {"account": "accounts/…", "location": "locations/…"}` + (rows.some((r) => r.match) ? " (★ = website matches the config site)." : site ? `. No location links to ${site}.` : ".");
  emit(args, md, rows);
} else if (cmd === "performance") {
  const loc = needLocation();
  const cur = period(args, 28), prev = previousWindow(cur);
  const METRICS = ["BUSINESS_IMPRESSIONS_DESKTOP_MAPS", "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH", "BUSINESS_IMPRESSIONS_MOBILE_MAPS", "BUSINESS_IMPRESSIONS_MOBILE_SEARCH", "BUSINESS_DIRECTION_REQUESTS", "CALL_CLICKS", "WEBSITE_CLICKS", "BUSINESS_BOOKINGS", "BUSINESS_FOOD_MENU_CLICKS"];
  // One call covers both periods; zero days are absent from the response and count as 0.
  const series = gbpSeries(await gbpFetch(cfg, `${PERF}/${loc}:fetchMultiDailyMetricsTimeSeries?${METRICS.map((m) => "dailyMetrics=" + m).join("&")}&${gbpDateParams("dailyRange.start_date", prev.start)}&${gbpDateParams("dailyRange.end_date", cur.end)}`));
  const a = gbpTotals(series, cur.start, cur.end), b = gbpTotals(series, prev.start, prev.end);
  const sum = (t, ...ks) => ks.reduce((s, k) => s + (t[k] || 0), 0);
  const I = "BUSINESS_IMPRESSIONS_";
  const lines = [
    ["Impressions, total", [`${I}DESKTOP_MAPS`, `${I}DESKTOP_SEARCH`, `${I}MOBILE_MAPS`, `${I}MOBILE_SEARCH`]],
    ["  on Search", [`${I}DESKTOP_SEARCH`, `${I}MOBILE_SEARCH`]], ["  on Maps", [`${I}DESKTOP_MAPS`, `${I}MOBILE_MAPS`]],
    ["  mobile", [`${I}MOBILE_MAPS`, `${I}MOBILE_SEARCH`]], ["  desktop", [`${I}DESKTOP_MAPS`, `${I}DESKTOP_SEARCH`]],
    ["Calls", ["CALL_CLICKS"]], ["Website clicks", ["WEBSITE_CLICKS"]], ["Direction requests", ["BUSINESS_DIRECTION_REQUESTS"]], ["Bookings", ["BUSINESS_BOOKINGS"]], ["Food menu clicks", ["BUSINESS_FOOD_MENU_CLICKS"]],
  ].map(([label, ks]) => ({ label: label.trim(), cur: sum(a, ...ks), prev: sum(b, ...ks), indent: label.startsWith(" ") }));
  const shown = lines.filter((l) => l.cur || l.prev || !["Bookings", "Food menu clicks"].includes(l.label));
  const impr = lines[0].cur, actions = lines.slice(5).reduce((s, l) => s + l.cur, 0);
  let md = `## Business Profile performance, ${loc}: ${cur.start} → ${cur.end} vs ${prev.start} → ${prev.end}\n\n` +
    table(["metric", "current", "previous", "change"], shown.map((l) => [(l.indent ? "  ↳ " : "") + l.label, fmt(l.cur), fmt(l.prev), signed(delta(l.cur, l.prev))])) +
    `\n\nActions per 100 impressions: ${impr ? ((actions / impr) * 100).toFixed(1) : "—"}. Impressions are unique users per day and platform; calls, clicks and directions are taps, not conversions.`;
  if (args.daily) {
    const at = (k, d) => series[k]?.find((x) => x.date === d)?.value || 0;
    const days = [];
    for (let d = cur.start; d <= cur.end; d = addDays(d, 1)) days.push(d);
    md += "\n\n" + table(["date", "search", "maps", "calls", "website", "directions"], days.map((d) => [d, fmt(at(`${I}DESKTOP_SEARCH`, d) + at(`${I}MOBILE_SEARCH`, d)), fmt(at(`${I}DESKTOP_MAPS`, d) + at(`${I}MOBILE_MAPS`, d)), fmt(at("CALL_CLICKS", d)), fmt(at("WEBSITE_CLICKS", d)), fmt(at("BUSINESS_DIRECTION_REQUESTS", d))]));
  }
  emit(args, md, { location: loc, current: { ...cur, totals: a }, previous: { ...prev, totals: b }, series });
} else if (cmd === "keywords") {
  const loc = needLocation();
  const months = Math.max(1, Number(args.months || 3));
  const { start, end } = gbpMonths(months, today());
  // Param casing follows the documented daily form (dailyRange.start_date.year): snake_case sub-fields.
  const q = `monthlyRange.start_month.year=${start.year}&monthlyRange.start_month.month=${start.month}&monthlyRange.end_month.year=${end.year}&monthlyRange.end_month.month=${end.month}`;
  const rows = (await pages(`${PERF}/${loc}/searchkeywords/impressions/monthly?${q}&pageSize=100`, "searchKeywordsCounts")).map((r) => ({ keyword: r.searchKeyword, ...gbpKeywordValue(r.insightsValue) }));
  rows.sort((x, y) => (y.value ?? 0) - (x.value ?? 0) || (y.below ?? 0) - (x.below ?? 0) || x.keyword.localeCompare(y.keyword));
  const list = rows.slice(0, Number(args.limit || 50));
  const ym = (m) => `${m.year}-${String(m.month).padStart(2, "0")}`;
  const md = `## Searches that showed the profile, ${ym(start)} → ${ym(end)} (${rows.length} keywords, top ${list.length})\n\n` + table(["keyword", "impressions"], list.map((r) => [r.keyword, r.value != null ? fmt(r.value) : r.below != null ? `<${fmt(r.below)}` : "—"])) +
    "\n\nMonthly, complete months only. \"<N\" = fewer than N (Google hides small counts). Compare with Search Console queries: terms here but not there are content and category gaps on the site.";
  emit(args, md, rows);
} else {
  const loc = needLocation();
  let account = norm(opt(args.account) || cfg.gbp?.account || "", "accounts");
  // --location without --account: find the owning account (one listing pass).
  if (!account || (opt(args.location) && !opt(args.account))) account = (await allLocations()).rows.find((r) => r.name === loc)?.account || account;
  if (!account) die(`Account of ${loc} not found: pass --account accounts/… (from gbp.mjs locations).`);
  const limit = Math.max(1, Number(args.limit || 50));
  const base = `https://mybusiness.googleapis.com/v4/${account}/${loc}/reviews?pageSize=50&orderBy=updateTime%20desc`;
  const reviews = [];
  let first = null, token = "";
  do {
    const j = await gbpFetch(cfg, base + (token ? `&pageToken=${encodeURIComponent(token)}` : ""));
    first ||= j;
    reviews.push(...(j.reviews || []));
    token = j.nextPageToken;
  } while (token && reviews.length < limit);
  const s = gbpReviewStats(reviews.slice(0, limit));
  const md = `## Reviews, ${loc}\n\nAverage rating ${first.averageRating != null ? first.averageRating.toFixed(2) : "—"} over ${fmt(first.totalReviewCount ?? 0)} reviews. Over the latest ${s.count}: ${s.replied != null ? pct(s.replied, 0) : "—"} replied.\n\n` +
    table(["stars", "reviews", "share"], [5, 4, 3, 2, 1].map((k) => ["★".repeat(k), s.dist[k], s.count ? pct(s.dist[k] / s.count, 0) : "—"])) +
    `\n\n### Latest without a reply (${s.unanswered.length})\n\n` + (s.unanswered.length ? table(["date", "stars", "review"], s.unanswered.slice(0, 10).map((r) => [(r.updateTime || r.createTime || "").slice(0, 10), r.stars ?? "—", (r.comment || "(rating only)").replace(/\s+/g, " ").slice(0, 120)])) : "None: every recent review has a reply.") +
    "\n\nReplies are the owner's to write and post; draft them on request.";
  emit(args, md, { location: loc, account, averageRating: first.averageRating, totalReviewCount: first.totalReviewCount, ...s });
}
