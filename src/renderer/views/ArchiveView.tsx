import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useStore, selectArchived, lastCompletionDate } from '@/lib/store'
import { diffDays, todayISO } from '@/lib/date'
import Section from '@/components/Section'
import TaskRow from '@/components/TaskRow'
import { useListKeymap } from '@/lib/keymap'
import { halfPageStep, scrollSelectedInto } from './TodoView'
import type { Task } from '@/../shared/types'

type ArchiveSection = 'completed' | 'deleted'

interface Row {
  task: Task
  section: ArchiveSection
  /** muted right-side label: "done yesterday", "deleted 3d ago", etc. */
  label: string
}

function describeAge(prefix: string, dateISO: string, today: string): string {
  const d = dateISO.length >= 10 ? dateISO.slice(0, 10) : dateISO
  const days = diffDays(today, d)
  if (days <= 0) return `${prefix} today`
  if (days === 1) return `${prefix} yesterday`
  if (days < 30) return `${prefix} ${days}d ago`
  return `${prefix} ${d}`
}

export default function ArchiveView() {
  const tasks = useStore(s => s.tasks)
  const completions = useStore(s => s.completions)
  const uncomplete = useStore(s => s.uncompleteTask)
  const restore = useStore(s => s.restoreTask)
  const permanentlyDelete = useStore(s => s.permanentlyDeleteTask)
  const openEdit = useStore(s => s.openEdit)
  const updateTask = useStore(s => s.updateTask)

  const [selected, setSelected] = useState(0)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const today = todayISO()
  const archived = useMemo(() => selectArchived(tasks, completions), [tasks, completions])

  const rows: Row[] = useMemo(() => {
    const out: Row[] = []
    for (const t of archived.completed) {
      const date = lastCompletionDate(t.id, completions)
      out.push({
        task: t,
        section: 'completed',
        label: date ? describeAge('done', date, today) : 'done'
      })
    }
    for (const t of archived.deleted) {
      out.push({
        task: t,
        section: 'deleted',
        label: t.deletedAt ? describeAge('deleted', t.deletedAt, today) : 'deleted'
      })
    }
    return out
  }, [archived, completions, today])

  const safeIdx = Math.min(selected, Math.max(0, rows.length - 1))

  const pendingSelectId = useStore(s => s.pendingSelectId)
  const setPendingSelectId = useStore(s => s.setPendingSelectId)
  useEffect(() => {
    if (!pendingSelectId) return
    const idx = rows.findIndex(r => r.task.id === pendingSelectId)
    if (idx >= 0) setSelected(idx)
    setPendingSelectId(null)
  }, [pendingSelectId, rows, setPendingSelectId])

  function actToggle(row: Row) {
    if (row.section === 'completed') uncomplete(row.task.id)
    else restore(row.task.id)
  }

  useListKeymap({
    onMove: (delta) => {
      if (!rows.length) return
      setSelected(prev => Math.max(0, Math.min(rows.length - 1, prev + delta)))
    },
    onTop: () => setSelected(0),
    onBottom: () => setSelected(Math.max(0, rows.length - 1)),
    onToggle: () => {
      const row = rows[safeIdx]
      if (row) actToggle(row)
    },
    onDelete: () => {
      const row = rows[safeIdx]
      if (!row) return
      permanentlyDelete(row.task.id)
      setSelected(idx => Math.min(idx, Math.max(0, rows.length - 2)))
    },
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
        archive is empty
      </div>
    )
  }

  let cursor = 0
  const renderRows = (slice: Row[]) =>
    slice.map((row, i) => {
      const idx = cursor + i
      return (
        <TaskRow
          key={`${row.task.id}-${idx}`}
          task={row.task}
          date={today}
          isCompleted={row.section === 'completed'}
          isSelected={idx === safeIdx}
          isRenaming={row.task.id === renamingId}
          showDue={false}
          showTime={false}
          recurrenceLabel={row.label}
          onToggle={() => actToggle(row)}
          onDelete={() => {
            permanentlyDelete(row.task.id)
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

  const completedRows = rows.filter(r => r.section === 'completed')
  const deletedRows = rows.filter(r => r.section === 'deleted')

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto">
      <div className="px-6 py-5 max-w-[760px] mx-auto fade-in">
        {completedRows.length > 0 && (
          <Section title="completed" count={completedRows.length}>
            {(() => { const out = renderRows(completedRows); cursor += completedRows.length; return out })()}
          </Section>
        )}
        {deletedRows.length > 0 && (
          <Section title="deleted" count={deletedRows.length} tone="danger">
            {(() => { const out = renderRows(deletedRows); cursor += deletedRows.length; return out })()}
          </Section>
        )}
      </div>
    </div>
  )
}
