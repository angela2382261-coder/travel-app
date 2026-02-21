const API_URL = "https://script.google.com/macros/s/AKfycbz5z5FS1zxQPShsh52pG8L45cKqMwqvUZ3ApK3PnIjLmasYYeUMWXArHLGwhJfI7LgL/exec";

let appData = null;
let openState = {};
let currentTab = "plan"; // plan / stats

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

  let total = 0;
  project.days.forEach(day => {
    day.activities.forEach(a => {
      if (a.done) total += a.cost;
    });
  });

  const budget = document.createElement("div");
  budget.className = "budget";
  budget.innerHTML = `💰 ¥${total} / ¥${project.budget.total}`;
  container.appendChild(budget);

  project.days.forEach((day, index) => {

    if (openState[index] === undefined) openState[index] = true;

    const card = document.createElement("div");
    card.className = "card";

    const doneCount = day.activities.filter(a => a.done).length;

    const header = document.createElement("div");
    header.className = "header";
    header.innerText = `${day.title} (${doneCount}/${day.activities.length})`;

    const content = document.createElement("div");
    content.className = "content";
    if (openState[index]) content.classList.add("open");

    header.onclick = () => {
      openState[index] = !openState[index];
      render();
    };

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

      const tag = document.createElement("span");
      tag.className = "tag";
      tag.innerText = act.category;

      if (act.category === "食物") tag.classList.add("food");
      else if (act.category === "景點") tag.classList.add("spot");
      else if (act.category === "交通") tag.classList.add("transport");
      else if (act.category === "飯店") tag.classList.add("hotel");
      else tag.classList.add("other");

      const text = document.createElement("span");
      text.innerText = `${act.name} ¥${act.cost}`;

      if (act.done) {
        text.style.textDecoration = "line-through";
        text.style.color = "#999";
      }

      left.appendChild(cb);
      left.appendChild(tag);
      left.appendChild(text);

      const mapBtn = document.createElement("button");
      mapBtn.className = "mapBtn";
      mapBtn.innerText = "📍";
      mapBtn.onclick = () => {
        if (act.map) window.open(act.map, "_blank");
      };

      row.appendChild(left);
      row.appendChild(mapBtn);
      content.appendChild(row);
    });

    card.appendChild(header);
    card.appendChild(content);
    container.appendChild(card);
  });
}
 function renderStats(container) {
  const project = appData.projects[0];

  let stats = {};
  let total = 0;

  project.days.forEach(day => {
    day.activities.forEach(a => {
      if (a.done) {
        total += a.cost;

        if (!stats[a.category]) stats[a.category] = 0;
        stats[a.category] += a.cost;
      }
    });
  });

  const card = document.createElement("div");
  card.className = "card";

  const content = document.createElement("div");
  content.style.padding = "16px";

  content.innerHTML = `<h3>📊 花費統計</h3>`;

  for (let k in stats) {
    const row = document.createElement("div");
    row.innerText = `${k}：¥${stats[k]}`;
    row.style.marginBottom = "8px";
    content.appendChild(row);
  }

  const totalDiv = document.createElement("div");
  totalDiv.style.marginTop = "10px";
  totalDiv.innerHTML = `💰 總計：¥${total}`;
  content.appendChild(totalDiv);

  card.appendChild(content);
  container.appendChild(card);
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
