// Lógica del Panel del Anfitrión (Host)
const socket = io();

let currentRoomCode = 'BACH1';
let currentLetter = 'A';
let usedLetters = [];
let categories = [...CATEGORY_PRESETS.clasico.categories];
let players = [];
let detailedAnswers = {};
let currentReviewCatIndex = 0;
let activeSpotlightData = null;
let currentVoteData = null;
let isAudioMuted = false;

// Elementos del DOM
const views = {
  lobby: document.getElementById('viewLobby'),
  roundActive: document.getElementById('viewRoundActive'),
  review: document.getElementById('viewReview'),
  leaderboard: document.getElementById('viewLeaderboard')
};
const overlayStop = document.getElementById('overlayStop');
const spotlightModal = document.getElementById('spotlightModal');
const voteModal = document.getElementById('voteModal');

function setView(viewName) {
  Object.keys(views).forEach(k => {
    views[k].classList.add('hidden');
    views[k].classList.remove('flex');
  });
  if (views[viewName]) {
    views[viewName].classList.remove('hidden');
    views[viewName].classList.add('flex');
  }
}

function toggleMute() {
  isAudioMuted = !isAudioMuted;
  audio.muted = isAudioMuted;
  const icon = document.getElementById('muteBtn').querySelector('i');
  if (isAudioMuted) {
    icon.setAttribute('data-lucide', 'volume-x');
  } else {
    icon.setAttribute('data-lucide', 'volume-2');
  }
  lucide.createIcons();
}

// Inicialización
window.addEventListener('DOMContentLoaded', async () => {
  // Obtener código de sala de la URL o default
  const urlParams = new URLSearchParams(window.location.search);
  currentRoomCode = (urlParams.get('room') || 'BACH1').toUpperCase();
  document.getElementById('roomCodeBadge').textContent = currentRoomCode;

  // Cargar QR y Server Info
  try {
    const res = await fetch(`/api/server-info?room=${currentRoomCode}`);
    const data = await res.json();
    document.getElementById('qrImage').src = data.qrDataUrl;
    document.getElementById('playerUrlText').textContent = data.playerUrl;
    document.getElementById('ipBadge').textContent = `${data.localIp}:${data.port}`;
  } catch (err) {
    console.error('Error cargando server info:', err);
  }

  // Renderizar categorías iniciales
  renderCategoryChips();

  // Unirse a Socket.IO como Host
  socket.emit('host:join', { roomCode: currentRoomCode });
});

// Renderizar chips de categorías
function renderCategoryChips() {
  const container = document.getElementById('categoriesChips');
  container.innerHTML = '';
  document.getElementById('catCountBadge').textContent = categories.length;

  categories.forEach((cat, idx) => {
    const chip = document.createElement('div');
    chip.className = 'bg-white/10 border border-white/10 rounded-xl px-3 py-1.5 flex items-center gap-2 text-xs font-semibold text-white transition-all hover:bg-white/20';
    chip.innerHTML = `
      <span>${cat}</span>
      <button onclick="removeCategory(${idx})" class="text-slate-400 hover:text-rose-400 transition-colors">
        <i data-lucide="x" class="w-3.5 h-3.5"></i>
      </button>
    `;
    container.appendChild(chip);
  });
  lucide.createIcons();
}

function applyPreset(presetKey) {
  audio.click();
  if (CATEGORY_PRESETS[presetKey]) {
    categories = [...CATEGORY_PRESETS[presetKey].categories];
    renderCategoryChips();
    socket.emit('host:update_categories', { categories });
  }
}

function addCustomCategory() {
  const input = document.getElementById('newCategoryInput');
  const val = input.value.trim();
  if (val && !categories.includes(val)) {
    audio.click();
    categories.push(val);
    input.value = '';
    renderCategoryChips();
    socket.emit('host:update_categories', { categories });
  }
}

function removeCategory(idx) {
  audio.click();
  categories.splice(idx, 1);
  renderCategoryChips();
  socket.emit('host:update_categories', { categories });
}

// Ruleta de letras
let isSpinning = false;
function spinLetterWheel() {
  if (isSpinning) return;
  isSpinning = true;
  audio.click();

  const excludeHard = document.getElementById('excludeHardLetters').checked;
  const pool = excludeHard ? ALPHABET_EASY : ALPHABET_ALL;
  // Filtrar letras ya usadas si aún quedan libres
  const available = pool.filter(l => !usedLetters.includes(l));
  const finalPool = available.length > 0 ? available : pool;

  const letterDisplay = document.getElementById('letterDisplay');
  let iterations = 24;
  let delay = 50;

  function step() {
    const randomLetter = pool[Math.floor(Math.random() * pool.length)];
    letterDisplay.textContent = randomLetter;
    audio.wheelTick();

    iterations--;
    if (iterations > 0) {
      delay += 8;
      setTimeout(step, delay);
    } else {
      // Letra final
      const chosenLetter = finalPool[Math.floor(Math.random() * finalPool.length)];
      letterDisplay.textContent = chosenLetter;
      currentLetter = chosenLetter;
      isSpinning = false;
      audio.spotlight();
      socket.emit('host:set_letter', { letter: chosenLetter });
    }
  }

  step();
}

// Iniciar ronda
function startRound() {
  if (categories.length === 0) {
    alert('Agrega al menos una categoría para comenzar.');
    return;
  }
  audio.spotlight();
  socket.emit('host:start_round', {
    letter: currentLetter,
    roundTimeLimit: 0
  });
}

// Forzar STOP por el Host
function hostForceStop() {
  audio.stopAlarm();
  socket.emit('host:force_stop');
}

// ==================== SOCKET.IO EVENTS ====================

socket.on('room:state', (state) => {
  players = state.players || [];
  currentLetter = state.letter || currentLetter;
  usedLetters = state.usedLetters || [];

  // Actualizar badges
  document.getElementById('playerCountNav').textContent = `${players.length} Jugador${players.length === 1 ? '' : 'es'}`;
  document.getElementById('lobbyPlayerCount').textContent = players.length;
  document.getElementById('usedLettersList').textContent = usedLetters.length > 0 ? usedLetters.join(', ') : '-';

  // Renderizar jugadores en lobby
  renderLobbyPlayers();

  // Gestión de Vistas según estado
  if (state.status === 'LOBBY') {
    setView('lobby');
    overlayStop.classList.add('hidden');
    overlayStop.classList.remove('flex');
    spotlightModal.classList.add('hidden');
    voteModal.classList.add('hidden');
  } else if (state.status === 'ROUND_ACTIVE') {
    setView('roundActive');
    overlayStop.classList.add('hidden');
    overlayStop.classList.remove('flex');
    spotlightModal.classList.add('hidden');
    voteModal.classList.add('hidden');

    document.getElementById('activeLetterBadge').textContent = currentLetter;
    document.getElementById('activeLetterText').textContent = currentLetter;
    document.getElementById('activeRoundNumber').textContent = state.roundNumber;

    renderLivePlayersProgress();
  } else if (state.status === 'STOP_COUNTDOWN') {
    overlayStop.classList.remove('hidden');
    overlayStop.classList.add('flex');
    document.getElementById('stopCallerName').textContent = state.stopCalledBy || '¡Alguien!';
  } else if (state.status === 'REVIEW') {
    setView('review');
    overlayStop.classList.add('hidden');
    overlayStop.classList.remove('flex');
    document.getElementById('reviewLetterBadge').textContent = currentLetter;
    currentReviewCatIndex = state.reviewCategoryIndex || 0;
    renderReviewView();
  } else if (state.status === 'LEADERBOARD') {
    setView('leaderboard');
    overlayStop.classList.add('hidden');
    spotlightModal.classList.add('hidden');
    voteModal.classList.add('hidden');
    renderLeaderboard();
  }
});

socket.on('host:detailed_data', (data) => {
  detailedAnswers = data.answers || {};
  if (views.review && !views.review.classList.contains('hidden')) {
    renderReviewView();
  }
  if (views.roundActive && !views.roundActive.classList.contains('hidden')) {
    renderLivePlayersProgress();
  }
});

socket.on('round:stop_called', ({ callerName, seconds }) => {
  audio.stopAlarm();
  overlayStop.classList.remove('hidden');
  overlayStop.classList.add('flex');
  document.getElementById('stopCallerName').textContent = callerName;
  document.getElementById('stopCountdownNum').textContent = seconds;
});

socket.on('round:stop_tick', ({ seconds }) => {
  audio.tick();
  document.getElementById('stopCountdownNum').textContent = seconds;
});

// Renderizar jugadores en el lobby
function renderLobbyPlayers() {
  const container = document.getElementById('lobbyPlayersList');
  if (players.length === 0) {
    container.innerHTML = `<div class="text-xs text-slate-500 italic py-2">Esperando a que los jugadores escaneen el QR...</div>`;
    return;
  }

  container.innerHTML = '';
  players.forEach(p => {
    const card = document.createElement('div');
    card.className = 'bg-white/10 border border-white/10 rounded-xl px-3 py-2 flex items-center gap-2 text-xs font-bold text-white shadow-sm';
    card.innerHTML = `
      <span class="text-base">${p.avatar}</span>
      <span>${p.nickname}</span>
    `;
    container.appendChild(card);
  });
}

// Renderizar progreso de jugadores durante la ronda
function renderLivePlayersProgress() {
  const container = document.getElementById('livePlayersProgress');
  container.innerHTML = '';

  players.forEach(p => {
    const playerAns = detailedAnswers[p.id] || {};
    const filledCount = Object.values(playerAns).filter(a => a && a.text && a.text.trim().length > 0).length;
    const totalCats = categories.length;
    const percent = totalCats > 0 ? Math.round((filledCount / totalCats) * 100) : 0;

    const card = document.createElement('div');
    card.className = 'bg-black/30 border border-white/10 rounded-2xl p-4 flex flex-col gap-2';
    card.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-2xl">${p.avatar}</span>
          <span class="font-outfit font-bold text-base text-white">${p.nickname}</span>
        </div>
        <span class="text-xs font-bold ${percent === 100 ? 'text-amber-400' : 'text-slate-400'}">
          ${filledCount}/${totalCats} completadas
        </span>
      </div>
      <div class="w-full bg-white/10 rounded-full h-2 overflow-hidden">
        <div class="h-full bg-gradient-to-r from-amber-400 to-emerald-400 rounded-full transition-all duration-300" style="width: ${percent}%"></div>
      </div>
    `;
    container.appendChild(card);
  });
}

// ==================== REVIEW / MODO SHOWMAN ====================

function renderReviewView() {
  const catTabs = document.getElementById('reviewCatTabs');
  catTabs.innerHTML = '';

  categories.forEach((cat, idx) => {
    const btn = document.createElement('button');
    const isActive = idx === currentReviewCatIndex;
    btn.className = `px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
      isActive
        ? 'bg-amber-400 text-slate-950 shadow-md font-extrabold'
        : 'bg-white/5 text-slate-300 hover:bg-white/15'
    }`;
    btn.textContent = cat;
    btn.onclick = () => {
      audio.click();
      currentReviewCatIndex = idx;
      socket.emit('host:set_review_category', { index: idx });
      renderReviewView();
    };
    catTabs.appendChild(btn);
  });

  const activeCategory = categories[currentReviewCatIndex] || categories[0];
  document.getElementById('currentReviewCatTitle').textContent = activeCategory;

  // Renderizar respuestas para esta categoría
  const grid = document.getElementById('reviewAnswersGrid');
  grid.innerHTML = '';

  players.forEach(p => {
    const pAns = detailedAnswers[p.id] || {};
    const item = pAns[activeCategory] || { text: '', status: 'invalid', points: 0 };
    const textVal = (item.text || '').trim();

    let statusBadge = '';
    let borderClass = 'border-white/10';

    if (!textVal) {
      statusBadge = '<span class="text-xs font-bold text-slate-500 bg-white/5 px-2 py-0.5 rounded">En blanco (0)</span>';
    } else if (item.status === 'valid') {
      statusBadge = '<span class="text-xs font-bold text-emerald-300 bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded">Única (+100)</span>';
      borderClass = 'border-emerald-500/40 bg-emerald-950/20';
    } else if (item.status === 'repeated') {
      statusBadge = '<span class="text-xs font-bold text-amber-300 bg-amber-950/80 border border-amber-500/30 px-2 py-0.5 rounded">Repetida (+50)</span>';
      borderClass = 'border-amber-500/40 bg-amber-950/20';
    } else {
      statusBadge = '<span class="text-xs font-bold text-rose-300 bg-rose-950/80 border border-rose-500/30 px-2 py-0.5 rounded">Inválida (0)</span>';
      borderClass = 'border-rose-500/30 bg-rose-950/20';
    }

    const card = document.createElement('div');
    card.className = `border ${borderClass} rounded-2xl p-5 backdrop-blur-xl flex flex-col justify-between gap-4 transition-transform hover:-translate-y-0.5`;

    card.innerHTML = `
      <div>
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <span class="text-xl">${p.avatar}</span>
            <span class="font-outfit font-bold text-white text-base">${p.nickname}</span>
          </div>
          ${statusBadge}
        </div>
        <p class="font-outfit font-black text-2xl text-amber-300 break-words my-2">
          ${textVal ? `"${textVal}"` : '<i class="text-slate-500 text-lg">Sin respuesta</i>'}
        </p>
      </div>

      <!-- Acciones de Showman -->
      <div class="flex items-center justify-between gap-2 pt-3 border-t border-white/10">
        <button onclick="openSpotlight('${p.id}', '${escapeQuotes(p.nickname)}', '${p.avatar}', '${escapeQuotes(activeCategory)}', '${escapeQuotes(textVal)}')" class="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors shadow">
          ⭐ Leer en Voz Alta
        </button>

        <!-- Ajuste rápido de puntos -->
        <div class="flex items-center gap-1">
          <button onclick="overrideStatus('${p.id}', '${escapeQuotes(activeCategory)}', 'valid', 100)" class="w-8 h-8 rounded-lg bg-emerald-600/40 hover:bg-emerald-600 text-white font-bold text-xs transition-colors" title="Puntuar 100">
            100
          </button>
          <button onclick="overrideStatus('${p.id}', '${escapeQuotes(activeCategory)}', 'repeated', 50)" class="w-8 h-8 rounded-lg bg-amber-600/40 hover:bg-amber-600 text-white font-bold text-xs transition-colors" title="Puntuar 50">
            50
          </button>
          <button onclick="overrideStatus('${p.id}', '${escapeQuotes(activeCategory)}', 'invalid', 0)" class="w-8 h-8 rounded-lg bg-rose-600/40 hover:bg-rose-600 text-white font-bold text-xs transition-colors" title="Puntuar 0">
            0
          </button>
        </div>
      </div>
    `;

    grid.appendChild(card);
  });
}

function escapeQuotes(str) {
  return (str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function prevReviewCategory() {
  audio.click();
  if (currentReviewCatIndex > 0) {
    currentReviewCatIndex--;
    socket.emit('host:set_review_category', { index: currentReviewCatIndex });
    renderReviewView();
  }
}

function nextReviewCategory() {
  audio.click();
  if (currentReviewCatIndex < categories.length - 1) {
    currentReviewCatIndex++;
    socket.emit('host:set_review_category', { index: currentReviewCatIndex });
    renderReviewView();
  } else {
    finishRoundScores();
  }
}

function overrideStatus(playerId, category, status, points) {
  audio.click();
  socket.emit('host:override_answer_status', { playerId, category, status, points });
}

// ==================== MODO SPOTLIGHT ====================

function openSpotlight(playerId, playerName, avatar, category, answer) {
  audio.spotlight();
  activeSpotlightData = { playerId, playerName, avatar, category, answer };

  document.getElementById('spotlightCategory').textContent = `Categoría: ${category}`;
  document.getElementById('spotlightAnswerText').textContent = answer ? `"${answer}"` : 'Sin respuesta';
  document.getElementById('spotlightAuthor').textContent = playerName;
  document.getElementById('spotlightAvatar').textContent = avatar;

  spotlightModal.classList.remove('hidden');
  spotlightModal.classList.add('flex');

  // Emitir spotlight a los demás
  socket.emit('host:spotlight_answer', { playerId, category, answer, playerName });
}

function closeSpotlight() {
  audio.click();
  spotlightModal.classList.add('hidden');
  spotlightModal.classList.remove('flex');
}

function approveFromSpotlight(points) {
  if (!activeSpotlightData) return;
  const status = points === 100 ? 'valid' : points === 50 ? 'repeated' : 'invalid';
  if (points > 0) audio.valid();
  else audio.invalid();

  overrideStatus(activeSpotlightData.playerId, activeSpotlightData.category, status, points);
  closeSpotlight();
}

// ==================== VOTACIÓN COMUNITARIA ====================

function triggerVoteFromSpotlight() {
  if (!activeSpotlightData) return;
  audio.spotlight();
  socket.emit('host:start_vote', {
    category: activeSpotlightData.category,
    answer: activeSpotlightData.answer,
    playerName: activeSpotlightData.playerName,
    playerId: activeSpotlightData.playerId,
    duration: 10
  });
  closeSpotlight();
}

socket.on('vote:started', (data) => {
  audio.spotlight();
  currentVoteData = data;
  document.getElementById('voteAnswerText').textContent = `"${data.answer}"`;
  document.getElementById('voteCategoryText').textContent = data.category;
  document.getElementById('voteAuthorText').textContent = data.playerName;
  document.getElementById('voteSeconds').textContent = data.duration;
  document.getElementById('voteUpCount').textContent = '0';
  document.getElementById('voteDownCount').textContent = '0';

  voteModal.classList.remove('hidden');
  voteModal.classList.add('flex');
});

socket.on('vote:tick', ({ seconds }) => {
  audio.tick();
  document.getElementById('voteSeconds').textContent = seconds;
});

socket.on('vote:ended', ({ isValid, upCount, downCount }) => {
  if (isValid) audio.valid();
  else audio.invalid();

  setTimeout(() => {
    voteModal.classList.add('hidden');
    voteModal.classList.remove('flex');
    renderReviewView();
  }, 1800);
});

// ==================== PODIO Y LEADERBOARD ====================

function finishRoundScores() {
  audio.victory();
  socket.emit('host:finish_round_scores');
}

function renderLeaderboard() {
  // Disparar confeti de celebración
  if (typeof confetti === 'function') {
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 }
    });
  }

  // Ordenar jugadores por puntuación acumulada
  const sorted = [...players].sort((a, b) => b.score - a.score);

  // Top 3 Podio
  const podium = document.getElementById('podiumTop3');
  podium.innerHTML = '';

  const order = [
    { p: sorted[1], rank: 2, height: 'h-48', color: 'from-slate-400 to-slate-600', medal: '🥈' },
    { p: sorted[0], rank: 1, height: 'h-64', color: 'from-amber-400 to-amber-600', medal: '👑' },
    { p: sorted[2], rank: 3, height: 'h-40', color: 'from-amber-700 to-amber-900', medal: '🥉' }
  ];

  order.forEach(item => {
    if (!item.p) return;
    const col = document.createElement('div');
    col.className = 'flex flex-col items-center justify-end flex-1 max-w-[180px]';
    col.innerHTML = `
      <div class="text-3xl mb-1">${item.medal}</div>
      <div class="text-2xl">${item.p.avatar}</div>
      <div class="font-outfit font-bold text-white text-base truncate max-w-[140px]">${item.p.nickname}</div>
      <div class="text-amber-300 font-extrabold text-lg mb-2">${item.p.score} pts</div>
      <div class="w-full ${item.height} bg-gradient-to-t ${item.color} rounded-t-2xl flex items-center justify-center font-outfit font-black text-4xl text-slate-950 shadow-xl">
        ${item.rank}
      </div>
    `;
    podium.appendChild(col);
  });

  // Lista completa
  const list = document.getElementById('fullScoreboardList');
  list.innerHTML = '';

  sorted.forEach((p, idx) => {
    const row = document.createElement('div');
    row.className = 'bg-black/30 border border-white/10 rounded-2xl p-4 flex items-center justify-between';
    row.innerHTML = `
      <div class="flex items-center gap-3">
        <span class="font-outfit font-black text-lg text-slate-400 w-6">#${idx + 1}</span>
        <span class="text-2xl">${p.avatar}</span>
        <div>
          <h4 class="font-outfit font-bold text-white text-base">${p.nickname}</h4>
          <span class="text-xs text-emerald-400 font-semibold">+${p.roundScore || 0} pts esta ronda</span>
        </div>
      </div>
      <div class="font-outfit font-black text-2xl text-amber-300">
        ${p.score} <span class="text-xs text-slate-400 font-normal">pts</span>
      </div>
    `;
    list.appendChild(row);
  });
}

function resetToLobby() {
  audio.click();
  socket.emit('host:reset_to_lobby');
}

// Atajos de teclado para el Host
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeSpotlight();
  }
});
