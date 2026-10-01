/**
 * 角色库（22 角色），时长/规则依据《规则提取文档》§2、§4
 * defaultSeconds 为山东包（手册）默认；狼刀/特殊角色由 timing.ts 的时长包函数覆盖
 */
import type { Role, RoleId } from '../types';

export const ROLES: Record<RoleId, Role> = {
  werewolf: {
    id: 'werewolf', name: '狼人', camp: 'wolf', nightAction: 'kill',
    wakeOrder: 20, defaultSeconds: [90], wakeEveryNight: true, canSuicide: true,
    desc: '每夜与其他狼人共同击杀一名玩家（首夜90s/次夜起45s）',
  },
  wolfKing: {
    id: 'wolfKing', name: '狼王', camp: 'wolf', nightAction: 'kill',
    wakeOrder: 20, defaultSeconds: [90], wakeEveryNight: true, canSuicide: true,
    shotRule: 'restricted',
    desc: '出局可开枪带走一人；被毒杀/被梦亡/自爆时不可发动',
  },
  wolfBeauty: {
    id: 'wolfBeauty', name: '狼美人', camp: 'wolf', nightAction: 'charm',
    wakeOrder: 24, defaultSeconds: [15], wakeEveryNight: true, canSuicide: true,
    desc: '每夜魅惑一人；自己出局时魅惑对象一同出局（摩卡杯）',
  },
  gargoyle: {
    id: 'gargoyle', name: '石像鬼', camp: 'wolf', nightAction: 'checkIdentity',
    wakeOrder: 30, defaultSeconds: [5, 15], wakeEveryNight: true, canSuicide: false,
    desc: '与其他狼人互不见面；每晚查验具体身份；仅剩其存活时可行使击杀；不可自爆',
  },
  trickWolf: {
    id: 'trickWolf', name: '诡狼', camp: 'wolf', nightAction: 'trick',
    wakeOrder: 31, defaultSeconds: [10, 15], wakeEveryNight: true, canSuicide: false,
    desc: '知狼而狼不知其；仅剩其存活方可击杀；诡计使数学家查验反转，整局仅生效一次；不可自爆',
  },
  wolfWitch: {
    id: 'wolfWitch', name: '狼巫', camp: 'wolf', nightAction: 'checkIdentity',
    wakeOrder: 25, defaultSeconds: [15], wakeEveryNight: true, canSuicide: true,
    skillFromNight: 2,
    desc: '每晚查验具体身份；自第二夜查到纯白之女，纯白之女直接出局',
  },
  bloodMoon: {
    id: 'bloodMoon', name: '血月使徒', camp: 'wolf', nightAction: 'kill',
    wakeOrder: 20, defaultSeconds: [90], wakeEveryNight: true, canSuicide: true,
    desc: '自爆则下一夜神职无法发动技能；作为最后一名狼阵营被放逐时不直接出局，再入夜与其当夜击杀目标一同出局',
  },
  mechWolf: {
    id: 'mechWolf', name: '机械狼', camp: 'wolf', nightAction: 'learn',
    wakeOrder: 32, defaultSeconds: [15], wakeEveryNight: true, canSuicide: true,
    desc: '与狼队互不见面；整局一次学习机会，永久获得目标技能；其他狼全出局后获刀人权',
  },
  nightmare: {
    id: 'nightmare', name: '梦魇', camp: 'wolf', nightAction: 'fear',
    wakeOrder: 10, defaultSeconds: [15], wakeEveryNight: true, canSuicide: true,
    desc: '先于狼队行动；每夜恐惧一人使其当夜无法行动；恐惧到狼人则狼队当夜无法袭击；连两夜不可同一人',
  },
  seer: {
    id: 'seer', name: '预言家', camp: 'god', nightAction: 'checkCamp',
    wakeOrder: 40, defaultSeconds: [15], wakeEveryNight: true, canSuicide: false,
    desc: '每晚查验一名玩家是好人还是狼人',
  },
  medium: {
    id: 'medium', name: '通灵师', camp: 'god', nightAction: 'checkIdentity',
    wakeOrder: 41, defaultSeconds: [15], wakeEveryNight: true, canSuicide: false,
    desc: '每晚查验一名玩家的具体身份（与预言家同构，仅结果粒度不同）',
  },
  witch: {
    id: 'witch', name: '女巫', camp: 'god', nightAction: 'save',
    wakeOrder: 42, defaultSeconds: [15], wakeEveryNight: true, canSuicide: false,
    desc: '整局解药毒药各一瓶；全程不可自救；同一夜最多一瓶',
  },
  hunter: {
    id: 'hunter', name: '猎人', camp: 'god', nightAction: 'confirmStatus',
    wakeOrder: 50, defaultSeconds: [5], wakeEveryNight: true, canSuicide: false,
    shotRule: 'onDeath',
    desc: '出局可开枪带走一人；被毒杀/被梦亡不可发动；夜间告知开枪状态',
  },
  guard: {
    id: 'guard', name: '守卫', camp: 'god', nightAction: 'guard',
    wakeOrder: 15, defaultSeconds: [15], wakeEveryNight: true, canSuicide: false,
    desc: '每晚守护一人免狼袭；连两夜不可守同一人；同守同救则出局且解药视为已用',
  },
  idiot: {
    id: 'idiot', name: '白痴', camp: 'god', nightAction: 'confirmRole',
    wakeOrder: 52, defaultSeconds: [5], wakeEveryNight: false, canSuicide: false,
    desc: '被放逐投票出局时翻牌（已出局状态）留在场上至下一个放逐投票环节前',
  },
  gravekeeper: {
    id: 'gravekeeper', name: '守墓人', camp: 'god', nightAction: 'confirmStatus',
    wakeOrder: 51, defaultSeconds: [5], wakeEveryNight: true, canSuicide: false,
    desc: '每夜被告知昨日被放逐玩家的身份是好人还是狼人',
  },
  dreamWeaver: {
    id: 'dreamWeaver', name: '摄梦人', camp: 'god', nightAction: 'dream',
    wakeOrder: 12, defaultSeconds: [15], wakeEveryNight: true, canSuicide: false,
    desc: '每晚必选一名梦游者（不可是自己），免疫夜间伤害；连两夜同一目标则梦亡；摄梦人夜间出局则梦游者同亡',
  },
  demonHunter: {
    id: 'demonHunter', name: '猎魔人', camp: 'god', nightAction: 'hunt',
    wakeOrder: 45, defaultSeconds: [15], wakeEveryNight: true, canSuicide: true,
    skillFromNight: 2,
    desc: '自第二夜可狩猎：狩猎狼人则狼出局，狩猎好人则自己出局；被毒杀不出局且毒药视为已用',
  },
  pureWhite: {
    id: 'pureWhite', name: '纯白之女', camp: 'god', nightAction: 'checkIdentity',
    wakeOrder: 43, defaultSeconds: [15], wakeEveryNight: true, canSuicide: false,
    skillFromNight: 2,
    desc: '每晚查验具体身份；自第二夜查到狼阵营玩家，该玩家直接出局',
  },
  mathematician: {
    id: 'mathematician', name: '数学家', camp: 'god', nightAction: 'mathCheck',
    wakeOrder: 44, defaultSeconds: [15], wakeEveryNight: true, canSuicide: false,
    skillFromNight: 2,
    desc: '自第二夜查验两名玩家是否同阵营；首次验出不等式，次夜获一次性护盾；每人只能被验一次',
  },
  knight: {
    id: 'knight', name: '骑士', camp: 'god', nightAction: 'duel',
    wakeOrder: 99, defaultSeconds: [5], wakeEveryNight: false, canSuicide: false,
    desc: '白天可翻牌决斗：决斗狼人则狼出局，决斗好人则自己出局（摩卡杯）',
  },
  civilian: {
    id: 'civilian', name: '平民', camp: 'civ', nightAction: 'none',
    wakeOrder: 99, defaultSeconds: [5], wakeEveryNight: false, canSuicide: false,
    desc: '夜间无行动',
  },
};

/** 狼队共同刀人批次（夜行动 = kill 的角色） */
export const WOLF_KILL_ROLES: RoleId[] = ['werewolf', 'wolfKing', 'bloodMoon', 'nightmare'];

/** 单独唤醒、互不见面的狼 */
export const LONE_WOLF_ROLES: RoleId[] = ['gargoyle', 'trickWolf', 'mechWolf'];

export function isWolfCamp(role: RoleId): boolean {
  return ROLES[role].camp === 'wolf';
}
