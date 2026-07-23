export type KeyboardKind = 'standard' | 'sofle'
export type LogicalLayout = 'us' | 'it'
export type Finger = 'LP' | 'LR' | 'LM' | 'LI' | 'RI' | 'RM' | 'RR' | 'RP' | 'TH'
export type Course = 'foundations' | 'english' | 'italian' | 'code'

export interface KeyDefinition {
  code: string
  us: string
  it: string
  finger: Finger
  width?: number
  home?: boolean
}

export interface Lesson {
  id: string
  course: Course
  title: string
  subtitle: string
  text: string
  newKeys: string[]
  supported: KeyboardKind[]
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
  keyboard: KeyboardKind
  layout: LogicalLayout
  sound: boolean
  showKeyboard: boolean
}

export interface Progress {
  version: 2
  onboarded: boolean
  settings: Settings
  attempts: Attempt[]
  activeLessonId: string | null
  lessonStartedAt: number | null
}
