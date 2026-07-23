import { useState, useRef, useEffect } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { getBrowserName } from '../app/helpers'
import type { ActivityView, DocId, SearchResult, WorkspaceLayout } from '../app/types'
import ActivityBar from './ActivityBar'
import MenuDropdown from './MenuDropdown'

interface MenuItem {
  label: string
  shortcut?: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}

interface Props {
  workspace: string
  command: string
  explorer: ReactNode
  tabs: ReactNode
  breadcrumbs: ReactNode
  editor: ReactNode
  panelTabs: ReactNode
  panel: ReactNode
  status: ReactNode
  onFullscreen: () => void
  layout: WorkspaceLayout
  onLayoutChange: (layout: WorkspaceLayout) => void
  onOpenSettings: () => void
  onClearResults: () => void
  onRunCurrent: () => void
  onRunNext: () => void
  onFocusTerminal: () => void
  onOpenDocumentation: () => void
  searchResults: SearchResult[]
  onSearchOpen: (id: DocId) => void
  onCloseBrowserTab: () => void
  activityView: ActivityView
  onActivityView: (view: ActivityView) => void
  onRunDebug: () => void
}

function MenuButton({
  label,
  isOpen,
  onToggle,
  items,
  anchorRef,
}: {
  label: string
  isOpen: boolean
  onToggle: () => void
  items: MenuItem[]
  anchorRef: React.RefObject<HTMLButtonElement | null>
}) {
  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className={`menu-button ${isOpen ? 'active' : ''}`}
        onClick={onToggle}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        {label}
      </button>
      <MenuDropdown isOpen={isOpen} onClose={onToggle} items={items} anchorRef={anchorRef} />
    </>
  )
}

export default function IdeFrame({
  workspace,
  command,
  explorer,
  tabs,
  breadcrumbs,
  editor,
  panelTabs,
  panel,
  status,
  onFullscreen,
  layout,
  onLayoutChange,
  onOpenSettings,
  onClearResults,
  onRunCurrent,
  onRunNext,
  onFocusTerminal,
  onOpenDocumentation,
  searchResults,
  onSearchOpen,
  onCloseBrowserTab,
  activityView,
  onActivityView,
  onRunDebug,
}: Props) {
  const [menus, setMenus] = useState<Record<string, boolean>>({
    file: false,
    edit: false,
    selection: false,
    view: false,
    go: false,
    run: false,
    terminal: false,
    help: false,
  })
  const [query, setQuery] = useState('')
  const [browserName] = useState(() => getBrowserName())

  const anchors = {
    file: useRef<HTMLButtonElement>(null),
    edit: useRef<HTMLButtonElement>(null),
    selection: useRef<HTMLButtonElement>(null),
    view: useRef<HTMLButtonElement>(null),
    go: useRef<HTMLButtonElement>(null),
    run: useRef<HTMLButtonElement>(null),
    terminal: useRef<HTMLButtonElement>(null),
    help: useRef<HTMLButtonElement>(null),
  }

  const closeAllMenus = () => {
    setMenus({
      file: false,
      edit: false,
      selection: false,
      view: false,
      go: false,
      run: false,
      terminal: false,
      help: false,
    })
  }

  const toggleMenu = (menu: string) => {
    setMenus(prev => {
      const next = { ...prev, [menu]: !prev[menu] }
      if (next[menu]) {
        Object.keys(next).forEach(key => {
          if (key !== menu) next[key as keyof typeof next] = false
        })
      }
      return next
    })
  }

  const handleItemClick = (onClick: () => void) => {
    closeAllMenus()
    onClick()
  }

  const fileItems: MenuItem[] = [
    { label: 'Settings', shortcut: 'Ctrl+,', onClick: () => handleItemClick(onOpenSettings) },
  ]

  const editItems: MenuItem[] = [
    { label: 'Clear Results', onClick: () => handleItemClick(onClearResults), danger: true },
  ]

  const selectionItems: MenuItem[] = []

  const viewItems: MenuItem[] = [
    { label: 'Toggle Fullscreen', shortcut: 'F11', onClick: () => handleItemClick(onFullscreen) },
  ]

  const goItems: MenuItem[] = []

  const runItems: MenuItem[] = [
    { label: 'Current Lesson', onClick: () => handleItemClick(onRunCurrent) },
    { label: 'Next Lesson', onClick: () => handleItemClick(onRunNext) },
  ]

  const terminalItems: MenuItem[] = [
    { label: 'Open Terminal', onClick: () => handleItemClick(onFocusTerminal) },
  ]

  const helpItems: MenuItem[] = [
    { label: 'Documentation', shortcut: 'F1', onClick: () => handleItemClick(onOpenDocumentation) },
  ]

  const matches = query.trim()
    ? searchResults.filter(result => `${result.label} ${result.path} ${result.preview}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8)
    : []

  const startResize = (axis: 'sidebar' | 'panel', event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const start = axis === 'sidebar' ? event.clientX : event.clientY
    const initial = axis === 'sidebar' ? layout.sidebarWidth : layout.panelHeight
    const move = (moveEvent: PointerEvent) => {
      const delta = axis === 'sidebar' ? moveEvent.clientX - start : start - moveEvent.clientY
      const value = Math.min(520, Math.max(axis === 'sidebar' ? 220 : 140, initial + delta))
      onLayoutChange(axis === 'sidebar' ? { ...layout, sidebarWidth: value } : { ...layout, panelHeight: value })
    }
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop, { once: true })
  }

  const focusEditor = (event: ReactPointerEvent<HTMLElement>) => {
    const target = event.target instanceof HTMLElement ? event.target : null
    if (target?.closest('input, textarea, select, button, [contenteditable="true"]')) return
    event.currentTarget.focus()
  }

  return (
    <main className="app-shell">
      <div className="menu-bar">
        <MenuButton label="File" isOpen={menus.file} onToggle={() => toggleMenu('file')} items={fileItems} anchorRef={anchors.file} />
        <MenuButton label="Edit" isOpen={menus.edit} onToggle={() => toggleMenu('edit')} items={editItems} anchorRef={anchors.edit} />
        <MenuButton label="Selection" isOpen={menus.selection} onToggle={() => toggleMenu('selection')} items={selectionItems} anchorRef={anchors.selection} />
        <MenuButton label="View" isOpen={menus.view} onToggle={() => toggleMenu('view')} items={viewItems} anchorRef={anchors.view} />
        <MenuButton label="Go" isOpen={menus.go} onToggle={() => toggleMenu('go')} items={goItems} anchorRef={anchors.go} />
        <MenuButton label="Run" isOpen={menus.run} onToggle={() => toggleMenu('run')} items={runItems} anchorRef={anchors.run} />
        <MenuButton label="Terminal" isOpen={menus.terminal} onToggle={() => toggleMenu('terminal')} items={terminalItems} anchorRef={anchors.terminal} />
        <MenuButton label="Help" isOpen={menus.help} onToggle={() => toggleMenu('help')} items={helpItems} anchorRef={anchors.help} />
        <div className="nav-arrows">
          <button type="button" aria-label="Back" title="Back"><span className="codicon codicon-arrow-left" /></button>
          <button type="button" aria-label="Forward" title="Forward"><span className="codicon codicon-arrow-right" /></button>
        </div>
        <div className="global-search">
          <span className="codicon codicon-search" />
          <input
            value={query}
            placeholder={`${workspace}: [${browserName}]`}
            aria-label="Search workspace"
            onChange={event => setQuery(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Escape') setQuery('')
              if (event.key === 'Enter' && matches[0]) {
                onSearchOpen(matches[0].id)
                setQuery('')
              }
            }}
          />
          {matches.length ? (
            <div className="search-results">
              {matches.map(result => (
                <button
                  key={result.id}
                  type="button"
                  onClick={() => { onSearchOpen(result.id); setQuery('') }}
                >
                  <span className="search-result-label">{result.label}</span>
                  <span className="search-result-path">{result.path}</span>
                  <small>{result.preview}</small>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="title-actions">
          <button type="button" aria-label="Maximize" title="Maximize" onClick={onFullscreen}><span className="codicon codicon-chrome-maximize" /></button>
          <button type="button" aria-label="Close browser tab" title="Close browser tab" onClick={onCloseBrowserTab}><span className="codicon codicon-chrome-close" /></button>
        </div>
      </div>
      <div className="command-bar" style={{ '--sidebar-width': `${layout.sidebarWidth}px`, '--panel-height': `${layout.panelHeight}px` } as CSSProperties}>
        <ActivityBar activeView={activityView} onViewChange={onActivityView} onRunDebug={onRunDebug} />
        <aside className="sidebar">{explorer}</aside>
        <div className="resize-handle sidebar-resize" role="separator" aria-label="Resize Explorer" onPointerDown={event => startResize('sidebar', event)} />
        <section className="main-area">
          {tabs}
          <div className="main-toolbar">
            <span className="crumbs">{breadcrumbs}</span>
            <span className="editor-location">{command}</span>
          </div>
          <div className="editor-host" tabIndex={-1} onPointerDown={focusEditor}>{editor}</div>
          <div className="resize-handle panel-resize" role="separator" aria-label="Resize panel" onPointerDown={event => startResize('panel', event)} />
          <section className="panel-shell">{panelTabs}{panel}</section>
        </section>
      </div>
      <div className="status-bar">{status}</div>
    </main>
  )
}
