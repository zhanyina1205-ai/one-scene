import { createScene, timestamp, type Workspace } from './domain'
import { formatDialogue, parseDialogue } from './practice'

export const tenLines = '林舟：你还在等那封回信？\n周宁：我想等他亲口说。\n林舟：如果他今天不来呢？\n周宁：那我就明天再问。\n林舟：你已经问过一次了。\n周宁：上一次，我没有听完。\n林舟：这次你想听到什么？\n周宁：不是解释，是一句实话。\n林舟：门外有人。\n周宁：先别开门，让我想清楚。'
export function ensurePracticeDemo(workspace: Workspace): { workspace: Workspace; sceneId: string } {
  const projectId = 'demo-cue-project'
  const sceneId = 'demo-cue-ten'
  const existing = workspace.scenes.find(scene => scene.id === sceneId && scene.projectId === projectId)
  if (existing && workspace.projects.some(project => project.id === projectId)) return { workspace: { ...workspace, selectedProjectId: projectId }, sceneId }
  const dialogue = parseDialogue(tenLines, '周宁').lines
  const scene = { ...createScene(projectId), id: sceneId, title: '门口的回答 · 十句虚构演示', partner: '林舟', original: formatDialogue(dialogue), dialogue, before: '【虚构示例】周宁在等一封回信，林舟劝她离开。', want: '【示例】想等对方亲口说清楚。', turn: '【示例】听到门外有人，暂时不让开门。' }
  return { workspace: { ...workspace, selectedProjectId: projectId, projects: workspace.projects.some(project => project.id === projectId) ? workspace.projects : [...workspace.projects, { id: projectId, title: '十句开练 · 虚构演示', role: '周宁', demo: true, createdAt: timestamp() }], scenes: [...workspace.scenes, scene] }, sceneId }
}
