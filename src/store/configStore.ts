/**
 * 配置 store：发言时长 / 规则开关（localStorage 持久化，版型库只读内置 + 用户自定义）
 */
import { create } from 'zustand';
import { configStorage } from '../services/storage';
import type { BoardConfig } from '../core/types';
import { BOARDS } from '../core/data/boards';

export interface SpeechConfig {
  sheriff: number;   // 警长竞选发言（默认 90）
  speech: number;     // 放逐发言（默认 90）
  sheriffSpeech: number; // 警长发言（默认 120）
  lastWords: number;  // 遗言（默认 90）
  warnAt: number;     // 剩余提示秒数（默认 30）
}

const DEFAULT_SPEECH: SpeechConfig = { sheriff: 90, speech: 90, sheriffSpeech: 120, lastWords: 90, warnAt: 30 };
const SPEECH_KEY = 'configs/speech';
const CUSTOM_BOARDS_KEY = 'configs/boards';

interface ConfigStoreState {
  speech: SpeechConfig;
  customBoards: BoardConfig[];
  setSpeech(cfg: Partial<SpeechConfig>): void;
  addCustomBoard(board: BoardConfig): void;
  removeCustomBoard(id: string): void;
  allBoards(): BoardConfig[];
  hydrate(): Promise<void>;
}

export const useConfigStore = create<ConfigStoreState>((set, get) => ({
  speech: { ...DEFAULT_SPEECH },
  customBoards: [],

  setSpeech(cfg) {
    const speech = { ...get().speech, ...cfg };
    set({ speech });
    void configStorage.set(SPEECH_KEY, JSON.stringify(speech));
  },

  addCustomBoard(board) {
    const customBoards = [...get().customBoards.filter((b) => b.id !== board.id), board];
    set({ customBoards });
    void configStorage.set(CUSTOM_BOARDS_KEY, JSON.stringify(customBoards));
  },

  removeCustomBoard(id) {
    const customBoards = get().customBoards.filter((b) => b.id !== id);
    set({ customBoards });
    void configStorage.set(CUSTOM_BOARDS_KEY, JSON.stringify(customBoards));
  },

  allBoards() {
    return [...BOARDS, ...get().customBoards];
  },

  async hydrate() {
    const [speechRaw, boardsRaw] = await Promise.all([
      configStorage.get(SPEECH_KEY),
      configStorage.get(CUSTOM_BOARDS_KEY),
    ]);
    set({
      speech: speechRaw ? { ...DEFAULT_SPEECH, ...(JSON.parse(speechRaw) as SpeechConfig) } : { ...DEFAULT_SPEECH },
      customBoards: boardsRaw ? (JSON.parse(boardsRaw) as BoardConfig[]) : [],
    });
  },
}));
