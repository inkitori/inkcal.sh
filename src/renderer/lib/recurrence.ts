import type { Completion, Task } from '@/../shared/types'
import { addDays, weekdayOf } from './date'

export interface Instance {
  task: Task
  date: string
  isCompleted: boolean
}

/**
 * The single visible row a recurring task occupies in the todo list. Every
 * recurring task resolves to exactly one slot (or null if its rule never
 * matches in the lookahead window):
 *
 * - 'completed-today' when today is scheduled and done, or there's a
 *   completion today with no recent missed day. Renders sunk in Today.
 * - 'overdue-completed' when a completion exists today AND today isn't
 *   scheduled AND there's a recent missed scheduled day — the catch-up
 *   case. Renders sunk in Overdue.
 * - 'overdue' when the most recent scheduled day in the lookback window
 *   was missed and there's no completion today.
 * - 'today' when today is scheduled and not completed.
 * - 'upcoming' when the next match is strictly after today.
 *
 * Completion of any date acts as a checkpoint: the next call walks forward
 * from `lastCompletion + 1`, which silently retires older missed days.
 */
export type RecurringSlot =
  | { state: 'completed-today'; date: string }
  | { state: 'overdue-completed'; date: string; lastCompleted: string | null }
  | { state: 'overdue'; date: string; lastCompleted: string | null }
  | { state: 'today'; date: string }
  | { state: 'upcoming'; date: string }

const LOOKBACK_DAYS = 7
const LOOKAHEAD_DAYS = 60

export function matches(task: Task, dateISO: string): boolean {
  if (task.kind !== 'recurring' || !task.recurrence) return false
  const r = task.recurrence
  if (r.days?.length) {
    const wd = weekdayOf(dateISO)
    return r.days.includes(wd)
  }
  if (r.daily) return true
  return false
}

export function instancesForDate(
  tasks: Task[],
  completions: Completion[],
  dateISO: string
): Instance[] {
  const completedSet = new Set(
    completions.filter(c => c.date === dateISO).map(c => c.taskId)
  )
  const out: Instance[] = []
  for (const t of tasks) {
    if (matches(t, dateISO)) {
      out.push({ task: t, date: dateISO, isCompleted: completedSet.has(t.id) })
    }
  }
  out.sort((a, b) => {
    const at = a.task.recurrence?.start ?? '99:99'
    const bt = b.task.recurrence?.start ?? '99:99'
    return at.localeCompare(bt)
  })
  return out
}

export function nextRecurringSlot(
  task: Task,
  completions: Completion[],
  todayISO: string
): RecurringSlot | null {
  if (task.kind !== 'recurring' || !task.recurrence) return null

  const taskComps = completions.filter(c => c.taskId === task.id)
  const completedToday = taskComps.some(c => c.date === todayISO)
  const todayMatches = matches(task, todayISO)

  // Today is scheduled and done — sink in Today.
  if (completedToday && todayMatches) {
    return { state: 'completed-today', date: todayISO }
  }

  const completedSet = new Set(taskComps.map(c => c.date))
  // When today's completion is a catch-up (today isn't scheduled), exclude it
  // from the checkpoint so the lookback can still surface the missed day it
  // satisfied. Otherwise it would block its own lookup.
  const checkpointDates = (completedToday && !todayMatches
    ? taskComps.filter(c => c.date !== todayISO)
    : taskComps
  ).map(c => c.date).sort()
  const lastCompleted = checkpointDates[checkpointDates.length - 1] ?? null
  const createdDate = task.createdAt.slice(0, 10)

  // Walk back from today to find the most recent missed scheduled day.
  // Bounded by lookback window, task creation date, and (crucially) the last
  // completion: any completion acts as a checkpoint that retires older misses.
  for (let i = 0; i <= LOOKBACK_DAYS; i++) {
    const d = addDays(todayISO, -i)
    if (d < createdDate) break
    if (lastCompleted && d <= lastCompleted) break
    if (!matches(task, d)) continue
    if (completedSet.has(d)) continue
    if (d === todayISO) return { state: 'today', date: d }
    if (completedToday) return { state: 'overdue-completed', date: d, lastCompleted }
    return { state: 'overdue', date: d, lastCompleted }
  }

  // No missed day in window — an off-schedule completion sinks in Today.
  if (completedToday) return { state: 'completed-today', date: todayISO }

  // Find the next future occurrence.
  for (let i = 1; i <= LOOKAHEAD_DAYS; i++) {
    const d = addDays(todayISO, i)
    if (matches(task, d)) return { state: 'upcoming', date: d }
  }
  return null
}
