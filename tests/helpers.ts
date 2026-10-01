/** 测试辅助：构造玩家/版型/对局 */
import { getBoard } from '../src/core/data/boards'
import type { BoardConfig, GameState, NightAction, Player, RoleId } from '../src/core/types'

export const B_SEER = getBoard('sd-yvnlb')!       // 预女猎白
export const B_BLOOD = getBoard('sd-xylmr')!     // 血月猎魔人
export const B_MECH = getBoard('sd-jxltls')!     // 机械狼通灵师

export function players(roleBySeat: Record<number, RoleId>): Player[] {
  return Object.entries(roleBySeat).map(([seat, role]) => ({
    seat: Number(seat),
    role,
    alive: true,
    revealed: false,
    badge: false,
    ...(role === 'mechWolf'
      ? { mech: { learned: false, poisonUsed: false, doubleKillUsed: false, hasKnifeRight: false } }
      : {}),
    ...(role === 'witch' ? { potions: { saveUsed: false, poisonUsed: false } } : {}),
  }))
}

export function act(
  night: number, role: RoleId, actorSeat: number, kind: NightAction['kind'], targets: number[],
  detail?: Record<string, unknown>,
): NightAction {
  return { night, role, actorSeat, kind, targets, ...(detail ? { detail } : {}) }
}

export function makeState(board: BoardConfig, over: Partial<GameState> = {}): GameState {
  return {
    id: 'test', boardId: board.id, stage: 'settle',
    players: [], nightActions: [], votes: [], nightResults: [], dayResults: [],
    exiledSeats: [], createdAt: 0, updatedAt: 0,
    ...over,
  } as GameState
}
