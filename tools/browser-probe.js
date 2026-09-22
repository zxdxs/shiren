/* ============================================================
   識人訓練站 · 真實瀏覽器端到端探測
   ------------------------------------------------------------
   煙霧測試用的是極簡 DOM 模擬器——它測不出「真實瀏覽器的
   WebCrypto 能不能跑」。這個腳本用 Chrome DevTools Protocol
   驅動真的 Chrome，走完整條加密流程：

     開附講 → 確認未通關零外洩 → 按解鎖鈕 → 過警告 →
     輸入通關語 → 確認原文出現 → 真正重新載入 → 確認自動上鎖

   用法（需要本機有 Google Chrome）：

     # 1. 開本機伺服器
     python3 -m http.server 8899 &
     # 2. 開 Chrome 的遠端偵錯埠
     "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
       --headless --disable-gpu --no-sandbox --user-data-dir=/tmp/cp_probe \
       --remote-debugging-port=9222 about:blank &
     # 3. 跑探測（通關語從 private/passphrase.txt 讀，不寫在指令裡）
     node tools/browser-probe.js "http://127.0.0.1:8899" "$(cat private/passphrase.txt)"

   也可以直接測線上站：
     node tools/browser-probe.js "https://zxdxs.github.io/shiren" "$(cat private/passphrase.txt)"
   ============================================================ */
// 用 Chrome DevTools Protocol 直接驅動真實 Chrome，驗證整條加密流程。
const BASE = process.argv[2] || "http://127.0.0.1:8899";
const PASS = process.argv[3] || "";
let id = 0, ws, pend = new Map(), dialogs = [];

function send(method, params) {
  return new Promise((res, rej) => {
    const m = ++id; pend.set(m, { res, rej });
    ws.send(JSON.stringify({ id: m, method, params: params || {} }));
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function evalJs(expr) {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) return { error: r.exceptionDetails.text + " " + (r.exceptionDetails.exception||{}).description };
  return { value: r.result.value };
}
async function goto(hash) {
  await evalJs(`location.hash = ${JSON.stringify(hash)}; 1`);
  await sleep(700);
}

(async () => {
  const PORT = process.env.CDP_PORT || 9222;
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = list.find(t => t.type === "page");
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id).res(m.result || {}); pend.delete(m.id); return; }
    if (m.method === "Page.javascriptDialogOpening") {
      dialogs.push(m.params.type + " :: " + m.params.message.replace(/\n/g, " ⏎ ").slice(0, 40));
      // confirm＝警告，選「確定」繼續；prompt＝通關語，填入密碼
      const isPrompt = m.params.type === "prompt";
      send("Page.handleJavaScriptDialog", {
        accept: isPrompt ? !!PASS : true,
        promptText: isPrompt ? PASS : ""
      });
    }
  };
  await send("Page.enable"); await send("Runtime.enable");
  await send("Page.navigate", { url: BASE + "/" });
  await sleep(2500);

  const out = [];
  const chk = (label, cond, extra) => out.push(`${cond ? "✓" : "✗"} ${label}${extra ? "　→ " + extra : ""}`);

  // ---- 1. 開附講 ----
  await goto("#/lessons");
  const fj = await evalJs(`(() => {
    const cards = document.querySelectorAll("#cwTracks .cl-card");
    for (const c of cards) {
      const rows = c.querySelectorAll("table tr");
      for (let i = 1; i < rows.length; i++) {
        if (rows[i].textContent.indexOf("冰鑑") >= 0) { rows[i].querySelector("button").click(); return "clicked:" + rows[i].textContent.slice(0,24); }
      }
    }
    return "NOT_FOUND";
  })()`);
  chk("附講可以開啟", String(fj.value).indexOf("clicked") === 0, String(fj.value));
  await sleep(600);

  const locked = await evalJs(`(() => {
    const e = document.getElementById("lnExtra");
    return { exists: !!e, text: e ? e.textContent : "", hasVault: e ? e.textContent.indexOf("骨有九起") >= 0 : false };
  })()`);
  chk("#lnExtra 存在", locked.value.exists);
  chk("未通關：看到加密提示", locked.value.text.indexOf("加密") >= 0, locked.value.text.slice(0, 60));
  chk("未通關：零原文外洩", !locked.value.hasVault);

  // ---- 2. 通關 ----
  const btn0 = await evalJs(`(document.getElementById("btnDLesson")||{}).textContent`);
  chk("附講頁上就有解鎖鈕", String(btn0.value).indexOf("解鎖") >= 0, String(btn0.value));
  chk("WebCrypto 可用", (await evalJs(`!!(window.crypto && crypto.subtle)`)).value === true);

  await evalJs(`document.getElementById("btnDLesson").click(); 1`);
  await sleep(3000);
  const after = await evalJs(`(() => {
    const b = document.getElementById("dWZBanner");
    return { banner: b ? !b.hidden : null, btn: document.getElementById("btnDWZ").textContent };
  })()`);
  chk("跳出警告＋通關語輸入框", dialogs.length >= 2, dialogs.join(" ｜ "));
  chk("解鎖橫幅出現", after.value.banner === true, "按鈕：" + after.value.btn);

  // ---- 3. 回附講看原文 ----
  await goto("#/lessons");
  await evalJs(`(() => {
    const cards = document.querySelectorAll("#cwTracks .cl-card");
    for (const c of cards) {
      const rows = c.querySelectorAll("table tr");
      for (let i = 1; i < rows.length; i++) if (rows[i].textContent.indexOf("冰鑑") >= 0) { rows[i].querySelector("button").click(); return 1; }
    }
  })()`);
  await sleep(600);
  const un = await evalJs(`document.getElementById("lnExtra").textContent`);
  chk("通關後：《冰鑑》6 條原文出現", un.value.indexOf("骨有九起") >= 0 && un.value.indexOf("白圍繞眼圈") >= 0,
      "長度 " + un.value.length);

  // ---- 4. 重新載入即上鎖 ----
  await send("Page.reload", { ignoreCache: true });          // 真正的重新載入
  await sleep(3000);
  await goto("#/lessons");
  await evalJs(`(() => { const cs=document.querySelectorAll("#cwTracks .cl-card");
    for (const c of cs){ const rs=c.querySelectorAll("table tr");
      for (let i=1;i<rs.length;i++) if(rs[i].textContent.indexOf("冰鑑")>=0){ rs[i].querySelector("button").click(); return 1; } } })()`);
  await sleep(600);
  const relock = await evalJs(`(document.getElementById("btnDLesson")||{}).textContent`);
  chk("重新載入後自動上鎖", String(relock.value).indexOf("解鎖") >= 0 && String(relock.value).indexOf("已解鎖") < 0, String(relock.value));

  // ---- 5. 版權受限區（第八繆底下的加密區）----
  await send("Page.reload", { ignoreCache: true });
  await sleep(3000);
  await goto("#/teacher");
  const mb0 = await evalJs(`document.getElementById("modernBiasBox").textContent`);
  chk("第八繆已渲染", String(mb0.value).indexOf("倖存者偏差") >= 0);
  chk("未通關：不洩漏章節目錄", String(mb0.value).indexOf("談心為萬能之本") < 0);
  chk("未通關：不洩漏出版方文案", String(mb0.value).indexOf("古往今來") < 0);
  chk("五卷卷名可公開（標題不受著作權保護）", String(mb0.value).indexOf("御人秘訣") >= 0);
  chk("站上明示版權期限", String(mb0.value).indexOf("2036") >= 0);

  await evalJs(`(() => { const b = Array.prototype.slice.call(document.querySelectorAll("#modernBiasBox button")).filter(function(x){ return x.textContent.indexOf("解鎖") >= 0; })[0]; if (b) b.click(); return 1; })()`);
  await sleep(3000);
  const mb1 = await evalJs(`document.getElementById("modernBiasBox").textContent`);
  chk("解鎖後：章節目錄出現", String(mb1.value).indexOf("談心為萬能之本") >= 0);
  chk("解鎖後：出版方文案出現", String(mb1.value).indexOf("古往今來") >= 0);

  console.log(out.join("\n"));
  console.log("\n對話框訊息：" + JSON.stringify(dialogs));
  process.exit(0);
})().catch(e => { console.error("✗ 探測失敗：", e.message); process.exit(1); });
