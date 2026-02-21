const API_URL = "https://script.google.com/macros/s/AKfycbz5z5FS1zxQPShsh52pG8L45cKqMwqvUZ3ApK3PnIjLmasYYeUMWXArHLGwhJfI7LgL/exec";

let appData = null;

// ✅ Loading
function renderLoading() {
  document.getElementById("app").innerHTML = "⏳ 讀取資料中...";
}

// ✅ JSONP 讀資料（解決 CORS）
function loadFromSheet() {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    const callbackName = "jsonpCallback_" + Date.now();

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
      budget: { total: 0 },
      luggage: {}
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

// ✅ 畫面渲染
function render() {
  const container = document.getElementById("app");
  container.innerHTML = "";

  const project = appData.projects[0];

  // ✅ 計算總花費
  let total = 0;
  project.days.forEach(day => {
    day.activities.forEach(a => {
      if (a.done) total += a.cost;
    });
  });

  // ✅ 預算
  const budget = document.createElement("div");
  budget.style.marginBottom = "10px";
  budget.innerHTML = `💰 已花：¥${total} / ¥${project.budget.total}`;
  container.appendChild(budget);

  // ✅ 標題
  const title = document.createElement("h2");
  title.innerText = project.name;
  container.appendChild(title);

  // ✅ 每一天
  project.days.forEach(day => {
    const div = document.createElement("div");

    // 卡片樣式
    div.style.border = "1px solid #ddd";
    div.style.borderRadius = "10px";
    div.style.padding = "10px";
    div.style.marginBottom = "10px";

    // ✅ 完成數
    const doneCount = day.activities.filter(a => a.done).length;

    const h3 = document.createElement("h3");
    h3.innerText = `${day.date}｜${day.title} (${doneCount}/${day.activities.length})`;
    div.appendChild(h3);

    // ✅ 活動
    day.activities.forEach(act => {
      const row = document.createElement("div");

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = act.done;

      // ⭐ 修正：立即更新 UI
      cb.onchange = async () => {
        act.done = cb.checked;
        render();
        await updateActivity(act.id, cb.checked);
      };

      row.appendChild(cb);

      const text = document.createElement("span");
      text.innerText = ` ${act.name} ¥${act.cost}`;

      if (act.done) {
        text.style.textDecoration = "line-through";
        text.style.color = "#999";
      }

      row.appendChild(text);
      div.appendChild(row);
    });

    container.appendChild(div);
  });
}

// ✅ 更新資料（寫回 Sheet）
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
