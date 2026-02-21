const API_URL = "https://script.google.com/macros/s/AKfycbz5z5FS1zxQPShsh52pG8L45cKqMwqvUZ3ApK3PnIjLmasYYeUMWXArHLGwhJfI7LgL/exec";

let appData = null;
let openState = {}; // ⭐記住展開狀態

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
        date: d.date,
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
  container.style.padding = "16px";
  container.style.background = "#f2f2f7";
  container.style.fontFamily = "-apple-system";
  container.style.fontSize = "18px";

  const project = appData.projects[0];

  // =================
  // 💰 花費統計
  // =================
  let total = 0;
  let stats = {};

  project.days.forEach(day => {
    day.activities.forEach(a => {
      if (a.done) {
        total += a.cost;

        if (!stats[a.category]) stats[a.category] = 0;
        stats[a.category] += a.cost;
      }
    });
  });

  // =================
  // 💰 總卡片
  // =================
  const budget = document.createElement("div");
  budget.style.background = "#fff";
  budget.style.padding = "16px";
  budget.style.borderRadius = "16px";
  budget.style.marginBottom = "16px";
  budget.style.boxShadow = "0 4px 10px rgba(0,0,0,0.06)";

  budget.innerHTML = `💰 ¥${total} / ¥${project.budget.total}<br>`;

  for (let k in stats) {
    budget.innerHTML += `📊 ${k}：¥${stats[k]}<br>`;
  }

  container.appendChild(budget);

  // =================
  // 🗓 每日卡片
  // =================
  project.days.forEach((day, index) => {

    if (openState[index] === undefined) openState[index] = true;

    const card = document.createElement("div");
    card.style.background = "#fff";
    card.style.borderRadius = "18px";
    card.style.marginBottom = "16px";
    card.style.boxShadow = "0 6px 16px rgba(0,0,0,0.08)";
    card.style.overflow = "hidden";

    const doneCount = day.activities.filter(a => a.done).length;

    // 📌 header
    const header = document.createElement("div");
    header.style.padding = "16px";
    header.style.fontWeight = "600";
    header.style.fontSize = "20px";
    header.style.cursor = "pointer";
    header.style.background = "#fafafa";

    header.innerText = `${day.title} (${doneCount}/${day.activities.length})`;

    header.onclick = () => {
      openState[index] = !openState[index];
      render();
    };

    card.appendChild(header);

    const content = document.createElement("div");
    content.style.display = openState[index] ? "block" : "none";

    // =================
    // 📌 行程
    // =================
    day.activities.forEach(act => {

      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.justifyContent = "space-between";
      row.style.alignItems = "center";
      row.style.padding = "12px 16px";
      row.style.borderTop = "1px solid #eee";

      const left = document.createElement("div");
      left.style.display = "flex";
      left.style.alignItems = "center";
      left.style.gap = "8px";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = act.done;
      cb.style.transform = "scale(1.3)";

      cb.onchange = async () => {
        act.done = cb.checked;
        render();
        await updateActivity(act.id, cb.checked);
      };

      // 🏷 分類標籤
      const tag = document.createElement("span");
      tag.innerText = act.category;
      tag.style.fontSize = "12px";
      tag.style.padding = "3px 6px";
      tag.style.borderRadius = "6px";

      if (act.category === "食物") tag.style.background = "#ffe4e6";
      else if (act.category === "景點") tag.style.background = "#e0f2fe";
      else if (act.category === "交通") tag.style.background = "#fef9c3";
      else if (act.category === "飯店") tag.style.background = "#dcfce7";

      const text = document.createElement("span");
      text.innerText = `${act.name} ¥${act.cost}`;

      if (act.done) {
        text.style.textDecoration = "line-through";
        text.style.color = "#999";
      }

      left.appendChild(cb);
      left.appendChild(tag);
      left.appendChild(text);

      // 📍 地圖
      const mapBtn = document.createElement("button");
      mapBtn.innerText = "📍";
      mapBtn.style.border = "none";
      mapBtn.style.background = "#eee";
      mapBtn.style.borderRadius = "10px";
      mapBtn.style.padding = "6px 10px";

      mapBtn.onclick = () => {
        if (act.map) window.open(act.map, "_blank");
      };

      row.appendChild(left);
      row.appendChild(mapBtn);

      content.appendChild(row);
    });

    card.appendChild(content);
    container.appendChild(card);
  });
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
