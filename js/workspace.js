// Доска и заметки (#/workspace): тонкий оркестратор табов Notes / Whiteboards.
// Вся функциональность живёт в notes.js и whiteboard.js — здесь только
// навигация/view-state между списком и редактором/канвасом внутри каждого таба.

import * as notes from './notes.js';
import * as whiteboard from './whiteboard.js';

let containerEl = null;
let bodyEl = null;
let currentTab = 'notes'; // 'notes' | 'whiteboards'

let notesView = 'list'; // 'list' | 'editor'
let activeNoteId = null;
let boardsView = 'list'; // 'list' | 'canvas'
let activeBoardId = null;

export function renderWorkspacePage(container) {
  containerEl = container;
  rebuildPage();
}

function rebuildPage() {
  containerEl.className = 'main-content workspace-page';
  containerEl.innerHTML = '';
  containerEl.appendChild(buildHeader());
  bodyEl = document.createElement('div');
  bodyEl.className = 'workspace-body';
  containerEl.appendChild(bodyEl);
  renderBody();
}

function buildHeader() {
  const header = document.createElement('div');
  header.className = 'workspace-header';

  const left = document.createElement('div');
  const title = document.createElement('h2');
  title.className = 'workspace-header-title';
  title.textContent = 'Доска и заметки';
  left.appendChild(title);
  const subtitle = document.createElement('p');
  subtitle.className = 'workspace-header-subtitle';
  subtitle.textContent = 'Личные и общие заметки, доски для совместной работы.';
  left.appendChild(subtitle);
  header.appendChild(left);

  const tabs = document.createElement('div');
  tabs.className = 'workspace-tabs';
  tabs.setAttribute('role', 'tablist');
  const notesTab = document.createElement('button');
  notesTab.type = 'button';
  notesTab.className = 'workspace-tab' + (currentTab === 'notes' ? ' active' : '');
  notesTab.textContent = 'Notes';
  notesTab.addEventListener('click', () => { currentTab = 'notes'; rebuildPage(); });
  tabs.appendChild(notesTab);
  const boardsTab = document.createElement('button');
  boardsTab.type = 'button';
  boardsTab.className = 'workspace-tab' + (currentTab === 'whiteboards' ? ' active' : '');
  boardsTab.textContent = 'Whiteboards';
  boardsTab.addEventListener('click', () => { currentTab = 'whiteboards'; rebuildPage(); });
  tabs.appendChild(boardsTab);
  header.appendChild(tabs);

  return header;
}

function renderBody() {
  bodyEl.innerHTML = '';
  if (currentTab === 'notes') {
    if (notesView === 'editor' && activeNoteId) {
      notes.renderNoteEditor(bodyEl, activeNoteId, {
        onBack: () => { notesView = 'list'; activeNoteId = null; renderBody(); },
      });
    } else {
      notes.renderNotesList(bodyEl, {
        onOpenNote: (id) => { notesView = 'editor'; activeNoteId = id; renderBody(); },
      });
    }
  } else {
    if (boardsView === 'canvas' && activeBoardId) {
      whiteboard.renderBoardCanvas(bodyEl, activeBoardId, {
        onBack: () => { boardsView = 'list'; activeBoardId = null; renderBody(); },
      });
    } else {
      whiteboard.renderBoardsList(bodyEl, {
        onOpenBoard: (id) => { boardsView = 'canvas'; activeBoardId = id; renderBody(); },
      });
    }
  }
}
