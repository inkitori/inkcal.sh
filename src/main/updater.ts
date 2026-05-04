import { app, BrowserWindow } from 'electron'
import pkg from 'electron-updater'
import type { UpdaterState } from '../shared/types'

const { autoUpdater } = pkg

let state: UpdaterState = {
  status: 'idle',
  currentVersion: app.getVersion()
}

function setState(patch: Partial<UpdaterState>): void {
  state = { ...state, ...patch }
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('updater:state', state)
  }
}

export function getUpdaterState(): UpdaterState {
  return state
}

export function checkForUpdates(): Promise<void> {
  if (!app.isPackaged) {
    setState({ status: 'unsupported' })
    return Promise.resolve()
  }
  // If a download is already in flight or finished, re-checking would make
  // electron-updater fire `update-not-available` ("newer version is being
  // installed already"), which we'd misread as "up-to-date". Keep current state.
  if (
    state.status === 'available' ||
    state.status === 'downloading' ||
    state.status === 'downloaded'
  ) {
    return Promise.resolve()
  }
  setState({ status: 'checking' })
  return autoUpdater.checkForUpdates().then(() => undefined).catch((err) => {
    setState({ status: 'error', error: String(err?.message ?? err) })
  })
}

export function initAutoUpdater(): void {
  if (!app.isPackaged) {
    setState({ status: 'unsupported' })
    return
  }

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => setState({ status: 'checking' }))
  autoUpdater.on('update-available', (info) =>
    setState({ status: 'available', latestVersion: info.version })
  )
  autoUpdater.on('update-not-available', (info) =>
    setState({ status: 'up-to-date', latestVersion: info.version })
  )
  autoUpdater.on('download-progress', (p) =>
    setState({ status: 'downloading', downloadPercent: Math.round(p.percent) })
  )
  autoUpdater.on('update-downloaded', (info) =>
    setState({ status: 'downloaded', latestVersion: info.version })
  )
  autoUpdater.on('error', (err) => {
    console.error('[updater]', err)
    setState({ status: 'error', error: String(err?.message ?? err) })
  })

  checkForUpdates()
  setInterval(() => { checkForUpdates() }, 6 * 60 * 60 * 1000)
}
