import { useStore } from '@/lib/store'

export default function StatusLine() {
  const status = useStore(s => s.status)
  if (!status) return null
  return (
    <div
      className="pointer-events-none fixed bottom-2 left-3 z-40 fade-in font-mono text-[11px] uppercase tracking-wider px-2 py-1 rounded-sm"
      style={{
        background: 'var(--bg-2)',
        color: 'var(--muted)',
        border: '1px solid var(--border)'
      }}
    >
      {status.text}
    </div>
  )
}
