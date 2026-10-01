import { View, Text } from '@tarojs/components'
import { rankingView, useHistoryStore } from '../../store/historyStore'
import './index.css'

export default function Ranking() {
  const totals = useHistoryStore((s) => s.totals)
  const rows = rankingView(totals)

  return (
    <View className='page'>
      <Text className='title'>累计积分榜</Text>
      {rows.length === 0 && <Text className='empty'>暂无对局记录</Text>}
      <View className='rank-list'>
        {rows.map((r, i) => (
          <View key={r.name} className={i === 0 ? 'rank-row top1' : 'rank-row'}>
            <Text className='rank-no'>{i + 1}</Text>
            <Text className='rank-name'>{r.name}</Text>
            <Text className='rank-score'>{r.total >= 0 ? '+' : ''}{r.total.toFixed(1)}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}
