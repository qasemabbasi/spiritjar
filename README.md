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
- Each player has 4 field slots.
- Each ready spirit can attack once per turn.
- Enemy spirits protect the Leader. Clear enemy spirits before attacking the Leader, except Bite Ghost can slip past token-only boards.
- Combat has no Defense stat. Attack damage equals ATK.
- Burn, Splash, Bomb, and other effects deal their listed damage.
- Cat Ghost can attack Leaders, cannot be targeted by non-Cat normal attacks, can be damaged by effects, and cannot receive ATK buffs.
- Hold cards only become playable when they have a legal target.

## Prototype card roles

- Bite Ghost: fragile 1-cost pressure that can slip past token-only boards.
- Cat Ghost: cheap evasive chip attacker.
- Flame Ghost: burn pressure.
- Spear Ghost: clean 2-cost Rush attacker; can attack enemy spirits immediately, but cannot attack Leaders on the Manifest turn.
- Soldier Ghost: Taunt protector.
- Lantern Ghost: Wisp generator with improved early attack.
- Possessor Ghost: reclaims a damaged ghost Bound to you from the enemy field.
- Oathbreaker Ghost: sacrifices a ghost Bound to you from either field to damage the enemy Leader.
- Grave Caller: returns a defeated ghost Bound to you from discard to hand.
- Old Ghost: healing and bonus Psy on defeat.
- Sword Ghost: fragile high-ATK attacker and attack trick.
- Loud Ghost: splash and board chip.
- Bones Ghost: Bone Pile recursion.
- Tank Ghost: large HP wall.
- Fog Ghost: anti-snowball Hold that cancels an attack only when you are badly outnumbered.
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
