import type {
  CourseCatalog,
  CourseDefinition,
  CourseFormat,
  CourseLessonDefinition,
  CourseManifest,
  FormFactor,
  KeyboardLanguage,
  Lesson,
} from './types'

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

const formats: CourseFormat[] = ['java', 'typescript', 'markdown']
const formFactors: FormFactor[] = ['full', 'compact']
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === 'string')

const isEnumArray = <T extends string>(value: unknown, allowed: readonly T[]): value is T[] =>
  Array.isArray(value) && value.length > 0 && value.every(item => typeof item === 'string' && allowed.includes(item as T))

function parseManifest(value: unknown): CourseManifest {
  if (!isRecord(value) || value.version !== 1 || !isStringArray(value.courses) || !value.courses.length) {
    throw new Error('manifest must have version 1 and a non-empty courses array')
  }
  const invalidPath = value.courses.find(path =>
    !/^[a-z0-9][a-z0-9._/-]*\.json$/i.test(path) || path.includes('..') || path.startsWith('/')
  )
  if (invalidPath) throw new Error(`invalid course path "${invalidPath}"`)
  if (new Set(value.courses).size !== value.courses.length) throw new Error('manifest contains duplicate course paths')
  return { version: 1, courses: value.courses }
}

function parseLesson(value: unknown, courseId: string, index: number, languages: KeyboardLanguage[]): CourseLessonDefinition {
  const label = `${courseId} lesson ${index + 1}`
  if (!isRecord(value)) throw new Error(`${label} must be an object`)
  if (typeof value.id !== 'string' || !idPattern.test(value.id)) throw new Error(`${label} has an invalid id`)
  if (typeof value.title !== 'string' || !value.title.trim()) throw new Error(`${label} requires a title`)
  if (typeof value.subtitle !== 'string' || !value.subtitle.trim()) throw new Error(`${label} requires a subtitle`)
  if (!isStringArray(value.keys)) throw new Error(`${label} requires a keys array`)
  if (value.keys.some(key => Array.from(key).length !== 1) || new Set(value.keys).size !== value.keys.length) {
    throw new Error(`${label} keys must be unique single characters`)
  }
  if (value.items !== undefined && (!isStringArray(value.items) || !value.items.length || value.items.some(item => !item.length))) {
    throw new Error(`${label} items must be a non-empty string array`)
  }
  if (value.text !== undefined && (typeof value.text !== 'string' || !value.text.length)) {
    throw new Error(`${label} text must be a non-empty string`)
  }
  if (value.items === undefined && value.text === undefined) throw new Error(`${label} requires items or text`)
  if (value.hint !== undefined && typeof value.hint !== 'string') throw new Error(`${label} hint must be a string`)
  if (value.languages !== undefined && !isEnumArray(value.languages, languages)) throw new Error(`${label} has invalid languages`)
  if (value.formFactors !== undefined && !isEnumArray(value.formFactors, formFactors)) throw new Error(`${label} has invalid form factors`)

  return {
    id: value.id,
    title: value.title.trim(),
    subtitle: value.subtitle.trim(),
    keys: value.keys,
    items: value.items as string[] | undefined,
    text: value.text as string | undefined,
    hint: value.hint?.toString().trim() || undefined,
    languages: value.languages as KeyboardLanguage[] | undefined,
    formFactors: value.formFactors as FormFactor[] | undefined,
  }
}

function parseCourse(value: unknown, languages: KeyboardLanguage[]): CourseDefinition {
  if (!isRecord(value) || value.version !== 1) throw new Error('course must be an object with version 1')
  if (typeof value.id !== 'string' || !idPattern.test(value.id)) throw new Error('course has an invalid id')
  if (typeof value.title !== 'string' || !value.title.trim()) throw new Error(`${value.id} requires a title`)
  if (!isEnumArray(value.languages, languages)) throw new Error(`${value.id} has invalid languages`)
  if (typeof value.format !== 'string' || !formats.includes(value.format as CourseFormat)) throw new Error(`${value.id} has an invalid format`)
  if (!Array.isArray(value.lessons) || !value.lessons.length) throw new Error(`${value.id} requires at least one lesson`)

  const lessons = value.lessons.map((lesson, index) => parseLesson(lesson, value.id as string, index, languages))
  const lessonIds = lessons.map(lesson => lesson.id)
  if (new Set(lessonIds).size !== lessonIds.length) throw new Error(`${value.id} contains duplicate lesson ids`)

  return {
    version: 1,
    id: value.id,
    title: value.title.trim(),
    languages: value.languages as KeyboardLanguage[],
    format: value.format as CourseFormat,
    lessons,
  }
}

function toRuntimeLessons(course: CourseDefinition): Lesson[] {
  return course.lessons.map(lesson => ({
    id: `${course.id}/${lesson.id}`,
    localId: lesson.id,
    course: course.id,
    courseTitle: course.title,
    format: course.format,
    title: lesson.title,
    subtitle: lesson.subtitle,
    text: lesson.text ?? lesson.items?.join(' ') ?? '',
    newKeys: lesson.keys,
    hint: lesson.hint,
    languages: lesson.languages ?? course.languages,
    formFactors: lesson.formFactors ?? formFactors,
  }))
}

const joinAssetPath = (baseUrl: string, path: string) =>
  `${baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`}courses/${path}`

async function fetchJson(fetcher: Fetcher, url: string): Promise<unknown> {
  const response = await fetcher(url)
  if (!response.ok) throw new Error(`request failed with status ${response.status}`)
  return response.json() as Promise<unknown>
}

export async function loadCourseCatalog(
  fetcher: Fetcher = fetch,
  baseUrl = import.meta.env.BASE_URL,
  languages: KeyboardLanguage[] = ['us', 'uk', 'it'],
): Promise<CourseCatalog> {
  const manifestUrl = joinAssetPath(baseUrl, 'manifest.json')
  let manifest: CourseManifest
  try {
    manifest = parseManifest(await fetchJson(fetcher, manifestUrl))
  } catch (error) {
    return {
      courses: [],
      lessons: [],
      errors: [`Course manifest: ${error instanceof Error ? error.message : 'unknown error'}`],
    }
  }

  const courses: CourseDefinition[] = []
  const errors: string[] = []
  for (const path of manifest.courses) {
    try {
      const course = parseCourse(await fetchJson(fetcher, joinAssetPath(baseUrl, path)), languages)
      if (courses.some(item => item.id === course.id)) throw new Error(`duplicate course id "${course.id}"`)
      courses.push(course)
    } catch (error) {
      errors.push(`Course ${path}: ${error instanceof Error ? error.message : 'unknown error'}`)
    }
  }

  return {
    courses,
    lessons: courses.flatMap(toRuntimeLessons),
    errors,
  }
}
