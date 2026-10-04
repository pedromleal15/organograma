import { glycoAreas, glycoGaps } from './glyco-data.js';

const STORAGE_KEY = 'personal-org-chart';

// Modelo: cargos e áreas da Glyco, sem dados pessoais.
// `name` guarda o nome do cargo (ex.: "Head de Engenharia"), não de uma pessoa.
// Lacunas de hierarquia são nós explícitos (kind: 'gap') vindos de glyco-data.js.
const starterPeople = buildStarterChart();

function buildStarterChart() {
  const positions = glycoAreas.flatMap((area) =>
    area.positions.map((position) => ({
      id: position.id,
      name: position.title,
      role: position.title,
      department: area.title,
      location: 'Remoto / Brasil',
      managerId: position.parentPositionId ?? '',
      confidence: position.confidence,
      source: position.source,
    })),
  );

  const gaps = glycoGaps.map((gap) => ({
    id: gap.id,
    name: gap.title,
    role: gap.title,
    department: gap.area,
    location: '—',
    managerId: gap.parentPositionId ?? '',
    confidence: 'gap',
    source: gap.source,
    gap: gap.description,
  }));

  return [...positions, ...gaps];
}

const elements = {
  chart: document.querySelector('#org-chart'),
  details: document.querySelector('#person-details'),
  form: document.querySelector('#person-form'),
  managerSelect: document.querySelector('#manager-select'),
  resultCount: document.querySelector('#result-count'),
  search: document.querySelector('#search'),
  resetData: document.querySelector('#reset-data'),
};

let people = loadPeople();
let selectedId = people[0]?.id ?? '';

render();

elements.search.addEventListener('input', render);
elements.resetData.addEventListener('click', () => {
  people = structuredClone(starterPeople);
  selectedId = people[0].id;
  savePeople(people);
  elements.search.value = '';
  render();
});

elements.form.addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(elements.form);
  const person = buildPersonFromForm(formData);

  if (!person) {
    elements.form.reportValidity();
    return;
  }

  people = [...people, person];
  selectedId = person.id;
  savePeople(people);
  elements.form.reset();
  render();
});

function buildPersonFromForm(formData) {
  const name = String(formData.get('name')).trim();
  const role = String(formData.get('role')).trim();
  const department = String(formData.get('department')).trim();
  const location = String(formData.get('location')).trim();

  if (!name || !role || !department || !location) {
    return null;
  }

  return {
    id: createPersonId(name),
    name,
    role,
    department,
    location,
    managerId: String(formData.get('managerId')),
  };
}

function loadPeople() {
  try {
    const storedPeople = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(storedPeople) && storedPeople.length > 0 ? storedPeople : structuredClone(starterPeople);
  } catch {
    return structuredClone(starterPeople);
  }
}

function savePeople(nextPeople) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextPeople));
}

function render() {
  const query = normalize(elements.search.value);
  const visiblePeople = people.filter((person) => personMatchesQuery(person, query));
  const visibleIds = new Set(visiblePeople.map((person) => person.id));

  renderManagerOptions();
  renderChart(visiblePeople, visibleIds);
  renderDetails(people.find((person) => person.id === selectedId) ?? visiblePeople[0] ?? people[0]);
  elements.resultCount.textContent = `${visiblePeople.length} pessoa${visiblePeople.length === 1 ? '' : 's'}`;
}

function renderManagerOptions() {
  const options = ['<option value="">Sem gestor(a)</option>']
    .concat(people.map((person) => `<option value="${person.id}">${escapeHtml(person.name)} — ${escapeHtml(person.role)}</option>`));
  elements.managerSelect.innerHTML = options.join('');
}

function renderChart(visiblePeople, visibleIds) {
  const roots = visiblePeople.filter((person) => !person.managerId || !visibleIds.has(person.managerId));
  elements.chart.innerHTML = roots.length > 0
    ? `<ul>${roots.map((person) => renderPersonNode(person, visibleIds)).join('')}</ul>`
    : '<p class="empty-state">Nenhuma pessoa encontrada.</p>';
}

function renderPersonNode(person, visibleIds) {
  const children = people.filter((candidate) => candidate.managerId === person.id && visibleIds.has(candidate.id));
  const isSelected = person.id === selectedId;
  const childList = children.length > 0
    ? `<ul>${children.map((child) => renderPersonNode(child, visibleIds)).join('')}</ul>`
    : '';

  return `
    <li role="treeitem" aria-expanded="${children.length > 0}">
      <button class="person-card${isSelected ? ' is-selected' : ''}" type="button" data-person-id="${person.id}" aria-pressed="${isSelected}">
        <span class="person-name">${escapeHtml(person.name)}</span>
        <span class="person-role">${escapeHtml(person.role)}</span>
        <span class="person-meta">${escapeHtml(person.department)}</span>
      </button>
      ${childList}
    </li>`;
}

function renderDetails(person) {
  if (!person) {
    elements.details.innerHTML = '<p class="empty-state">Cadastre uma pessoa para começar.</p>';
    return;
  }

  const manager = people.find((candidate) => candidate.id === person.managerId);
  selectedId = person.id;

  const area = glycoAreas.find((candidate) => candidate.title === person.department);
  const goalsBlock = area && area.goals.length > 0
    ? `<div><dt>Goals</dt><dd><ul>${area.goals.map((goal) => `<li>${escapeHtml(goal)}</li>`).join('')}</ul></dd></div>`
    : '';
  const strategyBlock = area && area.strategy
    ? `<div><dt>Estratégia</dt><dd>${escapeHtml(area.strategy)}</dd></div>`
    : '';

  const gaps = glycoGaps.length > 0
    ? `<section class="data-gaps" aria-label="Lacunas de dados confirmadas">
        <h4>Lacunas de dados</h4>
        <ul>${glycoGaps.map((gap) => `<li><strong>${escapeHtml(gap.title)}</strong> — ${escapeHtml(gap.description)}</li>`).join('')}</ul>
        <p class="gaps-source">Fonte: .apolo/glyco-data-source.md</p>
      </section>`
    : '';
  elements.details.innerHTML = `
    <article>
      <h3>${escapeHtml(person.name)}</h3>
      <dl>
        <div><dt>Cargo</dt><dd>${escapeHtml(person.role)}</dd></div>
        <div><dt>Área</dt><dd>${escapeHtml(person.department)}</dd></div>
        <div><dt>Reporta a</dt><dd>${manager ? escapeHtml(manager.name) : 'Sem cargo superior'}</dd></div>
        ${goalsBlock}
        ${strategyBlock}
      </dl>
      ${gaps}
    </article>`;
}

elements.chart.addEventListener('click', (event) => {
  const card = event.target.closest('[data-person-id]');
  if (!card) return;
  selectedId = card.dataset.personId;
  render();
});

function personMatchesQuery(person, query) {
  if (!query) return true;
  return [person.name, person.role, person.department, person.location].some((value) => normalize(value).includes(query));
}

function normalize(value) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function createPersonId(name) {
  const slug = normalize(name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pessoa';
  return `${slug}-${Date.now().toString(36)}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
