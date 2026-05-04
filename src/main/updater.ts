import { app } from 'electron'
import pkg from 'electron-updater'

const { autoUpdater } = pkg

export function initAutoUpdater(): void {
  if (!app.isPackaged) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('error', (err) => console.error('[updater]', err))
  autoUpdater.on('update-available', (info) => console.log('[updater] available', info.version))
  autoUpdater.on('update-downloaded', (info) => console.log('[updater] downloaded', info.version))

  autoUpdater.checkForUpdates().catch((err) => console.error('[updater] initial check failed', err))
  setInterval(() => {
    autoUpdater.checkForUpdates().catch((err) => console.error('[updater] periodic check failed', err))
  }, 6 * 60 * 60 * 1000)
}
