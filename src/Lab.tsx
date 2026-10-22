import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, ChevronDown, Eye, EyeOff, Save } from 'lucide-react'
import { createDraft, describeError, saveSession, sceneLabel, sceneRevisionChanged, timestamp, type Draft, type MediaAsset, type Scene, type TakeKey } from './domain'
import { MediaPanel, VideoPlayer } from './MediaPanel'
import { Preparation } from './SceneCard'
import { useWorkspace } from './store'

export type LeaveGuard = () => Promise<boolean>
const fingerprint = (draft: Draft) => JSON.stringify({ ...draft, updatedAt: '' })

export function Lab({ scene, registerGuard, onSaved }: { scene: Scene; registerGuard: (guard: LeaveGuard | null) => void; onSaved: () => void }) {
  const { data, mutate, notify } = useWorkspace()
  const [draft, setDraft] = useState<Draft>(() => structuredClone(data.drafts[scene.id] || createDraft(scene)))
  const [stage, setStage] = useState<TakeKey | 'compare'>('A')
  const [compare, setCompare] = useState<TakeKey>('A')
  const [hideSelf, setHideSelf] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedSignature, setSavedSignature] = useState(() => data.drafts[scene.id] ? fingerprint(data.drafts[scene.id]) : '')
  const [error, setError] = useState('')
  const current = useRef(draft)
  const signature = useRef(savedSignature)
  const locked = useRef(false)
  const busySave = useRef(false)
  const flights = useRef<Promise<void>>(Promise.resolve())
  current.current = draft
  const onBlock = useCallback((value: boolean) => { locked.current = value; setBlocked(value) }, [])
  const patch = (change: Partial<Draft>) => setDraft(previous => ({ ...previous, ...change, updatedAt: timestamp() }))
  const patchTake = (key: TakeKey, field: 'intent' | 'reflection', value: string) => setDraft(previous => ({ ...previous, takes: { ...previous.takes, [key]: { ...previous.takes[key], [field]: value } }, updatedAt: timestamp() }))

  const persist = useCallback((snapshot: Draft, assets: MediaAsset[] = []) => {
    const task = flights.current.catch(() => {}).then(async () => {
      if (fingerprint(snapshot) === signature.current && !assets.length) { setError(''); return }
      try {
        await mutate(workspace => ({ ...workspace, drafts: { ...workspace.drafts, [snapshot.sceneId]: structuredClone(snapshot) } }), assets)
        signature.current = fingerprint(snapshot); setSavedSignature(signature.current); setError('')
      } catch (reason) { setError(describeError(reason)); throw reason }
    })
    flights.current = task
    return task
  }, [mutate])

  useEffect(() => {
    if (blocked || saving || fingerprint(draft) === signature.current) return
    const timer = window.setTimeout(() => { void persist(current.current).catch(() => {}) }, 600)
    return () => clearTimeout(timer)
  }, [draft, blocked, saving, persist])

  useEffect(() => {
    registerGuard(async () => {
      if (locked.current || busySave.current) { notify('请先停止录制，或处理尚未保存的视频，再离开试演台。'); return false }
      try { await persist(current.current); return true } catch { notify('草稿还没有保存，已留在当前页。请重试保存。'); return false }
    })
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (locked.current || busySave.current || fingerprint(current.current) !== signature.current) { event.preventDefault(); event.returnValue = '' }
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => { registerGuard(null); window.removeEventListener('beforeunload', beforeUnload) }
  }, [registerGuard, notify, persist])

  const save = async () => {
    if (locked.current || busySave.current) return
    busySave.current = true; setSaving(true); setError('')
    try {
      const snapshot = structuredClone(current.current)
      const project = data.projects.find(item => item.id === scene.projectId)
      if (!project) throw new Error('没有找到当前项目。')
      const record = saveSession(snapshot, project)
      await persist(snapshot)
      await mutate(workspace => ({ ...workspace, sessions: [...workspace.sessions, record] }))
      notify('这次处理已保存为独立记录，并回到对应戏前卡。')
      onSaved()
    } catch (reason) { setError(describeError(reason)) } finally { busySave.current = false; setSaving(false) }
  }
  const dirty = fingerprint(draft) !== savedSignature
  const mismatched = sceneRevisionChanged(draft.scene, scene)
  const snapshot = draft.scene
  return <div className="card-stack lab-page">
    <div className="lab-heading"><span className="eyebrow">PRIVATE REHEARSAL</span><h1>同一句话，<br />给自己另一种可能。</h1><p>{sceneLabel(snapshot)} · {snapshot.title} <span className="badge">{snapshot.version}</span></p></div>
    <div className="draft-status" role="status"><span className={`status-dot ${dirty ? 'unsaved' : ''}`} />{saving ? '正在保存处理…' : error ? '草稿尚未保存成功' : dirty ? '草稿有改动 · 正在等待保存' : '草稿已保存在此设备'}<button className="text-button" disabled={blocked || saving} onClick={() => void persist(current.current).catch(() => {})}>立即保存草稿</button></div>
    {mismatched && <div className="warning"><p>原文、处境或版本已更新。草稿仍保留当时的 {snapshot.version}，当前场次为 {scene.version}。旧处理不会自动套用新原文。</p><button className="text-button" disabled={blocked || saving} onClick={() => { if (window.confirm(`新建 ${scene.version} 草稿？当前草稿将被替换，已保存的历史处理不受影响。`)) { const next = createDraft(scene); current.current = next; setDraft(next); setStage('A') } }}>从当前版本重新尝试 <ArrowRight size={15} /></button></div>}
    <details className="panel prep-fold"><summary>展开戏前卡 <ChevronDown size={17} /></summary><Preparation scene={snapshot} /></details>
    <details className="panel script-fold" open><summary>这一段的台词 <span className="badge">剧本原文</span></summary>
      {snapshot.dialogue.length > 0 ? <><button className="text-button" onClick={() => setHideSelf(value => !value)}>{hideSelf ? <Eye size={16} /> : <EyeOff size={16} />}{hideSelf ? '显示本人台词' : '遮住本人台词'}</button><div className="dialogue-list">{snapshot.dialogue.map(line => <div className={`dialogue-line ${line.kind}`} key={line.id}><span>{line.kind === 'self' ? '我' : line.kind === 'other' ? snapshot.partner || '对手' : '动作'}</span><p>{hideSelf && line.kind === 'self' ? <span className="hidden-line">本人台词已遮住</span> : line.text}</p></div>)}</div></> : <><p className="script-original">{snapshot.original || '还没有录入台词，请回到场次编辑。'}</p><p className="hint">要使用遮词，请在编辑场次中按说话人拆分练习段落。</p></>}
    </details>
    <div className="segmented" aria-label="试演步骤">{(['A', 'B', 'compare'] as const).map(value => <button key={value} disabled={blocked || saving} aria-pressed={stage === value} onClick={() => setStage(value)}>{value === 'compare' ? '对照与保存' : `尝试 ${value}`}</button>)}</div>
    {stage !== 'compare' ? <section className="panel take-panel" key={stage}><div className="row-between"><div><span className="eyebrow">TAKE {stage}</span><h2>尝试 {stage}</h2></div><span className="large-take">{stage}</span></div>
      <label>这次我想怎样处理<textarea aria-label={`${stage}版出发点`} rows={3} value={draft.takes[stage].intent} disabled={blocked || saving} onChange={event => patchTake(stage, 'intent', event.target.value)} placeholder="不是演得好不好，而是这一次想试什么。" /></label>
      <MediaPanel take={stage} mediaId={draft.takes[stage].mediaId} onBlock={onBlock} onStore={async asset => {
        const next: Draft = { ...structuredClone(current.current), takes: { ...current.current.takes, [stage]: { ...current.current.takes[stage], mediaId: asset.id } }, updatedAt: timestamp() }
        await persist(next, [asset]); current.current = next; setDraft(next); notify(`${stage}版视频已保存到当前草稿。`)
      }} onRemove={async () => {
        const next: Draft = { ...structuredClone(current.current), takes: { ...current.current.takes, [stage]: { ...current.current.takes[stage], mediaId: null } }, updatedAt: timestamp() }
        await persist(next); current.current = next; setDraft(next)
      }} />
      <label>试完后的感受<textarea aria-label={`${stage}版试后感受`} value={draft.takes[stage].reflection} disabled={blocked || saving} onChange={event => patchTake(stage, 'reflection', event.target.value)} placeholder="哪里靠近了角色，哪里还想再试。" /></label>
      <button className="button primary wide" disabled={blocked || saving} onClick={() => setStage(stage === 'A' ? 'B' : 'compare')}>{stage === 'A' ? '再试一种 · 去 B 版' : '去对照回看'} <ArrowRight size={18} /></button>
    </section> : <section className="panel compare-panel"><span className="eyebrow">ONLY YOU DECIDE</span><h2>回看，不急着下结论。</h2><p className="hint">切换回放时，另一版会暂停。两个出发点始终保留。</p>
      <div className="segmented compare-switch">{(['A', 'B'] as const).map(key => <button key={key} aria-pressed={compare === key} onClick={() => setCompare(key)}>回看 {key} {draft.takes[key].mediaId ? '· 有片段' : '· 仅笔记'}</button>)}</div>
      <VideoPlayer key={`${compare}-${draft.takes[compare].mediaId}`} mediaId={draft.takes[compare].mediaId} label={`${compare}版对照回放`} />
      {!draft.takes[compare].mediaId && <p className="empty-small">这版没有视频，仍可对照出发点与个人感受。</p>}
      {(['A', 'B'] as const).map(key => <div className={`comparison-note ${compare === key ? 'active' : ''}`} key={key}><strong>{key} · 出发点</strong><p>{draft.takes[key].intent || '尚未填写'}</p><p className="hint">试后：{draft.takes[key].reflection || '暂未记录'}</p></div>)}
      <fieldset disabled={saving}><legend>这一次，我的选择</legend><div className="choice-options">{(['A', 'B', 'both'] as const).map(choice => <button type="button" className={draft.choice === choice ? 'selected' : ''} aria-pressed={draft.choice === choice} key={choice} onClick={() => patch({ choice })}><span>{choice === 'both' ? '先保留两版，暂不决定' : `更接近 ${choice}`}</span>{draft.choice === choice && <Check size={18} />}</button>)}</div>
        <label>我想留给下次开拍的处理<textarea rows={4} value={draft.note} onChange={event => patch({ note: event.target.value })} placeholder="写下选择的理由，或两版各自想保留什么。" /></label>
        <p className="hint">保存的是 {snapshot.version} 的独立快照；之后改草稿不会覆盖这条记录。</p><button className="button primary wide" onClick={() => void save()}><Save size={18} />{saving ? '正在保存…' : '保存这次处理，回到戏前卡'}</button>
      </fieldset>
    </section>}
    {error && <div className="error-text" role="alert">{error}<button className="text-button" disabled={blocked || saving} onClick={() => void persist(current.current).catch(() => {})}>重试保存草稿</button></div>}
    <p className="privacy-footnote">不上传视频，不替你判断。仅保存于当前浏览器，本地保存不等于备份。</p>
  </div>
}
