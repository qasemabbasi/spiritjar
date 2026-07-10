# Spirit Jar

Spirit Jar is a single-player prototype card battler: **Player 1 vs Spirit Lord AI**. Each player brings a Leader and a 10-card ghost deck. Both decks shuffle into one shared Draw Jar. You can use whatever ghost you draw, but every ghost remembers who originally bound it. The match is a contest to prove who can command the whole Spirit Jar.

## Core rules

- Each player has a Leader with 10 HP. Reduce the enemy Leader to 0 to shatter their Spirit Jar.
- Each player brings a separate 10-card deck. The player deck and AI deck shuffle together into one Draw Jar.
- **Bound** cards are ghosts you brought. **Borrowed** cards are ghosts the opponent brought but you are using.
- Control can change, but claim stays: a ghost on the opponent field may still be Bound to you.
- Draw 1 card per turn. Maximum hand size is 5.
- Psy refills by round: round 1 = 1/1, round 2 = 2/2, round 3 = 3/3, up to 10/10.
- Manifest 1 ghost per turn by paying its Psy cost.
- Each player has 3 field slots.
- A ghost becomes **Developed** if it survives until the start of its controller's next turn.
- Each ready spirit can attack once per turn.
- Enemy spirits protect the Leader. Clear enemy spirits before attacking the Leader, except Bite Ghost can slip past token-only boards.
- Combat has no Defense stat. Attack damage equals ATK.
- Splash, Bomb, and other effects deal their listed damage.
- Hold cards only become playable when they have a legal target.

## Prototype card roles

- Bite Ghost: fragile 1-cost pressure that can slip past token-only boards.
- Spear Ghost: clean 2-cost attacker for early board pressure.
- Lantern Ghost: Wisp generator with improved early attack.
- Possessor Ghost: reclaims a damaged ghost Bound to you from the enemy field; Developed ghosts return ready with +1 ATK this turn.
- Oathbreaker Ghost: sacrifices a ghost Bound to you from either field to damage the enemy Leader; enemy-field and Developed sacrifices hit harder, and Developed sacrifices draw a card.
- Grave Caller: returns a defeated non-Bomb ghost Bound to you from discard to hand; Developed echoes refund 1 Psy.
- Loud Ghost: splash and board chip.
- Bones Ghost: cheaper 2-cost recursion fuel with lower HP.
- Tank Ghost: large HP wall.
- Fog Ghost: cheap Taunt blocker; draws 1 if you are badly outnumbered on Manifest.
- Bomb Ghost: board damage, 1 damage to both Leaders, and emergency Hold blast.
- Ritual Ghost: sacrifice payoff and revive Hold.

## Development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

The app is a Vite + React project and can be deployed to Vercel with the default Vite settings.

## Active pool note

Cat Ghost, Flame Ghost, Sword Ghost, Soldier Ghost, and Old Ghost were removed from the active card-select pool and default decks for this tuning pass. Their old definitions remain in code only as inactive legacy content so older saved/test state will not crash. Spear Ghost no longer uses Rush while that mechanic is being reworked.
