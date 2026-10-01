/**
 * 领域类型与枚举（纯 TS，禁止 import UI / Taro API）
 * 依据：设计文档.md v0.2 + 规则提取文档.md（M0 产出）
 */

// ---------- 阵营与角色 ----------
export type Camp = 'wolf' | 'god' | 'civ';

export type RoleId =
  // 狼阵营
  | 'werewolf' | 'wolfKing' | 'wolfBeauty' | 'gargoyle' | 'trickWolf'
  | 'wolfWitch' | 'bloodMoon' | 'mechWolf' | 'nightmare'
  // 神职
  | 'seer' | 'medium' | 'witch' | 'hunter' | 'guard' | 'idiot'
  | 'gravekeeper' | 'dreamWeaver' | 'demonHunter' | 'pureWhite'
  | 'mathematician' | 'knight'
  // 平民
  | 'civilian';

// ---------- 夜间行动类型 ----------
export type NightActionKind =
  | 'none' | 'confirmRole' | 'confirmStatus'
  | 'checkCamp' | 'checkIdentity'
  | 'kill' | 'emptyKill'
  | 'save' | 'poison' | 'guard' | 'dream' | 'fear' | 'hunt'
  | 'trick' | 'mathCheck' | 'learn' | 'charm' | 'duel' | 'doubleKill';

export type MechSkill =
  | 'none' | 'checkIdentity' | 'poison' | 'guard' | 'shot' | 'doubleKill';

// ---------- 角色 ----------
export interface Role {
  id: RoleId;
  name: string;
  camp: Camp;
  nightAction: NightActionKind;
  /** 唤醒顺序，越小越先；狼队共同行动的角色同序号 */
  wakeOrder: number;
  /** 分阶段时长（秒），山东包默认；狼人/特殊角色由时长包函数覆盖 */
  defaultSeconds: number[];
  /** 是否每晚唤醒（白痴为 false，仅首夜） */
  wakeEveryNight: boolean;
  /** 从第几夜开始有技能行动（猎魔人/数学家/狼巫杀 / 纯白杀 = 2） */
  skillFromNight?: number;
  /** 自爆权限（石像鬼/诡狼不可） */
  canSuicide: boolean;
  /** 出局开枪规则：onDeath=出局即可；restricted=被毒杀/被梦亡不可 */
  shotRule?: 'onDeath' | 'restricted';
  /** 技能说明（配置页展示） */
  desc: string;
}

// ---------- 版型 ----------
export type TimingPack = 'shandong' | 'moka';
export type ScorePackId = 'shandong' | 'moka';

export interface BoardConfig {
  id: string;
  name: string;
  playerCount: 12 | 15;
  seats: { role: RoleId; count: number }[];
  /** 胜利模式，目前仅屠边 */
  winMode: 'tuBian';
  /** 夜间时长包 */
  timingPack: TimingPack;
  /** 积分分值包 */
  scorePack: ScorePackId;
  /** 机械狼学得毒药是否无视解药（默认 false） */
  mechPoisonIgnoresSave: boolean;
  /** 是否内置版型（内置不可删，可复制修改） */
  builtin: boolean;
}

// ---------- 夜间行动记录 ----------
export interface NightAction {
  night: number;
  role: RoleId;
  actorSeat: number;
  kind: NightActionKind;
  /** 目标座位号；空刀/不行动为空数组 */
  targets: number[];
  /** 附加信息：查验结果 / 学得技能 / 是否用药等 */
  detail?: Record<string, unknown>;
}

// ---------- 投票记录 ----------
export interface VoteRecord {
  day: number;
  round: 1 | 2;
  voter: number;
  /** 被投座位号；弃票 = null */
  target: number | null;
  /** 是否警徽票（警长竞选环节） */
  sheriffVote?: boolean;
}

// ---------- 玩家 ----------
export interface MechWolfState {
  /** 学习记录；false = 未学习 */
  learned: false | { targetSeat: number; night: number; skill: MechSkill };
  poisonUsed: boolean;
  doubleKillUsed: boolean;
  /** 是否拥有刀人权（场上其他狼全部出局后为 true） */
  hasKnifeRight: boolean;
}

export interface Player {
  seat: number;
  name?: string;
  role: RoleId;
  alive: boolean;
  /** 死亡原因：wolf/poison/hunt/dream/check/exile/shot/duel/suicide/reflected/… */
  deathCause?: string;
  /** 死亡发生的夜/日序号 */
  deathAt?: { night?: number; day?: number };
  /** 身份是否已公开（白痴翻牌/骑士决斗翻牌/出局公示） */
  revealed: boolean;
  /** 是否警长 */
  badge: boolean;
  /** 机械狼专属状态 */
  mech?: MechWolfState;
  /** 女巫用药状态（女巫与机械狼学得毒药共用结构） */
  potions?: { saveUsed: boolean; poisonUsed: boolean };
  /** 守卫上一夜守护目标（连守禁用） */
  lastGuardTarget?: number;
  /** 摄梦人上一夜梦游目标 */
  lastDreamTarget?: number;
  /** 数学家护盾（验出不等式次夜生效一夜） */
  shieldNight?: number;
}

// ---------- 游戏阶段 ----------
export type GameStage =
  | 'setup'
  | 'assign'
  | { phase: 'night'; night: number; step: number }
  | { phase: 'dawn'; night: number }
  | { phase: 'sheriff'; day: number }
  | { phase: 'speech'; day: number }
  | { phase: 'vote'; day: number; round: 1 | 2 }
  | { phase: 'lastWords'; day: number }
  | { phase: 'settle' };

export type StagePhase = GameStage extends string ? GameStage
  : GameStage extends { phase: infer P } ? P : never;

// ---------- 死亡与公告 ----------
export interface DeathRecord {
  seat: number;
  cause: string;
  night?: number;
  day?: number;
}

// ---------- 夜间结算产出 ----------
export interface NightResult {
  night: number;
  deaths: DeathRecord[];
  /** 查验结果（供法官展示，不入投屏） */
  checks: { actorSeat: number; kind: NightActionKind; target: number; result: string }[];
  /** 被恐惧而无法行动的角色座位 */
  feared: number[];
  /** 梦游者座位 */
  dreamTarget?: number;
  /** 好人阵营失误标记（影响好人零失误加分） */
  goodMistakes: string[];
  /** 副作用标记（血月封技夜等） */
  sideEffects: { godsSealedNight?: number; emptyKill?: boolean };
}

// ---------- 白天结算 ----------
export interface DayResult {
  day: number;
  /** 放逐出局（null = 平票未决/无人出局） */
  exiled: number | null;
  /** 技能连锁产生的额外出局（按结算顺序） */
  chainDeaths: DeathRecord[];
  /** 是否平票进入 PK */
  tie: boolean;
}

// ---------- 积分 ----------
export interface ScoreRecord {
  seat: number;
  ruleId: string;
  value: number;
  reason: string;
  /** 法官手动微调标记 */
  manual?: boolean;
}

export interface AwardInput {
  mvp?: number;
  svp?: number;
  beiguo?: number;
}

export interface ViolationInput {
  seat: number;
  type: string;
  value: number;
  note?: string;
}

// ---------- 对局 ----------
export interface GameState {
  id: string;
  boardId: string;
  stage: GameStage;
  players: Player[];
  nightActions: NightAction[];
  votes: VoteRecord[];
  nightResults: NightResult[];
  dayResults: DayResult[];
  /** 警徽持有者座位（流失 = null 且 sheriffLost = true） */
  sheriff?: number;
  sheriffLost?: boolean;
  /** 被放逐出局顺序（用于守墓人信息、白痴翻牌） */
  exiledSeats: number[];
  /** 血月使徒再入夜标记（最后狼被放逐不直接出局） */
  bloodMoonPending?: { night: number; seat: number };
  winner?: 'wolf' | 'good';
  winReason?: string;
  createdAt: number;
  updatedAt: number;
}

export interface GameSnapshot {
  version: string;
  savedAt: number;
  state: GameState;
}

// ---------- 计时 ----------
export interface TimerPhase {
  label: string;
  seconds: number;
  /** 提示音节点（剩余秒数） */
  chimeAt?: number[];
  /** 提示音文案 */
  chimeText?: string[];
}
