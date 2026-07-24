import { useState } from 'react'
import Keyboard from './Keyboard'
import { keyboardPresets } from '../domain/data'
import type { FormFactor, KeyboardLanguage, ResolvedKeyboard } from '../domain/types'

interface Props { keyboard: FormFactor; layout: KeyboardLanguage; resolvedKeyboard?: ResolvedKeyboard; onKeyboard:(v:FormFactor)=>void; onLayout:(v:KeyboardLanguage)=>void; onDone:()=>void }

export default function Onboarding({keyboard,layout,resolvedKeyboard,onKeyboard,onLayout,onDone}:Props) {
  const [step,setStep] = useState(0)
  const slides = [
    <><p className="eyebrow">Welcome to SplitTyping</p><h1>Learn the keys.<br/><em>Forget the keyboard.</em></h1><p className="lede">A calm, accuracy-first course for building real touch-typing muscle memory.</p></>,
    <><p className="eyebrow">Your anchors</p><h1>Feel for <kbd>F</kbd> and <kbd>J</kbd></h1><p className="lede">Place your index fingers on the two raised markers. Let the other fingers rest naturally on the home row. Your thumbs float over Space.</p><Keyboard keyboard={resolvedKeyboard} target="f"/></>,
    <><p className="eyebrow">Set up your course</p><h1>Choose your keyboard</h1><p className="lede">Choose a normal keyboard size. You can change the preset and character layout later.</p><div className="choices keyboard-preset-choices">{keyboardPresets.map(preset => <button key={preset.id} className={keyboard===preset.id?'selected':''} onClick={()=>onKeyboard(preset.id)}><b>{preset.label}</b><span>{preset.description}</span></button>)}</div><div className="segmented"><button className={layout==='us'?'on':''} onClick={()=>onLayout('us')}>US QWERTY</button><button className={layout==='it'?'on':''} onClick={()=>onLayout('it')}>Italian QWERTY</button></div></>
  ]
  return <main className="onboarding"><section className="onboard-card">{slides[step]}<footer><span>{step+1} / 3</span><button className="primary" onClick={()=>step<2?setStep(step+1):onDone()}>{step<2?'Continue':'Start training'} <b>→</b></button></footer></section></main>
}
