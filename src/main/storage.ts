import { app } from 'electron'
import { promises as fs, existsSync, mkdirSync, copyFileSync } from 'fs'
import { join, dirname } from 'path'
import type { AppData } from '../shared/types'
import { DEFAULT_DATA } from '../shared/types'

const dataDir = () => app.getPath('userData')
const dataFile = () => join(dataDir(), 'data.json')
const backupsDir = () => join(dataDir(), 'backups')

let cache: AppData | null = null
let writeTimer: NodeJS.Timeout | null = null
let lastBackupDate: string | null = null

function ensureDirs() {
  if (!existsSync(dataDir())) mkdirSync(dataDir(), { recursive: true })
  if (!existsSync(backupsDir())) mkdirSync(backupsDir(), { recursive: true })
}

export async function loadData(): Promise<AppData> {
  if (cache) return cache
  ensureDirs()
  try {
    const raw = await fs.readFile(dataFile(), 'utf8')
    const parsed = JSON.parse(raw) as AppData
    cache = { ...DEFAULT_DATA, ...parsed, settings: { ...DEFAULT_DATA.settings, ...parsed.settings } }
    return cache
  } catch {
    cache = structuredClone(DEFAULT_DATA)
    await writeNow(cache)
    return cache
  }
}

async function writeNow(data: AppData) {
  ensureDirs()
  const tmp = dataFile() + '.tmp'
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8')
  await fs.rename(tmp, dataFile())

  const today = new Date().toISOString().slice(0, 10)
  if (lastBackupDate !== today) {
    try {
      copyFileSync(dataFile(), join(backupsDir(), `${today}.json`))
      lastBackupDate = today
      pruneBackups().catch(() => {})
    } catch {}
  }
}

async function pruneBackups(keep = 30) {
  try {
    const entries = await fs.readdir(backupsDir())
    const sorted = entries.filter(f => f.endsWith('.json')).sort().reverse()
    for (const f of sorted.slice(keep)) {
      await fs.unlink(join(backupsDir(), f)).catch(() => {})
    }
  } catch {}
}

export function saveData(data: AppData): void {
  cache = data
  if (writeTimer) clearTimeout(writeTimer)
  writeTimer = setTimeout(() => {
    writeNow(data).catch(err => console.error('storage write failed', err))
  }, 500)
}

export async function flushSync(): Promise<void> {
  if (writeTimer) {
    clearTimeout(writeTimer)
    writeTimer = null
  }
  if (cache) await writeNow(cache)
}

export function getDataDir(): string {
  return dataDir()
}

export function getDataFilePath(): string {
  return dataFile()
}

export async function exportTo(targetPath: string): Promise<void> {
  await flushSync()
  await fs.mkdir(dirname(targetPath), { recursive: true })
  await fs.copyFile(dataFile(), targetPath)
}

export async function importFrom(sourcePath: string): Promise<AppData> {
  const raw = await fs.readFile(sourcePath, 'utf8')
  const parsed = JSON.parse(raw) as AppData
  if (typeof parsed.version !== 'number') throw new Error('invalid data file')
  // backup current first
  if (existsSync(dataFile())) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    copyFileSync(dataFile(), join(backupsDir(), `before-import-${stamp}.json`))
  }
  cache = { ...DEFAULT_DATA, ...parsed, settings: { ...DEFAULT_DATA.settings, ...parsed.settings } }
  await writeNow(cache)
  return cache
}
