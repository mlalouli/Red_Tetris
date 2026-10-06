import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { io } from 'socket.io-client';
import { collides, emptyBoard, hardDrop, lock, move, penalty, rotatePiece, spawn, spectrum } from '../shared/tetris';
import { routeFromPath } from './route';
import './styles.css';

const BOARD_COLUMNS = 10;
const DROP_INTERVAL_MS = 700;
const MIN_SPECTRUM_BAR_HEIGHT = 4;
const SPECTRUM_HEIGHT_MULTIPLIER = 5;
const GAME_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '];

const createSoloPlayer = (name, spectrumValues = Array(BOARD_COLUMNS).fill(0)) => ({
  id: 'solo',
  name,
  alive: true,
  spectrum: spectrumValues
});

const Board = ({ board, piece }) => {
  const cells = useMemo(() => board.flatMap((row, boardY) => row.map((filled, boardX) => {
    const pieceCell = piece?.shape[boardY - piece.y]?.[boardX - piece.x];
    return filled || Boolean(pieceCell);
  })), [board, piece]);

  return (
    <div className="board" aria-label="Tetris board">
      {cells.map((filled, index) => (
        <span className={filled ? 'cell cell--filled' : 'cell'} key={index} />
      ))}
    </div>
  );
};

const Opponents = ({ players, selfId }) => (
  <aside className="opponents">
    <h2>Players</h2>
    {players.map(player => (
      <div className="opponent" key={player.id}>
        <div>
          <strong>{player.name}{player.id === selfId ? ' (you)' : ''}</strong>
          <small>{player.alive ? 'active' : 'out'}</small>
        </div>
        <div className="spectrum" title="Column heights">
          {player.spectrum.map((height, index) => (
            <i
              style={{ height: `${Math.max(MIN_SPECTRUM_BAR_HEIGHT, height * SPECTRUM_HEIGHT_MULTIPLIER)}px` }}
              key={index}
            />
          ))}
        </div>
      </div>
    ))}
  </aside>
);

function App() {
  const route = useMemo(() => routeFromPath(window.location.pathname), []);
  const socket = useRef(null);
  const boardRef = useRef(emptyBoard());
  const pieceRef = useRef(null);
  const gameRef = useRef({ started: false });
  const cursorRef = useRef(0);
  const groundedRef = useRef(false);
  const lostRef = useRef(false);
  const [board, setBoard] = useState(boardRef.current);
  const [piece, setPiece] = useState(null);
  const [game, setGame] = useState({
    started: false,
    finished: false,
    players: route.solo ? [createSoloPlayer(route.name)] : []
  });
  const [notice, setNotice] = useState(route.solo ? 'Solo practice mode.' : 'Connecting...');

  const setGameState = useCallback(nextState => {
    gameRef.current = typeof nextState === 'function' ? nextState(gameRef.current) : nextState;
    setGame(gameRef.current);
  }, []);

  const setBoardState = useCallback(nextState => {
    boardRef.current = typeof nextState === 'function' ? nextState(boardRef.current) : nextState;
    setBoard(boardRef.current);
  }, []);

  const setPieceState = useCallback(nextPiece => {
    pieceRef.current = nextPiece;
    setPiece(nextPiece);
  }, []);
  const endRound = useCallback(message => {
    if (lostRef.current) return;
    lostRef.current = true;
    setPieceState(null);
    setNotice(message);
    setGameState(previous => ({ ...previous, started: false, finished: true }));
    if (!route.solo) socket.current?.emit('player:lost');
  }, [route.solo, setGameState, setPieceState]);
  const requestPiece = useCallback(() => {
    if (!route.solo) {
      socket.current?.emit('piece:next');
      return;
    }

    const nextPiece = spawn(cursorRef.current++);
    if (collides(boardRef.current, nextPiece)) {
      endRound('Game over. Start a new solo round.');
      return;
    }
    setPieceState(nextPiece);
  }, [endRound, route.solo, setPieceState]);
  const lockCurrent = useCallback(() => {
    const currentPiece = pieceRef.current;
    if (!currentPiece) return;

    const result = lock(boardRef.current, currentPiece);
    groundedRef.current = false;
    setBoardState(result.board);
    setPieceState(null);
    if (route.solo) {
      setGameState(previous => ({ ...previous, players: [createSoloPlayer(route.name, spectrum(result.board))] }));
    } else {
      socket.current?.emit('player:update', { spectrum: spectrum(result.board) });
      if (result.cleared) socket.current?.emit('player:lines', { count: result.cleared });
    }
    requestPiece();
  }, [requestPiece, route.name, route.solo, setBoardState, setGameState, setPieceState]);
  const performMove = useCallback((type) => {
    const currentPiece = pieceRef.current;
    if (!currentPiece || lostRef.current || !gameRef.current.started) return;
    if (type === 'drop') {
      const landing = hardDrop(boardRef.current, currentPiece);
      setPieceState(landing);
      lockCurrent();
      return;
    }

    const nextPiece = type === 'rotate'
      ? rotatePiece(boardRef.current, currentPiece)
      : move(boardRef.current, currentPiece, type, 0);
    groundedRef.current = false;
    setPieceState(nextPiece);
  }, [lockCurrent, setPieceState]);
  const tick = useCallback(() => {
    const currentPiece = pieceRef.current;
    if (!currentPiece || !gameRef.current.started || lostRef.current) return;
    if (collides(boardRef.current, currentPiece, 0, 1)) {
      if (groundedRef.current) lockCurrent();
      else groundedRef.current = true;
      return;
    }

    groundedRef.current = false;
    setPieceState(move(boardRef.current, currentPiece, 0, 1));
  }, [lockCurrent, setPieceState]);
  const startRound = useCallback(() => {
    lostRef.current = false;
    groundedRef.current = false;
    cursorRef.current = 0;
    setBoardState(emptyBoard());
    setPieceState(null);
    setNotice('');
    if (route.solo) {
      setGameState({ started: true, finished: false, host: 'solo', players: [createSoloPlayer(route.name)] });
      requestPiece();
      return;
    }

    socket.current?.emit(gameRef.current.finished ? 'game:restart' : 'game:start');
  }, [requestPiece, route.name, route.solo, setBoardState, setGameState, setPieceState]);
  useEffect(() => {
    if (route.solo) return undefined;
    const client = io();
    socket.current = client;
    client.on('connect', () => {
      client.emit('game:join', { room: route.room, name: route.name });
      setNotice('');
    });
    client.on('game:state', nextState => setGameState(nextState));
    client.on('game:error', setNotice);
    client.on('piece:new', ({ index }) => {
      const nextPiece = spawn(index);
      if (collides(boardRef.current, nextPiece)) {
        endRound('Your field is full.');
        return;
      }
      setPieceState(nextPiece);
    });
    client.on('board:penalty', count => setBoardState(current => penalty(current, count)));
    client.on('game:over', winner => {
      const message = winner === client.id ? 'You win!' : winner ? 'Round complete.' : 'Round ended.';
      setNotice(message);
      setGameState(previous => ({ ...previous, started: false, finished: true, winner }));
    });
    return () => client.disconnect();
  }, [endRound, route, setBoardState, setGameState, setPieceState]);
  useEffect(() => {
    const handler = event => {
      const key = event.key;
      if (GAME_KEYS.includes(key)) event.preventDefault();
      if (key === 'ArrowLeft') performMove(-1);
      if (key === 'ArrowRight') performMove(1);
      if (key === 'ArrowUp') performMove('rotate');
      if (key === 'ArrowDown') tick();
      if (key === ' ') performMove('drop');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [performMove, tick]);

  useEffect(() => {
    if (!game.started) return undefined;
    const timer = window.setInterval(tick, DROP_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [game.started, tick]);
  const selfId = route.solo ? 'solo' : socket.current?.id;
  const isHost = route.solo || selfId === game.host;
  const action = game.finished ? 'Restart round' : 'Start round';
  return <main><header><a className="brand" href="/solo">RED<span>TETRIS</span></a><p>{route.solo ? 'Solo mode' : <>Room <b>{route.room}</b></>}</p><p className="status" role="status">{notice}</p></header><section className="game-shell"><div className="play"><div className="board-frame"><Board board={board} piece={piece} /></div><div className="controls"><span>left/right move</span><span>up rotate</span><span>down soft drop</span><span>space hard drop</span></div>{!game.started && <div className="start-card"><h1>{game.finished ? 'Round complete' : `Ready, ${route.name}?`}</h1><p>{route.solo ? 'Practice the full Tetris rules locally.' : 'Every player receives the same sequence. Clear two or more lines to send penalty rows.'}</p>{isHost ? <button onClick={startRound}>{action}</button> : <p>Waiting for the host to start or restart...</p>}</div>}</div><Opponents players={game.players} selfId={selfId} /></section></main>;
}
createRoot(document.getElementById('root')).render(<App />);
