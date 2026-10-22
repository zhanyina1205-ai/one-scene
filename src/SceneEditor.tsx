import { useState } from 'react'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { createScene, describeError, effectiveKnowledge, timestamp, uid, type Scene } from './domain'
import { useWorkspace } from './store'

export function SceneEditor({ initial, projectId, onClose }: { initial?: Scene; projectId: string; onClose: (scene?: Scene) => void }) {
  const { mutate } = useWorkspace()
  const [scene, setScene] = useState<Scene>(() => structuredClone(initial || createScene(projectId)))
  const [paste, setPaste] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)
  const patch = (change: Partial<Scene>) => { setDirty(true); setScene(previous => ({ ...previous, ...change })) }
  const close = () => { if (!dirty || window.confirm('放弃还没有保存的场次编辑？')) onClose() }
  return <main className="editor page">
    <header className="editor-header"><button className="icon-button" aria-label="取消编辑场次" onClick={close}><ArrowLeft size={22} /></button><h1>{initial ? '编辑场次' : '新建场次'}</h1><span className="eyebrow">手动录入</span></header>
    <p className="hint">只记录你提供的内容。剧本依据与个人理解分开保留。</p>
    <form onSubmit={async event => {
      event.preventDefault(); setBusy(true); setError('')
      try {
        if (!scene.episode.trim() || !scene.number.trim() || !scene.title.trim() || !scene.version.trim()) throw new Error('请填写有效的集数、场号、标题和剧本版本。')
        if (initial && initial.version !== scene.version && !scene.changes.trim()) throw new Error('剧本版本已改变，请补充版本变化说明。')
        const saved = { ...scene, updatedAt: timestamp() }
        await mutate(workspace => ({ ...workspace, scenes: initial ? workspace.scenes.map(item => item.id === saved.id ? saved : item) : [...workspace.scenes, saved] }))
        onClose(saved)
      } catch (reason) { setError(describeError(reason)) } finally { setBusy(false) }
    }}>
      <fieldset disabled={busy}>
        <section className="panel form-section"><h2>场次与版本</h2>
          <div className="two-col"><label>集数<input required value={scene.episode} onChange={event => patch({ episode: event.target.value })} placeholder="例如 12" /></label><label>场号<input required value={scene.number} onChange={event => patch({ number: event.target.value })} placeholder="例如 18" /></label></div>
          <label>场次标题<input required value={scene.title} onChange={event => patch({ title: event.target.value })} placeholder="这一场发生什么" /></label>
          <div className="two-col"><label>地点<input value={scene.location} onChange={event => patch({ location: event.target.value })} placeholder="旧宅书房" /></label><label>日夜 / 内外<input value={scene.time} onChange={event => patch({ time: event.target.value })} placeholder="夜 · 内" /></label></div>
          <label>对手角色<input value={scene.partner} onChange={event => patch({ partner: event.target.value })} placeholder="角色名，可填写多位" /></label>
          <label>剧本版本<input required value={scene.version} onChange={event => patch({ version: event.target.value })} placeholder="v1 / 日期版" /></label>
          <label>版本变化说明<textarea value={scene.changes} onChange={event => patch({ changes: event.target.value })} placeholder="修改了哪一句、什么前提需要重新核对" /></label>
          {initial && <p className="hint">修改版本后，旧处理和旧草稿仍对应原版本，不会自动改写。</p>}
        </section>
        <section className="panel form-section"><h2>见面之前</h2>
          <label>前情 / 上次互动 / 未解决的冲突<textarea rows={4} value={scene.before} onChange={event => patch({ before: event.target.value })} placeholder="只填写与本场有关的处境" /></label>
          <label>前情依据或本人确认说明<textarea value={scene.beforeSource} onChange={event => patch({ beforeSource: event.target.value })} placeholder="例如第 12 集 14 场，或本人的理解" /></label>
        </section>
        <section className="panel form-section"><h2>此刻，角色相信什么</h2><p className="hint">没有原文依据或本人确认的内容，展示时保持“待确认”。</p>
          {scene.knowledge.map((item, index) => <div className="knowledge-editor" key={item.id}>
            <div className="row-between"><span className="eyebrow">信息 {index + 1}</span><button type="button" className="icon-button" aria-label={`删除信息${index + 1}`} onClick={() => patch({ knowledge: scene.knowledge.filter(entry => entry.id !== item.id) })}><Trash2 size={16} /></button></div>
            <label>信息内容<textarea value={item.text} onChange={event => patch({ knowledge: scene.knowledge.map(entry => entry.id === item.id ? { ...entry, text: event.target.value } : entry) })} /></label>
            <label>信息类型<select value={item.kind} onChange={event => patch({ knowledge: scene.knowledge.map(entry => entry.id === item.id ? { ...entry, kind: event.target.value as typeof item.kind } : entry) })}><option value="known">已经知道</option><option value="belief">误以为知道</option><option value="pending">尚待确认</option></select></label>
            <label>原文依据或本人说明<textarea value={item.source} onChange={event => patch({ knowledge: scene.knowledge.map(entry => entry.id === item.id ? { ...entry, source: event.target.value } : entry) })} /></label>
            <label className="checkbox"><input type="checkbox" checked={item.confirmed} onChange={event => patch({ knowledge: scene.knowledge.map(entry => entry.id === item.id ? { ...entry, confirmed: event.target.checked } : entry) })} />这是我本人确认的角色理解</label>
            {effectiveKnowledge(item) === 'pending' && <span className="badge">展示为待确认</span>}
          </div>)}
          <button type="button" className="button secondary" onClick={() => patch({ knowledge: [...scene.knowledge, { id: uid(), text: '', kind: 'pending', source: '', confirmed: false }] })}><Plus size={17} />添加一条信息</button>
        </section>
        <section className="panel form-section"><h2>原文与练习段落</h2>
          <label>本场原文<textarea rows={7} value={scene.original} onChange={event => patch({ original: event.target.value })} placeholder="粘贴你有权使用的台词与动作说明" /></label>
          <details><summary>按说话人拆分练习段落</summary><p className="hint">逐行填写“我：”“对手：”“动作：”。只按这些标记拆分，不猜测说话人。可只粘贴本次想练的几句。</p><label>分行台词<textarea rows={5} value={paste} onChange={event => setPaste(event.target.value)} placeholder={'我：请你告诉我。\n对手：你已经有答案了。\n动作：她停在门口。'} /></label><button type="button" className="button secondary" onClick={() => {
            if (!paste.trim()) return
            if (scene.dialogue.length && !window.confirm('用这段文本替换当前分行台词？')) return
            patch({ dialogue: paste.split('\n').filter(line => line.trim()).map(line => {
              const match = line.match(/^(我|对手|动作)\s*[:：]\s*(.*)$/)
              return { id: uid(), kind: match?.[1] === '我' ? 'self' : match?.[1] === '对手' ? 'other' : 'action', text: match ? match[2] : line }
            }) })
          }}>按标记拆分</button></details>
          {scene.dialogue.map((line, index) => <div className="dialogue-editor" key={line.id}><div className="row-between"><label>第{index + 1}段<select value={line.kind} onChange={event => patch({ dialogue: scene.dialogue.map(entry => entry.id === line.id ? { ...entry, kind: event.target.value as typeof line.kind } : entry) })}><option value="self">本人台词</option><option value="other">对手台词</option><option value="action">动作说明</option></select></label><button type="button" className="icon-button" aria-label={`删除第${index + 1}段`} onClick={() => patch({ dialogue: scene.dialogue.filter(entry => entry.id !== line.id) })}><Trash2 size={16} /></button></div><label>台词 / 动作<textarea value={line.text} onChange={event => patch({ dialogue: scene.dialogue.map(entry => entry.id === line.id ? { ...entry, text: event.target.value } : entry) })} /></label></div>)}
          <button type="button" className="text-button" onClick={() => patch({ dialogue: [...scene.dialogue, { id: uid(), kind: 'self', text: '' }] })}><Plus size={16} />添加一段台词</button>
        </section>
        {error && <p className="error-text" role="alert">{error}</p>}
        <button className="button primary wide" type="submit">{busy ? '正在保存…' : '保存场次'}</button>
      </fieldset>
    </form>
  </main>
}
