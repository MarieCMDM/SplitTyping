import type { Progress } from './types'

export const defaultProgress: Progress = {
  version: 2,
  onboarded: false,
  settings: { keyboard: 'standard', layout: 'us', sound: false, showKeyboard: true },
  attempts: [],
  activeLessonId: null,
  lessonStartedAt: null,
}

const KEY = 'splittyping-progress-v2'

export function loadProgress(): Progress {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '') as Progress
    if (parsed.version !== 2 || !Array.isArray(parsed.attempts) || !parsed.settings) throw new Error('Invalid data')
    return parsed
  } catch { return defaultProgress }
}

export function saveProgress(progress: Progress) {
  localStorage.setItem(KEY, JSON.stringify(progress))
}

export function clearProgress() { localStorage.removeItem(KEY) }
