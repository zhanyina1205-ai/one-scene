import { referencedMedia, type MediaAsset, type Workspace } from './domain'
import { demoWorkspace } from './seed'

const DATABASE_NAME = 'one-scene-private-v1'
let databasePromise: Promise<IDBDatabase> | undefined

export function openDatabase(): Promise<IDBDatabase> {
  if (!globalThis.indexedDB) return Promise.reject(new Error('当前浏览器无法使用本地数据库。请改用正常模式的 Safari、Chrome 或 Edge 打开，避免使用受限的内嵌预览。'))
  if (databasePromise) return databasePromise
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1)
    let settled = false
    request.onupgradeneeded = () => {
      request.result.createObjectStore('workspace')
      request.result.createObjectStore('media', { keyPath: 'id' })
    }
    request.onerror = () => { settled = true; databasePromise = undefined; reject(request.error) }
    request.onblocked = () => {
      settled = true
      databasePromise = undefined
      reject(new Error('另一个页面正在使用旧版数据库，请关闭同一工具的其他页面后重试。'))
    }
    request.onsuccess = () => {
      const database = request.result
      if (settled) { database.close(); return }
      database.onversionchange = () => { database.close(); databasePromise = undefined }
      resolve(database)
    }
  })
  return databasePromise
}

function readRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function readWorkspace(): Promise<Workspace> {
  const database = await openDatabase()
  const stored = await readRequest(database.transaction('workspace').objectStore('workspace').get('current')) as Workspace | undefined
  if (stored) {
    if (stored.schema !== 1 || !Array.isArray(stored.projects) || !Array.isArray(stored.scenes)) {
      throw new Error('本地数据格式无法识别。为保护原有内容，没有自动覆盖，请保留当前设备数据并联系维护者。')
    }
    return stored
  }
  const workspace = demoWorkspace()
  await writeWorkspace(workspace)
  return workspace
}

export async function readMedia(id: string): Promise<MediaAsset | undefined> {
  const database = await openDatabase()
  return readRequest(database.transaction('media').objectStore('media').get(id))
}

export async function writeWorkspace(workspace: Workspace, assets: MediaAsset[] = []): Promise<void> {
  const database = await openDatabase()
  const references = referencedMedia(workspace)
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['workspace', 'media'], 'readwrite')
    let operationError: unknown
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(operationError || transaction.error || new Error('保存被中断，原有数据没有改变，请重试。'))
    transaction.onerror = () => { if (!operationError) operationError = transaction.error }
    try {
      const media = transaction.objectStore('media')
      for (const asset of assets) media.put(asset)
      for (const id of references) {
        const request = media.getKey(id)
        request.onsuccess = () => {
          if (request.result === undefined) {
            operationError = new Error('没有找到记录所引用的视频，保存已取消。请重新导入片段。')
            transaction.abort()
          }
        }
      }
      const cursor = media.openKeyCursor()
      cursor.onsuccess = () => {
        const item = cursor.result
        if (!item) return
        if (!references.has(String(item.key))) media.delete(item.key)
        item.continue()
      }
      transaction.objectStore('workspace').put(workspace, 'current')
    } catch (error) {
      operationError = error
      transaction.abort()
    }
  })
}

export async function storageEstimate(): Promise<{ used: number; quota: number } | null> {
  if (!navigator.storage?.estimate) return null
  try {
    const result = await navigator.storage.estimate()
    return { used: result.usage || 0, quota: result.quota || 0 }
  } catch { return null }
}

export async function closeDatabase(): Promise<void> {
  if (databasePromise) (await databasePromise).close()
  databasePromise = undefined
}
