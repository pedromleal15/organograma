/**
 * Global AreaModal — opens from any screen via a DOM custom event.
 *
 * Usage:
 *   import { openAreaModal } from './area-modal'
 *   openAreaModal('area-marketing')
 *
 * The modal is mounted once at the App root and handles its own lifecycle.
 */
import { useEffect, useRef, useState } from 'react'
import { MentionDisplay } from './mention-textarea'
import { useStore } from '../state'
import type { Area, Role, Person, Assignment, TaskItem } from '../domain/types'

// ─── Event helpers ─────────────────────────────────────────────────────────

const OPEN_EVENT = 'glyco-open-area'

export function openAreaModal(areaId: string): void {
  document.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { areaId } }))
}

// ─── Focus trap ────────────────────────────────────────────────────────────

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function trapFocus(dialog: HTMLElement, e: KeyboardEvent): void {
  const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE))
  if (focusable.length === 0) return
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (e.key === 'Tab') {
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault()
        last.focus()
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }
}

// ─── Main component ────────────────────────────────────────────────────────

interface AreaDetail {
  area: Area
  roles: Role[]
  people: Person[]
  assignments: Assignment[]
  tasks: TaskItem[]
  mentionCount: number
}

export function AreaModal() {
  const store = useStore()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [areaId, setAreaId] = useState<string | null>(null)

  // Listen for open event from anywhere in the app
  useEffect(() => {
    const handler = (e: Event) => {
      const id = (e as CustomEvent<{ areaId: string }>).detail.areaId
      setAreaId(id)
    }
    document.addEventListener(OPEN_EVENT, handler)
    return () => document.removeEventListener(OPEN_EVENT, handler)
  }, [])

  // Show / hide the <dialog>
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (areaId) {
      try { dialog.showModal() } catch { dialog.setAttribute('open', '') }
      // Focus the close button on open
      requestAnimationFrame(() => {
        dialog.querySelector<HTMLElement>('.area-modal-close')?.focus()
      })
    } else {
      try { if (dialog.open) dialog.close() } catch { /* ignore */ }
    }
  }, [areaId])

  // Keyboard: Escape + focus trap
  useEffect(() => {
    if (!areaId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setAreaId(null)
        return
      }
      const dialog = dialogRef.current
      if (dialog) trapFocus(dialog, e)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [areaId])

  const close = () => setAreaId(null)

  // Compute display data
  const detail: AreaDetail | null = areaId ? buildDetail(store, areaId) : null
  const allAreas = store.document.areas

  const labelId = 'area-modal-title'
  const descId = 'area-modal-desc'

  return (
    <dialog
      ref={dialogRef}
      className="area-modal"
      aria-modal="true"
      aria-labelledby={labelId}
      aria-describedby={descId}
      onClose={close}
      onClick={(e) => { if (e.target === e.currentTarget) close() }}
    >
      <div className="area-modal-inner">
        {detail ? (
          <>
            <div className="area-modal-head">
              <div className="area-modal-title-row">
                <span className="area-modal-badge">Área</span>
                <h2 id={labelId} className="area-modal-title">{detail.area.title}</h2>
              </div>
              <p id={descId} className="area-modal-meta">
                {detail.roles.length} {detail.roles.length === 1 ? 'cargo' : 'cargos'}
                {detail.mentionCount > 0 && ` · ${detail.mentionCount} ${detail.mentionCount === 1 ? 'menção' : 'menções'} no sistema`}
              </p>
              <button
                type="button"
                className="icon-button area-modal-close"
                aria-label="Fechar modal de área"
                onClick={close}
              >
                ×
              </button>
            </div>

            <div className="area-modal-body">
              {/* Roles section */}
              <section aria-labelledby="area-modal-roles-heading">
                <h3 id="area-modal-roles-heading" className="area-modal-section-title">
                  Cargos
                </h3>
                {detail.roles.length === 0 ? (
                  <p className="area-modal-empty">Nenhum cargo nesta área.</p>
                ) : (
                  <ul className="area-modal-role-list">
                    {detail.roles.map((role) => {
                      const personId = detail.assignments.find((a) => a.roleId === role.id)?.personId
                      const occupant = detail.people.find((p) => p.id === personId)?.name
                      return (
                        <li key={role.id} className="area-modal-role-item">
                          <span className="area-modal-role-title">{role.title}</span>
                          <span className="area-modal-role-meta">
                            {occupant ?? <em>Vago</em>}
                          </span>
                          <span className={`area-modal-status pill ${role.status}`}>
                            {statusLabel(role.status)}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>

              {/* Tasks section */}
              {detail.tasks.length > 0 && (
                <section aria-labelledby="area-modal-tasks-heading">
                  <h3 id="area-modal-tasks-heading" className="area-modal-section-title">
                    Tarefas vinculadas
                  </h3>
                  <ul className="area-modal-task-list">
                    {detail.tasks.map((task) => {
                      const role = store.document.roles.find((r) => r.id === task.roleId)
                      return (
                        <li key={task.id} className="area-modal-task-item">
                          <span className="area-modal-task-title">{task.title}</span>
                          {role && (
                            <span className="area-modal-task-meta">{role.title}</span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )}

              {/* Mentions preview */}
              {detail.mentionCount > 0 && (
                <section aria-labelledby="area-modal-mentions-heading">
                  <h3 id="area-modal-mentions-heading" className="area-modal-section-title">
                    Onde é mencionada
                  </h3>
                  <MentionMentions area={detail.area} allAreas={allAreas} />
                </section>
              )}
            </div>
          </>
        ) : (
          <div className="area-modal-head">
            <h2 id={labelId} className="area-modal-title">Área não encontrada</h2>
            <button
              type="button"
              className="icon-button area-modal-close"
              aria-label="Fechar modal de área"
              onClick={close}
            >
              ×
            </button>
          </div>
        )}
      </div>
    </dialog>
  )
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function statusLabel(status: string) {
  if (status === 'active') return 'Ativo'
  if (status === 'away') return 'Férias'
  if (status === 'open') return 'Vaga'
  return 'Proposta'
}

function buildDetail(store: ReturnType<typeof useStore>, areaId: string): AreaDetail | null {
  const area = store.document.areas.find((a) => a.id === areaId)
  if (!area) return null

  const roles = store.document.roles.filter(
    (r) => r.areaId === areaId && r.scenarioId === area.scenarioId,
  )
  const roleIds = new Set(roles.map((r) => r.id))

  // Tasks directly linked to roles in this area
  const tasks = store.document.tasks.filter(
    (t) => t.roleId && roleIds.has(t.roleId) && t.scenarioId === area.scenarioId,
  )

  // Count mentions across all task descriptions and block texts
  let mentionCount = 0
  for (const task of store.document.tasks) {
    const texts = [
      task.description,
      ...task.blocks.map((b) => b.text),
    ]
    for (const t of texts) {
      if (t.toLowerCase().includes(`@${area.title.toLowerCase()}`)) mentionCount++
    }
  }

  return {
    area,
    roles,
    people: store.document.people,
    assignments: store.document.assignments.filter((a) => roleIds.has(a.roleId)),
    tasks,
    mentionCount,
  }
}

/** Shows which tasks/blocks mention this area */
function MentionMentions({
  area,
  allAreas,
}: {
  area: Area
  allAreas: { id: string; title: string }[]
}) {
  const store = useStore()
  const hits: { label: string; text: string }[] = []

  for (const task of store.document.tasks) {
    if (task.description.toLowerCase().includes(`@${area.title.toLowerCase()}`)) {
      hits.push({ label: task.title, text: task.description })
    }
    for (const block of task.blocks) {
      if (block.text.toLowerCase().includes(`@${area.title.toLowerCase()}`)) {
        hits.push({ label: `${task.title} › ${block.title}`, text: block.text })
      }
    }
  }

  if (hits.length === 0) return null

  return (
    <ul className="area-modal-mentions-list">
      {hits.slice(0, 6).map((hit, i) => (
        <li key={i} className="area-modal-mention-item">
          <span className="area-modal-mention-source">{hit.label}</span>
          <span className="area-modal-mention-preview">
            <MentionDisplay text={hit.text.slice(0, 120)} areas={allAreas} />
            {hit.text.length > 120 && '…'}
          </span>
        </li>
      ))}
    </ul>
  )
}
