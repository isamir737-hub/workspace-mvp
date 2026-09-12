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

// Этап 2 хранил CalendarEvent с полями startsAt/endsAt; Этап 5 закрепил схему как
// startAt/endAt и добавил description/meetingUrl/color/updatedAt. Приводим уже
// сохранённые события к актуальной форме, не теряя данные.
function normalizeCalendarEvent(event) {
  const createdAt = event.createdAt || new Date().toISOString();
  return {
    id: event.id,
    companyId: event.companyId || DEMO_COMPANY.id,
    title: event.title || '',
    description: event.description || '',
    startAt: event.startAt || event.startsAt || null,
    endAt: event.endAt !== undefined ? event.endAt : (event.endsAt !== undefined ? event.endsAt : null),
    creatorId: event.creatorId || null,
    participantIds: Array.isArray(event.participantIds) ? event.participantIds : [],
    location: event.location || '',
    meetingUrl: event.meetingUrl || null,
    color: event.color || 'blue',
    createdAt,
    updatedAt: event.updatedAt || createdAt,
  };
}

// Этап 7 добавил Company/Employees/Announcements поля. Существующие users/company/
// announcements (сохранённые до этого этапа) нормализуются здесь безопасными
// дефолтами — ничего не теряем, id/email/role/createdAt не трогаем.
function splitName(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') || '' };
}

function normalizeUser(user) {
  const derived = (!user.firstName && !user.lastName) ? splitName(user.name) : {};
  const firstName = user.firstName || derived.firstName || '';
  const lastName = user.lastName !== undefined && user.lastName !== null ? user.lastName : (derived.lastName || '');
  const name = user.name || `${firstName} ${lastName}`.trim();
  return {
    ...user,
    firstName,
    lastName,
    name,
    position: user.position || '',
    department: user.department || '',
    managerId: user.managerId || null,
    phone: user.phone || '',
    birthday: user.birthday || null,
    avatar: user.avatar || null,
    active: user.active !== undefined ? user.active : true,
  };
}

function normalizeCompany(company) {
  const base = company || {};
  return {
    ...DEMO_COMPANY,
    ...base,
    registration: { ...DEMO_COMPANY.registration, ...(base.registration || {}) },
    banking: { ...DEMO_COMPANY.banking, ...(base.banking || {}) },
    importantContacts: Array.isArray(base.importantContacts) ? base.importantContacts : [],
  };
}

function normalizeAnnouncement(ann) {
  const createdAt = ann.createdAt || new Date().toISOString();
  return {
    ...ann,
    publishedAt: ann.publishedAt || createdAt,
    active: ann.active !== undefined ? ann.active : true,
    createdAt,
    updatedAt: ann.updatedAt || createdAt,
  };
}

// Этап 8 нормализовал Notification к модели {id, companyId, recipientId, type, title,
// message, entityType, entityId, read, dedupeKey, createdAt}. Старые notifications
// (task_assigned/event_invitation с этапов 3/5) хранили только type/recipientId/entityId —
// title/message/entityType для них выводятся здесь один раз по уже нормализованным
// task/event/announcement и сохраняются, чтобы UI больше не заботился о fallback.
const ENTITY_TYPE_BY_NOTIFICATION_TYPE = {
  task_assigned: 'task',
  task_deadline_soon: 'task',
  task_overdue: 'task',
  event_invitation: 'event',
  announcement: 'announcement',
};

const FALLBACK_TITLE_BY_TYPE = {
  task_assigned: 'Вам назначена задача',
  task_deadline_soon: 'Дедлайн скоро',
  task_overdue: 'Задача просрочена',
  event_invitation: 'Приглашение на встречу',
  announcement: 'Новое объявление',
};

function inferNotificationMessage(entityType, entityId, state) {
  if (entityType === 'task') return (state.tasks.find(t => t.id === entityId) || {}).title || '';
  if (entityType === 'event') return (state.calendarEvents.find(e => e.id === entityId) || {}).title || '';
  if (entityType === 'announcement') return (state.announcements.find(a => a.id === entityId) || {}).title || '';
  return '';
}

function normalizeNotification(n, state) {
  const entityType = n.entityType || ENTITY_TYPE_BY_NOTIFICATION_TYPE[n.type] || null;
  const createdAt = n.createdAt || new Date().toISOString();
  return {
    ...n,
    companyId: n.companyId || state.company.id,
    entityType,
    title: n.title || FALLBACK_TITLE_BY_TYPE[n.type] || 'Уведомление',
    message: n.message !== undefined && n.message !== null ? n.message : inferNotificationMessage(entityType, n.entityId, state),
    read: n.read !== undefined ? n.read : false,
    dedupeKey: n.dedupeKey !== undefined ? n.dedupeKey : null,
    createdAt,
  };
}

function buildFreshState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    company: normalizeCompany({ ...DEMO_COMPANY }),
    users: DEMO_USERS.map(u => normalizeUser({ ...u })),
    tasks: migrateLegacyTasksFromStorage(),
    calendarEvents: createDemoCalendarEvents(),
    announcements: createDemoAnnouncements().map(normalizeAnnouncement),
    notifications: [],
    notes: [],
    whiteboards: [],
  };
}

// normalizeNotification нужен полностью собранный state (tasks/calendarEvents/
// announcements/company) для fallback-подстановки message у старых notifications —
// поэтому применяется отдельным проходом после того, как остальные коллекции готовы.
function normalizeNotificationsOf(state) {
  state.notifications = state.notifications.map(n => normalizeNotification(n, state));
  return state;
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
        parsed.company = normalizeCompany(parsed.company || { ...DEMO_COMPANY });
        if (!Array.isArray(parsed.users) || parsed.users.length === 0) {
          parsed.users = DEMO_USERS.map(u => ({ ...u }));
        }
        parsed.users = parsed.users.map(normalizeUser);
        if (!Array.isArray(parsed.calendarEvents)) {
          parsed.calendarEvents = createDemoCalendarEvents();
        } else {
          parsed.calendarEvents = parsed.calendarEvents.map(normalizeCalendarEvent);
        }
        if (!Array.isArray(parsed.announcements)) {
          parsed.announcements = createDemoAnnouncements();
        }
        parsed.announcements = parsed.announcements.map(normalizeAnnouncement);
        if (!Array.isArray(parsed.notifications)) {
          parsed.notifications = [];
        }
        if (!Array.isArray(parsed.notes)) {
          parsed.notes = [];
        }
        if (!Array.isArray(parsed.whiteboards)) {
          parsed.whiteboards = [];
        }
        normalizeNotificationsOf(parsed);
        return parsed;
      }
    }
  } catch (e) {
    console.error('Не удалось прочитать workspace-app-v2, состояние будет пересобрано из legacy-данных', e);
  }
  return normalizeNotificationsOf(buildFreshState());
}
