import type { InkcalApi } from './index'

declare global {
  interface Window {
    inkcal: InkcalApi
  }
}

export {}
