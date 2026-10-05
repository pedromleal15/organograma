/**
 * MentionPullText — drop-in replacement for PullText that:
 *  1. Detects `@` and shows an area autocomplete dropdown
 *  2. When not focused and mentions exist, switches to a chip-display view
 *
 * MentionDisplay — read-only rendering of text with clickable area chips.
 */
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { detectActiveMention, insertMention, parseText, suggestAreas } from '../domain/mentions'
import type { AreaRef } from '../domain/mentions'
import { openAreaModal } from './area-modal'

// ─── MentionDisplay ────────────────────────────────────────────────────────

interface MentionDisplayProps {
  text: string
  areas: AreaRef[]
  /** Optional wrapper class on the container span */
  className?: string
}

/**
 * Renders a plain string with `@AreaTitle` markers converted to clickable chips.
 * Purely presentational — no editable behavior.
 */
export function MentionDisplay({ text, areas, className }: MentionDisplayProps) {
  const segments = parseText(text, areas)
  return (
    <span className={`mention-display ${className ?? ''}`}>
      {segments.map((seg, i) => {
        if (seg.type === 'mention' && seg.areaId) {
          return (
            <button
              key={`${seg.areaId}-${i}`}
              type="button"
              className="mention-chip"
              aria-label={`Abrir área ${seg.areaTitle}`}
              onClick={(e) => {
                e.stopPropagation()
                openAreaModal(seg.areaId!)
              }}
            >
              {seg.raw}
            </button>
          )
        }
        return <span key={i}>{seg.raw}</span>
      })}
    </span>
  )
}

// ─── MentionPullText ───────────────────────────────────────────────────────

interface MentionPullTextProps {
  label: string
  value: string
  placeholder?: string
  areas: AreaRef[]
  onChange: (value: string) => void
}

/**
 * Auto-resizing textarea with @-mention autocomplete.
 *
 * • When blurred and the text contains recognisable area mentions the field
 *   renders `MentionDisplay` (chips) instead, which the user can click to
 *   re-enter edit mode or to open the area modal.
 * • While focused it is a standard textarea with a floating suggestion list.
 */
export function MentionPullText({
  label,
  value,
  placeholder,
  areas,
  onChange,
}: MentionPullTextProps) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [focused, setFocused] = useState(false)
  const [suggestions, setSuggestions] = useState<AreaRef[]>([])
  const [activeIdx, setActiveIdx] = useState(-1)
  const [mentionStart, setMentionStart] = useState(-1)

  // Auto-fit height
  const fit = () => {
    const field = ref.current
    if (!field) return
    field.style.height = '0px'
    field.style.height = `${field.scrollHeight}px`
  }
  useLayoutEffect(fit, [value])

  // Reset dropdown state
  const closeSuggestions = () => {
    setSuggestions([])
    setActiveIdx(-1)
    setMentionStart(-1)
  }

  const handleChange = (raw: string) => {
    onChange(raw)

    // Detect @mention position
    const cursor = ref.current?.selectionStart ?? raw.length
    const mention = detectActiveMention(raw, cursor)
    if (mention) {
      const found = suggestAreas(mention.query, areas)
      setSuggestions(found)
      setActiveIdx(-1)
      setMentionStart(mention.start)
    } else {
      closeSuggestions()
    }
  }

  const commitSuggestion = (area: AreaRef) => {
    const cursor = ref.current?.selectionStart ?? value.length
    const { text: next, cursor: nextCursor } = insertMention(value, mentionStart, cursor, area)
    onChange(next)
    closeSuggestions()
    // Restore focus + cursor position after React re-render
    requestAnimationFrame(() => {
      const ta = ref.current
      if (!ta) return
      ta.focus()
      ta.setSelectionRange(nextCursor, nextCursor)
    })
  }

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault()
      commitSuggestion(suggestions[activeIdx])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      closeSuggestions()
    }
  }

  // Close suggestions when clicking outside
  useEffect(() => {
    if (suggestions.length === 0) return
    const handler = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.mention-field')) closeSuggestions()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [suggestions.length])

  // Scroll highlighted suggestion into view
  useEffect(() => {
    if (activeIdx < 0 || !listRef.current) return
    const item = listRef.current.children[activeIdx] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx])

  // Should we show the chip preview instead of the raw textarea?
  const showPreview =
    !focused && areas.some((a) => value.toLowerCase().includes(`@${a.title.toLowerCase()}`))

  const dropdownId = 'mention-dropdown'

  return (
    <div className="mention-field">
      {showPreview ? (
        /* ─── Preview / chip mode ─── */
        <button
          type="button"
          className="mention-preview pull-text"
          aria-label={`Editar: ${label}`}
          onClick={() => {
            setFocused(true)
            requestAnimationFrame(() => ref.current?.focus())
          }}
        >
          <MentionDisplay text={value} areas={areas} />
        </button>
      ) : (
        /* ─── Edit mode ─── */
        <textarea
          ref={ref}
          className="pull-text"
          aria-label={label}
          aria-expanded={suggestions.length > 0}
          aria-controls={suggestions.length > 0 ? dropdownId : undefined}
          aria-activedescendant={activeIdx >= 0 ? `mention-opt-${activeIdx}` : undefined}
          value={value}
          placeholder={placeholder}
          rows={1}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            // Delay so a click on a suggestion fires first
            setTimeout(() => setFocused(false), 150)
          }}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      )}

      {/* ─── Autocomplete dropdown ─── */}
      {suggestions.length > 0 && (
        <ul
          ref={listRef}
          id={dropdownId}
          className="mention-dropdown"
          role="listbox"
          aria-label="Áreas disponíveis"
        >
          {suggestions.map((area, i) => (
            <li
              key={area.id}
              id={`mention-opt-${i}`}
              role="option"
              aria-selected={i === activeIdx}
              className={`mention-option${i === activeIdx ? ' is-active' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault() // keep focus in textarea
                commitSuggestion(area)
              }}
            >
              <span className="mention-chip-inline">@</span>
              {area.title}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
