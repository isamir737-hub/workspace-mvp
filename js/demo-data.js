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
  {
    id: 'user-employee-3',
    companyId: DEMO_COMPANY.id,
    firstName: 'Елена',
    lastName: 'Волкова',
    name: 'Елена Волкова',
    email: 'elena@demo.local',
    role: 'employee',
    position: 'QA Engineer',
    department: 'Инженерия',
    managerId: 'user-manager',
    phone: '+7 900 100-00-05',
    birthday: '1997-02-09',
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

// ---------- Demo Tasks (только для самого первого запуска — см. buildFreshState) ----------

function hoursFromNowIso(hours) {
  return new Date(Date.now() + hours * 3600000).toISOString();
}
function daysFromNowIso(days, hour = 18) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function buildDemoTask(overrides) {
  const createdAt = daysAgoIso(overrides.createdDaysAgo ?? 4);
  const status = overrides.status;
  return {
    id: overrides.id,
    companyId: DEMO_COMPANY.id,
    creatorId: overrides.creatorId || 'user-owner',
    assigneeId: overrides.assigneeId || null,
    title: overrides.title,
    description: overrides.description || '',
    deadline: overrides.deadline || null,
    reminderMinutes: null,
    reminderShown: true, // демо-данные не должны сразу засыпать напоминаниями при первом входе
    attachments: [],
    comments: [],
    status,
    priority: overrides.priority || 'medium',
    tags: overrides.tags || [],
    createdAt,
    updatedAt: createdAt,
    completedAt: status === 'done' ? createdAt : null,
    legacyCollaboratorEmail: null,
  };
}

// ~14 задач, распределённые по всем 5 колонкам, с обязательным разнообразием:
// без дедлайна / ближайший дедлайн / overdue / High / Critical / теги / разные assignee / Done.
export function createDemoTasks() {
  return [
    // Backlog
    buildDemoTask({
      id: 'task-demo-1', title: 'Провести аудит безопасности', status: 'backlog',
      priority: 'low', assigneeId: 'user-employee-3', tags: ['security'],
    }),
    buildDemoTask({
      id: 'task-demo-2', title: 'Обновить дизайн-систему', status: 'backlog',
      priority: 'medium', assigneeId: 'user-employee', tags: ['design'],
      deadline: daysFromNowIso(14),
    }),
    buildDemoTask({
      id: 'task-demo-3', title: 'Подготовить roadmap Q4', status: 'backlog',
      priority: 'medium', assigneeId: 'user-manager', tags: [],
    }),

    // To Do
    buildDemoTask({
      id: 'task-demo-4', title: 'Настроить CI/CD pipeline', status: 'todo',
      priority: 'high', assigneeId: 'user-employee-2', tags: ['devops', 'backend'],
      deadline: daysFromNowIso(5),
    }),
    buildDemoTask({
      id: 'task-demo-5', title: 'Написать тесты для API', status: 'todo',
      priority: 'medium', assigneeId: 'user-employee-2', tags: ['testing'],
      deadline: hoursFromNowIso(18), // ближайший дедлайн — попадает в task_deadline_soon
    }),
    buildDemoTask({
      id: 'task-demo-6', title: 'Согласовать бюджет маркетинга', status: 'todo',
      priority: 'critical', assigneeId: 'user-owner', tags: ['finance'],
      deadline: daysFromNowIso(2),
    }),

    // In Progress
    buildDemoTask({
      id: 'task-demo-7', title: 'Редизайн Dashboard', status: 'inprogress',
      priority: 'medium', assigneeId: 'user-employee', tags: ['design', 'dashboard'],
      deadline: daysFromNowIso(7),
    }),
    buildDemoTask({
      id: 'task-demo-8', title: 'Интеграция с платёжным шлюзом', status: 'inprogress',
      priority: 'high', assigneeId: 'user-employee-2', tags: ['backend', 'payments'],
      deadline: daysFromNowIso(-2), // просрочена — попадает в task_overdue
    }),
    buildDemoTask({
      id: 'task-demo-9', title: 'Онбординг нового сотрудника', status: 'inprogress',
      priority: 'low', assigneeId: 'user-manager', tags: [],
    }),

    // In Review
    buildDemoTask({
      id: 'task-demo-10', title: 'Ревью PR: Notification Center', status: 'inreview',
      priority: 'medium', assigneeId: 'user-manager', tags: ['review'],
      deadline: daysFromNowIso(1),
    }),
    buildDemoTask({
      id: 'task-demo-11', title: 'Проверить доступность (a11y)', status: 'inreview',
      priority: 'high', assigneeId: 'user-employee-3', tags: ['a11y', 'qa'],
      deadline: daysFromNowIso(3),
    }),

    // Done
    buildDemoTask({
      id: 'task-demo-12', title: 'Запуск Dashboard v1', status: 'done',
      priority: 'medium', assigneeId: 'user-owner', tags: ['launch'], createdDaysAgo: 20,
    }),
    buildDemoTask({
      id: 'task-demo-13', title: 'Миграция на новую схему данных', status: 'done',
      priority: 'high', assigneeId: 'user-employee-2', tags: ['migration'], createdDaysAgo: 15,
    }),
    buildDemoTask({
      id: 'task-demo-14', title: 'Настройка demo-авторизации', status: 'done',
      priority: 'low', assigneeId: 'user-manager', tags: [], createdDaysAgo: 25,
    }),
  ];
}

// ---------- Demo Notes ----------

export function createDemoNotes() {
  const now = new Date().toISOString();
  return [
    {
      id: 'note-demo-1',
      companyId: DEMO_COMPANY.id,
      ownerId: 'user-owner',
      title: 'Идеи по продукту',
      content: '<p><strong>Гипотезы на следующий квартал:</strong></p><ul><li>Упрощённый onboarding</li><li>Мобильное приложение</li><li>Интеграция с внешним календарём</li></ul>',
      visibility: 'private',
      sharedWith: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'note-demo-2',
      companyId: DEMO_COMPANY.id,
      ownerId: 'user-manager',
      title: '1:1 заметки',
      content: '<p>Регулярные заметки для встреч один на один с командой.</p><p><em>Обновляется еженедельно.</em></p>',
      visibility: 'shared',
      sharedWith: ['user-employee'],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'note-demo-3',
      companyId: DEMO_COMPANY.id,
      ownerId: 'user-employee',
      title: 'Личный чек-лист',
      content: '<p>Что нужно сделать на этой неделе:</p><ul><li>Обновить макеты</li><li>Согласовать с командой</li></ul>',
      visibility: 'private',
      sharedWith: [],
      createdAt: now,
      updatedAt: now,
    },
  ];
}

// ---------- Demo Whiteboards ----------

export function createDemoWhiteboards() {
  const now = new Date().toISOString();
  return [
    {
      id: 'board-demo-1',
      companyId: DEMO_COMPANY.id,
      ownerId: 'user-owner',
      title: 'Roadmap Q4',
      visibility: 'shared',
      sharedWith: ['user-manager'],
      viewport: { x: 0, y: 0, zoom: 1 },
      objects: [
        {
          id: 'wbobj-demo-1', type: 'sticky', x: 60, y: 80, width: 160, height: 120,
          text: 'Мобильное приложение', color: '#fdf1c8',
        },
        {
          id: 'wbobj-demo-2', type: 'sticky', x: 280, y: 80, width: 160, height: 120,
          text: 'Новый onboarding', color: '#dbeee0',
        },
        {
          id: 'wbobj-demo-3', type: 'rectangle', x: 60, y: 260, width: 380, height: 90,
          text: '', strokeColor: '#6b6b70', fillColor: '#ffffff', strokeWidth: 1.5,
        },
        {
          id: 'wbobj-demo-4', type: 'text', x: 80, y: 285, width: 200, height: 44,
          text: 'Q4 milestones', color: '#111111', fontSize: 'medium',
        },
        {
          id: 'wbobj-demo-5', type: 'connector', fromObjectId: 'wbobj-demo-1', toObjectId: 'wbobj-demo-2',
        },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'board-demo-2',
      companyId: DEMO_COMPANY.id,
      ownerId: 'user-manager',
      title: 'Заметки команды',
      visibility: 'private',
      sharedWith: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      objects: [
        {
          id: 'wbobj-demo-6', type: 'sticky', x: 80, y: 100, width: 160, height: 120,
          text: 'Спринт-ретро', color: '#e3e8fb',
        },
      ],
      createdAt: now,
      updatedAt: now,
    },
  ];
}
