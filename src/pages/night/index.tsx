import { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useGameStore } from '../../store/gameStore'
import { TimerEngine } from '../../core/timer'
import { ROLES } from '../../core/data/roles'
import { playSound } from '../../services/audio'
import { tts } from '../../services/tts'
import type { NightAction, NightActionKind, TimerPhase } from '../../core/types'
import './index.css'

/** 每种行动需要点选的目标数；0 = 无需目标 */
const TARGETS_NEEDED: Partial<Record<NightActionKind, number>> = {
  kill: 1, emptyKill: 0, save: 1, poison: 1, guard: 1, dream: 1, fear: 1, hunt: 1,
  checkCamp: 1, checkIdentity: 1, mathCheck: 2, learn: 1, charm: 1, doubleKill: 1,
  trick: 1, confirmStatus: 0, confirmRole: 0, none: 0,
}

export default function Night() {
  // 订阅派生 state（每次变更为新对象）；machine 实例稳定，从 getState 取
  const state = useGameStore((s) => s.machine?.state ?? null)
  const machine = useGameStore.getState().machine ?? null
  const store = useGameStore.getState()
  const [remaining, setRemaining] = useState<number | null>(null)
  const [phaseLabel, setPhaseLabel] = useState('')
  const [picked, setPicked] = useState<number[]>([])
  const timerRef = useRef<TimerEngine | null>(null)

  const stage = state?.stage
  const inNight = stage && typeof stage === 'object' && 'step' in stage && (stage as { phase: string }).phase === 'night'
  const steps = useMemo(() => (machine && inNight ? machine.nightSteps() : []), [machine, state])
  const step = inNight ? steps[(stage as { step: number }).step] : undefined

  useEffect(() => {
    if (!state) { Taro.redirectTo({ url: '/pages/home/index' }); return }
    if (state.winner || (typeof state.stage === 'object' && (state.stage as { phase: string }).phase === 'settle')) {
      Taro.redirectTo({ url: '/pages/settle/index' })
      return;
    }
    if (typeof state.stage === 'object' && (state.stage as { phase: string }).phase !== 'night') {
      Taro.redirectTo({ url: '/pages/day/index' })
      return
    }
    setPicked([])
    // 换步骤时播报口令
    if (step) void tts.speak(step.announce)
  }, [state])

  useEffect(() => () => timerRef.current?.stop(), [])

  if (!state || !step || !inNight) return <View className='page night'><Text>加载中…</Text></View>

  const night = (state.stage as { night: number; step: number }).night
  const aliveSeats = state.players.filter((p) => p.alive).map((p) => p.seat)

  const startTimer = () => {
    timerRef.current?.stop()
    const eng = new TimerEngine(step.phases, {
      onPhaseStart: (p: TimerPhase) => { setPhaseLabel(p.label); setRemaining(p.seconds) },
      onTick: (sec: number) => setRemaining(sec),
      onChime: () => playSound('chime'),
      onPhaseEnd: () => playSound('bell'),
      onAllEnd: () => { playSound('end'); setRemaining(0) },
    })
    timerRef.current = eng
    eng.start()
  }
  const pauseTimer = () => timerRef.current?.pause()
  const resumeTimer = () => timerRef.current?.resume()

  const need = TARGETS_NEEDED[step.kind] ?? 0
  const toggleSeat = (seat: number) => {
    if (need === 0) return
    setPicked((prev) =>
      prev.includes(seat)
        ? prev.filter((s) => s !== seat)
        : prev.length >= need ? [...prev.slice(1), seat] : [...prev, seat],
    )
  }

  const isLast = (state.stage as { step: number }).step >= steps.length - 1

  const record = (kind: NightActionKind, targets: number[], detail?: Record<string, unknown>) => {
    const a: NightAction = {
      night, role: step.role, actorSeat: step.seats[0], kind, targets,
      ...(detail ? { detail } : {}),
    }
    store.recordNightAction(a)
    timerRef.current?.stop()
    setRemaining(null)
    if (!isLast) store.advanceNightStep()
    else store.finishNight()
    // finishNight 后进入 dawn，跳转白天页
    if (isLast) Taro.redirectTo({ url: '/pages/day/index' })
  }

  const roleName = step.role === 'werewolf' && step.seats.length > 1 ? '狼人们' : ROLES[step.role].name

  return (
    <View className='page night'>
      <Text className='stage-tag'>第 {night} 夜 · 步骤 {(state.stage as { step: number }).step + 1}/{steps.length}</Text>
      <Text className='announce'>{step.announce.replace(roleName, roleName)}</Text>
      <Text className='action-desc'>{ROLES[step.role].desc}</Text>

      <View className='timer-box'>
        <Text className='timer-label'>{phaseLabel || '点击开始计时'}</Text>
        <Text className='timer-num'>{remaining !== null ? `${remaining}s` : `--`}</Text>
        <View className='timer-btns'>
          {!timerRef.current?.isRunning && <Button className='btn small' onClick={startTimer}>开始</Button>}
          {timerRef.current?.isRunning && <Button className='btn small' onClick={pauseTimer}>暂停</Button>}
          {timerRef.current && !timerRef.current.isRunning && remaining !== null && remaining > 0 && <Button className='btn small' onClick={resumeTimer}>继续</Button>}
        </View>
      </View>

      {need > 0 && (
        <View>
          <Text className='sub'>选择目标（{need} 个，已选 {picked.length}）</Text>
          <View className='seat-grid'>
            {aliveSeats.map((seat) => (
              <View
                key={seat}
                className={picked.includes(seat) ? 'grid-seat picked' : 'grid-seat'}
                onClick={() => toggleSeat(seat)}
              >
                <Text>{seat}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <View className='record-btns'>
        {(need === 0 || picked.length === need) && step.kind !== 'kill' && (
          <Button className='btn primary' onClick={() => record(step.kind, picked)}>
            {need === 0 ? '确认（无需目标）' : `录入 ${step.kind} → ${picked.join('号、')}号`}
          </Button>
        )}
        {step.kind === 'kill' && (
          <>
            <Button className='btn primary' onClick={() => record('kill', picked)}>录入狼刀目标</Button>
            <Button className='btn ghost' onClick={() => record('emptyKill', [])}>空刀</Button>
          </>
        )}
        {step.kind === 'save' && (
          <>
            <Button className='btn primary' onClick={() => record('save', picked)}>使用解药</Button>
            <Button className='btn ghost' onClick={() => record('poison', picked)}>使用毒药（{picked.length ? `${picked[0]}号` : '先选目标'}）</Button>
            <Button className='btn ghost' onClick={() => record('none', [])}>不用药</Button>
          </>
        )}
      </View>
      <Button className='btn ghost back-btn' onClick={() => { if (store.back()) setPicked([]) }}>回退上一步</Button>
    </View>
  )
}
