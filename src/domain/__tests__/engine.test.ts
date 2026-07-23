import { describe, expect, it } from 'vitest'
import { calculateAccuracy, calculateWpm, isUnlocked, lessonPassed, weakKeys } from '../engine'
import { lessons } from '../data'
import type { Attempt } from '../types'

const attempt=(lessonId:string,accuracy=95,keyErrors:Record<string,number>={}):Attempt=>({lessonId,accuracy,wpm:20,errors:0,durationMs:1000,keyErrors,date:new Date().toISOString()})

describe('typing metrics',()=>{
  it('calculates accuracy from correct and wrong presses',()=>expect(calculateAccuracy(95,5)).toBe(95))
  it('calculates standard five-character WPM',()=>expect(calculateWpm(50,60000)).toBe(10))
})
describe('course progression',()=>{
  it('requires two accurate attempts',()=>{expect(lessonPassed([attempt('fj')],'fj')).toBe(false);expect(lessonPassed([attempt('fj'),attempt('fj')],'fj')).toBe(true)})
  it('unlocks the first lesson and gates the second',()=>{expect(isUnlocked(lessons,[],0,'standard')).toBe(true);expect(isUnlocked(lessons,[],1,'standard')).toBe(false);expect(isUnlocked(lessons,[attempt('fj'),attempt('fj')],1,'standard')).toBe(true)})
  it('ranks weak keys by error count',()=>expect(weakKeys([attempt('fj',95,{f:1,j:3})])[0]).toEqual(['j',3]))
})
