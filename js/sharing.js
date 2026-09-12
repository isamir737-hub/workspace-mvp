// Общий Share-диалог, переиспользуемый Notes и Whiteboard. Работает поверх Store —
// сам ничего не сохраняет, только возвращает выбранный список userId вызывающему коду.

import * as store from './store.js';

let overlayEl, listEl, saveBtn, cancelBtn, closeBtn, built = false;
let onSaveCallback = null;

function ensureDialog() {
  if (built) return;
  built = true;

  overlayEl = document.createElement('div');
  overlayEl.className = 'drawer-overlay';
  overlayEl.hidden = true;

  const drawer = document.createElement('aside');
  drawer.className = 'drawer share-drawer';

  const header = document.createElement('div');
  header.className = 'drawer-header';
  const h2 = document.createElement('h2');
  h2.textContent = 'Поделиться';
  header.appendChild(h2);
  closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'icon-btn';
  closeBtn.setAttribute('aria-label', 'Закрыть');
  closeBtn.textContent = '✕';
  header.appendChild(closeBtn);
  drawer.appendChild(header);

  const body = document.createElement('div');
  body.className = 'drawer-body';
  const label = document.createElement('span');
  label.className = 'field-label';
  label.textContent = 'Сотрудники';
  body.appendChild(label);
  listEl = document.createElement('div');
  listEl.className = 'participant-list';
  body.appendChild(listEl);
  drawer.appendChild(body);

  const actions = document.createElement('div');
  actions.className = 'drawer-actions';
  actions.appendChild(document.createElement('div'));
  const actionsRight = document.createElement('div');
  actionsRight.className = 'drawer-actions-right';
  cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn-secondary';
  cancelBtn.textContent = 'Отмена';
  actionsRight.appendChild(cancelBtn);
  saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'btn-primary';
  saveBtn.textContent = 'Сохранить';
  actionsRight.appendChild(saveBtn);
  actions.appendChild(actionsRight);
  drawer.appendChild(actions);

  overlayEl.appendChild(drawer);
  document.body.appendChild(overlayEl);

  closeBtn.addEventListener('click', close);
  cancelBtn.addEventListener('click', close);
  overlayEl.addEventListener('click', (e) => { if (e.target === overlayEl) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !overlayEl.hidden) close(); });
  saveBtn.addEventListener('click', () => {
    const selected = Array.from(listEl.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
    const cb = onSaveCallback;
    close();
    if (cb) cb(selected);
  });
}

function close() {
  overlayEl.hidden = true;
  onSaveCallback = null;
}

// Возвращает Promise<string[] | null> — массив выбранных userId, либо null при отмене.
export function openShareDialog(currentSharedWith) {
  ensureDialog();
  return new Promise((resolve) => {
    const currentUser = store.getCurrentUser();
    listEl.innerHTML = '';
    // Неактивных сотрудников не предлагаем для нового share — но уже расшаренному
    // (историческому) пользователю всё равно даём остаться в списке отмеченным.
    const companyUsers = currentUser
      ? store.getUsers().filter(u =>
          u.companyId === currentUser.companyId && u.id !== currentUser.id &&
          (u.active !== false || (currentSharedWith || []).includes(u.id))
        )
      : [];
    if (companyUsers.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'comments-empty';
      empty.textContent = 'Нет доступных сотрудников';
      listEl.appendChild(empty);
    } else {
      for (const user of companyUsers) {
        const row = document.createElement('label');
        row.className = 'participant-item';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = user.id;
        cb.checked = (currentSharedWith || []).includes(user.id);
        row.appendChild(cb);
        const name = document.createElement('span');
        name.textContent = user.name;
        row.appendChild(name);
        listEl.appendChild(row);
      }
    }
    onSaveCallback = resolve;
    overlayEl.hidden = false;
  });
}

// Общий хелпер отображения бейджа "Private" / "Shared · N" / "Расшарено вам" —
// используется и Notes, и Whiteboard, и держит одинаковую логику видимости.
export function buildSharingBadge(entity, currentUser) {
  const badge = document.createElement('span');
  const isOwner = entity.ownerId === currentUser.id;
  badge.className = 'sharing-badge' + (isOwner ? '' : ' is-shared-with-me');
  if (!isOwner) badge.textContent = 'Расшарено вам';
  else badge.textContent = (entity.sharedWith && entity.sharedWith.length) ? 'Shared · ' + entity.sharedWith.length : 'Private';
  return badge;
}

export function isVisibleToUser(entity, currentUser) {
  return entity.ownerId === currentUser.id || (entity.sharedWith || []).includes(currentUser.id);
}
