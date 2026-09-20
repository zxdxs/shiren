#!/usr/bin/env node
/* ============================================================
   上線前檢查（preflight）
   ------------------------------------------------------------
   這個站的加密保證，靠這個腳本執行——不靠人記得。
   每次 git commit / push 之前跑一次：
       node tools/preflight.js
   ============================================================ */
const fs = require("fs"), path = require("path"), cp = require("child_process");
const ROOT = path.join(__dirname, "..");
process.chdir(ROOT);

/* 絕不可明文出現的內容（拆開書寫，避免本檔自己成為洩漏源） */
const BAN = ["不壽"+"暴死", "戮"+"死", "年"+"忌", "富貴"+"大樂", "無為"+"姦事",
  "壽中"+"百歲", "壽必中"+"百歲", "卒"+"死", "草"+"滋", "枳"+"實",
  "衃"+"血", "枯"+"骨", "如"+"煤", "胃"+"絕", "陰陽"+"離散", "志"+"傷"];

let fail = 0, warn = 0;
const ok = (c, m) => { console.log((c ? "  ✓ " : "  ✗ ") + m); if (!c) fail++; };
const note = m => console.log("  · " + m);

/* ---------- 取得要檢查的檔案 ---------- */
function walk(dir, out, skip) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.indexOf(e.name) >= 0) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out, skip);
    else out.push(path.relative(ROOT, p));
  }
  return out;
}
let files, source;
try {
  files = cp.execSync("git ls-files", { encoding: "utf8" }).split("\n").filter(Boolean);
  source = "git 追蹤的檔案（" + files.length + " 個）";
  if (!files.length) throw new Error("empty");
} catch (e) {
  files = walk(".", [], [".git", "private", "node_modules"]);
  source = "資料夾走訪（尚未 git init，已排除 private/）";
}
console.log("\n檢查範圍：" + source + "\n");

const read = f => { try { return fs.readFileSync(f, "utf8"); } catch (e) { return ""; } };

/* ---------- ① 禁止明文 ---------- */
console.log("① 命定論述與死候：不得有任何明文");
let hits = [];
files.forEach(f => { const t = read(f); BAN.forEach(b => { if (t.indexOf(b) >= 0) hits.push(f + " ← 「" + b + "」"); }); });
ok(hits.length === 0, hits.length ? "發現 " + hits.length + " 處明文：\n      " + hits.join("\n      ") : "全部乾淨");

/* ---------- ② 通關語不得出現在任何檔案 ---------- */
console.log("\n② 通關語：不得出現在任何被追蹤的檔案中");
const passFile = "private/passphrase.txt";
let pass = "";
if (fs.existsSync(passFile)) pass = read(passFile).trim().split("\n")[0].trim();
else if (process.env.SHREN_PASS) pass = process.env.SHREN_PASS;
if (!pass) {
  console.log("  ! 找不到通關語（private/passphrase.txt 或 $SHREN_PASS）");
  console.log("    無法檢查是否洩漏——請建立 private/passphrase.txt 後重跑");
  warn++;
} else {
  const ph = files.filter(f => read(f).indexOf(pass) >= 0);
  ok(ph.length === 0, ph.length ? "通關語洩漏在：" + ph.join("、") : "通關語未出現在任何檔案（" + files.length + " 個已檢查）");
}

/* ---------- ③ 密文檔 ---------- */
console.log("\n③ assets/vault.js：必須是密文");
const v = read("assets/vault.js");
ok(v.indexOf("SHREN_VAULT") >= 0, "vault.js 已存在並掛上 SHREN_VAULT");
ok(/"ct"\s*:/.test(v) && /"salt"\s*:/.test(v) && /"iv"\s*:/.test(v), "含 ct / salt / iv 三欄");
ok(/PBKDF2/.test(v) && /"iter"\s*:\s*\d{5,}/.test(v), "KDF 為 PBKDF2 且迭代次數足夠");
const vLeak = BAN.filter(b => v.indexOf(b) >= 0);
ok(vLeak.length === 0, vLeak.length ? "vault.js 內含明文！" : "vault.js 內無任何明文");

/* ---------- ④ private/ 必須被忽略 ---------- */
console.log("\n④ private/：必須被 git 忽略");
const gi = read(".gitignore");
ok(/^\s*private\/\s*$/m.test(gi), ".gitignore 已列 private/");
const trackedPrivate = files.filter(f => f.indexOf("private/") === 0);
ok(trackedPrivate.length === 0, trackedPrivate.length ? "private/ 有檔案被追蹤：" + trackedPrivate.join("、") : "private/ 無檔案被追蹤");

/* ---------- ⑤ 測試 ---------- */
console.log("\n⑤ 測試");
let t = "";
try { t = cp.execSync("node tools/smoke-test.js", { encoding: "utf8" }); } catch (e) { t = (e.stdout || "") + ""; }
const m = t.match(/全部通過（(\d+) 項/);
ok(!!m, m ? "煙霧測試全部通過（" + m[1] + " 項）" : "煙霧測試未通過（請單獨執行 node tools/smoke-test.js 查看）");
if (/SKIP/.test(t)) console.log("    注意：測試中有 SKIP——功能未被實際驗證");

/* ---------- ⑥ 開發痕跡 ---------- */
console.log("\n⑥ 其他");
const dbg = files.filter(f => /console\.log\(["']\s*\[debug\]/.test(read(f)));
ok(dbg.length === 0, dbg.length ? "殘留除錯輸出：" + dbg.join("、") : "無殘留 [debug] 輸出");
const ds = files.filter(f => /\.DS_Store$/.test(f));
ok(ds.length === 0, ds.length ? ".DS_Store 被追蹤了" : "無 .DS_Store 被追蹤");

/* ---------- ⑦ 解鎖入口可及性（防回歸） ---------- */
/* 附講的 D 區塊必須自帶解鎖鈕。先前只在望診／古法體型兩頁有按鈕，
   結果在附講看到「已加密」的人找不到它。 */
console.log("\n⑦ 解鎖入口：附講頁必須自帶按鈕");
const app = read("assets/app.js");
ok(app.indexOf('gbtn.id = "btnDLesson"') >= 0, "附講 D 區塊自帶解鎖鈕 btnDLesson");
ok(app.indexOf('renderLesson();   //') >= 0 || /refreshGateViews[\s\S]{0,200}renderLesson\(\)/.test(app),
   "上鎖／解鎖會同步刷新附講");
ok(app.indexOf("document.getElementById(\"lnExtra\")") < 0,
   "未使用 document.getElementById（測試 DOM 不支援）");

/* ---------- ⑧ GitHub Pages 專案頁相容 ---------- */
/* 專案頁的網址是 /<repo>/，不是網域根。任何 "/assets/..." 這種根絕對路徑都會 404。 */
console.log("\n⑧ GitHub Pages 專案頁：路徑必須是相對的");
const html = read("index.html");
const absRefs = (html.match(/(?:src|href)="\/(?!\/)[^"]*"/g) || []);
ok(absRefs.length === 0, absRefs.length ? "有根絕對路徑（專案頁會 404）：" + absRefs.join("、") : "無根絕對路徑（可放 /<repo>/ 子路徑）");
const ext = (html.match(/(?:src|href)="https?:\/\/(?!www\.w3\.org)[^"]*"/g) || []);
ok(ext.length === 0, ext.length ? "有外部資源引用：" + ext.join("、") : "無外部資源引用（離線可用）");
ok(files.indexOf(".nojekyll") >= 0, ".nojekyll 已被追蹤（否則 _ 開頭檔案會被 Jekyll 吃掉）");

/* ---------- 結果 ---------- */
console.log("\n" + "=".repeat(52));
console.log(fail ? "  ✗ 上線前檢查未通過：" + fail + " 項（" + warn + " 項提醒）"
                : "  ✓ 上線前檢查全部通過（" + warn + " 項提醒）");
console.log("=".repeat(52));
process.exit(fail ? 1 : 0);
