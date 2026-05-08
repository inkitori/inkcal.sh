import { createContext, useContext } from 'react'
import { useStore } from './store'

export type PaneId = 'primary' | 'secondary'

const PaneContext = createContext<PaneId | null>(null)

export const PaneProvider = PaneContext.Provider

/**
 * Returns whether the calling component is rendered inside the currently
 * focused pane. When the app is not in split-pane mode (no PaneProvider
 * ancestor), defaults to true so existing single-view behavior is unaffected.
 */
export function usePaneActive(): boolean {
  const paneId = useContext(PaneContext)
  const focusedPane = useStore(s => s.focusedPane)
  if (paneId === null) return true // no provider → not in split mode
  return paneId === focusedPane
}

export function usePaneId(): PaneId | null {
  return useContext(PaneContext)
}
