import { forwardRef, useEffect, useMemo, useState } from 'react'
import {
  parseCapture,
  parseSchedule,
  parseTimeRange,
  parseChronoLeading,
  formatSchedule,
  type ParsedSchedule,
  type ParseResult
} from '@/lib/parser'

type Mode = 'capture' | 'schedule' | 'time-range'

interface Props {
  mode: Mode
  value: string
  onChange: (raw: string) => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  placeholder?: string
  autoFocus?: boolean
  className?: string
  inputClassName?: string
  inputStyle?: React.CSSProperties
}

const ScheduleInput = forwardRef<HTMLInputElement, Props>(function ScheduleInput(
  { mode, value, onChange, onKeyDown, placeholder, autoFocus, className, inputClassName, inputStyle },
  ref
) {
  const trimmed = value.trim()
  const isEmpty = trimmed === ''
  const currentPreview = useMemo(() => previewFor(mode, value), [mode, value])
  const [lastGoodPreview, setLastGoodPreview] = useState(currentPreview)

  useEffect(() => {
    if (isEmpty) setLastGoodPreview('')
    else if (currentPreview) setLastGoodPreview(currentPreview)
  }, [isEmpty, currentPreview])

  const showPreview = !isEmpty
  const previewText = currentPreview || lastGoodPreview
  const dim = !isEmpty && !currentPreview && !!lastGoodPreview

  return (
    <div className={className ?? 'flex flex-col gap-1'}>
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={inputClassName ?? 'w-full bg-transparent outline-none'}
        style={inputStyle ?? { color: 'var(--text)' }}
      />
      {showPreview && previewText && (
        <div
          className="font-mono text-[11px]"
          style={{
            color: 'var(--muted)',
            opacity: dim ? 0.5 : 1
          }}
        >
          → {previewText}
        </div>
      )}
    </div>
  )
})

export default ScheduleInput

function previewFor(mode: Mode, raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  if (mode === 'capture') {
    const result = parseCapture(trimmed)
    if (result) return formatCapturePreview(result)
    // partial chrono: show schedule even before the title is typed
    if (trimmed.startsWith('!')) {
      const rest = trimmed.slice(1).trim()
      if (rest) {
        const r = parseChronoLeading(rest)
        if (r) {
          const sched = formatSchedule(r.schedule)
          return r.titleText ? `${sched} · ${r.titleText}` : sched
        }
      }
    }
    return ''
  }
  if (mode === 'schedule') {
    const result = parseSchedule(trimmed)
    if (!result) return ''
    return formatSchedule(result)
  }
  if (mode === 'time-range') {
    const result = parseTimeRange(trimmed)
    if (!result) return ''
    if (!result.start && !result.end) return 'no time'
    if (result.start && result.end) return `${result.start}–${result.end}`
    return result.start || ''
  }
  return ''
}

function formatCapturePreview(r: ParseResult): string {
  const t = r.task
  if (t.kind === 'note') return 'note'
  if (t.kind === 'recurring' && t.recurrence) {
    const sched: ParsedSchedule = { kind: 'recurring', recurrence: t.recurrence }
    return formatSchedule(sched)
  }
  // chrono path: show "schedule · title" so the boundary chrono drew is visible
  if (r.prefix === 'chrono') {
    const sched: ParsedSchedule = { kind: 'todo', due: t.due ?? null, time: t.time }
    return `${formatSchedule(sched)} · ${t.title ?? ''}`
  }
  if (!t.due) return 'inbox'
  const sched: ParsedSchedule = { kind: 'todo', due: t.due, time: t.time }
  return formatSchedule(sched)
}
