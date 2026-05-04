import { useEffect, useState } from 'react'
import { useStore } from '@/lib/store'
import type { UpdaterState } from '@/../shared/types'

function statusLine(s: UpdaterState | null): string {
  if (!s) return 'checking…'
  switch (s.status) {
    case 'idle':
    case 'checking':
      return 'checking for updates…'
    case 'up-to-date':
      return `up to date · v${s.currentVersion}`
    case 'available':
      return `update available · v${s.latestVersion}`
    case 'downloading':
      return `downloading v${s.latestVersion ?? ''} · ${s.downloadPercent ?? 0}%`
    case 'downloaded':
      return `v${s.latestVersion} ready · restart to install`
    case 'error':
      return `error: ${s.error ?? 'unknown'}`
    case 'unsupported':
      return 'updates only run in packaged builds'
    default:
      return ''
  }
}

export default function UpdateCheck() {
  const open = useStore(s => s.updateCheckOpen)
  const close = useStore(s => s.closeUpdateCheck)
  const [updater, setUpdater] = useState<UpdaterState | null>(null)

  useEffect(() => {
    if (!open) return
    setUpdater(null)
    window.inkcal.checkForUpdates().then(setUpdater).catch(() => {})
    const unsub = window.inkcal.onUpdaterState(setUpdater)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => {
      unsub?.()
      window.removeEventListener('keydown', onKey)
    }
  }, [open, close])

  // auto-dismiss only on terminal "nothing to do" states
  useEffect(() => {
    if (!open || !updater) return
    if (updater.status === 'up-to-date' || updater.status === 'unsupported') {
      const t = setTimeout(close, 2200)
      return () => clearTimeout(t)
    }
    return
  }, [open, updater, close])

  if (!open) return null

  const canRestart = updater?.status === 'downloaded'

  return (
    <div className="fixed top-4 right-4 z-30 pointer-events-none">
      <div
        className="fade-in rounded-md px-3 py-2 font-mono text-[12px] flex items-center gap-3 pointer-events-auto"
        style={{
          background: 'var(--bg-2)',
          border: '1px solid var(--border)',
          color: 'var(--text)',
          minWidth: 220,
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)'
        }}
      >
        <span className="flex-1">{statusLine(updater)}</span>
        {canRestart && (
          <button
            onClick={() => window.inkcal.quitAndInstall()}
            className="font-mono text-[11px] uppercase px-2 py-1 rounded cursor-pointer"
            style={{ color: 'var(--text)', border: '1px solid var(--border)' }}
          >
            restart
          </button>
        )}
        <button
          onClick={close}
          aria-label="dismiss"
          className="cursor-pointer"
          style={{ color: 'var(--muted)', lineHeight: 1 }}
        >
          ×
        </button>
      </div>
    </div>
  )
}
