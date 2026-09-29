import type { ReactNode } from 'react'
import { RESOURCES, type Resource, type ResourceCounts } from '../logic/index.ts'
import { RESOURCE_EMOJI, RESOURCE_LABEL } from './labels.ts'

/** 画面下からせり上がるダイアログ */
export function Sheet({ title, onClose, children }: { title: string; onClose?: () => void; children: ReactNode }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <h2>{title}</h2>
          {onClose && (
            <button className="icon-button" onClick={onClose} aria-label="閉じる">
              ✕
            </button>
          )}
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}

/** 資源ごとの枚数を ± で選ぶ。note で各行に補足（手持ちの枚数など）を出せる */
export function ResourceStepper({
  value,
  onChange,
  max,
  note,
  dim,
}: {
  value: ResourceCounts
  onChange: (next: ResourceCounts) => void
  max: (r: Resource) => number
  note?: (r: Resource) => ReactNode
  /** 薄く表示する行（手持ちが0枚の資源など） */
  dim?: (r: Resource) => boolean
}) {
  return (
    <div className="stepper">
      {RESOURCES.map((r) => (
        <div key={r} className={dim?.(r) ? 'stepper-row dim' : 'stepper-row'}>
          <span className="stepper-label">
            <span>
              {RESOURCE_EMOJI[r]} {RESOURCE_LABEL[r]}
            </span>
            {note && <span className="stepper-note">{note(r)}</span>}
          </span>
          <button
            className="step"
            disabled={value[r] <= 0}
            onClick={() => onChange({ ...value, [r]: value[r] - 1 })}
            aria-label={`${RESOURCE_LABEL[r]}を減らす`}
          >
            −
          </button>
          <span className="stepper-value">{value[r]}</span>
          <button
            className="step"
            disabled={value[r] >= max(r)}
            onClick={() => onChange({ ...value, [r]: value[r] + 1 })}
            aria-label={`${RESOURCE_LABEL[r]}を増やす`}
          >
            ＋
          </button>
        </div>
      ))}
    </div>
  )
}

/** 資源を1つ選ぶボタン列 */
export function ResourcePicker({
  value,
  onChange,
  disabled,
  note,
}: {
  value: Resource | null
  onChange: (r: Resource) => void
  disabled?: (r: Resource) => boolean
  note?: (r: Resource) => string
}) {
  return (
    <div className="picker">
      {RESOURCES.map((r) => (
        <button
          key={r}
          className={value === r ? 'pick selected' : 'pick'}
          disabled={disabled?.(r)}
          onClick={() => onChange(r)}
        >
          <span className="pick-emoji">{RESOURCE_EMOJI[r]}</span>
          <span className="pick-label">{RESOURCE_LABEL[r]}</span>
          {note && <span className="pick-note">{note(r)}</span>}
        </button>
      ))}
    </div>
  )
}

/** 資源の組を絵文字で並べる */
export function Counts({ value }: { value: ResourceCounts }) {
  const items = RESOURCES.filter((r) => value[r] > 0)
  if (items.length === 0) return <span className="muted">なし</span>
  return (
    <span className="counts">
      {items.map((r) => (
        <span key={r} className="count-chip">
          {RESOURCE_EMOJI[r]}
          {value[r]}
        </span>
      ))}
    </span>
  )
}
