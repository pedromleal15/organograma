import type { AppDocument, Board, BoardColumn, ScenarioId } from './types'

const STARTERS = [
  { id: 'todo', title: 'A fazer' },
  { id: 'doing', title: 'Em andamento' },
  { id: 'blocked', title: 'Bloqueada' },
  { id: 'done', title: 'Concluída' },
] as const

export function defaultBoardId(scenarioId: ScenarioId) {
  return scenarioId === 'atual' ? 'board-atual' : 'board-planejada'
}

export function starterBoard(scenarioId: ScenarioId): Board {
  return {
    id: defaultBoardId(scenarioId),
    scenarioId,
    title: 'Quadro principal',
    order: 0,
  }
}

export function starterColumns(scenarioId: ScenarioId, boardId = defaultBoardId(scenarioId)): BoardColumn[] {
  const prefix = boardId === defaultBoardId(scenarioId) ? '' : `${boardId}-`
  return STARTERS.map((column, order) => ({
    id: `${prefix}${column.id}`,
    scenarioId,
    title: column.title,
    order,
    width: 360,
    kind: 'workflow' as const,
    roleId: null,
    boardId,
  }))
}

export function roleColumnId(roleId: string) {
  return `col-${roleId}`
}

export function makeRoleColumn(
  scenarioId: ScenarioId,
  roleId: string,
  title: string,
  order: number,
  boardId = defaultBoardId(scenarioId),
): BoardColumn {
  return {
    id: roleColumnId(roleId),
    scenarioId,
    title,
    order,
    width: 360,
    kind: 'role',
    roleId,
    boardId,
  }
}

export function scenarioColumns(doc: AppDocument, scenarioId: ScenarioId, boardId?: string | null) {
  return doc.columns
    .filter((column) => column.scenarioId === scenarioId && (!boardId || column.boardId === boardId || (!column.boardId && boardId === defaultBoardId(scenarioId))))
    .sort((a, b) => a.order - b.order)
}

export function scenarioBoards(doc: AppDocument, scenarioId: ScenarioId) {
  return (doc.boards ?? []).filter((board) => board.scenarioId === scenarioId).sort((a, b) => a.order - b.order)
}

/** Normaliza colunas legadas sem kind/roleId/boardId. */
export function ensureColumnKinds(doc: AppDocument): AppDocument {
  const columns = (doc.columns ?? []).map((column) => ({
    ...column,
    kind: column.kind ?? (column.roleId ? 'role' as const : 'workflow' as const),
    roleId: column.roleId ?? null,
    boardId: column.boardId ?? defaultBoardId(column.scenarioId),
  }))
  return { ...doc, columns }
}

export function ensureDefaultBoards(doc: AppDocument): AppDocument {
  const boards = [...(doc.boards ?? [])]
  const extra: Board[] = []
  for (const scenarioId of ['atual', 'planejada'] as const) {
    if (boards.some((board) => board.scenarioId === scenarioId)) continue
    extra.push(starterBoard(scenarioId))
  }
  if (extra.length === 0) return { ...doc, boards }
  return { ...doc, boards: [...boards, ...extra] }
}

/** Garante colunas de workflow se o cenário ainda não tem quadro. */
export function ensureBoardColumns(doc: AppDocument): AppDocument {
  const withBoards = ensureDefaultBoards(ensureColumnKinds(doc))
  const current = withBoards.columns
  const extra: BoardColumn[] = []
  for (const scenarioId of ['atual', 'planejada'] as const) {
    if (current.some((column) => column.scenarioId === scenarioId)) continue
    extra.push(...starterColumns(scenarioId))
  }
  if (extra.length === 0) return withBoards
  return { ...withBoards, columns: [...current, ...extra] }
}

/** Garante coluna role do CEO (e de qualquer roleId passado) se o cargo existir. */
export function ensureRoleColumns(doc: AppDocument, roleIds: string[] = ['role-ceo', 'plan-ceo']): AppDocument {
  const base = ensureBoardColumns(doc)
  const extra: BoardColumn[] = []
  for (const roleId of roleIds) {
    const role = base.roles.find((item) => item.id === roleId)
    if (!role) continue
    if (base.columns.some((column) => column.scenarioId === role.scenarioId && column.roleId === roleId)) continue
    if (base.columns.some((column) => column.id === roleColumnId(roleId))) continue
    const boardId = defaultBoardId(role.scenarioId)
    const order = scenarioColumns(base, role.scenarioId, boardId).reduce((max, column) => Math.max(max, column.order), -1) + 1
    extra.push(makeRoleColumn(role.scenarioId, roleId, role.title, order, boardId))
  }
  if (extra.length === 0) return base
  return { ...base, columns: [...base.columns, ...extra] }
}

export function clampColumnWidth(width: number) {
  if (!Number.isFinite(width)) return 360
  return Math.min(480, Math.max(340, Math.round(width)))
}
