import { describe, expect, it } from 'vitest'
import { commitFileName, createProgressExport } from '../export'
import { defaultProgress } from '../storage'
import type { Attempt } from '../types'

describe('progress export', () => {
  it('includes progress and aggregate typing results', () => {
    const progress = {
      ...defaultProgress,
      attempts: [
        { lessonId: 'fj', date: '2026-01-01T00:00:00.000Z', accuracy: 95, wpm: 20, errors: 1, durationMs: 1000, keyErrors: { f: 2 } },
        { lessonId: 'fj', date: '2026-01-02T00:00:00.000Z', accuracy: 85, wpm: 30, errors: 2, durationMs: 1000, keyErrors: { f: 1, j: 3 } },
      ] as Attempt[],
    }

    const result = createProgressExport('  improve metrics  ', progress, '2026-01-03T00:00:00.000Z')

    expect(result.commitMessage).toBe('improve metrics')
    expect(result.committedAt).toBe('2026-01-03T00:00:00.000Z')
    expect(result.progress).toEqual(progress)
    expect(result.results).toEqual({
      attemptCount: 2,
      averageAccuracy: 90,
      bestWpm: 30,
      weakKeys: [['f', 3], ['j', 3]],
    })
  })

  it('creates safe readable filenames', () => {
    expect(commitFileName('Improve: typing / progress?')).toBe('Improve--typing---progress-.json')
    expect(commitFileName('   ')).toBe('progress-export.json')
  })
})
