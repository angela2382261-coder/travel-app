API_URL = "https://script.google.com/macros/s/AKfycbz5z5FS1zxQPShsh52pG8L45cKqMwqvUZ3ApK3PnIjLmasYYeUMWXArHLGwhJfI7LgL/exec";

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


setInterval(async () => {
  const data = await loadFromSheet();
  appData = convert(data);
  render();
}, 15000);

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
          activities
  .filter(a => a.dayId === d.dayId)
  .map(a => ({
    id: a.activityId,
    name: a.name,
    cost: Number(a.cost)||0,
    done: a.done === true || a.done === "TRUE",
    category: a.category || "其他",
    map: a.map || "",
    note: a.note || "",

    // ⭐⭐⭐ 就是加在這裡 ⭐⭐⭐
    alt: {
      name: a.alt_name || "",
      time: a.alt_time || "",
      map: a.alt_map || ""
    }
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
//分類顏色
  function getCategoryStyle(cat){
  switch(cat){
    case "食物":
      return { bg:"#fee2e2", color:"#b91c1c" }; // 紅
    case "景點":
      return { bg:"#dbeafe", color:"#1d4ed8" }; // 藍
    case "交通":
      return { bg:"#fef3c7", color:"#92400e" }; // 黃
    case "飯店":
      return { bg:"#dcfce7", color:"#166534" }; // 綠
    default:
      return { bg:"#e5e7eb", color:"#374151" }; // 灰
  }
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

  const pageWidth = Math.round(window.innerWidth * 0.88);
  const gap = Math.round(window.innerWidth * 0.06);
  const step = pageWidth + gap;

  project.days.forEach(day=>{
    const page = document.createElement("div");

    page.style.width = pageWidth + "px";
    page.style.marginLeft = gap/2 + "px";
    page.style.marginRight = gap/2 + "px";
    page.style.flexShrink = "0";

    const card = document.createElement("div");
    card.style.background="#fff";
    card.style.borderRadius="26px";
    card.style.padding="18px";
    card.style.boxShadow = "0 20px 40px rgba(0,0,0,0.12)";
card.style.border = "1px solid rgba(255,255,255,0.4)";
card.style.backdropFilter = "blur(10px)";

    const title = document.createElement("h2");
    title.innerText=day.title;
    title.style.fontSize="26px";
    title.style.marginBottom="10px";

    card.appendChild(title);

    day.activities.forEach((act) => {

      // ⭐⭐⭐ 卡片 row ⭐⭐⭐
      const row = document.createElement("div");

      const style = getCategoryStyle(act.category);

      row.style.display="flex";
      row.style.flexDirection="column";
      row.style.padding="14px 12px";
      row.style.marginTop="10px";
      row.style.borderRadius="14px";
      row.style.transition = "transform 0.2s ease, opacity 0.2s ease";
row.style.backdropFilter = "blur(6px)";

      // ⭐ 分類背景（重點🔥）
      row.style.background = style.bg;

      // ⭐ 左側色條
      row.style.borderLeft = `4px solid ${style.color}`;

      row.style.boxShadow="0 4px 14px rgba(0,0,0,0.06)";

      // ===== 長按 =====
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

      // ===== 上排 =====
      const top = document.createElement("div");
      top.style.display="flex";
      top.style.alignItems="flex-start";
      top.style.gap="12px";

      const cb = document.createElement("input");
      cb.type="checkbox";
      cb.checked=act.done;
      cb.style.transform="scale(1.2)";
      cb.style.marginTop="4px";

      cb.onchange = async () => {

  row.style.transform = "scale(0.96)";
  row.style.opacity = "0.5";

  if (navigator.vibrate) navigator.vibrate(10); // iOS 震動

  setTimeout(() => {
    act.done = cb.checked;
    render();
  }, 180);

  await updateActivity(act.id, cb.checked);
};

      const info = document.createElement("div");
      info.style.flex="1";

      const name = document.createElement("div");
      name.innerText=act.name;
      name.style.fontWeight="700";
      name.style.fontSize="16px";

      // ⭐ 金額（你要的金色 + 藍字）
      const price = document.createElement("div");
      price.innerText = `¥${act.cost.toLocaleString()}`;
      price.style.background = "linear-gradient(135deg,#fde68a,#facc15)";
      price.style.color = "#1d4ed8";
      price.style.display = "inline-block";
      price.style.padding = "6px 12px";
      price.style.borderRadius = "999px";
      price.style.fontWeight = "800";
      price.style.fontSize = "14px";
      price.style.marginTop = "6px";
      price.style.boxShadow = "0 4px 10px rgba(250,204,21,0.5)";

      info.appendChild(name);
      info.appendChild(price);

      // ⭐ 備註
      if(act.note){
        const note=document.createElement("div");
        note.innerText=act.note;
        note.style.fontSize="13px";
        note.style.color="#555";
        note.style.marginTop="6px";
        info.appendChild(note);
      }

      // ⭐ TAG
      const tagWrap=document.createElement("div");
      tagWrap.style.marginTop="6px";
      tagWrap.style.display="flex";
      tagWrap.style.flexWrap="wrap";
      tagWrap.style.gap="6px";

      const cat=document.createElement("span");
      cat.innerText=act.category;
      cat.style.background=style.bg;
      cat.style.color=style.color;
      cat.style.padding="4px 10px";
      cat.style.borderRadius="999px";
      cat.style.fontSize="12px";
      cat.style.fontWeight="700";

      tagWrap.appendChild(cat);

      parseNoteTags(act.note).forEach(t=>{
        const tag=document.createElement("span");
        tag.innerText=t;
        tag.style.background = "rgba(255,255,255,0.6)";
tag.style.backdropFilter = "blur(6px)";
tag.style.border = "1px solid rgba(255,255,255,0.4)";
        tag.style.padding="4px 8px";
        tag.style.borderRadius="999px";
        tag.style.fontSize="12px";
        tagWrap.appendChild(tag);
      });

      info.appendChild(tagWrap);


//備選餐廳
// ===== 右側按鈕容器 =====
const rightBtns = document.createElement("div");
rightBtns.style.display = "flex";
rightBtns.style.gap = "6px";
rightBtns.style.marginLeft = "auto";

// 🍽 備選（🔥改這裡）
if(act.category?.trim() === "食物"){
  const altBtn = document.createElement("button");
  altBtn.innerText = "🍽";

  altBtn.style.padding = "6px 10px";
  altBtn.style.borderRadius = "10px";
  altBtn.style.border = "none";
  altBtn.style.background = "rgba(255,255,255,0.6)";
  altBtn.style.backdropFilter = "blur(6px)";

  // ⭐ 沒資料 → 淡掉
  if(!act.alt?.name){
    altBtn.style.opacity = "0.4";
  }

  altBtn.onclick = (e)=>{
    e.stopPropagation();
    openFoodOptions(act);
  };

  rightBtns.appendChild(altBtn);
}
// 📍 地圖（只留這一個）
const mapBtn = document.createElement("button");
mapBtn.innerText = "📍";

mapBtn.style.padding = "6px 10px";
mapBtn.style.borderRadius = "10px";
mapBtn.style.border = "none";
mapBtn.style.background = "rgba(255,255,255,0.6)";
mapBtn.style.backdropFilter = "blur(6px)";

mapBtn.onclick = (e)=>{
  e.stopPropagation();
  if(act.map) window.open(act.map);
};

rightBtns.appendChild(mapBtn);

// ⭐⭐⭐ 唯一組裝（重點🔥）
top.appendChild(cb);
top.appendChild(info);
top.appendChild(rightBtns);

      row.appendChild(top);
      card.appendChild(row);
    });

    page.appendChild(card);
    track.appendChild(page);
  });

  container.appendChild(slider);

  // ===== snap =====
  function snap(){
  const pages = track.children;

  track.style.transition = "0.5s cubic-bezier(0.22,1,0.36,1)";
  track.style.transform = `translateX(-${currentDayIndex * step}px)`;

  for(let i=0;i<pages.length;i++){
    const dist = Math.abs(i - currentDayIndex);

    const scale = 1 - (dist * 0.08);
    const opacity = 1 - (dist * 0.35);

    pages[i].style.transform = `scale(${Math.max(scale,0.88)})`;
    pages[i].style.opacity = Math.max(opacity,0.4);
  }
}

  requestAnimationFrame(snap);

  // ===== 滑動 =====
  let start=0;

  slider.ontouchstart=e=>{
    start=e.touches[0].clientX;
  };

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
  const p = appData.projects[0];

  let total = 0;
  const stats = {};

  p.days.forEach(d=>{
    d.activities.forEach(a=>{
      if(a.done){
        total += a.cost;
        stats[a.category] = (stats[a.category]||0)+a.cost;
      }
    });
  });

  const card = document.createElement("div");
  card.style.background="#fff";
  card.style.margin="16px";
  card.style.padding="16px";
  card.style.borderRadius="20px";
  card.style.boxShadow="0 10px 30px rgba(0,0,0,0.08)";

  // ===== 標題 =====
  const title = document.createElement("div");
  title.innerText = "📊 花費統計";
  title.style.fontSize="22px";
  title.style.fontWeight="800";
  title.style.marginBottom="10px";
  card.appendChild(title);

  // ===== summary =====
  const summary = document.createElement("div");
  summary.innerHTML = `💰 ¥${total.toLocaleString()} / ¥${p.budget.total}`;
  summary.style.marginBottom="12px";
  summary.style.fontSize="16px";
  card.appendChild(summary);

  // ===== layout =====
  const layout = document.createElement("div");
  layout.style.display="flex";
  layout.style.gap="16px";
  layout.style.flexWrap="wrap";
  card.appendChild(layout);

  // ===== canvas =====
  const canvas = document.createElement("canvas");
  canvas.width = 220;
  canvas.height = 220;
  layout.appendChild(canvas);

  const list = document.createElement("div");
  list.style.flex="1";
  layout.appendChild(list);

  const ctx = canvas.getContext("2d");

  const entries = Object.entries(stats);
  const colors = ["#007aff","#34c759","#ff9500","#ff3b30","#af52de","#5ac8fa"];

  let activeIndex = -1;
  let progress = 0;

  // ===== 畫圖 =====
  function draw(){
    ctx.clearRect(0,0,220,220);

    let start = -Math.PI/2;

    entries.forEach(([cat,amount],i)=>{
      const angle = (amount/total)*Math.PI*2*progress;
      const end = start + angle;

      const isActive = i===activeIndex;
      const bump = isActive ? 10 : 0;

      const mid = (start+end)/2;
      const bx = Math.cos(mid)*bump;
      const by = Math.sin(mid)*bump;

      ctx.beginPath();
      ctx.moveTo(110+bx,110+by);
      ctx.fillStyle = colors[i%colors.length];
      ctx.arc(110+bx,110+by,80,start,end);
      ctx.closePath();
      ctx.fill();

      start = end;
    });

    // 中間文字
    ctx.fillStyle="#111";
    ctx.font="bold 14px sans-serif";
    ctx.textAlign="center";
    ctx.fillText("已花",110,100);

    ctx.font="bold 18px sans-serif";
    ctx.fillText(`¥${total.toLocaleString()}`,110,125);
  }



  
  // ===== 動畫 =====
  function animate(){
    progress += 0.05;
    if(progress>1) progress=1;
    draw();
    if(progress<1) requestAnimationFrame(animate);
  }

  animate();

  // ===== list =====
  function renderList(){
    list.innerHTML="";

    entries.forEach(([cat,amount],i)=>{
      const row = document.createElement("div");
      row.style.display="flex";
      row.style.justifyContent="space-between";
      row.style.padding="8px 0";
      row.style.cursor="pointer";

      const left = document.createElement("div");
      left.innerText = cat;

      const right = document.createElement("div");
      right.innerText = `¥${amount}`;

      if(i===activeIndex){
        left.style.fontWeight="800";
        right.style.fontWeight="800";
      }

      row.onclick=()=>{
        activeIndex = activeIndex===i ? -1 : i;
        draw();
        renderList();
      };

      row.appendChild(left);
      row.appendChild(right);
      list.appendChild(row);
    });
  }

  renderList();
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

API_URL = "https://script.google.com/macros/s/AKfycbz5z5FS1zxQPShsh52pG8L45cKqMwqvUZ3ApK3PnIjLmasYYeUMWXArHLGwhJfI7LgL/exec";

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


setInterval(async () => {
  const data = await loadFromSheet();
  appData = convert(data);
  render();
}, 15000);

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
          activities
  .filter(a => a.dayId === d.dayId)
  .map(a => ({
    id: a.activityId,
    name: a.name,
    cost: Number(a.cost)||0,
    done: a.done === true || a.done === "TRUE",
    category: a.category || "其他",
    map: a.map || "",
    note: a.note || "",

    // ⭐⭐⭐ 就是加在這裡 ⭐⭐⭐
    alt: {
      name: a.alt_name || "",
      time: a.alt_time || "",
      map: a.alt_map || ""
    }
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
//分類顏色
  function getCategoryStyle(cat){
  switch(cat){
    case "食物":
      return { bg:"#fee2e2", color:"#b91c1c" }; // 紅
    case "景點":
      return { bg:"#dbeafe", color:"#1d4ed8" }; // 藍
    case "交通":
      return { bg:"#fef3c7", color:"#92400e" }; // 黃
    case "飯店":
      return { bg:"#dcfce7", color:"#166534" }; // 綠
    default:
      return { bg:"#e5e7eb", color:"#374151" }; // 灰
  }
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

  const pageWidth = Math.round(window.innerWidth * 0.88);
  const gap = Math.round(window.innerWidth * 0.06);
  const step = pageWidth + gap;

  project.days.forEach(day=>{
    const page = document.createElement("div");

    page.style.width = pageWidth + "px";
    page.style.marginLeft = gap/2 + "px";
    page.style.marginRight = gap/2 + "px";
    page.style.flexShrink = "0";

    const card = document.createElement("div");
    card.style.background="#fff";
    card.style.borderRadius="26px";
    card.style.padding="18px";
    card.style.boxShadow = "0 20px 40px rgba(0,0,0,0.12)";
card.style.border = "1px solid rgba(255,255,255,0.4)";
card.style.backdropFilter = "blur(10px)";

    const title = document.createElement("h2");
    title.innerText=day.title;
    title.style.fontSize="26px";
    title.style.marginBottom="10px";

    card.appendChild(title);

    day.activities.forEach((act) => {

      // ⭐⭐⭐ 卡片 row ⭐⭐⭐
      const row = document.createElement("div");

      const style = getCategoryStyle(act.category);

      row.style.display="flex";
      row.style.flexDirection="column";
      row.style.padding="14px 12px";
      row.style.marginTop="10px";
      row.style.borderRadius="14px";
      row.style.transition = "transform 0.2s ease, opacity 0.2s ease";
row.style.backdropFilter = "blur(6px)";

      // ⭐ 分類背景（重點🔥）
      row.style.background = style.bg;

      // ⭐ 左側色條
      row.style.borderLeft = `4px solid ${style.color}`;

      row.style.boxShadow="0 4px 14px rgba(0,0,0,0.06)";

      // ===== 長按 =====
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

      // ===== 上排 =====
      const top = document.createElement("div");
      top.style.display="flex";
      top.style.alignItems="flex-start";
      top.style.gap="12px";

      const cb = document.createElement("input");
      cb.type="checkbox";
      cb.checked=act.done;
      cb.style.transform="scale(1.2)";
      cb.style.marginTop="4px";

      cb.onchange = async () => {

  row.style.transform = "scale(0.96)";
  row.style.opacity = "0.5";

  if (navigator.vibrate) navigator.vibrate(10); // iOS 震動

  setTimeout(() => {
    act.done = cb.checked;
    render();
  }, 180);

  await updateActivity(act.id, cb.checked);
};

      const info = document.createElement("div");
      info.style.flex="1";

      const name = document.createElement("div");
      name.innerText=act.name;
      name.style.fontWeight="700";
      name.style.fontSize="16px";

      // ⭐ 金額（你要的金色 + 藍字）
      const price = document.createElement("div");
      price.innerText = `¥${act.cost.toLocaleString()}`;
      price.style.background = "linear-gradient(135deg,#fde68a,#facc15)";
      price.style.color = "#1d4ed8";
      price.style.display = "inline-block";
      price.style.padding = "6px 12px";
      price.style.borderRadius = "999px";
      price.style.fontWeight = "800";
      price.style.fontSize = "14px";
      price.style.marginTop = "6px";
      price.style.boxShadow = "0 4px 10px rgba(250,204,21,0.5)";

      info.appendChild(name);
      info.appendChild(price);

      // ⭐ 備註
      if(act.note){
        const note=document.createElement("div");
        note.innerText=act.note;
        note.style.fontSize="13px";
        note.style.color="#555";
        note.style.marginTop="6px";
        info.appendChild(note);
      }

      // ⭐ TAG
      const tagWrap=document.createElement("div");
      tagWrap.style.marginTop="6px";
      tagWrap.style.display="flex";
      tagWrap.style.flexWrap="wrap";
      tagWrap.style.gap="6px";

      const cat=document.createElement("span");
      cat.innerText=act.category;
      cat.style.background=style.bg;
      cat.style.color=style.color;
      cat.style.padding="4px 10px";
      cat.style.borderRadius="999px";
      cat.style.fontSize="12px";
      cat.style.fontWeight="700";

      tagWrap.appendChild(cat);

      parseNoteTags(act.note).forEach(t=>{
        const tag=document.createElement("span");
        tag.innerText=t;
        tag.style.background = "rgba(255,255,255,0.6)";
tag.style.backdropFilter = "blur(6px)";
tag.style.border = "1px solid rgba(255,255,255,0.4)";
        tag.style.padding="4px 8px";
        tag.style.borderRadius="999px";
        tag.style.fontSize="12px";
        tagWrap.appendChild(tag);
      });

      info.appendChild(tagWrap);


//備選餐廳
// ===== 右側按鈕容器 =====
const rightBtns = document.createElement("div");
rightBtns.style.display = "flex";
rightBtns.style.gap = "6px";
rightBtns.style.marginLeft = "auto";

// 🍽 備選（🔥改這裡）
if(act.category?.trim() === "食物"){
  const altBtn = document.createElement("button");
  altBtn.innerText = "🍽";

  altBtn.style.padding = "6px 10px";
  altBtn.style.borderRadius = "10px";
  altBtn.style.border = "none";
  altBtn.style.background = "rgba(255,255,255,0.6)";
  altBtn.style.backdropFilter = "blur(6px)";

  // ⭐ 沒資料 → 淡掉
  if(!act.alt?.name){
    altBtn.style.opacity = "0.4";
  }

  altBtn.onclick = (e)=>{
    e.stopPropagation();
    openFoodOptions(act);
  };

  rightBtns.appendChild(altBtn);
}
// 📍 地圖（只留這一個）
const mapBtn = document.createElement("button");
mapBtn.innerText = "📍";

mapBtn.style.padding = "6px 10px";
mapBtn.style.borderRadius = "10px";
mapBtn.style.border = "none";
mapBtn.style.background = "rgba(255,255,255,0.6)";
mapBtn.style.backdropFilter = "blur(6px)";

mapBtn.onclick = (e)=>{
  e.stopPropagation();
  if(act.map) window.open(act.map);
};

rightBtns.appendChild(mapBtn);

// ⭐⭐⭐ 唯一組裝（重點🔥）
top.appendChild(cb);
top.appendChild(info);
top.appendChild(rightBtns);

      row.appendChild(top);
      card.appendChild(row);
    });

    page.appendChild(card);
    track.appendChild(page);
  });

  container.appendChild(slider);

  // ===== snap =====
  function snap(){
  const pages = track.children;

  track.style.transition = "0.5s cubic-bezier(0.22,1,0.36,1)";
  track.style.transform = `translateX(-${currentDayIndex * step}px)`;

  for(let i=0;i<pages.length;i++){
    const dist = Math.abs(i - currentDayIndex);

    const scale = 1 - (dist * 0.08);
    const opacity = 1 - (dist * 0.35);

    pages[i].style.transform = `scale(${Math.max(scale,0.88)})`;
    pages[i].style.opacity = Math.max(opacity,0.4);
  }
}

  requestAnimationFrame(snap);

  // ===== 滑動 =====
  let start=0;

  slider.ontouchstart=e=>{
    start=e.touches[0].clientX;
  };

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
  const p = appData.projects[0];

  let total = 0;
  const stats = {};

  p.days.forEach(d=>{
    d.activities.forEach(a=>{
      if(a.done){
        total += a.cost;
        stats[a.category] = (stats[a.category]||0)+a.cost;
      }
    });
  });

  const card = document.createElement("div");
  card.style.background="#fff";
  card.style.margin="16px";
  card.style.padding="16px";
  card.style.borderRadius="20px";
  card.style.boxShadow="0 10px 30px rgba(0,0,0,0.08)";

  // ===== 標題 =====
  const title = document.createElement("div");
  title.innerText = "📊 花費統計";
  title.style.fontSize="22px";
  title.style.fontWeight="800";
  title.style.marginBottom="10px";
  card.appendChild(title);

  // ===== summary =====
  const summary = document.createElement("div");
  summary.innerHTML = `💰 ¥${total.toLocaleString()} / ¥${p.budget.total}`;
  summary.style.marginBottom="12px";
  summary.style.fontSize="16px";
  card.appendChild(summary);

  // ===== layout =====
  const layout = document.createElement("div");
  layout.style.display="flex";
  layout.style.gap="16px";
  layout.style.flexWrap="wrap";
  card.appendChild(layout);

  // ===== canvas =====
  const canvas = document.createElement("canvas");
  canvas.width = 220;
  canvas.height = 220;
  layout.appendChild(canvas);

  const list = document.createElement("div");
  list.style.flex="1";
  layout.appendChild(list);

  const ctx = canvas.getContext("2d");

  const entries = Object.entries(stats);
  const colors = ["#007aff","#34c759","#ff9500","#ff3b30","#af52de","#5ac8fa"];

  let activeIndex = -1;
  let progress = 0;

  // ===== 畫圖 =====
  function draw(){
    ctx.clearRect(0,0,220,220);

    let start = -Math.PI/2;

    entries.forEach(([cat,amount],i)=>{
      const angle = (amount/total)*Math.PI*2*progress;
      const end = start + angle;

      const isActive = i===activeIndex;
      const bump = isActive ? 10 : 0;

      const mid = (start+end)/2;
      const bx = Math.cos(mid)*bump;
      const by = Math.sin(mid)*bump;

      ctx.beginPath();
      ctx.moveTo(110+bx,110+by);
      ctx.fillStyle = colors[i%colors.length];
      ctx.arc(110+bx,110+by,80,start,end);
      ctx.closePath();
      ctx.fill();

      start = end;
    });

    // 中間文字
    ctx.fillStyle="#111";
    ctx.font="bold 14px sans-serif";
    ctx.textAlign="center";
    ctx.fillText("已花",110,100);

    ctx.font="bold 18px sans-serif";
    ctx.fillText(`¥${total.toLocaleString()}`,110,125);
  }



  
  // ===== 動畫 =====
  function animate(){
    progress += 0.05;
    if(progress>1) progress=1;
    draw();
    if(progress<1) requestAnimationFrame(animate);
  }

  animate();

  // ===== list =====
  function renderList(){
    list.innerHTML="";

    entries.forEach(([cat,amount],i)=>{
      const row = document.createElement("div");
      row.style.display="flex";
      row.style.justifyContent="space-between";
      row.style.padding="8px 0";
      row.style.cursor="pointer";

      const left = document.createElement("div");
      left.innerText = cat;

      const right = document.createElement("div");
      right.innerText = `¥${amount}`;

      if(i===activeIndex){
        left.style.fontWeight="800";
        right.style.fontWeight="800";
      }

      row.onclick=()=>{
        activeIndex = activeIndex===i ? -1 : i;
        draw();
        renderList();
      };

      row.appendChild(left);
      row.appendChild(right);
      list.appendChild(row);
    });
  }

  renderList();
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

  // ===== 防止重複開 =====
  if(document.getElementById("editorOverlay")) return;

  // ===== overlay =====
  const overlay = document.createElement("div");
  overlay.id = "editorOverlay";
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.25);
    opacity: 0;
    transition: opacity .25s ease;
    z-index: 999;
  `;

  // ===== sheet =====
  const sheet = document.createElement("div");
  sheet.id = "editorSheet";
  sheet.style.cssText = `
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    background: #fff;
    border-radius: 20px 20px 0 0;
    padding: 16px;
    padding-bottom: calc(20px + env(safe-area-inset-bottom));
    transform: translateY(110%);
    transition: transform .35s cubic-bezier(.22,1,.36,1);
    z-index: 1000;
  `;

  // ===== header =====
  const header = document.createElement("div");
  header.style.display="flex";
  header.style.justifyContent="space-between";
  header.style.alignItems="center";
  header.style.marginBottom="12px";

  const cancel = document.createElement("button");
  cancel.innerText="取消";
  cancel.style.border="none";
  cancel.style.background="transparent";
  cancel.style.color="#007aff";

  const title = document.createElement("div");
  title.innerText="編輯行程";
  title.style.fontWeight="800";

  const save = document.createElement("button");
  save.innerText="儲存";
  save.style.background="#007aff";
  save.style.color="#fff";
  save.style.border="none";
  save.style.padding="8px 14px";
  save.style.borderRadius="10px";

  header.appendChild(cancel);
  header.appendChild(title);
  header.appendChild(save);

  // ===== input =====
  function makeInput(value, type="text"){
    const i=document.createElement("input");
    i.value=value||"";
    i.type=type;
    i.style.cssText=`
      width:100%;
      padding:12px;
      border-radius:12px;
      border:1px solid #eee;
      margin-bottom:10px;
      font-size:16px;
    `;
    return i;
  }

  const name = makeInput(act.name);
  const cost = makeInput(act.cost, "number");
  const note = makeInput(act.note);
  const map = makeInput(act.map);

  const category = document.createElement("select");
  ["食物","景點","交通","飯店","其他"].forEach(c=>{
    const o=document.createElement("option");
    o.value=c;
    o.innerText=c;
    if(c===act.category) o.selected=true;
    category.appendChild(o);
  });
  category.style.cssText=`
    width:100%;
    padding:12px;
    border-radius:12px;
    border:1px solid #eee;
    margin-bottom:10px;
  `;

  // ===== append =====
  sheet.appendChild(header);
  sheet.appendChild(name);
  sheet.appendChild(cost);
  sheet.appendChild(category);
  sheet.appendChild(note);
  sheet.appendChild(map);

  document.body.appendChild(overlay);
  document.body.appendChild(sheet);

  // ===== 開啟動畫 =====
  setTimeout(()=>{
    overlay.style.opacity="1";
    sheet.style.transform="translateY(0)";
  },10);


  
  // ===== 關閉 =====
  function close(){
    overlay.style.opacity="0";
    sheet.style.transform="translateY(110%)";
    setTimeout(()=>{
      overlay.remove();
      sheet.remove();
    },300);
  }

  overlay.onclick = close;
  cancel.onclick = close;

  // ===== 儲存 =====
  save.onclick = async ()=>{
    act.name = name.value;
    act.cost = Number(cost.value)||0;
    act.category = category.value;
    act.note = note.value;
    act.map = map.value;

    close();
    render();

    await updateActivity(act.id, act.done);
  };
}



// =================
// 編輯
// =================
function openEditor(act){

  // ===== 防止重複開 =====
  if(document.getElementById("editorOverlay")) return;

  // ===== overlay =====
  const overlay = document.createElement("div");
  overlay.id = "editorOverlay";
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.25);
    opacity: 0;
    transition: opacity .25s ease;
    z-index: 999;
  `;

  // ===== sheet =====
  const sheet = document.createElement("div");
  sheet.id = "editorSheet";
  sheet.style.cssText = `
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    background: #fff;
    border-radius: 20px 20px 0 0;
    padding: 16px;
    padding-bottom: calc(20px + env(safe-area-inset-bottom));
    transform: translateY(110%);
    transition: transform .35s cubic-bezier(.22,1,.36,1);
    z-index: 1000;
  `;

  // ===== header =====
  const header = document.createElement("div");
  header.style.display="flex";
  header.style.justifyContent="space-between";
  header.style.alignItems="center";
  header.style.marginBottom="12px";

  const cancel = document.createElement("button");
  cancel.innerText="取消";
  cancel.style.border="none";
  cancel.style.background="transparent";
  cancel.style.color="#007aff";

  const title = document.createElement("div");
  title.innerText="編輯行程";
  title.style.fontWeight="800";

  const save = document.createElement("button");
  save.innerText="儲存";
  save.style.background="#007aff";
  save.style.color="#fff";
  save.style.border="none";
  save.style.padding="8px 14px";
  save.style.borderRadius="10px";

  header.appendChild(cancel);
  header.appendChild(title);
  header.appendChild(save);

  // ===== input =====
  function makeInput(value, type="text"){
    const i=document.createElement("input");
    i.value=value||"";
    i.type=type;
    i.style.cssText=`
      width:100%;
      padding:12px;
      border-radius:12px;
      border:1px solid #eee;
      margin-bottom:10px;
      font-size:16px;
    `;
    return i;
  }

  const name = makeInput(act.name);
  const cost = makeInput(act.cost, "number");
  const note = makeInput(act.note);
  const map = makeInput(act.map);

  const category = document.createElement("select");
  ["食物","景點","交通","飯店","其他"].forEach(c=>{
    const o=document.createElement("option");
    o.value=c;
    o.innerText=c;
    if(c===act.category) o.selected=true;
    category.appendChild(o);
  });
  category.style.cssText=`
    width:100%;
    padding:12px;
    border-radius:12px;
    border:1px solid #eee;
    margin-bottom:10px;
  `;

  // ===== append =====
  sheet.appendChild(header);
  sheet.appendChild(name);
  sheet.appendChild(cost);
  sheet.appendChild(category);
  sheet.appendChild(note);
  sheet.appendChild(map);

  document.body.appendChild(overlay);
  document.body.appendChild(sheet);

  // ===== 開啟動畫 =====
  setTimeout(()=>{
    overlay.style.opacity="1";
    sheet.style.transform="translateY(0)";
  },10);


  
  // ===== 關閉 =====
  function close(){
    overlay.style.opacity="0";
    sheet.style.transform="translateY(110%)";
    setTimeout(()=>{
      overlay.remove();
      sheet.remove();
    },300);
  }

  overlay.onclick = close;
  cancel.onclick = close;

  // ===== 儲存 =====
  save.onclick = async ()=>{
    act.name = name.value;
    act.cost = Number(cost.value)||0;
    act.category = category.value;
    act.note = note.value;
    act.map = map.value;

    close();
    render();

    await updateActivity(act.id, act.done);
  };
}
