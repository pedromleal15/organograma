import type { AppDocument, BoardColumn, ScenarioId } from './types'

const STARTERS = [
  { id: 'todo', title: 'A fazer' },
  { id: 'doing', title: 'Em andamento' },
  { id: 'blocked', title: 'Bloqueada' },
  { id: 'done', title: 'Concluída' },
] as const

export function starterColumns(scenarioId: ScenarioId): BoardColumn[] {
  return STARTERS.map((column, order) => ({
    id: column.id,
    scenarioId,
    title: column.title,
    order,
    width: 360,
  }))
}

export function scenarioColumns(doc: AppDocument, scenarioId: ScenarioId) {
  return doc.columns.filter((column) => column.scenarioId === scenarioId).sort((a, b) => a.order - b.order)
}

/** Preenche as quatro colunas só quando o cenário ainda não tem quadro. */
export function ensureBoardColumns(doc: AppDocument): AppDocument {
  const current = doc.columns ?? []
  const extra: BoardColumn[] = []
  for (const scenarioId of ['atual', 'planejada'] as const) {
    if (current.some((column) => column.scenarioId === scenarioId)) continue
    extra.push(...starterColumns(scenarioId))
  }
  if (extra.length === 0) return { ...doc, columns: current }
  return { ...doc, columns: [...current, ...extra] }
}

export function clampColumnWidth(width: number) {
  if (!Number.isFinite(width)) return 360
  return Math.min(480, Math.max(340, Math.round(width)))
}
