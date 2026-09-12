// Точка входа приложения: инициализация Store, склейка Login / App Shell / Router / Kanban.

import * as store from './store.js';
import * as auth from './auth.js';
import * as router from './router.js';
import * as kanban from './kanban.js';
import * as dashboard from './dashboard.js';
import * as calendar from './calendar.js';
import * as workspace from './workspace.js';
import * as company from './company.js';
import * as notifications from './notifications.js';

const ROLE_LABELS = { owner: 'Owner', manager: 'Manager', employee: 'Employee' };

const loginScreen = document.getElementById('loginScreen');
const loginForm = document.getElementById('loginForm');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const quickLoginBtns = document.querySelectorAll('[data-quick-role]');

const appShell = document.getElementById('appShell');
const pageTitle = document.getElementById('pageTitle');
const mainContent = document.getElementById('mainContent');
const navLinks = document.querySelectorAll('.nav-link');

const appSidebar = document.getElementById('appSidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
const sidebarNewTaskBtn = document.getElementById('sidebarNewTaskBtn');
const sidebarUserAvatar = document.getElementById('sidebarUserAvatar');
const sidebarUserName = document.getElementById('sidebarUserName');
const sidebarUserRole = document.getElementById('sidebarUserRole');
const topbarUserAvatar = document.getElementById('topbarUserAvatar');
const logoutBtn = document.getElementById('logoutBtn');

let pendingCreateTask = false;

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

function updateUserChrome() {
  const user = store.getCurrentUser();
  if (!user) return;
  const label = initials(user.name);
  const roleLabel = ROLE_LABELS[user.role] || user.role;
  sidebarUserAvatar.textContent = label;
  sidebarUserName.textContent = user.name;
  sidebarUserRole.textContent = roleLabel;
  topbarUserAvatar.textContent = label;
  topbarUserAvatar.title = user.name + ' · ' + roleLabel;
  // Текущий пользователь мог смениться (login/logout/demo user switching) —
  // badge должен сразу отражать unread count именно нового пользователя.
  notifications.refresh();
}

function setActiveNav(route) {
  navLinks.forEach(link => {
    if (link.dataset.route === route) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

function closeMobileSidebar() {
  appSidebar.classList.remove('is-open');
  sidebarOverlay.hidden = true;
}

// После клика на notification (см. notifications.js) переход на связанный роут может
// потребовать смены хэша, которая рендерит страницу асинхронно (hashchange). Поэтому
// открытие конкретной сущности (Task/Event drawer, Announcements tab) выполняется здесь —
// сразу после того, как соответствующая страница действительно отрисована, а не сразу
// после router.navigate(), которое могло ещё не сработать.
function openPendingNotificationEntity(route) {
  const pending = notifications.consumePendingOpen(route);
  if (!pending) return;
  if (pending.entityType === 'task') kanban.openEditTaskDrawer(pending.entityId);
  else if (pending.entityType === 'event') calendar.openEditEventDrawer(pending.entityId);
  else if (pending.entityType === 'announcement') company.showAnnouncementsTab();
}

function renderRoute(route) {
  setActiveNav(route);
  if (route === 'kanban') {
    pageTitle.textContent = 'Задачи';
    kanban.renderKanbanPage(mainContent);
    if (pendingCreateTask) {
      pendingCreateTask = false;
      kanban.openCreateTaskDrawer();
    }
    openPendingNotificationEntity('kanban');
    return;
  }
  if (route === 'dashboard') {
    pageTitle.textContent = 'Dashboard';
    dashboard.renderDashboardPage(mainContent);
    return;
  }
  if (route === 'calendar') {
    pageTitle.textContent = 'Календарь';
    calendar.renderCalendarPage(mainContent);
    openPendingNotificationEntity('calendar');
    return;
  }
  if (route === 'workspace') {
    pageTitle.textContent = 'Доска и заметки';
    workspace.renderWorkspacePage(mainContent);
    return;
  }
  pageTitle.textContent = 'Компания';
  company.renderCompanyPage(mainContent);
  openPendingNotificationEntity('company');
}

function handleRouteChange() {
  const route = router.getCurrentRoute();
  const authed = auth.isAuthenticated();

  if (!authed) {
    pendingCreateTask = false;
    if (route !== 'login') { router.navigate('login'); return; }
    appShell.hidden = true;
    loginScreen.hidden = false;
    return;
  }

  if (route === 'login') { router.navigate('dashboard'); return; }

  loginScreen.hidden = true;
  appShell.hidden = false;
  updateUserChrome();
  renderRoute(route);
}

// ---------- Login ----------

loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const email = loginEmail.value.trim();
  const password = loginPassword.value.trim();
  if (!email || !password) return;
  auth.login(email);
  loginForm.reset();
  router.navigate('dashboard');
});

quickLoginBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    auth.quickLogin(btn.dataset.quickRole);
    router.navigate('dashboard');
  });
});

logoutBtn.addEventListener('click', () => {
  auth.logout();
  router.navigate('login');
});

// ---------- Sidebar (мобильный off-canvas) ----------

sidebarToggleBtn.addEventListener('click', () => {
  const isOpen = appSidebar.classList.toggle('is-open');
  sidebarOverlay.hidden = !isOpen;
});
sidebarOverlay.addEventListener('click', closeMobileSidebar);
navLinks.forEach(link => link.addEventListener('click', closeMobileSidebar));

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeMobileSidebar();
});

sidebarNewTaskBtn.addEventListener('click', () => {
  closeMobileSidebar();
  if (router.getCurrentRoute() === 'kanban') {
    kanban.openCreateTaskDrawer();
  } else {
    pendingCreateTask = true;
    router.navigate('kanban');
  }
});

// ---------- Инициализация ----------

store.init();
notifications.initNotificationCenter();
kanban.initKanbanModule();
kanban.setOnDrawerClosed(() => {
  // Drawer — общий оверлей поверх любой страницы; если задачу правили с Dashboard,
  // его карточки ("Мои задачи", статистика) нужно обновить после закрытия.
  if (router.getCurrentRoute() === 'dashboard') {
    dashboard.renderDashboardPage(mainContent);
  }
});
router.initRouter(handleRouteChange);
