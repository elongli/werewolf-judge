/**
 * 历史 store：已完成对局（含积分快照）+ 累计积分榜
 */
import { create } from 'zustand';
import { configStorage } from '../services/storage';
import type { ScoreRecord } from '../core/types';

export interface FinishedGame {
  id: string;
  boardId: string;
  boardName: string;
  winner: 'wolf' | 'good';
  winReason: string;
  finishedAt: number;
  /** 玩家名/座位（快照） */
  players: { seat: number; name?: string }[];
  scores: ScoreRecord[];
}

const HISTORY_KEY = 'history/games';
const RANKING_KEY = 'ranking/totals';

interface HistoryStoreState {
  history: FinishedGame[];
  /** seat → 累计积分（跨对局） */
  totals: Record<string, number>;
  addFinished(game: FinishedGame): void;
  clearHistory(): void;
  hydrate(): Promise<void>;
}

function seatKey(seat: number, name?: string): string {
  // 累计榜按「昵称优先」聚合（现场多局同批玩家）
  return name?.trim() ? name.trim() : `${seat}号`;
}

export const useHistoryStore = create<HistoryStoreState>((set, get) => ({
  history: [],
  totals: {},

  addFinished(game) {
    const history = [game, ...get().history].slice(0, 200);
    const totals = { ...get().totals };
    const perPlayer = new Map<string, number>();
    for (const r of game.scores) {
      const p = game.players.find((x) => x.seat === r.seat);
      const key = seatKey(r.seat, p?.name);
      perPlayer.set(key, (perPlayer.get(key) ?? 0) + r.value);
    }
    for (const [key, delta] of perPlayer) totals[key] = (totals[key] ?? 0) + delta;
    set({ history, totals });
    void configStorage.set(HISTORY_KEY, JSON.stringify(history));
    void configStorage.set(RANKING_KEY, JSON.stringify(totals));
  },

  clearHistory() {
    set({ history: [], totals: {} });
    void configStorage.remove(HISTORY_KEY);
    void configStorage.remove(RANKING_KEY);
  },

  async hydrate() {
    const [h, t] = await Promise.all([configStorage.get(HISTORY_KEY), configStorage.get(RANKING_KEY)]);
    set({
      history: h ? (JSON.parse(h) as FinishedGame[]) : [],
      totals: t ? (JSON.parse(t) as Record<string, number>) : {},
    });
  },
}));

/** 排行榜视图：按累计分降序 */
export function rankingView(totals: Record<string, number>): { name: string; total: number }[] {
  return Object.entries(totals)
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total);
}
