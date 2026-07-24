import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import readmeSource from '../../README.md?raw'
import Keyboard from '../components/Keyboard'
import ReadmePreview from '../components/ReadmePreview'
import { loadCourseCatalog } from '../domain/courseCatalog'
import { detectKeyboardPreset, fingerNames, getKeyboardPreset, keyboardPresets } from '../domain/data'
import { getKey, loadKeyboardCatalog, missingLessonCharacters, resolveKeyboard } from '../domain/keyboardCatalog'
import { calculateAccuracy, calculateWpm, isUnlocked, lessonPassed, weakKeys } from '../domain/engine'
import { commitFileName, downloadProgressExport } from '../domain/export'
import { clearProgress, loadProgress, saveProgress } from '../domain/storage'
import type { Attempt, CourseCatalog, KeyboardCatalog, Lesson, Progress, ResolvedKeyboard } from '../domain/types'
import SourceControl from '../features/source-control/SourceControl'
import IdeFrame from '../components/IdeFrame'
import { LAYOUT_KEY, activeChar, buildSearchResults, canOpenLessonWithKeyboard, classNameForLesson, defaultWorkspaceLayout, fileExtension, getBrowserName, groupByCourse, initialDoc, lessonFileName, lessonPath, loadWorkspaceLayout, restoredLessonId } from './helpers'
import type { ActivityView, DocId, PanelId, SearchResult, WorkspaceLayout } from './types'
import { isCourseTypingTarget } from './typingFocus'

export default function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const [progress, setProgress] = useState<Progress>(() => loadProgress())
  const [catalog, setCatalog] = useState<CourseCatalog>({ courses: [], lessons: [], errors: [] })
  const [keyboardCatalog, setKeyboardCatalog] = useState<KeyboardCatalog>({
    keyboards: [],
    languages: [],
    defaultKeyboardId: '',
    defaultLanguageId: '',
    errors: [],
  })
  const [courseStatus, setCourseStatus] = useState<'loading' | 'ready'>('loading')
  const [selectedDoc, setSelectedDoc] = useState<DocId>(() => initialDoc(progress.onboarded))
  const [panel, setPanel] = useState<PanelId>(() => progress.onboarded ? 'terminal' : 'keymap')
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null)
  const [typingIndex, setTypingIndex] = useState(0)
  const [typingErrors, setTypingErrors] = useState(0)
  const [wrongKey, setWrongKey] = useState('')
  const [keyErrors, setKeyErrors] = useState<Record<string, number>>({})
  const [startedAt, setStartedAt] = useState<number | null>(() => progress.lessonStartedAt)
  const [finishedAttempt, setFinishedAttempt] = useState<Attempt | null>(null)
  const [recentOutput, setRecentOutput] = useState<string[]>([
    '[info] workspace ready',
    '[info] loading course catalog',
  ])
  const [workspaceLayout, setWorkspaceLayout] = useState<WorkspaceLayout>(() => loadWorkspaceLayout())
  const [openTabs, setOpenTabs] = useState<DocId[]>(() => ['readme', 'overview'])
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem('keyloom-expanded-folders-v1') ?? '') as Record<string, boolean> }
    catch { return { root: true, vscode: true, src: true, lessons: true } }
  })
  const [activityView, setActivityView] = useState<ActivityView>('explorer')
  const [commitMessage, setCommitMessage] = useState('')
  const lessons = catalog.lessons

  useEffect(() => {
    let cancelled = false
    void loadKeyboardCatalog().then(async keyboards => {
      const result = await loadCourseCatalog(fetch, import.meta.env.BASE_URL, keyboards.languages.map(language => language.id))
      if (cancelled) return
      setKeyboardCatalog(keyboards)
      setCatalog(result)
      setCourseStatus('ready')
      result.errors.forEach(error => console.error(`[SplitTyping] ${error}`))
      setRecentOutput([
        `[info] loaded ${keyboards.keyboards.length} keyboard model${keyboards.keyboards.length === 1 ? '' : 's'}`,
        `[info] loaded ${result.courses.length} course${result.courses.length === 1 ? '' : 's'}`,
        ...keyboards.errors.map(error => `[error] ${error}`),
        ...result.errors.map(error => `[error] ${error}`),
        ...(result.lessons.length ? ['[info] open a file in the explorer to begin'] : ['[error] no valid courses are available']),
      ])
      setExpandedFolders(current => ({
        ...current,
        ...Object.fromEntries(result.courses.map(course => [course.id, current[course.id] ?? true])),
      }))
      const restored = restoredLessonId(progress, result.lessons)
      if (restored) {
        setActiveLessonId(restored)
        setSelectedDoc(restored)
        setOpenTabs(tabs => tabs.includes(restored) ? tabs : [...tabs, restored])
        setPanel('keymap')
      }
    })
    return () => { cancelled = true }
  }, [])

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
    return lessons.filter(lesson => lesson.languages.includes(progress.settings.language))
  }, [lessons, progress.settings.language])

  const resolvedKeyboard = useMemo(
    () => resolveKeyboard(keyboardCatalog, progress.settings),
    [keyboardCatalog, progress.settings]
  )

  useEffect(() => {
    if (!keyboardCatalog.keyboards.length || !keyboardCatalog.languages.length) return
    const resolved = resolveKeyboard(keyboardCatalog, progress.settings)
    if (!resolved) return
    if (
      resolved.model.id !== progress.settings.keyboardId
      || resolved.variant.id !== progress.settings.keyboardVariantId
      || resolved.language.id !== progress.settings.language
    ) {
      setProgress(current => ({
        ...current,
        settings: {
          ...current.settings,
          keyboardId: resolved.model.id,
          keyboardVariantId: resolved.variant.id,
          language: resolved.language.id,
        },
      }))
    }
  }, [keyboardCatalog, progress.settings])

  const activeLesson = useMemo(
    () => lessons.find(lesson => lesson.id === activeLessonId) ?? null,
    [activeLessonId, lessons]
  )

  const activeLessonIndex = useMemo(
    () => eligibleLessons.findIndex(lesson => lesson.id === activeLessonId),
    [activeLessonId, eligibleLessons]
  )

  const nextReadmeLesson = useMemo(
    () => eligibleLessons.find((lesson, index) => isUnlocked(eligibleLessons, progress.attempts, index, progress.settings.formFactor) && !lessonPassed(progress.attempts, lesson.id))
      ?? eligibleLessons.find((_, index) => isUnlocked(eligibleLessons, progress.attempts, index, progress.settings.formFactor))
      ?? eligibleLessons[0],
    [eligibleLessons, progress.attempts, progress.settings.formFactor]
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
      setOpenTabs(tabs => [...tabs.filter(tab => tab !== 'readme' && tab !== 'overview'), 'readme', 'overview'])
      setSelectedDoc(doc)
      setFinishedAttempt(null)
      setActiveLessonId(null)
      setPanel('terminal')
      resetTyping()
      return
    }
    const lesson = lessons.find(item => item.id === doc) ?? null
    if (!lesson || !canOpenLessonWithKeyboard(lesson, eligibleLessons, progress.attempts, progress.settings.formFactor)) return
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
      ?? eligibleLessons.find((lesson, index) => isUnlocked(eligibleLessons, progress.attempts, index, progress.settings.formFactor) && !lessonPassed(progress.attempts, lesson.id))
      ?? eligibleLessons.find((lesson, index) => isUnlocked(eligibleLessons, progress.attempts, index, progress.settings.formFactor))
    if (next) openDoc(next.id)
  }

  const closeTab = (doc: DocId) => {
    if (doc === 'readme' || doc === 'overview') {
      const remaining = openTabs.filter(tab => tab !== 'readme' && tab !== 'overview')
      setOpenTabs(remaining)
      const replacement = remaining[remaining.length - 1]
      if (replacement) {
        openDoc(replacement)
        return
      }
      const firstLesson = eligibleLessons.find((lesson, index) => canOpenLessonWithKeyboard(lesson, eligibleLessons, progress.attempts, progress.settings.formFactor) && isUnlocked(eligibleLessons, progress.attempts, index, progress.settings.formFactor))
      if (firstLesson) openDoc(firstLesson.id)
      return
    }
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

  const detectKeyboard = async () => {
    const detected = await detectKeyboardPreset()
    updateSetting('keyboardId', 'normal')
    updateSetting('keyboardVariantId', `${detected.formFactor}-${detected.standard}`)
    updateSetting('formFactor', detected.formFactor)
    updateSetting('standard', detected.standard)
    updateSetting('language', detected.language)
    setRecentOutput([detected.available ? `keyboard detected: ${getKeyboardPreset(detected.formFactor).label} · ${detected.standard.toUpperCase()} · ${detected.language.toUpperCase()}` : 'keyboard detection is not available in this browser'])
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
        : selectedDoc === 'overview'
          ? 'README Preview'
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
    : selectedDoc === 'readme' || selectedDoc === 'overview'
      ? <ReadmeSplitView
          source={renderReadmeSourceDoc(readmeSource)}
          preview={<ReadmePreview
            markdown={readmeSource}
            progress={progress}
            next={nextReadmeLesson}
            activeLessonId={activeLessonId}
            onOpenLesson={openDoc}
            onOpenProgress={() => openDoc('progress')}
            onOpenSettings={() => openDoc('settings')}
            onStart={startWorkspace}
          />}
          onClose={() => closeTab(selectedDoc)}
        />
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
        ? renderSettingsUi({ progress, catalog: keyboardCatalog, onSetting: updateSetting, onOpenJson: () => openDoc('settings'), onReset: resetAll, onDetectKeyboard: detectKeyboard })
        : renderReadmeSourceDoc(readmeSource)

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
    keyboard: resolvedKeyboard,
  })

  const status = renderStatus({
    activeLesson,
    typingIndex,
    progress,
    selectedDoc: currentDoc,
    finishedAttempt,
    keyboard: resolvedKeyboard,
  })

return (
    <IdeFrame
      workspace="SplitTyping"
      command={currentDoc}
      explorer={activityView === 'search' ? <SearchView /> : activityView === 'extensions' ? <ExtensionsView /> : activityView === 'source-control' ? <SourceControl activeLesson={activeLesson} lessons={lessons} progress={progress} commitMessage={commitMessage} onCommit={commitProgress} onCommitMessage={setCommitMessage} onOpenDoc={openDoc} /> : activityView === 'debug' ? renderDebugView({ activeLesson, progress, typingIndex, typingErrors, finishedAttempt, onOpenDoc: openDoc }) : renderExplorer({
        selectedDoc,
        activeLessonId,
        courses: catalog.courses,
        lessons,
        courseStatus,
        eligibleLessons,
        attempts: progress.attempts,
        keyboard: progress.settings.formFactor,
        onOpenDoc: openDoc,
        expandedFolders,
        onToggleFolder: folder => setExpandedFolders(current => ({ ...current, [folder]: !current[folder] })),
      })}
      splitEditor={selectedDoc === 'readme' || selectedDoc === 'overview'}
      tabs={renderTabs({
        selectedDoc,
        activeLesson,
        onOpenDoc: openDoc,
        openTabs,
        onCloseTab: closeTab,
      })}
      breadcrumbs={selectedDoc === 'progress' ? 'SplitTyping / progress.json' : selectedDoc === 'settings' ? 'SplitTyping / .vscode / settings.json' : selectedDoc === 'settings-ui' ? 'SplitTyping / Settings' : selectedDoc === 'overview' ? 'SplitTyping / README Preview' : activeLesson ? `SplitTyping / src / lessons / ${activeLesson.course} / ${lessonFileName(activeLesson)}` : 'SplitTyping / README.md'}
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
  courses,
  lessons,
  courseStatus,
  eligibleLessons,
  attempts,
  keyboard,
  onOpenDoc,
  expandedFolders,
  onToggleFolder,
}: {
  selectedDoc: DocId
  activeLessonId: string | null
  courses: CourseCatalog['courses']
  lessons: Lesson[]
  courseStatus: 'loading' | 'ready'
  eligibleLessons: Lesson[]
  attempts: Attempt[]
  keyboard: Progress['settings']['formFactor']
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
        {expandedFolders.src && expandedFolders.lessons && courseStatus === 'loading' ? <div className="tree-loading">Loading courses…</div> : null}
        {expandedFolders.src && expandedFolders.lessons && courseStatus === 'ready' && !courses.length ? <div className="tree-loading tree-error">No valid courses</div> : null}
        {expandedFolders.src && expandedFolders.lessons ? courses.map(course => (
          <div key={course.id} className="tree-group">
            <TreeNode label={course.title} level={3} folderKey={course.id} expanded={expandedFolders[course.id]} onToggle={() => onToggleFolder(course.id)} />
            {expandedFolders[course.id] ? (grouped[course.id] ?? []).map(lesson => {
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

function renderReadmeSourceDoc(markdown: string) {
  const lines = markdown.trimEnd().split(/\r?\n/)
  return (
    <DocumentFrame
      title="README.md"
      language="markdown"
      path="README.md"
      actions={null}
      lines={lines.map((text, index) => {
        const kind = text.startsWith('#') ? 'heading' : text.startsWith('```') ? 'comment' : 'markdown'
        return <CodeLine key={index} kind={kind} text={text} />
      })}
      footer={null}
      hideFooter
    />
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
    `    "keyboardId": "${progress.settings.keyboardId}",`,
    `    "keyboardVariantId": "${progress.settings.keyboardVariantId}",`,
    `    "formFactor": "${progress.settings.formFactor}",`,
    `    "standard": "${progress.settings.standard}",`,
    `    "language": "${progress.settings.language}",`,
    `    "sound": ${progress.settings.sound},`,
    `    "showKeyboard": ${progress.settings.showKeyboard},`,
    `    "showFingerHints": ${progress.settings.showFingerHints}`,
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
    `  "keyboardId": "${progress.settings.keyboardId}",`,
    `  "keyboardVariantId": "${progress.settings.keyboardVariantId}",`,
    `  "formFactor": "${progress.settings.formFactor}",`,
    `  "standard": "${progress.settings.standard}",`,
    `  "language": "${progress.settings.language}",`,
    `  "sound": ${progress.settings.sound},`,
    `  "showKeyboard": ${progress.settings.showKeyboard},`,
    `  "showFingerHints": ${progress.settings.showFingerHints}`,
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
  catalog,
  onSetting,
  onOpenJson,
  onReset,
  onDetectKeyboard,
}: {
  progress: Progress
  catalog: KeyboardCatalog
  onSetting: <K extends keyof Progress['settings']>(key: K, value: Progress['settings'][K]) => void
  onOpenJson: () => void
  onReset: () => void
  onDetectKeyboard: () => void
}) {
  const selectedModel = catalog.keyboards.find(model => model.id === progress.settings.keyboardId) ?? catalog.keyboards[0]
  const customGeometry = Boolean(selectedModel && !selectedModel.configurableStandard)
  const selectedLanguage = catalog.languages.find(language => language.id === progress.settings.language)
  const selectModel = (keyboardId: string) => {
    const model = catalog.keyboards.find(item => item.id === keyboardId)
    if (!model) return
    onSetting('keyboardId', model.id)
    onSetting('keyboardVariantId', model.variants[0].id)
  }
  const selectNormalVariant = (formFactor: Progress['settings']['formFactor'], standard: Progress['settings']['standard']) => {
    onSetting('keyboardVariantId', `${formFactor}-${standard}`)
  }
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
          <SettingsControl label="Keyboard model" description="Choose a keyboard definition loaded from the runtime catalog." value={selectedModel?.id ?? ''} options={catalog.keyboards.map(model => model.id)} optionLabels={Object.fromEntries(catalog.keyboards.map(model => [model.id, model.label]))} onChange={selectModel} />
          <SettingsControl label="Keyboard variant" description={customGeometry ? 'Choose the physical variant supplied by this keyboard model.' : 'The variant follows the form-factor and physical-standard controls.'} value={customGeometry ? progress.settings.keyboardVariantId : `${progress.settings.formFactor}-${progress.settings.standard}`} options={selectedModel?.variants.map(variant => variant.id) ?? []} optionLabels={Object.fromEntries(selectedModel?.variants.map(variant => [variant.id, variant.label]) ?? [])} onChange={value => onSetting('keyboardVariantId', value)} disabled={!customGeometry} />
          <SettingsControl label="Form factor" description={customGeometry ? 'Not applicable: this keyboard model owns its geometry.' : 'Choose the amount of navigation hardware shown around the typing keys.'} value={progress.settings.formFactor} options={keyboardPresets.map(preset => preset.id)} optionLabels={Object.fromEntries(keyboardPresets.map(preset => [preset.id, preset.label]))} onChange={value => { const formFactor = value as Progress['settings']['formFactor']; onSetting('formFactor', formFactor); selectNormalVariant(formFactor, progress.settings.standard) }} disabled={customGeometry} />
          <SettingsControl label="Physical standard" description={customGeometry ? 'Not applicable: this keyboard model owns its geometry.' : 'Match the Enter, left Shift, and backslash-key geometry of your keyboard.'} value={progress.settings.standard} options={['ansi', 'iso']} optionLabels={{ ansi: 'ANSI', iso: 'ISO' }} onChange={value => { const standard = value as Progress['settings']['standard']; onSetting('standard', standard); selectNormalVariant(progress.settings.formFactor, standard) }} disabled={customGeometry} />
          <details className="keyboard-standard-help">
            <summary>ANSI or ISO? Compare keyboard standards</summary>
            <div className="keyboard-standard-help-content">
              <p><strong>ANSI</strong> is the common US physical layout. It has a horizontal rectangular Enter key, a long left Shift key, and the backslash key above Enter.</p>
              <p><strong>ISO</strong> is common in the United Kingdom, Ireland, Italy, and much of Europe. It has a two-row L-shaped Enter key, a shorter left Shift, and an additional key between left Shift and Z.</p>
              <table className="keyboard-standard-comparison">
                <caption className="sr-only">US ANSI and UK ISO character differences</caption>
                <thead><tr><th>Character</th><th>US ANSI</th><th>UK ISO</th></tr></thead>
                <tbody>
                  <tr><th scope="row">Backslash</th><td>Above Enter</td><td>Beside Z</td></tr>
                  <tr><th scope="row">Right Alt</th><td>Alt</td><td>AltGr</td></tr>
                  <tr><th scope="row">#</th><td>Shift+3</td><td>Key beside Enter</td></tr>
                  <tr><th scope="row">£</th><td>Not printed</td><td>Shift+3</td></tr>
                  <tr><th scope="row">@</th><td>Shift+2</td><td>Shift+'</td></tr>
                  <tr><th scope="row">"</th><td>Shift+'</td><td>Shift+2</td></tr>
                  <tr><th scope="row">Key beside 1</th><td>` and ~</td><td>` and ¬</td></tr>
                </tbody>
              </table>
              <p><strong>Italian ISO:</strong> the extra key beside Z carries &lt; and &gt;, the key beside Enter carries ù, and € is typed with AltGr+E. The £ symbol remains on Shift+3.</p>
            </div>
          </details>
          <SettingsControl label="Language" description="Choose the runtime character map printed on the keyboard." value={progress.settings.language} options={catalog.languages.map(language => language.id)} optionLabels={Object.fromEntries(catalog.languages.map(language => [language.id, language.label]))} onChange={value => { const language = catalog.languages.find(item => item.id === value); onSetting('language', value); if (language && !customGeometry) { onSetting('standard', language.recommendedStandard); selectNormalVariant(progress.settings.formFactor, language.recommendedStandard) } }} />
          {selectedLanguage ? <p className="settings-catalog-note">Loaded from the keyboard catalog: {selectedLanguage.label}.</p> : null}
          <div className="settings-control settings-detection"><div><strong>Keyboard detection</strong><p>Ask the browser for its detected physical layout when supported.</p></div><button type="button" className="settings-detect-button" onClick={onDetectKeyboard}>Detect keyboard</button></div>
          <SettingsControl label="Sound" description="Play a short sound when the expected key is missed." value={String(progress.settings.sound)} options={['true', 'false']} onChange={value => onSetting('sound', value === 'true')} />
          <SettingsControl label="Keyboard overlay" description="Show the keyboard visualization in the bottom panel." value={String(progress.settings.showKeyboard)} options={['true', 'false']} onChange={value => onSetting('showKeyboard', value === 'true')} />
          <SettingsControl label="Finger hints" description="Show compact left and right hand diagrams during active lessons." value={String(progress.settings.showFingerHints)} options={['true', 'false']} onChange={value => onSetting('showFingerHints', value === 'true')} />
          <button type="button" className="reset-link" onClick={onReset}>Reset all progress</button>
        </div>
      </div>
    </section>
  )
}

function SettingsControl({ label, description, value, options, optionLabels = {}, onChange, disabled = false }: { label: string; description: string; value: string; options: string[]; optionLabels?: Record<string, string>; onChange: (value: string) => void; disabled?: boolean }) {
  return (
    <div className={`settings-control ${disabled ? 'settings-control-disabled' : ''}`}>
      <div><strong>{label}</strong><p>{description}</p></div>
      <div className="settings-control-options">{options.map(option => <button key={option} type="button" disabled={disabled} className={option === value ? 'active' : ''} onClick={() => onChange(option)}>{optionLabels[option] ?? option}</button>)}</div>
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
  const linePrefix = lesson.format === 'java'
    ? '  private static final String DRILL = "'
    : lesson.format === 'markdown'
      ? ''
      : 'export const sample = "'
  const lineSuffix = lesson.format === 'markdown' ? '' : '";'

  const lines: ReactNode[] = lesson.format === 'java'
    ? [
        <CodeLine key="1" kind="keyword" text={`package splittyping.lessons.${lesson.course};`} />,
        <CodeLine key="2" kind="comment" text="" />,
        <CodeLine key="3" kind="declaration" text={`public final class ${classNameForLesson(lesson)} {`} />,
        <CodeLine key="4" kind="code" text="  public static void main(String[] args) {" />,
        <TypingLine key="5" prefix={linePrefix} before={before} current={current} after={after} suffix={lineSuffix} active={typingIndex < lesson.text.length} wrong={wrongKey} />,
        <CodeLine key="6" kind="code" text="  }" />,
        <CodeLine key="7" kind="code" text="}" />,
      ]
    : lesson.format === 'markdown'
      ? [
        <CodeLine key="1" kind="declaration" text={`# ${lesson.title}`} />,
        <CodeLine key="2" kind="comment" text={`> ${lesson.subtitle}`} />,
        <CodeLine key="3" kind="code" text="" />,
        <TypingLine key="4" prefix="" before={before} current={current} after={after} suffix="" active={typingIndex < lesson.text.length} wrong={wrongKey} />,
        <CodeLine key="5" kind="comment" text={`Target: ${lesson.text.length} characters`} />,
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
      language={lesson.format}
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
  keyboard,
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
  keyboard?: ResolvedKeyboard
}) {
  if (panel === 'keymap') {
    const target = activeLesson?.text[typingIndex] ?? ''
    const targetHint = renderTargetHint(target, keyboard)
    const missingCharacters = activeLesson ? missingLessonCharacters(activeLesson.text, keyboard) : []
    return (
      <div className="panel-body keymap-panel">
        <div className="panel-copy">
          <strong>{activeLesson ? activeLesson.title : 'No lesson open'}</strong>
          <p>{activeLesson ? `Lesson ${activeLessonIndex + 1}` : 'Open a lesson to start typing.'}</p>
        </div>
        <Keyboard
          keyboard={keyboard}
          target={target}
          wrong={wrongKey}
          showKeys={progress.settings.showKeyboard}
          showFingerHints={Boolean(activeLesson && progress.settings.showFingerHints)}
        />
        <div className="panel-hint">
          {finishedAttempt ? (
            <span>Lesson complete. Repeat the run to record a second pass.</span>
          ) : activeLesson ? (
            <span>{wrongKey ? <>Not <kbd>{wrongKey === ' ' ? 'Space' : wrongKey}</kbd> — {targetHint}</> : <>{targetHint}{typingErrors ? ` Mistakes: ${typingErrors}.` : ''}</>}</span>
          ) : (
            <span>F and J remain the anchors. Use the explorer to open a file.</span>
          )}
          {activeLesson?.hint ? <span className="technique-note">{activeLesson.hint}</span> : null}
          {missingCharacters.length
            ? <span className="technique-note missing-key-warning">No visual key hint for: {missingCharacters.map(character => character === ' ' ? 'Space' : character).join(' ')}</span>
            : null}
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
            ...recentOutput.filter(line => line.startsWith('[error]')),
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

function renderTargetHint(target: string, keyboard?: ResolvedKeyboard): ReactNode {
  if (target === ' ') return <>use either thumb on <kbd>Space</kbd>.</>
  const resolution = getKey(target, keyboard)
  if (!resolution) return <>type <kbd>{target}</kbd>.</>
  const keyLabel = resolution.key.legend.label ?? resolution.key.legend.base
  const modifier = resolution.modifier === 'none' ? null : resolution.modifier
  const fingers = resolution.key.position.fingers.map(finger => fingerNames[finger]).join(' or ')
  return <>{modifier ? <>hold <strong>{modifier}</strong>, then </> : null}use your <strong>{fingers}</strong> on <kbd>{keyLabel.toUpperCase()}</kbd>{keyLabel.toLocaleLowerCase() !== target.toLocaleLowerCase() ? <> for <kbd>{target}</kbd></> : null}.</>
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
  keyboard,
}: {
  activeLesson: Lesson | null
  typingIndex: number
  progress: Progress
  selectedDoc: string
  finishedAttempt: Attempt | null
  keyboard?: ResolvedKeyboard
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
        <span>{keyboard?.model.label ?? getKeyboardPreset(progress.settings.formFactor).label}</span>
        <span>{keyboard?.variant.label ?? progress.settings.standard.toUpperCase()}</span>
        <span>{keyboard?.language.label ?? progress.settings.language.toUpperCase()}</span>
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
  const editorRef = useRef<HTMLDivElement>(null)
  const scrollbarRef = useRef<HTMLDivElement>(null)
  const dragOffsetRef = useRef(0)
  const [scrollState, setScrollState] = useState({ top: 0, height: 1 })

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return

    const updateScrollState = () => {
      const maxScroll = Math.max(0, editor.scrollHeight - editor.clientHeight)
      const ratio = editor.scrollHeight > 0 ? Math.min(1, editor.clientHeight / editor.scrollHeight) : 1
      setScrollState({
        top: maxScroll > 0 ? editor.scrollTop / maxScroll : 0,
        height: ratio,
      })
    }

    updateScrollState()
    editor.addEventListener('scroll', updateScrollState, { passive: true })
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateScrollState)
    observer?.observe(editor)
    if (editor.firstElementChild) observer?.observe(editor.firstElementChild)

    return () => {
      editor.removeEventListener('scroll', updateScrollState)
      observer?.disconnect()
    }
  }, [lines.length])

  const scrollToPointer = (clientY: number, grabOffset = 0) => {
    const editor = editorRef.current
    const scrollbar = scrollbarRef.current
    if (!editor || !scrollbar) return
    const trackHeight = scrollbar.clientHeight
    const thumbHeight = trackHeight * scrollState.height
    const available = Math.max(1, trackHeight - thumbHeight)
    const trackRect = scrollbar.getBoundingClientRect()
    const position = Math.max(0, Math.min(available, clientY - trackRect.top - grabOffset))
    const maxScroll = Math.max(0, editor.scrollHeight - editor.clientHeight)
    editor.scrollTop = (position / available) * maxScroll
  }

  const handleScrollbarPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const thumbHeight = scrollbarRef.current ? scrollbarRef.current.clientHeight * scrollState.height : 0
    const target = event.target as HTMLElement
    dragOffsetRef.current = target.dataset.scrollThumb === 'true' ? event.nativeEvent.offsetY : thumbHeight / 2
    if (target.dataset.scrollThumb !== 'true') scrollToPointer(event.clientY)
    else scrollToPointer(event.clientY, dragOffsetRef.current)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleScrollbarPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      scrollToPointer(event.clientY, dragOffsetRef.current)
    }
  }

  return (
    <section className="document-frame">
      <div className="editor-grid">
        <div className="editor-gutter">
          {lines.map((_, index) => <span key={index}>{index + 1}</span>)}
        </div>
        <div className="editor-code" ref={editorRef}>
          {lines.map((line, index) => <div className="code-row" key={index}>{line}</div>)}
          {inlineContent}
        </div>
        <div className="editor-minimap">
          <div className="minimap-lines" aria-hidden="true">
            {lines.map((line, index) => <div className="minimap-line" key={index}>{line}</div>)}
          </div>
          <div
            className="minimap-viewport"
            style={{ top: `${scrollState.top * (100 - scrollState.height * 100)}%`, height: `${scrollState.height * 100}%` }}
            aria-hidden="true"
          />
        </div>
        <div
          className="editor-scrollbar"
          ref={scrollbarRef}
          role="scrollbar"
          aria-label="Editor scrollbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(scrollState.top * 100)}
          onPointerDown={handleScrollbarPointerDown}
          onPointerMove={handleScrollbarPointerMove}
        >
          <div
            className="editor-scrollbar-thumb"
            data-scroll-thumb="true"
            style={{ top: `${scrollState.top * (100 - scrollState.height * 100)}%`, height: `${scrollState.height * 100}%` }}
          />
        </div>
      </div>
      {!hideFooter && footer ? <div className="document-footer">{footer}</div> : null}
    </section>
  )
}

function CodeLine({ kind, text }: { kind: string; text: string }) {
  return <span className={`code-line ${kind}`}>{text}</span>
}

function ReadmeSplitView({ source, preview, onClose }: { source: ReactNode; preview: ReactNode; onClose: () => void }) {
  const splitRef = useRef<HTMLDivElement>(null)
  const syncing = useRef(false)

  useEffect(() => {
    const root = splitRef.current
    const sourceScroller = root?.querySelector<HTMLElement>('.editor-code')
    const previewScroller = root?.querySelector<HTMLElement>('.markdown-document')
    if (!sourceScroller || !previewScroller) return

    const syncScroll = (from: HTMLElement, to: HTMLElement) => {
      if (syncing.current) return
      const fromMax = Math.max(0, from.scrollHeight - from.clientHeight)
      const toMax = Math.max(0, to.scrollHeight - to.clientHeight)
      const ratio = fromMax > 0 ? from.scrollTop / fromMax : 0
      syncing.current = true
      to.scrollTop = ratio * toMax
      requestAnimationFrame(() => { syncing.current = false })
    }

    const onSourceScroll = () => syncScroll(sourceScroller, previewScroller)
    const onPreviewScroll = () => syncScroll(previewScroller, sourceScroller)
    sourceScroller.addEventListener('scroll', onSourceScroll, { passive: true })
    previewScroller.addEventListener('scroll', onPreviewScroll, { passive: true })

    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
      syncScroll(sourceScroller, previewScroller)
    })
    resizeObserver?.observe(sourceScroller)
    resizeObserver?.observe(previewScroller)

    return () => {
      sourceScroller.removeEventListener('scroll', onSourceScroll)
      previewScroller.removeEventListener('scroll', onPreviewScroll)
      resizeObserver?.disconnect()
    }
  }, [])

  return (
    <div className="readme-split-editor" ref={splitRef}>
      <section className="readme-pane">
        <div className="readme-pane-tabs">
          <div className="readme-pane-tab active"><FileIcon label="README.md" /><span>README.md</span><button type="button" aria-label="Close README pair" onClick={onClose}><span className="codicon codicon-close" /></button></div>
        </div>
        <div className="readme-pane-content">{source}</div>
      </section>
      <section className="readme-pane">
        <div className="readme-pane-tabs">
          <div className="readme-pane-tab active"><FileIcon label="README Preview" /><span>Preview README.md</span><button type="button" aria-label="Close README pair" onClick={onClose}><span className="codicon codicon-close" /></button></div>
        </div>
        <div className="readme-pane-content">{preview}</div>
      </section>
    </div>
  )
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
            <a href="#course-catalog">Course catalog</a>
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
            <p className="lede">SplitTyping is an accuracy-first typing trainer for normal keyboards with configurable presets and character layers.</p>
            <p>Lessons introduce keys progressively and present practice in a focused, code-inspired workspace. The goal is to build reliable muscle memory rather than chase speed at the expense of accuracy.</p>
          </section>
          <section id="getting-started" className="documentation-section">
            <h2>Getting started</h2>
            <ol>
              <li>Open Settings and choose the form factor, ANSI or ISO standard, and language that match your hardware.</li>
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
          <section id="course-catalog" className="documentation-section">
            <h2>Course catalog</h2>
            <p>Courses load at runtime from <code>public/courses/manifest.json</code>. The manifest order defines the global learning path; each listed JSON file supplies its course metadata, lessons, focus keys, ordered drill items, and optional technique hints.</p>
            <p>Invalid course files are skipped while valid courses remain available. Loading errors appear in the Output panel and browser console.</p>
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
            <p>Choose a full or compact form factor, match your physical ANSI or ISO key geometry, and select US English, UK English, or Italian legends. The selected keyboard map should match the keys you are physically using.</p>
            <p>Sound feedback, the keyboard overlay, and the left/right finger diagrams can be enabled or disabled independently from Settings.</p>
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
