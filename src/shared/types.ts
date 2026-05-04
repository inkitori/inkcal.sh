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
  /** ISO date 'YYYY-MM-DD' for one-off todos. null/undefined = inbox/someday */
  due?: string | null
  /** 'HH:MM' optional time-of-day for one-off todos */
  time?: string
  /** present only when kind='recurring' */
  recurrence?: Recurrence
  createdAt: string
}

export interface Completion {
  taskId: string
  /** 'YYYY-MM-DD' — for one-offs we still record the day completed */
  date: string
  at: string
}

export interface Settings {
  activeTheme: string
  globalHotkey: string
  transparency: boolean
  defaultView: 'todo' | 'calendar' | 'notes'
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

export const DEFAULT_DATA: AppData = {
  version: 1,
  settings: {
    activeTheme: 'dark',
    globalHotkey: 'Alt+Space',
    transparency: false,
    defaultView: 'todo'
  },
  tasks: [],
  completions: []
}
