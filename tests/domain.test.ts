import { describe, expect, it } from 'vitest'
import { createDraft, effectiveKnowledge, referencedMedia, removeScene, saveSession, sceneRevisionChanged } from '../src/domain'
import { demoWorkspace } from '../src/seed'

describe('角色信息与个人处理', () => {
  it('没有依据的内容保持待确认，不能自动当作事实', () => {
    expect(effectiveKnowledge({ id: 'k', text: '这是我的猜测', kind: 'known', source: '', confirmed: false })).toBe('pending')
    expect(effectiveKnowledge({ id: 'k', text: '这是我的理解', kind: 'belief', source: '', confirmed: true })).toBe('belief')
    expect(effectiveKnowledge({ id: 'k', text: '待核实', kind: 'pending', source: '某一句台词', confirmed: true })).toBe('pending')
  })
  it('即使沿用同一版本号，原文变化也提醒复查旧处理', () => {
    const scene = demoWorkspace().scenes[0]; const changed = structuredClone(scene)
    expect(sceneRevisionChanged(scene, changed)).toBe(false)
    changed.original = '修改后的台词'
    expect(sceneRevisionChanged(scene, changed)).toBe(true)
    expect(scene.version).toBe(changed.version)
  })
  it('选择A仍保留两版，快照不受后续草稿或场次修改影响', () => {
    const data = demoWorkspace()
    const draft = createDraft(data.scenes[0])
    draft.takes.A.intent = '先听对方'; draft.takes.B.intent = '直接追问'
    draft.takes.A.mediaId = 'video-a'; draft.takes.B.mediaId = 'video-b'
    draft.choice = 'A'; draft.note = '给对方解释的空间'
    const saved = saveSession(draft, data.projects[0])
    draft.takes.A.intent = '改过的草稿'; draft.scene.version = 'v4'; draft.note = '后来修改'
    expect(saved.takes.A.intent).toBe('先听对方')
    expect(saved.takes.B.intent).toBe('直接追问')
    expect(saved.scene.version).toBe('v3')
    expect(saved.note).toBe('给对方解释的空间')
    expect(saved.choice).toBe('A')
  })
  it('先保留两版，不会替演员选出一个结果', () => {
    const data = demoWorkspace(); const draft = createDraft(data.scenes[1])
    draft.takes.A.intent = '期待'; draft.takes.B.intent = '求证'; draft.choice = 'both'
    const saved = saveSession(draft, data.projects[0])
    expect(saved.choice).toBe('both')
    expect(saved.takes.A.intent).toBe('期待'); expect(saved.takes.B.intent).toBe('求证')
    draft.takes.B.intent = ''
    expect(() => saveSession(draft, data.projects[0])).toThrow('请为要保留的版本')
  })
  it('删除指定场次不会清除其他场次的记录或视频引用', () => {
    const data = demoWorkspace()
    const first = createDraft(data.scenes[0]); first.takes.A.intent = 'A'; first.takes.A.mediaId = 'a'; first.choice = 'A'
    const second = createDraft(data.scenes[1]); second.takes.B.mediaId = 'b'; second.takes.B.intent = 'B'; second.choice = 'B'
    data.drafts[first.sceneId] = first; data.drafts[second.sceneId] = second
    data.sessions = [saveSession(first, data.projects[0]), saveSession(second, data.projects[0])]
    const next = removeScene(data, first.sceneId)
    expect(next.sessions).toHaveLength(1); expect(next.sessions[0].sceneId).toBe(second.sceneId)
    expect([...referencedMedia(next)]).toEqual(['b'])
  })
})
