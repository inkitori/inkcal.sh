import { useEffect, useRef } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, drawSelection } from '@codemirror/view'
import { history, defaultKeymap, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { vim, getCM, Vim } from '@replit/codemirror-vim'

export type VimMode = 'normal' | 'insert' | 'visual' | 'replace'

interface Props {
  initialValue: string
  startMode: 'normal' | 'insert'
  onCommit: (value: string) => void
  onModeChange?: (mode: VimMode) => void
}

export default function VimEditor({
  initialValue,
  startMode,
  onCommit,
  onModeChange
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const modeRef = useRef<VimMode>('normal')
  // Per-mount commit. Replaced on every effect run so StrictMode's first
  // (discarded) mount can't fire commit when its cleanup destroys the editor.
  const commitRef = useRef<() => void>(() => {})

  // Stable refs so the editor effect can run once.
  const onCommitRef = useRef(onCommit)
  const onModeChangeRef = useRef(onModeChange)
  onCommitRef.current = onCommit
  onModeChangeRef.current = onModeChange

  useEffect(() => {
    if (!hostRef.current) return

    // Closure-scoped flags so each mount has its own (StrictMode runs the
    // effect twice in dev; sharing flags via refs would leak across mounts).
    let destroying = false
    let committed = false
    const commit = () => {
      if (destroying || committed) return
      committed = true
      onCommitRef.current(view.state.doc.toString())
    }
    commitRef.current = commit

    const theme = EditorView.theme({
      '&': {
        background: 'transparent',
        color: 'var(--text)',
        fontSize: '14px'
      },
      '.cm-content': {
        padding: '0',
        fontFamily: 'inherit',
        caretColor: 'var(--text)'
      },
      '.cm-line': { padding: '0' },
      '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--text)' },
      '.cm-fat-cursor': {
        background: 'var(--text)',
        outline: 'none',
        color: 'var(--bg)'
      },
      '&:not(.cm-focused) .cm-fat-cursor': {
        background: 'transparent',
        outline: '1px solid var(--text)'
      },
      '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
        background: 'var(--accent-soft)'
      },
      '&.cm-focused': { outline: 'none' },
      '&.cm-editor': { outline: 'none' }
    })

    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: initialValue,
        extensions: [
          vim(),
          history(),
          drawSelection(),
          markdown(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          theme,
          EditorView.lineWrapping,
          EditorView.domEventHandlers({ blur: commit })
        ]
      })
    })
    viewRef.current = view

    const cm = getCM(view)
    if (cm) {
      cm.on('vim-mode-change', (e: { mode: VimMode }) => {
        modeRef.current = e.mode
        onModeChangeRef.current?.(e.mode)
      })

      // If user wanted insert mode, push vim into insert. Default is normal.
      if (startMode === 'insert') {
        Vim.handleKey(cm, 'i', 'macro')
        modeRef.current = 'insert'
        onModeChangeRef.current?.('insert')
      } else {
        modeRef.current = 'normal'
        onModeChangeRef.current?.('normal')
      }
    }

    view.focus()

    return () => {
      destroying = true
      view.destroy()
      viewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Capture-phase keydown so we see Esc *before* vim handles it. If we're
  // already in normal mode, second Esc commits and exits.
  useEffect(() => {
    const el = hostRef.current
    if (!el) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (modeRef.current === 'normal') {
        e.preventDefault()
        e.stopPropagation()
        commitRef.current()
      }
      // else: vim will switch insert/visual → normal; stay mounted
    }
    el.addEventListener('keydown', onKeyDown, true)
    return () => el.removeEventListener('keydown', onKeyDown, true)
  }, [])

  return <div ref={hostRef} className="w-full" />
}
