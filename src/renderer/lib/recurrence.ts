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

export function matches(task: Task, dateISO: string): boolean {
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
 * was missed, today is NOT a scheduled day, and the task hasn't been completed
 * today. Tasks scheduled for today never appear here — they go through
 * `selectMissedScheduledToday` instead so the row can sit in today's section
 * with a "missed last X" chip.
 */
export function selectOverdueRecurring(
  tasks: Task[],
  completions: Completion[],
  todayISO: string
): OverdueRecurring[] {
  const out: OverdueRecurring[] = []
  for (const t of tasks) {
    if (t.kind !== 'recurring') continue
    if (matches(t, todayISO)) continue
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

/**
 * Recurring tasks that ARE scheduled today and missed their last expected
 * occurrence. Used to render a "missed last X" chip on today's row without
 * pushing the task into the overdue section.
 */
export function selectMissedScheduledToday(
  tasks: Task[],
  completions: Completion[],
  todayISO: string
): OverdueRecurring[] {
  const out: OverdueRecurring[] = []
  for (const t of tasks) {
    if (t.kind !== 'recurring') continue
    if (!matches(t, todayISO)) continue
    const lastExpected = lastExpectedOccurrence(t, todayISO)
    if (!lastExpected) continue

    const taskCompletions = completions.filter(c => c.taskId === t.id)
    if (taskCompletions.some(c => c.date === lastExpected)) continue
    if (taskCompletions.some(c => c.date === todayISO)) continue

    const sortedCompletions = taskCompletions
      .map(c => c.date)
      .sort((a, b) => b.localeCompare(a))
    const lastCompleted = sortedCompletions[0] ?? null
    out.push({ task: t, lastExpected, lastCompleted })
  }
  return out
}

/**
 * Recurring tasks that have a completion for today even though today is NOT a
 * scheduled day. Used to surface "catch-up" rows in today's section so that
 * completing an off-schedule recurring puts it somewhere predictable, rather
 * than leaving the row in the off-schedule recurring section uncheckable.
 */
export function selectCatchUpRecurring(
  tasks: Task[],
  completions: Completion[],
  todayISO: string
): Task[] {
  const out: Task[] = []
  for (const t of tasks) {
    if (t.kind !== 'recurring') continue
    if (matches(t, todayISO)) continue
    if (!completions.some(c => c.taskId === t.id && c.date === todayISO)) continue
    out.push(t)
  }
  out.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''))
  return out
}
