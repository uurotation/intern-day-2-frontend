import type { CurrentUser, Memo, Quadrant } from './types'

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000').replace(/\/$/, '')

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export interface MemoInput {
  title: string
  due_at?: string | null
  quadrant?: Quadrant | null
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  token?: string | null
}

async function readDetail(response: Response, fallback: string): Promise<string> {
  try {
    const data: unknown = await response.json()
    if (typeof data === 'object' && data !== null && 'detail' in data) {
      const detail = (data as { detail: unknown }).detail
      if (typeof detail === 'string') return detail
      if (Array.isArray(detail) && detail.length > 0) {
        const first = detail[0] as { msg?: unknown }
        if (typeof first.msg === 'string') return first.msg
      }
    }
  } catch {
    // 响应不是 JSON 时就用兜底文案。
  }
  return fallback
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`
  }

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch {
    throw new ApiError(0, '连不上后端服务，请确认后端已启动')
  }

  if (response.status === 401) {
    throw new ApiError(401, await readDetail(response, '登录状态已失效，请重新登录'))
  }
  if (!response.ok) {
    throw new ApiError(response.status, await readDetail(response, `请求失败（${response.status}）`))
  }
  if (response.status === 204) {
    return undefined as T
  }
  return (await response.json()) as T
}

/**
 * 每次请求都显式带上当前凭证，凭证本身由 AuthProvider 保存在 localStorage。
 * 不把 token 写死在模块里，退出登录后旧请求不会带着过期凭证继续发。
 */
export function createApi(getToken: () => string | null) {
  return {
    login(username: string, password: string) {
      return request<{ access_token: string; token_type: string; expires_in: number }>(
        '/auth/login',
        { method: 'POST', body: { username, password } },
      )
    },
    me() {
      return request<CurrentUser>('/auth/me', { token: getToken() })
    },
    logout() {
      return request<void>('/auth/logout', { method: 'POST', token: getToken() })
    },
    listMemos() {
      return request<Memo[]>('/memos', { token: getToken() })
    },
    createMemo(input: MemoInput) {
      return request<Memo>('/memos', { method: 'POST', body: input, token: getToken() })
    },
    updateMemo(id: number, patch: Partial<MemoInput> & { done?: boolean }) {
      return request<Memo>(`/memos/${id}`, { method: 'PATCH', body: patch, token: getToken() })
    },
    deleteMemo(id: number) {
      return request<void>(`/memos/${id}`, { method: 'DELETE', token: getToken() })
    },
    reorderMemos(ids: number[]) {
      return request<void>('/memos/reorder', { method: 'POST', body: { ids }, token: getToken() })
    },
  }
}

export type Api = ReturnType<typeof createApi>
