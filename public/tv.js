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
  leaderboard: document.getElementById('tvViewLeaderboard'),
  closed: document.getElementById('tvViewClosed')
};

const overlayStop = document.getElementById('tvOverlayStop');
const spotlightOverlay = document.getElementById('tvSpotlightOverlay');

function setTvView(viewName) {
  Object.keys(views).forEach(k => {
    if (views[k]) {
      views[k].classList.add('hidden');
      views[k].classList.remove('flex');
    }
  });
  if (views[viewName]) {
    views[viewName].classList.remove('hidden');
    views[viewName].classList.add('flex');
  }
}

// Resetear completamente la pantalla a Foja Cero
function resetTvStateToZero() {
  overlayStop.classList.add('hidden');
  overlayStop.classList.remove('flex');
  isStopActive = false;
  clearInterval(stopCountdownTimer);
  clearInterval(roomTimerInterval);

  if (carouselAnimationId) {
    cancelAnimationFrame(carouselAnimationId);
    carouselAnimationId = null;
  }
  isRouletteSpinning = false;

  spotlightOverlay.classList.add('hidden');
  spotlightOverlay.classList.remove('flex');

  const timerBadge = document.getElementById('tvTimerBadge');
  if (timerBadge) {
    timerBadge.classList.add('hidden');
    timerBadge.classList.remove('flex');
  }

  const vignette = document.getElementById('vignetteOverlay');
  if (vignette) {
    vignette.className = 'absolute inset-0 bg-black/50 pointer-events-none z-0 transition-all';
  }

  players = [];
  renderLobbyPlayers();
  renderCompletedPlayers({ players: {}, answers: {} });
}

let currentRoomSubscription = null;

function subscribeTvToRoom(roomCode) {
  if (currentRoomSubscription && typeof currentRoomSubscription.off === 'function') {
    currentRoomSubscription.off();
  }
  currentRoomCode = roomCode.toUpperCase().trim();
  updateTvQrAndPin(currentRoomCode);
  currentRoomSubscription = subscribeToRoom(currentRoomCode, onRoomStateUpdated);
}

function updateTvQrAndPin(pin) {
  const cleanPin = (pin || 'BACH1').toString().trim().toUpperCase();
  const pinDisplay = document.getElementById('tvRoomPinDisplay');
  if (pinDisplay) pinDisplay.textContent = cleanPin;

  const playerUrl = `${window.location.origin}/?room=${cleanPin}`;
  const urlEl = document.getElementById('tvPlayerUrl');
  if (urlEl) urlEl.textContent = playerUrl;

  const qrImg = document.getElementById('tvQrImage');
  if (qrImg) {
    // 1. Asignar de inmediato URL de respaldo garantizada (alta resolución 600x600 para código gigante)
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=10&data=${encodeURIComponent(playerUrl)}`;

    // 2. Si la biblioteca cliente local está cargada, generar Data URL offline
    if (typeof QRCode !== 'undefined' && typeof QRCode.toDataURL === 'function') {
      try {
        QRCode.toDataURL(playerUrl, {
          margin: 2,
          width: 600,
          color: { dark: '#0f172a', light: '#ffffff' }
        }, (err, url) => {
          if (!err && url) {
            qrImg.src = url;
          }
        });
      } catch (e) {
        // En caso de excepción, qrImg.src ya tiene la URL garantizada
      }
    }
  }
}

// Inicialización
window.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const roomParam = urlParams.get('room');

  // Inicializar carrusel en reposo para que nunca esté vacío
  initIdleCarousel();

  if (roomParam) {
    subscribeTvToRoom(roomParam);
  } else {
    // Generar el QR de inmediato con la sala en caché para que aparezca desde el milisegundo 1
    const cachedPin = (localStorage.getItem('bach_admin_room') || 'BACH1').toUpperCase();
    updateTvQrAndPin(cachedPin);

    // Escuchar automáticamente la sala activa en Firebase para que la TV siempre se conecte al juego del Anfitrión
    getActiveRoomFromFirebase((activePin) => {
      const pinToUse = (activePin || localStorage.getItem('bach_admin_room') || 'BACH1').toUpperCase();
      if (pinToUse !== currentRoomCode || !currentRoomSubscription) {
        subscribeTvToRoom(pinToUse);
      }
    });
  }
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

// ==================== MOTOR DE CARRUSEL INFINITO MONUMENTAL ====================
let carouselAnimationId = null;
let isRouletteSpinning = false;
let alphabetIndex = 0;
const CARD_STEP = 200; // 180px width + 20px gap (10px margin each side)
const CARD_WIDTH = 180;
const TOTAL_CONVEYOR_CARDS = 45; // 45 * 200 = 9,000px

function getNextAlphabetLetter() {
  const letter = ALPHABET_ALL[alphabetIndex % ALPHABET_ALL.length];
  alphabetIndex++;
  return letter;
}

// Inicializar carrusel en reposo para que nunca esté vacío
function initIdleCarousel() {
  const track = document.getElementById('carouselTrack');
  if (!track) return;
  track.innerHTML = '';
  track.style.transition = 'none';
  alphabetIndex = 0;

  for (let i = 0; i < TOTAL_CONVEYOR_CARDS; i++) {
    const card = document.createElement('div');
    card.className = 'w-[180px] h-[250px] mx-2.5 rounded-3xl flex-shrink-0 flex items-center justify-center font-outfit font-black text-8xl sm:text-9xl shadow-2xl transition-all border bg-slate-900/90 text-white border-white/10 select-none';
    card.textContent = getNextAlphabetLetter();
    track.appendChild(card);
  }

  const container = track.parentElement;
  const containerWidth = container.offsetWidth || window.innerWidth;
  const centerX = containerWidth / 2;
  const initialOffset = centerX - (4 * CARD_STEP + (CARD_WIDTH / 2));
  track.dataset.offset = initialOffset;
  track.style.transform = `translateX(${initialOffset}px)`;
}

// ==================== ACTUALIZACIONES DE SALA EN TIEMPO REAL ====================

function onRoomStateUpdated(state) {
  if (!state) return;

  // 1. Si la sala está CERRADA, resetear la pantalla a foja cero inmediatamente
  if (state.status === 'CLOSED') {
    resetTvStateToZero();
    setTvView('closed');
    return;
  }

  // 2. BLINDAJE STOP: Si el estado NO es STOP_COUNTDOWN, forzar que el cartel de STOP esté oculto
  if (state.status !== 'STOP_COUNTDOWN') {
    overlayStop.classList.add('hidden');
    overlayStop.classList.remove('flex');
    isStopActive = false;
    clearInterval(stopCountdownTimer);
  }

  currentLetter = state.letter || currentLetter;
  activeCategories = state.categories || [];
  players = Object.values(state.players || {});
  roundTimeLimit = state.roundTimeLimit !== undefined ? state.roundTimeLimit : 60;

  // Sincronizar PIN de la sala en pantalla
  const activePin = state.pin || state.code || currentRoomCode;
  const pinDisplay = document.getElementById('tvRoomPinDisplay');
  if (pinDisplay) pinDisplay.textContent = activePin;

  if (activePin !== currentRoomCode) {
    currentRoomCode = activePin;
    updateTvQrAndPin(currentRoomCode);
  }

  // Sincronizar Mute global desde el Admin
  if (state.isMuted !== undefined && state.isMuted !== audio.muted) {
    audio.setMuted(state.isMuted);
  }

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

    // Sincronización del cronómetro
    syncRoundTimer(state.timerStartedAt, state.roundTimeLimit);

    // Renderizar recuadro destacado de jugadores completados
    renderCompletedPlayers(state);
  } else if (state.status === 'STOP_COUNTDOWN') {
    renderCompletedPlayers(state);
    triggerStopCountdown(state.stopCaller);
  } else if (state.status === 'REVIEW') {
    overlayStop.classList.add('hidden');
    overlayStop.classList.remove('flex');
    clearInterval(roomTimerInterval);
    renderCompletedPlayers(state);

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
    card.className = 'bg-white/10 hover:bg-white/15 border border-white/20 rounded-2xl px-4 py-2.5 flex items-center gap-3 text-white shadow-md animate-bounce duration-500 backdrop-blur-md';
    card.style.animationIterationCount = '1';
    card.innerHTML = `
      <span class="text-3xl">${p.avatar || '🐱'}</span>
      <span class="font-outfit font-extrabold text-lg text-white truncate max-w-[160px]">${p.nickname || 'Jugador'}</span>
    `;
    grid.appendChild(card);
  });
}

// Renderizar recuadro destacado de jugadores completados
function renderCompletedPlayers(state) {
  const container = document.getElementById('tvCompletedPlayersGrid');
  const countBadge = document.getElementById('tvCompletedBadgeCount');
  if (!container) return;

  const currentPlayers = players || (state && state.players ? Object.values(state.players) : []);
  const answersMap = state && state.answers ? state.answers : {};

  // Un jugador se considera completado si p.submitted === true O si ya envió respuestas a la sala
  const completedList = currentPlayers.filter(p => {
    if (p.submitted === true) return true;
    if (answersMap[p.id]) {
      const pAnswers = Object.values(answersMap[p.id]);
      return pAnswers.some(ans => (ans.text || '').trim().length > 0);
    }
    return false;
  });

  if (countBadge) {
    countBadge.textContent = `${completedList.length} ${completedList.length === 1 ? 'listo' : 'listos'}`;
  }

  if (completedList.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = '';
  completedList.forEach(p => {
    const chip = document.createElement('div');
    chip.className = 'flex items-center gap-3 bg-gradient-to-r from-emerald-500/30 to-teal-500/30 border-2 border-emerald-400 px-5 py-2.5 rounded-2xl shadow-xl backdrop-blur-md animate-hero-pulse transition-all';
    chip.innerHTML = `
      <span class="text-3xl">${p.avatar || '🐱'}</span>
      <span class="font-outfit font-black text-xl text-white block leading-tight">${p.nickname || 'Jugador'}</span>
      <span class="text-emerald-400 text-lg font-black ml-1">✓</span>
    `;
    container.appendChild(chip);
  });
}

// ==================== MOTOR DE CARRUSEL INFINITO CONTINUO ====================

function runNetflixCarouselAnimation(targetLetter) {
  if (isRouletteSpinning) return;
  isRouletteSpinning = true;

  const resultBox = document.getElementById('rouletteResultBox');
  if (resultBox) resultBox.style.opacity = '0';

  const track = document.getElementById('carouselTrack');
  const container = track.parentElement;

  if (!track || track.children.length === 0) {
    initIdleCarousel();
  }

  track.style.transition = 'none';

  let currentOffset = parseFloat(track.dataset.offset || 0);
  if (isNaN(currentOffset)) currentOffset = 0;

  const containerWidth = container.offsetWidth || window.innerWidth;
  const centerX = containerWidth / 2;

  let speed = 38; // Velocidad inicial de giro rápido en px por frame
  let phase = 'SPINNING'; // 'SPINNING' -> 'TARGET_INJECTED' -> 'DECELERATING' -> 'DONE'
  const spinStartTime = Date.now();
  const spinDuration = 3000; // 3.0s a velocidad crucero
  let targetCardEl = null;
  let lastTick = 0;

  if (carouselAnimationId) {
    cancelAnimationFrame(carouselAnimationId);
  }

  function frame() {
    const now = Date.now();
    const elapsed = now - spinStartTime;

    // Sonido de rueda al pasar letras
    const tickInterval = phase === 'DECELERATING' ? 160 : 80;
    if (now - lastTick > tickInterval) {
      audio.wheelTick();
      lastTick = now;
    }

    if (phase === 'SPINNING') {
      currentOffset -= speed;

      // Reciclaje continuo: cuando una tarjeta sale a la izquierda, entra a la derecha
      while (currentOffset <= -CARD_STEP) {
        currentOffset += CARD_STEP;
        const first = track.firstElementChild;
        track.appendChild(first);
        first.textContent = getNextAlphabetLetter();
        first.className = 'w-[180px] h-[250px] mx-2.5 rounded-3xl flex-shrink-0 flex items-center justify-center font-outfit font-black text-8xl sm:text-9xl shadow-2xl transition-all border bg-slate-900/90 text-white border-white/10 select-none';
      }

      if (elapsed >= spinDuration) {
        // Inyectamos la letra ganadora dorada en el extremo derecho
        const target = track.lastElementChild;
        target.textContent = targetLetter;
        target.className = 'w-[180px] h-[250px] mx-2.5 rounded-3xl flex-shrink-0 flex items-center justify-center font-outfit font-black text-8xl sm:text-9xl shadow-2xl transition-all border bg-gradient-to-tr from-amber-400 via-amber-500 to-orange-500 text-slate-950 border-amber-300 scale-105 select-none drop-shadow-2xl';
        targetCardEl = target;
        phase = 'TARGET_INJECTED';
      }
    } else if (phase === 'TARGET_INJECTED') {
      currentOffset -= speed;

      while (currentOffset <= -CARD_STEP) {
        currentOffset += CARD_STEP;
        const first = track.firstElementChild;
        if (first === targetCardEl) {
          break; // Detener reciclaje antes de la tarjeta ganadora
        }
        track.appendChild(first);
        first.textContent = getNextAlphabetLetter();
        first.className = 'w-[180px] h-[250px] mx-2.5 rounded-3xl flex-shrink-0 flex items-center justify-center font-outfit font-black text-8xl sm:text-9xl shadow-2xl transition-all border bg-slate-900/90 text-white border-white/10 select-none';
      }

      const targetRect = targetCardEl.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const distToCenter = (targetRect.left + (targetRect.width / 2)) - (containerRect.left + centerX);

      if (distToCenter > 0 && distToCenter < 650) {
        phase = 'DECELERATING';
      }
    } else if (phase === 'DECELERATING') {
      const targetRect = targetCardEl.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const distToCenter = (targetRect.left + (targetRect.width / 2)) - (containerRect.left + centerX);

      if (distToCenter <= 3) {
        phase = 'DONE';
        currentOffset = currentOffset - distToCenter;
        track.dataset.offset = currentOffset;
        track.style.transform = `translateX(${currentOffset}px)`;

        isRouletteSpinning = false;
        audio.spotlight();

        const resultLetter = document.getElementById('rouletteFinalLetter');
        if (resultLetter) resultLetter.textContent = targetLetter;
        if (resultBox) resultBox.style.opacity = '1';

        if (typeof confetti === 'function') {
          confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
        }
        return;
      } else {
        speed = Math.max(2.0, distToCenter * 0.05);
        currentOffset -= speed;
      }
    }

    track.dataset.offset = currentOffset;
    track.style.transform = `translateX(${currentOffset}px)`;
    carouselAnimationId = requestAnimationFrame(frame);
  }

  carouselAnimationId = requestAnimationFrame(frame);
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
