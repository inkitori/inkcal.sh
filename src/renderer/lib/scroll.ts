export function scrollSelectedInto(container: HTMLElement | null, block: ScrollLogicalPosition): void {
  if (!container) return
  const el = container.querySelector<HTMLElement>('[data-selected="true"]')
  if (!el) return
  el.scrollIntoView({ block, inline: 'nearest' })
}

// Half-viewport in row-units, using the selected row's height as a proxy.
export function halfPageStep(container: HTMLElement | null): number {
  if (!container) return 10
  const el = container.querySelector<HTMLElement>('[data-selected="true"]')
  const rowH = el?.getBoundingClientRect().height
  if (!rowH || rowH <= 0) return 10
  return Math.max(1, Math.round((container.clientHeight / rowH) / 2))
}
