import { useEffect } from 'react'
import { useStore } from './store'
import { usePaneActive } from './PaneContext'

interface ListKeyHandlers {
  onMove?: (delta: number) => void
  onTop?: () => void
  onBottom?: () => void
  onToggle?: () => void
  onDelete?: () => void
  onOpenBelow?: () => void
  onEdit?: () => void
  onRename?: () => void
  onLeft?: () => void
  onRight?: () => void
  onEscape?: () => void
  /** zz / zt / zb: reposition the selected row in the scroll viewport. */
  onCenterView?: () => void
  onTopView?: () => void
  onBottomView?: () => void
  onHalfPageDown?: () => void
  onHalfPageUp?: () => void
  /** `f`: focus / fullscreen the selected item. */
  onFocusKey?: () => void
}

let lastG = 0
let lastD = 0
let pendingZ = 0

export function isInTextInput(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return true
  if (target.isContentEditable) return true
  // CodeMirror dispatches some keys with `e.target` set to a wrapping host whose
  // `isContentEditable` is false, even though the inner `.cm-content` is editable.
  if (target.closest('.cm-editor')) return true
  return false
}

/**
 * Wires global keys for the current view's list. Caller passes handlers; we
 * suppress when typing in an input. `paletteOpen`/`captureOpen` short-circuit.
 */
export function useListKeymap(handlers: ListKeyHandlers): void {
  const { paletteOpen, captureOpen, editOpen, searchOpen, archiveOpen, settingsOpen, noteFocusId } = useStore(s => ({
    paletteOpen: s.paletteOpen,
    captureOpen: s.captureOpen,
    editOpen: s.editOpen,
    searchOpen: s.searchOpen,
    archiveOpen: s.archiveOpen,
    settingsOpen: s.settingsOpen,
    noteFocusId: s.noteFocusId
  }))
  const paneActive = usePaneActive()
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!paneActive) return
      if (paletteOpen || captureOpen || editOpen || searchOpen || archiveOpen || settingsOpen || noteFocusId) return
      if (isInTextInput(e.target)) return

      const k = e.key

      // ctrl-d / ctrl-u: half-page jumps. Allowed despite ctrl since they're
      // a vim convention. The rest of the keymap stays meta-free.
      if (e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        if (k === 'd') { e.preventDefault(); handlers.onHalfPageDown?.(); return }
        if (k === 'u') { e.preventDefault(); handlers.onHalfPageUp?.(); return }
      }

      if (e.metaKey || e.ctrlKey) return

      if (pendingZ && Date.now() - pendingZ < 400) {
        pendingZ = 0
        if (k === 'z') { e.preventDefault(); handlers.onCenterView?.(); return }
        if (k === 't') { e.preventDefault(); handlers.onTopView?.(); return }
        if (k === 'b') { e.preventDefault(); handlers.onBottomView?.(); return }
        // fall through: treat as a normal keypress
      }
      if (k === 'z') { pendingZ = Date.now(); return }

      if (k === 'j' || k === 'ArrowDown') {
        e.preventDefault(); handlers.onMove?.(1); return
      }
      if (k === 'k' || k === 'ArrowUp') {
        e.preventDefault(); handlers.onMove?.(-1); return
      }
      if (k === 'h' || k === 'ArrowLeft') { handlers.onLeft?.(); return }
      if (k === 'l' || k === 'ArrowRight') { handlers.onRight?.(); return }
      if (k === ' ' || k === 'x') { e.preventDefault(); handlers.onToggle?.(); return }
      if (k === 'o') { e.preventDefault(); handlers.onOpenBelow?.(); return }
      if (k === 'e') { e.preventDefault(); handlers.onEdit?.(); return }
      if (k === 'i') { e.preventDefault(); handlers.onRename?.(); return }
      if (k === 'f') { e.preventDefault(); handlers.onFocusKey?.(); return }
      if (k === 'G') { e.preventDefault(); handlers.onBottom?.(); return }
      if (k === 'g') {
        const now = Date.now()
        if (now - lastG < 400) {
          e.preventDefault(); handlers.onTop?.()
          lastG = 0
        } else {
          lastG = now
        }
        return
      }
      if (k === 'd') {
        const now = Date.now()
        if (now - lastD < 400) {
          e.preventDefault(); handlers.onDelete?.()
          lastD = 0
        } else {
          lastD = now
        }
        return
      }
      if (k === 'Backspace' || k === 'Delete') {
        e.preventDefault(); handlers.onDelete?.(); return
      }
      if (k === 'Escape') { handlers.onEscape?.(); return }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handlers, paletteOpen, captureOpen, editOpen, searchOpen, settingsOpen, noteFocusId, paneActive])
}

export function useGlobalKeymap(): void {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey
      const s = useStore.getState()

      // u → undo, ctrl-r → redo. Both also fire while archive is open so
      // archive actions (restore / perma-delete) can be reverted in place.
      // Suppressed inside text inputs and inside text-input-style modals.
      const undoSuppressed = s.paletteOpen || s.captureOpen || s.editOpen ||
        s.searchOpen || s.settingsOpen || s.noteFocusId || isInTextInput(e.target)
      if (e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && e.key === 'r' && !undoSuppressed) {
        e.preventDefault()
        s.redo()
        return
      }
      if (!meta && !e.altKey && !e.shiftKey && e.key === 'u' && !undoSuppressed) {
        e.preventDefault()
        s.undo()
        return
      }

      if (meta && e.key === 'k') {
        e.preventDefault()
        s.openCapture()
        return
      }
      if (meta && e.key === 'p') {
        e.preventDefault()
        s.openPalette()
        return
      }
      if (meta && e.key === ',') {
        e.preventDefault()
        s.openSettings()
        return
      }
      if (meta && e.key === '\\') {
        e.preventDefault()
        const cur = s.settings.splitEnabled
        const patch: { splitEnabled: boolean; splitSecondary?: 'todo' | 'calendar' | 'notes' } = { splitEnabled: !cur }
        if (!cur && !s.settings.splitSecondary) {
          const others: ('todo' | 'calendar' | 'notes')[] = ['todo', 'calendar', 'notes']
          patch.splitSecondary = others.find(o => o !== s.view) ?? 'notes'
        }
        s.setSettings(patch)
        return
      }
      if (e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && e.key === 'w') {
        e.preventDefault()
        if (s.settings.splitEnabled && s.settings.splitSecondary) {
          s.setFocusedPane(s.focusedPane === 'primary' ? 'secondary' : 'primary')
        }
        return
      }
      if (meta && e.key === '1') { e.preventDefault(); s.setView('todo'); return }
      if (meta && e.key === '2') { e.preventDefault(); s.setView('calendar'); return }
      if (meta && e.key === '3') { e.preventDefault(); s.setView('notes'); return }

      if (!meta && !isInTextInput(e.target) && !s.paletteOpen && !s.captureOpen && !s.searchOpen && !s.archiveOpen && !s.editOpen && !s.settingsOpen && !s.noteFocusId) {
        if (e.key === '/') { e.preventDefault(); s.openSearch(); return }
        if (e.key === 'A') { e.preventDefault(); s.openArchive(); return }
        if (e.key === 'n' && s.view === 'notes') {
          e.preventDefault()
          s.openCapture('note: ')
        }
      }

      if (e.key === 'Escape') {
        if (s.paletteOpen) s.closePalette()
        else if (s.captureOpen) s.closeCapture()
        else if (s.editOpen) s.closeEdit()
        else if (s.searchOpen) s.closeSearch()
        else if (s.archiveOpen) s.closeArchive()
        else if (s.settingsOpen) s.closeSettings()
        else if (s.noteFocusId) s.closeNoteFocus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
