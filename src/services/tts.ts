/**
 * TtsAdapter：口令播报（H5 用 Web Speech API，系统默认中文音色，免费离线）
 * 二期小程序替换实现，接口不变
 */

export interface TtsAdapter {
  speak(text: string): Promise<void>;
  stop(): void;
  /** 系统是否有可用语音 */
  supported: boolean;
}

class WebSpeechTts implements TtsAdapter {
  get supported() {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  speak(text: string): Promise<void> {
    return new Promise((resolve) => {
      if (!this.supported) return resolve(); // 降级：静默 + UI 视觉提示
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'zh-CN';
      u.rate = 1;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      // 部分浏览器需要先清空队列
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
      // 保底：TTS 卡死不阻塞流程
      setTimeout(resolve, Math.min(15000, 1000 + text.length * 400));
    });
  }

  stop(): void {
    if (this.supported) window.speechSynthesis.cancel();
  }
}

export const tts: TtsAdapter = new WebSpeechTts();

/** 口令模板库 */
export const ANNOUNCE = {
  nightFall: (n: number) => `天黑请闭眼，第${n}夜行动开始`,
  roleOpen: (roleName: string) => `请${roleName}睁眼`,
  roleClose: (roleName: string) => `请${roleName}闭眼`,
  dawn: (_n: number, deathsText: string) =>
    `天亮了，昨夜是${deathsText}`,
  sheriffStart: '警长竞选环节开始，请竞选玩家上警',
  voteStart: '请戴盔，投票倒计时5秒，自倒数开始示票',
  gameOver: (winner: string) => `游戏结束，${winner}阵营获得胜利`,
};
