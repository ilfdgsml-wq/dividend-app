import { describe, expect, it } from 'vitest'
import { isPlayerKey, newPlayerKey, userIdFromKey } from '../src/online/identity.ts'
import { authenticateKey } from './auth.ts'

describe('プレイヤーキー', () => {
  it('キーは64文字の16進数で、毎回違う', () => {
    const a = newPlayerKey()
    expect(isPlayerKey(a)).toBe(true)
    expect(a).not.toBe(newPlayerKey())
  })

  it('ユーザーIDはキーの SHA-256（同じキーなら同じID、キーそのものとは別物）', async () => {
    const key = 'a'.repeat(64)
    const id = await userIdFromKey(key)
    expect(id).toBe('ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb')
    expect(await userIdFromKey(key)).toBe(id)
    expect(id).not.toBe(key)
  })

  it('形が正しくないキーは受け付けない', async () => {
    expect(await authenticateKey(null)).toBeNull()
    expect(await authenticateKey('short')).toBeNull()
    expect(await authenticateKey('A'.repeat(64))).toBeNull()
    expect(await authenticateKey('0'.repeat(64))).toMatch(/^[0-9a-f]{64}$/)
  })
})
