import { makeRoleColumn, starterColumns } from './board'
import type { AppDocument, Area, ScenarioId } from './types'

const SOURCE = 'glyco-data.js'
const DATE = '2026-10-04'

/** Catálogo canônico de áreas (PT) — seed + migração sem apagar áreas extras do usuário. */
export const AREA_CATALOG = [
  'Diretoria',
  'Clínica',
  'Produto',
  'Operações',
  'Financeiro',
  'Comercial',
  'Estratégia de Conteúdo',
  'Tráfego e Geração de Leads',
  'Vendas e Conversão',
  'Segurança e Compliance',
  'Jurídico e Regulatório',
  'People',
  'Customer Success',
] as const

function areaId(scenarioId: ScenarioId, slug: string) {
  return scenarioId === 'atual' ? `area-${slug}` : `plan-area-${slug}`
}

function slugifyArea(title: string) {
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function catalogAreas(scenarioId: ScenarioId): Area[] {
  return AREA_CATALOG.map((title, order) => ({
    id: areaId(scenarioId, slugifyArea(title)),
    scenarioId,
    title,
    order,
  }))
}

/** Insere áreas canônicas faltantes por título+cenário; não remove áreas custom. */
export function ensureCanonicalAreas(doc: AppDocument): AppDocument {
  const extra: Area[] = []
  for (const scenarioId of ['atual', 'planejada'] as const) {
    const existing = doc.areas.filter((area) => area.scenarioId === scenarioId)
    const titles = new Set(existing.map((area) => area.title.toLowerCase()))
    let order = existing.reduce((max, area) => Math.max(max, area.order), -1) + 1
    for (const area of catalogAreas(scenarioId)) {
      if (titles.has(area.title.toLowerCase())) continue
      extra.push({ ...area, order: order++ })
    }
  }
  if (extra.length === 0) return doc
  return { ...doc, areas: [...doc.areas, ...extra] }
}

/**
 * Atual: Pedro como fundador/CEO + catálogo completo de áreas.
 * Planejada: cargos já registrados no app anterior, marcados como proposta.
 * O playbook de 22 títulos citado no plano não está neste repositório; nada foi inventado para completar a conta.
 */
export function createSeed(): AppDocument {
  return {
    version: 1,
    revision: 1,
    people: [{ id: 'person-pedro', name: 'Pedro Leal' }],
    areas: [...catalogAreas('atual'), ...catalogAreas('planejada')],
    roles: [
      {
        id: 'role-ceo',
        scenarioId: 'atual',
        areaId: 'area-diretoria',
        title: 'CEO & Founder',
        status: 'active',
        source: 'pedro-brain / plano',
        sourceDate: DATE,
        note: 'Ocupante confirmado no plano. Hierarquia além do fundador não está documentada no Brain.',
        collapsed: false,
      },
      role('plan-ceo', 'planejada', 'plan-area-diretoria', 'CEO & Founder', 'proposal', 'alta'),
      role('plan-medical', 'planejada', 'plan-area-clinica', 'Head Médico(a)', 'proposal', 'alta'),
      role('plan-eng', 'planejada', 'plan-area-produto', 'Head de Engenharia', 'proposal', 'alta'),
      role('plan-cto', 'planejada', 'plan-area-produto', 'CTO (vago)', 'open', 'baixa'),
      role('plan-ops', 'planejada', 'plan-area-operacoes', 'Head de Operações', 'proposal', 'alta'),
      role('plan-fin', 'planejada', 'plan-area-financeiro', 'Head Financeiro', 'proposal', 'alta'),
      role('plan-gap-cto', 'planejada', 'plan-area-produto', 'CTO não contratado', 'open', 'lacuna'),
      role('plan-gap-growth', 'planejada', 'plan-area-diretoria', 'Marketing/Growth sem dono', 'open', 'lacuna'),
      role('plan-gap-rh', 'planejada', 'plan-area-operacoes', 'RH sem estrutura', 'open', 'lacuna'),
    ],
    assignments: [{ id: 'assign-pedro', scenarioId: 'atual', roleId: 'role-ceo', personId: 'person-pedro' }],
    relations: [
      rel('rel-medical', 'plan-medical', 'plan-ceo', 'direct'),
      rel('rel-eng', 'plan-eng', 'plan-ceo', 'direct'),
      rel('rel-cto', 'plan-cto', 'plan-ceo', 'direct'),
      rel('rel-ops', 'plan-ops', 'plan-ceo', 'direct'),
      rel('rel-fin', 'plan-fin', 'plan-ceo', 'direct'),
      rel('rel-gap-cto', 'plan-gap-cto', 'plan-ceo', 'direct'),
      rel('rel-gap-growth', 'plan-gap-growth', 'plan-ceo', 'functional'),
      rel('rel-gap-rh', 'plan-gap-rh', 'plan-ops', 'assistant'),
    ],
    bands: [
      { id: 'row-diretoria', scenarioId: 'atual', axis: 'row', title: 'Diretoria', order: 0 },
      { id: 'col-estrutura', scenarioId: 'atual', axis: 'column', title: 'Estrutura', order: 0 },
      { id: 'plan-row-diretoria', scenarioId: 'planejada', axis: 'row', title: 'Diretoria', order: 0 },
      { id: 'plan-row-clinica', scenarioId: 'planejada', axis: 'row', title: 'Clínica', order: 1 },
      { id: 'plan-row-produto', scenarioId: 'planejada', axis: 'row', title: 'Produto', order: 2 },
      { id: 'plan-row-ops', scenarioId: 'planejada', axis: 'row', title: 'Operações', order: 3 },
      { id: 'plan-row-fin', scenarioId: 'planejada', axis: 'row', title: 'Financeiro', order: 4 },
      { id: 'plan-col', scenarioId: 'planejada', axis: 'column', title: 'Cargos', order: 0 },
    ],
    placements: [
      place('place-ceo', 'atual', 'role-ceo', 'row-diretoria', 'col-estrutura'),
      place('p-ceo', 'planejada', 'plan-ceo', 'plan-row-diretoria', 'plan-col'),
      place('p-med', 'planejada', 'plan-medical', 'plan-row-clinica', 'plan-col'),
      place('p-eng', 'planejada', 'plan-eng', 'plan-row-produto', 'plan-col'),
      place('p-cto', 'planejada', 'plan-cto', 'plan-row-produto', 'plan-col'),
      place('p-ops', 'planejada', 'plan-ops', 'plan-row-ops', 'plan-col'),
      place('p-fin', 'planejada', 'plan-fin', 'plan-row-fin', 'plan-col'),
      place('p-g1', 'planejada', 'plan-gap-cto', 'plan-row-produto', 'plan-col'),
      place('p-g2', 'planejada', 'plan-gap-growth', 'plan-row-diretoria', 'plan-col'),
      place('p-g3', 'planejada', 'plan-gap-rh', 'plan-row-ops', 'plan-col'),
    ],
    fields: [
      {
        id: 'field-confidence',
        scenarioId: 'planejada',
        name: 'Confiança da fonte',
        type: 'select',
        options: ['alta', 'baixa', 'lacuna'],
      },
    ],
    values: [
      { id: 'v-ceo', roleId: 'plan-ceo', fieldId: 'field-confidence', value: 'alta' },
      { id: 'v-cto', roleId: 'plan-cto', fieldId: 'field-confidence', value: 'baixa' },
      { id: 'v-gap', roleId: 'plan-gap-rh', fieldId: 'field-confidence', value: 'lacuna' },
    ],
    responsibilities: [
      {
        id: 'resp-ceo',
        scenarioId: 'atual',
        roleId: 'role-ceo',
        text: 'Direção da empresa e decisões que destravam contratação e produto.',
        pendingAssignment: false,
      },
    ],
    goals: [
      {
        id: 'goal-medicos',
        scenarioId: 'atual',
        title: 'Fechar 3 médicos',
        indicator: 'médicos endócrino ou nutrólogo esportivo fechados',
        baseline: 0,
        target: 3,
        progress: 0,
        source: 'pedro-brain references/glyco.md',
      },
    ],
    initiatives: [
      {
        id: 'init-whatsapp',
        scenarioId: 'atual',
        goalId: 'goal-medicos',
        title: 'Abordagem pessoal no WhatsApp',
      },
    ],
    columns: [
      ...starterColumns('atual'),
      makeRoleColumn('atual', 'role-ceo', 'CEO & Founder', 4),
      ...starterColumns('planejada'),
      makeRoleColumn('planejada', 'plan-ceo', 'CEO & Founder', 4),
    ],
    tasks: [
      {
        id: 'task-whatsapp',
        scenarioId: 'atual',
        title: 'Listar médicos para a primeira abordagem',
        description: 'Meta comercial registrada no Brain: abordagem 1:1 antes de anúncios.',
        status: 'todo',
        priority: 'high',
        due: '',
        roleId: 'role-ceo',
        personId: 'person-pedro',
        initiativeId: 'init-whatsapp',
        goalId: 'goal-medicos',
        checklist: [{ id: 'check-1', text: 'Separar endócrino e nutrólogo esportivo', done: false }],
        blocks: [
          { id: 'task-whatsapp-tools', kind: 'tools', title: 'Ferramentas', text: '', width: 6, height: 128 },
          { id: 'task-whatsapp-objective', kind: 'objective', title: 'Objetivo', text: '', width: 6, height: 128 },
          { id: 'task-whatsapp-context', kind: 'context', title: 'Contexto', text: '', width: 12, height: 112 },
        ],
        links: [],
        origin: 'local',
        externalId: '',
        pendingAssignment: false,
      },
      {
        id: 'task-plano',
        scenarioId: 'planejada',
        title: 'Revisar cargos propostos antes de aplicar na estrutura atual',
        description: 'Rascunho da Planejada. Não altera tarefas do cenário Atual.',
        status: 'todo',
        priority: 'medium',
        due: '',
        roleId: 'plan-ceo',
        personId: null,
        initiativeId: null,
        goalId: null,
        checklist: [],
        blocks: [
          { id: 'task-plano-tools', kind: 'tools', title: 'Ferramentas', text: '', width: 6, height: 128 },
          { id: 'task-plano-objective', kind: 'objective', title: 'Objetivo', text: '', width: 6, height: 128 },
          { id: 'task-plano-context', kind: 'context', title: 'Contexto', text: '', width: 12, height: 112 },
        ],
        links: [],
        origin: 'local',
        externalId: '',
        pendingAssignment: false,
      },
    ],
    connections: [
      {
        id: 'conn-github',
        kind: 'github',
        label: 'GitHub',
        endpoint: 'https://github.com/pedromleal15/glyco-company',
        status: 'pendente',
        detail: 'Consulta de issues e PRs fica no Worker, com token só no backend.',
      },
      {
        id: 'conn-google',
        kind: 'google-tasks',
        label: 'Google Tasks',
        endpoint: 'https://tasks.googleapis.com',
        status: 'pendente',
        detail: 'Importar e enviar alterações é explícito. Sem token, nada é enviado.',
      },
    ],
    audit: [
      {
        id: 'audit-seed',
        at: '2026-10-04T00:00:00.000Z',
        action: 'inicial',
        detail: 'Cenário atual com Pedro no CEO. Planejada com propostas parciais, sem completar 22 cargos inventados.',
      },
    ],
  }
}

function role(
  id: string,
  scenarioId: 'planejada',
  areaId: string,
  title: string,
  status: 'proposal' | 'open',
  confidence: string,
): AppDocument['roles'][number] {
  return {
    id,
    scenarioId,
    areaId,
    title,
    status,
    source: confidence === 'lacuna' ? 'lacuna identificada no app anterior' : SOURCE,
    sourceDate: DATE,
    note: `Proposta. Confiança registrada: ${confidence}. Não veio de um playbook de 22 cargos.`,
    collapsed: false,
  }
}

function rel(id: string, fromRoleId: string, toRoleId: string, kind: 'direct' | 'functional' | 'assistant'): AppDocument['relations'][number] {
  return { id, scenarioId: 'planejada', fromRoleId, toRoleId, kind }
}

function place(
  id: string,
  scenarioId: 'atual' | 'planejada',
  roleId: string,
  rowBandId: string,
  columnBandId: string,
): AppDocument['placements'][number] {
  return { id, scenarioId, roleId, rowBandId, columnBandId, order: 0 }
}
