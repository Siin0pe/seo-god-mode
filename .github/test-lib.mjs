// CI: unit checks for lib.mjs helpers that have bitten users.
import assert from "node:assert/strict";
import { unmangleMsys } from "../plugins/seo-god-mode/skills/seo/scripts/lib.mjs";

// Git Bash rewrites POSIX-looking arguments before Node sees them.
assert.equal(unmangleMsys("C:/Program Files/Git/learn/"), "/learn/");
assert.equal(unmangleMsys("^C:/Program Files/Git/learn/"), "^/learn/");
assert.equal(unmangleMsys("C:/Program Files/Git/fa/,/learn/x/", true), "/fa/,/learn/x/");
assert.equal(unmangleMsys("C:/Program Files/Git/,/fa/", true), "/,/fa/");
assert.equal(unmangleMsys("A:/,/b/", true), "/a/,/b/");
// Real Windows paths (key files) are left alone.
assert.equal(unmangleMsys("C:/Users/me/.config/key.json"), "C:/Users/me/.config/key.json");
assert.equal(unmangleMsys("D:/keys/sa.json"), "D:/keys/sa.json");
console.log("lib ok");
