import { globalShortcut } from 'electron'
import { toggleWindow } from './window'

let registered: string | null = null

export function registerGlobalHotkey(accelerator: string): boolean {
  if (registered === accelerator) return true
  if (registered) globalShortcut.unregister(registered)
  try {
    const ok = globalShortcut.register(accelerator, () => toggleWindow())
    if (ok) {
      registered = accelerator
      return true
    }
  } catch (err) {
    console.error('failed to register global hotkey', err)
  }
  return false
}

export function unregisterAll(): void {
  globalShortcut.unregisterAll()
  registered = null
}
