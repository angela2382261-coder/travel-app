const API_URL = "https://script.google.com/macros/s/AKfycbz5z5FS1zxQPShsh52pG8L45cKqMwqvUZ3ApK3PnIjLmasYYeUMWXArHLGwhJfI7LgL/exec";

let appData = null;

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

async function init() {
  const sheetData = await loadFromSheet();
  appData = convertSheetToAppData(sheetData);
  render();
}

init();

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
      budget: {},
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
            cost: Number(a.cost),
            done: a.done === true || a.done === "TRUE"
          }))
      }));

    const m = meta.find(m => m.projectId === p.projectId);
    if (m) {
      project.budget = {
        total: Number(m.budgetTotal),
        spent: Number(m.budgetSpent)
      };
    }

    result.projects.push(project);
  });

  return result;
}

function render() {
  const container = document.getElementById("app");
  container.innerHTML = "";

  const project = appData.projects[0];

  const title = document.createElement("h2");
  title.innerText = project.name;
  container.appendChild(title);

  project.days.forEach(day => {
    const div = document.createElement("div");

    const h3 = document.createElement("h3");
    h3.innerText = `${day.date}｜${day.title}`;
    div.appendChild(h3);

    day.activities.forEach(act => {
      const row = document.createElement("div");

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = act.done;

      cb.onchange = () => {
        updateActivity(act.id, cb.checked);
      };

      row.appendChild(cb);
      row.append(` ${act.name} ¥${act.cost}`);

      div.appendChild(row);
    });

    container.appendChild(div);
  });
}

async function updateActivity(activityId, done) {
  await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      type: "updateActivity",
      activityId,
      done
    })
  });
}
