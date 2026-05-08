import { createContext, useContext } from 'react'
import { useStore } from './store'

export type PaneId = 'primary' | 'secondary'

const PaneContext = createContext<PaneId | null>(null)

export const PaneProvider = PaneContext.Provider

/**
 * Returns whether the calling component is rendered inside the currently
 * focused pane. Outside a PaneProvider (single-view mode), always true.
 */
export function usePaneActive(): boolean {
  const paneId = useContext(PaneContext)
  const focusedPane = useStore(s => s.focusedPane)
  if (paneId === null) return true
  return paneId === focusedPane
}
