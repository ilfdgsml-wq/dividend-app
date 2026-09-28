import type { GameState } from '../../logic/index.ts'
import { TOPOLOGY, pips } from '../../logic/index.ts'
import { TERRAIN_COLOR, TERRAIN_EMOJI, TERRAIN_LABEL, portLabel } from '../labels.ts'
import {
  EDGE_ENDS,
  HEX_CENTER,
  HEX_POINTS,
  S,
  SEA_POINTS,
  VERTEX_POS,
  VIEW_BOX,
  portMarker,
  type Point,
} from './geometry.ts'

export type TargetKind = 'vertex' | 'edge' | 'hex'

export interface Targets {
  kind: TargetKind
  ids: number[]
}

export interface Selection {
  kind: TargetKind
  id: number
}

interface Props {
  state: GameState
  targets: Targets | null
  selected: Selection | null
  onSelect: (sel: Selection) => void
  /** 直前の出目（産出したタイルを光らせる） */
  rolled: number | null
}

export function BoardSvg({ state, targets, selected, onSelect, rolled }: Props) {
  const color = (p: number) => state.players[p].color
  const isSelected = (kind: TargetKind, id: number) => selected?.kind === kind && selected.id === id

  return (
    <svg className="board" viewBox={VIEW_BOX} role="img" aria-label="盤面">
      <polygon points={SEA_POINTS} className="sea" />

      {state.ports.map((port) => {
        const m = portMarker(port.edge)
        const [a, b] = EDGE_ENDS[port.edge]
        return (
          <g key={port.edge} className="port">
            <line x1={m.x} y1={m.y} x2={a.x} y2={a.y} />
            <line x1={m.x} y1={m.y} x2={b.x} y2={b.y} />
            <circle cx={m.x} cy={m.y} r={0.34 * S} />
            <text x={m.x} y={m.y} dy="0.35em" fontSize={port.kind === 'any' ? 0.26 * S : 0.22 * S}>
              {portLabel(port.kind)}
            </text>
          </g>
        )
      })}

      {TOPOLOGY.hexes.map((hex) => {
        const tile = state.tiles[hex.id]
        const c = HEX_CENTER[hex.id]
        const red = tile.number === 6 || tile.number === 8
        const produced = rolled !== null && tile.number === rolled && state.robber !== hex.id
        return (
          <g key={hex.id} className={produced ? 'tile produced' : 'tile'}>
            <polygon points={HEX_POINTS[hex.id]} fill={TERRAIN_COLOR[tile.terrain]}>
              <title>{TERRAIN_LABEL[tile.terrain]}</title>
            </polygon>
            <text x={c.x} y={c.y - 0.52 * S} dy="0.35em" fontSize={0.36 * S} className="terrain-emoji">
              {TERRAIN_EMOJI[tile.terrain]}
            </text>
            {tile.number !== null && (
              <g className="token">
                <circle cx={c.x} cy={c.y + 0.08 * S} r={0.3 * S} />
                <text
                  x={c.x}
                  y={c.y + 0.03 * S}
                  dy="0.35em"
                  fontSize={0.3 * S}
                  className={red ? 'number red' : 'number'}
                >
                  {tile.number}
                </text>
                <Pips center={{ x: c.x, y: c.y + 0.26 * S }} count={pips(tile.number)} red={red} />
              </g>
            )}
            {state.robber === hex.id && <Robber at={{ x: c.x - 0.52 * S, y: c.y + 0.12 * S }} />}
          </g>
        )
      })}

      {state.roads.map((owner, e) => {
        if (owner === null) return null
        const [a, b] = shorten(EDGE_ENDS[e], 0.14 * S)
        return (
          <g key={e} className="road">
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="road-outline" />
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color(owner)} className="road-fill" />
          </g>
        )
      })}

      {state.buildings.map((b, v) =>
        b === null ? null : <Building key={v} at={VERTEX_POS[v]} city={b.kind === 'city'} fill={color(b.owner)} />,
      )}

      {targets?.kind === 'hex' &&
        targets.ids.map((id) => (
          <polygon
            key={`h${id}`}
            points={HEX_POINTS[id]}
            className={isSelected('hex', id) ? 'target hex selected' : 'target hex'}
            onClick={() => onSelect({ kind: 'hex', id })}
          />
        ))}

      {targets?.kind === 'edge' &&
        targets.ids.map((id) => {
          const [a, b] = shorten(EDGE_ENDS[id], 0.2 * S)
          return (
            <g
              key={`e${id}`}
              className={isSelected('edge', id) ? 'target edge selected' : 'target edge'}
              onClick={() => onSelect({ kind: 'edge', id })}
            >
              <polygon points={band(a, b, 0.2 * S)} className="hit" />
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="mark" />
            </g>
          )
        })}

      {targets?.kind === 'vertex' &&
        targets.ids.map((id) => {
          const p = VERTEX_POS[id]
          return (
            <g
              key={`v${id}`}
              className={isSelected('vertex', id) ? 'target vertex selected' : 'target vertex'}
              onClick={() => onSelect({ kind: 'vertex', id })}
            >
              <circle cx={p.x} cy={p.y} r={0.42 * S} className="hit" />
              <circle cx={p.x} cy={p.y} r={0.17 * S} className="mark" />
            </g>
          )
        })}
    </svg>
  )
}

function shorten([a, b]: [Point, Point], by: number): [Point, Point] {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy)
  const k = by / len
  return [
    { x: a.x + dx * k, y: a.y + dy * k },
    { x: b.x - dx * k, y: b.y - dy * k },
  ]
}

/** 辺に沿った帯（タップ判定用） */
function band(a: Point, b: Point, halfWidth: number): string {
  const len = Math.hypot(b.x - a.x, b.y - a.y)
  const nx = (-(b.y - a.y) / len) * halfWidth
  const ny = ((b.x - a.x) / len) * halfWidth
  return [
    [a.x + nx, a.y + ny],
    [b.x + nx, b.y + ny],
    [b.x - nx, b.y - ny],
    [a.x - nx, a.y - ny],
  ]
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ')
}

function Pips({ center, count, red }: { center: Point; count: number; red: boolean }) {
  const gap = 0.07 * S
  return (
    <g className={red ? 'pips red' : 'pips'}>
      {Array.from({ length: count }, (_, i) => (
        <circle key={i} cx={center.x + (i - (count - 1) / 2) * gap} cy={center.y} r={0.022 * S} />
      ))}
    </g>
  )
}

function Robber({ at }: { at: Point }) {
  const k = S / 100
  return (
    <g className="robber" transform={`translate(${at.x} ${at.y}) scale(${k})`}>
      <ellipse cx={0} cy={20} rx={17} ry={6} />
      <path d="M -13 20 Q -14 -6 0 -8 Q 14 -6 13 20 Z" />
      <circle cx={0} cy={-15} r={10} />
    </g>
  )
}

function Building({ at, city, fill }: { at: Point; city: boolean; fill: string }) {
  const k = S / 100
  // 開拓地 = 家、都市 = 家＋塔
  const d = city
    ? 'M -26 16 L -26 -6 L -10 -6 L -10 -22 L 3 -34 L 16 -22 L 16 -6 L 26 -6 L 26 16 Z'
    : 'M -16 14 L -16 -6 L 0 -20 L 16 -6 L 16 14 Z'
  return (
    <g className="building" transform={`translate(${at.x} ${at.y}) scale(${k})`}>
      <path d={d} fill={fill} />
    </g>
  )
}
