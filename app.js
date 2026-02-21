const API_URL = "https://script.google.com/macros/s/AKfycbz5z5FS1zxQPShsh52pG8L45cKqMwqvUZ3ApK3PnIjLmasYYeUMWXArHLGwhJfI7LgL/exec";

let appData = null;
let openState = {};

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

  const project = appData.projects[0];

  // =================
  // 💰 花費
  // =================
  let total = 0;
  let stats = {};

  project.days.forEach(day => {
    day.activities.forEach(a => {
      if (a.done) {
        total += a.cost;
        stats[a.category] = (stats[a.category] || 0) + a.cost;
      }
    });
  });

  // =================
  // 💰 預算卡
  // =================
  const budget = document.createElement("div");
  budget.className = "budget";

  let html = `💰 ¥${total} / ¥${project.budget.total}<br>`;
  for (let k in stats) {
    html += `📊 ${k}：¥${stats[k]}<br>`;
  }

  budget.innerHTML = html;
  container.appendChild(budget);

  // =================
  // 🗓 卡片
  // =================
  project.days.forEach((day, index) => {

    if (openState[index] === undefined) openState[index] = true;

    const card = document.createElement("div");
    card.className = "card";

    const doneCount = day.activities.filter(a => a.done).length;

    const header = document.createElement("div");
    header.className = "header";
    header.innerText = `${day.title} (${doneCount}/${day.activities.length})`;

    header.onclick = () => {
      openState[index] = !openState[index];
      render();
    };

    card.appendChild(header);

    const content = document.createElement("div");
    content.style.display = openState[index] ? "block" : "none";

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

// 顯示文字（中文）
tag.innerText = act.category;

// class 用英文（穩定）
let cls = "other";

if (act.category === "食物") cls = "food";
else if (act.category === "景點") cls = "spot";
else if (act.category === "交通") cls = "transport";
else if (act.category === "飯店") cls = "hotel";

tag.className = "tag " + cls;

      const text = document.createElement("span");
      text.innerText = `${act.name} ¥${act.cost}`;

      if (act.done) {
        text.className = "done";
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
