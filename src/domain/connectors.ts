export interface FetchResponse {
  ok: boolean
  status: number
  json: () => Promise<unknown>
}

export interface FetchLike {
  (url: string, init?: { headers?: Record<string, string>; method?: string; body?: string }): Promise<FetchResponse>
}

export async function listGithubIssues(token: string | undefined, fetchImpl: FetchLike) {
  if (!token) return { ok: false as const, error: 'GitHub não autorizado. O token fica no Worker.' }
  const response = await fetchImpl('https://api.github.com/repos/pedromleal15/glyco-company/issues?state=open&per_page=5', {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  })
  if (!response.ok) return { ok: false as const, error: `GitHub respondeu ${response.status}.` }
  return { ok: true as const, issues: await response.json() }
}

export async function pullGoogleTasks(token: string | undefined, fetchImpl: FetchLike) {
  if (!token) return { ok: false as const, error: 'Google Tasks não autorizado.' }
  const response = await fetchImpl('https://tasks.googleapis.com/tasks/v1/lists/@default/tasks', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) return { ok: false as const, error: `Google Tasks respondeu ${response.status}.` }
  return { ok: true as const, tasks: await response.json() }
}

export async function probeMcp(endpoint: string, fetchImpl: FetchLike) {
  if (!endpoint.startsWith('https://')) return { ok: false as const, error: 'Só servidores HTTPS.' }
  try {
    const response = await fetchImpl(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"jsonrpc":"2.0","id":1,"method":"initialize"}' })
    if (!response.ok) return { ok: false as const, error: `Servidor respondeu ${response.status}.` }
    return { ok: true as const }
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : 'Servidor indisponível.' }
  }
}
