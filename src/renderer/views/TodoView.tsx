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
import TaskRow, { type Chip } from '@/components/TaskRow'
import { useListKeymap } from '@/lib/keymap'
import { halfPageStep, scrollSelectedInto } from '@/lib/scroll'
import type { Task } from '@/../shared/types'

type RowSection = 'overdue' | 'today' | 'upcoming' | 'inbox'

interface Row {
  task: Task
  isCompleted: boolean
  section: RowSection
  chips: Chip[]
  /** sort key used within a section (date for overdue/upcoming, time for today) */
  sortKey?: string
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
    const overdueTodoRows: Row[] = overdue.map(t => ({
      task: t, isCompleted: false, section: 'overdue',
      chips: [{ text: dueLabel(t.due!) ?? t.due!, tone: 'danger' }],
      sortKey: t.due ?? today
    }))

    const recurringRows: Row[] = []
    for (const t of recurringTasks) {
      const slot = nextRecurringSlot(t, completions, today)
      if (!slot) continue
      const ruleChip: Chip = { text: recurrenceShort(t.recurrence), tone: 'muted' }

      if (slot.state === 'overdue' || slot.state === 'overdue-completed') {
        recurringRows.push({
          task: t,
          isCompleted: slot.state === 'overdue-completed',
          section: 'overdue',
          chips: [ruleChip, { text: fmtOverdueLabel(slot.date, today, slot.lastCompleted), tone: 'danger' }],
          sortKey: slot.date
        })
      } else if (slot.state === 'today' || slot.state === 'completed-today') {
        recurringRows.push({
          task: t,
          isCompleted: slot.state === 'completed-today',
          section: 'today',
          chips: [ruleChip],
          sortKey: t.recurrence?.start ?? '99:99'
        })
      } else {
        recurringRows.push({
          task: t, isCompleted: false, section: 'upcoming',
          chips: [ruleChip, { text: dueLabel(slot.date) ?? slot.date, tone: 'accent' }],
          sortKey: slot.date
        })
      }
    }

    const byKeyThenTitle = (a: Row, b: Row) => {
      const c = (a.sortKey ?? '').localeCompare(b.sortKey ?? '')
      if (c !== 0) return c
      return (a.task.title ?? '').localeCompare(b.task.title ?? '')
    }

    const overdueRows = sinkCompleted(
      [...overdueTodoRows, ...recurringRows.filter(r => r.section === 'overdue')].sort(byKeyThenTitle)
    )

    const todayTodoRows: Row[] = todayTodos.map(t => ({
      task: t, isCompleted: false, section: 'today',
      chips: [],
      sortKey: t.time ?? '99:99'
    }))

    const todayRows = sinkCompleted(
      [...recurringRows.filter(r => r.section === 'today'), ...todayTodoRows].sort(byKeyThenTitle)
    )

    const upcomingTodoRows: Row[] = upcoming.map(t => ({
      task: t, isCompleted: false, section: 'upcoming',
      chips: [{ text: dueLabel(t.due!) ?? t.due!, tone: 'accent' }],
      sortKey: t.due ?? undefined
    }))

    const upcomingRows = sinkCompleted(
      [...recurringRows.filter(r => r.section === 'upcoming'), ...upcomingTodoRows].sort(byKeyThenTitle)
    )

    const inboxRows: Row[] = inbox.map(t => ({
      task: t, isCompleted: false, section: 'inbox', chips: []
    }))

    return [...overdueRows, ...todayRows, ...upcomingRows, ...inboxRows]
  }, [overdue, recurringTasks, todayTodos, upcoming, inbox, today])

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
      toggle(row.task.id, today)
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

  const renderRow = (row: Row, idx: number) => (
    <TaskRow
      key={`${row.task.id}-${idx}`}
      task={row.task}
      isCompleted={row.isCompleted}
      isSelected={idx === safeIdx}
      isRenaming={row.task.id === renamingId}
      showTime
      chips={row.chips}
      onToggle={() => toggle(row.task.id, today)}
      onClick={() => setSelected(idx)}
      onRenameSubmit={(text) => {
        updateTask(row.task.id, { title: text })
        setRenamingId(null)
      }}
      onRenameCancel={() => setRenamingId(null)}
    />
  )

  const sections: { key: RowSection; title: string; tone?: 'danger' | 'accent' }[] = [
    { key: 'overdue', title: 'overdue', tone: 'danger' },
    { key: 'today', title: 'today', tone: 'accent' },
    { key: 'upcoming', title: 'upcoming' },
    { key: 'inbox', title: 'inbox' }
  ]

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto">
      <div className="px-6 py-5 max-w-[760px] mx-auto fade-in">
        {sections.map(s => {
          const start = rows.findIndex(r => r.section === s.key)
          if (start < 0) return null
          const slice = rows.filter(r => r.section === s.key)
          return (
            <Section key={s.key} title={s.title} count={slice.length} tone={s.tone}>
              {slice.map((row, i) => renderRow(row, start + i))}
            </Section>
          )
        })}
      </div>
    </div>
  )
}

