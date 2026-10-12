import { describe, expect, it } from 'vitest'
import { GameMachine } from '../src/core/engine/stateMachine'
import { B_BLOOD, B_SEER, act, players } from './helpers'
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

describe('GameMachine 血月使徒再入夜（血月猎魔人版型）', () => {
  function bloodPlayers() {
    return players({
      1: 'bloodMoon', 2: 'werewolf', 3: 'werewolf', 4: 'werewolf',
      5: 'seer', 6: 'witch', 7: 'demonHunter', 8: 'idiot',
      9: 'civilian', 10: 'civilian', 11: 'civilian', 12: 'civilian',
    })
  }

  /** 白天流程：竞选(仅第1天)→发言→投票放逐 target */
  function exileDay(m: GameMachine, day: number, target: number) {
    m.confirmDawn()
    if (day === 1) {
      m.setSheriff(5)
      m.nextStage() // sheriff → speech
    }
    m.nextStage() // speech → vote
    const alive = m.state.players.filter((p) => p.alive).map((p) => p.seat)
    // 狼队互保投 5，其余好人全投 target
    m.recordVotes(alive.map((s) => vote(day, s, s <= 4 && s !== target ? 5 : target)))
    return m.confirmVote()
  }

  it('最后狼为血月：放逐豁免 → 次夜与刀目标同死', () => {
    const m = new GameMachine(B_BLOOD.id)
    m.start()
    m.assignPlayers(bloodPlayers())

    // 夜1：刀 9；白天放逐狼 2
    m.recordNightAction(act(1, 'werewolf', 1, 'kill', [9]))
    m.finishNight()
    exileDay(m, 1, 2)
    expect(m.state.dayResults[0].exiled).toBe(2)
    m.nextStage() // 遗言 → 夜2

    // 夜2：刀 10；白天放逐狼 3
    m.recordNightAction(act(2, 'werewolf', 1, 'kill', [10]))
    m.finishNight()
    exileDay(m, 2, 3)
    m.nextStage()

    // 夜3：刀 11；白天放逐狼 4
    m.recordNightAction(act(3, 'werewolf', 1, 'kill', [11]))
    m.finishNight()
    exileDay(m, 3, 4)
    m.nextStage()

    // 夜4：刀 8（留 12 号平民，避免天亮时屠边直接判负）；白天放逐血月 1（最后狼）→ 豁免不出局
    m.recordNightAction(act(4, 'werewolf', 1, 'kill', [8]))
    m.finishNight()
    const dr4 = exileDay(m, 4, 1)
    expect(dr4.exiled).toBeNull()
    expect(dr4.bloodMoonReprieved).toBe(1)
    expect(m.state.players.find((p) => p.seat === 1)?.alive).toBe(true)
    expect(m.state.bloodMoonPending).toEqual({ night: 5, seat: 1 })
    expect(m.state.stage).toEqual({ phase: 'night', night: 5, step: 0 })

    // 夜5：血月刀 6 → 结算时血月与 6 号同死（6 号死因为狼刀）
    m.recordNightAction(act(5, 'werewolf', 1, 'kill', [6]))
    const r5 = m.finishNight()
    expect(r5.deaths.find((d) => d.seat === 1)?.cause).toBe('bloodMoon')
    expect(r5.deaths.find((d) => d.seat === 6)?.cause).toBe('wolf')
    expect(m.state.bloodMoonPending).toBeUndefined() // 只生效一夜
    expect(m.state.players.find((p) => p.seat === 1)?.alive).toBe(false)
  })
})

describe('GameMachine 骑士决斗 / 狼人自爆 / 警徽移交', () => {
  function knightPlayers() {
    return players({
      1: 'werewolf', 2: 'werewolf', 3: 'werewolf', 4: 'werewolf',
      5: 'seer', 6: 'witch', 7: 'knight', 8: 'idiot',
      9: 'civilian', 10: 'civilian', 11: 'civilian', 12: 'civilian',
    })
  }

  /** 走到第 1 天发言阶段（夜1 刀 killTarget → 天亮 → 警长 → 发言） */
  function toSpeech(m: GameMachine, killTarget: number) {
    m.recordNightAction(act(1, 'werewolf', 1, 'kill', [killTarget]))
    m.finishNight()
    m.confirmDawn()
    m.setSheriff(5)
    m.nextStage() // sheriff → speech
  }

  it('骑士决斗狼人 → 狼出局，直接入夜', () => {
    const m = new GameMachine(B_SEER.id)
    m.start()
    m.assignPlayers(knightPlayers())
    toSpeech(m, 9)
    m.knightDuel(7, 1)
    expect(m.state.players.find((p) => p.seat === 1)?.deathCause).toBe('duel')
    expect(m.state.players.find((p) => p.seat === 7)?.revealed).toBe(true)
    expect(m.state.stage).toEqual({ phase: 'night', night: 2, step: 0 })
  })

  it('骑士决斗好人 → 骑士出局，流程留在发言阶段', () => {
    const m = new GameMachine(B_SEER.id)
    m.start()
    m.assignPlayers(knightPlayers())
    toSpeech(m, 9)
    m.knightDuel(7, 5)
    expect(m.state.players.find((p) => p.seat === 7)?.deathCause).toBe('duel')
    expect(m.state.players.find((p) => p.seat === 5)?.alive).toBe(true)
    expect(m.state.stage).toEqual({ phase: 'speech', day: 1 })
  })

  it('狼人自爆 → 出局并直接入夜', () => {
    const m = new GameMachine(B_SEER.id)
    m.start()
    m.assignPlayers(knightPlayers())
    toSpeech(m, 9)
    m.selfExplode(2)
    expect(m.state.players.find((p) => p.seat === 2)?.deathCause).toBe('suicide')
    expect(m.state.stage).toEqual({ phase: 'night', night: 2, step: 0 })
  })

  it('血月自爆 → 封印次夜神技（女巫救人失效），结算后清除', () => {
    const m = new GameMachine(B_BLOOD.id)
    m.start()
    m.assignPlayers(players({
      1: 'bloodMoon', 2: 'werewolf', 3: 'werewolf', 4: 'werewolf',
      5: 'seer', 6: 'witch', 7: 'demonHunter', 8: 'idiot',
      9: 'civilian', 10: 'civilian', 11: 'civilian', 12: 'civilian',
    }))
    toSpeech(m, 9)
    m.selfExplode(1)
    expect(m.state.godsSealedNight).toBe(2)
    expect(m.state.stage).toEqual({ phase: 'night', night: 2, step: 0 })
    m.recordNightAction(act(2, 'witch', 6, 'save', [10]))
    m.recordNightAction(act(2, 'werewolf', 2, 'kill', [10]))
    const r2 = m.finishNight()
    expect(r2.deaths.find((d) => d.seat === 10)?.cause).toBe('wolf') // 救人被封无效
    expect(m.state.godsSealedNight).toBeUndefined()
  })

  it('警徽移交：警长存活时拒绝；出局后可移交', () => {
    const m = new GameMachine(B_SEER.id)
    m.start()
    m.assignPlayers(knightPlayers())
    toSpeech(m, 9)
    m.transferSheriff(6) // 5 号存活 → 拒绝
    expect(m.state.sheriff).toBe(5)
    m.nextStage() // speech → vote
    const alive = m.state.players.filter((p) => p.alive).map((p) => p.seat)
    m.recordVotes(alive.map((s) => vote(1, s, s <= 4 && s !== 2 ? 5 : 2)))
    m.confirmVote() // 放逐 2 → 遗言
    m.nextStage() // → 夜2
    m.recordNightAction(act(2, 'werewolf', 1, 'kill', [5]))
    m.finishNight()
    m.confirmDawn()
    m.transferSheriff(6)
    expect(m.state.sheriff).toBe(6)
    expect(m.state.players.find((p) => p.seat === 6)?.badge).toBe(true)
    expect(m.state.players.find((p) => p.seat === 5)?.badge).toBe(false)
  })
})
