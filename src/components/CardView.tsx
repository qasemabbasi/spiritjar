import { CardDefinition } from '../types';
import { GhostIcon } from './GhostIcon';
import { KeywordChip } from './KeywordChip';

interface CardViewProps {
  key?: string | number;
  card: CardDefinition;
  isHoldReady?: boolean;
  canManifest?: boolean;
  onClick?: () => void;
  onHoldClick?: () => void;
  disabledReason?: string;
  className?: string;
  showBadge?: string;
  compact?: boolean;
}

export function CardRulesText({ card, compact = false }: { card: CardDefinition; compact?: boolean }) {
  const rowClass = compact ? 'text-[10px]' : 'text-[8.5px]';
  const hasCoreRules = Boolean(card.manifestText || card.holdText || card.attackText || card.defenseText || card.defeatText);
  const hasClaimRules = Boolean(card.boundText || card.borrowedText);
  const hasDevelopedRules = Boolean(card.developedText);

  if (!hasCoreRules && !hasClaimRules && !hasDevelopedRules) {
    return <div className="text-slate-400">No special rules.</div>;
  }

  return (
    <div className={`${rowClass} leading-tight space-y-1.5 text-slate-200`}>
      {card.manifestText && (
        <div>
          <span className="font-bold text-cyan-400">MANIFEST EFFECT:</span> {card.manifestText}
        </div>
      )}
      {card.hasHold && card.holdText && (
        <div>
          <span className="font-bold text-amber-400">HOLD EFFECT:</span> {card.holdText}
        </div>
      )}
      {card.attackText && (
        <div>
          <span className="font-bold text-rose-400">ATTACK EFFECT:</span> {card.attackText}
        </div>
      )}
      {card.defenseText && (
        <div>
          <span className="font-bold text-indigo-300">DEFENSE EFFECT:</span> {card.defenseText}
        </div>
      )}
      {card.defeatText && (
        <div>
          <span className="font-bold text-slate-400">DEFEAT EFFECT:</span> {card.defeatText}
        </div>
      )}

      {hasClaimRules && <div className="my-1 border-t border-slate-700/70" />}
      {card.boundText && (
        <div>
          <span className="font-bold text-cyan-300">BOUND:</span> {card.boundText}
        </div>
      )}
      {card.borrowedText && (
        <div>
          <span className="font-bold text-fuchsia-300">BORROWED:</span> {card.borrowedText}
        </div>
      )}

      {hasDevelopedRules && <div className="my-1 border-t border-slate-700/70" />}
      {card.developedText && (
        <div>
          <span className="font-bold text-violet-300">DEVELOPED:</span> {card.developedText}
        </div>
      )}
    </div>
  );
}

export function CardView({
  card,
  isHoldReady = false,
  canManifest = false,
  onClick,
  onHoldClick,
  disabledReason,
  className = '',
  showBadge,
  compact = false
}: CardViewProps) {
  const cardWidthHeight = compact ? 'w-28 h-36 text-[9px]' : 'w-56 h-80 text-sm';
  const titleText = disabledReason ? `${card.name} — ${disabledReason}` : card.name;

  return (
    <div className="relative group/card shrink-0 overflow-visible">
      <div
        onClick={canManifest || isHoldReady ? onClick : undefined}
        title={titleText}
        className={`${cardWidthHeight} bg-[#2e1065] border-2 ${
          isHoldReady
            ? 'border-4 border-cyan-400 shadow-[0_0_40px_rgba(34,211,238,0.6)] ring-2 ring-cyan-500 ring-offset-2 ring-offset-indigo-900 animate-pulse cursor-pointer'
            : canManifest
            ? 'border-cyan-400 hover:border-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:-translate-y-3 cursor-pointer'
            : 'border-slate-700 opacity-80 cursor-not-allowed hover:opacity-100'
        } rounded-xl relative shadow-2xl transition-all flex flex-col select-none ${className}`}
      >
        {/* Cost Badge */}
        <div className={`${compact ? 'top-1.5 left-1.5 w-6 h-6 text-[10px]' : 'top-2 left-2 w-7 h-7 text-xs'} absolute rounded-full bg-cyan-500 flex items-center justify-center font-bold text-slate-950 shadow-md z-10`}>
          {card.cost}
        </div>

        {/* HOLD READY or Custom Badge */}
        {isHoldReady && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-cyan-500 rounded-full text-[9px] font-black tracking-widest text-slate-950 shadow-lg z-20 animate-bounce">
            HOLD READY
          </div>
        )}
        {showBadge && !isHoldReady && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-indigo-600 border border-indigo-400 rounded-full text-[8px] font-bold tracking-wider text-white shadow-md z-20">
            {showBadge}
          </div>
        )}

        {/* Card Content */}
        <div className={`${compact ? 'p-1.5 pt-2' : 'p-3 pt-4'} flex flex-col h-full justify-between`}>
          {/* Title */}
          <div className={`${compact ? 'text-[10px] pl-6 pr-0' : 'pl-6 pr-1'} font-bold text-center uppercase tracking-tighter text-slate-100 truncate`}>
            {card.name}
          </div>

          {/* Ghost Art Area */}
          <div className={`${compact ? 'h-12' : 'h-28'} my-1 bg-indigo-950/80 rounded-lg flex items-center justify-center relative overflow-hidden border border-indigo-800/50`}>
            <div className={`absolute inset-0 bg-gradient-to-br ${card.themeColor} opacity-40`} />
            <GhostIcon artKey={card.artKey} className={`${compact ? 'w-11 h-11' : 'w-20 h-20'} z-10 transition-transform group-hover/card:scale-110`} />
          </div>

          {/* Keywords Row */}
          {card.keywords.length > 0 && (
            <div className={`${compact ? 'scale-90 -my-0.5' : 'my-0.5 min-h-[18px]'} flex flex-wrap gap-1 justify-center`}>
              {card.keywords.map(kw => (
                <KeywordChip key={kw} keyword={kw} size="sm" />
              ))}
            </div>
          )}

          {/* Stats Row */}
          <div className={`${compact ? 'my-0.5 py-0.5' : 'my-1 py-1'} grid grid-cols-2 text-center bg-black/40 rounded border border-slate-800 font-mono`}>
            <div>
              <div className="text-[11px] font-bold text-emerald-400">{card.hp}</div>
              <div className="text-[7px] text-slate-400 uppercase tracking-wider">HP</div>
            </div>
            <div>
              <div className="text-[11px] font-bold text-orange-400">{card.atk}</div>
              <div className="text-[7px] text-slate-400 uppercase tracking-wider">ATK</div>
            </div>
          </div>

          {/* Text Area */}
          {compact ? (
            <div className="text-[7.5px] leading-tight bg-indigo-950/60 px-1.5 py-1 rounded border border-indigo-900/40 text-slate-400 h-5 overflow-hidden text-center">
              Hover details
            </div>
          ) : (
            <div className="text-[8.5px] leading-tight bg-indigo-950/60 p-1.5 rounded flex-1 overflow-y-auto border border-indigo-900/40 text-slate-200">
              <div
                onClick={e => {
                  if (isHoldReady && onHoldClick) {
                    e.stopPropagation();
                    onHoldClick();
                  }
                }}
                className={isHoldReady ? 'rounded bg-cyan-500/10 p-1 ring-1 ring-cyan-400/50' : ''}
              >
                <CardRulesText card={card} />
              </div>
            </div>
          )}
        </div>

        {/* Disabled Reason Overlay on Hover */}
        {disabledReason && !canManifest && !isHoldReady && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-[1px] rounded-xl p-3 flex flex-col items-center justify-center text-center opacity-0 hover:opacity-100 transition-opacity z-30">
            <span className="text-xs font-bold text-rose-400 mb-1">Cannot Play</span>
            <span className="text-[9px] text-slate-300">{disabledReason}</span>
          </div>
        )}
      </div>

    </div>
  );
}
