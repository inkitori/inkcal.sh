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
  vimEnabled?: boolean
}

export default function VimEditor({
  initialValue,
  startMode,
  onCommit,
  onModeChange,
  vimEnabled = true
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
        // 2px left padding so the column-0 cursor (which has margin-left:-0.6px)
        // isn't clipped by .cm-scroller's overflow.
        padding: '0 0 0 2px',
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

    const extensions = [
      ...(vimEnabled ? [vim()] : []),
      history(),
      drawSelection(),
      markdown(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      theme,
      EditorView.lineWrapping,
      EditorView.domEventHandlers({ blur: commit })
    ]

    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: initialValue,
        extensions
      })
    })
    viewRef.current = view

    if (vimEnabled) {
      const cm = getCM(view)
      if (cm) {
        bridgeUnnamedRegisterToClipboard()

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
    } else {
      // plain mode: behave as if always in 'insert' for the Esc-commit handler
      modeRef.current = 'insert'
    }

    view.focus()

    return () => {
      destroying = true
      view.destroy()
      viewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Capture-phase keydown so we see Esc *before* vim handles it. With vim:
  // first Esc returns to normal, second Esc commits. Without vim: Esc commits
  // immediately.
  useEffect(() => {
    const el = hostRef.current
    if (!el) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (!vimEnabled || modeRef.current === 'normal') {
        e.preventDefault()
        e.stopPropagation()
        commitRef.current()
      }
      // else: vim will switch insert/visual → normal; stay mounted
    }
    el.addEventListener('keydown', onKeyDown, true)
    return () => el.removeEventListener('keydown', onKeyDown, true)
  }, [vimEnabled])

  return <div ref={hostRef} className="w-full" />
}

// Mirror vim's unnamed register (`"`) through the OS clipboard so that y/d/c
// yanks can be pasted into other apps and `p` can paste from them. The
// registerController is a singleton on the vim global state, so this only
// needs to run once per process — but re-running is idempotent.
let bridged = false
function bridgeUnnamedRegisterToClipboard() {
  if (bridged) return
  const registerController = (Vim as unknown as { getRegisterController: () => any }).getRegisterController?.()
  const reg = registerController?.unnamedRegister
  if (!reg) return
  bridged = true

  const origSetText = reg.setText.bind(reg)
  reg.setText = (text: string, linewise?: boolean, blockwise?: boolean) => {
    origSetText(text, linewise, blockwise)
    if (typeof text === 'string') {
      try { window.inkcal.clipboardWrite(text) } catch {}
    }
  }
  reg.toString = () => {
    try {
      const ext = window.inkcal.clipboardRead()
      const internal = reg.keyBuffer.join('')
      // If the OS clipboard changed externally, sync it in (and infer
      // linewise from a trailing newline so `p` pastes onto a new line for
      // line-copied content).
      if (ext !== internal) {
        reg.keyBuffer = [ext]
        reg.linewise = ext.endsWith('\n')
        reg.blockwise = false
      }
      return ext
    } catch {
      return reg.keyBuffer.join('')
    }
  }
}
