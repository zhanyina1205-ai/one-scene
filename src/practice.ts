import { timestamp, uid, type Dialogue, type PracticeBookmark, type PracticeRange, type Scene, type ScriptRevision, type Workspace } from './domain'

export const MAX_PRACTICE_LINES = 200
export const MAX_PRACTICE_TEXT = 20000
const selfLabels = new Set(['我', '本人'])
const actionLabels = new Set(['动作', '旁白', '说明'])
export function speakerLabels(text: string): string[] {
  return [...new Set(text.split(/\r?\n/).map(line => line.trim().match(/^([^:：]{1,30})\s*[:：]/)?.[1].trim()).filter((label): label is string => Boolean(label) && !actionLabels.has(label!)))]
}
export function parseDialogue(text: string, role: string): { lines: Dialogue[]; errors: string[] } {
  const lines: Dialogue[] = []
  const errors: string[] = []
  if (text.length > MAX_PRACTICE_TEXT) return { lines, errors: ['这段超过20000字，请只粘贴本次要练的部分。'] }
  const rows = text.split(/\r?\n/)
  if (rows.filter(line => line.trim()).length > MAX_PRACTICE_LINES) return { lines, errors: ['一次最多200段，请分成更短的练习。'] }
  rows.forEach((row, index) => {
    if (!row.trim()) return
    const match = row.trim().match(/^([^:：]{1,30})\s*[:：]\s*(.*)$/)
    if (!match) { errors.push(`第${index + 1}行没有说话人标记，请加上“我：”“对手：”“动作：”或角色名。`); return }
    const label = match[1].trim()
    const content = match[2].trim()
    if (!content) { errors.push(`第${index + 1}行没有台词或动作内容。`); return }
    if (content.length > 1200) { errors.push(`第${index + 1}行太长，请拆成1200字以内的段落。`); return }
    const kind = actionLabels.has(label) ? 'action' : selfLabels.has(label) || label === role.trim() ? 'self' : 'other'
    lines.push({ id: uid(), kind, text: content, ...(![...selfLabels, ...actionLabels, '对手'].includes(label) ? { speaker: label } : {}) })
  })
  if (!lines.length && !errors.length) errors.push('请先粘贴几句带说话人标记的台词。')
  if (lines.length && !lines.some(line => line.kind === 'self')) errors.push('没有找到本人台词，请选择对应的角色，或把本人的行标为“我：”。')
  return { lines, errors }
}
export function formatDialogue(lines: Dialogue[]): string {
  return lines.map(line => `${line.speaker || (line.kind === 'self' ? '我' : line.kind === 'other' ? '对手' : '动作')}：${line.text}`).join('\n')
}
export const dialogueKey = (lines: Dialogue[]) => JSON.stringify(lines.map(line => [line.kind, line.text.trim(), line.speaker || '']))
export const lineSide = (line: Dialogue, side: 'self' | 'other'): 'self' | 'other' | 'action' => line.kind === 'action' ? 'action' : line.kind === side ? 'self' : 'other'
export const bracketOnly = (text: string) => /^(?:（[^（）]*）|\([^()]*\))$/.test(text.trim())
export const canReadLine = (line: Dialogue, side: 'self' | 'other') => lineSide(line, side) === 'other' && Boolean(line.text.trim()) && !bracketOnly(line.text)
export function validBookmark(bookmark: PracticeBookmark | undefined, scene: Scene): bookmark is PracticeBookmark {
  if (!bookmark || !bookmark.range || bookmark.sceneId !== scene.id || bookmark.version !== scene.version || bookmark.script !== dialogueKey(scene.dialogue)) return false
  return Number.isInteger(bookmark.range.start) && Number.isInteger(bookmark.range.end) && bookmark.range.start >= 0 && bookmark.range.end < scene.dialogue.length && bookmark.range.start <= bookmark.range.end && Number.isInteger(bookmark.position) && bookmark.position >= bookmark.range.start && bookmark.position <= bookmark.range.end && ['self', 'other'].includes(bookmark.side) && Number.isFinite(bookmark.rate) && bookmark.rate >= 0.6 && bookmark.rate <= 1.3 && typeof bookmark.hidden === 'boolean' && typeof bookmark.loop === 'boolean'
}
export function resumeScene(workspace: Workspace, projectId: string): Scene | undefined {
  const scenes = workspace.scenes.filter(scene => scene.projectId === projectId)
  return scenes.filter(scene => validBookmark(workspace.practice?.[scene.id], scene)).sort((first, second) => workspace.practice![second.id].updatedAt.localeCompare(workspace.practice![first.id].updatedAt))[0] || scenes[0]
}

export interface LineDifference {
  kind: 'same' | 'added' | 'removed' | 'changed'
  before?: Dialogue
  after?: Dialogue
  beforeIndex?: number
  afterIndex: number
}
export function compareDialogue(before: Dialogue[], after: Dialogue[]): LineDifference[] {
  if (before.length > MAX_PRACTICE_LINES || after.length > MAX_PRACTICE_LINES) throw new Error('每次最多比较200段，请缩小到当前要练的范围。')
  const keysBefore = before.map(line => dialogueKey([line]))
  const keysAfter = after.map(line => dialogueKey([line]))
  const matrix = Array.from({ length: before.length + 1 }, () => new Uint16Array(after.length + 1))
  for (let row = before.length - 1; row >= 0; row--) for (let column = after.length - 1; column >= 0; column--) {
    matrix[row][column] = keysBefore[row] === keysAfter[column] ? matrix[row + 1][column + 1] + 1 : Math.max(matrix[row + 1][column], matrix[row][column + 1])
  }
  const operations: LineDifference[] = []
  let beforeIndex = 0
  let afterIndex = 0
  while (beforeIndex < before.length || afterIndex < after.length) {
    if (beforeIndex < before.length && afterIndex < after.length && keysBefore[beforeIndex] === keysAfter[afterIndex]) {
      operations.push({ kind: 'same', before: before[beforeIndex], after: after[afterIndex], beforeIndex, afterIndex }); beforeIndex++; afterIndex++
    } else if (beforeIndex < before.length && (afterIndex === after.length || matrix[beforeIndex + 1][afterIndex] >= matrix[beforeIndex][afterIndex + 1])) {
      operations.push({ kind: 'removed', before: before[beforeIndex], beforeIndex, afterIndex }); beforeIndex++
    } else {
      operations.push({ kind: 'added', after: after[afterIndex], afterIndex }); afterIndex++
    }
  }
  const result: LineDifference[] = []
  for (let position = 0; position < operations.length;) {
    if (operations[position].kind === 'same') { result.push(operations[position++]); continue }
    const group: LineDifference[] = []
    while (position < operations.length && operations[position].kind !== 'same') group.push(operations[position++])
    const removed = group.filter(item => item.kind === 'removed')
    const added = group.filter(item => item.kind === 'added')
    for (let offset = 0; offset < Math.max(removed.length, added.length); offset++) {
      result.push(removed[offset] && added[offset] ? { kind: 'changed', before: removed[offset].before, after: added[offset].after, beforeIndex: removed[offset].beforeIndex, afterIndex: added[offset].afterIndex } : removed[offset] || added[offset])
    }
  }
  return result
}
export function rangeForChange(change: LineDifference, lines: Dialogue[]): PracticeRange | null {
  if (!lines.length || change.kind === 'same') return null
  const anchor = Math.min(change.afterIndex, lines.length - 1)
  let start = anchor
  if (lines[anchor].kind !== 'other' || change.kind === 'removed') {
    start = Math.max(0, anchor - 1)
    for (let position = Math.max(0, anchor - 1); position >= 0; position--) if (lines[position].kind === 'other') { start = position; break }
  }
  let end = anchor
  for (let position = anchor; position < lines.length; position++) if (lines[position].kind === 'self') { end = position; break }
  return { start, end: Math.max(start, end) }
}
export function changedRanges(changes: LineDifference[], lines: Dialogue[]): PracticeRange[] {
  const ranges = changes.map(change => rangeForChange(change, lines)).filter((range): range is PracticeRange => range !== null).sort((first, second) => first.start - second.start)
  const result: PracticeRange[] = []
  for (const range of ranges) {
    const previous = result[result.length - 1]
    if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end)
    else result.push({ ...range })
  }
  return result
}
export function applyRevision(workspace: Workspace, expected: Scene, next: Dialogue[], original: string, version: string, practiceRole?: string): { workspace: Workspace; revision: ScriptRevision } {
  const current = workspace.scenes.find(scene => scene.id === expected.id)
  if (!current || current.version !== expected.version || dialogueKey(current.dialogue) !== dialogueKey(expected.dialogue) || current.updatedAt !== expected.updatedAt) throw new Error('当前场次已变化，请重新加载旧版再比较，未覆盖任何内容。')
  if (!version.trim() || version.trim() === current.version) throw new Error('请为新版填写与当前版本不同的名称。')
  if (!next.length || dialogueKey(next) === dialogueKey(current.dialogue)) throw new Error('新版没有可保存的台词变化。')
  const changes = compareDialogue(current.dialogue, next).filter(item => item.kind !== 'same')
  const time = timestamp()
  const after: Scene = { ...structuredClone(current), ...(practiceRole ? { practiceRole } : {}), version: version.trim(), original: original.trim(), dialogue: structuredClone(next), changes: `${current.version} → ${version.trim()}：${changes.length}处逐行增删改；文本差异不是剧情解读。`, updatedAt: time }
  const revision: ScriptRevision = { id: uid(), sceneId: current.id, before: structuredClone(current), after: structuredClone(after), createdAt: time }
  return { workspace: { ...workspace, scenes: workspace.scenes.map(scene => scene.id === current.id ? after : scene), revisions: [...(workspace.revisions || []), revision] }, revision }
}
