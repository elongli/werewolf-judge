import { describe, expect, it } from 'vitest'
import { resolveExile, tallyVotes } from '../src/core/engine/dayResolver'
import { B_SEER, players } from './helpers'
import type { VoteRecord } from '../src/core/types'

const base = () => players({
  1: 'werewolf', 2: 'werewolf', 3: 'werewolf', 4: 'werewolf',
  5: 'seer', 6: 'witch', 7: 'hunter', 8: 'idiot',
  9: 'civilian', 10: 'civilian', 11: 'civilian', 12: 'civilian',
})

const vote = (day: number, round: 1 | 2, voter: number, target: number | null): VoteRecord =>
  ({ day, round, voter, target })

describe('dayResolver 放逐结算', () => {
  it('tallyVotes：弃票不计、平票识别', () => {
    const votes = [
      vote(1, 1, 1, 5), vote(1, 1, 2, 5), vote(1, 1, 3, 6),
      vote(1, 1, 4, 6), vote(1, 1, 5, null), vote(1, 1, 6, 5),
    ]
    const t = tallyVotes(votes, 1, 1)
    expect(t.counts.get(5)).toBe(3)
    expect(t.counts.get(6)).toBe(2)
    expect(t.abstain).toBe(1)
    expect(t.maxSeats).toEqual([5])
    expect(t.tie).toBe(false)

    const tieVotes = [vote(1, 1, 1, 5), vote(1, 1, 2, 6)]
    expect(tallyVotes(tieVotes, 1, 1).tie).toBe(true)
  })

  it('平票 → exiled=null 进入 PK', () => {
    const votes = [vote(1, 1, 1, 5), vote(1, 1, 2, 6)]
    const { result } = resolveExile(B_SEER, base(), votes, 1)
    expect(result.tie).toBe(true)
    expect(result.exiled).toBeNull()
  })

  it('放逐猎人并录枪目标 → 连锁击杀', () => {
    const ps = base()
    const votes = [vote(1, 1, 1, 7), vote(1, 1, 2, 7), vote(1, 1, 3, 7), vote(1, 1, 4, 5)]
    const { result, players: out } = resolveExile(B_SEER, ps, votes, 1, 1, { 7: 1 })
    expect(result.exiled).toBe(7)
    expect(result.chainDeaths.map((d) => d.seat)).toEqual([1])
    expect(out.find((p) => p.seat === 7)?.deathCause).toBe('exile')
    expect(out.find((p) => p.seat === 1)?.deathCause).toBe('shot')
  })

  it('放逐猎人未录枪目标 → 不开枪', () => {
    const votes = [vote(1, 1, 1, 7), vote(1, 1, 2, 7), vote(1, 1, 3, 7), vote(1, 1, 4, 5)]
    const { result } = resolveExile(B_SEER, base(), votes, 1)
    expect(result.exiled).toBe(7)
    expect(result.chainDeaths).toHaveLength(0)
  })

  it('白痴被放逐 → 翻牌不出局（无 deathCause，胜负计神存活）', () => {
    const votes = [vote(1, 1, 1, 8), vote(1, 1, 2, 8), vote(1, 1, 3, 8), vote(1, 1, 4, 5)]
    const { result, players: out } = resolveExile(B_SEER, base(), votes, 1)
    expect(result.exiled).toBe(8)
    const idiot = out.find((p) => p.seat === 8)!
    expect(idiot.alive).toBe(false)
    expect(idiot.revealed).toBe(true)
    expect(idiot.deathCause).toBeUndefined()
  })

  it('放逐狼王（放逐出局）→ 可开枪；录枪则连锁', () => {
    // 预女猎白无狼王，构造 2 号 = 狼王验证 restricted 开枪规则（放逐可开）
    const ps = base().map((p) => (p.seat === 2 ? { ...p, role: 'wolfKing' as const } : p))
    const votes = [vote(1, 1, 1, 2), vote(1, 1, 2, 2), vote(1, 1, 3, 2), vote(1, 1, 4, 2), vote(1, 1, 5, 6)]
    const { result } = resolveExile(B_SEER, ps, votes, 1, 1, { 2: 5 })
    expect(result.exiled).toBe(2)
    expect(result.chainDeaths.map((d) => d.seat)).toEqual([5])
  })

  it('血月使徒作为最后一名狼被放逐 → 不出局', () => {
    const ps = base()
    for (const p of ps) if (['werewolf'].includes(p.role) && p.seat !== 1) p.alive = false
    ps[0].role = 'bloodMoon'
    const votes = [vote(1, 1, 5, 1), vote(1, 1, 6, 1), vote(1, 1, 7, 1), vote(1, 1, 8, 9)]
    const { result, players: out } = resolveExile(B_SEER, ps, votes, 1)
    expect(result.exiled).toBeNull()
    expect(out.find((p) => p.seat === 1)?.alive).toBe(true)
  })
})
