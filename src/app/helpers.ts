import { isUnlocked } from '../domain/engine'
import type { Attempt, Lesson, Progress } from '../domain/types'
import type { DocId, SearchResult, WorkspaceLayout } from './types'

export const LAYOUT_KEY = 'keyloom-workspace-layout-v2'
export const defaultWorkspaceLayout: WorkspaceLayout = { sidebarWidth: 357, panelHeight: 350 }

export function loadWorkspaceLayout(): WorkspaceLayout {
  try {
    const value = JSON.parse(localStorage.getItem(LAYOUT_KEY) ?? '') as Partial<WorkspaceLayout>
    return {
      sidebarWidth: Math.min(520, Math.max(220, Number(value.sidebarWidth) || defaultWorkspaceLayout.sidebarWidth)),
      panelHeight: Math.min(520, Math.max(140, Number(value.panelHeight) || defaultWorkspaceLayout.panelHeight)),
    }
  } catch { return defaultWorkspaceLayout }
}

export const initialDoc = (_onboarded: boolean): DocId => 'readme'

export const lessonFileName = (lesson: Lesson) => {
  const slug = lesson.localId.replace(/[^a-z0-9]+/gi, '_')
  const ext = lesson.format === 'java' ? 'java' : lesson.format === 'markdown' ? 'md' : 'ts'
  return `${slug}.${ext}`
}

export const lessonPath = (lesson: Lesson) => `src/lessons/${lesson.course}/${lessonFileName(lesson)}`
export const classNameForLesson = (lesson: Lesson) => lesson.title.replace(/[^a-z0-9]+/gi, '')

export const groupByCourse = (items: Lesson[]) => items.reduce<Record<string, Lesson[]>>((acc, lesson) => {
  acc[lesson.course] = [...(acc[lesson.course] ?? []), lesson]
  return acc
}, {})

export const activeChar = (text: string, index: number) => ({
  before: text.slice(0, index),
  current: text[index] ?? '',
  after: text.slice(index + 1),
})

export const restoredLessonId = (progress: Progress, lessons: Lesson[]) => progress.activeLessonId && lessons.some(lesson => lesson.id === progress.activeLessonId) ? progress.activeLessonId : null

export function canOpenLesson(lesson: Lesson, eligibleLessons: Lesson[], attempts: Attempt[]) {
  return canOpenLessonWithKeyboard(lesson, eligibleLessons, attempts, 'full')
}

export function canOpenLessonWithKeyboard(lesson: Lesson, eligibleLessons: Lesson[], attempts: Attempt[], keyboard: Progress['settings']['formFactor']) {
  const index = eligibleLessons.findIndex(item => item.id === lesson.id)
  if (index < 0) return false
  return isUnlocked(eligibleLessons, attempts, index, keyboard) || index === 0
}

export function buildSearchResults(items: Lesson[]): SearchResult[] {
  return [
    { id: 'readme', label: 'README.md', path: 'SplitTyping/README.md', preview: 'local typing workspace' },
    { id: 'progress', label: 'progress.json', path: 'SplitTyping/progress.json', preview: 'attempts, accuracy, weak keys' },
    { id: 'settings', label: 'settings.json', path: 'SplitTyping/.vscode/settings.json', preview: 'form factor, standard, language, feedback' },
    { id: 'settings-ui', label: 'Settings', path: 'SplitTyping/Settings', preview: 'Typing Trainer preferences' },
    ...items.map(lesson => ({ id: lesson.id, label: lessonFileName(lesson), path: lessonPath(lesson), preview: `${lesson.title} - ${lesson.text}` })),
  ]
}

export const fileExtension = (label: string) => label.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? ''

export function getBrowserName() {
  if (typeof navigator === 'undefined') return 'Browser: Version'
  const userAgent = navigator.userAgent
  const match = (pattern: RegExp, name: string) => `${name}: ${userAgent.match(pattern)?.[1] ?? 'Version'}`
  if (/Edg\//.test(userAgent)) return match(/Edg\/(\d+(?:\.\d+){0,3})/, 'Edge')
  if (/Firefox\//.test(userAgent)) return match(/Firefox\/(\d+(?:\.\d+){0,3})/, 'Firefox')
  if (/Chrome\//.test(userAgent)) return match(/Chrome\/(\d+(?:\.\d+){0,3})/, 'Chrome')
  if (/Safari\//.test(userAgent)) return match(/Version\/(\d+(?:\.\d+){0,3})/, 'Safari')
  return 'Browser: Version'
}
