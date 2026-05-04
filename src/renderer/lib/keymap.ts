import { useEffect } from 'react'
import { useStore } from './store'

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
}

let lastG = 0
let lastD = 0

export function isInTextInput(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return true
  if (target.isContentEditable) return true
  return false
}

/**
 * Wires global keys for the current view's list. Caller passes handlers; we
 * suppress when typing in an input. `paletteOpen`/`captureOpen` short-circuit.
 */
export function useListKeymap(handlers: ListKeyHandlers): void {
  const { paletteOpen, captureOpen, editOpen } = useStore(s => ({
    paletteOpen: s.paletteOpen,
    captureOpen: s.captureOpen,
    editOpen: s.editOpen
  }))
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (paletteOpen || captureOpen || editOpen) return
      if (isInTextInput(e.target)) return
      if (e.metaKey || e.ctrlKey) return

      const k = e.key

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
  }, [handlers, paletteOpen, captureOpen, editOpen])
}

/** Global keymap for app-level shortcuts: cmd+1/2/3, cmd+k, cmd+p */
export function useGlobalKeymap(): void {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey
      const s = useStore.getState()

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
      if (meta && e.key === '1') { e.preventDefault(); s.setView('todo'); return }
      if (meta && e.key === '2') { e.preventDefault(); s.setView('calendar'); return }
      if (meta && e.key === '3') { e.preventDefault(); s.setView('notes'); return }

      // unprefixed `/` opens capture, `n` opens capture pre-filled with note:
      if (!meta && !isInTextInput(e.target) && !s.paletteOpen && !s.captureOpen) {
        if (e.key === '/') { e.preventDefault(); s.openCapture(); return }
        if (e.key === 'n') {
          // 'n' inside notes view = new note; we handle that view-locally too.
          // Letting it propagate is fine; this branch handles global "from anywhere → new note":
          // we only do that if user is in notes view, otherwise let view handle.
          if (s.view === 'notes') {
            e.preventDefault()
            s.openCapture('note: ')
          }
        }
        if (e.key === 'u' && s.undoStack.length > 0) {
          e.preventDefault()
          s.restoreUndo()
        }
      }

      if (e.key === 'Escape') {
        if (s.paletteOpen) s.closePalette()
        else if (s.captureOpen) s.closeCapture()
        else if (s.editOpen) s.closeEdit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
