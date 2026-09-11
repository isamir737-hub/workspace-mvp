// Миграция данных приложения. Хранилище v1 (kanban-tasks-v1, просто массив задач)
// переносится в единое состояние workspace-app-v2 с schemaVersion.

import { DEMO_COMPANY, DEMO_USERS, createDemoCalendarEvents, createDemoAnnouncements } from './demo-data.js';

export const STORAGE_KEY = 'workspace-app-v2';
export const SCHEMA_VERSION = 2;

const LEGACY_TASKS_KEY = 'kanban-tasks-v1';
const KNOWN_STATUSES = ['backlog', 'todo', 'inprogress', 'inreview', 'done'];

function normalizeLegacyStatus(status) {
  if (status === 'doing') return 'inprogress'; // самая первая версия доски (3 колонки)
  if (KNOWN_STATUSES.includes(status)) return status;
  return 'backlog';
}

function migrateLegacyTask(legacy) {
  const status = normalizeLegacyStatus(legacy.status);
  const createdAt = legacy.createdAt || new Date().toISOString();
  const collaboratorEmail = legacy.collaboratorEmail || null;
  const matchedUser = collaboratorEmail
    ? DEMO_USERS.find(u => u.email.toLowerCase() === collaboratorEmail.toLowerCase())
    : null;

  return {
    id: legacy.id,
    title: legacy.title,
    description: legacy.description || '',
    deadline: legacy.deadline || null,
    reminderMinutes: legacy.reminderMinutes ?? null,
    reminderShown: !!legacy.reminderShown,
    attachments: Array.isArray(legacy.attachments) ? legacy.attachments : [],
    comments: Array.isArray(legacy.comments) ? legacy.comments : [],
    status,
    createdAt,
    // Новые поля, которых не было в kanban-tasks-v1:
    companyId: DEMO_COMPANY.id,
    creatorId: null, // в старых данных автор задачи не фиксировался
    assigneeId: matchedUser ? matchedUser.id : null,
    legacyCollaboratorEmail: matchedUser ? null : collaboratorEmail,
    priority: 'medium',
    tags: [],
    updatedAt: createdAt,
    completedAt: status === 'done' ? createdAt : null,
  };
}

function migrateLegacyTasksFromStorage() {
  try {
    const raw = localStorage.getItem(LEGACY_TASKS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(migrateLegacyTask);
  } catch (e) {
    console.error('Не удалось прочитать legacy kanban-tasks-v1 при миграции', e);
    return [];
  }
}

function buildFreshState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    company: { ...DEMO_COMPANY },
    users: DEMO_USERS.map(u => ({ ...u })),
    tasks: migrateLegacyTasksFromStorage(),
    calendarEvents: createDemoCalendarEvents(),
    announcements: createDemoAnnouncements(),
  };
}

// Загружает workspace-app-v2, если он уже существует; иначе строит его заново,
// импортируя существующие задачи из kanban-tasks-v1 (если они есть). Оригинальный
// ключ kanban-tasks-v1 при этом не удаляется — миграция не должна терять данные.
export function loadOrMigrateState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.tasks)) {
        parsed.schemaVersion = SCHEMA_VERSION;
        if (!parsed.company) parsed.company = { ...DEMO_COMPANY };
        if (!Array.isArray(parsed.users) || parsed.users.length === 0) {
          parsed.users = DEMO_USERS.map(u => ({ ...u }));
        }
        if (!Array.isArray(parsed.calendarEvents)) {
          parsed.calendarEvents = createDemoCalendarEvents();
        }
        if (!Array.isArray(parsed.announcements)) {
          parsed.announcements = createDemoAnnouncements();
        }
        return parsed;
      }
    }
  } catch (e) {
    console.error('Не удалось прочитать workspace-app-v2, состояние будет пересобрано из legacy-данных', e);
  }
  return buildFreshState();
}
