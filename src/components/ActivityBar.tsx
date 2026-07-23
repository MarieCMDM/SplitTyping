import type { ActivityView } from '../app/types'

interface Props {
  activeView: ActivityView
  onViewChange: (view: ActivityView) => void
  onRunDebug: () => void
}

type ActivityAction = {
  view: ActivityView
  label: string
  icon: string
}

const actions: ActivityAction[] = [
  { view: 'explorer', label: 'Explorer', icon: 'codicon-files' },
  { view: 'search', label: 'Search', icon: 'codicon-search' },
  { view: 'source-control', label: 'Source control', icon: 'codicon-source-control' },
  { view: 'extensions', label: 'Extensions', icon: 'codicon-extensions' },
]

export default function ActivityBar({ activeView, onViewChange, onRunDebug }: Props) {
  return (
    <nav className="activity-bar" aria-label="Activity bar">
      {actions.slice(0, 3).map(action => <ActivityBarButton key={action.view} {...action} active={activeView === action.view} onClick={() => onViewChange(action.view)} />)}
      <ActivityBarButton view="debug" label="Run and debug" icon="codicon-run-all" active={activeView === 'debug'} onClick={onRunDebug} title="Open next typing lesson" />
      <ActivityBarButton key={actions[3].view} {...actions[3]} active={activeView === actions[3].view} onClick={() => onViewChange(actions[3].view)} />
    </nav>
  )
}

function ActivityBarButton({ label, icon, active, onClick, title }: ActivityAction & { active: boolean; onClick: () => void; title?: string }) {
  return <button type="button" className={active ? 'active' : ''} aria-label={label} title={title} onClick={onClick}><span className={`codicon ${icon}`} /></button>
}
