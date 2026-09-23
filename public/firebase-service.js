// ============================================================================
// SERVICIO DE SINCRONIZACIÓN EN TIEMPO REAL CON FIREBASE
// ============================================================================

let db = null;
let isFirebaseReady = false;

function initFirebaseService() {
  if (!isFirebaseConfigured()) {
    console.warn("⚠️ Firebase aún no ha sido configurado en public/firebase-config.js. Mostrando aviso de configuración.");
    showFirebaseSetupModal();
    return false;
  }

  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    db = firebase.database();
    isFirebaseReady = true;
    console.log("🔥 Firebase Realtime Database conectado exitosamente.");
    return true;
  } catch (err) {
    console.error("Error inicializando Firebase:", err);
    alert("Error al conectar con Firebase. Revisa tus credenciales en firebase-config.js: " + err.message);
    return false;
  }
}

// Modal amigable para guiar al usuario si aún no pega sus credenciales
function showFirebaseSetupModal() {
  if (document.getElementById('firebaseSetupModal')) return;

  const modal = document.createElement('div');
  modal.id = 'firebaseSetupModal';
  modal.className = 'fixed inset-0 bg-black/90 backdrop-blur-xl z-50 flex items-center justify-center p-6 text-center';
  modal.innerHTML = `
    <div class="max-w-lg w-full bg-slate-900 border-2 border-amber-400 rounded-3xl p-8 shadow-2xl text-left">
      <div class="w-12 h-12 rounded-2xl bg-amber-400/20 text-amber-300 flex items-center justify-center text-2xl mb-4">
        🔥
      </div>
      <h2 class="font-outfit font-black text-2xl text-white mb-2">Conecta tu Proyecto de Firebase</h2>
      <p class="text-xs text-slate-300 mb-4 leading-relaxed">
        Para que la experiencia funcione 100% en <b>Vercel</b> sin servidores Node.js, solo necesitas pegar las credenciales de tu base de datos gratuita de Firebase:
      </p>

      <ol class="list-decimal list-inside text-xs text-slate-300 space-y-2 mb-6 bg-black/40 p-4 rounded-2xl border border-white/10">
        <li>Entra a <a href="https://console.firebase.google.com" target="_blank" class="text-amber-400 underline font-bold">console.firebase.google.com</a> y crea un proyecto gratuito.</li>
        <li>En el menú izquierdo, haz clic en <b>Realtime Database</b> -> <b>Crear base de datos</b> (elige modo prueba).</li>
        <li>Ve a la configuración del proyecto (icono de tuerca) -> <b>Tus apps</b> -> copia el objeto de configuración.</li>
        <li>Abre el archivo <code class="text-amber-300 font-mono">public/firebase-config.js</code> en tu editor y reemplaza los valores de ejemplo.</li>
      </ol>

      <button onclick="document.getElementById('firebaseSetupModal').remove()" class="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm uppercase tracking-wider transition-colors shadow-lg">
        Entendido, configuraré firebase-config.js
      </button>
    </div>
  `;
  document.body.appendChild(modal);
}

// ==================== OPERACIONES DE SALA ====================

const DEFAULT_CATEGORIES = [
  'Nombre',
  'País o Ciudad',
  'Animal',
  'Fruta o Verdura',
  'Cosa u Objeto',
  'Color',
  'Profesión u Oficio'
];

function getRoomRef(roomCode = 'BACH1') {
  if (!db) return null;
  return db.ref('rooms/' + roomCode.toUpperCase().trim());
}

// Escuchar cambios en la sala en tiempo real
function subscribeToRoom(roomCode, callback) {
  if (!initFirebaseService()) return null;
  const ref = getRoomRef(roomCode);

  // Inicializar sala por defecto si no existe
  ref.transaction((currentData) => {
    if (currentData === null) {
      return {
        code: roomCode.toUpperCase().trim(),
        status: 'LOBBY',
        letter: 'A',
        usedLetters: ['A'],
        categories: DEFAULT_CATEGORIES,
        roundNumber: 0,
        roundTimeLimit: 60,
        timeRemaining: 60,
        stopCaller: null,
        backgroundUrl: null,
        currentSpotlight: null,
        carouselEvent: null,
        players: {},
        answers: {},
        typing: {}
      };
    }
    return currentData;
  });

  ref.on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
      callback(data);
    }
  });

  return ref;
}

// Registrar o actualizar un jugador
function registerPlayerInFirebase(roomCode, playerObj) {
  if (!db) return;
  const ref = db.ref(`rooms/${roomCode}/players/${playerObj.id}`);
  ref.set(playerObj);

  // Manejo de desconexión automático
  ref.onDisconnect().update({ isConnected: false });
}

// Guardar respuestas del jugador
function saveAnswersInFirebase(roomCode, playerId, answersObj, isComplete = false) {
  if (!db) return;
  const ref = db.ref(`rooms/${roomCode}/answers/${playerId}`);
  const payload = {};
  for (const [cat, val] of Object.entries(answersObj)) {
    payload[cat] = {
      text: (val || '').trim(),
      status: 'pending',
      points: 0
    };
  }
  ref.set(payload);

  // Marcar jugador como completado solo si terminó todas las respuestas o cantó STOP
  if (isComplete) {
    db.ref(`rooms/${roomCode}/players/${playerId}`).update({ submitted: true });
  }
}

// Actualizar estado de escribiendo
function setPlayerTypingInFirebase(roomCode, playerId, isTyping, playerInfo) {
  if (!db) return;
  const ref = db.ref(`rooms/${roomCode}/typing/${playerId}`);
  if (isTyping) {
    ref.set({
      id: playerId,
      nickname: playerInfo.nickname,
      avatar: playerInfo.avatar,
      timestamp: Date.now()
    });
    ref.onDisconnect().remove();
  } else {
    ref.remove();
  }
}

// Detonar giro de carrusel en la TV
function spinCarouselInFirebase(roomCode, targetLetter) {
  if (!db) return;
  getRoomRef(roomCode).update({
    status: 'ROULETTE',
    letter: targetLetter.toUpperCase(),
    carouselEvent: {
      targetLetter: targetLetter.toUpperCase(),
      timestamp: Date.now()
    }
  });
}

// Iniciar ronda
function startRoundInFirebase(roomCode, letter, duration, usedLetters) {
  if (!db) return;
  const updatedLetters = [...(usedLetters || [])];
  if (!updatedLetters.includes(letter)) {
    updatedLetters.push(letter);
  }

  getRoomRef(roomCode).update({
    status: 'ROUND_ACTIVE',
    letter: letter.toUpperCase(),
    usedLetters: updatedLetters,
    roundNumber: firebase.database.ServerValue.increment(1),
    roundTimeLimit: duration,
    timeRemaining: duration,
    timerStartedAt: Date.now(),
    stopCaller: null,
    currentSpotlight: null,
    reviewCategoryIndex: 0,
    answers: {},
    typing: {}
  });

  // Limpiar roundScore de los jugadores
  db.ref(`rooms/${roomCode}/players`).once('value', (snap) => {
    const players = snap.val();
    if (players) {
      const updates = {};
      Object.keys(players).forEach(pid => {
        updates[`rooms/${roomCode}/players/${pid}/roundScore`] = 0;
        updates[`rooms/${roomCode}/players/${pid}/submitted`] = false;
      });
      db.ref().update(updates);
    }
  });
}

// Cantar STOP
function callStopInFirebase(roomCode, callerObj) {
  if (!db) return;
  getRoomRef(roomCode).update({
    status: 'STOP_COUNTDOWN',
    stopCaller: callerObj,
    stopCalledAt: Date.now(),
    typing: {}
  });
}

// Calcular puntuaciones automáticas al terminar ronda
function calculateScoresInFirebase(roomCode, currentLetter, categories, stopCaller, answers, players) {
  if (!db || !answers) return;
  const targetLetter = (currentLetter || 'A').toUpperCase();
  const cats = categories || DEFAULT_CATEGORIES;

  const updatedAnswers = JSON.parse(JSON.stringify(answers));
  const playerRoundScores = {};
  Object.keys(players || {}).forEach(pid => {
    playerRoundScores[pid] = (stopCaller && stopCaller.id === pid ? 25 : 0);
  });

  cats.forEach(cat => {
    const textToPlayers = {};

    for (const [pid, pAns] of Object.entries(updatedAnswers)) {
      const item = pAns[cat];
      if (!item || !item.text) {
        if (item) {
          item.status = 'invalid';
          item.points = 0;
        }
        continue;
      }

      const cleanWord = item.text.trim();
      const startsCorrect = cleanWord.toUpperCase().startsWith(targetLetter);

      if (!startsCorrect) {
        item.status = 'invalid';
        item.points = 0;
        continue;
      }

      const norm = cleanWord.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (!textToPlayers[norm]) textToPlayers[norm] = [];
      textToPlayers[norm].push(pid);
    }

    for (const [norm, pids] of Object.entries(textToPlayers)) {
      if (pids.length === 1) {
        const pid = pids[0];
        updatedAnswers[pid][cat].status = 'valid';
        updatedAnswers[pid][cat].points = 100;
        playerRoundScores[pid] = (playerRoundScores[pid] || 0) + 100;
      } else {
        pids.forEach(pid => {
          updatedAnswers[pid][cat].status = 'repeated';
          updatedAnswers[pid][cat].points = 50;
          playerRoundScores[pid] = (playerRoundScores[pid] || 0) + 50;
        });
      }
    }
  });

  const updates = {};
  updates[`rooms/${roomCode}/status`] = 'REVIEW';
  updates[`rooms/${roomCode}/answers`] = updatedAnswers;
  updates[`rooms/${roomCode}/reviewCategoryIndex`] = 0;

  for (const [pid, rScore] of Object.entries(playerRoundScores)) {
    updates[`rooms/${roomCode}/players/${pid}/roundScore`] = rScore;
  }

  db.ref().update(updates);
}

// Modificar puntos de una respuesta desde el Admin
function overrideAnswerInFirebase(roomCode, playerId, category, status, points) {
  if (!db) return;
  db.ref(`rooms/${roomCode}/answers/${playerId}/${category}`).update({
    status: status,
    points: Number(points)
  });

  // Recalcular roundScore del jugador
  db.ref(`rooms/${roomCode}`).once('value', (snap) => {
    const room = snap.val();
    if (!room || !room.answers || !room.answers[playerId]) return;

    let rScore = (room.stopCaller && room.stopCaller.id === playerId ? 25 : 0);
    const pAnswers = room.answers[playerId];
    Object.values(pAnswers).forEach(ans => {
      if (ans && ans.points) rScore += Number(ans.points);
    });

    db.ref(`rooms/${roomCode}/players/${playerId}`).update({ roundScore: rScore });
  });
}

// Proyectar respuesta en TV (Spotlight)
function setSpotlightInFirebase(roomCode, spotlightData) {
  if (!db) return;
  getRoomRef(roomCode).update({ currentSpotlight: spotlightData });
}

function closeSpotlightInFirebase(roomCode) {
  if (!db) return;
  getRoomRef(roomCode).update({ currentSpotlight: null });
}

// Finalizar ronda y mostrar podio
function finishRoundInFirebase(roomCode, players) {
  if (!db || !players) return;
  const updates = {};
  updates[`rooms/${roomCode}/status`] = 'LEADERBOARD';

  Object.entries(players).forEach(([pid, p]) => {
    const newTotal = (p.score || 0) + (p.roundScore || 0);
    updates[`rooms/${roomCode}/players/${pid}/score`] = newTotal;
  });

  db.ref().update(updates);
}

// Reiniciar al Lobby
function resetToLobbyInFirebase(roomCode) {
  if (!db) return;
  getRoomRef(roomCode).update({
    status: 'LOBBY',
    currentSpotlight: null,
    typing: {}
  });

  db.ref(`rooms/${roomCode}/players`).once('value', (snap) => {
    const players = snap.val();
    if (players) {
      const updates = {};
      Object.keys(players).forEach(pid => {
        updates[`rooms/${roomCode}/players/${pid}/roundScore`] = 0;
        updates[`rooms/${roomCode}/players/${pid}/submitted`] = false;
      });
      db.ref().update(updates);
    }
  });
}

// Cambiar fondo PNG global (Base64)
function setBackgroundInFirebase(roomCode, base64Url) {
  if (!db) return;
  getRoomRef(roomCode).update({ backgroundUrl: base64Url });
}

function removeBackgroundInFirebase(roomCode) {
  if (!db) return;
  getRoomRef(roomCode).update({ backgroundUrl: null });
}
