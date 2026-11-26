import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createApi, type Api } from './api'
import type { CurrentUser } from './types'

const TOKEN_KEY = 'memo.access_token'

type Status = 'loading' | 'authenticated' | 'anonymous'

interface AuthContextValue {
  user: CurrentUser | null
  status: Status
  api: Api
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  /** 任何接口返回 401 时调用：清掉本地凭证，路由会把用户送回登录页。 */
  handleUnauthorized: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading')
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))

  // createApi 只读 ref，所以 api 实例可以只创建一次。
  const tokenRef = useRef<string | null>(token)
  tokenRef.current = token
  const api = useMemo(() => createApi(() => tokenRef.current), [])

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    tokenRef.current = null
    setToken(null)
    setUser(null)
    setStatus('anonymous')
  }, [])

  // 打开或刷新页面时，只要本地有凭证就向后端重新校验一次：
  // 页面上的"已登录"必须由后端确认，不能只看 localStorage 有没有值。
  useEffect(() => {
    if (!token) {
      setUser(null)
      setStatus('anonymous')
      return
    }

    let alive = true
    setStatus('loading')
    api
      .me()
      .then((current) => {
        if (!alive) return
        setUser(current)
        setStatus('authenticated')
      })
      .catch(() => {
        if (!alive) return
        clearSession()
      })

    return () => {
      alive = false
    }
  }, [token, api, clearSession])

  const login = useCallback(
    async (username: string, password: string) => {
      const result = await api.login(username, password)
      localStorage.setItem(TOKEN_KEY, result.access_token)
      tokenRef.current = result.access_token
      // 只把凭证存下来，用户信息统一交给上面的 effect 向后端取，
      // 保证"已登录"这个结论始终来自 /auth/me。
      setStatus('loading')
      setToken(result.access_token)
    },
    [api],
  )

  const logout = useCallback(async () => {
    try {
      await api.logout()
    } catch {
      // 凭证可能已经失效，本地仍然要清干净。
    } finally {
      clearSession()
    }
  }, [api, clearSession])

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, api, login, logout, handleUnauthorized: clearSession }),
    [user, status, api, login, logout, clearSession],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth 必须在 AuthProvider 内使用')
  }
  return context
}
