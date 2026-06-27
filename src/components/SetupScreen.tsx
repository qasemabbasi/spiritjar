import { useState } from 'react';
import { BASE_CARDS, getStandardPlayerCollection, getDefaultSelectedDeck } from '../data/cards';
import { CardView } from './CardView';
import { sounds } from '../utils/audio';

interface SetupScreenProps {
  onComplete: (p1Selected: string[], p2Selected: string[], p2IsBot: boolean) => void;
}

export function SetupScreen({ onComplete }: SetupScreenProps) {
  const [p1Collection] = useState<string[]>(() => getStandardPlayerCollection());
  const [p1Selected, setP1Selected] = useState<string[]>(() => getDefaultSelectedDeck());

  const addCard = (cardId: string) => {
    sounds.playCardDraw();

    const maxAllowed = p1Collection.filter(id => id === cardId).length;
    const currentCount = p1Selected.filter(id => id === cardId).length;

    if (p1Selected.length < 10 && currentCount < maxAllowed) {
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
    onComplete(selectedDeck, selectedDeck, true);
  };

  const uniqueCards = Object.values(BASE_CARDS).filter(c => !c.token);

  return (
    <div className="flex flex-col min-h-[768px] w-full max-w-6xl mx-auto bg-[#0f172a] text-slate-100 font-sans border-8 border-[#1e293b] rounded-2xl shadow-2xl overflow-hidden relative">
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
            <span className={`text-3xl font-black ${p1Selected.length === 10 ? 'text-cyan-400' : 'text-amber-400'}`}>
              {p1Selected.length < 10 ? `0${p1Selected.length}` : p1Selected.length} <span className="text-lg opacity-50">/ 10</span>
            </span>
          </div>

          <button
            onClick={() => startBattle(p1Selected)}
            disabled={p1Selected.length !== 10}
            className={`px-6 py-3 rounded-xl font-black text-sm tracking-wider uppercase transition-all shadow-lg ${
              p1Selected.length === 10
                ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 cursor-pointer shadow-[0_0_20px_rgba(6,182,212,0.5)]'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            Start Battle ⚔️
          </button>
        </div>
      </div>

      {/* Main Selection Area */}
      <div className="flex-1 grid grid-cols-[1fr_300px] p-6 gap-6 overflow-hidden relative z-10">
        {/* Collection Grid */}
        <div className="flex flex-col overflow-hidden">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-3xl font-black tracking-tighter text-cyan-400">SPIRIT JAR</h1>
              <h2 className="text-xs uppercase tracking-widest font-bold text-slate-400">
                Pick 10 ghosts. The AI mirrors your exact 10-card deck, then both decks shuffle into one Draw Jar.
              </h2>
            </div>

            <button
              onClick={() => setP1Selected(getDefaultSelectedDeck())}
              className="text-xs text-cyan-400 hover:underline font-mono font-bold"
            >
              [Auto-Fill Recommended 10]
            </button>
          </div>

          <div className="flex-1 overflow-y-auto grid grid-cols-4 gap-4 p-2 bg-slate-950/40 rounded-xl border border-slate-800/80">
            {uniqueCards.map(card => {
              const totalOwned = p1Collection.filter(id => id === card.id).length;
              const currentlyPicked = p1Selected.filter(id => id === card.id).length;
              const canPickMore = currentlyPicked < totalOwned && p1Selected.length < 10;

              return (
                <div key={card.id} className="relative group flex flex-col items-center">
                  <CardView
                    card={card}
                    compact
                    onClick={() => canPickMore && addCard(card.id)}
                    disabledReason={!canPickMore ? (p1Selected.length >= 10 ? 'Deck full (10/10)' : 'Max owned copies picked') : undefined}
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
            Your Jar Selection ({p1Selected.length}/10)
          </h3>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-xs">
            {p1Selected.length === 0 ? (
              <div className="text-slate-600 text-center py-12 text-xs italic">
                Click cards on the left to add them to your secret selection.
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
            <div>🤖 Mirror match: AI uses the same 10 ghosts you select.</div>
            <div>🏺 Both 10-card decks shuffle into one Draw Jar.</div>
            <div>🤖 The Spirit Lord always plays from the top.</div>
            <div>🧠 You always play from the bottom.</div>
            <div>🔮 Psy refills each turn: turn 1 = 1/1, turn 2 = 2/2, turn 3 = 3/3.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
