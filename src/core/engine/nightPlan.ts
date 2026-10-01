/**
 * 夜间唤醒计划：由版型 + 存活状态 + 夜序计算本夜唤醒序列与每步计时阶段
 * 时长依据《规则提取文档》§2（山东包：狼 90/45；摩卡：60/30）
 */
import { ROLES } from '../data/roles';
import { TIMING_PACKS } from '../data/scoreRules';
import type { BoardConfig, MechSkill, NightActionKind, Player, RoleId, TimerPhase } from '../types';

/** 夜间一个唤醒步骤 */
export interface NightStep {
  /** 行动角色（狼队共同行动用 WOLF_KILL 批次表示） */
  role: RoleId;
  /** 行动座位（狼队=全部存活刀权狼） */
  seats: number[];
  kind: NightActionKind;
  phases: TimerPhase[];
  /** 口令文案 */
  announce: string;
}

const WOLF_TEAM: RoleId = 'werewolf'; // 狼队共同行动批次以狼人代表

function wolfPhases(board: BoardConfig, night: number): TimerPhase[] {
  const t = TIMING_PACKS[board.timingPack];
  const first = night === 1;
  const secs = first ? t.wolfFirstNight : t.wolfLaterNight;
  const chime = first ? t.wolfChimeFirst : t.wolfChimeLater;
  return [{
    label: first ? '狼人行动（首夜）' : '狼人行动',
    seconds: secs,
    chimeAt: [chime],
    chimeText: ['狼人请迅猛'],
  }];
}

function secs(_board: BoardConfig, s: number, label: string, chimeAt?: number[]): TimerPhase[] {
  return [{ label, seconds: s, ...(chimeAt ? { chimeAt } : {}) }];
}

/** 机械狼本夜行动类型 */
export function mechActionOf(p: Player, night: number): NightActionKind {
  const mech = p.mech;
  if (!mech || mech.learned === false) return 'learn';
  const learnedAt = mech.learned.night;
  if (night <= learnedAt) return 'none'; // 学习当晚已学习，学得技能次晚生效
  const skill: MechSkill = mech.learned.skill;
  if (mech.hasKnifeRight) {
    // 有刀权：普通刀；若学得双刀且未用，可选择 doubleKill
    if (skill === 'doubleKill' && !mech.doubleKillUsed) return 'doubleKill';
    return 'kill';
  }
  switch (skill) {
    case 'checkIdentity': return 'checkIdentity';
    case 'poison': return mech.poisonUsed ? 'none' : 'poison';
    case 'guard': return 'guard';
    case 'shot': return 'none'; // 开枪为出局触发，夜间无主动行动
    case 'doubleKill': return 'none';
    default: return 'none';
  }
}

/**
 * 生成第 night 夜唤醒序列
 * players 用于存活过滤与机械狼/白痴等状态判断
 */
export function buildNightPlan(board: BoardConfig, players: Player[], night: number): NightStep[] {
  const steps: NightStep[] = [];
  const alive = (r: RoleId) => players.filter((p) => p.alive && p.role === r);
  const pack = board.timingPack;
  const tp = TIMING_PACKS[pack];

  const push = (role: RoleId, seats: number[], kind: NightActionKind, phases: TimerPhase[]) => {
    if (!seats.length) return;
    steps.push({ role, seats, kind, phases, announce: `请${ROLES[role].name}睁眼` });
  };

  // 按唤醒顺序生成（wakeOrder 升序；狼队共同行动合并为一个批次）
  const order: Array<{ role: RoleId; make: () => void }> = [];

  // 梦魇（先于狼队）
  order.push({
    role: 'nightmare',
    make: () => push('nightmare', alive('nightmare').map((p) => p.seat), 'fear', secs(board, tp.godSkill, '梦魇恐惧')),
  });
  // 摄梦人
  order.push({
    role: 'dreamWeaver',
    make: () => push('dreamWeaver', alive('dreamWeaver').map((p) => p.seat), 'dream', secs(board, tp.godSkill, '摄梦人行动')),
  });
  // 守卫
  order.push({
    role: 'guard',
    make: () => push('guard', alive('guard').map((p) => p.seat), 'guard', secs(board, tp.godSkill, '守卫守护')),
  });
  // 狼队共同行动（werewolf/wolfKing/bloodMoon）
  order.push({
    role: WOLF_TEAM,
    make: () => {
      const team = players.filter((p) => p.alive && (p.role === 'werewolf' || p.role === 'wolfKing' || p.role === 'bloodMoon'));
      if (team.length) {
        steps.push({
          role: WOLF_TEAM,
          seats: team.map((p) => p.seat),
          kind: 'kill',
          phases: wolfPhases(board, night),
          announce: '请狼人睁眼',
        });
      }
    },
  });
  // 狼巫
  order.push({
    role: 'wolfWitch',
    make: () => push('wolfWitch', alive('wolfWitch').map((p) => p.seat), 'checkIdentity', secs(board, tp.godSkill, '狼巫查验')),
  });
  // 狼美人
  order.push({
    role: 'wolfBeauty',
    make: () => push('wolfBeauty', alive('wolfBeauty').map((p) => p.seat), 'charm', secs(board, tp.godSkill, '狼美人魅惑')),
  });
  // 石像鬼（分阶段：首夜 5+15；次夜起 15+15[仅剩其存活时击杀阶段]）
  order.push({
    role: 'gargoyle',
    make: () => {
      const gs = alive('gargoyle');
      if (!gs.length) return;
      const hasKnife = players.filter((p) => p.alive && ROLES[p.role].camp === 'wolf' && p.role !== 'gargoyle').length === 0;
      const phases: TimerPhase[] = night === 1
        ? [{ label: '石像鬼确认/查验', seconds: 5 }, { label: '石像鬼查验', seconds: 15 }]
        : hasKnife
          ? [{ label: '石像鬼查验', seconds: 15 }, { label: '石像鬼击杀', seconds: 15 }]
          : [{ label: '石像鬼查验', seconds: 15 }];
      steps.push({ role: 'gargoyle', seats: gs.map((p) => p.seat), kind: 'checkIdentity', phases, announce: '请石像鬼睁眼' });
    },
  });
  // 诡狼（首夜 10+15；次夜起 15+15）
  order.push({
    role: 'trickWolf',
    make: () => {
      const ts = alive('trickWolf');
      if (!ts.length) return;
      const hasKnife = players.filter((p) => p.alive && ROLES[p.role].camp === 'wolf' && p.role !== 'trickWolf').length === 0;
      const phases: TimerPhase[] = night === 1
        ? [{ label: '诡狼确认狼人', seconds: 10 }, { label: '诡狼诡计', seconds: 15 }]
        : [{ label: '诡狼诡计', seconds: 15 }, ...(hasKnife ? [{ label: '诡狼击杀', seconds: 15 }] : [])];
      steps.push({ role: 'trickWolf', seats: ts.map((p) => p.seat), kind: 'trick', phases, announce: '请诡狼睁眼' });
    },
  });
  // 机械狼
  order.push({
    role: 'mechWolf',
    make: () => {
      const ms = alive('mechWolf');
      if (!ms.length) return;
      for (const p of ms) {
        const kind = mechActionOf(p, night);
        if (kind === 'none') continue;
        const label = kind === 'learn' ? '机械狼学习' : '机械狼行动';
        steps.push({
          role: 'mechWolf', seats: [p.seat], kind,
          phases: secs(board, tp.godSkill, label),
          announce: kind === 'learn' ? '请机械狼睁眼，选择学习对象' : '请机械狼睁眼',
        });
      }
    },
  });
  // 女巫
  order.push({
    role: 'witch',
    make: () => push('witch', alive('witch').map((p) => p.seat), 'save', secs(board, tp.godSkill, '女巫用药')),
  });
  // 预言家
  order.push({
    role: 'seer',
    make: () => push('seer', alive('seer').map((p) => p.seat), 'checkCamp', secs(board, tp.godSkill, '预言家查验')),
  });
  // 通灵师
  order.push({
    role: 'medium',
    make: () => push('medium', alive('medium').map((p) => p.seat), 'checkIdentity', secs(board, tp.godSkill, '通灵师查验')),
  });
  // 纯白之女（首夜也查验，第二夜起可验杀）
  order.push({
    role: 'pureWhite',
    make: () => push('pureWhite', alive('pureWhite').map((p) => p.seat), 'checkIdentity', secs(board, tp.godSkill, '纯白之女查验')),
  });
  // 数学家（自第二夜）
  if (night >= 2) {
    order.push({
      role: 'mathematician',
      make: () => push('mathematician', alive('mathematician').map((p) => p.seat), 'mathCheck', secs(board, tp.godSkill, '数学家验证')),
    });
  }
  // 猎魔人（自第二夜）
  if (night >= 2) {
    order.push({
      role: 'demonHunter',
      make: () => push('demonHunter', alive('demonHunter').map((p) => p.seat), 'hunt', secs(board, tp.godSkill, '猎魔人狩猎')),
    });
  }
  // 猎人（确认状态）
  order.push({
    role: 'hunter',
    make: () => push('hunter', alive('hunter').map((p) => p.seat), 'confirmStatus', secs(board, tp.confirmStatus, '猎人确认状态')),
  });
  // 守墓人（信息）
  order.push({
    role: 'gravekeeper',
    make: () => push('gravekeeper', alive('gravekeeper').map((p) => p.seat), 'confirmStatus', secs(board, tp.confirmStatus, '守墓人信息')),
  });
  // 白痴（仅首夜确认身份）
  if (night === 1) {
    order.push({
      role: 'idiot',
      make: () => push('idiot', alive('idiot').map((p) => p.seat), 'confirmRole', secs(board, tp.confirmRole, '白痴确认身份')),
    });
  }

  // 按 ROLES wakeOrder 排序（狼队批次 = 狼人序号 20）
  const orderOf = (r: RoleId) => (r === WOLF_TEAM ? 20 : ROLES[r].wakeOrder);
  order.sort((a, b) => orderOf(a.role) - orderOf(b.role));
  for (const o of order) o.make();
  return steps;
}
