#!/usr/bin/env node
/* ============================================================
   產生 assets/vault.js（D 級內容的密文）
   ------------------------------------------------------------
   用法：
     node tools/make-vault.js "你的通關語"
   或   SHREN_PASS="你的通關語" node tools/make-vault.js

   會把 data.js 裡的 D 級內容抽出來加密，寫成 assets/vault.js。
   通關語只存在你的腦子裡——它不會被寫進任何檔案。
   ============================================================ */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const C = require("../assets/crypto.js");

const ROOT = path.join(__dirname, "..");
const argv = process.argv.slice(2);
const fromIdx = argv.indexOf("--from");
const FROM = fromIdx >= 0 ? argv[fromIdx + 1] : null;
function localPass(){
  try { return fs.readFileSync(path.join(ROOT, "private", "passphrase.txt"), "utf8").trim().split("\n")[0].trim(); }
  catch (e) { return ""; }
}
const PASS = (argv[0] && argv[0] !== "--from") ? argv[0] : (process.env.SHREN_PASS || localPass());

if (!PASS) {
  console.error("✗ 請提供通關語：node tools/make-vault.js \"你的通關語\"");
  process.exit(1);
}
if (PASS.length < 8) {
  console.error("✗ 通關語太短。這個檔案會放在公開的 repo 上，請至少用 12 個字元以上。");
  process.exit(1);
}

// payload 來源：--from <json> 或 data.js
const payload = { dFull: [], forms: {}, chapters: {}, zunjing: [] };

if (FROM) {
  const src = JSON.parse(fs.readFileSync(path.resolve(FROM), "utf8"));
  Object.assign(payload, src);
  console.log("· 來源：本機明文檔 " + FROM + "（不會被上傳）");
}

// 讀 data.js
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, "assets", "data.js"), "utf8"), ctx);
const S = ctx.window.STATION;

// 從 data.js 抽內容（僅在未指定 --from 時）
if (!FROM) {
(S.classics.dFull.passages || []).forEach(function (p) {
  if (p.text) payload.dFull.push({ title: p.title, text: p.text, split: p.split });
});

(S.classics.twentyFive.elements || []).forEach(function (e) {
  if (e.originalFull) payload.forms[e.k] = e.originalFull;
});

(S.wangzhen.chapters || []).forEach(function (c) {
  (c.dLevel || []).forEach(function (d) {
    if (!d.text) return;
    (payload.chapters[c.id] = payload.chapters[c.id] || []).push({ text: d.text, why: d.why });
  });
});

(S.zunjing.dLevel || []).forEach(function (d) {
  if (d.text) payload.zunjing.push({ text: d.text, why: d.why });
});
}

/* 逐鍵統計：任何新加入 vault 的鍵都會自動被算到，不會漏報。 */
const LABELS = {
  dFull: "古法體型 D 級", forms: "完整原文", chapters: "內經各章 D 級",
  zunjing: "遵經 D 級", posture: "姿態 D 級", bingjian: "《冰鑑》D 級",
  xiaotianshi: "蕭天石·版權受限"
};
function tally(v) {
  if (Array.isArray(v)) return v.length;               /* 清單：算條數 */
  if (v && typeof v === "object") {                    /* 映射：每個鍵算一項，
                                                          值是清單則算其長度 */
    return Object.keys(v).reduce(function (a, k) {
      var x = v[k];
      return a + (Array.isArray(x) ? x.length : 1);
    }, 0);
  }
  return 0;
}
const parts = [];
let count = 0;
Object.keys(payload).forEach(function (k) {
  const n = tally(payload[k]);
  count += n;
  parts.push((LABELS[k] || k) + " " + n);
});
if (!count) {
  console.error("✗ 找不到 D 級內容。\n  若 data.js 已清空（正常，因為明文已加密），請改用：\n" +
    "    node tools/vault-open.js \"通關語\"        # 先解密出 private/d-content.json\n" +
    "    node tools/make-vault.js \"新通關語\" --from private/d-content.json");
  process.exit(1);
}

C.encrypt(payload, PASS).then(function (vault) {
  const out =
    "/* 自動產生，請勿手改。產生方式：node tools/make-vault.js \"通關語\" */\n" +
    "/* 內容為 AES-GCM-256 密文；沒有通關語解不開。 */\n" +
    "window.SHREN_VAULT = " + JSON.stringify(vault, null, 0) + ";\n";
  fs.writeFileSync(path.join(ROOT, "assets", "vault.js"), out, "utf8");
  console.log("✓ 已寫出 assets/vault.js");
  console.log("  加密項目：" + parts.join("、") + "（共 " + count + "）");
  console.log("  KDF：PBKDF2-SHA256 × " + C.ITER + "　加密：AES-GCM-256");
  console.log("  ⚠ 通關語沒有被存進任何檔案。忘了就只好重跑一次。");
}).catch(function (e) {
  console.error("✗ 加密失敗：", e.message);
  process.exit(1);
});
