import type { Task, Recurrence, Weekday } from '@/../shared/types'
import { WEEKDAYS } from '@/../shared/types'
import { addDays, todayISO, weekdayOf, fromISODate, diffDays, toISODate } from './date'
import { nanoid } from 'nanoid'
import * as chrono from 'chrono-node'

const COMBO_LETTER: Record<Weekday, string> = {
  mon: 'm', tue: 't', wed: 'w', thu: 'r', fri: 'f', sat: 's', sun: 'u'
}

const COMBO_TO_DAY: Record<string, Weekday> = {
  m: 'mon', t: 'tue', w: 'wed', r: 'thu', f: 'fri', s: 'sat', u: 'sun'
}

const DAY_LONG: Record<Weekday, string> = {
  mon: 'monday', tue: 'tuesday', wed: 'wednesday', thu: 'thursday',
  fri: 'friday', sat: 'saturday', sun: 'sunday'
}

const DAY_WORD_TO_DAY: Record<string, Weekday> = {
  mon: 'mon', mons: 'mon', monday: 'mon', mondays: 'mon',
  tue: 'tue', tues: 'tue', tuesday: 'tue', tuesdays: 'tue',
  wed: 'wed', weds: 'wed', wednesday: 'wed', wednesdays: 'wed',
  thu: 'thu', thur: 'thu', thurs: 'thu', thursday: 'thu', thursdays: 'thu',
  fri: 'fri', fris: 'fri', friday: 'fri', fridays: 'fri',
  sat: 'sat', sats: 'sat', saturday: 'sat', saturdays: 'sat',
  sun: 'sun', suns: 'sun', sunday: 'sun', sundays: 'sun'
}

const PLURAL_DAY_WORDS = new Set([
  'mondays', 'tuesdays', 'wednesdays', 'thursdays', 'fridays', 'saturdays', 'sundays'
])

const WEEKDAYS_M_F: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri']
const WEEKEND_DAYS: Weekday[] = ['sat', 'sun']

const MONTHS_SHORT = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']

export interface ParseResult {
  task: Task
  prefix: 'note' | 'recurring' | 'chrono' | 'inbox'
}

export interface ScheduleParts {
  kind: 'recurring' | 'todo' | 'inbox'
  recurrence?: Recurrence
  due?: string | null
  time?: string
  endTime?: string
}

/**
 * Parse a user input into a Task. Order:
 *   1. note: …
 *   2. recurring patterns ("every friday at 10 yoga", "mwf 10-11 lecture", "daily stretch")
 *   3. chrono one-off ("may 6 doctor", "tomorrow at 2pm meeting")
 *   4. inbox (fallback: bare title with no schedule)
 */
export function parse(input: string): ParseResult | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const now = new Date().toISOString()
  const baseTask = (overrides: Partial<Task>): Task => ({
    id: 'tk_' + nanoid(10),
    kind: 'todo',
    createdAt: now,
    ...overrides
  })

  if (/^note\s*:/i.test(trimmed)) {
    const body = trimmed.replace(/^note\s*:\s*/i, '').trim()
    if (!body) return null
    return { task: baseTask({ kind: 'note', body }), prefix: 'note' }
  }

  const rec = tryRecurringWithTitle(trimmed)
  if (rec) {
    return {
      task: baseTask({ kind: 'recurring', title: rec.title, recurrence: rec.recurrence }),
      prefix: 'recurring'
    }
  }

  const ch = tryChronoWithTitle(trimmed)
  if (ch && ch.title) {
    return {
      task: baseTask({ title: ch.title, due: ch.due, time: ch.time, endTime: ch.endTime }),
      prefix: 'chrono'
    }
  }

  return { task: baseTask({ title: trimmed, due: null }), prefix: 'inbox' }
}

/**
 * Parse just a schedule (no title required), used by the Edit modal where
 * the title lives in its own field. Empty input → inbox (no schedule).
 */
export function parseScheduleOnly(input: string): ScheduleParts | null {
  const trimmed = input.trim()
  if (!trimmed) return { kind: 'inbox' }

  const rec = tryRecurring(trimmed, false)
  if (rec) return { kind: 'recurring', recurrence: rec.recurrence }

  const ch = tryChrono(trimmed, false)
  if (ch) return { kind: 'todo', due: ch.due, time: ch.time, endTime: ch.endTime }

  return null
}

/**
 * Render a Task back to the canonical input string so the Edit modal can
 * round-trip it through the parser. Inverse of parse() for parseable shapes.
 */
export function taskToInput(task: Task): string {
  if (task.kind === 'note') return `note: ${task.body ?? ''}`.trim()
  if (task.kind === 'recurring') {
    const r = task.recurrence
    if (!r) return task.title ?? ''
    const days = recurringDayInput(r)
    const time = recurringTimeInput(r)
    return [days, time, task.title].filter(Boolean).join(' ').trim()
  }
  const date = task.due ? todoDateInput(task.due) : ''
  const time = task.time
    ? (task.endTime ? `${task.time}-${task.endTime}` : task.time)
    : ''
  return [date, time, task.title].filter(Boolean).join(' ').trim()
}

/**
 * Render just the schedule portion of a task (for the Edit modal's `when` field).
 */
export function scheduleOnlyToInput(task: Task): string {
  if (task.kind === 'note') return ''
  if (task.kind === 'recurring') {
    const r = task.recurrence
    if (!r) return ''
    const days = recurringDayInput(r)
    const time = recurringTimeInput(r)
    return [days, time].filter(Boolean).join(' ').trim()
  }
  if (!task.due) return ''
  const date = todoDateInput(task.due)
  const time = task.time
    ? (task.endTime ? `${task.time}-${task.endTime}` : task.time)
    : ''
  return [date, time].filter(Boolean).join(' ').trim()
}

/**
 * Short live-preview hint for ScheduleInput.
 */
export function previewFor(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''

  if (/^note\s*:/i.test(trimmed)) {
    const body = trimmed.replace(/^note\s*:\s*/i, '').trim()
    return body ? `note · ${body}` : 'note'
  }

  const rec = tryRecurring(trimmed, false)
  if (rec) {
    const parts = [recurrencePreview(rec.recurrence), rec.title].filter(Boolean)
    return parts.length ? parts.join(' · ') : ''
  }

  const ch = tryChrono(trimmed, false)
  if (ch) {
    const sched = [duePreview(ch.due), timePreview(ch.time, ch.endTime)].filter(Boolean).join(' · ')
    return ch.title ? `${sched} · ${ch.title}` : sched
  }

  return `inbox · ${trimmed}`
}

/**
 * Schedule-only preview for the Edit modal's `when` field.
 */
export function previewSchedule(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''
  const result = parseScheduleOnly(trimmed)
  if (!result) return ''
  if (result.kind === 'recurring' && result.recurrence) {
    return recurrencePreview(result.recurrence)
  }
  if (result.kind === 'todo') {
    return [duePreview(result.due), timePreview(result.time, result.endTime)].filter(Boolean).join(' · ')
  }
  return ''
}

/**
 * Compact day-badge for the right side of TaskRow (e.g. "mwf", "daily").
 */
export function recurrenceShort(rec: Recurrence | undefined): string {
  if (!rec) return ''
  if (rec.daily) return 'daily'
  if (rec.days?.length) return rec.days.map(d => COMBO_LETTER[d]).join('')
  return ''
}

function tryRecurringWithTitle(input: string): { recurrence: Recurrence; title: string } | null {
  const r = tryRecurring(input, true)
  if (!r || !r.title) return null
  return r
}

interface RecurringMatch {
  recurrence: Recurrence
  title: string
}

function tryRecurring(rawInput: string, requireTitle: boolean): RecurringMatch | null {
  const input = expandTomorrowShortcut(rawInput)
  // "every other" / "every N weeks" aren't supported. the Recurrence model has no interval field.
  if (/^every\s+other\b/i.test(input)) return null

  let m = /^(?:every\s+day|daily)\b/i.exec(input)
  if (m) return finishRecurring(input, m[0].length, { daily: true }, requireTitle)

  m = /^weekly\b/i.exec(input)
  if (m) return finishRecurring(input, m[0].length, { days: [weekdayOf(todayISO())] }, requireTitle)

  m = /^(?:every\s+weekdays?|weekdays?)\b/i.exec(input)
  if (m) return finishRecurring(input, m[0].length, { days: [...WEEKDAYS_M_F] }, requireTitle)

  m = /^(?:every\s+weekends?|weekends?)\b/i.exec(input)
  if (m) return finishRecurring(input, m[0].length, { days: [...WEEKEND_DAYS] }, requireTitle)

  m = /^every\s+/i.exec(input)
  if (m) {
    const after = input.slice(m[0].length)
    const list = consumeDayList(after, false)
    if (list && list.days.length > 0) {
      return finishRecurring(input, m[0].length + list.consumed, { days: list.days }, requireTitle)
    }
    const combo = tryCombo(after, true)
    if (combo) {
      return finishRecurring(input, m[0].length + combo.consumed, { days: combo.days }, requireTitle)
    }
    return null
  }

  const list = consumeDayList(input, true)
  if (list && list.days.length > 0) {
    return finishRecurring(input, list.consumed, { days: list.days }, requireTitle)
  }

  const combo = tryCombo(input, false)
  if (combo) {
    return finishRecurring(input, combo.consumed, { days: combo.days }, requireTitle)
  }

  return null
}

function tryCombo(s: string, allowSingle: boolean): { days: Weekday[]; consumed: number } | null {
  const re = allowSingle
    ? /^([mtwrfsu]+)(?=\s|$)/i
    : /^([mtwrfsu]{2,})(?=\s|$)/i
  const m = re.exec(s)
  if (!m) return null
  const word = m[1].toLowerCase()
  // "wed" → Wednesday, not the combo wed-d.
  if (DAY_WORD_TO_DAY[word]) return null
  const days: Weekday[] = []
  for (const c of word) {
    const d = COMBO_TO_DAY[c]
    if (d && !days.includes(d)) days.push(d)
  }
  if (days.length === 0) return null
  return { days, consumed: m[0].length }
}

function finishRecurring(
  input: string,
  consumed: number,
  rec: Recurrence,
  requireTitle: boolean
): RecurringMatch | null {
  const rest = input.slice(consumed).replace(/^\s+/, '')
  const tm = consumeTimeFromStart(rest)
  const afterTime = tm ? rest.slice(tm.consumed).replace(/^\s+/, '') : rest
  const title = afterTime.trim()
  if (requireTitle && !title) return null
  if (tm) {
    if (tm.start) rec.start = tm.start
    if (tm.end) rec.end = tm.end
  }
  if (rec.start && rec.end && rec.end <= rec.start) return null
  return { recurrence: rec, title }
}

function consumeDayList(s: string, requirePlural: boolean): { days: Weekday[]; consumed: number } | null {
  // Plural requirement disambiguates "mon, wed, fri" (recurring list) from
  // "monday call mom" (one-off that chrono should handle).
  const first = peekDayWord(s, 0)
  if (!first) return null

  if (requirePlural && !PLURAL_DAY_WORDS.has(first.word)) {
    const after = s.slice(first.length)
    if (!/^(?:\s*[,/]\s*|\s+and\s+)/.test(after)) return null
  }

  const days: Weekday[] = [first.day]
  let i = first.length

  while (true) {
    const sepMatch = /^(?:\s*[,/]\s*|\s+and\s+|\s+)/.exec(s.slice(i))
    if (!sepMatch) break
    const next = peekDayWord(s, i + sepMatch[0].length)
    if (!next) break
    i += sepMatch[0].length + next.length
    if (!days.includes(next.day)) days.push(next.day)
  }

  return { days, consumed: i }
}

function peekDayWord(s: string, from: number): { day: Weekday; word: string; length: number } | null {
  const slice = s.slice(from)
  const m = /^([a-z]+)(?=\s|[,/]|$)/i.exec(slice)
  if (!m) return null
  const word = m[1].toLowerCase()
  const day = DAY_WORD_TO_DAY[word]
  if (!day) return null
  return { day, word, length: m[0].length }
}

const TIME_AT_BARE = `(?:noon|midnight|\\d{1,2}:\\d{2}(?:\\s*[ap]m)?|\\d{1,2}\\s*[ap]m|\\d{1,2})`
// Bare times must be unambiguous (colon, am/pm, or noon/midnight). a leading
// `at` lets us accept lone digits like "at 10".
const TIME_STRICT = `(?:noon|midnight|\\d{1,2}:\\d{2}(?:\\s*[ap]m)?|\\d{1,2}\\s*[ap]m)`

function consumeTimeFromStart(s: string): { start: string; end?: string; consumed: number } | null {
  let re = new RegExp(`^at\\s+(${TIME_AT_BARE})(?:\\s*(?:-|–|to)\\s*(${TIME_AT_BARE}))?(?=\\s|$)`, 'i')
  let m = re.exec(s)
  if (m) {
    const start = parseTimeWord(m[1])
    if (start) {
      const end = m[2] ? parseTimeWord(m[2]) : null
      return { start, end: end ?? undefined, consumed: m[0].length }
    }
  }

  re = new RegExp(`^from\\s+(${TIME_AT_BARE})\\s+to\\s+(${TIME_AT_BARE})(?=\\s|$)`, 'i')
  m = re.exec(s)
  if (m) {
    const start = parseTimeWord(m[1])
    const end = parseTimeWord(m[2])
    if (start && end) return { start, end, consumed: m[0].length }
  }

  re = new RegExp(`^(${TIME_STRICT})(?:\\s*(?:-|–|to)\\s*(${TIME_STRICT}))?(?=\\s|$)`, 'i')
  m = re.exec(s)
  if (m) {
    const start = parseTimeWord(m[1])
    if (start) {
      const end = m[2] ? parseTimeWord(m[2]) : null
      return { start, end: end ?? undefined, consumed: m[0].length }
    }
  }

  return null
}

function parseTimeWord(w: string): string | null {
  const s = w.trim().toLowerCase()
  if (s === 'noon') return '12:00'
  if (s === 'midnight') return '00:00'
  let m = /^(\d{1,2}):(\d{2})\s*(am|pm)?$/.exec(s)
  if (m) {
    let h = parseInt(m[1], 10)
    const min = parseInt(m[2], 10)
    if (h > 23 || min > 59) return null
    if (m[3] === 'pm' && h < 12) h += 12
    if (m[3] === 'am' && h === 12) h = 0
    return `${pad2(h)}:${pad2(min)}`
  }
  m = /^(\d{1,2})\s*(am|pm)$/.exec(s)
  if (m) {
    let h = parseInt(m[1], 10)
    if (h > 23) return null
    if (m[2] === 'pm' && h < 12) h += 12
    if (m[2] === 'am' && h === 12) h = 0
    return `${pad2(h)}:00`
  }
  m = /^(\d{1,2})$/.exec(s)
  if (m) {
    const h = parseInt(m[1], 10)
    if (h > 23) return null
    return `${pad2(h)}:00`
  }
  return null
}

function pad2(n: number | string): string {
  return String(n).padStart(2, '0')
}

interface ChronoMatch {
  due: string
  time?: string
  endTime?: string
  title: string
}

function tryChronoWithTitle(input: string): ChronoMatch | null {
  return tryChrono(input, true)
}

const SINGLE_LETTER_DAY_LONG: Record<string, string> = {
  m: 'monday', t: 'tuesday', w: 'wednesday', r: 'thursday',
  f: 'friday', s: 'saturday', u: 'sunday'
}

function expandLeadingDayShortcut(input: string): string {
  const m = /^([mtwrfsu])\s+/i.exec(input)
  if (!m) return input
  const long = SINGLE_LETTER_DAY_LONG[m[1].toLowerCase()]
  return long + ' ' + input.slice(m[0].length)
}

function expandTomorrowShortcut(input: string): string {
  return input.replace(/\btmr\b/gi, 'tomorrow')
}

function tryChrono(input: string, requireTitle: boolean): ChronoMatch | null {
  const expanded = expandTomorrowShortcut(expandLeadingDayShortcut(input))
  const results = chrono.parse(expanded, new Date(), { forwardDate: true })
  if (results.length === 0) return null
  const r = results[0]
  // Reject time-only matches. chrono returns those, but a one-off needs a date.
  const hasDate =
    r.start.isCertain('day') ||
    r.start.isCertain('weekday') ||
    r.start.isCertain('month') ||
    r.start.isCertain('year')
  if (!hasDate) return null
  const due = toISODate(r.start.date())
  const time = r.start.isCertain('hour') ? toHHMM(r.start.date()) : undefined
  const endTime = r.end && r.end.isCertain('hour') ? toHHMM(r.end.date()) : undefined
  const before = expanded.slice(0, r.index)
  const after = expanded.slice(r.index + r.text.length)
  const title = (before + ' ' + after).replace(/\s+/g, ' ').trim()
  if (requireTitle && !title) return null
  return { due, time, endTime, title }
}

function toHHMM(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function recurringDayInput(r: Recurrence): string {
  if (r.daily) return 'daily'
  if (!r.days || r.days.length === 0) return ''
  const sorted = [...r.days].sort((a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b))
  if (eqDays(sorted, WEEKDAYS_M_F)) return 'every weekday'
  if (eqDays(sorted, WEEKEND_DAYS)) return 'every weekend'
  // Plural form for round-tripping: combos need 2+ letters, so a single-letter
  // combo (e.g. "f") wouldn't re-parse as recurring.
  if (sorted.length === 1) return `${DAY_LONG[sorted[0]]}s`
  return sorted.map(w => COMBO_LETTER[w]).join('')
}

function recurringTimeInput(r: Recurrence): string {
  if (!r.start) return ''
  if (r.end) return `${r.start}-${r.end}`
  return r.start
}

function todoDateInput(due: string): string {
  const today = todayISO()
  const d = diffDays(due, today)
  if (d === 0) return 'today'
  if (d === 1) return 'tomorrow'
  return due
}

function eqDays(a: Weekday[], b: Weekday[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

function recurrencePreview(r: Recurrence): string {
  const days = r.daily ? 'day' : recurrenceShort(r)
  const time = timePreview(r.start, r.end)
  const sched = days ? `every ${days}` : ''
  return [sched, time].filter(Boolean).join(' · ')
}

function timePreview(start?: string, end?: string): string {
  if (!start) return ''
  if (end) return `${start}–${end}`
  return start
}

function duePreview(due: string | null | undefined): string {
  if (!due) return 'no date'
  const today = todayISO()
  const d = diffDays(due, today)
  if (d === 0) return 'today'
  if (d === 1) return 'tomorrow'
  if (d === -1) return 'yesterday'
  if (d > 1 && d <= 6) return weekdayOf(due)
  const date = fromISODate(due)
  const m = MONTHS_SHORT[date.getMonth()]
  const day = date.getDate()
  if (date.getFullYear() === new Date().getFullYear()) return `${m} ${day}`
  return `${m} ${day} ${date.getFullYear()}`
}
