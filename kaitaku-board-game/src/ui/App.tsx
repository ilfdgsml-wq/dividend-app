import { useEffect, useState } from 'react'
import { normalizeRoomCode } from '../online/protocol.ts'
import { HotseatGame } from './HotseatGame.tsx'
import { OnlineRoom } from './online/OnlineRoom.tsx'
import { StartScreen } from './StartScreen.tsx'
import { clearGame, loadGame, type SavedGame } from './storage.ts'

/** URL の ?room=コード（オンライン対戦の部屋） */
function roomFromUrl(): string | null {
  const room = new URLSearchParams(window.location.search).get('room')
  return room ? normalizeRoomCode(room) : null
}

export function App() {
  const [saved, setSaved] = useState<SavedGame | null>(() => loadGame())
  const [game, setGame] = useState<SavedGame | null>(null)
  const [room, setRoom] = useState<string | null>(roomFromUrl)

  useEffect(() => {
    const onPop = () => setRoom(roomFromUrl())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const goRoom = (roomId: string | null) => {
    const url = new URL(window.location.href)
    url.search = roomId ? `?room=${roomId}` : ''
    window.history.pushState(null, '', url)
    setRoom(roomId)
  }

  if (room) return <OnlineRoom key={room} roomId={room} onExit={() => goRoom(null)} />

  if (game) {
    return (
      <HotseatGame
        initial={game}
        onQuit={() => {
          clearGame()
          setSaved(null)
          setGame(null)
        }}
      />
    )
  }
  return <StartScreen saved={saved} onStart={setGame} onEnterRoom={goRoom} />
}
