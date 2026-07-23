import { beforeEach, describe, expect, it } from 'vitest'
import { defaultProgress, loadProgress, saveProgress } from '../storage'

describe('local progress',()=>{
  beforeEach(()=>localStorage.clear())
  it('uses defaults for missing data',()=>expect(loadProgress()).toEqual(defaultProgress))
  it('round trips valid progress',()=>{const value={...defaultProgress,onboarded:true};saveProgress(value);expect(loadProgress().onboarded).toBe(true)})
  it('replaces corrupt data safely',()=>{localStorage.setItem('keyloom-progress-v1','bad');expect(loadProgress()).toEqual(defaultProgress)})
})
