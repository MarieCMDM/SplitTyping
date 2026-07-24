import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { lessonFileName } from '../app/helpers'
import type { DocId } from '../app/types'
import type { Lesson, Progress } from '../domain/types'

interface Props {
  markdown: string
  progress: Progress
  next?: Lesson
  activeLessonId: string | null
  onOpenLesson: (id: DocId) => void
  onOpenProgress: () => void
  onOpenSettings: () => void
  onStart: () => void
}

export default function ReadmePreview({
  markdown,
  progress,
  next,
  activeLessonId,
  onOpenLesson,
  onOpenProgress,
  onOpenSettings,
  onStart,
}: Props) {
  const liveValues: Record<string, string> = {
    '#splittyping-keyboard': progress.settings.formFactor,
    '#splittyping-layout': `${progress.settings.standard.toUpperCase()} · ${progress.settings.language.toUpperCase()}`,
    '#splittyping-attempts': String(progress.attempts.length),
    '#splittyping-active-lesson': activeLessonId ?? 'none',
  }

  const actions: Record<string, () => void> = {
    '#splittyping-start': onStart,
    '#splittyping-open-lesson': () => onOpenLesson(next ? next.id : 'progress'),
    '#splittyping-progress': onOpenProgress,
    '#splittyping-settings': onOpenSettings,
  }

  return (
    <section className="markdown-document">
      <article className="markdown-content readme-rendered">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ href = '', children, ...props }) => {
              if (href in liveValues) return <code className="readme-live-value">{liveValues[href]}</code>
              if (href === '#splittyping-next-lesson') {
                const label = next ? `${next.courseTitle} / ${lessonFileName(next)}` : 'No unlocked lesson yet'
                return <button type="button" className="readme-inline-action" onClick={() => onOpenLesson(next ? next.id : 'progress')}>{label}</button>
              }
              if (href in actions) return <button type="button" className="readme-inline-action" onClick={actions[href]}>{children}</button>
              const external = /^https?:\/\//.test(href)
              return <a href={href} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined} {...props}>{children}</a>
            },
          }}
        >
          {markdown}
        </ReactMarkdown>
      </article>
    </section>
  )
}
