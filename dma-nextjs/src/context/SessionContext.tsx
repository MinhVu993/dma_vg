'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { LocaleCode } from '@/locales'

export interface UserSession {
  id?: number
  empno: string
  name: string
  username: string
  dept: string
  high_dept?: string
  email: string
  ext?: string
  location?: string
  role?: string
  token?: string
  isManager?: boolean
  deputy?: string
  lvl_code?: string
}

interface SessionContextType {
  user: UserSession
  setUser: React.Dispatch<React.SetStateAction<UserSession>>
  locale: LocaleCode
  setLocale: (loc: LocaleCode) => void
  isLoadingSession: boolean
}

const defaultEmptyUser: UserSession = {
  empno: '',
  name: '',
  username: '',
  dept: '',
  email: '',
  ext: '',
  location: 'VG',
  role: 'user',
}

const SessionContext = createContext<SessionContextType>({
  user: defaultEmptyUser,
  setUser: () => {},
  locale: 'vi',
  setLocale: () => {},
  isLoadingSession: true,
})

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSession>(defaultEmptyUser)
  const [locale, setLocaleState] = useState<LocaleCode>('vi')
  const [isLoadingSession, setIsLoadingSession] = useState<boolean>(true)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Ensure dark class is removed (fixed light mode)
    try {
      localStorage.removeItem('dma_theme')
      document.documentElement.classList.remove('dark')
    } catch {}

    // 1. Restore locale
    try {
      const savedLocale = localStorage.getItem('dma_locale') as LocaleCode | null
      if (savedLocale && ['vi', 'en', 'cn'].includes(savedLocale)) {
        setLocaleState(savedLocale)
      }
    } catch {}

    // 2. Read token or sessionId from URL
    const urlParams = new URLSearchParams(window.location.search)
    const urlToken =
      urlParams.get('session-token') ||
      urlParams.get('sessionToken') ||
      urlParams.get('sessionId') ||
      urlParams.get('token')

    if (urlToken) {
      localStorage.setItem('dma_session_token', urlToken)
      localStorage.setItem('session-token', urlToken)
      urlParams.delete('session-token')
      urlParams.delete('sessionToken')
      urlParams.delete('sessionId')
      urlParams.delete('token')
      const newUrl =
        window.location.pathname +
        (urlParams.toString() ? `?${urlParams.toString()}` : '')
      window.history.replaceState({}, '', newUrl)
    }

    // 3. Load active user session dynamically
    const loadSessionData = async () => {
      try {
        let activeSession: any = null

        // Check vue-session-key from parent portal / previous Nuxt session
        try {
          const rawVueSession =
            window.sessionStorage.getItem('vue-session-key') ||
            window.localStorage.getItem('vue-session-key')
          if (rawVueSession) {
            const parsed = JSON.parse(rawVueSession)
            if (parsed) {
              activeSession = parsed['dma'] || parsed['vue-session'] || parsed
            }
          }
        } catch {}

        // Check dma-session from localStorage
        if (!activeSession || !activeSession.empno) {
          try {
            const raw =
              localStorage.getItem('dma_user_session') ||
              localStorage.getItem('dma_session') ||
              localStorage.getItem('user')
            if (raw) activeSession = JSON.parse(raw)
          } catch {}
        }

        if (activeSession && (activeSession.empno || activeSession.username)) {
          const loadedUser: UserSession = {
            id: activeSession.id || 0,
            empno: String(activeSession.empno || activeSession.username || '').trim(),
            name: String(activeSession.name || activeSession.username || '').trim(),
            username: String(activeSession.username || activeSession.name || '').trim(),
            dept: String(activeSession.dept || activeSession.dep || '').trim(),
            high_dept: String(
              activeSession.high_dept || activeSession.hight_dept || ''
            ).trim(),
            email: String(activeSession.email || '').trim(),
            ext: String(activeSession.ext || activeSession.phone || '').trim(),
            location: String(activeSession.location || 'VG').trim(),
            role: String(activeSession.role || 'user').trim(),
          }
          setUser(loadedUser)
        }

        // Check remote GMO SSO session if token is available
        const token =
          localStorage.getItem('dma_session_token') ||
          localStorage.getItem('session-token')

        if (token) {
          const res = await fetch(
            'https://gmo021.cansportsvg.com/api/global-user/getUserDataBySession',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                session_token: token,
                sessionId: token,
                app: 'dma',
              }),
            }
          ).catch(() => null)

          if (res && res.ok) {
            const result = await res.json()
            const apiData = result.data || result.user || result
            if (apiData && (apiData.empno || apiData.username)) {
              const liveUser: UserSession = {
                id: apiData.id || 0,
                empno: String(apiData.empno || apiData.username || '').trim(),
                name: String(apiData.name || apiData.username || '').trim(),
                username: String(apiData.username || apiData.name || '').trim(),
                dept: String(apiData.dept || apiData.dep || '').trim(),
                high_dept: String(
                  apiData.high_dept || apiData.hight_dept || ''
                ).trim(),
                email: String(apiData.email || '').trim(),
                ext: String(apiData.ext || apiData.phone || '').trim(),
                location: String(apiData.location || 'VG').trim(),
                role: String(apiData.role || 'user').trim(),
                token,
              }
              setUser(liveUser)
              localStorage.setItem('dma_user_session', JSON.stringify(liveUser))
            }
          }
        }
      } catch (err) {
        console.warn('[SessionContext] Error loading session:', err)
      } finally {
        setIsLoadingSession(false)
      }
    }

    loadSessionData()
  }, [])

  const setLocale = (loc: LocaleCode) => {
    setLocaleState(loc)
    try {
      localStorage.setItem('dma_locale', loc)
    } catch {}
  }

  return (
    <SessionContext.Provider
      value={{
        user,
        setUser,
        locale,
        setLocale,
        isLoadingSession,
      }}
    >
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  return useContext(SessionContext)
}
