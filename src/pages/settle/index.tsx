import { useEffect, useMemo, useState } from 'react'
import { View, Text, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useGameStore } from '../../store/gameStore'
import { useHistoryStore } from '../../store/historyStore'
import { getBoard } from '../../core/data/boards'
import { ROLES } from '../../core/data/roles'
import { computeScores } from '../../core/engine/scoring'
import type { AwardInput, ScoreRecord, ViolationInput } from '../../core/types'
import { downloadJson } from '../../services/share'
import './index.css'

export default function Settle() {
  const state = useGameStore((s) => s.machine?.state ?? null)
  const [awards, setAwards] = useState<AwardInput>({})
  const [violations, setViolations] = useState<ViolationInput[]>([])

  const board = state ? getBoard(state.boardId) : undefined

  const scores: ScoreRecord[] = useMemo(() => {
    if (!state || !board) return []
    return computeScores(board, state, { awards, violations })
  }, [state, board, awards, violations])

  useEffect(() => {
    if (!state) Taro.redirectTo({ url: '/pages/home/index' })
  }, [state])

  if (!state || !board) return <View className='page'><Text>无对局</Text></View>

  const alive = state.players.filter((p) => p.alive)
  const totals = new Map<number, number>()
  for (const r of scores) totals.set(r.seat, (totals.get(r.seat) ?? 0) + r.value)

  const save = () => {
    useHistoryStore.getState().addFinished({
      id: state.id, boardId: state.boardId, boardName: board.name,
      winner: state.winner ?? 'good', winReason: state.winReason ?? '',
      finishedAt: Date.now(),
      players: state.players.map((p) => ({ seat: p.seat, name: p.name })),
      scores,
    })
    Taro.showToast({ title: '已存入历史', icon: 'success' })
  }

  const exportJson = () => {
    downloadJson(`werewolf-${state.id}.json`, JSON.stringify({ state, scores }, null, 2))
  }

  const setAward = (k: keyof AwardInput, seat: number | undefined) => {
    setAwards((a) => ({ ...a, [k]: seat }))
  }

  const addViolation = (seat: number, value: number, type: string) => {
    setViolations((v) => [...v, { seat, type, value }])
  }

  return (
    <View className='page settle'>
      <Text className='announce'>{state.winner === 'wolf' ? '狼人阵营胜利' : '好人阵营胜利'}</Text>
      <Text className='sub'>{state.winReason}</Text>

      <Text className='sec'>积分明细（逐项，可回看）</Text>
      <View className='scores-box'>
        {scores.map((r, i) => (
          <Text key={i} className='score-line'>{r.seat}号 [{r.ruleId}] {r.value >= 0 ? '+' : ''}{r.value}（{r.reason}）</Text>
        ))}
        {scores.length === 0 && <Text className='score-line'>无记录</Text>}
      </View>

      <Text className='sec'>评选（法官手动录入）</Text>
      <View className='award-grid'>
        {(['mvp', 'svp', 'beiguo'] as const).map((k) => (
          <View key={k} className='award-row'>
            <Text className='award-label'>{k === 'mvp' ? 'MVP(+2)' : k === 'svp' ? 'SVP(+1.5)' : '背锅(-1)'}</Text>
            <View className='chips'>
              {state.players.map((p) => (
                <View key={p.seat} className={awards[k] === p.seat ? 'chip picked' : 'chip'} onClick={() => setAward(k, awards[k] === p.seat ? undefined : p.seat)}>
                  <Text>{p.seat}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>

      <Text className='sec'>违规扣分（手动）</Text>
      <View className='violation-list'>
        {state.players.map((p) => (
          <View key={p.seat} className='violation-row'>
            <Text className='v-seat'>{p.seat}号</Text>
            <Button className='btn tiny' onClick={() => addViolation(p.seat, -0.5, '轻微违规')}>-0.5</Button>
            <Button className='btn tiny' onClick={() => addViolation(p.seat, -1, '违规')}>-1</Button>
            <Button className='btn tiny' onClick={() => addViolation(p.seat, -3, '严重违规')}>-3</Button>
          </View>
        ))}
      </View>

      <Text className='sec'>单局合计</Text>
      <View className='scores-box'>
        {[...totals.entries()].sort((a, b) => b[1] - a[1]).map(([seat, total]) => (
          <Text key={seat} className='score-line total'>{seat}号 {state.players[seat - 1]?.name || ''}：{total >= 0 ? '+' : ''}{total.toFixed(1)}</Text>
        ))}
      </View>

      <Button className='btn primary' onClick={save}>存入历史（累计积分）</Button>
      <Button className='btn ghost' onClick={exportJson}>导出 JSON</Button>
      <Button className='btn ghost' onClick={() => Taro.redirectTo({ url: '/pages/home/index' })}>返回首页</Button>
      <Text className='alive-note'>存活：{alive.map((p) => `${p.seat}号${ROLES[p.role].name}`).join('、')}</Text>
    </View>
  )
}
