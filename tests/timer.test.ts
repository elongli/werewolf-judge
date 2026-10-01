import { describe, expect, it } from 'vitest'
import { TimerEngine } from '../src/core/timer'

function manualDeps() {
  let nowMs = 0
  let tick: (() => void) | null = null
  return {
    now: () => nowMs,
    setTicker: (cb: () => void) => {
      tick = cb
      return { clear: () => { tick = null } }
    },
    advance: (ms: number) => { nowMs += ms; tick?.() },
    deps: undefined as never,
  }
}

describe('TimerEngine', () => {
  it('分阶段推进并触发提示音点', () => {
    let nowMs = 0
    let tick: (() => void) | null = null
    const events: string[] = []
    const eng = new TimerEngine(
      [
        { label: 'A', seconds: 10, chimeAt: [5] },
        { label: 'B', seconds: 5, chimeAt: [2] },
      ],
      {
        onPhaseStart: (p) => events.push(`start:${p.label}`),
        onChime: (s, _t, p) => events.push(`chime:${p.label}@${s}`),
        onPhaseEnd: (p) => events.push(`end:${p.label}`),
        onAllEnd: () => events.push('all'),
      },
      {
        now: () => nowMs,
        setTicker: (cb) => { tick = cb; return { clear: () => { tick = null } } },
      },
    )
    eng.start()
    expect(events).toContain('start:A')
    nowMs = 5000; tick?.()   // 剩 5s → chime A
    expect(events).toContain('chime:A@5')
    nowMs = 10000; tick?.()  // A 结束 → B 开始
    expect(events).toContain('end:A')
    expect(events).toContain('start:B')
    nowMs = 13000; tick?.()  // 剩 2s → chime B
    expect(events).toContain('chime:B@2')
    nowMs = 15000; tick?.()  // B 结束 → all
    expect(events).toContain('end:B')
    expect(events).toContain('all')
    expect(eng.isFinished).toBe(true)
  })

  it('暂停后剩余时间冻结，续播从暂停点继续', () => {
    let nowMs = 0
    let tick: (() => void) | null = null
    const eng = new TimerEngine([{ label: 'X', seconds: 10 }], {}, {
      now: () => nowMs,
      setTicker: (cb) => { tick = cb; return { clear: () => { tick = null } } },
    })
    eng.start()
    nowMs = 3000
    tick?.()
    eng.pause()
    expect(eng.remainingSec()).toBe(7)
    nowMs = 8000 // 暂停期间时间流逝不计
    expect(eng.remainingSec()).toBe(7)
    eng.resume()
    nowMs = 14000 // 续播后仅经过 6s（8000→14000），若暂停期间计时应已归零
    tick?.()
    expect(eng.remainingSec()).toBe(1)
  })
})
