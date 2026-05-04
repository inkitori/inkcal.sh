import { ReactNode } from 'react'

interface Props {
  title: string
  count?: number
  tone?: 'default' | 'danger' | 'accent'
  children: ReactNode
}

export default function Section({ title, count, tone = 'default', children }: Props) {
  const color =
    tone === 'danger' ? 'var(--danger)' :
    tone === 'accent' ? 'var(--accent)' :
    'var(--muted)'
  return (
    <section className="mb-5">
      <header className="flex items-baseline gap-2 px-2 mb-1.5 font-mono text-[10px] uppercase tracking-widest"
              style={{ color }}>
        <span>{title}</span>
        {count !== undefined && count > 0 && <span style={{ color: 'var(--muted-2)' }}>{count}</span>}
      </header>
      <div className="flex flex-col">{children}</div>
    </section>
  )
}
