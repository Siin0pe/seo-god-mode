// Free keyword discovery from Google Autocomplete (no volumes). Expands a seed with prefix/suffix wildcards and
// a-z, so you see the patterns people actually type. Volumes must come from DataForSEO (keywords.mjs volume),
// Google Ads Keyword Planner or Search Console impressions, never from the model's memory.
// Usage: node suggest.mjs "<seed>" [--hl en] [--gl us] [--deep] [--json]
import { parseArgs, emit, die } from "./lib.mjs";

const args = parseArgs();
const seed = args._.join(" ");
if (!seed) die('usage: suggest.mjs "<seed>"');
const hl = args.hl || "en", gl = args.gl || "us";
// A failed probe (network, 429) must not end the run or pass for "no suggestion": count it and say so.
const failed = [];
async function ac(q) {
  let r;
  try { r = await fetch(`https://suggestqueries.google.com/complete/search?client=firefox&hl=${hl}&gl=${gl}&q=${encodeURIComponent(q)}`, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(15000) }); }
  catch (e) { failed.push(`${q}: ${e.name === "TimeoutError" ? "timeout" : "network error"}`); return []; }
  if (!r.ok) { failed.push(`${q}: HTTP ${r.status}`); return []; }
  const buf = Buffer.from(await r.arrayBuffer());
  try { return JSON.parse(new TextDecoder(/charset=([^;]+)/i.exec(r.headers.get("content-type") || "")?.[1] || "utf-8").decode(buf))[1] || []; } catch { return []; }
}
const probes = [seed, `${seed} `, `* ${seed}`, `${seed} *`, `${seed} vs`, `${seed} for`, `${seed} without`, `best ${seed}`, `${seed} alternative`, `how to ${seed}`, `is ${seed}`, `why ${seed}`];
if (args.deep) for (const c of "abcdefghijklmnopqrstuvwxyz") probes.push(`${seed} ${c}`);
const seen = new Map();
for (const p of probes) { for (const s of await ac(p)) if (!seen.has(s)) seen.set(s, p); await new Promise((r) => setTimeout(r, 150)); }
const list = [...seen.keys()];
if (failed.length) console.error(`${failed.length}/${probes.length} probes failed (${[...new Set(failed.map((f) => f.split(": ")[1]))].join(", ")}): the list is incomplete.`);
if (failed.length === probes.length) process.exit(1);
// Group by the word that varies around the seed to expose patterns ("[seed] for [X]", "[X] [seed]").
const patterns = new Map();
for (const s of list) {
  // Autocomplete answers in lowercase: match the seed case-insensitively.
  const i = s.toLowerCase().indexOf(seed.toLowerCase());
  const after = i >= 0 ? s.slice(i + seed.length).trim().split(" ")[0] : "";
  const pat = i < 0 ? "other (seed rewritten)" : i > 0 ? "{x} {seed}…" : after ? `{seed} ${after} …` : "{seed}";
  patterns.set(pat, [...(patterns.get(pat) || []), s]);
}
let md = `## Autocomplete for "${seed}" (hl=${hl}, gl=${gl}) — ${list.length} suggestions, no volumes\n\n`;
for (const [p, items] of [...patterns].sort((a, b) => b[1].length - a[1].length)) md += `**${p}** (${items.length})\n${items.map((i) => `- ${i}`).join("\n")}\n\n`;
emit(args, md, { seed, suggestions: list, patterns: Object.fromEntries(patterns) });
