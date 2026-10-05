import dagre from '@dagrejs/dagre'
import type { AppDocument, RelationKind, ScenarioId } from './types'

export const NODE_WIDTH = 248
export const NODE_HEIGHT = 112

export interface LayoutNode {
  id: string
  x: number
  y: number
  width: number
  height: number
}

export interface LayoutEdge {
  id: string
  source: string
  target: string
  kind: RelationKind
}

export function layoutScenario(doc: AppDocument, scenarioId: ScenarioId): { nodes: LayoutNode[]; edges: LayoutEdge[] } {
  const roles = doc.roles.filter((role) => role.scenarioId === scenarioId)
  const relations = doc.relations.filter((relation) => relation.scenarioId === scenarioId)
  const hidden = collapsedIds(roles.map((role) => role.id), relations, roles.filter((role) => role.collapsed).map((role) => role.id))
  const visible = roles.filter((role) => !hidden.has(role.id))
  const visibleIds = new Set(visible.map((role) => role.id))
  const lateral = new Set(
    relations
      .filter((relation) => relation.kind === 'assistant' && visibleIds.has(relation.fromRoleId) && visibleIds.has(relation.toRoleId))
      .map((relation) => relation.fromRoleId),
  )
  const graph = new dagre.graphlib.Graph()
  graph.setDefaultEdgeLabel(() => ({}))
  graph.setGraph({ rankdir: 'TB', nodesep: 40, ranksep: 84, marginx: 32, marginy: 32 })
  for (const role of visible) {
    if (!lateral.has(role.id)) graph.setNode(role.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  }
  const edges: LayoutEdge[] = []
  for (const relation of relations) {
    if (!visibleIds.has(relation.fromRoleId) || !visibleIds.has(relation.toRoleId)) continue
    edges.push({ id: relation.id, source: relation.toRoleId, target: relation.fromRoleId, kind: relation.kind })
    if (relation.kind === 'direct' && !lateral.has(relation.fromRoleId)) {
      graph.setEdge(relation.toRoleId, relation.fromRoleId)
    }
  }
  if (graph.nodes().length > 0) dagre.layout(graph)
  const nodes: LayoutNode[] = visible
    .filter((role) => !lateral.has(role.id))
    .map((role) => {
      const position = graph.node(role.id)
      return {
        id: role.id,
        x: (position?.x ?? 0) - NODE_WIDTH / 2,
        y: (position?.y ?? 0) - NODE_HEIGHT / 2,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
      }
    })
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const assistantCount = new Map<string, number>()
  for (const relation of relations) {
    if (relation.kind !== 'assistant' || !visibleIds.has(relation.fromRoleId)) continue
    const parent = byId.get(relation.toRoleId)
    if (!parent) continue
    const index = assistantCount.get(parent.id) ?? 0
    assistantCount.set(parent.id, index + 1)
    const child: LayoutNode = {
      id: relation.fromRoleId,
      x: parent.x + NODE_WIDTH + 36,
      y: parent.y + index * (NODE_HEIGHT + 16),
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    }
    nodes.push(child)
    byId.set(child.id, child)
  }
  return { nodes, edges }
}

function collapsedIds(
  ids: string[],
  relations: { fromRoleId: string; toRoleId: string; kind: RelationKind }[],
  collapsed: string[],
): Set<string> {
  const children = new Map<string, string[]>()
  for (const id of ids) children.set(id, [])
  for (const relation of relations) {
    if (relation.kind === 'functional') continue
    children.get(relation.toRoleId)?.push(relation.fromRoleId)
  }
  const hidden = new Set<string>()
  const stack = collapsed.flatMap((id) => children.get(id) ?? [])
  while (stack.length > 0) {
    const id = stack.pop()
    if (!id || hidden.has(id)) continue
    hidden.add(id)
    stack.push(...(children.get(id) ?? []))
  }
  return hidden
}

export function syntheticTree(count: number): AppDocument {
  const roles = Array.from({ length: count }, (_, index) => ({
    id: `s-${index}`,
    scenarioId: 'atual' as const,
    areaId: 'area',
    title: `Cargo ${index}`,
    status: 'proposal' as const,
    source: 'sintético',
    sourceDate: '2026-10-04',
    note: '',
    collapsed: false,
  }))
  const relations = roles.slice(1).map((role, index) => ({
    id: `e-${index}`,
    scenarioId: 'atual' as const,
    fromRoleId: role.id,
    toRoleId: `s-${Math.floor(index / 3)}`,
    kind: 'direct' as const,
  }))
  return {
    version: 1,
    revision: 1,
    areas: [{ id: 'area', scenarioId: 'atual', title: 'Sintético', order: 0 }],
    roles,
    people: [],
    assignments: [],
    relations,
    bands: [],
    placements: [],
    fields: [],
    values: [],
    responsibilities: [],
    goals: [],
    initiatives: [],
    tasks: [],
    boards: [],
    columns: [],
    connections: [],
    audit: [],
  }
}
