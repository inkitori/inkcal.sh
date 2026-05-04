import { app, dialog, ipcMain } from 'electron'
import { join } from 'path'
import {
  exportTo,
  flushSync,
  getDataDir,
  getDataFilePath,
  importFrom,
  loadData,
  saveData
} from './storage'
import { getTheme, getUserThemesDir, loadThemes, watchThemes } from './themes'
import { applyWindowTheme, getWindow } from './window'
import { registerGlobalHotkey } from './shortcuts'
import { checkForUpdates, getUpdaterState } from './updater'
import type { AppData } from '../shared/types'
import { shell } from 'electron'

export function registerIpc() {
  ipcMain.handle('data:load', async () => loadData())

  ipcMain.handle('data:save', (_e, data: AppData) => {
    saveData(data)
    return true
  })

  ipcMain.handle('data:flush', async () => {
    await flushSync()
    return true
  })

  ipcMain.handle('data:export', async () => {
    const win = getWindow()
    if (!win) return { ok: false }
    const stamp = new Date().toISOString().slice(0, 10)
    const defaultPath = join(app.getPath('downloads'), `inkcal-${stamp}.json`)
    const result = await dialog.showSaveDialog(win, { defaultPath, filters: [{ name: 'JSON', extensions: ['json'] }] })
    if (result.canceled || !result.filePath) return { ok: false }
    await exportTo(result.filePath)
    return { ok: true, path: result.filePath }
  })

  ipcMain.handle('data:import', async () => {
    const win = getWindow()
    if (!win) return { ok: false }
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (result.canceled || !result.filePaths[0]) return { ok: false }
    const data = await importFrom(result.filePaths[0])
    return { ok: true, data }
  })

  ipcMain.handle('themes:list', async () => loadThemes())
  ipcMain.handle('themes:get', (_e, name: string) => getTheme(name))
  ipcMain.handle('themes:openDir', () => shell.openPath(getUserThemesDir()))

  ipcMain.handle(
    'window:applyTransparency',
    (_e, opts: { transparency: boolean; vibrancy?: any }) => {
      return applyWindowTheme(opts)
    }
  )

  ipcMain.handle('shortcuts:register', (_e, accelerator: string) => {
    return registerGlobalHotkey(accelerator)
  })

  ipcMain.handle('app:dataDir', () => getDataDir())
  ipcMain.handle('app:dataFile', () => getDataFilePath())
  ipcMain.handle('app:revealData', () => shell.showItemInFolder(getDataFilePath()))

  ipcMain.handle('app:about', () => ({
    name: app.getName(),
    productName: 'inkcal.sh',
    version: app.getVersion(),
    author: 'enyouki',
    repo: 'https://github.com/inkitori/inkcal.sh',
    electron: process.versions.electron,
    packaged: app.isPackaged
  }))
  ipcMain.handle('app:openExternal', (_e, url: string) => shell.openExternal(url))

  ipcMain.handle('updater:state', () => getUpdaterState())
  ipcMain.handle('updater:check', async () => {
    await checkForUpdates()
    return getUpdaterState()
  })

  // theme dir watcher → notify renderer when files change
  watchThemes(async () => {
    const themes = await loadThemes()
    getWindow()?.webContents.send('themes:changed', themes)
  })
}
