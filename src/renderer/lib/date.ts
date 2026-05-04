import type { Weekday } from '@/../shared/types'

const WEEKDAY_BY_INDEX: Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

export function todayISO(): string {
  return toISODate(new Date())
}

export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function weekdayOf(iso: string): Weekday {
  return WEEKDAY_BY_INDEX[fromISODate(iso).getDay()]
}

export function addDays(iso: string, n: number): string {
  const d = fromISODate(iso)
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

export function startOfWeek(iso: string, weekStartsOn: number = 1): string {
  // 1 = Monday
  const d = fromISODate(iso)
  const day = d.getDay()
  const diff = (day - weekStartsOn + 7) % 7
  d.setDate(d.getDate() - diff)
  return toISODate(d)
}

export function weekDates(iso: string): string[] {
  const start = startOfWeek(iso)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

export function isBefore(a: string, b: string): boolean {
  return a < b
}

export function isToday(iso: string): boolean {
  return iso === todayISO()
}

export function fmtTimeOfDay(hhmm: string | undefined): string {
  if (!hhmm) return ''
  return hhmm
}

export function diffDays(aISO: string, bISO: string): number {
  const a = fromISODate(aISO).getTime()
  const b = fromISODate(bISO).getTime()
  return Math.round((a - b) / 86400000)
}

export function dueLabel(due: string | null | undefined): string | null {
  if (!due) return null
  const today = todayISO()
  const d = diffDays(due, today)
  if (d === 0) return 'today'
  if (d === 1) return 'tomorrow'
  if (d === -1) return 'yesterday'
  if (d > 1 && d <= 7) {
    const wd = weekdayOf(due)
    return wd
  }
  if (d < 0) return `${-d}d overdue`
  if (d <= 30) return `${d}d`
  return due
}

export function fmtHour(h: number): string {
  return `${String(h).padStart(2, '0')}:00`
}

export function dayProgressPct(now: Date = new Date()): number {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).getTime()
  const end = start + 86400000
  return Math.min(100, Math.max(0, ((now.getTime() - start) / (end - start)) * 100))
}

export function fmtHeaderDate(now: Date = new Date()): string {
  const wd = WEEKDAY_BY_INDEX[now.getDay()]
  const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
  const m = months[now.getMonth()]
  return `${wd} ${m} ${now.getDate()}`
}

export function fmtClock(now: Date = new Date()): string {
  const h = String(now.getHours()).padStart(2, '0')
  const m = String(now.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}
