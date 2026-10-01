import { describe, expect, it } from 'vitest'
import { campAlive, evaluateWin } from '../src/core/engine/winJudge'
import { players } from './helpers'

const ok = (r: ReturnType<typeof evaluateWin> | null): r is { winner: 'wolf' | 'good'; reason: string } => r !== null

describe('evaluateWin 屠边四规则', () => {
  it('狼全灭且神民均有存活 → 好人胜', () => {
    const ps = players({
      1: 'werewolf', 2: 'seer', 3: 'witch', 4: 'hunter', 5: 'idiot',
      6: 'civilian', 7: 'civilian', 8: 'civilian', 9: 'civilian', 10: 'civilian', 11: 'civilian', 12: 'civilian',
    })
    ps[0].alive = false
    const r = evaluateWin(ps)
    expect(ok(r) && r.winner).toBe('good')
  })

  it('神职全灭且狼存活 → 狼胜（屠边）', () => {
    const ps = players({
      1: 'werewolf', 2: 'seer', 3: 'witch', 4: 'hunter', 5: 'idiot',
      6: 'civilian', 7: 'civilian', 8: 'civilian', 9: 'civilian', 10: 'civilian', 11: 'civilian', 12: 'civilian',
    })
    for (const p of ps) if (['seer', 'witch', 'hunter', 'idiot'].includes(p.role)) p.alive = false
    const r = evaluateWin(ps)
    expect(ok(r) && r.winner).toBe('wolf')
  })

  it('平民全灭且狼存活 → 狼胜（屠边）', () => {
    const ps = players({
      1: 'werewolf', 2: 'seer', 3: 'witch', 4: 'hunter', 5: 'idiot',
      6: 'civilian', 7: 'civilian', 8: 'civilian', 9: 'civilian', 10: 'civilian', 11: 'civilian', 12: 'civilian',
    })
    for (const p of ps) if (p.role === 'civilian') p.alive = false
    const r = evaluateWin(ps)
    expect(ok(r) && r.winner).toBe('wolf')
  })

  it('同夜双达成（狼全灭且神全灭）→ 狼胜', () => {
    const ps = players({
      1: 'werewolf', 2: 'seer', 3: 'witch', 4: 'hunter', 5: 'idiot',
      6: 'civilian', 7: 'civilian', 8: 'civilian', 9: 'civilian', 10: 'civilian', 11: 'civilian', 12: 'civilian',
    })
    ps[0].alive = false
    for (const p of ps) if (['seer', 'witch', 'hunter', 'idiot'].includes(p.role)) p.alive = false
    const r = evaluateWin(ps)
    expect(ok(r) && r.winner).toBe('wolf')
  })

  it('未分胜负返回 null', () => {
    const ps = players({
      1: 'werewolf', 2: 'werewolf', 3: 'seer', 4: 'witch', 5: 'hunter', 6: 'idiot',
      7: 'civilian', 8: 'civilian', 9: 'civilian', 10: 'civilian', 11: 'civilian', 12: 'civilian',
    })
    expect(evaluateWin(ps)).toBeNull()
  })

  it('campAlive 统计三个阵营', () => {
    const ps = players({ 1: 'werewolf', 2: 'seer', 3: 'civilian' })
    expect(campAlive(ps)).toEqual({ wolf: 1, god: 1, civ: 1 })
  })
})
