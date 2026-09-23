// Lógica del Panel de Administrador (Control Room)
const socket = io();

let currentRoomCode = 'BACH1';
let currentLetter = 'A';
let categories = [...CATEGORY_PRESETS.clasico.categories];
let players = [];
let detailedAnswers = {};
let roundTimeLimit = 60;
let currentReviewCatIndex = 0;
let activeBackgroundUrl = null;

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
window.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  currentRoomCode = (urlParams.get('room') || 'BACH1').toUpperCase();
  document.getElementById('adminRoomCode').textContent = currentRoomCode;
  document.getElementById('openTvLink').href = `/tv.html?room=${currentRoomCode}`;

  // Cargar Server Info
  try {
    const res = await fetch(`/api/server-info?room=${currentRoomCode}`);
    const data = await res.json();
    if (data.backgroundUrl) {
      updateBackgroundUi(data.backgroundUrl);
    }
  } catch (err) {
    console.error('Error cargando server info:', err);
  }

  // Renderizar chips iniciales
  renderAdminCategoryChips();

  // Conectar como Admin
  socket.emit('admin:join', { roomCode: currentRoomCode });
});

// ==================== MANDO DE LA TV & RONDA ====================

function triggerTvView(viewName) {
  audio.click();
  socket.emit('admin:show_tv_view', { view: viewName });
}

function setRoundDuration(sec) {
  audio.click();
  roundTimeLimit = Number(sec);
  socket.emit('admin:set_round_duration', { seconds: roundTimeLimit });

  document.getElementById('currentDurationBadge').textContent = 
    sec === 0 ? 'Actual: Sin límite de tiempo' : `Actual: ${sec} segundos`;

  // Actualizar estilos de los botones de duración
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

  // Detonar carrusel en la TV
  socket.emit('admin:spin_carousel', { letter: currentLetter });
}

function adminStartRound() {
  audio.spotlight();
  socket.emit('admin:start_round', {
    letter: currentLetter,
    roundTimeLimit
  });
}

function adminForceStop() {
  audio.stopAlarm();
  socket.emit('admin:force_stop');
}

// ==================== GESTOR DE CATEGORÍAS ====================

function renderAdminCategoryChips() {
  const container = document.getElementById('adminCategoryChips');
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
    socket.emit('admin:update_categories', { categories });
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
    socket.emit('admin:update_categories', { categories });
  }
}

function adminRemoveCategory(idx) {
  audio.click();
  categories.splice(idx, 1);
  renderAdminCategoryChips();
  socket.emit('admin:update_categories', { categories });
}

// ==================== FONDO PNG GLOBAL ====================

async function handleBackgroundUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    const base64 = e.target.result;
    try {
      const res = await fetch('/api/upload-background', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode: currentRoomCode,
          imageBase64: base64
        })
      });
      const data = await res.json();
      if (data.success) {
        audio.spotlight();
        updateBackgroundUi(data.backgroundUrl);
      }
    } catch (err) {
      alert('Error subiendo imagen de fondo');
    }
  };
  reader.readAsDataURL(file);
}

async function removeGlobalBackground() {
  audio.click();
  try {
    const res = await fetch('/api/remove-background', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode: currentRoomCode })
    });
    const data = await res.json();
    if (data.success) {
      updateBackgroundUi(null);
    }
  } catch (err) {
    alert('Error al quitar el fondo');
  }
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
    badge.textContent = '✓ Fondo Personalizado PNG Activo';
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
        <!-- BOTÓN DETONADOR PROYECTAR EN TV -->
        <button onclick="projectAnswerOnTv('${p.id}', '${escapeQuotes(p.nickname)}', '${p.avatar}', '${escapeQuotes(activeCategory)}', '${escapeQuotes(textVal)}')" class="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow">
          ⭐ Proyectar en TV
        </button>

        <!-- Botones de Puntuación -->
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
  socket.emit('admin:spotlight_answer', { playerId, playerName, avatar, category, answer });
}

function adminCloseSpotlight() {
  audio.click();
  socket.emit('admin:close_spotlight');
}

function adminOverridePoints(playerId, category, status, points) {
  audio.click();
  socket.emit('admin:override_answer_status', { playerId, category, status, points });
}

function adminFinishRoundScores() {
  audio.victory();
  socket.emit('admin:finish_round_scores');
}

function escapeQuotes(str) {
  return (str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// ==================== SOCKET.IO EVENTS ====================

socket.on('room:state', (state) => {
  players = state.players || [];
  currentLetter = state.letter || currentLetter;
  roundTimeLimit = state.roundTimeLimit !== undefined ? state.roundTimeLimit : roundTimeLimit;

  document.getElementById('adminPlayerCount').textContent = `${players.length} Jugador${players.length === 1 ? '' : 'es'} Conectados`;
  document.getElementById('adminSelectedLetter').textContent = currentLetter;

  if (state.backgroundUrl !== undefined && state.backgroundUrl !== activeBackgroundUrl) {
    updateBackgroundUi(state.backgroundUrl);
  }
});

socket.on('admin:detailed_data', (data) => {
  detailedAnswers = data.answers || {};
  if (data.categories) {
    categories = data.categories;
    renderAdminCategoryChips();
  }
  const reviewTab = document.getElementById('tabContent_review');
  if (reviewTab && !reviewTab.classList.contains('hidden')) {
    renderAdminReview();
  }
});
