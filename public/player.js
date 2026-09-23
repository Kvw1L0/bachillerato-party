// Lógica del Cliente Jugador Móvil
const socket = io();

let currentRoomCode = 'BACH1';
let myPlayerId = null;
let myNickname = '';
let myAvatar = '🐱';
let currentTheme = 'sunset';
let currentLetter = 'A';
let activeCategories = [];
let answersDraft = {};
let autosaveTimeout = null;
let activeBackgroundUrl = null;
let hasCalledStop = false;

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
window.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  currentRoomCode = (urlParams.get('room') || 'BACH1').toUpperCase();

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

  // Restaurar apodo previo
  const savedNick = localStorage.getItem('bach_nickname');
  if (savedNick) {
    document.getElementById('nicknameInput').value = savedNick;
  }

  // Verificar si hay fondo PNG ya activo
  try {
    const res = await fetch(`/api/server-info?room=${currentRoomCode}`);
    const data = await res.json();
    if (data.backgroundUrl) {
      applyPlayerBackground(data.backgroundUrl);
    }
  } catch (e) {
    // Ok
  }
});

// Selector de Tema (Gradiente) o Fondo PNG Global
function selectTheme(themeName) {
  if (activeBackgroundUrl) return; // Bloqueado si hay fondo personalizado
  audio.click();
  currentTheme = themeName;
  const body = document.getElementById('playerBody');
  body.className = `theme-${themeName} text-white min-h-screen flex flex-col selection:bg-amber-400 selection:text-slate-950 transition-all duration-700 relative`;
}

function applyPlayerBackground(bgUrl) {
  activeBackgroundUrl = bgUrl;
  const body = document.getElementById('playerBody');
  const lockedNotice = document.getElementById('themeLockedNotice');
  const buttonsRow = document.getElementById('themeButtonsRow');

  if (bgUrl) {
    body.style.backgroundImage = `url('${bgUrl}')`;
    lockedNotice.classList.remove('hidden');
    buttonsRow.classList.add('opacity-30', 'pointer-events-none');
    document.getElementById('playerVignette').className = 'absolute inset-0 bg-black/60 pointer-events-none z-0';
  } else {
    body.style.backgroundImage = 'none';
    body.className = `theme-${currentTheme} text-white min-h-screen flex flex-col selection:bg-amber-400 selection:text-slate-950 transition-all duration-700 relative`;
    lockedNotice.classList.add('hidden');
    buttonsRow.classList.remove('opacity-30', 'pointer-events-none');
    document.getElementById('playerVignette').className = 'absolute inset-0 bg-black/40 pointer-events-none z-0';
  }
}

// Unirse a la partida
function joinGame() {
  audio.click();
  const input = document.getElementById('nicknameInput');
  const name = input.value.trim();

  if (!name) {
    alert('Por favor escribe tu apodo para comenzar.');
    input.focus();
    return;
  }

  myNickname = name;
  localStorage.setItem('bach_nickname', name);

  document.getElementById('playerBadge').textContent = `${myAvatar} ${myNickname}`;
  document.getElementById('waitingName').textContent = myNickname;
  document.getElementById('waitingAvatar').textContent = myAvatar;

  socket.emit('player:join', {
    roomCode: currentRoomCode,
    nickname: myNickname,
    avatar: myAvatar,
    theme: currentTheme
  });

  setPlayerView('waiting');
}

socket.on('player:joined', (data) => {
  myPlayerId = data.playerId;
});

// ==================== ESTADO DE SALA Y CRONÓMETRO ====================

socket.on('room:state', (state) => {
  currentLetter = state.letter || currentLetter;
  activeCategories = state.categories || [];

  // Actualizar fondo si cambió
  applyPlayerBackground(state.backgroundUrl);

  if (state.status === 'LOBBY') {
    if (myPlayerId) {
      setPlayerView('waiting');
    }
    playerStopModal.classList.add('hidden');
    document.getElementById('headerLetterContainer').classList.add('hidden');
    document.getElementById('headerLetterContainer').classList.remove('flex');
    document.getElementById('headerTimerBadge').classList.add('hidden');
    document.getElementById('headerTimerBadge').classList.remove('flex');
  } else if (state.status === 'ROULETTE') {
    if (myPlayerId) {
      setPlayerView('waiting');
    }
    playerStopModal.classList.add('hidden');
  } else if (state.status === 'ROUND_ACTIVE') {
    hasCalledStop = false;
    setPlayerView('form');
    playerStopModal.classList.add('hidden');

    document.getElementById('roundLetterBadge').textContent = currentLetter;
    document.getElementById('roundLetterBox').textContent = currentLetter;
    document.getElementById('headerLetterBadge').textContent = currentLetter;
    document.getElementById('headerLetterContainer').classList.remove('hidden');
    document.getElementById('headerLetterContainer').classList.add('flex');

    // Cronómetro en jugador si hay límite
    if (state.roundTimeLimit > 0) {
      document.getElementById('headerTimerBadge').classList.remove('hidden');
      document.getElementById('headerTimerBadge').classList.add('flex');
      document.getElementById('playerTimerBox').classList.remove('hidden');
      document.getElementById('playerTimerBox').classList.add('flex');
      document.getElementById('headerTimerText').textContent = `${state.timeRemaining}s`;
      document.getElementById('playerTimerNumber').textContent = `${state.timeRemaining}s`;
    } else {
      document.getElementById('headerTimerBadge').classList.add('hidden');
      document.getElementById('playerTimerBox').classList.add('hidden');
    }

    // Si cambió la ronda o la letra, reiniciar formulario completamente
    if (state.roundNumber !== lastRoundNumber || currentLetter !== lastRenderedLetter) {
      lastRoundNumber = state.roundNumber || 1;
      lastRenderedLetter = currentLetter;
      resetAndPrepareForm();
    }
  } else if (state.status === 'STOP_COUNTDOWN') {
    // Modal se activa en 'round:stop_called'
  } else if (state.status === 'REVIEW') {
    setPlayerView('reviewWaiting');
    playerStopModal.classList.add('hidden');
  } else if (state.status === 'LEADERBOARD') {
    setPlayerView('leaderboard');
    playerStopModal.classList.add('hidden');

    const me = (state.players || []).find(p => p.id === myPlayerId);
    if (me) {
      document.getElementById('playerTotalScoreBadge').textContent = me.score;
      document.getElementById('playerRoundGainBadge').textContent = `+${me.roundScore || 0} pts esta ronda`;
    }
  }
});

let lastRoundNumber = 0;
let lastRenderedLetter = '';

// Reiniciar y preparar campos del formulario para una nueva letra o ronda
function resetAndPrepareForm() {
  const container = document.getElementById('categoriesFormContainer');
  container.innerHTML = '';
  answersDraft = {};

  activeCategories.forEach((cat, idx) => {
    answersDraft[cat] = '';

    const card = document.createElement('div');
    card.className = 'bg-black/50 border border-white/10 rounded-2xl p-4 flex flex-col gap-1.5 backdrop-blur-md transition-all focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-400/20';

    card.innerHTML = `
      <div class="flex items-center justify-between">
        <label for="cat_input_${idx}" class="text-xs font-bold uppercase tracking-wider text-slate-300">
          ${cat}
        </label>
        <span id="hint_${idx}" class="text-[10px] font-bold text-slate-500">
          Empieza con "${currentLetter}"
        </span>
      </div>
      <div class="relative">
        <input 
          type="text" 
          id="cat_input_${idx}" 
          autocomplete="off" 
          autocorrect="off" 
          spellcheck="false"
          placeholder="Escribe tu respuesta..." 
          class="w-full bg-white/10 border border-white/15 rounded-xl px-3.5 py-3 text-base font-bold text-white placeholder-slate-500 focus:outline-none focus:bg-white/15"
        />
        <div id="check_${idx}" class="absolute right-3 top-3 text-emerald-400 text-sm hidden">
          ✓
        </div>
      </div>
    `;

    container.appendChild(card);

    const input = card.querySelector('input');
    input.addEventListener('input', (e) => {
      const val = e.target.value;
      answersDraft[cat] = val;

      const check = document.getElementById(`check_${idx}`);
      const hint = document.getElementById(`hint_${idx}`);

      if (val.trim().length > 0) {
        const startsWithTarget = val.trim().toUpperCase().startsWith(currentLetter.toUpperCase());
        if (startsWithTarget) {
          check.classList.remove('hidden');
          hint.textContent = '¡Correcta inicial!';
          hint.className = 'text-[10px] font-bold text-emerald-400';
        } else {
          check.classList.add('hidden');
          hint.textContent = `Debe comenzar con "${currentLetter}"`;
          hint.className = 'text-[10px] font-bold text-rose-400';
        }
      } else {
        check.classList.add('hidden');
        hint.textContent = `Empieza con "${currentLetter}"`;
        hint.className = 'text-[10px] font-bold text-slate-500';
      }

      // Notificar escribiendo en vivo al servidor y pantalla de TV
      if (!isCurrentlyTyping) {
        isCurrentlyTyping = true;
        socket.emit('player:typing', { isTyping: true });
      }
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        isCurrentlyTyping = false;
        socket.emit('player:typing', { isTyping: false });
      }, 1200);

      clearTimeout(autosaveTimeout);
      autosaveTimeout = setTimeout(() => {
        socket.emit('player:save_answers', { answers: answersDraft });
      }, 250);
    });
  });
}

let typingTimeout = null;
let isCurrentlyTyping = false;

// Botón STOP del Jugador
function playerCallStop() {
  if (hasCalledStop) return;
  hasCalledStop = true;
  clearTimeout(typingTimeout);
  if (isCurrentlyTyping) {
    isCurrentlyTyping = false;
    socket.emit('player:typing', { isTyping: false });
  }
  audio.stopAlarm();
  socket.emit('player:save_answers', { answers: answersDraft });
  socket.emit('player:call_stop');
}

// Eventos de Cuenta Regresiva de STOP
socket.on('round:stop_called', ({ caller, seconds }) => {
  audio.stopAlarm();
  playerStopModal.classList.remove('hidden');
  playerStopModal.classList.add('flex');

  const callerName = (caller && caller.nickname) ? caller.nickname : '¡Alguien!';
  document.getElementById('playerStopCaller').textContent = callerName;
  document.getElementById('playerStopCountdownNum').textContent = seconds;

  socket.emit('player:save_answers', { answers: answersDraft });
});

socket.on('round:stop_tick', ({ seconds }) => {
  audio.tick();
  document.getElementById('playerStopCountdownNum').textContent = seconds;
});

// Sincronización del cronómetro
socket.on('round:tick', ({ timeRemaining }) => {
  const badge = document.getElementById('headerTimerText');
  const box = document.getElementById('playerTimerNumber');
  if (badge) badge.textContent = `${timeRemaining}s`;
  if (box) box.textContent = `${timeRemaining}s`;
});
