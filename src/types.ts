export type Quadrant = 1 | 2 | 3 | 4

export interface Memo {
  id: number
  title: string
  due_at: string | null
  quadrant: Quadrant | null
  done: boolean
  sort_order: number
}

export interface CurrentUser {
  id: number
  username: string
  display_name: string
}

export interface QuadrantMeta {
  title: string
  action: string
  hint: string
}

export const QUADRANT_META: Record<Quadrant, QuadrantMeta> = {
  1: { title: '重要 · 紧急', action: '立刻做', hint: '今天不做就会出事' },
  2: { title: '重要 · 不紧急', action: '计划做', hint: '决定长期差距的事' },
  3: { title: '不重要 · 紧急', action: '尽快处理', hint: '别人的急事，别久留' },
  4: { title: '不重要 · 不紧急', action: '有空再说', hint: '砍掉也不心疼' },
}

export const QUADRANT_ORDER: Quadrant[] = [1, 2, 3, 4]

/**
 * 四象限其实是两个独立维度组合出来的：重要性 × 紧迫性。
 * 新建时让用户分别选，比直接选四个组合更贴近艾森豪威尔的原始说法。
 */
export type Importance = 'important' | 'unimportant'
export type Urgency = 'urgent' | 'calm'
export type TagTone = Importance | Urgency

export const IMPORTANCE_ORDER: Importance[] = ['important', 'unimportant']
export const URGENCY_ORDER: Urgency[] = ['urgent', 'calm']

export const IMPORTANCE_LABEL: Record<Importance, string> = {
  important: '重要',
  unimportant: '不重要',
}

export const URGENCY_LABEL: Record<Urgency, string> = {
  urgent: '紧急',
  calm: '不紧急',
}

/** 两个维度各选一个，合成象限编号。 */
export function combineQuadrant(importance: Importance, urgency: Urgency): Quadrant {
  if (importance === 'important') {
    return urgency === 'urgent' ? 1 : 2
  }
  return urgency === 'urgent' ? 3 : 4
}

export interface TagChip {
  label: string
  tone: TagTone
}

/** 四象限反过来拆成两个独立标签，列表页就这么显示。 */
export function quadrantTags(quadrant: Quadrant): [TagChip, TagChip] {
  const urgency: Urgency = quadrant === 1 || quadrant === 3 ? 'urgent' : 'calm'
  const importance: Importance = quadrant === 1 || quadrant === 2 ? 'important' : 'unimportant'
  return [
    { label: URGENCY_LABEL[urgency], tone: urgency },
    { label: IMPORTANCE_LABEL[importance], tone: importance },
  ]
}
