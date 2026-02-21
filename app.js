const API_URL = "https://script.google.com/macros/s/AKfycbz5z5FS1zxQPShsh52pG8L45cKqMwqvUZ3ApK3PnIjLmasYYeUMWXArHLGwhJfI7LgL/exec";

let appData = null;
let openState = {};
let currentTab = "plan"; // plan / stats
let currentDayIndex = 0;
let startX = 0;
let currentTranslate = 0;

// =================
// ⏳ Loading
// =================
function renderLoading() {
  document.getElementById("app").innerHTML = "⏳ 讀取中...";
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

  projects.forEach(p => {
    const project = {
      id: p.projectId,
      name: p.name,
      days: [],
      budget: { total: 0 }
    };

    project.days = days
      .filter(d => d.projectId === p.projectId)
      .map(d => ({
        title: d.title,
        activities: activities
          .filter(a => a.dayId === d.dayId)
          .map(a => ({
            id: a.activityId,
            name: a.name,
            cost: Number(a.cost) || 0,
            done: a.done === true || a.done === "TRUE",
            category: a.category || "其他",
            map: a.map || ""
          }))
      }));

    const m = meta.find(m => m.projectId === p.projectId);
    if (m) {
      project.budget.total = Number(m.budgetTotal) || 0;
    }

    result.projects.push(project);
  });

  return result;
}

// =================
// 🎨 UI
// =================

function render() {
  const container = document.getElementById("app");
  container.innerHTML = "";

  if (currentTab === "plan") {
    renderPlan(container);
  } else {
    renderStats(container);
  }

  renderTabBar();
}

function renderPlan(container) {
  const project = appData.projects[0];

  // 外層
  const slider = document.createElement("div");
  slider.style.overflow = "hidden";
  slider.style.position = "relative";
  slider.style.padding = "18px 0 8px";

  // 內層軌道
  const track = document.createElement("div");
  track.style.display = "flex";
  track.style.willChange = "transform";
  track.style.transition = "transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)";

  slider.appendChild(track);

  // ---- 每頁寬度（做出左右留白的 iOS 卡片感）
  const pageWidth = Math.round(window.innerWidth * 0.88);
  const pageGap = Math.round(window.innerWidth * 0.06); // 左右邊距
  const step = pageWidth + pageGap; // 每次滑動距離

  // 建頁面
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
      row.style.alignItems = "center";
      row.style.padding = "14px 0";
      row.style.borderTop = "1px solid #eee";

      const left = document.createElement("div");
      left.style.display = "flex";
      left.style.alignItems = "center";
      left.style.gap = "10px";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = act.done;
      cb.style.transform = "scale(1.35)";

      cb.onchange = async () => {
        act.done = cb.checked;
        render();
        await updateActivity(act.id, cb.checked);
      };

      const text = document.createElement("span");
      text.innerText = `${act.name} ¥${act.cost}`;
      text.style.fontSize = "20px";

      if (act.done) {
        text.style.textDecoration = "line-through";
        text.style.color = "#999";
      }

      left.appendChild(cb);
      left.appendChild(text);

      const mapBtn = document.createElement("button");
      mapBtn.innerText = "📍";
      mapBtn.style.border = "none";
      mapBtn.style.background = "#f1f1f3";
      mapBtn.style.borderRadius = "14px";
      mapBtn.style.padding = "10px 12px";
      mapBtn.style.fontSize = "18px";
      mapBtn.style.boxShadow = "0 6px 16px rgba(0,0,0,0.08)";

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
    // progress: 0 ~ 1（拖曳程度）
    const pages = track.children;
    for (let i = 0; i < pages.length; i++) {
      const dist = Math.abs(i - currentDayIndex);
      let base = dist === 0 ? 1 : 0.94;
      // 拖曳時，中心卡片縮一點，旁邊放大一點，像 iOS
      if (dist === 0) base = 1 - 0.05 * progress;
      if (dist === 1) base = 0.94 + 0.06 * progress;
      pages[i].style.transform = `scale(${base})`;
    }
  }

  function updatePos(animated = true) {
    track.style.transition = animated
      ? "transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)"
      : "none";

    const x = -currentDayIndex * step;
    track.style.transform = `translateX(${x}px)`;

    applyScale(0);
    renderDots();
  }

  // 初始定位
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

      const base = -currentDayIndex * step;
      track.style.transform = `translateX(${base + dragX}px)`;

      applyScale(Math.min(Math.abs(dragX) / 260, 1));
    },
    { passive: true }
  );

  slider.addEventListener(
    "touchend",
    () => {
      dragging = false;

      // 決定換頁門檻
      if (dragX < -60 && currentDayIndex < project.days.length - 1) currentDayIndex++;
      if (dragX > 60 && currentDayIndex > 0) currentDayIndex--;

      updatePos(true);
    },
    { passive: true }
  );

  // 旋轉螢幕時重算
  window.addEventListener("resize", () => {
    // 這裡最保險是直接重 render
    render();
  });
}

function renderTabBar() {
  let old = document.querySelector(".tabbar");
  if (old) old.remove();

  const tabbar = document.createElement("div");
  tabbar.className = "tabbar";

  const tab1 = document.createElement("div");
  tab1.className = "tab";
  tab1.innerHTML = "🗓<br>行程";
  if (currentTab === "plan") tab1.classList.add("active");

  tab1.onclick = () => {
    currentTab = "plan";
    render();
  };

  const tab2 = document.createElement("div");
  tab2.className = "tab";
  tab2.innerHTML = "📊<br>統計";
  if (currentTab === "stats") tab2.classList.add("active");

  tab2.onclick = () => {
    currentTab = "stats";
    render();
  };

  tabbar.appendChild(tab1);
  tabbar.appendChild(tab2);

  document.body.appendChild(tabbar);
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
        done
      })
    });
  } catch (e) {
    console.error("更新失敗", e);
  }
}
