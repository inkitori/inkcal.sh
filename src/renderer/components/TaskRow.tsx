import { useEffect, useRef, useState } from 'react'
import Checkbox from './Checkbox'
import { formatTimeRange } from '@/../shared/time'
import { useStore } from '@/lib/store'
import type { Task } from '@/../shared/types'

export type ChipTone = 'muted' | 'accent' | 'danger'
export interface Chip { text: string; tone: ChipTone }

const CHIP_COLORS: Record<ChipTone, string> = {
  muted: 'var(--muted-2)',
  accent: 'var(--accent)',
  danger: 'var(--danger)'
}

interface Props {
  task: Task
  isCompleted: boolean
  isSelected?: boolean
  isRenaming?: boolean
  onToggle?: () => void
  onClick?: () => void
  onRenameSubmit?: (text: string) => void
  onRenameCancel?: () => void
  showTime?: boolean
  hideCheckbox?: boolean
  chips?: Chip[]
}

export default function TaskRow({
  task, isCompleted, isSelected, isRenaming,
  onToggle, onClick, onRenameSubmit, onRenameCancel,
  showTime = true, hideCheckbox = false, chips
}: Props) {
  const titleStyle: React.CSSProperties = {
    color: isCompleted ? 'var(--muted)' : 'var(--text)',
    textDecoration: isCompleted ? 'line-through' : 'none',
    textDecorationColor: 'var(--muted-2)'
  }

  const clockFormat = useStore(s => s.settings.clockFormat)
  const time = task.time ?? task.recurrence?.start
  const endTime = task.endTime ?? task.recurrence?.end
  const timeLabel = time ? formatTimeRange(time, endTime, clockFormat) : undefined

  const initial = task.title || task.body || ''
  const [draft, setDraft] = useState(initial)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isRenaming) {
      setDraft(initial)
      requestAnimationFrame(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      })
    }
  }, [isRenaming, initial])

  return (
    <div
      onClick={onClick}
      data-selected={isSelected ? 'true' : undefined}
      className="group relative flex items-center gap-2.5 px-2 py-1.5 rounded-md cursor-default"
      style={{
        background: isSelected ? 'var(--bg-2)' : 'transparent',
        outline: isSelected ? `1px solid var(--border)` : 'none'
      }}
    >
      {!hideCheckbox && <Checkbox checked={isCompleted} onClick={onToggle} />}
      {isRenaming ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              const next = draft.trim()
              if (next.length > 0) onRenameSubmit?.(next)
              else onRenameCancel?.()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              onRenameCancel?.()
            }
            e.stopPropagation()
          }}
          onBlur={() => {
            const next = draft.trim()
            if (next.length > 0 && next !== initial) onRenameSubmit?.(next)
            else onRenameCancel?.()
          }}
          className="flex-1 bg-transparent outline-none"
          style={{ color: 'var(--text)' }}
        />
      ) : (
        <span className="flex-1 truncate" style={titleStyle}>
          {task.title || task.body || '(untitled)'}
        </span>
      )}
      <span
        className="font-mono text-[10px] flex items-center gap-2 shrink-0"
        style={{ color: 'var(--muted)' }}
      >
        {task.kind === 'recurring' && (
          <span style={{ color: 'var(--accent)', fontSize: 13, lineHeight: 1 }} title="recurring">↻</span>
        )}
        {showTime && time && <span>@{timeLabel}</span>}
        {chips?.map((c, i) => (
          <span key={i} style={{ color: CHIP_COLORS[c.tone] }}>{c.text}</span>
        ))}
      </span>
    </div>
  )
}
