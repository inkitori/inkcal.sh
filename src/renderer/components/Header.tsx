import { useEffect, useState } from 'react'
import { dayProgressPct, fmtHeaderDate } from '@/lib/date'
import { formatClock } from '@/../shared/time'
import { useStore } from '@/lib/store'

export default function Header() {
  const view = useStore(s => s.view)
  const setView = useStore(s => s.setView)
  const clockFormat = useStore(s => s.settings.clockFormat)

  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  const pct = dayProgressPct(now)

  return (
    <header className="drag relative" style={{ borderBottom: '1px solid var(--border)' }}>
      <div className="absolute left-0 top-0 right-0 h-[2px]" style={{ background: 'var(--bg-2)' }}>
        <div className="h-full transition-all duration-1000" style={{ width: `${pct}%`, background: 'var(--accent)' }} />
      </div>

      <div className="flex items-center gap-6 pl-[88px] pr-4 py-3">
        <h1 className="font-display text-2xl tracking-tight" style={{ color: 'var(--text)' }}>
          inkcal
        </h1>

        <div className="font-mono text-[11px] uppercase flex items-center gap-2" style={{ color: 'var(--muted)' }}>
          <span>{fmtHeaderDate(now)}</span>
          <span style={{ color: 'var(--muted-2)' }}>·</span>
          <span>{formatClock(now, clockFormat)}</span>
          <span style={{ color: 'var(--muted-2)' }}>·</span>
          <span style={{ color: 'var(--accent)' }}>{Math.round(pct)}%</span>
        </div>

        <nav className="no-drag flex items-center gap-1 ml-auto font-mono text-[11px] uppercase">
          {(['todo','calendar','notes','archive'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="px-2 py-1 rounded transition-colors"
              style={{
                color: view === v ? 'var(--accent)' : 'var(--muted)',
                background: view === v ? 'var(--accent-soft)' : 'transparent'
              }}
            >
              {v}
            </button>
          ))}
        </nav>
      </div>
    </header>
  )
}
