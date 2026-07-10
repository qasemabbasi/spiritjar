# Spirit Jar

Spirit Jar is a single-player prototype card battler: **Player 1 vs Spirit Lord AI**. Each player brings a Leader and a 10-card ghost deck. Both decks shuffle into one shared Draw Jar. You can use whatever ghost you draw, but every ghost remembers who originally bound it. The match is a contest to prove who can command the whole Spirit Jar.

## Core rules

- Each player has a Leader with 10 HP. Reduce the enemy Leader to 0 to shatter their Spirit Jar.
- Each player brings a separate 10-card deck. The player deck and AI deck shuffle together into one Draw Jar.
- **Bound** cards are ghosts you brought. **Borrowed** cards are ghosts the opponent brought but you are using.
- Bound/Borrowed now changes card behavior. Bound cards usually reward your claim; Borrowed cards still work but may pay the original binder.
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

- Bite Ghost: fragile 1-cost pressure. Bound Bite steals current Psy on Leader hit; Borrowed Bite pays bonus Psy back to the original binder.
- Spear Ghost: clean 2-cost attacker. Bound Spear pierces 1 Leader damage through defeated non-token spirits.
- Lantern Ghost: Wisp generator. Bound Lantern creates ready Wisps; Borrowed Lantern creates Wisps still Bound to the original binder.
- Possessor Ghost: Bound mode reclaims damaged Bound ghosts; Borrowed mode swaps places with a damaged enemy ghost.
- Oathbreaker Ghost: sacrifices a ghost Bound to you from either field to damage the enemy Leader; Borrowed Oathbreaker pays bonus Psy back to the original binder.
- Grave Caller: returns a defeated non-Bomb ghost Bound to you from discard to hand; Borrowed Grave Caller pays bonus Psy back to the original binder.
- Loud Ghost: splash and board chip. Bound Loud can pass 1 damage through defeated spirits to the Leader.
- Bones Ghost: cheaper 2-cost recursion fuel with lower HP.
- Tank Ghost: large HP wall.
- Fog Ghost: cheap Taunt blocker; Bound Fog scares attackers and reduces incoming damage by 1.
- Bomb Ghost: board damage and emergency Hold blast. Bound Bomb protects your Bound spirits by 1; Borrowed Bomb deals 2 to both Leaders.
- Ritual Ghost: sacrifice payoff and revive Hold. Bound Ritual draws from Developed sacrifices; Borrowed Ritual can pay bonus Psy back to the original binder.

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
