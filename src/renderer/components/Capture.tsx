import { useEffect, useRef, useState } from 'react'
import { useStore } from '@/lib/store'
import { parse } from '@/lib/parser'
import ScheduleInput from './ScheduleInput'

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
    const result = parse(value)
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
          <ScheduleInput
            ref={inputRef}
            value={value}
            onChange={(v) => { setValue(v); setError(null) }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); submit() }
              if (e.key === 'Escape') { e.preventDefault(); close() }
            }}
            placeholder="capture…  e.g. tomorrow write report  /  every friday at 10 yoga  /  may 6 doctor"
            inputClassName="w-full text-base bg-transparent outline-none"
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
