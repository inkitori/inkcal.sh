import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  useStore,
  selectInboxTodos,
  selectOverdueTodos,
  selectRecurring,
  selectTodayTodos,
  selectUpcomingTodos
} from '@/lib/store'
import {
  instancesForDate,
  selectCatchUpRecurring,
  selectMissedScheduledToday,
  selectOverdueRecurring
} from '@/lib/recurrence'
import { overdueLabel as fmtOverdueLabel, todayISO, weekdayOf } from '@/lib/date'
import { recurrenceShort } from '@/lib/parser'
import Section from '@/components/Section'
import TaskRow from '@/components/TaskRow'
import { useListKeymap } from '@/lib/keymap'
import type { Task } from '@/../shared/types'

interface Row {
  task: Task
  date: string  // for recurring instances; for one-offs same as due or today
  isCompleted: boolean
  isOverdue?: boolean
  /** present on missed recurring rows in the overdue section */
  overdueLabel?: string
  /** sortable date used for ordering inside overdue (missed-date for recurring, due for todos) */
  overdueSortDate?: string
  showDue?: boolean
  scheduleOnly?: boolean
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

  const overdue = useMemo(() => selectOverdueTodos({ tasks, completions } as any), [tasks, completions])
  const overdueRecurring = useMemo(
    () => selectOverdueRecurring(tasks, completions, today),
    [tasks, completions, today]
  )
  const missedScheduledToday = useMemo(
    () => selectMissedScheduledToday(tasks, completions, today),
    [tasks, completions, today]
  )
  const catchUpRecurring = useMemo(
    () => selectCatchUpRecurring(tasks, completions, today),
    [tasks, completions, today]
  )
  const todayTodos = useMemo(() => selectTodayTodos({ tasks, completions } as any), [tasks, completions])
  const upcoming = useMemo(() => selectUpcomingTodos({ tasks, completions } as any), [tasks, completions])
  const inbox = useMemo(() => selectInboxTodos({ tasks, completions } as any), [tasks, completions])
  const todayRecurring = useMemo(() => instancesForDate(tasks, completions, today), [tasks, completions, today])
  const recurringOffSchedule = useMemo(() => {
    const wd = weekdayOf(today)
    return selectRecurring({ tasks, completions } as any).filter(t => {
      const r = t.recurrence
      if (!r) return false
      if (r.days?.length) {
        if (r.days.includes(wd)) return false
        return true
      }
      if (r.daily) return false
      return true
    })
      // Catch-up rows (off-schedule task completed today) live in today's
      // section, not the off-schedule recurring section.
      .filter(t => !completions.some(c => c.taskId === t.id && c.date === today))
      .sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''))
  }, [tasks, completions, today])

  const rows: Row[] = useMemo(() => {
    // OVERDUE: one-off todos with due < today (whether or not completed today —
    // catch-ups stay sunk in this section for the rest of today) plus recurring
    // tasks that were missed AND aren't scheduled today.
    const overdueMerged: Row[] = []
    for (const t of overdue) {
      const completedToday = completions.some(c => c.taskId === t.id && c.date === today)
      overdueMerged.push({
        task: t, date: today, isCompleted: completedToday, isOverdue: true, showDue: true,
        overdueSortDate: t.due ?? today
      })
    }
    for (const o of overdueRecurring) {
      overdueMerged.push({
        task: o.task,
        date: today, // completing creates a Completion for today, not the missed date
        isCompleted: false,
        isOverdue: true,
        showDue: false,
        overdueLabel: fmtOverdueLabel(o.lastExpected, today, o.lastCompleted),
        overdueSortDate: o.lastExpected
      })
    }
    overdueMerged.sort((a, b) => {
      const ad = a.overdueSortDate ?? ''
      const bd = b.overdueSortDate ?? ''
      const c = ad.localeCompare(bd)
      if (c !== 0) return c
      return (a.task.title ?? '').localeCompare(b.task.title ?? '')
    })
    const overdueRows = sinkCompleted(overdueMerged)

    // TODAY recurring: scheduled instances. If a scheduled-today task was
    // missed at its previous occurrence, prepend a "missed last X" chip in
    // place of the recurrence label.
    const missedById = new Map(missedScheduledToday.map(m => [m.task.id, m]))
    const todayRecurringRows: Row[] = todayRecurring.map(inst => {
      const m = missedById.get(inst.task.id)
      const showMissedChip = m && !inst.isCompleted
      return {
        task: inst.task,
        date: today,
        isCompleted: inst.isCompleted,
        showDue: false,
        overdueLabel: showMissedChip ? fmtOverdueLabel(m!.lastExpected, today, m!.lastCompleted) : undefined,
        recurrenceLabel: showMissedChip ? undefined : recurrenceShort(inst.task.recurrence)
      }
    })

    const todayTodoRows: Row[] = todayTodos.map(t => ({
      task: t, date: today,
      isCompleted: completions.some(c => c.taskId === t.id),
      showDue: false
    }))

    // Catch-up: a recurring task completed today even though today isn't a
    // scheduled day. Render it in today's section as completed (sunk).
    const catchUpRows: Row[] = catchUpRecurring.map(t => ({
      task: t, date: today,
      isCompleted: true,
      showDue: false,
      recurrenceLabel: recurrenceShort(t.recurrence)
    }))

    const todaySection = sinkCompleted([...todayRecurringRows, ...todayTodoRows, ...catchUpRows])

    const upcomingRows: Row[] = sinkCompleted(upcoming.map(t => ({
      task: t, date: t.due ?? today,
      isCompleted: completions.some(c => c.taskId === t.id),
      showDue: true
    })))

    const inboxRows: Row[] = sinkCompleted(inbox.map(t => ({
      task: t, date: today,
      isCompleted: completions.some(c => c.taskId === t.id),
      showDue: false
    })))

    const offScheduleRows: Row[] = recurringOffSchedule.map(t => ({
      task: t,
      date: today,
      isCompleted: false,
      showDue: false,
      scheduleOnly: true,
      recurrenceLabel: recurrenceShort(t.recurrence)
    }))

    return [
      ...overdueRows,
      ...todaySection,
      ...upcomingRows,
      ...inboxRows,
      ...offScheduleRows
    ]
  }, [overdue, overdueRecurring, missedScheduledToday, catchUpRecurring, todayRecurring, todayTodos, upcoming, inbox, recurringOffSchedule, completions, today])

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
      if (!row || row.scheduleOnly) return
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

  // Keep the cursor in view as the user navigates with j/k/gg/G.
  useLayoutEffect(() => {
    scrollSelectedInto(scrollRef.current, 'nearest')
  }, [safeIdx, rows.length])

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
          hideCheckbox={row.scheduleOnly}
          recurrenceLabel={row.recurrenceLabel}
          overdueLabel={row.overdueLabel}
          onToggle={row.scheduleOnly ? undefined : () => toggle(row.task.id, row.date)}
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

  const overdueRows = rows.filter(r => r.isOverdue)
  const todayRows = rows.filter(r => !r.isOverdue && !r.scheduleOnly && r.date === today && (r.task.due === today || r.task.kind === 'recurring'))
  const upcomingRows = rows.filter(r => r.task.kind === 'todo' && r.task.due && r.task.due > today)
  const inboxRows = rows.filter(r => r.task.kind === 'todo' && (r.task.due === null || r.task.due === undefined))
  const recurringRows = rows.filter(r => r.scheduleOnly)

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
      {recurringRows.length > 0 && (
        <Section title="recurring" count={recurringRows.length}>
          {(() => { const out = renderRows(recurringRows); cursor += recurringRows.length; return out })()}
        </Section>
      )}
      </div>
    </div>
  )
}

// Find the currently selected row (by data-selected="true") inside the scroll
// container and align it within the viewport.
export function scrollSelectedInto(container: HTMLElement | null, block: ScrollLogicalPosition) {
  if (!container) return
  const el = container.querySelector<HTMLElement>('[data-selected="true"]')
  if (!el) return
  el.scrollIntoView({ block, inline: 'nearest' })
}

// Approx half a viewport in row-units, using the selected row's height as a
// proxy. Falls back to 10 if no row is rendered yet.
export function halfPageStep(container: HTMLElement | null): number {
  if (!container) return 10
  const el = container.querySelector<HTMLElement>('[data-selected="true"]')
  const rowH = el?.getBoundingClientRect().height
  if (!rowH || rowH <= 0) return 10
  return Math.max(1, Math.round((container.clientHeight / rowH) / 2))
}
