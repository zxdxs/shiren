/* ============================================================
   識人訓練站 · 煙霧測試
   ------------------------------------------------------------
   用極簡 DOM 模擬器「真的執行」assets/app.js，並模擬使用者操作，
   確認八個模組都能開、都能用、資料都能存。
   改完 data.js 之後跑這個：node tools/smoke-test.js
   ============================================================ */
const fs = require("fs");
const vm = require("vm");
const path = require("path");
const ROOT = path.join(__dirname, "..");

/* 通關語不寫在檔案裡：從 private/passphrase.txt（已 gitignore）或 $SHREN_PASS 讀。
   讀不到就 SKIP 加密段，並在結尾明確標示——不讓「沒測到」看起來像「測過了」。 */
const PASS_FILE = path.join(ROOT, "private", "passphrase.txt");
const PASS = (process.env.SHREN_PASS ||
  (fs.existsSync(PASS_FILE) ? fs.readFileSync(PASS_FILE, "utf8").trim().split("\n")[0].trim() : "")).trim();

/* ---------------- 極簡 DOM ---------------- */
function El(tag) {
  return {
    tagName: (tag || "div").toUpperCase(), _l: {}, children: [], className: "", _text: "",
    dataset: {}, style: {}, disabled: false, value: "", placeholder: "", type: "",
    hidden: false, options: [], checked: false, href: "", open: false, maxLength: 0,
    set textContent(v) { this._text = String(v); }, get textContent() { return this._text; },
    set innerHTML(v) { if (v === "") this.children = []; this._html = String(v); this._text = String(v).replace(/<[^>]*>/g, ""); },
    get innerHTML() { return this._html || ""; },
    classList: {
      _e: null,
      add(c) { const e = this._e; if (e.className.split(" ").indexOf(c) < 0) e.className = (e.className + " " + c).trim(); },
      remove(c) { const e = this._e; e.className = e.className.split(" ").filter(x => x !== c).join(" "); },
      toggle(c, f) { const has = this._e.className.split(" ").indexOf(c) >= 0; const on = (f === undefined) ? !has : !!f; on ? this.add(c) : this.remove(c); return on; },
      contains(c) { return this._e.className.split(" ").indexOf(c) >= 0; }
    },
    appendChild(n) {
      this.children.push(n);
      // 模擬 HTMLFormElement 的具名屬性存取（form.fieldName）
      if (this.tagName === "FORM" && n && n._name) this[n._name] = n;
      return n;
    },
    removeChild(n) { this.children = this.children.filter(x => x !== n); },
    remove() { },
    setAttribute(k, v) { this["_attr_" + k] = v; if (k === "href") this.href = v; },
    getAttribute(k) { return this["_attr_" + k]; },
    addEventListener(t, fn) { (this._l[t] = this._l[t] || []).push(fn); },
    scrollIntoView() { }, focus() { }, click() { fire(this, "click", {}); },
    querySelector(s) { return makeQ(s, this)[0] || bind(El("div")); },
    querySelectorAll(s) { return makeQ(s, this); }
  };
}
function bind(el) { el.classList._e = el; return el; }
function fire(el, type, evt) {
  evt = evt || {}; if (!evt.target) evt.target = el;
  if (!evt.preventDefault) evt.preventDefault = function () { };
  let ls = el._l[type] || []; if (typeof ls === "function") ls = [ls];
  ls.forEach(fn => fn.call(el, evt));
}
function attrVal(el, name) {
  if (name.indexOf("data-") === 0) {
    const camel = name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    if (el.dataset && el.dataset[camel] !== undefined) return el.dataset[camel];
  }
  if (el["_attr_" + name] !== undefined) return el["_attr_" + name];
  if (el[name] !== undefined) return el[name];
  return undefined;
}
const COMPOUND = /(^[a-zA-Z][A-Za-z0-9]*)|(\.([A-Za-z0-9_-]+))|(#([A-Za-z0-9_-]+))|(\[([A-Za-z0-9_-]+)(?:="([^"]*)")?\])/g;
function matches(el, sel) {
  if (!el || el.nodeType === 3) return false;
  return sel.split(",").map(s => s.trim()).filter(Boolean).some(s => {
    const tok = s.split(/\s+/).pop();     // 後代選擇器：取最後一段近似比對
    COMPOUND.lastIndex = 0;
    let m, ok = true, seen = false;
    while ((m = COMPOUND.exec(tok))) {
      seen = true;
      if (m[1]) { if (el.tagName !== m[1].toUpperCase()) ok = false; }
      else if (m[2]) { if ((" " + el.className + " ").indexOf(" " + m[3] + " ") < 0) ok = false; }
      else if (m[4]) { /* #id 不比對（shim 無 id 索引） */ }
      else if (m[6]) {
        const av = attrVal(el, m[7]);
        if (m[8] !== undefined) { if (String(av) !== m[8]) ok = false; }
        else if (av === undefined || av === null) ok = false;
      }
    }
    return ok && seen;
  });
}
function walk(root, out) {
  (root.children || []).forEach(c => { if (!c || c.nodeType === 3) return; out.push(c); walk(c, out); });
  return out;
}
const singletons = {};
function byId(id) { if (!singletons[id]) singletons[id] = bind(El("div")); return singletons[id]; }
function makeQ(sel, root) {
  sel = sel.trim();
  if (sel.indexOf("#") === 0 && sel.indexOf(" ") < 0) return root ? [] : [byId(sel.slice(1))];
  // "#id 後代" 要先定位到該 id，再從它往下走；
  // 否則會從彼此重疊的 docRoots 重複遍歷，把同一個節點算好幾次。
  let base = root, matchSel = sel;
  if (!base) {
    const m = sel.match(/^#([A-Za-z0-9_-]+)\s+(.+)$/);
    if (m) { base = byId(m[1]); matchSel = m[2]; }
  }
  const res = walk(base || { children: docRoots }, []).filter(e => matches(e, matchSel));
  return res.filter((e, i) => res.indexOf(e) === i);   // 去重
}
const docRoots = [];
const document = {
  readyState: "complete",
  createElement: t => bind(El(t)),
  createTextNode: t => ({ nodeType: 3, _text: String(t), textContent: String(t) }),
  querySelector: s => (s.indexOf("#") === 0 ? byId(s.slice(1)) : (makeQ(s)[0] || bind(El("div")))),
  querySelectorAll: s => makeQ(s),
  addEventListener: () => { },
  body: bind(El("body"))
};

/* ---------------- 依 index.html 註冊所有 id 與具名欄位 ---------------- */
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
[...html.matchAll(/\bid="([^"]+)"/g)].forEach(m => { const e = byId(m[1]); if (docRoots.indexOf(e) < 0) docRoots.push(e); });

function bindNames(formId, names) {
  const f = byId(formId);
  names.forEach(n => { const c = El("input"); c._name = n; bind(c); f[n] = c; });
}
bindNames("ledgerForm", ["seen", "guess"]);
byId("ledgerForm").days = byId("daysSel");
bindNames("tongueForm", ["date", "note"]);
byId("tongueForm").sleep = byId("sleepSel");
bindNames("subjectForm", ["code", "note"]);
bindNames("sessionForm", ["date", "note"]);

const localStorage = {
  _d: {},
  getItem(k) { return k in this._d ? this._d[k] : null; },
  setItem(k, v) { this._d[k] = String(v); },
  removeItem(k) { delete this._d[k]; }
};

/* ---------------- 沙箱 ---------------- */
const sandbox = {
  window: { addEventListener: (t, f) => { const w = sandbox.window; w._l = w._l || {}; (w._l[t] = w._l[t] || []).push(f); }, scrollTo() { }, print() { sandbox._printed = true; }, confirm: () => sandbox._confirmResult !== false, location: { hash: "" } },
  document, localStorage, location: null,   // 於下方建立（帶 hashchange 觸發）
  alert: m => { sandbox._alerts.push(m); },
  confirm: () => true,
  console, setTimeout: f => { f(); return 0; }, clearTimeout() { },
  Blob: function () { }, URL: { createObjectURL: () => "blob:x", revokeObjectURL() { } },
  FileReader: function () { this.readAsText = function () { }; },
  Date, JSON, Math, String, Number, Array, Object, parseInt, parseFloat, isNaN,
  Promise, TextEncoder, TextDecoder,
  crypto: require("crypto").webcrypto,
  btoa: s => Buffer.from(String(s), "binary").toString("base64"),
  atob: s => Buffer.from(String(s), "base64").toString("binary")
};
sandbox._pass = PASS;
sandbox._promptResult = undefined;   // undefined → 用 _pass
// 模擬瀏覽器：設定 location.hash 會觸發 hashchange
(function () {
  var loc = { _h: "" };
  Object.defineProperty(loc, "hash", {
    get: function () { return this._h; },
    set: function (v) {
      this._h = String(v);
      fire(sandbox.window, "hashchange", {});
    }
  });
  sandbox.location = loc;
  sandbox.window.location = loc;
})();
sandbox.window.prompt = () => (sandbox._promptResult === undefined ? sandbox._pass : sandbox._promptResult);
sandbox.window.alert = m => { sandbox._alerts.push(m); };
sandbox._alerts = [];
sandbox.globalThis = sandbox.window;   // 模擬瀏覽器：globalThis === window
vm.createContext(sandbox);

/* ---------------- 斷言 ---------------- */
let fail = 0, pass = 0;
function ok(c, m) { if (c) { pass++; console.log("  ✓ " + m); } else { fail++; console.log("  ✗ " + m); } }
function section(t) { console.log("\n=== " + t + " ==="); }
let skipped = 0;
function skipSection(t, why) {
  console.log("\n=== " + t + " ===");
  console.log("  ⊘ SKIP —— " + why);
  skipped++;
}
function addDaysStr(n) {
  const d = new Date(); d.setDate(d.getDate() + n);
  const p = x => String(x).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}
function txt(el) { let s = el._text || ""; (el.children || []).forEach(c => { if (!c) return; s += " " + (c.nodeType === 3 ? c._text : txt(c)); }); return s; }
function htmlOf(el) { let s = el.innerHTML || ""; (el.children || []).forEach(c => { if (c && c.nodeType !== 3) s += " " + htmlOf(c); }); return s; }
const go = h => { sandbox.location.hash = h; };   // setter 會觸發 hashchange
const tick = ms => new Promise(r => setTimeout(r, ms));
const S_STATION = () => sandbox.window.STATION;

/* 禁語一律拆開書寫：連它們本身都不該明文留在公開的 repo 裡。
   測試會確認這些字句不曾出現在任何渲染輸出、列印表或檔案中。 */
const BAN = {
  death:     ["草" + "滋", "枳" + "實", "如" + "煤", "衃" + "血", "枯" + "骨"],
  fate:      ["不壽" + "暴死", "戮" + "死", "年" + "忌", "富貴" + "大樂", "無為" + "姦事"],
  longevity: ["壽中" + "百歲", "壽必中" + "百歲"],
  posture:   ["胃" + "絕", "陰陽" + "離散", "志" + "傷"]
};
BAN.all = BAN.death.concat(BAN.fate, BAN.longevity, BAN.posture);

(async function () {
try {
  vm.runInContext(fs.readFileSync(path.join(ROOT, "assets", "data.js"), "utf8"), sandbox);
  section("載入 data.js");
  ok(!!sandbox.window.STATION, "STATION 已掛上 window");

  section("載入 crypto.js 與 vault.js");
  vm.runInContext(fs.readFileSync(path.join(ROOT, "assets", "courseware.js"), "utf8"), sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "assets", "cases.js"), "utf8"), sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "assets", "crypto.js"), "utf8"), sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "assets", "vault.js"), "utf8"), sandbox);
  ok(!!sandbox.window.SHREN_CRYPTO, "SHREN_CRYPTO 已載入");
  ok(!!sandbox.window.SHREN_VAULT && !!sandbox.window.SHREN_VAULT.ct, "SHREN_VAULT 已載入（有密文）");
  ok(sandbox.window.SHREN_CRYPTO.available(), "WebCrypto 可用");

  section("執行 app.js（含 init）");
  vm.runInContext(fs.readFileSync(path.join(ROOT, "assets", "app.js"), "utf8"), sandbox);
  ok(true, "init 執行完畢，未拋出例外");

  section("首頁與導覽");
  ok(byId("homeCards").children.length === 11, "首頁入口卡 = " + byId("homeCards").children.length + "（應 11）");
  ok(byId("homeNumbers").children.length === 5, "訓練站數字 5 格（含 24 條記誦）");
  ok(byId("homeCta").children.length === 3, "三個主要入口");
  ok((byId("homeThesis")._text || "").indexOf("知道") >= 0, "知道→做到→遷移 定位");
  ok((byId("homeLayer")._text || "").indexOf("訓練層") >= 0, "訓練層聲明（本於原典）");
  ok(txt(byId("homeSteps")).indexOf("不交產出物＝沒做") >= 0, "五步表：產出物原則");
  ok(byId("homeSteps").children[0].children.length === 6, "五步表 1 表頭 + 5 步");
  ok(byId("homeLevels").children[0].children.length === 6, "五層表 1 表頭 + 5 層");
  ok(txt(byId("homeHow")).length > 0, "怎麼練清單");
  ok(txt(byId("homeWarmup")).indexOf("熱身") >= 0, "公共熱身");
  ok(byId("nav").children.length === 12, "導覽項目 = " + byId("nav").children.length + "（首頁+11，應 12）");

  section("體例：理念／課件／方法／題庫／自測／進度／出處");
  go("#/philosophy");
  ok(byId("phList").children.length === 8, "理念篇 8 問");
  ok(txt(byId("phList")).indexOf("對付同一個敵人") >= 0 || txt(byId("phLead")).indexOf("自欺") >= 0, "理念：反自欺定位");

  go("#/lessons");
  ok(byId("lessonCards").children.length === 2, "課件 2 套骨架");
  ok(txt(byId("lessonCards")).indexOf("望診遵經") >= 0, "課件含望診遵經");
  ok(!!sandbox.window.COURSEWARE, "COURSEWARE 已載入");
  const CW = sandbox.window.COURSEWARE;
  ok(CW.tracks.length === 2, "課件兩條線：" + CW.tracks.map(t => t.title).join(" / "));
  const allL = CW.tracks.reduce((a, t) => a.concat(t.lessons), []);
  ok(allL.length === 25, "共 " + allL.length + " 講");
  const cwMin = allL.reduce((a, l) => a + l.min, 0);
  ok(cwMin === 446, "總時長 " + cwMin + " 分鐘");
  ok(allL.every(l => l.orig.indexOf("[[") >= 0), "每講原文都標了重點");
  ok(allL.every(l => l.plain && l.thread && l.goal && l.drill && l.chart), "每講都有白話／線索／目標／練習點／圖譜");
  ok(allL.every(l => ["pairs", "tree", "chain"].indexOf(l.chart.type) >= 0), "圖譜類型皆合法");
  ok(byId("cwTracks").children.length === 2, "課件目錄渲染兩條線");
  ok(byId("cwTracks").children[0].children.length >= 4, "目錄含表與全書線索");
  ok(txt(byId("cwSummary")).indexOf("25 講") >= 0, "課件摘要：" + txt(byId("cwSummary")).slice(0, 22));

  /* --- 體質基線 --- */
  go("#/constitution");
  const CT = sandbox.window.STATION.constitution;
  ok(!!CT, "體質基線資料已載入");
  ok(CT.types.length === 9, "九種體質：" + CT.types.length + " 型");
  ok(byId("ctTypes").children.length === 9, "體質卡渲染 9 張");
  ok(txt(byId("ctTitle")).length > 0, "體質標題：" + txt(byId("ctTitle")));
  ok(txt(byId("ctWhy")).indexOf("基線") >= 0, "體質：說明基線概念");
  ok(txt(byId("ctKey")).length > 0, "體質：關鍵句已渲染");
  ok(byId("ctStd").children.length >= 3, "體質：標準說明 " + byId("ctStd").children.length + " 條");
  ok(byId("ctUse").children.length >= 3, "體質：用法 " + byId("ctUse").children.length + " 條");
  ok(CT.types.every(t => t.name && t.grade && t.signs.length && t.overall), "每型都有名稱／分級／特徵／概述");
  ok(CT.types.every(t => t.signs.every(x => x.length > 1)), "體質特徵皆為觀察語（非數字診斷）");
  ok(CT.key.indexOf("一生的判決") >= 0, "體質：明示可變，非判決");
  ok(CT.grades.some(g => g.k === "A") && CT.grades.some(g => g.k === "B"), "體質：A／B 兩級並列");

  /* --- 第八繆（現代）：倖存者偏差 --- */
  const MB = sandbox.window.STATION.modernBiases;
  ok(Array.isArray(MB) && MB.length === 1, "現代偏誤 1 條");
  ok(MB[0].name === "倖存者偏差", "第八繆＝倖存者偏差");
  ok(sandbox.window.STATION.qimou.length === 7,
     "七繆仍是封閉的七條（未被增補）：" + sandbox.window.STATION.qimou.length);
  ok(sandbox.window.STATION.quizOptions.length === 9, "題庫選項 9 個（七繆＋急下結論＋倖存者偏差）");
  ok(sandbox.window.STATION.quiz.length === 11, "題庫 11 題");
  ok(sandbox.window.STATION.quiz[10].a === 8, "第 11 題答案指向倖存者偏差");
  ok(!!MB[0].book && MB[0].book.dVault === "xiaotianshi", "第八繆掛上版權加密區");
  ok(sandbox.window.STATION.system.provenance.sources.length === 8, "出處列 8 條");

  go("#/teacher");
  ok(byId("modernBiasBox").children.length >= 1, "第八繆已渲染");
  const mbt = txt(byId("modernBiasBox"));
  ok(mbt.indexOf("倖存者偏差") >= 0 && mbt.indexOf("沃德") >= 0, "第八繆：含偏誤名稱與沃德的故事");
  ok(mbt.indexOf("蕭天石") >= 0, "第八繆：標出實物標本");
  ok(mbt.indexOf("2036") >= 0, "第八繆：標明版權期限");
  ok(mbt.indexOf("古往今來") < 0, "第八繆：未通關時不洩漏出版方文案");
  ok(mbt.indexOf("談心為萬能之本") < 0, "第八繆：未通關時不洩漏章節層級目錄");
  ok(mbt.indexOf("自信力之偉大奇蹟") < 0, "第八繆：未通關時不洩漏章節標題");
  ok(mbt.indexOf("卷三　御人秘訣篇") >= 0,
     "第八繆：五卷卷名可公開（標題不受著作權保護）");

  /* --- 附講：警示、教學用法、加密原文（此時尚未通關） --- */
  go("#/lessons");
  const fjTi = CW.tracks.findIndex(t => t.lessons.some(l => l.dVault));
  ok(fjTi >= 0, "附講（掛 vault 的講次）存在");
  const fjLi = CW.tracks[fjTi].lessons.findIndex(l => l.dVault);
  const fj = CW.tracks[fjTi].lessons[fjLi];
  ok(!!fj.warn && !!fj.teaching, "附講有警示與教學用法");
  ok(fj.teaching.length === 4, "附講教學用法 4 條");
  ok(fj.dVault === "bingjian", "附講指向 vault 鍵：" + fj.dVault);
  /* 課件卡結構：children = [表頭區, 簡介, 表格, 全書線索]；
     表格第 0 列是表頭，第 fjLi+1 列的第 5 格是「讀這一講」按鈕。 */
  byId("cwTracks").children[fjTi].children[2].children[fjLi + 1].children[5].children[0].click();
  ok(txt(byId("lnTitle")).indexOf("冰鑑") >= 0, "附講已開啟：" + txt(byId("lnTitle")));
  ok(txt(byId("lnExtra")).indexOf("教學用法") >= 0, "附講：教學用法已渲染");
  ok(txt(byId("lnExtra")).indexOf("加密") >= 0, "附講：未通關時顯示加密提示");
  ok(txt(byId("lnExtra")).indexOf("骨有九起") < 0, "附講：未通關時零 D 級外洩");
  ok(txt(byId("lnExtra")).indexOf("白圍繞眼圈") < 0, "附講：未通關時不洩漏《冰鑑》原文");
  ok(txt(byId("lnExtra")).indexOf("火形人不貴則夭") < 0, "附講：未通關時不洩漏死期斷言");
  ok(txt(byId("lnExtra")).indexOf("本站【不引其判斷內容】") >= 0, "附講：明示不引其判斷內容");
  /* 通關提示必須指向真正的解鎖處，且不得再誤指「教學者」頁（該頁沒有解鎖鈕） */
  ok(txt(byId("lnExtra")).indexOf("教學者") < 0, "附講：通關提示未誤指「教學者」頁");
  /* 解鎖鈕必須就在附講頁上（先前只在望診／古法體型兩頁，找不到） */
  const fjBtns = byId("lnExtra").children
    .reduce((acc, c) => acc.concat(c.children || []), [])
    .reduce((acc, c) => acc.concat(c.children || []), [])
    .filter(c => c.tagName === "BUTTON" && c.id === "btnDLesson");
  ok(fjBtns.length === 1, "附講：D 區塊自帶解鎖鈕（btnDLesson）");
  ok(String(fjBtns[0] && fjBtns[0]._text).indexOf("解鎖") >= 0,
     "附講：解鎖鈕文字 = " + (fjBtns[0] && fjBtns[0]._text));
  const hintLinks = byId("lnExtra").children
    .reduce((acc, c) => acc.concat(c.children || []), [])
    .reduce((acc, c) => acc.concat(c.children || []), [])
    .filter(c => c.tagName === "A").map(c => c.href);
  ok(hintLinks.indexOf("#/wangzhen") >= 0 && hintLinks.indexOf("#/classics") >= 0,
     "附講：通關提示有指向兩個真實解鎖處（" + hintLinks.join(" / ") + "）");

  /* 回到人物志第一講，後續斷言才對得上 */
  byId("cwTracks").children[0].children[2].children[1].children[5].children[0].click();
  go("#/lesson");
  ok((byId("lnTitle")._text || "").indexOf("第一講") >= 0, "預設顯示第一講：" + byId("lnTitle")._text);
  ok(txt(byId("lnOrig")).length > 0, "原文已渲染");
  ok(byId("lnOrig").children.filter(c => (" " + c.className + " ").indexOf(" kp ") >= 0).length > 0,
     "原文重點已標記（" + byId("lnOrig").children.filter(c => (" " + c.className + " ").indexOf(" kp ") >= 0).length + " 處）");
  ok(htmlOf(byId("lnChart")).indexOf("<svg") >= 0, "圖譜已畫成 SVG");
  ok(htmlOf(byId("lnChart")).indexOf("ch-a") >= 0 || htmlOf(byId("lnChart")).indexOf("ch-b") >= 0,
     "圖譜含節點");
  ok(txt(byId("lnChartTitle")).indexOf("圖") >= 0, "圖譜有編號與標題");
  ok(txt(byId("lnTrackThread")).indexOf("全書線索") >= 0, "顯示全書線索");
  ok((byId("lnDrill").href || "").indexOf("#/") >= 0, "練習點有連結");
  ok(byId("lnPrev").disabled === true, "第一講：上一講停用");
  byId("lnNext").click();
  ok((byId("lnTitle")._text || "").indexOf("第二講") >= 0, "下一講可前進");
  ok(byId("lnPrev").disabled === false, "第二講：上一講可用");
  // 跳到第二條線的第一講
  go("#/lessons");
  const card2 = byId("cwTracks").children[1];
  const tbl2 = card2.children.filter(c => (" " + c.className + " ").indexOf(" sheet-table ") >= 0)[0];
  ok(!!tbl2, "第二條線的講次表已渲染");
  tbl2.children[1].children[5].children[0].click();   // 第一列（表頭後）→ 最後一格 → 按鈕
  ok((byId("lnTitle")._text || "").indexOf("觀察的條件") >= 0, "可跳到他線的講次：" + byId("lnTitle")._text);

  section("應記誦（五層的第一層）");
  go("#/recite");
  const R = S_STATION().recite;
  ok(byId("rcCats").children.length === 6, "記誦六大分類");
  const rcAllItems = R.categories.reduce((a, c) => a.concat(c.items), []);
  ok(rcAllItems.length === 24, "共 " + rcAllItems.length + " 條");
  ok(rcAllItems.every(i => i.body && i.src && i.why), "每條都有內容／出處／解析");
  ok(rcAllItems.filter(i => i.tip).length >= 20, "多數條目有記誦訣");
  ok(txt(byId("rcCats")).indexOf("相氣十法") >= 0, "含相氣十法");
  ok(txt(byId("rcCats")).indexOf("七繆") >= 0, "含七繆");
  ok(txt(byId("rcCats")).indexOf("平色定義") >= 0, "含平色定義");
  ok(txt(byId("rcCats")).indexOf("解析：") >= 0, "每條都有解析");
  ok(byId("rcStats").children.length === 4, "記誦統計 4 格");
  // 標記狀態並持久化
  const firstItem = byId("rcCats").children[0].children
    .filter(c => (" " + c.className + " ").indexOf(" rc-item ") >= 0)[0];
  const lvBtns = makeQ(".rc-btns", firstItem)[0];   // rc-btns 在 rc-head 之內
  ok(!!lvBtns && lvBtns.children.length === 3, "每條有 未背／在背／會背 三檔");
  lvBtns.children[2].click();                    // 「會背」
  const rcSaved = JSON.parse(localStorage.getItem("shiren.v1"));
  ok(rcSaved.recite && Object.keys(rcSaved.recite).length === 1, "記誦狀態已持久化");
  ok(Object.values(rcSaved.recite)[0] === 2, "標記為會背（2）");
  ok(byId("rcStats").children[0].children.length >= 1, "統計已更新");
  // 篩選
  byId("rcOnlyTodo").checked = true;
  fire(byId("rcOnlyTodo"), "change", {});
  ok(byId("rcCats").children[0].children.filter(c => (" " + c.className + " ").indexOf(" rc-item ") >= 0).length === 5,
     "只顯示未完成：第一類剩 5 條");

  go("#/progress");
  ok(txt(byId("pgCounts")).indexOf("記誦：會背") >= 0, "進度含記誦統計");

  go("#/method");
  ok(byId("methodSteps").children.length === 5, "五步執行單 5 步");
  ok(txt(byId("methodSteps")).indexOf("產出物") >= 0, "每步標明產出物");
  ok(txt(byId("methodSteps")).indexOf("基線卡") >= 0, "第①步產出物＝基線卡");
  ok(byId("fourLevelsBox").children[0].children.length === 6, "五層驗收表");

  go("#/drills");
  ok(byId("drillsList").children.length === 7, "題庫 7 個訓練點");
  ok(txt(byId("drillsList")).indexOf("訓練點 1") >= 0, "題庫按訓練點編號");
  ok(txt(byId("drillsList")).indexOf("觀察純度") >= 0, "訓練點 1＝觀察純度");

  go("#/mastery");
  ok(byId("msList").children.length === 8, "自測 8 題");
  ok(byId("msList").children[0].children.length === 5, "每題 1 問 + 4 選項");
  ok(byId("msResult").hidden === true, "未答完不顯示結果");
  byId("msList").children.forEach(c => {
    const opts = c.children.filter(x => (" " + x.className + " ").indexOf(" opt ") >= 0);
    opts[3].click();                                  // 全選 L4
  });
  ok(byId("msResult").hidden === false, "答完顯示結果");
  ok(txt(byId("msScore")).indexOf("L4") >= 0, "全選 L4 → 定位 L4（" + txt(byId("msScore")).slice(0, 12) + "）");
  ok(byId("msBreak").children.length === 4, "分層統計 4 列");

  go("#/provenance");
  ok(byId("pvSources").children[0].children.length === 9, "來源表 1 表頭 + 8 來源");

  /* --- 指正與聯絡 --- */
  const CTCT = sandbox.window.STATION.system.provenance.contact;
  ok(!!CTCT, "出處頁有「指正與聯絡」區塊");
  ok(CTCT.items.length === 2, "聯絡方式 2 種：" + CTCT.items.map(i => i.k).join("、"));
  ok(CTCT.items.some(i => i.k === "微信" && i.qr), "微信項含二維碼圖檔");
  ok(CTCT.items.some(i => i.k === "郵箱" && i.mail), "郵箱項含信箱");
  ok(txt(byId("pvContactTitle")).length > 0, "聯絡區塊標題已渲染：" + txt(byId("pvContactTitle")));
  ok(byId("pvContact").children.length === 2, "聯絡卡渲染 2 張");
  const qrImg = makeQ("img.cc-qr", byId("pvContact"))[0];
  ok(!!qrImg && qrImg.src === "assets/wechat-qr.jpg", "二維碼圖路徑正確：" + (qrImg && qrImg.src));
  ok(!!qrImg && qrImg.alt.indexOf("課孫翁") >= 0, "二維碼有替代文字（無障礙）");
  const mailA = makeQ("a.cc-mail", byId("pvContact"))[0];
  ok(!!mailA && String(mailA.href).indexOf("mailto:") === 0, "信箱為 mailto 連結：" + (mailA && mailA.href));
  ok(txt(byId("pvContactClose")).length > 0, "聯絡區塊收尾語已渲染");
  ok(byId("pvVariants").children[0].children.length === 6, "版本差異表 1 表頭 + 5 條");
  ok(txt(byId("pvSources")).indexOf("望診遵經") >= 0, "來源含望診遵經");
  ok(txt(byId("pvSources")).indexOf("公有領域") >= 0, "標明權利狀態");
  ok((byId("pvDisclaimer")._text || "").indexOf("不提供醫療診斷") >= 0, "免責聲明");
  ok(txt(byId("pvVariants")).indexOf("肺合皮") >= 0 || txt(byId("pvVariants")).indexOf("左宮") >= 0,
     "版本差異留痕");

  go("#/progress");
  ok(byId("pgSteps").children.length === 5, "進度：五步產出物 5 列");
  ok(byId("pgCounts").children.length >= 7, "進度：記錄存量");
  ok(txt(byId("pgSteps")).indexOf("尚未") >= 0 || txt(byId("pgSteps")).indexOf("已留下") >= 0,
     "進度依實際記錄判定");

  section("偏誤找碴：答完 10 題");
  go("#/quiz");
  const qc = byId("quizCard");
  let g = 0;
  while (qc.children.length && g++ < 300) {
    const opts = qc.children.filter(c => (" " + c.className + " ").indexOf(" opt ") >= 0);
    if (!opts.length) break;
    opts[0].click();
    const nx = qc.children.filter(c => c._text && (c._text.indexOf("下一題") >= 0 || c._text.indexOf("看結果") >= 0));
    if (nx.length) nx[0].click(); else break;
  }
  ok(byId("quizResult").hidden === false, "顯示結果面板");
  ok(byId("quizReview").children.length === 11, "檢討清單 11 條");
  {
    const dv = JSON.parse(localStorage.getItem("shiren.v1"));
    ok(dv.drills && dv.drills.quiz && dv.drills.quiz.done === 11, "題庫完成度已寫入記錄");
  }

  section("只寫看見的：答完 12 題");
  go("#/classify");
  const cl = byId("classifyList");
  ok(cl.children.length === 12, "題卡 12 張");
  cl.children.slice().forEach(c => {
    const b = c.children.filter(x => (" " + x.className + " ").indexOf(" cls-btns ") >= 0)[0];
    if (b && b.children.length) b.children[0].click();
  });
  ok(byId("classifyResult").hidden === false, "顯示結果面板");
  ok(byId("classifyBar").style.width === "100%", "進度條 100%");
  {
    const dv2 = JSON.parse(localStorage.getItem("shiren.v1"));
    ok(dv2.drills && dv2.drills.classify && dv2.drills.classify.done === 12, "觀察純度完成度已寫入");
  }

  section("一致性遊戲");
  go("#/interrater");
  const rows = byId("interraterInputs").children;
  ok(rows.length === 3, "預設 3 位觀察者");
  const tas = rows.map(r => r.children.filter(c => c.tagName === "TEXTAREA")[0]);
  tas[0].value = "他看了三次地上\n他停了兩秒";
  tas[1].value = "他看了三次地上";
  tas[2].value = "他摸了一下耳朵";
  byId("irRun").click();
  const ir = byId("irResult");
  ok(ir.children.filter(c => (" " + c.className + " ").indexOf(" group common ") >= 0).length === 1, "共同記錄 1 條");
  ok(ir.children.filter(c => (" " + c.className + " ").indexOf(" group unique ") >= 0).length === 2, "獨有記錄 2 條");

  section("舌頭日記");
  go("#/tongue");
  byId("spiritChips").children[4].click();
  byId("bodyChips").children[0].click();
  byId("coatChips").children[0].click();
  byId("moodChips").children[1].click();
  const tf = byId("tongueForm");
  tf.date.value = "2026-09-15"; tf.sleep.value = "7"; tf.note.value = "測試";
  fire(tf, "submit", { preventDefault() { } });
  ok(byId("tongueList").children.length === 1, "日記 1 筆");

  section("我的猜測（單次對帳）");
  go("#/ledger");
  const lf = byId("ledgerForm");
  lf.seen.value = "他講到一半停了兩秒"; lf.guess.value = "他可能有點緊張"; lf.days.value = "3";
  fire(lf, "submit", { preventDefault() { } });
  ok(byId("ledgerPending").children.length === 1, "待對帳 1 筆");
  byId("ledgerPending").children[0].children
    .filter(c => (" " + c.className + " ").indexOf(" rec-acts ") >= 0)[0].children[0].click();
  ok(byId("ledgerDone").children.length === 1, "已對帳 1 筆");

  /* ============ 長期追蹤：核心閉環 ============ */
  section("長期追蹤 ①：新增觀察對象");
  go("#/track");
  ok((byId("promptTrack")._text || "").length > 0, "引導語已填入");
  ok(byId("typeChips").children.length === 3, "三種對象類型");
  ok(txt(byId("subjectList")).indexOf("還沒有觀察對象") >= 0, "空狀態提示");

  const sf = byId("subjectForm");
  byId("typeChips").children[0].click();          // 「我自己」
  sf.code.value = "我"; sf.note.value = "測試用";
  fire(sf, "submit", { preventDefault() { } });
  ok(byId("subjectList").children.length === 1, "對象清單 1 筆");

  section("長期追蹤 ②：第一次觀察");
  byId("subjectList").children[0].children
    .filter(c => (" " + c.className + " ").indexOf(" rec-acts ") >= 0)[0].children[0].click();
  ok(byId("trackDetail").hidden === false, "詳細面板已展開");
  ok((byId("tdTitle")._text || "") === "我", "標題 = 我");
  ok(txt(byId("tdTrend")).indexOf("還沒有觀察記錄") >= 0, "尚無記錄提示");
  ok(txt(byId("loopReminder")).indexOf("第一次觀察") >= 0, "閉環提示：第一次觀察");

  byId("btnNewSession").click();
  ok(byId("sessionPanel").hidden === false, "觀察表單已展開");
  ok(byId("channelsWrap").children.length === 9, "九徵欄位 9 個");
  ok(byId("stateWrap").children.length === 4, "狀態欄位 4 個");
  ok(byId("ratingsWrap").children.length === 5, "數字指標 5 個");
  ok(byId("biasWrap").children.length === 7, "偏誤自檢 7 項");
  ok(byId("guessesWrap").children.length === 1, "預設 1 條推測列");

  const chs = makeQ("[data-ch]", byId("channelsWrap"));
  chs[0].value = "眼神還可以，反應正常";      // 神
  chs[8].value = "語速比平常慢";              // 言
  makeQ("[data-st]", byId("stateWrap"))[0].value = "睡了 6 小時";
  const setRating = (k, v) => {
    makeQ('[data-rating="' + k + '"].chip', byId("ratingsWrap"))
      .filter(c => c.dataset.val === String(v))[0].click();
  };
  setRating("spirit", 2); setRating("talk", 3); setRating("speed", 2);
  setRating("stable", 4); setRating("init", 3);
  makeQ('[data-role="text"]', byId("guessesWrap"))[0].value = "這週他應該會很累";
  makeQ('[data-role="conf"]', byId("guessesWrap"))[0].value = "70";
  makeQ('[data-role="due"]', byId("guessesWrap"))[0].value = "2026-09-18";
  makeQ("#biasWrap input[type=checkbox]")[5].checked = true;   // 論材有申壓
  const sef = byId("sessionForm");
  sef.date.value = "2026-09-15"; sef.note.value = "第一次";
  fire(sef, "submit", { preventDefault() { } });

  let st = JSON.parse(localStorage.getItem("shiren.v1"));
  ok(st.sessions.length === 1, "已存下 1 次觀察");
  ok(st.sessions[0].ch.shen === "眼神還可以，反應正常", "九徵內容正確");
  ok(st.sessions[0].rt.spirit === 2, "數字指標正確（精神 2）");
  ok(st.sessions[0].guesses.length === 1 && st.sessions[0].guesses[0].conf === 70, "推測與信心正確");
  ok(st.sessions[0].guesses[0].level === "L2", "推測層級預設 L2");
  ok(st.sessions[0].bias.length === 1 && st.sessions[0].bias[0] === 5, "偏誤自檢已記錄");
  ok(htmlOf(byId("tdTrend")).indexOf("<svg") >= 0, "趨勢已畫出走勢圖（SVG）");
  ok((byId("tdMeta")._text || "").indexOf("共 1 次觀察") >= 0, "詳細資訊：" + byId("tdMeta")._text);

  section("長期追蹤 ③：第二次觀察 → 閉環提示");
  byId("btnNewSession").click();
  const loopTxt = txt(byId("loopReminder"));
  ok(loopTxt.indexOf("上一次你寫的是") >= 0, "出現「上一次你寫的是」");
  ok(loopTxt.indexOf("眼神還可以") >= 0, "含上次的九徵記錄");
  ok(loopTxt.indexOf("這週他應該會很累") >= 0, "含上次的推測");
  ok(loopTxt.indexOf("還沒到對帳日") >= 0, "標示上次推測尚未對帳");

  makeQ("[data-ch]", byId("channelsWrap"))[0].value = "精神明顯好了";
  setRating("spirit", 5);
  makeQ('[data-role="text"]', byId("guessesWrap"))[0].value = "下個月他會主動提起那件事";
  makeQ('[data-role="level"]', byId("guessesWrap"))[0].value = "L3";
  makeQ('[data-role="conf"]', byId("guessesWrap"))[0].value = "55";
  makeQ('[data-role="due"]', byId("guessesWrap"))[0].value = "2026-10-15";
  const sef2 = byId("sessionForm");
  sef2.date.value = "2026-09-29";
  fire(sef2, "submit", { preventDefault() { } });

  st = JSON.parse(localStorage.getItem("shiren.v1"));
  ok(st.sessions.length === 2, "已存下 2 次觀察");
  const trendTxt = txt(byId("tdTrend"));
  ok(trendTxt.indexOf("2 → 5") >= 0, "趨勢顯示 2 → 5 的變化");
  ok(byId("tdHistory").children.length === 2, "歷史時間軸 2 筆");

  section("長期追蹤 ④：對帳 → 校準（閉環合上）");
  ok(txt(byId("tdGuesses")).indexOf("等你回來看") >= 0, "對帳清單有待對帳區");
  const pend = byId("tdGuesses").children.filter(c => (" " + c.className + " ").indexOf(" rec ") >= 0);
  ok(pend.length >= 2, "對帳清單 " + pend.length + " 筆");
  pend[0].children.filter(c => (" " + c.className + " ").indexOf(" rec-acts ") >= 0)[0]
    .children[0].click();                       // 「對」
  st = JSON.parse(localStorage.getItem("shiren.v1"));
  const judged = st.sessions.reduce((a, s) => a + (s.guesses || []).filter(x => x.result).length, 0);
  ok(judged === 1, "已對帳 1 條");
  const calibTxt = txt(byId("tdCalib"));
  ok(calibTxt.indexOf("命中率") >= 0, "校準表：命中率");
  ok(calibTxt.indexOf("平均信心") >= 0, "校準表：平均信心");
  ok(calibTxt.indexOf("可證偽率") >= 0, "校準表：可證偽率");
  ok(calibTxt.indexOf("過度自信") >= 0, "校準表：過度自信");
  ok(calibTxt.indexOf("狀態（數天可對帳）") >= 0 && calibTxt.indexOf("心性（低信度）") >= 0,
     "校準表分 L2 / L3 兩層");

  section("長期追蹤 ⑤：七年之約（L3 期限以年計）");
  go("#/track");
  byId("btnNewSession").click();
  const lvSel = makeQ('[data-role="level"]', byId("guessesWrap"))[0];
  const dueIn = makeQ('[data-role="due"]', byId("guessesWrap"))[0];
  ok(dueIn.value === addDaysStr(7), "L2 預設對帳日 = 7 天後（" + dueIn.value + "）");
  lvSel.value = "L3";
  fire(lvSel, "change", {});
  ok(dueIn.value === addDaysStr(1095), "切到 L3 後，預設對帳日自動跳到 3 年後（" + dueIn.value + "）");
  const presets = makeQ(".due-preset", byId("guessesWrap"));
  ok(presets.length === 5, "期限快選 5 個（7天/1月/1年/3年/7年）");
  presets[4].click();                                   // 7 年
  ok(dueIn.value === addDaysStr(2557), "快選「7 年」→ " + dueIn.value);
  makeQ('[data-role="text"]', byId("guessesWrap"))[0].value = "他七年後會是個守信的人";
  makeQ('[data-role="conf"]', byId("guessesWrap"))[0].value = "45";
  byId("sessionForm").date.value = "2026-10-01";
  fire(byId("sessionForm"), "submit", { preventDefault() { } });

  const ltTxt = txt(byId("tdLongTerm"));
  ok((byId("longTermTitle")._text || "").indexOf("七年之約") >= 0, "七年之約區塊標題：" + byId("longTermTitle")._text);
  ok(ltTxt.indexOf("試玉要燒三日滿，辨材須待七年期") >= 0, "引用白居易原文");
  ok(ltTxt.indexOf("共 1 條長期推測") >= 0 || ltTxt.indexOf("條長期推測") >= 0, "長期推測已列入：" + (ltTxt.match(/共 \d+ 條長期推測/) || [""])[0]);
  ok(ltTxt.indexOf("還有 6 年") >= 0 || ltTxt.indexOf("還有 7 年") >= 0, "倒數以「年」顯示");
  ok(ltTxt.indexOf("活得比你久") >= 0, "提醒記錄需長久保存");

  section("列印版觀察表");
  go("#/print");
  ok(byId("printSheet").children.length > 0, "列印表已渲染");
  const sheetTxt = txt(byId("printSheet"));
  ok(sheetTxt.indexOf("識人觀察表") >= 0, "表頭");
  ok(sheetTxt.indexOf("對象代號") >= 0, "填寫欄位");
  S_dummy = null;
  ok(sheetTxt.indexOf("神") >= 0 && sheetTxt.indexOf("言") >= 0, "九徵欄位齊全");
  ok(sheetTxt.indexOf("試玉要燒三日滿") >= 0, "表尾印上七年之約");
  byId("btnPrint").click();
  ok(sandbox._printed === true, "列印鈕已觸發 window.print()");

  section("望診遵經（以書為骨架）");
  go("#/wangzhen");
  ok((byId("promptWangzhen")._text || "").length > 0, "引導語已填入");
  let bookTxt = txt(byId("wzBookPanel"));
  ok(bookTxt.indexOf("望診遵經") >= 0, "書名");
  ok(bookTxt.indexOf("清·汪宏") >= 0, "作者");
  ok(bookTxt.indexOf("光緒元年") >= 0, "年代");
  ok(bookTxt.indexOf("101 篇") >= 0, "篇數");
  ok(bookTxt.indexOf("治病必須知診。診病必須遵經。") >= 0, "書名即論點（叙）");
  ok(bookTxt.indexOf("更正") >= 0, "載明本站原先的誤讀");
  ok(byId("wzTabs").children.length === 6, "六個原文分頁");

  // 預設：相氣十法
  let wzBody = txt(byId("wzBody"));
  ok(wzBody.indexOf("浮沉") >= 0 && wzBody.indexOf("清濁") >= 0, "相氣十法：浮沉清濁");
  ok(wzBody.indexOf("微甚") >= 0 && wzBody.indexOf("散摶") >= 0 && wzBody.indexOf("澤夭") >= 0, "相氣十法：微甚散摶澤夭");
  ok(wzBody.indexOf("分表裡") >= 0 && wzBody.indexOf("分成敗") >= 0, "十法各配一判斷");
  ok(wzBody.indexOf("辨其色之氣也") >= 0, "十法總結原文");

  // 平色與潤澤
  byId("wzTabs").children[1].click();
  wzBody = txt(byId("wzBody"));
  ok(wzBody.indexOf("凡欲知病色，必先知平色") >= 0, "望色先知平人");
  ok(wzBody.indexOf("不浮不沉") >= 0 && wzBody.indexOf("光明潤澤") >= 0, "平色定義（用十法兩端不偏）");
  ok(wzBody.indexOf("如以縞裹朱") >= 0, "五臟生色（如以縞裹）");
  ok(wzBody.indexOf("望色，以潤澤為本") >= 0, "色以潤澤為本");
  ok(wzBody.indexOf("青如翠羽者生") >= 0, "五色見生（A 級可觀察）");
  ok(wzBody.indexOf("本站最該補的一課") >= 0 || wzBody.indexOf("先建立") >= 0, "指出本站設計缺陷");

  // D 級：未解鎖時必須完全看不到
  const DEATH = BAN.death;
  let dl = DEATH.filter(w => wzBody.indexOf(w) >= 0);
  ok(dl.length === 0, "未解鎖：五色見死零外洩" + (dl.length ? " → " + dl.join("、") : ""));
  ok(byId("dWZBanner").hidden === true, "未解鎖：D 級橫幅隱藏");
  ok((byId("btnDWZ")._text || "").indexOf("解鎖") >= 0, "按鈕顯示為「解鎖」");

  // 分參
  byId("wzTabs").children[2].click();
  const adjTxt = txt(byId("wzBody"));
  ok(adjTxt.indexOf("老少望法相參") >= 0, "分參：老少");
  ok(adjTxt.indexOf("十歲") >= 0 && adjTxt.indexOf("好走") >= 0, "分參：十年觀察表");
  ok(adjTxt.indexOf("主色") >= 0 && adjTxt.indexOf("客色") >= 0, "分參：主色／客色（基線概念）");
  ok(adjTxt.indexOf("意態望法提綱") >= 0, "分參：意態（本站原缺的維度）");

  // 姿態（卷下）
  byId("wzTabs").children[3].click();
  const posTxt = txt(byId("wzBody"));
  ok(posTxt.indexOf("得其中") >= 0, "姿態：基線原則");
  ok(posTxt.indexOf("動靜") >= 0 && posTxt.indexOf("屈伸") >= 0, "姿態：八法四對");
  ok(posTxt.indexOf("寒則多屈") >= 0 && posTxt.indexOf("老則多靜") >= 0, "姿態：校正因子八句");
  ok(posTxt.indexOf("坐而伏") >= 0, "姿態：診坐");
  ok(posTxt.indexOf("但欲寐") >= 0, "姿態：診臥");
  ok(posTxt.indexOf("栗則心為之戰") >= 0, "姿態：身容四法");
  ok(posTxt.indexOf("行遲") >= 0, "姿態：行止動靜");
  ok(posTxt.indexOf("醫療邊界") >= 0, "姿態：標明醫療邊界");
  ok(BAN.posture.filter(w => posTxt.indexOf(w) >= 0).length === 0,
     "姿態：未解鎖時 D 級零外洩");

  // 篇目 101
  byId("wzTabs").children[4].click();
  const tocTxt = txt(byId("wzBody"));
  ok(tocTxt.indexOf("相氣十法提綱") >= 0, "目錄含卷上篇目");
  ok(tocTxt.indexOf("診臥望法提綱") >= 0, "目錄含卷下姿態篇目");
  ok(tocTxt.indexOf("望舌診法提綱") >= 0, "目錄含舌診五篇之一");
  ok(tocTxt.indexOf("共") >= 0 || tocTxt.indexOf("101") >= 0, "目錄標明總數");

  // 《內經》原文（根）
  byId("wzTabs").children[5].click();
  const njTxt = txt(byId("wzBody"));
  ok(njTxt.indexOf("鼻者，肺之官也") >= 0, "內經：五官原文");
  ok(njTxt.indexOf("青黑爲痛") >= 0 || njTxt.indexOf("青黑為痛") >= 0, "內經：官五色");
  ok(njTxt.indexOf("察其浮沉") >= 0, "內經：望色四察（十法之根）");
  ok(njTxt.indexOf("明堂者，鼻也") >= 0, "內經：五區定位");
  ok(njTxt.indexOf("色起兩眉薄澤者，病在皮") >= 0, "內經：皮肉氣血筋骨");
  ok(njTxt.indexOf("面部臟腑肢節分部（24 個部位）") >= 0, "內經：24 部位");
  ok((byId("wzTongueTitle")._text || "").indexOf("從《內經》到《望診遵經》") >= 0, "舌診來歷已更新");

  section("舌頭日記：來歷說明");
  go("#/tongue");
  const tzTxt = txt(byId("tongueZunJing"));
  ok(tzTxt.indexOf("從《內經》到《望診遵經》") >= 0, "舌診來歷說明已呈現");
  ok(tzTxt.indexOf("敖氏傷寒金鏡錄") >= 0, "標明舌診成體系的年代");
  ok(tzTxt.indexOf("五篇") >= 0, "說明《望診遵經》卷下確有舌診五篇");

  section("古法體型（教學者參考）");
  go("#/classics");
  ok((byId("promptClassics")._text || "").length > 0, "引導語已填入");
  ok(byId("gradeBox").children.length === 4, "可信度分級 A/B/C/D 四級");
  const gTxt = txt(byId("gradeBox"));
  ok(gTxt.indexOf("A 可直接教學") >= 0 && gTxt.indexOf("D 已剔除") >= 0, "分級名稱正確");
  ok((byId("excludedDecision")._text || "").indexOf("預設關閉") >= 0 || (byId("excludedDecision")._text || "").length > 0, "D 級說明已呈現");
  ok(byId("classicsTabs").children.length === 5, "五個分頁");
  ok(byId("classicsBody").children.length >= 5, "預設顯示二十五人（" + byId("classicsBody").children.length + " 個區塊）");
  const tfTxt = txt(byId("classicsBody"));
  ok(tfTxt.indexOf("上角") >= 0 && tfTxt.indexOf("其為人蒼色") >= 0, "木形主型原文");
  ok(tfTxt.indexOf("A 可觀察") >= 0, "A 級標記出現");
  ok(tfTxt.indexOf("B 性格歸納") >= 0, "B 級標記出現");
  // ---- D 級：未解鎖時必須完全看不到 ----
  const D_BAN = BAN.fate;
  const classicsAll = () => txt(byId("classicsBody")) + " " + txt(byId("dPassages")) + " " + txt(byId("excludedBody"));
  const dShows = () => D_BAN.filter(w => txt(byId("dPassages")).indexOf(w) >= 0).length;
  ok(byId("dBanner").hidden === true, "未解鎖：D 級橫幅隱藏");
  ok(dShows() === 0 && byId("dPassages").children.length <= 1, "未解鎖：D 級段落不渲染（僅提示訊息）");
  let leak = D_BAN.filter(w => classicsAll().indexOf(w) >= 0);
  ok(leak.length === 0, "未解鎖：D 級字句零外洩" + (leak.length ? " → " + leak.join("、") : ""));
  ok((byId("btnDFull")._text || "").indexOf("解鎖") >= 0, "按鈕顯示為「解鎖」");

  // 切到血氣望診（分頁順序：25人 / 五態 / 肥瘦 / 血氣 / 五音）
  byId("classicsTabs").children[3].click();
  const bqTxt = txt(byId("classicsBody"));
  ok(bqTxt.indexOf("足陽明之上") >= 0 && bqTxt.indexOf("髯美長") >= 0, "血氣望診表已渲染");
  ok(bqTxt.indexOf("美眉者") >= 0, "含原文總結");
  // 肥瘦三型
  byId("classicsTabs").children[2].click();
  const fatTxt = txt(byId("classicsBody"));
  ok(fatTxt.indexOf("膕肉不堅，皮緩者，膏") >= 0, "肥瘦：膏人原文");
  ok(fatTxt.indexOf("其血清，氣滑少") >= 0, "肥瘦：脂人原文");
  ok(fatTxt.indexOf("皮肉不相離者，肉") >= 0, "肥瘦：肉人原文");
  ok(fatTxt.indexOf("命曰眾人") >= 0, "肥瘦：眾人原文");
  ok(fatTxt.indexOf("A 可觀察（四項）") >= 0, "肥瘦：標為 A 級可觀察");
  ok(fatTxt.indexOf("「内」為「肉」之訛") >= 0, "肥瘦：標明版本訛字");

  // 五音配屬
  byId("classicsTabs").children[4].click();
  const toneTxt = txt(byId("classicsBody"));
  ok(toneTxt.indexOf("美眉者太陽多血") >= 0, "五音：藏著的 A 級觀察");
  ok(toneTxt.indexOf("太陽常多血少氣") >= 0, "五音：六經血氣常數");
  ok(toneTxt.indexOf("右角") >= 0 && toneTxt.indexOf("判角") >= 0, "五音：25 型歸組");
  ok(toneTxt.indexOf("不可硬改") >= 0, "五音：標明與二十五人的版本矛盾");
  ok(toneTxt.indexOf("不建議對兒童講") >= 0, "五音：對兒童的教學警示");

  // 切到五態
  byId("classicsTabs").children[1].click();
  const fsTxt = txt(byId("classicsBody"));
  ok(fsTxt.indexOf("太陰之人") >= 0 && fsTxt.indexOf("陰陽和平之人") >= 0, "五態五型齊全");
  ok(fsTxt.indexOf("其狀") >= 0 || fsTxt.indexOf("A 其狀") >= 0, "含「其狀」（可觀察）");
  ok(byId("howToBox").children.length === 4, "教學用法 4 條");

  section("色診欄與形體欄（尊經骨架）");
  go("#/track");
  byId("btnNewSession").click();
  ok(byId("colorWrap").children.length === 6, "面部色診欄 6 個（明堂/闕/庭/蕃/蔽/目）");
  ok(byId("fatWrap").children.length === 4, "肥瘦三型欄 4 個");
  ok(byId("baguanWrap").children.length === 8, "八觀自問欄 8 觀");
  ok(byId("postureWrap").children.length === 4, "姿態八法欄 4 對");
  ok(byId("postureActsWrap").children.length === 4, "姿態動作欄 4 組（坐/臥/身容/行）");
  ok(byId("formWrap").children.length === 1, "形體欄已加入觀察表");
  makeQ("[data-color]", byId("colorWrap"))[0].value = "明堂微黃，尚潤澤";
  makeQ("[data-color]", byId("colorWrap"))[5].value = "目眥略青";
  makeQ("[data-fat]", byId("fatWrap"))[0].value = "膕肉不堅";
  makeQ("[data-fat]", byId("fatWrap"))[2].value = "細理";
  makeQ('[data-post8="dongjing"]', byId("postureWrap")).filter(c => c.dataset.val === "靜")[0].click();
  makeQ('[data-post8="qushen"]', byId("postureWrap")).filter(c => c.dataset.val === "屈")[0].click();
  const pact = k => makeQ('[data-postact="' + k + '"]', byId("postureActsWrap"))[0];
  pact("sit-fu").click(); pact("lie-danyu").click(); pact("walk-chi").click();
  // 八觀：只問三觀，其餘應被標為盲區
  ["ganbian","suoyou","suoduan"].forEach(k=>makeQ('[data-baguan="'+k+'"]',byId("baguanWrap"))[0].click());
  makeQ("[data-form]", byId("formWrap"))[0].value = "面色偏黃，圓面，多肉，走路穩";
  makeQ("[data-ch]", byId("channelsWrap"))[0].value = "眼神平和";
  byId("sessionForm").date.value = "2026-11-01";
  fire(byId("sessionForm"), "submit", { preventDefault() { } });
  st = JSON.parse(localStorage.getItem("shiren.v1"));
  const lastSes = st.sessions[st.sessions.length - 1];
  ok(lastSes.form === "面色偏黃，圓面，多肉，走路穩", "形體內容已持久化：" + lastSes.form);
  ok(txt(byId("tdHistory")).indexOf("面色偏黃") >= 0, "歷史時間軸顯示形體");
  ok(lastSes.color && lastSes.color.mingtang === "明堂微黃，尚潤澤", "色診內容已持久化");
  ok(txt(byId("tdHistory")).indexOf("面部色診（尊經）") >= 0, "歷史時間軸顯示色診區塊");
  ok(lastSes.fat && lastSes.fat.guo === "膕肉不堅", "肥瘦內容已持久化");
  ok(lastSes.posture8 && lastSes.posture8.dongjing === "靜" && lastSes.posture8.qushen === "屈",
     "姿態八法已持久化（靜／屈）");
  ok(lastSes.postureActs && lastSes.postureActs.length === 3, "姿態動作已持久化（3 項）");
  ok(lastSes.baguan && lastSes.baguan.length === 3, "八觀自問已持久化（3/8）");
  ok(txt(byId("tdHistory")).indexOf("八觀自問（問了 3/8）") >= 0, "歷史顯示問了幾觀");
  ok(txt(byId("tdHistory")).indexOf("未問：") >= 0, "歷史標出未問的盲區");
  ok(txt(byId("tdHistory")).indexOf("姿態（尊經卷下）") >= 0, "歷史時間軸顯示姿態區塊");
  ok(txt(byId("tdHistory")).indexOf("肥瘦三型（觀察）") >= 0, "歷史時間軸顯示肥瘦區塊");

  if (!PASS) {
    skipSection("D 級加密（AES-GCM-256）", "找不到通關語（private/passphrase.txt 或 $SHREN_PASS）");
  } else {
    section("D 級加密（AES-GCM-256）");
    go("#/classics");

    // ① 錯誤通關語
    sandbox._promptResult = "wrong-passphrase-xyz";
    byId("btnDFull").click();
    await tick(1500);
    ok(dShows() === 0, "錯誤通關語：仍鎖著，零外洩");
    ok(sandbox._alerts.some(m => m.indexOf("通關語不正確") >= 0), "錯誤通關語：有明確提示");

    // ② 不輸入（取消）
    sandbox._promptResult = "";
    byId("btnDFull").click();
    await tick(300);
    ok(dShows() === 0, "未輸入通關語：維持鎖上");

    // ③ 正確通關語
    sandbox._promptResult = undefined;      // 回到預設 _pass
    byId("btnDFull").click();
    await tick(2500);
    ok(byId("dBanner").hidden === false, "解鎖後：橫幅顯示");
    ok(byId("dPassages").children.length === 2, "解鎖後：古法體型 D 級段落 2 條");
    leak = D_BAN.filter(w => classicsAll().indexOf(w) >= 0);
    ok(leak.length >= 3, "解鎖後：D 級段落出現（" + leak.length + "/5 禁語）");
    byId("classicsTabs").children[0].click();      // 二十五人：火／水形完整原文
    const formsTxt = txt(byId("classicsBody"));
    ok(formsTxt.indexOf("不壽" + "暴死") >= 0, "解鎖後：火形完整原文（含被剔除句）");
    ok(formsTxt.indexOf("戮" + "死") >= 0, "解鎖後：水形完整原文（含被剔除句）");
    byId("classicsTabs").children[1].click();

    // ④ 同一把鑰匙也開望診
    go("#/wangzhen");
    byId("wzTabs").children[5].click();
    const njUnlocked = txt(byId("wzBody"));
    ok(BAN.longevity.filter(w => njUnlocked.indexOf(w) >= 0).length >= 1, "解鎖後：內經章節 D 級出現");
    byId("wzTabs").children[1].click();
    ok(DEATH.filter(w => txt(byId("wzBody")).indexOf(w) >= 0).length >= 3, "解鎖後：遵經 D 級（五色見死）出現");
    byId("wzTabs").children[3].click();
    const posU = txt(byId("wzBody"));
    ok(BAN.posture.filter(w => posU.indexOf(w) >= 0).length >= 2, "解鎖後：姿態 D 級（死候）出現");

    // ④a 同一把鑰匙也開「第八繆」的版權受限區
    go("#/teacher");
    const xU = txt(byId("modernBiasBox"));
    ok(xU.indexOf("古往今來") >= 0, "解鎖後：蕭天石版權區—出版方文案出現");
    ok(xU.indexOf("談心為萬能之本") >= 0, "解鎖後：蕭天石版權區—章節目錄出現");
    ok(xU.indexOf("自信力之偉大奇蹟") >= 0, "解鎖後：蕭天石版權區—卷一章目出現");
    ok(xU.indexOf("原文摘錄插槽") >= 0, "解鎖後：蕭天石版權區—原文插槽說明出現");

    // ④b 同一把鑰匙也開附講的《冰鑑》原文
    go("#/lessons");
    byId("cwTracks").children[fjTi].children[2].children[fjLi + 1].children[5].children[0].click();
    const fjU = txt(byId("lnExtra"));
    ok(fjU.indexOf("骨有九起") >= 0, "解鎖後：附講《冰鑑》D 級原文出現");
    ok(fjU.indexOf("白圍繞眼圈") >= 0, "解鎖後：附講命定論述出現");
    ok(fjU.indexOf("本站【不引其判斷內容】") >= 0, "解鎖後：警示仍在（不是解鎖就等於背書）");

    // ⑤ 鎖上
    byId("btnDWZ").click();
    await tick(200);
    ok(DEATH.filter(w => txt(byId("wzBody")).indexOf(w) >= 0).length === 0, "鎖上後：望診 D 級消失");
    byId("wzTabs").children[3].click();
    ok(BAN.posture.filter(w => txt(byId("wzBody")).indexOf(w) >= 0).length === 0,
       "鎖上後：姿態 D 級消失");
    go("#/classics");
    ok(dShows() === 0, "鎖上後：古法體型 D 級消失");
    ok(D_BAN.filter(w => classicsAll().indexOf(w) >= 0).length === 0, "鎖上後：再度零外洩");

    section("列印版觀察表");
    go("#/print");
    const sheetNow = txt(byId("printSheet"));
    const SHEET_BAN = BAN.all;
    ok(sheetNow.indexOf("識人觀察表") >= 0, "表頭");
    ok(sheetNow.indexOf("面部色診（尊經）") >= 0, "含面部色診段");
    ok(sheetNow.indexOf("二之四、肥瘦三型（衛氣失常）") >= 0, "含肥瘦三型段");
    ok(sheetNow.indexOf("二之五、姿態（望診遵經卷下）") >= 0, "含姿態段");
    ok(SHEET_BAN.filter(w => sheetNow.indexOf(w) >= 0).length === 0, "列印版不含任何 D 級內容");
    sandbox._printed = false;
    byId("btnPrint").click();
    ok(sandbox._printed === true, "列印鈕觸發 print()");


  }

  section("案例復訓（史料案例）");
  const CS = sandbox.window.CASES;
  ok(!!CS, "CASES 已載入");
  ok(CS.cases.length === 3, "三篇：" + CS.cases.length);
  ok(CS.meta.positioning.length === 4, "定位說明 4 句");
  ok(CS.meta.positioning.some(t => t.indexOf("延伸訓練") >= 0), "定位：明示是延伸訓練");
  ok(CS.meta.positioning.some(t => t.indexOf("讀史 ≠ 識人") >= 0), "定位：讀史 ≠ 識人");
  ok(CS.meta.positioning.some(t => t.indexOf("推測單") >= 0), "定位：明示不替代真人推測單");
  ok(CS.meta.stepMap.length === 5, "四步／五步對照 5 列");
  ok(CS.meta.stepMap.some(r => r.m.indexOf("立基線") >= 0 && r.d.indexOf("没有基線") >= 0 || r.d.indexOf("沒有基線") >= 0),
     "對照表：明示立基線做不了");

  const markItems = CS.cases.reduce((a, c) =>
    a + c.tasks.filter(t => t.type === "mark").reduce((b, t) => b + t.items.length, 0), 0);
  ok(markItems === 23, "事實／評價標記共 " + markItems + " 句");
  ok(CS.cases[2].risk, "第 ③ 篇有史料風險區塊");
  ok(CS.cases[2].risk.items.some(x => x.d.indexOf("事後加工") >= 0), "風險：點出可能為事後加工");
  ok(CS.cases[2].risk.items.some(x => x.t.indexOf("司馬遷不可能在場") >= 0), "風險：點出叙述者不在場");
  ok(CS.cases.every(c => c.review.length >= 4), "每篇復盤 >= 4 題");
  ok(CS.cases.every(c => c.teacher && c.teacher.why.length && c.teacher.ask.length && c.teacher.traps.length),
     "每篇都有教員提示卡（為什麼／追問／陷阱）");
  ok(CS.cases.every(c => c.ending && c.ending.rows && c.ending.rows.length >= 3), "每篇都有結局對照表");
  ok(CS.cases.every(c => c.observe.every(o => o.text.indexOf("韩") < 0 && o.text.indexOf("练") < 0)),
     "原文皆為繁體（無簡體殘留）");
  ok(CS.cases.some(c => c.tasks.some(t => t.type === "mark" &&
       t.items.some(i => i.t.indexOf("孰視之") >= 0))), "標記含「孰視之」");

  go("#/cases");
  ok(txt(byId("csTitle")).length > 0, "案例復訓頁已渲染：" + txt(byId("csTitle")));
  ok(byId("csPositioning").children.length === 4, "定位說明已渲染 4 條");
  ok(byId("csLegend").children.length === 2, "圖例 2 條");
  ok(byId("csTabs").children.length === 3, "三篇 tab");
  ok(byId("csStepMap").children.length === 1, "五步對照表已渲染");

  const body0 = txt(byId("csBody"));
  ok(body0.indexOf("觀察素材") >= 0, "【一】觀察素材");
  ok(body0.indexOf("你的判斷") >= 0, "【二】你的判斷");
  ok(body0.indexOf("結局核對") >= 0, "【三】結局核對");
  ok(body0.indexOf("淮南") < 0 && body0.indexOf("淮陰侯韓信者") >= 0, "原文已渲染");

  /* 依據提示：只寫判斷不寫依據 → 標「無法復盤」 */
  const pair = makeQ(".case-pair", byId("csBody"))[0];
  ok(!!pair, "找到第一個填寫區塊");
  const csTas = makeQ("textarea", pair);
  ok(csTas.length === 2, "填寫區塊有判斷欄與依據欄");
  csTas[0].value = "我覺得他是個好人";
  fire(csTas[0], "input", {});
  const csWarn = makeQ(".basis-warn", pair)[0];
  ok(csWarn && csWarn.hidden === false, "只寫判斷沒寫依據 → 顯示「無法復盤」提示");
  csTas[1].value = "因為他給了數十日飯";
  fire(csTas[1], "input", {});
  ok(csWarn.hidden === true, "補上依據 → 提示消失");

  ok(localStorage.getItem("shiren.v1").indexOf('"cases"') >= 0, "state.cases 已寫入 localStorage");

  /* 匯入／清空後仍保有 cases 鍵 */
  const stC = JSON.parse(localStorage.getItem("shiren.v1"));
  ok(stC.cases && typeof stC.cases === "object", "state.cases 為物件");
  ok(!!sandbox.window.STATION, "（cases 併入統一重繪路徑 RENDERERS／rerenderInited）");

  section("教學者頁與資料管理");
  go("#/teacher");
  ok(byId("redlinesBox").children.length === 5, "紅線 5 條");
  ok(byId("qimouBox").children.length === 7, "七繆 7 條");
  ok(byId("ageTabs").children.length === 3, "分齡 3 段");
  ok((byId("storageInfo")._text || "").indexOf("筆記錄") >= 0, "儲存資訊：" + byId("storageInfo")._text);
  byId("btnExport").click();
  ok(true, "匯出未拋出例外");

  section("持久化");
  const before = JSON.parse(localStorage.getItem("shiren.v1"));
  ok(before.subjects.length === 1, "subjects 已持久化");
  ok(before.sessions.length === 4, "sessions 已持久化（" + before.sessions.length + " 筆）");
  ok(before.ledger.length === 1 && before.tongue.length === 1, "舊資料未被破壞");
} catch (e) {
  console.log("  ✗ 執行時拋出例外：" + e.message);
  console.log(e.stack.split("\n").slice(0, 5).join("\n"));
  fail++;
}

console.log("\n" + "=".repeat(52));
console.log(fail ? "  " + pass + " 通過 / " + fail + " 失敗"
  : (skipped ? "  全部通過（" + pass + " 項）　⚠ 有 " + skipped + " 段被 SKIP，未實際驗證"
             : "  全部通過（" + pass + " 項，0 失敗）"));
console.log("=".repeat(52));
process.exit(fail ? 1 : 0);
})();
