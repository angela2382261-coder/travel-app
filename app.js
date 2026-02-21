const API_URL = "https://script.google.com/macros/s/AKfycbz5z5FS1zxQPShsh52pG8L45cKqMwqvUZ3ApK3PnIjLmasYYeUMWXArHLGwhJfI7LgL/exec";

let appData = null;

// =================
// ⏳ Loading
// =================
function renderLoading() {
  document.getElementById("app").innerHTML = "⏳ 讀取中...";
}

// =================
// 🔹 JSONP（解決 CORS）
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
  appData = convertSheetToAppData(sheetData);
  render();
}

init();

// =================
// 🔄 資料轉換（完整版）
// =================
function convertSheetToAppData(data) {
  const { projects, days, activities, meta } = data;

  const result = {
    projects: []
  };

  projects.forEach(p => {
    const project = {
      id: p.projectId,
      name: p.name,
      days: [],
      budget: { total: 0 }
    };

    // 📅 天數
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
  category: a.category || "其他"   // ⭐加這行
}))
      }));

    // 💰 預算
    const m = meta.find(m => m.projectId === p.projectId);
    if (m) {
      project.budget.total = Number(m.budgetTotal) || 0;
    }

    result.projects.push(project);
  });

  return result;
}

// =================
// 🎨 畫面
// =================
function render() {
  const container = document.getElementById("app");
  container.innerHTML = "";
  container.style.padding = "15px";
  container.style.fontFamily = "-apple-system";

  const project = appData.projects[0];

  // =================
  // 💰 總花費
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

  const budget = document.createElement("div");
  budget.style.background = "#fff";
  budget.style.padding = "12px";
  budget.style.borderRadius = "12px";
  budget.style.marginBottom = "15px";
  budget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.05)";

  budget.innerHTML = `💰 總花費：¥${total} / ¥${project.budget.total}<br>`;

  for (let k in stats) {
    budget.innerHTML += `📊 ${k}：¥${stats[k]}<br>`;
  }

  container.appendChild(budget);

  // =================
  // 🗓 行程
  // =================
  project.days.forEach(day => {
    const card = document.createElement("div");

    card.style.background = "#fff";
    card.style.borderRadius = "16px";
    card.style.padding = "15px";
    card.style.marginBottom = "15px";
    card.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";

    const doneCount = day.activities.filter(a => a.done).length;

    const title = document.createElement("h3");
    title.innerText = `${day.title} (${doneCount}/${day.activities.length})`;
    card.appendChild(title);

    day.activities.forEach(act => {
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.justifyContent = "space-between";
      row.style.marginBottom = "8px";

      const left = document.createElement("div");

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = act.done;

      // ⭐ 即時 UI 更新
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

      // 🗺 地圖按鈕
      const mapBtn = document.createElement("button");
      mapBtn.innerText = "📍";
      mapBtn.style.border = "none";
      mapBtn.style.background = "#eee";
      mapBtn.style.borderRadius = "8px";
      mapBtn.onclick = () => {
        if (act.map) window.open(act.map, "_blank");
      };

      row.appendChild(left);
      row.appendChild(mapBtn);

      card.appendChild(row);
    });

    container.appendChild(card);
  });
}

// =================
// 🔄 更新 Sheet
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
