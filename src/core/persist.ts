/**
 * GameSnapshot 序列化 / 反序列化 + 版本校验
 */
import type { GameSnapshot, GameState } from './types';

export const SNAPSHOT_VERSION = '1.0.0';

export function serialize(state: GameState): string {
  const snap: GameSnapshot = { version: SNAPSHOT_VERSION, savedAt: Date.now(), state };
  return JSON.stringify(snap);
}

export function deserialize(raw: string): GameState | null {
  try {
    const snap = JSON.parse(raw) as GameSnapshot;
    if (!snap || typeof snap !== 'object' || !snap.state) return null;
    if (snap.version !== SNAPSHOT_VERSION) {
      // 版本不匹配：M1 直接拒绝（后续可加迁移器）
      return null;
    }
    return snap.state;
  } catch {
    return null;
  }
}
