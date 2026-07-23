export type DocId = 'readme' | 'overview' | 'progress' | 'settings' | 'settings-ui' | string
export type PanelId = 'problems' | 'output' | 'terminal' | 'ports' | 'keymap'
export type ActivityView = 'explorer' | 'search' | 'source-control' | 'debug' | 'extensions'
export type WorkspaceLayout = { sidebarWidth: number; panelHeight: number }
export type SearchResult = { id: DocId; label: string; path: string; preview: string }
