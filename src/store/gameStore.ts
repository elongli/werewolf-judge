/**
 * 当前对局 store：包装 GameMachine，持久化副作用 + 投屏广播
 */
import { create } from 'zustand';
import { GameMachine } from '../core/engine/stateMachine';
import { serialize } from '../core/persist';
import { saveGameSnapshot } from '../services/storage';
import { broadcastState } from '../services/sync';
import type { AwardInput, GameState, NightAction, Player, ViolationInput, VoteRecord } from '../core/types';

interface GameStoreState {
  machine: GameMachine | null;
  boardId: string | null;
  get state(): GameState | null;
  newGame(boardId: string): void;
  resumeGame(rawSnapshot: string): boolean;
  assignPlayers(players: Player[]): void;
  recordNightAction(a: NightAction): void;
  /** 夜间步骤推进（step+1；超出步骤数则停留等待 finishNight） */
  advanceNightStep(): void;
  finishNight(): void;
  confirmDawn(): void;
  recordVotes(votes: VoteRecord[]): void;
  confirmVote(): void;
  setSheriff(seat: number | null, lost?: boolean): void;
  /** 阶段推进（sheriff→speech、lastWords→下一夜/结算等非结算性推进） */
  nextStage(): void;
  back(): boolean;
  /** 结算积分（settle 页用） */
  settleScores(scores: import('../core/types').ScoreRecord[]): void;
  lastScores: import('../core/types').ScoreRecord[] | null;
}

/** 防抖保存 + 广播 */
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function persistAndBroadcast(m: GameMachine): void {
  const json = serialize(m.state);
  broadcastState(json);
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { void saveGameSnapshot(m.state.id, json); }, 300);
}

export const useGameStore = create<GameStoreState>((set, get) => {
  /**
   * 先通知 UI 再跑副作用：广播/持久化即使抛错也绝不阻断对局推进
   * （否则出现「机器状态已前进、页面却停在原步骤」的假卡死）
   */
  const commit = (m: GameMachine): void => {
    set({ machine: m });
    try { persistAndBroadcast(m); } catch { /* 忽略广播/存储异常 */ }
  };

  return {
  machine: null,
  boardId: null,
  lastScores: null,
  get state() { return get().machine?.state ?? null; },

  newGame(boardId: string) {
    const m = new GameMachine(boardId);
    set({ machine: m, boardId, lastScores: null });
    try { persistAndBroadcast(m); } catch { /* ignore */ }
  },

  resumeGame(rawSnapshot: string) {
    const m = GameMachine.fromSnapshot(rawSnapshot);
    if (!m) return false;
    set({ machine: m, boardId: m.state.boardId, lastScores: null });
    try { persistAndBroadcast(m); } catch { /* ignore */ }
    return true;
  },

  assignPlayers(players) {
    const m = get().machine;
    if (!m) return;
    m.assignPlayers(players);
    commit(m);
  },

  recordNightAction(a) {
    const m = get().machine;
    if (!m) return;
    m.recordNightAction(a);
    commit(m);
  },

  advanceNightStep() {
    const m = get().machine;
    if (!m) return;
    m.advanceNightStep();
    commit(m);
  },

  finishNight() {
    const m = get().machine;
    if (!m) return;
    m.finishNight();
    commit(m);
  },

  confirmDawn() {
    const m = get().machine;
    if (!m) return;
    m.confirmDawn();
    commit(m);
  },

  recordVotes(votes) {
    const m = get().machine;
    if (!m) return;
    m.recordVotes(votes);
    commit(m);
  },

  confirmVote() {
    const m = get().machine;
    if (!m) return;
    m.confirmVote();
    commit(m);
  },

  setSheriff(seat, lost) {
    const m = get().machine;
    if (!m) return;
    m.setSheriff(seat, lost);
    commit(m);
  },

  nextStage() {
    const m = get().machine;
    if (!m) return;
    m.nextStage();
    commit(m);
  },

  back() {
    const m = get().machine;
    if (!m) return false;
    const ok = m.back();
    if (ok) commit(m);
    return ok;
  },

  settleScores(scores) {
    set({ lastScores: scores });
    const m = get().machine;
    if (m) { try { persistAndBroadcast(m); } catch { /* ignore */ } }
  },
  };
});

// 便于 store 外（服务层）直接读取积分输入类型
export type { AwardInput, ViolationInput };
