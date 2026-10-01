import { describe, expect, it } from 'vitest'
import { GameMachine } from '../src/core/engine/stateMachine'
import { B_SEER, act, players } from './helpers'
import type { VoteRecord } from '../src/core/types'

function fullPlayers() {
  return players({
    1: 'werewolf', 2: 'werewolf', 3: 'werewolf', 4: 'werewolf',
    5: 'seer', 6: 'witch', 7: 'hunter', 8: 'idiot',
    9: 'civilian', 10: 'civilian', 11: 'civilian', 12: 'civilian',
  })
}

const vote = (day: number, voter: number, target: number): VoteRecord =>
  ({ day, round: 1 as const, voter, target })

describe('GameMachine 完整一局（预女猎白）', () => {
  it('夜→天亮→警长→发言→投票放逐狼→…→好人胜', () => {
    const m = new GameMachine(B_SEER.id)
    m.start()
    expect(m.state.stage).toBe('assign')
    m.assignPlayers(fullPlayers())
    expect(m.state.stage).toEqual({ phase: 'night', night: 1, step: 0 })

    // 首夜唤醒序列：狼队、女巫、预言家、猎人、白痴
    const steps = m.nightSteps()
    expect(steps.length).toBeGreaterThanOrEqual(4)
    expect(steps[0].role).toBe('werewolf')
    expect(steps.some((s) => s.role === 'idiot')).toBe(true)

    // 夜1：刀 9 号
    m.recordNightAction(act(1, 'werewolf', 1, 'kill', [9]))
    const r1 = m.finishNight()
    expect(r1.deaths.map((d) => d.seat)).toEqual([9])
    expect(m.state.stage).toEqual({ phase: 'dawn', night: 1 })

    m.confirmDawn() // day1 无警长 → 警长竞选
    expect(m.state.stage).toEqual({ phase: 'sheriff', day: 1 })

    m.setSheriff(5) // 预言家当警长
    m.nextStage()    // → speech
    expect(m.state.stage).toEqual({ phase: 'speech', day: 1 })
    m.nextStage()    // → vote
    expect(m.state.stage).toEqual({ phase: 'vote', day: 1, round: 1 })

    // 投票放逐 1 号狼：8 人投 1，狼投 5
    const alive = m.state.players.filter((p) => p.alive).map((p) => p.seat)
    const votes1: VoteRecord[] = alive.map((s) => vote(1, s, s <= 4 ? 5 : 1))
    m.recordVotes(votes1)
    const dr1 = m.confirmVote()
    expect(dr1.exiled).toBe(1)
    expect(m.state.stage).toEqual({ phase: 'lastWords', day: 1 })

    m.nextStage() // 遗言完 → 夜2
    expect(m.state.stage).toEqual({ phase: 'night', night: 2, step: 0 })

    // 夜2：刀 10；毒狼 2（女巫）
    m.recordNightAction(act(2, 'werewolf', 2, 'kill', [10]))
    m.recordNightAction(act(2, 'witch', 6, 'poison', [2]))
    const r2 = m.finishNight()
    expect(r2.deaths.map((d) => d.seat).sort((a, b) => a - b)).toEqual([2, 10])
    m.confirmDawn() // day2：已有警长 → speech
    expect(m.state.stage).toEqual({ phase: 'speech', day: 2 })
    m.nextStage()
    // 投票放逐 3 号
    const alive2 = m.state.players.filter((p) => p.alive).map((p) => p.seat)
    m.recordVotes(alive2.map((s) => vote(2, s, s <= 4 && s !== 2 ? 6 : 3)))
    const dr2 = m.confirmVote()
    expect(dr2.exiled).toBe(3)
    m.nextStage()

    // 夜3：刀 11
    m.recordNightAction(act(3, 'werewolf', 4, 'kill', [11]))
    m.finishNight()
    m.confirmDawn()
    m.nextStage() // speech→vote
    const alive3 = m.state.players.filter((p) => p.alive).map((p) => p.seat)
    m.recordVotes(alive3.map((s) => vote(3, s, s === 4 ? 6 : 4)))
    const dr3 = m.confirmVote()
    expect(dr3.exiled).toBe(4)
    // 狼全灭 → 好人胜（confirmVote 内判定）
    expect(m.state.stage).toEqual({ phase: 'settle' })
    expect(m.state.winner).toBe('good')
  })

  it('back 回退上一步', () => {
    const m = new GameMachine(B_SEER.id)
    m.start()
    m.assignPlayers(fullPlayers())
    const stageBefore = JSON.stringify(m.state.stage)
    m.recordNightAction(act(1, 'werewolf', 1, 'kill', [9]))
    expect(m.back()).toBe(true)
    expect(JSON.stringify(m.state.stage)).toBe(stageBefore)
    expect(m.state.nightActions).toHaveLength(0)
  })

  it('fromSnapshot 恢复', () => {
    const m = new GameMachine(B_SEER.id)
    m.start()
    m.assignPlayers(fullPlayers())
    const json = m.snapshotJson()
    const m2 = GameMachine.fromSnapshot(json)
    expect(m2).not.toBeNull()
    expect(m2!.state.id).toBe(m.state.id)
    expect(m2!.state.players).toHaveLength(12)
  })
})
