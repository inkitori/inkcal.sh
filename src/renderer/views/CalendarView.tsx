import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '@/lib/store'
import { instancesForDate } from '@/lib/recurrence'
import { isInTextInput } from '@/lib/keymap'
import { usePaneActive } from '@/lib/PaneContext'
import {
  addDays,
  isToday,
  todayISO,
  weekDates
} from '@/lib/date'
import { formatHour } from '@/../shared/time'
import type { Completion, Task } from '@/../shared/types'

const HOUR_PX_WEEK = 36
const HOUR_PX_DAY = 52
const HOURS = Array.from({ length: 24 }, (_, i) => i)
const WEEKDAY_LABEL = ['mon','tue','wed','thu','fri','sat','sun']
const TWO_LINE_PX = 32
const UNTIMED_HEADER_PX = 22
const UNTIMED_ROW_PX = 18
const UNTIMED_MAX_PX = 140

type Mode = 'day' | 'week'

interface BlockData {
  task: Task
  startMin: number
  endMin: number
  isCompleted: boolean
  date: string
}

interface LaidOutBlock extends BlockData {
  col: number
  colCount: number
}

interface UntimedItem {
  task: Task
  isCompleted: boolean
  date: string
}

function blocksForDate(tasks: Task[], completions: Completion[], date: string): BlockData[] {
  const insts = instancesForDate(tasks, completions, date)
  const out: BlockData[] = []
  for (const inst of insts) {
    const s = inst.task.recurrence?.start
    if (!s) continue
    const e = inst.task.recurrence?.end ?? add30(s)
    out.push({
      task: inst.task,
      startMin: minutes(s),
      endMin: minutes(e),
      isCompleted: inst.isCompleted,
      date
    })
  }
  for (const t of tasks) {
    if (t.kind !== 'todo' || t.due !== date || !t.time) continue
    const s = t.time
    const e = t.endTime ?? add30(s)
    const isCompleted = completions.some(c => c.taskId === t.id)
    out.push({ task: t, startMin: minutes(s), endMin: minutes(e), isCompleted, date })
  }
  return out
}

function untimedForDate(tasks: Task[], completions: Completion[], date: string): UntimedItem[] {
  const out: UntimedItem[] = []
  for (const t of tasks) {
    if (t.kind !== 'todo') continue
    if (t.due !== date) continue
    if (t.time) continue
    const isCompleted = completions.some(c => c.taskId === t.id)
    out.push({ task: t, isCompleted, date })
  }
  return out
}

function layoutBlocks(blocks: BlockData[]): LaidOutBlock[] {
  if (blocks.length === 0) return []
  const sorted = [...blocks].sort(
    (a, b) => a.startMin - b.startMin || b.endMin - a.endMin
  )
  const out: LaidOutBlock[] = []
  let cluster: { block: BlockData; col: number }[] = []
  let colEnds: number[] = []
  let clusterEnd = -Infinity

  const flush = () => {
    if (cluster.length === 0) return
    const colCount = colEnds.length
    for (const { block, col } of cluster) {
      out.push({ ...block, col, colCount })
    }
    cluster = []
    colEnds = []
  }

  for (const b of sorted) {
    if (b.startMin >= clusterEnd) {
      flush()
      clusterEnd = b.endMin
    } else {
      clusterEnd = Math.max(clusterEnd, b.endMin)
    }
    let c = -1
    for (let i = 0; i < colEnds.length; i++) {
      if (colEnds[i] <= b.startMin) { c = i; break }
    }
    if (c === -1) { c = colEnds.length; colEnds.push(0) }
    colEnds[c] = b.endMin
    cluster.push({ block: b, col: c })
  }
  flush()
  return out
}

function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
function add30(hhmm: string): string {
  const m = minutes(hhmm) + 30
  const hh = Math.floor(m / 60) % 24
  const mm = m % 60
  return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`
}

export default function CalendarView() {
  const [mode, setMode] = useState<Mode>('week')
  const [anchor, setAnchor] = useState<string>(todayISO())
  const [expandedUntimed, setExpandedUntimed] = useState<Set<string>>(new Set())
  const tasks = useStore(s => s.tasks)
  const completions = useStore(s => s.completions)
  const toggle = useStore(s => s.toggleCompletion)
  const clockFormat = useStore(s => s.settings.clockFormat)
  const paneActive = usePaneActive()
  const dates = mode === 'week' ? weekDates(anchor) : [anchor]
  const HOUR_PX = mode === 'week' ? HOUR_PX_WEEK : HOUR_PX_DAY

  const toggleExpanded = (date: string) => {
    setExpandedUntimed(prev => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date); else next.add(date)
      return next
    })
  }

  const gridRef = useRef<HTMLDivElement>(null)

  // scroll to ~7am on mount
  useEffect(() => {
    if (gridRef.current) gridRef.current.scrollTop = HOUR_PX * 7
  }, [mode])

  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!paneActive) return
      const s = useStore.getState()
      if (s.paletteOpen || s.captureOpen || s.editOpen) return
      if (isInTextInput(e.target)) return
      if (e.metaKey || e.ctrlKey) return
      const k = e.key
      if (k === 'h' || k === 'ArrowLeft') {
        e.preventDefault(); setAnchor(a => addDays(a, mode === 'week' ? -7 : -1)); return
      }
      if (k === 'l' || k === 'ArrowRight') {
        e.preventDefault(); setAnchor(a => addDays(a, mode === 'week' ? 7 : 1)); return
      }
      if (k === 't') { e.preventDefault(); setAnchor(todayISO()); return }
      if (k === 'd') { e.preventDefault(); setMode('day'); return }
      if (k === 'w') { e.preventDefault(); setMode('week'); return }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, paneActive])
  const currentMin = now.getHours() * 60 + now.getMinutes()

  const allBlocks = useMemo(
    () => dates.map(d => ({
      date: d,
      blocks: layoutBlocks(blocksForDate(tasks, completions, d)),
      untimed: untimedForDate(tasks, completions, d)
    })),
    [tasks, completions, dates.join(',')]
  )

  return (
    <div className="flex flex-col h-full fade-in">
      <div className="flex items-center gap-2 px-6 py-3 font-mono text-[11px] uppercase"
           style={{ color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>
        <button
          onClick={() => setMode('day')}
          className="px-2 py-1 rounded"
          style={{
            background: mode === 'day' ? 'var(--accent-soft)' : 'transparent',
            color: mode === 'day' ? 'var(--accent)' : 'var(--muted)'
          }}
        >day</button>
        <button
          onClick={() => setMode('week')}
          className="px-2 py-1 rounded"
          style={{
            background: mode === 'week' ? 'var(--accent-soft)' : 'transparent',
            color: mode === 'week' ? 'var(--accent)' : 'var(--muted)'
          }}
        >week</button>

        <span className="mx-3" style={{ color: 'var(--muted-2)' }}>|</span>

        <button onClick={() => setAnchor(addDays(anchor, mode === 'week' ? -7 : -1))}
                className="px-2 py-1 rounded">‹ prev</button>
        <button onClick={() => setAnchor(todayISO())}
                className="px-2 py-1 rounded" style={{ color: 'var(--accent)' }}>today</button>
        <button onClick={() => setAnchor(addDays(anchor, mode === 'week' ? 7 : 1))}
                className="px-2 py-1 rounded">next ›</button>
      </div>

      <div ref={gridRef} className="flex-1 overflow-y-auto">
        <div
          className="grid relative"
          style={{
            gridTemplateColumns: `48px repeat(${dates.length}, minmax(0,1fr))`
          }}
        >
          {/* hour gutter */}
          <div className="font-mono text-[10px]" style={{ color: 'var(--muted-2)' }}>
            <div style={{ height: 32 }} />
            {HOURS.map(h => (
              <div key={h} className="px-2" style={{ height: HOUR_PX }}>
                {formatHour(h, clockFormat)}
              </div>
            ))}
          </div>

          {/* day columns */}
          {dates.map((d, di) => (
            <div key={d} style={{ borderLeft: '1px solid var(--border)' }} className="relative">
              <div
                className="font-mono text-[10px] uppercase flex items-baseline gap-2 px-2"
                style={{
                  height: 32,
                  color: isToday(d) ? 'var(--accent)' : 'var(--muted)',
                  borderBottom: '1px solid var(--border)'
                }}
              >
                <span>{WEEKDAY_LABEL[di] ?? ''}</span>
                <span style={{ color: isToday(d) ? 'var(--accent)' : 'var(--text)' }}>
                  {d.slice(8)}
                </span>
              </div>
              <div className="relative" style={{ height: HOUR_PX * 24 }}>
                {HOURS.map(h => (
                  <div
                    key={h}
                    className="absolute left-0 right-0"
                    style={{
                      top: HOUR_PX * h,
                      height: HOUR_PX,
                      borderTop: '1px solid var(--border)'
                    }}
                  />
                ))}

                {allBlocks[di]?.blocks.map(b => {
                  const top = (b.startMin / 60) * HOUR_PX
                  const rawHeight = ((b.endMin - b.startMin) / 60) * HOUR_PX - 2
                  const height = Math.max(20, rawHeight)
                  const compact = height < TWO_LINE_PX
                  const inset = 4
                  const colWidth = `calc((100% - ${inset * 2}px) / ${b.colCount} - 2px)`
                  const colLeft = `calc(${inset}px + ${b.col} * (100% - ${inset * 2}px) / ${b.colCount})`
                  return (
                    <div
                      key={b.task.id + b.date}
                      onClick={() => toggle(b.task.id, b.date)}
                      className="absolute rounded-md px-2 cursor-pointer overflow-hidden"
                      style={{
                        top, height,
                        left: colLeft,
                        width: colWidth,
                        paddingTop: 2, paddingBottom: 2,
                        background: 'var(--accent-softer)',
                        borderLeft: '2px solid var(--accent)',
                        opacity: b.isCompleted ? 0.45 : 1
                      }}
                    >
                      <div className="font-mono text-[10px] uppercase truncate leading-tight"
                           style={{
                             color: b.isCompleted ? 'var(--muted)' : 'var(--accent)',
                             textDecoration: b.isCompleted ? 'line-through' : 'none'
                           }}>
                        {b.task.title}
                      </div>
                      {!compact && (
                        <div className="font-mono text-[10px] leading-tight truncate" style={{ color: 'var(--muted-2)' }}>
                          {minToHHMM(b.startMin)}{b.endMin > b.startMin + 1 ? `–${minToHHMM(b.endMin)}` : ''}
                        </div>
                      )}
                    </div>
                  )
                })}

                {(() => {
                  const untimed = allBlocks[di]?.untimed ?? []
                  if (untimed.length === 0) return null
                  const expanded = expandedUntimed.has(d)
                  const bodyHeight = expanded
                    ? Math.min(untimed.length * UNTIMED_ROW_PX, UNTIMED_MAX_PX)
                    : 0
                  return (
                    <div
                      className="absolute left-0 right-0"
                      style={{
                        top: 0,
                        zIndex: 3,
                        background: 'var(--bg)',
                        borderBottom: '1px solid var(--border)'
                      }}
                    >
                      <div
                        onClick={() => toggleExpanded(d)}
                        className="font-mono text-[10px] uppercase flex items-center gap-1 px-2 cursor-pointer select-none"
                        style={{
                          height: UNTIMED_HEADER_PX,
                          color: 'var(--muted)'
                        }}
                      >
                        <span style={{ color: 'var(--muted-2)' }}>{expanded ? '▾' : '▸'}</span>
                        <span>{untimed.length} untimed</span>
                      </div>
                      {expanded && (
                        <div style={{ maxHeight: UNTIMED_MAX_PX, height: bodyHeight, overflowY: 'auto' }}>
                          {untimed.map(u => (
                            <div
                              key={u.task.id + u.date}
                              onClick={(e) => { e.stopPropagation(); toggle(u.task.id, u.date) }}
                              className="font-mono text-[10px] uppercase truncate px-2 cursor-pointer flex items-center"
                              style={{
                                height: UNTIMED_ROW_PX,
                                background: 'var(--accent-softer)',
                                borderLeft: '2px solid var(--accent)',
                                marginBottom: 1,
                                color: u.isCompleted ? 'var(--muted)' : 'var(--accent)',
                                textDecoration: u.isCompleted ? 'line-through' : 'none',
                                opacity: u.isCompleted ? 0.45 : 1
                              }}
                            >
                              {u.task.title}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })()}

                {isToday(d) && (
                  <div
                    className="absolute left-0 right-0"
                    style={{
                      top: (currentMin / 60) * HOUR_PX,
                      pointerEvents: 'none'
                    }}
                  >
                    <div
                      className="absolute"
                      style={{
                        left: -4, top: -4, width: 8, height: 8,
                        borderRadius: 9999,
                        background: 'var(--accent)'
                      }}
                    />
                    <div className="h-px w-full" style={{ background: 'var(--accent)' }} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function minToHHMM(m: number): string {
  const h = Math.floor(m / 60) % 24
  const mm = m % 60
  return `${String(h).padStart(2,'0')}:${String(mm).padStart(2,'0')}`
}
