Ты работаешь над существующим Vanilla JavaScript MVP рабочего пространства компании.

ВАЖНО:
это не новый проект. Перед любыми изменениями сначала изучи существующие index.html, app.js и style.css и пойми текущую функциональность.

Текущий проект уже содержит работающую Kanban-доску:
Backlog
To Do
In Progress
In Review
Done

Уже реализованы:
- создание задачи;
- редактирование задачи;
- удаление;
- drag & drop между статусами;
- кнопки перехода между статусами;
- дедлайны;
- напоминания;
- browser notifications;
- toast notifications;
- комментарии;
- вложения;
- localStorage;
- responsive Kanban.

Не переписывай работающую функциональность без необходимости.
При рефакторинге обеспечивай миграцию старых данных.

ЦЕЛЬ ПРОДУКТА

Создать lightweight work management workspace для одной компании с архитектурным заделом на:
- on-premise;
- SaaS;
- несколько компаний;
- backend в будущем.

Текущий MVP остается полностью frontend-only.

TECH STACK

Использовать:
- HTML;
- CSS;
- Vanilla JavaScript;
- ES modules;
- localStorage;
- Browser APIs.

Не использовать:
- React;
- Vue;
- Angular;
- Next.js;
- Node backend;
- Firebase;
- Supabase;
- сторонние UI frameworks.

Не вводить build step, если он не нужен.

Приложение должно запускаться через простой static server.

ARCHITECTURE

Постепенно разделять приложение на:

js/
app.js
router.js
store.js
migrations.js
demo-data.js
auth.js
task-service.js
notification-service.js

dashboard.js
kanban.js
calendar.js
whiteboard.js
notes.js
company.js
employees.js

Не создавать гигантские модули без необходимости.

DATA ACCESS

UI-компоненты не должны напрямую хаотично обращаться к localStorage.

Создай единый Store / repository abstraction.

Все основные сущности должны содержать:
id
companyId
createdAt
updatedAt, когда применимо.

Сущности:
User
Company
Task
CalendarEvent
Note
Whiteboard
Announcement
Notification.

Поддерживать schemaVersion и migrations.

Сохранить и мигрировать текущие данные kanban-tasks-v1.

AUTHORIZATION

MVP использует только демонстрационную авторизацию.

Роли:
owner
manager
employee

Это UI-level permissions, а не настоящая безопасность.

DESIGN

Не придумывай новый визуальный язык.

Сохрани существующий стиль:
- белый основной фон;
- светло-серые рабочие поверхности;
- темный текст;
- muted grey secondary text;
- красный как основной action accent;
- большие border radius;
- мягкие border;
- минимальные тени;
- аккуратный современный B2B SaaS UI.

Используй существующие CSS variables и расширяй их.

Красный не использовать как декоративный цвет повсеместно.
Использовать его для CTA, selected state и важных действий.

Статусные цвета делать приглушенными.

Не использовать emoji как основные UI icons.
Предпочитать небольшие inline SVG icons.

LAYOUT

Desktop first.

Главная структура:

Sidebar
Topbar
Main content

Sidebar:
Dashboard
Kanban
Calendar
Whiteboard & Notes
Company

В Sidebar также должна присутствовать заметная кнопка:
+ Новая задача

Topbar:
page title / breadcrumbs
optional search
notifications
current user avatar/profile

RESPONSIVE

Desktop first, но приложение должно оставаться usable:
- tablet;
- mobile.

Sidebar на мобильном превращается в drawer.

Не создавать отдельный mobile продукт.

ROUTING

Использовать hash router:

#/login
#/dashboard
#/kanban
#/calendar
#/workspace
#/company

Hash routing выбран для совместимости с localhost и GitHub Pages.

QUALITY RULES

Перед завершением каждого этапа:

1. Проверь отсутствие JS ошибок.
2. Проверь существующие сценарии Kanban.
3. Проверь refresh страницы.
4. Проверь сохранение localStorage.
5. Проверь migration existing data.
6. Проверь empty state.
7. Проверь responsive.
8. Проверь keyboard accessibility для основных controls.
9. Не удаляй существующую функциональность молча.
10. Не добавляй feature scope, который не требуется.

Работай итеративно.

После каждого этапа приложение должно оставаться полностью запускаемым.

Если видишь архитектурную проблему:
сначала объясни ее кратко,
затем исправь минимально необходимым способом.

Не переписывай весь проект ради эстетики кода.