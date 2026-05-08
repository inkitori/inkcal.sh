import { app } from 'electron'
import { promises as fs, existsSync, mkdirSync, watch } from 'fs'
import { join } from 'path'
import type { Theme } from '../shared/types'

const userThemesDir = () => join(app.getPath('userData'), 'themes')
const bundledThemesDir = () => {
  // in dev, themes/ lives at project root; in prod, in resources/
  const candidates = [
    join(app.getAppPath(), 'themes'),
    join(process.resourcesPath || '', 'themes')
  ]
  return candidates.find(p => p && existsSync(p)) || candidates[0]
}

let themesCache: Map<string, Theme> = new Map()
let watcher: ReturnType<typeof watch> | null = null
let onChange: (() => void) | null = null

function ensureUserDir() {
  if (!existsSync(userThemesDir())) mkdirSync(userThemesDir(), { recursive: true })
}

async function readThemeFile(path: string): Promise<Theme | null> {
  try {
    const raw = await fs.readFile(path, 'utf8')
    const parsed = JSON.parse(raw) as Theme
    if (!parsed.name || typeof parsed.vars !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

async function readDir(dir: string): Promise<Theme[]> {
  if (!existsSync(dir)) return []
  const entries = await fs.readdir(dir)
  const out: Theme[] = []
  for (const e of entries) {
    if (!e.endsWith('.json')) continue
    const t = await readThemeFile(join(dir, e))
    if (t) out.push(t)
  }
  return out
}

export async function loadThemes(): Promise<Theme[]> {
  ensureUserDir()
  const userExisting = (await readDir(userThemesDir())).map(t => t.name)
  const bundled = await readDir(bundledThemesDir())
  for (const t of bundled) {
    if (!userExisting.includes(t.name)) {
      const path = join(userThemesDir(), `${t.name}.json`)
      if (!existsSync(path)) {
        await fs.writeFile(path, JSON.stringify(t, null, 2), 'utf8')
      }
    }
  }
  const all = await readDir(userThemesDir())
  themesCache = new Map(all.map(t => [t.name, t]))
  return all
}

export function getTheme(name: string): Theme | null {
  return themesCache.get(name) ?? null
}

export function getUserThemesDir(): string {
  return userThemesDir()
}

export function watchThemes(cb: () => void): void {
  ensureUserDir()
  if (watcher) watcher.close()
  onChange = cb
  watcher = watch(userThemesDir(), { persistent: true }, () => {
    loadThemes().then(() => onChange?.()).catch(() => {})
  })
}
