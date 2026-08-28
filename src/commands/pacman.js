import { defineCommand } from './define-command.js';

const MAZE = [
  '#################',
  '#P......#......G#',
  '#.###.#.#.#.###.#',
  '#.....#...#.....#',
  '###.#.###.#.#.###',
  '#...#.....#.#...#',
  '#.#.#####.#.###.#',
  '#.#.....#...#...#',
  '#.#####.###.#.#.#',
  '#G............G.#',
  '#################',
];

const DIRECTIONS = {
  up: [-1, 0],
  down: [1, 0],
  left: [0, -1],
  right: [0, 1],
};

const TOKEN_VALUES = ['A', 'I', 'M', 'L', 'R', 'G', 'E', 'V', 'F', 'T', 'C', 'X'];
const GLITCH_GLYPHS = '01<>[]{}#/\\';

function randomGlyph() {
  return GLITCH_GLYPHS[Math.floor(Math.random() * GLITCH_GLYPHS.length)];
}

function positionKey(row, column) {
  return `${row}:${column}`;
}

function isWall(row, column) {
  return !MAZE[row] || MAZE[row][column] === '#';
}

function gameMarkup() {
  return `<div class="pacman" data-pacman tabindex="0" role="application" aria-label="Terminal Pac-Man game. Use arrow keys or W A S D to move.">
    <div class="pacman-head">
      <div><h3>Token-Man</h3><p>Collect tokens and catch all three context ghosts.</p></div>
      <div class="pacman-stats"><span>SCORE <b data-pacman-score>0000</b></span><span>GHOSTS <b data-pacman-caught>0/3</b></span></div>
    </div>
    <div class="pacman-board" data-pacman-board style="--pacman-cols:${MAZE[0].length}" aria-label="Maze"></div>
    <div class="pacman-foot">
      <span data-pacman-status>ready · use arrows or WASD</span>
      <div class="pacman-controls" aria-label="Touch controls">
        <button type="button" data-pacman-direction="up" aria-label="Move up">↑</button>
        <button type="button" data-pacman-direction="left" aria-label="Move left">←</button>
        <button type="button" data-pacman-direction="down" aria-label="Move down">↓</button>
        <button type="button" data-pacman-direction="right" aria-label="Move right">→</button>
      </div>
      <button type="button" class="pacman-restart" data-pacman-restart>restart</button>
    </div>
  </div>`;
}

function initializeGame(root) {
  const board = root.querySelector('[data-pacman-board]');
  const scoreNode = root.querySelector('[data-pacman-score]');
  const caughtNode = root.querySelector('[data-pacman-caught]');
  const statusNode = root.querySelector('[data-pacman-status]');
  const controller = new AbortController();
  let ghostTimer = null;
  let scrambleTimer = null;
  let session = null;

  function render() {
    const ghostAt = new Map(session.ghosts.map((ghost) => [positionKey(ghost.row, ghost.column), ghost]));
    const cells = [];
    MAZE.forEach((line, row) => {
      [...line].forEach((tile, column) => {
        if (tile === '#') {
          cells.push('<span class="pacman-cell wall" aria-hidden="true"></span>');
          return;
        }
        const key = positionKey(row, column);
        const ghost = ghostAt.get(key);
        const token = session.tokens.get(key);
        let content = token ? `<span class="pacman-token${token.settled ? '' : ' decoding'}" data-pacman-token="${key}" aria-label="${token.value} token">${token.display}</span>` : '';
        if (ghost) content = `<span class="pacman-ghost ghost-${ghost.color}" aria-label="Context ghost"><i></i><i></i></span>`;
        if (session.player.row === row && session.player.column === column) content = '<span class="pacman-character" aria-label="Orange player"><i></i><i></i></span>';
        cells.push(`<span class="pacman-cell floor">${content}</span>`);
      });
    });
    board.innerHTML = cells.join('');
    scoreNode.textContent = String(session.score).padStart(4, '0');
    caughtNode.textContent = `${session.caught}/${session.totalGhosts}`;
    statusNode.textContent = session.status;
    root.classList.toggle('won', session.won);
  }

  function stopTimers() {
    window.clearInterval(ghostTimer);
    window.clearInterval(scrambleTimer);
    ghostTimer = null;
    scrambleTimer = null;
  }

  function catchGhosts() {
    const before = session.ghosts.length;
    session.ghosts = session.ghosts.filter((ghost) => ghost.row !== session.player.row || ghost.column !== session.player.column);
    const caughtNow = before - session.ghosts.length;
    if (!caughtNow) return;
    session.caught += caughtNow;
    session.score += caughtNow * 250;
    session.status = 'ghost caught · +250';
    if (!session.ghosts.length) {
      session.won = true;
      session.status = `all context caught · final score ${session.score}`;
      stopTimers();
    }
  }

  function move(direction) {
    const delta = DIRECTIONS[direction];
    if (!delta || session.won) return;
    const row = session.player.row + delta[0];
    const column = session.player.column + delta[1];
    if (isWall(row, column)) {
      session.status = 'wall · rerouting';
      render();
      return;
    }
    session.player = { row, column };
    const key = positionKey(row, column);
    const token = session.tokens.get(key);
    if (token) {
      session.tokens.delete(key);
      session.score += 10;
      session.status = `${token.value} token collected · +10`;
    } else {
      session.status = 'chasing context ghosts';
    }
    catchGhosts();
    render();
  }

  function moveGhosts() {
    if (session.won || !root.matches(':focus-within')) return;
    const occupied = new Set();
    session.ghosts.forEach((ghost) => {
      const choices = Object.values(DIRECTIONS)
        .map(([rowDelta, columnDelta]) => ({ row: ghost.row + rowDelta, column: ghost.column + columnDelta }))
        .filter(({ row, column }) => !isWall(row, column))
        .filter(({ row, column }) => row !== session.player.row || column !== session.player.column)
        .filter(({ row, column }) => !occupied.has(positionKey(row, column)));
      if (!choices.length) return;
      const currentDistance = Math.abs(ghost.row - session.player.row) + Math.abs(ghost.column - session.player.column);
      const escaping = choices.filter(({ row, column }) => Math.abs(row - session.player.row) + Math.abs(column - session.player.column) >= currentDistance);
      const pool = escaping.length && Math.random() < 0.7 ? escaping : choices;
      const next = pool[Math.floor(Math.random() * pool.length)];
      ghost.row = next.row;
      ghost.column = next.column;
      occupied.add(positionKey(ghost.row, ghost.column));
    });
    render();
  }

  function scrambleTokens() {
    let unfinished = false;
    session.tokens.forEach((token, key) => {
      if (token.settled) return;
      token.step += 1;
      token.display = token.step > 3 ? token.value : randomGlyph();
      token.settled = token.display === token.value;
      unfinished ||= !token.settled;
      const node = board.querySelector(`[data-pacman-token="${key}"]`);
      if (node) {
        node.textContent = token.display;
        node.classList.toggle('decoding', !token.settled);
      }
    });
    if (!unfinished) window.clearInterval(scrambleTimer);
  }

  function start() {
    stopTimers();
    const tokens = new Map();
    const ghosts = [];
    let player = null;
    let tokenIndex = 0;
    MAZE.forEach((line, row) => {
      [...line].forEach((tile, column) => {
        if (tile === '.' && tokenIndex % 2 === 0) {
          const value = TOKEN_VALUES[tokenIndex % TOKEN_VALUES.length];
          tokens.set(positionKey(row, column), { value, display: randomGlyph(), step: 0, settled: false });
        }
        if (tile === '.') tokenIndex += 1;
        if (tile === 'P') player = { row, column };
        if (tile === 'G') ghosts.push({ row, column, color: ghosts.length % 3 });
      });
    });
    session = {
      player,
      ghosts,
      tokens,
      score: 0,
      caught: 0,
      totalGhosts: ghosts.length,
      status: 'ready · use arrows or WASD',
      won: false,
    };
    render();
    scrambleTimer = window.setInterval(scrambleTokens, 110);
    ghostTimer = window.setInterval(moveGhosts, 720);
    root.focus({ preventScroll: true });
  }

  root.addEventListener('keydown', (event) => {
    const direction = {
      arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down',
      arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right',
    }[event.key.toLowerCase()];
    if (direction) {
      event.preventDefault();
      move(direction);
    } else if (event.key.toLowerCase() === 'r') {
      event.preventDefault();
      start();
    }
  }, { signal: controller.signal });

  root.addEventListener('click', (event) => {
    const directionButton = event.target.closest('[data-pacman-direction]');
    if (directionButton) move(directionButton.dataset.pacmanDirection);
    if (event.target.closest('[data-pacman-restart]')) start();
    root.focus({ preventScroll: true });
  }, { signal: controller.signal });

  start();
  return () => {
    controller.abort();
    stopTimers();
  };
}

export default defineCommand({
  name: '/pacman',
  description: 'Play the terminal token maze',
  aliases: ['/token-man'],
  render: gameMarkup,
  onRender: ({ panel }) => {
    panel.classList.add('pacman-output');
    document.body.classList.add('pacman-active');
    const stop = initializeGame(panel.querySelector('[data-pacman]'));
    return () => {
      stop();
      document.body.classList.remove('pacman-active');
    };
  },
});
