const express = require('express');
const path = require('path');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;

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

// Servir archivos estáticos de la carpeta public
app.use(express.static(path.join(__dirname, 'public')));

// Rutas directas
app.get('/tv', (req, res) => res.sendFile(path.join(__dirname, 'public', 'tv.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`🔥 BACHILLERATO PARTY (VERCEL & FIREBASE READY)`);
  console.log(`📺 TV Gigante:     http://localhost:${PORT}/tv.html`);
  console.log(`🎛️ Administrador:  http://localhost:${PORT}/admin.html`);
  console.log(`📱 Jugador Móvil:  http://${LOCAL_IP}:${PORT}/`);
  console.log(`=======================================================`);
});
