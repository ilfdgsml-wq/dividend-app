import { useState } from 'react'
import { GameScreen } from './GameScreen.tsx'
import { StartScreen } from './StartScreen.tsx'
import { clearGame, loadGame, type SavedGame } from './storage.ts'

export function App() {
  const [saved, setSaved] = useState<SavedGame | null>(() => loadGame())
  const [game, setGame] = useState<SavedGame | null>(null)

  if (game) {
    return (
      <GameScreen
        initial={game}
        onQuit={() => {
          clearGame()
          setSaved(null)
          setGame(null)
        }}
      />
    )
  }
  return <StartScreen saved={saved} onStart={setGame} />
}
