import { useEffect, useRef, useState } from 'react'
import { Camera, Download, Square, Upload, RotateCcw, Trash2 } from 'lucide-react'
import { readMedia } from './db'
import { createCapture, makeAsset, validateVideo, type CaptureState } from './media'
import { describeError, type MediaAsset } from './domain'

function pauseOtherVideos(current: HTMLVideoElement) {
  for (const video of document.querySelectorAll('video')) if (video !== current) video.pause()
}

export function VideoPlayer({ mediaId, label }: { mediaId: string | null; label: string }) {
  const [asset, setAsset] = useState<MediaAsset | null>(null)
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    let live = true
    let objectUrl = ''
    setUrl(''); setAsset(null); setError('')
    if (mediaId) readMedia(mediaId).then(result => {
      if (!live) return
      if (!result) { setError('这个片段没有在当前设备中找到。'); return }
      setAsset(result)
      objectUrl = URL.createObjectURL(result.blob)
      setUrl(objectUrl)
    }).catch(reason => { if (live) setError(describeError(reason)) })
    return () => { live = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [mediaId])
  if (!mediaId) return null
  if (error && !url) return <p className="error-text" role="alert">{error}</p>
  if (!url) return <p className="hint" role="status">正在读取设备中的视频…</p>
  return <div className="player-wrap">
    <video controls playsInline preload="metadata" src={url} aria-label={label} onPlay={event => pauseOtherVideos(event.currentTarget)} onPlaying={event => pauseOtherVideos(event.currentTarget)} onError={() => setError('当前浏览器无法播放此片段，可下载原文件并换用兼容播放器。')} />
    {error && <p className="error-text" role="alert">{error}</p>}
    <a className="text-button download" href={url} download={asset?.name || '试演.mp4'}><Download size={15} />下载原片 · {((asset?.size || 0) / 1024 / 1024).toFixed(1)} MB</a>
  </div>
}

export function MediaPanel({ mediaId, take, onStore, onRemove, onBlock }: {
  mediaId: string | null
  take: string
  onStore: (asset: MediaAsset) => Promise<void>
  onRemove: () => Promise<void>
  onBlock: (blocked: boolean) => void
}) {
  const [captureState, setCaptureState] = useState<CaptureState>('idle')
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [pending, setPending] = useState<MediaAsset | null>(null)
  const [pendingUrl, setPendingUrl] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const liveVideo = useRef<HTMLVideoElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const handlers = useRef({ onStore, onBlock })
  handlers.current = { onStore, onBlock }
  const receiveRef = useRef<(asset: MediaAsset) => void>(() => {})
  const capture = useRef<ReturnType<typeof createCapture> | null>(null)
  if (!capture.current) capture.current = createCapture({
    onState: setCaptureState, onStream: setStream,
    onResult: blob => receiveRef.current(makeAsset(blob)),
    onError: reason => setError(describeError(reason)),
  })

  useEffect(() => {
    onBlock(captureState !== 'idle' || busy || pending !== null)
    return () => onBlock(false)
  }, [captureState, busy, pending, onBlock])
  useEffect(() => () => capture.current?.dispose(), [])
  useEffect(() => {
    if (liveVideo.current) liveVideo.current.srcObject = stream
  }, [stream])
  useEffect(() => {
    if (captureState !== 'recording') return
    const startedAt = Date.now()
    setSeconds(0)
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - startedAt) / 1000)), 500)
    return () => clearInterval(timer)
  }, [captureState])
  useEffect(() => {
    if (!pending) { setPendingUrl(''); return }
    const url = URL.createObjectURL(pending.blob)
    setPendingUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [pending])

  const persist = async (asset: MediaAsset) => {
    setBusy(true); setError('')
    try {
      await validateVideo(asset.blob, asset.name)
      await handlers.current.onStore(asset)
      setPending(null)
    } catch (reason) { setError(describeError(reason)) }
    finally { setBusy(false) }
  }
  receiveRef.current = asset => {
    setPending(asset)
    void persist(asset)
  }
  const importFile = (file: File | undefined) => {
    if (!file) return
    if (mediaId && !window.confirm('替换当前草稿的片段？已保存的历史处理不会被覆盖。')) return
    receiveRef.current(makeAsset(file, file.name))
  }
  const start = () => {
    if (mediaId && !window.confirm('重新录制将替换当前草稿片段，已保存的历史不受影响。是否继续？')) return
    setError('')
    void capture.current?.start()
  }
  const active = captureState !== 'idle'

  return <section className="media-panel" aria-label={`${take}版视频`}>
    {stream && <div className="live-preview"><video ref={liveVideo} autoPlay muted playsInline aria-label="摄像头预览" /><span className="recording-pill">● {String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</span></div>}
    {!stream && !pending && mediaId && <VideoPlayer mediaId={mediaId} label={`${take}版练习回放`} />}
    {!active && !mediaId && !pending && <div className="video-empty"><Camera size={27} strokeWidth={1.25} /><span>把这个想法，亲自试一遍</span><small>主动录制，或选入已经拍好的片段</small></div>}
    {pending && <div className="pending-media">
      {pendingUrl && <video controls playsInline preload="metadata" src={pendingUrl} aria-label="尚未保存的练习片段" onPlay={event => pauseOtherVideos(event.currentTarget)} />}
      <p className="hint">{busy ? '正在检查并保存到设备，请稍候…' : '这段片段尚未保存，仍保留在当前页面。'}</p>
      {!busy && <div className="button-row"><button className="button secondary" onClick={() => void persist(pending)}><RotateCcw size={16} />重试保存</button><a className="button secondary" href={pendingUrl} download={pending.name}><Download size={16} />先下载</a><button className="text-button danger" onClick={() => { if (window.confirm('放弃这段尚未保存的视频？')) { setPending(null); setError('') } }}>放弃片段</button></div>}
    </div>}
    <input ref={fileInput} className="visually-hidden" type="file" accept="video/*,.mov,.m4v,.mp4,.webm" aria-label={`导入${take}版练习视频`} onChange={event => { importFile(event.target.files?.[0]); event.target.value = '' }} />
    {captureState === 'requesting' ? <div className="button-row"><span className="hint" role="status">等待摄像头和麦克风授权…</span><button className="button secondary" onClick={() => capture.current?.cancelRequest()}>取消等待</button></div> : active ? <button className="button record-stop wide" disabled={captureState === 'stopping'} onClick={() => capture.current?.stop()}><Square size={15} fill="currentColor" />{captureState === 'stopping' ? '正在结束录制…' : '停止录制并保存'}</button> : !pending && <div className="button-row equal">
      <button className="button dark" disabled={busy} onClick={start}><Camera size={17} />{mediaId ? '重新录制' : '开始录制'}</button>
      <button className="button secondary" disabled={busy} onClick={() => fileInput.current?.click()}><Upload size={17} />相册导入</button>
    </div>}
    {mediaId && !active && !pending && <button className="text-button subtle" disabled={busy} onClick={async () => { if (window.confirm('移除当前草稿的片段？历史处理中的同一片段会保留。')) { setBusy(true); try { await onRemove() } catch (reason) { setError(describeError(reason)) } finally { setBusy(false) } } }}><Trash2 size={14} />移除草稿片段</button>}
    {error && <p className="error-text" role="alert">{error}</p>}
  </section>
}
