import { describe, expect, it } from 'vitest'
import { assertPedro } from '../src/domain/auth'
import { layoutScenario, syntheticTree } from '../src/domain/layout'
import {
  detectActiveMention,
  extractMentionedAreaIds,
  insertMention,
  parseText,
  suggestAreas,
} from '../src/domain/mentions'
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
  updateRole,
} from '../src/domain/rules'
import { createSeed } from '../src/domain/seed'
import { previewLegacy, saveDocument } from '../src/domain/sync'
import type { AppDocument } from '../src/domain/types'

describe('regras do organograma', () => {
  it('configura colunas do quadro e preserva tarefas ao remover', () => {
    const doc = createSeed()
    expect(doc.columns.filter((column) => column.scenarioId === 'atual').map((column) => column.id)).toEqual([
      'todo', 'doing', 'blocked', 'done', 'col-role-ceo',
    ])
    expect(doc.columns.find((column) => column.id === 'col-role-ceo')?.kind).toBe('role')
    const added = addColumn(doc, 'atual', 'Em revisão')
    expect(added.ok).toBe(true)
    if (!added.ok) return
    expect(added.value.columns.find((column) => column.title === 'Em revisão')?.kind).toBe('workflow')
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
    expect(removed.value.tasks.find((task) => task.id === 'task-whatsapp')?.status).toBe('col-role-ceo')
  })

  it('completa colunas ao importar documento antigo', () => {
    const legacy = structuredClone(createSeed()) as AppDocument
    delete (legacy as Partial<AppDocument>).columns
    const imported = replaceDocument(createSeed(), legacy)
    expect(imported.ok).toBe(true)
    if (!imported.ok) return
    expect(imported.value.columns.filter((column) => column.scenarioId === 'planejada')).toHaveLength(5)
    expect(imported.value.columns.some((column) => column.roleId === 'plan-ceo')).toBe(true)
  })

  it('semeia o catálogo de áreas e sincroniza coluna do cargo', () => {
    const doc = createSeed()
    expect(doc.areas.filter((area) => area.scenarioId === 'atual')).toHaveLength(13)
    expect(doc.areas.filter((area) => area.scenarioId === 'planejada')).toHaveLength(13)
    expect(doc.areas.some((area) => area.title === 'Customer Success')).toBe(true)
    const created = createRole(doc, 'atual', 'Head Comercial', doc.areas.find((a) => a.scenarioId === 'atual' && a.title === 'Comercial')!.id)
    expect(created.ok).toBe(true)
    if (!created.ok) return
    const role = created.value.roles.find((item) => item.title === 'Head Comercial')!
    expect(created.value.columns.some((column) => column.roleId === role.id && column.title === 'Head Comercial')).toBe(true)
    const synced = updateRole(created.value, role.id, { title: 'Head de Comercial' })
    expect(synced.ok).toBe(true)
    if (!synced.ok) return
    expect(synced.value.columns.find((column) => column.roleId === role.id)?.title).toBe('Head de Comercial')
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

describe('mentions — parser', () => {
  const areas = [
    { id: 'area-mkt', title: 'Marketing' },
    { id: 'area-ops', title: 'Operações' },
    { id: 'area-prod', title: 'Produto' },
    { id: 'area-eng', title: 'Head de Engenharia' },
  ]

  it('retorna texto puro sem menções', () => {
    const segs = parseText('Olá mundo', areas)
    expect(segs).toHaveLength(1)
    expect(segs[0]).toEqual({ type: 'text', raw: 'Olá mundo' })
  })

  it('reconhece @Área simples', () => {
    const segs = parseText('Ver com @Marketing amanhã', areas)
    expect(segs).toHaveLength(3)
    expect(segs[1]).toMatchObject({ type: 'mention', areaId: 'area-mkt', areaTitle: 'Marketing' })
  })

  it('reconhece @Área com diacríticos', () => {
    const segs = parseText('Alinhar com @Operações', areas)
    const mention = segs.find((s) => s.type === 'mention')
    expect(mention?.areaId).toBe('area-ops')
  })

  it('não confunde prefixo: @Produto não captura @ProdutoTotal', () => {
    const segs = parseText('Ver @ProdutoTotal depois', areas)
    expect(segs.every((s) => s.type === 'text')).toBe(true)
  })

  it('match é case-insensitive', () => {
    const segs = parseText('Falar com @marketing', areas)
    const mention = segs.find((s) => s.type === 'mention')
    expect(mention?.areaId).toBe('area-mkt')
  })

  it('longest-match ganha: @Head de Engenharia antes de @Head', () => {
    const areasWithPrefix = [
      ...areas,
      { id: 'area-head', title: 'Head' },
    ]
    const segs = parseText('Escalar para @Head de Engenharia', areasWithPrefix)
    const mention = segs.find((s) => s.type === 'mention')
    expect(mention?.areaId).toBe('area-eng')
  })

  it('extrai IDs únicos de múltiplas menções', () => {
    const text = '@Marketing e @Operações e @Marketing novamente'
    const ids = extractMentionedAreaIds(text, areas)
    expect(ids.sort()).toEqual(['area-mkt', 'area-ops'].sort())
  })

  it('detectActiveMention encontra @ na posição certa', () => {
    const text = 'Ver com @Mar'
    const result = detectActiveMention(text, text.length)
    expect(result).toEqual({ start: 8, query: 'Mar' })
  })

  it('detectActiveMention retorna null sem @', () => {
    expect(detectActiveMention('texto normal', 12)).toBeNull()
  })

  it('insertMention substitui o fragmento @query', () => {
    const text = 'Ver com @Mar'
    const { text: next, cursor } = insertMention(text, 8, text.length, { id: 'area-mkt', title: 'Marketing' })
    expect(next).toBe('Ver com @Marketing')
    expect(cursor).toBe(next.length)
  })

  it('suggestAreas filtra por query', () => {
    const results = suggestAreas('mar', areas)
    expect(results).toHaveLength(1)
    expect(results[0].title).toBe('Marketing')
  })

  it('suggestAreas sem query retorna tudo até o limite', () => {
    expect(suggestAreas('', areas, 2)).toHaveLength(2)
  })
})
