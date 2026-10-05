import { assertPedro } from '../src/domain/auth'
import { listGithubIssues, probeMcp, pullGoogleTasks } from '../src/domain/connectors'
import { applyAgentWrite, parseDocument, resetAgentMemory } from '../src/domain/rules'
import type { AgentWrite, AppDocument } from '../src/domain/types'

interface Env {
  DB: D1Database
  OAUTH: KVNamespace
  MCP_HUB: DurableObjectNamespace
  ASSETS: Fetcher
  GITHUB_CLIENT_ID?: string
  GITHUB_CLIENT_SECRET?: string
  GITHUB_TOKEN?: string
  GOOGLE_TASKS_TOKEN?: string
  ALLOW_DEV_LOGIN?: string
}

export class McpHub implements DurableObject {
  constructor(private state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const body = await request.json().catch(() => ({}))
    await this.state.storage.put('last', body)
    return Response.json({ ok: true, detail: 'Conexão registrada no Durable Object. Execução de escrita continua exigindo prévia na API.' })
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/') || url.pathname === '/mcp') {
      return route(request, env, url)
    }
    return env.ASSETS.fetch(request)
  },
}

async function route(request: Request, env: Env, url: URL): Promise<Response> {
  if (url.pathname === '/auth/github') return startGithub(env, url)
  if (url.pathname === '/auth/github/callback') return finishGithub(env, url)
  if (url.pathname === '/auth/logout') return logout()
  const user = await currentUser(request, env)
  if (!user) return Response.json({ error: 'Autenticação necessária.' }, { status: 401 })
  if (url.pathname === '/api/v1/document' && request.method === 'GET') return Response.json(await readDocument(env))
  if (url.pathname === '/api/v1/document' && request.method === 'PUT') return writeDocument(request, env)
  if (url.pathname === '/api/v1/agent/apply' && request.method === 'POST') return agentApply(request, env)
  if (url.pathname === '/api/v1/areas' && request.method === 'GET') return listAreas(env, url)
  if (url.pathname === '/api/v1/areas/search' && request.method === 'GET') return searchAreas(env, url)
  if (url.pathname === '/api/v1/connections/github/issues') return githubIssues(env)
  if (url.pathname === '/api/v1/connections/google-tasks' && request.method === 'POST') return googlePull(env)
  if (url.pathname === '/api/v1/connections/probe' && request.method === 'POST') return probe(request, env)
  if (url.pathname === '/mcp' && request.method === 'POST') return mcp(request, env)
  return Response.json({ error: 'Rota não encontrada.' }, { status: 404 })
}

async function currentUser(request: Request, env: Env): Promise<string | null> {
  if (env.ALLOW_DEV_LOGIN === '1') {
    const dev = request.headers.get('x-dev-login')
    const checked = assertPedro({ login: dev ?? '' })
    if (checked.ok) return checked.login
  }
  const cookie = request.headers.get('cookie') ?? ''
  const session = cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith('glyco_session='))?.slice('glyco_session='.length)
  if (!session) return null
  return env.OAUTH.get(`session:${session}`)
}

async function startGithub(env: Env, url: URL): Promise<Response> {
  if (!env.GITHUB_CLIENT_ID) return Response.json({ error: 'GitHub OAuth não configurado neste Worker.' }, { status: 503 })
  const state = crypto.randomUUID()
  await env.OAUTH.put(`state:${state}`, url.origin, { expirationTtl: 600 })
  const redirect = new URL('https://github.com/login/oauth/authorize')
  redirect.searchParams.set('client_id', env.GITHUB_CLIENT_ID)
  redirect.searchParams.set('state', state)
  redirect.searchParams.set('scope', 'read:user')
  return Response.redirect(redirect.toString(), 302)
}

async function finishGithub(env: Env, url: URL): Promise<Response> {
  const state = url.searchParams.get('state') ?? ''
  const code = url.searchParams.get('code') ?? ''
  const origin = await env.OAUTH.get(`state:${state}`)
  if (!origin || !code || !env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return Response.json({ error: 'Login GitHub incompleto.' }, { status: 400 })
  }
  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code, state }),
  })
  if (!tokenResponse.ok) return Response.json({ error: `GitHub respondeu ${tokenResponse.status}.` }, { status: 502 })
  const token = (await tokenResponse.json()) as { access_token?: string }
  const profileResponse = await fetch('https://api.github.com/user', { headers: { authorization: `Bearer ${token.access_token ?? ''}`, accept: 'application/vnd.github+json' } })
  if (!profileResponse.ok) return Response.json({ error: `Perfil GitHub respondeu ${profileResponse.status}.` }, { status: 502 })
  const profile = (await profileResponse.json()) as { login?: string }
  const allowed = assertPedro(profile)
  if (!allowed.ok) return Response.json({ error: allowed.error }, { status: 403 })
  const session = crypto.randomUUID()
  await env.OAUTH.put(`session:${session}`, allowed.login)
  return new Response(null, { status: 302, headers: { location: `${origin}/organograma`, 'set-cookie': `glyco_session=${session}; HttpOnly; Secure; SameSite=Lax; Path=/` } })
}

function logout(): Response {
  return new Response(null, { status: 302, headers: { location: '/organograma', 'set-cookie': 'glyco_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0' } })
}

async function readDocument(env: Env): Promise<{ revision: number; document: AppDocument | null }> {
  const row = await env.DB.prepare('SELECT revision, body FROM documents WHERE id = ?').bind('main').first<{ revision: number; body: string }>()
  if (!row) return { revision: 0, document: null }
  return { revision: row.revision, document: JSON.parse(row.body) as AppDocument }
}

async function writeDocument(request: Request, env: Env): Promise<Response> {
  const parsed = parseDocument(await request.json())
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 422 })
  const current = await readDocument(env)
  const expected = Number(request.headers.get('if-match') ?? parsed.value.revision)
  if (current.document && current.revision !== expected) {
    return Response.json(current.document, { status: 409 })
  }
  await env.DB.prepare('INSERT INTO documents (id, revision, body) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET revision = excluded.revision, body = excluded.body')
    .bind('main', parsed.value.revision, JSON.stringify(parsed.value))
    .run()
  return Response.json({ revision: parsed.value.revision, document: parsed.value })
}

async function agentApply(request: Request, env: Env): Promise<Response> {
  const write = (await request.json()) as AgentWrite
  const cached = await env.DB.prepare('SELECT body FROM idempotency WHERE key = ?').bind(write.idempotencyKey).first<{ body: string }>()
  if (cached) return Response.json(JSON.parse(cached.body))
  const current = await readDocument(env)
  if (!current.document) return Response.json({ error: 'Documento ainda não existe.' }, { status: 404 })
  resetAgentMemory()
  const applied = applyAgentWrite(current.document, write)
  if (!applied.ok) return Response.json({ error: applied.error }, { status: 409 })
  await env.DB.prepare('INSERT INTO documents (id, revision, body) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET revision = excluded.revision, body = excluded.body')
    .bind('main', applied.value.revision, JSON.stringify(applied.value))
    .run()
  await env.DB.prepare('INSERT INTO idempotency (key, body) VALUES (?, ?)').bind(write.idempotencyKey, JSON.stringify(applied.value)).run()
  return Response.json(applied.value)
}

async function listAreas(env: Env, url: URL): Promise<Response> {
  const { document } = await readDocument(env)
  if (!document) return Response.json([])
  const scenarioId = url.searchParams.get('scenarioId') ?? null
  const areas = scenarioId
    ? document.areas.filter((a) => a.scenarioId === scenarioId)
    : document.areas
  return Response.json(
    areas
      .sort((a, b) => a.order - b.order)
      .map((a) => ({ id: a.id, title: a.title, scenarioId: a.scenarioId, order: a.order })),
    { headers: { 'cache-control': 'no-store' } },
  )
}

async function searchAreas(env: Env, url: URL): Promise<Response> {
  const { document } = await readDocument(env)
  if (!document) return Response.json([])
  const q = (url.searchParams.get('q') ?? '').trim().toLocaleLowerCase('pt-BR')
  const scenarioId = url.searchParams.get('scenarioId') ?? null
  let areas = scenarioId
    ? document.areas.filter((a) => a.scenarioId === scenarioId)
    : document.areas
  if (q) areas = areas.filter((a) => a.title.toLocaleLowerCase('pt-BR').includes(q))
  return Response.json(
    areas
      .sort((a, b) => a.order - b.order)
      .slice(0, 20)
      .map((a) => ({ id: a.id, title: a.title, scenarioId: a.scenarioId, order: a.order })),
    { headers: { 'cache-control': 'no-store' } },
  )
}

async function githubIssues(env: Env): Promise<Response> {
  const result = await listGithubIssues(env.GITHUB_TOKEN, fetch)
  return Response.json(result, { status: result.ok ? 200 : 424 })
}

async function googlePull(env: Env): Promise<Response> {
  const result = await pullGoogleTasks(env.GOOGLE_TASKS_TOKEN, fetch)
  return Response.json(result, { status: result.ok ? 200 : 424 })
}

async function probe(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as { endpoint?: string }
  const result = await probeMcp(body.endpoint ?? '', fetch)
  const id = env.MCP_HUB.idFromName('external')
  if (result.ok) await env.MCP_HUB.get(id).fetch('https://mcp.internal/store', { method: 'POST', body: JSON.stringify(body) })
  return Response.json(result, { status: result.ok ? 200 : 424 })
}

async function mcp(request: Request, env: Env): Promise<Response> {
  const message = (await request.json()) as { id?: number; method?: string; params?: { name?: string; arguments?: AgentWrite } }
  if (message.method === 'initialize') {
    return Response.json({ jsonrpc: '2.0', id: message.id ?? 1, result: { protocolVersion: '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'glyco-organograma', version: '1' } } })
  }
  if (message.method === 'tools/list') {
    return Response.json({
      jsonrpc: '2.0',
      id: message.id ?? 1,
      result: {
        tools: [
          { name: 'list_roles', description: 'Lista cargos do documento', inputSchema: { type: 'object' } },
          { name: 'list_tasks', description: 'Lista tarefas do documento', inputSchema: { type: 'object' } },
          { name: 'apply_write', description: 'Aplica uma proposta idempotente se a revisão esperada bater', inputSchema: { type: 'object' } },
        ],
      },
    })
  }
  if (message.method === 'tools/call' && message.params?.name === 'list_roles') {
    const document = await readDocument(env)
    return Response.json({ jsonrpc: '2.0', id: message.id ?? 1, result: { content: [{ type: 'text', text: JSON.stringify(document.document?.roles ?? []) }] } })
  }
  if (message.method === 'tools/call' && message.params?.name === 'apply_write' && message.params.arguments) {
    const response = await agentApply(new Request('https://glyco.internal/api/v1/agent/apply', { method: 'POST', body: JSON.stringify(message.params.arguments) }), env)
    const payload = await response.json()
    return Response.json({ jsonrpc: '2.0', id: message.id ?? 1, result: { content: [{ type: 'text', text: JSON.stringify(payload) }] }, error: response.ok ? undefined : payload })
  }
  return Response.json({ jsonrpc: '2.0', id: message.id ?? 1, error: { code: -32601, message: 'Método não encontrado.' } })
}
