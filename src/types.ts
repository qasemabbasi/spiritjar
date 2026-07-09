export type Keyword = 
  | 'taunt' 
  | 'burn' 
  | 'splash' 
  | 'lure' 
  | 'regen' 
  | 'cat' 
  | 'bite'
  | 'spear'
  | 'rush' 
  | 'token'
  | 'boom'
  | 'strike'
  | 'ritual'
  | 'fog'
  | 'possess'
  | 'oath'
  | 'caller';

export type HoldTrigger = 
  | 'when_attacked' 
  | 'when_leader_damaged' 
  | 'when_enemy_summons' 
  | 'when_enemy_summons_token' 
  | 'when_spirit_defeated' 
  | 'when_targeted' 
  | 'when_enemy_attacks' 
  | 'before_damage' 
  | 'after_damage'
  | 'react_phase'
  | 'when_friendly_attacks';

export interface CardDefinition {
  id: string;
  name: string;
  cost: number;
  hp: number;
  atk: number;
  keywords: Keyword[];
  manifestText: string;
  fieldText: string;
  attackText: string;
  defeatText: string;
  holdText: string;
  holdTrigger?: HoldTrigger;
  hasHold: boolean;
  token: boolean;
  role?: string;
  artKey: string;
  themeColor: string;
}

export interface CardInstance {
  instanceId: string;
  cardId: string;
  originalOwner: number; // 0 or 1
}

export interface FieldSpirit {
  instanceId: string;
  cardId: string;
  currentHp: number;
  maxHp: number;
  atk: number;
  keywords: Keyword[];
  canAttackThisTurn: boolean;
  summonedTurn: number;
  burn: number; // 0 if none, 1 if Burn 1
  originalOwner: number;
  swordBuffedThisTurn?: boolean;
}

export type TurnPhase = 'start' | 'draw' | 'main' | 'attack' | 'react' | 'end';

export interface PlayerState {
  id: number;
  name: string;
  isBot: boolean;
  leaderHp: number;
  maxPsy: number;
  currentPsy: number;
  hand: CardInstance[];
  field: FieldSpirit[];
  selectedCardIds: string[];
  hasManifestedThisTurn: boolean;
  hasAttackedThisTurn: boolean;
  bonusPsyNextTurn: number;
}

export type GameScreen = 'setup' | 'battle' | 'gameover';

export interface GameLogEntry {
  id: string;
  text: string;
  type: 'turn' | 'manifest' | 'attack' | 'hold' | 'effect' | 'defeat' | 'win' | 'system';
  timestamp: string;
}

export interface ReactionContext {
  trigger: HoldTrigger;
  sourcePlayerIndex: number; // Player initiating action
  targetPlayerIndex: number; // Player who can react
  sourceSpiritInstanceId?: string;
  targetSpiritInstanceId?: string;
  incomingDamage?: number;
  isTokenSummon?: boolean;
}
