import { describe, expect, it } from 'vitest'
import { resolveNight } from '../src/core/engine/nightResolver'
import { B_BLOOD, B_MECH, B_SEER, act, players } from './helpers'
import type { MechSkill } from '../src/core/types'

const board = B_SEER
const base = () => players({
  1: 'werewolf', 2: 'werewolf', 3: 'werewolf', 4: 'werewolf',
  5: 'seer', 6: 'witch', 7: 'hunter', 8: 'idiot',
  9: 'civilian', 10: 'civilian', 11: 'civilian', 12: 'civilian',
})

describe('resolveNight 冲突规则', () => {
  it('同守同救 → 出局且标记好人失误', () => {
    const r = resolveNight(board, base(), [
      act(1, 'werewolf', 1, 'kill', [9]),
      act(1, 'guard', 7, 'guard', [9]),
      act(1, 'witch', 6, 'save', [9]),
    ], 1)
    expect(r.result.deaths.map((d) => d.seat)).toEqual([9])
    expect(r.players.find((p) => p.seat === 9)?.deathCause).toBe('wolf')
    expect(r.result.goodMistakes.join()).toContain('同守同救')
  })

  it('守卫守中 → 不死；女巫单救 → 不死', () => {
    const guarded = resolveNight(board, base(), [
      act(1, 'werewolf', 1, 'kill', [9]),
      act(1, 'guard', 7, 'guard', [9]),
    ], 1)
    expect(guarded.result.deaths).toHaveLength(0)

    const saved = resolveNight(board, base(), [
      act(1, 'werewolf', 1, 'kill', [10]),
      act(1, 'witch', 6, 'save', [10]),
    ], 1)
    expect(saved.result.deaths).toHaveLength(0)
    expect(saved.players.find((p) => p.seat === 6)?.potions?.saveUsed).toBe(true)
  })

  it('毒杀猎魔人 → 不死且视为已用，标记好人失误', () => {
    const ps = players({
      1: 'bloodMoon', 2: 'werewolf', 3: 'werewolf', 4: 'werewolf',
      5: 'seer', 6: 'witch', 7: 'demonHunter', 8: 'idiot',
      9: 'civilian', 10: 'civilian', 11: 'civilian', 12: 'civilian',
    })
    const r = resolveNight(B_BLOOD, ps, [
      act(2, 'werewolf', 1, 'kill', [9]),
      act(2, 'witch', 6, 'poison', [7]),
    ], 2)
    expect(r.result.deaths.find((d) => d.seat === 7)).toBeUndefined()
    expect(r.result.goodMistakes.join()).toContain('毒杀猎魔人')
    expect(r.players.find((p) => p.seat === 6)?.potions?.poisonUsed).toBe(true)
  })

  it('梦游吃毒 → 梦游者不死，标记好人失误', () => {
    const ps = players({
      1: 'nightmare', 2: 'werewolf', 3: 'werewolf', 4: 'werewolf',
      5: 'seer', 6: 'witch', 7: 'hunter', 8: 'dreamWeaver',
      9: 'civilian', 10: 'civilian', 11: 'civilian', 12: 'civilian',
    })
    const r = resolveNight(board, ps, [
      act(1, 'dreamWeaver', 8, 'dream', [9]),
      act(1, 'werewolf', 2, 'kill', [10]),
      act(1, 'witch', 6, 'poison', [9]),
    ], 1)
    expect(r.result.deaths.find((d) => d.seat === 9)).toBeUndefined()
    expect(r.result.goodMistakes.join()).toContain('梦游吃毒')
  })

  it('机械狼学守卫：毒药打到守护目标 → 反弹毒死女巫', () => {
    const ps = players({
      1: 'mechWolf', 2: 'werewolf', 3: 'werewolf', 4: 'werewolf',
      5: 'medium', 6: 'witch', 7: 'hunter', 8: 'guard',
      9: 'civilian', 10: 'civilian', 11: 'civilian', 12: 'civilian',
    })
    const mech = ps.find((p) => p.seat === 1)!
    mech.mech = {
      learned: { targetSeat: 8, night: 1, skill: 'guard' as MechSkill },
      poisonUsed: false, doubleKillUsed: false, hasKnifeRight: false,
    }
    const r = resolveNight(B_MECH, ps, [
      act(2, 'mechWolf', 1, 'guard', [9]),
      act(2, 'witch', 6, 'poison', [9]),
    ], 2)
    expect(r.result.deaths.find((d) => d.seat === 6)?.cause).toBe('reflected')
    expect(r.result.deaths.find((d) => d.seat === 9)).toBeUndefined()
  })

  it('机械狼双刀（破盾刀）：目标必死', () => {
    const ps = players({
      1: 'mechWolf', 2: 'werewolf', 3: 'werewolf', 4: 'werewolf',
      5: 'medium', 6: 'witch', 7: 'hunter', 8: 'guard',
      9: 'civilian', 10: 'civilian', 11: 'civilian', 12: 'civilian',
    })
    const mech = ps.find((p) => p.seat === 1)!
    mech.mech = {
      learned: { targetSeat: 2, night: 1, skill: 'doubleKill' as MechSkill },
      poisonUsed: false, doubleKillUsed: false, hasKnifeRight: false,
    }
    const r = resolveNight(B_MECH, ps, [
      act(2, 'mechWolf', 1, 'doubleKill', [9]),
    ], 2)
    expect(r.result.deaths.find((d) => d.seat === 9)?.cause).toBe('doubleKill')
    expect(r.players.find((p) => p.seat === 1)?.mech?.doubleKillUsed).toBe(true)
  })

  it('被恐惧者当夜行动无效', () => {
    const ps = players({
      1: 'nightmare', 2: 'werewolf', 3: 'werewolf', 4: 'werewolf',
      5: 'seer', 6: 'witch', 7: 'hunter', 8: 'dreamWeaver',
      9: 'civilian', 10: 'civilian', 11: 'civilian', 12: 'civilian',
    })
    const r = resolveNight(board, ps, [
      act(1, 'nightmare', 1, 'fear', [6]),
      act(1, 'witch', 6, 'poison', [9]),
    ], 1)
    expect(r.result.deaths.find((d) => d.seat === 9)).toBeUndefined()
    expect(r.result.feared).toContain(6)
  })

  it('狼巫/纯白互相查验杀（自第二夜）', () => {
    const ps = players({
      1: 'wolfWitch', 2: 'werewolf', 3: 'werewolf', 4: 'werewolf',
      5: 'pureWhite', 6: 'witch', 7: 'hunter', 8: 'guard',
      9: 'civilian', 10: 'civilian', 11: 'civilian', 12: 'civilian',
    })
    const r = resolveNight(board, ps, [
      act(2, 'wolfWitch', 1, 'checkIdentity', [5]),
      act(2, 'pureWhite', 5, 'checkIdentity', [2]),
    ], 2)
    expect(r.result.deaths.find((d) => d.seat === 5)?.cause).toBe('check')
    expect(r.result.deaths.find((d) => d.seat === 2)?.cause).toBe('check')
  })

  it('同刀同毒 → 死亡并标记好人失误', () => {
    const r = resolveNight(board, base(), [
      act(1, 'werewolf', 1, 'kill', [9]),
      act(1, 'witch', 6, 'poison', [9]),
    ], 1)
    expect(r.result.deaths.find((d) => d.seat === 9)).toBeTruthy()
    expect(r.result.goodMistakes.join()).toContain('同刀同毒')
  })
})
