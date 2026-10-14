import { describe, expect, it } from 'vitest'
import { sanitizeForDisplay } from '../src/services/sync'
import { serialize, deserialize } from '../src/core/persist'
import { B_SEER, makeState, players } from './helpers'

describe('sanitizeForDisplay 投屏载荷脱敏', () => {
  it('剥离 role/mech/potions 与查验结果，保留公开信息', () => {
    const state = makeState(B_SEER, {
      players: players({
        1: 'werewolf', 2: 'werewolf', 3: 'werewolf', 4: 'werewolf',
        5: 'seer', 6: 'witch', 7: 'hunter', 8: 'idiot',
        9: 'civilian', 10: 'civilian', 11: 'civilian', 12: 'civilian',
      }),
      nightResults: [{
        night: 1,
        deaths: [{ seat: 9, cause: 'wolf', night: 1 }],
        checks: [{ actorSeat: 5, kind: 'checkCamp', target: 1, result: '1号是狼人' }],
        feared: [],
        goodMistakes: [],
        sideEffects: {},
      }],
    })
    // 预置私密字段与死亡状态，验证剥离生效
    const dead = state.players.find((p) => p.seat === 9)!
    dead.alive = false
    const witch = state.players.find((p) => p.seat === 6)!
    witch.potions = { saveUsed: false, poisonUsed: false }
    const wolf1 = state.players.find((p) => p.seat === 1)!
    wolf1.mech = { learned: false, poisonUsed: false, doubleKillUsed: false, hasKnifeRight: true }
    const out = sanitizeForDisplay(state)
    // 身份与私密字段剥离
    for (const p of out.players) {
      expect((p as { role?: unknown }).role).toBeUndefined()
      expect((p as { mech?: unknown }).mech).toBeUndefined()
      expect((p as { potions?: unknown }).potions).toBeUndefined()
    }
    expect(out.nightResults[0].checks).toHaveLength(0)
    // 公开信息保留
    expect(out.players.map((p) => p.seat)).toEqual(state.players.map((p) => p.seat))
    expect(out.players.find((p) => p.seat === 9)?.alive).toBe(false)
    expect(out.nightResults[0].deaths[0].seat).toBe(9)
    // 脱敏后的快照仍可被投屏端反序列化
    expect(deserialize(serialize(out))).not.toBeNull()
  })
})
