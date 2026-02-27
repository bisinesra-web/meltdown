Instead of game components routing to another component directly.
We centralise the routing and display states in the /game/ dir. The state will be now handled by the server, as the game-layout requires a socket connection, and the server will determine which component to show based on the game state. This allows for better synchronization between players and a more seamless gaming experience. The client will listen for game state updates from the server and render the appropriate component accordingly.

Plan: use useNavigate in game-layout.tsx and a big switch statement.
Cons: could be slow.
Pros: centralise animations using motion and transitions, better coupling over routing and state management.


These are the game states:
'WAITING_FOR_PLAYERS' // Till both players have connected
'ALL_PLAYERS_CONNECTED' // Brief transitional phase (5s)
'COIN_TOSSING' // Coin toss animation; (10s)
'COIN_TOSSED' // Coin toss result (10s)
'PRE_ROUND' // Min of (60s OR successful cipher selection by controller)
'CHALL_CONTROL' // Min of (30s OR valid command submission by controller)
'CHALL_SABOTAGE' // Min of (30s OR valid command submission by sabotager)
'ROUND_RESOLUTION' // Brief transitional phase (5s)
'ROUND_WIN_CONTROL' // Display round win for controller (10s)
'ROUND_WIN_SABOTAGE' // Display round win for sabotager (10s)
'POST_ROUND' // Min of (60s OR both players ready) — displays scores. Bound to go to PRE_ROUND or GAME_OVER next.
'GAME_OVER'


Now the thing is player 1 and player 2 have completely different views for some of these states. so we must create two new sub dirs game/controller and game/sabotager, and put the pages in there. The main game-layout will then route to these sub-components based on the player role and game state. 

