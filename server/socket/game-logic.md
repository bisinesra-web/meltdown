## Database schema:

| room_id | room_code | created_at          | updated_at          | player_1_name | player_2_name | player_1_secret | player_2_secret | room_state |
|---------|-----------|---------------------|---------------------|---------------|---------------|-----------------|-----------------|----------------|
INTEGER   | TEXT      | DATETIME            | DATETIME            | TEXT          | TEXT          | TEXT            | TEXT            | TEXT (JSON)           |

## Game logic:
The game state is stored using an enumeration of the different states of the game, creating a finite state machine. This guarantees that the game can only be in one of the defined states at any given time, and that transitions between states are well-defined and controlled. 

Each state is accompanied by a timestamp as well as a data object that can hold an arbitrary data structure, allowing for flexibility in storing relevant information for each state. 

The game states are as follows:
- `WAITING_FOR_PLAYERS`: The game is waiting for players to join. The data object can hold information about the players who have joined so far.
- `COIN_TOSSING`: The game is in the coin toss phase, where players determine who goes first. The data object can hold information about the players involved in the coin toss and any relevant details about the toss itself.
- `COIN_TOSSED`: The coin toss result has been revealed, and players can see who goes first. The data object can hold information about the coin toss result and the players involved.
- `PRE_ROUND`: The game is in the pre-round phase, where players can select their cipher. The data object can hold information about the selected ciphers and the players involved.
- `IN_ROUND`: The game is in the middle of a round, where players are actively playing. The data object can hold information about the current round, such as the players' moves and the game board state.
- `POST_ROUND`: The game is in the post-round phase, where the results of the round are being processed. The data object can hold information about the round.
- `GAME_OVER`: The game has ended, and a winner has been determined. The data object can hold information about the final results and the players involved.

Following are the possible transitions between states:
- From `WAITING_FOR_PLAYERS` to `COIN_TOSSING`: This transition occurs exactly after 5 seconds after the second player has joined the game. This ensures that both players have had enough time to join before the game progresses to the next phase.
- From `COIN_TOSSING` to `COIN_TOSSED`: The frontend shows an animation of a coin toss for 3 seconds, after which the result of the coin toss is revealed. This transition occurs exactly 3 seconds after the `COIN_TOSSING` state is entered.
- From `COIN_TOSSED` to `PRE_ROUND`: The coin tossed result is revealed for 10 seconds, allowing players to see who goes first before transitioning to the pre-round phase.
- From `PRE_ROUND` to `IN_ROUND`: This transition occurs when both players have selected their ciphers and are ready to start the round. The game will wait until both players have made their selections before transitioning to the in-round phase.
- From `IN_ROUND` to `POST_ROUND`: This transition occurs when the round is completed, either by one player winning or by a draw. The game will process the results of the round and then transition to the post-round phase.
- From `POST_ROUND` to `PRE_ROUND`: This transition occurs after a short delay (e.g., 5 seconds) to allow players to see the results of the round before starting the next round. The game will then transition back to the pre-round phase, allowing players to select their ciphers for the next round.
- From `POST_ROUND` to `GAME_OVER`: This transition occurs when a player has won the game, either by reaching a certain number of wins or by other winning conditions defined in the game rules. The game will then transition to the game over phase, where the final results are displayed and the winner is announced.

## Communication with the frontend:
The server must be careful not to send any information to the frontend that could help a player cheat. For this a data structure is split into two parts: a public data structure that contains only information that both players are allowed to see, and a private data structure that contains information that only the player who owns it is allowed to see.

We must be careful to never broadcast the private data structure in a socket-io room, instead using the socket-io `to` with the player's socket id to send the private data structure only to the player who owns it. The public data structure can be safely broadcasted to all players in the room, as it does not contain any sensitive information that could be used for cheating. There must also not be any direct peer-to-peer communication between the players.

Remember: We work on the principle of sending the entire required state to a particular frontend on every state change, rather than sending incremental updates. So frontend should be able to reconstruct the entire game state from the data sent by the server on every state change, without needing to rely on any previous state information.

## Rules governing IN_ROUND state:
These set of rules will define how one data state may be transformed into another data state during the IN_ROUND phase. This will be crucial for ensuring that the game logic is consistent and that players can only make valid moves during their turn.
For now leave as undefined.
