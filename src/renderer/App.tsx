import { useCallback, useEffect, useState } from 'react'
import Header from './components/Header'
import Capture from './components/Capture'
import Edit from './components/Edit'
import Palette from './components/Palette'
import UndoToast from './components/UndoToast'
import TodoView from './views/TodoView'
import CalendarView from './views/CalendarView'
import NotesView from './views/NotesView'
import { useStore } from './lib/store'
import { applyTheme } from './lib/theme'
import { useGlobalKeymap } from './lib/keymap'
import type { Theme } from '../shared/types'

export default function App() {
  const ready = useStore(s => s.ready)
  const init = useStore(s => s.init)
  const view = useStore(s => s.view)
  const settings = useStore(s => s.settings)

  const [themes, setThemes] = useState<Theme[]>([])

  useGlobalKeymap()

  const reloadThemes = useCallback(async () => {
    const list = await window.inkcal.listThemes()
    setThemes(list)
    return list
  }, [])

  useEffect(() => {
    init().catch(err => console.error('init failed', err))
  }, [init])

  useEffect(() => {
    let unsub: (() => void) | null = null
    reloadThemes().then(list => {
      const active = list.find(t => t.name === settings.activeTheme) ?? list[0]
      if (active) applyTheme(active)
    })
    unsub = window.inkcal.onThemesChanged((list) => {
      setThemes(list)
      const active = list.find(t => t.name === settings.activeTheme)
      if (active) applyTheme(active)
    })
    return () => { unsub?.() }
  }, [reloadThemes, settings.activeTheme])

  // re-register the global hotkey if user changed it
  useEffect(() => {
    if (!ready) return
    window.inkcal.registerShortcut(settings.globalHotkey)
  }, [ready, settings.globalHotkey])

  if (!ready) {
    return (
      <div className="h-full flex items-center justify-center font-mono text-[11px] uppercase"
           style={{ color: 'var(--muted-2)' }}>
        loading…
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <Header />
      <main className="flex-1 overflow-hidden">
        {view === 'todo' && <TodoView />}
        {view === 'calendar' && <CalendarView />}
        {view === 'notes' && <NotesView />}
      </main>
      <Capture />
      <Edit />
      <Palette themes={themes} reloadThemes={reloadThemes} />
      <UndoToast />
    </div>
  )
}
