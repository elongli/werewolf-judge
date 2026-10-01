import { View, Text, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useHistoryStore } from '../../store/historyStore'
import { downloadJson, downloadImage, renderShareImage } from '../../services/share'
import { ROLES } from '../../core/data/roles'
import './index.css'

export default function History() {
  const history = useHistoryStore((s) => s.history)

  const exportAll = () => {
    downloadJson('werewolf-history.json', JSON.stringify(useHistoryStore.getState().history, null, 2))
  }

  const shareImage = async (id: string) => {
    const g = history.find((x) => x.id === id)
    if (!g) return
    const rows: { seat: number; name?: string; role: string; total: number }[] = []
    const perSeat = new Map<number, number>()
    for (const r of g.scores) perSeat.set(r.seat, (perSeat.get(r.seat) ?? 0) + r.value)
    for (const p of g.players) {
      rows.push({ seat: p.seat, name: p.name, role: g.scores.find((s) => s.seat === p.seat)?.reason ? '' : '', total: perSeat.get(p.seat) ?? 0 })
    }
    const url = await renderShareImage({
      title: g.boardName,
      subtitle: `${g.winner === 'wolf' ? '狼人胜利' : '好人胜利'} · ${new Date(g.finishedAt).toLocaleDateString()}`,
      rows: rows.map((r) => ({ ...r, role: '' })),
    })
    if (url) downloadImage(url, `werewolf-${id}.png`)
  }

  return (
    <View className='page'>
      <Text className='title'>历史对局</Text>
      {history.length === 0 && <Text className='empty'>暂无历史</Text>}
      <View className='h-list'>
        {history.map((g) => (
          <View key={g.id} className='h-item'>
            <Text className='h-title'>{g.boardName} · {g.winner === 'wolf' ? '狼人胜' : '好人胜'}</Text>
            <Text className='h-meta'>{new Date(g.finishedAt).toLocaleString()} · {g.winReason}</Text>
            <View className='h-btns'>
              <Button className='btn tiny' onClick={() => void shareImage(g.id)}>分享图</Button>
            </View>
          </View>
        ))}
      </View>
      <Button className='btn ghost' onClick={exportAll}>导出全部 JSON</Button>
      <Button className='btn ghost' onClick={() => Taro.redirectTo({ url: '/pages/home/index' })}>返回</Button>
      <Text className='note'>身份仅在分享图导出时由你手动核对；投屏页永不显示身份</Text>
      <Text className='note2'>{ROLES.werewolf.name}等角色信息不进入历史广播流</Text>
    </View>
  )
}
