import { readFileSync, existsSync } from 'node:fs';

const html = readFileSync('legacy/index.html', 'utf8');
const css = readFileSync('legacy/src/styles.css', 'utf8');
const js = readFileSync('legacy/src/main.js', 'utf8');
const glycoData = readFileSync('legacy/src/glyco-data.js', 'utf8');

const areaCount = (glycoData.match(/title: '(Diretoria|Clínica|Produto|Operações|Financeiro)'/g) ?? []).length;
const hasLowConfidence = glycoData.includes("confidence: 'baixa'");

const checks = [
  ['index.html links local stylesheet', existsSync('legacy/src/styles.css') && html.includes('href="src/styles.css"')],
  ['index.html links local script', existsSync('legacy/src/main.js') && html.includes('src="src/main.js"')],
  ['landmarks are present', ['<header', '<main', '<footer'].every((tag) => html.includes(tag))],
  ['tree aria label exists', html.includes('role="tree"') && html.includes('aria-label="Cargos no organograma"')],
  ['live regions exist', html.includes('aria-live="polite"')],
  ['form controls exist', ['name="name"', 'name="role"', 'name="department"', 'name="location"', 'name="managerId"'].every((field) => html.includes(field))],
  ['local storage key exists', js.includes("const STORAGE_KEY = 'personal-org-chart';") && js.includes('localStorage.setItem')],
  ['chart interaction exists', js.includes("elements.chart.addEventListener('click'") && js.includes('data-person-id')],
  ['focus-visible style exists', css.includes(':focus-visible') && css.includes('outline: 3px solid #ffb703')],
  ['responsive media query exists', css.includes('@media (max-width: 900px)') && css.includes('@media (max-width: 640px)')],
  ['glyco data module is loaded', js.includes("from './glyco-data.js'") && js.includes('glycoAreas') && js.includes('glycoGaps')],
  ['glyco chart has the five validated areas', areaCount === 5],
  ['glyco areas carry goals and strategy', (glycoData.match(/\n    goals: \[/g) ?? []).length === 5 && (glycoData.match(/strategy: '/g) ?? []).length === 5],
  ['glyco gaps and squads exist', glycoData.includes('glycoGaps = [') && glycoData.includes('glycoSquads = [') && (glycoData.match(/id: 'gap-\d'/g) ?? []).length === 3],
  ['glyco provenance is labeled', glycoData.includes("status: 'partial'") && glycoData.includes('exemplos ilustrativos') && hasLowConfidence],
  ['no personal data policy is explicit', html.includes('Sem dados pessoais') && glycoData.includes('Sem dados pessoais')],
  ['details render goals and strategy', js.includes('Goals') && js.includes('Estratégia') && js.includes('area.strategy')],
];

const failures = checks.filter(([, passed]) => !passed);

if (failures.length > 0) {
  console.error('Verification failed:');
  for (const [name] of failures) console.error(`- ${name}`);
  process.exit(1);
}

console.log(`${checks.length} checks passed`);
