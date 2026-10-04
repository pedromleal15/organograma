import { readFileSync, existsSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const css = readFileSync('src/styles.css', 'utf8');
const js = readFileSync('src/main.js', 'utf8');

const checks = [
  ['index.html links local stylesheet', existsSync('src/styles.css') && html.includes('href="src/styles.css"')],
  ['index.html links local script', existsSync('src/main.js') && html.includes('src="src/main.js"')],
  ['landmarks are present', ['<header', '<main', '<footer'].every((tag) => html.includes(tag))],
  ['tree aria label exists', html.includes('role="tree"') && html.includes('aria-label="Cargos no organograma"')],
  ['live regions exist', html.includes('aria-live="polite"')],
  ['form controls exist', ['name="name"', 'name="role"', 'name="department"', 'name="location"', 'name="managerId"'].every((field) => html.includes(field))],
  ['local storage key exists', js.includes("const STORAGE_KEY = 'personal-org-chart';") && js.includes('localStorage.setItem')],
  ['chart interaction exists', js.includes("elements.chart.addEventListener('click'") && js.includes('data-person-id')],
  ['focus-visible style exists', css.includes(':focus-visible') && css.includes('outline: 3px solid #ffb703')],
  ['responsive media query exists', css.includes('@media (max-width: 900px)') && css.includes('@media (max-width: 640px)')],
];

const failures = checks.filter(([, passed]) => !passed);

if (failures.length > 0) {
  console.error('Verification failed:');
  for (const [name] of failures) console.error(`- ${name}`);
  process.exit(1);
}

console.log(`${checks.length} checks passed`);
