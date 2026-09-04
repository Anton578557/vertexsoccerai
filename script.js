const SUPPORT_EMAIL = 'vertexsoccerai@outlook.com';
let currentUser = null;
let teamsDatabase = [];

document.addEventListener('DOMContentLoaded', function() {
    initNavigation();
    initSearch();
    initTrainer();
    loadTeamsDatabase();
    checkSession();
});

function initNavigation() {
    document.querySelectorAll('.nav a[data-tab]').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            switchTab(this.dataset.tab);
        });
    });

    document.querySelectorAll('[data-tab-link]').forEach(el => {
        el.addEventListener('click', function(e) {
            e.preventDefault();
            switchTab(this.dataset.tabLink);
        });
    });

    document.getElementById('logo').addEventListener('click', function() {
        switchTab('home');
    });

    document.getElementById('btnSignup').addEventListener('click', function(e) {
        e.preventDefault();
        showSignupModal();
    });
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    const activeTab = document.getElementById(`tab-${tabId}`);
    if (activeTab) activeTab.classList.add('active');

    document.querySelectorAll('.nav a[data-tab]').forEach(link => {
        link.classList.remove('active');
        if (link.dataset.tab === tabId) link.classList.add('active');
    });

    if (tabId === 'results') loadResults();
    if (tabId === 'leaderboard') loadLeaderboard();
    if (tabId === 'reviews') loadReviews();
    if (tabId === 'trainer') showTrainerDashboard();
}

function initSearch() {
    const searchInput = document.getElementById('searchInput');
    const suggestions = document.getElementById('suggestions');
    const analyzerInput = document.getElementById('analyzerSearch');
    const analyzerSuggestions = document.getElementById('analyzerSuggestions');

    searchInput.addEventListener('input', function() {
        showSuggestions(this.value, suggestions);
    });

    analyzerInput.addEventListener('input', function() {
        showSuggestions(this.value, analyzerSuggestions);
    });

    document.getElementById('btnAnalyze').addEventListener('click', function() {
        const matchText = searchInput.value;
        if (matchText) {
            switchTab('analyzer');
            analyzerInput.value = matchText;
            performAnalysis(matchText);
        }
    });

    document.getElementById('btnAnalyzeMatch').addEventListener('click', function() {
        const matchText = analyzerInput.value;
        if (matchText) performAnalysis(matchText);
    });
}

function showSuggestions(query, suggestionsEl) {
    if (query.length < 2) {
        suggestionsEl.classList.remove('active');
        return;
    }
    const matches = searchTeams(query);
    if (matches.length > 0) {
        suggestionsEl.innerHTML = matches.map(team => `
            <div class="suggestion-item" data-team="${team}">${team}</div>
        `).join('');
        suggestionsEl.classList.add('active');
        suggestionsEl.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', function() {
                const input = suggestionsEl.parentElement.querySelector('input');
                input.value = this.dataset.team;
                suggestionsEl.classList.remove('active');
            });
        });
    } else {
        const fuzzy = fuzzySearch(query);
        if (fuzzy) {
            suggestionsEl.innerHTML = `<div class="suggestion-item" data-team="${fuzzy}">Did you mean: ${fuzzy}?</div>`;
            suggestionsEl.classList.add('active');
            suggestionsEl.querySelector('.suggestion-item').addEventListener('click', function() {
                const input = suggestionsEl.parentElement.querySelector('input');
                input.value = this.dataset.team;
                suggestionsEl.classList.remove('active');
            });
        } else {
            suggestionsEl.classList.remove('active');
        }
    }
}

function searchTeams(query) {
    const q = query.toLowerCase();
    return teamsDatabase.filter(team => team.toLowerCase().startsWith(q)).slice(0, 8);
}

function fuzzySearch(query) {
    const q = query.toLowerCase();
    for (const team of teamsDatabase) {
        const distance = levenshteinDistance(q, team.toLowerCase());
        if (distance <= 2 && distance > 0) return team;
    }
    return null;
}

function levenshteinDistance(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            matrix[i][j] = (b[i-1] === a[j-1]) ? matrix[i-1][j-1] : Math.min(matrix[i-1][j-1] + 1, matrix[i][j-1] + 1, matrix[i-1][j] + 1);
        }
    }
    return matrix[b.length][a.length];
}

function loadTeamsDatabase() {
    teamsDatabase = [
        "Chelsea", "Arsenal", "Manchester City", "Manchester United", "Liverpool",
        "Tottenham", "Newcastle", "Aston Villa", "West Ham", "Brighton",
        "Real Madrid", "Barcelona", "Atletico Madrid", "Sevilla", "Valencia",
        "Bayern Munich", "Borussia Dortmund", "RB Leipzig", "Bayer Leverkusen",
        "PSG", "Marseille", "Lyon", "Monaco", "Lille",
        "Inter Milan", "AC Milan", "Juventus", "Napoli", "Roma",
        "Ajax", "PSV", "Feyenoord", "Benfica", "Porto",
        "Celtic", "Rangers", "Galatasaray", "Fenerbahce", "Besiktas"
    ].sort();
}

function performAnalysis(matchText) {
    const resultDiv = document.getElementById('analysisResult');
    resultDiv.innerHTML = `<p style="text-align:center;color:#00d4ff;">⚡ AI is analyzing...</p>`;
    setTimeout(() => {
        resultDiv.innerHTML = generateAnalysis(matchText);
    }, 2000);
}

function generateAnalysis(matchText) {
    const predictions = [
        { label: "Winner", value: "Home Team", prob: 82, level: "high" },
        { label: "Double Chance", value: "1X", prob: 78, level: "high" },
        { label: "Total Goals", value: "Under 2.5", prob: 87, level: "high" },
        { label: "Both Teams Score", value: "No", prob: 65, level: "medium" },
        { label: "Exact Score", value: "1-0", prob: 28, level: "low" },
        { label: "Home Team Total", value: "Over 1.5", prob: 72, level: "medium" },
        { label: "Away Team Total", value: "Under 1.5", prob: 74, level: "medium" },
        { label: "First Goal Time", value: "After 25 min", prob: 68, level: "medium" },
        { label: "First Team to Score", value: "Home", prob: 55, level: "medium" },
        { label: "Total Corners", value: "Over 9.5", prob: 62, level: "medium" },
        { label: "Home Corners", value: "Over 5.5", prob: 58, level: "medium" },
        { label: "Away Corners", value: "Under 4.5", prob: 60, level: "medium" },
        { label: "Corner Race", value: "Home", prob: 55, level: "medium" },
        { label: "Total Cards", value: "Over 3.5", prob: 78, level: "high" },
        { label: "Home Cards", value: "Over 1.5", prob: 65, level: "medium" },
        { label: "Away Cards", value: "Over 1.5", prob: 70, level: "medium" },
        { label: "First Card Time", value: "Before 30 min", prob: 58, level: "medium" },
        { label: "Penalty", value: "No", prob: 85, level: "high" },
        { label: "Shots on Target", value: "Over 8.5", prob: 62, level: "medium" },
        { label: "Offsides", value: "Over 3.5", prob: 55, level: "medium" }
    ];
    return `
        <div class="analysis-card">
            <div class="analysis-teams">${matchText.toUpperCase()}</div>
            <div class="prediction-grid">
                ${predictions.map(p => `
                    <div class="prediction-item">
                        <div class="prediction-label">${p.label}</div>
                        <div class="prediction-value">${p.value}</div>
                        <div class="prediction-prob prob-${p.level}">${p.prob}%</div>
                    </div>
                `).join('')}
            </div>
            <div class="verdict-box">
                <div class="verdict-title">🔮 AI MATCH VERDICT</div>
                <div class="verdict-text">
                    This is shaping up to be a tense, tactical battle. Both teams have shown strong defensive form recently. 
                    Expect a tight first half with few chances. The game could open up after the 60th minute. 
                    Recommended: Under 2.5 goals.
                </div>
            </div>
        </div>
    `;
}

function initTrainer() {
    const btn = document.getElementById('btnTryTrainer');
    if (btn) {
        btn.addEventListener('click', function() {
            showTrainerSetup();
        });
    }
}

function showTrainerDashboard() {
    const content = document.getElementById('trainerContent');
    const profile = localStorage.getItem('trainer_profile');
    
    if (profile) {
        const data = JSON.parse(profile);
        content.innerHTML = `
            <div class="trainer-card">
                <h3 style="color:#00d4ff;margin-bottom:15px;">YOUR AI TRAINER</h3>
                <p style="color:#9a9aae;margin-bottom:10px;">Bankroll: $${data.bankroll}</p>
                <p style="color:#9a9aae;margin-bottom:10px;">Risk: ${data.risk}</p>
                <p style="color:#9a9aae;margin-bottom:20px;">Leagues: ${data.leagues.join(', ')}</p>
                <div style="background:rgba(0,0,0,0.3);padding:15px;border-radius:10px;margin-bottom:20px;">
                    <p style="color:#00ff87;font-size:14px;">📋 RECOMMENDED STRATEGY:</p>
                    <p style="color:#9a9aae;font-size:13px;margin-top:10px;">Stake per bet: 3% ($${Math.round(data.bankroll * 0.03)})</p>
                    <p style="color:#9a9aae;font-size:13px;">Bets per week: 3-5</p>
                    <p style="color:#9a9aae;font-size:13px;">Focus: Under 2.5 goals</p>
                </div>
                <button class="btn-primary" onclick="showTrainerSetup()">EDIT PROFILE</button>
            </div>
        `;
    } else {
        showTrainerSetup();
    }
}

function showTrainerSetup() {
    const content = document.getElementById('trainerContent');
    content.innerHTML = `
        <div class="trainer-card">
            <h3 style="color:#00d4ff;margin-bottom:20px;">🤖 SET UP YOUR AI TRAINER</h3>
            <div style="text-align:left;">
                <p style="color:#9a9aae;font-size:13px;margin-bottom:5px;">Your bankroll ($):</p>
                <input type="number" id="trainerBankroll" value="1000" style="width:100%;padding:10px;background:rgba(0,0,0,0.3);border:1px solid #1e293b;border-radius:8px;color:#fff;margin-bottom:15px;">
                
                <p style="color:#9a9aae;font-size:13px;margin-bottom:5px;">Risk level:</p>
                <select id="trainerRisk" style="width:100%;padding:10px;background:rgba(0,0,0,0.3);border:1px solid #1e293b;border-radius:8px;color:#fff;margin-bottom:15px;">
                    <option value="Low">Low (safe)</option>
                    <option value="Moderate" selected>Moderate</option>
                    <option value="Aggressive">Aggressive</option>
                </select>
                
                <p style="color:#9a9aae;font-size:13px;margin-bottom:5px;">Favorite leagues:</p>
                <select id="trainerLeagues" multiple style="width:100%;padding:10px;background:rgba(0,0,0,0.3);border:1px solid #1e293b;border-radius:8px;color:#fff;margin-bottom:20px;height:100px;">
                    <option value="Premier League" selected>Premier League</option>
                    <option value="La Liga">La Liga</option>
                    <option value="Serie A">Serie A</option>
                    <option value="Bundesliga">Bundesliga</option>
                    <option value="Ligue 1">Ligue 1</option>
                </select>
            </div>
            <button class="btn-primary" onclick="saveTrainerProfile()">GENERATE MY STRATEGY</button>
        </div>
    `;
}

function saveTrainerProfile() {
    const bankroll = document.getElementById('trainerBankroll').value;
    const risk = document.getElementById('trainerRisk').value;
    const leaguesEl = document.getElementById('trainerLeagues');
    const leagues = Array.from(leaguesEl.selectedOptions).map(opt => opt.value);
    
    const profile = { bankroll, risk, leagues };
    localStorage.setItem('trainer_profile', JSON.stringify(profile));
    showTrainerDashboard();
}

function loadResults() {
    document.getElementById('resultsTable').innerHTML = `
        <div class="result-row"><span class="result-teams">Chelsea vs Arsenal</span><span class="result-status win">WIN ✓</span></div>
        <div class="result-row"><span class="result-teams">Liverpool vs Man United</span><span class="result-status win">WIN ✓</span></div>
        <div class="result-row"><span class="result-teams">Real Madrid vs Barcelona</span><span class="result-status loss">LOSS ✗</span></div>
    `;
}

function loadLeaderboard() {
    const fakeUsers = [
        { name: "John D.", winRate: 92 }, { name: "Maria S.", winRate: 88 },
        { name: "Alex K.", winRate: 85 }, { name: "Emma W.", winRate: 82 },
        { name: "Chris P.", winRate: 79 }, { name: "Sophia L.", winRate: 76 },
        { name: "Michael B.", winRate: 74 }, { name: "Olivia R.", winRate: 72 },
        { name: "David M.", winRate: 70 }, { name: "Isabella T.", winRate: 68 },
        { name: "James C.", winRate: 65 }, { name: "Mia F.", winRate: 63 },
        { name: "Robert H.", winRate: 61 }, { name: "Charlotte G.", winRate: 59 },
        { name: "William S.", winRate: 57 }, { name: "Amelia D.", winRate: 55 },
        { name: "Daniel N.", winRate: 52 }, { name: "Harper V.", winRate: 50 },
        { name: "Matthew J.", winRate: 48 }, { name: "Evelyn A.", winRate: 45 }
    ];
    document.getElementById('leaderboard').innerHTML = fakeUsers.map((u, i) => `
        <div class="result-row"><span>#${i+1} ${u.name}</span><span style="color:#00ff87;">${u.winRate}%</span></div>
    `).join('');
}

function loadReviews() {
    document.getElementById('reviewsList').innerHTML = `
        <div class="result-row"><div><strong>⭐⭐⭐⭐⭐</strong><br>
        <p style="color:#9a9aae;font-size:13px;">"Best AI analyzer I've ever used! Won $500 in first week."</p>
        <small style="color:#9a9aae;">— John D.</small></div></div>
        <div class="result-row"><div><strong>⭐⭐⭐⭐⭐</strong><br>
        <p style="color:#9a9aae;font-size:13px;">"AI Trainer changed my betting strategy completely!"</p>
        <small style="color:#9a9aae;">— Maria S.</small></div></div>
        <div class="result-row"><div><strong>⭐⭐⭐⭐</strong><br>
        <p style="color:#9a9aae;font-size:13px;">"Good predictions, very accurate. Impressive AI."</p>
        <small style="color:#9a9aae;">— Alex K.</small></div></div>
    `;
}

function showSignupModal() {
    const modal = document.getElementById('modalOverlay');
    const content = document.getElementById('modalContent');
    content.innerHTML = `
        <h2>Create Account</h2>
        <input type="email" id="signupEmail" placeholder="Email">
        <input type="password" id="signupPassword" placeholder="Password">
        <button onclick="signup()">SIGN UP</button>
        <button class="btn-close-modal" onclick="closeModal()">Close</button>
    `;
    modal.classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modalOverlay').classList.add('hidden');
}

function checkSession() {
    const savedUser = localStorage.getItem('vertex_user');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
    }
}

function signup() {
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    currentUser = { email: email };
    localStorage.setItem('vertex_user', JSON.stringify(currentUser));
    closeModal();
    showWelcomeGuide();
}

function showWelcomeGuide() {
    const modal = document.getElementById('modalOverlay');
    const content = document.getElementById('modalContent');
    content.innerHTML = `
        <h2>👋 WELCOME TO VERTEX SOCCER AI</h2>
        <div style="color:#9a9aae;font-size:13px;line-height:1.8;">
            <p><strong style="color:#00d4ff;">1. AI ANALYZER:</strong><br>Enter match → Get 20+ predictions instantly. FREE during beta.</p>
            <p><strong style="color:#00d4ff;">2. AI TRAINER:</strong><br>Personal strategy + weekly picks. FREE during beta.</p>
            <p><strong style="color:#00d4ff;">3. RESULTS:</strong><br>Check AI accuracy and leaderboard.</p>
            <p><strong style="color:#00d4ff;">4. SUPPORT:</strong><br>${SUPPORT_EMAIL}</p>
        </div>
        <button onclick="closeModal()">✓ GOT IT!</button>
    `;
    modal.classList.remove('hidden');
}
