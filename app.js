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
  document.getElementById("app").innerHTML = "⏳ 讀取中...";
  const data = await loadFromSheet();
  appData = convert(data);
  render();
}
init();

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
    projects: projects.map(p => ({
      id: p.projectId,
      name: p.name,
      budget: {
        total: Number(meta.find(m=>m.projectId===p.projectId)?.budgetTotal||0)
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
              cost: Number(a.cost)||0,
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
// 交通 tag
// =================
function parseNoteTags(note){
  if(!note) return [];
  const t=[];
  if(note.includes("JR")) t.push("🚆 JR");
  if(note.includes("地鐵")) t.push("🚇 地鐵");
  if(note.includes("巴士")) t.push("🚌 巴士");
  if(note.includes("步行")) t.push("🚶 步行");
  return t;
}

// =================
// 主 render
// =================
function render(){
  const app = document.getElementById("app");
  app.innerHTML = "";
  app.style.paddingBottom="90px";

  if(currentTab==="plan") renderPlan(app);
  else renderStats(app);

  renderTabBar();
}

// =================
// 行程頁
// =================
function renderPlan(container){
  const project = appData.projects[0];

  const slider = document.createElement("div");
  slider.style.overflow="hidden";

  const track = document.createElement("div");
  track.style.display="flex";
  track.style.transition="0.4s";
  slider.appendChild(track);

  const width = window.innerWidth;

  project.days.forEach(day=>{
    const page = document.createElement("div");
    page.style.minWidth="100%";
    page.style.padding="12px";

    const card = document.createElement("div");
    card.style.background="#fff";
    card.style.borderRadius="20px";
    card.style.padding="16px";

    const title = document.createElement("h2");
    title.innerText=day.title;
    card.appendChild(title);

    day.activities.forEach(act=>{
      const row=document.createElement("div");
      row.style.borderTop="1px solid #eee";
      row.style.padding="12px 0";

      // 長按
      let timer=null;
      row.ontouchstart=()=>{
        timer=setTimeout(()=>openEditor(act),450);
      };
      row.ontouchend=()=>clearTimeout(timer);
      row.ontouchmove=()=>clearTimeout(timer);

      // top
      const top=document.createElement("div");
      top.style.display="flex";

      const left=document.createElement("div");
      left.style.flex=1;
      
      // ✅ checkbox（你少這個）
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = act.done;
  cb.style.transform = "scale(1.3)";
  cb.style.marginTop = "6px";

  cb.onchange = async () => {
    act.done = cb.checked;
    render();
    await updateActivity(act.id, cb.checked);
  };

  // =================
  // 文字區
  // =================
  const info = document.createElement("div");
  info.style.flex = "1";
  info.style.minWidth = "0";
      
      const name=document.createElement("div");
      name.innerText=act.name;
      name.style.fontSize="18px";


      const price=document.createElement("div");
      price.innerText="¥"+act.cost;
      price.style.background="#e0f2fe";
      price.style.display="inline-block";
      price.style.padding="4px 10px";
      price.style.borderRadius="999px";

      const tags=document.createElement("div");

      const cat=document.createElement("span");
      cat.innerText=act.category;
      cat.style.background="#eee";
      cat.style.padding="3px 8px";
      cat.style.borderRadius="999px";
      tags.appendChild(cat);

      parseNoteTags(act.note).forEach(t=>{
        const tag=document.createElement("span");
        tag.innerText=t;
        tag.style.marginLeft="5px";
        tags.appendChild(tag);
      });

      left.appendChild(name);
      left.appendChild(price);
      left.appendChild(tags);

      const mapBtn=document.createElement("button");
      mapBtn.innerText="📍";
      mapBtn.onclick=e=>{
        e.stopPropagation();
        window.open(act.map);
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

  // 滑動
  let start=0;
  slider.ontouchstart=e=>start=e.touches[0].clientX;

  slider.ontouchend=e=>{
    let diff=start-e.changedTouches[0].clientX;
    if(diff>50) currentDayIndex++;
    if(diff<-50) currentDayIndex--;
    currentDayIndex=Math.max(0,Math.min(currentDayIndex,project.days.length-1));
    track.style.transform=`translateX(-${currentDayIndex*width}px)`;
  };

  // dots
  const dots=document.createElement("div");
  dots.style.textAlign="center";
  project.days.forEach((_,i)=>{
    const d=document.createElement("span");
    d.innerText="●";
    d.style.margin="3px";
    d.style.opacity=i===currentDayIndex?1:0.3;
    dots.appendChild(d);
  });

  container.appendChild(dots);
}

// =================
// 統計頁
// =================
function renderStats(container){
  const p=appData.projects[0];

  let total=0;
  const stats={};

  p.days.forEach(d=>{
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

  card.innerHTML=`💰 ¥${total} / ¥${p.budget.total}`;

  Object.entries(stats).forEach(([k,v])=>{
    const div=document.createElement("div");
    div.innerText=`${k} ¥${v}`;
    card.appendChild(div);
  });

  container.appendChild(card);
}

// =================
// TabBar（關鍵🔥）
// =================
function renderTabBar(){
  const old=document.querySelector(".tabbar");
  if(old) old.remove();

  const bar=document.createElement("div");
  bar.className="tabbar";
  bar.style.position="fixed";
  bar.style.bottom="0";
  bar.style.width="100%";
  bar.style.display="flex";
  bar.style.background="#fff";
  bar.style.borderTop="1px solid #eee";

  const mk=(key,label)=>{
    const t=document.createElement("div");
    t.style.flex=1;
    t.style.textAlign="center";
    t.innerText=label;
    t.onclick=()=>{currentTab=key;render();};
    return t;
  };

  bar.appendChild(mk("plan","行程"));
  bar.appendChild(mk("stats","統計"));

  document.body.appendChild(bar);
}

// =================
// 編輯視窗
// =================
function openEditor(act){
  alert("之後這裡會升級成完整編輯UI");
}
