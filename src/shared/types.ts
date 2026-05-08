export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

export const WEEKDAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

export type TaskKind = 'todo' | 'recurring' | 'note'

export interface Recurrence {
  /** specific weekdays it occurs on; if both provided, days takes precedence */
  days?: Weekday[]
  /** every day */
  daily?: boolean
  /** 'HH:MM' 24h */
  start?: string
  /** 'HH:MM' 24h */
  end?: string
}

export interface Task {
  id: string
  kind: TaskKind
  title?: string
  /** for kind='note' */
  body?: string
  /** ISO date 'YYYY-MM-DD' for one-off todos. null/undefined = inbox */
  due?: string | null
  /** 'HH:MM' optional time-of-day for one-off todos */
  time?: string
  /** 'HH:MM' optional end-time for one-off todos (block of time) */
  endTime?: string
  /** present only when kind='recurring' */
  recurrence?: Recurrence
  createdAt: string
}

export interface Completion {
  taskId: string
  /** 'YYYY-MM-DD'. for one-offs we still record the day completed */
  date: string
  at: string
}

export interface Settings {
  activeTheme: string
  globalHotkey: string
  transparency: boolean
  defaultView: 'todo' | 'calendar' | 'notes'
  /** last view used; restored on next launch (incl. window recreate from transparency toggle) */
  lastView?: 'todo' | 'calendar' | 'notes'
  /** when false, the notes editor is plain CodeMirror (no vim bindings) */
  vimEnabled: boolean
  notesMaxWidth: 'narrow' | 'medium' | 'wide' | 'full'
  splitEnabled: boolean
  splitSecondary: 'todo' | 'calendar' | 'notes' | null
  /** primary pane fraction, 0..1 */
  splitRatio: number
  /** when true, NoteFocus shows a live markdown preview alongside the editor */
  notePreviewInFocus: boolean
}

export interface AppData {
  version: number
  settings: Settings
  tasks: Task[]
  completions: Completion[]
}

export interface Theme {
  name: string
  vars: Record<string, string>
  transparency?: {
    enabled: boolean
    vibrancy?: 'under-window' | 'sidebar' | 'titlebar' | 'selection' | 'menu' | 'popover' | 'header' | 'sheet' | 'window' | 'hud' | 'fullscreen-ui' | 'tooltip' | 'content' | 'under-page'
    alpha?: number
  }
}

export interface AboutInfo {
  name: string
  productName: string
  version: string
  author: string
  repo: string
  electron: string
  packaged: boolean
}

export type UpdaterStatus =
  | 'idle'
  | 'unsupported'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'up-to-date'
  | 'error'

export interface UpdaterState {
  status: UpdaterStatus
  currentVersion: string
  latestVersion?: string
  downloadPercent?: number
  error?: string
}

export const DEFAULT_DATA: AppData = {
  version: 1,
  settings: {
    activeTheme: 'dark',
    globalHotkey: 'Cmd+Shift+Space',
    transparency: false,
    defaultView: 'todo',
    vimEnabled: false,
    notesMaxWidth: 'wide',
    splitEnabled: false,
    splitSecondary: null,
    splitRatio: 0.5,
    notePreviewInFocus: false
  },
  tasks: [],
  completions: []
}
