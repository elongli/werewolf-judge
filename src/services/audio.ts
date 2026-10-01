/**
 * 音频：提示音/铃声（与 TTS 分离，铃声不受 TTS 占用影响）
 * M1 用 WebAudio 合成简单音效，免资源文件；M4 换资源音频
 */

type SoundKind = 'chime' | 'bell' | 'warn' | 'end';

let ctx: AudioContext | null = null;
function audioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function beep(freq: number, duration: number, delay = 0): void {
  const ac = audioCtx();
  if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.frequency.value = freq;
  osc.type = 'sine';
  gain.gain.setValueAtTime(0.001, ac.currentTime + delay);
  gain.gain.exponentialRampToValueAtTime(0.3, ac.currentTime + delay + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + delay + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(ac.currentTime + delay);
  osc.stop(ac.currentTime + delay + duration + 0.05);
}

export function playSound(kind: SoundKind): void {
  switch (kind) {
    case 'chime': beep(880, 0.15); break;                       // 提示音点（剩30s等）
    case 'bell': beep(660, 0.3); beep(660, 0.3, 0.4); beep(660, 0.3, 0.8); break; // 行动结束铃
    case 'warn': beep(440, 0.1); beep(440, 0.1, 0.15); break;   // 结束提醒
    case 'end': beep(523, 0.2); beep(659, 0.2, 0.25); beep(784, 0.4, 0.5); break; // 全部结束
  }
}
