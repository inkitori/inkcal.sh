import { BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

let mainWin: BrowserWindow | null = null
let currentTransparency = false

type Vibrancy = 'under-window' | 'sidebar' | 'titlebar' | 'selection' | 'menu' | 'popover' | 'header' | 'sheet' | 'window' | 'hud' | 'fullscreen-ui' | 'tooltip' | 'content' | 'under-page'

interface CreateOpts {
  transparency?: boolean
  vibrancy?: Vibrancy
}

export function createWindow(opts: CreateOpts = {}): BrowserWindow {
  const transparent = !!opts.transparency
  currentTransparency = transparent

  mainWin = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 720,
    minHeight: 480,
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 12, y: 14 },
    backgroundColor: transparent ? '#00000000' : '#111113',
    transparent,
    vibrancy: transparent && opts.vibrancy ? opts.vibrancy : undefined,
    visualEffectState: 'active',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true
    }
  })

  mainWin.on('ready-to-show', () => mainWin?.show())

  mainWin.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // chromium grabs cmd+p (print) before the renderer can see it. intercept and
  // forward to the renderer so the palette opens instead.
  mainWin.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    if ((input.meta || input.control) && input.key.toLowerCase() === 'p') {
      event.preventDefault()
      mainWin?.webContents.send('shortcut:openPalette')
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWin.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWin.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWin
}

export function getWindow(): BrowserWindow | null {
  return mainWin
}

export function toggleWindow(): void {
  if (!mainWin) return
  if (mainWin.isVisible() && mainWin.isFocused()) {
    mainWin.hide()
  } else {
    mainWin.show()
    mainWin.focus()
  }
}

/** Recreate the window with new transparency/vibrancy settings.
 *  Required because BrowserWindow's `transparent` flag cannot be
 *  toggled after creation. */
export function recreateWindow(opts: CreateOpts): BrowserWindow {
  if (mainWin) {
    mainWin.removeAllListeners('close')
    mainWin.destroy()
    mainWin = null
  }
  return createWindow(opts)
}

/** Apply theme-related window settings smartly.
 *  - vibrancy can change in place (no recreate)
 *  - transparency toggle requires a recreate */
export function applyWindowTheme(opts: CreateOpts): { recreated: boolean } {
  const wantTransparent = !!opts.transparency
  if (wantTransparent === currentTransparency && mainWin && !mainWin.isDestroyed()) {
    if (wantTransparent) {
      mainWin.setVibrancy((opts.vibrancy ?? null) as Vibrancy | null)
    } else {
      mainWin.setVibrancy(null)
    }
    return { recreated: false }
  }
  recreateWindow(opts)
  return { recreated: true }
}
