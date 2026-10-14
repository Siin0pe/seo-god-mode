// Checks every data source the skill can use and prints what is connected, what is missing and how to fix it.
// Usage: node doctor.mjs [--config path]
import fs from "node:fs";
import { loadConfig, parseArgs, serviceAccountKeyPath, googleToken, apiJson, pagespeedKey, cruxKey, cruxHistory, gscSitemaps, sitemapIssues, dataforseoAuth, fetchText, lastFinalDay, addDays, cloudflareGraphql } from "./lib.mjs";

const args = parseArgs();
const cfg = loadConfig(args);
const line = (ok, name, detail) => console.log(`${ok === true ? "OK  " : ok === false ? "FAIL" : "--  "} ${name.padEnd(26)} ${detail}`);
console.log(`config: ${cfg._file}\nsite:   ${cfg.site}\n`);

const keyPath = serviceAccountKeyPath(cfg);
let email = "";
if (keyPath && fs.existsSync(keyPath)) { email = JSON.parse(fs.readFileSync(keyPath, "utf8")).client_email; line(true, "Service account key", email); }
else line(false, "Service account key", "not found: set SEO_SA_KEY or credentials.serviceAccountKey");

async function tryGsc() {
  if (!cfg.gscProperty) return line(false, "Search Console", 'no "gscProperty" in config');
  const t = await googleToken(cfg, ["https://www.googleapis.com/auth/webmasters.readonly"]);
  const r = await apiJson(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(cfg.gscProperty)}/searchAnalytics/query`, { method: "POST", headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" }, body: JSON.stringify({ startDate: addDays(lastFinalDay(), -6), endDate: lastFinalDay(), dimensions: ["date"] }) });
  if (r.error) return line(false, "Search Console", `${cfg.gscProperty}: ${r.error.message} (add ${email} as a user on the property)`);
  const clicks = (r.rows || []).reduce((s, x) => s + x.clicks, 0);
  line(true, "Search Console", `${cfg.gscProperty}, ${clicks} clicks over the last 7 final days (whole property)`);
  if (cfg.gscProperty.startsWith("sc-domain:")) {
    // A domain property mixes every host: show the split so nobody analyses the wrong one by default.
    const pages = await apiJson(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(cfg.gscProperty)}/searchAnalytics/query`, { method: "POST", headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" }, body: JSON.stringify({ startDate: addDays(lastFinalDay(), -27), endDate: lastFinalDay(), dimensions: ["page"], rowLimit: 25000, dataState: "all" }) });
    const hosts = new Map();
    for (const r of pages.rows || []) { const h = new URL(r.keys[0]).host; const v = hosts.get(h) || { c: 0, i: 0 }; v.c += r.clicks; v.i += r.impressions; hosts.set(h, v); }
    const mine = hosts.get(cfg.hostFilter) || { c: 0, i: 0 };
    line(mine.i > 0 ? true : false, "Configured host", `${cfg.hostFilter}: ${mine.c} clicks, ${mine.i} impressions over 28 days${mine.i ? "" : " (no data yet: new site, or wrong hostFilter)"}`);
    const others = [...hosts].filter(([h]) => h !== cfg.hostFilter).sort((a, b) => b[1].c - a[1].c);
    if (others.length) console.log(`     other hosts on this property (use --host <name> to analyse them): ${others.map(([h, v]) => `${h} ${v.c} clicks`).join(", ")}`);
  }
  const ins = await apiJson("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", { method: "POST", headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" }, body: JSON.stringify({ inspectionUrl: cfg.site + "/", siteUrl: cfg.gscProperty }) });
  line(!ins.error, "URL Inspection API", ins.error ? ins.error.message : `home: ${ins.inspectionResult?.indexStatusResult?.coverageState} (quota 2,000/day/property)`);
  const sm = await gscSitemaps(cfg);
  if (sm.error) return line(false, "Sitemaps (Google)", sm.error);
  const issues = sitemapIssues(sm.sitemaps, cfg.sitemap);
  line(!issues.length, "Sitemaps (Google)", sm.sitemaps.length ? `${sm.sitemaps.length} submitted${issues.length ? ": " + issues.join("; ") : ", all read in the last 14 days, no errors"}` : "none submitted in Search Console");
}
async function tryGa4() {
  if (!cfg.ga4Property) return line(null, "GA4", 'not configured (optional): "ga4Property"');
  const t = await googleToken(cfg, ["https://www.googleapis.com/auth/analytics.readonly"]);
  const r = await apiJson(`https://analyticsdata.googleapis.com/v1beta/properties/${cfg.ga4Property}:runReport`, { method: "POST", headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" }, body: JSON.stringify({ dateRanges: [{ startDate: "7daysAgo", endDate: "yesterday" }], metrics: [{ name: "activeUsers" }], ...(cfg.ga4Hostname ? { dimensionFilter: { filter: { fieldName: "hostName", stringFilter: { value: cfg.ga4Hostname } } } } : {}) }) });
  if (r.error) return line(false, "GA4", `${cfg.ga4Property}: ${r.error.message} (add ${email} as Viewer)`);
  line(true, "GA4", `${cfg.ga4Property}${cfg.ga4Hostname ? " host " + cfg.ga4Hostname : ""}: ${r.rows?.[0]?.metricValues?.[0]?.value ?? 0} users over 7 days`);
}
async function tryPsi() {
  const k = pagespeedKey(cfg);
  line(k ? true : null, "PageSpeed / CrUX", k ? "API key found" : "no key: works unauthenticated but rate-limited; set PAGESPEED_API_KEY");
  if (!cruxKey(cfg)) return line(null, "CrUX History", "needs an API key with the Chrome UX Report API enabled (CRUX_API_KEY or the PageSpeed key)");
  const h = await cruxHistory(cfg, cfg.site, { origin: true, weeks: 1 });
  line(h.error ? (/no CrUX data/.test(h.error) ? null : false) : true, "CrUX History", h.error ? h.error + (/not enabled|has not been used|disabled/i.test(h.error) ? " (enable https://console.cloud.google.com/apis/library/chromeuxreport.googleapis.com)" : "") : `origin data up to ${h.weeks.at(-1)} (cwv.mjs --history)`);
}
async function trySite() {
  const s = await fetchText(cfg.site + "/robots.txt");
  line(s.status === 200, "robots.txt", `${s.status}${/sitemap:/i.test(s.text) ? ", declares a sitemap" : ", no Sitemap: line"}`);
  if (cfg.sitemap) { const m = await fetchText(cfg.sitemap); line(m.status === 200, "Sitemap", `${cfg.sitemap} → ${m.status}`); }
  else line(false, "Sitemap", 'no "sitemap" in config');
}
async function tryOptional() {
  line(dataforseoAuth() ? true : null, "DataForSEO", dataforseoAuth() ? "credentials in env (paid per request)" : "not configured: volumes / SERP / competitors / backlinks unavailable, never invent them");
  line(process.env.BING_WMT_API_KEY ? true : null, "Bing Webmaster API", process.env.BING_WMT_API_KEY ? "key in env" : "not configured (optional): BING_WMT_API_KEY");
  const ik = process.env.INDEXNOW_KEY || cfg.indexNowKey;
  if (ik) { const f = await fetchText(`${cfg.site}/${ik}.txt`); line(f.status === 200 && f.text.trim() === ik, "IndexNow", f.status === 200 ? "key file served" : `key file ${cfg.site}/${ik}.txt → ${f.status}`); }
  else line(null, "IndexNow", "not configured (optional): INDEXNOW_KEY + key file at site root");
  const zone = cfg.cloudflare?.zoneId || process.env.CLOUDFLARE_ZONE_ID;
  if (!zone) line(null, "Crawler visits", 'not configured (optional): config "cloudflare": {"zoneId"} + CLOUDFLARE_API_TOKEN, or crawlers.mjs --file <logs>');
  else if (!process.env.CLOUDFLARE_API_TOKEN) line(false, "Crawler visits", `zone ${zone} configured but CLOUDFLARE_API_TOKEN is not set`);
  else {
    const d = await cloudflareGraphql("query($z: String!) { viewer { zones(filter: { zoneTag: $z }) { zoneTag } } }", { z: zone });
    line(d?.viewer?.zones?.length ? true : false, "Crawler visits", d?.viewer?.zones?.length ? `Cloudflare zone ${zone} readable (crawlers.mjs)` : `the token cannot read zone ${zone}: give it Account Analytics: Read on that zone`);
  }
}
// One failing source (no key, API error) must not hide the state of the others.
for (const [name, f] of [["Search Console", tryGsc], ["GA4", tryGa4], ["PageSpeed / CrUX", tryPsi], ["Site", trySite], ["Optional sources", tryOptional]]) { try { await f(); } catch (e) { line(false, name, String(e.message || e).split("\n")[0]); } }
console.log("\nTracker:", cfg.tracker ? JSON.stringify(cfg.tracker) : "none configured, findings go to .seo/log.md");
