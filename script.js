console.log('script.js loaded!'); // 読み込み確認

// ボードの状態: 4x5配列、空はnull
let board = [
  [null, null, null, null, null],
  [null, null, null, null, null],
  [null, null, null, null, null],
  [null, null, null, null, null]
];
let currentPlayer = 'player';
const status = document.getElementById('status');
const boardEl = document.getElementById('board');
const resetBtn = document.getElementById('reset');

console.log('Initial board:', board); // 初期board確認

function getMark(player) {
    if (player === 'player') return '○';
    if (player === 'ai1') return '✕';
    if (player === 'ai2') return '神';
    return '';
}

function getNextPlayer(current) {
    if (current === 'player') return 'ai1';
    if (current === 'ai1') return 'ai2';
    if (current === 'ai2') return 'player';
    return current;
}

function getEmptyCells(b) {
    const cells = [];
    for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 5; c++) {
            if (!b[r][c]) cells.push([r, c]);
        }
    }
    return cells;
}

function getWinner(b) {
    // 勝者を返す：'player', 'ai1', 'ai2', またはnull
    const players = ['player', 'ai1', 'ai2'];
    for (let player of players) {
        if (checkWin(b, player)) return player;
    }
    return null;
}

// 脅威評価: 簡略版 - playerの脅威を重く (必勝法対策強化)
function evaluateThreats(board, player) {
    let threats = 0;
    const multiplier = player === 'player' ? 3 : 1; // player脅威3倍重く (フォーク検知↑)
    // 横の2連続 (簡略: 境界安全)
    for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 3; col++) {  // col <3 (col+2 <5)
            if (board[row] && board[row][col] === player && board[row][col+1] === player && !board[row][col+2]) threats += 2 * multiplier;
            if (board[row] && !board[row][col] && board[row][col+1] === player && board[row][col+2] === player) threats += 2 * multiplier;
        }
    }
    // 縦の2連続
    for (let col = 0; col < 5; col++) {
        for (let row = 0; row < 2; row++) {
            if (board[row] && board[row][col] === player && board[row+1] && board[row+1][col] === player && !board[row+2][col]) threats += 2 * multiplier;
            if (board[row] && !board[row][col] && board[row+1] && board[row+1][col] === player && board[row+2] && board[row+2][col] === player) threats += 2 * multiplier;
        }
    }
    // 斜め左上
    for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 3; col++) {  // col <3 (col+2 <5)
            if (board[row] && board[row][col] === player && board[row+1] && board[row+1][col+1] === player && !board[row+2][col+2]) threats += 2 * multiplier;
            if (board[row] && !board[row][col] && board[row+1] && board[row+1][col+1] === player && board[row+2] && board[row+2][col+2] === player) threats += 2 * multiplier;
        }
    }
    // 斜め右上
    for (let row = 0; row < 2; row++) {
        for (let col = 2; col < 5; col++) {  // col <5 (col-2 >=0)
            if (board[row] && board[row][col] === player && board[row+1] && board[row+1][col-1] === player && !board[row+2][col-2]) threats += 2 * multiplier;
            if (board[row] && !board[row][col] && board[row+1] && board[row+1][col-1] === player && board[row+2] && board[row+2][col-2] === player) threats += 2 * multiplier;
        }
    }
    return threats;
}

// 即時勝ち/ブロックチェック
function canWinImmediately(board, player) {
    const empties = getEmptyCells(board);
    for (let [r, c] of empties) {
        board[r][c] = player;
        if (checkWin(board, player)) {
            board[r][c] = null;
            return [r, c];
        }
        board[r][c] = null;
    }
    return null;
}

function canBlockImmediately(board, opponent) {
    return canWinImmediately(board, opponent);
}

// 2手先ブロック: 強化 - 複数脅威をすべてリスト、優先度付け (player脅威優先強化)
function getCriticalBlocks(board, aiPlayer) {
    const nextOpponent = getNextPlayer(aiPlayer);
    const opponentWins = [];
    const empties = getEmptyCells(board);
    for (let [r, c] of empties) {
        board[r][c] = nextOpponent;
        if (checkWin(board, nextOpponent)) {
            opponentWins.push([r, c]);
        }
        board[r][c] = null;
    }
    if (opponentWins.length === 0) return null;
    // 複数なら、1手で最多カバー位置を探す (playerなら3倍重く)
    let bestCover = null;
    let maxCovers = 0;
    for (let [r, c] of empties) {
        let covers = 0;
        for (let threat of opponentWins) {
            if (threat[0] === r && threat[1] === c) covers++;
        }
        const threatWeight = nextOpponent === 'player' ? covers * 3 : covers; // player脅威3倍
        if (threatWeight > maxCovers) {
            maxCovers = threatWeight;
            bestCover = [r, c];
        }
    }
    return bestCover || opponentWins[Math.floor(Math.random() * opponentWins.length)];
}

// 3手先脅威チェック (妨害強化、player優先)
function getThreeStepThreats(board, aiPlayer) {
    const nextOpp = getNextPlayer(aiPlayer);
    const nextNext = getNextPlayer(nextOpp);
    let threats = [];
    const empties = getEmptyCells(board);
    for (let [r, c] of empties) {
        board[r][c] = nextOpp;
        const afterOpp = canWinImmediately(board, nextNext);
        board[r][c] = null;
        if (afterOpp) threats.push(afterOpp);
    }
    // player脅威なら最優先 (複数ならランダム)
    const playerThreats = threats.filter(t => nextNext === 'player');
    return playerThreats.length > 0 ? playerThreats[Math.floor(Math.random() * playerThreats.length)] : (threats.length > 0 ? threats[0] : null);
}

// 必勝法特定パターン検知 (この配置似のフォークをブロック優先)
function detectForkPattern(board, aiPlayer) {
    // 例: row0 col1=○, row1 col2=○, row2 col1=○, row3 col0=神 などのキー配置チェック
    if (board[0][1] === '○' && board[1][2] === '○' && board[2][1] === '○' && board[3][0] === 'ai2' && board[0][3] === 'ai1') {
        // フォーク脅威位置 (2,3) などブロック
        const forkBlock = [2, 3]; // この一手ブロック
        if (!board[2][3]) return forkBlock;
    }
    return null;
}

// 3人用Minimax: AI視点で自分のターンmax、他ターンmin - 妨害特化
function minimax(board, depth, alpha, beta, currentTurn, aiPlayer) {
    if (depth === 0) {
        // ヒューリスティック強化: player脅威超ペナルティ
        const myThreats = evaluateThreats(board, aiPlayer);
        const opp1Threats = evaluateThreats(board, getNextPlayer(aiPlayer));
        const opp2Threats = evaluateThreats(board, getNextPlayer(getNextPlayer(aiPlayer)));
        const mobility = getEmptyCells(board).length;
        // player (opp1 if ai1/ai2ターン) を-500に超重く
        const playerPenalty = getNextPlayer(aiPlayer) === 'player' ? opp1Threats * 500 : (getNextPlayer(getNextPlayer(aiPlayer)) === 'player' ? opp2Threats * 500 : 0);
        return myThreats * 200 + mobility * 5 - playerPenalty - (opp1Threats + opp2Threats) * 300;
    }

    const winner = getWinner(board);
    if (winner) {
        const baseScore = winner === aiPlayer ? 5000 : -5000;
        return baseScore + (winner === aiPlayer ? -depth * 50 : depth * 50);
    }
    if (isFull(board)) return -10;

    const isMax = (currentTurn === aiPlayer);
    let best = isMax ? -Infinity : Infinity;

    const emptyCells = getEmptyCells(board);
    // 手をソート: 簡略 - 中心優先のみ
    emptyCells.sort((a, b) => {
        const centerDistA = Math.abs(a[0] - 1.5) + Math.abs(a[1] - 2.5);
        const centerDistB = Math.abs(b[0] - 1.5) + Math.abs(b[1] - 2.5);
        return centerDistA - centerDistB;
    });

    for (let [r, c] of emptyCells) {
        board[r][c] = currentTurn;
        const nextTurn = getNextPlayer(currentTurn);
        let score = minimax(board, depth - 1, alpha, beta, nextTurn, aiPlayer);
        board[r][c] = null;

        if (isMax) {
            best = Math.max(best, score);
            alpha = Math.max(alpha, best);
        } else {
            best = Math.min(best, score);
            beta = Math.min(beta, best);
        }
        if (beta <= alpha) break;
    }
    return best;
}

function getBestMove(board, aiPlayer) {
    const emptyCells = getEmptyCells(board);
    if (emptyCells.length === 0) return null;

    // 即時勝ちチェック
    let immediateWin = canWinImmediately(board, aiPlayer);
    if (immediateWin) {
        console.log(`Immediate win for ${aiPlayer} at`, immediateWin);
        return immediateWin;
    }

    // 必勝法特定パターン検知 (即ブロック)
    let forkBlock = detectForkPattern(board, aiPlayer);
    if (forkBlock) {
        console.log(`Fork pattern block for ${aiPlayer} at`, forkBlock);
        return forkBlock;
    }

    // 2手先ブロックチェック (複数脅威対応強化)
    let criticalBlock = getCriticalBlocks(board, aiPlayer);
    if (criticalBlock) {
        console.log(`Critical block for next opponent at`, criticalBlock);
        return criticalBlock;
    }

    // 3手先脅威チェック (妨害強化)
    let threeStepBlock = getThreeStepThreats(board, aiPlayer);
    if (threeStepBlock) {
        console.log(`Three-step block for ${aiPlayer} at`, threeStepBlock);
        return threeStepBlock;
    }

    // 即時ブロック
    const nextOpponent = getNextPlayer(aiPlayer);
    let immediateBlock = canBlockImmediately(board, nextOpponent);
    if (immediateBlock) {
        console.log(`Blocking ${nextOpponent} at`, immediateBlock);
        return immediateBlock;
    }

    // 固定depth: 微増でフォーク予測 (重さギリOK)
    let depth = 6; // ×=6、神=7
    if (aiPlayer === 'ai2') depth = 7;

    console.log(`Computing best move for ${aiPlayer}, depth=${depth}, empty=${emptyCells.length}`);

    let bestScore = -Infinity;
    let bestMoves = [];

    const sortedCells = [...emptyCells].sort((a, b) => {
        // 簡略ソート: 中心優先のみ
        const centerDistA = Math.abs(a[0] - 1.5) + Math.abs(a[1] - 2.5);
        const centerDistB = Math.abs(b[0] - 1.5) + Math.abs(b[1] - 2.5);
        return centerDistA - centerDistB;
    });

    for (let [r, c] of sortedCells) {
        board[r][c] = aiPlayer;
        let score = minimax(board, depth, -Infinity, Infinity, getNextPlayer(aiPlayer), aiPlayer);
        board[r][c] = null;

        if (score > bestScore) {
            bestScore = score;
            bestMoves = [[r, c]];
        } else if (score === bestScore) {
            bestMoves.push([r, c]);
        }
    }

    const bestMove = bestMoves[Math.floor(Math.random() * bestMoves.length)];
    console.log(`Best score: ${bestScore}, Move: ${bestMove}`);
    return bestMove;
}

function renderBoard() {
    console.log('renderBoard called, currentPlayer:', currentPlayer); // ログ
    boardEl.innerHTML = ''; // クリア
    for (let row = 0; row < 4; row++) {
        console.log('Rendering row:', row, 'board[row]:', board[row]); // 行ログ
        if (board[row] === undefined) {
            console.error('board[row] undefined in renderBoard at row=', row);
            continue;
        }
        for (let col = 0; col < 5; col++) {  // col <5
            console.log('Rendering cell:', row, col, 'value:', board[row][col]); // セルログ
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.dataset.row = row.toString(); // string保証
            cell.dataset.col = col.toString(); // string保証
            cell.textContent = board[row][col] ? getMark(board[row][col]) : '';
            if (currentPlayer === 'player' && !board[row][col]) {
                console.log('Adding click listener to cell', row, col); // リスナー追加ログ
                cell.addEventListener('click', handleClick);
            } else {
                cell.disabled = true;
            }
            boardEl.appendChild(cell);
        }
    }
    status.textContent = currentPlayer === 'player' ? 'あなたのターン (○)！' :
                         currentPlayer === 'ai1' ? '✕のターン...（考え中）' :
                         '神のターン...（考え中）';
}

function handleClick(e) {
    console.log('handleClick called! e.target:', e.target); // クリック確認
    const rowStr = e.target.dataset.row;
    const colStr = e.target.dataset.col;
    console.log('dataset row/col:', rowStr, colStr); // データセット確認
    const row = parseInt(rowStr, 10);
    const col = parseInt(colStr, 10);
    console.log('parsed row/col:', row, col); // パース確認
    if (isNaN(row) || isNaN(col) || row < 0 || row >= 4 || col < 0 || col >= 5 || board[row][col] || currentPlayer !== 'player') {  // col >=5
        console.log('Click invalid, return'); // 無効確認
        return;
    }

    // 置いた人を覚えておく
    const placedPlayer = currentPlayer;
    board[row][col] = placedPlayer;
    console.log('Player placed at:', row, col); // 置いた確認

    // 置いたあとすぐに次の人に切り替え
    currentPlayer = getNextPlayer(currentPlayer);
    renderBoard();  // 今のターン（次の人）で更新 → ステータスとリスナーが正しくなる

    // 置いた人（前の人）の勝ちをチェック
    if (checkWin(board, placedPlayer)) return announceWin(placedPlayer);
    if (isFull(board)) return announceDraw();

    // 次がAIなら動かす（もうcurrentPlayerは次の人）
    if (currentPlayer !== 'player') {
        setTimeout(aiMove, 500);
    }
}

function aiMove() {
    console.log('aiMove called, currentPlayer:', currentPlayer);
    
    // Minimaxで最善手を計算
    const bestMove = getBestMove(board, currentPlayer);
    if (!bestMove) {
        console.log('No moves available');
        return;
    }
    const [row, col] = bestMove;
    console.log('Best move selected:', row, col);

    if (isNaN(row) || isNaN(col) || row < 0 || row >= 4 || col < 0 || col >= 5) {  // col >=5
        console.error('Invalid row/col:', row, col);
        return;
    }

    if (board[row] === undefined) {
        console.error('board[row] undefined at row=', row);
        return;
    }

    // 置いた人を覚えておく
    const placedPlayer = currentPlayer;
    board[row][col] = placedPlayer;
    console.log('AI placed at:', row, col);

    // 置いたあとすぐに次の人に切り替え
    currentPlayer = getNextPlayer(currentPlayer);
    renderBoard();  // 今のターン（次の人）で更新

    // 置いた人（前の人）の勝ちをチェック
    if (checkWin(board, placedPlayer)) return announceWin(placedPlayer);
    if (isFull(board)) return announceDraw();

    // 次がAIなら動かす
    if (currentPlayer !== 'player') {
        setTimeout(aiMove, 500);
    }
}

function checkWin(b, player) {
    // 横 (3連続、col <=2)
    for (let row = 0; row < 4; row++) {
        for (let col = 0; col <= 2; col++) {  // col <=2 (col+2 <5)
            if (b[row] && b[row][col] === player && b[row][col+1] === player && b[row][col+2] === player) return true;
        }
    }
    // 縦
    for (let col = 0; col < 5; col++) {
        for (let row = 0; row <= 1; row++) {
            if (b[row] && b[row][col] === player && b[row+1] && b[row+1][col] === player && b[row+2] && b[row+2][col] === player) return true;
        }
    }
    // 斜め左上
    for (let row = 0; row <= 1; row++) {
        for (let col = 0; col <= 2; col++) {  // col <=2 (col+2 <5)
            if (b[row] && b[row][col] === player && b[row+1] && b[row+1][col+1] === player && b[row+2] && b[row+2][col+2] === player) return true;
        }
    }
    // 斜め右上
    for (let row = 0; row <= 1; row++) {
        for (let col = 2; col < 5; col++) {  // col >=2 (col-2 >=0)
            if (b[row] && b[row][col] === player && b[row+1] && b[row+1][col-1] === player && b[row+2] && b[row+2][col-2] === player) return true;
        }
    }
    return false;
}

function isFull(b) {
    for (let row = 0; row < 4; row++) {
        if (b[row] === undefined) return false;
        for (let col = 0; col < 5; col++) {  // col <5
            if (!b[row][col]) return false;
        }
    }
    return true;
}

function announceWin(player) {
    const mark = getMark(player);
    status.textContent = `${mark} の勝ち！`;
    boardEl.querySelectorAll('.cell').forEach(cell => {
        cell.style.pointerEvents = 'none';
        cell.disabled = true;
    });
}

function announceDraw() {
    status.textContent = '引き分け！';
    boardEl.querySelectorAll('.cell').forEach(cell => {
        cell.style.pointerEvents = 'none';
        cell.disabled = true;
    });
}

resetBtn.addEventListener('click', () => {
    board = [
      [null, null, null, null, null],
      [null, null, null, null, null],
      [null, null, null, null, null],
      [null, null, null, null, null]
    ];
    currentPlayer = 'player';
    renderBoard();
    status.textContent = 'あなたのターン (○)！';
});

console.log('Initial render'); // 初期ログ
renderBoard();