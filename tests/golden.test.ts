/**
 * Golden 积分验收：对照《规则提取文档》§5 数值（山东/手册分值包）
 * 场景1：守卫守中上限 +1（§5.2）
 * 场景2：女巫毒杀狼人 +1、预言家警徽 +0.5 / 首日放逐狼 +0.5（§5.2）
 * 场景3：投票命中上限 +1、胜负分 +5、MVP +2、好人零失误 +1（§5.1/5.3/5.4）
 */
import { describe, expect, it } from 'vitest'
import { computeScores, computeTotals } from '../src/core/engine/scoring'
import { B_SEER, act, makeState, players } from './helpers'
import type { NightResult, VoteRecord } from '../src/core/types'

const roles = {
  1: 'werewolf', 2: 'werewolf', 3: 'werewolf', 4: 'werewolf',
  5: 'seer', 6: 'witch', 7: 'hunter', 8: 'idiot',
  9: 'civilian', 10: 'civilian', 11: 'civilian', 12: 'civilian',
} as const

const guardRoles = {
  1: 'werewolf', 2: 'werewolf', 3: 'werewolf', 4: 'werewolf',
  5: 'seer', 6: 'witch', 7: 'guard', 8: 'idiot',
  9: 'civilian', 10: 'civilian', 11: 'civilian', 12: 'civilian',
} as const

const night = (n: number, deaths: { seat: number; cause: string }[]): NightResult =>
  ({ night: n, deaths: deaths.map((d) => ({ seat: d.seat, cause: d.cause, night: n })), checks: [], feared: [], goodMistakes: [], sideEffects: {} })

const vote = (day: number, voter: number, target: number | null): VoteRecord =>
  ({ day, round: 1 as const, voter, target })

describe('golden 积分验收（规则文档 §5）', () => {
  it('场景1：守卫三夜守中，计 2 次 +0.5，上限 +1；合计含胜负分/零失误', () => {
    const s = makeState(B_SEER, {
      players: players(guardRoles),
      winner: 'good',
      nightActions: [
        act(1, 'werewolf', 1, 'kill', [9]), act(1, 'guard', 7, 'guard', [9]),
        act(2, 'werewolf', 1, 'kill', [10]), act(2, 'guard', 7, 'guard', [10]),
        act(3, 'werewolf', 1, 'kill', [11]), act(3, 'guard', 7, 'guard', [11]),
      ],
      nightResults: [night(1, []), night(2, []), night(3, [])],
    })
    const recs = computeScores(B_SEER, s)
    const saves = recs.filter((r) => r.seat === 7 && r.ruleId === 'guardSave')
    expect(saves).toHaveLength(2)                     // §5.2 上限 +1 → 只计两次
    expect(saves.reduce((a, r) => a + r.value, 0)).toBe(1)
    const totals = computeTotals(recs)
    // 7号 = 胜负分5 + 守中1 + 好人零失误1
    expect(totals.get(7)).toBe(7)
  })

  it('场景2：女巫毒狼 +1；预言家警徽 +0.5、首日放逐狼 +0.5', () => {
    const s = makeState(B_SEER, {
      players: players(roles),
      winner: 'good',
      sheriff: 5,
      nightActions: [
        act(1, 'seer', 5, 'checkCamp', [1]),
        act(2, 'seer', 5, 'checkCamp', [4]),
        act(2, 'witch', 6, 'poison', [2]),
      ],
      nightResults: [night(1, []), night(2, [{ seat: 2, cause: 'poison' }])],
      votes: [vote(1, 7, 3), vote(1, 9, 3)],
      dayResults: [{ day: 1, exiled: 3, chainDeaths: [], tie: false }],
    })
    const recs = computeScores(B_SEER, s)
    expect(recs.find((r) => r.seat === 6 && r.ruleId === 'witchPoisonWolf')?.value).toBe(1)
    expect(recs.find((r) => r.seat === 5 && r.ruleId === 'badge')?.value).toBe(0.5)
    expect(recs.find((r) => r.seat === 5 && r.ruleId === 'day1WolfOut')?.value).toBe(0.5)
    const totals = computeTotals(recs)
    // 5号 = 5 + 0.5 + 0.5 + 零失误1 = 7；6号 = 5 + 毒狼1 + 零失误1 = 7
    expect(totals.get(5)).toBe(7)
    expect(totals.get(6)).toBe(7)
  })

  it('场景3：四日连续投狼命中封顶 +1；MVP +2；狼失败 0 分', () => {
    const s = makeState(B_SEER, {
      players: players(roles),
      winner: 'good',
      nightActions: [],
      nightResults: [night(1, [{ seat: 11, cause: 'wolf' }])],
      votes: [vote(1, 9, 1), vote(2, 9, 2), vote(3, 9, 3), vote(4, 9, 4)],
      dayResults: [
        { day: 1, exiled: 1, chainDeaths: [], tie: false },
        { day: 2, exiled: 2, chainDeaths: [], tie: false },
        { day: 3, exiled: 3, chainDeaths: [], tie: false },
        { day: 4, exiled: 4, chainDeaths: [], tie: false },
      ],
    })
    const recs = computeScores(B_SEER, s, { awards: { mvp: 9 } })
    const hits = recs.filter((r) => r.seat === 9 && r.ruleId === 'voteHit')
    expect(hits.reduce((a, r) => a + r.value, 0)).toBe(1)   // §5.3 上限 +1
    const totals = computeTotals(recs)
    // 9号 = 胜负5 + 命中1 + 零失误1 + MVP2 = 9（§5.1/5.3/5.4）
    expect(totals.get(9)).toBe(9)
    // 狼失败阵营 0 分（§5.1）
    for (const seat of [1, 2, 3, 4]) expect(totals.get(seat)).toBe(0)
  })
})
