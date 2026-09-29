import { useState, type ReactNode } from 'react'
import { COSTS, PIECE_LIMITS } from '../../logic/index.ts'
import { Counts, Sheet } from '../components.tsx'

export interface QuitOption {
  label: string
  /** 確認文 */
  message: string
  onQuit: () => void
}

/** children にはモードごとの項目（ホットシートの設定、オンラインの部屋情報など）を入れる */
export function MenuDialog({
  quit,
  onClose,
  children,
}: {
  quit: QuitOption
  onClose: () => void
  children?: ReactNode
}) {
  // ブラウザの confirm() は埋め込み表示などで使えないことがあるので、画面内で確認する
  const [confirmQuit, setConfirmQuit] = useState(false)
  return (
    <Sheet title="メニュー" onClose={onClose}>
      <h3>建設コスト</h3>
      <table className="costs">
        <tbody>
          <tr>
            <td>🛣️ 道</td>
            <td>
              <Counts value={COSTS.road} />
            </td>
            <td className="muted">最大{PIECE_LIMITS.road}本</td>
          </tr>
          <tr>
            <td>🏠 開拓地</td>
            <td>
              <Counts value={COSTS.settlement} />
            </td>
            <td className="muted">1点・最大{PIECE_LIMITS.settlement}</td>
          </tr>
          <tr>
            <td>🏙️ 都市</td>
            <td>
              <Counts value={COSTS.city} />
            </td>
            <td className="muted">2点・最大{PIECE_LIMITS.city}</td>
          </tr>
          <tr>
            <td>📜 発展カード</td>
            <td>
              <Counts value={COSTS.devCard} />
            </td>
            <td className="muted">山札から1枚</td>
          </tr>
        </tbody>
      </table>
      <p className="muted">
        10点先取。最長交易路（5本以上）と最大騎士力（騎士3枚以上）はそれぞれ2点。7が出たら手札8枚以上の人は半分捨てます。
      </p>

      {children}

      {confirmQuit ? (
        <div className="quit-confirm">
          <p>{quit.message}</p>
          <div className="sheet-actions">
            <button className="danger" onClick={quit.onQuit}>
              終了する
            </button>
            <button onClick={() => setConfirmQuit(false)}>続ける</button>
          </div>
        </div>
      ) : (
        <div className="sheet-actions">
          <button className="danger" onClick={() => setConfirmQuit(true)}>
            {quit.label}
          </button>
        </div>
      )}
    </Sheet>
  )
}
