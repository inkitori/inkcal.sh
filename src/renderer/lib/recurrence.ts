import type { Completion, Task } from '@/../shared/types'
import { weekdayOf } from './date'

export interface Instance {
  task: Task
  date: string
  isCompleted: boolean
}

function matches(task: Task, dateISO: string): boolean {
  if (task.kind !== 'recurring' || !task.recurrence) return false
  const r = task.recurrence
  if (r.daily) return true
  if (r.days?.length) {
    const wd = weekdayOf(dateISO)
    return r.days.includes(wd)
  }
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
