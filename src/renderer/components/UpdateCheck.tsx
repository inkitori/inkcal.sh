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

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={close}
    >
      <div
        className="fade-in rounded-md px-4 py-3 font-mono text-[12px]"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-2)',
          border: '1px solid var(--border)',
          color: 'var(--text)',
          minWidth: 240,
          textAlign: 'center'
        }}
      >
        {statusLine(updater)}
      </div>
    </div>
  )
}
