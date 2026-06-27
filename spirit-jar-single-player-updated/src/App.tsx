/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { SetupScreen } from './components/SetupScreen';
import { BattleScreen } from './components/BattleScreen';
import { sounds } from './utils/audio';

export default function App() {
  const [screen, setScreen] = useState<'setup' | 'battle'>('setup');
  const [isMuted, setIsMuted] = useState<boolean>(false);

  const [p1SelectedDecks, setP1SelectedDecks] = useState<string[]>([]);
  const [p2SelectedDecks, setP2SelectedDecks] = useState<string[]>([]);
  const [battleId, setBattleId] = useState<number>(0);

  const handleSetupComplete = (p1: string[], p2: string[]) => {
    setP1SelectedDecks(p1);
    setP2SelectedDecks(p2);
    setBattleId(prev => prev + 1);
    setScreen('battle');
  };

  const toggleMute = () => {
    const muted = sounds.toggleMute();
    setIsMuted(muted);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-2 sm:p-4 selection:bg-cyan-500 selection:text-slate-950 font-sans">
      {/* Top Global Navigation Bar */}
      <div className="w-full max-w-7xl flex justify-between items-center mb-3 px-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">👻</span>
          <span className="font-black tracking-tighter text-slate-200 uppercase text-sm">
            Spirit Jar <span className="text-cyan-400 text-xs font-mono px-1.5 py-0.5 bg-cyan-950 border border-cyan-800 rounded">PROTOTYPE</span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          {screen === 'battle' && (
            <button
              onClick={() => setScreen('setup')}
              className="text-xs font-mono text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer px-2 py-1 bg-slate-900 border border-slate-800 rounded"
            >
              [Exit to Setup]
            </button>
          )}

          <button
            onClick={toggleMute}
            className="px-3 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-xs font-mono text-slate-300 flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <span>{isMuted ? '🔇' : '🔊'}</span>
            <span>{isMuted ? 'Muted' : 'Sound On'}</span>
          </button>
        </div>
      </div>

      {/* Main Screen Content Container */}
      <div className="w-full flex justify-center">
        {screen === 'setup' ? (
          <SetupScreen onComplete={handleSetupComplete} />
        ) : (
          <div key={battleId} className="w-full flex justify-center">
            <BattleScreen
              p1Selected={p1SelectedDecks}
              p2Selected={p2SelectedDecks}
              onRestart={() => setScreen('setup')}
            />
          </div>
        )}
      </div>

      {/* Footer info */}
      <div className="mt-4 text-[11px] font-mono text-slate-600 text-center max-w-7xl">
        Single Player Prototype • Player 1 vs Spirit Lord AI • Reactive Hold Mechanics
      </div>
    </div>
  );
}
