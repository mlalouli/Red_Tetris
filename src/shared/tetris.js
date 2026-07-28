export const WIDTH = 10;
export const HEIGHT = 20;
export const SHAPES = [
  [[1, 1, 1, 1]], // I
  [[1, 0, 0], [1, 1, 1]], // J
  [[0, 0, 1], [1, 1, 1]], // L
  [[1, 1], [1, 1]], // O
  [[0, 1, 1], [1, 1, 0]], // S
  [[0, 1, 0], [1, 1, 1]], // T
  [[1, 1, 0], [0, 1, 1]] // Z
];

export const emptyBoard = () => Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(0));
export const rotate = shape => shape[0].map((_, x) => shape.map(row => row[x]).reverse());
export const spawn = index => ({ index: index % SHAPES.length, shape: SHAPES[index % SHAPES.length], x: 3, y: -1 });
export const collides = (board, piece, dx = 0, dy = 0, shape = piece.shape) => shape.some((row, y) => row.some((cell, x) => {
  if (!cell) return false;
  const targetX = piece.x + x + dx;
  const targetY = piece.y + y + dy;
  return targetX < 0 || targetX >= WIDTH || targetY >= HEIGHT || (targetY >= 0 && board[targetY][targetX]);
}));
export const move = (board, piece, dx, dy) => collides(board, piece, dx, dy) ? piece : { ...piece, x: piece.x + dx, y: piece.y + dy };
export const rotatePiece = (board, piece) => {
  const shape = rotate(piece.shape);
  return collides(board, piece, 0, 0, shape) ? piece : { ...piece, shape };
};
export const hardDrop = (board, piece) => {
  let landing = piece;
  while (!collides(board, landing, 0, 1)) landing = { ...landing, y: landing.y + 1 };
  return landing;
};
export const merge = (board, piece) => board.map((row, y) => row.map((cell, x) => {
  const pieceRow = piece.shape[y - piece.y];
  return cell || Boolean(pieceRow?.[x - piece.x]) ? 1 : 0;
}));
export const clearLines = board => {
  const kept = board.filter(row => !row.every(Boolean));
  const cleared = HEIGHT - kept.length;
  return { board: [...Array.from({ length: cleared }, () => Array(WIDTH).fill(0)), ...kept], cleared };
};
export const lock = (board, piece) => clearLines(merge(board, piece));
export const spectrum = board => Array.from({ length: WIDTH }, (_, x) => {
  const y = board.findIndex(row => row[x]);
  return y < 0 ? 0 : HEIGHT - y;
});
export const penalty = (board, count) => [...board.slice(count), ...Array.from({ length: count }, (_, row) => Array.from({ length: WIDTH }, (_, x) => x === (row * 3 + 2) % WIDTH ? 0 : 1))];
export const isGameOver = (board, piece) => collides(board, piece);
