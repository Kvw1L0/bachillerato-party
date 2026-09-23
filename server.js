const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const os = require('os');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 3000;

// Aumentar límite de JSON para recibir imágenes PNG en base64
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Obtener IP local para que los celulares y TV se conecten
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const LOCAL_IP = getLocalIpAddress();

// Asegurar carpeta de uploads
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Estructura de salas
const rooms = {};

const DEFAULT_CATEGORIES = [
  'Nombre',
  'País o Ciudad',
  'Animal',
  'Fruta o Verdura',
  'Cosa u Objeto',
  'Color',
  'Profesión u Oficio'
];

function getOrCreateRoom(code = 'BACH1') {
  const cleanCode = code.toUpperCase().trim();
  if (!rooms[cleanCode]) {
    rooms[cleanCode] = {
      code: cleanCode,
      adminSocketId: null,
      tvSocketIds: new Set(),
      status: 'LOBBY', // 'LOBBY' | 'ROULETTE' | 'ROUND_ACTIVE' | 'STOP_COUNTDOWN' | 'REVIEW' | 'LEADERBOARD'
      letter: 'A',
      usedLetters: [],
      categories: [...DEFAULT_CATEGORIES],
      roundNumber: 0,
      roundTimeLimit: 60, // 0 = sin límite, o segundos (ej. 30, 45, 60, 90, 120, 180)
      timeRemaining: 60,
      timerInterval: null,
      stopCountdownInterval: null,
      stopCaller: null, // { nickname, avatar, id }
      backgroundUrl: null, // URL del PNG global personalizado
      typingPlayers: {}, // socketId -> { id, nickname, avatar }
      players: {}, // socketId -> { id, nickname, avatar, theme, score, roundScore, submitted, isConnected }
      answers: {}, // socketId -> { category: { text, status, points } }
      reviewCategoryIndex: 0,
      currentSpotlight: null // { playerId, playerName, avatar, category, answer }
    };
  }
  return rooms[cleanCode];
}

function broadcastRoomState(room) {
  const payload = {
    code: room.code,
    status: room.status,
    letter: room.letter,
    usedLetters: room.usedLetters,
    categories: room.categories,
    roundNumber: room.roundNumber,
    roundTimeLimit: room.roundTimeLimit,
    timeRemaining: room.timeRemaining,
    stopCaller: room.stopCaller,
    backgroundUrl: room.backgroundUrl,
    reviewCategoryIndex: room.reviewCategoryIndex,
    currentSpotlight: room.currentSpotlight,
    players: Object.values(room.players).map(p => ({
      id: p.id,
      nickname: p.nickname,
      avatar: p.avatar,
      theme: p.theme,
      score: p.score,
      roundScore: p.roundScore,
      submitted: p.submitted || false,
      isConnected: p.isConnected
    }))
  };

  io.to(room.code).emit('room:state', payload);
}

function sendAdminData(room) {
  if (room.adminSocketId) {
    io.to(room.adminSocketId).emit('admin:detailed_data', {
      answers: room.answers,
      players: room.players,
      categories: room.categories,
      status: room.status,
      roundTimeLimit: room.roundTimeLimit,
      backgroundUrl: room.backgroundUrl
    });
  }
}

// Endpoint para información del servidor y QR
app.get('/api/server-info', async (req, res) => {
  const roomCode = req.query.room || 'BACH1';
  const room = getOrCreateRoom(roomCode);
  const playerUrl = `http://${LOCAL_IP}:${PORT}/?room=${roomCode}`;
  const tvUrl = `http://${LOCAL_IP}:${PORT}/tv.html?room=${roomCode}`;
  const adminUrl = `http://${LOCAL_IP}:${PORT}/admin.html?room=${roomCode}`;

  try {
    const qrDataUrl = await QRCode.toDataURL(playerUrl, {
      margin: 2,
      width: 400,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    });

    res.json({
      localIp: LOCAL_IP,
      port: PORT,
      roomCode,
      playerUrl,
      tvUrl,
      adminUrl,
      qrDataUrl,
      backgroundUrl: room.backgroundUrl
    });
  } catch (err) {
    res.status(500).json({ error: 'Error generando QR' });
  }
});

// Endpoint para subir fondo PNG global
app.post('/api/upload-background', (req, res) => {
  try {
    const { imageBase64, roomCode = 'BACH1' } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'No se envió la imagen' });
    }

    // Extraer base64
    const matches = imageBase64.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: 'Formato de imagen inválido' });
    }

    const buffer = Buffer.from(matches[2], 'base64');
    const filename = `bg-${Date.now()}.png`;
    const filePath = path.join(uploadsDir, filename);

    fs.writeFileSync(filePath, buffer);

    const bgUrl = `/uploads/${filename}`;
    const room = getOrCreateRoom(roomCode);
    room.backgroundUrl = bgUrl;

    broadcastRoomState(room);
    sendAdminData(room);

    res.json({ success: true, backgroundUrl: bgUrl });
  } catch (err) {
    console.error('Error subiendo fondo:', err);
    res.status(500).json({ error: 'Error al guardar la imagen' });
  }
});

// Endpoint para quitar fondo PNG personalizado
app.post('/api/remove-background', (req, res) => {
  const { roomCode = 'BACH1' } = req.body;
  const room = getOrCreateRoom(roomCode);
  room.backgroundUrl = null;

  broadcastRoomState(room);
  sendAdminData(room);

  res.json({ success: true });
});

// ==================== SOCKET.IO ====================
io.on('connection', (socket) => {
  let currentRoomCode = null;
  let role = null; // 'admin' | 'tv' | 'player'

  // --- REGISTRO ADMIN ---
  socket.on('admin:join', ({ roomCode }) => {
    const code = (roomCode || 'BACH1').toUpperCase().trim();
    const room = getOrCreateRoom(code);
    room.adminSocketId = socket.id;
    currentRoomCode = code;
    role = 'admin';
    socket.join(code);

    socket.emit('admin:joined', { roomCode: code, localIp: LOCAL_IP, port: PORT });
    broadcastRoomState(room);
    sendAdminData(room);
  });

  // --- REGISTRO PANTALLA TV GIGANTE ---
  socket.on('tv:join', ({ roomCode }) => {
    const code = (roomCode || 'BACH1').toUpperCase().trim();
    const room = getOrCreateRoom(code);
    room.tvSocketIds.add(socket.id);
    currentRoomCode = code;
    role = 'tv';
    socket.join(code);

    socket.emit('tv:joined', { roomCode: code });
    broadcastRoomState(room);
  });

  // --- REGISTRO JUGADOR MÓVIL ---
  socket.on('player:join', ({ roomCode, nickname, avatar, theme }) => {
    const code = (roomCode || 'BACH1').toUpperCase().trim();
    const room = getOrCreateRoom(code);
    currentRoomCode = code;
    role = 'player';
    socket.join(code);

    const safeNickname = (nickname || 'Jugador').substring(0, 16).trim();
    room.players[socket.id] = {
      id: socket.id,
      nickname: safeNickname,
      avatar: avatar || '🐱',
      theme: theme || 'sunset',
      score: 0,
      roundScore: 0,
      submitted: false,
      isConnected: true
    };

    socket.emit('player:joined', {
      playerId: socket.id,
      roomCode: code,
      nickname: safeNickname
    });

    broadcastRoomState(room);
    sendAdminData(room);
  });

  // --- ADMIN: CAMBIAR TIEMPO DE RONDA ---
  socket.on('admin:set_round_duration', ({ seconds }) => {
    if (role !== 'admin' || !currentRoomCode) return;
    const room = rooms[currentRoomCode];
    if (!room) return;
    room.roundTimeLimit = Number(seconds);
    room.timeRemaining = room.roundTimeLimit;
    broadcastRoomState(room);
    sendAdminData(room);
  });

  // --- ADMIN: DETONAR VISTA EN LA TV ---
  socket.on('admin:show_tv_view', ({ view }) => {
    if (role !== 'admin' || !currentRoomCode) return;
    const room = rooms[currentRoomCode];
    if (!room) return;
    room.status = view; // 'LOBBY' | 'ROULETTE' | 'ROUND_ACTIVE' | 'LEADERBOARD'
    broadcastRoomState(room);
  });

  // --- ADMIN: DETONAR GIRO DE CARRUSEL NETFLIX EN TV ---
  socket.on('admin:spin_carousel', ({ letter }) => {
    if (role !== 'admin' || !currentRoomCode) return;
    const room = rooms[currentRoomCode];
    if (!room) return;

    room.status = 'ROULETTE';
    room.letter = letter.toUpperCase();
    if (!room.usedLetters.includes(room.letter)) {
      room.usedLetters.push(room.letter);
    }

    // Notificar a la TV para iniciar la animación cinematográfica
    io.to(room.code).emit('tv:animate_carousel', { targetLetter: room.letter });
    broadcastRoomState(room);
  });

  // --- ADMIN: ACTUALIZAR CATEGORÍAS ---
  socket.on('admin:update_categories', ({ categories }) => {
    if (role !== 'admin' || !currentRoomCode) return;
    const room = rooms[currentRoomCode];
    if (!room) return;

    if (Array.isArray(categories) && categories.length > 0) {
      room.categories = categories.map(c => c.trim()).filter(Boolean);
      broadcastRoomState(room);
      sendAdminData(room);
    }
  });

  // --- ADMIN: INICIAR RONDA ---
  socket.on('admin:start_round', ({ letter, roundTimeLimit }) => {
    if (role !== 'admin' || !currentRoomCode) return;
    const room = rooms[currentRoomCode];
    if (!room) return;

    if (room.timerInterval) clearInterval(room.timerInterval);
    if (room.stopCountdownInterval) clearInterval(room.stopCountdownInterval);

    room.status = 'ROUND_ACTIVE';
    room.roundNumber += 1;
    if (letter) {
      room.letter = letter.toUpperCase();
      if (!room.usedLetters.includes(room.letter)) {
        room.usedLetters.push(room.letter);
      }
    }
    if (roundTimeLimit !== undefined) {
      room.roundTimeLimit = Number(roundTimeLimit);
    }
    room.timeRemaining = room.roundTimeLimit;
    room.stopCaller = null;
    room.currentSpotlight = null;
    room.reviewCategoryIndex = 0;
    room.typingPlayers = {};
    io.to(room.code).emit('room:typing_update', { typingList: [] });

    // Resetear respuestas de los jugadores
    room.answers = {};
    for (const pid of Object.keys(room.players)) {
      room.players[pid].roundScore = 0;
      room.players[pid].submitted = false;
      room.answers[pid] = {};
      room.categories.forEach(cat => {
        room.answers[pid][cat] = {
          text: '',
          status: 'pending',
          points: 0
        };
      });
    }

    // Intervalo de cronómetro sincronizado (si timeLimit > 0)
    if (room.roundTimeLimit > 0) {
      room.timerInterval = setInterval(() => {
        room.timeRemaining -= 1;
        io.to(room.code).emit('round:tick', { timeRemaining: room.timeRemaining });

        if (room.timeRemaining <= 0) {
          clearInterval(room.timerInterval);
          startStopCountdown(room, { nickname: 'Tiempo Agotado', avatar: '⏰' });
        }
      }, 1000);
    }

    broadcastRoomState(room);
    sendAdminData(room);
  });

  // --- JUGADOR O ADMIN CANTAN "¡STOP!" ---
  function startStopCountdown(room, callerObj) {
    if (room.status !== 'ROUND_ACTIVE') return;

    room.status = 'STOP_COUNTDOWN';
    room.stopCaller = callerObj;
    room.typingPlayers = {};
    io.to(room.code).emit('room:typing_update', { typingList: [] });
    let seconds = 5;

    io.to(room.code).emit('round:stop_called', {
      caller: callerObj,
      seconds
    });
    broadcastRoomState(room);

    room.stopCountdownInterval = setInterval(() => {
      seconds -= 1;
      io.to(room.code).emit('round:stop_tick', { seconds });

      if (seconds <= 0) {
        clearInterval(room.stopCountdownInterval);
        endRoundAndStartReview(room);
      }
    }, 1000);
  }

  socket.on('player:call_stop', () => {
    if (!currentRoomCode) return;
    const room = rooms[currentRoomCode];
    if (!room || room.status !== 'ROUND_ACTIVE') return;

    const player = room.players[socket.id];
    const callerObj = player
      ? { nickname: player.nickname, avatar: player.avatar, id: player.id }
      : { nickname: 'Jugador', avatar: '⚡', id: socket.id };

    if (player) {
      player.roundScore += 25; // Bonus de velocidad
    }

    startStopCountdown(room, callerObj);
  });

  socket.on('admin:force_stop', () => {
    if (role !== 'admin' || !currentRoomCode) return;
    const room = rooms[currentRoomCode];
    if (!room || room.status !== 'ROUND_ACTIVE') return;
    startStopCountdown(room, { nickname: 'Anfitrión', avatar: '👑', id: socket.id });
  });

  // --- JUGADOR: AUTOGUARDADO EN TIEMPO REAL ---
  socket.on('player:save_answers', ({ answers }) => {
    if (!currentRoomCode) return;
    const room = rooms[currentRoomCode];
    if (!room || (room.status !== 'ROUND_ACTIVE' && room.status !== 'STOP_COUNTDOWN')) return;

    if (!room.answers[socket.id]) room.answers[socket.id] = {};
    if (answers && typeof answers === 'object') {
      for (const [cat, val] of Object.entries(answers)) {
        room.answers[socket.id][cat] = {
          text: (val || '').trim(),
          status: 'pending',
          points: 0
        };
      }
    }

    if (room.players[socket.id]) {
      room.players[socket.id].submitted = true;
    }

    sendAdminData(room);
    broadcastRoomState(room);
  });

  // --- JUGADOR: INDICADOR DE ESCRIBIENDO EN VIVO ---
  socket.on('player:typing', ({ isTyping }) => {
    if (!currentRoomCode) return;
    const room = rooms[currentRoomCode];
    if (!room || room.status !== 'ROUND_ACTIVE') return;

    const player = room.players[socket.id];
    if (!player) return;

    if (isTyping) {
      room.typingPlayers[socket.id] = {
        id: socket.id,
        nickname: player.nickname,
        avatar: player.avatar
      };
    } else {
      delete room.typingPlayers[socket.id];
    }

    io.to(room.code).emit('room:typing_update', {
      typingList: Object.values(room.typingPlayers)
    });
  });

  // --- FINALIZAR RONDA Y CALCULAR PUNTOS ---
  function endRoundAndStartReview(room) {
    if (room.timerInterval) clearInterval(room.timerInterval);
    if (room.stopCountdownInterval) clearInterval(room.stopCountdownInterval);

    room.status = 'REVIEW';
    room.reviewCategoryIndex = 0;
    room.currentSpotlight = null;

    calculateAutoScores(room);

    broadcastRoomState(room);
    sendAdminData(room);
  }

  function calculateAutoScores(room) {
    const targetLetter = room.letter.toUpperCase();

    room.categories.forEach(cat => {
      const textToPlayers = {};

      for (const [pid, playerAnswers] of Object.entries(room.answers)) {
        const item = playerAnswers[cat];
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
          room.answers[pid][cat].status = 'valid';
          room.answers[pid][cat].points = 100;
        } else {
          pids.forEach(pid => {
            room.answers[pid][cat].status = 'repeated';
            room.answers[pid][cat].points = 50;
          });
        }
      }
    });

    for (const [pid, pObj] of Object.entries(room.players)) {
      let rScore = (room.stopCaller && room.stopCaller.nickname === pObj.nickname ? 25 : 0);
      if (room.answers[pid]) {
        for (const cat of room.categories) {
          const item = room.answers[pid][cat];
          if (item && item.points) rScore += item.points;
        }
      }
      pObj.roundScore = rScore;
    }
  }

  // --- ADMIN: PROYECTAR RESPUESTA EN TV (SPOTLIGHT SHOWMAN) ---
  socket.on('admin:spotlight_answer', ({ playerId, playerName, avatar, category, answer }) => {
    if (role !== 'admin' || !currentRoomCode) return;
    const room = rooms[currentRoomCode];
    if (!room) return;

    room.currentSpotlight = { playerId, playerName, avatar, category, answer };
    io.to(room.code).emit('tv:spotlight', room.currentSpotlight);
    broadcastRoomState(room);
  });

  socket.on('admin:close_spotlight', () => {
    if (role !== 'admin' || !currentRoomCode) return;
    const room = rooms[currentRoomCode];
    if (!room) return;

    room.currentSpotlight = null;
    io.to(room.code).emit('tv:close_spotlight');
    broadcastRoomState(room);
  });

  // --- ADMIN: CALIFICAR / AJUSTAR RESPUESTA ---
  socket.on('admin:override_answer_status', ({ playerId, category, status, points }) => {
    if (role !== 'admin' || !currentRoomCode) return;
    const room = rooms[currentRoomCode];
    if (!room || !room.answers[playerId] || !room.answers[playerId][category]) return;

    room.answers[playerId][category].status = status;
    room.answers[playerId][category].points = Number(points);

    const pObj = room.players[playerId];
    if (pObj) {
      let rScore = (room.stopCaller && room.stopCaller.nickname === pObj.nickname ? 25 : 0);
      for (const cat of room.categories) {
        const item = room.answers[playerId][cat];
        if (item && item.points) rScore += item.points;
      }
      pObj.roundScore = rScore;
    }

    sendAdminData(room);
    broadcastRoomState(room);
  });

  // --- ADMIN: FINALIZAR REVISIÓN Y MOSTRAR PODIO ---
  socket.on('admin:finish_round_scores', () => {
    if (role !== 'admin' || !currentRoomCode) return;
    const room = rooms[currentRoomCode];
    if (!room) return;

    for (const p of Object.values(room.players)) {
      p.score += (p.roundScore || 0);
    }

    room.status = 'LEADERBOARD';
    broadcastRoomState(room);
    sendAdminData(room);
  });

  // --- ADMIN: REINICIAR AL LOBBY ---
  socket.on('admin:reset_to_lobby', () => {
    if (role !== 'admin' || !currentRoomCode) return;
    const room = rooms[currentRoomCode];
    if (!room) return;

    room.status = 'LOBBY';
    room.currentSpotlight = null;
    for (const p of Object.values(room.players)) {
      p.roundScore = 0;
      p.submitted = false;
    }

    broadcastRoomState(room);
    sendAdminData(room);
  });

  // --- DESCONEXIÓN ---
  socket.on('disconnect', () => {
    if (!currentRoomCode || !rooms[currentRoomCode]) return;
    const room = rooms[currentRoomCode];

    if (role === 'admin' && room.adminSocketId === socket.id) {
      room.adminSocketId = null;
    } else if (role === 'tv') {
      room.tvSocketIds.delete(socket.id);
    } else if (role === 'player' && room.players[socket.id]) {
      room.players[socket.id].isConnected = false;
      setTimeout(() => {
        if (room.players[socket.id] && !room.players[socket.id].isConnected) {
          delete room.players[socket.id];
          broadcastRoomState(room);
          sendAdminData(room);
        }
      }, 30000);
    }

    broadcastRoomState(room);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`🎉 BACHILLERATO PARTY (3 PANTALLAS) SERVER INICIADO!`);
  console.log(`📺 Pantalla de TV Gigante: http://localhost:${PORT}/tv.html`);
  console.log(`🎛️ Panel de Administrador: http://localhost:${PORT}/admin.html`);
  console.log(`📱 Enlace Móvil Jugador:   http://${LOCAL_IP}:${PORT}/`);
  console.log(`=======================================================`);
});
