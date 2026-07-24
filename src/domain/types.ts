export type FormFactor = 'full' | 'compact'
export type KeyboardPresetId = FormFactor
export type KeyboardKind = FormFactor | 'standard' | 'sofle'
export type PhysicalStandard = 'ansi' | 'iso'
export type KeyboardLanguage = string
export type Finger = 'LP' | 'LR' | 'LM' | 'LI' | 'LTH' | 'RTH' | 'RI' | 'RM' | 'RR' | 'RP'
export type CourseFormat = 'java' | 'typescript' | 'markdown'

export interface KeyboardPoint {
  x: number
  y: number
}

export interface KeyboardPosition {
  id: string
  x: number
  y: number
  width: number
  height: number
  rotation?: number
  rotationOriginX?: number
  rotationOriginY?: number
  polygon?: KeyboardPoint[]
  fingers: Finger[]
  home?: boolean
  cluster?: string
}

export interface KeyboardGeometryGroup {
  id: string
  positions: KeyboardPosition[]
}

export interface KeyboardLayer {
  id: string
  label: string
  bindings: Record<string, string>
}

export interface KeyboardVariant {
  id: string
  label: string
  width: number
  height: number
  groups: string[]
  formFactor?: FormFactor
  standard?: PhysicalStandard
}

export interface KeyboardModel {
  version: 1
  id: string
  label: string
  description: string
  configurableStandard: boolean
  groups: KeyboardGeometryGroup[]
  variants: KeyboardVariant[]
  layers: KeyboardLayer[]
  baseLayerId: string
}

export interface KeyboardLegend {
  base: string
  shift?: string
  altGr?: string
  label?: string
}

export interface KeyboardLanguageLayout {
  version: 1
  id: string
  label: string
  recommendedStandard: PhysicalStandard
  legends: Record<string, KeyboardLegend>
}

export interface KeyboardManifest {
  version: 1
  defaultKeyboardId: string
  defaultLanguageId: string
  keyboards: string[]
  languages: string[]
}

export interface KeyboardCatalog {
  keyboards: KeyboardModel[]
  languages: KeyboardLanguageLayout[]
  defaultKeyboardId: string
  defaultLanguageId: string
  errors: string[]
}

export interface ResolvedKeyboard {
  model: KeyboardModel
  variant: KeyboardVariant
  positions: KeyboardPosition[]
  layer: KeyboardLayer
  language: KeyboardLanguageLayout
}

export interface KeyDefinition {
  position: KeyboardPosition
  code: string
  legend: KeyboardLegend
}

export interface KeyboardPreset {
  id: KeyboardPresetId
  label: string
  description: string
  formFactor: FormFactor
}

export interface Lesson {
  id: string
  localId: string
  course: string
  courseTitle: string
  format: CourseFormat
  title: string
  subtitle: string
  text: string
  newKeys: string[]
  hint?: string
  languages: KeyboardLanguage[]
  formFactors: FormFactor[]
}

export interface CourseLessonDefinition {
  id: string
  title: string
  subtitle: string
  keys: string[]
  items?: string[]
  text?: string
  hint?: string
  languages?: KeyboardLanguage[]
  formFactors?: FormFactor[]
}

export interface CourseDefinition {
  version: 1
  id: string
  title: string
  languages: KeyboardLanguage[]
  format: CourseFormat
  lessons: CourseLessonDefinition[]
}

export interface CourseManifest {
  version: 1
  courses: string[]
}

export interface CourseCatalog {
  courses: CourseDefinition[]
  lessons: Lesson[]
  errors: string[]
}

export interface Attempt {
  lessonId: string
  date: string
  accuracy: number
  wpm: number
  errors: number
  durationMs: number
  keyErrors: Record<string, number>
}

export interface Settings {
  keyboardId: string
  keyboardVariantId: string
  formFactor: FormFactor
  standard: PhysicalStandard
  language: KeyboardLanguage
  sound: boolean
  showKeyboard: boolean
  showFingerHints: boolean
}

export interface Progress {
  version: 3
  onboarded: boolean
  settings: Settings
  attempts: Attempt[]
  activeLessonId: string | null
  lessonStartedAt: number | null
}
