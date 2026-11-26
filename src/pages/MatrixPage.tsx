import { useCallback, useEffect, useState, type DragEvent } from 'react'
import { ApiError } from '../api'
import { useAuth } from '../auth'
import { QUADRANT_META, QUADRANT_ORDER, type Memo, type Quadrant } from '../types'
import { formatDue, messageOf } from '../utils'

type DropTarget = Quadrant | 'pool'

const DRAG_TYPE = 'text/plain'

export default function MatrixPage() {
  const { api, handleUnauthorized } = useAuth()

  const [memos, setMemos] = useState<Memo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)
  const [draggingId, setDraggingId] = useState<number | null>(null)

  const fail = useCallback(
    (caught: unknown) => {
      if (caught instanceof ApiError && caught.status === 401) {
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
      setMemos(await api.listMemos())
    } catch (caught) {
      fail(caught)
    } finally {
      setLoading(false)
    }
  }, [api, fail])

  useEffect(() => {
    void load()
  }, [load])

  async function moveTo(memoId: number, target: Quadrant | null) {
    const before = memos
    // 先动界面再发请求：拖过去就应该立刻到位，失败再退回原样。
    setMemos((previous) =>
      previous.map((memo) => (memo.id === memoId ? { ...memo, quadrant: target } : memo)),
    )
    try {
      const updated = await api.updateMemo(memoId, { quadrant: target })
      setMemos((previous) => previous.map((memo) => (memo.id === updated.id ? updated : memo)))
    } catch (caught) {
      setMemos(before)
      fail(caught)
    }
  }

  function handleDragStart(event: DragEvent<HTMLElement>, memo: Memo) {
    event.dataTransfer.setData(DRAG_TYPE, String(memo.id))
    event.dataTransfer.effectAllowed = 'move'
    setDraggingId(memo.id)
  }

  function handleDragEnd() {
    setDraggingId(null)
    setDropTarget(null)
  }

  function handleDragOver(event: DragEvent<HTMLElement>, target: DropTarget) {
    // 不阻止默认行为的话，浏览器不会把它当成合法的放置目标。
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDropTarget(target)
  }

  function handleDrop(event: DragEvent<HTMLElement>, target: DropTarget) {
    event.preventDefault()
    const raw = event.dataTransfer.getData(DRAG_TYPE)
    const memoId = Number(raw)
    setDropTarget(null)
    setDraggingId(null)
    if (!Number.isFinite(memoId) || memoId <= 0) return
    void moveTo(memoId, target === 'pool' ? null : target)
  }

  const pool = memos.filter((memo) => memo.quadrant === null)
  const unclassifiedPending = pool.filter((memo) => !memo.done).length

  function renderCard(memo: Memo) {
    const due = formatDue(memo.due_at)
    return (
      <article
        key={memo.id}
        className={[
          'matrix-card',
          memo.done ? 'is-done' : '',
          draggingId === memo.id ? 'is-dragging' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        draggable
        onDragStart={(event) => handleDragStart(event, memo)}
        onDragEnd={handleDragEnd}
      >
        <p className="matrix-card-title">{memo.title}</p>
        <div className="matrix-card-foot">
          {due ? <span className={`due tone-${due.tone}`}>{due.text}</span> : <span className="due muted">无期限</span>}
          {memo.quadrant !== null ? (
            <button
              type="button"
              className="link-btn"
              onClick={() => void moveTo(memo.id, null)}
              aria-label={`把「${memo.title}」移回未分类`}
            >
              移出
            </button>
          ) : null}
        </div>
      </article>
    )
  }

  if (loading) {
    return (
      <div className="center-state">
        <span className="spinner" aria-hidden="true" />
        <p>正在整理四象限…</p>
      </div>
    )
  }

  return (
    <div className="stack">
      <section className="hero">
        <div>
          <h1 className="hero-title">四象限</h1>
          <p className="hero-sub">
            把左边的待办拖进对应的格子里，标签就跟着变了：拖进「重要 · 不紧急」，它就同时带上「不紧急」和「重要」。
          </p>
        </div>
        <p className="hero-count">
          待分类 <strong>{unclassifiedPending}</strong> 件
        </p>
      </section>

      {error ? (
        <div className="banner banner-error" role="alert">
          <span>{error}</span>
          <button type="button" className="btn btn-ghost" onClick={() => void load()}>
            重新加载
          </button>
        </div>
      ) : null}

      <div className="matrix-layout">
        <section
          className={dropTarget === 'pool' ? 'pool is-over' : 'pool'}
          onDragOver={(event) => handleDragOver(event, 'pool')}
          onDragLeave={() => setDropTarget(null)}
          onDrop={(event) => handleDrop(event, 'pool')}
          aria-label="未分类的待办"
        >
          <header className="pool-head">
            <h2 className="panel-title">待分类</h2>
            <span className="panel-count">{pool.length}</span>
          </header>
          <p className="pool-hint">从这里拖到右边任意一格；拖回来就是取消分类。</p>

          {pool.length === 0 ? (
            <p className="empty-hint small">没有待分类的事。在「备忘录」里新增一条，标签留空即可。</p>
          ) : (
            <div className="card-stack">{pool.map(renderCard)}</div>
          )}
        </section>

        <div className="quadrant-grid">
          {QUADRANT_ORDER.map((quadrant) => {
            const items = memos.filter((memo) => memo.quadrant === quadrant)
            const meta = QUADRANT_META[quadrant]

            return (
              <section
                key={quadrant}
                className={[
                  'quadrant',
                  `q${quadrant}`,
                  dropTarget === quadrant ? 'is-over' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onDragOver={(event) => handleDragOver(event, quadrant)}
                onDragLeave={() => setDropTarget(null)}
                onDrop={(event) => handleDrop(event, quadrant)}
              >
                <header className="quadrant-head">
                  <div>
                    <h2 className="quadrant-title">{meta.title}</h2>
                    <p className="quadrant-hint">
                      {meta.action} · {meta.hint}
                    </p>
                  </div>
                  <span className="panel-count">{items.length}</span>
                </header>

                {items.length === 0 ? (
                  <p className="empty-hint small">把待办拖到这里</p>
                ) : (
                  <div className="card-stack">{items.map(renderCard)}</div>
                )}
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
