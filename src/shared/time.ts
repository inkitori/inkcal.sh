export type ClockFormat = '12h' | '24h'

function parseHHMM(hhmm: string): { h: number; m: number } | null {
  const [hStr, mStr] = hhmm.split(':')
  const h = Number(hStr)
  const m = Number(mStr)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  if (h < 0 || h > 23 || m < 0 || m > 59) return null
  return { h, m }
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function to12h(h: number): { h12: number; suffix: 'AM' | 'PM' } {
  const suffix: 'AM' | 'PM' = h < 12 ? 'AM' : 'PM'
  let h12 = h % 12
  if (h12 === 0) h12 = 12
  return { h12, suffix }
}

/** Format a stored "HH:MM" (24h) for display. */
export function formatTime(hhmm: string, fmt: ClockFormat): string {
  if (fmt === '24h') return hhmm
  const t = parseHHMM(hhmm)
  if (!t) return hhmm
  const { h12, suffix } = to12h(t.h)
  return `${h12}:${pad2(t.m)} ${suffix}`
}

/** Format an open-ended or closed time range. End may be undefined. */
export function formatTimeRange(start: string, end: string | undefined, fmt: ClockFormat): string {
  if (!end) return formatTime(start, fmt)
  if (fmt === '24h') return `${start}–${end}`
  // 12h: drop the AM/PM on the start when both ends share the same period (e.g. "2:00–3:30 PM").
  const s = parseHHMM(start)
  const e = parseHHMM(end)
  if (!s || !e) return `${formatTime(start, fmt)}–${formatTime(end, fmt)}`
  const sP = to12h(s.h)
  const eP = to12h(e.h)
  if (sP.suffix === eP.suffix) {
    return `${sP.h12}:${pad2(s.m)}–${eP.h12}:${pad2(e.m)} ${eP.suffix}`
  }
  return `${formatTime(start, fmt)}–${formatTime(end, fmt)}`
}

/** Format an integer hour (0–23) for the calendar gutter. */
export function formatHour(hour: number, fmt: ClockFormat): string {
  if (fmt === '24h') return `${pad2(hour)}:00`
  const { h12, suffix } = to12h(hour)
  return `${h12} ${suffix}`
}

/** Format a Date as a wall-clock label. */
export function formatClock(d: Date, fmt: ClockFormat): string {
  const h = d.getHours()
  const m = d.getMinutes()
  if (fmt === '24h') return `${pad2(h)}:${pad2(m)}`
  const { h12, suffix } = to12h(h)
  return `${h12}:${pad2(m)} ${suffix}`
}
