import { useState, useEffect, useRef, useCallback } from 'react';
import { CardInstance, FieldSpirit, PlayerState, TurnPhase, GameLogEntry, ReactionContext, HoldTrigger } from '../types';
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

export function BattleScreen({ p1Selected, p2Selected, onRestart }: BattleScreenProps) {
  // Game State
  const [sharedDeck, setSharedDeck] = useState<CardInstance[]>([]);
  const [discardPile, setDiscardPile] = useState<CardInstance[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<0 | 1>(0); // 0 = P1, 1 = P2
  const [phase, setPhase] = useState<TurnPhase>('start');
  const [turnCount, setTurnCount] = useState<number>(1);
  const [winner, setWinner] = useState<PlayerState | null>(null);

  const [players, setPlayers] = useState<PlayerState[]>([
    {
      id: 1,
      name: 'Player 1',
      isBot: false,
      jarHp: 12,
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
      jarHp: 12,
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
        id: Math.random().toString(36).substring(2, 9),
        text,
        type,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      }
    ]);
  }, []);

  // Initialize Game on Mount
  useEffect(() => {
    // Combine selected cards into shared deck
    const deck: CardInstance[] = [];
    p1Selected.forEach((cardId, idx) => {
      deck.push({ instanceId: `p1_${cardId}_${idx}_${Math.random().toString(36).substr(2, 5)}`, cardId, originalOwner: 0 });
    });
    p2Selected.forEach((cardId, idx) => {
      deck.push({ instanceId: `p2_${cardId}_${idx}_${Math.random().toString(36).substr(2, 5)}`, cardId, originalOwner: 1 });
    });

    // Shuffle deck
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    // Deal 4 cards to P1 and 4 cards to the AI
    const p1Hand = deck.splice(0, 4);
    const p2Hand = deck.splice(0, 4);

    setSharedDeck(deck);
    setPlayers(prev => [
      { ...prev[0], hand: p1Hand },
      { ...prev[1], hand: p2Hand }
    ]);

    addLog('⚔️ Battle Started! Your secret deck and the AI deck were shuffled into the shared Spirit Jar.', 'system');
    addLog('Player 1 begins Turn 1.', 'turn');
  }, [p1Selected, p2Selected, addLog]);

  // Auto scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log]);

  // Reshuffle discard rule helper
  const checkReshuffle = useCallback((currentDeck: CardInstance[], currentDiscard: CardInstance[]) => {
    if (currentDeck.length <= 4 && currentDiscard.length > 0) {
      addLog(`♻️ Shared deck low (${currentDeck.length} cards). Shuffling ${currentDiscard.length} discarded cards back into Jar!`, 'system');
      sounds.playCardDraw();
      const newDeck = [...currentDeck, ...currentDiscard];
      for (let i = newDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
      }
      return { newDeck, newDiscard: [] };
    }
    return { newDeck: currentDeck, newDiscard: currentDiscard };
  }, [addLog]);

  // Check Win Condition
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
      addLog(`🏆 ${players[0].name} wins! Opponent's Spirit Jar shattered!`, 'win');
    }
  }, [players, winner, addLog]);

  // Phase Execution Helpers
  const triggerHoldReactionWindow = (ctx: ReactionContext) => {
    // Check if target player actually has a usable hold card for this trigger
    const targetPlayer = players[ctx.targetPlayerIndex];
    const usableHolds = targetPlayer.hand.filter(c => {
      const def = BASE_CARDS[c.cardId];
      return def && def.hasHold && def.holdTrigger === ctx.trigger;
    });

    if (usableHolds.length > 0) {
      sounds.playHoldReady();
      setReactionContext(ctx);
      addLog(`⚠️ REACTION WINDOW: ${targetPlayer.name} may play a Hold effect!`, 'hold');
      return true;
    }
    return false;
  };

  const executeAttackDamage = useCallback((attacker: FieldSpirit, defender: FieldSpirit, attackerPlayerIdx: 0 | 1) => {
    const defenderPlayerIdx = attackerPlayerIdx === 0 ? 1 : 0;
    const defCard = BASE_CARDS[defender.cardId];
    const atkCard = BASE_CARDS[attacker.cardId];

    // Check Cat restriction
    if (defender.keywords.includes('cat') && !attacker.keywords.includes('cat')) {
      addLog(`🛡️ Cat Ghost is immune to non-Cat attacks! 0 damage dealt.`, 'effect');
      return;
    }

    let damage = Math.max(1, attacker.atk - defender.def);
    sounds.playAttack();
    addLog(`⚔️ ${atkCard.name} attacks ${defCard.name} for ${damage} damage (ATK ${attacker.atk} - DEF ${defender.def}).`, 'attack');

    setPlayers(prev => {
      const copy = [...prev];
      const targetField = [...copy[defenderPlayerIdx].field];
      const targetUnitIdx = targetField.findIndex(u => u.instanceId === defender.instanceId);
      if (targetUnitIdx === -1) return prev;

      const updatedUnit = { ...targetField[targetUnitIdx], currentHp: targetField[targetUnitIdx].currentHp - damage };
      
      // Check Burn hit apply
      if (attacker.cardId === 'flame_ghost') {
        updatedUnit.burn = 1;
        addLog(`🔥 Flame Ghost applied Burn 1 to ${defCard.name}!`, 'effect');
      }

      targetField[targetUnitIdx] = updatedUnit;
      copy[defenderPlayerIdx].field = targetField;
      return copy;
    });

    // Check Splash
    if (attacker.keywords.includes('splash')) {
      addLog(`💥 Splash 1! All other enemy spirits take 1 damage.`, 'effect');
      setPlayers(prev => {
        const copy = [...prev];
        copy[defenderPlayerIdx].field = copy[defenderPlayerIdx].field.map(u => {
          if (u.instanceId === defender.instanceId) return u;
          return { ...u, currentHp: u.currentHp - 1 };
        });
        return copy;
      });
    }
  }, [addLog]);

  // Clean up defeated units & check regen
  const resolveDefeatedUnits = useCallback(() => {
    setPlayers(prev => {
      let changed = false;
      const newPlayers = prev.map((player, pIdx) => {
        const remainingField: FieldSpirit[] = [];
        const newlyDefeated: FieldSpirit[] = [];

        player.field.forEach(unit => {
          if (unit.currentHp <= 0) {
            newlyDefeated.push(unit);
            changed = true;
          } else {
            remainingField.push(unit);
          }
        });

        if (newlyDefeated.length > 0) {
          newlyDefeated.forEach(dead => {
            const def = BASE_CARDS[dead.cardId];
            addLog(`💀 ${player.name}'s ${def.name} was defeated!`, 'defeat');

            // Check Regen (become bone pile token)
            if (dead.keywords.includes('regen') && dead.cardId === 'bones_ghost') {
              addLog(`🦴 Bones Ghost leaves behind a Bone Pile token!`, 'effect');
              remainingField.push({
                instanceId: `token_bone_${Math.random().toString(36).substr(2, 5)}`,
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
              // Non-token enters discard pile
              setDiscardPile(dp => [...dp, { instanceId: dead.instanceId, cardId: dead.cardId, originalOwner: dead.originalOwner }]);
            }
          });
        }

        return { ...player, field: remainingField };
      });

      return changed ? newPlayers : prev;
    });
  }, [addLog, turnCount]);

  // Run cleanup whenever combat happens
  useEffect(() => {
    resolveDefeatedUnits();
  }, [players[0].field, players[1].field, resolveDefeatedUnits]);

  // Draw Phase Logic
  const handleDrawPhase = useCallback(() => {
    setPlayers(prev => {
      const active = prev[currentPlayer];
      if (active.hand.length >= 5) {
        addLog(`⚠️ ${active.name}'s hand is full (5/5). Cannot draw.`, 'system');
        setPhase('main');
        return prev;
      }

      // Check reshuffle rule
      let currentDeck = [...sharedDeck];
      let currentDiscard = [...discardPile];
      const reshuffled = checkReshuffle(currentDeck, currentDiscard);
      currentDeck = reshuffled.newDeck;
      currentDiscard = reshuffled.newDiscard;
      setDiscardPile(currentDiscard);

      if (currentDeck.length === 0) {
        addLog(`⚠️ Shared Jar is completely empty! No cards left to draw.`, 'system');
        setPhase('main');
        return prev;
      }

      const drawnCard = currentDeck[0];
      const remDeck = currentDeck.slice(1);
      setSharedDeck(remDeck);
      sounds.playCardDraw();

      const def = BASE_CARDS[drawnCard.cardId];
      addLog(`🃏 ${active.name} drew a card${active.isBot ? '' : `: ${def.name}`}.`, 'turn');

      const copy = [...prev];
      copy[currentPlayer].hand = [...active.hand, drawnCard];
      setPhase('main');
      return copy;
    });
  }, [currentPlayer, sharedDeck, discardPile, checkReshuffle, addLog]);

  // Start Turn Logic
  const handleStartPhase = useCallback(() => {
    setPlayers(prev => {
      const copy = [...prev];
      const active = copy[currentPlayer];

      // 1. Refill Psy for this round. Psy cost only spends currentPsy;
      // maxPsy is derived from the round number so Turn 3 is always 3/3.
      const nextMaxPsy = Math.min(10, turnCount);
      copy[currentPlayer].maxPsy = nextMaxPsy;
      copy[currentPlayer].currentPsy = nextMaxPsy;
      copy[currentPlayer].hasManifestedThisTurn = false;
      copy[currentPlayer].hasAttackedThisTurn = false;

      // 2. Refresh spirits attack eligibility
      copy[currentPlayer].field = active.field.map(unit => ({
        ...unit,
        canAttackThisTurn: true
      }));

      // 3. Start of Turn effects (Bone pile revive)
      let fieldCopy = [...copy[currentPlayer].field];
      fieldCopy = fieldCopy.map(u => {
        if (u.cardId === 'bone_pile_token') {
          addLog(`✨ Start of turn: Bone Pile revives into Bones Ghost!`, 'effect');
          sounds.playHeal();
          return {
            ...u,
            cardId: 'bones_ghost',
            currentHp: 3,
            maxHp: 3,
            atk: 2,
            def: 1,
            keywords: ['regen'],
            canAttackThisTurn: false
          };
        }
        return u;
      });
      copy[currentPlayer].field = fieldCopy;

      return copy;
    });

    setPhase('draw');
  }, [currentPlayer, turnCount, addLog]);

  // End Turn Logic
  const handleEndTurn = useCallback(() => {
    // 1. Resolve Burn
    setPlayers(prev => {
      const copy = [...prev];
      const active = copy[currentPlayer];

      let updatedField = active.field.map(unit => {
        if (unit.burn > 0) {
          addLog(`🔥 ${BASE_CARDS[unit.cardId].name} takes 1 Burn damage!`, 'effect');
          sounds.playBurn();
          return { ...unit, currentHp: unit.currentHp - 1, burn: 0 };
        }
        return unit;
      });

      // 2. End of Turn Effects
      // Lantern Ghost: summon Wisp if no Wisps controlled
      const hasLantern = updatedField.some(u => u.cardId === 'lantern_ghost' && u.currentHp > 0);
      const hasWisp = updatedField.some(u => u.cardId === 'wisp_token' && u.currentHp > 0);
      if (hasLantern && !hasWisp && updatedField.length < 3) {
        addLog(`🏮 Lantern Ghost lures a Wisp token to the field!`, 'effect');
        updatedField.push({
          instanceId: `token_wisp_${Math.random().toString(36).substr(2, 5)}`,
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

      // Old Ghost: restore 1 Jar HP if control another spirit
      const hasOldGhost = updatedField.some(u => u.cardId === 'old_ghost' && u.currentHp > 0);
      if (hasOldGhost && updatedField.length > 1) {
        addLog(`👴 Old Ghost restores 1 Jar HP at end of turn.`, 'effect');
        sounds.playHeal();
        copy[currentPlayer].jarHp = Math.min(20, copy[currentPlayer].jarHp + 1);
      }

      copy[currentPlayer].field = updatedField;
      return copy;
    });

    // Cleanup dead units
    resolveDefeatedUnits();

    // Switch player. Turn count is a round number: P1 Turn 3 and AI Turn 3 both use 3/3 Psy.
    const nextPlayer = currentPlayer === 0 ? 1 : 0;
    const nextTurnCount = nextPlayer === 0 ? turnCount + 1 : turnCount;
    setCurrentPlayer(nextPlayer);
    setTurnCount(nextTurnCount);
    setPhase('start');
    setSelectedHandCardId(null);
    setSelectedAttackerId(null);
    addLog(`--- Turn ${nextTurnCount}: ${players[nextPlayer].name}'s Turn ---`, 'turn');
  }, [currentPlayer, players, turnCount, addLog, resolveDefeatedUnits]);

  // Phase transition hook
  useEffect(() => {
    if (winner || reactionContext) return;
    if (phase === 'start') {
      handleStartPhase();
    } else if (phase === 'draw') {
      handleDrawPhase();
    }
  }, [phase, winner, reactionContext, handleStartPhase, handleDrawPhase]);

  // User Action: Manifest Card
  const manifestCard = (instance: CardInstance) => {
    if (phase !== 'main' || reactionContext || winner) return;
    const active = players[currentPlayer];
    const def = BASE_CARDS[instance.cardId];

    if (active.field.length >= 3) {
      addLog(`⚠️ Field is full (3/3). Cannot Manifest another spirit.`, 'system');
      return;
    }
    if (active.currentPsy < def.cost) {
      addLog(`⚠️ Not enough Psy (${active.currentPsy}/${def.cost}).`, 'system');
      return;
    }

    sounds.playManifest();
    addLog(`✨ ${active.name} Manifested ${def.name}! (Cost -${def.cost} Psy)`, 'manifest');

    // Remove from hand, deduct Psy, add to field
    setPlayers(prev => {
      const copy = [...prev];
      const p = copy[currentPlayer];
      p.hand = p.hand.filter(c => c.instanceId !== instance.instanceId);
      p.currentPsy -= def.cost;

      const newUnit: FieldSpirit = {
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
        originalOwner: instance.originalOwner
      };

      p.field = [...p.field, newUnit];
      p.hasManifestedThisTurn = true;

      // Manifest immediate effects
      if (def.id === 'loud_ghost') {
        // AoE 1 to enemy spirits
        const enemyIdx = currentPlayer === 0 ? 1 : 0;
        copy[enemyIdx].field = copy[enemyIdx].field.map(u => ({ ...u, currentHp: u.currentHp - 1 }));
      } else if (def.id === 'lantern_ghost') {
        if (p.field.length < 3) {
          addLog(`🏮 Lantern Ghost summons a Wisp token!`, 'effect');
          p.field.push({
            instanceId: `token_wisp_${Math.random().toString(36).substr(2, 5)}`,
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
      } else if (def.id === 'old_ghost') {
        addLog(`👴 Old Ghost restores 2 Jar HP!`, 'effect');
        sounds.playHeal();
        p.jarHp += 2;
      }

      return copy;
    });

    setSelectedHandCardId(null);
    resolveDefeatedUnits();

    // Check reaction trigger when enemy summons
    const enemyIdx = currentPlayer === 0 ? 1 : 0;
    triggerHoldReactionWindow({
      trigger: instance.cardId === 'wisp_token' ? 'when_enemy_summons_token' : 'when_enemy_summons',
      sourcePlayerIndex: currentPlayer,
      targetPlayerIndex: enemyIdx,
      sourceSpiritInstanceId: instance.instanceId
    });
  };

  // User Action: Select Attacker & Target
  const handleTargetClick = (targetUnit?: FieldSpirit, isEnemyJar?: boolean) => {
    if (phase !== 'attack' || !selectedAttackerId || reactionContext || winner) return;
    const active = players[currentPlayer];
    const enemyIdx = currentPlayer === 0 ? 1 : 0;
    const enemyPlayer = players[enemyIdx];

    const attacker = active.field.find(u => u.instanceId === selectedAttackerId);
    if (!attacker) return;

    // Validate Taunt target requirement
    const enemyTaunts = enemyPlayer.field.filter(u => u.keywords.includes('taunt'));
    if (targetUnit && enemyTaunts.length > 0 && !targetUnit.keywords.includes('taunt')) {
      addLog(`⚠️ You must attack an enemy spirit with Taunt first!`, 'system');
      return;
    }

    // Validate Jar attack
    if (isEnemyJar) {
      if (enemyPlayer.field.length > 0) {
        addLog(`⚠️ Cannot attack enemy Jar while opponent controls spirits!`, 'system');
        return;
      }
      if (attacker.keywords.includes('cat')) {
        addLog(`⚠️ Cat Ghosts cannot attack the Jar!`, 'system');
        return;
      }

      // Check Reaction Window for Jar Damaged
      const hasReaction = triggerHoldReactionWindow({
        trigger: 'when_jar_damaged',
        sourcePlayerIndex: currentPlayer,
        targetPlayerIndex: enemyIdx,
        sourceSpiritInstanceId: attacker.instanceId,
        incomingDamage: attacker.atk
      });

      if (!hasReaction) {
        sounds.playAttack();
        addLog(`💥 ${BASE_CARDS[attacker.cardId].name} attacks enemy Jar directly for ${attacker.atk} damage!`, 'attack');
        setPlayers(prev => {
          const copy = [...prev];
          copy[enemyIdx].jarHp -= attacker.atk;
          copy[currentPlayer].hasAttackedThisTurn = true;
          return copy;
        });
        setSelectedAttackerId(null);
      }
      return;
    }

    if (targetUnit) {
      // Check reaction for enemy attacks
      const hasReaction = triggerHoldReactionWindow({
        trigger: 'when_enemy_attacks',
        sourcePlayerIndex: currentPlayer,
        targetPlayerIndex: enemyIdx,
        sourceSpiritInstanceId: attacker.instanceId,
        targetSpiritInstanceId: targetUnit.instanceId
      });

      if (!hasReaction) {
        executeAttackDamage(attacker, targetUnit, currentPlayer);
        setPlayers(prev => {
          const copy = [...prev];
          copy[currentPlayer].hasAttackedThisTurn = true;
          return copy;
        });
        setSelectedAttackerId(null);
      }
    }
  };

  // Play Hold Reaction Card
  const playHoldCard = (cardInst: CardInstance) => {
    if (!reactionContext) return;
    const reactingPlayerIdx = reactionContext.targetPlayerIndex;
    const reactingPlayer = players[reactingPlayerIdx];
    const def = BASE_CARDS[cardInst.cardId];

    sounds.playManifest();
    addLog(`⚡ REACTION PLAYED: ${reactingPlayer.name} uses ${def.name} Hold effect!`, 'hold');

    // Remove card from hand to discard
    setPlayers(prev => {
      const copy = [...prev];
      copy[reactingPlayerIdx].hand = copy[reactingPlayerIdx].hand.filter(c => c.instanceId !== cardInst.instanceId);
      return copy;
    });
    setDiscardPile(dp => [...dp, cardInst]);

    // Resolve specific hold effects
    if (def.id === 'soldier_ghost') {
      // Redirect damage to summoned soldier ghost
      addLog(`🛡️ Soldier Ghost manifests to intercept the incoming attack!`, 'effect');
      setPlayers(prev => {
        const copy = [...prev];
        if (copy[reactingPlayerIdx].field.length < 3) {
          copy[reactingPlayerIdx].field.push({
            instanceId: cardInst.instanceId,
            cardId: 'soldier_ghost',
            currentHp: Math.max(1, 5 - (reactionContext.incomingDamage || 1)),
            maxHp: 5,
            atk: 1,
            def: 2,
            keywords: ['taunt'],
            canAttackThisTurn: false,
            summonedTurn: turnCount,
            burn: 0,
            originalOwner: cardInst.originalOwner
          });
        }
        return copy;
      });
    } else if (def.id === 'old_ghost') {
      // Restore 2 Jar HP after damage
      addLog(`👴 Old Ghost restores 2 Jar HP to survive!`, 'effect');
      sounds.playHeal();
      setPlayers(prev => {
        const copy = [...prev];
        copy[reactingPlayerIdx].jarHp += 2;
        if (reactionContext.incomingDamage && reactionContext.trigger === 'when_jar_damaged') {
          copy[reactingPlayerIdx].jarHp -= reactionContext.incomingDamage;
        }
        return copy;
      });
    } else if (def.id === 'flame_ghost') {
      // Apply Burn 1 to attacker
      if (reactionContext.sourceSpiritInstanceId) {
        addLog(`🔥 Flame Ghost sets the attacker ablaze with Burn 1!`, 'effect');
        setPlayers(prev => {
          const copy = [...prev];
          const srcIdx = reactionContext.sourcePlayerIndex;
          copy[srcIdx].field = copy[srcIdx].field.map(u => {
            if (u.instanceId === reactionContext.sourceSpiritInstanceId) {
              return { ...u, burn: 1 };
            }
            return u;
          });
          return copy;
        });
      }
      // Resume pending attack
      if (reactionContext.sourceSpiritInstanceId && reactionContext.targetSpiritInstanceId) {
        const srcPlayer = players[reactionContext.sourcePlayerIndex];
        const tgtPlayer = players[reactingPlayerIdx];
        const atk = srcPlayer.field.find(u => u.instanceId === reactionContext.sourceSpiritInstanceId);
        const defUnit = tgtPlayer.field.find(u => u.instanceId === reactionContext.targetSpiritInstanceId);
        if (atk && defUnit) executeAttackDamage(atk, defUnit, reactionContext.sourcePlayerIndex);
      }
    } else if (def.id === 'loud_ghost') {
      // AoE 1 to enemy tokens
      addLog(`📢 Loud Ghost shatters all enemy tokens!`, 'effect');
      const srcIdx = reactionContext.sourcePlayerIndex;
      setPlayers(prev => {
        const copy = [...prev];
        copy[srcIdx].field = copy[srcIdx].field.filter(u => !u.keywords.includes('token'));
        return copy;
      });
    } else if (def.id === 'bones_ghost') {
      // Summon Bone Pile
      addLog(`🦴 Bones Ghost rises from the defeated spirit!`, 'effect');
      setPlayers(prev => {
        const copy = [...prev];
        if (copy[reactingPlayerIdx].field.length < 3) {
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
      addLog(`🐾 Cat Ghost cancels the targeting effect!`, 'effect');
    }

    setReactionContext(null);
    resolveDefeatedUnits();
  };

  const passReaction = () => {
    if (!reactionContext) return;
    addLog(`${players[reactionContext.targetPlayerIndex].name} passed on Reaction window.`, 'turn');
    
    // If incoming Jar damage was waiting
    if (reactionContext.trigger === 'when_jar_damaged' && reactionContext.incomingDamage) {
      const tgtIdx = reactionContext.targetPlayerIndex;
      sounds.playAttack();
      setPlayers(prev => {
        const copy = [...prev];
        copy[tgtIdx].jarHp -= reactionContext.incomingDamage!;
        return copy;
      });
    } else if (reactionContext.trigger === 'when_enemy_attacks' && reactionContext.sourceSpiritInstanceId && reactionContext.targetSpiritInstanceId) {
      const srcPlayer = players[reactionContext.sourcePlayerIndex];
      const tgtPlayer = players[reactionContext.targetPlayerIndex];
      const atk = srcPlayer.field.find(u => u.instanceId === reactionContext.sourceSpiritInstanceId);
      const defUnit = tgtPlayer.field.find(u => u.instanceId === reactionContext.targetSpiritInstanceId);
      if (atk && defUnit) executeAttackDamage(atk, defUnit, reactionContext.sourcePlayerIndex);
    }

    setReactionContext(null);
    setSelectedAttackerId(null);
    resolveDefeatedUnits();
  };

  // AI Opponent Turn Automation
  useEffect(() => {
    if (winner || reactionContext) return;

    const active = players[currentPlayer];
    if (!active.isBot) return;

    const timer = setTimeout(() => {
      if (phase === 'main') {
        if (!active.hasManifestedThisTurn) {
          // Find best manifestable card.
          const playable = active.hand.filter(c => BASE_CARDS[c.cardId].cost <= active.currentPsy);

          if (playable.length > 0 && active.field.length < 3) {
            // Pick highest cost card the AI can currently afford.
            playable.sort((a, b) => BASE_CARDS[b.cardId].cost - BASE_CARDS[a.cardId].cost);
            manifestCard(playable[0]);
            return;
          }
        }

        // Important: after the AI manifests, the next render returns here with
        // hasManifestedThisTurn=true. Move to attack instead of getting stuck in main.
        setPhase('attack');
        return;
      }

      if (phase === 'attack') {
        if (active.hasAttackedThisTurn) {
          setPhase('react');
          return;
        }

        const readyAttacker = active.field.find(u => u.canAttackThisTurn);

        if (!readyAttacker) {
          setPhase('react');
          return;
        }

        const p1 = players[0];
        const taunts = p1.field.filter(u => u.keywords.includes('taunt'));
        const target = taunts[0] || p1.field[0];

        if (target) {
          const hasReaction = triggerHoldReactionWindow({
            trigger: 'when_enemy_attacks',
            sourcePlayerIndex: currentPlayer,
            targetPlayerIndex: 0,
            sourceSpiritInstanceId: readyAttacker.instanceId,
            targetSpiritInstanceId: target.instanceId
          });

          if (!hasReaction) {
            executeAttackDamage(readyAttacker, target, currentPlayer);
            setPlayers(prev => {
              const copy = [...prev];
              copy[currentPlayer].hasAttackedThisTurn = true;
              copy[currentPlayer].field = copy[currentPlayer].field.map(unit => {
                if (unit.instanceId === readyAttacker.instanceId) {
                  return { ...unit, canAttackThisTurn: false };
                }

                return unit;
              });
              return copy;
            });
          }
        } else {
          const hasReaction = triggerHoldReactionWindow({
            trigger: 'when_jar_damaged',
            sourcePlayerIndex: currentPlayer,
            targetPlayerIndex: 0,
            sourceSpiritInstanceId: readyAttacker.instanceId,
            incomingDamage: readyAttacker.atk
          });

          if (!hasReaction) {
            sounds.playAttack();
            addLog(`💥 ${BASE_CARDS[readyAttacker.cardId].name} attacks your Jar directly for ${readyAttacker.atk} damage!`, 'attack');
            setPlayers(prev => {
              const copy = [...prev];
              copy[0].jarHp -= readyAttacker.atk;
              copy[currentPlayer].hasAttackedThisTurn = true;
              copy[currentPlayer].field = copy[currentPlayer].field.map(unit => {
                if (unit.instanceId === readyAttacker.instanceId) {
                  return { ...unit, canAttackThisTurn: false };
                }

                return unit;
              });
              return copy;
            });
          }
        }

        return;
      }

      if (phase === 'react') {
        handleEndTurn();
      }
    }, 800);

    return () => clearTimeout(timer);
  });

  // AI Reaction Bot Automation
  useEffect(() => {
    if (!reactionContext) return;
    const reactingPlayer = players[reactionContext.targetPlayerIndex];
    if (!reactingPlayer.isBot) return;

    const timer = setTimeout(() => {
      const usableHolds = reactingPlayer.hand.filter(c => {
        const def = BASE_CARDS[c.cardId];
        return def && def.hasHold && def.holdTrigger === reactionContext.trigger;
      });

      if (usableHolds.length > 0) {
        playHoldCard(usableHolds[0]);
      } else {
        passReaction();
      }
    }, 1000);

    return () => clearTimeout(timer);
  });

  const activePlayer = players[currentPlayer];
  const humanPlayer = players[0];
  const computerPlayer = players[1];
  const isHumanTurn = currentPlayer === 0;
  const humanCanAct = isHumanTurn && !winner;

  // Helper to determine if a card in Player 1's hand is usable in a reaction window.
  const isCardUsableReaction = (c: CardInstance) => {
    if (!reactionContext) return false;
    if (reactionContext.targetPlayerIndex !== 0) return false;
    const def = BASE_CARDS[c.cardId];
    return def && def.hasHold && def.holdTrigger === reactionContext.trigger;
  };

  return (
    <div className="flex flex-col h-[768px] w-full max-w-[1024px] mx-auto bg-[#0f172a] text-slate-100 font-sans overflow-hidden border-8 border-[#1e293b] rounded-2xl shadow-2xl relative select-none">
      {/* Game Over Modal Overlay */}
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

      {/* Opponent Top Bar */}
      <div className="flex justify-between items-center p-4 bg-[#1e1b4b] border-b border-cyan-500/30 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-indigo-500 flex items-center justify-center border-2 border-slate-300 font-black text-xl text-white shadow">
            P{computerPlayer.id}
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-slate-400">
              Opponent (AI Bot)
            </div>
            <div className="text-xl font-bold text-cyan-400">{computerPlayer.name}</div>
          </div>
        </div>

        <div className="flex gap-8">
          <div className="flex flex-col items-center">
            <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Jar HP</div>
            <div className="text-3xl font-black text-rose-500 font-mono">
              {computerPlayer.jarHp < 10 ? `0${computerPlayer.jarHp}` : computerPlayer.jarHp} <span className="text-lg opacity-50">/ 12</span>
            </div>
          </div>
          <div className="flex flex-col items-center">
            <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Psy</div>
            <div className="text-3xl font-black text-cyan-400 font-mono">
              {computerPlayer.currentPsy < 10 ? `0${computerPlayer.currentPsy}` : computerPlayer.currentPsy} <span className="text-lg opacity-50">/ {computerPlayer.maxPsy}</span>
            </div>
          </div>
        </div>

        {/* Opponent Hand Card Backs */}
        <div className="flex gap-1.5 items-center">
          {computerPlayer.hand.map((_, idx) => (
            <div
              key={idx}
              className="w-8 h-12 bg-[#312e81] rounded border border-cyan-800 shadow-md flex items-center justify-center text-[10px] opacity-90"
            >
              🏺
            </div>
          ))}
          {computerPlayer.hand.length === 0 && <span className="text-xs text-slate-500 italic">0 cards</span>}
        </div>
      </div>

      {/* Main Game Field */}
      <div className="relative flex-1 grid grid-cols-[1fr_260px] p-4 gap-4 overflow-hidden">
        {/* Battlefield Canvas */}
        <div className="flex flex-col justify-between overflow-y-auto pr-1">
          {/* Opponent Slots (Row 1) */}
          <div className="flex justify-center gap-6 items-center">
            {[0, 1, 2].map(slotIdx => {
              const unit = computerPlayer.field[slotIdx];
              const isTauntReq = humanCanAct && phase === 'attack' && selectedAttackerId && computerPlayer.field.some(u => u.keywords.includes('taunt'));
              const canBeTargeted = humanCanAct && phase === 'attack' && selectedAttackerId && (!isTauntReq || unit?.keywords.includes('taunt'));

              return (
                <FieldUnitView
                  key={`opp_slot_${slotIdx}`}
                  slotIndex={slotIdx}
                  spirit={unit}
                  isEmpty={!unit}
                  isTargetable={!!canBeTargeted && !!unit}
                  onClick={() => canBeTargeted && handleTargetClick(unit)}
                />
              );
            })}
          </div>

          {/* Shared Deck & Discard Center Rail */}
          <div className="flex justify-center items-center gap-12 py-3 my-auto">
            {/* Direct Jar Attack Target area */}
            {humanCanAct && phase === 'attack' && selectedAttackerId && computerPlayer.field.length === 0 && (
              <div
                onClick={() => handleTargetClick(undefined, true)}
                className="absolute left-1/3 -translate-x-1/2 px-6 py-3 bg-rose-600 hover:bg-rose-500 border-2 border-white rounded-xl shadow-[0_0_30px_rgba(244,63,94,0.9)] text-white font-black uppercase text-sm tracking-widest animate-bounce cursor-pointer z-30"
              >
                ⚔️ ATTACK ENEMY JAR DIRECTLY
              </div>
            )}

            <div className="text-center group">
              <div className="w-24 h-32 bg-[#312e81] rounded-lg border-2 border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.5)] flex flex-col items-center justify-center relative transition-transform group-hover:scale-105">
                <div className="text-4xl">🏺</div>
                <div className="absolute -top-3 -right-3 w-7 h-7 rounded-full bg-cyan-500 flex items-center justify-center font-black text-xs text-slate-950 shadow">
                  {sharedDeck.length}
                </div>
              </div>
              <div className="text-[10px] uppercase mt-1.5 font-bold text-cyan-400 tracking-widest">
                Shared Jar
              </div>
            </div>

            <div className="text-center group">
              <div className="w-24 h-32 bg-slate-900 rounded-lg border-2 border-slate-700 flex flex-col items-center justify-center grayscale opacity-70 transition-opacity group-hover:opacity-100">
                <div className="text-3xl">💀</div>
                <div className="text-[10px] font-mono text-slate-400 mt-1">{discardPile.length}</div>
              </div>
              <div className="text-[10px] uppercase mt-1.5 font-bold text-slate-500 tracking-widest">
                Discard
              </div>
            </div>
          </div>

          {/* Player Slots (Row 3) */}
          <div className="flex justify-center gap-6 items-center">
            {[0, 1, 2].map(slotIdx => {
              const unit = humanPlayer.field[slotIdx];
              const isEligibleAttacker = humanCanAct && phase === 'attack' && unit?.canAttackThisTurn && !humanPlayer.hasAttackedThisTurn;

              return (
                <FieldUnitView
                  key={`player_slot_${slotIdx}`}
                  slotIndex={slotIdx}
                  spirit={unit}
                  isEmpty={!unit}
                  canAttack={!!isEligibleAttacker && !selectedAttackerId}
                  isSelectedForAttack={selectedAttackerId === unit?.instanceId}
                  onClick={() => {
                    if (isEligibleAttacker) {
                      sounds.playCardDraw();
                      setSelectedAttackerId(selectedAttackerId === unit.instanceId ? null : unit.instanceId);
                    }
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Sidebar Log & Actions */}
        <div className="flex flex-col gap-4 bg-[#020617] border-l border-slate-800 p-4 rounded-xl overflow-hidden">
          <div className="flex-1 flex flex-col overflow-hidden">
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

          {/* Reaction Prompts or Action Buttons */}
          <div className="space-y-2 shrink-0 pt-2 border-t border-slate-800">
            <div className="text-center py-1.5 text-[10px] bg-cyan-900/40 border border-cyan-800/60 text-cyan-300 font-bold uppercase rounded tracking-widest">
              Phase: <span className="text-white">{reactionContext ? '⚠️ REACTION' : phase.toUpperCase()}</span>
            </div>

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
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer'
                  }`}
                >
                  1. MANIFEST (MAIN)
                </button>

                <button
                  onClick={() => {
                    sounds.playCardDraw();
                    setPhase('attack');
                  }}
                  disabled={phase === 'attack' || !humanCanAct || humanPlayer.field.filter(u => u.canAttackThisTurn).length === 0}
                  className={`w-full py-3 font-bold text-xs rounded-xl transition-all uppercase tracking-wider ${
                    phase === 'attack'
                      ? 'bg-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.4)] cursor-default'
                      : humanPlayer.field.filter(u => u.canAttackThisTurn).length === 0
                      ? 'bg-slate-900 text-slate-600 cursor-not-allowed'
                      : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg cursor-pointer'
                  }`}
                >
                  2. ATTACK PHASE
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
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer'
                  }`}
                >
                  3. REACT PHASE
                </button>

                <button
                  onClick={handleEndTurn}
                  disabled={!humanCanAct}
                  className="w-full py-3.5 bg-indigo-800 hover:bg-indigo-700 text-white font-black text-xs tracking-widest uppercase rounded-xl shadow-lg transition-all cursor-pointer border border-indigo-600"
                >
                  {isHumanTurn ? 'END TURN ➔' : 'AI THINKING…'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Player Hand Bottom Area */}
      <div className="h-64 bg-[#1e1b4b] border-t-2 border-cyan-500 p-4 flex gap-4 items-end shrink-0">
        <div className="flex-1 flex justify-center gap-3 -mb-8 overflow-x-auto pt-4 px-2">
          {humanPlayer.hand.length === 0 ? (
            <div className="text-slate-500 italic text-xs self-center pb-8">
              No cards in hand. Draw on next turn.
            </div>
          ) : (
            humanPlayer.hand.map(cardInst => {
              const def = BASE_CARDS[cardInst.cardId];
              if (!def) return null;

              const isReactionWindow = !!reactionContext && reactionContext.targetPlayerIndex === 0;
              const usableInReaction = isCardUsableReaction(cardInst);
              const canPlayManifest = humanCanAct && phase === 'main' && !reactionContext && humanPlayer.currentPsy >= def.cost && humanPlayer.field.length < 3 && !humanPlayer.hasManifestedThisTurn;

              let disabledReason: string | undefined;
              if (phase !== 'main' && !isReactionWindow) disabledReason = 'Can only Manifest during Main phase';
              else if (humanPlayer.field.length >= 3) disabledReason = 'Field full (3/3 slots)';
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
                  }}
                  onHoldClick={() => usableInReaction && playHoldCard(cardInst)}
                  disabledReason={(!canPlayManifest && !usableInReaction) ? disabledReason : undefined}
                />
              );
            })
          )}
        </div>

        {/* Player Controls Rail */}
        <div className="flex flex-col items-center justify-center p-4 bg-indigo-950/80 rounded-xl border border-cyan-500/30 ml-auto w-44 shadow-lg shrink-0 mb-4">
          <div className="flex gap-4 mb-2">
            <div className="text-center font-mono">
              <div className="text-[9px] uppercase tracking-wider text-slate-400">Jar HP</div>
              <div className="text-2xl font-black text-rose-400">
                {humanPlayer.jarHp < 10 ? `0${humanPlayer.jarHp}` : humanPlayer.jarHp} <span className="text-xs opacity-40">/ 12</span>
              </div>
            </div>
            <div className="text-center font-mono">
              <div className="text-[9px] uppercase tracking-wider text-slate-400">Psy</div>
              <div className="text-2xl font-black text-cyan-400">
                {humanPlayer.currentPsy < 10 ? `0${humanPlayer.currentPsy}` : humanPlayer.currentPsy} <span className="text-xs opacity-40">/ {humanPlayer.maxPsy}</span>
              </div>
            </div>
          </div>

          {/* Psy Mana Bar */}
          <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
            <div
              className="bg-gradient-to-r from-cyan-500 to-teal-400 h-full transition-all duration-300"
              style={{ width: `${(humanPlayer.currentPsy / Math.max(1, humanPlayer.maxPsy)) * 100}%` }}
            />
          </div>

          <div className="mt-2 text-[9px] uppercase tracking-widest text-cyan-300 font-bold text-center">
            {humanPlayer.name}
          </div>
        </div>
      </div>
    </div>
  );
}
