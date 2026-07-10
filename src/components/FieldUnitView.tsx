import { FieldSpirit } from '../types';
import { BASE_CARDS } from '../data/cards';
import { GhostIcon } from './GhostIcon';
import { KeywordChip } from './KeywordChip';
import { CardRulesText } from './CardView';

interface FieldUnitViewProps {
  key?: string | number;
  spirit?: FieldSpirit;
  isEmpty?: boolean;
  canAttack?: boolean;
  isTargetable?: boolean;
  isSelectedForAttack?: boolean;
  onClick?: () => void;
  className?: string;
  slotIndex?: number;
  ownershipLabel?: string;
}

export function FieldUnitView({
  spirit,
  isEmpty = false,
  canAttack = false,
  isTargetable = false,
  isSelectedForAttack = false,
  onClick,
  className = '',
  slotIndex,
  ownershipLabel
}: FieldUnitViewProps) {
  if (isEmpty || !spirit) {
    return (
      <div
        onClick={onClick}
        className={`w-52 h-72 border-2 border-dashed border-indigo-900/50 rounded-xl bg-indigo-950/20 flex flex-col items-center justify-center select-none transition-all ${
          onClick ? 'hover:border-cyan-500/50 hover:bg-indigo-950/40 cursor-pointer' : ''
        } ${className}`}
      >
        <span className="text-indigo-800/80 text-xs font-bold tracking-widest uppercase">
          Slot {slotIndex !== undefined ? slotIndex + 1 : ''}
        </span>
        <span className="text-indigo-900/60 text-[10px] font-bold mt-1">EMPTY</span>
      </div>
    );
  }

  const cardDef = BASE_CARDS[spirit.cardId];
  if (!cardDef) return null;

  const hasTaunt = spirit.keywords.includes('taunt');
  const hasBurn = spirit.burn > 0;
  const isToken = spirit.keywords.includes('token');

  return (
    <div
      onClick={onClick}
      className={`w-52 h-72 border-2 bg-[#1e1b4b] rounded-xl relative overflow-visible select-none transition-all flex flex-col justify-between group/unit ${
        isSelectedForAttack
          ? 'border-cyan-300 ring-4 ring-cyan-400 shadow-[0_0_25px_rgba(34,211,238,0.8)] scale-105 cursor-pointer z-10'
          : isTargetable
          ? 'border-rose-500 ring-4 ring-rose-400 shadow-[0_0_25px_rgba(244,63,94,0.6)] cursor-pointer hover:scale-105 animate-pulse'
          : canAttack
          ? 'border-cyan-400 hover:border-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.4)] cursor-pointer hover:-translate-y-2'
          : 'border-cyan-800/80 opacity-90'
      } ${className}`}
    >
      {/* Top Badges */}
      <div className="absolute top-2 left-2 right-2 flex justify-between items-start z-10 pointer-events-none">
        <div className="flex flex-col gap-1 items-start">
          {ownershipLabel && (
            <span className={`px-1.5 py-0.5 rounded text-[8px] font-black shadow border ${ownershipLabel.includes('BORROWED') ? 'bg-fuchsia-900/80 border-fuchsia-400 text-fuchsia-100' : ownershipLabel.includes('ENEMY') ? 'bg-rose-900/80 border-rose-400 text-rose-100' : 'bg-cyan-900/80 border-cyan-400 text-cyan-100'}`}>
              {ownershipLabel}
            </span>
          )}
          {hasTaunt && (
            <span className="px-1.5 py-0.5 bg-cyan-600 rounded text-[9px] font-black text-white shadow">
              TAUNT
            </span>
          )}
          {spirit.scared && (
            <span className="px-1.5 py-0.5 bg-purple-900/80 border border-purple-400 rounded text-[8px] font-black text-purple-100">
              SCARED
            </span>
          )}
          {spirit.developed && !isToken && (
            <span className="px-1.5 py-0.5 bg-violet-900/80 border border-violet-400 rounded text-[8px] font-black text-violet-100">
              DEVELOPED
            </span>
          )}
          {isToken && (
            <span className="px-1.5 py-0.5 bg-teal-800/80 border border-teal-500 rounded text-[8px] font-bold text-teal-200">
              TOKEN
            </span>
          )}
        </div>
        {hasBurn && (
          <span className="px-1.5 py-0.5 bg-rose-600 rounded text-[9px] font-black text-white shadow animate-bounce">
            🔥 BURN {spirit.burn}
          </span>
        )}
      </div>

      {/* Ghost Icon Center */}
      <div className="mt-7 flex flex-col items-center justify-center flex-1 relative px-2">
        <div className={`absolute inset-0 bg-gradient-to-t ${cardDef.themeColor} opacity-20`} />
        <GhostIcon artKey={cardDef.artKey} className="w-20 h-20 transition-transform hover:scale-110 z-10" />
        <div className="mt-1 text-center font-bold text-sm uppercase tracking-tight text-slate-100 line-clamp-1 z-10">
          {cardDef.name}
        </div>
        
        {/* Keyword chips row */}
        {spirit.keywords.length > 0 && (
          <div className="flex flex-wrap gap-0.5 justify-center mt-1 z-10">
            {spirit.keywords.filter(k => k !== 'taunt' && k !== 'token').map(kw => (
              <KeywordChip key={kw} keyword={kw} size="sm" />
            ))}
          </div>
        )}
      </div>

      {/* Can Attack Notification Prompt */}
      {canAttack && !isSelectedForAttack && (
        <div className="bg-cyan-500/20 text-cyan-300 text-[8px] font-black text-center py-0.5 tracking-widest uppercase border-t border-cyan-500/40 animate-pulse">
          READY TO ATTACK
        </div>
      )}
      {isSelectedForAttack && (
        <div className="bg-cyan-400 text-slate-950 text-[9px] font-black text-center py-0.5 tracking-widest uppercase">
          ATTACKING...
        </div>
      )}

      {/* Stats Footer Grid */}
      <div className="w-full grid grid-cols-2 bg-indigo-950/90 text-center py-1.5 border-t border-cyan-500/30 font-mono">
        <div>
          <div className="text-[7.5px] text-slate-400 uppercase tracking-wider">HP</div>
          <div className={`font-bold text-sm ${spirit.currentHp < spirit.maxHp ? 'text-rose-400' : 'text-emerald-400'}`}>
            {spirit.currentHp < 10 ? `0${spirit.currentHp}` : spirit.currentHp}
          </div>
        </div>
        <div>
          <div className="text-[7.5px] text-slate-400 uppercase tracking-wider">ATK</div>
          <div className="font-bold text-sm text-orange-400">
            {spirit.atk < 10 ? `0${spirit.atk}` : spirit.atk}
          </div>
        </div>
      </div>

      {/* Field hover helper */}
      <div className="pointer-events-none absolute left-1/2 bottom-full z-[70] mb-2 w-56 -translate-x-1/2 rounded-xl border border-cyan-500/60 bg-slate-950/95 p-3 text-left shadow-2xl opacity-0 scale-95 transition-all group-hover/unit:opacity-100 group-hover/unit:scale-100">
        <div className="mb-1 font-black uppercase tracking-tight text-cyan-300">{cardDef.name}</div>
        <div className="mb-2 text-[10px] text-slate-400">
          Current: {spirit.currentHp}/{spirit.maxHp} HP • {spirit.atk} ATK{spirit.developed ? ' • DEVELOPED' : ''}{spirit.scared ? ' • SCARED' : ''}{ownershipLabel ? ` • ${ownershipLabel}` : ''}
        </div>
        <div className="text-[10px] leading-tight text-slate-200">
          <CardRulesText card={cardDef} compact />
        </div>
      </div>
    </div>
  );
}
