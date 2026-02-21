const API_URL =
  "https://script.google.com/macros/s/AKfycbz5z5FS1zxQPShsh52pG8L45cKqMwqvUZ3ApK3PnIjLmasYYeUMWXArHLGwhJfI7LgL/exec";

let appData = null;
let currentTab = "plan"; // plan / stats
let currentDayIndex = 0;
let expanded = {}; // ⭐控制展開
let pressTimer = null;
let editingAct = null;

// =================
// ⏳ Loading
// =================
function renderLoading() {
  const el = document.getElementById("app");
  if (el) el.innerHTML = "⏳ 讀取中...";
}

// =================
// 🔹 JSONP
// =================
function loadFromSheet() {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    const callbackName = "jsonp_" + Date.now();

    window[callbackName] = function (data) {
      resolve(data);
      delete window[callbackName];
      script.remove();
    };

    script.src = API_URL + "?callback=" + callbackName;
    document.body.appendChild(script);
  });
}

// =================
// 🚀 初始化
// =================
async function init() {
  renderLoading();
  const sheetData = await loadFromSheet();
  appData = convert(sheetData);
  render();
}
init();

// =================
// 🔄 資料轉換
// =================
function convert(data) {
  const { projects, days, activities, meta } = data;

  const result = { projects: [] };

  projects.forEach((p) => {
    const project = {
      id: p.projectId,
      name: p.name,
      days: [],
      budget: { total: 0 },
    };

    project.days = days
      .filter((d) => d.projectId === p.projectId)
      .map((d) => ({
        title: d.title,
        date: d.date,
        activities: activities
          .filter((a) => a.dayId === d.dayId)
          .map((a) => ({
            id: a.activityId,
            name: a.name,
            cost: Number(a.cost) || 0,
            done: a.done === true || a.done === "TRUE",
            category: a.category || "其他",
            map: a.map || "",
            note: a.note || "",
          })),
      }));

    const m = meta.find((m) => m.projectId === p.projectId);
    if (m) project.budget.total = Number(m.budgetTotal) || 0;

    result.projects.push(project);
  });

  return result;
}

// =================
// 🏷️ 交通備註 tag
// =================
function parseNoteTags(note) {
  if (!note) return [];
  const s = String(note);
  const t = [];

  if (s.includes("JR")) t.push("🚆 JR");
  if (s.includes("地鐵")) t.push("🚇 地鐵");
  if (s.includes("巴士")) t.push("🚌 巴士");
  if (s.includes("高速")) t.push("🚌 高速");
  if (s.includes("步行")) t.push("🚶 步行");
  if (s.includes("計程車")) t.push("🚕 計程車");

  // 你也可以直接在 note 放「🚇地鐵」之類，這裡先不額外解析 emoji
  return t;
}

// =================
// 🎨 UI
// =================
function render() {
  const container = document.getElementById("app");
  container.innerHTML = "";
  container.style.background = "#f2f2f7";
  container.style.minHeight = "100vh";
  container.style.paddingBottom = "90px"; // 讓底部 tab 不遮住內容

  if (currentTab === "plan") {
    renderPlan(container);
  } else {
    renderStats(container);
  }

  renderTabBar();
}

// =================
// 🗓 行程（iOS 滑動 + 點點）
// =================
function renderPlan(container) {
  const project = appData.projects[0];

  const slider = document.createElement("div");
  slider.style.overflow = "hidden";
  slider.style.position = "relative";
  slider.style.padding = "18px 0 8px";

  const track = document.createElement("div");
  track.style.display = "flex";
  track.style.willChange = "transform";
  track.style.transition = "transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)";
  slider.appendChild(track);

  // iOS 卡片感：左右留白
  const pageWidth = Math.round(window.innerWidth * 0.88);
  const pageGap = Math.round(window.innerWidth * 0.06);
  const step = pageWidth + pageGap;

  project.days.forEach((day) => {
    const page = document.createElement("div");
    page.style.width = pageWidth + "px";
    page.style.marginLeft = pageGap / 2 + "px";
    page.style.marginRight = pageGap / 2 + "px";
    page.style.flexShrink = "0";
    page.style.transition = "transform 0.25s ease";

    const card = document.createElement("div");
    card.style.background = "#fff";
    card.style.borderRadius = "26px";
    card.style.padding = "18px";
    card.style.boxShadow = "0 12px 30px rgba(0,0,0,0.10)";

    const title = document.createElement("h2");
    title.innerText = day.title;
    title.style.margin = "0 0 10px";
    title.style.fontSize = "28px";
    title.style.fontWeight = "800";
    card.appendChild(title);

   day.activities.forEach((act) => {
  const key = act.id;

  // =================
  // Row（整列）
  // =================
  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.flexDirection = "column";   // ⭐ 上面主內容 + 下面 detail
  row.style.padding = "14px 0";
  row.style.borderTop = "1px solid #eee";

  // =================
  // 主內容 top（checkbox + 文字 + 地圖）
  // =================
  const top = document.createElement("div");
  top.style.display = "flex";
  top.style.alignItems = "center";
  top.style.gap = "12px";

  // checkbox（固定）
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = act.done;
  cb.style.transform = "scale(1.35)";
  cb.style.flex = "0 0 auto";
  cb.style.marginTop = "2px";

  cb.onchange = async (e) => {
    e.stopPropagation(); // ⭐避免勾選也觸發展開
    // 輕微動畫
    row.style.transform = "scale(0.98)";
    row.style.opacity = "0.7";
    setTimeout(() => {
      act.done = cb.checked;
      render();
    }, 120);

    await updateActivity(act.id, cb.checked);
  };

  // info（可縮，避免爆版）
  const info = document.createElement("div");
  info.style.flex = "1 1 auto";
  info.style.minWidth = "0"; // ⭐關鍵：讓文字可以在 flex 裡縮
  info.style.display = "flex";
  info.style.flexDirection = "column";
  info.style.gap = "8px";

  // 第一行：名稱 + 金額（同一行，金額有底色）
  const line1 = document.createElement("div");
  line1.style.display = "flex";
  line1.style.alignItems = "center";
  line1.style.gap = "10px";
  line1.style.minWidth = "0";

  const name = document.createElement("div");
  name.innerText = act.name;
  name.style.fontSize = "20px";
  name.style.fontWeight = "700";
  name.style.lineHeight = "1.25";
  name.style.minWidth = "0";
  name.style.flex = "1 1 auto";
  name.style.wordBreak = "break-word";

  const price = document.createElement("div");
  price.innerText = `¥${Number(act.cost || 0).toLocaleString()}`;
  price.style.flex = "0 0 auto";
  price.style.fontSize = "15px";
  price.style.fontWeight = "800";
  price.style.padding = "6px 10px";
  price.style.borderRadius = "999px";
  price.style.background = "#e0f2fe";     // ⭐金額底色（跟行程區分）
  price.style.color = "#075985";

  line1.appendChild(name);
  line1.appendChild(price);

  // tags
  const tagWrap = document.createElement("div");
  tagWrap.style.display = "flex";
  tagWrap.style.flexWrap = "wrap";
  tagWrap.style.gap = "6px";

  // 分類 tag（顏色）
  const catTag = document.createElement("span");
  catTag.innerText = act.category || "其他";
  catTag.style.fontSize = "12px";
  catTag.style.padding = "5px 10px";
  catTag.style.borderRadius = "999px";
  catTag.style.fontWeight = "700";

  if (act.category === "食物") {
    catTag.style.background = "#fee2e2"; catTag.style.color = "#b91c1c";
  } else if (act.category === "景點") {
    catTag.style.background = "#dbeafe"; catTag.style.color = "#1d4ed8";
  } else if (act.category === "交通") {
    catTag.style.background = "#fef3c7"; catTag.style.color = "#92400e";
  } else if (act.category === "飯店") {
    catTag.style.background = "#dcfce7"; catTag.style.color = "#166534";
  } else {
    catTag.style.background = "#e5e7eb"; catTag.style.color = "#374151";
  }

  tagWrap.appendChild(catTag);

  // 備註 tag（交通方式）
  parseNoteTags(act.note).forEach(t => {
    const tag = document.createElement("span");
    tag.innerText = t;
    tag.style.fontSize = "12px";
    tag.style.padding = "5px 10px";
    tag.style.borderRadius = "999px";
    tag.style.background = "#eef2ff";
    tag.style.color = "#3730a3";
    tagWrap.appendChild(tag);
  });

  info.appendChild(line1);
  info.appendChild(tagWrap);

  // done 狀態
  if (act.done) {
    name.style.textDecoration = "line-through";
    name.style.color = "#9ca3af";
    price.style.opacity = "0.6";
    tagWrap.style.opacity = "0.6";
  }

  // 地圖按鈕（永遠在最右）
  const mapBtn = document.createElement("button");
  mapBtn.innerText = "📍";
  mapBtn.style.flex = "0 0 auto";
  mapBtn.style.marginLeft = "auto";
  mapBtn.style.border = "none";
  mapBtn.style.background = "#f1f5f9";
  mapBtn.style.borderRadius = "14px";
  mapBtn.style.padding = "10px 12px";
  mapBtn.style.fontSize = "18px";
  mapBtn.style.boxShadow = "0 6px 16px rgba(0,0,0,0.08)";

  mapBtn.onclick = (e) => {
    e.stopPropagation(); // ⭐避免點📍也展開
    if (act.map) window.open(act.map, "_blank");
  };

  top.appendChild(cb);
  top.appendChild(info);
  top.appendChild(mapBtn);

  // =================
  // detail（展開區）
  // =================
  const detail = document.createElement("div");
  detail.style.maxHeight = expanded[key] ? "220px" : "0";
  detail.style.overflow = "hidden";
  detail.style.transition = "max-height 0.28s ease";
  detail.style.fontSize = "14px";
  detail.style.color = "#64748b";
  detail.style.paddingLeft = "42px"; // 對齊文字區

  // 內容
  const noteText = act.note ? `📝 ${act.note}` : "";
  const hintText = act.map ? `📍 點右側可開地圖` : "";
  detail.innerHTML = [noteText, hintText].filter(Boolean).join("<br>");

  // =================
  // 點一下展開/收合
  // =================
  row.onclick = () => {
    expanded[key] = !expanded[key];
    render();
  };

  // =================
  // 長按開編輯（只留一份）
  // =================
  let pressTimer = null;

  row.addEventListener("touchstart", () => {
    pressTimer = setTimeout(() => openEditor(act), 450);
  }, { passive: true });

  row.addEventListener("touchend", () => {
    clearTimeout(pressTimer);
  }, { passive: true });

  row.addEventListener("touchmove", () => {
    clearTimeout(pressTimer);
  }, { passive: true });

  // 組起來
  row.appendChild(top);
  row.appendChild(detail);
  card.appendChild(row);
});
    page.appendChild(card);
    track.appendChild(page);
  });

  container.appendChild(slider);

  // =================
  // 🔵 點點
  // =================
  const dots = document.createElement("div");
  dots.style.display = "flex";
  dots.style.justifyContent = "center";
  dots.style.gap = "8px";
  dots.style.margin = "10px 0 0";
  dots.style.userSelect = "none";

  function renderDots() {
    dots.innerHTML = "";
    project.days.forEach((_, i) => {
      const dot = document.createElement("div");
      dot.style.width = i === currentDayIndex ? "18px" : "7px";
      dot.style.height = "7px";
      dot.style.borderRadius = "999px";
      dot.style.background = i === currentDayIndex ? "#111" : "#c9c9cf";
      dot.style.transition = "all 0.25s ease";
      dots.appendChild(dot);
    });
  }

  container.appendChild(dots);

  // =================
  // 🎯 滑動 + iOS 縮放
  // =================
  let startX = 0;
  let dragX = 0;
  let dragging = false;

  function applyScale(progress = 0) {
    const pages = track.children;
    for (let i = 0; i < pages.length; i++) {
      const dist = Math.abs(i - currentDayIndex);
      let base = dist === 0 ? 1 : 0.94;
      if (dist === 0) base = 1 - 0.05 * progress;
      if (dist === 1) base = 0.94 + 0.06 * progress;
      pages[i].style.transform = `scale(${base})`;
    }
  }

  function updatePos(animated = true) {
    track.style.transition = animated
      ? "transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)"
      : "none";
    track.style.transform = `translateX(${-currentDayIndex * step}px)`;
    applyScale(0);
    renderDots();
  }

  updatePos(true);

  slider.addEventListener(
    "touchstart",
    (e) => {
      dragging = true;
      startX = e.touches[0].clientX;
      dragX = 0;
      track.style.transition = "none";
    },
    { passive: true }
  );

  slider.addEventListener(
    "touchmove",
    (e) => {
      if (!dragging) return;
      const x = e.touches[0].clientX;
      dragX = x - startX;

      // 邊界彈性
      if (currentDayIndex === 0 && dragX > 0) dragX *= 0.35;
      if (currentDayIndex === project.days.length - 1 && dragX < 0) dragX *= 0.35;

      track.style.transform = `translateX(${-currentDayIndex * step + dragX}px)`;
      applyScale(Math.min(Math.abs(dragX) / 260, 1));
    },
    { passive: true }
  );

  slider.addEventListener(
    "touchend",
    () => {
      dragging = false;
      if (dragX < -60 && currentDayIndex < project.days.length - 1) currentDayIndex++;
      if (dragX > 60 && currentDayIndex > 0) currentDayIndex--;
      updatePos(true);
    },
    { passive: true }
  );

  window.addEventListener("resize", () => render());
}

// =================
// 📊 統計頁（先做保底，不會爆）
// =================
function renderStats(container) {
  const project = appData.projects[0];

  // ====== 計算總花費 + 分類統計（只算 done=true）
  let totalSpent = 0;
  const stats = {}; // { category: amount }

  project.days.forEach(day => {
    day.activities.forEach(a => {
      if (!a.done) return;
      totalSpent += a.cost;

      const cat = a.category || "其他";
      stats[cat] = (stats[cat] || 0) + a.cost;
    });
  });

  const budgetTotal = Number(project.budget?.total || 0);

  // ====== 整體卡片
  const card = document.createElement("div");
  card.style.background = "#fff";
  card.style.borderRadius = "20px";
  card.style.margin = "16px";
  card.style.padding = "16px";
  card.style.boxShadow = "0 10px 30px rgba(0,0,0,0.08)";

  // ====== 標題
  const h = document.createElement("h2");
  h.innerText = "📊 花費統計";
  h.style.margin = "0 0 10px";
  h.style.fontSize = "26px";
  h.style.fontWeight = "800";
  card.appendChild(h);

  // ====== 已花/總預算
  const summary = document.createElement("div");
  summary.style.fontSize = "18px";
  summary.style.marginBottom = "12px";
  summary.style.lineHeight = "1.5";
  summary.innerHTML =
    `💰 已花：<b>¥${totalSpent.toLocaleString()}</b>` +
    (budgetTotal ? `　/　總預算：<b>¥${budgetTotal.toLocaleString()}</b>` : "");
  card.appendChild(summary);

  // ====== 進度條（可選）
  if (budgetTotal > 0) {
    const barWrap = document.createElement("div");
    barWrap.style.background = "#f1f1f3";
    barWrap.style.borderRadius = "999px";
    barWrap.style.height = "12px";
    barWrap.style.overflow = "hidden";
    barWrap.style.marginBottom = "16px";

    const bar = document.createElement("div");
    const pct = Math.min(totalSpent / budgetTotal, 1);
    bar.style.width = `${Math.round(pct * 100)}%`;
    bar.style.height = "100%";
    bar.style.background = pct >= 1 ? "#ef4444" : "#22c55e";

    barWrap.appendChild(bar);
    card.appendChild(barWrap);
  }

  // ====== 圓餅圖 + 列表布局
  const layout = document.createElement("div");
  layout.style.display = "flex";
  layout.style.gap = "16px";
  layout.style.alignItems = "center";
  layout.style.flexWrap = "wrap"; // 手機上可換行
  card.appendChild(layout);

  // ====== 圓餅圖卡
  const chartWrap = document.createElement("div");
  chartWrap.style.flex = "0 0 220px";
  chartWrap.style.display = "flex";
  chartWrap.style.justifyContent = "center";
  chartWrap.style.alignItems = "center";

  const canvas = document.createElement("canvas");
  canvas.width = 220;
  canvas.height = 220;
  chartWrap.appendChild(canvas);
  layout.appendChild(chartWrap);

  // ====== 分類列表
  const list = document.createElement("div");
  list.style.flex = "1";
  list.style.minWidth = "240px";
  layout.appendChild(list);

  // 如果沒有花費
  if (totalSpent === 0) {
    const empty = document.createElement("div");
    empty.innerText = "目前還沒有勾選任何花費 ✅";
    empty.style.color = "#666";
    empty.style.fontSize = "16px";
    list.appendChild(empty);

    container.appendChild(card);
    return;
  }

  // ====== 顏色（固定幾個 iOS 風）
  const colorPool = ["#007aff", "#34c759", "#ff9500", "#ff3b30", "#af52de", "#5ac8fa", "#ff2d55"];
  const entries = Object.entries(stats).sort((a, b) => b[1] - a[1]);

  // 用來做「點擊高亮」
  let activeIndex = -1;

  function drawPie() {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const r = 80;

    let start = -Math.PI / 2;

    entries.forEach(([cat, amount], i) => {
      const angle = (amount / totalSpent) * Math.PI * 2;
      const end = start + angle;

      // 高亮：選到的那塊稍微外凸
      const isActive = i === activeIndex;
      const bump = isActive ? 8 : 0;
      const mid = (start + end) / 2;

      const bx = Math.cos(mid) * bump;
      const by = Math.sin(mid) * bump;

      ctx.beginPath();
      ctx.moveTo(cx + bx, cy + by);
      ctx.fillStyle = colorPool[i % colorPool.length];
      ctx.arc(cx + bx, cy + by, r, start, end);
      ctx.closePath();
      ctx.fill();

      // 分隔線
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 3;
      ctx.stroke();

      start = end;
    });

    // 中間文字
    ctx.fillStyle = "#111";
    ctx.font = "700 16px -apple-system";
    ctx.textAlign = "center";
    ctx.fillText("已花", cx, cy - 6);

    ctx.fillStyle = "#111";
    ctx.font = "800 18px -apple-system";
    ctx.fillText(`¥${totalSpent.toLocaleString()}`, cx, cy + 18);
  }

  function renderList() {
    list.innerHTML = "";

    entries.forEach(([cat, amount], i) => {
      const pct = Math.round((amount / totalSpent) * 100);

      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.justifyContent = "space-between";
      row.style.padding = "10px 0";
      row.style.borderTop = "1px solid #eee";
      row.style.cursor = "pointer";

      // 左：色塊 + 名稱
      const left = document.createElement("div");
      left.style.display = "flex";
      left.style.alignItems = "center";
      left.style.gap = "10px";

      const dot = document.createElement("span");
      dot.style.width = "10px";
      dot.style.height = "10px";
      dot.style.borderRadius = "50%";
      dot.style.background = colorPool[i % colorPool.length];
      dot.style.display = "inline-block";

      const name = document.createElement("div");
      name.style.fontSize = "16px";
      name.style.fontWeight = i === activeIndex ? "800" : "600";
      name.style.color = i === activeIndex ? "#111" : "#333";
      name.innerText = `${cat} (${pct}%)`;

      left.appendChild(dot);
      left.appendChild(name);

      // 右：金額
      const right = document.createElement("div");
      right.style.fontSize = "16px";
      right.style.fontWeight = i === activeIndex ? "800" : "600";
      right.style.color = i === activeIndex ? "#111" : "#333";
      right.innerText = `¥${amount.toLocaleString()}`;

      row.appendChild(left);
      row.appendChild(right);

      row.onclick = () => {
        activeIndex = activeIndex === i ? -1 : i;
        drawPie();
        renderList();
      };

      list.appendChild(row);
    });
  }

  drawPie();
  renderList();

  container.appendChild(card);
}

// =================
// 底部 tabbar
// =================
function renderTabBar() {
  let old = document.querySelector(".tabbar");
  if (old) old.remove();

  const tabbar = document.createElement("div");
  tabbar.className = "tabbar";
  tabbar.style.position = "fixed";
  tabbar.style.bottom = "0";
  tabbar.style.left = "0";
  tabbar.style.right = "0";
  tabbar.style.height = "72px";
  tabbar.style.background = "rgba(255,255,255,0.96)";
  tabbar.style.backdropFilter = "blur(10px)";
  tabbar.style.borderTop = "1px solid #eee";
  tabbar.style.display = "flex";
  tabbar.style.zIndex = "9999";

  const mkTab = (key, icon, label) => {
    const t = document.createElement("div");
    t.style.flex = "1";
    t.style.textAlign = "center";
    t.style.paddingTop = "10px";
    t.style.fontSize = "12px";
    t.style.color = currentTab === key ? "#007aff" : "#8e8e93";
    t.style.fontWeight = currentTab === key ? "700" : "500";
    t.innerHTML = `${icon}<br>${label}`;
    t.onclick = () => {
      currentTab = key;
      render();
    };
    return t;
  };

  tabbar.appendChild(mkTab("plan", "🗓", "行程"));
  tabbar.appendChild(mkTab("stats", "📊", "統計"));

  document.body.appendChild(tabbar);
}

// =================
// 類別顏色
// =================
function getCategoryBg(c) {
  if (c === "食物") return "#ffe4e6";
  if (c === "景點") return "#e0f2fe";
  if (c === "交通") return "#fef9c3";
  if (c === "飯店") return "#dcfce7";
  return "#e5e7eb";
}
function getCategoryColor(c) {
  if (c === "食物") return "#9f1239";
  if (c === "景點") return "#075985";
  if (c === "交通") return "#854d0e";
  if (c === "飯店") return "#166534";
  return "#111827";
}

// =================
// 🔄 更新
// =================
async function updateActivity(activityId, done) {
  try {
    await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        type: "updateActivity",
        activityId,
        done,
      }),
    });
  } catch (e) {
    console.error("更新失敗", e);
  }

  function ensureEditorUI() {
  if (document.getElementById("editorOverlay")) return;

  // overlay
  const overlay = document.createElement("div");
  overlay.id = "editorOverlay";
  overlay.style.cssText = `
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.25);
    opacity: 0; pointer-events: none;
    transition: opacity .25s ease;
    z-index: 9998;
  `;
  overlay.addEventListener("click", closeEditor);

  // sheet
  const sheet = document.createElement("div");
  sheet.id = "editorSheet";
  sheet.style.cssText = `
    position: fixed; left: 0; right: 0; bottom: 0;
    background: #fff;
    border-top-left-radius: 18px;
    border-top-right-radius: 18px;
    box-shadow: 0 -18px 40px rgba(0,0,0,0.18);
    transform: translateY(110%);
    transition: transform .35s cubic-bezier(.22,1,.36,1);
    z-index: 9999;
    padding: 14px 16px 18px;
    padding-bottom: calc(18px + env(safe-area-inset-bottom));
  `;

  sheet.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
      <button id="btnCancel" style="
        border:none; background:transparent; color:#2563eb; font-size:16px; padding:8px 6px;
      ">取消</button>

      <div style="font-weight:800; font-size:16px;">編輯行程</div>

      <button id="btnSave" style="
        border:none; background:#2563eb; color:#fff; font-size:16px;
        padding:9px 14px; border-radius:12px; font-weight:700;
      ">儲存</button>
    </div>

    <div style="height:8px;"></div>

    <div style="display:flex; flex-direction:column; gap:10px;">
      ${fieldRow("名稱", `<input id="fName" type="text" placeholder="例如：大阪城" />`)}
      ${fieldRow("金額", `<input id="fCost" type="number" inputmode="numeric" placeholder="例如：1500" />`)}
      ${fieldRow("分類", `
        <select id="fCategory">
          <option>食物</option>
          <option>景點</option>
          <option>交通</option>
          <option>飯店</option>
          <option>其他</option>
        </select>
      `)}
      ${fieldRow("備註", `<input id="fNote" type="text" placeholder="例如：JR／地鐵／步行…" />`)}
      ${fieldRow("地圖連結", `<input id="fMap" type="url" placeholder="https://maps.apple.com/..." />`)}
    </div>

    <div style="height:10px;"></div>

    <button id="btnDelete" style="
      width:100%;
      border:1px solid #fecaca;
      background:#fff1f2;
      color:#b91c1c;
      padding:12px 14px;
      border-radius:14px;
      font-weight:800;
    ">刪除（可選）</button>
  `;

  // 共用 input style
  const style = document.createElement("style");
  style.textContent = `
    #editorSheet input, #editorSheet select{
      width:100%;
      font-size:16px;
      padding:12px 12px;
      border:1px solid #e5e7eb;
      border-radius:12px;
      outline:none;
      background:#fff;
    }
    #editorSheet input:focus, #editorSheet select:focus{
      border-color:#93c5fd;
      box-shadow: 0 0 0 4px rgba(59,130,246,.12);
    }
  `;
  document.head.appendChild(style);

  document.body.appendChild(overlay);
  document.body.appendChild(sheet);

  document.getElementById("btnCancel").onclick = closeEditor;
  document.getElementById("btnSave").onclick = saveEditor;
  document.getElementById("btnDelete").onclick = deleteEditor;
}

// 小工具：每一列
function fieldRow(label, html) {
  return `
    <div>
      <div style="font-size:12px; color:#6b7280; margin:0 0 6px 2px;">${label}</div>
      ${html}
    </div>
  `;
}

// 打開 editor
function openEditor(act) {

  // 背景遮罩
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.background = "rgba(0,0,0,0.25)";
  overlay.style.zIndex = "999";

  // 底部彈出卡片
  const modal = document.createElement("div");
  modal.style.position = "fixed";
  modal.style.bottom = "0";
  modal.style.left = "0";
  modal.style.width = "100%";
  modal.style.background = "#fff";
  modal.style.borderRadius = "20px 20px 0 0";
  modal.style.padding = "20px";
  modal.style.zIndex = "1000";
  modal.style.boxShadow = "0 -10px 30px rgba(0,0,0,0.15)";
  modal.style.transform = "translateY(100%)";
  modal.style.transition = "transform 0.3s ease";

  // 標題
  const title = document.createElement("h3");
  title.innerText = "編輯行程";
  title.style.marginBottom = "10px";

  // 名稱
  const nameInput = document.createElement("input");
  nameInput.value = act.name;
  nameInput.style.width = "100%";
  nameInput.style.marginBottom = "10px";
  nameInput.style.padding = "10px";
  nameInput.style.borderRadius = "10px";
  nameInput.style.border = "1px solid #ddd";

  // 金額
  const costInput = document.createElement("input");
  costInput.value = act.cost;
  costInput.type = "number";
  costInput.style.width = "100%";
  costInput.style.marginBottom = "10px";
  costInput.style.padding = "10px";
  costInput.style.borderRadius = "10px";
  costInput.style.border = "1px solid #ddd";

  // 備註（交通）
  const noteInput = document.createElement("input");
  noteInput.value = act.note || "";
  noteInput.placeholder = "例如：JR / 地鐵 / 巴士";
  noteInput.style.width = "100%";
  noteInput.style.marginBottom = "15px";
  noteInput.style.padding = "10px";
  noteInput.style.borderRadius = "10px";
  noteInput.style.border = "1px solid #ddd";

  // 儲存按鈕
  const saveBtn = document.createElement("button");
  saveBtn.innerText = "儲存";
  saveBtn.style.width = "100%";
  saveBtn.style.padding = "12px";
  saveBtn.style.borderRadius = "12px";
  saveBtn.style.border = "none";
  saveBtn.style.background = "#007aff";
  saveBtn.style.color = "#fff";
  saveBtn.style.fontSize = "16px";

  saveBtn.onclick = async () => {
    act.name = nameInput.value;
    act.cost = Number(costInput.value);
    act.note = noteInput.value;

    closeModal();
    render();

    await updateActivity(act.id, act.done); // 你原本API
  };

  // 關閉
  function closeModal() {
    modal.style.transform = "translateY(100%)";
    overlay.style.opacity = "0";

    setTimeout(() => {
      modal.remove();
      overlay.remove();
    }, 300);
  }

  overlay.onclick = closeModal;

  // 組裝
  modal.appendChild(title);
  modal.appendChild(nameInput);
  modal.appendChild(costInput);
  modal.appendChild(noteInput);
  modal.appendChild(saveBtn);

  document.body.appendChild(overlay);
  document.body.appendChild(modal);

  // 動畫進場
  setTimeout(() => {
    modal.style.transform = "translateY(0)";
  }, 10);
}
function closeEditor() {
  const overlay = document.getElementById("editorOverlay");
  const sheet = document.getElementById("editorSheet");
  if (!overlay || !sheet) return;

  overlay.style.opacity = "0";
  overlay.style.pointerEvents = "none";
  sheet.style.transform = "translateY(110%)";

  document.body.style.overflow = "";
  editingAct = null;
}

// 儲存（前端先更新 + 回寫 Apps Script）
async function saveEditor() {
  if (!editingAct) return;

  const name = document.getElementById("fName").value.trim();
  const cost = Number(document.getElementById("fCost").value || 0);
  const category = document.getElementById("fCategory").value;
  const note = document.getElementById("fNote").value.trim();
  const map = document.getElementById("fMap").value.trim();

  // 1) 先更新前端資料（立即反映）
  editingAct.name = name || editingAct.name;
  editingAct.cost = isNaN(cost) ? editingAct.cost : cost;
  editingAct.category = category || editingAct.category;
  editingAct.note = note;
  editingAct.map = map;

  closeEditor();
  render();

  // 2) 回寫後端（需要 Apps Script doPost 支援 updateActivityFields）
  try {
    await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        type: "updateActivityFields",
        activityId: editingAct.id,
        fields: { name, cost, category, note, map }
      })
    });
  } catch (e) {
    console.error("儲存失敗", e);
    alert("儲存到雲端失敗（但本機已更新），請稍後再試");
  }
}

// 刪除（可選：前端先移除 + 回寫）
async function deleteEditor() {
  if (!editingAct) return;
  const ok = confirm("確定要刪除這筆行程？");
  if (!ok) return;

  const id = editingAct.id;
  closeEditor();

  // 1) 前端移除
  const project = appData.projects[0];
  project.days.forEach(d => {
    d.activities = d.activities.filter(a => a.id !== id);
  });
  render();

  // 2) 回寫（需要 Apps Script doPost 支援 deleteActivity）
  try {
    await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        type: "deleteActivity",
        activityId: id
      })
    });
  } catch (e) {
    console.error("刪除失敗", e);
    alert("刪除到雲端失敗（但本機已刪），請稍後再試");
  }
}
}
