export interface DueLabel {
  text: string
  tone: 'overdue' | 'today' | 'soon' | 'normal'
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** 把后端返回的截止时间翻成人话：逾期 2 小时 / 今天 18:00 / 明天 09:30。 */
export function formatDue(dueAt: string | null): DueLabel | null {
  if (!dueAt) return null

  const due = new Date(dueAt)
  if (Number.isNaN(due.getTime())) return null

  const now = new Date()
  const dayDiff = Math.round(
    (startOfDay(due).getTime() - startOfDay(now).getTime()) / 86_400_000,
  )
  const time = `${pad(due.getHours())}:${pad(due.getMinutes())}`

  if (due.getTime() < now.getTime()) {
    return { text: `逾期 · ${time}`, tone: 'overdue' }
  }
  if (dayDiff === 0) return { text: `今天 ${time}`, tone: 'today' }
  if (dayDiff === 1) return { text: `明天 ${time}`, tone: 'soon' }
  if (dayDiff > 1 && dayDiff <= 6) {
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    return { text: `${weekdays[due.getDay()]} ${time}`, tone: 'normal' }
  }
  return { text: `${due.getMonth() + 1} 月 ${due.getDate()} 日 ${time}`, tone: 'normal' }
}

/** 从接口错误里取出能直接给用户看的一句话。 */
export function messageOf(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return '操作失败，请稍后重试'
}
