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
// ⭐ 行程頁（iOS 卡片版）
// =================
function renderPlan(container){
  const project = appData.projects[0];

  const slider = document.createElement("div");
  slider.style.overflow="hidden";

  const track = document.createElement("div");
  track.style.display="flex";
  track.style.transition="0.4s cubic-bezier(0.22,1,0.36,1)";
  slider.appendChild(track);

  let width = 0;

  project.days.forEach(day=>{
    const page = document.createElement("div");

    // ⭐ iOS 卡片寬度
    page.style.minWidth="85%";
    page.style.margin="0 7.5%";
    page.style.boxSizing="border-box";
    page.style.transition="transform 0.3s, opacity 0.3s";

    const card = document.createElement("div");
    card.style.background="#fff";
    card.style.borderRadius="26px";
    card.style.padding="18px";
    card.style.boxShadow="0 10px 30px rgba(0,0,0,0.12)";

    const title = document.createElement("h2");
    title.innerText=day.title;
    title.style.fontSize="26px";
    title.style.marginBottom="10px";

    card.appendChild(title);

    day.activities.forEach((act) => {

      const row = document.createElement("div");
      row.style.display="flex";
      row.style.flexDirection="column";
      row.style.padding="14px 0";
      row.style.borderTop="1px solid #eee";

      // ⭐ 長按
      let pressTimer;
      let startX=0,startY=0;

      row.addEventListener("touchstart",(e)=>{
        const t=e.touches[0];
        startX=t.clientX;
        startY=t.clientY;

        pressTimer=setTimeout(()=>{
          openEditor(act);
        },450);
      });

      row.addEventListener("touchmove",(e)=>{
        const t=e.touches[0];
        if(Math.abs(t.clientX-startX)>10 || Math.abs(t.clientY-startY)>10){
          clearTimeout(pressTimer);
        }
      });

      row.addEventListener("touchend",()=>clearTimeout(pressTimer));

      // 上排
      const top = document.createElement("div");
      top.style.display="flex";
      top.style.alignItems="flex-start";
      top.style.gap="12px";

      const cb = document.createElement("input");
      cb.type="checkbox";
      cb.checked=act.done;
      cb.style.transform="scale(1.3)";

      cb.onchange=async()=>{
        act.done=cb.checked;
        render();
        await updateActivity(act.id, cb.checked);
      };

      const info = document.createElement("div");
      info.style.flex="1";

      const name = document.createElement("div");
      name.innerText=act.name;
      name.style.fontWeight="700";
      name.style.fontSize="18px";

      const price = document.createElement("div");
      price.innerText=`¥${act.cost}`;
      price.style.background="#e0f2fe";
      price.style.display="inline-block";
      price.style.padding="6px 12px";
      price.style.borderRadius="999px";
      price.style.marginTop="6px";

      info.appendChild(name);
      info.appendChild(price);

      if(act.note){
        const note=document.createElement("div");
        note.innerText=act.note;
        note.style.fontSize="13px";
        note.style.color="#666";
        note.style.marginTop="6px";
        info.appendChild(note);
      }

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

      const mapBtn=document.createElement("button");
      mapBtn.innerText="📍";
      mapBtn.style.marginLeft="auto";

      mapBtn.onclick=(e)=>{
        e.stopPropagation();
        if(act.map) window.open(act.map);
      };

      top.appendChild(cb);
      top.appendChild(info);
      top.appendChild(mapBtn);

      row.appendChild(top);
      card.appendChild(row);
    });

    page.appendChild(card);
    track.appendChild(page);
  });

  container.appendChild(slider);

  // ⭐ 定位 + 縮放
  function snap(){
    const w = slider.clientWidth;
    const offset = w * 0.075;

    track.style.transform =
      `translateX(-${currentDayIndex * w}px + ${offset}px)`;

    updateScale();
  }

  function updateScale(){
    const pages = track.children;
    for(let i=0;i<pages.length;i++){
      if(i===currentDayIndex){
        pages[i].style.transform="scale(1)";
        pages[i].style.opacity="1";
      }else{
        pages[i].style.transform="scale(0.92)";
        pages[i].style.opacity="0.5";
      }
    }
  }

  requestAnimationFrame(snap);

  // ⭐ 滑動
  let start=0;
  slider.ontouchstart=e=>start=e.touches[0].clientX;

  slider.ontouchend=e=>{
    const diff=start-e.changedTouches[0].clientX;

    if(diff>50) currentDayIndex++;
    if(diff<-50) currentDayIndex--;

    currentDayIndex=Math.max(0,Math.min(currentDayIndex,project.days.length-1));

    snap();
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
  bar.style.borderTop="1px solid #eee";

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
  alert("長按成功，可擴充編輯 UI");
}
