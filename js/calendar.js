// Внутренний календарь компании (#/calendar). Совместно отображает CalendarEvent
// и Task deadlines — визуально, без превращения Task в CalendarEvent.
// Все обращения к данным идут через store.js / kanban.js (общий Task drawer).

import * as store from './store.js';
import * as kanban from './kanban.js';
import * as notifications from './notifications.js';
import { showToast } from './toast.js';

const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTH_CELL_MAX_ENTRIES = 3;
const HOUR_HEIGHT = 48; // px за час в week-grid
const DEFAULT_START_HOUR = 8;
const DEFAULT_END_HOUR = 20;

let currentView = 'month'; // 'month' | 'week' | 'day'
let currentDate = new Date(); // «якорная» дата — сохраняется при смене view

let gridEl = null;
let periodLabelEl = null;
let viewButtons = {};

// ---------- Публичный вход ----------

export function renderCalendarPage(container) {
  container.className = 'main-content calendar-page';
  container.innerHTML = '';
  container.appendChild(buildHeader());
  container.appendChild(buildToolbar());

  gridEl = document.createElement('div');
  gridEl.className = 'calendar-body';
  container.appendChild(gridEl);

  ensureEventDrawer();
  renderCalendarBody();
}

// ---------- Header / toolbar ----------

function buildHeader() {
  const header = document.createElement('div');
  header.className = 'calendar-header';

  const left = document.createElement('div');
  const title = document.createElement('h2');
  title.className = 'calendar-header-title';
  title.textContent = 'Календарь';
  left.appendChild(title);
  const subtitle = document.createElement('p');
  subtitle.className = 'calendar-header-subtitle';
  subtitle.textContent = 'Встречи, события и дедлайны задач.';
  left.appendChild(subtitle);
  header.appendChild(left);

  const newBtn = document.createElement('button');
  newBtn.type = 'button';
  newBtn.className = 'btn-primary';
  newBtn.innerHTML = '<span class="plus" aria-hidden="true">+</span> Новое событие';
  newBtn.addEventListener('click', () => openCreateEventDrawer(currentDate));
  header.appendChild(newBtn);

  return header;
}

function buildToolbar() {
  const toolbar = document.createElement('div');
  toolbar.className = 'calendar-toolbar';

  const nav = document.createElement('div');
  nav.className = 'calendar-nav';

  const todayBtn = document.createElement('button');
  todayBtn.type = 'button';
  todayBtn.className = 'btn-secondary btn-small';
  todayBtn.textContent = 'Сегодня';
  todayBtn.addEventListener('click', () => { currentDate = new Date(); renderCalendarBody(); });
  nav.appendChild(todayBtn);

  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = 'icon-btn';
  prevBtn.setAttribute('aria-label', 'Предыдущий период');
  prevBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>';
  prevBtn.addEventListener('click', () => shiftPeriod(-1));
  nav.appendChild(prevBtn);

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'icon-btn';
  nextBtn.setAttribute('aria-label', 'Следующий период');
  nextBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>';
  nextBtn.addEventListener('click', () => shiftPeriod(1));
  nav.appendChild(nextBtn);

  periodLabelEl = document.createElement('span');
  periodLabelEl.className = 'calendar-period-label';
  nav.appendChild(periodLabelEl);

  toolbar.appendChild(nav);

  const viewSwitch = document.createElement('div');
  viewSwitch.className = 'calendar-view-switch';
  viewSwitch.setAttribute('role', 'group');
  viewSwitch.setAttribute('aria-label', 'Режим отображения календаря');
  viewButtons = {};
  const views = [{ id: 'month', label: 'Месяц' }, { id: 'week', label: 'Неделя' }, { id: 'day', label: 'День' }];
  for (const v of views) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'view-switch-btn' + (currentView === v.id ? ' active' : '');
    btn.textContent = v.label;
    btn.addEventListener('click', () => setView(v.id));
    viewButtons[v.id] = btn;
    viewSwitch.appendChild(btn);
  }
  toolbar.appendChild(viewSwitch);

  return toolbar;
}

function shiftPeriod(dir) {
  if (currentView === 'month') currentDate = addMonths(currentDate, dir);
  else if (currentView === 'week') currentDate = addDays(currentDate, dir * 7);
  else currentDate = addDays(currentDate, dir);
  renderCalendarBody();
}

function setView(view) {
  currentView = view;
  Object.keys(viewButtons).forEach(key => viewButtons[key].classList.toggle('active', key === view));
  renderCalendarBody();
}

function renderCalendarBody() {
  if (!gridEl) return;
  gridEl.innerHTML = '';
  if (currentView === 'month') renderMonthView(gridEl, currentDate);
  else if (currentView === 'week') renderWeekView(gridEl, currentDate);
  else renderDayView(gridEl, currentDate);
  if (periodLabelEl) periodLabelEl.textContent = getPeriodLabel();
}

// ---------- Дата-утилиты ----------

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Вс..6=Сб
  const diff = (day === 0 ? -6 : 1) - day; // сдвиг к понедельнику
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d; }
function addMonths(date, n) { const d = new Date(date); d.setMonth(d.getMonth() + n); return d; }
function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function startOfMonth(date) { return new Date(date.getFullYear(), date.getMonth(), 1); }
function endOfMonth(date) { return new Date(date.getFullYear(), date.getMonth() + 1, 0); }
function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

function getPeriodLabel() {
  if (currentView === 'month') {
    return capitalize(currentDate.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }));
  }
  if (currentView === 'week') {
    const start = startOfWeek(currentDate);
    const end = addDays(start, 6);
    return formatDateRange(start, end);
  }
  return capitalize(currentDate.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
}

function formatDateRange(start, end) {
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  if (sameMonth) {
    const monthYear = end.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
    return `${start.getDate()}–${end.getDate()} ${monthYear}`;
  }
  const startPart = start.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  const endPart = end.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  return `${startPart} – ${endPart}`;
}

// ---------- Данные для отображения ----------

// Внутренний календарь компании показывает все события компании (общий team-calendar),
// а не только те, где текущий пользователь — участник.
function getVisibleEvents() {
  const currentUser = store.getCurrentUser();
  if (!currentUser) return [];
  return store.getCalendarEvents().filter(e => e.companyId === currentUser.companyId);
}

// Task deadlines в календаре — персональные: своя задача (assigneeId), либо
// (для мигрированных legacy-задач без assigneeId) свои же созданные задачи.
function getVisibleTaskDeadlines(currentUser) {
  if (!currentUser) return [];
  return store.getTasks().filter(t => {
    if (!t.deadline) return false;
    if (t.assigneeId) return t.assigneeId === currentUser.id;
    return t.creatorId === currentUser.id;
  });
}

function getEntriesForDay(date, events, taskDeadlines) {
  const dayEvents = events
    .filter(e => e.startAt && isSameDay(new Date(e.startAt), date))
    .map(e => ({ type: 'event', time: new Date(e.startAt), data: e }));
  const dayTasks = taskDeadlines
    .filter(t => isSameDay(new Date(t.deadline), date))
    .map(t => ({ type: 'task', time: new Date(t.deadline), data: t }));
  return dayEvents.concat(dayTasks).sort((a, b) => a.time - b.time);
}

function isTaskOverdue(task) {
  if (!task.deadline || task.status === 'done') return false;
  return new Date(task.deadline).getTime() < Date.now();
}

function openEntry(entry) {
  if (entry.type === 'event') openEditEventDrawer(entry.data.id);
  else kanban.openEditTaskDrawer(entry.data.id);
}

// ---------- Month view ----------

function renderMonthView(container, anchorDate) {
  const events = getVisibleEvents();
  const currentUser = store.getCurrentUser();
  const taskDeadlines = getVisibleTaskDeadlines(currentUser);
  const today = new Date();

  const monthStart = startOfMonth(anchorDate);
  const monthEnd = endOfMonth(anchorDate);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = addDays(startOfWeek(monthEnd), 6);

  const wrap = document.createElement('div');
  wrap.className = 'month-grid';

  const weekdayRow = document.createElement('div');
  weekdayRow.className = 'month-weekday-row';
  for (const label of WEEKDAY_LABELS) {
    const cell = document.createElement('div');
    cell.className = 'month-weekday';
    cell.textContent = label;
    weekdayRow.appendChild(cell);
  }
  wrap.appendChild(weekdayRow);

  const cellsWrap = document.createElement('div');
  cellsWrap.className = 'month-cells';

  let cursor = new Date(gridStart);
  while (cursor <= gridEnd) {
    const cellDate = new Date(cursor);
    const cell = document.createElement('div');
    cell.className = 'month-cell';
    if (cellDate.getMonth() !== anchorDate.getMonth()) cell.classList.add('is-muted');
    if (isSameDay(cellDate, today)) cell.classList.add('is-today');

    const dayNum = document.createElement('div');
    dayNum.className = 'month-cell-daynum';
    dayNum.textContent = String(cellDate.getDate());
    cell.appendChild(dayNum);

    const entries = getEntriesForDay(cellDate, events, taskDeadlines);
    const entriesWrap = document.createElement('div');
    entriesWrap.className = 'month-cell-entries';
    const visible = entries.slice(0, MONTH_CELL_MAX_ENTRIES);
    for (const entry of visible) {
      entriesWrap.appendChild(buildMonthEntryChip(entry));
    }
    if (entries.length > visible.length) {
      const more = document.createElement('button');
      more.type = 'button';
      more.className = 'month-cell-more';
      more.textContent = '+' + (entries.length - visible.length) + ' ещё';
      more.addEventListener('click', (e) => { e.stopPropagation(); currentDate = cellDate; setView('day'); });
      entriesWrap.appendChild(more);
    }
    cell.appendChild(entriesWrap);

    cell.addEventListener('click', () => openCreateEventDrawer(cellDate));

    cellsWrap.appendChild(cell);
    cursor = addDays(cursor, 1);
  }
  wrap.appendChild(cellsWrap);
  container.appendChild(wrap);
}

function buildMonthEntryChip(entry) {
  const chip = document.createElement('div');
  chip.className = 'cal-entry ' + (entry.type === 'event' ? 'cal-entry-event' : 'cal-entry-task');
  if (entry.type === 'task' && isTaskOverdue(entry.data)) chip.classList.add('cal-entry-overdue');
  const timeLabel = entry.time.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  chip.textContent = timeLabel + ' ' + entry.data.title;
  chip.title = entry.data.title;
  chip.addEventListener('click', (e) => { e.stopPropagation(); openEntry(entry); });
  return chip;
}

// ---------- Week view ----------

function renderWeekView(container, anchorDate) {
  const events = getVisibleEvents();
  const currentUser = store.getCurrentUser();
  const taskDeadlines = getVisibleTaskDeadlines(currentUser);
  const today = new Date();

  const weekStart = startOfWeek(anchorDate);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const dayEntries = days.map(d => getEntriesForDay(d, events, taskDeadlines));

  let startHour = DEFAULT_START_HOUR;
  let endHour = DEFAULT_END_HOUR;
  for (const entries of dayEntries) {
    for (const entry of entries) {
      const h = entry.time.getHours();
      if (h < startHour) startHour = h;
      if (h + 1 > endHour) endHour = h + 1;
    }
  }

  const wrap = document.createElement('div');
  wrap.className = 'week-grid';

  const headerRow = document.createElement('div');
  headerRow.className = 'week-header-row';
  const gutterHead = document.createElement('div');
  gutterHead.className = 'week-hour-gutter';
  headerRow.appendChild(gutterHead);
  days.forEach((d) => {
    const head = document.createElement('button');
    head.type = 'button';
    head.className = 'week-day-header' + (isSameDay(d, today) ? ' is-today' : '');
    const wd = document.createElement('div');
    wd.className = 'week-day-header-weekday';
    wd.textContent = WEEKDAY_LABELS[(d.getDay() + 6) % 7];
    head.appendChild(wd);
    const dn = document.createElement('div');
    dn.className = 'week-day-header-num';
    dn.textContent = String(d.getDate());
    head.appendChild(dn);
    head.addEventListener('click', () => { currentDate = new Date(d); setView('day'); });
    headerRow.appendChild(head);
  });
  wrap.appendChild(headerRow);

  const body = document.createElement('div');
  body.className = 'week-body';

  const hourGutter = document.createElement('div');
  hourGutter.className = 'week-hour-gutter';
  hourGutter.style.height = (endHour - startHour) * HOUR_HEIGHT + 'px';
  for (let h = startHour; h < endHour; h++) {
    const label = document.createElement('div');
    label.className = 'week-hour-label';
    label.style.height = HOUR_HEIGHT + 'px';
    label.textContent = String(h).padStart(2, '0') + ':00';
    hourGutter.appendChild(label);
  }
  body.appendChild(hourGutter);

  days.forEach((d, i) => {
    const col = document.createElement('div');
    col.className = 'week-day-col';
    col.style.height = (endHour - startHour) * HOUR_HEIGHT + 'px';

    for (let h = startHour; h <= endHour; h++) {
      const line = document.createElement('div');
      line.className = 'week-hour-line';
      line.style.top = (h - startHour) * HOUR_HEIGHT + 'px';
      col.appendChild(line);
    }

    for (const entry of dayEntries[i]) {
      col.appendChild(buildWeekEntryBlock(entry, startHour));
    }

    const colDate = new Date(d);
    col.addEventListener('click', (e) => { if (e.target === col) openCreateEventDrawer(colDate); });

    body.appendChild(col);
  });

  wrap.appendChild(body);
  container.appendChild(wrap);
}

function buildWeekEntryBlock(entry, startHour) {
  const block = document.createElement('div');
  block.className = 'week-entry ' + (entry.type === 'event' ? 'week-entry-event' : 'week-entry-task');
  if (entry.type === 'task' && isTaskOverdue(entry.data)) block.classList.add('week-entry-overdue');

  const hoursFromStart = (entry.time.getHours() - startHour) + entry.time.getMinutes() / 60;
  block.style.top = (hoursFromStart * HOUR_HEIGHT) + 'px';
  const durationHours = (entry.type === 'event' && entry.data.endAt)
    ? Math.max((new Date(entry.data.endAt) - entry.time) / 3600000, 0.5)
    : 0.6;
  block.style.height = (durationHours * HOUR_HEIGHT) + 'px';

  const timeEl = document.createElement('div');
  timeEl.className = 'week-entry-time';
  timeEl.textContent = entry.time.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  block.appendChild(timeEl);

  const titleEl = document.createElement('div');
  titleEl.className = 'week-entry-title';
  titleEl.textContent = entry.data.title;
  block.appendChild(titleEl);

  block.title = entry.data.title;
  block.addEventListener('click', (e) => { e.stopPropagation(); openEntry(entry); });
  return block;
}

// ---------- Day view ----------

function renderDayView(container, anchorDate) {
  const events = getVisibleEvents();
  const currentUser = store.getCurrentUser();
  const taskDeadlines = getVisibleTaskDeadlines(currentUser);

  const wrap = document.createElement('div');
  wrap.className = 'day-view';

  const header = document.createElement('div');
  header.className = 'day-view-header';
  header.textContent = capitalize(anchorDate.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }));
  wrap.appendChild(header);

  const entries = getEntriesForDay(anchorDate, events, taskDeadlines);

  if (entries.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'day-empty';
    empty.textContent = 'На этот день ничего не запланировано.';
    wrap.appendChild(empty);
  } else {
    const list = document.createElement('div');
    list.className = 'day-entry-list';
    for (const entry of entries) {
      list.appendChild(buildDayEntryRow(entry));
    }
    wrap.appendChild(list);
  }

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'btn-secondary btn-small day-add-btn';
  addBtn.textContent = '+ Добавить событие на этот день';
  addBtn.addEventListener('click', () => openCreateEventDrawer(anchorDate));
  wrap.appendChild(addBtn);

  container.appendChild(wrap);
}

function buildDayEntryRow(entry) {
  const row = document.createElement('button');
  row.type = 'button';
  row.className = 'day-entry ' + (entry.type === 'event' ? 'day-entry-event' : 'day-entry-task');
  if (entry.type === 'task' && isTaskOverdue(entry.data)) row.classList.add('day-entry-overdue');

  const time = document.createElement('div');
  time.className = 'day-entry-time';
  time.textContent = entry.time.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  row.appendChild(time);

  const body = document.createElement('div');
  body.className = 'day-entry-body';
  const title = document.createElement('div');
  title.className = 'day-entry-title';
  title.textContent = entry.data.title;
  body.appendChild(title);

  if (entry.type === 'event' && entry.data.location) {
    const loc = document.createElement('div');
    loc.className = 'day-entry-meta';
    loc.textContent = entry.data.location;
    body.appendChild(loc);
  }
  if (entry.type === 'task') {
    const meta = document.createElement('div');
    meta.className = 'day-entry-meta';
    meta.textContent = 'Дедлайн задачи';
    body.appendChild(meta);
  }
  row.appendChild(body);

  row.addEventListener('click', () => openEntry(entry));
  return row;
}

// ---------- Event drawer (создание/редактирование/удаление CalendarEvent) ----------

let eventDrawerBuilt = false;
let eventOverlayEl, eventModalTitleEl, eventFormEl;
let fieldEventTitle, fieldEventDescription;
let fieldEventStartDate, fieldEventStartTime, fieldEventEndDate, fieldEventEndTime;
let fieldEventLocation, fieldEventMeetingUrl, eventMeetingUrlHint, eventEndHintEl;
let participantListEl, eventDeleteBtn, eventCancelBtn, eventCloseBtn;
let editingEventId = null;

function buildFieldWrap(labelText) {
  const wrap = document.createElement('label');
  wrap.className = 'field';
  const label = document.createElement('span');
  label.className = 'field-label';
  label.textContent = labelText;
  wrap.appendChild(label);
  return wrap;
}

function buildInputField(labelText, type) {
  const wrap = buildFieldWrap(labelText);
  const input = document.createElement('input');
  input.type = type;
  wrap.appendChild(input);
  return { wrap, input };
}

function buildTextareaField(labelText) {
  const wrap = buildFieldWrap(labelText);
  const input = document.createElement('textarea');
  input.rows = 3;
  wrap.appendChild(input);
  return { wrap, input };
}

function ensureEventDrawer() {
  if (eventDrawerBuilt) return;
  eventDrawerBuilt = true;

  eventOverlayEl = document.createElement('div');
  eventOverlayEl.className = 'drawer-overlay';
  eventOverlayEl.hidden = true;

  const drawer = document.createElement('aside');
  drawer.className = 'drawer';

  const drawerHeader = document.createElement('div');
  drawerHeader.className = 'drawer-header';
  eventModalTitleEl = document.createElement('h2');
  eventModalTitleEl.textContent = 'Новое событие';
  drawerHeader.appendChild(eventModalTitleEl);
  eventCloseBtn = document.createElement('button');
  eventCloseBtn.type = 'button';
  eventCloseBtn.className = 'icon-btn';
  eventCloseBtn.setAttribute('aria-label', 'Закрыть');
  eventCloseBtn.textContent = '✕';
  drawerHeader.appendChild(eventCloseBtn);
  drawer.appendChild(drawerHeader);

  eventFormEl = document.createElement('form');
  eventFormEl.className = 'drawer-form';

  const body = document.createElement('div');
  body.className = 'drawer-body';

  const titleField = buildInputField('Название *', 'text');
  fieldEventTitle = titleField.input;
  fieldEventTitle.required = true;
  fieldEventTitle.maxLength = 120;
  fieldEventTitle.placeholder = 'Например, встреча с клиентом';
  body.appendChild(titleField.wrap);

  const descField = buildTextareaField('Описание');
  fieldEventDescription = descField.input;
  descField.input.placeholder = 'Необязательно';
  body.appendChild(descField.wrap);

  const startRow = document.createElement('div');
  startRow.className = 'field-row';
  const startDateField = buildInputField('Дата начала *', 'date');
  fieldEventStartDate = startDateField.input;
  fieldEventStartDate.required = true;
  startRow.appendChild(startDateField.wrap);
  const startTimeField = buildInputField('Время начала *', 'time');
  fieldEventStartTime = startTimeField.input;
  fieldEventStartTime.required = true;
  startRow.appendChild(startTimeField.wrap);
  body.appendChild(startRow);

  const endRow = document.createElement('div');
  endRow.className = 'field-row';
  const endDateField = buildInputField('Дата окончания', 'date');
  fieldEventEndDate = endDateField.input;
  endRow.appendChild(endDateField.wrap);
  const endTimeField = buildInputField('Время окончания', 'time');
  fieldEventEndTime = endTimeField.input;
  endRow.appendChild(endTimeField.wrap);
  body.appendChild(endRow);

  eventEndHintEl = document.createElement('span');
  eventEndHintEl.className = 'field-hint';
  body.appendChild(eventEndHintEl);

  const locRow = document.createElement('div');
  locRow.className = 'field-row';
  const locField = buildInputField('Location', 'text');
  fieldEventLocation = locField.input;
  locRow.appendChild(locField.wrap);
  const urlField = buildInputField('Meeting URL', 'text');
  fieldEventMeetingUrl = urlField.input;
  fieldEventMeetingUrl.placeholder = 'https://...';
  locRow.appendChild(urlField.wrap);
  body.appendChild(locRow);

  eventMeetingUrlHint = document.createElement('span');
  eventMeetingUrlHint.className = 'field-hint';
  body.appendChild(eventMeetingUrlHint);

  const participantsWrap = document.createElement('div');
  participantsWrap.className = 'field';
  const participantsLabel = document.createElement('span');
  participantsLabel.className = 'field-label';
  participantsLabel.textContent = 'Участники';
  participantsWrap.appendChild(participantsLabel);
  participantListEl = document.createElement('div');
  participantListEl.className = 'participant-list';
  participantsWrap.appendChild(participantListEl);
  body.appendChild(participantsWrap);

  eventFormEl.appendChild(body);

  const actions = document.createElement('div');
  actions.className = 'drawer-actions';
  eventDeleteBtn = document.createElement('button');
  eventDeleteBtn.type = 'button';
  eventDeleteBtn.className = 'btn-danger';
  eventDeleteBtn.textContent = 'Удалить';
  eventDeleteBtn.hidden = true;
  actions.appendChild(eventDeleteBtn);
  const actionsRight = document.createElement('div');
  actionsRight.className = 'drawer-actions-right';
  eventCancelBtn = document.createElement('button');
  eventCancelBtn.type = 'button';
  eventCancelBtn.className = 'btn-secondary';
  eventCancelBtn.textContent = 'Отмена';
  actionsRight.appendChild(eventCancelBtn);
  const saveBtn = document.createElement('button');
  saveBtn.type = 'submit';
  saveBtn.className = 'btn-primary';
  saveBtn.textContent = 'Сохранить';
  actionsRight.appendChild(saveBtn);
  actions.appendChild(actionsRight);
  eventFormEl.appendChild(actions);

  drawer.appendChild(eventFormEl);
  eventOverlayEl.appendChild(drawer);
  document.body.appendChild(eventOverlayEl);

  wireEventDrawerEvents();
}

// Уведомляет перечисленных participantIds о встрече (кроме создателя и неактивных
// пользователей). Используется и при создании (все участники), и при edit (только
// вновь добавленные) — вызывающий код сам решает, кого передать в participantIds.
function notifyEventParticipants(event, participantIds) {
  let notifiedAny = false;
  for (const pid of participantIds) {
    if (pid === event.creatorId) continue;
    const user = store.getUserById(pid);
    if (!user || user.active === false) continue;
    const result = store.createNotification({
      companyId: event.companyId,
      type: 'event_invitation',
      recipientId: pid,
      entityType: 'event',
      entityId: event.id,
      title: 'Приглашение на встречу',
      message: event.title,
    });
    if (result.ok) notifiedAny = true;
  }
  if (notifiedAny) notifications.refresh();
}

function renderParticipantList(selectedIds) {
  participantListEl.innerHTML = '';
  const currentUser = store.getCurrentUser();
  if (!currentUser) return;
  // Неактивных сотрудников не предлагаем для новых участников — но уже выбранного
  // (исторического) участника всё равно показываем, даже если он стал неактивен.
  const companyUsers = store.getUsers().filter(u =>
    u.companyId === currentUser.companyId && (u.active !== false || selectedIds.includes(u.id))
  );
  if (companyUsers.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'comments-empty';
    empty.textContent = 'Нет доступных сотрудников';
    participantListEl.appendChild(empty);
    return;
  }
  for (const user of companyUsers) {
    const row = document.createElement('label');
    row.className = 'participant-item';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = user.id;
    checkbox.checked = selectedIds.includes(user.id);
    row.appendChild(checkbox);
    const name = document.createElement('span');
    name.textContent = user.name + (user.id === currentUser.id ? ' (Я)' : '');
    row.appendChild(name);
    participantListEl.appendChild(row);
  }
}

function getSelectedParticipantIds() {
  return Array.from(participantListEl.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
}

function toDateInputValue(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function toTimeInputValue(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function openCreateEventDrawer(prefillDate) {
  editingEventId = null;
  eventModalTitleEl.textContent = 'Новое событие';
  eventFormEl.reset();
  const d = prefillDate instanceof Date ? prefillDate : new Date();
  fieldEventStartDate.value = toDateInputValue(d);
  fieldEventStartTime.value = '10:00';
  fieldEventEndDate.value = '';
  fieldEventEndTime.value = '';
  fieldEventLocation.value = '';
  fieldEventMeetingUrl.value = '';
  eventMeetingUrlHint.textContent = '';
  eventMeetingUrlHint.classList.remove('error');
  eventEndHintEl.textContent = '';
  eventEndHintEl.classList.remove('error');
  renderParticipantList([]);
  eventDeleteBtn.hidden = true;
  eventOverlayEl.hidden = false;
  fieldEventTitle.focus();
}

// Экспортируется, чтобы notifications.js мог открыть существующий Event drawer
// по entityId после клика на event_invitation — без создания второго drawer.
export function openEditEventDrawer(id) {
  const event = store.getCalendarEvent(id);
  if (!event) return;
  editingEventId = id;
  eventModalTitleEl.textContent = 'Событие';
  fieldEventTitle.value = event.title;
  fieldEventDescription.value = event.description || '';
  const start = new Date(event.startAt);
  fieldEventStartDate.value = toDateInputValue(start);
  fieldEventStartTime.value = toTimeInputValue(start);
  if (event.endAt) {
    const end = new Date(event.endAt);
    fieldEventEndDate.value = toDateInputValue(end);
    fieldEventEndTime.value = toTimeInputValue(end);
  } else {
    fieldEventEndDate.value = '';
    fieldEventEndTime.value = '';
  }
  fieldEventLocation.value = event.location || '';
  fieldEventMeetingUrl.value = event.meetingUrl || '';
  eventMeetingUrlHint.textContent = '';
  eventMeetingUrlHint.classList.remove('error');
  eventEndHintEl.textContent = '';
  eventEndHintEl.classList.remove('error');
  renderParticipantList(event.participantIds || []);
  eventDeleteBtn.hidden = false;
  eventOverlayEl.hidden = false;
  fieldEventTitle.focus();
}

function closeEventDrawer() {
  eventOverlayEl.hidden = true;
  editingEventId = null;
}

function wireEventDrawerEvents() {
  eventCancelBtn.addEventListener('click', closeEventDrawer);
  eventCloseBtn.addEventListener('click', closeEventDrawer);
  eventOverlayEl.addEventListener('click', (e) => { if (e.target === eventOverlayEl) closeEventDrawer(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !eventOverlayEl.hidden) closeEventDrawer();
  });

  eventDeleteBtn.addEventListener('click', () => {
    if (!editingEventId) return;
    const ok = store.deleteCalendarEvent(editingEventId);
    if (ok) {
      closeEventDrawer();
      renderCalendarBody();
    }
  });

  eventFormEl.addEventListener('submit', (e) => {
    e.preventDefault();

    const title = fieldEventTitle.value.trim();
    if (!title) { fieldEventTitle.focus(); return; }

    const startDateVal = fieldEventStartDate.value;
    const startTimeVal = fieldEventStartTime.value;
    if (!startDateVal || !startTimeVal) { fieldEventStartDate.focus(); return; }
    const startDate = new Date(`${startDateVal}T${startTimeVal}`);
    if (isNaN(startDate.getTime())) { fieldEventStartDate.focus(); return; }

    eventEndHintEl.textContent = '';
    eventEndHintEl.classList.remove('error');
    let endDate = null;
    const endDateVal = fieldEventEndDate.value;
    const endTimeVal = fieldEventEndTime.value;
    if (endDateVal || endTimeVal) {
      const effectiveEndDateVal = endDateVal || startDateVal;
      const effectiveEndTimeVal = endTimeVal || startTimeVal;
      endDate = new Date(`${effectiveEndDateVal}T${effectiveEndTimeVal}`);
      if (isNaN(endDate.getTime())) { fieldEventEndDate.focus(); return; }
      if (endDate < startDate) {
        eventEndHintEl.textContent = 'Дата/время окончания не может быть раньше начала';
        eventEndHintEl.classList.add('error');
        fieldEventEndDate.focus();
        return;
      }
    }

    eventMeetingUrlHint.textContent = '';
    eventMeetingUrlHint.classList.remove('error');
    let meetingUrl = fieldEventMeetingUrl.value.trim();
    if (meetingUrl) {
      const normalized = /^https?:\/\//i.test(meetingUrl) ? meetingUrl : 'https://' + meetingUrl;
      // new URL() лениво парсит почти любую строку (например, автоматически кодирует
      // пробелы), поэтому дополнительно проверяем базовую форму хоста руками.
      let parsed = null;
      try { parsed = new URL(normalized); } catch (err) { parsed = null; }
      const hostLooksValid = parsed && /\s/.test(meetingUrl) === false && /^[a-z0-9.-]+\.[a-z]{2,}$|^localhost$/i.test(parsed.hostname);
      if (!hostLooksValid) {
        eventMeetingUrlHint.textContent = 'Похоже, это не похоже на корректную ссылку';
        eventMeetingUrlHint.classList.add('error');
        fieldEventMeetingUrl.focus();
        return;
      }
      meetingUrl = normalized;
    } else {
      meetingUrl = null;
    }

    const participantIds = getSelectedParticipantIds();

    const patch = {
      title,
      description: fieldEventDescription.value.trim(),
      startAt: startDate.toISOString(),
      endAt: endDate ? endDate.toISOString() : null,
      location: fieldEventLocation.value.trim(),
      meetingUrl,
      participantIds,
    };

    let result;
    if (editingEventId) {
      const existing = store.getCalendarEvent(editingEventId);
      const oldParticipantIds = (existing && existing.participantIds) ? existing.participantIds.slice() : [];
      result = store.updateCalendarEvent(editingEventId, patch);
      if (result.ok) {
        // Уведомляем только вновь добавленных участников — не дублировать всем при каждом edit.
        const newlyAdded = participantIds.filter(id => !oldParticipantIds.includes(id));
        notifyEventParticipants(result.event, newlyAdded);
      }
    } else {
      result = store.createCalendarEvent(patch);
      if (result.ok) notifyEventParticipants(result.event, result.event.participantIds);
    }

    if (!result.ok) {
      showToast('Ошибка сохранения', 'Не получилось сохранить событие — возможно, хранилище браузера переполнено.');
      return;
    }
    closeEventDrawer();
    renderCalendarBody();
  });
}
