import { describe, expect, it } from 'vitest'
import { createDraft, removeScene, saveSession, type Dialogue, type PracticeBookmark } from '../src/domain'
import { demoWorkspace } from '../src/seed'
import { ensurePracticeDemo, tenLines } from '../src/practice-demo'
import { applyRevision, bracketOnly, canReadLine, changedRanges, compareDialogue, dialogueKey, formatDialogue, lineSide, parseDialogue, rangeForChange, resumeScene, speakerLabels, validBookmark } from '../src/practice'

const parse = (text: string) => parseDialogue(text, '周宁').lines
const lines = () => parse(tenLines)

describe('粘贴后人工核对说话人', () => {
  it('识别角色名、本人别名、动作和多位对手，不把动作读成台词', () => {
    const result = parseDialogue('林舟：等一下。\n周宁：为什么？\n动作：停步。\n旁白：天黑了。\n第三人：门开了。\n我：知道了。', '周宁')
    expect(result.errors).toEqual([])
    expect(result.lines.map(line => line.kind)).toEqual(['other', 'self', 'action', 'action', 'other', 'self'])
    expect(result.lines[0].speaker).toBe('林舟')
    expect(speakerLabels('林舟：等。\n周宁：好。\n动作：停。\n林舟：看。')).toEqual(['林舟', '周宁'])
  })
  it('未标记、空内容、无本人和空白输入都明确报错，不静默猜测', () => {
    expect(parseDialogue('这句是谁说的\n我：', '周宁').errors).toHaveLength(2)
    expect(parseDialogue('林舟：等。', '周宁').errors.join('')).toContain('没有找到本人')
    expect(parseDialogue(' \n', '周宁').errors.join('')).toContain('请先粘贴')
  })
  it('限制总字数、段数及单段长度', () => {
    expect(parseDialogue('我：' + '词'.repeat(20000), '').errors[0]).toContain('20000')
    expect(parseDialogue(Array.from({ length: 201 }, () => '我：词').join('\n'), '').errors[0]).toContain('200段')
    expect(parseDialogue('我：' + '词'.repeat(1201), '').errors[0]).toContain('1200')
  })
  it('格式往返保留角色与归属，行ID变化不会误报改词', () => {
    const original = lines()
    expect(dialogueKey(parse(formatDialogue(original)))).toBe(dialogueKey(original))
    expect(dialogueKey(original.map(line => ({ ...line, id: 'new-id' })))).toBe(dialogueKey(original))
    expect(dialogueKey([{ ...original[0], speaker: '另一人' }])).not.toBe(dialogueKey([original[0]]))
  })
  it('遮词与朗读仅针对当前练习方，动作和整段括号说明不读', () => {
    expect(lineSide(lines()[0], 'other')).toBe('self')
    expect(canReadLine(lines()[0], 'self')).toBe(true)
    expect(canReadLine(lines()[1], 'self')).toBe(false)
    expect(canReadLine({ id: 'a', kind: 'action', text: '看向门口' }, 'other')).toBe(false)
    expect(bracketOnly('（看向门口）')).toBe(true)
    expect(canReadLine({ id: 'b', kind: 'other', text: '(停顿)' }, 'self')).toBe(false)
    expect(bracketOnly('（停顿）你来了。')).toBe(false)
  })
})

describe('逐行改词与上下文练习', () => {
  it('只替换一句时保留其余行，不把标点或归属变化当作未改', () => {
    const before = lines(); const after = structuredClone(before)
    after[3].text = '那我就不等了。'
    const differences = compareDialogue(before, after)
    expect(differences.filter(item => item.kind === 'same')).toHaveLength(9)
    expect(differences.filter(item => item.kind === 'changed')).toHaveLength(1)
    expect(changedRanges(differences, after)).toEqual([{ start: 2, end: 3 }])
    after[3].kind = 'other'
    expect(compareDialogue(before, after)[3].kind).toBe('changed')
  })
  it('新增提示句包含其后的本人回应，删除末句仍有有效练习范围', () => {
    const before = lines(); const added = [...before.slice(0, 2), ...parse('林舟：别急。'), ...before.slice(2)]
    const insertion = compareDialogue(before, added).find(item => item.kind === 'added')!
    expect(rangeForChange(insertion, added)).toEqual({ start: 2, end: 4 })
    const after = before.slice(0, -1)
    expect(changedRanges(compareDialogue(before, after), after)).toEqual([{ start: 6, end: 8 }])
    expect(rangeForChange({ kind: 'removed', afterIndex: 0 }, [])).toBeNull()
  })
  it('相邻改动合并重叠范围，分散改动不迫使从头练', () => {
    const before = lines(); const after = structuredClone(before)
    after[2].text = '他不来呢？'; after[3].text = '我还会问。'; after[9].text = '等一等。'
    expect(changedRanges(compareDialogue(before, after), after)).toEqual([{ start: 2, end: 3 }, { start: 8, end: 9 }])
    expect(compareDialogue(parse('我：好。\n我：好。'), parse('我：好。')).filter(item => item.kind === 'removed')).toHaveLength(1)
    expect(() => compareDialogue(Array.from({ length: 201 }, () => lines()[0]), [])).toThrow('200段')
  })
  it('保存独立改前改后快照，保留旧A/B草稿、视频引用和历史', () => {
    const workspace = ensurePracticeDemo(demoWorkspace()).workspace
    const scene = workspace.scenes.find(item => item.id === 'demo-cue-ten')!
    const draft = createDraft(scene); draft.choice = 'A'; draft.takes.A.intent = '先听'; draft.takes.A.mediaId = 'private-video'
    workspace.drafts[scene.id] = draft; workspace.sessions.push(saveSession(draft, workspace.projects.at(-1)!))
    const after = structuredClone(scene.dialogue); after[3].text = '我不再等了。'
    const result = applyRevision(workspace, scene, after, formatDialogue(after), 'v2')
    expect(result.workspace.drafts[scene.id]).toEqual(draft)
    expect(result.workspace.sessions).toEqual(workspace.sessions)
    expect(result.revision.before.version).toBe(scene.version)
    expect(result.revision.after.version).toBe('v2')
    after[3].text = '之后改动'
    result.workspace.scenes.find(item => item.id === scene.id)!.dialogue[3].text = '新草稿'
    expect(result.revision.after.dialogue[3].text).toBe('我不再等了。')
    expect(result.revision.before.dialogue[3].text).toBe(scene.dialogue[3].text)
    expect(workspace.revisions).toBeUndefined()
  })
  it('拒绝旧预览覆盖已变化场次、同名版本与无变化内容', () => {
    const workspace = ensurePracticeDemo(demoWorkspace()).workspace
    const scene = workspace.scenes.at(-1)!; const after = lines(); after[1].text = '新一句。'
    expect(() => applyRevision(workspace, scene, after, '', scene.version)).toThrow('不同')
    expect(() => applyRevision(workspace, scene, scene.dialogue, '', 'v2')).toThrow('没有')
    const result = applyRevision(workspace, scene, after, '', 'v2')
    expect(() => applyRevision(result.workspace, scene, after, '', 'v3')).toThrow('已变化')
  })
  it('单场角色随版本快照保存，不改写项目角色或旧处理角色', () => {
    const workspace = ensurePracticeDemo(demoWorkspace()).workspace
    const scene = workspace.scenes.at(-1)!; const after = lines(); after[1].text = '新的词'
    const result = applyRevision(workspace, scene, after, '', 'v2', '周宁')
    expect(result.revision.after.practiceRole).toBe('周宁')
    expect(result.workspace.projects[0].role).toBe('沈知微')
    const draft = createDraft(result.revision.after); draft.takes.A.intent = '处理'; draft.choice = 'A'
    expect(saveSession(draft, workspace.projects[0]).role).toBe('周宁')
  })
})

describe('位置恢复和演示隔离', () => {
  const demo = () => ensurePracticeDemo(demoWorkspace()).workspace
  it('只有完全匹配的场次、版本、分行台词及有效范围才恢复位置', () => {
    const scene = demo().scenes.at(-1)!
    const bookmark: PracticeBookmark = { sceneId: scene.id, version: scene.version, script: dialogueKey(scene.dialogue), range: { start: 2, end: 7 }, position: 5, side: 'self', hidden: true, loop: false, rate: 1, updatedAt: '' }
    expect(validBookmark(bookmark, scene)).toBe(true)
    for (const invalid of [{ ...bookmark, position: 8 }, { ...bookmark, version: 'other' }, { ...bookmark, sceneId: 'other' }, { ...bookmark, rate: 3 }, { ...bookmark, script: 'different' }]) expect(validBookmark(invalid, scene)).toBe(false)
    expect(validBookmark(undefined, scene)).toBe(false)
  })
  it('十句示例始终明确虚构，重复打开不重复建场或覆盖原资料', () => {
    const original = demoWorkspace(); const result = ensurePracticeDemo(original)
    expect(original.projects).toHaveLength(1)
    expect(result.workspace.scenes.slice(0, 3)).toEqual(original.scenes)
    expect(result.workspace.drafts).toEqual(original.drafts)
    expect(result.workspace.scenes.at(-1)!.dialogue).toHaveLength(10)
    expect(result.workspace.projects.at(-1)!.demo).toBe(true)
    const repeated = ensurePracticeDemo(result.workspace)
    expect(repeated.workspace.scenes).toHaveLength(4)
    expect(repeated.sceneId).toBe(result.sceneId)
  })
  it('首页找回当前项目最近主动保存的位置，失效或其他项目不混入', () => {
    const workspace = demoWorkspace(); const scene = workspace.scenes[1]
    workspace.practice = { [scene.id]: { sceneId: scene.id, version: scene.version, script: dialogueKey(scene.dialogue), range: { start: 0, end: 3 }, position: 2, side: 'self', hidden: true, loop: false, rate: 1, updatedAt: '2026-10-23T00:00:00Z' } }
    expect(resumeScene(workspace, workspace.selectedProjectId)?.id).toBe(scene.id)
    scene.version = 'new'
    expect(resumeScene(workspace, workspace.selectedProjectId)?.id).toBe(workspace.scenes[0].id)
    expect(resumeScene(workspace, 'unknown')).toBeUndefined()
  })
  it('删除一场只删除对应位置与比对记录，不影响其他场次', () => {
    const workspace = demo(); const scene = workspace.scenes.at(-1)!
    const after: Dialogue[] = structuredClone(scene.dialogue); after[1].text = '新词'
    const revised = applyRevision(workspace, scene, after, '', 'v2').workspace
    revised.practice = { [scene.id]: {} as PracticeBookmark, other: {} as PracticeBookmark }
    const next = removeScene(revised, scene.id)
    expect(next.revisions).toEqual([])
    expect(Object.keys(next.practice!)).toEqual(['other'])
    expect(next.scenes).toHaveLength(3)
  })
})
