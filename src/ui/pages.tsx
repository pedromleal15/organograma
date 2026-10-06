import { useState } from 'react'
import { probeMcp } from '../domain/connectors'
import { replaceDocument } from '../domain/rules'
import { previewLegacy } from '../domain/sync'
import { useStore } from '../state'
import { useTheme } from '../theme'

export function Settings() {
  const store = useStore()
  const { preference, setPreference, theme } = useTheme()
  const [legacyMessage, setLegacyMessage] = useState('')

  return (
    <div className="panel-page">
      <h1>Configurações</h1>
      <p className="meta">Revisão {store.document.revision}. Desfazer e refazer valem nesta sessão. O histórico de auditoria fica no documento.</p>
      <section className="callout theme-settings">
        <h2>Aparência</h2>
        <p className="meta">Tema Glyco — claro, escuro ou automático com o sistema. Ativo agora: {theme === 'dark' ? 'escuro' : 'claro'}.</p>
        <div className="theme-switch theme-switch-lg" role="group" aria-label="Tema da interface">
          {([
            ['light', 'Claro'],
            ['dark', 'Escuro'],
            ['system', 'Sistema'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={preference === value}
              onClick={() => setPreference(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>
      <div className="row-actions">
        <button className="ghost" type="button" disabled={!store.canUndo} onClick={store.undo}>Desfazer</button>
        <button className="ghost" type="button" disabled={!store.canRedo} onClick={store.redo}>Refazer</button>
        <button
          className="ghost"
          type="button"
          onClick={() => {
            const blob = new Blob([JSON.stringify(store.document, null, 2)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = 'glyco-organograma.json'
            link.click()
            URL.revokeObjectURL(url)
          }}
        >
          Exportar JSON
        </button>
      </div>
      <form
        className="field"
        onSubmit={async (event) => {
          event.preventDefault()
          const file = new FormData(event.currentTarget).get('file')
          if (!(file instanceof File)) return
          let raw: unknown
          try {
            raw = JSON.parse(await file.text()) as unknown
          } catch {
            store.apply({ ok: false, error: 'Arquivo JSON inválido.' })
            return
          }
          store.apply(replaceDocument(store.document, raw))
        }}
      >
        <span>Importar JSON versionado</span>
        <input name="file" type="file" accept="application/json" aria-label="Arquivo JSON" />
        <button className="primary" type="submit">Substituir documento</button>
      </form>
      <section className="callout">
        <h2>Dados antigos deste navegador</h2>
        <p className="meta">A chave personal-org-chart não entra sozinha. A prévia mostra os títulos antes de qualquer mistura.</p>
        <button
          className="ghost"
          type="button"
          onClick={() => {
            try {
              const raw = store.legacyPreview ? JSON.parse(store.legacyPreview) : null
              const preview = previewLegacy(raw)
              setLegacyMessage(preview.ok ? `${preview.value.count} itens: ${preview.value.titles.join(', ')}` : preview.error)
            } catch {
              setLegacyMessage('Dados legados inválidos neste navegador.')
            }
          }}
        >
          Ver prévia
        </button>
        {legacyMessage && <p>{legacyMessage}</p>}
        <button className="text-button" type="button" onClick={store.dismissLegacy}>Dispensar aviso</button>
      </section>
      <button className="primary" type="button" onClick={() => void store.sync()}>Tentar salvar na API</button>
    </div>
  )
}

export function Connections() {
  const store = useStore()
  const [endpoint, setEndpoint] = useState('https://')
  const [probe, setProbe] = useState('')
  const [authorized, setAuthorized] = useState(false)

  return (
    <div className="panel-page">
      <h1>Conexões</h1>
      <p className="meta">Credenciais ficam no Worker. Sem token, a tela mostra pendência — não um sucesso falso.</p>
      <ul>
        {store.document.connections.map((connection) => (
          <li key={connection.id} className="callout">
            <strong>{connection.label}</strong>
            <p className="meta">{connection.status} · {connection.detail}</p>
            <p className="meta">{connection.endpoint}</p>
          </li>
        ))}
      </ul>
      <form
        className="field action-block connection-action"
        onSubmit={async (event) => {
          event.preventDefault()
          if (!authorized) return
          const result = await probeMcp(endpoint, async (url, init) => {
            const response = await fetch('/api/v1/connections/probe', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ endpoint: url, init }),
            })
            return { ok: response.ok, status: response.status, json: () => response.json() }
          })
          setProbe(result.ok ? 'Servidor respondeu.' : result.error)
        }}
      >
        <label className="action-label" htmlFor="mcp-endpoint">Autorizar conexão externa <span>*</span></label>
        <input id="mcp-endpoint" aria-label="Endpoint MCP" value={endpoint} onChange={(event) => setEndpoint(event.target.value)} />
        <label className="consent-row">
          <input type="checkbox" checked={authorized} onChange={(event) => setAuthorized(event.target.checked)} />
          <span>Autorizo testar este servidor HTTPS a partir do backend. Nenhuma credencial será enviada pelo navegador.</span>
        </label>
        <button className="primary pill-button" disabled={!authorized} type="submit">Conectar servidor</button>
        <div className="action-divider" />
        <button className="secondary-link" type="button" onClick={() => setAuthorized(false)}>Conectar depois</button>
      </form>
      {probe && <p role="status">{probe}</p>}
    </div>
  )
}
