import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, FilePenLine, Trash2 } from 'lucide-react'
import { dateLabel, describeError, type Dialogue, type PracticeRange, type Scene, type ScriptRevision } from './domain'
import { applyRevision, changedRanges, compareDialogue, dialogueKey, formatDialogue, parseDialogue, rangeForChange, speakerLabels, type LineDifference } from './practice'
import { useWorkspace } from './store'

type Comparison = { before: Dialogue[]; after: Dialogue[]; differences: LineDifference[]; oldMatches: boolean; scene: Scene; original: string; version: string; practiceRole: string }
export function Changes({ scene, role: projectRole, practice, setup, registerGuard }: { scene: Scene; role: string; practice: (scene: Scene, ranges: PracticeRange[], committed?: boolean) => void; setup: () => void; registerGuard: (guard: (() => Promise<boolean>) | null) => void }) {
  const role = scene.practiceRole || projectRole
  const { data, mutate, notify } = useWorkspace()
  const [oldText, setOldText] = useState(() => scene.dialogue.length ? formatDialogue(scene.dialogue) : scene.original)
  const [newText, setNewText] = useState('')
  const [version, setVersion] = useState(`${scene.version}-改1`)
  const [myRole, setMyRole] = useState(role)
  const [comparison, setComparison] = useState<Comparison | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const labels = [...new Set([role, '我', ...speakerLabels(`${oldText}\n${newText}`).filter(label => label !== '对手')])]
  const records = (data.revisions || []).filter(record => record.sceneId === scene.id).sort((first, second) => second.createdAt.localeCompare(first.createdAt))
  const resetPreview = () => { setComparison(null); setConfirmed(false); setError('') }
  const pending = newText.trim().length > 0
  useComparisonGuard(pending, busy, registerGuard)
  const save = async () => {
    if (!comparison || !confirmed || busy || !comparison.oldMatches) return
    setBusy(true); setError('')
    try {
      let saved: ScriptRevision | undefined
      await mutate(workspace => {
        const result = applyRevision(workspace, comparison.scene, comparison.after, comparison.original, comparison.version, comparison.practiceRole)
        saved = result.revision
        return result.workspace
      })
      if (saved) {
        const revision: ScriptRevision = saved
        notify(`${revision.after.version}已保存。旧A/B记录保留原版本，开始练改动与提示句。`)
        setNewText(''); setConfirmed(false)
        practice(revision.after, changedRanges(comparison.differences, revision.after.dialogue), true)
      }
    } catch (reason) { setError(describeError(reason)) } finally { setBusy(false) }
  }
  return <div className="card-stack changes-page"><div className="page-intro"><span className="eyebrow">REVISED LINES, NOT THE WHOLE SCENE.</span><h1>改了哪句，<br /><span>就从那里再练。</span></h1><p className="hint">逐行比对增删与替换，不解释剧情含义。只练改动，也带上接戏需要的前句。</p></div><section className="panel change-input"><h2>先比对，再决定是否更新。</h2><p className="hint">只贴这次练习的部分，使用“我：”“对手：”“动作：”或角色名。最多200段。原文和历史不会在预览时改变。</p><label>旧版台词 · 当前 {scene.version}<textarea rows={6} maxLength={20000} value={oldText} disabled={busy} onChange={event => { setOldText(event.target.value); resetPreview() }} /></label><button className="text-button" disabled={busy} onClick={() => { setOldText(formatDialogue(scene.dialogue)); resetPreview() }}>重新载入当前分行台词</button><label>新版台词<textarea rows={7} maxLength={20000} value={newText} disabled={busy} onChange={event => { setNewText(event.target.value); resetPreview() }} placeholder="粘贴同一段的新版，先看差异，不会立即覆盖。" /></label><div className="two-col"><label>新版名称<input maxLength={80} value={version} disabled={busy} onChange={event => { setVersion(event.target.value); resetPreview() }} /></label><label>本人角色<select value={myRole} disabled={busy} onChange={event => { setMyRole(event.target.value); resetPreview() }}>{labels.map(label => <option key={label} value={label}>{label}</option>)}</select></label></div><button className="button secondary wide" disabled={!newText.trim() || busy} onClick={() => {
      setError(''); setConfirmed(false)
      const before = parseDialogue(oldText, myRole); const after = parseDialogue(newText, myRole)
      if (before.errors.length || after.errors.length) { setComparison(null); setError([...before.errors.map(message => `旧版：${message}`), ...after.errors.map(message => `新版：${message}`)].slice(0, 8).join('\n')); return }
      try { setComparison({ before: before.lines, after: after.lines, differences: compareDialogue(before.lines, after.lines), oldMatches: dialogueKey(before.lines) === dialogueKey(scene.dialogue), scene: structuredClone(scene), original: newText, version: version.trim(), practiceRole: ['我', '本人'].includes(myRole) ? role : myRole }) } catch (reason) { setError(describeError(reason)) }
    }}><FilePenLine size={17} />先看逐行差异</button>{!scene.dialogue.length && <button className="text-button" onClick={setup}>还未拆分旧台词？先标记说话人 ↗</button>}{error && <p className="error-text" role="alert">{error}</p>}</section>
    {comparison && <section className="panel change-preview"><div className="row-between"><h2>差异预览</h2><span className="badge">未保存</span></div><p className="hint">{comparison.differences.filter(item => item.kind !== 'same').length}处逐行变化；按相邻增删配对，不代表相同戏剧含义。</p><DiffList differences={comparison.differences} />{!comparison.oldMatches && <p className="warning">粘贴的旧版与当前场次的分行台词不一致。本次仅供比较，不能覆盖当前场次。请重新载入当前台词后再比较。</p>}{comparison.differences.every(item => item.kind === 'same') ? <p className="warning">两版台词没有逐行变化，不需要重新保存。</p> : <><p className="hint">练习将覆盖：{changedRanges(comparison.differences, comparison.after).map(range => `第${range.start + 1}–${range.end + 1}段`).join('、')}。包括必要的提示与回应，不是只读孤立新句。</p><label className="checkbox"><input type="checkbox" checked={confirmed} disabled={busy || !comparison.oldMatches} onChange={event => setConfirmed(event.target.checked)} />我已核对差异，并确认用 {comparison.version || '未命名新版'} 更新当前场次。旧A/B草稿、视频和历史不改写。</label><button className="button primary wide" disabled={busy || !confirmed || !comparison.oldMatches || !comparison.version || comparison.version === scene.version} onClick={() => void save()}>{busy ? '正在保存…' : '保存新版，直接练改动段'}<ArrowRight size={18} /></button>{comparison.version === scene.version && <p className="error-text">新版名称须与当前版本不同。</p>}</>}</section>}
    <div className="section-title"><div><span className="eyebrow">VERSIONED, NOT OVERWRITTEN.</span><h2>这场的改词记录 <span className="count">{records.length}</span></h2></div></div>{!records.length && <p className="empty-small">确认并保存新版后，改前与改后的快照会在这里保留。</p>}{records.map(record => <RevisionEntry key={record.id} record={record} current={scene} practice={practice} deleting={deleting} remove={async () => {
      if (!window.confirm('删除这条改词比对快照？不会回滚当前场次，也不会删除旧A/B记录和视频。此删除无法撤销。')) return
      setDeleting(true)
      try { await mutate(workspace => ({ ...workspace, revisions: (workspace.revisions || []).filter(item => item.id !== record.id) })); notify('已删除指定比对记录，当前台词未回滚。') } catch {} finally { setDeleting(false) }
    }} />)}
  </div>
}

function useComparisonGuard(pending: boolean, busy: boolean, registerGuard: (guard: (() => Promise<boolean>) | null) => void) {
  useEffect(() => {
    registerGuard(async () => !busy && (!pending || window.confirm('新版台词尚未保存，离开会放弃本页输入，确定继续？')))
    const unload = (event: BeforeUnloadEvent) => { if (pending || busy) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', unload)
    return () => { registerGuard(null); window.removeEventListener('beforeunload', unload) }
  }, [pending, busy, registerGuard])
}
function DiffList({ differences, practice }: { differences: LineDifference[]; practice?: (range: PracticeRange) => void }) {
  const changed = differences.filter(item => item.kind !== 'same')
  return <div className="diff-list">{changed.map((item, index) => <article className={`line-diff ${item.kind}`} key={`${item.kind}-${item.beforeIndex}-${item.afterIndex}-${index}`}><div className="row-between"><span className="badge">{{ added: '新增', removed: '删除', changed: '改写 / 归属变化', same: '未改' }[item.kind]}</span><span className="hint">旧{item.beforeIndex === undefined ? '—' : item.beforeIndex + 1} → 新{item.after ? item.afterIndex + 1 : '已删除'}</span></div>{item.before && <div className="diff-before"><span>旧 / {item.before.kind === 'self' ? '本人' : item.before.kind === 'other' ? '对手' : '动作'}{item.before.speaker ? ` · ${item.before.speaker}` : ''}</span><p>{item.before.text}</p></div>}{item.after && <div className="diff-after"><span>新 / {item.after.kind === 'self' ? '本人' : item.after.kind === 'other' ? '对手' : '动作'}{item.after.speaker ? ` · ${item.after.speaker}` : ''}</span><p>{item.after.text}</p></div>}{practice && <button className="text-button" onClick={() => {
    const lines = differences.filter(entry => entry.after).sort((first, second) => first.afterIndex - second.afterIndex).map(entry => entry.after!)
    const range = rangeForChange(item, lines); if (range) practice(range)
  }}>带着前句，从这处练 ↗</button>}</article>)}{differences.some(item => item.kind === 'same') && <details><summary>展开未改动的{differences.filter(item => item.kind === 'same').length}段</summary>{differences.filter(item => item.kind === 'same').map(item => <p className="unchanged-line" key={item.afterIndex}>{item.afterIndex + 1} / {item.after?.text}</p>)}</details>}</div>
}
function RevisionEntry({ record, current, practice, remove, deleting }: { record: ScriptRevision; current: Scene; practice: (scene: Scene, ranges: PracticeRange[]) => void; remove: () => void; deleting: boolean }) {
  const [open, setOpen] = useState(false)
  const differences = useMemo(() => open ? compareDialogue(record.before.dialogue, record.after.dialogue) : [], [open, record])
  const isCurrent = record.after.version === current.version && dialogueKey(record.after.dialogue) === dialogueKey(current.dialogue)
  return <article className="panel revision-record"><div className="row-between"><div><span className="eyebrow">{dateLabel(record.createdAt)}</span><h3>{record.before.version} → {record.after.version}</h3></div><button className="icon-button" disabled={deleting} aria-label={`删除改词记录${record.before.version}至${record.after.version}`} onClick={remove}><Trash2 size={16} /></button></div><p className="hint">改前与改后的独立原文快照。删除记录不回滚当前版本。</p><details onToggle={event => setOpen(event.currentTarget.open)}><summary>回看差异与改动段</summary>{open && <><DiffList differences={differences} practice={isCurrent ? range => practice(current, [range]) : undefined} /><button className="button secondary wide" disabled={!isCurrent} onClick={() => practice(current, changedRanges(differences, current.dialogue))}>只练这次改动与提示句</button>{!isCurrent && <p className="hint">当前场次已不是此记录的新版，仅回看，不把旧台词当作当前版本练习。</p>}</>}</details></article>
}
