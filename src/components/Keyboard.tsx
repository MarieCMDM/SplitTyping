import type { CSSProperties } from 'react'
import { fingerNames, getKey, rows } from '../domain/data'
import type { KeyboardKind, LogicalLayout } from '../domain/types'

interface Props {
  kind: KeyboardKind
  layout: LogicalLayout
  target?: string
  wrong?: string
}

function Key({
  label,
  finger,
  home,
  active,
  wrong,
  wide,
}: {
  label: string
  finger: string
  home?: boolean
  active?: boolean
  wrong?: boolean
  wide?: boolean
}) {
  return (
    <div
      className={`key finger-${finger} ${home ? 'home' : ''} ${active ? 'active' : ''} ${wrong ? 'wrong' : ''}`}
      style={{ '--key-w': wide ? 5 : 3 } as CSSProperties}
      title={fingerNames[finger]}
    >
      <span>{label === ' ' ? 'space' : label}</span>
      {home ? <i /> : null}
    </div>
  )
}

export default function Keyboard({ kind, layout, target = '', wrong = '' }: Props) {
  const targetKey = getKey(target, layout)
  const wrongKey = getKey(wrong, layout)

  if (kind === 'sofle') {
    return (
      <div className="keyboard sofle" aria-label="Sofle keyboard visualization">
        <div className="split-half left">
          {rows.slice(1).map((row, rowIndex) => (
            <div className="key-row" key={rowIndex}>
              {row.slice(0, Math.ceil(row.length / 2)).map(key => (
                <Key
                  key={key.code}
                  label={key[layout]}
                  finger={key.finger}
                  home={key.home}
                  active={key.code === targetKey?.code}
                  wrong={key.code === wrongKey?.code}
                />
              ))}
            </div>
          ))}
          <div className="thumb-row">
            <Key label="cmd" finger="LI" />
            <Key label="opt" finger="LI" />
            <Key label="space" finger="TH" wide />
          </div>
        </div>
        <div className="split-half right">
          {rows.slice(1).map((row, rowIndex) => (
            <div className="key-row" key={rowIndex}>
              {row.slice(Math.ceil(row.length / 2)).map(key => (
                <Key
                  key={key.code}
                  label={key[layout]}
                  finger={key.finger}
                  home={key.home}
                  active={key.code === targetKey?.code}
                  wrong={key.code === wrongKey?.code}
                />
              ))}
            </div>
          ))}
          <div className="thumb-row">
            <Key label="space" finger="TH" wide />
            <Key label="cmd" finger="RI" />
            <Key label="opt" finger="RI" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="keyboard standard" aria-label="Standard keyboard visualization">
      {rows.map((row, rowIndex) => (
        <div className={`key-row row-${rowIndex}`} key={rowIndex}>
          {row.map(key => (
            <Key
              key={key.code}
              label={key[layout]}
              finger={key.finger}
              home={key.home}
              active={key.code === targetKey?.code}
              wrong={key.code === wrongKey?.code}
            />
          ))}
        </div>
      ))}
      <div className="key-row space-row">
        <Key label=" " finger="TH" wide />
      </div>
    </div>
  )
}
