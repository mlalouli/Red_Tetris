export const WIDTH = 10;
export const HEIGHT = 20;
const SPAWN_X = 3;
const SPAWN_Y = -1;
const PENALTY_GAP_OFFSET = 2;
const PENALTY_GAP_STEP = 3;
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

export const spawn = index => {
  const shapeIndex = index % SHAPES.length;
  return { index: shapeIndex, shape: SHAPES[shapeIndex], x: SPAWN_X, y: SPAWN_Y };
};

const isOutsideBoard = (x, y) => x < 0 || x >= WIDTH || y >= HEIGHT;

export const collides = (board, piece, dx = 0, dy = 0, shape = piece.shape) => shape.some((row, shapeY) => row.some((cell, shapeX) => {
  if (!cell) return false;

  const boardX = piece.x + shapeX + dx;
  const boardY = piece.y + shapeY + dy;
  return isOutsideBoard(boardX, boardY) || (boardY >= 0 && board[boardY][boardX]);
}));

export const move = (board, piece, dx, dy) => {
  if (collides(board, piece, dx, dy)) return piece;
  return { ...piece, x: piece.x + dx, y: piece.y + dy };
};

export const rotatePiece = (board, piece) => {
  const rotatedShape = rotate(piece.shape);
  if (collides(board, piece, 0, 0, rotatedShape)) return piece;
  return { ...piece, shape: rotatedShape };
};

export const hardDrop = (board, piece) => {
  let landing = piece;
  while (!collides(board, landing, 0, 1)) {
    landing = { ...landing, y: landing.y + 1 };
  }
  return landing;
};

export const merge = (board, piece) => board.map((row, boardY) => row.map((cell, boardX) => {
  const pieceRow = piece.shape[boardY - piece.y];
  const containsPiece = Boolean(pieceRow?.[boardX - piece.x]);
  return cell || containsPiece ? 1 : 0;
}));

export const clearLines = board => {
  const kept = board.filter(row => !row.every(Boolean));
  const cleared = HEIGHT - kept.length;
  const emptyRows = Array.from({ length: cleared }, () => Array(WIDTH).fill(0));
  return { board: [...emptyRows, ...kept], cleared };
};

export const lock = (board, piece) => clearLines(merge(board, piece));

export const spectrum = board => Array.from({ length: WIDTH }, (_, x) => {
  const firstFilledRow = board.findIndex(row => row[x]);
  return firstFilledRow < 0 ? 0 : HEIGHT - firstFilledRow;
});

const penaltyRow = rowIndex => Array.from(
  { length: WIDTH },
  (_, columnIndex) => columnIndex === (rowIndex * PENALTY_GAP_STEP + PENALTY_GAP_OFFSET) % WIDTH ? 0 : 1
);

export const penalty = (board, count) => [
  ...board.slice(count),
  ...Array.from({ length: count }, (_, rowIndex) => penaltyRow(rowIndex))
];

export const isGameOver = (board, piece) => collides(board, piece);
