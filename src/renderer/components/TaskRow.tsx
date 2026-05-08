import { useEffect, useRef, useState } from 'react'
import Checkbox from './Checkbox'
import { dueLabel } from '@/lib/date'
import { formatTimeRange } from '@/../shared/time'
import { useStore } from '@/lib/store'
import type { Task } from '@/../shared/types'

interface Props {
  task: Task
  date: string  // for recurring instances; for todos this is just 'today' or due date
  isCompleted: boolean
  isSelected?: boolean
  isOverdue?: boolean
  isRenaming?: boolean
  onToggle?: () => void
  onClick?: () => void
  onDelete?: () => void
  onRenameSubmit?: (text: string) => void
  onRenameCancel?: () => void
  showDue?: boolean
  showTime?: boolean
  hideCheckbox?: boolean
  recurrenceLabel?: string
  /** danger-tone label for missed recurring rows; replaces the dueLabel */
  overdueLabel?: string
}

export default function TaskRow({
  task, isCompleted, isSelected, isOverdue, isRenaming,
  onToggle, onClick, onDelete, onRenameSubmit, onRenameCancel,
  showDue = true, showTime = true,
  hideCheckbox = false, recurrenceLabel, overdueLabel
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
  const due = task.due
  const label = showDue && due ? dueLabel(due) : null

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
          {task.kind === 'recurring' && (
            <span style={{ color: 'var(--muted-2)', marginRight: 4 }}>↻</span>
          )}
          {task.title || task.body || '(untitled)'}
        </span>
      )}
      <span
        className={`font-mono text-[10px] flex items-center gap-2 shrink-0 transition-all duration-150 ${onDelete && !isRenaming ? 'group-hover:mr-8' : ''}`}
        style={{ color: 'var(--muted)' }}
      >
        {showTime && time && <span>@{timeLabel}</span>}
        {recurrenceLabel && !overdueLabel && <span style={{ color: 'var(--muted-2)' }}>{recurrenceLabel}</span>}
        {overdueLabel ? (
          <span style={{ color: 'var(--danger)' }}>{overdueLabel}</span>
        ) : label && (
          <span style={{ color: isOverdue ? 'var(--danger)' : 'var(--accent)' }}>{label}</span>
        )}
      </span>
      {onDelete && !isRenaming && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 font-mono text-[11px] leading-none rounded-sm opacity-0 group-hover:opacity-100 transition-opacity"
          style={{
            background: 'rgba(220,80,80,0.12)',
            color: 'var(--danger)',
            border: '1px solid var(--danger)',
            zIndex: 10
          }}
          title="delete"
        >
          ×
        </button>
      )}
    </div>
  )
}
