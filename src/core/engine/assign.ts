/**
 * 身份分配：随机（Fisher-Yates）或手动指定
 */
import { boardRoleList } from '../data/boards';
import type { BoardConfig, Player, RoleId } from '../types';

export function initPlayers(board: BoardConfig, names?: (string | undefined)[]): Player[] {
  const players: Player[] = [];
  for (let seat = 1; seat <= board.playerCount; seat++) {
    players.push({
      seat,
      name: names?.[seat - 1],
      role: 'civilian', // 占位，分配后覆盖
      alive: true,
      revealed: false,
      badge: false,
    });
  }
  return players;
}

/** 随机分配：返回新 players（不修改入参） */
export function assignRandom(board: BoardConfig, playersIn: Player[], rand: () => number = Math.random): Player[] {
  const roles = boardRoleList(board);
  // Fisher-Yates
  for (let i = roles.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [roles[i], roles[j]] = [roles[j], roles[i]];
  }
  return playersIn.map((p, i) => ({ ...p, role: roles[i], mech: roles[i] === 'mechWolf' ? {
    learned: false, poisonUsed: false, doubleKillUsed: false, hasKnifeRight: false,
  } as Player['mech'] : undefined, potions: roles[i] === 'witch' ? { saveUsed: false, poisonUsed: false } : undefined }));
}

/** 手动分配：seatRole[seat] = role */
export function assignManual(playersIn: Player[], seatRole: Record<number, RoleId>): Player[] {
  return playersIn.map((p) => {
    const role = seatRole[p.seat];
    if (!role) return p;
    return {
      ...p, role,
      mech: role === 'mechWolf' ? { learned: false, poisonUsed: false, doubleKillUsed: false, hasKnifeRight: false } as Player['mech'] : p.mech,
      potions: role === 'witch' ? { saveUsed: false, poisonUsed: false } : p.potions,
    };
  });
}

/** 校验手动分配与版型一致 */
export function validateAssignment(board: BoardConfig, seatRole: Record<number, RoleId>): string | null {
  const expected = boardRoleList(board).slice().sort();
  const actual = Object.values(seatRole).sort();
  if (expected.length !== actual.length) return `角色数量不符：需 ${expected.length} 个，实际 ${actual.length} 个`;
  for (let i = 0; i < expected.length; i++) {
    if (expected[i] !== actual[i]) return `角色组成不符：缺少或多出 ${expected[i]}`;
  }
  return null;
}
