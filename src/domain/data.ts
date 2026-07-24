import type {
  Finger,
  FormFactor,
  KeyboardKind,
  KeyboardLanguage,
  KeyboardPreset,
  KeyboardPresetId,
  Lesson,
  PhysicalStandard,
} from './types'

export const keyboardPresets: KeyboardPreset[] = [
  {
    id: 'full',
    label: 'Full',
    description: 'Full typing layout with navigation and arrow keys, without a number pad.',
    formFactor: 'full',
  },
  {
    id: 'compact',
    label: 'Compact',
    description: 'Compact typing layout with a reduced navigation cluster and arrow keys.',
    formFactor: 'compact',
  },
]

export const normalizeKeyboardPreset = (kind: KeyboardKind): KeyboardPresetId =>
  kind === 'compact' ? 'compact' : 'full'

export const getKeyboardPreset = (kind: KeyboardKind) =>
  keyboardPresets.find(preset => preset.id === normalizeKeyboardPreset(kind)) ?? keyboardPresets[0]

// Lesson availability is no longer tied to conventional keyboard sizes.
export const supportsKeyboard = (_lesson: Lesson, _kind: KeyboardKind) => true

export const standardForLanguage = (language: KeyboardLanguage): PhysicalStandard =>
  language === 'us' ? 'ansi' : 'iso'

export async function detectKeyboardPreset(): Promise<{
  formFactor: FormFactor
  standard: PhysicalStandard
  language: KeyboardLanguage
  available: boolean
}> {
  const browserLanguage = typeof navigator !== 'undefined' ? navigator.language.toLowerCase() : ''
  const language: KeyboardLanguage = browserLanguage.startsWith('it') ? 'it' : browserLanguage === 'en-gb' ? 'uk' : 'us'
  const keyboardApi = typeof navigator !== 'undefined'
    ? (navigator as Navigator & { keyboard?: { getLayoutMap?: () => Promise<Map<string, string>> } }).keyboard
    : undefined
  if (!keyboardApi?.getLayoutMap) {
    return { formFactor: 'full', standard: standardForLanguage(language), language, available: false }
  }

  try {
    const layoutMap = await keyboardApi.getLayoutMap()
    const codes = new Set(layoutMap.keys())
    return {
      formFactor: codes.has('Numpad0') ? 'full' : 'compact',
      standard: codes.has('IntlBackslash') ? 'iso' : 'ansi',
      language,
      available: true,
    }
  } catch {
    return { formFactor: 'full', standard: standardForLanguage(language), language, available: false }
  }
}

export const fingerNames: Record<Finger, string> = {
  LP: 'Left pinky',
  LR: 'Left ring',
  LM: 'Left middle',
  LI: 'Left index',
  LTH: 'Left thumb',
  RTH: 'Right thumb',
  RI: 'Right index',
  RM: 'Right middle',
  RR: 'Right ring',
  RP: 'Right pinky',
}
