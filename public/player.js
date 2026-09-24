// ============================================================================
// LÓGICA DEL CLIENTE JUGADOR MÓVIL - MODO FIREBASE / VERCEL
// ============================================================================

let currentRoomCode = 'BACH1';
let myPlayerId = localStorage.getItem('bach_player_id') || ('p_' + Math.random().toString(36).substring(2, 9));
localStorage.setItem('bach_player_id', myPlayerId);

let myNickname = '';
let myAvatar = '🐱';
let currentTheme = 'sunset';
let currentLetter = 'A';
let activeCategories = [];
let answersDraft = {};
let autosaveTimeout = null;
let activeBackgroundUrl = null;
let hasCalledStop = false;
let playerTimerInterval = null;
let isCurrentlyTyping = false;
let typingTimeout = null;
let lastRoundNumber = 0;
let lastRenderedLetter = '';

const FALLBACK_CATEGORIES = [
  'Nombre',
  'País o Ciudad',
  'Animal',
  'Fruta o Verdura',
  'Cosa u Objeto',
  'Color',
  'Profesión u Oficio'
];

const AVATARS = ['🐱', '🦊', '🐼', '🦁', '🚀', '⚡', '🍕', '🥑', '🎮', '🦄', '🦖', '👑'];
const THEMES = ['sunset', 'cyberpunk', 'aurora', 'galaxy', 'golden'];

// Vistas
const views = {
  join: document.getElementById('viewJoin'),
  waiting: document.getElementById('viewWaiting'),
  form: document.getElementById('viewForm'),
  reviewWaiting: document.getElementById('viewReviewWaiting'),
  leaderboard: document.getElementById('viewPlayerLeaderboard')
};

const playerStopModal = document.getElementById('playerStopModal');

function setPlayerView(viewName) {
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
  const roomParam = urlParams.get('room');
  const savedPin = localStorage.getItem('bach_room_pin') || '';

  const pinInput = document.getElementById('roomPinInput');
  if (pinInput) {
    pinInput.value = (roomParam || savedPin || '').toUpperCase();
    if (!pinInput.value) {
      getActiveRoomFromFirebase((activePin) => {
        if (!pinInput.value && activePin) {
          pinInput.value = activePin.toUpperCase();
        }
      });
    }
  }

  // Renderizar avatares
  const avatarGrid = document.getElementById('avatarGrid');
  avatarGrid.innerHTML = '';
  AVATARS.forEach((av, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `h-11 rounded-xl text-2xl flex items-center justify-center transition-transform hover:scale-110 active:scale-95 ${
      idx === 0 ? 'bg-amber-400/30 border-2 border-amber-400' : 'bg-white/10 border border-white/10'
    }`;
    btn.textContent = av;
    btn.onclick = () => {
      audio.click();
      myAvatar = av;
      document.querySelectorAll('#avatarGrid button').forEach(b => {
        b.className = 'h-11 rounded-xl text-2xl flex items-center justify-center transition-transform hover:scale-110 active:scale-95 bg-white/10 border border-white/10';
      });
      btn.className = 'h-11 rounded-xl text-2xl flex items-center justify-center transition-transform hover:scale-110 active:scale-95 bg-amber-400/30 border-2 border-amber-400';
    };
    avatarGrid.appendChild(btn);
  });

  const savedNick = localStorage.getItem('bach_nickname');
  if (savedNick) {
    document.getElementById('nicknameInput').value = savedNick;
  }

  // Auto-reconectar si ya tenía apodo y sala guardada
  const targetPin = (roomParam || savedPin || '').toUpperCase();
  if (targetPin && savedNick) {
    checkRoomExistsInFirebase(targetPin, (exists, roomData) => {
      if (exists && roomData) {
        currentRoomCode = targetPin;
        localStorage.setItem('bach_room_pin', targetPin);
        myNickname = savedNick;
        document.getElementById('playerBadge').textContent = `${myAvatar} ${myNickname}`;
        document.getElementById('waitingName').textContent = myNickname;
        document.getElementById('waitingAvatar').textContent = myAvatar;

        registerPlayerInFirebase(currentRoomCode, {
          id: myPlayerId,
          nickname: myNickname,
          avatar: myAvatar,
          isConnected: true
        });

        subscribeToRoom(currentRoomCode, onPlayerRoomUpdated);
      }
    });
  }
});

// Aplicar fondo fijado por el anfitrión (o gradiente predeterminado)
function applyPlayerBackground(bgUrl) {
  activeBackgroundUrl = bgUrl;
  const body = document.getElementById('playerBody');
  const vignette = document.getElementById('playerVignette');

  if (bgUrl) {
    body.style.backgroundImage = `url('${bgUrl}')`;
    if (vignette) vignette.className = 'absolute inset-0 bg-black/60 pointer-events-none z-0';
  } else {
    body.style.backgroundImage = 'none';
    body.className = `theme-sunset text-white min-h-screen flex flex-col selection:bg-amber-400 selection:text-slate-950 transition-all duration-700 relative`;
    if (vignette) vignette.className = 'absolute inset-0 bg-black/40 pointer-events-none z-0';
  }
}

// Unirse a la partida mediante PIN de sala
function joinGame() {
  audio.click();
  const pinInput = document.getElementById('roomPinInput');
  const pin = (pinInput ? pinInput.value.trim() : '').toUpperCase();
  const input = document.getElementById('nicknameInput');
  const name = input.value.trim();

  if (!pin) {
    alert('Por favor ingresa el PIN de 6 dígitos que aparece en la pantalla de TV.');
    if (pinInput) pinInput.focus();
    return;
  }

  if (!name) {
    alert('Por favor escribe tu apodo o nombre para comenzar.');
    input.focus();
    return;
  }

  // Verificar si la sala existe en Firebase
  checkRoomExistsInFirebase(pin, (exists) => {
    if (!exists) {
      alert(`La sala con PIN "${pin}" no existe o aún no ha sido abierta por el anfitrión. Revisa el código en la pantalla.`);
      return;
    }

    currentRoomCode = pin;
    localStorage.setItem('bach_room_pin', pin);
    myNickname = name;
    localStorage.setItem('bach_nickname', name);

    document.getElementById('playerBadge').textContent = `${myAvatar} ${myNickname}`;
    document.getElementById('waitingName').textContent = myNickname;
    document.getElementById('waitingAvatar').textContent = myAvatar;

    // Registrar jugador en Firebase
    registerPlayerInFirebase(currentRoomCode, {
      id: myPlayerId,
      nickname: myNickname,
      avatar: myAvatar,
      score: 0,
      roundScore: 0,
      submitted: false,
      isConnected: true
    });

    // Suscribir a la sala en tiempo real
    subscribeToRoom(currentRoomCode, onPlayerRoomUpdated);

    setPlayerView('waiting');
  });
}

// ==================== ACTUALIZACIÓN EN TIEMPO REAL ====================

function onPlayerRoomUpdated(state) {
  if (!state) return;

  // 1. Si la sala fue CERRADA o reseteada por el anfitrión
  if (state.status === 'CLOSED') {
    clearInterval(playerTimerInterval);
    playerStopModal.classList.add('hidden');
    playerStopModal.classList.remove('flex');
    answersDraft = {};
    hasCalledStop = false;
    myNickname = '';
    localStorage.removeItem('bach_nickname');
    setPlayerView('join');
    alert('La sala ha sido cerrada o reiniciada por el anfitrión.');
    return;
  }

  // 2. BLINDAJE STOP: Si el estado NO es STOP_COUNTDOWN, forzar que el modal de STOP esté cerrado
  if (state.status !== 'STOP_COUNTDOWN') {
    playerStopModal.classList.add('hidden');
    playerStopModal.classList.remove('flex');
    clearInterval(playerStopTimer);
  }

  if (typeof setMuted === 'function' && state.isMuted !== undefined) {
    setMuted(state.isMuted);
  }

  currentLetter = state.letter || currentLetter;
  
  // Parseo seguro de categorías (maneja arrays u objetos de Firebase)
  if (state.categories) {
    activeCategories = Array.isArray(state.categories)
      ? state.categories
      : Object.values(state.categories);
  }
  if (!activeCategories || activeCategories.length === 0) {
    activeCategories = [...FALLBACK_CATEGORIES];
  }

  applyPlayerBackground(state.backgroundUrl);

  const isJoined = !!myNickname;

  if (state.status === 'LOBBY') {
    clearInterval(playerTimerInterval);
    answersDraft = {};
    hasCalledStop = false;
    const myData = state.players ? state.players[myPlayerId] : null;
    if (isJoined && myData) {
      setPlayerView('waiting');
    } else {
      setPlayerView('join');
    }
  } else if (state.status === 'ROULETTE') {
    if (isJoined) setPlayerView('waiting');
    playerStopModal.classList.add('hidden');
  } else if (state.status === 'ROUND_ACTIVE') {
    hasCalledStop = false;
    
    // Si ya enviamos respuestas en esta ronda, mantenemos la vista en espera
    const myData = state.players ? state.players[myPlayerId] : null;
    const hasAlreadySubmitted = myData && myData.submitted;

    if (isJoined) {
      if (hasAlreadySubmitted) {
        setPlayerView('reviewWaiting');
      } else {
        setPlayerView('form');
      }
    }
    playerStopModal.classList.add('hidden');

    // Única Letra Centrada en Pantalla
    const letterBox = document.getElementById('roundLetterBox');
    if (letterBox) letterBox.textContent = currentLetter;

    // Cronómetro sincronizado
    syncPlayerTimer(state.timerStartedAt, state.roundTimeLimit);

    // Reiniciar y renderizar formulario si cambió la ronda, la letra o si las preguntas están vacías
    const formContainer = document.getElementById('categoriesFormContainer');
    const isContainerEmpty = !formContainer || formContainer.children.length === 0;

    if (state.roundNumber !== lastRoundNumber || currentLetter !== lastRenderedLetter || isContainerEmpty) {
      lastRoundNumber = state.roundNumber || 1;
      lastRenderedLetter = currentLetter;
      resetAndPrepareForm();
    }
  } else if (state.status === 'STOP_COUNTDOWN') {
    triggerPlayerStopCountdown(state.stopCaller);
  } else if (state.status === 'REVIEW') {
    if (isJoined) setPlayerView('reviewWaiting');
    playerStopModal.classList.add('hidden');
    clearInterval(playerTimerInterval);
  } else if (state.status === 'LEADERBOARD') {
    if (isJoined) setPlayerView('leaderboard');
    playerStopModal.classList.add('hidden');
    clearInterval(playerTimerInterval);

    const playersList = Object.values(state.players || {});
    const me = playersList.find(p => p.id === myPlayerId);
    if (me) {
      document.getElementById('playerTotalScoreBadge').textContent = me.score || 0;
      document.getElementById('playerRoundGainBadge').textContent = `+${me.roundScore || 0} pts esta ronda`;
    }
  }
}

// Sincronizar cronómetro del jugador (Único Timer en Pantalla)
function syncPlayerTimer(timerStartedAt, duration) {
  clearInterval(playerTimerInterval);
  const timerBox = document.getElementById('playerTimerBox');
  const timerNum = document.getElementById('playerTimerNumber');

  if (!duration || duration <= 0 || !timerStartedAt) {
    if (timerBox) {
      timerBox.classList.add('hidden');
      timerBox.classList.remove('flex');
    }
    return;
  }

  if (timerBox) {
    timerBox.classList.remove('hidden');
    timerBox.classList.add('flex');
  }

  function update() {
    const elapsed = Math.floor((Date.now() - timerStartedAt) / 1000);
    const timeRemaining = Math.max(0, duration - elapsed);

    if (timerNum) timerNum.textContent = `${timeRemaining}s`;

    if (timeRemaining <= 0) {
      clearInterval(playerTimerInterval);
    }
  }

  update();
  playerTimerInterval = setInterval(update, 1000);
}

// Reiniciar y preparar campos del formulario para una nueva letra o ronda
function resetAndPrepareForm() {
  const container = document.getElementById('categoriesFormContainer');
  if (!container) return;
  container.innerHTML = '';
  answersDraft = {};

  const catsToRender = (activeCategories && activeCategories.length > 0)
    ? activeCategories
    : FALLBACK_CATEGORIES;

  catsToRender.forEach((cat, idx) => {
    answersDraft[cat] = '';

    const card = document.createElement('div');
    card.className = 'bg-black/60 border border-white/15 rounded-2xl p-4 flex flex-col gap-2 backdrop-blur-md transition-all focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-400/30 shadow-lg';

    // Pregunta en negrita alta visibilidad y sin leyenda secundaria
    card.innerHTML = `
      <label for="cat_input_${idx}" class="text-base sm:text-lg font-black uppercase tracking-wider text-white flex items-center gap-2">
        <span class="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block shrink-0 shadow-sm"></span>
        <span class="truncate">${cat}</span>
      </label>
      <div class="relative">
        <input 
          type="text" 
          id="cat_input_${idx}" 
          autocomplete="off" 
          autocorrect="off" 
          spellcheck="false" 
          placeholder="Escribe tu respuesta..." 
          class="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3.5 text-base font-bold text-white placeholder-slate-400 focus:outline-none focus:bg-white/15 focus:border-amber-400"
        />
        <div id="check_${idx}" class="absolute right-3.5 top-3.5 text-emerald-400 text-lg font-black hidden">
          ✓
        </div>
      </div>
    `;

    const input = card.querySelector('input');

    // Desplazamiento suave para teclado en iOS y Android
    input.addEventListener('focus', () => {
      setTimeout(() => {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 250);
    });

    input.addEventListener('input', (e) => {
      const val = e.target.value;
      answersDraft[cat] = val;

      const check = document.getElementById(`check_${idx}`);
      if (val.trim().length > 0) {
        const startsWithTarget = val.trim().toUpperCase().startsWith(currentLetter.toUpperCase());
        if (startsWithTarget) {
          check.classList.remove('hidden');
        } else {
          check.classList.add('hidden');
        }
      } else {
        check.classList.add('hidden');
      }

      // Notificar escribiendo en vivo a la pantalla de TV
      if (!isCurrentlyTyping) {
        isCurrentlyTyping = true;
        setPlayerTypingInFirebase(currentRoomCode, myPlayerId, true, {
          nickname: myNickname,
          avatar: myAvatar
        });
      }
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        isCurrentlyTyping = false;
        setPlayerTypingInFirebase(currentRoomCode, myPlayerId, false);
      }, 1200);

      // Autoguardado continuo en Firebase
      clearTimeout(autosaveTimeout);
      autosaveTimeout = setTimeout(() => {
        const allFilled = activeCategories.length > 0 && activeCategories.every(c => (answersDraft[c] || '').trim().length > 0);
        saveAnswersInFirebase(currentRoomCode, myPlayerId, answersDraft, allFilled);
      }, 300);
    });

    // Insertar la tarjeta de categoría en el contenedor del formulario
    container.appendChild(card);
  });
}

// Botón explícito "Enviar Respuestas" del Jugador
function playerSubmitForm() {
  audio.success();
  clearTimeout(typingTimeout);
  if (isCurrentlyTyping) {
    isCurrentlyTyping = false;
    setPlayerTypingInFirebase(currentRoomCode, myPlayerId, false);
  }

  // Guardar respuestas marcando submitted = true (se proyectará de inmediato en la TV)
  saveAnswersInFirebase(currentRoomCode, myPlayerId, answersDraft, true);

  // Cambiar a vista de espera de revisión
  setPlayerView('reviewWaiting');
}

// Botón STOP del Jugador
function playerCallStop() {
  if (hasCalledStop) return;
  hasCalledStop = true;

  clearTimeout(typingTimeout);
  if (isCurrentlyTyping) {
    isCurrentlyTyping = false;
    setPlayerTypingInFirebase(currentRoomCode, myPlayerId, false);
  }

  // Recoger lo que esté escrito en el DOM en este instante
  const catsToRender = (activeCategories && activeCategories.length > 0)
    ? activeCategories
    : FALLBACK_CATEGORIES;
  catsToRender.forEach((cat, idx) => {
    const input = document.getElementById(`cat_input_${idx}`);
    if (input) {
      answersDraft[cat] = input.value;
    }
  });

  audio.stopAlarm();
  saveAnswersInFirebase(currentRoomCode, myPlayerId, answersDraft, true);

  const callerData = {
    id: myPlayerId,
    nickname: myNickname || 'Jugador',
    avatar: myAvatar || '🚀'
  };

  callStopInFirebase(currentRoomCode, callerData);
  triggerPlayerStopCountdown(callerData);
}

// Cuenta Regresiva de STOP
let playerStopTimer = null;
function triggerPlayerStopCountdown(caller) {
  audio.stopAlarm();
  playerStopModal.classList.remove('hidden');
  playerStopModal.classList.add('flex');

  const callerName = (caller && caller.nickname) ? caller.nickname : (myNickname || '¡Alguien!');
  document.getElementById('playerStopCaller').textContent = callerName;

  // Recoger respuestas del DOM para asegurar que todo quede guardado
  const catsToRender = (activeCategories && activeCategories.length > 0)
    ? activeCategories
    : FALLBACK_CATEGORIES;
  catsToRender.forEach((cat, idx) => {
    const input = document.getElementById(`cat_input_${idx}`);
    if (input && !answersDraft[cat]) {
      answersDraft[cat] = input.value;
    }
  });

  saveAnswersInFirebase(currentRoomCode, myPlayerId, answersDraft, true);

  let sec = 5;
  document.getElementById('playerStopCountdownNum').textContent = sec;
  clearInterval(playerStopTimer);
  playerStopTimer = setInterval(() => {
    sec--;
    audio.tick();
    document.getElementById('playerStopCountdownNum').textContent = sec;
    if (sec <= 0) {
      clearInterval(playerStopTimer);
      playerStopModal.classList.add('hidden');
      playerStopModal.classList.remove('flex');
      setPlayerView('reviewWaiting');
    }
  }, 1000);
}
