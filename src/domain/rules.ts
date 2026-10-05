import { clampColumnWidth, ensureBoardColumns, ensureRoleColumns, makeRoleColumn, roleColumnId, scenarioColumns } from './board'
import { ensureCanonicalAreas } from './seed'
import { uid } from './ids'
import type {
  AgentWrite,
  AppDocument,
  CustomField,
  FieldType,
  RelationKind,
  Result,
  ScenarioId,
  TaskItem,
} from './types'

function commit(doc: AppDocument, patch: Partial<AppDocument>, action: string, detail: string): AppDocument {
  return {
    ...doc,
    ...patch,
    revision: doc.revision + 1,
    audit: [...doc.audit, { id: uid('audit'), at: new Date().toISOString(), action, detail }].slice(-200),
  }
}

export function scenarioRoles(doc: AppDocument, scenarioId: ScenarioId) {
  return doc.roles.filter((role) => role.scenarioId === scenarioId)
}

export function hasCycle(doc: AppDocument, scenarioId: ScenarioId): boolean {
  const ids = scenarioRoles(doc, scenarioId).map((role) => role.id)
  const adjacent = new Map<string, string[]>(ids.map((id) => [id, []]))
  for (const relation of doc.relations) {
    if (relation.scenarioId !== scenarioId) continue
    adjacent.get(relation.fromRoleId)?.push(relation.toRoleId)
  }
  const color = new Map<string, 0 | 1 | 2>()
  const visit = (id: string): boolean => {
    color.set(id, 1)
    for (const next of adjacent.get(id) ?? []) {
      const state = color.get(next) ?? 0
      if (state === 1 || (state === 0 && visit(next))) return true
    }
    color.set(id, 2)
    return false
  }
  return ids.some((id) => (color.get(id) ?? 0) === 0 && visit(id))
}

function fail(error: string): Result<AppDocument> {
  return { ok: false, error }
}

export function setManager(
  doc: AppDocument,
  scenarioId: ScenarioId,
  roleId: string,
  managerId: string | null,
  kind: RelationKind,
): Result<AppDocument> {
  const role = doc.roles.find((item) => item.id === roleId && item.scenarioId === scenarioId)
  if (!role) return fail('Cargo não encontrado neste cenário.')
  if (managerId && !doc.roles.some((item) => item.id === managerId && item.scenarioId === scenarioId)) {
    return fail('Gestor não encontrado neste cenário.')
  }
  const primary = kind !== 'functional'
  const relations = doc.relations.filter((relation) => {
    if (relation.scenarioId !== scenarioId || relation.fromRoleId !== roleId) return true
    return primary ? relation.kind === 'functional' : relation.kind !== 'functional'
  })
  if (managerId) {
    relations.push({ id: uid('rel'), scenarioId, fromRoleId: roleId, toRoleId: managerId, kind })
  }
  const next = { ...doc, relations }
  if (hasCycle(next, scenarioId)) return fail('Esse reporte criaria um ciclo.')
  const label = managerId ? `${kind} → ${managerId}` : `sem ${kind}`
  return { ok: true, value: commit(next, {}, 'reporte', `${role.title}: ${label}`) }
}

export function deleteRole(doc: AppDocument, roleId: string): Result<AppDocument> {
  const role = doc.roles.find((item) => item.id === roleId)
  if (!role) return fail('Cargo não encontrado.')
  const manager = doc.relations.find(
    (relation) => relation.fromRoleId === roleId && relation.scenarioId === role.scenarioId && relation.kind !== 'functional',
  )
  const children = doc.relations.filter(
    (relation) => relation.toRoleId === roleId && relation.scenarioId === role.scenarioId && relation.kind !== 'functional',
  )
  let relations = doc.relations.filter(
    (relation) => relation.fromRoleId !== roleId && relation.toRoleId !== roleId,
  )
  if (manager) {
    relations = relations.concat(
      children.map((child) => ({
        id: uid('rel'),
        scenarioId: role.scenarioId,
        fromRoleId: child.fromRoleId,
        toRoleId: manager.toRoleId,
        kind: child.kind,
      })),
    )
  }
  const next: AppDocument = {
    ...doc,
    roles: doc.roles.filter((item) => item.id !== roleId),
    relations,
    assignments: doc.assignments.filter((item) => item.roleId !== roleId),
    placements: doc.placements.filter((item) => item.roleId !== roleId),
    values: doc.values.filter((item) => item.roleId !== roleId),
    responsibilities: doc.responsibilities.map((item) =>
      item.roleId === roleId ? { ...item, roleId: null, pendingAssignment: true } : item,
    ),
    tasks: doc.tasks.map((item) =>
      item.roleId === roleId ? { ...item, roleId: null, pendingAssignment: true } : item,
    ),
  }
  return { ok: true, value: commit(next, {}, 'excluir-cargo', role.title) }
}

export function removeBand(doc: AppDocument, bandId: string): Result<AppDocument> {
  const band = doc.bands.find((item) => item.id === bandId)
  if (!band) return fail('Faixa não encontrada.')
  const placements = doc.placements.map((placement) => {
    if (placement.scenarioId !== band.scenarioId) return placement
    if (band.axis === 'row' && placement.rowBandId === bandId) return { ...placement, rowBandId: null }
    if (band.axis === 'column' && placement.columnBandId === bandId) return { ...placement, columnBandId: null }
    return placement
  })
  return {
    ok: true,
    value: commit(
      { ...doc, bands: doc.bands.filter((item) => item.id !== bandId), placements },
      {},
      'remover-faixa',
      band.title,
    ),
  }
}

export function renameBand(doc: AppDocument, bandId: string, title: string): Result<AppDocument> {
  const name = title.trim()
  if (!name) return fail('A faixa precisa de um nome.')
  if (!doc.bands.some((band) => band.id === bandId)) return fail('Faixa não encontrada.')
  return {
    ok: true,
    value: commit(
      { ...doc, bands: doc.bands.map((band) => (band.id === bandId ? { ...band, title: name } : band)) },
      {},
      'renomear-faixa',
      name,
    ),
  }
}

export function addBand(doc: AppDocument, scenarioId: ScenarioId, axis: 'row' | 'column', title: string): Result<AppDocument> {
  const name = title.trim()
  if (!name) return fail('A faixa precisa de um nome.')
  const order = doc.bands.filter((band) => band.scenarioId === scenarioId && band.axis === axis).length
  const band = { id: uid('band'), scenarioId, axis, title: name, order }
  return { ok: true, value: commit({ ...doc, bands: [...doc.bands, band] }, {}, 'faixa', name) }
}

export function moveBand(doc: AppDocument, bandId: string, direction: -1 | 1): Result<AppDocument> {
  const band = doc.bands.find((item) => item.id === bandId)
  if (!band) return fail('Faixa não encontrada.')
  const siblings = doc.bands
    .filter((item) => item.scenarioId === band.scenarioId && item.axis === band.axis)
    .sort((a, b) => a.order - b.order)
  const index = siblings.findIndex((item) => item.id === bandId)
  const swap = siblings[index + direction]
  if (!swap) return { ok: true, value: doc }
  const bands = doc.bands.map((item) => {
    if (item.id === band.id) return { ...item, order: swap.order }
    if (item.id === swap.id) return { ...item, order: band.order }
    return item
  })
  return { ok: true, value: commit({ ...doc, bands }, {}, 'ordenar-faixa', band.title) }
}

export function placeRole(
  doc: AppDocument,
  roleId: string,
  rowBandId: string | null,
  columnBandId: string | null,
): Result<AppDocument> {
  const role = doc.roles.find((item) => item.id === roleId)
  if (!role) return fail('Cargo não encontrado.')
  const placements = doc.placements.some((item) => item.roleId === roleId)
    ? doc.placements.map((item) => (item.roleId === roleId ? { ...item, rowBandId, columnBandId } : item))
    : [...doc.placements, { id: uid('place'), scenarioId: role.scenarioId, roleId, rowBandId, columnBandId, order: 0 }]
  return { ok: true, value: commit({ ...doc, placements }, {}, 'matriz', role.title) }
}

export function updateRole(
  doc: AppDocument,
  roleId: string,
  patch: Partial<Pick<AppDocument['roles'][number], 'title' | 'areaId' | 'status' | 'note' | 'collapsed'>>,
): Result<AppDocument> {
  const role = doc.roles.find((item) => item.id === roleId)
  if (!role) return fail('Cargo não encontrado.')
  if (patch.title !== undefined && !patch.title.trim()) return fail('O cargo precisa de um título.')
  if (patch.areaId && !doc.areas.some((area) => area.id === patch.areaId && area.scenarioId === role.scenarioId)) {
    return fail('Área não encontrada neste cenário.')
  }
  const nextTitle = patch.title?.trim() ?? role.title
  const roles = doc.roles.map((item) =>
    item.id === roleId ? { ...item, ...patch, title: nextTitle } : item,
  )
  const columns = doc.columns.map((column) =>
    column.roleId === roleId && patch.title !== undefined
      ? { ...column, title: nextTitle }
      : column,
  )
  return { ok: true, value: commit({ ...doc, roles, columns }, {}, 'editar-cargo', nextTitle) }
}

export function createRole(
  doc: AppDocument,
  scenarioId: ScenarioId,
  title: string,
  areaId: string,
): Result<AppDocument> {
  const name = title.trim()
  if (name.length < 2) return fail('O cargo precisa de um título.')
  if (!doc.areas.some((area) => area.id === areaId && area.scenarioId === scenarioId)) return fail('Escolha uma área deste cenário.')
  const role = {
    id: uid('role'),
    scenarioId,
    areaId,
    title: name,
    status: 'open' as const,
    source: 'cadastro local',
    sourceDate: new Date().toISOString().slice(0, 10),
    note: '',
    collapsed: false,
  }
  const placement = {
    id: uid('place'),
    scenarioId,
    roleId: role.id,
    rowBandId: null,
    columnBandId: null,
    order: doc.placements.length,
  }
  const order = scenarioColumns(doc, scenarioId).reduce((max, column) => Math.max(max, column.order), -1) + 1
  const roleColumn = makeRoleColumn(scenarioId, role.id, name, order)
  return {
    ok: true,
    value: commit(
      {
        ...doc,
        roles: [...doc.roles, role],
        placements: [...doc.placements, placement],
        columns: [...doc.columns, roleColumn],
      },
      {},
      'novo-cargo',
      name,
    ),
  }
}

export function assignPerson(doc: AppDocument, roleId: string, personId: string | null, personName = ''): Result<AppDocument> {
  const role = doc.roles.find((item) => item.id === roleId)
  if (!role) return fail('Cargo não encontrado.')
  let people = doc.people
  let nextPersonId = personId
  if (!personId && personName.trim()) {
    nextPersonId = uid('person')
    people = [...people, { id: nextPersonId, name: personName.trim() }]
  }
  if (nextPersonId && !people.some((person) => person.id === nextPersonId)) return fail('Pessoa não encontrada.')
  const assignments = doc.assignments.filter((item) => !(item.roleId === roleId && item.scenarioId === role.scenarioId))
  if (nextPersonId) {
    assignments.push({ id: uid('assign'), scenarioId: role.scenarioId, roleId, personId: nextPersonId })
  }
  return { ok: true, value: commit({ ...doc, people, assignments }, {}, 'ocupante', role.title) }
}

export function addResponsibility(doc: AppDocument, roleId: string, text: string): Result<AppDocument> {
  const role = doc.roles.find((item) => item.id === roleId)
  const body = text.trim()
  if (!role || !body) return fail('Informe o cargo e a responsabilidade.')
  const item = { id: uid('resp'), scenarioId: role.scenarioId, roleId, text: body, pendingAssignment: false }
  return { ok: true, value: commit({ ...doc, responsibilities: [...doc.responsibilities, item] }, {}, 'responsabilidade', body) }
}

export function addField(
  doc: AppDocument,
  scenarioId: ScenarioId,
  name: string,
  type: FieldType,
  options: string[] = [],
): Result<AppDocument> {
  const label = name.trim()
  if (!label) return fail('O campo precisa de um nome.')
  if (type === 'select' && options.length === 0) return fail('Seleção precisa de opções.')
  const field: CustomField = { id: uid('field'), scenarioId, name: label, type, options }
  return { ok: true, value: commit({ ...doc, fields: [...doc.fields, field] }, {}, 'campo', label) }
}

export function setFieldValue(doc: AppDocument, roleId: string, fieldId: string, value: string): Result<AppDocument> {
  const field = doc.fields.find((item) => item.id === fieldId)
  const role = doc.roles.find((item) => item.id === roleId)
  if (!field || !role || field.scenarioId !== role.scenarioId) return fail('Campo incompatível com o cargo.')
  if (field.type === 'number' && value.trim() && Number.isNaN(Number(value))) return fail('Valor numérico inválido.')
  if (field.type === 'select' && value && !field.options.includes(value)) return fail('Opção inválida.')
  const values = doc.values.filter((item) => !(item.roleId === roleId && item.fieldId === fieldId))
  values.push({ id: uid('value'), roleId, fieldId, value })
  return { ok: true, value: commit({ ...doc, values }, {}, 'valor', field.name) }
}

export function createTask(
  doc: AppDocument,
  scenarioId: ScenarioId,
  input: Partial<TaskItem> & { title: string },
): Result<AppDocument> {
  const title = input.title.trim()
  if (title.length < 2) return fail('A tarefa precisa de um título.')
  if (input.roleId && !doc.roles.some((role) => role.id === input.roleId && role.scenarioId === scenarioId)) {
    return fail('O cargo responsável não está neste cenário.')
  }
  const status = input.status ?? 'todo'
  if (!scenarioColumns(doc, scenarioId).some((column) => column.id === status)) {
    return fail('Coluna não encontrada neste cenário.')
  }
  const taskId = uid('task')
  const task: TaskItem = {
    id: taskId,
    scenarioId,
    title,
    description: input.description?.trim() ?? '',
    status,
    priority: input.priority ?? 'medium',
    due: input.due ?? '',
    roleId: input.roleId ?? null,
    personId: input.personId ?? null,
    initiativeId: input.initiativeId ?? null,
    goalId: input.goalId ?? null,
    checklist: input.checklist ?? [],
    blocks: input.blocks ?? defaultTaskBlocks(taskId),
    links: input.links ?? [],
    origin: input.origin ?? 'local',
    externalId: input.externalId ?? '',
    pendingAssignment: false,
  }
  return { ok: true, value: commit({ ...doc, tasks: [...doc.tasks, task] }, {}, 'tarefa', title) }
}

export function updateTask(doc: AppDocument, taskId: string, patch: Partial<TaskItem>): Result<AppDocument> {
  const current = doc.tasks.find((task) => task.id === taskId)
  if (!current) return fail('Tarefa não encontrada.')
  if (patch.roleId && !doc.roles.some((role) => role.id === patch.roleId && role.scenarioId === current.scenarioId)) {
    return fail('O cargo responsável não está neste cenário.')
  }
  if (patch.status && !scenarioColumns(doc, current.scenarioId).some((column) => column.id === patch.status)) {
    return fail('Coluna não encontrada neste cenário.')
  }
  const tasks = doc.tasks.map((task) => (task.id === taskId ? { ...task, ...patch, id: task.id, scenarioId: task.scenarioId } : task))
  return { ok: true, value: commit({ ...doc, tasks }, {}, 'editar-tarefa', patch.title || current.title) }
}

export function defaultTaskBlocks(taskId: string): TaskItem['blocks'] {
  return [
    { id: `${taskId}-tools`, kind: 'tools', title: 'Ferramentas', text: '', width: 6, height: 128 },
    { id: `${taskId}-objective`, kind: 'objective', title: 'Objetivo', text: '', width: 6, height: 128 },
    { id: `${taskId}-context`, kind: 'context', title: 'Contexto', text: '', width: 12, height: 112 },
  ]
}

export function addTaskBlock(doc: AppDocument, taskId: string, title = 'Novo bloco'): Result<AppDocument> {
  const task = doc.tasks.find((item) => item.id === taskId)
  if (!task) return fail('Tarefa não encontrada.')
  const block = { id: uid('block'), kind: 'text' as const, title, text: '', width: 6, height: 128 }
  return updateTask(doc, taskId, { blocks: [...(task.blocks ?? defaultTaskBlocks(task.id)), block] })
}

export function updateTaskBlock(
  doc: AppDocument,
  taskId: string,
  blockId: string,
  patch: Partial<Pick<TaskItem['blocks'][number], 'title' | 'text' | 'width' | 'height'>>,
): Result<AppDocument> {
  const task = doc.tasks.find((item) => item.id === taskId)
  if (!task) return fail('Tarefa não encontrada.')
  const blocks = task.blocks ?? defaultTaskBlocks(task.id)
  if (!blocks.some((block) => block.id === blockId)) return fail('Bloco não encontrado.')
  const normalized = {
    ...patch,
    width: patch.width === undefined ? undefined : Math.min(12, Math.max(3, Math.round(patch.width))),
    height: patch.height === undefined ? undefined : Math.min(420, Math.max(72, Math.round(patch.height))),
  }
  return updateTask(doc, taskId, {
    blocks: blocks.map((block) => block.id === blockId ? {
      ...block,
      ...normalized,
      width: normalized.width ?? block.width,
      height: normalized.height ?? block.height,
    } : block),
  })
}

export function removeTaskBlock(doc: AppDocument, taskId: string, blockId: string): Result<AppDocument> {
  const task = doc.tasks.find((item) => item.id === taskId)
  if (!task) return fail('Tarefa não encontrada.')
  const blocks = task.blocks ?? defaultTaskBlocks(task.id)
  return updateTask(doc, taskId, { blocks: blocks.filter((block) => block.id !== blockId) })
}

export function setTaskStatus(doc: AppDocument, taskId: string, status: string): Result<AppDocument> {
  const task = doc.tasks.find((item) => item.id === taskId)
  if (!task) return fail('Tarefa não encontrada.')
  if (!scenarioColumns(doc, task.scenarioId).some((column) => column.id === status)) {
    return fail('Coluna não encontrada neste cenário.')
  }
  return updateTask(doc, taskId, { status })
}

export function renameColumn(doc: AppDocument, scenarioId: ScenarioId, columnId: string, title: string): Result<AppDocument> {
  const name = title.trim()
  if (!name) return fail('A coluna precisa de um nome.')
  const column = doc.columns.find((item) => item.id === columnId && item.scenarioId === scenarioId)
  if (!column) return fail('Coluna não encontrada.')
  const columns = doc.columns.map((item) => (item === column ? { ...item, title: name } : item))
  return { ok: true, value: commit({ ...doc, columns }, {}, 'renomear-coluna', name) }
}

export function addColumn(doc: AppDocument, scenarioId: ScenarioId, title: string): Result<AppDocument> {
  const name = title.trim()
  if (!name) return fail('A coluna precisa de um nome.')
  const order = scenarioColumns(doc, scenarioId).reduce((max, column) => Math.max(max, column.order), -1) + 1
  const column = { id: uid('col'), scenarioId, title: name, order, width: 360, kind: 'workflow' as const, roleId: null }
  return { ok: true, value: commit({ ...doc, columns: [...doc.columns, column] }, {}, 'nova-coluna', name) }
}

export function addRoleColumn(doc: AppDocument, roleId: string): Result<AppDocument> {
  const role = doc.roles.find((item) => item.id === roleId)
  if (!role) return fail('Cargo não encontrado.')
  if (doc.columns.some((column) => column.scenarioId === role.scenarioId && column.roleId === roleId)) {
    return { ok: true, value: doc }
  }
  if (doc.columns.some((column) => column.id === roleColumnId(roleId))) {
    return fail('Já existe uma coluna com este id.')
  }
  const order = scenarioColumns(doc, role.scenarioId).reduce((max, column) => Math.max(max, column.order), -1) + 1
  const column = makeRoleColumn(role.scenarioId, roleId, role.title, order)
  return { ok: true, value: commit({ ...doc, columns: [...doc.columns, column] }, {}, 'coluna-cargo', role.title) }
}

export function resizeColumn(doc: AppDocument, scenarioId: ScenarioId, columnId: string, width: number): Result<AppDocument> {
  const column = doc.columns.find((item) => item.id === columnId && item.scenarioId === scenarioId)
  if (!column) return fail('Coluna não encontrada.')
  const next = clampColumnWidth(width)
  const columns = doc.columns.map((item) => (item === column ? { ...item, width: next } : item))
  return { ok: true, value: commit({ ...doc, columns }, {}, 'largura-coluna', column.title) }
}

export function removeColumn(doc: AppDocument, scenarioId: ScenarioId, columnId: string): Result<AppDocument> {
  const columns = scenarioColumns(doc, scenarioId)
  if (columns.length <= 1) return fail('O quadro precisa de uma coluna.')
  const index = columns.findIndex((column) => column.id === columnId)
  if (index < 0) return fail('Coluna não encontrada.')
  const fallback = columns[index - 1] ?? columns[index + 1]
  const tasks = doc.tasks.map((task) => (
    task.scenarioId === scenarioId && task.status === columnId ? { ...task, status: fallback.id } : task
  ))
  return {
    ok: true,
    value: commit(
      { ...doc, tasks, columns: doc.columns.filter((column) => !(column.scenarioId === scenarioId && column.id === columnId)) },
      {},
      'remover-coluna',
      columns[index].title,
    ),
  }
}

export function createGoal(
  doc: AppDocument,
  scenarioId: ScenarioId,
  title: string,
  indicator: string,
  baseline: number,
  target: number,
): Result<AppDocument> {
  const name = title.trim()
  if (!name || !indicator.trim()) return fail('Meta precisa de título e indicador.')
  const goal = {
    id: uid('goal'),
    scenarioId,
    title: name,
    indicator: indicator.trim(),
    baseline,
    target,
    progress: baseline,
    source: 'cadastro local',
  }
  return { ok: true, value: commit({ ...doc, goals: [...doc.goals, goal] }, {}, 'meta', name) }
}

export function updateGoalProgress(doc: AppDocument, goalId: string, progress: number): Result<AppDocument> {
  if (!doc.goals.some((goal) => goal.id === goalId)) return fail('Meta não encontrada.')
  const goals = doc.goals.map((goal) => (goal.id === goalId ? { ...goal, progress } : goal))
  return { ok: true, value: commit({ ...doc, goals }, {}, 'progresso', String(progress)) }
}

export function createInitiative(doc: AppDocument, scenarioId: ScenarioId, title: string, goalId: string | null): Result<AppDocument> {
  const name = title.trim()
  if (!name) return fail('A iniciativa precisa de um título.')
  if (goalId && !doc.goals.some((goal) => goal.id === goalId && goal.scenarioId === scenarioId)) {
    return fail('A meta não está neste cenário.')
  }
  const initiative = { id: uid('init'), scenarioId, goalId, title: name }
  return { ok: true, value: commit({ ...doc, initiatives: [...doc.initiatives, initiative] }, {}, 'iniciativa', name) }
}

export interface DiffRow {
  id: string
  label: string
  change: string
}

export function diffScenarios(doc: AppDocument, source: ScenarioId, target: ScenarioId): DiffRow[] {
  const areaTitle = (id: string) => doc.areas.find((area) => area.id === id)?.title ?? 'Sem área'
  const key = (role: AppDocument['roles'][number]) => `${areaTitle(role.areaId).toLowerCase()}::${role.title.toLowerCase()}`
  const targetKeys = new Set(scenarioRoles(doc, target).map(key))
  return scenarioRoles(doc, source)
    .filter((role) => !targetKeys.has(key(role)))
    .map((role) => ({ id: role.id, label: role.title, change: `Só em ${source} · ${areaTitle(role.areaId)}` }))
}

export function copyRolesToScenario(
  doc: AppDocument,
  source: ScenarioId,
  target: ScenarioId,
  roleIds: string[],
  includeTasks: boolean,
): Result<AppDocument> {
  const selected = new Set(roleIds)
  const roles = doc.roles.filter((role) => role.scenarioId === source && selected.has(role.id))
  if (roles.length === 0) return fail('Selecione ao menos um cargo.')
  const idMap = new Map(roles.map((role) => [role.id, uid('role')]))
  const areaMap = new Map<string, string>()
  const areas = [...doc.areas]
  for (const role of roles) {
    const area = doc.areas.find((item) => item.id === role.areaId)
    if (!area || areaMap.has(area.id)) continue
    const existing = areas.find((item) => item.scenarioId === target && item.title === area.title)
    if (existing) {
      areaMap.set(area.id, existing.id)
    } else {
      const copy = { ...area, id: uid('area'), scenarioId: target }
      areaMap.set(area.id, copy.id)
      areas.push(copy)
    }
  }
  const copiedRoles = roles.map((role) => ({
    ...role,
    id: idMap.get(role.id)!,
    scenarioId: target,
    areaId: areaMap.get(role.areaId) ?? role.areaId,
    source: `${role.source} · copiado de ${source}`,
  }))
  const relations = doc.relations
    .filter((relation) => relation.scenarioId === source && idMap.has(relation.fromRoleId) && idMap.has(relation.toRoleId))
    .map((relation) => ({
      ...relation,
      id: uid('rel'),
      scenarioId: target,
      fromRoleId: idMap.get(relation.fromRoleId)!,
      toRoleId: idMap.get(relation.toRoleId)!,
    }))
  const responsibilities = doc.responsibilities
    .filter((item) => item.roleId && idMap.has(item.roleId))
    .map((item) => ({ ...item, id: uid('resp'), scenarioId: target, roleId: idMap.get(item.roleId!)! }))
  const tasks = includeTasks
    ? doc.tasks
        .filter((task) => task.scenarioId === source && task.roleId && idMap.has(task.roleId))
        .map((task) => ({
          ...task,
          id: uid('task'),
          scenarioId: target,
          roleId: idMap.get(task.roleId!)!,
          origin: 'local' as const,
          externalId: '',
        }))
    : []
  const next = {
    ...doc,
    areas,
    roles: [...doc.roles, ...copiedRoles],
    relations: [...doc.relations, ...relations],
    responsibilities: [...doc.responsibilities, ...responsibilities],
    tasks: [...doc.tasks, ...tasks],
  }
  if (hasCycle(next, target)) return fail('A cópia criaria um ciclo.')
  return { ok: true, value: commit(next, {}, 'aplicar-cenario', `${roles.length} cargos → ${target}`) }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseDocument(raw: unknown): Result<AppDocument> {
  if (!isRecord(raw) || raw.version !== 1) return fail('JSON precisa ser um documento versionado (version: 1).')
  const arrays = ['areas', 'roles', 'people', 'assignments', 'relations', 'bands', 'placements', 'fields', 'values', 'responsibilities', 'goals', 'initiatives', 'tasks', 'connections', 'audit'] as const
  for (const key of arrays) {
    if (!Array.isArray(raw[key])) return fail(`Lista ausente: ${key}.`)
  }
  if (raw.columns !== undefined && !Array.isArray(raw.columns)) return fail('Lista ausente: columns.')
  if (typeof raw.revision !== 'number') return fail('Revisão inválida.')
  const withBlocks = {
    ...raw,
    tasks: (raw.tasks as TaskItem[]).map((task) => ({
      ...task,
      blocks: Array.isArray(task.blocks) ? task.blocks : defaultTaskBlocks(task.id),
    })),
  } as unknown as AppDocument
  const doc = ensureRoleColumns(ensureCanonicalAreas(ensureBoardColumns(withBlocks)))
  const roleIds = doc.roles.map((role) => role.id)
  if (new Set(roleIds).size !== roleIds.length) return fail('Há cargos com id repetido.')
  for (const scenarioId of ['atual', 'planejada'] as const) {
    if (hasCycle(doc, scenarioId)) return fail(`Ciclo hierárquico em ${scenarioId}.`)
  }
  return { ok: true, value: doc }
}

export function replaceDocument(current: AppDocument, raw: unknown): Result<AppDocument> {
  const parsed = parseDocument(raw)
  if (!parsed.ok) return parsed
  const imported = { ...parsed.value, revision: Math.max(current.revision, parsed.value.revision) + 1 }
  return { ok: true, value: imported }
}

const memory = new Map<string, AppDocument>()

export function resetAgentMemory(): void {
  memory.clear()
}

export function applyAgentWrite(doc: AppDocument, write: AgentWrite): Result<AppDocument> {
  const cached = memory.get(write.idempotencyKey)
  if (cached) return { ok: true, value: cached }
  if (write.expectedRevision !== doc.revision) {
    return fail(`Conflito de revisão: esperado ${write.expectedRevision}, atual ${doc.revision}.`)
  }
  let next = doc
  for (const op of write.ops) {
    if (op.type === 'rename-role') {
      if (!op.roleId || !op.title) return fail('rename-role exige roleId e title.')
      const renamed = updateRole(next, op.roleId, { title: op.title })
      if (!renamed.ok) return renamed
      next = renamed.value
    } else if (op.type === 'create-task') {
      if (!op.title) return fail('create-task exige title.')
      const created = createTask(next, op.scenarioId, { title: op.title, description: op.description ?? '', origin: 'mcp' })
      if (!created.ok) return created
      next = created.value
    } else {
      return fail('Operação desconhecida.')
    }
  }
  memory.set(write.idempotencyKey, next)
  return { ok: true, value: next }
}
