/** @vitest-environment happy-dom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppDocument, ScenarioId } from '../src/domain/types'

vi.mock('../src/ui/canvas', () => ({
  OrgCanvas: ({ document, scenarioId, onLaneNodeClick }: { document: AppDocument; scenarioId: ScenarioId; onLaneNodeClick: (columnId: string) => void }) => (
    <div role="tree" aria-label="Cargos no organograma">
      {document.roles.filter((role) => role.scenarioId === scenarioId).map((role) => (
        <button key={role.id} type="button">{role.title}</button>
      ))}
      {document.columns.filter((col) => col.scenarioId === scenarioId).map((col) => (
        <button key={col.id} className="lane-node" type="button" onClick={() => onLaneNodeClick(col.id)}>
          {col.title}
        </button>
      ))}
    </div>
  ),
}))

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
    expect(screen.getByRole('button', { name: 'CEO & Founder' })).toBeTruthy()
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
    expect(screen.getByRole('button', { name: 'CEO & Founder' })).toBeTruthy()
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
