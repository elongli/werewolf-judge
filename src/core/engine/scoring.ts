/**
 * 积分引擎：《规则提取文档》§5 全表 + data/scoreRules.ts 参数包
 * M1 实现可从结构化记录自动推导的部分；需现场主观判定的项（点狼点神、
 * 狼王带走带药女巫的具体药量、狼美人魅惑带走等）提供手动微调通道（violations 可录正负值）
 */
import { ROLES } from '../data/roles';
import { BEHAVIOR_SCORES, SCORE_PACKS, SPECIAL_SCORES, VOTE_SCORES } from '../data/scoreRules';
import type {
  AwardInput, BoardConfig, GameState, NightAction, Player, ScoreRecord, ViolationInput,
} from '../types';

export interface ScoreExtra {
  awards?: AwardInput;
  violations?: ViolationInput[];
}

export function computeScores(board: BoardConfig, state: GameState, extra: ScoreExtra = {}): ScoreRecord[] {
  const pack = SCORE_PACKS[board.scorePack];
  const recs: ScoreRecord[] = [];
  const push = (seat: number, ruleId: string, value: number, reason: string) =>
    recs.push({ seat, ruleId, value, reason });

  const campOf = (p: Player) => ROLES[p.role].camp;
  const isGood = (p: Player) => campOf(p) !== 'wolf';
  const bySeat = (s: number) => state.players.find((p) => p.seat === s);

  // ---------- 1. 胜负分 ----------
  for (const p of state.players) {
    const won = state.winner ? (state.winner === 'wolf' ? campOf(p) === 'wolf' : isGood(p)) : false;
    push(p.seat, 'win', won ? pack.winScore : pack.loseScore,
      won ? '获胜阵营' : '失败阵营');
  }

  // ---------- 2. 行为分 ----------
  const acts = state.nightActions;
  const deathOf = (seat: number) =>
    state.nightResults.flatMap((r) => r.deaths).find((d) => d.seat === seat);

  for (const p of state.players) {
    const myActs = acts.filter((a) => a.actorSeat === p.seat);
    switch (p.role) {
      case 'witch': {
        const poison = myActs.find((a) => a.kind === 'poison');
        if (poison) {
          const t = bySeat(poison.targets[0] ?? -1);
          const d = deathOf(poison.targets[0] ?? -1);
          if (t && campOf(t) === 'wolf') {
            // 豁免：吞毒自爆/同时被梦亡的狼人不加分（M1 以死因近似判断）
            const dreamDeath = d?.cause === 'dream';
            if (!dreamDeath) push(p.seat, 'witchPoisonWolf', BEHAVIOR_SCORES.witchPoisonWolf, `毒杀狼人${t.seat}号`);
          } else if (t && isGood(t)) {
            push(p.seat, 'witchPoisonGood', BEHAVIOR_SCORES.witchPoisonGood, `毒杀好人${t.seat}号`);
          }
        }
        break;
      }
      case 'guard': {
        let saves = 0;
        for (const g of myActs.filter((a) => a.kind === 'guard')) {
          const knife = acts.find((a) => a.kind === 'kill' && a.night === g.night);
          if (knife && knife.targets[0] === g.targets[0]) {
            const t = bySeat(g.targets[0] ?? -1);
            const sameSave = !!state.nightResults.find((r) =>
              r.night === g.night && r.goodMistakes.some((m) => m.includes('同守同救')));
            if (t && isGood(t) && !sameSave && saves < pack.guardSaveCap) {
              saves += 0.5;
              push(p.seat, 'guardSave', BEHAVIOR_SCORES.guardSaveGood, `第${g.night}夜守中${t.seat}号`);
            }
          }
        }
        for (const r of state.nightResults) {
          if (r.goodMistakes.some((m) => m.includes('同守同救'))) {
            const knife = acts.find((a) => a.kind === 'kill' && a.night === r.night);
            const t = knife ? bySeat(knife.targets[0] ?? -1) : undefined;
            if (t && isGood(t)) push(p.seat, 'guardSameSave', BEHAVIOR_SCORES.guardSameSavePenalty, `第${r.night}夜同守同救`);
          }
        }
        break;
      }
      case 'seer': case 'medium': {
        if (state.sheriff === p.seat) push(p.seat, 'badge', BEHAVIOR_SCORES.seerBadge, '警长竞选获警徽');
        const d1 = state.dayResults.find((d) => d.day === 1 && d.exiled !== null);
        if (d1) {
          const ex = bySeat(d1.exiled!);
          if (ex && campOf(ex) === 'wolf') push(p.seat, 'day1WolfOut', BEHAVIOR_SCORES.seerDay1WolfOut, '第一天有狼人被放逐');
        }
        // 无有效验人 −0.5（可验对象查尽不扣）
        const checks = myActs.filter((a) => a.kind === 'checkCamp' || a.kind === 'checkIdentity');
        const missed = state.nightResults.length - checks.length;
        if (missed > 0) {
          const lastCheck = checks.length ? Math.max(...checks.map((c) => c.night)) : 0;
          for (let n = Math.max(1, lastCheck + 1); n <= state.nightResults.length; n++) {
            const aliveThen = state.players.filter((x) => x.seat !== p.seat);
            if (aliveThen.length > 0) {
              push(p.seat, 'noCheck', BEHAVIOR_SCORES.seerNoCheckPenalty, `第${n}夜无有效验人`);
            }
          }
        }
        break;
      }
      case 'mathematician': {
        if (p.shieldNight) push(p.seat, 'mathShield', BEHAVIOR_SCORES.mathShield, '激活护盾效果');
        const checks = myActs.filter((a) => a.kind === 'mathCheck').length;
        if (checks === 0 && state.nightResults.length > 1) {
          push(p.seat, 'noCheck', BEHAVIOR_SCORES.mathNoCheckPenalty, '无有效验人');
        }
        break;
      }
      case 'pureWhite': {
        if (state.sheriff === p.seat) push(p.seat, 'badge', BEHAVIOR_SCORES.pureWhiteBadge, '警长竞选获警徽');
        let kills = 0;
        for (const my of myActs.filter((a) => a.kind === 'checkIdentity')) {
          const d = deathOf(my.targets[0] ?? -1);
          const t = bySeat(my.targets[0] ?? -1);
          if (d?.cause === 'check' && t && campOf(t) === 'wolf' && my.night >= 2 && kills < pack.pureWhiteKillCap) {
            kills += 1;
            push(p.seat, 'pwKillWolf', BEHAVIOR_SCORES.pureWhiteBadge === 0.5 ? 0.5 : 0.5, `第${my.night}夜查验致${t.seat}号出局`);
          }
        }
        if (p.deathCause === 'check') push(p.seat, 'pwKilled', BEHAVIOR_SCORES.pureWhiteKilledPenalty, '被狼巫查验出局');
        break;
      }
      case 'wolfWitch': {
        for (const my of myActs.filter((a) => a.kind === 'checkIdentity')) {
          const t = bySeat(my.targets[0] ?? -1);
          const d = deathOf(my.targets[0] ?? -1);
          if (t?.role === 'pureWhite' && d?.cause === 'check' && my.night >= 2) {
            push(p.seat, 'wwKillPW', BEHAVIOR_SCORES.wolfWitchKillPureWhite, `第${my.night}夜查验致纯白出局`);
          }
        }
        if (p.deathCause === 'check') push(p.seat, 'wwKilled', BEHAVIOR_SCORES.wolfWitchKilledPenalty, '被纯白之女查验出局');
        break;
      }
      case 'wolfKing': {
        // TODO M2：开枪带走带药女巫的具体药量需死亡时点药状态；M1 按身份给分
        if (p.deathCause === 'poison' || p.deathCause === 'dream') {
          push(p.seat, 'wkPoisoned', BEHAVIOR_SCORES.wolfKingPoisonedPenalty, '被毒杀/被梦亡');
        }
        break;
      }
      case 'nightmare': {
        let fears = 0;
        for (const f of myActs.filter((a) => a.kind === 'fear')) {
          const t = bySeat(f.targets[0] ?? -1);
          if (!t) continue;
          if (campOf(t) === 'wolf') {
            push(p.seat, 'fearWolf', BEHAVIOR_SCORES.fearWolfPenalty, `恐惧到狼人${t.seat}号`);
          } else if (['witch', 'dreamWeaver', 'guard'].includes(t.role) && fears < pack.fearCap) {
            fears += 1;
            push(p.seat, 'fearKey', BEHAVIOR_SCORES.fearKeyRole, `第${f.night}夜恐惧${t.seat}号`);
          }
        }
        break;
      }
      case 'bloodMoon': {
        if (p.alive && state.winner) push(p.seat, 'bmSurvive', BEHAVIOR_SCORES.bloodMoonSurvive, '存活到游戏结束');
        if (p.deathCause === 'poison' || p.deathCause === 'hunt') {
          push(p.seat, 'bmPoisoned', BEHAVIOR_SCORES.bloodMoonPoisonedPenalty, '被毒杀/被猎杀');
        }
        break;
      }
      case 'demonHunter': {
        let hunts = 0;
        for (const h of myActs.filter((a) => a.kind === 'hunt')) {
          const t = bySeat(h.targets[0] ?? -1);
          const d = deathOf(h.targets[0] ?? -1);
          if (t && d?.cause === 'hunt' && campOf(t) === 'wolf' && hunts < pack.huntCap) {
            hunts += 1;
            push(p.seat, 'huntWolf', BEHAVIOR_SCORES.huntWolf, `第${h.night}夜狩猎${t.seat}号`);
          }
        }
        if (p.deathCause === 'huntFail') push(p.seat, 'huntGood', BEHAVIOR_SCORES.huntGood, '狩猎好人失败出局');
        break;
      }
      case 'dreamWeaver': {
        let points = 0;
        for (const d of myActs.filter((a) => a.kind === 'dream')) {
          const t = bySeat(d.targets[0] ?? -1);
          const death = deathOf(d.targets[0] ?? -1);
          if (!t) continue;
          if (death?.cause === 'dream' && campOf(t) === 'wolf' && points < pack.dreamSaveCap) {
            points += 0.5;
            push(p.seat, 'dwDreamKillWolf', BEHAVIOR_SCORES.dreamSaveGood, `梦亡狼人${t.seat}号`);
          } else if (death?.cause === 'wolf' && isGood(t)) {
            push(p.seat, 'dwSaveGood', 0, `守中好人${t.seat}号（本应+0.5，见TODO）`);
          } else if (death?.cause === 'dream' && isGood(t)) {
            push(p.seat, 'dwDreamKillGood', BEHAVIOR_SCORES.dreamKillGood, `梦亡好人${t.seat}号`);
          }
        }
        break;
      }
      case 'trickWolf': {
        const tricks = myActs.filter((a) => a.kind === 'trick');
        for (const t of tricks) {
          const target = t.targets[0];
          const affected = acts.find((a) => a.kind === 'mathCheck' && a.night === t.night && a.targets.includes(target));
          if (affected) {
            push(p.seat, 'trickEffect', BEHAVIOR_SCORES.trickEffect, `第${t.night}夜诡计生效`);
            break;
          }
        }
        break;
      }
      case 'mechWolf': {
        const mech = p.mech;
        if (mech?.learned && mech.learned.skill !== 'none') {
          const learnedNight = mech.learned.night;
          const used = acts.find((a) =>
            a.role === 'mechWolf' && a.night > learnedNight && a.kind !== 'none' && a.targets.length > 0);
          if (used) push(p.seat, 'mechUsed', BEHAVIOR_SCORES.mechSkillUsed, `学得技能（${mech.learned.skill}）成功使用`);
          else push(p.seat, 'mechUnused', BEHAVIOR_SCORES.mechSkillUnused, '学习后未使用或使用失败');
        }
        break;
      }
      case 'knight': {
        if (p.deathCause === 'duel') push(p.seat, 'knightDuelGood', BEHAVIOR_SCORES.knightDuelGood, '决斗好人出局');
        else if (state.winner && p.alive) push(p.seat, 'knightDuelWolf', BEHAVIOR_SCORES.knightDuelWolf, '决斗狼人成功');
        break;
      }
      default:
        break;
    }
  }

  // 猎人/狼王开枪（day 页连锁）：放逐者可开枪且 chainDeaths 命中 → 按目标身份记枪手
  for (const dr of state.dayResults) {
    if (dr.exiled === null || dr.chainDeaths.length === 0) continue;
    const shooter = bySeat(dr.exiled);
    if (!shooter || !ROLES[shooter.role].shotRule) continue;
    const first = bySeat(dr.chainDeaths[0].seat);
    if (!first) continue;
    if (campOf(first) === 'wolf') push(shooter.seat, 'shootWolf', BEHAVIOR_SCORES.hunterShootWolf, `开枪带走狼人${first.seat}号`);
    else push(shooter.seat, 'shootGood', BEHAVIOR_SCORES.hunterShootGood, `开枪带走好人${first.seat}号`);
  }

  // ---------- 3. 投票分 ----------
  // 不计票身份：预言家/通灵师/纯白之女/狼人（按版型实际配置生效）
  const noVoteRoles = new Set(state.players.filter((p) =>
    ['seer', 'medium', 'pureWhite'].includes(p.role) || campOf(p) === 'wolf').map((p) => p.seat));

  const hitCount = new Map<number, number>(); // 命中上限按整局累计，跨天生效

  for (const day of uniqueDays(state)) {
    const r1 = state.votes.filter((v) => v.day === day && v.round === 1 && !v.sheriffVote);
    const r2 = state.votes.filter((v) => v.day === day && v.round === 2 && !v.sheriffVote);
    const pkSeats = pkSeatsOf(state, day); // PK 台玩家（round1 平票最高票座位）

    for (const v of r1) {
      if (noVoteRoles.has(v.voter)) continue;
      // 有二次票（进入 PK）：台玩家以第一次票为准，非台玩家以第二次票为准（第一次忽略）
      if (r2.length > 0 && !pkSeats.includes(v.voter)) continue;
      applyVoteScore(v, push, bySeat, hitCount, pack.voteHitCap);
    }
    for (const v of r2) {
      if (noVoteRoles.has(v.voter)) continue;
      if (pkSeats.includes(v.voter)) continue;
      // PK 台全好人时，第一次投狼者第二次弃票不计分（规则4）
      const firstVote = r1.find((x) => x.voter === v.voter);
      const allGoodOnPk = pkSeats.length > 0 && pkSeats.every((s) => {
        const pk = bySeat(s);
        return pk ? isGood(pk) : false;
      });
      if (v.target === null && allGoodOnPk && firstVote) {
        const ft = bySeat(firstVote.target ?? -1);
        if (ft && campOf(ft) === 'wolf') continue;
      }
      applyVoteScore(v, push, bySeat, hitCount, pack.voteHitCap);
    }
  }

  // ---------- 4. 特殊分 ----------
  if (state.winner === 'wolf') {
    const wolves = state.players.filter((p) => campOf(p) === 'wolf');
    const aliveWolves = wolves.filter((p) => p.alive);
    // 狼胜存活≥2 且狼队最高票 ≥ 好人最高票（以最后一次放逐票型近似）
    const lastDay = Math.max(...state.dayResults.map((d) => d.day), 0);
    if (lastDay > 0 && aliveWolves.length >= 2) {
      const r1 = state.votes.filter((v) => v.day === lastDay && v.round === 1);
      let wolfMax = 0; let goodMax = 0;
      const tally = new Map<number, number>();
      for (const v of r1) { if (v.target !== null) tally.set(v.target, (tally.get(v.target) ?? 0) + 1); }
      for (const [seat, n] of tally) {
        const t = bySeat(seat);
        if (!t) continue;
        if (campOf(t) === 'wolf') wolfMax = Math.max(wolfMax, n); else goodMax = Math.max(goodMax, n);
      }
      if (wolfMax >= goodMax) {
        for (const w of wolves) push(w.seat, 'wolfMajority', SPECIAL_SCORES.wolfWinMajority, '狼队票数压制获胜');
      }
    }
    // 连刀：自第二夜起连续击杀同阵营直至获胜
    const wolfKills = state.nightResults
      .map((r) => acts.find((a) => a.kind === 'kill' && a.night === r.night))
      .filter((a): a is NightAction => !!a && a.targets.length > 0);
    const campsFromNight2 = wolfKills.filter((a) => a.night >= 2)
      .map((a) => { const t = bySeat(a.targets[0]); return t ? campOf(t) : ''; });
    const consecutive = campsFromNight2.length >= 2 && campsFromNight2.every((c) => c === campsFromNight2[0]);
    if (consecutive) {
      for (const w of wolves) push(w.seat, 'wolfConsecutive', SPECIAL_SCORES.wolfConsecutiveKill, '自第二夜连杀同阵营至获胜');
    }
  }

  if (state.winner === 'good') {
    const noMistake = state.nightResults.every((r) => r.goodMistakes.length === 0);
    if (noMistake) {
      for (const p of state.players.filter(isGood)) {
        push(p.seat, 'goodNoMistake', SPECIAL_SCORES.goodNoMistake, '好人阵营获胜无失误');
      }
    }
  }

  if (state.sheriff !== undefined) {
    const sh = bySeat(state.sheriff);
    if (sh && campOf(sh) === 'wolf') push(sh.seat, 'wolfBadge', SPECIAL_SCORES.wolfBadge, '警长竞选中获得警徽的狼人');
  }

  // TODO M2：首夜出局点狼/点神（现场口述判定，M1 经 violations 手动录入 +pointScore）

  // ---------- 5. 评选分 ----------
  const { awards } = extra;
  if (awards?.mvp !== undefined) push(awards.mvp, 'mvp', SPECIAL_SCORES.mvp, 'MVP');
  if (awards?.svp !== undefined) push(awards.svp, 'svp', SPECIAL_SCORES.svp, 'SVP');
  if (awards?.beiguo !== undefined) push(awards.beiguo, 'beiguo', SPECIAL_SCORES.beiguo, '背锅');

  // ---------- 6. 违规扣分 / 手动微调（可正可负） ----------
  for (const v of extra.violations ?? []) {
    push(v.seat, `violation:${v.type}`, v.value, v.note ?? '违规/微调');
  }

  return recs;
}

function applyVoteScore(
  v: { voter: number; target: number | null },
  push: (seat: number, id: string, val: number, reason: string) => void,
  bySeat: (s: number) => Player | undefined,
  hitCount: Map<number, number>,
  cap: number,
): void {
  if (v.target === null) {
    push(v.voter, 'voteAbstain', VOTE_SCORES.hitGoodOrAbstain, '弃票');
    return;
  }
  const t = bySeat(v.target);
  if (!t) return;
  if (ROLES[t.role].camp === 'wolf') {
    const n = hitCount.get(v.voter) ?? 0;
    if (n < cap) {
      hitCount.set(v.voter, n + 0.5);
      push(v.voter, 'voteHit', VOTE_SCORES.hitWolf, `放逐投票投给狼人${t.seat}号`);
    }
  } else {
    push(v.voter, 'voteMiss', VOTE_SCORES.hitGoodOrAbstain, `放逐投票投给好人${t.seat}号`);
  }
}

function uniqueDays(state: GameState): number[] {
  const days = new Set<number>();
  for (const v of state.votes) days.add(v.day);
  return [...days];
}

/** PK 台座位（该日 round1 平票的最高票座位） */
function pkSeatsOf(state: GameState, day: number): number[] {
  const dr = state.dayResults.find((d) => d.day === day);
  if (!dr || !dr.tie) return [];
  const r1 = state.votes.filter((v) => v.day === day && v.round === 1 && v.target !== null);
  const tally = new Map<number, number>();
  for (const v of r1) tally.set(v.target!, (tally.get(v.target!) ?? 0) + 1);
  const max = Math.max(0, ...tally.values());
  return [...tally.entries()].filter(([, n]) => n === max).map(([s]) => s);
}

/** 单局合计 */
export function computeTotals(records: ScoreRecord[]): Map<number, number> {
  const totals = new Map<number, number>();
  for (const r of records) totals.set(r.seat, (totals.get(r.seat) ?? 0) + r.value);
  return totals;
}
