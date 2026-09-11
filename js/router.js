// Простой hash-роутер. Ничего не знает о конкретных страницах — только парсит
// хэш, уведомляет подписчика об изменениях и умеет программно переходить между роутами.

const KNOWN_ROUTES = ['login', 'dashboard', 'kanban', 'calendar', 'workspace', 'company'];
const DEFAULT_ROUTE = 'dashboard';

let changeHandler = null;

export function getCurrentRoute() {
  const raw = window.location.hash.replace(/^#\/?/, '').split('?')[0];
  return KNOWN_ROUTES.includes(raw) ? raw : DEFAULT_ROUTE;
}

export function navigate(route) {
  const target = '#/' + route;
  if (window.location.hash === target) {
    // Хэш не меняется — hashchange не сработает, вызываем обработчик вручную.
    if (changeHandler) changeHandler();
    return;
  }
  window.location.hash = target;
}

export function initRouter(handler) {
  changeHandler = handler;
  window.addEventListener('hashchange', handler);
  handler();
}
