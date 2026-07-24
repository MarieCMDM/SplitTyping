import { useEffect, useMemo, useRef, useState } from 'react'
import { fingerNames } from '../../domain/data'
import { getKey } from '../../domain/keyboardCatalog'
import { calculateAccuracy, calculateWpm } from '../../domain/engine'
import Keyboard from '../../components/Keyboard'
import type { Attempt, Lesson, ResolvedKeyboard, Settings } from '../../domain/types'

interface Props { lesson: Lesson; settings: Settings; keyboard?: ResolvedKeyboard; onComplete:(attempt:Attempt)=>void; onExit:()=>void }

export default function Trainer({lesson,settings,keyboard,onComplete,onExit}:Props) {
  const [index,setIndex] = useState(0), [errors,setErrors] = useState(0), [wrong,setWrong] = useState('')
  const [keyErrors,setKeyErrors] = useState<Record<string,number>>({}), [started,setStarted] = useState<number|null>(null)
  const [finished,setFinished] = useState<Attempt|null>(null), box = useRef<HTMLDivElement>(null)
  const target = lesson.text[index] ?? ''
  const targetKey = getKey(target, keyboard)
  const chars = useMemo(()=>lesson.text.split(''),[lesson.text])
  useEffect(()=>box.current?.focus(),[])
  const handleKey = (e: React.KeyboardEvent) => {
    if (finished || e.ctrlKey || e.altKey || e.metaKey || e.key==='Shift' || e.key==='CapsLock') return
    if (e.key==='Escape') { onExit(); return }
    e.preventDefault(); if (!started) setStarted(Date.now())
    if (e.key !== target) {
      setErrors(v=>v+1); setWrong(e.key); setKeyErrors(v=>({...v,[target]:(v[target]??0)+1}))
      if (settings.sound) { const ctx=new AudioContext(), o=ctx.createOscillator(); o.frequency.value=150; o.connect(ctx.destination); o.start(); o.stop(ctx.currentTime+.05) }
      return
    }
    setWrong('')
    if (index === lesson.text.length-1) {
      const durationMs = Math.max(1000, Date.now()-(started??Date.now()))
      const result:Attempt={lessonId:lesson.id,date:new Date().toISOString(),accuracy:calculateAccuracy(lesson.text.length,errors),wpm:calculateWpm(lesson.text.length,durationMs),errors,durationMs,keyErrors}
      setFinished(result); onComplete(result)
    } else setIndex(v=>v+1)
  }
  const repeat = () => { setIndex(0); setErrors(0); setWrong(''); setKeyErrors({}); setStarted(null); setFinished(null); setTimeout(()=>box.current?.focus()) }
  if (finished) return <main className="trainer result"><section className="result-card"><p className="eyebrow">Exercise complete</p><h1>{finished.accuracy>=95?'Beautifully accurate.':'Good practice.'}</h1><div className="big-stats"><div><b>{finished.accuracy}%</b><span>accuracy</span></div><div><b>{finished.wpm}</b><span>words / min</span></div><div><b>{finished.errors}</b><span>mistakes</span></div></div><p>{finished.accuracy>=95?'One accurate pass recorded. Repeat it once to unlock the next lesson.':'Aim for 95% accuracy. Slow down and let the right finger find the key.'}</p><div className="result-actions"><button onClick={repeat}>Repeat lesson</button><button className="primary" onClick={onExit}>Back to course →</button></div></section></main>
  const modifierHint = targetKey?.modifier !== 'none' ? `Hold ${targetKey?.modifier} then ` : ''
  return <main className="trainer" tabIndex={0} ref={box} onKeyDown={handleKey}>
    <header className="trainer-head"><button className="icon-btn" onClick={onExit}>← <span>Course</span></button><div><b>{lesson.title}</b><span>{lesson.subtitle}</span></div><span>{index} / {lesson.text.length}</span></header>
    <section className="typing-stage">
      <div className="progress-line"><i style={{width:`${index/lesson.text.length*100}%`}}/></div>
      <div className="copy" aria-label="Typing text">{chars.map((c,i)=><span key={i} className={i<index?'done':i===index?(wrong?'current error':'current'):''}>{c===' '?'·':c}</span>)}</div>
      <div className={`hint ${wrong?'error-text':''}`}>{wrong ? <>Not <kbd>{wrong===' '?'Space':wrong}</kbd> — try again</> : target===' ' ? <>Use either <b>thumb</b> for Space</> : targetKey ? <>{modifierHint ? <>Hold <b>{targetKey.modifier}</b> then </> : null}Use your <b>{targetKey.key.position.fingers.map(finger => fingerNames[finger]).join(' or ')}</b> on <kbd>{target}</kbd></> : <>Type <kbd>{target}</kbd></>}</div>
    </section>
    <Keyboard keyboard={keyboard} target={target} wrong={wrong} showKeys={settings.showKeyboard} showFingerHints={settings.showFingerHints}/><p className="focus-note">Keep your eyes on the screen · Esc to leave</p>
  </main>
}
