## Database schema:

| room_id | room_code | created_at          | updated_at          | player_1_name | player_2_name | player_1_secret | player_2_secret | room_state |
|---------|-----------|---------------------|---------------------|---------------|---------------|-----------------|-----------------|----------------|
INTEGER   | TEXT      | DATETIME            | DATETIME            | TEXT          | TEXT          | TEXT            | TEXT            | TEXT (JSON)           |

## Game logic:
The game state is stored using an enumeration of the different states of the game, creating a finite state machine. This guarantees that the game can only be in one of the defined states at any given time, and that transitions between states are well-defined and controlled.

Each state is accompanied by a timestamp as well as a data object that can hold an arbitrary data structure, allowing for flexibility in storing relevant information for each state.

## Round structure

There are **5 levels**, each played **twice** (sub-round A and sub-round B):
- **Sub-round A**: the coin-toss winner is the **controller**.
- **Sub-round B**: roles are swapped — the loser of the coin toss is the **controller**.

This gives **10 rounds total** (5 levels × 2 sub-rounds). One point is awarded per round win.  A player wins the game by accruing more points than their opponent after all 10 rounds; a draw is possible (5–5).

### Roles
- **Controller**: selects a cipher in PRE_ROUND, then submits a command in CHALL_CONTROL.
- **Sabotager**: observes the encrypted command in CHALL_SABOTAGE and tries to guess the original.

## States:
  = | 'WAITING_FOR_PLAYERS' // Till both players have connected
    | 'ALL_PLAYERS_CONNECTED' // Brief transitional phase (5s)
    | 'COIN_TOSSING' // Coin toss animation (3s)
    | 'COIN_TOSSED' // Coin toss result (10s)
    | 'PRE_ROUND' // Min of (60s OR cipher selection by controller)
    | 'CHALL_CONTROL' // Min of (30s OR valid command submission by controller)
    | 'CHALL_SABOTAGE' // Min of (30s OR valid guess submission by sabotager)
    | 'ROUND_RESOLUTION' // Brief transitional phase (5s)
    | 'ROUND_WIN_CONTROL' // Display round win for controller (10s)
    | 'ROUND_WIN_SABOTAGE' // Display round win for sabotager (10s)
    | 'POST_ROUND' // Min of (60s OR both players ready) — displays scores
    | 'GAME_OVER'


## State descriptions:
- `WAITING_FOR_PLAYERS`: Waiting for both players to connect. Moves to `ALL_PLAYERS_CONNECTED` immediately when the second player joins.
- `ALL_PLAYERS_CONNECTED`: Both players are present. Purely for animation. The coin-toss winner is determined when transitioning to `COIN_TOSSING` after **5 seconds**.
- `COIN_TOSSING`: Purely for animation (coin-flip). Moves to `COIN_TOSSED` after **3 seconds**.
- `COIN_TOSSED`: Coin toss result is shown; players see who is the controller for sub-round A. Moves to `PRE_ROUND` after **10 seconds**.
- `PRE_ROUND`: The controller selects their cipher for the current level. Accepts `game:select_cipher` from the controller only. Moves to `CHALL_CONTROL` on valid cipher selection or after **60 seconds** (proceeds with an empty cipher — no blocks — if controller does not select in time). The `cipherSelected` flag reflects whether a cipher was explicitly chosen.
- `CHALL_CONTROL`: The server recommends a random reactor command to the controller. The controller submits any valid command via `game:submit_command`. Moves to `CHALL_SABOTAGE` on valid submission or after **30 seconds** (proceeds with `controllerCommand = null` — controller forfeits the round).
- `CHALL_SABOTAGE`: The controller's command is run through their cipher and the encrypted result is shown publicly to both players. The sabotager must guess the **original** command via `game:submit_guess`. Moves to `ROUND_RESOLUTION` on valid submission or after **30 seconds** (proceeds with `sabotagerGuess = null` — sabotager forfeits the round).
- `ROUND_RESOLUTION`: A 5-second animation phase. After **5 seconds**, the winner is determined:
  - If `controllerCommand === null` → sabotager wins (controller forfeited).
  - Otherwise, if `sabotagerGuess` matches `controllerCommand` (case-insensitive, parsed component-by-component) → sabotager wins.
  - Otherwise → controller wins.
  Moves to `ROUND_WIN_CONTROL` or `ROUND_WIN_SABOTAGE` accordingly.
- `ROUND_WIN_CONTROL`: Controller won. Both players see the round result. The **controller's score is incremented by 1**. Moves to `POST_ROUND` after **10 seconds**.
- `ROUND_WIN_SABOTAGE`: Sabotager won. Both players see the round result. The **sabotager's score is incremented by 1**. Moves to `POST_ROUND` after **10 seconds**.
- `POST_ROUND`: Scores are displayed and round data is cleared. Players can signal readiness via `game:player_ready`. Once both players are ready OR **60 seconds** have elapsed:
  - If `subRound === 'A'` → next state is `PRE_ROUND` with `subRound = 'B'` (same level, roles swapped).
  - If `subRound === 'B'` and `currentLevel < 5` → next state is `PRE_ROUND` with `subRound = 'A'`, `currentLevel + 1`.
  - If `subRound === 'B'` and `currentLevel === 5` → `GAME_OVER`.
- `GAME_OVER`: All 10 rounds played. The player with more points wins. A draw is possible.

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
| `game:select_cipher` | `PRE_ROUND` | controller | `{ ...CipherSchema }` |
| `game:submit_command` | `CHALL_CONTROL` | controller | `{ command: string }` |
| `game:submit_guess` | `CHALL_SABOTAGE` | sabotager | `{ guess: string }` |
| `game:player_ready` | `POST_ROUND` | either | _(no payload)_ |

## Communication with the frontend:
The server must be careful not to send any information to the frontend that could help a player cheat. For this a data structure is split into two parts: a public data structure that contains only information that both players are allowed to see, and a private data structure that contains information that only the player who owns it is allowed to see.

We must be careful to never broadcast the private data structure in a socket-io room, instead using the socket-io `to` with the player's socket id to send the private data structure only to the player who owns it. The public data structure can be safely broadcasted to all players in the room, as it does not contain any sensitive information that could be used for cheating. There must also not be any direct peer-to-peer communication between the players.

### Private data rules
- **Controller's cipher** — sent only to the controller, from `PRE_ROUND` onwards.
- **Controller's submitted command** — sent privately to the controller during `CHALL_SABOTAGE` only (before round resolution reveals it publicly).
- **Sabotager's guess** — sent privately to the sabotager before round resolution.
- After `ROUND_RESOLUTION`, both `controllerCommand` and `sabotagerGuess` are included in the **public** state so both players can see the outcome.

Remember: We work on the principle of sending the entire required state to a particular frontend on every state change, rather than sending incremental updates. So frontend should be able to reconstruct the entire game state from the data sent by the server on every state change, without needing to rely on any previous state information.

The server sends only two types of messages to the frontend `game:state` and `game:private_state`. On any change in any state data or phase, resend the entire state to the frontend.
