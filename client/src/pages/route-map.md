Instead of game components routing to another component directly.
We centralise the routing and display states in the /game/ dir. The state will be now handled by the server, as the game-layout requires a socket connection, and the server will determine which component to show based on the game state. This allows for better synchronization between players and a more seamless gaming experience. The client will listen for game state updates from the server and render the appropriate component accordingly.

Plan: use useNavigate in game-layout.tsx and a big switch statement.
Cons: could be slow.
Pros: centralise animations using motion and transitions, better coupling over routing and state management.


These are the game states are in server docs.


Now the thing is player 1 and player 2 have completely different views for some of these states. so we must create two new sub dirs game/controller and game/sabotager, and put the pages in there. The main game-layout will then route to these sub-components based on the player role and game state. 

Ideally the UI is completely decoupled from the game logic, so all components rely on zustand as the single source of truth for the game state, and the server is the ultimate authority on the game state. The zustand store has one job, update state if recieving game:state or game:private_state messages.
A separate utility must be created to send messages to the server, so that components can call these functions instead of emitting socket events directly. 
