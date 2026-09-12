// Kanban-доска. Рендеринг колонок/карточек и drawer создания/редактирования задачи.
// Все обращения к данным идут через store.js — модуль не трогает localStorage напрямую.

import * as store from './store.js';

const COLUMNS = [
  { id: 'backlog', label: 'Backlog', color: 'neutral' },
  { id: 'todo', label: 'To Do', color: 'orange' },
  { id: 'inprogress', label: 'In Progress', color: 'mint' },
  { id: 'inreview', label: 'In Review', color: 'yellow' },
  { id: 'done', label: 'Done', color: 'green' },
];
const STATUSES = COLUMNS.map(c => c.id);

const REMINDER_LABELS = {
  '0': 'в момент дедлайна',
  '15': 'за 15 минут до дедлайна',
  '60': 'за 1 час до дедлайна',
  '1440': 'за 1 день до дедлайна',
};

const ALLOWED_ATTACHMENTS = {
  '.doc': { icon: '📄', label: 'Word' },
  '.docx': { icon: '📄', label: 'Word' },
  '.xls': { icon: '📊', label: 'Excel' },
  '.xlsx': { icon: '📊', label: 'Excel' },
  '.ppt': { icon: '📽️', label: 'PowerPoint' },
  '.pptx': { icon: '📽️', label: 'PowerPoint' },
  '.csv': { icon: '🧾', label: 'CSV' },
  '.pdf': { icon: '📕', label: 'PDF' },
  '.jpg': { icon: '🖼️', label: 'JPEG' },
  '.jpeg': { icon: '🖼️', label: 'JPEG' },
};
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5 МБ на файл

const PRIORITY_LABELS = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' };
const ROLE_LABELS = { owner: 'Owner', manager: 'Manager', employee: 'Employee' };

let editingTaskId = null;
let notificationPermissionAsked = false;
let formAttachments = [];
let formTags = [];
let boardEl = null; // контейнер доски (грид колонок), если страница #/kanban сейчас смонтирована

// ---------- Search & Filters (только влияют на отображение, не на данные) ----------

let filterState = { assigneeId: '', priority: '', tag: '', onlyMine: false, search: '' };
let filtersPanelOpen = false;
let searchInputEl, filtersToggleBtn, filtersDotEl, filtersPanelEl,
  filterAssigneeEl, filterPriorityEl, filterTagEl, filterOnlyMineEl, clearFiltersBtn;

// ---------- Drawer: DOM-ссылки (статические элементы index.html) ----------

let modalOverlay, modalTitle, taskForm, fieldTitle, fieldDescription, fieldDeadline,
  fieldReminder, fieldAssignee, fieldPriority, fieldTagInput, addTagBtn, tagList,
  fieldAttachments, attachBtn, attachmentList, commentsSection, commentsList,
  fieldNewComment, addCommentBtn, deleteBtn, cancelBtn, closeDrawerBtn;

function cacheDrawerRefs() {
  modalOverlay = document.getElementById('modalOverlay');
  modalTitle = document.getElementById('modalTitle');
  taskForm = document.getElementById('taskForm');
  fieldTitle = document.getElementById('fieldTitle');
  fieldDescription = document.getElementById('fieldDescription');
  fieldDeadline = document.getElementById('fieldDeadline');
  fieldReminder = document.getElementById('fieldReminder');
  fieldAssignee = document.getElementById('fieldAssignee');
  fieldPriority = document.getElementById('fieldPriority');
  fieldTagInput = document.getElementById('fieldTagInput');
  addTagBtn = document.getElementById('addTagBtn');
  tagList = document.getElementById('tagList');
  fieldAttachments = document.getElementById('fieldAttachments');
  attachBtn = document.getElementById('attachBtn');
  attachmentList = document.getElementById('attachmentList');
  commentsSection = document.getElementById('commentsSection');
  commentsList = document.getElementById('commentsList');
  fieldNewComment = document.getElementById('fieldNewComment');
  addCommentBtn = document.getElementById('addCommentBtn');
  deleteBtn = document.getElementById('deleteBtn');
  cancelBtn = document.getElementById('cancelBtn');
  closeDrawerBtn = document.getElementById('closeDrawerBtn');
}

// ---------- Публичный API модуля ----------

export function initKanbanModule() {
  cacheDrawerRefs();
  wireDrawerEvents();
  wireAttachmentEvents();
  wireCommentEvents();
  checkReminders();
  // Напоминания проверяются отдельно от полной перерисовки доски: полный renderBoard()
  // каждые 30с был бы лишней работой (сбрасывает scroll/анимации) ради того, что реально
  // меняется со временем — только visual-состояние дедлайна (overdue/soon). Поэтому тут
  // только дешёвая точечная правка уже отрисованных карточек, без пересборки DOM.
  setInterval(() => {
    checkReminders();
    updateDeadlineVisuals();
  }, 30000);
}

export function renderKanbanPage(container) {
  container.className = 'main-content kanban-page';
  container.innerHTML = '';
  container.appendChild(buildPageHeader());
  container.appendChild(buildFiltersPanel());

  const boardWrap = document.createElement('div');
  boardWrap.className = 'board';
  container.appendChild(boardWrap);
  boardEl = boardWrap;

  renderBoard();
}

export function openCreateTaskDrawer() {
  openCreateModal();
}

// Позволяет другим страницам (например, Dashboard) открыть drawer редактирования
// существующей задачи, не переходя на #/kanban — drawer является общим статическим
// оверлеем, не привязанным к текущему роуту.
export function openEditTaskDrawer(id) {
  openEditModal(id);
}

// Метаданные колонок для страниц, которым нужны статусы/подписи (например, Dashboard statistics).
export function getColumnsMeta() {
  return COLUMNS.map(c => ({ id: c.id, label: c.label }));
}

export function getColumnLabel(status) {
  return columnLabel(status);
}

// Необязательный хук: вызывается каждый раз при закрытии drawer (сохранение/удаление/отмена).
// Используется Dashboard, чтобы обновить свои карточки после правки задачи из общего drawer.
let onDrawerClosed = null;
export function setOnDrawerClosed(fn) {
  onDrawerClosed = fn;
}

// ---------- Page header: заголовок, поиск, фильтры, "+ Новая задача" ----------

function buildPageHeader() {
  const header = document.createElement('div');
  header.className = 'kanban-header';

  const left = document.createElement('div');
  const title = document.createElement('h2');
  title.className = 'kanban-header-title';
  title.textContent = 'Задачи';
  left.appendChild(title);
  const subtitle = document.createElement('p');
  subtitle.className = 'kanban-header-subtitle';
  subtitle.textContent = 'Управляйте текущей работой команды.';
  left.appendChild(subtitle);
  header.appendChild(left);

  const toolbar = document.createElement('div');
  toolbar.className = 'kanban-toolbar';

  const searchWrap = document.createElement('label');
  searchWrap.className = 'kanban-search';
  searchWrap.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
  searchInputEl = document.createElement('input');
  searchInputEl.type = 'search';
  searchInputEl.placeholder = 'Поиск задач...';
  searchInputEl.setAttribute('aria-label', 'Поиск задач');
  searchInputEl.value = filterState.search;
  searchInputEl.addEventListener('input', () => {
    filterState.search = searchInputEl.value.trim().toLowerCase();
    onFiltersChanged();
  });
  searchWrap.appendChild(searchInputEl);
  toolbar.appendChild(searchWrap);

  filtersToggleBtn = document.createElement('button');
  filtersToggleBtn.type = 'button';
  filtersToggleBtn.className = 'btn-secondary kanban-filters-toggle';
  filtersToggleBtn.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="4 4 20 4 14 12.5 14 19 10 21 10 12.5 4 4"/></svg> Фильтры';
  filtersDotEl = document.createElement('span');
  filtersDotEl.className = 'filters-dot';
  filtersDotEl.hidden = !isFiltersActive();
  filtersToggleBtn.appendChild(filtersDotEl);
  filtersToggleBtn.setAttribute('aria-expanded', String(filtersPanelOpen));
  filtersToggleBtn.addEventListener('click', () => {
    filtersPanelOpen = !filtersPanelOpen;
    filtersPanelEl.hidden = !filtersPanelOpen;
    filtersToggleBtn.setAttribute('aria-expanded', String(filtersPanelOpen));
  });
  toolbar.appendChild(filtersToggleBtn);

  const newTaskBtn = document.createElement('button');
  newTaskBtn.type = 'button';
  newTaskBtn.className = 'btn-primary';
  newTaskBtn.innerHTML = '<span class="plus" aria-hidden="true">+</span> Новая задача';
  newTaskBtn.addEventListener('click', () => openCreateModal());
  toolbar.appendChild(newTaskBtn);

  header.appendChild(toolbar);
  return header;
}

function buildFilterSelectField(labelText, options, selectedValue, onChange) {
  const wrap = document.createElement('label');
  wrap.className = 'filter-field';
  const labelSpan = document.createElement('span');
  labelSpan.className = 'filter-field-label';
  labelSpan.textContent = labelText;
  wrap.appendChild(labelSpan);
  const select = document.createElement('select');
  for (const opt of options) {
    const optionEl = document.createElement('option');
    optionEl.value = opt.value;
    optionEl.textContent = opt.label;
    select.appendChild(optionEl);
  }
  select.value = selectedValue;
  select.addEventListener('change', () => onChange(select.value));
  wrap.appendChild(select);
  return { wrap, selectEl: select };
}

function buildFiltersPanel() {
  const panel = document.createElement('div');
  panel.className = 'kanban-filters-panel';
  panel.hidden = !filtersPanelOpen;
  filtersPanelEl = panel;

  const currentUser = store.getCurrentUser();
  const companyUsers = currentUser ? store.getUsers().filter(u => u.companyId === currentUser.companyId) : [];

  const assigneeField = buildFilterSelectField(
    'Исполнитель',
    [{ value: '', label: 'Все' }].concat(companyUsers.map(u => ({ value: u.id, label: u.name }))),
    filterState.assigneeId,
    (value) => { filterState.assigneeId = value; onFiltersChanged(); }
  );
  filterAssigneeEl = assigneeField.selectEl;
  panel.appendChild(assigneeField.wrap);

  const priorityField = buildFilterSelectField(
    'Приоритет',
    [
      { value: '', label: 'Все' },
      { value: 'low', label: 'Low' },
      { value: 'medium', label: 'Medium' },
      { value: 'high', label: 'High' },
      { value: 'critical', label: 'Critical' },
    ],
    filterState.priority,
    (value) => { filterState.priority = value; onFiltersChanged(); }
  );
  filterPriorityEl = priorityField.selectEl;
  panel.appendChild(priorityField.wrap);

  const tagField = buildFilterSelectField(
    'Тег',
    [{ value: '', label: 'Все' }].concat(getDistinctTags().map(t => ({ value: t, label: t }))),
    filterState.tag,
    (value) => { filterState.tag = value; onFiltersChanged(); }
  );
  filterTagEl = tagField.selectEl;
  panel.appendChild(tagField.wrap);

  const mineWrap = document.createElement('label');
  mineWrap.className = 'filter-checkbox';
  filterOnlyMineEl = document.createElement('input');
  filterOnlyMineEl.type = 'checkbox';
  filterOnlyMineEl.checked = filterState.onlyMine;
  filterOnlyMineEl.addEventListener('change', () => {
    filterState.onlyMine = filterOnlyMineEl.checked;
    onFiltersChanged();
  });
  mineWrap.appendChild(filterOnlyMineEl);
  mineWrap.appendChild(document.createTextNode('Только мои'));
  panel.appendChild(mineWrap);

  clearFiltersBtn = document.createElement('button');
  clearFiltersBtn.type = 'button';
  clearFiltersBtn.className = 'btn-secondary btn-small filters-clear-btn';
  clearFiltersBtn.textContent = 'Сбросить';
  clearFiltersBtn.hidden = !isFiltersActive();
  clearFiltersBtn.addEventListener('click', () => {
    filterState = { assigneeId: '', priority: '', tag: '', onlyMine: false, search: '' };
    filterAssigneeEl.value = '';
    filterPriorityEl.value = '';
    filterTagEl.value = '';
    filterOnlyMineEl.checked = false;
    searchInputEl.value = '';
    onFiltersChanged();
  });
  panel.appendChild(clearFiltersBtn);

  return panel;
}

function getDistinctTags() {
  const set = new Set();
  for (const task of store.getTasks()) {
    for (const tag of (task.tags || [])) set.add(tag);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

// Список тегов может устареть, если задачи с уникальными тегами были отредактированы/удалены
// пока страница открыта — обновляем options существующего <select>, не трогая остальной UI.
function refreshTagFilterOptions() {
  if (!filterTagEl) return;
  const current = filterTagEl.value;
  const tags = getDistinctTags();
  filterTagEl.innerHTML = '';
  const allOption = document.createElement('option');
  allOption.value = '';
  allOption.textContent = 'Все';
  filterTagEl.appendChild(allOption);
  for (const tag of tags) {
    const option = document.createElement('option');
    option.value = tag;
    option.textContent = tag;
    filterTagEl.appendChild(option);
  }
  if (current && !tags.includes(current)) {
    filterState.tag = '';
    filterTagEl.value = '';
  } else {
    filterTagEl.value = current;
  }
}

// Проверяет всё, кроме статуса колонки (тот проверяется отдельно при разборе по колонкам).
function taskMatchesFilters(task) {
  const currentUser = store.getCurrentUser();
  if (filterState.onlyMine && currentUser) {
    const isMine = task.assigneeId ? task.assigneeId === currentUser.id : task.creatorId === currentUser.id;
    if (!isMine) return false;
  }
  if (filterState.assigneeId && task.assigneeId !== filterState.assigneeId) return false;
  if (filterState.priority && (task.priority || 'medium') !== filterState.priority) return false;
  if (filterState.tag && !(task.tags || []).includes(filterState.tag)) return false;
  if (filterState.search) {
    const haystack = [task.title, task.description, ...(task.tags || [])].join(' ').toLowerCase();
    if (!haystack.includes(filterState.search)) return false;
  }
  return true;
}

function isFiltersActive() {
  return !!(filterState.assigneeId || filterState.priority || filterState.tag || filterState.onlyMine || filterState.search);
}

function onFiltersChanged() {
  if (filtersDotEl) filtersDotEl.hidden = !isFiltersActive();
  if (clearFiltersBtn) clearFiltersBtn.hidden = !isFiltersActive();
  renderBoard();
}

function buildEmptyColumnState(isFilteredEmpty) {
  const wrap = document.createElement('div');
  wrap.className = 'empty-hint';
  const title = document.createElement('div');
  title.className = 'empty-hint-title';
  title.textContent = 'Нет задач';
  wrap.appendChild(title);
  const helper = document.createElement('div');
  helper.className = 'empty-hint-helper';
  helper.textContent = isFilteredEmpty
    ? 'Ничего не найдено — попробуйте изменить фильтры.'
    : 'Перетащите сюда карточку или создайте новую.';
  wrap.appendChild(helper);
  return wrap;
}

// ---------- Рендеринг доски ----------

function renderBoard() {
  // boardEl — контейнер грида колонок, создаётся заново при каждом заходе на #/kanban
  // (renderKanbanPage) и удаляется из DOM при уходе на другую страницу, поэтому простой
  // проверки attachment достаточно, чтобы periodic-тик не трогал чужую страницу.
  if (!boardEl || !document.body.contains(boardEl)) return;
  const board = boardEl;
  board.innerHTML = '';

  for (const col of COLUMNS) {
    const section = document.createElement('section');
    section.className = 'column';
    section.dataset.status = col.id;
    section.dataset.color = col.color;

    const header = document.createElement('div');
    header.className = 'column-header';
    const dot = document.createElement('span');
    dot.className = 'column-dot';
    header.appendChild(dot);
    const title = document.createElement('span');
    title.className = 'column-title';
    title.textContent = col.label;
    header.appendChild(title);
    const count = document.createElement('span');
    count.className = 'count';
    count.id = 'count-' + col.id;
    header.appendChild(count);
    section.appendChild(header);

    const cards = document.createElement('div');
    cards.className = 'cards';
    cards.id = 'cards-' + col.id;
    section.appendChild(cards);

    board.appendChild(section);
  }

  setupDropZones();
  refreshTagFilterOptions();

  const filtersActive = isFiltersActive();
  for (const col of COLUMNS) {
    const container = document.getElementById('cards-' + col.id);
    const allInStatus = store.getTasks().filter(t => t.status === col.id);
    const visible = allInStatus.filter(taskMatchesFilters);
    document.getElementById('count-' + col.id).textContent = visible.length;

    if (visible.length === 0) {
      container.appendChild(buildEmptyColumnState(filtersActive && allInStatus.length > 0));
      continue;
    }

    for (const task of visible) {
      container.appendChild(buildCard(task));
    }
  }
}

// Лёгкое обновление visual deadline-состояния уже отрисованных карточек (overdue/soon),
// без полной перерисовки доски. Вызывается периодическим таймером вместо renderBoard().
function updateDeadlineVisuals() {
  if (!boardEl || !document.body.contains(boardEl)) return;
  const cardEls = boardEl.querySelectorAll('.card[data-id]');
  for (const cardEl of cardEls) {
    const task = store.getTask(cardEl.dataset.id);
    if (!task) continue;
    const info = getDeadlineInfo(task);
    cardEl.classList.toggle('is-overdue', info.state === 'overdue');
    cardEl.classList.toggle('is-soon', info.state === 'soon');
    const badge = cardEl.querySelector('.deadline-badge');
    if (badge) {
      badge.classList.remove('overdue', 'deadline-soon');
      if (info.state === 'overdue') { badge.classList.add('overdue'); badge.textContent = 'Просрочено: ' + formatDeadline(task.deadline); }
      else if (info.state === 'soon') { badge.classList.add('deadline-soon'); badge.textContent = 'Скоро: ' + formatDeadline(task.deadline); }
      else { badge.textContent = formatDeadline(task.deadline); }
    }
  }
}

function initialsFromName(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

// Строит avatar-элемент исполнителя: приоритет — реальный User (assigneeId),
// иначе (не мигрированные старые задачи) — legacyCollaboratorEmail. Новые задачи
// всегда сохраняют assigneeId, legacyCollaboratorEmail используется только для миграции.
function buildAssigneeAvatar(task) {
  if (task.assigneeId) {
    const user = store.getUserById(task.assigneeId);
    if (user) {
      const avatar = document.createElement('div');
      avatar.className = 'avatar';
      avatar.textContent = initialsFromName(user.name);
      avatar.title = user.name;
      return avatar;
    }
  }
  if (task.legacyCollaboratorEmail) {
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = emailInitials(task.legacyCollaboratorEmail);
    avatar.title = task.legacyCollaboratorEmail;
    return avatar;
  }
  return null;
}

function buildCard(task) {
  const card = document.createElement('div');
  card.className = 'card';
  card.draggable = true;
  card.dataset.id = task.id;

  const deadlineInfo = getDeadlineInfo(task);
  if (deadlineInfo.state === 'overdue') card.classList.add('is-overdue');
  else if (deadlineInfo.state === 'soon') card.classList.add('is-soon');

  const top = document.createElement('div');
  top.className = 'card-top';
  const title = document.createElement('div');
  title.className = 'card-title';
  title.textContent = task.title;
  top.appendChild(title);
  const avatar = buildAssigneeAvatar(task);
  if (avatar) top.appendChild(avatar);
  card.appendChild(top);

  if (task.description) {
    const desc = document.createElement('div');
    desc.className = 'card-description';
    desc.textContent = task.description;
    card.appendChild(desc);
  }

  const meta = document.createElement('div');
  meta.className = 'card-meta';

  if (task.deadline) {
    const badge = document.createElement('span');
    badge.className = 'badge deadline-badge';
    if (deadlineInfo.state === 'overdue') { badge.classList.add('overdue'); badge.textContent = 'Просрочено: ' + formatDeadline(task.deadline); }
    else if (deadlineInfo.state === 'soon') { badge.classList.add('deadline-soon'); badge.textContent = 'Скоро: ' + formatDeadline(task.deadline); }
    else { badge.textContent = formatDeadline(task.deadline); }
    meta.appendChild(badge);
  }

  if (task.reminderMinutes !== null && task.reminderMinutes !== undefined && task.deadline) {
    const rb = document.createElement('span');
    rb.className = 'badge reminder-badge';
    rb.textContent = '🔔 ' + (REMINDER_LABELS[String(task.reminderMinutes)] || 'напоминание');
    meta.appendChild(rb);
  }

  const priorityKey = task.priority || 'medium';
  const priorityBadge = document.createElement('span');
  priorityBadge.className = 'priority-badge priority-' + priorityKey;
  priorityBadge.textContent = PRIORITY_LABELS[priorityKey] || priorityKey;
  meta.appendChild(priorityBadge);

  if (meta.children.length > 0) card.appendChild(meta);

  const tags = task.tags || [];
  if (tags.length > 0) {
    const tagsRow = document.createElement('div');
    tagsRow.className = 'card-tags';
    const visible = tags.slice(0, 2);
    for (const tag of visible) {
      const chip = document.createElement('span');
      chip.className = 'tag-chip';
      chip.textContent = tag;
      tagsRow.appendChild(chip);
    }
    if (tags.length > visible.length) {
      const more = document.createElement('span');
      more.className = 'tag-chip tag-chip-more';
      more.textContent = '+' + (tags.length - visible.length);
      tagsRow.appendChild(more);
    }
    card.appendChild(tagsRow);
  }

  const attachmentsCount = (task.attachments || []).length;
  const commentsCount = (task.comments || []).length;
  if (attachmentsCount > 0 || commentsCount > 0) {
    const footer = document.createElement('div');
    footer.className = 'card-footer';
    if (attachmentsCount > 0) {
      const stat = document.createElement('span');
      stat.className = 'footer-stat';
      stat.textContent = '📎 ' + attachmentsCount;
      footer.appendChild(stat);
    }
    if (commentsCount > 0) {
      const stat = document.createElement('span');
      stat.className = 'footer-stat';
      stat.textContent = '💬 ' + commentsCount;
      footer.appendChild(stat);
    }
    card.appendChild(footer);
  }

  const moveRow = document.createElement('div');
  moveRow.className = 'move-row';
  const idx = STATUSES.indexOf(task.status);
  if (idx > 0) {
    const back = document.createElement('button');
    back.className = 'move-btn';
    back.textContent = '← ' + columnLabel(STATUSES[idx - 1]);
    back.addEventListener('click', (e) => { e.stopPropagation(); moveTask(task.id, STATUSES[idx - 1]); });
    moveRow.appendChild(back);
  }
  if (idx < STATUSES.length - 1) {
    const fwd = document.createElement('button');
    fwd.className = 'move-btn';
    fwd.textContent = columnLabel(STATUSES[idx + 1]) + ' →';
    fwd.addEventListener('click', (e) => { e.stopPropagation(); moveTask(task.id, STATUSES[idx + 1]); });
    moveRow.appendChild(fwd);
  }
  card.appendChild(moveRow);

  card.addEventListener('click', () => openEditModal(task.id));

  card.addEventListener('dragstart', (e) => {
    card.classList.add('dragging');
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
  });
  card.addEventListener('dragend', () => card.classList.remove('dragging'));

  return card;
}

function columnLabel(status) {
  const col = COLUMNS.find(c => c.id === status);
  return col ? col.label : status;
}

function emailInitials(email) {
  const namePart = email.split('@')[0] || email;
  const pieces = namePart.split(/[._-]/).filter(Boolean);
  if (pieces.length >= 2) return (pieces[0][0] + pieces[1][0]).toUpperCase();
  return namePart.slice(0, 2).toUpperCase();
}

function moveTask(id, newStatus) {
  const { ok } = store.updateTask(id, { status: newStatus });
  if (!ok) { showToast('Ошибка сохранения', 'Не получилось сохранить изменения.'); return; }
  renderBoard();
}

// ---------- Дедлайны ----------

function getDeadlineInfo(task) {
  if (!task.deadline || task.status === 'done') return { state: 'none' };
  const now = Date.now();
  const deadlineMs = new Date(task.deadline).getTime();
  if (isNaN(deadlineMs)) return { state: 'none' };
  if (deadlineMs < now) return { state: 'overdue' };
  const hoursLeft = (deadlineMs - now) / 3600000;
  if (hoursLeft <= 24) return { state: 'soon' };
  return { state: 'ok' };
}

function formatDeadline(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' Б';
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' КБ';
  return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
}

function getExtension(filename) {
  const idx = filename.lastIndexOf('.');
  return idx === -1 ? '' : filename.slice(idx).toLowerCase();
}

// ---------- Demo-only permissions (UI-level, не настоящая безопасность) ----------

// Owner может назначать задачу любому сотруднику компании; Manager — себе и Employee;
// Employee — только себе.
function getAssignableUsers(currentUser) {
  // Неактивных сотрудников не предлагаем для нового назначения — уже назначенный
  // (в том числе неактивный) исполнитель всё равно сохраняется отдельной веткой ниже.
  const companyUsers = store.getUsers().filter(u => u.companyId === currentUser.companyId && u.active !== false);
  if (currentUser.role === 'owner') return companyUsers;
  if (currentUser.role === 'manager') {
    return companyUsers.filter(u => u.id === currentUser.id || u.role === 'employee');
  }
  return companyUsers.filter(u => u.id === currentUser.id);
}

// Значение <option>, представляющее мигрированную legacy-задачу, у которой ещё нет
// настоящего assigneeId (только legacyCollaboratorEmail). Не является реальным user.id —
// submit-обработчик не должен сохранять его как assigneeId.
const LEGACY_UNASSIGNED_VALUE = '__legacy_unassigned__';

// task === null в режиме создания. В режиме редактирования передаётся вся задача,
// чтобы можно было отличить «нет assigneeId вообще» (новый workflow, дефолт — «Я»)
// от «мигрированная задача с legacyCollaboratorEmail, но без assigneeId» (не подставлять
// текущего пользователя молча — иначе legacy-данные тихо перезаписываются при сохранении).
function populateAssigneeOptions(task) {
  const currentUser = store.getCurrentUser();
  fieldAssignee.innerHTML = '';
  if (!currentUser) return;

  const selectedUserId = task ? task.assigneeId : null;
  const legacyEmail = task ? task.legacyCollaboratorEmail : null;

  let assignable = getAssignableUsers(currentUser);
  // При редактировании уже назначенного пользователя, которого текущая demo-роль
  // больше не имеет права выбрать заново, всё равно показываем его в списке —
  // иначе drawer тихо потерял бы существующее назначение.
  if (selectedUserId && !assignable.some(u => u.id === selectedUserId)) {
    const existing = store.getUserById(selectedUserId);
    if (existing) assignable = assignable.concat([existing]);
  }

  if (!selectedUserId && legacyEmail) {
    const legacyOption = document.createElement('option');
    legacyOption.value = LEGACY_UNASSIGNED_VALUE;
    legacyOption.textContent = 'Не назначен / legacy: ' + legacyEmail;
    fieldAssignee.appendChild(legacyOption);
  }

  const meOption = document.createElement('option');
  meOption.value = currentUser.id;
  meOption.textContent = 'Я (' + currentUser.name + ')';
  fieldAssignee.appendChild(meOption);

  for (const user of assignable) {
    if (user.id === currentUser.id) continue; // уже показан как «Я»
    const option = document.createElement('option');
    option.value = user.id;
    option.textContent = user.name + ' (' + (ROLE_LABELS[user.role] || user.role) + ')';
    fieldAssignee.appendChild(option);
  }

  if (selectedUserId && assignable.some(u => u.id === selectedUserId)) {
    fieldAssignee.value = selectedUserId;
  } else if (!selectedUserId && legacyEmail) {
    fieldAssignee.value = LEGACY_UNASSIGNED_VALUE;
  } else {
    fieldAssignee.value = currentUser.id;
  }
}

// ---------- Теги ----------

function renderTagList() {
  tagList.innerHTML = '';
  for (const tag of formTags) {
    const chip = document.createElement('span');
    chip.className = 'tag-chip';
    chip.textContent = tag;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'tag-chip-remove';
    remove.textContent = '✕';
    remove.title = 'Удалить тег';
    remove.addEventListener('click', () => {
      formTags = formTags.filter(t => t !== tag);
      renderTagList();
    });
    chip.appendChild(remove);
    tagList.appendChild(chip);
  }
}

function addTagFromInput() {
  const value = fieldTagInput.value.trim();
  if (!value) return;
  const exists = formTags.some(t => t.toLowerCase() === value.toLowerCase());
  if (!exists) {
    formTags.push(value);
    renderTagList();
  }
  fieldTagInput.value = '';
}

// ---------- Панель создания/редактирования ----------

function openCreateModal() {
  editingTaskId = null;
  formAttachments = [];
  formTags = [];
  modalTitle.textContent = 'Новая задача';
  taskForm.reset();
  populateAssigneeOptions(null);
  // ^ null => create-mode: только реальные пользователи, дефолт «Я», без legacy-варианта.
  fieldPriority.value = 'medium';
  renderTagList();
  renderAttachmentList();
  commentsSection.hidden = true;
  deleteBtn.hidden = true;
  modalOverlay.hidden = false;
  fieldTitle.focus();
}

function openEditModal(id) {
  const task = store.getTask(id);
  if (!task) return;
  editingTaskId = id;
  formAttachments = (task.attachments || []).slice();
  formTags = (task.tags || []).slice();
  modalTitle.textContent = 'Редактировать задачу';
  fieldTitle.value = task.title;
  fieldDescription.value = task.description || '';
  fieldDeadline.value = task.deadline ? toLocalInputValue(task.deadline) : '';
  fieldReminder.value = task.reminderMinutes !== null && task.reminderMinutes !== undefined ? String(task.reminderMinutes) : '';
  populateAssigneeOptions(task);
  fieldPriority.value = task.priority || 'medium';
  renderTagList();
  renderAttachmentList();
  commentsSection.hidden = false;
  renderCommentsList(task.comments || []);
  fieldNewComment.value = '';
  deleteBtn.hidden = false;
  modalOverlay.hidden = false;
  fieldTitle.focus();
}

function closeModal() {
  modalOverlay.hidden = true;
  editingTaskId = null;
  formAttachments = [];
  formTags = [];
  if (onDrawerClosed) onDrawerClosed();
}

function toLocalInputValue(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function wireDrawerEvents() {
  cancelBtn.addEventListener('click', closeModal);
  closeDrawerBtn.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modalOverlay.hidden) closeModal();
  });

  addTagBtn.addEventListener('click', addTagFromInput);
  fieldTagInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTagFromInput();
    }
  });

  deleteBtn.addEventListener('click', () => {
    if (!editingTaskId) return;
    const ok = store.deleteTask(editingTaskId);
    if (!ok) { showToast('Ошибка сохранения', 'Не получилось сохранить изменения.'); return; }
    renderBoard();
    closeModal();
  });

  taskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = fieldTitle.value.trim();
    if (!title) { fieldTitle.focus(); return; }

    const assigneeRaw = fieldAssignee.value;
    if (!assigneeRaw) { fieldAssignee.focus(); return; }

    const deadlineRaw = fieldDeadline.value;
    let deadlineIso = null;
    if (deadlineRaw) {
      const parsed = new Date(deadlineRaw);
      if (isNaN(parsed.getTime())) { fieldDeadline.focus(); return; }
      deadlineIso = parsed.toISOString();
    }
    const reminderRaw = fieldReminder.value;
    const reminderMinutes = (reminderRaw !== '' && deadlineIso) ? Number(reminderRaw) : null;

    const patch = {
      title,
      description: fieldDescription.value.trim(),
      deadline: deadlineIso,
      reminderMinutes,
      reminderShown: false, // изменили дедлайн/напоминание — можно показать снова
      priority: fieldPriority.value,
      tags: formTags.slice(),
      attachments: formAttachments,
    };

    if (assigneeRaw === LEGACY_UNASSIGNED_VALUE) {
      // Пользователь не выбрал нового исполнителя для мигрированной legacy-задачи —
      // не трогаем assigneeId/legacyCollaboratorEmail, чтобы не потерять данные.
    } else {
      // Явный выбор реального исполнителя (в т.ч. при создании — здесь этот вариант
      // всегда реальный user.id, т.к. legacy-опция появляется только при редактировании).
      patch.assigneeId = assigneeRaw;
      patch.legacyCollaboratorEmail = null;
    }

    let result;
    if (editingTaskId) {
      result = store.updateTask(editingTaskId, patch);
    } else {
      result = store.createTask({ ...patch, comments: [], status: 'backlog' });
      if (result.ok && result.task.assigneeId !== result.task.creatorId) {
        store.createNotification({
          companyId: result.task.companyId,
          type: 'task_assigned',
          recipientId: result.task.assigneeId,
          entityId: result.task.id,
        });
      }
      maybeRequestNotificationPermission();
    }

    if (!result.ok) {
      showToast('Ошибка сохранения', 'Не получилось сохранить изменения — возможно, вложения слишком большие для хранилища браузера.');
      return; // не закрываем панель, чтобы пользователь не потерял ввод
    }
    renderBoard();
    closeModal();
  });
}

// ---------- Вложения ----------

function wireAttachmentEvents() {
  attachBtn.addEventListener('click', () => fieldAttachments.click());

  fieldAttachments.addEventListener('change', async () => {
    const files = Array.from(fieldAttachments.files || []);
    for (const file of files) {
      const ext = getExtension(file.name);
      const allowed = ALLOWED_ATTACHMENTS[ext];
      if (!allowed) {
        showToast('Файл не поддерживается', `«${file.name}»: разрешены только Word, Excel, PowerPoint, CSV, PDF и JPEG.`);
        continue;
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        showToast('Файл слишком большой', `«${file.name}» больше 5 МБ. Выберите файл меньшего размера.`);
        continue;
      }
      try {
        const dataUrl = await readFileAsDataUrl(file);
        formAttachments.push({
          id: store.generateId('att'),
          name: file.name,
          size: file.size,
          ext,
          dataUrl,
        });
      } catch (e) {
        showToast('Не удалось прикрепить файл', `«${file.name}»: ошибка чтения файла.`);
      }
    }
    fieldAttachments.value = '';
    renderAttachmentList();
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function renderAttachmentList() {
  attachmentList.innerHTML = '';
  for (const att of formAttachments) {
    const row = document.createElement('div');
    row.className = 'attachment-item';

    const icon = document.createElement('span');
    icon.className = 'attachment-icon';
    icon.textContent = (ALLOWED_ATTACHMENTS[att.ext] || { icon: '📎' }).icon;
    row.appendChild(icon);

    const link = document.createElement('a');
    link.className = 'attachment-name';
    link.textContent = att.name;
    link.href = att.dataUrl;
    link.download = att.name;
    link.target = '_blank';
    link.rel = 'noopener';
    row.appendChild(link);

    const size = document.createElement('span');
    size.className = 'attachment-size';
    size.textContent = formatFileSize(att.size);
    row.appendChild(size);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'attachment-remove';
    remove.textContent = '✕';
    remove.title = 'Удалить вложение';
    remove.addEventListener('click', () => {
      formAttachments = formAttachments.filter(a => a.id !== att.id);
      renderAttachmentList();
    });
    row.appendChild(remove);

    attachmentList.appendChild(row);
  }
}

// ---------- Комментарии ----------

function renderCommentsList(comments) {
  commentsList.innerHTML = '';
  if (!comments || comments.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'comments-empty';
    empty.textContent = 'Пока нет комментариев';
    commentsList.appendChild(empty);
    return;
  }
  const sorted = comments.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  for (const c of sorted) {
    const item = document.createElement('div');
    item.className = 'comment-item';
    const text = document.createElement('div');
    text.className = 'comment-text';
    text.textContent = c.text;
    item.appendChild(text);
    const time = document.createElement('div');
    time.className = 'comment-time';
    // Старые комментарии (Этап 1-3) сохранены без authorId — просто показываем дату,
    // без падения/ошибок.
    const author = c.authorId ? store.getUserById(c.authorId) : null;
    time.textContent = (author ? author.name + ' · ' : '') + formatDeadline(c.createdAt);
    item.appendChild(time);
    commentsList.appendChild(item);
  }
}

function wireCommentEvents() {
  addCommentBtn.addEventListener('click', () => {
    if (!editingTaskId) return;
    const text = fieldNewComment.value.trim();
    if (!text) return;
    const task = store.getTask(editingTaskId);
    if (!task) return;
    const currentUser = store.getCurrentUser();
    const comments = (task.comments || []).concat([{
      id: store.generateId('comment'),
      text,
      authorId: currentUser ? currentUser.id : null,
      createdAt: new Date().toISOString(),
    }]);
    const { ok } = store.updateTask(editingTaskId, { comments });
    if (!ok) { showToast('Ошибка сохранения', 'Не получилось сохранить комментарий.'); return; }
    fieldNewComment.value = '';
    renderCommentsList(store.getTask(editingTaskId).comments);
    renderBoard();
  });
}

// ---------- Drag & Drop (мышь, десктоп) ----------

function setupDropZones() {
  for (const status of STATUSES) {
    const container = document.getElementById('cards-' + status);
    container.addEventListener('dragover', (e) => {
      e.preventDefault();
      container.classList.add('drag-over');
    });
    container.addEventListener('dragleave', () => container.classList.remove('drag-over'));
    container.addEventListener('drop', (e) => {
      e.preventDefault();
      container.classList.remove('drag-over');
      const id = e.dataTransfer.getData('text/plain');
      if (id) moveTask(id, status);
    });
  }
}

// ---------- Уведомления и напоминания ----------

function maybeRequestNotificationPermission() {
  if (notificationPermissionAsked) return;
  notificationPermissionAsked = true;
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function showToast(title, body) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast';
  const strong = document.createElement('strong');
  strong.textContent = title;
  toast.appendChild(strong);
  const text = document.createElement('div');
  text.textContent = body;
  toast.appendChild(text);
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 8000);
}

function checkReminders() {
  const now = Date.now();
  for (const task of store.getTasks()) {
    if (task.reminderShown) continue;
    if (task.reminderMinutes === null || task.reminderMinutes === undefined) continue;
    if (!task.deadline) continue;
    if (task.status === 'done') continue;
    const deadlineMs = new Date(task.deadline).getTime();
    if (isNaN(deadlineMs)) continue;
    const triggerMs = deadlineMs - task.reminderMinutes * 60000;
    if (now >= triggerMs) {
      fireReminder(task);
      store.updateTask(task.id, { reminderShown: true });
    }
  }
}

function fireReminder(task) {
  const bodyText = 'Дедлайн: ' + formatDeadline(task.deadline);
  showToast('Напоминание: ' + task.title, bodyText);
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification('Напоминание: ' + task.title, { body: bodyText });
    } catch (e) {
      // тихо игнорируем — тост уже показан
    }
  }
}
