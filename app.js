const API_URL = "https://script.google.com/macros/s/AKfycbz5z5FS1zxQPShsh52pG8L45cKqMwqvUZ3ApK3PnIjLmasYYeUMWXArHLGwhJfI7LgL/exec";

let appData = null;

// ✅ Loading
function renderLoading() {
  document.getElementById("app").innerHTML = "⏳ 讀取中...";
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

// ✅ 轉換資料
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

// ✅ UI渲染
function render() {
  const container = document.getElementById("app");
  container.innerHTML = "";
  container.style.fontFamily = "-apple-system, sans-serif";
  container.style.padding = "15px";
  container.style.background = "#f5f5f7";

  const project = appData.projects[0];

  // 💰 計算花費
  let total = 0;
  project.days.forEach(day => {
    day.activities.forEach(a => {
      if (a.done) total += a.cost;
    });
  });

  // 💰 預算卡
  const budgetCard = document.createElement("div");
  budgetCard.style.background = "#fff";
  budgetCard.style.padding = "15px";
  budgetCard.style.borderRadius = "16px";
  budgetCard.style.marginBottom = "15px";
  budgetCard.style.boxShadow = "0 4px 10px rgba(0,0,0,0.05)";

  const percent = project.budget.total
    ? Math.min(100, (total / project.budget.total) * 100)
    : 0;

  budgetCard.innerHTML = `
    <div style="font-weight:bold;margin-bottom:5px;">💰 預算</div>
    <div>¥${total} / ¥${project.budget.total}</div>
    <div style="height:8px;background:#eee;border-radius:10px;margin-top:8px;">
      <div style="
        width:${percent}%;
        height:100%;
        background:#007aff;
        border-radius:10px;
      "></div>
    </div>
  `;

  container.appendChild(budgetCard);

  // 📌 標題
  const title = document.createElement("h2");
  title.innerText = project.name;
  title.style.marginBottom = "15px";
  container.appendChild(title);

  const today = new Date().toISOString().slice(0, 10);

  // 📅 每一天
  project.days.forEach(day => {
    const isToday = day.date.includes(today);

    const card = document.createElement("div");
    card.style.background = isToday ? "#e8f0ff" : "#fff";
    card.style.borderRadius = "16px";
    card.style.padding = "15px";
    card.style.marginBottom = "15px";
    card.style.boxShadow = "0 4px 12px rgba(0,0,0,0.06)";

    const doneCount = day.activities.filter(a => a.done).length;

    const h3 = document.createElement("h3");
    h3.innerText = `${day.date.slice(0,10)}｜${day.title} (${doneCount}/${day.activities.length})`;
    h3.style.marginBottom = "10px";
    card.appendChild(h3);

    day.activities.forEach(act => {
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.marginBottom = "6px";

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
