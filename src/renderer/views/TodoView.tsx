import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  useStore,
  selectInboxTodos,
  selectOverdueTodos,
  selectRecurring,
  selectTodayTodos,
  selectUpcomingTodos
} from '@/lib/store'
import { nextRecurringSlot } from '@/../shared/recurrence'
import { dueLabel, overdueLabel as fmtOverdueLabel, todayISO } from '@/lib/date'
import { recurrenceShort } from '@/lib/parser'
import Section from '@/components/Section'
import TaskRow from '@/components/TaskRow'
import { useListKeymap } from '@/lib/keymap'
import type { Task } from '@/../shared/types'

type RowSection = 'overdue' | 'today' | 'upcoming' | 'inbox'

interface Row {
  task: Task
  date: string
  isCompleted: boolean
  section: RowSection
  isOverdue?: boolean
  /** danger-tone label shown in overdue section (e.g. "missed Mon") */
  overdueLabel?: string
  /** sortable date used inside overdue (missed-date for recurring, due for todos) */
  overdueSortDate?: string
  showDue?: boolean
  /** muted right-side chip: recurrence rule today, or "in 3d" / weekday for upcoming recurrings */
  recurrenceLabel?: string
}

function sinkCompleted(rs: Row[]): Row[] {
  return [...rs].sort((a, b) => Number(a.isCompleted) - Number(b.isCompleted))
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
  const scrollRef = useRef<HTMLDivElement>(null)

  const today = todayISO()

  const overdue = useMemo(() => selectOverdueTodos(tasks, completions), [tasks, completions])
  const todayTodos = useMemo(() => selectTodayTodos(tasks, completions), [tasks, completions])
  const upcoming = useMemo(() => selectUpcomingTodos(tasks, completions), [tasks, completions])
  const inbox = useMemo(() => selectInboxTodos(tasks, completions), [tasks, completions])
  const recurringTasks = useMemo(() => selectRecurring(tasks), [tasks])

  const rows: Row[] = useMemo(() => {
    // OVERDUE one-off todos. Completing one removes it from this list (it
    // appears in Archive instead), so isCompleted is always false here.
    const overdueTodoRows: Row[] = overdue.map(t => ({
      task: t, date: today, isCompleted: false,
      section: 'overdue', isOverdue: true, showDue: true,
      overdueSortDate: t.due ?? today
    }))

    // RECURRING: each task resolves to exactly one slot.
    const recurringRows: Row[] = []
    for (const t of recurringTasks) {
      const slot = nextRecurringSlot(t, completions, today)
      if (!slot) continue
      if (slot.state === 'overdue') {
        recurringRows.push({
          task: t, date: today, isCompleted: false,
          section: 'overdue', isOverdue: true, showDue: false,
          overdueLabel: fmtOverdueLabel(slot.date, today, slot.lastCompleted),
          overdueSortDate: slot.date
        })
      } else if (slot.state === 'overdue-completed') {
        recurringRows.push({
          task: t, date: today, isCompleted: true,
          section: 'overdue', isOverdue: true, showDue: false,
          overdueLabel: fmtOverdueLabel(slot.date, today, slot.lastCompleted),
          overdueSortDate: slot.date
        })
      } else if (slot.state === 'today') {
        recurringRows.push({
          task: t, date: today, isCompleted: false,
          section: 'today', showDue: false,
          recurrenceLabel: recurrenceShort(t.recurrence)
        })
      } else if (slot.state === 'completed-today') {
        recurringRows.push({
          task: t, date: today, isCompleted: true,
          section: 'today', showDue: false,
          recurrenceLabel: recurrenceShort(t.recurrence)
        })
      } else {
        recurringRows.push({
          task: t, date: today, isCompleted: false,
          section: 'upcoming', showDue: false,
          recurrenceLabel: dueLabel(slot.date) ?? slot.date
        })
      }
    }

    const overdueRows = sinkCompleted(
      [...overdueTodoRows, ...recurringRows.filter(r => r.section === 'overdue')]
        .sort((a, b) => {
          const c = (a.overdueSortDate ?? '').localeCompare(b.overdueSortDate ?? '')
          if (c !== 0) return c
          return (a.task.title ?? '').localeCompare(b.task.title ?? '')
        })
    )

    // One-off todos vanish on completion (they go to Archive), so all rows
    // here are uncompleted. row.date is today so toggle records a completion
    // for today regardless of which section the task lived in.
    const todayTodoRows: Row[] = todayTodos.map(t => ({
      task: t, date: today, isCompleted: false,
      section: 'today', showDue: false
    }))

    const todayRows = sinkCompleted([
      ...recurringRows.filter(r => r.section === 'today'),
      ...todayTodoRows
    ])

    const upcomingTodoRows: Row[] = upcoming.map(t => ({
      task: t, date: today, isCompleted: false,
      section: 'upcoming', showDue: true
    }))

    const upcomingRows = sinkCompleted([
      ...recurringRows.filter(r => r.section === 'upcoming'),
      ...upcomingTodoRows
    ])

    const inboxRows: Row[] = inbox.map(t => ({
      task: t, date: today, isCompleted: false,
      section: 'inbox', showDue: false
    }))

    return [...overdueRows, ...todayRows, ...upcomingRows, ...inboxRows]
  }, [overdue, recurringTasks, todayTodos, upcoming, inbox, completions, today])

  const safeIdx = Math.min(selected, Math.max(0, rows.length - 1))

  const pendingSelectId = useStore(s => s.pendingSelectId)
  const setPendingSelectId = useStore(s => s.setPendingSelectId)
  useEffect(() => {
    if (!pendingSelectId) return
    const idx = rows.findIndex(r => r.task.id === pendingSelectId)
    if (idx >= 0) setSelected(idx)
    setPendingSelectId(null)
  }, [pendingSelectId, rows, setPendingSelectId])

  useListKeymap({
    onMove: (delta) => {
      if (!rows.length) return
      setSelected(prev => Math.max(0, Math.min(rows.length - 1, prev + delta)))
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
    },
    onCenterView: () => scrollSelectedInto(scrollRef.current, 'center'),
    onTopView: () => scrollSelectedInto(scrollRef.current, 'start'),
    onBottomView: () => scrollSelectedInto(scrollRef.current, 'end'),
    onHalfPageDown: () => {
      if (!rows.length) return
      const step = halfPageStep(scrollRef.current)
      setSelected(prev => Math.min(rows.length - 1, prev + step))
    },
    onHalfPageUp: () => {
      if (!rows.length) return
      const step = halfPageStep(scrollRef.current)
      setSelected(prev => Math.max(0, prev - step))
    }
  })

  useLayoutEffect(() => {
    scrollSelectedInto(scrollRef.current, 'nearest')
  }, [safeIdx, rows.length])

  if (rows.length === 0) {
    return (
      <div className="p-12 text-center font-mono text-[12px] uppercase" style={{ color: 'var(--muted-2)' }}>
        nothing to do. press ⌘K to capture
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
          recurrenceLabel={row.recurrenceLabel}
          overdueLabel={row.overdueLabel}
          onToggle={() => toggle(row.task.id, row.date)}
          onDelete={() => {
            deleteTask(row.task.id)
            setSelected(i => Math.min(i, Math.max(0, rows.length - 2)))
          }}
          onClick={() => setSelected(idx)}
          onRenameSubmit={(text) => {
            updateTask(row.task.id, { title: text })
            setRenamingId(null)
          }}
          onRenameCancel={() => setRenamingId(null)}
        />
      )
    })

  const overdueRows = rows.filter(r => r.section === 'overdue')
  const todayRows = rows.filter(r => r.section === 'today')
  const upcomingRows = rows.filter(r => r.section === 'upcoming')
  const inboxRows = rows.filter(r => r.section === 'inbox')

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto">
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
    </div>
  )
}

export function scrollSelectedInto(container: HTMLElement | null, block: ScrollLogicalPosition) {
  if (!container) return
  const el = container.querySelector<HTMLElement>('[data-selected="true"]')
  if (!el) return
  el.scrollIntoView({ block, inline: 'nearest' })
}

// Half-viewport in row-units, using the selected row's height as a proxy.
export function halfPageStep(container: HTMLElement | null): number {
  if (!container) return 10
  const el = container.querySelector<HTMLElement>('[data-selected="true"]')
  const rowH = el?.getBoundingClientRect().height
  if (!rowH || rowH <= 0) return 10
  return Math.max(1, Math.round((container.clientHeight / rowH) / 2))
}
