import { weakKeys } from './engine'
import type { Progress } from './types'

export interface ProgressExport {
  commitMessage: string
  committedAt: string
  progress: Progress
  results: {
    attemptCount: number
    averageAccuracy: number
    bestWpm: number
    weakKeys: [string, number][]
  }
}

export const commitFileName = (message: string) => {
  const safeMessage = message.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/\s+/g, '-')
  return `${safeMessage || 'progress-export'}.json`
}

export const createProgressExport = (commitMessage: string, progress: Progress, committedAt = new Date().toISOString()): ProgressExport => ({
  commitMessage: commitMessage.trim(),
  committedAt,
  progress,
  results: {
    attemptCount: progress.attempts.length,
    averageAccuracy: progress.attempts.length
      ? Math.round(progress.attempts.reduce((sum, attempt) => sum + attempt.accuracy, 0) / progress.attempts.length)
      : 0,
    bestWpm: progress.attempts.length ? Math.max(...progress.attempts.map(attempt => attempt.wpm)) : 0,
    weakKeys: weakKeys(progress.attempts),
  },
})

export const downloadProgressExport = (commitMessage: string, progress: Progress) => {
  const payload = createProgressExport(commitMessage, progress)
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = commitFileName(commitMessage)
  link.click()
  URL.revokeObjectURL(url)
}
