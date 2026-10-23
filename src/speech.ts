export type ReaderState = { phase: 'idle' | 'preparing' | 'speaking' | 'finished' | 'error'; message: string }
export const localChineseVoices = (voices: SpeechSynthesisVoice[]) => voices.filter(voice => voice.localService === true && /^(zh|cmn)(-|_|$)/i.test(voice.lang)).sort((first, second) => Number(/^zh[-_]CN$/i.test(second.lang)) - Number(/^zh[-_]CN$/i.test(first.lang)))

export class CueSpeaker {
  private generation = 0
  private startTimer?: ReturnType<typeof setTimeout>
  private finishTimer?: ReturnType<typeof setTimeout>
  private utterance?: SpeechSynthesisUtterance
  constructor(private engine: Pick<SpeechSynthesis, 'speak' | 'cancel'> | undefined, private changed: (state: ReaderState) => void, private makeUtterance = (text: string) => new SpeechSynthesisUtterance(text)) {}
  private clear() {
    clearTimeout(this.startTimer); clearTimeout(this.finishTimer)
    if (this.utterance) { this.utterance.onstart = null; this.utterance.onend = null; this.utterance.onerror = null }
    this.utterance = undefined
  }
  stop(notify = true) {
    this.generation++; this.clear()
    try { this.engine?.cancel() } catch {}
    if (notify) this.changed({ phase: 'idle', message: '已停止。仍可手动继续。' })
  }
  speak(text: string, voice: SpeechSynthesisVoice | undefined, rate: number) {
    this.stop(false)
    if (!this.engine || !voice || voice.localService !== true || !localChineseVoices([voice]).length) { this.changed({ phase: 'error', message: '没有可用的本地中文声音，仍可遮词并手动接句。' }); return }
    if (!text.trim()) { this.changed({ phase: 'error', message: '这句没有可朗读内容，请手动继续。' }); return }
    const generation = this.generation
    const fail = (message: string) => {
      if (generation !== this.generation) return
      this.stop(false); this.changed({ phase: 'error', message })
    }
    try {
      const utterance = this.makeUtterance(text)
      this.utterance = utterance; utterance.voice = voice; utterance.lang = voice.lang; utterance.rate = Math.min(1.3, Math.max(0.6, rate))
      utterance.onstart = () => {
        if (generation !== this.generation) return
        clearTimeout(this.startTimer); this.changed({ phase: 'speaking', message: '正在读对手台词。读完不会自动跳句。' })
      }
      utterance.onend = () => {
        if (generation !== this.generation) return
        this.generation++; this.clear(); this.changed({ phase: 'finished', message: '对手已读完。按你的节奏，点下一句。' })
      }
      utterance.onerror = () => fail('系统朗读失败或被中断。可以重读，或直接手动继续。')
      this.startTimer = setTimeout(() => fail('系统语音没有响应，已停止。点重读重试，或手动继续。'), 6000)
      this.finishTimer = setTimeout(() => fail('朗读等待超时，已停止。请重读或手动继续。'), Math.max(15000, Math.min(180000, text.length * 800 / utterance.rate + 10000)))
      this.changed({ phase: 'preparing', message: '正在请求系统本地朗读…' }); this.engine.speak(utterance)
    } catch { fail('当前浏览器不能完成朗读，仍可遮词并手动接句。') }
  }
}
