const path = require('path');
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { Game } = require('./game');
const app = express(); const http = createServer(app); const io = new Server(http); const games = new Map();
app.use(express.static(path.join(__dirname, '../../public'))); app.get('*', (_, res) => res.sendFile(path.join(__dirname, '../../public/index.html')));
const broadcast = game => io.to(game.room).emit('game:state', game.snapshot());
const sendFirstPieces = game => game.players.forEach(player => io.to(player.id).emit('piece:new', game.nextPiece(player.id)));
const finishIfNeeded = game => {
  const alive = [...game.players.values()].filter(player => player.alive);
  if (game.started && alive.length <= 1) {
    game.eliminate('');
    io.to(game.room).emit('game:over', game.winner);
  }
};
io.on('connection', socket => {
  socket.on('game:join', ({ room, name }) => { const game = games.get(room) || new Game(room); games.set(room, game); const player = game.join(socket.id, name); if (!player) return socket.emit('game:error', 'This round has already started.'); socket.data.room = room; socket.join(room); broadcast(game); });
  socket.on('game:start', () => { const game = games.get(socket.data.room); if (game && game.start(socket.id)) { broadcast(game); sendFirstPieces(game); } });
  socket.on('game:restart', () => { const game = games.get(socket.data.room); if (game && game.start(socket.id)) { broadcast(game); sendFirstPieces(game); } });
  socket.on('piece:next', () => { const game = games.get(socket.data.room); const piece = game?.started && game.nextPiece(socket.id); if (piece) socket.emit('piece:new', piece); });
  socket.on('player:update', ({ spectrum }) => { const game = games.get(socket.data.room); if (game) { game.update(socket.id, spectrum); broadcast(game); } });
  socket.on('player:lines', ({ count }) => { const game = games.get(socket.data.room); if (game && Number.isInteger(count) && count > 1) socket.to(game.room).emit('board:penalty', Math.min(count - 1, 4)); });
  socket.on('player:lost', () => { const game = games.get(socket.data.room); if (!game) return; const survivors = game.eliminate(socket.id); broadcast(game); if (survivors.length <= 1) io.to(game.room).emit('game:over', survivors[0]?.id); });
  socket.on('disconnect', () => { const game = games.get(socket.data.room); if (!game) return; game.leave(socket.id); finishIfNeeded(game); if (!game.players.size) games.delete(game.room); else { broadcast(game); if (game.finished) io.to(game.room).emit('game:over', game.winner); } });
});
http.listen(process.env.PORT || 3000, () => console.log('Red Tetris listening on port 3000'));
