// Checks every data source the skill can use and prints what is connected, what is missing and how to fix it.
// Usage: node doctor.mjs [--config path]
import fs from "node:fs";
import { loadConfig, parseArgs, serviceAccountKeyPath, googleToken, pagespeedKey, dataforseoAuth, fetchText, lastFinalDay, addDays } from "./lib.mjs";

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
  const r = await (await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(cfg.gscProperty)}/searchAnalytics/query`, { method: "POST", headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" }, body: JSON.stringify({ startDate: addDays(lastFinalDay(), -6), endDate: lastFinalDay(), dimensions: ["date"] }) })).json();
  if (r.error) return line(false, "Search Console", `${cfg.gscProperty}: ${r.error.message} (add ${email} as a user on the property)`);
  const clicks = (r.rows || []).reduce((s, x) => s + x.clicks, 0);
  line(true, "Search Console", `${cfg.gscProperty}, ${clicks} clicks over the last 7 final days (whole property)`);
  if (cfg.gscProperty.startsWith("sc-domain:")) {
    // A domain property mixes every host: show the split so nobody analyses the wrong one by default.
    const pages = await (await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(cfg.gscProperty)}/searchAnalytics/query`, { method: "POST", headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" }, body: JSON.stringify({ startDate: addDays(lastFinalDay(), -27), endDate: lastFinalDay(), dimensions: ["page"], rowLimit: 25000, dataState: "all" }) })).json();
    const hosts = new Map();
    for (const r of pages.rows || []) { const h = new URL(r.keys[0]).host; const v = hosts.get(h) || { c: 0, i: 0 }; v.c += r.clicks; v.i += r.impressions; hosts.set(h, v); }
    const mine = hosts.get(cfg.hostFilter) || { c: 0, i: 0 };
    line(mine.i > 0 ? true : false, "Configured host", `${cfg.hostFilter}: ${mine.c} clicks, ${mine.i} impressions over 28 days${mine.i ? "" : " (no data yet: new site, or wrong hostFilter)"}`);
    const others = [...hosts].filter(([h]) => h !== cfg.hostFilter).sort((a, b) => b[1].c - a[1].c);
    if (others.length) console.log(`     other hosts on this property (use --host <name> to analyse them): ${others.map(([h, v]) => `${h} ${v.c} clicks`).join(", ")}`);
  }
  const ins = await (await fetch("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", { method: "POST", headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" }, body: JSON.stringify({ inspectionUrl: cfg.site + "/", siteUrl: cfg.gscProperty }) })).json();
  line(!ins.error, "URL Inspection API", ins.error ? ins.error.message : `home: ${ins.inspectionResult?.indexStatusResult?.coverageState} (quota 2,000/day/property)`);
}
async function tryGa4() {
  if (!cfg.ga4Property) return line(null, "GA4", 'not configured (optional): "ga4Property"');
  const t = await googleToken(cfg, ["https://www.googleapis.com/auth/analytics.readonly"]);
  const r = await (await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${cfg.ga4Property}:runReport`, { method: "POST", headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" }, body: JSON.stringify({ dateRanges: [{ startDate: "7daysAgo", endDate: "yesterday" }], metrics: [{ name: "activeUsers" }], ...(cfg.ga4Hostname ? { dimensionFilter: { filter: { fieldName: "hostName", stringFilter: { value: cfg.ga4Hostname } } } } : {}) }) })).json();
  if (r.error) return line(false, "GA4", `${cfg.ga4Property}: ${r.error.message} (add ${email} as Viewer)`);
  line(true, "GA4", `${cfg.ga4Property}${cfg.ga4Hostname ? " host " + cfg.ga4Hostname : ""}: ${r.rows?.[0]?.metricValues?.[0]?.value ?? 0} users over 7 days`);
}
async function tryPsi() {
  const k = pagespeedKey(cfg);
  line(k ? true : null, "PageSpeed / CrUX", k ? "API key found" : "no key: works unauthenticated but rate-limited; set PAGESPEED_API_KEY");
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
}
for (const f of [tryGsc, tryGa4, tryPsi, trySite, tryOptional]) { try { await f(); } catch (e) { line(false, f.name, String(e)); } }
console.log("\nTracker:", cfg.tracker ? JSON.stringify(cfg.tracker) : "none configured, findings go to .seo/log.md");
