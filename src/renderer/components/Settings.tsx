import { useEffect, useRef, useState } from 'react'
import { useStore } from '@/lib/store'
import type { Settings as S } from '@/../shared/types'

export default function Settings() {
  const open = useStore(s => s.settingsOpen)
  const close = useStore(s => s.closeSettings)
  const settings = useStore(s => s.settings)
  const setSettings = useStore(s => s.setSettings)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-30 flex items-start justify-center pt-16"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={close}
    >
      <div
        className="fade-in w-[560px] max-w-[90%] rounded-md"
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}
      >
        <div className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest"
             style={{ borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>
          settings
        </div>

        <div className="px-4 py-3 flex flex-col gap-4 max-h-[60vh] overflow-y-auto">
          <ToggleField
            label="vim mode"
            hint="enable vim keybindings inside the note editor"
            checked={settings.vimEnabled}
            onChange={(v) => setSettings({ vimEnabled: v })}
          />

          <ToggleField
            label="note preview in focus"
            hint="show a live markdown preview alongside the editor in note focus mode (f)"
            checked={settings.notePreviewInFocus}
            onChange={(v) => setSettings({ notePreviewInFocus: v })}
          />

          <RadioField
            label="clock"
            value={settings.clockFormat}
            options={[
              { value: '12h', label: 'am/pm' },
              { value: '24h', label: '24h' }
            ]}
            onChange={(v) => setSettings({ clockFormat: v as S['clockFormat'] })}
          />

          <ToggleField
            label="notifications"
            hint="remind you for todos with a time and recurring tasks. dock icon shows overdue count."
            checked={settings.notificationsEnabled}
            onChange={(v) => setSettings({ notificationsEnabled: v })}
          />

          {settings.notificationsEnabled && import.meta.env.DEV && (
            <ActionField
              label="test notification"
              hint="send one now to verify (and trigger the macOS permission prompt)"
              buttonLabel="send"
              onClick={() => window.inkcal.testNotification()}
            />
          )}

          <HotkeyField
            label="global hotkey"
            value={settings.globalHotkey}
            onChange={(v) => setSettings({ globalHotkey: v })}
          />

          <RadioField
            label="default view"
            value={settings.defaultView}
            options={[
              { value: 'todo', label: 'todo' },
              { value: 'calendar', label: 'calendar' },
              { value: 'notes', label: 'notes' },
              { value: 'archive', label: 'archive' }
            ]}
            onChange={(v) => setSettings({ defaultView: v as S['defaultView'] })}
          />

          <ToggleField
            label="transparency"
            hint="vibrant window background (theme-dependent)"
            checked={settings.transparency}
            onChange={(v) => setSettings({ transparency: v })}
          />

          <RadioField
            label="notes width"
            value={settings.notesMaxWidth}
            options={[
              { value: 'narrow', label: 'narrow' },
              { value: 'medium', label: 'medium' },
              { value: 'wide', label: 'wide' },
              { value: 'full', label: 'full' }
            ]}
            onChange={(v) => setSettings({ notesMaxWidth: v as S['notesMaxWidth'] })}
          />

          <ToggleField
            label="split view"
            hint="show two views side-by-side on wide screens (≥1100px)"
            checked={settings.splitEnabled}
            onChange={(v) => {
              const patch: Partial<S> = { splitEnabled: v }
              if (v && !settings.splitSecondary) {
                const others: S['splitSecondary'][] = ['todo', 'calendar', 'notes']
                const main = useStore.getState().view
                patch.splitSecondary = (others.find(o => o !== main) ?? 'notes') as S['splitSecondary']
              }
              setSettings(patch)
            }}
          />

          {settings.splitEnabled && (
            <RadioField
              label="secondary pane"
              value={settings.splitSecondary ?? 'notes'}
              options={[
                { value: 'todo', label: 'todo' },
                { value: 'calendar', label: 'calendar' },
                { value: 'notes', label: 'notes' }
              ]}
              onChange={(v) => setSettings({ splitSecondary: v as S['splitSecondary'] })}
            />
          )}
        </div>

        <div className="px-4 py-2 flex items-center gap-3 font-mono text-[10px] uppercase"
             style={{ borderTop: '1px solid var(--border)', color: 'var(--muted)' }}>
          <span>esc close</span>
        </div>
      </div>
    </div>
  )
}

function ToggleField({ label, hint, checked, onChange }: {
  label: string
  hint?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1">
        <div className="text-[13px]" style={{ color: 'var(--text)' }}>{label}</div>
        {hint && (
          <div className="font-mono text-[10px] mt-0.5" style={{ color: 'var(--muted-2)' }}>{hint}</div>
        )}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className="rounded-sm px-2 py-1 font-mono text-[10px] uppercase"
        style={{
          background: checked ? 'var(--accent-soft)' : 'transparent',
          color: checked ? 'var(--accent)' : 'var(--muted)',
          border: `1px solid ${checked ? 'var(--accent)' : 'var(--border)'}`
        }}
      >
        {checked ? 'on' : 'off'}
      </button>
    </div>
  )
}

function RadioField({ label, value, options, onChange }: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="text-[13px]" style={{ color: 'var(--text)' }}>{label}</div>
      <div className="flex gap-1">
        {options.map(o => {
          const active = o.value === value
          return (
            <button
              key={o.value}
              onClick={() => onChange(o.value)}
              className="rounded-sm px-2 py-1 font-mono text-[10px] uppercase"
              style={{
                background: active ? 'var(--accent-soft)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--muted)',
                border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`
              }}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ActionField({ label, hint, buttonLabel, onClick }: {
  label: string
  hint?: string
  buttonLabel: string
  onClick: () => void
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1">
        <div className="text-[13px]" style={{ color: 'var(--text)' }}>{label}</div>
        {hint && (
          <div className="font-mono text-[10px] mt-0.5" style={{ color: 'var(--muted-2)' }}>{hint}</div>
        )}
      </div>
      <button
        onClick={onClick}
        className="rounded-sm px-2 py-1 font-mono text-[10px] uppercase"
        style={{
          background: 'transparent',
          color: 'var(--muted)',
          border: '1px solid var(--border)'
        }}
      >
        {buttonLabel}
      </button>
    </div>
  )
}

function HotkeyField({ label, value, onChange }: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  const [recording, setRecording] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!recording) return
    function onKey(e: KeyboardEvent) {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Escape') { setRecording(false); return }
      const parts: string[] = []
      if (e.metaKey) parts.push('Cmd')
      if (e.ctrlKey) parts.push('Ctrl')
      if (e.altKey) parts.push('Alt')
      if (e.shiftKey) parts.push('Shift')
      const k = e.key
      if (k === 'Meta' || k === 'Control' || k === 'Alt' || k === 'Shift') return
      let keyName: string
      if (k === ' ') keyName = 'Space'
      else if (k.length === 1) keyName = k.toUpperCase()
      else keyName = k
      parts.push(keyName)
      if (parts.length < 2) return
      onChange(parts.join('+'))
      setRecording(false)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [recording, onChange])

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-[13px]" style={{ color: 'var(--text)' }}>{label}</div>
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          value={recording ? 'press a chord…' : value}
          readOnly
          className="font-mono text-[11px] px-2 py-1 rounded-sm w-[180px] text-right"
          style={{
            background: 'var(--bg)',
            color: recording ? 'var(--muted)' : 'var(--text)',
            border: '1px solid var(--border)'
          }}
        />
        <button
          onClick={() => setRecording(r => !r)}
          className="rounded-sm px-2 py-1 font-mono text-[10px] uppercase"
          style={{
            background: recording ? 'var(--accent-soft)' : 'transparent',
            color: recording ? 'var(--accent)' : 'var(--muted)',
            border: `1px solid ${recording ? 'var(--accent)' : 'var(--border)'}`
          }}
        >
          {recording ? 'stop' : 'rebind'}
        </button>
      </div>
    </div>
  )
}
