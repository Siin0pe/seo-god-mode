// CI: the marketplace and plugin manifests must agree on the plugin name and version.
import fs from "node:fs";

const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const m = read(".claude-plugin/marketplace.json");
const p = read("plugins/seo-god-mode/.claude-plugin/plugin.json");
const entry = m.plugins.find((x) => x.name === p.name);
if (!entry) throw new Error(`${p.name} is missing from marketplace.json`);
for (const v of [m.metadata.version, entry.version]) if (v !== p.version) throw new Error(`version mismatch: ${v} vs ${p.version}`);
console.log("ok", p.name, p.version);
