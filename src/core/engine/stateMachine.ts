/**
 * 游戏状态机：M1方案 §5
 * 流转：setup→assign→night(n).step→dawn(n)→sheriff(1)→speech→vote→(PK)→lastWords→night(n+1)…→settle
 * 回退：每次变更前压栈快照；back 弹栈恢复
 */
import { getBoard } from '../data/boards';
import { deserialize, serialize } from '../persist';
import type { NightStep } from './nightPlan';
import { buildNightPlan } from './nightPlan';
import { applyLearn, resolveNight } from './nightResolver';
import { resolveExile, tallyVotes } from './dayResolver';
import { evaluateWin } from './winJudge';
import type {
  DayResult, GameState, NightAction, NightResult, Player, VoteRecord,
} from '../types';

const STACK_CAP = 50;

function newId(): string {
  return `g${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export class GameMachine {
  private boardId: string;
  private _state: GameState;
  private stack: string[] = [];

  constructor(boardId: string, state?: GameState) {
    this.boardId = boardId;
    this._state = state ?? {
      id: newId(),
      boardId,
      stage: 'setup',
      players: [],
      nightActions: [],
      votes: [],
      nightResults: [],
      dayResults: [],
      exiledSeats: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  static fromSnapshot(raw: string): GameMachine | null {
    const state = deserialize(raw);
    if (!state) return null;
    return new GameMachine(state.boardId, state);
  }

  get state(): GameState { return this._state; }
  snapshotJson(): string { return serialize(this._state); }

  private board() {
    const b = getBoard(this.boardId);
    if (!b) throw new Error(`版型不存在: ${this.boardId}`);
    return b;
  }

  /** 变更前压栈 */
  private push(): void {
    this.stack.push(serialize(this._state));
    if (this.stack.length > STACK_CAP) this.stack.shift();
  }

  private touch(): void { this._state = { ...this._state, updatedAt: Date.now() }; }

  back(): boolean {
    const snap = this.stack.pop();
    if (!snap) return false;
    const restored = deserialize(snap);
    if (!restored) return false;
    this._state = restored;
    return true;
  }

  start(): void {
    this.push();
    this._state = { ...this._state, stage: 'assign' };
    this.touch();
  }

  assignPlayers(players: Player[]): void {
    this.push();
    this._state = { ...this._state, players, stage: { phase: 'night', night: 1, step: 0 } };
    this.touch();
  }

  /** 本夜唤醒序列 */
  nightSteps(): NightStep[] {
    const stage = this._state.stage;
    if (typeof stage === 'object' && 'step' in stage) {
      return buildNightPlan(this.board(), this._state.players, stage.night);
    }
    return [];
  }

  /** 夜间步骤推进（最后一步停留） */
  advanceNightStep(): void {
    const stage = this._state.stage;
    if (typeof stage !== 'object' || !('step' in stage)) return;
    const steps = this.nightSteps();
    if (stage.step + 1 < steps.length) {
      this.push();
      this._state = { ...this._state, stage: { phase: 'night', night: stage.night, step: stage.step + 1 } };
      this.touch();
    }
  }

  recordNightAction(a: NightAction): void {
    this.push();
    this._state = { ...this._state, nightActions: [...this._state.nightActions, a] };
    this.touch();
  }

  /**
   * 结算本夜：机械狼学习先行；resolveNight 应用全部冲突规则与死亡；
   * → dawn(night)
   */
  finishNight(): NightResult {
    const stage = this._state.stage;
    if (typeof stage !== 'object' || !('step' in stage)) {
      throw new Error('finishNight: 当前不在夜间阶段');
    }
    const night = stage.night;
    const board = this.board();
    const actions = this._state.nightActions.filter((a) => a.night === night);

    this.push();
    let players = this._state.players;
    // 机械狼学习（学习当晚）
    const learn = actions.find((a) => a.kind === 'learn' && a.targets.length > 0);
    if (learn && players.some((p) => p.mech && p.mech.learned === false)) {
      players = applyLearn(players, learn);
    }

    // 血月使徒再入夜：上一日被放逐未死的血月 + 其当夜刀目标同死（在 resolver 内按存活与行动处理）
    const res = resolveNight(board, players, actions, night);
    const result = res.result;
    players = res.players;

    this._state = {
      ...this._state,
      players,
      nightResults: [...this._state.nightResults, result],
      stage: { phase: 'dawn', night },
    };
    this.touch();
    return result;
  }

  /** 死亡公告确认：胜负判定 → 警长竞选 / 放逐发言 / 下一夜 / 结算 */
  confirmDawn(): void {
    const stage = this._state.stage;
    if (typeof stage !== 'object' || stage.phase !== 'dawn') return;
    this.push();

    const win = evaluateWin(this._state.players);
    if (win) {
      this._state = { ...this._state, stage: { phase: 'settle' }, winner: win.winner, winReason: win.reason };
      this.touch();
      return;
    }
    const night = stage.night;
    const day = night; // 第 n 夜之后是第 n 个白天
    const needSheriff = day === 1 && this._state.sheriff === undefined && !this._state.sheriffLost;
    this._state = {
      ...this._state,
      stage: needSheriff ? { phase: 'sheriff', day } : { phase: 'speech', day },
    };
    this.touch();
  }

  recordVotes(votes: VoteRecord[]): void {
    this.push();
    this._state = { ...this._state, votes: [...this._state.votes, ...votes] };
    this.touch();
  }

  /**
   * 放逐结算：平票→PK 轮；出局→遗言（白痴/血月除外）；
   * 胜负判定 → 结算 或 下一夜
   */
  confirmVote(): DayResult {
    const stage = this._state.stage;
    if (typeof stage !== 'object' || stage.phase !== 'vote') {
      throw new Error('confirmVote: 当前不在投票阶段');
    }
    const board = this.board();
    const { day, round } = stage;
    this.push();

    const { result, players } = resolveExile(board, this._state.players, this._state.votes, day, round);
    const dayResults = [...this._state.dayResults, result];
    let nextPlayers = players;

    // 放逐出局的座位记录（守墓人信息 / 点狼点神判定用）
    const exiledSeats = [...this._state.exiledSeats];
    if (result.exiled !== null && !exiledSeats.includes(result.exiled)) exiledSeats.push(result.exiled);

    // 平票 → PK 轮（仅第 1 轮平票进 PK）
    if (result.tie && round === 1) {
      this._state = { ...this._state, players: nextPlayers, dayResults, exiledSeats, stage: { phase: 'vote', day, round: 2 } };
      this.touch();
      return result;
    }

    const win = evaluateWin(nextPlayers);
    if (win) {
      this._state = { ...this._state, players: nextPlayers, dayResults, exiledSeats, stage: { phase: 'settle' }, winner: win.winner, winReason: win.reason };
      this.touch();
      return result;
    }

    // 出局者有遗言 → lastWords（白痴翻牌/血月不死也走发言推进）
    const exiledP = result.exiled !== null ? nextPlayers.find((p) => p.seat === result.exiled) : undefined;
    const hasLastWords = exiledP && exiledP.deathCause === 'exile';
    if (result.exiled !== null && hasLastWords) {
      this._state = { ...this._state, players: nextPlayers, dayResults, exiledSeats, stage: { phase: 'lastWords', day } };
      this.touch();
      return result;
    }

    // 无出局（平安日/平票二轮仍未决）→ 下一夜
    this._state = {
      ...this._state, players: nextPlayers, dayResults, exiledSeats,
      stage: { phase: 'night', night: day + 1, step: 0 },
    };
    this.touch();
    return result;
  }

  setSheriff(seat: number | null, lost?: boolean): void {
    this.push();
    const players = this._state.players.map((p) => ({ ...p, badge: p.seat === seat }));
    this._state = {
      ...this._state,
      players,
      sheriff: lost ? undefined : (seat ?? undefined),
      sheriffLost: lost ?? false,
    };
    this.touch();
  }

  /** 通用推进：sheriff→speech；speech→vote(1)；lastWords→胜负/下一夜 */
  nextStage(): void {
    const stage = this._state.stage;
    if (typeof stage !== 'object') return;
    this.push();
    switch (stage.phase) {
      case 'sheriff':
        this._state = { ...this._state, stage: { phase: 'speech', day: stage.day } };
        break;
      case 'speech':
        this._state = { ...this._state, stage: { phase: 'vote', day: stage.day, round: 1 } };
        break;
      case 'lastWords': {
        const win = evaluateWin(this._state.players);
        if (win) {
          this._state = { ...this._state, stage: { phase: 'settle' }, winner: win.winner, winReason: win.reason };
        } else {
          this._state = { ...this._state, stage: { phase: 'night', night: stage.day + 1, step: 0 } };
        }
        break;
      }
      default:
        this.stack.pop(); // 无匹配不消耗快照
        return;
    }
    this.touch();
  }

  /** 当前放逐票数统计（day 页展示票型用） */
  currentTally(round: 1 | 2): Map<number, number> {
    const stage = this._state.stage;
    const day = typeof stage === 'object' && 'day' in stage ? stage.day : 1;
    return tallyVotes(this._state.votes, day, round).counts;
  }
}
