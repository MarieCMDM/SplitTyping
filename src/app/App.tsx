import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import Keyboard from '../components/Keyboard'
import { lessons } from '../domain/data'
import { calculateAccuracy, calculateWpm, isUnlocked, lessonPassed, weakKeys } from '../domain/engine'
import { commitFileName, downloadProgressExport } from '../domain/export'
import { clearProgress, loadProgress, saveProgress } from '../domain/storage'
import type { Attempt, Course, Lesson, Progress } from '../domain/types'
import SourceControl from '../features/source-control/SourceControl'
import IdeFrame from '../components/IdeFrame'
import { LAYOUT_KEY, activeChar, buildSearchResults, canOpenLesson, canOpenLessonWithKeyboard, classNameForLesson, courseNames, defaultWorkspaceLayout, fileExtension, getBrowserName, groupByCourse, initialDoc, lessonFileName, lessonPath, loadWorkspaceLayout, restoredLessonId } from './helpers'
import type { ActivityView, DocId, PanelId, SearchResult, WorkspaceLayout } from './types'
import { isCourseTypingTarget } from './typingFocus'

export default function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const [progress, setProgress] = useState<Progress>(() => loadProgress())
  const [selectedDoc, setSelectedDoc] = useState<DocId>(() => restoredLessonId(progress) ?? initialDoc(progress.onboarded))
  const [panel, setPanel] = useState<PanelId>(() => restoredLessonId(progress) ? 'keymap' : (progress.onboarded ? 'terminal' : 'keymap'))
  const [activeLessonId, setActiveLessonId] = useState<string | null>(() => restoredLessonId(progress))
  const [typingIndex, setTypingIndex] = useState(0)
  const [typingErrors, setTypingErrors] = useState(0)
  const [wrongKey, setWrongKey] = useState('')
  const [keyErrors, setKeyErrors] = useState<Record<string, number>>({})
  const [startedAt, setStartedAt] = useState<number | null>(() => progress.lessonStartedAt)
  const [finishedAttempt, setFinishedAttempt] = useState<Attempt | null>(null)
  const [recentOutput, setRecentOutput] = useState<string[]>([
    '[info] workspace ready',
    '[info] open a file in the explorer to begin',
  ])
  const [workspaceLayout, setWorkspaceLayout] = useState<WorkspaceLayout>(() => loadWorkspaceLayout())
  const [openTabs, setOpenTabs] = useState<DocId[]>(() => ['readme', ...(restoredLessonId(progress) ? [restoredLessonId(progress)!] : [])])
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem('keyloom-expanded-folders-v1') ?? '') as Record<string, boolean> }
    catch { return { root: true, vscode: true, src: true, lessons: true, foundations: true, english: true, italian: true, code: true } }
  })
  const [activityView, setActivityView] = useState<ActivityView>('explorer')
  const [commitMessage, setCommitMessage] = useState('')

  useEffect(() => {
    saveProgress(progress)
  }, [progress])

  useEffect(() => {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(workspaceLayout))
  }, [workspaceLayout])

  useEffect(() => {
    localStorage.setItem('keyloom-expanded-folders-v1', JSON.stringify(expandedFolders))
  }, [expandedFolders])

  const eligibleLessons = useMemo(() => {
    return lessons.filter(lesson =>
      lesson.supported.includes(progress.settings.keyboard) &&
      !(lesson.id === 'italian-2' && progress.settings.layout !== 'it')
    )
  }, [progress.settings.keyboard, progress.settings.layout])

  const activeLesson = useMemo(
    () => lessons.find(lesson => lesson.id === activeLessonId) ?? null,
    [activeLessonId]
  )

  const activeLessonIndex = useMemo(
    () => eligibleLessons.findIndex(lesson => lesson.id === activeLessonId),
    [activeLessonId, eligibleLessons]
  )

  const openDoc = (doc: DocId) => {
    setOpenTabs(tabs => tabs.includes(doc) ? tabs : [...tabs, doc])
    if (doc === 'progress') {
      setSelectedDoc(doc)
      setFinishedAttempt(null)
      setActiveLessonId(null)
      setPanel('output')
      resetTyping()
      return
    }
    if (doc === 'settings') {
      setSelectedDoc(doc)
      setFinishedAttempt(null)
      setActiveLessonId(null)
      setPanel('output')
      resetTyping()
      return
    }
    if (doc === 'settings-ui') {
      setSelectedDoc(doc)
      setFinishedAttempt(null)
      setActiveLessonId(null)
      setPanel('output')
      resetTyping()
      return
    }
    if (doc === 'readme' || doc === 'overview') {
      setSelectedDoc(doc)
      setFinishedAttempt(null)
      setActiveLessonId(null)
      setPanel('terminal')
      resetTyping()
      return
    }
    const lesson = lessons.find(item => item.id === doc) ?? null
    if (!lesson || !canOpenLessonWithKeyboard(lesson, eligibleLessons, progress.attempts, progress.settings.keyboard)) return
    setSelectedDoc(doc)
    setFinishedAttempt(null)
    setActiveLessonId(lesson.id)
    const lessonStart = Date.now()
    setProgress(current => ({ ...current, activeLessonId: lesson.id, lessonStartedAt: lessonStart }))
    setPanel('keymap')
    resetTyping()
  }

  const openNextLesson = () => {
    setActivityView('debug')
    const next = activeLesson
      ?? eligibleLessons.find((lesson, index) => isUnlocked(eligibleLessons, progress.attempts, index, progress.settings.keyboard) && !lessonPassed(progress.attempts, lesson.id))
      ?? eligibleLessons.find((lesson, index) => isUnlocked(eligibleLessons, progress.attempts, index, progress.settings.keyboard))
    if (next) openDoc(next.id)
  }

  const closeTab = (doc: DocId) => {
    setOpenTabs(tabs => {
      const next = tabs.filter(tab => tab !== doc)
      if (doc === selectedDoc) {
        const index = Math.max(0, tabs.indexOf(doc) - 1)
        const replacement = next[index] ?? next[0]
        if (replacement) openDoc(replacement)
      }
      return next
    })
  }

  const resetTyping = () => {
    setTypingIndex(0)
    setTypingErrors(0)
    setWrongKey('')
    setKeyErrors({})
    setStartedAt(null)
    setFinishedAttempt(null)
  }

  const updateSetting = <K extends keyof Progress['settings']>(key: K, value: Progress['settings'][K]) => {
    setProgress(current => ({
      ...current,
      settings: {
        ...current.settings,
        [key]: value,
      },
    }))
  }

  const restartLesson = () => {
    if (!activeLesson) return
    resetTyping()
    setPanel('keymap')
    setRecentOutput([
      `[run] restarting ${lessonPath(activeLesson)}`,
      '[run] cursor reset to line 5',
    ])
  }

  const exitLesson = () => {
    setActiveLessonId(null)
    setSelectedDoc('overview')
    resetTyping()
    setProgress(current => ({ ...current, activeLessonId: null, lessonStartedAt: null }))
    setPanel('terminal')
    setRecentOutput(['[info] returned to README.md'])
  }

  const resetAll = () => {
    clearProgress()
    const next = loadProgress()
    setProgress(next)
    setSelectedDoc(initialDoc(next.onboarded))
    setPanel(next.onboarded ? 'terminal' : 'keymap')
    setActiveLessonId(null)
    setStartedAt(null)
    resetTyping()
    setRecentOutput([
      '[info] progress cleared',
      '[info] workspace restored to defaults',
    ])
  }

  const startWorkspace = () => {
    setProgress(current => ({ ...current, onboarded: true }))
    setSelectedDoc('overview')
    setPanel('terminal')
  }

  const commitProgress = () => {
    const message = commitMessage.trim()
    if (!message) return
    downloadProgressExport(message, progress)
    setRecentOutput([
      `[git] exported progress as ${commitFileName(message)}`,
      `[git] committed ${progress.attempts.length} typing result${progress.attempts.length === 1 ? '' : 's'}`,
    ])
    setCommitMessage('')
  }

  useEffect(() => {
    if (!activeLesson) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (!isCourseTypingTarget(event.target)) return
      if (event.ctrlKey || event.altKey || event.metaKey) return
      if (event.key === 'Shift' || event.key === 'CapsLock' || event.key === 'Tab') return

      if (event.key === 'Escape') {
        event.preventDefault()
        exitLesson()
        return
      }

      if (finishedAttempt) return

      const target = activeLesson.text[typingIndex] ?? ''
      if (!target) return

      event.preventDefault()

      if (startedAt === null) {
        setStartedAt(Date.now())
      }

      if (event.key !== target) {
        setTypingErrors(count => count + 1)
        setWrongKey(event.key)
        setKeyErrors(errors => ({
          ...errors,
          [target]: (errors[target] ?? 0) + 1,
        }))
        if (progress.settings.sound) {
          void playTone()
        }
        return
      }

      setWrongKey('')

      if (typingIndex === activeLesson.text.length - 1) {
        const durationMs = Math.max(1000, Date.now() - (startedAt ?? Date.now()))
        const attempt: Attempt = {
          lessonId: activeLesson.id,
          date: new Date().toISOString(),
          accuracy: calculateAccuracy(activeLesson.text.length, typingErrors),
          wpm: calculateWpm(activeLesson.text.length, durationMs),
          errors: typingErrors,
          durationMs,
          keyErrors,
        }
        setFinishedAttempt(attempt)
        setTypingIndex(activeLesson.text.length)
        setPanel('terminal')
        setProgress(current => ({
          ...current,
          activeLessonId: null,
          lessonStartedAt: null,
          attempts: [...current.attempts, attempt].slice(-200),
        }))
        setRecentOutput([
          `[run] ${lessonFileName(activeLesson)} complete`,
          `[run] accuracy ${attempt.accuracy}%`,
          `[run] speed ${attempt.wpm} wpm`,
        ])
        return
      }

      setTypingIndex(index => index + 1)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeLesson, finishedAttempt, keyErrors, progress.settings.sound, startedAt, typingErrors, typingIndex])

  useEffect(() => {
    if (!activeLesson || finishedAttempt) return
    const passCount = progress.attempts.filter(attempt => attempt.lessonId === activeLesson.id && attempt.accuracy >= 95).length
    if (passCount >= 2) {
      setRecentOutput([
        `[info] ${lessonFileName(activeLesson)} unlocked`,
        '[info] next lesson is available in the explorer',
      ])
    }
  }, [activeLesson, finishedAttempt, progress.attempts])

  useEffect(() => {
    const handleReset = () => resetAll()
    window.addEventListener('keyloom-reset-progress', handleReset)
    return () => window.removeEventListener('keyloom-reset-progress', handleReset)
  }, [])

  const handleFullscreen = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
      return
    }
    await document.documentElement.requestFullscreen()
  }

  const handleRunCurrent = () => {
    if (activeLesson) {
      setPanel('keymap')
      requestAnimationFrame(() => document.querySelector<HTMLElement>('.editor-host')?.focus())
      return
    }
    openNextLesson()
    requestAnimationFrame(() => document.querySelector<HTMLElement>('.editor-host')?.focus())
  }

  const handleRunNext = () => {
    openNextLesson()
  }

  const handleFocusTerminal = () => {
    setPanel('terminal')
    setWorkspaceLayout(current => ({
      ...current,
      panelHeight: Math.max(current.panelHeight, defaultWorkspaceLayout.panelHeight),
    }))
  }

  const handleOpenDocumentation = () => {
    navigate('/documentation')
  }

  if (location.pathname === '/documentation') {
    return <DocumentationPage onBack={() => navigate('/')} />
  }

  const currentDoc = activeLesson
    ? lessonPath(activeLesson)
    : selectedDoc === 'progress'
      ? 'progress.json'
      : selectedDoc === 'settings'
        ? '.vscode/settings.json'
        : selectedDoc === 'settings-ui'
          ? 'Settings'
        : 'README.md'

  const editor = activeLesson
    ? renderLessonDoc({
        lesson: activeLesson,
        progress,
        typingIndex,
        typingErrors,
        wrongKey,
        finishedAttempt,
        onRepeat: restartLesson,
        onExit: exitLesson,
      })
    : selectedDoc === 'progress'
      ? renderProgressDoc({
          progress,
          onOpenSettings: () => openDoc('settings'),
          onReset: resetAll,
        })
      : selectedDoc === 'settings'
        ? renderSettingsDoc({
            progress,
            onSetting: updateSetting,
            onReset: resetAll,
          })
        : selectedDoc === 'settings-ui'
          ? renderSettingsUi({ progress, onSetting: updateSetting, onOpenJson: () => openDoc('settings'), onReset: resetAll })
        : renderOverviewDoc({
            progress,
            eligibleLessons,
            activeLessonId,
            onOpenLesson: openDoc,
            onOpenProgress: () => openDoc('progress'),
            onOpenSettings: () => openDoc('settings'),
            onStart: startWorkspace,
          })

  const panelTabs = renderPanelTabs(panel, setPanel)

  const panelBody = renderPanel({
    panel,
    activeLesson,
    activeLessonIndex,
    progress,
    typingIndex,
    typingErrors,
    wrongKey,
    startedAt,
    finishedAttempt,
    recentOutput,
  })

  const status = renderStatus({
    activeLesson,
    typingIndex,
    progress,
    selectedDoc: currentDoc,
    finishedAttempt,
  })

return (
    <IdeFrame
      workspace="SplitTyping"
      command={currentDoc}
      explorer={activityView === 'search' ? <SearchView /> : activityView === 'extensions' ? <ExtensionsView /> : activityView === 'source-control' ? <SourceControl activeLesson={activeLesson} progress={progress} commitMessage={commitMessage} onCommit={commitProgress} onCommitMessage={setCommitMessage} onOpenDoc={openDoc} /> : activityView === 'debug' ? renderDebugView({ activeLesson, progress, typingIndex, typingErrors, finishedAttempt, onOpenDoc: openDoc }) : renderExplorer({
        selectedDoc,
        activeLessonId,
        eligibleLessons,
        attempts: progress.attempts,
        keyboard: progress.settings.keyboard,
        onOpenDoc: openDoc,
        expandedFolders,
        onToggleFolder: folder => setExpandedFolders(current => ({ ...current, [folder]: !current[folder] })),
      })}
      tabs={renderTabs({
        selectedDoc,
        activeLesson,
        onOpenDoc: openDoc,
        openTabs,
        onCloseTab: closeTab,
      })}
      breadcrumbs={selectedDoc === 'progress' ? 'SplitTyping / progress.json' : selectedDoc === 'settings' ? 'SplitTyping / .vscode / settings.json' : selectedDoc === 'settings-ui' ? 'SplitTyping / Settings' : activeLesson ? `SplitTyping / src / lessons / ${activeLesson.course} / ${lessonFileName(activeLesson)}` : 'SplitTyping / README.md'}
      editor={editor}
      panelTabs={panelTabs}
      panel={panelBody}
      status={status}
      onFullscreen={handleFullscreen}
      layout={workspaceLayout}
      onLayoutChange={setWorkspaceLayout}
      onOpenSettings={() => openDoc('settings-ui')}
      onClearResults={resetAll}
      onRunCurrent={handleRunCurrent}
      onRunNext={handleRunNext}
      onFocusTerminal={handleFocusTerminal}
      onOpenDocumentation={handleOpenDocumentation}
      searchResults={buildSearchResults(lessons)}
      onSearchOpen={openDoc}
      onCloseBrowserTab={() => window.close()}
      activityView={activityView}
      onActivityView={setActivityView}
      onRunDebug={openNextLesson}
    />
  )
}

function FileIcon({ label }: { label: string }) {
  const extension = fileExtension(label)
  const iconLabel = extension === 'java' ? 'J' : extension === 'ts' ? 'TS' : extension === 'json' ? '{}' : extension === 'md' ? 'M' : extension === 'tsx' ? 'TSX' : ''
  return <span className={`file-icon file-icon-${extension || 'file'}`} aria-hidden="true">{iconLabel || <span className="codicon codicon-file" />}</span>
}

function renderTabs({
  selectedDoc,
  activeLesson,
  onOpenDoc,
  openTabs,
  onCloseTab,
}: {
  selectedDoc: DocId
  activeLesson: Lesson | null
  onOpenDoc: (doc: DocId) => void
  openTabs: DocId[]
  onCloseTab: (doc: DocId) => void
}) {
  const allTabs = [
    { id: 'readme', label: 'README.md', detail: 'welcome', active: selectedDoc === 'readme' || selectedDoc === 'overview' },
    ...(activeLesson ? [{ id: activeLesson.id, label: lessonFileName(activeLesson), detail: activeLesson.course, active: true }] : []),
    { id: 'progress', label: 'progress.json', detail: 'state', active: selectedDoc === 'progress' },
    { id: 'settings', label: '.vscode/settings.json', detail: 'settings', active: selectedDoc === 'settings' },
    { id: 'settings-ui', label: 'Settings', detail: 'preferences', active: selectedDoc === 'settings-ui' },
  ]
  const tabs = allTabs.filter(tab => openTabs.includes(tab.id) || tab.active)

  return (
    <div className="tab-strip">
      {tabs.map(tab => (
        <button key={tab.id} type="button" className={`tab ${tab.active ? 'active' : ''}`} onClick={() => onOpenDoc(tab.id)}>
          <FileIcon label={tab.label} />
          <span className="tab-label">{tab.label}</span>
          <span className="codicon codicon-close tab-close" role="button" aria-label={`Close ${tab.label}`} onClick={event => { event.stopPropagation(); onCloseTab(tab.id) }} />
        </button>
      ))}
    </div>
  )
}

function renderExplorer({
  selectedDoc,
  activeLessonId,
  eligibleLessons,
  attempts,
  keyboard,
  onOpenDoc,
  expandedFolders,
  onToggleFolder,
}: {
  selectedDoc: DocId
  activeLessonId: string | null
  eligibleLessons: Lesson[]
  attempts: Attempt[]
  keyboard: Progress['settings']['keyboard']
  onOpenDoc: (doc: DocId) => void
  expandedFolders: Record<string, boolean>
  onToggleFolder: (folder: string) => void
}) {
  const grouped = groupByCourse(lessons)
  return (
    <div className="explorer">
      <div className="explorer-head">
        <span>EXPLORER</span>
        <button type="button" className="ghost">...</button>
      </div>
      <div className="tree">
        <TreeNode label={`SPLITTYPING [${getBrowserName()}]`} level={0} folderKey="root" expanded={expandedFolders.root} onToggle={() => onToggleFolder('root')} active={selectedDoc === 'overview'} onClick={() => onOpenDoc('overview')} />
        {expandedFolders.root ? <>
        <TreeNode label="README.md" level={1} icon="file" active={selectedDoc === 'readme' || selectedDoc === 'overview'} onClick={() => onOpenDoc('readme')} />
        <TreeNode label="progress.json" level={1} icon="json" active={selectedDoc === 'progress'} onClick={() => onOpenDoc('progress')} />
        <TreeNode label=".vscode" level={1} folderKey="vscode" expanded={expandedFolders.vscode} onToggle={() => onToggleFolder('vscode')} active={selectedDoc === 'settings'} />
        {expandedFolders.vscode ? <TreeNode label="settings.json" level={2} icon="json" active={selectedDoc === 'settings'} onClick={() => onOpenDoc('settings')} /> : null}
        <TreeNode label="src" level={1} folderKey="src" expanded={expandedFolders.src} onToggle={() => onToggleFolder('src')} />
        {expandedFolders.src ? <TreeNode label="lessons" level={2} folderKey="lessons" expanded={expandedFolders.lessons} onToggle={() => onToggleFolder('lessons')} /> : null}
        {expandedFolders.src && expandedFolders.lessons ? Object.entries(grouped).map(([course, items]) => (
          <div key={course} className="tree-group">
            <TreeNode label={courseNames[course as Course]} level={3} folderKey={course} expanded={expandedFolders[course]} onToggle={() => onToggleFolder(course)} />
            {expandedFolders[course] ? items.map(lesson => {
              const unlocked = canOpenLessonWithKeyboard(lesson, eligibleLessons, attempts, keyboard)
              const passed = lessonPassed(attempts, lesson.id)
              return (
                <TreeNode
                  key={lesson.id}
                  label={lessonFileName(lesson)}
                  level={4}
                  icon="file"
                  active={activeLessonId === lesson.id}
                  locked={!unlocked}
                  passed={passed}
                  onClick={() => unlocked && onOpenDoc(lesson.id)}
                />
              )
            }) : null}
          </div>
        )) : null}
        </> : null}
      </div>
    </div>
  )
}

type DummySearchFile = {
  file: string
  path: string
  count: number
  lines: string[]
}

const dummySearchFiles: DummySearchFile[] = [
  {
    file: 'manifest.json',
    path: 'graphify-out',
    count: 28,
    lines: [
      '"ast_hash": "f1aaa35ee62a464afabc2493d6e4faec",',
      '"ast_hash": "a513d8b2aaa17421fcfa64676b0f8029",',
      '...67ae659004d6d53d638b9a9186af7aaa",',
      '"ast_hash": "e94aaa0ad90e46017ee41c92a923c3b2",',
      '"ast_hash": "922aaa8f2c491f14bf1e9a955b10ce73",',
      '"ast_hash": "f1aaa35ee62a464afabc2493d6e4faec",',
      '...0c1823b458418f82ebb6ec66c1daaa3",',
      '"ast_hash": "49e71165ae0e89aaac9758f26e606516",',
      '"ast_hash": "617ae7cdeec3b960608daa1e76e1d109",',
      '"ast_hash": "1d3facfe30eaaa00ec9b2d14674513b3",',
    ],
  },
  {
    file: 'stat-index.json',
    path: 'graphify-out/cache',
    count: 21,
    lines: [
      '"hash": "a64d62afef3115916325daaa8fa91712417e7",',
      '"hash": "52e76811cbca8aecc52f85aaa227f2936d0333f46",',
      '"hash": "bce114fd8894ce58eba0df926d9ae41821e13caadbf",',
    ],
  },
]

function highlightSearchText(text: string, query: string) {
  if (!query) return text
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return text.split(new RegExp(`(${escaped})`, 'ig')).map((part, index) => part.toLowerCase() === query.toLowerCase() ? <mark key={`${part}-${index}`}>{part}</mark> : part)
}

function SearchView() {
  const [query, setQuery] = useState('')
  const [replace, setReplace] = useState('')
  const hasQuery = query.trim().length > 0

  return (
    <div className="search-view">
      <div className="search-view-head">
        <span>SEARCH</span>
        <div className="search-view-actions">
          <button type="button" aria-label="Refresh search"><span className="codicon codicon-refresh" /></button>
          <button type="button" aria-label="Clear search" onClick={() => setQuery('')}><span className="codicon codicon-clear-all" /></button>
          <button type="button" aria-label="New search editor"><span className="codicon codicon-new-file" /></button>
          <button type="button" aria-label="Search details"><span className="codicon codicon-list-flat" /></button>
          <button type="button" aria-label="Collapse search"><span className="codicon codicon-collapse-all" /></button>
        </div>
      </div>
      <div className="search-input-wrap">
        <input value={query} aria-label="Search" onChange={event => setQuery(event.target.value)} autoComplete="off" />
        <div className="search-input-actions"><button type="button">Aa</button><button type="button">ab</button><button type="button">.*</button></div>
      </div>
      <div className="replace-input-wrap">
        <input value={replace} placeholder="Replace" aria-label="Replace" onChange={event => setReplace(event.target.value)} />
        <button type="button" disabled={!hasQuery || !replace}>AB</button>
        <span className="codicon codicon-replace-all" />
      </div>
      <div className="search-result-summary">
        <span className="codicon codicon-chevron-down" />
        <span>{hasQuery ? '6380 results in 100 files' : 'Search files by name or content'}</span>
        {hasQuery ? <button type="button">Open in editor</button> : null}
      </div>
      {hasQuery ? <div className="search-results-list">
        {dummySearchFiles.map(group => (
          <section className="search-file-group" key={group.file}>
            <div className="search-file-head"><span className="codicon codicon-chevron-down" /><span className="file-icon file-icon-json">{`{}`}</span><strong>{group.file}</strong><span className="search-file-path">{group.path}</span><b>{group.count}</b></div>
            <div className="search-match-lines">
              {group.lines.map((line, index) => <div className="search-match-line" key={`${group.file}-${index}`}><span>{highlightSearchText(line, query.trim())}</span></div>)}
            </div>
          </section>
        ))}
      </div> : null}
    </div>
  )
}

type ExtensionLink = {
  name: string
  publisher: string
  description: string
  url: string
  accent: string
}

const splitKeyboardLinks: ExtensionLink[] = [
  { name: 'VIA', publisher: 'web configurator', description: 'Configure compatible keyboards directly in your browser.', url: 'https://usevia.app/', accent: '#c6a0f6' },
  { name: 'QMK Configurator', publisher: 'qmk.fm', description: 'Build firmware keymaps with the official QMK web interface.', url: 'https://config.qmk.fm/', accent: '#8aadf4' },
  { name: 'ZMK Studio', publisher: 'zmk.dev', description: 'Configure supported wireless split keyboards from the web.', url: 'https://zmk.studio/', accent: '#a6da95' },
  { name: 'Vial', publisher: 'vial.rocks', description: 'A fast browser-based configurator for Vial-enabled keyboards.', url: 'https://vial.rocks/', accent: '#f5a97f' },
  { name: 'QMK Firmware', publisher: 'qmk.fm', description: 'Explore firmware docs, supported features, and keyboard tooling.', url: 'https://qmk.fm/', accent: '#eed49f' },
]

function ExtensionsView() {
  const [query, setQuery] = useState('')
  const visibleLinks = splitKeyboardLinks.filter(link => `${link.name} ${link.publisher} ${link.description}`.toLowerCase().includes(query.trim().toLowerCase()))

  return (
    <div className="extensions-view">
      <div className="extensions-head">
        <span>EXTENSIONS</span>
        <button type="button" aria-label="More extension actions">...</button>
      </div>
      <div className="extensions-search">
        <span className="codicon codicon-search" />
        <input value={query} placeholder="Search Extensions in Marketplace" aria-label="Search extensions" onChange={event => setQuery(event.target.value)} />
      </div>
      <div className="extensions-section-title">SPLIT KEYBOARD WEB UI <span>{visibleLinks.length}</span></div>
      <div className="extension-list">
        {visibleLinks.map(link => (
          <a className="extension-card" href={link.url} target="_blank" rel="noreferrer" key={link.name}>
            <span className="extension-logo" style={{ color: link.accent }}>{link.name.slice(0, 1)}</span>
            <span className="extension-copy"><strong>{link.name}</strong><small>{link.publisher}</small><p>{link.description}</p></span>
            <span className="codicon codicon-link-external extension-external" />
          </a>
        ))}
        {!visibleLinks.length ? <p className="extensions-empty">No matching keyboard tools.</p> : null}
      </div>
    </div>
  )
}

function renderDebugView({ activeLesson, progress, typingIndex, typingErrors, finishedAttempt, onOpenDoc }: { activeLesson: Lesson | null; progress: Progress; typingIndex: number; typingErrors: number; finishedAttempt: Attempt | null; onOpenDoc: (id: DocId) => void }) {
  const activeAttempt = finishedAttempt ?? [...progress.attempts].reverse().find(attempt => attempt.lessonId === activeLesson?.id)
  const completion = activeLesson ? Math.round((typingIndex / Math.max(1, activeLesson.text.length)) * 100) : 0
  const passed = activeAttempt ? activeAttempt.accuracy >= 95 : false
  return (
    <div className="debug-view">
      <div className="explorer-head"><span>RUN AND DEBUG</span><span className="source-count">{activeLesson ? '1' : '0'}</span></div>
      <section className="debug-section">
        <div className="debug-section-title">SESSION</div>
        <div className="debug-row"><span>state</span><strong className={activeLesson ? 'debug-live' : ''}>{activeLesson ? (finishedAttempt ? 'finished' : 'running') : 'idle'}</strong></div>
        <div className="debug-row"><span>lesson</span><code>{activeLesson ? lessonFileName(activeLesson) : 'none'}</code></div>
        <div className="debug-row"><span>course</span><code>{activeLesson?.course ?? '—'}</code></div>
        <div className="debug-row"><span>completion</span><code>{completion}%</code></div>
        <div className="debug-row"><span>mistakes</span><code>{finishedAttempt?.errors ?? typingErrors}</code></div>
      </section>
      <section className="debug-section">
        <div className="debug-section-title">PROGRESS.JSON</div>
        <div className="debug-row"><span>attempts</span><code>{progress.attempts.length}</code></div>
        <div className="debug-row"><span>passed</span><code>{progress.attempts.filter(attempt => attempt.accuracy >= 95).length}</code></div>
        <div className="debug-row"><span>last accuracy</span><code>{activeAttempt ? `${activeAttempt.accuracy}%` : '—'}</code></div>
        <div className="debug-row"><span>last wpm</span><code>{activeAttempt ? activeAttempt.wpm : '—'}</code></div>
        <div className="debug-row"><span>result</span><strong className={passed ? 'debug-pass' : ''}>{activeAttempt ? (passed ? 'passed' : 'retry') : '—'}</strong></div>
      </section>
      <button type="button" className="debug-open-file" onClick={() => onOpenDoc('progress')}><span className="codicon codicon-file-code" /> Open progress.json</button>
    </div>
  )
}

function TreeNode({
  label,
  level,
  active = false,
  locked = false,
  passed = false,
  folderKey,
  expanded = false,
  onToggle,
  icon,
  onClick,
}: {
  label: string
  level: number
  active?: boolean
  locked?: boolean
  passed?: boolean
  folderKey?: string
  expanded?: boolean
  onToggle?: () => void
  icon?: string
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      className={`tree-node tree-level-${level} ${active ? 'active' : ''} ${locked ? 'locked' : ''} ${passed ? 'passed' : ''}`}
      style={{ paddingLeft: `${level * 14 + 10}px` }}
      onClick={folderKey ? onToggle : onClick}
      disabled={locked}
    >
      <span className="tree-caret">{folderKey ? <span className={`codicon codicon-chevron-${expanded ? 'down' : 'right'}`} /> : null}</span>
      {icon ? <FileIcon label={label} /> : folderKey ? <span className="codicon codicon-folder tree-folder-icon" /> : null}
      <span className="tree-label">{label}</span>
      {locked ? <span className="tree-badge">lock</span> : null}
      {!locked && passed ? <span className="tree-badge pass">ok</span> : null}
    </button>
  )
}

function renderOverviewDoc({
  progress,
  eligibleLessons,
  activeLessonId,
  onOpenLesson,
  onOpenProgress,
  onOpenSettings,
  onStart,
}: {
  progress: Progress
  eligibleLessons: Lesson[]
  activeLessonId: string | null
  onOpenLesson: (doc: DocId) => void
  onOpenProgress: () => void
  onOpenSettings: () => void
  onStart: () => void
}) {
  const nextIndex = Math.max(0, eligibleLessons.findIndex((lesson, index) => isUnlocked(eligibleLessons, progress.attempts, index, progress.settings.keyboard) && !lessonPassed(progress.attempts, lesson.id)))
  const next = eligibleLessons[nextIndex] ?? eligibleLessons[0]
  return (
    <section className="markdown-document">
      <article className="markdown-content">
        <h1>SplitTyping</h1>
        <p className="markdown-lede">A calm, accuracy-first workspace for building real touch-typing muscle memory.</p>
        <ReadmeMarkdown progress={progress} next={next} activeLessonId={activeLessonId} onOpenLesson={onOpenLesson} onOpenProgress={onOpenProgress} onStart={onStart} onOpenSettings={onOpenSettings} />
      </article>
    </section>
  )
}

function ReadmeMarkdown({ progress, next, activeLessonId, onOpenLesson, onOpenProgress, onStart, onOpenSettings }: { progress: Progress; next?: Lesson; activeLessonId: string | null; onOpenLesson: (id: DocId) => void; onOpenProgress: () => void; onStart: () => void; onOpenSettings: () => void }) {
  return (
    <div className="readme-markdown">
      <h2>Workspace</h2>
      <p>Practice touch typing in a quiet, code-first workspace.</p>
      <div className="readme-table">
        <div><span>keyboard</span><code>{progress.settings.keyboard}</code></div>
        <div><span>layout</span><code>{progress.settings.layout}</code></div>
        <div><span>attempts</span><code>{progress.attempts.length}</code></div>
        <div><span>active lesson</span><code>{activeLessonId ?? 'none'}</code></div>
      </div>
      <h2>Next lesson</h2>
      <p>{next ? `Continue with ${courseNames[next.course]} / ${lessonFileName(next)}.` : 'No unlocked lesson yet.'}</p>
      <div className="readme-markdown-links">
        <button type="button" onClick={onStart}>[ Start workspace ]</button>
        <button type="button" onClick={() => onOpenLesson(next ? next.id : 'progress')}>[ Open lesson ]</button>
        <button type="button" onClick={onOpenProgress}>[ Inspect progress ]</button>
        <button type="button" onClick={onOpenSettings}>[ Open settings ]</button>
      </div>
    </div>
  )
}

function renderProgressDoc({
  progress,
  onOpenSettings,
  onReset,
}: {
  progress: Progress
  onOpenSettings: () => void
  onReset: () => void
}) {
  const average = progress.attempts.length ? Math.round(progress.attempts.reduce((sum, attempt) => sum + attempt.accuracy, 0) / progress.attempts.length) : 0
  const best = progress.attempts.length ? Math.max(...progress.attempts.map(attempt => attempt.wpm)) : 0
  const weak = weakKeys(progress.attempts)
  const lines = [
    '{',
    `  "version": ${progress.version},`,
    `  "onboarded": ${progress.onboarded},`,
    '  "settings": {',
    `    "keyboard": "${progress.settings.keyboard}",`,
    `    "layout": "${progress.settings.layout}",`,
    `    "sound": ${progress.settings.sound},`,
    `    "showKeyboard": ${progress.settings.showKeyboard}`,
    '  },',
    `  "attempts": ${progress.attempts.length},`,
    `  "averageAccuracy": ${average},`,
    `  "bestWpm": ${best},`,
    `  "weakKeys": ${JSON.stringify(weak)}`,
    '}',
  ]

  return (
    <DocumentFrame
      title="progress.json"
      language="json"
      path="SplitTyping/progress.json"
      actions={<EditorActions primary="Open settings" secondary="Reset progress" onPrimary={onOpenSettings} onSecondary={onReset} />}
      lines={lines.map((line, index) => <JsonLine key={line + index} text={line} />)}
      footer={null}
      hideFooter
    />
  )
}

function renderSettingsDoc({
  progress,
  onSetting,
  onReset,
}: {
  progress: Progress
  onSetting: <K extends keyof Progress['settings']>(key: K, value: Progress['settings'][K]) => void
  onReset: () => void
}) {
  const lines = [
    '{',
    `  "keyboard": "${progress.settings.keyboard}",`,
    `  "layout": "${progress.settings.layout}",`,
    `  "sound": ${progress.settings.sound},`,
    `  "showKeyboard": ${progress.settings.showKeyboard}`,
    '}',
  ]

  return (
    <DocumentFrame
      title="settings.json"
      language="json"
      path="SplitTyping/.vscode/settings.json"
      actions={<div className="read-only-badge"><span className="codicon codicon-lock" /> Read-only</div>}
      lines={lines.map((line, index) => <JsonLine key={line + index} text={line} />)}
      footer={<div className="read-only-footer"><span className="codicon codicon-info" /> Edit these values from <strong>File → Settings</strong>.</div>}
    />
  )
}

function renderSettingsUi({
  progress,
  onSetting,
  onOpenJson,
  onReset,
}: {
  progress: Progress
  onSetting: <K extends keyof Progress['settings']>(key: K, value: Progress['settings'][K]) => void
  onOpenJson: () => void
  onReset: () => void
}) {
  return (
    <section className="settings-editor">
      <div className="settings-toolbar">
        <span className="settings-title">Settings</span>
        <input aria-label="Search settings" placeholder="Search settings" />
        <button type="button" className="toolbar-button" onClick={onOpenJson}><span className="codicon codicon-json" /> Open settings.json</button>
      </div>
      <div className="settings-layout">
        <nav className="settings-nav">
          <span className="settings-nav-title">Commonly Used</span>
          <button type="button" className="settings-nav-item active">Workbench</button>
          <button type="button" className="settings-nav-item">Text Editor</button>
          <button type="button" className="settings-nav-item">Features</button>
          <button type="button" className="settings-nav-item">Extensions</button>
          <span className="settings-nav-title">SplitTyping</span>
          <button type="button" className="settings-nav-item active">Typing Trainer</button>
        </nav>
        <div className="settings-content">
          <div className="settings-section-heading">SplitTyping: Typing Trainer</div>
          <p className="settings-description">Configure the keyboard and feedback used during typing practice.</p>
          <SettingsControl label="Keyboard shape" description="Choose the physical keyboard shown in the keymap." value={progress.settings.keyboard} options={['standard', 'sofle']} onChange={value => onSetting('keyboard', value as Progress['settings']['keyboard'])} />
          <SettingsControl label="Logical layout" description="Choose the character layout used by lessons." value={progress.settings.layout} options={['us', 'it']} onChange={value => onSetting('layout', value as Progress['settings']['layout'])} />
          <SettingsControl label="Sound" description="Play a short sound when the expected key is missed." value={String(progress.settings.sound)} options={['true', 'false']} onChange={value => onSetting('sound', value === 'true')} />
          <SettingsControl label="Keyboard overlay" description="Show the keyboard visualization in the bottom panel." value={String(progress.settings.showKeyboard)} options={['true', 'false']} onChange={value => onSetting('showKeyboard', value === 'true')} />
          <button type="button" className="reset-link" onClick={onReset}>Reset all progress</button>
        </div>
      </div>
    </section>
  )
}

function SettingsControl({ label, description, value, options, onChange }: { label: string; description: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <div className="settings-control">
      <div><strong>{label}</strong><p>{description}</p></div>
      <div className="settings-control-options">{options.map(option => <button key={option} type="button" className={option === value ? 'active' : ''} onClick={() => onChange(option)}>{option}</button>)}</div>
    </div>
  )
}

function renderLessonDoc({
  lesson,
  progress,
  typingIndex,
  typingErrors,
  wrongKey,
  finishedAttempt,
  onRepeat,
  onExit,
}: {
  lesson: Lesson
  progress: Progress
  typingIndex: number
  typingErrors: number
  wrongKey: string
  finishedAttempt: Attempt | null
  onRepeat: () => void
  onExit: () => void
}) {
  const { before, current, after } = activeChar(lesson.text, typingIndex)
  const linePrefix = lesson.course === 'foundations'
    ? '  private static final String DRILL = "'
    : lesson.course === 'english'
      ? 'export const sample = "'
      : lesson.course === 'italian'
        ? 'const sample = "'
        : 'const snippet = "'
  const lineSuffix = '";'

  const lines: ReactNode[] = lesson.course === 'foundations'
    ? [
        <CodeLine key="1" kind="keyword" text="package splittyping.lessons.foundations;" />,
        <CodeLine key="2" kind="comment" text="" />,
        <CodeLine key="3" kind="declaration" text={`public final class ${classNameForLesson(lesson)} {`} />,
        <CodeLine key="4" kind="code" text="  public static void main(String[] args) {" />,
        <TypingLine key="5" prefix={linePrefix} before={before} current={current} after={after} suffix={lineSuffix} active={typingIndex < lesson.text.length} wrong={wrongKey} />,
        <CodeLine key="6" kind="code" text="  }" />,
        <CodeLine key="7" kind="code" text="}" />,
      ]
    : [
        <CodeLine key="1" kind="comment" text={`// ${lesson.title}`} />,
        <CodeLine key="2" kind="comment" text={`// ${lesson.subtitle}`} />,
        <CodeLine key="3" kind="code" text="" />,
        <TypingLine key="4" prefix={linePrefix} before={before} current={current} after={after} suffix={lineSuffix} active={typingIndex < lesson.text.length} wrong={wrongKey} />,
        <CodeLine key="5" kind="comment" text={`// target: ${lesson.text.length} chars`} />,
        <CodeLine key="6" kind="comment" text="" />,
        <CodeLine key="7" kind="comment" text={`// accuracy target: 95%`} />,
      ]

  return (
    <DocumentFrame
      title={lessonFileName(lesson)}
      language={lesson.course === 'foundations' ? 'java' : lesson.course === 'italian' ? 'markdown' : 'typescript'}
      path={lessonPath(lesson)}
      actions={<EditorActions primary={finishedAttempt ? 'Repeat run' : 'Run lesson'} secondary="Back to README" onPrimary={onRepeat} onSecondary={onExit} />}
      lines={lines}
      footer={null}
      hideFooter
    />
  )
}

function renderPanel({
  panel,
  activeLesson,
  activeLessonIndex,
  progress,
  typingIndex,
  typingErrors,
  wrongKey,
  startedAt,
  finishedAttempt,
  recentOutput,
}: {
  panel: PanelId
  activeLesson: Lesson | null
  activeLessonIndex: number
  progress: Progress
  typingIndex: number
  typingErrors: number
  wrongKey: string
  startedAt: number | null
  finishedAttempt: Attempt | null
  recentOutput: string[]
}) {
  if (panel === 'keymap') {
    return (
      <div className="panel-body keymap-panel">
        <div className="panel-copy">
          <strong>{activeLesson ? activeLesson.title : 'No lesson open'}</strong>
          <p>{activeLesson ? `Lesson ${activeLessonIndex + 1}` : 'Open a lesson to start typing.'}</p>
        </div>
        <Keyboard kind={progress.settings.keyboard} layout={progress.settings.layout} target={activeLesson?.text[typingIndex] ?? ''} wrong={wrongKey} />
        <div className="panel-hint">
          {finishedAttempt ? (
            <span>Lesson complete. Repeat the run to record a second pass.</span>
          ) : activeLesson ? (
            <span>{typingIndex === 0 ? 'Start with the highlighted character.' : `Keep your pace. Mistakes: ${typingErrors}`}</span>
          ) : (
            <span>F and J remain the anchors. Use the explorer to open a file.</span>
          )}
        </div>
      </div>
    )
  }

  if (panel === 'problems') {
    return <div className="panel-body terminal-panel"><LineList lines={['0 problems, 0 warnings, 0 infos']} tone="quiet" /></div>
  }

  if (panel === 'output') {
    return (
      <div className="panel-body terminal-panel">
        <LineList
          lines={[
            `attempts: ${progress.attempts.length}`,
            `accuracy: ${progress.attempts.length ? Math.round(progress.attempts.reduce((sum, attempt) => sum + attempt.accuracy, 0) / progress.attempts.length) : 0}%`,
            `best wpm: ${progress.attempts.length ? Math.max(...progress.attempts.map(attempt => attempt.wpm)) : 0}`,
          ]}
        />
      </div>
    )
  }

  if (panel === 'ports') {
    return (
      <div className="panel-body terminal-panel">
        <LineList lines={['PORTS', '5173  Vite preview  http://localhost:5173', '3000  spare slot    available']} tone="quiet" />
      </div>
    )
  }

  return (
    <div className="panel-body terminal-panel">
      <LineList
        lines={[
          '> npm run dev',
          '> local session ready',
          ...recentOutput,
          startedAt ? `> running for ${Math.max(1, Math.floor((Date.now() - startedAt) / 1000))}s` : '> idle',
        ]}
      />
    </div>
  )
}

function renderPanelTabs(panel: PanelId, setPanel: (panel: PanelId) => void) {
  const tabs: Array<[PanelId, string]> = [
    ['problems', 'PROBLEMS'],
    ['output', 'OUTPUT'],
    ['terminal', 'TERMINAL'],
    ['ports', 'PORTS'],
    ['keymap', 'KEYMAP'],
  ]

  return (
    <div className="panel-tabs">
      {tabs.map(([id, label]) => (
        <button key={id} type="button" className={panel === id ? 'active' : ''} onClick={() => setPanel(id)}>
          {label}
        </button>
      ))}
    </div>
  )
}

function renderStatus({
  activeLesson,
  typingIndex,
  progress,
  selectedDoc,
  finishedAttempt,
}: {
  activeLesson: Lesson | null
  typingIndex: number
  progress: Progress
  selectedDoc: string
  finishedAttempt: Attempt | null
}) {
  const total = activeLesson?.text.length ?? 0
  const line = activeLesson ? 5 : 1
  const col = activeLesson ? typingIndex + 38 : 1
  const browser = getBrowserName()
  return (
    <>
      <div className="status-left">
        <span className="status-browser">{browser}</span>
        <span className="status-project">SplitTyping</span>
        <span className="status-branch"><span className="codicon codicon-git-branch" /> main*</span>
        <span className="status-sync"><span className="codicon codicon-sync" /> 0</span>
        <span className="status-problems"><span className="codicon codicon-error" /> 0</span>
        <span className="status-warnings"><span className="codicon codicon-warning" /> 0</span>
      </div>
      <div className="status-right">
        <span>{progress.settings.keyboard === 'sofle' ? 'Sofle' : 'Standard'}</span>
        <span>{progress.settings.layout.toUpperCase()}</span>
        <span>{finishedAttempt ? 'run complete' : activeLesson ? `${typingIndex}/${total} chars` : 'workspace ready'}</span>
        <span>Ln {line}, Col {col}</span>
        <span>{selectedDoc}</span>
      </div>
    </>
  )
}

function DocumentFrame({
  title,
  language,
  path,
  actions,
  lines,
  footer,
  hideFooter = false,
  inlineContent,
}: {
  title: string
  language: string
  path: string
  actions: ReactNode
  lines: ReactNode[]
  footer: ReactNode
  hideFooter?: boolean
  inlineContent?: ReactNode
}) {
  return (
    <section className="document-frame">
      <div className="editor-grid">
        <div className="editor-gutter">
          {lines.map((_, index) => <span key={index}>{index + 1}</span>)}
        </div>
        <div className="editor-code">
          {lines.map((line, index) => <div className="code-row" key={index}>{line}</div>)}
          {inlineContent}
        </div>
        <div className="editor-minimap">
          {lines.map((_, index) => <i key={index} className={index === 4 ? 'active' : ''} />)}
        </div>
      </div>
      {!hideFooter && footer ? <div className="document-footer">{footer}</div> : null}
    </section>
  )
}

function CodeLine({ kind, text }: { kind: string; text: string }) {
  return <span className={`code-line ${kind}`}>{text}</span>
}

function JsonLine({ text }: { text: string }) {
  const tokens = text.match(/("(?:\\.|[^"\\])*")|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?|[{}[\],:]/g) ?? []
  let cursor = 0
  return (
    <span className="code-line json">
      {tokens.map((token, index) => {
        const position = text.indexOf(token, cursor)
        const prefix = text.slice(cursor, position)
        cursor = position + token.length
        const next = text.slice(cursor).match(/^\s*:/)
        const className = token.startsWith('"') ? (next ? 'json-key' : 'json-string') : /^(true|false|null)$/.test(token) ? 'json-boolean' : /^-?\d/.test(token) ? 'json-number' : 'json-punctuation'
        return <span key={`${token}-${index}`}>{prefix}<span className={className}>{token}</span></span>
      })}
      {text.slice(cursor)}
    </span>
  )
}

function TypingLine({
  prefix,
  before,
  current,
  after,
  suffix,
  active,
  wrong,
}: {
  prefix: string
  before: string
  current: string
  after: string
  suffix: string
  active: boolean
  wrong: string
}) {
  return (
    <span className={`code-line typing ${active ? 'active' : ''} ${wrong ? 'wrong' : ''}`}>
      <span className="code-token prefix">{prefix}</span>
      <span className="code-token done">{before}</span>
      {current ? <span className="code-token cursor">{current}</span> : null}
      <span className="code-token rest">{after}</span>
      <span className="code-token suffix">{suffix}</span>
    </span>
  )
}

function LessonFooter({
  lesson,
  progress,
  typingIndex,
  typingErrors,
  finishedAttempt,
}: {
  lesson: Lesson
  progress: Progress
  typingIndex: number
  typingErrors: number
  finishedAttempt: Attempt | null
}) {
  const passCount = progress.attempts.filter(attempt => attempt.lessonId === lesson.id && attempt.accuracy >= 95).length
  const completion = finishedAttempt ? finishedAttempt.accuracy : Math.max(0, Math.min(100, Math.round((typingIndex / Math.max(1, lesson.text.length)) * 100)))
  return (
    <div className="lesson-footer">
      <div>
        <strong>{lesson.title}</strong>
        <p>{lesson.subtitle}</p>
      </div>
      <div>
        <strong>{completion}%</strong>
        <p>completion</p>
      </div>
      <div>
        <strong>{typingErrors}</strong>
        <p>mistakes</p>
      </div>
      <div>
        <strong>{passCount}</strong>
        <p>accurate passes</p>
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function LineList({ lines, tone = 'normal' }: { lines: string[]; tone?: 'normal' | 'quiet' }) {
  return (
    <div className={`line-list ${tone}`}>
      {lines.map((line, index) => <div key={`${line}-${index}`} className="line-item">{line}</div>)}
    </div>
  )
}

function SettingCard({
  label,
  value,
  values,
  onValueChange,
  readOnly = false,
}: {
  label: string
  value: string
  values: string[]
  onValueChange: (value: string) => void
  readOnly?: boolean
}) {
  return (
    <div className="setting-card">
      <span>{label}</span>
      <div className="setting-options">
        {values.map(option => (
          <button key={option} type="button" className={value === option ? 'active' : ''} onClick={() => !readOnly && onValueChange(option)} disabled={readOnly}>
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}

function EditorActions({
  primary,
  secondary,
  onPrimary,
  onSecondary,
}: {
  primary: string
  secondary: string
  onPrimary: () => void
  onSecondary: () => void
}) {
  return (
    <div className="editor-actions">
      <button type="button" className="primary" onClick={onPrimary}>{primary}</button>
      <button type="button" className="ghost" onClick={onSecondary}>{secondary}</button>
    </div>
  )
}

function DocumentationPage({ onBack }: { onBack: () => void }) {
  return (
    <main className="documentation-page">
      <div className="documentation-layout">
        <aside className="documentation-sidebar">
          <p className="documentation-sidebar-title">SplitTyping</p>
          <nav aria-label="Documentation index">
            <a href="#overview">Overview</a>
            <a href="#getting-started">Getting started</a>
            <a href="#lesson-progression">Lesson progression</a>
            <a href="#workspace">Workspace guide</a>
            <a href="#keyboard-settings">Keyboard settings</a>
            <a href="#progress">Progress and storage</a>
          </nav>
          <button type="button" className="documentation-back" onClick={onBack}>← Back to workspace</button>
        </aside>
        <article className="documentation-card">
          <section id="overview" className="documentation-section">
            <p className="eyebrow">SplitTyping documentation</p>
            <h1>Practice with purpose.</h1>
            <p className="lede">SplitTyping is an accuracy-first typing trainer for standard and split keyboards.</p>
            <p>Lessons introduce keys progressively and present practice in a focused, code-inspired workspace. The goal is to build reliable muscle memory rather than chase speed at the expense of accuracy.</p>
          </section>
          <section id="getting-started" className="documentation-section">
            <h2>Getting started</h2>
            <ol>
              <li>Open Settings and choose the keyboard shape and logical layout that match your hardware.</li>
              <li>Open the first unlocked lesson from the Explorer, or use Run → Next Lesson.</li>
              <li>Click inside the lesson editor and type the highlighted text. The keyboard map shows the expected key and finger.</li>
              <li>Review accuracy, speed, mistakes, and per-key errors in the bottom panels after each attempt.</li>
              <li>Repeat lessons until the next exercise becomes available.</li>
            </ol>
          </section>
          <section id="lesson-progression" className="documentation-section">
            <h2>Lesson progression</h2>
            <p>A lesson requires two attempts with at least 95% accuracy before the next lesson unlocks. This is intentional: one accurate run shows that the lesson is possible, while a second accurate run helps confirm that the movement is becoming consistent.</p>
            <p>Incorrect keys count as mistakes and are recorded by target key. Slow down when accuracy drops; speed is measured, but accuracy controls progression.</p>
          </section>
          <section id="workspace" className="documentation-section">
            <h2>Workspace guide</h2>
            <ul>
              <li>Use the Explorer and tabs to move between lessons, progress, settings, and the README.</li>
              <li>Use the Terminal panel for session output and the Keymap panel for the keyboard visualization.</li>
              <li>Search bars and other workspace controls keep their own focus and do not intercept lesson typing.</li>
              <li>Use Run → Current Lesson to return to the active exercise, or Run → Next Lesson to find the next available one.</li>
            </ul>
          </section>
          <section id="keyboard-settings" className="documentation-section">
            <h2>Keyboard settings</h2>
            <p>Choose Standard or Sofle for the physical keyboard visualization and US or Italian for the logical character layout. The selected course and keyboard map should match the keys you are physically using.</p>
            <p>Sound feedback and the keyboard overlay can also be enabled or disabled from Settings.</p>
          </section>
          <section id="progress" className="documentation-section">
            <h2>Progress and storage</h2>
            <p>Progress and settings are saved locally in your browser, so no account is required. Use the progress view to inspect attempts and the Settings page when you need to reset progress or change feedback options.</p>
            <p>Documentation will continue to grow as more keyboard layouts, presets, and firmware integrations are added.</p>
          </section>
          <button type="button" className="primary" onClick={onBack}>Back to workspace</button>
        </article>
      </div>
    </main>
  )
}

function playTone() {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return Promise.resolve()
  const ctx = new AudioContext()
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = 'square'
  oscillator.frequency.value = 160
  gain.gain.value = 0.015
  oscillator.connect(gain)
  gain.connect(ctx.destination)
  oscillator.start()
  oscillator.stop(ctx.currentTime + 0.04)
  return ctx.close()
}
