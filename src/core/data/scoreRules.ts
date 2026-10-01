/**
 * 积分规则默认值（两套分值包）
 * 依据《规则提取文档》§5；行为分细则由 scoring.ts 按此参数执行
 */
import type { ScorePackId } from '../types';

export interface ScorePackConfig {
  id: ScorePackId;
  name: string;
  /** 胜负分 */
  winScore: number;
  loseScore: number;
  /** 守卫守中上限（手册 +1 / 摩卡 +2） */
  guardSaveCap: number;
  /** 投票命中上限（手册 +1 / 摩卡 +2） */
  voteHitCap: number;
  /** 首夜出局点狼点神（12人：4张+1；15人：5张+2） */
  pointCount: number;
  pointScore: number;
  /** 摄梦人上限 */
  dreamSaveCap: number;
  /** 猎魔人狩猎上限 */
  huntCap: number;
  /** 纯白查验致出局上限 */
  pureWhiteKillCap: number;
  /** 梦魇恐惧上限 */
  fearCap: number;
}

export const SCORE_PACKS: Record<ScorePackId, ScorePackConfig> = {
  shandong: {
    id: 'shandong', name: '手册（京城大师S2）',
    winScore: 5, loseScore: 0,
    guardSaveCap: 1, voteHitCap: 1,
    pointCount: 4, pointScore: 1,
    dreamSaveCap: 1, huntCap: 1, pureWhiteKillCap: 1, fearCap: 1,
  },
  moka: {
    id: 'moka', name: '摩卡杯',
    winScore: 5, loseScore: 0,
    guardSaveCap: 2, voteHitCap: 2,
    pointCount: 5, pointScore: 2,
    dreamSaveCap: 1, huntCap: 1, pureWhiteKillCap: 1, fearCap: 1,
  },
};

/** 单项行为分通用分值 */
export const BEHAVIOR_SCORES = {
  seerBadge: 0.5,          // 预言家/通灵师竞选获警徽
  seerDay1WolfOut: 0.5,    // 第一天有狼被放逐或自爆
  seerNoCheckPenalty: -0.5,// 无有效验人
  witchPoisonWolf: 1,
  witchPoisonGood: -1,
  hunterShootWolf: 1,
  hunterShootGood: -1,
  guardSaveGood: 0.5,      // 上限 guardSaveCap
  guardSameSavePenalty: -0.5, // 同守同救好人
  dreamSaveGood: 0.5,      // 摄梦人守中好人或梦亡狼人，上限 1
  dreamKillGood: -0.5,
  huntWolf: 0.5,           // 上限 1
  huntGood: -1,
  mathShield: 0.5,         // 数学家激活护盾
  mathNoCheckPenalty: -0.5,
  pureWhiteKilledPenalty: -0.5, // 被狼巫查验出局
  pureWhiteBadge: 0.5,
  wolfKingShootKeyRole: 0.5,  // 狼王带走带药女巫/守卫/摄梦人
  wolfKingPoisonedPenalty: -0.5,
  trickEffect: 0.5,        // 诡狼技能生效
  fearKeyRole: 0.5,        // 梦魇恐惧关键神职，上限 1
  fearWolfPenalty: -1,
  bloodMoonSurvive: 0.5,   // 存活到结束或自爆击杀关键神职
  bloodMoonPoisonedPenalty: -0.5,
  wolfWitchKillPureWhite: 0.5,
  wolfWitchKilledPenalty: -0.5,
  // 机械狼通灵师版型（建议默认，可配置）
  mechSkillUsed: 0.5,     // 学得技能并成功使用
  mechSkillUnused: -0.5,  // 学习后未使用或失败
  // 摩卡杯专属
  knightDuelWolf: 1,
  knightDuelGood: -1,
  wolfBeautyCharmGod: 0.5,
  wolfBeautyPoisonedPenalty: -0.5,
} as const;

/** 投票分 */
export const VOTE_SCORES = {
  hitWolf: 0.5,        // 上限 voteHitCap
  hitGoodOrAbstain: -0.5,
} as const;

/** 特殊分 */
export const SPECIAL_SCORES = {
  wolfWinMajority: 0.5,   // 狼胜且存活≥2 且狼队最高票≥好人最高票（所有狼）
  wolfConsecutiveKill: 0.5, // 连刀同阵营直至获胜（所有狼）
  goodNoMistake: 1,       // 好人胜且无好人阵营原因出局（所有好人）
  wolfBadge: 0.5,         // 狼人竞选获警徽
  mvp: 2,
  svp: 1.5,
  beiguo: -1,
} as const;

/** 夜间时长包（秒） */
export const TIMING_PACKS = {
  shandong: {
    wolfFirstNight: 90, wolfLaterNight: 45,
    wolfChimeFirst: 30, wolfChimeLater: 15,
    godSkill: 15, confirmStatus: 5, confirmRole: 5,
  },
  moka: {
    wolfFirstNight: 60, wolfLaterNight: 30,
    wolfChimeFirst: 30, wolfChimeLater: 15,
    godSkill: 15, confirmStatus: 5, confirmRole: 5,
  },
} as const;
