import { useMemo, useState } from 'react'
import {
  useStore,
  selectInboxTodos,
  selectOverdueTodos,
  selectTodayTodos,
  selectUpcomingTodos
} from '@/lib/store'
import { instancesForDate } from '@/lib/recurrence'
import { todayISO } from '@/lib/date'
import Section from '@/components/Section'
import TaskRow from '@/components/TaskRow'
import { useListKeymap } from '@/lib/keymap'
import type { Task } from '@/../shared/types'

interface Row {
  task: Task
  date: string  // for recurring instances; for one-offs same as due or today
  isCompleted: boolean
  isOverdue?: boolean
  showDue?: boolean
}

export default function TodoView() {
  const tasks = useStore(s => s.tasks)
  const completions = useStore(s => s.completions)
  const toggle = useStore(s => s.toggleCompletion)
  const deleteTask = useStore(s => s.deleteTask)
  const openCapture = useStore(s => s.openCapture)
  const openEdit = useStore(s => s.openEdit)
  const updateTask = useStore(s => s.updateTask)

  const [selected, setSelected] = useState(0)
  const [renamingId, setRenamingId] = useState<string | null>(null)

  const today = todayISO()

  const overdue = useMemo(() => selectOverdueTodos({ tasks, completions } as any), [tasks, completions])
  const todayTodos = useMemo(() => selectTodayTodos({ tasks, completions } as any), [tasks, completions])
  const upcoming = useMemo(() => selectUpcomingTodos({ tasks, completions } as any), [tasks, completions])
  const inbox = useMemo(() => selectInboxTodos({ tasks, completions } as any), [tasks, completions])
  const todayRecurring = useMemo(() => instancesForDate(tasks, completions, today), [tasks, completions, today])

  const rows: Row[] = useMemo(() => {
    const r: Row[] = []
    for (const t of overdue) r.push({ task: t, date: today, isCompleted: false, isOverdue: true, showDue: true })
    for (const inst of todayRecurring) r.push({ task: inst.task, date: today, isCompleted: inst.isCompleted, showDue: false })
    for (const t of todayTodos) {
      const completed = completions.some(c => c.taskId === t.id)
      r.push({ task: t, date: today, isCompleted: completed, showDue: false })
    }
    for (const t of upcoming) {
      const completed = completions.some(c => c.taskId === t.id)
      r.push({ task: t, date: t.due ?? today, isCompleted: completed, showDue: true })
    }
    for (const t of inbox) {
      const completed = completions.some(c => c.taskId === t.id)
      r.push({ task: t, date: today, isCompleted: completed, showDue: false })
    }
    return r
  }, [overdue, todayRecurring, todayTodos, upcoming, inbox, completions, today])

  const safeIdx = Math.min(selected, Math.max(0, rows.length - 1))

  useListKeymap({
    onMove: (delta) => {
      if (!rows.length) return
      setSelected(prev => {
        const next = (prev + delta + rows.length) % rows.length
        return next
      })
    },
    onTop: () => setSelected(0),
    onBottom: () => setSelected(Math.max(0, rows.length - 1)),
    onToggle: () => {
      const row = rows[safeIdx]
      if (!row) return
      toggle(row.task.id, row.date)
    },
    onDelete: () => {
      const row = rows[safeIdx]
      if (!row) return
      deleteTask(row.task.id)
      setSelected(idx => Math.min(idx, Math.max(0, rows.length - 2)))
    },
    onOpenBelow: () => openCapture('today: '),
    onRename: () => {
      const row = rows[safeIdx]
      if (row) setRenamingId(row.task.id)
    },
    onEdit: () => {
      const row = rows[safeIdx]
      if (row) openEdit(row.task.id)
    }
  })

  if (rows.length === 0) {
    return (
      <div className="p-12 text-center font-mono text-[12px] uppercase" style={{ color: 'var(--muted-2)' }}>
        nothing to do — press ⌘K to capture
      </div>
    )
  }

  let cursor = 0
  const renderRows = (slice: Row[]) =>
    slice.map((row, i) => {
      const idx = cursor + i
      return (
        <TaskRow
          key={`${row.task.id}-${row.date}-${idx}`}
          task={row.task}
          date={row.date}
          isCompleted={row.isCompleted}
          isOverdue={row.isOverdue}
          isSelected={idx === safeIdx}
          isRenaming={row.task.id === renamingId}
          showDue={row.showDue}
          showTime
          onToggle={() => toggle(row.task.id, row.date)}
          onClick={() => setSelected(idx)}
          onRenameSubmit={(text) => {
            updateTask(row.task.id, { title: text })
            setRenamingId(null)
          }}
          onRenameCancel={() => setRenamingId(null)}
        />
      )
    })

  const overdueRows = rows.filter(r => r.isOverdue)
  const todayRows = rows.filter(r => !r.isOverdue && r.date === today && (r.task.due === today || r.task.kind === 'recurring'))
  const upcomingRows = rows.filter(r => r.task.kind === 'todo' && r.task.due && r.task.due > today)
  const inboxRows = rows.filter(r => r.task.kind === 'todo' && (r.task.due === null || r.task.due === undefined))

  return (
    <div className="px-6 py-5 max-w-[760px] mx-auto fade-in">
      {overdueRows.length > 0 && (
        <Section title="overdue" count={overdueRows.length} tone="danger">
          {(() => { const out = renderRows(overdueRows); cursor += overdueRows.length; return out })()}
        </Section>
      )}
      {todayRows.length > 0 && (
        <Section title="today" count={todayRows.length} tone="accent">
          {(() => { const out = renderRows(todayRows); cursor += todayRows.length; return out })()}
        </Section>
      )}
      {upcomingRows.length > 0 && (
        <Section title="upcoming" count={upcomingRows.length}>
          {(() => { const out = renderRows(upcomingRows); cursor += upcomingRows.length; return out })()}
        </Section>
      )}
      {inboxRows.length > 0 && (
        <Section title="inbox" count={inboxRows.length}>
          {(() => { const out = renderRows(inboxRows); cursor += inboxRows.length; return out })()}
        </Section>
      )}
    </div>
  )
}
