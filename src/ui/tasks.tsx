import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { scenarioColumns } from '../domain/board'
import { addColumn, addTaskBlock, createGoal, createInitiative, createTask, defaultTaskBlocks, removeColumn, removeTaskBlock, renameColumn, resizeColumn, setTaskStatus, updateGoalProgress, updateTask, updateTaskBlock } from '../domain/rules'
import type { BoardColumn, TaskBlock, TaskItem } from '../domain/types'
import { useStore } from '../state'
import { MentionPullText } from './mention-textarea'

export function Tasks() {
  const store = useStore()
  const tasks = visibleTasks(store)
  const columns = scenarioColumns(store.document, store.scenarioId)
  const selected = store.document.tasks.find((task) => task.id === store.selectedTaskId && task.scenarioId === store.scenarioId) ?? null

  return (
    <div className="stage">
      {store.taskView === 'quadro' && (
        <div className="panel-page board-stage">
          <div className="board-scroll">
            <div className="board">
              {columns.map((column) => (
                <Column key={`${column.scenarioId}-${column.id}`} column={column} tasks={tasks.filter((task) => task.status === column.id)} />
              ))}
              <NewColumn />
            </div>
          </div>
        </div>
      )}
      {store.taskView === 'lista' && (
        <div className="panel-page table-wrap">
          <table>
            <thead>
              <tr><th>Tarefa</th><th>Status</th><th>Prioridade</th><th>Prazo</th><th>Cargo</th><th>Origem</th></tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id}>
                  <td><button className="linkish" type="button" onClick={() => store.setSelectedTaskId(task.id)}>{task.title}</button></td>
                  <td>{scenarioColumns(store.document, store.scenarioId).find((column) => column.id === task.status)?.title ?? task.status}</td>
                  <td>{task.priority}</td>
                  <td>{task.due || '—'}</td>
                  <td>{roleTitle(store.document, task.roleId)}</td>
                  <td>{task.origin}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {store.taskView === 'metas' && <Goals />}
      {selected && <TaskDrawer task={selected} />}
      <NewTask />
    </div>
  )
}

function visibleTasks(store: ReturnType<typeof useStore>) {
  return store.document.tasks.filter((task) => {
    if (task.scenarioId !== store.scenarioId) return false
    if (store.taskOrigin && task.origin !== store.taskOrigin) return false
    const role = store.document.roles.find((item) => item.id === task.roleId)
    const blob = `${task.title} ${role?.title ?? ''} ${task.origin}`.toLocaleLowerCase('pt-BR')
    return !store.search || blob.includes(store.search.trim().toLocaleLowerCase('pt-BR'))
  })
}

function Column({ column, tasks }: { column: BoardColumn; tasks: TaskItem[] }) {
  const store = useStore()
  const resize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = column.width
    const section = event.currentTarget.parentElement
    const move = (ev: globalThis.PointerEvent) => {
      if (section) section.style.width = `${Math.min(480, Math.max(340, Math.round(startWidth + ev.clientX - startX)))}px`
    }
    const up = (ev: globalThis.PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      store.apply(resizeColumn(store.document, column.scenarioId, column.id, startWidth + ev.clientX - startX))
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  return (
    <section
      className={`column glass-column column-${column.kind ?? 'workflow'}`}
      style={{ width: Math.max(340, column.width) }}
      aria-label={column.title}
      data-column-kind={column.kind ?? 'workflow'}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        const taskId = event.dataTransfer.getData('text/task-id')
        if (taskId) store.apply(setTaskStatus(store.document, taskId, column.id))
      }}
    >
      <div className="column-head">
        <input
          className="column-name"
          aria-label={`Nome da coluna ${column.title}`}
          defaultValue={column.title}
          onBlur={(event) => {
            if (event.target.value.trim() !== column.title) store.apply(renameColumn(store.document, column.scenarioId, column.id, event.target.value))
          }}
        />
        <button className="mini-button" type="button" aria-label={`Remover ${column.title}`} onClick={() => store.apply(removeColumn(store.document, column.scenarioId, column.id))}>×</button>
      </div>
      <div className="column-cards">
        {tasks.map((task) => <TaskCard key={task.id} task={task} />)}
      </div>
      <button className="column-resize" type="button" aria-label={`Largura de ${column.title}`} onPointerDown={resize} />
    </section>
  )
}

function NewColumn() {
  const store = useStore()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  if (!open) {
    return <button className="ghost add-column" type="button" onClick={() => setOpen(true)}>+ Coluna</button>
  }
  return (
    <form
      className="action-block add-column-form"
      onSubmit={(event) => {
        event.preventDefault()
        if (!confirmed) return
        if (store.apply(addColumn(store.document, store.scenarioId, title))) {
          setTitle('')
          setConfirmed(false)
          setOpen(false)
        }
      }}
    >
      <label className="action-label" htmlFor="new-column">Nome da coluna <span>*</span></label>
      <input id="new-column" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Em revisão" required />
      <label className="consent-row">
        <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
        <span>Confirmo a inclusão desta etapa no fluxo de execução.</span>
      </label>
      <button className="primary pill-button" type="submit" disabled={!confirmed}>Criar coluna</button>
      <div className="action-divider" />
      <button className="secondary-link" type="button" onClick={() => setOpen(false)}>Cancelar</button>
    </form>
  )
}

export function TaskCard({ task }: { task: TaskItem }) {
  const store = useStore()
  const columns = scenarioColumns(store.document, task.scenarioId)
  const role = store.document.roles.find((item) => item.id === task.roleId)
  const goal = store.document.goals.find((item) => item.id === task.goalId)
  return (
    <article className="task-card">
      <div className="task-card-top">
        <button
          className="drag-grip"
          type="button"
          draggable
          aria-label={task.title}
          onDragStart={(event) => event.dataTransfer.setData('text/task-id', task.id)}
          onClick={() => store.setSelectedTaskId(task.id)}
        >
          <span aria-hidden="true">⋮⋮</span>
        </button>
        <PullText
          label={`Título de ${task.title}`}
          value={task.title}
          onChange={(title) => store.apply(updateTask(store.document, task.id, { title }))}
        />
      </div>
      <div className="task-sections">
        {(task.blocks ?? defaultTaskBlocks(task.id)).map((block) => (
          <TaskBlockView key={block.id} task={task} block={block} objective={goal?.title ?? 'Sem objetivo vinculado'} />
        ))}
      </div>
      <button className="add-task-block" type="button" onClick={() => store.apply(addTaskBlock(store.document, task.id))}>+ Bloco</button>
      <div className="task-card-foot">
        {role ? (
          <button
            className="linkish"
            type="button"
            onClick={() => {
              store.setScenarioFor('organograma', task.scenarioId)
              store.setSelectedRoleId(role.id)
              store.setOrgView('canvas')
              store.setEnvironment('organograma')
            }}
          >
            {role.title}
          </button>
        ) : <span className="meta">Sem responsável</span>}
        <select aria-label={`Coluna de ${task.title}`} value={task.status} onChange={(event) => store.apply(setTaskStatus(store.document, task.id, event.target.value))}>
          {columns.map((column) => <option key={column.id} value={column.id}>{column.title}</option>)}
        </select>
      </div>
      {task.pendingAssignment && <p className="meta">Pendente de atribuição</p>}
    </article>
  )
}

function TaskBlockView({ task, block, objective }: { task: TaskItem; block: TaskBlock; objective: string }) {
  const store = useStore()
  const resize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    const section = event.currentTarget.parentElement as HTMLElement | null
    const grid = section?.parentElement
    const startX = event.clientX
    const startY = event.clientY
    const startWidth = block.width
    const startHeight = block.height
    const measure = (clientX: number, clientY: number) => ({
      width: Math.min(12, Math.max(3, startWidth + Math.round((clientX - startX) / ((grid?.clientWidth ?? 300) / 12)))),
      height: Math.min(420, Math.max(72, startHeight + clientY - startY)),
    })
    const move = (ev: globalThis.PointerEvent) => {
      const next = measure(ev.clientX, ev.clientY)
      if (section) {
        section.style.gridColumn = `span ${next.width}`
        section.style.height = `${next.height}px`
      }
    }
    const up = (ev: globalThis.PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      store.apply(updateTaskBlock(store.document, task.id, block.id, measure(ev.clientX, ev.clientY)))
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  return (
    <section className={`task-section task-block task-block-${block.kind}`} style={{ gridColumn: `span ${block.width}`, height: block.height }}>
      <div className="task-block-head">
        {block.kind === 'text' ? (
          <PullText label="Título do bloco" value={block.title} onChange={(title) => store.apply(updateTaskBlock(store.document, task.id, block.id, { title }))} />
        ) : <span className="task-section-label">{block.title}</span>}
        {block.kind === 'text' && <button className="task-block-remove" type="button" aria-label={`Remover ${block.title}`} onClick={() => store.apply(removeTaskBlock(store.document, task.id, block.id))}>×</button>}
      </div>
      <div className="task-block-content">
        {block.kind === 'tools' && (task.checklist.length > 0 ? task.checklist.map((item) => (
          <label key={item.id} className="check-line">
            <input type="checkbox" checked={item.done} aria-label={item.text} onChange={(event) => store.apply(updateTask(store.document, task.id, {
              checklist: task.checklist.map((entry) => entry.id === item.id ? { ...entry, done: event.target.checked } : entry),
            }))} />
            <PullText label={`Item ${item.text}`} value={item.text} onChange={(text) => store.apply(updateTask(store.document, task.id, {
              checklist: task.checklist.map((entry) => entry.id === item.id ? { ...entry, text } : entry),
            }))} />
          </label>
        )) : <span className="task-empty">Nenhuma ferramenta</span>)}
        {block.kind === 'objective' && <span className="task-objective">{objective}</span>}
        {block.kind === 'context' && (
          <MentionPullText
            label={`Descrição de ${task.title}`}
            value={task.description}
            placeholder="Adicione o contexto desta tarefa — use @Área para referenciar"
            areas={store.document.areas.filter((a) => a.scenarioId === task.scenarioId)}
            onChange={(description) => store.apply(updateTask(store.document, task.id, { description }))}
          />
        )}
        {block.kind === 'text' && (
          <MentionPullText
            label={`Conteúdo de ${block.title}`}
            value={block.text}
            placeholder="Escreva ou use @Área para referenciar"
            areas={store.document.areas.filter((a) => a.scenarioId === task.scenarioId)}
            onChange={(text) => store.apply(updateTaskBlock(store.document, task.id, block.id, { text }))}
          />
        )}
      </div>
      <button
        className="task-block-resize"
        type="button"
        aria-label={`Redimensionar ${block.title}`}
        onPointerDown={resize}
        onKeyDown={(event) => {
          if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
          event.preventDefault()
          store.apply(updateTaskBlock(store.document, task.id, block.id, {
            width: block.width + (event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0),
            height: block.height + (event.key === 'ArrowDown' ? 16 : event.key === 'ArrowUp' ? -16 : 0),
          }))
        }}
      />
    </section>
  )
}

function PullText({ label, value, placeholder, onChange }: { label: string; value: string; placeholder?: string; onChange: (value: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const fit = () => {
    const field = ref.current
    if (!field) return
    field.style.height = '0px'
    field.style.height = `${field.scrollHeight}px`
  }
  useLayoutEffect(fit, [value])
  return (
    <textarea
      ref={ref}
      className="pull-text"
      aria-label={label}
      value={value}
      placeholder={placeholder}
      rows={1}
      onChange={(event) => {
        onChange(event.target.value)
        fit()
      }}
    />
  )
}

export function TaskDrawer({ task }: { task: TaskItem }) {
  const store = useStore()
  const roles = store.document.roles.filter((role) => role.scenarioId === task.scenarioId)
  return (
    <aside className="drawer" aria-label="Tarefa selecionada">
      <button className="text-button" type="button" onClick={() => store.setSelectedTaskId('')}>Fechar</button>
      <div className="field">
        <span>Título</span>
        <input value={task.title} onChange={(event) => store.apply(updateTask(store.document, task.id, { title: event.target.value }))} />
      </div>
      <div className="field">
        <span>Descrição</span>
        <MentionPullText
          label={`Descrição de ${task.title}`}
          value={task.description}
          placeholder="Descreva a tarefa — use @Área para referenciar"
          areas={store.document.areas.filter((a) => a.scenarioId === task.scenarioId)}
          onChange={(description) => store.apply(updateTask(store.document, task.id, { description }))}
        />
      </div>
      <div className="field">
        <span>Prioridade</span>
        <select value={task.priority} onChange={(event) => store.apply(updateTask(store.document, task.id, { priority: event.target.value as TaskItem['priority'] }))}>
          <option value="low">Baixa</option>
          <option value="medium">Média</option>
          <option value="high">Alta</option>
        </select>
      </div>
      <div className="field">
        <span>Prazo</span>
        <input type="date" value={task.due} onChange={(event) => store.apply(updateTask(store.document, task.id, { due: event.target.value }))} />
      </div>
      <div className="field">
        <span>Cargo responsável</span>
        <select
          value={task.roleId ?? ''}
          onChange={(event) => store.apply(updateTask(store.document, task.id, { roleId: event.target.value || null, pendingAssignment: false }))}
        >
          <option value="">Sem responsável</option>
          {roles.map((role) => <option key={role.id} value={role.id}>{role.title}</option>)}
        </select>
      </div>
      {task.roleId && (
        <button
          className="linkish"
          type="button"
          onClick={() => {
            store.setScenarioFor('organograma', task.scenarioId)
            store.setSelectedRoleId(task.roleId ?? '')
            store.setOrgView('canvas')
            store.setEnvironment('organograma')
          }}
        >
          Abrir cargo no organograma
        </button>
      )}
      <h3>Checklist</h3>
      <ul>
        {task.checklist.map((item) => (
          <li key={item.id}>
            <label>
              <input
                type="checkbox"
                checked={item.done}
                onChange={(event) => store.apply(updateTask(store.document, task.id, {
                  checklist: task.checklist.map((entry) => entry.id === item.id ? { ...entry, done: event.target.checked } : entry),
                }))}
              />
              {item.text}
            </label>
          </li>
        ))}
      </ul>
      <p className="meta">Origem: {task.origin}{task.externalId ? ` · ${task.externalId}` : ''}</p>
    </aside>
  )
}

function Goals() {
  const store = useStore()
  const goals = store.document.goals.filter((goal) => goal.scenarioId === store.scenarioId)
  const initiatives = store.document.initiatives.filter((item) => item.scenarioId === store.scenarioId)
  const [title, setTitle] = useState('')
  const [indicator, setIndicator] = useState('')
  return (
    <div className="panel-page">
      <form
        className="row-actions"
        onSubmit={(event) => {
          event.preventDefault()
          if (store.apply(createGoal(store.document, store.scenarioId, title, indicator, 0, 100))) {
            setTitle('')
            setIndicator('')
          }
        }}
      >
        <input aria-label="Título da meta" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Meta" />
        <input aria-label="Indicador" value={indicator} onChange={(event) => setIndicator(event.target.value)} placeholder="Indicador" />
        <button className="primary" type="submit">Criar meta</button>
      </form>
      {goals.map((goal) => (
        <article key={goal.id} className="goal-card">
          <h3>{goal.title}</h3>
          <p className="meta">{goal.indicator} · fonte {goal.source} · inicial {goal.baseline} · alvo {goal.target}</p>
          <label className="meta">
            Progresso
            <input
              type="number"
              aria-label={`Progresso de ${goal.title}`}
              value={goal.progress}
              onChange={(event) => store.apply(updateGoalProgress(store.document, goal.id, Number(event.target.value)))}
            />
          </label>
          <ul>
            {initiatives.filter((item) => item.goalId === goal.id).map((item) => <li key={item.id}>{item.title}</li>)}
          </ul>
          <button className="ghost" type="button" onClick={() => store.apply(createInitiative(store.document, store.scenarioId, `Iniciativa de ${goal.title}`, goal.id))}>
            Nova iniciativa
          </button>
        </article>
      ))}
    </div>
  )
}

function NewTask() {
  const store = useStore()
  const [open, setOpen] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => {
    const openDrawer = () => setOpen(true)
    document.addEventListener('glyco-new-task', openDrawer)
    return () => document.removeEventListener('glyco-new-task', openDrawer)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  if (!open) return null
  const roles = store.document.roles.filter((role) => role.scenarioId === store.scenarioId)
  return (
    <>
      <div
        className="drawer-backdrop"
        aria-hidden="true"
        onClick={() => setOpen(false)}
      />
      <form
        className="drawer"
        aria-label="Nova tarefa"
        onSubmit={(event) => {
          event.preventDefault()
          const data = new FormData(event.currentTarget)
          const created = createTask(store.document, store.scenarioId, {
            title: String(data.get('title') ?? ''),
            description: String(data.get('description') ?? ''),
            priority: String(data.get('priority') ?? 'medium') as TaskItem['priority'],
            due: String(data.get('due') ?? ''),
            roleId: String(data.get('roleId') ?? '') || null,
            checklist: [],
          })
          if (!confirmed) return
          if (store.apply(created)) {
            setConfirmed(false)
            setOpen(false)
          }
        }}
      >
        <div className="drawer-head">
          <h2>Nova tarefa</h2>
          <button
            className="icon-button"
            type="button"
            aria-label="Fechar formulário de nova tarefa"
            onClick={() => setOpen(false)}
          >
            ×
          </button>
        </div>
        <label className="field"><span>Título</span><input name="title" required minLength={2} /></label>
        <label className="field"><span>Descrição</span><textarea name="description" /></label>
        <label className="field"><span>Prazo</span><input name="due" type="date" /></label>
        <label className="field">
          <span>Prioridade</span>
          <select name="priority"><option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option></select>
        </label>
        <label className="field">
          <span>Cargo</span>
          <select name="roleId"><option value="">Sem responsável</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.title}</option>)}</select>
        </label>
        <div className="action-block">
          <p className="action-label">Confirmar criação <span>*</span></p>
          <label className="consent-row">
            <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
            <span>Confirmo que esta tarefa deve entrar no quadro de execução.</span>
          </label>
          <button className="primary pill-button" type="submit" disabled={!confirmed}>Criar tarefa</button>
          <div className="action-divider" />
          <button className="secondary-link" type="button" onClick={() => setOpen(false)}>Cancelar</button>
        </div>
      </form>
    </>
  )
}

export function requestNewTask() {
  document.dispatchEvent(new CustomEvent('glyco-new-task'))
}

function roleTitle(document: { roles: { id: string; title: string }[] }, roleId: string | null) {
  if (!roleId) return 'Sem responsável'
  return document.roles.find((role) => role.id === roleId)?.title ?? 'Cargo removido'
}
