import { fingerNames } from '../domain/data'
import { getKey } from '../domain/keyboardCatalog'
import type { Finger, KeyboardPosition, ResolvedKeyboard } from '../domain/types'

interface Props {
  keyboard?: ResolvedKeyboard
  target?: string
  wrong?: string
  showKeys?: boolean
  showFingerHints?: boolean
}

const UNIT = 52
const GAP = 3

function HandHint({ side, activeFingers }: { side: 'left' | 'right'; activeFingers: Set<Finger> }) {
  const codes = side === 'left'
    ? { pinky: 'LP', ring: 'LR', middle: 'LM', index: 'LI', thumb: 'LTH' } as const
    : { pinky: 'RP', ring: 'RR', middle: 'RM', index: 'RI', thumb: 'RTH' } as const
  const activeNames = Object.entries(codes)
    .filter(([, code]) => activeFingers.has(code))
    .map(([name]) => name)
  const fingerClass = (code: Finger) => `hand-finger ${activeFingers.has(code) ? 'active' : ''}`

  return <div className={`hand-hint hand-${side}`} aria-label={`${side === 'left' ? 'Left' : 'Right'} hand${activeNames.length ? `: ${activeNames.join(' and ')} active` : ''}`}>
    <svg viewBox="0 0 86 108" role="img" aria-hidden="true">
      <g transform={side === 'right' ? 'translate(86 0) scale(-1 1)' : undefined}>
        <rect className="hand-palm" x="8" y="58" width="60" height="42" rx="18" />
        <rect data-finger={codes.pinky} className={fingerClass(codes.pinky)} x="4" y="26" width="13" height="38" rx="7" />
        <rect data-finger={codes.ring} className={fingerClass(codes.ring)} x="21" y="12" width="13" height="49" rx="7" />
        <rect data-finger={codes.middle} className={fingerClass(codes.middle)} x="38" y="3" width="13" height="57" rx="7" />
        <rect data-finger={codes.index} className={fingerClass(codes.index)} x="55" y="14" width="13" height="48" rx="7" />
        <rect data-finger={codes.thumb} className={fingerClass(codes.thumb)} x="66" y="49" width="14" height="38" rx="7" transform="rotate(34 73 78)" />
      </g>
    </svg>
    <span>{side === 'left' ? 'Left' : 'Right'}</span>
  </div>
}

function pointsFor(position: KeyboardPosition) {
  return position.polygon
    ?.map(point => `${(position.x + point.x) * UNIT},${(position.y + point.y) * UNIT}`)
    .join(' ')
}

export default function Keyboard({
  keyboard,
  target = '',
  wrong = '',
  showKeys = true,
  showFingerHints = false,
}: Props) {
  const targetKey = getKey(target, keyboard)
  const wrongKey = getKey(wrong, keyboard)
  const activeFingers = new Set<Finger>()
  targetKey?.key.position.fingers.forEach(finger => activeFingers.add(finger))
  if (targetKey?.modifier === 'Shift') {
    const targetUsesLeftHand = targetKey.key.position.fingers.some(finger => finger.startsWith('L'))
    activeFingers.add(targetUsesLeftHand ? 'RP' : 'LP')
  }
  if (targetKey?.modifier === 'AltGr') activeFingers.add('RTH')

  if (!showKeys && !showFingerHints) return null

  const shiftActive = targetKey?.modifier === 'Shift'
  const altGrActive = targetKey?.modifier === 'AltGr'
  return <div className={`keyboard-coach ${showKeys ? '' : 'keyboard-coach-hands-only'}`}>
    {showFingerHints ? <HandHint side="left" activeFingers={activeFingers} /> : null}
    {showKeys ? keyboard
      ? <div
          className="keyboard keyboard-coordinate"
          aria-label={`${keyboard.model.label}, ${keyboard.variant.label}, ${keyboard.language.label} keyboard visualization`}
        >
          <svg
            className="keyboard-svg"
            viewBox={`0 0 ${keyboard.variant.width * UNIT} ${keyboard.variant.height * UNIT}`}
            role="img"
            preserveAspectRatio="xMidYMid meet"
          >
            {keyboard.positions.map(position => {
              const code = keyboard.layer.bindings[position.id]
              const legend = keyboard.language.legends[code] ?? { base: '', label: code }
              const label = legend.label ?? (legend.base === ' ' ? 'space' : legend.base)
              const secondary = legend.shift ?? (/^[a-z]$/i.test(legend.base) ? legend.base.toLocaleUpperCase() : undefined)
              const active = position.id === targetKey?.key.position.id
                || (shiftActive && (code === 'ShiftLeft' || code === 'ShiftRight'))
                || (altGrActive && code === 'AltRight')
              const isWrong = position.id === wrongKey?.key.position.id
              const x = position.x * UNIT + GAP
              const y = position.y * UNIT + GAP
              const width = position.width * UNIT - GAP * 2
              const height = position.height * UNIT - GAP * 2
              const originX = (position.rotationOriginX ?? position.x + position.width / 2) * UNIT
              const originY = (position.rotationOriginY ?? position.y + position.height / 2) * UNIT
              const transform = position.rotation ? `rotate(${position.rotation} ${originX} ${originY})` : undefined
              const title = position.fingers.map(finger => fingerNames[finger]).join(' or ')
              return <g
                key={position.id}
                data-position-id={position.id}
                data-code={code}
                data-cluster={position.cluster}
                className={`key keyboard-key finger-${position.fingers.join('-')} ${position.home ? 'home' : ''} ${active ? 'active' : ''} ${isWrong ? 'wrong' : ''}`}
                transform={transform}
              >
                <title>{title}</title>
                {position.polygon
                  ? <polygon className="key-cap" points={pointsFor(position)} />
                  : <rect className="key-cap" x={x} y={y} width={width} height={height} rx="7" />}
                <text className="key-main" x={(position.x + position.width / 2) * UNIT} y={(position.y + position.height / 2) * UNIT + 4}>{label}</text>
                {secondary && secondary !== label
                  ? <text className="key-secondary" x={(position.x + position.width) * UNIT - 8} y={position.y * UNIT + 13}>{secondary}</text>
                  : null}
                {legend.altGr
                  ? <text className="key-tertiary" x={(position.x + position.width) * UNIT - 8} y={(position.y + position.height) * UNIT - 9}>{legend.altGr}</text>
                  : null}
                {position.home
                  ? <line className="key-home-marker" x1={(position.x + position.width / 2) * UNIT - 5} x2={(position.x + position.width / 2) * UNIT + 5} y1={(position.y + position.height) * UNIT - 10} y2={(position.y + position.height) * UNIT - 10} />
                  : null}
              </g>
            })}
          </svg>
        </div>
      : <div className="keyboard-empty">Keyboard catalog unavailable</div>
    : null}
    {showFingerHints ? <HandHint side="right" activeFingers={activeFingers} /> : null}
  </div>
}
