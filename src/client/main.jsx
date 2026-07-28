import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { io } from 'socket.io-client';
import { clearLines, collides, emptyBoard, hardDrop, lock, move, penalty, rotatePiece, spawn, spectrum } from '../shared/tetris';
import './styles.css';

const routeFromUrl = () => {
  const parts = window.location.pathname.split('/').filter(Boolean);
  if (!parts.length || parts[0] === 'solo') return { solo: true, room: 'solo', name: 'Solo player' };
  return { solo: false, room: decodeURIComponent(parts[0]), name: decodeURIComponent(parts[1] || 'player') };
};
const Board = ({ board, piece }) => {
  const cells = useMemo(() => board.flatMap((row, y) => row.map((filled, x) => filled || Boolean(piece?.shape[y - piece.y]?.[x - piece.x]))), [board, piece]);
  return <div className="board" aria-label="Tetris board">{cells.map((filled, index) => <span className={filled ? 'cell cell--filled' : 'cell'} key={index} />)}</div>;
};
const Opponents = ({ players, selfId }) => <aside className="opponents"><h2>Players</h2>{players.map(player => <div className="opponent" key={player.id}><div><strong>{player.name}{player.id === selfId ? ' (you)' : ''}</strong><small>{player.alive ? 'active' : 'out'}</small></div><div className="spectrum" title="Column heights">{player.spectrum.map((height, index) => <i style={{ height: `${Math.max(4, height * 5)}px` }} key={index} />)}</div></div>)}</aside>;

function App() {
  const route = useMemo(routeFromUrl, []);
  const socket = useRef(null); const boardRef = useRef(emptyBoard()); const pieceRef = useRef(null); const gameRef = useRef({ started: false }); const cursorRef = useRef(0); const groundedRef = useRef(false); const lostRef = useRef(false);
  const [board, setBoard] = useState(boardRef.current); const [piece, setPiece] = useState(null); const [game, setGame] = useState({ started: false, finished: false, players: route.solo ? [{ id: 'solo', name: route.name, alive: true, spectrum: Array(10).fill(0) }] : [] }); const [notice, setNotice] = useState(route.solo ? 'Solo practice mode.' : 'Connecting...');
  const setGameState = useCallback(next => { gameRef.current = typeof next === 'function' ? next(gameRef.current) : next; setGame(gameRef.current); }, []);
  const setBoardState = useCallback(next => { boardRef.current = typeof next === 'function' ? next(boardRef.current) : next; setBoard(boardRef.current); }, []);
  const setPieceState = useCallback(next => { pieceRef.current = next; setPiece(next); }, []);
  const endRound = useCallback(message => {
    if (lostRef.current) return;
    lostRef.current = true; setPieceState(null); setNotice(message);
    setGameState(previous => ({ ...previous, started: false, finished: true }));
    if (!route.solo) socket.current?.emit('player:lost');
  }, [route.solo, setGameState, setPieceState]);
  const requestPiece = useCallback(() => {
    if (route.solo) { const next = spawn(cursorRef.current++); if (collides(boardRef.current, next)) endRound('Game over. Start a new solo round.'); else setPieceState(next); }
    else socket.current?.emit('piece:next');
  }, [endRound, route.solo, setPieceState]);
  const lockCurrent = useCallback(() => {
    const current = pieceRef.current; if (!current) return;
    const result = lock(boardRef.current, current); groundedRef.current = false; setBoardState(result.board); setPieceState(null);
    if (route.solo) setGameState(previous => ({ ...previous, players: [{ id: 'solo', name: route.name, alive: true, spectrum: spectrum(result.board) }] }));
    else { socket.current?.emit('player:update', { spectrum: spectrum(result.board) }); if (result.cleared) socket.current?.emit('player:lines', { count: result.cleared }); }
    requestPiece();
  }, [requestPiece, route.name, route.solo, setBoardState, setGameState, setPieceState]);
  const performMove = useCallback((type) => {
    const current = pieceRef.current; if (!current || lostRef.current || !gameRef.current.started) return;
    if (type === 'drop') { const landing = hardDrop(boardRef.current, current); setPieceState(landing); lockCurrent(); return; }
    const next = type === 'rotate' ? rotatePiece(boardRef.current, current) : move(boardRef.current, current, type, 0);
    groundedRef.current = false; setPieceState(next);
  }, [lockCurrent, setPieceState]);
  const tick = useCallback(() => {
    const current = pieceRef.current; if (!current || !gameRef.current.started || lostRef.current) return;
    if (collides(boardRef.current, current, 0, 1)) { if (groundedRef.current) lockCurrent(); else groundedRef.current = true; return; }
    groundedRef.current = false; setPieceState(move(boardRef.current, current, 0, 1));
  }, [lockCurrent, setPieceState]);
  const startRound = useCallback(() => {
    lostRef.current = false; groundedRef.current = false; cursorRef.current = 0; setBoardState(emptyBoard()); setPieceState(null); setNotice('');
    if (route.solo) { setGameState({ started: true, finished: false, host: 'solo', players: [{ id: 'solo', name: route.name, alive: true, spectrum: Array(10).fill(0) }] }); requestPiece(); }
    else socket.current?.emit(gameRef.current.finished ? 'game:restart' : 'game:start');
  }, [requestPiece, route.name, route.solo, setBoardState, setGameState, setPieceState]);
  useEffect(() => {
    if (route.solo) return undefined;
    const client = io(); socket.current = client;
    client.on('connect', () => { client.emit('game:join', { room: route.room, name: route.name }); setNotice(''); });
    client.on('game:state', next => setGameState(next)); client.on('game:error', setNotice);
    client.on('piece:new', ({ index }) => { const next = spawn(index); if (collides(boardRef.current, next)) endRound('Your field is full.'); else setPieceState(next); });
    client.on('board:penalty', count => setBoardState(current => penalty(current, count)));
    client.on('game:over', winner => { const message = winner === client.id ? 'You win!' : winner ? 'Round complete.' : 'Round ended.'; setNotice(message); setGameState(previous => ({ ...previous, started: false, finished: true, winner })); });
    return () => client.disconnect();
  }, [endRound, route, setBoardState, setGameState, setPieceState]);
  useEffect(() => { const handler = event => { const key = event.key; if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(key)) event.preventDefault(); if (key === 'ArrowLeft') performMove(-1); if (key === 'ArrowRight') performMove(1); if (key === 'ArrowUp') performMove('rotate'); if (key === 'ArrowDown') tick(); if (key === ' ') performMove('drop'); }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler); }, [performMove, tick]);
  useEffect(() => { if (!game.started) return undefined; const timer = window.setInterval(tick, 700); return () => window.clearInterval(timer); }, [game.started, tick]);
  const selfId = route.solo ? 'solo' : socket.current?.id;
  const isHost = route.solo || selfId === game.host;
  const action = game.finished ? 'Restart round' : 'Start round';
  return <main><header><a className="brand" href="/solo">RED<span>TETRIS</span></a><p>{route.solo ? 'Solo mode' : <>Room <b>{route.room}</b></>}</p><p className="status" role="status">{notice}</p></header><section className="game-shell"><div className="play"><div className="board-frame"><Board board={board} piece={piece} /></div><div className="controls"><span>left/right move</span><span>up rotate</span><span>down soft drop</span><span>space hard drop</span></div>{!game.started && <div className="start-card"><h1>{game.finished ? 'Round complete' : `Ready, ${route.name}?`}</h1><p>{route.solo ? 'Practice the full Tetris rules locally.' : 'Every player receives the same sequence. Clear two or more lines to send penalty rows.'}</p>{isHost ? <button onClick={startRound}>{action}</button> : <p>Waiting for the host to start or restart...</p>}</div>}</div><Opponents players={game.players} selfId={selfId} /></section></main>;
}
createRoot(document.getElementById('root')).render(<App />);
