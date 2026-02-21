const API_URL =
  "https://script.google.com/macros/s/AKfycbz5z5FS1zxQPShsh52pG8L45cKqMwqvUZ3ApK3PnIjLmasYYeUMWXArHLGwhJfI7LgL/exec";

let appData = null;
let currentTab = "plan"; // plan / stats
let currentDayIndex = 0;

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
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.justifyContent = "space-between";
      row.style.alignItems = "flex-start";
      row.style.padding = "14px 0";
      row.style.borderTop = "1px solid #eee";
      row.style.gap = "10px";

      // left
      const left = document.createElement("div");
      left.style.display = "flex";
      left.style.alignItems = "flex-start";
      left.style.gap = "12px";
      left.style.flex = "1";

      // checkbox
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = act.done;
      cb.style.transform = "scale(1.35)";
      cb.style.marginTop = "6px";

      cb.onchange = async () => {
        act.done = cb.checked;
        render();
        await updateActivity(act.id, cb.checked);
      };

      // info
      const info = document.createElement("div");
      info.style.flex = "1";

      // main line
      const main = document.createElement("div");
      main.innerText = `${act.name} ¥${act.cost}`;
      main.style.fontSize = "20px";
      main.style.fontWeight = "600";
      main.style.lineHeight = "1.25";
      main.style.wordBreak = "break-word";

      if (act.done) {
        main.style.textDecoration = "line-through";
        main.style.color = "#9ca3af";
      }

      // tagWrap
      const tagWrap = document.createElement("div");
      tagWrap.style.marginTop = "8px";
      tagWrap.style.display = "flex";
      tagWrap.style.flexWrap = "wrap";
      tagWrap.style.gap = "6px";

      // ✅ 分類 tag
      const catTag = document.createElement("span");
      catTag.innerText = act.category;
      catTag.style.fontSize = "12px";
      catTag.style.padding = "4px 10px";
      catTag.style.borderRadius = "999px";
      catTag.style.background = getCategoryBg(act.category);
      catTag.style.color = getCategoryColor(act.category);
      tagWrap.appendChild(catTag);

      // ✅ 交通備註 tag
      parseNoteTags(act.note).forEach((t) => {
        const tag = document.createElement("span");
        tag.innerText = t;
        tag.style.fontSize = "12px";
        tag.style.padding = "4px 10px";
        tag.style.borderRadius = "999px";
        tag.style.background = "#f1f5f9";
        tag.style.color = "#334155";
        tagWrap.appendChild(tag);
      });

      info.appendChild(main);
      info.appendChild(tagWrap);

      left.appendChild(cb);
      left.appendChild(info);

      // map button
      const mapBtn = document.createElement("button");
      mapBtn.innerText = "📍";
      mapBtn.style.border = "none";
      mapBtn.style.background = "#f1f1f3";
      mapBtn.style.borderRadius = "14px";
      mapBtn.style.padding = "10px 12px";
      mapBtn.style.fontSize = "18px";
      mapBtn.style.boxShadow = "0 6px 16px rgba(0,0,0,0.08)";
      mapBtn.style.flexShrink = "0";

      mapBtn.onclick = () => {
        if (act.map) window.open(act.map, "_blank");
      };

      row.appendChild(left);
      row.appendChild(mapBtn);
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
  const card = document.createElement("div");
  card.style.background = "#fff";
  card.style.borderRadius = "20px";
  card.style.margin = "16px";
  card.style.padding = "16px";
  card.style.boxShadow = "0 10px 30px rgba(0,0,0,0.08)";
  card.innerHTML = "📊 統計頁（下一步我再幫你加圓餅圖）";
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
}
