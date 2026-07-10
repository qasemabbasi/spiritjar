import { useState } from 'react';
import { BASE_CARDS, COLLECTIBLE_CARD_IDS, DECK_SIZE, getStandardPlayerCollection, getDefaultSelectedDeck, getDefaultOpponentDeck } from '../data/cards';
import { CardDefinition } from '../types';
import { CardView } from './CardView';
import { sounds } from '../utils/audio';

interface SetupScreenProps {
  onComplete: (p1Selected: string[], p2Selected: string[], p2IsBot: boolean) => void;
}

function SetupCardDetail({ card }: { card: CardDefinition | null }) {
  if (!card) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs leading-relaxed text-slate-500 font-mono">
        Hover or focus a card to read its full rules before adding it to your deck.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-cyan-500/50 bg-slate-950/90 p-4 shadow-[0_0_24px_rgba(34,211,238,0.18)]">
      <div className="mb-2 flex items-start justify-between gap-3 border-b border-slate-800 pb-2">
        <div>
          <div className="text-lg font-black uppercase tracking-tight text-cyan-300">{card.name}</div>
          <div className="mt-1 text-[10px] font-mono uppercase tracking-widest text-slate-500">
            {card.keywords.length > 0 ? card.keywords.join(' • ') : 'No keyword'}
          </div>
        </div>
        <div className="rounded-full bg-cyan-500 px-3 py-1 text-sm font-black text-slate-950">{card.cost} Psy</div>
      </div>

      <div className="mb-3 grid grid-cols-2 rounded-xl border border-indigo-800/70 bg-indigo-950/70 py-2 text-center font-mono text-sm">
        <div><span className="font-black text-emerald-400">{card.hp}</span><span className="ml-1 text-slate-500">HP</span></div>
        <div><span className="font-black text-orange-400">{card.atk}</span><span className="ml-1 text-slate-500">ATK</span></div>
      </div>

      <div className="space-y-2 text-xs leading-snug text-slate-200">
        {card.role && <div><span className="font-black text-violet-300">ROLE:</span> {card.role}</div>}
        {card.manifestText && <div><span className="font-black text-cyan-400">MANIFEST:</span> {card.manifestText}</div>}
        {card.fieldText && <div><span className="font-black text-indigo-300">FIELD:</span> {card.fieldText}</div>}
        {card.attackText && <div><span className="font-black text-rose-400">ATTACK:</span> {card.attackText}</div>}
        {card.defeatText && <div><span className="font-black text-slate-400">DEFEAT:</span> {card.defeatText}</div>}
        {card.hasHold && <div><span className="font-black text-amber-400">HOLD:</span> {card.holdText}</div>}
        {card.boundText && <div><span className="font-black text-cyan-300">BOUND:</span> {card.boundText}</div>}
        {card.borrowedText && <div><span className="font-black text-fuchsia-300">BORROWED:</span> {card.borrowedText}</div>}
        {card.developedText && <div><span className="font-black text-violet-300">DEVELOPED:</span> {card.developedText}</div>}
        {!card.manifestText && !card.fieldText && !card.attackText && !card.defeatText && !card.hasHold && !card.role && !card.boundText && !card.borrowedText && !card.developedText && (
          <div className="text-slate-400">No special rules.</div>
        )}
      </div>
    </div>
  );
}

export function SetupScreen({ onComplete }: SetupScreenProps) {
  const [p1Collection] = useState<string[]>(() => getStandardPlayerCollection());
  const [p1Selected, setP1Selected] = useState<string[]>(() => getDefaultSelectedDeck());
  const [previewCardId, setPreviewCardId] = useState<string | null>(getDefaultSelectedDeck()[0] ?? null);

  const addCard = (cardId: string) => {
    sounds.playCardDraw();

    const maxAllowed = p1Collection.filter(id => id === cardId).length;
    const currentCount = p1Selected.filter(id => id === cardId).length;

    if (p1Selected.length < DECK_SIZE && currentCount < maxAllowed) {
      setP1Selected([...p1Selected, cardId]);
    }
  };

  const removeCard = (cardId: string) => {
    sounds.playCardDraw();

    const idx = p1Selected.lastIndexOf(cardId);
    if (idx !== -1) {
      const copy = [...p1Selected];
      copy.splice(idx, 1);
      setP1Selected(copy);
    }
  };

  const startBattle = (selectedDeck: string[]) => {
    sounds.playWin();
    onComplete(selectedDeck, getDefaultOpponentDeck(), true);
  };

  const uniqueCards = COLLECTIBLE_CARD_IDS.map(cardId => BASE_CARDS[cardId]).filter(Boolean);
  const previewCard = previewCardId ? BASE_CARDS[previewCardId] : null;

  return (
    <div className="flex flex-col min-h-[768px] w-full max-w-5xl mx-auto bg-[#0f172a] text-slate-100 font-sans border-8 border-[#1e293b] rounded-2xl shadow-2xl overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/30 via-slate-900/10 to-[#0f172a] pointer-events-none" />

      {/* Top Header */}
      <div className="flex justify-between items-center p-4 bg-[#1e1b4b] border-b border-cyan-500/30 relative z-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-cyan-500 flex items-center justify-center font-black text-xl text-slate-950">
            P1
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-slate-400">Single Player Setup</div>
            <div className="text-xl font-bold text-cyan-400">PLAYER 1 VS SPIRIT LORD AI</div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => startBattle(getDefaultSelectedDeck())}
            className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-cyan-400 font-black text-xs tracking-wider uppercase rounded-xl transition-all border border-slate-700"
          >
            ⚡ Quick Start
          </button>

          <div className="text-right">
            <span className="text-xs text-slate-400 uppercase tracking-widest block">Selected Ghosts</span>
            <span className={`text-3xl font-black ${p1Selected.length === DECK_SIZE ? 'text-cyan-400' : 'text-amber-400'}`}>
              {p1Selected.length < DECK_SIZE ? `0${p1Selected.length}` : p1Selected.length} <span className="text-lg opacity-50">/ {DECK_SIZE}</span>
            </span>
          </div>

          <button
            onClick={() => startBattle(p1Selected)}
            disabled={p1Selected.length !== DECK_SIZE}
            className={`px-6 py-3 rounded-xl font-black text-sm tracking-wider uppercase transition-all shadow-lg ${
              p1Selected.length === DECK_SIZE
                ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 cursor-pointer shadow-[0_0_20px_rgba(6,182,212,0.5)]'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            Start Battle ⚔️
          </button>
        </div>
      </div>

      {/* Main Selection Area */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_320px] p-4 sm:p-6 gap-5 overflow-hidden relative z-10">
        {/* Collection Grid */}
        <div className="flex flex-col overflow-hidden">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-3xl font-black tracking-tighter text-cyan-400">SPIRIT JAR</h1>
              <h2 className="text-xs uppercase tracking-widest font-bold text-slate-400">
                Pick {DECK_SIZE} ghosts. The AI brings its own {DECK_SIZE}-card deck, then both decks shuffle into one Draw Jar.
              </h2>
            </div>

            <button
              onClick={() => setP1Selected(getDefaultSelectedDeck())}
              className="text-xs text-cyan-400 hover:underline font-mono font-bold"
            >
              [Auto-Fill Recommended 12]
            </button>
          </div>

          <div className="mb-4 rounded-2xl border border-cyan-500/30 bg-slate-950/70 p-3 shadow-[0_0_24px_rgba(34,211,238,0.12)]">
            <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-cyan-400">Full card details</div>
            <div className="mb-3 rounded-xl border border-fuchsia-500/30 bg-fuchsia-950/20 p-3 text-[10px] leading-snug text-slate-300">
              <div className="mb-2 font-black uppercase tracking-widest text-fuchsia-200">Rules Glossary</div>
              <div><span className="font-black text-cyan-300">BOUND</span> = you brought that ghost into the match. You keep a claim on it even if the opponent controls it.</div>
              <div><span className="font-black text-fuchsia-300">BORROWED</span> = your opponent brought it, but you are using it. Borrowed power usually has a backlash or pays the binder.</div>
              <div><span className="font-black text-violet-300">DEVELOPED</span> = a ghost survived to its controller's next turn. Its bigger payoff is online.</div>
              <div><span className="font-black text-purple-200">SCARED</span> = this ghost cannot attack during its next attack phase, then recovers.</div>
              <div><span className="font-black text-indigo-200">POSSESS</span> = reclaim or steal control of a damaged ghost. Claim and control are different.</div>
              <div><span className="font-black text-orange-200">PIERCE / SPILL</span> = damage gets past a defender and still hits the Leader.</div>
            </div>
            <SetupCardDetail card={previewCard} />
          </div>

          <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 p-2 bg-slate-950/40 rounded-xl border border-slate-800/80">
            {uniqueCards.map(card => {
              const totalOwned = p1Collection.filter(id => id === card.id).length;
              const currentlyPicked = p1Selected.filter(id => id === card.id).length;
              const canPickMore = currentlyPicked < totalOwned && p1Selected.length < DECK_SIZE;

              return (
                <div key={card.id} className="relative group flex flex-col items-center" onMouseEnter={() => setPreviewCardId(card.id)} onFocus={() => setPreviewCardId(card.id)}>
                  <CardView
                    card={card}
                    compact
                    onClick={() => canPickMore && addCard(card.id)}
                    disabledReason={!canPickMore ? (p1Selected.length >= DECK_SIZE ? `Deck full (${DECK_SIZE}/${DECK_SIZE})` : 'Max owned copies picked') : undefined}
                  />
                  <div className="mt-2 flex items-center justify-between w-40 px-2 py-1 bg-indigo-950/80 rounded border border-indigo-800 text-xs font-mono">
                    <span className="text-slate-400">Picked:</span>
                    <span className="font-bold text-cyan-400">
                      {currentlyPicked} / {totalOwned}
                    </span>
                  </div>
                  {canPickMore && (
                    <button
                      onClick={() => addCard(card.id)}
                      className="absolute top-2 right-2 w-7 h-7 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-full shadow flex items-center justify-center text-sm opacity-0 group-hover:opacity-100 transition-opacity z-20"
                    >
                      +
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Deck Sidebar */}
        <div className="flex flex-col bg-[#020617] border border-slate-800 rounded-xl p-4 overflow-hidden">
          <h3 className="text-xs uppercase font-bold tracking-widest text-cyan-400 mb-3 border-b border-slate-800 pb-2">
            Your {DECK_SIZE}-Card Deck ({p1Selected.length}/{DECK_SIZE})
          </h3>

          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1 font-mono text-xs">
            {p1Selected.length === 0 ? (
              <div className="text-slate-600 text-center py-12 text-xs italic">
                Click cards on the left to add them to your deck.
              </div>
            ) : (
              p1Selected.map((cardId, idx) => {
                const card = BASE_CARDS[cardId];
                return (
                  <div
                    key={`${cardId}_${idx}`}
                    onClick={() => removeCard(cardId)}
                    className="flex items-center justify-between p-2 bg-indigo-950/40 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-500/50 rounded transition-colors group cursor-pointer"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-5 h-5 rounded bg-cyan-500/20 text-cyan-300 font-bold text-[10px] flex items-center justify-center">
                        {card?.cost}
                      </span>
                      <span className="truncate font-semibold text-slate-200 group-hover:text-rose-300">
                        {card?.name}
                      </span>
                    </div>
                    <span className="text-slate-600 group-hover:text-rose-400">✕</span>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-800 text-[10px] text-slate-500 leading-relaxed font-mono">
            <div>🤖 AI brings its own Spirit Lord deck.</div>
            <div>🏺 Your deck + AI deck shuffle into one Draw Jar.</div>
            <div>🤖 The Spirit Lord always plays from the top.</div>
            <div>🧠 You always play from the bottom.</div>
            <div>🔮 Psy refills each turn: turn 1 = 1/1, turn 2 = 2/2, turn 3 = 3/3.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
