// Демонстрационные данные: одна компания и три demo-пользователя (owner/manager/employee).
// Используются для quick login и как база для миграции существующих задач.

export const DEMO_COMPANY = {
  id: 'company-demo',
  name: 'Demo Company',
  createdAt: '2026-01-01T00:00:00.000Z',
};

export const DEMO_USERS = [
  {
    id: 'user-owner',
    companyId: DEMO_COMPANY.id,
    name: 'Анна Смирнова',
    email: 'owner@demo.local',
    role: 'owner',
    createdAt: DEMO_COMPANY.createdAt,
  },
  {
    id: 'user-manager',
    companyId: DEMO_COMPANY.id,
    name: 'Максим Петров',
    email: 'manager@demo.local',
    role: 'manager',
    createdAt: DEMO_COMPANY.createdAt,
  },
  {
    id: 'user-employee',
    companyId: DEMO_COMPANY.id,
    name: 'Ольга Иванова',
    email: 'employee@demo.local',
    role: 'employee',
    createdAt: DEMO_COMPANY.createdAt,
  },
];
