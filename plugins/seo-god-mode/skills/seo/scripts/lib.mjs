// Shared plumbing for the seo-god-mode scripts. Zero dependencies, Node 18+.
// Every data source is optional: a script that needs a missing source says so and exits 2.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// ---------- CLI ----------
// Repeatable options collect every value in an array ("--filter a --filter b"); any other option keeps its last
// value. "--k=v" keeps any "=" inside v.
const MULTI_ARGS = new Set(["filter", "file"]);
export function parseArgs(argv = process.argv.slice(2)) {
  const out = { _: [] };
  const set = (k, v) => { out[k] = MULTI_ARGS.has(k) ? [].concat(out[k] ?? [], v) : v; };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") printHelp();
    if (!a.startsWith("--")) { out._.push(a); continue; }
    const eq = a.indexOf("=");
    if (eq > 2) set(a.slice(2, eq), a.slice(eq + 1));
    else if (argv[i + 1] && !argv[i + 1].startsWith("--")) set(a.slice(2), argv[++i]);
    else set(a.slice(2), true);
  }
  if (process.env.MSYSTEM) {
    const roots = msysRoots();
    for (const k of Object.keys(out)) {
      const fix = (v) => (typeof v === "string" ? unmangleMsys(v, URL_PATH_ARGS.has(k), roots) : v);
      out[k] = Array.isArray(out[k]) ? out[k].map(fix) : fix(out[k]);
    }
  }
  return out;
}
function printHelp() {
  // Every script documents itself in its leading comment block.
  const src = fs.readFileSync(process.argv[1], "utf8").split("\n");
  console.log(src.filter((l, i) => l.startsWith("//") && src.slice(0, i).every((x) => x.startsWith("//"))).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
  console.log("\nCommon options: --days N | --start YYYY-MM-DD --end YYYY-MM-DD, --host <hostname>|all, --json, --out <file>, --config <path>");
  process.exit(0);
}
// Git Bash (MSYS) rewrites arguments that look like POSIX paths before Node sees them: "/learn/" becomes
// "C:/Program Files/Git/learn/" and "/a/,/b/" becomes "A:/,/b/" (or "A://"). URL paths are what these scripts
// take, so undo it. Only the real Git install root is stripped: "C:/Users/me/git/repo/r.md" is a real path.
const URL_PATH_ARGS = new Set(["paths", "only"]);
export function msysRoots(env = process.env) {
  const roots = new Set();
  // Git Bash sets EXEPATH to <root>\bin (or <root> itself).
  if (env.EXEPATH) roots.add(env.EXEPATH.replace(/\\/g, "/").replace(/\/(usr\/)?bin\/?$/i, "").replace(/\/?$/, "/"));
  return [...roots];
}
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export function unmangleMsys(v, urlPathArg = false, roots = msysRoots()) {
  const alts = [...roots.map(escRe), "[A-Za-z]:/Program Files(?: \\(x86\\))?/Git/"].join("|");
  let s = v.replace(new RegExp(`(^|[,\\^])(?:${alts})`, "gi"), "$1/");
  // A one-letter first segment is read as a drive ("/a/" → "A:/"). Only safe to undo for URL-path options.
  if (urlPathArg) s = s.split(",").map((p) => p.replace(/^([A-Za-z]):\/\/?/, (_, d) => "/" + d.toLowerCase() + "/")).join(",");
  return s;
}
export const die = (msg, code = 1) => { console.error(msg); process.exit(code); };
export const missing = (what, how) => die(missingText(what, how), 2);
const missingText = (what, how) => `MISSING SOURCE: ${what}\n${how}\nSee references/setup.md.`;
// Thrown (instead of exiting) where a caller may want to carry on, e.g. doctor checking every source.
// Uncaught, it exits with its code like die()/missing() would.
export class SourceError extends Error {
  constructor(message, code = 1) { super(message); this.code = code; }
}
process.on("uncaughtException", (e) => {
  if (e instanceof SourceError) { console.error(e.message); process.exit(e.code); }
  console.error(e);
  process.exit(1);
});

// ---------- Config ----------
// Looked up from the cwd upwards: .seo/config.json. --config overrides. With { optional: true } a missing
// config returns {} instead of exiting (scripts that work without a project, like keywords.mjs).
export function loadConfig(args = {}, { optional = false } = {}) {
  let file = args.config;
  if (!file) {
    let dir = process.cwd();
    for (;;) {
      const f = path.join(dir, ".seo", "config.json");
      if (fs.existsSync(f)) { file = f; break; }
      const up = path.dirname(dir);
      if (up === dir) break;
      dir = up;
    }
  }
  if (!file && optional) return {};
  if (!file) die("No .seo/config.json found from the current directory upwards. Run /seo-god-mode:setup (or `node scripts/setup.mjs --site <url>`).");
  const cfg = JSON.parse(fs.readFileSync(file, "utf8"));
  cfg._file = file;
  cfg._dir = path.dirname(file);
  cfg.site = (cfg.site || "").replace(/\/$/, "");
  cfg.hostFilter ??= cfg.site.replace(/^https?:\/\//, "");
  if (args.host) cfg.hostFilter = args.host === "all" ? "" : args.host; // --host other.example.com | --host all
  if (args.host && args.host !== "all") cfg.ga4Hostname = args.host;
  const re = (src, field) => { try { return new RegExp(src, "i"); } catch (e) { die(`Invalid regex in ${file} "${field}": ${e.message}`); } };
  cfg.brandRegex = cfg.brand ? re(cfg.brand, "brand") : null;
  cfg.classRegex = Object.entries(cfg.classes || {}).map(([k, v]) => [k, re(v, `classes.${k}`)]);
  return cfg;
}
// hostFilter is a host, optionally with a path prefix ("example.com/fr"). Matches that host exactly:
// "notexample.com" and "example.com.evil.io" are other sites.
export const hostPattern = (hostFilter) => `^https?://${escRe(hostFilter.replace(/\/$/, ""))}([/?#:]|$)`;
export const onHost = (url, hostFilter) => !hostFilter || new RegExp(hostPattern(hostFilter), "i").test(url);
// Registrable domain, good enough without a public-suffix list: blog.example.com → example.com,
// shop.example.co.uk → example.co.uk.
export function regDomainOf(host) {
  const labels = host.replace(/^www\./, "").split(".");
  return labels.length > 2 && labels.at(-1).length === 2 && labels.at(-2).length <= 3 ? labels.slice(-3).join(".") : labels.slice(-2).join(".");
}
// Key to match the same page across the sitemap, Search Console and links: case-insensitive host, no
// fragment or query, no trailing slash. Not a canonical: "/a" and "/a/" are different URLs to Google.
export function urlKey(u) {
  try { const x = new URL(u); return `${x.protocol}//${x.host.toLowerCase()}${x.pathname.replace(/\/+$/, "") || "/"}`; } catch { return u; }
}
export function queryClass(cfg, q) {
  if (cfg.brandRegex?.test(q)) return "brand";
  for (const [k, re] of cfg.classRegex) if (re.test(q)) return k;
  return "generic";
}
export function requireSitemap(cfg) {
  if (!cfg.sitemap) die('No "sitemap" in .seo/config.json: add the sitemap URL (or re-run setup.mjs --sitemap <url>).');
  return cfg.sitemap;
}
export function cachePath(cfg, name) {
  const dir = path.join(cfg._dir, "cache");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, name);
}

// ---------- Dates ----------
export const iso = (d) => d.toISOString().slice(0, 10);
export const addDays = (dateStr, n) => iso(new Date(new Date(dateStr + "T00:00:00Z").getTime() + n * 86400000));
export const today = () => iso(new Date());
// Search Console final data lags ~2-3 days. Default analysis windows end 3 days ago.
export const lastFinalDay = () => addDays(today(), -3);
// days is the real length of the window, also when --start sets it.
export function period(args, defDays = 28) {
  const end = args.end || lastFinalDay();
  const start = args.start || addDays(end, -(Number(args.days || defDays) - 1));
  const days = Math.round((new Date(end) - new Date(start)) / 86400000) + 1;
  if (!(days >= 1)) die(`Invalid window ${start} → ${end}: --start must be on or before --end (YYYY-MM-DD).`);
  return { start, end, days };
}
export function previousWindow({ start, end }) {
  const len = (new Date(end) - new Date(start)) / 86400000 + 1;
  return { start: addDays(start, -len), end: addDays(start, -1), days: len };
}

// ---------- Google auth (service account JWT) ----------
const b64 = (o) => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");
const tokenCache = new Map();
export function serviceAccountKeyPath(cfg) {
  return process.env.SEO_SA_KEY || process.env.GOOGLE_APPLICATION_CREDENTIALS || cfg?.credentials?.serviceAccountKey;
}
/** Throws SourceError (exit 2 when uncaught) so callers like doctor can report it and keep going. */
export async function googleToken(cfg, scopes) {
  const keyPath = serviceAccountKeyPath(cfg);
  if (!keyPath || !fs.existsSync(keyPath)) throw new SourceError(missingText("Google service account key", "Set SEO_SA_KEY (or credentials.serviceAccountKey in .seo/config.json) to the JSON key path, and add the service account email as a user on the Search Console property / GA4 property."), 2);
  const cacheKey = scopes.join(" ");
  const hit = tokenCache.get(cacheKey);
  if (hit && hit.exp > Date.now() + 60000) return hit.token;
  const key = JSON.parse(fs.readFileSync(keyPath, "utf8"));
  const now = Math.floor(Date.now() / 1000);
  const claim = { iss: key.client_email, scope: cacheKey, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3000 };
  const unsigned = b64({ alg: "RS256", typ: "JWT" }) + "." + b64(claim);
  const sig = crypto.createSign("RSA-SHA256").update(unsigned).sign(key.private_key).toString("base64url");
  const tok = await apiJson("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: unsigned + "." + sig }) });
  if (!tok.access_token) throw new SourceError("Google token error: " + JSON.stringify(tok).slice(0, 300));
  tokenCache.set(cacheKey, { token: tok.access_token, exp: Date.now() + 2900000 });
  return tok.access_token;
}
/** fetch + JSON with a timeout and retries on 429/5xx/network errors. Never throws on a bad response:
 *  a non-JSON body (HTML error page) comes back as { error: { code, message } }. */
export async function apiJson(url, init = {}, { retries = 3, timeout = 60000 } = {}) {
  for (let attempt = 0; ; attempt++) {
    let status = 0, text = "";
    try {
      const r = await fetch(url, { ...init, signal: AbortSignal.timeout(timeout) });
      status = r.status;
      text = await r.text();
    } catch (e) { text = String(e); }
    const retryable = status === 0 || status === 429 || status >= 500;
    if (retryable && attempt < retries) { await new Promise((ok) => setTimeout(ok, 1000 * 2 ** attempt)); continue; }
    try { return JSON.parse(text); } catch { return { error: { code: status, message: `HTTP ${status || "network error"}: ${text.replace(/\s+/g, " ").slice(0, 200)}` } }; }
  }
}
const GSC_SCOPE = ["https://www.googleapis.com/auth/webmasters.readonly"];
const GA_SCOPE = ["https://www.googleapis.com/auth/analytics.readonly"];

// ---------- Search Console ----------
/** Search Analytics with pagination. body: {startDate,endDate,dimensions,dimensionFilterGroups,...}.
 *  hostOnly (default true) restricts to cfg.hostFilter when the property is a domain property. */
export async function gsc(cfg, body, { hostOnly = true, max = 100000 } = {}) {
  if (!cfg.gscProperty) missing("Search Console property", 'Set "gscProperty" in .seo/config.json (e.g. "sc-domain:example.com" or "https://example.com/").');
  const token = await googleToken(cfg, GSC_SCOPE);
  const filters = [...(body.dimensionFilterGroups?.[0]?.filters || [])];
  if (hostOnly && cfg.hostFilter && cfg.gscProperty.startsWith("sc-domain:")) filters.push({ dimension: "page", operator: "includingRegex", expression: hostPattern(cfg.hostFilter) });
  const rows = [];
  for (let startRow = 0; startRow < max; startRow += 25000) {
    const req = { dataState: "all", ...body, rowLimit: Math.min(25000, max - startRow), startRow, ...(filters.length ? { dimensionFilterGroups: [{ filters }] } : {}) };
    const j = await apiJson(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(cfg.gscProperty)}/searchAnalytics/query`, { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify(req) });
    if (j.error) die("GSC error: " + JSON.stringify(j.error).slice(0, 400));
    const got = j.rows || [];
    rows.push(...got);
    if (got.length < req.rowLimit) break;
  }
  return rows;
}
/** Rows → objects keyed by dimension names. */
export const gscObjects = (rows, dims) => rows.map((r) => ({ ...Object.fromEntries(dims.map((d, i) => [d, r.keys[i]])), clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position }));

export async function inspectUrl(cfg, url) {
  const token = await googleToken(cfg, GSC_SCOPE);
  const j = await apiJson("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify({ inspectionUrl: url, siteUrl: cfg.gscProperty }) });
  if (j.error) return { url, error: j.error.message };
  const s = j.inspectionResult?.indexStatusResult || {};
  return { url, verdict: s.verdict, coverage: s.coverageState, lastCrawl: s.lastCrawlTime, robots: s.robotsTxtState, indexing: s.indexingState, canonicalGoogle: s.googleCanonical, canonicalUser: s.userCanonical, sitemaps: s.sitemap };
}

// ---------- GA4 ----------
export async function ga4(cfg, { noHostFilter, ...body }) {
  if (!cfg.ga4Property) missing("GA4 property", 'Set "ga4Property" (numeric id) in .seo/config.json and add the service account as Viewer on the property.');
  const token = await googleToken(cfg, GA_SCOPE);
  if (cfg.ga4Hostname && !noHostFilter) {
    const host = { filter: { fieldName: "hostName", stringFilter: { value: cfg.ga4Hostname } } };
    body.dimensionFilter = body.dimensionFilter ? { andGroup: { expressions: [body.dimensionFilter, host] } } : host;
  }
  const j = await apiJson(`https://analyticsdata.googleapis.com/v1beta/properties/${cfg.ga4Property}:runReport`, { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (j.error) die("GA4 error: " + JSON.stringify(j.error).slice(0, 400));
  return (j.rows || []).map((row) => [...row.dimensionValues.map((d) => d.value), ...row.metricValues.map((m) => Number(m.value))]);
}

// ---------- PageSpeed / CrUX ----------
export function pagespeedKey(cfg) {
  if (process.env.PAGESPEED_API_KEY || process.env.GOOGLE_API_KEY) return process.env.PAGESPEED_API_KEY || process.env.GOOGLE_API_KEY;
  if (cfg?.credentials?.pagespeedKeyEnv && process.env[cfg.credentials.pagespeedKeyEnv]) return process.env[cfg.credentials.pagespeedKeyEnv];
  return "";
}
export async function pagespeed(cfg, url, strategy = "mobile") {
  const key = pagespeedKey(cfg);
  const q = new URLSearchParams({ url, strategy, category: "performance" });
  if (key) q.set("key", key);
  const j = await apiJson("https://www.googleapis.com/pagespeedonline/v5/runPagespeed?" + q, {}, { timeout: 120000 });
  if (j.error) return { url, error: j.error.message };
  const m = j.loadingExperience?.metrics || {};
  const p = (k) => m[k]?.percentile;
  // Without enough data for the URL, PSI fills loadingExperience with the origin's: say so.
  const fallback = j.loadingExperience?.origin_fallback ? " (origin data, none for this URL)" : "";
  return {
    url, field: (j.loadingExperience?.overall_category || "NO_FIELD_DATA") + fallback, origin: j.originLoadingExperience?.overall_category || "NO_FIELD_DATA",
    lcpMs: p("LARGEST_CONTENTFUL_PAINT_MS"), inpMs: p("INTERACTION_TO_NEXT_PAINT"), cls: p("CUMULATIVE_LAYOUT_SHIFT_SCORE") != null ? p("CUMULATIVE_LAYOUT_SHIFT_SCORE") / 100 : undefined, ttfbMs: p("EXPERIMENTAL_TIME_TO_FIRST_BYTE"),
    labScore: Math.round((j.lighthouseResult?.categories?.performance?.score ?? 0) * 100),
    labLcpMs: Math.round(j.lighthouseResult?.audits?.["largest-contentful-paint"]?.numericValue ?? 0), labCls: j.lighthouseResult?.audits?.["cumulative-layout-shift"]?.numericValue,
  };
}

/** CrUX History API: weekly p75 of the 28 days before each week, up to 40 weeks, for a URL or an origin.
 *  Needs an API key with the Chrome UX Report API enabled (CRUX_API_KEY, or the PageSpeed key).
 *  Returns { weeks: ["YYYY-MM-DD" (period end)...], p75: { lcp, inp, cls, ttfb }: arrays aligned on weeks, null = no data }. */
export const cruxKey = (cfg) => process.env.CRUX_API_KEY || pagespeedKey(cfg);
const CRUX_METRICS = { lcp: "largest_contentful_paint", inp: "interaction_to_next_paint", cls: "cumulative_layout_shift", ttfb: "experimental_time_to_first_byte" };
export async function cruxHistory(cfg, target, { origin = false, formFactor = "PHONE", weeks = 40 } = {}) {
  const key = cruxKey(cfg);
  if (!key) missing("CrUX API key", "Enable the Chrome UX Report API on the Google Cloud project and set CRUX_API_KEY (the PageSpeed key works if that API is enabled on it).");
  const body = { ...(origin ? { origin: new URL(target).origin } : { url: target }), formFactor, metrics: Object.values(CRUX_METRICS), collectionPeriodCount: weeks };
  const j = await apiJson("https://chromeuxreport.googleapis.com/v1/records:queryHistoryRecord?key=" + encodeURIComponent(key), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (j.error) return { target, error: j.error.code === 404 ? "no CrUX data (not enough Chrome traffic)" : j.error.message };
  const d = (x) => `${x.year}-${String(x.month).padStart(2, "0")}-${String(x.day).padStart(2, "0")}`;
  const num = (v) => (v == null || v === "NaN" ? null : Number(v)); // CLS comes as a string
  const p75 = Object.fromEntries(Object.entries(CRUX_METRICS).map(([k, m]) => [k, (j.record?.metrics?.[m]?.percentilesTimeseries?.p75s || []).map(num)]));
  return { target, weeks: (j.record?.collectionPeriods || []).map((p) => d(p.lastDate)), p75 };
}
export const CWV_GOOD = { lcp: 2500, inp: 200, cls: 0.1, ttfb: 800 };
/** Per metric: latest p75, 4 and 12 weeks earlier, and the last week it crossed the "good" threshold. */
export function cwvTrend({ weeks, p75 }) {
  const out = {};
  for (const [k, s] of Object.entries(p75)) {
    const at = (back) => { const i = s.length - 1 - back; return i >= 0 ? s[i] : null; };
    let crossed = null;
    for (let i = 1; i < s.length; i++) {
      if (s[i] == null || s[i - 1] == null) continue;
      const was = s[i - 1] <= CWV_GOOD[k], is = s[i] <= CWV_GOOD[k];
      if (was !== is) crossed = { week: weeks[i], to: is ? "good" : "not good" };
    }
    out[k] = { latest: at(0), w4: at(4), w12: at(12), crossed };
  }
  return out;
}

// ---------- Search Console sitemaps ----------
/** What Google knows about the property's sitemaps: last read, errors, pending. Read-only scope is enough. */
export async function gscSitemaps(cfg) {
  if (!cfg.gscProperty) missing("Search Console property", 'Set "gscProperty" in .seo/config.json.');
  const token = await googleToken(cfg, GSC_SCOPE);
  const j = await apiJson(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(cfg.gscProperty)}/sitemaps`, { headers: { Authorization: "Bearer " + token } });
  if (j.error) return { error: j.error.message };
  // Counts are int64, serialised as strings.
  return { sitemaps: (j.sitemap || []).map((s) => ({ path: s.path, lastSubmitted: s.lastSubmitted, lastDownloaded: s.lastDownloaded, pending: !!s.isPending, index: !!s.isSitemapsIndex, errors: Number(s.errors || 0), warnings: Number(s.warnings || 0), submitted: (s.contents || []).reduce((n, c) => n + Number(c.submitted || 0), 0) })) };
}
/** Problems worth a line in doctor / index: configured sitemap unknown to Google, not read for 14+ days, errors. */
export function sitemapIssues(sitemaps, configured, now = new Date()) {
  const out = [];
  const known = sitemaps.map((s) => s.path);
  if (configured && !known.includes(configured)) out.push(`${configured} is not submitted in Search Console (submit it there, or check the exact URL)`);
  for (const s of sitemaps) {
    const age = s.lastDownloaded ? Math.floor((now - new Date(s.lastDownloaded)) / 86400000) : null;
    if (s.errors) out.push(`${s.path}: ${s.errors} error(s) reported by Google`);
    if (age == null && !s.pending) out.push(`${s.path}: never downloaded by Google`);
    else if (age != null && age > 14) out.push(`${s.path}: last read by Google ${age} days ago`);
  }
  return out;
}

// ---------- DataForSEO (optional, paid per request) ----------
export function dataforseoAuth() {
  const l = process.env.DATAFORSEO_LOGIN, p = process.env.DATAFORSEO_PASSWORD;
  return l && p ? "Basic " + Buffer.from(`${l}:${p}`).toString("base64") : null;
}
export async function dataforseo(endpoint, tasks) {
  const auth = dataforseoAuth();
  if (!auth) missing("DataForSEO", "Set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD (API credentials from app.dataforseo.com). Without it, use suggest.mjs (free) and never invent volumes.");
  const j = await apiJson("https://api.dataforseo.com/v3/" + endpoint, { method: "POST", headers: { Authorization: auth, "Content-Type": "application/json" }, body: JSON.stringify(tasks) });
  if (j.status_code !== 20000) die("DataForSEO error: " + (j.status_message || j.error?.message));
  const t = j.tasks?.[0];
  if (t?.status_code !== 20000) die("DataForSEO task error: " + t?.status_message);
  return { cost: j.cost, result: t.result || [] };
}

// ---------- Web ----------
const UA = "Mozilla/5.0 (compatible; seo-god-mode/1.0; +https://github.com/Siin0pe/seo-god-mode)";
export async function fetchText(url, { timeout = 20000 } = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html,application/xml;q=0.9,*/*;q=0.8" }, redirect: "follow", signal: ctl.signal });
    return { status: r.status, url: r.url, headers: Object.fromEntries(r.headers), text: await r.text() };
  } catch (e) { return { status: 0, url, error: String(e), text: "" }; } finally { clearTimeout(t); }
}
/** Expands a sitemap index recursively. Returns [{loc, lastmod}]. */
export async function sitemapUrls(sitemapUrl, seen = new Set()) {
  if (seen.has(sitemapUrl)) return [];
  seen.add(sitemapUrl);
  const { text, status } = await fetchText(sitemapUrl);
  if (status !== 200) {
    // A broken child sitemap should not hide the URLs of every other one.
    if (seen.size > 1) { console.error(`warning: sitemap ${sitemapUrl} returned ${status}, skipped`); return []; }
    die(`Sitemap ${sitemapUrl} returned ${status}`);
  }
  if (/<sitemapindex/i.test(text)) {
    const subs = [...text.matchAll(/<sitemap>[\s\S]*?<loc>\s*([^<\s]+)\s*<\/loc>[\s\S]*?<\/sitemap>/gi)].map((m) => m[1]);
    return (await Promise.all(subs.map((s) => sitemapUrls(s, seen)))).flat();
  }
  return [...text.matchAll(/<url>([\s\S]*?)<\/url>/gi)].map((m) => ({ loc: (m[1].match(/<loc>\s*([^<\s]+)/i) || [])[1], lastmod: (m[1].match(/<lastmod>\s*([^<\s]+)/i) || [])[1] })).filter((u) => u.loc);
}
export async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } }));
  return out;
}

// ---------- HTML signature (regex-based, good enough for audits; not a DOM) ----------
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&nbsp;/g, " ");
const strip = (s) => decode(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const attr = (tag, name) => (tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i")) || [])[2] ?? (tag.match(new RegExp(`\\b${name}\\s*=\\s*'([^']*)'`, "i")) || [])[1];
const count = (html, re) => (html.match(re) || []).length;
/** Main content = <main> if present, else <body> minus header/nav/footer/aside. */
export function mainHtml(html) {
  const m = html.match(/<main[\s\S]*?<\/main>/i);
  let h = m ? m[0] : (html.match(/<body[\s\S]*<\/body>/i) || [html])[0];
  if (!m) h = h.replace(/<(header|nav|footer|aside)\b[\s\S]*?<\/\1>/gi, " ");
  return h.replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi, " ");
}
export function signature(html, pageUrl = "") {
  const head = (html.match(/<head[\s\S]*?<\/head>/i) || [""])[0];
  const metas = [...head.matchAll(/<meta\b[^>]*>/gi)].map((m) => m[0]);
  const meta = (n) => attr(metas.find((t) => new RegExp(`(name|property)\\s*=\\s*["']${n}["']`, "i").test(t)) || "", "content");
  const links = [...head.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]);
  const main = mainHtml(html);
  const text = strip(main);
  let host = "";
  try { host = new URL(pageUrl).host; } catch {}
  const anchors = [...main.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)[^>]*>([\s\S]*?)<\/a>/gi)].map((m) => ({ href: m[1], text: strip(m[2]) }));
  const internal = anchors.filter((a) => { try { const u = new URL(a.href, pageUrl || "https://x.invalid/"); return !pageUrl || u.host === host; } catch { return false; } });
  const ldTypes = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].flatMap((m) => { try { const j = JSON.parse(m[1]); const walk = (o) => (Array.isArray(o) ? o.flatMap(walk) : o && typeof o === "object" ? [...(o["@type"] ? [].concat(o["@type"]) : []), ...(o["@graph"] ? walk(o["@graph"]) : [])] : []); return walk(j); } catch { return ["INVALID_JSON"]; } });
  return {
    title: strip((head.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || ""),
    description: meta("description") || "",
    robots: meta("robots") || "",
    canonical: attr(links.find((t) => /rel\s*=\s*["']canonical["']/i.test(t)) || "", "href") || "",
    hreflang: links.filter((t) => /hreflang/i.test(t)).map((t) => `${attr(t, "hreflang")}=${attr(t, "href")}`).sort(),
    lang: attr((html.match(/<html\b[^>]*>/i) || [""])[0], "lang") || "",
    // H1 often sits in a hero <header> before <main>: count it over the whole body.
    h1: [...(html.match(/<body[\s\S]*<\/body>/i) || [html])[0].matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => strip(m[1])),
    h2: [...main.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)].map((m) => strip(m[1])),
    words: text ? text.split(" ").length : 0,
    // "Original elements": the things that make a page more than text. Losing one is the classic silent regression.
    elements: {
      form: count(main, /<form\b/gi), input: count(main, /<(input|select|textarea)\b/gi), button: count(main, /<button\b/gi),
      table: count(main, /<table\b/gi), img: count(main, /<img\b/gi), svg: count(main, /<svg\b/gi), video: count(main, /<(video|iframe)\b/gi),
      details: count(main, /<details\b/gi), figure: count(main, /<figure\b/gi), canvas: count(main, /<canvas\b/gi),
    },
    jsonLd: ldTypes.sort(),
    internalLinks: internal.length,
    internalTargets: [...new Set(internal.map((a) => { try { const u = new URL(a.href, pageUrl); u.hash = ""; u.search = ""; return u.href; } catch { return a.href; } }))],
    anchors: internal,
  };
}

// ---------- Checks shared by scripts (pure, unit-tested in CI) ----------
/** Ship gate: what a change from signature a to signature b loses. block = needs the owner's approval. */
export function gateCompare(a, b, label) {
  const block = [], warn = [];
  for (const [k, v] of Object.entries(a.elements)) if ((b.elements[k] ?? 0) < v) (["form", "input", "table", "video", "details", "canvas"].includes(k) ? block : warn).push(`${k}: ${v} → ${b.elements[k] ?? 0}`);
  const lostLd = a.jsonLd.filter((t) => !b.jsonLd.includes(t));
  if (lostLd.length) block.push(`JSON-LD types removed: ${[...new Set(lostLd)].join(", ")}`);
  if (b.jsonLd.includes("INVALID_JSON")) block.push("JSON-LD does not parse");
  if (a.canonical !== b.canonical) block.push(`canonical: ${a.canonical || "∅"} → ${b.canonical || "∅"}`);
  if (a.robots !== b.robots) block.push(`robots meta: "${a.robots}" → "${b.robots}"`);
  const lostHl = a.hreflang.filter((h) => !b.hreflang.includes(h));
  if (lostHl.length) block.push(`hreflang removed: ${lostHl.join(", ")}`);
  if (a.lang !== b.lang) block.push(`html lang: ${a.lang} → ${b.lang}`);
  if (b.h1.length !== 1) warn.push(`H1 count is ${b.h1.length}`);
  if (a.words && b.words < a.words * 0.7) block.push(`words: ${a.words} → ${b.words} (−${Math.round((1 - b.words / a.words) * 100)}%)`);
  else if (a.words && b.words < a.words * 0.9) warn.push(`words: ${a.words} → ${b.words}`);
  if (a.title !== b.title) warn.push(`title changed: "${a.title}" → "${b.title}" (needs approval if the page gets clicks)`);
  if (a.description !== b.description) warn.push("meta description changed");
  if (a.h1[0] !== b.h1[0]) warn.push(`H1: "${a.h1[0]}" → "${b.h1[0]}"`);
  const lostH2 = a.h2.filter((h) => !b.h2.includes(h));
  if (lostH2.length) warn.push(`H2 removed: ${lostH2.slice(0, 6).join(" | ")}`);
  if (b.internalLinks < a.internalLinks * 0.8) warn.push(`internal links: ${a.internalLinks} → ${b.internalLinks}`);
  const lostTargets = a.internalTargets.filter((t) => !b.internalTargets.includes(t));
  if (lostTargets.length) warn.push(`internal link targets dropped: ${lostTargets.slice(0, 5).join(", ")}`);
  if (!b.description) warn.push("no meta description");
  if (b.title.length > 65) warn.push(`title ${b.title.length} chars (may truncate)`);
  return { label, block, warn };
}
/** Prune: the action for one page. Pages of 600+ words are never deletion candidates (veto in code). */
export function pruneAction({ status, noindex, young, seen, clicks, impressions, position, words, minImpr }) {
  if (status !== 200) return `fix: HTTP ${status} in sitemap`;
  if (noindex) return "fix: noindex page listed in sitemap";
  if (young) return "too young: leave it";
  if (!seen) return "check: no impression in 16 months and no lastmod (confirm the publish date)";
  if (clicks > 0 || impressions >= minImpr) return position && position > 10 ? "improve (has demand, ranks deep)" : "keep";
  if (words >= 600) return "improve or merge (substantial page: deletion vetoed)";
  return "merge/redirect or rewrite candidate (owner decides)";
}
/** Twins: main-content words, accents folded ("réseau" → "reseau"), and their 5-word shingles. */
export const contentWords = (html) => mainHtml(html).replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").replace(/[^\p{L}\p{N}\s]+/gu, " ").split(/\s+/).filter(Boolean);
export const shingles = (w, n = 5) => { const s = new Set(); for (let i = 0; i + n <= w.length; i++) s.add(w.slice(i, i + n).join(" ")); return s; };
export const jaccard = (a, b) => { let i = 0; for (const x of a) if (b.has(x)) i++; return i / (a.size + b.size - i || 1); };

// ---------- robots.txt ----------
/** Parses robots.txt into groups [{agents:[...], rules:[{allow:bool, path}]}]. */
export function parseRobots(text) {
  const groups = [];
  let g = null, lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = line.match(/^([\w-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const k = m[1].toLowerCase(), v = m[2].trim();
    if (k === "user-agent") { if (!lastWasAgent) { g = { agents: [], rules: [] }; groups.push(g); } g.agents.push(v.toLowerCase()); lastWasAgent = true; continue; }
    lastWasAgent = false;
    if (g && (k === "allow" || k === "disallow") && (v || k === "allow")) g.rules.push({ allow: k === "allow", path: v });
  }
  return groups;
}
/** Does a robots.txt path pattern match this path? Supports "*" and a trailing "$" (RFC 9309). */
export function robotsMatch(pattern, p) {
  const end = pattern.endsWith("$");
  const body = (end ? pattern.slice(0, -1) : pattern).split("*").map(escRe).join(".*");
  return new RegExp("^" + body + (end ? "$" : "")).test(p);
}
/** Is the site root crawlable for this agent? Every group naming the agent applies (merged), else every "*"
 *  group; the longest matching rule wins, and allow wins a tie. */
export function rootAllowed(groups, agent) {
  const a = agent.toLowerCase();
  let gs = groups.filter((x) => x.agents.some((n) => n !== "*" && a.includes(n)));
  if (!gs.length) gs = groups.filter((x) => x.agents.includes("*"));
  const hits = gs.flatMap((g) => g.rules).filter((r) => robotsMatch(r.path, "/")).sort((p, q) => q.path.length - p.path.length || (p.allow ? -1 : 1));
  return hits.length ? hits[0].allow : true;
}
export const CRAWLERS = { search: ["Googlebot", "Bingbot"], aiRetrieval: ["OAI-SearchBot", "ChatGPT-User", "Claude-SearchBot", "Claude-User", "PerplexityBot", "Perplexity-User"], aiTraining: ["GPTBot", "ClaudeBot", "Google-Extended", "CCBot", "Applebot-Extended", "meta-externalagent", "Bytespider"] };

// ---------- Crawler visits (server logs, Cloudflare) ----------
// The tokens that appear in user agents. Google-Extended and Applebot-Extended are robots.txt tokens only:
// they never show up in logs. A user agent can be spoofed: without reverse-DNS or bot management, counts
// are "requests claiming to be X".
export const CRAWLER_UAS = [
  ["Googlebot", "search"], ["bingbot", "search"], ["Applebot", "search"],
  ["OAI-SearchBot", "aiRetrieval"], ["ChatGPT-User", "aiRetrieval"], ["Claude-SearchBot", "aiRetrieval"], ["Claude-User", "aiRetrieval"], ["PerplexityBot", "aiRetrieval"], ["Perplexity-User", "aiRetrieval"],
  ["GPTBot", "aiTraining"], ["ClaudeBot", "aiTraining"], ["CCBot", "aiTraining"], ["meta-externalagent", "aiTraining"], ["Bytespider", "aiTraining"],
];
export function crawlerOf(ua = "") {
  const u = ua.toLowerCase();
  return CRAWLER_UAS.find(([n]) => u.includes(n.toLowerCase()))?.[0] || null;
}
const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
/** One log line → { ua, path, status, time (ISO) } or null. Reads Vercel Log Drain JSON (proxy.*), generic JSON
 *  logs and the combined access-log format of nginx/Apache/most hosts. */
export function parseLogLine(line) {
  const s = line.trim();
  if (!s) return null;
  if (s.startsWith("{")) {
    let j; try { j = JSON.parse(s); } catch { return null; }
    const p = j.proxy || {};
    const ua = [].concat(p.userAgent ?? j.userAgent ?? j.user_agent ?? j.http_user_agent ?? j.ua ?? "").join(" ");
    let pathname = p.path ?? j.path ?? j.requestPath ?? j.url ?? j.request_uri ?? "";
    try { if (/^https?:/.test(pathname)) pathname = new URL(pathname).pathname; } catch {}
    const ts = p.timestamp ?? j.timestamp ?? j.time ?? j.date;
    const time = ts == null ? null : new Date(typeof ts === "number" && ts < 1e12 ? ts * 1000 : ts);
    return { ua, path: String(pathname).split("?")[0], status: Number(p.statusCode ?? j.statusCode ?? j.status ?? 0), time: time && !isNaN(time) ? time.toISOString() : null };
  }
  const m = s.match(/\[(\d{2})\/(\w{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2}) ([+-]\d{4})\] "(?:[A-Z]+) ([^ "]+)[^"]*" (\d{3}) \S+(?: "[^"]*" "([^"]*)")?/);
  if (!m) return null;
  const [, d, mon, y, H, M, S, tz, reqPath, status, ua = ""] = m;
  const off = (tz[0] === "-" ? -1 : 1) * (Number(tz.slice(1, 3)) * 60 + Number(tz.slice(3)));
  const t = Date.UTC(+y, MONTHS[mon.toLowerCase()], +d, +H, +M, +S) - off * 60000;
  return { ua, path: reqPath.split("?")[0], status: Number(status), time: new Date(t).toISOString() };
}
/** Cloudflare GraphQL Analytics (token with Account Analytics: Read). Throws SourceError on API errors. */
export async function cloudflareGraphql(query, variables) {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) throw new SourceError(missingText("Cloudflare API token", "Create a token with Account → Account Analytics → Read (zone resources: the site's zone) and set CLOUDFLARE_API_TOKEN."), 2);
  const j = await apiJson("https://api.cloudflare.com/client/v4/graphql", { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify({ query, variables }) });
  if (j.error) throw new SourceError("Cloudflare error: " + j.error.message);
  if (j.errors?.length) throw new SourceError("Cloudflare GraphQL error: " + j.errors.map((e) => e.message).join("; "));
  return j.data;
}

// ---------- Output ----------
export const fmt = (n, d = 0) => (n == null || Number.isNaN(n) ? "—" : Number(n).toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d }));
export const pct = (x, d = 1) => (x == null ? "—" : (x * 100).toFixed(d) + "%");
export const delta = (a, b) => (b ? (a - b) / b : a ? Infinity : 0);
export const signed = (x, d = 0) => (x === Infinity ? "new" : (x >= 0 ? "+" : "") + (x * 100).toFixed(d) + "%");
export function table(headers, rows) {
  const esc = (v) => String(v ?? "").replace(/\|/g, "\\|");
  return [`| ${headers.join(" | ")} |`, `|${headers.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r.map(esc).join(" | ")} |`)].join("\n");
}
export const short = (url, cfg) => (cfg?.site && url.startsWith(cfg.site) ? url.slice(cfg.site.length) || "/" : url.replace(/^https?:\/\//, ""));
export function emit(args, md, data) {
  if (args.json) console.log(JSON.stringify(data, null, 2));
  else console.log(md);
  if (args.out) { fs.mkdirSync(path.dirname(args.out), { recursive: true }); fs.writeFileSync(args.out, args.json ? JSON.stringify(data, null, 2) : md); console.error("written " + args.out); }
}

// Organic CTR benchmark by position (non-brand, desktop+mobile blend). Indicative only: SERP features,
// AI Overviews and brand intent move it a lot. Prefer the site's own curve when it has enough data (ctrCurve()).
export const DEFAULT_CTR = [0, 0.27, 0.155, 0.11, 0.08, 0.06, 0.045, 0.035, 0.03, 0.025, 0.02, 0.012, 0.01, 0.009, 0.008, 0.007, 0.006, 0.005, 0.005, 0.004, 0.004];
export function ctrCurve(rows, minImpr = 500) {
  const buckets = Array.from({ length: 21 }, () => ({ c: 0, i: 0 }));
  for (const r of rows) { const p = Math.round(r.position); if (p >= 1 && p <= 20) { buckets[p].c += r.clicks; buckets[p].i += r.impressions; } }
  return buckets.map((b, p) => (p === 0 ? 0 : b.i >= minImpr ? b.c / b.i : DEFAULT_CTR[p]));
}
export const expectedCtr = (curve, pos) => curve[Math.min(20, Math.max(1, Math.round(pos)))] ?? 0.003;
