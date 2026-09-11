// Демонстрационная авторизация. Не настоящая безопасность — UI-level роли (owner/manager/employee).

import * as store from './store.js';
import { DEMO_USERS } from './demo-data.js';

// Любые непустые email/пароль пускают внутрь. Если email известен — используется
// существующий профиль, иначе создаётся временный demo employee с этим email.
export function login(email) {
  const user = store.findOrCreateUserByEmail(email.trim());
  store.setCurrentUser(user.id);
  return user;
}

export function quickLogin(role) {
  const demo = DEMO_USERS.find(u => u.role === role);
  if (!demo) return null;
  const user = store.getUserByEmail(demo.email) || store.findOrCreateUserByEmail(demo.email);
  store.setCurrentUser(user.id);
  return user;
}

export function logout() {
  store.clearCurrentUser();
}

export function isAuthenticated() {
  return !!store.getCurrentUser();
}
