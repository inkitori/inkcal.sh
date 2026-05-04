import { useEffect, useRef, useState } from 'react'
import Checkbox from './Checkbox'
import { dueLabel } from '@/lib/date'
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
  onRenameSubmit?: (text: string) => void
  onRenameCancel?: () => void
  showDue?: boolean
  showTime?: boolean
}

export default function TaskRow({
  task, isCompleted, isSelected, isOverdue, isRenaming,
  onToggle, onClick, onRenameSubmit, onRenameCancel,
  showDue = true, showTime = true
}: Props) {
  const titleStyle: React.CSSProperties = {
    color: isCompleted ? 'var(--muted)' : 'var(--text)',
    textDecoration: isCompleted ? 'line-through' : 'none',
    textDecorationColor: 'var(--muted-2)'
  }

  const time = task.time ?? task.recurrence?.start
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
      className="group flex items-center gap-2.5 px-2 py-1.5 rounded-md cursor-default"
      style={{
        background: isSelected ? 'var(--bg-2)' : 'transparent',
        outline: isSelected ? `1px solid var(--border)` : 'none'
      }}
    >
      <Checkbox checked={isCompleted} onClick={onToggle} />
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
      <span className="font-mono text-[10px] flex items-center gap-2 shrink-0" style={{ color: 'var(--muted)' }}>
        {showTime && time && <span>@{time}</span>}
        {label && (
          <span style={{ color: isOverdue ? 'var(--danger)' : 'var(--accent)' }}>{label}</span>
        )}
      </span>
    </div>
  )
}
