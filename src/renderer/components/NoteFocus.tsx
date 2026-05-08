import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useStore } from '@/lib/store'
import VimEditor, { type VimMode } from './VimEditor'

export default function NoteFocus() {
  const noteId = useStore(s => s.noteFocusId)
  const close = useStore(s => s.closeNoteFocus)
  const tasks = useStore(s => s.tasks)
  const updateTask = useStore(s => s.updateTask)
  const settings = useStore(s => s.settings)

  const note = tasks.find(t => t.id === noteId && t.kind === 'note') ?? null
  const [mode, setMode] = useState<VimMode>('insert')
  const [draft, setDraft] = useState(note?.body ?? '')
  const editorPaneRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setDraft(note?.body ?? '')
  }, [noteId, note?.body])

  const showPreview = settings.notePreviewInFocus

  // Mirror the editor scroller's ratio onto the preview pane. Proportional
  // sync is good enough for short-to-medium notes and sidesteps source-line ↔
  // rendered-DOM mapping.
  useLayoutEffect(() => {
    if (!showPreview || !noteId) return
    const pane = editorPaneRef.current
    const preview = previewRef.current
    if (!pane || !preview) return
    const scroller = pane.querySelector<HTMLElement>('.cm-scroller')
    if (!scroller) return
    function onScroll() {
      if (!scroller || !preview) return
      const editorMax = scroller.scrollHeight - scroller.clientHeight
      if (editorMax <= 0) return
      const ratio = scroller.scrollTop / editorMax
      const previewMax = preview.scrollHeight - preview.clientHeight
      if (previewMax <= 0) return
      preview.scrollTop = ratio * previewMax
    }
    scroller.addEventListener('scroll', onScroll, { passive: true })
    return () => scroller.removeEventListener('scroll', onScroll)
  }, [showPreview, noteId, draft])

  useEffect(() => {
    if (!noteId) return
    function onKey(e: KeyboardEvent) {
      // `f` outside the editor closes; inside the editor it's a vim find-char.
      // Our isInTextInput() guard means this only fires when not focused on the editor.
      if (e.key === 'f') {
        const t = e.target as HTMLElement | null
        if (t && t.closest('.cm-editor')) return
        e.preventDefault()
        close()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [noteId, close])

  if (!noteId || !note) return null

  function commit(value: string) {
    if (!note) return
    const next = value.trim()
    if (next.length > 0) updateTask(note.id, { body: next })
    close()
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-start justify-center pt-12"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={close}
    >
      <div
        className="fade-in w-[90%] max-w-[1400px] rounded-md relative"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-2)',
          border: '1px solid var(--border)',
          minHeight: '60vh',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <div
          className="px-4 py-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest"
          style={{ borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}
        >
          <span>note</span>
          {settings.vimEnabled && <span style={{ color: 'var(--accent)' }}>{mode}</span>}
        </div>
        <div className="flex-1 flex min-h-0">
          <div
            ref={editorPaneRef}
            className="flex-1 overflow-y-auto px-6 py-4 min-w-0"
            style={showPreview ? { borderRight: '1px solid var(--border)' } : undefined}
          >
            <VimEditor
              initialValue={note.body ?? ''}
              startMode={settings.vimEnabled ? 'normal' : 'insert'}
              onCommit={commit}
              onModeChange={setMode}
              onChange={showPreview ? setDraft : undefined}
              vimEnabled={settings.vimEnabled}
            />
          </div>
          {showPreview && (
            <div ref={previewRef}
                 className="flex-1 overflow-y-auto px-6 py-4 min-w-0 note-md text-[14px]"
                 style={{ color: 'var(--text)' }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{draft}</ReactMarkdown>
            </div>
          )}
        </div>
        <div
          className="px-4 py-2 flex items-center gap-3 font-mono text-[10px] uppercase"
          style={{ borderTop: '1px solid var(--border)', color: 'var(--muted)' }}
        >
          <span>esc / f close & save</span>
        </div>
      </div>
    </div>
  )
}
