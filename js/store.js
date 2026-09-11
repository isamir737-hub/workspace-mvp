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
