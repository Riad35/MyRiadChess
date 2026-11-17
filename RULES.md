# Myriad Chess

Rules for the local hot-seat game. Piece names are German. The board and the log are in English.

This book is the single statement of the rules. It consolidates `Chess 2.txt` (v3.1) and the match setup: players place their own Soldaten. Where that older text disagreed with itself, the later specific line wins. Notation letters are `K D T B R Dr S`, not the earlier `V J T S K I P`.

Play is the same in every mode. Only the setup changes.

## 1. Battlefield

The board is 10×10, squares `a1` through `j10`. Files are `a`–`j`. Ranks are `1`–`10`.

White sits at the bottom and does not flip. White’s camp is ranks 1–3. Black’s camp is ranks 8–10. The midfield is ranks 4–7.

Rank 1 is White’s back rank. Rank 10 is Black’s back rank. “Forward” is toward the opponent.

The board is checkered so Bishop diagonals stay visible.

There is no castling and no en passant.

## 2. Armies

Each side has the same army.

| Piece | Must be on the board | Reserve |
| --- | --- | --- |
| König | 1 | 0 |
| Dame | 1 | 0 |
| Turm | at least 2 | the 3rd, unless placed in setup |
| Bishop | at least 2 | the 3rd, unless placed in setup |
| Ritter | at least 2 | the 3rd, unless placed in setup |
| Drache | at least 2 | the 3rd, unless placed in setup |
| Soldat | 15 | 0 |

The 15 Soldaten are 10 stacks, five of them doubles. König and Dame are never in reserve. A player may place the third Turm, Bishop, Ritter, or Drache during setup instead of keeping it in reserve. Anything not placed stays in reserve for the battle.

Default total: 25 pieces on the board and 4 in reserve, once the minimum army is set and the thirds were kept back.

## 3. Modes

Movement, stacks, shots, promotion, check, and clocks do not change between modes.

**Match.** Play Local. The board starts empty. Setup is three phases: Soldaten, doubles, main pieces. Then White moves.

**Testing — zigzag map.** The ten Soldaten are already on a fixed map, one per file. White: `a2 b3 c2 d3 e2 f2 g3 h2 i3 j2` (`e` and `f` both on rank 2). Black mirrors: `a9 b8 c9 d8 e9 f9 g8 h9 i8 j9`. Setup starts at the doubles phase. This map is not the match.

**Testing — mirrored preset.** Skips setup. Both camps are filled and the battle starts at once. Doubles are on files `a`, `c`, `e`, `f`, and `h`. The back rank, left to right for both colors, is Turm, Bishop, Ritter, Drache, König, Dame, Drache, Ritter, Bishop, Turm. The four thirds are in reserve.

**Testing — guide and testmap.** Sandbox. Clocks stay paused. The same move rules apply.

## 4. Setup — Soldaten

White places all ten Soldaten, confirms, then Black does the same.

Rules for each Soldat:

- Exactly one single Soldat per file. A file cannot hold Soldaten on two ranks.
- White may use rank 2 or rank 3. Black may use rank 8 or rank 9.
- The back rank is illegal: never rank 1 for White, never rank 10 for Black.
- Any mix of the two legal ranks is allowed, including all ten on the same rank.

Click a legal empty square to place. Click that Soldat again to pick it up. Click the other legal rank on the same file to move it. Confirm is allowed only at 10.

After both players confirm, 10 single Soldaten are on the board and none are in reserve.

## 5. Setup — doubles

White chooses first, then Black. Each player marks exactly 5 of their 10 files. A second Soldat is added on that file’s Soldat square. The stack stays on one square, so the file still has one stack.

Any 5 files are legal. They do not have to be adjacent, and they do not have to match the opponent.

After both confirm, each side has 15 Soldaten on the board and 0 in reserve. Main-piece setup begins, White to place.

## 6. Setup — main pieces

White places one piece, then the players alternate. A player who has passed does not place again; the other keeps the turn.

A main piece is König, Dame, Turm, Bishop, Ritter, or Drache. Soldaten are not placed in this phase.

A main piece may stand only on an empty square behind the Soldat on that same file:

- White, Soldat on rank 2: rank 1 only.
- White, Soldat on rank 3: rank 1 or rank 2.
- Black, Soldat on rank 9: rank 10 only.
- Black, Soldat on rank 8: rank 10 or rank 9.

Rank 3 and rank 8 are never main-piece squares. Two main pieces may share a file when both of those squares are empty. Pieces are not stacked during setup.

Pass is legal only when that side’s minimum army is on the board: 1 König, 1 Dame, 2 Turm, 2 Bishop, 2 Ritter, 2 Drache, and 15 Soldaten. Unplaced thirds stay in reserve. Emptying the pool does not pass for you. Setup ends when both players have passed. White then moves.

## 7. The battle

White moves first. One action, then the opponent. There is no pass during the battle.

An action is one of:

- **March.** Move a piece or stack, including a capture, a fusion, a Doppelsoldat move or split, or the shot from a charged 3-stack.
- **Reinforce.** Drop one reserve piece. No capture on a drop.

Reserve drops land on an empty midfield square (ranks 4–7), or onto your own stack anywhere, if the result is still height 3 or less. You cannot drop onto a König or a Dame. You cannot drop a König onto a stack that contains a Soldat. A drop that leaves your own König in check is illegal.

Forming a 3-stack by a drop does not also shoot on that action. The shot waits until a later turn.

## 8. Movement

Sliders stop at the first occupied square. A friendly square may fuse, if fusion is legal; otherwise it blocks. An enemy square is a capture. Jumpers do not look at the squares they pass over, except where a double jump names an empty middle square.

| Piece | Move |
| --- | --- |
| König | One step, any of the 8 directions. Capture or empty. |
| Dame | Any distance orthogonal or diagonal. |
| Turm | Any distance orthogonal. |
| Bishop | Any distance diagonal. |
| Ritter | A `(3,2)` jump, the eight knight-style offsets. Not blocked on the path. |
| Drache | A `(2,2)` jump, the four diagonal offsets. Not blocked on the path. |
| Soldat | One or two squares straight forward, if those squares are empty. The double step is always available, not once per game. No straight backward move and no sideways move. Captures one diagonal step, forward or backward. |

A Soldat under a non-Soldat does not move and has no Soldat rights. The piece on top moves with its own pattern and leaves the Soldat behind.

### Doppelsoldat

As a unit: the same forward 1 or 2, and the same one-step diagonal captures, forward or back. The pair stays a pair.

Split: only the top Soldat moves; the bottom stays. The top Soldat may capture one diagonal step, forward or back, or step to an empty orthogonal neighbour. A quiet diagonal split is illegal.

### Combined pieces

These pairs move as one figure and do not unstack.

| Pair | Move |
| --- | --- |
| Ritter + Ritter | Two `(3,2)` jumps. The middle square must be empty. Capture only on the end square. |
| Drache + Drache | Two `(2,2)` jumps. Same empty-middle rule. |
| Bishop + Bishop | One Dame slide, all eight rays. The pair is a Doppelbishop. |
| Bishop + Turm | One Dame slide, all eight rays. |
| Turm + Turm | Orthogonal any distance, like a Turm, with no castling. If that ride reaches an empty outermost square (files a and j, ranks 1 and 10), he may stop there or make one 90° turn and continue only along those outermost squares. The turn does not enter the middle of the board. He cannot turn unless the ride touches that wall. The move cannot re-enter the start square. A capture ends the move; there is no turn after a capture and no second bounce. |
| Drache + Ritter | Either a `(3,2)` jump or a `(2,2)` jump, chosen that turn. The pair is a Drachenritter. |

Dame on top of a non-Dame stack moves as a Dame and may leave. König on top moves as a König and may leave.

A height-3 stack whose top two pieces match, with a different piece underneath, may move those two together. Otherwise only the top piece leaves. Three identical pieces: only the top piece leaves.

Two Dames are not stacked, and promoting a Doppelsoldat does not create two Dames.

## 9. Stacks

Maximum height is 3. Landing on your own piece fuses into one stack when all of these hold:

- The result is height 3 or less.
- Neither side is a locked combined figure (the pairs in the table above).
- The target’s top piece is not König or Dame. Nothing stacks onto them.
- A König does not land on a stack that contains a Soldat.
- König and Dame do not share a stack.

König and Dame stay on top of any stack they join. Soldaten may carry each other (the Doppelsoldat) and may carry a non-Soldat.

A normal capture removes the whole enemy stack. The moving group replaces it. A split capture removes the target and leaves your bottom Soldat on the square you left.

## 10. Shots

A 3-stack gains one shot when it is formed. The shot uses the attack of the top piece and does not move the stack:

- Dame, Bishop + Bishop, and Bishop + Turm shoot on Dame rays.
- Turm shoots orthogonal. Bishop shoots diagonal.
- König shoots one step.
- Ritter and Drache shoot their jumps.
- Sliding shots are blocked by any piece. Jumps are not.

Only an occupied enemy square is a target. A shot never hits a stack that contains a König.

Effect: a height-3 target keeps only its top piece. A height-1 or height-2 target is removed. The charge is spent.

The written rule: the shot stays spent until that 3-stack is fully broken and formed again. Forming a 3-stack is illegal if that stack’s ordinary moves would attack the enemy König. A 3-stack cannot be stacked any higher.

After a reserve drop that forms a 3-stack, the action is the drop. Shooting is a later action, not both.

## 11. Promotion

After a march, if the top piece on the destination is your Soldat on the far rank (rank 10 for White, rank 1 for Black), that side must promote before anything else. The clock waits.

The written choices:

- A single Soldat becomes a Turm, Bishop, Ritter, or Drache, or a reserve piece may be stacked onto it instead.
- A Doppelsoldat on the far rank: one piece becomes a Dame, the other becomes a Turm, Bishop, Ritter, or Drache. Not a König. Not two Dames.
- A Soldat that arrives buried under another piece may be promoted, or a reserve piece may build the square into a 3-stack, and the upper piece stays.

König and Dame are not promotion choices for a single Soldat.

## 12. Check and the end of the game

The König is in check when the opponent could capture it on their next move. Shots never count as check.

A move, drop, shot, or promotion that leaves your own König in check is illegal. The König may not step onto an attacked square.

- No legal march, drop, or charged shot, and the König is in check: checkmate. The player who delivered it wins.
- No legal action, and the König is not in check: stalemate. Draw.
- The same position three times: draw. The key is the piece layout, the reserve (order ignored), and the side to move.
- A clock reaching 0 in the battle: the opponent wins.
- Insufficient material is not enforced.
- There is no resignation.

Taking the König is not how you win. The win is checkmate.

## 13. Clocks

The match clock is 5+3 or 10+5: minutes, plus a Fischer increment in seconds, added to the side that just completed a legal battle action.

The written rule: during setup the clock runs for the side about to place, and it switches after a successful action. In the battle it runs the same way. Sandbox clocks do not run.

## 14. Notation

| Letter | Piece |
| --- | --- |
| K | König |
| D | Dame |
| T | Turm |
| B | Bishop |
| R | Ritter |
| Dr | Drache |
| S | Soldat |

Examples: `e4`, `Rxe4`, `Te4↑`, `Sd5=d4` (split, top Soldat to `d4`), `Res-Bf4`, `3T-e5*` (shot), `+` check, `#` mate, `a10=T` promotion.

Illegal attempts are rejected and written to the log with a reason.

## 15. What this build still does differently

The sections above are the rules. These six points are what the current engine does instead. They are unchanged by the soldier-setup work.

- Clocks do not run during setup. They run only in the battle phase, and they pause while a promotion is waiting.
- Setup ends only when both players pass. Finishing the pool does not end setup by itself.
- Promotion is mandatory, and only the top Soldat transforms. A single Soldat becomes the chosen Turm, Bishop, Ritter, or Drache. A Doppelsoldat becomes a Dame plus that chosen piece. There is no “stack a reserve piece instead,” and a Soldat buried under another piece does not promote.
- Any arrival that leaves a height-3 stack charges a shot on the destination, including moving a 3-stack that was already complete. The written rule spends the shot until the stack is broken and built again.
- Squares a Soldat can step to without capturing still count as attacks. A König standing straight in front of a Soldat is treated as in check.
- Capturing the König is a legal capture and does not, by itself, end the game.
