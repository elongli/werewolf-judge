import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import { sync } from '../../services/sync'
import { deserialize } from '../../core/persist'
import type { GameState } from '../../core/types'
import './index.css'

/**
 * 投屏页（横屏）：只读订阅 BroadcastChannel
 * 永不显示身份信息与积分；仅阶段、倒计时（由操控端推）、存活图、票型
 */
export default function Display() {
  const [state, setState] = useState<GameState | null>(null)

  useEffect(() => {
    const off = sync.subscribe((json) => {
      const s = deserialize(json)
      if (s) setState(s)
    })
    return off
  }, [])

  if (!state) {
    return (
      <View className='display waiting'>
        <Text className='wait-title'>狼人杀 · 投屏模式</Text>
        <Text className='wait-sub'>等待操控端连接（同一浏览器另开标签页，从首页进入对局即可自动同步）</Text>
      </View>
    )
  }

  const stage = state.stage
  const phaseText = typeof stage === 'string'
    ? '准备中'
    : (({
        night: `第 ${(stage as { night: number }).night} 夜`,
        dawn: '天亮了',
        sheriff: '警长竞选',
        speech: '放逐发言',
        vote: '放逐投票',
        lastWords: '遗言',
        settle: '结算中',
      } as Record<string, string>)[(stage as { phase: string }).phase] ?? '对局进行中')

  const lastResult = state.nightResults[state.nightResults.length - 1]

  return (
    <View className='display'>
      <View className='top-bar'>
        <Text className='stage'>{phaseText}</Text>
        <Text className='day-count'>第 {state.nightResults.length} 夜</Text>
      </View>
      <View className='alive-map'>
        {state.players.map((p) => (
          <View key={p.seat} className={p.alive ? 'seat alive' : 'seat dead'}>
            <Text className='seat-no'>{p.seat}</Text>
            {p.badge && <Text className='badge'>警</Text>}
          </View>
        ))}
      </View>
      {lastResult && lastResult.deaths.length > 0 && (
        <Text className='deaths'>昨夜出局：{lastResult.deaths.map((d) => `${d.seat}号`).join('、')}</Text>
      )}
      <Text className='privacy-note'>本页面不显示身份信息</Text>
    </View>
  )
}
