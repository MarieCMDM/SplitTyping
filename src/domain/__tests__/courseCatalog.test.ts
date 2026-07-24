import { describe, expect, it, vi } from 'vitest'
import { loadCourseCatalog } from '../courseCatalog'

const course = (overrides: Record<string, unknown> = {}) => ({
  version: 1,
  id: 'foundations',
  title: 'Foundations',
  languages: ['us', 'uk', 'it'],
  format: 'markdown',
  lessons: [
    {
      id: 'fj-space',
      title: 'J, F, and Space',
      subtitle: 'Find the anchors',
      keys: ['f', 'j', ' '],
      items: ['fff', 'jjj', 'fjf'],
      hint: 'Return to the home row.',
    },
    {
      id: 'literal',
      title: 'Literal',
      subtitle: 'Exact text',
      keys: [],
      items: ['ignored'],
      text: 'exact  spacing',
    },
  ],
  ...overrides,
})

const fetcherFor = (responses: Record<string, unknown | { status: number }>) => vi.fn(async (input: RequestInfo | URL) => {
  const key = String(input)
  const value = responses[key]
  if (value && typeof value === 'object' && 'status' in value && typeof value.status === 'number') {
    return new Response('', { status: value.status })
  }
  return new Response(JSON.stringify(value), {
    status: value === undefined ? 404 : 200,
    headers: { 'Content-Type': 'application/json' },
  })
})

describe('runtime course catalog', () => {
  it('loads manifest order and normalizes lessons', async () => {
    const fetcher = fetcherFor({
      '/app/courses/manifest.json': { version: 1, courses: ['foundations.json', 'second.json'] },
      '/app/courses/foundations.json': course(),
      '/app/courses/second.json': course({ id: 'second', title: 'Second course', lessons: [{ id: 'one', title: 'One', subtitle: 'Next course', keys: [], items: ['next'] }] }),
    })

    const result = await loadCourseCatalog(fetcher, '/app/')

    expect(result.courses.map(item => item.id)).toEqual(['foundations', 'second'])
    expect(result.lessons.map(lesson => lesson.id)).toEqual(['foundations/fj-space', 'foundations/literal', 'second/one'])
    expect(result.lessons[0].text).toBe('fff jjj fjf')
    expect(result.lessons[0].hint).toBe('Return to the home row.')
    expect(result.lessons[1].text).toBe('exact  spacing')
    expect(result.errors).toEqual([])
  })

  it('skips invalid courses and reports every failure', async () => {
    const fetcher = fetcherFor({
      '/courses/manifest.json': { version: 1, courses: ['good.json', 'invalid.json', 'missing.json'] },
      '/courses/good.json': course(),
      '/courses/invalid.json': course({ id: 'Invalid id' }),
      '/courses/missing.json': { status: 404 },
    })

    const result = await loadCourseCatalog(fetcher, '/')

    expect(result.courses.map(item => item.id)).toEqual(['foundations'])
    expect(result.errors).toHaveLength(2)
    expect(result.errors[0]).toContain('invalid.json')
    expect(result.errors[1]).toContain('status 404')
  })

  it('rejects an invalid manifest without requesting courses', async () => {
    const fetcher = fetcherFor({
      '/courses/manifest.json': { version: 1, courses: ['../private.json'] },
    })

    const result = await loadCourseCatalog(fetcher, '/')

    expect(result.courses).toEqual([])
    expect(result.errors[0]).toContain('invalid course path')
    expect(fetcher).toHaveBeenCalledOnce()
  })
})
