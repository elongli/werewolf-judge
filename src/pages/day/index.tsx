import { useEffect, useRef, useState } from 'react'
import { View, Text, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useGameStore } from '../../store/gameStore'
import { useConfigStore } from '../../store/configStore'
import { TimerEngine } from '../../core/timer'
import { ANNOUNCE, tts } from '../../services/tts'
import { playSound } from '../../services/audio'
import type { VoteRecord } from '../../core/types'
import './index.css'

type Phase = 'dawn' | 'sheriff' | 'speech' | 'vote' | 'lastWords' | 'settle' | 'night'

function phaseOf(stage: unknown): Phase {
  if (typeof stage === 'string') return stage === 'settle' ? 'settle' : 'night'
  const p = (stage as { phase?: string }).phase
  return (p as Phase) ?? 'night'
}

export default function Day() {
  const state = useGameStore((s) => s.machine?.state ?? null)
  const store = useGameStore.getState()
  const speech = useConfigStore((s) => s.speech)
  const [picked, setPicked] = useState<Record<number, number | null>>({})
  const [timerSec, setTimerSec] = useState<number | null>(null)
  const timerRef = useRef<TimerEngine | null>(null)

  useEffect(() => {
    if (!state) { Taro.redirectTo({ url: '/pages/home/index' }); return }
    const ph = phaseOf(state.stage)
    if (ph === 'night') { Taro.redirectTo({ url: '/pages/night/index' }); return }
    if (ph === 'settle') { Taro.redirectTo({ url: '/pages/settle/index' }); return }
    setPicked({})
    timerRef.current?.stop(); setTimerSec(null)
  }, [state])

  useEffect(() => () => timerRef.current?.stop(), [])

  if (!state) return <View className='page day'><Text>加载中…</Text></View>

  const ph = phaseOf(state.stage)
  const day = typeof state.stage === 'object' && 'day' in state.stage ? (state.stage as { day: number }).day : 1
  const round = typeof state.stage === 'object' && 'round' in state.stage ? (state.stage as { round: 1 | 2 }).round : 1
  const alive = state.players.filter((p) => p.alive)
  const lastNight = state.nightResults[state.nightResults.length - 1]

  const runTimer = (label: string, seconds: number) => {
    timerRef.current?.stop()
    const eng = new TimerEngine([{ label, seconds, chimeAt: [speech.warnAt, 10] }], {
      onPhaseStart: (p) => { setTimerSec(p.seconds) },
      onTick: (s) => setTimerSec(s),
      onChime: (sec) => playSound(sec <= 10 ? 'warn' : 'chime'),
      onPhaseEnd: () => { playSound('bell'); setTimerSec(0) },
    })
    timerRef.current = eng
    eng.start()
  }

  const goNightOrSettle = () => {
    const s = useGameStore.getState().state
    if (!s) return
    const p = phaseOf(s.stage)
    if (p === 'night') Taro.redirectTo({ url: '/pages/night/index' })
    else if (p === 'settle') Taro.redirectTo({ url: '/pages/settle/index' })
  }

  const setVote = (voter: number, target: number | null) => {
    setPicked((prev) => ({ ...prev, [voter]: target }))
  }

  const submitVotes = () => {
    const voters = alive.map((p) => p.seat)
    const votes: VoteRecord[] = voters.map((v) => ({
      day, round, voter: v, target: picked[v] ?? null,
    }))
    store.recordVotes(votes)
    store.confirmVote()
    goNightOrSettle()
  }

  return (
    <View className='page day'>
      <Text className='stage-tag'>第 {day} 天 · {ph === 'dawn' ? '天亮' : ph === 'sheriff' ? '警长竞选' : ph === 'speech' ? '放逐发言' : ph === 'vote' ? `放逐投票${round === 2 ? '（PK）' : ''}` : '遗言'}</Text>

      {/* 天亮公告 */}
      {ph === 'dawn' && lastNight && (
        <View>
          <Text className='announce'>
            {lastNight.deaths.length === 0 ? '平安夜' : `昨夜 ${lastNight.deaths.map((d) => `${d.seat}号`).join('、')} 出局`}
          </Text>
          {lastNight.checks.length > 0 && (
            <View className='checks-box'>
              <Text className='sub'>查验结果（仅法官可见）</Text>
              {lastNight.checks.map((c, i) => <Text key={i} className='check-line'>{c.result}</Text>)}
            </View>
          )}
          <Button className='btn primary' onClick={() => { void tts.speak(ANNOUNCE.dawn(lastNight.night, lastNight.deaths.length === 0 ? '平安夜' : `${lastNight.deaths.map((d) => `${d.seat}号`).join('、')}出局`)); store.confirmDawn(); goNightOrSettle() }}>
            公布完毕，继续
          </Button>
        </View>
      )}

      {/* 警长竞选：M1 仅记录警徽归属 */}
      {ph === 'sheriff' && (
        <View>
          <Text className='sub'>警长竞选（计时 {speech.sheriff}s；M1 仅记录警徽票结果）</Text>
          <View className='timer-box'>
            <Text className='timer-num'>{timerSec !== null ? `${timerSec}s` : '--'}</Text>
            <Button className='btn small' onClick={() => runTimer('警长竞选发言', speech.sheriff)}>开始计时</Button>
          </View>
          <Text className='sub'>点选获警徽玩家：</Text>
          <View className='seat-grid'>
            {alive.map((p) => (
              <View key={p.seat} className='grid-seat' onClick={() => { store.setSheriff(p.seat); store.nextStage() }}>
                <Text>{p.seat}</Text>
              </View>
            ))}
          </View>
          <Button className='btn ghost' onClick={() => { store.setSheriff(null, true); store.nextStage() }}>警徽流失</Button>
        </View>
      )}

      {/* 放逐发言 */}
      {ph === 'speech' && (
        <View>
          <View className='timer-box'>
            <Text className='timer-num'>{timerSec !== null ? `${timerSec}s` : '--'}</Text>
            <Button className='btn small' onClick={() => runTimer('放逐发言', speech.speech)}>放逐发言 {speech.speech}s</Button>
            {' '}
            <Button className='btn small' onClick={() => runTimer('警长发言', speech.sheriffSpeech)}>警长发言 {speech.sheriffSpeech}s</Button>
          </View>
          <Text className='sub'>发言结束进入投票</Text>
          <Button className='btn primary' onClick={() => store.nextStage()}>进入投票</Button>
        </View>
      )}

      {/* 投票：逐人点选被投目标 */}
      {ph === 'vote' && (
        <View>
          <Text className='sub'>放逐投票（弃票可留空；警长票由积分引擎按规则处理）</Text>
          <View className='vote-list'>
            {alive.map((p) => (
              <View key={p.seat} className='vote-row'>
                <Text className='vote-voter'>{p.seat}号 {p.badge ? '警长' : ''} 投：</Text>
                <View className='vote-targets'>
                  <View className={picked[p.seat] === null ? 'chip picked' : 'chip'} onClick={() => setVote(p.seat, null)}><Text>弃</Text></View>
                  {alive.filter((t) => t.seat !== p.seat).map((t) => (
                    <View key={t.seat} className={picked[p.seat] === t.seat ? 'chip picked' : 'chip'} onClick={() => setVote(p.seat, t.seat)}>
                      <Text>{t.seat}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
          <Button className='btn primary' onClick={submitVotes}>确认票型，结算放逐</Button>
        </View>
      )}

      {/* 遗言 */}
      {ph === 'lastWords' && (
        <View>
          <Text className='sub'>遗言（计时 {speech.lastWords}s）</Text>
          <View className='timer-box'>
            <Text className='timer-num'>{timerSec !== null ? `${timerSec}s` : '--'}</Text>
            <Button className='btn small' onClick={() => runTimer('遗言', speech.lastWords)}>开始计时</Button>
          </View>
          <Button className='btn primary' onClick={() => { store.nextStage(); goNightOrSettle() }}>遗言结束，继续</Button>
        </View>
      )}

      <Button className='btn ghost back-btn' onClick={() => { if (store.back()) setPicked({}) }}>回退上一步</Button>
    </View>
  )
}
