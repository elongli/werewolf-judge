import { useState } from 'react'
import { View, Text, Input, Button } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { getBoard } from '../../core/data/boards'
import { ROLES } from '../../core/data/roles'
import { initPlayers, assignRandom } from '../../core/engine/assign'
import { useGameStore } from '../../store/gameStore'
import type { Player } from '../../core/types'
import './index.css'

export default function Setup() {
  const { params } = useRouter()
  const board = getBoard(params.boardId ?? '')
  const [names, setNames] = useState<(string | undefined)[]>(Array(board?.playerCount ?? 12).fill(undefined))
  const [players, setPlayers] = useState<Player[] | null>(null)
  const [revealed, setRevealed] = useState<number | null>(null)

  if (!board) return <View className='page'><Text>版型不存在</Text></View>

  const doAssign = () => {
    const base = initPlayers(board, names)
    const assigned = assignRandom(board, base)
    setPlayers(assigned)
  }

  const begin = () => {
    if (!players) return
    useGameStore.getState().newGame(board.id)
    useGameStore.getState().assignPlayers(players)
    Taro.redirectTo({ url: '/pages/night/index' })
  }

  return (
    <View className='page'>
      <Text className='title'>{board.name}（{board.playerCount}人）</Text>
      {!players && (
        <View>
          <Text className='sub'>录入玩家（姓名可空）</Text>
          <View className='seat-list'>
            {Array.from({ length: board.playerCount }, (_, i) => i + 1).map((seat) => (
              <View key={seat} className='seat-row'>
                <Text className='seat-no'>{seat}号</Text>
                <Input
                  className='seat-input'
                  placeholder='姓名/花名（可空）'
                  value={names[seat - 1] ?? ''}
                  onInput={(e) => {
                    const next = [...names]; next[seat - 1] = e.detail.value; setNames(next)
                  }}
                />
              </View>
            ))}
          </View>
          <Button className='btn primary' onClick={() => doAssign()}>随机发身份</Button>
        </View>
      )}
      {players && (
        <View>
          <Text className='sub'>身份已发（点按查看，再点隐藏；勿让玩家看到）</Text>
          <View className='seat-list'>
            {players.map((p) => (
              <View key={p.seat} className='seat-row reveal-row' onClick={() => setRevealed(revealed === p.seat ? null : p.seat)}>
                <Text className='seat-no'>{p.seat}号</Text>
                <Text className='seat-name'>{p.name || '-'}</Text>
                <Text className={revealed === p.seat ? 'role-show' : 'role-hidden'}>
                  {revealed === p.seat ? ROLES[p.role].name : '点击查看'}
                </Text>
              </View>
            ))}
          </View>
          <Button className='btn ghost' onClick={() => setRevealed(null)}>一键全隐</Button>
          <Button className='btn primary' onClick={begin}>开始对局（进入第一夜）</Button>
        </View>
      )}
    </View>
  )
}
