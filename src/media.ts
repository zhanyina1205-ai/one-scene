import { uid, timestamp, type MediaAsset } from './domain'

export type CaptureState = 'idle' | 'requesting' | 'recording' | 'stopping'
export interface CaptureEnvironment {
  secure: boolean
  devices?: Pick<MediaDevices, 'getUserMedia'>
  Recorder?: typeof MediaRecorder
}
interface CaptureCallbacks {
  onState: (state: CaptureState) => void
  onStream: (stream: MediaStream | null) => void
  onResult: (blob: Blob) => void
  onError: (error: unknown) => void
}

export function recorderMime(Recorder: typeof MediaRecorder): string | undefined {
  if (typeof Recorder.isTypeSupported !== 'function') return undefined
  return ['video/mp4;codecs=avc1.424028,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp8,opus', 'video/webm'].find(type => Recorder.isTypeSupported(type))
}

export function createCapture(callbacks: CaptureCallbacks, environment: CaptureEnvironment = {
  secure: window.isSecureContext,
  devices: navigator.mediaDevices,
  Recorder: typeof MediaRecorder === 'undefined' ? undefined : MediaRecorder,
}) {
  let stream: MediaStream | null = null
  let recorder: MediaRecorder | null = null
  let generation = 0
  let disposed = false
  let failed = false
  let chunks: Blob[] = []

  const release = () => {
    stream?.getTracks().forEach(track => track.stop())
    stream = null
    if (!disposed) callbacks.onStream(null)
  }
  const fail = (error: unknown) => {
    failed = true
    release()
    if (!disposed) { callbacks.onState('idle'); callbacks.onError(error) }
  }
  return {
    async start() {
      if (disposed || recorder?.state === 'recording') return
      const request = ++generation
      failed = false
      chunks = []
      callbacks.onState('requesting')
      try {
        if (!environment.secure) throw new Error('当前连接无法启用摄像头。请在 HTTPS 页面或本机 localhost 中录制；手机通过局域网 HTTP 打开时，可以从相册导入视频。')
        if (!environment.devices || !environment.Recorder) throw new Error('当前浏览器没有可用的网页摄录能力，请使用相册导入。')
        const acquired = await environment.devices.getUserMedia({ audio: true, video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } })
        if (disposed || request !== generation) { acquired.getTracks().forEach(track => track.stop()); return }
        stream = acquired
        const mimeType = recorderMime(environment.Recorder)
        recorder = new environment.Recorder(acquired, mimeType ? { mimeType } : undefined)
        recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
        recorder.onerror = () => { fail(new Error('录制中断，请重试或从相册导入。原有视频没有被替换。')); if (recorder?.state !== 'inactive') { try { recorder?.stop() } catch {} } }
        recorder.onstop = () => {
          const type = recorder?.mimeType || chunks[0]?.type || 'video/webm'
          const blob = new Blob(chunks, { type })
          release()
          if (disposed || failed) return
          callbacks.onState('idle')
          if (blob.size) callbacks.onResult(blob)
          else callbacks.onError(new Error('这次没有录到有效内容，请重试。'))
        }
        callbacks.onStream(acquired)
        recorder.start(300)
        callbacks.onState('recording')
      } catch (error) { if (!disposed && request === generation) fail(error) }
    },
    stop() {
      if (!recorder || recorder.state !== 'recording') return
      callbacks.onState('stopping')
      try { recorder.stop() } catch (error) { fail(error) }
    },
    cancelRequest() {
      generation++
      release()
      callbacks.onState('idle')
    },
    dispose() {
      disposed = true
      generation++
      failed = true
      if (recorder?.state === 'recording') { try { recorder.stop() } catch {} }
      release()
    },
  }
}

export function makeAsset(blob: Blob, name?: string): MediaAsset {
  return { id: uid(), blob, name: name || `试演-${Date.now()}.${blob.type.includes('mp4') ? 'mp4' : 'webm'}`, type: blob.type, size: blob.size, createdAt: timestamp() }
}

export async function validateVideo(file: Blob, name: string): Promise<void> {
  if (!file.size) throw new Error('这个视频是空文件，请重新选择。')
  if (!file.type.startsWith('video/') && !/\.(mp4|webm|mov|m4v)$/i.test(name)) throw new Error('请选择视频文件，例如 MP4、MOV 或 WebM。')
  await new Promise<void>((resolve, reject) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(file)
    let complete = false
    const finish = (error?: Error) => {
      if (complete) return
      complete = true
      clearTimeout(timeout)
      video.removeAttribute('src')
      video.load()
      URL.revokeObjectURL(url)
      if (error) reject(error)
      else resolve()
    }
    const timeout = window.setTimeout(() => finish(new Error('视频读取超时，请换用较小或兼容的 MP4 文件。')), 15000)
    video.preload = 'metadata'
    video.onloadedmetadata = () => finish(video.videoWidth ? undefined : new Error('没有读取到视频画面，请选择可播放的视频文件。'))
    video.onerror = () => finish(new Error('当前浏览器无法解码这个视频，请换用兼容的 MP4 文件。'))
    video.src = url
  })
}
