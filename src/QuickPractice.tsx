import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpRight, Check, X } from 'lucide-react'
import { createScene, describeError, timestamp, type Scene } from './domain'
import { formatDialogue, parseDialogue, speakerLabels } from './practice'
import { useWorkspace } from './store'

export function QuickPractice({ projectId, role, initial, close, created }: { projectId: string; role: string; initial?: Scene; close: () => void; created: (scene: Scene) => void }) {
  const { mutate } = useWorkspace()
  const [text, setText] = useState(initial ? initial.dialogue.length ? formatDialogue(initial.dialogue) : initial.original : '')
  const [myRole, setMyRole] = useState(initial?.practiceRole || role)
  const [title, setTitle] = useState(initial?.title || '')
  const [version, setVersion] = useState(initial?.version || 'v1')
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const modal = useRef<HTMLElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const parsed = useMemo(() => parseDialogue(text, myRole), [text, myRole])
  const labels = [...new Set([initial?.practiceRole || role, role, '我', ...speakerLabels(text).filter(label => label !== '对手')])]
  const cancel = () => { if (!busy && (!text.trim() || window.confirm('离开这段尚未保存的台词？'))) close() }
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    input.current?.focus()
    return () => previous?.focus()
  }, [])
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => { if (text.trim()) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', unload)
    return () => window.removeEventListener('beforeunload', unload)
  }, [text])
  return <div className="modal-backdrop"><section className="modal quick-practice" ref={modal} role="dialog" aria-modal="true" aria-labelledby="quick-title" onKeyDown={event => {
    if (event.key === 'Escape') { event.stopPropagation(); cancel() }
    if (event.key === 'Tab') {
      const controls = Array.from(modal.current?.querySelectorAll<HTMLElement>('button:not(:disabled),textarea:not(:disabled),select:not(:disabled),input:not(:disabled),summary') || []).filter(element => element.getClientRects().length)
      const first = controls[0]; const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
  }}><div className="row-between"><span className="eyebrow">PASTE. CHECK. REHEARSE.</span><button className="icon-button" disabled={busy} aria-label="关闭粘贴开练" onClick={cancel}><X size={21} /></button></div><h2 id="quick-title">几句台词，就能开始。</h2><p className="hint">每行加“我：”“对手：”“动作：”，也可用角色名。不会猜测说话人，不用先填人物分析。</p><form onSubmit={async event => {
    event.preventDefault(); setError('')
    if (parsed.errors.length || !confirmed || !version.trim()) return
    setBusy(true)
    try {
      if (initial && version.trim() !== initial.version) throw new Error('此入口只整理当前版台词。更新版本请用“改词”，以保留改前与改后的快照。')
      const scene = { ...structuredClone(initial || createScene(projectId)), title: title.trim() || '随手练习', version: version.trim(), practiceRole: ['我', '本人'].includes(myRole) ? initial?.practiceRole || role : myRole, partner: [...new Set(parsed.lines.filter(line => line.kind === 'other').map(line => line.speaker || '对手'))].join('、'), original: text.trim(), dialogue: parsed.lines, updatedAt: timestamp() }
      await mutate(workspace => {
        if (initial) {
          const current = workspace.scenes.find(item => item.id === initial.id)
          if (!current || current.updatedAt !== initial.updatedAt) throw new Error('场次已经变化，请重新打开后再录入，没有覆盖原文。')
        }
        return { ...workspace, scenes: initial ? workspace.scenes.map(item => item.id === scene.id ? scene : item) : [...workspace.scenes, scene] }
      })
      created(scene)
    } catch (reason) { setError(describeError(reason)) } finally { setBusy(false) }
  }}><fieldset disabled={busy}><label>分行台词<textarea ref={input} rows={7} maxLength={20000} value={text} onChange={event => { setText(event.target.value); setConfirmed(false) }} placeholder={'对手：你还在等？\n我：我想听他亲口说。\n动作：看向门口。\n对手：门外有人。'} /></label><label>哪一方是你<select value={myRole} onChange={event => { setMyRole(event.target.value); setConfirmed(false) }}>{labels.map(label => <option key={label} value={label}>{label === role ? `${label}（当前角色）` : label}</option>)}</select></label><details><summary>标题与版本（可选）</summary><label>练习标题<input maxLength={100} value={title} onChange={event => setTitle(event.target.value)} placeholder="默认：随手练习" /></label><label>剧本版本<input maxLength={80} value={version} onChange={event => setVersion(event.target.value)} /></label></details>
    {text.trim() && <div className="paste-preview"><div className="row-between"><strong>先核对归属</strong><span className="badge">{parsed.lines.length} 段</span></div>{parsed.errors.length > 0 ? <div className="error-text" role="alert">{parsed.errors.slice(0, 6).map(message => <p key={message}>{message}</p>)}{parsed.errors.length > 6 && <p>另有{parsed.errors.length - 6}行需修正。</p>}</div> : <><div className="preview-lines">{parsed.lines.map((line, index) => <p key={line.id}><span>{index + 1} / {line.kind === 'self' ? '本人' : line.kind === 'other' ? '对手' : '动作'}{line.speaker ? ` · ${line.speaker}` : ''}</span>{line.text}</p>)}</div><label className="checkbox"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /><span><Check size={14} />我已核对本人、对手与动作的归属。</span></label></>}{initial && <p className="hint">将更新当前场次的台词；旧A/B草稿与历史不改写。比较剧本版本请使用“改词”。</p>}</div>}
    {error && <p className="error-text" role="alert">{error}</p>}<button className="button primary wide" disabled={!text.trim() || parsed.errors.length > 0 || !confirmed || !version.trim()}>{busy ? '正在保存…' : '保存这段，直接开练'}<ArrowUpRight size={17} /></button><p className="hint">最多200段 / 20000字。保存失败时请留在这里重试，输入不会被清空。</p></fieldset></form></section></div>
}
