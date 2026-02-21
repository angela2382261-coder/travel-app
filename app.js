const API_URL = "https://script.google.com/macros/s/AKfycbz5z5FS1zxQPShsh52pG8L45cKqMwqvUZ3ApK3PnIjLmasYYeUMWXArHLGwhJfI7LgL/exec";

let appData = null;

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
  appData = convertSheetToAppData(sheetData);
  render();
}

init();

// =================
// 🔄 資料轉換
// =================
function convertSheetToAppData(data) {
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
  container.style.padding = "15px";
  container.style.background = "#f5f5f5";

  const project = appData.projects[0];

  // =================
  // 📊 花費統計
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
  // 📊 圓餅圖卡片
  // =================
  const chartCard = document.createElement("div");
  chartCard.style.background = "#fff";
  chartCard.style.borderRadius = "16px";
  chartCard.style.padding = "15px";
  chartCard.style.marginBottom = "15px";
  chartCard.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";

  const canvas = document.createElement("canvas");
  canvas.width = 200;
  canvas.height = 200;

  const ctx = canvas.getContext("2d");

  let start = 0;
  const colors = ["#60a5fa", "#f87171", "#34d399", "#fbbf24", "#c084fc"];

  let i = 0;
  for (let k in stats) {
    const value = stats[k];
    const angle = (value / total) * Math.PI * 2;

    ctx.beginPath();
    ctx.moveTo(100, 100);
    ctx.fillStyle = colors[i % colors.length];
    ctx.arc(100, 100, 80, start, start + angle);
    ctx.fill();

    start += angle;
    i++;
  }

  chartCard.appendChild(canvas);

  // =================
  // 📊 分類文字（重點升級✨）
  // =================
  i = 0;
  for (let k in stats) {
    const item = document.createElement("div");
    item.innerHTML = `⬤ ${k}：¥${stats[k]}`;
    item.style.color = colors[i % colors.length];
    chartCard.appendChild(item);
    i++;
  }

  // =================
  // 💰 總金額
  // =================
  const totalText = document.createElement("div");
  totalText.style.marginTop = "10px";
  totalText.innerHTML = `💰 總花費：¥${total} / ¥${project.budget.total}`;
  chartCard.appendChild(totalText);

  container.appendChild(chartCard);

  // =================
  // 🗓 行程卡片
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

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = act.done;

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

      row.appendChild(cb);
      row.appendChild(text);
      card.appendChild(row);
    });

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
