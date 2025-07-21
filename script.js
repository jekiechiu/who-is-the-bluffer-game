// ====== Supabase 配置與初始化 ======
// 請替換成你實際從 Supabase 後台獲取的 Project URL 和 anon public key
const SUPABASE_URL = 'https://csgguybpftuytvilmneu.supabase.co'; //
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzZ2d1eWJwZnR1eXR2aWxtbmV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1NTk2MDgsImV4cCI6MjA2ODEzNTYwOH0.HQqrm-pU8GJDfqw760U-r1yPmYCR5hxyUL9VH6YkSeE'; //

// 初始化 Supabase 客戶端
// 確保你已經在 index.html 中引入了 Supabase JS SDK
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 確認 Supabase 是否成功初始化，可以在瀏覽器的開發者工具(F12)的控制台(Console)看到這條訊息
console.log("Supabase 客戶端已初始化！準備就緒。");

// ====== 遊戲狀態變數 (Game State Variables) ======
let currentSessionId = null;
let players = [];
let currentPlayerIndex = 0; // 當前正在看手機的玩家在 players 陣列中的索引
let currentTopic = null;
let totalPlayers = 0;
let difficulty = 1;
let currentThinkerIndex = 0; // 當前輪次想想玩家在 players 陣列中的索引
let viewedPlayersCount = 0; // 已看過身份的玩家數量

// ====== HTML 元素選取器 (DOM Elements Selectors) ======
const gameContainer = document.getElementById('game-container');
const startScreen = document.getElementById('start-screen');
const roleRevealScreen = document.getElementById('role-reveal-screen');
const thinkingScreen = document.getElementById('thinking-screen');
const resultsScreen = document.getElementById('results-screen');
const bufferScreen = document.getElementById('buffer-screen'); // 現在用作手機傳遞頁面

const numPlayersInput = document.getElementById('num-players');
const difficultySelect = document.getElementById('difficulty-select');
const startGameBtn = document.getElementById('start-game-btn');

const playerNamesContainer = document.getElementById('player-names-container');

const roleText = document.getElementById('role-text');
const topicText = document.getElementById('topic-text');
const topicExplanationText = document.getElementById('topic-explanation-text');
const timerDisplay = document.getElementById('timer-display');
const playerNicknameReveal = document.getElementById('player-nickname-reveal'); // 確保這個也被選取到

const nextPlayerNameSpan = document.getElementById('next-player-name');
const iAmNextBtn = document.getElementById('i-am-next-btn');
const iAmThinkerBtn = document.getElementById('i-am-thinker-btn');

const thinkerQuestionList = document.getElementById('thinker-question-list');
const thinkerGuessList = document.getElementById('thinker-guess-list');
const submitThinkerChoicesBtn = document.getElementById('submit-thinker-choices-btn');

const resultsTopicText = document.getElementById('results-topic-text');
const resultsExplanationText = document.getElementById('results-explanation-text');
const resultsRolesList = document.getElementById('results-roles-list');
const resultsScoresList = document.getElementById('results-scores-list');
const nextRoundBtn = document.getElementById('next-round-btn');
const endGameBtn = document.getElementById('end-game-btn');


// ====== 輔助函數 (Helper Functions) ======
function showScreen(screenElement) {
    startScreen.style.display = 'none';
    roleRevealScreen.style.display = 'none';
    thinkingScreen.style.display = 'none';
    resultsScreen.style.display = 'none';
    bufferScreen.style.display = 'none';
    screenElement.style.display = 'block';
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function generatePlayerNameInputs() {
    const numPlayers = parseInt(numPlayersInput.value);
    playerNamesContainer.innerHTML = '';

    if (isNaN(numPlayers) || numPlayers < 3) {
        playerNamesContainer.innerHTML = '<p style="color: red;">請輸入至少 3 位玩家</p>';
        return;
    }

    for (let i = 0; i < numPlayers; i++) {
        const div = document.createElement('div');
        div.classList.add('player-name-input-item');
        div.innerHTML = `
            <label for="player-name-${i}">玩家 ${i + 1} 暱稱：</label>
            <input type="text" id="player-name-${i}" class="player-name-input" value="玩家${i + 1}">
        `;
        playerNamesContainer.appendChild(div);
    }
}

// ====== 遊戲流程函數 (Game Flow Functions) ======

async function initializeGame() {
    showScreen(startScreen);
    console.log("遊戲初始化完成，顯示開始畫面。");

    // === 修正：清除歷史資料庫內容 ===
    console.log("正在清除歷史遊戲資料...");
    
    // 先清除 players 表，因為它有外鍵引用 game_sessions
    const { error: playersError } = await supabase
        .from('players')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // 使用一個不會存在的有效UUID

    if (playersError) {
        console.error("清除 players 表資料失敗:", playersError.message);
    } else {
        console.log("players 表資料已清除。");
    }

    // 再清除 game_sessions 表
    const { error: sessionsError } = await supabase
        .from('game_sessions')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // 同樣使用不會存在的有效UUID

    if (sessionsError) {
        console.error("清除 game_sessions 表資料失敗:", sessionsError.message);
    } else {
        console.log("game_sessions 表資料已清除。");
    }
    // === 結束修正 ===

    generatePlayerNameInputs();
    numPlayersInput.addEventListener('input', generatePlayerNameInputs);
}

async function startGame() {
    totalPlayers = parseInt(numPlayersInput.value);
    difficulty = parseInt(difficultySelect.value);

    if (isNaN(totalPlayers) || totalPlayers < 3) {
        alert("玩家人數至少需要 3 人！");
        return;
    }

    const playerNames = [];
    const nameInputs = document.querySelectorAll('.player-name-input');
    const seenNames = new Set();

    for (let i = 0; i < totalPlayers; i++) {
        if (!nameInputs[i]) {
            alert("暱稱輸入框數量不符，請重新整理頁面。");
            return;
        }
        const name = nameInputs[i].value.trim();

        if (name === '') {
            alert(`玩家 ${i + 1} 的暱稱不能為空！`);
            return;
        }
        if (seenNames.has(name)) {
            alert(`玩家暱稱「${name}」重複了，請修改！`);
            return;
        }
        seenNames.add(name);
        playerNames.push(name);
    }

    players = [];
    for (let i = 0; i < totalPlayers; i++) {
        players.push({
            id: null,
            name: playerNames[i],
            score: 3,
            role: null,
            session_id: null,
        });
    }

    currentThinkerIndex = 0;
    viewedPlayersCount = 0;

    await createNewGameSession();
}

async function createNewGameSession() {
    console.log("正在創建新的遊戲局...");
    const { data: sessionData, error: sessionError } = await supabase
        .from('game_sessions')
        .insert({})
        .select()
        .single();

    if (sessionError) {
        console.error("創建遊戲局失敗:", sessionError);
        alert("遊戲啟動失敗，請檢查網路或稍後再試。");
        return;
    }

    currentSessionId = sessionData.id;
    console.log("遊戲局創建成功，ID:", currentSessionId);

    const playersToInsert = players.map(player => ({
        session_id: currentSessionId,
        name: player.name,
        score: player.score,
    }));

    const { data: insertedPlayers, error: playersError } = await supabase
        .from('players')
        .insert(playersToInsert)
        .select();

    if (playersError) {
        console.error("插入玩家資料失敗:", playersError);
        alert("玩家資料儲存失敗，請檢查網路或稍後再試。");
        return;
    }

    insertedPlayers.forEach(dbPlayer => {
        const localPlayer = players.find(p => p.name === dbPlayer.name);
        if (localPlayer) {
            localPlayer.id = dbPlayer.id;
            localPlayer.session_id = dbPlayer.session_id;
        }
    });

    console.log("玩家資料插入成功:", players);

    await assignRolesAndTopic();
}

async function assignRolesAndTopic() {
    console.log("正在獲取題目並分配角色...");
    const { data: topics, error: topicsError } = await supabase
        .from('topics')
        .select('*')
        .eq('difficulty', difficulty);

    if (topicsError) {
        console.error("獲取題目失敗:", topicsError);
        alert("無法載入題目，請檢查網路或稍後再試。");
        return;
    }
    if (topics.length === 0) {
        alert(`沒有找到難度為 ${difficulty} 的題目，請先在 Supabase 中添加題目！`);
        console.warn(`沒有找到難度為 ${difficulty} 的題目。`);
        return;
    }

    currentTopic = topics[Math.floor(Math.random() * topics.length)];
    console.log("選定的題目:", currentTopic);

    players.forEach(player => {
        player.role = null;
    });

    const thinkerPlayer = players[currentThinkerIndex];
    thinkerPlayer.role = '想想';
    console.log(`本輪想想是: ${thinkerPlayer.name}`);

    const availablePlayersForRoles = players.filter(p => p.id !== thinkerPlayer.id);
    shuffleArray(availablePlayersForRoles);

    const honestPersonPlayer = availablePlayersForRoles.shift();
    honestPersonPlayer.role = '老實人';
    console.log(`本輪老實人是: ${honestPersonPlayer.name}`);

    availablePlayersForRoles.forEach(p => {
        p.role = '瞎掰人';
    });
    console.log("角色分配完成:", players);

    currentPlayerIndex = currentThinkerIndex;
    viewedPlayersCount = 0;

    showRoleRevealScreen();
}

function showRoleRevealScreen() {
    const player = players[currentPlayerIndex];
    playerNicknameReveal.textContent = player.name; // 顯示玩家暱稱
    roleText.textContent = player.role; // 只顯示角色
    topicText.textContent = currentTopic.topic_text;

    if (player.role === '老實人') {
        topicExplanationText.style.display = 'block';
        topicExplanationText.innerHTML = `**正確解釋：**<br>${currentTopic.explanation}`;
    } else {
        topicExplanationText.style.display = 'none';
    }

    showScreen(roleRevealScreen);

    startRoleRevealTimer();
}

let roleRevealTimer;
let timeLeft = 10;

function startRoleRevealTimer() {
    timeLeft = 10;
    timerDisplay.textContent = timeLeft;

    roleRevealTimer = setInterval(() => {
        timeLeft--;
        timerDisplay.textContent = timeLeft;

        if (timeLeft <= 0) {
            clearInterval(roleRevealTimer);
            viewedPlayersCount++;

            if (viewedPlayersCount === totalPlayers) {
                showThinkerHandoverScreen();
            } else {
                currentPlayerIndex = (currentPlayerIndex + 1) % totalPlayers;
                showStandardHandoverScreen();
            }
        }
    }, 1000);
}

// ====== 事件監聽器 (Event Listeners) ======
startGameBtn.addEventListener('click', startGame);

iAmNextBtn.addEventListener('click', () => {
    showRoleRevealScreen();
});

iAmThinkerBtn.addEventListener('click', () => {
    enterThinkingPhase();
});

// ====== 啟動遊戲 ======
document.addEventListener('DOMContentLoaded', initializeGame);

// ====== 手機傳遞頁面邏輯 (Handover Screen) ======

function showStandardHandoverScreen() {
    showScreen(bufferScreen);

    bufferScreen.querySelector('h2').textContent = '手機傳遞中...';
    // 直接更新 p 標籤的 innerHTML，包含 span
    bufferScreen.querySelector('p').innerHTML = `請將手機傳給 <span id="next-player-name">${players[currentPlayerIndex].name}</span>`;
    
    // 重新獲取 nextPlayerNameSpan，因為 innerHTML 改變會重建 DOM 元素
    // 但在這種情況下，因為我們只是在顯示，並且沒有對這個 span 進行額外的事件監聽，
    // 所以可以依賴於每次設置 innerHTML 時它會被正確渲染。
    // 如果有對 nextPlayerNameSpan 的事件監聽，則需要在這裡重新綁定。

    iAmNextBtn.style.display = 'block';
    iAmThinkerBtn.style.display = 'none';
}

function showThinkerHandoverScreen() {
    showScreen(bufferScreen);

    bufferScreen.querySelector('h2').textContent = '手機回到想想手中！';
    bufferScreen.querySelector('p').innerHTML = '請點擊下方按鈕開始判斷。';
    
    iAmNextBtn.style.display = 'none';
    iAmThinkerBtn.style.display = 'block';
}


function enterThinkingPhase() {
    console.log("所有玩家已看完身份，進入想想判斷階段。");
    const thinker = players.find(p => p.role === '想想');
    if (!thinker) {
        console.error("錯誤：沒有找到想想玩家！");
        alert("遊戲出錯，沒有想想玩家。");
        return;
    }

    showScreen(thinkingScreen);
    document.getElementById('current-topic-display').textContent = currentTopic.topic_text;

    thinkerQuestionList.innerHTML = '';
    const otherPlayers = players.filter(p => p.role !== '想想');

    otherPlayers.forEach(player => {
        const label = document.createElement('label');
        label.innerHTML = `<input type="radio" name="question-target" value="${player.id}"> ${player.name}`;
        thinkerQuestionList.appendChild(label);
        thinkerQuestionList.appendChild(document.createElement('br'));
    });

    thinkerGuessList.innerHTML = '';
    otherPlayers.forEach(player => {
        const label = document.createElement('label');
        label.innerHTML = `<input type="radio" name="honest-guess" value="${player.id}"> ${player.name}`;
        thinkerGuessList.appendChild(label);
        thinkerGuessList.appendChild(document.createElement('br'));
    });
}

submitThinkerChoicesBtn.addEventListener('click', submitThinkerChoices);

async function submitThinkerChoices() {
    console.log("想想提交判斷...");
    const thinker = players.find(p => p.role === '想想');
    if (!thinker) return;

    const questionedTargetInput = document.querySelector('input[name="question-target"]:checked');
    const questionedTarget = questionedTargetInput ? players.find(p => p.id === questionedTargetInput.value) : null;

    const honestGuessInput = document.querySelector('input[name="honest-guess"]:checked');
    const guessedHonestPerson = honestGuessInput ? players.find(p => p.id === honestGuessInput.value) : null;

    if (!guessedHonestPerson) {
        alert("想想必須選擇一位玩家作為老實人！");
        return;
    }

    if (questionedTarget && guessedHonestPerson && questionedTarget.id === guessedHonestPerson.id) {
        alert("不能對同一個玩家同時使用「公三小」並猜他是老實人！請重新選擇。");
        return;
    }

    console.log("公三小目標:", questionedTarget ? questionedTarget.name : "無");
    console.log("猜測的老實人:", guessedHonestPerson.name); // 修正筆誤：guessedHonhedPerson -> guessedHonestPerson

    await calculateScores(questionedTarget, guessedHonestPerson);
}

async function calculateScores(questionedTarget, guessedHonestPerson) {
    const thinker = players.find(p => p.role === '想想');
    const honestPerson = players.find(p => p.role === '老實人');
    const blufferPlayers = players.filter(p => p.role === '瞎掰人');

    let thinkerCorrectlyGuessedHonest = false;
    let blufferSuccessfullyFooled = true;

    if (guessedHonestPerson.id === honestPerson.id) {
        thinker.score += currentTopic.difficulty;
        thinkerCorrectlyGuessedHonest = true;
        console.log(`想想 ${thinker.name} 猜對老實人，獲得 ${currentTopic.difficulty} 分！`);
    } else {
        console.log(`想想 ${thinker.name} 猜錯老實人。`);
    }

    if (questionedTarget) {
        if (questionedTarget.role === '瞎掰人') {
            questionedTarget.score -= currentTopic.difficulty;
            console.log(`瞎掰人 ${questionedTarget.name} 被公三小，扣除 ${currentTopic.difficulty} 分！`);
            blufferSuccessfullyFooled = false;
        } else {
            thinker.score -= currentTopic.difficulty;
            console.log(`想想 ${thinker.name} 對非瞎掰人使用公三小，扣除 ${currentTopic.difficulty} 分！`);
        }
    } else {
        console.log("想想沒有使用公三小卡。");
    }

    if (!thinkerCorrectlyGuessedHonest && blufferSuccessfullyFooled) {
        blufferPlayers.forEach(bluffer => {
            bluffer.score += currentTopic.difficulty;
            console.log(`瞎掰人 ${bluffer.name} 成功唬爛（想想猜錯且沒被公三小），獲得 ${currentTopic.difficulty} 分！`);
        });
    } else if (thinkerCorrectlyGuessedHonest) {
        console.log("想想猜對老實人，瞎掰人不加分。");
    } else if (!blufferSuccessfullyFooled) {
        console.log("有瞎掰人被公三小了，瞎掰人不加分。");
    }

    const honestPersonWasQuestioned = (questionedTarget && questionedTarget.id === honestPerson.id);
    if (!honestPersonWasQuestioned && !thinkerCorrectlyGuessedHonest) {
        honestPerson.score += currentTopic.difficulty;
        console.log(`老實人 ${honestPerson.name} 沒被公三小且想想沒猜對，獲得 ${currentTopic.difficulty} 分！`);
    } else if (honestPersonWasQuestioned) {
        console.log(`老實人 ${honestPerson.name} 被公三小了，不加分。`);
    } else if (thinkerCorrectlyGuessedHonest) {
        console.log(`想想猜對老實人，老實人 ${honestPerson.name} 不加分。`);
    }

    const updates = players.map(p => ({
        id: p.id,
        score: p.score,
        session_id: p.session_id,
        name: p.name
    }));

    const { error: updateError } = await supabase
        .from('players')
        .upsert(updates, { onConflict: 'id' });

    if (updateError) {
        console.error("更新玩家分數失敗:", updateError);
        alert("分數更新失敗，請檢查網路或稍後再試。");
        return;
    }

    console.log("分數結算完成，顯示結果畫面。");
    showResultsScreen();
}

function showResultsScreen() {
    showScreen(resultsScreen);

    resultsTopicText.textContent = currentTopic.topic_text;
    resultsExplanationText.textContent = currentTopic.explanation;

    resultsRolesList.innerHTML = '';
    players.forEach(player => {
        const li = document.createElement('li');
        li.textContent = `${player.name}：${player.role}`;
        resultsRolesList.appendChild(li);
    });

    resultsScoresList.innerHTML = '';
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
    sortedPlayers.forEach(player => {
        const li = document.createElement('li');
        li.textContent = `${player.name}：${player.score} 分`;
        resultsScoresList.appendChild(li);
    });
}

endGameBtn.addEventListener('click', () => {
    if (confirm("確定要結束遊戲嗎？所有進度將會重置。")) {
        currentSessionId = null;
        players = [];
        currentPlayerIndex = 0;
        currentTopic = null;
        totalPlayers = 0;
        difficulty = 1;
        currentThinkerIndex = 0;
        viewedPlayersCount = 0;

        initializeGame();
    }
});

nextRoundBtn.addEventListener('click', async () => {
    console.log("開始下一輪遊戲...");
    players.forEach(player => {
        player.role = null;
    });

    currentThinkerIndex = (currentThinkerIndex + 1) % totalPlayers;
    viewedPlayersCount = 0;

    await assignRolesAndTopic();
});