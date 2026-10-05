import { useEffect, useRef, useState } from 'react'
import {
  addBand,
  addField,
  addResponsibility,
  addRoleColumn,
  assignPerson,
  copyRolesToScenario,
  createRole,
  deleteRole,
  diffScenarios,
  moveBand,
  placeRole,
  removeBand,
  renameBand,
  setFieldValue,
  setManager,
  updateRole,
} from '../domain/rules'
import { roleColumnId } from '../domain/board'
import type { FieldType, RelationKind, ScenarioId } from '../domain/types'
import { useStore } from '../state'
import { OrgCanvas } from './canvas'
import { TaskCard, TaskDrawer } from './tasks'

export function Organograma() {
  const store = useStore()
  const scenarioId = store.scenarioId
  const areas = store.document.areas.filter((area) => area.scenarioId === scenarioId)
  const roles = store.document.roles.filter((role) => role.scenarioId === scenarioId)
  const selected = roles.find((role) => role.id === store.selectedRoleId) ?? null
  const other: 'atual' | 'planejada' = scenarioId === 'atual' ? 'planejada' : 'atual'
  const [picked, setPicked] = useState<string[]>([])
  const [compareOpen, setCompareOpen] = useState(false)
  const [compareConfirmed, setCompareConfirmed] = useState(false)
  const [laneModalColumnId, setLaneModalColumnId] = useState<string | null>(null)
  const diffs = diffScenarios(store.document, other, scenarioId)

  return (
    <div className="stage">
      {scenarioId === 'planejada' && (
        <div className="banner">
          Propostas da estrutura parcial já registrada em 2026-10-04. O playbook com 22 cargos não estava no repositório, então nenhum título foi inventado para completar essa conta. Este cenário não altera as tarefas atuais.
        </div>
      )}
      {store.orgView === 'canvas' && (
        <OrgCanvas document={store.document} scenarioId={scenarioId} search={store.search} selectedRoleId={selected?.id ?? ''} onLaneNodeClick={setLaneModalColumnId} />
      )}
      {store.orgView === 'matriz' && <Matrix onCompare={() => setCompareOpen(true)} />}
      {store.orgView === 'tabela' && <RoleTable onCompare={() => setCompareOpen(true)} />}
      {selected && store.orgView === 'canvas' && (
        <RoleModal roleId={selected.id} onClose={() => store.setSelectedRoleId('')} />
      )}
      {selected && store.orgView !== 'canvas' && <RoleDrawer roleId={selected.id} />}
      {compareOpen && (
        <aside className="drawer" aria-label="Comparar cenários">
          <button className="text-button" type="button" onClick={() => setCompareOpen(false)}>Fechar</button>
          <h2>Trazer de {other === 'atual' ? 'Atual' : 'Planejada'}</h2>
          <p className="meta">Marque os cargos. A cópia padrão não leva tarefas. Mover um card na matriz não muda o gestor.</p>
          {diffs.length === 0 && <p>Nenhuma diferença de título entre os cenários.</p>}
          <ul className="compare-list">
            {diffs.map((row) => (
              <li key={row.id}>
                <label className="compare-row">
                  <input
                    type="checkbox"
                    checked={picked.includes(row.id)}
                    onChange={(event) => setPicked((current) => event.target.checked ? [...current, row.id] : current.filter((id) => id !== row.id))}
                  />
                  <span>
                    <strong>{row.label}</strong>
                    <span className="meta">{row.change}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="action-block">
            <p className="action-label">Autorizar aplicação <span>*</span></p>
            <label className="consent-row">
              <input type="checkbox" checked={compareConfirmed} onChange={(event) => setCompareConfirmed(event.target.checked)} />
              <span>Confirmo que os cargos marcados devem ser copiados para este cenário.</span>
            </label>
            <button className="primary pill-button" disabled={!compareConfirmed || picked.length === 0} type="button" onClick={() => store.apply(copyRolesToScenario(store.document, other, scenarioId, picked, false))}>
              Copiar sem tarefas
            </button>
            <button className="ghost pill-button" disabled={!compareConfirmed || picked.length === 0} type="button" onClick={() => store.apply(copyRolesToScenario(store.document, other, scenarioId, picked, true))}>
              Copiar com tarefas
            </button>
            <div className="action-divider" />
            <button className="secondary-link" type="button" onClick={() => setCompareOpen(false)}>Cancelar</button>
          </div>
        </aside>
      )}
      {store.orgView !== 'canvas' && selected && <RoleDrawer roleId={selected.id} />}
      <NewRole areas={areas.map((area) => ({ id: area.id, title: area.title }))} />
      {laneModalColumnId && (
        <LaneModal
          scenarioId={scenarioId}
          columnId={laneModalColumnId}
          onClose={() => setLaneModalColumnId(null)}
        />
      )}
    </div>
  )
}

function Matrix({ onCompare }: { onCompare: () => void }) {
  const store = useStore()
  const scenarioId = store.scenarioId
  const rows = store.document.bands.filter((band) => band.scenarioId === scenarioId && band.axis === 'row').sort((a, b) => a.order - b.order)
  const columns = store.document.bands.filter((band) => band.scenarioId === scenarioId && band.axis === 'column').sort((a, b) => a.order - b.order)
  const roles = store.document.roles.filter((role) => role.scenarioId === scenarioId)
  const unplaced = roles.filter((role) => {
    const place = store.document.placements.find((item) => item.roleId === role.id)
    return !place?.rowBandId || !place?.columnBandId
  })

  return (
    <div className="panel-page matrix-page">
      <div className="view-toolbar">
        <div>
          <h2>Matriz</h2>
          <p className="meta">{roles.length} {roles.length === 1 ? 'cargo' : 'cargos'}. A faixa é visual. O gestor muda no cargo.</p>
        </div>
        <div className="row-actions">
          <BandAdder />
          <button className="ghost" type="button" onClick={onCompare}>Comparar cenários</button>
        </div>
      </div>
      <div className="matrix-stage">
        <div
          className="unplaced-lane"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            const roleId = event.dataTransfer.getData('text/role-id')
            if (roleId) store.apply(placeRole(store.document, roleId, null, null))
          }}
        >
          <span>Sem faixa</span>
          {unplaced.length === 0 && <em>Solte aqui para tirar um cargo da grade.</em>}
          {unplaced.map((role) => <RoleChip key={role.id} roleId={role.id} />)}
        </div>
        <div className="matrix-scroll">
          <div className="matrix" style={{ gridTemplateColumns: `168px repeat(${Math.max(columns.length, 1)}, 272px)` }}>
            <div className="matrix-corner" />
            {columns.map((column) => <BandHeader key={column.id} bandId={column.id} />)}
            {columns.length === 0 && <div className="matrix-corner">Crie uma coluna</div>}
            {rows.map((row) => (
              <div className="matrix-line" key={row.id}>
                <BandHeader bandId={row.id} />
                {columns.map((column) => (
                  <MatrixCell key={column.id} rowId={row.id} columnId={column.id} roles={roles} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function BandHeader({ bandId }: { bandId: string }) {
  const store = useStore()
  const band = store.document.bands.find((item) => item.id === bandId)
  if (!band) return null
  const horizontal = band.axis === 'column'
  return (
    <div className={`band-head ${horizontal ? 'is-column' : 'is-row'}`}>
      <input className="band-name" aria-label={`Nome da faixa ${band.title}`} defaultValue={band.title} onBlur={(event) => store.apply(renameBand(store.document, band.id, event.target.value))} />
      <div className="band-actions">
        <button className="mini-button" type="button" aria-label={horizontal ? 'Mover coluna para a esquerda' : 'Mover linha para cima'} onClick={() => store.apply(moveBand(store.document, band.id, -1))}>{horizontal ? '←' : '↑'}</button>
        <button className="mini-button" type="button" aria-label={horizontal ? 'Mover coluna para a direita' : 'Mover linha para baixo'} onClick={() => store.apply(moveBand(store.document, band.id, 1))}>{horizontal ? '→' : '↓'}</button>
        <button className="mini-button" type="button" aria-label={`Remover ${band.title}`} onClick={() => store.apply(removeBand(store.document, band.id))}>×</button>
      </div>
    </div>
  )
}

function BandAdder() {
  const store = useStore()
  const [axis, setAxis] = useState<'row' | 'column' | null>(null)
  const [title, setTitle] = useState('')
  if (!axis) {
    return (
      <>
        <button className="ghost" type="button" onClick={() => setAxis('row')}>+ Linha</button>
        <button className="ghost" type="button" onClick={() => setAxis('column')}>+ Coluna</button>
      </>
    )
  }
  return (
    <form
      className="row-actions"
      onSubmit={(event) => {
        event.preventDefault()
        if (store.apply(addBand(store.document, store.scenarioId, axis, title))) {
          setTitle('')
          setAxis(null)
        }
      }}
    >
      <input autoFocus aria-label={axis === 'row' ? 'Nome da linha' : 'Nome da coluna'} value={title} onChange={(event) => setTitle(event.target.value)} placeholder={axis === 'row' ? 'Nome da linha' : 'Nome da coluna'} />
      <button className="primary" type="submit">Criar</button>
      <button className="ghost" type="button" onClick={() => setAxis(null)}>Cancelar</button>
    </form>
  )
}

function MatrixCell({ rowId, columnId, roles }: { rowId: string; columnId: string; roles: { id: string }[] }) {
  const store = useStore()
  const [over, setOver] = useState(false)
  const occupants = roles.filter((role) => {
    const place = store.document.placements.find((item) => item.roleId === role.id)
    return place?.rowBandId === rowId && place?.columnBandId === columnId
  })
  return (
    <div
      className={`matrix-cell${over ? ' is-over' : ''}`}
      onDragOver={(event) => event.preventDefault()}
      onDragEnter={() => setOver(true)}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        setOver(false)
        const roleId = event.dataTransfer.getData('text/role-id')
        if (roleId) store.apply(placeRole(store.document, roleId, rowId, columnId))
      }}
    >
      {occupants.map((role) => <RoleChip key={role.id} roleId={role.id} />)}
    </div>
  )
}

function RoleChip({ roleId }: { roleId: string }) {
  const store = useStore()
  const role = store.document.roles.find((item) => item.id === roleId)
  if (!role) return null
  const area = store.document.areas.find((item) => item.id === role.areaId)?.title ?? ''
  const personId = store.document.assignments.find((item) => item.roleId === role.id)?.personId
  const occupant = store.document.people.find((person) => person.id === personId)?.name
  return (
    <button
      className={`matrix-card${store.selectedRoleId === role.id ? ' is-selected' : ''}${role.status === 'open' ? ' is-open' : ''}`}
      type="button"
      draggable
      onDragStart={(event) => event.dataTransfer.setData('text/role-id', role.id)}
      onClick={() => store.setSelectedRoleId(role.id)}
    >
      <span className="kicker">
        <span>{area}</span>
        <span><i className={`status-dot ${role.status}`} /> {statusLabel(role.status)}</span>
      </span>
      <strong>{role.title}</strong>
      <span>{occupant || 'Sem ocupante'}</span>
    </button>
  )
}

function RoleTable({ onCompare }: { onCompare: () => void }) {
  const store = useStore()
  const scenarioId = store.scenarioId
  const roles = store.document.roles.filter((role) => role.scenarioId === scenarioId)
  const fields = store.document.fields.filter((field) => field.scenarioId === scenarioId)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<FieldType>('text')
  const [options, setOptions] = useState('')

  return (
    <div className="panel-page">
      <div className="view-toolbar">
        <div>
          <h2>Tabela</h2>
          <p className="meta">{roles.length} {roles.length === 1 ? 'cargo' : 'cargos'} neste cenário.</p>
        </div>
        {adding ? (
          <form
            className="row-actions"
            onSubmit={(event) => {
              event.preventDefault()
              const parsed = options.split(',').map((item) => item.trim()).filter(Boolean)
              if (store.apply(addField(store.document, scenarioId, name, type, parsed))) {
                setName('')
                setOptions('')
                setAdding(false)
              }
            }}
          >
            <input aria-label="Nome do campo" value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome do campo" />
            <select aria-label="Tipo do campo" value={type} onChange={(event) => setType(event.target.value as FieldType)}>
              <option value="text">Texto</option>
              <option value="number">Número</option>
              <option value="select">Seleção</option>
              <option value="date">Data</option>
              <option value="checkbox">Checkbox</option>
            </select>
            {type === 'select' && <input aria-label="Opções separadas por vírgula" value={options} onChange={(event) => setOptions(event.target.value)} placeholder="opção, opção" />}
            <button className="primary" type="submit">Criar campo</button>
            <button className="ghost" type="button" onClick={() => setAdding(false)}>Cancelar</button>
          </form>
        ) : (
          <div className="row-actions">
            <button className="ghost" type="button" onClick={() => setAdding(true)}>+ Campo</button>
            <button className="ghost" type="button" onClick={onCompare}>Comparar cenários</button>
          </div>
        )}
      </div>
      <div className="table-wrap">
        <table className="role-table">
          <thead>
            <tr>
              <th>Cargo</th>
              <th>Área</th>
              <th>Ocupante</th>
              <th>Gestor</th>
              <th>Status</th>
              {fields.map((field) => <th key={field.id}>{field.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => {
              const personId = store.document.assignments.find((item) => item.roleId === role.id)?.personId
              const occupant = store.document.people.find((person) => person.id === personId)?.name
              const managerId = store.document.relations.find((relation) => relation.fromRoleId === role.id && relation.kind !== 'functional')?.toRoleId
              const manager = store.document.roles.find((item) => item.id === managerId)?.title
              return (
                <tr key={role.id} className={store.selectedRoleId === role.id ? 'is-selected' : undefined} onClick={() => store.setSelectedRoleId(role.id)}>
                  <td>
                    <button className="role-link" type="button" onClick={() => store.setSelectedRoleId(role.id)}>{role.title}</button>
                  </td>
                  <td className="muted-cell">{store.document.areas.find((area) => area.id === role.areaId)?.title}</td>
                  <td>{occupant ? <span className="person-cell"><span className="avatar">{initials(occupant)}</span>{occupant}</span> : <span className="muted-cell">Vago</span>}</td>
                  <td className="muted-cell">{manager ?? '—'}</td>
                  <td><span className={`pill ${role.status}`}>{statusLabel(role.status)}</span></td>
                  {fields.map((field) => {
                    const value = store.document.values.find((item) => item.roleId === role.id && item.fieldId === field.id)?.value ?? ''
                    return (
                      <td key={field.id}>
                        <FieldInput field={field} value={value} onChange={(next) => store.apply(setFieldValue(store.document, role.id, field.id, next))} />
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase('pt-BR') ?? '').join('')
}

function statusLabel(status: string) {
  if (status === 'active') return 'Ativo'
  if (status === 'away') return 'Férias'
  if (status === 'open') return 'Vaga'
  return 'Proposta'
}

function FieldInput({ field, value, onChange }: { field: { type: FieldType; options: string[] }; value: string; onChange: (value: string) => void }) {
  if (field.type === 'checkbox') {
    return <input type="checkbox" checked={value === 'true'} onChange={(event) => onChange(event.target.checked ? 'true' : 'false')} />
  }
  if (field.type === 'select') {
    return (
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">—</option>
        {field.options.map((option) => <option key={option}>{option}</option>)}
      </select>
    )
  }
  const type = field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'
  return <input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
}

function RoleDrawer({ roleId }: { roleId: string }) {
  const store = useStore()
  const role = store.document.roles.find((item) => item.id === roleId)
  if (!role) return null
  const scenarioRoles = store.document.roles.filter((item) => item.scenarioId === role.scenarioId && item.id !== role.id)
  const areas = store.document.areas.filter((area) => area.scenarioId === role.scenarioId)
  const direct = store.document.relations.find((relation) => relation.fromRoleId === role.id && relation.kind !== 'functional')
  const functional = store.document.relations.find((relation) => relation.fromRoleId === role.id && relation.kind === 'functional')
  const assignment = store.document.assignments.find((item) => item.roleId === role.id)
  const occupant = store.document.people.find((person) => person.id === assignment?.personId)
  const tasks = store.document.tasks.filter((task) => task.roleId === role.id)
  const responsibilities = store.document.responsibilities.filter((item) => item.roleId === role.id)

  const changeManager = (managerId: string, kind: RelationKind) => {
    store.apply(setManager(store.document, role.scenarioId, role.id, managerId || null, kind))
  }

  return (
    <aside className="drawer" aria-label="Cargo selecionado">
      <button className="text-button" type="button" onClick={() => store.setSelectedRoleId('')}>Fechar</button>
      <div className="field">
        <span>Título</span>
        <input value={role.title} onChange={(event) => store.apply(updateRole(store.document, role.id, { title: event.target.value }))} />
      </div>
      <div className="field">
        <span>Área</span>
        <select value={role.areaId} onChange={(event) => store.apply(updateRole(store.document, role.id, { areaId: event.target.value }))}>
          {areas.map((area) => <option key={area.id} value={area.id}>{area.title}</option>)}
        </select>
      </div>
      <div className="field">
        <span>Status</span>
        <select value={role.status} onChange={(event) => store.apply(updateRole(store.document, role.id, { status: event.target.value as typeof role.status }))}>
          <option value="active">Ativo</option>
          <option value="away">Férias</option>
          <option value="open">Vaga</option>
          <option value="proposal">Proposta</option>
        </select>
      </div>
      <p className="meta">Fonte: {role.source} · {role.sourceDate}</p>
      <div className="field">
        <span>Ocupante</span>
        <input
          defaultValue={occupant?.name ?? ''}
          placeholder="Nome do ocupante"
          onBlur={(event) => {
            const name = event.target.value.trim()
            if (!name) store.apply(assignPerson(store.document, role.id, null))
            else if (name !== occupant?.name) store.apply(assignPerson(store.document, role.id, null, name))
          }}
        />
      </div>
      <div className="field">
        <span>Reporte direto</span>
        <select value={direct?.kind === 'assistant' ? '' : direct?.toRoleId ?? ''} onChange={(event) => changeManager(event.target.value, 'direct')}>
          <option value="">Sem gestor</option>
          {scenarioRoles.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
      </div>
      <div className="field">
        <span>Reporte funcional</span>
        <select value={functional?.toRoleId ?? ''} onChange={(event) => changeManager(event.target.value, 'functional')}>
          <option value="">Nenhum</option>
          {scenarioRoles.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
      </div>
      <label className="field">
        <span>Assessoria lateral</span>
        <input
          type="checkbox"
          checked={direct?.kind === 'assistant'}
          onChange={(event) => changeManager(event.target.checked ? (direct?.toRoleId ?? scenarioRoles[0]?.id ?? '') : (direct?.toRoleId ?? ''), event.target.checked ? 'assistant' : 'direct')}
        />
      </label>
      <div className="field">
        <span>Nota</span>
        <textarea value={role.note} onChange={(event) => store.apply(updateRole(store.document, role.id, { note: event.target.value }))} />
      </div>
      <h3>Responsabilidades</h3>
      <ul>{responsibilities.map((item) => <li key={item.id}>{item.text}</li>)}</ul>
      <form
        className="row-actions"
        onSubmit={(event) => {
          event.preventDefault()
          const data = new FormData(event.currentTarget)
          if (store.apply(addResponsibility(store.document, role.id, String(data.get('text') ?? '')))) event.currentTarget.reset()
        }}
      >
        <input name="text" aria-label="Nova responsabilidade" placeholder="Nova responsabilidade" />
        <button className="ghost" type="submit">Adicionar</button>
      </form>
      <h3>Tarefas e metas</h3>
      <ul>
        {tasks.map((task) => (
          <li key={task.id}>
            <button
              className="linkish"
              type="button"
              onClick={() => {
                store.setScenarioFor('tasks', task.scenarioId)
                store.setSelectedTaskId(task.id)
                store.setEnvironment('tasks')
              }}
            >
              {task.title}
            </button>
          </li>
        ))}
        {tasks.length === 0 && <li className="meta">Nenhuma tarefa vinculada.</li>}
      </ul>
      <button className="ghost" type="button" onClick={() => { if (store.apply(deleteRole(store.document, role.id))) store.setSelectedRoleId('') }}>
        Excluir cargo
      </button>
    </aside>
  )
}

function RoleModal({ roleId, onClose }: { roleId: string; onClose: () => void }) {
  const store = useStore()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const role = store.document.roles.find((item) => item.id === roleId)
  const areas = store.document.areas.filter((area) => area.scenarioId === role?.scenarioId)
  const assignment = store.document.assignments.find((item) => item.roleId === roleId)
  const occupant = store.document.people.find((person) => person.id === assignment?.personId)

  useEffect(() => {
    if (!role) return
    const hasColumn = store.document.columns.some(
      (column) => column.scenarioId === role.scenarioId && column.roleId === role.id,
    )
    if (!hasColumn) store.apply(addRoleColumn(store.document, role.id))
  }, [role, store])

  const column = role
    ? store.document.columns.find(
      (col) => col.scenarioId === role.scenarioId && (col.roleId === role.id || col.id === roleColumnId(role.id)),
    )
    : null
  const columnTasks = column
    ? store.document.tasks.filter((task) => task.scenarioId === role!.scenarioId && task.status === column.id)
    : []
  const selectedTask = columnTasks.find((task) => task.id === store.selectedTaskId) ?? null

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    try { dialog.showModal() } catch { dialog.setAttribute('open', '') }
    return () => { try { if (dialog.open) dialog.close() } catch { /* ignore */ } }
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        store.setSelectedTaskId('')
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose, store])

  if (!role) return null

  const handleClose = () => {
    store.setSelectedTaskId('')
    onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      className="role-modal lane-modal"
      aria-modal="true"
      aria-labelledby="role-modal-title"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div className="lane-modal-inner role-modal-inner">
        <div className="lane-modal-head">
          <h2 id="role-modal-title">{role.title}</h2>
          <span className="lane-modal-count">coluna do cargo</span>
          <button className="icon-button lane-modal-close" type="button" aria-label="Fechar" onClick={handleClose}>×</button>
        </div>
        <div className="role-modal-grid">
          <div className="role-modal-edit">
            <div className="field">
              <span>Título</span>
              <input value={role.title} onChange={(event) => store.apply(updateRole(store.document, role.id, { title: event.target.value }))} />
            </div>
            <div className="field">
              <span>Área</span>
              <select value={role.areaId} onChange={(event) => store.apply(updateRole(store.document, role.id, { areaId: event.target.value }))}>
                {areas.map((area) => <option key={area.id} value={area.id}>{area.title}</option>)}
              </select>
            </div>
            <div className="field">
              <span>Status</span>
              <select value={role.status} onChange={(event) => store.apply(updateRole(store.document, role.id, { status: event.target.value as typeof role.status }))}>
                <option value="active">Ativo</option>
                <option value="away">Férias</option>
                <option value="open">Vaga</option>
                <option value="proposal">Proposta</option>
              </select>
            </div>
            <div className="field">
              <span>Ocupante</span>
              <input
                defaultValue={occupant?.name ?? ''}
                placeholder="Nome do ocupante"
                onBlur={(event) => {
                  const name = event.target.value.trim()
                  if (!name) store.apply(assignPerson(store.document, role.id, null))
                  else if (name !== occupant?.name) store.apply(assignPerson(store.document, role.id, null, name))
                }}
              />
            </div>
            <div className="field">
              <span>Nota</span>
              <textarea value={role.note} onChange={(event) => store.apply(updateRole(store.document, role.id, { note: event.target.value }))} />
            </div>
          </div>
          <div className="role-modal-column">
            <h3 className="role-modal-column-title">{column?.title ?? role.title}</h3>
            <div className="lane-modal-body">
              {!column || columnTasks.length === 0
                ? <p className="meta lane-modal-empty">Nenhuma tarefa nesta coluna do cargo.</p>
                : columnTasks.map((task) => <TaskCard key={task.id} task={task} />)}
            </div>
          </div>
        </div>
        {selectedTask && <TaskDrawer task={selectedTask} />}
      </div>
    </dialog>
  )
}

function LaneModal({ scenarioId, columnId, onClose }: { scenarioId: ScenarioId; columnId: string; onClose: () => void }) {
  const store = useStore()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const column = store.document.columns.find((col) => col.scenarioId === scenarioId && col.id === columnId)
  const tasks = store.document.tasks.filter((task) => task.scenarioId === scenarioId && task.status === columnId)
  const selectedTask = tasks.find((task) => task.id === store.selectedTaskId) ?? null

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    try { dialog.showModal() } catch { dialog.setAttribute('open', '') }
    return () => { try { if (dialog.open) dialog.close() } catch { /* ignore */ } }
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        store.setSelectedTaskId('')
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose, store])

  const handleClose = () => {
    store.setSelectedTaskId('')
    onClose()
  }

  if (!column) return null
  return (
    <dialog
      ref={dialogRef}
      className="lane-modal"
      aria-modal="true"
      aria-labelledby="lane-modal-title"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div className="lane-modal-inner">
        <div className="lane-modal-head">
          <h2 id="lane-modal-title">{column.title}</h2>
          <span className="lane-modal-count">{tasks.length} {tasks.length === 1 ? 'tarefa' : 'tarefas'}</span>
          <button
            className="icon-button lane-modal-close"
            type="button"
            aria-label="Fechar"
            onClick={handleClose}
          >
            ×
          </button>
        </div>
        <div className="lane-modal-body">
          {tasks.length === 0
            ? <p className="meta lane-modal-empty">Nenhuma tarefa nesta coluna.</p>
            : tasks.map((task) => <TaskCard key={task.id} task={task} />)
          }
        </div>
        {selectedTask && <TaskDrawer task={selectedTask} />}
      </div>
    </dialog>
  )
}

export function requestNewRole() {  document.dispatchEvent(new CustomEvent('glyco-new-role'))
}

function NewRole({ areas }: { areas: { id: string; title: string }[] }) {
  const store = useStore()
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const openDrawer = () => setOpen(true)
    document.addEventListener('glyco-new-role', openDrawer)
    return () => document.removeEventListener('glyco-new-role', openDrawer)
  }, [])
  if (!open) return null
  return (
    <form
      className="drawer"
      onSubmit={(event) => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        if (store.apply(createRole(store.document, store.scenarioId, String(data.get('title') ?? ''), String(data.get('areaId') ?? '')))) setOpen(false)
      }}
    >
      <h2>Novo cargo</h2>
      <label className="field"><span>Título</span><input name="title" required minLength={2} /></label>
      <label className="field">
        <span>Área</span>
        <select name="areaId">{areas.map((area) => <option key={area.id} value={area.id}>{area.title}</option>)}</select>
      </label>
      <div className="row-actions">
        <button className="primary" type="submit">Criar</button>
        <button className="ghost" type="button" onClick={() => setOpen(false)}>Cancelar</button>
      </div>
    </form>
  )
}

