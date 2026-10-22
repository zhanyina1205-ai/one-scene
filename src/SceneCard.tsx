import { useRef, useState } from 'react'
import { ArrowUpRight, BookOpen, Clapperboard, PenLine, Trash2 } from 'lucide-react'
import { choiceLabel, dateLabel, describeError, effectiveKnowledge, sceneLabel, sceneRevisionChanged, timestamp, uid, type Scene, type Session } from './domain'
import { useWorkspace } from './store'

export function Preparation({ scene }: { scene: Scene }) {
  return <>
    <section className="panel"><div className="section-heading"><span className="section-number">01</span><h2>见面之前</h2><span className="badge">剧本 / 处境</span></div><p className="prose">{scene.before || '还没有填写前情。可以在编辑场次里补充。'}</p><p className="source">依据 / 确认说明：{scene.beforeSource || '尚未提供，待本人确认'}</p></section>
    <section className="panel"><div className="section-heading"><span className="section-number">02</span><h2>此刻，角色相信什么</h2></div><p className="hint">只看本场此刻，不把后面知道的事带进来。</p>
      {scene.knowledge.filter(item => item.text.trim()).length ? scene.knowledge.filter(item => item.text.trim()).map(item => <div className="knowledge-line" key={item.id}><span className={`badge knowledge-${effectiveKnowledge(item)}`}>{({ known: '已经知道', belief: '误以为知道', pending: '尚待确认' })[effectiveKnowledge(item)]}</span><p>{item.text}</p><p className="source">{item.source || (item.confirmed ? '本人已确认的理解，无原文依据' : '没有依据，保持待确认')}{item.source && item.confirmed ? ' · 本人已确认' : ''}</p></div>) : <p className="empty-small">还没有录入信息，不自动补全。</p>}
    </section>
  </>
}

export function SessionSummary({ session }: { session: Session }) {
  return <div className="session-summary"><div className="row-between"><strong className="choice-title">{choiceLabel(session.choice)}</strong><span className="badge">本人处理</span></div>
    {(['A', 'B'] as const).map(key => <div key={key} className={`saved-take ${session.choice === key || session.choice === 'both' ? 'chosen' : ''}`}><span className="take-letter">{key}</span><div><p>{session.takes[key].intent || '未填写出发点'}</p>{session.takes[key].reflection && <p className="hint">试后：{session.takes[key].reflection}</p>}{session.takes[key].mediaId && <small className="hint">附练习视频</small>}</div></div>)}
    {session.note && <div className="kept-note"><span className="eyebrow">留给下次开拍</span><p>{session.note}</p></div>}
    <p className="source">{sceneLabel(session.scene)} · 剧本 {session.scene.version} · {dateLabel(session.savedAt)}</p>
  </div>
}

export function SceneCard({ scene, onTry, onEdit }: { scene: Scene; onTry: () => void; onEdit: () => void }) {
  const { data, mutate, notify } = useWorkspace()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [originalOpen, setOriginalOpen] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const originalRef = useRef<HTMLElement>(null)
  const noteRef = useRef<HTMLTextAreaElement>(null)
  const sessions = data.sessions.filter(item => item.sceneId === scene.id).sort((first, second) => second.savedAt.localeCompare(first.savedAt))
  const notes = data.notes.filter(item => item.sceneId === scene.id).sort((first, second) => second.createdAt.localeCompare(first.createdAt))
  const latest = sessions[0]
  return <div className="card-stack">
    <section className="scene-hero"><div className="row-between"><span className="eyebrow">{sceneLabel(scene)}</span><span className="version-chip">{scene.version}</span></div><h1>{scene.title}</h1><p>{scene.location || '地点未填'} <span>·</span> {scene.time} <span>·</span> {scene.partner || '对手未填'}</p><button className="text-button light" onClick={onEdit}>编辑处境与原文 <ArrowUpRight size={15} /></button></section>
    <div className="quick-actions"><button onClick={() => { setOriginalOpen(true); window.setTimeout(() => originalRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0) }}><BookOpen size={20} />看原文</button><button onClick={onTry}><Clapperboard size={20} />去试一遍</button><button onClick={() => { setNoteOpen(true); window.setTimeout(() => noteRef.current?.focus(), 50) }}><PenLine size={20} />随手记</button></div>
    <Preparation scene={scene} />
    <section className="panel"><div className="section-heading"><span className="section-number">03</span><h2>我的处理</h2><span className="badge">私人理解</span></div>
      {latest ? <>{sceneRevisionChanged(latest.scene, scene) && <p className="warning">原文、处境或版本已更新。旧处理对应 {latest.scene.version}，当前为 {scene.version}。请重新检查，未自动迁移。</p>}<SessionSummary session={latest} />{sessions.length > 1 && <p className="hint">另有 {sessions.length - 1} 条历史，可在“我的处理”查看。</p>}</> : <div className="empty-small"><p>还没有保存处理。</p><p className="hint">不必急着决定，试过的两个想法也可以一起留下。</p></div>}
      <button className="button primary wide" onClick={onTry}>带着这场，去试一遍 <ArrowUpRight size={18} /></button>
      <details open={noteOpen} onToggle={event => setNoteOpen(event.currentTarget.open)}><summary>随手记 {notes.length ? `· ${notes.length}` : ''}</summary><form onSubmit={async event => {
        event.preventDefault(); if (!note.trim()) return; setBusy(true); setError('')
        try { await mutate(workspace => ({ ...workspace, notes: [...workspace.notes, { id: uid(), sceneId: scene.id, version: scene.version, text: note.trim(), createdAt: timestamp() }] })); setNote(''); notify('笔记已保存到当前场次。') } catch (reason) { setError(describeError(reason)) } finally { setBusy(false) }
      }}><label>本人的想法<textarea ref={noteRef} value={note} onChange={event => setNote(event.target.value)} placeholder="此刻的直觉，先留下来。" /></label><button className="button secondary" disabled={busy || !note.trim()}>保存笔记 · {scene.version}</button>{error && <p className="error-text" role="alert">{error}</p>}</form>
        {notes.map(item => <div className="note-row" key={item.id}><p className="prose">{item.text}</p><div className="row-between"><small className="source">{item.version} · {dateLabel(item.createdAt)}</small><button className="icon-button" aria-label="删除这条笔记" onClick={async () => { if (window.confirm('删除这条笔记？此操作无法撤销。')) try { await mutate(workspace => ({ ...workspace, notes: workspace.notes.filter(entry => entry.id !== item.id) })) } catch {} }}><Trash2 size={15} /></button></div></div>)}
      </details>
    </section>
    <section className="panel" ref={originalRef}><details open={originalOpen} onToggle={event => setOriginalOpen(event.currentTarget.open)}><summary>原文与版本 <span className="badge">{scene.version}</span></summary><p className="source">原文，不是工具的解读。</p><div className="script-original">{scene.original || '尚未录入本场原文。'}</div><h3>人工记录的版本变化</h3><p className="prose">{scene.changes || '暂未记录变化。'}</p><button className="text-button" onClick={onEdit}>修改原文 / 记录版本变化 <ArrowUpRight size={15} /></button></details></section>
  </div>
}
