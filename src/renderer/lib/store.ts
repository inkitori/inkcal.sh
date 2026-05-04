import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type { AppData, Completion, Settings, Task } from '@/../shared/types'
import { DEFAULT_DATA } from '@/../shared/types'
import { todayISO, addDays, isBefore } from './date'

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
  openPalette() { set({ paletteOpen: true, captureOpen: false, editOpen: false, searchOpen: false }) },
  closePalette() { set({ paletteOpen: false }) },
  openCapture(prefill = '') { set({ captureOpen: true, paletteOpen: false, editOpen: false, searchOpen: false, capturePrefill: prefill }) },
  closeCapture() { set({ captureOpen: false, capturePrefill: '' }) },
  openEdit(id) { set({ editOpen: true, editTaskId: id, captureOpen: false, paletteOpen: false, searchOpen: false }) },
  closeEdit() { set({ editOpen: false, editTaskId: null }) },
  openSearch() { set({ searchOpen: true, paletteOpen: false, captureOpen: false, editOpen: false }) },
  closeSearch() { set({ searchOpen: false }) },
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

/* ── selectors ──────────────────────────────────────────────── */

export function selectOverdueTodos(s: State): Task[] {
  const today = todayISO()
  const completedToday = new Set(s.completions.filter(c => c.date === today).map(c => c.taskId))
  return s.tasks
    .filter(t => t.kind === 'todo' && t.due && isBefore(t.due, today) && !isAnyCompletion(s.completions, t.id))
    .filter(t => !completedToday.has(t.id))
    .sort((a, b) => (a.due ?? '').localeCompare(b.due ?? ''))
}

export function selectTodayTodos(s: State): Task[] {
  const today = todayISO()
  return s.tasks
    .filter(t => t.kind === 'todo' && t.due === today)
    .sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99'))
}

export function selectUpcomingTodos(s: State): Task[] {
  const today = todayISO()
  const horizon = addDays(today, 30)
  return s.tasks
    .filter(t => t.kind === 'todo' && t.due && t.due > today && t.due <= horizon)
    .sort((a, b) => (a.due ?? '').localeCompare(b.due ?? ''))
}

export function selectInboxTodos(s: State): Task[] {
  return s.tasks
    .filter(t => t.kind === 'todo' && (t.due === null || t.due === undefined))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export function selectNotes(s: State): Task[] {
  return s.tasks
    .filter(t => t.kind === 'note')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function selectRecurring(s: State): Task[] {
  return s.tasks.filter(t => t.kind === 'recurring')
}

function isAnyCompletion(comps: Completion[], taskId: string): boolean {
  return comps.some(c => c.taskId === taskId)
}
