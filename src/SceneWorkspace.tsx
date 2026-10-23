import { useCallback, useEffect, useRef } from 'react'
import type { Scene } from './domain'
import { Rehearsal, type PracticePlan } from './Rehearsal'
import { SceneCard } from './SceneCard'

type LeaveGuard = () => Promise<boolean>
export async function checkSceneGuards(guards: Array<LeaveGuard | null>): Promise<boolean> {
  for (const guard of guards) if (guard && !await guard()) return false
  return true
}

export function SceneWorkspace({ scene, role, plan, editScript, editScene, lab, registerGuard }: { scene: Scene; role: string; plan?: PracticePlan; editScript: () => void; editScene: () => void; lab: () => void; registerGuard: (guard: LeaveGuard | null) => void }) {
  const preparationRef = useRef<HTMLDivElement>(null)
  const practiceRef = useRef<HTMLElement>(null)
  const cardGuard = useRef<LeaveGuard | null>(null)
  const practiceGuard = useRef<LeaveGuard | null>(null)
  const registerCardGuard = useCallback((guard: LeaveGuard | null) => { cardGuard.current = guard }, [])
  const registerPracticeGuard = useCallback((guard: LeaveGuard | null) => { practiceGuard.current = guard }, [])
  useEffect(() => {
    registerGuard(() => checkSceneGuards([cardGuard.current, practiceGuard.current]))
    return () => registerGuard(null)
  }, [registerGuard])
  useEffect(() => { if (plan) practiceRef.current?.scrollIntoView({ block: 'start' }) }, [plan])
  const stop = () => window.dispatchEvent(new Event('one-scene-stop-reader'))
  const goPractice = () => { stop(); practiceRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' }) }
  const goPreparation = () => { stop(); preparationRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' }) }
  return <div className="scene-workspace" ref={preparationRef}>
    <div className="scene-flow-intro"><span className="eyebrow">ONE SCENE / CONTEXT TO CUE</span><p><strong>戏前卡 × 对词台</strong><br />同一场戏，看清处境，再接上台词。<br />可以直接开练，回看卡片时不丢本轮位置。</p><button className="button secondary wide" onClick={goPractice}>带着这张卡，直接去对词 ↓</button></div>
    <SceneCard scene={scene} onTry={goPractice} onEdit={editScene} registerGuard={registerCardGuard} practice={<section className="integrated-practice" ref={practiceRef} aria-label="本场对词台"><div className="integrated-practice-heading"><div><span className="eyebrow">FROM THIS MOMENT, INTO THESE LINES.</span><h2>带着处境，对这一场。</h2><span className="badge">同一场次 · {scene.version}</span></div><button className="text-button" onClick={goPreparation}>↑ 回看戏前卡，保留练习位置</button></div><Rehearsal scene={scene} role={role} plan={plan} edit={editScript} card={goPreparation} lab={lab} registerGuard={registerPracticeGuard} integrated /></section>} />
  </div>
}
