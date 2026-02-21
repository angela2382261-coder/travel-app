const API_URL =
  "https://script.google.com/macros/s/AKfycbz5z5FS1zxQPShsh52pG8L45cKqMwqvUZ3ApK3PnIjLmasYYeUMWXArHLGwhJfI7LgL/exec";

let appData = null;
let currentTab = "plan";
let currentDayIndex = 0;
let dragItem = null;
let dragStartY = 0;
let dragging = false;

// ====== resize debounce（只留一份）======
let resizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    render(); // 會自動回到 currentDayIndex
  }, 150);
});

// =================
// 🚀 初始化（只呼叫一次）
// =================
init();

async function init() {
  const app = document.getElementById("app");
  if (app) app.innerHTML = "⏳ 讀取中...";

  const data = await loadFromSheet();
  appData = convert(data);
  render();
}

// =================
// JSONP
// =================
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

// =================
// 資料轉換
// =================
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

// =================
// 交通 tag
// =================
function parseNoteTags(note) {
  if (!note) return [];
  const t = [];
  const s = String(note);
  if (s.includes("JR")) t.push("🚆 JR");
  if (s.includes("地鐵")) t.push("🚇 地鐵");
  if (s.includes("巴士")) t.push("🚌 巴士");
  if (s.includes("步行")) t.push("🚶 步行");
  return t;
}

// =================
// 主 render
// =================
function render() {
  const app = document.getElementById("app");
  if (!app || !appData) return;

  app.innerHTML = "";
  app.style.background = "#f2f2f7";
  app.style.minHeight = "100vh";
  app.style.paddingBottom = "90px";

  if (currentTab === "plan") renderPlan(app);
  else renderStats(app);

  renderTabBar();
}

// =================
// 行程頁（修正：換頁不跑、tab 切回來也不跑）
// =================
function renderPlan(container) {
  const project = appData.projects[0];

  // 外層 slider
  const slider = document.createElement("div");
  slider.style.overflow = "hidden";
  slider.style.position = "relative";

  // 內層 track
  const track = document.createElement("div");
  track.style.display = "flex";
  track.style.willChange = "transform";
  track.style.transition = "transform 0.4s ease";
  slider.appendChild(track);

  // pages
  project.days.forEach((day) => {
    const page = document.createElement("div");
    page.style.minWidth = "100%";
    page.style.padding = "12px";
    page.style.boxSizing = "border-box";

    const card = document.createElement("div");
    card.style.background = "#fff";
    card.style.borderRadius = "20px";
    card.style.padding = "16px";
    card.style.boxShadow = "0 10px 26px rgba(0,0,0,0.06)";

    const title = document.createElement("h2");
    title.innerText = day.title;
    title.style.margin = "0 0 12px";
    title.style.fontSize = "28px";
    title.style.fontWeight = "900";
    card.appendChild(title);

    day.activities.forEach((act) => {
      const row = document.createElement("div");
    row.dataset.id = act.id;  // ⭐⭐⭐ 就放這裡 ⭐⭐⭐
      row.style.display = "flex";
      row.style.flexDirection = "column";
      row.style.padding = "14px 0";
      row.style.borderTop = "1px solid #eee";
      row.style.webkitUserSelect = "none";
      row.style.userSelect = "none";

      // ===== 長按（滑動就取消）=====
      let pressTimer;
let startX = 0;
let startY = 0;

row.addEventListener("touchstart", (e) => {
  const t = e.touches[0];
  startX = t.clientX;
  startY = t.clientY;

  pressTimer = setTimeout(() => {
    // ⭐ 進入拖曳模式
    dragging = true;
    dragItem = row;
    dragStartY = t.clientY;

    row.style.opacity = "0.5";
    row.style.transform = "scale(1.05)";
    row.style.zIndex = "10";
  }, 400);
});

row.addEventListener("touchmove", (e) => {
  const t = e.touches[0];

  const dx = Math.abs(t.clientX - startX);
  const dy = Math.abs(t.clientY - startY);

  // 👉 滑動取消長按
  if (!dragging && (dx > 10 || dy > 10)) {
    clearTimeout(pressTimer);
    return;
  }

  // ⭐ 拖曳中
  if (dragging && dragItem) {
    e.preventDefault();

    const moveY = t.clientY - dragStartY;
    dragItem.style.transform = `translateY(${moveY}px) scale(1.05)`;

    handleReorder(card, act, moveY);
  }
}, { passive: false });

row.addEventListener("touchend", () => {
  clearTimeout(pressTimer);

  if (dragging) {
    finishDrag(day);
  }

  dragging = false;
  dragItem = null;
});

      // ===== 上排 top =====
      const top = document.createElement("div");
      top.style.display = "flex";
      top.style.alignItems = "flex-start";
      top.style.gap = "12px";

      const left = document.createElement("div");
      left.style.display = "flex";
      left.style.gap = "12px";
      left.style.flex = "1";
      left.style.minWidth = "0"; // ⭐很重要：避免 map 被擠走

      // checkbox
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = act.done;
      cb.style.transform = "scale(1.25)";
      cb.style.marginTop = "6px";
      cb.style.flexShrink = "0";

      cb.onchange = async () => {
        act.done = cb.checked;
        render();
        await updateActivity(act.id, cb.checked);
      };

      // info
      const info = document.createElement("div");
      info.style.minWidth = "0";
      info.style.flex = "1";

      const name = document.createElement("div");
      name.innerText = act.name;
      name.style.fontWeight = "800";
      name.style.fontSize = "20px";
      name.style.wordBreak = "break-word";

      const price = document.createElement("div");
      price.innerText = `¥${Number(act.cost || 0).toLocaleString()}`;
      price.style.background = "#e0f2fe";
      price.style.color = "#075985";
      price.style.display = "inline-block";
      price.style.padding = "6px 12px";
      price.style.borderRadius = "999px";
      price.style.marginTop = "8px";
      price.style.fontWeight = "800";

      info.appendChild(name);
      info.appendChild(price);

      // note（原始備註要保留）
      if (act.note) {
        const note = document.createElement("div");
        note.innerText = act.note;
        note.style.fontSize = "13px";
        note.style.color = "#6b7280";
        note.style.marginTop = "8px";
        note.style.lineHeight = "1.4";
        info.appendChild(note);
      }

      // tags（分類 + 交通）
      const tagWrap = document.createElement("div");
      tagWrap.style.marginTop = "8px";
      tagWrap.style.display = "flex";
      tagWrap.style.flexWrap = "wrap";
      tagWrap.style.gap = "6px";

      const cat = document.createElement("span");
      cat.innerText = act.category;
      cat.style.background = "#eee";
      cat.style.padding = "6px 10px";
      cat.style.borderRadius = "999px";
      cat.style.fontSize = "12px";
      cat.style.fontWeight = "700";

      tagWrap.appendChild(cat);

      parseNoteTags(act.note).forEach((t) => {
        const tag = document.createElement("span");
        tag.innerText = t;
        tag.style.background = "#eef2ff";
        tag.style.color = "#3730a3";
        tag.style.padding = "6px 10px";
        tag.style.borderRadius = "999px";
        tag.style.fontSize = "12px";
        tag.style.fontWeight = "700";
        tagWrap.appendChild(tag);
      });

      info.appendChild(tagWrap);

      if (act.done) {
        info.style.opacity = "0.55";
        name.style.textDecoration = "line-through";
      }

      left.appendChild(cb);
      left.appendChild(info);

      // map
      const mapBtn = document.createElement("button");
      mapBtn.innerText = "📍";
      mapBtn.style.border = "none";
      mapBtn.style.background = "#f1f5f9";
      mapBtn.style.borderRadius = "14px";
      mapBtn.style.padding = "10px 12px";
      mapBtn.style.fontSize = "18px";
      mapBtn.style.flexShrink = "0";

      mapBtn.onclick = (e) => {
        e.stopPropagation();
        if (act.map) window.open(act.map);
      };

      top.appendChild(left);
      top.appendChild(mapBtn);

      row.appendChild(top);
      card.appendChild(row);
    });

    page.appendChild(card);
    track.appendChild(page);
  });

  container.appendChild(slider);

  // ===== dots =====
  const dots = document.createElement("div");
  dots.style.display = "flex";
  dots.style.justifyContent = "center";
  dots.style.gap = "8px";
  dots.style.margin = "10px 0 0";
  dots.style.userSelect = "none";

  function renderDots() {
    dots.innerHTML = "";
    project.days.forEach((_, i) => {
      const dot = document.createElement("div");
      dot.style.height = "7px";
      dot.style.borderRadius = "999px";
      dot.style.background = i === currentDayIndex ? "#111" : "#c9c9cf";
      dot.style.width = i === currentDayIndex ? "18px" : "7px";
      dot.style.transition = "all .2s ease";
      dots.appendChild(dot);
    });
  }

  container.appendChild(dots);

  // ===== 核心：每次都用當下 slider 寬度去 snap（避免跑掉）=====
  function getWidth() {
    // clientWidth 比 window.innerWidth 更準（含 iOS 視覺區域變動）
    return slider.clientWidth || window.innerWidth;
  }

  function snap(animated = true) {
    const w = getWidth();
    track.style.transition = animated ? "transform 0.4s ease" : "none";
    const offset = (w * 0.15) / 2; // ⭐ 左右留白補償
track.style.transform = `translateX(-${currentDayIndex * w}px + ${offset}px)`;
    renderDots();
  }

  // 初始定位（不做動畫，避免 render 時跳動）
  requestAnimationFrame(() => snap(false));

  // ===== swipe =====
  let start = 0;

  slider.ontouchstart = (e) => {
    start = e.touches[0].clientX;
  };

  slider.ontouchend = (e) => {
    const endX = e.changedTouches[0].clientX;
    const diff = start - endX;

    if (diff > 50) currentDayIndex++;
    if (diff < -50) currentDayIndex--;

    currentDayIndex = Math.max(0, Math.min(currentDayIndex, project.days.length - 1));
    snap(true);
  };
}
//判斷交換位置
function handleReorder(card, act, moveY) {
  const rows = Array.from(card.children).filter(el => el !== dragItem);

  for (let target of rows) {
    const rect = target.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;

    if (dragItem.getBoundingClientRect().top < mid) {
      card.insertBefore(dragItem, target);
      break;
    } else {
      card.appendChild(dragItem);
    }
  }
}
//更新資料順序
function finishDrag(day) {
  const newOrder = [];

  const rows = Array.from(document.querySelectorAll("[data-id]"));

  rows.forEach(r => {
    const id = r.dataset.id;
    const act = day.activities.find(a => a.id == id);
    if (act) newOrder.push(act);
  });

  day.activities = newOrder;

  // reset UI
  dragItem.style.transform = "";
  dragItem.style.opacity = "1";

  render();
}


// =================
// 統計（保留你原本的版本）
// =================
function renderStats(container) {
  const p = appData.projects[0];

  let total = 0;
  const stats = {};

  p.days.forEach((d) => {
    d.activities.forEach((a) => {
      if (a.done) {
        total += a.cost;
        stats[a.category] = (stats[a.category] || 0) + a.cost;
      }
    });
  });

  const card = document.createElement("div");
  card.style.background = "#fff";
  card.style.margin = "16px";
  card.style.padding = "16px";
  card.style.borderRadius = "20px";
  card.style.boxShadow = "0 10px 26px rgba(0,0,0,0.06)";

  card.innerHTML = `💰 <b>¥${total.toLocaleString()}</b> / ¥${p.budget.total.toLocaleString()}`;

  Object.entries(stats).forEach(([k, v]) => {
    const div = document.createElement("div");
    div.style.marginTop = "8px";
    div.innerText = `${k}  ¥${Number(v).toLocaleString()}`;
    card.appendChild(div);
  });

  container.appendChild(card);
}

// =================
// tabbar（固定底部）
// =================
function renderTabBar() {
  const old = document.querySelector(".tabbar");
  if (old) old.remove();

  const bar = document.createElement("div");
  bar.className = "tabbar";
  bar.style.position = "fixed";
  bar.style.bottom = "0";
  bar.style.left = "0";
  bar.style.right = "0";
  bar.style.height = "72px";
  bar.style.display = "flex";
  bar.style.background = "rgba(255,255,255,0.96)";
  bar.style.backdropFilter = "blur(10px)";
  bar.style.borderTop = "1px solid #eee";
  bar.style.zIndex = "9999";

  const mk = (k, label) => {
    const d = document.createElement("div");
    d.style.flex = "1";
    d.style.textAlign = "center";
    d.style.paddingTop = "12px";
    d.style.fontSize = "16px";
    d.style.fontWeight = currentTab === k ? "800" : "600";
    d.style.color = currentTab === k ? "#007aff" : "#111";
    d.innerText = label;
    d.onclick = () => {
      currentTab = k;
      render();
    };
    return d;
  };

  bar.appendChild(mk("plan", "行程"));
  bar.appendChild(mk("stats", "統計"));

  document.body.appendChild(bar);
}

// =================
// 更新
// =================
async function updateActivity(id, done) {
  try {
    await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ type: "updateActivity", activityId: id, done }),
    });
  } catch (e) {
    console.error("更新失敗", e);
  }
}

// =================
// 編輯（底部 sheet）
// =================
function openEditor(act) {
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.background = "rgba(0,0,0,0.25)";
  overlay.style.zIndex = "999";

  const sheet = document.createElement("div");
  sheet.style.position = "fixed";
  sheet.style.left = "0";
  sheet.style.right = "0";
  sheet.style.bottom = "0";
  sheet.style.background = "#fff";
  sheet.style.borderRadius = "20px 20px 0 0";
  sheet.style.padding = "16px";
  sheet.style.transform = "translateY(100%)";
  sheet.style.transition = "transform 0.3s ease";
  sheet.style.zIndex = "1000";

  const title = document.createElement("div");
  title.innerText = "編輯行程";
  title.style.fontWeight = "900";
  title.style.fontSize = "18px";
  title.style.marginBottom = "12px";

  const name = document.createElement("input");
  name.value = act.name;

  const cost = document.createElement("input");
  cost.type = "number";
  cost.value = act.cost;

  const note = document.createElement("input");
  note.value = act.note;

  [name, cost, note].forEach((i) => {
    i.style.width = "100%";
    i.style.marginBottom = "10px";
    i.style.padding = "12px";
    i.style.borderRadius = "12px";
    i.style.border = "1px solid #eee";
    i.style.fontSize = "16px";
  });

  const save = document.createElement("button");
  save.innerText = "儲存";
  save.style.width = "100%";
  save.style.padding = "14px";
  save.style.borderRadius = "14px";
  save.style.background = "#007aff";
  save.style.color = "#fff";
  save.style.border = "none";
  save.style.fontWeight = "900";
  save.style.fontSize = "16px";

  function close() {
    sheet.style.transform = "translateY(100%)";
    overlay.style.opacity = "0";
    setTimeout(() => {
      overlay.remove();
      sheet.remove();
    }, 250);
  }

  overlay.onclick = close;

  save.onclick = async () => {
    act.name = name.value;
    act.cost = Number(cost.value || 0);
    act.note = note.value;

    close();
    render();
    await updateActivity(act.id, act.done);
  };

  sheet.appendChild(title);
  sheet.appendChild(name);
  sheet.appendChild(cost);
  sheet.appendChild(note);
  sheet.appendChild(save);

  document.body.appendChild(overlay);
  document.body.appendChild(sheet);

  setTimeout(() => {
    sheet.style.transform = "translateY(0)";
  }, 10);
}
