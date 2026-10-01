/**
 * 内置版型库（13 个）：手册 9 + 机械狼通灵师 + 摩卡杯 3
 * 依据《规则提取文档》§3
 */
import type { BoardConfig, RoleId } from '../types';

const c = (role: RoleId, count = 1) => ({ role, count });

export const BOARDS: BoardConfig[] = [
  // ---------- 手册版型（12 人 / 4 狼 / 屠边 / 山东时长与积分包） ----------
  {
    id: 'sd-yvnlb', name: '预女猎白', playerCount: 12,
    seats: [c('werewolf', 4), c('seer'), c('witch'), c('hunter'), c('idiot'), c('civilian', 4)],
    winMode: 'tuBian', timingPack: 'shandong', scorePack: 'shandong',
    mechPoisonIgnoresSave: false, builtin: true,
  },
  {
    id: 'sd-lwsw', name: '狼王守卫', playerCount: 12,
    seats: [c('wolfKing'), c('werewolf', 3), c('seer'), c('witch'), c('hunter'), c('guard'), c('civilian', 4)],
    winMode: 'tuBian', timingPack: 'shandong', scorePack: 'shandong',
    mechPoisonIgnoresSave: false, builtin: true,
  },
  {
    id: 'sd-mnsm', name: '梦魇摄梦', playerCount: 12,
    seats: [c('nightmare'), c('werewolf', 3), c('seer'), c('witch'), c('hunter'), c('dreamWeaver'), c('civilian', 4)],
    winMode: 'tuBian', timingPack: 'shandong', scorePack: 'shandong',
    mechPoisonIgnoresSave: false, builtin: true,
  },
  {
    id: 'sd-xylmr', name: '血月猎魔人', playerCount: 12,
    seats: [c('bloodMoon'), c('werewolf', 3), c('seer'), c('witch'), c('demonHunter'), c('idiot'), c('civilian', 4)],
    winMode: 'tuBian', timingPack: 'shandong', scorePack: 'shandong',
    mechPoisonIgnoresSave: false, builtin: true,
  },
  {
    id: 'sd-cbwy', name: '纯白夜影', playerCount: 12,
    seats: [c('wolfWitch'), c('werewolf', 3), c('pureWhite'), c('witch'), c('hunter'), c('guard'), c('civilian', 4)],
    winMode: 'tuBian', timingPack: 'shandong', scorePack: 'shandong',
    mechPoisonIgnoresSave: false, builtin: true,
  },
  {
    id: 'sd-sxgsm', name: '石像鬼守墓人', playerCount: 12,
    seats: [c('gargoyle'), c('werewolf', 3), c('seer'), c('witch'), c('hunter'), c('gravekeeper'), c('civilian', 4)],
    winMode: 'tuBian', timingPack: 'shandong', scorePack: 'shandong',
    mechPoisonIgnoresSave: false, builtin: true,
  },
  {
    id: 'sd-lwsmr', name: '狼王摄梦人', playerCount: 12,
    seats: [c('wolfKing'), c('werewolf', 3), c('seer'), c('witch'), c('hunter'), c('dreamWeaver'), c('civilian', 4)],
    winMode: 'tuBian', timingPack: 'shandong', scorePack: 'shandong',
    mechPoisonIgnoresSave: false, builtin: true,
  },
  {
    id: 'sd-mnsw', name: '梦魇守卫', playerCount: 12,
    seats: [c('nightmare'), c('werewolf', 3), c('seer'), c('witch'), c('hunter'), c('guard'), c('civilian', 4)],
    winMode: 'tuBian', timingPack: 'shandong', scorePack: 'shandong',
    mechPoisonIgnoresSave: false, builtin: true,
  },
  {
    id: 'sd-dspl', name: '等式悖论', playerCount: 12,
    seats: [c('trickWolf'), c('werewolf', 3), c('mathematician'), c('witch'), c('hunter'), c('gravekeeper'), c('civilian', 4)],
    winMode: 'tuBian', timingPack: 'shandong', scorePack: 'shandong',
    mechPoisonIgnoresSave: false, builtin: true,
  },
  {
    id: 'sd-jxltls', name: '机械狼通灵师', playerCount: 12,
    seats: [c('mechWolf'), c('werewolf', 3), c('medium'), c('witch'), c('guard'), c('hunter'), c('civilian', 4)],
    winMode: 'tuBian', timingPack: 'shandong', scorePack: 'shandong',
    mechPoisonIgnoresSave: false, builtin: true,
  },
  // ---------- 摩卡杯版型（15 人 / 5 狼 / 摩卡时长与积分包） ----------
  {
    id: 'mk-lwsw15', name: '狼王守卫（15人）', playerCount: 15,
    seats: [c('wolfKing'), c('werewolf', 4), c('seer'), c('witch'), c('hunter'), c('guard'), c('idiot'), c('civilian', 5)],
    winMode: 'tuBian', timingPack: 'moka', scorePack: 'moka',
    mechPoisonIgnoresSave: false, builtin: true,
  },
  {
    id: 'mk-lmlq', name: '狼美猎骑', playerCount: 15,
    seats: [c('wolfBeauty'), c('wolfKing'), c('werewolf', 3), c('seer'), c('witch'), c('hunter'), c('knight'), c('guard'), c('civilian', 5)],
    winMode: 'tuBian', timingPack: 'moka', scorePack: 'moka',
    mechPoisonIgnoresSave: false, builtin: true,
  },
  {
    id: 'mk-jxl15', name: '机械狼（15人）', playerCount: 15,
    seats: [c('mechWolf'), c('werewolf', 4), c('seer'), c('witch'), c('hunter'), c('guard'), c('idiot'), c('civilian', 5)],
    winMode: 'tuBian', timingPack: 'moka', scorePack: 'moka',
    mechPoisonIgnoresSave: false, builtin: true,
  },
];

export function getBoard(id: string): BoardConfig | undefined {
  return BOARDS.find((b) => b.id === id);
}

/** 按版型展开得到每个座位可能的角色清单（分配用） */
export function boardRoleList(board: BoardConfig): RoleId[] {
  const list: RoleId[] = [];
  for (const s of board.seats) for (let i = 0; i < s.count; i++) list.push(s.role);
  return list;
}
