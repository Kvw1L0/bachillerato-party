// ============================================================================
// LÓGICA DEL PANEL DE ADMINISTRADOR (CONTROL ROOM) - MODO FIREBASE / VERCEL
// ============================================================================

let currentRoomCode = 'BACH1';
let currentLetter = 'A';
let usedLetters = ['A'];
let categories = [...CATEGORY_PRESETS.clasico.categories];
let playersMap = {};
let detailedAnswers = {};
let roundTimeLimit = 60;
let currentReviewCatIndex = 0;
let activeBackgroundUrl = null;
let roomState = null;

// Elementos de Pestañas
const tabs = ['control', 'categories', 'background', 'review'];

function switchAdminTab(tabName) {
  audio.click();
  tabs.forEach(t => {
    const btn = document.getElementById(`tabBtn_${t}`);
    const content = document.getElementById(`tabContent_${t}`);
    if (t === tabName) {
      btn.className = 'tab-btn px-4 py-2 rounded-xl text-xs font-bold transition-all bg-amber-400 text-slate-950 shadow-md';
      content.classList.remove('hidden');
      content.classList.add('flex');
    } else {
      btn.className = 'tab-btn px-4 py-2 rounded-xl text-xs font-bold transition-all bg-white/5 text-slate-300 hover:bg-white/10';
      content.classList.add('hidden');
      content.classList.remove('flex');
    }
  });

  if (tabName === 'review') {
    renderAdminReview();
  }
}

// Inicialización
window.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const paramRoom = urlParams.get('room');
  const savedRoom = localStorage.getItem('bach_admin_room');

  if (paramRoom) {
    currentRoomCode = paramRoom.trim().toUpperCase();
    initAdminWithRoom(currentRoomCode);
  } else {
    // Verificar si hay una sala activa registrada en Firebase
    getActiveRoomFromFirebase((activePin) => {
      if (activePin && !currentRoomCode) {
        currentRoomCode = activePin.toUpperCase();
      } else if (!currentRoomCode) {
        currentRoomCode = (savedRoom && savedRoom !== 'BACH1') ? savedRoom : Math.floor(100000 + Math.random() * 900000).toString();
      }
      initAdminWithRoom(currentRoomCode);
    });
  }
});

let adminSubscribedRef = null;
function initAdminWithRoom(roomPin) {
  currentRoomCode = roomPin;
  localStorage.setItem('bach_admin_room', currentRoomCode);
  setActiveRoomInFirebase(currentRoomCode);
  updateAdminPinDisplay(currentRoomCode);

  renderAdminCategoryChips();
  updateMuteButtonUi();

  // Conectar o reconectar a Firebase Realtime Database
  if (adminSubscribedRef && typeof adminSubscribedRef.off === 'function') {
    adminSubscribedRef.off();
  }
  adminSubscribedRef = subscribeToRoom(currentRoomCode, onAdminRoomUpdated);
}

function updateAdminPinDisplay(pin) {
  const roomCodeEl = document.getElementById('adminRoomCode');
  const bigPinEl = document.getElementById('adminBigPinDisplay');
  const tvLink = document.getElementById('openTvLink');
  if (roomCodeEl) roomCodeEl.textContent = pin;
  if (bigPinEl) bigPinEl.textContent = pin;
  if (tvLink) tvLink.href = `/tv.html?room=${pin}`;
}

// Crear una nueva sala con un nuevo PIN numérico
function adminCreateNewRoom() {
  audio.click();
  const newPin = Math.floor(100000 + Math.random() * 900000).toString();
  currentRoomCode = newPin;
  localStorage.setItem('bach_admin_room', newPin);

  // Actualizar URL sin recargar
  const newUrl = `${window.location.pathname}?room=${newPin}`;
  window.history.replaceState(null, '', newUrl);

  updateAdminPinDisplay(newPin);

  // Crear sala en Firebase y establecer como activa
  createRoomInFirebase(newPin, categories);

  // Re-suscribirse a la nueva sala
  if (adminSubscribedRef && typeof adminSubscribedRef.off === 'function') {
    adminSubscribedRef.off();
  }
  adminSubscribedRef = subscribeToRoom(newPin, onAdminRoomUpdated);

  alert(`¡Nueva sala creada con éxito!\nPIN de Sala: ${newPin}\n\nLa pantalla de TV y los jugadores se conectarán a este PIN.`);
}

// Resetear completamente la sala actual a FOJA CERO
function adminResetToZero() {
  audio.click();
  if (confirm(`¿Reiniciar toda la partida a FOJA CERO?\n\n- Se borrarán todos los jugadores y respuestas registradas.\n- El cronómetro y letras volverán al estado inicial.\n- La TV y los celulares volverán al Lobby de espera.\n- Si había un cartel de STOP pegado, se desbloqueará de inmediato.`)) {
    resetRoomInFirebase(currentRoomCode, categories);
    // Limpiar también sala antigua si existía
    if (currentRoomCode !== 'BACH1') {
      unlockStopInFirebase('BACH1');
    }
    const badge = document.getElementById('adminRoomStatusBadge');
    if (badge) {
      badge.textContent = '🟢 En Espera / Lobby';
      badge.className = 'text-xs font-bold bg-emerald-400/20 text-emerald-300 px-3 py-1 rounded-full border border-emerald-400/30';
    }
  }
}

// Desbloquear o limpiar STOP si quedó pegado en pantalla
function adminUnlockStop() {
  audio.click();
  unlockStopInFirebase(currentRoomCode);
  if (currentRoomCode !== 'BACH1') {
    unlockStopInFirebase('BACH1');
  }
  const badge = document.getElementById('adminRoomStatusBadge');
  if (badge) {
    badge.textContent = '🟢 En Espera / Lobby';
  }
  alert('Se ha desbloqueado el STOP forzadamente y regresado la sala al Lobby.');
}

// Cerrar sesión / sala
function adminCloseCurrentRoom() {
  audio.click();
  if (confirm(`¿Estás seguro de que deseas cerrar la sala PIN ${currentRoomCode}?\nLos jugadores conectados y la TV serán reseteados y desconectados.`)) {
    closeRoomInFirebase(currentRoomCode);
    if (currentRoomCode !== 'BACH1') {
      closeRoomInFirebase('BACH1');
    }
    const badge = document.getElementById('adminRoomStatusBadge');
    if (badge) {
      badge.textContent = '🔒 Sala Cerrada';
      badge.className = 'text-xs font-bold bg-red-500/20 text-red-300 px-3 py-1 rounded-full border border-red-500/30';
    }
  }
}

// Proyectar QR y PIN en la TV
function adminShowQrOnTv() {
  audio.click();
  triggerTvView('LOBBY');
}

// Alternar silencio global (Mute)
function toggleSystemMute() {
  const isMuted = audio.toggleMute();
  updateMuteButtonUi();
  setRoomMutedInFirebase(currentRoomCode, isMuted);
}

function updateMuteButtonUi() {
  const muteBtn = document.getElementById('adminMuteBtn');
  const muteIcon = document.getElementById('adminMuteIcon');
  const muteText = document.getElementById('adminMuteText');
  if (!muteBtn) return;

  if (audio.muted) {
    muteBtn.className = 'px-3 py-2 rounded-xl bg-red-600/30 border border-red-500/50 text-xs font-bold text-red-200 transition-all flex items-center gap-1.5';
    if (muteIcon) muteIcon.setAttribute('data-lucide', 'volume-x');
    if (muteText) muteText.textContent = 'Silenciado';
  } else {
    muteBtn.className = 'px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-bold text-slate-300 transition-all flex items-center gap-1.5';
    if (muteIcon) muteIcon.setAttribute('data-lucide', 'volume-2');
    if (muteText) muteText.textContent = 'Sonido';
  }
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function onAdminRoomUpdated(state) {
  if (!state) return;
  roomState = state;
  currentLetter = state.letter || currentLetter;
  usedLetters = state.usedLetters || usedLetters;
  if (state.categories) categories = state.categories;
  roundTimeLimit = state.roundTimeLimit !== undefined ? state.roundTimeLimit : roundTimeLimit;
  playersMap = state.players || {};
  detailedAnswers = state.answers || {};

  const activePin = state.pin || state.code || currentRoomCode;
  updateAdminPinDisplay(activePin);

  // Sincronizar estado de mute si viene de la sala
  if (state.isMuted !== undefined && state.isMuted !== audio.muted) {
    audio.setMuted(state.isMuted);
    updateMuteButtonUi();
  }

  // Actualizar badge de estado
  const statusBadge = document.getElementById('adminRoomStatusBadge');
  if (statusBadge) {
    const statusMap = {
      'LOBBY': '🟢 En Espera / Lobby',
      'ROULETTE': '🎰 Sorteo de Letra',
      'ROUND_ACTIVE': '⚡ Ronda Activa',
      'STOP_COUNTDOWN': '🛑 ¡STOP en Curso!',
      'REVIEW': '⭐ Moderación / Revisión',
      'LEADERBOARD': '🏆 Podio Proyectado',
      'CLOSED': '🔒 Sala Cerrada'
    };
    statusBadge.textContent = statusMap[state.status] || state.status;
  }

  const playersList = Object.values(playersMap);
  document.getElementById('adminPlayerCount').textContent = `${playersList.length} Jugador${playersList.length === 1 ? '' : 'es'} Conectados`;
  document.getElementById('adminSelectedLetter').textContent = currentLetter;

  renderAdminCategoryChips();

  if (state.backgroundUrl !== activeBackgroundUrl) {
    updateBackgroundUi(state.backgroundUrl);
  }

  // Si entra en cuenta regresiva de STOP, activar cálculo de puntajes tras 5s
  if (state.status === 'STOP_COUNTDOWN' && !state._scoreCalculated) {
    setTimeout(() => {
      calculateScoresInFirebase(
        currentRoomCode,
        state.letter,
        state.categories,
        state.stopCaller,
        state.answers,
        state.players
      );
    }, 5200);
  }

  // Refrescar revisión si la pestaña está visible
  const reviewTab = document.getElementById('tabContent_review');
  if (reviewTab && !reviewTab.classList.contains('hidden')) {
    renderAdminReview();
  }
}

// ==================== MANDO DE LA TV & RONDA ====================

function triggerTvView(viewName) {
  audio.click();
  if (viewName === 'LEADERBOARD') {
    finishRoundInFirebase(currentRoomCode, playersMap);
  } else {
    getRoomRef(currentRoomCode).update({ status: viewName });
  }
}

function setRoundDuration(sec) {
  audio.click();
  roundTimeLimit = Number(sec);
  getRoomRef(currentRoomCode).update({ roundTimeLimit: roundTimeLimit });

  document.getElementById('currentDurationBadge').textContent = 
    sec === 0 ? 'Actual: Sin límite de tiempo' : `Actual: ${sec} segundos`;

  document.querySelectorAll('.duration-btn').forEach(btn => {
    btn.className = 'duration-btn p-3 rounded-xl bg-black/40 border border-white/10 text-xs font-bold text-slate-300 hover:text-white hover:bg-white/10 transition-all flex flex-col items-center gap-1';
  });
  event.currentTarget.className = 'duration-btn p-3 rounded-xl bg-amber-400 text-slate-950 font-extrabold border border-amber-300 transition-all flex flex-col items-center gap-1 shadow-md';
}

function spinRouletteOnTv() {
  audio.click();
  const excludeHard = document.getElementById('adminExcludeHard').checked;
  const pool = excludeHard ? ALPHABET_EASY : ALPHABET_ALL;
  const chosenLetter = pool[Math.floor(Math.random() * pool.length)];

  currentLetter = chosenLetter;
  document.getElementById('adminSelectedLetter').textContent = currentLetter;

  spinCarouselInFirebase(currentRoomCode, chosenLetter);
}

function adminStartRound() {
  audio.spotlight();
  startRoundInFirebase(currentRoomCode, currentLetter, roundTimeLimit, usedLetters);
}

function adminForceStop() {
  audio.stopAlarm();
  callStopInFirebase(currentRoomCode, {
    nickname: 'Anfitrión',
    avatar: '👑',
    id: 'admin'
  });
}

// ==================== GESTOR DE CATEGORÍAS ====================

function renderAdminCategoryChips() {
  const container = document.getElementById('adminCategoryChips');
  if (!container) return;
  container.innerHTML = '';
  document.getElementById('adminCatCount').textContent = `${categories.length} categorías activas`;

  categories.forEach((cat, idx) => {
    const chip = document.createElement('div');
    chip.className = 'bg-white/10 border border-white/10 rounded-xl px-3 py-1.5 flex items-center gap-2 text-xs font-semibold text-white transition-all hover:bg-white/20';
    chip.innerHTML = `
      <span>${cat}</span>
      <button onclick="adminRemoveCategory(${idx})" class="text-slate-400 hover:text-rose-400 transition-colors">
        <i data-lucide="x" class="w-3.5 h-3.5"></i>
      </button>
    `;
    container.appendChild(chip);
  });
  lucide.createIcons();
}

function applyAdminPreset(key) {
  audio.click();
  if (CATEGORY_PRESETS[key]) {
    categories = [...CATEGORY_PRESETS[key].categories];
    renderAdminCategoryChips();
    getRoomRef(currentRoomCode).update({ categories: categories });
  }
}

function adminAddCustomCategory() {
  const input = document.getElementById('adminNewCatInput');
  const val = input.value.trim();
  if (val && !categories.includes(val)) {
    audio.click();
    categories.push(val);
    input.value = '';
    renderAdminCategoryChips();
    getRoomRef(currentRoomCode).update({ categories: categories });
  }
}

function adminRemoveCategory(idx) {
  audio.click();
  categories.splice(idx, 1);
  renderAdminCategoryChips();
  getRoomRef(currentRoomCode).update({ categories: categories });
}

// ==================== FONDO PNG GLOBAL (EN CLIENTE) ====================

async function handleBackgroundUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Redimensionar imagen en el navegador con un Canvas para optimizar peso (máx 1280x720)
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxW = 1280;
      const maxH = 720;
      let w = img.width;
      let h = img.height;

      if (w > maxW || h > maxH) {
        if (w / h > maxW / maxH) {
          h = Math.round((h * maxW) / w);
          w = maxW;
        } else {
          w = Math.round((w * maxH) / h);
          h = maxH;
        }
      }

      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);

      // Convertir a JPEG optimizado
      const optimizedBase64 = canvas.toDataURL('image/jpeg', 0.75);
      setBackgroundInFirebase(currentRoomCode, optimizedBase64);
      audio.spotlight();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function removeGlobalBackground() {
  audio.click();
  removeBackgroundInFirebase(currentRoomCode);
}

function updateBackgroundUi(bgUrl) {
  activeBackgroundUrl = bgUrl;
  const previewBox = document.getElementById('adminBgPreviewBox');
  const badge = document.getElementById('adminBgStatusBadge');
  const removeBtn = document.getElementById('adminRemoveBgBtn');

  if (bgUrl) {
    previewBox.style.backgroundImage = `url('${bgUrl}')`;
    previewBox.textContent = '';
    badge.className = 'text-xs font-bold text-amber-300 bg-amber-400/20 border border-amber-400/30 px-2.5 py-0.5 rounded-full';
    badge.textContent = '✓ Fondo Personalizado Activo';
    removeBtn.classList.remove('hidden');
  } else {
    previewBox.style.backgroundImage = 'none';
    previewBox.textContent = 'Sin fondo';
    badge.className = 'text-xs font-bold text-slate-400 bg-white/10 px-2.5 py-0.5 rounded-full';
    badge.textContent = 'Fondo por Defecto (Gradientes)';
    removeBtn.classList.add('hidden');
  }
}

// ==================== MODERACIÓN & SHOWMAN (PROYECTAR EN TV) ====================

function renderAdminReview() {
  const catTabs = document.getElementById('adminReviewCatTabs');
  if (!catTabs) return;
  catTabs.innerHTML = '';

  categories.forEach((cat, idx) => {
    const btn = document.createElement('button');
    const isActive = idx === currentReviewCatIndex;
    btn.className = `px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
      isActive
        ? 'bg-amber-400 text-slate-950 font-black shadow-md'
        : 'bg-white/5 text-slate-300 hover:bg-white/15'
    }`;
    btn.textContent = cat;
    btn.onclick = () => {
      audio.click();
      currentReviewCatIndex = idx;
      renderAdminReview();
    };
    catTabs.appendChild(btn);
  });

  const activeCategory = categories[currentReviewCatIndex] || categories[0];
  document.getElementById('adminCurrentCatTitle').textContent = activeCategory;

  const grid = document.getElementById('adminAnswersGrid');
  grid.innerHTML = '';

  const playersList = Object.values(playersMap);

  playersList.forEach(p => {
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
    card.className = `border ${borderClass} rounded-2xl p-5 backdrop-blur-xl flex flex-col justify-between gap-4`;

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

      <div class="flex items-center justify-between gap-2 pt-3 border-t border-white/10">
        <button onclick="projectAnswerOnTv('${p.id}', '${escapeQuotes(p.nickname)}', '${p.avatar}', '${escapeQuotes(activeCategory)}', '${escapeQuotes(textVal)}')" class="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow">
          ⭐ Proyectar en TV
        </button>

        <div class="flex items-center gap-1">
          <button onclick="adminOverridePoints('${p.id}', '${escapeQuotes(activeCategory)}', 'valid', 100)" class="w-8 h-8 rounded-lg bg-emerald-600/40 hover:bg-emerald-600 text-white font-bold text-xs" title="+100 pts">
            100
          </button>
          <button onclick="adminOverridePoints('${p.id}', '${escapeQuotes(activeCategory)}', 'repeated', 50)" class="w-8 h-8 rounded-lg bg-amber-600/40 hover:bg-amber-600 text-white font-bold text-xs" title="+50 pts">
            50
          </button>
          <button onclick="adminOverridePoints('${p.id}', '${escapeQuotes(activeCategory)}', 'invalid', 0)" class="w-8 h-8 rounded-lg bg-rose-600/40 hover:bg-rose-600 text-white font-bold text-xs" title="0 pts">
            0
          </button>
        </div>
      </div>
    `;

    grid.appendChild(card);
  });
}

function projectAnswerOnTv(playerId, playerName, avatar, category, answer) {
  audio.spotlight();
  setSpotlightInFirebase(currentRoomCode, {
    playerId,
    playerName,
    avatar,
    category,
    answer
  });
}

function adminCloseSpotlight() {
  audio.click();
  closeSpotlightInFirebase(currentRoomCode);
}

function adminOverridePoints(playerId, category, status, points) {
  audio.click();
  overrideAnswerInFirebase(currentRoomCode, playerId, category, status, points);
}

function adminFinishRoundScores() {
  audio.victory();
  finishRoundInFirebase(currentRoomCode, playersMap);
}

function escapeQuotes(str) {
  return (str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}
