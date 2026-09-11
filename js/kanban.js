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

let editingTaskId = null;
let notificationPermissionAsked = false;
let formAttachments = [];
let boardEl = null; // контейнер доски, если страница #/kanban сейчас смонтирована

// ---------- Drawer: DOM-ссылки (статические элементы index.html) ----------

let modalOverlay, modalTitle, taskForm, fieldTitle, fieldDescription, fieldDeadline,
  fieldReminder, fieldCollaborator, collaboratorHint, fieldAttachments, attachBtn,
  attachmentList, commentsSection, commentsList, fieldNewComment, addCommentBtn,
  deleteBtn, cancelBtn, closeDrawerBtn;

function cacheDrawerRefs() {
  modalOverlay = document.getElementById('modalOverlay');
  modalTitle = document.getElementById('modalTitle');
  taskForm = document.getElementById('taskForm');
  fieldTitle = document.getElementById('fieldTitle');
  fieldDescription = document.getElementById('fieldDescription');
  fieldDeadline = document.getElementById('fieldDeadline');
  fieldReminder = document.getElementById('fieldReminder');
  fieldCollaborator = document.getElementById('fieldCollaborator');
  collaboratorHint = document.getElementById('collaboratorHint');
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
  setInterval(() => {
    checkReminders();
    renderBoard();
  }, 30000);
}

export function renderKanbanPage(container) {
  boardEl = container;
  boardEl.className = 'main-content board';
  renderBoard();
}

export function openCreateTaskDrawer() {
  openCreateModal();
}

// ---------- Рендеринг доски ----------

function renderBoard() {
  // boardEl (#mainContent) is a persistent shell element reused by every route,
  // so besides being attached it must still be showing the kanban page right now —
  // otherwise the periodic reminder tick would overwrite whatever page is active.
  if (!boardEl || !document.body.contains(boardEl) || !boardEl.classList.contains('board')) return;
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

  const tasks = store.getTasks();
  for (const col of COLUMNS) {
    const container = document.getElementById('cards-' + col.id);
    const list = tasks.filter(t => t.status === col.id);
    document.getElementById('count-' + col.id).textContent = list.length;

    if (list.length === 0) {
      const hint = document.createElement('div');
      hint.className = 'empty-hint';
      hint.textContent = 'Пусто';
      container.appendChild(hint);
      continue;
    }

    for (const task of list) {
      container.appendChild(buildCard(task));
    }
  }
}

function getAssigneeDisplayEmail(task) {
  if (task.assigneeId) {
    const user = store.getUserById(task.assigneeId);
    if (user) return user.email;
  }
  return task.legacyCollaboratorEmail || null;
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
  const assigneeEmail = getAssigneeDisplayEmail(task);
  if (assigneeEmail) {
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = emailInitials(assigneeEmail);
    avatar.title = assigneeEmail;
    top.appendChild(avatar);
  }
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
    badge.className = 'badge';
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

  if (meta.children.length > 0) card.appendChild(meta);

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

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// ---------- Панель создания/редактирования ----------

function openCreateModal() {
  editingTaskId = null;
  formAttachments = [];
  modalTitle.textContent = 'Новая задача';
  taskForm.reset();
  collaboratorHint.textContent = '';
  collaboratorHint.classList.remove('error');
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
  modalTitle.textContent = 'Редактировать задачу';
  fieldTitle.value = task.title;
  fieldDescription.value = task.description || '';
  fieldDeadline.value = task.deadline ? toLocalInputValue(task.deadline) : '';
  fieldReminder.value = task.reminderMinutes !== null && task.reminderMinutes !== undefined ? String(task.reminderMinutes) : '';
  fieldCollaborator.value = getAssigneeDisplayEmail(task) || '';
  collaboratorHint.textContent = '';
  collaboratorHint.classList.remove('error');
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

  fieldCollaborator.addEventListener('input', () => {
    const value = fieldCollaborator.value.trim();
    if (!value) {
      collaboratorHint.textContent = '';
      collaboratorHint.classList.remove('error');
    } else if (!isValidEmail(value)) {
      collaboratorHint.textContent = 'Похоже, это не email — проверьте формат (например, name@company.com)';
      collaboratorHint.classList.add('error');
    } else {
      collaboratorHint.textContent = '';
      collaboratorHint.classList.remove('error');
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

    const collaboratorRaw = fieldCollaborator.value.trim();
    if (collaboratorRaw && !isValidEmail(collaboratorRaw)) {
      collaboratorHint.textContent = 'Исправьте email соисполнителя перед сохранением';
      collaboratorHint.classList.add('error');
      fieldCollaborator.focus();
      return;
    }
    const matchedUser = collaboratorRaw ? store.getUserByEmail(collaboratorRaw) : null;
    const assigneeId = matchedUser ? matchedUser.id : null;
    const legacyCollaboratorEmail = (collaboratorRaw && !matchedUser) ? collaboratorRaw : null;

    const deadlineRaw = fieldDeadline.value;
    const deadlineIso = deadlineRaw ? new Date(deadlineRaw).toISOString() : null;
    const reminderRaw = fieldReminder.value;
    const reminderMinutes = (reminderRaw !== '' && deadlineIso) ? Number(reminderRaw) : null;

    const patch = {
      title,
      description: fieldDescription.value.trim(),
      deadline: deadlineIso,
      reminderMinutes,
      reminderShown: false, // изменили дедлайн/напоминание — можно показать снова
      assigneeId,
      legacyCollaboratorEmail,
      attachments: formAttachments,
    };

    let result;
    if (editingTaskId) {
      result = store.updateTask(editingTaskId, patch);
    } else {
      result = store.createTask({ ...patch, comments: [], status: 'backlog' });
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
    time.textContent = formatDeadline(c.createdAt);
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
    const comments = (task.comments || []).concat([{
      id: store.generateId('comment'),
      text,
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
