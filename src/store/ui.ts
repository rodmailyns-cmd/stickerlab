import { create } from 'zustand'

export type Page = 'editor' | 'library' | 'packs'
export type Theme = 'light' | 'dark' | 'system'

export interface Toast {
  id: number
  kind: 'success' | 'error' | 'info'
  text: string
}

interface UiState {
  page: Page
  theme: Theme
  onboarded: boolean
  helpOpen: boolean
  toasts: Toast[]
  /** Pack abierto en el gestor. */
  openPackId: string | null
  setPage: (p: Page) => void
  setTheme: (t: Theme) => void
  finishOnboarding: () => void
  restartOnboarding: () => void
  setHelpOpen: (o: boolean) => void
  toast: (text: string, kind?: Toast['kind']) => void
  dismissToast: (id: number) => void
  setOpenPack: (id: string | null) => void
}

function readLS(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function writeLS(key: string, v: string) {
  try {
    localStorage.setItem(key, v)
  } catch {
    /* almacenamiento no disponible */
  }
}

let toastId = 1

export const useUi = create<UiState>()((set, get) => ({
  page: 'editor',
  theme: (readLS('sl-theme') as Theme) || 'system',
  onboarded: readLS('sl-onboarded') === '1',
  helpOpen: false,
  toasts: [],
  openPackId: null,
  setPage: (page) => set({ page }),
  setTheme: (theme) => {
    writeLS('sl-theme', theme)
    set({ theme })
  },
  finishOnboarding: () => {
    writeLS('sl-onboarded', '1')
    set({ onboarded: true })
  },
  restartOnboarding: () => set({ onboarded: false }),
  setHelpOpen: (helpOpen) => set({ helpOpen }),
  toast: (text, kind = 'info') => {
    const id = toastId++
    set({ toasts: [...get().toasts, { id, kind, text }] })
    setTimeout(() => get().dismissToast(id), kind === 'error' ? 6000 : 3500)
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  setOpenPack: (openPackId) => set({ openPackId }),
}))

export const toast = (text: string, kind?: Toast['kind']) => useUi.getState().toast(text, kind)
