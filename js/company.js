// Компания (#/company): вкладки Company / Employees / Announcements. Данные — только
// через store.js. Owner может редактировать; Manager/Employee — read-only.

import * as store from './store.js';

const ROLE_LABELS = { manager: 'Manager', employee: 'Employee' };
const MAX_AVATAR_PX = 128;
const MAX_LOGO_PX = 256;
const MAX_IMAGE_SOURCE_BYTES = 5 * 1024 * 1024; // 5 МБ на исходный файл

let containerEl = null;
let bodyEl = null;
let currentTab = 'company'; // 'company' | 'employees' | 'announcements'

let employeesSearchQuery = '';
let employeesFilterDepartment = '';
let employeesFilterRole = '';

// ---------- Общие хелперы ----------

function initials(name) {
  return (name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function buildAvatarEl(user, sizeClass) {
  const el = document.createElement('div');
  el.className = 'avatar' + (sizeClass ? ' ' + sizeClass : '');
  if (user.avatar) {
    const img = document.createElement('img');
    img.src = user.avatar;
    img.alt = '';
    el.appendChild(img);
  } else {
    el.textContent = initials(user.name);
  }
  return el;
}

function buildEmptyHint(title, helper) {
  const wrap = document.createElement('div');
  wrap.className = 'empty-hint';
  const t = document.createElement('div');
  t.className = 'empty-hint-title';
  t.textContent = title;
  wrap.appendChild(t);
  const h = document.createElement('div');
  h.className = 'empty-hint-helper';
  h.textContent = helper;
  wrap.appendChild(h);
  return wrap;
}

// Двухшаговое подтверждение необратимо звучащих, но на деле обратимых действий
// (деактивация сотрудника, архивирование объявления) без browser confirm()/alert().
// Первый клик переводит кнопку в "armed"-состояние с явной подписью, второй —
// в течение 3с — подтверждает действие; иначе кнопка сама возвращается в исходное состояние.
function bindTwoStepConfirm(btn, armedLabel, onConfirm) {
  const originalLabel = btn.textContent;
  let armed = false;
  let resetTimer = null;
  btn.addEventListener('click', () => {
    if (!armed) {
      armed = true;
      btn.textContent = armedLabel;
      btn.classList.add('is-armed');
      resetTimer = setTimeout(() => {
        armed = false;
        btn.textContent = originalLabel;
        btn.classList.remove('is-armed');
      }, 4000);
      return;
    }
    clearTimeout(resetTimer);
    armed = false;
    btn.textContent = originalLabel;
    btn.classList.remove('is-armed');
    onConfirm();
  });
}

// Изображение (фото сотрудника / логотип компании) уменьшается до maxPx по большей
// стороне и кодируется в JPEG dataURL — чтобы не хранить в localStorage огромные файлы.
function readAndResizeImage(file, maxPx) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) { reject(new Error('not-image')); return; }
    if (file.size > MAX_IMAGE_SOURCE_BYTES) { reject(new Error('too-large')); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => reject(new Error('decode-failed'));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('read-failed'));
    reader.readAsDataURL(file);
  });
}

// ---------- Публичный вход ----------

export function renderCompanyPage(container) {
  containerEl = container;
  ensureCompanyEditDrawer();
  ensureEmployeeFormDrawer();
  ensureEmployeeDetailDrawer();
  ensureAnnouncementFormDrawer();
  rebuildPage();
}

function rebuildPage() {
  containerEl.className = 'main-content company-page';
  containerEl.innerHTML = '';
  containerEl.appendChild(buildHeader());
  bodyEl = document.createElement('div');
  bodyEl.className = 'company-tab-body';
  containerEl.appendChild(bodyEl);
  renderBody();
}

function buildHeader() {
  const header = document.createElement('div');
  header.className = 'workspace-header';

  const left = document.createElement('div');
  const title = document.createElement('h2');
  title.className = 'workspace-header-title';
  title.textContent = 'Компания';
  left.appendChild(title);
  const subtitle = document.createElement('p');
  subtitle.className = 'workspace-header-subtitle';
  subtitle.textContent = 'Профиль компании, сотрудники и объявления.';
  left.appendChild(subtitle);
  header.appendChild(left);

  const tabs = document.createElement('div');
  tabs.className = 'workspace-tabs';
  tabs.setAttribute('role', 'tablist');
  const tabDefs = [
    ['company', 'Company'],
    ['employees', 'Employees'],
    ['announcements', 'Announcements'],
  ];
  for (const [id, label] of tabDefs) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'workspace-tab' + (currentTab === id ? ' active' : '');
    btn.textContent = label;
    btn.addEventListener('click', () => { currentTab = id; rebuildPage(); });
    tabs.appendChild(btn);
  }
  header.appendChild(tabs);

  return header;
}

function renderBody() {
  bodyEl.innerHTML = '';
  if (currentTab === 'company') renderCompanyTab(bodyEl);
  else if (currentTab === 'employees') renderEmployeesTab(bodyEl);
  else renderAnnouncementsTab(bodyEl);
}

// =====================================================================
// COMPANY
// =====================================================================

function buildDetailItem(label, value) {
  const item = document.createElement('div');
  item.className = 'company-detail-item';
  const l = document.createElement('span');
  l.className = 'company-detail-label';
  l.textContent = label;
  item.appendChild(l);
  const v = document.createElement('span');
  v.className = 'company-detail-value';
  v.textContent = value || '—';
  item.appendChild(v);
  return item;
}

function buildSection(titleText) {
  const section = document.createElement('div');
  section.className = 'company-section';
  const title = document.createElement('div');
  title.className = 'company-section-title';
  title.textContent = titleText;
  section.appendChild(title);
  return section;
}

function renderCompanyTab(container) {
  const currentUser = store.getCurrentUser();
  const company = store.getCompany();
  const isOwner = currentUser && currentUser.role === 'owner';

  const wrap = document.createElement('div');
  wrap.className = 'company-profile';

  const headRow = document.createElement('div');
  headRow.className = 'company-header-row';
  const headSpacer = document.createElement('div');
  headRow.appendChild(headSpacer);
  if (isOwner) {
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn-secondary btn-small';
    editBtn.textContent = 'Редактировать';
    editBtn.addEventListener('click', () => openCompanyEditDrawer());
    headRow.appendChild(editBtn);
  }
  wrap.appendChild(headRow);

  // About
  const about = buildSection('About');
  const aboutRow = document.createElement('div');
  aboutRow.className = 'company-about-row';
  const logo = document.createElement('div');
  logo.className = 'company-logo';
  if (company.logo) {
    const img = document.createElement('img');
    img.src = company.logo;
    img.alt = '';
    logo.appendChild(img);
  } else {
    logo.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="3" width="12" height="18" rx="1.5"/><path d="M16 21v-6h4v6"/></svg>';
  }
  aboutRow.appendChild(logo);
  const aboutText = document.createElement('div');
  aboutText.className = 'company-about-text';
  const name = document.createElement('div');
  name.className = 'company-name';
  name.textContent = company.name || 'Без названия';
  aboutText.appendChild(name);
  const desc = document.createElement('p');
  desc.className = 'company-description';
  desc.textContent = company.description || 'Описание пока не заполнено.';
  aboutText.appendChild(desc);
  aboutRow.appendChild(aboutText);
  about.appendChild(aboutRow);
  wrap.appendChild(about);

  // Company details
  const details = buildSection('Company details');
  const detailGrid = document.createElement('div');
  detailGrid.className = 'company-detail-grid';
  detailGrid.appendChild(buildDetailItem('Адрес', company.address));
  detailGrid.appendChild(buildDetailItem('Website', company.website));
  detailGrid.appendChild(buildDetailItem('Registration number', company.registration && company.registration.registrationNumber));
  detailGrid.appendChild(buildDetailItem('Tax number', company.registration && company.registration.taxNumber));
  details.appendChild(detailGrid);
  wrap.appendChild(details);

  // Banking
  const banking = buildSection('Banking');
  const bankGrid = document.createElement('div');
  bankGrid.className = 'company-detail-grid';
  bankGrid.appendChild(buildDetailItem('Bank name', company.banking && company.banking.bankName));
  bankGrid.appendChild(buildDetailItem('Account', company.banking && company.banking.account));
  bankGrid.appendChild(buildDetailItem('SWIFT', company.banking && company.banking.swift));
  banking.appendChild(bankGrid);
  wrap.appendChild(banking);

  // Important contacts
  const contacts = buildSection('Important contacts');
  const contactsList = document.createElement('div');
  contactsList.className = 'company-contacts-list';
  const importantContacts = company.importantContacts || [];
  if (importantContacts.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'dashboard-empty';
    empty.textContent = 'Контакты пока не добавлены';
    contactsList.appendChild(empty);
  } else {
    for (const c of importantContacts) {
      const item = document.createElement('div');
      item.className = 'company-contact-item';
      const n = document.createElement('span');
      n.className = 'company-contact-name';
      n.textContent = c.name || '—';
      item.appendChild(n);
      if (c.role) {
        const r = document.createElement('span');
        r.className = 'company-contact-role';
        r.textContent = c.role;
        item.appendChild(r);
      }
      if (c.contact) {
        const contactEl = document.createElement('span');
        contactEl.textContent = c.contact;
        item.appendChild(contactEl);
      }
      contactsList.appendChild(item);
    }
  }
  contacts.appendChild(contactsList);
  wrap.appendChild(contacts);

  container.appendChild(wrap);
}

// ---------- Company edit drawer ----------

let companyOverlayEl, companyNameInput, companyLogoPreview, companyLogoInput,
  companyDescInput, companyAddressInput, companyWebsiteInput,
  companyRegNumberInput, companyTaxNumberInput,
  companyBankNameInput, companyAccountInput, companySwiftInput,
  companyContactsListEl, companyCloseBtn, companyCancelBtn, companyForm,
  companyBuilt = false;
let pendingCompanyLogo = undefined; // undefined = не менялся, null = удалён, string = новый dataURL

function buildLabeledInput(labelText, type) {
  const wrap = document.createElement('label');
  wrap.className = 'field';
  const label = document.createElement('span');
  label.className = 'field-label';
  label.textContent = labelText;
  wrap.appendChild(label);
  const input = document.createElement('input');
  input.type = type || 'text';
  wrap.appendChild(input);
  return { wrap, input };
}

function buildContactEditRow(contact) {
  const row = document.createElement('div');
  row.className = 'contact-edit-row';
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.placeholder = 'Имя / отдел';
  nameInput.value = (contact && contact.name) || '';
  row.appendChild(nameInput);
  const roleInput = document.createElement('input');
  roleInput.type = 'text';
  roleInput.placeholder = 'Роль';
  roleInput.value = (contact && contact.role) || '';
  row.appendChild(roleInput);
  const contactInput = document.createElement('input');
  contactInput.type = 'text';
  contactInput.placeholder = 'Телефон / email';
  contactInput.value = (contact && contact.contact) || '';
  row.appendChild(contactInput);
  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'icon-btn';
  removeBtn.setAttribute('aria-label', 'Удалить контакт');
  removeBtn.textContent = '✕';
  removeBtn.addEventListener('click', () => row.remove());
  row.appendChild(removeBtn);
  row._getValue = () => ({
    name: nameInput.value.trim(),
    role: roleInput.value.trim(),
    contact: contactInput.value.trim(),
  });
  return row;
}

function ensureCompanyEditDrawer() {
  if (companyBuilt) return;
  companyBuilt = true;

  companyOverlayEl = document.createElement('div');
  companyOverlayEl.className = 'drawer-overlay';
  companyOverlayEl.hidden = true;

  const drawer = document.createElement('aside');
  drawer.className = 'drawer';

  const header = document.createElement('div');
  header.className = 'drawer-header';
  const h2 = document.createElement('h2');
  h2.textContent = 'Редактировать компанию';
  header.appendChild(h2);
  companyCloseBtn = document.createElement('button');
  companyCloseBtn.type = 'button';
  companyCloseBtn.className = 'icon-btn';
  companyCloseBtn.setAttribute('aria-label', 'Закрыть');
  companyCloseBtn.textContent = '✕';
  header.appendChild(companyCloseBtn);
  drawer.appendChild(header);

  companyForm = document.createElement('form');
  companyForm.className = 'drawer-form';
  const body = document.createElement('div');
  body.className = 'drawer-body';

  const logoRow = document.createElement('div');
  logoRow.className = 'avatar-upload-row';
  companyLogoPreview = document.createElement('div');
  companyLogoPreview.className = 'company-logo';
  logoRow.appendChild(companyLogoPreview);
  const logoBtnCol = document.createElement('div');
  logoBtnCol.className = 'avatar-upload-actions';
  companyLogoInput = document.createElement('input');
  companyLogoInput.type = 'file';
  companyLogoInput.accept = 'image/*';
  companyLogoInput.hidden = true;
  const logoUploadBtn = document.createElement('button');
  logoUploadBtn.type = 'button';
  logoUploadBtn.className = 'btn-secondary btn-small';
  logoUploadBtn.textContent = 'Загрузить логотип';
  logoUploadBtn.addEventListener('click', () => companyLogoInput.click());
  logoBtnCol.appendChild(logoUploadBtn);
  const logoRemoveBtn = document.createElement('button');
  logoRemoveBtn.type = 'button';
  logoRemoveBtn.className = 'btn-secondary btn-small';
  logoRemoveBtn.textContent = 'Удалить логотип';
  logoRemoveBtn.addEventListener('click', () => {
    pendingCompanyLogo = null;
    renderCompanyLogoPreview(null);
  });
  logoBtnCol.appendChild(logoRemoveBtn);
  logoRow.appendChild(logoBtnCol);
  body.appendChild(logoRow);
  companyLogoInput.addEventListener('change', async () => {
    const file = companyLogoInput.files[0];
    companyLogoInput.value = '';
    if (!file) return;
    try {
      pendingCompanyLogo = await readAndResizeImage(file, MAX_LOGO_PX);
      renderCompanyLogoPreview(pendingCompanyLogo);
    } catch (e) {
      companyLogoHint.textContent = 'Не удалось загрузить изображение (проверьте формат и размер файла).';
      companyLogoHint.classList.add('error');
    }
  });
  const companyLogoHint = document.createElement('span');
  companyLogoHint.className = 'field-hint';
  body.appendChild(companyLogoHint);

  const nameField = buildLabeledInput('Название *', 'text');
  companyNameInput = nameField.input;
  companyNameInput.maxLength = 120;
  body.appendChild(nameField.wrap);

  const descWrap = document.createElement('label');
  descWrap.className = 'field';
  const descLabel = document.createElement('span');
  descLabel.className = 'field-label';
  descLabel.textContent = 'Описание';
  descWrap.appendChild(descLabel);
  companyDescInput = document.createElement('textarea');
  companyDescInput.rows = 3;
  companyDescInput.maxLength = 600;
  descWrap.appendChild(companyDescInput);
  body.appendChild(descWrap);

  const addressField = buildLabeledInput('Адрес', 'text');
  companyAddressInput = addressField.input;
  body.appendChild(addressField.wrap);

  const websiteField = buildLabeledInput('Website', 'text');
  companyWebsiteInput = websiteField.input;
  companyWebsiteInput.placeholder = 'https://...';
  body.appendChild(websiteField.wrap);

  const regRow = document.createElement('div');
  regRow.className = 'field-row';
  const regNumberField = buildLabeledInput('Registration number', 'text');
  companyRegNumberInput = regNumberField.input;
  regRow.appendChild(regNumberField.wrap);
  const taxNumberField = buildLabeledInput('Tax number', 'text');
  companyTaxNumberInput = taxNumberField.input;
  regRow.appendChild(taxNumberField.wrap);
  body.appendChild(regRow);

  const bankNameField = buildLabeledInput('Bank name', 'text');
  companyBankNameInput = bankNameField.input;
  body.appendChild(bankNameField.wrap);

  const bankRow = document.createElement('div');
  bankRow.className = 'field-row';
  const accountField = buildLabeledInput('Account', 'text');
  companyAccountInput = accountField.input;
  bankRow.appendChild(accountField.wrap);
  const swiftField = buildLabeledInput('SWIFT', 'text');
  companySwiftInput = swiftField.input;
  bankRow.appendChild(swiftField.wrap);
  body.appendChild(bankRow);

  const contactsWrap = document.createElement('div');
  contactsWrap.className = 'field';
  const contactsLabel = document.createElement('span');
  contactsLabel.className = 'field-label';
  contactsLabel.textContent = 'Important contacts';
  contactsWrap.appendChild(contactsLabel);
  companyContactsListEl = document.createElement('div');
  companyContactsListEl.className = 'contacts-edit-list';
  contactsWrap.appendChild(companyContactsListEl);
  const addContactBtn = document.createElement('button');
  addContactBtn.type = 'button';
  addContactBtn.className = 'btn-secondary btn-small add-contact-btn';
  addContactBtn.textContent = '+ Добавить контакт';
  addContactBtn.addEventListener('click', () => {
    companyContactsListEl.appendChild(buildContactEditRow(null));
  });
  contactsWrap.appendChild(addContactBtn);
  body.appendChild(contactsWrap);

  companyForm.appendChild(body);

  const actions = document.createElement('div');
  actions.className = 'drawer-actions';
  actions.appendChild(document.createElement('div'));
  const actionsRight = document.createElement('div');
  actionsRight.className = 'drawer-actions-right';
  companyCancelBtn = document.createElement('button');
  companyCancelBtn.type = 'button';
  companyCancelBtn.className = 'btn-secondary';
  companyCancelBtn.textContent = 'Отмена';
  actionsRight.appendChild(companyCancelBtn);
  const saveBtn = document.createElement('button');
  saveBtn.type = 'submit';
  saveBtn.className = 'btn-primary';
  saveBtn.textContent = 'Сохранить';
  actionsRight.appendChild(saveBtn);
  actions.appendChild(actionsRight);
  companyForm.appendChild(actions);

  drawer.appendChild(companyForm);
  companyOverlayEl.appendChild(drawer);
  document.body.appendChild(companyOverlayEl);

  const close = () => { companyOverlayEl.hidden = true; };
  companyCloseBtn.addEventListener('click', close);
  companyCancelBtn.addEventListener('click', close);
  companyOverlayEl.addEventListener('click', (e) => { if (e.target === companyOverlayEl) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !companyOverlayEl.hidden) close(); });

  companyForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const patch = {
      name: companyNameInput.value.trim() || 'Без названия',
      description: companyDescInput.value.trim(),
      address: companyAddressInput.value.trim(),
      website: companyWebsiteInput.value.trim(),
      registration: {
        registrationNumber: companyRegNumberInput.value.trim(),
        taxNumber: companyTaxNumberInput.value.trim(),
      },
      banking: {
        bankName: companyBankNameInput.value.trim(),
        account: companyAccountInput.value.trim(),
        swift: companySwiftInput.value.trim(),
      },
      importantContacts: Array.from(companyContactsListEl.children)
        .map(row => row._getValue())
        .filter(c => c.name || c.role || c.contact),
    };
    if (pendingCompanyLogo !== undefined) patch.logo = pendingCompanyLogo;
    store.updateCompany(patch);
    close();
    if (currentTab === 'company') renderBody();
  });
}

function renderCompanyLogoPreview(logoUrl) {
  companyLogoPreview.innerHTML = '';
  if (logoUrl) {
    const img = document.createElement('img');
    img.src = logoUrl;
    img.alt = '';
    companyLogoPreview.appendChild(img);
  } else {
    companyLogoPreview.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="3" width="12" height="18" rx="1.5"/><path d="M16 21v-6h4v6"/></svg>';
  }
}

function openCompanyEditDrawer() {
  const company = store.getCompany();
  pendingCompanyLogo = undefined;
  companyNameInput.value = company.name || '';
  renderCompanyLogoPreview(company.logo);
  companyDescInput.value = company.description || '';
  companyAddressInput.value = company.address || '';
  companyWebsiteInput.value = company.website || '';
  companyRegNumberInput.value = (company.registration && company.registration.registrationNumber) || '';
  companyTaxNumberInput.value = (company.registration && company.registration.taxNumber) || '';
  companyBankNameInput.value = (company.banking && company.banking.bankName) || '';
  companyAccountInput.value = (company.banking && company.banking.account) || '';
  companySwiftInput.value = (company.banking && company.banking.swift) || '';
  companyContactsListEl.innerHTML = '';
  for (const c of company.importantContacts || []) {
    companyContactsListEl.appendChild(buildContactEditRow(c));
  }
  companyOverlayEl.hidden = false;
  companyNameInput.focus();
}

// =====================================================================
// EMPLOYEES
// =====================================================================

function getDirectoryUsers(currentUser) {
  return store.getUsers().filter(u => u.companyId === currentUser.companyId && u.role !== 'owner');
}

function getActiveDirectoryUsers(currentUser) {
  return getDirectoryUsers(currentUser).filter(u => u.active !== false);
}

function renderEmployeesTab(container) {
  const currentUser = store.getCurrentUser();
  const isOwner = currentUser && currentUser.role === 'owner';

  const wrap = document.createElement('div');
  wrap.className = 'ws-list-page';

  const toolbar = document.createElement('div');
  toolbar.className = 'list-toolbar';

  const searchWrap = document.createElement('label');
  searchWrap.className = 'kanban-search';
  searchWrap.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.placeholder = 'Поиск сотрудников...';
  searchInput.setAttribute('aria-label', 'Поиск сотрудников');
  searchInput.value = employeesSearchQuery;
  searchInput.addEventListener('input', () => {
    employeesSearchQuery = searchInput.value.trim().toLowerCase();
    renderEmployeeGrid();
  });
  searchWrap.appendChild(searchInput);
  toolbar.appendChild(searchWrap);

  const activeUsers = getActiveDirectoryUsers(currentUser);
  const departments = Array.from(new Set(activeUsers.map(u => u.department).filter(Boolean))).sort();

  const deptField = document.createElement('label');
  deptField.className = 'filter-field';
  const deptLabel = document.createElement('span');
  deptLabel.className = 'filter-field-label';
  deptLabel.textContent = 'Department';
  deptField.appendChild(deptLabel);
  const deptSelect = document.createElement('select');
  deptSelect.appendChild(new Option('Все', ''));
  for (const d of departments) deptSelect.appendChild(new Option(d, d));
  deptSelect.value = employeesFilterDepartment;
  deptSelect.addEventListener('change', () => { employeesFilterDepartment = deptSelect.value; renderEmployeeGrid(); });
  deptField.appendChild(deptSelect);
  toolbar.appendChild(deptField);

  const roleField = document.createElement('label');
  roleField.className = 'filter-field';
  const roleLabel = document.createElement('span');
  roleLabel.className = 'filter-field-label';
  roleLabel.textContent = 'Role';
  roleField.appendChild(roleLabel);
  const roleSelect = document.createElement('select');
  roleSelect.appendChild(new Option('Все', ''));
  roleSelect.appendChild(new Option('Manager', 'manager'));
  roleSelect.appendChild(new Option('Employee', 'employee'));
  roleSelect.value = employeesFilterRole;
  roleSelect.addEventListener('change', () => { employeesFilterRole = roleSelect.value; renderEmployeeGrid(); });
  roleField.appendChild(roleSelect);
  toolbar.appendChild(roleField);

  const spacer = document.createElement('div');
  spacer.className = 'toolbar-spacer-flex';
  toolbar.appendChild(spacer);

  if (isOwner) {
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn-primary';
    addBtn.innerHTML = '<span class="plus" aria-hidden="true">+</span> Добавить сотрудника';
    addBtn.addEventListener('click', () => openEmployeeFormDrawer(null));
    toolbar.appendChild(addBtn);
  }

  wrap.appendChild(toolbar);

  const gridWrap = document.createElement('div');
  gridWrap.className = 'employee-grid-wrap';
  wrap.appendChild(gridWrap);
  employeeGridWrapEl = gridWrap;

  container.appendChild(wrap);
  renderEmployeeGrid();
}

let employeeGridWrapEl = null;

function renderEmployeeGrid() {
  if (!employeeGridWrapEl) return;
  employeeGridWrapEl.innerHTML = '';
  const currentUser = store.getCurrentUser();
  if (!currentUser) return;

  let users = getActiveDirectoryUsers(currentUser);
  if (employeesFilterDepartment) users = users.filter(u => u.department === employeesFilterDepartment);
  if (employeesFilterRole) users = users.filter(u => u.role === employeesFilterRole);
  if (employeesSearchQuery) {
    const q = employeesSearchQuery;
    users = users.filter(u =>
      (u.name || '').toLowerCase().includes(q) ||
      (u.position || '').toLowerCase().includes(q) ||
      (u.department || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q)
    );
  }
  users = users.slice().sort((a, b) => a.name.localeCompare(b.name, 'ru'));

  if (users.length === 0) {
    employeeGridWrapEl.appendChild(buildEmptyHint(
      'Никого не найдено',
      'Измените поиск/фильтры или добавьте нового сотрудника.'
    ));
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'employee-grid';
  for (const user of users) grid.appendChild(buildEmployeeCard(user));
  employeeGridWrapEl.appendChild(grid);
}

function buildEmployeeCard(user) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'employee-card';
  card.addEventListener('click', () => openEmployeeDetailDrawer(user.id));

  const head = document.createElement('div');
  head.className = 'employee-card-head';
  head.appendChild(buildAvatarEl(user, 'avatar-lg'));
  const nameCol = document.createElement('div');
  const nameEl = document.createElement('div');
  nameEl.className = 'employee-card-name';
  nameEl.textContent = user.name;
  nameCol.appendChild(nameEl);
  if (user.position) {
    const posEl = document.createElement('div');
    posEl.className = 'employee-card-position';
    posEl.textContent = user.position;
    nameCol.appendChild(posEl);
  }
  head.appendChild(nameCol);
  card.appendChild(head);

  const badges = document.createElement('div');
  badges.className = 'employee-card-badges';
  if (user.department) {
    const dep = document.createElement('span');
    dep.className = 'badge';
    dep.textContent = user.department;
    badges.appendChild(dep);
  }
  const role = document.createElement('span');
  role.className = 'badge';
  role.textContent = ROLE_LABELS[user.role] || user.role;
  badges.appendChild(role);
  card.appendChild(badges);

  const meta = document.createElement('div');
  meta.className = 'employee-card-meta';
  const email = document.createElement('span');
  email.textContent = user.email;
  meta.appendChild(email);
  if (user.phone) {
    const phone = document.createElement('span');
    phone.textContent = user.phone;
    meta.appendChild(phone);
  }
  card.appendChild(meta);

  return card;
}

// ---------- Employee detail drawer ----------

let detailOverlayEl, detailAvatarEl, detailNameEl, detailRowsEl,
  detailEditBtn, detailDeactivateBtn, detailCloseBtn, detailBuilt = false;
let activeDetailUserId = null;

function buildDetailRow(label, value) {
  const row = document.createElement('div');
  row.className = 'employee-detail-row';
  const l = document.createElement('span');
  l.className = 'employee-detail-label';
  l.textContent = label;
  row.appendChild(l);
  const v = document.createElement('span');
  v.className = 'employee-detail-value';
  v.textContent = value || '—';
  row.appendChild(v);
  return row;
}

function ensureEmployeeDetailDrawer() {
  if (detailBuilt) return;
  detailBuilt = true;

  detailOverlayEl = document.createElement('div');
  detailOverlayEl.className = 'drawer-overlay';
  detailOverlayEl.hidden = true;

  const drawer = document.createElement('aside');
  drawer.className = 'drawer';

  const header = document.createElement('div');
  header.className = 'drawer-header';
  const h2 = document.createElement('h2');
  h2.textContent = 'Сотрудник';
  header.appendChild(h2);
  detailCloseBtn = document.createElement('button');
  detailCloseBtn.type = 'button';
  detailCloseBtn.className = 'icon-btn';
  detailCloseBtn.setAttribute('aria-label', 'Закрыть');
  detailCloseBtn.textContent = '✕';
  header.appendChild(detailCloseBtn);
  drawer.appendChild(header);

  const body = document.createElement('div');
  body.className = 'drawer-body';

  const head = document.createElement('div');
  head.className = 'employee-detail-head';
  detailAvatarEl = document.createElement('div');
  detailAvatarEl.className = 'employee-detail-avatar-wrap';
  head.appendChild(detailAvatarEl);
  detailNameEl = document.createElement('div');
  detailNameEl.className = 'employee-detail-name';
  head.appendChild(detailNameEl);
  body.appendChild(head);

  detailRowsEl = document.createElement('div');
  detailRowsEl.className = 'employee-detail-rows';
  body.appendChild(detailRowsEl);

  drawer.appendChild(body);

  const actions = document.createElement('div');
  actions.className = 'drawer-actions';
  detailDeactivateBtn = document.createElement('button');
  detailDeactivateBtn.type = 'button';
  detailDeactivateBtn.className = 'btn-danger';
  detailDeactivateBtn.textContent = 'Деактивировать';
  actions.appendChild(detailDeactivateBtn);
  const actionsRight = document.createElement('div');
  actionsRight.className = 'drawer-actions-right';
  detailEditBtn = document.createElement('button');
  detailEditBtn.type = 'button';
  detailEditBtn.className = 'btn-primary';
  detailEditBtn.textContent = 'Редактировать';
  actionsRight.appendChild(detailEditBtn);
  actions.appendChild(actionsRight);
  drawer.appendChild(actions);

  detailOverlayEl.appendChild(drawer);
  document.body.appendChild(detailOverlayEl);

  const close = () => { detailOverlayEl.hidden = true; activeDetailUserId = null; };
  detailCloseBtn.addEventListener('click', close);
  detailOverlayEl.addEventListener('click', (e) => { if (e.target === detailOverlayEl) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !detailOverlayEl.hidden) close(); });

  detailEditBtn.addEventListener('click', () => {
    if (!activeDetailUserId) return;
    const id = activeDetailUserId;
    close();
    openEmployeeFormDrawer(id);
  });

  bindTwoStepConfirm(detailDeactivateBtn, 'Подтвердить деактивацию', () => {
    if (!activeDetailUserId) return;
    store.updateUser(activeDetailUserId, { active: false });
    close();
    if (currentTab === 'employees') renderEmployeeGrid();
  });
}

function openEmployeeDetailDrawer(userId) {
  const user = store.getUserById(userId);
  if (!user) return;
  const currentUser = store.getCurrentUser();
  const isOwner = currentUser && currentUser.role === 'owner';

  activeDetailUserId = userId;
  detailAvatarEl.innerHTML = '';
  detailAvatarEl.appendChild(buildAvatarEl(user, 'avatar-xl'));
  detailNameEl.textContent = user.name;

  const manager = user.managerId ? store.getUserById(user.managerId) : null;

  detailRowsEl.innerHTML = '';
  detailRowsEl.appendChild(buildDetailRow('Role', ROLE_LABELS[user.role] || user.role));
  detailRowsEl.appendChild(buildDetailRow('Position', user.position));
  detailRowsEl.appendChild(buildDetailRow('Department', user.department));
  detailRowsEl.appendChild(buildDetailRow('Manager', manager ? manager.name : '—'));
  detailRowsEl.appendChild(buildDetailRow('Phone', user.phone));
  detailRowsEl.appendChild(buildDetailRow('Email', user.email));
  detailRowsEl.appendChild(buildDetailRow('Birthday', formatDate(user.birthday)));

  const canManage = isOwner && user.role !== 'owner';
  detailEditBtn.hidden = !canManage;
  detailDeactivateBtn.hidden = !canManage || user.active === false;

  detailOverlayEl.hidden = false;
}

// ---------- Add / Edit employee drawer ----------

let formOverlayEl, formTitleEl, formEl, formAvatarPreview, formAvatarInput,
  formFirstNameInput, formLastNameInput, formEmailInput, formEmailHint,
  formPhoneInput, formBirthdayInput, formPositionInput, formDepartmentInput,
  formManagerSelect, formRoleSelect, formCloseBtn, formCancelBtn, formBuilt = false;
let editingEmployeeId = null;
let pendingEmployeeAvatar = undefined;

function ensureEmployeeFormDrawer() {
  if (formBuilt) return;
  formBuilt = true;

  formOverlayEl = document.createElement('div');
  formOverlayEl.className = 'drawer-overlay';
  formOverlayEl.hidden = true;

  const drawer = document.createElement('aside');
  drawer.className = 'drawer';

  const header = document.createElement('div');
  header.className = 'drawer-header';
  formTitleEl = document.createElement('h2');
  formTitleEl.textContent = 'Новый сотрудник';
  header.appendChild(formTitleEl);
  formCloseBtn = document.createElement('button');
  formCloseBtn.type = 'button';
  formCloseBtn.className = 'icon-btn';
  formCloseBtn.setAttribute('aria-label', 'Закрыть');
  formCloseBtn.textContent = '✕';
  header.appendChild(formCloseBtn);
  drawer.appendChild(header);

  formEl = document.createElement('form');
  formEl.className = 'drawer-form';
  const body = document.createElement('div');
  body.className = 'drawer-body';

  const avatarRow = document.createElement('div');
  avatarRow.className = 'avatar-upload-row';
  formAvatarPreview = document.createElement('div');
  formAvatarPreview.className = 'avatar avatar-lg';
  avatarRow.appendChild(formAvatarPreview);
  const avatarActions = document.createElement('div');
  avatarActions.className = 'avatar-upload-actions';
  formAvatarInput = document.createElement('input');
  formAvatarInput.type = 'file';
  formAvatarInput.accept = 'image/*';
  formAvatarInput.hidden = true;
  const uploadBtn = document.createElement('button');
  uploadBtn.type = 'button';
  uploadBtn.className = 'btn-secondary btn-small';
  uploadBtn.textContent = 'Загрузить фото';
  uploadBtn.addEventListener('click', () => formAvatarInput.click());
  avatarActions.appendChild(uploadBtn);
  const removeAvatarBtn = document.createElement('button');
  removeAvatarBtn.type = 'button';
  removeAvatarBtn.className = 'btn-secondary btn-small';
  removeAvatarBtn.textContent = 'Удалить фото';
  removeAvatarBtn.addEventListener('click', () => {
    pendingEmployeeAvatar = null;
    renderFormAvatarPreview(null);
  });
  avatarActions.appendChild(removeAvatarBtn);
  avatarRow.appendChild(avatarActions);
  body.appendChild(avatarRow);
  const avatarHint = document.createElement('span');
  avatarHint.className = 'field-hint';
  body.appendChild(avatarHint);
  formAvatarInput.addEventListener('change', async () => {
    const file = formAvatarInput.files[0];
    formAvatarInput.value = '';
    if (!file) return;
    try {
      pendingEmployeeAvatar = await readAndResizeImage(file, MAX_AVATAR_PX);
      renderFormAvatarPreview(pendingEmployeeAvatar);
      avatarHint.textContent = '';
      avatarHint.classList.remove('error');
    } catch (e) {
      avatarHint.textContent = 'Не удалось загрузить изображение (проверьте формат и размер файла).';
      avatarHint.classList.add('error');
    }
  });

  const nameRow = document.createElement('div');
  nameRow.className = 'field-row';
  const firstField = buildLabeledInput('First name *', 'text');
  formFirstNameInput = firstField.input;
  nameRow.appendChild(firstField.wrap);
  const lastField = buildLabeledInput('Last name *', 'text');
  formLastNameInput = lastField.input;
  nameRow.appendChild(lastField.wrap);
  body.appendChild(nameRow);

  const emailField = buildLabeledInput('Email *', 'email');
  formEmailInput = emailField.input;
  body.appendChild(emailField.wrap);
  formEmailHint = document.createElement('span');
  formEmailHint.className = 'field-hint';
  body.appendChild(formEmailHint);

  const phoneRow = document.createElement('div');
  phoneRow.className = 'field-row';
  const phoneField = buildLabeledInput('Phone', 'tel');
  formPhoneInput = phoneField.input;
  phoneRow.appendChild(phoneField.wrap);
  const birthdayField = buildLabeledInput('Birthday', 'date');
  formBirthdayInput = birthdayField.input;
  phoneRow.appendChild(birthdayField.wrap);
  body.appendChild(phoneRow);

  const posRow = document.createElement('div');
  posRow.className = 'field-row';
  const posField = buildLabeledInput('Position', 'text');
  formPositionInput = posField.input;
  posRow.appendChild(posField.wrap);
  const depField = buildLabeledInput('Department', 'text');
  formDepartmentInput = depField.input;
  posRow.appendChild(depField.wrap);
  body.appendChild(posRow);

  const roleRow = document.createElement('div');
  roleRow.className = 'field-row';
  const managerWrap = document.createElement('label');
  managerWrap.className = 'field';
  const managerLabel = document.createElement('span');
  managerLabel.className = 'field-label';
  managerLabel.textContent = 'Manager';
  managerWrap.appendChild(managerLabel);
  formManagerSelect = document.createElement('select');
  managerWrap.appendChild(formManagerSelect);
  roleRow.appendChild(managerWrap);

  const roleWrap = document.createElement('label');
  roleWrap.className = 'field';
  const roleLabel = document.createElement('span');
  roleLabel.className = 'field-label';
  roleLabel.textContent = 'Role';
  roleWrap.appendChild(roleLabel);
  formRoleSelect = document.createElement('select');
  formRoleSelect.appendChild(new Option('Employee', 'employee'));
  formRoleSelect.appendChild(new Option('Manager', 'manager'));
  roleWrap.appendChild(formRoleSelect);
  roleRow.appendChild(roleWrap);
  body.appendChild(roleRow);

  formEl.appendChild(body);

  const actions = document.createElement('div');
  actions.className = 'drawer-actions';
  actions.appendChild(document.createElement('div'));
  const actionsRight = document.createElement('div');
  actionsRight.className = 'drawer-actions-right';
  formCancelBtn = document.createElement('button');
  formCancelBtn.type = 'button';
  formCancelBtn.className = 'btn-secondary';
  formCancelBtn.textContent = 'Отмена';
  actionsRight.appendChild(formCancelBtn);
  const saveBtn = document.createElement('button');
  saveBtn.type = 'submit';
  saveBtn.className = 'btn-primary';
  saveBtn.textContent = 'Сохранить';
  actionsRight.appendChild(saveBtn);
  actions.appendChild(actionsRight);
  formEl.appendChild(actions);

  drawer.appendChild(formEl);
  formOverlayEl.appendChild(drawer);
  document.body.appendChild(formOverlayEl);

  const close = () => { formOverlayEl.hidden = true; editingEmployeeId = null; };
  formCloseBtn.addEventListener('click', close);
  formCancelBtn.addEventListener('click', close);
  formOverlayEl.addEventListener('click', (e) => { if (e.target === formOverlayEl) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !formOverlayEl.hidden) close(); });

  formEl.addEventListener('submit', (e) => {
    e.preventDefault();

    const firstName = formFirstNameInput.value.trim();
    const lastName = formLastNameInput.value.trim();
    formEmailHint.textContent = '';
    formEmailHint.classList.remove('error');

    if (!firstName) { formFirstNameInput.focus(); return; }
    if (!lastName) { formLastNameInput.focus(); return; }

    const email = formEmailInput.value.trim();
    if (!email) {
      formEmailHint.textContent = 'Укажите email';
      formEmailHint.classList.add('error');
      formEmailInput.focus();
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      formEmailHint.textContent = 'Некорректный формат email';
      formEmailHint.classList.add('error');
      formEmailInput.focus();
      return;
    }
    const currentUser = store.getCurrentUser();
    const normalizedEmail = email.toLowerCase();
    const duplicate = store.getUsers().find(u =>
      u.companyId === currentUser.companyId &&
      u.email.toLowerCase() === normalizedEmail &&
      u.id !== editingEmployeeId
    );
    if (duplicate) {
      formEmailHint.textContent = 'Этот email уже используется другим сотрудником';
      formEmailHint.classList.add('error');
      formEmailInput.focus();
      return;
    }

    const patch = {
      firstName,
      lastName,
      name: `${firstName} ${lastName}`.trim(),
      email,
      phone: formPhoneInput.value.trim(),
      birthday: formBirthdayInput.value || null,
      position: formPositionInput.value.trim(),
      department: formDepartmentInput.value.trim(),
      managerId: formManagerSelect.value || null,
      role: formRoleSelect.value,
    };
    if (pendingEmployeeAvatar !== undefined) patch.avatar = pendingEmployeeAvatar;

    if (editingEmployeeId) {
      store.updateUser(editingEmployeeId, patch);
    } else {
      store.createUser({ ...patch, active: true });
    }

    close();
    if (currentTab === 'employees') renderEmployeeGrid();
  });
}

function renderFormAvatarPreview(avatarUrl) {
  formAvatarPreview.innerHTML = '';
  if (avatarUrl) {
    const img = document.createElement('img');
    img.src = avatarUrl;
    img.alt = '';
    formAvatarPreview.appendChild(img);
  } else {
    formAvatarPreview.textContent = editingEmployeeId ? initials(`${formFirstNameInput.value} ${formLastNameInput.value}`) : '';
  }
}

function populateManagerOptions(currentUser, excludeUserId) {
  formManagerSelect.innerHTML = '';
  formManagerSelect.appendChild(new Option('Без руководителя', ''));
  const candidates = store.getUsers().filter(u =>
    u.companyId === currentUser.companyId && u.active !== false && u.id !== excludeUserId
  );
  for (const u of candidates) {
    formManagerSelect.appendChild(new Option(u.name, u.id));
  }
}

function openEmployeeFormDrawer(userId) {
  const currentUser = store.getCurrentUser();
  editingEmployeeId = userId;
  pendingEmployeeAvatar = undefined;
  formEmailHint.textContent = '';
  formEmailHint.classList.remove('error');

  if (userId) {
    const user = store.getUserById(userId);
    if (!user) return;
    formTitleEl.textContent = 'Редактировать сотрудника';
    formFirstNameInput.value = user.firstName || '';
    formLastNameInput.value = user.lastName || '';
    formEmailInput.value = user.email || '';
    formPhoneInput.value = user.phone || '';
    formBirthdayInput.value = user.birthday || '';
    formPositionInput.value = user.position || '';
    formDepartmentInput.value = user.department || '';
    populateManagerOptions(currentUser, user.id);
    formManagerSelect.value = user.managerId || '';
    formRoleSelect.value = user.role === 'manager' ? 'manager' : 'employee';
    renderFormAvatarPreview(user.avatar);
  } else {
    formTitleEl.textContent = 'Новый сотрудник';
    formEl.reset();
    populateManagerOptions(currentUser, null);
    formRoleSelect.value = 'employee';
    renderFormAvatarPreview(null);
  }

  formOverlayEl.hidden = false;
  formFirstNameInput.focus();
}

// =====================================================================
// ANNOUNCEMENTS
// =====================================================================

function renderAnnouncementsTab(container) {
  const currentUser = store.getCurrentUser();
  const isOwner = currentUser && currentUser.role === 'owner';

  const wrap = document.createElement('div');
  wrap.className = 'ws-list-page';

  const toolbar = document.createElement('div');
  toolbar.className = 'list-toolbar';
  const spacer = document.createElement('div');
  spacer.className = 'toolbar-spacer-flex';
  toolbar.appendChild(spacer);
  if (isOwner) {
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn-primary';
    addBtn.innerHTML = '<span class="plus" aria-hidden="true">+</span> Announcement';
    addBtn.addEventListener('click', () => openAnnouncementFormDrawer(null));
    toolbar.appendChild(addBtn);
  }
  wrap.appendChild(toolbar);

  const listEl = document.createElement('div');
  listEl.className = 'announcement-admin-list';
  announcementListEl = listEl;
  wrap.appendChild(listEl);

  container.appendChild(wrap);
  renderAnnouncementList();
}

let announcementListEl = null;

function renderAnnouncementList() {
  if (!announcementListEl) return;
  announcementListEl.innerHTML = '';
  const currentUser = store.getCurrentUser();
  if (!currentUser) return;
  const isOwner = currentUser.role === 'owner';

  const announcements = store.getAnnouncements()
    .filter(a => a.companyId === currentUser.companyId)
    .slice()
    .sort((a, b) => new Date(b.publishedAt || b.createdAt) - new Date(a.publishedAt || a.createdAt));

  if (announcements.length === 0) {
    announcementListEl.appendChild(buildEmptyHint('Пока нет объявлений', 'Создайте первое объявление для компании.'));
    return;
  }

  for (const ann of announcements) {
    announcementListEl.appendChild(buildAnnouncementAdminItem(ann, isOwner));
  }
}

function buildAnnouncementAdminItem(ann, isOwner) {
  const item = document.createElement('div');
  item.className = 'announcement-admin-item';

  const titleRow = document.createElement('div');
  titleRow.className = 'announcement-admin-title-row';
  const titleCol = document.createElement('div');
  const title = document.createElement('div');
  title.className = 'list-item-title';
  title.textContent = ann.title;
  titleCol.appendChild(title);
  const author = store.getUserById(ann.authorId);
  const meta = document.createElement('div');
  meta.className = 'list-item-meta';
  const metaText = document.createElement('span');
  metaText.textContent = (author ? author.name : 'Компания') + ' · ' + formatDateTime(ann.publishedAt || ann.createdAt);
  meta.appendChild(metaText);
  if (ann.active === false) {
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = 'Архивировано';
    meta.appendChild(badge);
  }
  titleCol.appendChild(meta);
  titleRow.appendChild(titleCol);

  if (isOwner) {
    const actions = document.createElement('div');
    actions.className = 'announcement-admin-actions';
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn-secondary btn-small';
    editBtn.textContent = 'Редактировать';
    editBtn.addEventListener('click', () => openAnnouncementFormDrawer(ann.id));
    actions.appendChild(editBtn);
    if (ann.active !== false) {
      const archiveBtn = document.createElement('button');
      archiveBtn.type = 'button';
      archiveBtn.className = 'btn-danger btn-small';
      archiveBtn.textContent = 'Архивировать';
      bindTwoStepConfirm(archiveBtn, 'Подтвердить архивирование', () => {
        store.updateAnnouncement(ann.id, { active: false });
        renderAnnouncementList();
      });
      actions.appendChild(archiveBtn);
    }
    titleRow.appendChild(actions);
  }

  item.appendChild(titleRow);

  const body = document.createElement('div');
  body.className = 'list-item-preview announcement-admin-body';
  body.textContent = ann.body;
  item.appendChild(body);

  return item;
}

// ---------- Announcement create/edit drawer ----------

let annOverlayEl, annTitleEl, annForm, annTitleInput, annBodyInput,
  annCloseBtn, annCancelBtn, annBuilt = false;
let editingAnnouncementId = null;

function ensureAnnouncementFormDrawer() {
  if (annBuilt) return;
  annBuilt = true;

  annOverlayEl = document.createElement('div');
  annOverlayEl.className = 'drawer-overlay';
  annOverlayEl.hidden = true;

  const drawer = document.createElement('aside');
  drawer.className = 'drawer';

  const header = document.createElement('div');
  header.className = 'drawer-header';
  annTitleEl = document.createElement('h2');
  annTitleEl.textContent = 'Новое объявление';
  header.appendChild(annTitleEl);
  annCloseBtn = document.createElement('button');
  annCloseBtn.type = 'button';
  annCloseBtn.className = 'icon-btn';
  annCloseBtn.setAttribute('aria-label', 'Закрыть');
  annCloseBtn.textContent = '✕';
  header.appendChild(annCloseBtn);
  drawer.appendChild(header);

  annForm = document.createElement('form');
  annForm.className = 'drawer-form';
  const body = document.createElement('div');
  body.className = 'drawer-body';

  const titleField = buildLabeledInput('Название *', 'text');
  annTitleInput = titleField.input;
  annTitleInput.maxLength = 160;
  body.appendChild(titleField.wrap);

  const bodyWrap = document.createElement('label');
  bodyWrap.className = 'field';
  const bodyLabel = document.createElement('span');
  bodyLabel.className = 'field-label';
  bodyLabel.textContent = 'Текст *';
  bodyWrap.appendChild(bodyLabel);
  annBodyInput = document.createElement('textarea');
  annBodyInput.rows = 5;
  annBodyInput.maxLength = 2000;
  bodyWrap.appendChild(annBodyInput);
  body.appendChild(bodyWrap);

  annForm.appendChild(body);

  const actions = document.createElement('div');
  actions.className = 'drawer-actions';
  actions.appendChild(document.createElement('div'));
  const actionsRight = document.createElement('div');
  actionsRight.className = 'drawer-actions-right';
  annCancelBtn = document.createElement('button');
  annCancelBtn.type = 'button';
  annCancelBtn.className = 'btn-secondary';
  annCancelBtn.textContent = 'Отмена';
  actionsRight.appendChild(annCancelBtn);
  const saveBtn = document.createElement('button');
  saveBtn.type = 'submit';
  saveBtn.className = 'btn-primary';
  saveBtn.textContent = 'Сохранить';
  actionsRight.appendChild(saveBtn);
  actions.appendChild(actionsRight);
  annForm.appendChild(actions);

  drawer.appendChild(annForm);
  annOverlayEl.appendChild(drawer);
  document.body.appendChild(annOverlayEl);

  const close = () => { annOverlayEl.hidden = true; editingAnnouncementId = null; };
  annCloseBtn.addEventListener('click', close);
  annCancelBtn.addEventListener('click', close);
  annOverlayEl.addEventListener('click', (e) => { if (e.target === annOverlayEl) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !annOverlayEl.hidden) close(); });

  annForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = annTitleInput.value.trim();
    const body = annBodyInput.value.trim();
    if (!title) { annTitleInput.focus(); return; }
    if (!body) { annBodyInput.focus(); return; }

    if (editingAnnouncementId) {
      store.updateAnnouncement(editingAnnouncementId, { title, body });
    } else {
      store.createAnnouncement({ title, body });
    }
    close();
    if (currentTab === 'announcements') renderAnnouncementList();
  });
}

function openAnnouncementFormDrawer(id) {
  editingAnnouncementId = id;
  if (id) {
    const ann = store.getAnnouncement(id);
    if (!ann) return;
    annTitleEl.textContent = 'Редактировать объявление';
    annTitleInput.value = ann.title;
    annBodyInput.value = ann.body;
  } else {
    annTitleEl.textContent = 'Новое объявление';
    annForm.reset();
  }
  annOverlayEl.hidden = false;
  annTitleInput.focus();
}
