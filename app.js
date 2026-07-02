// Clio Cal v1.0.4
const DB_NAME = 'clio-cal';
const DB_VERSION = 1;
const STORE = 'events';

let db;
let current = new Date();
current.setDate(1);
let selectedDate = fmtDate(new Date());

const monthLabel = document.getElementById('monthLabel');
const yearLabel = document.getElementById('yearLabel');
const weekRow = document.getElementById('weekRow');
const grid = document.getElementById('grid');
const dayPanel = document.getElementById('dayPanel');
const dayPanelTitle = document.getElementById('dayPanelTitle');
const dayPanelCount = document.getElementById('dayPanelCount');
const eventList = document.getElementById('eventList');
const sheetOverlay = document.getElementById('sheetOverlay');
const eventForm = document.getElementById('eventForm');
const sheetTitle = document.getElementById('sheetTitle');
const fTitle = document.getElementById('fTitle');
const fDate = document.getElementById('fDate');
const fTime = document.getElementById('fTime');
const fNotes = document.getElementById('fNotes');
const fReminder = document.getElementById('fReminder');
const fId = document.getElementById('fId');
const todayBtn = document.getElementById('todayBtn');
const deleteBtn = document.getElementById('deleteBtn');
const toast = document.getElementById('toast');
const profileBtn = document.getElementById('profileBtn');
const drawerOverlay = document.getElementById('drawerOverlay');
const closeDrawerBtn = document.getElementById('closeDrawerBtn');
const avatarBtn = document.getElementById('profileBtn');
const avatarBig = document.getElementById('avatarBig');
const greetingText = document.getElementById('greetingText');
const nameText = document.getElementById('nameText');
const editNameBtn = document.getElementById('editNameBtn');
const notifRow = document.getElementById('notifRow');
const notifStatus = document.getElementById('notifStatus');
const clearDataBtn = document.getElementById('clearDataBtn');

const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function fmtDate(d){
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function openDB(){
  return new Promise((resolve,reject)=>{
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e)=>{
      const _db = e.target.result;
      if(!_db.objectStoreNames.contains(STORE)){
        const store = _db.createObjectStore(STORE, {keyPath:'id'});
        store.createIndex('date','date',{unique:false});
      }
    };
    req.onsuccess = (e)=>resolve(e.target.result);
    req.onerror = (e)=>reject(e);
  });
}

function txStore(mode){
  return db.transaction(STORE, mode).objectStore(STORE);
}

function getAllEvents(){
  return new Promise((resolve,reject)=>{
    const req = txStore('readonly').getAll();
    req.onsuccess = ()=>resolve(req.result);
    req.onerror = (e)=>reject(e);
  });
}

function saveEvent(ev){
  return new Promise((resolve,reject)=>{
    const req = txStore('readwrite').put(ev);
    req.onsuccess = ()=>resolve();
    req.onerror = (e)=>reject(e);
  });
}

function deleteEvent(id){
  return new Promise((resolve,reject)=>{
    const req = txStore('readwrite').delete(id);
    req.onsuccess = ()=>resolve();
    req.onerror = (e)=>reject(e);
  });
}

let eventsByDate = {};

async function loadEvents(){
  const all = await getAllEvents();
  eventsByDate = {};
  all.forEach(ev=>{
    if(!eventsByDate[ev.date]) eventsByDate[ev.date] = [];
    eventsByDate[ev.date].push(ev);
  });
  Object.values(eventsByDate).forEach(list=>{
    list.sort((a,b)=> (a.time||'99:99').localeCompare(b.time||'99:99'));
  });
}

function renderWeekRow(){
  weekRow.innerHTML = WEEKDAYS.map(d=>`<div>${d}</div>`).join('');
}

function renderGrid(){
  const y = current.getFullYear();
  const m = current.getMonth();
  monthLabel.textContent = MONTHS[m];
  yearLabel.textContent = y;

  const firstDay = new Date(y,m,1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(y,m+1,0).getDate();
  const daysInPrevMonth = new Date(y,m,0).getDate();
  const todayStr = fmtDate(new Date());

  const cells = [];
  for(let i=startOffset-1;i>=0;i--){
    const dNum = daysInPrevMonth - i;
    cells.push({num:dNum, outside:true, dateStr:null});
  }
  for(let d=1; d<=daysInMonth; d++){
    const dateStr = y + '-' + String(m+1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    cells.push({num:d, outside:false, dateStr});
  }
  const remainder = (7 - (cells.length % 7)) % 7;
  for(let d=1; d<=remainder; d++){
    cells.push({num:d, outside:true, dateStr:null});
  }

  grid.innerHTML = cells.map(c=>{
    const classes = ['day'];
    if(c.outside) classes.push('outside');
    if(c.dateStr === todayStr) classes.push('today');
    if(c.dateStr === selectedDate) classes.push('selected');
    const hasEvents = c.dateStr && eventsByDate[c.dateStr] && eventsByDate[c.dateStr].length;
    return `<div class="${classes.join(' ')}" data-date="${c.dateStr||''}">
      <span class="num">${c.num}</span>
      ${hasEvents ? '<span class="dot"></span>' : ''}
    </div>`;
  }).join('');

  grid.querySelectorAll('.day').forEach(el=>{
    const dateStr = el.dataset.date;
    if(!dateStr) return;
    el.addEventListener('click', ()=>{
      selectedDate = dateStr;
      renderGrid();
      renderDayPanel();
    });
  });
}

function renderDayPanel(){
  const [y,m,d] = selectedDate.split('-').map(Number);
  const dateObj = new Date(y, m-1, d);
  const isToday = selectedDate === fmtDate(new Date());
  dayPanelTitle.textContent = isToday
    ? 'Today, ' + dateObj.toLocaleDateString('en-US',{month:'short', day:'numeric'})
    : dateObj.toLocaleDateString('en-US',{weekday:'short', month:'short', day:'numeric'});

  const list = eventsByDate[selectedDate] || [];
  dayPanelCount.textContent = list.length;
  dayPanel.classList.toggle('empty', list.length===0);

  eventList.innerHTML = list.map(ev=>`
    <li class="eventItem" data-id="${ev.id}">
      <span class="eventTime ${ev.time?'':'notime'}">${ev.time || '—'}</span>
      <div class="eventBody">
        <div class="t">${escapeHtml(ev.title)}</div>
        ${ev.notes ? `<div class="n">${escapeHtml(ev.notes)}</div>` : ''}
      </div>
    </li>
  `).join('');

  eventList.querySelectorAll('.eventItem').forEach(el=>{
    el.addEventListener('click', ()=>{
      const ev = list.find(e=>e.id === el.dataset.id);
      openSheet(ev);
    });
  });
}

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function openSheet(ev){
  eventForm.reset();
  if(ev){
    sheetTitle.textContent = 'Edit entry';
    fId.value = ev.id;
    fTitle.value = ev.title;
    fDate.value = ev.date;
    fTime.value = ev.time || '';
    fNotes.value = ev.notes || '';
    fReminder.value = ev.reminderMinutes ?? '';
    deleteBtn.classList.remove('hidden');
  } else {
    sheetTitle.textContent = 'New entry';
    fId.value = '';
    fDate.value = selectedDate;
    fReminder.value = '';
    deleteBtn.classList.add('hidden');
  }
  sheetOverlay.classList.add('open');
}

function closeSheet(){
  sheetOverlay.classList.remove('open');
}

function showToast(msg){
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(()=>toast.classList.remove('show'), 1800);
}

document.getElementById('prevMonth').addEventListener('click', ()=>{
  current.setMonth(current.getMonth()-1);
  renderGrid();
});
document.getElementById('nextMonth').addEventListener('click', ()=>{
  current.setMonth(current.getMonth()+1);
  renderGrid();
});
document.getElementById('fab').addEventListener('click', ()=>openSheet(null));
document.getElementById('cancelBtn').addEventListener('click', closeSheet);
sheetOverlay.addEventListener('click', (e)=>{
  if(e.target === sheetOverlay) closeSheet();
});

eventForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const reminderVal = fReminder.value;
  const ev = {
    id: fId.value || (Date.now().toString(36) + Math.random().toString(36).slice(2,7)),
    title: fTitle.value.trim(),
    date: fDate.value,
    time: fTime.value || '',
    notes: fNotes.value.trim(),
    reminderMinutes: reminderVal === '' ? null : Number(reminderVal),
    notified: false
  };

  if(ev.reminderMinutes !== null && 'Notification' in window && Notification.permission === 'default'){
    await Notification.requestPermission();
  }

  await saveEvent(ev);
  await loadEvents();
  selectedDate = ev.date;
  current = new Date(ev.date);
  current.setDate(1);
  renderGrid();
  renderDayPanel();
  closeSheet();
  showToast('Saved');
});

deleteBtn.addEventListener('click', async ()=>{
  if(!fId.value) return;
  await deleteEvent(fId.value);
  await loadEvents();
  renderGrid();
  renderDayPanel();
  closeSheet();
  showToast('Deleted');
});

// ---------- Reminders ----------
async function checkReminders(){
  if(!('Notification' in window) || Notification.permission !== 'granted') return;
  if(!('serviceWorker' in navigator)) return;

  let reg;
  try{
    reg = await navigator.serviceWorker.ready;
  } catch(err){
    return; // no active service worker yet
  }

  const now = new Date();
  const all = await getAllEvents();
  for(const ev of all){
    if(ev.reminderMinutes === null || ev.reminderMinutes === undefined || ev.notified) continue;
    if(!ev.time) continue; // reminders need a specific time
    const eventDT = new Date(`${ev.date}T${ev.time}:00`);
    const fireAt = new Date(eventDT.getTime() - ev.reminderMinutes * 60000);
    const graceEnd = new Date(eventDT.getTime() + 15 * 60000); // 15 min grace window
    if(now >= fireAt && now <= graceEnd){
      try{
        await reg.showNotification(ev.title, {
          body: ev.reminderMinutes === 0
            ? 'Starting now'
            : `In ${ev.reminderMinutes} min · ${ev.time}`,
          tag: ev.id,
          icon: 'icon.png'
        });
      } catch(err){
        console.error('Notification failed', err);
      }
      ev.notified = true;
      await saveEvent(ev);
    }
  }
}

setInterval(checkReminders, 30000);
document.addEventListener('visibilitychange', ()=>{
  if(document.visibilityState === 'visible') checkReminders();
});

// ---------- Today button ----------
todayBtn.addEventListener('click', ()=>{
  const today = new Date();
  current = new Date(today.getFullYear(), today.getMonth(), 1);
  selectedDate = fmtDate(today);
  renderGrid();
  renderDayPanel();
});

// ---------- Swipe to change month ----------
let touchStartX = null;
let touchStartY = null;
grid.addEventListener('touchstart', (e)=>{
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, {passive:true});

grid.addEventListener('touchend', (e)=>{
  if(touchStartX === null) return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  if(Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5){
    current.setMonth(current.getMonth() + (dx < 0 ? 1 : -1));
    renderGrid();
  }
  touchStartX = null;
  touchStartY = null;
}, {passive:true});

// ---------- Profile drawer ----------
const NAME_KEY = 'clio_cal_name';

function getName(){
  return localStorage.getItem(NAME_KEY) || 'Friend';
}

function setName(name){
  localStorage.setItem(NAME_KEY, name);
}

function getGreeting(){
  const h = new Date().getHours();
  if(h < 5) return 'Still up?';
  if(h < 12) return 'Good morning';
  if(h < 18) return 'Good afternoon';
  if(h < 22) return 'Good evening';
  return 'Good night';
}

function renderProfile(){
  const name = getName();
  const initial = name.trim().charAt(0).toUpperCase() || 'F';
  avatarBtn.textContent = initial;
  avatarBig.textContent = initial;
  greetingText.textContent = getGreeting() + (name !== 'Friend' ? ', ' + name : '');
  nameText.textContent = name;
  refreshNotifStatus();
}

function refreshNotifStatus(){
  if(!('Notification' in window)){
    notifStatus.textContent = 'Unsupported';
    return;
  }
  const map = {granted:'Enabled', denied:'Blocked', default:'Not set'};
  notifStatus.textContent = map[Notification.permission];
}

function openDrawer(){
  renderProfile();
  drawerOverlay.classList.add('open');
}
function closeDrawer(){
  drawerOverlay.classList.remove('open');
}

profileBtn.addEventListener('click', openDrawer);
closeDrawerBtn.addEventListener('click', closeDrawer);
drawerOverlay.addEventListener('click', (e)=>{
  if(e.target === drawerOverlay) closeDrawer();
});

editNameBtn.addEventListener('click', ()=>{
  const current = getName();
  const next = prompt('Your name', current === 'Friend' ? '' : current);
  if(next !== null && next.trim()){
    setName(next.trim());
    renderProfile();
  }
});

notifRow.addEventListener('click', async ()=>{
  if(!('Notification' in window)) return;
  if(Notification.permission === 'default'){
    await Notification.requestPermission();
    refreshNotifStatus();
  } else if(Notification.permission === 'denied'){
    showToast('Notifications are blocked in your browser settings');
  } else {
    showToast('Notifications are already on');
  }
});

clearDataBtn.addEventListener('click', async ()=>{
  const sure = confirm('Delete all events? This can\'t be undone.');
  if(!sure) return;
  const all = await getAllEvents();
  for(const ev of all){
    await deleteEvent(ev.id);
  }
  await loadEvents();
  renderGrid();
  renderDayPanel();
  closeDrawer();
  showToast('All events cleared');
});

async function init(){
  db = await openDB();
  await loadEvents();
  renderWeekRow();
  renderGrid();
  renderDayPanel();
  checkReminders();
  avatarBtn.textContent = getName().trim().charAt(0).toUpperCase() || 'F';

  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('sw.js');
  }
}

init();
    
