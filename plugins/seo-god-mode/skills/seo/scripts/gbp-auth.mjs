// One-time Google Business Profile authorisation (OAuth user consent; GBP does not accept service accounts).
// Opens Google's consent page, catches the redirect on a loopback port (PKCE) and saves the refresh token.
// Usage: node gbp-auth.mjs --client path/to/client_secret.json [--out ~/.config/seo-gbp-oauth.json]
//   --client  the JSON downloaded for an OAuth client of type "Desktop app" (Google Cloud → APIs & Services → Credentials)
//   --out     where to write {client_id, client_secret, refresh_token} (mode 600; keep it outside the repo)
// Sign in with the Google account that owns or manages the profile. Then set GBP_OAUTH=<out>. Times out after 5 minutes.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { parseArgs, die, apiJson } from "./lib.mjs";

const args = parseArgs();
if (!args.client || args.client === true) die("Usage: node gbp-auth.mjs --client path/to/client_secret.json [--out file]");
if (!fs.existsSync(args.client)) die(`Client file not found: ${args.client}`);
const raw = JSON.parse(fs.readFileSync(args.client, "utf8"));
// A "Web application" client only accepts its registered redirect URIs, never a random loopback port.
if (!raw.installed) die(raw.web ? 'This is a "Web application" client. Create an OAuth client of type "Desktop app" and download its JSON.' : 'Not a Google OAuth client file (expected {"installed": {...}}).');
const { client_id, client_secret } = raw.installed;
const out = args.out && args.out !== true ? args.out : path.join(os.homedir(), ".config", "seo-gbp-oauth.json");

const verifier = crypto.randomBytes(48).toString("base64url");
const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
const state = crypto.randomBytes(16).toString("hex");
let redirect = "";

const done = (res, code, msg) => { res.writeHead(code, { "Content-Type": "text/html; charset=utf-8" }); res.end(`<p style="font:16px sans-serif">${msg}</p>`); };
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, redirect);
  if (u.pathname !== "/") return done(res, 404, "Not found");
  if (u.searchParams.get("state") !== state) return done(res, 400, "State mismatch: start gbp-auth.mjs again.");
  if (u.searchParams.get("error")) { done(res, 400, "Authorisation refused. You can close this tab."); die("Authorisation refused: " + u.searchParams.get("error")); }
  const tok = await apiJson("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", code: u.searchParams.get("code") || "", client_id, client_secret, redirect_uri: redirect, code_verifier: verifier }) });
  if (!tok.refresh_token) { done(res, 500, "Token exchange failed: see the terminal."); die("Token exchange failed: " + (tok.error_description || tok.error?.message || tok.error || "no refresh_token returned")); }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({ client_id, client_secret, refresh_token: tok.refresh_token }, null, 2) + "\n", { mode: 0o600 });
  fs.chmodSync(out, 0o600); // an existing file keeps its old mode otherwise
  done(res, 200, "Google Business Profile connected. You can close this tab.");
  console.log(`\nSaved ${out} (keep it private, outside any repo).\nSet it for the scripts:\n  bash:        export GBP_OAUTH="${out}"\n  PowerShell:  $env:GBP_OAUTH = "${out}"\nor put its path in .seo/config.json "credentials": {"gbpOAuth": "..."}. Then: node gbp.mjs locations`);
  server.close();
  process.exit(0);
});
server.listen(0, "127.0.0.1", () => {
  redirect = `http://127.0.0.1:${server.address().port}/`;
  const url = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({ client_id, redirect_uri: redirect, response_type: "code", scope: "https://www.googleapis.com/auth/business.manage", access_type: "offline", prompt: "consent", code_challenge: challenge, code_challenge_method: "S256", state });
  console.log(`Open this URL and sign in with the account that manages the Business Profile:\n\n${url}\n\nWaiting for Google's redirect on ${redirect} (5 minutes)...`);
  // Best effort: the URL is printed anyway. cmd needs the URL quoted (it contains "&"), hence verbatim arguments.
  const [cmd, argv, opts] = process.platform === "win32" ? ["cmd", ["/c", "start", '""', `"${url}"`], { windowsVerbatimArguments: true }] : [process.platform === "darwin" ? "open" : "xdg-open", [url], {}];
  try { spawn(cmd, argv, { ...opts, stdio: "ignore", detached: true }).on("error", () => {}).unref(); } catch {}
});
setTimeout(() => die("Timed out after 5 minutes without Google's redirect. Run gbp-auth.mjs again."), 300000).unref();
