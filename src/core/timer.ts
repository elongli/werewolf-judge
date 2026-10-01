/**
 * TimerEngine：分阶段倒计时引擎
 * - Date.now() 时间戳基准，防 setInterval 漂移
 * - pause / resume / next / 事件回调（阶段开始、剩余提示点、阶段结束、全部结束）
 * 纯 TS，不依赖 Taro/浏览器 API（interval 由外部注入可测）
 */
import type { TimerPhase } from './types';

export interface TimerHooks {
  onPhaseStart?: (phase: TimerPhase, index: number) => void;
  /** 每 tick：剩余秒数（向上取整） */
  onTick?: (remaining: number, phase: TimerPhase, index: number) => void;
  /** 提示音节点 */
  onChime?: (secondsLeft: number, text: string, phase: TimerPhase, index: number) => void;
  onPhaseEnd?: (phase: TimerPhase, index: number) => void;
  onAllEnd?: () => void;
}

export class TimerEngine {
  private phases: TimerPhase[];
  private hooks: TimerHooks;
  private setTicker: (cb: () => void, ms: number) => { clear: () => void };
  private now: () => number;

  private index = 0;
  private endAt = 0;
  private pausedAt = 0;
  private running = false;
  private finished = false;
  private ticker?: { clear: () => void };
  private firedChimes = new Set<number>();

  constructor(
    phases: TimerPhase[],
    hooks: TimerHooks = {},
    deps?: { now?: () => number; setTicker?: TimerEngine['setTicker'] },
  ) {
    if (!phases.length) throw new Error('TimerEngine: 至少一个阶段');
    this.phases = phases;
    this.hooks = hooks;
    this.now = deps?.now ?? (() => Date.now());
    this.setTicker =
      deps?.setTicker ??
      ((cb, ms) => {
        const id = setInterval(cb, ms);
        return { clear: () => clearInterval(id) };
      });
  }

  /** 当前阶段序号 */
  get phaseIndex(): number { return this.index; }
  get isRunning(): boolean { return this.running; }
  get isFinished(): boolean { return this.finished; }

  /** 剩余毫秒 */
  remainingMs(): number {
    if (this.finished) return 0;
    const base = this.running ? this.now() : this.pausedAt;
    return Math.max(0, this.endAt - base);
  }

  /** 剩余秒（向上取整） */
  remainingSec(): number { return Math.ceil(this.remainingMs() / 1000); }

  start(): void {
    if (this.running || this.finished) return;
    this.beginPhase(this.index);
  }

  private beginPhase(i: number): void {
    this.index = i;
    this.firedChimes.clear();
    const phase = this.phases[i];
    this.endAt = this.now() + phase.seconds * 1000;
    this.running = true;
    this.hooks.onPhaseStart?.(phase, i);
    this.hooks.onTick?.(this.remainingSec(), phase, i);
    this.ticker?.clear();
    this.ticker = this.setTicker(() => this.tick(), 200);
  }

  private tick(): void {
    const phase = this.phases[this.index];
    const sec = this.remainingSec();
    this.hooks.onTick?.(sec, phase, this.index);
    for (const at of phase.chimeAt ?? []) {
      if (sec <= at && !this.firedChimes.has(at)) {
        this.firedChimes.add(at);
        const text = phase.chimeText?.[phase.chimeAt!.indexOf(at)] ?? '';
        this.hooks.onChime?.(at, text, phase, this.index);
      }
    }
    if (this.remainingMs() <= 0) {
      this.hooks.onPhaseEnd?.(phase, this.index);
      if (this.index + 1 < this.phases.length) {
        this.beginPhase(this.index + 1);
      } else {
        this.stop();
        this.finished = true;
        this.hooks.onAllEnd?.();
      }
    }
  }

  pause(): void {
    if (!this.running) return;
    this.pausedAt = this.now();
    this.running = false;
    this.ticker?.clear();
  }

  resume(): void {
    if (this.running || this.finished) return;
    this.endAt += this.now() - this.pausedAt;
    this.running = true;
    this.ticker = this.setTicker(() => this.tick(), 200);
  }

  /** 跳到下一阶段 */
  next(): void {
    if (this.finished) return;
    if (this.index + 1 < this.phases.length) {
      this.beginPhase(this.index + 1);
    } else {
      this.stop();
      this.finished = true;
      this.hooks.onAllEnd?.();
    }
  }

  stop(): void {
    this.running = false;
    this.ticker?.clear();
  }
}
