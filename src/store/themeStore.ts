import { create } from 'zustand'

type ThemeMode = 'dark' | 'light'

interface ThemeState {
  mode: ThemeMode
  toggle: () => void
  setMode: (mode: ThemeMode) => void
}

// Carrega preferência salva ou usa dark default
function getInitialMode(): ThemeMode {
  if (typeof window === 'undefined') return 'dark'
  const saved = localStorage.getItem('crm-theme-mode')
  return (saved === 'light' ? 'light' : 'dark') as ThemeMode
}

function applyMode(mode: ThemeMode) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.toggle('light', mode === 'light')
  root.classList.toggle('dark',  mode === 'dark')
  root.setAttribute('data-theme', mode)
  root.style.colorScheme = mode

  // Força mudança visível mesmo se CSS overrides falharem
  if (mode === 'light') {
    document.body.style.backgroundColor = '#f8f9fa'
    document.body.style.color = '#1a1d20'
  } else {
    document.body.style.backgroundColor = ''
    document.body.style.color = ''
  }

  localStorage.setItem('crm-theme-mode', mode)
}

const initialMode = getInitialMode()
if (typeof window !== 'undefined') applyMode(initialMode)

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: initialMode,
  toggle: () => {
    const next = get().mode === 'dark' ? 'light' : 'dark'
    applyMode(next)
    set({ mode: next })
  },
  setMode: (mode) => {
    applyMode(mode)
    set({ mode })
  },
}))
