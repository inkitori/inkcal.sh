import { useEffect, useRef, useState } from 'react'
import { selectNotes, useStore } from '@/lib/store'
import { useListKeymap } from '@/lib/keymap'

export default function NotesView() {
  const tasks = useStore(s => s.tasks)
  const notes = selectNotes({ tasks, completions: useStore.getState().completions } as any)
  const deleteTask = useStore(s => s.deleteTask)
  const openCapture = useStore(s => s.openCapture)
  const updateTask = useStore(s => s.updateTask)

  const [selected, setSelected] = useState(0)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const taRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!renamingId) return
    const note = notes.find(n => n.id === renamingId)
    if (!note) return
    setDraft(note.body ?? '')
    requestAnimationFrame(() => {
      taRef.current?.focus()
      taRef.current?.select()
    })
  }, [renamingId])

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
      if (n) setRenamingId(n.id)
    }
  })

  if (notes.length === 0) {
    return (
      <div className="p-12 text-center font-mono text-[12px] uppercase" style={{ color: 'var(--muted-2)' }}>
        no notes — press n or ⌘K then "note: ..."
      </div>
    )
  }

  function commit() {
    if (!renamingId) return
    const next = draft.trim()
    if (next.length > 0) updateTask(renamingId, { body: next })
    setRenamingId(null)
  }

  return (
    <div className="px-6 py-5 max-w-[720px] mx-auto fade-in">
      <header className="font-mono text-[10px] uppercase tracking-widest mb-3" style={{ color: 'var(--muted)' }}>
        notes <span style={{ color: 'var(--muted-2)' }}>{notes.length}</span>
      </header>
      <div className="flex flex-col gap-1">
        {notes.map((n, i) => {
          const isRenaming = n.id === renamingId
          return (
            <div
              key={n.id}
              onClick={() => setSelected(i)}
              className="px-3 py-2 rounded-md"
              style={{
                background: i === selected ? 'var(--bg-2)' : 'transparent',
                outline: i === selected ? '1px solid var(--border)' : 'none'
              }}
            >
              {isRenaming ? (
                <textarea
                  ref={taRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      commit()
                    } else if (e.key === 'Escape') {
                      e.preventDefault()
                      setRenamingId(null)
                    }
                    e.stopPropagation()
                  }}
                  onBlur={commit}
                  className="w-full bg-transparent outline-none text-[14px] resize-none"
                  rows={Math.max(2, draft.split('\n').length)}
                  style={{ color: 'var(--text)' }}
                />
              ) : (
                <div className="text-[14px] whitespace-pre-wrap" style={{ color: 'var(--text)' }}>
                  {n.body}
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
  )
}
