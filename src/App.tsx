import { requestNewRole, Organograma } from './ui/organograma'
import { Connections, Settings } from './ui/pages'
import { requestNewBoard, requestNewTask, Tasks } from './ui/tasks'
import { AreaModal } from './ui/area-modal'
import { useStore } from './state'
import { defaultBoardId, scenarioBoards } from './domain/board'
import './styles.css'

export function App() {
  const store = useStore()
  const organograma = store.environment === 'organograma'
  const tasks = store.environment === 'tasks'

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <GlycoLogo />
          <div>
            <strong>Glyco</strong>
            <span>Estrutura e execução</span>
          </div>
        </div>
        <div className="env-switch" role="group" aria-label="Ambiente">
          <button type="button" aria-pressed={organograma} onClick={() => {
            store.setOrgView('canvas')
            store.setEnvironment('organograma')
          }}>Organograma</button>
          <button type="button" aria-pressed={tasks} onClick={() => store.setEnvironment('tasks')}>Tasks</button>
        </div>
        <p className="nav-label">{organograma ? 'Visualização' : tasks ? 'Execução' : 'Conta'}</p>
        {organograma && (
          <div className="view-switch" role="group" aria-label="Visualização do organograma">
            <button type="button" aria-pressed={store.orgView === 'canvas'} onClick={() => store.setOrgView('canvas')}>Canvas</button>
            <button type="button" aria-pressed={store.orgView === 'matriz'} onClick={() => store.setOrgView('matriz')}>Matriz</button>
            <button type="button" aria-pressed={store.orgView === 'tabela'} onClick={() => store.setOrgView('tabela')}>Tabela</button>
          </div>
        )}
        {tasks && (
          <div className="view-switch" role="group" aria-label="Visualização de tasks">
            <button type="button" aria-pressed={store.taskView === 'quadro'} onClick={() => store.setTaskView('quadro')}>Quadro</button>
            <button type="button" aria-pressed={store.taskView === 'lista'} onClick={() => store.setTaskView('lista')}>Lista</button>
            <button type="button" aria-pressed={store.taskView === 'metas'} onClick={() => store.setTaskView('metas')}>Metas</button>
            <button type="button" aria-pressed={store.taskView === 'organograma'} onClick={() => {
              store.setOrgView('canvas')
              store.setTaskView('organograma')
            }}>Organograma</button>
          </div>
        )}
        {tasks && store.taskView === 'organograma' && (
          <div className="view-switch" role="group" aria-label="Visualização do organograma em tasks">
            <button type="button" aria-pressed={store.orgView === 'canvas'} onClick={() => store.setOrgView('canvas')}>Canvas</button>
            <button type="button" aria-pressed={store.orgView === 'matriz'} onClick={() => store.setOrgView('matriz')}>Matriz</button>
            <button type="button" aria-pressed={store.orgView === 'tabela'} onClick={() => store.setOrgView('tabela')}>Tabela</button>
          </div>
        )}
        <div className="sidebar-foot">
          <button className="side-link" type="button" aria-current={store.environment === 'configuracoes' ? 'page' : undefined} onClick={() => store.setEnvironment('configuracoes')}>Configurações</button>
          <button className="side-link" type="button" aria-current={store.environment === 'conexoes' ? 'page' : undefined} onClick={() => store.setEnvironment('conexoes')}>Conexões</button>
          <div className="user-pill"><span className="avatar">PL</span><span>Pedro Leal<br />sessão local</span></div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <p className="crumb">Glyco / <b>{organograma ? 'Organograma' : tasks ? (store.taskView === 'organograma' ? 'Tasks / Organograma' : 'Tasks') : store.environment === 'conexoes' ? 'Conexões' : 'Configurações'}</b></p>
          {tasks && store.taskView === 'quadro' && (
            <>
              <select
                className="board-switch"
                aria-label="Quadro ativo"
                value={store.activeBoardId}
                onChange={(event) => store.setActiveBoardId(event.target.value)}
              >
                {scenarioBoards(store.document, store.scenarioId).map((board) => (
                  <option key={board.id} value={board.id}>{board.title}</option>
                ))}
                {scenarioBoards(store.document, store.scenarioId).length === 0 && (
                  <option value={defaultBoardId(store.scenarioId)}>Quadro principal</option>
                )}
              </select>
              <button className="ghost" type="button" onClick={() => requestNewBoard()}>Novo quadro</button>
            </>
          )}
          {(organograma || tasks) && (
            <div className="env-switch" role="group" aria-label="Cenário">
              <button type="button" aria-pressed={store.scenarioId === 'atual'} onClick={() => store.setScenario('atual')}>Atual</button>
              <button type="button" aria-pressed={store.scenarioId === 'planejada'} onClick={() => store.setScenario('planejada')}>Planejada</button>
            </div>
          )}
          {(organograma || tasks) && (
            <input className="search" type="search" placeholder="Buscar" aria-label="Buscar" value={store.search} onChange={(event) => store.setSearch(event.target.value)} />
          )}
          {tasks && store.taskView !== 'organograma' && (
            <select aria-label="Origem" value={store.taskOrigin} onChange={(event) => store.setTaskOrigin(event.target.value)}>
              <option value="">Todas as origens</option>
              <option value="local">Próprias</option>
              <option value="github">GitHub</option>
              <option value="google-tasks">Google Tasks</option>
              <option value="mcp">MCP</option>
            </select>
          )}
          <button className="ghost" type="button" onClick={store.undo} disabled={!store.canUndo}>Desfazer</button>
          {(organograma || (tasks && store.taskView === 'organograma')) && <button className="primary" type="button" onClick={() => requestNewRole()}>+ Novo cargo</button>}
          {tasks && store.taskView !== 'organograma' && <button className="primary" type="button" onClick={() => requestNewTask()}>+ Nova tarefa</button>}
        </header>
        <p className="sr-only" aria-live="polite">{store.error || store.notice}</p>
        {(store.error || store.notice) && <div className="banner" role="status">{store.error || store.notice}</div>}
        <main>
          {organograma && <Organograma />}
          {tasks && <Tasks />}
          {store.environment === 'configuracoes' && <Settings />}
          {store.environment === 'conexoes' && <Connections />}
        </main>
      </div>
      {/* Global area modal — mounted once, opened via openAreaModal() from anywhere */}
      <AreaModal />
    </div>
  )
}

const GLYCO_LOGO_PATHS = [
  'M223.062 33.8539C223.969 33.7733 224.879 33.7327 225.788 33.7318C235.111 33.8069 241.601 39.0408 245.192 47.3671C250.405 59.451 245.51 74.1633 252.478 85.4593C260.635 98.6841 285.387 100.993 284.694 119.75C284.067 141.71 252.837 139.803 249.147 161.131C246.885 174.216 250.154 189.689 240.039 199.725C235.247 204.478 230.244 206.032 223.544 205.929C218.744 205.179 215.795 204.105 211.871 201.118C207.914 198.107 205.051 192.316 204.645 187.382C202.786 164.744 229.015 161.987 239.942 148.776C247.172 140.035 248.251 121.697 247.02 110.787C245.027 93.1522 239.498 88.4163 224.647 79.3825C221.224 77.3004 217.728 75.0933 214.557 72.5979C209.269 68.4369 205.482 63.293 204.65 56.4848C204.03 51.4015 205.778 45.083 209.086 41.1682C212.788 36.787 217.415 34.4431 223.062 33.8539Z',
  'M104.311 33.8569C113.982 32.9556 122.467 37.5305 126.002 46.8382C127.11 49.7537 127.39 53.2216 127.139 56.304C125.403 77.6541 96.971 78.2816 88.9829 95.3254C85.0731 104.158 84.1473 113.512 84.4311 123.061C84.6604 130.775 86.0963 141.062 90.9463 147.363C100.336 159.561 120.079 162.944 126.063 178.105C127.914 182.798 127.526 189.76 125.317 194.272C122.676 199.892 118.154 202.964 112.445 205.036C105.263 206.83 98.9772 205.906 93.1295 201.154C83.0462 192.96 84.2671 178.879 83.494 167.192C82.2709 148.704 68.1377 145.091 55.3912 135.598C51.0434 132.252 47.6092 127.877 47.0255 122.237C44.957 102.249 70.2629 99.4678 79.0069 87.0965C88.2131 74.0708 79.473 53.9758 90.3833 41.137C94.1385 36.7179 98.5958 34.4047 104.311 33.8569Z',
  'M138.046 71.7982C140.261 71.393 144.142 72.034 146.283 72.7804C164.136 79.002 160.067 103.211 171.944 114.304C181.782 123.493 198.851 122.447 208.57 132.189C215.802 139.267 217.122 148.794 211.43 157.293C207.217 163.585 202.783 166.247 195.392 167.931C191.923 168.495 189.379 167.594 186.296 166.295C169 159.002 171.752 134.887 160.345 124.231C150.924 116.033 136.379 116.097 126.586 108.752C110.944 97.0195 119.563 74.559 138.046 71.7982Z',
] as const

function GlycoLogo() {
  return (
    <svg className="glyco-logo" viewBox="0 0 361 226" role="img" aria-label="Glyco">
      {GLYCO_LOGO_PATHS.map((path) => <path key={path.slice(0, 16)} d={path} fill="currentColor" />)}
    </svg>
  )
}
