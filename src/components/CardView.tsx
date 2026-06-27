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

function CardRulesText({ card, compact = false }: { card: CardDefinition; compact?: boolean }) {
  return (
    <div className={`${compact ? 'text-[10px]' : 'text-[8.5px]'} leading-tight space-y-1.5 text-slate-200`}>
      {card.manifestText && (
        <div>
          <span className="font-bold text-cyan-400">MANIFEST:</span> {card.manifestText}
        </div>
      )}
      {card.fieldText && (
        <div>
          <span className="font-bold text-indigo-300">FIELD:</span> {card.fieldText}
        </div>
      )}
      {card.attackText && (
        <div>
          <span className="font-bold text-rose-400">ATTACK:</span> {card.attackText}
        </div>
      )}
      {card.defeatText && (
        <div>
          <span className="font-bold text-slate-400">DEFEAT:</span> {card.defeatText}
        </div>
      )}
      {card.hasHold && (
        <div>
          <span className="font-bold text-amber-400">HOLD:</span> {card.holdText}
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
  const cardWidthHeight = compact ? 'w-36 h-44 text-[10px]' : 'w-56 h-80 text-sm';
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
        <div className="absolute top-2 left-2 w-7 h-7 rounded-full bg-cyan-500 flex items-center justify-center font-bold text-xs text-slate-950 shadow-md z-10">
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
        <div className={`${compact ? 'p-2 pt-3' : 'p-3 pt-4'} flex flex-col h-full justify-between`}>
          {/* Title */}
          <div className="font-bold text-center uppercase tracking-tighter text-slate-100 truncate pl-6 pr-1">
            {card.name}
          </div>

          {/* Ghost Art Area */}
          <div className={`${compact ? 'h-20' : 'h-28'} my-1 bg-indigo-950/80 rounded-lg flex items-center justify-center relative overflow-hidden border border-indigo-800/50`}>
            <div className={`absolute inset-0 bg-gradient-to-br ${card.themeColor} opacity-40`} />
            <GhostIcon artKey={card.artKey} className={`${compact ? 'w-16 h-16' : 'w-20 h-20'} z-10 transition-transform group-hover/card:scale-110`} />
          </div>

          {/* Keywords Row */}
          {card.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1 justify-center my-0.5 min-h-[18px]">
              {card.keywords.map(kw => (
                <KeywordChip key={kw} keyword={kw} size="sm" />
              ))}
            </div>
          )}

          {/* Stats Row */}
          <div className="grid grid-cols-3 text-center my-1 bg-black/40 rounded py-1 border border-slate-800 font-mono">
            <div>
              <div className="text-[11px] font-bold text-emerald-400">{card.hp}</div>
              <div className="text-[7px] text-slate-400 uppercase tracking-wider">HP</div>
            </div>
            <div>
              <div className="text-[11px] font-bold text-orange-400">{card.atk}</div>
              <div className="text-[7px] text-slate-400 uppercase tracking-wider">ATK</div>
            </div>
            <div>
              <div className="text-[11px] font-bold text-blue-400">{card.def}</div>
              <div className="text-[7px] text-slate-400 uppercase tracking-wider">DEF</div>
            </div>
          </div>

          {/* Text Area */}
          {compact ? (
            <div className="text-[8px] leading-tight bg-indigo-950/60 p-1.5 rounded border border-indigo-900/40 text-slate-300 h-8 overflow-hidden">
              Hover for full rules
            </div>
          ) : (
            <div className="text-[8.5px] leading-tight bg-indigo-950/60 p-1.5 rounded flex-1 overflow-y-auto border border-indigo-900/40 text-slate-200">
              <CardRulesText card={card} />
              {card.hasHold && (
                <div
                  onClick={e => {
                    if (isHoldReady && onHoldClick) {
                      e.stopPropagation();
                      onHoldClick();
                    }
                  }}
                  className={`mt-1 p-1 rounded ${
                    isHoldReady ? 'bg-cyan-500/20 border border-cyan-400/60 text-cyan-200 font-semibold' : 'opacity-80'
                  }`}
                >
                  <span className="font-bold text-amber-400">HOLD:</span> {card.holdText}
                </div>
              )}
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

      {/* Full hover rules preview for compact hand cards */}
      {compact && (
        <div className="pointer-events-none absolute left-1/2 bottom-full z-[80] mb-3 w-64 -translate-x-1/2 rounded-xl border-2 border-cyan-500/70 bg-slate-950/95 p-3 text-left shadow-[0_0_35px_rgba(34,211,238,0.35)] opacity-0 scale-95 transition-all duration-150 group-hover/card:opacity-100 group-hover/card:scale-100">
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2 mb-2">
            <div className="font-black uppercase tracking-tight text-cyan-300">{card.name}</div>
            <div className="rounded-full bg-cyan-500 px-2 py-0.5 text-xs font-black text-slate-950">{card.cost} Psy</div>
          </div>
          <div className="mb-2 grid grid-cols-3 rounded bg-indigo-950/70 py-1 text-center font-mono text-xs">
            <div><span className="text-emerald-400 font-bold">{card.hp}</span><span className="ml-1 text-slate-500">HP</span></div>
            <div><span className="text-orange-400 font-bold">{card.atk}</span><span className="ml-1 text-slate-500">ATK</span></div>
            <div><span className="text-blue-400 font-bold">{card.def}</span><span className="ml-1 text-slate-500">DEF</span></div>
          </div>
          <CardRulesText card={card} compact />
          {disabledReason && <div className="mt-2 rounded bg-rose-950/60 p-2 text-[10px] font-bold text-rose-300">{disabledReason}</div>}
        </div>
      )}
    </div>
  );
}
