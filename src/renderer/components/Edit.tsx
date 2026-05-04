import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '@/lib/store'
import type { Task } from '@/../shared/types'
import { parseScheduleOnly, scheduleOnlyToInput, previewSchedule } from '@/lib/parser'
import ScheduleInput from './ScheduleInput'

export default function Edit() {
  const open = useStore(s => s.editOpen)
  const taskId = useStore(s => s.editTaskId)
  const close = useStore(s => s.closeEdit)
  const tasks = useStore(s => s.tasks)
  const updateTask = useStore(s => s.updateTask)

  const task = useMemo(
    () => tasks.find(t => t.id === taskId) ?? null,
    [tasks, taskId]
  )

  const [title, setTitle] = useState('')
  const [when, setWhen] = useState('')
  const [error, setError] = useState<string | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const submitRef = useRef<() => void>(() => {})

  useEffect(() => {
    if (!open || !task) return
    setTitle(task.title ?? task.body ?? '')
    setWhen(scheduleOnlyToInput(task))
    setError(null)
    requestAnimationFrame(() => titleRef.current?.focus())
  }, [open, task])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (e.key === 'Enter' && !e.shiftKey && target?.tagName !== 'TEXTAREA') {
        e.preventDefault()
        submitRef.current()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        close()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  if (!open || !task) return null

  function submit() {
    if (!task) return
    const trimmed = title.trim()
    const patch: Partial<Task> = {}
    if (trimmed.length > 0) {
      if (task.kind === 'note') patch.body = trimmed
      else patch.title = trimmed
    }

    if (task.kind === 'note') {
      updateTask(task.id, patch)
      close()
      return
    }

    const parsed = parseScheduleOnly(when)
    if (!parsed) {
      setError('couldn’t parse that')
      return
    }

    if (task.kind === 'todo') {
      if (parsed.kind === 'recurring') {
        // converting todo → recurring
        patch.kind = 'recurring'
        patch.recurrence = parsed.recurrence
        patch.due = null
        patch.time = undefined
        patch.endTime = undefined
      } else if (parsed.kind === 'todo') {
        patch.due = parsed.due
        patch.time = parsed.time
        patch.endTime = parsed.endTime
      } else {
        // inbox
        patch.due = null
        patch.time = undefined
        patch.endTime = undefined
      }
    } else if (task.kind === 'recurring') {
      if (parsed.kind === 'recurring') {
        patch.recurrence = parsed.recurrence
      } else if (parsed.kind === 'todo') {
        // converting recurring → todo
        patch.kind = 'todo'
        patch.recurrence = undefined
        patch.due = parsed.due
        patch.time = parsed.time
        patch.endTime = parsed.endTime
      } else {
        // inbox: recurring task with empty schedule keeps its days but loses time?
        // Simpler: convert to inbox todo.
        patch.kind = 'todo'
        patch.recurrence = undefined
        patch.due = null
        patch.time = undefined
        patch.endTime = undefined
      }
    }

    updateTask(task.id, patch)
    close()
  }

  submitRef.current = submit

  return (
    <div
      className="fixed inset-0 z-30 flex items-start justify-center pt-24"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={close}
    >
      <div
        className="fade-in w-[560px] max-w-[90%] rounded-md"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-2)',
          border: '1px solid var(--border)'
        }}
      >
        <div className="px-4 py-3 flex flex-col gap-4">
          <Field label="title">
            <input
              ref={titleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-transparent outline-none"
              style={{ color: 'var(--text)' }}
            />
          </Field>

          {task.kind !== 'note' && (
            <FieldTop label="when">
              <ScheduleInput
                value={when}
                onChange={(v) => { setWhen(v); setError(null) }}
                preview={previewSchedule}
                placeholder="e.g. today 10:00, every friday at 14, mwf 10-11, may 12"
                className="flex-1 flex flex-col gap-1"
                inputClassName="w-full bg-transparent outline-none font-mono text-[12px]"
                inputStyle={{ color: 'var(--text)' }}
              />
            </FieldTop>
          )}
        </div>

        <div className="px-4 py-2 flex items-center gap-3 font-mono text-[10px] uppercase"
             style={{ borderTop: '1px solid var(--border)', color: 'var(--muted)' }}>
          <span>↵ save</span>
          <span>esc cancel</span>
          {error && <span style={{ color: 'var(--danger)', textTransform: 'none' }}>{error}</span>}
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-[10px] uppercase tracking-widest w-14 shrink-0" style={{ color: 'var(--muted)' }}>
        {label}
      </span>
      <div className="flex-1">{children}</div>
    </div>
  )
}

function FieldTop({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="font-mono text-[10px] uppercase tracking-widest w-14 shrink-0 pt-1.5" style={{ color: 'var(--muted)' }}>
        {label}
      </span>
      <div className="flex-1">{children}</div>
    </div>
  )
}
