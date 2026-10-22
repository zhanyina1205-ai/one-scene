import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { closeDatabase, openDatabase, readMedia, readWorkspace, writeWorkspace } from '../src/db'
import { createDraft, saveSession, type MediaAsset } from '../src/domain'

beforeEach(async () => {
  await closeDatabase()
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('one-scene-private-v1')
    request.onsuccess = () => resolve(); request.onerror = () => reject(request.error)
  })
})

const media = (id: string): MediaAsset => ({ id, blob: new Blob([`test-${id}`], { type: 'video/mp4' }), name: `${id}.mp4`, size: 6, type: 'video/mp4', createdAt: new Date().toISOString() })

describe('IndexedDB文字与视频原子保存', () => {
  it('重开数据库能恢复两个视频、A选择和理由，其他场次不混入', async () => {
    const data = await readWorkspace(); const draft = createDraft(data.scenes[0])
    draft.takes.A = { intent: '先听', reflection: '有等待', mediaId: 'a' }
    draft.takes.B = { intent: '追问', reflection: '更直接', mediaId: 'b' }
    draft.choice = 'A'; draft.note = '希望保留等待'
    data.drafts[draft.sceneId] = draft; data.sessions.push(saveSession(draft, data.projects[0]))
    await writeWorkspace(data, [media('a'), media('b')])
    await closeDatabase()
    const restored = await readWorkspace()
    expect(restored.sessions[0].choice).toBe('A'); expect(restored.sessions[0].note).toBe('希望保留等待')
    expect(restored.sessions[0].scene.version).toBe('v3')
    expect(await (await readMedia('a'))?.blob.text()).toBe('test-a')
    expect(await (await readMedia('b'))?.blob.text()).toBe('test-b')
    expect(restored.sessions.filter(record => record.sceneId === data.scenes[1].id)).toHaveLength(0)
  })
  it('草稿换视频保留历史片段，最后一个引用删除后才回收', async () => {
    const data = await readWorkspace(); const draft = createDraft(data.scenes[0])
    draft.choice = 'A'; draft.takes.A.intent = '保留'; draft.takes.A.mediaId = 'old'
    data.drafts[draft.sceneId] = draft; data.sessions.push(saveSession(draft, data.projects[0]))
    await writeWorkspace(data, [media('old')])
    draft.takes.A.mediaId = 'new'
    await writeWorkspace(data, [media('new')])
    expect(await readMedia('old')).toBeDefined(); expect(await readMedia('new')).toBeDefined()
    data.sessions = []
    await writeWorkspace(data)
    expect(await readMedia('old')).toBeUndefined(); expect(await readMedia('new')).toBeDefined()
  })
  it('缺失视频时整笔事务回滚，不伪装保存成功', async () => {
    const original = await readWorkspace(); const changed = structuredClone(original)
    const draft = createDraft(changed.scenes[0]); draft.takes.A.mediaId = 'missing'
    changed.drafts[draft.sceneId] = draft; changed.projects[0].title = '不应保存'
    await expect(writeWorkspace(changed, [media('unreferenced')])).rejects.toThrow('保存已取消')
    expect((await readWorkspace()).projects[0].title).toBe(original.projects[0].title)
    expect(await readMedia('unreferenced')).toBeUndefined()
  })
  it('空间不足会返回失败，原数据保留', async () => {
    const original = await readWorkspace(); const database = await openDatabase()
    const spy = vi.spyOn(database, 'transaction').mockImplementationOnce(() => { throw new DOMException('full', 'QuotaExceededError') })
    const next = structuredClone(original); next.projects[0].title = '不应保存'
    await expect(writeWorkspace(next)).rejects.toMatchObject({ name: 'QuotaExceededError' })
    spy.mockRestore()
    expect((await readWorkspace()).projects[0].title).toBe(original.projects[0].title)
  })
})
