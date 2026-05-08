import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { selectNotes, useStore } from '@/lib/store'
import { useListKeymap } from '@/lib/keymap'
import VimEditor, { type VimMode } from '@/components/VimEditor'
import { halfPageStep, scrollSelectedInto } from './TodoView'

const COLLAPSED_MAX_PX = 200

const WIDTH_BY_SETTING: Record<'narrow' | 'medium' | 'wide' | 'full', string> = {
  narrow: '640px',
  medium: '760px',
  wide: '900px',
  full: '100%'
}

export default function NotesView() {
  const tasks = useStore(s => s.tasks)
  const notes = selectNotes(tasks)
  const deleteTask = useStore(s => s.deleteTask)
  const openCapture = useStore(s => s.openCapture)
  const updateTask = useStore(s => s.updateTask)
  const settings = useStore(s => s.settings)
  const openNoteFocus = useStore(s => s.openNoteFocus)

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
      setSelected(prev => Math.max(0, Math.min(notes.length - 1, prev + d)))
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
      setStartMode(settings.vimEnabled ? 'normal' : 'insert')
      setVimMode(settings.vimEnabled ? 'normal' : 'insert')
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
    },
    onFocusKey: () => {
      const n = notes[selected]
      if (n) openNoteFocus(n.id)
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

  function startEdit(id: string) {
    if (editingId === id) return
    const mode: 'insert' | 'normal' = settings.vimEnabled ? 'normal' : 'insert'
    setStartMode(mode)
    setVimMode(mode)
    setEditingId(id)
  }

  const maxWidth = WIDTH_BY_SETTING[settings.notesMaxWidth] ?? '900px'

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto">
    <div className="px-6 py-5 mx-auto fade-in" style={{ maxWidth }}>
      <header className="font-mono text-[10px] uppercase tracking-widest mb-3" style={{ color: 'var(--muted)' }}>
        notes <span style={{ color: 'var(--muted-2)' }}>{notes.length}</span>
      </header>
      <div className="flex flex-col gap-1">
        {notes.map((n, i) => {
          const isEditing = n.id === editingId
          const isSelected = i === selected
          return (
            <div
              key={n.id}
              onClick={() => {
                setSelected(i)
                if (!isEditing) startEdit(n.id)
              }}
              data-selected={isSelected ? 'true' : undefined}
              className="group px-3 py-2 rounded-md relative"
              style={{
                background: isSelected ? 'var(--bg-2)' : 'transparent',
                outline: isSelected ? '1px solid var(--border)' : 'none'
              }}
            >
              {!isEditing && (
                <button
                  onClick={(e) => { e.stopPropagation(); deleteTask(n.id) }}
                  className="absolute top-1 right-1 px-2 py-1 font-mono text-[11px] leading-none rounded-sm opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{
                    background: 'rgba(220,80,80,0.12)',
                    color: 'var(--danger)',
                    border: '1px solid var(--danger)',
                    zIndex: 10
                  }}
                  title="delete note"
                >
                  ×
                </button>
              )}
              {isEditing ? (
                <>
                  {settings.vimEnabled && <ModeBadge mode={vimMode} />}
                  <div onClick={(e) => e.stopPropagation()}>
                    <VimEditor
                      initialValue={n.body ?? ''}
                      startMode={startMode}
                      onCommit={commit}
                      onModeChange={setVimMode}
                      vimEnabled={settings.vimEnabled}
                    />
                  </div>
                </>
              ) : (
                <CollapsibleNote body={n.body ?? ''} expanded={isSelected} />
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

function CollapsibleNote({ body, expanded }: { body: string; expanded: boolean }) {
  const innerRef = useRef<HTMLDivElement>(null)
  const [overflows, setOverflows] = useState(false)

  useLayoutEffect(() => {
    const el = innerRef.current
    if (!el) { setOverflows(false); return }
    setOverflows(el.scrollHeight > COLLAPSED_MAX_PX + 4)
  }, [body, expanded])

  const collapsed = !expanded && overflows
  return (
    <div
      style={{
        position: 'relative',
        maxHeight: collapsed ? COLLAPSED_MAX_PX : 'none',
        overflow: collapsed ? 'hidden' : 'visible'
      }}
    >
      <div ref={innerRef} className="note-md text-[14px]" style={{ color: 'var(--text)' }}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
      </div>
      {collapsed && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: 48,
            pointerEvents: 'none',
            background: 'linear-gradient(transparent, var(--bg-2))'
          }}
        />
      )}
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
