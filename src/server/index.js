const path = require('path');
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { Game } = require('./game');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIRECTORY = path.join(__dirname, '../../public');
const app = express();
const http = createServer(app);
const io = new Server(http);
const games = new Map();

app.use(express.static(PUBLIC_DIRECTORY));
app.get('*', (_, response) => response.sendFile(path.join(PUBLIC_DIRECTORY, 'index.html')));

const broadcast = game => io.to(game.room).emit('game:state', game.snapshot());

const sendFirstPieces = game => {
  game.players.forEach(player => {
    io.to(player.id).emit('piece:new', game.nextPiece(player.id));
  });
};

const getSocketGame = socket => games.get(socket.data.room);

const startRound = socket => {
  const game = getSocketGame(socket);
  if (!game || !game.start(socket.id)) return;

  broadcast(game);
  sendFirstPieces(game);
};

const finishIfNeeded = game => {
  const alivePlayers = [...game.players.values()].filter(player => player.alive);
  if (game.started && alivePlayers.length <= 1) {
    game.eliminate('');
    io.to(game.room).emit('game:over', game.winner);
  }
};

io.on('connection', socket => {
  socket.on('game:join', ({ room, name }) => {
    const game = games.get(room) || new Game(room);
    games.set(room, game);
    if (!game.join(socket.id, name)) {
      socket.emit('game:error', 'This round has already started.');
      return;
    }

    socket.data.room = room;
    socket.join(room);
    broadcast(game);
  });

  socket.on('game:start', () => startRound(socket));
  socket.on('game:restart', () => startRound(socket));

  socket.on('piece:next', () => {
    const game = getSocketGame(socket);
    const piece = game?.started && game.nextPiece(socket.id);
    if (piece) socket.emit('piece:new', piece);
  });

  socket.on('player:update', ({ spectrum }) => {
    const game = getSocketGame(socket);
    if (!game) return;

    game.update(socket.id, spectrum);
    broadcast(game);
  });

  socket.on('player:lines', ({ count }) => {
    const game = getSocketGame(socket);
    if (game && Number.isInteger(count) && count > 1) {
      socket.to(game.room).emit('board:penalty', Math.min(count - 1, 4));
    }
  });

  socket.on('player:lost', () => {
    const game = getSocketGame(socket);
    if (!game) return;

    const survivors = game.eliminate(socket.id);
    broadcast(game);
    if (survivors.length <= 1) io.to(game.room).emit('game:over', survivors[0]?.id);
  });

  socket.on('disconnect', () => {
    const game = getSocketGame(socket);
    if (!game) return;

    game.leave(socket.id);
    finishIfNeeded(game);
    if (!game.players.size) {
      games.delete(game.room);
      return;
    }

    broadcast(game);
    if (game.finished) io.to(game.room).emit('game:over', game.winner);
  });
});

http.listen(PORT, () => console.log('Red Tetris listening on port 3000'));
