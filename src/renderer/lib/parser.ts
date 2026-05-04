import type { Task, Recurrence, Weekday } from '@/../shared/types'
import { addDays, todayISO, weekdayOf, fromISODate, diffDays, toISODate } from './date'
import { nanoid } from 'nanoid'
import * as chrono from 'chrono-node'

const DAY_PREFIXES: Record<string, Weekday> = {
  mon: 'mon', monday: 'mon',
  tue: 'tue', tuesday: 'tue', tues: 'tue',
  wed: 'wed', wednesday: 'wed',
  thu: 'thu', thursday: 'thu', thur: 'thu', thurs: 'thu',
  fri: 'fri', friday: 'fri',
  sat: 'sat', saturday: 'sat',
  sun: 'sun', sunday: 'sun'
}

const DAY_SHORT: Record<Weekday, string> = {
  mon: 'mon', tue: 'tue', wed: 'wed', thu: 'thu', fri: 'fri', sat: 'sat', sun: 'sun'
}

const MONTHS_SHORT = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^(\d{1,2}:\d{2})(?:-(\d{1,2}:\d{2}))?$/

function parseDayCombo(token: string): Weekday[] | null {
  // 'mwf', 'tth', 'mtwrf', 'mwfsa' etc — each char maps to one day
  const map: Record<string, Weekday> = {
    m: 'mon', t: 'tue', w: 'wed', r: 'thu', f: 'fri', s: 'sat', u: 'sun'
  }
  const out: Weekday[] = []
  for (const c of token.toLowerCase()) {
    const d = map[c]
    if (!d) return null
    if (!out.includes(d)) out.push(d)
  }
  return out.length ? out : null
}

function nextWeekday(target: Weekday): string {
  let cur = todayISO()
  for (let i = 1; i <= 7; i++) {
    const d = addDays(cur, i)
    if (weekdayOf(d) === target) return d
  }
  return cur
}

function pad2(s: string): string {
  const [h, m] = s.split(':')
  return `${h.padStart(2, '0')}:${m}`
}

function stripColon(token: string): string {
  return token.replace(/:$/, '')
}

function toHHMM(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

/**
 * Run chrono on input that follows a leading `!`. Requires the parsed date phrase
 * to start at index 0 — anything not matched by chrono becomes the title.
 */
export function parseChronoLeading(input: string): { schedule: ParsedSchedule; titleText: string } | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const results = chrono.parse(trimmed, new Date(), { forwardDate: true })
  if (results.length === 0) return null
  const r = results[0]
  if (r.index !== 0) return null
  const due = toISODate(r.start.date())
  const time = r.start.isCertain('hour') ? toHHMM(r.start.date()) : undefined
  const titleText = trimmed.slice(r.text.length).trim()
  return { schedule: { kind: 'todo', due, time }, titleText }
}

export type ParsedSchedule =
  | { kind: 'todo'; due: string | null; time?: string }
  | { kind: 'recurring'; recurrence: Recurrence }

interface SchedulePrefix {
  schedule: ParsedSchedule
  consumedTokens: number
}

/**
 * Tries to parse leading tokens as a schedule prefix.
 * Returns null if the first token doesn't look like a date/time/recurrence keyword.
 */
function tryParseSchedulePrefix(tokens: string[]): SchedulePrefix | null {
  if (tokens.length === 0) return null
  const first = tokens[0].toLowerCase()

  // recurring: 'daily'
  if (first === 'daily') {
    const rec: Recurrence = { daily: true }
    let consumed = 1
    consumed += consumeRecurringTime(tokens, consumed, rec)
    consumed += consumeRecurringMarker(tokens, consumed)
    return { schedule: { kind: 'recurring', recurrence: rec }, consumedTokens: consumed }
  }

  // recurring: dayCombo like 'mwf' (must be 2+ chars to avoid colliding with single weekday words like 'm')
  const combo = first.length >= 2 ? parseDayCombo(first) : null
  if (combo && !DAY_PREFIXES[first]) {
    const rec: Recurrence = { days: combo }
    let consumed = 1
    consumed += consumeRecurringTime(tokens, consumed, rec)
    consumed += consumeRecurringMarker(tokens, consumed)
    return { schedule: { kind: 'recurring', recurrence: rec }, consumedTokens: consumed }
  }

  // todo: today / tomorrow / weekday / ISO date — colon optional
  const cleanFirst = stripColon(first)
  let due: string | null | undefined
  if (cleanFirst === 'today') due = todayISO()
  else if (cleanFirst === 'tomorrow' || cleanFirst === 'tmrw') due = addDays(todayISO(), 1)
  else if (DAY_PREFIXES[cleanFirst]) due = nextWeekday(DAY_PREFIXES[cleanFirst])
  else if (ISO_RE.test(cleanFirst)) due = cleanFirst

  if (due !== undefined) {
    let consumed = 1
    let time: string | undefined
    const next = tokens[consumed]
    if (next) {
      const tm = TIME_RE.exec(stripColon(next))
      if (tm) {
        time = pad2(tm[1])
        consumed += 1
      }
    }
    return { schedule: { kind: 'todo', due, time }, consumedTokens: consumed }
  }

  return null
}

function consumeRecurringTime(tokens: string[], from: number, rec: Recurrence): number {
  const next = tokens[from]
  if (!next) return 0
  const tm = TIME_RE.exec(next)
  if (!tm) return 0
  rec.start = pad2(tm[1])
  if (tm[2]) rec.end = pad2(tm[2])
  return 1
}

function consumeRecurringMarker(tokens: string[], from: number): number {
  const t = tokens[from]?.toLowerCase()
  if (t === '*recurring' || t === 'recurring' || t === '*') return 1
  return 0
}

/**
 * Parses an input that is *only* a schedule (no title). Used by the Edit modal.
 * Returns null if the input is empty or unparseable as a schedule.
 *
 * Supports the `!` prefix for natural-language input via chrono. In schedule-only
 * mode the chrono match must consume the entire post-`!` input.
 */
export function parseSchedule(input: string): ParsedSchedule | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  if (trimmed.startsWith('!')) {
    const rest = trimmed.slice(1).trim()
    if (!rest) return null
    const r = parseChronoLeading(rest)
    if (!r) return null
    if (r.titleText !== '') return null
    return r.schedule
  }

  const tokens = trimmed.split(/\s+/)
  const prefix = tryParseSchedulePrefix(tokens)
  if (!prefix) return null
  // schedule-only mode: every token must be consumed
  if (prefix.consumedTokens !== tokens.length) return null
  return prefix.schedule
}

/**
 * Parses just a time or time-range like "10:00" or "10:00-11:00".
 * Used by the recurring-task editor where days are managed by toggle buttons.
 */
export function parseTimeRange(input: string): { start?: string; end?: string } | null {
  const trimmed = input.trim()
  if (!trimmed) return { start: undefined, end: undefined }
  const tokens = trimmed.split(/\s+/)
  if (tokens.length !== 1) return null
  const tm = TIME_RE.exec(tokens[0])
  if (!tm) return null
  const out: { start?: string; end?: string } = { start: pad2(tm[1]) }
  if (tm[2]) out.end = pad2(tm[2])
  return out
}

export interface ParseResult {
  task: Task
  /** the raw token consumed for the prefix, helpful for debugging */
  prefix?: string
}

/**
 * Parses inputs like:
 *   today: write report          (colon optional: "today write report" works too)
 *   fri: 331 hw3
 *   2026-05-12: pay rent
 *   mwf 10:00-11:00 *recurring lecture
 *   daily 08:00 *recurring stretch
 *   note: random thought about X
 *   !may 6 at noon doctor appt   (! routes through chrono natural-language parser)
 *   !next friday call mom
 *   write report                  (bare → inbox)
 */
export function parseCapture(input: string): ParseResult | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const now = new Date().toISOString()
  const baseTask = (overrides: Partial<Task>): Task => ({
    id: 'tk_' + nanoid(10),
    kind: 'todo',
    createdAt: now,
    ...overrides
  })

  // explicit kind: note
  if (/^note\s*:/i.test(trimmed)) {
    const body = trimmed.replace(/^note\s*:\s*/i, '')
    if (!body) return null
    return { task: baseTask({ kind: 'note', body }), prefix: 'note' }
  }

  // chrono natural-language path: leading "!"
  if (trimmed.startsWith('!')) {
    const rest = trimmed.slice(1).trim()
    if (!rest) return null
    const r = parseChronoLeading(rest)
    if (!r || !r.titleText) return null
    if (r.schedule.kind !== 'todo') return null
    return {
      task: baseTask({ title: r.titleText, due: r.schedule.due, time: r.schedule.time }),
      prefix: 'chrono'
    }
  }

  const tokens = trimmed.split(/\s+/)
  const prefix = tryParseSchedulePrefix(tokens)

  if (prefix) {
    const title = tokens.slice(prefix.consumedTokens).join(' ').trim()
    if (!title) return null
    if (prefix.schedule.kind === 'recurring') {
      return {
        task: baseTask({ kind: 'recurring', title, recurrence: prefix.schedule.recurrence }),
        prefix: 'recurring'
      }
    }
    return {
      task: baseTask({ title, due: prefix.schedule.due, time: prefix.schedule.time }),
      prefix: 'todo'
    }
  }

  // bare → inbox todo
  return { task: baseTask({ title: trimmed, due: null }), prefix: 'inbox' }
}

/**
 * Render a parsed schedule as a one-line preview for the editor.
 * Lowercase, terse — matches the app's house style (see fmtHeaderDate in date.ts).
 */
export function formatSchedule(p: ParsedSchedule | null): string {
  if (!p) return ''
  if (p.kind === 'todo') {
    const date = formatDuePreview(p.due)
    if (!p.time) return date
    return `${date}, ${p.time}`
  }
  const dayPart = formatDaysPreview(p.recurrence)
  const timePart = formatTimeRangePreview(p.recurrence)
  if (!timePart) return dayPart
  return `${dayPart}, ${timePart}`
}

function formatDuePreview(due: string | null): string {
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

function formatDaysPreview(rec: Recurrence): string {
  if (rec.daily) return 'daily'
  if (rec.days && rec.days.length > 0) return rec.days.map(d => DAY_SHORT[d]).join(' ')
  return 'no days'
}

function formatTimeRangePreview(rec: Recurrence): string {
  if (rec.start && rec.end) return `${rec.start}–${rec.end}`
  if (rec.start) return rec.start
  return ''
}

/**
 * Render a schedule back into editable text for the Edit modal.
 * Inverse of parseSchedule for round-tripping.
 */
export function scheduleToInput(p: ParsedSchedule | null): string {
  if (!p) return ''
  if (p.kind === 'todo') {
    if (!p.due) return ''
    const datePart = scheduleDateToken(p.due)
    return p.time ? `${datePart} ${p.time}` : datePart
  }
  // recurring (used only when caller wants the full thing; Edit recurring uses parseTimeRange separately)
  const days = p.recurrence.daily ? 'daily' : (p.recurrence.days ?? []).map(d => DAY_SHORT[d][0]).join('')
  const time = formatTimeRangePreview(p.recurrence).replace('–', '-')
  return time ? `${days} ${time}` : days
}

function scheduleDateToken(due: string): string {
  const today = todayISO()
  const d = diffDays(due, today)
  if (d === 0) return 'today'
  if (d === 1) return 'tomorrow'
  return due
}

/**
 * Build a time-range input string from a Recurrence's start/end.
 */
export function timeRangeToInput(rec: Recurrence | undefined): string {
  if (!rec) return ''
  if (rec.start && rec.end) return `${rec.start}-${rec.end}`
  if (rec.start) return rec.start
  return ''
}
