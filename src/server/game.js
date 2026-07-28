const { randomInt } = require('crypto');

class Piece { constructor(index) { this.index = index; } }
class Player {
  constructor(id, name) {
    this.id = id;
    this.name = name;
    this.alive = true;
    this.spectrum = Array(10).fill(0);
    this.pieceCursor = 0;
  }
}
class Game {
  constructor(room) {
    this.room = room;
    this.players = new Map();
    this.host = null;
    this.started = false;
    this.finished = false;
    this.winner = null;
    this.seed = 0;
  }
  join(id, name) {
    if (this.started) return null;
    const player = new Player(id, name);
    this.players.set(id, player);
    if (!this.host) this.host = id;
    return player;
  }
  leave(id) {
    this.players.delete(id);
    if (this.host === id) this.host = this.players.keys().next().value || null;
  }
  start(id) {
    if (id !== this.host || this.started) return false;
    this.started = true;
    this.finished = false;
    this.winner = null;
    this.seed = randomInt(0, 7);
    this.players.forEach(player => { player.pieceCursor = 0; player.alive = true; player.spectrum = Array(10).fill(0); });
    return true;
  }
  nextPiece(id) {
    const player = this.players.get(id);
    return player && this.started ? new Piece((this.seed + player.pieceCursor++) % 7) : null;
  }
  update(id, nextSpectrum) {
    const player = this.players.get(id);
    if (player && Array.isArray(nextSpectrum) && nextSpectrum.length === 10) player.spectrum = nextSpectrum.map(value => Math.max(0, Math.min(20, Number(value) || 0)));
  }
  eliminate(id) {
    const player = this.players.get(id);
    if (player) player.alive = false;
    const survivors = [...this.players.values()].filter(candidate => candidate.alive);
    if (this.started && survivors.length <= 1) {
      this.started = false;
      this.finished = true;
      this.winner = survivors[0]?.id || null;
    }
    return survivors;
  }
  snapshot() {
    return {
      room: this.room, host: this.host, started: this.started, finished: this.finished, winner: this.winner,
      players: [...this.players.values()].map(({ id, name, alive, spectrum }) => ({ id, name, alive, spectrum }))
    };
  }
}
module.exports = { Game, Player, Piece };
