/**
 * 胜负判定（纯函数）：《规则提取文档》§1.8 屠边四规则
 * 白痴翻牌（revealed）未最终出局前仍计神阵营存活
 */
import { ROLES } from '../data/roles';
import type { Player } from '../types';

export interface WinJudgeResult {
  winner: 'wolf' | 'good';
  reason: string;
}

/** 阵营存活计数（白痴翻牌未出局计神） */
export function campAlive(players: Player[]): { wolf: number; god: number; civ: number } {
  let wolf = 0; let god = 0; let civ = 0;
  for (const p of players) {
    if (!p.alive) continue;
    const role = ROLES[p.role];
    if (role.camp === 'wolf') wolf++;
    else if (role.camp === 'god') god++;
    else civ++;
  }
  return { wolf, god, civ };
}

/**
 * 规则 4：白天放逐发言开始时，狼队明确最高票数 ≥ 其他身份最高票数 → 狼人胜（拍刀）
 * maxWolfVotes/maxOtherVotes 由白天票数统计传入
 */
export function checkPaiDao(maxWolfVotes: number, maxOtherVotes: number): boolean {
  return maxWolfVotes >= maxOtherVotes;
}

/**
 * 夜间/白天结算后判定：
 * 1. 狼全灭且神、民均有存活 → 好人胜
 * 2. 同夜双方同时达成 → 狼人胜（同夜口径：一次 resolveNight 内同时达成，由调用方检测）
 * 3. 神或民任一阵营全灭且狼有存活 → 狼人胜（屠边）
 * 4. 拍刀判定单独在放逐发言前调用
 */
export function evaluateWin(players: Player[]): WinJudgeResult | null {
  const { wolf, god, civ } = campAlive(players);
  const wolvesAllOut = wolf === 0;
  const godsAllOut = god === 0;
  const civsAllOut = civ === 0;

  if (wolvesAllOut && !godsAllOut && !civsAllOut) {
    return { winner: 'good', reason: '所有狼人出局，平民与神职均有存活' };
  }
  if (wolf > 0 && (godsAllOut || civsAllOut)) {
    return {
      winner: 'wolf',
      reason: godsAllOut ? '神职阵营全部出局（屠边）' : '平民阵营全部出局（屠边）',
    };
  }
  if (wolvesAllOut && godsAllOut) {
    // 狼全灭但神也全灭：同夜双方达成 → 狼人胜
    return { winner: 'wolf', reason: '同一夜间双方同时达成胜利条件' };
  }
  if (wolvesAllOut && civsAllOut) {
    return { winner: 'wolf', reason: '同一夜间双方同时达成胜利条件' };
  }
  return null;
}
