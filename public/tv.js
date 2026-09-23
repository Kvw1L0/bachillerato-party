// ============================================================================
// LÓGICA DE LA PANTALLA DE TV GIGANTE (PROYECTOR) - MODO FIREBASE / VERCEL
// ============================================================================

let currentRoomCode = 'BACH1';
let currentLetter = 'A';
let activeCategories = [];
let players = [];
let roundTimeLimit = 60;
let lastCarouselTimestamp = 0;
let currentTypingList = [];
let stopCountdownTimer = null;
let roomTimerInterval = null;

// Vistas
const views = {
  lobby: document.getElementById('tvViewLobby'),
  roulette: document.getElementById('tvViewRoulette'),
  roundActive: document.getElementById('tvViewRoundActive'),
  leaderboard: document.getElementById('tvViewLeaderboard')
};

const overlayStop = document.getElementById('tvOverlayStop');
const spotlightOverlay = document.getElementById('tvSpotlightOverlay');

function setTvView(viewName) {
  Object.keys(views).forEach(k => {
    views[k].classList.add('hidden');
    views[k].classList.remove('flex');
  });
  if (views[viewName]) {
    views[viewName].classList.remove('hidden');
    views[viewName].classList.add('flex');
  }
}

// Inicialización
window.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  currentRoomCode = (urlParams.get('room') || 'BACH1').toUpperCase();

  // Generar URL para jugadores y Código QR directamente en el cliente (Funciona en Vercel)
  const playerUrl = `${window.location.origin}/?room=${currentRoomCode}`;
  document.getElementById('tvPlayerUrl').textContent = playerUrl;

  if (typeof QRCode !== 'undefined') {
    QRCode.toDataURL(playerUrl, {
      margin: 2,
      width: 400,
      color: { dark: '#0f172a', light: '#ffffff' }
    }, (err, url) => {
      if (!err && url) {
        document.getElementById('tvQrImage').src = url;
      }
    });
  }

  // Inicializar carrusel en reposo para que nunca esté vacío
  initIdleCarousel();

  // Suscribirse a Firebase Realtime Database
  subscribeToRoom(currentRoomCode, onRoomStateUpdated);
});

// Aplicar fondo PNG personalizado o revertir
function applyTvBackground(bgUrl) {
  const body = document.getElementById('tvBody');
  const vignette = document.getElementById('vignetteOverlay');
  if (bgUrl) {
    body.style.backgroundImage = `url('${bgUrl}')`;
    body.classList.remove('default-tv-bg');
    if (vignette) vignette.className = 'absolute inset-0 bg-black/60 pointer-events-none z-0';
  } else {
    body.style.backgroundImage = 'none';
    body.classList.add('default-tv-bg');
    if (vignette) vignette.className = 'absolute inset-0 bg-black/40 pointer-events-none z-0';
  }
}

// Inicializar carrusel de letras en reposo
function initIdleCarousel() {
  const track = document.getElementById('carouselTrack');
  if (!track || track.children.length > 0) return;
  const container = track.parentElement;
  const containerWidth = container.offsetWidth || window.innerWidth;
  const centerX = containerWidth / 2;

  const cardWidth = 140;
  const cardGap = 16;
  const stepWidth = cardWidth + cardGap;
  const cardHalf = cardWidth / 2;

  const alphabet = ALPHABET_ALL;
  const totalCards = 130;
  const initialIndex = 12;

  track.innerHTML = '';
  for (let i = 0; i < totalCards; i++) {
    const card = document.createElement('div');
    card.className = 'w-[140px] h-[190px] mx-2 rounded-2xl flex-shrink-0 flex items-center justify-center font-outfit font-black text-7xl shadow-2xl transition-all border bg-slate-900/90 text-white border-white/10';
    card.textContent = alphabet[i % alphabet.length];
    track.appendChild(card);
  }

  const startX = centerX - ((initialIndex * stepWidth) + cardHalf);
  track.style.transition = 'none';
  track.style.transform = `translateX(${startX}px)`;
}

// ==================== ACTUALIZACIONES DE SALA EN TIEMPO REAL ====================

function onRoomStateUpdated(state) {
  if (!state) return;

  currentLetter = state.letter || currentLetter;
  activeCategories = state.categories || [];
  players = Object.values(state.players || {});
  roundTimeLimit = state.roundTimeLimit !== undefined ? state.roundTimeLimit : 60;

  // Actualizar fondo global
  applyTvBackground(state.backgroundUrl);

  // Contador de jugadores en sala
  const lobbyCount = document.getElementById('tvLobbyCount');
  if (lobbyCount) lobbyCount.textContent = players.length;

  renderLobbyPlayers();

  // Control de Vistas
  if (state.status === 'LOBBY') {
    setTvView('lobby');
    overlayStop.classList.add('hidden');
    overlayStop.classList.remove('flex');
    spotlightOverlay.classList.add('hidden');
    document.getElementById('tvTimerBadge').classList.add('hidden');
    document.getElementById('tvTimerBadge').classList.remove('flex');
    clearInterval(roomTimerInterval);
  } else if (state.status === 'ROULETTE') {
    setTvView('roulette');
    overlayStop.classList.add('hidden');
    spotlightOverlay.classList.add('hidden');
    document.getElementById('tvTimerBadge').classList.add('hidden');

    // Comprobar si hay un nuevo evento de giro detonado por el Admin
    if (state.carouselEvent && state.carouselEvent.timestamp > lastCarouselTimestamp) {
      lastCarouselTimestamp = state.carouselEvent.timestamp;
      runNetflixCarouselAnimation(state.carouselEvent.targetLetter || currentLetter);
    }
  } else if (state.status === 'ROUND_ACTIVE') {
    setTvView('roundActive');
    overlayStop.classList.add('hidden');
    overlayStop.classList.remove('flex');
    spotlightOverlay.classList.add('hidden');

    document.getElementById('tvActiveLetter').textContent = currentLetter;
    document.getElementById('tvActiveLetterText').textContent = currentLetter;
    document.getElementById('tvActiveRoundNum').textContent = state.roundNumber || 1;

    renderActiveCategories();

    // Sincronización del cronómetro
    syncRoundTimer(state.timerStartedAt, state.roundTimeLimit);

    // Actualizar actividad de tipeo
    currentTypingList = Object.values(state.typing || {});
    renderTypingActivity();
    renderPlayersProgress();
  } else if (state.status === 'STOP_COUNTDOWN') {
    triggerStopCountdown(state.stopCaller);
  } else if (state.status === 'REVIEW') {
    overlayStop.classList.add('hidden');
    overlayStop.classList.remove('flex');
    clearInterval(roomTimerInterval);

    // Spotlight proyectado para leer en voz alta
    if (state.currentSpotlight) {
      showSpotlightModal(state.currentSpotlight);
    } else {
      spotlightOverlay.classList.add('hidden');
      spotlightOverlay.classList.remove('flex');
    }
  } else if (state.status === 'LEADERBOARD') {
    setTvView('leaderboard');
    overlayStop.classList.add('hidden');
    spotlightOverlay.classList.add('hidden');
    document.getElementById('tvTimerBadge').classList.add('hidden');
    clearInterval(roomTimerInterval);
    renderTvLeaderboard();
  }
}

// Renderizar jugadores en el Lobby
function renderLobbyPlayers() {
  const grid = document.getElementById('tvPlayersGrid');
  if (players.length === 0) {
    grid.innerHTML = `<div class="text-sm text-slate-400 italic py-6 w-full text-center">Esperando a que los jugadores escaneen el código QR...</div>`;
    return;
  }

  grid.innerHTML = '';
  players.forEach(p => {
    const card = document.createElement('div');
    card.className = 'bg-white/10 border border-white/20 rounded-2xl px-4 py-3 flex items-center gap-3 text-white shadow-lg animate-bounce duration-500';
    card.style.animationIterationCount = '1';
    card.innerHTML = `
      <span class="text-3xl">${p.avatar}</span>
      <div>
        <span class="font-outfit font-bold text-base block">${p.nickname}</span>
        <span class="text-[10px] text-emerald-400 font-semibold">✓ Conectado</span>
      </div>
    `;
    grid.appendChild(card);
  });
}

// Renderizar categorías en la ronda activa
function renderActiveCategories() {
  const container = document.getElementById('tvActiveCategoriesGrid');
  container.innerHTML = '';

  activeCategories.forEach((cat, idx) => {
    const item = document.createElement('div');
    item.className = 'bg-black/40 border border-white/10 rounded-2xl p-4 flex items-center gap-3 backdrop-blur-md shadow-md';
    item.innerHTML = `
      <div class="w-8 h-8 rounded-xl bg-amber-400/20 text-amber-300 font-outfit font-black text-sm flex items-center justify-center">
        ${idx + 1}
      </div>
      <span class="font-outfit font-bold text-base text-white">${cat}</span>
    `;
    container.appendChild(item);
  });
}

// Renderizar barras de progreso durante la ronda
function renderPlayersProgress() {
  const container = document.getElementById('tvPlayersProgressList');
  if (!container) return;
  container.innerHTML = '';

  players.forEach(p => {
    const isTyping = currentTypingList.some(tp => tp.id === p.id);
    const card = document.createElement('div');
    card.className = `border rounded-xl p-3 flex items-center justify-between transition-all ${
      isTyping
        ? 'bg-amber-400/20 border-amber-400 shadow-lg scale-102'
        : 'bg-white/5 border-white/10'
    }`;
    card.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="text-2xl">${p.avatar}</span>
        <span class="font-outfit font-bold text-sm text-white truncate max-w-[100px]">${p.nickname}</span>
      </div>
      <span class="text-xs ${
        isTyping 
          ? 'text-amber-300 font-bold flex items-center gap-1 animate-pulse' 
          : p.submitted 
            ? 'text-emerald-400 font-bold' 
            : 'text-slate-400'
      }">
        ${isTyping ? '✍️ Escribiendo...' : p.submitted ? '✓ Listo' : 'Pensando...'}
      </span>
    `;
    container.appendChild(card);
  });
}

// Barra de escribiendo en vivo
function renderTypingActivity() {
  const container = document.getElementById('tvTypingAvatarsRow');
  if (!container) return;

  if (currentTypingList.length === 0) {
    container.innerHTML = `<span class="text-xs text-slate-400 italic">💡 ¡Todos pensando sus respuestas!</span>`;
  } else {
    container.innerHTML = '';
    currentTypingList.forEach(p => {
      const bubble = document.createElement('div');
      bubble.className = 'flex items-center gap-2 bg-white/10 border border-amber-400/50 px-3 py-1.5 rounded-full shadow-md animate-pulse';
      bubble.innerHTML = `
        <span class="text-xl">${p.avatar}</span>
        <span class="text-xs font-bold text-white">${p.nickname}</span>
        <span class="flex gap-1 items-center ml-1">
          <span class="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce"></span>
          <span class="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style="animation-delay: 0.15s"></span>
          <span class="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style="animation-delay: 0.3s"></span>
        </span>
      `;
      container.appendChild(bubble);
    });
  }
}

// ==================== CARRUSEL DE LETRAS ESTILO NETFLIX ====================

function runNetflixCarouselAnimation(targetLetter) {
  document.getElementById('rouletteResultBox').style.opacity = '0';

  const track = document.getElementById('carouselTrack');
  const container = track.parentElement;
  const containerWidth = container.offsetWidth || window.innerWidth;
  const centerX = containerWidth / 2;

  const cardWidth = 140; // px
  const cardGap = 16;    // px
  const stepWidth = cardWidth + cardGap; // 156px
  const cardHalf = cardWidth / 2; // 70px

  const alphabet = ALPHABET_ALL;
  const totalCards = 130;
  const targetIndex = 85;
  const initialIndex = 12;

  track.innerHTML = '';

  for (let i = 0; i < totalCards; i++) {
    const isTarget = (i === targetIndex);
    const letter = isTarget ? targetLetter : alphabet[i % alphabet.length];
    
    const card = document.createElement('div');
    card.className = `w-[140px] h-[190px] mx-2 rounded-2xl flex-shrink-0 flex items-center justify-center font-outfit font-black text-7xl shadow-2xl transition-all border ${
      isTarget 
        ? 'bg-gradient-to-tr from-amber-400 via-amber-500 to-orange-500 text-slate-950 border-amber-300 scale-105' 
        : 'bg-slate-900/90 text-white border-white/10'
    }`;
    card.textContent = letter;
    track.appendChild(card);
  }

  const startX = centerX - ((initialIndex * stepWidth) + cardHalf);
  track.style.transition = 'none';
  track.style.transform = `translateX(${startX}px)`;

  const targetX = centerX - ((targetIndex * stepWidth) + cardHalf);

  let tickInterval = setInterval(() => {
    audio.wheelTick();
  }, 100);

  requestAnimationFrame(() => {
    track.style.transition = 'transform 5.0s cubic-bezier(0.12, 0.85, 0.22, 1)';
    track.style.transform = `translateX(${targetX}px)`;

    setTimeout(() => {
      clearInterval(tickInterval);
      audio.spotlight();

      const resultBox = document.getElementById('rouletteResultBox');
      document.getElementById('rouletteFinalLetter').textContent = targetLetter;
      resultBox.style.opacity = '1';

      if (typeof confetti === 'function') {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      }
    }, 5100);
  });
}

// ==================== CRONÓMETRO DE RONDA & TENSIÓN ÚLTIMOS 10s ====================

function syncRoundTimer(timerStartedAt, duration) {
  clearInterval(roomTimerInterval);
  if (!duration || duration <= 0 || !timerStartedAt) {
    document.getElementById('tvRoundClockContainer').classList.add('hidden');
    document.getElementById('tvTimerBadge').classList.add('hidden');
    return;
  }

  document.getElementById('tvRoundClockContainer').classList.remove('hidden');
  document.getElementById('tvTimerBadge').classList.remove('hidden');
  document.getElementById('tvTimerBadge').classList.add('flex');

  function update() {
    const elapsed = Math.floor((Date.now() - timerStartedAt) / 1000);
    const timeRemaining = Math.max(0, duration - elapsed);

    const clockNum = document.getElementById('tvRoundClockNumber');
    const timerBadge = document.getElementById('tvTimerBadge');
    const timerText = document.getElementById('tvTimerText');
    const vignette = document.getElementById('vignetteOverlay');

    if (clockNum) clockNum.textContent = timeRemaining;
    if (timerText) timerText.textContent = `${timeRemaining}s`;

    if (timeRemaining <= 10 && timeRemaining > 0) {
      audio.tensionTick(timeRemaining);

      if (clockNum) {
        clockNum.className = 'font-outfit font-black text-8xl text-red-500 animate-pulse text-glow-red transition-all scale-110';
      }
      if (timerBadge) {
        timerBadge.className = 'flex items-center gap-2 px-5 py-2 rounded-full bg-red-600 text-white font-outfit font-black text-lg shadow-2xl animate-pulse glow-red-tv';
      }
      if (vignette) {
        vignette.className = 'absolute inset-0 bg-red-950/40 border-8 border-red-600/70 pointer-events-none z-0 animate-pulse transition-all';
      }
    } else if (timeRemaining === 0) {
      audio.buzzer();
      clearInterval(roomTimerInterval);
      if (vignette) {
        vignette.className = 'absolute inset-0 bg-black/50 pointer-events-none z-0 transition-all';
      }
    } else {
      if (clockNum) {
        clockNum.className = 'font-outfit font-black text-6xl text-amber-300';
      }
      if (timerBadge) {
        timerBadge.className = 'flex items-center gap-2 px-5 py-2 rounded-full bg-amber-400 text-slate-950 font-outfit font-black text-lg shadow-xl glow-gold-tv';
      }
      if (vignette) {
        vignette.className = 'absolute inset-0 bg-black/50 pointer-events-none z-0 transition-all';
      }
    }
  }

  update();
  roomTimerInterval = setInterval(update, 1000);
}

// ==================== CARTEL MONUMENTAL DE STOP ====================

let isStopActive = false;
function triggerStopCountdown(caller) {
  if (isStopActive) return;
  isStopActive = true;
  audio.stopAlarm();
  clearInterval(roomTimerInterval);

  const vignette = document.getElementById('vignetteOverlay');
  if (vignette) {
    vignette.className = 'absolute inset-0 bg-black/50 pointer-events-none z-0 transition-all';
  }

  const callerName = (caller && caller.nickname) ? caller.nickname : 'Alguien';
  const callerAvatar = (caller && caller.avatar) ? caller.avatar : '⚡';

  document.getElementById('tvStopHeroName').textContent = callerName.toUpperCase();
  document.getElementById('tvStopHeroAvatar').textContent = callerAvatar;

  overlayStop.classList.remove('hidden');
  overlayStop.classList.add('flex');

  let sec = 5;
  document.getElementById('tvStopCountdownNumber').textContent = sec;

  clearInterval(stopCountdownTimer);
  stopCountdownTimer = setInterval(() => {
    sec--;
    audio.tick();
    document.getElementById('tvStopCountdownNumber').textContent = sec;
    if (sec <= 0) {
      clearInterval(stopCountdownTimer);
      isStopActive = false;
    }
  }, 1000);
}

// ==================== PROYECTOR DE RESPUESTAS (SPOTLIGHT SHOWMAN) ====================

function showSpotlightModal(data) {
  audio.spotlight();
  document.getElementById('tvSpotlightCategory').textContent = `Categoría: ${data.category}`;
  document.getElementById('tvSpotlightAnswer').textContent = `"${data.answer || 'Sin respuesta'}"`;
  document.getElementById('tvSpotlightAuthor').textContent = data.playerName;
  document.getElementById('tvSpotlightAvatar').textContent = data.avatar || '🐱';

  spotlightOverlay.classList.remove('hidden');
  spotlightOverlay.classList.add('flex');
}

// ==================== RANKING DINÁMICO ESTILO KAHOOT ====================

function renderTvLeaderboard() {
  audio.victory();

  if (typeof confetti === 'function') {
    confetti({
      particleCount: 160,
      spread: 100,
      origin: { y: 0.5 }
    });
  }

  const sorted = [...players].sort((a, b) => b.score - a.score);
  const container = document.getElementById('tvKahootRanking');
  container.innerHTML = '';

  if (sorted.length === 0) {
    container.innerHTML = `<div class="text-slate-400 italic py-8">No hay puntuaciones registradas aún</div>`;
    return;
  }

  sorted.forEach((p, idx) => {
    const rank = idx + 1;
    let badgeColor = 'bg-slate-700 text-white';
    let borderColor = 'border-white/10';
    let rowBg = 'bg-black/50';

    if (rank === 1) {
      badgeColor = 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black shadow-lg';
      borderColor = 'border-amber-400/60 shadow-xl glow-gold-tv';
      rowBg = 'bg-gradient-to-r from-amber-950/40 via-black/60 to-black/60';
    } else if (rank === 2) {
      badgeColor = 'bg-gradient-to-r from-slate-300 to-slate-400 text-slate-950 font-black shadow-md';
      borderColor = 'border-slate-300/40';
      rowBg = 'bg-gradient-to-r from-slate-900/40 via-black/60 to-black/60';
    } else if (rank === 3) {
      badgeColor = 'bg-gradient-to-r from-amber-700 to-amber-800 text-white font-black shadow-md';
      borderColor = 'border-amber-700/40';
      rowBg = 'bg-gradient-to-r from-amber-950/20 via-black/60 to-black/60';
    }

    const row = document.createElement('div');
    row.className = `w-full border-2 ${borderColor} ${rowBg} rounded-2xl p-4 flex items-center justify-between backdrop-blur-xl transition-all duration-700 hover:scale-[1.01]`;
    row.style.animation = `fadeInUp 0.5s ease backwards ${idx * 0.12}s`;

    row.innerHTML = `
      <div class="flex items-center gap-4">
        <div class="w-12 h-12 rounded-xl ${badgeColor} font-outfit font-black text-2xl flex items-center justify-center">
          ${rank}
        </div>
        <div class="flex items-center gap-3">
          <span class="text-4xl">${p.avatar}</span>
          <div class="text-left">
            <h3 class="font-outfit font-black text-2xl text-white tracking-wide">${p.nickname}</h3>
            ${
              p.roundScore > 0 
                ? `<span class="text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                     🔥 +${p.roundScore} pts esta ronda
                   </span>`
                : `<span class="text-xs text-slate-500 font-medium">0 pts esta ronda</span>`
            }
          </div>
        </div>
      </div>

      <div class="text-right">
        <span class="font-titan text-4xl text-amber-300 text-glow-gold tracking-wider">${p.score}</span>
        <span class="text-xs font-bold text-slate-400 block uppercase tracking-widest">puntos</span>
      </div>
    `;

    container.appendChild(row);
  });
}
