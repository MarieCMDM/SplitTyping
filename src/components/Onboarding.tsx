import { useState } from 'react'
import Keyboard from './Keyboard'
import type { KeyboardKind, LogicalLayout } from '../domain/types'

interface Props { keyboard: KeyboardKind; layout: LogicalLayout; onKeyboard:(v:KeyboardKind)=>void; onLayout:(v:LogicalLayout)=>void; onDone:()=>void }

export default function Onboarding({keyboard,layout,onKeyboard,onLayout,onDone}:Props) {
  const [step,setStep] = useState(0)
  const slides = [
    <><p className="eyebrow">Welcome to SplitTyping</p><h1>Learn the keys.<br/><em>Forget the keyboard.</em></h1><p className="lede">A calm, accuracy-first course for building real touch-typing muscle memory.</p></>,
    <><p className="eyebrow">Your anchors</p><h1>Feel for <kbd>F</kbd> and <kbd>J</kbd></h1><p className="lede">Place your index fingers on the two raised markers. Let the other fingers rest naturally on the home row. Your thumbs float over Space.</p><Keyboard kind={keyboard} layout={layout} target="f"/></>,
    <><p className="eyebrow">Set up your course</p><h1>Choose your keyboard</h1><p className="lede">You can change these later. Shape and character mapping are independent.</p><div className="choices"><button className={keyboard==='standard'?'selected':''} onClick={()=>onKeyboard('standard')}><b>Standard</b><span>Full curriculum</span></button><button className={keyboard==='sofle'?'selected':''} onClick={()=>onKeyboard('sofle')}><b>Sofle split</b><span>Guided letters</span></button></div><div className="segmented"><button className={layout==='us'?'on':''} onClick={()=>onLayout('us')}>US QWERTY</button><button className={layout==='it'?'on':''} onClick={()=>onLayout('it')}>Italian QWERTY</button></div></>
  ]
  return <main className="onboarding"><section className="onboard-card">{slides[step]}<footer><span>{step+1} / 3</span><button className="primary" onClick={()=>step<2?setStep(step+1):onDone()}>{step<2?'Continue':'Start training'} <b>→</b></button></footer></section></main>
}
