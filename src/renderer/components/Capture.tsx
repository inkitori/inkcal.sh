import { useEffect, useRef, useState } from 'react'
import { useStore } from '@/lib/store'
import { parseCapture } from '@/lib/parser'

export default function Capture() {
  const open = useStore(s => s.captureOpen)
  const prefill = useStore(s => s.capturePrefill)
  const close = useStore(s => s.closeCapture)
  const addTask = useStore(s => s.addTask)
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setValue(prefill || '')
      setError(null)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open, prefill])

  if (!open) return null

  function submit() {
    const result = parseCapture(value)
    if (!result) {
      setError('couldn’t parse that')
      return
    }
    addTask(result.task)
    close()
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-start justify-center pt-24"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={close}
    >
      <div
        className="fade-in w-[640px] max-w-[90%] rounded-md"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-2)',
          border: '1px solid var(--border)'
        }}
      >
        <div className="px-4 py-3">
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => { setValue(e.target.value); setError(null) }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); submit() }
              if (e.key === 'Escape') { e.preventDefault(); close() }
            }}
            placeholder="capture…  e.g. today: write report  /  mwf 10:00-11:00 lecture  /  daily 08:00 take meds"
            className="w-full text-base"
            style={{ color: 'var(--text)' }}
          />
        </div>
        <div className="px-4 py-2 flex items-center gap-3 font-mono text-[10px] uppercase"
             style={{ borderTop: '1px solid var(--border)', color: 'var(--muted)' }}>
          <span>↵ save</span>
          <span>esc cancel</span>
          {error && <span style={{ color: 'var(--danger)', textTransform: 'none' }}>{error}</span>}
        </div>
      </div>
    </div>
  )
}
