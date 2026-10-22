import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createDemoState, demoScenes, saveDemoChoice, setDemoStage } from '../source/demo-model.mjs'

test('earlier scenes do not inherit the later discovery', () => {
  assert.match(demoScenes['14'].belief, /把信当成/)
  assert.match(demoScenes['18'].belief, /并不知道信是伪造/)
  assert.match(demoScenes['22'].belief, /已知道信被伪造/)
  assert.notEqual(demoScenes['18'].before, demoScenes['22'].before)
})

test('all scenes have traceable fictional sources and two distinct approaches', () => {
  for (const scene of Object.values(demoScenes)) {
    assert.match(scene.source, /虚构原文/)
    assert.ok(scene.pending)
    assert.notEqual(scene.takes.A.intent, scene.takes.B.intent)
    assert.ok(scene.reasons.both)
  }
})

test('saved stage is unavailable until a deliberate save', () => {
  const state = createDemoState()
  assert.equal(setDemoStage(state, 'saved'), state)
  assert.equal(setDemoStage(state, 'try').stage, 'try')
  assert.throws(() => setDemoStage(state, 'unknown'))
})

test('choosing A preserves a versioned snapshot with both approaches and a reason', () => {
  const result = saveDemoChoice(createDemoState('18'), '2026-10-22T16:00:00Z')
  assert.equal(result.stage, 'saved')
  assert.equal(result.saved.choice, 'A')
  assert.equal(result.saved.sceneId, '18')
  assert.equal(result.saved.version, 'v3')
  assert.equal(result.saved.recordedAt, '2026-10-22T16:00:00Z')
  assert.match(result.saved.reason, /克制/)
  assert.deepEqual(result.saved.takes, demoScenes['18'].takes)
})

test('pending choice preserves two ideas instead of picking a winner', () => {
  const result = saveDemoChoice({ ...createDemoState('14'), choice: 'both' })
  assert.equal(result.saved.choice, 'both')
  assert.equal(Object.keys(result.saved.takes).length, 2)
  assert.match(result.saved.reason, /再继续试/)
})

test('saved snapshot does not reference the mutable example source', () => {
  const first = saveDemoChoice(createDemoState())
  const second = saveDemoChoice({ ...first, choice: 'B' })
  assert.notEqual(first.saved.takes, demoScenes['18'].takes)
  assert.notEqual(first.saved.takes.A, demoScenes['18'].takes.A)
  assert.equal(first.saved.choice, 'A')
  assert.equal(second.saved.choice, 'B')
})

test('switching scenes starts a separate example and never keeps the old result', () => {
  const previous = saveDemoChoice(createDemoState('14'))
  const next = createDemoState('22')
  assert.equal(previous.saved.sceneId, '14')
  assert.equal(next.sceneId, '22')
  assert.equal(next.saved, null)
  assert.equal(next.stage, 'card')
  assert.throws(() => createDemoState('missing'))
  assert.throws(() => saveDemoChoice({ ...next, choice: 'winner' }))
})

test('built HTML is standalone, labelled, and has no external runtime assets', async () => {
  const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8')
  assert.doesNotMatch(html, /\{\{[A-Z_]+\}\}/)
  assert.equal((html.match(/src="data:image\/jpeg;base64,/g) || []).length, 2)
  assert.doesNotMatch(html, /<(?:script|link)[^>]+(?:src|href)="https?:/)
  assert.doesNotMatch(html, /localStorage|getUserMedia|analytics\.js/)
  for (const id of ['why', 'moments', 'value', 'walkthrough', 'benefits', 'privacy', 'reality', 'invitation']) {
    assert.match(html, new RegExp(`id="${id}"`))
  }
  assert.match(html, /非官方合作/)
  assert.match(html, /AI 情境配图/)
  assert.match(html, /此处是讲解示意，不是试演录像/)
})
