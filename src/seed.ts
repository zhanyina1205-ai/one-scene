import { createDraft, timestamp, type Scene, type Workspace } from './domain'

export function demoWorkspace(): Workspace {
  const createdAt = timestamp()
  const projectId = 'demo-duqiao'
  const common = {
    projectId, episode: '12', version: 'v3', partner: '陆川', updatedAt: createdAt,
  }
  const scenes: Scene[] = [
    {
      ...common, id: 'demo-14', number: '14', title: '信没有被解释', location: '庭院', time: '日 · 外',
      before: '知微收到署名陆川的信。信里的承诺与他的行为矛盾，她来问清楚。',
      beforeSource: '虚构演示稿 · 第12集11场：知微拆信，看到陆川的署名。',
      knowledge: [
        { id: 'k14', text: '她相信信是陆川写的，还没有听到他的解释。', kind: 'belief', source: '虚构演示稿 · 本场质问', confirmed: true },
      ],
      original: '知微把信放在石桌上。\n知微：“信是你写的，为什么现在又不认？”\n陆川看向院门，没有回答。\n知微收起信，转身离开。',
      dialogue: [
        { id: 'd14-1', kind: 'action', text: '知微把信放在石桌上。' },
        { id: 'd14-2', kind: 'self', text: '信是你写的，为什么现在又不认？' },
        { id: 'd14-3', kind: 'other', text: '（陆川看向院门，没有回答。）' },
      ], changes: '',
    },
    {
      ...common, id: 'demo-18', number: '18', title: '再给他一次解释的机会', location: '书房', time: '夜 · 内',
      before: '上一次，两人因那封信争执。陆川没有解释，知微带着信离开。两人尚未和解。',
      beforeSource: '虚构演示稿 · 第12集14场',
      knowledge: [
        { id: 'k18-1', text: '陆川上次没有解释那封信。', kind: 'known', source: '虚构演示稿 · 第12集14场', confirmed: false },
        { id: 'k18-2', text: '知微仍相信信出自陆川。', kind: 'belief', source: '虚构演示稿 · 第12集18场', confirmed: true },
        { id: 'k18-3', text: '她是否已隐约怀疑哥哥？', kind: 'pending', source: '', confirmed: false },
      ],
      original: '知微把折好的信放在桌上，没有推过去。\n知微：“我再问你一次，这封信，你认不认？”\n陆川：“有些事，现在还不能说。”\n知微：“那你至少看着我说。”',
      dialogue: [
        { id: 'd18-1', kind: 'action', text: '把折好的信放在桌上，没有推过去。' },
        { id: 'd18-2', kind: 'self', text: '我再问你一次，这封信，你认不认？' },
        { id: 'd18-3', kind: 'other', text: '有些事，现在还不能说。' },
        { id: 'd18-4', kind: 'self', text: '那你至少看着我说。' },
      ], changes: 'v2 → v3：结尾新增“那你至少看着我说。”旧版相关处理需要重新核对。',
    },
    {
      ...common, id: 'demo-22', number: '22', title: '真相被说出口', location: '回廊', time: '夜 · 内', partner: '沈衡',
      before: '她向陆川追问，仍未得到解释。回廊里，兄长叫住了她。',
      beforeSource: '虚构演示稿 · 第12集18场',
      knowledge: [
        { id: 'k22-1', text: '她在本场得知信由兄长伪造。', kind: 'known', source: '虚构演示稿 · 沈衡的当面承认', confirmed: true },
        { id: 'k22-2', text: '她是否已理解兄长伪造信件的动机？', kind: 'pending', source: '', confirmed: false },
      ],
      original: '沈衡：“信是我写的。陆川不知情。”\n知微停下脚步，手里的信被攥紧。\n她转过身，没有立刻开口。',
      dialogue: [
        { id: 'd22-1', kind: 'other', text: '信是我写的。陆川不知情。' },
        { id: 'd22-2', kind: 'action', text: '停步、攥紧信、转身，没有立刻开口。' },
      ], changes: '',
    },
  ]
  const draft = createDraft(scenes[1])
  draft.takes.A.intent = '【示例】先给他解释的机会，开场留一点期待。'
  draft.takes.B.intent = '【示例】先直接求证，听完回答再判断。'
  return {
    schema: 1, projects: [{ id: projectId, title: '渡桥', role: '沈知微', demo: true, createdAt }],
    scenes, drafts: { [draft.sceneId]: draft }, sessions: [], selectedProjectId: projectId,
    notes: [{ id: 'demo-note', sceneId: 'demo-18', version: 'v3', text: '【示例笔记】这次来，是想听到解释。开场还有期待，追问时才开始不信任。', createdAt }],
  }
}
