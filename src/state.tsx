import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { parseDocument } from './domain/rules'
import { defaultBoardId, ensureBoardColumns, ensureRoleColumns } from './domain/board'
import { createSeed, ensureCanonicalAreas } from './domain/seed'
import { DOCUMENT_KEY, DRAFT_KEY, LEGACY_KEY, saveDocument, type KeyValue } from './domain/sync'
import type { AppDocument, Result, ScenarioId } from './domain/types'

const UI_KEY = 'glyco-org-ui'

export type OrgView = 'canvas' | 'matriz' | 'tabela'
export type TaskView = 'quadro' | 'lista' | 'metas' | 'organograma'
export type Environment = 'organograma' | 'tasks' | 'configuracoes' | 'conexoes'

interface UiMemory {
  scenarioByEnv: { organograma: ScenarioId; tasks: ScenarioId }
  orgView: OrgView
  taskView: TaskView
  search: string
  taskOrigin: string
  activeBoardByScenario: { atual: string; planejada: string }
}

interface History {
  past: AppDocument[]
  present: AppDocument
  future: AppDocument[]
}

interface Store {
  document: AppDocument
  error: string
  notice: string
  environment: Environment
  scenarioId: ScenarioId
  orgView: OrgView
  taskView: TaskView
  search: string
  taskOrigin: string
  activeBoardId: string
  selectedRoleId: string
  selectedTaskId: string
  canUndo: boolean
  canRedo: boolean
  legacyPreview: string | null
  apply: (result: Result<AppDocument>) => boolean
  undo: () => void
  redo: () => void
  replace: (document: AppDocument) => void
  setEnvironment: (environment: Environment) => void
  setScenario: (scenarioId: ScenarioId) => void
  setScenarioFor: (environment: 'organograma' | 'tasks', scenarioId: ScenarioId) => void
  setOrgView: (view: OrgView) => void
  setTaskView: (view: TaskView) => void
  setSearch: (search: string) => void
  setTaskOrigin: (origin: string) => void
  setActiveBoardId: (boardId: string) => void
  setSelectedRoleId: (id: string) => void
  setSelectedTaskId: (id: string) => void
  dismissLegacy: () => void
  sync: () => Promise<void>
}

const StoreContext = createContext<Store | null>(null)

function browserStorage(): KeyValue {
  return localStorage
}

function readDocument(): { document: AppDocument; draft: boolean } {
  try {
    const draft = localStorage.getItem(DRAFT_KEY)
    const saved = draft || localStorage.getItem(DOCUMENT_KEY)
    if (saved) {
      const parsed = parseDocument(JSON.parse(saved))
      if (parsed.ok) return { document: parsed.value, draft: Boolean(draft) }
    }
  } catch {
    /* usa a semente */
  }
  return { document: createSeed(), draft: false }
}

function readUi(): UiMemory {
  const fallback: UiMemory = {
    scenarioByEnv: { organograma: 'atual', tasks: 'atual' },
    orgView: 'canvas',
    taskView: 'quadro',
    search: '',
    taskOrigin: '',
    activeBoardByScenario: { atual: defaultBoardId('atual'), planejada: defaultBoardId('planejada') },
  }
  try {
    const raw = sessionStorage.getItem(UI_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<UiMemory>
    return {
      ...fallback,
      ...parsed,
      scenarioByEnv: { ...fallback.scenarioByEnv, ...parsed?.scenarioByEnv },
      activeBoardByScenario: { ...fallback.activeBoardByScenario, ...parsed?.activeBoardByScenario },
    }
  } catch {
    return fallback
  }
}

function environmentFromPath(path: string): Environment {
  if (path.startsWith('/tasks')) return 'tasks'
  if (path.startsWith('/configuracoes')) return 'configuracoes'
  if (path.startsWith('/conexoes')) return 'conexoes'
  return 'organograma'
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const initial = readDocument()
  const ui = readUi()
  const [history, setHistory] = useState<History>({ past: [], present: initial.document, future: [] })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(initial.draft ? 'Rascunho local preservado. A API não confirmou o último salvamento.' : '')
  const [environment, setEnvironmentState] = useState<Environment>(environmentFromPath(window.location.pathname))
  const [memory, setMemory] = useState<UiMemory>(ui)
  const [selectedRoleId, setSelectedRoleId] = useState(() => new URLSearchParams(window.location.search).get('cargo') ?? '')
  const [selectedTaskId, setSelectedTaskId] = useState(() => new URLSearchParams(window.location.search).get('tarefa') ?? '')
  const [legacyPreview, setLegacyPreview] = useState<string | null>(() => localStorage.getItem(LEGACY_KEY))

  const scenarioId = environment === 'tasks' ? memory.scenarioByEnv.tasks : memory.scenarioByEnv.organograma

  useEffect(() => {
    const onPop = () => setEnvironmentState(environmentFromPath(window.location.pathname))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    sessionStorage.setItem(UI_KEY, JSON.stringify(memory))
  }, [memory])

  useEffect(() => {
    localStorage.setItem(DOCUMENT_KEY, JSON.stringify(history.present))
  }, [history.present])

  const api = useMemo<Store>(() => {
    const apply = (result: Result<AppDocument>) => {
      if (!result.ok) {
        setError(result.error)
        return false
      }
      setError('')
      setHistory((current) => ({
        past: [...current.past, current.present].slice(-50),
        present: result.value,
        future: [],
      }))
      return true
    }
    return {
      document: history.present,
      error,
      notice,
      environment,
      scenarioId,
      orgView: memory.orgView,
      taskView: memory.taskView,
      search: memory.search,
      taskOrigin: memory.taskOrigin,
      activeBoardId: memory.activeBoardByScenario?.[scenarioId] ?? defaultBoardId(scenarioId),
      selectedRoleId,
      selectedTaskId,
      canUndo: history.past.length > 0,
      canRedo: history.future.length > 0,
      legacyPreview,
      apply,
      undo: () => {
        setHistory((current) => {
          const previous = current.past.at(-1)
          if (!previous) return current
          return { past: current.past.slice(0, -1), present: previous, future: [current.present, ...current.future] }
        })
      },
      redo: () => {
        setHistory((current) => {
          const [next, ...rest] = current.future
          if (!next) return current
          return { past: [...current.past, current.present], present: next, future: rest }
        })
      },
      replace: (document) => {
        setHistory((current) => ({ past: [...current.past, current.present].slice(-50), present: document, future: [] }))
      },
      setEnvironment: (next) => {
        const path = next === 'organograma' ? '/organograma' : `/${next}`
        window.history.pushState({}, '', path)
        setEnvironmentState(next)
      },
      setScenario: (next) => {
        setMemory((current) => ({
          ...current,
          scenarioByEnv: {
            ...current.scenarioByEnv,
            [environment === 'tasks' ? 'tasks' : 'organograma']: next,
          },
        }))
        setSelectedRoleId('')
        setSelectedTaskId('')
      },
      setScenarioFor: (target, next) => {
        setMemory((current) => ({
          ...current,
          scenarioByEnv: {
            ...current.scenarioByEnv,
            [target]: next,
          },
        }))
      },
      setOrgView: (orgView) => setMemory((current) => ({ ...current, orgView })),
      setTaskView: (taskView) => setMemory((current) => ({ ...current, taskView })),
      setSearch: (search) => setMemory((current) => ({ ...current, search })),
      setTaskOrigin: (taskOrigin) => setMemory((current) => ({ ...current, taskOrigin })),
      setActiveBoardId: (boardId) => setMemory((current) => ({
        ...current,
        activeBoardByScenario: {
          ...current.activeBoardByScenario,
          [scenarioId]: boardId,
        },
      })),
      setSelectedRoleId,
      setSelectedTaskId,
      dismissLegacy: () => setLegacyPreview(null),
      sync: async () => {
        const outcome = await saveDocument(history.present, browserStorage(), async (document) => {
          const response = await fetch('/api/v1/document', {
            method: 'PUT',
            headers: { 'content-type': 'application/json', 'if-match': String(document.revision) },
            body: JSON.stringify(document),
          })
          if (response.status === 409) {
            const remote = (await response.json()) as AppDocument
            return { conflict: remote }
          }
          if (!response.ok) throw new Error(`API respondeu ${response.status}.`)
          return (await response.json()) as { revision: number; document: AppDocument }
        })
        if (outcome.status === 'saved') {
          setNotice('Salvo na API.')
          setHistory((current) => ({
            ...current,
            present: ensureRoleColumns(ensureCanonicalAreas(ensureBoardColumns(outcome.document))),
          }))
        } else if (outcome.status === 'draft') {
          setNotice(`Rascunho preservado neste navegador. ${outcome.error}`)
        } else {
          setNotice('Conflito de revisão. O documento remoto não substituiu o seu até você comparar.')
          setError(`Remoto está na revisão ${outcome.remote.revision}. O seu está na ${outcome.local.revision}.`)
        }
      },
    }
  }, [environment, error, history, legacyPreview, memory, notice, scenarioId, selectedRoleId, selectedTaskId])

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>
}

export function useStore(): Store {
  const store = useContext(StoreContext)
  if (!store) throw new Error('Store ausente')
  return store
}
