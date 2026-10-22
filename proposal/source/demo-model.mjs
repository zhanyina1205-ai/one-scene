export const demoScenes = {
  '14': {
    id: '14', episode: '12', version: 'v3', title: '因一封信争执', place: '沈家偏厅 · 夜',
    before: '沈知微收到一封署名陆川的信，信中让她离开渡口、不再相见。她带着信来问他。',
    belief: '她把信当成陆川的意思，但还在等他亲口说出答案。',
    source: '虚构原文：“这是你的字，你现在又说不是你的意思？”',
    pending: '这封信是否真由陆川写下？他为什么迟迟不解释？',
    insight: '争执时，她相信这封信与陆川有关；“信是伪造的”还不是她掌握的信息。',
    own: '那你看着我，把信里的话再说一遍。', other: '知微，这件事不是你想的那样。', action: '她把折好的信放在两人之间。',
    takes: {
      A: { intent: '不是质问他，是给他最后一次否认的机会。', reflection: '示例感受：声音放轻后，更能感到她在等，而不是已经认定了。' },
      B: { intent: '先把受伤藏起来，要他为这封信负责。', reflection: '示例感受：句尾更硬，像在守住最后一点体面。' },
    },
    reasons: { A: '示例理由：我想先留住那一点期待，让后面的失望有来处。', B: '示例理由：这场先用体面挡住受伤，更接近我此刻的理解。', both: '示例理由：期待与防备都成立，等和导演沟通后再继续试。' },
  },
  '18': {
    id: '18', episode: '12', version: 'v3', title: '再次要求他解释', place: '旧桥边 · 晨',
    before: '上一场因信争执，陆川没有给出明确解释。分别一夜后，沈知微在旧桥边再次叫住他。',
    belief: '她知道他没有解释清楚；她怀疑他在隐瞒，但并不知道信是伪造的。',
    source: '虚构原文：“昨晚你没说完，今天我还在等。”',
    pending: '他在隐瞒什么？她是否愿意再相信他一次？后者需要本人确认自己的处理。',
    insight: '这一场她仍不知道信是伪造的，不能把后面的真相提前带进来。',
    own: '我只问这一次，那封信，真的是你的意思吗？', other: '如果我说不是，你还肯信我吗？', action: '她没有走近，手里的信也没有拿出来。',
    takes: {
      A: { intent: '表面平静，不再追着问；把最后一次靠近留给他。', reflection: '示例感受：停一下再问，像把信不信的决定交回给对方。' },
      B: { intent: '压住委屈，逼自己把问题问到底。', reflection: '示例感受：说得更快，像怕他再次转身离开。' },
    },
    reasons: { A: '示例理由：先保留这份克制；她不是不在意，而是不愿再先靠近。', B: '示例理由：更急一点，让她想要答案的迫切先露出来。', both: '示例理由：克制和急切都想再试，暂不决定，保留两种出发点。' },
  },
  '22': {
    id: '22', episode: '12', version: 'v3', title: '后来得知信被伪造', place: '沈家书房 · 夜',
    before: '弟弟承认仿写了陆川的字、伪造那封信。沈知微终于知道，先前的判断建立在假信上。',
    belief: '现在她已知道信被伪造；但陆川此刻是否愿意见她，仍然未知。',
    source: '虚构原文：弟弟低头说：“字是我仿的，他从没让你走。”',
    pending: '她怎样面对自己的误会？陆川是否还在旧桥等她？',
    insight: '到这一场她才掌握信被伪造的事实。前面两场的理解仍保留，不被真相倒写。',
    own: '你再说一遍。他从来没有写过那封信？', other: '是我写的。他不知道。', action: '她低头看那封信，没有立刻起身。',
    takes: {
      A: { intent: '先不急着后悔，让真相一点一点落下来。', reflection: '示例感受：不马上抬头，像还需要重新理解过去发生的事。' },
      B: { intent: '忍住对弟弟的愤怒，心里先想着要去找他。', reflection: '示例感受：身体先动了一下，比台词更早露出想离开的念头。' },
    },
    reasons: { A: '示例理由：先给她一个重新相信的过程，不急着把情绪演完。', B: '示例理由：我想让“去找他”成为此刻最先发生的冲动。', both: '示例理由：先留住消化真相和急于行动两种可能，下次再对照。' },
  },
}

export const demoStages = ['card', 'try', 'compare', 'saved']
export const demoChoices = ['A', 'B', 'both']

export function createDemoState(sceneId = '18') {
  if (!Object.hasOwn(demoScenes, sceneId)) throw new Error('Unknown demo scene')
  return { sceneId, stage: 'card', take: 'A', choice: 'A', saved: null }
}

export function setDemoStage(state, stage) {
  if (!demoStages.includes(stage)) throw new Error('Unknown demo stage')
  if (stage === 'saved' && !state.saved) return state
  return { ...state, stage }
}

export function saveDemoChoice(state, recordedAt = new Date().toISOString()) {
  if (!demoChoices.includes(state.choice)) throw new Error('Unknown demo choice')
  const scene = demoScenes[state.sceneId]
  return {
    ...state,
    stage: 'saved',
    saved: structuredClone({
      sceneId: scene.id, episode: scene.episode, version: scene.version, title: scene.title,
      takes: scene.takes, choice: state.choice, reason: scene.reasons[state.choice], recordedAt,
    }),
  }
}
