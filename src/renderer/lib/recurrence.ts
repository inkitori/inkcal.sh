import type { Completion, Task } from '@/../shared/types'
import { addDays, weekdayOf } from './date'

export interface Instance {
  task: Task
  date: string
  isCompleted: boolean
}

export interface OverdueRecurring {
  task: Task
  /** ISO date of the most recent expected occurrence that wasn't completed */
  lastExpected: string
  /** ISO date of the most recent completion (any date), or null if never completed */
  lastCompleted: string | null
}

function matches(task: Task, dateISO: string): boolean {
  if (task.kind !== 'recurring' || !task.recurrence) return false
  const r = task.recurrence
  // days takes precedence per the type doc
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
  // stable sort by start time, undefined times last
  out.sort((a, b) => {
    const at = a.task.recurrence?.start ?? '99:99'
    const bt = b.task.recurrence?.start ?? '99:99'
    return at.localeCompare(bt)
  })
  return out
}

export function isCompleted(completions: Completion[], taskId: string, dateISO: string): boolean {
  return completions.some(c => c.taskId === taskId && c.date === dateISO)
}

/**
 * Walks back up to 7 days from yesterday and returns the most recent date
 * (strictly before today) on which `task` was scheduled to occur. Returns null
 * if no scheduled occurrence falls within the lookback window.
 */
export function lastExpectedOccurrence(task: Task, todayISO: string): string | null {
  if (task.kind !== 'recurring' || !task.recurrence) return null
  for (let i = 1; i <= 7; i++) {
    const d = addDays(todayISO, -i)
    if (matches(task, d)) return d
  }
  return null
}

/**
 * Returns one entry per recurring task whose most recent expected occurrence
 * was missed AND that hasn't been completed today. Never stacks — at most one
 * entry per task.
 */
export function selectOverdueRecurring(
  tasks: Task[],
  completions: Completion[],
  todayISO: string
): OverdueRecurring[] {
  const out: OverdueRecurring[] = []
  for (const t of tasks) {
    if (t.kind !== 'recurring') continue
    const lastExpected = lastExpectedOccurrence(t, todayISO)
    if (!lastExpected) continue

    const taskCompletions = completions.filter(c => c.taskId === t.id)
    const completedOnExpected = taskCompletions.some(c => c.date === lastExpected)
    if (completedOnExpected) continue
    const completedToday = taskCompletions.some(c => c.date === todayISO)
    if (completedToday) continue

    const sortedCompletions = taskCompletions
      .map(c => c.date)
      .sort((a, b) => b.localeCompare(a))
    const lastCompleted = sortedCompletions[0] ?? null
    out.push({ task: t, lastExpected, lastCompleted })
  }
  out.sort((a, b) => a.lastExpected.localeCompare(b.lastExpected))
  return out
}
