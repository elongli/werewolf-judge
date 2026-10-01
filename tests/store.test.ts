/**
 * gameStore 订阅机制回归测试：
 * 页面通过 `useGameStore((s) => s.machine?.state ?? null)` 订阅派生 state。
 * 若 store 用 `set({ machine: m })`（m 为同一实例引用）而页面订阅 `s.machine`，
 * zustand 按 Object.is 比较认为选择器结果未变 → 不重渲染 → 夜间录入后卡在步骤 1/5。
 * 本测试验证：每次状态变更后，`machine.state` 均为**新对象引用**且 `stage.step` 递增，
 * 即选择器重新求值必然得到新快照，React 一定会重渲染。
 */
import { describe, expect, it, vi } from 'vitest'
import { useGameStore } from '../src/store/gameStore'
import { act, players } from './helpers'

vi.mock('../src/services/storage', () => ({
  configStorage: { get: async () => null, set: async () => {}, remove: async () => {}, keys: async () => [] },
  gameStorage: { get: async () => null, set: async () => {}, remove: async () => {}, keys: async () => [] },
  GAME_KEY_PREFIX: 'games/',
  saveGameSnapshot: async () => {},
  loadGameSnapshot: async () => null,
  listGameIds: async () => [],
}))

describe('gameStore 夜间录入不卡步骤', () => {
  it('recordNightAction + advanceNightStep 后 machine.state 是新引用且 step 递增', () => {
    const g = useGameStore.getState()
    g.newGame('sd-yvnlb')

    let m = useGameStore.getState().machine!
    m.assignPlayers(players({
      1: 'werewolf', 2: 'werewolf', 3: 'werewolf', 4: 'werewolf',
      5: 'seer', 6: 'witch', 7: 'hunter', 8: 'idiot',
      9: 'civilian', 10: 'civilian', 11: 'civilian', 12: 'civilian',
    }))

    // 页面选择器等价物：每次取 s.machine?.state
    const snap = () => useGameStore.getState().machine?.state ?? null
    const s1 = snap()!
    expect(s1.stage).toEqual({ phase: 'night', night: 1, step: 0 })

    // 录入狼刀（模拟页面 record('kill', [9]) 前两行）
    useGameStore.getState().recordNightAction(act(1, 'werewolf', 1, 'kill', [9]))
    const s2 = snap()!
    expect(s2).not.toBe(s1)                       // 新对象引用 → 选择器必然触发重渲染
    expect(s2.nightActions).toHaveLength(1)

    // 推进步骤
    useGameStore.getState().advanceNightStep()
    const s3 = snap()!
    expect(s3).not.toBe(s2)                       // 再次新引用
    expect((s3.stage as { step: number }).step).toBe(1) // 步骤 1/5 → 2/5
    expect(s3.nightActions).toHaveLength(1)
  })

  it('finishNight 后 stage 离开 night 进入 dawn', () => {
    // 反复推进到最后一夜步骤后 finishNight
    useGameStore.getState().newGame('sd-yvnlb')
    let m = useGameStore.getState().machine!
    m.assignPlayers(players({
      1: 'werewolf', 2: 'werewolf', 3: 'werewolf', 4: 'werewolf',
      5: 'seer', 6: 'witch', 7: 'hunter', 8: 'idiot',
      9: 'civilian', 10: 'civilian', 11: 'civilian', 12: 'civilian',
    }))
    const steps = m.nightSteps()
    for (const st of steps) {
      const kind = st.kind === 'kill' ? 'kill' : st.kind
      useGameStore.getState().recordNightAction(act(1, st.role, st.seats[0], kind, kind === 'none' || kind === 'emptyKill' ? [] : [9]))
      const cur = useGameStore.getState().machine!.state
      const isLast = (cur.stage as { step: number }).step >= steps.length - 1
      if (isLast) useGameStore.getState().finishNight()
      else useGameStore.getState().advanceNightStep()
    }
    const fin = useGameStore.getState().machine!.state
    expect(fin.stage).toEqual({ phase: 'dawn', night: 1 })
  })
})
