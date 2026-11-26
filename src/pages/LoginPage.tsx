import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { ApiError } from '../api'
import { useAuth } from '../auth'
import { FullPageLoading } from '../components/Layout'

export default function LoginPage() {
  const { status, login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (status === 'loading') return <FullPageLoading />
  if (status === 'authenticated') return <Navigate to="/memo" replace />

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    // 必填校验放在前端，真正的账号密码校验只可能发生在后端。
    if (!username.trim() || !password) {
      setError('请填写账号和密码')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await login(username.trim(), password)
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message)
      } else {
        setError('登录失败，请稍后重试')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <p className="login-kicker">登录后只看见你自己的事</p>
        <h1 className="login-title">四象限备忘</h1>
        <p className="login-subtitle">把要做的事写下来，贴上「紧急」「重要」的标签，再看清哪一件真的该先做。</p>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <label className="field">
            <span className="field-label">账号</span>
            <input
              type="text"
              value={username}
              autoComplete="username"
              placeholder="请输入账号"
              onChange={(event) => setUsername(event.target.value)}
              disabled={submitting}
            />
          </label>

          <label className="field">
            <span className="field-label">密码</span>
            <input
              type="password"
              value={password}
              autoComplete="current-password"
              placeholder="请输入密码"
              onChange={(event) => setPassword(event.target.value)}
              disabled={submitting}
            />
          </label>

          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}

          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? (
              <>
                <span className="spinner spinner-sm" aria-hidden="true" />
                正在登录…
              </>
            ) : (
              '登录'
            )}
          </button>
        </form>

        <p className="login-hint">练习账号由后端初始化脚本创建，账号密码见 README「初始化练习账号」一节。</p>
      </div>
    </div>
  )
}
