import type { Attempt, Lesson, Progress } from '../../domain/types'
import { lessonFileName, lessonPath } from '../../app/helpers'
import type { DocId } from '../../app/types'

interface Props {
  activeLesson: Lesson | null
  lessons: Lesson[]
  progress: Progress
  commitMessage: string
  onCommit: () => void
  onCommitMessage: (message: string) => void
  onOpenDoc: (id: DocId) => void
}

export default function SourceControl({ activeLesson, lessons, progress, commitMessage, onCommit, onCommitMessage, onOpenDoc }: Props) {
  const commits = [...progress.attempts].reverse()
  const changes = activeLesson
    ? [{ id: activeLesson.id, name: lessonFileName(activeLesson), path: lessonPath(activeLesson), status: 'M' }]
    : [
      { id: 'readme', name: 'README.md', path: 'SplitTyping', status: 'M' },
      { id: 'progress', name: 'progress.json', path: 'SplitTyping', status: 'M' },
      { id: 'settings', name: 'settings.json', path: 'SplitTyping/.vscode', status: 'U' },
    ]
  const history = commits.length
    ? commits.map(attempt => {
      const lesson = lessons.find(item => item.id === attempt.lessonId)
      return { hash: gitHash(attempt), title: lesson ? lessonFileName(lesson) : attempt.lessonId, detail: `${attempt.accuracy}% accuracy / ${attempt.wpm} wpm` }
    })
    : [
      { hash: 'a8f1b32', title: 'Fix keyboard navigation and lesson flow', detail: 'SplitTyping' },
      { hash: 'c4e19a0', title: 'Refine source control workspace styling', detail: 'SplitTyping' },
      { hash: '7b2d6f1', title: 'Add split keyboard configuration links', detail: 'SplitTyping' },
      { hash: '31ab8ce', title: 'Improve typing metrics and progress', detail: 'SplitTyping' },
      { hash: '9d42e7a', title: 'Initial SplitTyping workspace', detail: 'SplitTyping' },
    ]
  return (
    <div className="source-control-view">
      <div className="explorer-head"><span>SOURCE CONTROL</span><button type="button" className="ghost">...</button></div>
      <section className="git-repository">
        <div className="git-repository-head"><span className="codicon codicon-chevron-down" /><span className="codicon codicon-source-control git-repository-icon" /><strong>SplitTyping</strong><span className="git-branch-label"><span className="codicon codicon-git-branch" /> main*</span><div className="git-repository-actions"><button type="button" aria-label="Refresh source control"><span className="codicon codicon-refresh" /></button><button type="button" aria-label="More source control actions">...</button></div></div>
        <div className="git-message-wrap"><input aria-label="Commit message" value={commitMessage} onChange={event => onCommitMessage(event.target.value)} onKeyDown={event => { if (event.ctrlKey && event.key === 'Enter') onCommit() }} placeholder="Message (Ctrl+Enter to commit on 'main')" /><span className="codicon codicon-sparkle" /></div>
        <button type="button" className="git-commit-button" onClick={onCommit} disabled={!commitMessage.trim()}><span className="codicon codicon-check" /> Commit <span className="codicon codicon-chevron-down" /></button>
      </section>
      <section className="git-section git-changes">
        <div className="git-section-title"><span><span className="codicon codicon-chevron-down" /> Changes</span><b>{changes.length}</b></div>
        {changes.map(change => <button type="button" className="git-file modified" key={change.id} onClick={() => onOpenDoc(change.id)}><span className="codicon codicon-file-code" /><span className="git-file-name">{change.name}</span><small>{change.path}</small><b>{change.status}</b></button>)}
      </section>
      <section className="git-section git-history">
        <div className="git-section-title"><span><span className="codicon codicon-chevron-down" /> COMMITS</span><b>{commits.length || history.length}</b></div>
        {commits.length ? commits.map(attempt => { const lesson = lessons.find(item => item.id === attempt.lessonId); return <div className="git-commit" key={`${attempt.date}-${attempt.lessonId}`}><span className="git-node" /><div><strong>{gitHash(attempt)}</strong> <span>{lesson ? lessonFileName(lesson) : attempt.lessonId}</span><small>{attempt.accuracy}% accuracy · {attempt.wpm} wpm</small></div></div> }) : <p className="git-empty">No commits yet</p>}
      </section>
      <section className="git-section git-branches"><div className="git-section-title"><span><span className="codicon codicon-chevron-down" /> BRANCHES</span><b>1</b></div><div className="git-branch"><span className="codicon codicon-git-branch" /> main <span className="git-branch-badge">main</span></div></section>
    </div>
  )
}

function gitHash(attempt: Attempt) {
  let hash = 7
  for (const character of `${attempt.lessonId}:${attempt.date}:${attempt.accuracy}:${attempt.wpm}`) hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  return hash.toString(16).padStart(7, '0').slice(0, 7)
}
