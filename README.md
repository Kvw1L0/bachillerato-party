# 🎮 Bachillerato Party (Vercel + Firebase Realtime Database)

Una experiencia multijugador interactiva en tiempo real al estilo **Jackbox Games** y **Kahoot**, diseñada para jugar al **Bachillerato** (*Pit Stop*, *Basta*, *Tutti Frutti* o *Stop*).

Esta versión es **100% Serverless**: está optimizada para ser desplegada en **Vercel** de forma gratuita y sincronizada en tiempo real mediante **Google Firebase Realtime Database** (sin necesidad de mantener servidores Node.js encendidos).

---

## 🏛️ Arquitectura de 3 Pantallas

1. **📺 Pantalla de TV Gigante (`/tv.html`)**: Diseñada para proyectores o Smart TVs. Genera el código QR para unirse, proyecta la ruleta carrusel estilo Netflix, el cronómetro de ronda con tensión sonora/visual en los últimos 10s, la barra de avatares escribiendo en vivo, el aviso monumental de STOP y el ranking animado estilo Kahoot con confeti.
2. **🎛️ Panel del Administrador (`/admin.html`)**: La cabina de control del presentador desde donde se detona lo que ocurre en la TV, se configuran los tiempos (30s, 45s, 60s, 90s, 120s o libre), se eligen y crean categorías, se carga un fondo temático y se moderan las respuestas en vivo con proyección en pantalla grande.
3. **📱 Pantalla del Jugador Móvil (`/`)**: Formulario táctil responsivo para los participantes. Cuenta con selección de avatar, autoguardado continuo, indicador visual de letra correcta y botón de STOP.

---

## 🚀 Despliegue en Vercel & Firebase (Paso a Paso)

### Paso 1: Configurar Firebase (Base de Datos en Tiempo Real Gratuita)
1. Entra a [console.firebase.google.com](https://console.firebase.google.com/) con tu cuenta de Google.
2. Haz clic en **"Crear un proyecto"** (puedes nombrarlo `bachillerato-party`) y desactiva Google Analytics para hacerlo más rápido.
3. En el menú lateral izquierdo, ve a **Compilación** -> **Realtime Database** y haz clic en **"Crear base de datos"**.
   - Elige la ubicación por defecto y selecciona **"Modo de prueba"** (para permitir lectura y escritura inmediatas).
4. En el menú lateral, ve al icono de tuerca ⚙️ (**Configuración del proyecto**) -> pestaña **General** -> baja hasta **Tus apps** y haz clic en el icono web `</>`.
5. Copia el objeto `firebaseConfig` que te entrega Firebase y pégalo en el archivo:
   📁 **`public/firebase-config.js`**

### Paso 2: Subir a GitHub
```bash
git add .
git commit -m "feat: complete Firebase Realtime Database migration for Vercel"
git push origin main
```

### Paso 3: Desplegar en Vercel
1. Entra a [vercel.com](https://vercel.com/) e inicia sesión con tu cuenta de GitHub.
2. Haz clic en **"Add New..."** -> **"Project"**.
3. Selecciona tu repositorio `bachillerato-party` y haz clic en **"Deploy"**.
4. ¡Listo! Vercel te entregará una URL global (ej: `https://bachillerato-party.vercel.app`) y el juego funcionará en cualquier parte del mundo.

---

## 💻 Ejecución Local (Opcional)
Si deseas probarlo localmente en tu equipo:
```bash
npm install
npm start
```
Abre en tu navegador:
* **📺 TV:** `http://localhost:3000/tv.html`
* **🎛️ Admin:** `http://localhost:3000/admin.html`
* **📱 Jugadores:** `http://localhost:3000/`

---

## 📄 Licencia
MIT
