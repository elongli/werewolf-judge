import { useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useConfigStore } from '../../store/configStore'
import { useHistoryStore } from '../../store/historyStore'
import './index.css'

export default function Home() {
  const allBoards = useConfigStore((s) => s.allBoards)()

  useEffect(() => {
    void useConfigStore.getState().hydrate()
    void useHistoryStore.getState().hydrate()
  }, [])

  const start = (boardId: string) => {
    Taro.navigateTo({ url: `/pages/setup/index?boardId=${boardId}` })
  }

  return (
    <View className='page home'>
      <Text className='title'>狼人杀法官助手</Text>
      <Text className='sub'>选择版型开始对局</Text>
      <View className='board-list'>
        {allBoards.map((b) => (
          <View key={b.id} className='board-item' onClick={() => start(b.id)}>
            <Text className='board-name'>{b.name}</Text>
            <Text className='board-meta'>{b.playerCount}人 · {b.timingPack === 'shandong' ? '手册时长' : '摩卡时长'}</Text>
          </View>
        ))}
      </View>
      <View className='nav-row'>
        <Text className='nav-link' onClick={() => Taro.navigateTo({ url: '/pages/ranking/index' })}>积分榜</Text>
        <Text className='nav-link' onClick={() => Taro.navigateTo({ url: '/pages/history/index' })}>历史对局</Text>
        <Text className='nav-link' onClick={() => Taro.navigateTo({ url: '/pages/config/index' })}>配置</Text>
      </View>
      <View className='nav-row'>
        <Text className='nav-link display' onClick={() => Taro.navigateTo({ url: '/pages/display/index' })}>投屏模式（另开窗口）</Text>
      </View>
    </View>
  )
}
