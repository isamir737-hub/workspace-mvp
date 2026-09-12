// Центральный Store: единственная точка доступа к состоянию приложения и localStorage.
// UI-модули (kanban.js, app.js, ...) не должны обращаться к localStorage напрямую.

import { loadOrMigrateState, createFreshState, STORAGE_KEY } from './migrations.js';

const SESSION_KEY = 'workspace-session-v1';

let state = null;

export function init() {
  state = loadOrMigrateState();
  persist();
}

// Owner-действие "Reset demo data" (см. app.js). Пересобирает state с нуля — тот же
// demo seed, что при самом первом запуске. Сессию (SESSION_KEY) намеренно не трогаем:
// у demo-пользователей стабильные id, поэтому текущий логин остаётся валиден после
// сброса; если он был create-on-the-fly пользователем — auth.isAuthenticated() сам
// обнаружит отсутствие пользователя и приложение вернётся на экран логина.
export function resetDemoData() {
  state = createFreshState();
  const ok = persist();
  return { ok };
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    console.error('Не удалось сохранить состояние приложения', e);
    return false;
  }
}

export function generateId(prefix) {
  return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
}

export function getState() {
  return state;
}

export function getCompany() {
  return state.company;
}

export function updateCompany(patch) {
  state.company = { ...state.company, ...patch };
  const ok = persist();
  return { ok, company: state.company };
}

// ---------- Календарь ----------

export function getCalendarEvents() {
  return state.calendarEvents;
}

export function getCalendarEvent(id) {
  return state.calendarEvents.find(e => e.id === id) || null;
}

export function createCalendarEvent(input) {
  const now = new Date().toISOString();
  const currentUser = getCurrentUser();
  const event = {
    id: generateId('event'),
    companyId: state.company.id,
    title: '',
    description: '',
    startAt: null,
    endAt: null,
    creatorId: currentUser ? currentUser.id : null,
    participantIds: [],
    location: '',
    meetingUrl: null,
    color: 'blue',
    createdAt: now,
    updatedAt: now,
    ...input,
  };
  state.calendarEvents.push(event);
  const ok = persist();
  return { ok, event };
}

export function updateCalendarEvent(id, patch) {
  const event = getCalendarEvent(id);
  if (!event) return { ok: false, event: null };
  Object.assign(event, patch);
  event.updatedAt = new Date().toISOString();
  const ok = persist();
  return { ok, event };
}

export function deleteCalendarEvent(id) {
  state.calendarEvents = state.calendarEvents.filter(e => e.id !== id);
  return persist();
}

// ---------- Заметки (Notes) ----------

export function getNotes() {
  return state.notes;
}

export function getNote(id) {
  return state.notes.find(n => n.id === id) || null;
}

export function createNote(input) {
  const now = new Date().toISOString();
  const currentUser = getCurrentUser();
  const note = {
    id: generateId('note'),
    companyId: state.company.id,
    ownerId: currentUser ? currentUser.id : null,
    title: '',
    content: '',
    visibility: 'private',
    sharedWith: [],
    createdAt: now,
    updatedAt: now,
    ...input,
  };
  state.notes.push(note);
  const ok = persist();
  return { ok, note };
}

export function updateNote(id, patch) {
  const note = getNote(id);
  if (!note) return { ok: false, note: null };
  Object.assign(note, patch);
  note.updatedAt = new Date().toISOString();
  const ok = persist();
  return { ok, note };
}

export function deleteNote(id) {
  state.notes = state.notes.filter(n => n.id !== id);
  return persist();
}

// ---------- Whiteboards ----------

export function getWhiteboards() {
  return state.whiteboards;
}

export function getWhiteboard(id) {
  return state.whiteboards.find(b => b.id === id) || null;
}

export function createWhiteboard(input) {
  const now = new Date().toISOString();
  const currentUser = getCurrentUser();
  const board = {
    id: generateId('board'),
    companyId: state.company.id,
    ownerId: currentUser ? currentUser.id : null,
    title: '',
    visibility: 'private',
    sharedWith: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    objects: [],
    createdAt: now,
    updatedAt: now,
    ...input,
  };
  state.whiteboards.push(board);
  const ok = persist();
  return { ok, board };
}

export function updateWhiteboard(id, patch) {
  const board = getWhiteboard(id);
  if (!board) return { ok: false, board: null };
  Object.assign(board, patch);
  board.updatedAt = new Date().toISOString();
  const ok = persist();
  return { ok, board };
}

export function deleteWhiteboard(id) {
  state.whiteboards = state.whiteboards.filter(b => b.id !== id);
  return persist();
}

// ---------- Объявления компании ----------

export function getAnnouncements() {
  return state.announcements;
}

export function getAnnouncement(id) {
  return state.announcements.find(a => a.id === id) || null;
}

export function createAnnouncement(input) {
  const now = new Date().toISOString();
  const currentUser = getCurrentUser();
  const announcement = {
    id: generateId('ann'),
    companyId: state.company.id,
    title: '',
    body: '',
    authorId: currentUser ? currentUser.id : null,
    publishedAt: now,
    active: true,
    createdAt: now,
    updatedAt: now,
    ...input,
  };
  state.announcements.push(announcement);
  const ok = persist();
  return { ok, announcement };
}

export function updateAnnouncement(id, patch) {
  const announcement = getAnnouncement(id);
  if (!announcement) return { ok: false, announcement: null };
  Object.assign(announcement, patch);
  announcement.updatedAt = new Date().toISOString();
  const ok = persist();
  return { ok, announcement };
}

// ---------- Уведомления (Notification Center) ----------

export function getNotifications() {
  return state.notifications;
}

export function getNotification(id) {
  return state.notifications.find(n => n.id === id) || null;
}

export function getNotificationsForUser(userId) {
  return state.notifications.filter(n => n.recipientId === userId);
}

// input: {companyId?, recipientId, type, title?, message?, entityType?, entityId?,
// dedupeKey?}. Если dedupeKey уже встречается среди существующих notifications —
// новая НЕ создаётся, возвращается уже существующая (deduped:true) — единая точка,
// где вызывающий код (deadline-checker и т.п.) может не беспокоиться о повторных
// срабатываниях каждые 30с.
export function createNotification(input) {
  if (input.dedupeKey) {
    const existing = state.notifications.find(n => n.dedupeKey === input.dedupeKey);
    if (existing) return { ok: true, notification: existing, deduped: true };
  }
  const notification = {
    id: generateId('notif'),
    companyId: input.companyId || state.company.id,
    recipientId: input.recipientId,
    type: input.type,
    title: input.title || '',
    message: input.message || '',
    entityType: input.entityType || null,
    entityId: input.entityId || null,
    read: false,
    dedupeKey: input.dedupeKey || null,
    createdAt: new Date().toISOString(),
  };
  state.notifications.push(notification);
  const ok = persist();
  return { ok, notification, deduped: false };
}

export function updateNotification(id, patch) {
  const notification = getNotification(id);
  if (!notification) return { ok: false, notification: null };
  Object.assign(notification, patch);
  const ok = persist();
  return { ok, notification };
}

export function markNotificationRead(id) {
  return updateNotification(id, { read: true });
}

export function markAllNotificationsRead(userId) {
  let changed = false;
  for (const n of state.notifications) {
    if (n.recipientId === userId && !n.read) { n.read = true; changed = true; }
  }
  const ok = changed ? persist() : true;
  return { ok, changed };
}

// ---------- Пользователи ----------

export function getUsers() {
  return state.users;
}

export function getUserById(id) {
  return state.users.find(u => u.id === id) || null;
}

export function getUserByEmail(email) {
  if (!email) return null;
  const norm = email.trim().toLowerCase();
  return state.users.find(u => u.email.toLowerCase() === norm) || null;
}

// input: {email, name?, firstName?, lastName?, role?, position?, department?,
// managerId?, phone?, birthday?, avatar?, active?}. Возвращает {ok, user}, как и
// остальные create*-методы Store.
export function createUser(input) {
  const now = new Date().toISOString();
  const firstName = input.firstName || (input.name ? input.name.split(/\s+/)[0] : '') || '';
  const lastName = input.lastName !== undefined ? input.lastName : (input.name ? input.name.split(/\s+/).slice(1).join(' ') : '') || '';
  const name = input.name || `${firstName} ${lastName}`.trim() || (input.email ? input.email.split('@')[0] : '');
  const user = {
    id: generateId('user'),
    companyId: state.company.id,
    firstName,
    lastName,
    name,
    email: input.email,
    role: input.role || 'employee',
    position: input.position || '',
    department: input.department || '',
    managerId: input.managerId || null,
    phone: input.phone || '',
    birthday: input.birthday || null,
    avatar: input.avatar || null,
    active: input.active !== undefined ? input.active : true,
    createdAt: now,
    updatedAt: now,
  };
  state.users.push(user);
  const ok = persist();
  return { ok, user };
}

export function updateUser(id, patch) {
  const user = getUserById(id);
  if (!user) return { ok: false, user: null };
  Object.assign(user, patch);
  user.updatedAt = new Date().toISOString();
  const ok = persist();
  return { ok, user };
}

// Если email соответствует известному пользователю — вернуть его, иначе создать
// временного demo-сотрудника (роль employee) с этим email.
export function findOrCreateUserByEmail(email) {
  const existing = getUserByEmail(email);
  if (existing) return existing;
  return createUser({ email, name: email.split('@')[0], role: 'employee' }).user;
}

// ---------- Сессия (кто сейчас залогинен) ----------

export function getCurrentUser() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return getUserById(parsed.userId);
  } catch (e) {
    return null;
  }
}

export function setCurrentUser(userId) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ userId }));
}

export function clearCurrentUser() {
  localStorage.removeItem(SESSION_KEY);
}

// ---------- Задачи ----------

export function getTasks() {
  return state.tasks;
}

export function getTask(id) {
  return state.tasks.find(t => t.id === id) || null;
}

export function createTask(input) {
  const now = new Date().toISOString();
  const currentUser = getCurrentUser();
  const task = {
    id: generateId('task'),
    companyId: state.company.id,
    creatorId: currentUser ? currentUser.id : null,
    assigneeId: null,
    title: '',
    description: '',
    deadline: null,
    reminderMinutes: null,
    reminderShown: false,
    attachments: [],
    comments: [],
    status: 'backlog',
    priority: 'medium',
    tags: [],
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    legacyCollaboratorEmail: null,
    ...input,
  };
  state.tasks.push(task);
  const ok = persist();
  return { ok, task };
}

export function updateTask(id, patch) {
  const task = getTask(id);
  if (!task) return { ok: false, task: null };
  Object.assign(task, patch);
  task.updatedAt = new Date().toISOString();
  if (patch.status === 'done' && !task.completedAt) task.completedAt = task.updatedAt;
  else if (patch.status && patch.status !== 'done') task.completedAt = null;
  const ok = persist();
  return { ok, task };
}

export function deleteTask(id) {
  state.tasks = state.tasks.filter(t => t.id !== id);
  return persist();
}
