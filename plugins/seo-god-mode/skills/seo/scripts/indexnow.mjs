// IndexNow ping (Bing, Yandex, Seznam, Naver…; not Google) for URLs you just published or changed.
// Needs INDEXNOW_KEY (or config "indexNowKey") and the file https://<site>/<key>.txt containing the key.
// Bing matters beyond Bing: several AI assistants retrieve through it.
// Usage: node indexnow.mjs <url> [url ...] | --from-sitemap [--dry]
import { parseArgs, loadConfig, sitemapUrls, fetchText, missing, die } from "./lib.mjs";

const args = parseArgs();
const cfg = loadConfig(args);
const key = process.env.INDEXNOW_KEY || cfg.indexNowKey;
if (!key) missing("IndexNow key", "Generate a random 32-char hex key, serve it as /<key>.txt at the site root (owner approval: it ships a file), then set INDEXNOW_KEY.");
const kf = await fetchText(`${cfg.site}/${key}.txt`);
if (kf.status !== 200 || kf.text.trim() !== key) { console.error(`Key file ${cfg.site}/${key}.txt not served correctly (${kf.status}).`); process.exit(2); }
if (args["from-sitemap"] && !cfg.sitemap) die('"sitemap" missing in config: pass URLs instead of --from-sitemap.');
const host = new URL(cfg.site).host;
let urls = args["from-sitemap"] ? (await sitemapUrls(cfg.sitemap)).map((u) => u.loc) : args._;
// IndexNow rejects the whole batch (422) when one URL is on another host.
const offHost = urls.filter((u) => { try { return new URL(u).host !== host; } catch { return true; } });
if (offHost.length) console.error(`skipped ${offHost.length} URL(s) not on ${host}: ${offHost.slice(0, 5).join(", ")}`);
urls = urls.filter((u) => !offHost.includes(u));
if (!urls.length) die("no URLs");
if (urls.length > 10000) console.error(`IndexNow takes 10,000 URLs per call: sending the first 10,000 of ${urls.length}.`);
const body = { host, key, keyLocation: `${cfg.site}/${key}.txt`, urlList: urls.slice(0, 10000) };
if (args.dry) { console.log(JSON.stringify(body, null, 2)); process.exit(0); }
const r = await fetch("https://api.indexnow.org/indexnow", { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify(body) });
console.log(`IndexNow: HTTP ${r.status} for ${body.urlList.length} URL(s) (200/202 = accepted).`);
if (r.status !== 200 && r.status !== 202) { console.error((await r.text()).slice(0, 300)); process.exit(1); }
