import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '@/lib/store'
import { WEEKDAYS } from '@/../shared/types'
import type { Recurrence, Task, Weekday } from '@/../shared/types'
import {
  parseSchedule,
  parseTimeRange,
  scheduleToInput,
  timeRangeToInput
} from '@/lib/parser'
import ScheduleInput from './ScheduleInput'

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
  const [schedule, setSchedule] = useState<string>('')
  const [timeRange, setTimeRange] = useState<string>('')
  const [days, setDays] = useState<Set<Weekday>>(new Set())
  const [daily, setDaily] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const submitRef = useRef<() => void>(() => {})

  useEffect(() => {
    if (!open || !task) return
    setTitle(task.title ?? task.body ?? '')
    setError(null)
    if (task.kind === 'todo') {
      setSchedule(scheduleToInput({ kind: 'todo', due: task.due ?? null, time: task.time, endTime: task.endTime }))
    } else {
      setSchedule('')
    }
    if (task.kind === 'recurring') {
      setTimeRange(timeRangeToInput(task.recurrence))
      setDays(new Set(task.recurrence?.days ?? []))
      setDaily(!!task.recurrence?.daily)
    } else {
      setTimeRange('')
      setDays(new Set())
      setDaily(false)
    }
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
    const patch: Partial<Task> = {}
    const trimmed = title.trim()
    if (trimmed.length > 0) {
      if (task.kind === 'note') patch.body = trimmed
      else patch.title = trimmed
    }
    if (task.kind === 'todo') {
      const sched = schedule.trim()
      if (!sched) {
        patch.due = null
        patch.time = undefined
        patch.endTime = undefined
      } else {
        const parsed = parseSchedule(sched)
        if (!parsed || parsed.kind !== 'todo') {
          setError('couldn’t parse that')
          return
        }
        patch.due = parsed.due
        patch.time = parsed.time
        patch.endTime = parsed.endTime
      }
    }
    if (task.kind === 'recurring') {
      const rec: Recurrence = {}
      if (daily) rec.daily = true
      else if (days.size > 0) rec.days = WEEKDAYS.filter(d => days.has(d))
      const tr = timeRange.trim()
      if (tr) {
        const parsed = parseTimeRange(tr)
        if (!parsed) {
          setError('couldn’t parse time')
          return
        }
        if (parsed.start) rec.start = parsed.start
        if (parsed.end) rec.end = parsed.end
      }
      patch.recurrence = rec
    }
    updateTask(task.id, patch)
    close()
  }

  submitRef.current = submit

  function toggleDay(d: Weekday) {
    setDays(prev => {
      const next = new Set(prev)
      if (next.has(d)) next.delete(d)
      else next.add(d)
      return next
    })
    setDaily(false)
  }

  function applyDateKeyword(keyword: 'today' | 'tomorrow') {
    const parsed = parseSchedule(schedule.trim())
    if (parsed?.kind === 'todo' && parsed.time) {
      const timePart = parsed.endTime ? `${parsed.time}-${parsed.endTime}` : parsed.time
      setSchedule(`${keyword} ${timePart}`)
    } else {
      setSchedule(keyword)
    }
    setError(null)
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

          {task.kind === 'todo' && (
            <FieldTop label="when">
              <div className="flex items-start gap-2">
                <ScheduleInput
                  mode="schedule"
                  value={schedule}
                  onChange={(v) => { setSchedule(v); setError(null) }}
                  placeholder="e.g. today 10:00, fri 14:00, 2026-05-12, !may 6 at noon"
                  className="flex-1 flex flex-col gap-1"
                  inputClassName="w-full bg-transparent outline-none font-mono text-[12px]"
                  inputStyle={{ color: 'var(--text)' }}
                />
                <Pill onClick={() => applyDateKeyword('today')}>today</Pill>
                <Pill onClick={() => applyDateKeyword('tomorrow')}>tomorrow</Pill>
                {schedule && <Pill onClick={() => { setSchedule(''); setError(null) }}>clear</Pill>}
              </div>
            </FieldTop>
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
                      className="w-7 h-7 rounded-md font-mono text-[12px] uppercase"
                      style={{
                        background: days.has(d) && !daily ? 'var(--accent)' : 'transparent',
                        color: days.has(d) && !daily ? 'var(--bg)' : 'var(--text)',
                        border: '1px solid var(--border)'
                      }}
                    >
                      {DAY_LABEL[d]}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setDaily(!daily)
                      if (!daily) setDays(new Set())
                    }}
                    className="ml-2 h-7 px-2.5 rounded-md font-mono text-[12px] uppercase"
                    style={{
                      background: daily ? 'var(--accent)' : 'transparent',
                      color: daily ? 'var(--bg)' : 'var(--text)',
                      border: '1px solid var(--border)'
                    }}
                  >
                    daily
                  </button>
                </div>
              </Field>
              <FieldTop label="time">
                <ScheduleInput
                  mode="time-range"
                  value={timeRange}
                  onChange={(v) => { setTimeRange(v); setError(null) }}
                  placeholder="e.g. 10:00 or 10:00-11:00"
                  className="flex flex-col gap-1"
                  inputClassName="w-full bg-transparent outline-none font-mono text-[12px]"
                  inputStyle={{ color: 'var(--text)' }}
                />
              </FieldTop>
            </>
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

function Pill({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-2.5 py-1 rounded-md font-mono text-[11px] uppercase"
      style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}
    >
      {children}
    </button>
  )
}
