/**
 * SyncAdapter：操控端 ↔ 投屏端同步
 * 阶段一：同设备双标签用 BroadcastChannel（零配置）；跨设备方案 M4 前定（接口先行）
 * 投屏页只读订阅；同步载荷绝不含身份明文（投屏页也不展示）
 */

export interface SyncAdapter {
  /** 发布对局快照 JSON（仅投屏安全字段或全量——同源标签页，全量即可） */
  publish(json: string): void;
  /** 订阅（投屏端调用），返回取消函数 */
  subscribe(cb: (json: string) => void): () => void;
  close(): void;
}

const CHANNEL = 'werewolf-judge-sync';

class BroadcastChannelSync implements SyncAdapter {
  private bc: BroadcastChannel | null = null;

  private ensure(): BroadcastChannel | null {
    if (typeof BroadcastChannel === 'undefined') return null; // 环境不支持则静默降级
    if (!this.bc) this.bc = new BroadcastChannel(CHANNEL);
    return this.bc;
  }

  publish(json: string): void {
    this.ensure()?.postMessage(json);
  }

  subscribe(cb: (json: string) => void): () => void {
    const bc = this.ensure();
    if (!bc) return () => {};
    const handler = (e: MessageEvent) => cb(e.data as string);
    bc.addEventListener('message', handler);
    return () => bc.removeEventListener('message', handler);
  }

  close(): void {
    this.bc?.close();
    this.bc = null;
  }
}

export const sync: SyncAdapter = new BroadcastChannelSync();

/** 广播对局（自动节流：相同内容不重复发） */
let lastJson = '';
export function broadcastState(json: string): void {
  if (json === lastJson) return;
  lastJson = json;
  sync.publish(json);
}
