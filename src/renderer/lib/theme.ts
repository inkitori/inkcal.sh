import type { Theme } from '@/../shared/types'

export function applyTheme(theme: Theme) {
  const root = document.documentElement
  for (const [k, v] of Object.entries(theme.vars)) {
    root.style.setProperty(k, v)
  }
  const alpha = theme.transparency?.enabled ? (theme.transparency.alpha ?? 0.85) : 1
  root.style.setProperty('--window-alpha', String(alpha))
  document.body.classList.toggle('transparent', !!theme.transparency?.enabled)
}
