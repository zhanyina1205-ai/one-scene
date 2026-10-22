const appUrl = 'https://zhanyina1205-ai.github.io/one-scene/'
const momentContent = {
  room: { no: '01 / BEFORE THE CALL', title: '妆发还没结束，\n今天要拍的戏先到了。', text: '不一定适合录视频，也未必有完整的练习时间。先点开这一场，看看上次互动停在哪儿、角色此刻还不知道什么。', help: '这一刻，只看戏前卡。', detail: '前情、当前信息和原文依据分开呈现。没有确认的内容留在“待确认”，不用为了填满一张卡而猜。' },
  van: { no: '02 / A MOMENT BETWEEN TAKES', title: '独处候场时，\n想再试一种说法。', text: '同一段台词，想试试“给对方一个机会”，也想试试“把问题问到底”。两种出发点都属于自己的探索，不必先交出一个标准答案。', help: '这一刻，去试 A / B。', detail: '环境与拍摄许可允许时，主动摄录；不方便当下录，就只写一句出发点，或之后导入已经拍好的练习片段。' },
  night: { no: '03 / AFTER THE DAY GETS QUIET', title: '收工后回看，\n不只问“哪一版更好”。', text: '把两次尝试和当时的想法放在一起。比较的是自己想保留的方向，而不是让工具评价演得好不好。', help: '这一刻，留下一句理由。', detail: '更接近 A、更接近 B，或者先保留两版。把“为什么”和片段一起存下来，暂定也可以是一种选择。' },
  action: { no: '04 / BACK TO THIS SCENE', title: '几天后再拍，\n找回当时的那一下。', text: '重新回到这个场次，先看自己上次保存的处理。如果剧本变了，再检查旧处理还是否成立，而不是被新草稿覆盖。', help: '这一刻，找回自己的选择。', detail: '处理跟着场次、剧本版本和时间保存。旧记录保留原样，新理解可以继续试，不把后来知道的真相提前塞进角色。' },
}

const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])
const momentTabs = [...document.querySelectorAll('[data-moment]')]
function renderMoment(key, focus = false) {
  const moment = momentContent[key]
  momentTabs.forEach(tab => {
    const active = tab.dataset.moment === key
    tab.setAttribute('aria-selected', String(active))
    tab.tabIndex = active ? 0 : -1
    if (active && focus) tab.focus()
  })
  const panel = document.querySelector('#moment-panel')
  panel.setAttribute('aria-labelledby', `moment-tab-${key}`)
  panel.innerHTML = `<span class="moment-no">${moment.no}</span><h3>${moment.title.replace('\n', '<br>')}</h3><p>${moment.text}</p><div class="moment-help"><strong>${moment.help}</strong><p>${moment.detail}</p></div>`
}
momentTabs.forEach((tab, index) => {
  tab.addEventListener('click', () => renderMoment(tab.dataset.moment))
  tab.addEventListener('keydown', event => {
    let nextIndex
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % momentTabs.length
    if (event.key === 'ArrowLeft') nextIndex = (index + momentTabs.length - 1) % momentTabs.length
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = momentTabs.length - 1
    if (nextIndex === undefined) return
    event.preventDefault()
    renderMoment(momentTabs[nextIndex].dataset.moment, true)
  })
})
renderMoment('room')

const menuButton = document.querySelector('#menu-button')
const mobileMenu = document.querySelector('#mobile-menu')
function closeMenu() {
  mobileMenu.hidden = true
  menuButton.setAttribute('aria-expanded', 'false')
  menuButton.setAttribute('aria-label', '展开章节目录')
}
menuButton.addEventListener('click', () => {
  const open = mobileMenu.hidden
  mobileMenu.hidden = !open
  menuButton.setAttribute('aria-expanded', String(open))
  menuButton.setAttribute('aria-label', open ? '关闭章节目录' : '展开章节目录')
})
mobileMenu.addEventListener('click', event => { if (event.target.closest('a')) closeMenu() })
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !mobileMenu.hidden) {
    closeMenu()
    menuButton.focus()
  }
})

let demoState = createDemoState()
const demoScreen = document.querySelector('#demo-screen')
const choicesText = { A: '更接近 A', B: '更接近 B', both: '先保留两版' }
const stageText = { card: '戏前卡', try: 'A/B 尝试', compare: '对照与选择', saved: '已回写的戏前卡' }
const panel = (title, text, extra = '') => `<div class="mini-panel"><h5>${title}</h5><p>${text}</p>${extra}</div>`
const takePanel = (take, content) => `<div class="mini-compare"><b>尝试 ${take} · 示例出发点</b><p>${escapeHtml(content.intent)}</p><p class="mini-note">${escapeHtml(content.reflection)}</p></div>`

function renderDemo(message = '') {
  const scene = demoScenes[demoState.sceneId]
  document.querySelectorAll('[data-scene]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.scene === scene.id)))
  document.querySelectorAll('[data-stage]').forEach(button => {
    const selected = button.dataset.stage === demoState.stage
    if (selected) button.setAttribute('aria-current', 'step')
    else button.removeAttribute('aria-current')
    button.disabled = button.dataset.stage === 'saved' && !demoState.saved
  })
  document.querySelector('#scene-insight').textContent = scene.insight
  document.querySelector('#phone-nav-card').classList.toggle('active', ['card', 'saved'].includes(demoState.stage))
  document.querySelector('#phone-nav-lab').classList.toggle('active', ['try', 'compare'].includes(demoState.stage))
  const header = `<div class="mini-brand"><span>这一场</span><span>虚构交互示意</span></div><div class="mini-hero"><span class="mini-eyebrow">《渡桥》 / 沈知微 / ${scene.version}</span><h4>${stageText[demoState.stage]}</h4><p>第 ${scene.episode} 集 · ${scene.id} 场　${scene.place}</p></div>`
  let content = ''
  if (demoState.stage === 'card') {
    content = panel('见面之前', scene.before) + panel('此刻，角色相信什么', scene.belief, `<div class="mini-source">原文依据 · ${scene.source}</div>`) + panel('<span class="mini-tag">待确认</span>', scene.pending) + `<div class="mini-note">剧本事实与本人的理解分开。这里的原文、处境均为虚构示例。</div><button class="mini-button" data-next="try">带着这一场，去试一遍 ↗</button>`
  }
  if (demoState.stage === 'try') {
    const take = demoState.take
    content = `<div class="mini-take-switch" role="group" aria-label="切换示例尝试"><button data-take="A" aria-pressed="${take === 'A'}">尝试 A</button><button data-take="B" aria-pressed="${take === 'B'}">尝试 B</button></div><div class="mini-intent"><span class="mini-eyebrow">这次我想怎样处理 · 示例</span><p>${scene.takes[take].intent}</p></div><div class="mini-panel mini-script"><p><strong>对手 / </strong>${scene.other}</p><p><strong>本人 / </strong>${scene.own}</p><p class="mini-note">动作：${scene.action}</p></div><div class="mini-video"><b>PRIVATE TRY / ${take}</b><p>真实工具可主动摄录 / 相册导入<br>此处是讲解示意，不是试演录像。</p></div><p class="mini-note">${scene.takes[take].reflection}</p><button class="mini-button" data-next="compare">把 A / B 放在一起看 ↗</button>`
  }
  if (demoState.stage === 'compare') {
    content = takePanel('A', scene.takes.A) + takePanel('B', scene.takes.B) + `<div class="mini-choice" role="group" aria-label="选择示例处理">${demoChoices.map(choice => `<button data-choice="${choice}" aria-pressed="${demoState.choice === choice}">${choicesText[choice]}</button>`).join('')}</div><div class="mini-reason"><strong>我想留给下次开拍的处理</strong><p>${scene.reasons[demoState.choice]}</p></div><button class="mini-button" data-save>模拟保存，回到戏前卡 ↗</button><p class="mini-note">仅保存本次网页演示状态；刷新清除，不写入真实工具。</p>`
  }
  if (demoState.stage === 'saved') {
    const saved = demoState.saved
    const time = new Date(saved.recordedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    content = `<div class="mini-saved-label">示例处理已回写 <b>${choicesText[saved.choice]}</b></div>${takePanel('A', saved.takes.A)}${takePanel('B', saved.takes.B)}<div class="mini-reason"><strong>留给下次开拍</strong><p>${saved.reason}</p></div><p class="mini-note">第 ${saved.episode} 集 · ${saved.sceneId} 场 / 剧本 ${saved.version}<br>本次模拟记录 ${time} · 非真实演员资料<br>${saved.choice === 'both' ? '暂不决定：两种出发点完整保留。' : `偏向 ${saved.choice}，另一版仍在记录中。`}</p><button class="mini-button" data-next="try">保留这次选择，继续尝试 ↗</button>`
  }
  demoScreen.innerHTML = header + content
  demoScreen.scrollTop = 0
  document.querySelector('#demo-status').textContent = message || `正在展示虚构场次 ${scene.episode}–${scene.id} 的${stageText[demoState.stage]}。`
}

document.querySelectorAll('[data-scene]').forEach(button => button.addEventListener('click', () => {
  demoState = createDemoState(button.dataset.scene)
  renderDemo('已切换虚构场次；信息和示例处理随场次重置，不会混在一起。')
}))
document.querySelectorAll('[data-stage]').forEach(button => button.addEventListener('click', () => {
  demoState = setDemoStage(demoState, button.dataset.stage)
  renderDemo()
  if (matchMedia('(max-width: 800px)').matches) document.querySelector('.phone-stage').scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
}))
demoScreen.addEventListener('click', event => {
  const button = event.target.closest('button')
  if (!button) return
  if (button.dataset.next) demoState = setDemoStage(demoState, button.dataset.next)
  if (button.dataset.take) demoState = { ...demoState, take: button.dataset.take }
  if (button.dataset.choice) demoState = { ...demoState, choice: button.dataset.choice }
  if (button.hasAttribute('data-save')) {
    demoState = saveDemoChoice(demoState)
    renderDemo(`虚构场次 ${demoState.saved.episode}–${demoState.saved.sceneId}：${choicesText[demoState.saved.choice]}，两版想法和理由已回写到示意卡片。`)
    return
  }
  const focusAttribute = button.hasAttribute('data-take') ? 'data-take' : button.hasAttribute('data-choice') ? 'data-choice' : null
  const focusValue = focusAttribute && button.getAttribute(focusAttribute)
  const previousScroll = demoScreen.scrollTop
  renderDemo()
  if (focusAttribute) {
    demoScreen.scrollTop = previousScroll
    demoScreen.querySelector(`[${focusAttribute}="${focusValue}"]`).focus({ preventScroll: true })
  }
})
document.querySelector('#reset-demo').addEventListener('click', () => {
  demoState = createDemoState(demoState.sceneId)
  renderDemo('虚构演示已重置；真实工具的数据不受影响。')
})
renderDemo()

document.querySelector('#copy-link').addEventListener('click', async () => {
  const feedback = document.querySelector('#copy-feedback')
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
    await navigator.clipboard.writeText(appUrl)
    feedback.textContent = '已复制真实工具体验链接。'
  } catch {
    feedback.textContent = `浏览器未允许复制，请手动复制：${appUrl}`
  }
})
document.querySelector('#print-proposal').addEventListener('click', () => window.print())
document.querySelector('#download-html').addEventListener('click', event => {
  event.preventDefault()
  const url = URL.createObjectURL(new Blob([`<!doctype html>\n${document.documentElement.outerHTML}`], { type: 'text/html;charset=utf-8' }))
  const download = document.createElement('a')
  download.href = url
  download.download = '这一场_产品试用提案.html'
  document.body.append(download)
  download.click()
  download.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  document.querySelector('#copy-feedback').textContent = '已发起 HTML 下载，请查看浏览器的下载列表。'
})

const chapters = [...document.querySelectorAll('[data-chapter]')]
let readingScheduled = false
function updateReading() {
  const progress = document.documentElement.scrollHeight - innerHeight
  document.querySelector('#reading-progress').style.width = `${progress > 0 ? Math.min(100, Math.max(0, scrollY / progress * 100)) : 100}%`
  const current = [...chapters].reverse().find(chapter => chapter.getBoundingClientRect().top < innerHeight * .45) || chapters[0]
  document.querySelector('#reading-label').textContent = current.dataset.chapter
  readingScheduled = false
}
function scheduleReading() {
  if (readingScheduled) return
  readingScheduled = true
  requestAnimationFrame(updateReading)
}
window.addEventListener('scroll', scheduleReading, { passive: true })
window.addEventListener('resize', scheduleReading, { passive: true })
window.addEventListener('load', scheduleReading)
updateReading()
