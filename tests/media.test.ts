import { describe, expect, it, vi } from 'vitest'
import { createCapture, recorderMime, type CaptureEnvironment } from '../src/media'
import { describeError } from '../src/domain'

function callbacks() { return { onState: vi.fn(), onStream: vi.fn(), onResult: vi.fn(), onError: vi.fn() } }
function fakeRecorder() {
  class Recorder {
    static isTypeSupported = (type: string) => type === 'video/mp4'
    state = 'inactive'
    mimeType = 'video/mp4'
    onstop?: () => void
    onerror?: () => void
    ondataavailable?: (event: { data: Blob }) => void
    start() { this.state = 'recording' }
    stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['recorded'], { type: 'video/mp4' }) }); this.onstop?.() }
  }
  return Recorder as unknown as typeof MediaRecorder
}

describe('主动摄录与降级', () => {
  it('初始化不请求摄像头，只有start才申请；停止后释放轨道并返回片段', async () => {
    const handlers = callbacks(); const stop = vi.fn()
    const getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] })
    const capture = createCapture(handlers, { secure: true, devices: { getUserMedia }, Recorder: fakeRecorder() })
    expect(getUserMedia).not.toHaveBeenCalled()
    await capture.start(); expect(getUserMedia).toHaveBeenCalledOnce()
    expect(handlers.onState).toHaveBeenLastCalledWith('recording')
    capture.stop(); expect(stop).toHaveBeenCalledOnce()
    expect(handlers.onState).toHaveBeenLastCalledWith('idle')
    expect(await (handlers.onResult.mock.calls[0][0] as Blob).text()).toBe('recorded')
  })
  it('HTTP或不支持摄录时明确引导导入，不请求权限', async () => {
    const handlers = callbacks(); const getUserMedia = vi.fn()
    await createCapture(handlers, { secure: false, devices: { getUserMedia }, Recorder: fakeRecorder() }).start()
    expect(getUserMedia).not.toHaveBeenCalled()
    expect(describeError(handlers.onError.mock.calls[0][0])).toContain('相册导入')
    const unsupported = callbacks()
    await createCapture(unsupported, { secure: true }).start()
    expect(describeError(unsupported.onError.mock.calls[0][0])).toContain('相册导入')
  })
  it('拒绝授权时回到idle，保留重新尝试和导入路径', async () => {
    const handlers = callbacks()
    const capture = createCapture(handlers, { secure: true, devices: { getUserMedia: vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError')) }, Recorder: fakeRecorder() })
    await capture.start()
    expect(handlers.onState).toHaveBeenLastCalledWith('idle')
    expect(describeError(handlers.onError.mock.calls[0][0])).toContain('从相册导入视频')
    expect(handlers.onResult).not.toHaveBeenCalled()
  })
  it('取消等待后，晚到的权限结果也立即关闭轨道', async () => {
    const handlers = callbacks(); const stop = vi.fn()
    let resolveMedia!: (value: MediaStream) => void
    const promise = new Promise<MediaStream>(resolve => { resolveMedia = resolve })
    const environment: CaptureEnvironment = { secure: true, devices: { getUserMedia: () => promise }, Recorder: fakeRecorder() }
    const capture = createCapture(handlers, environment)
    const starting = capture.start(); capture.cancelRequest()
    resolveMedia({ getTracks: () => [{ stop }] } as unknown as MediaStream)
    await starting; expect(stop).toHaveBeenCalledOnce(); expect(handlers.onResult).not.toHaveBeenCalled()
  })
  it('组件销毁停止摄像头，不产生幽灵录制', async () => {
    const handlers = callbacks(); const stop = vi.fn()
    const capture = createCapture(handlers, { secure: true, devices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] }) }, Recorder: fakeRecorder() })
    await capture.start(); capture.dispose()
    expect(stop).toHaveBeenCalled(); expect(handlers.onResult).not.toHaveBeenCalled()
  })
  it('只选择浏览器声明支持的容器格式', () => {
    expect(recorderMime(fakeRecorder())).toBe('video/mp4')
    expect(recorderMime({ isTypeSupported: () => false } as unknown as typeof MediaRecorder)).toBeUndefined()
    expect(recorderMime({} as unknown as typeof MediaRecorder)).toBeUndefined()
    expect(describeError(new DOMException('full', 'QuotaExceededError'))).toContain('内容没有保存')
  })
})
