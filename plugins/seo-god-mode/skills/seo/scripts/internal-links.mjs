// Internal link graph from body content (main element, nav/header/footer excluded): orphans, pages under the
// in-link floor, and for each weak page the best source pages to link FROM, chosen with Search Console data
// (pages that already get impressions for the target's queries are topically closest) plus the anchor to use.
// Usage: node internal-links.mjs [--min 5] [--days 90] [--limit 25] [--json]
import { parseArgs, loadConfig, sitemapUrls, fetchText, signature, pool, gsc, gscObjects, period, queryClass, urlKey, table, short, emit } from "./lib.mjs";

const args = parseArgs();
const cfg = loadConfig(args);
const floor = Number(args.min || 5);
const urls = (await sitemapUrls(cfg.sitemap)).map((u) => u.loc);
// Links, sitemap and Search Console are matched on urlKey(): "/a" linked as "/a/" is still a link to the page.
const byKey = new Map(urls.map((u) => [urlKey(u), u]));
const set = new Set(urls);
const pages = await pool(urls, 5, async (u) => { const r = await fetchText(u); return { url: u, sig: r.status === 200 ? signature(r.text, u) : null }; });
const inl = new Map(urls.map((u) => [u, new Set()]));
const anchorsTo = new Map();
for (const p of pages) for (const a of p.sig?.anchors || []) {
  let t; try { t = byKey.get(urlKey(new URL(a.href, p.url).href)); } catch { continue; }
  if (!t || t === p.url) continue;
  inl.get(t).add(p.url);
  anchorsTo.set(t, [...(anchorsTo.get(t) || []), a.text]);
}
const win = period(args, 90);
const pq = gscObjects(await gsc(cfg, { startDate: win.start, endDate: win.end, dimensions: ["page", "query"] }), ["page", "query"]).filter((r) => queryClass(cfg, r.query) !== "brand").map((r) => ({ ...r, page: byKey.get(urlKey(r.page)) || r.page }));
const queriesOf = new Map();
for (const r of pq) queriesOf.set(r.page, [...(queriesOf.get(r.page) || []), r]);
const words = (s) => new Set(s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 3));

const weak = urls.filter((u) => inl.get(u).size < floor && u.replace(/\/$/, "") !== cfg.site).map((u) => {
  const own = (queriesOf.get(u) || []).sort((a, b) => b.impressions - a.impressions);
  const topQ = own.slice(0, 5).map((r) => r.query);
  const sig = pages.find((p) => p.url === u)?.sig;
  // Candidate sources: pages with impressions on the same queries, else pages sharing title words.
  const scores = new Map();
  for (const q of topQ) for (const r of pq) if (r.query === q && r.page !== u && set.has(r.page)) scores.set(r.page, (scores.get(r.page) || 0) + r.impressions);
  if (scores.size < 3 && sig) { const tw = words(sig.title); for (const p of pages) if (p.sig && p.url !== u) { const ov = [...words(p.sig.title + " " + p.sig.h2.join(" "))].filter((w) => tw.has(w)).length; if (ov) scores.set(p.url, (scores.get(p.url) || 0) + ov); } }
  const sources = [...scores.entries()].filter(([s]) => !inl.get(u).has(s)).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([s]) => s);
  return { url: u, inlinks: inl.get(u).size, anchor: topQ[0] || sig?.h1?.[0] || sig?.title, sources, existingAnchors: [...new Set((anchorsTo.get(u) || []).map((t) => (t.length > 60 ? t.slice(0, 57) + "…" : t)))].slice(0, 4) };
}).sort((a, b) => a.inlinks - b.inlinks);
const orphans = weak.filter((w) => w.inlinks === 0);
let md = `## Internal links — ${urls.length} sitemap pages\n\nIn-links counted from body content only (a link in a sentence says what the target is about; menu and footer links say little). Floor: ${floor}. Orphans: ${orphans.length}. Under the floor: ${weak.length}.\n\nFor each page: add links from the suggested sources, inside a relevant sentence, with the suggested anchor or a natural variant (exact match is fine internally). Run ship-gate on edited pages before publishing.\n\n`;
md += weak.length ? table(["page", "in-links", "anchor to use", "link from (not linking yet)", "current anchors"], weak.slice(0, Number(args.limit || 25)).map((w) => [short(w.url, cfg), w.inlinks, w.anchor || "", w.sources.map((s) => short(s, cfg)).join(", "), w.existingAnchors.join(" / ")])) : "_Every page meets the floor._";
emit(args, md, { weak, graph: Object.fromEntries([...inl].map(([k, v]) => [k, [...v]])) });
