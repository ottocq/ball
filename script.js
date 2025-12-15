class GameState {
    constructor() {
        this.players = [];
        this.matchups = [];
        this.status = 'SETUP'; // SETUP, PLAYING
        this.STORAGE_KEY = 'billiards_score_data';
        this.load();
    }

    save() {
        const data = {
            players: this.players,
            matchups: this.matchups,
            status: this.status
        };
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.warn('Save failed:', e);
        }
    }

    load() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            if (raw) {
                const data = JSON.parse(raw);
                if (data.players) this.players = data.players;
                if (data.matchups) this.matchups = data.matchups;
                if (data.status) this.status = data.status;
            }
        } catch (e) {
            console.error('Load failed:', e);
        }
    }

    setPlayers(names) {
        // 1. Create Player Objects
        this.players = names.map((name, index) => ({
            id: index + 1,
            name: name || `玩家 ${index + 1}`
        }));

        // 2. Generate Matchups (Combinations of 2)
        this.matchups = [];
        for (let i = 0; i < this.players.length; i++) {
            for (let j = i + 1; j < this.players.length; j++) {
                const p1 = this.players[i];
                const p2 = this.players[j];
                this.matchups.push({
                    id: `${p1.id}-${p2.id}`,
                    player1Id: p1.id,
                    player2Id: p2.id,
                    score1: 0,
                    score2: 0
                });
            }
        }
        this.save();
    }

    incrementScore(matchupId, playerId) {
        const matchup = this.matchups.find(m => m.id === matchupId);
        if (!matchup) return false;

        let changed = false;
        if (playerId === matchup.player1Id) {
            matchup.score1++;
            changed = true;
        } else if (playerId === matchup.player2Id) {
            matchup.score2++;
            changed = true;
        }

        if (changed) this.save();
        return changed;
    }

    decrementScore(matchupId, playerId) {
        const matchup = this.matchups.find(m => m.id === matchupId);
        if (!matchup) return false;

        let changed = false;
        if (playerId === matchup.player1Id && matchup.score1 > 0) {
            matchup.score1--;
            changed = true;
        } else if (playerId === matchup.player2Id && matchup.score2 > 0) {
            matchup.score2--;
            changed = true;
        }

        if (changed) this.save();
        return changed;
    }

    resetScores() {
        this.matchups.forEach(m => {
            m.score1 = 0;
            m.score2 = 0;
        });
        this.save();
    }

    // Helper to get a specific player object
    getPlayer(id) {
        return this.players.find(p => p.id === id);
    }

    // Derived Statistics
    getStats() {
        const totalGames = this.matchups.reduce((sum, m) => sum + m.score1 + m.score2, 0);

        const playerStats = this.players.map(player => {
            let totalScore = 0;
            this.matchups.forEach(m => {
                if (m.player1Id === player.id) totalScore += m.score1;
                if (m.player2Id === player.id) totalScore += m.score2;
            });
            return {
                name: player.name,
                totalScore: totalScore
            };
        });

        return {
            totalGames,
            playerStats
        };
    }
}

class UIController {
    constructor(state) {
        this.state = state;
        this.cacheDOM();
        this.bindEvents();

        this.initView();
    }

    cacheDOM() {
        this.app = document.getElementById('app');
        this.setupScreen = document.getElementById('setup-screen');
        this.scoreboardScreen = document.getElementById('scoreboard-screen');

        // Setup inputs
        this.playerCountEl = document.getElementById('player-count');
        this.btnIncPlayers = document.getElementById('btn-increase-players');
        this.btnDecPlayers = document.getElementById('btn-decrease-players');
        this.playerInputsContainer = document.getElementById('player-inputs-container');
        this.btnStart = document.getElementById('btn-start-match');

        // Scoreboard
        this.matchupsList = document.getElementById('matchups-list');
        this.matchSummary = document.getElementById('match-summary');
        this.playerDetails = document.getElementById('player-details');

        this.btnEnd = document.getElementById('btn-end-match');
        this.btnReset = document.getElementById('btn-reset-scores');
    }

    initView() {
        // 1. Restore Setup Screen State
        const count = Math.max(2, this.state.players.length);
        this.playerCountEl.textContent = count;
        this.updatePlayerInputs(count);

        // Fill names if they exist
        const inputs = this.playerInputsContainer.querySelectorAll('input');
        inputs.forEach((input, i) => {
            if (this.state.players[i]) {
                input.value = this.state.players[i].name;
            }
        });

        // 2. If 'PLAYING', restore Scoreboard and switch
        if (this.state.status === 'PLAYING') {
            this.renderMatchups();
            this.updateStatsUI();
            this.switchScreen('PLAYING');
        }
    }

    bindEvents() {
        this.btnIncPlayers.addEventListener('click', () => this.adjustPlayerCount(1));
        this.btnDecPlayers.addEventListener('click', () => this.adjustPlayerCount(-1));
        this.btnStart.addEventListener('click', () => this.startMatch());
        this.btnEnd.addEventListener('click', () => this.endMatch());

        this.btnReset.addEventListener('click', () => {
            if (confirm('确定要重置当前比分吗？')) {
                this.state.resetScores();
                this.renderMatchups();
                this.updateStatsUI();
            }
        });
    }

    endMatch() {
        if (confirm('确定结束比赛返回设置吗？')) {
            this.state.status = 'SETUP';
            this.state.save();
            this.switchScreen('SETUP');
        }
    }

    adjustPlayerCount(delta) {
        let current = parseInt(this.playerCountEl.textContent);
        if (isNaN(current)) current = 2;

        let newValue = current + delta;
        if (newValue < 2) newValue = 2;
        if (newValue > 8) newValue = 8;

        if (current !== newValue) {
            this.playerCountEl.textContent = newValue;
            this.updatePlayerInputs(newValue);
        }
    }

    updatePlayerInputs(count) {
        const currentInputs = this.playerInputsContainer.querySelectorAll('.input-group');
        const currentCount = currentInputs.length;

        if (count > currentCount) {
            for (let i = currentCount; i < count; i++) {
                const div = document.createElement('div');
                div.className = 'input-group';
                div.innerHTML = `
                    <label>玩家 ${i + 1}</label>
                    <input type="text" placeholder="输入姓名" value="玩家 ${i + 1}" class="player-name-input">
                `;
                this.playerInputsContainer.appendChild(div);
            }
        } else {
            for (let i = currentCount - 1; i >= count; i--) {
                currentInputs[i].remove();
            }
        }
    }

    startMatch() {
        const inputs = this.playerInputsContainer.querySelectorAll('input');
        const names = Array.from(inputs).map(input => input.value.trim());

        this.state.setPlayers(names);
        this.state.status = 'PLAYING';
        this.state.save(); // Explicit save

        this.renderMatchups();
        this.updateStatsUI();
        this.switchScreen('PLAYING');
    }

    switchScreen(screenName) {
        if (screenName === 'PLAYING') {
            this.setupScreen.classList.remove('active');
            this.scoreboardScreen.classList.add('active');
        } else {
            this.scoreboardScreen.classList.remove('active');
            this.setupScreen.classList.add('active');
        }
    }

    renderMatchups() {
        this.matchupsList.innerHTML = '';

        this.state.matchups.forEach(matchup => {
            const p1 = this.state.getPlayer(matchup.player1Id);
            const p2 = this.state.getPlayer(matchup.player2Id);

            const card = document.createElement('div');
            card.className = 'matchup-card glass-panel';

            card.innerHTML = `
                <div class="matchup-side left" onclick="gameUI.handleScore('${matchup.id}', ${p1.id}, 1)">
                     <button class="matchup-btn-minus" onclick="event.stopPropagation(); gameUI.handleScore('${matchup.id}', ${p1.id}, -1)">
                        <i class="ph ph-minus"></i>
                    </button>
                    <div class="matchup-name">${p1.name}</div>
                    <div class="matchup-score" id="score-${matchup.id}-${p1.id}">${matchup.score1}</div>
                </div>
                
                <div class="matchup-divider">:</div>
                
                <div class="matchup-side right" onclick="gameUI.handleScore('${matchup.id}', ${p2.id}, 1)">
                    <button class="matchup-btn-minus" onclick="event.stopPropagation(); gameUI.handleScore('${matchup.id}', ${p2.id}, -1)">
                        <i class="ph ph-minus"></i>
                    </button>
                    <div class="matchup-name">${p2.name}</div>
                    <div class="matchup-score" id="score-${matchup.id}-${p2.id}">${matchup.score2}</div>
                </div>
            `;
            this.matchupsList.appendChild(card);
        });
    }

    handleScore(matchupId, playerId, delta) {
        let changed = false;
        if (delta > 0) {
            changed = this.state.incrementScore(matchupId, playerId);
        } else {
            changed = this.state.decrementScore(matchupId, playerId);
        }

        if (changed) {
            const matchup = this.state.matchups.find(m => m.id === matchupId);
            const score = (playerId === matchup.player1Id) ? matchup.score1 : matchup.score2;
            const el = document.getElementById(`score-${matchupId}-${playerId}`);

            if (el) {
                el.textContent = score;
                el.style.transform = 'scale(1.2) translateY(-2px)';
                setTimeout(() => el.style.transform = 'scale(1) translateY(0)', 150);
            }

            this.updateStatsUI();
        }
    }

    updateStatsUI() {
        const stats = this.state.getStats();
        this.matchSummary.innerHTML = `共进行 <span style="color:var(--accent-color)">${stats.totalGames}</span> 局比赛`;
        const details = stats.playerStats.map(p => `${p.name} ${p.totalScore}分`).join('，');
        this.playerDetails.textContent = details;
    }
}

// Initialize
const gameState = new GameState();
const gameUI = new UIController(gameState);
window.gameUI = gameUI;
