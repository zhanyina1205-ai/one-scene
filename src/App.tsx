import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Bookmark, Check, ChevronRight, FileDiff, Home, Mic2, Plus, ShieldCheck, Trash2, X } from 'lucide-react'
import { createDraft, removeScene, sceneLabel, timestamp, uid, type Page, type PracticeRange, type Scene } from './domain'
import { storageEstimate } from './db'
import { History } from './History'
import { Lab, type LeaveGuard } from './Lab'
import { SceneCard } from './SceneCard'
import { SceneEditor } from './SceneEditor'
import { QuickPractice } from './QuickPractice'
import { Rehearsal, type PracticePlan } from './Rehearsal'
import { Changes } from './Changes'
import { dialogueKey, resumeScene, validBookmark } from './practice'
import { ensurePracticeDemo } from './practice-demo'
import { useWorkspace } from './store'

export function App() {
  const { data, mutate, notify, saving } = useWorkspace()
  const [page, setPage] = useState<Page>('today')
  const [selected, setSelected] = useState(() => resumeScene(data, data.selectedProjectId)?.id || '')
  const [editor, setEditor] = useState<Scene | 'new' | null>(null)
  const [quick, setQuick] = useState<Scene | 'new' | null>(null)
  const [plan, setPlan] = useState<PracticePlan>()
  const [projectModal, setProjectModal] = useState(false)
  const [privacy, setPrivacy] = useState(false)
  const [projectTitle, setProjectTitle] = useState('')
  const [role, setRole] = useState('')
  const [projectBusy, setProjectBusy] = useState(false)
  const [demoBusy, setDemoBusy] = useState(false)
  const [estimate, setEstimate] = useState<{ used: number; quota: number } | null>(null)
  const [keyboard, setKeyboard] = useState(false)
  const guard = useRef<LeaveGuard | null>(null)
  const project = data.projects.find(item => item.id === data.selectedProjectId) || data.projects[0]
  const scenes = data.scenes.filter(scene => scene.projectId === project.id)
  const scene = scenes.find(item => item.id === selected) || scenes[0]
  const registerGuard = useCallback((next: LeaveGuard | null) => { guard.current = next }, [])
  const mayLeave = async () => !guard.current || await guard.current()
  const scrollTop = () => window.scrollTo({ top: 0, behavior: 'instant' })
  const stopReading = () => window.dispatchEvent(new Event('one-scene-stop-reader'))
  const go = async (next: Page, nextScene?: Scene) => {
    if (next === page && (!nextScene || nextScene.id === selected)) return
    if (!await mayLeave()) return
    stopReading(); setPlan(undefined)
    if (nextScene) setSelected(nextScene.id)
    setPage(next); scrollTop()
  }
  const openPractice = async (nextScene: Scene, ranges: PracticeRange[], committed = false) => {
    if (!committed && !await mayLeave()) return
    stopReading(); setSelected(nextScene.id)
    setPlan({ sceneId: nextScene.id, script: dialogueKey(nextScene.dialogue), ranges, id: uid() })
    setPage('rehearse'); scrollTop()
  }
  const editScene = async (next?: Scene) => { if (await mayLeave()) { stopReading(); setEditor(next || 'new') } }
  const quickStart = async (next?: Scene) => { if (await mayLeave()) { stopReading(); setQuick(next || 'new') } }
  useEffect(() => {
    const pauseOthers = (event: Event) => {
      if (!(event.target instanceof HTMLVideoElement) || event.target.muted) return
      for (const video of document.querySelectorAll('video')) if (video !== event.target) video.pause()
    }
    document.addEventListener('play', pauseOthers, true)
    return () => document.removeEventListener('play', pauseOthers, true)
  }, [])
  useEffect(() => {
    const viewport = window.visualViewport
    const changed = () => setKeyboard(Boolean(viewport && window.innerHeight - viewport.height > 150))
    viewport?.addEventListener('resize', changed)
    return () => viewport?.removeEventListener('resize', changed)
  }, [])
  useEffect(() => { if (privacy) void storageEstimate().then(setEstimate) }, [privacy])

  if (editor) return <SceneEditor key={editor === 'new' ? 'new' : editor.id} projectId={project.id} initial={editor === 'new' ? undefined : editor} onClose={saved => {
    setEditor(null)
    if (saved) { setSelected(saved.id); setPlan(undefined); setPage('rehearse'); notify('场次已保存。旧版处理与视频仍保留。') }
    scrollTop()
  }} />
  const selectedBookmark = scene && data.practice?.[scene.id]
  const canResume = scene && validBookmark(selectedBookmark, scene)
  return <div className={`app-shell ${keyboard ? 'keyboard-open' : ''}`}>
    <header className="topbar"><button className="brand" onClick={() => void go('today')} aria-label="这一场 · 回到开练"><span className="brand-mark">一</span><span>这一场<small>演员的随身对词台</small></span></button><button className="icon-button privacy-button" aria-label="本地保存与隐私说明" onClick={() => { stopReading(); setPrivacy(true) }}><ShieldCheck size={21} /></button></header>
    <main className="page"><div className="project-switch"><label className="visually-hidden" htmlFor="project-select">当前项目</label><select id="project-select" value={project.id} disabled={saving} onChange={async event => {
      const id = event.target.value
      if (!await mayLeave()) return
      stopReading()
      try { await mutate(workspace => ({ ...workspace, selectedProjectId: id })); setSelected(resumeScene(data, id)?.id || ''); setPlan(undefined); setPage('today'); scrollTop() } catch {}
    }}>{data.projects.map(item => <option key={item.id} value={item.id}>{item.title} · {item.role}{item.demo ? ' / 虚构演示' : ''}</option>)}</select><button className="icon-button" aria-label="创建空白项目" onClick={async () => { if (await mayLeave()) { stopReading(); setProjectModal(true) } }}><Plus size={19} /></button></div>
      {page === 'today' ? <div className="card-stack today-page"><div className="greeting"><span className="eyebrow">LESS SETUP. MORE REHEARSAL.</span><h1>听对手，<br /><span>接自己的。</span></h1><p className="hint">不用先写一页分析。选一段，就开练。</p></div>
        <section className="start-card"><div className="row-between"><span className="eyebrow">ONE SCENE, YOUR PACE.</span><span className="hero-orbit" aria-hidden="true">✳</span></div><h2>{scene ? scene.title : '从几句台词开始。'}</h2><p>{scene ? `${sceneLabel(scene)} · ${scene.version} · ${scene.dialogue.length}段` : '只粘贴眼前想练的几句，不需要整份剧本。'}</p><button className="button start-main" onClick={() => scene ? void go('rehearse', scene) : void quickStart()}>{scene ? canResume ? `从第${selectedBookmark!.position + 1}段继续练` : '开始这一段' : '粘贴几句开练'}<ArrowUpRight size={18} /></button>{scene && <button className="start-secondary" onClick={() => void quickStart()}><Plus size={16} />粘贴几句，另开一段</button>}</section>
        <button className="demo-start" disabled={demoBusy || saving} onClick={async () => {
          if (!await mayLeave()) return
          stopReading(); setDemoBusy(true)
          try { let nextId = ''; await mutate(workspace => { const result = ensurePracticeDemo(workspace); nextId = result.sceneId; return result.workspace }); setSelected(nextId); setPlan(undefined); setPage('rehearse'); scrollTop(); notify('十句虚构演示已打开。不会改动你原有的项目、场次或记录。') } catch {} finally { setDemoBusy(false) }
        }}><span><strong>{demoBusy ? '正在准备…' : '先用10句虚构台词试试'}</strong><small>不用提供私人素材 · 不开启麦克风</small></span><ArrowUpRight size={19} /></button>
        {project.demo && <p className="demo-note">虚构演示 · 人物、台词与示例提示均为创作，不是真实演员资料。</p>}
        <div className="section-title"><div><span className="eyebrow">YOUR SCENES</span><h2>《{project.title.replace(/^《|》$/g, '')}》 <span className="count">{scenes.length}段</span></h2></div><button className="round-add" aria-label="粘贴新增练习" onClick={() => void quickStart()}><Plus size={22} /></button></div><div className="scene-list">{scenes.map((item, index) => {
          const records = data.sessions.filter(record => record.sceneId === item.id)
          return <article className="scene-row" key={item.id}><button className="scene-link" onClick={() => void go('rehearse', item)}><span className="scene-index">{String(index + 1).padStart(2, '0')}</span><div className="scene-row-body"><div className="row-between"><span className="eyebrow">{sceneLabel(item)} · {item.version}</span>{records.length > 0 && <span className="saved-chip"><Check size={11} />有本人处理</span>}</div><h3>{item.title}</h3><p>{item.dialogue.length}段 · 对手：{item.partner || '未填写'}</p></div><ChevronRight size={18} /></button><div className="scene-row-actions"><button className="text-button" onClick={() => void go('changes', item)}>比较改词</button><button className="text-button" onClick={() => void editScene(item)}>编辑</button><button className="icon-button" aria-label={`删除场次${item.title}`} onClick={async () => {
            if (!window.confirm(`删除「${item.title}」及其练习位置、比对记录、草稿、笔记和所有已保存处理？未被其他记录引用的视频也会删除，无法撤销。`)) return
            try { await mutate(workspace => removeScene(workspace, item.id)); notify('仅删除了这个场次及关联记录。') } catch {}
          }}><Trash2 size={14} /></button></div></article>
        })}</div><button className="text-button subtle" onClick={() => void editScene()}>需要完整场次资料？使用详细录入 ↗</button><div className="quiet-message"><span className="mini-line" /><p>不必每次留下记录，<br />练完，也可以就到这里。</p></div><button className="privacy-inline" onClick={() => setPrivacy(true)}><ShieldCheck size={15} />仅在当前浏览器保存 · 请自行备份</button><a className="text-button subtle" href="./proposal/" target="_blank" rel="noopener noreferrer">产品提案 · 含初版创作记录构想 <ArrowUpRight size={14} /></a>
      </div> : <>
        {scene && page !== 'history' && <label className="scene-selector"><span>当前练习场次</span><select value={scene.id} onChange={async event => { const next = scenes.find(item => item.id === event.target.value); if (next && await mayLeave()) { stopReading(); setSelected(next.id); setPlan(undefined); scrollTop() } }}>{scenes.map(item => <option key={item.id} value={item.id}>{sceneLabel(item)} · {item.title}</option>)}</select></label>}
        {page === 'history' ? <History key={project.id} projectId={project.id} onOpen={next => void go('scene', next)} onContinue={async session => {
          if (data.drafts[session.sceneId] && !window.confirm('将这条历史复制为新的草稿？当前场次已有草稿，会被替换。已保存的历史不受影响。')) return
          const next = { ...createDraft(session.scene), takes: structuredClone(session.takes), choice: session.choice, note: session.note }
          try { await mutate(workspace => ({ ...workspace, drafts: { ...workspace.drafts, [session.sceneId]: next } })); setSelected(session.sceneId); setPage('lab'); scrollTop() } catch {}
        }} /> : !scene ? <section className="panel empty-state"><h1>先放进几句台词。</h1><p>不需要填前情，粘贴后核对说话人就能练。</p><button className="button primary" onClick={() => void quickStart()}>粘贴几句开练</button></section> : page === 'rehearse' ? <Rehearsal key={`${scene.id}:${scene.version}:${dialogueKey(scene.dialogue)}:${plan?.id || ''}`} scene={scene} role={project.role} plan={plan} registerGuard={registerGuard} edit={() => void quickStart(scene)} card={() => void go('scene', scene)} lab={() => void go('lab', scene)} /> : page === 'changes' ? <Changes key={`${scene.id}:${scene.version}`} scene={scene} role={project.role} registerGuard={registerGuard} setup={() => void quickStart(scene)} practice={(next, ranges, committed) => void openPractice(next, ranges, committed)} /> : <><button className="text-button practice-back" onClick={() => void go('rehearse', scene)}>← 回对词台，A/B与处境都是可选</button>{page === 'scene' ? <SceneCard key={scene.id} scene={scene} onEdit={() => void editScene(scene)} onTry={() => void go('lab', scene)} /> : <Lab key={scene.id} scene={scene} registerGuard={registerGuard} onSaved={() => { setPage('scene'); scrollTop() }} />}</>}
      </>}
    </main><nav className="bottom-nav" aria-label="主导航">{([{ id: 'today', label: '开练', Icon: Home }, { id: 'rehearse', label: '对词台', Icon: Mic2 }, { id: 'changes', label: '改词', Icon: FileDiff }, { id: 'history', label: '我的处理', Icon: Bookmark }] as const).map(({ id, label, Icon }) => <button key={id} aria-current={page === id || id === 'rehearse' && ['scene', 'lab'].includes(page) ? 'page' : undefined} onClick={() => void go(id)}><span><Icon size={21} strokeWidth={page === id ? 2 : 1.5} /></span><small>{label}</small></button>)}</nav>
    {quick && <QuickPractice projectId={project.id} role={project.role} initial={quick === 'new' ? undefined : quick} close={() => setQuick(null)} created={saved => { setQuick(null); setSelected(saved.id); setPlan(undefined); setPage('rehearse'); scrollTop(); notify('这段台词已保存。现在就能开始，不用填写创作笔记。') }} />}
    {privacy && <div className="modal-backdrop" onClick={event => { if (event.target === event.currentTarget) setPrivacy(false) }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="privacy-title"><div className="row-between"><ShieldCheck size={25} /><button className="icon-button" aria-label="关闭隐私说明" onClick={() => setPrivacy(false)}><X size={21} /></button></div><h2 id="privacy-title">只练这一段，不替你判断。</h2><p>剧本、练习位置、比对快照、笔记和视频保存在当前浏览器的IndexedDB，不默认上传，不接入统计追踪。</p><p>对词不使用语音识别，不请求麦克风。朗读只选择浏览器标记为本地的中文声音；没有可用声音时，手动遮词仍可练。系统声音不是对手演员的表演。</p><p>本地保存不等于云备份或加密。清理网站数据、无痕模式、系统回收或更换网址 / 浏览器，都可能导致内容丢失。重要原文请另外保存，视频可在回放下方下载。</p><p>可选A/B摄录只有点击“开始录制”后才请求权限，手机需HTTPS；拒绝后仍可导入视频。</p>{estimate && <p className="source">当前网站约使用{(estimate.used / 1024 / 1024).toFixed(1)} MB。额度由浏览器管理，不是备份保证。</p>}<p className="hint">没有云同步、离线缓存或演技评分。建议固定网址、正常模式浏览器，并避免多页同时编辑。</p><button className="button primary wide" onClick={() => setPrivacy(false)}>知道了</button></section></div>}
    {projectModal && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="project-title"><div className="row-between"><span className="eyebrow">A BLANK PAGE</span><button className="icon-button" disabled={projectBusy} aria-label="取消创建项目" onClick={() => setProjectModal(false)}><X size={21} /></button></div><h2 id="project-title">从你的角色开始。</h2><p className="hint">空白项目不会带入演示台词。</p><form onSubmit={async event => {
      event.preventDefault(); setProjectBusy(true)
      const nextProject = { id: uid(), title: projectTitle.trim(), role: role.trim(), demo: false, createdAt: timestamp() }
      try { await mutate(workspace => ({ ...workspace, projects: [...workspace.projects, nextProject], selectedProjectId: nextProject.id })); setProjectModal(false); setProjectTitle(''); setRole(''); setSelected(''); setPlan(undefined); setPage('today'); notify('空白项目已创建，可以直接粘贴开练。') } catch {} finally { setProjectBusy(false) }
    }}><fieldset disabled={projectBusy}><label>项目名称<input autoFocus required maxLength={100} value={projectTitle} onChange={event => setProjectTitle(event.target.value)} placeholder="剧名 / 私人练习" /></label><label>我的角色<input required maxLength={60} value={role} onChange={event => setRole(event.target.value)} placeholder="角色名字" /></label><button className="button primary wide" disabled={!projectTitle.trim() || !role.trim()}>创建空白项目<ArrowUpRight size={18} /></button></fieldset></form></section></div>}
  </div>
}
