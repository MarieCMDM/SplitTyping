import { beforeEach, describe, expect, it } from 'vitest'
import { defaultProgress, loadProgress, saveProgress } from '../storage'

describe('local progress',()=>{
  beforeEach(()=>localStorage.clear())
  it('uses defaults for missing data',()=>expect(loadProgress()).toEqual(defaultProgress))
  it('round trips valid progress',()=>{const value={...defaultProgress,onboarded:true};saveProgress(value);expect(loadProgress().onboarded).toBe(true)})
  it('replaces corrupt data safely',()=>{localStorage.setItem('splittyping-progress','bad');expect(loadProgress()).toEqual(defaultProgress)})
  it('deletes obsolete storage without migrating it',()=>{localStorage.setItem('splittyping-progress-v2',JSON.stringify({version:2}));expect(loadProgress()).toEqual(defaultProgress);expect(localStorage.getItem('splittyping-progress-v2')).toBeNull()})
  it('rejects older settings shapes instead of migrating them',()=>{localStorage.setItem('splittyping-progress',JSON.stringify({...defaultProgress,settings:{keyboard:'full',layout:'us',sound:false,showKeyboard:true}}));expect(loadProgress()).toEqual(defaultProgress)})
  it('requires the independent finger-hint setting',()=>{const {showFingerHints:_,...settings}=defaultProgress.settings;localStorage.setItem('splittyping-progress',JSON.stringify({...defaultProgress,settings}));expect(loadProgress()).toEqual(defaultProgress)})
})
