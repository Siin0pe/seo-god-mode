// One-shot setup: finds the Google service account key, discovers the Search Console property and the GA4
// property that cover the site, the sitemap, the brand and the main market, then writes .seo/ (config.json,
// standards.md, log.md, .gitignore) and runs doctor. Safe to re-run: it only fills fields that are still empty,
// except those passed explicitly (--gsc, --ga4, --sitemap, --brand, --sa), which replace the saved value.
// Also detects the host (Cloudflare, Vercel) for crawler visits: with CLOUDFLARE_API_TOKEN set it finds the zone.
// Usage: node setup.mjs --site https://example.com [--sa path/to/key.json] [--gsc sc-domain:example.com]
//        [--ga4 123456] [--sitemap url] [--brand "acme|akme"] [--cf-zone <zone id>] [--logs <file|dir>] [--no-doctor]
// Exit codes: 0 ready, 3 ready with something left for the owner to do (printed under "To do").
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseArgs, googleToken, apiJson, fetchText, addDays, lastFinalDay, regDomainOf, hostPattern } from "./lib.mjs";

const a = parseArgs();
const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(process.cwd(), ".seo");
const cfgFile = path.join(dir, "config.json");
const prev = fs.existsSync(cfgFile) ? JSON.parse(fs.readFileSync(cfgFile, "utf8")) : {};
const todo = [], optional = [];
const say = (ok, what, detail) => console.log(`${ok === true ? "OK  " : ok === false ? "TODO" : "--  "} ${what.padEnd(22)} ${detail}`);

if (Number(process.versions.node.split(".")[0]) < 18) { console.error(`Node 18+ is required (found ${process.versions.node}).`); process.exit(1); }
const siteArg = a.site || prev.site;
if (!siteArg || siteArg === true) { console.error("Usage: node setup.mjs --site https://example.com  (the canonical origin of the site)"); process.exit(1); }
const site = String(siteArg).replace(/\/$/, "");
const host = new URL(site).host;
// example.co.uk → example.co.uk, blog.example.com → example.com
const regDomain = regDomainOf(host);
const sameOrSub = (h, d) => h === d || h.endsWith("." + d);
const brandWord = regDomain.split(".")[0];
console.log(`Setting up ${site}\n`);

// ---------- Service account key ----------
function findKey() {
  for (const p of [a.sa, process.env.SEO_SA_KEY, process.env.GOOGLE_APPLICATION_CREDENTIALS, prev.credentials?.serviceAccountKey]) if (p && p !== true && fs.existsSync(p)) return p;
  // Common places people keep keys. Only the "type" field is checked; nothing is read beyond the file itself.
  for (const d of [path.join(os.homedir(), ".config"), path.join(os.homedir(), ".seo"), path.join(os.homedir(), ".google")]) {
    let files = [];
    try { files = fs.readdirSync(d).filter((f) => f.endsWith(".json")); } catch { continue; }
    for (const f of files) {
      try { const j = JSON.parse(fs.readFileSync(path.join(d, f), "utf8")); if (j.type === "service_account" && j.private_key) return path.join(d, f); } catch {}
    }
  }
  return "";
}
const keyPath = findKey();
let email = "";
if (keyPath) { email = JSON.parse(fs.readFileSync(keyPath, "utf8")).client_email; say(true, "Service account", `${email} (${keyPath})`); }
else {
  say(false, "Service account", "no key found");
  todo.push(`Create a Google service account key (5 minutes, free) and re-run with --sa <path>:
     1. https://console.cloud.google.com/projectcreate (or pick a project)
     2. Enable: https://console.cloud.google.com/apis/library/searchconsole.googleapis.com
                https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com
                https://console.cloud.google.com/apis/library/analyticsadmin.googleapis.com
                https://console.cloud.google.com/apis/library/pagespeedonline.googleapis.com
                https://console.cloud.google.com/apis/library/chromeuxreport.googleapis.com
     3. https://console.cloud.google.com/iam-admin/serviceaccounts → Create → Keys → Add key → JSON
     4. Save it outside any repo, e.g. ${path.join(os.homedir(), ".config", "google-sa-seo.json")}`);
}
const cfg = { credentials: { serviceAccountKey: keyPath } };
const api = async (url, scope, body) => {
  const t = await googleToken(cfg, [scope]);
  return apiJson(url, { method: body ? "POST" : "GET", headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
};
const GSC = "https://www.googleapis.com/auth/webmasters.readonly";
const GA = "https://www.googleapis.com/auth/analytics.readonly";

// ---------- Search Console ----------
let gscProperty = a.gsc || prev.gscProperty || "";
let topQueries = [], topPages = [], topCountry = "";
if (keyPath) {
  const r = await api("https://www.googleapis.com/webmasters/v3/sites", GSC);
  const sites = (r.siteEntry || []).filter((s) => s.permissionLevel !== "siteUnverifiedUser").map((s) => s.siteUrl);
  const covers = (p) => (p.startsWith("sc-domain:") ? sameOrSub(host, p.slice(10)) : (site + "/").startsWith(p.replace(/\/?$/, "/")));
  if (!gscProperty) gscProperty = sites.find((p) => p.startsWith("sc-domain:") && covers(p)) || sites.find(covers) || "";
  if (gscProperty && sites.includes(gscProperty)) {
    say(true, "Search Console", gscProperty);
    const q = (dims, end = lastFinalDay()) => api(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(gscProperty)}/searchAnalytics/query`, GSC, {
      startDate: addDays(end, -27), endDate: end, dimensions: dims, rowLimit: 50, dataState: "all",
      ...(gscProperty.startsWith("sc-domain:") ? { dimensionFilterGroups: [{ filters: [{ dimension: "page", operator: "includingRegex", expression: hostPattern(host) }] }] } : {}),
    });
    let [qs, ps, cs] = await Promise.all([q(["query"]), q(["page"]), q(["country"])]);
    // Young sites have nothing in the final-data window yet: fall back to fresh, partial data.
    if (!qs.rows?.length) [qs, ps, cs] = await Promise.all([q(["query"], addDays(lastFinalDay(), 3)), q(["page"], addDays(lastFinalDay(), 3)), q(["country"], addDays(lastFinalDay(), 3))]);
    topQueries = (qs.rows || []).map((x) => ({ query: x.keys[0], clicks: x.clicks, impressions: x.impressions, position: +x.position.toFixed(1) }));
    topPages = (ps.rows || []).map((x) => ({ page: x.keys[0], clicks: x.clicks }));
    topCountry = cs.rows?.[0]?.keys[0] || "";
    if (!topQueries.length) say(null, "  data", "no impressions in the last 28 days yet (new site?): that is fine");
  } else {
    say(false, "Search Console", sites.length ? `no property covering ${host} is shared with the service account (it sees: ${sites.join(", ")})` : "the service account sees no property");
    todo.push(`Share Search Console with the service account: https://search.google.com/search-console/users → Add user → ${email || "<service account email>"} → Restricted.${gscProperty ? "" : ` If the site is not verified yet, add it as a Domain property (sc-domain:${regDomain}).`}`);
  }
} else say(null, "Search Console", "waiting for the key");

// ---------- GA4 ----------
let ga4Property = a.ga4 || prev.ga4Property || "", ga4Hostname = prev.ga4Hostname || "";
if (keyPath && !ga4Property) {
  const s = await api("https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200", GA);
  if (s.error) {
    say(false, "GA4", s.error.status === "PERMISSION_DENIED" && /has not been used|disabled/i.test(s.error.message) ? "enable the Google Analytics Admin API to auto-detect the property" : s.error.message.slice(0, 120));
    todo.push("GA4 (optional): enable https://console.cloud.google.com/apis/library/analyticsadmin.googleapis.com and re-run, or pass --ga4 <property id>.");
  } else {
    const props = (s.accountSummaries || []).flatMap((x) => (x.propertySummaries || []).map((p) => p.property.split("/")[1]));
    let match = null, fallback = null;
    for (const id of props) {
      const ds = await api(`https://analyticsadmin.googleapis.com/v1beta/properties/${id}/dataStreams`, GA);
      for (const st of ds.dataStreams || []) {
        const u = st.webStreamData?.defaultUri; if (!u) continue;
        const h = new URL(u.startsWith("http") ? u : "https://" + u).host;
        if (h === host) match ??= { id, h };
        else if (sameOrSub(h, regDomain)) fallback ??= { id, h };
      }
    }
    const pick = match || fallback;
    if (pick) { ga4Property = pick.id; if (pick.h !== host) ga4Hostname = host; say(true, "GA4", `property ${pick.id}${ga4Hostname ? ` (stream ${pick.h}, filtered on host ${host})` : ""}`); }
    else {
      say(false, "GA4", props.length ? `none of the ${props.length} visible properties has a web stream on ${regDomain}` : "no property shared with the service account");
      todo.push(`GA4 (optional): Admin → Property access management → add ${email || "<service account email>"} as Viewer, then re-run.`);
    }
  }
} else if (ga4Property) say(true, "GA4", `property ${ga4Property}`);

// ---------- Sitemap ----------
let sitemap = a.sitemap || prev.sitemap || "";
if (!sitemap) {
  const robots = await fetchText(site + "/robots.txt");
  const declared = robots.status === 200 ? [...robots.text.matchAll(/^\s*sitemap:\s*(\S+)/gim)].map((m) => m[1]) : [];
  sitemap = declared.find((u) => u.includes(host)) || declared[0] || "";
  for (const p of sitemap ? [] : ["/sitemap.xml", "/sitemap_index.xml", "/sitemap-index.xml"]) {
    const r = await fetchText(site + p); if (r.status === 200 && /<(urlset|sitemapindex)/.test(r.text)) { sitemap = site + p; break; }
  }
}
say(sitemap ? true : false, "Sitemap", sitemap || "none found in robots.txt or at the usual paths");
if (!sitemap) todo.push("Publish a sitemap and declare it in robots.txt (Sitemap: https://…), then re-run.");

// ---------- Crawler visits (optional): Cloudflare zone, or log files ----------
// Detected from the home page's headers; never a blocking to-do.
const home = await fetchText(site + "/");
const behindCf = /cloudflare/i.test(home.headers?.server || "") || !!home.headers?.["cf-ray"];
const onVercel = /vercel/i.test(home.headers?.server || "") || !!home.headers?.["x-vercel-id"];
let cfZone = a["cf-zone"] && a["cf-zone"] !== true ? a["cf-zone"] : prev.cloudflare?.zoneId || "";
if (!cfZone && process.env.CLOUDFLARE_API_TOKEN) {
  const z = await apiJson(`https://api.cloudflare.com/client/v4/zones?name=${encodeURIComponent(regDomain)}`, { headers: { Authorization: "Bearer " + process.env.CLOUDFLARE_API_TOKEN } });
  cfZone = z.result?.[0]?.id || "";
  if (!cfZone) optional.push(`Cloudflare: the token cannot list the zone ${regDomain} (${z.errors?.[0]?.message || z.error?.message || "not found"}). Give it Zone → Zone → Read too, or re-run with --cf-zone <zone id> (zone Overview page).`);
}
const logs = a.logs && a.logs !== true ? a.logs : prev.logs || "";
if (cfZone) say(true, "Crawler visits", `Cloudflare zone ${cfZone}${process.env.CLOUDFLARE_API_TOKEN ? "" : " (set CLOUDFLARE_API_TOKEN to read it)"}`);
else if (logs) say(true, "Crawler visits", `log files at ${logs}`);
else if (behindCf) { say(null, "Crawler visits", "site is behind Cloudflare: can be connected"); optional.push("Crawler visits: create a Cloudflare API token (https://dash.cloudflare.com/profile/api-tokens → Custom token) with Account → Account Analytics → Read and Zone → Zone → Read on this zone, set CLOUDFLARE_API_TOKEN, and re-run setup: the zone is found automatically."); }
else if (onVercel) { say(null, "Crawler visits", "site is on Vercel: needs log files"); optional.push("Crawler visits: Vercel only keeps full request logs through a Log Drain (Pro plan). Point one at storage you can read, then re-run setup with --logs <file or folder>."); }
else say(null, "Crawler visits", "optional: re-run with --logs <file or folder> (access logs) to see which crawlers fetch the site");

// ---------- Market (DataForSEO location/language) from the top Search Console country ----------
const MARKETS = { usa: [2840, "en"], gbr: [2826, "en"], can: [2124, "en"], aus: [2036, "en"], ind: [2356, "en"], irl: [2372, "en"], fra: [2250, "fr"], bel: [2056, "fr"], che: [2756, "de"], deu: [2276, "de"], aut: [2040, "de"], esp: [2724, "es"], mex: [2484, "es"], ita: [2380, "it"], nld: [2528, "nl"], bra: [2076, "pt"], prt: [2620, "pt"], jpn: [2392, "ja"], are: [2784, "ar"], sau: [2682, "ar"], irn: [2364, "fa"], tur: [2792, "tr"], pol: [2616, "pl"] };
const mk = MARKETS[topCountry];
const market = prev.market?.location ? prev.market : mk ? { location: mk[0], language: mk[1] } : { location: 2840, language: "en" };

// ---------- Write ----------
const fill = (v, d) => (v === undefined || v === "" || v === null || (Array.isArray(v) && !v.length) ? d : v);
// An option passed on this run wins over the saved config; otherwise saved values are kept.
const given = (k) => a[k] !== undefined && a[k] !== true;
const pathOf = (u) => { try { const x = new URL(u); return x.host === host ? x.pathname : null; } catch { return null; } };
const pagesByClicks = topPages.map((p) => pathOf(p.page)).filter(Boolean);
const config = {
  site,
  gscProperty: given("gsc") ? a.gsc : fill(prev.gscProperty, gscProperty),
  hostFilter: fill(prev.hostFilter, host),
  ga4Property: given("ga4") ? String(a.ga4) : fill(prev.ga4Property, ga4Property),
  ga4Hostname: fill(prev.ga4Hostname, ga4Hostname),
  sitemap: given("sitemap") ? a.sitemap : fill(prev.sitemap, sitemap),
  brand: given("brand") ? a.brand : fill(prev.brand, brandWord),
  brandName: fill(prev.brandName, ""),
  classes: prev.classes || {},
  targets: prev.targets || [],
  money: prev.money || [],
  competitors: prev.competitors || [],
  priorityPaths: fill(prev.priorityPaths, [...new Set(["/", ...pagesByClicks.slice(0, 9)])]),
  cwvUrls: fill(prev.cwvUrls, [...new Set([site + "/", ...pagesByClicks.slice(0, 2).map((p) => site + p)])]),
  keyEvents: prev.keyEvents || [],
  market,
  credentials: { ...(prev.credentials || {}), serviceAccountKey: given("sa") && keyPath ? keyPath : fill(prev.credentials?.serviceAccountKey, keyPath) },
  ...(prev.indexNowKey ? { indexNowKey: prev.indexNowKey } : {}),
  ...(cfZone ? { cloudflare: { ...(prev.cloudflare || {}), zoneId: cfZone } } : {}),
  ...(logs ? { logs } : {}),
  tracker: prev.tracker ?? null,
};
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(cfgFile, JSON.stringify(config, null, 2) + "\n");
const write = (f, c) => { const p = path.join(dir, f); if (!fs.existsSync(p)) fs.writeFileSync(p, c); };
write("standards.md", `# SEO standards for ${host}\n\nRules this site's pages follow. Read before every brief or edit. Every time the owner rejects a proposal, add the reason here as a rule (one or two lines), with the date.\n\n## Voice and claims\n\n- \n\n## Page rules\n\n- One primary keyword per page; check Search Console for an existing page first.\n- Every new page has one original element the top results lack (tool, data, table, media, quiz).\n- At least 5 contextual internal links to every new page, from related pages.\n\n## Never\n\n- \n`);
write("log.md", `# SEO change log for ${host}\n\nOne line per shipped change: date, page, what changed, why (data), when to review. Changes need 4-8 weeks before judging.\n\n| date | page | change | why | review on |\n|---|---|---|---|---|\n`);
write(".gitignore", "cache/\n");
console.log(`\nWrote ${cfgFile}${Object.keys(prev).length ? " (existing values kept)" : ""}, standards.md, log.md, .gitignore`);
console.log(`Market: ${market.location}/${market.language}${mk && !prev.market?.location ? ` (from the top country, ${topCountry})` : ""}. Brand regex: "${config.brand}" (add typos and the product name).`);

if (topQueries.length) {
  console.log(`\nTop queries over the last 28 days of data (use them to fill brand, classes, targets and money):\n`);
  console.log("| query | clicks | impressions | position |\n|---|---|---|---|");
  for (const q of topQueries.slice(0, 20)) console.log(`| ${q.query} | ${q.clicks} | ${q.impressions} | ${q.position} |`);
}
if (todo.length) { console.log("\nTo do (owner):"); todo.forEach((t, i) => console.log(`  ${i + 1}. ${t}`)); }
if (optional.length) { console.log("\nOptional, when you want it:"); optional.forEach((t) => console.log(`  - ${t}`)); }
console.log("\nOptional sources (add any time, then run doctor): DataForSEO (keyword volumes, live SERPs, competitors) via DATAFORSEO_LOGIN/DATAFORSEO_PASSWORD; PAGESPEED_API_KEY; BING_WMT_API_KEY; INDEXNOW_KEY. See references/setup.md.");

if (!a["no-doctor"] && keyPath) { console.log("\n--- doctor ---"); spawnSync(process.execPath, [path.join(here, "doctor.mjs")], { stdio: "inherit" }); }
process.exit(todo.length ? 3 : 0);
