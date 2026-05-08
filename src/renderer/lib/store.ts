import { create } from 'zustand'
import type { AppData, Completion, Settings, Task } from '@/../shared/types'
import { DEFAULT_DATA } from '@/../shared/types'
import { todayISO, isBefore } from './date'

type ViewName = 'todo' | 'calendar' | 'notes'

interface UndoEntry {
  description: string
  /** apply the original action — used by redo */
  redo: () => void
  /** revert the action — used by undo */
  undo: () => void
}

interface StatusMessage {
  text: string
  /** Date.now() when posted; component can fade based on age */
  at: number
}

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
  archiveOpen: boolean
  aboutOpen: boolean
  updateCheckOpen: boolean
  settingsOpen: boolean
  noteFocusId: string | null
  focusedPane: 'primary' | 'secondary'
  pendingSelectId: string | null

  undoStack: UndoEntry[]
  redoStack: UndoEntry[]
  status: StatusMessage | null

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
  openArchive: () => void
  closeArchive: () => void
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
  toggleCompletion: (taskId: string, dateISO: string) => void
  uncompleteTask: (taskId: string) => void

  undo: () => void
  redo: () => void
  showStatus: (text: string) => void

  setSettings: (patch: Partial<Settings>) => Promise<void>
}

let saveDebounce: ReturnType<typeof setTimeout> | null = null
let statusTimer: ReturnType<typeof setTimeout> | null = null
const UNDO_LIMIT = 100
const STATUS_MS = 1500

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

function describe(t: Task | undefined): string {
  if (!t) return '(missing)'
  return t.title?.trim() || t.body?.trim().split('\n')[0] || '(untitled)'
}

export const useStore = create<State>((set, get) => {
  function pushUndo(entry: UndoEntry) {
    const s = get()
    set({
      undoStack: [...s.undoStack, entry].slice(-UNDO_LIMIT),
      redoStack: []
    })
  }

  function setStatus(text: string) {
    if (statusTimer) clearTimeout(statusTimer)
    set({ status: { text, at: Date.now() } })
    statusTimer = setTimeout(() => set({ status: null }), STATUS_MS)
  }

  return {
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
    archiveOpen: false,
    aboutOpen: false,
    updateCheckOpen: false,
    settingsOpen: false,
    noteFocusId: null,
    focusedPane: 'primary',
    pendingSelectId: null,

    undoStack: [],
    redoStack: [],
    status: null,

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
    openPalette() { set({ paletteOpen: true, captureOpen: false, editOpen: false, searchOpen: false, archiveOpen: false, settingsOpen: false }) },
    closePalette() { set({ paletteOpen: false }) },
    openCapture(prefill = '') { set({ captureOpen: true, paletteOpen: false, editOpen: false, searchOpen: false, archiveOpen: false, settingsOpen: false, capturePrefill: prefill }) },
    closeCapture() { set({ captureOpen: false, capturePrefill: '' }) },
    openEdit(id) { set({ editOpen: true, editTaskId: id, captureOpen: false, paletteOpen: false, searchOpen: false, archiveOpen: false, settingsOpen: false }) },
    closeEdit() { set({ editOpen: false, editTaskId: null }) },
    openSearch() { set({ searchOpen: true, paletteOpen: false, captureOpen: false, editOpen: false, archiveOpen: false, settingsOpen: false }) },
    closeSearch() { set({ searchOpen: false }) },
    openArchive() { set({ archiveOpen: true, paletteOpen: false, captureOpen: false, editOpen: false, searchOpen: false, settingsOpen: false }) },
    closeArchive() { set({ archiveOpen: false }) },
    openAbout() { set({ aboutOpen: true, paletteOpen: false, captureOpen: false, editOpen: false, searchOpen: false, archiveOpen: false, settingsOpen: false }) },
    closeAbout() { set({ aboutOpen: false }) },
    openUpdateCheck() { set({ updateCheckOpen: true, paletteOpen: false, captureOpen: false, editOpen: false, searchOpen: false, archiveOpen: false, aboutOpen: false, settingsOpen: false }) },
    closeUpdateCheck() { set({ updateCheckOpen: false }) },
    openSettings() { set({ settingsOpen: true, paletteOpen: false, captureOpen: false, editOpen: false, searchOpen: false, archiveOpen: false, aboutOpen: false, updateCheckOpen: false }) },
    closeSettings() { set({ settingsOpen: false }) },
    openNoteFocus(id) { set({ noteFocusId: id }) },
    closeNoteFocus() { set({ noteFocusId: null }) },
    setFocusedPane(p) { set({ focusedPane: p }) },
    setPendingSelectId(id) { set({ pendingSelectId: id }) },

    addTask(t) {
      const apply = () => set(s => ({ tasks: [...s.tasks, t] }))
      const inverse = () => set(s => ({ tasks: s.tasks.filter(x => x.id !== t.id) }))
      apply()
      pushUndo({ description: `added ${describe(t)}`, redo: apply, undo: inverse })
      persist(get)
    },
    updateTask(id, patch) {
      const before = get().tasks.find(t => t.id === id)
      if (!before) return
      const apply = () => set(s => ({ tasks: s.tasks.map(t => t.id === id ? { ...t, ...patch } : t) }))
      const inverse = () => set(s => ({ tasks: s.tasks.map(t => t.id === id ? before : t) }))
      apply()
      pushUndo({ description: `edited ${describe(before)}`, redo: apply, undo: inverse })
      persist(get)
    },
    deleteTask(id) {
      const before = get().tasks.find(t => t.id === id)
      if (!before || before.deletedAt) return
      const deletedAt = new Date().toISOString()
      const apply = () => set(s => ({
        tasks: s.tasks.map(t => t.id === id ? { ...t, deletedAt } : t)
      }))
      const inverse = () => set(s => ({ tasks: s.tasks.map(t => t.id === id ? before : t) }))
      apply()
      pushUndo({ description: `deleted ${describe(before)}`, redo: apply, undo: inverse })
      persist(get)
    },
    permanentlyDeleteTask(id) {
      const before = get().tasks.find(t => t.id === id)
      if (!before) return
      const beforeCompletions = get().completions.filter(c => c.taskId === id)
      const apply = () => set(s => ({
        tasks: s.tasks.filter(t => t.id !== id),
        completions: s.completions.filter(c => c.taskId !== id)
      }))
      const inverse = () => set(s => ({
        tasks: [...s.tasks, before],
        completions: [...s.completions, ...beforeCompletions]
      }))
      apply()
      pushUndo({ description: `permanently deleted ${describe(before)}`, redo: apply, undo: inverse })
      persist(get)
    },
    restoreTask(id) {
      const before = get().tasks.find(t => t.id === id)
      if (!before || !before.deletedAt) return
      const apply = () => set(s => ({
        tasks: s.tasks.map(t => {
          if (t.id !== id) return t
          const { deletedAt: _drop, ...rest } = t
          return rest
        })
      }))
      const inverse = () => set(s => ({ tasks: s.tasks.map(t => t.id === id ? before : t) }))
      apply()
      pushUndo({ description: `restored ${describe(before)}`, redo: apply, undo: inverse })
      persist(get)
    },
    toggleCompletion(taskId, dateISO) {
      const s = get()
      const task = s.tasks.find(t => t.id === taskId)
      const desc = describe(task)
      const existing = s.completions.find(c => c.taskId === taskId && c.date === dateISO)
      if (existing) {
        const apply = () => set(s => ({
          completions: s.completions.filter(c => !(c.taskId === taskId && c.date === dateISO))
        }))
        const inverse = () => set(s => ({ completions: [...s.completions, existing] }))
        apply()
        pushUndo({ description: `unchecked ${desc}`, redo: apply, undo: inverse })
      } else {
        const entry: Completion = { taskId, date: dateISO, at: new Date().toISOString() }
        const apply = () => set(s => ({ completions: [...s.completions, entry] }))
        const inverse = () => set(s => ({
          completions: s.completions.filter(c => !(c.taskId === entry.taskId && c.date === entry.date && c.at === entry.at))
        }))
        apply()
        pushUndo({ description: `completed ${desc}`, redo: apply, undo: inverse })
      }
      persist(get)
    },
    uncompleteTask(taskId) {
      const s = get()
      const removed = s.completions.filter(c => c.taskId === taskId)
      if (removed.length === 0) return
      const desc = describe(s.tasks.find(t => t.id === taskId))
      const apply = () => set(s => ({ completions: s.completions.filter(c => c.taskId !== taskId) }))
      const inverse = () => set(s => ({ completions: [...s.completions, ...removed] }))
      apply()
      pushUndo({ description: `uncompleted ${desc}`, redo: apply, undo: inverse })
      persist(get)
    },

    undo() {
      const s = get()
      if (s.undoStack.length === 0) {
        setStatus('nothing to undo')
        return
      }
      const entry = s.undoStack[s.undoStack.length - 1]
      entry.undo()
      set({
        undoStack: get().undoStack.slice(0, -1),
        redoStack: [...get().redoStack, entry].slice(-UNDO_LIMIT)
      })
      setStatus(`undo: ${entry.description}`)
      persist(get)
    },
    redo() {
      const s = get()
      if (s.redoStack.length === 0) {
        setStatus('nothing to redo')
        return
      }
      const entry = s.redoStack[s.redoStack.length - 1]
      entry.redo()
      set({
        redoStack: get().redoStack.slice(0, -1),
        undoStack: [...get().undoStack, entry].slice(-UNDO_LIMIT)
      })
      setStatus(`redo: ${entry.description}`)
      persist(get)
    },
    showStatus(text) { setStatus(text) },

    async setSettings(patch) {
      set(s => ({ settings: { ...s.settings, ...patch } }))
      persist(get)
    }
  }
})

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
