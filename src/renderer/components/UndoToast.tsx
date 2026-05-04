import { useEffect, useState } from 'react'
import { useStore } from '@/lib/store'

const TOAST_MS = 5000

export default function UndoToast() {
  const undoStack = useStore(s => s.undoStack)
  const restore = useStore(s => s.restoreUndo)
  const [visibleId, setVisibleId] = useState<string | null>(null)

  const top = undoStack.length > 0 ? undoStack[undoStack.length - 1] : null

  useEffect(() => {
    if (!top) { setVisibleId(null); return }
    setVisibleId(top.id)
    const timeout = setTimeout(() => {
      setVisibleId(curr => (curr === top.id ? null : curr))
    }, TOAST_MS)
    return () => clearTimeout(timeout)
  }, [top?.id])

  if (!top || visibleId !== top.id) return null

  const more = undoStack.length - 1

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 fade-in rounded-md px-3 py-2 flex items-center gap-3 font-mono text-[11px]"
      style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--muted)' }}
    >
      <span>deleted "{top.task.title ?? top.task.body ?? '...'}"</span>
      <button onClick={restore} style={{ color: 'var(--accent)' }}>u undo</button>
      {more > 0 && <span style={{ color: 'var(--muted-2)' }}>+{more}</span>}
    </div>
  )
}
