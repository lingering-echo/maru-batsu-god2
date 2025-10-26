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

// 脅威評価: 簡略版 - 呼び出しを減らすため、Minimaxの葉でのみ使用
function evaluateThreats(board, player) {
    let threats = 0;
    // 横の2連続 (簡略: 境界安全)
    for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 3; col++) {  // col <3 (col+2 <5)
            if (board[row] && board[row][col] === player && board[row][col+1] === player && !board[row][col+2]) threats += 2;
            if (board[row] && !board[row][col] && board[row][col+1] === player && board[row][col+2] === player) threats += 2;
        }
    }
    // 縦の2連続
    for (let col = 0; col < 5; col++) {
        for (let row = 0; row < 2; row++) {
            if (board[row] && board[row][col] === player && board[row+1] && board[row+1][col] === player && !board[row+2][col]) threats += 2;
            if (board[row] && !board[row][col] && board[row+1] && board[row+1][col] === player && board[row+2] && board[row+2][col] === player) threats += 2;
        }
    }
    // 斜め左上
    for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 3; col++) {  // col <3 (col+2 <5)
            if (board[row] && board[row][col] === player && board[row+1] && board[row+1][col+1] === player && !board[row+2][col+2]) threats += 2;
            if (board[row] && !board[row][col] && board[row+1] && board[row+1][col+1] === player && board[row+2] && board[row+2][col+2] === player) threats += 2;
        }
    }
    // 斜め右上
    for (let row = 0; row < 2; row++) {
        for (let col = 2; col < 5; col++) {  // col <5 (col-2 >=0)
            if (board[row] && board[row][col] === player && board[row+1] && board[row+1][col-1] === player && !board[row+2][col-2]) threats += 2;
            if (board[row] && !board[row][col] && board[row+1] && board[row+1][col-1] === player && board[row+2] && board[row+2][col-2] === player) threats += 2;
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

// 2手先ブロック: 強化 - 複数脅威をすべてリスト、優先度付け
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
    // 複数なら、1手で最多カバー位置を探す
    let bestCover = null;
    let maxCovers = 0;
    for (let [r, c] of empties) {
        let covers = 0;
        for (let threat of opponentWins) {
            if (threat[0] === r && threat[1] === c) covers++;
        }
        if (covers > maxCovers) {
            maxCovers = covers;
            bestCover = [r, c];
        }
    }
    return bestCover || opponentWins[Math.floor(Math.random() * opponentWins.length)];
}

// 3手先脅威チェック (妨害強化)
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
    return threats.length > 0 ? threats[0] : null;
}

// 3人用Minimax: AI視点で自分のターンmax、他ターンmin - 妨害特化
function minimax(board, depth, alpha, beta, currentTurn, aiPlayer) {
    if (depth === 0) {
        // ヒューリスティック強化: 妨害重視 - 相手脅威超ペナルティ、自分の脅威大ボーナス
        const myThreats = evaluateThreats(board, aiPlayer);
        const opp1Threats = evaluateThreats(board, getNextPlayer(aiPlayer));
        const opp2Threats = evaluateThreats(board, getNextPlayer(getNextPlayer(aiPlayer)));
        const mobility = getEmptyCells(board).length; // 移動性ボーナス
        return myThreats * 200 + mobility * 5 - opp1Threats * 300 - opp2Threats * 300;
    }

    const winner = getWinner(board);
    if (winner) {
        // 妨害特化: 相手勝ちを極大ペナルティ、自分の勝ち超ボーナス
        const baseScore = winner === aiPlayer ? 5000 : -5000;
        return baseScore + (winner === aiPlayer ? -depth * 50 : depth * 50); // 早い妨害/勝ちを優先
    }
    if (isFull(board)) return -10; // 引き分け軽ペナルティ (勝ち妨害より)

    const isMax = (currentTurn === aiPlayer);
    let best = isMax ? -Infinity : Infinity;

    const emptyCells = getEmptyCells(board);
    // 手をソート: 簡略 - 中心優先のみ (evaluateThreats呼び出し削除で負荷減)
    emptyCells.sort((a, b) => {
        const centerDistA = Math.abs(a[0] - 1.5) + Math.abs(a[1] - 2.5);  // 中心調整 (5列)
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

    // 固定depth: フリーズなし賢さ (5固定で速く、数手先読み)
    let depth = 5; // 安全ライン: 0.1-0.3秒、2-3手先読み
    if (aiPlayer === 'ai2') depth = 6; // 神少し深く

    console.log(`Computing best move for ${aiPlayer}, depth=${depth}, empty=${emptyCells.length}`);

    let bestScore = -Infinity;
    let bestMoves = [];

    const sortedCells = [...emptyCells].sort((a, b) => {
        // 簡略ソート: 中心優先のみ (負荷減)
        const centerDistA = Math.abs(a[0] - 1.5) + Math.abs(a[1] - 2.5);  // 中心調整 (5列)
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
    status.textContent = '引き分けだね！';
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