import { contextBridge, ipcRenderer } from 'electron'
import type { AppData, Theme } from '../shared/types'

const api = {
  loadData: (): Promise<AppData> => ipcRenderer.invoke('data:load'),
  saveData: (data: AppData): Promise<boolean> => ipcRenderer.invoke('data:save', data),
  flushData: (): Promise<boolean> => ipcRenderer.invoke('data:flush'),
  exportData: (): Promise<{ ok: boolean; path?: string }> => ipcRenderer.invoke('data:export'),
  importData: (): Promise<{ ok: boolean; data?: AppData }> => ipcRenderer.invoke('data:import'),
  listThemes: (): Promise<Theme[]> => ipcRenderer.invoke('themes:list'),
  getTheme: (name: string): Promise<Theme | null> => ipcRenderer.invoke('themes:get', name),
  openThemesDir: (): Promise<string> => ipcRenderer.invoke('themes:openDir'),
  applyTransparency: (opts: { transparency: boolean; vibrancy?: string }): Promise<boolean> =>
    ipcRenderer.invoke('window:applyTransparency', opts),
  registerShortcut: (accelerator: string): Promise<boolean> =>
    ipcRenderer.invoke('shortcuts:register', accelerator),
  dataDir: (): Promise<string> => ipcRenderer.invoke('app:dataDir'),
  dataFile: (): Promise<string> => ipcRenderer.invoke('app:dataFile'),
  revealData: (): Promise<void> => ipcRenderer.invoke('app:revealData'),

  onThemesChanged: (cb: (themes: Theme[]) => void) => {
    const listener = (_e: unknown, themes: Theme[]) => cb(themes)
    ipcRenderer.on('themes:changed', listener)
    return () => ipcRenderer.removeListener('themes:changed', listener)
  }
}

export type InkcalApi = typeof api

contextBridge.exposeInMainWorld('inkcal', api)
