import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type { AppData, Completion, Settings, Task } from '@/../shared/types'
import { DEFAULT_DATA } from '@/../shared/types'
import { todayISO, isBefore } from './date'

interface UndoEntry {
  id: string
  task: Task
  completions: Completion[]
  deletedAt: number
}

type ViewName = 'todo' | 'calendar' | 'notes'

interface State {
  ready: boolean
  view: ViewName
  tasks: Task[]
  completions: Completion[]
  settings: Settings

  /** ephemeral UI state */
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
  undoStack: UndoEntry[]

  /** init/persistence */
  init: () => Promise<void>
  flushSoon: () => void
  saveNow: () => Promise<void>

  /** view */
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

  /** mutations */
  addTask: (t: Task) => void
  updateTask: (id: string, patch: Partial<Task>) => void
  deleteTask: (id: string) => void
  toggleCompletion: (taskId: string, dateISO: string) => void
  restoreUndo: () => void
  clearUndo: () => void

  /** settings */
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
  undoStack: [],

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
    if (!task) return
    const completions = s.completions.filter(c => c.taskId === id)
    const entry: UndoEntry = { id: nanoid(), task, completions, deletedAt: Date.now() }
    set({
      tasks: s.tasks.filter(t => t.id !== id),
      completions: s.completions.filter(c => c.taskId !== id),
      undoStack: [...s.undoStack, entry].slice(-100)
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
  restoreUndo() {
    const s = get()
    if (s.undoStack.length === 0) return
    const entry = s.undoStack[s.undoStack.length - 1]
    set({
      tasks: [...s.tasks, entry.task],
      completions: [...s.completions, ...entry.completions],
      undoStack: s.undoStack.slice(0, -1)
    })
    persist(get)
  },
  clearUndo() { set({ undoStack: [] }) },

  async setSettings(patch) {
    set(s => ({ settings: { ...s.settings, ...patch } }))
    persist(get)
  }
}))

export function selectOverdueTodos(tasks: Task[], completions: Completion[]): Task[] {
  const today = todayISO()
  // A todo completed today still shows here (sunk by sinkCompleted) so the
  // "just did this" feedback lands in the section the user expects.
  return tasks
    .filter(t => t.kind === 'todo' && t.due && isBefore(t.due, today))
    .filter(t => !completions.some(c => c.taskId === t.id && c.date !== today))
    .sort((a, b) => (a.due ?? '').localeCompare(b.due ?? ''))
}

export function selectTodayTodos(tasks: Task[]): Task[] {
  const today = todayISO()
  return tasks
    .filter(t => t.kind === 'todo' && t.due === today)
    .sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99'))
}

export function selectUpcomingTodos(tasks: Task[]): Task[] {
  const today = todayISO()
  return tasks
    .filter(t => t.kind === 'todo' && t.due && t.due > today)
    .sort((a, b) => (a.due ?? '').localeCompare(b.due ?? ''))
}

export function selectInboxTodos(tasks: Task[]): Task[] {
  return tasks
    .filter(t => t.kind === 'todo' && (t.due === null || t.due === undefined))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export function selectNotes(tasks: Task[]): Task[] {
  return tasks
    .filter(t => t.kind === 'note')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function selectRecurring(tasks: Task[]): Task[] {
  return tasks.filter(t => t.kind === 'recurring')
}
