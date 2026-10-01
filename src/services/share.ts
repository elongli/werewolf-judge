/**
 * 导出：整包 JSON 下载 + 结果分享图（canvas 长图 → PNG）
 */

export interface ShareRow {
  seat: number;
  name?: string;
  role: string;
  total: number;
}

export function downloadJson(filename: string, json: string): void {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** 结算分享长图：标题 + 胜负 + 积分行列表 */
export async function renderShareImage(opts: {
  title: string;
  subtitle: string;
  rows: ShareRow[];
}): Promise<string> {
  const W = 750;
  const rowH = 72;
  const H = 220 + opts.rows.length * rowH + 60;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // 背景
  ctx.fillStyle = '#1b1f2a';
  ctx.fillRect(0, 0, W, H);
  // 标题
  ctx.fillStyle = '#ffd88a';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText(opts.title, 40, 80);
  ctx.fillStyle = '#aab';
  ctx.font = '26px sans-serif';
  ctx.fillText(opts.subtitle, 40, 130);
  // 表头
  ctx.fillStyle = '#889';
  ctx.font = '24px sans-serif';
  ctx.fillText('座位', 40, 190);
  ctx.fillText('昵称', 160, 190);
  ctx.fillText('身份', 360, 190);
  ctx.fillText('积分', 600, 190);
  // 行
  opts.rows.forEach((r, i) => {
    const y = 230 + i * rowH;
    if (i % 2 === 0) { ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(30, y - 34, W - 60, rowH - 8); }
    ctx.fillStyle = '#dde';
    ctx.font = '28px sans-serif';
    ctx.fillText(String(r.seat), 40, y);
    ctx.fillText(r.name || `-${r.seat}号-`, 160, y);
    ctx.fillText(r.role, 360, y);
    ctx.fillStyle = r.total >= 0 ? '#7fe28a' : '#ff8a8a';
    ctx.fillText((r.total >= 0 ? '+' : '') + r.total.toFixed(1), 600, y);
  });

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ? URL.createObjectURL(b) : ''), 'image/png'));
}

export function downloadImage(url: string, filename: string): void {
  if (!url) return;
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
}
