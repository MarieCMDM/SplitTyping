import type { Attempt, KeyboardKind, Lesson } from './types'

export const calculateAccuracy = (correct: number, errors: number) => {
  const total = correct + errors
  return total ? Math.round((correct / total) * 100) : 100
}

export const calculateWpm = (characters: number, durationMs: number) =>
  durationMs > 0 ? Math.round((characters / 5) / (durationMs / 60000)) : 0

export const lessonPassed = (attempts: Attempt[], lessonId: string) =>
  attempts.filter(a => a.lessonId === lessonId && a.accuracy >= 95).length >= 2

export const isUnlocked = (lessons: Lesson[], attempts: Attempt[], lessonIndex: number, keyboard: KeyboardKind) => {
  const eligible = lessons.filter(l => l.supported.includes(keyboard))
  const lesson = eligible[lessonIndex]
  if (!lesson || lessonIndex === 0) return lessonIndex === 0
  return lessonPassed(attempts, eligible[lessonIndex - 1].id)
}

export const weakKeys = (attempts: Attempt[]) => {
  const totals: Record<string, number> = {}
  attempts.forEach(a => Object.entries(a.keyErrors).forEach(([key, count]) => { totals[key] = (totals[key] ?? 0) + count }))
  return Object.entries(totals).sort((a,b) => b[1] - a[1]).slice(0,5)
}
