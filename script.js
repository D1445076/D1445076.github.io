/* ============================================================
   Gomoku / 五子棋  –  script.js
   15×15 board, 2-player local, pure HTML/CSS/JS
   ============================================================ */

(function () {
  'use strict';

  /* ── Constants ─────────────────────────────────────────── */
  const BOARD_SIZE   = 15;
  const WIN_COUNT    = 5;
  const CELL_SIZE    = 36;   // px – base size, clamped for small screens

  /* star (花心) positions on a 15×15 board (0-indexed) */
  const STAR_POINTS = new Set([
    '3,3','3,11','7,7','11,3','11,11'
  ]);

  /* ── State ──────────────────────────────────────────────── */
  let board      = [];   // 2D array: null | 'black' | 'white'
  let currentTurn = 'black';
  let gameOver   = false;

  /* ── DOM refs ───────────────────────────────────────────── */
  const boardEl        = document.getElementById('board');
  const statusTextEl   = document.getElementById('status-text');
  const blackIndicator = document.getElementById('black-indicator');
  const whiteIndicator = document.getElementById('white-indicator');
  const winOverlay     = document.getElementById('win-overlay');
  const winTitleEl     = document.getElementById('win-title');
  const winStoneIcon   = document.getElementById('win-stone-icon');
  const btnRestart     = document.getElementById('btn-restart');
  const btnRestartOvl  = document.getElementById('btn-restart-overlay');

  /* ── Init ───────────────────────────────────────────────── */
  function init () {
    board       = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
    currentTurn = 'black';
    gameOver    = false;

    winOverlay.classList.add('hidden');
    buildBoard();
    updateStatus();
  }

  /* ── Build DOM board ────────────────────────────────────── */
  function buildBoard () {
    boardEl.innerHTML = '';

    /* Calculate cell size based on viewport */
    const vw = Math.min(window.innerWidth, 700);
    const available = vw - 24 - 36;   /* subtract page padding + board padding */
    const cellPx = Math.max(22, Math.min(CELL_SIZE, Math.floor(available / BOARD_SIZE)));

    boardEl.style.gridTemplateColumns = `repeat(${BOARD_SIZE}, ${cellPx}px)`;
    boardEl.style.gridTemplateRows    = `repeat(${BOARD_SIZE}, ${cellPx}px)`;

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.r = r;
        cell.dataset.c = c;
        cell.setAttribute('role', 'gridcell');
        cell.setAttribute('aria-label', `列${r + 1} 行${c + 1}`);

        /* Edge trimming classes */
        if (r === 0)              cell.classList.add('edge-top');
        if (r === BOARD_SIZE - 1) cell.classList.add('edge-bottom');
        if (c === 0)              cell.classList.add('edge-left');
        if (c === BOARD_SIZE - 1) cell.classList.add('edge-right');

        /* Star points */
        if (STAR_POINTS.has(`${r},${c}`)) {
          cell.classList.add('star-point');
          const hoshi = document.createElement('span');
          hoshi.className = 'hoshi';
          cell.appendChild(hoshi);
        }

        /* Ghost stone for hover preview */
        const ghost = document.createElement('span');
        ghost.className = 'ghost';
        cell.appendChild(ghost);

        cell.addEventListener('click', onCellClick);
        cell.addEventListener('mouseenter', onCellEnter);
        cell.addEventListener('mouseleave', onCellLeave);

        boardEl.appendChild(cell);
      }
    }
  }

  /* ── Get cell element ───────────────────────────────────── */
  function getCell (r, c) {
    return boardEl.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
  }

  /* ── Hover handlers ─────────────────────────────────────── */
  function onCellEnter (e) {
    if (gameOver) return;
    const cell = e.currentTarget;
    const r = +cell.dataset.r, c = +cell.dataset.c;
    if (board[r][c]) return;
    const ghost = cell.querySelector('.ghost');
    ghost.className = `ghost ghost-${currentTurn}`;
  }

  function onCellLeave (e) {
    const ghost = e.currentTarget.querySelector('.ghost');
    if (ghost) ghost.className = 'ghost';
  }

  /* ── Click handler ──────────────────────────────────────── */
  function onCellClick (e) {
    if (gameOver) return;
    const cell = e.currentTarget;
    const r = +cell.dataset.r, c = +cell.dataset.c;

    if (board[r][c]) return;   /* already occupied */

    /* Place stone */
    board[r][c] = currentTurn;
    cell.classList.add('occupied');

    /* Clear ghost */
    const ghost = cell.querySelector('.ghost');
    if (ghost) ghost.className = 'ghost';

    /* Render stone */
    const stone = document.createElement('span');
    stone.className = `stone ${currentTurn} pop`;
    cell.appendChild(stone);

    /* Check win */
    const winCells = checkWin(r, c, currentTurn);
    if (winCells.length >= WIN_COUNT) {
      highlightWinners(winCells);
      endGame(currentTurn);
      return;
    }

    /* Check draw */
    if (isDraw()) {
      endGame(null);
      return;
    }

    /* Switch turn */
    currentTurn = currentTurn === 'black' ? 'white' : 'black';
    updateStatus();
  }

  /* ── Render stone on board (for rebuild after resize) ───── */
  function renderStones () {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (!board[r][c]) continue;
        const cell = getCell(r, c);
        cell.classList.add('occupied');
        const stone = document.createElement('span');
        stone.className = `stone ${board[r][c]}`;
        cell.appendChild(stone);
      }
    }
  }

  /* ── Win check ──────────────────────────────────────────── */
  const DIRECTIONS = [
    [0, 1],   // horizontal
    [1, 0],   // vertical
    [1, 1],   // diagonal ↘
    [1, -1],  // diagonal ↙
  ];

  function checkWin (r, c, color) {
    for (const [dr, dc] of DIRECTIONS) {
      const line = [[r, c]];

      for (let step = 1; step < WIN_COUNT; step++) {
        const nr = r + dr * step, nc = c + dc * step;
        if (inBounds(nr, nc) && board[nr][nc] === color) line.push([nr, nc]);
        else break;
      }
      for (let step = 1; step < WIN_COUNT; step++) {
        const nr = r - dr * step, nc = c - dc * step;
        if (inBounds(nr, nc) && board[nr][nc] === color) line.push([nr, nc]);
        else break;
      }

      if (line.length >= WIN_COUNT) return line;
    }
    return [];
  }

  function inBounds (r, c) {
    return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
  }

  function isDraw () {
    return board.every(row => row.every(cell => cell !== null));
  }

  /* ── Highlight winning stones ───────────────────────────── */
  function highlightWinners (cells) {
    cells.forEach(([r, c]) => {
      const stone = getCell(r, c).querySelector('.stone');
      if (stone) stone.classList.add('winning');
    });
  }

  /* ── Game end ───────────────────────────────────────────── */
  function endGame (winner) {
    gameOver = true;

    if (winner) {
      const label = winner === 'black' ? '黑棋' : '白棋';
      statusTextEl.textContent = `🎉 ${label}獲勝！`;
      winTitleEl.textContent   = `${label}獲勝！`;
      winStoneIcon.className   = `big-stone ${winner}`;
    } else {
      statusTextEl.textContent = '平局！棋盤已下滿';
      winTitleEl.textContent   = '平局！';
      winStoneIcon.className   = 'big-stone';
      winStoneIcon.style.background = 'linear-gradient(135deg, #333 50%, #eee 50%)';
    }

    blackIndicator.classList.remove('active');
    whiteIndicator.classList.remove('active');

    /* Small delay before showing overlay so pop animation finishes */
    setTimeout(() => winOverlay.classList.remove('hidden'), 480);
  }

  /* ── Update status bar ──────────────────────────────────── */
  function updateStatus () {
    if (currentTurn === 'black') {
      statusTextEl.textContent = '黑棋落子中…';
      blackIndicator.classList.add('active');
      whiteIndicator.classList.remove('active');
    } else {
      statusTextEl.textContent = '白棋落子中…';
      whiteIndicator.classList.add('active');
      blackIndicator.classList.remove('active');
    }
  }

  /* ── Restart ────────────────────────────────────────────── */
  function restart () {
    init();
  }

  /* ── Responsive rebuild on resize ──────────────────────── */
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      buildBoard();
      renderStones();

      /* Re-apply indicators */
      if (!gameOver) updateStatus();

      /* Re-highlight winners if game already over (not trivial, skip) */
    }, 200);
  });

  /* ── Event bindings ─────────────────────────────────────── */
  btnRestart.addEventListener('click', restart);
  btnRestartOvl.addEventListener('click', restart);

  /* ── Start ──────────────────────────────────────────────── */
  init();

})();
