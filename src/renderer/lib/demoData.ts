import type { Completion, Task, Weekday } from '@/../shared/types'
import { addDays, todayISO } from './date'

interface RecurringSpec {
  id: string
  title: string
  days?: Weekday[]
  daily?: boolean
  start?: string
  end?: string
}

interface TimedSpec {
  id: string
  title: string
  due: string
  time?: string
  endTime?: string
}

interface InboxSpec {
  id: string
  title: string
}

interface NoteSpec {
  id: string
  body: string
}

const RECURRING: RecurringSpec[] = [
  { id: 'demo-r-lecture', title: 'lecture · cs331', days: ['mon', 'wed', 'fri'], start: '14:00', end: '15:00' },
  { id: 'demo-r-seminar', title: 'seminar · llm reasoning', days: ['tue', 'thu'], start: '13:00', end: '14:30' },
  { id: 'demo-r-advisor', title: 'advisor meeting', days: ['mon'], start: '16:00', end: '17:00' },
  { id: 'demo-r-reading', title: 'reading group', days: ['wed'], start: '10:00', end: '11:00' },
  { id: 'demo-r-lab', title: 'lab social', days: ['fri'], start: '17:00', end: '18:30' },
  { id: 'demo-r-standup', title: 'standup', days: ['mon', 'tue', 'wed', 'thu', 'fri'], start: '09:30', end: '09:45' },
  { id: 'demo-r-run', title: 'morning run', daily: true, start: '07:00', end: '07:45' },
  { id: 'demo-r-log', title: 'daily log', daily: true, start: '23:00', end: '23:15' }
]

const INBOX: InboxSpec[] = [
  { id: 'demo-i-1', title: 'read attention is all you need (again)' },
  { id: 'demo-i-2', title: 'finish hw3 q4' },
  { id: 'demo-i-3', title: 'rebuild docker image w/ py3.12' },
  { id: 'demo-i-4', title: 'swap thinkpad keycaps' },
  { id: 'demo-i-5', title: 'update nvim config' },
  { id: 'demo-i-6', title: 'set up wandb for ablations' }
]

const NOTES: NoteSpec[] = [
  {
    id: 'demo-n-research',
    body: [
      '# research log',
      '',
      '- sentencepiece beat bpe by 0.3 ppl on dev',
      '- todo: run on full corpus (~14h on h100)',
      '- todo: check if drop holds at 7b',
      '',
      '## next steps',
      '- ablation w/o rope',
      '- compare with mistral tokenizer'
    ].join('\n')
  },
  {
    id: 'demo-n-papers',
    body: [
      '# paper notes',
      '',
      '## attention is all you need (re-read)',
      '- multi-head attn ≈ subspace decomposition',
      '- sinusoidal pos still surprisingly competitive',
      '',
      '## flash attn 2 vs 3',
      '- todo: bench locally',
      '- 3 claims 1.5-2x but only on hopper'
    ].join('\n')
  },
  {
    id: 'demo-n-books',
    body: [
      '# books',
      '',
      '- gödel, escher, bach (ch 5)',
      '- thinking, fast and slow',
      '- elements of statistical learning (skim ch 7)'
    ].join('\n')
  },
  {
    id: 'demo-n-misc',
    body: [
      '# misc',
      '',
      '- rotate ssh keys before end of month',
      '- new keyboard arrives next week',
      '- check visa renewal window'
    ].join('\n')
  }
]

export function buildDemoData(): { tasks: Task[]; completions: Completion[] } {
  const today = todayISO()
  const t = (n: number) => addDays(today, n)
  const yesterday = t(-1)
  const baseISO = `${today}T00:00:00.000Z`
  const stamp = (offsetDays: number, hour = 8) =>
    `${addDays(today, offsetDays)}T${String(hour).padStart(2, '0')}:00:00.000Z`

  const TIMED: TimedSpec[] = [
    { id: 'demo-t-oh', title: 'office hours', due: today, time: '11:00', endTime: '12:30' },
    { id: 'demo-t-lunch', title: 'lunch w/ k', due: today, time: '12:30', endTime: '13:15' },
    { id: 'demo-t-paper', title: 'paper draft', due: today, time: '20:00', endTime: '21:30' },
    { id: 'demo-t-study', title: 'study', due: t(1), time: '06:00', endTime: '07:30' },
    { id: 'demo-t-midterm', title: 'midterm prep', due: t(3), time: '14:00', endTime: '16:00' },
    { id: 'demo-t-proposal', title: 'project proposal due', due: t(4), time: '09:00' }
  ]

  const UNTIMED: TimedSpec[] = [
    { id: 'demo-u-skim', title: 'skim transformer scaling paper', due: today },
    { id: 'demo-u-reviewer', title: 'reply to reviewer 2 comments', due: today },
    { id: 'demo-u-ta', title: 'email ta re: quiz regrade', due: today },
    { id: 'demo-u-flight', title: 'book flight home', due: t(7) },
    { id: 'demo-u-rec', title: 'send rec letter request', due: t(-2) },
    { id: 'demo-u-slides', title: 'finalize slides', due: t(5) }
  ]

  const tasks: Task[] = []

  for (const r of RECURRING) {
    tasks.push({
      id: r.id,
      kind: 'recurring',
      title: r.title,
      recurrence: {
        ...(r.days ? { days: r.days } : {}),
        ...(r.daily ? { daily: true } : {}),
        ...(r.start ? { start: r.start } : {}),
        ...(r.end ? { end: r.end } : {})
      },
      createdAt: baseISO
    })
  }

  for (const x of [...TIMED, ...UNTIMED]) {
    tasks.push({
      id: x.id,
      kind: 'todo',
      title: x.title,
      due: x.due,
      ...(x.time ? { time: x.time } : {}),
      ...(x.endTime ? { endTime: x.endTime } : {}),
      createdAt: baseISO
    })
  }

  for (const i of INBOX) {
    tasks.push({
      id: i.id,
      kind: 'todo',
      title: i.title,
      due: null,
      createdAt: baseISO
    })
  }

  for (const n of NOTES) {
    tasks.push({
      id: n.id,
      kind: 'note',
      body: n.body,
      createdAt: baseISO
    })
  }

  const completions: Completion[] = [
    { taskId: 'demo-r-run', date: today, at: stamp(0, 7) },
    { taskId: 'demo-r-standup', date: today, at: stamp(0, 9) },
    { taskId: 'demo-r-log', date: yesterday, at: stamp(-1, 23) },
    { taskId: 'demo-r-run', date: yesterday, at: stamp(-1, 7) },
    { taskId: 'demo-u-ta', date: today, at: stamp(0, 10) }
  ]

  return { tasks, completions }
}
