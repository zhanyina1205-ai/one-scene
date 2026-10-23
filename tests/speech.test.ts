import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CueSpeaker, localChineseVoices, type ReaderState } from '../src/speech'

const voice = (localService = true, lang = 'zh-CN') => ({ localService, lang, name: 'Test local voice', voiceURI: 'test', default: false }) as SpeechSynthesisVoice
function harness() {
  const utterances: SpeechSynthesisUtterance[] = []
  const states: ReaderState[] = []
  const engine = { cancel: vi.fn(), speak: vi.fn() }
  const reader = new CueSpeaker(engine, state => states.push(state), text => {
    const utterance = { text, onstart: null, onend: null, onerror: null } as unknown as SpeechSynthesisUtterance
    utterances.push(utterance); return utterance
  })
  return { reader, engine, utterances, states, latest: () => states.at(-1)! }
}
beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('本地对手朗读与手动降级', () => {
  it('只接受标记为本地的中文声音，不选远程或其他语言', () => {
    expect(localChineseVoices([voice(false), voice(true, 'en-US'), voice(true, 'zh-TW'), voice(true)])).toHaveLength(2)
    expect(localChineseVoices([voice(true, 'zh-TW'), voice(true)])[0].lang).toBe('zh-CN')
  })
  it('创建播放器不朗读，用户请求后开始；读完只通知，不自动接句', () => {
    const setup = harness()
    expect(setup.engine.speak).not.toHaveBeenCalled()
    setup.reader.speak('对手台词', voice(), 1)
    expect(setup.latest().phase).toBe('preparing')
    setup.utterances[0].onstart!({} as SpeechSynthesisEvent)
    expect(setup.latest().phase).toBe('speaking')
    setup.utterances[0].onend!({} as SpeechSynthesisEvent)
    vi.runAllTimers()
    expect(setup.latest().phase).toBe('finished')
    expect(setup.engine.speak).toHaveBeenCalledTimes(1)
  })
  it('停止或重读使旧回调失效，并取消已有声音', () => {
    const setup = harness(); setup.reader.speak('第一句', voice(), 1)
    const oldEnd = setup.utterances[0].onend!
    const oldError = setup.utterances[0].onerror!
    setup.reader.speak('重读', voice(), 1)
    oldEnd.call(setup.utterances[0], {} as SpeechSynthesisEvent); oldError.call(setup.utterances[0], {} as SpeechSynthesisErrorEvent)
    expect(setup.latest().phase).toBe('preparing')
    setup.reader.stop(); vi.runAllTimers()
    expect(setup.latest().phase).toBe('idle')
    expect(setup.engine.cancel).toHaveBeenCalledTimes(3)
  })
  it('远程声音、无能力与空句不请求朗读，仍提供手动路径', () => {
    const setup = harness(); setup.reader.speak('原文', voice(false), 1)
    expect(setup.engine.speak).not.toHaveBeenCalled()
    expect(setup.latest().message).toContain('手动')
    setup.reader.speak(' ', voice(), 1)
    expect(setup.latest().phase).toBe('error')
    const states: ReaderState[] = []; const reader = new CueSpeaker(undefined, state => states.push(state))
    reader.speak('原文', voice(), 1)
    expect(states.at(-1)!.message).toContain('手动')
  })
  it('系统异常、拒绝和没有启动时不会永远显示正在朗读', () => {
    const setup = harness(); setup.engine.speak.mockImplementationOnce(() => { throw new Error('unsupported') })
    setup.reader.speak('句子', voice(), 1)
    expect(setup.latest().phase).toBe('error')
    setup.reader.speak('再试', voice(), 1)
    setup.utterances[1].onerror!({} as SpeechSynthesisErrorEvent)
    expect(setup.latest().message).toContain('手动')
    setup.reader.speak('未响应', voice(), 1)
    vi.advanceTimersByTime(6000)
    expect(setup.latest().message).toContain('没有响应')
  })
  it('开始后失去结束回调会超时取消，语速限定安全范围', () => {
    const setup = harness(); setup.reader.speak('词', voice(), 100)
    expect(setup.utterances[0].rate).toBe(1.3)
    setup.utterances[0].onstart!({} as SpeechSynthesisEvent)
    vi.advanceTimersByTime(15000)
    expect(setup.latest().message).toContain('超时')
    setup.reader.speak('词', voice(), 0)
    expect(setup.utterances[1].rate).toBe(.6)
    setup.reader.stop()
  })
})
