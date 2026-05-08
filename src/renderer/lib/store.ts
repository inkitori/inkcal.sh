import { create } from 'zustand'
import type { AppData, Completion, Settings, Task } from '@/../shared/types'
import { DEFAULT_DATA } from '@/../shared/types'
import { todayISO, isBefore } from './date'

type ViewName = 'todo' | 'calendar' | 'notes' | 'archive'

interface State {
  ready: boolean
  view: ViewName
  tasks: Task[]
  completions: Completion[]
  settings: Settings

  paletteOpen: boolean
  captureOpen: boolean
  capturePrefill: string
  editOpen: boolean
  editTaskId: string | null
  searchOpen: boolean
  aboutOpen: boolean
  updateCheckOpen: boolean
  settingsOpen: boolean
  noteFocusId: string | null
  focusedPane: 'primary' | 'secondary'
  pendingSelectId: string | null

  init: () => Promise<void>
  flushSoon: () => void
  saveNow: () => Promise<void>

  setView: (v: ViewName) => void
  openPalette: () => void
  closePalette: () => void
  openCapture: (prefill?: string) => void
  closeCapture: () => void
  openEdit: (id: string) => void
  closeEdit: () => void
  openSearch: () => void
  closeSearch: () => void
  openAbout: () => void
  closeAbout: () => void
  openUpdateCheck: () => void
  closeUpdateCheck: () => void
  openSettings: () => void
  closeSettings: () => void
  openNoteFocus: (id: string) => void
  closeNoteFocus: () => void
  setFocusedPane: (p: 'primary' | 'secondary') => void
  setPendingSelectId: (id: string | null) => void

  addTask: (t: Task) => void
  updateTask: (id: string, patch: Partial<Task>) => void
  deleteTask: (id: string) => void
  permanentlyDeleteTask: (id: string) => void
  restoreTask: (id: string) => void
  restoreMostRecentDeleted: () => void
  toggleCompletion: (taskId: string, dateISO: string) => void
  uncompleteTask: (taskId: string) => void

  setSettings: (patch: Partial<Settings>) => Promise<void>
}

let saveDebounce: ReturnType<typeof setTimeout> | null = null

function persist(get: () => State) {
  if (saveDebounce) clearTimeout(saveDebounce)
  saveDebounce = setTimeout(() => {
    const s = get()
    const data: AppData = {
      version: 1,
      settings: s.settings,
      tasks: s.tasks,
      completions: s.completions
    }
    window.inkcal?.saveData(data).catch(() => {})
  }, 200)
}

export const useStore = create<State>((set, get) => ({
  ready: false,
  view: 'todo',
  tasks: [],
  completions: [],
  settings: DEFAULT_DATA.settings,

  paletteOpen: false,
  captureOpen: false,
  capturePrefill: '',
  editOpen: false,
  editTaskId: null,
  searchOpen: false,
  aboutOpen: false,
  updateCheckOpen: false,
  settingsOpen: false,
  noteFocusId: null,
  focusedPane: 'primary',
  pendingSelectId: null,

  async init() {
    const data = await window.inkcal.loadData()
    const settings = { ...DEFAULT_DATA.settings, ...data.settings }
    set({
      ready: true,
      tasks: data.tasks ?? [],
      completions: data.completions ?? [],
      settings,
      view: settings.lastView ?? settings.defaultView ?? 'todo'
    })
  },
  flushSoon() {
    persist(get)
  },
  async saveNow() {
    if (saveDebounce) clearTimeout(saveDebounce)
    saveDebounce = null
    const s = get()
    const data: AppData = {
      version: 1,
      settings: s.settings,
      tasks: s.tasks,
      completions: s.completions
    }
    await window.inkcal.saveData(data)
    await window.inkcal.flushData()
  },

  setView(v) {
    set(s => ({ view: v, settings: { ...s.settings, lastView: v } }))
    persist(get)
  },
  openPalette() { set({ paletteOpen: true, captureOpen: false, editOpen: false, searchOpen: false, settingsOpen: false }) },
  closePalette() { set({ paletteOpen: false }) },
  openCapture(prefill = '') { set({ captureOpen: true, paletteOpen: false, editOpen: false, searchOpen: false, settingsOpen: false, capturePrefill: prefill }) },
  closeCapture() { set({ captureOpen: false, capturePrefill: '' }) },
  openEdit(id) { set({ editOpen: true, editTaskId: id, captureOpen: false, paletteOpen: false, searchOpen: false, settingsOpen: false }) },
  closeEdit() { set({ editOpen: false, editTaskId: null }) },
  openSearch() { set({ searchOpen: true, paletteOpen: false, captureOpen: false, editOpen: false, settingsOpen: false }) },
  closeSearch() { set({ searchOpen: false }) },
  openAbout() { set({ aboutOpen: true, paletteOpen: false, captureOpen: false, editOpen: false, searchOpen: false, settingsOpen: false }) },
  closeAbout() { set({ aboutOpen: false }) },
  openUpdateCheck() { set({ updateCheckOpen: true, paletteOpen: false, captureOpen: false, editOpen: false, searchOpen: false, aboutOpen: false, settingsOpen: false }) },
  closeUpdateCheck() { set({ updateCheckOpen: false }) },
  openSettings() { set({ settingsOpen: true, paletteOpen: false, captureOpen: false, editOpen: false, searchOpen: false, aboutOpen: false, updateCheckOpen: false }) },
  closeSettings() { set({ settingsOpen: false }) },
  openNoteFocus(id) { set({ noteFocusId: id }) },
  closeNoteFocus() { set({ noteFocusId: null }) },
  setFocusedPane(p) { set({ focusedPane: p }) },
  setPendingSelectId(id) { set({ pendingSelectId: id }) },

  addTask(t) {
    set(s => ({ tasks: [...s.tasks, t] }))
    persist(get)
  },
  updateTask(id, patch) {
    set(s => ({ tasks: s.tasks.map(t => t.id === id ? { ...t, ...patch } : t) }))
    persist(get)
  },
  deleteTask(id) {
    const s = get()
    const task = s.tasks.find(t => t.id === id)
    if (!task || task.deletedAt) return
    set({
      tasks: s.tasks.map(t => t.id === id ? { ...t, deletedAt: new Date().toISOString() } : t)
    })
    persist(get)
  },
  permanentlyDeleteTask(id) {
    const s = get()
    set({
      tasks: s.tasks.filter(t => t.id !== id),
      completions: s.completions.filter(c => c.taskId !== id)
    })
    persist(get)
  },
  restoreTask(id) {
    const s = get()
    set({
      tasks: s.tasks.map(t => {
        if (t.id !== id) return t
        const { deletedAt: _drop, ...rest } = t
        return rest
      })
    })
    persist(get)
  },
  restoreMostRecentDeleted() {
    const s = get()
    let latest: Task | null = null
    for (const t of s.tasks) {
      if (!t.deletedAt) continue
      if (!latest || (latest.deletedAt && t.deletedAt > latest.deletedAt)) latest = t
    }
    if (!latest) return
    const id = latest.id
    set({
      tasks: s.tasks.map(t => {
        if (t.id !== id) return t
        const { deletedAt: _drop, ...rest } = t
        return rest
      })
    })
    persist(get)
  },
  toggleCompletion(taskId, dateISO) {
    const s = get()
    const exists = s.completions.some(c => c.taskId === taskId && c.date === dateISO)
    if (exists) {
      set({ completions: s.completions.filter(c => !(c.taskId === taskId && c.date === dateISO)) })
    } else {
      const entry: Completion = { taskId, date: dateISO, at: new Date().toISOString() }
      set({ completions: [...s.completions, entry] })
    }
    persist(get)
  },
  uncompleteTask(taskId) {
    const s = get()
    set({ completions: s.completions.filter(c => c.taskId !== taskId) })
    persist(get)
  },

  async setSettings(patch) {
    set(s => ({ settings: { ...s.settings, ...patch } }))
    persist(get)
  }
}))

function isCompletedOneOff(t: Task, completions: Completion[]): boolean {
  return t.kind === 'todo' && completions.some(c => c.taskId === t.id)
}

export function selectOverdueTodos(tasks: Task[], completions: Completion[]): Task[] {
  const today = todayISO()
  return tasks
    .filter(t => !t.deletedAt)
    .filter(t => t.kind === 'todo' && t.due && isBefore(t.due, today))
    .filter(t => !isCompletedOneOff(t, completions))
    .sort((a, b) => (a.due ?? '').localeCompare(b.due ?? ''))
}

export function selectTodayTodos(tasks: Task[], completions: Completion[]): Task[] {
  const today = todayISO()
  return tasks
    .filter(t => !t.deletedAt)
    .filter(t => t.kind === 'todo' && t.due === today)
    .filter(t => !isCompletedOneOff(t, completions))
    .sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99'))
}

export function selectUpcomingTodos(tasks: Task[], completions: Completion[]): Task[] {
  const today = todayISO()
  return tasks
    .filter(t => !t.deletedAt)
    .filter(t => t.kind === 'todo' && t.due && t.due > today)
    .filter(t => !isCompletedOneOff(t, completions))
    .sort((a, b) => (a.due ?? '').localeCompare(b.due ?? ''))
}

export function selectInboxTodos(tasks: Task[], completions: Completion[]): Task[] {
  return tasks
    .filter(t => !t.deletedAt)
    .filter(t => t.kind === 'todo' && (t.due === null || t.due === undefined))
    .filter(t => !isCompletedOneOff(t, completions))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export function selectNotes(tasks: Task[]): Task[] {
  return tasks
    .filter(t => t.kind === 'note' && !t.deletedAt)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function selectRecurring(tasks: Task[]): Task[] {
  return tasks.filter(t => t.kind === 'recurring' && !t.deletedAt)
}

interface ArchiveBuckets {
  /** one-off todos with at least one completion record, not deleted; newest completion first */
  completed: Task[]
  /** any task with deletedAt; newest deletion first */
  deleted: Task[]
}

export function selectArchived(tasks: Task[], completions: Completion[]): ArchiveBuckets {
  const latestCompletion = new Map<string, string>()
  for (const c of completions) {
    const cur = latestCompletion.get(c.taskId)
    if (!cur || c.date > cur) latestCompletion.set(c.taskId, c.date)
  }

  const completed: Task[] = []
  const deleted: Task[] = []
  for (const t of tasks) {
    if (t.deletedAt) {
      deleted.push(t)
      continue
    }
    if (t.kind === 'todo' && latestCompletion.has(t.id)) {
      completed.push(t)
    }
  }
  completed.sort((a, b) => {
    const ad = latestCompletion.get(a.id) ?? ''
    const bd = latestCompletion.get(b.id) ?? ''
    return bd.localeCompare(ad)
  })
  deleted.sort((a, b) => (b.deletedAt ?? '').localeCompare(a.deletedAt ?? ''))
  return { completed, deleted }
}

/** "YYYY-MM-DD" for the latest completion of a task, or null. */
export function lastCompletionDate(taskId: string, completions: Completion[]): string | null {
  let latest: string | null = null
  for (const c of completions) {
    if (c.taskId !== taskId) continue
    if (!latest || c.date > latest) latest = c.date
  }
  return latest
}
