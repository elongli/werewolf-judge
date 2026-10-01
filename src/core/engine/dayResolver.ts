/**
 * 白天结算：票型统计、放逐、出局技能连锁（技能结算 > 遗言 > 警徽移交）、
 * 白痴翻牌、骑士决斗、警徽移交
 * 依据《规则提取文档》§1.3
 */
import { ROLES } from '../data/roles';
import type { BoardConfig, DayResult, Player, VoteRecord } from '../types';

export interface TallyResult {
  counts: Map<number, number>;
  abstain: number;
  maxSeats: number[];
  tie: boolean;
}

/** 统计票型（弃票不计入任何目标） */
export function tallyVotes(votes: VoteRecord[], day: number, round: 1 | 2): TallyResult {
  const counts = new Map<number, number>();
  let abstain = 0;
  for (const v of votes) {
    if (v.day !== day || v.round !== round || v.sheriffVote) continue;
    if (v.target === null) { abstain++; continue; }
    counts.set(v.target, (counts.get(v.target) ?? 0) + 1);
  }
  const max = Math.max(0, ...counts.values());
  const maxSeats = [...counts.entries()].filter(([, n]) => n === max && max > 0).map(([s]) => s);
  return { counts, abstain, maxSeats, tie: maxSeats.length > 1 };
}

/** 可否开枪：猎人 onDeath（毒/梦亡/反弹不可）；狼王 restricted（毒/梦亡/自爆不可） */
export function canShoot(p: Player): boolean {
  if (!p.alive) return false; // 出局结算时由调用方传入「即将出局」的快照，此函数针对连锁中的存活者
  const rule = ROLES[p.role].shotRule;
  if (!rule) return false;
  const bad = ['poison', 'dream', 'reflected'];
  if (bad.includes(p.deathCause ?? '')) return false;
  return true;
}

/**
 * 放逐结算：
 * - 平票 → tie=true, exiled=null（进入 PK）
 * - 白痴被放逐 → 翻牌：revealed=true、alive=false、不设 deathCause（视作神阵营存活）
 * - 血月使徒是最后一名狼被放逐 → 不出局（exiled=null，由状态机标记再入夜）
 * - 出局技能连锁：猎人/狼王开枪，链式处理（防死循环）
 */
export function resolveExile(
  _board: BoardConfig,
  playersIn: Player[],
  votes: VoteRecord[],
  day: number,
  round: 1 | 2 = 1,
  /** 法官录入的开枪目标：shooterSeat → 目标座位（出局者/连锁者可开枪时） */
  shots?: Record<number, number | undefined>,
): { result: DayResult; players: Player[] } {
  const players = playersIn.map((p) => ({ ...p }));
  const bySeat = (s: number) => players.find((p) => p.seat === s);
  const tally = tallyVotes(votes, day, round);

  const base: DayResult = { day, exiled: null, chainDeaths: [], tie: tally.tie };
  if (tally.tie || tally.maxSeats.length === 0) return { result: base, players };

  const seat = tally.maxSeats[0];
  const p = bySeat(seat);
  if (!p) return { result: base, players };

  // 白痴翻牌
  if (p.role === 'idiot') {
    p.alive = false;
    p.revealed = true;
    // 不设 deathCause：翻牌白痴在胜负判定中计神阵营存活
    return { result: { ...base, exiled: seat, chainDeaths: [] }, players };
  }
  // 血月使徒作为最后一名狼被放逐 → 不直接出局
  const otherWolvesAlive = players.some(
    (x) => x.alive && x.seat !== seat && ROLES[x.role].camp === 'wolf',
  );
  if (p.role === 'bloodMoon' && !otherWolvesAlive) {
    return { result: { ...base, exiled: null }, players }; // 状态机标记再入夜
  }

  // 正常放逐出局
  p.alive = false;
  p.deathCause = 'exile';
  p.deathAt = { day };
  p.revealed = true;
  base.exiled = seat;

  // 技能连锁：出局者若是可开枪角色（cause=exile 允许）
  const chainDeaths: DayResult['chainDeaths'] = [];
  const shotChain = (shooter: number) => {
    const seen = new Set<number>([shooter]);
    let current = shooter;
    for (let guard = 0; guard < 12; guard++) {
      const sp = bySeat(current);
      const role = sp ? ROLES[sp.role] : undefined;
      if (!sp || !role?.shotRule) break;
      const mechShot = sp.mech?.learned !== false && sp.mech?.learned?.skill === 'shot';
      const canOpen =
        (role.shotRule === 'onDeath' && !['poison', 'dream', 'reflected'].includes(sp.deathCause ?? '')) ||
        (role.shotRule === 'restricted' && sp.deathCause === 'exile') ||
        mechShot;
      if (!canOpen) break;
      const target = shots?.[current];
      if (target === undefined) break; // 法官未录枪目标 → 不开枪
      if (seen.has(target)) break;
      seen.add(target);
      const tp = bySeat(target);
      if (!tp || !tp.alive) break;
      tp.alive = false;
      tp.deathCause = 'shot';
      tp.deathAt = { day };
      chainDeaths.push({ seat: target, cause: 'shot', day });
      current = target; // 目标若也是猎人/狼王则连锁
    }
  };
  shotChain(seat);

  base.chainDeaths = chainDeaths;
  return { result: base, players };
}

/**
 * 骑士决斗（摩卡杯白天翻牌）：
 * 决斗狼人 → 狼出局；决斗好人 → 骑士出局。双方 revealed=true。
 */
export function duel(
  playersIn: Player[],
  knightSeat: number,
  targetSeat: number,
): { players: Player[]; death: { seat: number; cause: string } | null } {
  const players = playersIn.map((p) => ({ ...p }));
  const knight = players.find((p) => p.seat === knightSeat);
  const target = players.find((p) => p.seat === targetSeat);
  if (!knight || !target) return { players, death: null };
  knight.revealed = true;
  target.revealed = true;
  if (ROLES[target.role].camp === 'wolf') {
    target.alive = false;
    target.deathCause = 'duel';
    return { players, death: { seat: targetSeat, cause: 'duel' } };
  }
  knight.alive = false;
  knight.deathCause = 'duel';
  return { players, death: { seat: knightSeat, cause: 'duel' } };
}

/** 警徽移交 / 流失（toSeat=null 且 lost=true 表示撕警徽/流失） */
export function transferBadge(
  playersIn: Player[],
  fromSeat: number,
  toSeat: number | null,
): Player[] {
  const players = playersIn.map((p) => ({ ...p }));
  const from = players.find((p) => p.seat === fromSeat);
  const to = toSeat !== null ? players.find((p) => p.seat === toSeat) : undefined;
  if (from) from.badge = false;
  if (to) to.badge = true;
  return players;
}
