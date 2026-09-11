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

// Демо-встречи для Dashboard ("Встречи на сегодня"). Calendar-модуль ещё не реализован,
// поэтому даты считаются относительно текущего момента, чтобы демо выглядело осмысленно
// в день первого запуска (после этого события хранятся как обычные данные в Store).
function isoAtOffset(dayOffset, hour, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export function createDemoCalendarEvents() {
  return [
    {
      id: 'event-standup',
      companyId: DEMO_COMPANY.id,
      title: 'Ежедневный стендап',
      startsAt: isoAtOffset(0, 10, 0),
      endsAt: isoAtOffset(0, 10, 15),
      location: 'Zoom',
      creatorId: 'user-manager',
      participantIds: ['user-owner', 'user-manager', 'user-employee'],
    },
    {
      id: 'event-review',
      companyId: DEMO_COMPANY.id,
      title: 'Ревью спринта',
      startsAt: isoAtOffset(0, 15, 0),
      endsAt: isoAtOffset(0, 16, 0),
      location: 'Переговорная 2',
      creatorId: 'user-owner',
      participantIds: ['user-owner', 'user-manager'],
    },
    {
      id: 'event-onboarding',
      companyId: DEMO_COMPANY.id,
      title: 'Онбординг нового сотрудника',
      startsAt: isoAtOffset(1, 11, 0),
      endsAt: isoAtOffset(1, 12, 0),
      location: 'Переговорная 1',
      creatorId: 'user-manager',
      participantIds: ['user-manager', 'user-employee'],
    },
  ];
}

// Демо-объявления компании для Dashboard (read-only на этом этапе).
function daysAgoIso(days, hour = 9) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

export function createDemoAnnouncements() {
  return [
    {
      id: 'ann-dashboard-launch',
      companyId: DEMO_COMPANY.id,
      title: 'Запустили новый Dashboard',
      body: 'Теперь у каждого сотрудника есть единый экран с задачами, встречами и статистикой команды.',
      authorId: 'user-owner',
      createdAt: daysAgoIso(1),
    },
    {
      id: 'ann-team-event',
      companyId: DEMO_COMPANY.id,
      title: 'Корпоратив в эту пятницу',
      body: 'В 18:00 собираемся в переговорной на первом этаже. Будет пицца.',
      authorId: 'user-manager',
      createdAt: daysAgoIso(3),
    },
    {
      id: 'ann-policy-update',
      companyId: DEMO_COMPANY.id,
      title: 'Обновление политики отпусков',
      body: 'Заявки на отпуск теперь нужно подавать минимум за 5 рабочих дней.',
      authorId: 'user-owner',
      createdAt: daysAgoIso(6),
    },
  ];
}
