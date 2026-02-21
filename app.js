const API_URL = "https://script.google.com/macros/s/AKfycbz5z5FS1zxQPShsh52pG8L45cKqMwqvUZ3ApK3PnIjLmasYYeUMWXArHLGwhJfI7LgL/exec";

let appData = null;

// ✅ Loading
function renderLoading() {
  document.getElementById("app").innerHTML = "⏳ 讀取資料中...";
}

// ✅ JSONP
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

// ✅ 初始化
async function init() {
  renderLoading();
  const sheetData = await loadFromSheet();
  appData = convertSheetToAppData(sheetData);
  render();
}

init();

// ✅ 資料轉換
function convertSheetToAppData(data) {
  const { projects, days, activities, meta } = data;

  const result = {
    currentProjectId: projects[0].projectId,
    projects: []
  };

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
            done: a.done === true || a.done === "TRUE"
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

// ✅ UI 渲染（重點升級版）
function render() {
  const container = document.getElementById("app");

  // ⭐ App 背景
  document.body.style.background = "#f5f6f8";
  document.body.style.fontFamily = "-apple-system, BlinkMacSystemFont, sans-serif";

  container.innerHTML = "";
  container.style.maxWidth = "500px";
  container.style.margin = "0 auto";
  container.style.padding = "15px";

  const project = appData.projects[0];

  // ✅ 計算花費
  let total = 0;
  project.days.forEach(day => {
    day.activities.forEach(a => {
      if (a.done) total += a.cost;
    });
  });

  // ✅ 預算卡片（升級）
  const budget = document.createElement("div");
  budget.style.background = "#ffffff";
  budget.style.borderRadius = "16px";
  budget.style.padding = "15px";
  budget.style.marginBottom = "15px";
  budget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
  budget.innerHTML = `💰 已花：¥${total} / ¥${project.budget.total}`;
  container.appendChild(budget);

  // ✅ 標題
  const title = document.createElement("h2");
  title.innerText = project.name;
  title.style.marginBottom = "15px";
  container.appendChild(title);

  // ✅ 每一天（卡片）
  project.days.forEach(day => {
    const div = document.createElement("div");

    // ⭐ 強化卡片感
    div.style.background = "#ffffff";
    div.style.borderRadius = "16px";
    div.style.padding = "15px";
    div.style.marginBottom = "15px";
    div.style.boxShadow = "0 6px 16px rgba(0,0,0,0.08)";

    const doneCount = day.activities.filter(a => a.done).length;

    const h3 = document.createElement("h3");
    h3.innerText = `${day.date}｜${day.title} (${doneCount}/${day.activities.length})`;
    h3.style.marginBottom = "10px";
    div.appendChild(h3);

    // ✅ 活動列表
    day.activities.forEach(act => {
      const row = document.createElement("div");

      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.padding = "8px 0";
      row.style.borderBottom = "1px solid #eee";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = act.done;
      cb.style.marginRight = "10px";

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

      row.appendChild(cb);
      row.appendChild(text);

      div.appendChild(row);
    });

    container.appendChild(div);
  });
}

// ✅ 更新
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
