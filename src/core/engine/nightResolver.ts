/**
 * 夜间结算引擎：全部冲突规则集中于此（规则提取文档 §1.8、§4、§7 冲突）
 * 纯函数：输入本夜行动 + 当前玩家状态，输出结算结果与更新后的玩家状态
 */
import { ROLES } from '../data/roles';
import type {
  BoardConfig, DeathRecord, NightAction, NightResult, Player, RoleId,
} from '../types';

export interface NightResolution {
  result: NightResult;
  /** 结算后的玩家状态（新数组） */
  players: Player[];
}

/** 目标角色 → 机械狼学得技能 */
export function mechSkillOf(role: RoleId): 'none' | 'checkIdentity' | 'poison' | 'guard' | 'shot' | 'doubleKill' {
  switch (role) {
    case 'seer': case 'medium': case 'pureWhite': case 'wolfWitch': case 'gargoyle':
      return 'checkIdentity';
    case 'witch': return 'poison';
    case 'guard': return 'guard';
    case 'hunter': return 'shot';
    case 'werewolf': case 'wolfKing': case 'bloodMoon': case 'nightmare': return 'doubleKill';
    default: return 'none'; // 平民/白痴/守墓人等：无技能
  }
}

/** 其他狼是否全部出局（机械狼/石像鬼/诡狼刀权判定） */
export function allOtherWolvesOut(players: Player[], selfSeat: number): boolean {
  return !players.some((p) => p.alive && p.seat !== selfSeat && ROLES[p.role].camp === 'wolf');
}

export function resolveNight(
  board: BoardConfig,
  playersIn: Player[],
  actions: NightAction[],
  night: number,
  opts?: { godsSealedNight?: number },
): NightResolution {
  const players = playersIn.map((p) => ({ ...p }));
  const bySeat = (s: number) => players.find((p) => p.seat === s);
  const result: NightResult = {
    night, deaths: [], checks: [], feared: [], goodMistakes: [],
    sideEffects: {},
  };

  // ---------- 收集行动 ----------
  const act = (kinds: NightAction['kind'][]) => actions.filter((a) => kinds.includes(a.kind));
  const fearA = act(['fear'])[0];
  const guardA = act(['guard'])[0];
  const dreamA = act(['dream'])[0];
  const saveA = act(['save'])[0];
  const poisonA = act(['poison'])[0];
  const killA = act(['kill'])[0];
  const doubleKillA = act(['doubleKill'])[0];
  const huntA = act(['hunt'])[0];
  const checksA = act(['checkCamp', 'checkIdentity', 'mathCheck']);

  // 被恐惧者：当夜行动无效
  const fearedSeats = new Set<number>();
  if (fearA) {
    for (const t of fearA.targets) fearedSeats.add(t);
    result.feared = [...fearedSeats];
    // 恐惧到狼人 → 狼队当夜无法袭击
    if (fearA.targets.some((s) => bySeat(s) && ROLES[bySeat(s)!.role].camp === 'wolf')) {
      result.goodMistakes.push(`梦魇恐惧到狼人(${fearA.targets.join(',')})`);
    }
  }
  const voided = (a?: NightAction) => !a || fearedSeats.has(a.actorSeat) || (opts?.godsSealedNight === night && ROLES[a.role].camp === 'god' && !['confirmStatus', 'confirmRole'].includes(a.kind));

  // 守卫（含机械狼学得守护）；连守同一人：UI 已禁，此处兜底判无效
  let guardedSeat: number | undefined;
  if (!voided(guardA) && guardA.targets.length) {
    const g = bySeat(guardA.actorSeat);
    const target = guardA.targets[0];
    if (g && g.lastGuardTarget !== target) guardedSeat = target;
    if (g) g.lastGuardTarget = target; // 记录尝试守护目标（UI 会阻止连守）
  }

  // 摄梦：梦游者免疫夜间一切伤害
  let dreamSeat: number | undefined;
  const dreamWeaverP = players.find((p) => p.role === 'dreamWeaver');
  if (!voided(dreamA) && dreamA.targets.length) {
    dreamSeat = dreamA.targets[0];
    if (dreamWeaverP) dreamWeaverP.lastDreamTarget = dreamSeat;
    result.dreamTarget = dreamSeat;
  } else if (dreamWeaverP) {
    dreamWeaverP.lastDreamTarget = undefined;
  }

  // 狼刀（狼队 / 石像鬼 / 诡狼 / 机械狼普通刀）
  let knifeSeat: number | undefined;
  const knifeVoidByFearWolf = fearA?.targets.some((s) => bySeat(s) && ROLES[bySeat(s)!.role].camp === 'wolf') ?? false;
  if (!voided(killA) && killA.targets.length && !knifeVoidByFearWolf) {
    knifeSeat = killA.targets[0];
  }
  if (knifeSeat === undefined && voided(killA) === false && killA && !killA.targets.length) {
    result.sideEffects.emptyKill = true; // 空刀
  }
  if (knifeSeat === undefined && knifeVoidByFearWolf && killA?.targets.length) {
    result.sideEffects.emptyKill = true;
    result.goodMistakes.push(`梦魇恐惧狼人致空刀`);
  }

  // 机械狼双刀（破盾刀：无视守护，两刀同一人必死）
  let doubleKillSeat: number | undefined;
  if (!voided(doubleKillA) && doubleKillA.targets.length) {
    doubleKillSeat = doubleKillA.targets[0];
    const mech = players.find((p) => p.mech);
    if (mech?.mech) mech.mech.doubleKillUsed = true;
  }

  // 女巫
  let savedSeat: number | undefined;
  let poisonSeat: number | undefined;
  const witchP = players.find((p) => p.role === 'witch');
  if (witchP) witchP.potions ??= { saveUsed: false, poisonUsed: false };
  if (!voided(saveA) && saveA.targets.length) {
    savedSeat = saveA.targets[0];
    if (witchP?.potions) witchP.potions.saveUsed = true;
  }
  if (!voided(poisonA) && poisonA.targets.length) {
    poisonSeat = poisonA.targets[0];
  }

  // 机械狼学得毒药
  const mechP = players.find((p) => p.mech && p.mech.learned !== false);
  let mechPoisonSeat: number | undefined;
  const mechPoisonA = poisonA && poisonA.role === 'mechWolf' ? poisonA : undefined;
  if (!voided(mechPoisonA) && mechPoisonA?.targets.length) {
    mechPoisonSeat = mechPoisonA.targets[0];
  }

  // 猎魔人狩猎
  let huntSeat: number | undefined;
  if (!voided(huntA) && huntA.targets.length) huntSeat = huntA.targets[0];

  // ---------- 死亡集合 ----------
  const deaths = new Map<number, { cause: string; extra: string[] }>();
  const die = (seat: number, cause: string) => {
    if (seat === undefined) return;
    if (deaths.has(seat)) deaths.get(seat)!.extra.push(cause);
    else deaths.set(seat, { cause, extra: [] });
  };
  const isDreamed = (s: number) => s === dreamSeat;

  // 1. 狼刀
  if (knifeSeat !== undefined) {
    const guarded = knifeSeat === guardedSeat;
    const saved = knifeSeat === savedSeat;
    if (guarded && saved) {
      die(knifeSeat, 'wolf'); // 同守同救：出局且解药视为已用
      result.goodMistakes.push(`同守同救(${knifeSeat}号)`);
    } else if (guarded || saved) {
      // 守中 / 救起：不死
      if (saved && witchP?.potions) witchP.potions.saveUsed = true;
    } else if (!isDreamed(knifeSeat)) {
      die(knifeSeat, 'wolf');
    }
  }
  // 2. 机械狼双刀：必死（破盾）
  if (doubleKillSeat !== undefined && !isDreamed(doubleKillSeat)) {
    die(doubleKillSeat, 'doubleKill');
  }
  // 3. 女巫毒药
  if (poisonSeat !== undefined) {
    const t = bySeat(poisonSeat);
    if (witchP?.potions) witchP.potions.poisonUsed = true;
    if (t?.role === 'demonHunter') {
      // 毒杀猎魔人：不出局且毒药视为已用 → 好人失误
      result.goodMistakes.push(`毒杀猎魔人(${poisonSeat}号)`);
    } else if (isDreamed(poisonSeat)) {
      // 梦游吃毒：无效且视为已用 → 好人失误
      result.goodMistakes.push(`梦游吃毒(${poisonSeat}号)`);
    } else if (mechGuardReflect(poisonSeat, guardedSeat, players)) {
      // 机械狼学守卫守护目标 → 毒药反弹毒死女巫
      if (witchP) die(witchP.seat, 'reflected');
    } else {
      die(poisonSeat, 'poison');
      if (knifeSeat === poisonSeat) {
        result.goodMistakes.push(`同刀同毒(${poisonSeat}号)`);
      }
      if (huntSeat === poisonSeat) {
        result.goodMistakes.push(`同狩同毒(${poisonSeat}号)`);
      }
    }
  }
  // 4. 机械狼毒药（学得女巫毒）
  if (mechPoisonSeat !== undefined) {
    const mech = mechP?.mech;
    if (mech) mech.poisonUsed = true;
    if (!isDreamed(mechPoisonSeat)) {
      // 是否无视解药：版型开关（默认 false = 普通毒药，可被解？毒药本就不吃解药，开关含义为是否无视守卫等）
      die(mechPoisonSeat, board.mechPoisonIgnoresSave ? 'mechPoisonIgnore' : 'poison');
    }
  }
  // 5. 猎魔人狩猎
  if (huntSeat !== undefined) {
    const t = bySeat(huntSeat);
    const hunter = players.find((p) => p.role === 'demonHunter');
    if (t && ROLES[t.role].camp === 'wolf') {
      if (!isDreamed(huntSeat)) die(huntSeat, 'hunt');
    } else if (hunter) {
      die(hunter.seat, 'huntFail'); // 狩猎好人：猎魔人出局
      result.goodMistakes.push(`狩猎好人(${huntSeat}号)`);
    }
    if (knifeSeat === huntSeat) result.goodMistakes.push(`同刀同狩(${huntSeat}号)`);
  }
  // 6. 查验杀（纯白 ↔ 狼巫，自第二夜；恐惧封锁无效化已由 voided 处理）
  for (const ca of checksA) {
    if (voided(ca) || !ca.targets.length) continue;
    const target = bySeat(ca.targets[0]);
    if (!target) continue;
    if (ca.role === 'pureWhite' && night >= 2 && ROLES[target.role].camp === 'wolf') {
      die(target.seat, 'check');
    }
    if (ca.role === 'wolfWitch' && night >= 2 && target.role === 'pureWhite') {
      die(target.seat, 'check');
    }
  }
  // 7. 梦亡：连两夜同一梦游者
  if (dreamSeat !== undefined && dreamWeaverP?.alive) {
    // lastDreamTarget 已更新为今晚目标；连守判定用「昨夜目标」
    // 由调用方在行动录入时校验，这里依赖 nightActions 历史推断：
    const prev = prevDreamTarget(playersIn, actions);
    if (prev !== undefined && prev === dreamSeat) die(dreamSeat, 'dream');
  }
  // 8. 摄梦人夜间出局 → 当夜梦游者同亡
  const dreamWeaverDies = dreamWeaverP ? deaths.has(dreamWeaverP.seat) : false;
  if (dreamWeaverDies && dreamSeat !== undefined) {
    die(dreamSeat, 'dream');
    result.goodMistakes.push(`摄梦人出局连带梦亡(${dreamSeat}号)`);
  }
  // 9. 血月使徒再入夜结算（放逐不死后与其当夜击杀目标一同出局）
  const bloodP = players.find((p) => p.role === 'bloodMoon');
  if (bloodP && !bloodP.alive === false) {
    const pending = bloodP && knifeAffectsBloodMoon(playersIn, night);
    if (pending && bloodP.alive) {
      die(bloodP.seat, 'bloodMoon');
      if (knifeSeat !== undefined) die(knifeSeat, 'bloodMoon');
    }
  }

  // ---------- 查验结果（供法官展示） ----------
  for (const ca of checksA) {
    if (!ca.targets.length) continue;
    if (ca.kind === 'mathCheck') {
      const [a, b] = ca.targets;
      const pa = bySeat(a); const pb = bySeat(b);
      if (pa && pb) {
        const trickA = actions.find((x) => x.kind === 'trick' && x.targets.includes(a));
        const trickB = actions.find((x) => x.kind === 'trick' && x.targets.includes(b));
        let same = ROLES[pa.role].camp === ROLES[pb.role].camp;
        if (trickA || trickB) same = !same; // 诡计反转
        result.checks.push({
          actorSeat: ca.actorSeat, kind: 'mathCheck', target: a,
          result: same ? `等式成立：${a}号与${b}号同阵营` : `等式不成立：${a}号与${b}号不同阵营`,
        });
        // 数学家护盾：首次验出不等式 → 次夜护盾
        const math = players.find((p) => p.role === 'mathematician');
        if (math && !same && !math.shieldNight) math.shieldNight = night + 1;
      }
      continue;
    }
    const t = bySeat(ca.targets[0]);
    if (!t) continue;
    if (ca.kind === 'checkCamp') {
      result.checks.push({
        actorSeat: ca.actorSeat, kind: 'checkCamp', target: t.seat,
        result: ROLES[t.role].camp === 'wolf' ? `${t.seat}号是狼人` : `${t.seat}号是好人`,
      });
    } else {
      result.checks.push({
        actorSeat: ca.actorSeat, kind: 'checkIdentity', target: t.seat,
        result: `${t.seat}号是${ROLES[t.role].name}`,
      });
    }
  }

  // ---------- 机械狼刀权更新（其他狼全出局） ----------
  for (const p of players) {
    if (p.mech && p.alive) p.mech.hasKnifeRight = allOtherWolvesOut(players, p.seat);
  }

  // ---------- 应用死亡 ----------
  const deathRecords: DeathRecord[] = [];
  for (const [seat, d] of deaths) {
    const p = bySeat(seat);
    if (p && p.alive) {
      p.alive = false;
      p.deathCause = d.cause;
      p.deathAt = { night };
      deathRecords.push({ seat, cause: d.cause, night, extra: d.extra } as DeathRecord);
    }
  }
  result.deaths = deathRecords;
  return { result, players };
}

/** 机械狼学守卫守护的目标是否被毒（反弹判定） */
function mechGuardReflect(poisonSeat: number, guardedSeat: number | undefined, players: Player[]): boolean {
  if (guardedSeat === undefined || poisonSeat !== guardedSeat) return false;
  const mech = players.find((p) => typeof p.mech?.learned === 'object' && p.mech.learned.skill === 'guard' && p.alive);
  return !!mech;
}

/** 推断上一夜梦游目标（从玩家状态快照的 lastDreamTarget 语义回退） */
function prevDreamTarget(playersIn: Player[], _actions: NightAction[]): number | undefined {
  // nightPlan 已在录入时校验连梦；此处用行动历史不可得（仅当夜行动传入），
  // 简化处理：由 stateMachine 在调用前把 playersIn 中 dreamWeaver.lastDreamTarget 保留为「昨夜」值，
  // 本函数返回该值。
  const dw = playersIn.find((p) => p.role === 'dreamWeaver');
  return dw?.lastDreamTarget;
}

/** 血月使徒再入夜标记（stateMachine 在放逐阶段设置 bloodMoonPending） */
function knifeAffectsBloodMoon(playersIn: Player[], _night: number): boolean {
  // M1 简化：由 bloodMoonPending 夜序判断；pending 夜 = 下一个 night
  return playersIn.some((p) => p.role === 'bloodMoon' && p.alive && p.deathAt === undefined);
}

/** 学习结算：机械狼 learn 行动 → 更新 mech 状态（在学习当晚调用） */
export function applyLearn(playersIn: Player[], learnAction: NightAction): Player[] {
  const players = playersIn.map((p) => ({ ...p }));
  const mech = players.find((p) => p.mech);
  const target = players.find((p) => p.seat === learnAction.targets[0]);
  if (mech?.mech && mech.mech.learned === false && target) {
    mech.mech.learned = {
      targetSeat: target.seat,
      night: learnAction.night,
      skill: mechSkillOf(target.role),
    };
  }
  return players;
}
