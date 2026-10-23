import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDraft, saveSession, type Scene } from '../src/domain'
import { demoWorkspace } from '../src/seed'
import { checkSceneGuards, SceneWorkspace } from '../src/SceneWorkspace'

let workspace = demoWorkspace()
vi.mock('../src/store', () => ({ useWorkspace: () => ({ data: workspace, mutate: vi.fn(), notify: vi.fn() }) }))
const render = (scene: Scene) => renderToStaticMarkup(createElement(SceneWorkspace, { scene, role: workspace.projects[0].role, editScript: vi.fn(), editScene: vi.fn(), lab: vi.fn(), registerGuard: vi.fn() }))
beforeEach(() => { workspace = demoWorkspace() })

describe('戏前卡与对词台在同一场次', () => {
  it('默认展示前情与信息边界，接着对词，再显示本人处理和原文', () => {
    const scene = workspace.scenes[1]
    const html = render(scene)
    expect(html).toContain('戏前卡 × 对词台')
    expect(html.indexOf('见面之前')).toBeLessThan(html.indexOf('此刻，角色相信什么'))
    expect(html.indexOf('此刻，角色相信什么')).toBeLessThan(html.indexOf('aria-label="本场对词台"'))
    expect(html.indexOf('aria-label="本场对词台"')).toBeLessThan(html.indexOf('我的处理'))
    expect(html).toContain(scene.before)
    expect(html).toContain('回看戏前卡，保留练习位置')
    expect(html).toContain('开始这一段')
    expect(html).toContain('原文与版本')
  })
  it('未标记台词仍可先看戏前卡，不强迫先补分析或丢弃原文', () => {
    const scene = { ...workspace.scenes[0], dialogue: [] }
    const html = render(scene)
    expect(html).toContain('见面之前')
    expect(html).toContain('戏前卡在这里，台词还待标记。')
    expect(html).toContain('标记台词并开练')
    expect(html).toContain('原文与版本')
  })
  it('本人选择、两种想法、理由与原版本一起回到组合界面，历史不被改写', () => {
    const scene = workspace.scenes[1]
    const draft = createDraft(scene)
    draft.takes.A.intent = '【虚构测试】先留等待感'
    draft.takes.B.intent = '【虚构测试】直接求证'
    draft.takes.A.mediaId = 'private-local-video'
    draft.choice = 'both'; draft.note = '【虚构测试】这次先保留两种。'
    workspace.sessions.push(saveSession(draft, workspace.projects[0]))
    const original = JSON.stringify(workspace.sessions[0])
    const html = render({ ...scene, version: 'v4' })
    expect(html).toContain('保留两版 · 暂不决定')
    expect(html).toContain(draft.takes.A.intent)
    expect(html).toContain(draft.takes.B.intent)
    expect(html).toContain(draft.note)
    expect(html).toContain('旧处理对应')
    expect(html).toContain('v3')
    expect(html).toContain('v4')
    expect(JSON.stringify(workspace.sessions[0])).toBe(original)
  })
  it('切换场次不展示另一场的笔记或把无依据的信息当事实', () => {
    workspace.scenes[0].knowledge.push({ id: 'unverified', kind: 'known', text: '【虚构测试】尚未核实的理解', source: '', confirmed: false })
    const html = render(workspace.scenes[0])
    expect(html).toContain('knowledge-pending')
    expect(html).toContain('没有依据，保持待确认')
    expect(html).not.toContain(workspace.notes[0].text)
  })
})

describe('组合界面离开保护', () => {
  it('任一未保存笔记或处境拒绝离开时，停止导航', async () => {
    const card = vi.fn(async () => false); const practice = vi.fn(async () => true)
    expect(await checkSceneGuards([card, practice])).toBe(false)
    expect(practice).not.toHaveBeenCalled()
    expect(await checkSceneGuards([async () => true, async () => false])).toBe(false)
  })
  it('只在戏前卡与练习都允许时离开，空守卫不阻塞', async () => {
    expect(await checkSceneGuards([null, async () => true, async () => true])).toBe(true)
  })
})
