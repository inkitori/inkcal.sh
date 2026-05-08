import { useEffect, useMemo, useRef, useState } from 'react'
import Fuse from 'fuse.js'
import { useStore } from '@/lib/store'
import { applyTheme } from '@/lib/theme'
import type { Theme } from '@/../shared/types'

interface Item {
  id: string
  label: string
  hint?: string
  type: 'view' | 'command' | 'task'
  run: () => void | Promise<void>
}

interface Props {
  themes: Theme[]
  reloadThemes: () => Promise<Theme[]>
}

export default function Palette({ themes, reloadThemes }: Props) {
  const open = useStore(s => s.paletteOpen)
  const close = useStore(s => s.closePalette)
  const setView = useStore(s => s.setView)
  const setSettings = useStore(s => s.setSettings)
  const settings = useStore(s => s.settings)
  const tasks = useStore(s => s.tasks)
  const openAbout = useStore(s => s.openAbout)
  const openUpdateCheck = useStore(s => s.openUpdateCheck)
  const openSettings = useStore(s => s.openSettings)
  const inputRef = useRef<HTMLInputElement>(null)
  const [q, setQ] = useState('')
  const [cursor, setCursor] = useState(0)

  useEffect(() => {
    if (open) {
      setQ('')
      setCursor(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  const items: Item[] = useMemo(() => {
    const out: Item[] = []
    out.push({ id: 'view:todo', label: 'go to todo', hint: '⌘1', type: 'view', run: () => setView('todo') })
    out.push({ id: 'view:cal', label: 'go to calendar', hint: '⌘2', type: 'view', run: () => setView('calendar') })
    out.push({ id: 'view:notes', label: 'go to notes', hint: '⌘3', type: 'view', run: () => setView('notes') })

    for (const t of themes) {
      out.push({
        id: `theme:${t.name}`,
        label: `theme ${t.name}`,
        hint: settings.activeTheme === t.name ? 'active' : 'command',
        type: 'command',
        run: async () => {
          applyTheme(t)
          await setSettings({ activeTheme: t.name, transparency: !!t.transparency?.enabled })
          // ensure settings hit disk before any potential window recreate
          await useStore.getState().saveNow()
          if (window.inkcal?.applyTransparency) {
            await window.inkcal.applyTransparency({
              transparency: !!t.transparency?.enabled,
              vibrancy: t.transparency?.vibrancy
            })
          }
        }
      })
    }

    out.push({
      id: 'cmd:export',
      label: 'export data',
      hint: 'command',
      type: 'command',
      run: async () => { await window.inkcal.exportData() }
    })
    out.push({
      id: 'cmd:import',
      label: 'import data',
      hint: 'command',
      type: 'command',
      run: async () => {
        const r = await window.inkcal.importData()
        if (r.ok && r.data) {
          const s = useStore.getState()
          await s.setSettings(r.data.settings)
          useStore.setState({
            tasks: r.data.tasks,
            completions: r.data.completions,
            settings: r.data.settings
          })
        }
      }
    })
    out.push({
      id: 'cmd:openThemes',
      label: 'open themes folder',
      hint: 'command',
      type: 'command',
      run: () => { window.inkcal.openThemesDir() }
    })
    out.push({
      id: 'cmd:reloadThemes',
      label: 'reload themes',
      hint: 'command',
      type: 'command',
      run: async () => { await reloadThemes() }
    })
    out.push({
      id: 'cmd:revealData',
      label: 'reveal data.json',
      hint: 'command',
      type: 'command',
      run: () => { window.inkcal.revealData() }
    })
    out.push({
      id: 'cmd:settings',
      label: 'open settings',
      hint: '⌘,',
      type: 'command',
      run: () => { openSettings() }
    })
    out.push({
      id: 'cmd:toggleSplit',
      label: settings.splitEnabled ? 'disable split view' : 'enable split view',
      hint: '⌘\\',
      type: 'command',
      run: async () => {
        const cur = settings.splitEnabled
        const patch: Parameters<typeof setSettings>[0] = { splitEnabled: !cur }
        if (!cur && !settings.splitSecondary) {
          const others: ('todo' | 'calendar' | 'notes')[] = ['todo', 'calendar', 'notes']
          const main = useStore.getState().view
          patch.splitSecondary = others.find(o => o !== main) ?? 'notes'
        }
        await setSettings(patch)
      }
    })
    out.push({
      id: 'cmd:swapPanes',
      label: 'swap panes',
      hint: 'command',
      type: 'command',
      run: async () => {
        if (!settings.splitEnabled || !settings.splitSecondary) return
        const main = useStore.getState().view
        const sec = settings.splitSecondary
        setView(sec)
        await setSettings({ splitSecondary: main })
      }
    })
    out.push({
      id: 'cmd:swapPaneFocus',
      label: 'swap pane focus',
      hint: '⌃W',
      type: 'command',
      run: () => {
        if (!settings.splitEnabled || !settings.splitSecondary) return
        const cur = useStore.getState().focusedPane
        useStore.getState().setFocusedPane(cur === 'primary' ? 'secondary' : 'primary')
      }
    })
    for (const v of ['todo', 'calendar', 'notes'] as const) {
      out.push({
        id: `cmd:setSecondary:${v}`,
        label: `secondary pane: ${v}`,
        hint: settings.splitSecondary === v ? 'active' : 'command',
        type: 'command',
        run: async () => {
          await setSettings({ splitSecondary: v, splitEnabled: true })
        }
      })
    }
    out.push({
      id: 'cmd:about',
      label: 'about',
      hint: 'command',
      type: 'command',
      run: () => { openAbout() }
    })
    out.push({
      id: 'cmd:checkUpdates',
      label: 'check for updates',
      hint: 'command',
      type: 'command',
      run: () => { openUpdateCheck() }
    })
    out.push({
      id: 'cmd:toggleTransparency',
      label: settings.transparency ? 'disable transparency' : 'enable transparency',
      hint: 'command',
      type: 'command',
      run: async () => {
        const t = themes.find(x => x.name === settings.activeTheme)
        const next = !settings.transparency
        await setSettings({ transparency: next })
        await useStore.getState().saveNow()
        if (t) {
          const alpha = next ? (t.transparency?.alpha ?? 0.85) : 1
          document.documentElement.style.setProperty('--window-alpha', String(alpha))
          document.body.classList.toggle('transparent', next)
        }
        await window.inkcal.applyTransparency({
          transparency: next,
          vibrancy: t?.transparency?.vibrancy
        })
      }
    })

    for (const t of tasks) {
      const label = t.title ?? t.body ?? '(untitled)'
      out.push({
        id: `task:${t.id}`,
        label,
        hint: t.kind,
        type: 'task',
        run: () => {
          if (t.kind === 'note') setView('notes')
          else if (t.kind === 'recurring') setView('calendar')
          else setView('todo')
        }
      })
    }

    return out
  }, [themes, tasks, settings.activeTheme, settings.transparency, settings.splitEnabled, settings.splitSecondary])

  const filtered = useMemo(() => {
    if (!q) return items.slice(0, 10)
    const fuse = new Fuse(items, { keys: ['label', 'hint'], threshold: 0.4 })
    return fuse.search(q).slice(0, 10).map(r => r.item)
  }, [q, items])

  if (!open) return null

  function run(i: Item) {
    Promise.resolve(i.run()).then(() => close())
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-start justify-center pt-24"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={close}
    >
      <div
        className="fade-in w-[560px] max-w-[90%] rounded-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}
      >
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setCursor(0) }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { e.preventDefault(); close(); return }
              if (e.key === 'Enter') {
                e.preventDefault()
                const it = filtered[cursor]
                if (it) run(it)
                return
              }
              if (e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'n')) {
                e.preventDefault()
                setCursor((c) => Math.min(filtered.length - 1, c + 1))
                return
              }
              if (e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'p')) {
                e.preventDefault()
                setCursor((c) => Math.max(0, c - 1))
                return
              }
            }}
            placeholder="type a command, theme, or task…"
            className="w-full text-base"
            style={{ color: 'var(--text)' }}
          />
        </div>
        <ul className="max-h-[360px] overflow-y-auto py-1">
          {filtered.length === 0 && (
            <li className="px-4 py-3 font-mono text-[11px] uppercase" style={{ color: 'var(--muted-2)' }}>
              no matches
            </li>
          )}
          {filtered.map((it, i) => (
            <li
              key={it.id}
              onClick={() => run(it)}
              onMouseEnter={() => setCursor(i)}
              className="px-4 py-2 flex items-center gap-3 cursor-default"
              style={{
                background: i === cursor ? 'var(--bg-3)' : 'transparent',
                color: 'var(--text)'
              }}
            >
              <span className="flex-1 truncate">{it.label}</span>
              {it.hint && (
                <span className="font-mono text-[10px] uppercase" style={{ color: 'var(--muted)' }}>{it.hint}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
