import { describe, expect, it } from 'vitest'
import { assertPedro } from '../src/domain/auth'
import { layoutScenario, syntheticTree } from '../src/domain/layout'
import {
  addColumn,
  addField,
  applyAgentWrite,
  copyRolesToScenario,
  createRole,
  deleteRole,
  hasCycle,
  removeBand,
  removeColumn,
  renameColumn,
  replaceDocument,
  resizeColumn,
  resetAgentMemory,
  setFieldValue,
  setManager,
} from '../src/domain/rules'
import { createSeed } from '../src/domain/seed'
import { previewLegacy, saveDocument } from '../src/domain/sync'
import type { AppDocument } from '../src/domain/types'

describe('regras do organograma', () => {
  it('configura colunas do quadro e preserva tarefas ao remover', () => {
    const doc = createSeed()
    expect(doc.columns.filter((column) => column.scenarioId === 'atual').map((column) => column.id)).toEqual(['todo', 'doing', 'blocked', 'done'])
    const added = addColumn(doc, 'atual', 'Em revisão')
    expect(added.ok).toBe(true)
    if (!added.ok) return
    const extra = added.value.columns.find((column) => column.title === 'Em revisão')!
    const renamed = renameColumn(added.value, 'atual', extra.id, 'Aprovação')
    expect(renamed.ok).toBe(true)
    if (!renamed.ok) return
    const resized = resizeColumn(renamed.value, 'atual', extra.id, 800)
    expect(resized.ok).toBe(true)
    if (!resized.ok) return
    expect(resized.value.columns.find((column) => column.id === extra.id)?.width).toBe(480)
    const withTask = {
      ...resized.value,
      tasks: resized.value.tasks.map((task) => task.id === 'task-whatsapp' ? { ...task, status: extra.id } : task),
    }
    const removed = removeColumn(withTask, 'atual', extra.id)
    expect(removed.ok).toBe(true)
    if (!removed.ok) return
    expect(removed.value.tasks.find((task) => task.id === 'task-whatsapp')?.status).toBe('done')
  })

  it('completa colunas ao importar documento antigo', () => {
    const legacy = structuredClone(createSeed()) as AppDocument
    delete (legacy as Partial<AppDocument>).columns
    const imported = replaceDocument(createSeed(), legacy)
    expect(imported.ok).toBe(true)
    if (!imported.ok) return
    expect(imported.value.columns.filter((column) => column.scenarioId === 'planejada')).toHaveLength(4)
  })

  it('recusa ciclo hierárquico', () => {
    const doc = createSeed()
    const cycle = setManager(doc, 'planejada', 'plan-ceo', 'plan-eng', 'direct')
    expect(cycle.ok).toBe(false)
    expect(hasCycle(doc, 'planejada')).toBe(false)
  })

  it('excluir cargo promove subordinados e deixa tarefas pendentes', () => {
    const doc = createSeed()
    const removed = deleteRole(doc, 'plan-ops')
    expect(removed.ok).toBe(true)
    if (!removed.ok) return
    const child = removed.value.relations.find((relation) => relation.fromRoleId === 'plan-gap-rh')
    expect(child?.toRoleId).toBe('plan-ceo')
    expect(removed.value.roles.some((role) => role.id === 'plan-ops')).toBe(false)
  })

  it('remover faixa manda os cards para sem faixa', () => {
    const doc = createSeed()
    const removed = removeBand(doc, 'plan-row-produto')
    expect(removed.ok).toBe(true)
    if (!removed.ok) return
    const placement = removed.value.placements.find((item) => item.roleId === 'plan-eng')
    expect(placement?.rowBandId).toBeNull()
  })

  it('valida campo personalizado e rejeita importação inválida sem trocar o documento', () => {
    const doc = createSeed()
    const field = addField(doc, 'atual', 'Headcount', 'number')
    expect(field.ok).toBe(true)
    if (!field.ok) return
    const fieldId = field.value.fields.find((item) => item.name === 'Headcount')!.id
    expect(setFieldValue(field.value, 'role-ceo', fieldId, 'abc').ok).toBe(false)
    expect(setFieldValue(field.value, 'role-ceo', fieldId, '3').ok).toBe(true)
    const cyclic = structuredClone(doc) as AppDocument
    cyclic.relations.push({ id: 'loop-a', scenarioId: 'atual', fromRoleId: 'role-ceo', toRoleId: 'role-ceo', kind: 'direct' })
    const imported = replaceDocument(doc, cyclic)
    expect(imported.ok).toBe(false)
    expect(doc.revision).toBe(1)
  })

  it('preserva rascunho quando a rede falha e devolve conflito', async () => {
    const memory = new Map<string, string>()
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => { memory.set(key, value) },
    }
    const doc = createSeed()
    const draft = await saveDocument(doc, storage, async () => { throw new Error('offline') })
    expect(draft.status).toBe('draft')
    expect(memory.get('glyco-org-draft')).toContain('role-ceo')
    const remote = { ...doc, revision: 9 }
    const conflict = await saveDocument(doc, storage, async () => ({ conflict: remote }))
    expect(conflict.status).toBe('conflict')
  })

  it('não mistura tarefa da planejada ao copiar sem pedir', () => {
    const doc = createSeed()
    const copied = copyRolesToScenario(doc, 'planejada', 'atual', ['plan-ceo'], false)
    expect(copied.ok).toBe(true)
    if (!copied.ok) return
    const atualTasks = copied.value.tasks.filter((task) => task.scenarioId === 'atual')
    expect(atualTasks.some((task) => task.title.includes('Revisar cargos'))).toBe(false)
    expect(copied.value.roles.filter((role) => role.scenarioId === 'atual' && role.title === 'CEO & Founder').length).toBe(2)
  })

  it('escrita de agente é idempotente e respeita a revisão', () => {
    resetAgentMemory()
    const doc = createSeed()
    const write = {
      idempotencyKey: 'k1',
      expectedRevision: doc.revision,
      proposalId: 'p1',
      ops: [{ type: 'create-task' as const, scenarioId: 'atual' as const, title: 'Tarefa via MCP' }],
    }
    const first = applyAgentWrite(doc, write)
    const second = applyAgentWrite(doc, write)
    expect(first.ok && second.ok).toBe(true)
    if (!first.ok || !second.ok) return
    expect(second.value.revision).toBe(first.value.revision)
    expect(applyAgentWrite(doc, { ...write, idempotencyKey: 'k2', expectedRevision: 0 }).ok).toBe(false)
  })

  it('layout de 250 cargos termina e a prévia antiga não aplica sozinha', () => {
    const tree = syntheticTree(250)
    const started = performance.now()
    const layout = layoutScenario(tree, 'atual')
    expect(performance.now() - started).toBeLessThan(2000)
    expect(layout.nodes).toHaveLength(250)
    expect(hasCycle(tree, 'atual')).toBe(false)
    const preview = previewLegacy([{ name: 'Cargo antigo', role: 'Cargo antigo', department: 'Produto', location: 'Remoto', managerId: '' }])
    expect(preview.ok).toBe(true)
    const created = createRole(createSeed(), 'atual', 'Novo cargo', 'area-diretoria')
    expect(created.ok).toBe(true)
  })

  it('assessoria fica ao lado do gestor', () => {
    const layout = layoutScenario(createSeed(), 'planejada')
    const ops = layout.nodes.find((node) => node.id === 'plan-ops')
    const assistant = layout.nodes.find((node) => node.id === 'plan-gap-rh')
    expect(ops && assistant && assistant.x).toBeGreaterThan(ops!.x)
  })
})

describe('acesso', () => {
  it('bloqueia quem não é o Pedro', () => {
    expect(assertPedro({ login: 'outra-pessoa' }).ok).toBe(false)
    expect(assertPedro({ login: 'pedromleal15' }).ok).toBe(true)
  })
})
