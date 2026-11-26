import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { ApiError } from '../api'
import { useAuth } from '../auth'
import {
  IMPORTANCE_LABEL,
  IMPORTANCE_ORDER,
  URGENCY_LABEL,
  URGENCY_ORDER,
  combineQuadrant,
  quadrantTags,
  type Importance,
  type Memo,
  type Urgency,
} from '../types'
import { formatDue, messageOf } from '../utils'

/** 重要性和紧迫性分开存，两个都选了才合成象限。 */
type Draft = {
  title: string
  dueAt: string
  importance: Importance | ''
  urgency: Urgency | ''
}

const EMPTY_DRAFT: Draft = { title: '', dueAt: '', importance: '', urgency: '' }

const LONG_PRESS_MS = 280
const MOVE_TOLERANCE_PX = 10

export default function MemoPage() {
  const { api, handleUnauthorized } = useAuth()

  const [memos, setMemos] = useState<Memo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [submitting, setSubmitting] = useState(false)
  const [draftError, setDraftError] = useState<string | null>(null)

  const [dragId, setDragId] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  const listRef = useRef<HTMLUListElement | null>(null)
  const pressRef = useRef<{ id: number; y: number; timer: number } | null>(null)
  const draggingRef = useRef(false)
  const memosRef = useRef<Memo[]>([])
  const dropIndexRef = useRef<number | null>(null)

  memosRef.current = memos
  dropIndexRef.current = dropIndex

  const fail = useCallback(
    (caught: unknown) => {
      if (caught instanceof ApiError && caught.status === 401) {
        // 凭证失效：清掉本地状态，路由会把用户送回登录页。
        handleUnauthorized()
        return
      }
      setError(messageOf(caught))
    },
    [handleUnauthorized],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await api.listMemos()
      setMemos(list)
    } catch (caught) {
      fail(caught)
    } finally {
      setLoading(false)
    }
  }, [api, fail])

  useEffect(() => {
    void load()
  }, [load])

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    const title = draft.title.trim()
    if (!title) {
      setDraftError('先写清楚要做什么')
      return
    }
    // 两行各选一个才放行，避免出现"不知道该算哪个象限"的半成品。
    if (!draft.importance) {
      setDraftError('第一行还没选：这件事重要吗？')
      return
    }
    if (!draft.urgency) {
      setDraftError('第二行还没选：这件事紧急吗？')
      return
    }

    setSubmitting(true)
    setDraftError(null)
    try {
      const created = await api.createMemo({
        title,
        due_at: draft.dueAt ? draft.dueAt : null,
        quadrant: combineQuadrant(draft.importance, draft.urgency),
      })
      setMemos((previous) => [...previous, created])
      // 标签沿用上一次的选择，连着录几条同类事时不用反复点。
      setDraft((previous) => ({
        ...EMPTY_DRAFT,
        importance: previous.importance,
        urgency: previous.urgency,
      }))
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        handleUnauthorized()
      } else {
        setDraftError(messageOf(caught))
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleDone(memo: Memo) {
    setBusyId(memo.id)
    try {
      const updated = await api.updateMemo(memo.id, { done: !memo.done })
      setMemos((previous) => previous.map((item) => (item.id === updated.id ? updated : item)))
    } catch (caught) {
      fail(caught)
    } finally {
      setBusyId(null)
    }
  }

  async function remove(memo: Memo) {
    setBusyId(memo.id)
    try {
      await api.deleteMemo(memo.id)
      setMemos((previous) => previous.filter((item) => item.id !== memo.id))
    } catch (caught) {
      fail(caught)
    } finally {
      setBusyId(null)
    }
  }

  function cancelPress() {
    if (pressRef.current) {
      window.clearTimeout(pressRef.current.timer)
      pressRef.current = null
    }
  }

  function commitReorder(fromId: number, targetIndex: number) {
    const current = memosRef.current
    const fromIndex = current.findIndex((memo) => memo.id === fromId)
    if (fromIndex < 0) return

    const next = [...current]
    next.splice(fromIndex, 1)
    // 目标位置是在"还没移走"的列表里算出来的，往下拖要减掉自己占的那一格。
    const insertAt = targetIndex > fromIndex ? targetIndex - 1 : targetIndex
    next.splice(Math.max(0, Math.min(insertAt, next.length)), 0, current[fromIndex])

    if (next.every((memo, index) => memo.id === current[index].id)) return

    setMemos(next)
    api.reorderMemos(next.map((memo) => memo.id)).catch((caught: unknown) => {
      fail(caught)
      // 顺序没存上就把列表拉回后端的真实顺序。
      void load()
    })
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLLIElement>, memo: Memo) {
    if (event.button !== 0) return
    // 圆点和删除按钮上的按下不应该触发拖动。
    if ((event.target as HTMLElement).closest('button')) return

    pressRef.current = {
      id: memo.id,
      y: event.clientY,
      timer: window.setTimeout(() => {
        draggingRef.current = true
        setDragId(memo.id)
        setDropIndex(null)
        document.body.classList.add('is-dragging-row')
      }, LONG_PRESS_MS),
    }
  }

  // 长按之后才进入拖动；监听挂在 window 上，指针移出列表也不会丢事件。
  useEffect(() => {
    function computeDropIndex(clientY: number): number {
      const rows = listRef.current?.querySelectorAll<HTMLLIElement>('[data-memo-row]')
      if (!rows || rows.length === 0) return 0
      for (let index = 0; index < rows.length; index += 1) {
        const rect = rows[index].getBoundingClientRect()
        if (clientY < rect.top + rect.height / 2) return index
      }
      return rows.length
    }

    function handleMove(event: PointerEvent) {
      const press = pressRef.current
      if (press && !draggingRef.current) {
        // 还没长按就明显移动，说明用户只是想点击或滚动，取消计时。
        if (Math.abs(event.clientY - press.y) > MOVE_TOLERANCE_PX) cancelPress()
        return
      }
      if (!draggingRef.current) return
      event.preventDefault()
      setDropIndex(computeDropIndex(event.clientY))
    }

    function finishDrag() {
      if (draggingRef.current) {
        const fromId = pressRef.current?.id
        const target = dropIndexRef.current
        draggingRef.current = false
        pressRef.current = null
        setDragId(null)
        setDropIndex(null)
        document.body.classList.remove('is-dragging-row')
        if (fromId !== undefined && target !== null) commitReorder(fromId, target)
        return
      }
      cancelPress()
    }

    window.addEventListener('pointermove', handleMove, { passive: false })
    window.addEventListener('pointerup', finishDrag)
    window.addEventListener('pointercancel', finishDrag)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', finishDrag)
      window.removeEventListener('pointercancel', finishDrag)
    }
  }, [])

  const pendingCount = memos.filter((memo) => !memo.done).length

  return (
    <div className="stack">
      <section className="hero">
        <div>
          <h1 className="hero-title">备忘录</h1>
          <p className="hero-sub">写下要做的事，标上最后的期限，再看它在四象限里的位置。</p>
        </div>
        <p className="hero-count">
          未完成 <strong>{pendingCount}</strong> 件
        </p>
      </section>

      <form className="composer" onSubmit={handleCreate}>
        <div className="composer-main">
          <input
            className="composer-input"
            type="text"
            placeholder="要做什么？例如：把评审意见回完"
            value={draft.title}
            maxLength={120}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            disabled={submitting}
          />
          <label className="composer-due">
            <span>截止</span>
            <input
              type="datetime-local"
              value={draft.dueAt}
              onChange={(event) => setDraft({ ...draft, dueAt: event.target.value })}
              disabled={submitting}
            />
          </label>
        </div>

        <div className="composer-tags">
          <div className="tag-rows">
            <div className="tag-row">
              <span className="tag-row-label">重要性</span>
              <div className="tag-choices" role="group" aria-label="这件事重要吗">
                {IMPORTANCE_ORDER.map((value) => {
                  const active = draft.importance === value
                  return (
                    <button
                      key={value}
                      type="button"
                      className={active ? `tag-choice tone-${value} active` : `tag-choice tone-${value}`}
                      aria-pressed={active}
                      onClick={() =>
                        setDraft({ ...draft, importance: active ? '' : value })
                      }
                      disabled={submitting}
                    >
                      {IMPORTANCE_LABEL[value]}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="tag-row">
              <span className="tag-row-label">紧迫性</span>
              <div className="tag-choices" role="group" aria-label="这件事紧急吗">
                {URGENCY_ORDER.map((value) => {
                  const active = draft.urgency === value
                  return (
                    <button
                      key={value}
                      type="button"
                      className={active ? `tag-choice tone-${value} active` : `tag-choice tone-${value}`}
                      aria-pressed={active}
                      onClick={() => setDraft({ ...draft, urgency: active ? '' : value })}
                      disabled={submitting}
                    >
                      {URGENCY_LABEL[value]}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <button type="submit" className="btn btn-primary composer-add" disabled={submitting}>
            {submitting ? '保存中…' : '添加'}
          </button>
        </div>

        {draftError ? (
          <p className="form-error" role="alert">
            {draftError}
          </p>
        ) : null}
      </form>

      {error ? (
        <div className="banner banner-error" role="alert">
          <span>{error}</span>
          <button type="button" className="btn btn-ghost" onClick={() => void load()}>
            重新加载
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="center-state">
          <span className="spinner" aria-hidden="true" />
          <p>正在读取你的备忘录…</p>
        </div>
      ) : memos.length === 0 ? (
        <div className="empty-state">
          <p className="empty-title">还什么都没写</p>
          <p className="empty-hint">上面输入一件有截止时间的事，标上「紧急」或「重要」，它就会出现在这里。</p>
        </div>
      ) : (
        <>
          <p className="list-tip">长按任意一行 0.3 秒，再上下拖动，可以调整先后顺序。</p>
          <ul className="memo-list" ref={listRef}>
            {memos.map((memo, index) => {
              const due = formatDue(memo.due_at)
              const isDragging = dragId === memo.id
              const showDropLine = dragId !== null && dropIndex === index

              return (
                <li
                  key={memo.id}
                  data-memo-row
                  className={[
                    'memo-row',
                    memo.done ? 'is-done' : '',
                    isDragging ? 'is-dragging' : '',
                    showDropLine ? 'has-drop-line' : '',
                    busyId === memo.id ? 'is-busy' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onPointerDown={(event) => handlePointerDown(event, memo)}
                >
                  <button
                    type="button"
                    className={memo.done ? 'bullet done' : 'bullet'}
                    aria-label={memo.done ? `把「${memo.title}」恢复为未完成` : `把「${memo.title}」划掉`}
                    aria-pressed={memo.done}
                    onClick={() => void toggleDone(memo)}
                  >
                    {memo.done ? (
                      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                        <path
                          d="M3 8.5L6.2 11.7L13 4.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : null}
                  </button>

                  <div className="memo-body">
                    <p className="memo-title">{memo.title}</p>
                    <div className="memo-meta">
                      {due ? (
                        <span className={`due tone-${due.tone}`}>{due.text}</span>
                      ) : (
                        <span className="due muted">没有截止时间</span>
                      )}
                      {memo.quadrant ? (
                        quadrantTags(memo.quadrant).map((tag) => (
                          <span key={tag.tone} className={`chip chip-${tag.tone}`}>
                            {tag.label}
                          </span>
                        ))
                      ) : (
                        <span className="chip chip-muted">未分类</span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="row-delete"
                    aria-label={`删除「${memo.title}」`}
                    onClick={() => void remove(memo)}
                  >
                    ×
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
