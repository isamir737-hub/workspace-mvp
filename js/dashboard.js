// Dashboard: персональная стартовая страница (#/dashboard).
// Читает данные только через store.js/kanban.js, ничего не пишет напрямую в localStorage.

import * as store from './store.js';
import * as router from './router.js';
import * as kanban from './kanban.js';

const PRIORITY_LABELS = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' };

const WEATHER_TEXT = {
  0: 'Ясно', 1: 'Преимущественно ясно', 2: 'Переменная облачность', 3: 'Пасмурно',
  45: 'Туман', 48: 'Изморозь',
  51: 'Лёгкая морось', 53: 'Морось', 55: 'Сильная морось',
  56: 'Ледяная морось', 57: 'Сильная ледяная морось',
  61: 'Небольшой дождь', 63: 'Дождь', 65: 'Сильный дождь',
  66: 'Ледяной дождь', 67: 'Сильный ледяной дождь',
  71: 'Небольшой снег', 73: 'Снег', 75: 'Сильный снег', 77: 'Снежные зёрна',
  80: 'Ливень', 81: 'Сильный ливень', 82: 'Очень сильный ливень',
  85: 'Небольшой снегопад', 86: 'Сильный снегопад',
  95: 'Гроза', 96: 'Гроза с градом', 99: 'Сильная гроза с градом',
};

// ---------- Общий вход ----------

export function renderDashboardPage(container) {
  const user = store.getCurrentUser();
  if (!user) return;

  container.className = 'main-content dashboard';
  container.innerHTML = '';

  container.appendChild(buildHeader(user));

  const grid = document.createElement('div');
  grid.className = 'dashboard-grid';
  grid.appendChild(buildClockCard());
  grid.appendChild(buildWeatherCard());
  grid.appendChild(buildMeetingsCard(user));
  grid.appendChild(buildTasksCard(user));
  grid.appendChild(buildStatsCard());
  grid.appendChild(buildAnnouncementsCard());
  container.appendChild(grid);
}

// ---------- Хелперы форматирования ----------

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function getGreeting(date) {
  const h = date.getHours();
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}

function formatShortDate(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function isOverdue(task) {
  if (!task.deadline || task.status === 'done') return false;
  return new Date(task.deadline).getTime() < Date.now();
}

function buildCardLink(label, onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'dashboard-card-action';
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  return btn;
}

function buildCard(titleText) {
  const card = document.createElement('div');
  card.className = 'dashboard-card';
  const title = document.createElement('p');
  title.className = 'dashboard-card-title';
  title.textContent = titleText;
  card.appendChild(title);
  return card;
}

// ---------- Header (приветствие + быстрое действие) ----------

let headerEls = null; // {greetingEl, dateEl, user}

function buildHeader(user) {
  const header = document.createElement('div');
  header.className = 'dashboard-header';

  const left = document.createElement('div');

  const greeting = document.createElement('h2');
  greeting.className = 'dashboard-greeting';
  left.appendChild(greeting);

  const subtitle = document.createElement('p');
  subtitle.className = 'dashboard-subtitle';
  subtitle.textContent = 'Вот что запланировано на сегодня.';
  left.appendChild(subtitle);

  const dateLine = document.createElement('p');
  dateLine.className = 'dashboard-date';
  left.appendChild(dateLine);

  header.appendChild(left);

  const quickBtn = document.createElement('button');
  quickBtn.type = 'button';
  quickBtn.className = 'btn-primary';
  quickBtn.innerHTML = '<span class="plus" aria-hidden="true">+</span> Новая задача';
  quickBtn.addEventListener('click', () => kanban.openCreateTaskDrawer());
  header.appendChild(quickBtn);

  headerEls = { greetingEl: greeting, dateEl: dateLine, user };
  updateHeader();

  return header;
}

function updateHeader() {
  if (!headerEls) return;
  const now = new Date();
  headerEls.greetingEl.textContent = `${getGreeting(now)}, ${headerEls.user.name}`;
  headerEls.dateEl.textContent = capitalize(
    now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })
  );
}

// ---------- Дата и время (тикающие часы) ----------

let clockEls = null; // {root, timeEl}
let clockInterval = null;

function buildClockCard() {
  const card = buildCard('Дата и время');

  const timeEl = document.createElement('div');
  timeEl.className = 'clock-time';
  card.appendChild(timeEl);

  const metaEl = document.createElement('div');
  metaEl.className = 'clock-meta';
  card.appendChild(metaEl);

  clockEls = { root: card, timeEl, metaEl };
  // Рендерим первое значение сразу через прямые ссылки на элементы — card ещё не
  // вставлена в document (это происходит только после return из этой функции),
  // поэтому tickClock() (которая проверяет DOM-attachment) тут ещё сработать не может.
  updateClockDisplay();

  if (clockInterval) clearInterval(clockInterval);
  clockInterval = setInterval(tickClock, 1000);

  return card;
}

function updateClockDisplay() {
  const now = new Date();
  clockEls.timeEl.textContent = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  clockEls.metaEl.textContent = capitalize(
    now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })
  );
  updateHeader();
}

function tickClock() {
  // #mainContent — постоянный элемент shell'а, переиспользуемый всеми роутами,
  // поэтому проверяем именно то, что карточка часов всё ещё смонтирована,
  // а не просто что элемент существует где-то в DOM.
  if (!clockEls || !document.body.contains(clockEls.root)) {
    clearInterval(clockInterval);
    clockInterval = null;
    clockEls = null;
    return;
  }
  updateClockDisplay();
}

// ---------- Погода ----------

let weatherBodyEl = null;
let weatherState = { status: 'loading' };
let weatherRequestId = 0;

function weatherCodeToText(code) {
  return WEATHER_TEXT[code] || 'Погода';
}

async function fetchWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('weather api error');
  const data = await res.json();
  return {
    temp: data.current ? data.current.temperature_2m : null,
    code: data.current ? data.current.weather_code : null,
    tMin: data.daily ? data.daily.temperature_2m_min[0] : null,
    tMax: data.daily ? data.daily.temperature_2m_max[0] : null,
  };
}

async function fetchLocationName(lat, lon) {
  try {
    const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=ru`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.city || data.locality || data.principalSubdivision || null;
  } catch (e) {
    return null;
  }
}

function requestWeather() {
  const requestId = ++weatherRequestId;
  weatherState = { status: 'loading' };
  renderWeatherCard();

  if (!('geolocation' in navigator)) {
    weatherState = { status: 'denied' };
    renderWeatherCard();
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      if (requestId !== weatherRequestId) return; // страница уже покинута/перезапрошена
      const { latitude, longitude } = pos.coords;
      try {
        const [weather, locationName] = await Promise.all([
          fetchWeather(latitude, longitude),
          fetchLocationName(latitude, longitude),
        ]);
        if (requestId !== weatherRequestId) return;
        weatherState = { status: 'success', ...weather, locationName };
      } catch (e) {
        if (requestId !== weatherRequestId) return;
        weatherState = { status: 'unavailable' };
      }
      renderWeatherCard();
    },
    () => {
      if (requestId !== weatherRequestId) return;
      weatherState = { status: 'denied' };
      renderWeatherCard();
    },
    { timeout: 8000 }
  );
}

function buildWeatherCard() {
  const card = buildCard('Погода');
  const body = document.createElement('div');
  card.appendChild(body);
  weatherBodyEl = body;

  requestWeather();
  return card;
}

function renderWeatherCard() {
  // weatherBodyEl — собственный узел карточки (не общий #mainContent), поэтому
  // писать в него безопасно, даже пока карточка ещё не вставлена в document —
  // единственное, что защищает от «протухших» ответов после ухода со страницы,
  // это проверка weatherRequestId в requestWeather().
  if (!weatherBodyEl) return;
  const body = weatherBodyEl;
  body.innerHTML = '';

  if (weatherState.status === 'loading') {
    const p = document.createElement('p');
    p.className = 'weather-fallback';
    p.textContent = 'Определяем местоположение...';
    body.appendChild(p);
    return;
  }

  if (weatherState.status === 'denied' || weatherState.status === 'unavailable') {
    const p = document.createElement('p');
    p.className = 'weather-fallback';
    p.textContent = weatherState.status === 'denied'
      ? 'Не удалось определить местоположение'
      : 'Не удалось загрузить данные о погоде';
    body.appendChild(p);

    const retryBtn = document.createElement('button');
    retryBtn.type = 'button';
    retryBtn.className = 'btn-secondary btn-small';
    retryBtn.textContent = 'Повторить';
    retryBtn.addEventListener('click', requestWeather);
    body.appendChild(retryBtn);
    return;
  }

  const main = document.createElement('div');
  main.className = 'weather-main';
  const temp = document.createElement('span');
  temp.className = 'weather-temp';
  temp.textContent = (weatherState.temp !== null ? Math.round(weatherState.temp) : '—') + '°C';
  main.appendChild(temp);
  const desc = document.createElement('span');
  desc.className = 'weather-desc';
  desc.textContent = weatherCodeToText(weatherState.code);
  main.appendChild(desc);
  body.appendChild(main);

  if (weatherState.tMin !== null && weatherState.tMax !== null) {
    const range = document.createElement('div');
    range.className = 'weather-range';
    range.textContent = `Мин ${Math.round(weatherState.tMin)}°C · Макс ${Math.round(weatherState.tMax)}°C`;
    body.appendChild(range);
  }

  if (weatherState.locationName) {
    const loc = document.createElement('div');
    loc.className = 'weather-location';
    loc.textContent = weatherState.locationName;
    body.appendChild(loc);
  }
}

// ---------- Встречи на сегодня ----------

function getTodaysEventsForUser(user) {
  const now = new Date();
  const isToday = (iso) => {
    const d = new Date(iso);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  };
  return store.getCalendarEvents()
    .filter(ev => isToday(ev.startAt))
    .filter(ev => ev.creatorId === user.id || (ev.participantIds || []).includes(user.id))
    .sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
}

function buildMeetingItem(ev) {
  const row = document.createElement('div');
  row.className = 'meeting-item';

  const time = document.createElement('div');
  time.className = 'meeting-time';
  time.textContent = new Date(ev.startAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  row.appendChild(time);

  const info = document.createElement('div');
  info.className = 'meeting-info';
  const title = document.createElement('div');
  title.className = 'meeting-title';
  title.textContent = ev.title;
  info.appendChild(title);
  if (ev.location) {
    const loc = document.createElement('div');
    loc.className = 'meeting-location';
    loc.textContent = ev.location;
    info.appendChild(loc);
  }
  row.appendChild(info);

  return row;
}

function buildMeetingsCard(user) {
  const card = buildCard('Встречи на сегодня');

  const events = getTodaysEventsForUser(user);
  if (events.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'dashboard-empty';
    empty.textContent = 'На сегодня встреч нет';
    card.appendChild(empty);
  } else {
    for (const ev of events.slice(0, 5)) {
      card.appendChild(buildMeetingItem(ev));
    }
  }

  card.appendChild(buildCardLink('Открыть календарь', () => router.navigate('calendar')));
  return card;
}

// ---------- Мои задачи ----------

function getMyTasksSorted(user) {
  const tasks = store.getTasks().filter(t => (t.assigneeId ? t.assigneeId === user.id : t.creatorId === user.id));
  return tasks.slice().sort((a, b) => {
    const overdueA = isOverdue(a) ? 0 : 1;
    const overdueB = isOverdue(b) ? 0 : 1;
    if (overdueA !== overdueB) return overdueA - overdueB;
    const da = a.deadline ? new Date(a.deadline).getTime() : Infinity;
    const db = b.deadline ? new Date(b.deadline).getTime() : Infinity;
    return da - db;
  });
}

function buildTaskMini(task) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'task-mini';
  btn.addEventListener('click', () => kanban.openEditTaskDrawer(task.id));

  const title = document.createElement('div');
  title.className = 'task-mini-title';
  title.textContent = task.title;
  btn.appendChild(title);

  const meta = document.createElement('div');
  meta.className = 'task-mini-meta';

  if (task.deadline) {
    const dl = document.createElement('span');
    dl.textContent = formatShortDate(task.deadline);
    if (isOverdue(task)) dl.classList.add('task-mini-deadline', 'overdue');
    meta.appendChild(dl);
  }

  const priority = document.createElement('span');
  const priorityKey = task.priority || 'medium';
  priority.className = 'priority-badge priority-' + priorityKey;
  priority.textContent = PRIORITY_LABELS[priorityKey] || priorityKey;
  meta.appendChild(priority);

  const status = document.createElement('span');
  status.className = 'status-badge';
  status.textContent = kanban.getColumnLabel(task.status);
  meta.appendChild(status);

  btn.appendChild(meta);
  return btn;
}

function buildTasksCard(user) {
  const card = buildCard('Мои задачи');
  card.classList.add('span-2');

  const tasks = getMyTasksSorted(user);
  if (tasks.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'dashboard-empty';
    empty.textContent = 'Нет задач, назначенных вам';
    card.appendChild(empty);
  } else {
    for (const task of tasks.slice(0, 5)) {
      card.appendChild(buildTaskMini(task));
    }
  }

  card.appendChild(buildCardLink('Открыть Kanban', () => router.navigate('kanban')));
  return card;
}

// ---------- Kanban statistics ----------

function buildStatRow(label, count, maxCount, isOverdueRow) {
  const row = document.createElement('div');
  row.className = 'stat-row' + (isOverdueRow ? ' overdue' : '');

  const labelEl = document.createElement('span');
  labelEl.className = 'stat-label';
  labelEl.textContent = label;
  row.appendChild(labelEl);

  const track = document.createElement('div');
  track.className = 'stat-bar-track';
  const fill = document.createElement('div');
  fill.className = 'stat-bar-fill';
  fill.style.width = Math.round((count / maxCount) * 100) + '%';
  track.appendChild(fill);
  row.appendChild(track);

  const countEl = document.createElement('span');
  countEl.className = 'stat-count';
  countEl.textContent = String(count);
  row.appendChild(countEl);

  return row;
}

function buildStatsCard() {
  const card = buildCard('Статистика Kanban');

  const tasks = store.getTasks();
  const columns = kanban.getColumnsMeta();
  const counts = columns.map(col => ({ label: col.label, count: tasks.filter(t => t.status === col.id).length }));
  const overdueCount = tasks.filter(isOverdue).length;
  const maxCount = Math.max(1, ...counts.map(c => c.count), overdueCount);

  for (const c of counts) {
    card.appendChild(buildStatRow(c.label, c.count, maxCount, false));
  }
  card.appendChild(buildStatRow('Overdue', overdueCount, maxCount, true));

  return card;
}

// ---------- Объявления компании ----------

function buildAnnouncementItem(ann) {
  const item = document.createElement('div');
  item.className = 'announcement-item';

  const title = document.createElement('div');
  title.className = 'announcement-title';
  title.textContent = ann.title;
  item.appendChild(title);

  const body = document.createElement('div');
  body.className = 'announcement-body';
  body.textContent = ann.body;
  item.appendChild(body);

  const author = store.getUserById(ann.authorId);
  const meta = document.createElement('div');
  meta.className = 'announcement-meta';
  meta.textContent = (author ? author.name : 'Компания') + ' · ' + formatShortDate(ann.publishedAt || ann.createdAt);
  item.appendChild(meta);

  return item;
}

function buildAnnouncementsCard() {
  const card = buildCard('Объявления компании');
  card.classList.add('span-2');

  // Dashboard показывает только активные объявления (архивные скрываются) и только
  // последние несколько — полный список/архив управляется в #/company.
  const announcements = store.getAnnouncements()
    .filter(a => a.active !== false)
    .slice()
    .sort((a, b) => new Date(b.publishedAt || b.createdAt) - new Date(a.publishedAt || a.createdAt))
    .slice(0, 5);
  if (announcements.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'dashboard-empty';
    empty.textContent = 'Пока нет объявлений';
    card.appendChild(empty);
  } else {
    for (const ann of announcements) {
      card.appendChild(buildAnnouncementItem(ann));
    }
  }

  return card;
}
