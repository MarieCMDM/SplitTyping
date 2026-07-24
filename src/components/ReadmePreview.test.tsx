import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { defaultProgress } from '../domain/storage'
import type { Lesson } from '../domain/types'
import ReadmePreview from './ReadmePreview'

const nextLesson: Lesson = {
  id: 'foundations-1',
  course: 'foundations',
  title: 'Home row',
  subtitle: 'Start here',
  text: 'asdf',
  newKeys: ['a'],
  supported: ['standard', 'sofle'],
}

const markdown = `
# SplitTyping

| Setting | Current value |
| --- | --- |
| Keyboard | [Configured keyboard](#splittyping-keyboard) |
| Layout | [Configured layout](#splittyping-layout) |
| Attempts | [Recorded attempts](#splittyping-attempts) |
| Active lesson | [Current lesson](#splittyping-active-lesson) |

[Next lesson](#splittyping-next-lesson)

[Start workspace](#splittyping-start) · [Open lesson](#splittyping-open-lesson) · [Inspect progress](#splittyping-progress) · [Open settings](#splittyping-settings)
`

describe('README preview', () => {
  it('renders live workspace values from the Markdown links', () => {
    render(
      <ReadmePreview
        markdown={markdown}
        progress={{ ...defaultProgress, settings: { ...defaultProgress.settings, keyboard: 'sofle', layout: 'it' } }}
        next={nextLesson}
        activeLessonId={nextLesson.id}
        onOpenLesson={vi.fn()}
        onOpenProgress={vi.fn()}
        onOpenSettings={vi.fn()}
        onStart={vi.fn()}
      />
    )

    expect(screen.getByText('sofle').tagName).toBe('CODE')
    expect(screen.getByText('it').tagName).toBe('CODE')
    expect(screen.getByText('0').tagName).toBe('CODE')
    expect(screen.getByText(nextLesson.id).tagName).toBe('CODE')
    expect(screen.getByRole('button', { name: 'Foundations / foundations_1.java' })).toBeTruthy()
  })

  it('connects reserved README links to the existing app actions', () => {
    const onStart = vi.fn()
    const onOpenLesson = vi.fn()
    const onOpenProgress = vi.fn()
    const onOpenSettings = vi.fn()
    render(
      <ReadmePreview
        markdown={markdown}
        progress={defaultProgress}
        next={nextLesson}
        activeLessonId={null}
        onOpenLesson={onOpenLesson}
        onOpenProgress={onOpenProgress}
        onOpenSettings={onOpenSettings}
        onStart={onStart}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Start workspace' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open lesson' }))
    fireEvent.click(screen.getByRole('button', { name: 'Inspect progress' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open settings' }))

    expect(onStart).toHaveBeenCalledOnce()
    expect(onOpenLesson).toHaveBeenCalledWith(nextLesson.id)
    expect(onOpenProgress).toHaveBeenCalledOnce()
    expect(onOpenSettings).toHaveBeenCalledOnce()
  })
})
