import { useState } from 'react'
import { ArrowUpRight, RotateCcw, Trash2 } from 'lucide-react'
import { dateLabel, sceneLabel, type Scene, type Session } from './domain'
import { VideoPlayer } from './MediaPanel'
import { SessionSummary } from './SceneCard'
import { useWorkspace } from './store'

export function History({ projectId, onOpen, onContinue }: { projectId: string; onOpen: (scene: Scene) => void; onContinue: (session: Session) => void }) {
  const { data, mutate, notify } = useWorkspace()
  const [sceneFilter, setSceneFilter] = useState('all')
  const [busy, setBusy] = useState(false)
  const [opened, setOpened] = useState<Record<string, boolean>>({})
  const scenes = data.scenes.filter(scene => scene.projectId === projectId)
  const sessions = data.sessions.filter(session => scenes.some(scene => scene.id === session.sceneId) && (sceneFilter === 'all' || session.sceneId === sceneFilter)).sort((first, second) => second.savedAt.localeCompare(first.savedAt))
  return <div className="card-stack"><div className="page-intro"><span className="eyebrow">MY OWN CHOICES</span><h1>让处理留下来，<br />而不是只记得结论。</h1><p className="hint">已保存的独立快照，不随草稿变化。</p></div>
    <label className="filter-label">按场次查看<select value={sceneFilter} onChange={event => setSceneFilter(event.target.value)}><option value="all">当前项目 · 全部场次</option>{scenes.map(scene => <option key={scene.id} value={scene.id}>{sceneLabel(scene)} · {scene.title}</option>)}</select></label>
    {!sessions.length && <section className="panel empty-state"><span className="large-take">一</span><h2>自己的判断，慢慢积累。</h2><p>在试演台保存一次处理后，就能在这里找到。</p></section>}
    {sessions.map(session => <article className="panel history-card" key={session.id}><div className="row-between"><span className="eyebrow">{session.projectTitle} · {session.role}</span><button className="icon-button" disabled={busy} aria-label={`删除${dateLabel(session.savedAt)}的处理记录`} onClick={async () => {
      if (!window.confirm('删除这条已保存的处理？未被其他记录或草稿引用的视频也会删除，无法撤销。')) return
      setBusy(true)
      try { await mutate(workspace => ({ ...workspace, sessions: workspace.sessions.filter(item => item.id !== session.id) })); notify('已删除这条处理。其他记录不受影响。') } catch {} finally { setBusy(false) }
    }}><Trash2 size={17} /></button></div><h2>{session.scene.title}</h2><SessionSummary session={session} />
      <details onToggle={event => { const value = event.currentTarget.open; setOpened(previous => previous[session.id] === value ? previous : { ...previous, [session.id]: value }) }}><summary>练习视频与当时的原文</summary>{opened[session.id] && <>{(['A', 'B'] as const).map(key => <div className="history-video" key={key}><h3>{key} 版</h3>{session.takes[key].mediaId ? <VideoPlayer mediaId={session.takes[key].mediaId} label={`历史${key}版练习回放`} /> : <p className="hint">这一版没有练习视频。</p>}</div>)}<h3>原文快照 · {session.scene.version}</h3><p className="script-original">{session.scene.original || '当时未录入原文。'}</p><details><summary>当时的处境与信息</summary><p className="prose">{session.scene.before}</p>{session.scene.knowledge.map(item => <p key={item.id} className="prose">{item.text}<small className="source">依据：{item.source || (item.confirmed ? '本人确认' : '待确认')}</small></p>)}</details></>}</details>
      <div className="button-row equal"><button className="button secondary" onClick={() => { const scene = data.scenes.find(item => item.id === session.sceneId); if (scene) onOpen(scene) }}>回戏前卡 <ArrowUpRight size={16} /></button><button className="button secondary" onClick={() => onContinue(session)}><RotateCcw size={16} />继续尝试</button></div>
    </article>)}
  </div>
}
