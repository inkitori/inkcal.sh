import { forwardRef, useEffect, useMemo, useState } from 'react'
import { previewFor } from '@/lib/parser'

interface Props {
  value: string
  onChange: (raw: string) => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  placeholder?: string
  autoFocus?: boolean
  className?: string
  inputClassName?: string
  inputStyle?: React.CSSProperties
  /** override the live-preview function. defaults to parser.previewFor */
  preview?: (raw: string) => string
}

const ScheduleInput = forwardRef<HTMLInputElement, Props>(function ScheduleInput(
  { value, onChange, onKeyDown, placeholder, autoFocus, className, inputClassName, inputStyle, preview },
  ref
) {
  const trimmed = value.trim()
  const isEmpty = trimmed === ''
  const previewFn = preview ?? previewFor
  const currentPreview = useMemo(() => previewFn(value), [previewFn, value])
  const [lastGoodPreview, setLastGoodPreview] = useState(currentPreview)

  useEffect(() => {
    if (isEmpty) setLastGoodPreview('')
    else if (currentPreview) setLastGoodPreview(currentPreview)
  }, [isEmpty, currentPreview])

  const showPreview = !isEmpty
  const previewText = currentPreview || lastGoodPreview
  const dim = !isEmpty && !currentPreview && !!lastGoodPreview

  return (
    <div className={className ?? 'flex flex-col gap-1'}>
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={inputClassName ?? 'w-full bg-transparent outline-none'}
        style={inputStyle ?? { color: 'var(--text)' }}
      />
      {showPreview && previewText && (
        <div
          className="font-mono text-[11px]"
          style={{
            color: 'var(--muted)',
            opacity: dim ? 0.5 : 1
          }}
        >
          → {previewText}
        </div>
      )}
    </div>
  )
})

export default ScheduleInput
