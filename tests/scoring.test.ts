import { describe, expect, it } from 'vitest'
import { computeScores, computeTotals } from '../src/core/engine/scoring'
import { B_SEER, makeState, players } from './helpers'
import type { NightResult, VoteRecord } from '../src/core/types'

const roles = {
  1: 'werewolf', 2: 'werewolf', 3: 'werewolf', 4: 'werewolf',
  5: 'seer', 6: 'witch', 7: 'hunter', 8: 'idiot',
  9: 'civilian', 10: 'civilian', 11: 'civilian', 12: 'civilian',
} as const

const night = (n: number, deaths: { seat: number; cause: string }[], mistakes: string[] = []): NightResult =>
  ({ night: n, deaths: deaths.map((d) => ({ seat: d.seat, cause: d.cause, night: n })), checks: [], feared: [], goodMistakes: mistakes, sideEffects: {} })

const vote = (day: number, voter: number, target: number | null, round: 1 | 2 = 1): VoteRecord =>
  ({ day, round, voter, target })

function state(over: Parameters<typeof makeState>[1] = {}) {
  return makeState(B_SEER, { players: players(roles), winner: 'good', ...over })
}

describe('scoring 积分引擎', () => {
  it('女巫毒杀狼人 +1，毒杀好人 −1', () => {
    const s = state({
      nightActions: [
        { night: 2, role: 'witch', actorSeat: 6, kind: 'poison', targets: [2] },
      ],
      nightResults: [night(2, [{ seat: 2, cause: 'poison' }])],
    })
    const recs = computeScores(B_SEER, s)
    expect(recs.find((r) => r.seat === 6 && r.ruleId === 'witchPoisonWolf')?.value).toBe(1)

    const s2 = state({
      nightActions: [
        { night: 2, role: 'witch', actorSeat: 6, kind: 'poison', targets: [9] },
      ],
      nightResults: [night(2, [{ seat: 9, cause: 'poison' }])],
    })
    const recs2 = computeScores(B_SEER, s2)
    expect(recs2.find((r) => r.seat === 6 && r.ruleId === 'witchPoisonGood')?.value).toBe(-1)
  })

  it('守卫守中上限（山东包 +1）：三夜守中只计两次', () => {
    const guardRoles = {
      1: 'werewolf', 2: 'werewolf', 3: 'werewolf', 4: 'werewolf',
      5: 'seer', 6: 'witch', 7: 'guard', 8: 'idiot',
      9: 'civilian', 10: 'civilian', 11: 'civilian', 12: 'civilian',
    } as const
    const s = makeState(B_SEER, {
      players: players(guardRoles),
      winner: 'good',
      nightActions: [
        { night: 1, role: 'guard', actorSeat: 7, kind: 'guard', targets: [9] },
        { night: 1, role: 'werewolf', actorSeat: 1, kind: 'kill', targets: [9] },
        { night: 2, role: 'guard', actorSeat: 7, kind: 'guard', targets: [10] },
        { night: 2, role: 'werewolf', actorSeat: 1, kind: 'kill', targets: [10] },
        { night: 3, role: 'guard', actorSeat: 7, kind: 'guard', targets: [11] },
        { night: 3, role: 'werewolf', actorSeat: 1, kind: 'kill', targets: [11] },
      ],
      nightResults: [night(1, []), night(2, []), night(3, [])],
    })
    const recs = computeScores(B_SEER, s).filter((r) => r.ruleId === 'guardSave')
    expect(recs).toHaveLength(2)
    expect(recs.reduce((a, r) => a + r.value, 0)).toBe(1) // 上限 +1
  })

  it('投票命中上限（山东包 +1）', () => {
    const s = state({
      votes: [
        vote(1, 9, 1), vote(2, 9, 2), vote(3, 9, 3), // 9 号连续三日投狼
      ],
      dayResults: [
        { day: 1, exiled: 1, chainDeaths: [], tie: false },
        { day: 2, exiled: 2, chainDeaths: [], tie: false },
        { day: 3, exiled: 3, chainDeaths: [], tie: false },
      ],
    })
    const hits = computeScores(B_SEER, s).filter((r) => r.seat === 9 && r.ruleId === 'voteHit')
    expect(hits.reduce((a, r) => a + r.value, 0)).toBe(1)
  })

  it('PK 台玩家以第一次票为准（第二次票忽略）', () => {
    // day1 round1 平票：1 号与 9 号各 4 票 → PK 台 [1, 9]
    const votes: VoteRecord[] = [
      vote(1, 9, 1), vote(1, 5, 1), vote(1, 6, 1), vote(1, 7, 1),
      vote(1, 1, 9), vote(1, 2, 9), vote(1, 3, 9), vote(1, 4, 9),
      // round2：PK 台上的 9 号改投 5（好人）→ 应忽略；非台玩家按第二次票
      vote(1, 9, 5, 2), vote(1, 10, 2, 2), vote(1, 5, 2, 2), vote(1, 6, 2, 2), vote(1, 7, 2, 2),
    ]
    const s = state({
      votes,
      dayResults: [{ day: 1, exiled: 2, chainDeaths: [], tie: true }],
    })
    const recs = computeScores(B_SEER, s).filter((r) => r.seat === 9)
    // 9 号第一次投票目标 1（狼）→ +0.5；第二次投 5（好人）应被 PK 规则忽略
    expect(recs.find((r) => r.ruleId === 'voteHit')?.value).toBe(0.5)
    expect(recs.find((r) => r.ruleId === 'voteMiss')).toBeUndefined()
  })

  it('好人零失误 +1；有 goodMistake 不给', () => {
    const clean = state({ nightResults: [night(1, [{ seat: 9, cause: 'wolf' }])] })
    const recs = computeScores(B_SEER, clean).filter((r) => r.ruleId === 'goodNoMistake')
    expect(recs.find((r) => r.seat === 5)?.value).toBe(1)

    const dirty = state({ nightResults: [night(1, [{ seat: 9, cause: 'wolf' }], ['同刀同毒(9号)'])] })
    const recs2 = computeScores(B_SEER, dirty).filter((r) => r.ruleId === 'goodNoMistake')
    expect(recs2).toHaveLength(0)
  })

  it('MVP +2 / SVP +1.5 / 背锅 −1 手动录入', () => {
    const s = state()
    const recs = computeScores(B_SEER, s, { awards: { mvp: 5, svp: 1, beiguo: 2 } })
    expect(recs.find((r) => r.ruleId === 'mvp')?.value).toBe(2)
    expect(recs.find((r) => r.ruleId === 'svp')?.value).toBe(1.5)
    expect(recs.find((r) => r.ruleId === 'beiguo')?.value).toBe(-1)
  })

  it('胜负分：好人胜 +5，狼 0', () => {
    const s = state()
    const recs = computeScores(B_SEER, s)
    expect(recs.find((r) => r.seat === 5 && r.ruleId === 'win')?.value).toBe(5)
    expect(recs.find((r) => r.seat === 1 && r.ruleId === 'win')?.value).toBe(0)
  })

  it('违规扣分手动录入并计入合计', () => {
    const s = state()
    const recs = computeScores(B_SEER, s, { violations: [{ seat: 9, type: '场外', value: -0.5 }] })
    expect(recs.find((r) => r.ruleId === 'violation:场外')?.value).toBe(-0.5)
    const totals = computeTotals(recs)
    expect(totals.get(9)).toBeDefined()
  })
})
