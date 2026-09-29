import type { Action } from '../../logic/index.ts'

/** 画面を見ている人として操作を送る。成功したら true（失敗時はエラーを画面に表示済み） */
export type Dispatch = (action: Action) => Promise<boolean>
