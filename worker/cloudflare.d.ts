interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  first<T>(): Promise<T | null>
  run(): Promise<unknown>
}

interface D1Database {
  prepare(query: string): D1PreparedStatement
}

interface KVNamespace {
  get(key: string): Promise<string | null>
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
}

interface DurableObjectState {
  storage: { put(key: string, value: unknown): Promise<void> }
}

interface DurableObjectId {}

interface DurableObjectStub {
  fetch(input: string, init?: RequestInit): Promise<Response>
}

interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId
  get(id: DurableObjectId): DurableObjectStub
}

interface DurableObject {
  fetch(request: Request): Promise<Response>
}

interface Fetcher {
  fetch(request: Request): Promise<Response>
}
