// CI: unit checks for lib.mjs helpers and the ship gate, on the cases that have bitten users.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { unmangleMsys, msysRoots, parseArgs, parseRobots, rootAllowed, robotsMatch, onHost, hostPattern, regDomainOf, urlKey, signature, period, previousWindow, ctrCurve, expectedCtr, DEFAULT_CTR, delta, signed, gateCompare, pruneAction, contentWords, shingles, jaccard, cwvTrend, sitemapIssues, crawlerOf, parseLogLine, gbpSeries, gbpTotals, gbpKeywordValue, gbpReviewStats, gbpDateParams, gbpMonths, gbpError } from "../plugins/seo-god-mode/skills/seo/scripts/lib.mjs";

const scripts = path.join(path.dirname(fileURLToPath(import.meta.url)), "../plugins/seo-god-mode/skills/seo/scripts");

// Git Bash rewrites POSIX-looking arguments before Node sees them.
assert.equal(unmangleMsys("C:/Program Files/Git/learn/"), "/learn/");
assert.equal(unmangleMsys("^C:/Program Files/Git/learn/"), "^/learn/");
assert.equal(unmangleMsys("C:/Program Files/Git/fa/,/learn/x/", true), "/fa/,/learn/x/");
assert.equal(unmangleMsys("C:/Program Files/Git/,/fa/", true), "/,/fa/");
assert.equal(unmangleMsys("A:/,/b/", true), "/a/,/b/");
assert.equal(unmangleMsys("A://", true), "/a/");
// A Git install outside Program Files, found through EXEPATH.
const roots = msysRoots({ EXEPATH: "D:\\tools\\Git\\bin" });
assert.deepEqual(roots, ["D:/tools/Git/"]);
assert.equal(unmangleMsys("D:/tools/Git/learn/", false, roots), "/learn/");
// Real Windows paths (key files, --out, --config) are left alone, even under a folder named "git".
assert.equal(unmangleMsys("C:/Users/me/.config/key.json"), "C:/Users/me/.config/key.json");
assert.equal(unmangleMsys("D:/keys/sa.json"), "D:/keys/sa.json");
assert.equal(unmangleMsys("C:/Users/me/git/repo/r.md"), "C:/Users/me/git/repo/r.md");
assert.equal(unmangleMsys("C:/code/Git/site/.seo/config.json", false, roots), "C:/code/Git/site/.seo/config.json");

// Arguments.
const a = parseArgs(["pos", "--filter", "query~a", "--filter=page=/x", "--days", "7", "--days=28", "--json"]);
assert.deepEqual(a.filter, ["query~a", "page=/x"]);
assert.equal(a.days, "28");
assert.equal(a.json, true);
assert.deepEqual(a._, ["pos"]);
assert.equal(parseArgs(["--before=https://x.test/?a=b&c=d"]).before, "https://x.test/?a=b&c=d");

// robots.txt
const root = (txt, bot) => rootAllowed(parseRobots(txt), bot);
assert.equal(root("User-agent: *\nDisallow: /", "Googlebot"), false);
assert.equal(root("User-agent: *\nDisallow: /*", "Googlebot"), false);
assert.equal(root("User-agent: *\nDisallow: /*.pdf$", "Googlebot"), true);
assert.equal(root("User-agent: *\nDisallow: /$", "Googlebot"), false);
assert.equal(root("User-agent: *\nDisallow: /admin/", "Googlebot"), true);
assert.equal(root("User-agent: *\nDisallow: /\n\nUser-agent: GPTBot\nAllow: /", "GPTBot"), true);
// Two groups for the same agent are merged.
assert.equal(root("User-agent: GPTBot\nAllow: /blog/\n\nUser-agent: GPTBot\nDisallow: /", "GPTBot"), false);
assert.equal(robotsMatch("/fr/*/x$", "/fr/a/x"), true);
assert.equal(robotsMatch("/fr/*/x$", "/fr/a/xy"), false);

// Hosts and URLs.
assert.equal(onHost("https://example.com/a", "example.com"), true);
assert.equal(onHost("https://example.com", "example.com"), true);
assert.equal(onHost("https://notexample.com/a", "example.com"), false);
assert.equal(onHost("https://example.com.evil.io/a", "example.com"), false);
assert.equal(onHost("https://example.com/fr/a", "example.com/fr"), true);
assert.equal(onHost("https://example.com/fred", "example.com/fr"), false);
assert.equal(onHost("https://anything.io/", ""), true);
assert.ok(new RegExp(hostPattern("www.example.com")).test("https://www.example.com/x"));
assert.equal(regDomainOf("www.example.co.uk"), "example.co.uk");
assert.equal(regDomainOf("blog.example.com"), "example.com");
assert.equal(urlKey("https://Example.com/a/?x=1#h"), "https://example.com/a");
assert.equal(urlKey("https://example.com/a"), urlKey("https://example.com/a/"));
assert.equal(urlKey("https://example.com/"), "https://example.com/");

// Signature: relative links are internal when the page URL is known.
const sig = signature('<html lang="en"><head><link rel="canonical" href="https://x.test/p/"></head><body><main><a href="/a/">a</a><a href="https://other.test/">b</a></main></body></html>', "https://x.test/p/");
assert.equal(sig.internalLinks, 1);

// Date windows: days is the real length, also with --start; the previous window touches but never overlaps.
assert.deepEqual(period({ start: "2026-09-01", end: "2026-09-28" }), { start: "2026-09-01", end: "2026-09-28", days: 28 });
assert.equal(period({ end: "2026-09-28", days: 7 }).start, "2026-09-22");
assert.deepEqual(previousWindow({ start: "2026-09-01", end: "2026-09-28" }), { start: "2026-08-04", end: "2026-08-31", days: 28 });

// CTR curve: the site's own CTR only where a position has enough impressions.
const curve = ctrCurve([{ position: 1, clicks: 300, impressions: 1000 }, { position: 2, clicks: 1, impressions: 10 }]);
assert.equal(curve[1], 0.3);
assert.equal(curve[2], DEFAULT_CTR[2]);
assert.equal(expectedCtr(curve, 0.4), 0.3);
assert.equal(expectedCtr(curve, 57), DEFAULT_CTR[20]);
assert.equal(delta(0, 0), 0);
assert.equal(signed(delta(5, 0)), "new");

// Gate rules on signatures.
const base = signature(`<html lang="en"><head><title>T</title><link rel="canonical" href="https://x.test/p/"><script type="application/ld+json">{"@type":"FAQPage"}</script></head><body><main><h1>H</h1><p>${"w ".repeat(400)}</p><table></table></main></body></html>`, "https://x.test/p/");
assert.deepEqual(gateCompare(base, base, "same").block, []);
const thin = signature(`<html lang="en"><head><title>T</title><link rel="canonical" href="https://x.test/p/"></head><body><main><h1>H</h1><p>${"w ".repeat(100)}</p></main></body></html>`, "https://x.test/p/");
const g = gateCompare(base, thin, "thin");
assert.ok(g.block.some((b) => b.startsWith("table")));
assert.ok(g.block.some((b) => b.includes("FAQPage")));
assert.ok(g.block.some((b) => b.startsWith("words")));

// Prune: the 600-word deletion veto, and pages of unknown age are flagged, not "too young" forever.
const page0 = { status: 200, noindex: false, young: false, seen: "2025-01-01", clicks: 0, impressions: 0, position: null, minImpr: 50 };
assert.match(pruneAction({ ...page0, words: 900 }), /deletion vetoed/);
assert.match(pruneAction({ ...page0, words: 200 }), /^merge/);
assert.match(pruneAction({ ...page0, words: 200, seen: null }), /^check/);
assert.match(pruneAction({ ...page0, words: 200, young: true }), /^too young/);
assert.match(pruneAction({ ...page0, words: 200, clicks: 3, position: 14 }), /^improve \(has demand/);
assert.match(pruneAction({ ...page0, status: 404 }), /^fix: HTTP 404/);

// Twins: accents folded, a find-and-replace page scores high, different text low.
assert.deepEqual(contentWords("<main><p>Réseau électrique</p></main>"), ["reseau", "electrique"]);
const body = "we install and repair heat pumps for homes and small offices with a ten year warranty on parts and labour";
const sa = shingles(contentWords(`<main>${body} in austin</main>`)), sb = shingles(contentWords(`<main>${body} in dallas</main>`));
assert.ok(jaccard(sa, sb) >= 0.8);
assert.ok(jaccard(sa, shingles(contentWords("<main>a completely different page about something else entirely with many other words</main>"))) < 0.1);

// CrUX history trend: values N weeks back, and the last week a metric crossed its threshold.
const tr = cwvTrend({ weeks: ["w1", "w2", "w3", "w4", "w5"], p75: { lcp: [2000, 2100, 2600, 2700, 2800], inp: [null, 150, 180, 190, 210], cls: [0.05, 0.05, 0.05, 0.05, 0.05], ttfb: [] } });
assert.equal(tr.lcp.latest, 2800);
assert.equal(tr.lcp.w4, 2000);
assert.equal(tr.lcp.w12, null);
assert.deepEqual(tr.lcp.crossed, { week: "w3", to: "not good" });
assert.deepEqual(tr.inp.crossed, { week: "w5", to: "not good" });
assert.equal(tr.cls.crossed, null);
assert.equal(tr.ttfb.latest, null);

// Sitemaps as Google sees them.
const now = new Date("2026-10-14T00:00:00Z");
const sm = [{ path: "https://x.test/sitemap.xml", lastDownloaded: "2026-10-12T00:00:00Z", pending: false, errors: 0 }, { path: "https://x.test/old.xml", lastDownloaded: "2026-09-01T00:00:00Z", pending: false, errors: 2 }];
assert.deepEqual(sitemapIssues(sm.slice(0, 1), "https://x.test/sitemap.xml", now), []);
const si = sitemapIssues(sm, "https://x.test/new.xml", now);
assert.ok(si.some((i) => i.includes("new.xml is not submitted")));
assert.ok(si.some((i) => i.includes("old.xml: 2 error")));
assert.ok(si.some((i) => i.includes("old.xml: last read by Google 43 days ago")));

// Crawler visits: user agents and log formats.
assert.equal(crawlerOf("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"), "Googlebot");
assert.equal(crawlerOf("Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)"), "bingbot");
assert.equal(crawlerOf("Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-SearchBot/1.0; +https://www.anthropic.com)"), "Claude-SearchBot");
assert.equal(crawlerOf("Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)"), "ClaudeBot");
assert.equal(crawlerOf("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0"), null);
assert.deepEqual(parseLogLine('203.0.113.9 - - [10/Oct/2026:13:55:36 +0200] "GET /learn/x?utm=1 HTTP/1.1" 404 512 "-" "Mozilla/5.0 (compatible; GPTBot/1.2)"'), { ua: "Mozilla/5.0 (compatible; GPTBot/1.2)", path: "/learn/x", status: 404, time: "2026-10-10T11:55:36.000Z" });
const vl = parseLogLine(JSON.stringify({ timestamp: 1791000000000, proxy: { path: "/a/", statusCode: 200, userAgent: ["Mozilla/5.0 (compatible; OAI-SearchBot/1.0)"] } }));
assert.equal(vl.path, "/a/"); assert.equal(vl.status, 200); assert.equal(crawlerOf(vl.ua), "OAI-SearchBot"); assert.ok(vl.time.startsWith("2026-"));
assert.equal(parseLogLine("garbage"), null);

// Google Business Profile: zero values are omitted by the API (int64 strings otherwise).
const gs = gbpSeries({ multiDailyMetricTimeSeries: [{ dailyMetricTimeSeries: [
  { dailyMetric: "CALL_CLICKS", timeSeries: { datedValues: [{ date: { year: 2026, month: 9, day: 2 }, value: "3" }, { date: { year: 2026, month: 9, day: 1 } }] } },
  { dailyMetric: "WEBSITE_CLICKS", timeSeries: {} },
] }, { dailyMetricTimeSeries: [{ dailyMetric: "BUSINESS_IMPRESSIONS_MOBILE_MAPS", timeSeries: { datedValues: [{ date: { year: 2026, month: 10, day: 5 }, value: "12" }] } }] }] });
assert.deepEqual(gs.CALL_CLICKS, [{ date: "2026-09-01", value: 0 }, { date: "2026-09-02", value: 3 }]);
assert.deepEqual(gs.WEBSITE_CLICKS, []);
assert.deepEqual(gbpTotals(gs, "2026-09-02", "2026-10-05"), { CALL_CLICKS: 3, WEBSITE_CLICKS: 0, BUSINESS_IMPRESSIONS_MOBILE_MAPS: 12 });
assert.deepEqual(gbpTotals(gs, "2026-09-03", "2026-10-04"), { CALL_CLICKS: 0, WEBSITE_CLICKS: 0, BUSINESS_IMPRESSIONS_MOBILE_MAPS: 0 });
assert.deepEqual(gbpSeries({}), {});
assert.deepEqual(gbpKeywordValue({ value: "120" }), { value: 120, below: null });
assert.deepEqual(gbpKeywordValue({ threshold: "15" }), { value: null, below: 15 });
assert.deepEqual(gbpKeywordValue(undefined), { value: null, below: null });
assert.equal(gbpDateParams("dailyRange.start_date", "2026-09-07"), "dailyRange.start_date.year=2026&dailyRange.start_date.month=9&dailyRange.start_date.day=7");
assert.deepEqual(gbpMonths(3, "2026-02-14"), { start: { year: 2025, month: 11 }, end: { year: 2026, month: 1 } });
assert.deepEqual(gbpMonths(1, "2026-10-01"), { start: { year: 2026, month: 9 }, end: { year: 2026, month: 9 } });
const rs = gbpReviewStats([
  { starRating: "FIVE", updateTime: "2026-09-01T00:00:00Z", reviewReply: { comment: "thanks" } },
  { starRating: "ONE", updateTime: "2026-09-03T00:00:00Z", comment: "late" },
  { starRating: "FIVE", updateTime: "2026-09-05T00:00:00Z" },
  { starRating: "STAR_RATING_UNSPECIFIED", updateTime: "2026-08-01T00:00:00Z" },
]);
assert.deepEqual(rs.dist, { 1: 1, 2: 0, 3: 0, 4: 0, 5: 2 });
assert.equal(rs.replied, 0.25);
assert.deepEqual(rs.unanswered.map((r) => r.stars), [5, 1, null]);
assert.equal(gbpReviewStats([]).replied, null);
// Access not approved yet (quota 0) and a disabled API are setup problems (exit 2) with the fix in the message.
const perfUrl = "https://businessprofileperformance.googleapis.com/v1/locations/1:fetchMultiDailyMetricsTimeSeries";
const q0 = gbpError({ code: 429, status: "RESOURCE_EXHAUSTED", message: "Quota exceeded for quota metric 'Requests' ... limit '0'" }, perfUrl);
assert.equal(q0.code, 2);
assert.match(q0.message, /developers\.google\.com\/my-business\/content\/prereqs/);
const off = gbpError({ code: 403, status: "PERMISSION_DENIED", message: "API has not been used in project 1 before or it is disabled.", details: [{ reason: "SERVICE_DISABLED" }] }, perfUrl);
assert.equal(off.code, 2);
assert.match(off.message, /Business Profile Performance API/);
assert.equal(gbpError({ code: 403, message: "The caller does not have permission" }, "https://mybusiness.googleapis.com/v4/accounts/1/locations/2/reviews").code, 1);

// Ship gate, end to end on files.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "seo-gate-"));
const page = (extra = "") => `<html lang="en"><head><title>T</title><meta name="description" content="d"><link rel="canonical" href="https://x.test/p/"></head><body><main><h1>H</h1><p>${"word ".repeat(300)}</p><a href="/a/">a</a><a href="/b/">b</a>${extra}</main></body></html>`;
fs.writeFileSync(path.join(tmp, "before.html"), page("<form><input></form>"));
fs.writeFileSync(path.join(tmp, "same.html"), page("<form><input></form>"));
fs.writeFileSync(path.join(tmp, "noform.html"), page());
const gate = (...args) => spawnSync(process.execPath, [path.join(scripts, "ship-gate.mjs"), ...args], { encoding: "utf8", cwd: tmp });
assert.equal(gate("--before", path.join(tmp, "before.html"), "--after", path.join(tmp, "same.html")).status, 0);
const lost = gate("--before", path.join(tmp, "before.html"), "--after", path.join(tmp, "noform.html"));
assert.equal(lost.status, 1, lost.stdout + lost.stderr);
assert.match(lost.stdout, /form: 1 → 0/);
// The page URL comes from the canonical: no "every link counts as internal" warning.
assert.doesNotMatch(lost.stderr, /no page URL/);
fs.rmSync(tmp, { recursive: true, force: true });

console.log("lib ok");
