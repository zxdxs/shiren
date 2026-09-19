#!/usr/bin/env node
/* ============================================================
   解開 assets/vault.js → private/d-content.json（本機編輯用）
   ------------------------------------------------------------
   用法：node tools/vault-open.js "你的通關語"

   private/ 已列入 .gitignore，不會被推上 GitHub。
   編輯完再用 make-vault.js --from 重新加密：
     node tools/make-vault.js "新通關語" --from private/d-content.json
   ============================================================ */
const fs = require("fs");
const path = require("path");
const C = require("../assets/crypto.js");

const ROOT = path.join(__dirname, "..");
function localPass(){
  try { return fs.readFileSync(path.join(ROOT, "private", "passphrase.txt"), "utf8").trim().split("\n")[0].trim(); }
  catch (e) { return ""; }
}
const PASS = process.argv[2] || process.env.SHREN_PASS || localPass();
if (!PASS) { console.error('✗ 用法：node tools/vault-open.js "你的通關語"'); process.exit(1); }

const ctx = { window: {} };
require("vm").createContext(ctx);
require("vm").runInContext(fs.readFileSync(path.join(ROOT, "assets", "vault.js"), "utf8"), ctx);
const vault = ctx.window.SHREN_VAULT;
if (!vault || !vault.ct) { console.error("✗ 找不到 assets/vault.js 的密文"); process.exit(1); }

C.decrypt(vault, PASS).then(function (data) {
  const dir = path.join(ROOT, "private");
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, "d-content.json");
  fs.writeFileSync(out, JSON.stringify(data, null, 2), "utf8");
  const n = (data.dFull || []).length + Object.keys(data.forms || {}).length +
    Object.keys(data.chapters || {}).reduce(function (a, k) { return a + data.chapters[k].length; }, 0) +
    (data.zunjing || []).length;
  console.log("✓ 已解密 " + n + " 項 → private/d-content.json");
  console.log("  編輯後重新加密：node tools/make-vault.js \"通關語\" --from private/d-content.json");
}).catch(function () {
  console.error("✗ 通關語不正確，或密文損毀。");
  process.exit(1);
});
