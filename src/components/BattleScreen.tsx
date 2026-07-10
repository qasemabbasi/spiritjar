import { useState, useEffect, useCallback } from 'react';
import { CardDefinition, CardInstance, FieldSpirit, PlayerState, TurnPhase, GameLogEntry, ReactionContext } from '../types';
import { BASE_CARDS } from '../data/cards';
import { CardView } from './CardView';
import { FieldUnitView } from './FieldUnitView';
import { sounds } from '../utils/audio';
import confetti from 'canvas-confetti';

interface BattleScreenProps {
  p1Selected: string[];
  p2Selected: string[];
  p2IsBot?: boolean;
  onRestart: () => void;
}

const STARTING_LEADER_HP = 10;
const MAX_PSY = 10;
const FIELD_LIMIT = 3;
const HAND_LIMIT = 5;
const FLAME_BURN_AMOUNT = 2;
const MAX_BURN = 4;

function clonePlayers(players: PlayerState[]): PlayerState[] {
  return players.map(player => ({
    ...player,
    hand: [...player.hand],
    field: player.field.map(unit => ({ ...unit, keywords: [...unit.keywords] }))
  }));
}

function makeInstance(cardId: string, originalOwner: 0 | 1, prefix: string): CardInstance {
  return {
    instanceId: `${prefix}_${cardId}_${Math.random().toString(36).slice(2, 8)}`,
    cardId,
    originalOwner
  };
}

function makeSpirit(instance: CardInstance, turnCount: number, currentPlayer: 0 | 1): FieldSpirit {
  const def = BASE_CARDS[instance.cardId];

  return {
    instanceId: instance.instanceId,
    cardId: def.id,
    currentHp: def.hp,
    maxHp: def.hp,
    atk: def.atk,
    keywords: [...def.keywords],
    canAttackThisTurn: def.keywords.includes('rush'),
    summonedTurn: turnCount,
    burn: 0,
    originalOwner: instance.originalOwner ?? currentPlayer,
    swordBuffedThisTurn: false,
    developed: false
  };
}


function getOwnershipLabel(originalOwner: number, perspectivePlayerIdx: 0 | 1, controllerIdx?: 0 | 1): string {
  if (originalOwner === perspectivePlayerIdx) {
    return controllerIdx !== undefined && controllerIdx !== perspectivePlayerIdx ? 'BOUND TO YOU' : 'BOUND';
  }
  return controllerIdx !== undefined && controllerIdx !== perspectivePlayerIdx ? 'ENEMY BOUND' : 'BORROWED';
}

function getBoundGhostsOnEitherField(players: PlayerState[], ownerIdx: 0 | 1): Array<{ unit: FieldSpirit; controllerIdx: 0 | 1 }> {
  return players.flatMap((player, pIdx) =>
    player.field
      .filter(unit => unit.currentHp > 0 && !unit.keywords.includes('token') && unit.originalOwner === ownerIdx)
      .map(unit => ({ unit, controllerIdx: pIdx as 0 | 1 }))
  );
}

function sortClaimTargets(targets: Array<{ unit: FieldSpirit; controllerIdx: 0 | 1 }>, preferOpponentIdx?: 0 | 1): Array<{ unit: FieldSpirit; controllerIdx: 0 | 1 }> {
  return [...targets].sort((a, b) => {
    if (preferOpponentIdx !== undefined) {
      const aOnPreferred = a.controllerIdx === preferOpponentIdx ? 1 : 0;
      const bOnPreferred = b.controllerIdx === preferOpponentIdx ? 1 : 0;
      if (bOnPreferred !== aOnPreferred) return bOnPreferred - aOnPreferred;
    }
    const aCost = BASE_CARDS[a.unit.cardId]?.cost ?? 0;
    const bCost = BASE_CARDS[b.unit.cardId]?.cost ?? 0;
    if (b.unit.atk !== a.unit.atk) return b.unit.atk - a.unit.atk;
    return bCost - aCost;
  });
}

function shuffleDeck(deck: CardInstance[]): CardInstance[] {
  const copy = [...deck];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function hasValidUnitTarget(attacker: FieldSpirit, enemy: PlayerState, target?: FieldSpirit): boolean {
  if (!target) return false;

  const enemyTaunts = enemy.field.filter(unit => unit.keywords.includes('taunt'));
  if (enemyTaunts.length > 0 && !target.keywords.includes('taunt')) return false;

  // Cat Ghost cannot be targeted by non-Cat normal attacks.
  // Board-wide, Splash, Burn, and Bomb damage can still hit Cat.
  if (target.keywords.includes('cat') && !attacker.keywords.includes('cat')) return false;

  return true;
}

function canAttackLeaderTarget(attacker: FieldSpirit, enemy: PlayerState, currentTurn: number): boolean {
  if (attacker.keywords.includes('rush') && attacker.summonedTurn === currentTurn) return false;

  if (enemy.field.length === 0) return true;

  if (attacker.cardId === 'bite_ghost' && enemy.field.every(unit => unit.keywords.includes('token'))) {
    return true;
  }

  return false;
}

function hasValidAttackTarget(attacker: FieldSpirit, enemy: PlayerState, currentTurn: number): boolean {
  const validUnitTarget = enemy.field.some(target => hasValidUnitTarget(attacker, enemy, target));
  if (validUnitTarget) return true;

  return canAttackLeaderTarget(attacker, enemy, currentTurn);
}

function getValidAttackers(player: PlayerState, enemy: PlayerState, currentTurn: number): FieldSpirit[] {
  return player.field.filter(unit => unit.canAttackThisTurn && hasValidAttackTarget(unit, enemy, currentTurn));
}

function getBestAiTarget(attacker: FieldSpirit, enemy: PlayerState): FieldSpirit | undefined {
  if (attacker.cardId === 'bite_ghost' && enemy.field.length > 0 && enemy.field.every(target => target.keywords.includes('token'))) {
    return undefined;
  }

  const validTargets = enemy.field.filter(target => hasValidUnitTarget(attacker, enemy, target));
  if (validTargets.length === 0) return undefined;

  const taunts = validTargets.filter(target => target.keywords.includes('taunt'));
  const pool = taunts.length > 0 ? taunts : validTargets;

  return [...pool].sort((a, b) => {
    const aLethal = attacker.atk >= a.currentHp ? 1 : 0;
    const bLethal = attacker.atk >= b.currentHp ? 1 : 0;
    if (bLethal !== aLethal) return bLethal - aLethal;
    return BASE_CARDS[b.cardId].cost - BASE_CARDS[a.cardId].cost;
  })[0];
}

function canManifestCard(card: CardInstance, player: PlayerState): boolean {
  const def = BASE_CARDS[card.cardId];
  if (!def || player.currentPsy < def.cost || player.hasManifestedThisTurn) return false;

  if (def.id === 'bomb_ghost') return true;
  if (def.id === 'ritual_ghost') return player.field.filter(unit => unit.currentHp > 0).length >= 2;
  if (def.id === 'oathbreaker_ghost') {
    const ownerIdx = (player.id - 1) as 0 | 1;
    return player.field.length < FIELD_LIMIT || player.field.some(unit => unit.originalOwner === ownerIdx && !unit.keywords.includes('token'));
  }

  return player.field.length < FIELD_LIMIT;
}

function getBestAiManifestCard(player: PlayerState, enemy: PlayerState): CardInstance | undefined {
  const playable = player.hand.filter(card => canManifestCard(card, player));
  if (playable.length === 0) return undefined;

  return [...playable].sort((a, b) => {
    const scoreCard = (card: CardInstance) => {
      const def = BASE_CARDS[card.cardId];
      if (def.id === 'bomb_ghost') {
        const enemyNonCats = enemy.field.filter(unit => !unit.keywords.includes('cat')).length;
        const ownNonCats = player.field.filter(unit => !unit.keywords.includes('cat')).length;
        if (enemyNonCats >= 2 && enemyNonCats >= ownNonCats) return 100;
        return -50;
      }
      if (def.id === 'ritual_ghost') return player.field.length >= 2 ? 80 : -50;
      if (def.id === 'oathbreaker_ghost') {
        const ownerIdx = (player.id - 1) as 0 | 1;
        const enemyBound = enemy.field.filter(unit => unit.originalOwner === ownerIdx && !unit.keywords.includes('token'));
        if (enemyBound.length > 0) return 95;
        if (player.field.some(unit => unit.originalOwner === ownerIdx && unit.atk >= 2)) return 55;
        return -30;
      }
      if (def.id === 'possessor_ghost') {
        const ownerIdx = (player.id - 1) as 0 | 1;
        const reclaimable = enemy.field.some(unit => unit.originalOwner === ownerIdx && unit.currentHp < unit.maxHp && !unit.keywords.includes('token'));
        return reclaimable && player.field.length <= FIELD_LIMIT - 2 ? 90 : 5;
      }
      if (def.id === 'grave_caller') return 35;
      if (def.id === 'sword_ghost' && enemy.field.some(unit => unit.maxHp >= 5)) return 70;
      return def.cost * 10 + def.atk + def.hp;
    };

    return scoreCard(b) - scoreCard(a);
  })[0];
}

function sortSacrificeCandidates(field: FieldSpirit[]): FieldSpirit[] {
  return [...field].sort((a, b) => {
    const aToken = a.keywords.includes('token') ? 1 : 0;
    const bToken = b.keywords.includes('token') ? 1 : 0;
    if (bToken !== aToken) return bToken - aToken;
    const aCost = BASE_CARDS[a.cardId]?.cost ?? 0;
    const bCost = BASE_CARDS[b.cardId]?.cost ?? 0;
    if (aCost !== bCost) return aCost - bCost;
    return a.currentHp - b.currentHp;
  });
}

function healMostDamagedFriendly(player: PlayerState, amount: number): string | null {
  const damaged = player.field
    .filter(unit => unit.currentHp > 0 && unit.currentHp < unit.maxHp)
    .sort((a, b) => (b.maxHp - b.currentHp) - (a.maxHp - a.currentHp))[0];

  if (!damaged) return null;

  player.field = player.field.map(unit => {
    if (unit.instanceId !== damaged.instanceId) return unit;
    return { ...unit, currentHp: Math.min(unit.maxHp, unit.currentHp + amount) };
  });

  return BASE_CARDS[damaged.cardId].name;
}



function getReactionAttacker(ctx: ReactionContext, players: PlayerState[]): FieldSpirit | undefined {
  return players[ctx.sourcePlayerIndex]?.field.find(unit => unit.instanceId === ctx.sourceSpiritInstanceId);
}

function isHoldCardLegallyUsable(card: CardInstance, ctx: ReactionContext, players: PlayerState[]): boolean {
  const def = BASE_CARDS[card.cardId];
  if (!def?.hasHold || def.holdTrigger !== ctx.trigger) return false;

  const reactingPlayer = players[ctx.targetPlayerIndex];
  const sourcePlayer = players[ctx.sourcePlayerIndex];
  const attacker = getReactionAttacker(ctx, players);

  if (def.id === 'bomb_ghost') {
    return ctx.trigger === 'when_enemy_attacks' && !!attacker && !attacker.keywords.includes('cat');
  }

  if (def.id === 'flame_ghost') {
    return ctx.trigger === 'when_enemy_attacks' && !!attacker && attacker.burn < MAX_BURN;
  }

  if (def.id === 'fog_ghost') {
    return ctx.trigger === 'when_enemy_attacks' && !!attacker && sourcePlayer.field.length >= reactingPlayer.field.length + 2;
  }

  if (def.id === 'soldier_ghost') {
    return ctx.trigger === 'when_leader_damaged' && reactingPlayer.field.length < FIELD_LIMIT;
  }

  if (def.id === 'old_ghost') {
    return ctx.trigger === 'when_leader_damaged';
  }

  if (def.id === 'loud_ghost') {
    return ctx.trigger === 'when_enemy_summons_token' && sourcePlayer.field.some(unit => unit.keywords.includes('token'));
  }

  if (def.id === 'bones_ghost') {
    return ctx.trigger === 'when_spirit_defeated' && reactingPlayer.field.length < FIELD_LIMIT;
  }

  if (def.id === 'cat_ghost') {
    return ctx.trigger === 'when_targeted' && !!attacker;
  }

  if (def.id === 'sword_ghost') {
    return ctx.trigger === 'when_friendly_attacks' && !!attacker && !attacker.keywords.includes('cat') && !attacker.swordBuffedThisTurn;
  }

  return true;
}

function getAiReactionHoldScore(card: CardInstance, ctx: ReactionContext, players: PlayerState[]): number {
  if (!isHoldCardLegallyUsable(card, ctx, players)) return -999;

  const def = BASE_CARDS[card.cardId];
  const attacker = getReactionAttacker(ctx, players);
  const reactingPlayer = players[ctx.targetPlayerIndex];

  if (def.id === 'bomb_ghost') {
    if (!attacker) return -999;
    const attackerDef = BASE_CARDS[attacker.cardId];
    // Do not waste premium Bomb Hold on Wisps/small chip attackers unless the Leader would die.
    if (ctx.incomingDamage && ctx.incomingDamage >= reactingPlayer.leaderHp) return 100;
    if (attackerDef.cost >= 3 || attacker.atk >= 3) return 90;
    return -25;
  }

  if (def.id === 'flame_ghost') {
    if (!attacker) return -999;
    const attackerDef = BASE_CARDS[attacker.cardId];
    if (attacker.keywords.includes('token')) return -20;
    if (attacker.currentHp >= 3 || attacker.atk >= 3 || attackerDef.cost >= 3) return 70;
    return 10;
  }

  if (def.id === 'fog_ghost') {
    if (!attacker) return -999;
    if (players[ctx.sourcePlayerIndex].field.length < reactingPlayer.field.length + 2) return -999;
    if (ctx.incomingDamage && ctx.incomingDamage >= reactingPlayer.leaderHp) return 95;
    if (attacker.atk >= 3 || BASE_CARDS[attacker.cardId].cost >= 3) return 65;
    return 20;
  }

  if (def.id === 'sword_ghost') {
    if (!attacker || attacker.keywords.includes('cat') || attacker.swordBuffedThisTurn) return -999;
    const target = ctx.targetSpiritInstanceId
      ? players[ctx.sourcePlayerIndex === 0 ? 1 : 0]?.field.find(unit => unit.instanceId === ctx.targetSpiritInstanceId)
      : undefined;
    if (target) {
      const currentDamage = attacker.atk;
      const boostedDamage = attacker.atk + 2;
      if (currentDamage < target.currentHp && boostedDamage >= target.currentHp) return 80;
      return -20;
    }
    if ((ctx.incomingDamage || attacker.atk) + 2 >= players[ctx.sourcePlayerIndex === 0 ? 1 : 0].leaderHp) return 85;
    return -20;
  }

  if (def.id === 'soldier_ghost') {
    if ((ctx.incomingDamage || 0) >= reactingPlayer.leaderHp) return 95;
    return 45;
  }

  if (def.id === 'old_ghost') {
    if ((ctx.incomingDamage || 0) >= reactingPlayer.leaderHp) return 80;
    if (reactingPlayer.leaderHp <= STARTING_LEADER_HP - 3) return 35;
    return -10;
  }

  if (def.id === 'loud_ghost') return 35;
  if (def.id === 'bones_ghost') return 25;

  return 0;
}

function CardDetailPreview({ card }: { card: CardDefinition | null }) {
  if (!card) return null;

  return (
    <div className="pointer-events-none absolute left-1/2 bottom-[9.25rem] z-[120] w-[min(420px,calc(100%-2rem))] -translate-x-1/2 rounded-2xl border-2 border-cyan-400/80 bg-slate-950/98 p-4 text-left shadow-[0_0_45px_rgba(34,211,238,0.45)]">
      <div className="mb-2 flex items-start justify-between gap-4 border-b border-slate-800 pb-2">
        <div>
          <div className="text-lg font-black uppercase tracking-tight text-cyan-300">{card.name}</div>
          {card.keywords.length > 0 && (
            <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              {card.keywords.join(' • ')}
            </div>
          )}
        </div>
        <div className="rounded-full bg-cyan-500 px-3 py-1 text-sm font-black text-slate-950 shadow">{card.cost} Psy</div>
      </div>

      <div className="mb-3 grid grid-cols-2 rounded-xl border border-indigo-800/70 bg-indigo-950/70 py-2 text-center font-mono text-sm">
        <div><span className="font-black text-emerald-400">{card.hp}</span><span className="ml-1 text-slate-500">HP</span></div>
        <div><span className="font-black text-orange-400">{card.atk}</span><span className="ml-1 text-slate-500">ATK</span></div>
      </div>

      <div className="space-y-2 text-[12px] leading-snug text-slate-200">
        {card.manifestText && <div><span className="font-black text-cyan-400">MANIFEST:</span> {card.manifestText}</div>}
        {card.fieldText && <div><span className="font-black text-indigo-300">FIELD:</span> {card.fieldText}</div>}
        {card.attackText && <div><span className="font-black text-rose-400">ATTACK:</span> {card.attackText}</div>}
        {card.defeatText && <div><span className="font-black text-slate-400">DEFEAT:</span> {card.defeatText}</div>}
        {card.hasHold && <div><span className="font-black text-amber-400">HOLD:</span> {card.holdText}</div>}
        {card.boundText && <div><span className="font-black text-cyan-300">BOUND:</span> {card.boundText}</div>}
        {card.borrowedText && <div><span className="font-black text-fuchsia-300">BORROWED:</span> {card.borrowedText}</div>}
        {!card.manifestText && !card.fieldText && !card.attackText && !card.defeatText && !card.hasHold && !card.boundText && !card.borrowedText && (
          <div className="text-slate-400">No special rules.</div>
        )}
      </div>

    </div>
  );
}

function LeaderTarget({
  label,
  hp,
  maxHp,
  owner,
  isClickable = false,
  onClick
}: {
  label: string;
  hp: number;
  maxHp: number;
  owner: 'player' | 'enemy';
  isClickable?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={isClickable ? onClick : undefined}
      disabled={!isClickable}
      className={`w-24 h-24 rounded-2xl border-2 flex flex-col items-center justify-center shrink-0 transition-all ${
        isClickable
          ? 'bg-rose-600/30 border-rose-300 ring-4 ring-rose-400/70 shadow-[0_0_28px_rgba(244,63,94,0.65)] cursor-pointer hover:scale-105 animate-pulse'
          : owner === 'enemy'
          ? 'bg-indigo-950/70 border-indigo-500/50'
          : 'bg-cyan-950/60 border-cyan-500/50'
      }`}
    >
      <div className="text-3xl leading-none">🏺</div>
      <div className="text-[9px] uppercase tracking-widest font-black text-slate-300 mt-1">{label}</div>
      <div className="text-xl font-black font-mono text-rose-400">
        {hp < 10 ? `0${hp}` : hp}<span className="text-xs opacity-50">/{maxHp}</span>
      </div>
    </button>
  );
}

export function BattleScreen({ p1Selected, p2Selected, onRestart }: BattleScreenProps) {
  const [sharedDeck, setSharedDeck] = useState<CardInstance[]>([]);
  const [discardPile, setDiscardPile] = useState<CardInstance[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<0 | 1>(0);
  const [phase, setPhase] = useState<TurnPhase>('start');
  const [turnCount, setTurnCount] = useState<number>(1);
  const [winner, setWinner] = useState<PlayerState | null>(null);

  const [players, setPlayers] = useState<PlayerState[]>([
    {
      id: 1,
      name: 'Player 1',
      isBot: false,
      leaderHp: STARTING_LEADER_HP,
      maxPsy: 0,
      currentPsy: 0,
      hand: [],
      field: [],
      selectedCardIds: p1Selected,
      hasManifestedThisTurn: false,
      hasAttackedThisTurn: false,
      bonusPsyNextTurn: 0
    },
    {
      id: 2,
      name: 'Spirit Lord (AI)',
      isBot: true,
      leaderHp: STARTING_LEADER_HP,
      maxPsy: 0,
      currentPsy: 0,
      hand: [],
      field: [],
      selectedCardIds: p2Selected,
      hasManifestedThisTurn: false,
      hasAttackedThisTurn: false,
      bonusPsyNextTurn: 0
    }
  ]);

  const [selectedHandCardId, setSelectedHandCardId] = useState<string | null>(null);
  const [hoveredCard, setHoveredCard] = useState<CardDefinition | null>(null);
  const [pendingTargetHoldCard, setPendingTargetHoldCard] = useState<CardInstance | null>(null);
  const [autoplay, setAutoplay] = useState<boolean>(false);
  const [selectedAttackerId, setSelectedAttackerId] = useState<string | null>(null);
  const [reactionContext, setReactionContext] = useState<ReactionContext | null>(null);
  const [lastDestroyedGhosts, setLastDestroyedGhosts] = useState<Array<CardInstance | null>>([null, null]);
  const [log, setLog] = useState<GameLogEntry[]>([]);

  const addLog = useCallback((text: string, type: GameLogEntry['type']) => {
    setLog(prev => [
      ...prev,
      {
        id: Math.random().toString(36).slice(2, 9),
        text,
        type,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      }
    ]);
  }, []);

  const exhaustAttacker = useCallback((playerIdx: 0 | 1, attackerId: string) => {
    setPlayers(prev => {
      const copy = clonePlayers(prev);
      copy[playerIdx].field = copy[playerIdx].field.map(unit => {
        if (unit.instanceId !== attackerId) return unit;
        return { ...unit, canAttackThisTurn: false };
      });
      return copy;
    });
  }, []);

  const applyDamageToSpirit = useCallback((
    targetPlayerIdx: 0 | 1,
    targetId: string,
    damage: number,
    sourceCardId?: string,
    allowCatDamage = false
  ) => {
    setPlayers(prev => {
      const copy = clonePlayers(prev);
      copy[targetPlayerIdx].field = copy[targetPlayerIdx].field.map(unit => {
        if (unit.instanceId !== targetId) return unit;
        const updated = { ...unit, currentHp: unit.currentHp - damage };
        if (sourceCardId === 'flame_ghost' && damage > 0 && updated.currentHp > 0) {
          updated.burn = Math.min(MAX_BURN, updated.burn + FLAME_BURN_AMOUNT);
        }
        return updated;
      });
      return copy;
    });
  }, []);

  const resolveDefeatedUnits = useCallback(() => {
    setPlayers(prev => {
      let changed = false;
      const newPlayers = clonePlayers(prev).map((player, pIdx) => {
        const remainingField: FieldSpirit[] = [];
        const defeated: FieldSpirit[] = [];

        player.field.forEach(unit => {
          if (unit.currentHp <= 0) {
            defeated.push(unit);
            changed = true;
          } else {
            remainingField.push(unit);
          }
        });

        defeated.forEach(dead => {
          const def = BASE_CARDS[dead.cardId];
          addLog(`💀 ${player.name}'s ${def.name} was defeated!`, 'defeat');

          if (!dead.keywords.includes('token')) {
            setLastDestroyedGhosts(last => {
              const copy = [...last];
              copy[pIdx] = { instanceId: `destroyed_${dead.cardId}_${Math.random().toString(36).slice(2, 8)}`, cardId: dead.cardId, originalOwner: dead.originalOwner, defeatedDeveloped: dead.developed };
              return copy;
            });
          }

          if (dead.cardId === 'old_ghost') {
            addLog(`✨ ${player.name} will gain +1 bonus Psy next turn from Old Ghost.`, 'effect');
            player.bonusPsyNextTurn = (player.bonusPsyNextTurn || 0) + 1;
          }

          if (dead.cardId === 'bones_ghost') {
            addLog('🦴 Bones Ghost leaves behind a Bone Pile token!', 'effect');
            remainingField.push({
              instanceId: `token_bone_${Math.random().toString(36).slice(2, 8)}`,
              cardId: 'bone_pile_token',
              currentHp: 1,
              maxHp: 1,
              atk: 0,
              keywords: ['token', 'regen'],
              canAttackThisTurn: false,
              summonedTurn: turnCount,
              burn: 0,
              originalOwner: dead.originalOwner,
              developed: false
            });
          } else if (!dead.keywords.includes('token')) {
            setDiscardPile(dp => [...dp, { instanceId: dead.instanceId, cardId: dead.cardId, originalOwner: dead.originalOwner, defeatedDeveloped: dead.developed }]);
          }
        });

        return { ...player, field: remainingField };
      });

      return changed ? newPlayers : prev;
    });
  }, [addLog, turnCount]);

  const executeAttackDamage = useCallback((attacker: FieldSpirit, defender: FieldSpirit, attackerPlayerIdx: 0 | 1) => {
    const defenderPlayerIdx = attackerPlayerIdx === 0 ? 1 : 0;
    const defCard = BASE_CARDS[defender.cardId];
    const atkCard = BASE_CARDS[attacker.cardId];

    if (defender.keywords.includes('cat') && !attacker.keywords.includes('cat')) {
      addLog('🛡️ Cat Ghost cannot be targeted by non-Cat normal attacks.', 'effect');
      return;
    }

    let damage = attacker.atk;
    if (defender.cardId === 'fog_ghost' && defender.originalOwner === defenderPlayerIdx) {
      damage = Math.max(0, damage - 1);
      addLog(`😱 Bound Fog scares ${atkCard.name}. Incoming damage is reduced by 1.`, 'effect');
    }

    sounds.playAttack();
    addLog(`⚔️ ${atkCard.name} attacks ${defCard.name} for ${damage} damage.`, 'attack');
    const targetSurvives = defender.currentHp - damage > 0;
    const targetDefeated = defender.currentHp - damage <= 0;
    applyDamageToSpirit(defenderPlayerIdx, defender.instanceId, damage, targetSurvives ? attacker.cardId : undefined, true);

    if (attacker.cardId === 'flame_ghost' && targetSurvives) {
      addLog(`🔥 Flame Ghost applied Burn ${FLAME_BURN_AMOUNT} to ${defCard.name}!`, 'effect');
    }

    if (targetDefeated && attacker.cardId === 'spear_ghost' && attacker.originalOwner === attackerPlayerIdx && !defender.keywords.includes('token')) {
      addLog(`🪡 Bound Spear pierces past ${defCard.name} for 1 Leader damage!`, 'effect');
      setPlayers(prev => {
        const copy = clonePlayers(prev);
        copy[defenderPlayerIdx].leaderHp -= 1;
        return copy;
      });
    }

    if (targetDefeated && attacker.cardId === 'loud_ghost' && attacker.originalOwner === attackerPlayerIdx && !defender.keywords.includes('token')) {
      addLog(`📢 Bound Loud's shout passes through for 1 Leader damage!`, 'effect');
      setPlayers(prev => {
        const copy = clonePlayers(prev);
        copy[defenderPlayerIdx].leaderHp -= 1;
        return copy;
      });
    }

    if (targetDefeated && attacker.cardId === 'loud_ghost' && attacker.originalOwner !== attackerPlayerIdx && defender.originalOwner === attacker.originalOwner && !defender.keywords.includes('token')) {
      addLog(`🔗 Borrowed Loud destroyed a ghost Bound to its original binder. ${players[attacker.originalOwner].name} steals +1 bonus Psy next turn.`, 'effect');
      setPlayers(prev => {
        const copy = clonePlayers(prev);
        copy[attacker.originalOwner].bonusPsyNextTurn = (copy[attacker.originalOwner].bonusPsyNextTurn || 0) + 1;
        return copy;
      });
    }

    if (attacker.keywords.includes('splash')) {
      addLog('💥 Splash 1! Other enemy spirits take 1 damage. Splash can hit Cats.', 'effect');
      players[defenderPlayerIdx].field.forEach(unit => {
        if (unit.instanceId === defender.instanceId) return;
        applyDamageToSpirit(defenderPlayerIdx, unit.instanceId, 1, undefined, true);
      });
    }
  }, [addLog, applyDamageToSpirit, players]);

  const performUnitAttack = useCallback((attacker: FieldSpirit, target: FieldSpirit, attackerPlayerIdx: 0 | 1) => {
    executeAttackDamage(attacker, target, attackerPlayerIdx);
    exhaustAttacker(attackerPlayerIdx, attacker.instanceId);
    setSelectedAttackerId(null);
    resolveDefeatedUnits();
  }, [executeAttackDamage, exhaustAttacker, resolveDefeatedUnits]);

  const performLeaderAttack = useCallback((attacker: FieldSpirit, attackerPlayerIdx: 0 | 1) => {
    const targetPlayerIdx = attackerPlayerIdx === 0 ? 1 : 0;
    sounds.playAttack();
    addLog(`💥 ${BASE_CARDS[attacker.cardId].name} attacks ${players[targetPlayerIdx].name}'s Leader for ${attacker.atk} damage!`, 'attack');
    setPlayers(prev => {
      const copy = clonePlayers(prev);
      copy[targetPlayerIdx].leaderHp -= attacker.atk;
      if (attacker.cardId === 'bite_ghost') {
        if (attacker.originalOwner === attackerPlayerIdx && copy[targetPlayerIdx].currentPsy > 0) {
          copy[targetPlayerIdx].currentPsy = Math.max(0, copy[targetPlayerIdx].currentPsy - 1);
          copy[attackerPlayerIdx].currentPsy = Math.min(copy[attackerPlayerIdx].maxPsy, copy[attackerPlayerIdx].currentPsy + 1);
          addLog(`🩸 Bound Bite steals 1 current Psy from ${copy[targetPlayerIdx].name}.`, 'effect');
        } else if (attacker.originalOwner !== attackerPlayerIdx) {
          copy[attacker.originalOwner].bonusPsyNextTurn = (copy[attacker.originalOwner].bonusPsyNextTurn || 0) + 1;
          addLog(`🔗 Borrowed Bite snaps back. ${copy[attacker.originalOwner].name} steals +1 bonus Psy next turn.`, 'effect');
        }
      }
      return copy;
    });
    exhaustAttacker(attackerPlayerIdx, attacker.instanceId);
    setSelectedAttackerId(null);
  }, [addLog, exhaustAttacker, players]);

  const triggerHoldReactionWindow = useCallback((ctx: ReactionContext) => {
    const targetPlayer = players[ctx.targetPlayerIndex];
    const usableHolds = targetPlayer.hand.filter(card => isHoldCardLegallyUsable(card, ctx, players));

    if (usableHolds.length === 0) return false;

    sounds.playHoldReady();
    setReactionContext(ctx);
    addLog(`⚠️ REACTION WINDOW: ${targetPlayer.name} may play a Hold effect!`, 'hold');
    return true;
  }, [addLog, players]);

  useEffect(() => {
    const deck: CardInstance[] = [];
    p1Selected.forEach((cardId, idx) => deck.push(makeInstance(cardId, 0, `p1_${idx}`)));
    p2Selected.forEach((cardId, idx) => deck.push(makeInstance(cardId, 1, `ai_${idx}`)));

    const shuffled = shuffleDeck(deck);
    const p1Hand = shuffled.splice(0, 4);
    const p2Hand = shuffled.splice(0, 4);

    setSharedDeck(shuffled);
    setPlayers(prev => [
      { ...prev[0], hand: p1Hand },
      { ...prev[1], hand: p2Hand }
    ]);

    addLog('⚔️ Battle Started! Your 10-card deck and the Spirit Lord AI deck were shuffled together into one Draw Jar.', 'system');
    addLog('Player 1 begins Turn 1.', 'turn');
  }, [p1Selected, p2Selected, addLog]);


  useEffect(() => {
    if (winner) return;
    if (players[0].leaderHp <= 0) {
      sounds.playDefeat();
      setWinner(players[1]);
      addLog(`🏆 ${players[1].name} wins! Player 1's Spirit Jar shattered!`, 'win');
    } else if (players[1].leaderHp <= 0) {
      sounds.playWin();
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
      setWinner(players[0]);
      addLog(`🏆 ${players[0].name} wins! The enemy Spirit Jar shattered!`, 'win');
    }
  }, [players, winner, addLog]);

  useEffect(() => {
    resolveDefeatedUnits();
  }, [players[0].field, players[1].field, resolveDefeatedUnits]);

  const checkReshuffle = useCallback((currentDeck: CardInstance[], currentDiscard: CardInstance[]) => {
    if (currentDeck.length <= 4 && currentDiscard.length > 0) {
      addLog(`♻️ Draw Jar low (${currentDeck.length} cards). Shuffling ${currentDiscard.length} discarded cards back in!`, 'system');
      sounds.playCardDraw();
      return { newDeck: shuffleDeck([...currentDeck, ...currentDiscard]), newDiscard: [] };
    }

    return { newDeck: currentDeck, newDiscard: currentDiscard };
  }, [addLog]);

  const handleDrawPhase = useCallback(() => {
    setPlayers(prev => {
      const active = prev[currentPlayer];
      if (active.hand.length >= HAND_LIMIT) {
        addLog(`⚠️ ${active.name}'s hand is full (${HAND_LIMIT}/${HAND_LIMIT}). Cannot draw.`, 'system');
        setPhase('main');
        return prev;
      }

      let currentDeck = [...sharedDeck];
      let currentDiscard = [...discardPile];
      const reshuffled = checkReshuffle(currentDeck, currentDiscard);
      currentDeck = reshuffled.newDeck;
      currentDiscard = reshuffled.newDiscard;
      setDiscardPile(currentDiscard);

      if (currentDeck.length === 0) {
        addLog('⚠️ Draw Jar is empty! No cards left to draw.', 'system');
        setPhase('main');
        return prev;
      }

      const drawnCard = currentDeck[0];
      const remainingDeck = currentDeck.slice(1);
      setSharedDeck(remainingDeck);
      sounds.playCardDraw();

      const def = BASE_CARDS[drawnCard.cardId];
      addLog(`🃏 ${active.name} drew a card${active.isBot ? '' : `: ${def.name}`}.`, 'turn');

      const copy = clonePlayers(prev);
      copy[currentPlayer].hand = [...active.hand, drawnCard];
      setPhase('main');
      return copy;
    });
  }, [addLog, checkReshuffle, currentPlayer, discardPile, sharedDeck]);

  const handleStartPhase = useCallback(() => {
    setPlayers(prev => {
      const copy = clonePlayers(prev);
      const active = copy[currentPlayer];
      const baseMaxPsy = Math.min(MAX_PSY, turnCount);
      const bonusPsy = active.bonusPsyNextTurn || 0;
      const nextMaxPsy = Math.min(MAX_PSY, baseMaxPsy + bonusPsy);

      active.maxPsy = nextMaxPsy;
      active.currentPsy = nextMaxPsy;
      active.bonusPsyNextTurn = 0;
      active.hasManifestedThisTurn = false;
      active.hasAttackedThisTurn = false;

      if (bonusPsy > 0) {
        addLog(`✨ ${active.name} gains +${bonusPsy} bonus Psy from stolen spirit power.`, 'effect');
      }

      // Burn ticks at the start of the burned unit owner's turn, then decays by 1.
      active.field = active.field.map(unit => {
        if (unit.burn > 0) {
          addLog(`🔥 ${BASE_CARDS[unit.cardId].name} takes ${unit.burn} Burn damage!`, 'effect');
          sounds.playBurn();
          return { ...unit, currentHp: unit.currentHp - unit.burn, burn: Math.max(0, unit.burn - 1) };
        }
        return unit;
      });

      // Bone Pile revives at the start of its owner's turn if it survived burn/damage.
      active.field = active.field.map(unit => {
        if (unit.cardId === 'bone_pile_token' && unit.currentHp > 0) {
          addLog('✨ Bone Pile revives into Bones Ghost!', 'effect');
          sounds.playHeal();
          return {
            ...unit,
            cardId: 'bones_ghost',
            currentHp: BASE_CARDS.bones_ghost.hp,
            maxHp: BASE_CARDS.bones_ghost.hp,
            atk: BASE_CARDS.bones_ghost.atk,
            keywords: [...BASE_CARDS.bones_ghost.keywords],
            canAttackThisTurn: false,
            summonedTurn: turnCount,
            burn: 0,
            developed: false
          };
        }
        return unit;
      });

      // Existing non-token units develop and ready up after start effects.
      // A Developed ghost is one that survived until the start of its controller's next turn.
      active.field = active.field.map(unit => {
        const baseAtk = BASE_CARDS[unit.cardId]?.atk ?? unit.atk;
        const isExistingNonToken = unit.summonedTurn < turnCount && !unit.keywords.includes('token') && unit.cardId !== 'bone_pile_token';
        return {
          ...unit,
          atk: baseAtk,
          swordBuffedThisTurn: false,
          developed: unit.developed || isExistingNonToken,
          canAttackThisTurn: isExistingNonToken && baseAtk > 0
        };
      });

      return copy;
    });

    setSelectedAttackerId(null);
    setPhase('draw');
    resolveDefeatedUnits();
  }, [addLog, currentPlayer, resolveDefeatedUnits, turnCount]);

  const resolveEndOfTurnEffects = useCallback((playerIdx: 0 | 1) => {
    setPlayers(prev => {
      const copy = clonePlayers(prev);
      const active = copy[playerIdx];
      let updatedField = [...active.field];

      const lantern = updatedField.find(unit => unit.cardId === 'lantern_ghost' && unit.currentHp > 0);
      const hasWisp = updatedField.some(unit => unit.cardId === 'wisp_token' && unit.currentHp > 0);
      if (lantern && !hasWisp && updatedField.length < FIELD_LIMIT) {
        const lanternIsBound = lantern.originalOwner === playerIdx;
        addLog(`🏮 Lantern Ghost lures a Wisp token to the field! ${lanternIsBound ? 'It is Bound to its controller.' : 'It remains Bound to the original binder.'}`, 'effect');
        updatedField.push({
          instanceId: `token_wisp_${Math.random().toString(36).slice(2, 8)}`,
          cardId: 'wisp_token',
          currentHp: 1,
          maxHp: 1,
          atk: 1,
          keywords: ['token'],
          canAttackThisTurn: false,
          summonedTurn: turnCount,
          burn: 0,
          originalOwner: lantern.originalOwner,
          developed: false
        });
      }

      active.field = updatedField;

      const hasOldGhost = active.field.some(unit => unit.cardId === 'old_ghost' && unit.currentHp > 0);
      if (hasOldGhost && active.field.filter(unit => unit.currentHp > 0).length > 1) {
        const healedName = healMostDamagedFriendly(active, 1);
        if (healedName) {
          addLog(`👴 Old Ghost restores 1 HP to ${healedName}.`, 'effect');
        } else {
          addLog('👴 Old Ghost restores 1 Leader HP.', 'effect');
          active.leaderHp = Math.min(STARTING_LEADER_HP, active.leaderHp + 1);
        }
        sounds.playHeal();
      }

      return copy;
    });
  }, [addLog, turnCount]);

  const handleEndTurn = useCallback(() => {
    resolveEndOfTurnEffects(currentPlayer);
    resolveDefeatedUnits();

    const nextPlayer = currentPlayer === 0 ? 1 : 0;
    const nextTurnCount = nextPlayer === 0 ? turnCount + 1 : turnCount;
    setCurrentPlayer(nextPlayer);
    setTurnCount(nextTurnCount);
    setSelectedHandCardId(null);
    setSelectedAttackerId(null);
    setHoveredCard(null);
    setPendingTargetHoldCard(null);
    setReactionContext(null);
    setPhase('start');
    addLog(`--- Turn ${nextTurnCount}: ${players[nextPlayer].name}'s Turn ---`, 'turn');
  }, [addLog, currentPlayer, players, resolveDefeatedUnits, resolveEndOfTurnEffects, turnCount]);

  useEffect(() => {
    if (winner || reactionContext) return;
    if (phase === 'start') handleStartPhase();
    if (phase === 'draw') handleDrawPhase();
  }, [handleDrawPhase, handleStartPhase, phase, reactionContext, winner]);

  const manifestCard = useCallback((instance: CardInstance) => {
    setHoveredCard(null);
    setPendingTargetHoldCard(null);
    if (phase !== 'main' || reactionContext || winner) return;
    const active = players[currentPlayer];
    const def = BASE_CARDS[instance.cardId];
    const isBoundManifest = instance.originalOwner === currentPlayer;

    if (active.hasManifestedThisTurn) {
      addLog('⚠️ You already Manifested this turn.', 'system');
      return;
    }
    if (active.currentPsy < def.cost) {
      addLog(`⚠️ Not enough Psy (${active.currentPsy}/${def.cost}).`, 'system');
      return;
    }
    if (def.id === 'ritual_ghost' && active.field.filter(unit => unit.currentHp > 0).length < 2) {
      addLog('⚠️ Ritual Ghost requires 2 friendly spirits to sacrifice.', 'system');
      return;
    }
    const boundGhostsForManifest = getBoundGhostsOnEitherField(players, currentPlayer);
    const oathCanMakeRoom = def.id === 'oathbreaker_ghost' && boundGhostsForManifest.some(target => target.controllerIdx === currentPlayer);
    if (def.id === 'oathbreaker_ghost' && boundGhostsForManifest.length === 0) {
      addLog('⚠️ Oathbreaker Ghost needs a ghost Bound to you on either field.', 'system');
      return;
    }
    if (active.field.length >= FIELD_LIMIT && def.id !== 'bomb_ghost' && def.id !== 'ritual_ghost' && !oathCanMakeRoom) {
      addLog(`⚠️ Field is full (${FIELD_LIMIT}/${FIELD_LIMIT}). Cannot Manifest another spirit.`, 'system');
      return;
    }

    sounds.playManifest();
    addLog(`✨ ${active.name} Manifested ${def.name}! (Cost -${def.cost} Psy)`, 'manifest');

    setPlayers(prev => {
      const copy = clonePlayers(prev);
      const player = copy[currentPlayer];
      player.hand = player.hand.filter(card => card.instanceId !== instance.instanceId);
      player.currentPsy -= def.cost;
      player.hasManifestedThisTurn = true;

      if (def.id === 'bomb_ghost') {
        const leaderDamage = isBoundManifest ? 1 : 2;
        addLog(`💣 Bomb Ghost explodes for 4 damage to every spirit and ${leaderDamage} damage to both Leaders! ${isBoundManifest ? 'Your Bound ghosts duck for -1 blast damage.' : 'Borrowed Bomb is unstable!'} This can hit Cats.`, 'effect');
        sounds.playBurn();
        copy.forEach((boardPlayer, boardIdx) => {
          boardPlayer.field = boardPlayer.field.map(unit => {
            const protectedByBoundBomb = isBoundManifest && boardIdx === currentPlayer && unit.originalOwner === currentPlayer;
            return { ...unit, currentHp: unit.currentHp - (protectedByBoundBomb ? 3 : 4) };
          });
          boardPlayer.leaderHp -= leaderDamage;
        });
        setDiscardPile(dp => [...dp, instance]);
        return copy;
      }

      if (def.id === 'ritual_ghost') {
        const sacrifices = sortSacrificeCandidates(player.field).slice(0, 2);
        const sacrificeIds = new Set(sacrifices.map(unit => unit.instanceId));
        addLog(`🕯️ Ritual Ghost sacrifices ${sacrifices.map(unit => BASE_CARDS[unit.cardId].name).join(' and ')}.`, 'effect');
        player.field = player.field.filter(unit => !sacrificeIds.has(unit.instanceId));
        sacrifices.forEach(unit => {
          if (!unit.keywords.includes('token')) {
            setDiscardPile(dp => [...dp, { instanceId: unit.instanceId, cardId: unit.cardId, originalOwner: unit.originalOwner, defeatedDeveloped: unit.developed }]);
          }
        });

        const sacrificedDeveloped = sacrifices.some(unit => unit.developed && !unit.keywords.includes('token'));
        if (isBoundManifest && sacrificedDeveloped && player.hand.length < HAND_LIMIT) {
          let currentDeck = [...sharedDeck];
          let currentDiscard = [...discardPile];
          const reshuffled = checkReshuffle(currentDeck, currentDiscard);
          currentDeck = reshuffled.newDeck;
          currentDiscard = reshuffled.newDiscard;
          setDiscardPile(currentDiscard);
          if (currentDeck.length > 0) {
            const drawn = currentDeck[0];
            player.hand = [...player.hand, drawn];
            setSharedDeck(currentDeck.slice(1));
            addLog(`🌙 Bound Ritual feeds on a Developed sacrifice. ${player.name} draws ${BASE_CARDS[drawn.cardId].name}.`, 'effect');
          }
        }

        if (!isBoundManifest && sacrifices.some(unit => unit.originalOwner === instance.originalOwner && !unit.keywords.includes('token'))) {
          copy[instance.originalOwner].bonusPsyNextTurn = (copy[instance.originalOwner].bonusPsyNextTurn || 0) + 1;
          addLog(`🔗 Borrowed Ritual used a ghost Bound to ${copy[instance.originalOwner].name}. They steal +1 bonus Psy next turn.`, 'effect');
        }
      }

      if (def.id === 'oathbreaker_ghost') {
        const enemyIdx = currentPlayer === 0 ? 1 : 0;
        const targets = sortClaimTargets(getBoundGhostsOnEitherField(copy, currentPlayer), enemyIdx);
        const sacrifice = targets[0];
        if (sacrifice) {
          const sacrificedName = BASE_CARDS[sacrifice.unit.cardId].name;
          const fromEnemyField = sacrifice.controllerIdx === enemyIdx;
          const wasDeveloped = !!sacrifice.unit.developed;
          const developedBonus = wasDeveloped ? 1 : 0;
          const damage = Math.max(1, sacrifice.unit.atk) + developedBonus + (fromEnemyField ? 1 : 0);
          copy[sacrifice.controllerIdx].field = copy[sacrifice.controllerIdx].field.filter(unit => unit.instanceId !== sacrifice.unit.instanceId);
          copy[enemyIdx].leaderHp -= damage;
          setDiscardPile(dp => [...dp, { instanceId: sacrifice.unit.instanceId, cardId: sacrifice.unit.cardId, originalOwner: sacrifice.unit.originalOwner, defeatedDeveloped: sacrifice.unit.developed }]);
          addLog(`🪦 Oathbreaker sacrifices ${sacrificedName} Bound to ${player.name} from ${copy[sacrifice.controllerIdx].name}'s field.`, 'effect');
          if (wasDeveloped) addLog('🌙 The Developed bond adds +1 damage!', 'effect');
          if (fromEnemyField) addLog('🔗 The stolen bond snaps back for +1 damage!', 'effect');
          addLog(`💔 ${sacrificedName}'s broken oath deals ${damage} damage to ${copy[enemyIdx].name}'s Leader!`, 'attack');

          if (!isBoundManifest) {
            copy[instance.originalOwner].bonusPsyNextTurn = (copy[instance.originalOwner].bonusPsyNextTurn || 0) + 1;
            addLog(`🔗 Borrowed Oathbreaker demands payment. ${copy[instance.originalOwner].name} steals +1 bonus Psy next turn.`, 'effect');
          }

          if (wasDeveloped) {
            addLog(`🌙 Developed ${sacrificedName} leaves a stronger echo. ${player.name} draws 1 card.`, 'effect');
            let currentDeck = [...sharedDeck];
            let currentDiscard = [...discardPile];
            const reshuffled = checkReshuffle(currentDeck, currentDiscard);
            currentDeck = reshuffled.newDeck;
            currentDiscard = reshuffled.newDiscard;
            setDiscardPile(currentDiscard);
            if (currentDeck.length > 0 && player.hand.length < HAND_LIMIT) {
              const drawn = currentDeck[0];
              player.hand = [...player.hand, drawn];
              setSharedDeck(currentDeck.slice(1));
              addLog(`🃏 ${player.name} drew ${BASE_CARDS[drawn.cardId].name} from the broken oath.`, 'turn');
            }
          }
        }
      }

      const newUnit = makeSpirit(instance, turnCount, currentPlayer);
      player.field = [...player.field, newUnit];

      if (def.id === 'possessor_ghost') {
        const enemyIdx = currentPlayer === 0 ? 1 : 0;
        if (isBoundManifest) {
          const reclaimTarget = copy[enemyIdx].field
            .filter(unit => unit.currentHp > 0 && unit.currentHp < unit.maxHp && unit.originalOwner === currentPlayer && !unit.keywords.includes('token'))
            .sort((a, b) => (BASE_CARDS[b.cardId].cost - BASE_CARDS[a.cardId].cost) || b.atk - a.atk)[0];
          if (reclaimTarget && player.field.length < FIELD_LIMIT) {
            copy[enemyIdx].field = copy[enemyIdx].field.filter(unit => unit.instanceId !== reclaimTarget.instanceId);
            player.field = [...player.field, {
              ...reclaimTarget,
              atk: reclaimTarget.developed ? reclaimTarget.atk + 1 : reclaimTarget.atk,
              canAttackThisTurn: !!reclaimTarget.developed && reclaimTarget.atk > 0,
              summonedTurn: reclaimTarget.developed ? reclaimTarget.summonedTurn : turnCount
            }];
            addLog(`👻 Bound Possessor reclaims ${BASE_CARDS[reclaimTarget.cardId].name} from ${copy[enemyIdx].name}'s field.`, 'effect');
            if (reclaimTarget.developed) addLog(`🌙 Developed ${BASE_CARDS[reclaimTarget.cardId].name} comes back ready with +1 ATK this turn.`, 'effect');
          } else if (reclaimTarget) {
            addLog('⚠️ Possessor Ghost found a Bound target, but your field has no room to reclaim it.', 'system');
          } else {
            addLog('👻 Bound Possessor found no damaged enemy-controlled ghost Bound to you.', 'effect');
          }
        } else {
          const possessorUnit = player.field.find(unit => unit.instanceId === instance.instanceId);
          const swapTarget = copy[enemyIdx].field
            .filter(unit => unit.currentHp > 0 && unit.currentHp < unit.maxHp && !unit.keywords.includes('token'))
            .sort((a, b) => (BASE_CARDS[b.cardId].cost - BASE_CARDS[a.cardId].cost) || b.atk - a.atk)[0];
          if (possessorUnit && swapTarget) {
            player.field = player.field.filter(unit => unit.instanceId !== possessorUnit.instanceId);
            copy[enemyIdx].field = copy[enemyIdx].field.filter(unit => unit.instanceId !== swapTarget.instanceId);
            player.field.push({ ...swapTarget, canAttackThisTurn: false, summonedTurn: turnCount });
            copy[enemyIdx].field.push({ ...possessorUnit, canAttackThisTurn: false, summonedTurn: turnCount });
            addLog(`🌀 Borrowed Possessor swaps places with damaged ${BASE_CARDS[swapTarget.cardId].name}. You steal it, but it enters exhausted.`, 'effect');
          } else {
            addLog('👻 Borrowed Possessor found no damaged enemy ghost to swap with.', 'effect');
          }
        }
      }

      if (def.id === 'grave_caller') {
        const recalled = [...discardPile]
          .filter(card => card.originalOwner === currentPlayer && card.cardId !== 'bomb_ghost' && !BASE_CARDS[card.cardId].token)
          .sort((a, b) => BASE_CARDS[b.cardId].cost - BASE_CARDS[a.cardId].cost)[0];
        if (recalled && player.hand.length < HAND_LIMIT) {
          player.hand = [...player.hand, recalled];
          setDiscardPile(dp => dp.filter(card => card.instanceId !== recalled.instanceId));
          addLog(`🔔 Grave Caller returns ${BASE_CARDS[recalled.cardId].name} Bound to ${player.name} from the discard to hand.`, 'effect');
          if (recalled.defeatedDeveloped) {
            player.currentPsy = Math.min(player.maxPsy, player.currentPsy + 1);
            addLog(`🌙 Developed ${BASE_CARDS[recalled.cardId].name}'s echo refunds 1 Psy.`, 'effect');
          }
          if (!isBoundManifest) {
            copy[instance.originalOwner].bonusPsyNextTurn = (copy[instance.originalOwner].bonusPsyNextTurn || 0) + 1;
            addLog(`🔗 Borrowed Grave Caller rings back to ${copy[instance.originalOwner].name}. They steal +1 bonus Psy next turn.`, 'effect');
          }
        } else if (recalled) {
          addLog('⚠️ Grave Caller heard a Bound ghost, but your hand is full.', 'system');
        } else {
          addLog('🔔 Grave Caller found no defeated ghost Bound to you.', 'effect');
        }
      }

      if (def.id === 'loud_ghost') {
        const enemyIdx = currentPlayer === 0 ? 1 : 0;
        addLog('📢 Loud Ghost deals 1 damage to all enemy spirits!', 'effect');
        copy[enemyIdx].field = copy[enemyIdx].field.map(unit => ({ ...unit, currentHp: unit.currentHp - 1 }));
      }

      if (def.id === 'lantern_ghost' && player.field.length < FIELD_LIMIT) {
        addLog(`🏮 Lantern Ghost summons a Wisp token! ${isBoundManifest ? 'Bound Wisp enters ready.' : "Borrowed Lantern\'s Wisp stays Bound to its original binder."}`, 'effect');
        player.field.push({
          instanceId: `token_wisp_${Math.random().toString(36).slice(2, 8)}`,
          cardId: 'wisp_token',
          currentHp: 1,
          maxHp: 1,
          atk: 1,
          keywords: ['token'],
          canAttackThisTurn: isBoundManifest,
          summonedTurn: turnCount,
          burn: 0,
          originalOwner: instance.originalOwner,
          developed: false
        });
      }

      if (def.id === 'fog_ghost') {
        const enemyIdx = currentPlayer === 0 ? 1 : 0;
        if (copy[enemyIdx].field.length >= player.field.length + 2) {
          addLog('🌫️ Fog Ghost buys time while you are badly outnumbered. Draw 1 card.', 'effect');
          let currentDeck = [...sharedDeck];
          let currentDiscard = [...discardPile];
          const reshuffled = checkReshuffle(currentDeck, currentDiscard);
          currentDeck = reshuffled.newDeck;
          currentDiscard = reshuffled.newDiscard;
          setDiscardPile(currentDiscard);
          if (currentDeck.length > 0 && player.hand.length < HAND_LIMIT) {
            const drawn = currentDeck[0];
            player.hand = [...player.hand, drawn];
            setSharedDeck(currentDeck.slice(1));
            addLog(`🃏 ${player.name} drew ${BASE_CARDS[drawn.cardId].name} from Fog Ghost.`, 'turn');
          }
        }
      }

      if (def.id === 'old_ghost') {
        const healedName = healMostDamagedFriendly(player, 2);
        if (healedName) {
          addLog(`👴 Old Ghost restores 2 HP to ${healedName}!`, 'effect');
        } else {
          addLog('👴 Old Ghost restores 2 Leader HP!', 'effect');
          player.leaderHp = Math.min(STARTING_LEADER_HP, player.leaderHp + 2);
        }
        sounds.playHeal();
      }

      return copy;
    });

    setSelectedHandCardId(null);
    resolveDefeatedUnits();

    const enemyIdx = currentPlayer === 0 ? 1 : 0;
    triggerHoldReactionWindow({
      trigger: instance.cardId === 'wisp_token' ? 'when_enemy_summons_token' : 'when_enemy_summons',
      sourcePlayerIndex: currentPlayer,
      targetPlayerIndex: enemyIdx,
      sourceSpiritInstanceId: instance.instanceId
    });
  }, [addLog, checkReshuffle, currentPlayer, discardPile, phase, players, reactionContext, resolveDefeatedUnits, sharedDeck, triggerHoldReactionWindow, turnCount, winner]);

  const handleTargetClick = useCallback((targetUnit?: FieldSpirit, isEnemyLeader?: boolean) => {
    if (phase !== 'attack' || !selectedAttackerId || reactionContext || winner) return;
    const active = players[currentPlayer];
    const enemyIdx = currentPlayer === 0 ? 1 : 0;
    const enemy = players[enemyIdx];
    const attacker = active.field.find(unit => unit.instanceId === selectedAttackerId);
    if (!attacker || !attacker.canAttackThisTurn) return;

    if (isEnemyLeader) {
      if (!canAttackLeaderTarget(attacker, enemy, turnCount)) {
        addLog('⚠️ Cannot attack enemy Leader while opponent controls protecting spirits!', 'system');
        return;
      }
      const hasReaction = triggerHoldReactionWindow({
        trigger: 'when_leader_damaged',
        sourcePlayerIndex: currentPlayer,
        targetPlayerIndex: enemyIdx,
        sourceSpiritInstanceId: attacker.instanceId,
        incomingDamage: attacker.atk
      });

      if (!hasReaction) performLeaderAttack(attacker, currentPlayer);
      return;
    }

    if (!targetUnit) return;
    if (!hasValidUnitTarget(attacker, enemy, targetUnit)) {
      addLog('⚠️ That is not a legal attack target.', 'system');
      return;
    }

    const hasReaction = triggerHoldReactionWindow({
      trigger: 'when_enemy_attacks',
      sourcePlayerIndex: currentPlayer,
      targetPlayerIndex: enemyIdx,
      sourceSpiritInstanceId: attacker.instanceId,
      targetSpiritInstanceId: targetUnit.instanceId
    });

    if (!hasReaction) performUnitAttack(attacker, targetUnit, currentPlayer);
  }, [addLog, currentPlayer, performLeaderAttack, performUnitAttack, phase, players, reactionContext, selectedAttackerId, triggerHoldReactionWindow, winner]);


  const playSwordAttackHold = useCallback((cardInst: CardInstance, playerIdx: 0 | 1, attackerId: string) => {
    setHoveredCard(null);
    setPendingTargetHoldCard(null);
    const def = BASE_CARDS[cardInst.cardId];
    const player = players[playerIdx];

    if (def.id !== 'sword_ghost') return false;

    const attacker = player.field.find(unit => unit.instanceId === attackerId && unit.currentHp > 0);
    if (!attacker || attacker.keywords.includes('cat') || attacker.swordBuffedThisTurn) {
      addLog('⚠️ Sword Ghost can only empower a selected non-Cat attacker once per turn.', 'system');
      return false;
    }

    sounds.playManifest();
    addLog(`⚡ HOLD PLAYED: ${player.name} uses Sword Ghost to empower ${BASE_CARDS[attacker.cardId].name}!`, 'hold');
    addLog(`🗡️ ${BASE_CARDS[attacker.cardId].name} gets +2 ATK this turn.`, 'effect');

    setPlayers(prev => {
      const copy = clonePlayers(prev);
      const active = copy[playerIdx];
      active.hand = active.hand.filter(card => card.instanceId !== cardInst.instanceId);
      active.field = active.field.map(unit => {
        if (unit.instanceId !== attackerId) return unit;
        return { ...unit, atk: unit.atk + 2, swordBuffedThisTurn: true };
      });
      return copy;
    });

    setDiscardPile(dp => [...dp, cardInst]);
    setSelectedHandCardId(null);
    return true;
  }, [addLog, players]);

  const playReactHoldCard = useCallback((cardInst: CardInstance, playerIdx: 0 | 1) => {
    setHoveredCard(null);
    setPendingTargetHoldCard(null);
    const def = BASE_CARDS[cardInst.cardId];
    const player = players[playerIdx];

    if (!def.hasHold || def.holdTrigger !== 'react_phase') return;

    sounds.playManifest();
    addLog(`⚡ REACT PLAYED: ${player.name} uses ${def.name} Hold effect!`, 'hold');

    setPlayers(prev => {
      const copy = clonePlayers(prev);
      const active = copy[playerIdx];
      active.hand = active.hand.filter(card => card.instanceId !== cardInst.instanceId);

      if (def.id === 'sword_ghost') {
        const target = [...active.field]
          .filter(unit => unit.currentHp > 0 && !unit.keywords.includes('token') && !unit.keywords.includes('cat'))
          .sort((a, b) => b.atk - a.atk || b.currentHp - a.currentHp)[0]
          ?? [...active.field].filter(unit => unit.currentHp > 0 && !unit.keywords.includes('cat')).sort((a, b) => b.atk - a.atk)[0];

        if (target) {
          active.field = active.field.map(unit => {
            if (unit.instanceId !== target.instanceId) return unit;
            return { ...unit, atk: unit.atk + 2 };
          });
          addLog(`🗡️ Sword Ghost gives ${BASE_CARDS[target.cardId].name} +2 ATK.`, 'effect');
        } else {
          addLog('⚠️ Sword Ghost had no friendly spirit to empower.', 'system');
        }
      }

      if (def.id === 'ritual_ghost') {
        const lastDestroyed = lastDestroyedGhosts[playerIdx];
        if (!lastDestroyed) {
          addLog('⚠️ Ritual Ghost has no destroyed ghost to resummon.', 'system');
        } else if (active.field.length >= FIELD_LIMIT) {
          addLog(`⚠️ Field is full (${FIELD_LIMIT}/${FIELD_LIMIT}). Ritual Ghost cannot resummon.`, 'system');
        } else {
          const revivedInstance = makeInstance(lastDestroyed.cardId, playerIdx, `ritual_revive_${playerIdx}`);
          const revived = makeSpirit(revivedInstance, turnCount, playerIdx);
          revived.canAttackThisTurn = false;
          active.field.push(revived);
          addLog(`🕯️ Ritual Ghost resummons ${BASE_CARDS[lastDestroyed.cardId].name}!`, 'effect');
          setLastDestroyedGhosts(last => {
            const next = [...last];
            next[playerIdx] = null;
            return next;
          });
        }
      }

      return copy;
    });

    setDiscardPile(dp => [...dp, cardInst]);
    setSelectedHandCardId(null);
    setSelectedAttackerId(null);
    resolveDefeatedUnits();
  }, [addLog, lastDestroyedGhosts, players, resolveDefeatedUnits, turnCount]);


  const playTargetedReactHoldCard = useCallback((cardInst: CardInstance, targetId: string, playerIdx: 0 | 1) => {
    const def = BASE_CARDS[cardInst.cardId];
    const player = players[playerIdx];

    if (!def.hasHold || def.holdTrigger !== 'react_phase') return;
    if (def.id !== 'sword_ghost') return;

    sounds.playManifest();
    addLog(`⚡ REACT PLAYED: ${player.name} uses ${def.name} Hold effect!`, 'hold');

    setPlayers(prev => {
      const copy = clonePlayers(prev);
      const active = copy[playerIdx];
      const target = active.field.find(unit => unit.instanceId === targetId && unit.currentHp > 0 && !unit.keywords.includes('cat'));

      active.hand = active.hand.filter(card => card.instanceId !== cardInst.instanceId);

      if (!target) {
        addLog('⚠️ Sword Ghost had no valid friendly target.', 'system');
        return copy;
      }

      active.field = active.field.map(unit => {
        if (unit.instanceId !== targetId) return unit;
        return { ...unit, atk: unit.atk + 2 };
      });

      addLog(`🗡️ Sword Ghost gives ${BASE_CARDS[target.cardId].name} +2 ATK.`, 'effect');
      return copy;
    });

    setDiscardPile(dp => [...dp, cardInst]);
    setSelectedHandCardId(null);
    setSelectedAttackerId(null);
    setHoveredCard(null);
    setPendingTargetHoldCard(null);
    resolveDefeatedUnits();
  }, [addLog, players, resolveDefeatedUnits]);

  const passReaction = useCallback(() => {
    if (!reactionContext) return;
    addLog(`${players[reactionContext.targetPlayerIndex].name} passed on the Reaction window.`, 'turn');

    const sourcePlayerIdx = reactionContext.sourcePlayerIndex as 0 | 1;
    const sourcePlayer = players[sourcePlayerIdx];
    const attacker = sourcePlayer.field.find(unit => unit.instanceId === reactionContext.sourceSpiritInstanceId);

    if (reactionContext.trigger === 'when_leader_damaged' && attacker) {
      performLeaderAttack(attacker, sourcePlayerIdx);
    } else if (reactionContext.trigger === 'when_enemy_attacks' && attacker && reactionContext.targetSpiritInstanceId) {
      const targetPlayerIdx = reactionContext.targetPlayerIndex as 0 | 1;
      const target = players[targetPlayerIdx].field.find(unit => unit.instanceId === reactionContext.targetSpiritInstanceId);
      if (target) performUnitAttack(attacker, target, sourcePlayerIdx);
    }

    setReactionContext(null);
    setSelectedAttackerId(null);
    resolveDefeatedUnits();
  }, [addLog, performLeaderAttack, performUnitAttack, players, reactionContext, resolveDefeatedUnits]);

  const playHoldCard = useCallback((cardInst: CardInstance) => {
    setHoveredCard(null);
    setPendingTargetHoldCard(null);
    if (!reactionContext) return;
    const reactingPlayerIdx = reactionContext.targetPlayerIndex as 0 | 1;
    const reactingPlayer = players[reactingPlayerIdx];
    const def = BASE_CARDS[cardInst.cardId];

    if (!isHoldCardLegallyUsable(cardInst, reactionContext, players)) {
      addLog(`⚠️ ${def.name} has no legal Hold target right now. It stays in hand.`, 'system');
      return;
    }

    sounds.playManifest();
    addLog(`⚡ REACTION PLAYED: ${reactingPlayer.name} uses ${def.name} Hold effect!`, 'hold');

    setPlayers(prev => {
      const copy = clonePlayers(prev);
      copy[reactingPlayerIdx].hand = copy[reactingPlayerIdx].hand.filter(card => card.instanceId !== cardInst.instanceId);
      return copy;
    });
    setDiscardPile(dp => [...dp, cardInst]);

    const sourcePlayerIdx = reactionContext.sourcePlayerIndex as 0 | 1;
    const attacker = players[sourcePlayerIdx].field.find(unit => unit.instanceId === reactionContext.sourceSpiritInstanceId);

    if (def.id === 'fog_ghost') {
      if (attacker) {
        addLog(`🌫️ Fog Ghost cancels ${BASE_CARDS[attacker.cardId].name}'s attack because ${players[sourcePlayerIdx].name} has at least 2 more spirits than ${reactingPlayer.name}.`, 'effect');
        exhaustAttacker(sourcePlayerIdx, attacker.instanceId);
      }
    } else if (def.id === 'bomb_ghost') {
      if (attacker) {
        addLog(`💣 Bomb Ghost blasts the attacking ${BASE_CARDS[attacker.cardId].name} for 4 damage!`, 'effect');
        setPlayers(prev => {
          const copy = clonePlayers(prev);
          copy[sourcePlayerIdx].field = copy[sourcePlayerIdx].field.map(unit => {
            if (unit.instanceId !== attacker.instanceId) return unit;
            return { ...unit, currentHp: unit.currentHp - 4 };
          });
          return copy;
        });
        exhaustAttacker(sourcePlayerIdx, attacker.instanceId);
      }
    } else if (def.id === 'soldier_ghost') {
      addLog('🛡️ Soldier Ghost manifests to intercept the incoming attack!', 'effect');
      setPlayers(prev => {
        const copy = clonePlayers(prev);
        if (copy[reactingPlayerIdx].field.length < FIELD_LIMIT) {
          copy[reactingPlayerIdx].field.push({
            instanceId: cardInst.instanceId,
            cardId: 'soldier_ghost',
            currentHp: Math.max(1, BASE_CARDS.soldier_ghost.hp - (reactionContext.incomingDamage || 1)),
            maxHp: BASE_CARDS.soldier_ghost.hp,
            atk: BASE_CARDS.soldier_ghost.atk,
            keywords: [...BASE_CARDS.soldier_ghost.keywords],
            canAttackThisTurn: false,
            summonedTurn: turnCount,
            burn: 0,
            originalOwner: cardInst.originalOwner,
            developed: false
          });
        }
        return copy;
      });
      if (attacker) exhaustAttacker(sourcePlayerIdx, attacker.instanceId);
    } else if (def.id === 'old_ghost') {
      addLog('👴 Old Ghost restores 2 Leader HP before the Leader damage lands!', 'effect');
      setPlayers(prev => {
        const copy = clonePlayers(prev);
        copy[reactingPlayerIdx].leaderHp = Math.min(STARTING_LEADER_HP, copy[reactingPlayerIdx].leaderHp + 2);
        return copy;
      });
      if (attacker) performLeaderAttack(attacker, sourcePlayerIdx);
    } else if (def.id === 'flame_ghost') {
      if (attacker) {
        addLog(`🔥 Flame Ghost sets the attacker ablaze with Burn ${FLAME_BURN_AMOUNT}!`, 'effect');
        setPlayers(prev => {
          const copy = clonePlayers(prev);
          copy[sourcePlayerIdx].field = copy[sourcePlayerIdx].field.map(unit => {
            if (unit.instanceId !== attacker.instanceId) return unit;
            return { ...unit, burn: Math.min(MAX_BURN, unit.burn + FLAME_BURN_AMOUNT) };
          });
          return copy;
        });
      }
      if (attacker && reactionContext.targetSpiritInstanceId) {
        const target = players[reactingPlayerIdx].field.find(unit => unit.instanceId === reactionContext.targetSpiritInstanceId);
        if (target) performUnitAttack(attacker, target, sourcePlayerIdx);
      }
    } else if (def.id === 'loud_ghost') {
      addLog('📢 Loud Ghost shatters all enemy tokens!', 'effect');
      setPlayers(prev => {
        const copy = clonePlayers(prev);
        copy[sourcePlayerIdx].field = copy[sourcePlayerIdx].field.filter(unit => !unit.keywords.includes('token'));
        return copy;
      });
    } else if (def.id === 'bones_ghost') {
      addLog('🦴 Bones Ghost leaves a Bone Pile behind!', 'effect');
      setPlayers(prev => {
        const copy = clonePlayers(prev);
        if (copy[reactingPlayerIdx].field.length < FIELD_LIMIT) {
          copy[reactingPlayerIdx].field.push({
            instanceId: cardInst.instanceId,
            cardId: 'bone_pile_token',
            currentHp: 1,
            maxHp: 1,
            atk: 0,
            keywords: ['token', 'regen'],
            canAttackThisTurn: false,
            summonedTurn: turnCount,
            burn: 0,
            originalOwner: cardInst.originalOwner,
            developed: false
          });
        }
        return copy;
      });
    } else if (def.id === 'cat_ghost') {
      addLog('🐾 Cat Ghost cancels the targeting effect!', 'effect');
      if (attacker) exhaustAttacker(sourcePlayerIdx, attacker.instanceId);
    }

    setReactionContext(null);
    setSelectedAttackerId(null);
    resolveDefeatedUnits();
  }, [addLog, exhaustAttacker, performLeaderAttack, performUnitAttack, players, reactionContext, resolveDefeatedUnits, turnCount]);

  useEffect(() => {
    if (!selectedAttackerId) return;
    const human = players[0];
    const enemy = players[1];
    const stillValid = getValidAttackers(human, enemy, turnCount).some(unit => unit.instanceId === selectedAttackerId);
    if (!stillValid) setSelectedAttackerId(null);
  }, [players, selectedAttackerId]);

  useEffect(() => {
    if (winner || reactionContext) return;
    const active = players[currentPlayer];
    if (!active.isBot && !autoplay) return;

    const timer = setTimeout(() => {
      const enemyIdx = currentPlayer === 0 ? 1 : 0;
      const enemy = players[enemyIdx];

      if (phase === 'main') {
        const playable = getBestAiManifestCard(active, enemy);
        if (playable) {
          manifestCard(playable);
          return;
        }

        setPhase('attack');
        return;
      }

      if (phase === 'attack') {
        const validAttackers = getValidAttackers(active, enemy, turnCount);
        if (validAttackers.length === 0) {
          setPhase('react');
          return;
        }

        const attacker = validAttackers[0];
        const target = getBestAiTarget(attacker, enemy);

        const swordHold = active.hand.find(card => BASE_CARDS[card.cardId]?.id === 'sword_ghost');
        const shouldUseSwordHold = !!(
          swordHold &&
          !attacker.keywords.includes('cat') &&
          !attacker.swordBuffedThisTurn &&
          ((target && attacker.atk < target.currentHp && attacker.atk + 2 >= target.currentHp) ||
            (!target && enemy.field.length === 0 && attacker.atk + 2 >= enemy.leaderHp))
        );

        if (swordHold && shouldUseSwordHold) {
          playSwordAttackHold(swordHold, currentPlayer, attacker.instanceId);
          return;
        }

        if (target) {
          const hasReaction = triggerHoldReactionWindow({
            trigger: 'when_enemy_attacks',
            sourcePlayerIndex: currentPlayer,
            targetPlayerIndex: enemyIdx,
            sourceSpiritInstanceId: attacker.instanceId,
            targetSpiritInstanceId: target.instanceId
          });
          if (!hasReaction) performUnitAttack(attacker, target, currentPlayer);
          return;
        }

        if (canAttackLeaderTarget(attacker, enemy, turnCount)) {
          const hasReaction = triggerHoldReactionWindow({
            trigger: 'when_leader_damaged',
            sourcePlayerIndex: currentPlayer,
            targetPlayerIndex: enemyIdx,
            sourceSpiritInstanceId: attacker.instanceId,
            incomingDamage: attacker.atk
          });
          if (!hasReaction) performLeaderAttack(attacker, currentPlayer);
          return;
        }

        setPhase('react');
        return;
      }

      if (phase === 'react') {
        // The AI should not randomly spend proactive React-phase Holds at end of turn.
        // It only uses Holds in response to concrete attack/leader windows.
        handleEndTurn();
        return;
      }

      if (phase === 'end') {
        handleEndTurn();
        return;
      }

      // Absolute AI failsafe: no branch should leave the enemy UI stuck.
      handleEndTurn();
    }, 550);

    return () => clearTimeout(timer);
  }, [autoplay, currentPlayer, handleEndTurn, lastDestroyedGhosts, manifestCard, performLeaderAttack, performUnitAttack, phase, playSwordAttackHold, players, reactionContext, triggerHoldReactionWindow, winner]);

  useEffect(() => {
    if (!reactionContext) return;
    const reactingPlayer = players[reactionContext.targetPlayerIndex];
    if (!reactingPlayer.isBot && !autoplay) return;

    const timer = setTimeout(() => {
      const usableHolds = reactingPlayer.hand
        .filter(card => isHoldCardLegallyUsable(card, reactionContext, players))
        .map(card => ({ card, score: getAiReactionHoldScore(card, reactionContext, players) }))
        .filter(entry => entry.score > 0)
        .sort((a, b) => b.score - a.score);

      if (usableHolds.length > 0) playHoldCard(usableHolds[0].card);
      else passReaction();
    }, 700);

    return () => clearTimeout(timer);
  }, [autoplay, passReaction, playHoldCard, players, reactionContext]);

  const humanPlayer = players[0];
  const computerPlayer = players[1];
  const isHumanTurn = currentPlayer === 0;
  const humanCanAct = isHumanTurn && !winner && !autoplay;
  const selectedAttacker = humanPlayer.field.find(unit => unit.instanceId === selectedAttackerId);
  const canAttackEnemyLeader = !!selectedAttacker && canAttackLeaderTarget(selectedAttacker, computerPlayer, turnCount);
  const humanValidAttackers = getValidAttackers(humanPlayer, computerPlayer, turnCount);

  const isCardUsableReaction = (card: CardInstance) => {
    if (!reactionContext) return false;
    if (reactionContext.targetPlayerIndex !== 0) return false;
    return isHoldCardLegallyUsable(card, reactionContext, players);
  };

  const isCardUsableReactPhase = (card: CardInstance) => {
    const def = BASE_CARDS[card.cardId];
    if (!def || !def.hasHold || def.holdTrigger !== 'react_phase') return false;
    if (!humanCanAct || phase !== 'react' || reactionContext) return false;
    if (def.id === 'sword_ghost') return false;
    if (def.id === 'ritual_ghost') return !!lastDestroyedGhosts[0] && humanPlayer.field.length < FIELD_LIMIT;
    return true;
  };

  const isCardUsableAttackTrick = (card: CardInstance) => {
    const def = BASE_CARDS[card.cardId];
    if (!def || def.id !== 'sword_ghost') return false;
    if (!humanCanAct || phase !== 'attack' || reactionContext || !selectedAttackerId) return false;
    const attacker = humanPlayer.field.find(unit => unit.instanceId === selectedAttackerId);
    return !!attacker && attacker.currentHp > 0 && !attacker.keywords.includes('cat') && !attacker.swordBuffedThisTurn;
  };

  const unitCardClass = '!w-28 !h-40 lg:!w-32 lg:!h-44';

  return (
    <div className="flex flex-col min-h-[620px] w-full max-w-[1500px] mx-auto bg-[#0f172a] text-slate-100 font-sans overflow-visible border-4 sm:border-8 border-[#1e293b] rounded-2xl shadow-2xl relative select-none">
      {winner && (
        <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex flex-col items-center justify-center p-8 animate-fade-in">
          <div className="text-8xl mb-4 animate-bounce">🏆</div>
          <h2 className="text-5xl font-black text-cyan-400 tracking-tighter uppercase mb-2">
            {winner.name} WINS!
          </h2>
          <p className="text-slate-300 font-mono text-sm max-w-md text-center mb-8">
            The opposing Spirit Jar was shattered! Victory achieved on Turn {turnCount}.
          </p>
          <button
            onClick={onRestart}
            className="px-8 py-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black tracking-wider text-lg uppercase rounded-xl shadow-[0_0_30px_rgba(34,211,238,0.6)] cursor-pointer transition-all hover:scale-105"
          >
            Play Again ↺
          </button>
        </div>
      )}

      <div className="flex justify-between items-center px-4 py-2 bg-[#1e1b4b] border-b border-cyan-500/30 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center border-2 border-slate-300 font-black text-white shadow">
            AI
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-slate-400">Opponent</div>
            <div className="text-lg font-bold text-cyan-400">{computerPlayer.name}</div>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <div className="text-center font-mono">
            <div className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">Leader HP</div>
            <div className="text-2xl font-black text-rose-500">
              {computerPlayer.leaderHp < 10 ? `0${computerPlayer.leaderHp}` : computerPlayer.leaderHp}<span className="text-sm opacity-50">/{STARTING_LEADER_HP}</span>
            </div>
          </div>
          <div className="text-center font-mono">
            <div className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">Psy</div>
            <div className="text-2xl font-black text-cyan-400">
              {computerPlayer.currentPsy < 10 ? `0${computerPlayer.currentPsy}` : computerPlayer.currentPsy}<span className="text-sm opacity-50">/{computerPlayer.maxPsy}</span>
            </div>
          </div>
          <div className="flex gap-1.5 items-center">
            {computerPlayer.hand.map((_, idx) => (
              <div key={idx} className="w-7 h-10 bg-[#312e81] rounded border border-cyan-800 shadow-md flex items-center justify-center text-[10px] opacity-90">
                🏺
              </div>
            ))}
            {computerPlayer.hand.length === 0 && <span className="text-xs text-slate-500 italic">0 cards</span>}
          </div>
        </div>
      </div>

      <div className="relative grid min-h-[500px] grid-cols-[1fr_210px] xl:grid-cols-[1fr_230px] p-2 gap-2 overflow-hidden">
        <div className="flex flex-col justify-between overflow-hidden pr-1 gap-2">
          <div className="flex justify-center items-center gap-2 shrink-0">
            <LeaderTarget
              label="Enemy Leader"
              hp={computerPlayer.leaderHp}
              maxHp={STARTING_LEADER_HP}
              owner="enemy"
              isClickable={humanCanAct && phase === 'attack' && canAttackEnemyLeader}
              onClick={() => handleTargetClick(undefined, true)}
            />
            <div className="flex justify-center gap-2 items-center">
              {[0, 1, 2].map(slotIdx => {
                const unit = computerPlayer.field[slotIdx];
                const canBeTargeted = !!(
                  humanCanAct &&
                  phase === 'attack' &&
                  selectedAttacker &&
                  unit &&
                  hasValidUnitTarget(selectedAttacker, computerPlayer, unit)
                );

                return (
                  <FieldUnitView
                    key={`opp_slot_${slotIdx}`}
                    slotIndex={slotIdx}
                    spirit={unit}
                    isEmpty={!unit}
                    isTargetable={canBeTargeted}
                    onClick={() => canBeTargeted && handleTargetClick(unit)}
                    ownershipLabel={unit ? getOwnershipLabel(unit.originalOwner, 0, 1) : undefined}
                    className={unitCardClass}
                  />
                );
              })}
            </div>
          </div>

          <div className="flex justify-center items-center gap-6 py-0 shrink-0">
            <div className="text-center group">
              <div className="w-16 h-24 bg-[#312e81] rounded-lg border-2 border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.5)] flex flex-col items-center justify-center relative transition-transform group-hover:scale-105">
                <div className="text-3xl">🏺</div>
                <div className="absolute -top-3 -right-3 w-7 h-7 rounded-full bg-cyan-500 flex items-center justify-center font-black text-xs text-slate-950 shadow">
                  {sharedDeck.length}
                </div>
              </div>
              <div className="text-[10px] uppercase mt-1 font-bold text-cyan-400 tracking-widest">Draw Jar</div>
              <div className="mt-0.5 text-[8px] font-mono uppercase tracking-widest text-slate-500">Shared Pool</div>
            </div>

            <div className="text-center group">
              <div className="w-16 h-24 bg-slate-900 rounded-lg border-2 border-slate-700 flex flex-col items-center justify-center grayscale opacity-70 transition-opacity group-hover:opacity-100">
                <div className="text-3xl">💀</div>
                <div className="text-[10px] font-mono text-slate-400 mt-1">{discardPile.length}</div>
              </div>
              <div className="text-[10px] uppercase mt-1 font-bold text-slate-500 tracking-widest">Discard</div>
            </div>
          </div>

          <div className="flex justify-center items-center gap-2 shrink-0">
            <LeaderTarget label="Your Leader" hp={humanPlayer.leaderHp} maxHp={STARTING_LEADER_HP} owner="player" />
            <div className="flex justify-center gap-2 items-center">
              {[0, 1, 2].map(slotIdx => {
                const unit = humanPlayer.field[slotIdx];
                const isChoosingSwordTarget = !!(pendingTargetHoldCard && BASE_CARDS[pendingTargetHoldCard.cardId]?.id === 'sword_ghost');
                const isEligibleAttacker = !!(humanCanAct && !isChoosingSwordTarget && phase === 'attack' && unit && getValidAttackers(humanPlayer, computerPlayer, turnCount).some(attacker => attacker.instanceId === unit.instanceId));
                const isHoldTarget = !!(humanCanAct && phase === 'react' && isChoosingSwordTarget && unit && unit.currentHp > 0 && !unit.keywords.includes('cat'));

                return (
                  <FieldUnitView
                    key={`player_slot_${slotIdx}`}
                    slotIndex={slotIdx}
                    spirit={unit}
                    isEmpty={!unit}
                    canAttack={isEligibleAttacker && !selectedAttackerId}
                    isTargetable={isHoldTarget}
                    isSelectedForAttack={selectedAttackerId === unit?.instanceId}
                    onClick={() => {
                      if (!unit) return;
                      if (isHoldTarget && pendingTargetHoldCard) {
                        playTargetedReactHoldCard(pendingTargetHoldCard, unit.instanceId, 0);
                        return;
                      }
                      if (selectedAttackerId === unit.instanceId) {
                        setSelectedAttackerId(null);
                        return;
                      }
                      if (isEligibleAttacker) {
                        sounds.playCardDraw();
                        setSelectedAttackerId(unit.instanceId);
                      }
                    }}
                    ownershipLabel={unit ? getOwnershipLabel(unit.originalOwner, 0, 0) : undefined}
                    className={unitCardClass}
                  />
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 bg-[#020617] border-l border-slate-800 p-3 rounded-xl overflow-hidden">
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs leading-snug text-slate-300">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Battle Controls</span>
              <span className="text-[10px] font-mono text-cyan-400">Turn {turnCount}</span>
            </div>
            <div className="space-y-1 font-mono text-[10px]">
              <div><span className="text-cyan-300">Active:</span> {players[currentPlayer].name}</div>
              <div><span className="text-cyan-300">Phase:</span> {reactionContext ? 'Reaction' : phase}</div>
              <div><span className="text-cyan-300">Ready attackers:</span> {humanValidAttackers.length}</div>
              {pendingTargetHoldCard && (
                <div className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-amber-200">
                  Choose a friendly field spirit as the Hold target.
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2 shrink-0 pt-2 border-t border-slate-800">
            <div className="text-center py-1.5 text-[10px] bg-cyan-900/40 border border-cyan-800/60 text-cyan-300 font-bold uppercase rounded tracking-widest">
              Phase: <span className="text-white">{reactionContext ? '⚠️ REACTION' : phase.toUpperCase()}</span>
            </div>

            <button
              onClick={() => {
                setAutoplay(prev => !prev);
                setSelectedAttackerId(null);
                setPendingTargetHoldCard(null);
              }}
              className={`w-full py-2 rounded-lg border text-[10px] font-black uppercase tracking-widest transition-all ${
                autoplay
                  ? 'bg-emerald-500 text-slate-950 border-emerald-300 shadow-[0_0_18px_rgba(16,185,129,0.45)]'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              Autoplay: {autoplay ? 'On' : 'Off'}
            </button>

            <div className="rounded-lg border border-indigo-800/70 bg-indigo-950/30 px-2 py-1.5 text-[9px] font-mono leading-snug text-slate-400">
              <span className="font-black text-cyan-300">Draw Jar:</span> your 10-card deck + the AI Spirit Lord deck, shuffled together.
            </div>

            {selectedAttacker && !reactionContext && (
              <button
                onClick={() => setSelectedAttackerId(null)}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 font-black rounded-lg text-xs uppercase tracking-widest"
              >
                Cancel Attack
              </button>
            )}

            {pendingTargetHoldCard && !reactionContext && (
              <button
                onClick={() => setPendingTargetHoldCard(null)}
                className="w-full py-2 bg-amber-950/70 hover:bg-amber-900/80 text-amber-300 font-black rounded-lg text-xs uppercase tracking-widest border border-amber-700"
              >
                Cancel Hold Target
              </button>
            )}

            {reactionContext ? (
              <div className="space-y-2">
                <div className="text-[10px] text-amber-400 font-semibold text-center bg-amber-500/10 p-2 rounded border border-amber-500/30">
                  {players[reactionContext.targetPlayerIndex].name}: Click a glowing Hold card in hand or Pass.
                </div>
                <button
                  onClick={passReaction}
                  className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-slate-950 font-black rounded-xl shadow-lg cursor-pointer transition-all"
                >
                  PASS REACTION
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => {
                    sounds.playCardDraw();
                    setSelectedAttackerId(null);
                    setPendingTargetHoldCard(null);
                    setPhase('main');
                  }}
                  disabled={phase === 'main' || !humanCanAct}
                  className={`w-full py-3 font-bold text-xs rounded-xl transition-all uppercase tracking-wider ${
                    phase === 'main'
                      ? 'bg-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.4)] cursor-default'
                      : humanCanAct
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer'
                      : 'bg-slate-900 text-slate-600 cursor-not-allowed'
                  }`}
                >
                  1. Manifest
                </button>

                <button
                  onClick={() => {
                    sounds.playCardDraw();
                    setSelectedAttackerId(null);
                    setPendingTargetHoldCard(null);
                    setPhase('attack');
                  }}
                  disabled={phase === 'attack' || !humanCanAct || humanValidAttackers.length === 0}
                  className={`w-full py-3 font-bold text-xs rounded-xl transition-all uppercase tracking-wider ${
                    phase === 'attack'
                      ? 'bg-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.4)] cursor-default'
                      : humanValidAttackers.length === 0 || !humanCanAct
                      ? 'bg-slate-900 text-slate-600 cursor-not-allowed'
                      : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg cursor-pointer'
                  }`}
                >
                  2. Attack With Ready Spirits
                </button>

                <button
                  onClick={() => {
                    sounds.playCardDraw();
                    setSelectedAttackerId(null);
                    setPendingTargetHoldCard(null);
                    setPhase('react');
                  }}
                  disabled={phase === 'react' || !humanCanAct}
                  className={`w-full py-3 font-bold text-xs rounded-xl transition-all uppercase tracking-wider ${
                    phase === 'react'
                      ? 'bg-amber-500 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.5)] cursor-default'
                      : humanCanAct
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer'
                      : 'bg-slate-900 text-slate-600 cursor-not-allowed'
                  }`}
                >
                  3. React / Done Attacking
                </button>

                <button
                  onClick={handleEndTurn}
                  disabled={!humanCanAct}
                  className={`w-full py-3.5 text-white font-black text-xs tracking-widest uppercase rounded-xl shadow-lg transition-all border ${
                    humanCanAct
                      ? 'bg-indigo-800 hover:bg-indigo-700 cursor-pointer border-indigo-600'
                      : 'bg-slate-900 text-slate-600 cursor-not-allowed border-slate-800'
                  }`}
                >
                  {isHumanTurn ? 'End Turn ➔' : 'AI Thinking…'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <CardDetailPreview card={hoveredCard} />

      <div className="h-36 bg-[#1e1b4b] border-t-2 border-cyan-500 p-2 flex gap-2 items-end shrink-0">
        <div className="flex-1 flex justify-center gap-2 overflow-x-auto overflow-y-hidden pt-1 px-2 pb-1">
          {humanPlayer.hand.length === 0 ? (
            <div className="text-slate-500 italic text-xs self-center pb-8">No cards in hand. Draw on next turn.</div>
          ) : (
            humanPlayer.hand.map(cardInst => {
              const def = BASE_CARDS[cardInst.cardId];
              if (!def) return null;

              const isReactionWindow = !!reactionContext && reactionContext.targetPlayerIndex === 0;
              const usableInReaction = isCardUsableReaction(cardInst);
              const usableInReactPhase = isCardUsableReactPhase(cardInst);
              const usableInAttackTrick = isCardUsableAttackTrick(cardInst);
              const canPlayManifest = !!(
                humanCanAct &&
                phase === 'main' &&
                !reactionContext &&
                canManifestCard(cardInst, humanPlayer)
              );

              let disabledReason: string | undefined;
              if (phase !== 'main' && !isReactionWindow && !usableInAttackTrick) disabledReason = 'Can only Manifest during Main phase';
              else if (def.id === 'ritual_ghost' && humanPlayer.field.filter(unit => unit.currentHp > 0).length < 2) disabledReason = 'Needs 2 friendly sacrifices';
              else if (def.id === 'oathbreaker_ghost' && getBoundGhostsOnEitherField(players, 0).length === 0) disabledReason = 'Needs a ghost Bound to you on either field';
              else if (humanPlayer.field.length >= FIELD_LIMIT && def.id !== 'bomb_ghost' && def.id !== 'ritual_ghost' && def.id !== 'oathbreaker_ghost') disabledReason = `Field full (${FIELD_LIMIT}/${FIELD_LIMIT} slots)`;
              else if (humanPlayer.currentPsy < def.cost) disabledReason = `Need ${def.cost} Psy (${humanPlayer.currentPsy}/${def.cost})`;
              else if (humanPlayer.hasManifestedThisTurn) disabledReason = 'Already Manifested 1 spirit this turn';

              return (
                <div
                  key={cardInst.instanceId}
                  onMouseEnter={() => setHoveredCard(def)}
                  onMouseLeave={() => setHoveredCard(null)}
                  onFocus={() => setHoveredCard(def)}
                  onBlur={() => setHoveredCard(null)}
                  className="shrink-0"
                >
                  <CardView
                    card={def}
                    canManifest={canPlayManifest}
                    isHoldReady={usableInReaction || usableInReactPhase || usableInAttackTrick}
                    onClick={() => {
                      setHoveredCard(null);
                      if (usableInReaction) {
                        playHoldCard(cardInst);
                      } else if (usableInAttackTrick && selectedAttackerId) {
                        playSwordAttackHold(cardInst, 0, selectedAttackerId);
                      } else if (usableInReactPhase) {
                        playReactHoldCard(cardInst, 0);
                      } else if (canPlayManifest) {
                        manifestCard(cardInst);
                      }
                      setSelectedHandCardId(cardInst.instanceId);
                    }}
                    onHoldClick={() => {
                      setHoveredCard(null);
                      if (usableInReaction) {
                        playHoldCard(cardInst);
                      } else if (usableInAttackTrick && selectedAttackerId) {
                        playSwordAttackHold(cardInst, 0, selectedAttackerId);
                      } else if (usableInReactPhase) {
                        playReactHoldCard(cardInst, 0);
                      }
                    }}
                    disabledReason={!canPlayManifest && !usableInReaction && !usableInReactPhase && !usableInAttackTrick ? disabledReason : undefined}
                    className="!w-28 !h-32 lg:!w-32 lg:!h-[8.5rem] text-[9px]"
                    showBadge={getOwnershipLabel(cardInst.originalOwner, 0)}
                    compact
                  />
                </div>
              );
            })
          )}
        </div>

        <div className="flex flex-col items-center justify-center p-2 bg-indigo-950/80 rounded-xl border border-cyan-500/30 ml-auto w-36 shadow-lg shrink-0 mb-1">
          <div className="flex gap-4 mb-2">
            <div className="text-center font-mono">
              <div className="text-[9px] uppercase tracking-wider text-slate-400">Leader HP</div>
              <div className="text-2xl font-black text-rose-400">
                {humanPlayer.leaderHp < 10 ? `0${humanPlayer.leaderHp}` : humanPlayer.leaderHp}<span className="text-xs opacity-40">/{STARTING_LEADER_HP}</span>
              </div>
            </div>
            <div className="text-center font-mono">
              <div className="text-[9px] uppercase tracking-wider text-slate-400">Psy</div>
              <div className="text-2xl font-black text-cyan-400">
                {humanPlayer.currentPsy < 10 ? `0${humanPlayer.currentPsy}` : humanPlayer.currentPsy}<span className="text-xs opacity-40">/{humanPlayer.maxPsy}</span>
              </div>
            </div>
          </div>

          <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
            <div
              className="bg-gradient-to-r from-cyan-500 to-teal-400 h-full transition-all duration-300"
              style={{ width: `${(humanPlayer.currentPsy / Math.max(1, humanPlayer.maxPsy)) * 100}%` }}
            />
          </div>

          <div className="mt-2 text-[9px] uppercase tracking-widest text-cyan-300 font-bold text-center">{humanPlayer.name}</div>
          {selectedHandCardId && <div className="text-[8px] text-slate-500 mt-1">Selected card</div>}
        </div>
      </div>

      <div className="border-t border-slate-800 bg-slate-950 p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Battle Log</div>
            <div className="text-[9px] font-mono text-slate-500">Plain text, copy/paste friendly for debugging.</div>
          </div>
          <button
            type="button"
            onClick={() => {
              const logText = log.map(entry => `[${entry.timestamp}] ${entry.type.toUpperCase()}: ${entry.text}`).join('\n');
              navigator.clipboard?.writeText(logText);
            }}
            className="rounded-lg border border-cyan-700 bg-cyan-950/60 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-cyan-300 hover:bg-cyan-900"
          >
            Copy Log
          </button>
        </div>
        <textarea
          readOnly
          value={log.map(entry => `[${entry.timestamp}] ${entry.type.toUpperCase()}: ${entry.text}`).join('\n')}
          className="h-40 w-full resize-y rounded-xl border border-slate-800 bg-slate-900/80 p-3 font-mono text-[11px] leading-relaxed text-slate-200 outline-none selection:bg-cyan-500 selection:text-slate-950"
        />
      </div>
    </div>
  );
}
