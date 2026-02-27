## Database schema:

| room_id | room_code | created_at          | updated_at          | player_1_name | player_2_name | player_1_secret | player_2_secret | room_state |
|---------|-----------|---------------------|---------------------|---------------|---------------|-----------------|-----------------|----------------|
INTEGER   | TEXT      | DATETIME            | DATETIME            | TEXT          | TEXT          | TEXT            | TEXT            | TEXT (JSON)           |

## Game logic:
The game state is stored using an enumeration of the different states of the game, creating a finite state machine. This guarantees that the game can only be in one of the defined states at any given time, and that transitions between states are well-defined and controlled.

Each state is accompanied by a timestamp as well as a data object that can hold an arbitrary data structure, allowing for flexibility in storing relevant information for each state.

## Turn / level structure

There are **3 levels**, each played as **2 turns** (one per player as controller). Within each turn, there are up to **3 subrounds**:
- **Level (1–3)**: difficulty tier; higher levels allow more complex ciphers.
- **Turn**: one player is the **controller** for up to 3 subrounds using the **same cipher**.
- **Subround**: a single command/guess cycle within a turn.

This gives **6 turns total** (3 levels × 2 turns). One point is awarded **per turn win**. A player wins the game by accruing more points than their opponent after all 6 turns; a draw is possible (3–3).

### Roles
- **Controller**: selects a cipher in `PRE_TURN`, then selects one of the server-offered commands in `CHALL_CONTROL`.
- **Sabotager**: observes the encrypted command in `CHALL_SABOTAGE` and tries to guess the original.

The **coin toss** determines who controls turn 1 of each level:
- Coin-toss winner is controller for **turn 1** of each level.
- Coin-toss loser is controller for **turn 2** of that level.

## States:
  = | 'WAITING_FOR_PLAYERS' // Till both players have connected
    | 'ALL_PLAYERS_CONNECTED' // Brief transitional phase (5s)
    | 'COIN_TOSSING' // Coin toss animation (3s)
    | 'COIN_TOSSED' // Coin toss result (10s)
    | 'PRE_TURN' // Min of (60s OR cipher selection by controller)
    | 'CHALL_CONTROL' // Min of (30s OR command selection by controller; HP ticking)
    | 'CHALL_SABOTAGE' // Min of (30s OR valid guess submission by sabotager)
    | 'SUBROUND_RESOLUTION' // Brief transitional phase (5s)
    | 'TURN_END' // Display turn win (10s)
    | 'POST_TURN' // Min of (60s OR both players ready) — displays scores
    | 'GAME_OVER'


## State descriptions:
- `WAITING_FOR_PLAYERS`: Waiting for both players to connect. Moves to `ALL_PLAYERS_CONNECTED` immediately when the second player joins.
- `ALL_PLAYERS_CONNECTED`: Both players are present. Purely for animation. The coin-toss winner is determined when transitioning to `COIN_TOSSING` after **5 seconds**.
- `COIN_TOSSING`: Purely for animation (coin-flip). Moves to `COIN_TOSSED` after **3 seconds**.
- `COIN_TOSSED`: Coin toss result is shown; players see who will be the controller for turn 1 of each level. Moves to `PRE_TURN` after **10 seconds**.
- `PRE_TURN`: The controller selects their cipher for the current level/turn. Accepts `game:select_cipher` from the controller only. Moves to `CHALL_CONTROL` on valid cipher selection or after **60 seconds** (proceeds with an empty cipher — no blocks — if the controller does not select in time). The `cipherSelected` flag reflects whether a cipher was explicitly chosen. At the start of each turn, reactor health (HP) is reset to 100 and the subround counter is set to 1.
- `CHALL_CONTROL`: At the start of each subround, the server generates **3 command options**. The controller must choose one via `game:select_command { commandIndex: 0|1|2 }`. While in this phase, reactor health **ticks down by 1 per second**, up to a maximum of 30 seconds per subround. When the controller selects a command, HP is **increased** based on how many of the command's components (component/type/attribute) have been seen earlier in the same turn:
  - 0 reused components → +10 HP
  - 1 reused component → +20 HP
  - 2–3 reused components → +25 HP
  HP is always clamped to the range [0, 100]. If the controller fails to choose a command within 30 seconds, `selectedCommand = null` for this subround. The phase then moves to `CHALL_SABOTAGE`.
- `CHALL_SABOTAGE`: The selected command (if any) is run through the controller's cipher and the encrypted result is shown publicly to both players. The sabotager must guess the **original** command via `game:submit_guess`. Moves to `SUBROUND_RESOLUTION` on valid submission or after **30 seconds** (proceeds with `sabotagerGuess = null` — sabotager forfeits the subround's attack).
- `SUBROUND_RESOLUTION`: A 5-second animation phase. After **5 seconds**, the sabotager's impact on reactor HP is resolved:
  - If `selectedCommand === null` (controller timed out / forfeited) → reactor HP is reduced by **50**.
  - Otherwise, compare `sabotagerGuess` and `controllerCommand` component-by-component (case-insensitive, trimmed). Let `matches` be the number of components (out of 4) that match; apply damage as:
    - 4 matches → HP set to 0 (turn ends; sabotager wins the turn).
    - 3 matches → HP −= 70.
    - 2 matches → HP −= 50.
    - 1 match  → HP −= 30.
    - 0 matches → no damage.
  - If `sabotagerGuess === null` (sabotager timed out) → no damage.
  HP is clamped to [0, 100]. The plaintext/ciphertext pair for this subround (if a command was selected) is added to the list of pairs for the current turn to support sabotager learning.
  If HP drops to **0 or below** at any point, the turn ends immediately in favor of the sabotager. Otherwise, if this was the 3rd subround of the turn, the turn ends in favor of the controller. If fewer than 3 subrounds have been played and HP is still > 0, the game proceeds to the next subround by returning to `CHALL_CONTROL`.
- `TURN_END`: A 10-second phase where both players see who won the turn. Exactly one point is awarded to the **turn winner**. After this, the game moves to `POST_TURN`.
- `POST_TURN`: Scores are displayed and **turn-level data is cleared** (HP, subround counter, per-turn command history, plaintext/ciphertext pairs). Players can signal readiness via `game:player_ready`. Once both players are ready OR **60 seconds** have elapsed:
  - If this was the first turn of the current level → next state is `PRE_TURN` for **turn 2** of the same level (roles swapped).
  - If this was the second turn of the level and `currentLevel < MAX_LEVELS` → next state is `PRE_TURN` for **turn 1** of the next level.
  - If this was the second turn of the final level (`currentLevel === MAX_LEVELS`) → `GAME_OVER`.
- `GAME_OVER`: All 6 turns have been played. The player with more points wins. A draw is possible.

## Command format

All commands (submitted or guessed) must match the format: `"Component type attribute value"`

- **Component**: alphabetic string (e.g. `waterpipe`, `reactor`)
- **Type**: alphanumeric (e.g. `A`, `primary`)
- **Attribute**: alphabetic (e.g. `pressure`, `temperature`)
- **Value**: integer, optionally prefixed with `+` or `-` (e.g. `+50`, `-20`, `0`)

Comparison between `controllerCommand` and `sabotagerGuess` is done by splitting each into 4 components and comparing them individually, case-insensitively, after trimming whitespace.

## Socket events (client → server)

| Event | Phase | Sender | Payload |
|-------|-------|--------|---------|
| `game:select_cipher` | `PRE_TURN` | controller | `{ ...CipherSchema }` |
| `game:select_command` | `CHALL_CONTROL` | controller | `{ commandIndex: 0 \| 1 \| 2 }` |
| `game:submit_guess` | `CHALL_SABOTAGE` | sabotager | `{ guess: string }` |
| `game:player_ready` | `POST_TURN` | either | _(no payload)_ |

## Communication with the frontend:
The server must be careful not to send any information to the frontend that could help a player cheat. For this a data structure is split into two parts: a public data structure that contains only information that both players are allowed to see, and a private data structure that contains information that only the player who owns it is allowed to see.

We must be careful to never broadcast the private data structure in a socket-io room, instead using the socket-io `to` with the player's socket id to send the private data structure only to the player who owns it. The public data structure can be safely broadcasted to all players in the room, as it does not contain any sensitive information that could be used for cheating. There must also not be any direct peer-to-peer communication between the players.

### Private data rules
- **Controller's cipher** — sent only to the controller, from `PRE_TURN` onwards.
- **Controller's command options and effectiveness values** — sent only to the controller during `CHALL_CONTROL`.
- **Controller's selected command** — sent privately to the controller during `CHALL_SABOTAGE` only (before subround resolution reveals it publicly).
- **Sabotager's guess** — sent privately to the sabotager before subround resolution.
- **Plaintext/ciphertext pairs for the current turn** — sent to the sabotager as part of their private state so they can learn across subrounds; these pairs accumulate within a turn and are cleared when the turn changes.
- After `SUBROUND_RESOLUTION`, both `controllerCommand` and `sabotagerGuess` for that subround are included in the **public** state so both players can see the outcome.

Remember: We work on the principle of sending the entire required state to a particular frontend on every state change, rather than sending incremental updates. So frontend should be able to reconstruct the entire game state from the data sent by the server on every state change, without needing to rely on any previous state information.

The server sends only two types of messages to the frontend `game:state` and `game:private_state`. On any change in any state data or phase, resend the entire state to the frontend.
