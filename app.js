(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const todayKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
  const parseDate = key => new Date(`${key}T12:00:00`);
  const dateLabel = key => parseDate(key).toLocaleDateString("it-IT",{weekday:"short",day:"2-digit",month:"2-digit"});
  const escapeHtml = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : `m-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const LEVEL_TITLES = ["Novizio","Esploratore","Costruttore","Disciplinato","Veterano","Elite","Maestro","Leggenda","Ascendente","Inevitabile"];
  const BADGES = [
    {id:"first",icon:"✦",name:"Primo passo",desc:"Completa la tua prima missione.",test:s=>Object.values(s.completions).reduce((n,a)=>n+a.length,0)>=1},
    {id:"five",icon:"◈",name:"In movimento",desc:"Completa 5 missioni.",test:s=>Object.values(s.completions).reduce((n,a)=>n+a.length,0)>=5},
    {id:"twentyfive",icon:"ϟ",name:"Forza dell'abitudine",desc:"Completa 25 missioni.",test:s=>Object.values(s.completions).reduce((n,a)=>n+a.length,0)>=25},
    {id:"xp100",icon:"⚡",name:"Energia pura",desc:"Raggiungi 100 XP totali.",test:s=>s.profile.totalXp>=100},
    {id:"xp500",icon:"⬡",name:"Veterano XP",desc:"Raggiungi 500 XP totali.",test:s=>s.profile.totalXp>=500},
    {id:"streak3",icon:"🔥",name:"Tre di fila",desc:"Completa missioni per 3 giorni consecutivi.",test:s=>calculateStreak(s)>=3}
  ];
  let state;
  let currentView = "dashboard";
  let currentFilter = "active";
  let toastTimer;
  let reminderTimer;

  function levelInfo(xp) {
    let level = 1, remainder = Math.max(0,xp);
    while (level < 100) {
      const need = 100 + (level-1)*25;
      if (remainder < need) return {level, within:remainder, need, title:LEVEL_TITLES[Math.min(level-1,LEVEL_TITLES.length-1)]};
      remainder -= need; level++;
    }
    return {level, within:0, need:100, title:"Leggenda"};
  }
  function occurrenceKey(mission, day) { return `${mission.id}@${day}`; }
  function scheduled(m, date) {
    if (m.archived) return false;
    if (m.type === "once") return m.dueDate === date;
    if (m.type === "weekly") return (m.days || []).includes(parseDate(date).getDay());
    return true;
  }
  function missionsForDay(day, includeArchived = false) {
    return state.missions.filter(m => (includeArchived || !m.archived) && scheduled(m,day));
  }
  function isDone(m, day) { return (state.completions[day] || []).includes(m.id); }
  function calculateStreak(s = state) {
    const days = Object.keys(s.completions).filter(d => s.completions[d]?.length).sort().reverse();
    if (!days.length) return 0;
    const today = todayKey(), yesterday = todayKey(new Date(Date.now()-86400000));
    if (days[0] !== today && days[0] !== yesterday) return 0;
    let streak=0, cursor=parseDate(days[0]);
    for (const d of days) {
      if (todayKey(cursor) !== d) break;
      streak++; cursor.setDate(cursor.getDate()-1);
    }
    return streak;
  }
  function totalCompleted(s = state) { return Object.values(s.completions).reduce((n,a)=>n+a.length,0); }
  function showToast(message) {
    const el=$("toast"); el.textContent=message; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove("show"),2600);
  }
  async function persist() {
    try { await LevelDB.save(state); }
    catch(e) { console.error(e); showToast("Problema nel salvataggio: controlla lo spazio disponibile."); }
  }
  function renderLevel() {
    const info=levelInfo(state.profile.totalXp);
    $("levelNumber").textContent=info.level;
    $("levelTitle").textContent=info.title.toUpperCase();
    $("xpTotal").textContent=`${state.profile.totalXp} XP`;
    $("xpProgressText").textContent=`${info.within} / ${info.need} XP`;
    $("xpProgress").style.width=`${Math.min(100,info.within/info.need*100)}%`;
    $("profileLevel").textContent=`Livello ${info.level} · ${info.title}`;
    $("statsXP").textContent=state.profile.totalXp;
    $("statsCompleted").textContent=totalCompleted();
  }
  function missionCard(m, day, showStatus=true) {
    const done=isDone(m,day);
    const category=escapeHtml(m.category);
    const typeLabel=m.type==="daily"?"Giornaliera":m.type==="weekly"?"Settimanale":"Una volta";
    const description=m.description ? `<p>${escapeHtml(m.description)}</p>` : `<p>${typeLabel}${m.time?` · Promemoria ${escapeHtml(m.time)}`:""}</p>`;
    return `<article class="mission-card ${done?"completed":""}" data-card="${escapeHtml(m.id)}">
      <button class="check-button" data-action="toggle" data-id="${escapeHtml(m.id)}" data-day="${day}" aria-label="${done?"Segna come non completata":"Completa missione"}">${done?"✓":""}</button>
      <div class="mission-info"><strong>${escapeHtml(m.name)}</strong>${description}<div class="mission-meta"><span class="tag">${category}</span><span class="tag tag-violet">${typeLabel}</span><span class="xp-pill">＋${m.xp} XP</span></div></div>
      ${showStatus?`<div class="mission-actions"><button class="tiny-action" data-action="edit" data-id="${escapeHtml(m.id)}" aria-label="Modifica missione">✎</button><button class="tiny-action" data-action="more" data-id="${escapeHtml(m.id)}" aria-label="Altre opzioni">⋯</button></div>`:""}
    </article>`;
  }
  function empty(text, sub) { return `<div class="empty-state"><strong>${escapeHtml(text)}</strong>${escapeHtml(sub)}</div>`; }
  function renderDashboard() {
    const day=todayKey(), planned=missionsForDay(day), done=planned.filter(m=>isDone(m,day)).length;
    $("todayLabel").textContent=new Date().toLocaleDateString("it-IT",{weekday:"long",day:"numeric",month:"long"});
    $("completionPercent").textContent=`${planned.length?Math.round(done/planned.length*100):0}%`;
    $("completionSub").textContent=`${done} di ${planned.length} missioni`;
    $("streakCount").textContent=calculateStreak();
    $("dailyMissionList").innerHTML=planned.length?planned.slice(0,5).map(m=>missionCard(m,day)).join(""):empty("Giornata libera?","Aggiungi la tua prima missione per iniziare il percorso.");
    const hasCompleted=done>0;
    const claimed=state.specialClaimed[day];
    $("specialTitle").textContent=claimed?"Sfida completata!":"La prima vittoria";
    $("specialDescription").textContent=claimed?"Bonus giornaliero già riscosso. Torna domani per una nuova sfida.":hasCompleted?"Hai già fatto un passo: riscuoti il bonus dalla sfida.":"Completa una missione oggi e riscuoti 25 XP bonus.";
  }
  function renderMissions() {
    const day=todayKey();
    let missions=state.missions;
    if(currentFilter==="active") missions=missions.filter(m=>!m.archived);
    if(currentFilter==="archived") missions=missions.filter(m=>m.archived);
    if(currentFilter==="active") missions=missions.slice().sort((a,b)=>Number(isDone(a,day))-Number(isDone(b,day)));
    $("allMissionList").innerHTML=missions.length?missions.map(m=>{
      const occurrence=scheduled(m,day)?day:(m.type==="once"?m.dueDate:day);
      const card=missionCard(m,occurrence,true);
      return m.archived?card.replace('class="mission-card ', 'class="mission-card archived-card '):card;
    }).join(""):empty(currentFilter==="archived"?"Nessuna missione archiviata":currentFilter==="all"?"Nessuna missione ancora":"Nessuna missione attiva","Usa il pulsante + per creare la tua prima missione.");
    document.querySelectorAll("#missionFilters .filter-chip").forEach(b=>b.classList.toggle("selected",b.dataset.filter===currentFilter));
  }
  function lastDays(n=7) { const a=[]; for(let i=n-1;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);a.push(todayKey(d));}return a; }
  function renderBarChart(containerId, values, labels, xp=false) {
    const max=Math.max(1,...values);
    $(containerId).innerHTML=values.map((v,i)=>`<div class="bar-item"><span class="bar-value">${v}</span><div class="bar-track"><div class="bar-fill" style="height:${Math.max(v?4:1,v/max*100)}%"></div></div><span class="bar-label">${labels[i]}</span></div>`).join("");
  }
  function renderStats() {
    const days=lastDays();
    renderBarChart("weeklyChart",days.map(d=>(state.completions[d]||[]).length),days.map(d=>parseDate(d).toLocaleDateString("it-IT",{weekday:"short"})));
    renderBarChart("xpChart",days.map(d=>state.xpEvents.filter(e=>e.date===d).reduce((sum,e)=>sum+e.amount,0)),days.map(d=>parseDate(d).toLocaleDateString("it-IT",{weekday:"short"})),true);
    const unlocked=BADGES.filter(b=>b.test(state)).length;
    $("statsBadges").textContent=unlocked;
    $("badgeList").innerHTML=BADGES.map(b=>`<article class="badge-card ${b.test(state)?"unlocked":""}"><span class="badge-symbol">${b.icon}</span><div><strong>${b.name}</strong><small>${b.desc}${b.test(state)?" · Sbloccato":" · Da sbloccare"}</small></div></article>`).join("");
  }
  function render() { renderLevel();renderDashboard();renderMissions();renderStats(); }
  function navigate(view) {
    currentView=view;
    document.querySelectorAll(".view").forEach(el=>el.classList.toggle("active",el.id===`${view}View`));
    document.querySelectorAll(".nav-item").forEach(el=>el.classList.toggle("active",el.dataset.view===view));
    if(view==="missions")renderMissions(); if(view==="stats")renderStats();
    window.scrollTo({top:0,behavior:"smooth"});
  }
  function openMission(m=null) {
    $("missionForm").reset();
    $("missionId").value=m?.id||"";
    $("dialogTitle").textContent=m?"Modifica missione":"Nuova missione";
    $("missionName").value=m?.name||"";
    $("missionCategory").value=m?.category||"Personale";
    $("missionType").value=m?.type||"daily";
    $("missionXP").value=m?.xp??20;
    $("missionDifficulty").value=m?.difficulty||2;
    $("missionTime").value=m?.time||"";
    $("missionDescription").value=m?.description||"";
    const days=m?.days||[1,2,3,4,5];
    document.querySelectorAll("#weekDays input").forEach(i=>i.checked=days.includes(Number(i.value)));
    $("weekDays").hidden=$("missionType").value!=="weekly";
    $("missionType").onchange=()=>{$("weekDays").hidden=$("missionType").value!=="weekly";};
    $("missionDialog").showModal();
    setTimeout(()=>$("missionName").focus(),80);
  }
  function closeMission() { $("missionDialog").close(); }
  async function saveMission(event) {
    event.preventDefault();
    const id=$("missionId").value, type=$("missionType").value;
    const days=[...document.querySelectorAll("#weekDays input:checked")].map(i=>Number(i.value));
    if(type==="weekly"&&!days.length){showToast("Seleziona almeno un giorno della settimana.");return;}
    const existing=state.missions.find(m=>m.id===id);
    const m={
      id:id||uuid(), name:$("missionName").value.trim(), category:$("missionCategory").value,
      type, days:type==="weekly"?days:[], xp:Math.min(500,Math.max(5,Number($("missionXP").value)||20)),
      difficulty:Number($("missionDifficulty").value)||1, time:$("missionTime").value,
      description:$("missionDescription").value.trim(), archived:existing?.archived||false,
      createdAt:existing?.createdAt||new Date().toISOString(), dueDate:existing?.dueDate||todayKey()
    };
    if(!m.name){showToast("Inserisci un nome per la missione.");return;}
    if(existing) state.missions=state.missions.map(x=>x.id===id?m:x); else state.missions.push(m);
    await persist();closeMission();render();showToast(existing?"Missione aggiornata.":"Missione creata.");navigate(currentView);
  }
  async function toggleMission(id,day) {
    const m=state.missions.find(x=>x.id===id); if(!m)return;
    if(!scheduled(m,day)){showToast("Questa missione non è pianificata per oggi.");return;}
    const arr=state.completions[day]||(state.completions[day]=[]);
    const idx=arr.indexOf(id);
    if(idx>=0) {
      arr.splice(idx,1);
      const ev=state.xpEvents.findIndex(e=>e.key===occurrenceKey(m,day)&&e.kind==="mission");
      if(ev>=0){state.profile.totalXp=Math.max(0,state.profile.totalXp-state.xpEvents[ev].amount);state.xpEvents.splice(ev,1);}
      showToast("Missione riaperta. XP aggiornati.");
    } else {
      arr.push(id);
      const key=occurrenceKey(m,day);
      if(!state.xpEvents.some(e=>e.key===key&&e.kind==="mission")) {
        state.profile.totalXp+=m.xp;
        state.xpEvents.push({id:uuid(),key,kind:"mission",missionId:id,date:day,amount:m.xp,createdAt:new Date().toISOString()});
      }
      showToast(`Missione completata: +${m.xp} XP!`);
    }
    state.profile.streak=calculateStreak();
    await persist();render();
  }
  async function claimSpecial() {
    const day=todayKey();
    if(state.specialClaimed[day]){showToast("Hai già riscosso il bonus di oggi.");return;}
    if(!(state.completions[day]||[]).length){showToast("Completa almeno una missione per sbloccare il bonus.");return;}
    state.specialClaimed[day]=true;state.profile.totalXp+=25;
    state.xpEvents.push({id:uuid(),key:`special@${day}`,kind:"special",date:day,amount:25,createdAt:new Date().toISOString()});
    await persist();render();showToast("Bonus riscosso: +25 XP!");
  }
  async function moreMission(id) {
    const m=state.missions.find(x=>x.id===id);if(!m)return;
    const action=prompt(`Opzioni per "${m.name}"\nScrivi: archivia, riattiva oppure elimina`,m.archived?"riattiva":"archivia");
    if(!action)return;
    const a=action.trim().toLowerCase();
    if(a==="archivia"||a==="riattiva"){m.archived=a==="archivia";await persist();render();showToast(m.archived?"Missione archiviata.":"Missione riattivata.");}
    else if(a==="elimina"){
      if(!confirm("Eliminare questa missione? Lo storico delle XP già guadagnate verrà mantenuto."))return;
      state.missions=state.missions.filter(x=>x.id!==id);await persist();render();showToast("Missione eliminata.");
    } else showToast("Opzione non riconosciuta.");
  }
  function download(filename,content,type) {
    const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  function exportJSON() {
    download(`level-up-backup-${todayKey()}.json`,JSON.stringify({...state,exportedAt:new Date().toISOString(),app:"LEVEL UP"},null,2),"application/json");
    showToast("Backup JSON esportato.");
  }
  function exportCSV() {
    const rows=[["Data","Missione","Categoria","XP","Stato","Ricorrenza"]];
    const days=Object.keys(state.completions).sort();
    for(const day of days) for(const id of state.completions[day]) {
      const m=state.missions.find(x=>x.id===id);
      rows.push([day,m?.name||id,m?.category||"",state.xpEvents.find(e=>e.key===`${id}@${day}`)?.amount||0,"Completata",m?.type||""]);
    }
    const csv=rows.map(row=>row.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(";")).join("\r\n");
    download(`level-up-statistiche-${todayKey()}.csv`,"\ufeff"+csv,"text/csv;charset=utf-8");
    showToast("CSV esportato.");
  }
  async function importJSON(file) {
    try {
      const incoming=JSON.parse(await file.text());
      if(incoming.schemaVersion!==1||!Array.isArray(incoming.missions)||!incoming.completions||!incoming.profile||!Array.isArray(incoming.xpEvents))throw new Error("Il file non sembra un backup LEVEL UP valido.");
      if(!confirm("Importare il backup? I dati attuali verranno sostituiti."))return;
      state={...LevelDB.defaults(),...incoming};
      delete state.exportedAt;delete state.app;
      await persist();render();showToast("Backup ripristinato.");navigate("dashboard");
    } catch(e){showToast(e.message||"Impossibile importare il file.");}
    $("importFile").value="";
  }
  async function requestNotifications() {
    if(!("Notification" in window)){showToast("Questo browser non supporta le notifiche.");return;}
    if(!window.isSecureContext){showToast("Per le notifiche apri l'app tramite HTTPS o localhost.");return;}
    try {
      const permission=await Notification.requestPermission();
      state.settings.notifications=permission==="granted";await persist();updateNotificationStatus();
      showToast(permission==="granted"?"Notifiche abilitate mentre l'app è aperta.":"Permesso notifiche non concesso.");
      if(permission==="granted") checkReminders(true);
    } catch(_){showToast("Non è stato possibile attivare le notifiche.");}
  }
  function updateNotificationStatus() {
    $("notificationStatus").textContent=!window.isSecureContext?"Disponibili solo via HTTPS o localhost":!("Notification" in window)?"Browser non compatibile":Notification.permission==="granted"?"Attive quando l'app è aperta":Notification.permission==="denied"?"Bloccate nelle impostazioni del browser":"Non ancora autorizzate";
    $("notificationButton").textContent=state.settings.notifications?"Attive":"Attiva";
  }
  function checkReminders(force=false) {
    if(!state?.settings?.notifications||!("Notification" in window)||Notification.permission!=="granted")return;
    const now=new Date(),day=todayKey(),minute=`${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
    for(const m of missionsForDay(day)) {
      const key=`reminded:${m.id}@${day}`;
      if(m.time===minute&&!isDone(m,day)&&!sessionStorage.getItem(key)) {
        try { new Notification("LEVEL UP · Missione",{body:`È il momento di: ${m.name}`,icon:"./icons/icon-192.png"});sessionStorage.setItem(key,"1"); } catch(_){}
      }
    }
  }
  function wireEvents() {
    document.querySelectorAll(".nav-item").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.view)));
    document.querySelectorAll("[data-nav]").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.nav)));
    $("profileButton").addEventListener("click",()=>navigate("profile"));
    $("quickAddButton").addEventListener("click",()=>openMission());
    $("floatingAdd").addEventListener("click",()=>openMission());
    $("closeDialog").addEventListener("click",closeMission);$("cancelDialog").addEventListener("click",closeMission);
    $("missionForm").addEventListener("submit",saveMission);
    $("missionFilters").addEventListener("click",e=>{const b=e.target.closest("[data-filter]");if(!b)return;currentFilter=b.dataset.filter;renderMissions();});
    document.body.addEventListener("click",e=>{
      const b=e.target.closest("[data-action]");if(!b)return;
      const {action,id,day}=b.dataset;
      if(action==="toggle")toggleMission(id,day);
      if(action==="edit")openMission(state.missions.find(m=>m.id===id));
      if(action==="more")moreMission(id);
    });
    $("specialTitle").parentElement.parentElement.addEventListener("click",claimSpecial);
    $("exportJson").addEventListener("click",exportJSON);$("exportCsv").addEventListener("click",exportCSV);
    $("importButton").addEventListener("click",()=>$("importFile").click());
    $("importFile").addEventListener("change",e=>{if(e.target.files[0])importJSON(e.target.files[0]);});
    $("notificationButton").addEventListener("click",requestNotifications);
    $("resetButton").addEventListener("click",async()=>{
      if(confirm("Vuoi davvero cancellare tutte le missioni, gli XP e lo storico? Questa operazione non si può annullare.")){
        await LevelDB.clear();state=LevelDB.defaults();await persist();render();showToast("Dati locali azzerati.");navigate("dashboard");
      }
    });
    document.addEventListener("visibilitychange",()=>{if(!document.hidden)checkReminders();});
    window.addEventListener("focus",()=>checkReminders());
    reminderTimer=setInterval(checkReminders,15000);
  }
  async function init() {
    state=await LevelDB.load();
    if(!state||state.schemaVersion!==1)state=LevelDB.defaults();
    state.missions=Array.isArray(state.missions)?state.missions:[];
    state.completions=state.completions||{};state.xpEvents=Array.isArray(state.xpEvents)?state.xpEvents:[];
    state.settings=state.settings||{notifications:false};state.specialClaimed=state.specialClaimed||{};
    state.profile=state.profile||{totalXp:0,streak:0,lastActiveDate:null};
    wireEvents();render();updateNotificationStatus();
    if("serviceWorker" in navigator && (location.protocol==="https:"||location.hostname==="localhost"||location.hostname==="127.0.0.1")) {
      navigator.serviceWorker.register("./service-worker.js").catch(err=>console.warn("Service worker non registrato",err));
    }
    if(!state.missions.length) {
      state.missions=[
        {id:uuid(),name:"Muovi il corpo per 15 minuti",category:"Fitness",type:"daily",days:[],xp:20,difficulty:1,time:"",description:"Una breve sessione è già un buon inizio.",archived:false,createdAt:new Date().toISOString(),dueDate:todayKey()},
        {id:uuid(),name:"Leggi 10 pagine",category:"Personale",type:"daily",days:[],xp:15,difficulty:1,time:"",description:"Investi un po' di tempo in te stesso.",archived:false,createdAt:new Date().toISOString(),dueDate:todayKey()},
        {id:uuid(),name:"Pianifica le 3 priorità",category:"Lavoro",type:"weekly",days:[1,2,3,4,5],xp:20,difficulty:2,time:"",description:"Scegli cosa conta davvero oggi.",archived:false,createdAt:new Date().toISOString(),dueDate:todayKey()}
      ];
      await persist();render();
    }
  }
  init().catch(err=>{console.error(err);document.body.insertAdjacentHTML("beforeend",'<p style="padding:20px;color:#ff788c">Errore inizializzazione. Ricarica l’app e riprova.</p>');});
})();