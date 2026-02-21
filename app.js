const API_URL =
  "https://script.google.com/macros/s/AKfycbz5z5FS1zxQPShsh52pG8L45cKqMwqvUZ3ApK3PnIjLmasYYeUMWXArHLGwhJfI7LgL/exec";

let appData = null;
let currentTab = "plan";
let currentDayIndex = 0;

let dragItem = null;
let dragging = false;
let dragStartY = 0;

// ===== init =====
init();

async function init() {
  document.getElementById("app").innerHTML = "⏳ 讀取中...";
  const data = await loadFromSheet();
  appData = convert(data);
  render();
}

// ===== JSONP =====
function loadFromSheet() {
  return new Promise((resolve) => {
    const cb = "jsonp_" + Date.now();
    window[cb] = (d) => {
      resolve(d);
      delete window[cb];
    };
    const s = document.createElement("script");
    s.src = API_URL + "?callback=" + cb;
    document.body.appendChild(s);
  });
}

// ===== convert =====
function convert(data) {
  const { projects, days, activities, meta } = data;

  return {
    projects: projects.map((p) => ({
      id: p.projectId,
      name: p.name,
      budget: {
        total: Number(meta.find((m) => m.projectId === p.projectId)?.budgetTotal || 0),
      },
      days: days
        .filter((d) => d.projectId === p.projectId)
        .map((d) => ({
          title: d.title,
          activities: activities
            .filter((a) => a.dayId === d.dayId)
            .map((a) => ({
              id: a.activityId,
              name: a.name,
              cost: Number(a.cost) || 0,
              done: a.done === true || a.done === "TRUE",
              category: a.category || "其他",
              map: a.map || "",
              note: a.note || "",
            })),
        })),
    })),
  };
}

// ===== render =====
function render() {
  const app = document.getElementById("app");
  app.innerHTML = "";
  app.style.background = "#f2f2f7";
  app.style.minHeight = "100vh";
  app.style.paddingBottom = "90px";

  if (currentTab === "plan") renderPlan(app);
  else renderStats(app);

  renderTabBar();
}

// ===== 行程 =====
function renderPlan(container) {
  const project = appData.projects[0];

  const slider = document.createElement("div");
  slider.style.overflow = "hidden";

  const track = document.createElement("div");
  track.style.display = "flex";
  track.style.transition = "0.35s ease";
  slider.appendChild(track);

  // ⭐ iOS 卡片尺寸
  const pageWidth = Math.round(window.innerWidth * 0.88);
  const gap = Math.round(window.innerWidth * 0.06);
  const step = pageWidth + gap;

  project.days.forEach((day) => {
    const page = document.createElement("div");
    page.style.width = pageWidth + "px";
    page.style.marginLeft = gap / 2 + "px";
    page.style.marginRight = gap / 2 + "px";
    page.style.flexShrink = "0";

    const card = document.createElement("div");
    card.style.background = "#fff";
    card.style.borderRadius = "24px";
    card.style.padding = "16px";

    const title = document.createElement("h2");
    title.innerText = day.title;
    card.appendChild(title);

    day.activities.forEach((act) => {
      const row = document.createElement("div");
      row.dataset.id = act.id;

      row.style.padding = "14px 0";
      row.style.borderTop = "1px solid #eee";

      // ===== 長按拖曳 =====
      let pressTimer;
      let startY = 0;

      row.addEventListener("touchstart", (e) => {
        const t = e.touches[0];
        startY = t.clientY;

        pressTimer = setTimeout(() => {
          dragging = true;
          dragItem = row;
          dragStartY = t.clientY;

          row.style.opacity = "0.5";
          row.style.transform = "scale(1.05)";
        }, 400);
      });

      row.addEventListener("touchmove", (e) => {
        const t = e.touches[0];

        if (!dragging && Math.abs(t.clientY - startY) > 10) {
          clearTimeout(pressTimer);
        }

        if (dragging && dragItem) {
          e.preventDefault();

          const moveY = t.clientY - dragStartY;
          dragItem.style.transform = `translateY(${moveY}px) scale(1.05)`;

          handleReorder(card);
        }
      }, { passive: false });

      row.addEventListener("touchend", () => {
        clearTimeout(pressTimer);

        if (dragging) finishDrag(day, card);

        dragging = false;
        dragItem = null;
      });

      // ===== UI =====
      const top = document.createElement("div");
      top.style.display = "flex";
      top.style.gap = "12px";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = act.done;

      const info = document.createElement("div");

      const name = document.createElement("div");
      name.innerText = act.name;
      name.style.fontWeight = "700";

      const price = document.createElement("div");
      price.innerText = `¥${act.cost}`;
      price.style.background = "#e0f2fe";
      price.style.padding = "6px 12px";
      price.style.borderRadius = "999px";

      info.appendChild(name);
      info.appendChild(price);

      if (act.note) {
        const note = document.createElement("div");
        note.innerText = act.note;
        note.style.fontSize = "13px";
        note.style.color = "#666";
        info.appendChild(note);
      }

      top.appendChild(cb);
      top.appendChild(info);
      row.appendChild(top);
      card.appendChild(row);
    });

    page.appendChild(card);
    track.appendChild(page);
  });

  container.appendChild(slider);

  // ===== ⭐ 核心修正（不會跑掉） =====
  function snap() {
    track.style.transform = `translateX(-${currentDayIndex * step}px)`;
  }

  requestAnimationFrame(snap);

  // ===== 滑動 =====
  let startX = 0;

  slider.ontouchstart = (e) => {
    startX = e.touches[0].clientX;
  };

  slider.ontouchend = (e) => {
    const diff = startX - e.changedTouches[0].clientX;

    if (diff > 50) currentDayIndex++;
    if (diff < -50) currentDayIndex--;

    currentDayIndex = Math.max(0, Math.min(currentDayIndex, project.days.length - 1));

    snap();
  };
}

// ===== 拖曳排序 =====
function handleReorder(card) {
  const rows = Array.from(card.querySelectorAll("[data-id]"))
    .filter((el) => el !== dragItem);

  for (let target of rows) {
    const rect = target.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;

    if (dragItem.getBoundingClientRect().top < mid) {
      card.insertBefore(dragItem, target);
      return;
    }
  }

  card.appendChild(dragItem);
}

function finishDrag(day, card) {
  const rows = Array.from(card.querySelectorAll("[data-id]"));

  day.activities = rows.map((r) =>
    day.activities.find((a) => a.id == r.dataset.id)
  );

  dragItem.style.transform = "";
  dragItem.style.opacity = "1";

  render();
}

// ===== tab =====
function renderTabBar() {
  const old = document.querySelector(".tabbar");
  if (old) old.remove();

  const bar = document.createElement("div");
  bar.style.position = "fixed";
  bar.style.bottom = "0";
  bar.style.width = "100%";
  bar.style.display = "flex";
  bar.style.background = "#fff";

  ["plan", "stats"].forEach((k) => {
    const t = document.createElement("div");
    t.innerText = k === "plan" ? "行程" : "統計";
    t.style.flex = 1;
    t.style.textAlign = "center";
    t.onclick = () => {
      currentTab = k;
      render();
    };
    bar.appendChild(t);
  });

  document.body.appendChild(bar);
}

// ===== stats =====
function renderStats(container) {
  container.innerHTML = "📊 統計功能";
}
