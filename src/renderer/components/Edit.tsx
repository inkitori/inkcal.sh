import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '@/lib/store'
import { todayISO, addDays } from '@/lib/date'
import { WEEKDAYS } from '@/../shared/types'
import type { Recurrence, Task, Weekday } from '@/../shared/types'

const DAY_LABEL: Record<Weekday, string> = {
  mon: 'm', tue: 't', wed: 'w', thu: 't', fri: 'f', sat: 's', sun: 's'
}

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
  const [due, setDue] = useState<string>('')
  const [time, setTime] = useState<string>('')
  const [days, setDays] = useState<Set<Weekday>>(new Set())
  const [daily, setDaily] = useState(false)
  const [start, setStart] = useState<string>('')
  const [end, setEnd] = useState<string>('')
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open || !task) return
    setTitle(task.title ?? task.body ?? '')
    setDue(task.due ?? '')
    setTime(task.time ?? '')
    const rec = task.recurrence ?? {}
    setDays(new Set(rec.days ?? []))
    setDaily(!!rec.daily)
    setStart(rec.start ?? '')
    setEnd(rec.end ?? '')
    requestAnimationFrame(() => titleRef.current?.focus())
  }, [open, task])

  if (!open || !task) return null

  function submit() {
    if (!task) return
    const patch: Partial<Task> = {}
    const trimmed = title.trim()
    if (trimmed.length > 0) {
      if (task.kind === 'note') patch.body = trimmed
      else patch.title = trimmed
    }
    if (task.kind === 'todo') {
      patch.due = due ? due : null
      patch.time = time.trim() || undefined
    }
    if (task.kind === 'recurring') {
      const rec: Recurrence = {}
      if (daily) rec.daily = true
      else if (days.size > 0) rec.days = WEEKDAYS.filter(d => days.has(d))
      if (start.trim()) rec.start = start.trim()
      if (end.trim()) rec.end = end.trim()
      patch.recurrence = rec
    }
    updateTask(task.id, patch)
    close()
  }

  function toggleDay(d: Weekday) {
    setDays(prev => {
      const next = new Set(prev)
      if (next.has(d)) next.delete(d)
      else next.add(d)
      return next
    })
    setDaily(false)
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-start justify-center pt-24"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={close}
    >
      <div
        className="fade-in w-[560px] max-w-[90%] rounded-md"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
            e.preventDefault()
            submit()
          } else if (e.key === 'Escape') {
            e.preventDefault()
            close()
          }
        }}
        style={{
          background: 'var(--bg-2)',
          border: '1px solid var(--border)'
        }}
      >
        <div className="px-4 py-3 flex flex-col gap-3">
          <Field label="title">
            <input
              ref={titleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-transparent outline-none"
              style={{ color: 'var(--text)' }}
            />
          </Field>

          {task.kind === 'todo' && (
            <>
              <Field label="due">
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={due}
                    onChange={(e) => setDue(e.target.value)}
                    className="bg-transparent outline-none font-mono text-[12px]"
                    style={{ color: 'var(--text)' }}
                  />
                  <Pill onClick={() => setDue(todayISO())}>today</Pill>
                  <Pill onClick={() => setDue(addDays(todayISO(), 1))}>tomorrow</Pill>
                  <Pill onClick={() => setDue('')}>someday</Pill>
                </div>
              </Field>
              <Field label="time">
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="bg-transparent outline-none font-mono text-[12px]"
                  style={{ color: 'var(--text)' }}
                />
              </Field>
            </>
          )}

          {task.kind === 'recurring' && (
            <>
              <Field label="days">
                <div className="flex items-center gap-1.5">
                  {WEEKDAYS.map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDay(d)}
                      className="w-6 h-6 rounded-md font-mono text-[11px] uppercase"
                      style={{
                        background: days.has(d) && !daily ? 'var(--accent)' : 'transparent',
                        color: days.has(d) && !daily ? 'var(--bg)' : 'var(--text)',
                        border: '1px solid var(--border)',
                        opacity: daily ? 0.4 : 1
                      }}
                    >
                      {DAY_LABEL[d]}
                    </button>
                  ))}
                  <label className="ml-3 flex items-center gap-1.5 font-mono text-[11px] uppercase" style={{ color: 'var(--muted)' }}>
                    <input
                      type="checkbox"
                      checked={daily}
                      onChange={(e) => {
                        setDaily(e.target.checked)
                        if (e.target.checked) setDays(new Set())
                      }}
                    />
                    daily
                  </label>
                </div>
              </Field>
              <Field label="start">
                <input
                  type="time"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className="bg-transparent outline-none font-mono text-[12px]"
                  style={{ color: 'var(--text)' }}
                />
              </Field>
              <Field label="end">
                <input
                  type="time"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className="bg-transparent outline-none font-mono text-[12px]"
                  style={{ color: 'var(--text)' }}
                />
              </Field>
            </>
          )}
        </div>

        <div className="px-4 py-2 flex items-center gap-3 font-mono text-[10px] uppercase"
             style={{ borderTop: '1px solid var(--border)', color: 'var(--muted)' }}>
          <span>↵ save</span>
          <span>esc cancel</span>
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

function Pill({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-2 py-0.5 rounded-md font-mono text-[10px] uppercase"
      style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}
    >
      {children}
    </button>
  )
}
