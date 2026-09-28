import { COSTS, PIECE_LIMITS } from '../../logic/index.ts'
import { Counts, Sheet } from '../components.tsx'
import type { Settings } from '../storage.ts'

export function MenuDialog({
  settings,
  onChangeSettings,
  onQuit,
  onClose,
}: {
  settings: Settings
  onChangeSettings: (s: Settings) => void
  onQuit: () => void
  onClose: () => void
}) {
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

      <h3>設定</h3>
      <label className="toggle">
        <input
          type="checkbox"
          checked={settings.privacy}
          onChange={(e) => onChangeSettings({ ...settings, privacy: e.target.checked })}
        />
        手番交代時に「端末を渡す」画面を出す（手札を隠す）
      </label>

      <div className="sheet-actions">
        <button
          className="danger"
          onClick={() => {
            if (window.confirm('このゲームを終了してタイトルに戻りますか？（進行中のデータは消えます）')) onQuit()
          }}
        >
          ゲームをやめる
        </button>
      </div>
    </Sheet>
  )
}
