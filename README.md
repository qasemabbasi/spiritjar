# Spirit Jar

Spirit Jar is a single-player prototype card battler: **Player 1 vs Spirit Lord AI**. Each player brings a Leader and a 12-card ghost deck. Both decks shuffle into one shared Draw Jar. You can use whatever ghost you draw, but every ghost remembers who originally bound it. The match is a contest to prove who can command the whole Spirit Jar.

## Current design direction

Minimal monster battler, but with ridiculous ghost swings:

- Develop an early ghost and make it matter later.
- Borrow enemy ghosts, but risk their bond snapping back.
- Possess, swap, sacrifice, scare, pierce, stall, and steal resources.
- Keep the board small: 3 ghosts per side.
- Let the “star ghost” emerge naturally because one strong Developed ghost becomes worth protecting, stealing, or sacrificing.

## Core rules

- Each player has a Leader with 10 HP. Reduce the enemy Leader to 0 to shatter their Spirit Jar.
- Each player brings a separate 12-card deck. The player deck and AI deck shuffle together into one Draw Jar.
- **Bound** cards are ghosts you brought. **Borrowed** cards are ghosts the opponent brought but you are using.
- Control can change, but claim stays: a ghost on the opponent field may still be Bound to you.
- Draw 1 card per turn. Maximum hand size is 5.
- Psy refills by round: round 1 = 1/1, round 2 = 2/2, round 3 = 3/3, up to 10/10.
- Manifest 1 ghost per turn by paying its Psy cost.
- Each player has 3 field slots.
- A ghost becomes **Developed** if it survives until the start of its controller's next turn.
- **Scared** spirits cannot attack during their next attack phase, then recover.
- Each ready spirit can attack once per turn.
- Enemy spirits protect the Leader. Clear enemy spirits before attacking the Leader, except Bite Ghost can slip past token-only boards.
- Combat has no Defense stat. Attack damage equals ATK.
- Hold cards only become playable when they have a legal target.

## Current active cards

- Bite Ghost: fragile 1-cost pressure. Bound Bite steals current Psy on Leader hit. Developed Bite becomes nasty Oathbreaker fuel.
- Spear Ghost: clean 2-cost attacker. Bound Spear pierces 1 Leader damage through defeated non-token spirits. Developed Spear scares another enemy after a kill.
- Lantern Ghost: summons Wisps. Its attacks apply Burn 1 to surviving spirits. Bound Lantern creates ready Wisps. Borrowed Lantern creates Wisps still Bound to the original binder. Developed Lantern keeps feeding the board.
- Loud Ghost: board chip and splash. Bound Loud passes damage through kills. Developed Loud scares damaged enemies after splash.
- Bones Ghost: cheap 2-cost recursion fuel with lower HP. Developed Bones draws 1 when defeated or sacrificed; if sacrificed, it also leaves a Bone Pile.
- Fog Ghost: cheap Taunt. The first attack against Bound Fog passes through for 0 damage and scares the attacker.
- Possessor Ghost: Bound mode reclaims damaged Bound ghosts. Borrowed mode swaps places with a damaged enemy ghost.
- Oathbreaker Ghost: sacrifices a ghost Bound to you from either field. Developed sacrifices add +2 broken-oath damage, and enemy-field sacrifices add +1 more. It no longer draws by itself; Bones carries the sacrifice payoff.
- Grave Caller: calls back defeated non-Bomb Bound ghosts. If the recalled ghost died Developed and there is field space, it manifests exhausted instead of going to hand.
- Bomb Ghost: board reset and emergency Hold blast. Bound Bomb protects your Bound spirits by 1. Borrowed Bomb hits both Leaders harder. Survivors are scared.
- Ritual Ghost: sacrifice payoff and revive Hold. It can attack on the turn it is Manifested, and attacks into spirits spill half damage rounded up to the enemy Leader.

## Active pool note

Cat Ghost, Flame Ghost, Sword Ghost, Soldier Ghost, and Old Ghost were removed from the active card-select pool and default decks for this tuning pass. Their old definitions remain in code only as inactive legacy content so older saved/test state will not crash. Spear Ghost no longer uses Rush while that mechanic is being reworked.

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

## Card text format

Card details now use the same section order everywhere: Manifest Effect, Hold Effect, Attack Effect, Defense Effect, Defeat Effect, then Bound, Borrowed, and Developed. Role/Field text has been removed from the UI.


## Latest patch: counter holds + viewport scaling

- Added Tank Hold: when your Leader would take damage from a direct attack, Tank manifests and prevents up to 4 damage. Bound Tank enters Developed; Borrowed Tank pays the original binder +1 bonus Psy next turn.
- Added Possessor Hold: when the opponent Manifests a 5-cost ghost, Possessor swoops in and takes it until the end of your next turn. The stolen ghost cannot hit Leaders and returns Scared.
- Added Grave Caller sacrifice counterplay: if the opponent sacrifices a ghost Bound to you and you have room, a Grave Caller in hand calls that ghost back to your field exhausted.
- Developed Tank now survives the first defeat each turn at 1 HP.
- Tightened battlefield sizing with viewport-based scaling so the board, hand, controls, and log fit better on one screen.
