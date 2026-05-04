import { app, BrowserWindow } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { createWindow, getWindow } from './window'
import { registerIpc } from './ipc'
import { loadData } from './storage'
import { loadThemes, getTheme } from './themes'
import { registerGlobalHotkey, unregisterAll } from './shortcuts'

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const win = getWindow()
    if (win) {
      if (win.isMinimized()) win.restore()
      win.show()
      win.focus()
    }
  })

  app.whenReady().then(async () => {
    electronApp.setAppUserModelId('sh.inkcal.app')

    app.on('browser-window-created', (_e, win) => optimizer.watchWindowShortcuts(win))

    const data = await loadData()
    await loadThemes()
    const theme = getTheme(data.settings.activeTheme)

    const useTransparency = data.settings.transparency && !!theme?.transparency?.enabled
    createWindow({
      transparency: useTransparency,
      vibrancy: useTransparency ? theme?.transparency?.vibrancy : undefined
    })

    registerIpc()
    registerGlobalHotkey(data.settings.globalHotkey || 'Cmd+Shift+Space')

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow({ transparency: useTransparency })
    })
  })

  app.on('will-quit', () => {
    unregisterAll()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
