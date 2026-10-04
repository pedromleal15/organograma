import { createContext, useContext, useEffect, useMemo } from 'react'
import {
  Background,
  BackgroundVariant,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useStore as useFlowStore,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { layoutScenario } from '../domain/layout'
import { updateRole } from '../domain/rules'
import type { AppDocument, Role, ScenarioId } from '../domain/types'
import { useStore } from '../state'

interface RoleData extends Record<string, unknown> {
  role: Role
  area: string
  occupant: string
  reports: number
  dimmed: boolean
}

interface LaneData extends Record<string, unknown> {
  title: string
  count: number
  scenarioId: ScenarioId
  columnId: string
}

const LaneClickContext = createContext<(columnId: string) => void>(() => {})

function RoleNode({ data, selected }: NodeProps<Node<RoleData, 'role'>>) {
  const store = useStore()
  const status = data.role.status
  return (
    <article className={`role-card${selected ? ' is-selected' : ''}${data.dimmed ? ' is-dimmed' : ''}${status === 'open' ? ' is-open' : ''}`}>
      <Handle type="target" position={Position.Top} />
      <div className="kicker">
        <span>{data.area}</span>
        <span><i className={`status-dot ${status}`} /> {labelStatus(status)}</span>
      </div>
      <h3>{data.role.title}</h3>
      <p>{data.occupant || 'Sem ocupante'}</p>
      <div className="card-foot">
        <span>{data.reports} diretos</span>
        <button
          className="linkish"
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            store.apply(updateRole(store.document, data.role.id, { collapsed: !data.role.collapsed }))
          }}
        >
          {data.role.collapsed ? 'Expandir' : 'Recolher'}
        </button>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </article>
  )
}

function LaneNode({ data }: NodeProps<Node<LaneData, 'lane'>>) {
  const openLane = useContext(LaneClickContext)
  return (
    <button
      className="lane-node"
      type="button"
      onClick={() => openLane(data.columnId)}
    >
      <Handle type="target" position={Position.Left} />
      <strong>{data.title}</strong>
      <span>{data.count} {data.count === 1 ? 'tarefa' : 'tarefas'}</span>
      <Handle type="source" position={Position.Right} />
    </button>
  )
}

const nodeTypes = { role: RoleNode, lane: LaneNode }

function CanvasInner({ document, scenarioId, search, selectedRoleId, onLaneNodeClick }: { document: AppDocument; scenarioId: ScenarioId; search: string; selectedRoleId: string; onLaneNodeClick: (columnId: string) => void }) {
  const store = useStore()
  const flow = useReactFlow()
  const graph = useMemo(() => layoutScenario(document, scenarioId), [document, scenarioId])
  const query = search.trim().toLocaleLowerCase('pt-BR')
  const chain = useMemo(() => ancestorChain(document, scenarioId, selectedRoleId), [document, scenarioId, selectedRoleId])

  const lanes = document.columns.filter((column) => column.scenarioId === scenarioId).sort((a, b) => a.order - b.order)
  const laneNodes: Node<LaneData, 'lane'>[] = lanes.map((column, index) => ({
    id: `lane-${scenarioId}-${column.id}`,
    type: 'lane',
    position: { x: index * 240, y: -220 },
    data: {
      title: column.title,
      count: document.tasks.filter((task) => task.scenarioId === scenarioId && task.status === column.id).length,
      scenarioId,
      columnId: column.id,
    },
    draggable: false,
    selectable: false,
  }))
  const laneEdges: Edge[] = lanes.slice(1).map((column, index) => ({
    id: `lane-edge-${scenarioId}-${lanes[index].id}-${column.id}`,
    source: `lane-${scenarioId}-${lanes[index].id}`,
    target: `lane-${scenarioId}-${column.id}`,
    type: 'smoothstep',
    style: { stroke: '#2f6bff', strokeWidth: 1.4 },
  }))

  const nodes: Node<RoleData, 'role'>[] = graph.nodes.map((node) => {
    const role = document.roles.find((item) => item.id === node.id)!
    const area = document.areas.find((item) => item.id === role.areaId)?.title ?? ''
    const personId = document.assignments.find((item) => item.roleId === role.id && item.scenarioId === scenarioId)?.personId
    const occupant = document.people.find((person) => person.id === personId)?.name ?? ''
    const reports = document.relations.filter((relation) => relation.toRoleId === role.id && relation.kind === 'direct' && relation.scenarioId === scenarioId).length
    const blob = `${role.title} ${area} ${occupant}`.toLocaleLowerCase('pt-BR')
    const missesSearch = Boolean(query) && !blob.includes(query)
    const outsideChain = Boolean(selectedRoleId) && !chain.has(role.id)
    return {
      id: role.id,
      type: 'role',
      position: { x: node.x, y: node.y },
      data: { role, area, occupant, reports, dimmed: missesSearch || outsideChain },
      selected: role.id === selectedRoleId,
      draggable: false,
    }
  })

  const edges: Edge[] = [...laneEdges, ...graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: 'smoothstep',
    style: {
      stroke: '#2f6bff',
      strokeWidth: 1.4,
      strokeDasharray: edge.kind === 'functional' ? '6 4' : undefined,
    },
  }))]

  useEffect(() => {
    flow.fitView({ padding: 0.2, duration: 0, maxZoom: 1 })
  }, [flow, scenarioId, lanes.length])

  return (
    <LaneClickContext.Provider value={onLaneNodeClick}>
    <div className="canvas-wrap" role="tree" aria-label="Cargos no organograma">
      <ReactFlow
        nodes={[...laneNodes, ...nodes]}
        edges={edges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        onNodeClick={(_, node) => {
          if (node.type !== 'lane') store.setSelectedRoleId(node.id)
        }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.2}
        maxZoom={1.6}
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1.2} color="#c8ccd2" />
        <MiniMap pannable zoomable maskColor="rgba(238,240,242,0.72)" nodeColor={() => '#2f6bff'} style={{ background: '#ffffff' }} />
      </ReactFlow>
      <ZoomDock />
    </div>
    </LaneClickContext.Provider>
  )
}

function ZoomDock() {
  const flow = useReactFlow()
  const zoom = Math.round(useFlowStore((state) => state.transform[2]) * 100)
  return (
    <div className="zoom-dock" aria-label="Zoom do canvas">
      <button className="icon-button" type="button" onClick={() => flow.zoomOut()}>−</button>
      <span>{zoom}%</span>
      <button className="icon-button" type="button" onClick={() => flow.zoomIn()}>+</button>
      <button className="ghost" type="button" onClick={() => flow.fitView({ padding: 0.2, maxZoom: 1 })}>Ajustar</button>
    </div>
  )
}

function ancestorChain(document: AppDocument, scenarioId: ScenarioId, roleId: string) {
  const chain = new Set<string>()
  let cursor = roleId
  const guard = new Set<string>()
  while (cursor && !guard.has(cursor)) {
    chain.add(cursor)
    guard.add(cursor)
    cursor = document.relations.find((relation) => relation.scenarioId === scenarioId && relation.fromRoleId === cursor && relation.kind !== 'functional')?.toRoleId ?? ''
  }
  return chain
}

function labelStatus(status: Role['status']) {
  if (status === 'active') return 'Ativo'
  if (status === 'away') return 'Férias'
  if (status === 'open') return 'Vaga'
  return 'Proposta'
}

export function OrgCanvas(props: { document: AppDocument; scenarioId: ScenarioId; search: string; selectedRoleId: string; onLaneNodeClick: (columnId: string) => void }) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  )
}
