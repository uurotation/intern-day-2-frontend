import type { ReactNode } from 'react'
import { Navigate, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'

export function FullPageLoading({ text = '正在读取登录状态…' }: { text?: string }) {
  return (
    <div className="center-state">
      <span className="spinner" aria-hidden="true" />
      <p>{text}</p>
    </div>
  )
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status } = useAuth()

  if (status === 'loading') return <FullPageLoading />
  // 未登录直接输入功能页地址，会被送回登录页，受保护内容根本不会渲染。
  if (status === 'anonymous') return <Navigate to="/login" replace />

  return <>{children}</>
}

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-shell">
      <header className="app-bar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-name">四象限备忘</span>
        </div>

        <nav className="nav" aria-label="主导航">
          <NavLink to="/memo" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
            备忘录
          </NavLink>
          <NavLink to="/matrix" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
            四象限
          </NavLink>
        </nav>

        <div className="account">
          {user ? (
            <span className="account-name" title={`账号：${user.username}`}>
              {user.display_name}
            </span>
          ) : null}
          <button type="button" className="btn btn-ghost" onClick={handleLogout}>
            退出
          </button>
        </div>
      </header>

      <main className="page">{children}</main>
    </div>
  )
}
