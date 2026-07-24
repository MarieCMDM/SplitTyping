import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import normalJson from '../../public/keyboards/normal.json'
import italianJson from '../../public/keyboards/it.json'
import ukJson from '../../public/keyboards/uk.json'
import usJson from '../../public/keyboards/us.json'
import type { KeyboardCatalog, KeyboardLanguageLayout, KeyboardModel } from '../domain/types'
import { defaultProgress } from '../domain/storage'
import { resolveKeyboard } from '../domain/keyboardCatalog'
import Keyboard from './Keyboard'

const catalog: KeyboardCatalog = {
  keyboards: [normalJson as unknown as KeyboardModel],
  languages: [usJson, ukJson, italianJson] as unknown as KeyboardLanguageLayout[],
  defaultKeyboardId: 'normal',
  defaultLanguageId: 'us',
  errors: [],
}

const keyboard = (language: string, standard: 'ansi' | 'iso', formFactor: 'full' | 'compact' = 'full') =>
  resolveKeyboard(catalog, {
    ...defaultProgress.settings,
    language,
    standard,
    formFactor,
    keyboardVariantId: `${formFactor}-${standard}`,
  })

describe('coordinate keyboard visualization', () => {
  it('renders ANSI geometry without the ISO key', () => {
    const { container } = render(<Keyboard keyboard={keyboard('us', 'ansi')} />)
    expect(container.querySelector('[data-code="IntlBackslash"]')).toBeNull()
    expect(container.querySelector('[data-code="Enter"] polygon')).toBeNull()
  })

  it('renders UK ISO polygon geometry and legends', () => {
    const { container } = render(<Keyboard keyboard={keyboard('uk', 'iso')} />)
    expect(container.querySelector('[data-code="IntlBackslash"]')).not.toBeNull()
    expect(container.querySelector('[data-code="Enter"] polygon')).not.toBeNull()
    expect(container.querySelector('[data-code="Backslash"] .key-main')?.textContent).toBe('#')
    expect(container.querySelector('[data-code="AltRight"] .key-main')?.textContent).toBe('altgr')
  })

  it('shows and highlights the Italian AltGr layer', () => {
    const { container } = render(<Keyboard keyboard={keyboard('it', 'iso', 'compact')} target="€" />)
    expect(container.querySelector('[data-code="KeyE"] .key-tertiary')?.textContent).toBe('€')
    expect(container.querySelector('[data-code="KeyE"]')?.classList.contains('active')).toBe(true)
    expect(container.querySelector('[data-code="AltRight"]')?.classList.contains('active')).toBe(true)
    expect(container.querySelector('[data-code="IntlBackslash"] .key-main')?.textContent).toBe('<')
    expect(container.querySelector('[data-code="Backslash"] .key-main')?.textContent).toBe('ù')
  })

  it('highlights Space and both thumbs', () => {
    const { container } = render(<Keyboard keyboard={keyboard('us', 'ansi')} target=" " showFingerHints />)
    expect(container.querySelector('[data-code="Space"]')?.classList.contains('active')).toBe(true)
    expect(container.querySelector('[data-finger="LTH"]')?.classList.contains('active')).toBe(true)
    expect(container.querySelector('[data-finger="RTH"]')?.classList.contains('active')).toBe(true)
  })

  it('derives key and opposite Shift finger hints', () => {
    const { container, rerender } = render(<Keyboard keyboard={keyboard('us', 'ansi')} target="f" showFingerHints />)
    expect(container.querySelector('[data-finger="LI"]')?.classList.contains('active')).toBe(true)
    rerender(<Keyboard keyboard={keyboard('us', 'ansi')} target="A" showFingerHints />)
    expect(container.querySelector('[data-finger="LP"]')?.classList.contains('active')).toBe(true)
    expect(container.querySelector('[data-finger="RP"]')?.classList.contains('active')).toBe(true)
  })

  it('can show finger hints independently from the keyboard overlay', () => {
    const { container } = render(<Keyboard keyboard={keyboard('it', 'iso')} target="€" showKeys={false} showFingerHints />)
    expect(container.querySelector('.keyboard-coordinate')).toBeNull()
    expect(container.querySelector('[data-finger="LM"]')?.classList.contains('active')).toBe(true)
    expect(container.querySelector('[data-finger="RTH"]')?.classList.contains('active')).toBe(true)
  })
})
