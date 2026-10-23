export type Page = 'today' | 'rehearse' | 'changes' | 'scene' | 'lab' | 'history'
export type TakeKey = 'A' | 'B'
export type Choice = TakeKey | 'both'
export type KnowledgeKind = 'known' | 'belief' | 'pending'

export interface Project {
  id: string
  title: string
  role: string
  demo: boolean
  createdAt: string
}

export interface Knowledge {
  id: string
  text: string
  kind: KnowledgeKind
  source: string
  confirmed: boolean
}

export interface Dialogue {
  id: string
  kind: 'self' | 'other' | 'action'
  text: string
  speaker?: string
}

export interface Scene {
  id: string
  projectId: string
  episode: string
  number: string
  title: string
  location: string
  time: string
  partner: string
  version: string
  before: string
  beforeSource: string
  knowledge: Knowledge[]
  original: string
  dialogue: Dialogue[]
  changes: string
  updatedAt: string
  want?: string
  turn?: string
  practiceRole?: string
}

export interface PracticeRange { start: number; end: number }
export interface PracticeBookmark {
  sceneId: string
  version: string
  script: string
  range: PracticeRange
  position: number
  side: 'self' | 'other'
  hidden: boolean
  loop: boolean
  rate: number
  updatedAt: string
}
export interface ScriptRevision {
  id: string
  sceneId: string
  before: Scene
  after: Scene
  createdAt: string
}

export interface Take {
  intent: string
  reflection: string
  mediaId: string | null
}

export interface Draft {
  id: string
  sceneId: string
  scene: Scene
  takes: Record<TakeKey, Take>
  choice: Choice
  note: string
  updatedAt: string
}

export interface Session extends Draft {
  savedAt: string
  projectTitle: string
  role: string
}

export interface Note {
  id: string
  sceneId: string
  version: string
  text: string
  createdAt: string
}

export interface Workspace {
  schema: 1
  projects: Project[]
  scenes: Scene[]
  drafts: Record<string, Draft>
  sessions: Session[]
  notes: Note[]
  selectedProjectId: string
  practice?: Record<string, PracticeBookmark>
  revisions?: ScriptRevision[]
}

export interface MediaAsset {
  id: string
  blob: Blob
  name: string
  type: string
  size: number
  createdAt: string
}

export const uid = () => crypto.randomUUID()
export const timestamp = () => new Date().toISOString()
export const sceneLabel = (scene: Scene) => !scene.episode && !scene.number ? '随手练习' : `第${scene.episode || '—'}集 · ${scene.number || '—'}场`
export const choiceLabel = (choice: Choice) => choice === 'both' ? '保留两版 · 暂不决定' : `选择 ${choice} 版`
export const dateLabel = (value: string) => new Intl.DateTimeFormat('zh-CN', {
  month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
}).format(new Date(value))
export const effectiveKnowledge = (item: Knowledge): KnowledgeKind =>
  item.kind === 'pending' || (!item.source.trim() && !item.confirmed) ? 'pending' : item.kind

export const sceneRevisionChanged = (snapshot: Scene, current: Scene): boolean =>
  snapshot.version !== current.version || snapshot.original !== current.original || snapshot.before !== current.before ||
  snapshot.beforeSource !== current.beforeSource || snapshot.changes !== current.changes ||
  snapshot.want !== current.want || snapshot.turn !== current.turn || snapshot.practiceRole !== current.practiceRole ||
  JSON.stringify(snapshot.dialogue) !== JSON.stringify(current.dialogue) || JSON.stringify(snapshot.knowledge) !== JSON.stringify(current.knowledge)

export function createScene(projectId: string): Scene {
  return {
    id: uid(), projectId, episode: '', number: '', title: '', location: '', time: '日 · 内',
    partner: '', version: 'v1', before: '', beforeSource: '', knowledge: [], original: '',
    dialogue: [], changes: '', updatedAt: timestamp(),
  }
}

export function createDraft(scene: Scene): Draft {
  return {
    id: uid(), sceneId: scene.id, scene: structuredClone(scene),
    takes: { A: { intent: '', reflection: '', mediaId: null }, B: { intent: '', reflection: '', mediaId: null } },
    choice: 'both', note: '', updatedAt: timestamp(),
  }
}

export function saveSession(draft: Draft, project: Project): Session {
  const required: TakeKey[] = draft.choice === 'both' ? ['A', 'B'] : [draft.choice]
  if (required.some(key => !draft.takes[key].intent.trim() && !draft.takes[key].mediaId)) {
    throw new Error('请为要保留的版本写下处理想法，或添加练习视频。')
  }
  return {
    ...structuredClone(draft), id: uid(), savedAt: timestamp(),
    projectTitle: project.title, role: draft.scene.practiceRole || project.role,
  }
}

export function referencedMedia(workspace: Workspace): Set<string> {
  const result = new Set<string>()
  for (const record of [...Object.values(workspace.drafts), ...workspace.sessions]) {
    for (const key of ['A', 'B'] as const) {
      const id = record.takes[key].mediaId
      if (id) result.add(id)
    }
  }
  return result
}

export function removeScene(workspace: Workspace, sceneId: string): Workspace {
  const drafts = { ...workspace.drafts }
  delete drafts[sceneId]
  const practice = { ...workspace.practice }
  delete practice[sceneId]
  return {
    ...workspace, scenes: workspace.scenes.filter(scene => scene.id !== sceneId), drafts,
    sessions: workspace.sessions.filter(session => session.sceneId !== sceneId),
    notes: workspace.notes.filter(note => note.sceneId !== sceneId),
    practice,
    revisions: workspace.revisions?.filter(revision => revision.sceneId !== sceneId),
  }
}

export function describeError(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'QuotaExceededError') return '设备存储空间不足，内容没有保存。请下载重要视频备份，清理不需要的记录后重试。'
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') return '摄像头或麦克风权限未开启。你仍可从相册导入视频，或在浏览器设置中开启权限后重试。'
    if (error.name === 'NotFoundError') return '没有找到可用的摄像头或麦克风，请从相册导入练习视频。'
    if (error.name === 'NotReadableError') return '摄像头或麦克风可能正在被其他应用占用，请关闭占用后重试，或导入视频。'
    if (error.name === 'NotSupportedError' || error.name === 'OverconstrainedError') return '当前设备不支持这次摄录配置，请使用相册导入兼容的 MP4 视频。'
    if (error.name === 'AbortError') return '操作已中断，原有记录未被替换。请重试。'
  }
  return error instanceof Error ? error.message : '操作未完成，请重试。'
}
