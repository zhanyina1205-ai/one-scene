import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Bookmark, Check, ChevronRight, CircleHelp, Clapperboard, FileText, Home, Plus, ShieldCheck, Trash2, X } from 'lucide-react'
import { createDraft, removeScene, sceneLabel, timestamp, uid, type Page, type Scene } from './domain'
import { storageEstimate } from './db'
import { History } from './History'
import { Lab, type LeaveGuard } from './Lab'
import { SceneCard } from './SceneCard'
import { SceneEditor } from './SceneEditor'
import { useWorkspace } from './store'

export function App() {
  const { data, mutate, notify, saving } = useWorkspace()
  const [page, setPage] = useState<Page>('today')
  const [selected, setSelected] = useState(() => data.scenes.find(scene => scene.projectId === data.selectedProjectId)?.id || '')
  const [editor, setEditor] = useState<Scene | 'new' | null>(null)
  const [projectModal, setProjectModal] = useState(false)
  const [privacy, setPrivacy] = useState(false)
  const [projectTitle, setProjectTitle] = useState('')
  const [role, setRole] = useState('')
  const [projectBusy, setProjectBusy] = useState(false)
  const [estimate, setEstimate] = useState<{ used: number; quota: number } | null>(null)
  const [keyboard, setKeyboard] = useState(false)
  const guard = useRef<LeaveGuard | null>(null)
  const project = data.projects.find(item => item.id === data.selectedProjectId) || data.projects[0]
  const scenes = data.scenes.filter(scene => scene.projectId === project.id)
  const scene = scenes.find(item => item.id === selected) || scenes[0]
  const registerGuard = useCallback((next: LeaveGuard | null) => { guard.current = next }, [])
  const mayLeave = async () => !guard.current || await guard.current()
  const scrollTop = () => window.scrollTo({ top: 0, behavior: 'instant' })
  const go = async (next: Page, nextScene?: Scene) => {
    if (next === page && (!nextScene || nextScene.id === selected)) return
    if (!await mayLeave()) return
    if (nextScene) setSelected(nextScene.id)
    setPage(next); scrollTop()
  }
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
  useEffect(() => {
    if (privacy) void storageEstimate().then(setEstimate)
  }, [privacy])

  if (editor) return <SceneEditor key={editor === 'new' ? 'new' : editor.id} projectId={project.id} initial={editor === 'new' ? undefined : editor} onClose={saved => { setEditor(null); if (saved) { setSelected(saved.id); setPage('scene'); notify('场次已保存。处境、原文和处理各自保留。') } scrollTop() }} />
  return <div className={`app-shell ${keyboard ? 'keyboard-open' : ''}`}>
    <header className="topbar"><button className="brand" onClick={() => void go('today')} aria-label="这一场 · 回到今日"><span className="brand-mark">一</span><span>这一场<small>演员的私人试演本</small></span></button><button className="icon-button privacy-button" aria-label="本地保存与隐私说明" onClick={() => setPrivacy(true)}><ShieldCheck size={21} /></button></header>
    <main className="page">
      <div className="project-switch"><label className="visually-hidden" htmlFor="project-select">当前项目</label><select id="project-select" value={project.id} disabled={saving} onChange={async event => {
        const id = event.target.value
        if (!await mayLeave()) return
        try { await mutate(workspace => ({ ...workspace, selectedProjectId: id })); setSelected(data.scenes.find(item => item.projectId === id)?.id || ''); setPage('today'); scrollTop() } catch {}
      }}>{data.projects.map(item => <option key={item.id} value={item.id}>{item.title} · {item.role}{item.demo ? ' / 虚构演示' : ''}</option>)}</select><button className="icon-button" aria-label="创建空白项目" onClick={async () => { if (await mayLeave()) setProjectModal(true) }}><Plus size={19} /></button></div>
      {page === 'today' ? <div className="card-stack today-page">
        <div className="greeting"><span className="eyebrow">A MOMENT BEFORE ACTION</span><h1>回到角色。<br /><span>从这一场开始。</span></h1></div>
        <section className="project-hero"><div className="row-between"><span className="eyebrow">当前项目</span><span className="hero-orbit" aria-hidden="true">✳</span></div><h2>《{project.title.replace(/^《|》$/g, '')}》</h2><p>饰演 <strong>{project.role}</strong></p><div className="hero-bottom"><span>{scenes.length} 个场次 <i />{data.sessions.filter(item => scenes.some(entry => entry.id === item.sceneId)).length} 次本人处理</span><span className="version-chip">{project.demo ? '虚构演示' : '私人项目'}</span></div></section>
        {project.demo && <p className="demo-note">虚构演示 · 所有角色、原文和示例想法均为演示创作，不代表真实演员资料。</p>}
        <div className="section-title"><div><span className="eyebrow">SCENES TO EXPLORE</span><h2>准备中的场次 <span className="count">{scenes.length.toString().padStart(2, '0')}</span></h2></div><button className="round-add" aria-label="新增场次" onClick={() => setEditor('new')}><Plus size={22} /></button></div>
        <div className="scene-list">{scenes.map((item, index) => {
          const records = data.sessions.filter(record => record.sceneId === item.id)
          return <article className="scene-row" key={item.id}><button className="scene-link" onClick={() => void go('scene', item)}><span className="scene-index">{String(index + 1).padStart(2, '0')}</span><div className="scene-row-body"><div className="row-between"><span className="eyebrow">{sceneLabel(item)}</span>{records.length > 0 && <span className="saved-chip"><Check size={11} />有本人处理</span>}</div><h3>{item.title}</h3><p>{item.location || '地点未填'} · {item.time}<br />对手：{item.partner || '未填写'}</p></div><ChevronRight size={18} /></button><div className="scene-row-actions"><button className="text-button" onClick={() => setEditor(item)}>编辑场次</button><button className="icon-button" aria-label={`删除场次${item.number}`} onClick={async () => { if (!window.confirm(`删除「${item.title}」及其草稿、笔记和所有已保存处理？未被其他记录引用的视频也会删除，此操作无法撤销。`)) return; try { await mutate(workspace => removeScene(workspace, item.id)); notify('已删除该场次及关联记录。') } catch {} }}><Trash2 size={14} /></button></div></article>
        })}</div>
        {!scenes.length && <section className="panel empty-state"><h2>从一场戏开始。</h2><p>手动填写前情与台词，不需要上传整份剧本。</p><button className="button primary" onClick={() => setEditor('new')}><Plus size={17} />创建第一个场次</button></section>}
        <button className="new-scene-button" onClick={() => setEditor('new')}><Plus size={18} />新增一个场次 <ArrowUpRight size={18} /></button>
        <div className="quiet-message"><span className="mini-line" /><p>不是标准答案，<br />是你自己的处理。</p></div>
        <button className="privacy-inline" onClick={() => setPrivacy(true)}><ShieldCheck size={15} />仅保存在当前设备 · 不默认上传 <CircleHelp size={14} /></button>
      </div> : <>
        {scene && page !== 'history' && <label className="scene-selector"><span>当前场次</span><select value={scene.id} onChange={async event => { const next = scenes.find(item => item.id === event.target.value); if (next && await mayLeave()) { setSelected(next.id); scrollTop() } }}>{scenes.map(item => <option key={item.id} value={item.id}>{sceneLabel(item)} · {item.title}</option>)}</select></label>}
        {page === 'history' ? <History key={project.id} projectId={project.id} onOpen={next => void go('scene', next)} onContinue={async session => {
          if (data.drafts[session.sceneId] && !window.confirm('将这条历史复制为新的草稿？当前场次已有草稿，会被替换。已保存的历史不受影响。')) return
          const next = { ...createDraft(session.scene), takes: structuredClone(session.takes), choice: session.choice, note: session.note }
          try { await mutate(workspace => ({ ...workspace, drafts: { ...workspace.drafts, [session.sceneId]: next } })); setSelected(session.sceneId); setPage('lab'); scrollTop() } catch {}
        }} /> : !scene ? <section className="panel empty-state"><h1>还没有场次</h1><p>先为这个角色录入一场戏。</p><button className="button primary" onClick={() => setEditor('new')}>新增场次</button></section> : page === 'scene' ? <SceneCard key={scene.id} scene={scene} onEdit={() => setEditor(scene)} onTry={() => void go('lab', scene)} /> : <Lab key={scene.id} scene={scene} registerGuard={registerGuard} onSaved={() => { setPage('scene'); scrollTop() }} />}
      </>}
    </main>
    <nav className="bottom-nav" aria-label="主导航">{([{ id: 'today', label: '今日', Icon: Home }, { id: 'scene', label: '戏前卡', Icon: FileText }, { id: 'lab', label: '试演台', Icon: Clapperboard }, { id: 'history', label: '我的处理', Icon: Bookmark }] as const).map(({ id, label, Icon }) => <button key={id} aria-current={page === id ? 'page' : undefined} onClick={() => void go(id)}><span><Icon size={21} strokeWidth={page === id ? 2 : 1.5} /></span><small>{label}</small></button>)}</nav>
    {privacy && <div className="modal-backdrop" onClick={event => { if (event.target === event.currentTarget) setPrivacy(false) }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="privacy-title"><div className="row-between"><ShieldCheck size={25} /><button className="icon-button" aria-label="关闭隐私说明" onClick={() => setPrivacy(false)}><X size={21} /></button></div><h2 id="privacy-title">私人的，留在此设备。</h2><p>剧本、个人笔记和练习视频存放在当前浏览器的 IndexedDB，不默认上传，不接入统计追踪。</p><p>本地保存不等于云端备份。清除网站数据、使用无痕模式、系统回收空间或更换浏览器 / 网址，都可能导致内容无法找回。重要视频请在回放下方下载。</p><p>摄录只在你点“开始录制”后请求权限。手机需使用 HTTPS；不支持摄录时仍可导入视频。</p>{estimate && <p className="source">当前网站约使用 {(estimate.used / 1024 / 1024).toFixed(1)} MB。可用额度由浏览器动态管理，不是备份保证。</p>}<p className="hint">这一版没有云同步，也没有离线安装包。建议在同一个固定网址、同一个正常模式浏览器使用，避免多页同时编辑。</p><button className="button primary wide" onClick={() => setPrivacy(false)}>知道了</button></section></div>}
    {projectModal && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="project-title"><div className="row-between"><span className="eyebrow">A BLANK PAGE</span><button className="icon-button" disabled={projectBusy} aria-label="取消创建项目" onClick={() => setProjectModal(false)}><X size={21} /></button></div><h2 id="project-title">从你的角色开始。</h2><p className="hint">空白项目不带入任何演示内容。</p><form onSubmit={async event => {
      event.preventDefault(); setProjectBusy(true)
      const nextProject = { id: uid(), title: projectTitle.trim(), role: role.trim(), demo: false, createdAt: timestamp() }
      try { await mutate(workspace => ({ ...workspace, projects: [...workspace.projects, nextProject], selectedProjectId: nextProject.id })); setProjectModal(false); setProjectTitle(''); setRole(''); setSelected(''); setPage('today'); notify('已创建空白项目。') } catch {} finally { setProjectBusy(false) }
    }}><fieldset disabled={projectBusy}><label>项目名称<input autoFocus required value={projectTitle} onChange={event => setProjectTitle(event.target.value)} placeholder="剧名 / 私人练习" /></label><label>我的角色<input required value={role} onChange={event => setRole(event.target.value)} placeholder="角色名字" /></label><button className="button primary wide" disabled={!projectTitle.trim() || !role.trim()}>创建空白项目 <ArrowUpRight size={18} /></button></fieldset></form></section></div>}
  </div>
}
