// Pre-publish regression gate. Compares the SEO signature of a page before and after a change and fails on
// silent losses: an interactive element, a table, a JSON-LD type or an FAQ disappearing, the canonical or robots
// changing, hreflang removed, a big word-count drop. This is the guard against "the agent rewrote the page and
// quietly dropped the one original thing on it".
// Usage:
//   node ship-gate.mjs --before <url|file.html> --after <url|file.html>
//   node ship-gate.mjs --dist <built-site-dir> [--base https://live.site] [--paths /a/,/b/]   (built output vs live)
//   node ship-gate.mjs --published <url,url>   after deploy: 200, indexable, self-canonical, listed in the live sitemap
// The sitemap check matters once an agent publishes outside a CMS: nothing warns you when the sitemap stops
// listing new pages, and Google quietly stops learning what exists.
// Exit code: 0 pass, 1 blocking regression (needs explicit owner approval), 3 warnings only,
//            2 nothing checked (no built page matched --dist/--paths, or a --before/--after URL is not a 200).
import fs from "node:fs";
import path from "node:path";
import { parseArgs, loadConfig, fetchText, signature, sitemapUrls, requireSitemap, urlKey, gateCompare, table, emit, die } from "./lib.mjs";

const args = parseArgs();
// An error page as "before" would make every loss invisible: a fetch that is not a 200 stops the gate.
const load = async (src) => {
  if (!/^https?:/.test(src)) return fs.readFileSync(src, "utf8");
  const r = await fetchText(src);
  if (r.status !== 200) die(`${src} returned ${r.status || r.error}: nothing to compare.`, 2);
  return r.text;
};


const pathOf = (u) => { try { return new URL(u).pathname; } catch { return u; } };
const absolute = (u, base) => { try { return new URL(u, base).href; } catch { return u; } };
const noindex = (sig) => /noindex/i.test(sig.robots);
let results = [];
if (args.published) {
  const cfg = loadConfig(args);
  const listed = new Set((await sitemapUrls(requireSitemap(cfg))).map((u) => pathOf(u.loc)));
  for (const url of String(args.published).split(",")) {
    const r = await fetchText(url), block = [], warn = [];
    if (r.status !== 200) block.push(`HTTP ${r.status}`);
    else {
      const sig = signature(r.text, url);
      if (noindex(sig)) block.push("robots meta says noindex");
      if (!sig.canonical) warn.push("no canonical tag");
      else if (urlKey(absolute(sig.canonical, r.url)) !== urlKey(r.url)) block.push(`canonical points elsewhere: ${sig.canonical}`);
      if (!listed.has(pathOf(url))) block.push(`not listed in the live sitemap (${cfg.sitemap})`);
      if (/noindex/i.test(r.headers["x-robots-tag"] || "")) block.push("X-Robots-Tag header says noindex");
    }
    results.push({ label: url, block, warn });
  }
} else if (args.dist) {
  const cfg = args.base ? { site: args.base.replace(/\/$/, "") } : loadConfig(args);
  const files = [];
  const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (f === "index.html") files.push(p); } };
  walk(args.dist);
  // Normalise "/a" → "/a/" and "a/" → "/a/": built pages are compared as /dir/ paths.
  let pathsOnly = args.paths ? String(args.paths).split(",").map((p) => ("/" + p.trim().replace(/^\/+|\/+$/g, "") + "/").replace(/^\/\/$/, "/")) : null;
  // Sitemaps produced by the build: every indexable page should be in one of them.
  const maps = fs.readdirSync(args.dist).filter((f) => /^sitemap.*\.xml$/i.test(f));
  const built = new Set(maps.flatMap((f) => [...fs.readFileSync(path.join(args.dist, f), "utf8").matchAll(/<loc>\s*([^<\s]+)/gi)].map((m) => m[1])).filter((u) => !/sitemap.*\.xml$/i.test(u)).map(pathOf));
  if (!maps.length) results.push({ label: "(build)", block: [], warn: ["no sitemap*.xml in the build output: check how the sitemap is generated"] });
  for (const f of files) {
    const rel = "/" + path.relative(args.dist, path.dirname(f)).split(path.sep).join("/");
    const urlPath = rel === "/" ? "/" : rel + "/";
    if (pathsOnly && !pathsOnly.includes(urlPath)) continue;
    const after = signature(fs.readFileSync(f, "utf8"), cfg.site + urlPath);
    const inMap = !maps.length || noindex(after) || built.has(urlPath);
    const live = await fetchText(cfg.site + urlPath);
    // 404/410 live = a page this build adds. Anything else (5xx, timeout) means the live page could not be read,
    // and an unread page must not pass as new.
    if (live.status === 404 || live.status === 410) { results.push({ label: urlPath, block: inMap ? [] : ["new page missing from the built sitemap"], warn: [`new page (live ${live.status})`] }); continue; }
    if (live.status !== 200) { results.push({ label: urlPath, block: [`live page unreadable (${live.status || live.error}): cannot compare, re-run`], warn: [] }); continue; }
    const r = gateCompare(signature(live.text, cfg.site + urlPath), after, urlPath);
    if (!inMap) r.warn.push("not in the built sitemap");
    results.push(r);
  }
  // A gate that checked nothing must not look like a pass.
  const checked = results.filter((r) => r.label !== "(build)").length;
  const missingPaths = pathsOnly ? pathsOnly.filter((p) => !results.some((r) => r.label === p)) : [];
  if (!checked || missingPaths.length) {
    console.error(`Ship gate checked ${checked} page(s). ${missingPaths.length ? `No built page for: ${missingPaths.join(", ")}. ` : ""}Check --dist (${args.dist}) and --paths (URL paths like /learn/, comma-separated).`);
    process.exit(2);
  }
} else {
  if (!args.before || !args.after) die("Usage: ship-gate.mjs --before <url|file> --after <url|file> | --dist <dir> | --published <urls> (see --help)");
  const [before, after] = [await load(args.before), await load(args.after)];
  // The page URL tells internal links from external ones. From files, fall back to the declared canonical.
  const isUrl = (s) => /^https?:/.test(s);
  const url = [args.url, args.before, args.after, signature(before).canonical, signature(after).canonical].find((u) => typeof u === "string" && isUrl(u)) || "";
  if (!url) console.error("warning: no page URL (pass --url): every link counts as internal.");
  results.push(gateCompare(signature(before, url), signature(after, url), args.after));
}
const blocked = results.filter((r) => r.block.length), warned = results.filter((r) => !r.block.length && r.warn.length);
let md = `## Ship gate — ${results.length} page(s): ${blocked.length} blocked, ${warned.length} with warnings\n\n`;
if (blocked.length) md += "### Blocking (do not publish without explicit approval)\n\n" + table(["page", "regressions"], blocked.map((r) => [r.label, r.block.join("; ")])) + "\n\n";
if (warned.length || blocked.some((r) => r.warn.length)) md += "### Warnings\n\n" + table(["page", "warnings"], results.filter((r) => r.warn.length).map((r) => [r.label, r.warn.join("; ")])) + "\n";
if (!blocked.length && !warned.length) md += "No regression detected.\n";
if (args.published) md += "\nPages that pass are live, indexable and in the sitemap: request indexing for them (index-status.mjs gives today's order) and log the change in .seo/log.md.\n";
emit(args, md, results);
process.exitCode = blocked.length ? 1 : warned.length ? 3 : 0;
