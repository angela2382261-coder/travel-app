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

  const slider = document.createElement("div");
  slider.style.overflow = "hidden";
  slider.style.position = "relative";

  const track = document.createElement("div");
  track.style.display = "flex";
  track.style.transition = "transform 0.35s ease";

  slider.appendChild(track);

  project.days.forEach((day, index) => {

    const page = document.createElement("div");
    page.style.minWidth = "100%";
    page.style.padding = "10px";
    page.style.transition = "transform 0.3s";

    const card = document.createElement("div");
    card.className = "card";

    const title = document.createElement("h2");
    title.innerText = day.title;

    card.appendChild(title);

    day.activities.forEach(act => {

      const row = document.createElement("div");
      row.className = "row";

      const left = document.createElement("div");
      left.className = "left";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = act.done;

      cb.onchange = async () => {
        act.done = cb.checked;
        render();
        await updateActivity(act.id, cb.checked);
      };

      const text = document.createElement("span");
      text.innerText = `${act.name} ¥${act.cost}`;

      if (act.done) {
        text.style.textDecoration = "line-through";
        text.style.color = "#999";
      }

      left.appendChild(cb);
      left.appendChild(text);

      const mapBtn = document.createElement("button");
      mapBtn.className = "mapBtn";
      mapBtn.innerText = "📍";
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

  // =================
  // 🎯 初始位置
  // =================
  updateSlider();

  // =================
  // 👆 手勢（滑動 + 縮放🔥）
  // =================
  slider.addEventListener("touchstart", (e) => {
    startX = e.touches[0].clientX;
    track.style.transition = "none";
  });

  slider.addEventListener("touchmove", (e) => {
    const currentX = e.touches[0].clientX;
    const diff = currentX - startX;

    const move = -currentDayIndex * window.innerWidth + diff;
    track.style.transform = `translateX(${move}px)`;

    // ⭐ 卡片縮放效果
    const pages = track.children;
    for (let i = 0; i < pages.length; i++) {
      const scale = 1 - Math.min(Math.abs(diff) / 500, 0.1);
      pages[i].style.transform = `scale(${scale})`;
    }
  });

  slider.addEventListener("touchend", (e) => {
    const endX = e.changedTouches[0].clientX;
    const diff = startX - endX;

    if (diff > 50 && currentDayIndex < project.days.length - 1) {
      currentDayIndex++;
    }

    if (diff < -50 && currentDayIndex > 0) {
      currentDayIndex--;
    }

    updateSlider();
  });

  container.appendChild(slider);

  // =================
  // 🔘 左右按鈕
  // =================
  const leftBtn = document.createElement("button");
  leftBtn.innerText = "←";
  leftBtn.style.position = "absolute";
  leftBtn.style.left = "10px";
  leftBtn.style.top = "50%";
  leftBtn.style.transform = "translateY(-50%)";
  leftBtn.style.fontSize = "20px";

  leftBtn.onclick = () => {
    if (currentDayIndex > 0) {
      currentDayIndex--;
      updateSlider();
    }
  };

  const rightBtn = document.createElement("button");
  rightBtn.innerText = "→";
  rightBtn.style.position = "absolute";
  rightBtn.style.right = "10px";
  rightBtn.style.top = "50%";
  rightBtn.style.transform = "translateY(-50%)";
  rightBtn.style.fontSize = "20px";

  rightBtn.onclick = () => {
    if (currentDayIndex < project.days.length - 1) {
      currentDayIndex++;
      updateSlider();
    }
  };

  slider.appendChild(leftBtn);
  slider.appendChild(rightBtn);

  // =================
  // 🔧 更新位置
  // =================
  function updateSlider() {
    track.style.transition = "transform 0.35s ease";
    track.style.transform = `translateX(-${currentDayIndex * 100}%)`;

    // 恢復縮放
    const pages = track.children;
    for (let i = 0; i < pages.length; i++) {
      pages[i].style.transform = "scale(1)";
    }
  }
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
