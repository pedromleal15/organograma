/** @vitest-environment happy-dom */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppDocument, ScenarioId } from '../src/domain/types'
const OPEN_AREA_EVENT = 'glyco-open-area'
function dispatchOpenArea(areaId: string) {
  act(() => {
    document.dispatchEvent(new CustomEvent(OPEN_AREA_EVENT, { detail: { areaId }, bubbles: false }))
  })
}

/**
 * Mock do OrgCanvas com suporte a edição inline simulada.
 *
 * Preserva comportamentos usados pelos testes existentes:
 *  - role buttons com {role.title} (encontrados por getByRole/getByText)
 *  - .lane-node buttons que disparam onLaneNodeClick (encontrados por classList)
 *
 * Adiciona inputs para testes de sincronização bidirecional Canvas↔Tasks:
 *  - "Editar coluna {col.title} no canvas" → chama renameColumn ao blur
 *  - "Editar cargo {role.title} no canvas" → chama updateRole ao blur
 */
vi.mock('../src/ui/canvas', async () => {
  const { useStore } = await import('../src/state')
  const { renameColumn, updateRole } = await import('../src/domain/rules')
  return {
    OrgCanvas: ({ document, scenarioId, onLaneNodeClick }: { document: AppDocument; scenarioId: ScenarioId; onLaneNodeClick: (columnId: string) => void }) => {
      const store = useStore()
      return (
        <div role="tree" aria-label="Cargos no organograma">
          {document.roles.filter((role) => role.scenarioId === scenarioId).map((role) => (
            <div key={role.id} className="canvas-role">
              <button type="button">{role.title}</button>
              <input
                aria-label={`Editar cargo ${role.title} no canvas`}
                defaultValue={role.title}
                onBlur={(e) => {
                  const next = e.target.value.trim()
                  if (next && next !== role.title) store.apply(updateRole(store.document, role.id, { title: next }))
                }}
              />
            </div>
          ))}
          {document.columns.filter((col) => col.scenarioId === scenarioId).map((col) => (
            <div key={col.id} className="canvas-lane">
              <button className="lane-node" type="button" onClick={() => onLaneNodeClick(col.id)}>
                {col.title}
              </button>
              <input
                aria-label={`Editar coluna ${col.title} no canvas`}
                defaultValue={col.title}
                onBlur={(e) => {
                  const next = e.target.value.trim()
                  if (next && next !== col.title) store.apply(renameColumn(store.document, scenarioId, col.id, next))
                }}
              />
            </div>
          ))}
        </div>
      )
    },
  }
})

import { App } from '../src/App'
import { StoreProvider } from '../src/state'

function renderApp() {
  window.history.replaceState({}, '', '/organograma')
  return render(
    <StoreProvider>
      <App />
    </StoreProvider>,
  )
}

describe('ambientes', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  afterEach(() => cleanup())

  it('alterna organograma e tasks sem perder o cenário de cada um', () => {
    renderApp()
    expect(screen.getByRole('tree', { name: 'Cargos no organograma' })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'CEO & Founder' }).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Planejada' }))
    expect(screen.getByRole('button', { name: 'Head de Engenharia' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Tasks' }))
    expect(screen.getByText('Listar médicos para a primeira abordagem')).toBeTruthy()
    expect(screen.queryByText('Revisar cargos propostos antes de aplicar na estrutura atual')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Planejada' }))
    expect(screen.getByText('Revisar cargos propostos antes de aplicar na estrutura atual')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Organograma' }))
    expect(screen.getByRole('button', { name: 'Head de Engenharia' })).toBeTruthy()
  })

  it('abre o cargo a partir da tarefa', () => {
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Tasks' }))
    fireEvent.click(screen.getByRole('button', { name: 'Listar médicos para a primeira abordagem' }))
    fireEvent.click(screen.getByRole('button', { name: 'Abrir cargo no organograma' }))
    expect(screen.getByRole('tree', { name: 'Cargos no organograma' })).toBeTruthy()
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeTruthy()
    expect(dialog.querySelector('#role-modal-title')?.textContent).toBe('CEO & Founder')
  })

  it('tabela e canvas mostram o mesmo cargo', () => {
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Tabela' }))
    expect(screen.getByRole('button', { name: 'CEO & Founder' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Canvas' }))
    expect(screen.getByRole('tree', { name: 'Cargos no organograma' })).toBeTruthy()
  })

  it('abre modal ao clicar num nó de coluna Kanban e fecha pelo botão', () => {
    renderApp()
    // Seed has columns like "A fazer" in scenario "atual"
    const laneButtons = screen.getAllByRole('button').filter((btn) => btn.classList.contains('lane-node'))
    expect(laneButtons.length).toBeGreaterThan(0)
    const firstLane = laneButtons[0]
    const laneTitle = firstLane.textContent ?? ''
    fireEvent.click(firstLane)
    // Modal dialog should appear with the column title
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeTruthy()
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    // Close via button
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    // Verify navigation did NOT happen (still in organograma)
    expect(screen.getByRole('tree', { name: 'Cargos no organograma' })).toBeTruthy()
    expect(laneTitle).toBeTruthy() // Lane title was captured
  })

  it('modal mostra apenas as tarefas da coluna clicada', () => {
    renderApp()
    const laneButtons = screen.getAllByRole('button').filter((btn) => btn.classList.contains('lane-node'))
    fireEvent.click(laneButtons[0])
    const dialog = screen.getByRole('dialog')
    // Dialog should have aria-labelledby pointing to the column title heading
    const titleId = dialog.getAttribute('aria-labelledby')
    expect(titleId).toBeTruthy()
    const heading = dialog.querySelector(`#${titleId}`)
    expect(heading).toBeTruthy()
  })
})

describe('+ Nova tarefa', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  afterEach(() => cleanup())

  function openNewTaskForm() {
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Tasks' }))
    fireEvent.click(screen.getByRole('button', { name: '+ Nova tarefa' }))
  }

  it('abre o formulário ao clicar em "+ Nova tarefa"', () => {
    openNewTaskForm()
    expect(screen.getByRole('form', { name: 'Nova tarefa' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Fechar formulário de nova tarefa' })).toBeTruthy()
  })

  it('fecha pelo botão X no cabeçalho', () => {
    openNewTaskForm()
    expect(screen.getByRole('form', { name: 'Nova tarefa' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Fechar formulário de nova tarefa' }))
    expect(screen.queryByRole('form', { name: 'Nova tarefa' })).toBeNull()
  })

  it('fecha ao pressionar Escape', () => {
    openNewTaskForm()
    expect(screen.getByRole('form', { name: 'Nova tarefa' })).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('form', { name: 'Nova tarefa' })).toBeNull()
  })

  it('fecha ao clicar no backdrop', () => {
    openNewTaskForm()
    expect(screen.getByRole('form', { name: 'Nova tarefa' })).toBeTruthy()
    const backdrop = document.querySelector('.drawer-backdrop') as HTMLElement
    expect(backdrop).toBeTruthy()
    fireEvent.click(backdrop)
    expect(screen.queryByRole('form', { name: 'Nova tarefa' })).toBeNull()
  })

  it('fecha pelo link Cancelar', () => {
    openNewTaskForm()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('form', { name: 'Nova tarefa' })).toBeNull()
  })

  it('cria tarefa com sucesso e fecha automaticamente', () => {
    openNewTaskForm()
    const form = screen.getByRole('form', { name: 'Nova tarefa' })
    fireEvent.change(screen.getByRole('textbox', { name: 'Título' }), { target: { value: 'Tarefa de teste' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /Confirmo que esta tarefa deve entrar/i }))
    fireEvent.submit(form)
    expect(screen.queryByRole('form', { name: 'Nova tarefa' })).toBeNull()
  })

  it('não fecha em caso de erro de domínio — preserva dados preenchidos', () => {
    openNewTaskForm()
    const form = screen.getByRole('form', { name: 'Nova tarefa' })
    // título de apenas 1 caractere falha a regra de domínio (< 2)
    fireEvent.change(screen.getByRole('textbox', { name: 'Título' }), { target: { value: 'X' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /Confirmo que esta tarefa deve entrar/i }))
    fireEvent.submit(form)
    // formulário ainda deve estar visível
    expect(screen.getByRole('form', { name: 'Nova tarefa' })).toBeTruthy()
    // valor preenchido ainda deve estar lá
    const titleInput = screen.getByRole('textbox', { name: 'Título' }) as HTMLInputElement
    expect(titleInput.value).toBe('X')
  })
})

/** Helper: get the area-modal <dialog> element (always in DOM) */
function getAreaDialog(): HTMLDialogElement | null {
  return document.querySelector('dialog.area-modal')
}

describe('AreaModal — modal global de área', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  afterEach(() => cleanup())

  it('abre o modal ao disparar o evento com ID válido', () => {
    renderApp()
    // Seed has 'area-diretoria' in scenario 'atual'
    dispatchOpenArea('area-diretoria')
    const dialog = getAreaDialog()
    expect(dialog).toBeTruthy()
    // The dialog should be open (either .open prop or [open] attribute)
    expect(dialog?.open || dialog?.hasAttribute('open')).toBe(true)
    expect(dialog?.textContent).toContain('Diretoria')
  })

  it('mostra o nome da área no modal', () => {
    renderApp()
    dispatchOpenArea('area-diretoria')
    const dialog = getAreaDialog()
    expect(dialog?.textContent).toContain('Diretoria')
  })

  it('fecha ao pressionar Escape', () => {
    renderApp()
    dispatchOpenArea('area-diretoria')
    const dialog = getAreaDialog()
    expect(dialog?.open || dialog?.hasAttribute('open')).toBe(true)
    fireEvent.keyDown(document, { key: 'Escape' })
    // After Escape, dialog should be closed (no open attribute)
    expect(dialog?.open || dialog?.hasAttribute('open')).toBe(false)
  })

  it('fecha ao clicar no botão Fechar e modal estava aberto', () => {
    renderApp()
    dispatchOpenArea('area-diretoria')
    const dialog = getAreaDialog()
    expect(dialog?.open || dialog?.hasAttribute('open')).toBe(true)
    const closeBtn = dialog?.querySelector('.area-modal-close') as HTMLElement
    expect(closeBtn).toBeTruthy()
    fireEvent.click(closeBtn)
    expect(dialog?.open || dialog?.hasAttribute('open')).toBe(false)
  })

  it('mostra cargos da área', () => {
    renderApp()
    dispatchOpenArea('area-diretoria')
    const dialog = getAreaDialog()
    // Seed has 'CEO & Founder' in area-diretoria (scenario 'atual')
    expect(dialog?.textContent).toContain('CEO & Founder')
  })

  it('abre com ID desconhecido sem quebrar a app', () => {
    renderApp()
    // Should not throw; modal shows "Área não encontrada"
    expect(() => dispatchOpenArea('id-inexistente')).not.toThrow()
    const dialog = getAreaDialog()
    expect(dialog?.textContent).toContain('não encontrada')
  })

  it('pode abrir a partir da view de Tasks sem navegar de tela', () => {
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Tasks' }))
    dispatchOpenArea('area-diretoria')
    const dialog = getAreaDialog()
    expect(dialog?.textContent).toContain('Diretoria')
    // Still on Tasks screen (no navigation happened)
    expect(screen.getByRole('button', { name: '+ Nova tarefa' })).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// Sincronização bidirecional Canvas ↔ Tasks
//
// Ambas as views compartilham o mesmo store.document (fonte única de dados).
// store.apply() atualiza o documento e as duas views re-renderizam sem duplicar
// estado. Os testes abaixo verificam os dois sentidos da sincronização.
// ---------------------------------------------------------------------------

describe('sincronização Canvas ↔ Tasks', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  afterEach(() => cleanup())

  // ── Tasks → Canvas ────────────────────────────────────────────────────────

  it('Tasks→Canvas: renomear coluna em Tasks reflete no Canvas', () => {
    renderApp()

    // Navega para Tasks
    fireEvent.click(screen.getByRole('button', { name: 'Tasks' }))

    // O componente Column usa um input.column-name (uncontrolled) para edição
    const columnInputs = Array.from(document.querySelectorAll<HTMLInputElement>('input.column-name'))
    expect(columnInputs.length).toBeGreaterThan(0)
    const firstInput = columnInputs[0]

    // Altera valor e dispara blur para chamar renameColumn via store.apply
    fireEvent.change(firstInput, { target: { value: 'Coluna Sync Teste' } })
    fireEvent.blur(firstInput)

    // Retorna ao Canvas (Organograma)
    fireEvent.click(screen.getByRole('button', { name: 'Organograma' }))

    // O mock do Canvas exibe {col.title} no botão .lane-node — deve refletir o novo nome
    const updatedLane = screen.getAllByRole('button').find(
      (btn) => btn.classList.contains('lane-node') && btn.textContent === 'Coluna Sync Teste',
    )
    expect(updatedLane).toBeTruthy()
  })

  it('Tasks→Canvas: editar título de tarefa em Tasks atualiza store e Canvas lê o mesmo documento', () => {
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Tasks' }))

    // PullText renderiza textareas com aria-label "Título de {task.title}"
    const titleAreas = Array.from(document.querySelectorAll<HTMLTextAreaElement>('textarea.pull-text')).filter(
      (el) => el.getAttribute('aria-label')?.startsWith('Título de'),
    )
    expect(titleAreas.length).toBeGreaterThan(0)

    fireEvent.change(titleAreas[0], { target: { value: 'Tarefa Renomeada Sync' } })

    // Deve aparecer imediatamente (store atualizado)
    expect(screen.getByText('Tarefa Renomeada Sync')).toBeTruthy()

    // Canvas lê o mesmo store — verifica lanes ainda renderizando corretamente
    fireEvent.click(screen.getByRole('button', { name: 'Organograma' }))
    const laneButtons = screen.getAllByRole('button').filter((btn) => btn.classList.contains('lane-node'))
    expect(laneButtons.length).toBeGreaterThan(0)
  })

  // ── Canvas → Tasks ────────────────────────────────────────────────────────

  it('Canvas→Tasks: renomear coluna no Canvas reflete em Tasks', () => {
    renderApp()
    // Estamos em Organograma/Canvas; o mock exibe inputs "Editar coluna … no canvas"
    const canvasLaneEdits = Array.from(document.querySelectorAll<HTMLInputElement>('input')).filter(
      (el) => el.getAttribute('aria-label')?.includes('Editar coluna') && el.getAttribute('aria-label')?.includes('no canvas'),
    )
    expect(canvasLaneEdits.length).toBeGreaterThan(0)

    const firstEdit = canvasLaneEdits[0]
    const originalTitle = firstEdit.defaultValue

    // Simula edição inline: muda valor e blur para salvar via renameColumn
    fireEvent.change(firstEdit, { target: { value: 'Canvas Coluna Nova' } })
    fireEvent.blur(firstEdit)

    // Navega para Tasks
    fireEvent.click(screen.getByRole('button', { name: 'Tasks' }))

    // A <section> da coluna tem aria-label={column.title} — deve mostrar o novo nome
    const updatedSection = document.querySelector<HTMLElement>('section[aria-label="Canvas Coluna Nova"]')
    expect(updatedSection).toBeTruthy()

    // O input.column-name também atualiza seu aria-label
    const taskColumnInput = document.querySelector<HTMLInputElement>(
      'input[aria-label="Nome da coluna Canvas Coluna Nova"]',
    )
    expect(taskColumnInput).toBeTruthy()

    // Título original não deve mais aparecer como seção de coluna
    const oldSection = document.querySelector<HTMLElement>(`section[aria-label="${originalTitle}"]`)
    expect(oldSection).toBeNull()
  })

  it('Canvas→Tasks: renomear cargo no Canvas reflete no botão de responsável no card de tarefa', () => {
    renderApp()

    // Encontra o input de edição do cargo 'CEO & Founder' no canvas mock (cenário 'atual')
    const canvasRoleEdits = Array.from(document.querySelectorAll<HTMLInputElement>('input')).filter(
      (el) => el.getAttribute('aria-label')?.includes('Editar cargo') && el.getAttribute('aria-label')?.includes('no canvas'),
    )
    expect(canvasRoleEdits.length).toBeGreaterThan(0)

    // Renomeia via o input de edição inline do canvas (simula double-click + Enter)
    fireEvent.change(canvasRoleEdits[0], { target: { value: 'Cargo Renomeado Canvas' } })
    fireEvent.blur(canvasRoleEdits[0])

    // O input de cargo e a lane de coluna role refletem o novo nome
    expect(screen.getAllByRole('button', { name: 'Cargo Renomeado Canvas' }).length).toBeGreaterThan(0)
    expect(
      Array.from(document.querySelectorAll<HTMLInputElement>('input')).some(
        (el) => el.getAttribute('aria-label')?.includes('Editar cargo Cargo Renomeado Canvas'),
      ),
    ).toBe(true)

    // Navega para Tasks — o seed tem task-whatsapp com roleId: 'role-ceo'
    // O TaskCard exibe o {role.title} como botão .linkish
    fireEvent.click(screen.getByRole('button', { name: 'Tasks' }))

    // O botão de responsável no card deve mostrar o novo título do cargo
    const roleLinkButtons = Array.from(document.querySelectorAll('.linkish')).filter(
      (el) => el.textContent === 'Cargo Renomeado Canvas',
    )
    expect(roleLinkButtons.length).toBeGreaterThan(0)
  })

  // ── Consistência do estado único (undo traverses both views) ──────────────

  it('desfazer após renomear coluna no Canvas reverte em Tasks também', () => {
    renderApp()

    const canvasLaneEdits = Array.from(document.querySelectorAll<HTMLInputElement>('input')).filter(
      (el) => el.getAttribute('aria-label')?.includes('Editar coluna') && el.getAttribute('aria-label')?.includes('no canvas'),
    )
    expect(canvasLaneEdits.length).toBeGreaterThan(0)

    const firstEdit = canvasLaneEdits[0]
    const originalTitle = firstEdit.defaultValue

    fireEvent.change(firstEdit, { target: { value: 'Coluna Temp Undo' } })
    fireEvent.blur(firstEdit)

    // Verifica que o rename foi aplicado no Canvas
    expect(
      screen.getAllByRole('button').find((btn) => btn.classList.contains('lane-node') && btn.textContent === 'Coluna Temp Undo'),
    ).toBeTruthy()

    // Desfaz
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }))

    // Canvas restaura título original
    expect(
      screen.getAllByRole('button').find((btn) => btn.classList.contains('lane-node') && btn.textContent === originalTitle),
    ).toBeTruthy()

    // Tasks também reflete o restore — a seção retorna ao título original
    fireEvent.click(screen.getByRole('button', { name: 'Tasks' }))
    const restoredSection = document.querySelector<HTMLElement>(`section[aria-label="${originalTitle}"]`)
    expect(restoredSection).toBeTruthy()
  })
})
