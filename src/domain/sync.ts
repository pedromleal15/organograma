import { replaceDocument } from './rules'
import type { AppDocument, Result } from './types'

export const DOCUMENT_KEY = 'glyco-org-document'
export const DRAFT_KEY = 'glyco-org-draft'
export const LEGACY_KEY = 'personal-org-chart'

export interface KeyValue {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface RemoteDocument {
  revision: number
  document: AppDocument
}

export type SaveOutcome =
  | { status: 'saved'; document: AppDocument }
  | { status: 'draft'; document: AppDocument; error: string }
  | { status: 'conflict'; local: AppDocument; remote: AppDocument }

export async function saveDocument(
  document: AppDocument,
  storage: KeyValue,
  put: (document: AppDocument) => Promise<RemoteDocument | { conflict: AppDocument }>,
): Promise<SaveOutcome> {
  storage.setItem(DOCUMENT_KEY, JSON.stringify(document))
  try {
    const response = await put(document)
    if ('conflict' in response) return { status: 'conflict', local: document, remote: response.conflict }
    storage.setItem(DOCUMENT_KEY, JSON.stringify(response.document))
    return { status: 'saved', document: response.document }
  } catch (error) {
    storage.setItem(DRAFT_KEY, JSON.stringify(document))
    const message = error instanceof Error ? error.message : 'Falha de rede'
    return { status: 'draft', document, error: message }
  }
}

export function previewLegacy(raw: unknown): Result<{ titles: string[]; count: number }> {
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, error: 'Nenhum organograma antigo encontrado.' }
  const titles = raw.map((item) => {
    if (typeof item !== 'object' || item === null || !('name' in item)) return null
    return String((item as { name: unknown }).name)
  })
  if (titles.some((title) => !title)) return { ok: false, error: 'O formato antigo está incompleto.' }
  return { ok: true, value: { titles: titles.filter((title): title is string => Boolean(title)), count: titles.length } }
}

export function importReplacing(current: AppDocument, raw: unknown): Result<AppDocument> {
  return replaceDocument(current, raw)
}
