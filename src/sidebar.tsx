import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

const SIDEBAR_KEY = 'glyco-sidebar-open'
const MOBILE_QUERY = '(max-width: 900px)'

interface SidebarContextValue {
  open: boolean
  mobile: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

function readDesktopOpen(): boolean {
  try {
    const raw = localStorage.getItem(SIDEBAR_KEY)
    if (raw === '0') return false
    if (raw === '1') return true
  } catch {
    /* ignore */
  }
  return true
}

function writeDesktopOpen(open: boolean) {
  try {
    localStorage.setItem(SIDEBAR_KEY, open ? '1' : '0')
  } catch {
    /* ignore */
  }
}

function readMobile(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia(MOBILE_QUERY).matches
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [mobile, setMobile] = useState(readMobile)
  const [desktopOpen, setDesktopOpen] = useState(readDesktopOpen)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY)
    const onChange = () => {
      const next = media.matches
      setMobile(next)
      if (next) setMobileOpen(false)
    }
    onChange()
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (!mobile || !mobileOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobile, mobileOpen])

  const open = mobile ? mobileOpen : desktopOpen

  const value = useMemo<SidebarContextValue>(() => ({
    open,
    mobile,
    setOpen: (next) => {
      if (mobile) setMobileOpen(next)
      else {
        setDesktopOpen(next)
        writeDesktopOpen(next)
      }
    },
    toggle: () => {
      if (mobile) setMobileOpen((current) => !current)
      else {
        setDesktopOpen((current) => {
          const next = !current
          writeDesktopOpen(next)
          return next
        })
      }
    },
  }), [open, mobile])

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
}

export function useSidebar() {
  const context = useContext(SidebarContext)
  if (!context) throw new Error('useSidebar fora do SidebarProvider')
  return context
}
