// Notification Center: Bell + popover-панель поверх существующего Topbar. Единственный
// источник данных — state.notifications через store.js (см. store.js/migrations.js).
// Специально НЕ импортирует kanban.js/calendar.js/company.js — переход к конкретной
// сущности (Task/Event/Announcement drawer) выполняет app.js (см. consumePendingOpen),
// который уже импортирует все три модуля — так модуль не создаёт циклических импортов.

import * as store from './store.js';
import * as router from './router.js';
import { showToast } from './toast.js';

const MAX_VISIBLE = 15;

const TYPE_META = {
  task_assigned: { entityType: 'task', route: 'kanban', icon: 'task' },
  task_deadline_soon: { entityType: 'task', route: 'kanban', icon: 'clock' },
  task_overdue: { entityType: 'task', route: 'kanban', icon: 'alert' },
  event_invitation: { entityType: 'event', route: 'calendar', icon: 'calendar' },
  announcement: { entityType: 'announcement', route: 'company', icon: 'megaphone' },
};

const ICONS = {
  task: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 9h6M9 13h6M9 17h3"/></svg>',
  clock: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
  alert: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l10 18H2z"/><path d="M12 10v4M12 17v.01"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="3" x2="8" y2="7"/><line x1="16" y1="3" x2="16" y2="7"/></svg>',
  megaphone: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11v2a2 2 0 0 0 2 2h1l4 5v-16l-4 5H5a2 2 0 0 0-2 2z"/><path d="M15 8a4 4 0 0 1 0 8"/><path d="M18 5a8 8 0 0 1 0 14"/></svg>',
  generic: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
};

let bellBtn = null;
let badgeEl = null;
let panelEl = null;
let listEl = null;
let markAllBtn = null;
let panelOpen = false;
let pendingOpen = null; // {route, entityType, entityId} — см. consumePendingOpen

function formatRelativeTime(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return 'только что';
  if (diffMin < 60) return diffMin + ' мин назад';
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return diffHours + ' ч назад';
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'вчера';
  if (diffDays < 7) return diffDays + ' дн назад';
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function entityExists(entityType, entityId) {
  if (!entityType || !entityId) return false;
  if (entityType === 'task') return !!store.getTask(entityId);
  if (entityType === 'event') return !!store.getCalendarEvent(entityId);
  if (entityType === 'announcement') return !!store.getAnnouncement(entityId);
  return false;
}

// ---------- Публичный вход ----------

export function initNotificationCenter() {
  bellBtn = document.getElementById('notificationBellBtn');
  badgeEl = document.getElementById('notificationBadge');
  if (!bellBtn) return;
  bellBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (panelOpen) closePanel(); else openPanel();
  });
  ensurePanel();
  refreshBadge();
}

// Вызывается после любого createNotification в приложении (task_assigned, event_invitation,
// announcement, deadline-checker) — обновляет только badge (+ список, если панель открыта),
// а не всё приложение.
export function refresh() {
  refreshBadge();
  if (panelOpen) renderList();
}

// app.js вызывает это сразу после рендера маршрута (kanban/calendar/company), которого
// дождался клик по notification — если ожидание совпадает с только что отрисованным
// маршрутом, возвращает {entityType, entityId} для открытия конкретной сущности, иначе null.
export function consumePendingOpen(route) {
  if (!pendingOpen || pendingOpen.route !== route) return null;
  const result = { entityType: pendingOpen.entityType, entityId: pendingOpen.entityId };
  pendingOpen = null;
  return result;
}

// ---------- Badge ----------

function refreshBadge() {
  if (!badgeEl) return;
  const user = store.getCurrentUser();
  const unread = user ? store.getNotificationsForUser(user.id).filter(n => !n.read).length : 0;
  if (unread > 0) {
    badgeEl.hidden = false;
    badgeEl.textContent = unread > 99 ? '99+' : String(unread);
  } else {
    badgeEl.hidden = true;
  }
}

// ---------- Panel ----------

function ensurePanel() {
  panelEl = document.createElement('div');
  panelEl.className = 'notification-panel';
  panelEl.hidden = true;

  const header = document.createElement('div');
  header.className = 'notification-panel-header';
  const title = document.createElement('h3');
  title.textContent = 'Уведомления';
  header.appendChild(title);
  const headerActions = document.createElement('div');
  headerActions.className = 'notification-panel-actions';
  markAllBtn = document.createElement('button');
  markAllBtn.type = 'button';
  markAllBtn.className = 'notification-mark-all-btn';
  markAllBtn.textContent = 'Прочитать все';
  markAllBtn.addEventListener('click', markAllRead);
  headerActions.appendChild(markAllBtn);
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'icon-btn notification-panel-close';
  closeBtn.setAttribute('aria-label', 'Закрыть уведомления');
  closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', closePanel);
  headerActions.appendChild(closeBtn);
  header.appendChild(headerActions);
  panelEl.appendChild(header);

  listEl = document.createElement('div');
  listEl.className = 'notification-list';
  panelEl.appendChild(listEl);

  panelEl.addEventListener('click', (e) => e.stopPropagation());
  document.body.appendChild(panelEl);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panelOpen) closePanel();
  });
}

function openPanel() {
  renderList();
  panelEl.hidden = false;
  panelOpen = true;
  bellBtn.setAttribute('aria-expanded', 'true');
  // Клик вне панели/bell закрывает её — вешаем всего один документ-листенер на
  // время, пока панель открыта (снимается в closePanel), а не постоянно.
  document.addEventListener('click', closePanel);
}

function closePanel() {
  panelEl.hidden = true;
  panelOpen = false;
  bellBtn.setAttribute('aria-expanded', 'false');
  document.removeEventListener('click', closePanel);
}

function buildEmptyState() {
  const wrap = document.createElement('div');
  wrap.className = 'empty-hint';
  const t = document.createElement('div');
  t.className = 'empty-hint-title';
  t.textContent = 'Нет уведомлений';
  wrap.appendChild(t);
  const h = document.createElement('div');
  h.className = 'empty-hint-helper';
  h.textContent = 'Здесь появятся назначения задач, приглашения и объявления компании.';
  wrap.appendChild(h);
  return wrap;
}

function renderList() {
  if (!listEl) return;
  listEl.innerHTML = '';
  const user = store.getCurrentUser();
  if (!user) return;

  const items = store.getNotificationsForUser(user.id)
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, MAX_VISIBLE);

  const hasUnread = items.some(n => !n.read);
  markAllBtn.hidden = !hasUnread;

  if (items.length === 0) {
    listEl.appendChild(buildEmptyState());
    return;
  }
  for (const n of items) listEl.appendChild(buildItem(n));
}

function buildItem(n) {
  const meta = TYPE_META[n.type] || {};
  const item = document.createElement('button');
  item.type = 'button';
  item.className = 'notification-item' + (n.read ? '' : ' is-unread');

  const icon = document.createElement('div');
  icon.className = 'notification-item-icon';
  icon.innerHTML = ICONS[meta.icon] || ICONS.generic;
  item.appendChild(icon);

  const body = document.createElement('div');
  body.className = 'notification-item-body';
  const titleEl = document.createElement('div');
  titleEl.className = 'notification-item-title';
  titleEl.textContent = n.title || 'Уведомление';
  body.appendChild(titleEl);
  if (n.message) {
    const msgEl = document.createElement('div');
    msgEl.className = 'notification-item-message';
    msgEl.textContent = n.message;
    body.appendChild(msgEl);
  }
  const timeEl = document.createElement('div');
  timeEl.className = 'notification-item-time';
  timeEl.textContent = formatRelativeTime(n.createdAt);
  body.appendChild(timeEl);
  item.appendChild(body);

  if (!n.read) {
    const dot = document.createElement('span');
    dot.className = 'notification-unread-dot';
    dot.setAttribute('aria-hidden', 'true');
    item.appendChild(dot);
  }

  item.addEventListener('click', () => handleItemClick(n));
  return item;
}

function markAllRead() {
  const user = store.getCurrentUser();
  if (!user) return;
  store.markAllNotificationsRead(user.id);
  refreshBadge();
  renderList();
}

function handleItemClick(n) {
  if (!n.read) store.markNotificationRead(n.id);
  refreshBadge();

  const meta = TYPE_META[n.type] || {};
  const entityType = n.entityType || meta.entityType || null;
  const route = meta.route || null;

  closePanel();

  if (!route || !entityExists(entityType, n.entityId)) {
    showToast('Объект больше недоступен', 'Похоже, эта задача, событие или объявление были удалены.');
    return;
  }

  pendingOpen = { route, entityType, entityId: n.entityId };
  router.navigate(route);
}
