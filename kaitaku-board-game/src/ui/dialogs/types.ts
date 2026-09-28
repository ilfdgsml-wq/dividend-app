import type { Action, PlayerId } from '../../logic/index.ts'

/** 操作を送る。成功したら true（失敗時はエラーを画面に表示済み） */
export type Dispatch = (action: Action, player: PlayerId) => boolean
