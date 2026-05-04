import { contextBridge, ipcRenderer } from 'electron'
import type { AboutInfo, AppData, Theme, UpdaterState } from '../shared/types'

const api = {
  loadData: (): Promise<AppData> => ipcRenderer.invoke('data:load'),
  saveData: (data: AppData): Promise<boolean> => ipcRenderer.invoke('data:save', data),
  flushData: (): Promise<boolean> => ipcRenderer.invoke('data:flush'),
  exportData: (): Promise<{ ok: boolean; path?: string }> => ipcRenderer.invoke('data:export'),
  importData: (): Promise<{ ok: boolean; data?: AppData }> => ipcRenderer.invoke('data:import'),
  listThemes: (): Promise<Theme[]> => ipcRenderer.invoke('themes:list'),
  getTheme: (name: string): Promise<Theme | null> => ipcRenderer.invoke('themes:get', name),
  openThemesDir: (): Promise<string> => ipcRenderer.invoke('themes:openDir'),
  applyTransparency: (opts: { transparency: boolean; vibrancy?: string }): Promise<{ recreated: boolean }> =>
    ipcRenderer.invoke('window:applyTransparency', opts),
  registerShortcut: (accelerator: string): Promise<boolean> =>
    ipcRenderer.invoke('shortcuts:register', accelerator),
  dataDir: (): Promise<string> => ipcRenderer.invoke('app:dataDir'),
  dataFile: (): Promise<string> => ipcRenderer.invoke('app:dataFile'),
  revealData: (): Promise<void> => ipcRenderer.invoke('app:revealData'),
  about: (): Promise<AboutInfo> => ipcRenderer.invoke('app:about'),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('app:openExternal', url),
  updaterState: (): Promise<UpdaterState> => ipcRenderer.invoke('updater:state'),
  checkForUpdates: (): Promise<UpdaterState> => ipcRenderer.invoke('updater:check'),

  onThemesChanged: (cb: (themes: Theme[]) => void) => {
    const listener = (_e: unknown, themes: Theme[]) => cb(themes)
    ipcRenderer.on('themes:changed', listener)
    return () => ipcRenderer.removeListener('themes:changed', listener)
  },
  onUpdaterState: (cb: (state: UpdaterState) => void) => {
    const listener = (_e: unknown, state: UpdaterState) => cb(state)
    ipcRenderer.on('updater:state', listener)
    return () => ipcRenderer.removeListener('updater:state', listener)
  },
  onOpenPalette: (cb: () => void) => {
    const listener = () => cb()
    ipcRenderer.on('shortcut:openPalette', listener)
    return () => ipcRenderer.removeListener('shortcut:openPalette', listener)
  }
}

export type InkcalApi = typeof api

contextBridge.exposeInMainWorld('inkcal', api)
