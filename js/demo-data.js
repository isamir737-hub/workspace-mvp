// Демонстрационные данные: одна компания и три demo-пользователя (owner/manager/employee).
// Используются для quick login и как база для миграции существующих задач.

export const DEMO_COMPANY = {
  id: 'company-demo',
  name: 'Demo Company',
  logo: null,
  description: 'Lightweight work management workspace для одной компании: задачи, календарь, доски и заметки в одном месте.',
  address: 'г. Москва, ул. Тверская, 1',
  website: 'https://demo-company.example',
  registration: {
    registrationNumber: '1027700123456',
    taxNumber: '7700123456',
  },
  banking: {
    bankName: 'ПАО «Демо Банк»',
    account: '40702810900000012345',
    swift: 'DEMOBANKXXX',
  },
  importantContacts: [
    { id: 'contact-support', name: 'IT-поддержка', role: 'Поддержка', contact: 'support@demo-company.example' },
    { id: 'contact-hr', name: 'Отдел кадров', role: 'HR', contact: 'hr@demo-company.example' },
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
};

export const DEMO_USERS = [
  {
    id: 'user-owner',
    companyId: DEMO_COMPANY.id,
    firstName: 'Анна',
    lastName: 'Смирнова',
    name: 'Анна Смирнова',
    email: 'owner@demo.local',
    role: 'owner',
    position: 'CEO',
    department: 'Руководство',
    managerId: null,
    phone: '+7 900 100-00-01',
    birthday: '1988-03-12',
    avatar: null,
    active: true,
    createdAt: DEMO_COMPANY.createdAt,
  },
  {
    id: 'user-manager',
    companyId: DEMO_COMPANY.id,
    firstName: 'Максим',
    lastName: 'Петров',
    name: 'Максим Петров',
    email: 'manager@demo.local',
    role: 'manager',
    position: 'Team Lead',
    department: 'Продукт',
    managerId: 'user-owner',
    phone: '+7 900 100-00-02',
    birthday: '1990-07-24',
    avatar: null,
    active: true,
    createdAt: DEMO_COMPANY.createdAt,
  },
  {
    id: 'user-employee',
    companyId: DEMO_COMPANY.id,
    firstName: 'Ольга',
    lastName: 'Иванова',
    name: 'Ольга Иванова',
    email: 'employee@demo.local',
    role: 'employee',
    position: 'Designer',
    department: 'Продукт',
    managerId: 'user-manager',
    phone: '+7 900 100-00-03',
    birthday: '1995-11-02',
    avatar: null,
    active: true,
    createdAt: DEMO_COMPANY.createdAt,
  },
  {
    id: 'user-employee-2',
    companyId: DEMO_COMPANY.id,
    firstName: 'Дмитрий',
    lastName: 'Козлов',
    name: 'Дмитрий Козлов',
    email: 'dmitry@demo.local',
    role: 'employee',
    position: 'Backend Developer',
    department: 'Инженерия',
    managerId: 'user-manager',
    phone: '+7 900 100-00-04',
    birthday: '1993-05-18',
    avatar: null,
    active: true,
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
  const now = new Date().toISOString();
  return [
    {
      id: 'event-standup',
      companyId: DEMO_COMPANY.id,
      title: 'Ежедневный стендап',
      description: '',
      startAt: isoAtOffset(0, 10, 0),
      endAt: isoAtOffset(0, 10, 15),
      creatorId: 'user-manager',
      participantIds: ['user-owner', 'user-manager', 'user-employee'],
      location: 'Zoom',
      meetingUrl: null,
      color: 'blue',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'event-review',
      companyId: DEMO_COMPANY.id,
      title: 'Ревью спринта',
      description: '',
      startAt: isoAtOffset(0, 15, 0),
      endAt: isoAtOffset(0, 16, 0),
      creatorId: 'user-owner',
      participantIds: ['user-owner', 'user-manager'],
      location: 'Переговорная 2',
      meetingUrl: null,
      color: 'blue',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'event-onboarding',
      companyId: DEMO_COMPANY.id,
      title: 'Онбординг нового сотрудника',
      description: '',
      startAt: isoAtOffset(1, 11, 0),
      endAt: isoAtOffset(1, 12, 0),
      creatorId: 'user-manager',
      participantIds: ['user-manager', 'user-employee'],
      location: 'Переговорная 1',
      meetingUrl: null,
      color: 'blue',
      createdAt: now,
      updatedAt: now,
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
      publishedAt: daysAgoIso(1),
      active: true,
      createdAt: daysAgoIso(1),
      updatedAt: daysAgoIso(1),
    },
    {
      id: 'ann-team-event',
      companyId: DEMO_COMPANY.id,
      title: 'Корпоратив в эту пятницу',
      body: 'В 18:00 собираемся в переговорной на первом этаже. Будет пицца.',
      authorId: 'user-manager',
      publishedAt: daysAgoIso(3),
      active: true,
      createdAt: daysAgoIso(3),
      updatedAt: daysAgoIso(3),
    },
    {
      id: 'ann-policy-update',
      companyId: DEMO_COMPANY.id,
      title: 'Обновление политики отпусков',
      body: 'Заявки на отпуск теперь нужно подавать минимум за 5 рабочих дней.',
      authorId: 'user-owner',
      publishedAt: daysAgoIso(6),
      active: true,
      createdAt: daysAgoIso(6),
      updatedAt: daysAgoIso(6),
    },
  ];
}
