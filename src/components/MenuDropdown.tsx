import { useEffect, useRef } from 'react'

interface MenuItem {
  label: string
  shortcut?: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}

interface MenuDropdownProps {
  isOpen: boolean
  onClose: () => void
  items: MenuItem[]
  anchorRef: React.RefObject<HTMLButtonElement | null>
}

export default function MenuDropdown({ isOpen, onClose, items, anchorRef }: MenuDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null)
  const itemsRef = useRef<HTMLButtonElement[]>([])

  useEffect(() => {
    if (!isOpen) return

    const firstEnabledItem = itemsRef.current.find(item => !item.disabled)
    firstEnabledItem?.focus()
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      const enabledItems = itemsRef.current.filter(item => !item.disabled)
      if (!enabledItems.length) return

      const currentIndex = enabledItems.findIndex(item => item === document.activeElement)
      let nextIndex = currentIndex

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault()
          nextIndex = (currentIndex + 1) % enabledItems.length
          break
        case 'ArrowUp':
          event.preventDefault()
          nextIndex = (currentIndex - 1 + enabledItems.length) % enabledItems.length
          break
        case 'Escape':
          event.preventDefault()
          onClose()
          anchorRef.current?.focus()
          return
        case 'Enter':
        case ' ':
          event.preventDefault()
          ;(document.activeElement as HTMLButtonElement)?.click()
          return
        case 'Tab':
          onClose()
          return
      }

      if (nextIndex !== currentIndex) {
        enabledItems[nextIndex]?.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, anchorRef])

  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        if (anchorRef.current && !anchorRef.current.contains(event.target as Node)) {
          onClose()
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose, anchorRef])

  if (!isOpen || !items.length) return null

  const anchor = anchorRef.current?.getBoundingClientRect()

  return (
    <div
      ref={dropdownRef}
      className="menu-dropdown"
      role="menu"
      aria-orientation="vertical"
      style={{ top: anchor?.bottom ?? 0, left: anchor?.left ?? 0 }}
    >
      {items.map((item, index) => (
        <button
          key={index}
          type="button"
          ref={el => { itemsRef.current[index] = el! }}
          className={`menu-dropdown-item ${item.danger ? 'danger' : ''} ${item.disabled ? 'disabled' : ''}`}
          onClick={() => { if (!item.disabled) { item.onClick(); onClose() } }}
          disabled={item.disabled}
          role="menuitem"
          tabIndex={0}
        >
          <span>{item.label}</span>
          {item.shortcut && <span className="menu-dropdown-shortcut">{item.shortcut}</span>}
        </button>
      ))}
    </div>
  )
}
