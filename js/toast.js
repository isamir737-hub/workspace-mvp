// Единая система toast-уведомлений (immediate feedback). Используется kanban.js и
// notifications.js — вынесена в отдельный модуль, чтобы оба могли переиспользовать
// один и тот же #toastContainer без циклических импортов друг на друга.

export function showToast(title, body) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast';
  const strong = document.createElement('strong');
  strong.textContent = title;
  toast.appendChild(strong);
  if (body) {
    const text = document.createElement('div');
    text.textContent = body;
    toast.appendChild(text);
  }
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 8000);
}
