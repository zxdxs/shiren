/* ============================================================
   識人訓練站 · 案例復訓 · 真實瀏覽器端到端探測
   ------------------------------------------------------------
   煙霧測試用的是極簡 DOM 模擬器。這支用 Chrome DevTools Protocol
   驅動真的 Chrome，驗證案例復訓的完整閉環：

     渲染 → 只寫判斷會提示「無法復盤」 → 標記事實／評價 → 核對
     → 展開結局 → 復盤出現 → 第③篇史料風險 → 重新載入後存檔保留
     → 五種窄屏寬度橫向溢出 = 0

   用法（需要本機有 Google Chrome）：
     python3 -m http.server 8899 &
     "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
       --headless=new --disable-gpu --no-sandbox --user-data-dir=/tmp/cp_cases \
       --remote-debugging-port=9222 about:blank &
     node tools/cases-probe.js "http://127.0.0.1:8899"
     node tools/cases-probe.js "https://zxdxs.github.io/shiren"

   注意：等待一律用「輪詢到元素出現」而非固定睡眠。線上站載入慢，
   固定睡眠會讀到還沒渲染的頁面，產生偽陰性（本腳本初版就踩過）。
   ============================================================ */
let id=0, ws, pend=new Map();
function send(m,p){return new Promise(r=>{const n=++id;pend.set(n,r);ws.send(JSON.stringify({id:n,method:m,params:p||{}}));});}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function ev(e){const r=await send("Runtime.evaluate",{expression:e,returnByValue:true,awaitPromise:true});
  if(r.exceptionDetails) return "ERR:"+(r.exceptionDetails.exception||{}).description; return r.result?r.result.value:undefined;}
(async()=>{
  const list=await (await fetch(`http://127.0.0.1:${process.env.CDP_PORT||9222}/json/list`)).json();
  ws=new WebSocket(list.find(t=>t.type==="page").webSocketDebuggerUrl);
  await new Promise(r=>ws.onopen=r);
  ws.onmessage=e=>{const m=JSON.parse(e.data);
    if(m.id&&pend.has(m.id)){pend.get(m.id)(m.result||{});pend.delete(m.id);return;}
    if(m.method==="Page.javascriptDialogOpening") send("Page.handleJavaScriptDialog",{accept:true});};
  await send("Page.enable"); await send("Runtime.enable");
  await send("Page.navigate",{url:process.argv[2]+"/#/cases"});
  await sleep(1500);
  /* 等渲染真的完成，不靠固定睡眠——線上站慢的時候固定睡眠會造成偽陰性 */
  for (let i=0;i<40;i++){ if (await ev(`!!document.querySelector("#csBody .case-pair textarea")`)) break; await sleep(500); }
  const out=[]; const chk=(l,c,x)=>out.push(`${c?"✓":"✗"} ${l}${x?"　→ "+String(x).slice(0,90):""}`);

  chk("頁面已渲染", await ev(`!!document.getElementById("csTitle") && document.getElementById("csTitle").textContent.length>0`),
      await ev(`document.getElementById("csTitle").textContent`));
  chk("定位說明 4 條", await ev(`document.getElementById("csPositioning").children.length`)===4);
  chk("定位含「延伸訓練」", String(await ev(`document.getElementById("csPositioning").textContent`)).indexOf("延伸訓練")>=0);
  chk("定位含「讀史 ≠ 識人」", String(await ev(`document.getElementById("csPositioning").textContent`)).indexOf("讀史 ≠ 識人")>=0);
  chk("五步對照表已渲染", await ev(`document.querySelectorAll("#csStepMap table tr").length`)>=5);
  chk("三篇 tab", await ev(`document.querySelectorAll("#csTabs .tab").length`)===3);
  chk("圖例 2 條", await ev(`document.querySelectorAll("#csLegend .lg-row").length`)===2);

  const b0=await ev(`document.getElementById("csBody").textContent`);
  chk("【一】觀察素材", b0.indexOf("觀察素材")>=0);
  chk("【二】你的判斷", b0.indexOf("你的判斷")>=0);
  chk("【三】結局核對（摺疊）", b0.indexOf("結局核對")>=0);
  chk("原文含「淮陰侯韓信者」", b0.indexOf("淮陰侯韓信者")>=0);
  chk("原文為繁體（無「韩」）", b0.indexOf("韩")<0);
  chk("復盤預設隱藏", await ev(`(()=>{const ps=[...document.querySelectorAll("#csBody .panel")];const p=ps.find(x=>x.querySelector("h2")&&x.querySelector("h2").textContent.indexOf("【四】")>=0);return p?p.hidden:null;})()`)===true);

  // 只填判斷不填依據 → 提示
  await ev(`(()=>{const ta=document.querySelector("#csBody .case-pair textarea");ta.value="他是好人";ta.dispatchEvent(new Event("input",{bubbles:true}));return 1;})()`);
  await sleep(300);
  chk("只寫判斷沒寫依據 → 出現「無法復盤」提示",
      await ev(`(()=>{const w=document.querySelector("#csBody .case-pair .basis-warn");return w?!w.hidden:null;})()`)===true);

  // 標記 + 核對
  const marked = await ev(`(()=>{const rows=document.querySelectorAll(".mark-row");let n=0;
    rows.forEach(r=>{const b=r.querySelectorAll(".mark-btns .chip");if(b.length===2){b[0].click();n++;}});return n;})()`);
  chk("標記按鈕可點（共 "+marked+" 句）", marked>=6);
  await ev(`(()=>{const k=[...document.querySelectorAll("button")].find(b=>b.textContent.indexOf("核對這一段")>=0);if(k)k.click();return 1;})()`);
  await sleep(400);
  chk("核對後解說出現", await ev(`document.querySelectorAll(".mark-ans:not([hidden])").length`)>0);
  chk("核對顯示計分", String(await ev(`(document.querySelector(".mark-result")||{}).textContent`)).indexOf("你標了")>=0,
      await ev(`(document.querySelector(".mark-result")||{}).textContent`));

  // 展開結局 → 復盤出現
  await ev(`(()=>{const d=document.querySelector("#csBody details.hist");d.open=true;d.dispatchEvent(new Event("toggle"));return 1;})()`);
  await sleep(400);
  chk("展開結局後復盤出現", await ev(`(()=>{const ps=[...document.querySelectorAll("#csBody .panel")];const p=ps.find(x=>x.querySelector("h2")&&x.querySelector("h2").textContent.indexOf("【四】")>=0);return p?!p.hidden:null;})()`)===true);
  chk("復盤題數 >= 4", await ev(`document.querySelectorAll("#csBody .act").length`)>=4);

  // 第 ③ 篇：史料風險
  await ev(`document.querySelectorAll("#csTabs .tab")[2].click()`);
  await sleep(700);
  const b2=await ev(`document.getElementById("csBody").textContent`);
  chk("第 ③ 篇有史料風險區塊", b2.indexOf("史料風險")>=0);
  chk("風險含「司馬遷不可能在場」", b2.indexOf("司馬遷不可能在場")>=0);
  chk("風險含「事後加工」", b2.indexOf("事後加工")>=0);
  chk("風險原句照抄", b2.indexOf("這段可能是編的")>=0);

  // 存檔
  await send("Page.reload",{ignoreCache:true});
  await sleep(1500);
  for (let i=0;i<40;i++){ if (await ev(`!!document.querySelector("#csBody .case-pair textarea")`)) break; await sleep(500); }
  chk("重新載入後填寫內容保留", String(await ev(`(document.querySelector("#csBody .case-pair textarea")||{}).value`))==="他是好人");

  // 窄屏：橫向溢出
  console.log("\n--- 窄屏橫向溢出（scrollWidth > innerWidth 即 over）---");
  for (const w of [320,360,414,768,1024]) {
    await send("Emulation.setDeviceMetricsOverride",{width:w,height:900,deviceScaleFactor:1,mobile:w<768});
    await sleep(500);
    const r=await ev(`(()=>{const d=document.documentElement;
      return {over: d.scrollWidth - window.innerWidth, sw:d.scrollWidth, iw:window.innerWidth};})()`);
    const line=`  ${String(w).padStart(4)}px  over=${r.over}  (scrollWidth ${r.sw} / innerWidth ${r.iw})`;
    out.push((r.over<=0?"✓":"✗")+line);
  }
  await send("Emulation.clearDeviceMetricsOverride");

  // JS 錯誤
  const errs=await ev(`window.__errs ? window.__errs.length : 0`);
  out.push((errs===0?"✓":"✗")+` JS 錯誤：${errs}`);

  console.log(out.join("\n"));
  process.exit(0);
})().catch(e=>{console.error("✗",e.message);process.exit(1);});
