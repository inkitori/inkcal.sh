import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useStore, selectArchived, lastCompletionDate } from '@/lib/store'
import { diffDays, todayISO } from '@/lib/date'
import Section from '@/components/Section'
import TaskRow from '@/components/TaskRow'
import { isInTextInput } from '@/lib/keymap'
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

let lastD = 0
let lastG = 0

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

  // useListKeymap is gated on archiveOpen, so the modal handles its own keys.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (renamingId) return
      if (isInTextInput(e.target)) return
      if (e.metaKey || e.altKey) return
      const k = e.key

      if (e.ctrlKey && !e.shiftKey) {
        if (k === 'd') {
          e.preventDefault()
          if (rows.length === 0) return
          const step = halfStep(scrollRef.current)
          setSelected(prev => Math.min(rows.length - 1, prev + step))
          return
        }
        if (k === 'u') {
          e.preventDefault()
          if (rows.length === 0) return
          const step = halfStep(scrollRef.current)
          setSelected(prev => Math.max(0, prev - step))
          return
        }
        return
      }
      if (e.ctrlKey) return

      if (k === 'Escape') { e.preventDefault(); close(); return }
      if (k === 'j' || k === 'ArrowDown') {
        e.preventDefault()
        if (!rows.length) return
        setSelected(p => Math.min(rows.length - 1, p + 1))
        return
      }
      if (k === 'k' || k === 'ArrowUp') {
        e.preventDefault()
        if (!rows.length) return
        setSelected(p => Math.max(0, p - 1))
        return
      }
      if (k === 'G') { e.preventDefault(); setSelected(Math.max(0, rows.length - 1)); return }
      if (k === 'g') {
        e.preventDefault()
        const now = Date.now()
        if (now - lastG < 400) {
          setSelected(0)
          lastG = 0
        } else {
          lastG = now
        }
        return
      }
      if (k === ' ' || k === 'x') {
        e.preventDefault()
        const r = rows[safeIdx]
        if (r) actToggle(r)
        return
      }
      if (k === 'e') {
        e.preventDefault()
        const r = rows[safeIdx]
        if (r) openEdit(r.task.id)
        return
      }
      if (k === 'i') {
        e.preventDefault()
        const r = rows[safeIdx]
        if (r) setRenamingId(r.task.id)
        return
      }
      if (k === 'd') {
        e.preventDefault()
        const now = Date.now()
        if (now - lastD < 400) {
          const r = rows[safeIdx]
          if (r) {
            permanentlyDelete(r.task.id)
            setSelected(idx => Math.min(idx, Math.max(0, rows.length - 2)))
          }
          lastD = 0
        } else {
          lastD = now
        }
        return
      }
      if (k === 'Backspace' || k === 'Delete') {
        e.preventDefault()
        const r = rows[safeIdx]
        if (r) {
          permanentlyDelete(r.task.id)
          setSelected(idx => Math.min(idx, Math.max(0, rows.length - 2)))
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, rows, safeIdx, renamingId, close, openEdit, permanentlyDelete, restore, uncomplete])

  useLayoutEffect(() => {
    if (!open) return
    const el = scrollRef.current?.querySelector<HTMLElement>('[data-selected="true"]')
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [safeIdx, rows.length, open])

  if (!open) return null

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
          hideCheckbox={row.section === 'deleted'}
          recurrenceLabel={row.label}
          onToggle={() => actToggle(row)}
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
            <>
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
            </>
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

function halfStep(container: HTMLElement | null): number {
  if (!container) return 10
  const el = container.querySelector<HTMLElement>('[data-selected="true"]')
  const rowH = el?.getBoundingClientRect().height
  if (!rowH || rowH <= 0) return 10
  return Math.max(1, Math.round((container.clientHeight / rowH) / 2))
}
