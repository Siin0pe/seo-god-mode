// Local SEO: reads a rank-map export (a grid of points across the area, the Business Profile's position at each)
// and turns it into decisions. Top-3% = share of points where the profile is in positions 1-3 (position 4 is
// worth nothing in the map pack). Shows the weakest direction, the cheap wins (positions 4-6), and, given the
// leaders' exports, whether to build topical pages (below 25% of the leader) or push outward into the yellow zones.
// Usage: node rankmap.mjs <yours.csv> [--vs leader1.csv,leader2.csv]
//   CSV columns (header names are matched loosely): point, latitude/lat, longitude/lng/lon, position/rank.
//   Empty, 0, "-" or >20 position = not ranking at that point.
import fs from "node:fs";
import path from "node:path";
import { parseArgs, table, emit } from "./lib.mjs";

const args = parseArgs();
if (!args._[0]) { console.error("usage: rankmap.mjs <yours.csv> [--vs leader.csv,...]"); process.exit(1); }

function load(file) {
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/).filter((l) => l.trim());
  const sep = lines[0].includes(";") && !lines[0].includes(",") ? ";" : ",";
  const head = lines[0].split(sep).map((h) => h.trim().toLowerCase().replace(/"/g, ""));
  const col = (...names) => head.findIndex((h) => names.some((n) => h === n || h.startsWith(n)));
  const ci = { point: col("point", "id", "name"), lat: col("latitude", "lat"), lng: col("longitude", "lng", "lon"), pos: col("position", "rank", "pos") };
  if (ci.lat < 0 || ci.lng < 0 || ci.pos < 0) { console.error(`${file}: need latitude, longitude and position columns (found: ${head.join(", ")})`); process.exit(1); }
  return lines.slice(1).map((l, i) => { const c = l.split(sep).map((x) => x.trim().replace(/"/g, "")); const p = Number(c[ci.pos]); return { point: ci.point >= 0 ? c[ci.point] : String(i + 1), lat: Number(c[ci.lat]), lng: Number(c[ci.lng]), pos: p >= 1 && p <= 20 ? p : null }; }).filter((r) => !Number.isNaN(r.lat) && !Number.isNaN(r.lng));
}
const top3 = (pts) => pts.filter((p) => p.pos && p.pos <= 3).length / (pts.length || 1);
const pct = (x) => Math.round(x * 100) + "%";

const mine = load(args._[0]);
const cLat = mine.reduce((s, p) => s + p.lat, 0) / mine.length, cLng = mine.reduce((s, p) => s + p.lng, 0) / mine.length;
const DIRS = ["E", "NE", "N", "NW", "W", "SW", "S", "SE"];
const dirOf = (p) => { const dy = p.lat - cLat, dx = (p.lng - cLng) * Math.cos((cLat * Math.PI) / 180); if (Math.hypot(dx, dy) < 1e-9) return "center"; const a = (Math.atan2(dy, dx) * 180) / Math.PI; return DIRS[Math.round(((a + 360) % 360) / 45) % 8]; };
const byDir = new Map();
for (const p of mine) { const d = dirOf(p); byDir.set(d, [...(byDir.get(d) || []), p]); }
const dirRows = [...byDir].map(([d, ps]) => ({ dir: d, points: ps.length, top3: top3(ps), yellow: ps.filter((p) => p.pos >= 4 && p.pos <= 10).length, red: ps.filter((p) => !p.pos || p.pos > 10).length })).sort((a, b) => b.top3 - a.top3 || a.red / a.points - b.red / b.points);
const mineTop3 = top3(mine);
const cheap = mine.filter((p) => p.pos >= 4 && p.pos <= 6).sort((a, b) => a.pos - b.pos);

let md = `## Rank map — ${path.basename(args._[0])}\n\n**Top-3%: ${pct(mineTop3)}** (${mine.filter((p) => p.pos && p.pos <= 3).length} of ${mine.length} points in positions 1-3). Positions 4+ get almost no clicks from the map pack.\n\n`;
md += table(["direction", "points", "top-3%", "yellow (4-10)", "red (none / >10)"], dirRows.map((r) => [r.dir, r.points, pct(r.top3), r.yellow, r.red]));
const weakest = dirRows.filter((r) => r.dir !== "center").at(-1);
if (weakest) md += `\n\nStrongest: **${dirRows[0].dir}**. Weakest: **${weakest.dir}** (${pct(weakest.top3)}).`;
md += `\n\n### Cheapest wins: points in positions 4-6\n\n` + (cheap.length ? table(["point", "lat", "lng", "position", "direction"], cheap.map((p) => [p.point, p.lat, p.lng, p.pos, dirOf(p)])) : "_None._");

const out = { file: args._[0], top3: mineTop3, directions: dirRows, cheap };
if (args.vs) {
  const leaders = String(args.vs).split(",").map((f) => ({ file: path.basename(f), top3: top3(load(f)) })).sort((a, b) => b.top3 - a.top3);
  const ceiling = leaders[0].top3, ratio = ceiling ? mineTop3 / ceiling : 0;
  out.leaders = leaders; out.ratioToLeader = ratio;
  md += `\n\n### Against the leaders\n\n` + table(["profile", "top-3%"], [["yours", pct(mineTop3)], ...leaders.map((l) => [l.file, pct(l.top3)])]);
  md += `\n\nThe leader's top-3% is your ceiling (${pct(ceiling)}). You are at **${pct(ratio)} of it**. `;
  md += ratio < 0.25
    ? "Below 25%: Google does not yet believe you are the expert for this service. Build topical pages answering the questions customers ask (one per category and service first, the \"Core 30\"), complete the profile, and ask for reviews that name the service and the place."
    : ratio < 0.5
      ? "Between 25% and 50%: the base is there. Finish the core pages, then start on the weakest direction."
      : "50% or more: push outward. Build pages about the places in your yellow zones (neighbourhoods and landmarks Google Maps already names), each written about the place itself, never a name swap.";
}
md += `\n\nRe-run 30 days after any change, on the same grid and keyword.`;
emit(args, md, out);
