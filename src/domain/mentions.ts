/**
 * @-mention parser for area references in free-text fields.
 *
 * Storage format: plain text with `@AreaTitle` markers, e.g.
 *   "Ver com @Marketing e @Operações o cronograma."
 *
 * Matching is case-insensitive, diacritic-aware and longest-match first
 * so @Head de Engenharia beats a hypothetical shorter @Head prefix.
 */

export interface MentionSegment {
  type: 'text' | 'mention'
  raw: string
  areaId?: string
  areaTitle?: string
}

export interface AreaRef {
  id: string
  title: string
}

/** Regex that extracts the word(s) after `@`. Allows Unicode letters and
 *  internal spaces but stops at punctuation, newline, or double-space. */
const WORD_CHARS = /[\p{L}\p{N}]/u

/**
 * Parse a text string into alternating text/mention segments.
 * Areas are matched longest-first to avoid shorter prefixes winning.
 */
export function parseText(text: string, areas: AreaRef[]): MentionSegment[] {
  if (!text || areas.length === 0) return [{ type: 'text', raw: text }]

  // Longest title first for greedy matching
  const sorted = [...areas].sort((a, b) => b.title.length - a.title.length)
  const segments: MentionSegment[] = []
  let pos = 0
  let segStart = 0

  while (pos < text.length) {
    if (text[pos] !== '@') {
      pos++
      continue
    }

    const rest = text.slice(pos + 1)
    let found: AreaRef | null = null

    for (const area of sorted) {
      if (rest.length < area.title.length) continue
      const candidate = rest.slice(0, area.title.length)
      if (candidate.localeCompare(area.title, 'pt-BR', { sensitivity: 'base' }) !== 0) continue
      // Make sure the char after the match is not a word char (avoids @Prod matching @Produto)
      const afterEnd = pos + 1 + area.title.length
      const nextChar = text[afterEnd]
      if (nextChar !== undefined && WORD_CHARS.test(nextChar)) continue
      found = area
      break
    }

    if (found) {
      if (pos > segStart) {
        segments.push({ type: 'text', raw: text.slice(segStart, pos) })
      }
      segments.push({
        type: 'mention',
        raw: `@${found.title}`,
        areaId: found.id,
        areaTitle: found.title,
      })
      pos = pos + 1 + found.title.length
      segStart = pos
    } else {
      pos++
    }
  }

  if (segStart < text.length) {
    segments.push({ type: 'text', raw: text.slice(segStart) })
  }

  return segments.length > 0 ? segments : [{ type: 'text', raw: text }]
}

/** Returns the unique area IDs mentioned in a text. */
export function extractMentionedAreaIds(text: string, areas: AreaRef[]): string[] {
  const ids = new Set<string>()
  for (const seg of parseText(text, areas)) {
    if (seg.type === 'mention' && seg.areaId) ids.add(seg.areaId)
  }
  return [...ids]
}

/**
 * Given a raw query (what the user typed after `@`), return matching areas.
 * Empty query returns all areas up to `limit`.
 */
export function suggestAreas(query: string, areas: AreaRef[], limit = 7): AreaRef[] {
  const q = query.trim().toLocaleLowerCase('pt-BR')
  if (!q) return areas.slice(0, limit)
  return areas
    .filter((a) => a.title.toLocaleLowerCase('pt-BR').includes(q))
    .slice(0, limit)
}

/**
 * Detect whether the cursor is inside a `@mention` and return the mention's
 * start index and current query string (text between `@` and the cursor).
 * Returns null if the cursor is not in mention-entry mode.
 */
export function detectActiveMention(
  text: string,
  cursorPos: number,
): { start: number; query: string } | null {
  let i = cursorPos - 1
  while (i >= 0 && text[i] !== '@' && text[i] !== '\n') {
    i--
  }
  if (i < 0 || text[i] !== '@') return null
  const query = text.slice(i + 1, cursorPos)
  // If the query contains a newline, we're not in a mention
  if (query.includes('\n')) return null
  return { start: i, query }
}

/**
 * Insert a mention into `text`, replacing the `@query` at `mentionStart..cursorPos`.
 * Returns the new text and the new cursor position (after the inserted mention).
 */
export function insertMention(
  text: string,
  mentionStart: number,
  cursorPos: number,
  area: AreaRef,
): { text: string; cursor: number } {
  const inserted = `@${area.title}`
  const next = text.slice(0, mentionStart) + inserted + text.slice(cursorPos)
  return { text: next, cursor: mentionStart + inserted.length }
}
