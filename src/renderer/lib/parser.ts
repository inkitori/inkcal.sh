import type { Task, Recurrence, Weekday } from '@/../shared/types'
import { addDays, todayISO, weekdayOf } from './date'
import { nanoid } from 'nanoid'

const DAY_PREFIXES: Record<string, Weekday> = {
  mon: 'mon', monday: 'mon',
  tue: 'tue', tuesday: 'tue', tues: 'tue',
  wed: 'wed', wednesday: 'wed',
  thu: 'thu', thursday: 'thu', thur: 'thu', thurs: 'thu',
  fri: 'fri', friday: 'fri',
  sat: 'sat', saturday: 'sat',
  sun: 'sun', sunday: 'sun'
}

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

export interface ParseResult {
  task: Task
  /** the raw token consumed for the prefix, helpful for debugging */
  prefix?: string
}

/**
 * Parses inputs like:
 *   today: write report
 *   fri: 331 hw3
 *   2026-05-12: pay rent
 *   mwf 10:00-11:00 *recurring lecture
 *   daily 08:00 *recurring take meds
 *   someday: pick up lexapro
 *   note: random thought about X
 *   write report                       (bare → inbox)
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

  // someday
  if (/^someday\s*:/i.test(trimmed)) {
    const title = trimmed.replace(/^someday\s*:\s*/i, '')
    if (!title) return null
    return { task: baseTask({ title, due: null }), prefix: 'someday' }
  }

  // try recurring grammar first: "<dayspec> [HH:MM[-HH:MM]] [*recurring] title"
  // dayspec: 'daily' | 'mwf' | 'mon,wed,fri' | weekday combos
  const tokens = trimmed.split(/\s+/)
  let i = 0
  let recurrence: Recurrence | null = null
  let consumed = 0

  // dayspec
  const first = tokens[0]?.toLowerCase()
  if (first === 'daily') {
    recurrence = { daily: true }
    consumed = 1
  } else if (first && DAY_PREFIXES[first.replace(/[,;]+$/, '')]) {
    // single weekday word like "mon" — but only treat as recurring if followed by time + *recurring/recurring marker.
    // Otherwise this is interpreted as "<weekday>: title" via the colon path below.
  } else if (first) {
    const combo = parseDayCombo(first)
    if (combo && first.length >= 2) {
      recurrence = { days: combo }
      consumed = 1
    }
  }

  if (recurrence) {
    // optional time
    const next = tokens[consumed]
    const tm = next && TIME_RE.exec(next)
    if (tm) {
      recurrence.start = pad2(tm[1])
      if (tm[2]) recurrence.end = pad2(tm[2])
      consumed += 1
    }
    // optional *recurring marker
    if (tokens[consumed]?.toLowerCase() === '*recurring' || tokens[consumed]?.toLowerCase() === 'recurring' || tokens[consumed] === '*') {
      consumed += 1
    }
    const title = tokens.slice(consumed).join(' ').trim()
    if (!title) return null
    return { task: baseTask({ kind: 'recurring', title, recurrence }), prefix: 'recurring' }
  }

  // colon-prefix paths: today:/tomorrow:/<weekday>:/<ISO>:
  const colonMatch = /^([a-z0-9-]+)\s*:\s*(.+)$/i.exec(trimmed)
  if (colonMatch) {
    const prefix = colonMatch[1].toLowerCase()
    const rest = colonMatch[2].trim()
    if (!rest) return null

    let due: string | null = null
    if (prefix === 'today') due = todayISO()
    else if (prefix === 'tomorrow' || prefix === 'tmrw') due = addDays(todayISO(), 1)
    else if (DAY_PREFIXES[prefix]) due = nextWeekday(DAY_PREFIXES[prefix])
    else if (ISO_RE.test(prefix)) due = prefix
    else return null

    // optional inline time at start of rest: "10:00 title"
    const restTokens = rest.split(/\s+/)
    let time: string | undefined
    const tm = TIME_RE.exec(restTokens[0])
    if (tm) {
      time = pad2(tm[1])
      restTokens.shift()
    }
    const title = restTokens.join(' ').trim()
    if (!title) return null
    return { task: baseTask({ title, due, time }), prefix }
  }

  // bare → inbox todo
  return { task: baseTask({ title: trimmed, due: null }), prefix: 'inbox' }
}
