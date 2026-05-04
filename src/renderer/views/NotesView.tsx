import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { selectNotes, useStore } from '@/lib/store'
import { useListKeymap } from '@/lib/keymap'
import VimEditor, { type VimMode } from '@/components/VimEditor'
import { halfPageStep, scrollSelectedInto } from './TodoView'

export default function NotesView() {
  const tasks = useStore(s => s.tasks)
  const notes = selectNotes({ tasks, completions: useStore.getState().completions } as any)
  const deleteTask = useStore(s => s.deleteTask)
  const openCapture = useStore(s => s.openCapture)
  const updateTask = useStore(s => s.updateTask)

  const [selected, setSelected] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [startMode, setStartMode] = useState<'insert' | 'normal'>('insert')
  const [vimMode, setVimMode] = useState<VimMode>('insert')
  const scrollRef = useRef<HTMLDivElement>(null)

  const pendingSelectId = useStore(s => s.pendingSelectId)
  const setPendingSelectId = useStore(s => s.setPendingSelectId)
  useEffect(() => {
    if (!pendingSelectId) return
    const idx = notes.findIndex(n => n.id === pendingSelectId)
    if (idx >= 0) setSelected(idx)
    setPendingSelectId(null)
  }, [pendingSelectId, notes, setPendingSelectId])

  useListKeymap({
    onMove: (d) => {
      if (!notes.length) return
      setSelected(prev => (prev + d + notes.length) % notes.length)
    },
    onTop: () => setSelected(0),
    onBottom: () => setSelected(Math.max(0, notes.length - 1)),
    onDelete: () => {
      const n = notes[selected]
      if (n) deleteTask(n.id)
    },
    onOpenBelow: () => openCapture('note: '),
    onRename: () => {
      const n = notes[selected]
      if (!n) return
      setStartMode('insert')
      setVimMode('insert')
      setEditingId(n.id)
    },
    onEdit: () => {
      const n = notes[selected]
      if (!n) return
      setStartMode('normal')
      setVimMode('normal')
      setEditingId(n.id)
    },
    onCenterView: () => scrollSelectedInto(scrollRef.current, 'center'),
    onTopView: () => scrollSelectedInto(scrollRef.current, 'start'),
    onBottomView: () => scrollSelectedInto(scrollRef.current, 'end'),
    onHalfPageDown: () => {
      if (!notes.length) return
      const step = halfPageStep(scrollRef.current)
      setSelected(prev => Math.min(notes.length - 1, prev + step))
    },
    onHalfPageUp: () => {
      if (!notes.length) return
      const step = halfPageStep(scrollRef.current)
      setSelected(prev => Math.max(0, prev - step))
    }
  })

  useLayoutEffect(() => {
    scrollSelectedInto(scrollRef.current, 'nearest')
  }, [selected, notes.length])

  if (notes.length === 0) {
    return (
      <div className="p-12 text-center font-mono text-[12px] uppercase" style={{ color: 'var(--muted-2)' }}>
        no notes — press n or ⌘K then "note: ..."
      </div>
    )
  }

  function commit(value: string) {
    if (!editingId) return
    const next = value.trim()
    if (next.length > 0) updateTask(editingId, { body: next })
    setEditingId(null)
  }

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto">
    <div className="px-6 py-5 max-w-[720px] mx-auto fade-in">
      <header className="font-mono text-[10px] uppercase tracking-widest mb-3" style={{ color: 'var(--muted)' }}>
        notes <span style={{ color: 'var(--muted-2)' }}>{notes.length}</span>
      </header>
      <div className="flex flex-col gap-1">
        {notes.map((n, i) => {
          const isEditing = n.id === editingId
          return (
            <div
              key={n.id}
              onClick={() => setSelected(i)}
              data-selected={i === selected ? 'true' : undefined}
              className="px-3 py-2 rounded-md relative"
              style={{
                background: i === selected ? 'var(--bg-2)' : 'transparent',
                outline: i === selected ? '1px solid var(--border)' : 'none'
              }}
            >
              {isEditing ? (
                <>
                  <ModeBadge mode={vimMode} />
                  <div onClick={(e) => e.stopPropagation()}>
                    <VimEditor
                      initialValue={n.body ?? ''}
                      startMode={startMode}
                      onCommit={commit}
                      onModeChange={setVimMode}
                    />
                  </div>
                </>
              ) : (
                <div className="note-md text-[14px]" style={{ color: 'var(--text)' }}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{n.body ?? ''}</ReactMarkdown>
                </div>
              )}
              <div className="font-mono text-[10px] mt-1" style={{ color: 'var(--muted-2)' }}>
                {new Date(n.createdAt).toLocaleString()}
              </div>
            </div>
          )
        })}
      </div>
    </div>
    </div>
  )
}

function ModeBadge({ mode }: { mode: VimMode }) {
  const color =
    mode === 'insert' ? 'var(--accent)'
    : mode === 'visual' ? 'var(--success)'
    : mode === 'replace' ? 'var(--danger)'
    : 'var(--muted)'
  return (
    <div
      className="absolute -top-2 right-2 px-1.5 py-px font-mono text-[9px] uppercase tracking-widest rounded-sm pointer-events-none"
      style={{
        background: 'var(--bg)',
        color,
        border: `1px solid ${color}`
      }}
    >
      {mode}
    </div>
  )
}
