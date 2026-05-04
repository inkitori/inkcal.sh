import { useEffect, useState } from 'react'
import { useStore } from '@/lib/store'
import type { AboutInfo, UpdaterState } from '@/../shared/types'

function statusLine(s: UpdaterState | null): string {
  if (!s) return 'loading…'
  switch (s.status) {
    case 'idle':
      return 'idle'
    case 'checking':
      return 'checking for updates…'
    case 'up-to-date':
      return `up to date (v${s.currentVersion})`
    case 'available':
      return `update available: v${s.latestVersion} — downloading…`
    case 'downloading':
      return `downloading v${s.latestVersion ?? ''} ${s.downloadPercent ?? 0}%`
    case 'downloaded':
      return `v${s.latestVersion} ready — restart to install`
    case 'error':
      return `error: ${s.error ?? 'unknown'}`
    default:
      return ''
  }
}

export default function About() {
  const open = useStore(s => s.aboutOpen)
  const close = useStore(s => s.closeAbout)
  const [info, setInfo] = useState<AboutInfo | null>(null)
  const [updater, setUpdater] = useState<UpdaterState | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    window.inkcal.about().then(setInfo).catch(() => {})
    window.inkcal.updaterState().then(setUpdater).catch(() => {})
    const unsub = window.inkcal.onUpdaterState(setUpdater)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => {
      unsub?.()
      window.removeEventListener('keydown', onKey)
    }
  }, [open, close])

  if (!open) return null

  async function check() {
    setBusy(true)
    try {
      const next = await window.inkcal.checkForUpdates()
      setUpdater(next)
    } finally {
      setBusy(false)
    }
  }

  function openRepo() {
    if (info?.repo) window.inkcal.openExternal(info.repo)
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={close}
    >
      <div
        className="fade-in w-[420px] max-w-[90%] rounded-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}
      >
        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="text-base font-semibold" style={{ color: 'var(--text)' }}>
            {info?.productName ?? 'inkcal.sh'}
          </div>
          <div className="font-mono text-[11px] uppercase mt-1" style={{ color: 'var(--muted-2)' }}>
            v{info?.version ?? '…'}
          </div>
        </div>

        <div className="px-5 py-4 text-sm space-y-1" style={{ color: 'var(--text)' }}>
          <div>
            Made with <span style={{ color: 'var(--accent)' }}>♥</span> by {info?.author ?? '—'}
          </div>
          <div>
            <button
              onClick={openRepo}
              className="underline cursor-pointer"
              style={{ color: 'var(--accent)' }}
            >
              {info?.repo?.replace(/^https?:\/\//, '') ?? '—'}
            </button>
          </div>
        </div>

        {updater && updater.status !== 'unsupported' && (
          <div className="px-5 py-3" style={{ borderTop: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between gap-3">
              <div className="font-mono text-[11px]" style={{ color: 'var(--muted)' }}>
                {statusLine(updater)}
              </div>
              <button
                onClick={check}
                disabled={busy}
                className="font-mono text-[11px] uppercase px-2 py-1 rounded"
                style={{
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                  opacity: busy ? 0.4 : 1,
                  cursor: busy ? 'default' : 'pointer'
                }}
              >
                {busy ? 'checking…' : 'check'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

