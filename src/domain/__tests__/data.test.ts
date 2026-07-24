import { describe, expect, it, vi } from 'vitest'
import normalJson from '../../../public/keyboards/normal.json'
import italianJson from '../../../public/keyboards/it.json'
import ukJson from '../../../public/keyboards/uk.json'
import usJson from '../../../public/keyboards/us.json'
import { detectKeyboardPreset, keyboardPresets } from '../data'
import { getKey, loadKeyboardCatalog, missingLessonCharacters, resolveKeyboard } from '../keyboardCatalog'
import { defaultProgress } from '../storage'

const assets: Record<string, unknown> = {
  '/keyboards/manifest.json': {
    version: 1,
    defaultKeyboardId: 'normal',
    defaultLanguageId: 'us',
    keyboards: ['normal.json'],
    languages: ['us.json', 'uk.json', 'it.json'],
  },
  '/keyboards/normal.json': normalJson,
  '/keyboards/us.json': usJson,
  '/keyboards/uk.json': ukJson,
  '/keyboards/it.json': italianJson,
}

const fetcher = vi.fn(async (input: RequestInfo | URL) => {
  const value = assets[String(input)]
  return new Response(JSON.stringify(value), {
    status: value === undefined ? 404 : 200,
    headers: { 'Content-Type': 'application/json' },
  })
})

const loadResolved = async (language: string, standard: 'ansi' | 'iso', formFactor: 'full' | 'compact' = 'full') => {
  const catalog = await loadKeyboardCatalog(fetcher, '/')
  return resolveKeyboard(catalog, {
    ...defaultProgress.settings,
    language,
    standard,
    formFactor,
    keyboardVariantId: `${formFactor}-${standard}`,
  })
}

describe('runtime keyboard catalog and character layers', () => {
  it('loads the manifest, models, variants, and language layouts', async () => {
    const catalog = await loadKeyboardCatalog(fetcher, '/')
    expect(catalog.errors).toEqual([])
    expect(catalog.keyboards.map(keyboard => keyboard.id)).toEqual(['normal'])
    expect(catalog.keyboards[0].variants.map(variant => variant.id)).toEqual([
      'full-ansi',
      'compact-ansi',
      'full-iso',
      'compact-iso',
    ])
    expect(catalog.languages.map(language => language.id)).toEqual(['us', 'uk', 'it'])
  })

  it('maps uppercase and Italian Shift and AltGr characters', async () => {
    const us = await loadResolved('us', 'ansi', 'compact')
    const italian = await loadResolved('it', 'iso')
    expect(getKey('A', us)?.modifier).toBe('Shift')
    expect(getKey(';', italian)?.key.code).toBe('Comma')
    expect(getKey(';', italian)?.modifier).toBe('Shift')
    expect(getKey('€', italian)?.key.code).toBe('KeyE')
    expect(getKey('€', italian)?.modifier).toBe('AltGr')
  })

  it('models UK ISO and Italian ISO positions', async () => {
    const uk = await loadResolved('uk', 'iso')
    const italian = await loadResolved('it', 'iso')
    expect(getKey('£', uk)?.key.code).toBe('Digit3')
    expect(getKey('#', uk)?.key.code).toBe('Backslash')
    expect(getKey('@', uk)?.key.code).toBe('Quote')
    expect(getKey('"', uk)?.key.code).toBe('Digit2')
    expect(getKey('\\', uk)?.key.code).toBe('IntlBackslash')
    expect(getKey('<', italian)?.key.code).toBe('IntlBackslash')
    expect(getKey('ù', italian)?.key.code).toBe('Backslash')
    expect(italian?.positions.find(position => position.id === 'enter')?.polygon).toHaveLength(6)
  })

  it('reports unresolved lesson characters without blocking resolution', async () => {
    const us = await loadResolved('us', 'ansi')
    expect(missingLessonCharacters('fj🙂', us)).toEqual(['🙂'])
  })

  it('keeps both normal form-factor controls and detects safe defaults', async () => {
    expect(keyboardPresets.map(preset => preset.label)).toEqual(['Full', 'Compact'])
    const detected = await detectKeyboardPreset()
    expect(detected.formFactor).toBe('full')
    expect(detected.standard).toBe('ansi')
    expect(detected.available).toBe(false)
  })

  it('rejects unsafe manifests', async () => {
    const invalidFetcher = vi.fn(async () => new Response(JSON.stringify({
      version: 1,
      defaultKeyboardId: 'normal',
      defaultLanguageId: 'us',
      keyboards: ['../normal.json'],
      languages: ['us.json'],
    })))
    const catalog = await loadKeyboardCatalog(invalidFetcher, '/')
    expect(catalog.keyboards).toEqual([])
    expect(catalog.errors[0]).toContain('invalid path')
    expect(invalidFetcher).toHaveBeenCalledOnce()
  })
})
