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
  slider.style.padding = "30px 0";

  const track = document.createElement("div");
  track.style.display = "flex";
  track.style.transition = "transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)";

  slider.appendChild(track);

  // =================
  // 📄 頁面
  // =================
  project.days.forEach((day, index) => {

    const page = document.createElement("div");
    page.style.minWidth = "85%";
    page.style.margin = "0 7.5%";
    page.style.transition = "transform 0.3s";

    const card = document.createElement("div");
    card.style.background = "#fff";
    card.style.borderRadius = "24px";
    card.style.padding = "18px";
    card.style.boxShadow = "0 10px 25px rgba(0,0,0,0.1)";

    const title = document.createElement("h2");
    title.innerText = day.title;
    title.style.marginBottom = "10px";

    card.appendChild(title);

    day.activities.forEach(act => {
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.justifyContent = "space-between";
      row.style.padding = "12px 0";
      row.style.borderTop = "1px solid #eee";

      const left = document.createElement("div");

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = act.done;
      cb.style.transform = "scale(1.3)";

      cb.onchange = async () => {
        act.done = cb.checked;
        render();
        await updateActivity(act.id, cb.checked);
      };

      const text = document.createElement("span");
      text.innerText = ` ${act.name} ¥${act.cost}`;

      if (act.done) {
        text.style.textDecoration = "line-through";
        text.style.color = "#999";
      }

      left.appendChild(cb);
      left.appendChild(text);

      const mapBtn = document.createElement("button");
      mapBtn.innerText = "📍";
      mapBtn.style.background = "#eee";
      mapBtn.style.border = "none";
      mapBtn.style.borderRadius = "10px";
      mapBtn.style.padding = "6px 10px";

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
  // 🔵 分頁點點（iOS風）
  // =================
  const dots = document.createElement("div");
  dots.style.textAlign = "center";
  dots.style.marginTop = "10px";

  project.days.forEach((_, i) => {
    const dot = document.createElement("span");
    dot.style.display = "inline-block";
    dot.style.width = "6px";
    dot.style.height = "6px";
    dot.style.margin = "0 4px";
    dot.style.borderRadius = "50%";
    dot.style.background = i === currentDayIndex ? "#000" : "#ccc";
    dots.appendChild(dot);
  });

  container.appendChild(dots);

  // =================
  // 👆 手勢（含彈性）
  // =================
  let velocity = 0;
  let lastX = 0;

  slider.addEventListener("touchstart", (e) => {
    startX = e.touches[0].clientX;
    lastX = startX;
    track.style.transition = "none";
  });

  slider.addEventListener("touchmove", (e) => {
    const currentX = e.touches[0].clientX;
    const diff = currentX - startX;
    velocity = currentX - lastX;
    lastX = currentX;

    let move = -currentDayIndex * window.innerWidth * 0.85 + diff;

    // ⭐ 邊界彈性
    if (currentDayIndex === 0 && diff > 0) move *= 0.3;
    if (currentDayIndex === project.days.length - 1 && diff < 0) move *= 0.3;

    track.style.transform = `translateX(${move}px)`;

    // ⭐ iOS縮放視差
    const pages = track.children;
    for (let i = 0; i < pages.length; i++) {
      const offset = i - currentDayIndex;
      let scale = 0.9;

      if (i === currentDayIndex) {
        scale = 1 - Math.abs(diff) / 600;
      } else if (i === currentDayIndex - 1 || i === currentDayIndex + 1) {
        scale = 0.9 + Math.abs(diff) / 600;
      }

      pages[i].style.transform = `scale(${scale})`;
    }
  });

  slider.addEventListener("touchend", () => {
    // ⭐ 慣性滑動
    if (velocity < -5 && currentDayIndex < project.days.length - 1) {
      currentDayIndex++;
    } else if (velocity > 5 && currentDayIndex > 0) {
      currentDayIndex--;
    }

    updateSlider();
  });

  function updateSlider() {
    track.style.transition = "transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)";
    track.style.transform = `translateX(-${currentDayIndex * 85}%)`;

    const pages = track.children;
    for (let i = 0; i < pages.length; i++) {
      pages[i].style.transform = i === currentDayIndex ? "scale(1)" : "scale(0.9)";
    }

    // 更新 dots
    dots.innerHTML = "";
    project.days.forEach((_, i) => {
      const dot = document.createElement("span");
      dot.style.display = "inline-block";
      dot.style.width = "6px";
      dot.style.height = "6px";
      dot.style.margin = "0 4px";
      dot.style.borderRadius = "50%";
      dot.style.background = i === currentDayIndex ? "#000" : "#ccc";
      dots.appendChild(dot);
    });
  }

  updateSlider();

  // =================
  // 🔘 箭頭（浮動 iOS）
  // =================
  const arrowStyle = `
    position:fixed;
    top:50%;
    transform:translateY(-50%);
    background:rgba(255,255,255,0.8);
    backdrop-filter:blur(10px);
    border:none;
    border-radius:50%;
    padding:12px;
    font-size:18px;
    box-shadow:0 4px 10px rgba(0,0,0,0.1);
  `;

  const leftBtn = document.createElement("button");
  leftBtn.innerText = "←";
  leftBtn.style.cssText = arrowStyle + "left:10px;";
  leftBtn.onclick = () => {
    if (currentDayIndex > 0) {
      currentDayIndex--;
      updateSlider();
    }
  };

  const rightBtn = document.createElement("button");
  rightBtn.innerText = "→";
  rightBtn.style.cssText = arrowStyle + "right:10px;";
  rightBtn.onclick = () => {
    if (currentDayIndex < project.days.length - 1) {
      currentDayIndex++;
      updateSlider();
    }
  };

  container.appendChild(leftBtn);
  container.appendChild(rightBtn);
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
