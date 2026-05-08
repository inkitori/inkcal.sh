import { useCallback, useEffect, useState } from 'react'
import Header from './components/Header'
import Capture from './components/Capture'
import Edit from './components/Edit'
import Palette from './components/Palette'
import Search from './components/Search'
import About from './components/About'
import UpdateCheck from './components/UpdateCheck'
import Settings from './components/Settings'
import NoteFocus from './components/NoteFocus'
import TodoView from './views/TodoView'
import CalendarView from './views/CalendarView'
import NotesView from './views/NotesView'
import { useStore } from './lib/store'
import { applyTheme } from './lib/theme'
import { useGlobalKeymap } from './lib/keymap'
import { PaneProvider, type PaneId } from './lib/PaneContext'
import type { Theme } from '../shared/types'

const SPLIT_BREAKPOINT = 1100

function renderView(name: 'todo' | 'calendar' | 'notes') {
  if (name === 'todo') return <TodoView />
  if (name === 'calendar') return <CalendarView />
  return <NotesView />
}

export default function App() {
  const ready = useStore(s => s.ready)
  const init = useStore(s => s.init)
  const view = useStore(s => s.view)
  const settings = useStore(s => s.settings)
  const focusedPane = useStore(s => s.focusedPane)
  const setFocusedPane = useStore(s => s.setFocusedPane)

  const [themes, setThemes] = useState<Theme[]>([])
  const [wideEnough, setWideEnough] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth >= SPLIT_BREAKPOINT
  )

  useGlobalKeymap()

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${SPLIT_BREAKPOINT}px)`)
    const onChange = (e: MediaQueryListEvent) => setWideEnough(e.matches)
    setWideEnough(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

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

  // chromium swallows cmd+p (print) before the renderer keymap sees it; main forwards via ipc
  useEffect(() => {
    const unsub = window.inkcal.onOpenPalette(() => useStore.getState().openPalette())
    return () => { unsub() }
  }, [])

  if (!ready) {
    return (
      <div className="h-full flex items-center justify-center font-mono text-[11px] uppercase"
           style={{ color: 'var(--muted-2)' }}>
        loading…
      </div>
    )
  }

  const splitActive = settings.splitEnabled && !!settings.splitSecondary && wideEnough && settings.splitSecondary !== view
  const ratio = Math.max(0.2, Math.min(0.8, settings.splitRatio || 0.5))

  return (
    <div className="h-full flex flex-col">
      <Header />
      <main className="flex-1 overflow-hidden">
        {splitActive && settings.splitSecondary ? (
          <div className="h-full flex">
            <Pane id="primary" focused={focusedPane === 'primary'} onFocus={() => setFocusedPane('primary')} flex={ratio}>
              {renderView(view)}
            </Pane>
            <Pane id="secondary" focused={focusedPane === 'secondary'} onFocus={() => setFocusedPane('secondary')} flex={1 - ratio}>
              {renderView(settings.splitSecondary)}
            </Pane>
          </div>
        ) : (
          renderView(view)
        )}
      </main>
      <Capture />
      <Edit />
      <Palette themes={themes} reloadThemes={reloadThemes} />
      <Search />
      <About />
      <UpdateCheck />
      <Settings />
      <NoteFocus />
    </div>
  )
}

function Pane({ id, focused, onFocus, flex, children }: {
  id: PaneId
  focused: boolean
  onFocus: () => void
  flex: number
  children: React.ReactNode
}) {
  return (
    <div
      onMouseDown={onFocus}
      className="h-full overflow-hidden relative"
      style={{
        flex: `${flex} 1 0`,
        minWidth: 0,
        borderRight: id === 'primary' ? '1px solid var(--border)' : undefined
      }}
    >
      <PaneProvider value={id}>{children}</PaneProvider>
      {focused && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            outline: '2px solid var(--accent)',
            outlineOffset: '-2px',
            zIndex: 50
          }}
        />
      )}
    </div>
  )
}
