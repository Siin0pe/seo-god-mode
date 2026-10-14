// CI: unit checks for lib.mjs helpers and the ship gate, on the cases that have bitten users.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { unmangleMsys, msysRoots, parseArgs, parseRobots, rootAllowed, robotsMatch, onHost, hostPattern, regDomainOf, urlKey, signature, period, previousWindow, ctrCurve, expectedCtr, DEFAULT_CTR, delta, signed, gateCompare, pruneAction, contentWords, shingles, jaccard } from "../plugins/seo-god-mode/skills/seo/scripts/lib.mjs";

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
