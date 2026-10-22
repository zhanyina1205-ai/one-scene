import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { describeError, type MediaAsset, type Workspace } from './domain'
import { readWorkspace, writeWorkspace } from './db'

type Mutation = (workspace: Workspace) => Workspace
interface Store {
  data: Workspace
  mutate: (mutation: Mutation, assets?: MediaAsset[]) => Promise<void>
  notify: (message: string) => void
  saving: boolean
}

const Context = createContext<Store | null>(null)

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Workspace | null>(null)
  const [bootError, setBootError] = useState('')
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [saving, setSaving] = useState(false)
  const current = useRef<Workspace | null>(null)
  const queue = useRef<Promise<void>>(Promise.resolve())

  useEffect(() => {
    let mounted = true
    readWorkspace().then(workspace => {
      if (mounted) { current.current = workspace; setData(workspace) }
    }).catch(reason => { if (mounted) setBootError(describeError(reason)) })
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 4500)
    return () => clearTimeout(timer)
  }, [toast])

  const mutate = useCallback((mutation: Mutation, assets: MediaAsset[] = []) => {
    const task = queue.current.catch(() => {}).then(async () => {
      if (!current.current) throw new Error('本地数据尚未准备好。')
      setSaving(true)
      try {
        const next = mutation(current.current)
        await writeWorkspace(next, assets)
        current.current = next
        setData(next)
        setError('')
      } catch (reason) {
        setError(describeError(reason))
        throw reason
      } finally { setSaving(false) }
    })
    queue.current = task
    return task
  }, [])

  if (bootError) return <main className="boot-screen"><span className="brand-mark">一</span><h1>本地数据还没有打开</h1><p role="alert">{bootError}</p><button className="button primary" onClick={() => window.location.reload()}>重新打开</button><p className="hint">没有清空或覆盖原有内容。</p></main>
  if (!data) return <main className="boot-screen"><span className="brand-mark">一</span><p role="status">正在打开你的私人试演本…</p></main>
  return <Context.Provider value={{ data, mutate, notify: setToast, saving }}>
    {error && <div className="global-error" role="alert"><span>{error}</span><button aria-label="收起保存错误" onClick={() => setError('')}>×</button></div>}
    {children}
    {toast && <div className="toast" role="status">{toast}</div>}
  </Context.Provider>
}

export function useWorkspace() {
  const store = useContext(Context)
  if (!store) throw new Error('WorkspaceProvider is missing')
  return store
}
