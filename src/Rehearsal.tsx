import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Bookmark, Check, ChevronDown, Eye, EyeOff, FilePenLine, RotateCcw, Square, Volume2 } from 'lucide-react'
import { describeError, timestamp, type PracticeBookmark, type PracticeRange, type Scene } from './domain'
import { bracketOnly, canReadLine, dialogueKey, lineSide, validBookmark } from './practice'
import { CueSpeaker, localChineseVoices, type ReaderState } from './speech'
import { useWorkspace } from './store'

export interface PracticePlan { sceneId: string; script: string; ranges: PracticeRange[]; id: string }
export function Rehearsal({ scene, role: projectRole, plan, edit, card, lab, registerGuard }: { scene: Scene; role: string; plan?: PracticePlan; edit: () => void; card: () => void; lab: () => void; registerGuard: (guard: (() => Promise<boolean>) | null) => void }) {
  const role = scene.practiceRole || projectRole
  const { data, mutate, notify } = useWorkspace()
  const saved = data.practice?.[scene.id]
  const restored = validBookmark(saved, scene) ? saved : undefined
  const activePlan = plan?.sceneId === scene.id && plan.script === dialogueKey(scene.dialogue) ? plan : undefined
  const [fromChanges, setFromChanges] = useState(Boolean(activePlan))
  const [ranges, setRanges] = useState<PracticeRange[]>(() => activePlan?.ranges.length ? activePlan.ranges : [restored?.range || { start: 0, end: Math.max(0, scene.dialogue.length - 1) }])
  const [segment, setSegment] = useState(0)
  const range = ranges[segment] || ranges[0]
  const [position, setPosition] = useState(activePlan ? range.start : restored?.position ?? range.start)
  const [started, setStarted] = useState(false)
  const [finished, setFinished] = useState(false)
  const [side, setSide] = useState<'self' | 'other'>(activePlan ? 'self' : restored?.side || 'self')
  const [hidden, setHidden] = useState(restored?.hidden ?? true)
  const [hint, setHint] = useState(false)
  const [loop, setLoop] = useState(restored?.loop ?? false)
  const [rate, setRate] = useState(restored?.rate || 1)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [voiceId, setVoiceId] = useState('')
  const [readOther, setReadOther] = useState(true)
  const [readerState, setReaderState] = useState<ReaderState>({ phase: 'idle', message: '' })
  const [saveBusy, setSaveBusy] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [before, setBefore] = useState(scene.before)
  const [want, setWant] = useState(scene.want || '')
  const [turn, setTurn] = useState(scene.turn || '')
  const [contextBusy, setContextBusy] = useState(false)
  const [contextError, setContextError] = useState('')
  const reader = useRef<CueSpeaker | null>(null)
  const cardRef = useRef<HTMLElement>(null)
  const localVoices = localChineseVoices(voices)
  const voice = localVoices.find(item => item.voiceURI === voiceId) || localVoices[0]
  const line = scene.dialogue[position]
  const kind = line ? lineSide(line, side) : 'action'
  const currentRole = side === 'self' ? role : scene.partner || '对手方'
  const contextDirty = before !== scene.before || want !== (scene.want || '') || turn !== (scene.turn || '')
  useEffect(() => {
    const engine = typeof window.speechSynthesis !== 'undefined' ? window.speechSynthesis : undefined
    const speaker = new CueSpeaker(engine, setReaderState)
    reader.current = speaker
    const refresh = () => { try { setVoices(engine?.getVoices() || []) } catch { setVoices([]) } }
    refresh(); engine?.addEventListener('voiceschanged', refresh)
    const background = () => { if (document.hidden) speaker.stop() }
    const mediaPlaying = () => speaker.stop()
    document.addEventListener('visibilitychange', background)
    document.addEventListener('play', mediaPlaying, true)
    window.addEventListener('one-scene-stop-reader', mediaPlaying)
    return () => { speaker.stop(false); reader.current = null; engine?.removeEventListener('voiceschanged', refresh); document.removeEventListener('visibilitychange', background); document.removeEventListener('play', mediaPlaying, true); window.removeEventListener('one-scene-stop-reader', mediaPlaying) }
  }, [])
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => { if (contextDirty) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', unload)
    return () => window.removeEventListener('beforeunload', unload)
  }, [contextDirty])
  useEffect(() => {
    registerGuard(async () => !saveBusy && !contextBusy && (!contextDirty || window.confirm('处境提示尚未保存，确定放弃并离开？')))
    return () => registerGuard(null)
  }, [registerGuard, saveBusy, contextBusy, contextDirty])
  const stop = () => reader.current?.stop()
  const goTo = (next: number, nextSegment = segment, play = true) => {
    stop(); setPosition(next); setSegment(nextSegment); setHint(false); setFinished(false); setStarted(true)
    const nextLine = scene.dialogue[next]
    if (play && readOther && nextLine && canReadLine(nextLine, side) && voice) reader.current?.speak(nextLine.text, voice, rate)
  }
  const next = () => {
    if (!started) { goTo(position); return }
    if (finished) { goTo(ranges[0].start, 0); return }
    if (position < range.end) goTo(position + 1)
    else if (segment < ranges.length - 1) goTo(ranges[segment + 1].start, segment + 1)
    else if (loop) goTo(ranges[0].start, 0)
    else { stop(); setFinished(true); setHint(false) }
  }
  const changeRange = (start: number, end: number) => { stop(); setFromChanges(false); setRanges([{ start, end }]); setSegment(0); setPosition(start); setStarted(false); setFinished(false); setHint(false) }
  const leave = (action: () => void) => { stop(); action() }
  if (!scene.dialogue.length) return <section className="panel empty-state"><span className="eyebrow">FIRST, MARK THE SPEAKERS</span><h1>先把这几句分给说话人。</h1><p>旧原文仍保留。标记本人、对手和动作后，即可遮词开练。</p><button className="button primary" onClick={edit}>标记台词并开练</button><button className="text-button" onClick={card}>查看原有处境与记录</button></section>
  return <div className="card-stack rehearsal-page"><div className="page-intro"><span className="eyebrow">YOUR PACE. ONE CUE AT A TIME.</span><h1>听一句，<span>接一句。</span></h1><p className="hint">{scene.title} · {scene.version}<br />你练 {currentRole}。没有自动监听，也不会催你说完。</p></div>
    {fromChanges && activePlan && <div className="practice-plan"><span className="badge">来自改词 · {ranges.length}个练习区间</span><p>包含改动与必要的前句提示，不是从头重练。调整下面的范围后改为自由练习。</p>{ranges.length > 1 && <div className="range-chips">{ranges.map((item, index) => <button key={`${item.start}-${item.end}`} aria-pressed={segment === index} onClick={() => goTo(item.start, index, false)}>段{index + 1} · {item.start + 1}–{item.end + 1}</button>)}</div>}</div>}
    <section className="panel rehearsal-settings"><div className="row-between"><strong>这一轮，练哪几句</strong><span className="badge">{range.start + 1}–{range.end + 1} / {scene.dialogue.length}</span></div><div className="two-col"><label>起句<select value={range.start} onChange={event => { const start = Number(event.target.value); changeRange(start, Math.max(start, range.end)) }}>{scene.dialogue.map((item, index) => <option key={item.id} value={index}>{index + 1} · {item.text.slice(0, 18)}</option>)}</select></label><label>止句<select value={range.end} onChange={event => { const end = Number(event.target.value); changeRange(Math.min(range.start, end), end) }}>{scene.dialogue.map((item, index) => <option key={item.id} value={index}>{index + 1} · {item.text.slice(0, 18)}</option>)}</select></label></div><div className="practice-switches"><button className="text-button" aria-pressed={hidden} onClick={() => { setHidden(value => !value); setHint(false) }}>{hidden ? <EyeOff size={16} /> : <Eye size={16} />}{hidden ? '本人台词已遮住' : '本人台词全部显示'}</button><button className="text-button" onClick={() => { stop(); setSide(value => value === 'self' ? 'other' : 'self'); setStarted(false); setFinished(false); setHint(false) }}>换练习方 ↔</button></div></section>
    <section className={`cue-card ${finished ? 'complete' : kind}`} ref={cardRef} aria-label="当前练习台词"><div className="row-between"><span className="eyebrow">{finished ? 'ONE ROUND, AT YOUR OWN PACE.' : `${position + 1} / ${scene.dialogue.length} · ${!started ? '准备开始' : kind === 'self' ? '轮到你' : kind === 'other' ? '对手提示' : '动作，只看不读'}`}</span><span className="cue-star" aria-hidden="true">✳</span></div>{finished ? <><h2>这一轮，到这里。</h2><p>没有分数，也不要求留下一份笔记。<br />想再来一次，就从第一句重新开始。</p></> : <><span className="cue-speaker">{line.speaker || (kind === 'self' ? currentRole : kind === 'other' ? side === 'self' ? scene.partner || '对手' : role : '动作')}</span>{kind === 'self' && hidden && !hint ? <><h2 className="cue-covered">轮到你了。</h2><p>先按自己的节奏说，<br />不必对着倒计时。</p><button className="cue-hint-button" onClick={() => setHint(true)}><Eye size={16} />想不起来？只看这一句</button></> : <h2 className="cue-words">{line.text}</h2>}{kind === 'other' && bracketOnly(line.text) && <p className="cue-notice">这段只有括号说明，暂不朗读。可在编辑中核对归属。</p>}</>}
      <div className="reader-feedback" role="status">{readerState.phase === 'error' ? readerState.message : !voice ? '本机没有可用的本地中文声音。仍可遮词并手动继续。' : readerState.message || '点击开始或下一句，才会朗读对手台词。'}</div>
      <div className="cue-audio-actions"><button disabled={finished || !canReadLine(line, side) || !voice} onClick={() => reader.current?.speak(line.text, voice, rate)}><Volume2 size={17} />重读对手句</button><button disabled={!['preparing', 'speaking'].includes(readerState.phase)} onClick={stop}><Square size={15} />停止朗读</button></div>
    </section>
    <div className="cue-navigation"><button className="button secondary" disabled={!started || finished || position === range.start} onClick={() => goTo(position - 1)} aria-label="上一句"><ArrowLeft size={18} /></button><button className="button primary" onClick={next}>{!started ? '开始这一段' : finished ? '再来一遍' : position === range.end ? segment < ranges.length - 1 ? '下一改动段' : loop ? '回到这一轮开头' : '结束这一轮' : '下一句，我自己接'}<ArrowRight size={18} /></button><button className="button secondary" onClick={() => goTo(range.start, segment)} aria-label="从这段开头重来"><RotateCcw size={18} /></button></div>
    <label className="checkbox loop-check"><input type="checkbox" checked={loop} onChange={event => setLoop(event.target.checked)} />手动循环：到末句后，点击按钮才回到开头。</label>
    <details className="panel voice-settings"><summary>声音与语速 <ChevronDown size={16} /></summary><p className="hint">只使用浏览器标记为本地的中文声音，不自动选用云端声音。不是对手演员的真实表演，不录你的声音。</p><label>本地中文声音<select disabled={!localVoices.length} value={voice?.voiceURI || ''} onChange={event => { stop(); setVoiceId(event.target.value) }}>{!localVoices.length && <option value="">没有可用声音 · 手动模式可继续</option>}{localVoices.map(item => <option key={item.voiceURI} value={item.voiceURI}>{item.name} · {item.lang}</option>)}</select></label><label>语速<select value={rate} onChange={event => { stop(); setRate(Number(event.target.value)) }}>{[0.6, 0.8, 1, 1.15, 1.3].map(value => <option key={value} value={value}>{value} 倍</option>)}</select></label><label className="checkbox"><input type="checkbox" checked={readOther} onChange={event => { stop(); setReadOther(event.target.checked) }} />点击接句时，朗读对手台词（有可用声音时）</label></details>
    <div className="bookmark-panel"><button className="button secondary wide" disabled={saveBusy} onClick={async () => {
      setSaveBusy(true); setSaveError('')
      try {
        const bookmark: PracticeBookmark = { sceneId: scene.id, version: scene.version, script: dialogueKey(scene.dialogue), range: { ...range }, position, side, hidden, loop, rate, updatedAt: timestamp() }
        await mutate(workspace => {
          const current = workspace.scenes.find(item => item.id === scene.id)
          if (!current || current.version !== scene.version || dialogueKey(current.dialogue) !== bookmark.script) throw new Error('台词版本已变化，未保存旧位置。请重新打开当前场次。')
          return { ...workspace, practice: { ...workspace.practice, [scene.id]: bookmark } }
        })
        notify('这一段与位置已记住。刷新后可从这里继续；改动段计划会保存为当前选定范围。')
      } catch (reason) { setSaveError(describeError(reason)) } finally { setSaveBusy(false) }
    }}><Bookmark size={16} />{saveBusy ? '正在保存…' : '记住这段与当前位置'}</button>{saveError && <p className="error-text" role="alert">{saveError} 请留在当前页重试。</p>}<p className="hint">只恢复主动保存的位置；未保存的练习设置刷新后不保留。{saved && !restored && '原位置属于不同版本或台词，未套用。'}</p></div>
    <details className="panel practice-script"><summary>台词列表 · 任选一句开始</summary><div className="dialogue-list">{scene.dialogue.map((item, index) => <div className={`dialogue-line ${lineSide(item, side)} ${index === position ? 'current-line' : ''}`} key={item.id}><span>{index + 1} / {lineSide(item, side) === 'self' ? '本人' : lineSide(item, side) === 'other' ? '对手' : '动作'}</span><p>{hidden && lineSide(item, side) === 'self' ? <span className="hidden-line">本人台词已遮住</span> : item.text}</p><button className="text-button" onClick={() => { changeRange(index, Math.max(index, range.end)); cardRef.current?.scrollIntoView({ block: 'center' }) }}>从这句练 ↗</button></div>)}</div></details>
    <details className="panel optional-context"><summary>需要时再看 · 三个处境提示</summary><p className="hint">都是自己的理解，不由工具补全。不填也能练。</p><label>刚发生了什么<textarea maxLength={4000} rows={2} value={before} onChange={event => setBefore(event.target.value)} /></label><label>我想从对方得到什么<textarea maxLength={2000} rows={2} value={want} onChange={event => setWant(event.target.value)} /></label><label>这段的转折在哪里<textarea maxLength={2000} rows={2} value={turn} onChange={event => setTurn(event.target.value)} /></label><button className="button secondary" disabled={contextBusy || !contextDirty} onClick={async () => {
      setContextBusy(true); setContextError('')
      try { await mutate(workspace => ({ ...workspace, scenes: workspace.scenes.map(item => item.id === scene.id ? { ...item, before, want, turn, updatedAt: timestamp() } : item) })); notify('三个处境提示已保存，旧版处理不自动改写。') } catch (reason) { setContextError(describeError(reason)) } finally { setContextBusy(false) }
    }}><Check size={16} />保存自己的提示</button>{contextError && <p className="error-text" role="alert">{contextError}</p>}<button className="text-button" onClick={() => leave(card)}>看原有戏前卡与个人记录 ↗</button></details>
    <div className="optional-tools"><button className="text-button" onClick={() => leave(lab)}><FilePenLine size={16} />想录两种处理？打开A/B试演</button><button className="text-button" onClick={() => leave(edit)}>编辑这段台词 ↗</button></div><p className="privacy-footnote">不判断演技，不要求完成笔记。系统朗读不可用时，手动遮词照常使用。</p>
  </div>
}
