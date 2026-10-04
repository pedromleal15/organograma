export type ScenarioId = 'atual' | 'planejada'

export type RoleStatus = 'active' | 'away' | 'open' | 'proposal'

export type RelationKind = 'direct' | 'functional' | 'assistant'

export type FieldType = 'text' | 'number' | 'select' | 'date' | 'checkbox'

export type TaskStatus = string

export type Priority = 'low' | 'medium' | 'high'

export type Origin = 'local' | 'github' | 'google-tasks' | 'mcp'

export interface Area {
  id: string
  scenarioId: ScenarioId
  title: string
  order: number
}

export interface Role {
  id: string
  scenarioId: ScenarioId
  areaId: string
  title: string
  status: RoleStatus
  source: string
  sourceDate: string
  note: string
  collapsed: boolean
}

export interface Person {
  id: string
  name: string
}

export interface Assignment {
  id: string
  scenarioId: ScenarioId
  roleId: string
  personId: string
}

export interface Relation {
  id: string
  scenarioId: ScenarioId
  fromRoleId: string
  toRoleId: string
  kind: RelationKind
}

export interface Band {
  id: string
  scenarioId: ScenarioId
  axis: 'row' | 'column'
  title: string
  order: number
}

export interface Placement {
  id: string
  scenarioId: ScenarioId
  roleId: string
  rowBandId: string | null
  columnBandId: string | null
  order: number
}

export interface CustomField {
  id: string
  scenarioId: ScenarioId
  name: string
  type: FieldType
  options: string[]
}

export interface FieldValue {
  id: string
  roleId: string
  fieldId: string
  value: string
}

export interface Responsibility {
  id: string
  scenarioId: ScenarioId
  roleId: string | null
  text: string
  pendingAssignment: boolean
}

export interface Goal {
  id: string
  scenarioId: ScenarioId
  title: string
  indicator: string
  baseline: number
  target: number
  progress: number
  source: string
}

export interface Initiative {
  id: string
  scenarioId: ScenarioId
  goalId: string | null
  title: string
}

export interface BoardColumn {
  id: string
  scenarioId: ScenarioId
  title: string
  order: number
  width: number
}

export interface ChecklistItem {
  id: string
  text: string
  done: boolean
}

export interface TaskLink {
  label: string
  href: string
}

export type TaskBlockKind = 'tools' | 'objective' | 'context' | 'text'

export interface TaskBlock {
  id: string
  kind: TaskBlockKind
  title: string
  text: string
  width: number
  height: number
}

export interface TaskItem {
  id: string
  scenarioId: ScenarioId
  title: string
  description: string
  status: TaskStatus
  priority: Priority
  due: string
  roleId: string | null
  personId: string | null
  initiativeId: string | null
  goalId: string | null
  checklist: ChecklistItem[]
  blocks: TaskBlock[]
  links: TaskLink[]
  origin: Origin
  externalId: string
  pendingAssignment: boolean
}

export interface Connection {
  id: string
  kind: 'github' | 'google-tasks' | 'mcp'
  label: string
  endpoint: string
  status: 'pendente' | 'autorizada' | 'erro' | 'indisponivel'
  detail: string
}

export interface AuditEntry {
  id: string
  at: string
  action: string
  detail: string
}

export interface AppDocument {
  version: 1
  revision: number
  areas: Area[]
  roles: Role[]
  people: Person[]
  assignments: Assignment[]
  relations: Relation[]
  bands: Band[]
  placements: Placement[]
  fields: CustomField[]
  values: FieldValue[]
  responsibilities: Responsibility[]
  goals: Goal[]
  initiatives: Initiative[]
  tasks: TaskItem[]
  columns: BoardColumn[]
  connections: Connection[]
  audit: AuditEntry[]
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string }

export interface AgentOp {
  type: 'rename-role' | 'create-task'
  scenarioId: ScenarioId
  roleId?: string
  title?: string
  description?: string
}

export interface AgentWrite {
  idempotencyKey: string
  expectedRevision: number
  proposalId: string
  ops: AgentOp[]
}
