# Red Tetris

A React single-page multiplayer Tetris game served by Node.js, Express, and Socket.IO.

## Run

```bash
npm install
npm start
```

Open `http://localhost:3000/solo` for solo practice, or `http://localhost:3000/<room>/<player-name>` to join a multiplayer room. For example, two players can join `/arena/Ada` and `/arena/Ben`.

The first player in a room is host and starts or restarts each round. New players cannot join while a round is active.

## Controls

- Left / Right: move
- Up: rotate
- Down: soft drop
- Space: hard drop

## Architecture

- `src/client`: React SPA and CSS-grid rendering. Browser game rules are pure functions from `src/shared`.
- `src/shared/tetris.js`: pure board, collision, rotation, locking, line-clear, penalty, spectrum, and game-over helpers.
- `src/server/game.js`: prototype/class model with `Game`, `Player`, and `Piece`.
- `src/server/index.js`: Express static server plus Socket.IO room protocol.

Socket events are `game:join`, `game:start`, `game:restart`, `piece:next`, `player:update`, `player:lines`, and `player:lost`. The server owns room/host state, a shared deterministic piece stream, and player spectra. Each client receives the same piece indexes in its own sequence, so games stay synchronized while players act at different speeds.

## Checks

```bash
npm test
npm run build
```

The test suite covers core Tetris rules and server room management. No persistence or secrets are used; `.env` files are ignored.
