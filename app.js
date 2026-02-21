const API_URL = "https://script.google.com/macros/s/AKfycbz5z5FS1zxQPShsh52pG8L45cKqMwqvUZ3ApK3PnIjLmasYYeUMWXArHLGwhJfI7LgL/exec";

let appData = null;
let currentTab = "plan";
let currentDayIndex = 0;
let expanded = {};
let editingAct = null;

// =================
// 🚀 初始化
// =================
async function init() {
  renderLoading();
  const data = await loadFromSheet();
  appData = convert(data);
  render();
}
init();

// =================
// ⏳ Loading
// =================
function renderLoading() {
  document.getElementById("app").innerHTML = "⏳ Loading...";
}

// =================
// JSONP
// =================
function loadFromSheet() {
  return new Promise((resolve) => {
    const cb = "jsonp_" + Date.now();
    window[cb] = (data) => {
      resolve(data);
      delete window[cb];
    };
    const s = document.createElement("script");
    s.src = API_URL + "?callback=" + cb;
    document.body.appendChild(s);
  });
}

// =================
// 🔄 轉換
// =================
function convert(data) {
  const { projects, days, activities, meta } = data;

  return {
    projects: projects.map(p => ({
      id: p.projectId,
      name: p.name,
      budget: {
        total: Number(meta.find(m=>m.projectId===p.projectId)?.budgetTotal || 0)
      },
      days: days
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
              map: a.map || "",
              note: a.note || ""
            }))
        }))
    }))
  };
}

// =================
// 🏷️ TAG
// =================
function parseNoteTags(note){
  if(!note) return [];
  const s = note;
  const t=[];
  if(s.includes("JR")) t.push("🚆JR");
  if(s.includes("地鐵")) t.push("🚇地鐵");
  if(s.includes("巴士")) t.push("🚌巴士");
  if(s.includes("步行")) t.push("🚶");
  return t;
}

// =================
// 🎨 UI
// =================
function render(){
  const el = document.getElementById("app");
  el.innerHTML="";

  if(currentTab==="plan"){
    renderPlan(el);
  }else{
    renderStats(el);
  }

  renderTabBar();
}

// =================
// 🗓 行程（iOS滑動）
// =================
function renderPlan(container){
  const project = appData.projects[0];

  const slider = document.createElement("div");
  slider.style.overflow="hidden";

  const track = document.createElement("div");
  track.style.display="flex";
  track.style.transition="0.4s";

  slider.appendChild(track);

  project.days.forEach(day=>{
    const page = document.createElement("div");
    page.style.minWidth="100%";

    const card = document.createElement("div");
    card.style.background="#fff";
    card.style.margin="10px";
    card.style.padding="16px";
    card.style.borderRadius="20px";

    const title = document.createElement("h2");
    title.innerText=day.title;
    card.appendChild(title);

    day.activities.forEach(act=>{
      const row = document.createElement("div");
      row.style.padding="12px 0";
      row.style.borderTop="1px solid #eee";

      // 長按
      let timer;
      row.ontouchstart=()=>{
        timer=setTimeout(()=>openEditor(act),400);
      };
      row.ontouchend=()=>clearTimeout(timer);

      const top = document.createElement("div");
      top.style.display="flex";

      const left = document.createElement("div");
      left.style.flex=1;

      const name = document.createElement("div");
      name.innerText=act.name;

      const price = document.createElement("span");
      price.innerText=`¥${act.cost}`;
      price.style.background="#eef";
      price.style.padding="4px 10px";
      price.style.borderRadius="10px";

      const tagWrap=document.createElement("div");

      const cat=document.createElement("span");
      cat.innerText=act.category;
      cat.style.fontSize="12px";
      tagWrap.appendChild(cat);

      parseNoteTags(act.note).forEach(t=>{
        const tag=document.createElement("span");
        tag.innerText=t;
        tag.style.fontSize="12px";
        tagWrap.appendChild(tag);
      });

      left.appendChild(name);
      left.appendChild(price);
      left.appendChild(tagWrap);

      const mapBtn=document.createElement("button");
      mapBtn.innerText="📍";
      mapBtn.onclick=()=>window.open(act.map);

      top.appendChild(left);
      top.appendChild(mapBtn);

      row.appendChild(top);
      card.appendChild(row);
    });

    page.appendChild(card);
    track.appendChild(page);
  });

  container.appendChild(slider);

  // 滑動
  let startX=0;

  slider.ontouchstart=e=>{
    startX=e.touches[0].clientX;
  };

  slider.ontouchend=e=>{
    const diff=e.changedTouches[0].clientX-startX;
    if(diff<-50) currentDayIndex++;
    if(diff>50) currentDayIndex--;

    currentDayIndex=Math.max(0,Math.min(currentDayIndex,project.days.length-1));
    track.style.transform=`translateX(-${currentDayIndex*100}%)`;
  };
}

// =================
// 📊 統計
// =================
function renderStats(container){
  const project = appData.projects[0];

  let total=0;
  let stats={};

  project.days.forEach(d=>{
    d.activities.forEach(a=>{
      if(a.done){
        total+=a.cost;
        stats[a.category]=(stats[a.category]||0)+a.cost;
      }
    });
  });

  const card=document.createElement("div");
  card.style.background="#fff";
  card.style.margin="16px";
  card.style.padding="16px";
  card.style.borderRadius="20px";

  const title=document.createElement("h2");
  title.innerText="📊 統計";
  card.appendChild(title);

  const text=document.createElement("div");
  text.innerText=`¥${total}`;
  card.appendChild(text);

  container.appendChild(card);
}

// =================
// tab
// =================
function renderTabBar() {
  // 移除舊的
  const old = document.getElementById("tabbar");
  if (old) old.remove();

  const tabbar = document.createElement("div");
  tabbar.id = "tabbar";

  // ⭐ iOS safe-area + 不被 Safari 擋住
  tabbar.style.cssText = `
    position: fixed;
    left: 0; right: 0;
    bottom: 0;
    height: 72px;
    padding-bottom: env(safe-area-inset-bottom);
    background: rgba(255,255,255,0.96);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-top: 1px solid rgba(0,0,0,0.06);
    display: flex;
    z-index: 999999;
  `;

  const mkTab = (key, icon, label) => {
    const t = document.createElement("button");
    t.type = "button";
    t.style.cssText = `
      flex: 1;
      border: none;
      background: transparent;
      padding: 10px 0 8px;
      font-size: 12px;
      color: ${currentTab === key ? "#007aff" : "#8e8e93"};
      font-weight: ${currentTab === key ? "700" : "500"};
    `;
    t.innerHTML = `<div style="font-size:20px; line-height:20px;">${icon}</div><div>${label}</div>`;
    t.onclick = () => {
      currentTab = key;
      render();
    };
    return t;
  };

  tabbar.appendChild(mkTab("plan", "🗓", "行程"));
  tabbar.appendChild(mkTab("stats", "📊", "統計"));

  document.body.appendChild(tabbar);
}

// =================
// ✏️ Editor（修好版）
// =================
function openEditor(act){
  editingAct=act;

  const overlay=document.createElement("div");
  overlay.style.position="fixed";
  overlay.style.inset="0";
  overlay.style.background="rgba(0,0,0,0.3)";

  const modal=document.createElement("div");
  modal.style.position="fixed";
  modal.style.bottom="0";
  modal.style.background="#fff";
  modal.style.width="100%";
  modal.style.padding="20px";
  modal.style.borderRadius="20px 20px 0 0";

  const input=document.createElement("input");
  input.value=act.name;

  const save=document.createElement("button");
  save.innerText="儲存";

  save.onclick=()=>{
    act.name=input.value;
    overlay.remove();
    modal.remove();
    render();
  };

  modal.appendChild(input);
  modal.appendChild(save);

  overlay.onclick=()=>{
    overlay.remove();
    modal.remove();
  };

  document.body.appendChild(overlay);
  document.body.appendChild(modal);
}

  
