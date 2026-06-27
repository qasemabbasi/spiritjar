# Spirit Jar

Cute ghost card battler prototype built with React, Vite, TypeScript, and Tailwind CSS.

Spirit Jar is currently a single-player prototype: **Player 1 vs Spirit Lord AI**. Build a small board of ghosts, spend Psy to Manifest spirits, attack the enemy field, and break the opponent's Jar.

## Current Rules Snapshot

- Player 1 always plays from the bottom of the screen.
- Spirit Lord AI always plays from the top of the screen.
- Each player has a Jar HP total. Reduce the enemy Jar to 0 to win.
- Psy starts at `1/1`, increases by 1 each round, refills at the start of your turn, and caps at `10/10`.
- Spending Psy only lowers current Psy for that turn.
- Each player may Manifest one spirit per turn.
- Each spirit may attack once per turn.
- Newly Manifested spirits cannot attack until the next turn unless a card says otherwise.
- Enemy spirits must be cleared before attacking the Enemy Jar.
- Cat Ghost can attack spirits but cannot attack the Jar.
- Bone Pile revives into Bones Ghost at the start of its owner's turn if it survives.
- Burn ticks at the start of the burned unit owner's turn.

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
