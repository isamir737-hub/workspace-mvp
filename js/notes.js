// Notes: список/поиск/редактор/autosave/share/delete. Данные — только через store.js.

import * as store from './store.js';
import { openShareDialog, buildSharingBadge, isVisibleToUser } from './sharing.js';
import { showToast } from './toast.js';

const ICONS = {
  search: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
};

let notesSearchQuery = '';
let notesListItemsEl = null;
let onOpenNoteCallback = null;

let noteSaveTimer = null;
let pendingNotePatch = {};
let pendingNoteId = null;

function formatDateTime(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function stripHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html || '';
  return tmp.textContent || '';
}

function buildEmptyHint(title, helper) {
  const wrap = document.createElement('div');
  wrap.className = 'empty-hint';
  const t = document.createElement('div');
  t.className = 'empty-hint-title';
  t.textContent = title;
  wrap.appendChild(t);
  const h = document.createElement('div');
  h.className = 'empty-hint-helper';
  h.textContent = helper;
  wrap.appendChild(h);
  return wrap;
}

function scheduleNoteSave(noteId, patch) {
  if (pendingNoteId && pendingNoteId !== noteId) flushPendingNoteSave();
  pendingNoteId = noteId;
  Object.assign(pendingNotePatch, patch);
  clearTimeout(noteSaveTimer);
  noteSaveTimer = setTimeout(flushPendingNoteSave, 600);
}

function flushPendingNoteSave() {
  clearTimeout(noteSaveTimer);
  if (!pendingNoteId || Object.keys(pendingNotePatch).length === 0) {
    pendingNoteId = null;
    pendingNotePatch = {};
    return;
  }
  const result = store.updateNote(pendingNoteId, pendingNotePatch);
  if (!result.ok) showToast('Ошибка сохранения', 'Не получилось сохранить заметку — возможно, хранилище браузера переполнено.');
  pendingNotePatch = {};
  pendingNoteId = null;
}

function getVisibleNotes(currentUser) {
  return store.getNotes()
    .filter(n => n.companyId === currentUser.companyId)
    .filter(n => isVisibleToUser(n, currentUser));
}

// ---------- Список ----------

export function renderNotesList(container, { onOpenNote }) {
  onOpenNoteCallback = onOpenNote;

  const wrap = document.createElement('div');
  wrap.className = 'ws-list-page';

  const toolbar = document.createElement('div');
  toolbar.className = 'list-toolbar';

  const searchWrap = document.createElement('label');
  searchWrap.className = 'kanban-search';
  searchWrap.innerHTML = ICONS.search;
  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.placeholder = 'Поиск заметок...';
  searchInput.setAttribute('aria-label', 'Поиск заметок');
  searchInput.value = notesSearchQuery;
  searchInput.addEventListener('input', () => {
    notesSearchQuery = searchInput.value.trim().toLowerCase();
    renderNotesListItems();
  });
  searchWrap.appendChild(searchInput);
  toolbar.appendChild(searchWrap);

  const spacer = document.createElement('div');
  spacer.className = 'toolbar-spacer-flex';
  toolbar.appendChild(spacer);

  const newBtn = document.createElement('button');
  newBtn.type = 'button';
  newBtn.className = 'btn-primary';
  newBtn.innerHTML = '<span class="plus" aria-hidden="true">+</span> Новая заметка';
  newBtn.addEventListener('click', () => {
    const result = store.createNote({ title: '', content: '' });
    if (!result.ok) { showToast('Ошибка сохранения', 'Не получилось создать заметку — возможно, хранилище браузера переполнено.'); return; }
    if (onOpenNoteCallback) onOpenNoteCallback(result.note.id);
  });
  toolbar.appendChild(newBtn);

  wrap.appendChild(toolbar);

  notesListItemsEl = document.createElement('div');
  notesListItemsEl.className = 'ws-list-items';
  wrap.appendChild(notesListItemsEl);

  container.appendChild(wrap);
  renderNotesListItems();
}

function renderNotesListItems() {
  notesListItemsEl.innerHTML = '';
  const currentUser = store.getCurrentUser();
  if (!currentUser) return;
  let notes = getVisibleNotes(currentUser);
  if (notesSearchQuery) {
    notes = notes.filter(n =>
      (n.title || '').toLowerCase().includes(notesSearchQuery) ||
      stripHtml(n.content).toLowerCase().includes(notesSearchQuery)
    );
  }
  notes = notes.slice().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  if (notes.length === 0) {
    notesListItemsEl.appendChild(buildEmptyHint(
      'Нет заметок',
      notesSearchQuery ? 'Ничего не найдено — попробуйте другой запрос.' : 'Создайте первую заметку.'
    ));
    return;
  }
  for (const note of notes) {
    notesListItemsEl.appendChild(buildNoteListItem(note, currentUser));
  }
}

function buildNoteListItem(note, currentUser) {
  const item = document.createElement('button');
  item.type = 'button';
  item.className = 'list-item-card';

  const title = document.createElement('div');
  title.className = 'list-item-title';
  title.textContent = note.title || 'Без названия';
  item.appendChild(title);

  const preview = stripHtml(note.content).trim();
  if (preview) {
    const previewEl = document.createElement('div');
    previewEl.className = 'list-item-preview';
    previewEl.textContent = preview;
    item.appendChild(previewEl);
  }

  const meta = document.createElement('div');
  meta.className = 'list-item-meta';
  const updated = document.createElement('span');
  updated.textContent = formatDateTime(note.updatedAt);
  meta.appendChild(updated);
  meta.appendChild(buildSharingBadge(note, currentUser));
  item.appendChild(meta);

  item.addEventListener('click', () => { if (onOpenNoteCallback) onOpenNoteCallback(note.id); });
  return item;
}

// ---------- Редактор ----------

export function renderNoteEditor(container, noteId, { onBack }) {
  const note = store.getNote(noteId);
  const currentUser = store.getCurrentUser();
  // noteId может быть "унаследован" из view-state прошлой сессии (например, после
  // demo user switching без полной перезагрузки страницы) — не показываем чужую
  // приватную заметку только потому, что её id остался в module-level state.
  if (!note || !currentUser || !isVisibleToUser(note, currentUser)) { onBack(); return; }
  const isOwner = note.ownerId === currentUser.id;

  const wrap = document.createElement('div');
  wrap.className = 'editor-page';

  const topRow = document.createElement('div');
  topRow.className = 'editor-top-row';

  const backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.className = 'btn-secondary btn-small';
  backBtn.textContent = '← К списку';
  backBtn.addEventListener('click', () => { flushPendingNoteSave(); onBack(); });
  topRow.appendChild(backBtn);

  const spacer = document.createElement('div');
  spacer.className = 'toolbar-spacer-flex';
  topRow.appendChild(spacer);

  topRow.appendChild(buildSharingBadge(note, currentUser));

  if (isOwner) {
    const shareBtn = document.createElement('button');
    shareBtn.type = 'button';
    shareBtn.className = 'btn-secondary btn-small';
    shareBtn.textContent = 'Share';
    shareBtn.addEventListener('click', async () => {
      const selected = await openShareDialog(note.sharedWith || []);
      if (!selected) return;
      store.updateNote(note.id, { sharedWith: selected, visibility: selected.length ? 'shared' : 'private' });
      renderNoteEditor(container, noteId, { onBack });
    });
    topRow.appendChild(shareBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn-danger btn-small';
    deleteBtn.textContent = 'Удалить';
    deleteBtn.addEventListener('click', () => {
      flushPendingNoteSave();
      store.deleteNote(note.id);
      onBack();
    });
    topRow.appendChild(deleteBtn);
  }
  wrap.appendChild(topRow);

  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.className = 'note-title-input';
  titleInput.value = note.title || '';
  titleInput.placeholder = 'Без названия';
  titleInput.maxLength = 120;
  titleInput.disabled = !isOwner;
  titleInput.addEventListener('input', () => scheduleNoteSave(note.id, { title: titleInput.value }));
  wrap.appendChild(titleInput);

  if (isOwner) {
    const toolbar = document.createElement('div');
    toolbar.className = 'rich-toolbar';
    toolbar.appendChild(buildFormatBtn('B', 'bold', 'Полужирный'));
    toolbar.appendChild(buildFormatBtn('I', 'italic', 'Курсив'));
    toolbar.appendChild(buildFormatBtn('•', 'insertUnorderedList', 'Маркированный список'));
    toolbar.appendChild(buildFormatBtn('1.', 'insertOrderedList', 'Нумерованный список'));
    wrap.appendChild(toolbar);
  }

  const contentEl = document.createElement('div');
  contentEl.className = 'note-content-editable';
  contentEl.contentEditable = isOwner ? 'true' : 'false';
  contentEl.innerHTML = note.content || '';
  if (!isOwner) contentEl.classList.add('is-readonly');
  contentEl.addEventListener('input', () => scheduleNoteSave(note.id, { content: contentEl.innerHTML }));
  wrap.appendChild(contentEl);

  container.appendChild(wrap);
}

function buildFormatBtn(label, command, title) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'format-btn';
  btn.textContent = label;
  btn.title = title;
  btn.addEventListener('mousedown', (e) => e.preventDefault());
  btn.addEventListener('click', () => document.execCommand(command, false, null));
  return btn;
}
