// Центральный Store: единственная точка доступа к состоянию приложения и localStorage.
// UI-модули (kanban.js, app.js, ...) не должны обращаться к localStorage напрямую.

import { loadOrMigrateState, STORAGE_KEY } from './migrations.js';

const SESSION_KEY = 'workspace-session-v1';

let state = null;

export function init() {
  state = loadOrMigrateState();
  persist();
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

// ---------- Объявления (read-only demo-данные для Dashboard) ----------

export function getAnnouncements() {
  return state.announcements;
}

// ---------- Уведомления (in-app, без отдельного Notifications Center на этом этапе) ----------

export function getNotifications() {
  return state.notifications;
}

export function createNotification(input) {
  const notification = {
    id: generateId('notif'),
    companyId: input.companyId || state.company.id,
    type: input.type,
    recipientId: input.recipientId,
    entityId: input.entityId,
    createdAt: new Date().toISOString(),
  };
  state.notifications.push(notification);
  const ok = persist();
  return { ok, notification };
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

export function createUser({ email, name, role }) {
  const user = {
    id: generateId('user'),
    companyId: state.company.id,
    name: name || email.split('@')[0],
    email,
    role: role || 'employee',
    createdAt: new Date().toISOString(),
  };
  state.users.push(user);
  persist();
  return user;
}

// Если email соответствует известному пользователю — вернуть его, иначе создать
// временного demo-сотрудника (роль employee) с этим email.
export function findOrCreateUserByEmail(email) {
  const existing = getUserByEmail(email);
  if (existing) return existing;
  return createUser({ email, name: email.split('@')[0], role: 'employee' });
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
