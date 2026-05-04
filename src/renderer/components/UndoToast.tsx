import { useEffect, useState } from 'react'
import { useStore } from '@/lib/store'

export default function UndoToast() {
  const undo = useStore(s => s.undo)
  const restore = useStore(s => s.restoreUndo)
  const clear = useStore(s => s.clearUndo)
  const [, tick] = useState(0)

  useEffect(() => {
    if (!undo) return
    const t = setInterval(() => tick(x => x + 1), 200)
    const timeout = setTimeout(() => clear(), undo.expiresAt - Date.now())
    return () => { clearInterval(t); clearTimeout(timeout) }
  }, [undo, clear])

  if (!undo) return null

  const remaining = Math.max(0, Math.ceil((undo.expiresAt - Date.now()) / 1000))

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 fade-in rounded-md px-3 py-2 flex items-center gap-3 font-mono text-[11px]"
      style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--muted)' }}
    >
      <span>deleted "{undo.task.title ?? undo.task.body ?? '...'}"</span>
      <button onClick={restore} style={{ color: 'var(--accent)' }}>u undo</button>
      <span style={{ color: 'var(--muted-2)' }}>{remaining}s</span>
    </div>
  )
}
