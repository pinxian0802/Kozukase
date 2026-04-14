import { create } from 'zustand'

interface UIState {
  isMobileMenuOpen: boolean
  setMobileMenuOpen: (open: boolean) => void
  isSearchOpen: boolean
  setSearchOpen: (open: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  isMobileMenuOpen: false,
  setMobileMenuOpen: (open) => set({ isMobileMenuOpen: open }),
  isSearchOpen: false,
  setSearchOpen: (open) => set({ isSearchOpen: open }),
}))
