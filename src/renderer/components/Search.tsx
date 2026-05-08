import { useEffect, useMemo, useRef, useState } from 'react'
import Fuse from 'fuse.js'
import { useStore } from '@/lib/store'
import type { Task } from '@/../shared/types'

interface Item {
  id: string
  label: string
  hint?: string
  task: Task
}

export default function Search() {
  const open = useStore(s => s.searchOpen)
  const close = useStore(s => s.closeSearch)
  const view = useStore(s => s.view)
  const tasks = useStore(s => s.tasks)
  const completions = useStore(s => s.completions)
  const setView = useStore(s => s.setView)
  const setPendingSelectId = useStore(s => s.setPendingSelectId)

  const inputRef = useRef<HTMLInputElement>(null)
  const [q, setQ] = useState('')
  const [cursor, setCursor] = useState(0)

  useEffect(() => {
    if (open) {
      setQ('')
      setCursor(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  const scope: 'notes' | 'tasks' = view === 'notes' ? 'notes' : 'tasks'

  const items: Item[] = useMemo(() => {
    const completedIds = new Set(completions.map(c => c.taskId))
    function hintFor(t: Task): string {
      if (t.deletedAt) return 'deleted'
      if (t.kind === 'todo' && completedIds.has(t.id)) return 'done'
      if (t.kind === 'recurring') return 'recurring'
      if (t.kind === 'note') return 'note'
      return t.due ?? 'inbox'
    }
    if (scope === 'notes') {
      return tasks
        .filter(t => t.kind === 'note')
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(t => ({
          id: t.id,
          label: (t.body ?? '').replace(/\s+/g, ' ').trim() || '(empty)',
          hint: hintFor(t),
          task: t
        }))
    }
    return tasks
      .filter(t => t.kind === 'todo' || t.kind === 'recurring')
      .sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''))
      .map(t => ({
        id: t.id,
        label: t.title ?? '(untitled)',
        hint: hintFor(t),
        task: t
      }))
  }, [tasks, completions, scope])

  const filtered = useMemo(() => {
    if (!q) return items.slice(0, 20)
    const fuse = new Fuse(items, { keys: ['label', 'hint'], threshold: 0.4 })
    return fuse.search(q).slice(0, 20).map(r => r.item)
  }, [q, items])

  if (!open) return null

  function pick(it: Item) {
    const t = it.task
    const isCompletedTodo = t.kind === 'todo' && completions.some(c => c.taskId === t.id)
    if (t.deletedAt || isCompletedTodo) setView('archive')
    else if (t.kind === 'note') setView('notes')
    else setView('todo')
    setPendingSelectId(it.id)
    close()
  }

  const placeholder = scope === 'notes' ? 'search notes…' : 'search tasks…'

  return (
    <div
      className="fixed inset-0 z-30 flex items-start justify-center pt-24"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={close}
    >
      <div
        className="fade-in w-[560px] max-w-[90%] rounded-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}
      >
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setCursor(0) }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { e.preventDefault(); close(); return }
              if (e.key === 'Enter') {
                e.preventDefault()
                const it = filtered[cursor]
                if (it) pick(it)
                return
              }
              if (e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'n')) {
                e.preventDefault()
                setCursor((c) => Math.min(filtered.length - 1, c + 1))
                return
              }
              if (e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'p')) {
                e.preventDefault()
                setCursor((c) => Math.max(0, c - 1))
                return
              }
            }}
            placeholder={placeholder}
            className="w-full text-base bg-transparent outline-none"
            style={{ color: 'var(--text)' }}
          />
        </div>
        <ul className="max-h-[360px] overflow-y-auto py-1">
          {filtered.length === 0 && (
            <li className="px-4 py-3 font-mono text-[11px] uppercase" style={{ color: 'var(--muted-2)' }}>
              no matches
            </li>
          )}
          {filtered.map((it, i) => (
            <li
              key={it.id}
              onClick={() => pick(it)}
              onMouseEnter={() => setCursor(i)}
              className="px-4 py-2 flex items-center gap-3 cursor-default"
              style={{
                background: i === cursor ? 'var(--bg-3)' : 'transparent',
                color: 'var(--text)'
              }}
            >
              <span className="flex-1 truncate">{it.label}</span>
              {it.hint && (
                <span className="font-mono text-[10px] uppercase" style={{ color: 'var(--muted)' }}>{it.hint}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
