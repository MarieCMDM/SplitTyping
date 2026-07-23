import { describe, expect, it } from 'vitest'
import { isCourseTypingTarget } from './typingFocus'

describe('course typing focus', () => {
  it('accepts events from the active editor surface', () => {
    const host = document.createElement('div')
    host.className = 'editor-host'
    const code = document.createElement('span')
    host.append(code)

    expect(isCourseTypingTarget(code)).toBe(true)
  })

  it('ignores events outside the active editor and in interactive controls', () => {
    const host = document.createElement('div')
    host.className = 'editor-host'
    const search = document.createElement('input')
    const button = document.createElement('button')
    host.append(search, button)

    expect(isCourseTypingTarget(search)).toBe(false)
    expect(isCourseTypingTarget(button)).toBe(false)
    expect(isCourseTypingTarget(document.createElement('div'))).toBe(false)
  })
})
