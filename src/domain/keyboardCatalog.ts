import type {
  Finger,
  KeyboardCatalog,
  KeyboardLanguageLayout,
  KeyboardLayer,
  KeyboardLegend,
  KeyboardManifest,
  KeyboardModel,
  KeyboardPoint,
  KeyboardPosition,
  KeyboardVariant,
  KeyDefinition,
  Progress,
  ResolvedKeyboard,
} from './types'

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const fingers: Finger[] = ['LP', 'LR', 'LM', 'LI', 'LTH', 'RTH', 'RI', 'RM', 'RR', 'RP']

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === 'string')

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

function parsePathList(value: unknown, label: string) {
  if (!isStringArray(value) || !value.length) throw new Error(`${label} must be a non-empty array`)
  const invalid = value.find(path =>
    !/^[a-z0-9][a-z0-9._/-]*\.json$/i.test(path) || path.includes('..') || path.startsWith('/')
  )
  if (invalid) throw new Error(`${label} contains invalid path "${invalid}"`)
  if (new Set(value).size !== value.length) throw new Error(`${label} contains duplicate paths`)
  return value
}

function parseManifest(value: unknown): KeyboardManifest {
  if (!isRecord(value) || value.version !== 1) throw new Error('manifest must have version 1')
  if (typeof value.defaultKeyboardId !== 'string' || !idPattern.test(value.defaultKeyboardId)) {
    throw new Error('manifest has an invalid default keyboard id')
  }
  if (typeof value.defaultLanguageId !== 'string' || !idPattern.test(value.defaultLanguageId)) {
    throw new Error('manifest has an invalid default language id')
  }
  return {
    version: 1,
    defaultKeyboardId: value.defaultKeyboardId,
    defaultLanguageId: value.defaultLanguageId,
    keyboards: parsePathList(value.keyboards, 'keyboards'),
    languages: parsePathList(value.languages, 'languages'),
  }
}

function parsePoint(value: unknown, label: string): KeyboardPoint {
  if (!isRecord(value) || !isFiniteNumber(value.x) || !isFiniteNumber(value.y)) {
    throw new Error(`${label} must contain finite x and y coordinates`)
  }
  return { x: value.x, y: value.y }
}

function parsePosition(value: unknown, label: string): KeyboardPosition {
  if (!isRecord(value)) throw new Error(`${label} must be an object`)
  if (typeof value.id !== 'string' || !idPattern.test(value.id)) throw new Error(`${label} has an invalid id`)
  if (!isFiniteNumber(value.x) || !isFiniteNumber(value.y)) throw new Error(`${label} requires finite x and y`)
  if (!isFiniteNumber(value.width) || value.width <= 0 || !isFiniteNumber(value.height) || value.height <= 0) {
    throw new Error(`${label} requires positive width and height`)
  }
  if (!Array.isArray(value.fingers) || !value.fingers.length || !value.fingers.every(finger => fingers.includes(finger as Finger))) {
    throw new Error(`${label} has invalid suggested fingers`)
  }
  if (value.rotation !== undefined && !isFiniteNumber(value.rotation)) throw new Error(`${label} has an invalid rotation`)
  if (value.rotationOriginX !== undefined && !isFiniteNumber(value.rotationOriginX)) throw new Error(`${label} has an invalid rotation origin`)
  if (value.rotationOriginY !== undefined && !isFiniteNumber(value.rotationOriginY)) throw new Error(`${label} has an invalid rotation origin`)
  if (value.cluster !== undefined && typeof value.cluster !== 'string') throw new Error(`${label} has an invalid cluster`)
  let polygon: KeyboardPoint[] | undefined
  if (value.polygon !== undefined) {
    if (!Array.isArray(value.polygon) || value.polygon.length < 3) throw new Error(`${label} polygon requires at least three points`)
    polygon = value.polygon.map((point, index) => parsePoint(point, `${label} polygon point ${index + 1}`))
  }
  return {
    id: value.id,
    x: value.x,
    y: value.y,
    width: value.width,
    height: value.height,
    fingers: value.fingers as Finger[],
    home: value.home === true,
    cluster: value.cluster as string | undefined,
    rotation: value.rotation as number | undefined,
    rotationOriginX: value.rotationOriginX as number | undefined,
    rotationOriginY: value.rotationOriginY as number | undefined,
    polygon,
  }
}

function parseLayer(value: unknown, modelId: string, index: number): KeyboardLayer {
  const label = `${modelId} layer ${index + 1}`
  if (!isRecord(value) || typeof value.id !== 'string' || !idPattern.test(value.id)) throw new Error(`${label} has an invalid id`)
  if (typeof value.label !== 'string' || !value.label.trim()) throw new Error(`${label} requires a label`)
  if (!isRecord(value.bindings)) throw new Error(`${label} requires bindings`)
  const bindings: Record<string, string> = {}
  for (const [positionId, code] of Object.entries(value.bindings)) {
    if (!idPattern.test(positionId) || typeof code !== 'string' || !code.trim()) throw new Error(`${label} has an invalid binding`)
    bindings[positionId] = code
  }
  return { id: value.id, label: value.label.trim(), bindings }
}

function parseVariant(value: unknown, modelId: string, index: number): KeyboardVariant {
  const label = `${modelId} variant ${index + 1}`
  if (!isRecord(value) || typeof value.id !== 'string' || !idPattern.test(value.id)) throw new Error(`${label} has an invalid id`)
  if (typeof value.label !== 'string' || !value.label.trim()) throw new Error(`${label} requires a label`)
  if (!isFiniteNumber(value.width) || value.width <= 0 || !isFiniteNumber(value.height) || value.height <= 0) {
    throw new Error(`${label} requires positive bounds`)
  }
  if (!isStringArray(value.groups) || !value.groups.length) throw new Error(`${label} requires geometry groups`)
  if (value.formFactor !== undefined && value.formFactor !== 'full' && value.formFactor !== 'compact') {
    throw new Error(`${label} has an invalid form factor`)
  }
  if (value.standard !== undefined && value.standard !== 'ansi' && value.standard !== 'iso') {
    throw new Error(`${label} has an invalid physical standard`)
  }
  return {
    id: value.id,
    label: value.label.trim(),
    width: value.width,
    height: value.height,
    groups: value.groups,
    formFactor: value.formFactor as KeyboardVariant['formFactor'],
    standard: value.standard as KeyboardVariant['standard'],
  }
}

function parseKeyboard(value: unknown): KeyboardModel {
  if (!isRecord(value) || value.version !== 1) throw new Error('keyboard must have version 1')
  if (typeof value.id !== 'string' || !idPattern.test(value.id)) throw new Error('keyboard has an invalid id')
  if (typeof value.label !== 'string' || !value.label.trim()) throw new Error(`${value.id} requires a label`)
  if (typeof value.description !== 'string' || !value.description.trim()) throw new Error(`${value.id} requires a description`)
  if (typeof value.configurableStandard !== 'boolean') throw new Error(`${value.id} requires configurableStandard`)
  if (!Array.isArray(value.groups) || !value.groups.length) throw new Error(`${value.id} requires geometry groups`)

  const positionIds = new Set<string>()
  const groups = value.groups.map((rawGroup, groupIndex) => {
    if (!isRecord(rawGroup) || typeof rawGroup.id !== 'string' || !idPattern.test(rawGroup.id)) {
      throw new Error(`${value.id} group ${groupIndex + 1} has an invalid id`)
    }
    if (!Array.isArray(rawGroup.positions) || !rawGroup.positions.length) throw new Error(`${value.id}/${rawGroup.id} requires positions`)
    const positions = rawGroup.positions.map((position, positionIndex) =>
      parsePosition(position, `${value.id}/${rawGroup.id} position ${positionIndex + 1}`)
    )
    const localIds = new Set<string>()
    positions.forEach(position => {
      if (localIds.has(position.id)) throw new Error(`${value.id}/${rawGroup.id} contains duplicate position "${position.id}"`)
      localIds.add(position.id)
      positionIds.add(position.id)
    })
    return { id: rawGroup.id, positions }
  })
  const groupIds = groups.map(group => group.id)
  if (new Set(groupIds).size !== groupIds.length) throw new Error(`${value.id} contains duplicate group ids`)

  if (!Array.isArray(value.variants) || !value.variants.length) throw new Error(`${value.id} requires variants`)
  const variants = value.variants.map((variant, index) => parseVariant(variant, value.id as string, index))
  if (new Set(variants.map(variant => variant.id)).size !== variants.length) throw new Error(`${value.id} contains duplicate variant ids`)
  variants.forEach(variant => {
    const variantPositionIds = new Set<string>()
    variant.groups.forEach(groupId => {
      const group = groups.find(item => item.id === groupId)
      if (!group) throw new Error(`${value.id}/${variant.id} references unknown group "${groupId}"`)
      group.positions.forEach(position => {
        if (variantPositionIds.has(position.id)) throw new Error(`${value.id}/${variant.id} repeats position "${position.id}"`)
        variantPositionIds.add(position.id)
      })
    })
  })

  if (!Array.isArray(value.layers) || !value.layers.length) throw new Error(`${value.id} requires layers`)
  const layers = value.layers.map((layer, index) => parseLayer(layer, value.id as string, index))
  if (new Set(layers.map(layer => layer.id)).size !== layers.length) throw new Error(`${value.id} contains duplicate layer ids`)
  if (typeof value.baseLayerId !== 'string' || !layers.some(layer => layer.id === value.baseLayerId)) {
    throw new Error(`${value.id} has an invalid base layer`)
  }
  layers.forEach(layer => Object.keys(layer.bindings).forEach(positionId => {
    if (!positionIds.has(positionId)) throw new Error(`${value.id}/${layer.id} binds unknown position "${positionId}"`)
  }))
  const baseLayer = layers.find(layer => layer.id === value.baseLayerId)!
  positionIds.forEach(positionId => {
    if (!baseLayer.bindings[positionId]) throw new Error(`${value.id} base layer is missing "${positionId}"`)
  })

  return {
    version: 1,
    id: value.id,
    label: value.label.trim(),
    description: value.description.trim(),
    configurableStandard: value.configurableStandard,
    groups,
    variants,
    layers,
    baseLayerId: value.baseLayerId,
  }
}

function parseLanguage(value: unknown): KeyboardLanguageLayout {
  if (!isRecord(value) || value.version !== 1) throw new Error('language layout must have version 1')
  if (typeof value.id !== 'string' || !idPattern.test(value.id)) throw new Error('language layout has an invalid id')
  if (typeof value.label !== 'string' || !value.label.trim()) throw new Error(`${value.id} requires a label`)
  if (value.recommendedStandard !== 'ansi' && value.recommendedStandard !== 'iso') {
    throw new Error(`${value.id} has an invalid recommended standard`)
  }
  if (!isRecord(value.legends) || !Object.keys(value.legends).length) throw new Error(`${value.id} requires legends`)
  const legends: Record<string, KeyboardLegend> = {}
  for (const [code, rawLegend] of Object.entries(value.legends)) {
    if (!isRecord(rawLegend) || typeof rawLegend.base !== 'string') throw new Error(`${value.id}/${code} requires a base legend`)
    for (const layer of ['shift', 'altGr', 'label'] as const) {
      if (rawLegend[layer] !== undefined && typeof rawLegend[layer] !== 'string') {
        throw new Error(`${value.id}/${code} has an invalid ${layer} legend`)
      }
    }
    legends[code] = {
      base: rawLegend.base,
      shift: rawLegend.shift as string | undefined,
      altGr: rawLegend.altGr as string | undefined,
      label: rawLegend.label as string | undefined,
    }
  }
  return {
    version: 1,
    id: value.id,
    label: value.label.trim(),
    recommendedStandard: value.recommendedStandard,
    legends,
  }
}

const joinAssetPath = (baseUrl: string, path: string) =>
  `${baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`}keyboards/${path}`

async function fetchJson(fetcher: Fetcher, url: string): Promise<unknown> {
  const response = await fetcher(url)
  if (!response.ok) throw new Error(`request failed with status ${response.status}`)
  return response.json() as Promise<unknown>
}

export async function loadKeyboardCatalog(
  fetcher: Fetcher = fetch,
  baseUrl = import.meta.env.BASE_URL,
): Promise<KeyboardCatalog> {
  let manifest: KeyboardManifest
  try {
    manifest = parseManifest(await fetchJson(fetcher, joinAssetPath(baseUrl, 'manifest.json')))
  } catch (error) {
    return {
      keyboards: [],
      languages: [],
      defaultKeyboardId: '',
      defaultLanguageId: '',
      errors: [`Keyboard manifest: ${error instanceof Error ? error.message : 'unknown error'}`],
    }
  }

  const keyboards: KeyboardModel[] = []
  const languages: KeyboardLanguageLayout[] = []
  const errors: string[] = []
  for (const path of manifest.keyboards) {
    try {
      const keyboard = parseKeyboard(await fetchJson(fetcher, joinAssetPath(baseUrl, path)))
      if (keyboards.some(item => item.id === keyboard.id)) throw new Error(`duplicate keyboard id "${keyboard.id}"`)
      keyboards.push(keyboard)
    } catch (error) {
      errors.push(`Keyboard ${path}: ${error instanceof Error ? error.message : 'unknown error'}`)
    }
  }
  for (const path of manifest.languages) {
    try {
      const language = parseLanguage(await fetchJson(fetcher, joinAssetPath(baseUrl, path)))
      if (languages.some(item => item.id === language.id)) throw new Error(`duplicate language id "${language.id}"`)
      languages.push(language)
    } catch (error) {
      errors.push(`Language ${path}: ${error instanceof Error ? error.message : 'unknown error'}`)
    }
  }
  if (!keyboards.some(item => item.id === manifest.defaultKeyboardId)) errors.push('Default keyboard is not available')
  if (!languages.some(item => item.id === manifest.defaultLanguageId)) errors.push('Default language is not available')
  return {
    keyboards,
    languages,
    defaultKeyboardId: manifest.defaultKeyboardId,
    defaultLanguageId: manifest.defaultLanguageId,
    errors,
  }
}

export function resolveKeyboard(catalog: KeyboardCatalog, settings: Progress['settings']): ResolvedKeyboard | undefined {
  const model = catalog.keyboards.find(item => item.id === settings.keyboardId)
    ?? catalog.keyboards.find(item => item.id === catalog.defaultKeyboardId)
    ?? catalog.keyboards[0]
  const language = catalog.languages.find(item => item.id === settings.language)
    ?? catalog.languages.find(item => item.id === catalog.defaultLanguageId)
    ?? catalog.languages[0]
  if (!model || !language) return undefined
  const configuredVariant = model.configurableStandard
    ? model.variants.find(item => item.formFactor === settings.formFactor && item.standard === settings.standard)
    : model.variants.find(item => item.id === settings.keyboardVariantId)
  const variant = configuredVariant ?? model.variants[0]
  const layer = model.layers.find(item => item.id === model.baseLayerId) ?? model.layers[0]
  const groupIds = new Set(variant.groups)
  const positions = model.groups.filter(group => groupIds.has(group.id)).flatMap(group => group.positions)
  return { model, variant, positions, layer, language }
}

export interface KeyResolution {
  key: KeyDefinition
  modifier: 'none' | 'Shift' | 'AltGr'
}

export function getKey(char: string, keyboard: ResolvedKeyboard | undefined): KeyResolution | undefined {
  if (!keyboard || !char) return undefined
  const target = char.toLocaleLowerCase()
  for (const position of keyboard.positions) {
    const code = keyboard.layer.bindings[position.id]
    const legend = keyboard.language.legends[code]
    if (!legend) continue
    if (legend.base === char || (!/^[a-z]$/i.test(legend.base) && legend.base.toLocaleLowerCase() === target)) {
      return { key: { position, code, legend }, modifier: 'none' }
    }
    const shift = legend.shift ?? (/^[a-z]$/i.test(legend.base) ? legend.base.toLocaleUpperCase() : undefined)
    if (shift?.toLocaleLowerCase() === target) return { key: { position, code, legend }, modifier: 'Shift' }
    if (legend.altGr?.toLocaleLowerCase() === target) return { key: { position, code, legend }, modifier: 'AltGr' }
  }
  return undefined
}

export const missingLessonCharacters = (text: string, keyboard: ResolvedKeyboard | undefined) =>
  [...new Set(Array.from(text))].filter(character => !getKey(character, keyboard))
