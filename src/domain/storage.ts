import type { Progress } from './types'

export const defaultProgress: Progress = {
  version: 3,
  onboarded: false,
  settings: {
    keyboardId: 'normal',
    keyboardVariantId: 'full-ansi',
    formFactor: 'full',
    standard: 'ansi',
    language: 'us',
    sound: false,
    showKeyboard: true,
    showFingerHints: true,
  },
  attempts: [],
  activeLessonId: null,
  lessonStartedAt: null,
}

const KEY = 'splittyping-progress'
const OBSOLETE_KEYS = ['splittyping-progress-v2']

export function loadProgress(): Progress {
  OBSOLETE_KEYS.forEach(key => localStorage.removeItem(key))
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '') as Progress
    if (parsed.version !== 3 || !Array.isArray(parsed.attempts) || !parsed.settings) throw new Error('Invalid data')
    const { keyboardId, keyboardVariantId, formFactor, standard, language, sound, showKeyboard, showFingerHints } = parsed.settings
    if (typeof keyboardId !== 'string' || !keyboardId || typeof keyboardVariantId !== 'string' || !keyboardVariantId) {
      throw new Error('Invalid keyboard selection')
    }
    if (!['full', 'compact'].includes(formFactor)) throw new Error('Invalid form factor')
    if (!['ansi', 'iso'].includes(standard)) throw new Error('Invalid physical standard')
    if (!['us', 'uk', 'it'].includes(language)) throw new Error('Invalid keyboard language')
    if (typeof sound !== 'boolean' || typeof showKeyboard !== 'boolean' || typeof showFingerHints !== 'boolean') throw new Error('Invalid feedback settings')
    return parsed
  } catch { return defaultProgress }
}

export function saveProgress(progress: Progress) {
  localStorage.setItem(KEY, JSON.stringify(progress))
}

export function clearProgress() { localStorage.removeItem(KEY) }
