import { useState, useEffect, useRef, useCallback } from 'react';
import { CardInstance, FieldSpirit, PlayerState, TurnPhase, GameLogEntry, ReactionContext } from '../types';
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

const STARTING_JAR_HP = 12;
const MAX_PSY = 10;
const FIELD_LIMIT = 3;
const HAND_LIMIT = 5;

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
    def: def.def,
    keywords: [...def.keywords],
    canAttackThisTurn: def.keywords.includes('rush'),
    summonedTurn: turnCount,
    burn: 0,
    originalOwner: instance.originalOwner ?? currentPlayer
  };
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

  // Cat Ghost can only be attacked/damaged by Cat Ghosts.
  if (target.keywords.includes('cat') && !attacker.keywords.includes('cat')) return false;

  return true;
}

function hasValidAttackTarget(attacker: FieldSpirit, enemy: PlayerState): boolean {
  const validUnitTarget = enemy.field.some(target => hasValidUnitTarget(attacker, enemy, target));
  if (validUnitTarget) return true;

  if (enemy.field.length > 0) return false;
  if (attacker.keywords.includes('cat')) return false;

  return true;
}

function getValidAttackers(player: PlayerState, enemy: PlayerState): FieldSpirit[] {
  return player.field.filter(unit => unit.canAttackThisTurn && hasValidAttackTarget(unit, enemy));
}

function getBestAiTarget(attacker: FieldSpirit, enemy: PlayerState): FieldSpirit | undefined {
  const validTargets = enemy.field.filter(target => hasValidUnitTarget(attacker, enemy, target));
  if (validTargets.length === 0) return undefined;

  const taunts = validTargets.filter(target => target.keywords.includes('taunt'));
  const pool = taunts.length > 0 ? taunts : validTargets;

  return [...pool].sort((a, b) => {
    const aLethal = Math.max(1, attacker.atk - a.def) >= a.currentHp ? 1 : 0;
    const bLethal = Math.max(1, attacker.atk - b.def) >= b.currentHp ? 1 : 0;
    if (bLethal !== aLethal) return bLethal - aLethal;
    return BASE_CARDS[b.cardId].cost - BASE_CARDS[a.cardId].cost;
  })[0];
}

function JarTarget({
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
      className={`w-28 h-28 rounded-2xl border-2 flex flex-col items-center justify-center shrink-0 transition-all ${
        isClickable
          ? 'bg-rose-600/30 border-rose-300 ring-4 ring-rose-400/70 shadow-[0_0_28px_rgba(244,63,94,0.65)] cursor-pointer hover:scale-105 animate-pulse'
          : owner === 'enemy'
          ? 'bg-indigo-950/70 border-indigo-500/50'
          : 'bg-cyan-950/60 border-cyan-500/50'
      }`}
    >
      <div className="text-4xl leading-none">🏺</div>
      <div className="text-[9px] uppercase tracking-widest font-black text-slate-300 mt-1">{label}</div>
      <div className="text-2xl font-black font-mono text-rose-400">
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
      jarHp: STARTING_JAR_HP,
      maxPsy: 0,
      currentPsy: 0,
      hand: [],
      field: [],
      selectedCardIds: p1Selected,
      hasManifestedThisTurn: false,
      hasAttackedThisTurn: false
    },
    {
      id: 2,
      name: 'Spirit Lord (AI)',
      isBot: true,
      jarHp: STARTING_JAR_HP,
      maxPsy: 0,
      currentPsy: 0,
      hand: [],
      field: [],
      selectedCardIds: p2Selected,
      hasManifestedThisTurn: false,
      hasAttackedThisTurn: false
    }
  ]);

  const [selectedHandCardId, setSelectedHandCardId] = useState<string | null>(null);
  const [selectedAttackerId, setSelectedAttackerId] = useState<string | null>(null);
  const [reactionContext, setReactionContext] = useState<ReactionContext | null>(null);
  const [log, setLog] = useState<GameLogEntry[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

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
        if (unit.keywords.includes('cat') && !allowCatDamage) return unit;
        const updated = { ...unit, currentHp: unit.currentHp - damage };
        if (sourceCardId === 'flame_ghost' && damage > 0) updated.burn = 1;
        return updated;
      });
      return copy;
    });
  }, []);

  const resolveDefeatedUnits = useCallback(() => {
    setPlayers(prev => {
      let changed = false;
      const newPlayers = clonePlayers(prev).map(player => {
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

          if (dead.cardId === 'bones_ghost') {
            addLog('🦴 Bones Ghost leaves behind a Bone Pile token!', 'effect');
            remainingField.push({
              instanceId: `token_bone_${Math.random().toString(36).slice(2, 8)}`,
              cardId: 'bone_pile_token',
              currentHp: 1,
              maxHp: 1,
              atk: 0,
              def: 0,
              keywords: ['token', 'regen'],
              canAttackThisTurn: false,
              summonedTurn: turnCount,
              burn: 0,
              originalOwner: dead.originalOwner
            });
          } else if (!dead.keywords.includes('token')) {
            setDiscardPile(dp => [...dp, { instanceId: dead.instanceId, cardId: dead.cardId, originalOwner: dead.originalOwner }]);
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
      addLog('🛡️ Cat Ghost can only be attacked by another Cat Ghost! 0 damage dealt.', 'effect');
      return;
    }

    const damage = Math.max(1, attacker.atk - defender.def);
    sounds.playAttack();
    addLog(`⚔️ ${atkCard.name} attacks ${defCard.name} for ${damage} damage.`, 'attack');

    applyDamageToSpirit(defenderPlayerIdx, defender.instanceId, damage, attacker.cardId, attacker.keywords.includes('cat'));

    if (attacker.cardId === 'flame_ghost') {
      addLog(`🔥 Flame Ghost applied Burn 1 to ${defCard.name}!`, 'effect');
    }

    if (attacker.keywords.includes('splash')) {
      addLog('💥 Splash 1! Other enemy spirits take 1 damage.', 'effect');
      players[defenderPlayerIdx].field.forEach(unit => {
        if (unit.instanceId === defender.instanceId) return;
        applyDamageToSpirit(defenderPlayerIdx, unit.instanceId, 1, undefined, attacker.keywords.includes('cat'));
      });
    }
  }, [addLog, applyDamageToSpirit, players]);

  const performUnitAttack = useCallback((attacker: FieldSpirit, target: FieldSpirit, attackerPlayerIdx: 0 | 1) => {
    executeAttackDamage(attacker, target, attackerPlayerIdx);
    exhaustAttacker(attackerPlayerIdx, attacker.instanceId);
    setSelectedAttackerId(null);
    resolveDefeatedUnits();
  }, [executeAttackDamage, exhaustAttacker, resolveDefeatedUnits]);

  const performJarAttack = useCallback((attacker: FieldSpirit, attackerPlayerIdx: 0 | 1) => {
    const targetPlayerIdx = attackerPlayerIdx === 0 ? 1 : 0;
    sounds.playAttack();
    addLog(`💥 ${BASE_CARDS[attacker.cardId].name} attacks ${players[targetPlayerIdx].name}'s Jar for ${attacker.atk} damage!`, 'attack');
    setPlayers(prev => {
      const copy = clonePlayers(prev);
      copy[targetPlayerIdx].jarHp -= attacker.atk;
      return copy;
    });
    exhaustAttacker(attackerPlayerIdx, attacker.instanceId);
    setSelectedAttackerId(null);
  }, [addLog, exhaustAttacker, players]);

  const triggerHoldReactionWindow = useCallback((ctx: ReactionContext) => {
    const targetPlayer = players[ctx.targetPlayerIndex];
    const usableHolds = targetPlayer.hand.filter(card => {
      const def = BASE_CARDS[card.cardId];
      return def && def.hasHold && def.holdTrigger === ctx.trigger;
    });

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

    addLog('⚔️ Battle Started! Your deck and the AI deck were shuffled into the Draw Jar.', 'system');
    addLog('Player 1 begins Turn 1.', 'turn');
  }, [p1Selected, p2Selected, addLog]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log]);

  useEffect(() => {
    if (winner) return;
    if (players[0].jarHp <= 0) {
      sounds.playDefeat();
      setWinner(players[1]);
      addLog(`🏆 ${players[1].name} wins! Player 1's Spirit Jar shattered!`, 'win');
    } else if (players[1].jarHp <= 0) {
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
      const nextMaxPsy = Math.min(MAX_PSY, turnCount);

      active.maxPsy = nextMaxPsy;
      active.currentPsy = nextMaxPsy;
      active.hasManifestedThisTurn = false;
      active.hasAttackedThisTurn = false;

      // Burn ticks at the start of the burned unit owner's turn, then clears.
      active.field = active.field.map(unit => {
        if (unit.burn > 0) {
          addLog(`🔥 ${BASE_CARDS[unit.cardId].name} takes 1 Burn damage!`, 'effect');
          sounds.playBurn();
          return { ...unit, currentHp: unit.currentHp - 1, burn: 0 };
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
            def: BASE_CARDS.bones_ghost.def,
            keywords: [...BASE_CARDS.bones_ghost.keywords],
            canAttackThisTurn: false,
            burn: 0
          };
        }
        return unit;
      });

      // Existing non-token units ready up after start effects. New/revived units stay exhausted.
      active.field = active.field.map(unit => ({
        ...unit,
        canAttackThisTurn: unit.summonedTurn < turnCount && unit.atk > 0 && unit.cardId !== 'bone_pile_token'
      }));

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

      const hasLantern = updatedField.some(unit => unit.cardId === 'lantern_ghost' && unit.currentHp > 0);
      const hasWisp = updatedField.some(unit => unit.cardId === 'wisp_token' && unit.currentHp > 0);
      if (hasLantern && !hasWisp && updatedField.length < FIELD_LIMIT) {
        addLog('🏮 Lantern Ghost lures a Wisp token to the field!', 'effect');
        updatedField.push({
          instanceId: `token_wisp_${Math.random().toString(36).slice(2, 8)}`,
          cardId: 'wisp_token',
          currentHp: 1,
          maxHp: 1,
          atk: 1,
          def: 0,
          keywords: ['token'],
          canAttackThisTurn: false,
          summonedTurn: turnCount,
          burn: 0,
          originalOwner: playerIdx
        });
      }

      const hasOldGhost = updatedField.some(unit => unit.cardId === 'old_ghost' && unit.currentHp > 0);
      if (hasOldGhost && updatedField.filter(unit => unit.currentHp > 0).length > 1) {
        addLog('👴 Old Ghost restores 1 Jar HP at end of turn.', 'effect');
        sounds.playHeal();
        active.jarHp = Math.min(STARTING_JAR_HP, active.jarHp + 1);
      }

      active.field = updatedField;
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
    if (phase !== 'main' || reactionContext || winner) return;
    const active = players[currentPlayer];
    const def = BASE_CARDS[instance.cardId];

    if (active.hasManifestedThisTurn) {
      addLog('⚠️ You already Manifested this turn.', 'system');
      return;
    }
    if (active.field.length >= FIELD_LIMIT) {
      addLog(`⚠️ Field is full (${FIELD_LIMIT}/${FIELD_LIMIT}). Cannot Manifest another spirit.`, 'system');
      return;
    }
    if (active.currentPsy < def.cost) {
      addLog(`⚠️ Not enough Psy (${active.currentPsy}/${def.cost}).`, 'system');
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

      const newUnit = makeSpirit(instance, turnCount, currentPlayer);
      player.field = [...player.field, newUnit];

      if (def.id === 'loud_ghost') {
        const enemyIdx = currentPlayer === 0 ? 1 : 0;
        addLog('📢 Loud Ghost deals 1 damage to all enemy spirits!', 'effect');
        copy[enemyIdx].field = copy[enemyIdx].field.map(unit => {
          if (unit.keywords.includes('cat')) return unit;
          return { ...unit, currentHp: unit.currentHp - 1 };
        });
      }

      if (def.id === 'lantern_ghost' && player.field.length < FIELD_LIMIT) {
        addLog('🏮 Lantern Ghost summons a Wisp token!', 'effect');
        player.field.push({
          instanceId: `token_wisp_${Math.random().toString(36).slice(2, 8)}`,
          cardId: 'wisp_token',
          currentHp: 1,
          maxHp: 1,
          atk: 1,
          def: 0,
          keywords: ['token'],
          canAttackThisTurn: false,
          summonedTurn: turnCount,
          burn: 0,
          originalOwner: currentPlayer
        });
      }

      if (def.id === 'old_ghost') {
        addLog('👴 Old Ghost restores 2 Jar HP!', 'effect');
        sounds.playHeal();
        player.jarHp = Math.min(STARTING_JAR_HP, player.jarHp + 2);
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
  }, [addLog, currentPlayer, phase, players, reactionContext, resolveDefeatedUnits, triggerHoldReactionWindow, turnCount, winner]);

  const handleTargetClick = useCallback((targetUnit?: FieldSpirit, isEnemyJar?: boolean) => {
    if (phase !== 'attack' || !selectedAttackerId || reactionContext || winner) return;
    const active = players[currentPlayer];
    const enemyIdx = currentPlayer === 0 ? 1 : 0;
    const enemy = players[enemyIdx];
    const attacker = active.field.find(unit => unit.instanceId === selectedAttackerId);
    if (!attacker || !attacker.canAttackThisTurn) return;

    if (isEnemyJar) {
      if (enemy.field.length > 0) {
        addLog('⚠️ Cannot attack enemy Jar while opponent controls spirits!', 'system');
        return;
      }
      if (attacker.keywords.includes('cat')) {
        addLog('⚠️ Cat Ghosts cannot attack the Jar!', 'system');
        setSelectedAttackerId(null);
        return;
      }

      const hasReaction = triggerHoldReactionWindow({
        trigger: 'when_jar_damaged',
        sourcePlayerIndex: currentPlayer,
        targetPlayerIndex: enemyIdx,
        sourceSpiritInstanceId: attacker.instanceId,
        incomingDamage: attacker.atk
      });

      if (!hasReaction) performJarAttack(attacker, currentPlayer);
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
  }, [addLog, currentPlayer, performJarAttack, performUnitAttack, phase, players, reactionContext, selectedAttackerId, triggerHoldReactionWindow, winner]);

  const passReaction = useCallback(() => {
    if (!reactionContext) return;
    addLog(`${players[reactionContext.targetPlayerIndex].name} passed on the Reaction window.`, 'turn');

    const sourcePlayerIdx = reactionContext.sourcePlayerIndex as 0 | 1;
    const sourcePlayer = players[sourcePlayerIdx];
    const attacker = sourcePlayer.field.find(unit => unit.instanceId === reactionContext.sourceSpiritInstanceId);

    if (reactionContext.trigger === 'when_jar_damaged' && attacker) {
      performJarAttack(attacker, sourcePlayerIdx);
    } else if (reactionContext.trigger === 'when_enemy_attacks' && attacker && reactionContext.targetSpiritInstanceId) {
      const targetPlayerIdx = reactionContext.targetPlayerIndex as 0 | 1;
      const target = players[targetPlayerIdx].field.find(unit => unit.instanceId === reactionContext.targetSpiritInstanceId);
      if (target) performUnitAttack(attacker, target, sourcePlayerIdx);
    }

    setReactionContext(null);
    setSelectedAttackerId(null);
    resolveDefeatedUnits();
  }, [addLog, performJarAttack, performUnitAttack, players, reactionContext, resolveDefeatedUnits]);

  const playHoldCard = useCallback((cardInst: CardInstance) => {
    if (!reactionContext) return;
    const reactingPlayerIdx = reactionContext.targetPlayerIndex as 0 | 1;
    const reactingPlayer = players[reactingPlayerIdx];
    const def = BASE_CARDS[cardInst.cardId];

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

    if (def.id === 'soldier_ghost') {
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
            def: BASE_CARDS.soldier_ghost.def,
            keywords: [...BASE_CARDS.soldier_ghost.keywords],
            canAttackThisTurn: false,
            summonedTurn: turnCount,
            burn: 0,
            originalOwner: cardInst.originalOwner
          });
        }
        return copy;
      });
      if (attacker) exhaustAttacker(sourcePlayerIdx, attacker.instanceId);
    } else if (def.id === 'old_ghost') {
      addLog('👴 Old Ghost restores 2 Jar HP before the Jar damage lands!', 'effect');
      setPlayers(prev => {
        const copy = clonePlayers(prev);
        copy[reactingPlayerIdx].jarHp = Math.min(STARTING_JAR_HP, copy[reactingPlayerIdx].jarHp + 2);
        return copy;
      });
      if (attacker) performJarAttack(attacker, sourcePlayerIdx);
    } else if (def.id === 'flame_ghost') {
      if (attacker) {
        addLog('🔥 Flame Ghost sets the attacker ablaze with Burn 1!', 'effect');
        setPlayers(prev => {
          const copy = clonePlayers(prev);
          copy[sourcePlayerIdx].field = copy[sourcePlayerIdx].field.map(unit => {
            if (unit.instanceId !== attacker.instanceId) return unit;
            return { ...unit, burn: 1 };
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
            def: 0,
            keywords: ['token', 'regen'],
            canAttackThisTurn: false,
            summonedTurn: turnCount,
            burn: 0,
            originalOwner: cardInst.originalOwner
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
  }, [addLog, exhaustAttacker, performJarAttack, performUnitAttack, players, reactionContext, resolveDefeatedUnits, turnCount]);

  useEffect(() => {
    if (!selectedAttackerId) return;
    const human = players[0];
    const enemy = players[1];
    const stillValid = getValidAttackers(human, enemy).some(unit => unit.instanceId === selectedAttackerId);
    if (!stillValid) setSelectedAttackerId(null);
  }, [players, selectedAttackerId]);

  useEffect(() => {
    if (winner || reactionContext) return;
    const active = players[currentPlayer];
    if (!active.isBot) return;

    const timer = setTimeout(() => {
      const enemyIdx = currentPlayer === 0 ? 1 : 0;
      const enemy = players[enemyIdx];

      if (phase === 'main') {
        if (!active.hasManifestedThisTurn && active.field.length < FIELD_LIMIT) {
          const playable = active.hand
            .filter(card => BASE_CARDS[card.cardId].cost <= active.currentPsy)
            .sort((a, b) => BASE_CARDS[b.cardId].cost - BASE_CARDS[a.cardId].cost);

          if (playable.length > 0) {
            manifestCard(playable[0]);
            return;
          }
        }

        setPhase('attack');
        return;
      }

      if (phase === 'attack') {
        const validAttackers = getValidAttackers(active, enemy);
        if (validAttackers.length === 0) {
          setPhase('react');
          return;
        }

        const attacker = validAttackers[0];
        const target = getBestAiTarget(attacker, enemy);

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

        if (enemy.field.length === 0 && !attacker.keywords.includes('cat')) {
          const hasReaction = triggerHoldReactionWindow({
            trigger: 'when_jar_damaged',
            sourcePlayerIndex: currentPlayer,
            targetPlayerIndex: enemyIdx,
            sourceSpiritInstanceId: attacker.instanceId,
            incomingDamage: attacker.atk
          });
          if (!hasReaction) performJarAttack(attacker, currentPlayer);
          return;
        }

        setPhase('react');
        return;
      }

      if (phase === 'react' || phase === 'end') {
        handleEndTurn();
        return;
      }

      // Absolute AI failsafe: no branch should leave the enemy UI stuck.
      handleEndTurn();
    }, 550);

    return () => clearTimeout(timer);
  }, [currentPlayer, handleEndTurn, manifestCard, performJarAttack, performUnitAttack, phase, players, reactionContext, triggerHoldReactionWindow, winner]);

  useEffect(() => {
    if (!reactionContext) return;
    const reactingPlayer = players[reactionContext.targetPlayerIndex];
    if (!reactingPlayer.isBot) return;

    const timer = setTimeout(() => {
      const usableHolds = reactingPlayer.hand.filter(card => {
        const def = BASE_CARDS[card.cardId];
        return def && def.hasHold && def.holdTrigger === reactionContext.trigger;
      });

      if (usableHolds.length > 0) playHoldCard(usableHolds[0]);
      else passReaction();
    }, 700);

    return () => clearTimeout(timer);
  }, [passReaction, playHoldCard, players, reactionContext]);

  const humanPlayer = players[0];
  const computerPlayer = players[1];
  const isHumanTurn = currentPlayer === 0;
  const humanCanAct = isHumanTurn && !winner;
  const selectedAttacker = humanPlayer.field.find(unit => unit.instanceId === selectedAttackerId);
  const canAttackEnemyJar = !!selectedAttacker && computerPlayer.field.length === 0 && !selectedAttacker.keywords.includes('cat');
  const humanValidAttackers = getValidAttackers(humanPlayer, computerPlayer);

  const isCardUsableReaction = (card: CardInstance) => {
    if (!reactionContext) return false;
    if (reactionContext.targetPlayerIndex !== 0) return false;
    const def = BASE_CARDS[card.cardId];
    return def && def.hasHold && def.holdTrigger === reactionContext.trigger;
  };

  const unitCardClass = '!w-32 !h-44 lg:!w-36 lg:!h-48';

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] min-h-[620px] max-h-[920px] w-full max-w-[1400px] mx-auto bg-[#0f172a] text-slate-100 font-sans overflow-hidden border-4 sm:border-8 border-[#1e293b] rounded-2xl shadow-2xl relative select-none">
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
            <div className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">Jar HP</div>
            <div className="text-2xl font-black text-rose-500">
              {computerPlayer.jarHp < 10 ? `0${computerPlayer.jarHp}` : computerPlayer.jarHp}<span className="text-sm opacity-50">/{STARTING_JAR_HP}</span>
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

      <div className="relative flex-1 grid grid-cols-[1fr_220px] xl:grid-cols-[1fr_240px] p-2 gap-2 overflow-hidden">
        <div className="flex flex-col justify-between overflow-hidden pr-1 gap-2">
          <div className="flex justify-center items-center gap-3 shrink-0">
            <JarTarget
              label="Enemy Jar"
              hp={computerPlayer.jarHp}
              maxHp={STARTING_JAR_HP}
              owner="enemy"
              isClickable={humanCanAct && phase === 'attack' && canAttackEnemyJar}
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
            </div>

            <div className="text-center group">
              <div className="w-16 h-24 bg-slate-900 rounded-lg border-2 border-slate-700 flex flex-col items-center justify-center grayscale opacity-70 transition-opacity group-hover:opacity-100">
                <div className="text-3xl">💀</div>
                <div className="text-[10px] font-mono text-slate-400 mt-1">{discardPile.length}</div>
              </div>
              <div className="text-[10px] uppercase mt-1 font-bold text-slate-500 tracking-widest">Discard</div>
            </div>
          </div>

          <div className="flex justify-center items-center gap-3 shrink-0">
            <JarTarget label="Your Jar" hp={humanPlayer.jarHp} maxHp={STARTING_JAR_HP} owner="player" />
            <div className="flex justify-center gap-2 items-center">
              {[0, 1, 2].map(slotIdx => {
                const unit = humanPlayer.field[slotIdx];
                const isEligibleAttacker = !!(humanCanAct && phase === 'attack' && unit && getValidAttackers(humanPlayer, computerPlayer).some(attacker => attacker.instanceId === unit.instanceId));

                return (
                  <FieldUnitView
                    key={`player_slot_${slotIdx}`}
                    slotIndex={slotIdx}
                    spirit={unit}
                    isEmpty={!unit}
                    canAttack={isEligibleAttacker && !selectedAttackerId}
                    isSelectedForAttack={selectedAttackerId === unit?.instanceId}
                    onClick={() => {
                      if (!unit) return;
                      if (selectedAttackerId === unit.instanceId) {
                        setSelectedAttackerId(null);
                        return;
                      }
                      if (isEligibleAttacker) {
                        sounds.playCardDraw();
                        setSelectedAttackerId(unit.instanceId);
                      }
                    }}
                    className={unitCardClass}
                  />
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 bg-[#020617] border-l border-slate-800 p-3 rounded-xl overflow-hidden">
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Battle Log</span>
              <span className="text-[10px] font-mono text-cyan-400">Turn {turnCount}</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 text-xs font-mono pr-1">
              {log.map(entry => (
                <div
                  key={entry.id}
                  className={`p-2 rounded border-l-2 leading-snug ${
                    entry.type === 'system'
                      ? 'bg-indigo-950/40 border-cyan-500 text-cyan-300'
                      : entry.type === 'hold'
                      ? 'bg-amber-950/40 border-amber-500 text-amber-300 animate-pulse font-bold'
                      : entry.type === 'win'
                      ? 'bg-emerald-950/50 border-emerald-400 text-emerald-200 font-bold'
                      : entry.type === 'manifest'
                      ? 'bg-purple-950/30 border-purple-400 text-purple-200'
                      : entry.type === 'attack'
                      ? 'bg-rose-950/30 border-rose-500 text-rose-200'
                      : 'opacity-85 text-slate-300'
                  }`}
                >
                  <span className="opacity-50 mr-1.5 text-[9px]">[{entry.timestamp}]</span>
                  {entry.text}
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>

          <div className="space-y-2 shrink-0 pt-2 border-t border-slate-800">
            <div className="text-center py-1.5 text-[10px] bg-cyan-900/40 border border-cyan-800/60 text-cyan-300 font-bold uppercase rounded tracking-widest">
              Phase: <span className="text-white">{reactionContext ? '⚠️ REACTION' : phase.toUpperCase()}</span>
            </div>

            {selectedAttacker && !reactionContext && (
              <button
                onClick={() => setSelectedAttackerId(null)}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 font-black rounded-lg text-xs uppercase tracking-widest"
              >
                Cancel Attack
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

      <div className="h-44 bg-[#1e1b4b] border-t-2 border-cyan-500 p-2 flex gap-2 items-end shrink-0">
        <div className="flex-1 flex justify-center gap-2 overflow-x-auto overflow-y-visible pt-4 px-2 pb-1">
          {humanPlayer.hand.length === 0 ? (
            <div className="text-slate-500 italic text-xs self-center pb-8">No cards in hand. Draw on next turn.</div>
          ) : (
            humanPlayer.hand.map(cardInst => {
              const def = BASE_CARDS[cardInst.cardId];
              if (!def) return null;

              const isReactionWindow = !!reactionContext && reactionContext.targetPlayerIndex === 0;
              const usableInReaction = isCardUsableReaction(cardInst);
              const canPlayManifest = !!(
                humanCanAct &&
                phase === 'main' &&
                !reactionContext &&
                humanPlayer.currentPsy >= def.cost &&
                humanPlayer.field.length < FIELD_LIMIT &&
                !humanPlayer.hasManifestedThisTurn
              );

              let disabledReason: string | undefined;
              if (phase !== 'main' && !isReactionWindow) disabledReason = 'Can only Manifest during Main phase';
              else if (humanPlayer.field.length >= FIELD_LIMIT) disabledReason = `Field full (${FIELD_LIMIT}/${FIELD_LIMIT} slots)`;
              else if (humanPlayer.currentPsy < def.cost) disabledReason = `Need ${def.cost} Psy (${humanPlayer.currentPsy}/${def.cost})`;
              else if (humanPlayer.hasManifestedThisTurn) disabledReason = 'Already Manifested 1 spirit this turn';

              return (
                <CardView
                  key={cardInst.instanceId}
                  card={def}
                  canManifest={canPlayManifest}
                  isHoldReady={usableInReaction}
                  onClick={() => {
                    if (usableInReaction) playHoldCard(cardInst);
                    else if (canPlayManifest) manifestCard(cardInst);
                    setSelectedHandCardId(cardInst.instanceId);
                  }}
                  onHoldClick={() => usableInReaction && playHoldCard(cardInst)}
                  disabledReason={!canPlayManifest && !usableInReaction ? disabledReason : undefined}
                  className="!w-32 !h-40 lg:!w-36 lg:!h-44 text-[10px]"
                  compact
                />
              );
            })
          )}
        </div>

        <div className="flex flex-col items-center justify-center p-2 bg-indigo-950/80 rounded-xl border border-cyan-500/30 ml-auto w-36 shadow-lg shrink-0 mb-1">
          <div className="flex gap-4 mb-2">
            <div className="text-center font-mono">
              <div className="text-[9px] uppercase tracking-wider text-slate-400">Jar HP</div>
              <div className="text-2xl font-black text-rose-400">
                {humanPlayer.jarHp < 10 ? `0${humanPlayer.jarHp}` : humanPlayer.jarHp}<span className="text-xs opacity-40">/{STARTING_JAR_HP}</span>
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
    </div>
  );
}
