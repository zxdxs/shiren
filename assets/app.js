/* ============================================================
   識人訓練站 · 程式邏輯
   ------------------------------------------------------------
   零依賴、零連線、零伺服器。
   所有記錄只存在這台裝置的 localStorage 裡。
   ============================================================ */
(function () {
  "use strict";

  var S = window.STATION;
  var KEY = "shiren.v1";

  /* ---------------- 模組清單 ---------------- */
  /* 體例：理念 → 課件 → 方法 → 題庫 → 自測 → 進度 → 出處 */
  var MODULES = [
    { id: "philosophy", icon: "🧭", title: "理念",     desc: "為什麼要這樣設計——每條規矩都在對付自欺。", hash: "#/philosophy" },
    { id: "lessons",    icon: "📚", title: "課件",     desc: "分講課件 25 講；原典骨架。", hash: "#/lessons" },
    { id: "recite",     icon: "🗣", title: "記誦",     desc: "五層的第一層：24 條應背的內容。", hash: "#/recite" },
    { id: "method",     icon: "🧩", title: "方法",     desc: "五步與各自的產出物；四層驗收。", hash: "#/method" },
    { id: "drills",     icon: "🎯", title: "題庫",     desc: "七個訓練點，按能力分組。", hash: "#/drills" },
    { id: "mastery",    icon: "📈", title: "自測",     desc: "掌握度定位：你在哪一層。", hash: "#/mastery" },
    { id: "progress",   icon: "🗂", title: "進度",     desc: "五步產出物與校準數據。", hash: "#/progress" },
    { id: "constitution", icon: "⚖️", title: "體質基線", desc: "中醫那半邊的基線：九種體質——體質是基線，狀態是偏離。", hash: "#/constitution" },
    { id: "provenance", icon: "📜", title: "出處",     desc: "版權、來源與版本差異留痕。", hash: "#/provenance" },
    { id: "teacher",    icon: "📖", title: "給教學者", desc: "紅線、分齡單元、教學用法。", hash: "#/teacher" }
  ];


  /* ---------------- 工具 ---------------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function pad(n) { return String(n).padStart(2, "0"); }
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function addDays(iso, n) {
    var d = new Date(iso + "T00:00:00");
    d.setDate(d.getDate() + n);
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function esc(s) { return String(s == null ? "" : s); }
  function daysUntil(due) {
    return Math.round((new Date(due + "T00:00:00") - new Date(todayStr() + "T00:00:00")) / 86400000);
  }
  function humanUntil(due) {
    var d = daysUntil(due);
    if (d < 0) return "已逾期 " + Math.abs(d) + " 天";
    if (d === 0) return "今天到期";
    if (d < 60) return "還有 " + d + " 天";
    if (d < 365) return "還有約 " + Math.round(d / 30) + " 個月";
    var y = Math.floor(d / 365), m = Math.round((d % 365) / 30);
    return "還有 " + y + " 年" + (m ? " " + m + " 個月" : "");
  }
  function levelDef(k) {
    for (var i = 0; i < S.levels.length; i++) if (S.levels[i].k === k) return S.levels[i];
    return S.levels[0];
  }

  /* ---------------- 狀態 ---------------- */
  var state = { tongue: [], ledger: [], scenarios: {}, subjects: [], sessions: [], drills: {}, recite: {} };

  function loadState() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return;
      var o = JSON.parse(raw);
      if (o && typeof o === "object") {
        state.tongue = Array.isArray(o.tongue) ? o.tongue : [];
        state.ledger = Array.isArray(o.ledger) ? o.ledger : [];
        state.scenarios = (o.scenarios && typeof o.scenarios === "object") ? o.scenarios : {};
        state.subjects = Array.isArray(o.subjects) ? o.subjects : [];
        state.sessions = Array.isArray(o.sessions) ? o.sessions : [];
        state.drills = (o.drills && typeof o.drills === "object") ? o.drills : {};
        state.recite = (o.recite && typeof o.recite === "object") ? o.recite : {};
      }
    } catch (e) {
      console.warn("讀取記錄失敗，改用空白狀態：", e);
    }
  }
  function saveState() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.warn("儲存失敗（可能是瀏覽器隱私模式）：", e);
    }
  }
  function saveSoon(fn) {
    var t = null;
    return function () {
      clearTimeout(t);
      t = setTimeout(fn, 400);
    };
  }

  /* ============================================================
     路由
     ============================================================ */
  var VIEWS = ["home", "philosophy", "lessons", "lesson", "recite", "method", "drills", "mastery", "progress", "provenance",
    "classify", "quiz", "scenarios", "interrater", "tongue", "ledger", "track", "constitution", "wangzhen", "classics", "print", "teacher"];

  function currentRoute() {
    var h = location.hash.replace(/^#\/?/, "").trim();
    if (!h) return "home";
    return VIEWS.indexOf(h) >= 0 ? h : "home";
  }

  function showView(name) {
    VIEWS.forEach(function (v) {
      var node = $("#view-" + v);
      if (node) node.hidden = (v !== name);
    });
    $$(".nav a").forEach(function (a) {
      a.classList.toggle("active", a.getAttribute("href") === "#/" + (name === "home" ? "" : name));
    });
    var nav = $("#nav");
    if (nav) nav.classList.remove("open");
    var tg = $("#navToggle");
    if (tg) tg.setAttribute("aria-expanded", "false");
    window.scrollTo(0, 0);
  }

  function buildNav() {
    var nav = $("#nav");
    nav.innerHTML = "";
    var home = el("a", null, "首頁");
    home.href = "#/";
    nav.appendChild(home);
    MODULES.forEach(function (m) {
      var a = el("a", null, m.title);
      a.href = m.hash;
      nav.appendChild(a);
    });
  }

  /* ============================================================
     首頁
     ============================================================ */
  function renderHome() {
    var Y = S.system;
    $("#homeTitle").textContent = Y.identity;
    $("#homeTagline").textContent = Y.tagline;

    var grid = $("#homeCards");
    grid.innerHTML = "";
    MODULES.forEach(function (m) {
      var a = el("a", "mod-card");
      a.href = m.hash;
      a.appendChild(el("span", "ic", m.icon));
      a.appendChild(el("h3", null, m.title));
      a.appendChild(el("p", null, m.desc));
      grid.appendChild(a);
    });

    // 三個入口
    var cta = $("#homeCta");
    cta.innerHTML = "";
    [["🧭 從理念篇開始", "#/philosophy", "primary"], ["🎯 直接練題庫", "#/drills", ""], ["🧩 打開五步執行單", "#/method", ""]]
      .forEach(function (c) {
        var a = el("a", "btn " + c[2], c[0]);
        a.href = c[1];
        a.style.textDecoration = "none";
        cta.appendChild(a);
      });

    $("#homeEn").textContent = Y.en;
    $("#homeThesis").textContent = Y.thesis;
    $("#homeLayer").textContent = Y.layer;

    var ng = $("#homeNumbers");
    ng.innerHTML = "";
    Y.numbers.forEach(function (n) {
      var d = el("div", "num-cell");
      d.appendChild(el("div", "num-n", n.n));
      d.appendChild(el("div", "num-d", n.d));
      ng.appendChild(d);
    });

    $("#homeStepsNote").textContent = Y.fiveStepsNote;
    $("#homeStepsTitle").textContent = Y.fiveStepsTitle;
    var st = $("#homeSteps");
    st.innerHTML = "";
    var t1 = el("table", "sheet-table");
    var h1 = el("tr");
    ["步驟", "產出物（不交產出物＝沒做）", "為什麼"].forEach(function (x) { h1.appendChild(el("th", null, x)); });
    t1.appendChild(h1);
    Y.fiveSteps.forEach(function (f) {
      var tr = el("tr");
      tr.appendChild(el("td", "sh-k", f.n + " " + f.name));
      tr.appendChild(el("td", "bq-full", f.out));
      tr.appendChild(el("td", "bq-less", f.why));
      t1.appendChild(tr);
    });
    st.appendChild(t1);

    $("#homeLevelsNote").textContent = Y.fourLevelsNote;
    $("#homeLevelsTitle").textContent = Y.fourLevelsTitle;
    var lb = $("#homeLevels");
    lb.innerHTML = "";
    var t2 = el("table", "sheet-table");
    var h2 = el("tr");
    ["層", "意思", "例"].forEach(function (x) { h2.appendChild(el("th", null, x)); });
    t2.appendChild(h2);
    Y.fourLevels.forEach(function (l, i) {
      var tr = el("tr");
      tr.appendChild(el("td", "sh-k", "L" + (i + 1) + "　" + l.k));
      tr.appendChild(el("td", null, l.d));
      tr.appendChild(el("td", "bq-less", l.ex));
      t2.appendChild(tr);
    });
    lb.appendChild(t2);

    var hw = $("#homeHow");
    hw.innerHTML = "";
    Y.howToTrain.forEach(function (x) {
      var li = el("li");
      li.textContent = x;
      hw.appendChild(li);
    });

    var wu = $("#homeWarmup");
    wu.innerHTML = "";
    wu.appendChild(el("h2", null, Y.warmup.title));
    wu.appendChild(el("p", "muted small", Y.warmup.sub));
    wu.appendChild(el("p", null, Y.warmup.body));
    var wa = el("a", "btn primary", "去做這個熱身 →");
    wa.href = Y.warmup.link; wa.style.textDecoration = "none";
    wu.appendChild(wa);

    var rl = $("#homeRedlines");
    rl.innerHTML = "";
    S.redlines.slice(0, 3).forEach(function (r) {
      var li = el("li");
      li.appendChild(el("strong", null, r.t));
      li.appendChild(document.createTextNode("——" + r.d));
      rl.appendChild(li);
    });
  }

  /* ---------- 理念 ---------- */
  function renderPhilosophy() {
    var P = S.system.philosophy;
    $("#phTitle").textContent = P.title;
    $("#phLead").textContent = P.lead;
    var box = $("#phList");
    box.innerHTML = "";
    P.items.forEach(function (it) {
      var d = el("div", "cl-card");
      d.appendChild(el("div", "cl-title", it.q));
      d.appendChild(el("p", "cl-orig", it.a));
      box.appendChild(d);
    });
  }

  /* ---------- 課件 ---------- */
  function renderLessons() {
    var box = $("#lessonCards");
    box.innerHTML = "";
    [
      { ic: "👁", t: "望診遵經", d: "清·汪宏（1875），101 篇：相氣十法、平色基線、潤澤為本、分參、分部與姿態。", h: "#/wangzhen" },
      { ic: "🏛", t: "古法體型", d: "《靈樞》陰陽二十五人、五態之人、肥瘦三型、五音配屬，附可信度分級。", h: "#/classics" }
    ].forEach(function (c) {
      var a = el("a", "mod-card");
      a.href = c.h;
      a.appendChild(el("span", "ic", c.ic));
      a.appendChild(el("h3", null, c.t));
      a.appendChild(el("p", null, c.d));
      box.appendChild(a);
    });

    var C = window.COURSEWARE;
    if (!C) return;
    var all = allLessons();
    $("#cwSummary").textContent = "分講課件：共 " + all.length + " 講，約 " +
      all.reduce(function (a2, x) { return a2 + x.l.min; }, 0) +
      " 分鐘。每講有：學習目標、標重點的原文、白話、圖譜、線索、練習點。";
    var tb = $("#cwTracks");
    tb.innerHTML = "";
    C.tracks.forEach(function (t, ti) {
      var card = el("div", "cl-card");
      var head = el("div", "cl-head");
      head.appendChild(el("span", "cl-el", ti === 0 ? "人" : "望"));
      var hh = el("div");
      hh.appendChild(el("div", "cl-title", t.title));
      hh.appendChild(el("div", "muted small", t.sub + "　·　" + t.lessons.length + " 講，約 " +
        t.lessons.reduce(function (a3, x) { return a3 + x.min; }, 0) + " 分鐘"));
      head.appendChild(hh);
      card.appendChild(head);
      card.appendChild(el("p", "cl-purpose", t.lead));

      var dt = el("table", "sheet-table");
      var hr = el("tr");
      ["講次", "標題", "學習目標", "層級", "時長", ""].forEach(function (x) { hr.appendChild(el("th", null, x)); });
      dt.appendChild(hr);
      t.lessons.forEach(function (l, li) {
        var tr = el("tr");
        tr.appendChild(el("td", "sh-k", l.no));
        tr.appendChild(el("td", null, l.title));
        tr.appendChild(el("td", "bq-less", l.goal));
        tr.appendChild(el("td", "sh-tiny", l.layers.map(function (x) { return x.split(" ")[0]; }).join("・")));
        tr.appendChild(el("td", "sh-tiny", l.min + " 分"));
        var td = el("td");
        var b2 = el("button", "mini", "讀這一講");
        b2.type = "button";
        b2.addEventListener("click", function () { goLesson(ti, li); });
        td.appendChild(b2);
        tr.appendChild(td);
        dt.appendChild(tr);
      });
      card.appendChild(dt);
      card.appendChild(el("p", "muted small", "全書線索：" + t.threadAll));
      tb.appendChild(card);
    });
  }

  /* ---------- 應記誦 ---------- */
  var rcOnlyTodo = false;

  function rcAll() {
    return S.recite.categories.reduce(function (a, c) { return a.concat(c.items); }, []);
  }

  function renderRecite() {
    var R = S.recite;
    $("#rcTitle").textContent = R.title;
    $("#rcLead").textContent = R.lead;
    $("#rcWhy").textContent = R.why;
    var hw = $("#rcHowTo");
    hw.innerHTML = "";
    R.howTo.forEach(function (x) { hw.appendChild(el("li", null, x)); });

    var all = rcAll(), st = state.recite || {};
    var done = all.filter(function (i) { return st[i.id] === 2; }).length;
    var mid = all.filter(function (i) { return st[i.id] === 1; }).length;
    var none = all.length - done - mid;
    var g = $("#rcStats");
    g.innerHTML = "";
    [["會背", done, "good"], ["在背", mid, ""], ["未背", none, ""], ["完成度", Math.round((done / all.length) * 100) + "%", done === all.length ? "good" : ""]]
      .forEach(function (r) {
        var d = el("div", "calib-cell " + r[2]);
        d.appendChild(el("div", "calib-v", String(r[1])));
        d.appendChild(el("div", "calib-l", r[0]));
        g.appendChild(d);
      });

    var box = $("#rcCats");
    box.innerHTML = "";
    R.categories.forEach(function (c) {
      var items = c.items.filter(function (i) {
        return !rcOnlyTodo || (st[i.id] || 0) < 2;
      });
      if (!items.length) return;
      var card = el("div", "cl-card");
      var head = el("div", "cl-head");
      head.appendChild(el("span", "cl-el", c.name.slice(0, 1)));
      var hh = el("div");
      hh.appendChild(el("div", "cl-title", c.name + "（" + c.items.length + " 條）"));
      head.appendChild(hh);
      card.appendChild(head);
      card.appendChild(el("p", "cl-purpose", c.note));

      items.forEach(function (it) {
        var d = el("div", "rc-item");
        var ih = el("div", "rc-head");
        ih.appendChild(el("div", "rc-name", it.name));
        ih.appendChild(el("div", "muted small", it.src));
        var btns = el("div", "rc-btns");
        S.recite.levels.forEach(function (lv, li) {
          var b = el("button", "chip" + ((st[it.id] || 0) === li ? " on" : ""), lv);
          b.type = "button";
          b.addEventListener("click", function () {
            if (!state.recite) state.recite = {};
            state.recite[it.id] = li;
            saveState();
            renderRecite();
          });
          btns.appendChild(b);
        });
        ih.appendChild(btns);
        d.appendChild(ih);

        d.appendChild(el("blockquote", "cl-orig rc-body", it.body));
        if (it.tip) d.appendChild(el("p", "rc-tip", "訣：" + it.tip));
        var w = el("p", "rc-why");
        w.innerHTML = "解析：" + it.why;
        d.appendChild(w);
        card.appendChild(d);
      });
      box.appendChild(card);
    });
  }

  /* ---------- 圖譜引擎（純 SVG，零依賴） ---------- */
  function svgChart(spec) {
    var W = 680, out = [], h = 0;
    function esc3(x) {
      return String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
    function box(x, y, w, hh, cls) {
      return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + hh + '" rx="8" class="' + cls + '"/>';
    }
    function txt(cx, cy, t, cls) {
      return '<text x="' + cx + '" y="' + cy + '" class="ch-t' + (cls ? " " + cls : "") +
        '" text-anchor="middle">' + esc3(t) + '</text>';
    }
    if (spec.type === "pairs") {
      var rh = 42, pad = 8;
      h = spec.rows.length * rh + 6;
      spec.rows.forEach(function (r, i) {
        var y = i * rh + 3, cols = r.length, w1 = Math.min(230, W * 0.34);
        out.push(box(0, y, w1, rh - pad, "ch-a"));
        out.push(txt(w1 / 2, y + (rh - pad) / 2 + 5, r[0], "on-brand"));
        var sw = (W - w1 - 24) / (cols - 1);
        for (var j = 1; j < cols; j++) {
          var x = w1 + 24 + (j - 1) * sw;
          out.push('<line x1="' + w1 + '" y1="' + (y + (rh - pad) / 2) + '" x2="' + x +
            '" y2="' + (y + (rh - pad) / 2) + '" class="ch-line"/>');
          out.push(box(x, y, sw - 6, rh - pad, "ch-b"));
          out.push(txt(x + (sw - 6) / 2, y + (rh - pad) / 2 + 5, r[j], ""));
        }
      });
    } else if (spec.type === "chain") {
      var ih = 38, gap = 18;
      h = spec.items.length * (ih + gap) + 2;
      spec.items.forEach(function (t, i) {
        var y = i * (ih + gap) + 2;
        out.push(box(90, y, W - 180, ih, "ch-b"));
        out.push(txt(W / 2, y + ih / 2 + 5, t, ""));
        if (i < spec.items.length - 1) {
          var ay = y + ih, by = y + ih + gap;
          out.push('<line x1="' + (W / 2) + '" y1="' + ay + '" x2="' + (W / 2) + '" y2="' + (by - 5) + '" class="ch-line"/>');
          out.push('<path d="M' + (W / 2 - 5) + ' ' + (by - 7) + ' L' + (W / 2 + 5) + ' ' + (by - 7) +
            ' L' + (W / 2) + ' ' + by + ' Z" class="ch-arrow"/>');
        }
      });
    } else {
      var per = 3, bw = (W - 40) / per, bh = 36, rgap = 20;
      var rowsN = Math.ceil(spec.branches.length / per);
      h = 44 + 30 + rowsN * (bh + rgap);
      out.push(box(W / 2 - 160, 4, 320, 40, "ch-root"));
      out.push(txt(W / 2, 29, spec.root, "root"));
      spec.branches.forEach(function (b, i) {
        var rr = Math.floor(i / per), cc = i % per;
        var x = 20 + cc * bw, y = 74 + rr * (bh + rgap);
        out.push('<line x1="' + (W / 2) + '" y1="44" x2="' + (x + (bw - 20) / 2) +
          '" y2="' + y + '" class="ch-line faint"/>');
        out.push(box(x, y, bw - 20, bh, "ch-b"));
        out.push(txt(x + (bw - 20) / 2, y + bh / 2 + 5, b, ""));
      });
    }
    return '<svg viewBox="0 0 ' + W + ' ' + h + '" class="chart" role="img">' + out.join("") + "</svg>";
  }

  /* ---------- 分講課件 ---------- */
  var lessonSel = null;

  function allLessons() {
    var out = [];
    ((window.COURSEWARE || {}).tracks || []).forEach(function (t, ti) {
      t.lessons.forEach(function (l, li) { out.push({ t: t, ti: ti, l: l, li: li }); });
    });
    return out;
  }

  function goLesson(ti, li) {
    lessonSel = { ti: ti, li: li };
    // 注意：不能只改 hash 就交給路由——lesson 檢視若已初始化，ensure() 會跳過，
    // 結果會停留在上一講。所以這裡一律自己重繪。
    if (location.hash !== "#/lesson") location.hash = "#/lesson";
    showView("lesson");
    renderLesson();
  }

  function markKeys(text, target) {
    String(text).split(/\s*\[\[|\]\]\s*/).forEach(function (part, i) {
      if (!part) return;
      if (i % 2 === 1) target.appendChild(el("em", "kp", part));
      else target.appendChild(document.createTextNode(part));
    });
  }

  /* 極簡標記：**粗體** 與 [[重點]] */
  function mdInto(text, target) {
    String(text).split(/\*\*(.+?)\*\*/).forEach(function (seg, i) {
      if (!seg) return;
      if (i % 2 === 1) target.appendChild(el("strong", null, seg));
      else markKeys(seg, target);
    });
  }

  function lessonIndex() {
    var all = allLessons();
    return all.findIndex(function (x) {
      return lessonSel && x.ti === lessonSel.ti && x.li === lessonSel.li;
    });
  }

  function renderLesson() {
    var C = window.COURSEWARE;
    if (!C || !C.tracks.length) return;
    if (!lessonSel) lessonSel = { ti: 0, li: 0 };
    var t = C.tracks[lessonSel.ti], l = t.lessons[lessonSel.li];

    $("#lnTrack").textContent = t.title + "　" + t.sub;
    $("#lnTitle").textContent = l.no + "　" + l.title;
    $("#lnMeta").textContent = "約 " + l.min + " 分鐘　·　" + t.title + " " + t.lessons.length +
      " 講之 " + (lessonSel.li + 1) + "　·　全書約 " +
      t.lessons.reduce(function (a, x) { return a + x.min; }, 0) + " 分鐘";
    $("#lnGoal").textContent = l.goal;
    $("#lnLayers").textContent = "對應層級：" + l.layers.join("　·　");

    var ob = $("#lnOrig");
    ob.innerHTML = "";
    markKeys(l.orig, ob);

    $("#lnPlain").textContent = l.plain;
    $("#lnChart").innerHTML = svgChart(l.chart);
    $("#lnChartTitle").textContent = "圖 " + l.no + "　" + (l.chart.title || "");
    $("#lnThread").textContent = l.thread;
    $("#lnTrackThread").textContent = "全書線索：" + t.threadAll;
    $("#lnDrillText").textContent = l.drill.label;
    $("#lnDrill").href = l.drill.hash;

    renderLessonExtra(l);

    var i = lessonIndex(), all = allLessons();
    $("#lnPrev").disabled = i <= 0;
    $("#lnNext").disabled = i >= all.length - 1;
  }

  /* 附講專用區塊：警示、教學用法、加密原文（需通關） */
  function renderLessonExtra(l) {
    var box = $("#lnExtra");
    if (!box) return;
    box.innerHTML = "";
    if (!l.warn && !l.teaching && !l.dVault) return;

    if (l.warn) {
      var w = el("div", "panel warmup-panel");
      w.appendChild(el("h2", null, "讀這一講之前"));
      var wp = el("p"); mdInto(l.warn, wp); w.appendChild(wp);
      box.appendChild(w);
    }

    if (l.teaching) {
      var tp = el("div", "panel");
      tp.appendChild(el("h2", null, "教學用法"));
      l.teaching.forEach(function (x) {
        var d = el("div", "act");
        d.appendChild(el("div", "act-t", "· " + x.t));
        var dd = el("div", "act-d"); mdInto(x.d, dd); d.appendChild(dd);
        tp.appendChild(d);
      });
      box.appendChild(tp);
    }

    if (l.dVault) {
      var dp = el("div", "panel");
      dp.appendChild(el("h2", null, "原文（研究用，加密）"));

      /* 解鎖鈕就放在這裡。原本只在「望診遵經」「古法體型」兩頁有，
         結果在附講看到「已加密」的人得跑到別的頁才找得到按鈕。 */
      var btnRow = el("div", "row-btns");
      var gbtn = el("button", isUnlocked() ? "btn danger" : "btn",
        isUnlocked() ? "🔓 已解鎖（按此鎖上）" : "🔒 解鎖 D 級原文");
      gbtn.type = "button";
      gbtn.id = "btnDLesson";
      gbtn.addEventListener("click", unlockVault);
      btnRow.appendChild(gbtn);
      dp.appendChild(btnRow);

      if (!isUnlocked()) {
        var hint = el("p", "muted small");
        hint.appendChild(document.createTextNode(
          "其命定論述（貴賤、壽夭、子嗣、刑獄）已加密藏起，預設不顯示。" +
          "也可以到「望診遵經」「古法體型」兩頁解鎖（同一把鑰匙）："));
        var a1 = el("a", null, "望診遵經 → 「D 級原文（研究用）」");
        a1.href = "#/wangzhen";
        var a2 = el("a", null, "古法體型 → 「原文完整性（研究用）」");
        a2.href = "#/classics";
        hint.appendChild(a1);
        hint.appendChild(document.createTextNode("　·　"));
        hint.appendChild(a2);
        hint.appendChild(document.createTextNode("。在那裡按「🔒 解鎖 D 級原文」，再回到這一講。"));
        dp.appendChild(hint);
      } else {
        var items = (vaultData || {})[l.dVault] || [];
        if (!items.length) {
          dp.appendChild(el("p", "muted small", "（這一節的加密原文尚未寫入 vault。）"));
        }
        items.forEach(function (d) {
          dp.appendChild(el("blockquote", "cl-orig", d.text));
          dp.appendChild(el("p", "cl-d", d.why));
        });
      }
      box.appendChild(dp);
    }
  }

  function stepLesson(d) {
    var all = allLessons(), i = lessonIndex() + d;
    if (i < 0 || i >= all.length) return;
    lessonSel = { ti: all[i].ti, li: all[i].li };
    renderLesson();
    window.scrollTo(0, 0);
  }

  /* ---------- 方法（五步） ---------- */
  function renderMethod() {
    var Y = S.system;
    $("#methodLead").textContent = Y.fiveStepsNote;
    var box = $("#methodSteps");
    box.innerHTML = "";
    Y.fiveSteps.forEach(function (f, i) {
      var d = el("div", "cl-card");
      var head = el("div", "cl-head");
      head.appendChild(el("span", "cl-el", f.n));
      var hh = el("div");
      hh.appendChild(el("div", "cl-title", "第 " + (i + 1) + " 步　" + f.name));
      head.appendChild(hh);
      d.appendChild(head);
      var out = el("div", "cl-sec");
      out.appendChild(el("div", "cl-lbl grade-a", "產出物（不交＝沒做）"));
      out.appendChild(el("p", "cl-trait", f.out));
      d.appendChild(out);
      d.appendChild(el("p", "cl-purpose", f.why));

      var go2 = el("div", "row-btns");
      var targets = [
        [0, "#/tongue", "去立基線（舌頭日記）"],
        [1, "#/classify", "去練觀察純度"],
        [2, "#/recite", "去背十法"],
        [3, "#/ledger", "去寫推測單"],
        [4, "#/progress", "去看校準"]
      ];
      targets.filter(function (t) { return t[0] === i; }).forEach(function (t) {
        var a2 = el("a", "btn", t[2]);
        a2.href = t[1]; a2.style.textDecoration = "none";
        go2.appendChild(a2);
      });
      d.appendChild(go2);
      box.appendChild(d);
    });

    $("#fourLevelsTitle").textContent = Y.fourLevelsTitle;
    $("#fourLevelsNote").textContent = Y.fourLevelsNote;
    var lb = $("#fourLevelsBox");
    lb.innerHTML = "";
    var t = el("table", "sheet-table");
    var hr = el("tr");
    ["層", "意思", "例"].forEach(function (x) { hr.appendChild(el("th", null, x)); });
    t.appendChild(hr);
    Y.fourLevels.forEach(function (l, i) {
      var tr = el("tr");
      tr.appendChild(el("td", "sh-k", "L" + (i + 1) + "　" + l.k));
      tr.appendChild(el("td", null, l.d));
      tr.appendChild(el("td", "bq-less", l.ex));
      t.appendChild(tr);
    });
    lb.appendChild(t);
  }

  /* ---------- 題庫 ---------- */
  function renderDrills() {
    var Y = S.system;
    $("#drillsTitle").textContent = Y.drillsTitle;
    $("#drillsNote").textContent = Y.drillsNote;
    var box = $("#drillsList");
    box.innerHTML = "";
    Y.drills.forEach(function (d) {
      var card = el("div", "cl-card");
      var head = el("div", "cl-head");
      head.appendChild(el("span", "cl-el", d.icon));
      var hh = el("div");
      hh.appendChild(el("div", "muted small", d.pt));
      hh.appendChild(el("div", "cl-title", d.name + "　→ " + d.skill));
      head.appendChild(hh);
      card.appendChild(head);
      card.appendChild(el("p", "cl-purpose", d.desc));
      var a = el("a", "btn primary", "開始這個訓練點");
      a.href = d.hash; a.style.textDecoration = "none";
      card.appendChild(a);
      box.appendChild(card);
    });
  }

  /* ---------- 掌握度自測 ---------- */
  var msPicks = [];

  function renderMastery() {
    var M = S.system.mastery;
    $("#msTitle").textContent = M.title;
    $("#msLead").textContent = M.lead;
    $("#msNote").textContent = M.note;
    msPicks = [];
    $("#msResult").hidden = true;
    var box = $("#msList");
    box.innerHTML = "";
    M.questions.forEach(function (item, qi) {
      var card = el("div", "cls-card");
      card.appendChild(el("p", "cls-s", (qi + 1) + ". " + item.q));
      item.o.forEach(function (opt, oi) {
        var b = el("button", "opt", "L" + (oi + 1) + "　" + opt);
        b.type = "button";
        b.addEventListener("click", function () {
          if (card.classList.contains("done")) return;
          card.classList.add("done");
          msPicks[qi] = oi + 1;
          $$(".opt", card).forEach(function (x) { x.disabled = true; });
          b.classList.add("right");
          updateMs();
        });
        card.appendChild(b);
      });
      box.appendChild(card);
    });
    updateMs();
  }

  function updateMs() {
    var M = S.system.mastery, total = M.questions.length;
    var done = msPicks.filter(function (x) { return x; }).length;
    $("#msBar").style.width = (done / total) * 100 + "%";
    $("#msCounter").textContent = "已答 " + done + " / " + total + " 題";
    if (done < total) return;
    var sum = msPicks.reduce(function (a, b) { return a + b; }, 0);
    var avg = sum / total;                       // 1..4
    var lvl = Math.max(1, Math.min(4, Math.round(avg)));
    $("#msResult").hidden = false;
    $("#msScore").innerHTML = "";
    var L = M.levels[lvl - 1];
    var big = el("div", "lt-quote");
    big.appendChild(el("div", "lt-q-text", "L" + lvl + "　" + L.k));
    big.appendChild(el("div", "muted small", L.d + "　（平均 " + avg.toFixed(2) + " / 4.00）"));
    $("#msScore").appendChild(big);
    $("#msHint").textContent = M.resultHints[lvl];
    var br = $("#msBreak");
    br.innerHTML = "";
    M.levels.forEach(function (lv, i) {
      var n = msPicks.filter(function (x) { return x === i + 1; }).length;
      var row = el("div", "lv-row");
      row.appendChild(el("div", "lv-tag", lv.k));
      row.appendChild(el("div", null, lv.name));
      var bar = el("div", "ms-bar");
      var fill = el("div", "ms-fill");
      fill.style.width = (n / total) * 100 + "%";
      bar.appendChild(fill);
      row.appendChild(bar);
      row.appendChild(el("div", "lv-num", n + " 題"));
      br.appendChild(row);
    });
  }

  /* ---------- 學習進度 ---------- */
  function renderProgress() {
    var Y = S.system;
    var sessions = state.sessions || [], subs = state.subjects || [], led = state.ledger || [];
    var guesses = [];
    sessions.forEach(function (s) {
      (s.guesses || []).forEach(function (g) { if (g.text) guesses.push(g); });
    });
    led.forEach(function (r) {
      guesses.push({ text: r.guess, level: "L2", conf: 50, result: r.result, due: r.due });
    });

    // 五步產出物
    var sb = $("#pgSteps");
    sb.innerHTML = "";
    var hasBaseline = (state.tongue || []).length > 0 || sessions.length > 0;
    var hasObs = sessions.some(function (s) {
      return Object.keys(s.ch || {}).length || (s.color && Object.keys(s.color).length) ||
        (s.posture8 && Object.keys(s.posture8).length);
    });
    var hasJudged = sessions.some(function (s) { return (s.bias || []).length; });
    var hasGuess = guesses.length > 0;
    var hasRecon = guesses.some(function (g) { return g.result; });
    [
      [1, "① 立基線", "基線卡", hasBaseline],
      [2, "② 只寫看見的", "觀察記錄", hasObs],
      [3, "③ 判讀", "十法判讀＋偏誤自檢", hasJudged],
      [4, "④ 寫下可證偽的推測", "推測單", hasGuess],
      [5, "⑤ 對帳與校準", "對帳記錄＋校準報告", hasRecon]
    ].forEach(function (row) {
      var d = el("div", "lv-row");
      d.appendChild(el("div", "lv-tag", row[3] ? "✓" : "—"));
      d.appendChild(el("div", null, row[1] + "　→ " + row[2]));
      d.appendChild(el("div", "lv-num", row[3] ? "已留下產出物" : "尚未"));
      sb.appendChild(d);
    });

    // 校準
    var cb = $("#pgCalib");
    cb.innerHTML = "";
    var judged = guesses.filter(function (g) { return g.result === "hit" || g.result === "miss"; });
    var unk = guesses.filter(function (g) { return g.result === "unknown"; });
    if (!judged.length && !unk.length) {
      cb.appendChild(el("p", "empty", "還沒有對帳記錄。先去【練習】寫下一條附對帳日的推測，到期回來看。"));
    } else {
      var hit = judged.filter(function (g) { return g.result === "hit"; }).length;
      var acc = judged.length ? hit / judged.length : null;
      var confs = judged.map(function (g) { return (typeof g.conf === "number" ? g.conf : 50) / 100; });
      var mc = confs.length ? confs.reduce(function (a, b) { return a + b; }, 0) / confs.length : null;
      var grid = el("div", "calib-grid");
      function cell(v, l, sub, cls) {
        var d = el("div", "calib-cell " + (cls || ""));
        d.appendChild(el("div", "calib-v", v));
        d.appendChild(el("div", "calib-l", l));
        if (sub) d.appendChild(el("div", "muted small", sub));
        grid.appendChild(d);
      }
      cell(String(guesses.length), "總推測", "已對帳 " + judged.length + "・無法判定 " + unk.length);
      cell(acc == null ? "—" : (acc * 100).toFixed(0) + "%", "命中率", hit + " / " + judged.length);
      cell(mc == null ? "—" : (mc * 100).toFixed(0) + "%", "平均信心", "你以為的自己");
      if (acc != null && mc != null) {
        var gap = mc - acc;
        cell((gap >= 0 ? "+" : "") + (gap * 100).toFixed(0) + "%", "過度自信",
          gap > 0.2 ? "嚴重高估" : (gap > 0.1 ? "偏高" : (gap > -0.1 ? "校準良好" : "偏保守")),
          gap > 0.2 ? "bad" : (gap > -0.1 ? "good" : ""));
      }
      var fals = (judged.length + unk.length) ? judged.length / (judged.length + unk.length) : null;
      cell(fals == null ? "—" : (fals * 100).toFixed(0) + "%", "可證偽率",
        fals != null && fals < 0.6 ? "推測寫得太模糊" : "夠具體");
      cb.appendChild(grid);

      [["L2", "狀態（以日、週計）"], ["L3", "心性（以年計）"]].forEach(function (p) {
        var sel = guesses.filter(function (g) { return (g.level || "L2") === p[0]; });
        var j2 = sel.filter(function (g) { return g.result === "hit" || g.result === "miss"; });
        var d2 = el("div", "lv-row");
        d2.appendChild(el("div", "lv-tag", p[0]));
        d2.appendChild(el("div", null, p[1]));
        d2.appendChild(el("div", "lv-num",
          (j2.length ? (j2.filter(function (g) { return g.result === "hit"; }).length / j2.length * 100).toFixed(0) + "%" : "—") +
          "　(" + j2.length + " 筆已對帳)"));
        cb.appendChild(d2);
      });
    }

    // 存量
    var nb = $("#pgCounts");
    nb.innerHTML = "";
    [
      ["觀察對象", subs.length], ["觀察次數", sessions.length],
      ["推測", guesses.length], ["對帳完成", guesses.filter(function (g) { return g.result; }).length],
      ["舌頭日記", (state.tongue || []).length], ["單次猜測", led.length],
      ["記誦：會背", rcAll().filter(function (i) { return (state.recite || {})[i.id] === 2; }).length],
      ["記誦：在背", rcAll().filter(function (i) { return (state.recite || {})[i.id] === 1; }).length],
      ["記誦：總條目", rcAll().length],
      ["題庫完成（組）", Object.keys(state.drills || {}).length],
      ["答對題數（題庫）", Object.keys(state.drills || {}).reduce(function (a, k) {
        return a + ((state.drills[k] && state.drills[k].right) || 0);
      }, 0)]
    ].forEach(function (r) {
      var d = el("div", "lv-row");
      d.appendChild(el("div", null, r[0]));
      d.appendChild(el("div", "lv-num", String(r[1])));
      nb.appendChild(d);
    });
  }

  /* ---------- 出處與版本溯源 ---------- */
  function renderProvenance() {
    var P = S.system.provenance;
    $("#pvTitle").textContent = P.title;
    $("#pvLead").textContent = P.lead;

    var sb = $("#pvSources");
    sb.innerHTML = "";
    var t = el("table", "sheet-table");
    var hr = el("tr");
    ["來源", "說明", "權利"].forEach(function (x) { hr.appendChild(el("th", null, x)); });
    t.appendChild(hr);
    P.sources.forEach(function (r) {
      var tr = el("tr");
      tr.appendChild(el("td", "sh-k", r.t));
      tr.appendChild(el("td", null, r.d));
      tr.appendChild(el("td", "sh-tiny", r.right));
      t.appendChild(tr);
    });
    sb.appendChild(t);

    $("#pvDisclaimer").textContent = P.disclaimer;
    $("#pvVariantsTitle").textContent = P.variantsTitle;
    $("#pvVariantsNote").textContent = P.variantsNote;
    var vb = $("#pvVariants");
    vb.innerHTML = "";
    var vt = el("table", "sheet-table");
    var vh = el("tr");
    ["一處作", "另一處作", "性質"].forEach(function (x) { vh.appendChild(el("th", null, x)); });
    vt.appendChild(vh);
    P.variants.forEach(function (v) {
      var tr = el("tr");
      tr.appendChild(el("td", null, v.a));
      tr.appendChild(el("td", null, v.b));
      tr.appendChild(el("td", "sh-tiny", v.note));
      vt.appendChild(tr);
    });
    vb.appendChild(vt);

    $("#pvExcludedTitle").textContent = P.excludedTitle;
    $("#pvExcludedBody").textContent = P.excludedBody;
    $("#pvExcludedWhy").textContent = P.excludedWhy;
    $("#pvExcludedHow").textContent = P.excludedHow;
  }


  /* ============================================================
     ① 只寫看見的
     ============================================================ */
  var clsDone = 0, clsRight = 0;

  function renderClassify() {
    clsDone = 0; clsRight = 0;
    $("#promptClassify").textContent = S.prompts.classify;
    var list = $("#classifyList");
    list.innerHTML = "";
    $("#classifyResult").hidden = true;
    updateClsProgress();

    S.classify.forEach(function (item) {
      var card = el("div", "cls-card");
      card.appendChild(el("p", "cls-s", item.s));
      var btns = el("div", "cls-btns");

      [["obs", "只看見的"], ["inf", "已經下結論的"]].forEach(function (pair) {
        var b = el("button", "btn", pair[1]);
        b.type = "button";
        b.addEventListener("click", function () {
          if (card.classList.contains("done")) return;
          var correct = (pair[0] === item.type);
          card.classList.add("done");
          clsDone++;
          if (correct) clsRight++;

          var fb = el("p", "cls-fb " + (correct ? "good" : "bad"));
          fb.appendChild(el("strong", null, correct ? "✓ 答對了　" : "✗ 再看一次　"));
          fb.appendChild(document.createTextNode(
            (item.type === "obs" ? "這句是「只看見的」。" : "這句是「已經下結論的」。") + item.why
          ));
          card.appendChild(fb);
          updateClsProgress();
        });
        btns.appendChild(b);
      });

      card.appendChild(btns);
      list.appendChild(card);
    });
  }

  function updateClsProgress() {
    var total = S.classify.length;
    $("#classifyBar").style.width = (total ? (clsDone / total) * 100 : 0) + "%";
    $("#classifyCounter").textContent = "已做 " + clsDone + " / " + total + " 題";
    if (clsDone === total) {
      state.drills.classify = { done: total, right: clsRight, at: todayStr() };
      saveState();
      $("#classifyResult").hidden = false;
      $("#classifySummary").textContent =
        "你答對了 " + clsRight + " / " + total + " 題。答錯的那幾題，才是這次真正學到的東西。";
    }
  }

  /* ============================================================
     ② 偏誤找碴
     ============================================================ */
  var quizIdx = 0, quizLog = [];

  function renderQuiz() {
    quizIdx = 0; quizLog = [];
    $("#promptQuiz").textContent = S.prompts.quiz;
    $("#quizResult").hidden = true;
    renderQuizQuestion();
  }

  function renderQuizQuestion() {
    var card = $("#quizCard");
    card.innerHTML = "";
    var total = S.quiz.length;

    $("#quizBar").style.width = (quizIdx / total) * 100 + "%";
    $("#quizCounter").textContent = "第 " + (quizIdx + 1) + " / " + total + " 題";

    var item = S.quiz[quizIdx];
    card.appendChild(el("p", "quiz-q", "「" + item.q + "」"));
    card.appendChild(el("p", "quiz-sub", "這句話犯了哪一個毛病？"));

    var answered = false;

    S.quizOptions.forEach(function (optText, i) {
      var b = el("button", "opt", optText);
      b.type = "button";
      b.addEventListener("click", function () {
        if (answered) return;
        answered = true;
        var correct = (i === item.a);
        quizLog.push({ q: item.q, ok: correct });

        $$(".opt", card).forEach(function (x, xi) {
          x.disabled = true;
          if (xi === item.a) x.classList.add("right");
        });
        if (!correct) b.classList.add("wrong");

        var fb = el("div", "quiz-fb");
        fb.appendChild(el("span", "lbl", correct ? "✓ 答對了" : "✗ 再看一次"));
        fb.appendChild(document.createTextNode(item.why));
        card.appendChild(fb);

        var next = el("button", "btn primary", quizIdx === total - 1 ? "看結果" : "下一題 →");
        next.type = "button";
        next.style.marginTop = "14px";
        next.addEventListener("click", function () {
          quizIdx++;
          if (quizIdx >= total) renderQuizResult();
          else renderQuizQuestion();
        });
        card.appendChild(next);
      });
      card.appendChild(b);
    });
  }

  function renderQuizResult() {
    var total = S.quiz.length;
    var right = quizLog.filter(function (x) { return x.ok; }).length;
    $("#quizBar").style.width = "100%";
    $("#quizCounter").textContent = "已做 " + total + " / " + total + " 題";
    $("#quizCard").innerHTML = "";
    $("#quizResult").hidden = false;
    state.drills.quiz = { done: total, right: right, at: todayStr() };
    saveState();
    $("#quizSummary").textContent = "你答對了 " + right + " / " + total + " 題。";

    var rev = $("#quizReview");
    rev.innerHTML = "";
    quizLog.forEach(function (x, i) {
      var d = el("div", "review-item");
      d.appendChild(el("span", "mark " + (x.ok ? "yes" : "no"), x.ok ? "✓" : "✗"));
      d.appendChild(document.createTextNode((i + 1) + ". " + x.q));
      rev.appendChild(d);
    });
  }

  /* ============================================================
     ③ 三個可能只是
     ============================================================ */
  function renderScenarios() {
    $("#promptScenarios").textContent = S.prompts.scenarios;
    var list = $("#scenarioList");
    list.innerHTML = "";

    S.scenarios.forEach(function (item, i) {
      var card = el("div", "cls-card");
      card.appendChild(el("p", "cls-s", item.s));

      var ta = el("textarea");
      ta.placeholder = "1. 他可能只是⋯⋯\n2. 他可能只是⋯⋯\n3. 他可能只是⋯⋯";
      ta.value = state.scenarios[i] || "";

      var save = saveSoon(function () {
        state.scenarios[i] = ta.value;
        saveState();
      });
      ta.addEventListener("input", save);

      card.appendChild(ta);
      card.appendChild(el("p", "muted small", "💡 " + item.hint));
      list.appendChild(card);
    });
  }

  /* ============================================================
     ④ 一致性遊戲
     ============================================================ */
  var irCount = 0;

  function renderInterrater() {
    $("#promptInterrater").textContent = S.prompts.interrater;
    irCount = 0;
    $("#interraterInputs").innerHTML = "";
    $("#irResult").hidden = true;
    addObserver(); addObserver(); addObserver();
  }

  function addObserver() {
    irCount++;
    var n = irCount;
    var row = el("div", "ir-row");
    var head = el("div", "ir-head");
    var name = el("input");
    name.type = "text";
    name.value = "觀察者 " + n;
    name.setAttribute("aria-label", "觀察者名稱");
    head.appendChild(name);
    var del = el("button", "mini no", "移除");
    del.type = "button";
    del.addEventListener("click", function () { row.remove(); });
    head.appendChild(del);

    var ta = el("textarea");
    ta.placeholder = "一行寫一條「只看見的」，例：\n他說話時看了三次地上\n他講到一半停了兩秒";
    ta.setAttribute("aria-label", "觀察記錄");

    row.appendChild(head);
    row.appendChild(ta);
    row.dataset.name = "";
    $("#interraterInputs").appendChild(row);
    name.addEventListener("input", function () { row.dataset.name = name.value; });
    row.dataset.name = name.value;
  }

  function normLine(s) {
    return String(s).replace(/[\s，。、；：！？,.;:!?"'「」『』（）()【】\[\]・·—－-]/g, "").toLowerCase();
  }

  function runInterrater() {
    var rows = $$(".ir-row", $("#interraterInputs"));
    var groups = {};   // norm -> {text, who:[]}
    var obsCount = 0;

    rows.forEach(function (row, ri) {
      var name = (row.dataset.name || "").trim() || ("觀察者 " + (ri + 1));
      var lines = $("textarea", row).value.split("\n");
      var has = false;
      lines.forEach(function (ln) {
        var t = ln.trim();
        if (!t) return;
        has = true;
        var k = normLine(t);
        if (!k) return;
        if (!groups[k]) groups[k] = { text: t, who: [] };
        if (groups[k].who.indexOf(name) < 0) groups[k].who.push(name);
      });
      if (has) obsCount++;
    });

    var box = $("#irResult");
    box.innerHTML = "";
    box.hidden = false;

    var keys = Object.keys(groups);
    if (!keys.length) {
      box.appendChild(el("h2", null, "還沒有內容"));
      box.appendChild(el("p", "muted", "請至少填一位觀察者的記錄。"));
      return;
    }

    var common = keys.filter(function (k) { return groups[k].who.length >= 2; })
                     .sort(function (a, b) { return groups[b].who.length - groups[a].who.length; });
    var unique = keys.filter(function (k) { return groups[k].who.length === 1; });

    box.appendChild(el("h2", null, "比對結果"));
    box.appendChild(el("p", "muted small",
      "共 " + obsCount + " 位觀察者、" + keys.length + " 條不同記錄。" +
      "（採「完全相同才算同一條」，所以寫法相近但用字不同的會分開列出。）"));

    box.appendChild(el("h3", null, "✅ 大家都寫到的（" + common.length + " 條）"));
    if (common.length) {
      common.forEach(function (k) {
        var g = el("div", "group common");
        g.appendChild(el("div", "g-s", groups[k].text));
        g.appendChild(el("div", "g-w", "有 " + groups[k].who.length + " 人寫到：" + groups[k].who.join("、")));
        box.appendChild(g);
      });
      box.appendChild(el("p", "muted small", "→ 這些多半是畫面上真的有的。"));
    } else {
      box.appendChild(el("p", "empty", "沒有人寫到同一條。這也是一個發現——問問看：你們看的真的是同一段嗎？"));
    }

    box.appendChild(el("h3", null, "❓ 只有一個人寫到的（" + unique.length + " 條）"));
    if (unique.length) {
      unique.forEach(function (k) {
        var g = el("div", "group unique");
        g.appendChild(el("div", "g-s", groups[k].text));
        g.appendChild(el("div", "g-w", "只有 " + groups[k].who[0] + " 寫到"));
        box.appendChild(g);
      });
      box.appendChild(el("p", "muted small",
        "→ 問他一句：「你是從哪裡看到的？」——他有可能是觀察到別人漏看的，也有可能是補上了自己的推測。這兩者要分清楚。"));
    } else {
      box.appendChild(el("p", "empty", "沒有獨有記錄，大家寫得很一致。"));
    }

    box.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ============================================================
     ⑤ 舌頭日記
     ============================================================ */
  var picks = { spirit: null, body: null, coat: null, mood: null };

  function chipGroup(container, values, key, render) {
    container.innerHTML = "";
    values.forEach(function (v) {
      var label = render ? render(v) : v;
      var val = render ? v.v : v;
      var b = el("button", "chip", label);
      b.type = "button";
      b.dataset.val = String(val);
      b.addEventListener("click", function () {
        picks[key] = String(val);
        $$(".chip", container).forEach(function (x) { x.classList.toggle("on", x === b); });
      });
      container.appendChild(b);
    });
  }

  function renderTongue() {
    $("#promptTongue").textContent = S.prompts.tongue;
    var tz = $("#tongueZunJing");
    tz.innerHTML = "";
    tz.appendChild(el("h2", null, S.wangzhen.tongueNote.title));
    tz.appendChild(el("p", null, S.wangzhen.tongueNote.body));
    tz.appendChild(el("p", null, S.wangzhen.tongueNote.history));
    tz.appendChild(el("p", null, S.wangzhen.tongueNote.implication));
    var tl = el("p");
    tl.appendChild(document.createTextNode("→ 想看《內經》的骨架，去"));
    var a = el("a", "mini", "望診尊經");
    a.href = "#/wangzhen"; a.style.textDecoration = "none";
    tl.appendChild(a);
    tz.appendChild(tl);
    var f = $("#tongueForm");
    f.date.value = todayStr();

    var ss = $("#sleepSel");
    ss.innerHTML = "";
    S.tongue.sleepOptions.forEach(function (h) {
      var o = el("option", null, h + " 小時");
      o.value = String(h);
      if (h === 7) o.selected = true;
      ss.appendChild(o);
    });

    chipGroup($("#spiritChips"), S.tongue.spirit, "spirit", function (v) { return v.label; });
    chipGroup($("#bodyChips"), S.tongue.body, "body");
    chipGroup($("#coatChips"), S.tongue.coat, "coat");
    chipGroup($("#moodChips"), S.tongue.mood, "mood");

    picks = { spirit: null, body: null, coat: null, mood: null };
    renderTongueList();
  }

  function renderTongueList() {
    var box = $("#tongueList");
    box.innerHTML = "";
    if (!state.tongue.length) {
      box.appendChild(el("p", "empty", "還沒有記錄。從今天早上開始。"));
      return;
    }
    state.tongue.slice().reverse().forEach(function (r) {
      var row = el("div", "rec");
      row.appendChild(el("div", "rec-date", r.date));
      var body = el("div", "rec-body");
      body.appendChild(el("span", null,
        "睡 " + r.sleep + " 小時　精神 " + r.spirit + "/5"));
      body.appendChild(el("span", "k", "舌質：" + r.body + "　舌苔：" + r.coat + "　心情：" + r.mood));
      if (r.note) body.appendChild(el("span", "k", r.note));
      row.appendChild(body);

      var acts = el("div", "rec-acts");
      var del = el("button", "mini no", "刪除");
      del.type = "button";
      del.addEventListener("click", function () {
        if (!confirm("刪除 " + r.date + " 這筆記錄？")) return;
        state.tongue = state.tongue.filter(function (x) { return x.id !== r.id; });
        saveState(); renderTongueList();
      });
      acts.appendChild(del);
      row.appendChild(acts);
      box.appendChild(row);
    });
  }

  function submitTongue(e) {
    e.preventDefault();
    var f = e.target;
    if (!picks.spirit || !picks.body || !picks.coat || !picks.mood) {
      alert("請把「精神、舌質、舌苔、心情」都選一個。");
      return;
    }
    state.tongue.push({
      id: "t" + Date.now(),
      date: f.date.value || todayStr(),
      sleep: f.sleep.value,
      spirit: picks.spirit,
      body: picks.body,
      coat: picks.coat,
      mood: picks.mood,
      note: (f.note.value || "").trim()
    });
    saveState();
    f.note.value = "";
    renderTongue();
    alert("記下來了。明天早上再看一次。");
  }

  /* ============================================================
     ⑥ 我的猜測（對帳）
     ============================================================ */
  function renderLedger() {
    $("#promptLedger").textContent = S.prompts.ledger;
    var f = $("#ledgerForm");
    f.seen.value = ""; f.guess.value = "";

    var ds = $("#daysSel");
    if (!ds.options.length) {
      [1, 2, 3, 7, 14, 30].forEach(function (d) {
        var o = el("option", null, d === 1 ? "明天" : d + " 天後");
        o.value = String(d);
        if (d === 3) o.selected = true;
        ds.appendChild(o);
      });
    }
    renderLedgerLists();
  }

  function renderLedgerLists() {
    var today = todayStr();
    var pending = state.ledger.filter(function (r) { return !r.result; });
    var done = state.ledger.filter(function (r) { return r.result; });

    pending.sort(function (a, b) { return a.due < b.due ? -1 : 1; });

    var pbox = $("#ledgerPending");
    pbox.innerHTML = "";
    if (!pending.length) {
      pbox.appendChild(el("p", "empty", "目前沒有等你回來看的猜測。"));
    } else {
      pending.forEach(function (r) {
        var due = r.due <= today;
        var row = el("div", "rec");
        row.appendChild(el("div", "rec-date", r.due));

        var body = el("div", "rec-body");
        var tag = el("span", "tag" + (due ? " due" : ""), due ? "該對帳了" : "還沒到期");
        body.appendChild(tag);
        body.appendChild(document.createTextNode(r.guess));
        body.appendChild(el("span", "k", "看見的：" + r.seen));
        row.appendChild(body);

        var acts = el("div", "rec-acts");
        [["hit", "對"], ["miss", "不對"], ["unknown", "不知道"]].forEach(function (p) {
          var b = el("button", "mini " + (p[0] === "hit" ? "ok" : p[0] === "miss" ? "no" : ""), p[1]);
          b.type = "button";
          b.addEventListener("click", function () {
            r.result = p[0];
            r.judgedAt = todayStr();
            saveState(); renderLedgerLists();
          });
          acts.appendChild(b);
        });
        var del = el("button", "mini", "刪");
        del.type = "button";
        del.addEventListener("click", function () {
          if (!confirm("刪除這筆猜測？")) return;
          state.ledger = state.ledger.filter(function (x) { return x.id !== r.id; });
          saveState(); renderLedgerLists();
        });
        acts.appendChild(del);
        row.appendChild(acts);
        pbox.appendChild(row);
      });
    }

    var dbox = $("#ledgerDone");
    dbox.innerHTML = "";
    if (!done.length) {
      dbox.appendChild(el("p", "empty", "還沒有對帳完成的記錄。"));
    } else {
      done.slice().reverse().forEach(function (r) {
        var row = el("div", "rec");
        row.appendChild(el("div", "rec-date", r.judgedAt || r.due));
        var body = el("div", "rec-body");
        var map = { hit: ["ok", "猜對了"], miss: ["no", "猜錯了"], unknown: ["", "不知道"] };
        var m = map[r.result] || ["", r.result];
        var tag = el("span", "tag " + m[0], m[1]);
        body.appendChild(tag);
        body.appendChild(document.createTextNode(r.guess));
        body.appendChild(el("span", "k", "看見的：" + r.seen));
        row.appendChild(body);

        var acts = el("div", "rec-acts");
        var undo = el("button", "mini", "改回未對帳");
        undo.type = "button";
        undo.addEventListener("click", function () {
          r.result = null; delete r.judgedAt;
          saveState(); renderLedgerLists();
        });
        acts.appendChild(undo);
        row.appendChild(acts);
        dbox.appendChild(row);
      });
    }

    var hit = done.filter(function (r) { return r.result === "hit"; }).length;
    var miss = done.filter(function (r) { return r.result === "miss"; }).length;
    var unk = done.filter(function (r) { return r.result === "unknown"; }).length;
    $("#ledgerStats").textContent =
      "你猜了 " + (pending.length + done.length) + " 次：對 " + hit + "、不對 " + miss + "、不知道 " + unk +
      "（還有 " + pending.length + " 次等你回來看）";
  }

  function submitLedger(e) {
    e.preventDefault();
    var f = e.target;
    var d = parseInt(f.days.value, 10) || 3;
    state.ledger.push({
      id: "l" + Date.now(),
      seen: f.seen.value.trim(),
      guess: f.guess.value.trim(),
      created: todayStr(),
      due: addDays(todayStr(), d),
      result: null
    });
    saveState();
    f.seen.value = ""; f.guess.value = "";
    renderLedgerLists();
    alert("記下來了。到 " + addDays(todayStr(), d) + " 再回來看看。");
  }

  /* ============================================================
     ⑦ 長期追蹤（人物檔案 → 觀察 → 對帳 → 校準）
     ============================================================ */
  var trackSel = null;       // 目前選取的對象 id
  var pickType = null;       // 新增對象時選的類型

  function uid(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function subjectById(id) {
    for (var i = 0; i < state.subjects.length; i++) if (state.subjects[i].id === id) return state.subjects[i];
    return null;
  }
  function sessionsOf(id) {
    return state.sessions.filter(function (s) { return s.subjectId === id; })
      .sort(function (a, b) { return a.date < b.date ? -1 : (a.date > b.date ? 1 : 0); });
  }
  function typeOf(k) {
    for (var i = 0; i < S.subjectTypes.length; i++) if (S.subjectTypes[i].k === k) return S.subjectTypes[i];
    return S.subjectTypes[0];
  }

  /* ---------- 迷你走勢圖（純 inline SVG，無依賴） ---------- */
  function sparkline(vals) {
    if (!vals.length) return '<span class="muted">—</span>';
    var w = 150, h = 34, pad = 5;
    var pts = vals.map(function (v, i) {
      var x = vals.length > 1 ? pad + (w - 2 * pad) * i / (vals.length - 1) : w / 2;
      var y = h - pad - (h - 2 * pad) * ((v - 1) / 4);
      return [x, y];
    });
    var d = pts.map(function (p) { return p[0].toFixed(1) + "," + p[1].toFixed(1); }).join(" ");
    var dots = pts.map(function (p) {
      return '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="2.6" fill="#2f6f5e"/>';
    }).join("");
    return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + " " + h + '" class="spark">' +
      '<polyline points="' + d + '" fill="none" stroke="#2f6f5e" stroke-width="2" ' +
      'stroke-linejoin="round" stroke-linecap="round"/>' + dots + "</svg>";
  }

  function renderTrack() {
    $("#promptTrack").textContent = S.prompts.track;

    // 類型 chips
    var tc = $("#typeChips");
    tc.innerHTML = "";
    S.subjectTypes.forEach(function (t, i) {
      var b = el("button", "chip" + (i === 0 ? " on" : ""), t.icon + " " + t.name);
      b.type = "button";
      b.dataset.k = t.k;
      b.addEventListener("click", function () {
        pickType = t.k;
        $$(".chip", tc).forEach(function (x) { x.classList.toggle("on", x === b); });
        $("#typeHint").textContent = t.desc;
      });
      tc.appendChild(b);
    });
    pickType = S.subjectTypes[0].k;
    $("#typeHint").textContent = S.subjectTypes[0].desc;

    renderSubjectList();
    if (trackSel && subjectById(trackSel)) renderSubjectDetail();
    else { trackSel = null; $("#trackDetail").hidden = true; }
  }

  function renderSubjectList() {
    var box = $("#subjectList");
    box.innerHTML = "";
    if (!state.subjects.length) {
      box.appendChild(el("p", "empty", S.track.emptySubjects));
      return;
    }
    state.subjects.forEach(function (sub) {
      var n = sessionsOf(sub.id).length;
      var t = typeOf(sub.type);
      var card = el("div", "subj-card" + (sub.id === trackSel ? " on" : ""));

      var head = el("div", "subj-head");
      head.appendChild(el("span", "subj-icon", t.icon));
      var h = el("div");
      h.appendChild(el("div", "subj-code", sub.code));
      h.appendChild(el("div", "muted small", t.name + "・已觀察 " + n + " 次" + (sub.note ? "・" + sub.note : "")));
      head.appendChild(h);
      card.appendChild(head);

      var acts = el("div", "rec-acts");
      var open = el("button", "mini", sub.id === trackSel ? "已展開" : "打開");
      open.type = "button";
      open.addEventListener("click", function () {
        trackSel = sub.id;
        renderSubjectList(); renderSubjectDetail();
      });
      acts.appendChild(open);

      var del = el("button", "mini no", "刪除");
      del.type = "button";
      del.addEventListener("click", function () {
        var cnt = sessionsOf(sub.id).length;
        if (!confirm("刪除「" + sub.code + "」以及它的 " + cnt + " 次觀察記錄？無法復原。")) return;
        state.subjects = state.subjects.filter(function (x) { return x.id !== sub.id; });
        state.sessions = state.sessions.filter(function (x) { return x.subjectId !== sub.id; });
        if (trackSel === sub.id) trackSel = null;
        saveState(); renderTrack();
      });
      acts.appendChild(del);
      card.appendChild(acts);
      box.appendChild(card);
    });
  }

  function renderSubjectDetail() {
    var sub = subjectById(trackSel);
    if (!sub) { $("#trackDetail").hidden = true; return; }
    $("#trackDetail").hidden = false;

    var t = typeOf(sub.type);
    var ss = sessionsOf(sub.id);
    $("#tdTitle").textContent = sub.code;
    $("#tdMeta").textContent = t.icon + " " + t.name +
      "・共 " + ss.length + " 次觀察" +
      (ss.length ? "・" + ss[0].date + " 起至 " + ss[ss.length - 1].date : "") +
      (sub.note ? "・" + sub.note : "");
    if (sub.type === "close") {
      $("#tdMeta").textContent += "　⚠ 只記狀態，不記心性評價。";
    }

    renderTrend(ss);
    renderCalibration(ss);
    renderLongTerm(ss);
    renderGuesses(ss);
    renderHistory(ss);

    // 閉環提示（表單收起時也要能看到上一次）
    renderLoopReminder(ss);
    $("#sessionPanel").hidden = true;
    $("#btnNewSession").hidden = false;
  }

  /* ---------- 趨勢 ---------- */
  function renderTrend(ss) {
    var box = $("#tdTrend");
    box.innerHTML = "";
    if (!ss.length) {
      box.appendChild(el("p", "empty", S.track.emptySessions));
      return;
    }
    S.ratings.forEach(function (r) {
      var vals = ss.map(function (s) { return s.rt ? s.rt[r.k] : null; })
                   .filter(function (v) { return typeof v === "number"; });
      var row = el("div", "trend-row");
      var lbl = el("div", "trend-lbl");
      lbl.appendChild(el("div", "trend-name", r.name));
      lbl.appendChild(el("div", "muted small", r.lo + " ↔ " + r.hi));
      row.appendChild(lbl);

      var svg = el("div", "trend-svg");
      svg.innerHTML = sparkline(vals);
      row.appendChild(svg);

      var delta = el("div", "trend-delta");
      if (vals.length >= 2) {
        var d = vals[vals.length - 1] - vals[0];
        delta.appendChild(el("span", null, vals[0] + " → " + vals[vals.length - 1]));
        var tag = el("span", "tag " + (d > 0 ? "ok" : (d < 0 ? "no" : "")),
          (d > 0 ? "↑" : (d < 0 ? "↓" : "＝")) + Math.abs(d));
        delta.appendChild(tag);
      } else {
        delta.appendChild(el("span", "muted small", "只有 1 次"));
      }
      row.appendChild(delta);
      box.appendChild(row);
    });
    if (ss.length < 3) {
      box.appendChild(el("p", "muted small", "★ 填過 3 次以上，走勢才有意義。目前 " + ss.length + " 次。"));
    }
  }

  /* ---------- 校準（這是整站最有價值的地方） ---------- */
  function collectGuesses(ss) {
    var out = [];
    ss.forEach(function (s) {
      (s.guesses || []).forEach(function (g) {
        if (!g.text) return;
        out.push({ g: g, date: s.date, sessionId: s.id });
      });
    });
    return out;
  }

  function calibOf(list) {
    var judged = list.filter(function (x) { return x.g.result === "hit" || x.g.result === "miss"; });
    var unk = list.filter(function (x) { return x.g.result === "unknown"; });
    var hit = judged.filter(function (x) { return x.g.result === "hit"; }).length;
    var acc = judged.length ? hit / judged.length : null;
    var confs = judged.map(function (x) { return (typeof x.g.conf === "number" ? x.g.conf : 50) / 100; });
    var mc = confs.length ? confs.reduce(function (a, b) { return a + b; }, 0) / confs.length : null;
    var brier = null;
    if (judged.length) {
      brier = judged.reduce(function (a, x, i) {
        var o = x.g.result === "hit" ? 1 : 0;
        return a + Math.pow(confs[i] - o, 2);
      }, 0) / judged.length;
    }
    return {
      total: list.length, judged: judged.length, unk: unk.length,
      pending: list.length - judged.length - unk.length,
      hit: hit, acc: acc, meanConf: mc, brier: brier,
      falsifiable: (judged.length + unk.length) ? judged.length / (judged.length + unk.length) : null
    };
  }

  function renderCalibration(ss) {
    var box = $("#tdCalib");
    box.innerHTML = "";
    $("#calibHint").textContent = S.track.calibrationHint;

    var all = collectGuesses(ss);
    if (!all.length) {
      box.appendChild(el("p", "empty", "還沒有推測。在「新增一次觀察」的第四段寫下推測。"));
      return;
    }
    var c = calibOf(all);

    var grid = el("div", "calib-grid");
    function stat(label, val, sub2, cls) {
      var d = el("div", "calib-cell " + (cls || ""));
      d.appendChild(el("div", "calib-v", val));
      d.appendChild(el("div", "calib-l", label));
      if (sub2) d.appendChild(el("div", "muted small", sub2));
      grid.appendChild(d);
    }
    stat("總推測", String(c.total), "已對帳 " + c.judged + "・待對帳 " + c.pending + "・無法判定 " + c.unk);
    stat("命中率", c.acc == null ? "—" : (c.acc * 100).toFixed(0) + "%", c.hit + " / " + c.judged);
    stat("平均信心", c.meanConf == null ? "—" : (c.meanConf * 100).toFixed(0) + "%", "你以為的自己");
    if (c.acc != null && c.meanConf != null) {
      var gap = c.meanConf - c.acc;
      stat("過度自信", (gap >= 0 ? "+" : "") + (gap * 100).toFixed(0) + "%",
        gap > 0.2 ? "嚴重高估" : (gap > 0.1 ? "偏高" : (gap > -0.1 ? "校準良好" : "偏保守")),
        gap > 0.2 ? "bad" : (gap > -0.1 ? "good" : ""));
    }
    stat("可證偽率", c.falsifiable == null ? "—" : (c.falsifiable * 100).toFixed(0) + "%",
      c.falsifiable != null && c.falsifiable < 0.6 ? "偏低：推測寫得太模糊" : "推測寫得夠具體");
    if (c.brier != null) {
      stat("Brier", c.brier.toFixed(3), c.brier < 0.25 ? "比亂猜好" : "與亂猜相仿或更差");
    }
    box.appendChild(grid);

    // L2 / L3 落差 —— 核心洞察
    var l2 = all.filter(function (x) { return x.g.level === "L2"; });
    var l3 = all.filter(function (x) { return x.g.level === "L3"; });
    if (l2.length || l3.length) {
      var lv = el("div", "calib-levels");
      [["L2", "狀態（數天可對帳）", l2], ["L3", "心性（低信度）", l3]].forEach(function (p) {
        var cc = calibOf(p[2]);
        var d = el("div", "lv-row");
        d.appendChild(el("div", "lv-tag", p[0]));
        d.appendChild(el("div", null, p[1]));
        d.appendChild(el("div", "lv-num",
          (cc.acc == null ? "—" : (cc.acc * 100).toFixed(0) + "%") + "　(" + cc.judged + " 筆已對帳)"));
        lv.appendChild(d);
      });
      box.appendChild(lv);

      var a2 = calibOf(l2).acc, a3 = calibOf(l3).acc;
      if (a2 != null && a3 != null && l2.length >= 3 && l3.length >= 3) {
        var diff = a2 - a3;
        var note = el("p", diff > 0.15 ? "calib-note good" : "calib-note");
        note.textContent = diff > 0.15
          ? "Δ = +" + (diff * 100).toFixed(0) + "%：你看「狀態」比看「心性」準得多——這正是這套訓練的預期結果。練眼力靠 L2，用眼力要對 L3 保持謙卑。"
          : "Δ = " + (diff >= 0 ? "+" : "") + (diff * 100).toFixed(0) + "%：兩層差不多。若 L3 命中率很高，先懷疑對帳太寬鬆或推測太像巴納姆語句。";
        box.appendChild(note);
      }
    }
  }

  /* ---------- 七年之約：一年以上的長期對帳 ---------- */
  function renderLongTerm(ss) {
    var box = $("#tdLongTerm");
    if (!box) return;
    box.innerHTML = "";
    var LT = S.longTerm;
    $("#longTermTitle").textContent = LT.title + "（一年以上的長期對帳）";

    var q = el("blockquote", "lt-quote");
    q.appendChild(el("div", "lt-q-text", LT.quote.text));
    q.appendChild(el("div", "muted small", "—— " + LT.quote.src));
    q.appendChild(el("div", "lt-q-plain", LT.quote.plain));
    box.appendChild(q);

    var all = collectGuesses(ss).filter(function (x) {
      return daysUntil(x.g.due) > LT.thresholdDays;
    }).sort(function (a, b) { return a.g.due < b.g.due ? -1 : 1; });

    if (!all.length) {
      box.appendChild(el("p", "muted small",
        "目前沒有「一年以上」的長期推測。" + LT.why));
      box.appendChild(el("p", "lt-duty", LT.duty));
      return;
    }

    var farthest = all[all.length - 1].g.due;
    box.appendChild(el("p", "lt-sum", "共 " + all.length + " 條長期推測。最遠的一條："
      + farthest + "（" + humanUntil(farthest) + "）"));

    all.forEach(function (x) {
      var row = el("div", "rec");
      row.appendChild(el("div", "rec-date", x.g.due));
      var body = el("div", "rec-body");
      body.appendChild(el("span", "tag due", humanUntil(x.g.due)));
      body.appendChild(document.createTextNode(x.g.text));
      body.appendChild(el("span", "k", "信心 " + x.g.conf + "%・" + (x.g.level || "L2")
        + "・寫於 " + x.date));
      row.appendChild(body);
      box.appendChild(row);
    });
    box.appendChild(el("p", "lt-duty", LT.duty));
  }

  /* ============================================================
     ⑨ 古法體型（教學者參考，附可信度分級）
     ============================================================ */
  var classicsTab = 0;

  /* ============================================================
     D 級內容：AES-GCM-256 密文存在 assets/vault.js。
     通關語只存在【記憶體】，重新載入即失效——刻意不持久化。
     ============================================================ */
  var vaultData = null;
  var unlocking = false;

  function isUnlocked() { return !!vaultData; }

  function refreshGateViews() {
    renderClassics();
    renderWangzhen();
    /* 附講頁也有 D 區塊，且解鎖鈕就在那裡——必須一起更新 */
    if ($("#lnExtra")) renderLesson();   // 用站內 $ 而非 document.getElementById（測試用的極簡 DOM 沒有後者）
    /* 「給教學者」頁的第八繆也有加密區（版權受限） */
    if ($("#modernBiasBox")) renderModernBias();
  }

  function lockVault() {
    vaultData = null;
    refreshGateViews();
  }

  function unlockVault() {
    if (unlocking) return;
    if (isUnlocked()) { lockVault(); return; }

    var C = window.SHREN_CRYPTO, V = window.SHREN_VAULT;
    if (!C || !C.available || !C.available()) {
      alert("這台裝置或這個瀏覽器不支援 WebCrypto，無法解鎖。\n" +
        "請用 https、localhost，或直接用瀏覽器開啟本機檔案（Chrome／Safari／Firefox 皆可）。");
      return;
    }
    if (!V || !V.ct) {
      alert("找不到密文（assets/vault.js）。\n請先在專案資料夾執行：\n\nnode tools/make-vault.js \"你的通關語\"");
      return;
    }

    var g = S.classics.dFull.gate;
    var extra = "\n\n【望診】另含「死候」預測（例如某色出現在某處就會猝死）。" +
      "非醫療人員據此判斷自己或家人，會造成嚴重誤判與驚嚇。";
    if (!window.confirm(g.title + "\n\n" +
        g.lines.map(function (l) { return "・" + l; }).join("\n") + extra)) return;

    var pass = window.prompt("請輸入通關語：");
    if (!pass) return;

    unlocking = true;
    C.decrypt(V, pass).then(function (data) {
      unlocking = false;
      vaultData = data;
      refreshGateViews();
    }).catch(function () {
      unlocking = false;
      alert("通關語不正確，或密文已損毀。");
    });
  }

  function renderClassics() {
    var C = S.classics;
    $("#promptClassics").textContent = S.prompts.classics;
    $("#classicsAudience").textContent = C.audienceNote;

    var gb = $("#gradeBox");
    gb.innerHTML = "";
    C.grades.forEach(function (g) {
      var d = el("div", "grade-card " + g.cls);
      var h = el("div", "grade-h");
      h.appendChild(el("span", "grade-k", g.k));
      h.appendChild(el("span", null, g.name));
      d.appendChild(h);
      d.appendChild(el("div", "grade-d", g.desc));
      gb.appendChild(d);
    });

    $("#excludedTitle").textContent = C.excluded.title;
    $("#excludedBody").textContent = C.excluded.body;
    $("#excludedReason").textContent = C.excluded.reason;
    $("#excludedDecision").textContent = C.excluded.decision;

    var tabs = $("#classicsTabs");
    tabs.innerHTML = "";
    CLASSICS_TABS.forEach(function (tab, i) {
      var b = el("button", "tab" + (i === classicsTab ? " on" : ""), tab.t);
      b.type = "button";
      b.addEventListener("click", function () {
        classicsTab = i;
        $$(".tab", tabs).forEach(function (x) { x.classList.remove("on"); });
        b.classList.add("on");
        renderClassicsTab();
      });
      tabs.appendChild(b);
    });
    renderClassicsTab();

    renderDFull();

    var hb = $("#howToBox");
    hb.innerHTML = "";
    C.howToUse.forEach(function (h) {
      var d = el("div", "act");
      d.appendChild(el("div", "act-t", "· " + h.t));
      d.appendChild(el("div", "act-d", h.d));
      hb.appendChild(d);
    });
  }

  var wzTab = 0;

  var WZ_TABS = [
    { t: "相氣十法", f: function (b) { wzTen(b); } },
    { t: "平色與潤澤", f: function (b) { wzBaseline(b); } },
    { t: "分參（老少／氣質／意態）", f: function (b) { wzAdjust(b); } },
    { t: "姿態（卷下）", f: function (b) { wzPosture(b); } },
    { t: "篇目 101", f: function (b) { wzToc(b); } },
    { t: "《內經》原文（根）", f: function (b) { wzNeijing(b); } }
  ];

  function renderWzTab() {
    var box = $("#wzBody");
    box.innerHTML = "";
    WZ_TABS[wzTab].f(box);
  }

  function wzQuote(box, q) {
    var d = el("div", "wz-quote");
    var line = el("div", "wz-q-line");
    line.appendChild(el("span", "cl-lbl grade-" + q.tag.toLowerCase(), q.tag));
    line.appendChild(el("span", "wz-q-text", q.text));
    d.appendChild(line);
    d.appendChild(el("div", "wz-q-note", q.note));
    box.appendChild(d);
  }

  /* 相氣十法 */
  function wzTen(box) {
    var Z = S.zunjing;
    box.appendChild(el("p", "cl-purpose", Z.tenIntro));
    box.appendChild(el("p", "muted small", Z.tenNote));
    var t = el("table", "sheet-table");
    var hr = el("tr");
    ["法", "定義（原文）", "分什麼", "變化"].forEach(function (x) { hr.appendChild(el("th", null, x)); });
    t.appendChild(hr);
    Z.tenMethods.forEach(function (m) {
      var tr = el("tr");
      tr.appendChild(el("td", "sh-k", m.pair));
      tr.appendChild(el("td", null, m.def));
      tr.appendChild(el("td", "sh-tiny", m.judges));
      tr.appendChild(el("td", "bq-less", m.detail));
      t.appendChild(tr);
    });
    box.appendChild(t);
    box.appendChild(el("blockquote", "cl-orig", Z.tenOutro));
  }

  /* 平色與潤澤 */
  function wzBaseline(box) {
    var Z = S.zunjing;
    var B = Z.baseline;
    box.appendChild(el("h5", null, B.title));
    box.appendChild(el("p", "muted small", B.src));
    var q = el("div", "lt-quote");
    q.appendChild(el("div", "lt-q-text", B.key));
    box.appendChild(q);
    box.appendChild(el("blockquote", "cl-orig", B.normal));
    box.appendChild(el("p", "cl-purpose", B.normalNote));
    box.appendChild(el("blockquote", "cl-orig", B.five));
    box.appendChild(el("p", "cl-purpose", B.fiveNote));
    box.appendChild(el("p", "lt-duty", B.designImpact));

    var G = Z.gloss;
    box.appendChild(el("h5", null, G.title));
    box.appendChild(el("p", "muted small", G.src));
    var q2 = el("div", "lt-quote");
    q2.appendChild(el("div", "lt-q-text", G.key));
    box.appendChild(q2);
    box.appendChild(el("blockquote", "cl-orig", G.text));
    box.appendChild(el("p", "cl-purpose", G.note));
    box.appendChild(el("blockquote", "cl-orig", G.live));
    box.appendChild(el("p", "cl-purpose", G.liveNote));

    var dd = el("div", "wz-d");
    if (!isUnlocked()) {
      dd.appendChild(el("p", "muted small", "本節另有 " + Z.dLevel.length + " 條 D 級原文（五色見死），已加密藏起。"));
    } else {
      (vaultData.zunjing || []).forEach(function (d) {
        dd.appendChild(el("blockquote", "cl-orig d-on", d.text));
        dd.appendChild(el("p", "cl-d", d.why));
      });
    }
    box.appendChild(dd);
  }

  /* 分參 */
  function wzAdjust(box) {
    S.zunjing.adjust.forEach(function (a) {
      var card = el("div", "cl-card");
      card.appendChild(el("div", "cl-title", a.name));
      card.appendChild(el("p", "muted small", a.src));
      var q = el("div", "lt-quote");
      q.appendChild(el("div", "lt-q-text", a.key));
      card.appendChild(q);
      card.appendChild(el("blockquote", "cl-orig", a.text));
      if (a.decades) card.appendChild(el("blockquote", "cl-orig", a.decades));
      card.appendChild(el("p", "cl-purpose", a.note));
      box.appendChild(card);
    });
  }

  /* 姿態（從「用」反推） */
  function wzPosture(box) {
    var P = S.posture;
    box.appendChild(el("p", "muted small", P.src));
    box.appendChild(el("p", "cl-purpose", P.lead));
    var q = el("div", "lt-quote");
    q.appendChild(el("div", "lt-q-text", P.principle));
    q.appendChild(el("div", "muted small", P.principleNote));
    box.appendChild(q);
    box.appendChild(el("p", "muted small", P.middle));

    box.appendChild(el("h5", null, "校正因子（汪宏給的因人因時校正）"));
    var cc = el("div", "chips");
    P.context.forEach(function (c) { cc.appendChild(el("span", "chip static", c)); });
    box.appendChild(cc);
    box.appendChild(el("p", "muted small", P.contextNote));

    box.appendChild(el("h5", null, "八法（四對，兩端）"));
    var t = el("table", "sheet-table");
    var hr = el("tr");
    ["對", "陽端", "陰端", "說明（原文）"].forEach(function (x) { hr.appendChild(el("th", null, x)); });
    t.appendChild(hr);
    P.eight.forEach(function (e) {
      var tr = el("tr");
      tr.appendChild(el("td", "sh-k", e.pair));
      tr.appendChild(el("td", "bq-full", e.yang));
      tr.appendChild(el("td", "bq-less", e.yin));
      tr.appendChild(el("td", null, e.note));
      t.appendChild(tr);
    });
    box.appendChild(t);

    [["坐", P.sit], ["臥", P.lie], ["身容", P.body], ["行", P.walk]].forEach(function (grp) {
      var G = grp[1];
      box.appendChild(el("h5", null, "診" + grp[0] + "（" + G.src + "）"));
      if (G.note) box.appendChild(el("p", "muted small", G.note));
      var gt = el("table", "sheet-table");
      var gh = el("tr");
      ["動作（可觀察）", "可以這樣猜（然後對帳）", "原文依據"].forEach(function (x) { gh.appendChild(el("th", null, x)); });
      gt.appendChild(gh);
      G.items.forEach(function (it) {
        var tr = el("tr");
        tr.appendChild(el("td", "sh-k", it.name));
        tr.appendChild(el("td", "bq-full", it.guess));
        tr.appendChild(el("td", "bq-less", it.why));
        gt.appendChild(tr);
      });
      box.appendChild(gt);
    });

    var M = P.medical;
    box.appendChild(el("h5", null, M.title));
    box.appendChild(el("blockquote", "cl-orig", M.body));
    box.appendChild(el("p", "lt-duty", M.warn));

    var dd = el("div", "wz-d");
    if (!isUnlocked()) {
      dd.appendChild(el("p", "muted small", "本節另有 " + P.dLevel.length + " 條 D 級原文（死候性質），已加密藏起。"));
    } else {
      ((vaultData.posture) || []).forEach(function (d) {
        dd.appendChild(el("blockquote", "cl-orig d-on", d.text));
        dd.appendChild(el("p", "cl-d", d.why));
      });
    }
    box.appendChild(dd);
  }

  /* 篇目 101 */
  function wzToc(box) {
    var T = S.zunjing.toc;
    box.appendChild(el("p", "muted small",
      "全書 " + (T.shang.length + T.xia.length) + " 篇。這是一張地圖——不必全教，但要知道還有什麼可看。"));
    [["卷上（總論・氣色・主病）", T.shang], ["卷下（分部・姿態・舉止）", T.xia]].forEach(function (p) {
      var card = el("div", "cl-card");
      card.appendChild(el("div", "cl-title", p[0] + "　" + p[1].length + " 篇"));
      var ol = el("div", "toc-grid");
      p[1].forEach(function (n, i) {
        ol.appendChild(el("span", "toc-item", (i + 1) + ". " + n));
      });
      card.appendChild(ol);
      box.appendChild(card);
    });
  }

  /* 《內經》原文（根） */
  function wzNeijing(box) {
    var W = S.wangzhen;
    box.appendChild(el("p", "muted small",
      "以下是本站最初整理的《內經》原文——它們是汪宏的根。看清楚：《望診遵經》站在這些原文之上。"));
    W.chapters.forEach(function (c) {
      var card = el("div", "cl-card");
      var head = el("div", "cl-head");
      head.appendChild(el("span", "cl-el", c.num.slice(-2)));
      var hh = el("div");
      hh.appendChild(el("div", "cl-title", c.name + "（第" + c.num + "）"));
      hh.appendChild(el("div", "muted small", c.src));
      head.appendChild(hh);
      card.appendChild(head);
      card.appendChild(el("p", "cl-purpose", c.gist));
      if (c.crossRef) card.appendChild(el("p", "muted small", c.crossRef));
      (c.quotes || []).forEach(function (q) { wzQuote(card, q); });

      var dl = (c.dLevel || []);
      if (dl.length) {
        var dd = el("div", "wz-d");
        if (!isUnlocked()) {
          dd.appendChild(el("p", "muted small",
            "本章另有 " + dl.length + " 條 D 級原文，已加密藏起。"));
        } else {
          ((vaultData.chapters || {})[c.id] || []).forEach(function (d) {
            dd.appendChild(el("blockquote", "cl-orig d-on", d.text));
            dd.appendChild(el("p", "cl-d", d.why));
          });
        }
        card.appendChild(dd);
      }

      if (c.divisions) {
        var dw = el("details", "cl-vars");
        dw.appendChild(el("summary", null, "面部臟腑肢節分部（" + c.divisions.length + " 個部位）"));
        dw.appendChild(el("blockquote", "cl-orig", c.divisionsSrc));
        var dt = el("table", "sheet-table");
        var hr = el("tr");
        ["部位", "所主"].forEach(function (x) { hr.appendChild(el("th", null, x)); });
        dt.appendChild(hr);
        c.divisions.forEach(function (d) {
          var tr = el("tr");
          tr.appendChild(el("td", "sh-k", d.at));
          tr.appendChild(el("td", null, d.part));
          dt.appendChild(tr);
        });
        dw.appendChild(dt);
        card.appendChild(dw);
      }
      box.appendChild(card);
    });
  }

  function renderDFull() {
    var D = S.classics.dFull;
    $("#dfullIntro").textContent =
      "本站預設只顯示 A／B／C 級內容。D 級原文（命定論述與術數）另存一份，供你研究原文完整性——但預設關閉，且每次重新載入都會自動關回。";
    var btn = $("#btnDFull");
    btn.textContent = isUnlocked() ? "🔓 已解鎖（按此鎖上）" : "🔒 解鎖 D 級原文";
    btn.className = isUnlocked() ? "btn danger" : "btn";
    $("#dfullIntro").textContent =
      "D 級原文以 AES-GCM-256 加密後才放進 repo（assets/vault.js）。" +
      "沒有通關語，任何人都解不開——包括托管商與 GitHub。通關語只留在這頁的記憶體裡，重新載入即失效。";

    var banner = $("#dBanner");
    banner.hidden = !isUnlocked();
    banner.textContent = isUnlocked() ? D.banner : "";

    var box = $("#dPassages");
    box.innerHTML = "";
    if (!isUnlocked()) {
      box.appendChild(el("p", "muted small",
        "目前是鎖上的。按上面的按鈕並輸入通關語，才會在【你的瀏覽器裡】解密顯示。"));
      return;
    }
    D.passages.forEach(function (p) {
      var full = null;
      (vaultData.dFull || []).forEach(function (x) { if (x.title === p.title) full = x; });
      var d = el("div", "cl-card d-card");
      d.appendChild(el("div", "cl-title", "D 級段落：" + p.title));
      d.appendChild(el("blockquote", "cl-orig d-on", full ? full.text : "（密文中無此項）"));
      d.appendChild(el("p", "cl-d", p.split));
      box.appendChild(d);
    });
  }



  /* ---------- 望診尊經 ---------- */
  /* ---------- 體質基線 ---------- */
  function renderConstitution() {
    var C = S.constitution;
    if (!C) return;
    $("#ctTitle").textContent = C.title;
    $("#ctLead").textContent = C.lead;
    $("#ctWhy").textContent = C.why;
    $("#ctKey").textContent = C.key;
    $("#ctStdTitle").textContent = C.standard.t;
    var sd = $("#ctStd"); sd.innerHTML = "";
    C.standard.items.forEach(function (x) { sd.appendChild(el("li", null, x)); });
    $("#ctGrades").textContent = C.grades.map(function (g) {
      return g.k + " " + g.name + "：" + g.d;
    }).join("　｜　");

    var box = $("#ctTypes"); box.innerHTML = "";
    C.types.forEach(function (t) {
      var card = el("div", "cl-card");
      var head = el("div", "cl-head");
      head.appendChild(el("span", "cl-el", t.name.slice(0, 2)));
      var hh = el("div");
      hh.appendChild(el("div", "cl-title", t.name));
      hh.appendChild(el("div", "muted small", "可信度分級：" + t.grade));
      head.appendChild(hh);
      card.appendChild(head);

      card.appendChild(el("p", "cl-purpose", t.overall));
      var chips = el("div", "chips");
      t.signs.forEach(function (x) { chips.appendChild(el("span", "chip static", x)); });
      card.appendChild(chips);

      if (t.tendency) {
        var p = el("p", "cl-trait");
        p.appendChild(el("strong", null, "傾向（B 級）："));
        p.appendChild(document.createTextNode(t.tendency));
        card.appendChild(p);
      }
      box.appendChild(card);
    });

    var ub = $("#ctUse"); ub.innerHTML = "";
    C.use.forEach(function (x) {
      var d = el("div", "act");
      d.appendChild(el("div", "act-t", "· " + x.t));
      d.appendChild(el("div", "act-d", x.d));
      ub.appendChild(d);
    });
  }

  function renderWangzhen() {
    var Z = S.zunjing, W = S.wangzhen;
    $("#promptWangzhen").textContent = S.prompts.wangzhen;

    /* ----- 書 ----- */
    var bp = $("#wzBookPanel");
    bp.innerHTML = "";
    var h = el("h2", null, "《" + Z.book.title + "》");
    bp.appendChild(h);
    bp.appendChild(el("p", "wz-q-text", Z.book.author + "　·　" + Z.book.place + "　·　" + Z.book.year));
    bp.appendChild(el("p", "muted small", Z.book.volumes + "　" + Z.book.chapterCount + " 篇"));
    var tq = el("div", "lt-quote");
    tq.appendChild(el("div", "lt-q-text", Z.book.thesis));
    tq.appendChild(el("div", "muted small", "—— " + Z.book.thesisSrc));
    bp.appendChild(tq);
    bp.appendChild(el("p", "cl-purpose", Z.book.why));
    bp.appendChild(el("p", "cl-d", "更正：" + Z.book.correction));
    bp.appendChild(el("blockquote", "cl-orig", Z.book.closing));

    /* ----- 分頁 ----- */
    var tabs = $("#wzTabs");
    tabs.innerHTML = "";
    WZ_TABS.forEach(function (t, i) {
      var b = el("button", "tab" + (i === wzTab ? " on" : ""), t.t);
      b.type = "button";
      b.addEventListener("click", function () {
        wzTab = i;
        $$(".tab", tabs).forEach(function (x) { x.classList.remove("on"); });
        b.classList.add("on");
        renderWzTab();
      });
      tabs.appendChild(b);
    });
    renderWzTab();

    /* ----- 舌診尊經 ----- */
    var tn = W.tongueNote;
    $("#wzTongueTitle").textContent = tn.title;
    $("#wzTongueBody").textContent = tn.body;
    $("#wzTongueHistory").textContent = tn.history;
    $("#wzTongueImplication").textContent = tn.implication;
    $("#wzTongueAction").textContent = tn.action;

    /* ----- D 閘門 ----- */
    var btn = $("#btnDWZ");
    btn.textContent = isUnlocked() ? "🔓 已解鎖（按此鎖上）" : "🔒 解鎖 D 級原文";
    btn.className = isUnlocked() ? "btn danger" : "btn";
    var bn = $("#dWZBanner");
    bn.hidden = !isUnlocked();
    bn.textContent = isUnlocked() ? S.classics.dFull.banner : "";

    /* ----- 教學用法 ----- */
    var hb = $("#wzHowTo");
    hb.innerHTML = "";
    Z.howToUse.forEach(function (x) {
      var d = el("div", "act");
      d.appendChild(el("div", "act-t", "· " + x.t));
      d.appendChild(el("div", "act-d", x.d));
      hb.appendChild(d);
    });
  }

  var CLASSICS_TABS = [
    { t: "陰陽二十五人（25）", f: function (b) { renderTwentyFive(b); } },
    { t: "五態之人（5）", f: function (b) { renderFiveStates(b); } },
    { t: "肥瘦三型（觀察）", f: function (b) { renderFatTypes(b); } },
    { t: "血氣望診（觀察）", f: function (b) { renderBloodQi(b); } },
    { t: "五音配屬（理論）", f: function (b) { renderFiveTones(b); } }
  ];

  function renderClassicsTab() {
    var box = $("#classicsBody");
    box.innerHTML = "";
    CLASSICS_TABS[classicsTab].f(box);
  }

  /* ---------- 肥瘦三型（純觀察） ---------- */
  function renderFatTypes(box) {
    var F = S.classics.fatTypes;
    box.appendChild(el("p", "muted small", F.src));
    box.appendChild(el("p", "cl-purpose", S.prompts.fat));
    box.appendChild(el("p", "cl-d", F.variantNote));

    F.kinds.forEach(function (k) {
      var card = el("div", "cl-card");
      card.appendChild(el("div", "cl-title", k.name));
      card.appendChild(el("blockquote", "cl-orig", k.mark));
      var rows = [["形", k.shape], ["肉與理", k.muscle], ["氣血", k.qi]];
      var t = el("table", "sheet-table");
      rows.forEach(function (r) {
        var tr = el("tr");
        tr.appendChild(el("td", "sh-k", r[0]));
        tr.appendChild(el("td", null, r[1]));
        t.appendChild(tr);
      });
      card.appendChild(t);
      box.appendChild(card);
    });

    var ow = el("div", "cl-sec");
    ow.appendChild(el("div", "cl-lbl grade-a", "A 可觀察（四項）"));
    var chips = el("div", "chips");
    F.watch.forEach(function (w) { chips.appendChild(el("span", "chip static", w)); });
    ow.appendChild(chips);
    box.appendChild(ow);

    var p = el("div", "cl-purpose");
    p.appendChild(el("div", null, F.purpose));
    p.appendChild(el("div", "muted small", F.purposeNote));
    box.appendChild(p);
    box.appendChild(el("p", "muted small", F.agesSrc));
  }

  /* ---------- 五音配屬（C 級） ---------- */
  function renderFiveTones(box) {
    var T = S.classics.fiveTones;
    box.appendChild(el("p", "muted small", T.src));
    box.appendChild(el("p", "cl-purpose", T.note));

    box.appendChild(el("h5", null, "五音 × 五行 × 五臟 × 五色 × 五味 × 五時"));
    var t = el("table", "sheet-table");
    var hr = el("tr");
    ["音", "臟", "色", "味", "時", "穀", "畜", "果", "經"].forEach(function (h) {
      hr.appendChild(el("th", null, h));
    });
    t.appendChild(hr);
    T.table.forEach(function (r) {
      var tr = el("tr");
      [r.tone, r.organ, r.color, r.taste, r.season, r.grain, r.animal, r.fruit, r.meridian]
        .forEach(function (v, i) { tr.appendChild(el("td", i === 0 ? "sh-k" : null, v)); });
      t.appendChild(tr);
    });
    box.appendChild(t);

    box.appendChild(el("h5", null, "二十五型的五音歸組"));
    box.appendChild(el("p", "muted small", T.groupNote));
    var g = el("table", "sheet-table");
    var gh = el("tr");
    ["音", "五型"].forEach(function (h) { gh.appendChild(el("th", null, h)); });
    g.appendChild(gh);
    T.groups.forEach(function (gr) {
      var tr = el("tr");
      tr.appendChild(el("td", "sh-k", gr.tone));
      tr.appendChild(el("td", null, gr.types.join("、" + "　")));
      g.appendChild(tr);
    });
    box.appendChild(g);
    box.appendChild(el("p", "cl-d", T.variantNote));

    box.appendChild(el("h5", null, "藏在理論篇裡的 A 級觀察"));
    box.appendChild(el("blockquote", "cl-orig", T.bloodHair.text));
    box.appendChild(el("p", "cl-purpose", T.bloodHair.note));

    box.appendChild(el("h5", null, "六經血氣常數"));
    box.appendChild(el("blockquote", "cl-orig", T.sixMeridians.text));
    box.appendChild(el("p", "muted small", T.sixMeridians.note));

    box.appendChild(el("p", "lt-duty", T.caution));
  }

  function renderTwentyFive(box) {
    var T = S.classics.twentyFive;
    box.appendChild(el("p", "muted small", T.src));
    box.appendChild(el("p", "muted small", T.shapeNote + "　" + T.textNote));

    T.elements.forEach(function (e) {
      var card = el("div", "cl-card");
      var head = el("div", "cl-head");
      head.appendChild(el("span", "cl-el", e.k));
      var hh = el("div");
      hh.appendChild(el("div", "cl-title", e.k + "形之人（比於" + e.main + "）"));
      hh.appendChild(el("div", "muted small", "色：" + e.color + "　音：" + e.tone + "　經：" + e.organ));
      head.appendChild(hh);
      card.appendChild(head);

      // 解鎖後改用 vault 裡的完整原文；未解鎖用安全版（已標「已剔除」）
      var fullText = (isUnlocked() && vaultData.forms) ? vaultData.forms[e.k] : null;
      card.appendChild(el("blockquote", "cl-orig" + (fullText ? " d-on" : ""),
        fullText || e.original));

      var ow = el("div", "cl-sec");
      ow.appendChild(el("div", "cl-lbl grade-a", "A 可觀察"));
      var chips = el("div", "chips");
      e.obs.forEach(function (o) { chips.appendChild(el("span", "chip static", o)); });
      ow.appendChild(chips);
      card.appendChild(ow);

      var tw = el("div", "cl-sec");
      tw.appendChild(el("div", "cl-lbl grade-b", "B 性格歸納（古人的說法・低信度・不給孩子）"));
      tw.appendChild(el("p", "cl-trait", e.trait.join("、")));
      card.appendChild(tw);

      if (e.dExcluded) card.appendChild(el("p", "cl-d", "D 已剔除：" + e.dExcluded));

      var vw = el("details", "cl-vars");
      vw.appendChild(el("summary", null, "四個變體：" + e.variants.map(function (v) { return v.name; }).join("、")));
      var vt = el("table", "sheet-table");
      var hr = el("tr");
      ["變體", "比於", "其狀"].forEach(function (t) { hr.appendChild(el("th", null, t)); });
      vt.appendChild(hr);
      e.variants.forEach(function (v) {
        var tr = el("tr");
        tr.appendChild(el("td", "sh-k", v.name + (v.note ? "（" + v.note + "）" : "")));
        tr.appendChild(el("td", null, v.at));
        tr.appendChild(el("td", null, v.sign));
        vt.appendChild(tr);
      });
      vw.appendChild(vt);
      card.appendChild(vw);
      box.appendChild(card);
    });
  }

  function renderFiveStates(box) {
    var F = S.classics.fiveStates;
    box.appendChild(el("p", "muted small", F.src));
    box.appendChild(el("blockquote", "cl-orig", F.intro));
    box.appendChild(el("p", "cl-purpose", F.purpose));
    F.states.forEach(function (st) {
      var card = el("div", "cl-card");
      card.appendChild(el("div", "cl-title", st.name));
      var tw = el("div", "cl-sec");
      tw.appendChild(el("div", "cl-lbl grade-b", "B 心性（古人的說法・低信度）"));
      tw.appendChild(el("blockquote", "cl-orig", st.trait));
      card.appendChild(tw);
      var sw = el("div", "cl-sec");
      sw.appendChild(el("div", "cl-lbl grade-a", "A 其狀（可觀察）"));
      sw.appendChild(el("blockquote", "cl-orig", st.shape));
      card.appendChild(sw);
      box.appendChild(card);
    });
  }

  function renderBloodQi(box) {
    var B = S.classics.bloodQi;
    box.appendChild(el("p", "muted small", B.src));
    box.appendChild(el("p", "cl-purpose", B.note));
    var t = el("table", "sheet-table");
    var hr = el("tr");
    ["部位", "血氣盛", "不足時所見"].forEach(function (x) { hr.appendChild(el("th", null, x)); });
    t.appendChild(hr);
    B.rows.forEach(function (r) {
      var tr = el("tr");
      tr.appendChild(el("td", "sh-k", r.at));
      tr.appendChild(el("td", "bq-full", r.full));
      tr.appendChild(el("td", "bq-less", r.less));
      t.appendChild(tr);
    });
    box.appendChild(t);
    box.appendChild(el("p", "cl-summary", B.summary));
  }

  /* ---------- 列印版空白觀察表 ---------- */
  function renderPrintSheet() {
    $("#promptPrint").textContent = "按 ⌘P（Windows：Ctrl+P）列印。建議一張 A4。長期追蹤走好幾年時，紙本比 App 可靠。";
    var box = $("#printSheet");
    box.innerHTML = "";

    var head = el("div", "sheet-head");
    head.appendChild(el("h2", null, "識人觀察表"));
    var meta = el("div", "sheet-meta");
    "對象代號：____________　觀察日期：____________　第 ______ 次".split("　").forEach(function (t) {
      meta.appendChild(el("span", null, t));
    });
    head.appendChild(meta);
    box.appendChild(head);

    function secTitle(t, note) {
      var h = el("h3", "sheet-sec");
      h.appendChild(document.createTextNode(t));
      if (note) h.appendChild(el("span", "muted small", "　" + note));
      return h;
    }

    // 一、九徵
    box.appendChild(secTitle("一、只看見的（九徵）", "只寫眼睛看得到、耳朵聽得到的，不要寫結論"));
    var t1 = el("table", "sheet-table");
    S.obsChannels.forEach(function (c) {
      var tr = el("tr");
      tr.appendChild(el("td", "sh-k", c.name + "（" + c.dim + "）"));
      tr.appendChild(el("td", "sh-h", c.hint));
      tr.appendChild(el("td", "sh-line", ""));
      t1.appendChild(tr);
    });
    box.appendChild(t1);

    // 二、狀態
    box.appendChild(secTitle("二、當下狀態", "短期可對帳"));
    var t2 = el("table", "sheet-table");
    S.obsState.forEach(function (c) {
      var tr = el("tr");
      tr.appendChild(el("td", "sh-k", c.name));
      tr.appendChild(el("td", "sh-h", c.hint));
      tr.appendChild(el("td", "sh-line", ""));
      t2.appendChild(tr);
    });
    box.appendChild(t2);

    // 二之一、八觀自問
    box.appendChild(secTitle("二之一、八觀自問", "打勾：這一輪你問了自己哪幾觀"));
    var t2g = el("table", "sheet-table");
    S.obsBaguan.forEach(function(g){
      var tr = el("tr");
      tr.appendChild(el("td", "sh-cb", "☐"));
      tr.appendChild(el("td", "sh-k", g.name));
      tr.appendChild(el("td", "sh-h", g.q));
      t2g.appendChild(tr);
    });
    box.appendChild(t2g);

    // 二之二、形體
    box.appendChild(secTitle("二之二、形體（古法觀察）", "只寫形，不寫人：面色、頭面、肩背、手足、步態"));
    var t2b = el("table", "sheet-table");
    for (var bi = 0; bi < 2; bi++) {
      var btr = el("tr");
      btr.appendChild(el("td", "sh-line", ""));
      t2b.appendChild(btr);
    }
    box.appendChild(t2b);

    // 二之三、面部色診
    box.appendChild(secTitle("二之三、面部色診（尊經）", "看浮沉、澤夭，不只辨顏色"));
    var t2c = el("table", "sheet-table");
    S.obsColor.forEach(function (c) {
      var ctr = el("tr");
      ctr.appendChild(el("td", "sh-k", c.name));
      ctr.appendChild(el("td", "sh-h", c.hint));
      ctr.appendChild(el("td", "sh-line", ""));
      t2c.appendChild(ctr);
    });
    box.appendChild(t2c);

    // 二之四、肥瘦三型
    box.appendChild(secTitle("二之四、肥瘦三型（衛氣失常）", "膕肉堅否・皮緩否・理麤細・身形"));
    var t2f = el("table", "sheet-table");
    S.obsFat.forEach(function (c) {
      var ftr = el("tr");
      ftr.appendChild(el("td", "sh-k", c.name));
      ftr.appendChild(el("td", "sh-h", c.hint));
      ftr.appendChild(el("td", "sh-line", ""));
      t2f.appendChild(ftr);
    });
    box.appendChild(t2f);

    // 二之五、姿態
    box.appendChild(secTitle("二之五、姿態（望診遵經卷下）", "八法圈一端；具體動作打勾"));
    var t2p = el("table", "sheet-table");
    S.obsPosture8.forEach(function (p) {
      var tr = el("tr");
      tr.appendChild(el("td", "sh-k", p.name));
      tr.appendChild(el("td", "sh-h", "動／強／仰／伸 為陽；靜／弱／俯／屈 為陰"));
      var td = el("td", "sh-circles");
      td.appendChild(el("span", "circ", "○ " + p.a + "　"));
      td.appendChild(el("span", "circ", "○ " + p.b));
      tr.appendChild(td);
      t2p.appendChild(tr);
    });
    box.appendChild(t2p);
    var t2pa = el("table", "sheet-table");
    ["坐", "臥", "身容", "行"].forEach(function (cat) {
      var tr = el("tr");
      tr.appendChild(el("td", "sh-k", cat));
      var td = el("td", "sh-line");
      S.obsPostureActs.filter(function (x) { return x.cat === cat; }).forEach(function (x) {
        td.appendChild(el("span", "pact", "☐ " + x.name + "　"));
      });
      tr.appendChild(td);
      t2pa.appendChild(tr);
    });
    box.appendChild(t2pa);

    // 三、五個數字
    box.appendChild(secTitle("三、五個數字", "圈一個：1 2 3 4 5"));
    var t3 = el("table", "sheet-table");
    S.ratings.forEach(function (r) {
      var tr = el("tr");
      tr.appendChild(el("td", "sh-k", r.name));
      tr.appendChild(el("td", "sh-h", r.lo + " ↔ " + r.hi));
      var td = el("td", "sh-circles");
      "①②③④⑤".split("").forEach(function (c) { td.appendChild(el("span", "circ", c)); });
      tr.appendChild(td);
      t3.appendChild(tr);
    });
    box.appendChild(t3);

    // 四、推測
    box.appendChild(secTitle("四、我的推測", "每條都要寫層級、信心、對帳日。L3 請拉到一年以上"));
    var t4 = el("table", "sheet-table guess-table");
    var hr = el("tr");
    ["推測的內容", "層級", "信心", "對帳日"].forEach(function (h) {
      hr.appendChild(el("th", null, h));
    });
    t4.appendChild(hr);
    for (var i = 0; i < 4; i++) {
      var tr = el("tr");
      tr.appendChild(el("td", "sh-line", ""));
      tr.appendChild(el("td", "sh-tiny", "L2 / L3"));
      tr.appendChild(el("td", "sh-tiny", "%"));
      tr.appendChild(el("td", "sh-small", ""));
      t4.appendChild(tr);
    }
    box.appendChild(t4);

    // 五、偏誤自檢
    box.appendChild(secTitle("五、偏誤自檢", "這次我可能犯了哪些"));
    var t5 = el("table", "sheet-table");
    S.biasCheck.forEach(function (b) {
      var tr = el("tr");
      tr.appendChild(el("td", "sh-cb", "☐"));
      tr.appendChild(el("td", "sh-k", b.name));
      tr.appendChild(el("td", "sh-h", b.hint));
      t5.appendChild(tr);
    });
    box.appendChild(t5);

    // 六、七年之約
    var lt = el("div", "sheet-foot");
    lt.appendChild(el("div", "lt-q-text", S.longTerm.quote.text));
    lt.appendChild(el("div", "muted small", "—— " + S.longTerm.quote.src));
    lt.appendChild(el("div", "lt-q-plain", S.longTerm.why));
    box.appendChild(lt);
  }

  /* ---------- 對帳清單 ---------- */
  function renderGuesses(ss) {
    var box = $("#tdGuesses");
    box.innerHTML = "";
    var all = collectGuesses(ss);
    var today = todayStr();

    var pending = all.filter(function (x) { return !x.g.result; })
                     .sort(function (a, b) { return a.g.due < b.g.due ? -1 : 1; });
    var done = all.filter(function (x) { return x.g.result; });

    if (!all.length) {
      box.appendChild(el("p", "empty", "還沒有推測。"));
      return;
    }

    if (pending.length) {
      box.appendChild(el("h4", "sec", "等你回來看（" + pending.length + "）"));
      pending.forEach(function (x) {
        var due = x.g.due <= today;
        var row = el("div", "rec");
        row.appendChild(el("div", "rec-date", x.g.due));
        var body = el("div", "rec-body");
        body.appendChild(el("span", "tag " + (due ? "due" : "") + (x.g.level === "L3" ? " l3" : ""),
          (due ? "該對帳了" : "未到期") + "・" + (x.g.level || "L2")));
        body.appendChild(document.createTextNode(x.g.text));
        body.appendChild(el("span", "k", "信心 " + x.g.conf + "%・觀察日 " + x.date));
        row.appendChild(body);

        var acts = el("div", "rec-acts");
        [["hit", "對", "ok"], ["miss", "不對", "no"], ["unknown", "不知道", ""]].forEach(function (p) {
          var b = el("button", "mini " + p[2], p[1]);
          b.type = "button";
          b.addEventListener("click", function () {
            x.g.result = p[0];
            x.g.judgedAt = todayStr();
            saveState(); renderSubjectDetail();
          });
          acts.appendChild(b);
        });
        row.appendChild(acts);
        box.appendChild(row);
      });
    }

    if (done.length) {
      box.appendChild(el("h4", "sec", "已對帳（" + done.length + "）"));
      done.slice().reverse().forEach(function (x) {
        var row = el("div", "rec");
        row.appendChild(el("div", "rec-date", x.g.judgedAt || x.g.due));
        var body = el("div", "rec-body");
        var map = { hit: ["ok", "猜對了"], miss: ["no", "猜錯了"], unknown: ["", "不知道"] };
        var m = map[x.g.result] || ["", x.g.result];
        body.appendChild(el("span", "tag " + m[0], m[1]));
        body.appendChild(document.createTextNode(x.g.text));
        body.appendChild(el("span", "k", "信心 " + x.g.conf + "%・" + (x.g.level || "L2")));
        row.appendChild(body);

        var acts = el("div", "rec-acts");
        var undo = el("button", "mini", "改回未對帳");
        undo.type = "button";
        undo.addEventListener("click", function () {
          x.g.result = null; delete x.g.judgedAt;
          saveState(); renderSubjectDetail();
        });
        acts.appendChild(undo);
        row.appendChild(acts);
        box.appendChild(row);
      });
    }
  }

  /* ---------- 歷史時間軸 ---------- */
  function renderHistory(ss) {
    var box = $("#tdHistory");
    box.innerHTML = "";
    if (!ss.length) { box.appendChild(el("p", "empty", S.track.emptySessions)); return; }

    ss.slice().reverse().forEach(function (s) {
      var d = el("details", "hist");
      var sum = el("summary");
      var filled = S.obsChannels.filter(function (c) { return s.ch && s.ch[c.k]; }).length;
      sum.textContent = s.date + "　（九徵寫了 " + filled + "/9・推測 " + (s.guesses || []).length + " 條）";
      d.appendChild(sum);

      var inner = el("div", "hist-body");

      if (s.note) inner.appendChild(el("p", "hist-note", "備註：" + s.note));

      var chWrap = el("div", "hist-sec");
      chWrap.appendChild(el("h5", null, "只看見的（九徵）"));
      var anyCh = false;
      S.obsChannels.forEach(function (c) {
        var v = s.ch && s.ch[c.k];
        if (!v) return;
        anyCh = true;
        var r = el("div", "hist-line");
        r.appendChild(el("span", "hist-k", c.name + "（" + c.dim + "）"));
        r.appendChild(el("span", null, v));
        chWrap.appendChild(r);
      });
      if (!anyCh) chWrap.appendChild(el("p", "muted small", "（未填）"));
      inner.appendChild(chWrap);

      var stWrap = el("div", "hist-sec");
      stWrap.appendChild(el("h5", null, "當下狀態"));
      var anySt = false;
      S.obsState.forEach(function (c) {
        var v = s.st && s.st[c.k];
        if (!v) return;
        anySt = true;
        var r = el("div", "hist-line");
        r.appendChild(el("span", "hist-k", c.name));
        r.appendChild(el("span", null, v));
        stWrap.appendChild(r);
      });
      if (!anySt) stWrap.appendChild(el("p", "muted small", "（未填）"));
      inner.appendChild(stWrap);

      if (s.color && Object.keys(s.color).length) {
        var cwWrap = el("div", "hist-sec");
        cwWrap.appendChild(el("h5", null, "面部色診（尊經）"));
        S.obsColor.forEach(function (c) {
          if (!s.color[c.k]) return;
          var r = el("div", "hist-line");
          r.appendChild(el("span", "hist-k", c.name));
          r.appendChild(el("span", null, s.color[c.k]));
          cwWrap.appendChild(r);
        });
        inner.appendChild(cwWrap);
      }

      if ((s.posture8 && Object.keys(s.posture8).length) || (s.postureActs && s.postureActs.length)) {
        var pwW = el("div", "hist-sec");
        pwW.appendChild(el("h5", null, "姿態（尊經卷下）"));
        if (s.posture8 && Object.keys(s.posture8).length) {
          var line = S.obsPosture8.map(function (p) {
            return p.name + " " + (s.posture8[p.k] || "—");
          }).join("　");
          pwW.appendChild(el("p", null, line));
        }
        if (s.postureActs && s.postureActs.length) {
          pwW.appendChild(el("p", null, s.postureActs.map(function (k) {
            var it = null;
            S.obsPostureActs.forEach(function (x) { if (x.k === k) it = x; });
            return it ? (it.cat + "：" + it.name) : k;
          }).join("、")));
        }
        inner.appendChild(pwW);
      }

      if (s.fat && Object.keys(s.fat).length) {
        var ftWrap = el("div", "hist-sec");
        ftWrap.appendChild(el("h5", null, "肥瘦三型（觀察）"));
        S.obsFat.forEach(function (c) {
          if (!s.fat[c.k]) return;
          var r = el("div", "hist-line");
          r.appendChild(el("span", "hist-k", c.name));
          r.appendChild(el("span", null, s.fat[c.k]));
          ftWrap.appendChild(r);
        });
        inner.appendChild(ftWrap);
      }

      if (s.baguan && s.baguan.length) {
        var bgW = el("div", "hist-sec");
        bgW.appendChild(el("h5", null, "八觀自問（問了 " + s.baguan.length + "/8）"));
        bgW.appendChild(el("p", null, s.baguan.map(function(k){
          var it=null; S.obsBaguan.forEach(function(x){ if(x.k===k) it=x; });
          return it?it.name.replace(/^[一二三四五六七八]、/,""):k;
        }).join("、")));
        if (s.baguan.length < 8) bgW.appendChild(el("p","muted small",
          "未問：" + S.obsBaguan.filter(function(x){ return s.baguan.indexOf(x.k)<0; })
            .map(function(x){ return x.name.replace(/^[一二三四五六七八]、/,""); }).join("、")));
        inner.appendChild(bgW);
      }

      if (s.form) {
        var fmWrap = el("div", "hist-sec");
        fmWrap.appendChild(el("h5", null, "形體（古法觀察）"));
        fmWrap.appendChild(el("p", null, s.form));
        inner.appendChild(fmWrap);
      }

      var rtWrap = el("div", "hist-sec");
      rtWrap.appendChild(el("h5", null, "五個數字"));
      var rtLine = S.ratings.map(function (r) {
        return r.name + " " + ((s.rt && s.rt[r.k]) || "—");
      }).join("　");
      rtWrap.appendChild(el("p", null, rtLine));
      inner.appendChild(rtWrap);

      var gWrap = el("div", "hist-sec");
      gWrap.appendChild(el("h5", null, "推測"));
      if ((s.guesses || []).length) {
        s.guesses.forEach(function (g) {
          var map = { hit: "✓ 猜對了", miss: "✗ 猜錯了", unknown: "？不知道" };
          var r = el("div", "hist-line");
          r.appendChild(el("span", "hist-k", (g.level || "L2") + "・信心 " + g.conf + "%"));
          r.appendChild(el("span", null, g.text +
            (g.result ? "　→ " + (map[g.result] || g.result) : "　→ 待對帳（" + g.due + "）")));
          gWrap.appendChild(r);
        });
      } else {
        gWrap.appendChild(el("p", "muted small", "（未填）"));
      }
      inner.appendChild(gWrap);

      if ((s.bias || []).length) {
        var bWrap = el("div", "hist-sec");
        bWrap.appendChild(el("h5", null, "偏誤自檢"));
        bWrap.appendChild(el("p", null, s.bias.map(function (i) {
          return S.biasCheck[i] ? S.biasCheck[i].name : i;
        }).join("、")));
        inner.appendChild(bWrap);
      }

      var acts = el("div", "rec-acts");
      var del = el("button", "mini no", "刪除這次觀察");
      del.type = "button";
      del.addEventListener("click", function () {
        if (!confirm("刪除 " + s.date + " 這次觀察？")) return;
        state.sessions = state.sessions.filter(function (x) { return x.id !== s.id; });
        saveState(); renderSubjectDetail();
      });
      acts.appendChild(del);
      inner.appendChild(acts);

      d.appendChild(inner);
      box.appendChild(d);
    });
  }

  /* ---------- 閉環提示：上一次你寫了什麼 ---------- */
  function renderLoopReminder(ss) {
    var box = $("#loopReminder");
    box.innerHTML = "";
    if (!ss.length) {
      box.appendChild(el("p", "muted small", S.track.loopNone));
      return;
    }
    var last = ss[ss.length - 1];
    box.appendChild(el("div", "loop-title", "🔄 " + S.track.loopTitle + "（" + last.date + "）"));

    var lines = [];
    S.obsChannels.forEach(function (c) {
      var v = last.ch && last.ch[c.k];
      if (v) lines.push(c.name + "：" + v);
    });
    if (lines.length) box.appendChild(el("p", "loop-line", lines.join("　")));

    if (last.rt) {
      box.appendChild(el("p", "loop-line", S.ratings.map(function (r) {
        return r.name + " " + (last.rt[r.k] || "—");
      }).join("　")));
    }

    var gs = (last.guesses || []).filter(function (g) { return g.text; });
    if (gs.length) {
      var ul = el("ul", "tight");
      gs.forEach(function (g) {
        var map = { hit: "✓ 猜對了", miss: "✗ 猜錯了", unknown: "？不知道" };
        ul.appendChild(el("li", null, g.text + "（信心 " + g.conf + "%）→ " +
          (g.result ? (map[g.result] || g.result) : "還沒到對帳日 " + g.due)));
      });
      box.appendChild(ul);
    }
    box.appendChild(el("p", "muted small",
      "先讀一遍上面這些，再往下填。對照著填，才會看見「他變了沒有、你看準了沒有」。"));
  }

  /* ---------- 觀察表單 ---------- */
  function field(labelText, hint) {
    var f = el("div", "field");
    var l = el("label", null, labelText);
    f.appendChild(l);
    if (hint) f.appendChild(el("div", "muted small", hint));
    return f;
  }

  function buildObsForm(session) {
    session = session || {};

    // 九徵
    var cw = $("#channelsWrap");
    cw.innerHTML = "";
    S.obsChannels.forEach(function (c) {
      var f = field(c.name + "（" + c.dim + "）", c.hint);
      var t = el("textarea");
      t.dataset.ch = c.k;
      t.placeholder = "只寫看見的／聽見的…";
      t.value = (session.ch && session.ch[c.k]) || "";
      f.appendChild(t);
      cw.appendChild(f);
    });

    // 狀態
    var sw = $("#stateWrap");
    sw.innerHTML = "";
    S.obsState.forEach(function (c) {
      var f = field(c.name, c.hint);
      var t = el("input");
      t.type = "text";
      t.dataset.st = c.k;
      t.maxLength = 80;
      t.value = (session.st && session.st[c.k]) || "";
      f.appendChild(t);
      sw.appendChild(f);
    });

    // 八觀自問（可多選）
    var bw=$("#baguanWrap");
    bw.innerHTML="";
    S.obsBaguan.forEach(function(g){
      var f=el("div","rating-row");
      f.appendChild(el("div","rating-name",g.name));
      var chips=el("div","chips");
      var b=el("button","chip",g.q);
      b.type="button";
      b.dataset.baguan=g.k;
      if(session.baguan && session.baguan.indexOf(g.k)>=0) b.classList.add("on");
      b.addEventListener("click",function(){ b.classList.toggle("on"); });
      chips.appendChild(b);
      f.appendChild(chips);
      bw.appendChild(f);
    });

    // 姿態：八法（單選兩端）
    var pw = $("#postureWrap");
    pw.innerHTML = "";
    S.obsPosture8.forEach(function (p) {
      var f = el("div", "rating-row");
      f.appendChild(el("div", "rating-name", p.name));
      var chips = el("div", "chips");
      [["a", p.a], ["b", p.b]].forEach(function (side) {
        var b = el("button", "chip", side[1]);
        b.type = "button";
        b.dataset.post8 = p.k;
        b.dataset.val = side[1];
        if (session.posture8 && session.posture8[p.k] === side[1]) b.classList.add("on");
        b.addEventListener("click", function () {
          $$(".chip", chips).forEach(function (x) { x.classList.toggle("on", x === b); });
        });
        chips.appendChild(b);
      });
      f.appendChild(chips);
      pw.appendChild(f);
    });

    // 姿態：具體動作（可多選）
    var paw = $("#postureActsWrap");
    paw.innerHTML = "";
    ["坐", "臥", "身容", "行"].forEach(function (cat) {
      var row = el("div", "post-act-row");
      row.appendChild(el("div", "rating-name", cat));
      var chips = el("div", "chips");
      S.obsPostureActs.filter(function (x) { return x.cat === cat; }).forEach(function (x) {
        var b = el("button", "chip", x.name);
        b.type = "button";
        b.dataset.postact = x.k;
        if (session.postureActs && session.postureActs.indexOf(x.k) >= 0) b.classList.add("on");
        b.addEventListener("click", function () { b.classList.toggle("on"); });
        chips.appendChild(b);
      });
      row.appendChild(chips);
      paw.appendChild(row);
    });

    // 面部色診（尊經骨架）
    var cw = $("#colorWrap");
    cw.innerHTML = "";
    S.obsColor.forEach(function (c) {
      var f = field(c.name, c.hint);
      var t = el("input");
      t.type = "text";
      t.dataset.color = c.k;
      t.maxLength = 60;
      t.placeholder = "色？潤澤或枯夭？";
      t.value = (session.color && session.color[c.k]) || "";
      f.appendChild(t);
      cw.appendChild(f);
    });

    // 肥瘦三型（純觀察）
    var fatw = $("#fatWrap");
    fatw.innerHTML = "";
    S.obsFat.forEach(function (c) {
      var f = field(c.name, c.hint);
      var t = el("input");
      t.type = "text";
      t.dataset.fat = c.k;
      t.maxLength = 60;
      t.placeholder = "只寫形…";
      t.value = (session.fat && session.fat[c.k]) || "";
      f.appendChild(t);
      fatw.appendChild(f);
    });

    // 形體（古法觀察，選填）
    var fw = $("#formWrap");
    fw.innerHTML = "";
    var ff = field("形體（面色、頭面、肩背、手足、步態…）", "只寫形，不寫人。可對照「古法體型」的 A 級觀察項。");
    var fta = el("textarea");
    fta.dataset.form = "form";
    fta.placeholder = "例：面色偏黃，圓面，多肉，走路穩，舉足浮";
    fta.value = session.form || "";
    ff.appendChild(fta);
    fw.appendChild(ff);

    // 五個數字
    var rw = $("#ratingsWrap");
    rw.innerHTML = "";
    S.ratings.forEach(function (r) {
      var f = el("div", "rating-row");
      f.appendChild(el("div", "rating-name", r.name));
      var chips = el("div", "chips");
      var cur = session.rt && session.rt[r.k] ? session.rt[r.k] : 3;
      [1, 2, 3, 4, 5].forEach(function (v) {
        var b = el("button", "chip" + (v === cur ? " on" : ""), String(v));
        b.type = "button";
        b.dataset.rating = r.k;
        b.dataset.val = String(v);
        b.addEventListener("click", function () {
          $$(".chip", chips).forEach(function (x) { x.classList.toggle("on", x === b); });
        });
        chips.appendChild(b);
      });
      f.appendChild(chips);
      f.appendChild(el("div", "muted small", r.lo + " ↔ " + r.hi));
      rw.appendChild(f);
    });

    // 推測
    var gw = $("#guessesWrap");
    gw.innerHTML = "";
    var gs = (session.guesses && session.guesses.length) ? session.guesses : [null];
    gs.forEach(function (g) { addGuessRow(g); });

    // 偏誤自檢
    var bw = $("#biasWrap");
    bw.innerHTML = "";
    S.biasCheck.forEach(function (b) {
      var wrap = el("label", "bias-item");
      var cb = el("input");
      cb.type = "checkbox";
      cb.value = String(b.k);
      cb.checked = !!(session.bias && session.bias.indexOf(b.k) >= 0);
      wrap.appendChild(cb);
      var span = el("span");
      span.appendChild(el("strong", null, b.name));
      span.appendChild(document.createTextNode("——" + b.hint));
      wrap.appendChild(span);
      bw.appendChild(wrap);
    });

    $("#sessionForm").date.value = session.date || todayStr();
    $("#sessionForm").note.value = session.note || "";
  }

  function addGuessRow(g) {
    var wrap = $("#guessesWrap");
    var row = el("div", "guess-row");
    row.dataset.id = (g && g.id) || uid("g");

    var f1 = el("div", "field");
    f1.appendChild(el("label", null, "推測的內容"));
    var t = el("input");
    t.type = "text"; t.dataset.role = "text"; t.maxLength = 80;
    t.placeholder = "例：他這週應該會很累（不要寫「他是懶的人」）";
    t.value = (g && g.text) || "";
    f1.appendChild(t);
    row.appendChild(f1);

    var grid = el("div", "guess-grid");

    var lv0 = (g && g.level) ? g.level : "L2";
    var f2 = el("div", "field");
    f2.appendChild(el("label", null, "層級"));
    var lv = el("select"); lv.dataset.role = "level";
    S.levels.forEach(function (p) {
      var o = el("option", null, p.name); o.value = p.k;
      if (lv0 === p.k) o.selected = true;
      lv.appendChild(o);
    });
    lv.value = lv0;                                // 顯式指定，不依賴瀏覽器推導
    f2.appendChild(lv);
    grid.appendChild(f2);

    var f3 = el("div", "field");
    f3.appendChild(el("label", null, "信心 %"));
    var cf = el("input"); cf.type = "number"; cf.min = "0"; cf.max = "100";
    cf.dataset.role = "conf";
    cf.value = String((g && typeof g.conf === "number") ? g.conf : 50);
    f3.appendChild(cf);
    grid.appendChild(f3);

    var f4 = el("div", "field");
    f4.appendChild(el("label", null, "對帳日"));
    var du = el("input"); du.type = "date"; du.dataset.role = "due";
    // 預設期限依層級而定：L2 以日計、L3 以年計（辨材須待七年期）
    du.value = (g && g.due) || addDays(todayStr(), levelDef(lv0).defaultDays);
    f4.appendChild(du);
    grid.appendChild(f4);

    row.appendChild(grid);

    // 期限快選
    var presets = el("div", "due-presets");
    presets.appendChild(el("span", "muted small", "對帳期限："));
    S.duePresets.forEach(function (p) {
      var b = el("button", "mini due-preset", p.label);
      b.type = "button";
      b.addEventListener("click", function () { du.value = addDays(todayStr(), p.days); });
      presets.appendChild(b);
    });
    row.appendChild(presets);

    // 層級說明；切換層級時自動調整期限
    var hint = el("p", "muted small", levelDef(lv0).hint);
    row.appendChild(hint);
    lv.addEventListener("change", function () {
      var d = levelDef(lv.value);
      du.value = addDays(todayStr(), d.defaultDays);
      hint.textContent = d.hint;
    });

    var rm = el("button", "mini no", "移除這條");
    rm.type = "button";
    rm.addEventListener("click", function () { row.remove(); });
    row.appendChild(rm);

    wrap.appendChild(row);
  }

  function submitSession(e) {
    e.preventDefault();
    var sub = subjectById(trackSel);
    if (!sub) return;
    var f = e.target;

    var ses = {
      id: uid("s"),
      subjectId: sub.id,
      date: f.date.value || todayStr(),
      ch: {}, st: {}, rt: {}, guesses: [], bias: [], note: (f.note.value || "").trim()
    };

    $$("[data-ch]", $("#channelsWrap")).forEach(function (t) {
      if (t.value.trim()) ses.ch[t.dataset.ch] = t.value.trim();
    });
    $$("[data-st]", $("#stateWrap")).forEach(function (t) {
      if (t.value.trim()) ses.st[t.dataset.st] = t.value.trim();
    });
    $$("[data-form]", $("#formWrap")).forEach(function (t) {
      if (t.value.trim()) ses.form = t.value.trim();
    });
    var bg=[];
    $$("[data-baguan]",$("#baguanWrap")).forEach(function(b){
      if((" "+b.className+" ").indexOf(" on ")>=0) bg.push(b.dataset.baguan);
    });
    if(bg.length) ses.baguan=bg;

    var p8 = {};
    S.obsPosture8.forEach(function (p) {
      var on = $('[data-post8="' + p.k + '"].chip.on', $("#postureWrap"));
      if (on) p8[p.k] = on.dataset.val;
    });
    if (Object.keys(p8).length) ses.posture8 = p8;
    var pa = [];
    $$("[data-postact]", $("#postureActsWrap")).forEach(function (b) {
      if ((" " + b.className + " ").indexOf(" on ") >= 0) pa.push(b.dataset.postact);
    });
    if (pa.length) ses.postureActs = pa;

    $$("[data-fat]", $("#fatWrap")).forEach(function (t) {
      if (t.value.trim()) {
        if (!ses.fat) ses.fat = {};
        ses.fat[t.dataset.fat] = t.value.trim();
      }
    });
    $$("[data-color]", $("#colorWrap")).forEach(function (t) {
      if (t.value.trim()) {
        if (!ses.color) ses.color = {};
        ses.color[t.dataset.color] = t.value.trim();
      }
    });
    S.ratings.forEach(function (r) {
      var on = $('[data-rating="' + r.k + '"].chip.on', $("#ratingsWrap"));
      ses.rt[r.k] = on ? parseInt(on.dataset.val, 10) : 3;
    });
    $$(".guess-row", $("#guessesWrap")).forEach(function (row) {
      var text = $('[data-role="text"]', row).value.trim();
      if (!text) return;
      var level = $('[data-role="level"]', row).value;
      var conf = parseInt($('[data-role="conf"]', row).value, 10);
      if (isNaN(conf)) conf = 50;
      conf = Math.max(0, Math.min(100, conf));
      var due = $('[data-role="due"]', row).value || addDays(todayStr(), 7);
      ses.guesses.push({ id: row.dataset.id, text: text, level: level, conf: conf, due: due, result: null });
    });
    $$("#biasWrap input[type=checkbox]").forEach(function (cb) {
      if (cb.checked) ses.bias.push(parseInt(cb.value, 10));
    });

    state.sessions.push(ses);
    saveState();
    renderSubjectDetail();
    renderSubjectList();
    $("#sessionPanel").hidden = true;
    $("#btnNewSession").hidden = false;
    alert("存下了。到 " + (ses.guesses.length ? "對帳日" : "下次觀察") + "記得回來看。");
  }

  function openSessionForm() {
    var ss = sessionsOf(trackSel);
    renderLoopReminder(ss);
    buildObsForm(null);
    $("#sessionPanel").hidden = false;
    $("#btnNewSession").hidden = true;
    $("#sessionPanel").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function submitSubject(e) {
    e.preventDefault();
    var f = e.target;
    var code = f.code.value.trim();
    if (!code) return;
    state.subjects.push({
      id: uid("u"),
      code: code,
      type: pickType || S.subjectTypes[0].k,
      note: (f.note.value || "").trim(),
      createdAt: todayStr()
    });
    saveState();
    f.code.value = ""; f.note.value = "";
    renderTrack();
    alert("已新增觀察對象「" + code + "」。");
  }

  /* ============================================================
     ⑧ 給教學者
     ============================================================ */
  function renderTeacher() {
    var rl = $("#redlinesBox");
    rl.innerHTML = "";
    S.redlines.forEach(function (r, i) {
      var d = el("div", "rl");
      d.appendChild(el("div", "rl-n", String(i + 1)));
      var t = el("div");
      t.appendChild(el("div", "rl-t", r.t));
      t.appendChild(el("div", "rl-d", r.d));
      d.appendChild(t);
      rl.appendChild(d);
    });

    var tn = $("#teacherNotesBox");
    tn.innerHTML = "";
    S.teacherNotes.forEach(function (r) {
      var d = el("div", "rl");
      var t = el("div");
      t.appendChild(el("div", "rl-t", "· " + r.t));
      t.appendChild(el("div", "rl-d", r.d));
      d.appendChild(t);
      tn.appendChild(d);
    });

    var tabs = $("#ageTabs");
    tabs.innerHTML = "";
    S.ages.forEach(function (a, i) {
      var b = el("button", "tab" + (i === 0 ? " on" : ""), a.band);
      b.type = "button";
      b.addEventListener("click", function () {
        $$(".tab", tabs).forEach(function (x) { x.classList.remove("on"); });
        b.classList.add("on");
        renderAge(i);
      });
      tabs.appendChild(b);
    });
    renderAge(0);

    var ab = $("#activitiesBox");
    ab.innerHTML = "";
    S.activities.forEach(function (a) {
      var d = el("div", "act");
      var t = el("div", "act-t");
      t.appendChild(document.createTextNode(a.t));
      if (a.star) t.appendChild(el("span", "star", "最有價值"));
      d.appendChild(t);
      d.appendChild(el("div", "act-d", a.d));
      if (a.tool) {
        var link = el("a", "mini", "→ 打開這個練習");
        link.href = "#/" + a.tool;
        link.style.display = "inline-block";
        link.style.marginTop = "7px";
        link.style.textDecoration = "none";
        d.appendChild(link);
      }
      ab.appendChild(d);
    });

    var qb = $("#qimouBox");
    qb.innerHTML = "";
    S.qimou.forEach(function (q) {
      var d = el("div", "qm");
      d.appendChild(el("div", "qm-h", q.name));
      d.appendChild(el("div", "qm-p", q.plain));
      d.appendChild(el("p", "qm-story", "📖 " + q.story));
      d.appendChild(el("div", "qm-note", q.note));
      qb.appendChild(d);
    });

    renderModernBias();

    var quo = $("#quotesBox");
    quo.innerHTML = "";
    S.quotes.forEach(function (q) {
      var d = el("div", "qt");
      d.appendChild(el("div", "qt-t", q.text));
      d.appendChild(el("div", "qt-p", q.plain));
      d.appendChild(el("div", "qt-s", "—— " + q.src));
      quo.appendChild(d);
    });

    updateStorageInfo();
  }

  /* ---------- 第八繆（現代）：倖存者偏差 ---------- */
  function renderModernBias() {
    var mb = $("#modernBiasBox");
    if (!mb || !S.modernBiases) return;
    mb.innerHTML = "";

    S.modernBiases.forEach(function (b) {
      var d = el("div", "qm");
      d.appendChild(el("div", "qm-h", b.name));
      d.appendChild(el("div", "qm-p", b.plain));
      d.appendChild(el("p", "qm-story", "📖 " + b.story));
      d.appendChild(el("div", "qm-note", "偏誤自檢：" + b.hint));
      d.appendChild(el("p", "cl-purpose", b.why));

      /* 實物標本：只列書目事實，原文一律不引 */
      var bk = b.book;
      if (bk) {
        var box = el("div", "cl-card");
        box.appendChild(el("div", "cl-title", "實物標本：" + bk.t));
        box.appendChild(el("p", "muted small", bk.a + "　·　" + bk.pub));
        var chips = el("div", "chips");
        bk.vols.forEach(function (v) { chips.appendChild(el("span", "chip static", v)); });
        box.appendChild(chips);
        box.appendChild(el("p", "cl-purpose", bk.why));
        box.appendChild(el("p", "cl-trait", bk.note));
        d.appendChild(box);
      }
      mb.appendChild(d);

      /* 版權受限內容：與 D 級同一把鑰匙，但理由不同——那些是「不該看」，這些是「不能公開放」 */
      if (bk && bk.dVault) {
        mb.appendChild(vaultPanel(
          "加密區：書目、目錄與出版方文案（版權受限）",
          bk.dVault,
          "此書仍在版權期（至 2036-12-31）。書目、五卷目錄與出版方文案已加密藏起，預設不顯示——", 
          "🔒 解鎖加密區",
          "🔓 已解鎖（按此鎖上）"
        ));
      }
    });
  }

  /* 通用的加密區塊：解鎖鈕 ＋ 內容。
     與 D 級共用同一把鑰匙，但分開呈現——理由不同：
     D 級是「不該給孩子看見」，版權受限是「不能公開放在 repo 裡」。 */
  function vaultPanel(title, vaultKey, lockedHint, labelLocked, labelUnlocked) {
    var dp = el("div", "panel");
    dp.appendChild(el("h2", null, title));
    var row = el("div", "row-btns");
    var b = el("button", isUnlocked() ? "btn danger" : "btn",
      isUnlocked() ? (labelUnlocked || "🔓 已解鎖（按此鎖上）") : (labelLocked || "🔒 解鎖"));
    b.type = "button";
    b.addEventListener("click", unlockVault);
    row.appendChild(b);
    dp.appendChild(row);

    if (!isUnlocked()) {
      var hint = el("p", "muted small");
      hint.appendChild(document.createTextNode(lockedHint || ""));
      var a1 = el("a", null, "望診遵經 →「D 級原文（研究用）」");
      a1.href = "#/wangzhen";
      var a2 = el("a", null, "古法體型 →「原文完整性（研究用）」");
      a2.href = "#/classics";
      hint.appendChild(document.createTextNode("通關處："));
      hint.appendChild(a1);
      hint.appendChild(document.createTextNode("　·　"));
      hint.appendChild(a2);
      hint.appendChild(document.createTextNode("。"));
      dp.appendChild(hint);
    } else {
      var items = (vaultData || {})[vaultKey] || [];
      if (!items.length) {
        dp.appendChild(el("p", "muted small", "（這一區尚未寫入 vault。）"));
      }
      items.forEach(function (d) {
        dp.appendChild(el("blockquote", "cl-orig", d.text));
        dp.appendChild(el("p", "cl-d", d.why));
      });
    }
    return dp;
  }

  function renderAge(i) {
    var a = S.ages[i];
    var box = $("#ageBox");
    box.innerHTML = "";
    box.appendChild(el("div", "age-goal", "🎯 " + a.title + "——" + a.goal));

    var table = el("table", "lsn");
    var thead = el("thead");
    var tr = el("tr");
    [["課", "課"], ["做什麼", "做什麼"], ["作業", "作業"]].forEach(function (h, hi) {
      var th = el("th", null, h[1]);
      tr.appendChild(th);
    });
    thead.appendChild(tr);
    table.appendChild(thead);

    var tb = el("tbody");
    a.lessons.forEach(function (l, li) {
      var r = el("tr");
      var c1 = el("td", null, (li + 1) + ". " + l.name);
      c1.dataset.l = "課";
      var c2 = el("td", null, l.act); c2.dataset.l = "做什麼";
      var c3 = el("td", null, l.hw);  c3.dataset.l = "作業";
      r.appendChild(c1); r.appendChild(c2); r.appendChild(c3);
      tb.appendChild(r);
    });
    table.appendChild(tb);
    box.appendChild(table);
  }

  /* ---------------- 資料管理 ---------------- */
  function updateStorageInfo() {
    var n = state.tongue.length + state.ledger.length + state.subjects.length + state.sessions.length +
            Object.keys(state.scenarios).filter(function (k) { return state.scenarios[k]; }).length;
    var bytes = 0;
    try { bytes = (localStorage.getItem(KEY) || "").length; } catch (e) { bytes = 0; }
    $("#storageInfo").textContent =
      "目前裝置上有 " + n + " 筆記錄（約 " + (bytes / 1024).toFixed(1) + " KB）。";
  }

  function exportData() {
    var payload = { app: "shiren-station", version: S.meta.version, exportedAt: new Date().toISOString(), data: state };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "識人訓練站_備份_" + todayStr() + ".json";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function importData(file) {
    var fr = new FileReader();
    fr.onload = function () {
      try {
        var o = JSON.parse(fr.result);
        var d = o && o.data ? o.data : o;
        if (!d || typeof d !== "object") throw new Error("格式不對");
        if (!confirm("匯入會覆蓋目前這台裝置上的記錄。要繼續嗎？\n（建議先按「匯出備份」留一份）")) return;
        state.tongue = Array.isArray(d.tongue) ? d.tongue : [];
        state.ledger = Array.isArray(d.ledger) ? d.ledger : [];
        state.scenarios = (d.scenarios && typeof d.scenarios === "object") ? d.scenarios : {};
        state.subjects = Array.isArray(d.subjects) ? d.subjects : [];
        state.sessions = Array.isArray(d.sessions) ? d.sessions : [];
        state.drills = (d.drills && typeof d.drills === "object") ? d.drills : {};
        state.recite = (d.recite && typeof d.recite === "object") ? d.recite : {};
        saveState();
        trackSel = null;
        renderTeacher(); renderTongueList(); renderLedgerLists(); renderScenarios(); renderTrack();
        alert("匯入完成。");
      } catch (e) {
        alert("匯入失敗：這個檔案不是本站的備份檔。");
        console.warn(e);
      }
    };
    fr.readAsText(file);
  }

  function wipeData() {
    if (!confirm("這會清空這台裝置上所有記錄（舌頭日記、猜測、練習）。要繼續嗎？")) return;
    if (!confirm("真的確定嗎？清除後無法復原——建議先「匯出備份」。")) return;
    state = { tongue: [], ledger: [], scenarios: {}, subjects: [], sessions: [], drills: {}, recite: {} };
    try { localStorage.removeItem(KEY); } catch (e) {}
    trackSel = null;
    renderTeacher(); renderTongueList(); renderLedgerLists(); renderScenarios(); renderTrack();
    alert("已清空。");
  }

  /* ============================================================
     啟動
     ============================================================ */
  function init() {
    loadState();
    buildNav();

    renderHome();
    renderTeacher();
    renderTrack();

    // 只在使用者進入時才初始化該模組（避免每次開站都重設）
    var inited = {};
    function ensure(route) {
      if (inited[route]) return;
      inited[route] = true;
      if (route === "classify") renderClassify();
      if (route === "quiz") renderQuiz();
      if (route === "scenarios") renderScenarios();
      if (route === "interrater") renderInterrater();
      if (route === "tongue") renderTongue();
      if (route === "ledger") renderLedger();
      if (route === "track") renderTrack();
      if (route === "philosophy") renderPhilosophy();
      if (route === "lessons") renderLessons();
      if (route === "lesson") renderLesson();
      if (route === "recite") renderRecite();
      if (route === "method") renderMethod();
      if (route === "drills") renderDrills();
      if (route === "mastery") renderMastery();
      if (route === "progress") renderProgress();
      if (route === "provenance") renderProvenance();
      if (route === "constitution") renderConstitution();
      if (route === "wangzhen") renderWangzhen();
      if (route === "classics") renderClassics();
      if (route === "print") renderPrintSheet();
    }

    function route() {
      var r = currentRoute();
      ensure(r);
      showView(r);
      if (r === "teacher") updateStorageInfo();
    }

    window.addEventListener("hashchange", function () {
      var r = currentRoute();
      if ((r === "classify" || r === "quiz") && inited[r]) {
        // 重新進入練習頁時重置，讓「再練一次」之外也有乾淨的開始
        if (r === "classify") renderClassify(); else renderQuiz();
      }
      route();
    });

    // 事件綁定
    $("#navToggle").addEventListener("click", function () {
      var nav = $("#nav");
      var open = nav.classList.toggle("open");
      this.setAttribute("aria-expanded", open ? "true" : "false");
    });

    $("#subjectForm").addEventListener("submit", submitSubject);
    $("#btnNewSession").addEventListener("click", openSessionForm);
    $("#cancelSession").addEventListener("click", function () {
      $("#sessionPanel").hidden = true;
      $("#btnNewSession").hidden = false;
    });
    $("#addGuess").addEventListener("click", function () { addGuessRow(null); });
    $("#btnDFull").addEventListener("click", unlockVault);
    $("#btnDWZ").addEventListener("click", unlockVault);
    $("#rcOnlyTodo").addEventListener("change", function () {
      rcOnlyTodo = this.checked;
      renderRecite();
    });
    $("#rcReset").addEventListener("click", function () {
      if (!confirm("把全部 24 條的記誦狀態重設為「未背」？")) return;
      state.recite = {};
      saveState();
      renderRecite();
    });
    $("#lnPrev").addEventListener("click", function () { stepLesson(-1); });
    $("#lnNext").addEventListener("click", function () { stepLesson(1); });
    $("#btnPrint").addEventListener("click", function () { window.print(); });
    $("#tdClose").addEventListener("click", function () {
      trackSel = null; renderSubjectList(); $("#trackDetail").hidden = true;
    });
    $("#sessionForm").addEventListener("submit", submitSession);
    $("#tongueForm").addEventListener("submit", submitTongue);
    $("#ledgerForm").addEventListener("submit", submitLedger);
    $("#irAdd").addEventListener("click", addObserver);
    $("#irRun").addEventListener("click", runInterrater);
    $("#irClear").addEventListener("click", function () {
      if (!confirm("清空所有觀察者格子？")) return;
      renderInterrater();
    });

    $("#btnExport").addEventListener("click", exportData);
    $("#fileImport").addEventListener("change", function (e) {
      if (e.target.files && e.target.files[0]) importData(e.target.files[0]);
      e.target.value = "";
    });
    $("#btnWipe").addEventListener("click", wipeData);

    $$("[data-restart]").forEach(function (b) {
      b.addEventListener("click", function () {
        var r = b.dataset.restart;
        if (r === "classify") renderClassify();
        else if (r === "mastery") renderMastery();
        else renderQuiz();
      });
    });

    route();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
