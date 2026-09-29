// オンライン対戦で覚えておくこと（名前・最後に入った部屋）。保存できない環境でも動くようにする

const NAME_KEY = 'kaitaku-board-game/online-name'
const ROOM_KEY = 'kaitaku-board-game/last-room'

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // 何もしない
  }
}

export const loadName = () => read(NAME_KEY) ?? ''
export const saveName = (name: string) => write(NAME_KEY, name)
export const loadLastRoom = () => read(ROOM_KEY)
export const saveLastRoom = (roomId: string | null) => write(ROOM_KEY, roomId)

/** 部屋に招待するURL */
export function roomUrl(roomId: string): string {
  const url = new URL(window.location.href)
  url.search = `?room=${roomId}`
  url.hash = ''
  return url.toString()
}
