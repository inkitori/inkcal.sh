interface Props {
  checked: boolean
  onClick?: () => void
  size?: number
}

export default function Checkbox({ checked, onClick, size = 16 }: Props) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick?.() }}
      className="no-drag inline-flex items-center justify-center transition-all"
      style={{
        width: size, height: size,
        borderRadius: 4,
        border: `1px solid ${checked ? 'var(--accent)' : 'var(--border)'}`,
        background: checked ? 'var(--accent)' : 'transparent'
      }}
      aria-checked={checked}
      role="checkbox"
    >
      {checked && (
        <svg width={size - 6} height={size - 6} viewBox="0 0 12 12" fill="none">
          <path d="M2.5 6.5l2.2 2.2L9.5 3.7" stroke="#111" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  )
}
