import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { createWindow, getWindow } from './window'
import { registerIpc } from './ipc'
import { loadData } from './storage'
import { loadThemes, getTheme } from './themes'
import { registerGlobalHotkey, unregisterAll } from './shortcuts'
import { initAutoUpdater } from './updater'

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

    // dev runs from node_modules/electron, so the dock/alt-tab icon defaults
    // to electron's. packaged builds get the icon from the .app bundle.
    if (!app.isPackaged && process.platform === 'darwin') {
      app.dock?.setIcon(join(__dirname, '../../build/icon.png'))
    }

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
    initAutoUpdater()

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
