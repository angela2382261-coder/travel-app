const API_URL = "https://script.google.com/macros/s/AKfycbz5z5FS1zxQPShsh52pG8L45cKqMwqvUZ3ApK3PnIjLmasYYeUMWXArHLGwhJfI7LgL/exec";

let appData = null;
let currentTab = "plan";
let currentDayIndex = 0;

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

    day.activities.forEach((act) => {

      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.flexDirection = "column";
      row.style.padding = "14px 0";
      row.style.borderTop = "1px solid #eee";

      // =================
      // 長按
      // =================
      let pressTimer;
      let startX=0,startY=0;

      row.addEventListener("touchstart",(e)=>{
        const t=e.touches[0];
        startX=t.clientX;
        startY=t.clientY;

        pressTimer=setTimeout(()=>{
          openEditor(act);
        },500);
      });

      row.addEventListener("touchmove",(e)=>{
        const t=e.touches[0];
        if(Math.abs(t.clientX-startX)>10 || Math.abs(t.clientY-startY)>10){
          clearTimeout(pressTimer);
        }
      });

      row.addEventListener("touchend",()=>clearTimeout(pressTimer));

      // =================
      // 上排
      // =================
      const top = document.createElement("div");
      top.style.display = "flex";
      top.style.alignItems = "flex-start";
      top.style.gap = "12px";

      const left = document.createElement("div");
      left.style.display = "flex";
      left.style.gap = "12px";
      left.style.flex = "1";

      // checkbox
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = act.done;

      cb.onchange = async () => {
        act.done = cb.checked;
        render();
        await updateActivity(act.id, cb.checked);
      };

      // info
      const info = document.createElement("div");

      const name = document.createElement("div");
      name.innerText = act.name;
      name.style.fontWeight = "700";

      const price = document.createElement("div");
      price.innerText = `¥${act.cost}`;
      price.style.background="#e0f2fe";
      price.style.display="inline-block";
      price.style.padding="4px 10px";
      price.style.borderRadius="999px";
      price.style.marginTop="6px";

      info.appendChild(name);
      info.appendChild(price);

      // note
      if(act.note){
        const note=document.createElement("div");
        note.innerText=act.note;
        note.style.fontSize="13px";
        note.style.color="#666";
        info.appendChild(note);
      }

      // tag
      const tagWrap=document.createElement("div");
      tagWrap.style.marginTop="6px";

      const cat=document.createElement("span");
      cat.innerText=act.category;
      cat.style.background="#eee";
      cat.style.padding="4px 8px";
      cat.style.borderRadius="999px";
      tagWrap.appendChild(cat);

      parseNoteTags(act.note).forEach(t=>{
        const tag=document.createElement("span");
        tag.innerText=t;
        tag.style.marginLeft="6px";
        tag.style.background="#eef2ff";
        tag.style.padding="4px 8px";
        tag.style.borderRadius="999px";
        tagWrap.appendChild(tag);
      });

      info.appendChild(tagWrap);

      left.appendChild(cb);
      left.appendChild(info);

      // 地圖
      const mapBtn=document.createElement("button");
      mapBtn.innerText="📍";
      mapBtn.onclick=(e)=>{
        e.stopPropagation();
        if(act.map) window.open(act.map);
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
}

// =================
// 統計
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
// tabbar
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

  const mk=(k,t)=>{
    const d=document.createElement("div");
    d.style.flex=1;
    d.style.textAlign="center";
    d.innerText=t;
    d.onclick=()=>{currentTab=k;render();};
    return d;
  };

  bar.appendChild(mk("plan","行程"));
  bar.appendChild(mk("stats","統計"));

  document.body.appendChild(bar);
}

// =================
// 更新
// =================
async function updateActivity(id,done){
  await fetch(API_URL,{
    method:"POST",
    body:JSON.stringify({type:"updateActivity",activityId:id,done})
  });
}

// =================
// 編輯
// =================
function openEditor(act){

  // ===== overlay =====
  const overlay = document.createElement("div");
  overlay.style.position="fixed";
  overlay.style.inset="0";
  overlay.style.background="rgba(0,0,0,0.25)";
  overlay.style.zIndex="999";

  // ===== bottom sheet =====
  const sheet = document.createElement("div");
  sheet.style.position="fixed";
  sheet.style.bottom="0";
  sheet.style.left="0";
  sheet.style.right="0";
  sheet.style.background="#fff";
  sheet.style.borderRadius="20px 20px 0 0";
  sheet.style.padding="16px";
  sheet.style.transform="translateY(100%)";
  sheet.style.transition="0.3s";
  sheet.style.zIndex="1000";

  // ===== title =====
  const title=document.createElement("div");
  title.innerText="編輯行程";
  title.style.fontWeight="800";
  title.style.fontSize="18px";
  title.style.marginBottom="12px";

  // ===== input =====
  const name=document.createElement("input");
  name.value=act.name;

  const cost=document.createElement("input");
  cost.type="number";
  cost.value=act.cost;

  const note=document.createElement("input");
  note.value=act.note;

  [name,cost,note].forEach(i=>{
    i.style.width="100%";
    i.style.marginBottom="10px";
    i.style.padding="12px";
    i.style.borderRadius="12px";
    i.style.border="1px solid #eee";
  });

  // ===== save =====
  const save=document.createElement("button");
  save.innerText="儲存";
  save.style.width="100%";
  save.style.padding="14px";
  save.style.borderRadius="14px";
  save.style.background="#007aff";
  save.style.color="#fff";
  save.style.border="none";

  save.onclick=async()=>{
    act.name=name.value;
    act.cost=Number(cost.value);
    act.note=note.value;

    close();
    render();

    await updateActivity(act.id, act.done);
  };

  // ===== close =====
  function close(){
    sheet.style.transform="translateY(100%)";
    overlay.style.opacity="0";
    setTimeout(()=>{
      overlay.remove();
      sheet.remove();
    },300);
  }

  overlay.onclick=close;

  // ===== append =====
  sheet.appendChild(title);
  sheet.appendChild(name);
  sheet.appendChild(cost);
  sheet.appendChild(note);
  sheet.appendChild(save);

  document.body.appendChild(overlay);
  document.body.appendChild(sheet);

  setTimeout(()=>{
    sheet.style.transform="translateY(0)";
  },10);
}
