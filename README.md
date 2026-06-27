# Spirit Jar

Cute ghost card battler prototype built with React, Vite, TypeScript, and Tailwind CSS.

Spirit Jar is currently a single-player prototype: **Player 1 vs Spirit Lord AI**. Build a small board of ghosts, spend Psy to Manifest spirits, attack the enemy field, and break the opponent's Jar.

## Current Rules Snapshot

- Player 1 always plays from the bottom of the screen.
- Spirit Lord AI always plays from the top of the screen.
- Each player has a Jar HP total. Reduce the enemy Jar to 0 to win.
- Mirror match deck rule: the AI uses a copy of your selected 10-card deck. Your 10 + AI's 10 shuffle into one Draw Jar.
- Psy starts at `1/1`, increases by 1 each round, refills at the start of your turn, and caps at `10/10`.
- Spending Psy only lowers current Psy for that turn.
- Each player may Manifest one spirit per turn.
- Field limit is 4 spirits per player.
- Each spirit may attack once per turn.
- Newly Manifested spirits cannot attack until the next turn unless a card says otherwise.
- Enemy spirits must be cleared before attacking the Enemy Jar.
- Cat Ghost can attack spirits but cannot attack the Jar.
- Bone Pile revives into Bones Ghost at the start of its owner's turn if it survives.
- Burn ticks at the start of the burned unit owner's turn, deals its current value, then decays by 1.
- Flame Ghost now applies Burn 2, stacking up to Burn 4.
- Bomb Ghost is a 5-cost board clear that destroys all non-Cat spirits. As a Hold, it can destroy one attacking non-Cat spirit.
- Sword Ghost is a fragile high-attack answer to Fat Ghost. As a React Hold, it gives your strongest friendly spirit +2 ATK.
- Ritual Ghost requires sacrificing two friendly spirits to Manifest. As a React Hold, it resummons your last destroyed non-token ghost if you have field space.
- Old Ghost gives +1 bonus Psy next turn when destroyed.
- Autoplay can let the AI pilot both sides for balance testing.

## Run Locally

Prerequisites: Node.js 20+ recommended.

```bash
npm install
npm run dev
```

Then open the local URL Vite prints in your terminal.

## Build

```bash
npm run build
npm run preview
```

## Deploy to Vercel

This is a standard Vite app.

Recommended Vercel settings:

```txt
Framework Preset: Vite
Install Command: npm install
Build Command: npm run build
Output Directory: dist
```

No environment variables are required for the current prototype.

## Project Structure

```txt
src/
  App.tsx
  components/
    BattleScreen.tsx
    CardView.tsx
    FieldUnitView.tsx
    SetupScreen.tsx
  data/
    cards.ts
  types.ts
  utils/
    audio.ts
```

## Notes

This is a playable prototype, not a final balanced card game. The current focus is stable turn flow, readable UI, and fast iteration on card rules.
