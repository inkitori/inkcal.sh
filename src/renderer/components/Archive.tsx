import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useStore, selectArchived, lastCompletionDate } from '@/lib/store'
import { diffDays, todayISO } from '@/lib/date'
import Section from '@/components/Section'
import TaskRow from '@/components/TaskRow'
import { useListKeymap } from '@/lib/keymap'
import { halfPageStep, scrollSelectedInto } from '@/lib/scroll'
import type { Task } from '@/../shared/types'

type ArchiveSection = 'completed' | 'deleted'

interface Row {
  task: Task
  section: ArchiveSection
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

export default function Archive() {
  const open = useStore(s => s.archiveOpen)
  const close = useStore(s => s.closeArchive)
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
    if (!open || !pendingSelectId) return
    const idx = rows.findIndex(r => r.task.id === pendingSelectId)
    if (idx >= 0) setSelected(idx)
    setPendingSelectId(null)
  }, [open, pendingSelectId, rows, setPendingSelectId])

  useEffect(() => {
    if (open) {
      setRenamingId(null)
      if (!pendingSelectId) setSelected(0)
    }
  }, [open, pendingSelectId])

  function actToggle(row: Row) {
    if (row.section === 'completed') uncomplete(row.task.id)
    else restore(row.task.id)
  }

  useListKeymap({
    enabled: open,
    inModal: 'archive',
    onMove: (delta) => {
      if (!rows.length) return
      setSelected(prev => Math.max(0, Math.min(rows.length - 1, prev + delta)))
    },
    onTop: () => setSelected(0),
    onBottom: () => setSelected(Math.max(0, rows.length - 1)),
    onToggle: () => {
      const r = rows[safeIdx]
      if (r) actToggle(r)
    },
    onEdit: () => {
      const r = rows[safeIdx]
      if (r) openEdit(r.task.id)
    },
    onRename: () => {
      const r = rows[safeIdx]
      if (r) setRenamingId(r.task.id)
    },
    onDelete: () => {
      const r = rows[safeIdx]
      if (!r) return
      permanentlyDelete(r.task.id)
      setSelected(idx => Math.min(idx, Math.max(0, rows.length - 2)))
    },
    onEscape: close,
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
    if (!open) return
    scrollSelectedInto(scrollRef.current, 'nearest')
  }, [safeIdx, rows.length, open])

  if (!open) return null

  const renderRow = (row: Row, idx: number) => (
    <TaskRow
      key={`${row.task.id}-${idx}`}
      task={row.task}
      isCompleted={row.section === 'completed'}
      isSelected={idx === safeIdx}
      isRenaming={row.task.id === renamingId}
      showTime={false}
      hideCheckbox={row.section === 'deleted'}
      chips={[{ text: row.label, tone: 'muted' }]}
      onToggle={() => actToggle(row)}
      onClick={() => setSelected(idx)}
      onRenameSubmit={(text) => {
        updateTask(row.task.id, { title: text })
        setRenamingId(null)
      }}
      onRenameCancel={() => setRenamingId(null)}
    />
  )

  const sections: { key: ArchiveSection; title: string; tone?: 'danger' }[] = [
    { key: 'completed', title: 'completed' },
    { key: 'deleted', title: 'deleted', tone: 'danger' }
  ]

  return (
    <div
      className="fixed inset-0 z-30 flex items-start justify-center pt-16"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={close}
    >
      <div
        className="fade-in w-[640px] max-w-[90%] rounded-md flex flex-col"
        style={{
          background: 'var(--bg-2)',
          border: '1px solid var(--border)',
          maxHeight: '76vh'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest"
          style={{ borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}
        >
          archive
        </div>
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3">
          {rows.length === 0 ? (
            <div
              className="p-8 text-center font-mono text-[12px] uppercase"
              style={{ color: 'var(--muted-2)' }}
            >
              archive is empty
            </div>
          ) : (
            sections.map(s => {
              const start = rows.findIndex(r => r.section === s.key)
              if (start < 0) return null
              const slice = rows.filter(r => r.section === s.key)
              return (
                <Section key={s.key} title={s.title} count={slice.length} tone={s.tone}>
                  {slice.map((row, i) => renderRow(row, start + i))}
                </Section>
              )
            })
          )}
        </div>
        <div
          className="px-4 py-2 flex items-center gap-3 font-mono text-[10px] uppercase"
          style={{ borderTop: '1px solid var(--border)', color: 'var(--muted)' }}
        >
          <span>x restore</span>
          <span>dd delete</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  )
}
