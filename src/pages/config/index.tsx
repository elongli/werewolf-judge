import { View, Text, Input } from '@tarojs/components'
import { useConfigStore } from '../../store/configStore'
import { BOARDS } from '../../core/data/boards'
import { ROLES } from '../../core/data/roles'
import './index.css'

const FIELDS: { key: 'sheriff' | 'speech' | 'sheriffSpeech' | 'lastWords' | 'warnAt'; label: string }[] = [
  { key: 'sheriff', label: '警长竞选发言' },
  { key: 'speech', label: '放逐发言' },
  { key: 'sheriffSpeech', label: '警长发言' },
  { key: 'lastWords', label: '遗言' },
  { key: 'warnAt', label: '剩余提示（秒）' },
]

export default function Config() {
  const speech = useConfigStore((s) => s.speech)
  const setSpeech = useConfigStore((s) => s.setSpeech)

  return (
    <View className='page'>
      <Text className='title'>规则配置</Text>

      <Text className='sec'>发言时长（默认 90/90/120/90，剩 30s 提示）</Text>
      <View className='cfg-list'>
        {FIELDS.map((f) => (
          <View key={f.key} className='cfg-row'>
            <Text className='cfg-label'>{f.label}</Text>
            <Input
              className='cfg-input'
              type='number'
              value={String(speech[f.key])}
              onInput={(e) => {
                const v = parseInt(e.detail.value, 10)
                if (!Number.isNaN(v) && v > 0) setSpeech({ [f.key]: v })
              }}
            />
            <Text className='cfg-unit'>秒</Text>
          </View>
        ))}
      </View>

      <Text className='sec'>内置版型（{BOARDS.length} 个）</Text>
      <View className='board-mini-list'>
        {BOARDS.map((b) => (
          <View key={b.id} className='board-mini'>
            <Text className='b-name'>{b.name}</Text>
            <Text className='b-meta'>{b.seats.map((s) => `${ROLES[s.role].name}×${s.count}`).join(' ')}</Text>
          </View>
        ))}
      </View>

      <Text className='note'>夜间时长随版型自带（手册 90/45 或摩卡 60/30），角色级调整在后续版本开放。</Text>
    </View>
  )
}
