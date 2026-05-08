import { app, Notification } from 'electron'
import type { AppData, Completion, Task } from '../shared/types'
import { formatTimeRange } from '../shared/time'
import { todayISO } from '../shared/date'
import { matches, nextRecurringSlot } from '../shared/recurrence'
import { getWindow } from './window'

const timers = new Map<string, NodeJS.Timeout>()
let lastData: AppData | null = null

function clearTimers(opts: { keepSnoozes?: boolean } = {}) {
  for (const [key, t] of timers.entries()) {
    if (opts.keepSnoozes && key.startsWith('snooze:')) continue
    clearTimeout(t)
    timers.delete(key)
  }
}

function scheduleAt(key: string, fireAt: number, run: () => void) {
  const delay = fireAt - Date.now()
  if (delay <= 0) return
  // setTimeout's max delay is ~24.8 days. Cap to 24h so the daily reschedule
  // (triggered by the morning summary tick) always re-arms anything farther out.
  const capped = Math.min(delay, 24 * 60 * 60 * 1000)
  if (capped < delay) return
  const existing = timers.get(key)
  if (existing) clearTimeout(existing)
  const handle = setTimeout(() => {
    timers.delete(key)
    try { run() } catch {}
  }, capped)
  timers.set(key, handle)
}

function parseHM(hm: string | undefined): { h: number; m: number } | null {
  if (!hm) return null
  const [hStr, mStr] = hm.split(':')
  const h = Number(hStr)
  const m = Number(mStr)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  if (h < 0 || h > 23 || m < 0 || m > 59) return null
  return { h, m }
}

function dateAtLocal(iso: string, hm: string): number | null {
  const [y, mo, d] = iso.split('-').map(Number)
  const t = parseHM(hm)
  if (!t || !y || !mo || !d) return null
  return new Date(y, mo - 1, d, t.h, t.m, 0, 0).getTime()
}

function focusWindow() {
  const win = getWindow()
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

function isCompletedOnOrAfter(taskId: string, dateISO: string, completions: Completion[]): boolean {
  return completions.some(c => c.taskId === taskId && c.date >= dateISO)
}

function isCompletedOnDate(taskId: string, dateISO: string, completions: Completion[]): boolean {
  return completions.some(c => c.taskId === taskId && c.date === dateISO)
}

/**
 * Count items still requiring action: unchecked overdue one-off todos plus
 * recurring tasks whose `nextRecurringSlot` resolves to active overdue. Catch-up
 * completions ('overdue-completed') and today's obligations ('today') don't
 * count — they're not blocking anymore.
 */
function selectOverdueCount(data: AppData): number {
  const today = todayISO()
  let count = 0
  for (const t of data.tasks) {
    if (t.deletedAt) continue
    if (t.kind === 'todo') {
      if (!t.due || t.due >= today) continue
      if (data.completions.some(c => c.taskId === t.id)) continue
      count++
    } else if (t.kind === 'recurring') {
      const slot = nextRecurringSlot(t, data.completions, today)
      if (slot?.state === 'overdue') count++
    }
  }
  return count
}

function updateBadge(data: AppData) {
  if (process.platform !== 'darwin') return
  if (!app.dock) return
  if (!data.settings.notificationsEnabled) {
    app.dock.setBadge('')
    return
  }
  const count = selectOverdueCount(data)
  app.dock.setBadge(count > 0 ? String(count) : '')
}

function showTaskNotification(task: Task, body?: string) {
  const title = task.title?.trim() || (task.kind === 'note' ? 'note' : 'todo')
  const n = new Notification({
    title,
    body: body ?? '',
    silent: false,
    actions: [
      { type: 'button', text: 'Snooze 10m' },
      { type: 'button', text: 'Snooze 1h' }
    ]
  })
  n.on('click', () => focusWindow())
  n.on('action', (_event, index) => {
    const minutes = index === 0 ? 10 : 60
    const fireAt = Date.now() + minutes * 60 * 1000
    scheduleAt(`snooze:${task.id}:${fireAt}`, fireAt, () => showTaskNotification(task, body))
  })
  n.show()
}

function scheduleTodos(data: AppData) {
  const now = Date.now()
  const fmt = data.settings.clockFormat
  for (const t of data.tasks) {
    if (t.deletedAt) continue
    if (t.kind !== 'todo' || !t.due) continue
    if (isCompletedOnOrAfter(t.id, t.due, data.completions)) continue
    if (!t.time) continue
    const fireAt = dateAtLocal(t.due, t.time)
    if (fireAt == null || fireAt <= now) continue
    const body = formatTimeRange(t.time, t.endTime, fmt)
    scheduleAt(`todo:${t.id}`, fireAt, () => showTaskNotification(t, body))
  }
}

function scheduleRecurring(data: AppData) {
  const now = Date.now()
  const today = todayISO()
  const fmt = data.settings.clockFormat
  for (const t of data.tasks) {
    if (t.deletedAt) continue
    if (t.kind !== 'recurring') continue
    if (!t.recurrence?.start) continue
    if (!matches(t, today)) continue
    if (isCompletedOnDate(t.id, today, data.completions)) continue
    const fireAt = dateAtLocal(today, t.recurrence.start)
    if (fireAt == null || fireAt <= now) continue
    const body = formatTimeRange(t.recurrence.start, t.recurrence.end, fmt)
    scheduleAt(`recur:${t.id}:${today}`, fireAt, () => showTaskNotification(t, body))
  }
}

function scheduleMidnightTick() {
  // Re-plan at the start of the next local day so recurring tasks for the
  // new day get scheduled and the overdue badge stays current.
  const d = new Date()
  d.setHours(24, 0, 5, 0)
  scheduleAt('midnight', d.getTime(), () => {
    if (lastData) rescheduleAll(lastData)
  })
}

export function rescheduleAll(data: AppData) {
  lastData = data
  if (!data.settings.notificationsEnabled) {
    clearTimers()
    updateBadge(data)
    return
  }
  clearTimers({ keepSnoozes: true })
  scheduleTodos(data)
  scheduleRecurring(data)
  scheduleMidnightTick()
  updateBadge(data)
}

export function initNotifications(initialData: AppData) {
  rescheduleAll(initialData)
}

export function sendTestNotification() {
  const n = new Notification({
    title: 'inkcal',
    body: 'notifications are working.',
    silent: false
  })
  n.on('click', () => focusWindow())
  n.show()
}
