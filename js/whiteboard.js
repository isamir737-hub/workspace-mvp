// Whiteboard: список досок + canvas (select/hand/pen/highlighter/eraser/text/sticky/
// shapes/connector, undo/redo, pan/zoom, debounced persistence). Данные — только
// через store.js. Совместимо со старыми объектами (sticky/text/rectangle/ellipse/connector),
// у новых полей — safe defaults (см. normalizeObject).

import * as store from './store.js';
import { openShareDialog, buildSharingBadge, isVisibleToUser } from './sharing.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

const ICONS = {
  select: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4l7.07 16.97 2.51-7.39 7.39-2.51z"/></svg>',
  hand: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11.5V5.5a1.5 1.5 0 0 1 3 0v5"/><path d="M12 10.5v-6a1.5 1.5 0 0 1 3 0v6.5"/><path d="M15 11V7a1.5 1.5 0 0 1 3 0v7"/><path d="M9 12l-1.8-1.8a1.5 1.5 0 0 0-2.4 1.8L7 17a5 5 0 0 0 5 3h1.5a5.5 5.5 0 0 0 5.5-5.5V11"/></svg>',
  pen: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  highlighter: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 21v-3.5L14.5 6 18 9.5 6.5 21H3z"/><path d="M13 7l4 4"/></svg>',
  eraser: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 21H4a1 1 0 0 1-.71-1.71l10-10a2 2 0 0 1 2.83 0l4.59 4.59a2 2 0 0 1 0 2.83L13 21"/><path d="M13 21H7"/></svg>',
  text: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="4 7 4 4 20 4 20 7"/><line x1="12" y1="4" x2="12" y2="20"/><line x1="9" y1="20" x2="15" y2="20"/></svg>',
  sticky: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h16v12l-5 5H4z"/><path d="M15 21v-4a1 1 0 0 1 1-1h4"/></svg>',
  shapes: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="8" height="8" rx="1.5"/><circle cx="16.5" cy="16.5" r="4.5"/></svg>',
  connector: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="5" cy="19" r="2"/><circle cx="19" cy="5" r="2"/><line x1="6.5" y1="17.5" x2="17.5" y2="6.5"/></svg>',
  undo: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-2"/></svg>',
  redo: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h2"/></svg>',
  zoomOut: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>',
  zoomIn: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>',
  rectangle: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="1.5"/></svg>',
  ellipse: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><ellipse cx="12" cy="12" rx="9" ry="7"/></svg>',
  triangle: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 4 20 20 4 20"/></svg>',
  line: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="19" x2="19" y2="5"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="19" x2="16" y2="8"/><polygon points="19 5 12.5 7.5 16.5 11.5" fill="currentColor" stroke="none"/></svg>',
};

const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const HISTORY_LIMIT = 40;

const STICKY_COLORS = [
  { id: 'yellow', hex: '#fdf1c8' },
  { id: 'pink', hex: '#fbe3e8' },
  { id: 'blue', hex: '#e3e8fb' },
  { id: 'green', hex: '#dbeee0' },
  { id: 'violet', hex: '#ece7fb' },
  { id: 'gray', hex: '#e9e9ea' },
];
const FILL_PALETTE = [{ id: 'none', hex: null }, ...STICKY_COLORS, { id: 'white', hex: '#ffffff' }];
const COLOR_PALETTE = [
  { id: 'black', hex: '#111111' },
  { id: 'gray', hex: '#6b6b70' },
  { id: 'red', hex: '#c0393f' },
  { id: 'blue', hex: '#3f6dc4' },
  { id: 'green', hex: '#3f8a5c' },
  { id: 'yellow', hex: '#b8930f' },
  { id: 'violet', hex: '#6b5fcf' },
];
const THICKNESS_SCALE = { pen: [2, 4, 7], highlighter: [10, 16, 24] };
const THICKNESS_LABELS = ['Thin', 'Medium', 'Thick'];
const FONT_SIZE_PX = { small: 13, medium: 16, large: 22 };

const DEFAULT_SIZES = {
  sticky: { w: 160, h: 120 },
  text: { w: 180, h: 44 },
  rectangle: { w: 160, h: 100 },
  ellipse: { w: 150, h: 100 },
  triangle: { w: 150, h: 110 },
};
const PLACEMENT_TOOLS = ['sticky', 'text', 'rectangle', 'ellipse', 'triangle', 'line', 'arrow'];
const SHAPE_TOOLS = ['rectangle', 'ellipse', 'triangle', 'line', 'arrow'];

function formatDateTime(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
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

function getVisibleBoards(currentUser) {
  return store.getWhiteboards()
    .filter(b => b.companyId === currentUser.companyId)
    .filter(b => isVisibleToUser(b, currentUser));
}

// =====================================================================
// Список досок
// =====================================================================

export function renderBoardsList(container, { onOpenBoard }) {
  ensureCreateBoardDialog();

  const wrap = document.createElement('div');
  wrap.className = 'ws-list-page';

  const toolbar = document.createElement('div');
  toolbar.className = 'list-toolbar';
  const spacer = document.createElement('div');
  spacer.className = 'toolbar-spacer-flex';
  toolbar.appendChild(spacer);
  const newBtn = document.createElement('button');
  newBtn.type = 'button';
  newBtn.className = 'btn-primary';
  newBtn.innerHTML = '<span class="plus" aria-hidden="true">+</span> New whiteboard';
  newBtn.addEventListener('click', () => openCreateBoardDialog(onOpenBoard));
  toolbar.appendChild(newBtn);
  wrap.appendChild(toolbar);

  const itemsWrap = document.createElement('div');
  itemsWrap.className = 'ws-list-items';
  const currentUser = store.getCurrentUser();
  const boards = currentUser
    ? getVisibleBoards(currentUser).slice().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    : [];

  if (boards.length === 0) {
    itemsWrap.appendChild(buildEmptyHint('Нет досок', 'Создайте первую доску для совместной работы.'));
  } else {
    for (const board of boards) itemsWrap.appendChild(buildBoardListItem(board, currentUser, onOpenBoard));
  }
  wrap.appendChild(itemsWrap);
  container.appendChild(wrap);
}

function buildBoardListItem(board, currentUser, onOpenBoard) {
  const item = document.createElement('button');
  item.type = 'button';
  item.className = 'list-item-card';

  const title = document.createElement('div');
  title.className = 'list-item-title';
  title.textContent = board.title || 'Untitled whiteboard';
  item.appendChild(title);

  const meta = document.createElement('div');
  meta.className = 'list-item-meta';
  const updated = document.createElement('span');
  updated.textContent = formatDateTime(board.updatedAt);
  meta.appendChild(updated);
  const objCount = document.createElement('span');
  const shapeCount = (board.objects || []).filter(o => o.type !== 'connector').length;
  objCount.textContent = shapeCount + (shapeCount === 1 ? ' объект' : ' объектов');
  meta.appendChild(objCount);
  meta.appendChild(buildSharingBadge(board, currentUser));
  item.appendChild(meta);

  item.addEventListener('click', () => onOpenBoard(board.id));
  return item;
}

// ---------- Create board dialog ----------

let createBoardOverlayEl, createBoardInput, createBoardCancelBtn, createBoardCloseBtn, createBoardBuilt = false;

function ensureCreateBoardDialog() {
  if (createBoardBuilt) return;
  createBoardBuilt = true;

  createBoardOverlayEl = document.createElement('div');
  createBoardOverlayEl.className = 'drawer-overlay';
  createBoardOverlayEl.hidden = true;

  const drawer = document.createElement('aside');
  drawer.className = 'drawer create-board-drawer';

  const header = document.createElement('div');
  header.className = 'drawer-header';
  const h2 = document.createElement('h2');
  h2.textContent = 'Новая доска';
  header.appendChild(h2);
  createBoardCloseBtn = document.createElement('button');
  createBoardCloseBtn.type = 'button';
  createBoardCloseBtn.className = 'icon-btn';
  createBoardCloseBtn.setAttribute('aria-label', 'Закрыть');
  createBoardCloseBtn.textContent = '✕';
  header.appendChild(createBoardCloseBtn);
  drawer.appendChild(header);

  const form = document.createElement('form');
  form.className = 'drawer-form';
  const body = document.createElement('div');
  body.className = 'drawer-body';
  const fieldWrap = document.createElement('label');
  fieldWrap.className = 'field';
  const label = document.createElement('span');
  label.className = 'field-label';
  label.textContent = 'Название';
  fieldWrap.appendChild(label);
  createBoardInput = document.createElement('input');
  createBoardInput.type = 'text';
  createBoardInput.maxLength = 120;
  createBoardInput.placeholder = 'Например, Дизайн-спринт Q4';
  fieldWrap.appendChild(createBoardInput);
  body.appendChild(fieldWrap);
  form.appendChild(body);

  const actions = document.createElement('div');
  actions.className = 'drawer-actions';
  actions.appendChild(document.createElement('div'));
  const actionsRight = document.createElement('div');
  actionsRight.className = 'drawer-actions-right';
  createBoardCancelBtn = document.createElement('button');
  createBoardCancelBtn.type = 'button';
  createBoardCancelBtn.className = 'btn-secondary';
  createBoardCancelBtn.textContent = 'Отмена';
  actionsRight.appendChild(createBoardCancelBtn);
  const createBoardSaveBtn = document.createElement('button');
  createBoardSaveBtn.type = 'submit';
  createBoardSaveBtn.className = 'btn-primary';
  createBoardSaveBtn.textContent = 'Создать';
  actionsRight.appendChild(createBoardSaveBtn);
  actions.appendChild(actionsRight);
  form.appendChild(actions);
  drawer.appendChild(form);

  createBoardOverlayEl.appendChild(drawer);
  document.body.appendChild(createBoardOverlayEl);

  const close = () => { createBoardOverlayEl.hidden = true; };
  createBoardCloseBtn.addEventListener('click', close);
  createBoardCancelBtn.addEventListener('click', close);
  createBoardOverlayEl.addEventListener('click', (e) => { if (e.target === createBoardOverlayEl) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !createBoardOverlayEl.hidden) close(); });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = createBoardInput.value.trim() || 'Untitled whiteboard';
    const result = store.createWhiteboard({ title, viewport: { x: 0, y: 0, zoom: 1 }, objects: [] });
    const cb = form._onCreated;
    close();
    if (result.ok && cb) cb(result.board.id);
  });
}

function openCreateBoardDialog(onCreated) {
  createBoardInput.value = '';
  createBoardOverlayEl.querySelector('form')._onCreated = onCreated;
  createBoardOverlayEl.hidden = false;
  createBoardInput.focus();
}

// =====================================================================
// Canvas
// =====================================================================

let canvasState = null;
let elementsById = {};
let boardWorldEl = null, boardSvgEl = null, boardDomEl = null, boardViewportEl = null, zoomLabelEl = null;
let toolButtons = {};
let undoButtonEl = null, redoButtonEl = null;
let contextPanelEl = null;
let selectionFrameEl = null;
let boardSaveTimer = null;
let pendingBoardPatch = {};
let onBackCallback = null;

let undoStack = [];
let redoStack = [];

let shapesMenuEl = null;
let shapesMenuOpen = false;

let penSettings, highlighterSettings, shapeDefaults, textDefaults, stickyDefaultColor;

function resetToolDefaults() {
  penSettings = { color: COLOR_PALETTE[0].hex, thicknessIdx: 1 };
  highlighterSettings = { color: COLOR_PALETTE[5].hex, thicknessIdx: 1 };
  shapeDefaults = { strokeColor: COLOR_PALETTE[1].hex, fillColor: null, strokeWidth: 2 };
  textDefaults = { color: COLOR_PALETTE[0].hex, fontSize: 'medium' };
  stickyDefaultColor = STICKY_COLORS[0].hex;
}

// Существующие Whiteboard-объекты (Этап 6) должны продолжать открываться — заполняем
// недостающие поля безопасными значениями, не трогая то, что уже сохранено.
function normalizeObject(o) {
  const obj = { ...o };
  if (obj.type === 'sticky') {
    obj.color = obj.color || STICKY_COLORS[0].hex;
    obj.text = obj.text || '';
  } else if (obj.type === 'text') {
    obj.color = obj.color || '#111111';
    obj.fontSize = obj.fontSize || 'medium';
    obj.text = obj.text || '';
  } else if (obj.type === 'rectangle' || obj.type === 'ellipse' || obj.type === 'triangle') {
    obj.strokeColor = obj.strokeColor || '#6b6b70';
    obj.fillColor = obj.fillColor !== undefined ? obj.fillColor : '#ffffff';
    obj.strokeWidth = obj.strokeWidth || 1.5;
    obj.text = obj.text || '';
  } else if (obj.type === 'line' || obj.type === 'arrow') {
    obj.strokeColor = obj.strokeColor || '#111111';
    obj.strokeWidth = obj.strokeWidth || 2;
  } else if (obj.type === 'stroke') {
    obj.color = obj.color || '#111111';
    obj.width = obj.width || 3;
    obj.opacity = obj.opacity !== undefined ? obj.opacity : 1;
    obj.points = Array.isArray(obj.points) ? obj.points : [];
    obj.tool = obj.tool || 'pen';
  }
  return obj;
}

export function renderBoardCanvas(container, boardId, { onBack }) {
  const board = store.getWhiteboard(boardId);
  if (!board) { onBack(); return; }
  const currentUser = store.getCurrentUser();
  const isOwner = board.ownerId === currentUser.id;

  onBackCallback = onBack;
  resetToolDefaults();
  undoStack = [];
  redoStack = [];

  canvasState = {
    boardId,
    tool: 'select',
    selectedId: null,
    connectorFromId: null,
    viewport: board.viewport ? { ...board.viewport } : { x: 0, y: 0, zoom: 1 },
    objects: (board.objects || []).map(normalizeObject),
    isOwner,
  };
  pendingBoardPatch = {};
  elementsById = {};
  selectionFrameEl = null;

  const wrap = document.createElement('div');
  wrap.className = 'board-page';

  wrap.appendChild(buildBoardTopBar(board, isOwner));
  wrap.appendChild(buildBoardToolbar());
  contextPanelEl = document.createElement('div');
  contextPanelEl.className = 'board-context-panel';
  contextPanelEl.hidden = true;
  wrap.appendChild(contextPanelEl);

  const viewportEl = document.createElement('div');
  viewportEl.className = 'board-viewport';
  boardViewportEl = viewportEl;

  const worldEl = document.createElement('div');
  worldEl.className = 'board-world';
  boardWorldEl = worldEl;

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'board-svg-layer');
  boardSvgEl = svg;
  worldEl.appendChild(svg);

  const domLayer = document.createElement('div');
  domLayer.className = 'board-dom-layer';
  boardDomEl = domLayer;
  worldEl.appendChild(domLayer);

  viewportEl.appendChild(worldEl);
  wrap.appendChild(viewportEl);

  container.appendChild(wrap);

  renderAllObjects();
  applyViewportTransform();
  wireCanvasEvents(viewportEl);
  updateHistoryButtons();
}

function buildBoardTopBar(board, isOwner) {
  const row = document.createElement('div');
  row.className = 'board-topbar';

  const backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.className = 'btn-secondary btn-small';
  backBtn.textContent = '← К списку';
  backBtn.addEventListener('click', () => {
    flushBoardSave();
    canvasState = null;
    onBackCallback();
  });
  row.appendChild(backBtn);

  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.className = 'board-title-input';
  titleInput.value = board.title || '';
  titleInput.maxLength = 120;
  titleInput.disabled = !isOwner;
  titleInput.addEventListener('input', () => scheduleBoardMetaSave({ title: titleInput.value }));
  row.appendChild(titleInput);

  const spacer = document.createElement('div');
  spacer.className = 'toolbar-spacer-flex';
  row.appendChild(spacer);

  row.appendChild(buildSharingBadge(board, store.getCurrentUser()));

  if (isOwner) {
    const shareBtn = document.createElement('button');
    shareBtn.type = 'button';
    shareBtn.className = 'btn-secondary btn-small';
    shareBtn.textContent = 'Share';
    shareBtn.addEventListener('click', async () => {
      const selected = await openShareDialog(board.sharedWith || []);
      if (!selected) return;
      store.updateWhiteboard(board.id, { sharedWith: selected, visibility: selected.length ? 'shared' : 'private' });
    });
    row.appendChild(shareBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn-danger btn-small';
    deleteBtn.textContent = 'Удалить';
    deleteBtn.addEventListener('click', () => {
      clearTimeout(boardSaveTimer);
      store.deleteWhiteboard(board.id);
      canvasState = null;
      onBackCallback();
    });
    row.appendChild(deleteBtn);
  }

  return row;
}

function buildToolButton(id, label) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'board-tool-btn' + (canvasState.tool === id ? ' active' : '');
  btn.innerHTML = ICONS[id];
  btn.title = label;
  btn.setAttribute('aria-label', label);
  if (!canvasState.isOwner && id !== 'select' && id !== 'hand') btn.disabled = true;
  btn.addEventListener('click', () => setTool(id));
  toolButtons[id] = btn;
  return btn;
}

function buildShapesMenuButton() {
  const wrap = document.createElement('div');
  wrap.className = 'board-tool-menu-wrap';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'board-tool-btn' + (SHAPE_TOOLS.includes(canvasState.tool) ? ' active' : '');
  btn.innerHTML = ICONS.shapes;
  btn.title = 'Shapes';
  btn.setAttribute('aria-label', 'Shapes');
  btn.disabled = !canvasState.isOwner;
  btn.addEventListener('click', (e) => { e.stopPropagation(); shapesMenuOpen ? closeShapesMenu() : openShapesMenu(); });
  toolButtons.shapes = btn;
  wrap.appendChild(btn);

  shapesMenuEl = document.createElement('div');
  shapesMenuEl.className = 'board-shapes-menu';
  shapesMenuEl.hidden = true;
  const shapeTools = [
    { id: 'rectangle', label: 'Rectangle' },
    { id: 'ellipse', label: 'Ellipse' },
    { id: 'triangle', label: 'Triangle' },
    { id: 'line', label: 'Line' },
    { id: 'arrow', label: 'Arrow' },
  ];
  for (const s of shapeTools) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'board-shapes-menu-item';
    item.innerHTML = ICONS[s.id];
    item.title = s.label;
    item.setAttribute('aria-label', s.label);
    item.addEventListener('click', (e) => { e.stopPropagation(); setTool(s.id); closeShapesMenu(); });
    shapesMenuEl.appendChild(item);
  }
  wrap.appendChild(shapesMenuEl);
  return wrap;
}

function openShapesMenu() { shapesMenuEl.hidden = false; shapesMenuOpen = true; }
function closeShapesMenu() { if (shapesMenuEl) shapesMenuEl.hidden = true; shapesMenuOpen = false; }
document.addEventListener('click', () => closeShapesMenu());

function buildBoardToolbar() {
  const toolbar = document.createElement('div');
  toolbar.className = 'board-toolbar';

  toolButtons = {};
  const mainTools = [
    ['select', 'Select'], ['hand', 'Hand'], ['pen', 'Pen'], ['highlighter', 'Highlighter'],
    ['eraser', 'Eraser'], ['text', 'Text'], ['sticky', 'Sticky'],
  ];
  for (const [id, label] of mainTools) toolbar.appendChild(buildToolButton(id, label));
  toolbar.appendChild(buildShapesMenuButton());
  toolbar.appendChild(buildToolButton('connector', 'Connector'));

  const historyGroup = document.createElement('div');
  historyGroup.className = 'board-history-group';
  undoButtonEl = document.createElement('button');
  undoButtonEl.type = 'button';
  undoButtonEl.className = 'icon-btn';
  undoButtonEl.setAttribute('aria-label', 'Undo');
  undoButtonEl.title = 'Undo';
  undoButtonEl.innerHTML = ICONS.undo;
  undoButtonEl.addEventListener('click', undo);
  historyGroup.appendChild(undoButtonEl);
  redoButtonEl = document.createElement('button');
  redoButtonEl.type = 'button';
  redoButtonEl.className = 'icon-btn';
  redoButtonEl.setAttribute('aria-label', 'Redo');
  redoButtonEl.title = 'Redo';
  redoButtonEl.innerHTML = ICONS.redo;
  redoButtonEl.addEventListener('click', redo);
  historyGroup.appendChild(redoButtonEl);
  toolbar.appendChild(historyGroup);

  const zoomGroup = document.createElement('div');
  zoomGroup.className = 'board-zoom-group';
  const zoomOutBtn = document.createElement('button');
  zoomOutBtn.type = 'button';
  zoomOutBtn.className = 'icon-btn';
  zoomOutBtn.setAttribute('aria-label', 'Уменьшить масштаб');
  zoomOutBtn.innerHTML = ICONS.zoomOut;
  zoomOutBtn.addEventListener('click', () => stepZoom(-1));
  zoomGroup.appendChild(zoomOutBtn);
  zoomLabelEl = document.createElement('span');
  zoomLabelEl.className = 'board-zoom-label';
  zoomLabelEl.textContent = Math.round(canvasState.viewport.zoom * 100) + '%';
  zoomGroup.appendChild(zoomLabelEl);
  const zoomInBtn = document.createElement('button');
  zoomInBtn.type = 'button';
  zoomInBtn.className = 'icon-btn';
  zoomInBtn.setAttribute('aria-label', 'Увеличить масштаб');
  zoomInBtn.innerHTML = ICONS.zoomIn;
  zoomInBtn.addEventListener('click', () => stepZoom(1));
  zoomGroup.appendChild(zoomInBtn);
  toolbar.appendChild(zoomGroup);

  return toolbar;
}

function setTool(tool) {
  if (!canvasState) return;
  if (canvasState.connectorFromId && elementsById[canvasState.connectorFromId]) {
    elementsById[canvasState.connectorFromId].el.classList.remove('is-connector-source');
  }
  canvasState.tool = tool;
  canvasState.connectorFromId = null;
  Object.keys(toolButtons).forEach(id => toolButtons[id].classList.toggle('active', id === tool));
  if (toolButtons.shapes) toolButtons.shapes.classList.toggle('active', SHAPE_TOOLS.includes(tool));
  boardViewportEl.classList.toggle('is-hand-mode', tool === 'hand');
  boardViewportEl.classList.toggle('is-placing', PLACEMENT_TOOLS.includes(tool));
  boardViewportEl.classList.toggle('is-connecting', tool === 'connector');
  boardViewportEl.classList.toggle('is-drawing', tool === 'pen' || tool === 'highlighter');
  boardViewportEl.classList.toggle('is-erasing', tool === 'eraser');
  renderContextPanel();
}

function stepZoom(dir) {
  const zoom = canvasState.viewport.zoom;
  let idx = 0;
  for (let i = 0; i < ZOOM_STEPS.length; i++) {
    if (Math.abs(ZOOM_STEPS[i] - zoom) < Math.abs(ZOOM_STEPS[idx] - zoom)) idx = i;
  }
  const newIdx = Math.min(ZOOM_STEPS.length - 1, Math.max(0, idx + dir));
  setZoom(ZOOM_STEPS[newIdx]);
}

function setZoom(newZoom) {
  newZoom = Math.min(2, Math.max(0.25, newZoom));
  const rect = boardViewportEl.getBoundingClientRect();
  const cx = rect.width / 2;
  const cy = rect.height / 2;
  const worldX = (cx - canvasState.viewport.x) / canvasState.viewport.zoom;
  const worldY = (cy - canvasState.viewport.y) / canvasState.viewport.zoom;
  canvasState.viewport.zoom = newZoom;
  canvasState.viewport.x = cx - worldX * newZoom;
  canvasState.viewport.y = cy - worldY * newZoom;
  applyViewportTransform();
  zoomLabelEl.textContent = Math.round(newZoom * 100) + '%';
  scheduleBoardSave();
}

function applyViewportTransform() {
  boardWorldEl.style.transform = `translate(${canvasState.viewport.x}px, ${canvasState.viewport.y}px) scale(${canvasState.viewport.zoom})`;
}

function screenToWorld(clientX, clientY) {
  const rect = boardViewportEl.getBoundingClientRect();
  const sx = clientX - rect.left;
  const sy = clientY - rect.top;
  return {
    x: (sx - canvasState.viewport.x) / canvasState.viewport.zoom,
    y: (sy - canvasState.viewport.y) / canvasState.viewport.zoom,
  };
}

// ---------- Геометрия объектов ----------

function getObjectBounds(obj) {
  if (obj.type === 'line' || obj.type === 'arrow') {
    const x = Math.min(obj.x1, obj.x2), y = Math.min(obj.y1, obj.y2);
    return { x, y, width: Math.abs(obj.x2 - obj.x1) || 1, height: Math.abs(obj.y2 - obj.y1) || 1 };
  }
  if (obj.type === 'stroke') {
    const xs = obj.points.map(p => p.x), ys = obj.points.map(p => p.y);
    const x = Math.min(...xs), y = Math.min(...ys);
    return { x, y, width: Math.max(...xs) - x || 1, height: Math.max(...ys) - y || 1 };
  }
  return { x: obj.x, y: obj.y, width: obj.width, height: obj.height };
}

function trianglePoints(obj) {
  const { x, y, width: w, height: h } = obj;
  return `${x + w / 2},${y} ${x},${y + h} ${x + w},${y + h}`;
}

function applyShapeGeometry(el, obj) {
  if (obj.type === 'rectangle') {
    el.setAttribute('x', obj.x); el.setAttribute('y', obj.y);
    el.setAttribute('width', obj.width); el.setAttribute('height', obj.height);
  } else if (obj.type === 'ellipse') {
    el.setAttribute('cx', obj.x + obj.width / 2); el.setAttribute('cy', obj.y + obj.height / 2);
    el.setAttribute('rx', obj.width / 2); el.setAttribute('ry', obj.height / 2);
  } else if (obj.type === 'triangle') {
    el.setAttribute('points', trianglePoints(obj));
  } else if (obj.type === 'line') {
    el.setAttribute('x1', obj.x1); el.setAttribute('y1', obj.y1);
    el.setAttribute('x2', obj.x2); el.setAttribute('y2', obj.y2);
  }
}

function applyShapeColors(el, obj) {
  el.setAttribute('stroke', obj.strokeColor);
  el.setAttribute('stroke-width', obj.strokeWidth);
  el.setAttribute('fill', obj.fillColor || 'none');
}

function updateArrowGeometry(ref, obj) {
  ref.lineEl.setAttribute('x1', obj.x1); ref.lineEl.setAttribute('y1', obj.y1);
  ref.lineEl.setAttribute('x2', obj.x2); ref.lineEl.setAttribute('y2', obj.y2);
  const angle = Math.atan2(obj.y2 - obj.y1, obj.x2 - obj.x1);
  const headLen = 12, spread = 0.45;
  const tipX = obj.x2, tipY = obj.y2;
  const leftX = tipX - headLen * Math.cos(angle - spread);
  const leftY = tipY - headLen * Math.sin(angle - spread);
  const rightX = tipX - headLen * Math.cos(angle + spread);
  const rightY = tipY - headLen * Math.sin(angle + spread);
  ref.headEl.setAttribute('points', `${tipX},${tipY} ${leftX},${leftY} ${rightX},${rightY}`);
}

function updateElementGeometry(obj) {
  const ref = elementsById[obj.id];
  if (!ref) return;
  if (obj.type === 'sticky' || obj.type === 'text') {
    ref.el.style.left = obj.x + 'px'; ref.el.style.top = obj.y + 'px';
    ref.el.style.width = obj.width + 'px'; ref.el.style.height = obj.height + 'px';
  } else if (obj.type === 'arrow') {
    updateArrowGeometry(ref, obj);
  } else if (obj.type === 'stroke') {
    ref.el.setAttribute('points', obj.points.map(p => p.x + ',' + p.y).join(' '));
  } else {
    applyShapeGeometry(ref.el, obj);
  }
}

function updateElementColor(obj) {
  const ref = elementsById[obj.id];
  if (!ref) return;
  if (obj.type === 'sticky') ref.el.style.background = obj.color;
  else if (obj.type === 'text') ref.textEl.style.color = obj.color;
  else if (obj.type === 'rectangle' || obj.type === 'ellipse' || obj.type === 'triangle') applyShapeColors(ref.el, obj);
  else if (obj.type === 'line') { ref.el.setAttribute('stroke', obj.strokeColor); ref.el.setAttribute('stroke-width', obj.strokeWidth); }
  else if (obj.type === 'arrow') {
    ref.lineEl.setAttribute('stroke', obj.strokeColor); ref.lineEl.setAttribute('stroke-width', obj.strokeWidth);
    ref.headEl.setAttribute('fill', obj.strokeColor);
  }
}

// ---------- Построение DOM/SVG-элементов ----------

function buildDomObjectEl(obj) {
  const el = document.createElement('div');
  el.className = 'board-object board-object-' + obj.type;
  el.dataset.id = obj.id;
  el.style.left = obj.x + 'px';
  el.style.top = obj.y + 'px';
  el.style.width = obj.width + 'px';
  el.style.height = obj.height + 'px';
  if (obj.type === 'sticky') el.style.background = obj.color;

  const textEl = document.createElement('div');
  textEl.className = 'board-object-text';
  textEl.textContent = obj.text || '';
  textEl.contentEditable = 'false';
  if (obj.type === 'text') {
    textEl.style.color = obj.color;
    textEl.style.fontSize = FONT_SIZE_PX[obj.fontSize || 'medium'] + 'px';
  }
  el.appendChild(textEl);

  elementsById[obj.id] = { kind: 'dom', el, textEl };
  return el;
}

function buildSvgShapeEl(obj) {
  if (obj.type === 'rectangle' || obj.type === 'ellipse' || obj.type === 'triangle') {
    const tag = obj.type === 'rectangle' ? 'rect' : obj.type === 'ellipse' ? 'ellipse' : 'polygon';
    const el = document.createElementNS(SVG_NS, tag);
    el.setAttribute('class', 'board-shape');
    el.dataset.id = obj.id;
    if (obj.type === 'rectangle') el.setAttribute('rx', 8);
    applyShapeGeometry(el, obj);
    applyShapeColors(el, obj);
    elementsById[obj.id] = { kind: 'svg', el };
    return el;
  }
  if (obj.type === 'line') {
    const el = document.createElementNS(SVG_NS, 'line');
    el.setAttribute('class', 'board-shape');
    el.dataset.id = obj.id;
    applyShapeGeometry(el, obj);
    el.setAttribute('stroke', obj.strokeColor);
    el.setAttribute('stroke-width', obj.strokeWidth);
    el.setAttribute('stroke-linecap', 'round');
    elementsById[obj.id] = { kind: 'svg', el };
    return el;
  }
  if (obj.type === 'arrow') {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'board-shape');
    g.dataset.id = obj.id;
    const lineEl = document.createElementNS(SVG_NS, 'line');
    lineEl.setAttribute('stroke-linecap', 'round');
    const headEl = document.createElementNS(SVG_NS, 'polygon');
    g.appendChild(lineEl);
    g.appendChild(headEl);
    elementsById[obj.id] = { kind: 'svg', el: g, lineEl, headEl };
    updateArrowGeometry(elementsById[obj.id], obj);
    lineEl.setAttribute('stroke', obj.strokeColor);
    lineEl.setAttribute('stroke-width', obj.strokeWidth);
    headEl.setAttribute('fill', obj.strokeColor);
    return g;
  }
  if (obj.type === 'stroke') {
    const el = document.createElementNS(SVG_NS, 'polyline');
    el.setAttribute('class', 'board-shape board-stroke');
    el.dataset.id = obj.id;
    el.setAttribute('points', obj.points.map(p => p.x + ',' + p.y).join(' '));
    el.setAttribute('stroke', obj.color);
    el.setAttribute('stroke-width', obj.width);
    el.setAttribute('stroke-opacity', obj.opacity);
    el.setAttribute('fill', 'none');
    el.setAttribute('stroke-linecap', 'round');
    el.setAttribute('stroke-linejoin', 'round');
    elementsById[obj.id] = { kind: 'svg', el };
    return el;
  }
  return null;
}

function getObjectCenter(id) {
  const obj = canvasState.objects.find(o => o.id === id);
  if (!obj) return null;
  const b = getObjectBounds(obj);
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

function createConnectorLine(connectorObj) {
  const from = getObjectCenter(connectorObj.fromObjectId);
  const to = getObjectCenter(connectorObj.toObjectId);
  if (!from || !to) return null;
  const line = document.createElementNS(SVG_NS, 'line');
  line.dataset.id = connectorObj.id;
  line.setAttribute('x1', from.x); line.setAttribute('y1', from.y);
  line.setAttribute('x2', to.x); line.setAttribute('y2', to.y);
  line.setAttribute('class', 'board-connector-line');
  elementsById[connectorObj.id] = { kind: 'svg', el: line };
  return line;
}

function updateConnectorsFor(objectId) {
  for (const obj of canvasState.objects) {
    if (obj.type !== 'connector') continue;
    if (obj.fromObjectId === objectId || obj.toObjectId === objectId) {
      const from = getObjectCenter(obj.fromObjectId);
      const to = getObjectCenter(obj.toObjectId);
      const ref = elementsById[obj.id];
      if (ref && from && to) {
        ref.el.setAttribute('x1', from.x); ref.el.setAttribute('y1', from.y);
        ref.el.setAttribute('x2', to.x); ref.el.setAttribute('y2', to.y);
      }
    }
  }
}

function appendObjectElement(obj) {
  if (obj.type === 'sticky' || obj.type === 'text') {
    boardDomEl.appendChild(buildDomObjectEl(obj));
  } else if (obj.type === 'connector') {
    const el = createConnectorLine(obj);
    if (el) boardSvgEl.appendChild(el);
  } else {
    const el = buildSvgShapeEl(obj);
    if (el) boardSvgEl.appendChild(el);
  }
}

function renderAllObjects() {
  boardSvgEl.innerHTML = '';
  boardDomEl.innerHTML = '';
  elementsById = {};
  for (const obj of canvasState.objects) appendObjectElement(obj);
  refreshSelectionVisual();
}

// ---------- Выделение ----------

function applySelectedClass(id, isSelected) {
  const ref = elementsById[id];
  if (ref) ref.el.classList.toggle('is-selected', isSelected);
}

function clearSelectionFrame() {
  if (selectionFrameEl) { selectionFrameEl.remove(); selectionFrameEl = null; }
}

function buildBoxSelectionFrame(obj) {
  const frame = document.createElement('div');
  frame.className = 'board-selection-frame';
  const b = getObjectBounds(obj);
  frame.style.left = b.x + 'px'; frame.style.top = b.y + 'px';
  frame.style.width = b.width + 'px'; frame.style.height = b.height + 'px';
  if (canvasState.isOwner && obj.type !== 'stroke') {
    const handle = document.createElement('div');
    handle.className = 'board-resize-handle';
    handle.dataset.role = 'resize';
    frame.appendChild(handle);
  }
  return frame;
}

function buildLineSelectionHandles(obj) {
  const wrap = document.createElement('div');
  wrap.className = 'board-line-selection';
  const start = document.createElement('div');
  start.className = 'board-line-handle';
  start.style.left = obj.x1 + 'px'; start.style.top = obj.y1 + 'px';
  start.dataset.endpoint = 'start';
  const end = document.createElement('div');
  end.className = 'board-line-handle';
  end.style.left = obj.x2 + 'px'; end.style.top = obj.y2 + 'px';
  end.dataset.endpoint = 'end';
  if (!canvasState.isOwner) { start.classList.add('is-readonly'); end.classList.add('is-readonly'); }
  wrap.appendChild(start); wrap.appendChild(end);
  return wrap;
}

function showSelectionFrameFor(obj) {
  if (obj.type === 'connector') return;
  selectionFrameEl = (obj.type === 'line' || obj.type === 'arrow') ? buildLineSelectionHandles(obj) : buildBoxSelectionFrame(obj);
  boardDomEl.appendChild(selectionFrameEl);
}

function updateSelectionFrameLive(obj) {
  if (!selectionFrameEl) return;
  if (obj.type === 'line' || obj.type === 'arrow') {
    const start = selectionFrameEl.querySelector('[data-endpoint="start"]');
    const end = selectionFrameEl.querySelector('[data-endpoint="end"]');
    if (start) { start.style.left = obj.x1 + 'px'; start.style.top = obj.y1 + 'px'; }
    if (end) { end.style.left = obj.x2 + 'px'; end.style.top = obj.y2 + 'px'; }
  } else {
    const b = getObjectBounds(obj);
    selectionFrameEl.style.left = b.x + 'px'; selectionFrameEl.style.top = b.y + 'px';
    selectionFrameEl.style.width = b.width + 'px'; selectionFrameEl.style.height = b.height + 'px';
  }
}

function refreshSelectionVisual() {
  clearSelectionFrame();
  if (!canvasState.selectedId) return;
  const obj = canvasState.objects.find(o => o.id === canvasState.selectedId);
  if (!obj) { canvasState.selectedId = null; return; }
  applySelectedClass(obj.id, true);
  showSelectionFrameFor(obj);
}

function selectObject(id) {
  if (canvasState.selectedId) applySelectedClass(canvasState.selectedId, false);
  clearSelectionFrame();
  canvasState.selectedId = id;
  if (id) {
    applySelectedClass(id, true);
    const obj = canvasState.objects.find(o => o.id === id);
    if (obj) showSelectionFrameFor(obj);
  }
  renderContextPanel();
}

function deleteSelectedObject() {
  if (!canvasState || !canvasState.selectedId || !canvasState.isOwner) return;
  pushUndoSnapshot();
  const id = canvasState.selectedId;
  canvasState.objects = canvasState.objects.filter(o =>
    o.id !== id && !(o.type === 'connector' && (o.fromObjectId === id || o.toObjectId === id))
  );
  canvasState.selectedId = null;
  renderAllObjects();
  scheduleBoardSave();
  renderContextPanel();
}

function startEditingObjectText(id) {
  const ref = elementsById[id];
  const obj = canvasState.objects.find(o => o.id === id);
  if (!ref || !obj || !ref.textEl) return;
  pushUndoSnapshot();
  ref.textEl.contentEditable = 'true';
  ref.textEl.focus();
  const range = document.createRange();
  range.selectNodeContents(ref.textEl);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  const commit = () => {
    ref.textEl.contentEditable = 'false';
    obj.text = ref.textEl.textContent;
    scheduleBoardSave();
    ref.textEl.removeEventListener('blur', commit);
  };
  ref.textEl.addEventListener('blur', commit);
}

// ---------- Context panel (настройки инструмента / выделенного объекта) ----------

function labelSpan(text) {
  const s = document.createElement('span');
  s.className = 'context-panel-label';
  s.textContent = text;
  return s;
}

function buildColorSwatchRow(palette, currentHex, onPick) {
  const row = document.createElement('div');
  row.className = 'color-swatch-row';
  for (const c of palette) {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'color-swatch' + (c.hex === currentHex ? ' active' : '') + (c.hex === null ? ' is-none' : '');
    swatch.style.background = c.hex || 'transparent';
    swatch.title = c.id;
    swatch.setAttribute('aria-label', c.id);
    swatch.addEventListener('click', () => onPick(c.hex));
    row.appendChild(swatch);
  }
  return row;
}

function buildThicknessRow(currentIdx, onPick) {
  const row = document.createElement('div');
  row.className = 'context-thickness-row';
  THICKNESS_LABELS.forEach((label, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'context-thickness-btn' + (currentIdx === i ? ' active' : '');
    btn.textContent = label;
    btn.addEventListener('click', () => onPick(i));
    row.appendChild(btn);
  });
  return row;
}

function renderContextPanel() {
  if (!contextPanelEl) return;
  contextPanelEl.innerHTML = '';
  contextPanelEl.hidden = true;
  if (!canvasState || !canvasState.isOwner) return;

  const tool = canvasState.tool;
  if (tool === 'pen' || tool === 'highlighter') {
    const settings = tool === 'pen' ? penSettings : highlighterSettings;
    contextPanelEl.appendChild(buildColorSwatchRow(COLOR_PALETTE, settings.color, (hex) => { settings.color = hex; renderContextPanel(); }));
    contextPanelEl.appendChild(buildThicknessRow(settings.thicknessIdx, (i) => { settings.thicknessIdx = i; renderContextPanel(); }));
    contextPanelEl.hidden = false;
  } else if (tool === 'text') {
    contextPanelEl.appendChild(buildColorSwatchRow(COLOR_PALETTE, textDefaults.color, (hex) => { textDefaults.color = hex; renderContextPanel(); }));
    contextPanelEl.appendChild(buildFontSizeRowForDefaults());
    contextPanelEl.hidden = false;
  } else if (tool === 'sticky') {
    contextPanelEl.appendChild(buildColorSwatchRow(STICKY_COLORS, stickyDefaultColor, (hex) => { stickyDefaultColor = hex; renderContextPanel(); }));
    contextPanelEl.hidden = false;
  } else if (SHAPE_TOOLS.includes(tool)) {
    contextPanelEl.appendChild(labelSpan('Обводка'));
    contextPanelEl.appendChild(buildColorSwatchRow(COLOR_PALETTE, shapeDefaults.strokeColor, (hex) => { shapeDefaults.strokeColor = hex; renderContextPanel(); }));
    if (tool !== 'line' && tool !== 'arrow') {
      contextPanelEl.appendChild(labelSpan('Заливка'));
      contextPanelEl.appendChild(buildColorSwatchRow(FILL_PALETTE, shapeDefaults.fillColor, (hex) => { shapeDefaults.fillColor = hex; renderContextPanel(); }));
    }
    contextPanelEl.hidden = false;
  } else if (tool === 'select' && canvasState.selectedId) {
    const obj = canvasState.objects.find(o => o.id === canvasState.selectedId);
    if (obj) {
      const panel = buildSelectionContextPanel(obj);
      if (panel) { contextPanelEl.appendChild(panel); contextPanelEl.hidden = false; }
    }
  }
}

function buildFontSizeRowForDefaults() {
  const row = document.createElement('div');
  row.className = 'context-thickness-row';
  [['small', 'S'], ['medium', 'M'], ['large', 'L']].forEach(([size, label]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'context-thickness-btn' + (textDefaults.fontSize === size ? ' active' : '');
    btn.textContent = label;
    btn.addEventListener('click', () => { textDefaults.fontSize = size; renderContextPanel(); });
    row.appendChild(btn);
  });
  return row;
}

function buildSelectionContextPanel(obj) {
  const panel = document.createElement('div');
  panel.className = 'context-panel-row';

  if (obj.type === 'sticky') {
    panel.appendChild(buildColorSwatchRow(STICKY_COLORS, obj.color, (hex) => {
      pushUndoSnapshot(); obj.color = hex; updateElementColor(obj); scheduleBoardSave(); renderContextPanel();
    }));
  } else if (obj.type === 'text') {
    panel.appendChild(buildColorSwatchRow(COLOR_PALETTE, obj.color, (hex) => {
      pushUndoSnapshot(); obj.color = hex; updateElementColor(obj); scheduleBoardSave(); renderContextPanel();
    }));
    const sizeRow = document.createElement('div');
    sizeRow.className = 'context-thickness-row';
    [['small', 'S'], ['medium', 'M'], ['large', 'L']].forEach(([size, label]) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'context-thickness-btn' + (obj.fontSize === size ? ' active' : '');
      btn.textContent = label;
      btn.addEventListener('click', () => {
        pushUndoSnapshot();
        obj.fontSize = size;
        const ref = elementsById[obj.id];
        if (ref) ref.textEl.style.fontSize = FONT_SIZE_PX[size] + 'px';
        scheduleBoardSave();
        renderContextPanel();
      });
      sizeRow.appendChild(btn);
    });
    panel.appendChild(sizeRow);
  } else if (obj.type === 'rectangle' || obj.type === 'ellipse' || obj.type === 'triangle') {
    panel.appendChild(labelSpan('Обводка'));
    panel.appendChild(buildColorSwatchRow(COLOR_PALETTE, obj.strokeColor, (hex) => {
      pushUndoSnapshot(); obj.strokeColor = hex; updateElementColor(obj); scheduleBoardSave(); renderContextPanel();
    }));
    panel.appendChild(labelSpan('Заливка'));
    panel.appendChild(buildColorSwatchRow(FILL_PALETTE, obj.fillColor, (hex) => {
      pushUndoSnapshot(); obj.fillColor = hex; updateElementColor(obj); scheduleBoardSave(); renderContextPanel();
    }));
  } else if (obj.type === 'line' || obj.type === 'arrow') {
    panel.appendChild(buildColorSwatchRow(COLOR_PALETTE, obj.strokeColor, (hex) => {
      pushUndoSnapshot(); obj.strokeColor = hex; updateElementColor(obj); scheduleBoardSave(); renderContextPanel();
    }));
  }

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'btn-danger btn-small context-delete-btn';
  deleteBtn.textContent = 'Удалить';
  deleteBtn.addEventListener('click', deleteSelectedObject);
  panel.appendChild(deleteBtn);

  return panel;
}

// ---------- Создание объектов ----------

function createObjectAtPoint(tool, clientX, clientY) {
  const world = screenToWorld(clientX, clientY);
  let obj;
  if (tool === 'sticky') {
    const size = DEFAULT_SIZES.sticky;
    obj = { id: store.generateId('wbobj'), type: 'sticky', x: world.x - size.w / 2, y: world.y - size.h / 2, width: size.w, height: size.h, text: '', color: stickyDefaultColor };
  } else if (tool === 'text') {
    const size = DEFAULT_SIZES.text;
    obj = { id: store.generateId('wbobj'), type: 'text', x: world.x - size.w / 2, y: world.y - size.h / 2, width: size.w, height: size.h, text: '', color: textDefaults.color, fontSize: textDefaults.fontSize };
  } else if (tool === 'rectangle' || tool === 'ellipse' || tool === 'triangle') {
    const size = DEFAULT_SIZES[tool];
    obj = { id: store.generateId('wbobj'), type: tool, x: world.x - size.w / 2, y: world.y - size.h / 2, width: size.w, height: size.h, text: '', strokeColor: shapeDefaults.strokeColor, fillColor: shapeDefaults.fillColor, strokeWidth: shapeDefaults.strokeWidth };
  } else if (tool === 'line' || tool === 'arrow') {
    const half = 70;
    obj = { id: store.generateId('wbobj'), type: tool, x1: world.x - half, y1: world.y, x2: world.x + half, y2: world.y, strokeColor: shapeDefaults.strokeColor, strokeWidth: shapeDefaults.strokeWidth };
  } else {
    return null;
  }
  canvasState.objects.push(obj);
  appendObjectElement(obj);
  return obj;
}

// ---------- Ластик ----------

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function distToSegment(p, a, b) {
  const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  if (l2 === 0) return dist(p, a);
  let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return dist(p, { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
}

function pointNearPolyline(pt, points, threshold) {
  if (points.length === 1) return dist(pt, points[0]) <= threshold;
  for (let i = 0; i < points.length - 1; i++) {
    if (distToSegment(pt, points[i], points[i + 1]) <= threshold) return true;
  }
  return false;
}

function eraseAtPoint(clientX, clientY) {
  const world = screenToWorld(clientX, clientY);
  const toDelete = [];
  for (const obj of canvasState.objects) {
    if (obj.type !== 'stroke') continue;
    if (pointNearPolyline(world, obj.points, 8 + obj.width / 2)) toDelete.push(obj.id);
  }
  if (toDelete.length === 0) return;
  canvasState.objects = canvasState.objects.filter(o => !toDelete.includes(o.id));
  renderAllObjects();
  scheduleBoardSave();
}

// ---------- Undo / Redo ----------

function cloneObjects(list) {
  return list.map(o => {
    const copy = { ...o };
    if (o.points) copy.points = o.points.map(p => ({ ...p }));
    return copy;
  });
}

function pushUndoSnapshot() {
  if (!canvasState) return;
  undoStack.push(cloneObjects(canvasState.objects));
  if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
  redoStack = [];
  updateHistoryButtons();
}

function undo() {
  if (!canvasState || undoStack.length === 0 || !canvasState.isOwner) return;
  redoStack.push(cloneObjects(canvasState.objects));
  canvasState.objects = undoStack.pop();
  canvasState.selectedId = null;
  renderAllObjects();
  scheduleBoardSave();
  updateHistoryButtons();
  renderContextPanel();
}

function redo() {
  if (!canvasState || redoStack.length === 0 || !canvasState.isOwner) return;
  undoStack.push(cloneObjects(canvasState.objects));
  canvasState.objects = redoStack.pop();
  canvasState.selectedId = null;
  renderAllObjects();
  scheduleBoardSave();
  updateHistoryButtons();
  renderContextPanel();
}

function updateHistoryButtons() {
  if (undoButtonEl) undoButtonEl.disabled = !canvasState || !canvasState.isOwner || undoStack.length === 0;
  if (redoButtonEl) redoButtonEl.disabled = !canvasState || !canvasState.isOwner || redoStack.length === 0;
}

// ---------- Persistence ----------

function scheduleBoardMetaSave(patch) {
  Object.assign(pendingBoardPatch, patch);
  scheduleBoardSave();
}

function scheduleBoardSave() {
  clearTimeout(boardSaveTimer);
  boardSaveTimer = setTimeout(flushBoardSave, 500);
}

function flushBoardSave() {
  clearTimeout(boardSaveTimer);
  if (!canvasState) return;
  const patch = {
    viewport: { ...canvasState.viewport },
    objects: cloneObjects(canvasState.objects),
    ...pendingBoardPatch,
  };
  store.updateWhiteboard(canvasState.boardId, patch);
  pendingBoardPatch = {};
}

// ---------- Pointer events ----------

function captureGeometrySnapshot(obj) {
  if (obj.type === 'line' || obj.type === 'arrow') return { x1: obj.x1, y1: obj.y1, x2: obj.x2, y2: obj.y2 };
  if (obj.type === 'stroke') return { points: obj.points.map(p => ({ ...p })) };
  return { x: obj.x, y: obj.y, width: obj.width, height: obj.height };
}

function wireCanvasEvents(viewportEl) {
  let dragMode = null;
  let dragObjectId = null;
  let dragStart = null;
  let objectStart = null;
  let viewportStart = null;

  viewportEl.addEventListener('pointerdown', (e) => {
    if (!canvasState) return;

    if (canvasState.tool === 'hand') {
      dragMode = 'pan';
      dragStart = { x: e.clientX, y: e.clientY };
      viewportStart = { ...canvasState.viewport };
      viewportEl.setPointerCapture(e.pointerId);
      return;
    }

    if ((canvasState.tool === 'pen' || canvasState.tool === 'highlighter') && canvasState.isOwner) {
      pushUndoSnapshot();
      const world = screenToWorld(e.clientX, e.clientY);
      const settings = canvasState.tool === 'pen' ? penSettings : highlighterSettings;
      const stroke = {
        id: store.generateId('wbobj'), type: 'stroke', tool: canvasState.tool,
        color: settings.color, width: THICKNESS_SCALE[canvasState.tool][settings.thicknessIdx],
        opacity: canvasState.tool === 'pen' ? 1 : 0.3,
        points: [world],
      };
      canvasState.objects.push(stroke);
      appendObjectElement(stroke);
      dragMode = 'draw-stroke';
      dragObjectId = stroke.id;
      viewportEl.setPointerCapture(e.pointerId);
      return;
    }

    if (canvasState.tool === 'eraser' && canvasState.isOwner) {
      pushUndoSnapshot();
      eraseAtPoint(e.clientX, e.clientY);
      dragMode = 'erase';
      viewportEl.setPointerCapture(e.pointerId);
      return;
    }

    if (PLACEMENT_TOOLS.includes(canvasState.tool)) {
      if (!canvasState.isOwner) return;
      pushUndoSnapshot();
      const obj = createObjectAtPoint(canvasState.tool, e.clientX, e.clientY);
      if (obj) selectObject(obj.id);
      setTool('select');
      scheduleBoardSave();
      return;
    }

    const targetEl = e.target.closest('[data-id]');

    if (canvasState.tool === 'connector') {
      if (!canvasState.isOwner) return;
      if (targetEl) {
        const id = targetEl.dataset.id;
        if (!canvasState.connectorFromId) {
          canvasState.connectorFromId = id;
          targetEl.classList.add('is-connector-source');
        } else if (canvasState.connectorFromId !== id) {
          pushUndoSnapshot();
          const connObj = { id: store.generateId('wbobj'), type: 'connector', fromObjectId: canvasState.connectorFromId, toObjectId: id };
          canvasState.objects.push(connObj);
          const prevEl = elementsById[canvasState.connectorFromId];
          if (prevEl) prevEl.el.classList.remove('is-connector-source');
          canvasState.connectorFromId = null;
          const line = createConnectorLine(connObj);
          if (line) boardSvgEl.appendChild(line);
          scheduleBoardSave();
          setTool('select');
        }
      }
      return;
    }

    // select mode
    const isBoxHandle = e.target.dataset && e.target.dataset.role === 'resize';
    const lineEndpoint = e.target.dataset ? e.target.dataset.endpoint : null;

    if (isBoxHandle && canvasState.selectedId && canvasState.isOwner) {
      pushUndoSnapshot();
      dragMode = 'resize-box';
      dragObjectId = canvasState.selectedId;
      const obj = canvasState.objects.find(o => o.id === dragObjectId);
      objectStart = captureGeometrySnapshot(obj);
      dragStart = { x: e.clientX, y: e.clientY };
      viewportEl.setPointerCapture(e.pointerId);
      return;
    }

    if (lineEndpoint && canvasState.selectedId && canvasState.isOwner) {
      pushUndoSnapshot();
      dragMode = lineEndpoint === 'start' ? 'resize-line-start' : 'resize-line-end';
      dragObjectId = canvasState.selectedId;
      viewportEl.setPointerCapture(e.pointerId);
      return;
    }

    if (targetEl) {
      const id = targetEl.dataset.id;
      selectObject(id);
      const obj = canvasState.objects.find(o => o.id === id);
      if (canvasState.isOwner && obj && obj.type !== 'connector') {
        pushUndoSnapshot();
        dragMode = 'move';
        dragObjectId = id;
        objectStart = captureGeometrySnapshot(obj);
        dragStart = { x: e.clientX, y: e.clientY };
        viewportEl.setPointerCapture(e.pointerId);
      }
      return;
    }

    selectObject(null);
  });

  viewportEl.addEventListener('pointermove', (e) => {
    if (!dragMode || !canvasState) return;

    if (dragMode === 'draw-stroke') {
      const obj = canvasState.objects.find(o => o.id === dragObjectId);
      if (!obj) return;
      obj.points.push(screenToWorld(e.clientX, e.clientY));
      const ref = elementsById[dragObjectId];
      if (ref) ref.el.setAttribute('points', obj.points.map(p => p.x + ',' + p.y).join(' '));
      return;
    }

    if (dragMode === 'erase') {
      eraseAtPoint(e.clientX, e.clientY);
      return;
    }

    if (dragMode === 'resize-line-start' || dragMode === 'resize-line-end') {
      const obj = canvasState.objects.find(o => o.id === dragObjectId);
      if (!obj) return;
      const world = screenToWorld(e.clientX, e.clientY);
      if (dragMode === 'resize-line-start') { obj.x1 = world.x; obj.y1 = world.y; }
      else { obj.x2 = world.x; obj.y2 = world.y; }
      updateElementGeometry(obj);
      updateSelectionFrameLive(obj);
      return;
    }

    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    const zoom = canvasState.viewport.zoom;

    if (dragMode === 'pan') {
      canvasState.viewport.x = viewportStart.x + dx;
      canvasState.viewport.y = viewportStart.y + dy;
      applyViewportTransform();
      return;
    }

    if (dragMode === 'move') {
      const obj = canvasState.objects.find(o => o.id === dragObjectId);
      if (!obj) return;
      if (obj.type === 'line' || obj.type === 'arrow') {
        obj.x1 = objectStart.x1 + dx / zoom; obj.y1 = objectStart.y1 + dy / zoom;
        obj.x2 = objectStart.x2 + dx / zoom; obj.y2 = objectStart.y2 + dy / zoom;
      } else if (obj.type === 'stroke') {
        obj.points = objectStart.points.map(p => ({ x: p.x + dx / zoom, y: p.y + dy / zoom }));
      } else {
        obj.x = objectStart.x + dx / zoom; obj.y = objectStart.y + dy / zoom;
      }
      updateElementGeometry(obj);
      updateConnectorsFor(dragObjectId);
      updateSelectionFrameLive(obj);
      return;
    }

    if (dragMode === 'resize-box') {
      const obj = canvasState.objects.find(o => o.id === dragObjectId);
      if (!obj) return;
      obj.width = Math.max(40, objectStart.width + dx / zoom);
      obj.height = Math.max(30, objectStart.height + dy / zoom);
      updateElementGeometry(obj);
      updateConnectorsFor(dragObjectId);
      updateSelectionFrameLive(obj);
      return;
    }
  });

  const endDrag = () => {
    if (dragMode) scheduleBoardSave();
    dragMode = null;
    dragObjectId = null;
    dragStart = null;
    objectStart = null;
    viewportStart = null;
  };
  viewportEl.addEventListener('pointerup', endDrag);
  viewportEl.addEventListener('pointercancel', endDrag);

  viewportEl.addEventListener('dblclick', (e) => {
    if (!canvasState || !canvasState.isOwner || canvasState.tool !== 'select') return;
    const targetEl = e.target.closest('.board-object');
    if (targetEl) startEditingObjectText(targetEl.dataset.id);
  });
}

// Единственный keydown-обработчик для канваса — навешивается один раз на модуль,
// а не при каждом открытии доски (иначе слушатели накапливались бы).
document.addEventListener('keydown', (e) => {
  if (!canvasState) return;
  const active = document.activeElement;
  const isEditingText = active && (active.isContentEditable || active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT');

  if ((e.key === 'Delete' || e.key === 'Backspace') && canvasState.selectedId && !isEditingText) {
    deleteSelectedObject();
    return;
  }
  if (isEditingText) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
  else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) { e.preventDefault(); redo(); }
});
