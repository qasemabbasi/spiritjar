# Spirit Jar

Spirit Jar is a single-player prototype card battler: **Player 1 vs Spirit Lord AI**. Each player brings a Leader and a 10-card ghost deck. Both decks shuffle into one shared Draw Jar, and players Manifest ghosts with Psy, attack with spirits, use reactive Hold effects, and try to defeat the enemy Leader.

## Core rules

- Each player has a Leader with 12 HP. Reduce the enemy Leader to 0 to shatter their Spirit Jar.
- Each player brings a separate 10-card deck. The player deck and AI deck shuffle together into one Draw Jar.
- Draw 1 card per turn. Maximum hand size is 5.
- Psy refills by round: round 1 = 1/1, round 2 = 2/2, round 3 = 3/3, up to 10/10.
- Manifest 1 ghost per turn by paying its Psy cost.
- Each player has 4 field slots.
- Each ready spirit can attack once per turn.
- Enemy spirits protect the Leader. Clear enemy spirits before attacking the Leader.
- Combat has no Defense stat. Attack damage equals ATK.
- Burn, Splash, Bomb, and other effects deal their listed damage.
- Cat Ghost can attack Leaders, cannot be targeted by non-Cat normal attacks, can be damaged by effects, and cannot receive ATK buffs.
- Hold cards only become playable when they have a legal target.

## Prototype card roles

- Cat Ghost: cheap evasive chip attacker.
- Flame Ghost: burn pressure.
- Soldier Ghost: Taunt protector.
- Lantern Ghost: Wisp generator.
- Old Ghost: healing and bonus Psy on defeat.
- Sword Ghost: fragile high-ATK attacker and attack trick.
- Loud Ghost: splash and board chip.
- Bones Ghost: Bone Pile recursion.
- Fat Ghost: large HP wall.
- Bomb Ghost: board damage and emergency Hold blast.
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
